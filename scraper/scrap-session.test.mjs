// Lancer avec : node --test scraper/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openScrapSession } from './scrap-session.mjs';

// Fausse session Hyperplanning : les identifiants des promotions changent à chaque ouverture, comme en vrai.
// `failures` : nombre d'échanges qui échouent (et cassent leur session) avant que les suivants réussissent.
function fakeHyperplanning({ failures = 0, labels = ['1AT', '2AT'] } = {}) {
  const calls = [];
  let opened = 0;
  let remaining = failures;
  return {
    calls,
    get opened() {
      return opened;
    },
    open: async () => {
      opened += 1;
      return { session: { number: opened, broken: false }, generalParams: { opened } };
    },
    list: async (session) => labels.map((label) => ({ label, id: `${label}#${session.number}` })),
    fetchSchedule: async (session, promotion, weeksRange) => {
      calls.push({ session: session.number, id: promotion.id, weeksRange });
      if (session.broken) throw new Error('La page a expiré !');
      if (remaining > 0) {
        remaining -= 1;
        session.broken = true;
        throw new Error('The operation was aborted due to timeout');
      }
      return { ListeCours: [] };
    },
  };
}

const openWith = (fake, options = {}) =>
  openScrapSession({ open: fake.open, list: fake.list, fetchSchedule: fake.fetchSchedule, pause: async () => {}, ...options });

test('sans incident, une seule session sert toutes les promotions', async () => {
  const fake = fakeHyperplanning();
  const { promotions, generalParams, fetchRaw } = await openWith(fake);
  assert.deepEqual(generalParams, { opened: 1 });
  for (const promotion of promotions) await fetchRaw(promotion);
  await fetchRaw(promotions[0], '2..3');
  assert.equal(fake.opened, 1);
  assert.deepEqual(fake.calls, [
    { session: 1, id: '1AT#1', weeksRange: undefined },
    { session: 1, id: '2AT#1', weeksRange: undefined },
    { session: 1, id: '1AT#1', weeksRange: '2..3' },
  ]);
});

test('après un échange en échec, la session est rouverte et la promotion retentée avec son nouvel identifiant', async () => {
  const fake = fakeHyperplanning({ failures: 1 });
  const logs = [];
  const { promotions, fetchRaw } = await openWith(fake, { log: (message) => logs.push(message) });
  assert.deepEqual(await fetchRaw(promotions[0]), { ListeCours: [] });
  assert.deepEqual(await fetchRaw(promotions[1]), { ListeCours: [] });
  assert.equal(fake.opened, 2);
  assert.deepEqual(fake.calls.map(({ id }) => id), ['1AT#1', '1AT#2', '2AT#2']);
  assert.deepEqual(logs, ['Session invité interrompue : réouverture (1/3)']);
});

test("une erreur qui ne casse pas la session remonte telle quelle, sans réouverture", async () => {
  const fake = fakeHyperplanning();
  const { promotions, fetchRaw } = await openScrapSession({
    open: fake.open,
    list: fake.list,
    fetchSchedule: async () => {
      throw new Error('réponse inattendue');
    },
  });
  await assert.rejects(fetchRaw(promotions[0]), /réponse inattendue/);
  assert.equal(fake.opened, 1);
});

test('une promotion absente de la nouvelle session échoue', async () => {
  const fake = fakeHyperplanning({ failures: 1 });
  const { promotions, fetchRaw } = await openWith(fake, {
    list: async (session) => (session.number === 1 ? [{ label: '1AT', id: '1AT#1' }] : []),
  });
  await assert.rejects(fetchRaw(promotions[0]), /absente de la nouvelle session/);
});

test('les réouvertures sont limitées : ensuite, chaque promotion échoue sans requête', async () => {
  const fake = fakeHyperplanning({ failures: Infinity });
  const { promotions, fetchRaw } = await openWith(fake, { maxReopens: 2 });
  await assert.rejects(fetchRaw(promotions[0]), /timeout/); // 1re session, puis 2e : cassées
  await assert.rejects(fetchRaw(promotions[1]), /timeout/); // 3e session : cassée
  const callsBefore = fake.calls.length;
  await assert.rejects(fetchRaw(promotions[0]), /déjà rouverte 2 fois/);
  assert.equal(fake.opened, 3);
  assert.equal(fake.calls.length, callsBefore);
});
