import React, { useState } from "react";
import ForgotPassword from "./ForgotPassword";
import ResetPassword from "./ResetPassword";
import Modal from "../../shared/pop-up/Modal";
import OtpInput from "../shared/otp-input/OtpInput";
import { useVerifyOtp } from "../hooks/useVerifyOtp";
import { toast } from "react-toastify";
import styles from "./ForgotPasswordFlow.module.scss";

interface Props {
  onBack: () => void;
  onSuccess: () => void;
}

type Step = "email" | "otp" | "reset";

const ForgotPasswordFlow: React.FC<Props> = ({ onBack, onSuccess }) => {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(true);
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const { verifyOtp } = useVerifyOtp();

  const handleEmailSubmit = (submittedEmail: string) => {
    setEmail(submittedEmail);
    setIsEmailModalOpen(false);
    setIsOtpModalOpen(true);
  };

  const handleOtpSuccess = () => {
    setIsOtpModalOpen(false);
    setIsResetModalOpen(true);
  };

  const handleResetSuccess = () => {
    setIsResetModalOpen(false);
    toast.success(
      "Đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay bây giờ."
    );
    onSuccess();
  };

  const handleOtpVerify = async (otp: string) => {
    try {
      const result = await verifyOtp(email, otp, "forgot-password");
      if (result.success) {
        handleOtpSuccess();
      }
    } catch (error) {
      // Error đã được handle trong hook
    }
  };

  return (
    <>
      {isEmailModalOpen && (
        <Modal
          isOpen={isEmailModalOpen}
          onClose={() => {
            setIsEmailModalOpen(false);
            onBack();
          }}
          children={
            <ForgotPassword
              onBack={() => {
                setIsEmailModalOpen(false);
                onBack();
              }}
              onNext={handleEmailSubmit}
            />
          }
        />
      )}

      {isOtpModalOpen && (
        <Modal
          isOpen={isOtpModalOpen}
          onClose={() => {
            setIsOtpModalOpen(false);
            setIsEmailModalOpen(true);
          }}
          children={
            <OtpInput
              email={email}
              length={6}
              purpose="forgot-password"
              onSuccess={handleOtpSuccess}
            />
          }
        />
      )}

      {isResetModalOpen && (
        <Modal
          isOpen={isResetModalOpen}
          onClose={() => {
            setIsResetModalOpen(false);
            setIsEmailModalOpen(true);
          }}
          children={
            <ResetPassword
              email={email}
              onBack={() => {
                setIsResetModalOpen(false);
                setIsEmailModalOpen(true);
              }}
              onSuccess={handleResetSuccess}
            />
          }
        />
      )}
    </>
  );
};

export default ForgotPasswordFlow;
