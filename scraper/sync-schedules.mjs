// Écrit dans Redis le planning de chaque promotion, puis la liste des promotions.
import { courseKey } from '../shared/course-key.mjs';
import { SCHEDULE_INDEX_KEY, scheduleKey } from '../shared/redis-keys.mjs';
import { getCurriculum } from './campus-scope.mjs';
import { parseCourses } from './parse-schedule.mjs';
import { resolveAmbiguousRooms } from './resolve-rooms.mjs';
import { trackRenames } from './track-renames.mjs';

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

// Planning précédent de chaque promotion : on en reprend la résolution des salles et les renommages de matière,
// et il sert de référence pour un planning qui revient vide. `null` si la lecture échoue : les salles seront toutes
// résolues à nouveau, dans la limite du budget, un planning vide ne pourra pas être vérifié, et les renommages
// déjà connus sont perdus (les abonnements qui gardaient une ancienne clé ne la reconnaissent plus).
async function readPreviousRecords(redis, promotions, log) {
  try {
    const records = await redis.mgetJson(promotions.map((promotion) => scheduleKey(promotion.label)));
    return new Map(
      records.filter(Boolean).map((record) => [
        record.promotion,
        {
          ...record,
          // Planning écrit avant la datation des résolutions : il n'était écrit qu'une fois ses salles résolues,
          // sa date de scrap est donc celle de la résolution.
          courses: record.courses.map((course) =>
            course.roomsByWeek && !course.roomsResolvedAt ? { ...course, roomsResolvedAt: record.scrapedAt } : course,
          ),
        },
      ]),
    );
  } catch (error) {
    log(`Plannings précédents illisibles (${error.message}) : les salles seront toutes résolues à nouveau.`);
    return null;
  }
}

// Nombre de passages consécutifs qui doivent renvoyer un planning vide avant qu'il remplace un planning
// qui avait des cours. Hyperplanning peut renvoyer une liste vide par erreur : l'écrire aussitôt viderait
// les calendriers de toute la promotion. Les passages sont espacés d'au moins 50 min (voir scrap-window.mjs),
// le vide n'est donc écrit qu'après environ 2 h ; un seul passage avec des cours remet le compte à zéro.
export const EMPTY_SCHEDULE_CONFIRMATIONS = 3;

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
  const held = []; // promotions revenues vides, dont on garde l'ancien planning en attendant confirmation
  const failed = [];
  const hasCourses = new Map(); // promotion écrite -> son planning contient au moins un créneau
  const previousRecords = await readPreviousRecords(redis, promotions, log);
  const deadline = clock() + roomBudgetMs;

  for (const promotion of promotions) {
    try {
      const raw = await fetchRaw(promotion);
      const record = buildScheduleRecord({ promotion, raw, firstMonday, now });
      const previous = previousRecords?.get(promotion.label);
      if (record.courses.length === 0) {
        if (!previousRecords) throw new Error('planning vide, invérifiable sans le planning précédent');
        if (previous?.courses.length > 0) {
          const emptyScrapes = (previous.emptyScrapes ?? 0) + 1;
          if (emptyScrapes < EMPTY_SCHEDULE_CONFIRMATIONS) {
            await redis.setJson(scheduleKey(promotion.label), { ...previous, emptyScrapes });
            held.push(promotion.label);
            log(`${promotion.label} : planning vide (${emptyScrapes}/${EMPTY_SCHEDULE_CONFIRMATIONS}), ancien planning gardé`);
            continue;
          }
        }
      }
      const renamedKeys = trackRenames(previous, record.courses);
      if (Object.keys(renamedKeys).length > 0) record.renamedKeys = renamedKeys;
      let rooms = '';
      if (fetchRawWeeks) {
        const result = await resolveAmbiguousRooms((weeksRange) => fetchRawWeeks(promotion, weeksRange), record.courses, {
          previous: previous?.courses ?? [],
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

  // Sans aucune écriture réussie, on garde l'ancienne liste. Un planning vide gardé compte comme un passage
  // réussi : la liste est réécrite pour dater ce passage, sinon le suivant aurait lieu 15 min plus tard et
  // un planning vide renvoyé à toutes les promotions serait confirmé en 30 min.
  if (written.length + held.length > 0) {
    try {
      await writeIndex({ promotions, written, held, failed, hasCourses, redis, now });
    } catch (error) {
      failed.push({ label: SCHEDULE_INDEX_KEY, message: error.message });
      log(`${SCHEDULE_INDEX_KEY} : ÉCHEC (${error.message})`);
    }
  }
  return { written, held, failed };
}

// La liste ne mentionne que des promotions qui ont un planning en base : celles écrites
// maintenant, et celles déjà listées dont l'écriture vient d'échouer ou dont le planning vide attend confirmation
// (leur ancien planning existe).
// `hasCourses` permet à l'app d'indiquer « Aucun cours publié » sans lire les plannings ; une promotion
// dont l'écriture échoue garde la valeur précédente, et le champ reste absent tant qu'on ne la connaît pas.
// `updatedAt` n'avance que si au moins la moitié des promotions a réussi : un passage surtout en échec ne rend
// pas le scrap « frais » (voir scrap-window.mjs), et le déclenchement suivant, 15 min plus tard, le refait.
async function writeIndex({ promotions, written, held, failed, hasCourses, redis, now }) {
  const index = await redis.getJson(SCHEDULE_INDEX_KEY);
  const previous = index?.promotions ?? [];
  const mostlyFailed = failed.length > written.length + held.length;
  const updatedAt = mostlyFailed && index?.updatedAt ? index.updatedAt : now.toISOString();
  const listed = promotions
    .filter(({ label }) => written.includes(label) || previous.some((entry) => entry.label === label))
    .map(({ label }) => ({
      label,
      curriculum: getCurriculum(label)?.id ?? null,
      hasCourses: hasCourses.get(label) ?? previous.find((entry) => entry.label === label)?.hasCourses,
    }));
  await redis.setJson(SCHEDULE_INDEX_KEY, { updatedAt, promotions: listed });
}
