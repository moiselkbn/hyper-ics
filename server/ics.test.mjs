// Lancer avec : node --test server/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildIcs } from './ics.mjs';

const NOW = new Date('2026-09-01T00:00:00.000Z');
const FIRST_MONDAY = '2026-09-14'; // lundi de la semaine 1

const lesson = (overrides) => ({
  id: 'x',
  key: 'anglais 1',
  subject: 'Anglais 1',
  promotions: ['3TI Web'],
  occurrences: [],
  roomsByOccurrence: {},
  teachersByOccurrence: {},
  ...overrides,
});

function eventLines(ics) {
  const body = ics.split('\r\n').slice(0, -1); // retire la ligne vide finale
  const start = body.indexOf('BEGIN:VEVENT');
  const end = body.indexOf('END:VEVENT');
  return body.slice(start, end + 1);
}

test('encadre le flux, déclare le fuseau Europe/Brussels et place un VEVENT par occurrence', () => {
  const ics = buildIcs(
    [lesson({ occurrences: ['1|0|08:00|09:30', '1|3|08:00|09:30'] })],
    FIRST_MONDAY,
    ['3TI Web'],
    NOW,
  );
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'));
  assert.ok(ics.includes('BEGIN:VTIMEZONE\r\nTZID:Europe/Brussels\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.equal(ics.split('BEGIN:VEVENT').length - 1, 2);
});

test('déclare un calendrier publié, son fuseau et la fréquence de rafraîchissement suggérée', () => {
  const header = buildIcs([], FIRST_MONDAY, ['3TI Web'], NOW).split('BEGIN:VTIMEZONE')[0].split('\r\n');
  for (const line of [
    'METHOD:PUBLISH',
    'X-WR-CALNAME:HyperICS',
    'X-WR-TIMEZONE:Europe/Brussels',
    'X-PUBLISHED-TTL:PT1H',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
  ]) {
    assert.ok(header.includes(line), `ligne manquante : ${line}`);
  }
});

test('sans aucun cours (promotion pas encore publiée), le calendrier reste valide', () => {
  const ics = buildIcs([], FIRST_MONDAY, ['2SMC'], NOW);
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.includes('END:VTIMEZONE\r\nEND:VCALENDAR\r\n'));
  assert.ok(!ics.includes('BEGIN:VEVENT'));
});

test('un cours garde son heure locale de Bruxelles, jamais convertie en UTC', () => {
  const ics = buildIcs([lesson({ occurrences: ['1|0|08:00|09:30'] })], FIRST_MONDAY, ['3TI Web'], NOW);
  const lines = eventLines(ics);
  assert.ok(lines.includes('DTSTART;TZID=Europe/Brussels:20260914T080000'));
  assert.ok(lines.includes('DTEND;TZID=Europe/Brussels:20260914T093000'));
  assert.ok(!lines.some((line) => line.startsWith('DTSTART:') || line.startsWith('DTEND:')));
});

test('un cours fin décembre garde aussi son heure locale, été comme hiver', () => {
  // Semaine 16, mercredi (jour 2) : 14/09/2026 + 15 semaines + 2 jours = 30/12/2026.
  const ics = buildIcs([lesson({ occurrences: ['16|2|10:00|12:00'] })], FIRST_MONDAY, ['3TI Web'], NOW);
  const lines = eventLines(ics);
  assert.ok(lines.includes('DTSTART;TZID=Europe/Brussels:20261230T100000'));
  assert.ok(lines.includes('DTEND;TZID=Europe/Brussels:20261230T120000'));
});

test('DTSTAMP reste en UTC : seule l’heure du cours doit être locale', () => {
  const ics = buildIcs([lesson({ occurrences: ['1|0|08:00|09:30'] })], FIRST_MONDAY, ['3TI Web'], NOW);
  const lines = eventLines(ics);
  assert.ok(lines.includes('DTSTAMP:20260901T000000Z'));
});

test('affiche la matière, pas le code, et deux profs listés en entier', () => {
  const ics = buildIcs(
    [
      lesson({
        subject: 'Anglais 1',
        occurrences: ['1|0|08:00|09:30'],
        teachersByOccurrence: { '1|0|08:00|09:30': ['Marchi', 'Dupont'] },
      }),
    ],
    FIRST_MONDAY,
    ['3TI Web'],
    NOW,
  );
  const lines = eventLines(ics);
  assert.ok(lines.includes('SUMMARY:Anglais 1'));
  assert.ok(lines.includes('LOCATION:Marchi\\, Dupont'));
});

test('au-delà de deux profs, le premier est suivi du nombre des autres', () => {
  const ics = buildIcs(
    [
      lesson({
        subject: 'Anglais 1',
        occurrences: ['1|0|08:00|09:30'],
        teachersByOccurrence: { '1|0|08:00|09:30': ['Marchi', 'Dupont', 'Sarouille'] },
      }),
    ],
    FIRST_MONDAY,
    ['3TI Web'],
    NOW,
  );
  const lines = eventLines(ics);
  assert.ok(lines.includes('LOCATION:Marchi +2'));
});

test('un cours sans prof ni salle n’a pas de LOCATION', () => {
  const ics = buildIcs([lesson({ occurrences: ['1|0|08:00|09:30'] })], FIRST_MONDAY, ['3TI Web'], NOW);
  assert.ok(!ics.includes('LOCATION'));
});

test('un cours avec salle et prof affiche les deux dans LOCATION, salle d’abord', () => {
  const ics = buildIcs(
    [
      lesson({
        id: 'a',
        occurrences: ['1|0|08:00|09:30'],
        roomsByOccurrence: { '1|0|08:00|09:30': ['L315'] },
        teachersByOccurrence: { '1|0|08:00|09:30': ['Lemal'] },
      }),
    ],
    FIRST_MONDAY,
    ['3TI Web'],
    NOW,
  );
  assert.ok(ics.includes('LOCATION:L315\\, Lemal'));
});

test('un cours sans salle mais avec prof affiche quand même le prof dans LOCATION', () => {
  const ics = buildIcs(
    [lesson({ occurrences: ['1|0|08:00|09:30'], teachersByOccurrence: { '1|0|08:00|09:30': ['Lemal'] } })],
    FIRST_MONDAY,
    ['3TI Web'],
    NOW,
  );
  assert.ok(eventLines(ics).includes('LOCATION:Lemal'));
});

test('un cours avec salle mais sans prof affiche quand même la salle dans LOCATION', () => {
  const ics = buildIcs(
    [lesson({ occurrences: ['1|0|08:00|09:30'], roomsByOccurrence: { '1|0|08:00|09:30': ['L315'] } })],
    FIRST_MONDAY,
    ['3TI Web'],
    NOW,
  );
  assert.ok(eventLines(ics).includes('LOCATION:L315'));
});

test('plusieurs salles pour une même occurrence sont listées avant le prof', () => {
  const ics = buildIcs(
    [
      lesson({
        occurrences: ['1|0|08:00|09:30'],
        roomsByOccurrence: { '1|0|08:00|09:30': ['L520', 'L521'] },
        teachersByOccurrence: { '1|0|08:00|09:30': ['Lemal'] },
      }),
    ],
    FIRST_MONDAY,
    ['3TI Web'],
    NOW,
  );
  assert.ok(ics.includes('LOCATION:L520\\, L521\\, Lemal'));
});

test('deux occurrences du même cours avec des profs différents affichent chacune le sien', () => {
  const ics = buildIcs(
    [
      lesson({
        occurrences: ['1|0|08:00|09:30', '1|4|08:00|09:30'], // lundi puis vendredi
        teachersByOccurrence: { '1|0|08:00|09:30': ['Lemal'], '1|4|08:00|09:30': ['Jamoulle'] },
      }),
    ],
    FIRST_MONDAY,
    ['3TI Web'],
    NOW,
  );
  const locations = [...ics.matchAll(/^LOCATION:(.+)$/gm)].map((match) => match[1]);
  assert.deepEqual(locations, ['Lemal', 'Jamoulle']);
});

test('une seule promotion suivie : le SUMMARY ne précise pas la promotion', () => {
  const ics = buildIcs(
    [lesson({ subject: 'Infographie 2D Q3', promotions: ['3TI Web'], occurrences: ['1|0|08:00|09:30'] })],
    FIRST_MONDAY,
    ['3TI Web'],
    NOW,
  );
  assert.ok(eventLines(ics).includes('SUMMARY:Infographie 2D Q3'));
});

test('élève en chevauchement (deux promotions) : le SUMMARY précise la promotion du cours', () => {
  const ics = buildIcs(
    [lesson({ subject: 'Infographie 2D Q3', promotions: ['2TI Web'], occurrences: ['1|0|08:00|09:30'] })],
    FIRST_MONDAY,
    ['3TI Web', '2TI Web'],
    NOW,
  );
  assert.ok(eventLines(ics).includes('SUMMARY:Infographie 2D Q3 (2TI Web)'));
});

test('cours commun aux deux promotions suivies : les deux sont listées', () => {
  const ics = buildIcs(
    [lesson({ subject: 'Réunion CAVP', promotions: ['2TI Web', '3TI Web'], occurrences: ['1|0|08:00|09:30'] })],
    FIRST_MONDAY,
    ['3TI Web', '2TI Web'],
    NOW,
  );
  assert.ok(eventLines(ics).includes('SUMMARY:Réunion CAVP (2TI Web\\, 3TI Web)'));
});

test('échappe la virgule et le point-virgule dans un champ texte', () => {
  const ics = buildIcs(
    [lesson({ subject: 'Réunion, rentrée; infos', occurrences: ['1|0|08:00|09:30'] })],
    FIRST_MONDAY,
    ['3TI Web'],
    NOW,
  );
  assert.ok(ics.includes('SUMMARY:Réunion\\, rentrée\\; infos'));
});

test('un UID stable ne dépend que du cours et de l’occurrence, pas de l’heure de génération', () => {
  const first = buildIcs([lesson({ occurrences: ['1|0|08:00|09:30'] })], FIRST_MONDAY, ['3TI Web'], NOW);
  const later = buildIcs(
    [lesson({ occurrences: ['1|0|08:00|09:30'] })],
    FIRST_MONDAY,
    ['3TI Web'],
    new Date('2026-10-01T00:00:00.000Z'),
  );
  const uidOf = (ics) => ics.match(/^UID:(.+)$/m)[1];
  assert.equal(uidOf(first), uidOf(later));
});

test('l’UID ne change pas quand le cours reçoit un code (autre identifiant, même matière)', () => {
  const uidOf = (overrides) =>
    buildIcs([lesson({ occurrences: ['1|0|08:00|09:30'], ...overrides })], FIRST_MONDAY, ['2PUBB'], NOW).match(/^UID:(.+)$/m)[1];
  assert.equal(uidOf({ id: 'promotion:2PUBB|anglais 1' }), uidOf({ id: 'code:PUB-201|anglais 1' }));
});

test('deux cours différents au même moment ont des UID différents', () => {
  const ics = buildIcs(
    [lesson({ key: 'a', occurrences: ['1|0|08:00|09:30'] }), lesson({ key: 'b', occurrences: ['1|0|08:00|09:30'] })],
    FIRST_MONDAY,
    ['3TI Web'],
    NOW,
  );
  const uids = [...ics.matchAll(/^UID:(.+)$/gm)].map((match) => match[1]);
  assert.notEqual(uids[0], uids[1]);
});

test('plie une ligne au-delà de 75 octets, avec une espace en tête de la continuation', () => {
  const longSubject = 'Un intitulé de cours vraiment très long pour vérifier le pliage de ligne correctement';
  const ics = buildIcs([lesson({ subject: longSubject, occurrences: ['1|0|08:00|09:30'] })], FIRST_MONDAY, ['3TI Web'], NOW);
  const lines = ics.split('\r\n');
  for (const line of lines) assert.ok(Buffer.byteLength(line, 'utf8') <= 75, `ligne trop longue : ${line}`);
  const continuationIndex = lines.findIndex((line) => line.startsWith(' '));
  assert.ok(continuationIndex > 0);
  assert.equal(lines[continuationIndex - 1] + lines[continuationIndex].slice(1), `SUMMARY:${longSubject}`);
});
