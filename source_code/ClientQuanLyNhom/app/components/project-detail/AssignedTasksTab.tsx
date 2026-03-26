import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import styles from "./AssignedTasksTab.module.scss";
import api from "../../apis/api";
import { toast } from "react-toastify";
import AssignedTasksReportModal from "./AssignedTasksReportModal";
import { FiFileText, FiFolder } from "react-icons/fi";

interface AssignedTasksTabProps {
  duAnId: number;
}

interface SubTaskResult {
  noiDung?: string;
  file?: string[];
}

interface AssignedSubTaskType {
  subTaskId: string;
  moTa: string;
  ngayPC: string;
  doUuTien: string;
  ketQuaThucHien?: SubTaskResult | null;
  danhGia: string;
  tienDoHoanThanh: string;
  trangThaiKhoa?: number;
  ngayNop?: string[];
}

interface AssignedTaskItemType {
  congViec: {
    congViecId: number;
    tenCongViec: string;
    trangThai: string;
    ngayBatDau: string;
    ngayKetThuc: string;
  };
  thanhVienId: number;
  soLuongSubTask: number;
  subTasks: AssignedSubTaskType[];
}

interface AssignedTasksResponse {
  message: string;
  duAnId: number;
  tongSoCongViec: number;
  danhSachCongViec: AssignedTaskItemType[];
}

type SelectedNode =
  | { type: "task"; taskId: number }
  | { type: "subtask"; taskId: number; subTaskId: string };

type RawSubTaskResult =
  | {
      NoiDung?: string | null;
      File?: (string | null)[] | null;
      noiDung?: string | null;
      file?: (string | null)[] | null;
    }
  | string[]
  | string
  | null
  | undefined;

type RawAssignedSubTaskType = Omit<AssignedSubTaskType, "ketQuaThucHien"> & {
  ketQuaThucHien?: RawSubTaskResult;
};

type RawAssignedTaskItemType = Omit<AssignedTaskItemType, "subTasks"> & {
  subTasks: RawAssignedSubTaskType[];
};

type RawAssignedTasksResponse = Omit<
  AssignedTasksResponse,
  "danhSachCongViec"
> & {
  danhSachCongViec: RawAssignedTaskItemType[];
};

const normalizeSubTaskResult = (
  raw: RawSubTaskResult
): SubTaskResult | null => {
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

  const result: SubTaskResult = {};

  if (trimmedContent.length > 0) {
    result.noiDung = trimmedContent;
  }

  if (files.length > 0) {
    result.file = files;
  }

  return Object.keys(result).length > 0 ? result : null;
};

const normalizeAssignedTasksResponse = (
  data: RawAssignedTasksResponse
): AssignedTasksResponse => {
  const normalizedTasks = data.danhSachCongViec.map((task) => {
    const normalizedSubTasks = task.subTasks.map((subTask) => {
      const normalizedResult = normalizeSubTaskResult(subTask.ketQuaThucHien);
      return {
        ...subTask,
        ketQuaThucHien: normalizedResult,
      } as AssignedSubTaskType;
    });

    return {
      ...task,
      subTasks: normalizedSubTasks,
    } as AssignedTaskItemType;
  });

  return {
    ...data,
    danhSachCongViec: normalizedTasks,
  };
};

const MIN_TREE_WIDTH = 240;
const MAX_TREE_WIDTH = 520;
const PROGRESS_OPTIONS = Array.from({ length: 21 }, (_, idx) => `${idx * 5}%`);

const AssignedTasksTab: React.FC<AssignedTasksTabProps> = ({ duAnId }) => {
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [assignedData, setAssignedData] =
    useState<AssignedTasksResponse | null>(null);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortOption, setSortOption] = useState<string>("startDate");
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportContext, setReportContext] = useState<{
    congViecId: number;
    subTaskId: string;
    subTaskTitle?: string;
    currentProgress?: string;
    currentReportContent?: string;
  } | null>(null);
  const [deletingFileUrl, setDeletingFileUrl] = useState<string | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Record<number, boolean>>(
    {}
  );
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);
  const [treePaneWidth, setTreePaneWidth] = useState(320);
  const [isResizingTree, setIsResizingTree] = useState(false);
  const [expandedSubmissionHistory, setExpandedSubmissionHistory] = useState<
    Record<string, boolean>
  >({});
  const isFetchingRef = useRef(false);
  const workspaceRef = useRef<HTMLDivElement | null>(null);

  // State cho task sắp hết hạn
  const [deadlineData, setDeadlineData] = useState<any>(null);
  const [deadlineLoading, setDeadlineLoading] = useState(false);
  const [showDeadlinePanel, setShowDeadlinePanel] = useState(true);

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

  useEffect(() => {
    try {
      const stored = localStorage.getItem("user");
      if (!stored) {
        setError(
          "Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại."
        );
        return;
      }
      const parsed = JSON.parse(stored);
      if (!parsed?.UserId) {
        setError("Thiếu mã thành viên. Vui lòng thử lại sau.");
        return;
      }
      setCurrentUserId(Number(parsed.UserId));
    } catch (err) {
      console.error("Error parsing user from localStorage:", err);
      setError("Không thể đọc thông tin người dùng.");
    }
  }, []);

  const fetchAssignedTasks = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!duAnId || !currentUserId) {
        setAssignedData(null);
        return;
      }

      if (isFetchingRef.current) {
        return;
      }

      isFetchingRef.current = true;
      if (!options?.silent) {
        setLoadingTasks(true);
        setError(null);
      }

      try {
        const response = await api.get<RawAssignedTasksResponse>(
          `/PhanCong/GetAllSubTasksInProject/${duAnId}/${currentUserId}`
        );
        console.log("🔍 Raw API Response:", response.data);
        const normalizedData = normalizeAssignedTasksResponse(response.data);
        console.log("🔍 Normalized Data:", normalizedData);
        setAssignedData(normalizedData);
      } catch (err: any) {
        console.error("Error fetching assigned tasks:", err);
        setError(
          err?.response?.data?.message ||
            "Không thể tải danh sách công việc của thành viên này"
        );
        setAssignedData(null);
      } finally {
        if (!options?.silent) {
          setLoadingTasks(false);
        }
        isFetchingRef.current = false;
      }
    },
    [duAnId, currentUserId]
  );

  useEffect(() => {
    fetchAssignedTasks();
  }, [fetchAssignedTasks]);

  // Fetch deadline data
  useEffect(() => {
    const fetchDeadlineData = async (silent: boolean = false) => {
      if (!duAnId || !currentUserId) return;

      if (!silent) {
        setDeadlineLoading(true);
      }
      try {
        const response = await api.get(
          `/PhanCong/TasksSapHetHan/${duAnId}/${currentUserId}`
        );
        setDeadlineData(response.data);
      } catch (err: any) {
        console.error("Lỗi tải deadline data:", err);
      } finally {
        if (!silent) {
          setDeadlineLoading(false);
        }
      }
    };

    fetchDeadlineData();

    // Auto-reload mỗi 30 giây
    const intervalId = window.setInterval(() => {
      fetchDeadlineData(true);
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [duAnId, currentUserId]);

  useEffect(() => {
    if (!duAnId || !currentUserId) return;

    const intervalId = window.setInterval(() => {
      fetchAssignedTasks({ silent: true });
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [duAnId, currentUserId, fetchAssignedTasks]);

  const formatDate = (value?: string) => {
    if (!value) return "-";
    try {
      return new Date(value).toLocaleDateString("vi-VN");
    } catch {
      return value;
    }
  };

  const filteredTasks = useMemo(() => {
    const tasks = assignedData?.danhSachCongViec ?? [];
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const filtered = tasks.filter((task) => {
      const matchesSearch = normalizedSearch
        ? task.congViec.tenCongViec.toLowerCase().includes(normalizedSearch)
        : true;
      const matchesStatus =
        statusFilter === "all"
          ? true
          : task.congViec.trangThai.toLowerCase() ===
            statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });

    const sorted = [...filtered].sort((a, b) => {
      switch (sortOption) {
        case "name":
          return a.congViec.tenCongViec.localeCompare(
            b.congViec.tenCongViec,
            "vi",
            {
              sensitivity: "base",
            }
          );
        case "status": {
          const order = ["chưa bắt đầu", "đang làm", "hoàn thành", "trễ hạn"];
          const statusA = order.indexOf(a.congViec.trangThai.toLowerCase());
          const statusB = order.indexOf(b.congViec.trangThai.toLowerCase());
          return (
            (statusA === -1 ? order.length : statusA) -
            (statusB === -1 ? order.length : statusB)
          );
        }
        case "endDate":
          return (
            new Date(a.congViec.ngayKetThuc || 0).getTime() -
            new Date(b.congViec.ngayKetThuc || 0).getTime()
          );
        case "startDate":
        default:
          return (
            new Date(a.congViec.ngayBatDau || 0).getTime() -
            new Date(b.congViec.ngayBatDau || 0).getTime()
          );
      }
    });

    return sorted;
  }, [assignedData, searchTerm, statusFilter, sortOption]);

  const totalTasks = assignedData?.tongSoCongViec ?? 0;

  useEffect(() => {
    setExpandedTasks((prev) => {
      const next = { ...prev };
      let changed = false;
      filteredTasks.forEach((task) => {
        const key = task.congViec.congViecId;
        if (typeof next[key] === "undefined") {
          next[key] = true;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [filteredTasks]);

  useEffect(() => {
    if (filteredTasks.length === 0) {
      if (selectedNode !== null) {
        setSelectedNode(null);
      }
      return;
    }

    const firstTaskId = filteredTasks[0].congViec.congViecId;
    if (!selectedNode) {
      setSelectedNode({ type: "task", taskId: firstTaskId });
      return;
    }

    const currentTask = filteredTasks.find(
      (task) => task.congViec.congViecId === selectedNode.taskId
    );

    if (!currentTask) {
      setSelectedNode({ type: "task", taskId: firstTaskId });
      return;
    }

    if (selectedNode.type === "subtask") {
      const exists = currentTask.subTasks.some(
        (subtask) => subtask.subTaskId === selectedNode.subTaskId
      );
      if (!exists) {
        setSelectedNode({
          type: "task",
          taskId: currentTask.congViec.congViecId,
        });
      }
    }
  }, [filteredTasks, selectedNode]);

  const selectionContext = useMemo(() => {
    if (filteredTasks.length === 0) {
      return {
        task: null as AssignedTaskItemType | null,
        subTask: null as AssignedSubTaskType | null,
      };
    }

    if (!selectedNode) {
      const task = filteredTasks[0];
      return { task, subTask: null };
    }

    const task = filteredTasks.find(
      (item) => item.congViec.congViecId === selectedNode.taskId
    );

    if (!task) {
      const fallback = filteredTasks[0];
      return { task: fallback, subTask: null };
    }

    if (selectedNode.type === "task") {
      return { task, subTask: null };
    }

    const subTask =
      task.subTasks.find((item) => item.subTaskId === selectedNode.subTaskId) ??
      null;
    return { task, subTask };
  }, [filteredTasks, selectedNode]);

  const selectedTaskItem = selectionContext.task;
  const selectedSubTask = selectionContext.subTask;

  const selectedSubTaskResult = useMemo(() => {
    const result = selectedSubTask?.ketQuaThucHien;
    const content =
      typeof result?.noiDung === "string" ? result.noiDung.trim() : "";
    const files = Array.isArray(result?.file)
      ? result.file.filter(
          (file): file is string =>
            typeof file === "string" && file.trim().length > 0
        )
      : [];
    const hasContent = content.length > 0;
    const hasFiles = files.length > 0;

    return { content, files, hasContent, hasFiles };
  }, [selectedSubTask]);

  const handleReportClick = (
    taskItem: AssignedTaskItemType,
    subtask: AssignedSubTaskType
  ) => {
    if (!currentUserId) {
      toast.error("Không xác định được người dùng hiện tại.");
      return;
    }

    // Lấy nội dung báo cáo cũ nếu có
    const previousContent =
      typeof subtask.ketQuaThucHien?.noiDung === "string"
        ? subtask.ketQuaThucHien.noiDung
        : "";

    setReportContext({
      congViecId: taskItem.congViec.congViecId,
      subTaskId: subtask.subTaskId,
      subTaskTitle: subtask.moTa,
      currentProgress: subtask.tienDoHoanThanh,
      currentReportContent: previousContent,
    });
    setReportModalOpen(true);
  };

  const handleReportClose = () => {
    setReportModalOpen(false);
    setReportContext(null);
  };

  const handleReportSubmitted = () => {
    fetchAssignedTasks();
  };

  const handleDeleteFile = async (
    taskItem: AssignedTaskItemType,
    subtask: AssignedSubTaskType,
    fileUrl: string
  ) => {
    if (!currentUserId) {
      toast.error("Không xác định được người dùng hiện tại.");
      return;
    }

    try {
      setDeletingFileUrl(fileUrl);
      await api.delete("/PhanCong/XoaFileBaoCao", {
        data: {
          congViecId: taskItem.congViec.congViecId,
          thanhVienId: currentUserId,
          subTaskId: subtask.subTaskId,
          fileUrl,
        },
      });
      toast.success("Đã xóa tệp báo cáo.");
      fetchAssignedTasks();
    } catch (error: any) {
      console.error("Delete report file error:", error);
      toast.error(
        error?.response?.data?.message ||
          "Không thể xóa tệp báo cáo. Vui lòng thử lại."
      );
    } finally {
      setDeletingFileUrl(null);
    }
  };

  const getFileName = (fileUrl: string) => {
    try {
      const parts = fileUrl.split("/");
      const rawName = parts[parts.length - 1] || fileUrl;
      const underscoreIndex = rawName.indexOf("_");
      return underscoreIndex >= 0
        ? rawName.slice(underscoreIndex + 1)
        : rawName;
    } catch {
      return fileUrl;
    }
  };

  const handleToggleTask = (taskId: number) => {
    setExpandedTasks((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const handleSelectTask = (taskId: number) => {
    setExpandedTasks((prev) => ({
      ...prev,
      [taskId]: true,
    }));
    setSelectedNode({ type: "task", taskId });
  };

  const handleSelectSubTask = (taskId: number, subTaskId: string) => {
    setExpandedTasks((prev) => ({
      ...prev,
      [taskId]: true,
    }));
    setSelectedNode({ type: "subtask", taskId, subTaskId });
  };

  const handleResizeStart = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsResizingTree(true);
  };

  const handleNavigateToSubTask = (congViecId: number, subTaskId?: string) => {
    // Expand task
    setExpandedTasks((prev) => ({
      ...prev,
      [congViecId]: true,
    }));

    // Select node
    if (subTaskId) {
      setSelectedNode({ type: "subtask", taskId: congViecId, subTaskId });
    } else {
      setSelectedNode({ type: "task", taskId: congViecId });
    }

    // Scroll to detail pane
    setTimeout(() => {
      const detailPane = document.querySelector(`.${styles.detailPane}`);
      if (detailPane) {
        detailPane.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }, 100);
  };

  const getPriorityLabel = (value?: string) => {
    if (!value) return "Không xác định";
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

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h2>Công việc được giao</h2>
          <p>
            Tổng quan các công việc và subtask mà bạn đang phụ trách trong dự án
            này.
          </p>
        </div>
      </div>

      <div className={styles.filters}>
        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="🔍 Tìm theo tên công việc"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className={styles.selectGroup}>
          <label htmlFor="statusFilter">Trạng thái</label>
          <select
            id="statusFilter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Tất cả</option>
            <option value="Chưa bắt đầu">Chưa bắt đầu</option>
            <option value="Đang làm">Đang làm</option>
            <option value="Hoàn thành">Hoàn thành</option>
            <option value="Trễ hạn">Trễ hạn</option>
          </select>
        </div>
        <div className={styles.selectGroup}>
          <label htmlFor="sortOption">Sắp xếp</label>
          <select
            id="sortOption"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
          >
            <option value="startDate">Ngày bắt đầu</option>
            <option value="endDate">Ngày kết thúc</option>
            <option value="name">Tên công việc</option>
            <option value="status">Trạng thái</option>
          </select>
        </div>
      </div>

      {/* Panel task sắp hết hạn */}
      {showDeadlinePanel && (
        <div className={styles.deadlinePanel}>
          <div className={styles.deadlinePanelHeader}>
            <h3>⚠️ Công việc cần chú ý</h3>
            <button
              className={styles.closePanelBtn}
              onClick={() => setShowDeadlinePanel(false)}
              aria-label="Đóng panel"
            >
              ✕
            </button>
          </div>

          {deadlineLoading && (
            <div className={styles.deadlineLoading}>
              Đang tải dữ liệu deadline...
            </div>
          )}

          {!deadlineLoading && !deadlineData && (
            <div className={styles.deadlineEmpty}>
              Không có dữ liệu deadline.
            </div>
          )}

          {!deadlineLoading && deadlineData && (
            <>
              <div className={styles.deadlineStats}>
                <div className={`${styles.deadlineStat} ${styles.urgent}`}>
                  <span className={styles.statLabel}>⚠️ Sắp hết hạn</span>
                  <span className={styles.statValue}>
                    {deadlineData.tongQuan.sapHetHan}
                  </span>
                </div>
                <div className={`${styles.deadlineStat} ${styles.danger}`}>
                  <span className={styles.statLabel}>🔴 Quá hạn</span>
                  <span className={styles.statValue}>
                    {deadlineData.tongQuan.quaHan}
                  </span>
                </div>
              </div>

              <div className={styles.deadlineSections}>
                {/* Task quá hạn */}
                {deadlineData.tasksQuaHan &&
                  deadlineData.tasksQuaHan.length > 0 && (
                    <div className={styles.deadlineSection}>
                      <h4 className={styles.sectionTitle}>
                        <span className={styles.dangerBadge}>Quá hạn</span>
                      </h4>
                      <div className={styles.taskList}>
                        {deadlineData.tasksQuaHan
                          .slice(0, 5)
                          .map((task: any) => (
                            <div
                              key={task.congViecId}
                              className={`${styles.taskItem} ${styles.overdue} ${styles.clickable}`}
                              onClick={() =>
                                handleNavigateToSubTask(
                                  task.congViecId,
                                  task.subTaskId
                                )
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
                                {task.subTaskMoTa && (
                                  <span className={styles.subTaskName}>
                                    📋 {task.subTaskMoTa}
                                  </span>
                                )}
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

                {/* Task sắp hết hạn */}
                {deadlineData.tasksSapHetHan &&
                  deadlineData.tasksSapHetHan.length > 0 && (
                    <div className={styles.deadlineSection}>
                      <h4 className={styles.sectionTitle}>
                        <span className={styles.urgentBadge}>
                          Sắp hết hạn (7 ngày)
                        </span>
                      </h4>
                      <div className={styles.taskList}>
                        {deadlineData.tasksSapHetHan
                          .slice(0, 10)
                          .map((task: any) => (
                            <div
                              key={task.congViecId}
                              className={`${styles.taskItem} ${styles.upcoming} ${styles.clickable}`}
                              onClick={() =>
                                handleNavigateToSubTask(
                                  task.congViecId,
                                  task.subTaskId
                                )
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
                                {task.subTaskMoTa && (
                                  <span className={styles.subTaskName}>
                                    📋 {task.subTaskMoTa}
                                  </span>
                                )}
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

      {!showDeadlinePanel && (
        <button
          className={styles.showPanelBtn}
          onClick={() => setShowDeadlinePanel(true)}
        >
          ⚠️ Hiện công việc cần chú ý
        </button>
      )}

      {error ? (
        <div className={styles.error}>{error}</div>
      ) : loadingTasks ? (
        <div className={styles.stateInfo}>Đang tải dữ liệu công việc...</div>
      ) : !assignedData || assignedData.danhSachCongViec.length === 0 ? (
        <div className={styles.stateInfo}>
          Bạn chưa có công việc nào trong dự án này.
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className={styles.stateInfo}>
          Không có công việc nào khớp với tiêu chí lọc.
        </div>
      ) : (
        <div className={styles.content}>
          <div className={styles.summary}>
            Tổng số công việc: {totalTasks} · Hiển thị: {filteredTasks.length}
          </div>
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
                {filteredTasks.map((taskItem) => {
                  const taskId = taskItem.congViec.congViecId;
                  const expanded = expandedTasks[taskId];
                  return (
                    <div key={taskId} className={styles.treeNode}>
                      <div className={styles.treeTaskRow}>
                        <button
                          type="button"
                          className={`${styles.toggleBtn} ${expanded ? styles.toggleBtnExpanded : ""}`}
                          onClick={() => handleToggleTask(taskId)}
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
                            selectedNode.taskId === taskId
                              ? styles.selectedNode
                              : ""
                          }`}
                          onClick={() => handleSelectTask(taskId)}
                        >
                          <FiFolder className={styles.nodeIcon} />
                          <span className={styles.nodeLabelText}>
                            {taskItem.congViec.tenCongViec}
                          </span>
                        </button>
                        <span className={styles.nodeMeta}>
                          {taskItem.soLuongSubTask} subtask
                        </span>
                      </div>
                      {expanded && (
                        <ul className={styles.treeChildren}>
                          {taskItem.subTasks.length === 0 ? (
                            <li className={styles.emptyNode}>
                              Chưa có subtask nào.
                            </li>
                          ) : (
                            taskItem.subTasks.map((subtask) => {
                              const isSelected =
                                selectedNode?.type === "subtask" &&
                                selectedNode.taskId === taskId &&
                                selectedNode.subTaskId === subtask.subTaskId;
                              return (
                                <li
                                  key={subtask.subTaskId}
                                  className={styles.treeChildRow}
                                >
                                  <button
                                    type="button"
                                    className={`${styles.nodeLabel} ${isSelected ? styles.selectedNode : ""}`}
                                    onClick={() =>
                                      handleSelectSubTask(
                                        taskId,
                                        subtask.subTaskId
                                      )
                                    }
                                  >
                                    <FiFileText className={styles.nodeIcon} />
                                    <span className={styles.nodeLabelText}>
                                      {subtask.moTa ||
                                        `Subtask #${subtask.subTaskId}`}
                                    </span>
                                  </button>
                                  <span
                                    className={`${styles.priorityTag} ${styles[getPriorityClass(subtask.doUuTien)]}`}
                                  >
                                    {getPriorityLabel(subtask.doUuTien)}
                                  </span>
                                </li>
                              );
                            })
                          )}
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
              {!selectedTaskItem ? (
                <div className={styles.placeholder}>
                  Chọn một công việc hoặc subtask để xem chi tiết.
                </div>
              ) : (
                <>
                  <header className={styles.detailHeader}>
                    <div>
                      <h3>{selectedTaskItem.congViec.tenCongViec}</h3>
                      <span className={styles.statusPill}>
                        {selectedTaskItem.congViec.trangThai}
                      </span>
                    </div>
                    <div className={styles.detailDates}>
                      <span>
                        Bắt đầu:{" "}
                        {formatDate(selectedTaskItem.congViec.ngayBatDau)}
                      </span>
                      <span>
                        Kết thúc:{" "}
                        {formatDate(selectedTaskItem.congViec.ngayKetThuc)}
                      </span>
                    </div>
                  </header>

                  <section className={styles.detailSection}>
                    <h4>Thông tin công việc</h4>
                    <dl className={styles.detailList}>
                      <div>
                        <dt>Tổng subtask</dt>
                        <dd>{selectedTaskItem.soLuongSubTask}</dd>
                      </div>
                      <div>
                        <dt>Tiến độ trung bình</dt>
                        <dd>
                          {selectedTaskItem.subTasks.length
                            ? `${Math.round(
                                selectedTaskItem.subTasks.reduce(
                                  (sum, item) => {
                                    const value = parseFloat(
                                      item.tienDoHoanThanh ?? "0"
                                    );
                                    return (
                                      sum + (Number.isNaN(value) ? 0 : value)
                                    );
                                  },
                                  0
                                ) / selectedTaskItem.subTasks.length
                              )}%`
                            : "--"}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  {selectedSubTask ? (
                    <section className={styles.detailSection}>
                      <h4>Chi tiết subtask</h4>
                      <dl className={styles.detailList}>
                        <div>
                          <dt>Mô tả</dt>
                          <dd>{selectedSubTask.moTa || "Không có mô tả"}</dd>
                        </div>
                        <div>
                          <dt>Ngày phân công</dt>
                          <dd>{formatDate(selectedSubTask.ngayPC)}</dd>
                        </div>
                        {selectedSubTask.ngayNop &&
                          selectedSubTask.ngayNop.length > 0 &&
                          (() => {
                            const sortedDates = selectedSubTask.ngayNop
                              .slice()
                              .sort(
                                (a, b) =>
                                  new Date(b).getTime() - new Date(a).getTime()
                              );
                            const latestDate = sortedDates[0];
                            const historyKey = `${selectedTaskItem.congViec.congViecId}-${selectedSubTask.subTaskId}`;
                            const isExpanded =
                              expandedSubmissionHistory[historyKey] || false;

                            return (
                              <div>
                                <dt>Lịch sử nộp báo cáo</dt>
                                <dd>
                                  <div
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "4px",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: "0.9em",
                                        color: "#555",
                                        fontWeight: 500,
                                      }}
                                    >
                                      🕒{" "}
                                      {new Date(latestDate).toLocaleString(
                                        "vi-VN",
                                        {
                                          year: "numeric",
                                          month: "2-digit",
                                          day: "2-digit",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                          second: "2-digit",
                                        }
                                      )}{" "}
                                      <span
                                        style={{
                                          color: "#2196F3",
                                          fontSize: "0.85em",
                                        }}
                                      >
                                        (Mới nhất)
                                      </span>
                                    </span>
                                    {sortedDates.length > 1 && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setExpandedSubmissionHistory(
                                              (prev) => ({
                                                ...prev,
                                                [historyKey]: !prev[historyKey],
                                              })
                                            )
                                          }
                                          style={{
                                            background: "none",
                                            border: "none",
                                            color: "#2196F3",
                                            cursor: "pointer",
                                            fontSize: "0.85em",
                                            padding: "4px 0",
                                            textDecoration: "underline",
                                            textAlign: "left",
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
                                                <span
                                                  key={index}
                                                  style={{
                                                    fontSize: "0.85em",
                                                    color: "#777",
                                                    display: "block",
                                                    padding: "4px 0",
                                                  }}
                                                >
                                                  🕒{" "}
                                                  {new Date(
                                                    date
                                                  ).toLocaleString("vi-VN", {
                                                    year: "numeric",
                                                    month: "2-digit",
                                                    day: "2-digit",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                    second: "2-digit",
                                                  })}
                                                </span>
                                              ))}
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </dd>
                              </div>
                            );
                          })()}
                        <div>
                          <dt>Độ ưu tiên</dt>
                          <dd>
                            <span
                              className={`${styles.priorityTag} ${styles[getPriorityClass(selectedSubTask.doUuTien)]}`}
                            >
                              {getPriorityLabel(selectedSubTask.doUuTien)}
                            </span>
                          </dd>
                        </div>
                        <div>
                          <dt>Tiến độ</dt>
                          <dd>
                            <span className={styles.progressValue}>
                              {selectedSubTask.tienDoHoanThanh || "0%"}
                            </span>
                          </dd>
                        </div>
                        <div>
                          <dt>Đánh giá</dt>
                          <dd>{selectedSubTask.danhGia || "Chưa có"}</dd>
                        </div>
                      </dl>

                      <div className={styles.detailActions}>
                        <button
                          type="button"
                          className={styles.reportBtn}
                          onClick={() =>
                            handleReportClick(selectedTaskItem, selectedSubTask)
                          }
                          disabled={selectedSubTask.trangThaiKhoa === 1}
                          title={
                            selectedSubTask.trangThaiKhoa === 1
                              ? "Subtask đã bị khóa"
                              : ""
                          }
                        >
                          {selectedSubTask.trangThaiKhoa === 1
                            ? "🔒 Đã khóa"
                            : "Báo cáo tiến độ"}
                        </button>
                      </div>

                      <div className={styles.detailResults}>
                        <h5>Kết quả đã gửi</h5>
                        {selectedSubTaskResult.hasContent && (
                          <div className={styles.resultContent}>
                            {selectedSubTaskResult.content
                              .split(/\n+/)
                              .map((line, idx) => (
                                <p key={idx}>{line}</p>
                              ))}
                          </div>
                        )}

                        {selectedSubTaskResult.hasFiles && (
                          <ul className={styles.resultList}>
                            {selectedSubTaskResult.files.map((url, idx) => (
                              <li key={idx} className={styles.resultItem}>
                                <a
                                  href={url}
                                  download={getFileName(url)}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {getFileName(url)}
                                </a>
                                <button
                                  type="button"
                                  className={styles.deleteFileBtn}
                                  onClick={() =>
                                    handleDeleteFile(
                                      selectedTaskItem,
                                      selectedSubTask,
                                      url
                                    )
                                  }
                                  disabled={
                                    deletingFileUrl === url ||
                                    selectedSubTask.trangThaiKhoa === 1
                                  }
                                  title={
                                    selectedSubTask.trangThaiKhoa === 1
                                      ? "Không thể xóa file khi subtask đã bị khóa"
                                      : ""
                                  }
                                >
                                  {deletingFileUrl === url
                                    ? "Đang xóa..."
                                    : "Xóa"}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}

                        {!selectedSubTaskResult.hasContent &&
                          !selectedSubTaskResult.hasFiles && (
                            <div className={styles.noResult}>
                              Chưa có nội dung báo cáo nào.
                            </div>
                          )}
                      </div>
                    </section>
                  ) : (
                    <div className={styles.placeholder}>
                      Chọn một subtask ở cây bên trái để xem chi tiết và gửi báo
                      cáo.
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <AssignedTasksReportModal
        isOpen={reportModalOpen}
        onClose={handleReportClose}
        congViecId={reportContext?.congViecId ?? 0}
        subTaskId={reportContext?.subTaskId ?? ""}
        subTaskTitle={reportContext?.subTaskTitle}
        currentProgress={reportContext?.currentProgress}
        currentReportContent={reportContext?.currentReportContent}
        thanhVienId={currentUserId ?? 0}
        onSubmitted={handleReportSubmitted}
      />
    </div>
  );
};

export default AssignedTasksTab;
