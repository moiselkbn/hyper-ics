// Plage de scrap : toutes les heures de 7h à 17h (incluses), heure de Bruxelles.
// Le cron GitHub est en UTC : le workflow se déclenche sur toutes les heures UTC possibles
// (5h à 16h, été comme hiver) et c'est ce filtre qui écarte celles hors plage.
const TIME_ZONE = 'Europe/Brussels';
const FIRST_HOUR = 7;
const LAST_HOUR = 17;

const hourFormat = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: 'numeric', hourCycle: 'h23' });

// Heure locale (0–23) à Bruxelles, heure d'été comprise.
export const brusselsHour = (date) => Number(hourFormat.format(date));

export function isWithinScrapHours(date) {
  const hour = brusselsHour(date);
  return hour >= FIRST_HOUR && hour <= LAST_HOUR;
}
