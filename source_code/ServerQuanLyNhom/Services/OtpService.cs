using Microsoft.Extensions.Caching.Memory;

namespace ServerQuanLyNhom.Services
{
    public class OtpService
    {
        private readonly IMemoryCache _cache;
        private readonly TimeSpan _otpExpiry = TimeSpan.FromMinutes(10);
        private readonly TimeSpan _resendWindow = TimeSpan.FromMinutes(10);
        private const int MaxResendAttempts = 3;

        public OtpService(IMemoryCache cache)
        {
            _cache = cache;
        }

        public string GenerateOtp(string email, string purpose = "register")
        {
            var otp = new Random().Next(100000, 999999).ToString();

            // Lưu OTP với key khác nhau cho từng mục đích
            var cacheKey = $"otp_{purpose}_{email}";
            _cache.Set(cacheKey, otp, _otpExpiry);

            // Reset lại số lần resend khi sinh OTP mới
            _cache.Set($"otp_attempts_{purpose}_{email}", 0, _resendWindow);

            // Log để debug
            Console.WriteLine($"Generated OTP for {email} ({purpose}): {otp}");

            return otp;
        }

        public bool VerifyOtp(string email, string otp, string purpose = "register")
        {
            var cacheKey = $"otp_{purpose}_{email}";
            Console.WriteLine($"Verifying OTP for {email} ({purpose}): '{otp}' (length: {otp?.Length})");
            
            if (_cache.TryGetValue(cacheKey, out string? storedOtp))
            {
                Console.WriteLine($"Stored OTP for {email} ({purpose}): '{storedOtp}' (length: {storedOtp?.Length})");
                
                // Trim whitespace và so sánh
                var trimmedOtp = otp?.Trim();
                var trimmedStoredOtp = storedOtp?.Trim();
                
                if (trimmedStoredOtp == trimmedOtp)
                {
                    _cache.Remove(cacheKey);
                    _cache.Remove($"otp_attempts_{purpose}_{email}");
                    Console.WriteLine($"OTP verified successfully for {email} ({purpose})");
                    return true;
                }
                else
                {
                    Console.WriteLine($"OTP mismatch for {email} ({purpose}): expected '{trimmedStoredOtp}', got '{trimmedOtp}'");
                    Console.WriteLine($"Character comparison:");
                    for (int i = 0; i < Math.Max(trimmedStoredOtp?.Length ?? 0, trimmedOtp?.Length ?? 0); i++)
                    {
                        var expectedChar = i < (trimmedStoredOtp?.Length ?? 0) ? trimmedStoredOtp[i] : '?';
                        var actualChar = i < (trimmedOtp?.Length ?? 0) ? trimmedOtp[i] : '?';
                        Console.WriteLine($"  Position {i}: expected '{expectedChar}' ({(int)expectedChar}), got '{actualChar}' ({(int)actualChar})");
                    }
                }
            }
            else
            {
                Console.WriteLine($"No OTP found in cache for {email} ({purpose})");
            }
            return false;
        }

        public bool CanResend(string email, string purpose = "register")
        {
            var attempts = _cache.Get<int?>($"otp_attempts_{purpose}_{email}") ?? 0;

            if (attempts >= MaxResendAttempts)
                return false;

            _cache.Set($"otp_attempts_{purpose}_{email}", attempts + 1, _resendWindow);
            return true;
        }
    }
}
