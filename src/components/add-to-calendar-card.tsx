import { useEffect, useState, type ReactNode } from 'react';
import arrowUpRightUrl from '../assets/arrow-up-right.svg';
import { shareOrCopy } from '../data/share';
import {
  detectCalendarApp,
  googleCalendarUrl,
  isAndroid,
  isAppleTouchDevice,
  isPhone,
  webcalUrl,
  type CalendarApp,
} from '../data/subscription-links';
import { Button } from './button';
import { CalendarAppTabs } from './calendar-app-tabs';
import { LinkField } from './link-field';
import './add-to-calendar-card.css';

// Ajout à la main, quand le bouton ne convient pas : la 1re étape (copier l'adresse du flux, /f/…) est commune ;
// impossible de la confondre avec le lien de la page (/m/…). Les deux suivantes dépendent de l'application et de
// l'appareil.
const APPLE_TOUCH_STEPS = [
  'Dans l’app Calendrier, touche l’icône calendrier en bas à droite, puis « Nouveau calendrier ».',
  'Choisis « Ajouter un calendrier avec abonnement », colle l’adresse, puis touche « Rechercher ».',
];
const APPLE_MAC_STEPS = [
  'Dans Calendrier, menu « Fichier », puis « Nouvel abonnement à un calendrier… ».',
  'Colle l’adresse, puis clique sur « S’abonner ».',
];
const GOOGLE_STEPS = [
  'Sur calendar.google.com, depuis un ordinateur : « Autres agendas », « + », puis « À partir de l’URL ».',
  'Colle l’adresse, puis clique sur « Ajouter un agenda ».',
];

const GOOGLE_DELAY = 'Google Agenda peut mettre jusqu’à 24 h à afficher un changement de cours.';

// Sur Android, Chrome confie à l'appli Google Agenda tout lien vers calendar.google.com ouvert juste après un toucher
// (activation utilisateur, ~5 s) : l'appli demande « Ajouter l'agenda ? » mais n'ajoute rien. Passé ce délai, Chrome
// ouvre le site, qui abonne vraiment le compte (testé le 2026-09-30 sur émulateur, Chrome connecté à Google).
const GOOGLE_ANDROID_DELAY_SECONDS = 6;

// Bouton principal de la carte : jaune, sauf au second plan (voir AddToCalendarCard), où il est à contour.
type MainVariant = 'accent' | 'secondary';

type AddButtonProps = { children: string; variant: MainVariant; onClick: () => void; disabled?: boolean };

function AddButton({ children, variant, onClick, disabled }: AddButtonProps) {
  return (
    <Button variant={variant} className="add-to-calendar-card__add" onClick={onClick} disabled={disabled}>
      {children}
      {!disabled && <img className="add-to-calendar-card__add-icon" src={arrowUpRightUrl} alt="" width={13} height={13} />}
    </Button>
  );
}

// « Le bouton ne marche pas ? » : replié par défaut, le bouton suffit dans la plupart des cas.
// Pas de flex sur <summary> lui-même (ignoré par d'anciens Safari) : la ligne est dans un <span>.
function Help({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="add-to-calendar-card__help">
      <summary className="add-to-calendar-card__help-summary">
        <span className="add-to-calendar-card__help-row">
          {summary}
          <span className="add-to-calendar-card__chevron" aria-hidden="true">
            ›
          </span>
        </span>
      </summary>
      <div className="add-to-calendar-card__help-body">{children}</div>
    </details>
  );
}

function ManualSteps({ feedUrl, steps }: { feedUrl: string; steps: string[] }) {
  return (
    <ol className="add-to-calendar-card__steps">
      <li className="add-to-calendar-card__step">
        <div className="add-to-calendar-card__step-content">
          <p className="add-to-calendar-card__step-text">Copie l’adresse du calendrier :</p>
          <LinkField url={feedUrl} label="Copier l’adresse du calendrier" copiedMessage="Adresse copiée." />
        </div>
      </li>
      {steps.map((step) => (
        <li key={step} className="add-to-calendar-card__step">
          <p className="add-to-calendar-card__step-text">{step}</p>
        </li>
      ))}
    </ol>
  );
}

function SendLinkButton({ pageUrl, variant }: { pageUrl: string; variant: 'accent' | 'secondary' }) {
  const [message, setMessage] = useState('');
  return (
    <>
      <Button variant={variant} onClick={async () => setMessage(await shareOrCopy(pageUrl))}>
        Envoyer le lien vers mon ordinateur
      </Button>
      <p className="add-to-calendar-card__status" role="status">
        {message}
      </p>
    </>
  );
}

// Android : ouvre le site de Google Agenda dans l'onglet, après un compte à rebours (voir GOOGLE_ANDROID_DELAY_SECONDS).
function GoogleAndroidButton({ url, variant }: { url: string; variant: MainVariant }) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (secondsLeft === null) return;
    if (secondsLeft === 0) {
      window.location.href = url;
      return;
    }
    const timer = window.setTimeout(() => setSecondsLeft(secondsLeft - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft, url]);

  // Retour depuis Google Agenda : la page ressort du cache avec le compte à rebours fini, on réarme le bouton.
  useEffect(() => {
    const reset = (event: PageTransitionEvent) => {
      if (event.persisted) setSecondsLeft(null);
    };
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  if (secondsLeft === null) {
    return (
      <AddButton variant={variant} onClick={() => setSecondsLeft(GOOGLE_ANDROID_DELAY_SECONDS)}>
        Ajouter à Google Agenda
      </AddButton>
    );
  }
  return (
    <AddButton variant={variant} onClick={() => {}} disabled>
      {secondsLeft > 0 ? `Ouverture dans ${secondsLeft} s…` : 'Ouverture…'}
    </AddButton>
  );
}

type PanelProps = { feedUrl: string; pageUrl: string; variant: MainVariant };

// Apple Calendar (iPhone, iPad, Mac) s'ouvre sur l'abonnement.
function ApplePanel({ feedUrl, variant }: PanelProps) {
  const touch = isAppleTouchDevice();
  const otherDevices = touch && isPhone() ? 'ton Mac et ton iPad' : 'tes autres appareils Apple';
  return (
    <>
      <AddButton
        variant={variant}
        onClick={() => {
          window.location.href = webcalUrl(feedUrl);
        }}
      >
        Ajouter à Apple Calendar
      </AddButton>
      <p className="add-to-calendar-card__hint">
        Une seule fois : avec iCloud, il apparaît aussi sur {otherDevices}. Tes cours se mettent ensuite à jour tout
        seuls.
      </p>
      <Help summary="Le bouton ne marche pas ?">
        <ManualSteps feedUrl={feedUrl} steps={touch ? APPLE_TOUCH_STEPS : APPLE_MAC_STEPS} />
      </Help>
    </>
  );
}

function GoogleAndroidPanel({ feedUrl, pageUrl, variant }: PanelProps) {
  return (
    <>
      <GoogleAndroidButton url={googleCalendarUrl(feedUrl)} variant={variant} />
      <p className="add-to-calendar-card__hint">
        Google Agenda s’ouvre dans Chrome après quelques secondes : ne touche à rien en attendant, puis confirme
        l’ajout. Ensuite, dans l’appli Google Agenda : Paramètres, HyperICS, active « Synchroniser ».
      </p>
      <p className="add-to-calendar-card__note">{GOOGLE_DELAY}</p>
      <Help summary="Le bouton ne marche pas ?">
        <p className="add-to-calendar-card__hint">
          Si Google t’a demandé de te connecter puis a ouvert l’appli Agenda : reviens dans Chrome et recharge la
          page. Sinon, envoie-toi ce lien, ouvre-le sur un ordinateur et choisis l’onglet Google Agenda.
        </p>
        <SendLinkButton pageUrl={pageUrl} variant="secondary" />
      </Help>
    </>
  );
}

// Google Agenda hors Android : le site ouvre l'abonnement sur un ordinateur. Sur un téléphone (iPhone), ni l'appli
// ni le site mobile ne permettent d'ajouter un calendrier par son adresse : l'élève s'envoie le lien vers un
// ordinateur.
function GooglePanel({ feedUrl, pageUrl, variant }: PanelProps) {
  if (isPhone()) {
    return (
      <>
        <p className="add-to-calendar-card__hint">
          Google Agenda ne permet d’ajouter un calendrier que depuis un ordinateur. Envoie-toi ce lien, ouvre-le sur
          un ordinateur et choisis l’onglet Google Agenda : tes cours apparaîtront ensuite tout seuls sur ton
          téléphone.
        </p>
        <SendLinkButton pageUrl={pageUrl} variant={variant} />
        <p className="add-to-calendar-card__note">{GOOGLE_DELAY}</p>
        <Help summary="Ou ajoute-le à la main">
          <ManualSteps feedUrl={feedUrl} steps={GOOGLE_STEPS} />
        </Help>
      </>
    );
  }
  return (
    <>
      <AddButton variant={variant} onClick={() => window.open(googleCalendarUrl(feedUrl), '_blank', 'noopener')}>
        Ajouter à Google Agenda
      </AddButton>
      <p className="add-to-calendar-card__note">
        S’ouvre dans Google Agenda : clique sur « Ajouter ». Il apparaît ensuite sur ton téléphone. Un changement de
        cours peut mettre jusqu’à 24 h à s’afficher.
      </p>
      <Help summary="Le bouton ne marche pas ?">
        <ManualSteps feedUrl={feedUrl} steps={GOOGLE_STEPS} />
      </Help>
    </>
  );
}

// Selon l'état de la page de l'élève (voir pageStateOf, src/data/calendar-status.ts) :
// - `highlighted` : rien n'est encore ajouté, la carte est mise en avant ;
// - `secondary` : Calendrier d'Apple a lu le flux une fois, l'élève a pu annuler : la carte passe au second plan ;
// - `embedded` : dans « Ajouter sur un autre appareil », sans cadre ni titre.
type CardVariant = 'highlighted' | 'secondary' | 'embedded';

const TITLES: Record<CardVariant, string | null> = {
  highlighted: 'Ajoute-le à ton calendrier',
  secondary: 'Il n’apparaît pas ? Réessaie',
  embedded: null,
};

type AddToCalendarCardProps = {
  pageUrl: string;
  feedUrl: string;
  variant?: CardVariant;
  // Onglet ouvert d'office ; sinon, d'après l'appareil.
  initialApp?: CalendarApp;
};

// Ajout de l'abonnement à l'application de calendrier de l'élève, une application par onglet.
// Le flux se met à jour tout seul : c'est un abonnement, jamais un fichier importé une fois pour toutes.
export function AddToCalendarCard({ pageUrl, feedUrl, variant = 'highlighted', initialApp }: AddToCalendarCardProps) {
  const [app, setApp] = useState<CalendarApp>(() => initialApp ?? detectCalendarApp());
  const android = isAndroid();
  const title = TITLES[variant];
  const panel: PanelProps = { feedUrl, pageUrl, variant: variant === 'secondary' ? 'secondary' : 'accent' };

  return (
    <section className={`add-to-calendar-card add-to-calendar-card--${variant}`}>
      {title && <h2 className="add-to-calendar-card__title">{title}</h2>}
      <CalendarAppTabs value={app} onChange={setApp} />
      {app === 'apple' && <ApplePanel {...panel} />}
      {app === 'google' && android && <GoogleAndroidPanel {...panel} />}
      {app === 'google' && !android && <GooglePanel {...panel} />}
    </section>
  );
}
