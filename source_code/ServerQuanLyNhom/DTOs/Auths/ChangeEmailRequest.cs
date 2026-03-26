namespace ServerQuanLyNhom.DTOs.Auths
{
    public class ChangeEmailRequest
    {
        public int TaiKhoanId { get; set; }
        public string NewEmail { get; set; } = string.Empty;
    }
}
