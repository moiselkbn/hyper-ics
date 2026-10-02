// Statistiques des abonnements, en lecture seule (SCAN et MGET, aucune écriture).
// Lancer : node --env-file=.env scripts/stats.mjs
// Attention : .env pointe sur l'Upstash de production. Aucun hash ni jeton n'est affiché, seulement des totaux.
import { createRedisClient } from '../shared/redis-client.mjs';
import { calendarStatuses } from '../server/feed-reads.mjs';
import { feedReadsKey } from '../shared/redis-keys.mjs';

const BATCH_SIZE = 200;
const HOUR_MS = 60 * 60 * 1000;

// Le client partagé n'a pas SCAN : on passe par la même API REST, avec les mêmes variables d'environnement.
async function command(...args) {
  const response = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const body = await response.json();
  if (!response.ok || body.error) throw new Error(`Redis ${args[0]} : ${body.error ?? `HTTP ${response.status}`}`);
  return body.result;
}

async function scanKeys(pattern) {
  const keys = [];
  let cursor = '0';
  do {
    const [next, found] = await command('SCAN', cursor, 'MATCH', pattern, 'COUNT', 500);
    keys.push(...found);
    cursor = next;
  } while (cursor !== '0');
  return keys;
}

const redis = createRedisClient();
const now = Date.now();

const subscriptionKeys = await scanKeys('subscription:*');
const subscriptions = [];
for (let i = 0; i < subscriptionKeys.length; i += BATCH_SIZE) {
  subscriptions.push(...(await redis.mgetJson(subscriptionKeys.slice(i, i + BATCH_SIZE))));
}
const alive = subscriptionKeys.filter((_, i) => subscriptions[i] && !('deletedAt' in subscriptions[i]));
const deleted = subscriptions.filter((subscription) => subscription && 'deletedAt' in subscription).length;

// Lectures du flux de chaque abonnement vivant (même hash que l'abonnement).
const readsList = [];
const readKeys = alive.map((key) => feedReadsKey(key.slice('subscription:'.length)));
for (let i = 0; i < readKeys.length; i += BATCH_SIZE) {
  readsList.push(...(await redis.mgetJson(readKeys.slice(i, i + BATCH_SIZE))));
}

const counts = { never: 0, started: 0, connected: 0, stale: 0 };
const byApp = { apple: { connected: 0, stale: 0, started: 0 }, google: { connected: 0, stale: 0, started: 0 } };
let readLast24h = 0;
for (const reads of readsList) {
  const statuses = calendarStatuses(reads, now);
  if (statuses.length === 0) {
    counts.never += 1;
    continue;
  }
  for (const { app, state } of statuses) byApp[app][state] += 1;
  // Un abonnement est « connecté » si une application l'est ; « périmé » si toutes les connectées ont décroché.
  if (statuses.some(({ state }) => state === 'connected')) counts.connected += 1;
  else if (statuses.some(({ state }) => state === 'stale')) counts.stale += 1;
  else counts.started += 1;
  if (statuses.some(({ lastReadAt }) => now - Date.parse(lastReadAt) <= 24 * HOUR_MS)) readLast24h += 1;
}

console.log(`Abonnements créés (actifs) : ${alive.length}`);
console.log(`Abonnements supprimés (conservés 7 jours) : ${deleted}`);
console.log('');
console.log(`Jamais lu le flux : ${counts.never}`);
console.log(`Ajout commencé (Apple, pas confirmé) : ${counts.started}`);
console.log(`Connectés : ${counts.connected}`);
console.log(`Périmés (plus de lecture récente) : ${counts.stale}`);
console.log(`Flux lu dans les dernières 24 h : ${readLast24h}`);
console.log('');
for (const [app, states] of Object.entries(byApp)) {
  console.log(`${app} : ${states.connected} connectés, ${states.started} commencés, ${states.stale} périmés`);
}
