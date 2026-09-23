// Lancer avec : node --test shared/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateToken, hashToken, isTokenFormat } from './token.mjs';

test('generateToken renvoie 256 bits en base64url', () => {
  const token = generateToken();
  assert.match(token, /^[A-Za-z0-9_-]+$/);
  assert.equal(Buffer.from(token, 'base64url').length, 32);
});

test('generateToken ne répète jamais deux jetons', () => {
  assert.notEqual(generateToken(), generateToken());
});

test('hashToken est déterministe et à sens unique', () => {
  const token = generateToken();
  assert.equal(hashToken(token), hashToken(token));
  assert.equal(hashToken(token).length, 64); // SHA-256 en hex
  assert.notEqual(hashToken(token), token);
});

test('hashToken donne des hash différents pour des jetons différents', () => {
  assert.notEqual(hashToken(generateToken()), hashToken(generateToken()));
});

test('isTokenFormat accepte un jeton généré et refuse le reste', () => {
  assert.equal(isTokenFormat(generateToken()), true);
  assert.equal(isTokenFormat(''), false);
  assert.equal(isTokenFormat(null), false);
  assert.equal(isTokenFormat('trop-court'), false);
  assert.equal(isTokenFormat(`${generateToken()}x`), false); // un caractère de trop
  assert.equal(isTokenFormat(`${generateToken().slice(0, 42)}/`), false); // caractère hors base64url
});
