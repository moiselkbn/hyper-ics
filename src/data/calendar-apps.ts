import appleLogoUrl from '../assets/logo-apple-calendar.png';
import googleLogoUrl from '../assets/logo-google-calendar.png';
import type { CalendarApp } from './subscription-links';

// Nom et logo de chaque application de calendrier (onglets d'ajout, statut de connexion), Apple d'abord.
// Le logo de Google est un peu plus étroit que haut : `logoRatio` = largeur / hauteur.
export const CALENDAR_APPS: { id: CalendarApp; name: string; logo: string; logoRatio: number }[] = [
  { id: 'apple', name: 'Apple Calendrier', logo: appleLogoUrl, logoRatio: 1 },
  { id: 'google', name: 'Google Agenda', logo: googleLogoUrl, logoRatio: 0.93 },
];

export function calendarAppOf(app: CalendarApp) {
  return CALENDAR_APPS.find((entry) => entry.id === app)!;
}
