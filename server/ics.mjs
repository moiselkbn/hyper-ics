// Construction du flux ICS (RFC 5545) à partir des cours sélectionnés par l'élève.
// Un VEVENT par occurrence (semaine, jour, horaires) : les cours dédoublonnés par server/lessons.mjs
// donnent donc, ici aussi, un seul événement par créneau réel, jamais deux.
import { createHash } from 'node:crypto';

const MAX_LINE_OCTETS = 75;
// Europe/Brussels bascule CET (+1) / CEST (+2) uniquement, jamais de décalage en minutes.
const OFFSET_FORMATTER = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Brussels', timeZoneName: 'shortOffset' });

// « 2026-09-14 » (lundi de la semaine 1) + semaine + jour (0 = lundi) -> date calendaire.
function occurrenceDate(firstMonday, week, day) {
  const [year, month, date] = firstMonday.split('-').map(Number);
  const base = new Date(Date.UTC(year, month - 1, date));
  base.setUTCDate(base.getUTCDate() + (week - 1) * 7 + day);
  return { year: base.getUTCFullYear(), month: base.getUTCMonth() + 1, day: base.getUTCDate() };
}

// Décalage de Bruxelles (en heures) au voisinage d'un instant donné, sans coder les règles CET/CEST à la main.
function brusselsOffsetHours(date) {
  const zoneName = OFFSET_FORMATTER.formatToParts(date).find((part) => part.type === 'timeZoneName')?.value ?? 'GMT+1';
  return Number(zoneName.replace('GMT', '')) || 1;
}

// Heure locale de Bruxelles -> instant UTC. Les cours ont lieu entre 8h et 21h, loin de la bascule
// horaire (autour de 1h-3h du matin) : l'approximation en deux temps (décalage provisoire puis définitif) suffit.
function brusselsLocalToUtc(year, month, day, hour, minute) {
  const provisional = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return new Date(provisional.getTime() - brusselsOffsetHours(provisional) * 3600_000);
}

// Date UTC -> « AAAAMMJJTHHMMSSZ », le format DATE-TIME de l'ICS.
function formatIcsUtc(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
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

// Un prof est toujours affiché ; s'il y en a d'autres, on ajoute leur nombre (« Lemal +2 »).
// Même règle que formatTeachers côté front (src/data/lessons.ts), dupliquée ici : trop courte
// pour valoir un module partagé entre un fichier TS et un fichier .mjs.
function formatTeachers(teachers) {
  if (teachers.length <= 1) return teachers[0] ?? '';
  return `${teachers[0]} +${teachers.length - 1}`;
}

function compareOccurrences(a, b) {
  const [aWeek, aDay, aStart] = a.split('|');
  const [bWeek, bDay, bStart] = b.split('|');
  return Number(aWeek) - Number(bWeek) || Number(aDay) - Number(bDay) || aStart.localeCompare(bStart);
}

function buildEvent(lesson, occurrence, firstMonday, now) {
  const [week, day, start, end] = occurrence.split('|');
  const { year, month, day: date } = occurrenceDate(firstMonday, Number(week), Number(day));
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  // Stable d'une requête à l'autre : le calendrier de l'élève se met à jour sans dupliquer l'événement.
  const uid = `${createHash('sha1').update(`${lesson.id}|${occurrence}`).digest('hex')}@hyperics.app`;

  const lines = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatIcsUtc(now)}`,
    `DTSTART:${formatIcsUtc(brusselsLocalToUtc(year, month, date, startHour, startMinute))}`,
    `DTEND:${formatIcsUtc(brusselsLocalToUtc(year, month, date, endHour, endMinute))}`,
    `SUMMARY:${escapeText(lesson.subject)}`,
  ];
  if (lesson.teachers.length > 0) lines.push(`DESCRIPTION:${escapeText(formatTeachers(lesson.teachers))}`);
  lines.push('END:VEVENT');
  return lines;
}

// `lessons` : sortie de buildDetailedLessons (server/lessons.mjs), déjà filtrée sur la sélection de l'élève.
// `firstMonday` : lundi de la semaine 1 (« AAAA-MM-JJ »), commun à toutes les promotions d'une même session.
export function buildIcs(lessons, firstMonday, now = new Date()) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//HyperICS//FR', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:HyperICS'];
  for (const lesson of lessons) {
    for (const occurrence of [...lesson.occurrences].sort(compareOccurrences)) {
      lines.push(...buildEvent(lesson, occurrence, firstMonday, now));
    }
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
