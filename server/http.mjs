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

// Pour une réponse unique à cet appel (ex. la création d'un jeton) : rien à mettre en cache.
export const jsonNoStore = (body) => Response.json(body, { headers: { ...HEADERS, 'Cache-Control': 'no-store' } });

export const errorResponse = (status, message) =>
  Response.json({ error: message }, { status, headers: { ...HEADERS, 'Cache-Control': 'no-store' } });

// Le flux ICS d'un élève : même politique de cache que les données de planning dont il dérive,
// et `Content-Disposition` pour que « télécharger le .ics » déclenche bien un téléchargement de fichier.
export const icsResponse = (text) =>
  new Response(text, {
    headers: {
      ...HEADERS,
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="hyperics.ics"',
      'Cache-Control': CACHED,
    },
  });

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
