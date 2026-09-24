// Liens d'un abonnement, tous tirés du même jeton (voir vercel.json pour les réécritures /m et /f) :
// - la page de l'élève (/m/<jeton>), le lien à garder pour revenir sur son calendrier ;
// - le flux ICS (/f/<jeton>), ce que lit l'application de calendrier.
const PAGE_PREFIX = '/m/';
const FEED_PREFIX = '/f/';
const DEFAULT_MANIFEST = '/manifest.json';

// L'application de calendrier décide de la façon de s'abonner, pas l'appareil : le lien Apple est le même
// sur iPhone, iPad et Mac, et Google Agenda ou Outlook s'ajoutent depuis leur site, sur un ordinateur.
export type CalendarApp = 'apple' | 'google' | 'outlook';

export const pageUrl = (token: string) => `${window.location.origin}${PAGE_PREFIX}${token}`;
export const feedUrl = (token: string) => `${window.location.origin}${FEED_PREFIX}${token}`;

// Apple Calendar (iPhone, iPad, Mac) : seul webcal:// ouvre un abonnement ; https:// importerait une copie figée.
export const webcalUrl = (feed: string) => feed.replace(/^https?:\/\//, 'webcal://');

// Google Agenda refuse cid=https://… : l'adresse doit lui parvenir en webcal://.
export const googleCalendarUrl = (feed: string) =>
  `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl(feed))}`;

export const outlookUrl = (feed: string) =>
  `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(webcalUrl(feed))}&name=HyperICS`;

// Application proposée d'office : Apple sur un appareil Apple (l'iPad se présente comme un Mac), Google ailleurs
// (Android, et la plupart des élèves ont un compte Google). L'élève peut toujours changer d'onglet.
export function detectCalendarApp(userAgent = window.navigator.userAgent): CalendarApp {
  return /iphone|ipad|ipod|macintosh/i.test(userAgent) ? 'apple' : 'google';
}

// Téléphone : Google Agenda et Outlook n'y permettent pas l'ajout par adresse, il faut passer par un ordinateur.
export function isPhone(userAgent = window.navigator.userAgent): boolean {
  return /iphone|ipod|android/i.test(userAgent);
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
// favoris et icône d'écran d'accueil rouvriront sa page, pas l'accueil.
export function showPage(token: string) {
  const path = `${PAGE_PREFIX}${token}`;
  if (window.location.pathname !== path) window.history.replaceState(null, '', path);
  setManifest(`/api/manifest?token=${encodeURIComponent(token)}`);
}

// Retour à l'accueil (lien inconnu) : adresse et manifest redeviennent ceux de l'app.
export function leavePage() {
  window.history.replaceState(null, '', '/');
  setManifest(DEFAULT_MANIFEST);
}
