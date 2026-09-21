import { AppHeader } from '../components/app-header';
import { Button } from '../components/button';
import { Stepper } from '../components/stepper';
import { StepTitle } from '../components/step-title';
import { formatTeachers, type Lesson } from '../data/lessons';
import './selection-review.css';

type SelectionReviewProps = {
  promotions: string[];
  lessons: Lesson[];
  selected: ReadonlySet<string>;
  onBack: () => void;
  onNext: () => void;
};

// Étape 3 : récapitulatif des cours retenus avant de générer le calendrier.
export function SelectionReview({ promotions, lessons, selected, onBack, onNext }: SelectionReviewProps) {
  const selectedLessons = lessons.filter((lesson) => selected.has(lesson.id));

  return (
    <div className="selection-review">
      <AppHeader onBack={onBack} />
      <Stepper total={4} current={3} />
      <StepTitle step={3}>Vérifie ta sélection</StepTitle>
      <section className="selection-review__card">
        <div className="selection-review__summary">
          <h2 className="selection-review__promotions">{promotions.join(', ')}</h2>
          <p className="selection-review__count">{selectedLessons.length} cours</p>
        </div>
        <ul className="selection-review__list">
          {selectedLessons.map((lesson) => (
            <li key={lesson.id} className="selection-review__lesson">
              <div className="selection-review__row">
                <span className="selection-review__code">{lesson.code}</span>
                {/* Seules les promotions choisies comptent : un cours commun n'a pas à les lister toutes. */}
                <span className="selection-review__detail">
                  {lesson.promotions.filter((promotion) => promotions.includes(promotion)).join(', ')}
                </span>
              </div>
              <span className="selection-review__detail">{formatTeachers(lesson.teachers)}</span>
            </li>
          ))}
        </ul>
      </section>
      <div className="selection-review__footer">
        <Button variant="accent" disabled={selectedLessons.length === 0} onClick={onNext}>
          Générer le calendrier
        </Button>
      </div>
    </div>
  );
}
