import { useState } from "react";
import { FaLock, FaUserShield } from "react-icons/fa";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { toast } from "react-toastify";
import { useNavigate } from "react-router";
import axios from "axios";
import styles from "./AdminLogin.module.scss";

const AdminLogin = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quên mật khẩu
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetUsername, setResetUsername] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetStep, setResetStep] = useState(1); // 1: nhập email, 2: nhập OTP + mật khẩu mới
  const [isResetting, setIsResetting] = useState(false);

  const handleSendOTP = async () => {
    if (!resetEmail.trim() || !resetUsername.trim()) {
      toast.error("Vui lòng nhập email và tên đăng nhập");
      return;
    }

    try {
      setIsResetting(true);
      await axios.post("https://localhost:7036/api/Admin/forgot-password", {
        email: resetEmail.trim(),
        tenTaiKhoan: resetUsername.trim(),
      });

      toast.success("Mã OTP đã được gửi đến email của bạn");
      setResetStep(2);
    } catch (error) {
      console.error("Send OTP failed", error);
      const message =
        axios.isAxiosError(error) && error.response?.data
          ? error.response.data
          : "Không thể gửi OTP. Vui lòng kiểm tra thông tin";
      toast.error(message);
    } finally {
      setIsResetting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!otp.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      toast.error("Vui lòng nhập đầy đủ thông tin");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }

    try {
      setIsResetting(true);
      await axios.post("https://localhost:7036/api/Admin/reset-password", {
        email: resetEmail.trim(),
        tenTaiKhoan: resetUsername.trim(),
        otp: otp.trim(),
        newPassword: newPassword,
      });

      toast.success("Đặt lại mật khẩu thành công! Vui lòng đăng nhập");
      setShowForgotModal(false);
      setResetStep(1);
      setResetEmail("");
      setResetUsername("");
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Reset password failed", error);
      const message =
        axios.isAxiosError(error) && error.response?.data
          ? error.response.data
          : "Không thể đặt lại mật khẩu. Vui lòng kiểm tra mã OTP";
      toast.error(message);
    } finally {
      setIsResetting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!username.trim() || !password.trim()) {
      toast.error("Vui lòng nhập đầy đủ thông tin đăng nhập");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await axios.post(
        "https://localhost:7036/api/Admin/login",
        {
          tenTaiKhoan: username.trim(),
          password: password,
        }
      );

      if (response?.data) {
        toast.success("Đăng nhập admin thành công");
        console.log("Login response:", response.data); // Debug
        localStorage.setItem("adminSession", "true");
        localStorage.setItem("adminSession:issuedAt", new Date().toISOString());
        // Lưu email để sử dụng cho đổi mật khẩu
        const email = response.data.user?.email;
        if (email) {
          localStorage.setItem("adminEmail", email);
          console.log("Saved admin email:", email); // Debug
        } else {
          console.warn("Email not found in response"); // Debug
        }
        setTimeout(() => navigate("/management"), 400);
      } else {
        toast.error("Thông tin đăng nhập không hợp lệ");
      }
    } catch (error) {
      console.error("Admin login failed", error);
      const message =
        axios.isAxiosError(error) && error.response?.data
          ? error.response.data
          : "Không thể đăng nhập, vui lòng thử lại";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.adminLayout}>
      <div className={styles.backdrop} />
      <div className={styles.loginCard}>
        <div className={styles.cardHeader}>
          <span className={styles.badge}>
            <FaUserShield />
          </span>
          <h1>Admin Portal</h1>
          <p>Quản trị CyberTeamWork - Đăng nhập để tiếp tục</p>
        </div>

        <form className={styles.loginForm} onSubmit={handleSubmit}>
          <label className={styles.formGroup}>
            <span className={styles.label}>Tên đăng nhập</span>
            <input
              type="text"
              placeholder="Nhập tên đăng nhập"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
              disabled={isSubmitting}
            />
          </label>

          <label className={styles.formGroup}>
            <span className={styles.label}>Mật khẩu</span>
            <div className={styles.passwordField}>
              <FaLock className={styles.prefixIcon} />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Nhập mật khẩu"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                disabled={isSubmitting}
              />
              <button
                type="button"
                className={styles.togglePassword}
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"}
                disabled={isSubmitting}
              >
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </label>

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Đang xử lý..." : "Đăng nhập"}
          </button>

          <button
            type="button"
            className={styles.forgotBtn}
            onClick={() => setShowForgotModal(true)}
            disabled={isSubmitting}
          >
            Quên mật khẩu?
          </button>
        </form>
      </div>

      {/* Modal Quên Mật Khẩu */}
      {showForgotModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowForgotModal(false)}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h2>Đặt Lại Mật Khẩu</h2>
              <button
                className={styles.closeBtn}
                onClick={() => {
                  setShowForgotModal(false);
                  setResetStep(1);
                  setResetEmail("");
                  setResetUsername("");
                  setOtp("");
                  setNewPassword("");
                  setConfirmPassword("");
                }}
              >
                ✕
              </button>
            </div>

            {resetStep === 1 ? (
              <div className={styles.modalBody}>
                <p className={styles.modalDesc}>
                  Nhập email và tên đăng nhập để nhận mã OTP
                </p>
                <div className={styles.formGroup}>
                  <label>Email</label>
                  <input
                    type="email"
                    placeholder="Nhập email của bạn"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    disabled={isResetting}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Tên đăng nhập</label>
                  <input
                    type="text"
                    placeholder="Nhập tên đăng nhập"
                    value={resetUsername}
                    onChange={(e) => setResetUsername(e.target.value)}
                    disabled={isResetting}
                  />
                </div>
                <button
                  className={styles.submitBtn}
                  onClick={handleSendOTP}
                  disabled={isResetting}
                >
                  {isResetting ? "Đang gửi..." : "Gửi mã OTP"}
                </button>
              </div>
            ) : (
              <div className={styles.modalBody}>
                <p className={styles.modalDesc}>
                  Nhập mã OTP đã gửi đến email <strong>{resetEmail}</strong>
                </p>
                <div className={styles.formGroup}>
                  <label>Mã OTP</label>
                  <input
                    type="text"
                    placeholder="Nhập mã OTP 6 số"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    maxLength={6}
                    disabled={isResetting}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Mật khẩu mới</label>
                  <input
                    type="password"
                    placeholder="Nhập mật khẩu mới"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isResetting}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Xác nhận mật khẩu</label>
                  <input
                    type="password"
                    placeholder="Nhập lại mật khẩu mới"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isResetting}
                  />
                </div>
                <div className={styles.modalActions}>
                  <button
                    className={styles.backBtn}
                    onClick={() => setResetStep(1)}
                    disabled={isResetting}
                  >
                    Quay lại
                  </button>
                  <button
                    className={styles.submitBtn}
                    onClick={handleResetPassword}
                    disabled={isResetting}
                  >
                    {isResetting ? "Đang xử lý..." : "Đặt lại mật khẩu"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLogin;
