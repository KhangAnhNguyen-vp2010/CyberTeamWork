import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import api from "../../apis/api";
import styles from "./ProjectDashboard.module.scss";
import StatDetailModal from "./StatDetailModal";
import ProjectOverdueModal from "./ProjectOverdueModal";

interface TongQuanData {
  tongDuAn: number;
  duAnDangThucHien: number;
  duAnHoanThanh: number;
  duAnQuaHan: number;
  duAnTamDung: number;
  tongCongViec: number;
  congViecHoanThanh: number;
  congViecKhanCap: number;
  congViecQuaHan: number;
  tienDoTrungBinh: number;
}

interface DuAnItem {
  duAnId: number;
  tenDuAn: string;
  tienDo: number;
  tongCongViec: number;
  hoanThanh: number;
  mucDoUuTien?: string;
  soNgayConLai?: number;
  soNgayQuaHan?: number;
  tienDoMongDoi?: number;
  chenhLech?: number;
}

interface DashboardData {
  tongQuan: TongQuanData;
  duAnKhanCap: DuAnItem[];
  duAnQuaHan: DuAnItem[];
  duAnTienDoThap: DuAnItem[];
}

interface Props {
  nhomId: number;
}

export default function ProjectDashboard({ nhomId }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [duAnTamDung, setDuAnTamDung] = useState<any[]>([]);
  const [modalStatType, setModalStatType] = useState<
    | "dangThucHien"
    | "tongCongViec"
    | "congViecHoanThanh"
    | "congViecQuaHan"
    | "congViecKhanCap"
    | null
  >(null);
  const [modalTitle, setModalTitle] = useState("");
  const [projectOverdueModalOpen, setProjectOverdueModalOpen] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/DuAn/ThongKeTongQuan/${nhomId}`);
      setData(response.data);

      // Lấy danh sách dự án tạm dừng
      if (response.data.tongQuan.duAnTamDung > 0) {
        const duAnResponse = await api.get(
          `/DuAn/GetProjectsOfGroup/${nhomId}`
        );
        const allProjects =
          duAnResponse.data.projects || duAnResponse.data.Projects || [];
        const pausedProjects = allProjects.filter(
          (p: any) => p.trangThai === "Tạm dừng"
        );
        setDuAnTamDung(pausedProjects);
      } else {
        setDuAnTamDung([]);
      }
    } catch (error: any) {
      toast.error("Lỗi khi tải dữ liệu thống kê");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (nhomId) {
      fetchDashboardData();
    }
  }, [nhomId]);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const openModal = (
    type:
      | "dangThucHien"
      | "tongCongViec"
      | "congViecHoanThanh"
      | "congViecQuaHan"
      | "congViecKhanCap",
    title: string
  ) => {
    setModalStatType(type);
    setModalTitle(title);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalStatType(null);
    setModalTitle("");
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Đang tải dữ liệu...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.empty}>
        <p>📊 Chọn nhóm để xem thống kê dự án</p>
      </div>
    );
  }

  const { tongQuan, duAnKhanCap, duAnQuaHan, duAnTienDoThap } = data;
  const totalIssues =
    duAnKhanCap.length + duAnQuaHan.length + duAnTienDoThap.length;

  return (
    <div className={styles.dashboard}>
      {/* Header compact */}
      <div className={styles.header}>
        <div>
          <h2>📊 Tổng Quan Dự Án</h2>
          <p>Theo dõi tiến độ và hiệu suất của tất cả dự án</p>
        </div>
        <button onClick={fetchDashboardData} className={styles.refreshBtn}>
          🔄
        </button>
      </div>

      {/* Cảnh báo compact */}
      {totalIssues > 0 && (
        <div className={styles.alertBanner}>
          <div className={styles.alertIcon}>⚠️</div>
          <div className={styles.alertContent}>
            <strong>Cần xử lý ngay!</strong>
            <div className={styles.alertTags}>
              {duAnQuaHan.length > 0 && (
                <span className={styles.critical}>
                  {duAnQuaHan.length} quá hạn
                </span>
              )}
              {duAnKhanCap.length > 0 && (
                <span className={styles.urgent}>
                  {duAnKhanCap.length} khẩn cấp
                </span>
              )}
              {duAnTienDoThap.length > 0 && (
                <span className={styles.warning}>
                  {duAnTienDoThap.length} chậm
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid - Compact 2 rows */}
      <div className={styles.statsGrid}>
        {/* Row 1: Overview với charts */}
        <div className={`${styles.statCard} ${styles.chartCard}`}>
          <div className={styles.donutChart}>
            <svg viewBox="0 0 100 100" className={styles.donutSvg}>
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="10"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#10b981"
                strokeWidth="10"
                strokeDasharray={`${(tongQuan.duAnHoanThanh / (tongQuan.tongDuAn || 1)) * 251.2} 251.2`}
                strokeDashoffset="0"
                transform="rotate(-90 50 50)"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="10"
                strokeDasharray={`${(tongQuan.duAnDangThucHien / (tongQuan.tongDuAn || 1)) * 251.2} 251.2`}
                strokeDashoffset={`-${(tongQuan.duAnHoanThanh / (tongQuan.tongDuAn || 1)) * 251.2}`}
                transform="rotate(-90 50 50)"
              />
              <text
                x="50"
                y="50"
                textAnchor="middle"
                dy="0.3em"
                className={styles.donutText}
              >
                {tongQuan.tongDuAn}
              </text>
            </svg>
          </div>
          <div className={styles.chartLegend}>
            <div className={styles.chartTitle}>Dự án</div>
            <div className={styles.legendItem}>
              <span
                className={styles.dot}
                style={{ background: "#10b981" }}
              ></span>
              Xong: {tongQuan.duAnHoanThanh}
            </div>
            <div className={styles.legendItem}>
              <span
                className={styles.dot}
                style={{ background: "#3b82f6" }}
              ></span>
              Làm: {tongQuan.duAnDangThucHien}
            </div>
          </div>
        </div>

        <div className={`${styles.statCard} ${styles.chartCard}`}>
          <div className={styles.miniBarChart}>
            <div className={styles.chartTitle}>Công việc</div>
            <div className={styles.barItem}>
              <span className={styles.barLabel}>Tổng</span>
              <div className={styles.barTrack}>
                <div
                  className={styles.barFill}
                  style={{ width: "100%", background: "#6366f1" }}
                >
                  <span>{tongQuan.tongCongViec}</span>
                </div>
              </div>
            </div>
            <div className={styles.barItem}>
              <span className={styles.barLabel}>Xong</span>
              <div className={styles.barTrack}>
                <div
                  className={styles.barFill}
                  style={{
                    width: `${(tongQuan.congViecHoanThanh / (tongQuan.tongCongViec || 1)) * 100}%`,
                    background: "#10b981",
                  }}
                >
                  <span>{tongQuan.congViecHoanThanh}</span>
                </div>
              </div>
            </div>
            <div className={styles.barItem}>
              <span className={styles.barLabel}>Cấp bách</span>
              <div className={styles.barTrack}>
                <div
                  className={styles.barFill}
                  style={{
                    width: `${(tongQuan.congViecKhanCap / (tongQuan.tongCongViec || 1)) * 100}%`,
                    background: "#f59e0b",
                  }}
                >
                  <span>{tongQuan.congViecKhanCap}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={`${styles.statCard} ${styles.highlight}`}>
          <div
            className={styles.statIcon}
            style={{ background: "linear-gradient(135deg, #06b6d4, #0891b2)" }}
          >
            📊
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{tongQuan.tienDoTrungBinh}%</div>
            <div className={styles.statLabel}>Tiến độ trung bình</div>
            <div className={styles.statSubLabel}>
              Trung bình {tongQuan.tongDuAn} dự án
            </div>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{
                  width: `${tongQuan.tienDoTrungBinh}%`,
                  background:
                    tongQuan.tienDoTrungBinh >= 80
                      ? "#10b981"
                      : tongQuan.tienDoTrungBinh >= 50
                        ? "#f59e0b"
                        : "#ef4444",
                }}
              />
            </div>
          </div>
        </div>

        {/* Row 2: More stats */}
        <div
          className={`${styles.statCard} ${styles.clickable}`}
          onClick={() => openModal("dangThucHien", "Dự Án Đang Thực Hiện")}
        >
          <div
            className={styles.statIcon}
            style={{ background: "linear-gradient(135deg, #3b82f6, #2563eb)" }}
          >
            🔄
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{tongQuan.duAnDangThucHien}</div>
            <div className={styles.statLabel}>Dự án đang thực hiện</div>
            <div className={styles.statSubLabel}>
              {tongQuan.tongDuAn > 0
                ? Math.round(
                    (tongQuan.duAnDangThucHien / tongQuan.tongDuAn) * 100
                  )
                : 0}
              % tổng dự án
            </div>
          </div>
        </div>

        <div
          className={`${styles.statCard} ${styles.clickable}`}
          onClick={() => openModal("tongCongViec", "Tất Cả Công Việc")}
        >
          <div
            className={styles.statIcon}
            style={{ background: "linear-gradient(135deg, #8b5cf6, #7c3aed)" }}
          >
            📋
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{tongQuan.tongCongViec}</div>
            <div className={styles.statLabel}>Tổng công việc</div>
            <div className={styles.statSubLabel}>
              Tất cả {tongQuan.tongDuAn} dự án
            </div>
          </div>
        </div>

        <div
          className={`${styles.statCard} ${styles.clickable}`}
          onClick={() => openModal("congViecHoanThanh", "Công Việc Hoàn Thành")}
        >
          <div
            className={styles.statIcon}
            style={{ background: "linear-gradient(135deg, #14b8a6, #0d9488)" }}
          >
            ✔️
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{tongQuan.congViecHoanThanh}</div>
            <div className={styles.statLabel}>Công việc hoàn thành</div>
            <div className={styles.statSubLabel}>
              {tongQuan.tongCongViec > 0
                ? Math.round(
                    (tongQuan.congViecHoanThanh / tongQuan.tongCongViec) * 100
                  )
                : 0}
              % tổng CV
            </div>
          </div>
        </div>

        {/* Row 3: Issues */}
        <div
          className={`${styles.statCard} ${styles.clickable}`}
          onClick={() => setProjectOverdueModalOpen(true)}
        >
          <div
            className={styles.statIcon}
            style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)" }}
          >
            ⚠️
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{tongQuan.duAnQuaHan}</div>
            <div className={styles.statLabel}>Dự án quá hạn</div>
            <div className={styles.statSubLabel}>Cần xử lý ngay</div>
          </div>
        </div>

        <div
          className={`${styles.statCard} ${styles.clickable}`}
          onClick={() => openModal("congViecQuaHan", "Công Việc Quá Hạn")}
        >
          <div
            className={styles.statIcon}
            style={{ background: "linear-gradient(135deg, #ec4899, #db2777)" }}
          >
            ⏰
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{tongQuan.congViecQuaHan}</div>
            <div className={styles.statLabel}>Công việc quá hạn</div>
            <div className={styles.statSubLabel}>
              {tongQuan.tongCongViec > 0
                ? Math.round(
                    (tongQuan.congViecQuaHan / tongQuan.tongCongViec) * 100
                  )
                : 0}
              % tổng CV
            </div>
          </div>
        </div>

        <div
          className={`${styles.statCard} ${styles.clickable}`}
          onClick={() => openModal("congViecKhanCap", "Công Việc Khẩn Cấp")}
        >
          <div
            className={styles.statIcon}
            style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
          >
            🔥
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{tongQuan.congViecKhanCap}</div>
            <div className={styles.statLabel}>Công việc khẩn cấp</div>
            <div className={styles.statSubLabel}>
              {tongQuan.tongCongViec > 0
                ? Math.round(
                    (tongQuan.congViecKhanCap / tongQuan.tongCongViec) * 100
                  )
                : 0}
              % tổng CV
            </div>
          </div>
        </div>
      </div>

      {/* Dự án tạm dừng section */}
      {tongQuan.duAnTamDung > 0 && (
        <div className={styles.prioritySection} style={{ marginTop: "16px" }}>
          <div className={styles.sectionTitle}>
            <span
              className={styles.iconBadge}
              style={{ background: "#f3f4f6", color: "#6b7280" }}
            >
              ⏸️
            </span>
            <h3>Dự Án Tạm Dừng ({tongQuan.duAnTamDung})</h3>
          </div>
          <div className={styles.compactList}>
            {duAnTamDung.map((duAn: any) => {
              const congViecs = duAn.congViecs || [];
              const tienDo =
                congViecs.length > 0
                  ? Math.round(
                      congViecs.reduce(
                        (sum: number, cv: any) =>
                          sum + (cv.phamTramHoanThanh || 0),
                        0
                      ) / congViecs.length
                    )
                  : 0;
              const hoanThanh = congViecs.filter(
                (cv: any) => (cv.phamTramHoanThanh || 0) >= 100
              ).length;

              return (
                <div
                  key={duAn.duAnId}
                  className={`${styles.compactCard} ${styles.paused}`}
                >
                  <div className={styles.cardHeader}>
                    <h4>{duAn.tenDuAn}</h4>
                    <span
                      className={styles.badge}
                      style={{ background: "#6b7280" }}
                    >
                      Tạm dừng
                    </span>
                  </div>
                  <div className={styles.cardProgress}>
                    <div className={styles.progressInfo}>
                      <span>{tienDo}%</span>
                      <span>
                        {hoanThanh}/{congViecs.length} CV
                      </span>
                    </div>
                    <div className={styles.progressBar}>
                      <div
                        className={styles.progressFill}
                        style={{
                          width: `${tienDo}%`,
                          background: "#6b7280",
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Priority sections - Compact */}
      {duAnQuaHan.length > 0 && (
        <div className={styles.prioritySection}>
          <div className={styles.sectionTitle}>
            <span
              className={styles.iconBadge}
              style={{ background: "#fef2f2", color: "#dc2626" }}
            >
              🚨
            </span>
            <h3>Dự Án Quá Hạn ({duAnQuaHan.length})</h3>
          </div>
          <div className={styles.compactList}>
            {duAnQuaHan.map((duAn) => (
              <div
                key={duAn.duAnId}
                className={`${styles.compactCard} ${styles.overdue}`}
              >
                <div className={styles.cardHeader}>
                  <h4>{duAn.tenDuAn}</h4>
                  <span className={styles.badge}>
                    Quá {duAn.soNgayQuaHan} ngày
                  </span>
                </div>
                <div className={styles.cardProgress}>
                  <div className={styles.progressInfo}>
                    <span>{duAn.tienDo}%</span>
                    <span>
                      {duAn.hoanThanh}/{duAn.tongCongViec} CV
                    </span>
                  </div>
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{
                        width: `${duAn.tienDo}%`,
                        background: "#ef4444",
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {duAnKhanCap.length > 0 && (
        <div className={styles.prioritySection}>
          <div className={styles.sectionTitle}>
            <span
              className={styles.iconBadge}
              style={{ background: "#fff7ed", color: "#ea580c" }}
            >
              🔥
            </span>
            <h3>Dự Án Khẩn Cấp ({duAnKhanCap.length})</h3>
          </div>
          <div className={styles.compactList}>
            {duAnKhanCap.map((duAn) => (
              <div
                key={duAn.duAnId}
                className={`${styles.compactCard} ${styles.urgent}`}
              >
                <div className={styles.cardHeader}>
                  <h4>{duAn.tenDuAn}</h4>
                  <span className={styles.badge}>{duAn.soNgayConLai} ngày</span>
                </div>
                <div className={styles.cardProgress}>
                  <div className={styles.progressInfo}>
                    <span>{duAn.tienDo}%</span>
                    <span>
                      {duAn.hoanThanh}/{duAn.tongCongViec} CV
                    </span>
                  </div>
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{
                        width: `${duAn.tienDo}%`,
                        background: "#f59e0b",
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Collapsible section */}
      {duAnTienDoThap.length > 0 && (
        <div className={styles.collapsibleSection}>
          <div
            className={styles.sectionHeader}
            onClick={() => toggleSection("tienDoThap")}
          >
            <div className={styles.sectionTitle}>
              <span
                className={styles.iconBadge}
                style={{ background: "#eff6ff", color: "#1d4ed8" }}
              >
                ⚡
              </span>
              <h3>Dự Án Chậm Tiến Độ ({duAnTienDoThap.length})</h3>
            </div>
            <span className={styles.toggleIcon}>
              {expandedSection === "tienDoThap" ? "▼" : "▶"}
            </span>
          </div>
          {expandedSection === "tienDoThap" && (
            <div className={styles.compactList}>
              {duAnTienDoThap.map((duAn) => (
                <div
                  key={duAn.duAnId}
                  className={`${styles.compactCard} ${styles.slow}`}
                >
                  <div className={styles.cardHeader}>
                    <h4>{duAn.tenDuAn}</h4>
                    <span className={styles.badge}>Chậm {duAn.chenhLech}%</span>
                  </div>
                  <div className={styles.cardProgress}>
                    <div className={styles.progressInfo}>
                      <span>Thực tế: {duAn.tienDo}%</span>
                      <span>Kế hoạch: {duAn.tienDoMongDoi}%</span>
                    </div>
                    <div className={styles.comparisonBars}>
                      <div className={styles.progressBar}>
                        <div
                          className={styles.progressFill}
                          style={{
                            width: `${duAn.tienDo}%`,
                            background: "#ef4444",
                          }}
                        />
                      </div>
                      <div className={styles.progressBar}>
                        <div
                          className={styles.progressFill}
                          style={{
                            width: `${duAn.tienDoMongDoi}%`,
                            background: "#94a3b8",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Success */}
      {totalIssues === 0 && tongQuan.tongDuAn > 0 && (
        <div className={styles.successBanner}>
          <div className={styles.successIcon}>🎉</div>
          <div>
            <h3>Tuyệt vời!</h3>
            <p>Tất cả dự án đang theo đúng tiến độ</p>
          </div>
        </div>
      )}

      {/* Modal chi tiết công việc */}
      <StatDetailModal
        isOpen={modalOpen}
        onClose={closeModal}
        nhomId={nhomId}
        statType={modalStatType}
        title={modalTitle}
      />

      {/* Modal dự án quá hạn */}
      <ProjectOverdueModal
        isOpen={projectOverdueModalOpen}
        onClose={() => setProjectOverdueModalOpen(false)}
        nhomId={nhomId}
      />
    </div>
  );
}
