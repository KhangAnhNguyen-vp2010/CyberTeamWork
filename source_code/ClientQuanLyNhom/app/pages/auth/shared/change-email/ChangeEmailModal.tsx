import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Modal from "../../../shared/pop-up/Modal";
import styles from "./ChangeEmailModal.module.scss";
import api from "../../../../apis/api";
import { toast } from "react-toastify";
import { useAuth } from "../../hooks/useAuth";

interface ChangeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: number;
  currentEmail?: string | null;
}

type Step = "request" | "verify";

const RESEND_COOLDOWN = 60;

const ChangeEmailModal: React.FC<ChangeEmailModalProps> = ({
  isOpen,
  onClose,
  accountId,
  currentEmail,
}) => {
  const { user, login } = useAuth();
  const [step, setStep] = useState<Step>("request");
  const [newEmail, setNewEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  const countdownRef = useRef<number | null>(null);

  const clearCountdown = useCallback(() => {
    if (countdownRef.current !== null) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setCountdown(0);
  }, []);

  const startCountdown = useCallback(() => {
    clearCountdown();
    setCountdown(RESEND_COOLDOWN);
    countdownRef.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current !== null) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearCountdown]);

  useEffect(() => {
    if (!isOpen) {
      setStep("request");
      setNewEmail("");
      setOtp("");
      setError(null);
      setLoading(false);
      clearCountdown();
    }
  }, [isOpen, clearCountdown]);

  useEffect(() => () => clearCountdown(), [clearCountdown]);

  const handleModalClose = () => {
    if (loading) return;
    onClose();
  };

  const validateEmail = useCallback(
    (value: string) => {
      if (!value.trim()) {
        return "Vui lòng nhập email mới.";
      }
      if (currentEmail && value.trim().toLowerCase() === currentEmail.trim().toLowerCase()) {
        return "Email mới phải khác email hiện tại.";
      }
      const emailRegex = /[^@\s]+@[^@\s]+\.[^@\s]+/;
      if (!emailRegex.test(value.trim())) {
        return "Email không hợp lệ.";
      }
      return null;
    },
    [currentEmail]
  );

  const handleRequestChangeEmail = async () => {
    if (!accountId) {
      toast.error("Không tìm thấy tài khoản.");
      return;
    }

    const validationMessage = validateEmail(newEmail);
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.post("/Auth/change-email/request", {
        taiKhoanId: accountId,
        newEmail: newEmail.trim(),
      });
      toast.success("Đã gửi OTP xác nhận đến email mới.");
      setStep("verify");
      setOtp("");
      startCountdown();
    } catch (err: any) {
      
      const message = err?.response?.data || "Không thể gửi yêu cầu đổi email.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      setError("Vui lòng nhập mã OTP.");
      return;
    }
    if (!accountId) {
      toast.error("Không tìm thấy tài khoản.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.post("/Auth/change-email/verify", {
        taiKhoanId: accountId,
        newEmail: newEmail.trim(),
        otp: otp.trim(),
      });
      toast.success("Đổi email thành công.");
      if (user) {
        const updatedUser = {
          ...user,
          Mail: newEmail.trim(),
          Email: newEmail.trim(),
        } as typeof user;
        login(updatedUser, true);
      }
      onClose();
    } catch (err: any) {
      const message = err?.response?.data?.message || "Không thể xác thực OTP.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!accountId) {
      toast.error("Không tìm thấy tài khoản.");
      return;
    }
    if (countdown > 0) return;

    setLoading(true);
    setError(null);
    try {
      await api.post("/Auth/change-email/resend", {
        taiKhoanId: accountId,
      });
      toast.success("Đã gửi lại OTP.");
      startCountdown();
    } catch (err: any) {
      const message = err?.response?.data?.message || "Không thể gửi lại OTP.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const modalTitle = useMemo(() => {
    return step === "request" ? "Đổi email" : "Xác nhận OTP";
  }, [step]);

  return (
    <Modal isOpen={isOpen} onClose={handleModalClose} title={modalTitle}>
      <div className={styles.modalBody}>
        {step === "request" ? (
          <>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Email hiện tại</label>
              <input
                className={styles.input}
                value={currentEmail || ""}
                disabled
                readOnly
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Email mới</label>
              <input
                className={styles.input}
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Nhập email mới"
                disabled={loading}
              />
            </div>
            {error && <span className={styles.errorText}>{error}</span>}
            <div className={styles.actions}>
              <button
                className={styles.buttonPrimary}
                onClick={handleRequestChangeEmail}
                disabled={loading}
              >
                {loading ? "Đang gửi..." : "Gửi OTP"}
              </button>
              <button
                className={styles.buttonSecondary}
                onClick={handleModalClose}
                disabled={loading}
              >
                Hủy
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Email mới</label>
              <input
                className={styles.input}
                value={newEmail}
                disabled
                readOnly
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Mã OTP</label>
              <input
                className={styles.input}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Nhập mã OTP"
                maxLength={6}
                disabled={loading}
              />
              <span className={styles.helperText}>
                Mã OTP đã gửi đến email mới của bạn.
              </span>
            </div>
            {error && <span className={styles.errorText}>{error}</span>}
            <div className={styles.actions}>
              <button
                className={styles.buttonPrimary}
                onClick={handleVerifyOtp}
                disabled={loading || !otp.trim()}
              >
                {loading ? "Đang xác nhận..." : "Xác nhận"}
              </button>
              <button
                className={styles.buttonSecondary}
                onClick={handleResendOtp}
                disabled={loading || countdown > 0}
              >
                {countdown > 0 ? `Gửi lại sau ${countdown}s` : "Gửi lại OTP"}
              </button>
              <button
                className={styles.buttonSecondary}
                onClick={handleModalClose}
                disabled={loading}
              >
                Đóng
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default ChangeEmailModal;
