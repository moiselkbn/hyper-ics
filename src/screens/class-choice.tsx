import { AppHeader } from '../components/app-header';
import { Button } from '../components/button';
import { CurriculumGroup } from '../components/curriculum-group';
import { Stepper } from '../components/stepper';
import { StepTitle } from '../components/step-title';
import { isPromotionDisabled, type Curriculum } from '../data/curricula';
import './class-choice.css';

type ClassChoiceProps = {
  curricula: Curriculum[];
  selected: ReadonlySet<string>;
  onToggle: (promotion: string, checked: boolean) => void;
  onNext: () => void;
};

// Étape 1 : choix des promotions suivies (deux années différentes au maximum, décret paysage).
export function ClassChoice({ curricula, selected, onToggle, onNext }: ClassChoiceProps) {
  return (
    <div className="class-choice">
      <AppHeader />
      <Stepper total={4} current={1} />
      <StepTitle step={1}>Dans quelles classes es-tu ?</StepTitle>
      <div className="class-choice__curricula">
        {curricula.map((curriculum) => (
          <CurriculumGroup
            key={curriculum.id}
            curriculum={curriculum}
            selected={selected}
            isDisabled={(promotion) => isPromotionDisabled(promotion, selected)}
            onToggle={onToggle}
          />
        ))}
      </div>
      <div className="class-choice__footer">
        <Button disabled={selected.size === 0} onClick={onNext}>
          Suivant
        </Button>
      </div>
    </div>
  );
}
