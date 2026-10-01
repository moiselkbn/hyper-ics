import { isAppleTouchDevice, type CalendarApp } from './subscription-links';

// Retrait de l'abonnement, application par application : HyperICS ne peut pas le retirer lui-même de l'application de
// l'élève. Libellés à confirmer sur appareil.
const APPLE_TOUCH_STEPS =
  'Dans l’app Calendrier, touche « Calendriers », puis ⓘ à côté de HyperICS, et le bouton rouge tout en bas (« Se désabonner » ou « Supprimer le calendrier »).';
const APPLE_MAC_STEPS =
  'Dans Calendrier, fais un clic droit sur HyperICS dans la liste des calendriers, puis « Se désabonner ».';
const GOOGLE_STEPS =
  'Sur calendar.google.com, depuis un ordinateur : dans « Autres agendas », survole HyperICS et clique sur la croix (« Se désabonner »). Il disparaît aussi de ton téléphone.';

// La marche à suivre pour l'application choisie, et pour Apple selon l'appareil (iPhone ou iPad, sinon Mac).
export function unsubscribeSteps(app: CalendarApp): string {
  if (app === 'google') return GOOGLE_STEPS;
  return isAppleTouchDevice() ? APPLE_TOUCH_STEPS : APPLE_MAC_STEPS;
}
