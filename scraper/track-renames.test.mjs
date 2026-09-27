// Lancer avec : node --test scraper/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { courseKey } from '../shared/course-key.mjs';
import { trackRenames } from './track-renames.mjs';

// Un créneau tel que l'écrit le scrap (seuls les champs utiles ici).
const slot = ({ subject, code = null, day = 0, start = '09:00', end = '11:00', weeks = [1, 2, 3] }) => ({
  code,
  subject,
  day,
  start,
  end,
  weeks,
  key: subject ? courseKey(subject) : null,
});
const previousOf = (courses, renamedKeys) => ({ courses, ...(renamedKeys && { renamedKeys }) });

test('une matière renommée, même code et mêmes créneaux, est retenue', () => {
  const previous = previousOf([slot({ subject: 'Electr. num. 1', code: 'TI-101' }), slot({ subject: 'Anglais', code: 'TI-102', day: 2 })]);
  const renamed = trackRenames(previous, [
    slot({ subject: 'Electr. num. 1 (combin.)', code: 'TI-101' }),
    slot({ subject: 'Anglais', code: 'TI-102', day: 2 }),
  ]);
  assert.deepEqual(renamed, { 'electr. num. 1': 'electr. num. 1 (combin.)' });
});

test('sans planning précédent ni changement de libellé, aucun renommage', () => {
  const slots = [slot({ subject: 'Anglais', code: 'TI-102' })];
  assert.deepEqual(trackRenames(null, slots), {});
  assert.deepEqual(trackRenames(previousOf(slots), slots), {});
});

test('un cours supprimé et un autre ajouté ne sont pas un renommage : autre code ou aucun créneau commun', () => {
  const previous = previousOf([slot({ subject: 'Dessin', code: 'TI-103' })]);
  assert.deepEqual(trackRenames(previous, [slot({ subject: 'Peinture', code: 'TI-104' })]), {});
  assert.deepEqual(trackRenames(previous, [slot({ subject: 'Peinture', code: 'TI-103', day: 4 })]), {});
});

test('un cours sans code (obligatoire, hors sélection) n’est jamais suivi dans ses renommages', () => {
  const previous = previousOf([slot({ subject: 'Réunion' })]);
  assert.deepEqual(trackRenames(previous, [slot({ subject: 'Réunion de rentrée' })]), {});
});

test('un renommage ambigu n’est pas retenu', () => {
  // Un code qui couvre deux matières, renommées toutes deux en une seule au même moment.
  const previous = previousOf([slot({ subject: 'Math A', code: 'TI-105' }), slot({ subject: 'Math B', code: 'TI-105' })]);
  assert.deepEqual(trackRenames(previous, [slot({ subject: 'Mathématiques', code: 'TI-105' })]), {});
  // Une matière scindée en deux au même moment.
  const single = previousOf([slot({ subject: 'Math', code: 'TI-105' })]);
  assert.deepEqual(
    trackRenames(single, [slot({ subject: 'Math A', code: 'TI-105' }), slot({ subject: 'Math B', code: 'TI-105' })]),
    {},
  );
});

test('les renommages précédents sont gardés et prolongés jusqu’au libellé actuel', () => {
  const previous = previousOf([slot({ subject: 'Electr. num. 1 (combin.)', code: 'TI-101' })], {
    'electr. num. 1': 'electr. num. 1 (combin.)',
    'dessin': 'dessin technique',
  });
  const renamed = trackRenames(previous, [slot({ subject: 'Électronique numérique 1', code: 'TI-101' })]);
  assert.deepEqual(renamed, {
    'electr. num. 1': 'électronique numérique 1',
    'dessin': 'dessin technique',
    'electr. num. 1 (combin.)': 'électronique numérique 1',
  });
});

test('un libellé qui revient n’est plus traduit', () => {
  const previous = previousOf([slot({ subject: 'Electr. num. 1 (combin.)', code: 'TI-101' })], {
    'electr. num. 1': 'electr. num. 1 (combin.)',
  });
  assert.deepEqual(trackRenames(previous, [slot({ subject: 'Electr. num. 1', code: 'TI-101' })]), {
    'electr. num. 1 (combin.)': 'electr. num. 1',
  });
});
