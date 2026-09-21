import { AppHeader } from './app-header';
import { Button } from './button';
import './status-screen.css';

type StatusScreenProps = {
  status: 'loading' | 'error';
  onRetry: () => void;
  onBack?: () => void;
};

// Attente ou échec d'une requête vers l'API : pas encore de maquette pour ces deux états.
export function StatusScreen({ status, onRetry, onBack }: StatusScreenProps) {
  return (
    <div className="status-screen">
      <AppHeader onBack={onBack} />
      <div className="status-screen__body" role={status === 'error' ? 'alert' : 'status'}>
        <p className="status-screen__message">
          {status === 'error' ? 'Impossible de charger les données. Vérifie ta connexion, puis réessaie.' : 'Chargement…'}
        </p>
        {status === 'error' && <Button onClick={onRetry}>Réessayer</Button>}
      </div>
    </div>
  );
}
