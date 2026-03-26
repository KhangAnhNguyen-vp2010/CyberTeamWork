namespace ServerQuanLyNhom.DTOs.Auths
{
    public class ResetPasswordRequestSubmit
    {
        public string TenTaiKhoan { get; set; } = string.Empty;
        public string HoTen { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string? SoDienThoai { get; set; }
        public string LyDo { get; set; } = string.Empty;
    }

    public class PasswordResetRequestCacheItem
    {
        public string NotificationId { get; set; } = string.Empty;
        public string TenTaiKhoan { get; set; } = string.Empty;
        public string HoTen { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string? SoDienThoai { get; set; }
        public string LyDo { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }
}
