// Fonction Vercel : GET /api/manifest?token=…, manifest de l'app qui s'ouvre sur la page de l'élève.
// La logique est dans server/ ; ce fichier ne fait que la brancher.
import { respond } from '../server/http.mjs';
import { getManifest } from '../server/manifest.mjs';

export const GET = (request) => respond(() => getManifest(new URL(request.url)));
