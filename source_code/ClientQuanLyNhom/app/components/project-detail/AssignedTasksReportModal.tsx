import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./AssignedTasksReportModal.module.scss";
import { toast } from "react-toastify";
import api from "../../apis/api";

const PROGRESS_OPTIONS = Array.from({ length: 21 }, (_, idx) => `${idx * 5}%`);

interface AssignedTasksReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  congViecId: number;
  subTaskId: string;
  subTaskTitle?: string;
  thanhVienId: number;
  currentProgress?: string;
  currentReportContent?: string;
  onSubmitted: () => void;
}

const AssignedTasksReportModal: React.FC<AssignedTasksReportModalProps> = ({
  isOpen,
  onClose,
  congViecId,
  subTaskId,
  subTaskTitle,
  thanhVienId,
  currentProgress,
  currentReportContent,
  onSubmitted,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [reportContent, setReportContent] = useState("");
  const [progress, setProgress] = useState<string>(PROGRESS_OPTIONS[0]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Load previous progress
      if (currentProgress) {
        const normalized = currentProgress.trim();
        setProgress(
          normalized && PROGRESS_OPTIONS.includes(normalized)
            ? normalized
            : PROGRESS_OPTIONS[0]
        );
      }

      // Load previous report content
      if (currentReportContent) {
        setReportContent(currentReportContent);
      }
    }
  }, [isOpen, currentProgress, currentReportContent]);

  if (!isOpen) return null;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) {
      setSelectedFiles([]);
      return;
    }
    const fileArray = Array.from(files);
    console.log(
      "Files selected:",
      fileArray.map((f) => ({ name: f.name, type: f.type, size: f.size }))
    );

    // Cảnh báo nếu có file rỗng
    const emptyFiles = fileArray.filter((f) => f.size === 0);
    if (emptyFiles.length > 0) {
      toast.warning(
        `Phát hiện ${emptyFiles.length} file rỗng (0 bytes): ${emptyFiles.map((f) => f.name).join(", ")}. ` +
          `File rỗng sẽ không được upload.`
      );
    }

    setSelectedFiles(fileArray);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!reportContent.trim() && selectedFiles.length === 0) {
      toast.error("Vui lòng nhập nội dung hoặc đính kèm ít nhất một tệp.");
      return;
    }

    const formData = new FormData();
    formData.append("CongViecId", congViecId.toString());
    formData.append("ThanhVienId", thanhVienId.toString());
    formData.append("SubTaskId", subTaskId);
    formData.append("NoiDung", reportContent.trim());

    console.log("Selected files before append:", selectedFiles);

    // Lọc bỏ file rỗng trước khi upload
    const validFiles = selectedFiles.filter((f) => f.size > 0);
    const emptyFiles = selectedFiles.filter((f) => f.size === 0);

    if (emptyFiles.length > 0) {
      console.warn(
        "Skipping empty files:",
        emptyFiles.map((f) => f.name)
      );
    }

    validFiles.forEach((file, index) => {
      console.log(`Appending file ${index}:`, file.name, file.type, file.size);
      formData.append("Files", file);
    });

    // Log FormData contents
    console.log("FormData entries:");
    for (let pair of formData.entries()) {
      if (pair[1] instanceof File) {
        console.log(
          pair[0],
          "=>",
          (pair[1] as File).name,
          (pair[1] as File).type
        );
      } else {
        console.log(pair[0], "=>", pair[1]);
      }
    }

    try {
      setSubmitting(true);

      // Update progress first
      await api.put("/PhanCong/CapNhatTienDoHoanThanh", {
        congViecId: congViecId,
        thanhVienId: thanhVienId,
        subTaskId: subTaskId,
        tienDoHoanThanh: progress,
      });

      // Sync overall task progress
      try {
        await api.put(`/CongViec/CapNhatTienDoCongViec/${congViecId}`);
      } catch (syncErr) {
        console.warn("Không thể đồng bộ tiến độ công việc:", syncErr);
      }

      // Submit report
      await api.post("/PhanCong/BaoCaoTienDoUpload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      // Add submission date
      try {
        await api.put("/PhanCong/ThemNgayNop", {
          congViecId: congViecId,
          thanhVienId: thanhVienId,
          ngayNop: new Date().toISOString(),
        });
      } catch (dateErr) {
        console.warn("Không thể thêm ngày nộp:", dateErr);
      }

      toast.success("Báo cáo tiến độ và cập nhật tiến độ thành công.");
      onSubmitted();
      setSelectedFiles([]);
      setReportContent("");
      setProgress(PROGRESS_OPTIONS[0]);
      onClose();
    } catch (error: any) {
      console.error("Report progress error:", error);
      toast.error(
        error?.response?.data?.message ||
          "Không thể gửi báo cáo tiến độ. Vui lòng thử lại."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setSelectedFiles([]);
    setReportContent("");
    setProgress(PROGRESS_OPTIONS[0]);
    onClose();
  };

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  };

  return createPortal(
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      onClick={handleOverlayClick}
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3>Báo cáo tiến độ</h3>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={handleClose}
            disabled={submitting}
            aria-label="Đóng"
          >
            ×
          </button>
        </div>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.summary}>
            <div>
              <span className={styles.label}>Subtask:</span>
              <span className={styles.value}>
                {subTaskTitle || "Chưa có tiêu đề"}
              </span>
            </div>
          </div>

          <div className={styles.progressGroup}>
            <label htmlFor="progressSelect">Tiến độ hoàn thành</label>
            <select
              id="progressSelect"
              value={progress}
              onChange={(e) => setProgress(e.target.value)}
              disabled={submitting}
              className={styles.progressSelect}
            >
              {PROGRESS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.textGroup}>
            <label htmlFor="reportContent">Nội dung báo cáo</label>
            <textarea
              id="reportContent"
              value={reportContent}
              onChange={(event) => setReportContent(event.target.value)}
              placeholder="Nhập mô tả kết quả, tiến độ, khó khăn..."
              rows={5}
              disabled={submitting}
            />
          </div>

          <div className={styles.uploadGroup}>
            <label htmlFor="reportFiles" className={styles.fileLabel}>
              Chọn tệp báo cáo (có thể chọn nhiều tệp)
            </label>
            <input
              id="reportFiles"
              type="file"
              multiple
              onChange={handleFileChange}
              disabled={submitting}
            />
            {selectedFiles.length > 0 && (
              <ul className={styles.fileList}>
                {selectedFiles.map((file, idx) => (
                  <li key={idx}>{file.name}</li>
                ))}
              </ul>
            )}
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              onClick={handleClose}
              className={styles.cancelBtn}
              disabled={submitting}
            >
              Hủy
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={submitting}
            >
              {submitting ? "Đang gửi..." : "Gửi báo cáo"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default AssignedTasksReportModal;
