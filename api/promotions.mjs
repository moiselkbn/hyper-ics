// Fonction Vercel : GET /api/promotions. La logique est dans server/ ; ce fichier ne fait que la brancher sur Redis.
import { createRedisClient } from '../shared/redis-client.mjs';
import { respond } from '../server/http.mjs';
import { getPromotions } from '../server/promotions.mjs';

export const GET = () => respond(() => getPromotions(createRedisClient()));
