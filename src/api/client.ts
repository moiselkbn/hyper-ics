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
