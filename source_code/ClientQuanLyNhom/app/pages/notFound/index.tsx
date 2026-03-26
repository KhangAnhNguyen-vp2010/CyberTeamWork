import { Link } from "react-router";
import styles from "./NotFound.module.scss";
import notFoundImage from "./notFound.png";

export default function NotFoundPage() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.media}>
          <img src={notFoundImage} alt="Trang không tồn tại" />
        </div>
        <div className={styles.content}>
          <span className={styles.badge}>404</span>
          <h1>Rất tiếc, trang bạn tìm không tồn tại</h1>
          <p>
            Có thể đường dẫn đã bị thay đổi hoặc bạn đã nhập sai địa chỉ. Hãy quay lại trang chủ hoặc
            tiếp tục khám phá CyberTeamWork.
          </p>
          <div className={styles.actions}>
            <Link to="/" className={styles.primaryBtn}>
              Về trang chủ
            </Link>
            <Link to="/app" className={styles.secondaryBtn}>
              Đi tới ứng dụng
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
