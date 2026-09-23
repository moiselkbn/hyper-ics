import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    // En dev, l'API tourne dans un serveur Node à part (npm run dev:api), pas dans Vite.
    // Le port doit rester aligné sur scripts/dev-api.mjs.
    proxy: {
      '/api': 'http://localhost:3001',
      // Comme la réécriture de vercel.json : /f/<jeton> est le flux ICS servi par /api/feed.
      // (/m/<jeton>, la page de l'élève, est déjà servie par Vite comme toute route inconnue.)
      '/f/': {
        target: 'http://localhost:3001',
        rewrite: (path) => path.replace(/^\/f\/([^/?]+).*$/, '/api/feed?token=$1'),
      },
    },
  },
});
