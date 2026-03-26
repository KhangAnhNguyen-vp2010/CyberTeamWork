import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ChangeEvent,
} from "react";
import UserDropdown from "../shared/user-dropdown/UserDropdown";
import styles from "./main.module.scss";
import EditProfile from "../auth/components/EditProfile";
import Modal from "../shared/pop-up/Modal";
import ChangePasswordModal from "../auth/shared/change-password/ChangePasswordModal";
import GroupDropdown from "../../components/groups/GroupDropdown";
import ProjectDetailModal from "./ProjectDetailModal";
import CreateGroupModal from "../../components/groups/CreateGroupModal";
import { Navigate, useNavigate } from "react-router";
import Sidebar, { type Tab } from "../../components/sidebar/Sidebar";
import api from "../../apis/api";
import EditGroupModal from "../../components/groups/EditGroupModal";
import AddMemberModal from "../../components/groups/AddMemberModal";
import InvitationsModal from "../../components/groups/InvitationsModal";
import CreateProjectModal from "../../components/projects/CreateProjectModal";
import EditProjectModal from "../../components/projects/EditProjectModal";
import ProjectDashboard from "../../components/project-detail/ProjectDashboard";
import {
  FaBell,
  FaRegEnvelope,
  FaDownload,
  FaClock,
  FaUpload,
  FaUsers,
  FaFolderOpen,
  FaChartBar,
  FaSpinner,
} from "react-icons/fa";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import img_group_default from "../../components/groups/default-group.png";
import img_project_default from "./project-default.png";
import NotificationsModal from "../../components/notifications/NotificationsModal";
import type { NotificationItem } from "../../components/notifications/NotificationsModal";
import IntroduceModal from "../auth/components/Introduce/IntroduceModal";
import { useAuth } from "../auth/hooks/useAuth";

type ConfirmDialogConfig = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => Promise<void> | void;
};
const MainPage = () => {
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showIntroduce, setShowIntroduce] = useState(false);
  const { user } = useAuth();
  const [expandedGroupIdx, setExpandedGroupIdx] = useState<number | null>(null);
  const [showProjectDetail, setShowProjectDetail] = useState<{
    project: ProjectType | null;
    open: boolean;
  }>({ project: null, open: false });
  const navigate = useNavigate();
  const [showGroupCreate, setShowGroupCreate] = useState(false);
  const taikhoan = localStorage.getItem("user");
  console.log("User ID from localStorage:", taikhoan);
  const [refreshGroups, setRefreshGroups] = useState(0);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<Tab>("ChiTietNhom");
  const [groupDetails, setGroupDetails] = useState<any>(null);
  const [showEditGroup, setShowEditGroup] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("hoTen");
  const [filterBy, setFilterBy] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;
  const [showAddMember, setShowAddMember] = useState(false);
  const [isLeader, setIsLeader] = useState(false);
  const [showInvitations, setShowInvitations] = useState(false);
  const [invitationCount, setInvitationCount] = useState(0);
  const [projects, setProjects] = useState<any[]>([]);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [projectSearchTerm, setProjectSearchTerm] = useState("");
  const [projectSortBy, setProjectSortBy] = useState("tenDuAn");
  const [projectFilterBy, setProjectFilterBy] = useState("all");
  const [projectLinhVucFilter, setProjectLinhVucFilter] = useState("all");
  const [projectCurrentPage, setProjectCurrentPage] = useState(1);
  const projectItemsPerPage = 4;
  const [linhVucList, setLinhVucList] = useState<any[]>([]);
  const linhVucCarouselRef = useRef<HTMLDivElement | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(
    null
  );
  const [markingNotificationId, setMarkingNotificationId] = useState<
    string | null
  >(null);
  const [markingAllNotifications, setMarkingAllNotifications] = useState(false);
  const [pinningNotificationId, setPinningNotificationId] = useState<
    string | null
  >(null);
  const [deletingNotificationId, setDeletingNotificationId] = useState<
    string | null
  >(null);
  const [backupProjectId, setBackupProjectId] = useState<string>("");
  const [scheduledProjectId, setScheduledProjectId] = useState<string>("");
  const [backupLoading, setBackupLoading] = useState(false);
  const [scheduledBackupEnabled, setScheduledBackupEnabled] = useState(false);
  const [scheduledBackupFrequency, setScheduledBackupFrequency] =
    useState("daily");
  const [scheduledBackupTime, setScheduledBackupTime] = useState("08:00");
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [groupMemberIds, setGroupMemberIds] = useState<number[]>([]);
  const [groupMemberIdsLoading, setGroupMemberIdsLoading] = useState(false);
  const [groupMemberIdsError, setGroupMemberIdsError] = useState<string | null>(
    null
  );

  const handleManualBackup = useCallback(async () => {
    if (!backupProjectId) {
      toast.warn("Vui lòng chọn dự án cần sao lưu.");
      return;
    }

    const targetProject = projects.find(
      (project) => String(project.duAnId) === String(backupProjectId)
    );
    const sanitize = (value?: string) =>
      value
        ? value
            .normalize("NFD")
            .replace(/[\u0000-\u001f\u007f]/g, "")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "")
            .toLowerCase()
        : "du_an";
    const pad = (num: number) => num.toString().padStart(2, "0");
    const now = new Date();
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
      now.getDate()
    )}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    setBackupLoading(true);
    try {
      const response = await api.get(
        `/Admin/backup/project/${backupProjectId}`,
        {
          responseType: "blob",
        }
      );

      const contentDisposition = response.headers["content-disposition"];
      let filename = `backup_${sanitize(targetProject?.tenDuAn)}_${timestamp}.json`;
      if (contentDisposition) {
        const match = /filename\*=UTF-8''([^;]+)|filename=([^;]+)/i.exec(
          contentDisposition
        );
        if (match) {
          const headerFilename = decodeURIComponent(
            match[1] || match[2]
          ).replace(/"/g, "");
          const headerExt = headerFilename.includes(".")
            ? headerFilename.slice(headerFilename.lastIndexOf("."))
            : ".json";
          filename = `backup_${sanitize(targetProject?.tenDuAn)}_${timestamp}${headerExt}`;
        }
      }

      const blob = new Blob([response.data], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Sao lưu dự án thành công. File đã được tải xuống.");
    } catch (error: any) {
      console.error("Manual backup failed:", error);
      toast.error(
        error?.response?.data?.message ||
          "Không thể sao lưu dự án. Vui lòng thử lại."
      );
    } finally {
      setBackupLoading(false);
    }
  }, [backupProjectId, projects]);

  const handleToggleScheduledBackup = useCallback(() => {
    setScheduledBackupEnabled((prev) => !prev);
  }, []);

  const handleSaveScheduledBackup = useCallback(() => {
    if (!scheduledProjectId) {
      toast.warn("Chọn dự án để bật sao lưu định kỳ.");
      return;
    }

    // Placeholder for integration with backend scheduling API
    toast.info(
      `Đã ${scheduledBackupEnabled ? "cập nhật" : "bật"} sao lưu định kỳ cho dự án ${scheduledProjectId} (${scheduledBackupFrequency} lúc ${scheduledBackupTime}).`
    );
  }, [
    scheduledProjectId,
    scheduledBackupEnabled,
    scheduledBackupFrequency,
    scheduledBackupTime,
  ]);

  const restoreFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleRestoreFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      setRestoreFile(file);
    },
    []
  );

  const fetchGroupMemberIds = useCallback(
    async (nhomId: number): Promise<number[]> => {
      setGroupMemberIdsLoading(true);
      setGroupMemberIdsError(null);
      try {
        const response = await api.get(`/Admin/groups/${nhomId}/members/ids`);
        const ids: number[] = Array.isArray(response.data?.memberIds)
          ? response.data.memberIds
          : [];
        setGroupMemberIds(ids);
        return ids;
      } catch (error) {
        console.error("Error fetching group member ids:", error);
        setGroupMemberIds([]);
        setGroupMemberIdsError("Không tải được danh sách thành viên nhóm.");
        return [];
      } finally {
        setGroupMemberIdsLoading(false);
      }
    },
    []
  );

  const handleRestoreProject = useCallback(async () => {
    if (!selectedGroup) {
      toast.warn("Vui lòng chọn nhóm cần phục hồi dữ liệu.");
      return;
    }

    if (!restoreFile) {
      toast.warn("Vui lòng chọn file sao lưu.");
      return;
    }

    setRestoreLoading(true);
    const memberIds = await fetchGroupMemberIds(selectedGroup.nhomId);
    if (memberIds.length === 0) {
      toast.warn("Không có danh sách thành viên nhóm để phục hồi.");
      setRestoreLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append("backupFile", restoreFile);
    formData.append("targetNhomId", String(selectedGroup.nhomId));
    memberIds.forEach((id) => {
      formData.append("groupMemberIds", String(id));
    });

    try {
      await api.post("/Admin/restore/project", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      toast.success("Phục hồi dự án thành công.");
      setRestoreFile(null);
      if (restoreFileInputRef.current) {
        restoreFileInputRef.current.value = "";
      }
    } catch (error: any) {
      console.error("Restore project failed:", error);
      toast.error(
        error?.response?.data?.message ||
          "Không thể phục hồi dự án. Vui lòng thử lại."
      );
    } finally {
      setRestoreLoading(false);
    }
  }, [fetchGroupMemberIds, restoreFile, selectedGroup]);

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogConfig>({
    open: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  useEffect(() => {
    if (!user) return;

    const introKey = `intro_seen_${user.UserId}`;
    const hasSeenIntro = localStorage.getItem(introKey) === "true";
    const hasCompletedProfile =
      Boolean(user.HoTen && user.HoTen.trim().length > 0) &&
      Boolean(user.GioiTinh) &&
      Boolean(user.NgaySinh);

    if (!hasSeenIntro && !hasCompletedProfile) {
      setShowIntroduce(true);
    }
  }, [user]);

  let currentUser: any = null;
  try {
    currentUser = taikhoan ? JSON.parse(taikhoan) : null;
  } catch (error) {
    currentUser = null;
  }
  const currentUserId = currentUser?.UserId;

  const scrollLinhVucCarousel = useCallback((direction: "prev" | "next") => {
    const container = linhVucCarouselRef.current;
    if (!container) return;
    const scrollAmount = container.clientWidth * 0.85;
    container.scrollBy({
      left: direction === "next" ? scrollAmount : -scrollAmount,
      behavior: "smooth",
    });
  }, []);

  const buildLinhVucKey = useCallback((id?: unknown, name?: string | null) => {
    if (id !== undefined && id !== null) {
      const trimmed = String(id).trim();
      if (trimmed.length > 0) {
        return `id:${trimmed}`;
      }
    }
    if (typeof name === "string") {
      const trimmedName = name.trim();
      if (trimmedName.length > 0) {
        return `name:${trimmedName}`;
      }
    }
    return "";
  }, []);

  const getProjectStatusClass = (status?: string) => {
    if (!status) return "";
    const normalized = status.toLowerCase();

    if (normalized.includes("đang") && normalized.includes("thực hiện")) {
      return styles.statusInProgress;
    }

    if (normalized.includes("hoàn") && normalized.includes("thành")) {
      return styles.statusCompleted;
    }

    if (normalized.includes("tạm") && normalized.includes("dừng")) {
      return styles.statusPaused;
    }

    return "";
  };

  // Fetch invitation count on mount and periodically
  useEffect(() => {
    const fetchInvitationCount = () => {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const email = user.Mail;
      if (email) {
        api
          .get(`/Nhom/loi-moi/${email}`)
          .then((response) => {
            const data = Array.isArray(response.data) ? response.data : [];
            const pendingCount = data.filter(
              (invite: any) => invite.trangThaiLoiMoi === "Chờ phản hồi"
            ).length;
            setInvitationCount(pendingCount);
          })
          .catch((error) => {
            console.error("Error fetching invitations:", error);
            setInvitationCount(0);
          });
      }
    };

    fetchInvitationCount();
    const interval = setInterval(fetchInvitationCount, 3000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Fetch group details when selectedGroup changes
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    const fetchGroupDetails = () => {
      if (!selectedGroup) return;
      api
        .get(`/Nhom/${selectedGroup.nhomId}`)
        .then((response) => setGroupDetails(response.data))
        .catch((error) =>
          console.error("Error fetching group details:", error)
        );
    };

    if (selectedGroup) {
      fetchGroupDetails();
      interval = setInterval(fetchGroupDetails, 3000);
    } else {
      setGroupDetails(null);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [selectedGroup]);

  // Fetch members when selectedGroup changes
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    const fetchMembers = () => {
      if (!selectedGroup) return;
      api
        .get(`/Nhom/${selectedGroup.nhomId}/ThanhVien`)
        .then((response) => setMembers(response.data))
        .catch((error) => console.error("Error fetching members:", error));
    };

    if (selectedGroup) {
      fetchMembers();
      interval = setInterval(fetchMembers, 3000);
    } else {
      setMembers([]);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [selectedGroup]);

  // Check if current user is leader
  useEffect(() => {
    if (selectedGroup) {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const userId = user.UserId;
      api
        .get(`/Nhom/${selectedGroup.nhomId}/ThanhVien/${userId}`)
        .then((response) => {
          if (response.data.chucVu === "Trưởng nhóm") {
            setIsLeader(true);
          } else {
            setIsLeader(false);
          }
        })
        .catch((error) => setIsLeader(false));
    } else {
      setIsLeader(false);
    }
  }, [selectedGroup]);

  // Fetch projects when selectedGroup changes
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    const fetchProjects = () => {
      if (!selectedGroup) return;
      api
        .get(`/DuAn/GetProjectsOfGroup/${selectedGroup.nhomId}`)
        .then((response) => {
          const data = response.data.projects || [];
          setProjects(data);
        })
        .catch((error) => console.error("Error fetching projects:", error));
    };

    if (selectedGroup) {
      fetchProjects();
      interval = setInterval(fetchProjects, 3000);
      api
        .get("/DuAn/linh-vuc")
        .then((response) => {
          const data = Array.isArray(response.data?.data)
            ? response.data.data
            : Array.isArray(response.data)
              ? response.data
              : [];
          setLinhVucList(data);
        })
        .catch((error) => console.error("Error fetching linh vuc:", error));
    } else {
      setProjects([]);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [selectedGroup, refreshGroups]);

  // Fetch group member ids for restore feature when group changes (for display)
  useEffect(() => {
    if (!selectedGroup) {
      setGroupMemberIds([]);
      return;
    }

    fetchGroupMemberIds(selectedGroup.nhomId);
  }, [fetchGroupMemberIds, selectedGroup]);

  // Fetch linh-vuc on mount
  useEffect(() => {
    api
      .get("/DuAn/linh-vuc")
      .then((response) => {
        const data = Array.isArray(response.data?.data)
          ? response.data.data
          : Array.isArray(response.data)
            ? response.data
            : [];
        setLinhVucList(data);
      })
      .catch((error) => {
        console.error("Error fetching linh-vuc:", error);
        setLinhVucList([]);
      });
  }, []);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
  };

  const resolveMediaUrl = useCallback((path?: string | null) => {
    if (!path) return null;
    if (path.startsWith("http")) return path;
    const rawBase = import.meta.env.VITE_API_URL || "https://localhost:7036";
    const base = rawBase.endsWith("/api") ? rawBase.slice(0, -4) : rawBase;
    return `${base}${path}`;
  }, []);

  // Filter and sort members
  const filteredAndSortedMembers = members
    .filter((member) => {
      if (filterBy === "all") return true;
      return member.chucVu === filterBy;
    })
    .filter((member) =>
      member.hoTen.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "hoTen") return a.hoTen.localeCompare(b.hoTen);
      if (sortBy === "chucVu") return a.chucVu.localeCompare(b.chucVu);
      if (sortBy === "ngayThamGia")
        return (
          new Date(a.ngayThamGia).getTime() - new Date(b.ngayThamGia).getTime()
        );
      return 0;
    });

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedMembers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedMembers = filteredAndSortedMembers.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleProjectPageChange = (page: number) => {
    setProjectCurrentPage(page);
  };

  const fetchNotifications = useCallback(
    async (withLoading: boolean = true) => {
      if (!currentUserId) {
        setNotifications([]);
        setNotificationsError("Không tìm thấy thông tin thành viên.");
        if (withLoading) {
          setNotificationsLoading(false);
        }
        return;
      }

      if (withLoading) {
        setNotificationsLoading(true);
      }

      try {
        const response = await api.get(
          `/ThongBao/GetThongBaoOfThanhVien/${currentUserId}`
        );
        const data = Array.isArray(response.data)
          ? response.data
          : response.data?.notifications || [];
        setNotifications(data);
        setNotificationsError(null);
      } catch (error: any) {
        console.error("Error fetching notifications:", error);
        setNotificationsError(
          error?.response?.data?.message || "Không thể tải danh sách thông báo."
        );
      } finally {
        if (withLoading) {
          setNotificationsLoading(false);
        }
      }
    },
    [currentUserId]
  );

  const handleTogglePin = useCallback(
    async (notificationId: string) => {
      if (!currentUserId) return;

      setPinningNotificationId(notificationId);
      try {
        await api.put(
          `/ThongBao/ToggleGhim/${currentUserId}/${notificationId}`
        );
        setNotifications((prev) =>
          prev.map((item) =>
            item.thongBaoId === notificationId
              ? { ...item, ghim: item.ghim ? 0 : 1 }
              : item
          )
        );
      } catch (error: any) {
        console.error("Error toggling pin:", error);
        toast.error(
          error?.response?.data?.message ||
            "Không thể cập nhật trạng thái ghim."
        );
      } finally {
        setPinningNotificationId(null);
      }
    },
    [currentUserId]
  );

  const handleDeleteNotification = useCallback(
    async (notificationId: string) => {
      if (!currentUserId) return;

      setDeletingNotificationId(notificationId);
      try {
        await api.delete(
          `/ThongBao/DeleteThongBao/${currentUserId}/${notificationId}`
        );
        setNotifications((prev) =>
          prev.filter((item) => item.thongBaoId !== notificationId)
        );
        toast.success("Đã xóa thông báo.");
      } catch (error: any) {
        console.error("Error deleting notification:", error);
        toast.error(
          error?.response?.data?.message || "Không thể xóa thông báo."
        );
      } finally {
        setDeletingNotificationId(null);
      }
    },
    [currentUserId]
  );

  useEffect(() => {
    if (showNotifications) {
      fetchNotifications();
    }
  }, [showNotifications, fetchNotifications]);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    fetchNotifications(false);
    const intervalId = window.setInterval(() => {
      fetchNotifications(false);
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [currentUserId, fetchNotifications]);

  const handleMarkAsRead = useCallback(
    async (notificationId: string) => {
      if (!currentUserId) return;

      setMarkingNotificationId(notificationId);
      try {
        await api.put(
          `/ThongBao/MarkAsRead/${currentUserId}/${notificationId}`
        );
        setNotifications((prev) =>
          prev.map((item) =>
            item.thongBaoId === notificationId
              ? {
                  ...item,
                  trangThai: "Đã Đọc",
                  ngayDoc: new Date().toISOString(),
                }
              : item
          )
        );
      } catch (error: any) {
        console.error("Error marking notification as read:", error);
        toast.error(
          error?.response?.data?.message ||
            "Không thể đánh dấu thông báo đã đọc."
        );
      } finally {
        setMarkingNotificationId(null);
      }
    },
    [currentUserId]
  );

  const handleMarkAllAsRead = useCallback(async () => {
    if (!currentUserId) return;

    setMarkingAllNotifications(true);
    try {
      await api.put(`/ThongBao/MarkAllAsRead/${currentUserId}`);
      setNotifications((prev) =>
        prev.map((item) =>
          item.trangThai?.toLowerCase() === "chưa đọc"
            ? {
                ...item,
                trangThai: "Đã Đọc",
                ngayDoc: new Date().toISOString(),
              }
            : item
        )
      );
    } catch (error: any) {
      console.error("Error marking all notifications as read:", error);
      toast.error(
        error?.response?.data?.message ||
          "Không thể đánh dấu tất cả thông báo đã đọc."
      );
    } finally {
      setMarkingAllNotifications(false);
    }
  }, [currentUserId]);

  // Filter and sort projects
  const filteredAndSortedProjects = projects
    .filter((project) => {
      if (projectFilterBy === "all") return true;
      return project.trangThai === projectFilterBy;
    })
    .filter((project) => {
      if (projectLinhVucFilter === "all") return true;
      const possibleKeys = [
        buildLinhVucKey(project.linhVucId, undefined),
        buildLinhVucKey(undefined, project.tenLinhVuc),
      ].filter((key): key is string => Boolean(key));

      if (possibleKeys.length === 0) return false;
      return possibleKeys.includes(projectLinhVucFilter);
    })
    .filter((project) =>
      project.tenDuAn.toLowerCase().includes(projectSearchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (projectSortBy === "tenDuAn")
        return a.tenDuAn.localeCompare(b.tenDuAn);
      if (projectSortBy === "ngayBd")
        return new Date(a.ngayBd).getTime() - new Date(b.ngayBd).getTime();
      if (projectSortBy === "trangThai")
        return a.trangThai.localeCompare(b.trangThai);
      return 0;
    });

  // Pagination
  const projectTotalPages = Math.ceil(
    filteredAndSortedProjects.length / projectItemsPerPage
  );
  const projectStartIndex = (projectCurrentPage - 1) * projectItemsPerPage;
  const paginatedProjects = filteredAndSortedProjects.slice(
    projectStartIndex,
    projectStartIndex + projectItemsPerPage
  );

  // Type cho dự án và thành viên
  type MemberType = {
    TenThanhVien: string;
    ChucVu: string;
    ChuyenMon: string;
    NgayThamGia: string;
    GhiChu: string;
  };
  type ProjectType = {
    duAnId: number;
    tenDuAn: string;
    moTa: string;
    ngayBd: string;
    ngayKt: string;
    trangThai: string;
    linhVucId: number;
    anhBia: string;
  };

  const unreadNotificationCount = notifications.filter(
    (item) => item.trangThai?.toLowerCase() === "chưa đọc"
  ).length;

  return (
    <>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.logoArea}>
            <span className={styles.logoMark}>CTW</span>
            <div className={styles.logoText}>
              <h1>CyberTeamWork</h1>
              <p>Kết nối - Cộng tác - Hoàn thành</p>
            </div>
          </div>
          <div className={styles.headerActions}>
            {user?.tenQuyen !== "Quản lí" && (
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => setShowInvitations(true)}
              >
                <span role="img" aria-label="mailbox">
                  <FaRegEnvelope />
                </span>
                {invitationCount > 0 && (
                  <span className={styles.notificationBadge}>
                    {invitationCount}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              className={styles.iconButton}
              onClick={() => {
                if (!currentUserId) {
                  toast.error("Không tìm thấy thông tin người dùng.");
                  return;
                }
                setShowNotifications(true);
              }}
            >
              <span role="img" aria-label="notification">
                <FaBell />
              </span>
              {unreadNotificationCount > 0 && (
                <span className={styles.notificationBadge}>
                  {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                </span>
              )}
            </button>

            <div className={styles.headerDivider} aria-hidden="true" />

            {(() => {
              console.log("User quyền:", user?.tenQuyen);
              console.log(
                "Hiển thị nút tạo nhóm:",
                user?.tenQuyen !== "Thành viên"
              );
              return (
                user?.tenQuyen !== "Thành viên" && (
                  <button
                    type="button"
                    className={styles.primaryAction}
                    onClick={() => setShowGroupCreate(true)}
                  >
                    ➕ Tạo nhóm
                  </button>
                )
              );
            })()}

            <div className={styles.groupActions}>
              <GroupDropdown
                refreshTrigger={refreshGroups}
                onSelect={(group) => {
                  setSelectedGroup(group);
                  setActiveTab("ChiTietNhom"); // Reset to first tab when group changes
                }}
              />
            </div>

            <UserDropdown
              onEditProfile={() => setShowEditProfile(true)}
              onChangePassword={() => setShowChangePassword(true)}
            />
          </div>
        </div>

        {/* Sidebar and Content in flex row */}
        <div className={styles.mainContent}>
          <Sidebar
            activeTab={activeTab}
            onTabChange={handleTabChange}
            isLeader={isLeader}
            userRole={user?.quyenId ?? null}
          />
          <div className={styles.content}>
            {activeTab === "ChiTietNhom" ? (
              selectedGroup ? (
                groupDetails ? (
                  <div className={styles.groupDetails}>
                    <header className={styles.groupSectionHeader}>
                      <div>
                        <span className={styles.sectionTag}>
                          Thông tin nhóm
                        </span>
                        <h2>{groupDetails.tenNhom ?? "Nhóm chưa đặt tên"}</h2>
                        <p>
                          Quản lý hoạt động và thành viên của nhóm trong một
                          không gian trực quan.
                        </p>
                      </div>
                      <ul className={styles.groupKpis}>
                        <li>
                          <span className={styles.kpiLabel}>Số dự án</span>
                          <strong>{projects.length ?? 0}</strong>
                        </li>
                        <li>
                          <span className={styles.kpiLabel}>Thành viên</span>
                          <strong>
                            {members.length || groupDetails.soLuongTv || 0}
                          </strong>
                        </li>
                        <li>
                          <span className={styles.kpiLabel}>Ngày lập</span>
                          <strong>{groupDetails.ngayLapNhom ?? "-"}</strong>
                        </li>
                      </ul>
                    </header>

                    <section className={styles.groupCard}>
                      <div className={styles.groupMedia}>
                        <img
                          src={
                            groupDetails.anhBia
                              ? `https://localhost:7036${groupDetails.anhBia}`
                              : img_group_default
                          }
                          alt={groupDetails.tenNhom}
                        />
                      </div>
                      <div className={styles.groupInfo}>
                        <div className={styles.infoColumns}>
                          <article className={styles.infoBlock}>
                            <span className={styles.infoBlockLabel}>
                              Mã nhóm
                            </span>
                            <strong>{groupDetails.nhomId ?? "-"}</strong>
                          </article>

                          <article className={styles.infoBlock}>
                            <span className={styles.infoBlockLabel}>
                              Số lượng thành viên
                            </span>
                            <strong>
                              {groupDetails.soLuongTv ?? members.length ?? 0}
                            </strong>
                          </article>
                        </div>

                        <article className={styles.descriptionCard}>
                          <header>
                            <span>Giới thiệu</span>
                          </header>
                          <p>
                            {groupDetails.moTa &&
                            groupDetails.moTa.trim().length > 0
                              ? groupDetails.moTa
                              : "Nhóm chưa có mô tả. Hãy cập nhật để mọi người hiểu rõ mục tiêu và tiêu chí hoạt động."}
                          </p>
                        </article>
                      </div>
                    </section>

                    {isLeader && (
                      <div className={styles.groupActionsRow}>
                        <button
                          className={`${styles.actionBtn} ${styles.editAction}`}
                          onClick={() => setShowEditGroup(true)}
                        >
                          ✏️ Chỉnh sửa thông tin nhóm
                        </button>
                        <button
                          className={`${styles.actionBtn} ${styles.deleteAction}`}
                          onClick={() => {
                            setConfirmDialog({
                              open: true,
                              title: "Xoá nhóm",
                              message: `Bạn có chắc muốn xoá nhóm "${groupDetails.tenNhom}"?`,
                              confirmLabel: "Xoá",
                              cancelLabel: "Hủy",
                              onConfirm: async () => {
                                try {
                                  await api.delete(
                                    `/Nhom/DeleteGroup/${groupDetails.nhomId}`
                                  );
                                  toast.success("Xoá nhóm thành công!");
                                  setRefreshGroups((prev) => prev + 1);
                                  setSelectedGroup(null);
                                } catch (error: any) {
                                  console.error("Delete group failed:", error);
                                  toast.error(
                                    error?.response?.data?.message ||
                                      "Có lỗi khi xóa nhóm!"
                                  );
                                }
                              },
                            });
                          }}
                        >
                          🗑️ Xoá nhóm
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyStateIcon}>
                      <FaSpinner className={styles.spinning} />
                    </div>
                    <h3 className={styles.emptyStateTitle}>
                      Đang tải chi tiết nhóm...
                    </h3>
                    <p className={styles.emptyStateMessage}>
                      Vui lòng đợi trong giây lát
                    </p>
                  </div>
                )
              ) : (
                <div className={styles.emptyState}>
                  <div className={styles.emptyStateIcon}>
                    <FaFolderOpen />
                  </div>
                  <h3 className={styles.emptyStateTitle}>Chưa chọn nhóm</h3>
                  <p className={styles.emptyStateMessage}>
                    Vui lòng chọn một nhóm từ danh sách để xem chi tiết
                  </p>
                </div>
              )
            ) : activeTab === "ThanhVien" ? (
              selectedGroup ? (
                <div className={styles.membersPanel}>
                  <header className={styles.membersHeader}>
                    <div>
                      <span className={styles.sectionTag}>Đội ngũ</span>
                      <h2>Quản lý thành viên</h2>
                      <p>
                        Theo dõi thông tin, phân quyền và duy trì hoạt động của
                        nhóm một cách linh hoạt.
                      </p>
                    </div>
                    {isLeader && (
                      <button
                        className={styles.addMemberBtn}
                        onClick={() => setShowAddMember(true)}
                        type="button"
                      >
                        ➕ Mời thành viên
                      </button>
                    )}
                  </header>

                  <div className={styles.memberControls}>
                    <div className={styles.controlGroup}>
                      <label
                        className={styles.controlLabel}
                        htmlFor="member-search"
                      >
                        Tìm kiếm
                      </label>
                      <input
                        id="member-search"
                        type="text"
                        placeholder="Nhập tên hoặc email"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={styles.controlInput}
                      />
                    </div>
                    <div className={styles.controlGroup}>
                      <label
                        className={styles.controlLabel}
                        htmlFor="member-sort"
                      >
                        Sắp xếp
                      </label>
                      <select
                        id="member-sort"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className={styles.controlSelect}
                      >
                        <option value="hoTen">Theo tên</option>
                        <option value="chucVu">Theo chức vụ</option>
                        <option value="ngayThamGia">Theo ngày tham gia</option>
                      </select>
                    </div>
                    <div className={styles.controlGroup}>
                      <label
                        className={styles.controlLabel}
                        htmlFor="member-filter"
                      >
                        Lọc chức vụ
                      </label>
                      <select
                        id="member-filter"
                        value={filterBy}
                        onChange={(e) => setFilterBy(e.target.value)}
                        className={styles.controlSelect}
                      >
                        <option value="all">Tất cả</option>
                        <option value="Trưởng nhóm">Trưởng nhóm</option>
                        <option value="Thành viên">Thành viên</option>
                      </select>
                    </div>
                  </div>

                  <div className={styles.membersSummary}>
                    <h3>Thành viên ({filteredAndSortedMembers.length})</h3>
                    <span>Danh sách cập nhật mỗi 3 giây</span>
                  </div>

                  <ul className={styles.memberGrid}>
                    {paginatedMembers.length > 0 ? (
                      paginatedMembers.map((member) => {
                        const avatarUrl = resolveMediaUrl(member.anhBia);

                        return (
                          <li
                            key={member.thanhVienId}
                            className={styles.memberCard}
                          >
                            <div
                              className={`${styles.memberAvatar} ${avatarUrl ? styles.hasImage : ""}`}
                            >
                              {avatarUrl ? (
                                <img
                                  src={avatarUrl}
                                  alt={`Ảnh thành viên ${member.hoTen}`}
                                />
                              ) : (
                                <span aria-hidden>👤</span>
                              )}
                            </div>
                            <div className={styles.memberContent}>
                              <div className={styles.memberRow}>
                                <div className={styles.memberField}>
                                  <span className={styles.memberFieldLabel}>
                                    Tên thành viên
                                  </span>
                                  <span className={styles.memberFieldValue}>
                                    {member.hoTen}
                                  </span>
                                </div>
                                <div className={styles.memberField}>
                                  <span className={styles.memberFieldLabel}>
                                    Chức vụ
                                  </span>
                                  <span className={styles.memberBadge}>
                                    {member.chucVu}
                                  </span>
                                </div>
                              </div>
                              <div className={styles.memberRow}>
                                <div className={styles.memberField}>
                                  <span className={styles.memberFieldLabel}>
                                    Chuyên môn
                                  </span>
                                  <span className={styles.memberFieldValue}>
                                    {member.chuyenMon
                                      ? member.chuyenMon.tenChuyenMon
                                      : "Chưa cập nhật"}
                                  </span>
                                </div>
                                <div className={styles.memberField}>
                                  <span className={styles.memberFieldLabel}>
                                    Ngày tham gia
                                  </span>
                                  <span className={styles.memberFieldValue}>
                                    {member.ngayThamGia}
                                  </span>
                                </div>
                              </div>
                            </div>
                            {isLeader &&
                              member.thanhVienId !== currentUserId && (
                                <button
                                  className={styles.memberRemoveBtn}
                                  onClick={() => {
                                    setConfirmDialog({
                                      open: true,
                                      title: "Xoá thành viên",
                                      message: `Bạn có chắc muốn xoá thành viên "${member.hoTen}"?\n\nNếu xoá thành viên này thì mọi công việc trong dự án mà người đó phụ trách sẽ bị xoá theo. Chúng tôi khuyên bạn hãy thay đổi người phân công xong mới xoá.`,
                                      confirmLabel: "Xoá",
                                      cancelLabel: "Hủy",
                                      onConfirm: async () => {
                                        try {
                                          await api.delete(
                                            `/ThanhVien/KickThanhVienKhoiNhom/${selectedGroup.nhomId}/${member.thanhVienId}`
                                          );
                                          toast.success(
                                            "Xoá thành viên thành công!"
                                          );
                                          const response = await api.get(
                                            `/Nhom/${selectedGroup.nhomId}/ThanhVien`
                                          );
                                          setMembers(response.data);
                                        } catch (error: any) {
                                          console.error(
                                            "Delete member failed:",
                                            error
                                          );
                                          toast.error(
                                            "Có lỗi khi xoá thành viên!"
                                          );
                                        }
                                      },
                                    });
                                  }}
                                  type="button"
                                  aria-label={`Xoá thành viên ${member.hoTen}`}
                                >
                                  🗑️
                                </button>
                              )}
                          </li>
                        );
                      })
                    ) : (
                      <li className={styles.noMembers}>
                        Không tìm thấy thành viên nào.
                      </li>
                    )}
                  </ul>
                  {totalPages > 1 && (
                    <div className={styles.pagination}>
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className={styles.pageBtn}
                        type="button"
                      >
                        Trước
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                        (page) => (
                          <button
                            key={page}
                            onClick={() => handlePageChange(page)}
                            className={`${styles.pageBtn} ${currentPage === page ? styles.activePage : ""}`}
                            type="button"
                          >
                            {page}
                          </button>
                        )
                      )}
                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className={styles.pageBtn}
                        type="button"
                      >
                        Sau
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <div className={styles.emptyStateIcon}>
                    <FaUsers />
                  </div>
                  <h3 className={styles.emptyStateTitle}>Chưa chọn nhóm</h3>
                  <p className={styles.emptyStateMessage}>
                    Vui lòng chọn một nhóm từ danh sách để xem danh sách thành
                    viên
                  </p>
                </div>
              )
            ) : activeTab === "DuAn" ? (
              selectedGroup ? (
                <section className={styles.projectsSection}>
                  <header className={styles.projectsHeader}>
                    <div>
                      <span className={styles.sectionTag}>Dự án</span>
                      <h2>Theo dõi tiến độ nhóm</h2>
                      <p>
                        Quản lý danh sách dự án, lọc theo trạng thái và lĩnh vực
                        để nắm bắt tiến độ nhanh chóng.
                      </p>
                    </div>
                    {isLeader && (
                      <button
                        className={styles.primaryAction}
                        onClick={() => setShowCreateProject(true)}
                        type="button"
                      >
                        ➕ Tạo dự án
                      </button>
                    )}
                  </header>

                  <div className={styles.projectControls}>
                    <div className={styles.projectControlGroup}>
                      <label
                        htmlFor="project-search"
                        className={styles.controlLabel}
                      >
                        Tìm kiếm
                      </label>
                      <input
                        id="project-search"
                        type="text"
                        placeholder="Nhập tên dự án"
                        value={projectSearchTerm}
                        onChange={(e) => setProjectSearchTerm(e.target.value)}
                        className={styles.controlInput}
                      />
                    </div>
                    <div className={styles.projectControlGroup}>
                      <label
                        htmlFor="project-sort"
                        className={styles.controlLabel}
                      >
                        Sắp xếp
                      </label>
                      <select
                        id="project-sort"
                        value={projectSortBy}
                        onChange={(e) => setProjectSortBy(e.target.value)}
                        className={styles.controlSelect}
                      >
                        <option value="tenDuAn">Theo tên</option>
                        <option value="ngayBd">Theo ngày bắt đầu</option>
                        <option value="trangThai">Theo trạng thái</option>
                      </select>
                    </div>
                    <div className={styles.projectControlGroup}>
                      <label
                        htmlFor="project-status"
                        className={styles.controlLabel}
                      >
                        Trạng thái
                      </label>
                      <select
                        id="project-status"
                        value={projectFilterBy}
                        onChange={(e) => setProjectFilterBy(e.target.value)}
                        className={styles.controlSelect}
                      >
                        <option value="all">Tất cả</option>
                        <option value="Đang thực hiện">Đang thực hiện</option>
                        <option value="Hoàn thành">Hoàn thành</option>
                        <option value="Tạm dừng">Tạm dừng</option>
                      </select>
                    </div>
                    <div
                      className={`${styles.projectControlGroup} ${styles.linhVucControl}`}
                    >
                      <span
                        id="project-field-label"
                        className={styles.controlLabel}
                      >
                        Lĩnh vực
                      </span>
                      <div
                        className={styles.fieldCarousel}
                        aria-labelledby="project-field-label"
                      >
                        <button
                          type="button"
                          className={styles.carouselButton}
                          onClick={() => scrollLinhVucCarousel("prev")}
                          aria-label="Xem lĩnh vực trước"
                        >
                          ◀
                        </button>
                        <div
                          className={styles.fieldTrack}
                          ref={linhVucCarouselRef}
                          role="listbox"
                          aria-label="Lọc dự án theo lĩnh vực"
                        >
                          <button
                            type="button"
                            className={`${styles.fieldChip} ${
                              projectLinhVucFilter === "all"
                                ? styles.activeFieldChip
                                : ""
                            }`}
                            onClick={() => setProjectLinhVucFilter("all")}
                            role="option"
                            aria-selected={projectLinhVucFilter === "all"}
                          >
                            Tất cả
                          </button>
                          {linhVucList.map((lv) => {
                            const idKey = buildLinhVucKey(
                              lv?.linhVucId,
                              undefined
                            );
                            const nameKey = buildLinhVucKey(
                              undefined,
                              lv?.tenLinhVuc
                            );
                            const chipKey = nameKey || idKey;
                            const synonyms = [idKey, nameKey].filter(
                              (value): value is string => Boolean(value)
                            );
                            const isActive =
                              projectLinhVucFilter !== "all" &&
                              synonyms.includes(projectLinhVucFilter);
                            return (
                              <button
                                type="button"
                                key={lv?.linhVucId ?? lv?.tenLinhVuc}
                                className={`${styles.fieldChip} ${isActive ? styles.activeFieldChip : ""}`}
                                onClick={() =>
                                  setProjectLinhVucFilter(
                                    chipKey || idKey || "all"
                                  )
                                }
                                role="option"
                                aria-selected={isActive}
                              >
                                {lv?.tenLinhVuc || "Không xác định"}
                              </button>
                            );
                          })}
                        </div>
                        <button
                          type="button"
                          className={styles.carouselButton}
                          onClick={() => scrollLinhVucCarousel("next")}
                          aria-label="Xem lĩnh vực tiếp theo"
                        >
                          ▶
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className={styles.projectsSummary}>
                    <h3>Dự án nhóm ({filteredAndSortedProjects.length})</h3>
                    <span>Chạm để xem chi tiết và chỉnh sửa</span>
                  </div>

                  <ul className={styles.projectGrid}>
                    {paginatedProjects.length > 0 ? (
                      paginatedProjects.map((project) => (
                        <li
                          key={project.duAnId}
                          className={styles.projectCard}
                          onClick={() => {
                            if (project) {
                              setShowProjectDetail({ project, open: true });
                            }
                          }}
                        >
                          <article className={styles.projectContent}>
                            <div className={styles.projectMedia}>
                              <img
                                src={
                                  project.anhBia
                                    ? `https://localhost:7036${project.anhBia}`
                                    : img_project_default
                                }
                                alt={project.tenDuAn}
                              />
                            </div>
                            <div className={styles.projectBody}>
                              <header>
                                <h4>{project.tenDuAn}</h4>
                              </header>
                              <p className={styles.projectDescription}>
                                {project.moTa || "Chưa có mô tả"}
                              </p>
                              <span
                                className={`${styles.projectStatus} ${getProjectStatusClass(project.trangThai)}`.trim()}
                              >
                                {project.trangThai}
                              </span>
                              <dl className={styles.projectMeta}>
                                <div>
                                  <dt>Ngày bắt đầu</dt>
                                  <dd>{project.ngayBd || "-"}</dd>
                                </div>
                                <div>
                                  <dt>Ngày kết thúc</dt>
                                  <dd>{project.ngayKt || "-"}</dd>
                                </div>
                                <div>
                                  <dt>Lĩnh vực</dt>
                                  <dd>
                                    {project.tenLinhVuc?.trim()?.length
                                      ? project.tenLinhVuc
                                      : linhVucList.find(
                                          (lv) =>
                                            String(lv.linhVucId) ===
                                            String(project.linhVucId)
                                        )?.tenLinhVuc || "Chưa cập nhật"}
                                  </dd>
                                </div>
                              </dl>
                            </div>
                            {isLeader && (
                              <div className={styles.projectActions}>
                                <button
                                  type="button"
                                  className={styles.editProjectBtn}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedProject(project);
                                    setShowEditProject(true);
                                  }}
                                >
                                  ✏️
                                </button>
                                <button
                                  type="button"
                                  className={styles.deleteProjectBtn}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDialog({
                                      open: true,
                                      title: "Xoá dự án",
                                      message: `Bạn có chắc muốn xoá dự án "${project.tenDuAn}"?\n\nNếu xoá dự án này thì các dữ liệu công việc của bạn cũng bị xoá theo.`,
                                      confirmLabel: "Xoá",
                                      cancelLabel: "Hủy",
                                      onConfirm: async () => {
                                        try {
                                          await api.delete(
                                            `/DuAn/DeleteDuAn/${project.duAnId}`
                                          );
                                          toast.success(
                                            "Xoá dự án thành công!"
                                          );
                                          if (selectedGroup) {
                                            const response = await api.get(
                                              `/DuAn/GetProjectsOfGroup/${selectedGroup.nhomId}`
                                            );
                                            setProjects(
                                              response.data.projects || []
                                            );
                                          }
                                        } catch (error: any) {
                                          console.error(
                                            "Delete project failed:",
                                            error
                                          );
                                          toast.error(
                                            error?.response?.data?.message ||
                                              "Có lỗi khi xoá dự án!"
                                          );
                                        }
                                      },
                                    });
                                  }}
                                >
                                  🗑️
                                </button>
                              </div>
                            )}
                          </article>
                        </li>
                      ))
                    ) : (
                      <li className={styles.emptyProjectItem}>
                        <div className={styles.emptyState}>
                          <div className={styles.emptyStateIcon}>
                            <FaFolderOpen />
                          </div>
                          <h3 className={styles.emptyStateTitle}>
                            Chưa có dự án nào
                          </h3>
                          <p className={styles.emptyStateMessage}>
                            {isLeader
                              ? "Hãy tạo dự án đầu tiên để bắt đầu quản lý công việc nhóm"
                              : "Nhóm này chưa có dự án nào được tạo"}
                          </p>
                        </div>
                      </li>
                    )}
                  </ul>
                  {projectTotalPages > 1 && (
                    <div className={styles.pagination}>
                      <button
                        onClick={() =>
                          handleProjectPageChange(projectCurrentPage - 1)
                        }
                        disabled={projectCurrentPage === 1}
                        className={styles.pageBtn}
                      >
                        Trước
                      </button>
                      {Array.from(
                        { length: projectTotalPages },
                        (_, i) => i + 1
                      ).map((page) => (
                        <button
                          key={page}
                          onClick={() => handleProjectPageChange(page)}
                          className={`${styles.pageBtn} ${projectCurrentPage === page ? styles.activePage : ""}`}
                        >
                          {page}
                        </button>
                      ))}
                      <button
                        onClick={() =>
                          handleProjectPageChange(projectCurrentPage + 1)
                        }
                        disabled={projectCurrentPage === projectTotalPages}
                        className={styles.pageBtn}
                      >
                        Sau
                      </button>
                    </div>
                  )}
                </section>
              ) : (
                <div className={styles.emptyState}>
                  <div className={styles.emptyStateIcon}>
                    <FaFolderOpen />
                  </div>
                  <h3 className={styles.emptyStateTitle}>Chưa chọn nhóm</h3>
                  <p className={styles.emptyStateMessage}>
                    Vui lòng chọn một nhóm từ danh sách để quản lý dự án
                  </p>
                </div>
              )
            ) : activeTab === "ThongKeDuAn" ? (
              selectedGroup ? (
                <ProjectDashboard nhomId={selectedGroup.nhomId} />
              ) : (
                <div className={styles.emptyState}>
                  <div className={styles.emptyStateIcon}>
                    <FaChartBar />
                  </div>
                  <h3 className={styles.emptyStateTitle}>Chưa chọn nhóm</h3>
                  <p className={styles.emptyStateMessage}>
                    Vui lòng chọn một nhóm từ danh sách để xem tổng quan dự án
                  </p>
                </div>
              )
            ) : activeTab === "BackupDuAn" ? (
              <p>Tab này đã được thay thế bằng tab Tổng quan dự án.</p>
            ) : (
              <Navigate to="/login" replace />
            )}
          </div>
        </div>
      </div>
      {showEditProfile && (
        <Modal
          onClose={() => setShowEditProfile(false)}
          isOpen={showEditProfile}
        >
          <EditProfile onSuccess={() => setShowEditProfile(false)} />
        </Modal>
      )}
      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
        accountId={Number(currentUser?.UserId) || null}
      />
      <NotificationsModal
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        notifications={notifications}
        loading={notificationsLoading}
        error={notificationsError}
        onRefresh={fetchNotifications}
        onMarkAsRead={handleMarkAsRead}
        markingNotificationId={markingNotificationId}
        onMarkAllAsRead={handleMarkAllAsRead}
        markingAll={markingAllNotifications}
        onTogglePin={handleTogglePin}
        pinningNotificationId={pinningNotificationId}
        onDeleteNotification={handleDeleteNotification}
        deletingNotificationId={deletingNotificationId}
      />
      <Modal
        isOpen={confirmDialog.open}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
      >
        <div className={styles.confirmDialog}>
          <h3>{confirmDialog.title}</h3>
          <p>{confirmDialog.message}</p>
          <div className={styles.confirmActions}>
            <button
              type="button"
              className={styles.confirmCancelBtn}
              onClick={() =>
                setConfirmDialog((prev) => ({ ...prev, open: false }))
              }
            >
              {confirmDialog.cancelLabel || "Hủy"}
            </button>
            <button
              type="button"
              className={styles.confirmAcceptBtn}
              onClick={async () => {
                setConfirmDialog((prev) => ({ ...prev, open: false }));
                await confirmDialog.onConfirm();
              }}
            >
              {confirmDialog.confirmLabel || "Xác nhận"}
            </button>
          </div>
        </div>
      </Modal>
      <IntroduceModal
        isOpen={showIntroduce}
        onDismiss={() => setShowIntroduce(false)}
        onProfileUpdated={() => setShowIntroduce(false)}
      />
      <CreateGroupModal
        isOpen={showGroupCreate}
        onClose={() => setShowGroupCreate(false)}
        onSuccess={() => {
          setShowGroupCreate(false);
          setRefreshGroups((prev) => prev + 1); // Trigger refresh
        }}
      />
      <EditGroupModal
        isOpen={showEditGroup}
        onClose={() => setShowEditGroup(false)}
        onSuccess={() => {
          setShowEditGroup(false);
          setRefreshGroups((prev) => prev + 1); // Trigger refresh
        }}
        groupData={groupDetails}
      />
      <AddMemberModal
        isOpen={showAddMember}
        onClose={() => setShowAddMember(false)}
        onSuccess={() => {
          if (selectedGroup) {
            api
              .get(`/Nhom/${selectedGroup.nhomId}/ThanhVien`)
              .then((response) => setMembers(response.data))
              .catch((error) =>
                console.error("Error fetching members:", error)
              );
          }
        }}
        nhomId={selectedGroup?.nhomId || 0}
      />
      <InvitationsModal
        isOpen={showInvitations}
        onClose={() => setShowInvitations(false)}
        onRefreshGroups={() => setRefreshGroups((prev) => prev + 1)}
        onUpdateCount={setInvitationCount}
      />
      <CreateProjectModal
        isOpen={showCreateProject}
        onClose={() => setShowCreateProject(false)}
        onSuccess={() => {
          setShowCreateProject(false);
          // Refresh projects
          if (selectedGroup) {
            api
              .get(`/DuAn/GetProjectsOfGroup/${selectedGroup.nhomId}`)
              .then((response) => setProjects(response.data.projects || []))
              .catch((error) =>
                console.error("Error fetching projects:", error)
              );
          }
        }}
        nhomId={selectedGroup?.nhomId || 0}
      />
      <EditProjectModal
        isOpen={showEditProject}
        onClose={() => setShowEditProject(false)}
        onSuccess={() => {
          setShowEditProject(false);
          // Refresh projects
          if (selectedGroup) {
            api
              .get(`/DuAn/GetProjectsOfGroup/${selectedGroup.nhomId}`)
              .then((response) => setProjects(response.data.projects || []))
              .catch((error) =>
                console.error("Error fetching projects:", error)
              );
          }
        }}
        project={selectedProject}
      />
      {showProjectDetail.open && (
        <ProjectDetailModal
          open={showProjectDetail.open}
          onClose={() => setShowProjectDetail({ project: null, open: false })}
          project={showProjectDetail.project!}
          nhomId={selectedGroup?.nhomId || 0}
        />
      )}
    </>
  );
};

export default MainPage;
