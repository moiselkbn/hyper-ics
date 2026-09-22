// Lancer avec : node --test server/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { courseKey } from '../shared/course-key.mjs';
import { scheduleKey } from '../shared/redis-keys.mjs';
import { buildDetailedLessons, buildLessons, getLessons, parsePromotions } from './lessons.mjs';

// Un créneau tel que l'écrit le scrap (voir buildScheduleRecord).
const slot = ({
  subject, code = null, teachers = [], day = 0, start = '09:00', end = '11:00', weeks = [1, 2, 3], rooms = [], roomsByWeek,
}) => ({
  code,
  subject,
  teachers,
  rooms,
  ...(roomsByWeek ? { roomsByWeek } : {}),
  note: null,
  day,
  start,
  end,
  weeks,
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
      mandatory: false,
      promotions: ['3TI Web'],
    },
  ]);
});

test('la réponse n’expose pas les champs internes de la fusion', () => {
  const [lesson] = buildLessons([record('1AT', [slot({ subject: 'Tissage' })])]).lessons;
  assert.deepEqual(Object.keys(lesson).sort(), ['code', 'id', 'mandatory', 'promotions', 'subject', 'teachers']);
});

test('un cours de même code et même matière est commun à plusieurs promotions', () => {
  const { lessons } = buildLessons([
    record('2TI Web', [slot({ subject: 'Anglais Q3', code: 'TLAE-302', teachers: ['Martin'], day: 1 })]),
    record('3TI Web', [slot({ subject: 'Anglais Q3', code: 'TLAE-302', teachers: ['Dupont'], day: 2 })]),
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

// --- Cours sans code : ateliers, réunions, événements, ajoutés d'office au calendrier de la promotion.

test('un cours sans code est obligatoire, un cours avec code est à choisir', () => {
  const { lessons } = buildLessons([
    record('2TE', [slot({ subject: 'Atelier Edition/Web/VFX' }), slot({ subject: 'Anglais Q3', code: 'TLAE-302', day: 1 })]),
  ]);
  const bySubject = Object.fromEntries(lessons.map((lesson) => [lesson.subject, lesson.mandatory]));
  assert.deepEqual(bySubject, { 'Anglais Q3': false, 'Atelier Edition/Web/VFX': true });
});

test('un cours fusionné reste obligatoire s’il est sans code dans une des promotions', () => {
  const { lessons } = buildLessons([
    record('2TE', [slot({ subject: 'Atelier' })]),
    record('3TE', [slot({ subject: 'Atelier', code: 'TATL-300' })]),
  ]);
  assert.equal(lessons.length, 1);
  assert.equal(lessons[0].mandatory, true);
});

// --- Cours de même matière au même moment : un seul cours, jamais deux fois à l'écran.

test('un cours sans code au même moment dans deux promotions n’est listé qu’une fois', () => {
  const { lessons } = buildLessons([
    record('2TI Web', [slot({ subject: 'Atelier Edition/Web/VFX', teachers: ['Lemal'] })]),
    record('3TI Web', [slot({ subject: 'Atelier Edition/Web/VFX', teachers: ['Marchi'] })]),
  ]);
  assert.equal(lessons.length, 1);
  assert.deepEqual(lessons[0].promotions, ['2TI Web', '3TI Web']);
  assert.deepEqual(lessons[0].teachers, ['Lemal', 'Marchi']);
  assert.equal(lessons[0].code, null);
  assert.equal(lessons[0].mandatory, true);
});

test('un seul moment en commun suffit, même si les autres occurrences diffèrent', () => {
  const { lessons } = buildLessons([
    record('2TE', [slot({ subject: 'Réunion CAVP', weeks: [3, 10] })]),
    record('3TE', [slot({ subject: 'Réunion CAVP', weeks: [3, 12] })]),
  ]);
  assert.equal(lessons.length, 1);
});

test('des codes différents ne dispensent pas de fusionner deux cours simultanés', () => {
  const { lessons } = buildLessons([
    record('1TGRA', [slot({ subject: 'Infographie 2D', code: 'TGRP-300' })]),
    record('1TGRB', [slot({ subject: 'Infographie 2D', code: 'TGRP-303' })]),
  ]);
  assert.equal(lessons.length, 1);
  assert.deepEqual(lessons[0].promotions, ['1TGRA', '1TGRB']);
});

test('la même matière à d’autres moments reste deux cours distincts', () => {
  const { lessons } = buildLessons([
    record('2SMA', [slot({ subject: 'Présentation de projet', weeks: [5] })]),
    record('3SMA', [slot({ subject: 'Présentation de projet', weeks: [12] })]),
  ]);
  assert.equal(lessons.length, 2);
  assert.ok(lessons.every((lesson) => lesson.promotions.length === 1));
});

test('mêmes semaines mais autre jour ou autres heures : pas simultanés', () => {
  const base = { subject: 'Atelier', weeks: [4] };
  const lessonsFor = (other) => buildLessons([record('2TE', [slot(base)]), record('3TE', [slot({ ...base, ...other })])]).lessons;
  assert.equal(lessonsFor({ day: 1 }).length, 2);
  assert.equal(lessonsFor({ start: '10:00' }).length, 2);
  assert.equal(lessonsFor({ end: '12:00' }).length, 2);
  assert.equal(lessonsFor({}).length, 1); // témoin : tout identique
});

test('deux matières différentes au même moment ne fusionnent pas', () => {
  const { lessons } = buildLessons([
    record('2TE', [slot({ subject: 'Photo' })]),
    record('3TE', [slot({ subject: 'Vidéo' })]),
  ]);
  assert.equal(lessons.length, 2);
});

test('la fusion ne dépend pas de l’ordre des promotions demandées', () => {
  const a = record('2TI Web', [slot({ subject: 'Réunion CAVP' })]);
  const b = record('3TI Web', [slot({ subject: 'Réunion CAVP' })]);
  const forward = buildLessons([a, b]).lessons;
  const backward = buildLessons([b, a]).lessons;
  assert.equal(forward[0].id, backward[0].id);
  assert.equal(forward[0].id, 'promotion:2TI Web|réunion cavp'); // le plus petit des identifiants fusionnés
  assert.deepEqual(forward[0].promotions, ['2TI Web', '3TI Web']);
  assert.deepEqual(backward[0].promotions, ['3TI Web', '2TI Web']); // suit l'ordre demandé
});

test('un cours qui relie deux groupes séparés les fusionne tous', () => {
  // P1 et P2 n'ont aucun moment commun ; P3 les recoupe tous les deux.
  const { lessons } = buildLessons([
    record('P1', [slot({ subject: 'Atelier', weeks: [1] })]),
    record('P2', [slot({ subject: 'Atelier', weeks: [2] })]),
    record('P3', [slot({ subject: 'Atelier', weeks: [1, 2] })]),
  ]);
  assert.equal(lessons.length, 1);
  assert.deepEqual(lessons[0].promotions, ['P1', 'P2', 'P3']);
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

// --- Salles : une par occurrence, jamais assemblées entre elles (voir scraper/resolve-rooms.mjs).

test('une même salle sur toutes les semaines s’applique à chaque occurrence', () => {
  const [lesson] = buildDetailedLessons([
    record('3TI Web', [slot({ subject: 'Anglais Q5', weeks: [2, 3], rooms: ['L520'] })]),
  ]);
  assert.deepEqual(lesson.roomsByOccurrence, { '2|0|09:00|11:00': ['L520'], '3|0|09:00|11:00': ['L520'] });
});

test('roomsByWeek distingue la salle de chaque occurrence, sans les assembler', () => {
  const [lesson] = buildDetailedLessons([
    record('3TI Web', [
      slot({
        subject: 'Anglais Q5',
        weeks: [2, 3, 10, 11],
        rooms: ['L320', 'L316'], // salle ambiguë sur l'ensemble du créneau (avant résolution)
        roomsByWeek: { 2: ['L320'], 3: ['L320'], 10: ['L316'], 11: ['L316'] },
      }),
    ]),
  ]);
  assert.deepEqual(lesson.roomsByOccurrence, {
    '2|0|09:00|11:00': ['L320'],
    '3|0|09:00|11:00': ['L320'],
    '10|0|09:00|11:00': ['L316'],
    '11|0|09:00|11:00': ['L316'],
  });
});

// --- Profs : celui de chaque occurrence, jamais assemblés entre eux (un cours peut changer de prof selon le jour).

test('deux créneaux du même cours à des jours différents gardent chacun son prof', () => {
  const [lesson] = buildDetailedLessons([
    record('3TI Web', [
      slot({ subject: 'Anglais Q5', teachers: ['Lemal'], day: 0, weeks: [2, 3] }), // lundi
      slot({ subject: 'Anglais Q5', teachers: ['Jamoulle'], day: 4, weeks: [2, 3] }), // vendredi
    ]),
  ]);
  assert.deepEqual(lesson.teachersByOccurrence, {
    '2|0|09:00|11:00': ['Lemal'],
    '3|0|09:00|11:00': ['Lemal'],
    '2|4|09:00|11:00': ['Jamoulle'],
    '3|4|09:00|11:00': ['Jamoulle'],
  });
  // Le résumé à plat (écrans de sélection) garde, lui, tous les profs du cours, sans distinction de date.
  assert.deepEqual(lesson.teachers, ['Lemal', 'Jamoulle']);
});

test('deux profs au même moment restent ensemble sur cette occurrence', () => {
  const [lesson] = buildDetailedLessons([
    record('3TI Web', [slot({ subject: 'Atelier', teachers: ['Pirson', 'Parotte'], weeks: [1] })]),
  ]);
  assert.deepEqual(lesson.teachersByOccurrence, { '1|0|09:00|11:00': ['Pirson', 'Parotte'] });
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
