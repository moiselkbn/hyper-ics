import type { CalendarApp } from '../data/subscription-links';
import './calendar-app-tabs.css';

// Un onglet par application de calendrier, pas par appareil : le lien Apple est le même sur iPhone, iPad et Mac.
// Seul l'onglet Apple est dans la maquette : Google et Outlook en reprennent le style.
const CALENDAR_APPS: { id: CalendarApp; label: string }[] = [
  { id: 'apple', label: 'Apple' },
  { id: 'google', label: 'Google' },
  { id: 'outlook', label: 'Outlook' },
];

type CalendarAppTabsProps = {
  value: CalendarApp;
  onChange: (app: CalendarApp) => void;
};

export function CalendarAppTabs({ value, onChange }: CalendarAppTabsProps) {
  return (
    <div className="calendar-app-tabs">
      {CALENDAR_APPS.map((entry) => (
        <button
          key={entry.id}
          type="button"
          className={
            entry.id === value ? 'calendar-app-tabs__tab calendar-app-tabs__tab--active' : 'calendar-app-tabs__tab'
          }
          aria-pressed={entry.id === value}
          onClick={() => onChange(entry.id)}
        >
          {entry.label}
        </button>
      ))}
    </div>
  );
}
