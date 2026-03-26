import { useMemo } from "react";
import styles from "./Sidebar.module.scss";
import {
  FaInfoCircle,
  FaUsers,
  FaProjectDiagram,
  FaChartLine,
} from "react-icons/fa";
import type { IconType } from "react-icons";

export type Tab = "ChiTietNhom" | "ThanhVien" | "DuAn" | "ThongKeDuAn";

interface SidebarProps {
  activeTab: Tab;
  onTabChange?: (tab: Tab) => void;
  isLeader?: boolean;
  userRole?: number | null;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  isLeader,
  userRole,
}) => {
  const navItems = useMemo(() => {
    const isThanhVien = userRole === 3;
    const items = [
      {
        key: "ChiTietNhom" as Tab,
        label: "Chi tiết nhóm",
        description: "Xem thông tin tổng quan và hoạt động",
        Icon: FaInfoCircle,
      },
      {
        key: "ThanhVien" as Tab,
        label: isThanhVien ? "Danh sách thành viên" : "Quản lý thành viên",
        description: "Theo dõi thành viên, phân quyền",
        Icon: FaUsers,
      },
      {
        key: "DuAn" as Tab,
        label: isThanhVien ? "Danh sách dự án" : "Quản lý dự án",
        description: "Danh sách dự án và tiến độ",
        Icon: FaProjectDiagram,
      },
    ] satisfies Array<{
      key: Tab;
      label: string;
      description: string;
      Icon: IconType;
    }>;

    // Chỉ thêm tab Tổng quan nếu không phải thành viên
    if (!isThanhVien) {
      items.push({
        key: "ThongKeDuAn" as Tab,
        label: "Tổng quan dự án",
        description: "Theo dõi tiến độ và giám sát tất cả dự án",
        Icon: FaChartLine,
      });
    }

    return items;
  }, [isLeader, userRole]);

  const handleTabClick = (tab: Tab) => {
    onTabChange?.(tab);
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <span className={styles.sidebarBadge}>Workspace</span>
        <h2 className={styles.sidebarTitle}>Điều hướng nhanh</h2>
        <p className={styles.sidebarSubtitle}>
          Chọn mục để quản lý thông tin nhóm của bạn
        </p>
      </div>

      <nav className={styles.nav} aria-label="Chức năng quản lý nhóm">
        {navItems.map(({ key, label, description, Icon }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              className={`${styles.navItem} ${isActive ? styles.active : ""}`}
              onClick={() => handleTabClick(key)}
            >
              <span className={styles.navIconWrap} aria-hidden="true">
                <Icon />
              </span>
              <span className={styles.navContent}>
                <span className={styles.navLabel}>{label}</span>
                <span className={styles.navDescription}>{description}</span>
              </span>
              {isActive && (
                <span className={styles.activePill} aria-hidden="true" />
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;
