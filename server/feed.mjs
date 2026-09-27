// GET /api/feed?token=… (adresse publique : /f/<jeton>, voir vercel.json) : flux ICS de l'abonnement d'un élève.
// Recalculé à chaque lecture à partir du dernier scrap : nouvelles semaines, changements d'horaire ou de salle
// arrivent au prochain rafraîchissement du calendrier de l'élève. Un abonnement supprimé sert un calendrier vide.
// La logique est ici ; api/feed.mjs ne fait que la brancher sur Redis.
import { icsResponse } from './http.mjs';
import { buildIcs } from './ics.mjs';
import { buildDetailedLessons } from './lessons.mjs';
import { findSubscription, isDeleted, isLessonFollowed, readFollowedSchedules, withCurrentKeys } from './subscription.mjs';

export async function getFeedIcs(redis, url, now = new Date()) {
  const { subscription } = await findSubscription(redis, url, { includeDeleted: true });
  if (isDeleted(subscription)) return icsResponse(buildIcs([], null, [], now));
  // Une promotion renommée est suivie sous son nouveau libellé (voir withCurrentLabels). Une promotion peut aussi
  // disparaître de Redis entre-temps : on l'ignore plutôt que de faire échouer tout le flux de l'élève.
  const current = await readFollowedSchedules(redis, subscription.promotions);
  const records = current.records.filter(Boolean);
  const followed = { promotions: withCurrentKeys(current.promotions, records) };
  const lessons = buildDetailedLessons(records).filter((lesson) => isLessonFollowed(lesson, followed));
  // D'après `records`, pas les libellés de l'abonnement : une promotion disparue ne doit pas déclencher la précision de promotion
  // sur les cours de celle qui reste. Sans promotion connue, `lessons` est vide : buildIcs ne lit pas firstMonday.
  const promotions = records.map((record) => record.promotion);
  return icsResponse(buildIcs(lessons, records[0]?.firstMonday ?? null, promotions, now));
}
