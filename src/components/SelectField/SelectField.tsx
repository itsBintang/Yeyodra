import { useId, useState, SelectHTMLAttributes } from "react";
import "./SelectField.scss";

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  theme?: "primary" | "dark";
  label?: string;
  options?: { key: string; value: string; label: string }[];
}

export function SelectField({
  value,
  label,
  options = [{ key: "-", value: value?.toString() || "-", label: "-" }],
  theme = "primary",
  onChange,
  className,
  ...props
}: Readonly<SelectFieldProps>) {
  const [isFocused, setIsFocused] = useState(false);
  const id = useId();

  return (
    <div className={`select-field__container ${className || ""}`}>
      {label && (
        <label htmlFor={id} className="select-field__label">
          {label}
        </label>
      )}

      <div
        className={`select-field select-field--${theme} ${
          isFocused ? "select-field--focused" : ""
        }`}
      >
        <select
          id={id}
          value={value}
          className="select-field__option"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChange={onChange}
          {...props}
        >
          {options.map((option) => (
            <option key={option.key} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

