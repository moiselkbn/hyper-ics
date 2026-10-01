// Lectures du flux /f/<jeton> par application de calendrier : sur sa page, l'élève voit si son calendrier est bien
// ajouté et s'il se met encore à jour. Une entrée par application (Apple, Google), pas par appareil : avec iCloud ou
// un compte Google, l'appareil qui lit le flux ne dit rien de ceux où les cours apparaissent.
// Forme : { apple: { firstReadAt, lastReadAt }, google: { … } } ; une application absente n'a jamais lu le flux.
// Rien d'autre n'est gardé : ni l'user-agent, ni l'adresse IP.
// Stocké à part de l'abonnement (voir feedReadsKey, shared/redis-keys.mjs) : une lecture du flux ne doit jamais
// écraser une modification de la sélection faite au même moment.
import { feedReadsKey } from '../shared/redis-keys.mjs';

// Calendrier d'Apple (iPhone, iPad, Mac) lit le flux par son démon dataaccessd (« macOS/27.0 (26A428)
// dataaccessd/1.0 », vu dans les logs Vercel ; CalendarAgent sur les anciens macOS) ; Google Agenda par ses
// serveurs (« Google-Calendar-Importer »). Tout autre client (navigateur, robot) n'est pas compté.
const READERS = [
  { app: 'apple', pattern: /dataaccessd|CalendarAgent/i },
  { app: 'google', pattern: /Google-Calendar-Importer/i },
];

// Calendrier d'Apple lit le flux avant même que l'élève confirme l'ajout, et le lit même s'il annule : sa première
// lecture ne prouve rien. Une lecture au moins 10 min après la première, si : un abonnement relit le flux, un ajout
// annulé jamais. Google ne lit le flux qu'une fois l'ajout confirmé (vérifié le 2026-10-01).
export const APPLE_CONFIRMATION_MS = 10 * 60 * 1000;

// Une fois l'ajout confirmé, la dernière lecture n'est réécrite qu'une fois par heure au plus : assez pour dire
// « synchro il y a X » et repérer un calendrier qui ne se met plus à jour, sans une écriture Redis par lecture.
export const READ_WRITE_INTERVAL_MS = 60 * 60 * 1000;

// L'application qui lit le flux, ou null pour un client qui n'en est pas une.
export function detectReader(userAgent) {
  if (!userAgent) return null;
  return READERS.find(({ pattern }) => pattern.test(userAgent))?.app ?? null;
}

// Ajout confirmé : Google dès sa première lecture, Apple à une lecture au moins 10 min après la première.
export function isAddConfirmed(app, read) {
  if (app === 'google') return true;
  return Date.parse(read.lastReadAt) - Date.parse(read.firstReadAt) >= APPLE_CONFIRMATION_MS;
}

// Sans lecture depuis ce délai, le calendrier ne se met plus à jour dans l'application : Apple relit le flux plusieurs
// fois par jour, Google toutes les 8 à 24 h.
export const STALE_AFTER_MS = { apple: 24 * 60 * 60 * 1000, google: 48 * 60 * 60 * 1000 };

// État de chaque application qui a lu le flux, pour la page de l'élève (GET /api/subscription), Apple d'abord :
// `started` (Apple, ajout pas encore confirmé), `connected`, ou `stale` (plus aucune lecture depuis STALE_AFTER_MS).
export function calendarStatuses(reads, now) {
  return READERS.filter(({ app }) => reads?.[app]).map(({ app }) => {
    const read = reads[app];
    let state = 'connected';
    if (!isAddConfirmed(app, read)) state = 'started';
    else if (now - Date.parse(read.lastReadAt) > STALE_AFTER_MS[app]) state = 'stale';
    return { app, state, lastReadAt: read.lastReadAt };
  });
}

// Les lectures après celle de `app` à `now`, ou null s'il n'y a rien à réécrire. Tant que l'ajout n'est pas confirmé,
// chaque lecture est notée : celle qui le confirme ne doit pas attendre l'heure suivante.
export function withRead(reads, app, now) {
  const date = now.toISOString();
  const previous = reads?.[app];
  if (!previous) return { ...reads, [app]: { firstReadAt: date, lastReadAt: date } };
  if (isAddConfirmed(app, previous) && now - Date.parse(previous.lastReadAt) < READ_WRITE_INTERVAL_MS) return null;
  return { ...reads, [app]: { ...previous, lastReadAt: date } };
}

// Note la lecture du flux d'un abonnement. `reads` : ses lectures déjà en base, lues avec lui (voir findSubscription).
export async function recordFeedRead(redis, tokenHash, reads, userAgent, now) {
  const app = detectReader(userAgent);
  const next = app && withRead(reads, app, now);
  if (next) await redis.setJson(feedReadsKey(tokenHash), next);
}
