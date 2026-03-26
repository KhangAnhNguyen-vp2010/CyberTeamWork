import React, { useEffect, useState } from "react";
import styles from "./CreateTaskModal.module.scss";
import api from "../../apis/api";
import {
  getSuggestedMembers,
  type MemberInfo,
  type MemberSuggestion,
} from "../../services/aiService";

interface AddSubTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  congViecId: number;
  members: any[];
  ngayBd: string;
  ngayKt: string;
  onSuccess: () => void;
  mailNguoiGui?: string;
  trangThai?: string;
  tenCongViec?: string;
  linhVucDuAn?: string;
}

const AddSubTaskModal: React.FC<AddSubTaskModalProps> = ({
  isOpen,
  onClose,
  congViecId,
  members,
  ngayBd,
  ngayKt,
  onSuccess,
  mailNguoiGui,
  trangThai,
  tenCongViec,
  linhVucDuAn,
}) => {
  const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatDateForDisplay = (value: string) => {
    if (!value) return "";
    try {
      return new Date(`${value}T00:00:00`).toLocaleDateString("vi-VN");
    } catch (error) {
      return value;
    }
  };

  const [formData, setFormData] = useState({
    moTa: "",
    ngayPC: "",
    doUuTien: "cao",
  });
  const [selectedMember, setSelectedMember] = useState<number | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [aiSuggestions, setAiSuggestions] = useState<MemberSuggestion[]>([]);
  const [loadingAI, setLoadingAI] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      // Reset form when modal closes
      setFormData({
        moTa: "",
        ngayPC: "",
        doUuTien: "cao",
      });
      setSelectedMember(null);
      setErrors({});
      setAiSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Always use today's date for assignment date
    const today = new Date();

    setFormData((prev) => ({
      ...prev,
      ngayPC: formatDateForInput(today),
    }));
    setErrors({});
    setAiSuggestions([]);
    setShowSuggestions(false);
  }, [isOpen, ngayBd, ngayKt]);

  const handleGetAISuggestions = async () => {
    if (!formData.moTa.trim()) {
      setErrors({
        moTa: "Vui lòng nhập mô tả công việc trước khi lấy gợi ý AI",
      });
      return;
    }

    setLoadingAI(true);
    try {
      const memberInfos: MemberInfo[] = members.map((m) => ({
        thanhVienId: m.thanhVienId,
        hoTen: m.hoTen,
        chuyenMon: m.chuyenMon?.tenChuyenMon || "Chưa xác định",
        email: m.email || "",
        soLuongCongViecHienTai: m.soLuongCongViec || 0,
        tienDoTrungBinh: m.tienDoTrungBinh || 0,
        danhGiaGanDay: m.danhGia || "Chưa có",
      }));

      const result = await getSuggestedMembers(memberInfos, {
        tenCongViec: tenCongViec || "Công việc con",
        moTa: formData.moTa,
        doUuTien: formData.doUuTien,
        ngayBd,
        ngayKt,
        linhVucDuAn,
      });

      if (result.error) {
        alert(result.error);
      } else {
        setAiSuggestions(result.suggestions);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error("Error getting AI suggestions:", error);
      alert("Có lỗi khi lấy gợi ý từ AI");
    } finally {
      setLoadingAI(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
    if (errors[name]) {
      setErrors({ ...errors, [name]: "" });
    }
  };

  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.moTa.trim()) newErrors.moTa = "Mô tả là bắt buộc";
    if (!selectedMember)
      newErrors.selectedMember = "Chọn thành viên là bắt buộc";
    // Remove date validation since we're using current date
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !selectedMember) return;

    try {
      await api.post(
        `/PhanCong/AddPhanCongItem/${congViecId}/${selectedMember}`,
        {
          moTa: formData.moTa,
          ngayPC: formData.ngayPC,
          doUuTien: formData.doUuTien,
          ketQuaThucHien: [],
          danhGia: "Chưa có",
          tienDoHoanThanh: "0%",
          trangThaiKhoa: 1, // Set default lock status to locked (1)
        }
      );

      if (mailNguoiGui) {
        try {
          await api.post("/ThongBao/ThongBaoCongViecMoi_ChoThanhVien", {
            congViecID: congViecId,
            thanhVienID: selectedMember,
            mailNguoiGui,
          });
        } catch (notifyErr) {
          console.error("Error notifying new subtask assignee:", notifyErr);
        }
      }

      // Cập nhật tiến độ công việc cha
      try {
        await api.put(`/CongViec/CapNhatTienDoCongViec/${congViecId}`);
      } catch (updateErr) {
        console.error("Error updating parent task progress:", updateErr);
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error adding sub task:", error);
    }
  };

  if (!isOpen) return null;

  const assignmentDateDisplay = formatDateForDisplay(formData.ngayPC);
  const isCompleted = trangThai?.toLowerCase() === "hoàn thành";

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <button className={styles.closeBtn} onClick={onClose}>
          ✖
        </button>
        <h2>Thêm Công Việc Con</h2>
        {isCompleted ? (
          <div
            style={{ padding: "20px", textAlign: "center", color: "#dc2626" }}
          >
            <p>Không thể thêm công việc con vào công việc đã hoàn thành.</p>
            <button
              type="button"
              onClick={onClose}
              style={{
                marginTop: "15px",
                padding: "8px 20px",
                background: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              Đóng
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label>Mô Tả Công Việc Con</label>
              <textarea
                name="moTa"
                value={formData.moTa}
                onChange={handleChange}
                className={errors.moTa ? styles.error : ""}
                style={{ width: "100%", resize: "vertical", minHeight: "80px" }}
                placeholder="Mô tả chi tiết công việc cần làm..."
              />
              {errors.moTa && (
                <span className={styles.errorText}>{errors.moTa}</span>
              )}
              <button
                type="button"
                onClick={handleGetAISuggestions}
                disabled={loadingAI || !formData.moTa.trim()}
                style={{
                  marginTop: "10px",
                  padding: "8px 16px",
                  background: loadingAI
                    ? "#94a3b8"
                    : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor:
                    loadingAI || !formData.moTa.trim()
                      ? "not-allowed"
                      : "pointer",
                  fontSize: "0.9rem",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 4px 12px rgba(102, 126, 234, 0.4)",
                }}
              >
                {loadingAI ? (
                  <>
                    <span
                      style={{
                        animation: "spin 1s linear infinite",
                        display: "inline-block",
                      }}
                    >
                      ⚙️
                    </span>
                    Đang phân tích...
                  </>
                ) : (
                  <>✨ Gợi ý AI thành viên phù hợp</>
                )}
              </button>
            </div>

            {showSuggestions && aiSuggestions.length > 0 && (
              <div
                style={{
                  background:
                    "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)",
                  border: "2px solid #a78bfa",
                  borderRadius: "12px",
                  padding: "16px",
                  marginBottom: "20px",
                }}
              >
                <h4
                  style={{
                    margin: "0 0 12px 0",
                    color: "#6b21a8",
                    fontSize: "0.95rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  🤖 AI Gợi ý ({aiSuggestions.length} thành viên phù hợp)
                </h4>
                {aiSuggestions.map((suggestion, index) => {
                  const member = members.find(
                    (m) => m.thanhVienId === suggestion.thanhVienId
                  );
                  if (!member) return null;

                  return (
                    <div
                      key={suggestion.thanhVienId}
                      onClick={() => setSelectedMember(suggestion.thanhVienId)}
                      style={{
                        background:
                          selectedMember === suggestion.thanhVienId
                            ? "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)"
                            : "white",
                        color:
                          selectedMember === suggestion.thanhVienId
                            ? "white"
                            : "#1f2937",
                        padding: "12px",
                        borderRadius: "8px",
                        marginBottom:
                          index < aiSuggestions.length - 1 ? "8px" : "0",
                        cursor: "pointer",
                        border:
                          selectedMember === suggestion.thanhVienId
                            ? "2px solid #7c3aed"
                            : "2px solid #e5e7eb",
                        transition: "all 0.2s ease",
                        boxShadow:
                          selectedMember === suggestion.thanhVienId
                            ? "0 4px 12px rgba(139, 92, 246, 0.3)"
                            : "0 2px 4px rgba(0,0,0,0.05)",
                      }}
                      onMouseEnter={(e) => {
                        if (selectedMember !== suggestion.thanhVienId) {
                          e.currentTarget.style.borderColor = "#c4b5fd";
                          e.currentTarget.style.transform = "translateY(-2px)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedMember !== suggestion.thanhVienId) {
                          e.currentTarget.style.borderColor = "#e5e7eb";
                          e.currentTarget.style.transform = "translateY(0)";
                        }
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: "6px",
                        }}
                      >
                        <strong style={{ fontSize: "0.95rem" }}>
                          #{index + 1} {member.hoTen}
                        </strong>
                        <span
                          style={{
                            background:
                              selectedMember === suggestion.thanhVienId
                                ? "rgba(255,255,255,0.2)"
                                : "#fef3c7",
                            color:
                              selectedMember === suggestion.thanhVienId
                                ? "white"
                                : "#92400e",
                            padding: "4px 10px",
                            borderRadius: "12px",
                            fontSize: "0.8rem",
                            fontWeight: "700",
                          }}
                        >
                          {suggestion.score}/100
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: "0.85rem",
                          opacity:
                            selectedMember === suggestion.thanhVienId
                              ? 0.95
                              : 0.7,
                          marginBottom: "4px",
                        }}
                      >
                        {member.chuyenMon?.tenChuyenMon || "Chưa xác định"}
                      </div>
                      <div
                        style={{
                          fontSize: "0.85rem",
                          fontStyle: "italic",
                          opacity:
                            selectedMember === suggestion.thanhVienId
                              ? 0.9
                              : 0.6,
                        }}
                      >
                        💡 {suggestion.reason}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className={styles.field}>
              <label>Hoặc chọn thủ công</label>
              <select
                value={selectedMember || ""}
                onChange={(e) => setSelectedMember(Number(e.target.value))}
                className={errors.selectedMember ? styles.error : ""}
                style={{ width: "100%" }}
              >
                <option value="">Chọn thành viên</option>
                {members.map((member) => (
                  <option key={member.thanhVienId} value={member.thanhVienId}>
                    {member.hoTen} - {member.chuyenMon.tenChuyenMon}
                  </option>
                ))}
              </select>
              {errors.selectedMember && (
                <span className={styles.errorText}>
                  {errors.selectedMember}
                </span>
              )}
            </div>
            <div className={styles.field}>
              <label>Độ Ưu Tiên</label>
              <select
                name="doUuTien"
                value={formData.doUuTien}
                onChange={handleChange}
                style={{ width: "100%" }}
              >
                <option value="cao">Cao</option>
                <option value="trungbinh">Trung bình</option>
                <option value="thap">Thấp</option>
              </select>
            </div>

            <div className={styles.field}>
              <label>Ngày Phân Công</label>
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  color: "#1f2937",
                  fontSize: "0.9rem",
                }}
              >
                {assignmentDateDisplay || "—"}
              </div>
              <small style={{ color: "#64748b" }}>
                Ngày phân công tự động lấy theo ngày hiện tại.
              </small>
            </div>

            <div className={styles.actions}>
              <button type="button" onClick={onClose}>
                Hủy
              </button>
              <button type="submit">Thêm</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AddSubTaskModal;
