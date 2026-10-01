// Lancer avec : node --test server/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { courseKey } from '../shared/course-key.mjs';
import { buildDetailedLessons } from './lessons.mjs';
import { brusselsDate, lessonsOfDay } from './today.mjs';

// Un créneau tel que l'écrit le scrap (voir lessons.test.mjs pour le même fixture).
const slot = ({ subject, code = null, teachers = [], rooms = [], day = 0, start = '09:00', end = '11:00', weeks = [1], roomsByWeek }) => ({
  code,
  subject,
  teachers,
  rooms,
  ...(roomsByWeek && { roomsByWeek }),
  note: null,
  day,
  start,
  end,
  weeks,
  key: courseKey(subject),
});

const record = (promotion, courses) => ({ promotion, firstMonday: '2026-09-14', scrapedAt: '2026-09-21T10:00:00.000Z', courses });

test('brusselsDate donne la date à Bruxelles, pas celle d’UTC', () => {
  // 0 h 30 à Bruxelles (UTC+2 en septembre), encore la veille en UTC.
  assert.equal(brusselsDate(new Date('2026-09-28T22:30:00Z')), '2026-09-29');
  assert.equal(brusselsDate(new Date('2026-09-29T21:59:00Z')), '2026-09-29');
  // Heure d'hiver (UTC+1).
  assert.equal(brusselsDate(new Date('2026-12-01T23:30:00Z')), '2026-12-02');
});

test('lessonsOfDay : les cours de la date seulement, par heure de début, salle et profs de l’occurrence', () => {
  const lessons = buildDetailedLessons([
    record('3TI Web', [
      slot({ subject: 'Réseaux', code: 'R', day: 1, start: '13:00', end: '15:00', weeks: [3], teachers: ['Leroy'], rooms: ['W110'] }),
      slot({ subject: 'Projet web', code: 'P', day: 1, start: '09:00', end: '10:30', weeks: [3], teachers: ['Lemal', 'Dupont'] }),
      // Autre semaine, autre jour : pas ce mardi.
      slot({ subject: 'Anglais', code: 'A', day: 1, weeks: [2] }),
      slot({ subject: 'Design', code: 'D', day: 2, weeks: [3] }),
      // Salle changée en cours d'année : celle de la semaine 3.
      slot({ subject: 'Typographie', code: 'T', day: 1, start: '15:00', end: '17:00', weeks: [2, 3], rooms: ['W1', 'W2'], roomsByWeek: { 2: ['W1'], 3: ['W2'] } }),
    ]),
  ]);
  // Mardi 29 septembre 2026 : semaine 3, jour 1.
  assert.deepEqual(lessonsOfDay(lessons, '2026-09-14', '2026-09-29', false), [
    { subject: 'Projet web', start: '09:00', end: '10:30', rooms: [], teachers: ['Lemal', 'Dupont'] },
    { subject: 'Réseaux', start: '13:00', end: '15:00', rooms: ['W110'], teachers: ['Leroy'] },
    { subject: 'Typographie', start: '15:00', end: '17:00', rooms: ['W2'], teachers: [] },
  ]);
});

test('lessonsOfDay précise la promotion d’un élève en chevauchement, comme son flux', () => {
  const lessons = buildDetailedLessons([record('2TI Web', [slot({ subject: 'Anglais Q3', code: 'TLAE-302' })])]);
  assert.deepEqual(
    lessonsOfDay(lessons, '2026-09-14', '2026-09-14', true).map((lesson) => lesson.subject),
    ['Anglais Q3 (2TI Web)'],
  );
});

test('lessonsOfDay : rien avant la semaine 1, sans planning ni le week-end sans cours', () => {
  const lessons = buildDetailedLessons([record('1AT', [slot({ subject: 'Tissage', day: 0, weeks: [1, 2] })])]);
  assert.deepEqual(lessonsOfDay(lessons, '2026-09-14', '2026-09-07', false), []);
  assert.deepEqual(lessonsOfDay(lessons, null, '2026-09-14', false), []);
  assert.deepEqual(lessonsOfDay(lessons, '2026-09-14', '2026-09-19', false), []);
  assert.equal(lessonsOfDay(lessons, '2026-09-14', '2026-09-21', false).length, 1);
});
