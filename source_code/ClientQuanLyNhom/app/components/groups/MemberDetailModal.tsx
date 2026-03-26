import { useState, useEffect } from "react";
import Modal from "../../pages/shared/pop-up/Modal";
import api from "../../apis/api";
import { toast } from "react-toastify";
import styles from "./MemberDetailModal.module.scss";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  memberId: number;
}

interface ProjectDetail {
  duAnId: number;
  tenDuAn: string;
  moTa?: string;
  ngayBatDau: string;
  ngayKetThuc: string;
  trangThai: string;
  linhVuc?: string;
}

interface GroupDetail {
  nhomId: number;
  tenNhom: string;
  moTa?: string;
  duAnThuocNhom?: ProjectDetail[];
}

interface MemberDetailData {
  thanhVienId: number;
  hoTen: string;
  email: string;
  chuyenMon?: string;
  soDienThoai?: string;
  diaChi?: string;
  ngayThamGia?: string;
  quyenId?: number;
  tenQuyen?: string;
  danhSachNhom?: GroupDetail[];
  tongSoDuAn?: number;
  tongSoNhom?: number;
  duAnDangLam?: number;
  duAnHoanThanh?: number;
}

const MemberDetailModal: React.FC<Props> = ({ isOpen, onClose, memberId }) => {
  const [loading, setLoading] = useState(false);
  const [memberData, setMemberData] = useState<MemberDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"info" | "projects" | "groups">(
    "info"
  );

  useEffect(() => {
    if (isOpen && memberId) {
      fetchMemberDetail();
    } else {
      setMemberData(null);
      setError(null);
      setActiveTab("info");
    }
  }, [isOpen, memberId]);

  const fetchMemberDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/ThanhVien/${memberId}`);
      const data: MemberDetailData = response.data;

      // Tính toán thống kê
      const tongSoNhom = data.danhSachNhom?.length || 0;
      const allProjects =
        data.danhSachNhom?.flatMap((nhom) => nhom.duAnThuocNhom || []) || [];
      const tongSoDuAn = allProjects.length;
      const duAnDangLam = allProjects.filter(
        (p) => p.trangThai !== "Hoàn thành"
      ).length;
      const duAnHoanThanh = allProjects.filter(
        (p) => p.trangThai === "Hoàn thành"
      ).length;

      setMemberData({
        ...data,
        tongSoNhom,
        tongSoDuAn,
        duAnDangLam,
        duAnHoanThanh,
      });
    } catch (error: any) {
      console.error("Fetch member detail error:", error);
      setError(
        error?.response?.data?.message || "Không thể tải thông tin thành viên"
      );
      toast.error("Không thể tải thông tin thành viên");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("vi-VN");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Hoàn thành":
        return styles.statusCompleted;
      case "Đang thực hiện":
        return styles.statusInProgress;
      case "Chưa bắt đầu":
        return styles.statusPending;
      default:
        return "";
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case "Cao":
        return styles.priorityHigh;
      case "Trung bình":
        return styles.priorityMedium;
      case "Thấp":
        return styles.priorityLow;
      default:
        return "";
    }
  };

  if (loading) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Chi tiết thành viên">
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Đang tải thông tin...</p>
        </div>
      </Modal>
    );
  }

  if (error || !memberData) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Chi tiết thành viên">
        <div className={styles.error}>
          <p>{error || "Không tìm thấy thông tin thành viên"}</p>
          <button onClick={onClose} className={styles.closeButton}>
            Đóng
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chi tiết thành viên">
      <div className={styles.modalContent}>
        {/* Header with avatar and basic info */}
        <div className={styles.memberHeader}>
          <div className={styles.avatar}>
            {memberData.hoTen.charAt(0).toUpperCase()}
          </div>
          <div className={styles.headerInfo}>
            <h2>{memberData.hoTen}</h2>
            <p className={styles.email}>{memberData.email}</p>
            {memberData.chuyenMon && (
              <span className={styles.specialty}>{memberData.chuyenMon}</span>
            )}
          </div>
        </div>

        {/* Stats cards */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>👥</div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{memberData.tongSoNhom}</div>
              <div className={styles.statLabel}>Nhóm</div>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>📁</div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{memberData.tongSoDuAn}</div>
              <div className={styles.statLabel}>Dự án</div>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>🔄</div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{memberData.duAnDangLam}</div>
              <div className={styles.statLabel}>Đang làm</div>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>✅</div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{memberData.duAnHoanThanh}</div>
              <div className={styles.statLabel}>Hoàn thành</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === "info" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("info")}
          >
            Thông tin
          </button>
          <button
            className={`${styles.tab} ${activeTab === "groups" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("groups")}
          >
            Nhóm ({memberData.tongSoNhom})
          </button>
          <button
            className={`${styles.tab} ${activeTab === "projects" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("projects")}
          >
            Dự án ({memberData.tongSoDuAn})
          </button>
        </div>

        {/* Tab content */}
        <div className={styles.tabContent}>
          {activeTab === "info" && (
            <div className={styles.infoSection}>
              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <label>Họ tên:</label>
                  <span>{memberData.hoTen}</span>
                </div>
                <div className={styles.infoItem}>
                  <label>Email:</label>
                  <span>{memberData.email}</span>
                </div>
                <div className={styles.infoItem}>
                  <label>Chuyên môn:</label>
                  <span>{memberData.chuyenMon || "Chưa cập nhật"}</span>
                </div>
                <div className={styles.infoItem}>
                  <label>Số điện thoại:</label>
                  <span>{memberData.soDienThoai || "Chưa cập nhật"}</span>
                </div>
                <div className={styles.infoItem}>
                  <label>Địa chỉ:</label>
                  <span>{memberData.diaChi || "Chưa cập nhật"}</span>
                </div>
                <div className={styles.infoItem}>
                  <label>Ngày tham gia:</label>
                  <span>
                    {memberData.ngayThamGia
                      ? formatDate(memberData.ngayThamGia)
                      : "N/A"}
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <label>Quyền:</label>
                  <span>{memberData.tenQuyen || "Thành viên"}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "groups" && (
            <div className={styles.groupsSection}>
              {memberData.danhSachNhom && memberData.danhSachNhom.length > 0 ? (
                <div className={styles.groupList}>
                  {memberData.danhSachNhom.map((nhom) => (
                    <div key={nhom.nhomId} className={styles.groupCard}>
                      <div className={styles.groupHeader}>
                        <h3>{nhom.tenNhom}</h3>
                        <span className={styles.projectCount}>
                          {nhom.duAnThuocNhom?.length || 0} dự án
                        </span>
                      </div>
                      {nhom.moTa && (
                        <p className={styles.groupDesc}>{nhom.moTa}</p>
                      )}
                      {nhom.duAnThuocNhom && nhom.duAnThuocNhom.length > 0 && (
                        <div className={styles.projectMini}>
                          {nhom.duAnThuocNhom.map((duAn) => (
                            <span
                              key={duAn.duAnId}
                              className={styles.projectTag}
                            >
                              {duAn.tenDuAn}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.empty}>Chưa tham gia nhóm nào</div>
              )}
            </div>
          )}

          {activeTab === "projects" && (
            <div className={styles.projectsSection}>
              {memberData.danhSachNhom &&
              memberData.danhSachNhom.some(
                (n) => n.duAnThuocNhom && n.duAnThuocNhom.length > 0
              ) ? (
                <div className={styles.projectList}>
                  {memberData.danhSachNhom.flatMap((nhom) =>
                    (nhom.duAnThuocNhom || []).map((duAn) => (
                      <div key={duAn.duAnId} className={styles.projectCard}>
                        <div className={styles.projectHeader}>
                          <h3>{duAn.tenDuAn}</h3>
                          <div className={styles.projectBadges}>
                            <span
                              className={`${styles.statusBadge} ${getStatusColor(duAn.trangThai)}`}
                            >
                              {duAn.trangThai}
                            </span>
                          </div>
                        </div>
                        {duAn.moTa && (
                          <p className={styles.projectDesc}>{duAn.moTa}</p>
                        )}
                        <div className={styles.projectMeta}>
                          <span>👥 {nhom.tenNhom}</span>
                          {duAn.linhVuc && <span>🏷️ {duAn.linhVuc}</span>}
                          <span>
                            📅 {formatDate(duAn.ngayBatDau)} -{" "}
                            {formatDate(duAn.ngayKetThuc)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className={styles.empty}>Chưa tham gia dự án nào</div>
              )}
            </div>
          )}
        </div>

        <div className={styles.actions}>
          <button onClick={onClose} className={styles.closeButton}>
            Đóng
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default MemberDetailModal;
