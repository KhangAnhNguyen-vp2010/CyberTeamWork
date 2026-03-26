import React, { useState, useEffect, useMemo } from "react";
import styles from "./ResetPassword.module.scss";
import { FaLock, FaEye, FaEyeSlash, FaArrowLeft } from "react-icons/fa";
import { useResetPassword } from "../hooks/useResetPassword";
import { toast } from "react-toastify";

interface Props {
  email: string;
  onBack: () => void;
  onSuccess: () => void;
}

const ResetPassword: React.FC<Props> = ({ email, onBack, onSuccess }) => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const { resetPassword, loading } = useResetPassword();

  const passwordChecks = useMemo(
    () => ({
      length: newPassword.length >= 8,
      upper: /[A-Z]/.test(newPassword),
      lower: /[a-z]/.test(newPassword),
      digit: /\d/.test(newPassword),
      special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword),
    }),
    [newPassword]
  );

  const isPasswordValid = useMemo(
    () => Object.values(passwordChecks).every(Boolean),
    [passwordChecks]
  );

  // Hiệu ứng mở rộng form khi nhập password
  useEffect(() => {
    if (newPassword && !isExpanded) setIsExpanded(true);
    if (!newPassword && isExpanded) {
      setIsClosing(true);
      setTimeout(() => {
        setIsExpanded(false);
        setIsClosing(false);
      }, 300);
    }
  }, [newPassword, isExpanded]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isPasswordValid) {
      toast.error("Mật khẩu mới chưa đáp ứng đầy đủ yêu cầu!");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp!");
      return;
    }

    try {
      await resetPassword(email, newPassword);
      toast.success("Đặt lại mật khẩu thành công!");
      onSuccess();
    } catch (error) {
      // Error đã được handle trong hook
    }
  };

  return (
    <div
      className={`${styles.formContainer} ${isExpanded ? styles.expanded : ""} ${!isExpanded && !newPassword ? styles.collapsed : ""}`}
    >
      <h2 className={styles.title}>🔒 Đặt lại mật khẩu</h2>

      <p className={styles.description}>
        Nhập mật khẩu mới cho email: <strong>{email}</strong>
      </p>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.inputGroup}>
          <FaLock className={styles.icon} />
          <input
            type={showNewPassword ? "text" : "password"}
            placeholder="Mật khẩu mới"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <span
            className={styles.eyeIcon}
            onClick={() => setShowNewPassword(!showNewPassword)}
          >
            {showNewPassword ? <FaEyeSlash /> : <FaEye />}
          </span>
        </div>

        {/* Hiển thị yêu cầu mật khẩu giống Register */}
        {(newPassword || isClosing) && (
          <div
            className={`${styles.passwordRequirements} ${isClosing ? styles.closing : ""}`}
          >
            <p className={styles.requirementTitle}>Mật khẩu phải chứa:</p>
            <ul className={styles.requirementList}>
              <li
                className={passwordChecks.length ? styles.valid : styles.invalid}
              >
                <span style={{ marginRight: "8px" }}>
                  {passwordChecks.length ? "✓" : "○"}
                </span>
                Ít nhất 8 ký tự
              </li>
              <li
                className={passwordChecks.upper ? styles.valid : styles.invalid}
              >
                <span style={{ marginRight: "8px" }}>
                  {passwordChecks.upper ? "✓" : "○"}
                </span>
                Ít nhất 1 chữ hoa
              </li>
              <li
                className={passwordChecks.lower ? styles.valid : styles.invalid}
              >
                <span style={{ marginRight: "8px" }}>
                  {passwordChecks.lower ? "✓" : "○"}
                </span>
                Ít nhất 1 chữ thường
              </li>
              <li
                className={passwordChecks.digit ? styles.valid : styles.invalid}
              >
                <span style={{ marginRight: "8px" }}>
                  {passwordChecks.digit ? "✓" : "○"}
                </span>
                Ít nhất 1 số
              </li>
              <li
                className={passwordChecks.special ? styles.valid : styles.invalid}
              >
                <span style={{ marginRight: "8px" }}>
                  {passwordChecks.special ? "✓" : "○"}
                </span>
                Ít nhất 1 ký tự đặc biệt
              </li>
            </ul>
          </div>
        )}

        {newPassword && !isPasswordValid && (
          <div className={styles.errorMsg}>
            Vui lòng nhập mật khẩu đáp ứng đầy đủ các yêu cầu ở trên.
          </div>
        )}

        <div className={styles.inputGroup}>
          <FaLock className={styles.icon} />
          <input
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Xác nhận mật khẩu mới"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <span
            className={styles.eyeIcon}
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
          </span>
        </div>

        <button
          type="submit"
          className={styles.primaryBtn}
          disabled={loading || !isPasswordValid || newPassword !== confirmPassword}
        >
          {loading ? "Đang đặt lại..." : "Đặt lại mật khẩu"}
        </button>
      </form>

      <button onClick={onBack} className={styles.secondaryBtn}>
        <FaArrowLeft />
        Quay lại
      </button>
    </div>
  );
};

export default ResetPassword;
