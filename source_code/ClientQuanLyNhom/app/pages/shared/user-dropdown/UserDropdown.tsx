import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../auth/hooks/useAuth";
import { FaUser, FaKey, FaSignOutAlt, FaEdit, FaChevronDown } from "react-icons/fa";
import styles from "./UserDropdown.module.scss";

interface Props {
  onEditProfile: () => void;
  onChangePassword: () => void;
}

const UserDropdown: React.FC<Props> = ({ onEditProfile, onChangePassword }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Đóng dropdown khi click bên ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    setIsOpen(false);
    // Xóa tất cả dữ liệu user khỏi storage
    localStorage.removeItem("user");
    localStorage.removeItem("rememberMe");
    sessionStorage.removeItem("user");
    // Gọi logout từ context
    logout();
    // Redirect về trang login
    navigate("/login");
  };

  const handleEditProfile = () => {
    setIsOpen(false);
    onEditProfile();
  };

  const handleChangePassword = () => {
    setIsOpen(false);
    onChangePassword();
  };

  if (!user) return null;

  const resolveAvatar = () => {
    if (user?.AnhBia) {
      if (user.AnhBia.startsWith("http")) {
        return user.AnhBia;
      }
      const baseUrl = import.meta.env.VITE_API_URL || "https://localhost:7036";
      console.log("Avatar URL:", `${baseUrl}${user.AnhBia}`);
      return `${baseUrl}${user.AnhBia}`;
    }
    return null;
  };

  const avatarUrl = resolveAvatar();

  return (
    <div className={styles.userDropdown} ref={dropdownRef}>
      {/* Avatar Button */}
      <button 
        className={styles.avatarButton}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className={`${styles.avatar} ${avatarUrl ? styles.avatarImage : ""}`}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="User avatar" />
          ) : (
            <FaUser />
          )}
        </div>
        <FaChevronDown className={`${styles.chevron} ${isOpen ? styles.open : ""}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className={styles.dropdownMenu}>
          {/* User Info */}
          <div className={styles.userInfo}>
            <div className={`${styles.userAvatar} ${avatarUrl ? styles.avatarImage : ""}`}>
              {avatarUrl ? <img src={avatarUrl} alt="User avatar" /> : <FaUser />}
            </div>
            <div className={styles.userDetails}>
              <div className={styles.userName}>{user.HoTen || user.HoTen || "Người dùng"}</div>
              <div className={styles.userEmail}>{user.Mail || user.Mail}</div>
            </div>
          </div>

          <div className={styles.divider}></div>

          {/* Menu Items */}
          <div className={styles.menuItems}>
            <button className={styles.menuItem} onClick={handleEditProfile}>
              <FaEdit className={styles.menuIcon} />
              <span>Chỉnh sửa profile</span>
            </button>
            
            <button className={styles.menuItem} onClick={handleChangePassword}>
              <FaKey className={styles.menuIcon} />
              <span>Đổi mật khẩu</span>
            </button>
            
            <div className={styles.divider}></div>
            
            <button className={`${styles.menuItem} ${styles.logout}`} onClick={handleLogout}>
              <FaSignOutAlt className={styles.menuIcon} />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDropdown;
