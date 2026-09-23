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
  return validatePromotionLabels(labels);
}

// Mêmes règles que parsePromotions, mais pour un tableau déjà découpé (ex. le corps JSON de POST /api/subscription).
export function validatePromotionLabels(labels) {
  const unique = [...new Set(labels)];
  if (unique.length === 0) throw new HttpError(400, 'Paramètre promotions manquant');
  if (unique.length > MAX_PROMOTIONS) throw new HttpError(400, `${MAX_PROMOTIONS} promotions au maximum`);
  if (unique.some((label) => label.length > MAX_LABEL_LENGTH)) throw new HttpError(400, 'Nom de promotion invalide');
  return unique;
}

// Dans une promotion, un cours = sa matière (la clé de cours, voir shared/course-key.mjs), quel que soit
// le nombre d'occurrences par semaine. On garde le premier code rencontré, sans espaces autour.
// `occurrences` liste les moments où il a lieu : « semaine|jour|début|fin ».
// `roomsByOccurrence` associe à chaque occurrence ses salles (une occurrence peut en avoir plusieurs,
// ou aucune) : la salle n'entre pas dans la clé d'occurrence, qui ne sert qu'à repérer un même moment.
// `teachersByOccurrence` fait de même pour les profs : un cours peut avoir un prof différent selon le
// jour (ex. Lemal le lundi, Jamoulle le vendredi) ; `teachers` (à plat, tous profs confondus) reste
// utile pour le résumé affiché avant le choix d'une date précise (écrans de sélection des cours).
function coursesOfPromotion(record) {
  const courses = new Map();
  for (const slot of record.courses) {
    if (!slot.key) continue; // sans matière : impossible à identifier, donc à filtrer
    let course = courses.get(slot.key);
    if (!course) {
      course = {
        key: slot.key,
        subject: slot.subject.trim(),
        code: null,
        teachers: [],
        occurrences: new Set(),
        roomsByOccurrence: new Map(),
        teachersByOccurrence: new Map(),
      };
      courses.set(slot.key, course);
    }
    course.code ??= slot.code?.trim() || null;
    for (const teacher of slot.teachers) {
      if (!course.teachers.includes(teacher)) course.teachers.push(teacher);
    }
    for (const week of slot.weeks) {
      const occurrence = `${week}|${slot.day}|${slot.start}|${slot.end}`;
      course.occurrences.add(occurrence);
      // `roomsByWeek` : salle résolue semaine par semaine quand elle change en cours d'année
      // (scraper/resolve-rooms.mjs). Sans lui, la même salle s'applique à toutes les semaines du créneau.
      const weekRooms = slot.roomsByWeek ? (slot.roomsByWeek[week] ?? []) : slot.rooms;
      if (weekRooms.length > 0) {
        let rooms = course.roomsByOccurrence.get(occurrence);
        if (!rooms) {
          rooms = new Set();
          course.roomsByOccurrence.set(occurrence, rooms);
        }
        for (const room of weekRooms) rooms.add(room);
      }
      if (slot.teachers.length > 0) {
        let teachers = course.teachersByOccurrence.get(occurrence);
        if (!teachers) {
          teachers = new Set();
          course.teachersByOccurrence.set(occurrence, teachers);
        }
        for (const teacher of slot.teachers) teachers.add(teacher);
      }
    }
  }
  return [...courses.values()];
}

const newLesson = (id, course, promotion) => ({
  id,
  key: course.key,
  subject: course.subject,
  code: course.code,
  teachers: [...course.teachers],
  // Sans code = atelier, réunion, événement : pas un cours à choisir, il va d'office dans le calendrier de la promotion.
  mandatory: course.code === null,
  promotions: [promotion],
  occurrences: new Set(course.occurrences),
  roomsByOccurrence: new Map([...course.roomsByOccurrence].map(([occurrence, rooms]) => [occurrence, new Set(rooms)])),
  teachersByOccurrence: new Map([...course.teachersByOccurrence].map(([occurrence, teachers]) => [occurrence, new Set(teachers)])),
});

// Fond `source` dans `target` ; l'identifiant retenu est le plus petit, pour ne pas dépendre de l'ordre des promotions.
function absorb(target, source) {
  if (source.id < target.id) target.id = source.id;
  target.code ??= source.code;
  // Obligatoire dans une des promotions fusionnées = obligatoire pour l'élève qui la suit.
  target.mandatory ||= source.mandatory;
  for (const promotion of source.promotions) {
    if (!target.promotions.includes(promotion)) target.promotions.push(promotion);
  }
  for (const teacher of source.teachers) {
    if (!target.teachers.includes(teacher)) target.teachers.push(teacher);
  }
  for (const occurrence of source.occurrences) target.occurrences.add(occurrence);
  for (const [occurrence, rooms] of source.roomsByOccurrence) {
    let targetRooms = target.roomsByOccurrence.get(occurrence);
    if (!targetRooms) {
      targetRooms = new Set();
      target.roomsByOccurrence.set(occurrence, targetRooms);
    }
    for (const room of rooms) targetRooms.add(room);
  }
  for (const [occurrence, teachers] of source.teachersByOccurrence) {
    let targetTeachers = target.teachersByOccurrence.get(occurrence);
    if (!targetTeachers) {
      targetTeachers = new Set();
      target.teachersByOccurrence.set(occurrence, targetTeachers);
    }
    for (const teacher of teachers) targetTeachers.add(teacher);
  }
}

const shareOccurrence = (a, b) => [...a].some((occurrence) => b.has(occurrence));

// Deux cours de même matière qui ont lieu au même moment (même semaine, même jour, mêmes heures) sont un seul
// cours : un élève qui suit les deux promotions ne peut pas être à deux endroits à la fois, donc l'afficher deux
// fois serait une erreur. Le code n'entre pas en jeu : les cours sans code (ateliers, réunions) sont concernés.
function mergeSimultaneous(lessons) {
  const groups = [];
  for (const lesson of lessons) {
    const twins = groups.filter((group) => group.key === lesson.key && shareOccurrence(group.occurrences, lesson.occurrences));
    if (twins.length === 0) {
      groups.push(lesson);
      continue;
    }
    // La leçon peut relier plusieurs groupes déjà formés : ils fusionnent tous avec elle.
    const [first, ...others] = twins;
    absorb(first, lesson);
    for (const other of others) {
      absorb(first, other);
      groups.splice(groups.indexOf(other), 1);
    }
  }
  return groups;
}

// Relation plusieurs-à-plusieurs : `promotions` liste celles où le cours apparaît ; les créneaux, eux, restent
// par promotion dans Redis. Deux règles fusionnent les cours de promotions différentes :
//  1. même code ET même matière (jamais de fausse fusion : un code peut couvrir deux matières) ;
//  2. même matière au même moment (voir mergeSimultaneous), qui règle les cours sans code.
// Le reste est laissé séparé, même à matière identique : ce sont deux cours distincts (autres moments, autres codes).
function mergeLessonsFromRecords(records) {
  const byCode = new Map();
  for (const record of records) {
    for (const course of coursesOfPromotion(record)) {
      const id = course.code ? `code:${course.code}|${course.key}` : `promotion:${record.promotion}|${course.key}`;
      const lesson = newLesson(id, course, record.promotion);
      if (byCode.has(id)) absorb(byCode.get(id), lesson);
      else byCode.set(id, lesson);
    }
  }
  return mergeSimultaneous([...byCode.values()].sort((a, b) => (a.id < b.id ? -1 : 1)));
}

// La plus ancienne des dates de scrap : c'est la fraîcheur garantie de la réponse.
const freshnessOf = (records) => records.map((record) => record.scrapedAt).sort()[0] ?? null;

export function buildLessons(records) {
  const merged = mergeLessonsFromRecords(records);
  const order = new Map(records.map((record, index) => [record.promotion, index]));
  return {
    updatedAt: freshnessOf(records),
    lessons: merged
      // `key` (la matière normalisée) identifie le cours dans chacune de ses promotions, même si son code change :
      // c'est ce que l'abonnement enregistre (voir server/subscription.mjs), pas `id`.
      .map(({ id, key, subject, code, teachers, mandatory, promotions }) => ({
        id,
        key,
        subject,
        code,
        teachers,
        mandatory,
        promotions: [...promotions].sort((a, b) => order.get(a) - order.get(b)),
      }))
      .sort((a, b) => promotionCollator.compare(a.subject, b.subject) || promotionCollator.compare(a.id, b.id)),
  };
}

// Comme buildLessons, mais garde les occurrences (« semaine|jour|début|fin ») et leurs salles/profs, que
// l'API publique n'expose pas : c'est ce dont le flux ICS a besoin pour placer les événements dans le
// temps et renseigner leur lieu et leur(s) prof(s) exacts, occurrence par occurrence.
export function buildDetailedLessons(records) {
  return mergeLessonsFromRecords(records).map((lesson) => ({
    ...lesson,
    occurrences: [...lesson.occurrences],
    roomsByOccurrence: Object.fromEntries([...lesson.roomsByOccurrence].map(([occurrence, rooms]) => [occurrence, [...rooms]])),
    teachersByOccurrence: Object.fromEntries(
      [...lesson.teachersByOccurrence].map(([occurrence, teachers]) => [occurrence, [...teachers]]),
    ),
  }));
}

export async function getLessons(redis, url) {
  const labels = parsePromotions(url.searchParams);
  // Une clé absente = promotion inconnue (l'index ne liste que des promotions qui ont un planning).
  const records = await redis.mgetJson(labels.map(scheduleKey));
  if (records.includes(null)) throw new HttpError(404, 'Promotion inconnue');
  return jsonResponse(buildLessons(records));
}
