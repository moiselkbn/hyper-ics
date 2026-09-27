// Lancer avec : node --test scraper/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PROMOTION_LABELS_KEY } from '../shared/redis-keys.mjs';
import { describePromotionChanges, formatPromotionChanges, watchPromotions } from './watch-promotions.mjs';

const NOW = new Date('2026-09-27T10:00:00.000Z');

// Base en mémoire : mêmes méthodes que le vrai client (shared/redis-client.mjs) ; `failing` fait échouer les écritures.
function inMemoryRedis(labels, { failing = false } = {}) {
  const store = new Map(labels ? [[PROMOTION_LABELS_KEY, JSON.stringify({ labels })]] : []);
  return {
    store,
    getJson: async (key) => (store.has(key) ? JSON.parse(store.get(key)) : null),
    setJson: async (key, value) => {
      if (failing) throw new Error('Redis indisponible');
      store.set(key, JSON.stringify(value));
    },
  };
}

const savedLabels = (redis) => JSON.parse(redis.store.get(PROMOTION_LABELS_KEY)).labels;

const NONE = { vanished: [], renamed: [], added: [], unknown: [] };

test('describePromotionChanges : rien de changé', () => {
  assert.deepEqual(describePromotionChanges(['3TI Web', 'Droit 2'], ['Droit 2', '3TI Web']), NONE);
});

test('describePromotionChanges : renommage par casse ou tirets, déjà suivi', () => {
  assert.deepEqual(describePromotionChanges(['3TI Web', '2TE'], ['3TI-WEB', '2TE']), {
    ...NONE,
    renamed: [['3TI Web', '3TI-WEB']],
  });
});

test('describePromotionChanges : vrai changement de nom, disparue sans correspondance et libellé inconnu', () => {
  assert.deepEqual(describePromotionChanges(['3TI Web', '2TE'], ['3TI Digital', '2TE']), {
    ...NONE,
    vanished: ['3TI Web'],
    unknown: ['3TI Digital'],
  });
});

test('describePromotionChanges : nouvelle promotion du périmètre, et nouvelle promotion hors périmètre', () => {
  assert.deepEqual(describePromotionChanges(['1SMA'], ['1SMA', '1SMF', '1ACC']), {
    ...NONE,
    added: ['1SMF'],
    unknown: ['1ACC'],
  });
});

test('describePromotionChanges : une promotion disparue hors du périmètre n’est pas signalée', () => {
  assert.deepEqual(describePromotionChanges(['Droit 2', '1TLM-1', '2TE'], ['2TE']), NONE);
});

test('describePromotionChanges : deux correspondances possibles, la disparition est signalée', () => {
  assert.deepEqual(describePromotionChanges(['3TI Web'], ['3TI-WEB', '3TIWEB']), {
    ...NONE,
    vanished: ['3TI Web'],
    added: ['3TI-WEB', '3TIWEB'],
  });
});

test('formatPromotionChanges met ce qui est à vérifier en premier', () => {
  const text = formatPromotionChanges({
    vanished: ['3TI Web'],
    renamed: [['2TI Web', '2TI-WEB']],
    added: ['1SMF'],
    unknown: ['3TI Digital'],
  });
  const order = ['- 3TI Web', '- 3TI Digital', '- 2TI Web -> 2TI-WEB', '- 1SMF'].map((line) => text.indexOf(line));
  assert.ok(order.every((position) => position >= 0), text);
  assert.deepEqual([...order].sort((a, b) => a - b), order);
});

test('watchPromotions : premier passage, enregistre la liste sans rien signaler', async () => {
  const redis = inMemoryRedis(null);
  const sent = [];
  const changes = await watchPromotions({ labels: ['2TE'], redis, notify: async (...mail) => sent.push(mail), now: NOW });
  assert.equal(changes, null);
  assert.deepEqual(sent, []);
  assert.deepEqual(JSON.parse(redis.store.get(PROMOTION_LABELS_KEY)), { updatedAt: NOW.toISOString(), labels: ['2TE'] });
});

test('watchPromotions : sans changement, n’envoie rien et ne réécrit pas la liste', async () => {
  const redis = inMemoryRedis(['2TE'], { failing: true });
  const sent = [];
  assert.equal(await watchPromotions({ labels: ['2TE'], redis, notify: async (...mail) => sent.push(mail) }), null);
  assert.deepEqual(sent, []);
});

test('watchPromotions : un changement est envoyé une seule fois', async () => {
  const redis = inMemoryRedis(['3TI Web', '2TE']);
  const sent = [];
  const notify = async (subject, text) => sent.push({ subject, text });
  const changes = await watchPromotions({ labels: ['3TI Digital', '2TE'], redis, notify });
  assert.deepEqual(changes.vanished, ['3TI Web']);
  assert.equal(sent.length, 1);
  assert.match(sent[0].text, /- 3TI Web/);
  assert.deepEqual(savedLabels(redis), ['3TI Digital', '2TE']);

  await watchPromotions({ labels: ['3TI Digital', '2TE'], redis, notify });
  assert.equal(sent.length, 1);
});

test('watchPromotions : si le mail échoue, la liste n’est pas réécrite pour réessayer au passage suivant', async () => {
  const redis = inMemoryRedis(['3TI Web']);
  const logs = [];
  const notify = async () => {
    throw new Error('Resend : HTTP 500');
  };
  assert.equal(await watchPromotions({ labels: ['3TI Digital'], redis, notify, log: (line) => logs.push(line) }), null);
  assert.deepEqual(savedLabels(redis), ['3TI Web']);
  assert.ok(logs.some((line) => line.includes('ÉCHEC (Resend : HTTP 500)')));
});

test('watchPromotions : sans moyen d’envoi, signale dans les logs et met la liste à jour', async () => {
  const redis = inMemoryRedis(['3TI Web']);
  const logs = [];
  const changes = await watchPromotions({ labels: ['3TI-WEB'], redis, notify: null, log: (line) => logs.push(line) });
  assert.deepEqual(changes.renamed, [['3TI Web', '3TI-WEB']]);
  assert.ok(logs.some((line) => line.includes('3TI Web -> 3TI-WEB')));
  assert.deepEqual(savedLabels(redis), ['3TI-WEB']);
});

test('watchPromotions : une liste vide d’Hyperplanning n’est ni signalée ni enregistrée', async () => {
  const redis = inMemoryRedis(['3TI Web']);
  const sent = [];
  assert.equal(await watchPromotions({ labels: [], redis, notify: async (...mail) => sent.push(mail) }), null);
  assert.deepEqual(sent, []);
  assert.deepEqual(savedLabels(redis), ['3TI Web']);
});

test('watchPromotions : une panne de Redis ne fait pas échouer le scrap', async () => {
  const redis = {
    getJson: async () => {
      throw new Error('Redis indisponible');
    },
  };
  const logs = [];
  assert.equal(await watchPromotions({ labels: ['2TE'], redis, notify: null, log: (line) => logs.push(line) }), null);
  assert.ok(logs.some((line) => line.includes('ÉCHEC')));
});
