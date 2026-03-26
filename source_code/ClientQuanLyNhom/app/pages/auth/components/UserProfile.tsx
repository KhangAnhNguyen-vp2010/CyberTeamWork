import React from "react";
import { useAuth } from "../hooks/useAuth";
import { FaUser, FaEnvelope, FaCalendar, FaSignOutAlt } from "react-icons/fa";

const UserProfile: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div
      style={{
        padding: "20px",
        border: "1px solid #ddd",
        borderRadius: "8px",
        margin: "20px 0",
        backgroundColor: "#f9f9f9",
      }}
    >
      <h3>👤 Thông tin người dùng</h3>

      <div style={{ marginBottom: "10px" }}>
        <FaUser style={{ marginRight: "8px" }} />
        <strong>Tên:</strong> {user.HoTen || "Chưa cập nhật"}
      </div>

      <div style={{ marginBottom: "10px" }}>
        <FaEnvelope style={{ marginRight: "8px" }} />
        <strong>Email:</strong> {user.Mail || "Chưa cập nhật"}
      </div>

      <div style={{ marginBottom: "10px" }}>
        <FaCalendar style={{ marginRight: "8px" }} />
        <strong>Ngày sinh:</strong> {user.NgaySinh || "Chưa cập nhật"}
      </div>

      {user.GioiTinh && (
        <div style={{ marginBottom: "10px" }}>
          <strong>Giới tính:</strong> {user.GioiTinh}
        </div>
      )}

      {user.SoDienThoai && (
        <div style={{ marginBottom: "10px" }}>
          <strong>Số điện thoại:</strong> {user.SoDienThoai}
        </div>
      )}

      {user.DiaChi && (
        <div style={{ marginBottom: "10px" }}>
          <strong>Địa chỉ:</strong> {user.DiaChi}
        </div>
      )}

      {user.MoTaBanThan && (
        <div style={{ marginBottom: "10px" }}>
          <strong>Mô tả:</strong> {user.MoTaBanThan}
        </div>
      )}

      <button
        onClick={logout}
        style={{
          backgroundColor: "#dc3545",
          color: "white",
          border: "none",
          padding: "8px 16px",
          borderRadius: "4px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <FaSignOutAlt />
        Đăng xuất
      </button>
    </div>
  );
};

export default UserProfile;
