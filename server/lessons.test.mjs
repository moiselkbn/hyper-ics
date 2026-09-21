// Lancer avec : node --test server/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { courseKey } from '../shared/course-key.mjs';
import { scheduleKey } from '../shared/redis-keys.mjs';
import { buildLessons, getLessons, parsePromotions } from './lessons.mjs';

// Un créneau tel que l'écrit le scrap (voir buildScheduleRecord).
const slot = ({ subject, code = null, teachers = [], day = 0 }) => ({
  code,
  subject,
  teachers,
  rooms: [],
  note: null,
  day,
  start: '09:00',
  end: '11:00',
  weeks: [1, 2, 3],
  key: subject ? courseKey(subject) : null,
});

const record = (promotion, courses, scrapedAt = '2026-09-21T10:00:00.000Z') => ({ promotion, scrapedAt, courses });

test('un cours à plusieurs occurrences par semaine n’est listé qu’une fois', () => {
  const { lessons } = buildLessons([
    record('3TI Web', [
      slot({ subject: 'Nouvelle technologie Q5', code: 'TWEB-501', teachers: ['Lemal'], day: 0 }),
      slot({ subject: 'Nouvelle technologie Q5', code: 'TWEB-501', teachers: ['Lemal'], day: 3 }),
    ]),
  ]);
  assert.deepEqual(lessons, [
    {
      id: 'code:TWEB-501|nouvelle technologie q5',
      subject: 'Nouvelle technologie Q5',
      code: 'TWEB-501',
      teachers: ['Lemal'],
      promotions: ['3TI Web'],
    },
  ]);
});

test('un cours de même code et même matière est commun à plusieurs promotions', () => {
  const { lessons } = buildLessons([
    record('2TI Web', [slot({ subject: 'Anglais Q3', code: 'TLAE-302', teachers: ['Martin'] })]),
    record('3TI Web', [slot({ subject: 'Anglais Q3', code: 'TLAE-302', teachers: ['Dupont'] })]),
  ]);
  assert.equal(lessons.length, 1);
  assert.deepEqual(lessons[0].promotions, ['2TI Web', '3TI Web']);
  assert.deepEqual(lessons[0].teachers, ['Martin', 'Dupont']); // profs des deux promotions, sans doublon
});

test('un même code pour deux matières donne deux cours', () => {
  const { lessons } = buildLessons([
    record('3TI 3D-Video', [
      slot({ subject: 'Modélisation Q5', code: 'TI3D-300' }),
      slot({ subject: 'Animation Q5', code: 'TI3D-300' }),
    ]),
  ]);
  assert.deepEqual(lessons.map((lesson) => lesson.subject), ['Animation Q5', 'Modélisation Q5']);
});

test('une même matière sous deux codes différents n’est pas fusionnée entre promotions', () => {
  const { lessons } = buildLessons([
    record('1TGRA', [slot({ subject: 'Infographie 2D', code: 'TGRP-300' })]),
    record('1TGRB', [slot({ subject: 'Infographie 2D', code: 'TGRP-303' })]),
  ]);
  assert.equal(lessons.length, 2);
  assert.ok(lessons.every((lesson) => lesson.promotions.length === 1));
});

test('un cours sans code reste propre à sa promotion, même à matière identique', () => {
  const { lessons } = buildLessons([
    record('2PUBA', [slot({ subject: 'Atelier', teachers: ['Leroy'] })]),
    record('3PUB A', [slot({ subject: 'Atelier' })]),
  ]);
  assert.equal(lessons.length, 2);
  assert.deepEqual(lessons.map((lesson) => lesson.id).sort(), ['promotion:2PUBA|atelier', 'promotion:3PUB A|atelier']);
  assert.ok(lessons.every((lesson) => lesson.code === null));
});

test('les espaces autour du code sont ignorés', () => {
  const { lessons } = buildLessons([
    record('1SMA', [slot({ subject: 'Couture', code: '1SMCO ' })]),
    record('1SMB', [slot({ subject: 'Couture', code: '1SMCO' })]),
  ]);
  assert.equal(lessons.length, 1);
  assert.equal(lessons[0].code, '1SMCO');
});

test('dans une promotion, un cours garde le premier code rencontré', () => {
  const { lessons } = buildLessons([
    record('1EAA', [
      slot({ subject: 'Électronique', code: 'EA-101', day: 0 }),
      slot({ subject: 'Électronique', code: 'EA-102', day: 2 }),
    ]),
  ]);
  assert.equal(lessons.length, 1);
  assert.equal(lessons[0].code, 'EA-101');
});

test('un créneau sans matière est ignoré', () => {
  const { lessons } = buildLessons([record('1AT', [slot({ subject: null }), slot({ subject: 'Tissage' })])]);
  assert.deepEqual(lessons.map((lesson) => lesson.subject), ['Tissage']);
});

test('trie les cours par matière et renvoie la plus ancienne date de scrap', () => {
  const { updatedAt, lessons } = buildLessons([
    record('1AT', [slot({ subject: 'Tissage' }), slot({ subject: 'Broderie' })], '2026-09-21T10:00:00.000Z'),
    record('2AT', [slot({ subject: 'Anglais' })], '2026-09-21T09:00:00.000Z'),
  ]);
  assert.deepEqual(lessons.map((lesson) => lesson.subject), ['Anglais', 'Broderie', 'Tissage']);
  assert.equal(updatedAt, '2026-09-21T09:00:00.000Z');
});

test('une promotion sans cours donne une liste vide', () => {
  assert.deepEqual(buildLessons([record('2PUBB', [])]).lessons, []);
});

test('parsePromotions découpe, nettoie et dédoublonne', () => {
  const parse = (query) => parsePromotions(new URLSearchParams(query));
  assert.deepEqual(parse('promotions=3TI Web,2TE'), ['3TI Web', '2TE']);
  assert.deepEqual(parse('promotions= 3TI Web , ,3TI Web'), ['3TI Web']);
});

test('parsePromotions refuse un paramètre absent, vide, trop long ou trop nombreux', () => {
  const parse = (query) => () => parsePromotions(new URLSearchParams(query));
  assert.throws(parse(''), { status: 400 });
  assert.throws(parse('promotions='), { status: 400 });
  assert.throws(parse('promotions=1AT,2AT,3AT'), { status: 400 });
  assert.throws(parse(`promotions=${'x'.repeat(41)}`), { status: 400 });
});

// Base en mémoire : `mgetJson` renvoie null pour une clé absente, comme le vrai client.
const fakeRedis = (records) => ({
  mgetJson: async (keys) => keys.map((key) => records[key] ?? null),
});

test('getLessons lit une clé par promotion demandée, dans l’ordre', async () => {
  const requested = [];
  const redis = {
    mgetJson: async (keys) => {
      requested.push(...keys);
      return [record('2TE', [slot({ subject: 'Photo' })]), record('1AT', [slot({ subject: 'Tissage' })])];
    },
  };
  const response = await getLessons(redis, new URL('http://localhost/api/lessons?promotions=2TE,1AT'));
  assert.deepEqual(requested, [scheduleKey('2TE'), scheduleKey('1AT')]);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).lessons.length, 2);
});

test('getLessons répond 404 pour une promotion inconnue', async () => {
  const redis = fakeRedis({ [scheduleKey('1AT')]: record('1AT', []) });
  await assert.rejects(getLessons(redis, new URL('http://localhost/api/lessons?promotions=1AT,9XX')), { status: 404 });
});

test('getLessons répond 400 sans paramètre', async () => {
  await assert.rejects(getLessons(fakeRedis({}), new URL('http://localhost/api/lessons')), { status: 400 });
});
