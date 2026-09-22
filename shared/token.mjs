// Jeton du flux ICS d'un élève : 256 bits aléatoires, en base64url pour l'URL.
// Seul son hash SHA-256 est stocké côté serveur (voir shared/redis-keys.mjs) ; le jeton
// en clair ne part qu'une fois, à la création, vers le navigateur de l'élève.
import { createHash, randomBytes } from 'node:crypto';

const TOKEN_BYTES = 32; // 256 bits

export function generateToken() {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}
