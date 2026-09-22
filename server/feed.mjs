// POST /api/feed : crée le jeton d'un élève à partir de sa sélection de cours.
// GET /api/feed?token=… : sert son flux ICS. La logique est ici ; api/feed.mjs ne fait que la brancher sur Redis.
import { scheduleKey, tokenKey } from '../shared/redis-keys.mjs';
import { generateToken, hashToken } from '../shared/token.mjs';
import { buildDetailedLessons, validatePromotionLabels } from './lessons.mjs';
import { buildIcs } from './ics.mjs';
import { HttpError, icsResponse, jsonNoStore } from './http.mjs';

const MAX_LESSON_IDS = 200;
const MAX_LESSON_ID_LENGTH = 200;

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, 'Corps JSON invalide');
  }
}

// Sélection déjà résolue côté front (src/data/lessons.ts, getDefaultLessonIds) : les identifiants de
// tous les cours suivis par l'élève, obligatoires compris. On ne fait ici que des contrôles défensifs
// de forme ; un identifiant qui ne correspondrait à aucun cours réel est simplement ignoré à la lecture.
function validateLessonIds(lessonIds) {
  if (!Array.isArray(lessonIds)) throw new HttpError(400, 'Paramètre lessonIds invalide');
  if (lessonIds.length > MAX_LESSON_IDS) throw new HttpError(400, `${MAX_LESSON_IDS} cours au maximum`);
  if (!lessonIds.every((id) => typeof id === 'string' && id.length > 0 && id.length <= MAX_LESSON_ID_LENGTH)) {
    throw new HttpError(400, 'Paramètre lessonIds invalide');
  }
  return [...new Set(lessonIds)];
}

export async function createFeed(redis, request) {
  const body = await readBody(request);
  const promotions = validatePromotionLabels(Array.isArray(body?.promotions) ? body.promotions : []);
  const lessonIds = validateLessonIds(body?.lessonIds);

  const token = generateToken();
  await redis.setJson(tokenKey(hashToken(token)), { promotions, lessonIds, createdAt: new Date().toISOString() });
  return jsonNoStore({ token });
}

export async function getFeedIcs(redis, url) {
  const token = url.searchParams.get('token');
  if (!token) throw new HttpError(400, 'Paramètre token manquant');

  const selection = await redis.getJson(tokenKey(hashToken(token)));
  if (!selection) throw new HttpError(404, 'Flux inconnu');

  // Une clé absente ne devrait pas arriver (une promotion stockée dans un jeton a forcément un planning
  // au moment de la création), mais une promotion peut disparaître entre-temps : on l'ignore plutôt que
  // de faire échouer tout le flux de l'élève.
  const records = (await redis.mgetJson(selection.promotions.map(scheduleKey))).filter(Boolean);
  const lessons = buildDetailedLessons(records).filter(
    (lesson) => lesson.mandatory || selection.lessonIds.includes(lesson.id),
  );
  // D'après `records`, pas `selection.promotions` : une promotion disparue entre-temps (filtrée plus haut)
  // ne doit pas déclencher la précision de promotion sur les cours de celle qui reste.
  // Sans promotion connue, `lessons` est déjà vide : buildIcs ne lit alors jamais firstMonday.
  return icsResponse(buildIcs(lessons, records[0]?.firstMonday ?? null, records.map((record) => record.promotion)));
}
