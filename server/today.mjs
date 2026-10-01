// « Aujourd'hui », sur la page de l'élève : ses cours du jour, tirés des mêmes cours suivis que son flux ICS (voir
// followedLessons, server/subscription.mjs), avec la salle et les profs de chaque occurrence.
import { summaryOf } from './ics.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;

// en-CA écrit les dates « AAAA-MM-JJ ».
const BRUSSELS_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Brussels',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// La date du jour à Bruxelles, « AAAA-MM-JJ » : celle des cours, quel que soit le fuseau du serveur.
export function brusselsDate(now) {
  return BRUSSELS_DATE.format(now);
}

// Inverse de occurrenceDate (server/ics.mjs) : « AAAA-MM-JJ » -> semaine (1 = celle de `firstMonday`) et jour
// (0 = lundi).
function weekAndDay(firstMonday, date) {
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${firstMonday}T00:00:00Z`)) / DAY_MS);
  return { week: Math.floor(days / 7) + 1, day: ((days % 7) + 7) % 7 };
}

// Cours de `date` (« AAAA-MM-JJ »), par heure de début. `lessons` : sortie de buildDetailedLessons, déjà filtrée sur la
// sélection de l'élève ; `firstMonday` : lundi de la semaine 1 (null sans planning) ; `showPromotion` : l'élève suit
// deux promotions, chaque cours précise la sienne, comme dans son flux.
export function lessonsOfDay(lessons, firstMonday, date, showPromotion) {
  if (!firstMonday) return [];
  const { week, day } = weekAndDay(firstMonday, date);
  if (week < 1) return [];
  const prefix = `${week}|${day}|`;
  return lessons
    .flatMap((lesson) =>
      lesson.occurrences
        .filter((occurrence) => occurrence.startsWith(prefix))
        .map((occurrence) => {
          const [, , start, end] = occurrence.split('|');
          return {
            subject: summaryOf(lesson, showPromotion),
            start,
            end,
            rooms: lesson.roomsByOccurrence[occurrence] ?? [],
            teachers: lesson.teachersByOccurrence[occurrence] ?? [],
          };
        }),
    )
    .sort((a, b) => a.start.localeCompare(b.start) || a.subject.localeCompare(b.subject, 'fr'));
}
