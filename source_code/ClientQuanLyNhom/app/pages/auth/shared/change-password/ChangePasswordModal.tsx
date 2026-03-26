import { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "../../../shared/pop-up/Modal";
import styles from "./ChangePasswordModal.module.scss";
import api from "../../../../apis/api";
import { toast } from "react-toastify";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId?: number | null;
  onSuccess?: () => void;
}

type ValidationErrors = {
  oldPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
  api?: string;
};

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  accountId,
  onSuccess,
}) => {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});

  const toggleShowPasswords = () => setShowPasswords((prev) => !prev);

  const resetState = useCallback(() => {
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setErrors({});
    setLoading(false);
    setShowPasswords(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen, resetState]);

  const handleClose = useCallback(() => {
    if (loading) return;
    resetState();
    onClose();
  }, [loading, onClose, resetState]);

  const validationMessages = useMemo(
    () => ({
      required: "Vui lòng nhập thông tin.",
      length: "Mật khẩu mới phải có ít nhất 8 ký tự.",
      complexity: "Mật khẩu mới phải có chữ hoa, chữ thường, số và ký tự đặc biệt.",
      mismatch: "Xác nhận mật khẩu không khớp.",
    }),
    []
  );

  const validate = useCallback((): ValidationErrors => {
    const nextErrors: ValidationErrors = {};

    if (!oldPassword.trim()) {
      nextErrors.oldPassword = validationMessages.required;
    }
    const normalizedNewPassword = newPassword.trim();

    if (!normalizedNewPassword) {
      nextErrors.newPassword = validationMessages.required;
    } else if (normalizedNewPassword.length < 8) {
      nextErrors.newPassword = validationMessages.length;
    } else {
      const complexityRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;
      if (!complexityRegex.test(normalizedNewPassword)) {
        nextErrors.newPassword = validationMessages.complexity;
      }
    }
    if (!confirmPassword.trim()) {
      nextErrors.confirmPassword = validationMessages.required;
    } else if (confirmPassword !== newPassword) {
      nextErrors.confirmPassword = validationMessages.mismatch;
    }
    return nextErrors;
  }, [confirmPassword, newPassword, oldPassword, validationMessages]);

  const handleSubmit = async () => {
    if (!accountId) {
      toast.error("Không tìm thấy tài khoản.");
      return;
    }

    const validationResult = validate();
    if (Object.keys(validationResult).length > 0) {
      setErrors(validationResult);
      return;
    }

    setLoading(true);
    setErrors({});
    try {
      await api.post(`/Auth/ChangePassword/${accountId}`, {
        oldPassword: oldPassword.trim(),
        newPassword: newPassword.trim(),
      });

      toast.success("Đổi mật khẩu thành công.");
      onSuccess?.();
      handleClose();
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data ||
        "Không thể đổi mật khẩu. Vui lòng thử lại.";
      setErrors((prev) => ({ ...prev, api: message }));
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Đổi mật khẩu">
      <div className={styles.modalBody}>
        <div className={styles.fieldGroup}>
          <label htmlFor="oldPassword">Mật khẩu hiện tại</label>
          <input
            id="oldPassword"
            type={showPasswords ? "text" : "password"}
            value={oldPassword}
            onChange={(event) => {
              if (errors.oldPassword || errors.api) {
                setErrors((prev) => ({ ...prev, oldPassword: undefined, api: undefined }));
              }
              setOldPassword(event.target.value);
            }}
            placeholder="Nhập mật khẩu hiện tại"
            disabled={loading}
          />
          {errors.oldPassword && <span className={styles.errorText}>{errors.oldPassword}</span>}
        </div>

        <div className={styles.fieldGroup}>
          <label htmlFor="newPassword">Mật khẩu mới</label>
          <input
            id="newPassword"
            type={showPasswords ? "text" : "password"}
            value={newPassword}
            onChange={(event) => {
              if (errors.newPassword || errors.api) {
                setErrors((prev) => ({ ...prev, newPassword: undefined, api: undefined }));
              }
              setNewPassword(event.target.value);
            }}
            placeholder="Nhập mật khẩu mới"
            disabled={loading}
          />
          {errors.newPassword && <span className={styles.errorText}>{errors.newPassword}</span>}
        </div>

        <div className={styles.fieldGroup}>
          <label htmlFor="confirmPassword">Xác nhận mật khẩu mới</label>
          <input
            id="confirmPassword"
            type={showPasswords ? "text" : "password"}
            value={confirmPassword}
            onChange={(event) => {
              if (errors.confirmPassword || errors.api) {
                setErrors((prev) => ({ ...prev, confirmPassword: undefined, api: undefined }));
              }
              setConfirmPassword(event.target.value);
            }}
            placeholder="Nhập lại mật khẩu mới"
            disabled={loading}
          />
          {errors.confirmPassword && (
            <span className={styles.errorText}>{errors.confirmPassword}</span>
          )}
        </div>

        <div className={styles.toggleRow}>
          <label className={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={showPasswords}
              onChange={toggleShowPasswords}
              disabled={loading}
            />
            Hiển thị mật khẩu
          </label>
        </div>

        {errors.api && <div className={styles.errorBanner}>{errors.api}</div>}

        <div className={styles.actions}>
          <button
            className={styles.buttonPrimary}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Đang xử lý..." : "Lưu thay đổi"}
          </button>
          <button
            className={styles.buttonSecondary}
            onClick={handleClose}
            disabled={loading}
          >
            Hủy
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ChangePasswordModal;
