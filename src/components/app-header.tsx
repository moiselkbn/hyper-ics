import logoUrl from '../assets/logo.svg';
import './app-header.css';

export function AppHeader() {
  return (
    <header className="app-header">
      <img className="app-header__logo" src={logoUrl} alt="HyperICS" width={24} height={26} />
      {/* Ne mène nulle part pour l'instant. */}
      <button className="app-header__bug" type="button">
        Signaler un bug
      </button>
    </header>
  );
}
