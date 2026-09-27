// Lancer avec : node --test scraper/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CURRICULA,
  findRenamedPromotion,
  getCurriculum,
  isInWatersideScope,
  PROMOTION_RENAMES,
  simplifyPromotionLabel,
} from './campus-scope.mjs';

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
    '1TGRD2 (OUT)', '1TGRD2(OUT)', // groupe sorti
    'SMOD', // sans chiffre : ambigu, exclu par prudence
    '', '1AT extra',
  ];
  for (const label of outOfScope) assert.equal(isInWatersideScope(label), false, label);
});

test("reste reconnue si l'école change la casse, les espaces, les tirets ou les accents", () => {
  const renamed = {
    '3TI-WEB': 'graphic-technics',
    '3ti web': 'graphic-technics',
    '3TI 3D Video': 'graphic-technics',
    '2TI Édition': 'graphic-technics',
    '3PUB-A': 'advertising',
    '1 TGR C1': 'graphic-technics',
    '2-EA': 'applied-electronics',
    ' 1sma ': 'fashion-design',
  };
  for (const [label, id] of Object.entries(renamed)) assert.equal(getCurriculum(label)?.id, id, label);
});

test('simplifyPromotionLabel ne garde que les lettres, chiffres et parenthèses, en majuscules', () => {
  assert.equal(simplifyPromotionLabel('3TI 3D-Video'), '3TI3DVIDEO');
  assert.equal(simplifyPromotionLabel('3TLM-c.c.'), '3TLMCC');
  assert.equal(simplifyPromotionLabel('1TGRD2 (OUT)'), '1TGRD2(OUT)');
  assert.equal(simplifyPromotionLabel('Comptabilité 1 (soir)'), 'COMPTABILITE1(SOIR)');
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
    const matches = CURRICULA.filter(({ patterns }) => patterns.some((pattern) => pattern.test(simplifyPromotionLabel(label))));
    assert.equal(matches.length, 1, label);
  }
});

test('PROMOTION_RENAMES : chaque ligne part d’une promotion du périmètre vers un autre libellé', () => {
  for (const [from, to] of Object.entries(PROMOTION_RENAMES)) {
    assert.ok(isInWatersideScope(from), from);
    assert.notEqual(from.trim(), to.trim(), from);
  }
});

test('un libellé de la table entre dans le périmètre avec le cursus de l’ancien, même au bout d’une chaîne', () => {
  const renames = { '3TI Web': '3TI Digital', '3TI Digital': 'TI3 Numérique' };
  assert.equal(getCurriculum('3TI Digital', { renames })?.id, 'graphic-technics');
  assert.equal(getCurriculum('TI3 Numérique', { renames })?.id, 'graphic-technics');
  assert.equal(isInWatersideScope('3TI Digital'), false); // sans la ligne, hors périmètre
  // Une boucle dans la table ne bloque pas.
  assert.equal(getCurriculum('X', { renames: { X: 'Y', Y: 'X' } }), undefined);
  // Un libellé ne tombe jamais sur une propriété héritée.
  assert.equal(getCurriculum('constructor', { renames: {} }), undefined);
});

test('findRenamedPromotion : la table d’abord, en suivant la chaîne jusqu’à un libellé listé', () => {
  const renames = { '3TI Web': '3TI Digital', '3TI Digital': 'TI3 Numérique' };
  assert.equal(findRenamedPromotion('3TI Web', ['3TI Digital', '2TE'], { renames }), '3TI Digital');
  assert.equal(findRenamedPromotion('3TI Web', ['TI3 Numérique', '2TE'], { renames }), 'TI3 Numérique');
  // La table l'emporte sur le libellé simplifié.
  assert.equal(findRenamedPromotion('3TI Web', ['3TI Digital', '3TI-WEB'], { renames }), '3TI Digital');
  assert.equal(findRenamedPromotion('X', ['Z'], { renames: { X: 'Y', Y: 'X' } }), null);
  assert.equal(findRenamedPromotion('constructor', ['2TE'], { renames: {} }), null);
});

test('findRenamedPromotion : sinon, l’unique libellé listé au même libellé simplifié', () => {
  assert.equal(findRenamedPromotion('3TI Web', ['3TI-WEB', '2TE'], { renames: {} }), '3TI-WEB');
  assert.equal(findRenamedPromotion('3TI Web', ['3TI-WEB', '3TIWEB'], { renames: {} }), null);
  assert.equal(findRenamedPromotion('3TI Web', ['3TI Digital'], { renames: {} }), null);
});
