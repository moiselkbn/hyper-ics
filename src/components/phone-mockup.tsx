import wallpaperUrl from '../assets/phone-wallpaper.jpg';
import wifiUrl from '../assets/phone-wifi.svg';
import './phone-mockup.css';

// Maquette d'iPhone décorative de la Landing Page (écran de verrouillage factice).
export function PhoneMockup() {
  return (
    <div className="phone-mockup" aria-hidden="true">
      <span className="phone-mockup__side-button phone-mockup__side-button--action" />
      <span className="phone-mockup__side-button phone-mockup__side-button--volume-up" />
      <span className="phone-mockup__side-button phone-mockup__side-button--volume-down" />
      <span className="phone-mockup__side-button phone-mockup__side-button--power" />
      <div className="phone-mockup__body">
        <div className="phone-mockup__frame" />
        <div className="phone-mockup__bezel" />
        <div className="phone-mockup__screen">
          <img className="phone-mockup__wallpaper" src={wallpaperUrl} alt="" />
        </div>
        <div className="phone-mockup__status">
          <span className="phone-mockup__status-time">9:41</span>
          <span className="phone-mockup__status-icons">
            <span className="phone-mockup__cell" />
            <img className="phone-mockup__wifi" src={wifiUrl} alt="" width={12} height={8} />
            <span className="phone-mockup__battery" />
          </span>
        </div>
        <div className="phone-mockup__lock">
          <span className="phone-mockup__date">Sunday, January 16</span>
          <span className="phone-mockup__time">9:41</span>
        </div>
        <div className="phone-mockup__island" />
      </div>
    </div>
  );
}
