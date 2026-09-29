// Périmètre du MVP : uniquement les promotions du campus Waterside.
// Les autres promotions (Droit, Comptabilité, TLM…) ne sont jamais scrapées.
// Accessoires de mode est hors MVP : aucun libellé de promotion identifié dans Hyperplanning.
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

// Promotions renommées par l'école, à remplir à la main : ancien libellé -> nouveau libellé, tels qu'affichés dans
// Hyperplanning. Le scrap prévient par mail quand une promotion disparaît (voir watch-promotions.mjs) ; une ligne
// ici suffit alors :
//  - le nouveau libellé entre dans le périmètre, avec le cursus de l'ancien, même s'il ne correspond à aucun motif ;
//  - les élèves abonnés à l'ancien suivent le nouveau (voir server/subscription.mjs, withCurrentLabels).
// Inutile pour un simple changement de casse, d'espaces ou de tirets : il est reconnu tout seul.
// Une ligne peut rester après la session : elle ne sert plus dès que l'ancien libellé est oublié des abonnements.
export const PROMOTION_RENAMES = {
  // '3TI Web': '3TI Digital',
};

// Nouveau libellé d'une promotion d'après la table, ou undefined (Object.hasOwn : pas de propriété héritée).
const renamedTo = (renames, label) => (Object.hasOwn(renames, label) ? renames[label] : undefined);

// Cursus d'une promotion (ex. « 3TI Web » -> techniques graphiques), ou undefined hors périmètre.
// Options en objet, jamais en position : getCurriculum et isInWatersideScope servent de rappel à filter ou map.
export function getCurriculum(promotionLabel, { renames = PROMOTION_RENAMES } = {}) {
  // `seen` : libellés déjà visités en remontant la table, contre une boucle.
  const find = (label, seen) => {
    const simplified = simplifyPromotionLabel(label);
    const matched = CURRICULA.find(({ patterns }) => patterns.some((pattern) => pattern.test(simplified)));
    if (matched) return matched;
    seen.add(label);
    for (const from of Object.keys(renames)) {
      if (renamedTo(renames, from) !== label || seen.has(from)) continue;
      const curriculum = find(from, seen);
      if (curriculum) return curriculum;
    }
    return undefined;
  };
  return find(promotionLabel.trim(), new Set());
}

export function isInWatersideScope(promotionLabel, { renames = PROMOTION_RENAMES } = {}) {
  return getCurriculum(promotionLabel, { renames }) !== undefined;
}

// Libellé actuel d'une promotion qui n'est plus dans `listed` (libellés du périmètre à ce scrap), ou null.
// D'abord PROMOTION_RENAMES, en suivant les renommages successifs jusqu'à un libellé listé ; sinon, l'unique libellé
// listé qui a le même libellé simplifié (« 3TI Web » -> « 3TI-WEB »). Sans certitude, null : mieux vaut un planning
// figé, signalé par mail, qu'une promotion qui n'est pas celle de l'élève.
export function findRenamedPromotion(promotionLabel, listed, { renames = PROMOTION_RENAMES } = {}) {
  const seen = new Set([promotionLabel.trim()]);
  for (let label = renamedTo(renames, promotionLabel.trim()); label && !seen.has(label); label = renamedTo(renames, label)) {
    if (listed.includes(label)) return label;
    seen.add(label);
  }
  const simplified = simplifyPromotionLabel(promotionLabel);
  const matches = listed.filter((label) => simplifyPromotionLabel(label) === simplified);
  return matches.length === 1 ? matches[0] : null;
}
