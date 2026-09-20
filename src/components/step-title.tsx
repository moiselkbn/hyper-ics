import badgeUrl from '../assets/step-badge.svg';
import './step-title.css';

type StepTitleProps = {
  step: number;
  children: string;
};

export function StepTitle({ step, children }: StepTitleProps) {
  return (
    <h1 className="step-title">
      <span className="step-title__badge" aria-hidden="true">
        <img className="step-title__badge-image" src={badgeUrl} alt="" />
        <span className="step-title__number">{step}</span>
      </span>
      {children}
    </h1>
  );
}
