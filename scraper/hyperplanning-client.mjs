// Client HTTP pour Hyperplanning (PRONOTE Campus) en accès invité.
// Aucune dépendance : uniquement fetch et crypto de Node.
import crypto from 'node:crypto';

const BASE_URL = process.env.HYPERPLANNING_BASE_URL ?? 'https://heffpm.hyperplanning.fr/hp';
const USER_AGENT = 'HyperICS-scraper/0.1 (projet open-source, lecture du mode invité)';
const REQUEST_TIMEOUT_MS = 15_000;
// Délai entre deux requêtes, pour ne pas surcharger le serveur de l'école.
const REQUEST_DELAY_MS = 1_500;

const SIGNATURE_TAB = { Onglet: 'DIPLOME.EDT.EDT_GRILLE' };
const RESOURCE_KIND_PROMOTION = 1;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const md5 = (buffer) => crypto.createHash('md5').update(buffer).digest();

// Clé AES constante : MD5 d'une clé vide. Seul l'IV change au cours de la session.
const AES_KEY = md5(Buffer.alloc(0));

// Une session invité : le serveur numérote les échanges (1, 3, 5…) et attend
// ce numéro chiffré en AES-128-CBC dans l'URL, même si les données sont en clair.
class HyperplanningSession {
  #space;
  #sessionId;
  #order = 1;
  #iv = Buffer.alloc(16);
  #pendingIv = crypto.randomBytes(16);

  constructor(space, sessionId) {
    this.#space = space;
    this.#sessionId = sessionId;
  }

  #encryptOrder() {
    const cipher = crypto.createCipheriv('aes-128-cbc', AES_KEY, this.#iv);
    return Buffer.concat([cipher.update(String(this.#order)), cipher.final()]).toString('hex');
  }

  async call(id, data, signature) {
    const no = this.#encryptOrder();
    const dataSec = signature ? { Signature: signature, data } : { data };
    const response = await fetch(`${BASE_URL}/appelfonction/${this.#space}/${this.#sessionId}/${no}`, {
      method: 'POST',
      headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/json' },
      body: JSON.stringify({ session: this.#sessionId, no, id, dataSec }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`${id} : HTTP ${response.status}`);
    const json = await response.json();
    if (json.Erreur) throw new Error(`${id} : ${json.Erreur.Titre ?? JSON.stringify(json.Erreur)}`);
    this.#order += 2;
    await sleep(REQUEST_DELAY_MS);
    return json.dataSec.data;
  }

  // Envoie l'IV en base64 au serveur, puis l'utilise pour les ordres suivants.
  async init() {
    const params = await this.call('FonctionParametres', {
      Uuid: this.#pendingIv.toString('base64'),
      identifiantNav: null,
    });
    this.#iv = md5(this.#pendingIv);
    await this.call('DemandeParametreUtilisateur', {});
    return params.parametreGeneral;
  }
}

// Ouvre une session invité et renvoie les paramètres généraux du calendrier.
export async function openSession() {
  const response = await fetch(`${BASE_URL}/invite?fd=1`, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Page invité : HTTP ${response.status}`);
  const match = (await response.text()).match(/Start\s*\((\{.*?\})\)/);
  if (!match) throw new Error("Page invité : paramètres de démarrage introuvables");
  const { a: space, i: sessionId } = JSON.parse(match[1]);
  await sleep(REQUEST_DELAY_MS);

  const session = new HyperplanningSession(space, sessionId);
  const generalParams = await session.init();
  return { session, generalParams };
}

// Liste les promotions [{ label, id }]. L'id n'est valable que pour cette session.
export async function listPromotions(session) {
  const data = await session.call(
    'FonctionRenvoyerListeDeRessource',
    {
      GenreRessource: RESOURCE_KIND_PROMOTION,
      GenreRecherche: 1,
      AvecPublicationForcee: false,
      NomRessource: '*',
      PourEmail: false,
      PourRessource: false,
      filtresRessource: [],
    },
    SIGNATURE_TAB,
  );
  return data.ListeRessources.Liste.map(({ L, N }) => ({ label: L, id: N }));
}

// Récupère les cours bruts d'une promotion pour une plage de semaines (ex. « 1..16 »).
// Une seule requête couvre tout le quadrimestre : les cours reviennent dédoublonnés.
export async function fetchRawSchedule(session, promotion, weeks = '1..16') {
  const signature = {
    ...SIGNATURE_TAB,
    listeRecherche: [{ N: promotion.id, G: RESOURCE_KIND_PROMOTION, L: promotion.label }],
  };
  const resourceFilter = { _T: 26, V: '[0,6..7]' };

  // Ce 1er appel « sélectionne » la promotion côté serveur : sans lui, le planning revient vide.
  await session.call('FonctionDomaineDePresence', { FiltreRessources: resourceFilter, AvecCalendrier: false }, signature);

  return session.call(
    'FonctionEmploiDuTemps',
    {
      GenrePeriodeEDT: 2,
      GenreAffichageEDT: 0,
      FiltreRessources: resourceFilter,
      AvecIndisponibilites: true,
      AvecDomaineCours: true,
      AvecDomainePere: false,
      filterPlagesHoraires: false,
      ignorerCoursAnnules: false,
      avecInfosAppel: false,
      Domaine: { _T: 8, V: `[${weeks}]` },
    },
    signature,
  );
}
