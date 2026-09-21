// GET /api/promotions : cursus et promotions disponibles, lus dans l'index écrit par le scrap.
import { CURRICULA } from '../scraper/campus-scope.mjs';
import { SCHEDULE_INDEX_KEY } from '../shared/redis-keys.mjs';
import { HttpError, jsonResponse } from './http.mjs';

// Tri par année puis nom, chiffres compris comme des nombres (« 2TE » avant « 2TI Web », « 1TGRC1 » avant « 2TE »).
export const promotionCollator = new Intl.Collator('fr', { numeric: true });

// Regroupe les promotions par cursus, dans l'ordre de CURRICULA ; un cursus sans promotion n'apparaît pas.
// `hasCourses` vaut false pour une promotion sans aucun cours publié. Un index écrit avant l'ajout de ce champ
// ne le porte pas : on ne sait pas, donc on ne prétend pas qu'elle est vide.
export function buildPromotions(index) {
  const curricula = CURRICULA.map(({ id, name }) => ({
    id,
    name,
    promotions: index.promotions
      .filter((entry) => entry.curriculum === id)
      .map((entry) => ({ label: entry.label, hasCourses: entry.hasCourses !== false }))
      .sort((a, b) => promotionCollator.compare(a.label, b.label)),
  })).filter((curriculum) => curriculum.promotions.length > 0);
  return { updatedAt: index.updatedAt, curricula };
}

export async function getPromotions(redis) {
  const index = await redis.getJson(SCHEDULE_INDEX_KEY);
  // Avant le premier scrap réussi, l'index n'existe pas.
  if (!index) throw new HttpError(503, 'Les plannings ne sont pas encore disponibles');
  return jsonResponse(buildPromotions(index));
}
