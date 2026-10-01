import statusDotUrl from '../assets/status-dot.svg';
import { calendarAppOf } from '../data/calendar-apps';
import { formatSince, type CalendarStatus } from '../data/calendar-status';
import type { CalendarApp } from '../data/subscription-links';
import './calendar-status.css';

// Ce que l'élève peut vérifier quand son calendrier ne se met plus à jour, avant de le réajouter.
const STALE_HINTS: Record<CalendarApp, string> = {
  apple:
    'Vérifie que Calendrier a accès aux données cellulaires : Réglages → Données cellulaires → Calendrier. Sinon, réajoute-le.',
  google: 'Dans l’appli Google Agenda : Paramètres → HyperICS → active « Synchroniser ». Sinon, réajoute-le.',
};

function AppLogo({ app }: { app: CalendarApp }) {
  const { logo, logoRatio } = calendarAppOf(app);
  return (
    <span className="calendar-status__logo">
      <img src={logo} alt="" width={Math.round(20 * logoRatio)} height={20} />
    </span>
  );
}

// Aucune application n'a encore lu le flux.
export function NotAddedStatus() {
  return (
    <p className="calendar-status__pill">
      <img src={statusDotUrl} alt="" width={8} height={8} />
      Pas encore ajouté à ton calendrier personnel
    </p>
  );
}

// Calendrier d'Apple a lu le flux une fois : il le fait avant même que l'élève confirme l'ajout, qu'il a donc pu
// annuler. Le texte est vrai dans les deux cas.
export function StartedStatus() {
  return (
    <div className="calendar-status__line calendar-status__line--detailed">
      <AppLogo app="apple" />
      <div className="calendar-status__text calendar-status__text--detailed">
        <p className="calendar-status__title">Ajout commencé dans {calendarAppOf('apple').name}</p>
        <p className="calendar-status__since">En attente de la première synchro</p>
        <p className="calendar-status__hint calendar-status__hint--strong">
          Si HyperICS apparaît dans ton calendrier, c’est bon : ne le rajoute pas, tes cours seraient en double. Sinon,
          réessaie ci-dessous.
        </p>
      </div>
    </div>
  );
}

type CalendarStatusListProps = {
  // Applications où le calendrier est ajouté (voir addedCalendars, src/data/calendar-status.ts).
  calendars: CalendarStatus[];
  // « Réajouter mon calendrier », sous une application qui ne se met plus à jour.
  onReAdd: (app: CalendarApp) => void;
};

// Une ligne par application, pas par appareil : avec iCloud ou un compte Google, c'est l'application qui relit le flux.
export function CalendarStatusList({ calendars, onReAdd }: CalendarStatusListProps) {
  return (
    <ul className="calendar-status">
      {calendars.map(({ app, state, lastReadAt }) => {
        const { name } = calendarAppOf(app);
        const since = `Dernière synchro ${formatSince(lastReadAt)}`;
        if (state !== 'stale') {
          return (
            <li key={app} className="calendar-status__line">
              <AppLogo app={app} />
              <div className="calendar-status__text">
                <p className="calendar-status__title">Connecté à {name}</p>
                <p className="calendar-status__since">{since}</p>
              </div>
            </li>
          );
        }
        return (
          <li key={app} className="calendar-status__line calendar-status__line--detailed calendar-status__line--alert">
            <AppLogo app={app} />
            <div className="calendar-status__text calendar-status__text--detailed">
              <p className="calendar-status__title">{name} ne se met plus à jour</p>
              <p className="calendar-status__since calendar-status__since--alert">{since}</p>
              <p className="calendar-status__hint">{STALE_HINTS[app]}</p>
              <button className="calendar-status__re-add" type="button" onClick={() => onReAdd(app)}>
                Réajouter mon calendrier ›
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
