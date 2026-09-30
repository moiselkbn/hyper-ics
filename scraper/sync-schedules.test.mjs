// Lancer avec : node --test scraper/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SCHEDULE_INDEX_KEY, scheduleKey } from '../shared/redis-keys.mjs';
import { buildScheduleRecord, EMPTY_SCHEDULE_CONFIRMATIONS, syncSchedules } from './sync-schedules.mjs';

const NOW = new Date('2026-09-20T15:00:00Z');
const FIRST_MONDAY = '2026-09-14';

// Base en mémoire ; `failOn` fait échouer l'écriture des clés indiquées.
function fakeRedis({ failOn = [], initial = {} } = {}) {
  const store = new Map(Object.entries(initial).map(([key, value]) => [key, JSON.stringify(value)]));
  return {
    store,
    getJson: async (key) => (store.has(key) ? JSON.parse(store.get(key)) : null),
    mgetJson: async (keys) => keys.map((key) => (store.has(key) ? JSON.parse(store.get(key)) : null)),
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
  assert.deepEqual(result, { written: ['3TI Web', '1AT'], held: [], failed: [] });
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
  const old = { promotion: '3TI Web', courses: [{ key: 'ancien', code: null, day: 0, start: '09:00', end: '11:00', weeks: [1] }] };
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

test('un passage surtout en échec écrit la liste sans la redater, pour être refait au déclenchement suivant', async () => {
  const previous = { updatedAt: 'avant', promotions: [{ label: '1AT', curriculum: null }] };
  const redis = fakeRedis({ initial: { [SCHEDULE_INDEX_KEY]: previous } });
  const fetchRaw = async (p) => (p.label === '1AT' ? rawWith('Cours') : {});
  const result = await run({ promotions: [promo('1AT'), promo('2AT'), promo('3AT')], fetchRaw, redis });
  assert.deepEqual(result.written, ['1AT']);
  assert.equal(result.failed.length, 2);
  const index = JSON.parse(redis.store.get(SCHEDULE_INDEX_KEY));
  assert.equal(index.updatedAt, 'avant');
  assert.equal(index.promotions[0].hasCourses, true); // la promotion écrite est bien mise à jour
});

test('un passage réussi pour au moins la moitié des promotions redate la liste', async () => {
  const redis = fakeRedis({ initial: { [SCHEDULE_INDEX_KEY]: { updatedAt: 'avant', promotions: [] } } });
  const fetchRaw = async (p) => (p.label === '1AT' ? rawWith('Cours') : {});
  await run({ promotions: [promo('1AT'), promo('2AT')], fetchRaw, redis });
  assert.equal(JSON.parse(redis.store.get(SCHEDULE_INDEX_KEY)).updatedAt, NOW.toISOString());
});

test('une matière renommée entre deux passages est notée dans le planning, pour l’abonnement des élèves', async () => {
  const redis = fakeRedis();
  await run({ promotions: [promo('3TI Web')], fetchRaw: async () => rawWith('Electr. num. 1'), redis });
  assert.equal('renamedKeys' in JSON.parse(redis.store.get(scheduleKey('3TI Web'))), false);
  await run({ promotions: [promo('3TI Web')], fetchRaw: async () => rawWith('Electr. num. 1 (combin.)'), redis });
  assert.deepEqual(JSON.parse(redis.store.get(scheduleKey('3TI Web'))).renamedKeys, {
    'electr. num. 1': 'electr. num. 1 (combin.)',
  });
  // Gardé aux passages suivants.
  await run({ promotions: [promo('3TI Web')], fetchRaw: async () => rawWith('Electr. num. 1 (combin.)'), redis });
  assert.deepEqual(JSON.parse(redis.store.get(scheduleKey('3TI Web'))).renamedKeys, {
    'electr. num. 1': 'electr. num. 1 (combin.)',
  });
});

// --- Planning revenu vide : confirmé sur plusieurs passages avant d'écraser un planning qui avait des cours.

const withCourses = { promotion: '3TI Web', scrapedAt: 'avant', courses: [{ key: 'ancien', code: null, day: 0, start: '09:00', end: '11:00', weeks: [1] }] };
const empty = async () => ({ ListeCours: [] });

test("un planning vide n'écrase pas aussitôt un planning qui avait des cours", async () => {
  const index = { updatedAt: 'avant', promotions: [{ label: '3TI Web', curriculum: 'graphic-technics', hasCourses: true }] };
  const redis = fakeRedis({ initial: { [scheduleKey('3TI Web')]: withCourses, [SCHEDULE_INDEX_KEY]: index } });
  const logs = [];
  const result = await run({ promotions: [promo('3TI Web')], fetchRaw: empty, redis, log: (message) => logs.push(message) });
  assert.deepEqual(result, { written: [], held: ['3TI Web'], failed: [] });
  assert.deepEqual(JSON.parse(redis.store.get(scheduleKey('3TI Web'))), { ...withCourses, emptyScrapes: 1 });
  assert.ok(logs.includes('3TI Web : planning vide (1/3), ancien planning gardé'));
  // La liste est redatée (le passage compte), la promotion garde ses cours.
  assert.deepEqual(JSON.parse(redis.store.get(SCHEDULE_INDEX_KEY)), { ...index, updatedAt: NOW.toISOString() });
});

test(`le planning vide est écrit au ${EMPTY_SCHEDULE_CONFIRMATIONS}e passage vide consécutif`, async () => {
  const redis = fakeRedis({ initial: { [scheduleKey('3TI Web')]: withCourses } });
  for (let i = 1; i < EMPTY_SCHEDULE_CONFIRMATIONS; i++) {
    assert.deepEqual((await run({ promotions: [promo('3TI Web')], fetchRaw: empty, redis })).held, ['3TI Web']);
  }
  const result = await run({ promotions: [promo('3TI Web')], fetchRaw: empty, redis });
  assert.deepEqual(result, { written: ['3TI Web'], held: [], failed: [] });
  const record = JSON.parse(redis.store.get(scheduleKey('3TI Web')));
  assert.deepEqual(record.courses, []);
  assert.equal('emptyScrapes' in record, false);
  assert.equal(JSON.parse(redis.store.get(SCHEDULE_INDEX_KEY)).promotions[0].hasCourses, false);
});

test('un passage avec des cours remet le compte des plannings vides à zéro', async () => {
  const redis = fakeRedis({ initial: { [scheduleKey('3TI Web')]: { ...withCourses, emptyScrapes: EMPTY_SCHEDULE_CONFIRMATIONS - 1 } } });
  await run({ promotions: [promo('3TI Web')], fetchRaw: async () => rawWith('Cours'), redis });
  assert.equal('emptyScrapes' in JSON.parse(redis.store.get(scheduleKey('3TI Web'))), false);
  assert.deepEqual((await run({ promotions: [promo('3TI Web')], fetchRaw: empty, redis })).held, ['3TI Web']);
});

test("un planning vide est écrit aussitôt si la promotion n'avait pas de cours", async () => {
  const redis = fakeRedis({ initial: { [scheduleKey('2PUBB')]: { promotion: '2PUBB', courses: [] } } });
  const result = await run({ promotions: [promo('2PUBB'), promo('1AT')], fetchRaw: empty, redis });
  assert.deepEqual(result, { written: ['2PUBB', '1AT'], held: [], failed: [] }); // 1AT : jamais écrite
});

test('un planning vide est refusé si les plannings précédents sont illisibles', async () => {
  const redis = {
    ...fakeRedis(),
    mgetJson: async () => {
      throw new Error('Redis MGET : HTTP 500');
    },
  };
  const result = await run({ promotions: [promo('3TI Web'), promo('1AT')], fetchRaw: async (p) => (p.label === '1AT' ? rawWith('Cours') : { ListeCours: [] }), redis });
  assert.deepEqual(result.written, ['1AT']);
  assert.match(result.failed[0].message, /planning vide, invérifiable/);
});

// --- Coût de la résolution des salles : reprise du planning précédent, budget par passage.

const noRequest = async () => {
  throw new Error('ne doit pas être appelé');
};

test('syncSchedules reprend la résolution des salles du planning précédent, sans requête', async () => {
  const resolvedCourse = {
    ...buildScheduleRecord({
      promotion: promo('3TI Web'),
      raw: rawAmbiguous({ dom: '[2,10]', rooms: ['L320', 'L316'] }),
      firstMonday: FIRST_MONDAY,
      now: NOW,
    }).courses[0],
    roomsByWeek: { 2: ['L320'], 10: ['L316'] },
    roomsResolvedAt: new Date(NOW - 60 * 60 * 1000).toISOString(),
  };
  const redis = fakeRedis({ initial: { [scheduleKey('3TI Web')]: { promotion: '3TI Web', courses: [resolvedCourse] } } });
  const logs = [];
  await run({
    promotions: [promo('3TI Web')],
    fetchRaw: async () => rawAmbiguous({ dom: '[2,10]', rooms: ['L320', 'L316'] }),
    fetchRawWeeks: noRequest,
    redis,
    log: (message) => logs.push(message),
  });
  const { courses } = JSON.parse(redis.store.get(scheduleKey('3TI Web')));
  assert.deepEqual(courses[0].roomsByWeek, { 2: ['L320'], 10: ['L316'] });
  assert.ok(logs.includes('3TI Web : 1 créneaux écrits (salles : 1 reprises, 0 affinées, 0 reportées)'));
});

test('budget épuisé : aucune requête de plus, mais toutes les promotions et la liste sont écrites', async () => {
  const redis = fakeRedis();
  const logs = [];
  const result = await run({
    promotions: [promo('3TI Web'), promo('2TI Web')],
    fetchRaw: async () => rawAmbiguous({ dom: '[2,10]', rooms: ['L320', 'L316'] }),
    fetchRawWeeks: noRequest,
    redis,
    roomBudgetMs: 0,
    log: (message) => logs.push(message),
  });
  assert.deepEqual(result, { written: ['3TI Web', '2TI Web'], held: [], failed: [] });
  assert.equal(JSON.parse(redis.store.get(SCHEDULE_INDEX_KEY)).promotions.length, 2);
  const { courses } = JSON.parse(redis.store.get(scheduleKey('2TI Web')));
  assert.deepEqual(courses[0].rooms, ['L320', 'L316']); // salles telles quelles, à affiner au prochain passage
  assert.ok(logs.includes('2TI Web : 1 créneaux écrits (salles : 0 reprises, 0 affinées, 1 reportées)'));
});

test('un planning écrit avant la datation des résolutions compte comme résolu à sa date de scrap', async () => {
  const oldCourse = {
    ...buildScheduleRecord({
      promotion: promo('3TI Web'),
      raw: rawAmbiguous({ dom: '[2,10]', rooms: ['L320', 'L316'] }),
      firstMonday: FIRST_MONDAY,
      now: NOW,
    }).courses[0],
    roomsByWeek: { 2: ['L320'], 10: ['L316'] }, // sans roomsResolvedAt : écrit par l'ancien scrap
  };
  const scrapedAt = new Date(NOW - 2 * 60 * 60 * 1000).toISOString(); // il y a 2 heures
  const redis = fakeRedis({ initial: { [scheduleKey('3TI Web')]: { promotion: '3TI Web', scrapedAt, courses: [oldCourse] } } });
  await run({
    promotions: [promo('3TI Web')],
    fetchRaw: async () => rawAmbiguous({ dom: '[2,10]', rooms: ['L320', 'L316'] }),
    fetchRawWeeks: noRequest,
    redis,
  });
  const { courses } = JSON.parse(redis.store.get(scheduleKey('3TI Web')));
  assert.deepEqual(courses[0].roomsByWeek, { 2: ['L320'], 10: ['L316'] });
  assert.equal(courses[0].roomsResolvedAt, scrapedAt);
});
