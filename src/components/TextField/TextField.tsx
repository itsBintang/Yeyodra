import { InputHTMLAttributes, ReactNode } from "react";
import "./TextField.scss";

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  theme?: "light" | "dark";
  containerProps?: React.HTMLAttributes<HTMLDivElement>;
  label?: string;
  hint?: string;
  rightContent?: ReactNode;
}

export function TextField({
  theme = "light",
  containerProps,
  label,
  hint,
  rightContent,
  ...inputProps
}: TextFieldProps) {
  return (
    <div
      {...containerProps}
      className={`text-field ${containerProps?.className || ""}`}
    >
      {label && <label className="text-field__label">{label}</label>}
      
      <div className="text-field__wrapper">
        <div className="text-field__input-container">
          <input
            {...inputProps}
            className={`text-field__input text-field__input--${theme}`}
            type="text"
          />
        </div>
        
        {rightContent && (
          <div className="text-field__right-content">{rightContent}</div>
        )}
      </div>
      
      {hint && <span className="text-field__hint">{hint}</span>}
    </div>
  );
}

