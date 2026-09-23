// Lancer avec : node --test server/
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { generateToken } from '../shared/token.mjs';
import { APP_MANIFEST, getManifest } from './manifest.mjs';

test('le manifest de la fonction reprend exactement public/manifest.json', async () => {
  const file = JSON.parse(await readFile(new URL('../public/manifest.json', import.meta.url), 'utf8'));
  assert.deepEqual(APP_MANIFEST, file);
});

test('getManifest fait démarrer l’app sur la page de l’élève', async () => {
  const token = generateToken();
  const response = getManifest(new URL(`http://localhost/api/manifest?token=${token}`));
  assert.equal(response.headers.get('Content-Type'), 'application/manifest+json');
  assert.deepEqual(await response.json(), { ...APP_MANIFEST, start_url: `/m/${token}` });
});

test('getManifest refuse un jeton absent ou mal formé', () => {
  assert.throws(() => getManifest(new URL('http://localhost/api/manifest')), { status: 400 });
  assert.throws(() => getManifest(new URL('http://localhost/api/manifest?token=../../etc')), { status: 400 });
});
