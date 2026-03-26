// src/hooks/useAuth.ts
import { useState, useEffect } from "react";

const AUTH_UPDATED_EVENT = "auth:user-updated";

type User = {
  UserId: number;
  Mail: string;
  PassHash: string;
  HoTen: string;
  GioiTinh?: string;
  NgaySinh?: string;
  MoTaBanThan?: string;
  SoDienThoai?: string;
  DiaChi?: string;
  NgayTao?: string;
  TrangThai?: boolean;
  ChuyenMon?: string;
  TenTaiKhoan?: string;
  ThanhVienId?: number | null;
  LoaiTaiKhoan?: string;
  ChuyenMonId?: number | null;
  AnhBia?: string | null;
  quyenId?: number | null;
  tenQuyen?: string | null;
};

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = () => {
      // Kiểm tra localStorage trước (remember me)
      const rememberMe = localStorage.getItem("rememberMe");
      const storedUser = rememberMe
        ? localStorage.getItem("user")
        : sessionStorage.getItem("user");

      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          console.log("Loaded user:", parsedUser);
        } catch (error) {
          console.error("Error parsing stored user:", error);
          // Clear invalid data
          localStorage.removeItem("user");
          sessionStorage.removeItem("user");
          localStorage.removeItem("rememberMe");
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    };

    loadUser();

    const handleAuthUpdated = (event: Event) => {
      const detail = (event as CustomEvent<User | null>).detail;
      if (!detail) {
        setUser(null);
        return;
      }
      setUser(detail);
    };

    window.addEventListener("storage", loadUser);
    window.addEventListener(
      AUTH_UPDATED_EVENT,
      handleAuthUpdated as EventListener
    );
    return () => {
      window.removeEventListener("storage", loadUser);
      window.removeEventListener(
        AUTH_UPDATED_EVENT,
        handleAuthUpdated as EventListener
      );
    };
  }, []);

  const login = (userData: User, rememberMe: boolean = false) => {
    // Make sure UserId is a number
    if (typeof userData.UserId !== "number") {
      userData.UserId = parseInt(userData.UserId);
    }
    if (
      userData.ThanhVienId !== undefined &&
      userData.ThanhVienId !== null &&
      typeof userData.ThanhVienId !== "number"
    ) {
      userData.ThanhVienId = parseInt(
        userData.ThanhVienId as unknown as string
      );
    }

    // Make sure we have all required fields
    const userToStore = {
      ...userData,
      UserId: userData.UserId,
      ChuyenMon: userData.ChuyenMon || "",
      TrangThai: userData.TrangThai ?? true,
      TenTaiKhoan: userData.TenTaiKhoan || userData.Mail,
      AnhBia: userData.AnhBia ?? null,
    };

    // Always store in localStorage for Google OAuth
    localStorage.setItem("user", JSON.stringify(userToStore));

    // Set rememberMe if specified
    if (rememberMe) {
      localStorage.setItem("rememberMe", "true");
    } else {
      // If not rememberMe, also store in sessionStorage
      sessionStorage.setItem("user", JSON.stringify(userToStore));
    }

    // Update state
    setUser(userToStore);

    console.log("User stored successfully:", userToStore);

    window.dispatchEvent(
      new CustomEvent<User | null>(AUTH_UPDATED_EVENT, { detail: userToStore })
    );
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
    sessionStorage.removeItem("user");
    localStorage.removeItem("rememberMe");

    window.dispatchEvent(
      new CustomEvent<User | null>(AUTH_UPDATED_EVENT, { detail: null })
    );
  };

  const isAuthenticated = !!user;

  return {
    user,
    isAuthenticated,
    loading,
    login,
    logout,
  };
}
