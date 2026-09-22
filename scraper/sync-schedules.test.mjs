// Lancer avec : node --test scraper/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SCHEDULE_INDEX_KEY, scheduleKey } from '../shared/redis-keys.mjs';
import { buildScheduleRecord, syncSchedules } from './sync-schedules.mjs';

const NOW = new Date('2026-09-20T15:00:00Z');
const FIRST_MONDAY = '2026-09-14';

// Base en mémoire ; `failOn` fait échouer l'écriture des clés indiquées.
function fakeRedis({ failOn = [], initial = {} } = {}) {
  const store = new Map(Object.entries(initial).map(([key, value]) => [key, JSON.stringify(value)]));
  return {
    store,
    getJson: async (key) => (store.has(key) ? JSON.parse(store.get(key)) : null),
    setJson: async (key, value) => {
      if (failOn.includes(key)) throw new Error('Redis SET : HTTP 500');
      store.set(key, JSON.stringify(value));
    },
  };
}

// Données fictives : un cours de 3 h le mardi à 09:00.
const rawWith = (subject) => ({
  ListeCours: [{
    p: 28, d: 6, dom: '[1..6]',
    listeC: [{ G: 14, C: [{ L: '<3TI Web>ABCD-101' }] }, { G: 0, C: { L: subject } }],
  }],
});
const promo = (label) => ({ label, id: `id-${label}` });
const run = (options) => syncSchedules({ firstMonday: FIRST_MONDAY, now: NOW, ...options });

test('buildScheduleRecord ajoute cursus, lundi de la semaine 1, date et clé de cours', () => {
  const record = buildScheduleRecord({ promotion: promo('3TI Web'), raw: rawWith('  Cours Fictif Q1 '), firstMonday: FIRST_MONDAY, now: NOW });
  assert.equal(record.promotion, '3TI Web');
  assert.equal(record.curriculum, 'graphic-technics');
  assert.equal(record.firstMonday, FIRST_MONDAY);
  assert.equal(record.scrapedAt, '2026-09-20T15:00:00.000Z');
  assert.equal(record.courses[0].key, 'cours fictif q1');
  assert.equal(record.courses[0].code, 'ABCD-101');
});

test('buildScheduleRecord refuse une réponse sans ListeCours mais accepte une liste vide', () => {
  const args = { promotion: promo('3TI Web'), firstMonday: FIRST_MONDAY, now: NOW };
  assert.throws(() => buildScheduleRecord({ ...args, raw: {} }), /sans liste de cours/);
  assert.deepEqual(buildScheduleRecord({ ...args, raw: { ListeCours: [] } }).courses, []);
});

test('syncSchedules écrit un planning par promotion, puis la liste', async () => {
  const redis = fakeRedis();
  const result = await run({ promotions: [promo('3TI Web'), promo('1AT')], fetchRaw: async () => rawWith('Cours'), redis });
  assert.deepEqual(result, { written: ['3TI Web', '1AT'], failed: [] });
  assert.equal(JSON.parse(redis.store.get(scheduleKey('3TI Web'))).courses.length, 1);
  assert.deepEqual(JSON.parse(redis.store.get(SCHEDULE_INDEX_KEY)), {
    updatedAt: NOW.toISOString(),
    promotions: [
      { label: '3TI Web', curriculum: 'graphic-technics', hasCourses: true },
      { label: '1AT', curriculum: 'textile-arts', hasCourses: true },
    ],
  });
});

test("la liste indique si une promotion a des cours publiés", async () => {
  const redis = fakeRedis();
  const fetchRaw = async (p) => (p.label === '2PUBB' ? { ListeCours: [] } : rawWith('Cours'));
  await run({ promotions: [promo('1AT'), promo('2PUBB')], fetchRaw, redis });
  const entries = JSON.parse(redis.store.get(SCHEDULE_INDEX_KEY)).promotions;
  assert.deepEqual(entries.map(({ label, hasCourses }) => [label, hasCourses]), [['1AT', true], ['2PUBB', false]]);
});

test("une promotion dont l'écriture échoue garde son ancien hasCourses, ou aucun s'il était inconnu", async () => {
  const redis = fakeRedis({
    initial: {
      [SCHEDULE_INDEX_KEY]: {
        promotions: [
          { label: '3TI Web', curriculum: 'graphic-technics', hasCourses: false },
          { label: '1AT', curriculum: 'textile-arts' }, // ancien format : pas de hasCourses
        ],
      },
    },
  });
  const fetchRaw = async (p) => (p.label === '2AT' ? rawWith('Cours') : {});
  await run({ promotions: [promo('3TI Web'), promo('1AT'), promo('2AT')], fetchRaw, redis });
  const entries = JSON.parse(redis.store.get(SCHEDULE_INDEX_KEY)).promotions;
  assert.equal(entries[0].hasCourses, false);
  assert.equal('hasCourses' in entries[1], false);
  assert.equal(entries[2].hasCourses, true);
});

test("un résultat douteux n'écrase pas l'ancien planning", async () => {
  const old = { promotion: '3TI Web', courses: [{ key: 'ancien' }] };
  const redis = fakeRedis({ initial: { [scheduleKey('3TI Web')]: old } });
  const result = await run({ promotions: [promo('3TI Web'), promo('1AT')], fetchRaw: async (p) => (p.label === '3TI Web' ? {} : rawWith('Cours')), redis });
  assert.deepEqual(result.written, ['1AT']);
  assert.equal(result.failed.length, 1);
  assert.match(result.failed[0].message, /sans liste de cours/);
  assert.deepEqual(JSON.parse(redis.store.get(scheduleKey('3TI Web'))), old);
});

test("une erreur d'écriture Redis n'arrête pas les autres promotions", async () => {
  const redis = fakeRedis({ failOn: [scheduleKey('1AT')] });
  const result = await run({ promotions: [promo('1AT'), promo('2AT')], fetchRaw: async () => rawWith('Cours'), redis });
  assert.deepEqual(result.written, ['2AT']);
  assert.deepEqual(result.failed, [{ label: '1AT', message: 'Redis SET : HTTP 500' }]);
});

test("la liste garde une promotion déjà listée dont l'écriture échoue, pas une jamais écrite", async () => {
  const redis = fakeRedis({ initial: { [SCHEDULE_INDEX_KEY]: { promotions: [{ label: '3TI Web', curriculum: 'graphic-technics' }] } } });
  const fetchRaw = async (p) => (p.label === '1AT' || p.label === '3TI Web' ? {} : rawWith('Cours'));
  await run({ promotions: [promo('3TI Web'), promo('1AT'), promo('2AT')], fetchRaw, redis });
  const labels = JSON.parse(redis.store.get(SCHEDULE_INDEX_KEY)).promotions.map((entry) => entry.label);
  assert.deepEqual(labels, ['3TI Web', '2AT']); // 1AT n'a jamais eu de planning : absent
});

// Cours à deux salles sur deux semaines : ambigu tant que `fetchRawWeeks` n'a pas tranché.
const rawAmbiguous = ({ dom, rooms }) => ({
  ListeCours: [{
    p: 4, d: 4, dom,
    listeC: [{ G: 14, C: [{ L: '<3TI Web>TLAE-501' }] }, { G: 0, C: { L: 'Anglais Q5' } }, { G: 3, C: rooms.map((L) => ({ L })) }],
  }],
});

test('syncSchedules affine la salle par semaine quand fetchRawWeeks est fourni', async () => {
  const redis = fakeRedis();
  const fetchRawWeeks = async (promotion, weeksRange) => {
    if (weeksRange === '2') return rawAmbiguous({ dom: '[2]', rooms: ['L320'] });
    if (weeksRange === '10') return rawAmbiguous({ dom: '[10]', rooms: ['L316'] });
    throw new Error(`plage inattendue : ${weeksRange}`);
  };
  await run({
    promotions: [promo('3TI Web')],
    fetchRaw: async () => rawAmbiguous({ dom: '[2,10]', rooms: ['L320', 'L316'] }),
    fetchRawWeeks,
    redis,
  });
  const { courses } = JSON.parse(redis.store.get(scheduleKey('3TI Web')));
  assert.deepEqual(courses[0].roomsByWeek, { 2: ['L320'], 10: ['L316'] });
});

test('syncSchedules sans fetchRawWeeks garde les salles ambiguës telles quelles', async () => {
  const redis = fakeRedis();
  await run({
    promotions: [promo('3TI Web')],
    fetchRaw: async () => rawAmbiguous({ dom: '[2,10]', rooms: ['L320', 'L316'] }),
    redis,
  });
  const { courses } = JSON.parse(redis.store.get(scheduleKey('3TI Web')));
  assert.deepEqual(courses[0].rooms, ['L320', 'L316']);
  assert.equal('roomsByWeek' in courses[0], false);
});

test("sans aucune écriture réussie, la liste existante n'est pas touchée", async () => {
  const previous = { updatedAt: 'avant', promotions: [{ label: '3TI Web', curriculum: 'graphic-technics' }] };
  const redis = fakeRedis({ initial: { [SCHEDULE_INDEX_KEY]: previous } });
  const result = await run({ promotions: [promo('3TI Web')], fetchRaw: async () => ({}), redis });
  assert.deepEqual(result.written, []);
  assert.deepEqual(JSON.parse(redis.store.get(SCHEDULE_INDEX_KEY)), previous);
});
