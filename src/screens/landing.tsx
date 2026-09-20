import logoUrl from '../assets/logo.svg';
import wordmarkLogoUrl from '../assets/wordmark-logo.svg';
import { Button } from '../components/button';
import { PhoneMockup } from '../components/phone-mockup';
import './landing.css';

type LandingProps = {
  onStart: () => void;
};

export function Landing({ onStart }: LandingProps) {
  return (
    <div className="landing">
      <img className="landing__logo" src={logoUrl} alt="HyperICS" width={24} height={26} />
      <h1 className="landing__title">Ton horaire dans ton calendrier avec</h1>
      <p className="landing__wordmark">
        <img className="landing__wordmark-logo" src={wordmarkLogoUrl} alt="" width={33} height={36} />
        <span>HyperICS</span>
      </p>
      <p className="landing__text">
        Marre de rouvrir Hyperplanning ? Retrouve tes cours dans ton calendrier en 2 minutes, sans compte ni mot de
        passe.
      </p>
      <Button variant="accent" className="landing__cta" onClick={onStart}>
        Commencer
      </Button>
      <div className="landing__phone">
        <PhoneMockup />
      </div>
    </div>
  );
}
