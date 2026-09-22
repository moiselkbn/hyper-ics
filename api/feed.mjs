// Fonction Vercel : POST /api/feed crée le jeton, GET /api/feed?token=… sert le flux ICS.
// La logique est dans server/ ; ce fichier ne fait que la brancher sur Redis.
import { createRedisClient } from '../shared/redis-client.mjs';
import { respond } from '../server/http.mjs';
import { createFeed, getFeedIcs } from '../server/feed.mjs';

export const POST = (request) => respond(() => createFeed(createRedisClient(), request));
export const GET = (request) => respond(() => getFeedIcs(createRedisClient(), new URL(request.url)));
