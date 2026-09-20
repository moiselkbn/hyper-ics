import './stepper.css';

type StepperProps = {
  total: number;
  current: number; // 1 = première étape
};

export function Stepper({ total, current }: StepperProps) {
  return (
    <div className="stepper" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={current} aria-label="Progression">
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={index < current ? 'stepper__segment stepper__segment--active' : 'stepper__segment'}
        />
      ))}
    </div>
  );
}
