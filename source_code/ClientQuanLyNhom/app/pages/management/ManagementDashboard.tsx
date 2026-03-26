import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  FaUsersCog,
  FaTasks,
  FaSignOutAlt,
  FaKey,
  FaUnlock,
} from "react-icons/fa";
import { MdRefresh, MdDownload, MdUpload } from "react-icons/md";
import {
  FiSearch,
  FiEye,
  FiEdit,
  FiLock,
  FiTrash2,
  FiUserCheck,
} from "react-icons/fi";
import { toast } from "react-toastify";
import { useNavigate } from "react-router";
import styles from "./ManagementDashboard.module.scss";

const BACKUP_SCHEDULE_STORAGE_KEY = "cyber_admin_backup_schedule";

const BACKUP_INTERVAL_OPTIONS = [
  { value: 15, label: "15 phút" },
  { value: 60, label: "1 giờ" },
  { value: 180, label: "3 giờ" },
  { value: 360, label: "6 giờ" },
  { value: 720, label: "12 giờ" },
  { value: 1440, label: "1 ngày" },
  { value: 4320, label: "3 ngày" },
  { value: 10080, label: "1 tuần" },
];

const formatTimeUntil = (isoString: string): string => {
  const target = new Date(isoString).getTime();
  if (Number.isNaN(target)) return "--";

  const diffMs = target - Date.now();
  if (diffMs <= 0) {
    return "ngay bây giờ";
  }

  const totalMinutes = Math.round(diffMs / 60000);
  if (totalMinutes < 60) {
    return `còn ${totalMinutes} phút`;
  }

  const totalHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (totalHours < 24) {
    return minutes
      ? `còn ${totalHours} giờ ${minutes} phút`
      : `còn ${totalHours} giờ`;
  }

  const totalDays = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (totalDays < 7) {
    return hours
      ? `còn ${totalDays} ngày ${hours} giờ`
      : `còn ${totalDays} ngày`;
  }

  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;
  if (weeks < 5) {
    return days ? `còn ${weeks} tuần ${days} ngày` : `còn ${weeks} tuần`;
  }

  return `còn ${totalDays} ngày`;
};

interface AdminAccount {
  taiKhoanId: number;
  tenTaiKhoan: string;
  email: string;
  trangThai: boolean;
  loaiTaiKhoan: string;
  quyenId: number;
  tenQuyen: string;
  ngayTao: string | null;
  lanDangNhapGanNhat: string | null;
  thanhVien?: {
    thanhVienId: number;
    hoTen: string | null;
    gioiTinh: string | null;
    ngaySinh: string | null;
    sdt: string | null;
    diaChi: string | null;
    chuyenMonId: number | null;
    anhBia: string | null;
  } | null;
}

interface PasswordResetRequest {
  notificationId: string;
  createdAt: string;
  tenTaiKhoan: string;
  hoTen: string;
  email: string | null;
  soDienThoai: string | null;
  lyDo: string;
}

const ManagementDashboard = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "members" | "unlock" | "reset-password" | "backup" | "restore"
  >("members");
  const [specializations, setSpecializations] = useState<
    Record<number, string>
  >({});
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [sortKey, setSortKey] = useState<
    "id" | "username" | "email" | "role" | "name"
  >("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [membersPage, setMembersPage] = useState(1);
  const [membersPageSize, setMembersPageSize] = useState(10);
  const [selectedAccount, setSelectedAccount] = useState<AdminAccount | null>(
    null
  );
  const [banTarget, setBanTarget] = useState<AdminAccount | null>(null);
  const [banLoading, setBanLoading] = useState(false);
  const [bannedAccounts, setBannedAccounts] = useState<AdminAccount[]>([]);
  const [bannedLoading, setBannedLoading] = useState(false);
  const [bannedError, setBannedError] = useState<string | null>(null);
  const [unbanTarget, setUnbanTarget] = useState<AdminAccount | null>(null);
  const [unbanLoading, setUnbanLoading] = useState(false);
  const [bannedSearchTerm, setBannedSearchTerm] = useState("");
  const [bannedRoleFilter, setBannedRoleFilter] = useState<string>("all");
  const [bannedSortKey, setBannedSortKey] = useState<
    "id" | "username" | "email" | "role" | "name"
  >("id");
  const [bannedSortDir, setBannedSortDir] = useState<"asc" | "desc">("asc");
  const [bannedPage, setBannedPage] = useState(1);
  const [bannedPageSize, setBannedPageSize] = useState(10);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [lastBackupInfo, setLastBackupInfo] = useState<{
    filename: string;
    size: number | null;
    timestamp: string;
  }>();
  const [backupType, setBackupType] = useState<"full" | "incremental">("full");
  const [incrementalStartDate, setIncrementalStartDate] = useState("");
  const [incrementalEndDate, setIncrementalEndDate] = useState("");
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleInterval, setScheduleInterval] = useState(1440);
  const [nextScheduledRun, setNextScheduledRun] = useState<string | null>(null);
  const scheduleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [resetRequests, setResetRequests] = useState<PasswordResetRequest[]>(
    []
  );
  const [resetRequestsLoading, setResetRequestsLoading] = useState(false);
  const [resetRequestsError, setResetRequestsError] = useState<string | null>(
    null
  );
  const [restoreTab, setRestoreTab] = useState<"requests" | "accounts">(
    "requests"
  );
  const [resetRequestsSearchTerm, setResetRequestsSearchTerm] = useState("");
  const [resetRequestsSortDir, setResetRequestsSortDir] = useState<
    "desc" | "asc"
  >("desc");
  const [resetRequestsPage, setResetRequestsPage] = useState(1);
  const [resetRequestsPageSize, setResetRequestsPageSize] = useState(5);
  const [restoreAccountSearch, setRestoreAccountSearch] = useState("");
  const [restoreAccountStatus, setRestoreAccountStatus] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [restoreAccountSort, setRestoreAccountSort] = useState<
    | "id-desc"
    | "id-asc"
    | "username-asc"
    | "username-desc"
    | "email-asc"
    | "email-desc"
  >("id-desc");
  const [restoreAccountPage, setRestoreAccountPage] = useState(1);
  const [restoreAccountPageSize, setRestoreAccountPageSize] = useState(10);
  const [deletingNotificationId, setDeletingNotificationId] = useState<
    string | null
  >(null);
  const [deletingAccountId, setDeletingAccountId] = useState<number | null>(
    null
  );
  const [deleteAccountTarget, setDeleteAccountTarget] =
    useState<AdminAccount | null>(null);
  const [resetPasswordTarget, setResetPasswordTarget] = useState<{
    taiKhoanId: number;
    tenTaiKhoan: string;
  } | null>(null);
  const [showCreateAccountModal, setShowCreateAccountModal] = useState(false);
  const [createAccountLoading, setCreateAccountLoading] = useState(false);
  const [createAccountData, setCreateAccountData] = useState({
    tenTaiKhoan: "",
    email: "",
    hoTen: "",
    gioiTinh: "",
    sdt: "",
    diaChi: "",
    chuyenMonId: 0,
    quyenId: 0,
  });
  const [availableRoles, setAvailableRoles] = useState<
    Array<{ quyenId: number; tenQuyen: string; moTa: string | null }>
  >([]);

  // Chỉnh sửa tài khoản
  const [showEditAccountModal, setShowEditAccountModal] = useState(false);
  const [editAccountLoading, setEditAccountLoading] = useState(false);
  const [editAccountData, setEditAccountData] = useState<{
    taiKhoanId: number;
    tenTaiKhoan: string;
    email: string;
    hoTen: string;
    gioiTinh: string;
    ngaySinh: string;
    sdt: string;
    diaChi: string;
    chuyenMonId: number;
  }>({
    taiKhoanId: 0,
    tenTaiKhoan: "",
    email: "",
    hoTen: "",
    gioiTinh: "",
    ngaySinh: "",
    sdt: "",
    diaChi: "",
    chuyenMonId: 0,
  });

  // Đổi mật khẩu
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [changePasswordData, setChangePasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Xem & Chỉnh sửa thông tin admin
  const [showAdminProfileModal, setShowAdminProfileModal] = useState(false);
  const [isEditingAdminProfile, setIsEditingAdminProfile] = useState(false);
  const [adminProfileLoading, setAdminProfileLoading] = useState(false);
  const [adminProfileData, setAdminProfileData] = useState<{
    taiKhoanId: number;
    tenTaiKhoan: string;
    email: string;
    hoTen: string;
    gioiTinh: string;
    ngaySinh: string;
    sdt: string;
    diaChi: string;
    chuyenMonId: number;
  }>({
    taiKhoanId: 0,
    tenTaiKhoan: "",
    email: "",
    hoTen: "",
    gioiTinh: "",
    ngaySinh: "",
    sdt: "",
    diaChi: "",
    chuyenMonId: 0,
  });

  // Phân quyền
  const [changeRoleTarget, setChangeRoleTarget] = useState<AdminAccount | null>(
    null
  );
  const [changeRoleLoading, setChangeRoleLoading] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<number>(0);

  const fetchAccounts = async () => {
    try {
      const hasSession = localStorage.getItem("adminSession") === "true";
      if (!hasSession) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const response = await axios.get(
        "https://localhost:7036/api/Admin/accounts"
      );
      const data = Array.isArray(response.data?.data) ? response.data.data : [];
      setAccounts(data);
      setError(null);
      setLastSyncedAt(new Date().toISOString());
    } catch (err) {
      console.error("Failed to load admin accounts", err);
      setError("Không thể tải danh sách tài khoản");
      toast.error("Không thể tải danh sách tài khoản");
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await axios.get(
        "https://localhost:7036/api/Admin/roles"
      );
      const data = Array.isArray(response.data?.data) ? response.data.data : [];
      setAvailableRoles(data);
    } catch (error) {
      console.error("Failed to load roles", error);
      toast.error("Không thể tải danh sách quyền");
    }
  };

  const fetchResetPasswordRequests = async () => {
    try {
      setResetRequestsLoading(true);
      const response = await axios.get(
        "https://localhost:7036/api/Admin/reset-password-requests"
      );
      const data = Array.isArray(response.data?.data) ? response.data.data : [];
      setResetRequests(data);
      setResetRequestsError(null);
    } catch (error) {
      console.error("Failed to load reset password requests", error);
      const message =
        axios.isAxiosError(error) && error.response?.data?.message
          ? error.response.data.message
          : "Không thể tải danh sách yêu cầu reset mật khẩu";
      setResetRequestsError(message);
      toast.error(message);
    } finally {
      setResetRequestsLoading(false);
    }
  };

  const handleConfirmUnban = async () => {
    if (!unbanTarget) return;

    try {
      setUnbanLoading(true);
      await axios.patch(
        `https://localhost:7036/api/Admin/accounts/${unbanTarget.taiKhoanId}/unban`
      );
      toast.success(`Đã mở khoá tài khoản ${unbanTarget.tenTaiKhoan}`);
      setUnbanTarget(null);
      void fetchAccounts();
      void fetchBannedAccounts();
    } catch (error) {
      console.error("Unban account failed", error);
      const message =
        axios.isAxiosError(error) && error.response?.data?.message
          ? error.response.data.message
          : "Không thể mở khoá tài khoản, vui lòng thử lại";
      toast.error(message);
    } finally {
      setUnbanLoading(false);
    }
  };

  const fetchBannedAccounts = async () => {
    try {
      setBannedLoading(true);
      const response = await axios.get(
        "https://localhost:7036/api/Admin/accounts/banned"
      );
      const data = Array.isArray(response.data?.data) ? response.data.data : [];
      setBannedAccounts(data);
      setBannedError(null);
    } catch (error) {
      console.error("Failed to load banned accounts", error);
      setBannedError("Không thể tải danh sách tài khoản bị khoá");
      toast.error("Không thể tải danh sách tài khoản bị khoá");
    } finally {
      setBannedLoading(false);
    }
  };

  const handleToggleSchedule = () => {
    setScheduleEnabled((prev) => {
      const next = !prev;
      if (next) {
        setNextScheduledRun(null);
      } else {
        cancelScheduledRun();
      }
      return next;
    });
  };

  const handleScheduleIntervalChange = (value: number) => {
    setScheduleInterval(value);
    setNextScheduledRun(null);
  };

  const handleRescheduleFromNow = () => {
    if (!scheduleEnabled) {
      toast.info("Bật chế độ sao lưu định kỳ để đặt lại lịch");
      return;
    }
    scheduleNextRun();
    toast.success("Đã cập nhật thời gian chạy kế tiếp từ hiện tại");
  };

  const handleSignOut = () => {
    cancelScheduledRun();
    localStorage.removeItem("adminSession");
    toast.success("Đăng xuất quản trị thành công");
    navigate("/admin", { replace: true });
  };

  const handleChangePassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const { currentPassword, newPassword, confirmPassword } =
      changePasswordData;

    if (
      !currentPassword.trim() ||
      !newPassword.trim() ||
      !confirmPassword.trim()
    ) {
      toast.error("Vui lòng điền đầy đủ thông tin");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Mật khẩu mới và xác nhận mật khẩu không khớp");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Mật khẩu mới phải có ít nhất 6 ký tự");
      return;
    }

    if (newPassword === currentPassword) {
      toast.error("Mật khẩu mới phải khác mật khẩu hiện tại");
      return;
    }

    const adminEmail = localStorage.getItem("adminEmail");
    if (!adminEmail) {
      toast.error(
        "Không tìm thấy thông tin tài khoản. Vui lòng đăng nhập lại."
      );
      return;
    }

    try {
      setChangePasswordLoading(true);
      await axios.post("https://localhost:7036/api/Admin/change-password", {
        email: adminEmail,
        currentPassword,
        newPassword,
      });

      toast.success("Đổi mật khẩu thành công!");
      setShowChangePasswordModal(false);
      setChangePasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      console.error("Change password failed:", error);
      const message =
        axios.isAxiosError(error) && error.response?.data
          ? error.response.data
          : "Không thể đổi mật khẩu. Vui lòng kiểm tra mật khẩu hiện tại";
      toast.error(message);
    } finally {
      setChangePasswordLoading(false);
    }
  };

  const handleOpenAdminProfile = async () => {
    const adminEmail = localStorage.getItem("adminEmail");
    if (!adminEmail) {
      toast.error("Không tìm thấy thông tin tài khoản.");
      return;
    }

    try {
      setAdminProfileLoading(true);
      // Gọi API riêng để lấy thông tin admin
      const response = await axios.get(
        `https://localhost:7036/api/Admin/profile?email=${encodeURIComponent(adminEmail)}`
      );

      const adminAccount = response.data?.data;

      if (!adminAccount) {
        setAdminProfileData({
          taiKhoanId: 0,
          tenTaiKhoan: "",
          email: adminEmail,
          hoTen: "",
          gioiTinh: "",
          ngaySinh: "",
          sdt: "",
          diaChi: "",
          chuyenMonId: 0,
        });
      } else {
        setAdminProfileData({
          taiKhoanId: adminAccount.taiKhoanId || 0,
          tenTaiKhoan: adminAccount.tenTaiKhoan || "",
          email: adminAccount.email || adminEmail,
          hoTen: adminAccount.thanhVien?.hoTen || "",
          gioiTinh: adminAccount.thanhVien?.gioiTinh || "",
          ngaySinh: adminAccount.thanhVien?.ngaySinh
            ? new Date(adminAccount.thanhVien.ngaySinh)
                .toISOString()
                .split("T")[0]
            : "",
          sdt: adminAccount.thanhVien?.sdt || "",
          diaChi: adminAccount.thanhVien?.diaChi || "",
          chuyenMonId: adminAccount.thanhVien?.chuyenMonId || 0,
        });
      }

      setIsEditingAdminProfile(false);
      setShowAdminProfileModal(true);
    } catch (error) {
      console.error("Failed to load admin info:", error);
      toast.error("Không thể tải thông tin admin");
    } finally {
      setAdminProfileLoading(false);
    }
  };

  const handleUpdateAdminProfile = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (
      !adminProfileData.tenTaiKhoan.trim() ||
      !adminProfileData.hoTen.trim() ||
      !adminProfileData.gioiTinh.trim() ||
      !adminProfileData.sdt.trim() ||
      !adminProfileData.diaChi.trim() ||
      adminProfileData.chuyenMonId === 0
    ) {
      toast.error("Vui lòng nhập đầy đủ tất cả các trường bắt buộc!");
      return;
    }

    // Validate số điện thoại
    const phoneRegex = /^[0-9]{10,11}$/;
    if (!phoneRegex.test(adminProfileData.sdt)) {
      toast.error("Số điện thoại phải có 10-11 chữ số!");
      return;
    }

    try {
      setAdminProfileLoading(true);
      const response = await axios.put(
        "https://localhost:7036/api/Admin/profile",
        adminProfileData
      );

      toast.success(
        response.data.message || "Cập nhật thông tin admin thành công!"
      );
      setIsEditingAdminProfile(false);

      // Reload lại thông tin sau khi update
      await handleOpenAdminProfile();
    } catch (error) {
      console.error("Update admin profile failed:", error);
      const message =
        axios.isAxiosError(error) && error.response?.data
          ? typeof error.response.data === "string"
            ? error.response.data
            : (error.response.data.message ??
              "Không thể cập nhật thông tin, vui lòng thử lại")
          : "Không thể cập nhật thông tin, vui lòng thử lại";
      toast.error(message);
    } finally {
      setAdminProfileLoading(false);
    }
  };

  useEffect(() => {
    const hasSession = localStorage.getItem("adminSession") === "true";
    if (!hasSession) {
      toast.info("Vui lòng đăng nhập quản trị");
      navigate("/admin", { replace: true });
      return;
    }

    void fetchAccounts();
    void fetchRoles();
  }, [navigate]);

  useEffect(() => {
    if (activeTab === "reset-password" && restoreTab === "requests") {
      void fetchResetPasswordRequests();
    }
  }, [activeTab, restoreTab]);

  useEffect(() => {
    const fetchSpecializations = async () => {
      try {
        const response = await axios.get(
          "https://localhost:7036/api/Auth/chuyen-mon"
        );
        const map = (
          Array.isArray(response.data?.data) ? response.data.data : []
        ).reduce(
          (
            acc: Record<number, string>,
            item: { chuyenMonId: number; tenChuyenMon: string }
          ) => {
            acc[item.chuyenMonId] = item.tenChuyenMon;
            return acc;
          },
          {}
        );
        setSpecializations(map);
      } catch (err) {
        console.error("Failed to load specializations", err);
      }
    };

    void fetchSpecializations();
  }, []);

  useEffect(() => {
    if (activeTab === "unlock") {
      void fetchBannedAccounts();
    }
  }, [activeTab]);

  useEffect(() => {
    const stored = localStorage.getItem(BACKUP_SCHEDULE_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as {
          enabled: boolean;
          interval: number;
          nextRun?: string | null;
        };
        setScheduleEnabled(parsed.enabled ?? false);
        setScheduleInterval(parsed.interval ?? 1440);
        setNextScheduledRun(parsed.nextRun ?? null);
      } catch (error) {
        console.warn("Failed to parse backup schedule from storage", error);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      BACKUP_SCHEDULE_STORAGE_KEY,
      JSON.stringify({
        enabled: scheduleEnabled,
        interval: scheduleInterval,
        nextRun: nextScheduledRun,
      })
    );
  }, [scheduleEnabled, scheduleInterval, nextScheduledRun]);

  useEffect(() => {
    setBannedPage(1);
  }, [
    bannedSearchTerm,
    bannedRoleFilter,
    bannedSortKey,
    bannedSortDir,
    bannedPageSize,
  ]);

  const filteredAccounts = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    const list = accounts.filter((account) => {
      const matchesKeyword = keyword
        ? [
            account.tenTaiKhoan,
            account.email,
            account.thanhVien?.hoTen,
            account.thanhVien?.sdt,
          ]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(keyword))
        : true;

      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "active"
            ? account.trangThai
            : !account.trangThai;

      return matchesKeyword && matchesStatus;
    });

    const sorted = [...list].sort((a, b) => {
      if (sortKey === "id") {
        return sortDir === "asc"
          ? a.taiKhoanId - b.taiKhoanId
          : b.taiKhoanId - a.taiKhoanId;
      }

      const getValue = (acc: AdminAccount) => {
        switch (sortKey) {
          case "email":
            return acc.email?.toLowerCase() || "";
          case "role":
            return acc.tenQuyen?.toLowerCase() || "";
          case "name":
            return acc.thanhVien?.hoTen?.toLowerCase() || "";
          default:
            return acc.tenTaiKhoan?.toLowerCase() || "";
        }
      };

      const valueA = getValue(a);
      const valueB = getValue(b);

      if (valueA < valueB) return sortDir === "asc" ? -1 : 1;
      if (valueA > valueB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [accounts, searchTerm, sortDir, sortKey, statusFilter]);

  const totalMemberItems = filteredAccounts.length;
  const totalMemberPages = Math.max(
    1,
    Math.ceil(totalMemberItems / membersPageSize)
  );
  const safeMembersPage = Math.min(membersPage, totalMemberPages);

  const paginatedMembers = useMemo(() => {
    const start = (safeMembersPage - 1) * membersPageSize;
    return filteredAccounts.slice(start, start + membersPageSize);
  }, [filteredAccounts, safeMembersPage, membersPageSize]);

  const membersRangeStart =
    totalMemberItems === 0 ? 0 : (safeMembersPage - 1) * membersPageSize + 1;
  const membersRangeEnd =
    totalMemberItems === 0
      ? 0
      : Math.min(
          totalMemberItems,
          membersRangeStart + paginatedMembers.length - 1
        );

  const membersEmptyMessage =
    accounts.length === 0
      ? "Chưa có tài khoản nào"
      : "Không tìm thấy tài khoản phù hợp";

  const formatDateTime = (value: string | null) => {
    if (!value) return "--";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "--";
    return date.toLocaleString("vi-VN");
  };

  const formatDateOnly = (value: string | null) => {
    if (!value) return "--";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "--";
    return date.toLocaleDateString("vi-VN");
  };

  const filteredResetRequests = useMemo(() => {
    const keyword = resetRequestsSearchTerm.trim().toLowerCase();

    const filtered = resetRequests.filter((request) => {
      const matchesKeyword = keyword
        ? [
            request.hoTen,
            request.tenTaiKhoan,
            request.email,
            request.soDienThoai,
            request.lyDo,
          ]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(keyword))
        : true;

      return matchesKeyword;
    });

    const sorted = filtered.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      if (Number.isNaN(timeA) || Number.isNaN(timeB)) {
        return 0;
      }
      return resetRequestsSortDir === "desc" ? timeB - timeA : timeA - timeB;
    });

    return sorted;
  }, [resetRequests, resetRequestsSearchTerm, resetRequestsSortDir]);

  const totalResetRequestsItems = filteredResetRequests.length;
  const totalResetRequestsPages = Math.max(
    1,
    Math.ceil(totalResetRequestsItems / resetRequestsPageSize)
  );
  const safeResetRequestsPage = Math.min(
    totalResetRequestsPages,
    Math.max(1, resetRequestsPage)
  );
  const paginatedResetRequests = useMemo(() => {
    const startIndex = (safeResetRequestsPage - 1) * resetRequestsPageSize;
    return filteredResetRequests.slice(
      startIndex,
      startIndex + resetRequestsPageSize
    );
  }, [filteredResetRequests, safeResetRequestsPage, resetRequestsPageSize]);
  const resetRequestsRangeStart =
    totalResetRequestsItems === 0
      ? 0
      : (safeResetRequestsPage - 1) * resetRequestsPageSize + 1;
  const resetRequestsRangeEnd =
    totalResetRequestsItems === 0
      ? 0
      : Math.min(
          totalResetRequestsItems,
          resetRequestsRangeStart + paginatedResetRequests.length - 1
        );

  const filteredRestoreAccounts = useMemo(() => {
    const keyword = restoreAccountSearch.trim().toLowerCase();
    const [sortKey, sortDir] = restoreAccountSort.split("-") as [
      "id" | "username" | "email",
      "asc" | "desc",
    ];

    const filtered = accounts.filter((account) => {
      const matchesKeyword = keyword
        ? [
            account.tenTaiKhoan,
            account.email,
            account.thanhVien?.hoTen,
            account.thanhVien?.sdt,
          ]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(keyword))
        : true;

      const matchesStatus =
        restoreAccountStatus === "all"
          ? true
          : restoreAccountStatus === "active"
            ? account.trangThai
            : !account.trangThai;

      return matchesKeyword && matchesStatus;
    });

    const sorted = filtered.sort((a, b) => {
      if (sortKey === "id") {
        return sortDir === "asc"
          ? a.taiKhoanId - b.taiKhoanId
          : b.taiKhoanId - a.taiKhoanId;
      }

      const getValue = (acc: AdminAccount) => {
        switch (sortKey) {
          case "username":
            return acc.tenTaiKhoan?.toLowerCase() || "";
          default:
            return acc.email?.toLowerCase() || "";
        }
      };

      const valueA = getValue(a);
      const valueB = getValue(b);
      if (valueA < valueB) return sortDir === "asc" ? -1 : 1;
      if (valueA > valueB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [
    accounts,
    restoreAccountSearch,
    restoreAccountStatus,
    restoreAccountSort,
  ]);

  const totalRestoreAccountItems = filteredRestoreAccounts.length;
  const totalRestoreAccountPages = Math.max(
    1,
    Math.ceil(totalRestoreAccountItems / restoreAccountPageSize)
  );
  const safeRestoreAccountPage = Math.min(
    totalRestoreAccountPages,
    Math.max(1, restoreAccountPage)
  );
  const paginatedRestoreAccounts = useMemo(() => {
    const startIndex = (safeRestoreAccountPage - 1) * restoreAccountPageSize;
    return filteredRestoreAccounts.slice(
      startIndex,
      startIndex + restoreAccountPageSize
    );
  }, [filteredRestoreAccounts, safeRestoreAccountPage, restoreAccountPageSize]);
  const restoreAccountRangeStart =
    totalRestoreAccountItems === 0
      ? 0
      : (safeRestoreAccountPage - 1) * restoreAccountPageSize + 1;
  const restoreAccountRangeEnd =
    totalRestoreAccountItems === 0
      ? 0
      : Math.min(
          totalRestoreAccountItems,
          restoreAccountRangeStart + paginatedRestoreAccounts.length - 1
        );

  useEffect(() => {
    setMembersPage(1);
  }, [searchTerm, statusFilter, sortKey, sortDir, membersPageSize]);

  useEffect(() => {
    setMembersPage((prev) => Math.min(prev, totalMemberPages));
  }, [totalMemberPages]);

  useEffect(() => {
    if (activeTab === "reset-password" && restoreTab === "requests") {
      setResetRequestsPage(1);
    }
  }, [
    activeTab,
    restoreTab,
    resetRequestsSearchTerm,
    resetRequestsSortDir,
    resetRequestsPageSize,
  ]);

  useEffect(() => {
    if (activeTab === "reset-password" && restoreTab === "accounts") {
      setRestoreAccountPage(1);
    }
  }, [
    activeTab,
    restoreTab,
    restoreAccountSearch,
    restoreAccountStatus,
    restoreAccountSort,
    restoreAccountPageSize,
  ]);

  useEffect(() => {
    if (resetRequestsPage !== safeResetRequestsPage) {
      setResetRequestsPage(safeResetRequestsPage);
    }
  }, [safeResetRequestsPage, resetRequestsPage]);

  useEffect(() => {
    if (restoreAccountPage !== safeRestoreAccountPage) {
      setRestoreAccountPage(safeRestoreAccountPage);
    }
  }, [safeRestoreAccountPage, restoreAccountPage]);

  const handleDeleteResetRequest = async (notificationId: string) => {
    if (deletingNotificationId) {
      return;
    }

    try {
      setDeletingNotificationId(notificationId);
      const response = await axios.delete(
        `https://localhost:7036/api/Admin/reset-password-requests/${notificationId}`
      );

      const successMessage =
        typeof response?.data?.message === "string" &&
        response.data.message.trim().length > 0
          ? response.data.message
          : "Đã xoá yêu cầu thành công";
      toast.success(successMessage);
      setResetRequests((prev) =>
        prev.filter((request) => request.notificationId !== notificationId)
      );
    } catch (error) {
      console.error("Delete reset request failed", error);
      const message =
        axios.isAxiosError(error) && error.response?.data?.message
          ? error.response.data.message
          : "Không thể xoá yêu cầu, vui lòng thử lại";
      toast.error(message);
    } finally {
      setDeletingNotificationId(null);
    }
  };

  const handleResetPassword = async (
    taiKhoanId: number,
    tenTaiKhoan: string
  ) => {
    try {
      const response = await axios.post(
        `https://localhost:7036/api/Admin/accounts/${taiKhoanId}/reset-password`
      );

      if (response.data.success) {
        toast.success(response.data.message || "Reset mật khẩu thành công");
        setResetPasswordTarget(null);
      }
    } catch (error) {
      console.error("Reset password failed", error);
      const message =
        axios.isAxiosError(error) && error.response?.data?.message
          ? error.response.data.message
          : "Không thể reset mật khẩu, vui lòng thử lại";
      toast.error(message);
    }
  };

  const bannedRoleOptions = useMemo(() => {
    const roles = new Set<string>();
    bannedAccounts.forEach((account) => {
      const role = account.tenQuyen?.trim();
      if (role) {
        roles.add(role);
      }
    });

    return Array.from(roles).sort((a, b) =>
      a.localeCompare(b, "vi", { sensitivity: "base" })
    );
  }, [bannedAccounts]);

  const processedBannedAccounts = useMemo(() => {
    const keyword = bannedSearchTerm.trim().toLowerCase();

    const filtered = bannedAccounts.filter((account) => {
      const matchesRole =
        bannedRoleFilter === "all"
          ? true
          : account.tenQuyen === bannedRoleFilter;

      if (!matchesRole) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const fields = [
        account.tenTaiKhoan,
        account.email,
        account.thanhVien?.hoTen ?? undefined,
        account.thanhVien?.sdt ?? undefined,
      ]
        .filter(Boolean)
        .map((value) => value!.toLowerCase());

      return fields.some((value) => value.includes(keyword));
    });

    const sorted = [...filtered].sort((a, b) => {
      if (bannedSortKey === "id") {
        return bannedSortDir === "asc"
          ? a.taiKhoanId - b.taiKhoanId
          : b.taiKhoanId - a.taiKhoanId;
      }

      const getValue = (acc: AdminAccount) => {
        switch (bannedSortKey) {
          case "email":
            return acc.email?.toLowerCase() || "";
          case "role":
            return acc.tenQuyen?.toLowerCase() || "";
          case "name":
            return acc.thanhVien?.hoTen?.toLowerCase() || "";
          default:
            return acc.tenTaiKhoan?.toLowerCase() || "";
        }
      };

      const valueA = getValue(a);
      const valueB = getValue(b);

      if (valueA < valueB) return bannedSortDir === "asc" ? -1 : 1;
      if (valueA > valueB) return bannedSortDir === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [
    bannedAccounts,
    bannedRoleFilter,
    bannedSearchTerm,
    bannedSortDir,
    bannedSortKey,
  ]);

  const totalBannedItems = processedBannedAccounts.length;
  const totalBannedPages = Math.max(
    1,
    Math.ceil(totalBannedItems / bannedPageSize)
  );
  const safeBannedPage = Math.min(bannedPage, totalBannedPages);

  const paginatedBannedAccounts = useMemo(() => {
    const start = (safeBannedPage - 1) * bannedPageSize;
    return processedBannedAccounts.slice(start, start + bannedPageSize);
  }, [processedBannedAccounts, safeBannedPage, bannedPageSize]);

  const bannedRangeStart =
    totalBannedItems === 0 ? 0 : (safeBannedPage - 1) * bannedPageSize + 1;
  const bannedRangeEnd =
    totalBannedItems === 0
      ? 0
      : Math.min(
          totalBannedItems,
          bannedRangeStart + paginatedBannedAccounts.length - 1
        );
  const bannedEmptyMessage =
    bannedAccounts.length === 0
      ? "Không có tài khoản nào bị khoá"
      : "Không tìm thấy tài khoản phù hợp";

  useEffect(() => {
    setBannedPage((prev) => Math.min(prev, totalBannedPages));
  }, [totalBannedPages]);

  const extractFilename = (header?: string): string => {
    if (!header) {
      return `QuanLyNhom_Backup_${new Date().toISOString().replace(/[:.]/g, "-")}`;
    }

    const encodedMatch = header.match(/filename\*=UTF-8''([^;]+)/i);
    if (encodedMatch?.[1]) {
      try {
        return decodeURIComponent(encodedMatch[1]);
      } catch (error) {
        console.warn("Failed to decode filename", error);
      }
    }

    const simpleMatch = header.match(/filename="?([^";]+)"?/i);
    if (simpleMatch?.[1]) {
      return simpleMatch[1];
    }

    return `QuanLyNhom_Backup_${new Date().toISOString().replace(/[:.]/g, "-")}`;
  };

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return "--";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const scheduleNextRun = (baseDate = new Date()) => {
    const nextRunDate = new Date(
      baseDate.getTime() + scheduleInterval * 60 * 1000
    );
    setNextScheduledRun(nextRunDate.toISOString());

    if (scheduleTimerRef.current) {
      clearTimeout(scheduleTimerRef.current);
    }

    const delay = Math.max(0, nextRunDate.getTime() - Date.now());
    scheduleTimerRef.current = setTimeout(async () => {
      await handleDownloadBackup();
      scheduleNextRun();
    }, delay);
  };

  const cancelScheduledRun = () => {
    if (scheduleTimerRef.current) {
      clearTimeout(scheduleTimerRef.current);
      scheduleTimerRef.current = null;
    }
    setNextScheduledRun(null);
  };

  const handleDownloadBackup = async () => {
    try {
      setBackupLoading(true);
      setBackupError(null);

      let endpoint = "https://localhost:7036/api/Admin/backup/sql";
      const params: Record<string, string> = {};

      if (backupType === "incremental") {
        if (!incrementalStartDate) {
          toast.error("Vui lòng chọn ngày bắt đầu");
          setBackupLoading(false);
          return;
        }
        endpoint = "https://localhost:7036/api/Admin/backup/incremental";
        params.startDate = incrementalStartDate;
        if (incrementalEndDate) {
          params.endDate = incrementalEndDate;
        }
      }

      const response = await axios.get(endpoint, {
        responseType: "blob",
        params,
      });

      const disposition = response.headers["content-disposition"] as
        | string
        | undefined;
      console.log("Content-Disposition header:", disposition);
      const filename = extractFilename(disposition);
      console.log("Extracted filename:", filename);
      const blob = response.data as Blob;
      const url = window.URL.createObjectURL(blob);

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);

      setLastBackupInfo({
        filename,
        size: blob.size ?? null,
        timestamp: new Date().toISOString(),
      });

      const message =
        backupType === "full"
          ? "Đã tải xuống bản sao lưu full (.bak) của hệ thống"
          : "Đã tải xuống bản sao lưu dữ liệu theo khoảng thời gian (JSON đã mã hoá)";
      toast.success(message);
      if (scheduleEnabled) {
        scheduleNextRun();
      }
    } catch (error) {
      console.error("Download backup failed", error);
      const message =
        axios.isAxiosError(error) && error.response?.data?.message
          ? error.response.data.message
          : "Không thể tải bản sao lưu, vui lòng thử lại";
      setBackupError(message);
      toast.error(message);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleTriggerRestoreInput = () => {
    setRestoreError(null);
    fileInputRef.current?.click();
  };

  const handleRestoreFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setRestoreFile(file);
    setRestoreError(null);
  };

  const handleRestoreSubmit = async () => {
    if (!restoreFile) {
      const message = "Vui lòng chọn file sao lưu trước khi phục hồi";
      setRestoreError(message);
      toast.warning(message);
      return;
    }

    try {
      setRestoreLoading(true);
      setRestoreError(null);

      const formData = new FormData();
      formData.append("backupFile", restoreFile);

      const fileName = restoreFile.name.toLowerCase();
      const isJsonBackup = fileName.endsWith(".json");

      const url = isJsonBackup
        ? "https://localhost:7036/api/Admin/restore/full-system"
        : "https://localhost:7036/api/Admin/restore/sql";

      await axios.post(url, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      toast.success(
        isJsonBackup
          ? "Đã phục hồi dữ liệu hệ thống từ file JSON (đã mã hoá) thành công"
          : "Đã phục hồi database từ file .bak thành công"
      );
      setRestoreFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await Promise.all([fetchAccounts(), fetchBannedAccounts()]);
    } catch (error) {
      console.error("Restore from backup failed", error);
      const message =
        axios.isAxiosError(error) && error.response?.data?.message
          ? error.response.data.message
          : "Phục hồi thất bại, vui lòng kiểm tra file sao lưu";
      setRestoreError(message);
      toast.error(message);
    } finally {
      setRestoreLoading(false);
    }
  };

  useEffect(() => {
    if (scheduleEnabled) {
      if (nextScheduledRun) {
        const nextDate = new Date(nextScheduledRun);
        if (nextDate.getTime() > Date.now()) {
          const delay = Math.max(0, nextDate.getTime() - Date.now());
          scheduleTimerRef.current = setTimeout(async () => {
            await handleDownloadBackup();
            scheduleNextRun();
          }, delay);
        } else {
          scheduleNextRun();
        }
      } else {
        scheduleNextRun();
      }
    } else {
      cancelScheduledRun();
    }

    return () => {
      if (scheduleTimerRef.current) {
        clearTimeout(scheduleTimerRef.current);
        scheduleTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleEnabled, scheduleInterval]);

  const handleViewDetails = (account: AdminAccount) => {
    setSelectedAccount(account);
  };

  const handleEditAccount = (account: AdminAccount) => {
    setEditAccountData({
      taiKhoanId: account.taiKhoanId,
      tenTaiKhoan: account.tenTaiKhoan,
      email: account.email,
      hoTen: account.thanhVien?.hoTen || "",
      gioiTinh: account.thanhVien?.gioiTinh || "",
      ngaySinh: account.thanhVien?.ngaySinh
        ? new Date(account.thanhVien.ngaySinh).toISOString().split("T")[0]
        : "",
      sdt: account.thanhVien?.sdt || "",
      diaChi: account.thanhVien?.diaChi || "",
      chuyenMonId: account.thanhVien?.chuyenMonId || 0,
    });
    setShowEditAccountModal(true);
  };

  const handleUpdateAccount = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (
      !editAccountData.tenTaiKhoan.trim() ||
      !editAccountData.email.trim() ||
      !editAccountData.hoTen.trim() ||
      !editAccountData.gioiTinh.trim() ||
      !editAccountData.sdt.trim() ||
      !editAccountData.diaChi.trim() ||
      editAccountData.chuyenMonId === 0
    ) {
      toast.error("Vui lòng nhập đầy đủ tất cả các trường bắt buộc!");
      return;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editAccountData.email)) {
      toast.error("Email không hợp lệ!");
      return;
    }

    // Validate số điện thoại
    const phoneRegex = /^[0-9]{10,11}$/;
    if (!phoneRegex.test(editAccountData.sdt)) {
      toast.error("Số điện thoại phải có 10-11 chữ số!");
      return;
    }

    try {
      setEditAccountLoading(true);
      const response = await axios.put(
        `https://localhost:7036/api/Admin/accounts/${editAccountData.taiKhoanId}`,
        editAccountData
      );

      toast.success(
        response.data.message || "Cập nhật thông tin tài khoản thành công!"
      );
      setShowEditAccountModal(false);
      setEditAccountData({
        taiKhoanId: 0,
        tenTaiKhoan: "",
        email: "",
        hoTen: "",
        gioiTinh: "",
        ngaySinh: "",
        sdt: "",
        diaChi: "",
        chuyenMonId: 0,
      });

      // Reload accounts list
      await fetchAccounts();
    } catch (error) {
      console.error("Update account failed", error);
      const message =
        axios.isAxiosError(error) && error.response?.data
          ? typeof error.response.data === "string"
            ? error.response.data
            : (error.response.data.message ??
              "Không thể cập nhật tài khoản, vui lòng thử lại")
          : "Không thể cập nhật tài khoản, vui lòng thử lại";
      toast.error(message);
    } finally {
      setEditAccountLoading(false);
    }
  };

  const handleToggleLock = (account: AdminAccount) => {
    if (account.trangThai) {
      setBanTarget(account);
    } else {
      toast.info("Chức năng mở khoá đang được phát triển");
    }
  };

  const handleUnlockAccount = (account: AdminAccount) => {
    setUnbanTarget(account);
  };

  const handleOpenChangeRole = (account: AdminAccount) => {
    setChangeRoleTarget(account);
    setSelectedRoleId(account.quyenId || 0);
  };

  const handleChangeRole = async () => {
    if (!changeRoleTarget || !selectedRoleId) {
      toast.error("Vui lòng chọn quyền mới");
      return;
    }

    if (selectedRoleId === changeRoleTarget.quyenId) {
      toast.info("Quyền mới trùng với quyền hiện tại");
      return;
    }

    try {
      setChangeRoleLoading(true);
      const response = await axios.patch(
        `https://localhost:7036/api/Admin/accounts/${changeRoleTarget.taiKhoanId}/change-role`,
        { quyenId: selectedRoleId }
      );

      if (response.data.success) {
        toast.success(response.data.message || "Đổi quyền thành công");
        setChangeRoleTarget(null);
        setSelectedRoleId(0);
        void fetchAccounts();
      }
    } catch (error) {
      console.error("Change role failed", error);
      const message =
        axios.isAxiosError(error) && error.response?.data?.message
          ? error.response.data.message
          : "Không thể đổi quyền, vui lòng thử lại";
      toast.error(message);
    } finally {
      setChangeRoleLoading(false);
    }
  };

  const handleConfirmBan = async () => {
    if (!banTarget) return;

    try {
      setBanLoading(true);
      await axios.patch(
        `https://localhost:7036/api/Admin/accounts/${banTarget.taiKhoanId}/ban`
      );
      toast.success(`Đã khoá tài khoản ${banTarget.tenTaiKhoan}`);
      setBanTarget(null);
      void fetchAccounts();
      if (activeTab === "unlock") {
        void fetchBannedAccounts();
      }
    } catch (error) {
      console.error("Ban account failed", error);
      const message =
        axios.isAxiosError(error) && error.response?.data?.message
          ? error.response.data.message
          : "Không thể khoá tài khoản, vui lòng thử lại";
      toast.error(message);
    } finally {
      setBanLoading(false);
    }
  };

  const handleConfirmDeleteAccount = async () => {
    if (!deleteAccountTarget || deletingAccountId !== null) {
      return;
    }

    try {
      setDeletingAccountId(deleteAccountTarget.taiKhoanId);
      const response = await axios.delete(
        `https://localhost:7036/api/Admin/accounts/${deleteAccountTarget.taiKhoanId}`
      );

      const successMessage =
        typeof response?.data?.message === "string" &&
        response.data.message.trim().length > 0
          ? response.data.message
          : `Đã xoá tài khoản ${deleteAccountTarget.tenTaiKhoan}`;
      toast.success(successMessage);
      setAccounts((prev) =>
        prev.filter(
          (item) => item.taiKhoanId !== deleteAccountTarget.taiKhoanId
        )
      );
      setBannedAccounts((prev) =>
        prev.filter(
          (item) => item.taiKhoanId !== deleteAccountTarget.taiKhoanId
        )
      );
      if (selectedAccount?.taiKhoanId === deleteAccountTarget.taiKhoanId) {
        setSelectedAccount(null);
      }
      if (banTarget?.taiKhoanId === deleteAccountTarget.taiKhoanId) {
        setBanTarget(null);
      }
      if (unbanTarget?.taiKhoanId === deleteAccountTarget.taiKhoanId) {
        setUnbanTarget(null);
      }
      setDeleteAccountTarget(null);
    } catch (error) {
      console.error("Delete account failed", error);
      const message =
        axios.isAxiosError(error) && error.response?.data
          ? typeof error.response.data === "string"
            ? error.response.data
            : (error.response.data.message ??
              "Không thể xoá tài khoản, vui lòng thử lại")
          : "Không thể xoá tài khoản, vui lòng thử lại";
      toast.error(message);
    } finally {
      setDeletingAccountId(null);
    }
  };

  const handleCreateAccount = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (
      !createAccountData.tenTaiKhoan.trim() ||
      !createAccountData.email.trim() ||
      !createAccountData.hoTen.trim() ||
      !createAccountData.gioiTinh.trim() ||
      !createAccountData.sdt.trim() ||
      !createAccountData.diaChi.trim() ||
      createAccountData.chuyenMonId === 0
    ) {
      toast.error("Vui lòng nhập đầy đủ tất cả các trường bắt buộc!");
      return;
    }

    if (!createAccountData.quyenId || createAccountData.quyenId === 0) {
      toast.error("Vui lòng chọn quyền cho tài khoản!");
      return;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(createAccountData.email)) {
      toast.error("Email không hợp lệ!");
      return;
    }

    // Validate số điện thoại
    const phoneRegex = /^[0-9]{10,11}$/;
    if (!phoneRegex.test(createAccountData.sdt)) {
      toast.error("Số điện thoại phải có 10-11 chữ số!");
      return;
    }

    try {
      setCreateAccountLoading(true);
      const response = await axios.post(
        "https://localhost:7036/api/Admin/accounts/create",
        createAccountData
      );

      toast.success(
        "Tạo tài khoản thành công! Thông tin đăng nhập (mật khẩu: 123) đã được gửi qua email."
      );
      setShowCreateAccountModal(false);
      setCreateAccountData({
        tenTaiKhoan: "",
        email: "",
        hoTen: "",
        gioiTinh: "",
        sdt: "",
        diaChi: "",
        chuyenMonId: 0,
        quyenId: 0,
      });

      // Reload accounts list
      await fetchAccounts();
    } catch (error) {
      console.error("Create account failed", error);
      const message =
        axios.isAxiosError(error) && error.response?.data
          ? typeof error.response.data === "string"
            ? error.response.data
            : (error.response.data.message ??
              "Không thể tạo tài khoản, vui lòng thử lại")
          : "Không thể tạo tài khoản, vui lòng thử lại";
      toast.error(message);
    } finally {
      setCreateAccountLoading(false);
    }
  };

  return (
    <div className={styles.managementLayout}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>Cyber Admin</div>
        <nav className={styles.navMenu}>
          <button
            className={`${styles.navItem} ${
              activeTab === "members" ? styles.activeNavItem : ""
            }`}
            onClick={() => setActiveTab("members")}
          >
            <FaUsersCog /> Quản lý tài khoản
          </button>
          <button
            className={`${styles.navItem} ${
              activeTab === "unlock" ? styles.activeNavItem : ""
            }`}
            onClick={() => setActiveTab("unlock")}
          >
            <FaUnlock /> Mở khoá tài khoản
          </button>
          <button
            className={`${styles.navItem} ${
              activeTab === "reset-password" ? styles.activeNavItem : ""
            }`}
            onClick={() => setActiveTab("reset-password")}
          >
            <FaKey /> Reset mật khẩu
          </button>
          <button
            className={`${styles.navItem} ${
              activeTab === "backup" ? styles.activeNavItem : ""
            }`}
            onClick={() => setActiveTab("backup")}
          >
            <MdDownload /> Sao lưu
          </button>
          <button
            className={`${styles.navItem} ${
              activeTab === "restore" ? styles.activeNavItem : ""
            }`}
            onClick={() => setActiveTab("restore")}
          >
            <MdUpload /> Phục hồi
          </button>
        </nav>
        <div className={styles.bottomActions}>
          <button
            type="button"
            className={styles.changePasswordBtn}
            onClick={handleOpenAdminProfile}
          >
            <FiEye /> Thông tin Admin
          </button>
          <button
            type="button"
            className={styles.changePasswordBtn}
            onClick={() => setShowChangePasswordModal(true)}
          >
            <FiLock /> Đổi mật khẩu
          </button>
          <button
            type="button"
            className={styles.signOut}
            onClick={handleSignOut}
          >
            <FaSignOutAlt /> Đăng xuất
          </button>
        </div>
      </aside>

      <main className={styles.contentArea}>
        <header className={styles.header}>Trang quản trị CyberTeamWork</header>
        {activeTab === "members" && (
          <section className={styles.accountsSection}>
            <div className={styles.sectionHeaderRow}>
              <h2>Danh sách tài khoản</h2>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  className={styles.refreshBtn}
                  style={{ backgroundColor: "#4CAF50" }}
                  onClick={() => setShowCreateAccountModal(true)}
                >
                  + Tạo tài khoản mới
                </button>
                <button
                  className={styles.refreshBtn}
                  onClick={() => void fetchAccounts()}
                  disabled={loading}
                >
                  <MdRefresh /> {loading ? "Đang tải..." : "Tải lại"}
                </button>
              </div>
            </div>
            <div className={styles.controlsRow}>
              <div className={styles.searchBox}>
                <FiSearch />
                <input
                  type="text"
                  placeholder="Tìm kiếm theo tên, email, số điện thoại"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
              <div className={styles.filtersGroup}>
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value as "all" | "active" | "inactive"
                    )
                  }
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="active">Đang hoạt động</option>
                  <option value="inactive">Đang khoá</option>
                </select>
                <select
                  value={`${sortKey}-${sortDir}`}
                  onChange={(event) => {
                    const [key, dir] = event.target.value.split("-") as [
                      "id" | "username" | "email" | "role" | "name",
                      "asc" | "desc",
                    ];
                    setSortKey(key);
                    setSortDir(dir);
                  }}
                >
                  <option value="id-asc">ID (Tăng dần)</option>
                  <option value="id-desc">ID (Giảm dần)</option>
                  <option value="username-asc">Tên đăng nhập (A→Z)</option>
                  <option value="username-desc">Tên đăng nhập (Z→A)</option>
                  <option value="name-asc">Họ tên (A→Z)</option>
                  <option value="name-desc">Họ tên (Z→A)</option>
                  <option value="email-asc">Email (A→Z)</option>
                  <option value="email-desc">Email (Z→A)</option>
                  <option value="role-asc">Quyền (A→Z)</option>
                  <option value="role-desc">Quyền (Z→A)</option>
                </select>
                <select
                  className={styles.pageSizeSelect}
                  value={String(membersPageSize)}
                  onChange={(event) =>
                    setMembersPageSize(Number(event.target.value))
                  }
                >
                  <option value="10">10 hàng</option>
                  <option value="20">20 hàng</option>
                  <option value="50">50 hàng</option>
                </select>
              </div>
            </div>
            {error ? (
              <div className={styles.errorBox}>{error}</div>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.accountTable}>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Tên đăng nhập</th>
                      <th>Email</th>
                      <th>Họ tên</th>
                      <th>Giới tính</th>
                      <th>SĐT</th>
                      <th>Địa chỉ</th>
                      <th>Chuyên môn</th>
                      <th>Trạng thái</th>
                      <th>Quyền</th>
                      <th>Ngày tạo</th>
                      <th>Lần đăng nhập gần nhất</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && accounts.length === 0 ? (
                      <tr>
                        <td colSpan={13} className={styles.emptyCell}>
                          Đang tải dữ liệu...
                        </td>
                      </tr>
                    ) : paginatedMembers.length === 0 ? (
                      <tr>
                        <td colSpan={13} className={styles.emptyCell}>
                          {membersEmptyMessage}
                        </td>
                      </tr>
                    ) : (
                      paginatedMembers.map((account) => (
                        <tr key={account.taiKhoanId}>
                          <td>{account.taiKhoanId}</td>
                          <td>{account.tenTaiKhoan}</td>
                          <td>{account.email}</td>
                          <td>{account.thanhVien?.hoTen ?? "--"}</td>
                          <td>{account.thanhVien?.gioiTinh ?? "--"}</td>
                          <td>{account.thanhVien?.sdt ?? "--"}</td>
                          <td>{account.thanhVien?.diaChi ?? "--"}</td>
                          <td>
                            {account.thanhVien?.chuyenMonId
                              ? (specializations[
                                  account.thanhVien.chuyenMonId
                                ] ?? "--")
                              : "--"}
                          </td>
                          <td>
                            <span
                              className={
                                account.trangThai
                                  ? styles.statusActive
                                  : styles.statusInactive
                              }
                            >
                              {account.trangThai ? "Active" : "Banned"}
                            </span>
                          </td>
                          <td>{account.tenQuyen}</td>
                          <td>{formatDateTime(account.ngayTao)}</td>
                          <td>{formatDateTime(account.lanDangNhapGanNhat)}</td>
                          <td className={styles.actionCell}>
                            <div className={styles.actionGroup}>
                              <button
                                type="button"
                                className={`${styles.actionBtn} ${styles.detailBtn}`}
                                onClick={() => handleViewDetails(account)}
                              >
                                <FiEye /> Chi tiết
                              </button>
                              <button
                                type="button"
                                className={`${styles.actionBtn} ${styles.editBtn}`}
                                onClick={() => handleEditAccount(account)}
                              >
                                <FiEdit /> Chỉnh sửa
                              </button>
                              {/* <button
                                type="button"
                                className={`${styles.actionBtn} ${styles.roleBtn}`}
                                onClick={() => handleOpenChangeRole(account)}
                              >
                                <FiUserCheck /> Phân quyền
                              </button> */}
                              {account.trangThai && (
                                <button
                                  type="button"
                                  className={`${styles.actionBtn} ${styles.lockBtn}`}
                                  onClick={() => handleToggleLock(account)}
                                >
                                  <FiLock /> Khoá tài khoản
                                </button>
                              )}
                              <button
                                type="button"
                                className={`${styles.actionBtn} ${styles.trashBtn}`}
                                onClick={() => setDeleteAccountTarget(account)}
                              >
                                <FiTrash2 />
                                Xoá tài khoản
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <div className={styles.paginationRow}>
              <span className={styles.resultsSummary}>
                Hiển thị {membersRangeStart}-{membersRangeEnd} trên tổng{" "}
                {totalMemberItems} tài khoản
              </span>
              <div className={styles.paginationControls}>
                <button
                  type="button"
                  className={styles.paginationButton}
                  onClick={() =>
                    setMembersPage((prev) =>
                      Math.max(1, Math.min(totalMemberPages, prev - 1))
                    )
                  }
                  disabled={safeMembersPage === 1}
                >
                  « Trước
                </button>
                <span className={styles.pageIndicator}>
                  Trang {safeMembersPage}/{totalMemberPages}
                </span>
                <button
                  type="button"
                  className={styles.paginationButton}
                  onClick={() =>
                    setMembersPage((prev) =>
                      Math.max(1, Math.min(totalMemberPages, prev + 1))
                    )
                  }
                  disabled={safeMembersPage === totalMemberPages}
                >
                  Sau »
                </button>
              </div>
            </div>
          </section>
        )}
        {activeTab === "unlock" && (
          <section className={styles.accountsSection}>
            <div className={styles.sectionHeaderRow}>
              <h2>Danh sách tài khoản bị khoá</h2>
              <button
                className={styles.refreshBtn}
                onClick={() => void fetchBannedAccounts()}
                disabled={bannedLoading}
              >
                <MdRefresh /> {bannedLoading ? "Đang tải..." : "Tải lại"}
              </button>
            </div>
            {bannedError ? (
              <div className={styles.errorBox}>{bannedError}</div>
            ) : (
              <>
                <div className={styles.controlsRow}>
                  <div className={styles.searchBox}>
                    <FiSearch />
                    <input
                      type="text"
                      placeholder="Tìm theo tên đăng nhập, email, họ tên hoặc số điện thoại"
                      value={bannedSearchTerm}
                      onChange={(event) =>
                        setBannedSearchTerm(event.target.value)
                      }
                    />
                  </div>
                  <div className={styles.filtersGroup}>
                    <select
                      value={bannedRoleFilter}
                      onChange={(event) =>
                        setBannedRoleFilter(event.target.value)
                      }
                    >
                      <option value="all">Tất cả quyền</option>
                      {bannedRoleOptions.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    <select
                      value={`${bannedSortKey}-${bannedSortDir}`}
                      onChange={(event) => {
                        const [key, dir] = event.target.value.split("-") as [
                          "id" | "username" | "email" | "role" | "name",
                          "asc" | "desc",
                        ];
                        setBannedSortKey(key);
                        setBannedSortDir(dir);
                      }}
                    >
                      <option value="id-asc">ID (Tăng dần)</option>
                      <option value="id-desc">ID (Giảm dần)</option>
                      <option value="username-asc">Tên đăng nhập (A→Z)</option>
                      <option value="username-desc">Tên đăng nhập (Z→A)</option>
                      <option value="name-asc">Họ tên (A→Z)</option>
                      <option value="name-desc">Họ tên (Z→A)</option>
                      <option value="email-asc">Email (A→Z)</option>
                      <option value="email-desc">Email (Z→A)</option>
                      <option value="role-asc">Quyền (A→Z)</option>
                      <option value="role-desc">Quyền (Z→A)</option>
                    </select>
                    <select
                      className={styles.pageSizeSelect}
                      value={String(bannedPageSize)}
                      onChange={(event) =>
                        setBannedPageSize(Number(event.target.value))
                      }
                    >
                      <option value="10">10 hàng</option>
                      <option value="20">20 hàng</option>
                      <option value="50">50 hàng</option>
                    </select>
                  </div>
                </div>
                <div className={styles.tableWrapper}>
                  <table className={styles.accountTable}>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Tên đăng nhập</th>
                        <th>Email</th>
                        <th>Quyền</th>
                        <th>Họ tên</th>
                        <th>Ngày tạo</th>
                        <th>Lần đăng nhập gần nhất</th>
                        <th>Trạng thái</th>
                        <th>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bannedLoading && bannedAccounts.length === 0 ? (
                        <tr>
                          <td colSpan={9} className={styles.emptyCell}>
                            Đang tải dữ liệu...
                          </td>
                        </tr>
                      ) : paginatedBannedAccounts.length === 0 ? (
                        <tr>
                          <td colSpan={9} className={styles.emptyCell}>
                            {bannedEmptyMessage}
                          </td>
                        </tr>
                      ) : (
                        paginatedBannedAccounts.map((account) => (
                          <tr key={account.taiKhoanId}>
                            <td>{account.taiKhoanId}</td>
                            <td>{account.tenTaiKhoan}</td>
                            <td>{account.email}</td>
                            <td>{account.tenQuyen}</td>
                            <td>{account.thanhVien?.hoTen ?? "--"}</td>
                            <td>{formatDateTime(account.ngayTao)}</td>
                            <td>
                              {formatDateTime(account.lanDangNhapGanNhat)}
                            </td>
                            <td>
                              <span className={styles.statusInactive}>
                                Banned
                              </span>
                            </td>
                            <td className={styles.actionCell}>
                              <button
                                type="button"
                                className={`${styles.actionBtn} ${styles.unlockBtn}`}
                                onClick={() => handleUnlockAccount(account)}
                                disabled={
                                  unbanLoading &&
                                  unbanTarget?.taiKhoanId === account.taiKhoanId
                                }
                              >
                                {unbanLoading &&
                                unbanTarget?.taiKhoanId === account.taiKhoanId
                                  ? "Đang mở khoá..."
                                  : "Mở khoá"}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className={styles.paginationRow}>
                  <span className={styles.resultsSummary}>
                    Hiển thị {bannedRangeStart}-{bannedRangeEnd} trên tổng{" "}
                    {totalBannedItems} tài khoản
                  </span>
                  <div className={styles.paginationControls}>
                    <button
                      type="button"
                      className={styles.paginationButton}
                      onClick={() =>
                        setBannedPage((prev) =>
                          Math.max(1, Math.min(totalBannedPages, prev - 1))
                        )
                      }
                      disabled={safeBannedPage === 1}
                    >
                      « Trước
                    </button>
                    <span className={styles.pageIndicator}>
                      Trang {safeBannedPage}/{totalBannedPages}
                    </span>
                    <button
                      type="button"
                      className={styles.paginationButton}
                      onClick={() =>
                        setBannedPage((prev) =>
                          Math.max(1, Math.min(totalBannedPages, prev + 1))
                        )
                      }
                      disabled={safeBannedPage === totalBannedPages}
                    >
                      Sau »
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        )}
        {activeTab === "reset-password" && (
          <section className={styles.accountsSection}>
            <div className={styles.sectionHeaderRow}>
              <h2>Reset mật khẩu</h2>
            </div>

            <div className={styles.subTabs}>
              <button
                type="button"
                className={`${styles.subTabButton} ${
                  restoreTab === "requests" ? styles.activeSubTab : ""
                }`}
                onClick={() => setRestoreTab("requests")}
              >
                Yêu cầu reset
              </button>
              <button
                type="button"
                className={`${styles.subTabButton} ${
                  restoreTab === "accounts" ? styles.activeSubTab : ""
                }`}
                onClick={() => setRestoreTab("accounts")}
              >
                Quản lý tài khoản
              </button>
            </div>

            {restoreTab === "requests" ? (
              <>
                <div className={styles.subSectionHeader}>
                  <p className={styles.sectionIntro}>
                    Danh sách các yêu cầu reset mật khẩu từ thành viên. Admin có
                    thể xem và xử lý yêu cầu bằng cách reset mật khẩu về mặc
                    định.
                  </p>
                  <div className={styles.subHeaderActions}>
                    <button
                      type="button"
                      className={styles.refreshBtn}
                      onClick={() => void fetchResetPasswordRequests()}
                      disabled={resetRequestsLoading}
                    >
                      <MdRefresh />{" "}
                      {resetRequestsLoading ? "Đang tải..." : "Tải lại"}
                    </button>
                  </div>
                </div>

                <div className={styles.controlsRow}>
                  <div className={styles.searchBox}>
                    <FiSearch />
                    <input
                      type="text"
                      placeholder="Tìm theo họ tên, tài khoản, lý do"
                      value={resetRequestsSearchTerm}
                      onChange={(event) =>
                        setResetRequestsSearchTerm(event.target.value)
                      }
                    />
                  </div>
                  <div className={styles.filtersGroup}>
                    <select
                      value={resetRequestsSortDir}
                      onChange={(event) =>
                        setResetRequestsSortDir(
                          event.target.value as "asc" | "desc"
                        )
                      }
                    >
                      <option value="desc">Mới nhất trước</option>
                      <option value="asc">Cũ nhất trước</option>
                    </select>
                    <select
                      className={styles.pageSizeSelect}
                      value={String(resetRequestsPageSize)}
                      onChange={(event) =>
                        setResetRequestsPageSize(Number(event.target.value))
                      }
                    >
                      <option value="5">5 bản ghi</option>
                      <option value="10">10 bản ghi</option>
                      <option value="20">20 bản ghi</option>
                    </select>
                  </div>
                </div>

                {resetRequestsError ? (
                  <div className={styles.errorBox}>{resetRequestsError}</div>
                ) : (
                  <div>
                    {resetRequestsLoading &&
                    filteredResetRequests.length === 0 ? (
                      <div className={styles.emptyState}>
                        Đang tải dữ liệu...
                      </div>
                    ) : resetRequests.length === 0 ? (
                      <div className={styles.emptyState}>
                        Chưa có yêu cầu reset mật khẩu nào.
                      </div>
                    ) : filteredResetRequests.length === 0 ? (
                      <div className={styles.emptyState}>
                        Không tìm thấy yêu cầu phù hợp.
                      </div>
                    ) : (
                      <div className={styles.messageList}>
                        {paginatedResetRequests.map((request) => (
                          <article
                            className={styles.messageCard}
                            key={request.notificationId}
                          >
                            <header className={styles.messageHeader}>
                              <div>
                                <h3 className={styles.messageTitle}>
                                  {request.hoTen || "(Chưa cung cấp họ tên)"}
                                </h3>
                                <span className={styles.messageSubtitle}>
                                  {request.tenTaiKhoan
                                    ? `Tài khoản: ${request.tenTaiKhoan}`
                                    : "Không có tên đăng nhập"}
                                </span>
                              </div>
                              <div className={styles.messageActions}>
                                <span className={styles.messageTimestamp}>
                                  {formatDateTime(request.createdAt)}
                                </span>
                                <button
                                  type="button"
                                  className={`${styles.actionBtn} ${styles.trashBtn}`}
                                  onClick={() =>
                                    handleDeleteResetRequest(
                                      request.notificationId
                                    )
                                  }
                                  disabled={
                                    deletingNotificationId ===
                                    request.notificationId
                                  }
                                >
                                  <FiTrash2 />
                                  {deletingNotificationId ===
                                  request.notificationId
                                    ? "Đang xoá..."
                                    : "Xoá"}
                                </button>
                              </div>
                            </header>

                            <div className={styles.messageContent}>
                              <div className={styles.messageField}>
                                <span className={styles.fieldLabel}>
                                  Email liên hệ
                                </span>
                                <span className={styles.fieldValue}>
                                  {request.email || "--"}
                                </span>
                              </div>
                              <div className={styles.messageField}>
                                <span className={styles.fieldLabel}>
                                  Số điện thoại
                                </span>
                                <span className={styles.fieldValue}>
                                  {request.soDienThoai || "--"}
                                </span>
                              </div>
                              <div className={styles.messageField}>
                                <span className={styles.fieldLabel}>
                                  Lý do reset
                                </span>
                                <span className={styles.fieldValue}>
                                  {request.lyDo || "--"}
                                </span>
                              </div>
                            </div>

                            <div
                              className={styles.messageActions}
                              style={{
                                marginTop: "16px",
                                borderTop: "1px solid #e2e8f0",
                                paddingTop: "16px",
                              }}
                            >
                              <button
                                type="button"
                                className={`${styles.actionBtn} ${styles.editBtn}`}
                                onClick={async () => {
                                  const account = accounts.find(
                                    (acc) =>
                                      acc.tenTaiKhoan === request.tenTaiKhoan
                                  );
                                  if (account) {
                                    await handleResetPassword(
                                      account.taiKhoanId,
                                      account.tenTaiKhoan
                                    );
                                  } else {
                                    toast.error("Không tìm thấy tài khoản");
                                  }
                                }}
                              >
                                <FiEdit /> Reset mật khẩu
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className={styles.paginationRow}>
                  <span className={styles.resultsSummary}>
                    Hiển thị {resetRequestsRangeStart}-{resetRequestsRangeEnd}{" "}
                    trên tổng {totalResetRequestsItems} yêu cầu
                  </span>
                  <div className={styles.paginationControls}>
                    <button
                      type="button"
                      className={styles.paginationButton}
                      onClick={() =>
                        setResetRequestsPage((prev) => Math.max(1, prev - 1))
                      }
                      disabled={safeResetRequestsPage === 1}
                    >
                      « Trước
                    </button>
                    <span className={styles.pageIndicator}>
                      Trang {safeResetRequestsPage}/{totalResetRequestsPages}
                    </span>
                    <button
                      type="button"
                      className={styles.paginationButton}
                      onClick={() =>
                        setResetRequestsPage((prev) =>
                          Math.min(totalResetRequestsPages, prev + 1)
                        )
                      }
                      disabled={
                        safeResetRequestsPage === totalResetRequestsPages
                      }
                    >
                      Sau »
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className={styles.subSectionHeader}>
                  <p className={styles.sectionIntro}>
                    Quản lý toàn bộ tài khoản người dùng. Có thể reset mật khẩu
                    về mặc định khi cần thiết.
                  </p>
                  <div className={styles.subHeaderActions}>
                    <button
                      type="button"
                      className={styles.refreshBtn}
                      onClick={() => void fetchAccounts()}
                      disabled={loading}
                    >
                      <MdRefresh /> {loading ? "Đang tải..." : "Tải lại"}
                    </button>
                  </div>
                </div>

                <div className={styles.controlsRow}>
                  <div className={styles.searchBox}>
                    <FiSearch />
                    <input
                      type="text"
                      placeholder="Tìm theo tên đăng nhập, email hoặc họ tên"
                      value={restoreAccountSearch}
                      onChange={(event) =>
                        setRestoreAccountSearch(event.target.value)
                      }
                    />
                  </div>
                  <div className={styles.filtersGroup}>
                    <select
                      value={restoreAccountStatus}
                      onChange={(event) =>
                        setRestoreAccountStatus(
                          event.target.value as "all" | "active" | "inactive"
                        )
                      }
                    >
                      <option value="all">Tất cả trạng thái</option>
                      <option value="active">Đang hoạt động</option>
                      <option value="inactive">Đang khoá</option>
                    </select>
                    <select
                      value={restoreAccountSort}
                      onChange={(event) =>
                        setRestoreAccountSort(
                          event.target.value as
                            | "id-desc"
                            | "id-asc"
                            | "username-asc"
                            | "username-desc"
                            | "email-asc"
                            | "email-desc"
                        )
                      }
                    >
                      <option value="id-desc">ID (mới nhất)</option>
                      <option value="id-asc">ID (cũ nhất)</option>
                      <option value="username-asc">Tên đăng nhập (A→Z)</option>
                      <option value="username-desc">Tên đăng nhập (Z→A)</option>
                      <option value="email-asc">Email (A→Z)</option>
                      <option value="email-desc">Email (Z→A)</option>
                    </select>
                    <select
                      className={styles.pageSizeSelect}
                      value={String(restoreAccountPageSize)}
                      onChange={(event) =>
                        setRestoreAccountPageSize(Number(event.target.value))
                      }
                    >
                      <option value="10">10 hàng</option>
                      <option value="20">20 hàng</option>
                      <option value="50">50 hàng</option>
                    </select>
                  </div>
                </div>

                {error ? (
                  <div className={styles.errorBox}>{error}</div>
                ) : (
                  <div className={styles.tableWrapper}>
                    <table className={styles.accountTable}>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Tên đăng nhập</th>
                          <th>Email</th>
                          <th>Họ tên</th>
                          <th>Ngày tạo</th>
                          <th>Lần đăng nhập gần nhất</th>
                          <th>Quyền</th>
                          <th>Trạng thái</th>
                          <th className={styles.narrowColumn}>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading && filteredRestoreAccounts.length === 0 ? (
                          <tr>
                            <td colSpan={9} className={styles.emptyCell}>
                              Đang tải dữ liệu...
                            </td>
                          </tr>
                        ) : accounts.length === 0 ? (
                          <tr>
                            <td colSpan={9} className={styles.emptyCell}>
                              Chưa có tài khoản nào.
                            </td>
                          </tr>
                        ) : filteredRestoreAccounts.length === 0 ? (
                          <tr>
                            <td colSpan={9} className={styles.emptyCell}>
                              Không tìm thấy tài khoản phù hợp.
                            </td>
                          </tr>
                        ) : (
                          paginatedRestoreAccounts.map((account) => (
                            <tr key={account.taiKhoanId}>
                              <td>{account.taiKhoanId}</td>
                              <td>{account.tenTaiKhoan}</td>
                              <td>{account.email}</td>
                              <td>{account.thanhVien?.hoTen || "--"}</td>
                              <td>{formatDateTime(account.ngayTao)}</td>
                              <td>
                                {formatDateTime(account.lanDangNhapGanNhat)}
                              </td>
                              <td>{account.tenQuyen}</td>
                              <td>
                                <span
                                  className={
                                    account.trangThai
                                      ? styles.statusActive
                                      : styles.statusInactive
                                  }
                                >
                                  {account.trangThai ? "Active" : "Banned"}
                                </span>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className={`${styles.actionBtn} ${styles.editBtn}`}
                                  onClick={() => {
                                    setResetPasswordTarget({
                                      taiKhoanId: account.taiKhoanId,
                                      tenTaiKhoan: account.tenTaiKhoan,
                                    });
                                  }}
                                  title="Reset mật khẩu về 123"
                                >
                                  <FiEdit /> Reset mật khẩu
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className={styles.paginationRow}>
                  <span className={styles.resultsSummary}>
                    Hiển thị {restoreAccountRangeStart}-{restoreAccountRangeEnd}{" "}
                    trên tổng {totalRestoreAccountItems} tài khoản
                  </span>
                  <div className={styles.paginationControls}>
                    <button
                      type="button"
                      className={styles.paginationButton}
                      onClick={() =>
                        setRestoreAccountPage((prev) => Math.max(1, prev - 1))
                      }
                      disabled={safeRestoreAccountPage === 1}
                    >
                      « Trước
                    </button>
                    <span className={styles.pageIndicator}>
                      Trang {safeRestoreAccountPage}/{totalRestoreAccountPages}
                    </span>
                    <button
                      type="button"
                      className={styles.paginationButton}
                      onClick={() =>
                        setRestoreAccountPage((prev) =>
                          Math.min(totalRestoreAccountPages, prev + 1)
                        )
                      }
                      disabled={
                        safeRestoreAccountPage === totalRestoreAccountPages
                      }
                    >
                      Sau »
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        )}
        {activeTab === "backup" && (
          <section className={styles.backupSection}>
            <div className={styles.backupHeader}>
              <div>
                <h2>Sao lưu hệ thống</h2>
                <p>
                  Chọn loại sao lưu: <strong>Toàn bộ</strong> (tất cả dữ liệu)
                  hoặc <strong>Theo khoảng thời gian</strong> (chỉ dữ liệu được
                  tạo/cập nhật trong thời gian chọn).
                </p>
              </div>
            </div>
            {backupError && (
              <div className={styles.errorBox}>{backupError}</div>
            )}

            {/* Chọn loại backup */}
            <div className={styles.backupTypeCard}>
              <h3>Chọn loại sao lưu</h3>
              <div className={styles.backupTypeOptions}>
                <label className={styles.radioOption}>
                  <input
                    type="radio"
                    name="backupType"
                    value="full"
                    checked={backupType === "full"}
                    onChange={() => setBackupType("full")}
                  />
                  <div className={styles.radioContent}>
                    <strong>Sao lưu toàn bộ</strong>
                    <span>
                      Tất cả tài khoản, thành viên, nhóm, dự án, công việc, phân
                      công và bình luận
                    </span>
                  </div>
                </label>
                <label className={styles.radioOption}>
                  <input
                    type="radio"
                    name="backupType"
                    value="incremental"
                    checked={backupType === "incremental"}
                    onChange={() => setBackupType("incremental")}
                  />
                  <div className={styles.radioContent}>
                    <strong>Sao lưu theo khoảng thời gian</strong>
                    <span>
                      Chỉ sao lưu dữ liệu được tạo hoặc cập nhật trong khoảng
                      thời gian bạn chọn
                    </span>
                  </div>
                </label>
              </div>

              {backupType === "incremental" && (
                <div className={styles.dateRangeSelector}>
                  <div className={styles.dateField}>
                    <label htmlFor="startDate">Từ ngày *</label>
                    <input
                      id="startDate"
                      type="date"
                      value={incrementalStartDate}
                      onChange={(e) => setIncrementalStartDate(e.target.value)}
                      max={
                        incrementalEndDate ||
                        new Date().toISOString().split("T")[0]
                      }
                    />
                  </div>
                  <div className={styles.dateField}>
                    <label htmlFor="endDate">Đến ngày (tùy chọn)</label>
                    <input
                      id="endDate"
                      type="date"
                      value={incrementalEndDate}
                      onChange={(e) => setIncrementalEndDate(e.target.value)}
                      min={incrementalStartDate}
                      max={new Date().toISOString().split("T")[0]}
                    />
                  </div>
                  <div className={styles.quickActions}>
                    <button
                      type="button"
                      className={styles.quickBtn}
                      onClick={() => {
                        const today = new Date();
                        const sevenDaysAgo = new Date(today);
                        sevenDaysAgo.setDate(today.getDate() - 7);
                        setIncrementalStartDate(
                          sevenDaysAgo.toISOString().split("T")[0]
                        );
                        setIncrementalEndDate(
                          today.toISOString().split("T")[0]
                        );
                      }}
                    >
                      7 ngày qua
                    </button>
                    <button
                      type="button"
                      className={styles.quickBtn}
                      onClick={() => {
                        const today = new Date();
                        const thirtyDaysAgo = new Date(today);
                        thirtyDaysAgo.setDate(today.getDate() - 30);
                        setIncrementalStartDate(
                          thirtyDaysAgo.toISOString().split("T")[0]
                        );
                        setIncrementalEndDate(
                          today.toISOString().split("T")[0]
                        );
                      }}
                    >
                      30 ngày qua
                    </button>
                    <button
                      type="button"
                      className={styles.quickBtn}
                      onClick={() => {
                        if (lastBackupInfo?.timestamp) {
                          const lastBackupDate = new Date(
                            lastBackupInfo.timestamp
                          );
                          setIncrementalStartDate(
                            lastBackupDate.toISOString().split("T")[0]
                          );
                          setIncrementalEndDate(
                            new Date().toISOString().split("T")[0]
                          );
                        } else {
                          toast.info("Chưa có thông tin backup trước đó");
                        }
                      }}
                    >
                      Từ lần backup cuối
                    </button>
                  </div>
                </div>
              )}

              <button
                type="button"
                className={styles.backupButton}
                onClick={handleDownloadBackup}
                disabled={backupLoading}
              >
                <MdDownload />{" "}
                {backupLoading
                  ? "Đang chuẩn bị..."
                  : backupType === "full"
                    ? "Tải bản sao lưu toàn bộ"
                    : "Tải bản sao lưu theo thời gian"}
              </button>
            </div>
            <div className={styles.backupCard}>
              <div className={styles.backupMeta}>
                <div>
                  <span className={styles.metaLabel}>Tên file gần nhất</span>
                  <strong className={styles.metaValue}>
                    {lastBackupInfo?.filename ?? "Chưa có bản sao lưu"}
                  </strong>
                </div>
                <div>
                  <span className={styles.metaLabel}>Kích thước</span>
                  <strong className={styles.metaValue}>
                    {formatBytes(lastBackupInfo?.size ?? null)}
                  </strong>
                </div>
                <div>
                  <span className={styles.metaLabel}>Thời gian</span>
                  <strong className={styles.metaValue}>
                    {lastBackupInfo?.timestamp
                      ? new Date(lastBackupInfo.timestamp).toLocaleString()
                      : "--"}
                  </strong>
                </div>
              </div>
              <div className={styles.backupTips}>
                <h3>Thông tin sao lưu</h3>
                <ul>
                  <li>
                    <strong>Dữ liệu được sao lưu:</strong> Tài khoản, thành
                    viên, nhóm, dự án, công việc, phân công và bình luận
                  </li>
                  <li>
                    <strong>Định dạng:</strong> File .json {"(đã mã hoá)"} hoặc
                    .bak có thể phục hồi trực tiếp qua hệ thống
                  </li>
                  <li>
                    Lưu trữ file backup ở nơi an toàn (Google Drive, Dropbox,
                    v.v.)
                  </li>
                  <li>
                    Kiểm tra định kỳ để đảm bảo bản sao lưu mới nhất luôn sẵn
                    sàng
                  </li>
                </ul>
              </div>
            </div>
            <div className={styles.scheduleCard}>
              <div className={styles.scheduleInfo}>
                <h3>Sao lưu định kỳ</h3>
                <p>
                  Bật chế độ sao lưu tự động để hệ thống tải xuống bản sao lưu
                  theo chu kỳ. File sẽ được lưu về trình duyệt giống như thao
                  tác thủ công.
                </p>
              </div>
              <div className={styles.scheduleControls}>
                <label className={styles.toggleRow}>
                  <input
                    type="checkbox"
                    checked={scheduleEnabled}
                    onChange={handleToggleSchedule}
                  />
                  <span>Kích hoạt sao lưu định kỳ</span>
                </label>
                <div className={styles.intervalRow}>
                  <span>Chu kỳ</span>
                  <select
                    value={scheduleInterval}
                    onChange={(event) =>
                      handleScheduleIntervalChange(Number(event.target.value))
                    }
                    disabled={!scheduleEnabled}
                  >
                    {BACKUP_INTERVAL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={styles.scheduleNowButton}
                    onClick={handleRescheduleFromNow}
                  >
                    Đặt lại từ bây giờ
                  </button>
                </div>
                <div className={styles.scheduleStatus}>
                  <span className={styles.metaLabel}>Lần chạy kế tiếp</span>
                  <strong className={styles.metaValue}>
                    {scheduleEnabled
                      ? nextScheduledRun
                        ? `${new Date(nextScheduledRun).toLocaleString()} · ${formatTimeUntil(nextScheduledRun)}`
                        : "Đang tính toán..."
                      : "Chưa bật"}
                  </strong>
                </div>
                {!scheduleEnabled && (
                  <p className={styles.scheduleHint}>
                    Bật sao lưu định kỳ để tự động tải file về theo chu kỳ. Hãy
                    đảm bảo trình duyệt được mở khi đến thời gian chạy.
                  </p>
                )}
              </div>
            </div>
          </section>
        )}
        {activeTab === "restore" && (
          <section className={styles.backupSection}>
            <div className={styles.backupHeader}>
              <div>
                <h2>Phục hồi hệ thống</h2>
                <p>
                  Tải lên file backup đã lấy từ hệ thống trước đó. Toàn bộ dữ
                  liệu sẽ được khôi phục theo nội dung file.
                </p>
              </div>
            </div>
            {restoreError && (
              <div className={styles.errorBox}>{restoreError}</div>
            )}
            <div className={styles.restoreCard}>
              <div className={styles.restoreInfo}>
                <h3>Chọn file backup</h3>
                {restoreError && (
                  <div className={styles.inlineError}>{restoreError}</div>
                )}
                <input
                  ref={fileInputRef}
                  className={styles.hiddenFileInput}
                  type="file"
                  accept="application/json,.json"
                  onChange={handleRestoreFileChange}
                />
                <div className={styles.filePicker}>
                  <button
                    type="button"
                    className={styles.filePickerButton}
                    onClick={handleTriggerRestoreInput}
                    disabled={restoreLoading}
                  >
                    <MdUpload /> Chọn file backup
                  </button>
                  <div className={styles.fileSummary}>
                    <span className={styles.fileName}>
                      {restoreFile ? restoreFile.name : "Chưa chọn file"}
                    </span>
                    <span className={styles.fileSize}>
                      {restoreFile ? formatBytes(restoreFile.size) : "--"}
                    </span>
                  </div>
                  {restoreFile && !restoreLoading && (
                    <button
                      type="button"
                      className={styles.clearFileButton}
                      onClick={() => {
                        setRestoreFile(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                    >
                      Huỷ chọn
                    </button>
                  )}
                </div>
                <div className={styles.restoreActions}>
                  <button
                    type="button"
                    className={styles.restoreButton}
                    onClick={handleRestoreSubmit}
                    disabled={restoreLoading}
                  >
                    {restoreLoading ? "Đang phục hồi..." : "Phục hồi dữ liệu"}
                  </button>
                  <span className={styles.restoreNote}>
                    Việc phục hồi có thể mất vài phút. Vui lòng không đóng trình
                    duyệt cho đến khi hoàn tất.
                  </span>
                </div>
              </div>
              <div className={styles.restoreTips}>
                <h4>Lưu ý quan trọng</h4>
                <ul>
                  <li>
                    File cần có phần mở rộng <code>.json hoặc .bak</code> và
                    được tạo từ chức năng sao lưu hệ thống
                  </li>
                  <li>
                    <strong>Cảnh báo:</strong> Dữ liệu hiện tại sẽ được ghi đè
                    bởi dữ liệu trong file backup. Hãy chắc chắn bạn đã sao lưu
                    trước khi phục hồi!
                  </li>
                  <li>
                    Đảm bảo nội dung file không bị chỉnh sửa trước khi tải lên
                  </li>
                  <li>
                    Quá trình phục hồi có thể mất vài phút tuỳ kích thước dữ
                    liệu
                  </li>
                </ul>
              </div>
            </div>
          </section>
        )}
      </main>
      {selectedAccount && (
        <div
          className={styles.modalOverlay}
          onClick={() => setSelectedAccount(null)}
        >
          <div
            className={styles.accountModal}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-modal-title"
          >
            <header className={styles.modalHeader}>
              <div>
                <h3 id="account-modal-title">Chi tiết tài khoản</h3>
                <span className={styles.modalSubTitle}>
                  #{selectedAccount.taiKhoanId}
                </span>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setSelectedAccount(null)}
                aria-label="Đóng"
              >
                ✕
              </button>
            </header>
            <div className={styles.modalBody}>
              <section className={styles.modalSection}>
                <h4>Thông tin tài khoản</h4>
                <div className={styles.infoGrid}>
                  <div>
                    <span className={styles.infoLabel}>Tên đăng nhập</span>
                    <span className={styles.infoValue}>
                      {selectedAccount.tenTaiKhoan}
                    </span>
                  </div>
                  <div>
                    <span className={styles.infoLabel}>Email</span>
                    <span className={styles.infoValue}>
                      {selectedAccount.email}
                    </span>
                  </div>
                  <div>
                    <span className={styles.infoLabel}>Quyền</span>
                    <span className={styles.infoValue}>
                      {selectedAccount.tenQuyen}
                    </span>
                  </div>
                  <div>
                    <span className={styles.infoLabel}>Trạng thái</span>
                    <span
                      className={`${styles.statusBadge} ${
                        selectedAccount.trangThai
                          ? styles.statusBadgeActive
                          : styles.statusBadgeInactive
                      }`}
                    >
                      {selectedAccount.trangThai
                        ? "Đang hoạt động"
                        : "Đang khoá"}
                    </span>
                  </div>
                </div>
              </section>

              <section className={styles.modalSection}>
                <h4>Thông tin thành viên</h4>
                {selectedAccount.thanhVien ? (
                  <div className={styles.infoGrid}>
                    <div>
                      <span className={styles.infoLabel}>Họ tên</span>
                      <span className={styles.infoValue}>
                        {selectedAccount.thanhVien.hoTen || "--"}
                      </span>
                    </div>
                    <div>
                      <span className={styles.infoLabel}>Giới tính</span>
                      <span className={styles.infoValue}>
                        {selectedAccount.thanhVien.gioiTinh || "--"}
                      </span>
                    </div>
                    <div>
                      <span className={styles.infoLabel}>Ngày sinh</span>
                      <span className={styles.infoValue}>
                        {selectedAccount.thanhVien.ngaySinh
                          ? new Date(
                              selectedAccount.thanhVien.ngaySinh
                            ).toLocaleDateString("vi-VN")
                          : "--"}
                      </span>
                    </div>
                    <div>
                      <span className={styles.infoLabel}>Số điện thoại</span>
                      <span className={styles.infoValue}>
                        {selectedAccount.thanhVien.sdt || "--"}
                      </span>
                    </div>
                    <div>
                      <span className={styles.infoLabel}>Địa chỉ</span>
                      <span className={styles.infoValue}>
                        {selectedAccount.thanhVien.diaChi || "--"}
                      </span>
                    </div>
                    <div>
                      <span className={styles.infoLabel}>Chuyên môn</span>
                      <span className={styles.infoValue}>
                        {selectedAccount.thanhVien.chuyenMonId
                          ? specializations[
                              selectedAccount.thanhVien.chuyenMonId
                            ] || "--"
                          : "--"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className={styles.emptyMember}>
                    Chưa có thông tin thành viên.
                  </p>
                )}
              </section>

              {selectedAccount.thanhVien?.anhBia && (
                <section className={styles.modalSection}>
                  <h4>Ảnh đại diện</h4>
                  <img
                    src={`https://localhost:7036${selectedAccount.thanhVien.anhBia}`}
                    alt="Ảnh đại diện"
                    className={styles.modalAvatar}
                  />
                  <a
                    href={`https://localhost:7036${selectedAccount.thanhVien.anhBia}`}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.modalLink}
                  >
                    Xem ảnh gốc
                  </a>
                </section>
              )}
            </div>
            <footer className={styles.modalFooter}>
              <button
                type="button"
                className={styles.modalCloseSecondary}
                onClick={() => setSelectedAccount(null)}
              >
                Đóng
              </button>
            </footer>
          </div>
        </div>
      )}

      {deleteAccountTarget && (
        <div
          className={styles.modalOverlay}
          onClick={() => setDeleteAccountTarget(null)}
        >
          <div
            className={styles.confirmModal}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
          >
            <header className={styles.modalHeader}>
              <div>
                <h3 id="delete-account-title">Xác nhận xoá tài khoản</h3>
                <span className={styles.modalSubTitle}>
                  #{deleteAccountTarget.taiKhoanId} ·{" "}
                  {deleteAccountTarget.tenTaiKhoan}
                </span>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setDeleteAccountTarget(null)}
                aria-label="Đóng"
              >
                ✕
              </button>
            </header>
            <div className={styles.confirmBody}>
              <p>
                Bạn có chắc chắn muốn xoá tài khoản{" "}
                <strong>{deleteAccountTarget.tenTaiKhoan}</strong>? Hành động
                này không thể hoàn tác và người dùng sẽ không còn truy cập vào
                hệ thống.
              </p>
              <p>
                Email hiện tại:{" "}
                <strong>
                  {deleteAccountTarget.email || "(Chưa có email)"}
                </strong>
              </p>
            </div>
            <footer className={styles.modalFooter}>
              <button
                type="button"
                className={styles.modalCloseSecondary}
                onClick={() => setDeleteAccountTarget(null)}
                disabled={deletingAccountId !== null}
              >
                Huỷ
              </button>
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.trashBtn}`}
                onClick={() => void handleConfirmDeleteAccount()}
                disabled={deletingAccountId !== null}
              >
                {deletingAccountId !== null ? "Đang xoá..." : "Xoá vĩnh viễn"}
              </button>
            </footer>
          </div>
        </div>
      )}
      {banTarget && (
        <div className={styles.modalOverlay} onClick={() => setBanTarget(null)}>
          <div
            className={styles.confirmModal}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ban-modal-title"
          >
            <header className={styles.modalHeader}>
              <div>
                <h3 id="ban-modal-title">Xác nhận khoá</h3>
                <span className={styles.modalSubTitle}>
                  #{banTarget.taiKhoanId}
                </span>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setBanTarget(null)}
                aria-label="Đóng"
              >
                ✕
              </button>
            </header>
            <div className={styles.confirmBody}>
              <p>
                Bạn có chắc chắn muốn khoá tài khoản{" "}
                <strong>{banTarget.tenTaiKhoan}</strong>? Người dùng sẽ không
                thể đăng nhập sau thao tác này.
              </p>
            </div>
            <footer className={styles.modalFooter}>
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.lockBtn}`}
                onClick={handleConfirmBan}
                disabled={banLoading}
              >
                {banLoading ? "Đang khoá..." : "Xác nhận khoá"}
              </button>
              <button
                type="button"
                className={styles.modalCloseSecondary}
                onClick={() => setBanTarget(null)}
                disabled={banLoading}
              >
                Huỷ
              </button>
            </footer>
          </div>
        </div>
      )}
      {unbanTarget && (
        <div
          className={styles.modalOverlay}
          onClick={() => setUnbanTarget(null)}
        >
          <div
            className={styles.confirmModal}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="unban-modal-title"
          >
            <header className={styles.modalHeader}>
              <div>
                <h3 id="unban-modal-title">Xác nhận mở khoá</h3>
                <span className={styles.modalSubTitle}>
                  #{unbanTarget.taiKhoanId}
                </span>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setUnbanTarget(null)}
                aria-label="Đóng"
              >
                ✕
              </button>
            </header>
            <div className={styles.confirmBody}>
              <p>
                Bạn có chắc chắn muốn mở khoá tài khoản{" "}
                <strong>{unbanTarget.tenTaiKhoan}</strong>? Người dùng sẽ có thể
                đăng nhập trở lại sau thao tác này.
              </p>
            </div>
            <footer className={styles.modalFooter}>
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.unlockBtn}`}
                onClick={handleConfirmUnban}
                disabled={unbanLoading}
              >
                {unbanLoading ? "Đang mở khoá..." : "Xác nhận mở khoá"}
              </button>
              <button
                type="button"
                className={styles.modalCloseSecondary}
                onClick={() => setUnbanTarget(null)}
                disabled={unbanLoading}
              >
                Huỷ
              </button>
            </footer>
          </div>
        </div>
      )}
      {showCreateAccountModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowCreateAccountModal(false)}
        >
          <div
            className={styles.changeEmailModal}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-account-title"
          >
            <header className={styles.modalHeader}>
              <div>
                <h3 id="create-account-title">Tạo tài khoản mới</h3>
                <span className={styles.modalSubTitle}>
                  Thông tin đăng nhập sẽ được gửi qua email
                </span>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setShowCreateAccountModal(false)}
                aria-label="Đóng"
              >
                ✕
              </button>
            </header>

            <form
              className={styles.changeEmailBody}
              onSubmit={handleCreateAccount}
            >
              <label className={styles.modalLabel} htmlFor="create-username">
                Tên tài khoản <span style={{ color: "red" }}>*</span>
                <input
                  id="create-username"
                  type="text"
                  value={createAccountData.tenTaiKhoan}
                  onChange={(e) =>
                    setCreateAccountData({
                      ...createAccountData,
                      tenTaiKhoan: e.target.value,
                    })
                  }
                  className={styles.modalInput}
                  placeholder="username123"
                  required
                  disabled={createAccountLoading}
                />
              </label>

              <label className={styles.modalLabel} htmlFor="create-email">
                Email <span style={{ color: "red" }}>*</span>
                <input
                  id="create-email"
                  type="email"
                  value={createAccountData.email}
                  onChange={(e) =>
                    setCreateAccountData({
                      ...createAccountData,
                      email: e.target.value,
                    })
                  }
                  className={styles.modalInput}
                  placeholder="user@example.com"
                  required
                  disabled={createAccountLoading}
                />
              </label>

              <label className={styles.modalLabel} htmlFor="create-fullname">
                Họ tên <span style={{ color: "red" }}>*</span>
                <input
                  id="create-fullname"
                  type="text"
                  value={createAccountData.hoTen}
                  onChange={(e) =>
                    setCreateAccountData({
                      ...createAccountData,
                      hoTen: e.target.value,
                    })
                  }
                  className={styles.modalInput}
                  placeholder="Nguyễn Văn A"
                  required
                  disabled={createAccountLoading}
                />
              </label>

              <label className={styles.modalLabel} htmlFor="create-gender">
                Giới tính <span style={{ color: "red" }}>*</span>
                <select
                  id="create-gender"
                  value={createAccountData.gioiTinh}
                  onChange={(e) =>
                    setCreateAccountData({
                      ...createAccountData,
                      gioiTinh: e.target.value,
                    })
                  }
                  className={styles.modalInput}
                  required
                  disabled={createAccountLoading}
                >
                  <option value="" disabled>
                    Chọn giới tính
                  </option>
                  <option value="Nam">Nam</option>
                  <option value="Nữ">Nữ</option>
                  <option value="Khác">Khác</option>
                </select>
              </label>

              <label className={styles.modalLabel} htmlFor="create-phone">
                Số điện thoại <span style={{ color: "red" }}>*</span>
                <input
                  id="create-phone"
                  type="tel"
                  value={createAccountData.sdt}
                  onChange={(e) =>
                    setCreateAccountData({
                      ...createAccountData,
                      sdt: e.target.value,
                    })
                  }
                  className={styles.modalInput}
                  placeholder="0123456789"
                  required
                  disabled={createAccountLoading}
                />
              </label>

              <label className={styles.modalLabel} htmlFor="create-address">
                Địa chỉ <span style={{ color: "red" }}>*</span>
                <input
                  id="create-address"
                  type="text"
                  value={createAccountData.diaChi}
                  onChange={(e) =>
                    setCreateAccountData({
                      ...createAccountData,
                      diaChi: e.target.value,
                    })
                  }
                  className={styles.modalInput}
                  placeholder="123 Đường ABC, Quận XYZ"
                  required
                  disabled={createAccountLoading}
                />
              </label>

              <label
                className={styles.modalLabel}
                htmlFor="create-specialization"
              >
                Chuyên môn <span style={{ color: "red" }}>*</span>
                <select
                  id="create-specialization"
                  value={createAccountData.chuyenMonId}
                  onChange={(e) =>
                    setCreateAccountData({
                      ...createAccountData,
                      chuyenMonId: Number(e.target.value),
                    })
                  }
                  className={styles.modalInput}
                  required
                  disabled={createAccountLoading}
                >
                  <option value={0} disabled>
                    Chọn chuyên môn
                  </option>
                  {Object.entries(specializations).map(([id, name]) => (
                    <option key={id} value={Number(id)}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.modalLabel} htmlFor="create-role">
                Quyền <span style={{ color: "red" }}>*</span>
                <select
                  id="create-role"
                  value={createAccountData.quyenId}
                  onChange={(e) =>
                    setCreateAccountData({
                      ...createAccountData,
                      quyenId: Number(e.target.value),
                    })
                  }
                  className={styles.modalInput}
                  required
                  disabled={createAccountLoading}
                >
                  <option value={0} disabled>
                    Chọn quyền cho tài khoản
                  </option>
                  {availableRoles.map((role) => (
                    <option key={role.quyenId} value={role.quyenId}>
                      {role.tenQuyen} {role.moTa ? `- ${role.moTa}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <p className={styles.changeEmailHelp}>
                Mật khẩu mặc định cho tất cả tài khoản mới là{" "}
                <strong>123</strong>. Thông tin đăng nhập sẽ được gửi đến email
                của người dùng. Khuyến khích người dùng đổi mật khẩu sau lần
                đăng nhập đầu tiên.
              </p>

              <div className={styles.changeEmailActions}>
                <button
                  type="button"
                  className={styles.modalCloseSecondary}
                  onClick={() => {
                    setShowCreateAccountModal(false);
                    setCreateAccountData({
                      tenTaiKhoan: "",
                      email: "",
                      hoTen: "",
                      gioiTinh: "",
                      sdt: "",
                      diaChi: "",
                      chuyenMonId: 0,
                      quyenId: 0,
                    });
                  }}
                  disabled={createAccountLoading}
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  className={`${styles.actionBtn} ${styles.editBtn}`}
                  disabled={createAccountLoading}
                >
                  {createAccountLoading ? "Đang tạo..." : "Tạo tài khoản"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Thông tin Admin */}
      {showAdminProfileModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => {
            setShowAdminProfileModal(false);
            setIsEditingAdminProfile(false);
          }}
        >
          <div
            className={styles.accountModal}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-profile-title"
          >
            <header className={styles.modalHeader}>
              <div>
                <h3 id="admin-profile-title">
                  {isEditingAdminProfile
                    ? "Chỉnh sửa thông tin Admin"
                    : "Thông tin Admin"}
                </h3>
                <span className={styles.modalSubTitle}>
                  {isEditingAdminProfile
                    ? "Cập nhật thông tin cá nhân của bạn"
                    : `#${adminProfileData.taiKhoanId} · ${adminProfileData.tenTaiKhoan || "Admin"}`}
                </span>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => {
                  setShowAdminProfileModal(false);
                  setIsEditingAdminProfile(false);
                }}
                aria-label="Đóng"
              >
                ✕
              </button>
            </header>

            {isEditingAdminProfile ? (
              <form
                className={styles.changeEmailBody}
                onSubmit={handleUpdateAdminProfile}
              >
                <label className={styles.modalLabel} htmlFor="admin-username">
                  Tên tài khoản <span style={{ color: "red" }}>*</span>
                  <input
                    id="admin-username"
                    type="text"
                    value={adminProfileData.tenTaiKhoan}
                    onChange={(e) =>
                      setAdminProfileData({
                        ...adminProfileData,
                        tenTaiKhoan: e.target.value,
                      })
                    }
                    className={styles.modalInput}
                    placeholder="admin123"
                    required
                    disabled={adminProfileLoading}
                  />
                </label>

                <label className={styles.modalLabel} htmlFor="admin-email">
                  Email <span style={{ color: "red" }}>*</span>
                  <input
                    id="admin-email"
                    type="email"
                    value={adminProfileData.email}
                    className={styles.modalInput}
                    placeholder="admin@example.com"
                    disabled
                    style={{
                      backgroundColor: "#f3f4f6",
                      cursor: "not-allowed",
                    }}
                  />
                  <small style={{ color: "#64748b" }}>
                    Email không thể thay đổi để đảm bảo an toàn
                  </small>
                </label>

                <label className={styles.modalLabel} htmlFor="admin-fullname">
                  Họ tên <span style={{ color: "red" }}>*</span>
                  <input
                    id="admin-fullname"
                    type="text"
                    value={adminProfileData.hoTen}
                    onChange={(e) =>
                      setAdminProfileData({
                        ...adminProfileData,
                        hoTen: e.target.value,
                      })
                    }
                    className={styles.modalInput}
                    placeholder="Nguyễn Văn A"
                    required
                    disabled={adminProfileLoading}
                  />
                </label>

                <label className={styles.modalLabel} htmlFor="admin-gender">
                  Giới tính <span style={{ color: "red" }}>*</span>
                  <select
                    id="admin-gender"
                    value={adminProfileData.gioiTinh}
                    onChange={(e) =>
                      setAdminProfileData({
                        ...adminProfileData,
                        gioiTinh: e.target.value,
                      })
                    }
                    className={styles.modalInput}
                    required
                    disabled={adminProfileLoading}
                  >
                    <option value="" disabled>
                      Chọn giới tính
                    </option>
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                    <option value="Khác">Khác</option>
                  </select>
                </label>

                <label className={styles.modalLabel} htmlFor="admin-birthdate">
                  Ngày sinh
                  <input
                    id="admin-birthdate"
                    type="date"
                    value={adminProfileData.ngaySinh}
                    onChange={(e) =>
                      setAdminProfileData({
                        ...adminProfileData,
                        ngaySinh: e.target.value,
                      })
                    }
                    className={styles.modalInput}
                    disabled={adminProfileLoading}
                  />
                </label>

                <label className={styles.modalLabel} htmlFor="admin-phone">
                  Số điện thoại <span style={{ color: "red" }}>*</span>
                  <input
                    id="admin-phone"
                    type="tel"
                    value={adminProfileData.sdt}
                    onChange={(e) =>
                      setAdminProfileData({
                        ...adminProfileData,
                        sdt: e.target.value,
                      })
                    }
                    className={styles.modalInput}
                    placeholder="0123456789"
                    required
                    disabled={adminProfileLoading}
                  />
                </label>

                <label className={styles.modalLabel} htmlFor="admin-address">
                  Địa chỉ <span style={{ color: "red" }}>*</span>
                  <input
                    id="admin-address"
                    type="text"
                    value={adminProfileData.diaChi}
                    onChange={(e) =>
                      setAdminProfileData({
                        ...adminProfileData,
                        diaChi: e.target.value,
                      })
                    }
                    className={styles.modalInput}
                    placeholder="123 Đường ABC, Quận XYZ"
                    required
                    disabled={adminProfileLoading}
                  />
                </label>

                <label
                  className={styles.modalLabel}
                  htmlFor="admin-specialization"
                >
                  Chuyên môn <span style={{ color: "red" }}>*</span>
                  <select
                    id="admin-specialization"
                    value={adminProfileData.chuyenMonId}
                    onChange={(e) =>
                      setAdminProfileData({
                        ...adminProfileData,
                        chuyenMonId: Number(e.target.value),
                      })
                    }
                    className={styles.modalInput}
                    required
                    disabled={adminProfileLoading}
                  >
                    <option value={0} disabled>
                      Chọn chuyên môn
                    </option>
                    {Object.entries(specializations).map(([id, name]) => (
                      <option key={id} value={Number(id)}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className={styles.changeEmailActions}>
                  <button
                    type="button"
                    className={styles.modalCloseSecondary}
                    onClick={() => {
                      setIsEditingAdminProfile(false);
                      handleOpenAdminProfile();
                    }}
                    disabled={adminProfileLoading}
                  >
                    Huỷ
                  </button>
                  <button
                    type="submit"
                    className={`${styles.actionBtn} ${styles.editBtn}`}
                    disabled={adminProfileLoading}
                  >
                    {adminProfileLoading ? "Đang cập nhật..." : "Cập nhật"}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className={styles.modalBody}>
                  <section className={styles.modalSection}>
                    <h4>Thông tin tài khoản</h4>
                    <div className={styles.infoGrid}>
                      <div>
                        <span className={styles.infoLabel}>Tên đăng nhập</span>
                        <span className={styles.infoValue}>
                          {adminProfileData.tenTaiKhoan || "--"}
                        </span>
                      </div>
                      <div>
                        <span className={styles.infoLabel}>Email</span>
                        <span className={styles.infoValue}>
                          {adminProfileData.email || "--"}
                        </span>
                      </div>
                      <div>
                        <span className={styles.infoLabel}>Quyền</span>
                        <span className={styles.infoValue}>Admin</span>
                      </div>
                    </div>
                  </section>

                  <section className={styles.modalSection}>
                    <h4>Thông tin cá nhân</h4>
                    {adminProfileData.hoTen ||
                    adminProfileData.gioiTinh ||
                    adminProfileData.ngaySinh ||
                    adminProfileData.sdt ||
                    adminProfileData.diaChi ||
                    adminProfileData.chuyenMonId ? (
                      <div className={styles.infoGrid}>
                        <div>
                          <span className={styles.infoLabel}>Họ tên</span>
                          <span className={styles.infoValue}>
                            {adminProfileData.hoTen || "--"}
                          </span>
                        </div>
                        <div>
                          <span className={styles.infoLabel}>Giới tính</span>
                          <span className={styles.infoValue}>
                            {adminProfileData.gioiTinh || "--"}
                          </span>
                        </div>
                        <div>
                          <span className={styles.infoLabel}>Ngày sinh</span>
                          <span className={styles.infoValue}>
                            {adminProfileData.ngaySinh
                              ? new Date(
                                  adminProfileData.ngaySinh
                                ).toLocaleDateString("vi-VN")
                              : "--"}
                          </span>
                        </div>
                        <div>
                          <span className={styles.infoLabel}>
                            Số điện thoại
                          </span>
                          <span className={styles.infoValue}>
                            {adminProfileData.sdt || "--"}
                          </span>
                        </div>
                        <div>
                          <span className={styles.infoLabel}>Địa chỉ</span>
                          <span className={styles.infoValue}>
                            {adminProfileData.diaChi || "--"}
                          </span>
                        </div>
                        <div>
                          <span className={styles.infoLabel}>Chuyên môn</span>
                          <span className={styles.infoValue}>
                            {adminProfileData.chuyenMonId
                              ? specializations[adminProfileData.chuyenMonId] ||
                                "--"
                              : "--"}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className={styles.emptyMember}>
                        Chưa có thông tin cá nhân.
                      </p>
                    )}
                  </section>
                </div>

                <footer className={styles.modalFooter}>
                  <button
                    type="button"
                    className={styles.modalCloseSecondary}
                    onClick={() => {
                      setShowAdminProfileModal(false);
                      setIsEditingAdminProfile(false);
                    }}
                  >
                    Đóng
                  </button>
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.editBtn}`}
                    onClick={() => setIsEditingAdminProfile(true)}
                  >
                    <FiEdit /> Chỉnh sửa
                  </button>
                </footer>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal Đổi Mật Khẩu */}
      {showChangePasswordModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowChangePasswordModal(false)}
        >
          <div
            className={styles.changeEmailModal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h2>Đổi Mật Khẩu</h2>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => {
                  setShowChangePasswordModal(false);
                  setChangePasswordData({
                    currentPassword: "",
                    newPassword: "",
                    confirmPassword: "",
                  });
                }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleChangePassword}>
              <label className={styles.modalLabel} htmlFor="current-password">
                Mật khẩu hiện tại <span style={{ color: "red" }}>*</span>
                <input
                  id="current-password"
                  type="password"
                  value={changePasswordData.currentPassword}
                  onChange={(e) =>
                    setChangePasswordData({
                      ...changePasswordData,
                      currentPassword: e.target.value,
                    })
                  }
                  className={styles.modalInput}
                  required
                  placeholder="Nhập mật khẩu hiện tại"
                  disabled={changePasswordLoading}
                />
              </label>

              <label className={styles.modalLabel} htmlFor="new-password">
                Mật khẩu mới <span style={{ color: "red" }}>*</span>
                <input
                  id="new-password"
                  type="password"
                  value={changePasswordData.newPassword}
                  onChange={(e) =>
                    setChangePasswordData({
                      ...changePasswordData,
                      newPassword: e.target.value,
                    })
                  }
                  className={styles.modalInput}
                  required
                  placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                  disabled={changePasswordLoading}
                />
              </label>

              <label className={styles.modalLabel} htmlFor="confirm-password">
                Xác nhận mật khẩu mới <span style={{ color: "red" }}>*</span>
                <input
                  id="confirm-password"
                  type="password"
                  value={changePasswordData.confirmPassword}
                  onChange={(e) =>
                    setChangePasswordData({
                      ...changePasswordData,
                      confirmPassword: e.target.value,
                    })
                  }
                  className={styles.modalInput}
                  required
                  placeholder="Nhập lại mật khẩu mới"
                  disabled={changePasswordLoading}
                />
              </label>

              <div className={styles.changeEmailActions}>
                <button
                  type="button"
                  className={styles.modalCloseSecondary}
                  onClick={() => {
                    setShowChangePasswordModal(false);
                    setChangePasswordData({
                      currentPassword: "",
                      newPassword: "",
                      confirmPassword: "",
                    });
                  }}
                  disabled={changePasswordLoading}
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  className={`${styles.actionBtn} ${styles.editBtn}`}
                  disabled={changePasswordLoading}
                >
                  {changePasswordLoading ? "Đang xử lý..." : "Đổi mật khẩu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal phân quyền */}
      {changeRoleTarget && (
        <div className={styles.modalOverlay}>
          <div className={styles.roleModal}>
            <h3 className={styles.roleModalTitle}>Phân quyền tài khoản</h3>
            <div className={styles.roleModalBody}>
              <div className={styles.accountInfo}>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Tài khoản:</span>
                  <span className={styles.infoValue}>
                    {changeRoleTarget.tenTaiKhoan}
                  </span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Họ tên:</span>
                  <span className={styles.infoValue}>
                    {changeRoleTarget.thanhVien?.hoTen || "--"}
                  </span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Quyền hiện tại:</span>
                  <span className={styles.currentRole}>
                    {changeRoleTarget.tenQuyen}
                  </span>
                </div>
              </div>

              <div className={styles.roleSelectWrapper}>
                <label htmlFor="roleSelect" className={styles.roleLabel}>
                  Chọn quyền mới
                </label>
                <select
                  id="roleSelect"
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(Number(e.target.value))}
                  className={styles.roleSelect}
                >
                  <option value={0}>-- Chọn quyền --</option>
                  {availableRoles.map((role) => (
                    <option key={role.quyenId} value={role.quyenId}>
                      {role.tenQuyen}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.roleModalActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => {
                  setChangeRoleTarget(null);
                  setSelectedRoleId(0);
                }}
                disabled={changeRoleLoading}
              >
                Huỷ
              </button>
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.confirmRoleBtn}`}
                onClick={handleChangeRole}
                disabled={changeRoleLoading || !selectedRoleId}
              >
                {changeRoleLoading ? "Đang xử lý..." : "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal xác nhận reset mật khẩu */}
      {resetPasswordTarget && (
        <div className={styles.modalOverlay}>
          <div className={styles.confirmModal}>
            <div className={styles.confirmHeader}>
              <h3 className={styles.confirmTitle}>
                ⚠️ Xác nhận Reset Mật khẩu
              </h3>
            </div>
            <div className={styles.confirmBody}>
              <p className={styles.confirmMessage}>
                Bạn có chắc chắn muốn reset mật khẩu về <strong>"123"</strong>{" "}
                cho tài khoản:
              </p>
              <div className={styles.confirmAccountInfo}>
                <span className={styles.confirmAccountName}>
                  {resetPasswordTarget.tenTaiKhoan}
                </span>
              </div>
              <p className={styles.confirmWarning}>
                ⚠️ Mật khẩu sẽ được đặt lại về "123" và người dùng sẽ nhận email
                thông báo.
              </p>
            </div>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.confirmCancelBtn}
                onClick={() => setResetPasswordTarget(null)}
              >
                Huỷ
              </button>
              <button
                type="button"
                className={styles.confirmResetBtn}
                onClick={() => {
                  void handleResetPassword(
                    resetPasswordTarget.taiKhoanId,
                    resetPasswordTarget.tenTaiKhoan
                  );
                }}
              >
                Xác nhận Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Chỉnh sửa tài khoản */}
      {showEditAccountModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowEditAccountModal(false)}
        >
          <div
            className={styles.changeEmailModal}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-account-title"
          >
            <header className={styles.modalHeader}>
              <div>
                <h3 id="edit-account-title">Chỉnh sửa thông tin tài khoản</h3>
                <span className={styles.modalSubTitle}>
                  #{editAccountData.taiKhoanId} · {editAccountData.tenTaiKhoan}
                </span>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setShowEditAccountModal(false)}
                aria-label="Đóng"
              >
                ✕
              </button>
            </header>

            <form
              className={styles.changeEmailBody}
              onSubmit={handleUpdateAccount}
            >
              <label className={styles.modalLabel} htmlFor="edit-username">
                Tên tài khoản <span style={{ color: "red" }}>*</span>
                <input
                  id="edit-username"
                  type="text"
                  value={editAccountData.tenTaiKhoan}
                  onChange={(e) =>
                    setEditAccountData({
                      ...editAccountData,
                      tenTaiKhoan: e.target.value,
                    })
                  }
                  className={styles.modalInput}
                  placeholder="username123"
                  required
                  disabled={editAccountLoading}
                />
              </label>

              <label className={styles.modalLabel} htmlFor="edit-email">
                Email <span style={{ color: "red" }}>*</span>
                <input
                  id="edit-email"
                  type="email"
                  value={editAccountData.email}
                  onChange={(e) =>
                    setEditAccountData({
                      ...editAccountData,
                      email: e.target.value,
                    })
                  }
                  className={styles.modalInput}
                  placeholder="user@example.com"
                  required
                  disabled={editAccountLoading}
                />
              </label>

              <label className={styles.modalLabel} htmlFor="edit-fullname">
                Họ tên <span style={{ color: "red" }}>*</span>
                <input
                  id="edit-fullname"
                  type="text"
                  value={editAccountData.hoTen}
                  onChange={(e) =>
                    setEditAccountData({
                      ...editAccountData,
                      hoTen: e.target.value,
                    })
                  }
                  className={styles.modalInput}
                  placeholder="Nguyễn Văn A"
                  required
                  disabled={editAccountLoading}
                />
              </label>

              <label className={styles.modalLabel} htmlFor="edit-gender">
                Giới tính <span style={{ color: "red" }}>*</span>
                <select
                  id="edit-gender"
                  value={editAccountData.gioiTinh}
                  onChange={(e) =>
                    setEditAccountData({
                      ...editAccountData,
                      gioiTinh: e.target.value,
                    })
                  }
                  className={styles.modalInput}
                  required
                  disabled={editAccountLoading}
                >
                  <option value="" disabled>
                    Chọn giới tính
                  </option>
                  <option value="Nam">Nam</option>
                  <option value="Nữ">Nữ</option>
                  <option value="Khác">Khác</option>
                </select>
              </label>

              <label className={styles.modalLabel} htmlFor="edit-birthdate">
                Ngày sinh
                <input
                  id="edit-birthdate"
                  type="date"
                  value={editAccountData.ngaySinh}
                  onChange={(e) =>
                    setEditAccountData({
                      ...editAccountData,
                      ngaySinh: e.target.value,
                    })
                  }
                  className={styles.modalInput}
                  disabled={editAccountLoading}
                />
              </label>

              <label className={styles.modalLabel} htmlFor="edit-phone">
                Số điện thoại <span style={{ color: "red" }}>*</span>
                <input
                  id="edit-phone"
                  type="tel"
                  value={editAccountData.sdt}
                  onChange={(e) =>
                    setEditAccountData({
                      ...editAccountData,
                      sdt: e.target.value,
                    })
                  }
                  className={styles.modalInput}
                  placeholder="0123456789"
                  required
                  disabled={editAccountLoading}
                />
              </label>

              <label className={styles.modalLabel} htmlFor="edit-address">
                Địa chỉ <span style={{ color: "red" }}>*</span>
                <input
                  id="edit-address"
                  type="text"
                  value={editAccountData.diaChi}
                  onChange={(e) =>
                    setEditAccountData({
                      ...editAccountData,
                      diaChi: e.target.value,
                    })
                  }
                  className={styles.modalInput}
                  placeholder="123 Đường ABC, Quận XYZ"
                  required
                  disabled={editAccountLoading}
                />
              </label>

              <label
                className={styles.modalLabel}
                htmlFor="edit-specialization"
              >
                Chuyên môn <span style={{ color: "red" }}>*</span>
                <select
                  id="edit-specialization"
                  value={editAccountData.chuyenMonId}
                  onChange={(e) =>
                    setEditAccountData({
                      ...editAccountData,
                      chuyenMonId: Number(e.target.value),
                    })
                  }
                  className={styles.modalInput}
                  required
                  disabled={editAccountLoading}
                >
                  <option value={0} disabled>
                    Chọn chuyên môn
                  </option>
                  {Object.entries(specializations).map(([id, name]) => (
                    <option key={id} value={Number(id)}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>

              <div className={styles.changeEmailActions}>
                <button
                  type="button"
                  className={styles.modalCloseSecondary}
                  onClick={() => {
                    setShowEditAccountModal(false);
                    setEditAccountData({
                      taiKhoanId: 0,
                      tenTaiKhoan: "",
                      email: "",
                      hoTen: "",
                      gioiTinh: "",
                      ngaySinh: "",
                      sdt: "",
                      diaChi: "",
                      chuyenMonId: 0,
                    });
                  }}
                  disabled={editAccountLoading}
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  className={`${styles.actionBtn} ${styles.editBtn}`}
                  disabled={editAccountLoading}
                >
                  {editAccountLoading ? "Đang cập nhật..." : "Cập nhật"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagementDashboard;
