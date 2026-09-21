import { useEffect, useState, type CSSProperties } from 'react';
import logoGlyphUrl from '../assets/logo-glyph.svg';
import { AppHeader } from '../components/app-header';
import { Button } from '../components/button';
import { CalendarItem } from '../components/calendar-item';
import { LessonPill } from '../components/lesson-pill';
import { formatTeachers, type Lesson } from '../data/lessons';
import './generation.css';

// Doit rester aligné sur --generation-loop dans generation.css.
const LOOP_DURATION_MS = 7000;

// Position de départ de chaque pastille, par rapport au centre du logo.
// Le reste du trajet vient des keyframes de generation.css.
const PILL_SLOTS = [
  { modifier: 'first', style: { '--from-x': '79.5px', '--from-y': '-131px' } },
  { modifier: 'second', style: { '--from-x': '-106.5px', '--from-y': '-162px' } },
  { modifier: 'third', style: { '--from-x': '46.5px', '--from-y': '-225px' } },
] as const;

// Salle et horaire sont illustratifs : le scrap ne les fournit pas encore.
const SAMPLE_SLOTS = [
  { room: 'L520', time: '10:00 – 12:00' },
  { room: 'L302', time: '13:00 – 15:00' },
  { room: 'L114', time: '15:00 – 17:00' },
];

type GenerationProps = {
  promotions: string[];
  lessons: Lesson[];
  selected: ReadonlySet<string>;
  onNext: () => void;
};

// Étape 4 : le calendrier se construit, l'animation tourne en boucle.
export function Generation({ promotions, lessons, selected, onNext }: GenerationProps) {
  const [isReady, setIsReady] = useState(false);
  const featured = lessons.filter((lesson) => selected.has(lesson.id)).slice(0, PILL_SLOTS.length);

  // Le bouton n'apparaît qu'une fois la première boucle terminée.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIsReady(true);
      return;
    }
    const timer = window.setTimeout(() => setIsReady(true), LOOP_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="generation">
      <AppHeader />
      <h1 className="generation__title">Génération du calendrier</h1>

      <div className="generation__stage">
        {featured.map((lesson, index) => (
          <div
            key={lesson.id}
            className={`generation__pill generation__pill--${PILL_SLOTS[index].modifier}`}
            style={PILL_SLOTS[index].style as CSSProperties}
          >
            <div className="generation__pill-path">
              <LessonPill subject={lesson.subject} teacher={formatTeachers(lesson.teachers)} />
            </div>
          </div>
        ))}

        <div className="generation__logo">
          <img className="generation__logo-glyph" src={logoGlyphUrl} alt="" />
        </div>

        <div className="generation__calendar">
          {featured.map((lesson, index) => (
            <CalendarItem
              key={lesson.id}
              // Un cours commun appartient à plusieurs promotions : on montre celle de l'élève.
              title={`${lesson.subject} (${lesson.promotions.find((promotion) => promotions.includes(promotion))})`}
              room={SAMPLE_SLOTS[index].room}
              time={SAMPLE_SLOTS[index].time}
              style={{ '--calendar-delay': `${index * 0.12}s` } as CSSProperties}
            />
          ))}
        </div>
      </div>

      {/* Annonce l'état aux lecteurs d'écran, que l'animation ne porte pas. */}
      <p className="generation__status" role="status">
        {isReady ? 'Calendrier prêt.' : 'Génération du calendrier en cours…'}
      </p>

      <div className="generation__footer">{isReady && <Button onClick={onNext}>Suivant</Button>}</div>
    </div>
  );
}
