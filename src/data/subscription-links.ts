// Liens d'un abonnement, tous tirés du même jeton (voir vercel.json pour les réécritures /m et /f) :
// - la page de l'élève (/m/<jeton>), le lien à garder pour revenir sur son calendrier ;
// - le flux ICS (/f/<jeton>), ce que lit l'application de calendrier.
const PAGE_PREFIX = '/m/';
const FEED_PREFIX = '/f/';
const DEFAULT_MANIFEST = '/manifest.json';

// L'application de calendrier décide de la façon de s'abonner, pas l'appareil : le lien Apple est le même
// sur iPhone, iPad et Mac, et Google Agenda s'ajoute depuis son site (sur Android aussi). Outlook est écarté pendant
// la bêta : la cible ne s'en sert pas comme agenda, et son compte Outlook est celui, scolaire, de l'HEFF.
export type CalendarApp = 'apple' | 'google';

export const pageUrl = (token: string) => `${window.location.origin}${PAGE_PREFIX}${token}`;
export const feedUrl = (token: string) => `${window.location.origin}${FEED_PREFIX}${token}`;

// Apple Calendar (iPhone, iPad, Mac) : seul webcal:// ouvre un abonnement ; https:// importerait une copie figée.
export const webcalUrl = (feed: string) => feed.replace(/^https?:\/\//, 'webcal://');

// Google Agenda refuse cid=https://… : l'adresse doit lui parvenir en webcal://.
export const googleCalendarUrl = (feed: string) =>
  `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl(feed))}`;

// Application proposée d'office : Apple sur un appareil Apple (l'iPad se présente comme un Mac), Google ailleurs
// (Android, et la plupart des élèves ont un compte Google). L'élève peut toujours changer d'onglet.
export function detectCalendarApp(userAgent = window.navigator.userAgent): CalendarApp {
  return /iphone|ipad|ipod|macintosh/i.test(userAgent) ? 'apple' : 'google';
}

// Téléphone : Google Agenda n'y permet l'ajout par adresse que sur Android (voir isAndroid) ; sinon, il faut passer
// par un ordinateur.
export function isPhone(userAgent = window.navigator.userAgent): boolean {
  return /iphone|ipod|android/i.test(userAgent);
}

// Android : le site de Google Agenda s'ouvre dans Chrome et y abonne le compte, à condition de l'ouvrir
// quelques secondes après le toucher (voir GoogleAndroidButton dans feed-ready.tsx).
export function isAndroid(userAgent = window.navigator.userAgent): boolean {
  return /android/i.test(userAgent);
}

// iPhone ou iPad (qui se présente comme un Mac, mais tactile) : l'ajout à la main s'y fait dans l'app Calendrier,
// pas par le menu Fichier du Mac.
export function isAppleTouchDevice(
  userAgent = window.navigator.userAgent,
  touchPoints = window.navigator.maxTouchPoints,
): boolean {
  return /iphone|ipad|ipod/i.test(userAgent) || (/macintosh/i.test(userAgent) && touchPoints > 1);
}

// Jeton de la page ouverte (/m/<jeton>), ou null ailleurs. Le serveur vérifie son format et son existence.
export function pageTokenOf(pathname: string): string | null {
  if (!pathname.startsWith(PAGE_PREFIX)) return null;
  return decodeURIComponent(pathname.slice(PAGE_PREFIX.length).replace(/\/$/, ''));
}

function setManifest(href: string) {
  document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.setAttribute('href', href);
}

// Met la page de l'élève dans la barre d'adresse et fait pointer le manifest vers celui de cette page :
// favoris et icône d'écran d'accueil rouvriront sa page, pas l'accueil. Safari ne relit pas un manifest changé
// après le chargement : pour lui, la balise est créée avec le bon manifest dans index.html (voir openPage).
export function showPage(token: string) {
  const path = `${PAGE_PREFIX}${token}`;
  if (window.location.pathname !== path) window.history.replaceState(null, '', path);
  setManifest(`/api/manifest?token=${encodeURIComponent(token)}`);
}

// Nombre de cours du calendrier tout juste créé, gardé le temps du rechargement de sa page (voir openPage) pour
// l'annoncer une seule fois. Stockage de l'onglet : il ne survit pas à sa fermeture.
const CREATED_KEY = 'hyperics:created';

// Ouvre la page de l'élève par un vrai chargement : Safari ne lit le manifest qu'au chargement de la page,
// c'est donc le seul moyen pour que l'icône d'écran d'accueil rouvre cette page et pas l'accueil.
// `lessonCount` : après la création, nombre de cours du calendrier, annoncé sur la page (voir takeCreatedLessonCount).
export function openPage(token: string, lessonCount?: number) {
  if (lessonCount !== undefined) {
    try {
      window.sessionStorage.setItem(CREATED_KEY, String(lessonCount));
    } catch {
      // Stockage indisponible (navigation privée, bloqué) : la page s'ouvre sans l'annonce.
    }
  }
  window.location.replace(pageUrl(token));
}

// Le nombre de cours laissé par openPage, effacé aussitôt : un nouveau chargement ne l'annonce plus. null sinon.
export function takeCreatedLessonCount(): number | null {
  try {
    const stored = window.sessionStorage.getItem(CREATED_KEY);
    window.sessionStorage.removeItem(CREATED_KEY);
    const count = Number(stored);
    return stored !== null && Number.isInteger(count) && count >= 0 ? count : null;
  } catch {
    return null;
  }
}

// Retour à l'accueil (lien inconnu) : adresse et manifest redeviennent ceux de l'app.
export function leavePage() {
  window.history.replaceState(null, '', '/');
  setManifest(DEFAULT_MANIFEST);
}
