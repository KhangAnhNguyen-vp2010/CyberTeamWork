import { useState, useEffect } from "react";
import styles from "./CreateGroupModal.module.scss";
import Modal from "../../pages/shared/pop-up/Modal";
import { FaPlus, FaImage } from "react-icons/fa";
import api from "../../apis/api";
import { toast } from "react-toastify";
import { useAuth } from "../../pages/auth/hooks/useAuth";

interface GroupData {
  nhomId: number;
  tenNhom: string;
  moTa: string;
  anhBia: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  groupData: GroupData | null;
}

const EditGroupModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  groupData,
}) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    tenNhom: "",
    moTa: "",
    anhBia: null as File | null,
    nhomId: 0,
  });

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Pre-fill form only when modal opens (isOpen changes to true)
  useEffect(() => {
    if (isOpen && groupData) {
      setFormData({
        tenNhom: groupData.tenNhom,
        moTa: groupData.moTa,
        anhBia: null,
        nhomId: groupData.nhomId,
      });
      setPreviewImage(`https://localhost:7036${groupData.anhBia}`);
    }
  }, [isOpen]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData((prev) => ({ ...prev, anhBia: file }));
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

    setLoading(true);

    try {
      const data = new FormData();
      data.append("TenNhom", formData.tenNhom);
      data.append("MoTa", formData.moTa);
      if (formData.anhBia) {
        data.append("AnhBia", formData.anhBia);
      }
      data.append("NhomId", formData.nhomId.toString());

      const response = await api.put(`/Nhom/UpdateGroup`, data, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.status === 200) {
        toast.success("Cập nhật nhóm thành công!");
        onSuccess();
        onClose();
      } else {
        toast.error(response.data.message || "Cập nhật nhóm thất bại!");
      }
    } catch (error: any) {
      console.error("Update group error:", error);
      toast.error(
        error.response?.data?.message || "Có lỗi xảy ra khi cập nhật nhóm!"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chỉnh sửa nhóm">
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
            id="groupImageEdit"
            accept="image/*"
            onChange={handleImageChange}
            className={styles.fileInput}
          />
          <label htmlFor="groupImageEdit" className={styles.uploadButton}>
            <FaPlus /> Chọn ảnh bìa mới
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
            {loading ? "Đang cập nhật..." : "Cập nhật"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default EditGroupModal;
