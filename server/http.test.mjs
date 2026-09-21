// Lancer avec : node --test server/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { errorResponse, HttpError, jsonResponse, respond } from './http.mjs';

test('jsonResponse est mise en cache par le CDN', async () => {
  const response = jsonResponse({ ok: true });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('Cache-Control'), /s-maxage=300/);
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.deepEqual(await response.json(), { ok: true });
});

test('errorResponse n’est jamais mise en cache', async () => {
  const response = errorResponse(404, 'Introuvable');
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { error: 'Introuvable' });
});

test('respond renvoie la réponse de l’action', async () => {
  const response = await respond(async () => jsonResponse({ ok: true }));
  assert.equal(response.status, 200);
});

test('respond convertit une HttpError en réponse JSON', async () => {
  const response = await respond(async () => {
    throw new HttpError(400, 'Paramètre manquant');
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Paramètre manquant' });
});

test('respond masque une erreur inattendue derrière un 500 générique', async (t) => {
  const log = t.mock.method(console, 'error', () => {});
  const response = await respond(async () => {
    throw new Error('Redis GET : HTTP 500');
  });
  assert.equal(response.status, 500);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { error: 'Erreur interne' });
  assert.equal(log.mock.callCount(), 1); // le détail reste dans les journaux, pas dans la réponse
});
