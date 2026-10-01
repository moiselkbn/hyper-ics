// Lancer avec : node --test server/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { APPLE_CONFIRMATION_MS, detectReader, isAddConfirmed, READ_WRITE_INTERVAL_MS, withRead } from './feed-reads.mjs';

const NOW = new Date('2026-10-01T10:00:00.000Z');
const after = (ms) => new Date(NOW.getTime() + ms);
const read = (firstReadAt, lastReadAt = firstReadAt) => ({ firstReadAt: firstReadAt.toISOString(), lastReadAt: lastReadAt.toISOString() });

test('detectReader reconnaît Calendrier d’Apple et Google Agenda, rien d’autre', () => {
  assert.equal(detectReader('macOS/27.0 (26A428) dataaccessd/1.0'), 'apple');
  assert.equal(detectReader('iOS/27.0 (24A335) dataaccessd/1.0'), 'apple');
  assert.equal(detectReader('Mac OS X/10.13.6 (17G65) CalendarAgent/399.2.4'), 'apple');
  assert.equal(detectReader('Google-Calendar-Importer'), 'google');
  assert.equal(
    detectReader('Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1'),
    null,
  );
  assert.equal(detectReader('curl/8.7.1'), null);
  assert.equal(detectReader(null), null);
  assert.equal(detectReader(''), null);
});

test('withRead note la première lecture d’une application, sans toucher aux autres', () => {
  const google = read(after(-5 * 60 * 60 * 1000));
  assert.deepEqual(withRead(null, 'apple', NOW), { apple: read(NOW) });
  assert.deepEqual(withRead({ google }, 'apple', NOW), { google, apple: read(NOW) });
});

test('Apple : l’ajout n’est confirmé qu’à une lecture au moins 10 min après la première', () => {
  assert.equal(isAddConfirmed('apple', read(NOW)), false);
  assert.equal(isAddConfirmed('apple', read(NOW, after(APPLE_CONFIRMATION_MS - 1))), false);
  assert.equal(isAddConfirmed('apple', read(NOW, after(APPLE_CONFIRMATION_MS))), true);
});

test('Google : l’ajout est confirmé dès la première lecture', () => {
  assert.equal(isAddConfirmed('google', read(NOW)), true);
});

test('Apple non confirmé : chaque lecture est notée, la première date reste', () => {
  const first = { apple: read(NOW) };
  const second = withRead(first, 'apple', after(30 * 1000));
  assert.deepEqual(second, { apple: read(NOW, after(30 * 1000)) });
  // La lecture qui confirme l'ajout est notée tout de suite, pas une heure plus tard.
  const confirming = withRead(second, 'apple', after(APPLE_CONFIRMATION_MS));
  assert.deepEqual(confirming, { apple: read(NOW, after(APPLE_CONFIRMATION_MS)) });
  assert.equal(isAddConfirmed('apple', confirming.apple), true);
});

test('ajout confirmé : la dernière lecture n’est réécrite qu’une fois par heure au plus', () => {
  const google = { google: read(NOW) };
  assert.equal(withRead(google, 'google', after(READ_WRITE_INTERVAL_MS - 1)), null);
  assert.deepEqual(withRead(google, 'google', after(READ_WRITE_INTERVAL_MS)), { google: read(NOW, after(READ_WRITE_INTERVAL_MS)) });

  const confirmed = after(APPLE_CONFIRMATION_MS);
  const apple = { apple: read(NOW, confirmed) };
  assert.equal(withRead(apple, 'apple', new Date(confirmed.getTime() + 20 * 60 * 1000)), null);
  const later = new Date(confirmed.getTime() + READ_WRITE_INTERVAL_MS);
  assert.deepEqual(withRead(apple, 'apple', later), { apple: read(NOW, later) });
});
