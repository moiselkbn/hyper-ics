import { useState } from 'react';
import { AppHeader } from '../components/app-header';
import { Button } from '../components/button';
import { CalendarAppTabs } from '../components/calendar-app-tabs';
import { detectCalendarApp, isAppleTouchDevice, type CalendarApp } from '../data/subscription-links';
import './subscription-deleted.css';

// Retrait de l'abonnement, application par application. Libellés à confirmer sur appareil.
const APPLE_TOUCH_STEPS =
  'Dans l’app Calendrier, touche « Calendriers », puis ⓘ à côté de HyperICS, et le bouton rouge tout en bas (« Se désabonner » ou « Supprimer le calendrier »).';
const APPLE_MAC_STEPS =
  'Dans Calendrier, fais un clic droit sur HyperICS dans la liste des calendriers, puis « Se désabonner ».';
const GOOGLE_STEPS =
  'Sur calendar.google.com, depuis un ordinateur : dans « Autres agendas », survole HyperICS et clique sur la croix (« Se désabonner »). Il disparaît aussi de ton téléphone.';
const OUTLOOK_STEPS =
  'Sur outlook.com : fais un clic droit sur HyperICS dans la liste des calendriers, puis « Supprimer ».';

type SubscriptionDeletedProps = {
  onRestart: () => void;
};

// Après la suppression : ce qui a été effacé, et comment retirer l'abonnement, que HyperICS ne peut pas retirer
// lui-même de l'application de l'élève.
export function SubscriptionDeleted({ onRestart }: SubscriptionDeletedProps) {
  const [app, setApp] = useState<CalendarApp>(() => detectCalendarApp());
  const steps = {
    apple: isAppleTouchDevice() ? APPLE_TOUCH_STEPS : APPLE_MAC_STEPS,
    google: GOOGLE_STEPS,
    outlook: OUTLOOK_STEPS,
  }[app];

  return (
    <div className="subscription-deleted">
      <AppHeader />
      <h1 className="subscription-deleted__title">Ton calendrier est supprimé</h1>
      <p className="subscription-deleted__text">
        Tes promotions et tes cours sont effacés de HyperICS. Ils disparaîtront de ton calendrier à son prochain
        rafraîchissement (jusqu’à 24 h sur Google Agenda).
      </p>
      <p className="subscription-deleted__text">
        Il y restera un calendrier « HyperICS » vide : pense à le retirer de ton application.
      </p>

      <CalendarAppTabs value={app} onChange={setApp} />
      <p className="subscription-deleted__steps">{steps}</p>

      <div className="subscription-deleted__footer">
        <Button onClick={onRestart}>Créer un nouveau calendrier</Button>
      </div>
    </div>
  );
}
