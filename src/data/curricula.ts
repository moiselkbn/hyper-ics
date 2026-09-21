// Cursus et promotions du campus Waterside, fournis par l'API (GET /api/promotions).
// Décret paysage : un élève ne peut chevaucher que deux années au maximum.
export const MAX_SELECTED_PROMOTIONS = 2;

// L'année d'une promotion est son premier chiffre (« 2TI Web » -> 2).
function getPromotionYear(promotion: string): string {
  return promotion.charAt(0);
}

// Une promotion est refusée si le maximum est atteint ou si son année est déjà choisie.
export function isPromotionDisabled(promotion: string, selected: ReadonlySet<string>): boolean {
  if (selected.has(promotion)) return false;
  if (selected.size >= MAX_SELECTED_PROMOTIONS) return true;
  const year = getPromotionYear(promotion);
  return [...selected].some((other) => getPromotionYear(other) === year);
}

export type Promotion = {
  label: string;
  // Faux quand Hyperplanning ne publie aucun cours pour cette promotion.
  hasCourses: boolean;
};

export type Curriculum = {
  id: string;
  name: string;
  promotions: Promotion[];
};
