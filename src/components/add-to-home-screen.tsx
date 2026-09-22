import { useState } from 'react';
import { useInstallPrompt } from '../hooks/use-install-prompt';
import { Button } from './button';
import './add-to-home-screen.css';

// Ajout à l'écran d'accueil : installation directe sur Android/Chrome/Edge,
// instructions manuelles sur iOS (Safari ne permet pas de la déclencher en JS).
export function AddToHomeScreen() {
  const installPrompt = useInstallPrompt();
  const [showIosSteps, setShowIosSteps] = useState(false);

  if (installPrompt.kind === 'none') return null;

  return (
    <div className="add-to-home-screen">
      <Button
        onClick={installPrompt.kind === 'prompt' ? installPrompt.install : () => setShowIosSteps((value) => !value)}
      >
        Ajouter à l’écran d’accueil
      </Button>

      {installPrompt.kind === 'ios' && showIosSteps && (
        <p className="add-to-home-screen__steps">
          Appuie sur <strong>Partager</strong> (le carré avec une flèche vers le haut), puis choisis « Sur l’écran
          d’accueil ».
        </p>
      )}
    </div>
  );
}
