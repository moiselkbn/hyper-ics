import { useState } from 'react';
import { Button } from './button';
import './delete-subscription-modal.css';

type DeleteSubscriptionModalProps = {
  // Supprime l'abonnement ; la fenêtre n'affiche que l'attente et l'échec, la suite revient à l'appelant.
  onConfirm: () => Promise<void>;
  onClose: () => void;
};

// Confirmation avant suppression : dit ce qui est effacé, et que c'est définitif.
export function DeleteSubscriptionModal({ onConfirm, onClose }: DeleteSubscriptionModalProps) {
  const [status, setStatus] = useState<'idle' | 'deleting' | 'error'>('idle');

  async function confirm() {
    setStatus('deleting');
    try {
      await onConfirm();
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="delete-subscription-modal" role="dialog" aria-modal="true" aria-labelledby="delete-subscription-title">
      <div className="delete-subscription-modal__panel">
        <p className="delete-subscription-modal__title" id="delete-subscription-title">
          Supprimer ton calendrier ?
        </p>
        <p className="delete-subscription-modal__text">
          Tes promotions et tes cours seront effacés de HyperICS. Ils disparaîtront de ton calendrier à son prochain
          rafraîchissement.
        </p>
        <p className="delete-subscription-modal__text">
          C’est définitif : ce lien ne marchera plus. Pour retrouver tes cours, il faudra créer un nouveau calendrier.
        </p>
        {status === 'error' && (
          <p className="delete-subscription-modal__error" role="alert">
            Échec de la suppression. Vérifie ta connexion, puis réessaie.
          </p>
        )}
        <div className="delete-subscription-modal__actions">
          <button type="button" className="delete-subscription-modal__cancel" onClick={onClose}>
            Annuler
          </button>
          <Button className="delete-subscription-modal__confirm" onClick={confirm} disabled={status === 'deleting'}>
            {status === 'deleting' ? 'Suppression…' : 'Supprimer'}
          </Button>
        </div>
      </div>
    </div>
  );
}
