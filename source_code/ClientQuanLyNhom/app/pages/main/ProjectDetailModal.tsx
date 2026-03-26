import React, { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./ProjectDetailModal.module.scss";
import KanbanTab from "../../components/project-detail/KanbanTab";
import AssignedTasksTab from "../../components/project-detail/AssignedTasksTab";
import ReportTab from "../../components/project-detail/ReportTab";
import ProgressTrackingTab from "../../components/project-detail/ProgressTrackingTab";
import api from "../../apis/api";
import { toast } from "react-toastify";

interface ProjectType {
  duAnId: number;
  tenDuAn: string;
  moTa: string;
  ngayBd: string;
  ngayKt: string;
  trangThai: string;
  linhVucId: number;
  anhBia: string;
}

interface MemberType {
  TenThanhVien: string;
  ChucVu: string;
  ChuyenMon: string;
  NgayThamGia: string;
  GhiChu: string;
}

interface ProjectReport {
  duAnID: number;
  tenDuAn: string;
  tongSoCV: number;
  soCVChuaBatDau: number;
  soCVHoanThanh: number;
  soCVDangLam: number;
  soCVTreHan: number;
  phanTramHoanThanh: number;
  thoiGianHoanThanhTrungBinh: number;
  ngayBatDauSomNhatCuaCongViec: string | null;
  ngayKetThucMuonNhatCuaCongViec: string | null;
  soNgayConLai: number;
  tienDoThucTe: number;
  danhGiaTienDo: string;
  ngayCapNhatBaoCao: string;
}

interface KanbanSubTaskResult {
  noiDung?: string;
  file?: string[];
}

interface SubTaskType {
  subTaskId?: string;
  MoTa: string;
  NgayPC: string;
  DoUuTien: string;
  ThanhVienDuocPhanCong: string;
  KetQuaThucHien?: KanbanSubTaskResult | null;
  DanhGia: string;
  TienDoHoanThanh: string;
}

interface ProgressSubTaskResult {
  noiDung?: string;
  file?: string[];
}

interface ProgressSubAssignment {
  SubTaskId: string;
  MoTa: string;
  NgayPC: string;
  DoUuTien: string;
  KetQuaThucHien?: ProgressSubTaskResult | null;
  DanhGia?: string;
  TienDoHoanThanh?: string | number;
  TrangThaiKhoa?: number;
}

interface ProgressAssignment {
  thanhVienId: number;
  hoTen: string;
  chuyenMon?: string;
  noiDungPhanCong?: ProgressSubAssignment[];
}

interface ProgressTask {
  congViecId: number;
  tenCongViec: string;
  trangThai: string;
  phamTramHoanThanh?: number;
  ngayBd?: string;
  ngayKt?: string;
  danhSachPhanCong?: ProgressAssignment[];
}

interface ProjectProgress {
  duAnID: number;
  tenDuAn: string;
  trangThai?: string;
  soLuongCongViec?: number;
  tongPhanCong?: number;
  danhSachCongViec?: ProgressTask[];
}

type RawProgressSubTaskResult =
  | {
      NoiDung?: string | null;
      noiDung?: string | null;
      File?: (string | null)[] | null;
      file?: (string | null)[] | null;
    }
  | string[]
  | string
  | null
  | undefined;

type RawProgressSubAssignment = {
  SubTaskId?: string | null;
  subTaskId?: string | null;
  MoTa?: string | null;
  moTa?: string | null;
  NgayPC?: string | null;
  ngayPC?: string | null;
  DoUuTien?: string | null;
  doUuTien?: string | null;
  KetQuaThucHien?: RawProgressSubTaskResult;
  ketQuaThucHien?: RawProgressSubTaskResult;
  DanhGia?: string | null;
  danhGia?: string | null;
  TienDoHoanThanh?: string | number | null;
  tienDoHoanThanh?: string | number | null;
  TrangThaiKhoa?: string | number | null;
  trangThaiKhoa?: string | number | null;
};

type RawProgressAssignment = {
  thanhVienId: number;
  hoTen: string;
  chuyenMon?: string | null;
  noiDungPhanCong?: RawProgressSubAssignment[];
};

type RawProgressTask = {
  congViecId: number;
  tenCongViec: string;
  trangThai: string;
  phamTramHoanThanh?: number | string | null;
  ngayBd?: string | null;
  ngayKt?: string | null;
  danhSachPhanCong?: RawProgressAssignment[];
};

type RawProjectProgress = {
  duAnID: number;
  tenDuAn: string;
  trangThai?: string;
  soLuongCongViec?: number;
  tongPhanCong?: number;
  danhSachCongViec?: RawProgressTask[];
};

const normalizeProgressSubTaskResult = (
  raw: RawProgressSubTaskResult
): ProgressSubTaskResult | null => {
  if (!raw) {
    return null;
  }

  if (Array.isArray(raw)) {
    const files = raw.filter(
      (item): item is string =>
        typeof item === "string" && item.trim().length > 0
    );
    return files.length > 0 ? { file: files } : null;
  }

  if (typeof raw === "string") {
    const content = raw.trim();
    return content.length > 0 ? { noiDung: content } : null;
  }

  if (typeof raw !== "object") {
    return null;
  }

  const obj = raw as {
    NoiDung?: string | null;
    noiDung?: string | null;
    File?: (string | null)[] | null;
    file?: (string | null)[] | null;
  };

  const contentSource =
    typeof obj.NoiDung === "string"
      ? obj.NoiDung
      : typeof obj.noiDung === "string"
        ? obj.noiDung
        : "";
  const trimmedContent = contentSource.trim();

  const rawFiles = Array.isArray(obj.File)
    ? obj.File
    : Array.isArray(obj.file)
      ? obj.file
      : [];

  const files = rawFiles.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0
  );

  const result: ProgressSubTaskResult = {};

  if (trimmedContent.length > 0) {
    result.noiDung = trimmedContent;
  }

  if (files.length > 0) {
    result.file = files;
  }

  return Object.keys(result).length > 0 ? result : null;
};

const normalizeProjectProgressResponse = (
  data?: RawProjectProgress | null
): ProjectProgress | null => {
  if (!data) {
    return null;
  }

  const normalizedTasks = (data.danhSachCongViec ?? []).map((task) => {
    const normalizedAssignments = (task.danhSachPhanCong ?? []).map(
      (assignment) => {
        const normalizedSubAssignments: ProgressSubAssignment[] = (
          assignment.noiDungPhanCong ?? []
        ).map((subTask) => {
          const rawResult = subTask.KetQuaThucHien ?? subTask.ketQuaThucHien;
          const normalizedResult = normalizeProgressSubTaskResult(rawResult);

          const trangThaiKhoaValue =
            subTask.TrangThaiKhoa ?? subTask.trangThaiKhoa;
          let trangThaiKhoa: number;

          if (typeof trangThaiKhoaValue === "number") {
            trangThaiKhoa = trangThaiKhoaValue;
          } else if (
            trangThaiKhoaValue === null ||
            trangThaiKhoaValue === undefined
          ) {
            trangThaiKhoa = 0;
          } else {
            trangThaiKhoa = parseInt(String(trangThaiKhoaValue)) || 0;
          }

          return {
            SubTaskId: subTask.SubTaskId ?? subTask.subTaskId ?? "",
            MoTa: subTask.MoTa ?? subTask.moTa ?? "",
            NgayPC: subTask.NgayPC ?? subTask.ngayPC ?? "",
            DoUuTien: subTask.DoUuTien ?? subTask.doUuTien ?? "",
            KetQuaThucHien: normalizedResult ?? undefined,
            DanhGia: subTask.DanhGia ?? subTask.danhGia ?? undefined,
            TienDoHoanThanh:
              subTask.TienDoHoanThanh ?? subTask.tienDoHoanThanh ?? undefined,
            TrangThaiKhoa: trangThaiKhoa,
            NgayNop: subTask.NgayNop ?? subTask.ngayNop ?? undefined,
          };
        });

        return {
          thanhVienId: assignment.thanhVienId,
          hoTen: assignment.hoTen,
          chuyenMon: assignment.chuyenMon ?? undefined,
          noiDungPhanCong: normalizedSubAssignments,
        };
      }
    );

    return {
      congViecId: task.congViecId,
      tenCongViec: task.tenCongViec,
      trangThai: task.trangThai,
      phamTramHoanThanh: parsePercentage(task.phamTramHoanThanh),
      ngayBd: task.ngayBd ?? undefined,
      ngayKt: task.ngayKt ?? undefined,
      danhSachPhanCong: normalizedAssignments,
    };
  });

  return {
    ...data,
    danhSachCongViec: normalizedTasks,
  } as ProjectProgress;
};

interface CommentType {
  binhLuanId: number;
  ThanhVienBinhLuan: string;
  NoiDung: string;
  NgayBinhLuan: string;
  NgayCapNhat: string;
}

interface KanbanTaskType {
  congViecId: number;
  tenCongViec: string;
  ngayBd: string;
  ngayKt: string;
  trangThai: string;
  phamTramHoanThanh: number;
  anhBia: string;
  PhanCong?: SubTaskType[];
  BinhLuan?: CommentType[];
}

interface ProjectMemberStat {
  thanhVienID: number;
  hoTen: string;
  soLuongCongViec: number;
  soLuongHoanThanh: number;
  trungBinhHT: number;
  mucDoHoatDong: string;
}

interface KanbanColumnType {
  name: string;
  status: string;
}

interface ProjectDetailModalProps {
  open: boolean;
  onClose: () => void;
  project: ProjectType;
  nhomId: number;
}

const TABS = [
  { key: "report", label: "Báo cáo" },
  { key: "progress", label: "Theo dõi tiến độ" },
  { key: "kanban", label: "Kanban board" },
  { key: "assigned", label: "Công việc được giao" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const formatDate = (date: string | null | undefined) => {
  if (!date) return "—";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }
  return parsed.toLocaleDateString("vi-VN");
};

const calculateAverageCompletion = (tasks?: ProgressTask[]) => {
  if (!tasks?.length) {
    return 0;
  }

  const total = tasks.reduce(
    (sum, task) => sum + (task.phamTramHoanThanh || 0),
    0
  );

  return Math.min(100, Math.max(0, Math.round(total / tasks.length)));
};

const parsePercentage = (value: string | number | null | undefined) => {
  if (typeof value === "number") {
    return Math.min(100, Math.max(0, Math.round(value)));
  }

  if (typeof value === "string") {
    const numeric = parseFloat(value.replace(/%/g, "").replace(",", "."));
    if (!Number.isNaN(numeric)) {
      return Math.min(100, Math.max(0, Math.round(numeric)));
    }
  }

  return 0;
};

export default function ProjectDetailModal({
  open,
  onClose,
  project,
  nhomId,
}: ProjectDetailModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("report");
  const [selectedTask, setSelectedTask] = useState<KanbanTaskType | null>(null);
  const [reportData, setReportData] = useState<ProjectReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [memberStats, setMemberStats] = useState<ProjectMemberStat[] | null>(
    null
  );
  const [memberStatsLoading, setMemberStatsLoading] = useState(false);
  const [memberStatsError, setMemberStatsError] = useState<string | null>(null);
  const [memberStatsType, setMemberStatsType] = useState<
    "NhieuNhat" | "ItNhat"
  >("NhieuNhat");
  const [memberStatsTop, setMemberStatsTop] = useState<number>(5);
  const [progressData, setProgressData] = useState<ProjectProgress | null>(
    null
  );
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [canViewProgressTab, setCanViewProgressTab] = useState(false);
  const [userRole, setUserRole] = useState<string>("");

  const currentUserEmail = useMemo(() => {
    try {
      const stored =
        localStorage.getItem("user") || sessionStorage.getItem("user");
      if (!stored) {
        return "";
      }
      const parsed = JSON.parse(stored);
      return (
        parsed?.Mail || parsed?.Email || parsed?.mail || parsed?.email || ""
      );
    } catch (error) {
      console.error("Không thể lấy email người dùng:", error);
      return "";
    }
  }, []);

  const handleMemberStatsTopChange = useCallback((value: number) => {
    setMemberStatsTop(value);
  }, []);

  const handleMemberStatsTypeChange = useCallback(
    (value: "NhieuNhat" | "ItNhat") => {
      setMemberStatsType(value);
    },
    []
  );

  const visibleTabs = useMemo(
    () =>
      TABS.filter((tab) =>
        tab.key === "progress" ? canViewProgressTab : true
      ),
    [canViewProgressTab]
  );

  useEffect(() => {
    if (!visibleTabs.find((tab) => tab.key === activeTab)) {
      setActiveTab("report");
    }
  }, [activeTab, visibleTabs]);

  useEffect(() => {
    if (!open || typeof window === "undefined") {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !nhomId) {
      setCanViewProgressTab(false);
      return;
    }

    let isMounted = true;
    const fetchRole = async () => {
      try {
        const stored =
          localStorage.getItem("user") || sessionStorage.getItem("user");
        if (!stored) {
          if (isMounted) setCanViewProgressTab(false);
          return;
        }
        const parsed = JSON.parse(stored);
        const userId = parsed?.UserId;
        if (!userId) {
          if (isMounted) setCanViewProgressTab(false);
          return;
        }

        const response = await api.get(`/Nhom/${nhomId}/ThanhVien/${userId}`);
        if (!isMounted) return;
        const role = response?.data?.chucVu || "";
        setUserRole(role);
        setCanViewProgressTab(role?.toLowerCase().includes("trưởng"));
      } catch (error) {
        console.error("Không thể kiểm tra vai trò thành viên:", error);
        if (isMounted) setCanViewProgressTab(false);
      }
    };

    fetchRole();

    return () => {
      isMounted = false;
    };
  }, [open, nhomId]);

  useEffect(() => {
    if (!open || activeTab !== "report") {
      return;
    }

    let isSubscribed = true;
    const fetchReport = async () => {
      setReportLoading(true);
      setReportError(null);

      try {
        const response = await api.get(
          `/DuAn/ThongKeBaoCaoDuAn/${project.duAnId}`
        );
        const data = response.data?.data as ProjectReport | undefined;

        if (isSubscribed) {
          setReportData(data ?? null);
        }
      } catch (error: any) {
        console.error("Fetch project report failed:", error);
        if (isSubscribed) {
          setReportError(
            error?.response?.data?.message || "Không thể tải báo cáo dự án."
          );
        }
        toast.error("Không thể tải báo cáo dự án.");
      } finally {
        if (isSubscribed) {
          setReportLoading(false);
        }
      }
    };

    fetchReport();

    return () => {
      isSubscribed = false;
    };
  }, [open, activeTab, project.duAnId]);

  useEffect(() => {
    if (!open || activeTab !== "report") {
      return;
    }

    let isSubscribed = true;
    const fetchMemberStats = async () => {
      setMemberStatsLoading(true);
      setMemberStatsError(null);

      try {
        const response = await api.get(
          `/DuAn/ThanhVienTheoDuAn/${project.duAnId}/${memberStatsTop}/${memberStatsType}`
        );
        if (isSubscribed) {
          setMemberStats(
            Array.isArray(response.data)
              ? (response.data as ProjectMemberStat[])
              : []
          );
        }
      } catch (error: any) {
        console.error("Fetch member stats failed:", error);
        if (isSubscribed) {
          setMemberStatsError(
            error?.response?.data?.message ||
              "Không thể tải thống kê thành viên."
          );
          setMemberStats(null);
        }
      } finally {
        if (isSubscribed) {
          setMemberStatsLoading(false);
        }
      }
    };

    fetchMemberStats();

    return () => {
      isSubscribed = false;
    };
  }, [open, activeTab, project.duAnId, memberStatsTop, memberStatsType]);

  useEffect(() => {
    if (!open || activeTab !== "progress") {
      return;
    }

    let isSubscribed = true;
    const fetchProgress = async () => {
      setProgressLoading(true);
      setProgressError(null);

      try {
        const response = await api.get(
          `/PhanCong/phancong/duan/${project.duAnId}`
        );
        const data = normalizeProjectProgressResponse(
          response.data as RawProjectProgress | null
        );

        if (isSubscribed) {
          setProgressData(data ?? null);
        }
      } catch (error: any) {
        console.error("Fetch project progress failed:", error);
        if (isSubscribed) {
          setProgressError(
            error?.response?.data?.message || "Không thể tải dữ liệu tiến độ."
          );
          setProgressData(null);
        }
        toast.error("Không thể tải dữ liệu tiến độ.");
      } finally {
        if (isSubscribed) {
          setProgressLoading(false);
        }
      }
    };

    fetchProgress();

    return () => {
      isSubscribed = false;
    };
  }, [open, activeTab, project.duAnId]);

  // Hàm refetch progress data
  const refetchProgressData = useCallback(
    async (silent: boolean = false) => {
      if (!open || activeTab !== "progress") return;

      if (!silent) {
        setProgressLoading(true);
      }
      try {
        const response = await api.get(
          `/PhanCong/phancong/duan/${project.duAnId}`
        );
        const data = normalizeProjectProgressResponse(
          response.data as RawProjectProgress | null
        );
        setProgressData(data ?? null);
      } catch (error: any) {
        console.error("Refetch progress failed:", error);
        if (!silent) {
          toast.error("Không thể tải lại dữ liệu.");
        }
      } finally {
        if (!silent) {
          setProgressLoading(false);
        }
      }
    },
    [open, activeTab, project.duAnId]
  );

  // Dữ liệu cho Kanban board
  const kanbanColumns: KanbanColumnType[] = [
    { name: "Chưa bắt đầu", status: "Chưa bắt đầu" },
    { name: "Đang làm", status: "Đang làm" },
    { name: "Hoàn thành", status: "Hoàn thành" },
    { name: "Trễ hạn", status: "Trễ hạn" },
  ];

  return (
    <div className={styles.fullscreenOverlay}>
      <div className={styles.modalContent}>
        <button className={styles.closeBtn} onClick={onClose}>
          ✖
        </button>
        <div className={styles.tabs}>
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              className={activeTab === tab.key ? styles.activeTab : styles.tab}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className={styles.tabContent}>
          {/* Tab 1: Báo cáo */}
          {activeTab === "report" && (
            <div className={styles.reportSection}>
              {reportLoading && (
                <div className={styles.reportStatus}>Đang tải báo cáo...</div>
              )}
              {!reportLoading && reportError && (
                <div className={styles.reportStatusError}>{reportError}</div>
              )}
              {!reportLoading && !reportError && reportData && (
                <ReportTab
                  project={project}
                  report={reportData}
                  memberStats={memberStats}
                  memberStatsLoading={memberStatsLoading}
                  memberStatsError={memberStatsError}
                  memberStatsTop={memberStatsTop}
                  memberStatsType={memberStatsType}
                  onMemberStatsTopChange={handleMemberStatsTopChange}
                  onMemberStatsTypeChange={handleMemberStatsTypeChange}
                  userRole={userRole}
                />
              )}
              {!reportLoading && !reportError && !reportData && (
                <div className={styles.reportStatus}>
                  Chưa có dữ liệu báo cáo cho dự án này.
                </div>
              )}
            </div>
          )}
          {activeTab === "progress" && (
            <div className={styles.progressTracking}>
              {progressLoading ? (
                <div className={styles.reportStatus}>
                  Đang tải dữ liệu tiến độ...
                </div>
              ) : progressError ? (
                <div className={styles.reportStatusError}>{progressError}</div>
              ) : progressData ? (
                <div className={styles.progressGrid}>
                  <ProgressTrackingTab
                    data={progressData}
                    loading={progressLoading}
                    error={progressError}
                    currentUserEmail={currentUserEmail}
                    onRefresh={refetchProgressData}
                    duAnId={project.duAnId}
                  />
                </div>
              ) : (
                <div className={styles.reportStatus}>
                  Chưa có dữ liệu theo dõi tiến độ cho dự án này.
                </div>
              )}
            </div>
          )}
          {/* Tab 2: Kanban board */}
          {activeTab === "kanban" && (
            <KanbanTab
              key={activeTab}
              kanbanColumns={kanbanColumns}
              selectedTask={selectedTask}
              onTaskSelect={setSelectedTask}
              duAnId={project.duAnId}
              nhomId={nhomId}
              projectStartDate={project.ngayBd}
              projectEndDate={project.ngayKt}
              projectStatus={project.trangThai}
            />
          )}
          {activeTab === "assigned" && (
            <AssignedTasksTab duAnId={project.duAnId} />
          )}
        </div>
      </div>
    </div>
  );
}
