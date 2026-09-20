// Périmètre du MVP : uniquement les promotions du campus Waterside.
// Les autres promotions (Droit, Comptabilité, TLM…) ne sont jamais scrapées.
// Chaque cursus regroupe ses promotions et porte l'intitulé affiché dans l'app.
//
// Notation des motifs : n = un chiffre, x = une lettre, [] = facultatif.
// Les libellés après « ex. » ne sont que des exemples, pas la liste complète.
export const CURRICULA = [
  {
    id: 'applied-electronics',
    name: 'Électronique appliquée',
    patterns: [/^\dEA[A-Z]?$/], // nEA[x] (ex. 2EA, 1EAA)
  },
  {
    id: 'graphic-technics',
    name: 'Techniques graphiques',
    patterns: [
      /^\dTGR[A-Z]\d?$/, // nTGRx[n] (ex. 1TGRA, 1TGRC1)
      /^\dTE$/, // nTE (ex. 2TE)
      /^\dTI\s?(Edition|Web|3D-Video)$/, // nTI + spécialisation (ex. 3TI Web)
    ],
  },
  {
    id: 'textile-arts',
    name: 'Arts du tissu',
    patterns: [/^\dAT$/], // nAT (ex. 1AT)
  },
  {
    id: 'advertising',
    name: 'Publicité',
    patterns: [/^\dPUB ?[A-Z]$/], // nPUB[ ]x (ex. 1PUBA, 3PUB A)
  },
  {
    id: 'fashion-design',
    name: 'Stylisme et modélisme',
    patterns: [/^\dSM[A-Z]$/], // nSMx (ex. 2SMC)
  },
  {
    id: 'fashion-accessories',
    name: 'Accessoires de mode',
    patterns: [], // motif à définir : aucun libellé identifié pour l'instant
  },
];

// Cursus d'une promotion (ex. « 3TI Web » -> techniques graphiques), ou undefined hors périmètre.
export function getCurriculum(promotionLabel) {
  const label = promotionLabel.trim();
  return CURRICULA.find(({ patterns }) => patterns.some((pattern) => pattern.test(label)));
}

export function isInWatersideScope(promotionLabel) {
  return getCurriculum(promotionLabel) !== undefined;
}
