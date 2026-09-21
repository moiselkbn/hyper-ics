import { formatTeachers, type Lesson } from '../data/lessons';
import { CheckboxRow } from './checkbox-row';
import './lesson-group.css';

type LessonGroupProps = {
  promotion: string;
  lessons: Lesson[];
  selected: ReadonlySet<string>;
  onToggle: (lessonId: string, checked: boolean) => void;
  onToggleAll: (lessonIds: string[], checked: boolean) => void;
};

// Cours d'une promotion, avec « Tout cocher » et « Tout décocher ».
export function LessonGroup({ promotion, lessons, selected, onToggle, onToggleAll }: LessonGroupProps) {
  const lessonIds = lessons.map((lesson) => lesson.id);
  const allChecked = lessons.every((lesson) => selected.has(lesson.id));

  return (
    <section className="lesson-group">
      <div className="lesson-group__header">
        <h2 className="lesson-group__name">
          <span
            className={allChecked ? 'lesson-group__marker lesson-group__marker--checked' : 'lesson-group__marker'}
            aria-hidden="true"
          />
          {promotion}
        </h2>
        <div className="lesson-group__actions">
          <button className="lesson-group__action" type="button" onClick={() => onToggleAll(lessonIds, true)}>
            Tout cocher
          </button>
          <button className="lesson-group__action" type="button" onClick={() => onToggleAll(lessonIds, false)}>
            Tout décocher
          </button>
        </div>
      </div>
      <div className="lesson-group__list">
        {lessons.map((lesson) => (
          <CheckboxRow
            key={lesson.id}
            label={lesson.code}
            detail={formatTeachers(lesson.teachers)}
            checked={selected.has(lesson.id)}
            onChange={(checked) => onToggle(lesson.id, checked)}
          />
        ))}
      </div>
    </section>
  );
}
