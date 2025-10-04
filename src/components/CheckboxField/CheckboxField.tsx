import "./CheckboxField.scss";

export interface CheckboxFieldProps {
  label: string;
  checked: boolean;
  onChange: () => void;
}

export function CheckboxField({ label, checked, onChange }: CheckboxFieldProps) {
  return (
    <label className="checkbox-field">
      <input
        type="checkbox"
        className="checkbox-field__input"
        checked={checked}
        onChange={onChange}
      />
      <span className="checkbox-field__checkmark" />
      <span className="checkbox-field__label">{label}</span>
    </label>
  );
}

