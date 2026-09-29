import type { ReactNode } from 'react';
import wifiUrl from '../assets/phone-wifi.svg';
import './phone-mockup.css';

type PhoneMockupProps = {
  children: ReactNode;
};

// Maquette d'iPhone décorative : cadre, barre d'état et île dynamique autour de l'écran fourni.
export function PhoneMockup({ children }: PhoneMockupProps) {
  return (
    <div className="phone-mockup" aria-hidden="true">
      <span className="phone-mockup__side-button phone-mockup__side-button--action" />
      <span className="phone-mockup__side-button phone-mockup__side-button--volume-up" />
      <span className="phone-mockup__side-button phone-mockup__side-button--volume-down" />
      <span className="phone-mockup__side-button phone-mockup__side-button--power" />
      <div className="phone-mockup__body">
        <div className="phone-mockup__frame" />
        <div className="phone-mockup__bezel" />
        <div className="phone-mockup__screen">{children}</div>
        <div className="phone-mockup__status">
          <span className="phone-mockup__status-time">9:41</span>
          <span className="phone-mockup__status-icons">
            <span className="phone-mockup__cell" />
            <img className="phone-mockup__wifi" src={wifiUrl} alt="" width={12} height={8} />
            <span className="phone-mockup__battery" />
          </span>
        </div>
        <div className="phone-mockup__island" />
      </div>
    </div>
  );
}
