import React, { useState } from "react";
import { useNavigate } from "react-router";
import styles from "./TextBox.module.scss";
import {
  FaUser,
  FaLock,
  FaGoogle,
  FaFacebook,
  FaEyeSlash,
  FaEye,
} from "react-icons/fa";
import { useLogin } from "../hooks/useLogin";
import { useAuth } from "../hooks/useAuth";
import { useSocialLogin } from "../hooks/useSocialLogin";
import ForgotPasswordFlow from "./ForgotPasswordFlow";
import { toast } from "react-toastify";

const Login: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const { login, loading } = useLogin();
  const { login: authLogin } = useAuth();
  const { handleGoogleLogin, loading: socialLoading } = useSocialLogin();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!account.trim()) {
      toast.error("Tên tài khoản không được để trống!");
      return;
    }

    if (!password.trim()) {
      toast.error("Mật khẩu không được để trống!");
      return;
    }

    try {
      const user = await login(account, password);

      if (!user) {
        toast.error("Đăng nhập thất bại!");
        return;
      }

      // useLogin đã trả về đúng format User rồi
      authLogin(user, rememberMe);
      toast.success("Đăng nhập thành công!");
      navigate("/app"); // Chuyển sang giao diện chính sau khi đăng nhập
    } catch (error) {
      // Error đã được handle trong hook useLogin
      // Không cần xử lý gì thêm vì hook đã hiển thị toast error
      return;
    }
  };

  const onGoogleLogin = async () => {
    try {
      await handleGoogleLogin();
    } catch (error) {
      console.error("Google login failed:", error);
    }
  };

  return (
    <div className={styles.formContainer}>
      <h2 className={styles.title}>🔒 Log in 🔒</h2>

      {/* <div className={styles.socials}>
          <button
            className={styles.googleBtn}
            onClick={onGoogleLogin}
            disabled={socialLoading}
          >
            <FaGoogle />{" "}
            {socialLoading ? "Đang xử lý..." : "Đăng nhập với Google"}
          </button>
        </div>

      <div className={styles.divider}>
        <span>or</span>
      </div> */}

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.inputGroup}>
          <FaUser className={styles.icon} />
          <input
            type="text"
            placeholder="Tên tài khoản"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            required
          />
        </div>

        <div className={styles.inputGroup}>
          <FaLock className={styles.icon} />
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <span
            className={styles.eyeIcon}
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <FaEyeSlash /> : <FaEye />}
          </span>
        </div>

        <div className={styles.options}>
          <label>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            Remember me
          </label>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setShowForgotPassword(true);
            }}
          >
            Forgot Password?
          </a>
        </div>

        <button type="submit" className={styles.primaryBtn} disabled={loading}>
          {loading ? "Đang đăng nhập..." : "Log In"}
        </button>
      </form>

      {showForgotPassword && (
        <ForgotPasswordFlow
          onBack={() => setShowForgotPassword(false)}
          onSuccess={() => setShowForgotPassword(false)}
        />
      )}
    </div>
  );
};

export default Login;
