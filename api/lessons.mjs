// Fonction Vercel : GET /api/lessons?promotions=… La logique est dans server/ ; ce fichier ne fait que la brancher sur Redis.
import { createRedisClient } from '../shared/redis-client.mjs';
import { respond } from '../server/http.mjs';
import { getLessons } from '../server/lessons.mjs';

export const GET = (request) => respond(() => getLessons(createRedisClient(), new URL(request.url)));
