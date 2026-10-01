import { CALENDAR_APPS } from '../data/calendar-apps';
import type { CalendarApp } from '../data/subscription-links';
import './calendar-app-tabs.css';

type CalendarAppTabsProps = {
  value: CalendarApp;
  onChange: (app: CalendarApp) => void;
};

// Un onglet par application de calendrier, pas par appareil : le lien Apple est le même sur iPhone, iPad et Mac.
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
          <img
            className="calendar-app-tabs__logo"
            src={entry.logo}
            alt=""
            width={Math.round(16 * entry.logoRatio)}
            height={16}
          />
          <span className="calendar-app-tabs__label">{entry.name}</span>
        </button>
      ))}
    </div>
  );
}
