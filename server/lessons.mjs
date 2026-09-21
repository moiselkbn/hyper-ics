// GET /api/lessons?promotions=3TI Web,2TE : cours des promotions demandées, lus dans `schedule:<promotion>`.
import { scheduleKey } from '../shared/redis-keys.mjs';
import { HttpError, jsonResponse } from './http.mjs';
import { promotionCollator } from './promotions.mjs';

// Décret paysage : un élève ne chevauche que deux années, donc deux promotions au plus.
export const MAX_PROMOTIONS = 2;
const MAX_LABEL_LENGTH = 40;

// « 3TI Web, 2TE » -> ['3TI Web', '2TE']
export function parsePromotions(searchParams) {
  const labels = (searchParams.get('promotions') ?? '')
    .split(',')
    .map((label) => label.trim())
    .filter(Boolean);
  const unique = [...new Set(labels)];
  if (unique.length === 0) throw new HttpError(400, 'Paramètre promotions manquant');
  if (unique.length > MAX_PROMOTIONS) throw new HttpError(400, `${MAX_PROMOTIONS} promotions au maximum`);
  if (unique.some((label) => label.length > MAX_LABEL_LENGTH)) throw new HttpError(400, 'Nom de promotion invalide');
  return unique;
}

// Dans une promotion, un cours = sa matière (la clé de cours, voir shared/course-key.mjs), quel que soit
// le nombre d'occurrences par semaine. On garde le premier code rencontré, sans espaces autour.
function coursesOfPromotion(record) {
  const courses = new Map();
  for (const slot of record.courses) {
    if (!slot.key) continue; // sans matière : impossible à identifier, donc à filtrer
    let course = courses.get(slot.key);
    if (!course) {
      course = { key: slot.key, subject: slot.subject.trim(), code: null, teachers: [] };
      courses.set(slot.key, course);
    }
    course.code ??= slot.code?.trim() || null;
    for (const teacher of slot.teachers) {
      if (!course.teachers.includes(teacher)) course.teachers.push(teacher);
    }
  }
  return [...courses.values()];
}

// Un cours est commun à plusieurs promotions s'il a le même code ET la même matière : jamais de fausse
// fusion (un code peut couvrir deux matières), quitte à laisser en double « Anglais Q1 » / « Anglais 1 ».
// Sans code, le cours reste propre à sa promotion. Relation plusieurs-à-plusieurs : `promotions` liste
// celles où il apparaît ; les créneaux, eux, restent par promotion dans Redis.
export function buildLessons(records) {
  const lessons = new Map();
  for (const record of records) {
    for (const course of coursesOfPromotion(record)) {
      const id = course.code ? `code:${course.code}|${course.key}` : `promotion:${record.promotion}|${course.key}`;
      let lesson = lessons.get(id);
      if (!lesson) {
        lesson = { id, subject: course.subject, code: course.code, teachers: [], promotions: [] };
        lessons.set(id, lesson);
      }
      lesson.promotions.push(record.promotion);
      for (const teacher of course.teachers) {
        if (!lesson.teachers.includes(teacher)) lesson.teachers.push(teacher);
      }
    }
  }
  return {
    // La plus ancienne des dates de scrap : c'est la fraîcheur garantie de la réponse.
    updatedAt: records.map((record) => record.scrapedAt).sort()[0] ?? null,
    lessons: [...lessons.values()].sort(
      (a, b) => promotionCollator.compare(a.subject, b.subject) || promotionCollator.compare(a.id, b.id),
    ),
  };
}

export async function getLessons(redis, url) {
  const labels = parsePromotions(url.searchParams);
  // Une clé absente = promotion inconnue (l'index ne liste que des promotions qui ont un planning).
  const records = await redis.mgetJson(labels.map(scheduleKey));
  if (records.includes(null)) throw new HttpError(404, 'Promotion inconnue');
  return jsonResponse(buildLessons(records));
}
