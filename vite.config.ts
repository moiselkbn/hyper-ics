import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    // En dev, l'API tourne dans un serveur Node à part (npm run dev:api), pas dans Vite.
    // Le port doit rester aligné sur scripts/dev-api.mjs.
    proxy: { '/api': 'http://localhost:3001' },
  },
});
