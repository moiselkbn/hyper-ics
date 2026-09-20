// Lancer avec : node --test shared/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { courseKey } from './course-key.mjs';

test('courseKey met en minuscules et nettoie les espaces', () => {
  assert.equal(courseKey('  Nouvelle   technologie Q5 '), 'nouvelle technologie q5');
});

test('courseKey unifie les formes Unicode', () => {
  assert.equal(courseKey('Étalage'), courseKey('Étalage')); // é composé ou décomposé
});

test('courseKey distingue deux matières différentes', () => {
  assert.notEqual(courseKey('Infographie 3D Q3'), courseKey('Nv. techno. ap. à la 3D Q3'));
});
