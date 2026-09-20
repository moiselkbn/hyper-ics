// Lancer avec : node --test scraper/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { brusselsHour, isWithinScrapHours } from './scrap-window.mjs';

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
