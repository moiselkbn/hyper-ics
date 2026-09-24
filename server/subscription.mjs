// Abonnement d'un élève, retrouvé par le hash de son jeton (jamais le jeton en clair).
// POST /api/subscription : crée l'abonnement et renvoie le jeton, une seule fois.
// GET /api/subscription?token=… : la sélection enregistrée (page de retour /m/<jeton>, qui la recoche quand l'élève
// revient la modifier) ; 404 si l'abonnement n'existe pas.
// PUT /api/subscription?token=… : remplace la sélection d'un abonnement existant : même jeton, donc même flux,
// sans doublon dans le calendrier de l'élève.
// La logique est ici ; api/subscription.mjs ne fait que la brancher sur Redis.
//
// Ce qui est stocké : par promotion, un mode et des clés de matière (voir shared/course-key.mjs), jamais les
// identifiants de cours, qui changent quand un cours reçoit un code. Le flux se recalcule à chaque lecture à
// partir du dernier scrap : une nouvelle semaine d'un cours suivi y entre toute seule.
//  - `all-except` : tous les cours de la promotion, présents et à venir, sauf ceux de `keys` (décochés) ;
//  - `only` : seulement les cours de `keys` (cochés).
import { SCHEDULE_INDEX_KEY, subscriptionKey } from '../shared/redis-keys.mjs';
import { generateToken, hashToken, isTokenFormat } from '../shared/token.mjs';
import { HttpError, jsonNoStore, readJsonBody } from './http.mjs';
import { validatePromotionLabels } from './lessons.mjs';

const MAX_KEYS = 200;
const MAX_KEY_LENGTH = 200;

function validateKeys(keys) {
  if (!Array.isArray(keys)) throw new HttpError(400, 'Sélection invalide');
  if (keys.length > MAX_KEYS) throw new HttpError(400, `${MAX_KEYS} cours au maximum par promotion`);
  if (!keys.every((key) => typeof key === 'string' && key.length > 0 && key.length <= MAX_KEY_LENGTH)) {
    throw new HttpError(400, 'Sélection invalide');
  }
  return [...new Set(keys)];
}

// Corps attendu : { promotions: [{ label, checked: [clés], unchecked: [clés] }] }, une entrée par promotion
// choisie, avec les cours à choisir de cette promotion tels que l'élève les a laissés (les cours obligatoires,
// sans code, n'y figurent pas : ils sont toujours dans le flux).
export function parseSelection(body) {
  const entries = body?.promotions;
  if (!Array.isArray(entries)) throw new HttpError(400, 'Paramètre promotions manquant');
  const labels = entries.map((entry) => (typeof entry?.label === 'string' ? entry.label.trim() : ''));
  // Mêmes règles que GET /api/lessons (1 ou 2 promotions, libellés courts) ; un libellé vide ou répété est refusé.
  if (labels.includes('') || validatePromotionLabels(labels).length !== entries.length) {
    throw new HttpError(400, 'Paramètre promotions invalide');
  }
  return entries.map((entry, index) => {
    const checked = validateKeys(entry.checked);
    // Une clé cochée ET décochée est traitée comme cochée : mieux vaut un cours en trop qu'un cours manquant.
    const unchecked = validateKeys(entry.unchecked).filter((key) => !checked.includes(key));
    return { label: labels[index], checked, unchecked };
  });
}

// Part des cours gardés dans une promotion ; sans cours à choisir, rien n'a été décoché.
function keptRatio({ checked, unchecked }) {
  const total = checked.length + unchecked.length;
  return total === 0 ? 1 : checked.length / total;
}

// Une seule promotion : elle suit tout, sauf les cours décochés.
// Deux promotions (chevauchement) : une promotion dont l'élève a gardé au moins la moitié des cours est la sienne,
// elle suit tout sauf les cours décochés ; dans l'autre, il ne suit que les cours cochés, et les cours publiés
// plus tard n'y entrent pas. Si aucune n'atteint la moitié, la plus gardée suit quand même tout : un cours en
// trop se remarque, un cours manquant fait rater un cours.
export function chooseModes(selection) {
  const ratios = selection.map(keptRatio);
  const followsAll = ratios.map((ratio) => selection.length === 1 || ratio >= 0.5);
  if (!followsAll.includes(true)) followsAll[ratios.indexOf(Math.max(...ratios))] = true;
  return selection.map((entry, index) =>
    followsAll[index]
      ? { label: entry.label, mode: 'all-except', keys: entry.unchecked }
      : { label: entry.label, mode: 'only', keys: entry.checked },
  );
}

// Un cours (sortie de buildLessons ou buildDetailedLessons, server/lessons.mjs) entre dans le flux s'il est
// obligatoire, ou si une des promotions de l'élève où il a lieu le retient.
export function isLessonFollowed(lesson, subscription) {
  if (lesson.mandatory) return true;
  return subscription.promotions.some(
    ({ label, mode, keys }) =>
      lesson.promotions.includes(label) && (mode === 'all-except' ? !keys.includes(lesson.key) : keys.includes(lesson.key)),
  );
}

// L'index ne liste que des promotions qui ont un planning en base.
async function knownPromotions(redis) {
  const index = await redis.getJson(SCHEDULE_INDEX_KEY);
  return new Set((index?.promotions ?? []).map((entry) => entry.label));
}

async function assertPromotionsExist(redis, labels) {
  const known = await knownPromotions(redis);
  if (!labels.every((label) => known.has(label))) throw new HttpError(404, 'Promotion inconnue');
}

// Le flux a aussi une adresse publique, /f/<jeton>, réécrite vers /api/feed?token=… par vercel.json : on lit le
// chemin en secours, pour ne pas dépendre de la forme d'URL que la plateforme transmet à la fonction.
const FEED_PATH = /^\/f\/([^/]+)$/;

function tokenFrom(url) {
  const token = url.searchParams.get('token') ?? url.pathname.match(FEED_PATH)?.[1];
  if (!token) throw new HttpError(400, 'Paramètre token manquant');
  // Un jeton mal formé ne peut correspondre à aucun abonnement : inutile d'interroger Redis.
  if (!isTokenFormat(token)) throw new HttpError(404, 'Abonnement inconnu');
  return token;
}

// L'abonnement désigné par le paramètre `token` de l'URL ; 404 s'il n'existe pas.
export async function findSubscription(redis, url) {
  const token = tokenFrom(url);
  const subscription = await redis.getJson(subscriptionKey(hashToken(token)));
  if (!subscription) throw new HttpError(404, 'Abonnement inconnu');
  return { token, subscription };
}

async function readSelection(redis, request) {
  const selection = parseSelection(await readJsonBody(request));
  await assertPromotionsExist(redis, selection.map((entry) => entry.label));
  return chooseModes(selection);
}

export async function createSubscription(redis, request, now = new Date()) {
  const promotions = await readSelection(redis, request);
  const token = generateToken();
  const date = now.toISOString();
  await redis.setJson(subscriptionKey(hashToken(token)), { promotions, createdAt: date, updatedAt: date });
  return jsonNoStore({ token });
}

// Une promotion sortie de l'index depuis (hors périmètre, renommée) n'est pas renvoyée : l'élève ne pourrait ni la
// voir ni la décocher, et le PUT la refuserait.
export async function getSubscription(redis, url) {
  const { subscription } = await findSubscription(redis, url);
  const known = await knownPromotions(redis);
  return jsonNoStore({ promotions: subscription.promotions.filter((entry) => known.has(entry.label)) });
}

export async function updateSubscription(redis, request, now = new Date()) {
  const { token, subscription } = await findSubscription(redis, new URL(request.url));
  const promotions = await readSelection(redis, request);
  await redis.setJson(subscriptionKey(hashToken(token)), {
    promotions,
    createdAt: subscription.createdAt,
    updatedAt: now.toISOString(),
  });
  return jsonNoStore({ ok: true });
}
