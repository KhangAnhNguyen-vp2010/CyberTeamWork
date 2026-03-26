// src/hooks/useVerifyOtp.ts
import { useState } from "react";
import api from "../../../apis/api";
import { toast } from "react-toastify";

type VerifyOtpResponse = {
  message: string;
  success: boolean;
  user?: {
    taiKhoanId: number;
    nguoiDungId: number;
    email: string;
    hoTen: string;
    gioiTinh?: string;
    ngaySinh?: string;
    moTaBanThan?: string;
    sdt?: string;
    diaChi?: string;
    trangThai: boolean;
  };
};

export function useVerifyOtp() {
  const [loading, setLoading] = useState(false);

  const verifyOtp = async (
    email: string,
    otp: string,
    purpose: string = "register"
  ) => {
    setLoading(true);

    try {
      const res = await api.post("/Auth/verify-otp", { email, otp, purpose });

      console.log("Verify OTP response:", res.data);

      // Nếu response là string (cũ), convert thành object
      if (typeof res.data === "string") {
        return { message: res.data, success: true };
      }

      return res.data;
    } catch (err: any) {
      console.log("Verify OTP error:", err);
      toast.error(err.response?.data || "Xác thực OTP thất bại");

      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { verifyOtp, loading };
}
