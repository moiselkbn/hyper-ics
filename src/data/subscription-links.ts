// Liens d'un abonnement, tous tirés du même jeton (voir vercel.json pour les réécritures /m et /f) :
// - la page de l'élève (/m/<jeton>), le lien à garder pour revenir sur son calendrier ;
// - le flux ICS (/f/<jeton>), ce que lit l'application de calendrier.
const PAGE_PREFIX = '/m/';
const FEED_PREFIX = '/f/';
const DEFAULT_MANIFEST = '/manifest.json';

export type Platform = 'ios' | 'android' | 'desktop';

export const pageUrl = (token: string) => `${window.location.origin}${PAGE_PREFIX}${token}`;
export const feedUrl = (token: string) => `${window.location.origin}${FEED_PREFIX}${token}`;

// Apple Calendar (iPhone, iPad, Mac) : seul webcal:// ouvre un abonnement ; https:// importerait une copie figée.
export const webcalUrl = (feed: string) => feed.replace(/^https?:\/\//, 'webcal://');

// Google Agenda refuse cid=https://… : l'adresse doit lui parvenir en webcal://.
export const googleCalendarUrl = (feed: string) =>
  `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl(feed))}`;

export const outlookUrl = (feed: string) =>
  `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(webcalUrl(feed))}&name=HyperICS`;

// L'iPad se présente comme un Mac : il tombe sur Mac/PC, où le bouton Apple Calendar fonctionne aussi.
export function detectPlatform(userAgent = window.navigator.userAgent): Platform {
  if (/iphone|ipod/i.test(userAgent)) return 'ios';
  if (/android/i.test(userAgent)) return 'android';
  return 'desktop';
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
