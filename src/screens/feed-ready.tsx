import { useState } from 'react';
import arrowUpRightUrl from '../assets/arrow-up-right.svg';
import checkBadgeUrl from '../assets/check-badge.svg';
import { AddToHomeScreen } from '../components/add-to-home-screen';
import { AppHeader } from '../components/app-header';
import { Button } from '../components/button';
import { Stepper } from '../components/stepper';
import { detectPlatform, googleCalendarUrl, outlookUrl, webcalUrl, type Platform } from '../data/subscription-links';
import './feed-ready.css';

// Seule la variante iOS est dans la maquette : Android et Mac/PC en reprennent le style.
const PLATFORMS: { id: Platform; label: string }[] = [
  { id: 'ios', label: 'iOS' },
  { id: 'android', label: 'Android' },
  { id: 'desktop', label: 'Mac/PC' },
];

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

type FeedReadyProps = {
  pageUrl: string;
  feedUrl: string;
  // Absent quand la page est rouverte depuis son lien : il n'y a pas de sélection en cours à retrouver.
  onBack?: () => void;
};

// Dernier écran : l'abonnement est prêt, l'élève l'ajoute à son calendrier.
// Le flux se met à jour tout seul : c'est un abonnement, jamais un fichier importé une fois pour toutes.
export function FeedReady({ pageUrl, feedUrl, onBack }: FeedReadyProps) {
  const [platform, setPlatform] = useState<Platform>(() => detectPlatform());
  const [shareMessage, setShareMessage] = useState('');
  const [keepMessage, setKeepMessage] = useState('');

  // Apple Calendar (iOS, macOS) s'ouvre sur l'abonnement ; Google et Outlook dans un nouvel onglet.
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

      <div className="feed-ready__platforms">
        {PLATFORMS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={
              entry.id === platform ? 'feed-ready__platform feed-ready__platform--active' : 'feed-ready__platform'
            }
            aria-pressed={entry.id === platform}
            onClick={() => setPlatform(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {platform === 'ios' && (
        <div className="feed-ready__panel">
          <AddButton onClick={addToAppleCalendar}>Ajouter à Apple Calendar</AddButton>
          <ManualSubscription
            summary="Le bouton ne marche pas ?"
            steps="Ajoute-le à la main : dans l’app Calendrier, touche « Calendriers », puis « Ajouter un calendrier » et « Ajouter un calendrier avec abonnement », et colle cette adresse :"
            feedUrl={feedUrl}
          />
        </div>
      )}

      {platform === 'android' && (
        <div className="feed-ready__panel">
          <p className="feed-ready__hint">
            Google Agenda ne permet d’ajouter un calendrier que depuis un ordinateur. Envoie-toi ce lien, ouvre-le sur
            un ordinateur et choisis <strong>Mac/PC → Google Agenda</strong> : tes cours apparaîtront ensuite tout seuls
            sur ton téléphone.
          </p>
          <Button onClick={async () => setShareMessage(await shareOrCopy(pageUrl))}>Envoyer le lien vers mon ordinateur</Button>
          <Status message={shareMessage} />
          <ManualSubscription
            summary="Ou ajoute-le à la main"
            steps="Sur calendar.google.com, depuis un ordinateur : « Autres agendas », « + », puis « À partir de l’URL », et colle cette adresse. S’il n’apparaît pas ensuite sur ton téléphone : appli Google Agenda, Paramètres, HyperICS, active « Synchroniser »."
            feedUrl={feedUrl}
          />
        </div>
      )}

      {platform === 'desktop' && (
        <div className="feed-ready__panel">
          <AddButton onClick={addToAppleCalendar}>Ajouter à Apple Calendar</AddButton>
          <AddButton onClick={() => openInNewTab(googleCalendarUrl(feedUrl))}>Ajouter à Google Agenda</AddButton>
          <AddButton onClick={() => openInNewTab(outlookUrl(feedUrl))}>Ajouter à Outlook</AddButton>
          <ManualSubscription
            summary="Une autre application de calendrier ?"
            steps="Cherche l’option « S’abonner à un calendrier » (ou « Ajouter depuis une URL ») et colle cette adresse :"
            feedUrl={feedUrl}
          />
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
