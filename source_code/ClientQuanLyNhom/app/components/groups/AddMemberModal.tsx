import { useState, useEffect, useCallback, useMemo } from "react";
import styles from "./CreateGroupModal.module.scss";
import Modal from "../../pages/shared/pop-up/Modal";
import MemberDetailModal from "./MemberDetailModal";
import api from "../../apis/api";
import { toast } from "react-toastify";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  nhomId: number;
}

interface MemberProject {
  tenDuAn: string;
  tenNhom?: string;
  trangThai?: string;
  linhVuc?: string;
}

interface MemberApiResponse {
  thanhVienId: number;
  hoTen: string;
  email: string;
  chuyenMon: string | null;
  quyenId?: number;
  danhSachNhom?: {
    nhomId: number;
    tenNhom: string;
    chucVu?: string | null;
    duAnThuocNhom?: {
      duAnId: number;
      tenDuAn: string;
      trangThai: string;
      linhVuc?: string;
    }[];
  }[];
}

interface MemberOption extends MemberApiResponse {
  projects: MemberProject[];
}

interface SentInvite {
  nguoiGuiId: number;
  mailNguoiNhan: string;
  nhomId: number;
  trangThaiLoiMoi: string;
  tieuDe: string;
  noiDung: string;
  thoiGianGui: string;
}

const AddMemberModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  nhomId,
}) => {
  const [formData, setFormData] = useState({
    nguoiGuiId: 0,
    mailNguoiNhan: "",
    nhomId: 0,
  });
  const [loading, setLoading] = useState(false);
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [availableSpecialties, setAvailableSpecialties] = useState<string[]>(
    []
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("name-asc");
  const [specialtyFilter, setSpecialtyFilter] = useState("all");
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"members" | "sent">("members");
  const [sentInvites, setSentInvites] = useState<SentInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [invitesError, setInvitesError] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedMemberForDetail, setSelectedMemberForDetail] = useState<
    number | null
  >(null);
  const [projectFields, setProjectFields] = useState<string[]>([]);
  const [showRelevantOnly, setShowRelevantOnly] = useState(false);

  // Fetch all specialties from API
  const fetchAllSpecialties = useCallback(async () => {
    try {
      const response = await api.get("/Auth/chuyen-mon");
      if (response.data?.success && Array.isArray(response.data.data)) {
        const specialties = response.data.data.map(
          (item: any) => item.tenChuyenMon
        );
        setAvailableSpecialties(specialties);
      }
    } catch (error) {
      console.error("Error fetching specialties:", error);
      setAvailableSpecialties([]);
    }
  }, []);

  const fetchMembers = useCallback(async () => {
    setMembersLoading(true);
    setMembersError(null);
    try {
      const response = await api.get("/ThanhVien/thanh-vien");
      const data: MemberApiResponse[] = Array.isArray(response.data)
        ? response.data
        : [];
      const normalizedCurrentEmail = currentUserEmail?.toLowerCase() ?? null;
      const filteredData = data.filter((member) => {
        if (member.quyenId === 1 || member.quyenId === 2) {
          return false;
        }

        // Filter out members who are managers in any group
        const isManager = member.danhSachNhom?.some(
          (group) =>
            group.chucVu && group.chucVu.toLowerCase().includes("trưởng nhóm")
        );
        if (isManager) {
          return false;
        }

        const isInCurrentGroup = member.danhSachNhom?.some(
          (group) => group.nhomId === nhomId
        );
        if (isInCurrentGroup) {
          return false;
        }

        if (normalizedCurrentEmail) {
          const memberEmail = member.email ? member.email.toLowerCase() : null;
          if (memberEmail && memberEmail === normalizedCurrentEmail) {
            return false;
          }
        }

        return true;
      });
      const normalizedData: MemberOption[] = filteredData.map((member) => {
        const projects: MemberProject[] = (member.danhSachNhom ?? []).flatMap(
          (nhom) =>
            (nhom.duAnThuocNhom ?? []).map((duAn) => ({
              tenDuAn: duAn.tenDuAn,
              trangThai: duAn.trangThai,
              linhVuc: duAn.linhVuc,
              tenNhom: nhom.tenNhom,
            }))
        );

        return {
          ...member,
          projects,
        };
      });

      setMemberOptions(normalizedData);
      if (normalizedData.length === 0) {
        setSelectedMemberId(null);
        setFormData((prev) => ({ ...prev, mailNguoiNhan: "" }));
      }
    } catch (error: any) {
      console.error("Fetch members error:", error);
      setMembersError(
        error?.response?.data?.message || "Không thể tải danh sách thành viên."
      );
      setMemberOptions([]);
    } finally {
      setMembersLoading(false);
    }
  }, [currentUserEmail, nhomId]);

  const fetchSentInvites = useCallback(
    async (senderId: number) => {
      if (!senderId) return;
      setInvitesLoading(true);
      setInvitesError(null);
      try {
        const response = await api.get(`/Nhom/da-gui/${senderId}/${nhomId}`);
        const invites: SentInvite[] = Array.isArray(response.data?.loiMoi)
          ? response.data.loiMoi
          : [];
        setSentInvites(invites);
      } catch (error: any) {
        console.error("Fetch sent invites error:", error);
        setInvitesError(
          error?.response?.data?.message || "Không thể tải danh sách lời mời."
        );
        setSentInvites([]);
      } finally {
        setInvitesLoading(false);
      }
    },
    [nhomId]
  );

  // Set nguoiGuiId and nhomId when modal opens
  useEffect(() => {
    if (isOpen) {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const senderId = user.UserId || 0;
      setFormData((prev) => ({
        ...prev,
        nguoiGuiId: senderId,
        nhomId: nhomId,
      }));
      const email = user?.Mail || user?.Email || null;
      setCurrentUserEmail(email);
      fetchMembers();
      fetchAllSpecialties();
      setSelectedMemberId(null);
      setSearchTerm("");
      setSortBy("name-asc");
      setSpecialtyFilter("all");
      setActiveTab("members");
      setSentInvites([]);
      fetchSentInvites(senderId);

      // Fetch project fields (lĩnh vực) for the group
      const fetchProjectFields = async () => {
        try {
          const response = await api.get(`/DuAn/GetProjectsOfGroup/${nhomId}`);
          console.log("📊 Projects response:", response.data);
          const projects = Array.isArray(response.data.projects)
            ? response.data.projects
            : [];
          console.log("📋 Projects list:", projects);
          const fields: string[] = projects
            .map((project: any) => project.tenLinhVuc)
            .filter((field: any): field is string => Boolean(field));
          console.log("🎯 Project fields (lĩnh vực):", fields);
          setProjectFields([...new Set(fields)]);
        } catch (error) {
          console.error("Error fetching project fields:", error);
          setProjectFields([]);
        }
      };
      fetchProjectFields();
    } else {
      setMemberOptions([]);
      setSelectedMemberId(null);
      setMembersError(null);
      setAvailableSpecialties([]);
      setSearchTerm("");
      setSortBy("name-asc");
      setSpecialtyFilter("all");
      setCurrentUserEmail(null);
      setActiveTab("members");
      setSentInvites([]);
      setInvitesError(null);
      setProjectFields([]);
      setShowRelevantOnly(false);
    }
  }, [fetchMembers, fetchSentInvites, fetchAllSpecialties, isOpen, nhomId]);

  const handleTabSwitch = (tab: "members" | "sent") => {
    setActiveTab(tab);
    if (tab === "sent" && formData.nguoiGuiId) {
      fetchSentInvites(formData.nguoiGuiId);
    }
  };

  const handleSelectMember = (member: MemberOption) => {
    setSelectedMemberId(member.thanhVienId);
    setFormData((prev) => ({ ...prev, mailNguoiNhan: member.email }));
  };

  const openMemberDetail = (memberId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedMemberForDetail(memberId);
    setDetailModalOpen(true);
  };

  const closeMemberDetail = () => {
    setDetailModalOpen(false);
    setSelectedMemberForDetail(null);
  };

  const trimmedSearchTerm = searchTerm.trim();
  const hasSearchTerm = trimmedSearchTerm.length > 0;

  const displayMembers = useMemo(() => {
    const invitedEmails = new Set(
      sentInvites
        .map((invite) => invite.mailNguoiNhan)
        .filter((email): email is string => Boolean(email))
        .map((email) => email.toLowerCase())
    );

    let list = memberOptions
      .filter((member) => {
        const email = member.email ? member.email.toLowerCase() : null;
        if (email && invitedEmails.has(email)) {
          return false;
        }
        return true;
      })
      .map((member) => {
        // Check if member has relevant specialty for project fields
        let isRelevant = false;

        if (projectFields.length > 0 && member.chuyenMon) {
          const memberSpec = member.chuyenMon.toLowerCase();

          isRelevant = projectFields.some((field) => {
            const fieldLower = field.toLowerCase();

            // 1. Direct match (chứa nhau)
            if (
              memberSpec.includes(fieldLower) ||
              fieldLower.includes(memberSpec)
            ) {
              return true;
            }

            // 2. Mapping thông minh dựa trên chuyên môn và lĩnh vực thực tế
            const mappings: Record<string, string[]> = {
              // Lĩnh vực rộng - CNTT/IT
              "công nghệ thông tin tổng hợp": [
                "developer",
                "engineer",
                "designer",
                "manager",
                "analyst",
                "tester",
                "architect",
                "administrator",
                "master",
                "scientist",
                "writer",
              ],

              // Phát triển phần mềm
              "phát triển phần mềm": [
                "developer",
                "engineer",
                "architect",
                "tester",
                "qa",
              ],

              // Web & Mobile
              website: ["front-end", "back-end", "full-stack", "ui/ux"],
              "di động": ["mobile", "full-stack"],

              // Game
              game: ["game"],

              // AI & ML & Data
              "trí tuệ nhân tạo": [
                "ai",
                "machine learning",
                "data scientist",
                "data engineer",
              ],
              "học máy": ["machine learning", "ai", "data scientist"],
              "dữ liệu": [
                "data",
                "database",
                "business analyst",
                "machine learning",
              ],

              // Cloud & DevOps
              "đám mây": ["cloud", "devops", "system administrator", "sre"],

              // Security
              "an toàn": ["security", "network"],
              "bảo mật": ["security", "network"],

              // IoT & Embedded
              nhúng: ["embedded"],
              iot: ["embedded", "network"],

              // UI/UX
              "giao diện": ["ui/ux", "designer", "front-end"],

              // Architecture
              "kiến trúc": ["architect", "system administrator", "devops"],

              // Automation
              "tự động": ["automation", "devops", "test"],

              // Blockchain
              blockchain: ["blockchain", "back-end", "full-stack"],
              web3: ["blockchain", "full-stack"],

              // System Admin
              "quản trị hệ thống": [
                "system administrator",
                "devops",
                "network",
                "database",
              ],

              // Project Management
              "quản lý dự án": [
                "project manager",
                "scrum master",
                "product manager",
              ],

              // Testing & QA
              "kiểm thử": ["tester", "qa", "automation"],
              "chất lượng": ["qa", "tester"],
            };

            // Kiểm tra mapping
            for (const [key, keywords] of Object.entries(mappings)) {
              if (fieldLower.includes(key)) {
                if (keywords.some((keyword) => memberSpec.includes(keyword))) {
                  return true;
                }
              }
            }

            // Riêng "Công nghệ thông tin" (không có "tổng hợp") - khớp rộng
            if (
              fieldLower === "công nghệ thông tin" &&
              !fieldLower.includes("tổng hợp")
            ) {
              const techKeywords = [
                "developer",
                "engineer",
                "designer",
                "manager",
                "analyst",
                "tester",
                "architect",
                "administrator",
                "master",
                "scientist",
                "writer",
              ];
              if (
                techKeywords.some((keyword) => memberSpec.includes(keyword))
              ) {
                return true;
              }
            }

            return false;
          });
        }

        return {
          ...member,
          projects: member.projects ?? [],
          isRelevant,
        };
      });

    console.log("🔍 Total members before filters:", list.length);
    console.log("📌 Project fields for matching:", projectFields);
    console.log("👥 Members with isRelevant flag:");
    list.forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.hoTen}`);
      console.log(`     - Chuyên môn: ${m.chuyenMon || "Chưa có"}`);
      console.log(`     - isRelevant: ${m.isRelevant}`);
      console.log(`     - Email: ${m.email}`);
    });
    console.log("⚙️ Current filters:", {
      showRelevantOnly,
      specialtyFilter,
      sortBy,
    });

    // Filter by search term if provided
    if (hasSearchTerm) {
      const term = trimmedSearchTerm.toLowerCase();
      list = list.filter((member) => {
        const combined =
          `${member.hoTen} ${member.email} ${member.chuyenMon ?? ""} ${(
            member.projects ?? []
          )
            .map((project) => `${project.tenDuAn} ${project.tenNhom ?? ""}`)
            .join(" ")}`.toLowerCase();
        return combined.includes(term);
      });
      console.log("🔎 After search filter:", list.length);
    }

    // Filter by relevant specialty if enabled
    if (showRelevantOnly && projectFields.length > 0) {
      list = list.filter((member) => member.isRelevant);
      console.log("⭐ After relevant filter:", list.length);
    }

    if (specialtyFilter === "none") {
      list = list.filter((member) => !member.chuyenMon);
    } else if (specialtyFilter !== "all") {
      list = list.filter(
        (member) =>
          member.chuyenMon?.toLowerCase() === specialtyFilter.toLowerCase()
      );
    }

    console.log("🎯 After specialty filter:", list.length);

    switch (sortBy) {
      case "name-desc":
        list.sort((a, b) =>
          b.hoTen.localeCompare(a.hoTen, "vi", { sensitivity: "base" })
        );
        break;
      case "specialty":
        list.sort((a, b) => {
          const specA = a.chuyenMon ? a.chuyenMon.toLowerCase() : "";
          const specB = b.chuyenMon ? b.chuyenMon.toLowerCase() : "";
          return specA.localeCompare(specB, "vi", { sensitivity: "base" });
        });
        break;
      case "relevant":
        // Sort relevant members first
        list.sort((a, b) => {
          if (a.isRelevant && !b.isRelevant) return -1;
          if (!a.isRelevant && b.isRelevant) return 1;
          return a.hoTen.localeCompare(b.hoTen, "vi", { sensitivity: "base" });
        });
        break;
      default:
        list.sort((a, b) =>
          a.hoTen.localeCompare(b.hoTen, "vi", { sensitivity: "base" })
        );
        break;
    }

    return list;
  }, [
    hasSearchTerm,
    memberOptions,
    sentInvites,
    sortBy,
    specialtyFilter,
    trimmedSearchTerm,
    projectFields,
    showRelevantOnly,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedMemberId || !formData.mailNguoiNhan.trim()) {
      toast.error("Vui lòng chọn một thành viên để thêm!");
      return;
    }

    setLoading(true);
    console.log("formData", formData);
    try {
      const response = await api.post(`/Nhom/gui-loi-moi`, {
        nhomId: formData.nhomId,
        mailNguoiNhan: formData.mailNguoiNhan,
        nguoiGuiId: formData.nguoiGuiId,
        noiDung: `Bạn được mời tham gia nhóm này bởi người dùng ${formData.nguoiGuiId}.`,
      });

      const successMessage =
        typeof response?.data?.message === "string" &&
        response.data.message.trim().length > 0
          ? response.data.message
          : "Đã gửi lời mời thành công!";
      toast.success(successMessage);
      await fetchSentInvites(formData.nguoiGuiId);
      setActiveTab("sent");
      setSelectedMemberId(null);
      setFormData((prev) => ({ ...prev, mailNguoiNhan: "" }));
      onSuccess();
    } catch (error: any) {
      // console.error("Add member error:", error);
      toast.error(
        error.response?.data?.message || "Có lỗi xảy ra khi gửi lời mời!"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Mời thành viên">
      <form
        onSubmit={handleSubmit}
        className={`${styles.form} ${styles.addMemberForm}`}
      >
        <div className={styles.tabBar}>
          <button
            type="button"
            className={`${styles.tabButton} ${
              activeTab === "members" ? styles.activeTabButton : ""
            }`}
            onClick={() => handleTabSwitch("members")}
          >
            Tìm kiếm thành viên
          </button>
          <button
            type="button"
            className={`${styles.tabButton} ${
              activeTab === "sent" ? styles.activeTabButton : ""
            }`}
            onClick={() => handleTabSwitch("sent")}
          >
            Lời mời đã gửi
          </button>
        </div>

        {activeTab === "members" && (
          <>
            <div className={styles.memberToolbar}>
              <div className={styles.memberSearch}>
                <label htmlFor="add-member-search">Tìm kiếm</label>
                <input
                  id="add-member-search"
                  type="text"
                  placeholder="Nhập tên hoặc email"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className={styles.memberControls}>
                <div className={styles.memberSelect}>
                  <label htmlFor="add-member-sort">Sắp xếp</label>
                  <select
                    id="add-member-sort"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="name-asc">Tên (A → Z)</option>
                    <option value="name-desc">Tên (Z → A)</option>
                    <option value="specialty">Chuyên môn</option>
                    <option value="relevant">⭐ Phù hợp với dự án</option>
                  </select>
                </div>
                <div className={styles.memberSelect}>
                  <label htmlFor="add-member-filter">Lọc chuyên môn</label>
                  <select
                    id="add-member-filter"
                    value={specialtyFilter}
                    onChange={(e) => setSpecialtyFilter(e.target.value)}
                  >
                    <option value="all">Tất cả</option>
                    <option value="none">Chưa cập nhật</option>
                    {availableSpecialties.map((spec) => (
                      <option key={spec} value={spec}>
                        {spec}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className={styles.relevantFilter}>
              <label>
                <input
                  type="checkbox"
                  checked={showRelevantOnly}
                  onChange={(e) => setShowRelevantOnly(e.target.checked)}
                  disabled={projectFields.length === 0}
                />
                <span>
                  ⭐ Chỉ hiển thị thành viên có chuyên môn phù hợp với dự án
                  {projectFields.length > 0 && (
                    <strong style={{ marginLeft: "0.5rem", color: "#daa520" }}>
                      ({projectFields.join(", ")})
                    </strong>
                  )}
                  {projectFields.length === 0 && (
                    <em
                      style={{
                        marginLeft: "0.5rem",
                        color: "#999",
                        fontSize: "0.85rem",
                      }}
                    >
                      (Nhóm chưa có dự án với lĩnh vực xác định)
                    </em>
                  )}
                </span>
              </label>
            </div>

            <div className={styles.memberPicker}>
              {membersLoading ? (
                <div className={styles.memberLoading}>
                  Đang tải danh sách...
                </div>
              ) : membersError ? (
                <div className={styles.memberError}>{membersError}</div>
              ) : memberOptions.length === 0 ? (
                <div className={styles.emptyMembers}>
                  Không có thành viên để thêm.
                </div>
              ) : displayMembers.length === 0 ? (
                <div className={styles.emptyMembers}>
                  Không tìm thấy thành viên phù hợp.
                </div>
              ) : (
                <ul className={styles.memberOptions}>
                  {displayMembers.map((member) => {
                    const projects = member.projects ?? [];
                    const isSelected = selectedMemberId === member.thanhVienId;
                    return (
                      <li
                        key={member.thanhVienId}
                        className={`${styles.memberOption} ${
                          isSelected ? styles.selectedOption : ""
                        }`}
                      >
                        <div className={styles.memberHeader}>
                          <button
                            type="button"
                            onClick={() => handleSelectMember(member)}
                            className={styles.memberButton}
                          >
                            <div className={styles.optionHeader}>
                              <span className={styles.memberName}>
                                {member.hoTen}
                                {member.isRelevant && (
                                  <span
                                    className={styles.relevantBadge}
                                    title="Chuyên môn phù hợp với dự án"
                                  >
                                    ⭐
                                  </span>
                                )}
                              </span>
                              <span className={styles.memberTag}>
                                Chuyên môn: {member.chuyenMon || "Không có"}
                              </span>
                            </div>
                            <span className={styles.optionEmail}>
                              {member.email}
                            </span>
                            {projects.length > 0 ? (
                              <div className={styles.memberProjects}>
                                {projects.map((project) => (
                                  <span
                                    key={`${project.tenNhom ?? "__"}-${project.tenDuAn}`}
                                    className={styles.projectPill}
                                  >
                                    {project.tenDuAn}
                                    {project.tenNhom
                                      ? ` · ${project.tenNhom}`
                                      : ""}
                                    {project.linhVuc
                                      ? ` · ${project.linhVuc}`
                                      : ""}
                                    {project.trangThai
                                      ? ` (${project.trangThai})`
                                      : ""}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div className={styles.memberProjectsEmpty}>
                                Chưa tham gia dự án
                              </div>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={(e) =>
                              openMemberDetail(member.thanhVienId, e)
                            }
                            className={styles.expandButton}
                            title="Xem chi tiết"
                          >
                            +
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}

        {activeTab === "sent" && (
          <div className={styles.inviteSection}>
            {invitesLoading ? (
              <div className={styles.memberLoading}>Đang tải lời mời...</div>
            ) : invitesError ? (
              <div className={styles.memberError}>{invitesError}</div>
            ) : sentInvites.length === 0 ? (
              <div className={styles.emptyMembers}>
                Chưa có lời mời nào được gửi.
              </div>
            ) : (
              <ul className={styles.inviteList}>
                {sentInvites.map((invite) => (
                  <li
                    key={`${invite.mailNguoiNhan}-${invite.thoiGianGui}`}
                    className={styles.inviteCard}
                  >
                    <div className={styles.inviteHeader}>
                      <span className={styles.inviteEmail}>
                        {invite.mailNguoiNhan}
                      </span>
                      <span
                        className={`${styles.inviteStatus} ${styles[(invite.trangThaiLoiMoi?.toLowerCase() as "waiting" | "accepted" | "rejected") || "waiting"]}`}
                      >
                        {invite.trangThaiLoiMoi}
                      </span>
                    </div>
                    <div className={styles.inviteBody}>
                      <h4>{invite.tieuDe}</h4>
                      {/* <p>{invite.noiDung}</p> */}
                    </div>
                    <div className={styles.inviteMeta}>
                      <span>
                        Gửi lúc:{" "}
                        {new Date(invite.thoiGianGui).toLocaleString("vi-VN")}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            onClick={onClose}
            className={styles.cancelButton}
            disabled={loading}
          >
            Hủy
          </button>
          {activeTab === "members" && (
            <button
              type="submit"
              className={styles.submitButton}
              disabled={loading}
            >
              {loading ? "Đang gửi..." : "Gửi lời mời"}
            </button>
          )}
        </div>
      </form>

      {/* Member Detail Modal */}
      {selectedMemberForDetail && (
        <MemberDetailModal
          isOpen={detailModalOpen}
          onClose={closeMemberDetail}
          memberId={selectedMemberForDetail}
        />
      )}
    </Modal>
  );
};

export default AddMemberModal;
