// Usage :
//   node --env-file=.env scraper/scrap-to-redis.mjs        écrit dans Upstash
//   node scraper/scrap-to-redis.mjs --dry-run              simule avec une base en mémoire, sans Redis
// Ne scrape que les promotions du périmètre Waterside. Code de sortie 1 si une écriture échoue.
import { createRedisClient } from '../shared/redis-client.mjs';
import { isInWatersideScope } from './campus-scope.mjs';
import { fetchRawSchedule, listPromotions, openSession } from './hyperplanning-client.mjs';
import { parseDate } from './parse-schedule.mjs';
import { syncSchedules } from './sync-schedules.mjs';

const dryRun = process.argv.includes('--dry-run');
const log = (message) => console.error(message);

// Base en mémoire pour le mode simulation : mêmes méthodes que le vrai client.
const memory = new Map();
const memoryRedis = {
  getJson: async (key) => (memory.has(key) ? JSON.parse(memory.get(key)) : null),
  setJson: async (key, value) => void memory.set(key, JSON.stringify(value)),
};
const redis = dryRun ? memoryRedis : createRedisClient();

const { session, generalParams } = await openSession();
const all = await listPromotions(session);
const promotions = all.filter(({ label }) => isInWatersideScope(label));
log(`${promotions.length} promotions Waterside sur ${all.length} (les autres sont ignorées).`);
if (promotions.length === 0) {
  log('Aucune promotion Waterside trouvée : arrêt, rien n’est écrit.');
  process.exit(1);
}

const { written, failed } = await syncSchedules({
  promotions,
  fetchRaw: (promotion) => fetchRawSchedule(session, promotion),
  redis,
  firstMonday: parseDate(generalParams.PremierLundi.V),
  log,
});
log(`${written.length} écrites, ${failed.length} en échec.`);

if (dryRun) {
  for (const [key, value] of memory) log(`  ${key} (${value.length} octets)`);
}
if (failed.length > 0) process.exit(1);
