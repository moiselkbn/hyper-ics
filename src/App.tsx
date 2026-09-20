import { useState } from 'react';
import { isPromotionDisabled, MOCK_CURRICULA } from './data/curricula';
import { getDefaultLessonIds, MOCK_LESSONS } from './data/lessons';
import { ClassChoice } from './screens/class-choice';
import { Generation } from './screens/generation';
import { Landing } from './screens/landing';
import { LessonChoice } from './screens/lesson-choice';
import { SelectionReview } from './screens/selection-review';

export function App() {
  const [screen, setScreen] = useState<
    'landing' | 'class-choice' | 'lesson-choice' | 'selection-review' | 'generation'
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

  return (
    <Generation
      promotions={[...selected]}
      lessons={MOCK_LESSONS}
      selected={selectedLessons}
      onNext={() => {
        // L'écran du lien ICS sera branché ici.
      }}
    />
  );
}
