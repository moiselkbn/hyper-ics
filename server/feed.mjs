// GET /api/feed?token=… (adresse publique : /f/<jeton>, voir vercel.json) : flux ICS de l'abonnement d'un élève.
// Recalculé à chaque lecture à partir du dernier scrap : nouvelles semaines, changements d'horaire ou de salle
// arrivent au prochain rafraîchissement du calendrier de l'élève.
// La logique est ici ; api/feed.mjs ne fait que la brancher sur Redis.
import { scheduleKey } from '../shared/redis-keys.mjs';
import { icsResponse } from './http.mjs';
import { buildIcs } from './ics.mjs';
import { buildDetailedLessons } from './lessons.mjs';
import { findSubscription, isLessonFollowed } from './subscription.mjs';

export async function getFeedIcs(redis, url, now = new Date()) {
  const { subscription } = await findSubscription(redis, url);
  const labels = subscription.promotions.map((entry) => entry.label);
  // Une promotion peut disparaître de Redis entre-temps (sortie du périmètre, renommée) : on l'ignore plutôt que
  // de faire échouer tout le flux de l'élève.
  const records = (await redis.mgetJson(labels.map(scheduleKey))).filter(Boolean);
  const lessons = buildDetailedLessons(records).filter((lesson) => isLessonFollowed(lesson, subscription));
  // D'après `records`, pas `labels` : une promotion disparue ne doit pas déclencher la précision de promotion
  // sur les cours de celle qui reste. Sans promotion connue, `lessons` est vide : buildIcs ne lit pas firstMonday.
  const promotions = records.map((record) => record.promotion);
  return icsResponse(buildIcs(lessons, records[0]?.firstMonday ?? null, promotions, now));
}
