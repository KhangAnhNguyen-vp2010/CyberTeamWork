import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import styles from "./ProgressTrackingTab.module.scss";
import { toast } from "react-toastify";
import api from "../../apis/api";

const MIN_TREE_WIDTH = 260;
const MAX_TREE_WIDTH = 520;

const DEFAULT_RATING = "Chưa có";
const PROGRESS_OPTIONS = Array.from({ length: 21 }, (_, idx) => `${idx * 5}%`);

const buildSubTaskKey = (
  taskId: number,
  assignmentId: number,
  subTaskId: string
) => `${taskId}-${assignmentId}-${subTaskId}`;

// Helpers for autoLock state in localStorage
const AUTOLOCK_STORAGE_KEY = "progressTab_autoLockMap";
type AutoLockMap = Record<string, boolean>;

function loadAutoLockMap(): AutoLockMap {
  try {
    const raw = localStorage.getItem(AUTOLOCK_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    return {};
  } catch {
    return {};
  }
}

function saveAutoLockMap(map: AutoLockMap) {
  try {
    localStorage.setItem(AUTOLOCK_STORAGE_KEY, JSON.stringify(map));
  } catch {}
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
  NgayNop?: string[];
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

interface ProgressTrackingTabProps {
  data: ProjectProgress | null;
  loading: boolean;
  error: string | null;
  currentUserEmail: string;
  onRefresh?: () => void;
  duAnId?: number;
}

type SelectedNode =
  | { type: "task"; taskId: number }
  | {
      type: "subtask";
      taskId: number;
      assignmentId: number;
      subTaskId: string;
    };

type SortOption =
  | "default"
  | "progress_desc"
  | "progress_asc"
  | "start_date"
  | "end_date";

type StatusFilter =
  | "all"
  | "chưa bắt đầu"
  | "đang làm"
  | "hoàn thành"
  | "trễ hạn";

interface ParsedResult {
  content: string;
  files: string[];
  hasContent: boolean;
  hasFiles: boolean;
}

const getProgressColor = (value: number) => {
  if (value >= 80) return "var(--progress-success)";
  if (value >= 50) return "var(--progress-warning)";
  if (value > 0) return "var(--progress-info)";
  return "var(--progress-muted)";
};

const parseSubTaskResult = (
  result?: ProgressSubTaskResult | null
): ParsedResult => {
  const content =
    typeof result?.noiDung === "string" ? result.noiDung.trim() : "";
  const files = Array.isArray(result?.file)
    ? result.file.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0
      )
    : [];

  return {
    content,
    files,
    hasContent: content.length > 0,
    hasFiles: files.length > 0,
  };
};

const getFileName = (fileUrl: string) => {
  try {
    const parts = fileUrl.split("/");
    const rawName = parts[parts.length - 1] || fileUrl;
    const underscoreIndex = rawName.indexOf("_");
    return underscoreIndex >= 0 ? rawName.slice(underscoreIndex + 1) : rawName;
  } catch {
    return fileUrl;
  }
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

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString("vi-VN");
};

const calculateAverageCompletion = (tasks?: ProgressTask[]) => {
  if (!tasks?.length) return 0;
  const total = tasks.reduce(
    (sum, task) => sum + (task.phamTramHoanThanh || 0),
    0
  );
  return Math.min(100, Math.max(0, Math.round(total / tasks.length)));
};

const getPriorityClass = (value?: string) => {
  const normalized = value?.toLowerCase();
  if (
    normalized === "cao" ||
    normalized === "trungbinh" ||
    normalized === "thap"
  ) {
    return normalized;
  }
  return "";
};

const getPriorityLabel = (value?: string) => {
  if (!value) return "Không rõ";
  switch (value.toLowerCase()) {
    case "cao":
      return "Cao";
    case "trungbinh":
      return "Trung bình";
    case "thap":
      return "Thấp";
    default:
      return value;
  }
};

const ProgressTrackingTab: React.FC<ProgressTrackingTabProps> = ({
  data,
  loading,
  error,
  currentUserEmail,
  onRefresh,
  duAnId,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortOption, setSortOption] = useState<SortOption>("default");
  const [expandedTasks, setExpandedTasks] = useState<Record<number, boolean>>(
    {}
  );
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);
  const [treePaneWidth, setTreePaneWidth] = useState(320);
  const [isResizingTree, setIsResizingTree] = useState(false);
  const [remindingTasks, setRemindingTasks] = useState<Record<number, boolean>>(
    {}
  );
  const [exporting, setExporting] = useState(false);
  const [editingRatingKey, setEditingRatingKey] = useState<string | null>(null);
  const [pendingRating, setPendingRating] = useState<string>("");
  const [ratingSubmittingKey, setRatingSubmittingKey] = useState<string | null>(
    null
  );
  const [ratingOverrides, setRatingOverrides] = useState<
    Record<string, string>
  >({});
  const [lockStateOverrides, setLockStateOverrides] = useState<
    Record<string, number>
  >({});

  const [autoLockMap, setAutoLockMap] = useState<AutoLockMap>(() =>
    loadAutoLockMap()
  );
  const [manualUnlockSuppressed, setManualUnlockSuppressed] = useState<
    Record<string, number>
  >({});
  const [expandedSubmissionHistory, setExpandedSubmissionHistory] = useState<
    Record<string, boolean>
  >({});
  const workspaceRef = useRef<HTMLDivElement | null>(null);

  // State cho phần ưu tiên và deadline
  const [priorityData, setPriorityData] = useState<any>(null);
  const [priorityLoading, setPriorityLoading] = useState(false);
  const [showPriorityPanel, setShowPriorityPanel] = useState(true);

  // Đồng bộ autoLockMap với localStorage khi thay đổi
  useEffect(() => {
    saveAutoLockMap(autoLockMap);
  }, [autoLockMap]);

  // Khi mount, load lại autoLockMap từ localStorage (nếu có)
  useEffect(() => {
    setAutoLockMap(loadAutoLockMap());
  }, []);

  const tasks = useMemo(
    () => data?.danhSachCongViec ?? [],
    [data?.danhSachCongViec]
  );

  // Clear lock state overrides when data refreshes from database
  useEffect(() => {
    setLockStateOverrides({});
  }, [data]);

  // Fetch priority data
  useEffect(() => {
    const fetchPriorityData = async (silent: boolean = false) => {
      if (!data?.duAnID) return;

      if (!silent) {
        setPriorityLoading(true);
      }
      try {
        const response = await api.get(`/DuAn/TienDoUuTien/${data.duAnID}`);
        setPriorityData(response.data);
      } catch (err: any) {
        console.error("Lỗi tải dữ liệu ưu tiên:", err);
      } finally {
        if (!silent) {
          setPriorityLoading(false);
        }
      }
    };

    fetchPriorityData();

    // Auto-reload mỗi 30 giây
    const intervalId = window.setInterval(() => {
      fetchPriorityData(true);
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [data?.duAnID]);

  // Auto-reload tất cả data mỗi 3 giây
  useEffect(() => {
    if (!onRefresh || !duAnId) return;

    const intervalId = window.setInterval(() => {
      // Gọi với silent=true để không hiển loading và tránh scroll
      if (typeof onRefresh === "function") {
        (onRefresh as any)(true);
      }
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [onRefresh, duAnId]);

  // Auto-lock effect: when data / autoLockMap updates, lock eligible subtasks
  useEffect(() => {
    if (!tasks?.length) return;

    let cancelled = false;

    const runAutoLock = async () => {
      for (const task of tasks) {
        const taskCompleted =
          typeof task.trangThai === "string" &&
          task.trangThai.toLowerCase() === "hoàn thành";

        const assignments = task.danhSachPhanCong ?? [];
        for (const assignment of assignments) {
          const subtasks = assignment.noiDungPhanCong ?? [];
          for (const sub of subtasks) {
            if (!sub.SubTaskId) continue;
            const key = buildSubTaskKey(
              task.congViecId,
              assignment.thanhVienId,
              sub.SubTaskId
            );
            if (!autoLockMap[key]) continue;

            const lockState = lockStateOverrides[key] ?? sub.TrangThaiKhoa ?? 0;
            const progress = parsePercentage(sub.TienDoHoanThanh);

            if (lockState !== 1 && (progress >= 100 || taskCompleted)) {
              const suppressed = manualUnlockSuppressed[key];
              if (suppressed !== undefined && suppressed === progress) {
                // user manually unlocked and progress hasn't changed; skip
                continue;
              }

              if (cancelled) return;
              try {
                // call toggle to lock (toggle from 0->1)
                // we await to avoid flooding API with parallel calls
                // Note: handleToggleLock will update lockStateOverrides
                // and clear suppression when it locks
                // eslint-disable-next-line no-await-in-loop
                await handleToggleLock(
                  task.congViecId,
                  assignment,
                  sub as ProgressSubAssignment,
                  true
                );
              } catch (err) {
                // continue on error
                console.error("Auto-lock failed for", key, err);
              }
            }
          }
        }
      }
    };

    runAutoLock();

    return () => {
      cancelled = true;
    };
  }, [tasks, autoLockMap, lockStateOverrides, manualUnlockSuppressed]);

  const filteredTasks = useMemo(() => {
    let result = tasks.slice();

    if (searchTerm.trim()) {
      const keyword = searchTerm.trim().toLowerCase();
      result = result.filter((task) =>
        task.tenCongViec?.toLowerCase().includes(keyword)
      );
    }

    if (statusFilter !== "all") {
      const normalized = statusFilter.toLowerCase();
      result = result.filter(
        (task) => task.trangThai?.toLowerCase() === normalized
      );
    }

    switch (sortOption) {
      case "progress_desc":
        result = result
          .slice()
          .sort(
            (a, b) => (b.phamTramHoanThanh || 0) - (a.phamTramHoanThanh || 0)
          );
        break;
      case "progress_asc":
        result = result
          .slice()
          .sort(
            (a, b) => (a.phamTramHoanThanh || 0) - (b.phamTramHoanThanh || 0)
          );
        break;
      case "start_date":
        result = result
          .slice()
          .sort(
            (a, b) =>
              new Date(a.ngayBd || 0).getTime() -
              new Date(b.ngayBd || 0).getTime()
          );
        break;
      case "end_date":
        result = result
          .slice()
          .sort(
            (a, b) =>
              new Date(a.ngayKt || 0).getTime() -
              new Date(b.ngayKt || 0).getTime()
          );
        break;
      default:
        break;
    }

    return result;
  }, [tasks, searchTerm, statusFilter, sortOption]);

  useEffect(() => {
    if (!filteredTasks.length) {
      setSelectedNode(null);
      return;
    }

    if (selectedNode) {
      const stillExists = filteredTasks.some((task) => {
        if (selectedNode.type === "task") {
          return task.congViecId === selectedNode.taskId;
        }

        if (task.congViecId !== selectedNode.taskId) return false;

        return task.danhSachPhanCong?.some(
          (assignment) =>
            assignment.thanhVienId === selectedNode.assignmentId &&
            assignment.noiDungPhanCong?.some(
              (sub) => sub.SubTaskId === selectedNode.subTaskId
            )
        );
      });

      if (!stillExists) {
        setSelectedNode({ type: "task", taskId: filteredTasks[0].congViecId });
      }
    } else {
      setSelectedNode({ type: "task", taskId: filteredTasks[0].congViecId });
    }
  }, [filteredTasks, selectedNode]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizingTree || !workspaceRef.current) return;
      const bounds = workspaceRef.current.getBoundingClientRect();
      const nextWidth = event.clientX - bounds.left;
      const clampedWidth = Math.min(
        MAX_TREE_WIDTH,
        Math.max(MIN_TREE_WIDTH, nextWidth)
      );
      setTreePaneWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      if (isResizingTree) {
        setIsResizingTree(false);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingTree]);

  const handleToggleTask = (taskId: number) => {
    setExpandedTasks((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const handleSelectTask = (taskId: number) => {
    setExpandedTasks((prev) => ({ ...prev, [taskId]: true }));
    setSelectedNode({ type: "task", taskId });
  };

  const handleSelectSubTask = (
    taskId: number,
    assignmentId: number,
    subTaskId: string
  ) => {
    setExpandedTasks((prev) => ({ ...prev, [taskId]: true }));
    setSelectedNode({ type: "subtask", taskId, assignmentId, subTaskId });
  };

  const handleResizeStart = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsResizingTree(true);
  };

  const handleNavigateToTask = (congViecId: number) => {
    // Expand task
    setExpandedTasks((prev) => ({
      ...prev,
      [congViecId]: true,
    }));

    // Select task
    setSelectedNode({ type: "task", taskId: congViecId });

    // Scroll to detail pane
    setTimeout(() => {
      const detailPane = document.querySelector(`.${styles.detailPane}`);
      if (detailPane) {
        detailPane.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }, 100);
  };

  const handleSendReminder = async (task: ProgressTask) => {
    if (!currentUserEmail) {
      toast.error("Không tìm thấy email người gửi để nhắc hạn.");
      return;
    }

    setRemindingTasks((prev) => ({ ...prev, [task.congViecId]: true }));
    try {
      await api.post("/ThongBao/NhacHanCongViec", {
        congViecID: task.congViecId,
        mailNguoiGui: currentUserEmail,
      });
      toast.success(`Đã gửi nhắc hạn cho "${task.tenCongViec}".`);
    } catch (err: any) {
      console.error("Gửi nhắc hạn thất bại:", err);
      toast.error(
        err?.response?.data?.message || "Không thể gửi nhắc hạn công việc."
      );
    } finally {
      setRemindingTasks((prev) => {
        const next = { ...prev };
        delete next[task.congViecId];
        return next;
      });
    }
  };

  const handleExportToExcel = useCallback(async () => {
    if (!filteredTasks.length) {
      toast.info("Không có công việc nào để xuất.");
      return;
    }

    setExporting(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();

      // Sheet 1: Tổng quan công việc
      const sheet1 = workbook.addWorksheet("Tổng quan");

      // Tiêu đề
      sheet1.mergeCells("A1:H1");
      const titleCell = sheet1.getCell("A1");
      titleCell.value = "BÁO CÁO THEO DÕI TIẾN ĐỘ DỰ ÁN";
      titleCell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
      titleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4472C4" },
      };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      titleCell.border = {
        top: { style: "medium", color: { argb: "FF000000" } },
        left: { style: "medium", color: { argb: "FF000000" } },
        bottom: { style: "medium", color: { argb: "FF000000" } },
        right: { style: "medium", color: { argb: "FF000000" } },
      };
      sheet1.getRow(1).height = 30;

      sheet1.addRow([]);

      // Header row
      const headerRow = sheet1.addRow([
        "ID",
        "Tên công việc",
        "Trạng thái",
        "Ngày bắt đầu",
        "Ngày kết thúc",
        "% hoàn thành",
        "Số phân công",
        "Số subtask",
      ]);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF70AD47" },
      };
      headerRow.alignment = { horizontal: "center", vertical: "middle" };
      headerRow.height = 25;
      headerRow.eachCell((cell) => {
        cell.border = {
          top: { style: "medium", color: { argb: "FF000000" } },
          left: { style: "medium", color: { argb: "FF000000" } },
          bottom: { style: "medium", color: { argb: "FF000000" } },
          right: { style: "medium", color: { argb: "FF000000" } },
        };
      });

      filteredTasks.forEach((task, index) => {
        const assignmentCount = task.danhSachPhanCong?.length ?? 0;
        const subTaskCount =
          task.danhSachPhanCong?.reduce(
            (sum, assignment) =>
              sum + (assignment.noiDungPhanCong?.length ?? 0),
            0
          ) ?? 0;

        const row = sheet1.addRow([
          task.congViecId,
          task.tenCongViec,
          task.trangThai,
          formatDate(task.ngayBd),
          formatDate(task.ngayKt),
          `${parsePercentage(task.phamTramHoanThanh)}%`,
          assignmentCount,
          subTaskCount,
        ]);

        // Màu xen kẽ
        if (index % 2 === 0) {
          row.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF2F2F2" },
          };
        }

        // Màu theo trạng thái
        const statusCell = row.getCell(3);
        const trangThai = task.trangThai?.toLowerCase() || "";
        if (
          trangThai.includes("hoàn thành") ||
          trangThai.includes("hoàn tất")
        ) {
          statusCell.font = { bold: true, color: { argb: "FF70AD47" } };
          statusCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE2EFDA" },
          };
        } else if (trangThai.includes("đang")) {
          statusCell.font = { bold: true, color: { argb: "FFFFC000" } };
          statusCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFF2CC" },
          };
        } else if (trangThai.includes("chưa")) {
          statusCell.font = { color: { argb: "FF808080" } };
          statusCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF2F2F2" },
          };
        } else if (trangThai.includes("trễ")) {
          statusCell.font = { bold: true, color: { argb: "FFFF0000" } };
          statusCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFC7CE" },
          };
        }

        // Màu theo % hoàn thành
        const percentCell = row.getCell(6);
        const percent = parsePercentage(task.phamTramHoanThanh);
        if (percent >= 100) {
          percentCell.font = { bold: true, color: { argb: "FF70AD47" } };
          percentCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE2EFDA" },
          };
        } else if (percent >= 50) {
          percentCell.font = { bold: true, color: { argb: "FFFFC000" } };
          percentCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFF2CC" },
          };
        } else if (percent > 0) {
          percentCell.font = { color: { argb: "FFFF6600" } };
          percentCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFCE4D6" },
          };
        } else {
          percentCell.font = { color: { argb: "FFFF0000" } };
          percentCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFC7CE" },
          };
        }

        // Border
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin", color: { argb: "FFD0D0D0" } },
            left: { style: "thin", color: { argb: "FFD0D0D0" } },
            bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
            right: { style: "thin", color: { argb: "FFD0D0D0" } },
          };
        });
      });

      sheet1.getColumn(1).width = 10;
      sheet1.getColumn(2).width = 40;
      sheet1.getColumn(3).width = 15;
      sheet1.getColumn(4).width = 15;
      sheet1.getColumn(5).width = 15;
      sheet1.getColumn(6).width = 15;
      sheet1.getColumn(7).width = 15;
      sheet1.getColumn(8).width = 15;

      // Sheet 2: Chi tiết phân công
      const sheet2 = workbook.addWorksheet("Chi tiết phân công");

      // Tiêu đề
      sheet2.mergeCells("A1:N1");
      const titleCell2 = sheet2.getCell("A1");
      titleCell2.value = "CHI TIẾT PHÂN CÔNG VÀ SUBTASK";
      titleCell2.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
      titleCell2.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4472C4" },
      };
      titleCell2.alignment = { horizontal: "center", vertical: "middle" };
      titleCell2.border = {
        top: { style: "medium", color: { argb: "FF000000" } },
        left: { style: "medium", color: { argb: "FF000000" } },
        bottom: { style: "medium", color: { argb: "FF000000" } },
        right: { style: "medium", color: { argb: "FF000000" } },
      };
      sheet2.getRow(1).height = 30;

      sheet2.addRow([]);

      // Header row
      const headerRow2 = sheet2.addRow([
        "ID CV",
        "Tên công việc",
        "Thành viên",
        "Chuyên môn",
        "Subtask ID",
        "Mô tả subtask",
        "Ngày PC",
        "Ngày nộp (mới nhất)",
        "Lịch sử nộp báo cáo",
        "Độ ưu tiên",
        "Tiến độ",
        "Đánh giá",
        "Kết quả",
        "File",
      ]);
      headerRow2.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow2.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF70AD47" },
      };
      headerRow2.alignment = { horizontal: "center", vertical: "middle" };
      headerRow2.height = 25;
      headerRow2.eachCell((cell) => {
        cell.border = {
          top: { style: "medium", color: { argb: "FF000000" } },
          left: { style: "medium", color: { argb: "FF000000" } },
          bottom: { style: "medium", color: { argb: "FF000000" } },
          right: { style: "medium", color: { argb: "FF000000" } },
        };
      });

      let detailRowIndex = 0;
      filteredTasks.forEach((task) => {
        const assignments = task.danhSachPhanCong ?? [];

        if (!assignments.length) {
          const row = sheet2.addRow([
            task.congViecId,
            task.tenCongViec,
            "Chưa có",
            "—",
            "—",
            "—",
            "—",
            "—",
            "—",
            "—",
            "—",
            "—",
            "—",
            "—",
          ]);
          if (detailRowIndex % 2 === 0) {
            row.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF8F9FA" },
            };
          }
          row.eachCell((cell) => {
            cell.border = {
              top: { style: "thin", color: { argb: "FFD0D0D0" } },
              left: { style: "thin", color: { argb: "FFD0D0D0" } },
              bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
              right: { style: "thin", color: { argb: "FFD0D0D0" } },
            };
          });
          detailRowIndex++;
          return;
        }

        assignments.forEach((assignment) => {
          const subtasks = assignment.noiDungPhanCong ?? [];

          if (!subtasks.length) {
            const row = sheet2.addRow([
              task.congViecId,
              task.tenCongViec,
              assignment.hoTen,
              assignment.chuyenMon ?? "—",
              "Chưa có",
              "—",
              "—",
              "—",
              "—",
              "—",
              "—",
              "—",
              "—",
              "—",
            ]);
            if (detailRowIndex % 2 === 0) {
              row.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFF8F9FA" },
              };
            }
            row.eachCell((cell) => {
              cell.border = {
                top: { style: "thin", color: { argb: "FFD0D0D0" } },
                left: { style: "thin", color: { argb: "FFD0D0D0" } },
                bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
                right: { style: "thin", color: { argb: "FFD0D0D0" } },
              };
            });
            detailRowIndex++;
            return;
          }

          subtasks.forEach((subtask) => {
            const result = parseSubTaskResult(subtask.KetQuaThucHien);
            const priorityLabel = getPriorityLabel(subtask.DoUuTien);
            const progressLabel =
              typeof subtask.TienDoHoanThanh === "string"
                ? subtask.TienDoHoanThanh
                : `${parsePercentage(subtask.TienDoHoanThanh)}%`;

            // Format ngày nộp mới nhất và lịch sử
            let ngayNopMoiNhat = "—";
            let lichSuNgayNop = "—";
            if (subtask.NgayNop && subtask.NgayNop.length > 0) {
              const sortedDates = subtask.NgayNop.slice().sort(
                (a, b) => new Date(b).getTime() - new Date(a).getTime()
              );

              // Ngày nộp mới nhất
              const latestDate = new Date(sortedDates[0]);
              ngayNopMoiNhat = latestDate.toLocaleString("vi-VN", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              });

              // Tất cả lịch sử ngày nộp
              lichSuNgayNop = sortedDates
                .map((date) => {
                  const d = new Date(date);
                  return d.toLocaleString("vi-VN", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  });
                })
                .join(" | ");
            }

            const row = sheet2.addRow([
              task.congViecId,
              task.tenCongViec,
              assignment.hoTen,
              assignment.chuyenMon ?? "—",
              subtask.SubTaskId,
              subtask.MoTa || "—",
              formatDate(subtask.NgayPC),
              ngayNopMoiNhat,
              lichSuNgayNop,
              priorityLabel,
              progressLabel,
              subtask.DanhGia ?? "—",
              result.content || "—",
              result.files.length ? result.files.join(", ") : "—",
            ]);

            // Màu xen kẽ
            if (detailRowIndex % 2 === 0) {
              row.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFF8F9FA" },
              };
            }

            // Màu theo độ ưu tiên
            const priorityCell = row.getCell(10);
            const priority = subtask.DoUuTien?.toLowerCase() || "";
            if (priority.includes("cao") || priority.includes("high")) {
              priorityCell.font = { bold: true, color: { argb: "FFFF0000" } };
              priorityCell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFFFC7CE" },
              };
            } else if (
              priority.includes("trung") ||
              priority.includes("medium")
            ) {
              priorityCell.font = { bold: true, color: { argb: "FFFFC000" } };
              priorityCell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFFFF2CC" },
              };
            } else if (priority.includes("thấp") || priority.includes("low")) {
              priorityCell.font = { color: { argb: "FF70AD47" } };
              priorityCell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFE2EFDA" },
              };
            }

            // Highlight chuyên môn
            const expertiseCell = row.getCell(4);
            expertiseCell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFD9E1F2" },
            };
            expertiseCell.font = { bold: true };

            // Border
            row.eachCell((cell) => {
              cell.border = {
                top: { style: "thin", color: { argb: "FFD0D0D0" } },
                left: { style: "thin", color: { argb: "FFD0D0D0" } },
                bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
                right: { style: "thin", color: { argb: "FFD0D0D0" } },
              };
            });

            detailRowIndex++;
          });
        });
      });

      sheet2.getColumn(1).width = 10;
      sheet2.getColumn(2).width = 35;
      sheet2.getColumn(3).width = 20;
      sheet2.getColumn(4).width = 20;
      sheet2.getColumn(5).width = 12;
      sheet2.getColumn(6).width = 40;
      sheet2.getColumn(7).width = 15;
      sheet2.getColumn(8).width = 20;
      sheet2.getColumn(9).width = 35;
      sheet2.getColumn(10).width = 15;
      sheet2.getColumn(11).width = 12;
      sheet2.getColumn(12).width = 30;
      sheet2.getColumn(13).width = 40;
      sheet2.getColumn(14).width = 30;

      // Xuất file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `TheoDoiTienDo_${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);

      toast.success("Đã xuất Excel thành công.");
    } catch (err) {
      console.error("Xuất Excel thất bại:", err);
      toast.error("Không thể xuất Excel. Vui lòng thử lại sau.");
    } finally {
      setExporting(false);
    }
  }, [filteredTasks]);

  const totalTasks = tasks.length;
  const totalAssignments = tasks.reduce(
    (sum, task) => sum + (task.danhSachPhanCong?.length ?? 0),
    0
  );
  const totalSubTasks = tasks.reduce((sum, task) => {
    const perTask = task.danhSachPhanCong?.reduce(
      (inner, assignment) => inner + (assignment.noiDungPhanCong?.length ?? 0),
      0
    );
    return sum + (perTask ?? 0);
  }, 0);

  const selectedTask = selectedNode
    ? (tasks.find((task) => task.congViecId === selectedNode.taskId) ?? null)
    : null;

  const selectedSubTask = useMemo(() => {
    if (!selectedTask || selectedNode?.type !== "subtask") return null;
    const assignment = selectedTask.danhSachPhanCong?.find(
      (item) => item.thanhVienId === selectedNode.assignmentId
    );
    const subtask = assignment?.noiDungPhanCong?.find(
      (sub) => sub.SubTaskId === selectedNode.subTaskId
    );
    return assignment && subtask ? { assignment, subtask } : null;
  }, [selectedNode, selectedTask]);

  const getRatingValue = useCallback(
    (
      taskId: number,
      assignmentId: number,
      subTaskId: string | undefined,
      fallback?: string
    ) => {
      if (!subTaskId) return fallback ?? "";
      const key = buildSubTaskKey(taskId, assignmentId, subTaskId);
      return ratingOverrides[key] ?? fallback ?? "";
    },
    [ratingOverrides]
  );

  const selectedSubTaskResult = useMemo(
    () => parseSubTaskResult(selectedSubTask?.subtask.KetQuaThucHien),
    [selectedSubTask]
  );

  const selectedSubTaskProgressInfo = useMemo(() => {
    if (!selectedSubTask || selectedNode?.type !== "subtask") {
      return null;
    }

    const fallbackPercent = parsePercentage(
      selectedSubTask.subtask.TienDoHoanThanh
    );
    const fallbackLabelRaw =
      typeof selectedSubTask.subtask.TienDoHoanThanh === "string" &&
      selectedSubTask.subtask.TienDoHoanThanh.trim().length > 0
        ? selectedSubTask.subtask.TienDoHoanThanh
        : `${fallbackPercent}%`;

    const percent = parsePercentage(fallbackLabelRaw);
    const label = fallbackLabelRaw;

    return { percent, label };
  }, [selectedNode, selectedSubTask]);

  const handleStartEditingRating = (key: string, currentValue: string) => {
    setEditingRatingKey(key);
    setPendingRating(currentValue?.trim() ? currentValue : "");
  };

  const handleCancelEditingRating = () => {
    setEditingRatingKey(null);
    setPendingRating("");
  };

  const handleSubmitRating = async (
    taskId: number,
    assignment: ProgressAssignment,
    subtask: ProgressSubAssignment
  ) => {
    if (!subtask.SubTaskId) {
      toast.error("Không thể xác định subtask để đánh giá.");
      return;
    }

    const key = buildSubTaskKey(
      taskId,
      assignment.thanhVienId,
      subtask.SubTaskId
    );
    const ratingValue = pendingRating.trim();

    if (!ratingValue.length) {
      toast.error("Vui lòng nhập nội dung đánh giá.");
      return;
    }

    setRatingSubmittingKey(key);
    try {
      await api.put("https://localhost:7036/api/PhanCong/DanhGiaTienDo", {
        congViecId: taskId,
        thanhVienId: assignment.thanhVienId,
        subTaskId: subtask.SubTaskId,
        danhGia: ratingValue,
      });

      setRatingOverrides((prev) => ({ ...prev, [key]: ratingValue }));
      toast.success("Cập nhật đánh giá thành công.");
      setEditingRatingKey(null);
      setPendingRating("");
    } catch (err: any) {
      console.error("Cập nhật đánh giá thất bại:", err);
      toast.error(
        err?.response?.data?.message || "Không thể cập nhật đánh giá subtask."
      );
    } finally {
      setRatingSubmittingKey(null);
    }
  };

  const handleToggleLock = async (
    taskId: number,
    assignment: ProgressAssignment,
    subtask: ProgressSubAssignment,
    suppressToast: boolean = false
  ) => {
    if (!subtask.SubTaskId) {
      if (!suppressToast) toast.error("Không thể xác định subtask.");
      return;
    }

    // Get current lock state from override or original data
    const key = buildSubTaskKey(
      taskId,
      assignment.thanhVienId,
      subtask.SubTaskId
    );
    const currentLockState =
      lockStateOverrides[key] ?? subtask.TrangThaiKhoa ?? 0;
    const newLockState = currentLockState === 1 ? 0 : 1;
    const actionText = newLockState === 1 ? "khóa" : "mở khóa";

    try {
      await api.put("https://localhost:7036/api/PhanCong/ToggleLockSubTask", {
        congViecId: taskId,
        thanhVienId: assignment.thanhVienId,
        subTaskId: subtask.SubTaskId,
        trangThaiKhoa: newLockState,
      });

      // Update lock state override to prevent UI flicker
      setLockStateOverrides((prev) => ({
        ...prev,
        [key]: newLockState,
      }));

      // If user explicitly unlocked, suppress auto-lock until progress changes
      if (newLockState === 0) {
        const currentProgress = parsePercentage(subtask.TienDoHoanThanh);
        setManualUnlockSuppressed((prev) => ({
          ...prev,
          [key]: currentProgress,
        }));
      } else {
        // If locked (either manually or automatically), clear any suppression
        setManualUnlockSuppressed((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }

      if (!suppressToast) toast.success(`Đã ${actionText} subtask thành công.`);
    } catch (err: any) {
      console.error(`Lỗi ${actionText} subtask:`, err);
      if (!suppressToast)
        toast.error(
          err?.response?.data?.message || `Không thể ${actionText} subtask.`
        );
    }
  };

  const renderResultDetails = (
    result: ParsedResult,
    emptyText = "Chưa cập nhật."
  ) => (
    <>
      {result.hasContent && (
        <div className={styles.resultContent}>
          {result.content.split(/\n+/).map((line, idx) => (
            <p key={idx}>{line}</p>
          ))}
        </div>
      )}
      {result.hasFiles && (
        <ul className={styles.resultList}>
          {result.files.map((url, idx) => (
            <li key={idx} className={styles.resultItem}>
              <a
                href={url}
                download={getFileName(url)}
                target="_blank"
                rel="noreferrer"
              >
                {getFileName(url)}
              </a>
            </li>
          ))}
        </ul>
      )}
      {!result.hasContent && !result.hasFiles && (
        <div className={styles.noResult}>{emptyText}</div>
      )}
    </>
  );

  if (loading) {
    return <div className={styles.stateInfo}>Đang tải dữ liệu tiến độ...</div>;
  }

  if (error) {
    return <div className={styles.stateError}>{error}</div>;
  }

  if (!data) {
    return (
      <div className={styles.stateInfo}>
        Chưa có dữ liệu theo dõi tiến độ cho dự án này.
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h2>Theo dõi tiến độ dự án</h2>
          <p>
            Quản lý tiến độ công việc, phân công và subtask của dự án theo dạng
            cây tài liệu trực quan.
          </p>
        </div>

        <div className={styles.summaryRow}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Tổng công việc</span>
            <span className={styles.summaryValue}>{totalTasks}</span>
            <span className={styles.summaryDetail}>
              Trạng thái dự án: {data.trangThai || "Chưa cập nhật"}
            </span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Phân công</span>
            <span className={styles.summaryValue}>{totalAssignments}</span>
            <span className={styles.summaryDetail}>
              {totalSubTasks} việc con đang được theo dõi
            </span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Tiến độ trung bình</span>
            <span className={styles.summaryValue}>
              {calculateAverageCompletion(tasks)}%
            </span>
            <span className={styles.summaryDetail}>
              Dựa trên % hoàn thành của từng công việc
            </span>
          </div>
        </div>
      </div>

      <div className={styles.controls}>
        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="🔍 Tìm theo tên công việc"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        <div className={styles.selectGroup}>
          <label htmlFor="progressSort">Sắp xếp</label>
          <select
            id="progressSort"
            value={sortOption}
            onChange={(event) =>
              setSortOption(event.target.value as SortOption)
            }
          >
            <option value="default">Mặc định</option>
            <option value="progress_desc">Tiến độ cao nhất</option>
            <option value="progress_asc">Tiến độ thấp nhất</option>
            <option value="start_date">Ngày bắt đầu sớm nhất</option>
            <option value="end_date">Ngày kết thúc sớm nhất</option>
          </select>
        </div>

        <div className={styles.selectGroup}>
          <label htmlFor="progressStatus">Trạng thái</label>
          <select
            id="progressStatus"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as StatusFilter)
            }
          >
            <option value="all">Tất cả</option>
            <option value="chưa bắt đầu">Chưa bắt đầu</option>
            <option value="đang làm">Đang làm</option>
            <option value="hoàn thành">Hoàn thành</option>
            <option value="trễ hạn">Trễ hạn</option>
          </select>
        </div>
        <div className={styles.actionGroup}>
          <button
            type="button"
            className={styles.exportBtn}
            onClick={handleExportToExcel}
            disabled={exporting}
          >
            {exporting ? "Đang xuất..." : "Xuất Excel"}
          </button>
        </div>
      </div>

      {/* Panel ưu tiên và deadline */}
      {showPriorityPanel && (
        <div className={styles.priorityPanel}>
          <div className={styles.priorityHeader}>
            <h3>🎯 Công việc cần chú ý</h3>
            <button
              className={styles.closePanelBtn}
              onClick={() => setShowPriorityPanel(false)}
              aria-label="Đóng panel"
            >
              ✕
            </button>
          </div>

          {priorityLoading && (
            <div className={styles.priorityLoading}>
              Đang tải dữ liệu ưu tiên...
            </div>
          )}

          {!priorityLoading && !priorityData && (
            <div className={styles.priorityEmpty}>
              Không có dữ liệu ưu tiên cho dự án này.
            </div>
          )}

          {!priorityLoading && priorityData && (
            <>
              <div className={styles.priorityStats}>
                <div className={styles.priorityStat}>
                  <span className={styles.statLabel}>Chưa hoàn thành</span>
                  <span className={styles.statValue}>
                    {priorityData.tongQuan.chuaHoanThanh}
                  </span>
                </div>
                <div className={`${styles.priorityStat} ${styles.urgent}`}>
                  <span className={styles.statLabel}>⚠️ Sắp hết hạn</span>
                  <span className={styles.statValue}>
                    {priorityData.tongQuan.sapHetHan}
                  </span>
                </div>
                <div className={`${styles.priorityStat} ${styles.danger}`}>
                  <span className={styles.statLabel}>🔴 Quá hạn</span>
                  <span className={styles.statValue}>
                    {priorityData.tongQuan.quaHan}
                  </span>
                </div>
              </div>

              <div className={styles.prioritySections}>
                {/* Công việc quá hạn */}
                {priorityData.congViecQuaHan &&
                  priorityData.congViecQuaHan.length > 0 && (
                    <div className={styles.prioritySection}>
                      <h4 className={styles.sectionTitle}>
                        <span className={styles.dangerBadge}>Quá hạn</span>
                      </h4>
                      <div className={styles.taskList}>
                        {priorityData.congViecQuaHan
                          .slice(0, 10)
                          .map((task: any) => (
                            <div
                              key={task.congViecId}
                              className={`${styles.taskItem} ${styles.overdue} ${styles.clickable}`}
                              onClick={() =>
                                handleNavigateToTask(task.congViecId)
                              }
                              role="button"
                              tabIndex={0}
                            >
                              <div className={styles.taskInfo}>
                                <div className={styles.taskHeader}>
                                  <span className={styles.taskName}>
                                    {task.tenCongViec}
                                  </span>
                                  {task.mucDoUuTien && (
                                    <span className={styles.taskBadge}>
                                      {task.mucDoUuTien}
                                    </span>
                                  )}
                                </div>
                                <div className={styles.taskMetadata}>
                                  <span className={styles.taskDetail}>
                                    🔴 Trễ {task.soNgayTreHan} ngày
                                  </span>
                                  <span className={styles.taskDetail}>
                                    📊 {task.phamTramHoanThanh}% hoàn thành
                                  </span>
                                  {task.ngayKetThuc && (
                                    <span className={styles.taskDetail}>
                                      📅 Deadline:{" "}
                                      {formatDate(task.ngayKetThuc)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className={styles.progressMini}>
                                <div
                                  className={styles.progressBar}
                                  style={{
                                    width: `${task.phamTramHoanThanh}%`,
                                  }}
                                ></div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                {/* Công việc sắp hết hạn */}
                {priorityData.congViecSapHetHan &&
                  priorityData.congViecSapHetHan.length > 0 && (
                    <div className={styles.prioritySection}>
                      <h4 className={styles.sectionTitle}>
                        <span className={styles.urgentBadge}>Sắp hết hạn</span>
                      </h4>
                      <div className={styles.taskList}>
                        {priorityData.congViecSapHetHan
                          .slice(0, 10)
                          .map((task: any) => (
                            <div
                              key={task.congViecId}
                              className={`${styles.taskItem} ${styles.upcoming} ${styles.clickable}`}
                              onClick={() =>
                                handleNavigateToTask(task.congViecId)
                              }
                              role="button"
                              tabIndex={0}
                            >
                              <div className={styles.taskInfo}>
                                <div className={styles.taskHeader}>
                                  <span className={styles.taskName}>
                                    {task.tenCongViec}
                                  </span>
                                  {task.mucDoUuTien && (
                                    <span
                                      className={`${styles.taskBadge} ${styles.priority}`}
                                    >
                                      {task.mucDoUuTien}
                                    </span>
                                  )}
                                </div>
                                <div className={styles.taskMetadata}>
                                  <span className={styles.taskDetail}>
                                    ⏰ Còn {task.soNgayConLai} ngày
                                  </span>
                                  <span className={styles.taskDetail}>
                                    📊 {task.phamTramHoanThanh}% hoàn thành
                                  </span>
                                  {task.ngayKetThuc && (
                                    <span className={styles.taskDetail}>
                                      📅 Deadline:{" "}
                                      {formatDate(task.ngayKetThuc)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className={styles.progressMini}>
                                <div
                                  className={styles.progressBar}
                                  style={{
                                    width: `${task.phamTramHoanThanh}%`,
                                  }}
                                ></div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
              </div>
            </>
          )}
        </div>
      )}

      {!showPriorityPanel && (
        <button
          className={styles.showPanelBtn}
          onClick={() => setShowPriorityPanel(true)}
        >
          🎯 Hiện công việc cần chú ý
        </button>
      )}

      {!filteredTasks.length ? (
        <div className={styles.stateInfo}>
          Không có công việc khớp với tiêu chí hiện tại.
        </div>
      ) : (
        <div
          className={`${styles.workspace} ${isResizingTree ? styles.resizing : ""}`}
          ref={workspaceRef}
          style={
            { "--tree-width": `${treePaneWidth}px` } as React.CSSProperties
          }
        >
          <div className={styles.treePane}>
            <div className={styles.treeHeader}>Danh sách công việc</div>
            <div className={styles.treeList}>
              {filteredTasks.map((task) => {
                const expanded = expandedTasks[task.congViecId];
                const subItems = task.danhSachPhanCong?.flatMap((assignment) =>
                  (assignment.noiDungPhanCong || []).map((subtask) => {
                    const trimmedLabel = subtask.MoTa?.trim();
                    const fallbackLabel = subtask.SubTaskId
                      ? `Subtask #${subtask.SubTaskId}`
                      : "Subtask không tên";
                    const label =
                      trimmedLabel && trimmedLabel.length > 0
                        ? trimmedLabel
                        : fallbackLabel;
                    return {
                      assignmentId: assignment.thanhVienId,
                      subTaskId: subtask.SubTaskId,
                      label,
                      memberName: assignment.hoTen,
                      priority: subtask.DoUuTien,
                    };
                  })
                );
                const totalSubItems = subItems?.length ?? 0;
                const completion = parsePercentage(task.phamTramHoanThanh);

                return (
                  <div key={task.congViecId} className={styles.treeNode}>
                    <div className={styles.treeTaskRow}>
                      <button
                        type="button"
                        className={`${styles.toggleBtn} ${expanded ? styles.toggleBtnExpanded : ""}`}
                        onClick={() => handleToggleTask(task.congViecId)}
                        aria-label={
                          expanded ? "Thu gọn công việc" : "Mở rộng công việc"
                        }
                        data-symbol={expanded ? "▾" : "▸"}
                      >
                        <span className={styles.toggleSymbol}>
                          {expanded ? "▾" : "▸"}
                        </span>
                      </button>
                      <button
                        type="button"
                        className={`${styles.nodeLabel} ${
                          selectedNode?.type === "task" &&
                          selectedNode.taskId === task.congViecId
                            ? styles.selectedNode
                            : ""
                        }`}
                        onClick={() => handleSelectTask(task.congViecId)}
                      >
                        <span className={styles.nodeLabelText}>
                          {task.tenCongViec}
                        </span>
                      </button>
                      <span className={styles.badge}>
                        {totalSubItems} việc con · {completion}%
                      </span>
                    </div>

                    {expanded && totalSubItems > 0 && (
                      <ul className={styles.treeChildren}>
                        {subItems!.map((item) => {
                          const isSelected =
                            selectedNode?.type === "subtask" &&
                            selectedNode.taskId === task.congViecId &&
                            selectedNode.assignmentId === item.assignmentId &&
                            selectedNode.subTaskId === item.subTaskId;
                          return (
                            <li
                              key={`${task.congViecId}-${item.assignmentId}-${item.subTaskId}`}
                              className={styles.treeChildRow}
                            >
                              <button
                                type="button"
                                className={`${styles.nodeLabel} ${isSelected ? styles.selectedNode : ""}`}
                                onClick={() =>
                                  handleSelectSubTask(
                                    task.congViecId,
                                    item.assignmentId,
                                    item.subTaskId
                                  )
                                }
                              >
                                <span className={styles.nodeLabelText}>
                                  {item.label}
                                  {item.memberName
                                    ? ` · ${item.memberName}`
                                    : ""}
                                </span>
                              </button>
                              <span
                                className={`${styles.priorityTag} ${styles[getPriorityClass(item.priority)]}`}
                              >
                                {getPriorityLabel(item.priority)}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className={styles.resizeHandle}
            onMouseDown={handleResizeStart}
            role="separator"
            aria-orientation="vertical"
            aria-label="Điều chỉnh độ rộng danh sách công việc"
          />

          <div className={styles.detailPane}>
            {!selectedTask ? (
              <div className={styles.placeholder}>
                Chọn một công việc hoặc subtask để xem chi tiết.
              </div>
            ) : selectedNode?.type === "subtask" && selectedSubTask ? (
              <>
                <div className={styles.detailHeader}>
                  <div>
                    <h3>
                      {selectedSubTask.subtask.MoTa || "Chi tiết subtask"}
                    </h3>
                    <span className={styles.statusPill}>
                      {selectedTask.trangThai}
                    </span>
                  </div>
                </div>

                <div className={styles.detailMeta}>
                  <span>Thuộc công việc: {selectedTask.tenCongViec}</span>
                  <span>
                    Người phụ trách: {selectedSubTask.assignment.hoTen}
                  </span>
                  <span>
                    Ưu tiên:{" "}
                    {getPriorityLabel(selectedSubTask.subtask.DoUuTien)}
                  </span>
                </div>

                <div className={styles.detailSection}>
                  <span className={styles.sectionTitle}>Tiến độ subtask</span>
                  <div className={styles.progressTrack}>
                    <div
                      className={styles.progressFill}
                      style={{
                        width: `${selectedSubTaskProgressInfo?.percent ?? parsePercentage(selectedSubTask.subtask.TienDoHoanThanh)}%`,
                        background: getProgressColor(
                          selectedSubTaskProgressInfo?.percent ??
                            parsePercentage(
                              selectedSubTask.subtask.TienDoHoanThanh
                            )
                        ),
                      }}
                    />
                    <span className={styles.progressTrackValue}>
                      {selectedSubTaskProgressInfo?.label ??
                        `${parsePercentage(selectedSubTask.subtask.TienDoHoanThanh)}%`}
                    </span>
                  </div>
                  <div className={styles.subDetailList}>
                    <div className={styles.subDetailItem}>
                      Ngày phân công:{" "}
                      {formatDate(selectedSubTask.subtask.NgayPC)}
                    </div>

                    {selectedSubTask.subtask.NgayNop &&
                      selectedSubTask.subtask.NgayNop.length > 0 &&
                      (() => {
                        const sortedDates =
                          selectedSubTask.subtask.NgayNop.slice().sort(
                            (a, b) =>
                              new Date(b).getTime() - new Date(a).getTime()
                          );
                        const latestDate = sortedDates[0];
                        const historyKey = buildSubTaskKey(
                          selectedTask.congViecId,
                          selectedSubTask.assignment.thanhVienId,
                          selectedSubTask.subtask.SubTaskId
                        );
                        const isExpanded =
                          expandedSubmissionHistory[historyKey] || false;

                        return (
                          <div className={styles.subDetailItem}>
                            <span className={styles.subDetailLabel}>
                              Lịch sử nộp báo cáo
                            </span>
                            <div style={{ marginTop: "8px" }}>
                              <div
                                style={{
                                  padding: "4px 0",
                                  fontSize: "0.9em",
                                  color: "#555",
                                  fontWeight: 500,
                                }}
                              >
                                🕒{" "}
                                {new Date(latestDate).toLocaleString("vi-VN", {
                                  year: "numeric",
                                  month: "2-digit",
                                  day: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                })}{" "}
                                <span
                                  style={{
                                    color: "#2196F3",
                                    fontSize: "0.85em",
                                  }}
                                >
                                  (Mới nhất)
                                </span>
                              </div>
                              {sortedDates.length > 1 && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedSubmissionHistory((prev) => ({
                                        ...prev,
                                        [historyKey]: !prev[historyKey],
                                      }))
                                    }
                                    style={{
                                      background: "none",
                                      border: "none",
                                      color: "#2196F3",
                                      cursor: "pointer",
                                      fontSize: "0.85em",
                                      padding: "4px 0",
                                      textDecoration: "underline",
                                    }}
                                  >
                                    {isExpanded
                                      ? "▲ Ẩn bớt"
                                      : `▼ Xem thêm ${sortedDates.length - 1} lần nộp trước`}
                                  </button>
                                  {isExpanded && (
                                    <div
                                      style={{
                                        marginLeft: "16px",
                                        marginTop: "4px",
                                        borderLeft: "2px solid #e0e0e0",
                                        paddingLeft: "8px",
                                      }}
                                    >
                                      {sortedDates
                                        .slice(1)
                                        .map((date, index) => (
                                          <div
                                            key={index}
                                            style={{
                                              padding: "4px 0",
                                              fontSize: "0.85em",
                                              color: "#777",
                                            }}
                                          >
                                            🕒{" "}
                                            {new Date(date).toLocaleString(
                                              "vi-VN",
                                              {
                                                year: "numeric",
                                                month: "2-digit",
                                                day: "2-digit",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                                second: "2-digit",
                                              }
                                            )}
                                          </div>
                                        ))}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                    <div className={styles.subDetailItem}>
                      <span className={styles.subDetailLabel}>Đánh giá</span>
                      {selectedNode?.type === "subtask" &&
                      selectedSubTask.subtask.SubTaskId ? (
                        (() => {
                          const ratingKey = buildSubTaskKey(
                            selectedNode.taskId,
                            selectedNode.assignmentId,
                            selectedSubTask.subtask.SubTaskId
                          );
                          const currentRating =
                            getRatingValue(
                              selectedNode.taskId,
                              selectedNode.assignmentId,
                              selectedSubTask.subtask.SubTaskId,
                              selectedSubTask.subtask.DanhGia
                            ) || DEFAULT_RATING;
                          const isEditing = editingRatingKey === ratingKey;
                          const isSubmitting =
                            ratingSubmittingKey === ratingKey;

                          return isEditing ? (
                            <div className={styles.ratingEditor}>
                              <textarea
                                className={styles.ratingTextarea}
                                value={pendingRating}
                                onChange={(event) =>
                                  setPendingRating(event.target.value)
                                }
                                placeholder="Nhập phản hồi đánh giá cho subtask..."
                                rows={3}
                                disabled={isSubmitting}
                              />
                              <div className={styles.ratingActions}>
                                <button
                                  type="button"
                                  className={styles.ratingSaveBtn}
                                  onClick={() =>
                                    handleSubmitRating(
                                      selectedTask.congViecId,
                                      selectedSubTask.assignment,
                                      selectedSubTask.subtask
                                    )
                                  }
                                  disabled={isSubmitting}
                                >
                                  {isSubmitting ? "Đang lưu..." : "Lưu"}
                                </button>
                                <button
                                  type="button"
                                  className={styles.ratingCancelBtn}
                                  onClick={handleCancelEditingRating}
                                  disabled={isSubmitting}
                                >
                                  Huỷ
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className={styles.ratingDisplay}>
                              <div className={styles.ratingValue}>
                                {currentRating}
                              </div>
                              <div className={styles.ratingButtonGroup}>
                                <button
                                  type="button"
                                  className={styles.ratingEditBtn}
                                  onClick={() =>
                                    handleStartEditingRating(
                                      ratingKey,
                                      currentRating
                                    )
                                  }
                                  disabled={
                                    parsePercentage(
                                      selectedSubTask.subtask.TienDoHoanThanh
                                    ) <= 0 ||
                                    (() => {
                                      const key = buildSubTaskKey(
                                        selectedTask.congViecId,
                                        selectedSubTask.assignment.thanhVienId,
                                        selectedSubTask.subtask.SubTaskId
                                      );
                                      const lockState =
                                        lockStateOverrides[key] ??
                                        selectedSubTask.subtask.TrangThaiKhoa;
                                      return lockState === 1;
                                    })()
                                  }
                                  title={(() => {
                                    const key = buildSubTaskKey(
                                      selectedTask.congViecId,
                                      selectedSubTask.assignment.thanhVienId,
                                      selectedSubTask.subtask.SubTaskId
                                    );
                                    const lockState =
                                      lockStateOverrides[key] ??
                                      selectedSubTask.subtask.TrangThaiKhoa;
                                    if (lockState === 1) {
                                      return "Không thể nhập phản hồi khi subtask đã bị khóa";
                                    }
                                    return parsePercentage(
                                      selectedSubTask.subtask.TienDoHoanThanh
                                    ) <= 0
                                      ? "Cần có tiến độ > 0% để nhập phản hồi"
                                      : "";
                                  })()}
                                >
                                  Nhập phản hồi
                                </button>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 12,
                                  }}
                                >
                                  <button
                                    type="button"
                                    className={(() => {
                                      const key = buildSubTaskKey(
                                        selectedTask.congViecId,
                                        selectedSubTask.assignment.thanhVienId,
                                        selectedSubTask.subtask.SubTaskId
                                      );
                                      const lockState =
                                        lockStateOverrides[key] ??
                                        selectedSubTask.subtask.TrangThaiKhoa;
                                      return lockState === 1
                                        ? styles.unlockBtn
                                        : styles.lockBtn;
                                    })()}
                                    onClick={() =>
                                      handleToggleLock(
                                        selectedTask.congViecId,
                                        selectedSubTask.assignment,
                                        selectedSubTask.subtask
                                      )
                                    }
                                    title={(() => {
                                      const key = buildSubTaskKey(
                                        selectedTask.congViecId,
                                        selectedSubTask.assignment.thanhVienId,
                                        selectedSubTask.subtask.SubTaskId
                                      );
                                      const lockState =
                                        lockStateOverrides[key] ??
                                        selectedSubTask.subtask.TrangThaiKhoa;
                                      return lockState === 1
                                        ? "Mở khóa"
                                        : "Khóa subtask";
                                    })()}
                                  >
                                    {(() => {
                                      const key = buildSubTaskKey(
                                        selectedTask.congViecId,
                                        selectedSubTask.assignment.thanhVienId,
                                        selectedSubTask.subtask.SubTaskId
                                      );
                                      const lockState =
                                        lockStateOverrides[key] ??
                                        selectedSubTask.subtask.TrangThaiKhoa;
                                      return lockState === 1
                                        ? "🔓 Mở khoá"
                                        : "🔒 Khoá";
                                    })()}
                                  </button>
                                  {/* Khoá tự động checkbox */}
                                  <label
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 4,
                                      marginBottom: 0,
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={
                                        !!autoLockMap[
                                          buildSubTaskKey(
                                            selectedTask.congViecId,
                                            selectedSubTask.assignment
                                              .thanhVienId,
                                            selectedSubTask.subtask.SubTaskId
                                          )
                                        ]
                                      }
                                      onChange={(e) => {
                                        const key = buildSubTaskKey(
                                          selectedTask.congViecId,
                                          selectedSubTask.assignment
                                            .thanhVienId,
                                          selectedSubTask.subtask.SubTaskId
                                        );
                                        setAutoLockMap((prev) => {
                                          const updated = {
                                            ...prev,
                                            [key]: e.target.checked,
                                          };
                                          saveAutoLockMap(updated);
                                          return updated;
                                        });
                                      }}
                                    />
                                    <span style={{ fontSize: 13 }}>
                                      Khoá tự động
                                    </span>
                                  </label>
                                </div>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <div className={styles.ratingValue}>
                          {selectedSubTask.subtask.DanhGia || DEFAULT_RATING}
                        </div>
                      )}
                    </div>
                    <div className={styles.subDetailItem}>
                      <span className={styles.subDetailLabel}>
                        Kết quả thực hiện
                      </span>
                      <div className={styles.resultBlock}>
                        {renderResultDetails(
                          selectedSubTaskResult,
                          "Chưa có báo cáo nào."
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className={styles.detailHeader}>
                  <div>
                    <h3>{selectedTask.tenCongViec}</h3>
                    <span className={styles.statusPill}>
                      {selectedTask.trangThai}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.reminderBtn}
                    onClick={() => handleSendReminder(selectedTask)}
                    disabled={Boolean(remindingTasks[selectedTask.congViecId])}
                  >
                    {remindingTasks[selectedTask.congViecId]
                      ? "Đang gửi..."
                      : "Nhắc hạn"}
                  </button>
                </div>

                <div className={styles.detailMeta}>
                  <span>Bắt đầu: {formatDate(selectedTask.ngayBd)}</span>
                  <span>Kết thúc: {formatDate(selectedTask.ngayKt)}</span>
                  <span>
                    Tiến độ: {parsePercentage(selectedTask.phamTramHoanThanh)}%
                  </span>
                  <span>
                    Tổng phân công: {selectedTask.danhSachPhanCong?.length ?? 0}
                  </span>
                </div>

                <div className={styles.detailSection}>
                  <span className={styles.sectionTitle}>Tiến độ công việc</span>
                  <div className={styles.progressTrack}>
                    <div
                      className={styles.progressFill}
                      style={{
                        width: `${parsePercentage(selectedTask.phamTramHoanThanh)}%`,
                        background: getProgressColor(
                          parsePercentage(selectedTask.phamTramHoanThanh)
                        ),
                      }}
                    />
                    <span className={styles.progressValue}>
                      {parsePercentage(selectedTask.phamTramHoanThanh)}%
                    </span>
                  </div>
                </div>

                <div className={styles.detailSection}>
                  <span className={styles.sectionTitle}>
                    Danh sách phân công
                  </span>
                  <div className={styles.assignmentList}>
                    {(selectedTask.danhSachPhanCong || []).map((assignment) => (
                      <div
                        key={assignment.thanhVienId}
                        className={styles.assignmentCard}
                      >
                        <div className={styles.assignmentHeader}>
                          <strong>{assignment.hoTen}</strong>
                          <span>
                            {assignment.chuyenMon || "Chưa có chuyên môn"}
                          </span>
                        </div>
                        <div className={styles.assignmentStats}>
                          <span>
                            Tổng việc con:{" "}
                            {assignment.noiDungPhanCong?.length ?? 0}
                          </span>
                        </div>
                        {(assignment.noiDungPhanCong || []).map((subtask) => {
                          const parsedResult = parseSubTaskResult(
                            subtask.KetQuaThucHien
                          );
                          const ratingKey = buildSubTaskKey(
                            selectedTask.congViecId,
                            assignment.thanhVienId,
                            subtask.SubTaskId
                          );
                          const displayRating =
                            getRatingValue(
                              selectedTask.congViecId,
                              assignment.thanhVienId,
                              subtask.SubTaskId,
                              subtask.DanhGia
                            ) || DEFAULT_RATING;
                          const isEditing = editingRatingKey === ratingKey;
                          const isSubmitting =
                            ratingSubmittingKey === ratingKey;
                          return (
                            <div
                              key={subtask.SubTaskId}
                              className={styles.subDetailItem}
                            >
                              <div>
                                <strong>
                                  {subtask.MoTa ||
                                    `Subtask #${subtask.SubTaskId}`}
                                </strong>
                              </div>
                              <div>
                                Ưu tiên: {getPriorityLabel(subtask.DoUuTien)}
                              </div>
                              <div>Ngày PC: {formatDate(subtask.NgayPC)}</div>
                              <div className={styles.progressRow}>
                                <span className={styles.ratingLabel}>
                                  Tiến độ:
                                </span>
                                <div className={styles.progressValue}>
                                  {typeof subtask.TienDoHoanThanh === "string"
                                    ? subtask.TienDoHoanThanh
                                    : `${parsePercentage(subtask.TienDoHoanThanh)}%`}
                                </div>
                              </div>
                              <div className={styles.ratingRow}>
                                <div className={styles.ratingValueWrapper}>
                                  <span className={styles.ratingLabel}>
                                    Đánh giá:
                                  </span>
                                  <div className={styles.ratingValue}>
                                    {displayRating}
                                  </div>
                                </div>
                                {/* Khoá tự động UI */}
                                <div className={styles.autoLockWrapper}>
                                  <label
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 4,
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={!!autoLockMap[ratingKey]}
                                      onChange={(e) => {
                                        setAutoLockMap((prev) => {
                                          const updated = {
                                            ...prev,
                                            [ratingKey]: e.target.checked,
                                          };
                                          saveAutoLockMap(updated);
                                          return updated;
                                        });
                                      }}
                                    />
                                    <span style={{ fontSize: 13 }}>
                                      Khoá tự động
                                    </span>
                                  </label>
                                </div>
                                {subtask.SubTaskId &&
                                  (isEditing ? (
                                    <div className={styles.ratingInline}>
                                      <textarea
                                        className={styles.ratingTextarea}
                                        value={pendingRating}
                                        onChange={(event) =>
                                          setPendingRating(event.target.value)
                                        }
                                        placeholder="Nhập phản hồi đánh giá cho subtask..."
                                        rows={3}
                                        disabled={isSubmitting}
                                      />
                                      <div className={styles.ratingActions}>
                                        <button
                                          type="button"
                                          className={styles.ratingSaveBtn}
                                          onClick={() =>
                                            handleSubmitRating(
                                              selectedTask.congViecId,
                                              assignment,
                                              subtask
                                            )
                                          }
                                          disabled={isSubmitting}
                                        >
                                          {isSubmitting ? "Đang lưu..." : "Lưu"}
                                        </button>
                                        <button
                                          type="button"
                                          className={styles.ratingCancelBtn}
                                          onClick={handleCancelEditingRating}
                                          disabled={isSubmitting}
                                        >
                                          Huỷ
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      className={styles.ratingEditBtn}
                                      onClick={() =>
                                        handleStartEditingRating(
                                          ratingKey,
                                          displayRating
                                        )
                                      }
                                      disabled={
                                        parsePercentage(
                                          subtask.TienDoHoanThanh
                                        ) <= 0 ||
                                        (() => {
                                          const key = buildSubTaskKey(
                                            selectedTask.congViecId,
                                            assignment.thanhVienId,
                                            subtask.SubTaskId
                                          );
                                          const lockState =
                                            lockStateOverrides[key] ??
                                            subtask.TrangThaiKhoa;
                                          return lockState === 1;
                                        })()
                                      }
                                      title={(() => {
                                        const key = buildSubTaskKey(
                                          selectedTask.congViecId,
                                          assignment.thanhVienId,
                                          subtask.SubTaskId
                                        );
                                        const lockState =
                                          lockStateOverrides[key] ??
                                          subtask.TrangThaiKhoa;
                                        if (lockState === 1) {
                                          return "Không thể nhập phản hồi khi subtask đã bị khóa";
                                        }
                                        return parsePercentage(
                                          subtask.TienDoHoanThanh
                                        ) <= 0
                                          ? "Cần có tiến độ > 0% để nhập phản hồi"
                                          : "";
                                      })()}
                                    >
                                      Nhập phản hồi
                                    </button>
                                  ))}
                              </div>
                              <div className={styles.resultBlock}>
                                <span className={styles.subDetailLabel}>
                                  Kết quả
                                </span>
                                {renderResultDetails(parsedResult)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgressTrackingTab;
