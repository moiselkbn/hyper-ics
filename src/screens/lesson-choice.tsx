import { AppHeader } from '../components/app-header';
import { Button } from '../components/button';
import { LessonGroup } from '../components/lesson-group';
import { Stepper } from '../components/stepper';
import { StepTitle } from '../components/step-title';
import { getLessonsOfPromotion, type Lesson } from '../data/lessons';
import './lesson-choice.css';

type LessonChoiceProps = {
  promotions: string[];
  lessons: Lesson[];
  selected: ReadonlySet<string>;
  onToggle: (lessonId: string, checked: boolean) => void;
  onToggleAll: (lessonIds: string[], checked: boolean) => void;
  onBack: () => void;
  onNext: () => void;
};

// Étape 2 : choix des cours suivis, préréglé sur les cours des promotions de l'étape 1.
export function LessonChoice({ promotions, lessons, selected, onToggle, onToggleAll, onBack, onNext }: LessonChoiceProps) {
  return (
    <div className="lesson-choice">
      <AppHeader onBack={onBack} />
      <Stepper total={4} current={2} />
      <StepTitle step={2}>Quels cours suis-tu ?</StepTitle>
      <div className="lesson-choice__groups">
        {promotions.map((promotion) => (
          <LessonGroup
            key={promotion}
            promotion={promotion}
            lessons={getLessonsOfPromotion(lessons, promotion)}
            selected={selected}
            onToggle={onToggle}
            onToggleAll={onToggleAll}
          />
        ))}
      </div>
      <div className="lesson-choice__footer">
        <Button disabled={selected.size === 0} onClick={onNext}>
          Valider ma sélection
        </Button>
      </div>
    </div>
  );
}
