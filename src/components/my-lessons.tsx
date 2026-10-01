import lessonDotUrl from '../assets/lesson-dot.svg';
import { formatDay } from '../data/dates';
import type { FollowedLessonsSummary } from '../data/lessons';
import { Button } from './button';
import './my-lessons.css';

// Matières montrées avant « Voir les N cours ».
const PREVIEW_SIZE = 3;

type MyLessonsProps = {
  // null tant que les cours se chargent, ou si leur chargement a échoué : le bouton reste utilisable.
  summary: FollowedLessonsSummary | null;
  createdAt: string;
  updatedAt: string;
  // Bouton principal une fois le calendrier ajouté : la page sert alors surtout à modifier ses cours.
  prominent: boolean;
  onEdit: () => void;
};

// Les cours que suit l'élève, et l'accès à leur modification.
export function MyLessons({ summary, createdAt, updatedAt, prominent, onEdit }: MyLessonsProps) {
  const dated = updatedAt === createdAt ? 'Créé' : 'Modifié';
  return (
    <section className="my-lessons">
      <div className="my-lessons__head">
        <h2 className="my-lessons__title">Mes cours</h2>
        <p className="my-lessons__date">
          {dated} le {formatDay(new Date(updatedAt))}
        </p>
      </div>

      {summary && (
        <>
          <ul className="my-lessons__promotions">
            {summary.byPromotion.map(({ label, count }) => (
              <li key={label} className="my-lessons__chip">
                {label} · {count} cours
              </li>
            ))}
          </ul>
          <ul className="my-lessons__subjects">
            {summary.subjects.slice(0, PREVIEW_SIZE).map((subject) => (
              <li key={subject} className="my-lessons__subject">
                <img src={lessonDotUrl} alt="" width={6} height={6} />
                {subject}
              </li>
            ))}
          </ul>
          {/* Destination pas encore décidée : affiché, sans action pour l'instant. */}
          {summary.total > PREVIEW_SIZE && (
            <p className="my-lessons__all">
              Voir les {summary.total} cours
              <span className="my-lessons__chevron" aria-hidden="true">
                ›
              </span>
            </p>
          )}
        </>
      )}

      <Button variant={prominent ? 'accent' : 'secondary'} onClick={onEdit}>
        Modifier mes cours
      </Button>
    </section>
  );
}
