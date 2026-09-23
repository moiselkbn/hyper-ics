import { AppHeader } from './app-header';
import { Button } from './button';
import './status-screen.css';

type StatusScreenProps = {
  status: 'loading' | 'error';
  onRetry: () => void;
  onBack?: () => void;
  // Pour une erreur qui n'est pas un problème de connexion (ex. lien inconnu) : autre texte, autre bouton.
  message?: string;
  actionLabel?: string;
};

// Attente ou échec d'une requête vers l'API : pas encore de maquette pour ces deux états.
export function StatusScreen({ status, onRetry, onBack, message, actionLabel = 'Réessayer' }: StatusScreenProps) {
  return (
    <div className="status-screen">
      <AppHeader onBack={onBack} />
      <div className="status-screen__body" role={status === 'error' ? 'alert' : 'status'}>
        <p className="status-screen__message">
          {status === 'error'
            ? (message ?? 'Impossible de charger les données. Vérifie ta connexion, puis réessaie.')
            : 'Chargement…'}
        </p>
        {status === 'error' && <Button onClick={onRetry}>{actionLabel}</Button>}
      </div>
    </div>
  );
}
