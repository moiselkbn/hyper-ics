import { useEffect, useState } from 'react';
import { createSubscription, fetchCurricula, fetchLessons, updateSubscription } from './api/client';
import { useRemote } from './api/use-remote';
import { StatusScreen } from './components/status-screen';
import { isPromotionDisabled, type Curriculum } from './data/curricula';
import { getDefaultLessonIds, toSubscriptionPromotions, type Lesson } from './data/lessons';
import { feedUrl, pageUrl } from './data/subscription-links';
import { ClassChoice } from './screens/class-choice';
import { FeedReady } from './screens/feed-ready';
import { Generation } from './screens/generation';
import { Landing } from './screens/landing';
import { LessonChoice } from './screens/lesson-choice';
import { SelectionReview } from './screens/selection-review';

type Screen = 'landing' | 'class-choice' | 'lesson-choice' | 'selection-review' | 'generation' | 'feed-ready';

export function App() {
  const [screen, setScreen] = useState<Screen>('landing');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [selectedLessons, setSelectedLessons] = useState<ReadonlySet<string>>(new Set());
  const [curricula, loadCurricula] = useRemote<Curriculum[]>();
  const [lessons, loadLessons] = useRemote<Lesson[]>();
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
      (savedToken) => setToken(savedToken),
    );
    setSavedSelection({ promotions: selected, lessons: selectedLessons });
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
