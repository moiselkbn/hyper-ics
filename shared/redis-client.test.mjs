// Lancer avec : node --test shared/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRedisClient } from './redis-client.mjs';

const URL = 'https://exemple.upstash.io';
const TOKEN = 'jeton-de-test';

// Faux fetch : enregistre les appels et renvoie la réponse programmée.
function fakeFetch(body, status = 200) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options, sent: JSON.parse(options.body) });
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  return { fetchImpl, calls };
}

const clientWith = (body, status) => {
  const { fetchImpl, calls } = fakeFetch(body, status);
  return { client: createRedisClient({ url: URL, token: TOKEN, fetchImpl }), calls };
};

test('envoie la commande en POST JSON avec le jeton Bearer', async () => {
  const { client, calls } = clientWith({ result: 'valeur' });
  assert.equal(await client.get('user:abc'), 'valeur');
  assert.equal(calls[0].url, URL);
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers.Authorization, `Bearer ${TOKEN}`);
  assert.deepEqual(calls[0].sent, ['GET', 'user:abc']);
});

test('get renvoie null pour une clé absente', async () => {
  const { client } = clientWith({ result: null });
  assert.equal(await client.get('absente'), null);
});

test('set, del et mget envoient les bonnes commandes', async () => {
  const set = clientWith({ result: 'OK' });
  assert.equal(await set.client.set('k', 'v'), 'OK');
  assert.deepEqual(set.calls[0].sent, ['SET', 'k', 'v']);

  const del = clientWith({ result: 1 });
  assert.equal(await del.client.del('k'), 1);
  assert.deepEqual(del.calls[0].sent, ['DEL', 'k']);

  const mget = clientWith({ result: ['a', null] });
  assert.deepEqual(await mget.client.mget(['k1', 'k2']), ['a', null]);
  assert.deepEqual(mget.calls[0].sent, ['MGET', 'k1', 'k2']);
});

test('mget sans clé ne fait aucune requête', async () => {
  const { client, calls } = clientWith({ result: [] });
  assert.deepEqual(await client.mget([]), []);
  assert.deepEqual(await client.mgetJson([]), []);
  assert.equal(calls.length, 0);
});

test('les variantes JSON sérialisent et désérialisent', async () => {
  const set = clientWith({ result: 'OK' });
  await set.client.setJson('k', { promotion: '3TI Web', selection: [] });
  assert.deepEqual(set.calls[0].sent, ['SET', 'k', '{"promotion":"3TI Web","selection":[]}']);

  const get = clientWith({ result: '{"a":1}' });
  assert.deepEqual(await get.client.getJson('k'), { a: 1 });

  const absent = clientWith({ result: null });
  assert.equal(await absent.client.getJson('k'), null);

  const mget = clientWith({ result: ['{"a":1}', null] });
  assert.deepEqual(await mget.client.mgetJson(['k1', 'k2']), [{ a: 1 }, null]);
});

test("lève une erreur claire si Redis répond avec une erreur, sans fuiter jeton ni clé", async () => {
  const { client } = clientWith({ error: 'WRONGTYPE Operation against a key' }, 200);
  await assert.rejects(client.get('user:secret-hash'), (error) => {
    assert.match(error.message, /Redis GET : WRONGTYPE/);
    assert.ok(!error.message.includes(TOKEN));
    assert.ok(!error.message.includes('secret-hash'));
    return true;
  });
});

test('lève une erreur sur un statut HTTP en échec', async () => {
  const { client } = clientWith({}, 401);
  await assert.rejects(client.get('k'), /Redis GET : HTTP 401/);
});

test("refuse de démarrer sans adresse ni jeton", () => {
  assert.throws(() => createRedisClient({ url: undefined, token: undefined }), /UPSTASH_REDIS_REST_URL/);
  assert.throws(() => createRedisClient({ url: URL, token: '' }), /UPSTASH_REDIS_REST_TOKEN/);
});

test('setJson avec un délai demande à Redis d’effacer la clé ensuite', async () => {
  const { client, calls } = clientWith({ result: 'OK' });
  await client.setJson('k', { a: 1 }, 604800);
  assert.deepEqual(calls[0].sent, ['SET', 'k', '{"a":1}', 'EX', 604800]);
});
