// Écrit dans Redis le planning de chaque promotion, puis la liste des promotions.
import { courseKey } from '../shared/course-key.mjs';
import { SCHEDULE_INDEX_KEY, scheduleKey } from '../shared/redis-keys.mjs';
import { getCurriculum } from './campus-scope.mjs';
import { parseCourses } from './parse-schedule.mjs';

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

// Une promotion en échec garde son ancien planning : on ne l'écrase jamais avec un résultat douteux.
export async function syncSchedules({ promotions, fetchRaw, redis, firstMonday, now = new Date(), log = () => {} }) {
  const written = [];
  const failed = [];

  for (const promotion of promotions) {
    try {
      const raw = await fetchRaw(promotion);
      const record = buildScheduleRecord({ promotion, raw, firstMonday, now });
      await redis.setJson(scheduleKey(promotion.label), record);
      written.push(promotion.label);
      log(`${promotion.label} : ${record.courses.length} créneaux écrits`);
    } catch (error) {
      failed.push({ label: promotion.label, message: error.message });
      log(`${promotion.label} : ÉCHEC (${error.message})`);
    }
  }

  // Sans aucune écriture réussie, on garde l'ancienne liste.
  if (written.length > 0) {
    try {
      await writeIndex({ promotions, written, redis, now });
    } catch (error) {
      failed.push({ label: SCHEDULE_INDEX_KEY, message: error.message });
      log(`${SCHEDULE_INDEX_KEY} : ÉCHEC (${error.message})`);
    }
  }
  return { written, failed };
}

// La liste ne mentionne que des promotions qui ont un planning en base : celles écrites
// maintenant, et celles déjà listées dont l'écriture vient d'échouer (leur ancien planning existe).
async function writeIndex({ promotions, written, redis, now }) {
  const previous = (await redis.getJson(SCHEDULE_INDEX_KEY))?.promotions ?? [];
  const listed = promotions
    .filter(({ label }) => written.includes(label) || previous.some((entry) => entry.label === label))
    .map(({ label }) => ({ label, curriculum: getCurriculum(label)?.id ?? null }));
  await redis.setJson(SCHEDULE_INDEX_KEY, { updatedAt: now.toISOString(), promotions: listed });
}
