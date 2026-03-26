import React from "react";
import styles from "./ConfirmModal.module.scss";

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirming?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title = "Xác nhận",
  message,
  confirmLabel = "Đồng ý",
  cancelLabel = "Hủy",
  onConfirm,
  onCancel,
  confirming = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <button className={styles.closeBtn} onClick={onCancel} aria-label="Đóng">
          ✖
        </button>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <button
            className={styles.cancelBtn}
            onClick={onCancel}
            disabled={confirming}
          >
            {cancelLabel}
          </button>
          <button
            className={styles.confirmBtn}
            onClick={onConfirm}
            disabled={confirming}
          >
            {confirming ? "Đang xử lý..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
