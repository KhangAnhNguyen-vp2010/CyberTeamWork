import React, { useEffect } from "react";
import { useNavigate } from "react-router";
import styles from "./AuthForm.module.scss";
import Login from "./components/Login";
import loginIllustration from "./components/login.png";
import UserProfile from "./components/UserProfile";
import { useAuth } from "./hooks/useAuth";

const AuthForm: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/app");
    }
  }, [isAuthenticated, navigate]);

  // Hiển thị loading khi đang kiểm tra authentication
  if (loading) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.formWrapper}>
          <div style={{ textAlign: "center", padding: "20px" }}>
            <div>Đang tải...</div>
          </div>
        </div>
      </div>
    );
  }

  // Hiển th-form đăng nhập
  return (
    <div className={styles.wrapper}>
      <div className={styles.contentWrapper}>
        <div className={styles.heroPanel}>
          <div className={styles.heroGlow} />
          <div className={styles.heroText}>
            <h1>Chào mừng trở lại!</h1>
            <p>
              Kết nối với CyberTeamWork để quản lý đội nhóm, dự án và quy trình
              công việc một cách thông minh và hiệu quả.
            </p>
          </div>
          <div className={styles.heroIllustration}>
            <img src={loginIllustration} alt="Đăng nhập" loading="lazy" />
          </div>
        </div>

        <div className={styles.formWrapper}>
          <Login />
        </div>
      </div>
    </div>
  );
};

export default AuthForm;
