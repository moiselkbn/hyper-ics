import { useState } from 'react';
import { isPromotionDisabled, MOCK_CURRICULA } from './data/curricula';
import { getDefaultLessonIds, MOCK_LESSONS } from './data/lessons';
import { ClassChoice } from './screens/class-choice';
import { FeedReady } from './screens/feed-ready';
import { Generation } from './screens/generation';
import { Landing } from './screens/landing';
import { LessonChoice } from './screens/lesson-choice';
import { SelectionReview } from './screens/selection-review';

// Le jeton du flux n'est pas encore généré : URL factice en attendant.
const MOCK_FEED_URL = 'hyperics.app/f/njifbzibfueifbzuii';

export function App() {
  const [screen, setScreen] = useState<
    'landing' | 'class-choice' | 'lesson-choice' | 'selection-review' | 'generation' | 'feed-ready'
  >('landing');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [selectedLessons, setSelectedLessons] = useState<ReadonlySet<string>>(new Set());

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
    return (
      <ClassChoice
        curricula={MOCK_CURRICULA}
        selected={selected}
        onToggle={togglePromotion}
        onNext={() => {
          // Préréglage : tous les cours des promotions choisies.
          setSelectedLessons(getDefaultLessonIds(MOCK_LESSONS, selected));
          setScreen('lesson-choice');
        }}
      />
    );
  }

  if (screen === 'lesson-choice') {
    return (
      <LessonChoice
        promotions={[...selected]}
        lessons={MOCK_LESSONS}
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
        lessons={MOCK_LESSONS}
        selected={selectedLessons}
        onBack={() => setScreen('lesson-choice')}
        onNext={() => setScreen('generation')}
      />
    );
  }

  if (screen === 'generation') {
    return (
      <Generation
        promotions={[...selected]}
        lessons={MOCK_LESSONS}
        selected={selectedLessons}
        onNext={() => setScreen('feed-ready')}
      />
    );
  }

  return <FeedReady feedUrl={MOCK_FEED_URL} onBack={() => setScreen('generation')} />;
}
