// Noms des clés Redis, partagés entre le scrap (écriture) et l'API (lecture).

// Liste des promotions disponibles, pour proposer le choix dans l'app.
export const SCHEDULE_INDEX_KEY = 'schedule-index';

// Tous les libellés de promotion d'Hyperplanning au dernier scrap, périmètre ou non : sert à repérer une promotion
// disparue ou apparue (voir scraper/watch-promotions.mjs).
export const PROMOTION_LABELS_KEY = 'promotion-labels';

// Planning complet d'une promotion, ex. « schedule:3TI Web ».
export const scheduleKey = (promotionLabel) => `schedule:${promotionLabel.trim()}`;

// Abonnement d'un élève (cours suivis par promotion), retrouvé par le hash de son jeton,
// jamais par le jeton en clair (voir shared/token.mjs).
export const subscriptionKey = (tokenHash) => `subscription:${tokenHash}`;

// Lectures du flux d'un abonnement par application de calendrier (voir server/feed-reads.mjs), sous le même hash.
export const feedReadsKey = (tokenHash) => `feed-reads:${tokenHash}`;
