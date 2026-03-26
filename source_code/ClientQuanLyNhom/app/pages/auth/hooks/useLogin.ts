// src/hooks/useLogin.ts
import { useState } from "react";
import api from "../../../apis/api";
import { toast } from "react-toastify";

// Response từ backend (camelCase)
type BackendAuthResponse = {
  success: boolean;
  message?: string;
  user?: {
    taiKhoanId: number;
    thanhVienId: number | null;
    tenTaiKhoa?: string;
    tenTaiKhoan?: string;
    email: string;
    hoTen: string;
    gioiTinh?: string | null;
    ngaySinh?: string | null;
    moTaBanThan?: string | null;
    sdt?: string | null;
    diaChi?: string | null;
    loaiTaiKhoan?: string | null;
    trangThai?: boolean;
    chuyenMonId?: number | null;
    tenChuyenMon?: string | null;
    anhBia?: string | null;
    quyenId?: number | null;
    tenQuyen?: string | null;
  };
};

// User type cho client (PascalCase để khớp với useAuth)
export type User = {
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
  TenTaiKhoan?: string;
  ThanhVienId?: number | null;
  LoaiTaiKhoan?: string;
  ChuyenMon?: string;
  ChuyenMonId?: number | null;
  AnhBia?: string | null;
  quyenId?: number | null;
  tenQuyen?: string | null;
};

export function useLogin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async (account: string, password: string): Promise<User> => {
    setLoading(true);
    setError(null);

    try {
      const res = await api.post<BackendAuthResponse>("/Auth/login", {
        tenTaiKhoan: account.trim(),
        password,
      });

      console.log("Login response:", res.data);

      // Map từ backend response sang client User type
      if (!res.data.success || !res.data.user) {
        throw new Error(res.data.message || "Đăng nhập thất bại");
      }

      const backendUser = res.data.user;

      const normalizedLoaiTaiKhoan =
        backendUser.loaiTaiKhoan === null
          ? undefined
          : backendUser.loaiTaiKhoan;

      const user: User = {
        UserId: backendUser.taiKhoanId,
        Mail: backendUser.email,
        PassHash: "", // Không lưu password hash ở client
        HoTen: backendUser.hoTen,
        GioiTinh: backendUser.gioiTinh || "",
        NgaySinh: backendUser.ngaySinh || "",
        MoTaBanThan: backendUser.moTaBanThan || "",
        SoDienThoai: backendUser.sdt || "",
        DiaChi: backendUser.diaChi || "",
        TrangThai: backendUser.trangThai ?? true,
        TenTaiKhoan:
          backendUser.tenTaiKhoan || backendUser.tenTaiKhoa || account.trim(),
        ThanhVienId: backendUser.thanhVienId ?? null,
        LoaiTaiKhoan: normalizedLoaiTaiKhoan,
        ChuyenMon: backendUser.tenChuyenMon || "",
        ChuyenMonId: backendUser.chuyenMonId ?? null,
        AnhBia: backendUser.anhBia || null,
        quyenId: backendUser.quyenId ?? null,
        tenQuyen: backendUser.tenQuyen ?? null,
      };

      return user;
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data ||
        "Đăng nhập thất bại";
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { login, loading, error };
}
