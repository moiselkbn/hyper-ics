import type { CSSProperties } from 'react';
import './lesson-pill.css';

type LessonPillProps = {
  code: string;
  teacher: string;
  style?: CSSProperties;
};

// Pastille blanche d'un cours, aspirée par le logo pendant la génération.
export function LessonPill({ code, teacher, style }: LessonPillProps) {
  return (
    <div className="lesson-pill" style={style} aria-hidden="true">
      <span className="lesson-pill__code">{code}</span>
      <span className="lesson-pill__teacher">{teacher}</span>
    </div>
  );
}
