// Périmètre du MVP : uniquement les promotions du campus Waterside.
// Les autres promotions (Droit, Comptabilité, TLM…) ne sont jamais scrapées.
// Chaque cursus regroupe ses promotions et porte l'intitulé affiché dans l'app.
//
// Les motifs portent sur le libellé simplifié (voir simplifyPromotionLabel) : « 3TI-WEB » et « 3ti web »
// restent reconnus comme « 3TI Web » si l'école change la casse ou la ponctuation.
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
      /^\dTI(EDITION|WEB|3DVIDEO)$/, // nTI + spécialisation (ex. 3TI Web)
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
    patterns: [/^\dPUB[A-Z]$/], // nPUBx (ex. 1PUBA, 3PUB A)
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

// Majuscules, sans accents, sans espaces, tirets, points ni soulignés (ex. « 3TI 3D-Video » -> « 3TI3DVIDEO »).
// Les parenthèses restent : « 1TGRD2 (OUT) » doit continuer d'être exclu.
export function simplifyPromotionLabel(promotionLabel) {
  return promotionLabel
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[\s._-]/g, '');
}

// Cursus d'une promotion (ex. « 3TI Web » -> techniques graphiques), ou undefined hors périmètre.
export function getCurriculum(promotionLabel) {
  const label = simplifyPromotionLabel(promotionLabel);
  return CURRICULA.find(({ patterns }) => patterns.some((pattern) => pattern.test(label)));
}

export function isInWatersideScope(promotionLabel) {
  return getCurriculum(promotionLabel) !== undefined;
}
