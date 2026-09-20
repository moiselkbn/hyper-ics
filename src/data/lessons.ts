import { MOCK_CURRICULA } from './curricula';

// Un cours peut être commun à plusieurs promotions : la relation est plusieurs-à-plusieurs.
export type Lesson = {
  id: string;
  code: string;
  teacher: string;
  promotions: string[];
};

const MOCK_TEACHERS = ['Lemal', 'Dupont', 'Martin', 'Leroy'];
const MOCK_LESSONS_PER_PROMOTION = 5;

const ALL_PROMOTIONS = MOCK_CURRICULA.flatMap((curriculum) => curriculum.promotions);

// Cours factices : ils viendront de l'API (schedule-index).
export const MOCK_LESSONS: Lesson[] = [
  { id: 'common-english', code: 'Anglais', teacher: 'Martin', promotions: ALL_PROMOTIONS },
  ...ALL_PROMOTIONS.flatMap((promotion) =>
    Array.from({ length: MOCK_LESSONS_PER_PROMOTION }, (_, index) => ({
      id: `${promotion}-${index + 1}`,
      code: `${promotion} C${index + 1}`,
      teacher: MOCK_TEACHERS[index % MOCK_TEACHERS.length],
      promotions: [promotion],
    })),
  ),
];

export function getLessonsOfPromotion(lessons: Lesson[], promotion: string): Lesson[] {
  return lessons.filter((lesson) => lesson.promotions.includes(promotion));
}

// Par défaut, un élève suit tous les cours de ses promotions.
export function getDefaultLessonIds(lessons: Lesson[], promotions: ReadonlySet<string>): Set<string> {
  return new Set(
    lessons.filter((lesson) => lesson.promotions.some((promotion) => promotions.has(promotion))).map((lesson) => lesson.id),
  );
}
