import React, { useState } from "react";
import styles from "./ForgotPassword.module.scss";
import { FaEnvelope, FaArrowLeft, FaQuestionCircle } from "react-icons/fa";
import { useForgotPassword } from "../hooks/useForgotPassword";
import { toast } from "react-toastify";
import Modal from "../../shared/pop-up/Modal";
import api from "../../../apis/api";
import axios from "axios";

type PasswordResetFormState = {
  tenTaiKhoan: string;
  hoTen: string;
  email: string;
  soDienThoai: string;
  lyDo: string;
};

const INITIAL_RESET_STATE: PasswordResetFormState = {
  tenTaiKhoan: "",
  hoTen: "",
  email: "",
  soDienThoai: "",
  lyDo: "",
};

interface Props {
  onBack: () => void;
  onNext: (email: string) => void;
}

const ForgotPassword: React.FC<Props> = ({ onBack, onNext }) => {
  const [email, setEmail] = useState("");
  const { sendOtp, loading } = useForgotPassword();
  const [isResetRequestOpen, setIsResetRequestOpen] = useState(false);
  const [resetForm, setResetForm] =
    useState<PasswordResetFormState>(INITIAL_RESET_STATE);
  const [resetLoading, setResetLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error("Email không được để trống!");
      return;
    }

    if (!email.includes("@")) {
      toast.error("Email không hợp lệ!");
      return;
    }

    try {
      await sendOtp(email);
      onNext(email);
    } catch (error) {
      // Error đã được handle trong hook
    }
  };

  const handleOpenResetRequest = () => {
    setIsResetRequestOpen(true);
  };

  const handleResetRequestClose = () => {
    if (resetLoading) return;
    setIsResetRequestOpen(false);
  };

  const handleResetFormChange = (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = event.target;
    setResetForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleResetRequestSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const trimmedForm = {
      tenTaiKhoan: resetForm.tenTaiKhoan.trim(),
      hoTen: resetForm.hoTen.trim(),
      email: resetForm.email.trim(),
      soDienThoai: resetForm.soDienThoai.trim(),
      lyDo: resetForm.lyDo.trim(),
    };

    if (!trimmedForm.tenTaiKhoan) {
      toast.error("Vui lòng nhập tên đăng nhập");
      return;
    }

    if (!trimmedForm.hoTen) {
      toast.error("Vui lòng nhập họ tên");
      return;
    }

    if (!trimmedForm.email || !trimmedForm.email.includes("@")) {
      toast.error("Email không hợp lệ");
      return;
    }

    if (!trimmedForm.soDienThoai) {
      toast.error("Vui lòng nhập số điện thoại");
      return;
    }

    if (!trimmedForm.lyDo) {
      toast.error("Vui lòng nhập lý do cần reset mật khẩu");
      return;
    }

    const payload = {
      tenTaiKhoan: trimmedForm.tenTaiKhoan,
      hoTen: trimmedForm.hoTen,
      email: trimmedForm.email,
      soDienThoai: trimmedForm.soDienThoai,
      lyDo: trimmedForm.lyDo,
    };

    try {
      setResetLoading(true);
      await api.post("/Admin/reset-password-requests", payload);
      toast.success(
        "Đã gửi yêu cầu reset mật khẩu, vui lòng chờ quản trị viên xử lý"
      );
      setIsResetRequestOpen(false);
      setResetForm(INITIAL_RESET_STATE);
    } catch (error: unknown) {
      const message =
        axios.isAxiosError(error) && error.response?.data
          ? typeof error.response.data === "string"
            ? error.response.data
            : (error.response.data?.message ??
              "Không thể gửi yêu cầu reset mật khẩu")
          : "Không thể gửi yêu cầu reset mật khẩu";
      toast.error(message);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className={styles.formContainer}>
      <h2 className={styles.title}>🔑 Quên mật khẩu</h2>

      <p className={styles.description}>
        Nhập email của bạn để nhận mã OTP đặt lại mật khẩu
      </p>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.inputGroup}>
          <FaEnvelope className={styles.icon} />
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <button type="submit" className={styles.primaryBtn} disabled={loading}>
          {loading ? "Đang gửi..." : "Gửi mã OTP"}
        </button>
      </form>

      <div className={styles.actionsRow}>
        <button onClick={onBack} className={styles.secondaryBtn}>
          <FaArrowLeft />
          Quay lại đăng nhập
        </button>

        <button
          type="button"
          className={styles.neutralBtn}
          onClick={handleOpenResetRequest}
        >
          <FaQuestionCircle />
          Yêu cầu reset mật khẩu?
        </button>
      </div>

      <Modal
        isOpen={isResetRequestOpen}
        onClose={handleResetRequestClose}
        title="Yêu cầu Reset Mật khẩu"
      >
        <div className={styles.recoveryModal}>
          <p className={styles.recoveryIntro}>
            Điền đầy đủ thông tin để quản trị viên xác thực và reset mật khẩu
            cho bạn.
          </p>
          <form
            className={styles.recoveryForm}
            onSubmit={handleResetRequestSubmit}
          >
            <div className={styles.formGrid}>
              <label className={styles.formField}>
                <span>Tên đăng nhập *</span>
                <input
                  name="tenTaiKhoan"
                  value={resetForm.tenTaiKhoan}
                  onChange={handleResetFormChange}
                  placeholder="khang1234"
                  disabled={resetLoading}
                  required
                />
              </label>
              <label className={styles.formField}>
                <span>Họ và tên *</span>
                <input
                  name="hoTen"
                  value={resetForm.hoTen}
                  onChange={handleResetFormChange}
                  placeholder="Nguyễn Văn A"
                  disabled={resetLoading}
                  required
                />
              </label>
              <label className={styles.formField}>
                <span>Email *</span>
                <input
                  type="email"
                  name="email"
                  value={resetForm.email}
                  onChange={handleResetFormChange}
                  placeholder="Ví dụ: user@gmail.com"
                  disabled={resetLoading}
                  required
                />
              </label>
              <label className={styles.formField}>
                <span>Số điện thoại *</span>
                <input
                  name="soDienThoai"
                  value={resetForm.soDienThoai}
                  onChange={handleResetFormChange}
                  placeholder="Ví dụ: 0987..."
                  disabled={resetLoading}
                  required
                />
              </label>
            </div>
            <label className={`${styles.formField} ${styles.fullWidth}`}>
              <span>Lý do cần reset mật khẩu *</span>
              <textarea
                name="lyDo"
                value={resetForm.lyDo}
                onChange={handleResetFormChange}
                placeholder="Mô tả lý do bạn cần reset mật khẩu (ví dụ: quên mật khẩu, bị hack, v.v...)"
                rows={3}
                disabled={resetLoading}
                required
              />
            </label>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={handleResetRequestClose}
                disabled={resetLoading}
              >
                Huỷ
              </button>
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={resetLoading}
              >
                {resetLoading ? "Đang gửi..." : "Gửi yêu cầu"}
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
};

export default ForgotPassword;
