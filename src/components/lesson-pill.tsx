import type { CSSProperties } from 'react';
import './lesson-pill.css';

type LessonPillProps = {
  subject: string;
  teacher: string;
  style?: CSSProperties;
};

// Pastille blanche d'un cours, aspirée par le logo pendant la génération.
export function LessonPill({ subject, teacher, style }: LessonPillProps) {
  return (
    <div className="lesson-pill" style={style} aria-hidden="true">
      <span className="lesson-pill__subject">{subject}</span>
      <span className="lesson-pill__teacher">{teacher}</span>
    </div>
  );
}
