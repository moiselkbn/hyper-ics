import { useState } from 'react';
import { AddToCalendarCard } from '../components/add-to-calendar-card';
import { AddToHomeScreen } from '../components/add-to-home-screen';
import { AppHeader } from '../components/app-header';
import { Banner } from '../components/banner';
import { Button } from '../components/button';
import { DeleteSubscriptionModal } from '../components/delete-subscription-modal';
import { LinkField } from '../components/link-field';
import { shareOrCopy } from '../data/share';
import './feed-ready.css';

type FeedReadyProps = {
  pageUrl: string;
  feedUrl: string;
  // Page de l'élève : modifier ses cours.
  onEdit?: () => void;
  // Sélection tout juste modifiée depuis la page de l'élève.
  updated?: boolean;
  // Calendrier tout juste créé : son nombre de cours, annoncé une seule fois (voir takeCreatedLessonCount).
  createdLessonCount?: number | null;
  // Page de l'élève : supprimer son calendrier, après confirmation.
  onDelete?: () => Promise<void>;
};

function CreatedBanner({ lessonCount }: { lessonCount: number }) {
  return (
    <Banner title="C’est prêt !">
      {lessonCount > 0 ? `Ton horaire de ${lessonCount} cours a bien été généré.` : 'Ton calendrier a bien été créé.'}
    </Banner>
  );
}

// Page de l'élève (/m/<jeton>) : il y ajoute son calendrier à son application, garde le lien de la page pour y
// revenir, et peut supprimer son calendrier.
export function FeedReady({ pageUrl, feedUrl, onEdit, updated = false, createdLessonCount = null, onDelete }: FeedReadyProps) {
  const [shareMessage, setShareMessage] = useState('');
  // Après une modification, l'ajout au calendrier est replié : l'élève l'a normalement déjà fait, et l'ajouter une
  // seconde fois doublerait ses cours. Il reste accessible pour celui qui ne l'avait pas encore fait.
  const [addRevealed, setAddRevealed] = useState(false);
  const showAdd = !updated || addRevealed;
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div className="feed-ready">
      <AppHeader onEdit={onEdit} />

      {updated && (
        <Banner title="C’est à jour !">
          Rien à refaire : ton calendrier se met à jour tout seul. Selon ton application, ça peut prendre jusqu’à 24 h.
        </Banner>
      )}
      {!updated && createdLessonCount !== null && <CreatedBanner lessonCount={createdLessonCount} />}

      <h1 className="feed-ready__title">Ton calendrier</h1>

      {!showAdd && (
        <button className="feed-ready__reveal" type="button" onClick={() => setAddRevealed(true)}>
          Tu ne l’as pas encore ajouté à ton calendrier ?
        </button>
      )}

      {showAdd && <AddToCalendarCard pageUrl={pageUrl} feedUrl={feedUrl} />}

      <section className="feed-ready__keep">
        <h2 className="feed-ready__keep-title">Garde ta page perso</h2>
        <p className="feed-ready__keep-text">
          Pas de compte ni de mot de passe : ce lien est ta seule clé pour revenir modifier tes cours. Perdu, il faudra
          tout recommencer : ajoute l’app à ton écran d’accueil et à tes favoris.
        </p>
        <LinkField url={pageUrl} label="Copier le lien de cette page" caption="Lien de ta page" />
        <AddToHomeScreen />
        <Button variant="secondary" onClick={async () => setShareMessage(await shareOrCopy(pageUrl))}>
          Partager le lien
        </Button>
        <p className="feed-ready__status" role="status">
          {shareMessage}
        </p>
      </section>

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
