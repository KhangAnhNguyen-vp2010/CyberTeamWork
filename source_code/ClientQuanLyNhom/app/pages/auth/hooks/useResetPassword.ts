// src/hooks/useResetPassword.ts
import { useState } from "react";
import api from "../../../apis/api";
import { toast } from "react-toastify";

type ResetPasswordResponse = {
  message: string;
  success: boolean;
};

export function useResetPassword() {
  const [loading, setLoading] = useState(false);

  const resetPassword = async (email: string, newPassword: string) => {
    setLoading(true);

    try {
      const res = await api.post<ResetPasswordResponse>(
        "/Auth/reset-password",
        {
          email,
          newPassword,
        }
      );

      console.log("Reset password response:", res.data);
      return res.data;
    } catch (err: any) {
      const errorMessage = err.response?.data || "Đặt lại mật khẩu thất bại";
      toast.error(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { resetPassword, loading };
}
