import { useState } from 'react';
import arrowLeftUrl from '../assets/arrow-left.svg';
import logoUrl from '../assets/logo.svg';
import pencilUrl from '../assets/pencil.svg';
import { BugReportModal } from './bug-report-modal';
import './app-header.css';

type AppHeaderProps = {
  onBack?: () => void;
  // Page de l'élève : à la place de « Retour », qui n'y mène nulle part, retour au choix des cours pour le modifier.
  onEdit?: () => void;
};

export function AppHeader({ onBack, onEdit }: AppHeaderProps) {
  const [showBugReport, setShowBugReport] = useState(false);

  return (
    <header className="app-header">
      {onBack && (
        <button className="app-header__back" type="button" onClick={onBack}>
          <img src={arrowLeftUrl} alt="" width={16} height={16} />
          Retour
        </button>
      )}
      {onEdit && (
        <button className="app-header__edit" type="button" onClick={onEdit} aria-label="Modifier mes cours">
          <img src={pencilUrl} alt="" width={16} height={16} />
          Modifier
        </button>
      )}
      <img className="app-header__logo" src={logoUrl} alt="HyperICS" width={24} height={26} />
      <button className="app-header__bug" type="button" onClick={() => setShowBugReport(true)}>
        Signaler un bug
      </button>
      {showBugReport && <BugReportModal onClose={() => setShowBugReport(false)} />}
    </header>
  );
}
