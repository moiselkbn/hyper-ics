import type { CSSProperties } from 'react';
import chevronLeftUrl from '../assets/calendar-chevron-left.svg';
import listUrl from '../assets/calendar-list.svg';
import plusUrl from '../assets/calendar-plus.svg';
import searchUrl from '../assets/calendar-search.svg';
import { SAMPLE_LESSONS } from '../data/sample-lessons';
import { useToday } from '../hooks/use-today';
import './calendar-day-view.css';

// Heure figée à 9:41, comme sur les visuels d'Apple (seule la date suit le jour réel).
const NOW_MINUTES = 9 * 60 + 41;
// Grille d'Hyperplanning : de 8h à 21h.
const FIRST_HOUR = 8;
const LAST_HOUR = 21;
// En deçà de cet écart, le libellé d'heure est masqué par celui de la ligne « maintenant ».
const NOW_LABEL_CLEARANCE = 15;
const WEEKDAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const MONTH_FORMAT = new Intl.DateTimeFormat('fr-BE', { month: 'long' });
const WEEKDAY_FORMAT = new Intl.DateTimeFormat('fr-BE', { weekday: 'long' });
const DATE_FORMAT = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short', year: 'numeric' });

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Comme le Calendrier d'Apple : « Mardi - 29 sept. 2026 ».
function formatFullDate(date: Date) {
  return `${capitalize(WEEKDAY_FORMAT.format(date))} - ${DATE_FORMAT.format(date)}`;
}

function toMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatTime(minutes: number) {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

// Position verticale en heures depuis le haut de la grille, lue par le CSS.
function gridOffset(minutes: number) {
  return (minutes - FIRST_HOUR * 60) / 60;
}

// Semaine du lundi au dimanche contenant la date donnée.
function weekOf(date: Date) {
  const mondayIndex = (date.getDay() + 6) % 7;
  return WEEKDAY_LETTERS.map(
    (_, index) => new Date(date.getFullYear(), date.getMonth(), date.getDate() - mondayIndex + index),
  );
}

// Vue « jour » du Calendrier d'iOS, sur la date du jour, avec des cours fictifs.
export function CalendarDayView() {
  const today = useToday();
  const todayIndex = (today.getDay() + 6) % 7;
  const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, index) => (FIRST_HOUR + index) * 60);

  return (
    <div className="calendar-day-view" aria-hidden="true">
      <div className="calendar-day-view__header">
        <div className="calendar-day-view__status-bar" />
        <div className="calendar-day-view__actions">
          <span className="calendar-day-view__back">
            <img className="calendar-day-view__back-icon" src={chevronLeftUrl} alt="" />
            {capitalize(MONTH_FORMAT.format(today))}
          </span>
          <span className="calendar-day-view__icons">
            <img className="calendar-day-view__icon calendar-day-view__icon--list" src={listUrl} alt="" />
            <img className="calendar-day-view__icon calendar-day-view__icon--search" src={searchUrl} alt="" />
            <img className="calendar-day-view__icon calendar-day-view__icon--plus" src={plusUrl} alt="" />
          </span>
        </div>
        <div className="calendar-day-view__week">
          {weekOf(today).map((day, index) => (
            <div
              key={day.getTime()}
              className={
                'calendar-day-view__weekday' +
                (index >= 5 ? ' calendar-day-view__weekday--weekend' : '') +
                (index === todayIndex ? ' calendar-day-view__weekday--today' : '')
              }
            >
              <span className="calendar-day-view__weekday-letter">{WEEKDAY_LETTERS[index]}</span>
              <span className="calendar-day-view__weekday-number">{day.getDate()}</span>
            </div>
          ))}
        </div>
        <span className="calendar-day-view__date">{formatFullDate(today)}</span>
      </div>

      <div className="calendar-day-view__grid">
        {hours.map((minutes) => (
          <div key={minutes} className="calendar-day-view__hour" style={{ '--offset': gridOffset(minutes) } as CSSProperties}>
            {Math.abs(minutes - NOW_MINUTES) >= NOW_LABEL_CLEARANCE && (
              <span className="calendar-day-view__hour-label">{formatTime(minutes)}</span>
            )}
          </div>
        ))}

        {SAMPLE_LESSONS.map((lesson) => {
          const start = toMinutes(lesson.start);
          const style = {
            '--offset': gridOffset(start),
            '--duration': (toMinutes(lesson.end) - start) / 60,
          } as CSSProperties;
          return (
            <div key={lesson.start} className="calendar-day-view__event" style={style}>
              <span className="calendar-day-view__event-title">{lesson.subject}</span>
              <span className="calendar-day-view__event-details">
                <span className="calendar-day-view__event-line">
                  {lesson.room}, {lesson.teacher}
                </span>
                <span className="calendar-day-view__event-line">
                  {lesson.start} - {lesson.end}
                </span>
              </span>
            </div>
          );
        })}

        <div className="calendar-day-view__now" style={{ '--offset': gridOffset(NOW_MINUTES) } as CSSProperties}>
          <span className="calendar-day-view__now-label">{formatTime(NOW_MINUTES)}</span>
          <span className="calendar-day-view__now-dot" />
        </div>
      </div>

      <div className="calendar-day-view__footer">
        <div className="calendar-day-view__links">
          <span className="calendar-day-view__link">Aujourd'hui</span>
          <span className="calendar-day-view__link calendar-day-view__link--center">Calendriers</span>
          <span className="calendar-day-view__link">Boîte de réception</span>
        </div>
        <div className="calendar-day-view__home-bar" />
      </div>
    </div>
  );
}
