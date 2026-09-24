// Fonction Vercel : GET /api/feed?token=… (adresse publique : /f/<jeton>, voir vercel.json) sert le flux ICS
// d'un abonnement. La logique est dans server/ ; ce fichier ne fait que la brancher sur Redis.
import { createRedisClient } from '../shared/redis-client.mjs';
import { respond } from '../server/http.mjs';
import { getFeedIcs } from '../server/feed.mjs';

// Une ligne de log par interrogation : qui lit le flux (iPhone, Mac, serveurs d'iCloud, de Google…) et avec quel
// résultat. Jamais le jeton ni l'URL : seul l'user-agent identifie le client.
async function serveFeed(request) {
  const response = await respond(() => getFeedIcs(createRedisClient(), new URL(request.url)));
  console.log(
    JSON.stringify({ route: 'feed', method: request.method, status: response.status, userAgent: request.headers.get('user-agent') }),
  );
  return response;
}

export const GET = serveFeed;

// Avant de s'abonner, Calendrier (iOS/macOS) peut envoyer un HEAD pour valider l'URL ; sans réponse à cette
// méthode (405 par défaut), l'abonnement échoue avant même le GET.
export async function HEAD(request) {
  const response = await serveFeed(request);
  return new Response(null, { status: response.status, headers: response.headers });
}
