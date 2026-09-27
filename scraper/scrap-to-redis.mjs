// Usage :
//   node --env-file=.env scraper/scrap-to-redis.mjs        écrit dans Upstash
//   node scraper/scrap-to-redis.mjs --dry-run              simule avec une base en mémoire, sans Redis
//   --only-in-hours                                        ne fait rien hors de 7h–17h (Europe/Brussels) ; utilisé par le cron
//   --skip-if-fresh                                        ne fait rien si le dernier scrap a moins de 50 min ; utilisé par le cron
// Ne scrape que les promotions du périmètre Waterside. Code de sortie 1 si une écriture échoue.
// Avec RESEND_API_KEY et BUG_REPORT_EMAIL, prévient par mail quand la liste des promotions change (voir
// watch-promotions.mjs) ; sans elles, le changement n'apparaît que dans les logs.
import { createRedisClient } from '../shared/redis-client.mjs';
import { SCHEDULE_INDEX_KEY } from '../shared/redis-keys.mjs';
import { createResendClient } from '../shared/resend-client.mjs';
import { isInWatersideScope } from './campus-scope.mjs';
import { fetchRawSchedule, listPromotions, openSession } from './hyperplanning-client.mjs';
import { parseDate } from './parse-schedule.mjs';
import { isFresh, isWithinScrapHours } from './scrap-window.mjs';
import { syncSchedules } from './sync-schedules.mjs';
import { watchPromotions } from './watch-promotions.mjs';

const dryRun = process.argv.includes('--dry-run');
const onlyInHours = process.argv.includes('--only-in-hours');
const skipIfFresh = process.argv.includes('--skip-if-fresh');
const log = (message) => console.error(message);

// Le cron GitHub tourne en UTC : on écarte ici les heures locales hors plage (heure d'été comprise).
if (onlyInHours && !isWithinScrapHours(new Date())) {
  log('Hors de la plage de scrap (7h–17h, Europe/Brussels) : rien à faire.');
  process.exit(0);
}

// Base en mémoire pour le mode simulation : mêmes méthodes que le vrai client.
const memory = new Map();
const memoryRedis = {
  getJson: async (key) => (memory.has(key) ? JSON.parse(memory.get(key)) : null),
  setJson: async (key, value) => void memory.set(key, JSON.stringify(value)),
  mgetJson: async (keys) => keys.map((key) => (memory.has(key) ? JSON.parse(memory.get(key)) : null)),
};
const redis = dryRun ? memoryRedis : createRedisClient();

// Le cron se déclenche toutes les 15 minutes parce que GitHub saute des exécutions : un scrap récent évite d'en refaire un.
if (skipIfFresh) {
  const index = await redis.getJson(SCHEDULE_INDEX_KEY);
  if (isFresh(index?.updatedAt, new Date())) {
    log(`Dernier scrap réussi le ${index.updatedAt} : encore récent, rien à faire.`);
    process.exit(0);
  }
}

const { session, generalParams } = await openSession();
const all = await listPromotions(session);
const promotions = all.filter(({ label }) => isInWatersideScope(label));
log(`${promotions.length} promotions Waterside sur ${all.length} (les autres sont ignorées).`);
if (promotions.length === 0) {
  log('Aucune promotion Waterside trouvée : arrêt, rien n’est écrit.');
  process.exit(1);
}

const { written, held, failed } = await syncSchedules({
  promotions,
  fetchRaw: (promotion) => fetchRawSchedule(session, promotion),
  fetchRawWeeks: (promotion, weeksRange) => fetchRawSchedule(session, promotion, weeksRange),
  redis,
  firstMonday: parseDate(generalParams.PremierLundi.V),
  log,
});
log(`${written.length} écrites, ${held.length} vides en attente de confirmation, ${failed.length} en échec.`);

// Pas de mail en simulation : la base en mémoire est vide, il n'y a rien à comparer.
const mailer = !dryRun && process.env.RESEND_API_KEY && process.env.BUG_REPORT_EMAIL ? createResendClient() : null;
const changes = await watchPromotions({ labels: all.map(({ label }) => label), redis, notify: mailer?.send, log });
// Annotation visible sur la page du run GitHub Actions, avec ou sans mail.
if (changes && process.env.GITHUB_ACTIONS) console.log('::warning::Promotions modifiées dans Hyperplanning, voir les logs.');

if (dryRun) {
  for (const [key, value] of memory) log(`  ${key} (${value.length} octets)`);
}
if (failed.length > 0) process.exit(1);
