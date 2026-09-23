// Fonction Vercel : POST, GET et PUT /api/subscription. La logique est dans server/ ; ce fichier ne fait que la brancher sur Redis.
import { createRedisClient } from '../shared/redis-client.mjs';
import { respond } from '../server/http.mjs';
import { createSubscription, getSubscription, updateSubscription } from '../server/subscription.mjs';

export const POST = (request) => respond(() => createSubscription(createRedisClient(), request));
export const GET = (request) => respond(() => getSubscription(createRedisClient(), new URL(request.url)));
export const PUT = (request) => respond(() => updateSubscription(createRedisClient(), request));
