namespace ServerQuanLyNhom.DTOs.Auths
{
    public class ResetPasswordRequest
    {
        public string? Email { get; set; }
        public string? TenTaiKhoan { get; set; }
        public string? Otp { get; set; }
        public string? NewPassword { get; set; }
    }
}
