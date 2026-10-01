// Dates de la page de l'élève, toujours à l'heure de Bruxelles : celle des cours, où qu'il soit.
const TIME_ZONE = 'Europe/Brussels';

const DAY_FORMAT = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'long', timeZone: TIME_ZONE });
const WEEKDAY_FORMAT = new Intl.DateTimeFormat('fr-BE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: TIME_ZONE,
});
// en-CA écrit les dates « AAAA-MM-JJ », comme le serveur (voir brusselsDate, server/today.mjs).
const ISO_DAY_FORMAT = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: TIME_ZONE,
});
const TIME_FORMAT = new Intl.DateTimeFormat('fr-BE', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: TIME_ZONE,
});

// « 27 septembre », « 1er octobre » ; avec `weekday`, « Mardi 29 septembre ».
export function formatDay(date: Date, { weekday = false } = {}): string {
  const text = (weekday ? WEEKDAY_FORMAT : DAY_FORMAT)
    .formatToParts(date)
    .map(({ type, value }) => (type === 'day' && value === '1' ? '1er' : value))
    .join('');
  return weekday ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

// Une date « AAAA-MM-JJ » (jour à Bruxelles) en Date : midi UTC, pour rester ce jour-là dans tout fuseau.
export const fromIsoDay = (day: string) => new Date(`${day}T12:00:00Z`);

// Jour (« AAAA-MM-JJ ») et heure (« 09:05 ») à Bruxelles.
export function brusselsNow(now = new Date()): { day: string; time: string } {
  return { day: ISO_DAY_FORMAT.format(now), time: TIME_FORMAT.format(now).replace(/\s/g, '') };
}
