// Lancer avec : node --test server/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { courseKey } from '../shared/course-key.mjs';
import { scheduleKey, tokenKey } from '../shared/redis-keys.mjs';
import { hashToken } from '../shared/token.mjs';
import { createFeed, getFeedIcs } from './feed.mjs';

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

const requestWith = (body) => ({ json: async () => body });

// Base en mémoire : mêmes méthodes que le vrai client (shared/redis-client.mjs), rien de plus.
function inMemoryRedis(seed = {}) {
  const store = new Map(Object.entries(seed).map(([key, value]) => [key, JSON.stringify(value)]));
  return {
    store,
    setJson: async (key, value) => store.set(key, JSON.stringify(value)),
    getJson: async (key) => (store.has(key) ? JSON.parse(store.get(key)) : null),
    mgetJson: async (keys) => keys.map((key) => (store.has(key) ? JSON.parse(store.get(key)) : null)),
  };
}

test('createFeed stocke le hash du jeton, jamais le jeton en clair', async () => {
  const redis = inMemoryRedis();
  const response = await createFeed(redis, requestWith({ promotions: ['1AT'], lessonIds: ['a'] }));
  assert.equal(response.status, 200);
  const { token } = await response.json();

  assert.equal(redis.store.size, 1);
  const [storedKey, storedValue] = [...redis.store.entries()][0];
  assert.equal(storedKey, tokenKey(hashToken(token)));
  assert.ok(!storedKey.includes(token)); // la clé ne contient pas le jeton lui-même
  assert.deepEqual(JSON.parse(storedValue).lessonIds, ['a']);
});

test('createFeed refuse des promotions ou des lessonIds invalides', async () => {
  const redis = inMemoryRedis();
  await assert.rejects(createFeed(redis, requestWith({ promotions: [], lessonIds: [] })), { status: 400 });
  await assert.rejects(createFeed(redis, requestWith({ promotions: ['1AT'], lessonIds: 'pas-un-tableau' })), {
    status: 400,
  });
  await assert.rejects(createFeed(redis, requestWith('pas du json')), { status: 400 });
});

test('getFeedIcs répond 400 sans jeton et 404 pour un jeton inconnu', async () => {
  const redis = inMemoryRedis();
  await assert.rejects(getFeedIcs(redis, new URL('http://localhost/api/feed')), { status: 400 });
  await assert.rejects(getFeedIcs(redis, new URL('http://localhost/api/feed?token=inconnu')), { status: 404 });
});

test('getFeedIcs ne renvoie que les cours obligatoires et ceux sélectionnés', async () => {
  const redis = inMemoryRedis({
    [scheduleKey('1AT')]: record('1AT', [
      slot({ subject: 'Réunion de rentrée' }), // sans code : obligatoire
      slot({ subject: 'Tissage', code: 'TIS-1' }), // sélectionné
      slot({ subject: 'Couture', code: 'COU-1' }), // pas sélectionné
    ]),
  });
  const created = await createFeed(redis, requestWith({ promotions: ['1AT'], lessonIds: [`code:TIS-1|${courseKey('Tissage')}`] }));
  const { token } = await created.json();

  const response = await getFeedIcs(redis, new URL(`http://localhost/api/feed?token=${token}`));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'text/calendar; charset=utf-8');
  const ics = await response.text();
  assert.ok(ics.includes('SUMMARY:Réunion de rentrée'));
  assert.ok(ics.includes('SUMMARY:Tissage'));
  assert.ok(!ics.includes('SUMMARY:Couture'));
});

test('getFeedIcs ignore une promotion qui aurait disparu de Redis entre-temps', async () => {
  const redis = inMemoryRedis({ [scheduleKey('1AT')]: record('1AT', [slot({ subject: 'Tissage' })]) });
  const created = await createFeed(redis, requestWith({ promotions: ['1AT', '2AT'], lessonIds: [] }));
  const { token } = await created.json();

  const response = await getFeedIcs(redis, new URL(`http://localhost/api/feed?token=${token}`));
  assert.equal(response.status, 200);
  assert.ok((await response.text()).includes('SUMMARY:Tissage'));
});
