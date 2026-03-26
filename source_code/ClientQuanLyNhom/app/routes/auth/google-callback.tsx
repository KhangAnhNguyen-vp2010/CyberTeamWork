import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { oauthService } from "../../services/oauthService";
import { toast } from "react-toastify";
import { useAuth } from "../../pages/auth/hooks/useAuth";

export default function GoogleCallback() {
  const navigate = useNavigate();
  const { login, loading } = useAuth();
  const hasRun = useRef(false); // Ngăn chặn chạy nhiều lần

  useEffect(() => {
    // Đợi auth loading hoàn thành trước khi xử lý callback
    if (loading) return;

    // Chỉ chạy 1 lần
    if (hasRun.current) return;
    hasRun.current = true;

    const handleCallback = async () => {
      try {
        const params = oauthService.getCallbackParams();
        if (params) {
          console.log("Processing Google callback...");
          const result = await oauthService.handleGoogleCallback(
            params.code,
            params.state
          );

          if (result.success && result.user) {
            // Kiểm tra xem có phải account linking không (nếu user đã có profile đầy đủ)
            const hasExistingProfile =
              result.user.HoTen &&
              (result.user.GioiTinh || result.user.NgaySinh);

            if (hasExistingProfile) {
              toast.success(
                "Tài khoản Google đã được liên kết với tài khoản hiện có!"
              );
            } else {
              toast.success("Đăng nhập Google thành công!");
            }

            // Backend đã trả về user với đúng format
            const user = {
              UserId: result.user.UserId,
              Mail: result.user.Mail,
              HoTen: result.user.HoTen,
              PassHash: "", // Google login không có password
              GioiTinh: result.user.GioiTinh || "",
              NgaySinh: result.user.NgaySinh || "",
              MoTaBanThan: result.user.MoTaBanThan || "",
              SoDienThoai: "", // Google không có số điện thoại
              DiaChi: "", // Google không có địa chỉ
              TrangThai: true,
            };
            console.log("Google login user:", user);

            // Make sure user.UserId is a number
            if (typeof user.UserId !== "number") {
              user.UserId = parseInt(user.UserId);
            }

            // Cập nhật context và localStorage
            login(user, true);
            console.log("Login context updated with user:", user);

            // Xóa query params khỏi URL và điều hướng
            window.history.replaceState({}, document.title, "/app");
            navigate("/app", { replace: true });
          } else {
            toast.error(result.error || "Đăng nhập Google thất bại!");
            window.history.replaceState({}, document.title, "/login");
            navigate("/login", { replace: true });
          }
        } else {
          toast.error("Thiếu thông tin xác thực!");
          navigate("/login", { replace: true });
        }
      } catch (error) {
        console.error("Google callback error:", error);
        toast.error("Lỗi xử lý đăng nhập Google!");
        navigate("/login", { replace: true });
      }
    };

    handleCallback();
  }, [loading]); // Chạy khi loading thay đổi

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      <div>
        {loading ? "Đang khởi tạo..." : "Đang xử lý đăng nhập Google..."}
      </div>
      <div style={{ fontSize: "0.9rem", color: "#666" }}>
        Vui lòng đợi trong giây lát...
      </div>
    </div>
  );
}
