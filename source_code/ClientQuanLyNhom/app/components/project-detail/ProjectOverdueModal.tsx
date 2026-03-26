import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import api from "../../apis/api";
import styles from "./ProjectOverdueModal.module.scss";

interface DuAnQuaHan {
  duAnId: number;
  tenDuAn: string;
  moTa?: string;
  ngayBatDau?: string;
  ngayKetThuc?: string;
  trangThai?: string;
  anhBia?: string;
  tenLinhVuc?: string;
  tienDo: number;
  tongCongViec: number;
  congViecHoanThanh: number;
  soNgayQuaHan: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  nhomId: number;
}

export default function ProjectOverdueModal({
  isOpen,
  onClose,
  nhomId,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [duAns, setDuAns] = useState<DuAnQuaHan[]>([]);

  useEffect(() => {
    if (isOpen && nhomId) {
      fetchDuAnQuaHan();
    }
  }, [isOpen, nhomId]);

  const fetchDuAnQuaHan = async () => {
    try {
      setLoading(true);
      console.log(`Fetching overdue projects for nhomId=${nhomId}`);

      const response = await api.get(`/DuAn/GetDuAnQuaHan/${nhomId}`);
      console.log("Response from GetDuAnQuaHan:", response.data);

      setDuAns(response.data || []);
    } catch (error: any) {
      console.error("Error fetching overdue projects:", error);
      toast.error(
        error.response?.data?.message || "Lỗi khi tải danh sách dự án quá hạn"
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h2>⚠️ Dự Án Quá Hạn</h2>
            <p className={styles.description}>
              Các dự án đã vượt quá deadline và cần xử lý ngay
            </p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.content}>
          {loading ? (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <p>Đang tải...</p>
            </div>
          ) : duAns.length === 0 ? (
            <div className={styles.empty}>
              <p>🎉 Không có dự án nào quá hạn</p>
            </div>
          ) : (
            <div className={styles.projectList}>
              {duAns.map((da) => (
                <div key={da.duAnId} className={styles.projectCard}>
                  <div className={styles.cardHeader}>
                    <div className={styles.projectInfo}>
                      {da.anhBia && (
                        <img
                          src={`${import.meta.env.VITE_API_URL}${da.anhBia}`}
                          alt={da.tenDuAn}
                          className={styles.projectImage}
                        />
                      )}
                      <div className={styles.projectDetails}>
                        <h3>{da.tenDuAn}</h3>
                        {da.tenLinhVuc && (
                          <span className={styles.category}>
                            📁 {da.tenLinhVuc}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={styles.overdueTag}>
                      Quá hạn {da.soNgayQuaHan} ngày
                    </span>
                  </div>

                  {da.moTa && <p className={styles.description}>{da.moTa}</p>}

                  <div className={styles.stats}>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>Tiến độ:</span>
                      <div className={styles.progressWrapper}>
                        <div className={styles.progressBar}>
                          <div
                            className={styles.progressFill}
                            style={{
                              width: `${da.tienDo}%`,
                              background:
                                da.tienDo >= 80
                                  ? "#10b981"
                                  : da.tienDo >= 50
                                    ? "#f59e0b"
                                    : "#ef4444",
                            }}
                          />
                        </div>
                        <span className={styles.statValue}>{da.tienDo}%</span>
                      </div>
                    </div>

                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>Công việc:</span>
                      <span className={styles.statValue}>
                        {da.congViecHoanThanh}/{da.tongCongViec} hoàn thành
                      </span>
                    </div>

                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>Deadline:</span>
                      <span className={styles.statValue}>
                        {da.ngayKetThuc
                          ? new Date(da.ngayKetThuc).toLocaleDateString("vi-VN")
                          : "Chưa có"}
                      </span>
                    </div>
                  </div>

                  {da.trangThai && (
                    <div className={styles.statusBadge}>
                      Trạng thái: {da.trangThai}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <div className={styles.summary}>
            Tổng: <strong>{duAns.length}</strong> dự án quá hạn
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
