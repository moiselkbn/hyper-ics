// Une requête sur tout le quadrimestre dédoublonne les créneaux identiques (jour, heure, code, prof),
// mais pas la salle : si elle change en cours d'année, les deux salles reviennent listées pour
// l'ensemble des semaines du créneau (constaté sur « Anglais Q5 », 3TI Web : L320 et L316 sur les
// 10 semaines du cours, sans indication de laquelle s'applique à quelle semaine).
// On affine par recherche dichotomique : requêtes sur des sous-plages de semaines, seulement pour les
// créneaux concernés, jusqu'à isoler une salle unique par semaine (ou une semaine isolée qui reste
// ambiguë : deux salles utilisées en même temps pour une même occurrence, ce qui est légitime).
import { formatWeeksRange, parseCourses } from './parse-schedule.mjs';

function sameSlot(a, b) {
  return a.day === b.day && a.start === b.start && a.end === b.end && (a.code ?? a.subject) === (b.code ?? b.subject);
}

// Résultat vide si le créneau est introuvable dans la sous-plage interrogée (ne devrait pas arriver,
// vu qu'on ne subdivise que des semaines déjà confirmées) : aucune salle plutôt qu'une salle inventée.
async function roomsForWeeks(fetchRawWeeks, course, weeks) {
  const raw = await fetchRawWeeks(formatWeeksRange(weeks));
  const match = parseCourses(raw.ListeCours ?? []).find((candidate) => sameSlot(candidate, course));
  return match?.rooms ?? [];
}

async function resolveWeeks(fetchRawWeeks, course, weeks, rooms) {
  if (rooms.length <= 1 || weeks.length === 1) return [{ weeks, rooms }];
  const mid = Math.ceil(weeks.length / 2);
  const left = weeks.slice(0, mid);
  const right = weeks.slice(mid);
  const leftRooms = await roomsForWeeks(fetchRawWeeks, course, left);
  const leftResolved = await resolveWeeks(fetchRawWeeks, course, left, leftRooms);
  const rightRooms = await roomsForWeeks(fetchRawWeeks, course, right);
  const rightResolved = await resolveWeeks(fetchRawWeeks, course, right, rightRooms);
  return [...leftResolved, ...rightResolved];
}

// `fetchRawWeeks(weeksRangeText)` : même requête que pour tout le quadrimestre, sur une plage de
// semaines réduite (même promotion, déjà fixée par l'appelant). N'interroge que les créneaux ambigus
// (plusieurs salles sur plus d'une semaine) ; les autres traversent sans requête supplémentaire.
export async function resolveAmbiguousRooms(fetchRawWeeks, courses) {
  const resolved = [];
  for (const course of courses) {
    if (course.rooms.length <= 1 || course.weeks.length <= 1) {
      resolved.push(course);
      continue;
    }
    const segments = await resolveWeeks(fetchRawWeeks, course, course.weeks, course.rooms);
    const roomsByWeek = {};
    for (const segment of segments) {
      for (const week of segment.weeks) roomsByWeek[week] = segment.rooms;
    }
    resolved.push({ ...course, roomsByWeek });
  }
  return resolved;
}
