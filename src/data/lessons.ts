// Un cours peut être commun à plusieurs promotions : la relation est plusieurs-à-plusieurs.
// Forme renvoyée par l'API (GET /api/lessons).
export type Lesson = {
  id: string;
  subject: string;
  // Absent pour les cours sans code (ateliers, réunions).
  code: string | null;
  teachers: string[];
  // Sans code (atelier, réunion) : pas à choisir, toujours dans le calendrier des promotions concernées.
  mandatory: boolean;
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

// Cours proposés au choix : les cours obligatoires n'y figurent pas.
export function getSelectableLessons(lessons: Lesson[]): Lesson[] {
  return lessons.filter((lesson) => !lesson.mandatory);
}

// Par défaut, un élève suit tous les cours de ses promotions, obligatoires compris.
// Ceux-ci restent sélectionnés : l'écran de choix ne les montre pas, donc ils ne peuvent pas être décochés.
export function getDefaultLessonIds(lessons: Lesson[], promotions: ReadonlySet<string>): Set<string> {
  return new Set(
    lessons.filter((lesson) => lesson.promotions.some((promotion) => promotions.has(promotion))).map((lesson) => lesson.id),
  );
}
