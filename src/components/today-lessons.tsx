import { useEffect, useState } from 'react';
import type { TodayLesson } from '../data/calendar-status';
import { brusselsNow, formatDay, fromIsoDay } from '../data/dates';
import { formatTeachers } from '../data/lessons';
import './today-lessons.css';

// « En cours » se met à jour chaque minute, la page pouvant rester ouverte.
const CLOCK_TICK_MS = 60_000;

function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

// « W204, Lemal » : salle(s) puis prof(s), comme le lieu des événements du flux (server/ics.mjs).
function placeOf({ rooms, teachers }: TodayLesson): string {
  return [...rooms, ...(teachers.length > 0 ? [formatTeachers(teachers)] : [])].join(', ');
}

type TodayLessonsProps = {
  // Jour des cours à Bruxelles, « AAAA-MM-JJ » (voir lessonsOfDay, server/today.mjs).
  date: string;
  lessons: TodayLesson[];
};

// Les cours du jour de l'élève : de quoi vérifier d'un coup d'œil que son calendrier est juste.
export function TodayLessons({ date, lessons }: TodayLessonsProps) {
  const now = brusselsNow(useNow());
  // Un cours en cours seulement le jour même : la page a pu rester ouverte jusqu'au lendemain.
  const isCurrent = (lesson: TodayLesson) => now.day === date && lesson.start <= now.time && now.time < lesson.end;

  return (
    <section className="today-lessons">
      <div className="today-lessons__head">
        <h2 className="today-lessons__title">Aujourd’hui</h2>
        <p className="today-lessons__date">{formatDay(fromIsoDay(date), { weekday: true })}</p>
      </div>

      {lessons.length === 0 ? (
        <p className="today-lessons__empty">Pas de cours aujourd’hui.</p>
      ) : (
        <ul className="today-lessons__list">
          {lessons.map((lesson) => {
            const current = isCurrent(lesson);
            const place = placeOf(lesson);
            return (
              <li
                key={`${lesson.start}|${lesson.subject}`}
                className={current ? 'today-lessons__lesson today-lessons__lesson--current' : 'today-lessons__lesson'}
              >
                <p className="today-lessons__time">
                  <span className="today-lessons__start">{lesson.start}</span>
                  <span className="today-lessons__end">{lesson.end}</span>
                </p>
                <span className="today-lessons__bar" aria-hidden="true" />
                <div className="today-lessons__info">
                  <p className="today-lessons__subject">{lesson.subject}</p>
                  {place && <p className="today-lessons__place">{place}</p>}
                </div>
                {current && <span className="today-lessons__tag">En cours</span>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
