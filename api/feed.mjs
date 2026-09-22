// Fonction Vercel : POST /api/feed crée le jeton, GET /api/feed?token=… sert le flux ICS.
// La logique est dans server/ ; ce fichier ne fait que la brancher sur Redis.
import { createRedisClient } from '../shared/redis-client.mjs';
import { respond } from '../server/http.mjs';
import { createFeed, getFeedIcs } from '../server/feed.mjs';

export const POST = (request) => respond(() => createFeed(createRedisClient(), request));
export const GET = (request) => respond(() => getFeedIcs(createRedisClient(), new URL(request.url)));

// Avant de s'abonner à un flux webcal, Calendrier (iOS/macOS) envoie un HEAD pour valider l'URL ;
// sans réponse à cette méthode (405 par défaut), l'abonnement échoue avant même le GET.
export const HEAD = async (request) => {
  const response = await GET(request);
  return new Response(null, { status: response.status, headers: response.headers });
};
