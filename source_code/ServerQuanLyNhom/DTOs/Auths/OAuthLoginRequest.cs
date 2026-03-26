namespace ServerQuanLyNhom.DTOs.Auths;

public class OAuthLoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Provider { get; set; } = string.Empty; // "google" hoặc "facebook"
    public string ProviderKey { get; set; } = string.Empty; // ID từ provider
    public string AccessToken { get; set; } = string.Empty;
}
