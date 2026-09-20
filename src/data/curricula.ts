// Cursus et promotions du campus Waterside.
// Les cursus reprennent CURRICULA (scraper/campus-scope.mjs).
// Les promotions ci-dessous sont des données factices, alignées sur la liste réelle d'Hyperplanning (relevé du 2026-09-20) ; elles viendront de l'API (schedule-index).
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
