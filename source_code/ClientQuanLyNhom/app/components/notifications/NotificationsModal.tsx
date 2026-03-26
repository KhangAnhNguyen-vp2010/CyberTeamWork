import React, { useEffect, useMemo, useState } from "react";
import Modal from "../../pages/shared/pop-up/Modal";
import styles from "./NotificationsModal.module.scss";

export interface NotificationItem {
  thongBaoId: string;
  loaiThongBao: string;
  tieuDe: string;
  noiDung: string;
  mailNguoiGui: string;
  thanhVienId: number;
  ngayTao: string;
  ngayDoc: string | null;
  trangThai: string;
  ghim: number;
}

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onMarkAsRead?: (notificationId: string) => void;
  markingNotificationId?: string | null;
  onMarkAllAsRead?: () => void;
  markingAll?: boolean;
  onTogglePin?: (notificationId: string) => void;
  pinningNotificationId?: string | null;
  onDeleteNotification?: (notificationId: string) => void;
  deletingNotificationId?: string | null;
}

const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  notifications,
  loading,
  error,
  onRefresh,
  onMarkAsRead,
  markingNotificationId,
  onMarkAllAsRead,
  markingAll,
  onTogglePin,
  pinningNotificationId,
  onDeleteNotification,
  deletingNotificationId,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "unread" | "read" | "pinned">("all");
  const [sortOption, setSortOption] = useState<"newest" | "oldest" | "pinned">("newest");

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const hasUnread = notifications.some(
    (item) => item.trangThai?.toLowerCase() === "chưa đọc"
  );

  const filteredNotifications = useMemo(() => {
    let list = [...notifications];
    const term = searchTerm.trim().toLowerCase();

    if (term) {
      list = list.filter((item) =>
        [item.tieuDe, item.noiDung]
          .filter(Boolean)
          .some((field) => field!.toLowerCase().includes(term))
      );
    }

    switch (statusFilter) {
      case "unread":
        list = list.filter(
          (item) => item.trangThai?.toLowerCase() === "chưa đọc"
        );
        break;
      case "read":
        list = list.filter(
          (item) => item.trangThai?.toLowerCase() === "đã đọc"
        );
        break;
      case "pinned":
        list = list.filter((item) => item.ghim);
        break;
      default:
        break;
    }

    list.sort((a, b) => {
      const dateA = new Date(a.ngayTao).getTime();
      const dateB = new Date(b.ngayTao).getTime();

      if (sortOption === "newest") {
        return dateB - dateA;
      }

      if (sortOption === "oldest") {
        return dateA - dateB;
      }

      const pinDelta = (b.ghim ? 1 : 0) - (a.ghim ? 1 : 0);
      if (pinDelta !== 0) return pinDelta;
      return dateB - dateA;
    });

    return list;
  }, [notifications, searchTerm, statusFilter, sortOption]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Thông báo của bạn">
      <div className={styles.modalWrapper}>
        <div className={styles.headerActions}>
          {onMarkAllAsRead && (
            <button
              className={styles.markAllBtn}
              onClick={onMarkAllAsRead}
              disabled={loading || markingAll || !hasUnread}
              type="button"
            >
              {markingAll ? "Đang đánh dấu tất cả..." : "Đánh dấu tất cả đã đọc"}
            </button>
          )}
          <button className={styles.refreshBtn} onClick={onRefresh} disabled={loading}>
            {loading ? "Đang tải..." : "Làm mới"}
          </button>
        </div>

        <div className={styles.controlRow}>
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Tìm kiếm theo tiêu đề hoặc nội dung"
            className={styles.searchInput}
          />
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as typeof statusFilter)
            }
            className={styles.select}
          >
            <option value="all">Tất cả</option>
            <option value="unread">Chưa đọc</option>
            <option value="read">Đã đọc</option>
            <option value="pinned">Đã ghim</option>
          </select>
          <select
            value={sortOption}
            onChange={(event) =>
              setSortOption(event.target.value as typeof sortOption)
            }
            className={styles.select}
          >
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
            <option value="pinned">Ưu tiên ghim</option>
          </select>
        </div>

        {error ? (
          <div className={styles.error}>{error}</div>
        ) : loading ? (
          <div className={styles.stateInfo}>Đang tải thông báo...</div>
        ) : notifications.length === 0 ? (
          <div className={styles.stateInfo}>Bạn chưa có thông báo nào.</div>
        ) : filteredNotifications.length === 0 ? (
          <div className={styles.stateInfo}>Không tìm thấy thông báo phù hợp.</div>
        ) : (
          <ul className={styles.notificationList}>
            {filteredNotifications.map((item) => {
              const itemClasses = [styles.notificationItem];
              if (item.trangThai?.toLowerCase() === "chưa đọc") {
                itemClasses.push(styles.unread);
              }
              if (item.ghim) {
                itemClasses.push(styles.pinned);
              }

              return (
                <li key={item.thongBaoId} className={itemClasses.join(" ")}>
                  <div className={styles.meta}>
                    <span className={styles.type}>{item.loaiThongBao}</span>
                    <span className={styles.date}>
                      {new Date(item.ngayTao).toLocaleString("vi-VN")}
                    </span>
                    {onTogglePin && (
                      <button
                        type="button"
                        className={styles.pinBtn}
                        onClick={() => onTogglePin(item.thongBaoId)}
                        disabled={pinningNotificationId === item.thongBaoId}
                      >
                        {pinningNotificationId === item.thongBaoId
                          ? "Đang cập nhật..."
                          : item.ghim
                            ? "Bỏ ghim"
                            : "Ghim"}
                      </button>
                    )}
                  </div>
                  <h4 className={styles.title}>{item.tieuDe}</h4>
                  <p className={styles.body}>{item.noiDung}</p>
                  <div className={styles.footer}>
                    <span>Người gửi: {item.mailNguoiGui}</span>
                    {item.ngayDoc && (
                      <span>Đã đọc: {new Date(item.ngayDoc).toLocaleString("vi-VN")}</span>
                    )}
                  </div>
                  {item.trangThai?.toLowerCase() === "chưa đọc" && onMarkAsRead && (
                    <button
                      type="button"
                      className={styles.markReadBtn}
                      onClick={() => onMarkAsRead(item.thongBaoId)}
                      disabled={markingNotificationId === item.thongBaoId}
                    >
                      {markingNotificationId === item.thongBaoId
                        ? "Đang đánh dấu..."
                        : "Đánh dấu đã đọc"}
                    </button>
                  )}
                  {onDeleteNotification && (
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      onClick={() => onDeleteNotification(item.thongBaoId)}
                      disabled={deletingNotificationId === item.thongBaoId}
                    >
                      {deletingNotificationId === item.thongBaoId
                        ? "Đang xóa..."
                        : "Xóa thông báo"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
};

export default NotificationsModal;
