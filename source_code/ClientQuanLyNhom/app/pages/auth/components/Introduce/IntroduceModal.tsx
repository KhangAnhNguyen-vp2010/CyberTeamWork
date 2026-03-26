import React, { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "../../../shared/pop-up/Modal";
import styles from "./IntroduceModal.module.scss";
import slideOne from "./Introduce01.png";
import slideTwo from "./Introduce02.png";
import slideThree from "./Introduce03.png";
import CompleteProfile from "../CompleteProfile";
import { updateUserProfile } from "../../apis/userApi";
import { useAuth } from "../../hooks/useAuth";
import { toast } from "react-toastify";

type Slide = {
  title: string;
  description: string;
  image: string;
};

interface IntroduceModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  onProfileUpdated?: () => void;
}

const slides: Slide[] = [
  {
    title: "Kết nối đội nhóm",
    description: "Tạo và quản lý nhóm làm việc, mời đồng đội và theo dõi hoạt động một cách trực quan.",
    image: slideOne,
  },
  {
    title: "Theo dõi dự án",
    description: "Bám sát tiến độ, phân chia nhiệm vụ và cập nhật trạng thái mọi lúc mọi nơi.",
    image: slideTwo,
  },
  {
    title: "Bắt đầu hành trình",
    description: "Hoàn thiện hồ sơ cá nhân để đồng đội hiểu hơn về bạn và cùng nhau chinh phục mục tiêu!",
    image: slideThree,
  },
];

const IntroduceModal: React.FC<IntroduceModalProps> = ({ isOpen, onDismiss, onProfileUpdated }) => {
  const { user, login } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [canDismiss, setCanDismiss] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep(0);
      setCanDismiss(false);
    }
  }, [isOpen]);

  const introKey = useMemo(() => (user ? `intro_seen_${user.UserId}` : null), [user]);

  const markSeen = useCallback(() => {
    if (introKey) {
      localStorage.setItem(introKey, "true");
    }
  }, [introKey]);

  const closeModal = useCallback(
    (force: boolean = false) => {
      if (!force && (!canDismiss || saving)) {
        toast.info("Vui lòng hoàn thành thông tin trước khi đóng.");
        return;
      }
      markSeen();
      onDismiss();
    },
    [canDismiss, markSeen, onDismiss, saving]
  );

  if (!isOpen || !user) {
    return null;
  }

  const goNext = () => setStep((prev) => Math.min(prev + 1, slides.length - 1));
  const goPrev = () => setStep((prev) => Math.max(prev - 1, 0));

  const handleProfileSave = async (data: any) => {
    if (saving) return;

    const targetId = user.ThanhVienId ?? user.UserId;
    if (!targetId) {
      toast.error("Không tìm thấy thông tin người dùng.");
      return;
    }

    setSaving(true);
    try {
      const rememberMe = localStorage.getItem("rememberMe") === "true";
      const response = await updateUserProfile(targetId, data);

      if (response?.success && response.user) {
        const updatedUser = {
          ...user,
          HoTen: response.user.hoTen || "",
          GioiTinh: response.user.gioiTinh || "",
          NgaySinh: response.user.ngaySinh || "",
          MoTaBanThan: response.user.moTaBanThan || "",
          SoDienThoai: response.user.sdt || "",
          DiaChi: response.user.diaChi || "",
          ChuyenMon: response.user.tenChuyenMon || "",
          ChuyenMonId: response.user.chuyenMonId ?? null,
          ThanhVienId: response.user.thanhVienId ?? user.ThanhVienId ?? null,
          AnhBia: response.user.anhBia || user.AnhBia || null,
        };

        login(updatedUser, rememberMe);
        toast.success("Cập nhật hồ sơ thành công!");
        setCanDismiss(true);
        markSeen();
        onProfileUpdated?.();
        onDismiss();
        return;
      }

      toast.error("Không thể cập nhật hồ sơ. Vui lòng thử lại.");
    } catch (error) {
      console.error("Profile update error:", error);
      toast.error("Có lỗi xảy ra khi cập nhật thông tin.");
    } finally {
      setSaving(false);
    }
  };

  const renderContent = () => {
    if (step < slides.length - 1) {
      const slide = slides[step];
      return (
        <div className={styles.slide}>
          <img src={slide.image} alt={slide.title} className={styles.image} />
          <div className={styles.slideText}>
            <h2>{slide.title}</h2>
            <p>{slide.description}</p>
          </div>
        </div>
      );
    }

    return (
      <div className={styles.profileSlide}>
        <div className={styles.profileIntro}>
          <h2>Hoàn thiện thông tin của bạn</h2>
          <p>
            Chỉ vài bước nữa thôi! Điền thông tin cơ bản để đội nhóm dễ dàng kết nối và làm việc với bạn.
          </p>
        </div>
        <CompleteProfile user={user} onSave={handleProfileSave} isSubmitting={saving} />
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={() => closeModal(false)}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.stepIndicator}>
            {slides.map((_, index) => (
              <button
                key={index}
                className={index === step ? styles.activeDot : styles.dot}
                onClick={() => setStep(index)}
                aria-label={`Chuyển tới slide ${index + 1}`}
              />
            ))}
          </div>
        </div>

        <div className={styles.content}>{renderContent()}</div>

        {step < slides.length - 1 && (
          <div className={styles.controls}>
            <button onClick={goPrev} disabled={step === 0}>
              Trở lại
            </button>
            <button onClick={goNext}>
              Tiếp tục
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default IntroduceModal;
