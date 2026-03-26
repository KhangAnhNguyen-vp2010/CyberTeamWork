import React, { useState, useEffect, useMemo } from "react";
import styles from "./TextBox.module.scss";
import { FaEnvelope, FaEye, FaEyeSlash, FaLock, FaUser } from "react-icons/fa";
import { useRegister } from "../hooks/useRegister";
import Modal from "../../shared/pop-up/Modal";
import OtpInput from "../shared/otp-input/OtpInput";
import { toast } from "react-toastify";

interface Props {
  onSwitch: () => void;
}

const Register: React.FC<Props> = ({ onSwitch }) => {
  const { register, loading } = useRegister();
  const [username, setUsername] = useState("");
  const [fullname, setFullname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const passwordChecks = useMemo(
    () => ({
      length: password.length >= 8,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      digit: /\d/.test(password),
      special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
    }),
    [password]
  );

  const isPasswordValid = useMemo(
    () => Object.values(passwordChecks).every(Boolean),
    [passwordChecks]
  );

  // Reset state khi component mount
  useEffect(() => {
    setIsExpanded(false);
    setIsClosing(false);
  }, []);

  // Handle password change with animation
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value;

    // Nếu password bị xóa hoàn toàn, trigger closing animation
    if (password && !newPassword) {
      setIsClosing(true);
      setIsExpanded(false);
      setTimeout(() => {
        setPassword(newPassword);
        setIsClosing(false);
      }, 300); // Đợi animation hoàn thành
    } else {
      setPassword(newPassword);
      // Mở rộng form khi có password (chỉ khi thực sự cần)
      if (newPassword && !isExpanded) {
        setIsExpanded(true);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Ngăn chặn spam click
    if (isSubmitting || loading) return;

    if (!isPasswordValid) {
      toast.error("Mật khẩu chưa đáp ứng đầy đủ yêu cầu!");
      return;
    }

    // Debug: kiểm tra giá trị form
    console.log("Form values:", { username, fullname, email, password });

    setIsSubmitting(true);
    try {
      const data = await register(username, fullname, email, password);
      console.log("Register success, data:", data);
      // Backend trả về message, mở OTP modal
      if (data) {
        toast.success("OTP đã được gửi tới email của bạn!");
        // Mở OTP modal
        setTimeout(() => {
          setIsOpen(true);
        }, 500);
      }
    } catch (error) {
      // error đã được handle trong hook
      console.log("Register failed:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <div
      className={`${styles.formContainer} ${isExpanded ? styles.expanded : ""} ${!isExpanded && !password ? styles.collapsed : ""}`}
    >
      <h2 className={styles.title}>🔑 Sign up 🔑</h2>

      <form className={styles.form}>
        <div className={styles.inputGroup}>
          <FaUser className={styles.icon} />
          <input
            type="text"
            placeholder="Tên tài khoản"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        <div className={styles.inputGroup}>
          <FaUser className={styles.icon} />
          <input
            type="text"
            placeholder="Họ và tên"
            value={fullname}
            onChange={(e) => setFullname(e.target.value)}
            required
          />
        </div>

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

        <div className={styles.inputGroup}>
          <FaLock className={styles.icon} />
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Mật khẩu"
            required
            value={password}
            onChange={handlePasswordChange}
          />
          <span
            className={styles.eyeIcon}
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <FaEyeSlash /> : <FaEye />}
          </span>
        </div>

        {/* Hiển thị yêu cầu mật khẩu */}
        {(password || isClosing) && (
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

        {password && !isPasswordValid && (
          <div className={styles.errorMsg} style={{ marginTop: "-0.2rem" }}>
            Vui lòng nhập mật khẩu đáp ứng đầy đủ các yêu cầu ở trên.
          </div>
        )}

        <button
          type="submit"
          className={styles.primaryBtn}
          onClick={handleSubmit}
          disabled={loading || isSubmitting || !isPasswordValid}
        >
          {loading || isSubmitting ? "Đang xử lý..." : "Đăng ký"}
        </button>
      </form>

      <p className={styles.switch}>
        Already have an account? <span onClick={onSwitch}>Login now</span>
      </p>
      {isOpen && (
        <Modal
          isOpen={isOpen}
          onClose={() => {
            setIsOpen(false);
            // Reset form khi đóng modal
            setUsername("");
            setFullname("");
            setEmail("");
            setPassword("");
          }}
          children={
            <OtpInput
              email={email}
              length={6}
              purpose="register"
              onSuccess={() => {
                setIsOpen(false);
                setUsername("");
                setFullname("");
                setEmail("");
                setPassword("");
                toast.success("Đăng ký thành công! Vui lòng đăng nhập.");
                setTimeout(() => onSwitch(), 400);
              }}
            />
          }
        />
      )}
    </div>
  );
};

export default Register;
