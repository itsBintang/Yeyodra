import { XIcon } from "@primer/octicons-react";
import { ReactNode, useEffect } from "react";
import "./Modal.scss";

export interface ModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  large?: boolean;
}

export function Modal({
  visible,
  title,
  onClose,
  children,
  large = false,
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
        className={`modal ${large ? "modal--large" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__header">
          <h3 className="modal__title">{title}</h3>
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

