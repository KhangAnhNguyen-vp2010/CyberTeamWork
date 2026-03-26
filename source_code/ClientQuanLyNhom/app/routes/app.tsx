import { useAuth } from "../pages/auth/hooks/useAuth";
import { useNavigate } from "react-router";
import { useEffect } from "react";
import MainPage from "~/pages/main/main";
import { ToastContainer } from "react-toastify";

export default function AppPage() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    console.log(
      "AppPage - loading:",
      loading,
      "isAuthenticated:",
      isAuthenticated
    );
    // Chỉ redirect khi đã load xong và chưa đăng nhập
    if (!loading && !isAuthenticated) {
      console.log("AppPage - Redirecting to /login because not authenticated");
      navigate("/login", { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  // Hiển thị loading khi đang kiểm tra auth
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          gap: "1rem",
          background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
        }}
      >
        <div
          style={{
            width: "50px",
            height: "50px",
            border: "4px solid #e2e8f0",
            borderTop: "4px solid #3b82f6",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        />
        <p style={{ fontSize: "16px", color: "#64748b", margin: 0 }}>
          Đang tải...
        </p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Chỉ hiển thị AppLayout nếu đã đăng nhập
  if (!isAuthenticated) {
    return null; // Sẽ redirect trong useEffect
  }

  return (
    <>
      <MainPage />
      <ToastContainer />
    </>
  );
}
