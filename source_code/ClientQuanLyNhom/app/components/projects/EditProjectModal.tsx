import React, { useState, useEffect } from "react";
import Modal from "../../pages/shared/pop-up/Modal";
import api from "../../apis/api";
import { toast } from "react-toastify";
import styles from "./EditProjectModal.module.scss";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  project: any;
}

const EditProjectModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  project,
}) => {
  const [tenDuAn, setTenDuAn] = useState("");
  const [moTa, setMoTa] = useState("");
  const [ngayBd, setNgayBd] = useState("");
  const [ngayKt, setNgayKt] = useState("");
  const [trangThai, setTrangThai] = useState("Đang thực hiện");
  const [linhVucId, setLinhVucId] = useState(1);
  const [linhVucList, setLinhVucList] = useState<any[]>([]);
  const [linhVucInput, setLinhVucInput] = useState<string | null>(null);
  const [showLinhVucDropdown, setShowLinhVucDropdown] = useState(false);
  const [anhBia, setAnhBia] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [durationMonths, setDurationMonths] = useState<number | "">(""); // Số tháng

  // Lấy ngày hiện tại theo định dạng YYYY-MM-DD
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  // Tự động tính và điền cả ngày bắt đầu và kết thúc khi chọn theo tháng
  const handleMonthSelection = (months: number) => {
    setDurationMonths(months);

    // Ngày bắt đầu = hôm nay
    const today = new Date();
    const startDate = today.toISOString().split("T")[0];
    setNgayBd(startDate);

    // Ngày kết thúc = hôm nay + số tháng
    const endDate = new Date(today);
    endDate.setMonth(endDate.getMonth() + months);
    setNgayKt(endDate.toISOString().split("T")[0]);
  };

  useEffect(() => {
    if (isOpen && project) {
      setTenDuAn(project.tenDuAn || "");
      setMoTa(project.moTa || "");
      setNgayBd(project.ngayBd || "");
      setNgayKt(project.ngayKt || "");
      setTrangThai(project.trangThai || "Đang thực hiện");
      setLinhVucId(project.linhVucId || 1);
      setAnhBia(null);
      setDurationMonths("");
      setImagePreview(
        project.anhBia ? `https://localhost:7036${project.anhBia}` : null
      );

      // Set giá trị tạm thời nếu có tenLinhVuc từ project
      if (project.tenLinhVuc) {
        setLinhVucInput(project.tenLinhVuc);
      }

      // Fetch linh-vuc và set giá trị hiện tại
      api
        .get("/DuAn/linh-vuc")
        .then((response) => {
          const data = Array.isArray(response.data?.data)
            ? response.data.data
            : [];
          setLinhVucList(data);

          // Set lĩnh vực hiện tại của project
          if (project.linhVucId) {
            const found = data.find(
              (lv: any) => lv.linhVucId === project.linhVucId
            );
            if (found) {
              setLinhVucInput(found.tenLinhVuc);
            } else if (!project.tenLinhVuc) {
              setLinhVucInput("");
            }
          } else {
            setLinhVucInput("");
          }
        })
        .catch((error) => {
          console.error("Error fetching linh-vuc:", error);
          setLinhVucList([]);
          if (!project.tenLinhVuc) {
            setLinhVucInput("");
          }
        });
    } else if (!isOpen) {
      // Reset form khi modal đóng
      setTenDuAn("");
      setMoTa("");
      setNgayBd("");
      setNgayKt("");
      setTrangThai("Đang thực hiện");
      setLinhVucId(1);
      setLinhVucInput(null);
      setAnhBia(null);
      setImagePreview(null);
      setDurationMonths("");
      setShowLinhVucDropdown(false);
    }
  }, [isOpen, project]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAnhBia(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenDuAn.trim() || !moTa.trim() || !ngayBd || !ngayKt) {
      toast.error("Vui lòng điền đầy đủ thông tin!");
      return;
    }

    // Validation: Ngày bắt đầu phải nhỏ hơn ngày kết thúc
    if (new Date(ngayBd) >= new Date(ngayKt)) {
      toast.error("Ngày bắt đầu phải nhỏ hơn ngày kết thúc!");
      return;
    }

    // Validation: Nếu chuyển sang Hoàn thành, kiểm tra tất cả công việc phải 100%
    if (trangThai === "Hoàn thành" && project.trangThai !== "Hoàn thành") {
      try {
        const response = await api.get(
          `/CongViec/GetCongViecsOfDuAn/${project.duAnId}`
        );
        const congViecs =
          response.data.CongViecs || response.data.congViecs || [];

        // Kiểm tra phải có ít nhất 1 công việc
        if (congViecs.length === 0) {
          toast.error(
            "Không thể hoàn thành dự án! Dự án chưa có công việc nào."
          );
          return;
        }

        const hasPendingTasks = congViecs.some(
          (cv: any) => (cv.phamTramHoanThanh || cv.PhamTramHoanThanh || 0) < 100
        );

        if (hasPendingTasks) {
          toast.error(
            "Không thể hoàn thành dự án! Tất cả công việc phải đạt 100% tiến độ."
          );
          return;
        }
      } catch (error: any) {
        console.error("Error checking tasks:", error);
        toast.error("Đã có lỗi khi kiểm tra công việc!");
        return;
      }
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("duAnId", project.duAnId.toString());
    formData.append("tenDuAn", tenDuAn);
    formData.append("moTa", moTa);
    formData.append("ngayBD", ngayBd);
    formData.append("ngayKT", ngayKt);
    formData.append("trangThai", trangThai);
    formData.append("linhVucID", linhVucId.toString());
    if (anhBia) {
      formData.append("anhBia", anhBia);
    }

    try {
      const response = await api.put("/DuAn/UpdateDuAn", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      if (response.status === 200) {
        toast.success("Cập nhật dự án thành công!");
        onSuccess();
        onClose();
      } else {
        toast.error(response.data.message || "Có lỗi xảy ra!");
      }
    } catch (error: any) {
      console.error("Update project error:", error);
      toast.error(
        error.response?.data?.message || "Có lỗi khi cập nhật dự án!"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className={styles.container}>
        <h2 className={styles.title}>Sửa Dự Án</h2>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="tenDuAn" className={styles.label}>
              Tên Dự Án:
            </label>
            <input
              type="text"
              id="tenDuAn"
              value={tenDuAn}
              onChange={(e) => setTenDuAn(e.target.value)}
              className={styles.input}
              required
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="moTa" className={styles.label}>
              Mô Tả:
            </label>
            <textarea
              id="moTa"
              value={moTa}
              onChange={(e) => setMoTa(e.target.value)}
              className={styles.textarea}
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="durationMonths" className={styles.label}>
              ⚡ Chọn nhanh theo tháng (tự động điền ngày):
            </label>
            <select
              id="durationMonths"
              value={durationMonths}
              onChange={(e) => {
                const months = e.target.value;
                if (months) {
                  handleMonthSelection(Number(months));
                } else {
                  setDurationMonths("");
                }
              }}
              className={styles.input}
            >
              <option value="">-- Hoặc chọn nhanh theo tháng --</option>
              <option value="1">1 tháng</option>
              <option value="2">2 tháng</option>
              <option value="3">3 tháng</option>
              <option value="4">4 tháng</option>
              <option value="5">5 tháng</option>
              <option value="6">6 tháng</option>
              <option value="9">9 tháng</option>
              <option value="12">12 tháng (1 năm)</option>
              <option value="18">18 tháng</option>
              <option value="24">24 tháng (2 năm)</option>
            </select>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor="ngayBd" className={styles.label}>
                Ngày Bắt Đầu:
              </label>
              <input
                type="date"
                id="ngayBd"
                value={ngayBd}
                onChange={(e) => setNgayBd(e.target.value)}
                className={styles.input}
                disabled={
                  project?.ngayBd &&
                  new Date(project.ngayBd) < new Date(getTodayDate())
                }
                required
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="ngayKt" className={styles.label}>
                Ngày Kết Thúc:
              </label>
              <input
                type="date"
                id="ngayKt"
                value={ngayKt}
                onChange={(e) => setNgayKt(e.target.value)}
                min={ngayBd || getTodayDate()}
                className={styles.input}
                required
              />
            </div>
          </div>
          <div className={styles.field}>
            <label htmlFor="trangThai" className={styles.label}>
              Trạng Thái:
            </label>
            <select
              id="trangThai"
              value={trangThai}
              onChange={(e) => setTrangThai(e.target.value)}
              className={styles.select}
            >
              <option value="Đang thực hiện">Đang thực hiện</option>
              <option value="Hoàn thành">Hoàn thành</option>
              <option value="Tạm dừng">Tạm dừng</option>
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="linhVucId" className={styles.label}>
              Lĩnh Vực:
            </label>
            <div style={{ position: "relative", width: "100%" }}>
              <input
                type="text"
                id="linhVucId"
                value={
                  linhVucInput !== null && linhVucInput !== undefined
                    ? linhVucInput
                    : linhVucList.find((lv) => lv.linhVucId === linhVucId)
                        ?.tenLinhVuc || ""
                }
                onChange={(e) => {
                  const value = e.target.value;
                  setLinhVucInput(value);
                  setShowLinhVucDropdown(true);
                  const found = linhVucList.find(
                    (lv) => lv.tenLinhVuc.toLowerCase() === value.toLowerCase()
                  );
                  if (found) {
                    setLinhVucId(found.linhVucId);
                  } else if (value === "") {
                    // Reset khi xóa hết
                    setLinhVucId(
                      linhVucList.length > 0 ? linhVucList[0].linhVucId : 1
                    );
                  }
                }}
                onFocus={() => setShowLinhVucDropdown(true)}
                onBlur={() =>
                  setTimeout(() => setShowLinhVucDropdown(false), 200)
                }
                className={styles.select}
                placeholder="Nhập hoặc chọn lĩnh vực"
                required
                list="linhVucOptionsEdit"
                style={{ width: "100%", minWidth: "300px" }}
              />
              <datalist id="linhVucOptionsEdit">
                {linhVucList.map((lv) => (
                  <option key={lv.linhVucId} value={lv.tenLinhVuc}>
                    {lv.tenLinhVuc}
                  </option>
                ))}
              </datalist>
              {showLinhVucDropdown && linhVucList.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    background: "white",
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                    maxHeight: "200px",
                    overflowY: "auto",
                    zIndex: 1000,
                    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                  }}
                >
                  {linhVucList
                    .filter(
                      (lv) =>
                        !linhVucInput ||
                        lv.tenLinhVuc
                          .toLowerCase()
                          .includes(linhVucInput.toLowerCase())
                    )
                    .map((lv) => (
                      <div
                        key={lv.linhVucId}
                        onClick={() => {
                          setLinhVucId(lv.linhVucId);
                          setLinhVucInput(lv.tenLinhVuc);
                          setShowLinhVucDropdown(false);
                        }}
                        style={{
                          padding: "10px 12px",
                          cursor: "pointer",
                          borderBottom: "1px solid #f0f0f0",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = "#f5f5f5")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "white")
                        }
                      >
                        {lv.tenLinhVuc}
                      </div>
                    ))}
                </div>
              )}
            </div>
            <input type="hidden" value={linhVucId} required />
          </div>
          <div className={styles.field}>
            <label htmlFor="anhBia" className={styles.label}>
              Ảnh Bìa (Tùy chọn):
            </label>
            <input
              type="file"
              id="anhBia"
              accept="image/*"
              onChange={handleFileChange}
              className={styles.input}
            />
            {imagePreview && (
              <div className={styles.imagePreview}>
                <img
                  src={imagePreview}
                  alt="Preview"
                  className={styles.previewImage}
                />
              </div>
            )}
          </div>
          <div className={styles.actions}>
            <button
              type="submit"
              disabled={loading}
              className={styles.submitBtn}
            >
              {loading ? "Đang cập nhật..." : "Cập Nhật"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className={styles.cancelBtn}
            >
              Hủy
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default EditProjectModal;
