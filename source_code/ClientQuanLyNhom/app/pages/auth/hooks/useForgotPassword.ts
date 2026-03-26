// src/hooks/useForgotPassword.ts
import { useState } from "react";
import api from "../../../apis/api";
import { toast } from "react-toastify";

type ForgotPasswordResponse = {
  message: string;
  success: boolean;
};

export function useForgotPassword() {
  const [loading, setLoading] = useState(false);

  const sendOtp = async (email: string) => {
    setLoading(true);

    try {
      const res = await api.post<ForgotPasswordResponse>(
        "/Auth/forgot-password",
        {
          email,
        }
      );

      console.log("Forgot password response:", res.data);
      toast.success("Mã OTP đã được gửi tới email của bạn!");

      return res.data;
    } catch (err: any) {
      const errorMessage = err.response?.data || "Gửi OTP thất bại";
      toast.error(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { sendOtp, loading };
}
