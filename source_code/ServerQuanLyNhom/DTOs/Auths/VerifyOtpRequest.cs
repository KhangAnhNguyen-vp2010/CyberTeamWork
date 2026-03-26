namespace ServerQuanLyNhom.DTOs.Auths
{
    public class VerifyOtpRequest
    {
        
        public string Email { get; set; } = string.Empty;
        public string Otp { get; set; } = string.Empty;
        public string? Purpose { get; set; }
    }
}
