// Lancer avec : node --test server/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SCHEDULE_INDEX_KEY, subscriptionKey } from '../shared/redis-keys.mjs';
import { generateToken, hashToken } from '../shared/token.mjs';
import {
  chooseModes,
  createSubscription,
  getSubscription,
  isLessonFollowed,
  parseSelection,
  updateSubscription,
} from './subscription.mjs';

const NOW = new Date('2026-09-24T10:00:00.000Z');
const LATER = new Date('2026-09-25T08:00:00.000Z');

// Base en mémoire : mêmes méthodes que le vrai client (shared/redis-client.mjs), rien de plus.
function inMemoryRedis(seed = {}) {
  const store = new Map(Object.entries(seed).map(([key, value]) => [key, JSON.stringify(value)]));
  return {
    store,
    setJson: async (key, value) => store.set(key, JSON.stringify(value)),
    getJson: async (key) => (store.has(key) ? JSON.parse(store.get(key)) : null),
  };
}

const index = (...labels) => ({ [SCHEDULE_INDEX_KEY]: { promotions: labels.map((label) => ({ label })) } });
const post = (body) => ({ url: 'http://localhost/api/subscription', json: async () => body });
const put = (token, body) => ({ url: `http://localhost/api/subscription?token=${token}`, json: async () => body });
const entry = (label, checked = [], unchecked = []) => ({ label, checked, unchecked });

// --- Validation du corps

test('parseSelection garde, par promotion, les clés cochées et décochées', () => {
  assert.deepEqual(parseSelection({ promotions: [entry(' 3TI Web ', ['a', 'a'], ['b'])] }), [
    { label: '3TI Web', checked: ['a'], unchecked: ['b'] },
  ]);
});

test('parseSelection traite une clé à la fois cochée et décochée comme cochée', () => {
  const [{ checked, unchecked }] = parseSelection({ promotions: [entry('3TI Web', ['a'], ['a', 'b'])] });
  assert.deepEqual(checked, ['a']);
  assert.deepEqual(unchecked, ['b']);
});

test('parseSelection refuse un corps invalide', () => {
  const invalid = [
    null,
    {},
    { promotions: 'pas-un-tableau' },
    { promotions: [] }, // aucune promotion
    { promotions: [entry('1AT'), entry('2AT'), entry('3AT')] }, // trois promotions
    { promotions: [entry('1AT'), entry('1AT')] }, // deux fois la même
    { promotions: [entry('')] },
    { promotions: [{ label: 'x'.repeat(41), checked: [], unchecked: [] }] },
    { promotions: [{ label: '1AT', checked: 'a', unchecked: [] }] },
    { promotions: [{ label: '1AT', checked: [], unchecked: [42] }] },
    { promotions: [entry('1AT', [''])] },
    { promotions: [entry('1AT', ['x'.repeat(201)])] },
    { promotions: [entry('1AT', Array.from({ length: 201 }, (_, i) => `cours ${i}`))] },
  ];
  for (const body of invalid) assert.throws(() => parseSelection(body), { status: 400 }, JSON.stringify(body));
});

// --- Choix du mode par promotion

test('une seule promotion suit tout sauf les cours décochés, même si peu de cours sont gardés', () => {
  assert.deepEqual(chooseModes([entry('3TI Web', ['a'], ['b', 'c', 'd'])]), [
    { label: '3TI Web', mode: 'all-except', keys: ['b', 'c', 'd'] },
  ]);
});

test('chevauchement : la promotion gardée suit tout, l’autre seulement les cours cochés', () => {
  assert.deepEqual(chooseModes([entry('3TI Web', ['a', 'b', 'c'], ['d']), entry('2TI Web', ['x'], ['y', 'z', 'w'])]), [
    { label: '3TI Web', mode: 'all-except', keys: ['d'] },
    { label: '2TI Web', mode: 'only', keys: ['x'] },
  ]);
});

test('la moitié des cours gardés suffit pour suivre toute la promotion', () => {
  const modes = chooseModes([entry('3TI Web', ['a'], ['b']), entry('2TI Web', ['x', 'y'], [])]);
  assert.deepEqual(modes.map((promotion) => promotion.mode), ['all-except', 'all-except']);
});

test('une promotion sans cours à choisir (pas encore publiée) suit tout ce qui y sera publié', () => {
  const modes = chooseModes([entry('3TI Web', ['a'], ['b', 'c']), entry('2SMC')]);
  assert.deepEqual(modes, [
    { label: '3TI Web', mode: 'only', keys: ['a'] },
    { label: '2SMC', mode: 'all-except', keys: [] },
  ]);
});

test('si aucune promotion n’atteint la moitié, la plus gardée suit quand même tout', () => {
  const modes = chooseModes([entry('3TI Web', ['a'], ['b', 'c', 'd', 'e']), entry('2TI Web', ['x', 'y'], ['z', 'w', 'v'])]);
  assert.deepEqual(modes, [
    { label: '3TI Web', mode: 'only', keys: ['a'] },
    { label: '2TI Web', mode: 'all-except', keys: ['z', 'w', 'v'] },
  ]);
});

// --- Cours suivis

const lesson = (key, promotions, mandatory = false) => ({ key, promotions, mandatory });
const subscription = {
  promotions: [
    { label: '3TI Web', mode: 'all-except', keys: ['decoche'] },
    { label: '2TI Web', mode: 'only', keys: ['coche'] },
  ],
};

test('un cours obligatoire est toujours suivi', () => {
  assert.equal(isLessonFollowed(lesson('reunion', ['2TI Web'], true), subscription), true);
});

test('all-except : tout cours de la promotion est suivi, y compris un nouveau, sauf s’il a été décoché', () => {
  assert.equal(isLessonFollowed(lesson('nouveau', ['3TI Web']), subscription), true);
  assert.equal(isLessonFollowed(lesson('decoche', ['3TI Web']), subscription), false);
});

test('only : seul un cours coché est suivi, un nouveau cours ne l’est pas', () => {
  assert.equal(isLessonFollowed(lesson('coche', ['2TI Web']), subscription), true);
  assert.equal(isLessonFollowed(lesson('nouveau', ['2TI Web']), subscription), false);
});

test('un cours commun aux deux promotions est suivi si l’une d’elles le retient', () => {
  assert.equal(isLessonFollowed(lesson('commun', ['3TI Web', '2TI Web']), subscription), true);
  assert.equal(isLessonFollowed(lesson('decoche', ['3TI Web', '2TI Web']), subscription), false);
});

// --- Création, lecture, mise à jour

test('createSubscription stocke le hash du jeton, jamais le jeton en clair, avec le mode de chaque promotion', async () => {
  const redis = inMemoryRedis(index('3TI Web', '2TI Web'));
  const response = await createSubscription(
    redis,
    post({ promotions: [entry('3TI Web', ['a', 'b'], ['c']), entry('2TI Web', ['x'], ['y', 'z'])] }),
    NOW,
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const { token } = await response.json();

  const key = subscriptionKey(hashToken(token));
  assert.ok(!key.includes(token));
  assert.equal(redis.store.has(key), true);
  assert.ok(![...redis.store.values()].some((value) => value.includes(token)));
  assert.deepEqual(JSON.parse(redis.store.get(key)), {
    promotions: [
      { label: '3TI Web', mode: 'all-except', keys: ['c'] },
      { label: '2TI Web', mode: 'only', keys: ['x'] },
    ],
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  });
});

test('createSubscription refuse une promotion absente de l’index et un corps invalide', async () => {
  const redis = inMemoryRedis(index('3TI Web'));
  await assert.rejects(createSubscription(redis, post({ promotions: [entry('9XYZ')] })), { status: 404 });
  await assert.rejects(createSubscription(inMemoryRedis(), post({ promotions: [entry('3TI Web')] })), { status: 404 });
  await assert.rejects(createSubscription(redis, { url: 'http://localhost/', json: async () => { throw new SyntaxError(); } }), {
    status: 400,
  });
  assert.equal(redis.store.size, 1); // seul l'index : rien n'a été écrit
});

test('getSubscription répond 400 sans jeton et 404 pour un jeton mal formé ou inconnu', async () => {
  const redis = inMemoryRedis();
  const get = (query) => getSubscription(redis, new URL(`http://localhost/api/subscription${query}`));
  await assert.rejects(get(''), { status: 400 });
  await assert.rejects(get('?token=pas-un-jeton'), { status: 404 });
  await assert.rejects(get(`?token=${generateToken()}`), { status: 404 });
});

test('getSubscription renvoie les promotions de l’abonnement', async () => {
  const redis = inMemoryRedis(index('3TI Web'));
  const { token } = await (await createSubscription(redis, post({ promotions: [entry('3TI Web', ['a'])] }))).json();
  const response = await getSubscription(redis, new URL(`http://localhost/api/subscription?token=${token}`));
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { promotions: ['3TI Web'] });
});

test('updateSubscription remplace la sélection sous le même jeton et garde la date de création', async () => {
  const redis = inMemoryRedis(index('3TI Web', '2TI Web'));
  const { token } = await (await createSubscription(redis, post({ promotions: [entry('3TI Web', ['a'], ['b'])] }), NOW)).json();

  const response = await updateSubscription(redis, put(token, { promotions: [entry('2TI Web', ['x'])] }), LATER);
  assert.equal(response.status, 200);
  assert.equal(redis.store.size, 2); // l'index et le même abonnement, pas un second
  assert.deepEqual(JSON.parse(redis.store.get(subscriptionKey(hashToken(token)))), {
    promotions: [{ label: '2TI Web', mode: 'all-except', keys: [] }],
    createdAt: NOW.toISOString(),
    updatedAt: LATER.toISOString(),
  });
});

test('updateSubscription répond 404 pour un jeton inconnu, sans rien écrire', async () => {
  const redis = inMemoryRedis(index('3TI Web'));
  await assert.rejects(updateSubscription(redis, put(generateToken(), { promotions: [entry('3TI Web')] })), { status: 404 });
  assert.equal(redis.store.size, 1);
});
