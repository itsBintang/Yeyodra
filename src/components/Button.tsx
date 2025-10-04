import classNames from "classnames";
import { PlacesType, Tooltip } from "react-tooltip";
import { useId } from "react";
import "./Button.scss";

export interface ButtonProps
  extends React.DetailedHTMLProps<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    HTMLButtonElement
  > {
  tooltip?: string;
  tooltipPlace?: PlacesType;
  theme?: "primary" | "outline" | "dark" | "danger";
}

export function Button({
  children,
  theme = "primary",
  className,
  tooltip,
  tooltipPlace = "top",
  ...props
}: Readonly<ButtonProps>) {
  const id = useId();

  const tooltipProps = tooltip
    ? {
        "data-tooltip-id": id,
        "data-tooltip-place": tooltipPlace,
        "data-tooltip-content": tooltip,
      }
    : {};

  return (
    <>
      <button
        type="button"
        className={classNames("button", `button--${theme}`, className)}
        {...props}
        {...tooltipProps}
      >
        {children}
      </button>

      {tooltip && <Tooltip id={id} />}
    </>
  );
}

