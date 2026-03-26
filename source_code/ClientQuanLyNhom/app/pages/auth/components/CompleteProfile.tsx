import React, { useEffect, useState } from "react";
import { FaCalendarAlt } from "react-icons/fa";
import clsx from "clsx";
import styles from "./TextBox.module.scss";
import { getChuyenMonList, type ChuyenMon } from "../apis/chuyenMonApi";

interface Props {
  user: any;
  onSave: (data: any) => void | Promise<void>;
  isSubmitting?: boolean;
}

const CompleteProfile: React.FC<Props> = ({
  user,
  onSave,
  isSubmitting = false,
}) => {
  const [hoTen, setHoTen] = useState(user?.HoTen || "");
  const [gioiTinh, setGioiTinh] = useState(user?.GioiTinh || "");
  const [ngaySinh, setNgaySinh] = useState(user?.NgaySinh || "");
  const [moTa, setMoTa] = useState(user?.MoTaBanThan || "");
  const [soDienThoai, setSoDienThoai] = useState(user?.SoDienThoai || "");
  const [diaChi, setDiaChi] = useState(user?.DiaChi || "");
  const [chuyenMonId, setChuyenMonId] = useState(
    user?.ChuyenMonId ? String(user.ChuyenMonId) : ""
  );
  const [chuyenMonList, setChuyenMonList] = useState<ChuyenMon[]>([]);
  const [expandForm, setExpandForm] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const [shake, setShake] = useState(false);

  useEffect(() => {
    let ignore = false;
    const fetchChuyenMon = async () => {
      try {
        const data = await getChuyenMonList();
        if (!ignore) {
          setChuyenMonList(data);
        }
      } catch (error) {
        console.error("Error fetching chuyên môn list:", error);
      }
    };

    fetchChuyenMon();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    setHoTen(user?.HoTen || "");
    setGioiTinh(user?.GioiTinh || "");
    setNgaySinh(user?.NgaySinh || "");
    setMoTa(user?.MoTaBanThan || "");
    setSoDienThoai(user?.SoDienThoai || "");
    setDiaChi(user?.DiaChi || "");
    setChuyenMonId(user?.ChuyenMonId ? String(user.ChuyenMonId) : "");
  }, [
    user?.HoTen,
    user?.GioiTinh,
    user?.NgaySinh,
    user?.MoTaBanThan,
    user?.SoDienThoai,
    user?.DiaChi,
    user?.ChuyenMonId,
  ]);

  // Clear errors khi user nhập
  const clearError = (field: string) => {
    if (errors[field]) {
      setErrors((prev: any) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  const validate = () => {
    const newErrors: any = {};

    // Họ tên validation
    if (!hoTen.trim()) {
      newErrors.hoTen = "Họ tên không được để trống";
    } else if (hoTen.trim().length < 2) {
      newErrors.hoTen = "Họ tên phải có ít nhất 2 ký tự";
    }

    // Giới tính validation
    if (!gioiTinh) {
      newErrors.gioiTinh = "Vui lòng chọn giới tính";
    }

    // Ngày sinh validation
    if (!ngaySinh) {
      newErrors.ngaySinh = "Vui lòng chọn ngày sinh";
    } else {
      const today = new Date();
      const birthDate = new Date(ngaySinh);
      const age = today.getFullYear() - birthDate.getFullYear();

      if (birthDate > today) {
        newErrors.ngaySinh = "Ngày sinh không thể là tương lai";
      } else if (age < 13) {
        newErrors.ngaySinh = "Tuổi phải từ 13 trở lên";
      } else if (age > 120) {
        newErrors.ngaySinh = "Ngày sinh không hợp lệ";
      }
    }

    // Số điện thoại validation (optional)
    if (soDienThoai && !/^[0-9]{9,11}$/.test(soDienThoai)) {
      newErrors.soDienThoai = "Số điện thoại phải có 9-11 chữ số";
    }

    // Chuyên môn validation
    if (!chuyenMonId) {
      newErrors.chuyenMonId = "Vui lòng chọn chuyên môn";
    }

    // Mô tả validation
    if (moTa.length > 500) {
      newErrors.moTa = "Mô tả bản thân không được quá 500 ký tự";
    }

    return newErrors;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors = validate();
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    onSave({
      HoTen: hoTen,
      GioiTinh: gioiTinh,
      NgaySinh: ngaySinh,
      MoTaBanThan: moTa,
      SoDienThoai: soDienThoai,
      DiaChi: diaChi,
      ChuyenMonId: chuyenMonId,
    });
  };

  return (
    <div
      className={clsx(
        styles.formContainer,
        expandForm && styles.expanded,
        shake && styles.shake
      )}
      style={{
        maxWidth: expandForm ? 600 : 420,
        margin: "2rem auto",
        transition: "max-width 0.4s cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      <h2 className={styles.title}>📝 Bổ sung thông tin cá nhân</h2>
      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          className={clsx(styles.inputGroup, errors.hoTen && styles.error)}
          placeholder="Họ tên *"
          value={hoTen}
          onChange={(e) => {
            setHoTen(e.target.value);
            clearError("hoTen");
          }}
        />
        {errors.hoTen && <div className={styles.errorMsg}>{errors.hoTen}</div>}

        <select
          className={clsx(styles.inputGroup, errors.gioiTinh && styles.error)}
          value={gioiTinh}
          onChange={(e) => {
            setGioiTinh(e.target.value);
            clearError("gioiTinh");
          }}
        >
          <option value="">Chọn giới tính *</option>
          <option value="Nam">Nam</option>
          <option value="Nữ">Nữ</option>
          <option value="Khác">Khác</option>
        </select>
        {errors.gioiTinh && (
          <div className={styles.errorMsg}>{errors.gioiTinh}</div>
        )}
        <div
          className={clsx(styles.inputGroup, errors.ngaySinh && styles.error)}
          style={{ position: "relative" }}
        >
          <FaCalendarAlt
            style={{
              position: "absolute",
              left: 12,
              top: 13,
              color: "#888",
              fontSize: 18,
            }}
          />
          <input
            type="date"
            value={ngaySinh}
            onChange={(e) => {
              setNgaySinh(e.target.value);
              clearError("ngaySinh");
            }}
            style={{
              paddingLeft: 36,
              width: "100%",
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: "0.95rem",
              color: "#222",
              colorScheme: "light",
            }}
            min="1900-01-01"
            max={new Date().toISOString().split("T")[0]}
          />
          <label
            style={{
              position: "absolute",
              left: "40px",
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
        {errors.ngaySinh && (
          <div className={styles.errorMsg}>{errors.ngaySinh}</div>
        )}
        <input
          className={clsx(
            styles.inputGroup,
            errors.soDienThoai && styles.error
          )}
          placeholder="Số điện thoại (9-11 chữ số)"
          value={soDienThoai}
          onChange={(e) => {
            setSoDienThoai(e.target.value);
            clearError("soDienThoai");
          }}
          type="tel"
        />
        {errors.soDienThoai && (
          <div className={styles.errorMsg}>{errors.soDienThoai}</div>
        )}

        <input
          className={styles.inputGroup}
          placeholder="Địa chỉ"
          value={diaChi}
          onChange={(e) => setDiaChi(e.target.value)}
        />
        <div
          className={clsx(styles.inputGroup, errors.moTa && styles.error)}
          style={{ position: "relative", minHeight: "80px" }}
        >
          <textarea
            placeholder="Mô tả bản thân (tối đa 500 ký tự)"
            value={moTa}
            onChange={(e) => {
              setMoTa(e.target.value);
              setExpandForm(e.target.value.length > 80);
              clearError("moTa");
            }}
            rows={4}
            style={{
              width: "100%",
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: "0.95rem",
              color: "#222",
              resize: "vertical",
              minHeight: "60px",
              maxHeight: "120px",
              fontFamily: "inherit",
              lineHeight: "1.4",
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
              backgroundColor: "#fafafa",
              padding: "0 2px",
            }}
          >
            {moTa.length}/500
          </small>
        </div>
        {errors.moTa && <div className={styles.errorMsg}>{errors.moTa}</div>}
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <button
            type="submit"
            className={styles.primaryBtn}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CompleteProfile;
