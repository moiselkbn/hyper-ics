// Usage : node scraper/scrap-promotion.mjs "3TI Web"
// Affiche sur stdout le planning de la promotion en JSON ; les messages vont sur stderr.
import { isInWatersideScope } from './campus-scope.mjs';
import { fetchRawSchedule, listPromotions, openSession } from './hyperplanning-client.mjs';
import { parseCourses, parseDate, parseWeeks } from './parse-schedule.mjs';
import { resolveAmbiguousRooms } from './resolve-rooms.mjs';

const label = process.argv[2];
if (!label) {
  console.error('Usage : node scraper/scrap-promotion.mjs "<promotion>"');
  process.exit(1);
}

if (!isInWatersideScope(label)) {
  console.error(`Promotion « ${label} » hors du périmètre Waterside : non scrapée.`);
  process.exit(1);
}

const { session, generalParams } = await openSession();
const promotions = await listPromotions(session);
const promotion = promotions.find((item) => item.label === label);
if (!promotion) {
  console.error(`Promotion « ${label} » introuvable (${promotions.length} promotions disponibles).`);
  process.exit(1);
}

const raw = await fetchRawSchedule(session, promotion);
const courses = await resolveAmbiguousRooms(
  (weeksRange) => fetchRawSchedule(session, promotion, weeksRange),
  parseCourses(raw.ListeCours),
);
const result = {
  promotion: promotion.label,
  // La semaine 1 commence ce lundi ; les semaines fériées n'ont pas de cours.
  firstMonday: parseDate(generalParams.PremierLundi.V),
  holidayWeeks: parseWeeks(generalParams.SemainesFeriees.V),
  courses,
};
console.error(`${result.courses.length} créneaux hebdomadaires pour ${promotion.label}.`);
console.log(JSON.stringify(result, null, 2));
