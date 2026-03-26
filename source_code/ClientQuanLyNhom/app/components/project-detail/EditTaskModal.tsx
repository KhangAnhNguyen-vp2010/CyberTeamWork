import React, { useState, useEffect } from "react";
import styles from "./CreateTaskModal.module.scss";
import api from "../../apis/api";

interface KanbanTaskType {
  congViecId: number;
  tenCongViec: string;
  ngayBd: string;
  ngayKt: string;
  trangThai: string;
  phamTramHoanThanh: number;
  anhBia: string;
}

interface EditTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: KanbanTaskType | null;
  onSuccess: () => void;
  projectStartDate?: string;
  projectEndDate?: string;
}

const EditTaskModal: React.FC<EditTaskModalProps> = ({
  isOpen,
  onClose,
  task,
  onSuccess,
  projectStartDate,
  projectEndDate,
}) => {
  const [formData, setFormData] = useState({
    tenCongViec: "",
    ngayBd: "",
    ngayKt: "",
  });
  const [imagePreview, setImagePreview] = useState<string>("");
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Helper function to get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Check if start date is in the past
  const isStartDateInPast = () => {
    if (!task?.ngayBd) return false;
    return task.ngayBd < getTodayDate();
  };

  useEffect(() => {
    if (task) {
      setFormData({
        tenCongViec: task.tenCongViec,
        ngayBd: task.ngayBd,
        ngayKt: task.ngayKt,
      });
      setImagePreview(
        task.anhBia ? `https://localhost:7036${task.anhBia}` : ""
      );
    }
  }, [task]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
    if (errors[name]) {
      setErrors({ ...errors, [name]: "" });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.tenCongViec.trim())
      newErrors.tenCongViec = "Tên công việc là bắt buộc";
    if (!formData.ngayBd) newErrors.ngayBd = "Ngày bắt đầu là bắt buộc";
    if (!formData.ngayKt) newErrors.ngayKt = "Ngày kết thúc là bắt buộc";
    if (
      formData.ngayBd &&
      formData.ngayKt &&
      new Date(formData.ngayBd) > new Date(formData.ngayKt)
    ) {
      newErrors.ngayKt = "Ngày kết thúc phải sau ngày bắt đầu";
    }

    if (formData.ngayBd && projectStartDate) {
      const taskStart = new Date(formData.ngayBd);
      const projectStart = new Date(projectStartDate);
      if (taskStart < projectStart) {
        newErrors.ngayBd = `Ngày bắt đầu không được trước ${projectStartDate}`;
      }
    }

    if (formData.ngayKt && projectEndDate) {
      const taskEnd = new Date(formData.ngayKt);
      const projectEnd = new Date(projectEndDate);
      if (taskEnd > projectEnd) {
        newErrors.ngayKt = `Ngày kết thúc phải trước ${projectEndDate}`;
      }
    }

    if (
      formData.ngayBd &&
      formData.ngayKt &&
      projectStartDate &&
      projectEndDate
    ) {
      const taskStart = new Date(formData.ngayBd);
      const taskEnd = new Date(formData.ngayKt);
      const projectStart = new Date(projectStartDate);
      const projectEnd = new Date(projectEndDate);
      if (taskStart > projectEnd) {
        newErrors.ngayBd = `Ngày bắt đầu phải trước ${projectEndDate}`;
      }
      if (taskEnd < projectStart) {
        newErrors.ngayKt = `Ngày kết thúc phải sau ${projectStartDate}`;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !task) return;

    try {
      const formDataApi = new FormData();
      formDataApi.append("congViecId", task.congViecId.toString());
      formDataApi.append("tenCongViec", formData.tenCongViec);
      formDataApi.append("ngayBd", formData.ngayBd);
      formDataApi.append("ngayKt", formData.ngayKt);
      formDataApi.append("trangThai", task.trangThai);

      if (selectedFile) {
        formDataApi.append("anhBia", selectedFile);
      } else if (task.anhBia) {
        formDataApi.append("anhBia", task.anhBia);
      }

      await api.put("/CongViec/UpdateCongViec", formDataApi);
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <button className={styles.closeBtn} onClick={onClose}>
          ✖
        </button>
        <h2>Chỉnh Sửa Công Việc</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label>Tên Công Việc</label>
            <input
              type="text"
              name="tenCongViec"
              value={formData.tenCongViec}
              onChange={handleChange}
              className={errors.tenCongViec ? styles.error : ""}
            />
            {errors.tenCongViec && (
              <span className={styles.errorText}>{errors.tenCongViec}</span>
            )}
          </div>
          <div className={styles.field}>
            <label>Ngày Bắt Đầu</label>
            <input
              type="date"
              name="ngayBd"
              value={formData.ngayBd}
              onChange={handleChange}
              min={projectStartDate}
              max={projectEndDate}
              disabled={isStartDateInPast()}
              className={errors.ngayBd ? styles.error : ""}
            />
            {errors.ngayBd && (
              <span className={styles.errorText}>{errors.ngayBd}</span>
            )}
          </div>
          <div className={styles.field}>
            <label>Ngày Kết Thúc</label>
            <input
              type="date"
              name="ngayKt"
              value={formData.ngayKt}
              onChange={handleChange}
              min={projectStartDate}
              max={projectEndDate}
              className={errors.ngayKt ? styles.error : ""}
            />
            {errors.ngayKt && (
              <span className={styles.errorText}>{errors.ngayKt}</span>
            )}
          </div>
          <div className={styles.field}>
            <label>Ảnh Bìa (Tùy chọn)</label>
            <input type="file" accept="image/*" onChange={handleFileChange} />
            {imagePreview && (
              <div className={styles.imagePreview}>
                <img src={imagePreview} alt="Preview" />
              </div>
            )}
          </div>
          <div className={styles.actions}>
            <button type="button" onClick={onClose}>
              Hủy
            </button>
            <button type="submit">Cập Nhật</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTaskModal;
