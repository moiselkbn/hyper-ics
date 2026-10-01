import type { StoredPromotion } from './lessons';
import type { CalendarApp } from './subscription-links';

// État du calendrier dans une application qui a lu le flux (voir calendarStatuses, server/feed-reads.mjs) :
// `started` (Apple, ajout pas encore confirmé), `connected`, ou `stale` (ne se met plus à jour).
export type CalendarState = 'started' | 'connected' | 'stale';
export type CalendarStatus = { app: CalendarApp; state: CalendarState; lastReadAt: string };

// Un cours du jour (voir lessonsOfDay, server/today.mjs) : salle et profs de cette occurrence-là.
export type TodayLesson = { subject: string; start: string; end: string; rooms: string[]; teachers: string[] };

// Ce que renvoie GET /api/subscription.
export type StoredSubscription = {
  promotions: StoredPromotion[];
  calendars: CalendarStatus[];
  createdAt: string;
  updatedAt: string;
  // Cours du jour à Bruxelles (`date` : « AAAA-MM-JJ »).
  today: { date: string; lessons: TodayLesson[] };
};

// État de la page de l'élève :
// - `not-added` : aucune application n'a lu le flux, l'ajout est mis en avant ;
// - `started` : Calendrier d'Apple l'a lu une fois, mais l'élève a pu annuler l'ajout ;
// - `connected` : au moins une application le relit, l'ajout passe dans « Ajouter sur un autre appareil ».
export type PageState = 'not-added' | 'started' | 'connected';

// Applications où le calendrier est ajouté, qu'il s'y mette encore à jour ou non. Dès qu'il y en a une, la page ne
// montre plus qu'elles : un « ajout commencé » à côté n'est souvent qu'un ajout annulé.
export function addedCalendars(calendars: CalendarStatus[]): CalendarStatus[] {
  return calendars.filter((calendar) => calendar.state !== 'started');
}

export function pageStateOf(calendars: CalendarStatus[]): PageState {
  if (addedCalendars(calendars).length > 0) return 'connected';
  return calendars.length > 0 ? 'started' : 'not-added';
}

// « il y a 12 min », « il y a 6 h », « il y a 2 jours ».
export function formatSince(date: string, now = Date.now()): string {
  const minutes = Math.floor((now - Date.parse(date)) / 60_000);
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} jour${days > 1 ? 's' : ''}`;
}
