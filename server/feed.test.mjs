// Lancer avec : node --test server/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { courseKey } from '../shared/course-key.mjs';
import { SCHEDULE_INDEX_KEY, scheduleKey } from '../shared/redis-keys.mjs';
import { generateToken } from '../shared/token.mjs';
import { getFeedIcs } from './feed.mjs';
import { createSubscription } from './subscription.mjs';

// Un créneau tel que l'écrit le scrap (voir lessons.test.mjs pour le même fixture).
const slot = ({ subject, code = null, teachers = [], day = 0, start = '09:00', end = '11:00', weeks = [1] }) => ({
  code,
  subject,
  teachers,
  rooms: [],
  note: null,
  day,
  start,
  end,
  weeks,
  key: subject ? courseKey(subject) : null,
});

const record = (promotion, courses, firstMonday = '2026-09-14') => ({
  promotion,
  firstMonday,
  scrapedAt: '2026-09-21T10:00:00.000Z',
  courses,
});

// Base en mémoire : mêmes méthodes que le vrai client (shared/redis-client.mjs), rien de plus.
function inMemoryRedis(records) {
  const store = new Map([
    [SCHEDULE_INDEX_KEY, JSON.stringify({ promotions: records.map((entry) => ({ label: entry.promotion })) })],
    ...records.map((entry) => [scheduleKey(entry.promotion), JSON.stringify(entry)]),
  ]);
  return {
    store,
    setJson: async (key, value) => store.set(key, JSON.stringify(value)),
    getJson: async (key) => (store.has(key) ? JSON.parse(store.get(key)) : null),
    mgetJson: async (keys) => keys.map((key) => (store.has(key) ? JSON.parse(store.get(key)) : null)),
  };
}

// Le planning d'une promotion change après l'abonnement (nouveau scrap).
const rescrap = (redis, entry) => redis.store.set(scheduleKey(entry.promotion), JSON.stringify(entry));

async function subscribe(redis, promotions) {
  const response = await createSubscription(redis, { url: 'http://localhost/', json: async () => ({ promotions }) });
  return (await response.json()).token;
}

async function feedOf(redis, token) {
  const response = await getFeedIcs(redis, new URL(`http://localhost/api/feed?token=${token}`));
  assert.equal(response.status, 200);
  return response.text();
}

const summaries = (ics) => [...ics.matchAll(/^SUMMARY:(.+)$/gm)].map((match) => match[1]);

test('getFeedIcs répond 400 sans jeton et 404 pour un jeton inconnu', async () => {
  const redis = inMemoryRedis([]);
  await assert.rejects(getFeedIcs(redis, new URL('http://localhost/api/feed')), { status: 400 });
  await assert.rejects(getFeedIcs(redis, new URL('http://localhost/api/feed?token=inconnu')), { status: 404 });
  await assert.rejects(getFeedIcs(redis, new URL(`http://localhost/api/feed?token=${generateToken()}`)), { status: 404 });
});

test('getFeedIcs lit aussi le jeton dans l’adresse publique /f/<jeton>', async () => {
  const redis = inMemoryRedis([record('1AT', [slot({ subject: 'Tissage', code: 'TIS-1' })])]);
  const token = await subscribe(redis, [{ label: '1AT', checked: [courseKey('Tissage')], unchecked: [] }]);
  const response = await getFeedIcs(redis, new URL(`https://hyper-ics.vercel.app/f/${token}`));
  assert.equal(response.status, 200);
  assert.deepEqual(summaries(await response.text()), ['Tissage']);
  await assert.rejects(getFeedIcs(redis, new URL('https://hyper-ics.vercel.app/f/')), { status: 400 });
});

test('getFeedIcs sert un calendrier jamais mis en cache', async () => {
  const redis = inMemoryRedis([record('1AT', [slot({ subject: 'Tissage', code: 'TIS-1' })])]);
  const token = await subscribe(redis, [{ label: '1AT', checked: [courseKey('Tissage')], unchecked: [] }]);
  const response = await getFeedIcs(redis, new URL(`http://localhost/api/feed?token=${token}`));
  assert.equal(response.headers.get('Content-Type'), 'text/calendar; charset=utf-8');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('une seule promotion : tous ses cours, sauf les décochés, obligatoires compris', async () => {
  const redis = inMemoryRedis([
    record('1AT', [
      slot({ subject: 'Réunion de rentrée' }), // sans code : obligatoire
      slot({ subject: 'Tissage', code: 'TIS-1' }),
      slot({ subject: 'Couture', code: 'COU-1' }),
    ]),
  ]);
  const token = await subscribe(redis, [{ label: '1AT', checked: [courseKey('Tissage')], unchecked: [courseKey('Couture')] }]);
  assert.deepEqual(summaries(await feedOf(redis, token)).sort(), ['Réunion de rentrée', 'Tissage']);
});

test('un cours publié après l’abonnement entre dans le flux de la promotion suivie', async () => {
  const redis = inMemoryRedis([record('2SMC', [])]); // planning pas encore publié
  const token = await subscribe(redis, [{ label: '2SMC', checked: [], unchecked: [] }]);
  assert.deepEqual(summaries(await feedOf(redis, token)), []);

  rescrap(redis, record('2SMC', [slot({ subject: 'Montage', code: 'SMC-201' })]));
  assert.deepEqual(summaries(await feedOf(redis, token)), ['Montage']);
});

test('chevauchement : un cours publié plus tard dans la seconde promotion n’entre pas dans le flux', async () => {
  const redis = inMemoryRedis([
    record('3TI Web', [slot({ subject: 'Projet web', code: 'TWEB-501' }), slot({ subject: 'Stage', code: 'TWEB-502' })]),
    record('2TI Web', [
      slot({ subject: 'Anglais Q3', code: 'TLAE-302', day: 1 }),
      slot({ subject: 'Réseaux', code: 'TWEB-301', day: 2 }),
      slot({ subject: 'Design', code: 'TWEB-302', day: 3 }),
    ]),
  ]);
  const token = await subscribe(redis, [
    { label: '3TI Web', checked: [courseKey('Projet web'), courseKey('Stage')], unchecked: [] },
    { label: '2TI Web', checked: [courseKey('Anglais Q3')], unchecked: [courseKey('Réseaux'), courseKey('Design')] },
  ]);
  // Deux promotions suivies : chaque cours précise la sienne.
  assert.deepEqual(summaries(await feedOf(redis, token)).sort(), ['Anglais Q3 (2TI Web)', 'Projet web (3TI Web)', 'Stage (3TI Web)']);

  rescrap(
    redis,
    record('2TI Web', [slot({ subject: 'Anglais Q3', code: 'TLAE-302', day: 1 }), slot({ subject: 'Typographie', code: 'TWEB-303' })]),
  );
  rescrap(
    redis,
    record('3TI Web', [
      slot({ subject: 'Projet web', code: 'TWEB-501' }),
      slot({ subject: 'Stage', code: 'TWEB-502' }),
      slot({ subject: 'Portfolio', code: 'TWEB-503', day: 4 }),
    ]),
  );
  assert.deepEqual(summaries(await feedOf(redis, token)).sort(), [
    'Anglais Q3 (2TI Web)',
    'Portfolio (3TI Web)', // nouveau dans la promotion suivie : inclus
    'Projet web (3TI Web)',
    'Stage (3TI Web)',
  ]); // Typographie, nouveau en 2TI Web, n'y est pas
});

test('un cours qui reçoit un code après l’abonnement reste suivi, et un cours décoché reste exclu', async () => {
  const redis = inMemoryRedis([
    record('2PUBB', [slot({ subject: 'Stratégie de marque' }), slot({ subject: 'Rédaction', day: 2 })]),
    record('1PUBB', [slot({ subject: 'Histoire de la pub', code: 'PUB-101', day: 3 }), slot({ subject: 'Dessin', code: 'PUB-102', day: 4 })]),
  ]);
  const token = await subscribe(redis, [
    { label: '2PUBB', checked: [], unchecked: [] }, // encore sans code : rien à choisir
    { label: '1PUBB', checked: [courseKey('Histoire de la pub')], unchecked: [courseKey('Dessin')] },
  ]);

  // Les cours de 2PUBB reçoivent un code : ils deviennent des cours à choisir, leur identifiant change, pas leur clé.
  rescrap(
    redis,
    record('2PUBB', [slot({ subject: 'Stratégie de marque', code: 'PUB-201' }), slot({ subject: 'Rédaction', code: 'PUB-202', day: 2 })]),
  );
  assert.deepEqual(summaries(await feedOf(redis, token)).sort(), [
    'Histoire de la pub (1PUBB)',
    'Rédaction (2PUBB)',
    'Stratégie de marque (2PUBB)',
  ]);
});

test('getFeedIcs ignore une promotion qui aurait disparu de Redis entre-temps', async () => {
  const redis = inMemoryRedis([record('1AT', [slot({ subject: 'Tissage' })]), record('2AT', [slot({ subject: 'Teinture' })])]);
  const token = await subscribe(redis, [
    { label: '1AT', checked: [], unchecked: [] },
    { label: '2AT', checked: [], unchecked: [] },
  ]);
  redis.store.delete(scheduleKey('2AT'));

  const ics = await feedOf(redis, token);
  // Une seule promotion restante : plus de précision de promotion.
  assert.deepEqual(summaries(ics), ['Tissage']);
});
