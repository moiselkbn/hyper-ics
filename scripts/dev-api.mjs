// Serveur local qui reproduit le routage de Vercel : /api/<nom> appelle la fonction exportée par api/<nom>.mjs
// (un export par méthode HTTP : GET, POST…). Vite lui envoie les requêtes /api (voir vite.config.ts).
// Usage : npm run dev:api   (équivaut à node --watch --env-file=.env scripts/dev-api.mjs)
import { createServer } from 'node:http';

const PORT = 3001; // doit rester aligné sur le proxy de vite.config.ts
const API_DIR = new URL('../api/', import.meta.url);

const send = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: body }));
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    // Seuls des noms simples : pas de sous-dossier, pas de « .. ».
    const name = url.pathname.match(/^\/api\/([a-z0-9-]+)$/)?.[1];
    const route = name && (await import(new URL(`${name}.mjs`, API_DIR)).catch(() => null));
    if (!route) return send(res, 404, 'Introuvable');

    const handler = route[req.method];
    if (typeof handler !== 'function') return send(res, 405, 'Méthode non autorisée');

    const response = await handler(new Request(url, { method: req.method, headers: req.headers }));
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error);
    send(res, 500, 'Erreur interne');
  }
});

server.listen(PORT, () => console.error(`API locale sur http://localhost:${PORT}/api`));
