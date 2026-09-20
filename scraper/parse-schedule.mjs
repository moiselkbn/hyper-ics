// Interprétation des cours bruts renvoyés par FonctionEmploiDuTemps.

const SLOTS_PER_DAY = 26;
const SLOT_MINUTES = 30;
const DAY_START_MINUTES = 8 * 60;

// Genres des éléments de `listeC` (constatés sur 3TI Web).
const GENRE_SUBJECT = 0;
const GENRE_TEACHER = 1;
const GENRE_ROOM = 3;
const GENRE_NOTE = 5;
const GENRE_CODE = 14;

// « [2..6,10..14] » -> [2, 3, 4, 5, 6, 10, 11, 12, 13, 14]
export function parseWeeks(domain) {
  return domain
    .replace(/[[\]]/g, '')
    .split(',')
    .filter(Boolean)
    .flatMap((part) => {
      const [start, end = start] = part.split('..').map(Number);
      return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    });
}

// « 14/09/2026 » -> « 2026-09-14 »
export function parseDate(text) {
  const [day, month, year] = text.split('/');
  return `${year}-${month}-${day}`;
}

// Numéro de créneau (0 = 08:00) -> « HH:MM »
export function slotToTime(slot) {
  const minutes = DAY_START_MINUTES + slot * SLOT_MINUTES;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function labelsOf(rawCourse, genre) {
  const entry = rawCourse.listeC.find((item) => item.G === genre);
  if (!entry) return [];
  return [].concat(entry.C)
    .map((item) => item.L ?? item.str)
    .filter(Boolean);
}

// Le code est de la forme « <3TI Web>TWEB-501 » : on sépare promotion et code.
function parseCode(label) {
  const match = label?.match(/^<(.+?)>(.+)$/);
  return match ? { promotion: match[1], code: match[2] } : { promotion: null, code: label ?? null };
}

// Renvoie une occurrence hebdomadaire par cours brut.
// `code` vaut null pour les créneaux sans code (réunions, ateliers).
export function parseCourses(rawCourses) {
  return rawCourses.map((raw) => {
    const day = Math.floor(raw.p / SLOTS_PER_DAY); // 0 = lundi
    const slot = raw.p % SLOTS_PER_DAY;
    const { promotion, code } = parseCode(labelsOf(raw, GENRE_CODE)[0]);
    return {
      code,
      promotion,
      subject: labelsOf(raw, GENRE_SUBJECT)[0] ?? null,
      teachers: labelsOf(raw, GENRE_TEACHER),
      rooms: labelsOf(raw, GENRE_ROOM),
      note: labelsOf(raw, GENRE_NOTE)[0] ?? null,
      day,
      start: slotToTime(slot),
      end: slotToTime(slot + raw.d),
      weeks: parseWeeks(raw.dom),
    };
  });
}
