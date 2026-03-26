import { useState, useEffect } from "react";
import styles from "./CreateGroupModal.module.scss";
import Modal from "../../pages/shared/pop-up/Modal";
import { FaPlus, FaImage } from "react-icons/fa";
import api from "../../apis/api";
import { toast } from "react-toastify";
import { useAuth } from "../../pages/auth/hooks/useAuth";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateGroupModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    tenNhom: "",
    moTa: "",
    anhBia: null as File | null,
    thanhVienID: user?.UserId || 0,
  });

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Update thanhVienID when user changes
  useEffect(() => {
    setFormData((prev) => ({ ...prev, thanhVienID: user?.UserId || 0 }));
  }, [user]);

  // Reset form khi modal đóng
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        tenNhom: "",
        moTa: "",
        anhBia: null,
        thanhVienID: user?.UserId || 0,
      });
      setPreviewImage(null);
    }
  }, [isOpen, user]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData((prev) => ({ ...prev, anhBia: file }));
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.tenNhom.trim()) {
      toast.error("Vui lòng nhập tên nhóm!");
      return;
    }

    if (formData.moTa.length > 100) {
      toast.error("Mô tả không được vượt quá 100 ký tự!");
      return;
    }

    // Check if user is loaded
    if (!user || formData.thanhVienID === 0) {
      toast.error("Vui lòng đăng nhập lại để tạo nhóm!");
      return;
    }

    setLoading(true);

    try {
      const formDataObj = new FormData();
      formDataObj.append("TenNhom", formData.tenNhom);
      formDataObj.append("MoTa", formData.moTa);
      if (formData.anhBia) {
        formDataObj.append("AnhBia", formData.anhBia);
      }
      formDataObj.append("ThanhVienID", formData.thanhVienID.toString());

      console.log("dsadsa", formData);
      console.log("FormDataObj contents:", formDataObj);
      const response = await api.post(
        "https://localhost:7036/api/Nhom/CreateGroup",
        formDataObj,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      console.log("API Response:", response.data);
      if (response.status === 200) {
        toast.success("Tạo nhóm thành công!");
        // Reset form
        setFormData({
          tenNhom: "",
          moTa: "",
          anhBia: null,
          thanhVienID: user?.UserId || 0,
        });
        setPreviewImage(null);
        onSuccess();
        onClose();
      } else {
        toast.error(response.data.message || "Tạo nhóm thất bại!");
      }
    } catch (error: any) {
      console.error("Create group error:", error);
      toast.error(
        error.response?.data?.message || "Có lỗi xảy ra khi tạo nhóm!"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Tạo nhóm mới">
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.imageUpload}>
          <div
            className={styles.preview}
            style={
              previewImage
                ? {
                    backgroundImage: `url(${previewImage})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : undefined
            }
          >
            {!previewImage && <FaImage />}
          </div>
          <input
            type="file"
            id="groupImage"
            accept="image/*"
            onChange={handleImageChange}
            className={styles.fileInput}
          />
          <label htmlFor="groupImage" className={styles.uploadButton}>
            <FaPlus /> Chọn ảnh bìa
          </label>
        </div>

        <div className={styles.inputGroup}>
          <input
            type="text"
            placeholder="Tên nhóm *"
            value={formData.tenNhom}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, tenNhom: e.target.value }))
            }
            required
          />
        </div>

        <div className={styles.inputGroup}>
          <textarea
            placeholder="Mô tả nhóm (tối đa 100 ký tự)"
            value={formData.moTa}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, moTa: e.target.value }))
            }
            rows={4}
            maxLength={100}
          />
          <span className={styles.charCount}>{formData.moTa.length}/100</span>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            onClick={onClose}
            className={styles.cancelButton}
            disabled={loading}
          >
            Hủy
          </button>
          <button
            type="submit"
            className={styles.submitButton}
            disabled={loading}
          >
            {loading ? "Đang tạo..." : "Tạo nhóm"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateGroupModal;
