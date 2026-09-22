// Lancer avec : node --test scraper/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveAmbiguousRooms } from './resolve-rooms.mjs';

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
  const resolved = await resolveAmbiguousRooms(() => { throw new Error('ne doit pas être appelé'); }, [single]);
  assert.deepEqual(resolved, [single]);
});

test('un cours ambigu sur une seule semaine traverse sans requête (deux salles en même temps, légitime)', async () => {
  const simultaneous = course({ weeks: [9] });
  const resolved = await resolveAmbiguousRooms(() => { throw new Error('ne doit pas être appelé'); }, [simultaneous]);
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
  const [resolved] = await resolveAmbiguousRooms(fetchRawWeeks, [course()]);
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
  const [resolved] = await resolveAmbiguousRooms(fetchRawWeeks, [course()]);
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
  const [resolved] = await resolveAmbiguousRooms(fetchRawWeeks, [course()]);
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
  const [resolvedAnglais] = await resolveAmbiguousRooms(fetchRawWeeks, [course({ weeks: [2, 3] })]);
  assert.deepEqual(resolvedAnglais.roomsByWeek, { 2: ['L320'], 3: ['L320'] });
});
