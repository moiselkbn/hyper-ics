// Un cours peut être commun à plusieurs promotions : la relation est plusieurs-à-plusieurs.
// Forme renvoyée par l'API (GET /api/lessons).
export type Lesson = {
  id: string;
  subject: string;
  // Absent pour les cours sans code (ateliers, réunions).
  code: string | null;
  teachers: string[];
  promotions: string[];
};

// Un prof est toujours affiché ; s'il y en a d'autres, on ajoute leur nombre (« Lemal +2 »).
export function formatTeachers(teachers: string[]): string {
  if (teachers.length <= 1) return teachers[0] ?? '';
  return `${teachers[0]} +${teachers.length - 1}`;
}

export function getLessonsOfPromotion(lessons: Lesson[], promotion: string): Lesson[] {
  return lessons.filter((lesson) => lesson.promotions.includes(promotion));
}

// Par défaut, un élève suit tous les cours de ses promotions.
export function getDefaultLessonIds(lessons: Lesson[], promotions: ReadonlySet<string>): Set<string> {
  return new Set(
    lessons.filter((lesson) => lesson.promotions.some((promotion) => promotions.has(promotion))).map((lesson) => lesson.id),
  );
}
