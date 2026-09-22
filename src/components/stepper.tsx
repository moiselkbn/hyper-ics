import './stepper.css';

type StepperProps = {
  total: number;
  current: number; // 1 = première étape
};

export function Stepper({ total, current }: StepperProps) {
  return (
    <div className="stepper" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={current} aria-label="Progression">
      {Array.from({ length: total }, (_, index) => {
        let className = 'stepper__segment';
        if (index === current - 1) className += ' stepper__segment--current';
        else if (index < current) className += ' stepper__segment--active';
        return <span key={index} className={className} />;
      })}
    </div>
  );
}
