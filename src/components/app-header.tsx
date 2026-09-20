import arrowLeftUrl from '../assets/arrow-left.svg';
import logoUrl from '../assets/logo.svg';
import './app-header.css';

type AppHeaderProps = {
  onBack?: () => void;
};

export function AppHeader({ onBack }: AppHeaderProps) {
  return (
    <header className="app-header">
      {onBack && (
        <button className="app-header__back" type="button" onClick={onBack}>
          <img src={arrowLeftUrl} alt="" width={16} height={16} />
          Retour
        </button>
      )}
      <img className="app-header__logo" src={logoUrl} alt="HyperICS" width={24} height={26} />
      {/* Ne mène nulle part pour l'instant. */}
      <button className="app-header__bug" type="button">
        Signaler un bug
      </button>
    </header>
  );
}
