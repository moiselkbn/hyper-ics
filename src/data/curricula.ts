// Cursus et promotions du campus Waterside.
// Les cursus reprennent CURRICULA (scraper/campus-scope.mjs).
// Les promotions ci-dessous sont des données factices, alignées sur la liste réelle d'Hyperplanning (relevé du 2026-09-20) ; elles viendront de l'API (schedule-index).
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

export type Curriculum = {
  id: string;
  name: string;
  promotions: string[];
};

export const MOCK_CURRICULA: Curriculum[] = [
  { id: 'graphic-technics', name: 'Techniques graphiques', promotions: ['1TGRA', '1TGRB', '1TGRC1', '1TGRC2', '2TE', '2TI 3D-Video', '2TI Web', '3TE', '3TI 3D-Video', '3TI Web'] },
  { id: 'applied-electronics', name: 'Électronique appliquée', promotions: ['1EAA', '1EAB', '2EA', '3EA'] },
  { id: 'fashion-design', name: 'Stylisme et modélisme', promotions: ['1SMA', '1SMB', '1SMC', '1SMD', '1SME', '2SMA', '2SMB', '2SMC', '3SMA', '3SMB', '3SMC'] },
  { id: 'textile-arts', name: 'Arts du tissu', promotions: ['1AT', '2AT', '3AT'] },
  { id: 'advertising', name: 'Publicité', promotions: ['1PUBA', '1PUBB', '2PUBA', '2PUBB', '3PUB A', '3PUB B'] },
];
