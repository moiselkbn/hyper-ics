import batteryUrl from '../assets/status-battery.svg';
import cellularBar1Url from '../assets/status-cellular-bar-1.svg';
import cellularBar2Url from '../assets/status-cellular-bar-2.svg';
import cellularBar3Url from '../assets/status-cellular-bar-3.svg';
import cellularBar4Url from '../assets/status-cellular-bar-4.svg';
import cellularBarEmptyUrl from '../assets/status-cellular-bar-empty.svg';
import wifiUrl from '../assets/status-wifi.svg';
import './ios-status-bar.css';

// Chaque barre de réseau est posée sur son fond vide, dans l'ordre de la maquette Figma.
const CELLULAR_BARS = [
  { modifier: 'empty-4', src: cellularBarEmptyUrl },
  { modifier: 'full-4', src: cellularBar4Url },
  { modifier: 'empty-3', src: cellularBarEmptyUrl },
  { modifier: 'full-3', src: cellularBar3Url },
  { modifier: 'empty-2', src: cellularBarEmptyUrl },
  { modifier: 'full-2', src: cellularBar2Url },
  { modifier: 'empty-1', src: cellularBarEmptyUrl },
  { modifier: 'full-1', src: cellularBar1Url },
];

// Barre d'état iOS (heure figée à 9:41, convention d'Apple), dimensionnée par la variable --pt du parent.
export function IosStatusBar() {
  return (
    <div className="ios-status-bar">
      <div className="ios-status-bar__area">
        <span className="ios-status-bar__time">9:41</span>
      </div>
      {/* Place de l'île dynamique, dessinée par la maquette du téléphone. */}
      <div className="ios-status-bar__island" />
      <div className="ios-status-bar__area">
        <div className="ios-status-bar__icons">
          <span className="ios-status-bar__icon ios-status-bar__icon--cellular">
            <span className="ios-status-bar__cellular">
              {CELLULAR_BARS.map(({ modifier, src }) => (
                <span key={modifier} className={`ios-status-bar__cellular-bar ios-status-bar__cellular-bar--${modifier}`}>
                  <img className="ios-status-bar__cellular-bar-image" src={src} alt="" />
                </span>
              ))}
            </span>
          </span>
          <span className="ios-status-bar__icon ios-status-bar__icon--wifi">
            <img className="ios-status-bar__wifi" src={wifiUrl} alt="" />
          </span>
          <span className="ios-status-bar__icon ios-status-bar__icon--battery">
            <img className="ios-status-bar__battery" src={batteryUrl} alt="" />
          </span>
        </div>
      </div>
    </div>
  );
}
