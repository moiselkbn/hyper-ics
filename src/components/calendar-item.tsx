import type { CSSProperties } from 'react';
import clockCircleUrl from '../assets/clock-circle.svg';
import clockHandsUrl from '../assets/clock-hands.svg';
import mapPinArrowUrl from '../assets/map-pin-arrow.svg';
import mapPinOutlineUrl from '../assets/map-pin-outline.svg';
import './calendar-item.css';

type CalendarItemProps = {
  title: string;
  room: string;
  time: string;
  style?: CSSProperties;
};

// Événement tel qu'il apparaîtra dans le calendrier de l'élève.
export function CalendarItem({ title, room, time, style }: CalendarItemProps) {
  return (
    <div className="calendar-item" style={style} aria-hidden="true">
      <p className="calendar-item__title">{title}</p>
      <p className="calendar-item__line">
        <span className="calendar-item__icon calendar-item__icon--pin">
          <img className="calendar-item__icon-base" src={mapPinOutlineUrl} alt="" />
          <img className="calendar-item__icon-inner" src={mapPinArrowUrl} alt="" />
        </span>
        {room}
      </p>
      <p className="calendar-item__line">
        <span className="calendar-item__icon calendar-item__icon--clock">
          <img className="calendar-item__icon-base" src={clockCircleUrl} alt="" />
          <img className="calendar-item__icon-inner" src={clockHandsUrl} alt="" />
        </span>
        {time}
      </p>
    </div>
  );
}
