// Noms des clés Redis, partagés entre le scrap (écriture) et l'API (lecture).

// Liste des promotions disponibles, pour proposer le choix dans l'app.
export const SCHEDULE_INDEX_KEY = 'schedule-index';

// Planning complet d'une promotion, ex. « schedule:3TI Web ».
export const scheduleKey = (promotionLabel) => `schedule:${promotionLabel.trim()}`;

// Sélection d'un élève, retrouvée par le hash de son jeton (jamais le jeton en clair, voir shared/token.mjs).
export const tokenKey = (tokenHash) => `token:${tokenHash}`;
