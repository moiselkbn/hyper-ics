import './checkbox-row.css';

type CheckboxRowProps = {
  label: string;
  detail?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
};

export function CheckboxRow({ label, detail, checked, disabled = false, onChange }: CheckboxRowProps) {
  return (
    <label className={disabled ? 'checkbox-row checkbox-row--disabled' : 'checkbox-row'}>
      <input
        className="checkbox-row__input"
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="checkbox-row__box" aria-hidden="true" />
      <span className="checkbox-row__text">
        <span className="checkbox-row__label">{label}</span>
        {detail && <span className="checkbox-row__detail">{detail}</span>}
      </span>
    </label>
  );
}
