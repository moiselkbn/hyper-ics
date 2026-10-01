import { useState } from 'react';
import { AppHeader } from '../components/app-header';
import { Button } from '../components/button';
import { CalendarAppTabs } from '../components/calendar-app-tabs';
import { detectCalendarApp, type CalendarApp } from '../data/subscription-links';
import { unsubscribeSteps } from '../data/unsubscribe-steps';
import './subscription-deleted.css';

type SubscriptionDeletedProps = {
  onRestart: () => void;
};

// Après la suppression : ce qui a été effacé, et comment retirer l'abonnement, que HyperICS ne peut pas retirer
// lui-même de l'application de l'élève.
export function SubscriptionDeleted({ onRestart }: SubscriptionDeletedProps) {
  const [app, setApp] = useState<CalendarApp>(() => detectCalendarApp());

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
      <p className="subscription-deleted__steps">{unsubscribeSteps(app)}</p>

      <div className="subscription-deleted__footer">
        <Button onClick={onRestart}>Créer un nouveau calendrier</Button>
      </div>
    </div>
  );
}
