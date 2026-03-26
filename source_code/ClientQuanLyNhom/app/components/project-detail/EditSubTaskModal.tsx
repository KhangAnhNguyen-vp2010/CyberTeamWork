import React, { useState, useEffect } from "react";
import styles from "./KanbanTab.module.scss";

interface SubTaskResult {
  noiDung?: string;
  file?: string[];
}

interface SubTaskType {
  subTaskId?: string;
  MoTa: string;
  NgayPC: string;
  DoUuTien: string;
  ThanhVienDuocPhanCong: string;
  KetQuaThucHien?: SubTaskResult | null;
  DanhGia: string;
  TienDoHoanThanh: string;
}

interface EditSubTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  subtask: SubTaskType | null;
  congViecId: number;
  thanhVienId: number;
  ngayBd: string;
  ngayKt: string;
  onSuccess: () => void;
}

const EditSubTaskModal: React.FC<EditSubTaskModalProps> = ({
  isOpen,
  onClose,
  subtask,
  congViecId,
  thanhVienId,
  ngayBd,
  ngayKt,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    moTa: "",
    ngayPC: "",
    doUuTien: "cao",
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatDateForDisplay = (value: string) => {
    if (!value) return "";
    try {
      return new Date(`${value}T00:00:00`).toLocaleDateString("vi-VN");
    } catch (error) {
      return value;
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    // Always use today's date for assignment date
    const today = new Date();

    setFormData({
      moTa: subtask?.MoTa || "",
      ngayPC: formatDateForInput(today),
      doUuTien: subtask?.DoUuTien || "cao",
    });
    setErrors({});
  }, [isOpen, subtask, ngayBd, ngayKt]);

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.moTa.trim()) {
      newErrors.moTa = "Mô tả không được để trống";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subtask?.subTaskId || !validateForm()) return;

    try {
      const response = await fetch(
        `https://localhost:7036/api/PhanCong/UpdatePhanCongItem/${congViecId}/${thanhVienId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            subTaskId: subtask.subTaskId,
            moTa: formData.moTa,
            ngayPC: formData.ngayPC,
            doUuTien: formData.doUuTien,
          }),
        }
      );

      if (response.ok) {
        onSuccess();
        onClose();
      } else {
        console.error("Error updating subtask:", response.statusText);
      }
    } catch (error) {
      console.error("Error updating subtask:", error);
    }
  };

  if (!isOpen) return null;

  const assignmentDateDisplay = formatDateForDisplay(formData.ngayPC);

  return (
    <div className={styles.taskDetailModal}>
      <div className={styles.taskDetailContent}>
        <button className={styles.closeBtn} onClick={onClose}>
          ✖
        </button>

        <div className={styles.modalHeader}>
          <h2>Chỉnh sửa công việc con</h2>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "24px" }}>
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: "500",
              }}
            >
              Mô tả:
            </label>
            <textarea
              value={formData.moTa}
              onChange={(e) =>
                setFormData({ ...formData, moTa: e.target.value })
              }
              style={{
                width: "100%",
                padding: "12px",
                border: errors.moTa ? "1px solid #dc2626" : "1px solid #e2e8f0",
                borderRadius: "8px",
                resize: "vertical",
                minHeight: "80px",
              }}
              required
            />
            {errors.moTa && (
              <div
                style={{ color: "#dc2626", fontSize: "14px", marginTop: "4px" }}
              >
                {errors.moTa}
              </div>
            )}
          </div>

          <div className={styles.field}>
            <label>Ngày Phân Công</label>
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                color: "#1f2937",
                fontSize: "0.9rem",
              }}
            >
              {assignmentDateDisplay || "—"}
            </div>
            <small style={{ color: "#64748b" }}>
              Ngày phân công tự động lấy theo ngày hiện tại.
            </small>
            {errors.ngayPC && (
              <div
                style={{ color: "#dc2626", fontSize: "14px", marginTop: "4px" }}
              >
                {errors.ngayPC}
              </div>
            )}
            <div
              style={{ color: "#64748b", fontSize: "12px", marginTop: "4px" }}
            >
              Khoảng thời gian: {ngayBd} - {ngayKt}
            </div>
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: "500",
              }}
            >
              Độ ưu tiên:
            </label>
            <select
              value={formData.doUuTien}
              onChange={(e) =>
                setFormData({ ...formData, doUuTien: e.target.value })
              }
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
              }}
            >
              <option value="cao">Cao</option>
              <option value="trungbinh">Trung bình</option>
              <option value="thap">Thấp</option>
            </select>
          </div>

          <div
            style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 20px",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                background: "white",
                cursor: "pointer",
              }}
            >
              Hủy
            </button>
            <button
              type="submit"
              style={{
                padding: "10px 20px",
                border: "none",
                borderRadius: "8px",
                background: "#4f46e5",
                color: "white",
                cursor: "pointer",
              }}
            >
              Cập nhật
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditSubTaskModal;
