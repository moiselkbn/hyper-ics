// Une requête sur tout le quadrimestre dédoublonne les créneaux identiques (jour, heure, code, prof),
// mais pas la salle : si elle change en cours d'année, les deux salles reviennent listées pour
// l'ensemble des semaines du créneau (constaté sur « Anglais Q5 », 3TI Web : L320 et L316 sur les
// 10 semaines du cours, sans indication de laquelle s'applique à quelle semaine).
// On affine par recherche dichotomique : requêtes sur des sous-plages de semaines, seulement pour les
// créneaux concernés, jusqu'à isoler une salle unique par semaine (ou une semaine isolée qui reste
// ambiguë : deux salles utilisées en même temps pour une même occurrence, ce qui est légitime).
//
// Ces requêtes coûtent cher (1,5 s d'attente chacune, jusqu'à 2 minutes pour une promotion) : on
// reprend la résolution du scrap précédent tant que le créneau n'a pas changé (vérifiée au-delà d'un
// jour, voir `RESOLUTION_MAX_AGE_MS`), on ne demande jamais deux fois la même plage, et on s'arrête à
// l'échéance fixée par l'appelant.
import { formatWeeksRange, parseCourses } from './parse-schedule.mjs';

// Au-delà, une résolution reprise est vérifiée : les salles d'un créneau peuvent être redistribuées entre
// ses semaines sans que la liste des salles ni celle des semaines ne change. La vérification coûte une
// requête par salle (80 pour les 44 créneaux ambigus au 27/09) ; la dichotomie n'est refaite qu'en cas d'écart.
export const RESOLUTION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function sameSlot(a, b) {
  return a.day === b.day && a.start === b.start && a.end === b.end && (a.code ?? a.subject) === (b.code ?? b.subject);
}

const sameSet = (a, b) => a.length === b.length && a.every((item) => b.includes(item));

// Même créneau, mêmes salles, mêmes semaines qu'au scrap précédent : sa résolution vaut toujours.
const sameAmbiguity = (a, b) => sameSlot(a, b) && sameSet(a.rooms, b.rooms) && sameSet(a.weeks, b.weeks);

// Résultat vide si le créneau est introuvable dans la sous-plage interrogée (ne devrait pas arriver,
// vu qu'on ne subdivise que des semaines déjà confirmées) : aucune salle plutôt qu'une salle inventée.
async function roomsForWeeks(fetchWeeks, course, weeks) {
  const raw = await fetchWeeks(formatWeeksRange(weeks));
  const match = parseCourses(raw.ListeCours ?? []).find((candidate) => sameSlot(candidate, course));
  return match?.rooms ?? [];
}

// `progress.complete` passe à false si l'échéance coupe la dichotomie : la sous-plage reste alors ambiguë.
async function resolveWeeks(fetchWeeks, course, weeks, rooms, progress) {
  if (rooms.length <= 1 || weeks.length === 1) return [{ weeks, rooms }];
  if (progress.clock() >= progress.deadline) {
    progress.complete = false;
    return [{ weeks, rooms }];
  }
  const mid = Math.ceil(weeks.length / 2);
  const left = weeks.slice(0, mid);
  const right = weeks.slice(mid);
  const leftRooms = await roomsForWeeks(fetchWeeks, course, left);
  const leftResolved = await resolveWeeks(fetchWeeks, course, left, leftRooms, progress);
  const rightRooms = await roomsForWeeks(fetchWeeks, course, right);
  const rightResolved = await resolveWeeks(fetchWeeks, course, right, rightRooms, progress);
  return [...leftResolved, ...rightResolved];
}

// Semaines d'une résolution regroupées par salles, dans l'ordre des semaines.
function weeksByRooms(roomsByWeek) {
  const groups = new Map();
  for (const [week, rooms] of Object.entries(roomsByWeek)) {
    const key = [...rooms].sort().join('\n');
    if (!groups.has(key)) groups.set(key, { rooms, weeks: [] });
    groups.get(key).weeks.push(Number(week));
  }
  return [...groups.values()];
}

// Une requête par groupe de semaines de mêmes salles : la résolution tient si chacune renvoie exactement
// ces salles. Angle mort : une semaine à deux salles simultanées qui en perd une, alors qu'une autre semaine
// du groupe les garde toutes deux ; l'élève voit une salle en trop, jamais une salle fausse.
// Faux (et `progress.complete` à false) si l'échéance tombe avant la fin.
async function stillValid(fetchWeeks, course, roomsByWeek, progress) {
  for (const group of weeksByRooms(roomsByWeek)) {
    if (progress.clock() >= progress.deadline) {
      progress.complete = false;
      return false;
    }
    if (!sameSet(await roomsForWeeks(fetchWeeks, course, group.weeks), group.rooms)) return false;
  }
  return true;
}

function toRoomsByWeek(segments) {
  const roomsByWeek = {};
  for (const segment of segments) {
    for (const week of segment.weeks) roomsByWeek[week] = segment.rooms;
  }
  return roomsByWeek;
}

// `fetchRawWeeks(weeksRangeText)` : même requête que pour tout le quadrimestre, sur une plage de
// semaines réduite (même promotion, déjà fixée par l'appelant). N'interroge que les créneaux ambigus
// (plusieurs salles sur plus d'une semaine) ; les autres traversent sans requête supplémentaire.
// Options :
// - `previous` : créneaux du planning précédent de la même promotion, dont on reprend la résolution ;
// - `deadline` (heure `clock()` en ms) : au-delà, plus aucune requête ; le créneau garde son ancienne
//   résolution, même datée, ou ses salles telles quelles, et sera affiné à un prochain scrap.
// Renvoie les créneaux et le décompte `reused` (résolution reprise, vérifiée ou non), `resolved` (affinée
// maintenant), `deferred` (reportée faute de temps).
export async function resolveAmbiguousRooms(
  fetchRawWeeks,
  courses,
  { previous = [], now = new Date(), deadline = Infinity, clock = Date.now } = {},
) {
  // Plusieurs créneaux ambigus d'une promotion couvrent souvent les mêmes semaines : une plage n'est demandée qu'une fois.
  const fetched = new Map();
  const fetchWeeks = (range) => {
    if (!fetched.has(range)) fetched.set(range, fetchRawWeeks(range));
    return fetched.get(range);
  };

  const result = { courses: [], reused: 0, resolved: 0, deferred: 0 };
  for (const course of courses) {
    if (course.rooms.length <= 1 || course.weeks.length <= 1) {
      result.courses.push(course);
      continue;
    }
    const known = previous.find((candidate) => candidate.roomsByWeek && sameAmbiguity(candidate, course));
    const withKnown = known && { ...course, roomsByWeek: known.roomsByWeek, roomsResolvedAt: known.roomsResolvedAt };
    const progress = { deadline, clock, complete: true };
    // Seule une résolution datée est complète : une partielle (sans date) est reprise par la dichotomie.
    if (withKnown?.roomsResolvedAt) {
      if (now - new Date(known.roomsResolvedAt) < RESOLUTION_MAX_AGE_MS) {
        result.courses.push(withKnown);
        result.reused += 1;
        continue;
      }
      if (await stillValid(fetchWeeks, course, known.roomsByWeek, progress)) {
        result.courses.push({ ...withKnown, roomsResolvedAt: now.toISOString() });
        result.reused += 1;
        continue;
      }
      if (!progress.complete) {
        result.courses.push(withKnown);
        result.deferred += 1;
        continue;
      }
    }
    const segments = await resolveWeeks(fetchWeeks, course, course.weeks, course.rooms, progress);
    if (progress.complete) {
      result.courses.push({ ...course, roomsByWeek: toRoomsByWeek(segments), roomsResolvedAt: now.toISOString() });
      result.resolved += 1;
    } else {
      // Coupé par l'échéance : l'ancienne résolution, même datée, vaut mieux qu'une résolution partielle.
      // Sans date, la partielle sera reprise et complétée au prochain scrap. Rien de subdivisé : le créneau
      // reste tel quel (ses salles valent pour toutes ses semaines).
      const partial = segments.length > 1 ? { ...course, roomsByWeek: toRoomsByWeek(segments) } : course;
      result.courses.push(withKnown || partial);
      result.deferred += 1;
    }
  }
  return result;
}
