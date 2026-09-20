// Lancer avec : node --test scraper/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCourses, parseDate, parseWeeks, slotToTime } from './parse-schedule.mjs';

test('parseWeeks développe les plages', () => {
  assert.deepEqual(parseWeeks('[2..6,10..14]'), [2, 3, 4, 5, 6, 10, 11, 12, 13, 14]);
  assert.deepEqual(parseWeeks('[9]'), [9]);
});

test('parseDate convertit en ISO', () => {
  assert.equal(parseDate('14/09/2026'), '2026-09-14');
});

test('slotToTime part de 08:00 par pas de 30 min', () => {
  assert.equal(slotToTime(0), '08:00');
  assert.equal(slotToTime(1), '08:30');
  assert.equal(slotToTime(26), '21:00');
});

// Données fictives : aucune donnée réelle n'est commitée.
test('parseCourses décode position, durée, code et genres', () => {
  const raw = [{
    p: 28, // mardi (26 + 2) -> 09:00
    d: 6, // 3 h
    dom: '[1..6]',
    listeC: [
      { G: 14, C: [{ L: '<PROMO X>ABCD-101' }] },
      { G: 0, C: { L: 'Cours fictif Q1' } },
      { G: 1, C: [{ L: 'Dupont' }, { L: 'Martin' }] },
      { G: 3, C: [{ L: 'L101' }] },
      { G: 5, C: {} },
    ],
  }];
  assert.deepEqual(parseCourses(raw), [{
    code: 'ABCD-101',
    promotion: 'PROMO X',
    subject: 'Cours fictif Q1',
    teachers: ['Dupont', 'Martin'],
    rooms: ['L101'],
    note: null,
    day: 1,
    start: '09:00',
    end: '12:00',
    weeks: [1, 2, 3, 4, 5, 6],
  }]);
});

test('parseCourses accepte un créneau sans code', () => {
  const raw = [{ p: 2, d: 6, dom: '[1]', listeC: [{ G: 0, C: { L: 'Réunion' } }, { G: 5, C: { str: 'Message' } }] }];
  const [course] = parseCourses(raw);
  assert.equal(course.code, null);
  assert.equal(course.note, 'Message');
});
