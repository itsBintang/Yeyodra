import { XIcon } from "@primer/octicons-react";
import { ReactNode, useEffect } from "react";
import "./Modal.scss";

export interface ModalProps {
  visible: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  large?: boolean;
  className?: string;
}

export function Modal({
  visible,
  title,
  description,
  onClose,
  children,
  large = false,
  className,
}: ModalProps) {
  // Handle ESC key to close modal
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape" && visible) {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener("keydown", handleEsc);
      return () => document.removeEventListener("keydown", handleEsc);
    }
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div className="modal__overlay" onClick={onClose}>
      <div
        className={`modal ${large ? "modal--large" : ""} ${className || ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__header">
          <div className="modal__header-content">
            <h3 className="modal__title">{title}</h3>
            {description && <p className="modal__description">{description}</p>}
          </div>
          <button
            type="button"
            className="modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            <XIcon size={24} />
          </button>
        </div>
        <div className="modal__content">{children}</div>
      </div>
    </div>
  );
}

