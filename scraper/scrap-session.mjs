// Session invité qui survit à un échange en échec pendant le scrap.
// Une requête abandonnée faute de réponse à temps casse la session (voir `broken` dans hyperplanning-client.mjs) :
// sans réouverture, toutes les promotions suivantes échouaient en « La page a expiré ! ». On rouvre donc une
// session, on relit les promotions (leurs identifiants changent à chaque session) et on retente une fois.
import { fetchRawSchedule, listPromotions, openSession } from './hyperplanning-client.mjs';

// Réouvertures permises par passage : au-delà, Hyperplanning est sans doute en panne, et on ne le relance plus.
// Chacune coûte 4 requêtes (page invité, paramètres, liste des promotions).
export const MAX_REOPENS = 3;
// Pause avant de rouvrir, pour ne pas enchaîner les requêtes sur un serveur qui vient de mal répondre.
export const REOPEN_DELAY_MS = 5_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Renvoie les paramètres généraux et les promotions de la 1re session, et `fetchRaw(promotion, weeksRange?)`,
// qui retrouve la promotion par son libellé dans la session en cours.
export async function openScrapSession({
  open = openSession,
  list = listPromotions,
  fetchSchedule = fetchRawSchedule,
  maxReopens = MAX_REOPENS,
  pause = () => sleep(REOPEN_DELAY_MS),
  log = () => {},
} = {}) {
  const connect = async () => {
    const { session, generalParams } = await open();
    return { session, generalParams, promotions: await list(session) };
  };
  let current = await connect();
  let reopens = 0;

  async function reopen() {
    if (reopens >= maxReopens) throw new Error(`session invité interrompue, déjà rouverte ${maxReopens} fois`);
    reopens += 1;
    log(`Session invité interrompue : réouverture (${reopens}/${maxReopens})`);
    await pause();
    current = await connect();
  }

  function attempt(promotion, weeksRange) {
    const found = current.promotions.find(({ label }) => label === promotion.label);
    if (!found) throw new Error('promotion absente de la nouvelle session');
    return fetchSchedule(current.session, found, weeksRange);
  }

  async function fetchRaw(promotion, weeksRange) {
    // Une réouverture précédente a pu échouer : la session en cours est alors encore l'ancienne.
    if (current.session.broken) await reopen();
    try {
      return await attempt(promotion, weeksRange);
    } catch (error) {
      // Réouvertures épuisées : l'erreur d'origine dit mieux ce qui s'est passé que la limite atteinte.
      if (!current.session.broken || reopens >= maxReopens) throw error;
      await reopen();
      return attempt(promotion, weeksRange);
    }
  }

  return { generalParams: current.generalParams, promotions: current.promotions, fetchRaw };
}
