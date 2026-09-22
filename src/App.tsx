import { useEffect, useState } from 'react';
import { createFeed, fetchCurricula, fetchLessons } from './api/client';
import { useRemote } from './api/use-remote';
import { StatusScreen } from './components/status-screen';
import { isPromotionDisabled, type Curriculum } from './data/curricula';
import { getDefaultLessonIds, type Lesson } from './data/lessons';
import { ClassChoice } from './screens/class-choice';
import { FeedReady } from './screens/feed-ready';
import { Generation } from './screens/generation';
import { Landing } from './screens/landing';
import { LessonChoice } from './screens/lesson-choice';
import { SelectionReview } from './screens/selection-review';

export function App() {
  const [screen, setScreen] = useState<
    'landing' | 'class-choice' | 'lesson-choice' | 'selection-review' | 'generation' | 'feed-ready'
  >('landing');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [selectedLessons, setSelectedLessons] = useState<ReadonlySet<string>>(new Set());
  const [curricula, loadCurricula] = useRemote<Curriculum[]>();
  const [lessons, loadLessons] = useRemote<Lesson[]>();
  const [feed, loadFeed] = useRemote<string>();

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

  // Lancé dès l'entrée dans l'écran de génération : le jeton est prêt pendant que son animation tourne.
  function requestFeed() {
    loadFeed((signal) => createFeed([...selected], [...selectedLessons], signal));
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

  // Les écrans suivants ne s'ouvrent qu'après le chargement des cours.
  const loadedLessons = lessons.status === 'ready' ? lessons.data : [];

  if (screen === 'selection-review') {
    return (
      <SelectionReview
        promotions={[...selected]}
        lessons={loadedLessons}
        selected={selectedLessons}
        onBack={() => setScreen('lesson-choice')}
        onNext={() => {
          requestFeed();
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

  if (feed.status !== 'ready') {
    return <StatusScreen status={feed.status} onRetry={requestFeed} onBack={() => setScreen('generation')} />;
  }
  return <FeedReady feedUrl={`${window.location.origin}/api/feed?token=${feed.data}`} onBack={() => setScreen('generation')} />;
}
