// Lancer avec : node --test scraper/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RESOLUTION_MAX_AGE_MS, resolveAmbiguousRooms } from './resolve-rooms.mjs';

const rawWith = ({ dom, rooms, code = 'TLAE-501', subject = 'Anglais Q5', day = 0, start = '10:00', end = '12:00' }) => ({
  ListeCours: [{
    p: day * 26 + 4, // 10:00
    d: 4, // 2 h
    dom,
    listeC: [
      { G: 14, C: [{ L: `<3TI Web>${code}` }] },
      { G: 0, C: { L: subject } },
      { G: 3, C: rooms.map((L) => ({ L })) },
    ],
  }],
});

const course = (overrides) => ({
  code: 'TLAE-501',
  subject: 'Anglais Q5',
  day: 0,
  start: '10:00',
  end: '12:00',
  rooms: ['L320', 'L316'],
  weeks: [2, 3, 4, 5, 6, 10, 11, 12, 13, 14],
  ...overrides,
});

test('un cours à salle unique traverse sans requête supplémentaire', async () => {
  const single = course({ rooms: ['L520'] });
  const { courses: resolved } = await resolveAmbiguousRooms(() => { throw new Error('ne doit pas être appelé'); }, [single]);
  assert.deepEqual(resolved, [single]);
});

test('un cours ambigu sur une seule semaine traverse sans requête (deux salles en même temps, légitime)', async () => {
  const simultaneous = course({ weeks: [9] });
  const { courses: resolved } = await resolveAmbiguousRooms(() => { throw new Error('ne doit pas être appelé'); }, [simultaneous]);
  assert.deepEqual(resolved, [simultaneous]);
});

test('résout la salle exacte par semaine quand le changement coïncide avec le partage en deux', async () => {
  const calls = [];
  const fetchRawWeeks = async (weeksRange) => {
    calls.push(weeksRange);
    if (weeksRange === '2..6') return rawWith({ dom: '[2..6]', rooms: ['L320'] });
    if (weeksRange === '10..14') return rawWith({ dom: '[10..14]', rooms: ['L316'] });
    throw new Error(`plage inattendue : ${weeksRange}`);
  };
  const { courses: [resolved] } = await resolveAmbiguousRooms(fetchRawWeeks, [course()]);
  assert.deepEqual(calls, ['2..6', '10..14']); // une seule subdivision : pas de requête semaine par semaine
  assert.deepEqual(resolved.roomsByWeek, {
    2: ['L320'], 3: ['L320'], 4: ['L320'], 5: ['L320'], 6: ['L320'],
    10: ['L316'], 11: ['L316'], 12: ['L316'], 13: ['L316'], 14: ['L316'],
  });
});

test('subdivise davantage tant que la sous-plage reste ambiguë', async () => {
  // Changement de salle au milieu d'une moitié : L320 sur [2..4], L316 sur [5,6].
  const calls = [];
  const fetchRawWeeks = async (weeksRange) => {
    calls.push(weeksRange);
    if (weeksRange === '2..6') return rawWith({ dom: '[2..6]', rooms: ['L320', 'L316'] });
    if (weeksRange === '10..14') return rawWith({ dom: '[10..14]', rooms: ['L316'] });
    if (weeksRange === '2..4') return rawWith({ dom: '[2..4]', rooms: ['L320'] });
    if (weeksRange === '5..6') return rawWith({ dom: '[5..6]', rooms: ['L316'] });
    throw new Error(`plage inattendue : ${weeksRange}`);
  };
  const { courses: [resolved] } = await resolveAmbiguousRooms(fetchRawWeeks, [course()]);
  assert.deepEqual(resolved.roomsByWeek, {
    2: ['L320'], 3: ['L320'], 4: ['L320'], 5: ['L316'], 6: ['L316'],
    10: ['L316'], 11: ['L316'], 12: ['L316'], 13: ['L316'], 14: ['L316'],
  });
});

test('semaine introuvable dans la sous-plage : aucune salle plutôt qu’une salle inventée', async () => {
  const fetchRawWeeks = async (weeksRange) => {
    if (weeksRange === '2..6') return rawWith({ dom: '[2..6]', rooms: ['L320'] });
    if (weeksRange === '10..14') return { ListeCours: [] };
    throw new Error(`plage inattendue : ${weeksRange}`);
  };
  const { courses: [resolved] } = await resolveAmbiguousRooms(fetchRawWeeks, [course()]);
  assert.deepEqual(resolved.roomsByWeek[10], []);
  assert.deepEqual(resolved.roomsByWeek[2], ['L320']);
});

test('ne confond pas deux cours au même horaire mais de code différent', async () => {
  const fetchRawWeeks = async (weeksRange) => {
    // Renvoie toujours les deux cours, à charge pour resolveAmbiguousRooms de ne prendre que le sien.
    return {
      ListeCours: [
        ...rawWith({ dom: `[${weeksRange}]`, rooms: ['L320'] }).ListeCours,
        ...rawWith({ dom: `[${weeksRange}]`, rooms: ['L1'], code: 'AUTRE-1', subject: 'Autre cours' }).ListeCours,
      ],
    };
  };
  const { courses: [resolvedAnglais] } = await resolveAmbiguousRooms(fetchRawWeeks, [course({ weeks: [2, 3] })]);
  assert.deepEqual(resolvedAnglais.roomsByWeek, { 2: ['L320'], 3: ['L320'] });
});

// --- Coût des requêtes : reprise du scrap précédent, plages demandées une seule fois, échéance.

const NOW = new Date('2026-09-24T10:00:00.000Z');
const HOUR = 60 * 60 * 1000;
const RESOLVED_WEEKS = {
  2: ['L320'], 3: ['L320'], 4: ['L320'], 5: ['L320'], 6: ['L320'],
  10: ['L316'], 11: ['L316'], 12: ['L316'], 13: ['L316'], 14: ['L316'],
};
// Répond à la première subdivision de `course()` : L320 avant, L316 après.
const splitAtFirstLevel = (calls) => async (weeksRange) => {
  calls.push(weeksRange);
  if (weeksRange === '2..6') return rawWith({ dom: '[2..6]', rooms: ['L320'] });
  if (weeksRange === '10..14') return rawWith({ dom: '[10..14]', rooms: ['L316'] });
  throw new Error(`plage inattendue : ${weeksRange}`);
};
const noRequest = () => { throw new Error('ne doit pas être appelé'); };

test('une résolution fraîche du scrap précédent est reprise sans aucune requête', async () => {
  const previous = [course({ roomsByWeek: RESOLVED_WEEKS, roomsResolvedAt: new Date(NOW - HOUR).toISOString() })];
  const result = await resolveAmbiguousRooms(noRequest, [course()], { previous, now: NOW });
  assert.deepEqual(result.courses[0].roomsByWeek, RESOLVED_WEEKS);
  assert.deepEqual([result.reused, result.resolved, result.deferred], [1, 0, 0]);
});

test('une résolution trop ancienne est refaite et datée du scrap en cours', async () => {
  const calls = [];
  const stale = new Date(NOW - RESOLUTION_MAX_AGE_MS - HOUR).toISOString();
  const previous = [course({ roomsByWeek: { 2: ['L316'] }, roomsResolvedAt: stale })];
  const result = await resolveAmbiguousRooms(splitAtFirstLevel(calls), [course()], { previous, now: NOW });
  assert.deepEqual(calls, ['2..6', '10..14']);
  assert.deepEqual(result.courses[0].roomsByWeek, RESOLVED_WEEKS);
  assert.equal(result.courses[0].roomsResolvedAt, NOW.toISOString());
  assert.equal(result.resolved, 1);
});

test('un créneau dont les salles ou les semaines ont changé est résolu à nouveau', async () => {
  const recent = new Date(NOW - HOUR).toISOString();
  for (const changed of [{ rooms: ['L320', 'L999'] }, { weeks: [2, 3] }]) {
    const calls = [];
    const previous = [course({ ...changed, roomsByWeek: RESOLVED_WEEKS, roomsResolvedAt: recent })];
    await resolveAmbiguousRooms(splitAtFirstLevel(calls), [course()], { previous, now: NOW });
    assert.deepEqual(calls, ['2..6', '10..14'], JSON.stringify(changed));
  }
});

test('deux créneaux ambigus sur les mêmes semaines ne demandent chaque plage qu’une fois', async () => {
  const calls = [];
  const fetchRawWeeks = async (weeksRange) => {
    calls.push(weeksRange);
    const rooms = weeksRange === '2..6' ? ['L320'] : ['L316'];
    return {
      ListeCours: [
        ...rawWith({ dom: `[${weeksRange}]`, rooms }).ListeCours,
        ...rawWith({ dom: `[${weeksRange}]`, rooms, day: 3 }).ListeCours,
      ],
    };
  };
  const result = await resolveAmbiguousRooms(fetchRawWeeks, [course(), course({ day: 3 })], { now: NOW });
  assert.deepEqual(calls, ['2..6', '10..14']);
  assert.deepEqual(result.courses.map((c) => c.roomsByWeek), [RESOLVED_WEEKS, RESOLVED_WEEKS]);
});

test('échéance dépassée : aucune requête, l’ancienne résolution même datée est gardée', async () => {
  const stale = new Date(NOW - RESOLUTION_MAX_AGE_MS - HOUR).toISOString();
  const previous = [course({ roomsByWeek: RESOLVED_WEEKS, roomsResolvedAt: stale })];
  const options = { previous, now: NOW, deadline: 0, clock: () => 1 };
  const result = await resolveAmbiguousRooms(noRequest, [course(), course({ day: 4 })], options);
  assert.deepEqual(result.courses[0].roomsByWeek, RESOLVED_WEEKS); // reprise telle quelle
  assert.equal(result.courses[0].roomsResolvedAt, stale); // toujours datée : sera refaite plus tard
  assert.equal('roomsByWeek' in result.courses[1], false); // jamais résolu : salles telles quelles
  assert.equal(result.deferred, 2);
});

test('échéance atteinte en pleine dichotomie : résolution partielle, sans date, à reprendre', async () => {
  let time = 0;
  const fetchRawWeeks = async (weeksRange) => {
    time = 10; // l'échéance tombe après la première requête
    if (weeksRange === '2..6') return rawWith({ dom: '[2..6]', rooms: ['L320', 'L316'] });
    if (weeksRange === '10..14') return rawWith({ dom: '[10..14]', rooms: ['L316'] });
    throw new Error(`plage inattendue : ${weeksRange}`);
  };
  const result = await resolveAmbiguousRooms(fetchRawWeeks, [course()], { now: NOW, deadline: 5, clock: () => time });
  const [partial] = result.courses;
  assert.deepEqual(partial.roomsByWeek[2], ['L320', 'L316']); // [2..6] pas encore départagée
  assert.deepEqual(partial.roomsByWeek[10], ['L316']);
  assert.equal('roomsResolvedAt' in partial, false);
  assert.equal(result.deferred, 1);
});
