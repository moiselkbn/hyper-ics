// Un cours peut être commun à plusieurs promotions : la relation est plusieurs-à-plusieurs.
// Forme renvoyée par l'API (GET /api/lessons).
export type Lesson = {
  id: string;
  // Matière normalisée : identifie le cours dans chacune de ses promotions, même si son code change.
  key: string;
  subject: string;
  // Absent pour les cours sans code (ateliers, réunions).
  code: string | null;
  teachers: string[];
  // Sans code (atelier, réunion) : pas à choisir, toujours dans le calendrier des promotions concernées.
  mandatory: boolean;
  promotions: string[];
};

// Un ou deux profs : la liste complète (« Dupont, Sarouille »). Au-delà, le premier suivi du nombre
// des autres (« Dupont +2 »), sinon la liste devient trop longue à afficher.
export function formatTeachers(teachers: string[]): string {
  if (teachers.length <= 2) return teachers.join(', ');
  return `${teachers[0]} +${teachers.length - 1}`;
}

export function getLessonsOfPromotion(lessons: Lesson[], promotion: string): Lesson[] {
  return lessons.filter((lesson) => lesson.promotions.includes(promotion));
}

// Cours proposés au choix : les cours obligatoires n'y figurent pas.
export function getSelectableLessons(lessons: Lesson[]): Lesson[] {
  return lessons.filter((lesson) => !lesson.mandatory);
}

// Ce que l'abonnement enregistre pour une promotion (voir server/subscription.mjs).
export type SubscriptionPromotion = { label: string; checked: string[]; unchecked: string[] };

// Pour chaque promotion choisie, ses cours à choisir tels que l'élève les a laissés, désignés par leur clé.
// Mêmes groupes que l'écran de choix : un cours commun aux deux promotions figure dans les deux.
// Les cours obligatoires n'y sont pas : le serveur les met toujours dans le flux.
export function toSubscriptionPromotions(
  promotions: string[],
  lessons: Lesson[],
  selected: ReadonlySet<string>,
): SubscriptionPromotion[] {
  return promotions.map((label) => {
    const choices = getSelectableLessons(getLessonsOfPromotion(lessons, label));
    return {
      label,
      checked: choices.filter((lesson) => selected.has(lesson.id)).map((lesson) => lesson.key),
      unchecked: choices.filter((lesson) => !selected.has(lesson.id)).map((lesson) => lesson.key),
    };
  });
}

// Par défaut, un élève suit tous les cours de ses promotions, obligatoires compris.
// Ceux-ci restent sélectionnés : l'écran de choix ne les montre pas, donc ils ne peuvent pas être décochés.
export function getDefaultLessonIds(lessons: Lesson[], promotions: ReadonlySet<string>): Set<string> {
  return new Set(
    lessons.filter((lesson) => lesson.promotions.some((promotion) => promotions.has(promotion))).map((lesson) => lesson.id),
  );
}
