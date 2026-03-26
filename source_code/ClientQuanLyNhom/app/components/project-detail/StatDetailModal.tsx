import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import api from "../../apis/api";
import styles from "./StatDetailModal.module.scss";

interface CongViec {
  congViecId: number;
  tenCongViec: string;
  trangThai: string;
  phamTramHoanThanh?: number;
  ngayBatDau?: string;
  ngayKetThuc?: string;
  tenDuAn?: string;
  duAnId?: number;
  soNgayConLai?: number;
  soNgayQuaHan?: number;
}

interface DuAn {
  duAnId: number;
  tenDuAn: string;
  tongCongViec?: number;
  hoanThanh?: number;
  dangThucHien?: number;
  tienDo?: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  nhomId: number;
  statType:
    | "dangThucHien"
    | "tongCongViec"
    | "congViecHoanThanh"
    | "congViecQuaHan"
    | "congViecKhanCap"
    | null;
  title: string;
}

export default function StatDetailModal({
  isOpen,
  onClose,
  nhomId,
  statType,
  title,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [duAns, setDuAns] = useState<DuAn[]>([]);
  const [selectedDuAnId, setSelectedDuAnId] = useState<number | null>(null);
  const [congViecs, setCongViecs] = useState<CongViec[]>([]);

  // Fetch danh sách dự án của nhóm
  useEffect(() => {
    if (isOpen && nhomId) {
      fetchDuAns();
    }
  }, [isOpen, nhomId]);

  // Fetch công việc khi chọn dự án
  useEffect(() => {
    if (selectedDuAnId && statType) {
      fetchCongViecs();
    }
  }, [selectedDuAnId, statType]);

  const fetchDuAns = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/DuAn/GetProjectsOfGroup/${nhomId}`);
      console.log("Response from GetProjectsOfGroup:", response.data);

      // API trả về projects (viết thường - đã sửa backend)
      const projectsList = response.data.projects || [];

      // Lọc bỏ các dự án tạm dừng
      const activeProjects = projectsList.filter(
        (p: any) => p.trangThai !== "Tạm dừng"
      );
      setDuAns(activeProjects);

      // Tự động chọn dự án đầu tiên
      if (activeProjects.length > 0) {
        setSelectedDuAnId(activeProjects[0].duAnId);
      }
    } catch (error: any) {
      console.error("Error fetching projects:", error);
      toast.error(
        error.response?.data?.message || "Lỗi khi tải danh sách dự án"
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchCongViecs = async () => {
    if (!selectedDuAnId || !statType) return;

    try {
      setLoading(true);
      console.log(
        `Fetching congviecs: duAnId=${selectedDuAnId}, statType=${statType}`
      );

      const response = await api.get(
        `/CongViec/GetCongViecsByStat/${selectedDuAnId}/${statType}`
      );
      console.log("Response from GetCongViecsByStat:", response.data);

      setCongViecs(response.data || []);
    } catch (error: any) {
      console.error("Error fetching congviecs:", error);
      toast.error(
        error.response?.data?.message || "Lỗi khi tải danh sách công việc"
      );
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (trangThai: string) => {
    switch (trangThai?.toLowerCase()) {
      case "hoàn thành":
        return "#10b981";
      case "đang thực hiện":
      case "đang làm":
        return "#3b82f6";
      case "chưa bắt đầu":
        return "#94a3b8";
      case "trễ hạn":
      case "quá hạn":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  const getStatDescription = () => {
    switch (statType) {
      case "dangThucHien":
        return "Dự án đang được thực hiện";
      case "tongCongViec":
        return "Tất cả công việc trong dự án";
      case "congViecHoanThanh":
        return "Công việc đã hoàn thành 100%";
      case "congViecQuaHan":
        return "Công việc đã quá hạn deadline";
      case "congViecKhanCap":
        return "Công việc cần xử lý gấp (còn <= 3 ngày)";
      default:
        return "";
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h2>{title}</h2>
            <p className={styles.description}>{getStatDescription()}</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.content}>
          {/* Chọn dự án */}
          <div className={styles.projectSelector}>
            <label>Chọn dự án:</label>
            <select
              value={selectedDuAnId || ""}
              onChange={(e) => setSelectedDuAnId(Number(e.target.value))}
              className={styles.select}
            >
              {duAns.map((duAn) => (
                <option key={duAn.duAnId} value={duAn.duAnId}>
                  {duAn.tenDuAn}
                </option>
              ))}
            </select>
          </div>

          {/* Danh sách công việc */}
          {loading ? (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <p>Đang tải...</p>
            </div>
          ) : congViecs.length === 0 ? (
            <div className={styles.empty}>
              <p>📋 Không có công việc nào</p>
            </div>
          ) : (
            <div className={styles.taskList}>
              {congViecs.map((cv) => (
                <div key={cv.congViecId} className={styles.taskCard}>
                  <div className={styles.taskHeader}>
                    <h4>{cv.tenCongViec}</h4>
                    <span
                      className={styles.statusBadge}
                      style={{ background: getStatusColor(cv.trangThai) }}
                    >
                      {cv.trangThai}
                    </span>
                  </div>

                  <div className={styles.taskInfo}>
                    {cv.phamTramHoanThanh !== undefined && (
                      <div className={styles.progress}>
                        <div className={styles.progressBar}>
                          <div
                            className={styles.progressFill}
                            style={{
                              width: `${cv.phamTramHoanThanh}%`,
                              background: getStatusColor(cv.trangThai),
                            }}
                          />
                        </div>
                        <span className={styles.progressText}>
                          {cv.phamTramHoanThanh}%
                        </span>
                      </div>
                    )}

                    <div className={styles.dates}>
                      {cv.ngayBatDau && (
                        <span>
                          🗓️ Bắt đầu:{" "}
                          {new Date(cv.ngayBatDau).toLocaleDateString("vi-VN")}
                        </span>
                      )}
                      {cv.ngayKetThuc && (
                        <span>
                          ⏰ Kết thúc:{" "}
                          {new Date(cv.ngayKetThuc).toLocaleDateString("vi-VN")}
                        </span>
                      )}
                    </div>

                    {cv.soNgayConLai !== undefined && cv.soNgayConLai >= 0 && (
                      <div className={styles.deadline}>
                        <span
                          className={
                            cv.soNgayConLai <= 3 ? styles.urgent : styles.normal
                          }
                        >
                          ⏳ Còn {cv.soNgayConLai} ngày
                        </span>
                      </div>
                    )}

                    {cv.soNgayQuaHan !== undefined && cv.soNgayQuaHan > 0 && (
                      <div className={styles.overdue}>
                        <span>⚠️ Quá hạn {cv.soNgayQuaHan} ngày</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <div className={styles.summary}>
            Tổng: <strong>{congViecs.length}</strong> công việc
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
