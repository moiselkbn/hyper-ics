// GET /api/feed?token=… (adresse publique : /f/<jeton>, voir vercel.json) : flux ICS de l'abonnement d'un élève.
// Recalculé à chaque lecture à partir du dernier scrap : nouvelles semaines, changements d'horaire ou de salle
// arrivent au prochain rafraîchissement du calendrier de l'élève. Un abonnement supprimé sert un calendrier vide.
// Chaque lecture par une application de calendrier est notée (voir server/feed-reads.mjs).
// La logique est ici ; api/feed.mjs ne fait que la brancher sur Redis.
import { recordFeedRead } from './feed-reads.mjs';
import { icsResponse } from './http.mjs';
import { buildIcs } from './ics.mjs';
import { buildDetailedLessons } from './lessons.mjs';
import { findSubscription, isDeleted, isLessonFollowed, readFollowedSchedules, withCurrentKeys } from './subscription.mjs';

// `userAgent` : celui du client qui lit le flux, pour reconnaître l'application de calendrier.
export async function getFeedIcs(redis, url, { now = new Date(), userAgent = null } = {}) {
  const { tokenHash, subscription, reads } = await findSubscription(redis, url, { includeDeleted: true });
  if (isDeleted(subscription)) return icsResponse(buildIcs([], null, [], now));
  // Une promotion renommée est suivie sous son nouveau libellé (voir withCurrentLabels). Une promotion peut aussi
  // disparaître de Redis entre-temps : on l'ignore plutôt que de faire échouer tout le flux de l'élève.
  // La lecture est notée en même temps ; si l'écriture échoue, l'élève reçoit quand même ses cours.
  const [current] = await Promise.all([
    readFollowedSchedules(redis, subscription.promotions),
    recordFeedRead(redis, tokenHash, reads, userAgent, now).catch((error) => console.error(error.message)),
  ]);
  const records = current.records.filter(Boolean);
  const followed = { promotions: withCurrentKeys(current.promotions, records) };
  const lessons = buildDetailedLessons(records).filter((lesson) => isLessonFollowed(lesson, followed));
  // D'après `records`, pas les libellés de l'abonnement : une promotion disparue ne doit pas déclencher la précision de promotion
  // sur les cours de celle qui reste. Sans promotion connue, `lessons` est vide : buildIcs ne lit pas firstMonday.
  const promotions = records.map((record) => record.promotion);
  return icsResponse(buildIcs(lessons, records[0]?.firstMonday ?? null, promotions, now));
}
