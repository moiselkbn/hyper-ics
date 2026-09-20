// Lancer avec : node --test scraper/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CURRICULA, getCurriculum, isInWatersideScope } from './campus-scope.mjs';

test('accepte les promotions de Waterside', () => {
  const inScope = [
    '2EA', '3EA', '1EAA', '1EAB', // électronique appliquée
    '1TGRA', '1TGRC1', '1TGRC2', '2TE', '3TE', // techniques graphiques
    '2TI Web', '3TI 3D-Video', '3TI Edition', // spécialisations
    '1AT', '3AT', // arts du tissu
    '1PUBA', '2PUBB', '3PUB A', // publicité, avec ou sans espace
    '1SMA', '1SME', '3SMC', // stylisme et modélisme
  ];
  for (const label of inScope) assert.ok(isInWatersideScope(label), label);
});

test('refuse les autres promotions', () => {
  const outOfScope = [
    'Droit 2', 'Comptabilité 1 (soir)', 'Informatique 3', 'Assistant 1', // hors campus
    '1TLM-1', '3TLM-cyto', // laboratoire médical
    '1TGRD2 (OUT)', // groupe sorti
    'SMOD', // sans chiffre : ambigu, exclu par prudence
    '', '1AT extra',
  ];
  for (const label of outOfScope) assert.equal(isInWatersideScope(label), false, label);
});

test('getCurriculum renvoie le cursus de la promotion', () => {
  const expected = {
    '2EA': 'applied-electronics',
    '1EAB': 'applied-electronics',
    '1TGRC1': 'graphic-technics',
    '2TE': 'graphic-technics',
    '3TI Web': 'graphic-technics',
    '2AT': 'textile-arts',
    '3PUB A': 'advertising',
    '1SME': 'fashion-design',
  };
  for (const [label, id] of Object.entries(expected)) assert.equal(getCurriculum(label)?.id, id, label);
  assert.equal(getCurriculum('3TI Web').name, 'Techniques graphiques');
  assert.equal(getCurriculum('Droit 2'), undefined);
});

test('chaque cursus a un identifiant et un intitulé uniques', () => {
  assert.equal(new Set(CURRICULA.map(({ id }) => id)).size, CURRICULA.length);
  assert.equal(new Set(CURRICULA.map(({ name }) => name)).size, CURRICULA.length);
});

test("aucune promotion n'appartient à deux cursus", () => {
  const labels = ['2EA', '1EAA', '1TGRA', '1TGRC2', '2TE', '3TI Web', '1AT', '1PUBB', '3PUB B', '1SMA', '3SMC'];
  for (const label of labels) {
    const matches = CURRICULA.filter(({ patterns }) => patterns.some((pattern) => pattern.test(label)));
    assert.equal(matches.length, 1, label);
  }
});
