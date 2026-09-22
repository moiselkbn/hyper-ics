import { useState } from 'react';
import arrowUpRightUrl from '../assets/arrow-up-right.svg';
import checkBadgeUrl from '../assets/check-badge.svg';
import { AddToHomeScreen } from '../components/add-to-home-screen';
import { AppHeader } from '../components/app-header';
import { Button } from '../components/button';
import { Stepper } from '../components/stepper';
import './feed-ready.css';

// Seule la variante iOS est dans la maquette : le visuel des deux autres
// reste à confirmer, la logique d'ajout est branchée pour les trois.
const PLATFORMS = [
  { id: 'ios', label: 'iOS', action: 'Ajouter à Apple Calendar' },
  { id: 'android', label: 'Android', action: 'Ajouter à Google Agenda' },
  { id: 'desktop', label: 'Mac/PC', action: 'Télécharger le fichier .ics' },
] as const;

type FeedReadyProps = {
  feedUrl: string;
  onBack: () => void;
};

// Dernier écran : le flux est prêt, l'élève l'ajoute à son calendrier.
export function FeedReady({ feedUrl, onBack }: FeedReadyProps) {
  const [platform, setPlatform] = useState<string>(PLATFORMS[0].id);
  const [statusMessage, setStatusMessage] = useState('');
  const current = PLATFORMS.find((entry) => entry.id === platform) ?? PLATFORMS[0];
  const bareFeedUrl = feedUrl.replace(/^[a-z]+:\/\//i, '');

  async function copyFeedUrl() {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setStatusMessage('Lien copié.');
    } catch {
      setStatusMessage('Impossible de copier, sélectionne le lien à la main.');
    }
  }

  // Sur mobile, ouvre la feuille de partage native (Messages, Notes, Fichiers…) ;
  // sans support (la plupart des navigateurs desktop), on retombe sur la copie.
  async function shareFeedUrl() {
    if (navigator.share) {
      try {
        await navigator.share({ url: feedUrl, title: 'Mon flux HyperICS' });
      } catch {
        // Annulé par l'élève : rien à faire.
      }
      return;
    }
    await copyFeedUrl();
  }

  function addToCalendar() {
    if (platform === 'android') {
      const webcalUrl = `webcal://${bareFeedUrl}`;
      window.open(`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl)}`, '_blank', 'noopener');
      return;
    }
    // iOS traduit webcal:// en http:// en interne, puis ne suit pas la redirection http→https
    // imposée par Vercel (bug connu, contrairement à macOS qui la suit) : Safari en https direct
    // évite cette étape et propose quand même l'abonnement natif, grâce au Content-Type ICS.
    window.location.href = `https://${bareFeedUrl}`;
  }

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

      <Button className="feed-ready__add" onClick={addToCalendar}>
        {current.action}
        <img className="feed-ready__add-icon" src={arrowUpRightUrl} alt="" width={13} height={13} />
      </Button>

      <div className="feed-ready__keep">
        <p className="feed-ready__keep-title">Ne perds pas cette page</p>
        <p className="feed-ready__keep-text">
          Ce lien unique est ta seule façon de revenir ici pour changer tes cours plus
          tard. Si tu le perds, il faudra tout recommencer.</p>
          <p className="feed-ready__keep-text">Conseil : <strong>pense à l'ajouter dans ton écran d'accueil </strong>ou tes favoris pour y accéder facilement.</p>
        

        <div className="feed-ready__link-field">
          <span className="feed-ready__link-url">{feedUrl}</span>
          <button className="feed-ready__copy" type="button" onClick={copyFeedUrl} aria-label="Copier le lien">
            <span className="feed-ready__copy-icon" aria-hidden="true" />
          </button>
        </div>

        <p
          className={statusMessage ? 'feed-ready__status feed-ready__status--visible' : 'feed-ready__status'}
          role="status"
        >
          {statusMessage}
        </p>

        <div className="feed-ready__keep-actions">
          <Button onClick={shareFeedUrl}>Partager le lien</Button>
          <AddToHomeScreen />
        </div>
      </div>
    </div>
  );
}
