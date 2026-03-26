import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import styles from "./GroupDropdown.module.scss";
import img from "./default-group.png";

interface Group {
  nhomId: number;
  tenNhom: string;
  moTa: string;
  soLuongTv: number;
  ngayLapNhom: string;
  anhBia: string;
  chucVu: string;
}

interface GroupDropdownProps {
  onSelect?: (group: Group) => void;
  refreshTrigger?: number; // Add this to trigger re-fetch
}

const GroupDropdown: React.FC<GroupDropdownProps> = ({ onSelect, refreshTrigger }) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  const [showModal, setShowModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const taikhoan = JSON.parse(localStorage.getItem("user") || "{}");
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    const fetchGroups = async () => {
      try {
        const response = await axios.get<Group[]>(
          `https://localhost:7036/api/Nhom/GetGroupsOfMember/${taikhoan.UserId}`
        );
        const data = response.data || [];
        setGroups(data);

        // ✅ Auto select nhóm đầu tiên
        if (data.length > 0) {
          setSelectedGroup((prev) => {
            if (!prev) {
              if (onSelect) onSelect(data[0]);
              return data[0];
            }
            const stillExists = data.find((group) => group.nhomId === prev.nhomId);
            if (!stillExists) {
              if (onSelect) onSelect(data[0]);
              return data[0];
            }
            return prev;
          });
        } else {
          setSelectedGroup(null);
        }
      } catch (error) {
        console.error("❌ Lỗi khi lấy danh sách nhóm:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchGroups();
    interval = setInterval(fetchGroups, 3000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [onSelect, refreshTrigger, taikhoan.UserId]);

  // ✅ Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getBorderColor = (role: string) => {
    switch (role) {
      case "Trưởng nhóm":
        return "#007bff";
      case "Thành viên":
        return "#888";
      default:
        return "#6f42c1";
    }
  };

  const handleSelect = (group: Group) => {
    setSelectedGroup(group);
    setIsOpen(false);
    if (onSelect) onSelect(group);
  };

  const getFullImageUrl = (anhBia: string | null | undefined): string => {
    if (!anhBia) {
      // Trả về hình mặc định khi không có ảnh
      return img; // bạn có thể đặt ảnh mặc định trong thư mục public
    }

    return anhBia.startsWith("http")
      ? anhBia
      : `https://localhost:7036${anhBia}`;
  };

  if (loading)
    return <p className={styles.loading}>Đang tải danh sách nhóm...</p>;

  return (
    <div className={styles.dropdownWrapper} ref={dropdownRef}>
      <div
        className={styles.selected}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {selectedGroup ? (
          <>
            <img
              src={getFullImageUrl(selectedGroup.anhBia)}
              alt={selectedGroup.tenNhom}
              className={styles.avatar}
              style={{ borderColor: getBorderColor(selectedGroup.chucVu) }}
            />
            <div className={styles.info}>
              <span className={styles.name} title={selectedGroup.tenNhom}>
                {selectedGroup.tenNhom}
              </span>
              <span className={styles.role}>{selectedGroup.chucVu}</span>
            </div>
          </>
        ) : (
          <span>{groups.length === 0 ? "Không có nhóm nào" : "Chọn nhóm..."}</span>
        )}
        <span className={`${styles.arrow} ${isOpen ? styles.open : ""}`}>
          ▼
        </span>
      </div>

      {isOpen && (
        <ul className={styles.dropdownList}>
          {groups.length === 0 ? (
            <li className={styles.dropdownItem}>Không có nhóm nào</li>
          ) : (
            groups.map((group) => (
              <li
                key={group.nhomId}
                className={styles.dropdownItem}
                onClick={() => handleSelect(group)}
              >
                <img
                  src={getFullImageUrl(group.anhBia)}
                  alt={group.tenNhom}
                  className={styles.avatar}
                  style={{ borderColor: getBorderColor(group.chucVu) }}
                />
                <div className={styles.info}>
                  <span className={styles.name} title={group.tenNhom}>
                    {group.tenNhom}
                  </span>
                  <span className={styles.role}>{group.chucVu}</span>
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

export default GroupDropdown;
