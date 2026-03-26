import React, { useState, useRef, useEffect } from "react";
import { toast } from "react-toastify";
import { useAuth } from "../../hooks/useAuth";
import styles from "./OtpInput.module.scss";
import { useVerifyOtp } from "../../hooks/useVerifyOtp";
import { useResendOtp } from "../../hooks/useResendOtp";

interface OtpInputProps {
  email: string;
  length?: number;
  purpose?: string;
  onSuccess?: () => void;
}

const OtpInput: React.FC<OtpInputProps> = ({
  email,
  length = 6,
  purpose = "register",
  onSuccess,
}) => {
  const [values, setValues] = useState<string[]>(Array(length).fill(""));
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const { verifyOtp, loading: verifying } = useVerifyOtp();
  const { resendOtp, loading: resending, countdown } = useResendOtp();
  const { login } = useAuth();

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newValues = [...values];
    newValues[index] = value;
    setValues(newValues);

    if (value && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !values[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  // **Tự động verify khi đủ số ký tự**
  useEffect(() => {
    const otp = values.join("");
    if (otp.length === length) {
      const verify = async () => {
        try {
          const res = await verifyOtp(email, otp, purpose);
          console.log("OTP verification result:", res);

          if (res.success) {
            toast.success("Xác thực OTP thành công!");
            // Backend trả về user sau khi verify OTP thành công (cho register)
            if (res.user) {
              const newUser = {
                UserId: res.user.nguoiDungId,
                Mail: res.user.email,
                PassHash: "",
                HoTen: res.user.hoTen,
                GioiTinh: res.user.gioiTinh || "",
                NgaySinh: res.user.ngaySinh || "",
                MoTaBanThan: res.user.moTaBanThan || "",
                SoDienThoai: res.user.sdt || "",
                DiaChi: res.user.diaChi || "",
                TrangThai: res.user.trangThai,
              };
              console.log("New user after OTP:", newUser);
              // Cập nhật context và localStorage
              login(newUser, true);
            }
            // Gọi callback success nếu có
            onSuccess?.();
          } else {
            toast.error("OTP không hợp lệ!");
          }
        } catch (err: any) {
          console.log("OTP verification error:", err);
        }
      };
      verify();
    }
  }, [values.join("")]); // chạy khi `values` thay đổi

  const handleResend = async () => {
    try {
      await resendOtp(email, purpose as "register" | "forgot-password");
      toast.success("OTP đã được gửi lại!");
    } catch (err: any) {}
  };

  return (
    <div className={styles.otpWrapper}>
      <h3 className={styles.title}>Nhập mã OTP</h3>
      <div className={styles.otpContainer}>
        {Array.from({ length }).map((_, idx) => (
          <input
            key={idx}
            type="text"
            maxLength={1}
            value={values[idx]}
            onChange={(e) => handleChange(idx, e.target.value)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            ref={(el) => {
              inputsRef.current[idx] = el;
            }}
            className={styles.otpInput}
          />
        ))}
      </div>

      <button
        className={styles.resendButton}
        onClick={handleResend}
        disabled={resending || countdown > 0}
      >
        {countdown > 0 ? `Gửi lại sau ${countdown}s` : "Gửi lại mã OTP"}
      </button>
    </div>
  );
};

export default OtpInput;
