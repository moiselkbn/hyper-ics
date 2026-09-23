// Réponses JSON de l'API.
// Les données ne changent qu'au rythme du scrap (1 fois par heure) : le CDN garde la réponse 5 min
// (ce qui ménage les commandes Upstash), le navigateur 1 min. Les erreurs ne sont jamais mises en cache.
const CACHED = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';
const HEADERS = { 'X-Content-Type-Options': 'nosniff' };

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const jsonResponse = (body) => Response.json(body, { headers: { ...HEADERS, 'Cache-Control': CACHED } });

// Pour une réponse unique à cet appel (ex. l'envoi d'un signalement de bug) : rien à mettre en cache.
export const jsonNoStore = (body) => Response.json(body, { headers: { ...HEADERS, 'Cache-Control': 'no-store' } });

export const errorResponse = (status, message) =>
  Response.json({ error: message }, { status, headers: { ...HEADERS, 'Cache-Control': 'no-store' } });

// Corps JSON d'une requête POST/PUT ; un corps illisible est une erreur du client.
export async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, 'Corps JSON invalide');
  }
}

// Exécute une action de l'API et convertit toute erreur en réponse JSON.
export async function respond(action) {
  try {
    return await action();
  } catch (error) {
    if (error instanceof HttpError) return errorResponse(error.status, error.message);
    // Le client Redis ne met ni jeton ni clé dans ses messages : on peut les journaliser.
    console.error(error.message);
    return errorResponse(500, 'Erreur interne');
  }
}
