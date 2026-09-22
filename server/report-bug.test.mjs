// Lancer avec : node --test server/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reportBug } from './report-bug.mjs';

const requestWith = (body) => ({ json: async () => body });

function fakeResend() {
  const sent = [];
  return { sent, send: async (subject, text) => sent.push({ subject, text }) };
}

test('reportBug envoie la description reçue, recadrée', async () => {
  const resend = fakeResend();
  const response = await reportBug(resend, requestWith({ description: '  Le bouton retour ne marche pas  ' }));
  assert.equal(response.status, 200);
  assert.equal(resend.sent.length, 1);
  assert.equal(resend.sent[0].text, 'Le bouton retour ne marche pas');
});

test('reportBug refuse une description vide, absente ou un corps invalide', async () => {
  const resend = fakeResend();
  await assert.rejects(reportBug(resend, requestWith({ description: '   ' })), { status: 400 });
  await assert.rejects(reportBug(resend, requestWith({})), { status: 400 });
  await assert.rejects(reportBug(resend, requestWith('pas du json')), { status: 400 });
  assert.equal(resend.sent.length, 0);
});

test('reportBug refuse une description trop longue', async () => {
  const resend = fakeResend();
  await assert.rejects(reportBug(resend, requestWith({ description: 'a'.repeat(2001) })), { status: 400 });
});
