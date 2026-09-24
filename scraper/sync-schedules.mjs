// Écrit dans Redis le planning de chaque promotion, puis la liste des promotions.
import { courseKey } from '../shared/course-key.mjs';
import { SCHEDULE_INDEX_KEY, scheduleKey } from '../shared/redis-keys.mjs';
import { getCurriculum } from './campus-scope.mjs';
import { parseCourses } from './parse-schedule.mjs';
import { resolveAmbiguousRooms } from './resolve-rooms.mjs';

// Contenu de `schedule:<promotion>`. Chaque créneau porte la clé de son cours ;
// les créneaux d'un même cours (plusieurs occurrences par semaine) se regroupent à la lecture.
export function buildScheduleRecord({ promotion, raw, firstMonday, now }) {
  // Une réponse sans ListeCours est un échec du protocole (planning vide renvoyé à tort) :
  // une liste vide, elle, est légitime (promotion sans cours publiés).
  if (!Array.isArray(raw?.ListeCours)) throw new Error('réponse sans liste de cours');
  return {
    promotion: promotion.label,
    curriculum: getCurriculum(promotion.label)?.id ?? null,
    firstMonday, // la semaine 1 commence ce lundi (AAAA-MM-JJ)
    scrapedAt: now.toISOString(),
    courses: parseCourses(raw.ListeCours).map((course) => ({
      ...course,
      key: course.subject ? courseKey(course.subject) : null,
    })),
  };
}

// Temps accordé, par passage, aux requêtes qui affinent la salle par semaine (voir resolve-rooms.mjs).
// Le job GitHub est coupé à 10 minutes (.github/workflows/scrap.yml) et le planning de base des 34 promotions
// en prend environ 2 : au-delà de ce budget, les créneaux restants gardent leur résolution précédente et
// seront affinés à un prochain passage. Chaque passage écrit ainsi toutes les promotions, puis la liste.
export const ROOM_RESOLUTION_BUDGET_MS = 5 * 60 * 1000;

const describeRooms = ({ reused, resolved, deferred }) =>
  reused + resolved + deferred === 0 ? '' : ` (salles : ${reused} reprises, ${resolved} affinées, ${deferred} reportées)`;

// Créneaux du planning précédent de chaque promotion, dont on reprend la résolution des salles. Un échec de
// lecture n'empêche pas le scrap : tout sera simplement résolu à nouveau, dans la limite du budget.
async function readPreviousCourses(redis, promotions, log) {
  try {
    const records = await redis.mgetJson(promotions.map((promotion) => scheduleKey(promotion.label)));
    return new Map(
      records.filter(Boolean).map((record) => [
        record.promotion,
        // Planning écrit avant la datation des résolutions : il n'était écrit qu'une fois ses salles résolues,
        // sa date de scrap est donc celle de la résolution.
        record.courses.map((course) =>
          course.roomsByWeek && !course.roomsResolvedAt ? { ...course, roomsResolvedAt: record.scrapedAt } : course,
        ),
      ]),
    );
  } catch (error) {
    log(`Plannings précédents illisibles (${error.message}) : les salles seront toutes résolues à nouveau.`);
    return new Map();
  }
}

// Une promotion en échec garde son ancien planning : on ne l'écrase jamais avec un résultat douteux.
// `fetchRawWeeks(promotion, weeksRangeText)` : même requête que `fetchRaw`, sur une plage de semaines
// réduite ; sert à affiner les créneaux dont la salle change en cours d'année (voir resolve-rooms.mjs).
// Optionnel : sans lui, les créneaux ambigus gardent leurs salles telles quelles, sans requête de plus.
export async function syncSchedules({
  promotions,
  fetchRaw,
  fetchRawWeeks,
  redis,
  firstMonday,
  now = new Date(),
  clock = Date.now,
  roomBudgetMs = ROOM_RESOLUTION_BUDGET_MS,
  log = () => {},
}) {
  const written = [];
  const failed = [];
  const hasCourses = new Map(); // promotion écrite -> son planning contient au moins un créneau
  const previousCourses = fetchRawWeeks ? await readPreviousCourses(redis, promotions, log) : new Map();
  const deadline = clock() + roomBudgetMs;

  for (const promotion of promotions) {
    try {
      const raw = await fetchRaw(promotion);
      const record = buildScheduleRecord({ promotion, raw, firstMonday, now });
      let rooms = '';
      if (fetchRawWeeks) {
        const result = await resolveAmbiguousRooms((weeksRange) => fetchRawWeeks(promotion, weeksRange), record.courses, {
          previous: previousCourses.get(promotion.label) ?? [],
          now,
          deadline,
          clock,
        });
        record.courses = result.courses;
        rooms = describeRooms(result);
      }
      await redis.setJson(scheduleKey(promotion.label), record);
      written.push(promotion.label);
      hasCourses.set(promotion.label, record.courses.length > 0);
      log(`${promotion.label} : ${record.courses.length} créneaux écrits${rooms}`);
    } catch (error) {
      failed.push({ label: promotion.label, message: error.message });
      log(`${promotion.label} : ÉCHEC (${error.message})`);
    }
  }

  // Sans aucune écriture réussie, on garde l'ancienne liste.
  if (written.length > 0) {
    try {
      await writeIndex({ promotions, written, hasCourses, redis, now });
    } catch (error) {
      failed.push({ label: SCHEDULE_INDEX_KEY, message: error.message });
      log(`${SCHEDULE_INDEX_KEY} : ÉCHEC (${error.message})`);
    }
  }
  return { written, failed };
}

// La liste ne mentionne que des promotions qui ont un planning en base : celles écrites
// maintenant, et celles déjà listées dont l'écriture vient d'échouer (leur ancien planning existe).
// `hasCourses` permet à l'app d'indiquer « Aucun cours publié » sans lire les plannings ; une promotion
// dont l'écriture échoue garde la valeur précédente, et le champ reste absent tant qu'on ne la connaît pas.
async function writeIndex({ promotions, written, hasCourses, redis, now }) {
  const previous = (await redis.getJson(SCHEDULE_INDEX_KEY))?.promotions ?? [];
  const listed = promotions
    .filter(({ label }) => written.includes(label) || previous.some((entry) => entry.label === label))
    .map(({ label }) => ({
      label,
      curriculum: getCurriculum(label)?.id ?? null,
      hasCourses: hasCourses.get(label) ?? previous.find((entry) => entry.label === label)?.hasCourses,
    }));
  await redis.setJson(SCHEDULE_INDEX_KEY, { updatedAt: now.toISOString(), promotions: listed });
}
