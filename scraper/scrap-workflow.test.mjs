// Lancer avec : node --test scraper/
// Le choix des gardes se fait en shell dans le workflow : on exécute ce script tel quel, avec un faux `node`
// qui affiche ses arguments, et on vérifie ce que le workflow passerait à scrap-to-redis.mjs.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const workflow = readFileSync(new URL('../.github/workflows/scrap.yml', import.meta.url), 'utf8');
// Le bloc `run: |` de l'étape de scrap (indenté de 10 espaces).
const script = workflow.match(/^ +run: \|\n((?: {10}.*\n?)+)/m)?.[1].replace(/^ {10}/gm, '');

const fakeBin = mkdtempSync(join(tmpdir(), 'fake-node-'));
writeFileSync(join(fakeBin, 'node'), '#!/bin/sh\necho "$@"\n');
chmodSync(join(fakeBin, 'node'), 0o755);

// Arguments passés à scrap-to-redis.mjs. Sur un déclenchement planifié, `inputs.*` est vide ; sur un
// workflow_dispatch sans saisie (appel de QStash), les booléens valent leur défaut, « false ».
function argsFor({ dryRun, force }) {
  const output = execFileSync('/bin/bash', ['-e', '-c', script], {
    env: { PATH: `${fakeBin}:${process.env.PATH}`, DRY_RUN: dryRun, FORCE: force },
    encoding: 'utf8',
  });
  return output.trim().split(' ').slice(1); // sans le nom du script
}

const GUARDS = ['--only-in-hours', '--skip-if-fresh'];

test('le bloc de commande du workflow est trouvé', () => {
  assert.ok(script?.includes('scraper/scrap-to-redis.mjs'), 'bloc `run` introuvable ou modifié');
});

test('un déclenchement planifié applique les deux gardes', () => {
  assert.deepEqual(argsFor({ dryRun: '', force: '' }), GUARDS);
});

test('un appel de QStash sans saisie applique les deux gardes', () => {
  assert.deepEqual(argsFor({ dryRun: 'false', force: 'false' }), GUARDS);
});

test('un lancement manuel forcé ignore les gardes', () => {
  assert.deepEqual(argsFor({ dryRun: 'false', force: 'true' }), []);
});

test('une simulation ignore les gardes et ajoute --dry-run', () => {
  assert.deepEqual(argsFor({ dryRun: 'true', force: 'false' }), ['--dry-run']);
  assert.deepEqual(argsFor({ dryRun: 'true', force: 'true' }), ['--dry-run']);
});

test('« force » vaut false par défaut : sans saisie, les gardes restent actives', () => {
  assert.match(workflow, /force:\n\s+description: [^\n]*\n\s+type: boolean\n\s+default: false/);
});
