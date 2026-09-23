// GET /api/manifest?token=… : manifest de l'app dont l'adresse de départ est la page de l'élève (/m/<jeton>).
// Sur cette page, le front fait pointer <link rel="manifest"> ici : l'icône ajoutée à l'écran d'accueil rouvre
// alors la page de l'élève, pas l'accueil (iOS comme Android lisent start_url au moment de l'ajout).
import { isTokenFormat } from '../shared/token.mjs';
import { HttpError } from './http.mjs';

// Mêmes valeurs que public/manifest.json (vérifié par manifest.test.mjs), recopiées ici plutôt qu'importées :
// la fonction Vercel n'embarque pas le dossier public/.
export const APP_MANIFEST = {
  name: 'HyperICS',
  short_name: 'HyperICS',
  description: 'Ton horaire Hyperplanning dans ton calendrier personnel.',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: '#1d1e1b',
  theme_color: '#1d1e1b',
  icons: [
    { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
  ],
};

export function getManifest(url) {
  const token = url.searchParams.get('token');
  if (!isTokenFormat(token)) throw new HttpError(400, 'Paramètre token invalide');
  return new Response(JSON.stringify({ ...APP_MANIFEST, start_url: `/m/${token}` }), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'X-Content-Type-Options': 'nosniff',
      // Le manifest d'un jeton ne dépend que de lui : le navigateur peut le garder un jour.
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
