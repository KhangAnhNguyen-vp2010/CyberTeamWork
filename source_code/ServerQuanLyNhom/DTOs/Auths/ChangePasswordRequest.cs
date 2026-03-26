namespace ServerQuanLyNhom.DTOs.Auths
{
    public class ChangePasswordRequest
    {
        public string? Email { get; set; }
        public string? CurrentPassword { get; set; }
        public string? NewPassword { get; set; }
    }
}
