import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import styles from "./KanbanTab.module.scss";
import api from "../../apis/api";
import CreateTaskModal from "./CreateTaskModal";
import EditTaskModal from "./EditTaskModal";
import AddSubTaskModal from "./AddSubTaskModal";
import EditSubTaskModal from "./EditSubTaskModal";
import ConfirmModal from "./ConfirmModal";
import img_task_default from "./task-default.png";

import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDraggable } from "@dnd-kit/core";
import { toast } from "react-toastify";

const toFullUrl = (url: string) => {
  if (!url) return "";
  return url.startsWith("http") ? url : `https://localhost:7036${url}`;
};

const getFileKind = (
  url: string
): "image" | "pdf" | "word" | "excel" | "ppt" | "other" => {
  const ext = url.split(".").pop()?.toLowerCase();
  if (!ext) return "other";
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext))
    return "image";
  if (["doc", "docx"].includes(ext)) return "word";
  if (["xls", "xlsx"].includes(ext)) return "excel";
  if (["ppt", "pptx"].includes(ext)) return "ppt";
  if (ext === "pdf") return "pdf";
  return "other";
};

const getFileIcon = (kind: ReturnType<typeof getFileKind>) => {
  switch (kind) {
    case "image":
      return "🖼️";
    case "pdf":
      return "📕";
    case "word":
      return "📘";
    case "excel":
      return "📗";
    case "ppt":
      return "📙";
    default:
      return "📄";
  }
};

const formatFileName = (raw?: string | null) => {
  if (!raw) return "";
  // strip GUID_ prefix if present
  return raw.replace(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[_-]/i,
    ""
  );
};

const normalizeSubTaskResult = (raw: any): SubTaskResult | null => {
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
  TrangThaiKhoa?: string;
}

interface CommentType {
  binhLuanId: number;
  ThanhVienBinhLuan: string;
  NoiDung: string;
  NgayBinhLuan: string;
  NgayCapNhat: string;
}

interface TaskAttachment {
  fileName: string;
  filePath: string;
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

interface KanbanColumnType {
  name: string;
  status: string;
}

interface DraggableTaskProps {
  task: KanbanTaskType;
  onTaskSelect: (task: KanbanTaskType | null) => void;
  canDrag?: boolean;
}

interface DroppableColumnProps {
  column: KanbanColumnType;
  tasks: KanbanTaskType[];
  onTaskSelect: (task: KanbanTaskType | null) => void;
  onCreateTask: (status: string) => void;
  canDrag: boolean;
  isLeader: boolean;
  onDeleteColumn?: (status: string) => void;
  deletingColumnStatus?: string | null;
  nonDeletableStatuses?: Set<string>;
  projectStatus?: string;
}

interface KanbanTabProps {
  kanbanColumns: KanbanColumnType[];
  selectedTask: KanbanTaskType | null;
  onTaskSelect: (task: KanbanTaskType | null) => void;
  duAnId: number;
  nhomId: number;
  projectStartDate?: string;
  projectEndDate?: string;
  projectStatus?: string;
}

const DraggableTask: React.FC<DraggableTaskProps> = ({
  task,
  onTaskSelect,
  canDrag = true,
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: task.congViecId.toString(),
      disabled: !canDrag,
    });

  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    opacity: isDragging ? 0.7 : 1,
    background: "#ffffff",
    borderRadius: "12px",
    padding: "14px 16px",
    boxShadow: isDragging
      ? "0 6px 14px rgba(0,0,0,0.15)"
      : "0 3px 8px rgba(0,0,0,0.1)",
    marginBottom: "12px",
    cursor: canDrag ? "grab" : "default",
    transition: "all 0.25s ease",
    border: "1px solid #e5e7eb",
    userSelect: "none",
  };

  const getBorderColor = (status: string) => {
    switch (status) {
      case "Đang làm":
        return "#2563eb"; // xanh dương
      case "Hoàn thành":
        return "#16a34a"; // xanh lá
      case "Trễ hạn":
        return "#dc2626"; // đỏ
      default:
        return "#9ca3af"; // xám
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(canDrag ? listeners : {})}
      {...attributes}
      onClick={() => onTaskSelect(task)}
      onMouseEnter={(e) => {
        if (!canDrag) return;
        e.currentTarget.style.transform = "scale(1.02)";
      }}
      onMouseLeave={(e) => {
        if (!canDrag) {
          e.currentTarget.style.transform = "scale(1)";
          return;
        }
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      <img
        src={
          task.anhBia
            ? `https://localhost:7036${task.anhBia}`
            : img_task_default
        }
        alt="Task"
        style={{
          width: "100%",
          height: "70px",
          borderRadius: "8px",
          objectFit: "cover",
          marginBottom: "10px",
        }}
      />

      <h4
        style={{
          margin: "0 0 6px 0",
          padding: "6px 10px",
          border: `2px solid ${getBorderColor(task.trangThai)}`,
          borderRadius: "10px",
          backgroundColor: "#f9fafb",
          color: "#111827",
          fontSize: "15px",
          fontWeight: 600,
          textAlign: "center",
          display: "block",
        }}
      >
        {task.tenCongViec}
      </h4>

      <p
        style={{
          fontSize: "13px",
          color: "#6b21a8",
          textAlign: "center",
          fontWeight: 500,
          marginBottom: "6px",
        }}
      >
        Tiến độ: {task.phamTramHoanThanh}%
      </p>

      <div
        style={{
          background: "#f3f4f6",
          borderRadius: "8px",
          height: "8px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background:
              task.phamTramHoanThanh >= 100
                ? "#16a34a"
                : task.phamTramHoanThanh >= 50
                  ? "#3b82f6"
                  : "#f59e0b",
            width: `${task.phamTramHoanThanh}%`,
            height: "100%",
            borderRadius: "8px",
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
};

const DroppableColumn: React.FC<DroppableColumnProps> = ({
  column,
  tasks,
  onTaskSelect,
  onCreateTask,
  canDrag,
  isLeader,
  onDeleteColumn,
  deletingColumnStatus,
  nonDeletableStatuses,
  projectStatus,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: column.status,
    disabled: !canDrag,
  });

  const isDeletingThisColumn = deletingColumnStatus === column.status;
  const isNonDeletable = nonDeletableStatuses?.has(
    column.status.trim().toLowerCase()
  );
  const canShowDeleteButton = isLeader && onDeleteColumn && !isNonDeletable;

  return (
    <div
      ref={setNodeRef}
      className={styles.kanbanColumn}
      style={{ background: canDrag && isOver ? "#f0f9ff" : undefined }}
    >
      <div className={styles.columnHeader}>
        <h3>{column.name}</h3>
        <div className={styles.columnActions}>
          <span className={styles.taskCount}>{tasks.length}</span>
          {canShowDeleteButton && (
            <button
              type="button"
              className={styles.columnDeleteButton}
              onClick={() => onDeleteColumn(column.status)}
              disabled={isDeletingThisColumn}
            >
              {isDeletingThisColumn ? "..." : "✖"}
            </button>
          )}
        </div>
      </div>
      <div className={styles.taskList}>
        {tasks.map((task) => (
          <DraggableTask
            key={task.congViecId}
            task={task}
            onTaskSelect={onTaskSelect}
            canDrag={canDrag}
          />
        ))}
        {isLeader && column.status.toLowerCase() === "chưa bắt đầu" && (
          <button
            className={styles.addCardButton}
            onClick={() => onCreateTask(column.status)}
            disabled={
              projectStatus === "Hoàn thành" || projectStatus === "Tạm dừng"
            }
            title={
              projectStatus === "Hoàn thành"
                ? "Không thể tạo công việc mới khi dự án đã hoàn thành"
                : projectStatus === "Tạm dừng"
                  ? "Không thể tạo công việc mới khi dự án đang tạm dừng"
                  : ""
            }
          >
            + Thêm công việc
          </button>
        )}
      </div>
    </div>
  );
};

const KanbanTab: React.FC<KanbanTabProps> = ({
  kanbanColumns: initialColumns,
  selectedTask,
  onTaskSelect,
  duAnId,
  nhomId,
  projectStartDate,
  projectEndDate,
  projectStatus,
}) => {
  // Get current user from localStorage
  const getCurrentUser = () => {
    try {
      const userStr = localStorage.getItem("user");
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error("Error parsing user from localStorage:", error);
      return null;
    }
  };

  const currentUser = getCurrentUser();
  const [dynamicColumns, setDynamicColumns] =
    useState<KanbanColumnType[]>(initialColumns);
  const [kanbanTasks, setKanbanTasks] = useState<KanbanTaskType[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState<string>("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showEditTask, setShowEditTask] = useState(false);
  const [selectedTaskForEdit, setSelectedTaskForEdit] =
    useState<KanbanTaskType | null>(null);
  const [taskDetail, setTaskDetail] = useState<KanbanTaskType | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [showAddSubTask, setShowAddSubTask] = useState(false);
  const [showEditSubTask, setShowEditSubTask] = useState(false);
  const [selectedSubTask, setSelectedSubTask] = useState<SubTaskType | null>(
    null
  );
  const [selectedThanhVienId, setSelectedThanhVienId] = useState<number>(0);
  const [reassigningSubTaskId, setReassigningSubTaskId] = useState<
    string | null
  >(null);
  const [isDeletingTask, setIsDeletingTask] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isLeader, setIsLeader] = useState(false);
  const [remindingTask, setRemindingTask] = useState(false);
  const [addingColumn, setAddingColumn] = useState(false);
  const [showAddColumnForm, setShowAddColumnForm] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [deletingColumnStatus, setDeletingColumnStatus] = useState<
    string | null
  >(null);
  const [showConfirmDeleteColumn, setShowConfirmDeleteColumn] = useState(false);
  const [columnToDelete, setColumnToDelete] = useState<string>("");
  const nonDeletableStatuses = useMemo(
    () => new Set(["chưa bắt đầu", "đang làm", "hoàn thành", "trễ hạn"]),
    []
  );
  const [taskSearchTerm, setTaskSearchTerm] = useState<string>("");
  const [taskSortBy, setTaskSortBy] = useState<"name" | "due" | "progress">(
    "name"
  );
  const [taskFilterBy, setTaskFilterBy] = useState<string>("all");

  const [newCommentContent, setNewCommentContent] = useState<string>("");
  const [isBold, setIsBold] = useState<boolean>(false);
  const [isItalic, setIsItalic] = useState<boolean>(false);
  const [isStrikethrough, setIsStrikethrough] = useState<boolean>(false);
  const [comments, setComments] = useState<CommentType[]>([]);
  const [editingComment, setEditingComment] = useState<number | null>(null);
  const [editedComment, setEditedComment] = useState<string>("");
  const [editFormatting, setEditFormatting] = useState({
    isBold: false,
    isItalic: false,
    isStrikethrough: false,
  });
  const [newCommentImages, setNewCommentImages] = useState<File[]>([]);
  const [commentAttachments, setCommentAttachments] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [deletingAttachmentPath, setDeletingAttachmentPath] = useState<
    string | null
  >(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);

  // State cho collapse/expand subtasks
  const [collapsedSubtasks, setCollapsedSubtasks] = useState<
    Record<string, boolean>
  >({});

  const senderEmail =
    currentUser?.Mail ||
    currentUser?.Email ||
    currentUser?.mail ||
    currentUser?.email ||
    "";

  // Toggle function cho collapse/expand subtask
  const toggleSubtask = (subTaskId: string) => {
    setCollapsedSubtasks((prev) => ({
      ...prev,
      [subTaskId]: !prev[subTaskId],
    }));
  };

  const notifyTaskAssignment = useCallback(
    async (congViecId: number, thanhVienId: number) => {
      if (!senderEmail || !thanhVienId) return;
      try {
        await api.post("/ThongBao/ThongBaoCongViecMoi_ChoThanhVien", {
          congViecID: congViecId,
          thanhVienID: thanhVienId,
          mailNguoiGui: senderEmail,
        });
      } catch (error) {
        console.error("Error notifying assigned member:", error);
      }
    },
    [senderEmail]
  );

  const columnsToRender = dynamicColumns?.length
    ? dynamicColumns
    : initialColumns;

  const filteredTasks = useMemo(() => {
    const normalizedSearch = taskSearchTerm.trim().toLowerCase();
    const now = new Date();

    const matchesSearch = (task: KanbanTaskType) => {
      if (!normalizedSearch) return true;
      return task.tenCongViec.toLowerCase().includes(normalizedSearch);
    };

    const matchesFilter = (task: KanbanTaskType) => {
      if (taskFilterBy === "all") return true;
      return task.trangThai?.toLowerCase() === taskFilterBy.toLowerCase();
    };

    const tasks = [...kanbanTasks].filter(matchesSearch).filter(matchesFilter);

    tasks.sort((a, b) => {
      switch (taskSortBy) {
        case "due": {
          const dateA = a.ngayKt
            ? new Date(a.ngayKt).getTime()
            : Number.MAX_SAFE_INTEGER;
          const dateB = b.ngayKt
            ? new Date(b.ngayKt).getTime()
            : Number.MAX_SAFE_INTEGER;
          return dateA - dateB;
        }
        case "progress":
          return (
            Number(b.phamTramHoanThanh || 0) - Number(a.phamTramHoanThanh || 0)
          );
        case "name":
        default:
          return a.tenCongViec.localeCompare(b.tenCongViec, "vi", {
            sensitivity: "base",
          });
      }
    });

    return tasks;
  }, [kanbanTasks, taskFilterBy, taskSearchTerm, taskSortBy]);

  const totalTaskCount = kanbanTasks.length;
  const filteredTaskCount = filteredTasks.length;

  const convertStatusesToColumns = useCallback(
    (statuses: string[] | null | undefined) => {
      const source = Array.isArray(statuses) ? statuses : [];
      if (!source.length) {
        setDynamicColumns(initialColumns);
        return;
      }

      setDynamicColumns(
        source.map((status) => ({
          name: status,
          status,
        }))
      );
    },
    [initialColumns]
  );

  const loadWorkflowColumns = useCallback(async () => {
    if (!duAnId) {
      setDynamicColumns(initialColumns);
      return null;
    }

    try {
      const response = await api.get(`/CongViec/${duAnId}/trangthai`);
      const statuses: string[] = Array.isArray(response.data)
        ? response.data
        : [];
      convertStatusesToColumns(statuses);
      return statuses;
    } catch (error) {
      console.error("Fetch workflow statuses failed:", error);
      setDynamicColumns(initialColumns);
      return null;
    }
  }, [convertStatusesToColumns, duAnId, initialColumns]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeTaskId = active.id as string;
    const overColumnId = over.id as string;

    const activeTask = kanbanTasks.find(
      (t) => t.congViecId.toString() === activeTaskId
    );
    if (!activeTask) return;

    const newStatus = overColumnId;
    const currentStatus = activeTask.trangThai;

    console.log("Drag:", {
      currentStatus,
      newStatus,
      progress: activeTask.phamTramHoanThanh,
    });

    // Validation 1: Không cho kéo "Trễ hạn" về "Đang làm" hoặc "Chưa bắt đầu"
    if (
      currentStatus === "Trễ hạn" &&
      (newStatus === "Đang làm" || newStatus === "Chưa bắt đầu")
    ) {
      toast.warning(
        "Không thể chuyển công việc trễ hạn về trạng thái đang làm hoặc chưa bắt đầu!"
      );
      setActiveId(null);
      return;
    }

    // Validation 2: Không cho kéo về "Chưa bắt đầu" nếu đã ở trạng thái khác (trừ "Đang làm" với 0%)
    if (currentStatus !== "Chưa bắt đầu" && newStatus === "Chưa bắt đầu") {
      // Cho phép kéo từ "Đang làm" về "Chưa bắt đầu" nếu tiến độ = 0%
      if (
        currentStatus === "Đang làm" &&
        (activeTask.phamTramHoanThanh || 0) === 0
      ) {
        // Cho phép
      } else {
        toast.warning(
          currentStatus === "Đang làm"
            ? "Chỉ có thể chuyển về Chưa bắt đầu khi tiến độ là 0%!"
            : "Không thể chuyển công việc về trạng thái chưa bắt đầu!"
        );
        setActiveId(null);
        return;
      }
    }

    // Validation 3: Không cho kéo "Hoàn thành" về các trạng thái khác
    if (currentStatus === "Hoàn thành" && newStatus !== "Hoàn thành") {
      toast.warning(
        "Không thể chuyển công việc đã hoàn thành về trạng thái khác!"
      );
      setActiveId(null);
      return;
    }

    // Validation 4: Chỉ cho kéo sang "Hoàn thành" nếu tiến độ = 100% VÀ không phải "Trễ hạn" VÀ tất cả subtasks đã khoá
    if (newStatus === "Hoàn thành") {
      if ((activeTask.phamTramHoanThanh || 0) < 100) {
        toast.warning(
          "Chỉ có thể chuyển sang Hoàn thành khi tiến độ đạt 100%!"
        );
        setActiveId(null);
        return;
      }
      if (currentStatus === "Trễ hạn") {
        toast.warning(
          "Không thể chuyển công việc trễ hạn sang trạng thái hoàn thành!"
        );
        setActiveId(null);
        return;
      }

      // Check if all subtasks are locked by fetching them (async operation)
      (async () => {
        try {
          const subtasksResponse = await api.get(
            `/PhanCong/GetPhanCongOfCongViec/${activeTask.congViecId}`
          );
          const subtasksData = Array.isArray(subtasksResponse.data)
            ? subtasksResponse.data
            : [];
          const allSubtasks = subtasksData.flatMap(
            (item: any) => item.noiDungPhanCong ?? []
          );

          if (allSubtasks.length > 0) {
            const allLocked = allSubtasks.every((nd: any) => {
              const value = nd.TrangThaiKhoa ?? nd.trangThaiKhoa;
              // Check if it's number 1 (locked) or string "đã khoá"
              return value === 1 || String(value).toLowerCase() === "đã khoá";
            });
            if (!allLocked) {
              toast.warning(
                "Không thể chuyển sang Hoàn thành! Tất cả các công việc con phải được khoá."
              );
              setActiveId(null);
              return;
            }
          }

          // If all validations passed, update the status
          if (activeTask.trangThai !== newStatus) {
            api
              .put("/CongViec/UpdateTrangThai", {
                congViecID: activeTask.congViecId,
                trangThai: newStatus,
              })
              .then(() => {
                setKanbanTasks((prev) =>
                  prev.map((t) =>
                    t.congViecId === activeTask.congViecId
                      ? { ...t, trangThai: newStatus }
                      : t
                  )
                );
                toast.success(`Đã chuyển công việc sang "${newStatus}"`);
              })
              .catch((error) => {
                console.error("Error updating task status:", error);
                toast.error("Không thể cập nhật trạng thái công việc!");
              });
          }
          setActiveId(null);
        } catch (error) {
          console.error("Error checking subtask lock status:", error);
          toast.error("Không thể kiểm tra trạng thái khoá của công việc con!");
          setActiveId(null);
        }
      })();
      return;
    }

    // Validation 5: Chỉ cho kéo sang "Trễ hạn" nếu đã quá ngày kết thúc
    if (newStatus === "Trễ hạn") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (activeTask.ngayKt) {
        const deadline = new Date(activeTask.ngayKt);
        deadline.setHours(0, 0, 0, 0);

        if (deadline >= today) {
          toast.warning(
            "Chỉ có thể chuyển sang Trễ hạn khi công việc đã quá hạn!"
          );
          setActiveId(null);
          return;
        }
      } else {
        toast.warning(
          "Công việc không có ngày kết thúc, không thể đánh dấu trễ hạn!"
        );
        setActiveId(null);
        return;
      }
    }

    if (activeTask.trangThai !== newStatus) {
      // Special handling: Unlock all subtasks when moving from "Chưa bắt đầu" to "Đang làm"
      if (currentStatus === "Chưa bắt đầu" && newStatus === "Đang làm") {
        (async () => {
          try {
            // First, get all subtasks
            const subtasksResponse = await api.get(
              `/PhanCong/GetPhanCongOfCongViec/${activeTask.congViecId}`
            );
            const subtasksData = Array.isArray(subtasksResponse.data)
              ? subtasksResponse.data
              : [];

            // Unlock all subtasks
            for (const assignment of subtasksData) {
              const subtasks = assignment.noiDungPhanCong ?? [];
              for (const subtask of subtasks) {
                const subTaskId = subtask.SubTaskId ?? subtask.subTaskId;
                if (subTaskId) {
                  try {
                    await api.put("/PhanCong/ToggleLockSubTask", {
                      congViecId: activeTask.congViecId,
                      thanhVienId: assignment.thanhVienId,
                      subTaskId: subTaskId,
                      trangThaiKhoa: 0, // 0 = unlock, 1 = lock
                    });
                  } catch (unlockError) {
                    console.error(
                      `Failed to unlock subtask ${subTaskId}:`,
                      unlockError
                    );
                  }
                }
              }
            }

            // Then update task status
            await api.put("/CongViec/UpdateTrangThai", {
              congViecID: activeTask.congViecId,
              trangThai: newStatus,
            });

            setKanbanTasks((prev) =>
              prev.map((t) =>
                t.congViecId === activeTask.congViecId
                  ? { ...t, trangThai: newStatus }
                  : t
              )
            );
            toast.success(
              `Đã chuyển công việc sang "${newStatus}" và mở khoá các công việc con`
            );
          } catch (error) {
            console.error("Error updating task status:", error);
            toast.error("Không thể cập nhật trạng thái công việc!");
          }
          setActiveId(null);
        })();
      } else {
        // Normal status update for other transitions
        api
          .put("/CongViec/UpdateTrangThai", {
            congViecID: activeTask.congViecId,
            trangThai: newStatus,
          })
          .then(() => {
            setKanbanTasks((prev) =>
              prev.map((t) =>
                t.congViecId === activeTask.congViecId
                  ? { ...t, trangThai: newStatus }
                  : t
              )
            );
            toast.success(`Đã chuyển công việc sang "${newStatus}"`);
          })
          .catch((error) => {
            console.error("Error updating task status:", error);
            toast.error("Không thể cập nhật trạng thái công việc!");
          });
        setActiveId(null);
      }
    } else {
      setActiveId(null);
    }
  };

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id as string);
  };

  const fetchTasks = useCallback(async () => {
    if (!duAnId) return;
    try {
      const response = await api.get(`/CongViec/GetCongViecsOfDuAn/${duAnId}`);
      const data = Array.isArray(response.data)
        ? response.data
        : response.data?.congViecs || [];

      // Auto-update status to "Hoàn thành" for tasks with 100% progress (EXCEPT "Trễ hạn") AND all subtasks locked
      for (const task of data) {
        if (
          task.phamTramHoanThanh >= 100 &&
          task.trangThai?.toLowerCase() !== "hoàn thành" &&
          task.trangThai?.toLowerCase() !== "trễ hạn"
        ) {
          try {
            // Check if all subtasks are locked before auto-completing
            const subtasksResponse = await api.get(
              `/PhanCong/GetPhanCongOfCongViec/${task.congViecId}`
            );
            const subtasksData = Array.isArray(subtasksResponse.data)
              ? subtasksResponse.data
              : [];
            const allSubtasks = subtasksData.flatMap(
              (item: any) => item.noiDungPhanCong ?? []
            );

            // If task has subtasks, check if all are locked
            if (allSubtasks.length > 0) {
              // Debug: Log actual values
              console.log(
                "Subtasks lock status for task",
                task.congViecId,
                ":",
                allSubtasks.map((nd: any) => ({
                  TrangThaiKhoa: nd.TrangThaiKhoa,
                  trangThaiKhoa: nd.trangThaiKhoa,
                  converted: String(nd.TrangThaiKhoa ?? nd.trangThaiKhoa ?? ""),
                  toLowerCase: String(
                    nd.TrangThaiKhoa ?? nd.trangThaiKhoa ?? ""
                  ).toLowerCase(),
                }))
              );

              const allLocked = allSubtasks.every((nd: any) => {
                const value = nd.TrangThaiKhoa ?? nd.trangThaiKhoa;
                // Check if it's number 1 (locked) or string "đã khoá"
                return value === 1 || String(value).toLowerCase() === "đã khoá";
              });
              if (!allLocked) {
                console.log(
                  `Skipping auto-complete for task ${task.congViecId}: not all subtasks are locked`
                );
                continue; // Skip this task
              }
            }

            await api.put("/CongViec/UpdateTrangThai", {
              congViecID: task.congViecId,
              trangThai: "Hoàn thành",
            });
            // Update local task status
            task.trangThai = "Hoàn thành";
            console.log(`Auto-updated task ${task.congViecId} to "Hoàn thành"`);
          } catch (error) {
            console.error(
              `Failed to auto-update task ${task.congViecId} to completed:`,
              error
            );
          }
        }

        // Auto-update status back to "Đang làm" for completed tasks with less than 100% progress
        if (
          task.trangThai?.toLowerCase() === "hoàn thành" &&
          task.phamTramHoanThanh < 100
        ) {
          try {
            await api.put("/CongViec/UpdateTrangThai", {
              congViecID: task.congViecId,
              trangThai: "Đang làm",
            });
            // Update local task status
            task.trangThai = "Đang làm";
            console.log(
              `Auto-moved task ${task.congViecId} back to "Đang làm" (progress: ${task.phamTramHoanThanh}%)`
            );
          } catch (error) {
            console.error(
              `Failed to move task ${task.congViecId} back to in-progress:`,
              error
            );
          }
        }
      }

      setKanbanTasks(data);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      setKanbanTasks([]);
    } finally {
      setLoading(false);
    }
  }, [duAnId]);

  // Auto-check và cập nhật trạng thái trễ hạn
  const checkOverdueTasks = useCallback(async () => {
    if (!duAnId || !isLeader) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdueTasks = kanbanTasks.filter((task) => {
      // Bỏ qua nếu đã hoàn thành hoặc đã là trễ hạn
      if (task.trangThai === "Hoàn thành" || task.trangThai === "Trễ hạn") {
        return false;
      }

      // Check nếu có ngày kết thúc và đã quá hạn
      if (task.ngayKt) {
        const deadline = new Date(task.ngayKt);
        deadline.setHours(0, 0, 0, 0);
        return deadline < today;
      }

      return false;
    });

    // Cập nhật từng task trễ hạn
    for (const task of overdueTasks) {
      try {
        await api.put("/CongViec/UpdateTrangThai", {
          congViecID: task.congViecId,
          trangThai: "Trễ hạn",
        });

        // Update local state
        setKanbanTasks((prev) =>
          prev.map((t) =>
            t.congViecId === task.congViecId
              ? { ...t, trangThai: "Trễ hạn" }
              : t
          )
        );
      } catch (error) {
        console.error(
          `Failed to update task ${task.congViecId} to overdue:`,
          error
        );
      }
    }

    if (overdueTasks.length > 0) {
      console.log(`Auto-updated ${overdueTasks.length} task(s) to "Trễ hạn"`);
    }
  }, [duAnId, kanbanTasks, isLeader]);

  // Auto-send reminders for tasks 1 day before deadline
  const checkUpcomingDeadlines = useCallback(async () => {
    if (!duAnId || !isLeader || !currentUser?.Mail) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const tasksNeedingReminder = kanbanTasks.filter((task) => {
      // Chỉ nhắc cho task chưa hoàn thành
      if (task.trangThai === "Hoàn thành" || task.trangThai === "Trễ hạn") {
        return false;
      }

      // Check nếu ngày kết thúc là ngày mai
      if (task.ngayKt) {
        const deadline = new Date(task.ngayKt);
        deadline.setHours(0, 0, 0, 0);
        return deadline.getTime() === tomorrow.getTime();
      }

      return false;
    });

    // Gửi nhắc nhở cho từng task
    for (const task of tasksNeedingReminder) {
      try {
        await api.post("/ThongBao/NhacHanCongViec", {
          congViecID: task.congViecId,
          mailNguoiGui: currentUser.Mail,
        });
        console.log(
          `Auto-sent reminder for task ${task.congViecId} (${task.tenCongViec})`
        );
      } catch (error) {
        console.error(
          `Failed to send reminder for task ${task.congViecId}:`,
          error
        );
      }
    }

    if (tasksNeedingReminder.length > 0) {
      console.log(
        `Auto-sent ${tasksNeedingReminder.length} deadline reminder(s)`
      );
    }
  }, [duAnId, kanbanTasks, isLeader, currentUser?.Mail]);

  useEffect(() => {
    if (!duAnId) return;
    setLoading(true);
    fetchTasks();

    const fetchInterval = window.setInterval(() => {
      fetchTasks();
    }, 3000);

    // Check trễ hạn mỗi 60 giây
    const overdueCheckInterval = window.setInterval(() => {
      checkOverdueTasks();
    }, 60000);

    // Check deadline reminders mỗi 6 giờ (21600000 ms)
    const reminderCheckInterval = window.setInterval(() => {
      checkUpcomingDeadlines();
    }, 21600000);

    // Check ngay khi mount
    checkOverdueTasks();
    checkUpcomingDeadlines();

    return () => {
      window.clearInterval(fetchInterval);
      window.clearInterval(overdueCheckInterval);
      window.clearInterval(reminderCheckInterval);
    };
  }, [duAnId, fetchTasks, checkOverdueTasks, checkUpcomingDeadlines]);

  useEffect(() => {
    if (!nhomId) return;
    const userId = currentUser?.UserId;
    if (userId) {
      api
        .get(`/Nhom/${nhomId}/ThanhVien/${userId}`)
        .then((response) =>
          setIsLeader(response.data?.chucVu === "Trưởng nhóm")
        )
        .catch(() => setIsLeader(false));
    } else {
      setIsLeader(false);
    }
  }, [nhomId, currentUser?.UserId]);

  useEffect(() => {
    if (selectedTask) {
      setTaskDetail(selectedTask);
      // Fetch PhanCong
      api
        .get(`/PhanCong/GetPhanCongOfCongViec/${selectedTask.congViecId}`)
        .then((response) => {
          const data = Array.isArray(response.data) ? response.data : [];
          // Map to PhanCong structure
          const phanCong = data.flatMap((item: any) =>
            (item.noiDungPhanCong ?? []).map((nd: any) => {
              const normalizedResult = normalizeSubTaskResult(
                nd.KetQuaThucHien ?? nd.ketQuaThucHien
              );

              return {
                subTaskId: nd.SubTaskId ?? nd.subTaskId,
                ThanhVienDuocPhanCong: item.hoTen,
                MoTa: nd.MoTa ?? nd.moTa ?? "",
                NgayPC: nd.NgayPC ?? nd.ngayPC ?? "",
                DoUuTien: (nd.DoUuTien ?? nd.doUuTien ?? "")
                  .toString()
                  .toLowerCase(),
                KetQuaThucHien: normalizedResult,
                DanhGia: nd.DanhGia ?? nd.danhGia ?? "Chưa có",
                TienDoHoanThanh:
                  nd.TienDoHoanThanh ?? nd.tienDoHoanThanh ?? "0%",
                TrangThaiKhoa: nd.TrangThaiKhoa ?? nd.trangThaiKhoa ?? "",
              };
            })
          );
          setTaskDetail((prev) =>
            prev ? { ...prev, PhanCong: phanCong } : prev
          );
        })
        .catch((error) => console.error("Error fetching PhanCong:", error));
      // Fetch members
      api
        .get(`/Nhom/${nhomId}/ThanhVien`)
        .then((response) => {
          const data = Array.isArray(response.data) ? response.data : [];
          setMembers(data);
        })
        .catch((error) => console.error("Error fetching members:", error));

      // Fetch BinhLuan
      api
        .get(`/BinhLuan/GetBinhLuansOfCongViec/${selectedTask.congViecId}`)
        .then((response) => {
          const data = Array.isArray(response.data) ? response.data : [];
          setComments(
            data.map((comment: any) => ({
              binhLuanId: comment.binhLuanId,
              ThanhVienBinhLuan: comment.hoTen,
              NoiDung: comment.noiDung,
              NgayBinhLuan: comment.ngayBinhLuan,
              NgayCapNhat: comment.ngayCapNhat || comment.ngayBinhLuan,
            }))
          );
        })
        .catch((error) => console.error("Error fetching comments:", error));

      void loadAttachments(selectedTask.congViecId);
    } else {
      setTaskDetail(null);
      setMembers([]);
      setComments([]);
      setAttachments([]);
    }
  }, [selectedTask, duAnId]);

  const loadAttachments = useCallback(async (congViecId: number) => {
    setAttachmentsLoading(true);
    try {
      const response = await api.get(`/CongViec/GetFileDinhKem/${congViecId}`);
      const files = Array.isArray(response.data?.files)
        ? response.data.files
        : [];
      setAttachments(
        files.map((item: any) => ({
          fileName: item.fileName,
          filePath: item.filePath,
        }))
      );
    } catch (error) {
      console.error("Không thể tải file đính kèm:", error);
      toast.error("Không thể tải danh sách file đính kèm.");
    } finally {
      setAttachmentsLoading(false);
    }
  }, []);

  const handleUploadAttachments = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    if (!taskDetail?.congViecId) {
      toast.error("Không xác định được công việc.");
      return;
    }

    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append("files", file);
    });

    setUploadingAttachments(true);
    try {
      await api.post(
        `/CongViec/UploadFileDinhKem/${taskDetail.congViecId}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      toast.success("Tải lên file đính kèm thành công.");
      event.target.value = "";
      await loadAttachments(taskDetail.congViecId);
    } catch (error: any) {
      console.error("Không thể tải lên file đính kèm:", error);
      toast.error(
        error?.response?.data?.message || "Không thể tải lên file đính kèm."
      );
    } finally {
      setUploadingAttachments(false);
    }
  };

  const handleDeleteAttachment = async (filePath: string) => {
    if (!taskDetail?.congViecId) return;
    setDeletingAttachmentPath(filePath);
    try {
      await api.delete(`/CongViec/DeleteFileDinhKem/${taskDetail.congViecId}`, {
        params: {
          filePath,
        },
      });
      toast.success("Đã xóa file đính kèm.");
      await loadAttachments(taskDetail.congViecId);
    } catch (error: any) {
      console.error("Không thể xóa file đính kèm:", error);
      toast.error(
        error?.response?.data?.message || "Không thể xóa file đính kèm."
      );
    } finally {
      setDeletingAttachmentPath(null);
    }
  };

  const refreshComments = (congViecId?: number) => {
    const targetId = congViecId ?? taskDetail?.congViecId;
    if (!targetId) return;

    api
      .get(`/BinhLuan/GetBinhLuansOfCongViec/${targetId}`)
      .then((response) => {
        const data = Array.isArray(response.data) ? response.data : [];
        setComments(
          data.map((comment: any) => ({
            binhLuanId: comment.binhLuanId,
            ThanhVienBinhLuan: comment.hoTen,
            NoiDung: comment.noiDung,
            NgayBinhLuan: comment.ngayBinhLuan,
            NgayCapNhat: comment.ngayCapNhat || comment.ngayBinhLuan,
          }))
        );
      })
      .catch((error) => console.error("Error refreshing comments:", error));
  };

  useEffect(() => {
    const congViecId = taskDetail?.congViecId;
    if (!congViecId) return;

    const intervalId = window.setInterval(() => {
      refreshComments(congViecId);
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [taskDetail?.congViecId]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      await loadWorkflowColumns();
      if (!isMounted) {
        return;
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [loadWorkflowColumns]);

  const handleAddColumn = async () => {
    if (!isLeader) return;
    if (!duAnId) {
      toast.error("Không tìm thấy dự án để thêm cột mới.");
      return;
    }

    const currentColumns = columnsToRender || [];
    const newStatus = newColumnName.trim();
    if (!newStatus) {
      toast.info("Vui lòng nhập tên cột.");
      return;
    }

    const normalizedExisting = new Set(
      currentColumns.map((col) => col.status.toLowerCase())
    );

    if (normalizedExisting.has(newStatus.toLowerCase())) {
      toast.info("Trạng thái này đã tồn tại.");
      return;
    }

    try {
      setAddingColumn(true);
      await api.post(`/CongViec/${duAnId}/trangthai`, newStatus, {
        headers: {
          "Content-Type": "application/json",
        },
      });
      toast.success("Đã thêm cột mới thành công.");
      setNewColumnName("");
      setShowAddColumnForm(false);
      await loadWorkflowColumns();
    } catch (error: any) {
      console.error("Không thể thêm cột mới:", error);
      toast.error(error?.response?.data?.message || "Không thể thêm cột mới.");
    } finally {
      setAddingColumn(false);
    }
  };

  const handleDeleteColumn = (status: string) => {
    if (!isLeader) return;
    if (!duAnId) {
      toast.error("Không tìm thấy dự án để xoá cột.");
      return;
    }

    if (nonDeletableStatuses.has(status.trim().toLowerCase())) {
      toast.info("Không thể xoá cột mặc định.");
      return;
    }

    setColumnToDelete(status);
    setShowConfirmDeleteColumn(true);
  };

  const confirmDeleteColumn = async () => {
    if (!columnToDelete || !duAnId) return;

    try {
      setDeletingColumnStatus(columnToDelete);
      await api.delete(
        `/CongViec/${duAnId}/trangthai/${encodeURIComponent(columnToDelete)}`
      );
      toast.success("Đã xoá cột thành công.");
      setShowConfirmDeleteColumn(false);
      setColumnToDelete("");
      await loadWorkflowColumns();
    } catch (error: any) {
      console.error("Không thể xoá cột:", error);
      toast.error(error?.response?.data?.message || "Không thể xoá cột.");
    } finally {
      setDeletingColumnStatus(null);
    }
  };

  const cancelDeleteColumn = () => {
    if (deletingColumnStatus) return;
    setShowConfirmDeleteColumn(false);
    setColumnToDelete("");
  };

  const renderCommentContent = (content: string) => {
    let renderedContent = content;
    // Basic Markdown parsing for bold, italic, strikethrough
    renderedContent = renderedContent.replace(
      /\*\*(.*?)\*\*/g,
      "<strong>$1</strong>"
    ); // Bold
    renderedContent = renderedContent.replace(/\*(.*?)\*/g, "<em>$1</em>"); // Italic
    renderedContent = renderedContent.replace(/\~\~(.*?)\~\~/g, "<s>$1</s>"); // Strikethrough
    return <span dangerouslySetInnerHTML={{ __html: renderedContent }} />;
  };

  const handleUpdateComment = async (binhLuanId: number) => {
    if (!editedComment.trim() || !selectedTask) return;

    try {
      await api.put(`/BinhLuan/UpdateBinhLuan/${binhLuanId}`, {
        noiDung: editedComment,
      });

      refreshComments(selectedTask.congViecId);

      setEditingComment(null);
      setEditedComment("");
      setEditFormatting({
        isBold: false,
        isItalic: false,
        isStrikethrough: false,
      });
    } catch (error) {
      console.error("Lỗi khi cập nhật bình luận:", error);
      toast.error("Có lỗi xảy ra khi cập nhật bình luận");
    }
  };

  const handleDeleteComment = async (binhLuanId: number) => {
    if (!selectedTask) return;

    try {
      await api.delete(`/BinhLuan/DeleteBinhLuan/${binhLuanId}`);

      refreshComments(selectedTask.congViecId);
    } catch (error) {
      console.error("Lỗi khi xóa bình luận:", error);
      toast.error("Có lỗi xảy ra khi xóa bình luận");
    }
  };

  const handleDeleteTask = () => {
    if (!taskDetail || isDeletingTask) return;
    setShowConfirmDelete(true);
  };

  const confirmDeleteTask = async () => {
    if (!taskDetail || isDeletingTask) return;
    try {
      setIsDeletingTask(true);
      await api.delete(`/CongViec/DeleteCongViec/${taskDetail.congViecId}`);

      setKanbanTasks((prev) =>
        prev.filter((task) => task.congViecId !== taskDetail.congViecId)
      );
      onTaskSelect(null);
      setTaskDetail(null);
      setComments([]);
      setMembers([]);
      setSelectedTaskForEdit(null);
      setShowEditTask(false);
      setShowConfirmDelete(false);
      toast.success("Xóa công việc thành công");
    } catch (error) {
      console.error("Lỗi khi xóa công việc:", error);
      toast.error("Có lỗi xảy ra khi xóa công việc");
    } finally {
      setIsDeletingTask(false);
    }
  };

  const cancelDeleteTask = () => {
    if (isDeletingTask) return;
    setShowConfirmDelete(false);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className={styles.kanbanBoard}>
        <div className={styles.boardControls}>
          <div className={styles.controlGroup}>
            <label htmlFor="kanban-search">Tìm kiếm</label>
            <input
              id="kanban-search"
              type="text"
              placeholder="Nhập tên công việc"
              value={taskSearchTerm}
              onChange={(event) => setTaskSearchTerm(event.target.value)}
            />
          </div>
          <div className={styles.controlGroup}>
            <label htmlFor="kanban-sort">Sắp xếp</label>
            <select
              id="kanban-sort"
              value={taskSortBy}
              onChange={(event) =>
                setTaskSortBy(event.target.value as typeof taskSortBy)
              }
            >
              <option value="name">Theo tên</option>
              <option value="due">Ngày hết hạn</option>
              <option value="progress">Tiến độ</option>
            </select>
          </div>
          <div className={styles.controlGroup}>
            <label htmlFor="kanban-filter">Lọc</label>
            <select
              id="kanban-filter"
              value={taskFilterBy}
              onChange={(event) => setTaskFilterBy(event.target.value)}
            >
              <option value="all">Tất cả trạng thái</option>
              {columnsToRender.map((col) => (
                <option key={col.status} value={col.status}>
                  {col.name}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.boardStats}>
            <span>
              {filteredTaskCount}/{totalTaskCount} công việc
            </span>
          </div>
        </div>
        <div className={styles.kanbanColumns}>
          {columnsToRender?.map((col: KanbanColumnType) => (
            <DroppableColumn
              key={col.status}
              column={col}
              tasks={filteredTasks.filter(
                (task) => task.trangThai === col.status
              )}
              onTaskSelect={onTaskSelect}
              onCreateTask={(status: string) => {
                if (!isLeader) return;
                setSelectedColumn(status);
                setShowCreateTask(true);
              }}
              canDrag={isLeader}
              isLeader={isLeader}
              onDeleteColumn={handleDeleteColumn}
              deletingColumnStatus={deletingColumnStatus}
              nonDeletableStatuses={nonDeletableStatuses}
              projectStatus={projectStatus}
            />
          ))}
          {isLeader && (
            <div className={styles.addColumn}>
              {showAddColumnForm ? (
                <div className={styles.addColumnForm}>
                  <input
                    className={styles.addColumnInput}
                    placeholder="Nhập tên cột"
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    disabled={addingColumn}
                  />
                  <div className={styles.addColumnActions}>
                    <button
                      className={styles.addColumnSubmit}
                      onClick={handleAddColumn}
                      disabled={addingColumn}
                    >
                      {addingColumn ? "Đang thêm..." : "Thêm"}
                    </button>
                    <button
                      className={styles.addColumnCancel}
                      onClick={() => {
                        if (addingColumn) return;
                        setShowAddColumnForm(false);
                        setNewColumnName("");
                      }}
                      disabled={addingColumn}
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className={styles.addColumnButton}
                  onClick={() => setShowAddColumnForm(true)}
                >
                  + Thêm cột mới
                </button>
              )}
            </div>
          )}
        </div>

        <DragOverlay>
          {activeId ? (
            <DraggableTask
              task={
                kanbanTasks.find((t) => t.congViecId.toString() === activeId)!
              }
              onTaskSelect={onTaskSelect}
              canDrag={isLeader}
            />
          ) : null}
        </DragOverlay>
      </div>

      {taskDetail && (
        <div className={styles.taskDetailModal}>
          <div className={styles.taskDetailContent}>
            <button
              className={styles.closeBtn}
              onClick={() => onTaskSelect(null)}
            >
              ✖
            </button>

            <div className={styles.modalHeader}>
              <h2>{taskDetail.tenCongViec}</h2>
            </div>

            {taskDetail.anhBia ? (
              <div className={styles.modalCover}>
                <img
                  src={`https://localhost:7036${taskDetail.anhBia}`}
                  alt="Task cover"
                />
              </div>
            ) : (
              <div className={styles.modalCover}>
                <img src={img_task_default} alt="Default Task" />
              </div>
            )}

            <div className={styles.modalGrid}>
              <div className={styles.mainColumn}>
                <div className={styles.section}>
                  <h4>Thông tin chung</h4>
                  <div className={styles.detailItem}>
                    <span className={styles.label}>Trạng thái:</span>
                    <span className={styles.status}>
                      {taskDetail.trangThai}
                    </span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.label}>Ngày bắt đầu:</span>
                    <span>{taskDetail.ngayBd}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.label}>Ngày kết thúc:</span>
                    <span>{taskDetail.ngayKt}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.label}>Phần trăm hoàn thành:</span>
                    <div className={styles.percentageBar}>
                      <div
                        className={styles.percentageFill}
                        style={{ width: `${taskDetail.phamTramHoanThanh}%` }}
                      >
                        <span className={styles.percentageText}>
                          {taskDetail.phamTramHoanThanh}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h4>Phân công công việc</h4>
                    {isLeader && (
                      <button
                        className={styles.addSubTaskBtn}
                        onClick={() => setShowAddSubTask(true)}
                        disabled={
                          taskDetail?.trangThai?.toLowerCase() ===
                            "hoàn thành" ||
                          (taskDetail?.phamTramHoanThanh || 0) >= 100
                        }
                        title={
                          taskDetail?.trangThai?.toLowerCase() === "hoàn thành"
                            ? "Không thể thêm công việc con cho công việc đã hoàn thành"
                            : (taskDetail?.phamTramHoanThanh || 0) >= 100
                              ? "Không thể thêm công việc con cho công việc đã hoàn thành 100%"
                              : ""
                        }
                      >
                        + Thêm công việc con
                      </button>
                    )}
                  </div>
                  <div className={styles.assignments}>
                    {taskDetail.PhanCong?.map((pc, idx) => (
                      <div key={idx} className={styles.assignmentCard}>
                        <div className={styles.assignmentHeader}>
                          <div className={styles.assignmentInfo}>
                            <span className={styles.memberAvatar}>
                              {pc.ThanhVienDuocPhanCong[0]}
                            </span>
                            <div className={styles.memberNameContainer}>
                              {reassigningSubTaskId === pc.subTaskId ? (
                                <select
                                  className={styles.memberSelect}
                                  defaultValue={
                                    members.find(
                                      (m) =>
                                        m.hoTen === pc.ThanhVienDuocPhanCong
                                    )?.thanhVienId || ""
                                  }
                                  onChange={(e) => {
                                    const thanhVienMoiId = parseInt(
                                      e.target.value,
                                      10
                                    );
                                    const thanhVienCu = members.find(
                                      (m) =>
                                        m.hoTen === pc.ThanhVienDuocPhanCong
                                    );
                                    if (
                                      !thanhVienCu ||
                                      !taskDetail ||
                                      !pc.subTaskId
                                    )
                                      return;

                                    const payload = {
                                      congViecId: taskDetail.congViecId,
                                      thanhVienCuId: thanhVienCu.thanhVienId,
                                      thanhVienMoiId: thanhVienMoiId,
                                      subTaskIds: [pc.subTaskId],
                                    };

                                    api
                                      .put(
                                        "/PhanCong/ChuyenNguoiPhanCong",
                                        payload
                                      )
                                      .then(() => {
                                        toast.success(
                                          "Chuyển người phân công thành công."
                                        );
                                        void notifyTaskAssignment(
                                          taskDetail.congViecId,
                                          thanhVienMoiId
                                        );
                                        // Refresh subtasks
                                        api
                                          .get(
                                            `/PhanCong/GetPhanCongOfCongViec/${taskDetail.congViecId}`
                                          )
                                          .then((response) => {
                                            const data = Array.isArray(
                                              response.data
                                            )
                                              ? response.data
                                              : [];
                                            const phanCong = data.flatMap(
                                              (item: any) =>
                                                (
                                                  item.noiDungPhanCong ?? []
                                                ).map((nd: any) => {
                                                  const normalizedResult =
                                                    normalizeSubTaskResult(
                                                      nd.KetQuaThucHien ??
                                                        nd.ketQuaThucHien
                                                    );

                                                  return {
                                                    subTaskId:
                                                      nd.SubTaskId ??
                                                      nd.subTaskId,
                                                    ThanhVienDuocPhanCong:
                                                      item.hoTen,
                                                    MoTa:
                                                      nd.MoTa ?? nd.moTa ?? "",
                                                    NgayPC:
                                                      nd.NgayPC ??
                                                      nd.ngayPC ??
                                                      "",
                                                    DoUuTien: (
                                                      nd.DoUuTien ??
                                                      nd.doUuTien ??
                                                      ""
                                                    )
                                                      .toString()
                                                      .toLowerCase(),
                                                    KetQuaThucHien:
                                                      normalizedResult,
                                                    DanhGia:
                                                      nd.DanhGia ??
                                                      nd.danhGia ??
                                                      "Chưa có",
                                                    TienDoHoanThanh:
                                                      nd.TienDoHoanThanh ??
                                                      nd.tienDoHoanThanh ??
                                                      "0%",
                                                  };
                                                })
                                            );
                                            setTaskDetail((prev) =>
                                              prev
                                                ? {
                                                    ...prev,
                                                    PhanCong: phanCong,
                                                  }
                                                : prev
                                            );
                                          });
                                      })
                                      .catch((err) => {
                                        console.error(
                                          "Failed to reassign subtask",
                                          err
                                        );
                                        toast.error(
                                          "Chuyển người phân công thất bại."
                                        );
                                      })
                                      .finally(() => {
                                        setReassigningSubTaskId(null);
                                      });
                                  }}
                                  onBlur={() => setReassigningSubTaskId(null)}
                                  autoFocus
                                >
                                  {members.map((member) => (
                                    <option
                                      key={member.thanhVienId}
                                      value={member.thanhVienId}
                                    >
                                      {member.hoTen} -{" "}
                                      {member.chuyenMon.tenChuyenMon}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <>
                                  <span className={styles.memberName}>
                                    {pc.ThanhVienDuocPhanCong}
                                  </span>
                                  {isLeader && (
                                    <button
                                      className={styles.reassignBtn}
                                      onClick={() =>
                                        setReassigningSubTaskId(pc.subTaskId!)
                                      }
                                      disabled={!isLeader}
                                    >
                                      + Thay đổi người phân công
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                            <span
                              className={`${styles.priority} ${styles[pc.DoUuTien.toLowerCase()]}`}
                            >
                              {pc.DoUuTien == "cao"
                                ? "Cao"
                                : pc.DoUuTien == "trungbinh"
                                  ? "Trung bình"
                                  : "Thấp"}
                            </span>
                          </div>
                          <div className={styles.assignmentActions}>
                            {isLeader && (
                              <>
                                <button
                                  className={styles.editBtn}
                                  title="Chỉnh sửa"
                                  onClick={() => {
                                    setSelectedSubTask(pc);
                                    // Find thanhVienId from members array
                                    const member = members.find(
                                      (m) =>
                                        m.hoTen === pc.ThanhVienDuocPhanCong
                                    );
                                    setSelectedThanhVienId(
                                      member?.thanhVienId || 0
                                    );
                                    setShowEditSubTask(true);
                                  }}
                                >
                                  ✎
                                </button>
                                <button
                                  className={styles.deleteBtn}
                                  title={
                                    taskDetail.trangThai?.toLowerCase() ===
                                    "hoàn thành"
                                      ? "Không thể xoá subtask của công việc đã hoàn thành"
                                      : parseInt(pc.TienDoHoanThanh) >= 100
                                        ? "Không thể xoá subtask đã hoàn thành 100%"
                                        : "Xóa"
                                  }
                                  disabled={
                                    taskDetail.trangThai?.toLowerCase() ===
                                      "hoàn thành" ||
                                    parseInt(pc.TienDoHoanThanh) >= 100
                                  }
                                  onClick={() => {
                                    if (!pc.subTaskId) return;
                                    const member = members.find(
                                      (m) =>
                                        m.hoTen === pc.ThanhVienDuocPhanCong
                                    );
                                    if (!member || !taskDetail) return;

                                    api
                                      .delete(
                                        `/PhanCong/DeletePhanCongItem/${taskDetail.congViecId}/${member.thanhVienId}/${pc.subTaskId}`
                                      )
                                      .then(() => {
                                        api.put(
                                          `https://localhost:7036/api/CongViec/CapNhatTienDoCongViec/${taskDetail.congViecId}`
                                        );
                                        // Refresh subtasks list
                                        setTaskDetail((prev) => {
                                          if (!prev) return null;
                                          const updatedPhanCong =
                                            prev.PhanCong?.filter(
                                              (sub) =>
                                                sub.subTaskId !== pc.subTaskId
                                            );
                                          return {
                                            ...prev,
                                            PhanCong: updatedPhanCong,
                                          };
                                        });
                                        toast.success(
                                          "Xóa công việc con thành công."
                                        );
                                      })
                                      .catch((err) => {
                                        console.error(
                                          "Failed to delete subtask",
                                          err
                                        );
                                        toast.error(
                                          "Xóa công việc con thất bại."
                                        );
                                      });
                                  }}
                                >
                                  ×
                                </button>
                              </>
                            )}
                            <button
                              className={styles.toggleSubtaskBtn}
                              onClick={() =>
                                toggleSubtask(pc.subTaskId || `${idx}`)
                              }
                              title={
                                collapsedSubtasks[pc.subTaskId || `${idx}`]
                                  ? "Mở rộng"
                                  : "Thu gọn"
                              }
                            >
                              {collapsedSubtasks[pc.subTaskId || `${idx}`]
                                ? "▸"
                                : "▾"}
                            </button>
                          </div>
                        </div>
                        {!collapsedSubtasks[pc.subTaskId || `${idx}`] && (
                          <div className={styles.assignmentDetails}>
                            <div className={styles.description}>
                              <strong>Mô tả:</strong>
                              <p>{pc.MoTa}</p>
                            </div>
                            <div className={styles.assignmentDate}>
                              <strong>Ngày phân công:</strong>
                              <p>{pc.NgayPC}</p>
                            </div>
                            <div className={styles.resultSection}>
                              <div className={styles.resultItem}>
                                <strong>Kết quả thực hiện:</strong>
                                {pc.KetQuaThucHien?.noiDung && (
                                  <div className={styles.resultContent}>
                                    {pc.KetQuaThucHien.noiDung
                                      .split(/\n+/)
                                      .map((line, idx) => (
                                        <p key={idx}>{line}</p>
                                      ))}
                                  </div>
                                )}
                                {pc.KetQuaThucHien?.file?.length ? (
                                  <ul>
                                    {pc.KetQuaThucHien.file.map((url, i) => {
                                      const kind = getFileKind(url);
                                      const name = formatFileName(
                                        url.split("/").pop()
                                      );
                                      const full = toFullUrl(url);
                                      return (
                                        <li key={i} className={styles.fileItem}>
                                          <div className={styles.fileMeta}>
                                            <span className={styles.fileIcon}>
                                              {getFileIcon(kind)}
                                            </span>
                                            <a
                                              className={styles.fileName}
                                              href={full}
                                              target="_blank"
                                              rel="noreferrer"
                                              title={name}
                                            >
                                              {name}
                                            </a>
                                          </div>
                                          <a
                                            className={styles.downloadBtn}
                                            href={full}
                                            download
                                          >
                                            Tải xuống
                                          </a>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                ) : null}
                                {!pc.KetQuaThucHien?.noiDung &&
                                  !pc.KetQuaThucHien?.file?.length && (
                                    <span>Chưa có báo cáo.</span>
                                  )}
                              </div>
                              {/* Đã bỏ phần đánh giá theo yêu cầu */}
                            </div>
                            <div className={styles.progressSection}>
                              <strong>Tiến độ: {pc.TienDoHoanThanh}</strong>
                              <div className={styles.progress}>
                                <div
                                  className={styles.progressBar}
                                  style={{ width: pc.TienDoHoanThanh }}
                                >
                                  <span className={styles.progressLabel}>
                                    {pc.TienDoHoanThanh}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className={styles.sideColumn}>
                {isLeader && (
                  <div className={styles.actions}>
                    <button
                      className={styles.actionBtn}
                      onClick={() => {
                        setSelectedTaskForEdit(taskDetail);
                        setShowEditTask(true);
                      }}
                    >
                      <span>Chỉnh sửa</span>
                    </button>
                    <button
                      className={`${styles.actionBtn} ${styles.danger}`}
                      onClick={handleDeleteTask}
                      disabled={
                        isDeletingTask ||
                        taskDetail?.trangThai?.toLowerCase() === "hoàn thành" ||
                        (taskDetail?.phamTramHoanThanh || 0) >= 100
                      }
                      title={
                        taskDetail?.trangThai?.toLowerCase() === "hoàn thành"
                          ? "Không thể xoá công việc đã hoàn thành"
                          : (taskDetail?.phamTramHoanThanh || 0) >= 100
                            ? "Không thể xoá công việc đã hoàn thành 100%"
                            : ""
                      }
                    >
                      <span>Xóa công việc</span>
                    </button>
                    <button
                      className={`${styles.actionBtn} ${styles.secondary}`}
                      onClick={async () => {
                        if (!taskDetail || !currentUser?.Mail) {
                          toast.error("Không tìm thấy thông tin người gửi.");
                          return;
                        }
                        try {
                          console.log(taskDetail, currentUser);
                          setRemindingTask(true);
                          await api.post("/ThongBao/NhacHanCongViec", {
                            congViecID: taskDetail.congViecId,
                            mailNguoiGui: currentUser.Mail,
                          });
                          toast.success("Đã gửi nhắc hạn công việc.");
                        } catch (error: any) {
                          console.error("Remind task error:", error);
                          toast.error(
                            error?.response?.data?.message ||
                              "Không thể gửi nhắc hạn công việc."
                          );
                        } finally {
                          setRemindingTask(false);
                        }
                      }}
                      disabled={remindingTask}
                    >
                      <span>
                        {remindingTask ? "Đang gửi..." : "Nhắc hạn công việc"}
                      </span>
                    </button>
                  </div>
                )}

                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h4>File đính kèm</h4>
                    {isLeader && (
                      <div className={styles.attachmentActions}>
                        <input
                          ref={attachmentInputRef}
                          type="file"
                          multiple
                          hidden
                          onChange={handleUploadAttachments}
                          disabled={uploadingAttachments}
                        />
                        <button
                          type="button"
                          className={styles.uploadBtn}
                          onClick={() => attachmentInputRef.current?.click()}
                          disabled={uploadingAttachments}
                        >
                          {uploadingAttachments ? "Đang tải..." : "+ Thêm file"}
                        </button>
                      </div>
                    )}
                  </div>
                  {attachmentsLoading ? (
                    <p className={styles.helperText}>
                      Đang tải danh sách file...
                    </p>
                  ) : attachments.length ? (
                    <ul className={styles.attachmentList}>
                      {attachments.map((file) => {
                        const kind = getFileKind(file.fileName);
                        const fullUrl = toFullUrl(file.filePath);
                        const displayName = formatFileName(file.fileName);
                        const isDeleting =
                          deletingAttachmentPath === file.filePath;
                        return (
                          <li
                            key={file.filePath}
                            className={styles.attachmentItem}
                          >
                            <div className={styles.fileMeta}>
                              <span className={styles.fileIcon}>
                                {getFileIcon(kind)}
                              </span>
                              <a
                                className={styles.fileName}
                                href={fullUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {displayName || file.fileName}
                              </a>
                            </div>
                            <div className={styles.attachmentItemActions}>
                              <a
                                href={fullUrl}
                                download
                                className={styles.downloadBtn}
                              >
                                Tải xuống
                              </a>
                              {isLeader && (
                                <button
                                  type="button"
                                  className={styles.deleteBtn}
                                  onClick={() =>
                                    handleDeleteAttachment(file.filePath)
                                  }
                                  disabled={isDeleting}
                                >
                                  {isDeleting ? "Đang xóa..." : "Xóa"}
                                </button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className={styles.helperText}>
                      Chưa có file đính kèm nào.
                    </p>
                  )}
                </div>

                <div className={styles.section}>
                  <h4>Bình luận</h4>
                  <div className={styles.comments}>
                    {comments.map((bl, idx) => {
                      // Check if this is the current user's comment
                      const isOwnComment =
                        currentUser &&
                        bl.ThanhVienBinhLuan === currentUser.HoTen;

                      return (
                        <div
                          key={bl.binhLuanId}
                          className={`${styles.comment} ${isOwnComment ? styles.ownComment : styles.otherComment}`}
                        >
                          <div className={styles.commentHeader}>
                            <span className={styles.memberAvatar}>
                              {bl.ThanhVienBinhLuan[0]}
                            </span>
                            <div className={styles.commentMeta}>
                              <span className={styles.commenterName}>
                                {bl.ThanhVienBinhLuan}
                              </span>
                              <span className={styles.commentDate}>
                                {new Date(bl.NgayBinhLuan).toLocaleString(
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
                                {bl.NgayCapNhat !== bl.NgayBinhLuan &&
                                  `(Đã chỉnh sửa)`}
                              </span>
                            </div>
                            {isOwnComment && (
                              <div className={styles.commentActions}>
                                <button
                                  onClick={() => {
                                    setEditingComment(bl.binhLuanId);
                                    setEditedComment(bl.NoiDung);
                                  }}
                                  className={styles.editButton}
                                >
                                  Sửa
                                </button>
                                <button
                                  onClick={() => {
                                    handleDeleteComment(bl.binhLuanId);
                                  }}
                                  className={styles.deleteButton}
                                >
                                  Xoá
                                </button>
                              </div>
                            )}
                          </div>

                          {editingComment === bl.binhLuanId ? (
                            <div className={styles.editCommentContainer}>
                              <div className={styles.commentToolbar}>
                                <button
                                  className={`${styles.formatBtn} ${editFormatting.isBold ? styles.active : ""}`}
                                  onClick={() =>
                                    setEditFormatting((prev) => ({
                                      ...prev,
                                      isBold: !prev.isBold,
                                    }))
                                  }
                                  type="button"
                                >
                                  <strong>B</strong>
                                </button>
                                <button
                                  className={`${styles.formatBtn} ${editFormatting.isItalic ? styles.active : ""}`}
                                  onClick={() =>
                                    setEditFormatting((prev) => ({
                                      ...prev,
                                      isItalic: !prev.isItalic,
                                    }))
                                  }
                                  type="button"
                                >
                                  <em>I</em>
                                </button>
                                <button
                                  className={`${styles.formatBtn} ${editFormatting.isStrikethrough ? styles.active : ""}`}
                                  onClick={() =>
                                    setEditFormatting((prev) => ({
                                      ...prev,
                                      isStrikethrough: !prev.isStrikethrough,
                                    }))
                                  }
                                  type="button"
                                >
                                  <s>S</s>
                                </button>
                              </div>
                              <textarea
                                value={editedComment}
                                onChange={(e) =>
                                  setEditedComment(e.target.value)
                                }
                                className={styles.editCommentInput}
                                rows={3}
                              />
                              <div className={styles.editActions}>
                                <button
                                  onClick={() => setEditingComment(null)}
                                  className={styles.cancelButton}
                                >
                                  Hủy
                                </button>
                                <button
                                  onClick={() =>
                                    handleUpdateComment(bl.binhLuanId)
                                  }
                                  className={styles.saveButton}
                                >
                                  Lưu
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className={styles.commentContent}>
                              {renderCommentContent(bl.NoiDung)}
                            </p>
                          )}
                        </div>
                      );
                    })}
                    <div className={styles.addComment}>
                      <div className={styles.commentToolbar}>
                        <button
                          className={`${styles.formatBtn} ${isBold ? styles.active : ""}`}
                          onClick={() => setIsBold(!isBold)}
                          title="In đậm"
                        >
                          <strong>B</strong>
                        </button>
                        <button
                          className={`${styles.formatBtn} ${isItalic ? styles.active : ""}`}
                          onClick={() => setIsItalic(!isItalic)}
                          title="In nghiêng"
                        >
                          <em>I</em>
                        </button>
                        <button
                          className={`${styles.formatBtn} ${isStrikethrough ? styles.active : ""}`}
                          onClick={() => setIsStrikethrough(!isStrikethrough)}
                          title="Gạch ngang"
                        >
                          <s>S</s>
                        </button>
                      </div>
                      <textarea
                        placeholder="Thêm bình luận..."
                        rows={3}
                        value={newCommentContent}
                        onChange={(e) => setNewCommentContent(e.target.value)}
                      />
                      <button
                        onClick={() => {
                          if (!taskDetail || !newCommentContent.trim()) return;

                          if (!currentUser) {
                            toast.error(
                              "Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại."
                            );
                            return;
                          }

                          let formattedContent = newCommentContent;
                          if (isBold)
                            formattedContent = `**${formattedContent}**`;
                          if (isItalic)
                            formattedContent = `*${formattedContent}*`;
                          if (isStrikethrough)
                            formattedContent = `~~${formattedContent}~~`;

                          const payload = {
                            congViecID: taskDetail.congViecId,
                            thanhVienID: currentUser.UserId,
                            noiDung: formattedContent,
                          };

                          api
                            .post("/BinhLuan/CreateBinhLuan", payload)
                            .then(() => {
                              setNewCommentContent("");
                              setIsBold(false);
                              setIsItalic(false);
                              setIsStrikethrough(false);
                              refreshComments(); // Refresh comments after successful post
                              const notificationPayload = {
                                congViecID: taskDetail.congViecId,
                                thanhVienGuiID: currentUser.UserId,
                                noiDungBinhLuan: formattedContent,
                              };

                              api
                                .post(
                                  "/ThongBao/ThongBaoBinhLuanMoi",
                                  notificationPayload
                                )
                                .catch((err) => {
                                  console.error(
                                    "Failed to send comment notification",
                                    err
                                  );
                                });
                            })
                            .catch((err) => {
                              console.error("Failed to add comment", err);
                              toast.error("Bình luận thất bại.");
                            });
                        }}
                      >
                        Gửi
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <CreateTaskModal
        isOpen={showCreateTask}
        onClose={() => setShowCreateTask(false)}
        duAnId={duAnId}
        trangThai={selectedColumn}
        projectStartDate={projectStartDate}
        projectEndDate={projectEndDate}
        onSuccess={() => {
          // Refresh tasks
          api
            .get(`/CongViec/GetCongViecsOfDuAn/${duAnId}`)
            .then((response) => {
              const data = Array.isArray(response.data)
                ? response.data
                : response.data?.congViecs || [];

              setKanbanTasks(data);
            })
            .catch((error) => console.error("Error refreshing tasks:", error));
        }}
      />
      <EditTaskModal
        isOpen={showEditTask}
        onClose={() => setShowEditTask(false)}
        task={selectedTaskForEdit}
        projectStartDate={projectStartDate}
        projectEndDate={projectEndDate}
        onSuccess={() => {
          setShowEditTask(false);
          // Refresh tasks
          api
            .get(`/CongViec/GetCongViecsOfDuAn/${duAnId}`)
            .then((response) => {
              const data = Array.isArray(response.data)
                ? response.data
                : response.data?.congViecs || [];
              setKanbanTasks(data);
              // Update selectedTask
              const updatedTask = data.find(
                (t: KanbanTaskType) => t.congViecId === selectedTask?.congViecId
              );
              if (updatedTask) {
                onTaskSelect(updatedTask);
              }
            })
            .catch((error) => console.error("Error refreshing tasks:", error));
        }}
      />
      <AddSubTaskModal
        isOpen={showAddSubTask}
        onClose={() => setShowAddSubTask(false)}
        congViecId={taskDetail?.congViecId || 0}
        members={members}
        ngayBd={taskDetail?.ngayBd || ""}
        ngayKt={taskDetail?.ngayKt || ""}
        trangThai={taskDetail?.trangThai}
        onSuccess={() => {
          setShowAddSubTask(false);
          // Refresh PhanCong
          if (taskDetail) {
            api
              .get(`/PhanCong/GetPhanCongOfCongViec/${taskDetail.congViecId}`)
              .then((response) => {
                const data = Array.isArray(response.data) ? response.data : [];
                const phanCong = data.flatMap((item: any) =>
                  item.noiDungPhanCong.map((nd: any) => ({
                    subTaskId: nd.subTaskId,
                    ThanhVienDuocPhanCong: item.hoTen,
                    MoTa: nd.moTa,
                    NgayPC: nd.ngayPC,
                    DoUuTien: nd.doUuTien === "string" ? "cao" : nd.doUuTien,
                    KetQuaThucHien: Array.isArray(nd.ketQuaThucHien)
                      ? nd.ketQuaThucHien
                      : nd.ketQuaThucHien
                        ? [nd.ketQuaThucHien]
                        : [],
                    DanhGia: nd.danhGia === "string" ? "Chưa có" : nd.danhGia,
                    TienDoHoanThanh:
                      nd.tienDoHoanThanh === "string"
                        ? "0%"
                        : nd.tienDoHoanThanh,
                  }))
                );
                setTaskDetail((prev) =>
                  prev ? { ...prev, PhanCong: phanCong } : prev
                );
              })
              .catch((error) =>
                console.error("Error fetching PhanCong:", error)
              );
          }
        }}
        mailNguoiGui={senderEmail}
      />
      <EditSubTaskModal
        isOpen={showEditSubTask}
        onClose={() => setShowEditSubTask(false)}
        subtask={selectedSubTask}
        congViecId={taskDetail?.congViecId || 0}
        thanhVienId={selectedThanhVienId}
        ngayBd={taskDetail?.ngayBd || ""}
        ngayKt={taskDetail?.ngayKt || ""}
        onSuccess={() => {
          setShowEditSubTask(false);
          // Refresh PhanCong
          if (taskDetail) {
            api
              .get(`/PhanCong/GetPhanCongOfCongViec/${taskDetail.congViecId}`)
              .then((response) => {
                const data = Array.isArray(response.data) ? response.data : [];
                const phanCong = data.flatMap((item: any) =>
                  item.noiDungPhanCong.map((nd: any) => ({
                    subTaskId: nd.subTaskId,
                    ThanhVienDuocPhanCong: item.hoTen,
                    MoTa: nd.moTa,
                    NgayPC: nd.ngayPC,
                    DoUuTien: nd.doUuTien === "string" ? "cao" : nd.doUuTien,
                    KetQuaThucHien: Array.isArray(nd.ketQuaThucHien)
                      ? nd.ketQuaThucHien
                      : nd.ketQuaThucHien
                        ? [nd.ketQuaThucHien]
                        : [],
                    DanhGia: nd.danhGia === "string" ? "Chưa có" : nd.danhGia,
                    TienDoHoanThanh:
                      nd.tienDoHoanThanh === "string"
                        ? "0%"
                        : nd.tienDoHoanThanh,
                  }))
                );
                setTaskDetail((prev) =>
                  prev ? { ...prev, PhanCong: phanCong } : prev
                );
              })
              .catch((error) =>
                console.error("Error fetching PhanCong:", error)
              );
          }
        }}
      />

      <ConfirmModal
        isOpen={showConfirmDelete}
        title="Xóa công việc"
        message="Bạn có chắc chắn muốn xóa công việc này? Hành động này không thể hoàn tác."
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        onConfirm={confirmDeleteTask}
        onCancel={cancelDeleteTask}
        confirming={isDeletingTask}
      />

      <ConfirmModal
        isOpen={showConfirmDeleteColumn}
        title="Xóa cột"
        message={`Bạn có chắc muốn xoá cột "${columnToDelete}"?`}
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        onConfirm={confirmDeleteColumn}
        onCancel={cancelDeleteColumn}
        confirming={!!deletingColumnStatus}
      />
    </DndContext>
  );
};

export default KanbanTab;
