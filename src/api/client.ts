import type { Curriculum } from '../data/curricula';
import type { Lesson } from '../data/lessons';

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

// Crée le jeton du flux ICS de l'élève à partir de sa sélection ; seul son hash est gardé côté serveur.
export async function createFeed(promotions: string[], lessonIds: string[], signal: AbortSignal): Promise<string> {
  const response = await fetch('/api/feed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ promotions, lessonIds }),
    signal,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const { token } = (await response.json()) as { token: string };
  return token;
}

export async function reportBug(description: string, signal: AbortSignal): Promise<void> {
  const response = await fetch('/api/report-bug', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description }),
    signal,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}
