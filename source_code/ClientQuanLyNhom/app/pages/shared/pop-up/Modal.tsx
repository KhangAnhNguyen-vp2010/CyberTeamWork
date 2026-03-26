// Modal.tsx
import React from "react";
import { createPortal } from "react-dom";
import styles from "./Modal.module.scss";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, title }) => {
  if (!isOpen) return null;

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {title && (
          <div className={styles.modalHeader}>
            <h2>{title}</h2>
          </div>
        )}
        <div className={styles.modalContent}>{children}</div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;
