import { useState, useRef } from "react";
import api from "../../../apis/api";
import { toast } from "react-toastify";

type ResendOtpPurpose = "register" | "forgot-password";

type ResendOtpResponse = {
  message: string;
  success: boolean;
};

export function useResendOtp(maxResend = 3, cooldownSeconds = 60) {
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const resendCountRef = useRef(0);

  // <-- Chỉ định kiểu number | null cho browser
  const intervalRef = useRef<number | null>(null);

  const resendOtp = async (email: string, purpose: ResendOtpPurpose = "register") => {
    if (!email) {
      toast.error("Không tìm thấy email để gửi lại OTP.");
      return;
    }

    if (resendCountRef.current >= maxResend) {
      toast.error(`Bạn đã gửi quá ${maxResend} lần trong thời gian này`);
      return;
    }
    if (countdown > 0) return; // đang trong cooldown

    setLoading(true);

    try {
      const res = await api.post<ResendOtpResponse>(`/Auth/resend-otp`, {
        email,
        purpose,
      });

      resendCountRef.current += 1;

      setCountdown(cooldownSeconds);
      intervalRef.current = window.setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (intervalRef.current !== null) {
              clearInterval(intervalRef.current);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return res.data;
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gửi lại OTP thất bại");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    resendOtp,
    loading,
    countdown,
    remainingResend: maxResend - resendCountRef.current,
  };
}
