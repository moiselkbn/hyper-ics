// Lancer avec : node --test server/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildIcs } from './ics.mjs';

const NOW = new Date('2026-09-01T00:00:00.000Z');
const FIRST_MONDAY = '2026-09-14'; // lundi de la semaine 1

const lesson = (overrides) => ({ id: 'x', subject: 'Anglais 1', teachers: ['Marchi'], occurrences: [], ...overrides });

function eventLines(ics) {
  const body = ics.split('\r\n').slice(0, -1); // retire la ligne vide finale
  const start = body.indexOf('BEGIN:VEVENT');
  const end = body.indexOf('END:VEVENT');
  return body.slice(start, end + 1);
}

test('encadre le flux et place un VEVENT par occurrence', () => {
  const ics = buildIcs(
    [lesson({ occurrences: ['1|0|08:00|09:30', '1|3|08:00|09:30'] })],
    FIRST_MONDAY,
    NOW,
  );
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.equal(ics.split('BEGIN:VEVENT').length - 1, 2);
});

test('un cours en septembre (heure d’été) : 08:00 Bruxelles = 06:00 UTC', () => {
  const ics = buildIcs([lesson({ occurrences: ['1|0|08:00|09:30'] })], FIRST_MONDAY, NOW);
  const lines = eventLines(ics);
  assert.ok(lines.includes('DTSTART:20260914T060000Z'));
  assert.ok(lines.includes('DTEND:20260914T073000Z'));
});

test('un cours fin décembre (heure d’hiver) : 10:00 Bruxelles = 09:00 UTC', () => {
  // Semaine 16, mercredi (jour 2) : 14/09/2026 + 15 semaines + 2 jours = 30/12/2026.
  const ics = buildIcs([lesson({ occurrences: ['16|2|10:00|12:00'] })], FIRST_MONDAY, NOW);
  const lines = eventLines(ics);
  assert.ok(lines.includes('DTSTART:20261230T090000Z'));
  assert.ok(lines.includes('DTEND:20261230T110000Z'));
});

test('affiche la matière, pas le code, et les profs formatés comme sur le front', () => {
  const ics = buildIcs(
    [lesson({ subject: 'Anglais 1', teachers: ['Marchi', 'Dupont'], occurrences: ['1|0|08:00|09:30'] })],
    FIRST_MONDAY,
    NOW,
  );
  const lines = eventLines(ics);
  assert.ok(lines.includes('SUMMARY:Anglais 1'));
  assert.ok(lines.includes('DESCRIPTION:Marchi +1'));
});

test('un cours sans prof n’a pas de DESCRIPTION', () => {
  const ics = buildIcs([lesson({ teachers: [], occurrences: ['1|0|08:00|09:30'] })], FIRST_MONDAY, NOW);
  assert.ok(!ics.includes('DESCRIPTION'));
});

test('échappe la virgule et le point-virgule dans un champ texte', () => {
  const ics = buildIcs(
    [lesson({ subject: 'Réunion, rentrée; infos', occurrences: ['1|0|08:00|09:30'] })],
    FIRST_MONDAY,
    NOW,
  );
  assert.ok(ics.includes('SUMMARY:Réunion\\, rentrée\\; infos'));
});

test('un UID stable ne dépend que du cours et de l’occurrence, pas de l’heure de génération', () => {
  const first = buildIcs([lesson({ occurrences: ['1|0|08:00|09:30'] })], FIRST_MONDAY, NOW);
  const later = buildIcs([lesson({ occurrences: ['1|0|08:00|09:30'] })], FIRST_MONDAY, new Date('2026-10-01T00:00:00.000Z'));
  const uidOf = (ics) => ics.match(/^UID:(.+)$/m)[1];
  assert.equal(uidOf(first), uidOf(later));
});

test('deux cours différents au même moment ont des UID différents', () => {
  const ics = buildIcs(
    [lesson({ id: 'a', occurrences: ['1|0|08:00|09:30'] }), lesson({ id: 'b', occurrences: ['1|0|08:00|09:30'] })],
    FIRST_MONDAY,
    NOW,
  );
  const uids = [...ics.matchAll(/^UID:(.+)$/gm)].map((match) => match[1]);
  assert.notEqual(uids[0], uids[1]);
});

test('plie une ligne au-delà de 75 octets, avec une espace en tête de la continuation', () => {
  const longSubject = 'Un intitulé de cours vraiment très long pour vérifier le pliage de ligne correctement';
  const ics = buildIcs([lesson({ subject: longSubject, occurrences: ['1|0|08:00|09:30'] })], FIRST_MONDAY, NOW);
  const lines = ics.split('\r\n');
  for (const line of lines) assert.ok(Buffer.byteLength(line, 'utf8') <= 75, `ligne trop longue : ${line}`);
  const continuationIndex = lines.findIndex((line) => line.startsWith(' '));
  assert.ok(continuationIndex > 0);
  assert.equal(lines[continuationIndex - 1] + lines[continuationIndex].slice(1), `SUMMARY:${longSubject}`);
});
