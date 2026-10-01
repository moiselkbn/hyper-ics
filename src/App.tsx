import { useCallback, useEffect, useState } from 'react';
import {
  createSubscription,
  deleteSubscription,
  fetchCurricula,
  fetchLessons,
  fetchSubscription,
  updateSubscription,
} from './api/client';
import { useRemote } from './api/use-remote';
import { StatusScreen } from './components/status-screen';
import type { StoredSubscription } from './data/calendar-status';
import { isPromotionDisabled, type Curriculum } from './data/curricula';
import {
  getDefaultLessonIds,
  getFollowedLessonIds,
  toSubscriptionPromotions,
  type Lesson,
  type StoredPromotion,
} from './data/lessons';
import {
  feedUrl,
  leavePage,
  openPage,
  pageTokenOf,
  pageUrl,
  showPage,
  takeCreatedLessonCount,
} from './data/subscription-links';
import { ClassChoice } from './screens/class-choice';
import { FeedReady } from './screens/feed-ready';
import { Generation } from './screens/generation';
import { Landing } from './screens/landing';
import { LessonChoice } from './screens/lesson-choice';
import { SelectionReview } from './screens/selection-review';
import { SubscriptionDeleted } from './screens/subscription-deleted';

// Calendrier tout juste créé : nombre de cours à annoncer sur sa page, lu une seule fois au chargement (hors du
// composant, que React peut rendre deux fois en développement).
const CREATED_LESSON_COUNT = takeCreatedLessonCount();

type Screen =
  | 'landing'
  | 'class-choice'
  | 'lesson-choice'
  | 'selection-review'
  | 'generation'
  | 'feed-ready'
  | 'page'
  | 'deleted';

export function App() {
  // Page de l'élève (/m/<jeton>) ouverte depuis son lien : elle mène droit à son calendrier.
  const [openedToken] = useState(() => pageTokenOf(window.location.pathname));
  const [screen, setScreen] = useState<Screen>(openedToken ? 'page' : 'landing');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [selectedLessons, setSelectedLessons] = useState<ReadonlySet<string>>(new Set());
  const [curricula, loadCurricula] = useRemote<Curriculum[]>();
  const [lessons, loadLessons] = useRemote<Lesson[]>();
  // Sélection enregistrée de la page ouverte depuis son lien, et état du calendrier dans chaque application ; null si
  // le lien ne correspond à aucun abonnement.
  const [opened, loadOpened] = useRemote<StoredSubscription | null>();
  const [saved, loadSaved] = useRemote<string>();
  // Jeton de l'abonnement créé pendant cette visite, ou de celui que l'élève modifie depuis sa page. Il survit à un
  // échec d'enregistrement : la tentative suivante met à jour ce même abonnement au lieu d'en créer un second, que
  // l'élève aurait pu ajouter en double.
  const [token, setToken] = useState<string | null>(null);

  // Les écrans après le choix des cours ne s'ouvrent qu'une fois ceux-ci chargés.
  const loadedLessons = lessons.status === 'ready' ? lessons.data : [];
  // L'élève modifie, depuis sa page, un abonnement qui existe déjà (voir requestEdit).
  const editing = openedToken !== null && token === openedToken;

  // Les promotions se chargent dès l'accueil : elles sont prêtes quand l'élève arrive à l'étape 1.
  useEffect(() => {
    loadCurricula(fetchCurricula);
  }, [loadCurricula]);

  // Avant d'afficher les liens d'une page ouverte depuis son lien, on vérifie que l'abonnement existe.
  const requestOpened = useCallback(() => {
    if (!openedToken) return;
    loadOpened(
      (signal) => fetchSubscription(openedToken, signal),
      (stored) => {
        if (stored) showPage(openedToken);
      },
    );
  }, [openedToken, loadOpened]);

  useEffect(requestOpened, [requestOpened]);

  // Retour dans l'onglet, par exemple après l'ajout dans l'application de calendrier : l'état du calendrier est relu,
  // sans écran de chargement. Seulement sur la page de l'élève : ailleurs, une relecture interromprait celle que
  // lance « Modifier ».
  const onPage = screen === 'page' || (screen === 'feed-ready' && editing);
  const canRefresh = openedToken !== null && onPage && opened.status === 'ready';
  useEffect(() => {
    if (!canRefresh || !openedToken) return;
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      loadOpened((signal) => fetchSubscription(openedToken, signal), undefined, { silent: true });
    };
    // Android : retour depuis Google Agenda ouvert dans l'onglet, la page ressort du cache du navigateur.
    const refreshFromCache = (event: PageTransitionEvent) => {
      if (event.persisted) refresh();
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('pageshow', refreshFromCache);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('pageshow', refreshFromCache);
    };
  }, [canRefresh, openedToken, loadOpened]);

  // Calendrier créé : sa page est rechargée pour de vrai (voir openPage), l'élève y arrive directement.
  useEffect(() => {
    if (screen === 'feed-ready' && !editing && saved.status === 'ready') openPage(saved.data, selectedLessons.size);
  }, [screen, editing, saved, selectedLessons]);

  // Cours des promotions choisies, cochés d'après la sélection enregistrée en modification ; sinon préréglage,
  // tous les cours des promotions choisies.
  function loadLessonsOf(promotions: ReadonlySet<string>, stored: StoredPromotion[] | null) {
    loadLessons(
      (signal) => fetchLessons([...promotions], signal),
      (data) =>
        setSelectedLessons(stored ? getFollowedLessonIds(data, promotions, stored) : getDefaultLessonIds(data, promotions)),
    );
  }

  function requestLessons() {
    loadLessonsOf(selected, editing && opened.status === 'ready' ? (opened.data?.promotions ?? null) : null);
  }

  // « Modifier », depuis la page de l'élève : sa sélection est relue sur le serveur (elle a pu changer depuis un
  // autre appareil), puis recochée. Son jeton est repris : la validation mettra à jour ce même abonnement, sous le
  // même lien, au lieu d'en créer un second qu'il aurait en double dans son calendrier.
  function requestEdit() {
    if (!openedToken) return;
    setScreen('page');
    loadOpened(
      (signal) => fetchSubscription(openedToken, signal),
      (stored) => {
        if (!stored) return;
        const promotions = new Set(stored.promotions.map((entry) => entry.label));
        setToken(openedToken);
        setSelected(promotions);
        // Toutes ses promotions sont sorties du périmètre depuis : il en choisit d'autres.
        if (promotions.size === 0) {
          setScreen('class-choice');
          return;
        }
        loadLessonsOf(promotions, stored.promotions);
        setScreen('lesson-choice');
      },
    );
  }

  // Lancé dès l'entrée dans l'écran de génération : l'abonnement est prêt pendant que l'animation tourne.
  function requestSave() {
    const promotions = toSubscriptionPromotions([...selected], loadedLessons, selectedLessons);
    const current = token;
    loadSaved(
      (signal) =>
        current
          ? updateSubscription(current, promotions, signal).then(() => current)
          : createSubscription(promotions, signal),
      (savedToken) => {
        setToken(savedToken);
        showPage(savedToken);
      },
    );
  }

  // « Supprimer mon calendrier », confirmé dans la fenêtre (qui affiche l'attente et l'échec). Ensuite, plus rien ne
  // renvoie à cet abonnement : l'adresse redevient celle de l'accueil, et un nouveau calendrier sera créé, pas
  // mis à jour.
  async function requestDelete() {
    if (!openedToken) return;
    await deleteSubscription(openedToken, new AbortController().signal);
    leavePage();
    setToken(null);
    setSelected(new Set());
    setSelectedLessons(new Set());
    setScreen('deleted');
  }

  // Lien inconnu : retour à l'accueil pour créer un calendrier.
  function startOver() {
    leavePage();
    setScreen('landing');
  }

  function togglePromotion(promotion: string, checked: boolean) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (checked && !isPromotionDisabled(promotion, previous)) next.add(promotion);
      else next.delete(promotion);
      return next;
    });
  }

  function toggleLessons(lessonIds: string[], checked: boolean) {
    setSelectedLessons((previous) => {
      const next = new Set(previous);
      for (const lessonId of lessonIds) {
        if (checked) next.add(lessonId);
        else next.delete(lessonId);
      }
      return next;
    });
  }

  if (screen === 'page' && openedToken) {
    if (opened.status !== 'ready') return <StatusScreen status={opened.status} onRetry={requestOpened} />;
    if (!opened.data) {
      return (
        <StatusScreen
          status="error"
          message="Ce lien ne correspond à aucun calendrier. Vérifie qu’il a été copié en entier."
          actionLabel="Créer mon calendrier"
          onRetry={startOver}
        />
      );
    }
    return (
      <FeedReady
        pageUrl={pageUrl(openedToken)}
        feedUrl={feedUrl(openedToken)}
        calendars={opened.data.calendars}
        onEdit={requestEdit}
        onDelete={requestDelete}
        createdLessonCount={CREATED_LESSON_COUNT}
      />
    );
  }

  if (screen === 'deleted') {
    return <SubscriptionDeleted onRestart={() => setScreen('landing')} />;
  }

  if (screen === 'landing') {
    return <Landing onStart={() => setScreen('class-choice')} />;
  }

  if (screen === 'class-choice') {
    if (curricula.status !== 'ready') {
      return <StatusScreen status={curricula.status} onRetry={() => loadCurricula(fetchCurricula)} />;
    }
    return (
      <ClassChoice
        curricula={curricula.data}
        selected={selected}
        onToggle={togglePromotion}
        onBack={editing ? () => setScreen('page') : undefined}
        onNext={() => {
          requestLessons();
          setScreen('lesson-choice');
        }}
      />
    );
  }

  if (screen === 'lesson-choice') {
    if (lessons.status !== 'ready') {
      return <StatusScreen status={lessons.status} onRetry={requestLessons} onBack={() => setScreen('class-choice')} />;
    }
    return (
      <LessonChoice
        promotions={[...selected]}
        lessons={lessons.data}
        selected={selectedLessons}
        onToggle={(lessonId, checked) => toggleLessons([lessonId], checked)}
        onToggleAll={toggleLessons}
        onBack={() => setScreen('class-choice')}
        onNext={() => setScreen('selection-review')}
      />
    );
  }

  if (screen === 'selection-review') {
    return (
      <SelectionReview
        promotions={[...selected]}
        lessons={loadedLessons}
        selected={selectedLessons}
        editing={editing}
        onBack={() => setScreen('lesson-choice')}
        onNext={() => {
          requestSave();
          // Un calendrier qui existe déjà est seulement mis à jour : pas d'animation de génération.
          setScreen(editing ? 'feed-ready' : 'generation');
        }}
      />
    );
  }

  if (screen === 'generation') {
    return (
      <Generation
        promotions={[...selected]}
        lessons={loadedLessons}
        selected={selectedLessons}
        onNext={() => setScreen('feed-ready')}
      />
    );
  }

  if (saved.status !== 'ready') {
    return <StatusScreen status={saved.status} onRetry={requestSave} onBack={() => setScreen('selection-review')} />;
  }
  // Modification enregistrée : l'élève retrouve sa page, avec la confirmation.
  if (editing) {
    return (
      <FeedReady
        pageUrl={pageUrl(saved.data)}
        feedUrl={feedUrl(saved.data)}
        calendars={opened.status === 'ready' && opened.data ? opened.data.calendars : []}
        onEdit={requestEdit}
        onDelete={requestDelete}
        updated
      />
    );
  }
  // Création : attente du rechargement sur la page de l'élève (voir l'effet plus haut).
  return <StatusScreen status="loading" onRetry={() => openPage(saved.data, selectedLessons.size)} />;
}
