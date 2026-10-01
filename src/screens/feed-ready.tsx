import { useRef, useState } from 'react';
import { AccordionGroup, AccordionItem } from '../components/accordion';
import { AddToCalendarCard } from '../components/add-to-calendar-card';
import { AddToHomeScreen } from '../components/add-to-home-screen';
import { AppHeader } from '../components/app-header';
import { Banner } from '../components/banner';
import { Button } from '../components/button';
import { CalendarStatusList, NotAddedStatus, StartedStatus } from '../components/calendar-status';
import { DeleteSubscriptionModal } from '../components/delete-subscription-modal';
import { LinkField } from '../components/link-field';
import { MyLessons } from '../components/my-lessons';
import { TodayLessons } from '../components/today-lessons';
import { addedCalendars, pageStateOf, type StoredSubscription } from '../data/calendar-status';
import type { FollowedLessonsSummary } from '../data/lessons';
import { shareOrCopy } from '../data/share';
import { isAndroid, isPhone, type CalendarApp } from '../data/subscription-links';
import './feed-ready.css';

type FeedReadyProps = {
  pageUrl: string;
  feedUrl: string;
  // Abonnement relu sur le serveur : état du calendrier dans chaque application, dates.
  subscription: StoredSubscription;
  // « Mes cours » ; null pendant le chargement des cours.
  lessonsSummary: FollowedLessonsSummary | null;
  // Modifier ses cours.
  onEdit: () => void;
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

// Appareils où l'élève n'a pas encore son calendrier, selon celui qu'il tient en main.
function otherDevices() {
  if (isAndroid()) return 'Ordi, tablette… ou si rien n’apparaît';
  if (isPhone()) return 'Mac, iPad, ordi… ou si rien n’apparaît';
  return 'Téléphone, tablette… ou si rien n’apparaît';
}

// Page de l'élève (/m/<jeton>). Tant que son calendrier n'est dans aucune application, l'ajout est en haut ; une fois
// ajouté, la page sert à vérifier qu'il se met à jour, et l'ajout passe dans « Ajouter sur un autre appareil ».
export function FeedReady({
  pageUrl,
  feedUrl,
  subscription,
  lessonsSummary,
  onEdit,
  updated = false,
  createdLessonCount = null,
  onDelete,
}: FeedReadyProps) {
  const [shareMessage, setShareMessage] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // « Réajouter mon calendrier » : l'onglet de l'application qui ne se met plus à jour, dans l'accordéon déplié.
  const [reAddApp, setReAddApp] = useState<CalendarApp | null>(null);
  const addOtherRef = useRef<HTMLDetailsElement>(null);
  const { calendars, createdAt, updatedAt, today } = subscription;
  const state = pageStateOf(calendars);
  const added = addedCalendars(calendars);
  const googleAdded = added.some((calendar) => calendar.app === 'google');

  // Cours du jour et sélection. Une fois le calendrier ajouté, la page sert surtout à les vérifier et à modifier ses
  // cours : ces blocs remontent sous le statut, « Modifier mes cours » en bouton principal.
  const myLessons = (
    <>
      <TodayLessons date={today.date} lessons={today.lessons} />
      <MyLessons
        summary={lessonsSummary}
        createdAt={createdAt}
        updatedAt={updatedAt}
        prominent={state === 'connected'}
        onEdit={onEdit}
      />
    </>
  );

  function reAdd(app: CalendarApp) {
    setReAddApp(app);
    const details = addOtherRef.current;
    if (!details) return;
    details.open = true;
    // Après le rendu de la carte sur le bon onglet, qui change la hauteur de la page.
    requestAnimationFrame(() => details.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  return (
    <div className="feed-ready">
      <AppHeader />

      {updated && (
        <Banner title="C’est à jour !">
          Rien à refaire : ton calendrier se met à jour tout seul. Selon ton application, ça peut prendre jusqu’à 24 h.
        </Banner>
      )}
      {!updated && createdLessonCount !== null && <CreatedBanner lessonCount={createdLessonCount} />}

      <div className="feed-ready__hero">
        <h1 className="feed-ready__title">Ton calendrier</h1>
        {state === 'not-added' && <NotAddedStatus />}
        {state === 'started' && <StartedStatus />}
        {state === 'connected' && <CalendarStatusList calendars={added} onReAdd={reAdd} />}
        {/* Sur Android, l'appli Google Agenda décoche d'office la synchronisation d'un agenda ajouté par son adresse. */}
        {googleAdded && isAndroid() && (
          <p className="feed-ready__note">
            <strong>Pas de cours dans l’appli Google Agenda ?</strong> Paramètres → HyperICS → active « Synchroniser »
            (décoché d’office sur Android).
          </p>
        )}
        {googleAdded && (
          <p className="feed-ready__note">
            Google Agenda relit ton calendrier toutes les 8 à 24 h : un changement de dernière minute peut tarder. En cas
            de doute, Hyperplanning fait foi.
          </p>
        )}
      </div>

      {state === 'not-added' && <AddToCalendarCard pageUrl={pageUrl} feedUrl={feedUrl} />}
      {state === 'started' && <AddToCalendarCard pageUrl={pageUrl} feedUrl={feedUrl} variant="secondary" />}

      {state === 'connected' && myLessons}

      <section className="feed-ready__keep">
        <h2 className="feed-ready__keep-title">Garde ta page perso</h2>
        <p className="feed-ready__keep-text">
          Pas de compte ni de mot de passe : ce lien est ta seule clé pour revenir modifier tes cours. Perdu, il faudra
          tout recommencer : ajoute l’app à ton écran d’accueil et à tes favoris.
        </p>
        <LinkField url={pageUrl} label="Copier le lien de cette page" caption="Lien de ta page" />
        <AddToHomeScreen variant={state === 'connected' ? 'secondary' : 'primary'} />
        <Button variant="secondary" onClick={async () => setShareMessage(await shareOrCopy(pageUrl))}>
          Partager le lien
        </Button>
        <p className="feed-ready__status" role="status">
          {shareMessage}
        </p>
      </section>

      {state !== 'connected' && myLessons}

      {state === 'connected' && (
        <AccordionGroup>
          <AccordionItem ref={addOtherRef} title="Ajouter sur un autre appareil" subtitle={otherDevices()}>
            <p className="feed-ready__warning">
              <span className="feed-ready__warning-icon" aria-hidden="true">
                ⓘ
              </span>
              Déjà ajouté avec iCloud ou ton compte Google ? Il est sans doute déjà sur tes autres appareils : l’ajouter
              une deuxième fois doublerait tes cours.
            </p>
            <AddToCalendarCard
              key={reAddApp ?? 'device'}
              pageUrl={pageUrl}
              feedUrl={feedUrl}
              variant="embedded"
              initialApp={reAddApp ?? undefined}
            />
          </AccordionItem>
        </AccordionGroup>
      )}

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
