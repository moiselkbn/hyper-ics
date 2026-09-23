import type { Curriculum } from '../data/curricula';
import type { Lesson, SubscriptionPromotion } from '../data/lessons';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function fetchCurricula(signal: AbortSignal): Promise<Curriculum[]> {
  const { curricula } = await getJson<{ curricula: Curriculum[] }>('/api/promotions', signal);
  return curricula;
}

export async function fetchLessons(promotions: string[], signal: AbortSignal): Promise<Lesson[]> {
  // Ordre fixe : deux sélections identiques donnent la même URL, donc la même entrée dans le cache du CDN.
  const query = new URLSearchParams({ promotions: [...promotions].sort().join(',') });
  const { lessons } = await getJson<{ lessons: Lesson[] }>(`/api/lessons?${query}`, signal);
  return lessons;
}

// Crée l'abonnement de l'élève ; seul le hash du jeton est gardé côté serveur.
export async function createSubscription(promotions: SubscriptionPromotion[], signal: AbortSignal): Promise<string> {
  const response = await fetch('/api/subscription', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ promotions }),
    signal,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const { token } = (await response.json()) as { token: string };
  return token;
}

// Remplace la sélection d'un abonnement existant : même jeton, donc même flux dans le calendrier.
export async function updateSubscription(
  token: string,
  promotions: SubscriptionPromotion[],
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch(`/api/subscription?${new URLSearchParams({ token })}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify({ promotions }),
    signal,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

// false : aucun abonnement pour ce jeton (lien mal copié, par exemple).
export async function subscriptionExists(token: string, signal: AbortSignal): Promise<boolean> {
  const response = await fetch(`/api/subscription?${new URLSearchParams({ token })}`, { signal });
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return true;
}

export async function reportBug(description: string, signal: AbortSignal): Promise<void> {
  const response = await fetch('/api/report-bug', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ description }),
    signal,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}
