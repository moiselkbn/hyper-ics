import './checkbox-row.css';

type CheckboxRowProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function CheckboxRow({ label, checked, onChange }: CheckboxRowProps) {
  return (
    <label className="checkbox-row">
      <input
        className="checkbox-row__input"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="checkbox-row__box" aria-hidden="true" />
      <span className="checkbox-row__label">{label}</span>
    </label>
  );
}
