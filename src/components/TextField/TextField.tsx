import { InputHTMLAttributes } from "react";
import "./TextField.scss";

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  theme?: "light" | "dark";
  containerProps?: React.HTMLAttributes<HTMLDivElement>;
}

export function TextField({
  theme = "light",
  containerProps,
  ...inputProps
}: TextFieldProps) {
  return (
    <div
      {...containerProps}
      className={`text-field ${containerProps?.className || ""}`}
    >
      <input
        {...inputProps}
        className={`text-field__input text-field__input--${theme}`}
        type="text"
      />
    </div>
  );
}

