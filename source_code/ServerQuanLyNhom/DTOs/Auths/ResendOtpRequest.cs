namespace ServerQuanLyNhom.DTOs.Auths
{
    public class ResendOtpRequest
    {
        public string Email { get; set; } = string.Empty;
        public string? Purpose { get; set; }
    }
}
