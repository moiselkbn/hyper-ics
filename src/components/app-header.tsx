import { useState } from 'react';
import arrowLeftUrl from '../assets/arrow-left.svg';
import logoUrl from '../assets/logo.svg';
import { BugReportModal } from './bug-report-modal';
import './app-header.css';

type AppHeaderProps = {
  onBack?: () => void;
};

export function AppHeader({ onBack }: AppHeaderProps) {
  const [showBugReport, setShowBugReport] = useState(false);

  return (
    <header className="app-header">
      {onBack && (
        <button className="app-header__back" type="button" onClick={onBack}>
          <img src={arrowLeftUrl} alt="" width={16} height={16} />
          Retour
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
