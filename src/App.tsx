import { useCallback, useEffect, useState } from 'react';
import { createSubscription, fetchCurricula, fetchLessons, subscriptionExists, updateSubscription } from './api/client';
import { useRemote } from './api/use-remote';
import { StatusScreen } from './components/status-screen';
import { isPromotionDisabled, type Curriculum } from './data/curricula';
import { getDefaultLessonIds, toSubscriptionPromotions, type Lesson } from './data/lessons';
import { feedUrl, leavePage, pageTokenOf, pageUrl, showPage } from './data/subscription-links';
import { ClassChoice } from './screens/class-choice';
import { FeedReady } from './screens/feed-ready';
import { Generation } from './screens/generation';
import { Landing } from './screens/landing';
import { LessonChoice } from './screens/lesson-choice';
import { SelectionReview } from './screens/selection-review';

type Screen = 'landing' | 'class-choice' | 'lesson-choice' | 'selection-review' | 'generation' | 'feed-ready' | 'page';

export function App() {
  // Page de l'élève (/m/<jeton>) ouverte depuis son lien : elle mène droit à son calendrier.
  const [openedToken] = useState(() => pageTokenOf(window.location.pathname));
  const [screen, setScreen] = useState<Screen>(openedToken ? 'page' : 'landing');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [selectedLessons, setSelectedLessons] = useState<ReadonlySet<string>>(new Set());
  const [curricula, loadCurricula] = useRemote<Curriculum[]>();
  const [lessons, loadLessons] = useRemote<Lesson[]>();
  const [opened, loadOpened] = useRemote<boolean>();
  const [saved, loadSaved] = useRemote<string>();
  // Jeton de l'abonnement créé pendant cette visite. Il survit à un échec d'enregistrement : la tentative
  // suivante met à jour ce même abonnement au lieu d'en créer un second, que l'élève aurait pu ajouter en double.
  const [token, setToken] = useState<string | null>(null);
  // Sélection enregistrée dans l'abonnement : au retour sur le récapitulatif, sert à savoir si l'élève a changé
  // d'avis (comparaison par référence, les deux Set ne changent que via un toggle).
  const [savedSelection, setSavedSelection] = useState<{
    promotions: ReadonlySet<string>;
    lessons: ReadonlySet<string>;
  } | null>(null);

  // Les écrans après le choix des cours ne s'ouvrent qu'une fois ceux-ci chargés.
  const loadedLessons = lessons.status === 'ready' ? lessons.data : [];

  // Les promotions se chargent dès l'accueil : elles sont prêtes quand l'élève arrive à l'étape 1.
  useEffect(() => {
    loadCurricula(fetchCurricula);
  }, [loadCurricula]);

  // Avant d'afficher les liens d'une page ouverte depuis son lien, on vérifie que l'abonnement existe.
  const requestOpened = useCallback(() => {
    if (!openedToken) return;
    loadOpened(
      (signal) => subscriptionExists(openedToken, signal),
      (exists) => {
        if (exists) showPage(openedToken);
      },
    );
  }, [openedToken, loadOpened]);

  useEffect(requestOpened, [requestOpened]);

  function requestLessons() {
    loadLessons(
      (signal) => fetchLessons([...selected], signal),
      // Préréglage : tous les cours des promotions choisies.
      (data) => setSelectedLessons(getDefaultLessonIds(data, selected)),
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
    setSavedSelection({ promotions: selected, lessons: selectedLessons });
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
    return <FeedReady pageUrl={pageUrl(openedToken)} feedUrl={feedUrl(openedToken)} />;
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
        onBack={() => setScreen('lesson-choice')}
        onNext={() => {
          // Sélection inchangée depuis le dernier enregistrement : inutile de rejouer l'animation.
          const unchanged =
            saved.status === 'ready' &&
            savedSelection !== null &&
            savedSelection.promotions === selected &&
            savedSelection.lessons === selectedLessons;
          if (unchanged) {
            setScreen('feed-ready');
            return;
          }
          requestSave();
          setScreen('generation');
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
  return (
    <FeedReady
      pageUrl={pageUrl(saved.data)}
      feedUrl={feedUrl(saved.data)}
      onBack={() => setScreen('selection-review')}
    />
  );
}
