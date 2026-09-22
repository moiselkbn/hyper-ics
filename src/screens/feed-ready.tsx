import { useState } from 'react';
import arrowUpRightUrl from '../assets/arrow-up-right.svg';
import checkBadgeUrl from '../assets/check-badge.svg';
import { AddToHomeScreen } from '../components/add-to-home-screen';
import { AppHeader } from '../components/app-header';
import { Button } from '../components/button';
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
  const [isCopied, setIsCopied] = useState(false);
  const current = PLATFORMS.find((entry) => entry.id === platform) ?? PLATFORMS[0];
  const bareFeedUrl = feedUrl.replace(/^[a-z]+:\/\//i, '');

  async function copyFeedUrl() {
    await navigator.clipboard.writeText(feedUrl);
    setIsCopied(true);
  }

  function addToCalendar() {
    if (platform === 'android') {
      const webcalUrl = `webcal://${bareFeedUrl}`;
      window.open(`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl)}`, '_blank', 'noopener');
      return;
    }
    if (platform === 'desktop') {
      window.location.href = `https://${bareFeedUrl}`;
      return;
    }
    window.location.href = `webcal://${bareFeedUrl}`;
  }

  return (
    <div className="feed-ready">
      <AppHeader onBack={onBack} />

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

      <p className="feed-ready__hint">
        Voici le lien de cette page, il est unique et fait pour toi, sauvegarde le lien pour ne jamais le perdre
      </p>

      <div className="feed-ready__link">
        <div className="feed-ready__link-field">
          <span className="feed-ready__link-url">{feedUrl}</span>
          <button className="feed-ready__copy" type="button" onClick={copyFeedUrl} aria-label="Copier le lien">
            <span className="feed-ready__copy-icon" aria-hidden="true" />
          </button>
        </div>
        {/* La sauvegarde du lien sera branchée ici. */}
        <Button>Sauvegarder le lien</Button>
      </div>

      <p className="feed-ready__status" role="status">
        {isCopied ? 'Lien copié.' : ''}
      </p>

      <AddToHomeScreen />
    </div>
  );
}
