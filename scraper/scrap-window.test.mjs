// Lancer avec : node --test scraper/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { brusselsHour, FRESH_MINUTES, isFresh, isWithinScrapHours } from './scrap-window.mjs';

test('brusselsHour convertit l’heure UTC en heure de Bruxelles', () => {
  assert.equal(brusselsHour(new Date('2026-07-15T05:17:00Z')), 7); // été : UTC+2
  assert.equal(brusselsHour(new Date('2026-01-15T05:17:00Z')), 6); // hiver : UTC+1
});

test('brusselsHour renvoie 0 à minuit, pas 24', () => {
  assert.equal(brusselsHour(new Date('2026-07-14T22:00:00Z')), 0);
});

test('en été, la plage va de 5h17 à 15h17 UTC', () => {
  assert.equal(isWithinScrapHours(new Date('2026-07-15T04:17:00Z')), false); // 6h17
  assert.equal(isWithinScrapHours(new Date('2026-07-15T05:17:00Z')), true); // 7h17
  assert.equal(isWithinScrapHours(new Date('2026-07-15T15:17:00Z')), true); // 17h17
  assert.equal(isWithinScrapHours(new Date('2026-07-15T16:17:00Z')), false); // 18h17
});

test('en hiver, la plage va de 6h17 à 16h17 UTC', () => {
  assert.equal(isWithinScrapHours(new Date('2026-01-15T05:17:00Z')), false); // 6h17
  assert.equal(isWithinScrapHours(new Date('2026-01-15T06:17:00Z')), true); // 7h17
  assert.equal(isWithinScrapHours(new Date('2026-01-15T16:17:00Z')), true); // 17h17
  assert.equal(isWithinScrapHours(new Date('2026-01-15T17:17:00Z')), false); // 18h17
});

test('le passage à l’heure d’été (29 mars 2026) décale la plage d’une heure', () => {
  assert.equal(isWithinScrapHours(new Date('2026-03-28T05:17:00Z')), false); // 6h17 (hiver)
  assert.equal(isWithinScrapHours(new Date('2026-03-29T05:17:00Z')), true); // 7h17 (été)
});

test('le passage à l’heure d’hiver (25 octobre 2026) décale la plage d’une heure', () => {
  assert.equal(isWithinScrapHours(new Date('2026-10-24T05:17:00Z')), true); // 7h17 (été)
  assert.equal(isWithinScrapHours(new Date('2026-10-25T05:17:00Z')), false); // 6h17 (hiver)
});

test('chaque jour, les heures UTC du cron (5h à 16h) couvrent toute la plage locale', () => {
  for (const day of ['2026-01-15', '2026-07-15']) {
    const inRange = [];
    for (let hour = 5; hour <= 16; hour++) {
      const date = new Date(`${day}T${String(hour).padStart(2, '0')}:17:00Z`);
      if (isWithinScrapHours(date)) inRange.push(brusselsHour(date));
    }
    assert.deepEqual(inRange, [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17], day);
  }
});

// --- Garde de fraîcheur : le cron se déclenche toutes les 15 minutes, on ne scrape qu'environ une fois par heure.

const NOW = new Date('2026-09-21T10:00:00Z');
const minutesAgo = (minutes) => new Date(NOW - minutes * 60_000).toISOString();

test('un scrap récent est frais, un scrap ancien ne l’est plus', () => {
  assert.equal(isFresh(minutesAgo(0), NOW), true);
  assert.equal(isFresh(minutesAgo(15), NOW), true);
  assert.equal(isFresh(minutesAgo(120), NOW), false);
});

test('la limite de fraîcheur est FRESH_MINUTES', () => {
  assert.equal(FRESH_MINUTES, 50);
  assert.equal(isFresh(minutesAgo(FRESH_MINUTES - 1), NOW), true);
  assert.equal(isFresh(minutesAgo(FRESH_MINUTES), NOW), false);
});

test('un index absent, invalide ou daté du futur n’est pas frais', () => {
  assert.equal(isFresh(undefined, NOW), false);
  assert.equal(isFresh(null, NOW), false);
  assert.equal(isFresh('pas une date', NOW), false);
  assert.equal(isFresh(minutesAgo(-5), NOW), false);
});

// Joue les déclenchements (HH:12, :27, :42, :57) : renvoie les instants où un vrai scrap a lieu.
function simulate({ from, hours, dropped = () => false, lastScrap = null }) {
  const scraps = [];
  let updatedAt = lastScrap;
  for (let step = 0; step < hours * 4; step++) {
    const tick = new Date(from.getTime() + step * 15 * 60_000);
    if (dropped(tick)) continue;
    if (!isFresh(updatedAt, tick)) {
      scraps.push(tick.toISOString().slice(11, 16));
      updatedAt = tick.toISOString();
    }
  }
  return scraps;
}

test('quand tous les déclenchements arrivent, un scrap a lieu toutes les heures', () => {
  const scraps = simulate({ from: new Date('2026-09-21T05:12:00Z'), hours: 6 });
  assert.deepEqual(scraps, ['05:12', '06:12', '07:12', '08:12', '09:12', '10:12']);
});

test('un déclenchement manqué est rattrapé par le suivant', () => {
  // Le scrap de 07:12 est perdu : celui de 07:27 le remplace, puis le rythme repart de là.
  const scraps = simulate({
    from: new Date('2026-09-21T05:12:00Z'),
    hours: 4,
    dropped: (tick) => tick.toISOString().slice(11, 16) === '07:12',
  });
  assert.deepEqual(scraps, ['05:12', '06:12', '07:27', '08:27']);
});

test('même si 3 déclenchements sur 4 sont perdus, chaque heure a son scrap', () => {
  const scraps = simulate({
    from: new Date('2026-09-21T05:12:00Z'),
    hours: 6,
    dropped: (tick) => tick.getUTCMinutes() !== 42,
  });
  assert.deepEqual(scraps, ['05:42', '06:42', '07:42', '08:42', '09:42', '10:42']);
});

test('un déclenchement isolé ne scrape pas si le dernier scrap est récent', () => {
  // Trois déclenchements : 09:27, 09:42 et 09:57, tous à moins de 50 minutes de 09:12.
  const scraps = simulate({ from: new Date('2026-09-21T09:27:00Z'), hours: 0.75, lastScrap: '2026-09-21T09:12:00.000Z' });
  assert.deepEqual(scraps, []);
  // Le suivant, à 10:12, est à 60 minutes : il scrape.
  assert.deepEqual(simulate({ from: new Date('2026-09-21T10:12:00Z'), hours: 0.25, lastScrap: '2026-09-21T09:12:00.000Z' }), ['10:12']);
});
