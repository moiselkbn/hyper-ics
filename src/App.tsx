import { useState } from 'react';
import { MOCK_CURRICULA } from './data/curricula';
import { ClassChoice } from './screens/class-choice';
import { Landing } from './screens/landing';

export function App() {
  const [screen, setScreen] = useState<'landing' | 'class-choice'>('landing');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  function togglePromotion(promotion: string, checked: boolean) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (checked) next.add(promotion);
      else next.delete(promotion);
      return next;
    });
  }

  if (screen === 'landing') {
    return <Landing onStart={() => setScreen('class-choice')} />;
  }

  return (
    <ClassChoice
      curricula={MOCK_CURRICULA}
      selected={selected}
      onToggle={togglePromotion}
      onNext={() => {
        // L'étape 2 (choix des cours) sera branchée ici.
      }}
    />
  );
}
