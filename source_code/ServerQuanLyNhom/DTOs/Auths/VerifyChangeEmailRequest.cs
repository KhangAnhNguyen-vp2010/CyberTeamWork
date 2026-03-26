namespace ServerQuanLyNhom.DTOs.Auths
{
    public class VerifyChangeEmailRequest
    {
        public int TaiKhoanId { get; set; }
        public string NewEmail { get; set; } = string.Empty;
        public string Otp { get; set; } = string.Empty;
    }
}
