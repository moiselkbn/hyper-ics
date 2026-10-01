import appleLogoUrl from '../assets/logo-apple-calendar.png';
import googleLogoUrl from '../assets/logo-google-calendar.png';
import type { CalendarApp } from '../data/subscription-links';
import './calendar-app-tabs.css';

// Un onglet par application de calendrier, pas par appareil : le lien Apple est le même sur iPhone, iPad et Mac.
const CALENDAR_APPS: { id: CalendarApp; label: string; logo: string; logoWidth: number }[] = [
  { id: 'apple', label: 'Apple Calendrier', logo: appleLogoUrl, logoWidth: 16 },
  { id: 'google', label: 'Google Agenda', logo: googleLogoUrl, logoWidth: 15 },
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
          <img className="calendar-app-tabs__logo" src={entry.logo} alt="" width={entry.logoWidth} height={16} />
          <span className="calendar-app-tabs__label">{entry.label}</span>
        </button>
      ))}
    </div>
  );
}
