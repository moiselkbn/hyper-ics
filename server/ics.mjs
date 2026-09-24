// Construction du flux ICS (RFC 5545) à partir des cours sélectionnés par l'élève.
// Un VEVENT par occurrence (semaine, jour, horaires) : les cours dédoublonnés par server/lessons.mjs
// donnent donc, ici aussi, un seul événement par créneau réel, jamais deux.
import { createHash } from 'node:crypto';

const MAX_LINE_OCTETS = 75;
const BRUSSELS_TZID = 'Europe/Brussels';

// Définition standard du fuseau Europe/Brussels (règle CET/CEST commune à l'UE depuis 1996, dernier
// dimanche de mars/octobre) : incluse dans le flux pour que les événements gardent leur heure locale
// (pas d'UTC) quel que soit le calendrier qui les lit.
const VTIMEZONE_LINES = [
  'BEGIN:VTIMEZONE',
  `TZID:${BRUSSELS_TZID}`,
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
];

// « 2026-09-14 » (lundi de la semaine 1) + semaine + jour (0 = lundi) -> date calendaire.
function occurrenceDate(firstMonday, week, day) {
  const [year, month, date] = firstMonday.split('-').map(Number);
  const base = new Date(Date.UTC(year, month - 1, date));
  base.setUTCDate(base.getUTCDate() + (week - 1) * 7 + day);
  return { year: base.getUTCFullYear(), month: base.getUTCMonth() + 1, day: base.getUTCDate() };
}

// Date UTC -> « AAAAMMJJTHHMMSSZ », le format DATE-TIME UTC de l'ICS (seul DTSTAMP en a besoin).
function formatIcsUtc(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

// Heure locale de Bruxelles -> « AAAAMMJJTHHMMSS », le format DATE-TIME local de l'ICS. Le décalage
// CET/CEST n'est pas calculé ici : c'est le rôle du VTIMEZONE référencé par TZID.
function formatIcsLocal(year, month, day, hour, minute) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${year}${pad(month)}${pad(day)}T${pad(hour)}${pad(minute)}00`;
}

// Échappe les caractères spéciaux d'un champ TEXT (RFC 5545 §3.3.11).
function escapeText(text) {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

// Une ligne ICS ne dépasse pas 75 octets ; au-delà, elle continue sur la ligne suivante avec une espace
// en tête (qui compte elle aussi dans les 75 octets). On découpe par caractère pour ne jamais couper
// un caractère multioctet (accents, etc.) au milieu.
function foldLine(line) {
  const lines = [];
  let current = '';
  let currentOctets = 0;
  let budget = MAX_LINE_OCTETS;
  for (const char of line) {
    const charOctets = Buffer.byteLength(char, 'utf8');
    if (currentOctets + charOctets > budget) {
      lines.push(current);
      current = '';
      currentOctets = 0;
      budget = MAX_LINE_OCTETS - 1;
    }
    current += char;
    currentOctets += charOctets;
  }
  lines.push(current);
  return lines.join('\r\n ');
}

// Un ou deux profs : la liste complète (« Dupont, Sarouille »). Au-delà, le premier suivi du nombre
// des autres (« Dupont +2 »), sinon la liste devient trop longue à afficher.
// Même règle que formatTeachers côté front (src/data/lessons.ts), dupliquée ici : trop courte
// pour valoir un module partagé entre un fichier TS et un fichier .mjs.
// Dans LOCATION (pas DESCRIPTION) : Apple Calendar n'affiche les notes qu'une fois l'événement
// ouvert en détail, alors que le lieu apparaît directement dans l'aperçu et la grille du calendrier.
function formatTeachers(teachers) {
  if (teachers.length <= 2) return teachers.join(', ');
  return `${teachers[0]} +${teachers.length - 1}`;
}

function compareOccurrences(a, b) {
  const [aWeek, aDay, aStart] = a.split('|');
  const [bWeek, bDay, bStart] = b.split('|');
  return Number(aWeek) - Number(bWeek) || Number(aDay) - Number(bDay) || aStart.localeCompare(bStart);
}

// Un élève en chevauchement (deux promotions suivies) a besoin de savoir à quelle promotion rattacher
// chaque cours : son libellé seul ne suffit plus. Inutile en dessous de deux promotions, où tous les
// cours du flux sont forcément ceux de l'unique promotion choisie.
function summaryOf(lesson, showPromotion) {
  if (!showPromotion) return lesson.subject;
  return `${lesson.subject} (${lesson.promotions.join(', ')})`;
}

function buildEvent(lesson, occurrence, firstMonday, now, showPromotion) {
  const [week, day, start, end] = occurrence.split('|');
  const { year, month, day: date } = occurrenceDate(firstMonday, Number(week), Number(day));
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  // Stable d'une requête à l'autre : le calendrier de l'élève se met à jour sans dupliquer l'événement.
  // Tiré de la matière (`key`), pas de l'identifiant du cours : celui-ci change quand le cours reçoit un code
  // ou selon les promotions fusionnées. Unique dans le flux : même matière au même moment = un seul cours.
  const uid = `${createHash('sha1').update(`${lesson.key}|${occurrence}`).digest('hex')}@hyperics.app`;
  const rooms = lesson.roomsByOccurrence?.[occurrence] ?? [];
  // Le prof peut changer d'une occurrence à l'autre (ex. Lemal le lundi, Jamoulle le vendredi) : on lit
  // celui de cette occurrence précise, jamais la liste à plat de tous les profs du cours.
  const teachers = lesson.teachersByOccurrence?.[occurrence] ?? [];

  const lines = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatIcsUtc(now)}`,
    `DTSTART;TZID=${BRUSSELS_TZID}:${formatIcsLocal(year, month, date, startHour, startMinute)}`,
    `DTEND;TZID=${BRUSSELS_TZID}:${formatIcsLocal(year, month, date, endHour, endMinute)}`,
    `SUMMARY:${escapeText(summaryOf(lesson, showPromotion))}`,
  ];
  const location = [...rooms];
  if (teachers.length > 0) location.push(formatTeachers(teachers));
  if (location.length > 0) lines.push(`LOCATION:${escapeText(location.join(', '))}`);
  lines.push('END:VEVENT');
  return lines;
}

// `lessons` : sortie de buildDetailedLessons (server/lessons.mjs), déjà filtrée sur la sélection de l'élève.
// `firstMonday` : lundi de la semaine 1 (« AAAA-MM-JJ »), commun à toutes les promotions d'une même session.
// `promotions` : promotions choisies par l'élève (server/feed.mjs) ; au-delà d'une, chaque SUMMARY précise
// à laquelle son cours appartient (chevauchement).
export function buildIcs(lessons, firstMonday, promotions = [], now = new Date()) {
  const showPromotion = promotions.length > 1;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HyperICS//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:HyperICS',
    `X-WR-TIMEZONE:${BRUSSELS_TZID}`,
    // Fréquence de rafraîchissement suggérée (le scrap tourne toutes les heures) : lue par Apple et Outlook
    // (X-PUBLISHED-TTL) ou par les clients récents (REFRESH-INTERVAL, RFC 7986). Google l'ignore.
    'X-PUBLISHED-TTL:PT1H',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    ...VTIMEZONE_LINES,
  ];
  for (const lesson of lessons) {
    for (const occurrence of [...lesson.occurrences].sort(compareOccurrences)) {
      lines.push(...buildEvent(lesson, occurrence, firstMonday, now, showPromotion));
    }
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
