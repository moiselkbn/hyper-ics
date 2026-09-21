// Lancer avec : node --test server/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SCHEDULE_INDEX_KEY } from '../shared/redis-keys.mjs';
import { buildPromotions, getPromotions } from './promotions.mjs';

const INDEX = {
  updatedAt: '2026-09-21T10:00:00.000Z',
  promotions: [
    { label: '3TI Web', curriculum: 'graphic-technics' },
    { label: '2EA', curriculum: 'applied-electronics' },
    { label: '2TE', curriculum: 'graphic-technics' },
    { label: '1TGRC1', curriculum: 'graphic-technics' },
    { label: '1TGRA', curriculum: 'graphic-technics' },
    { label: '2TI Web', curriculum: 'graphic-technics' },
    { label: '2TI 3D-Video', curriculum: 'graphic-technics' },
    { label: '1EAA', curriculum: 'applied-electronics' },
    { label: '1AT', curriculum: 'textile-arts' },
  ],
};

test('regroupe les promotions par cursus, dans l’ordre des cursus', () => {
  const { updatedAt, curricula } = buildPromotions(INDEX);
  assert.equal(updatedAt, INDEX.updatedAt);
  assert.deepEqual(
    curricula.map(({ id, name }) => [id, name]),
    [
      ['applied-electronics', 'Électronique appliquée'],
      ['graphic-technics', 'Techniques graphiques'],
      ['textile-arts', 'Arts du tissu'],
    ],
  );
});

test('trie les promotions par année puis par nom', () => {
  const graphic = buildPromotions(INDEX).curricula.find(({ id }) => id === 'graphic-technics');
  assert.deepEqual(
    graphic.promotions.map(({ label }) => label),
    ['1TGRA', '1TGRC1', '2TE', '2TI 3D-Video', '2TI Web', '3TI Web'],
  );
});

test('signale les promotions sans cours publié, sans deviner quand on ne sait pas', () => {
  const index = {
    updatedAt: INDEX.updatedAt,
    promotions: [
      { label: '1AT', curriculum: 'textile-arts', hasCourses: true },
      { label: '2AT', curriculum: 'textile-arts', hasCourses: false },
      { label: '3AT', curriculum: 'textile-arts' }, // index d'avant l'ajout du champ : inconnu
    ],
  };
  const [textile] = buildPromotions(index).curricula;
  assert.deepEqual(textile.promotions, [
    { label: '1AT', hasCourses: true },
    { label: '2AT', hasCourses: false },
    { label: '3AT', hasCourses: true },
  ]);
});

test('omet les cursus sans promotion', () => {
  const ids = buildPromotions(INDEX).curricula.map(({ id }) => id);
  assert.equal(ids.includes('advertising'), false);
  assert.equal(ids.includes('fashion-accessories'), false);
});

test('getPromotions lit l’index dans Redis', async () => {
  const redis = { getJson: async (key) => (key === SCHEDULE_INDEX_KEY ? INDEX : null) };
  const response = await getPromotions(redis);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).curricula.length, 3);
});

test('getPromotions échoue en 503 avant le premier scrap', async () => {
  await assert.rejects(getPromotions({ getJson: async () => null }), { status: 503 });
});
