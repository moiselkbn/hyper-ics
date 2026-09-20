// Usage : node scraper/scrap-campus.mjs > planning.json
// Scrape uniquement les promotions du périmètre Waterside ; les autres ne sont jamais interrogées.
// La sortie contient des données de cours : ne pas la commiter (dossier data/ ignoré par git).
import { isInWatersideScope } from './campus-scope.mjs';
import { fetchRawSchedule, listPromotions, openSession } from './hyperplanning-client.mjs';
import { parseCourses, parseDate, parseWeeks } from './parse-schedule.mjs';

const { session, generalParams } = await openSession();
const all = await listPromotions(session);
const promotions = all.filter((promotion) => isInWatersideScope(promotion.label));
console.error(`${promotions.length} promotions Waterside sur ${all.length} (les autres sont ignorées).`);

const result = {
  firstMonday: parseDate(generalParams.PremierLundi.V),
  holidayWeeks: parseWeeks(generalParams.SemainesFeriees.V),
  promotions: {},
};
for (const promotion of promotions) {
  const raw = await fetchRawSchedule(session, promotion);
  result.promotions[promotion.label] = parseCourses(raw.ListeCours ?? []);
  console.error(`${promotion.label} : ${result.promotions[promotion.label].length} créneaux`);
}
console.log(JSON.stringify(result, null, 2));
