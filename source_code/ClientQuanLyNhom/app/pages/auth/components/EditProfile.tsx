import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../hooks/useAuth";
import { updateUserProfile } from "../apis/userApi";
import { getChuyenMonList, type ChuyenMon } from "../apis/chuyenMonApi";
import { toast } from "react-toastify";
import { FaEdit, FaSave, FaTimes } from "react-icons/fa";
import styles from "./TextBox.module.scss";
import ChangeEmailModal from "../shared/change-email/ChangeEmailModal";

interface Props {
  onSuccess?: () => void; // Callback khi save thành công
}

interface FormState {
  HoTen: string;
  GioiTinh: string;
  NgaySinh: string;
  MoTaBanThan: string;
  SoDienThoai: string;
  DiaChi: string;
  ChuyenMonId: string;
}

const EditProfile: React.FC<Props> = ({ onSuccess }) => {
  const { user, login } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const [chuyenMonList, setChuyenMonList] = useState<ChuyenMon[]>([]);
  const [anhBiaFile, setAnhBiaFile] = useState<File | null>(null);
  const [anhBiaPreview, setAnhBiaPreview] = useState<string | null>(null);
  const [changeEmailOpen, setChangeEmailOpen] = useState(false);

  const currentAnhBia = useMemo(() => {
    if (anhBiaFile && anhBiaPreview) {
      return anhBiaPreview;
    }
    if (user?.AnhBia) {
      if (user.AnhBia.startsWith("http")) {
        return user.AnhBia;
      }
      return `${import.meta.env.VITE_API_URL || "https://localhost:7036"}${user.AnhBia}`;
    }
    return null;
  }, [anhBiaFile, anhBiaPreview, user?.AnhBia]);

  // Fetch chuyên môn list when component mounts
  useEffect(() => {
    const fetchChuyenMon = async () => {
      const data = await getChuyenMonList();
      setChuyenMonList(data);
    };
    fetchChuyenMon();
  }, []);

  // Form state - sẽ được cập nhật khi bấm "Chỉnh sửa"
  const [formData, setFormData] = useState<FormState>({
    HoTen: "",
    GioiTinh: "",
    NgaySinh: "",
    MoTaBanThan: "",
    SoDienThoai: "",
    DiaChi: "",
    ChuyenMonId: "",
  });

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Xóa error khi user bắt đầu nhập
    if (errors[name]) {
      setErrors((prev: any) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  // Validation function
  const validateForm = () => {
    const newErrors: any = {};

    if (!formData.HoTen.trim()) {
      newErrors.HoTen = "Họ tên không được để trống";
    } else if (formData.HoTen.trim().length < 2) {
      newErrors.HoTen = "Họ tên phải có ít nhất 2 ký tự";
    }

    if (!formData.GioiTinh) {
      newErrors.GioiTinh = "Vui lòng chọn giới tính";
    }

    if (!formData.NgaySinh) {
      newErrors.NgaySinh = "Vui lòng chọn ngày sinh";
    } else {
      const today = new Date();
      const birthDate = new Date(formData.NgaySinh);
      const age = today.getFullYear() - birthDate.getFullYear();

      if (birthDate > today) {
        newErrors.NgaySinh = "Ngày sinh không thể là tương lai";
      } else if (age < 13) {
        newErrors.NgaySinh = "Tuổi phải từ 13 trở lên";
      } else if (age > 120) {
        newErrors.NgaySinh = "Ngày sinh không hợp lệ";
      }
    }

    if (formData.SoDienThoai && !/^[0-9]{9,11}$/.test(formData.SoDienThoai)) {
      newErrors.SoDienThoai = "Số điện thoại phải có 9-11 chữ số";
    }

    if (formData.MoTaBanThan && formData.MoTaBanThan.length > 500) {
      newErrors.MoTaBanThan = "Mô tả bản thân không được quá 500 ký tự";
    }

    if (formData.ChuyenMonId && Number.isNaN(Number(formData.ChuyenMonId))) {
      newErrors.ChuyenMonId = "Chuyên môn không hợp lệ";
    }

    return newErrors;
  };

  // Hàm bắt đầu chỉnh sửa - load dữ liệu hiện tại
  const startEditing = () => {
    console.log("Starting editing with UserId:", user?.UserId);
    setFormData({
      HoTen: user?.HoTen || "",
      GioiTinh: user?.GioiTinh || "",
      NgaySinh: user?.NgaySinh || "",
      MoTaBanThan: user?.MoTaBanThan || "",
      SoDienThoai: user?.SoDienThoai || "",
      DiaChi: user?.DiaChi || "",
      ChuyenMonId: user?.ChuyenMonId ? String(user.ChuyenMonId) : "",
    });
    setErrors({});
    setAnhBiaFile(null);
    setAnhBiaPreview(null);
    setIsEditing(true);
  };

  const handleSave = async () => {
    const targetNguoiDungId = user?.ThanhVienId ?? user?.UserId;

    if (!user || !targetNguoiDungId) {
      toast.error("Không tìm thấy thông tin người dùng!");
      return;
    }

    // Validate form trước khi save
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast.error("Vui lòng kiểm tra lại thông tin!");
      return;
    }

    setLoading(true);
    try {
      console.log("Saving profile with nguoiDungId:", targetNguoiDungId);
      const response = await updateUserProfile(
        targetNguoiDungId,
        {
          HoTen: formData.HoTen,
          GioiTinh: formData.GioiTinh,
          NgaySinh: formData.NgaySinh,
          MoTaBanThan: formData.MoTaBanThan,
          SoDienThoai: formData.SoDienThoai,
          DiaChi: formData.DiaChi,
          ChuyenMonId: formData.ChuyenMonId,
        },
        anhBiaFile
      );
      console.log("Update profile response:", response);
      if (response.success && response.user) {
        const updatedUser: Parameters<typeof login>[0] = {
          ...user,
          UserId: user.UserId,
          HoTen: response.user.hoTen,
          GioiTinh: response.user.gioiTinh || "",
          NgaySinh: response.user.ngaySinh || "",
          MoTaBanThan: response.user.moTaBanThan || "",
          SoDienThoai: response.user.sdt || "",
          DiaChi: response.user.diaChi || "",
          ChuyenMon: response.user.tenChuyenMon || "",
          ChuyenMonId: response.user.chuyenMonId ?? null,
          ThanhVienId: response.user.thanhVienId ?? user?.ThanhVienId ?? null,
          AnhBia: response.user.anhBia || null,
        };

        login(updatedUser, true);
        setIsEditing(false);
        setErrors({});
        setAnhBiaFile(null);
        setAnhBiaPreview(null);
        toast.success("Cập nhật thông tin thành công!");
        onSuccess?.(); // Gọi callback nếu có
      } else {
        toast.error("Cập nhật thông tin thất bại!");
      }
    } catch (error) {
      console.error("Update profile error:", error);
      toast.error("Có lỗi xảy ra khi cập nhật thông tin!");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // Reset form về dữ liệu gốc
    setFormData({
      HoTen: user?.HoTen || "",
      GioiTinh: user?.GioiTinh || "",
      NgaySinh: user?.NgaySinh || "",
      MoTaBanThan: user?.MoTaBanThan || "",
      SoDienThoai: user?.SoDienThoai || "",
      DiaChi: user?.DiaChi || "",
      ChuyenMonId: user?.ChuyenMonId ? String(user.ChuyenMonId) : "",
    });
    setAnhBiaFile(null);
    setAnhBiaPreview(null);
    setIsEditing(false);
  };

  if (!user) return null;

  return (
    <div className={styles.profileModal}>
      <div className={styles.modalHeader}>
        <h2>👤 Thông tin cá nhân</h2>
        {!isEditing && (
          <button onClick={startEditing} className={styles.editBtn}>
            <FaEdit /> Chỉnh sửa
          </button>
        )}
      </div>

      {isEditing ? (
        <div className={styles.formContainer}>
          <div className={styles.form}>
            <div
              className={`${styles.inputGroup} ${errors.HoTen ? styles.error : ""}`}
            >
              <input
                name="HoTen"
                placeholder="Họ tên *"
                value={formData.HoTen}
                onChange={handleInputChange}
              />
            </div>
            {errors.HoTen && (
              <div className={styles.errorMsg}>{errors.HoTen}</div>
            )}

            <div
              className={styles.inputGroup}
              style={{ backgroundColor: "#f5f5f5" }}
            >
              <input
                type="email"
                value={user.Mail}
                disabled
                style={{ cursor: "not-allowed", color: "#666" }}
                placeholder="Email (không thể thay đổi)"
              />
            </div>
            <div className={styles.helperRow}>
              <span className={styles.helperText}>
                Muốn đổi email? Nhấn nút bên dưới để nhận OTP xác nhận.
              </span>
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => setChangeEmailOpen(true)}
              >
                Đổi email
              </button>
            </div>

            <div
              className={`${styles.inputGroup} ${errors.GioiTinh ? styles.error : ""}`}
            >
              <select
                name="GioiTinh"
                value={formData.GioiTinh}
                onChange={handleInputChange}
              >
                <option value="">Chọn giới tính *</option>
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
                <option value="Khác">Khác</option>
              </select>
            </div>
            {errors.GioiTinh && (
              <div className={styles.errorMsg}>{errors.GioiTinh}</div>
            )}

            <div
              className={`${styles.inputGroup} ${errors.NgaySinh ? styles.error : ""}`}
              style={{ position: "relative" }}
            >
              <input
                type="date"
                name="NgaySinh"
                value={formData.NgaySinh}
                onChange={handleInputChange}
                min="1900-01-01"
                max={new Date().toISOString().split("T")[0]}
                style={{
                  colorScheme: "light",
                  fontSize: "0.95rem",
                }}
              />
              <label
                style={{
                  position: "absolute",
                  left: "8px",
                  top: "-8px",
                  fontSize: "0.8rem",
                  color: "#666",
                  backgroundColor: "#fafafa",
                  padding: "0 4px",
                }}
              >
                Ngày sinh *
              </label>
            </div>
            {errors.NgaySinh && (
              <div className={styles.errorMsg}>{errors.NgaySinh}</div>
            )}

            <div
              className={`${styles.inputGroup} ${errors.SoDienThoai ? styles.error : ""}`}
            >
              <input
                name="SoDienThoai"
                placeholder="Số điện thoại (9-11 chữ số)"
                value={formData.SoDienThoai}
                onChange={handleInputChange}
                type="tel"
              />
            </div>
            {errors.SoDienThoai && (
              <div className={styles.errorMsg}>{errors.SoDienThoai}</div>
            )}

            <div className={styles.inputGroup}>
              <input
                name="DiaChi"
                placeholder="Địa chỉ"
                value={formData.DiaChi}
                onChange={handleInputChange}
              />
            </div>

            <div className={styles.imageUploadGroup}>
              {(anhBiaFile || user?.AnhBia) && (
                <div className={styles.imagePreview}>
                  <span className={styles.previewLabel}>
                    {anhBiaFile
                      ? `Ảnh mới: ${anhBiaFile.name}`
                      : "Ảnh hiện tại"}
                  </span>
                  {currentAnhBia && (
                    <img src={currentAnhBia} alt="Ảnh bìa xem trước" />
                  )}
                </div>
              )}

              <label
                className={styles.uploadLabel}
                htmlFor="profile-cover-upload"
              >
                Ảnh bìa
              </label>
              <input
                id="profile-cover-upload"
                type="file"
                accept="image/*"
                className={styles.fileInput}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setAnhBiaFile(file);
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = () => {
                      setAnhBiaPreview(reader.result as string);
                    };
                    reader.readAsDataURL(file);
                  } else {
                    setAnhBiaPreview(null);
                  }
                }}
              />
            </div>

            <div
              className={`${styles.inputGroup} ${errors.MoTaBanThan ? styles.error : ""}`}
            >
              <textarea
                name="MoTaBanThan"
                placeholder="Mô tả bản thân (tối đa 500 ký tự)"
                value={formData.MoTaBanThan}
                onChange={handleInputChange}
                rows={4}
                style={{
                  resize: "vertical",
                  minHeight: "80px",
                  maxHeight: "150px",
                }}
                maxLength={500}
              />
              <small
                style={{
                  position: "absolute",
                  bottom: "4px",
                  right: "8px",
                  fontSize: "0.75rem",
                  color: "#888",
                }}
              >
                {formData.MoTaBanThan.length}/500
              </small>
            </div>
            {errors.MoTaBanThan && (
              <div className={styles.errorMsg}>{errors.MoTaBanThan}</div>
            )}
          </div>

          {/* Action buttons - always visible at bottom */}
          <div className={styles.actionButtons}>
            <button
              onClick={handleSave}
              disabled={loading}
              className={styles.primaryBtn}
            >
              <FaSave /> {loading ? "Đang lưu..." : "Lưu"}
            </button>

            <button
              onClick={handleCancel}
              disabled={loading}
              className={styles.secondaryBtn}
            >
              <FaTimes /> Hủy
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.profileInfo}>
          <div className={styles.infoItem}>
            <strong>Họ tên:</strong> {user.HoTen || "Chưa cập nhật"}
          </div>

          <div className={styles.infoItem}>
            <strong>Email:</strong> {user.Mail}
            <button
              type="button"
              className={styles.inlineLink}
              onClick={() => setChangeEmailOpen(true)}
              style={{ marginLeft: "8px" }}
            >
              Đổi email
            </button>
          </div>

          <div className={styles.infoItem}>
            <strong>Giới tính:</strong> {user.GioiTinh || "Chưa cập nhật"}
          </div>

          <div className={styles.infoItem}>
            <strong>Ngày sinh:</strong> {user.NgaySinh || "Chưa cập nhật"}
          </div>

          <div className={styles.infoItem}>
            <strong>Địa chỉ:</strong> {user.DiaChi || "Chưa cập nhật"}
          </div>

          <div className={styles.infoItem}>
            <strong>Số điện thoại:</strong>{" "}
            {user.SoDienThoai || "Chưa cập nhật"}
          </div>

          <div className={styles.infoItem}>
            <strong>Chuyên môn:</strong>{" "}
            {user.ChuyenMon ? user.ChuyenMon : "Chưa cập nhật"}
          </div>

          <div className={styles.infoItem}>
            <strong>Mô tả bản thân:</strong>
            <div className={styles.description}>
              {user.MoTaBanThan || "Chưa cập nhật"}
            </div>
          </div>
        </div>
      )}
      {changeEmailOpen && (
        <ChangeEmailModal
          isOpen={changeEmailOpen}
          onClose={() => setChangeEmailOpen(false)}
          currentEmail={user.Mail}
          accountId={user.UserId}
        />
      )}
    </div>
  );
};

export default EditProfile;
