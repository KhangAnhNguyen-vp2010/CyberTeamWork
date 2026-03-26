import { useState, useEffect } from "react";
import styles from "./InvitationsModal.module.scss";
import Modal from "../../pages/shared/pop-up/Modal";
import api from "../../apis/api";
import { toast } from "react-toastify";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onRefreshGroups?: () => void;
  onUpdateCount?: (count: number) => void;
}

interface LoiMoi {
  nguoiGuiId: number;
  mailNguoiNhan: string;
  nhomId: number;
  trangThaiLoiMoi: string;
  tieuDe: string;
  noiDung: string;
  thoiGianGui: string;
}

const InvitationsModal: React.FC<Props> = ({ isOpen, onClose, onRefreshGroups, onUpdateCount }) => {
  const [loiMoi, setLoiMoi] = useState<LoiMoi[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const email = user.Mail;
      setLoading(true);
      api.get(`/Nhom/loi-moi/${email}`)
        .then(response => {
          const data = Array.isArray(response.data) ? response.data : [];
          setLoiMoi(data);
        })
        .catch(error => {
          console.error("Error fetching invitations:", error);
          setLoiMoi([]);
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  const handleResponse = async (nhomId: number, chapNhan: boolean) => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const mailNguoiNhan = user.Mail;

    try {
      const response = await api.post(`/Nhom/phan-hoi-loi-moi`, {
        mailNguoiNhan,
        nhomId,
        chapNhan,
      });

      if (response.status === 200) {
        toast.success(chapNhan ? "Chấp nhận lời mời thành công!" : "Từ chối lời mời thành công!");
        onRefreshGroups?.();
        // Refresh the list and count
        api.get(`/Nhom/loi-moi/${mailNguoiNhan}`)
          .then(response => {
            const data = Array.isArray(response.data) ? response.data : [];
            setLoiMoi(data);
            const pendingCount = data.filter((invite: LoiMoi) => invite.trangThaiLoiMoi === "Chờ phản hồi").length;
            onUpdateCount?.(pendingCount);
          })
          .catch(error => {
            console.error("Error fetching invitations:", error);
            setLoiMoi([]);
            onUpdateCount?.(0);
          });
      } else {
        toast.error(response.data.message || "Có lỗi xảy ra!");
      }
    } catch (error: any) {
      console.error("Response error:", error);
      toast.error(
        error.response?.data?.message || "Có lỗi xảy ra khi phản hồi lời mời!"
      );
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Lời mời tham gia">
      <div className={styles.invitationsList}>
        {loading ? (
          <p className={styles.loading}>Đang tải lời mời...</p>
        ) : loiMoi.length > 0 ? (
          <ul className={styles.invitationsUl}>
            {loiMoi.map((invite, index) => (
              <li key={index} className={styles.inviteItem}>
                <div className={styles.inviteHeader}>
                  <h3>{invite.tieuDe}</h3>
                  <span className={styles.status}>{invite.trangThaiLoiMoi}</span>
                </div>
                <div className={styles.inviteDetails}>
                  <p>{invite.noiDung}</p>
                  <p><strong>Nhóm ID:</strong> {invite.nhomId}</p>
                  <p><strong>Thời gian gửi:</strong> {new Date(invite.thoiGianGui).toLocaleDateString('vi-VN')}</p>
                </div>
                <div className={styles.inviteActions}>
                  {invite.trangThaiLoiMoi === "Chờ phản hồi" ? (
                    <>
                      <button
                        className={styles.acceptBtn}
                        onClick={() => handleResponse(invite.nhomId, true)}
                      >
                        Chấp nhận
                      </button>
                      <button
                        className={styles.rejectBtn}
                        onClick={() => handleResponse(invite.nhomId, false)}
                      >
                        Từ chối
                      </button>
                    </>
                  ) : (
                    <span className={styles.disabledText}>{invite.trangThaiLoiMoi}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.noInvites}>Không có lời mời nào.</p>
        )}
      </div>
    </Modal>
  );
};

export default InvitationsModal;
