import { useState } from 'react';
import checkBadgeUrl from '../assets/check-badge.svg';
import { AddToCalendarCard } from '../components/add-to-calendar-card';
import { AddToHomeScreen } from '../components/add-to-home-screen';
import { AppHeader } from '../components/app-header';
import { Button } from '../components/button';
import { DeleteSubscriptionModal } from '../components/delete-subscription-modal';
import { Stepper } from '../components/stepper';
import { copyText, shareOrCopy } from '../data/share';
import './feed-ready.css';

// Le lien affiché sans « https:// » (plus lisible), copié en entier.
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

type FeedReadyProps = {
  pageUrl: string;
  feedUrl: string;
  // Page de l'élève : modifier ses cours.
  onEdit?: () => void;
  // Sélection tout juste modifiée depuis la page de l'élève.
  updated?: boolean;
  // Page de l'élève : supprimer son calendrier, après confirmation.
  onDelete?: () => Promise<void>;
};

// Dernier écran : l'abonnement est prêt, l'élève l'ajoute à son calendrier.
export function FeedReady({ pageUrl, feedUrl, onEdit, updated = false, onDelete }: FeedReadyProps) {
  const [keepMessage, setKeepMessage] = useState('');
  // Après une modification, l'ajout au calendrier est replié : l'élève l'a normalement déjà fait, et l'ajouter une
  // seconde fois doublerait ses cours. Il reste accessible pour celui qui ne l'avait pas encore fait.
  const [addRevealed, setAddRevealed] = useState(false);
  const showAdd = !updated || addRevealed;
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div className="feed-ready">
      <AppHeader onEdit={onEdit} />
      <Stepper total={4} current={4} />

      <h1 className="feed-ready__title">
        <img src={checkBadgeUrl} alt="" width={28} height={28} />
        {updated ? 'C’est à jour !' : 'C’est prêt !'}
      </h1>

      {updated && (
        <p className="feed-ready__updated">
          Rien à refaire : ton calendrier se met à jour tout seul. Selon ton application, ça peut prendre jusqu’à 24 h.
        </p>
      )}

      {!showAdd && (
        <button className="feed-ready__reveal" type="button" onClick={() => setAddRevealed(true)}>
          Tu ne l’as pas encore ajouté à ton calendrier ?
        </button>
      )}

      {showAdd && <AddToCalendarCard pageUrl={pageUrl} feedUrl={feedUrl} />}

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

      {/* Tout en bas, hors du chemin : on ne doit pas tomber dessus par erreur. */}
      {onDelete && (
        <button className="feed-ready__delete" type="button" onClick={() => setConfirmingDelete(true)}>
          Supprimer mon calendrier
        </button>
      )}
      {onDelete && confirmingDelete && (
        <DeleteSubscriptionModal onConfirm={onDelete} onClose={() => setConfirmingDelete(false)} />
      )}
    </div>
  );
}
