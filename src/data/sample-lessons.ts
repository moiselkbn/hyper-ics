// Cours fictifs affichés chaque jour dans le calendrier de la Landing Page (salles et profs inventés).
export type SampleLesson = {
  subject: string;
  room: string;
  teacher: string;
  // Heures au format « HH:MM », sur la grille de 30 min d'Hyperplanning.
  start: string;
  end: string;
};

export const SAMPLE_LESSONS: SampleLesson[] = [
  { subject: 'Anglais', room: 'L342', teacher: 'Peeters', start: '09:00', end: '11:00' },
  { subject: 'Typographie', room: 'L215', teacher: 'Lambert', start: '11:30', end: '13:00' },
  { subject: 'Développement web', room: 'L108', teacher: 'Maes', start: '14:00', end: '16:30' },
];
