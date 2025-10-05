import { useId } from "react";
import { CheckIcon } from "@primer/octicons-react";
import "./CheckboxField.scss";

export interface CheckboxFieldProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function CheckboxField({ label, checked, onChange, disabled }: CheckboxFieldProps) {
  const id = useId();

  return (
    <div className="checkbox-field">
      <div className={`checkbox-field__checkbox ${checked ? "checked" : ""}`}>
        <input
          id={id}
          type="checkbox"
          className="checkbox-field__input"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
        {checked && <CheckIcon />}
      </div>
      <label htmlFor={id} className="checkbox-field__label">
        {label}
      </label>
    </div>
  );
}

