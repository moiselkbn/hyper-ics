import { useState } from 'react';
import arrowUpRightUrl from '../assets/arrow-up-right.svg';
import checkBadgeUrl from '../assets/check-badge.svg';
import { AddToHomeScreen } from '../components/add-to-home-screen';
import { AppHeader } from '../components/app-header';
import { Button } from '../components/button';
import { Stepper } from '../components/stepper';
import {
  detectCalendarApp,
  googleCalendarUrl,
  isAppleTouchDevice,
  isPhone,
  outlookUrl,
  webcalUrl,
  type CalendarApp,
} from '../data/subscription-links';
import './feed-ready.css';

// Un onglet par application de calendrier, pas par appareil : le lien Apple est le même sur iPhone, iPad et Mac.
// Seul l'onglet Apple est dans la maquette : Google et Outlook en reprennent le style.
const CALENDAR_APPS: { id: CalendarApp; label: string }[] = [
  { id: 'apple', label: 'Apple' },
  { id: 'google', label: 'Google' },
  { id: 'outlook', label: 'Outlook' },
];

// Ajout à la main, selon l'appareil Apple.
const APPLE_TOUCH_STEPS =
  'Vérifie que Calendrier a accès aux données cellulaires (Réglages → Données cellulaires → Calendrier), ou réessaie en Wi-Fi. Sinon, ajoute-le à la main : dans l’app Calendrier, touche « Calendriers », puis « Ajouter un calendrier » et « Ajouter un calendrier avec abonnement », et colle cette adresse :';
const APPLE_MAC_STEPS =
  'Ajoute-le à la main : dans Calendrier, menu « Fichier », puis « Nouvel abonnement à un calendrier… », et colle cette adresse :';
const GOOGLE_STEPS =
  'Sur calendar.google.com, depuis un ordinateur : « Autres agendas », « + », puis « À partir de l’URL », et colle cette adresse. S’il n’apparaît pas ensuite sur ton téléphone : appli Google Agenda, Paramètres, HyperICS, active « Synchroniser ».';
const OUTLOOK_STEPS =
  'Sur outlook.com, depuis un ordinateur : « Ajouter un calendrier », puis « S’abonner à partir du web », et colle cette adresse.';

const COPIED = 'Lien copié.';
const COPY_FAILED = 'Impossible de copier, sélectionne le lien à la main.';

async function copyText(text: string): Promise<string> {
  try {
    await navigator.clipboard.writeText(text);
    return COPIED;
  } catch {
    return COPY_FAILED;
  }
}

// Sur mobile, ouvre la feuille de partage native (Messages, Mail, WhatsApp…) ; sans support (la plupart
// des navigateurs desktop), on retombe sur la copie. Renvoie le message à afficher, ou '' si partagé ou annulé.
async function shareOrCopy(url: string): Promise<string> {
  if (!navigator.share) return copyText(url);
  try {
    await navigator.share({ url, title: 'Mon calendrier HyperICS' });
  } catch {
    // Annulé par l'élève : rien à faire.
  }
  return '';
}

// Le lien affiché sans « https:// » (plus lisible), copié en entier.
function LinkField({ url, label, onCopied }: { url: string; label: string; onCopied: (message: string) => void }) {
  return (
    <div className="feed-ready__link-field">
      <span className="feed-ready__link-url">{url.replace(/^https?:\/\//, '')}</span>
      <button className="feed-ready__copy" type="button" onClick={async () => onCopied(await copyText(url))} aria-label={label}>
        <span className="feed-ready__copy-icon" aria-hidden="true" />
      </button>
    </div>
  );
}

function Status({ message }: { message: string }) {
  return (
    <p className={message ? 'feed-ready__status feed-ready__status--visible' : 'feed-ready__status'} role="status">
      {message}
    </p>
  );
}

function AddButton({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <Button className="feed-ready__add" onClick={onClick}>
      {children}
      <img className="feed-ready__add-icon" src={arrowUpRightUrl} alt="" width={13} height={13} />
    </Button>
  );
}

// Adresse du flux à coller à la main, quand le bouton ne convient pas.
function ManualSubscription({ summary, steps, feedUrl }: { summary: string; steps: string; feedUrl: string }) {
  const [message, setMessage] = useState('');
  return (
    <details className="feed-ready__help">
      <summary className="feed-ready__help-summary">{summary}</summary>
      <div className="feed-ready__help-body">
        <p className="feed-ready__hint">{steps}</p>
        <LinkField url={feedUrl} label="Copier l’adresse du calendrier" onCopied={setMessage} />
        <Status message={message} />
      </div>
    </details>
  );
}

// Google Agenda et Outlook n'acceptent un abonnement par adresse que sur leur site, depuis un ordinateur :
// sur un téléphone, on propose d'envoyer le lien de cette page vers un ordinateur.
function SendToComputer({ appName, tabLabel, pageUrl }: { appName: string; tabLabel: string; pageUrl: string }) {
  const [message, setMessage] = useState('');
  return (
    <>
      <p className="feed-ready__hint">
        {appName} ne permet d’ajouter un calendrier que depuis un ordinateur. Envoie-toi ce lien, ouvre-le sur un
        ordinateur et choisis l’onglet <strong>{tabLabel}</strong> : tes cours apparaîtront ensuite tout seuls sur ton
        téléphone.
      </p>
      <Button onClick={async () => setMessage(await shareOrCopy(pageUrl))}>Envoyer le lien vers mon ordinateur</Button>
      <Status message={message} />
    </>
  );
}

type FeedReadyProps = {
  pageUrl: string;
  feedUrl: string;
  // Absent quand la page est rouverte depuis son lien : il n'y a pas de sélection en cours à retrouver.
  onBack?: () => void;
};

// Dernier écran : l'abonnement est prêt, l'élève l'ajoute à son calendrier.
// Le flux se met à jour tout seul : c'est un abonnement, jamais un fichier importé une fois pour toutes.
export function FeedReady({ pageUrl, feedUrl, onBack }: FeedReadyProps) {
  const [app, setApp] = useState<CalendarApp>(() => detectCalendarApp());
  const [keepMessage, setKeepMessage] = useState('');
  const phone = isPhone();
  // Sur un téléphone, le lien direct vers Google Agenda ou Outlook ne marche pas : la marche à suivre devient l'action principale.
  const webSummary = phone ? 'Ou ajoute-le à la main' : 'Le bouton ne marche pas ?';

  // Apple Calendar (iPhone, iPad, Mac) s'ouvre sur l'abonnement ; Google et Outlook dans un nouvel onglet.
  const addToAppleCalendar = () => {
    window.location.href = webcalUrl(feedUrl);
  };
  const openInNewTab = (url: string) => window.open(url, '_blank', 'noopener');

  return (
    <div className="feed-ready">
      <AppHeader onBack={onBack} />
      <Stepper total={4} current={4} />

      <h1 className="feed-ready__title">
        <img src={checkBadgeUrl} alt="" width={28} height={28} />
        C’est prêt !
      </h1>

      <div className="feed-ready__apps">
        {CALENDAR_APPS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={entry.id === app ? 'feed-ready__app feed-ready__app--active' : 'feed-ready__app'}
            aria-pressed={entry.id === app}
            onClick={() => setApp(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {app === 'apple' && (
        <div className="feed-ready__panel">
          <AddButton onClick={addToAppleCalendar}>Ajouter à Apple Calendar</AddButton>
          <p className="feed-ready__hint">
            Ajoute-le une seule fois : avec iCloud, il apparaît aussi sur tes autres appareils Apple.
          </p>
          <ManualSubscription
            summary="Le bouton ne marche pas ?"
            steps={isAppleTouchDevice() ? APPLE_TOUCH_STEPS : APPLE_MAC_STEPS}
            feedUrl={feedUrl}
          />
        </div>
      )}

      {app === 'google' && (
        <div className="feed-ready__panel">
          {phone ? (
            <SendToComputer appName="Google Agenda" tabLabel="Google" pageUrl={pageUrl} />
          ) : (
            <AddButton onClick={() => openInNewTab(googleCalendarUrl(feedUrl))}>Ajouter à Google Agenda</AddButton>
          )}
          <p className="feed-ready__hint">Google Agenda peut mettre jusqu’à 24 h à afficher un changement de cours.</p>
          <ManualSubscription summary={webSummary} steps={GOOGLE_STEPS} feedUrl={feedUrl} />
        </div>
      )}

      {app === 'outlook' && (
        <div className="feed-ready__panel">
          {phone ? (
            <SendToComputer appName="Outlook" tabLabel="Outlook" pageUrl={pageUrl} />
          ) : (
            <AddButton onClick={() => openInNewTab(outlookUrl(feedUrl))}>Ajouter à Outlook</AddButton>
          )}
          <ManualSubscription summary={webSummary} steps={OUTLOOK_STEPS} feedUrl={feedUrl} />
        </div>
      )}

      <div className="feed-ready__keep">
        <p className="feed-ready__keep-title">Ne perds pas cette page</p>
        <p className="feed-ready__keep-text">
          Ce lien unique est ta seule façon de revenir ici pour changer tes cours plus
          tard. Si tu le perds, il faudra tout recommencer.</p>
          <p className="feed-ready__keep-text">Conseil : <strong>pense à l'ajouter dans ton écran d'accueil </strong>ou tes favoris pour y accéder facilement.</p>

        <LinkField url={pageUrl} label="Copier le lien de cette page" onCopied={setKeepMessage} />
        <Status message={keepMessage} />

        <div className="feed-ready__keep-actions">
          <Button onClick={async () => setKeepMessage(await shareOrCopy(pageUrl))}>Partager le lien</Button>
          <AddToHomeScreen />
        </div>
      </div>
    </div>
  );
}
