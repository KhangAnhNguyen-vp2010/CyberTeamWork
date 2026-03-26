using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;
using ServerQuanLyNhom.DTOs.Auths;
using ServerQuanLyNhom.DTOs.PhanCongs;
using ServerQuanLyNhom.Models;
using ServerQuanLyNhom.Services;
using ServerQuanLyNhom.Services.Email;
using System.IO;
using System.Security.Cryptography;
using System.Linq;
using System.Text;
using System.Text.Json;

namespace ServerQuanLyNhom.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AdminController : ControllerBase
    {
        private readonly QuanLyCongViecNhomContext _context;
        private readonly IConfiguration _configuration;
        private readonly ILogger<AdminController> _logger;
        private readonly IDistributedCache _cache;
        private readonly EmailService _emailService;
        private readonly OtpService _otpService;
        private readonly TimeSpan _recoveryNotificationTtl = TimeSpan.FromDays(7);
        private readonly byte[]? _backupEncryptionKey;

        public AdminController(QuanLyCongViecNhomContext context, ILogger<AdminController> logger, IDistributedCache cache, EmailService emailService, OtpService otpService, IConfiguration configuration)
        {
            _context = context;
            _logger = logger;
            _cache = cache;
            _emailService = emailService;
            _otpService = otpService;
            _configuration = configuration;

            // Load encryption key (Base64 hoặc chuỗi thường) cho backup JSON
            try
            {
                var keyString = _configuration["BackupEncryption:Key"];
                if (!string.IsNullOrWhiteSpace(keyString))
                {
                    byte[] keyBytes;
                    try
                    {
                        // Ưu tiên decode Base64
                        keyBytes = Convert.FromBase64String(keyString);
                    }
                    catch
                    {
                        // Nếu không phải Base64 thì dùng UTF8 bytes trực tiếp
                        keyBytes = Encoding.UTF8.GetBytes(keyString);
                    }

                    // Chuẩn hoá độ dài key cho AES (16/24/32 bytes)
                    if (keyBytes.Length is 16 or 24 or 32)
                    {
                        _backupEncryptionKey = keyBytes;
                    }
                    else if (keyBytes.Length > 32)
                    {
                        _backupEncryptionKey = keyBytes.Take(32).ToArray();
                    }
                    else
                    {
                        _logger.LogWarning("Backup encryption key quá ngắn, sẽ không bật mã hoá JSON backup.");
                        _backupEncryptionKey = null;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Không thể khởi tạo key mã hoá cho backup JSON.");
                _backupEncryptionKey = null;
            }
        }

        private byte[] EncryptBackupJson(string json)
        {
            if (string.IsNullOrEmpty(json) || _backupEncryptionKey == null)
            {
                return Encoding.UTF8.GetBytes(json);
            }

            using var aes = Aes.Create();
            aes.Key = _backupEncryptionKey;
            aes.Mode = CipherMode.CBC;
            aes.Padding = PaddingMode.PKCS7;
            aes.GenerateIV();

            using var encryptor = aes.CreateEncryptor(aes.Key, aes.IV);
            var plainBytes = Encoding.UTF8.GetBytes(json);
            var cipherBytes = encryptor.TransformFinalBlock(plainBytes, 0, plainBytes.Length);

            var result = new byte[aes.IV.Length + cipherBytes.Length];
            Buffer.BlockCopy(aes.IV, 0, result, 0, aes.IV.Length);
            Buffer.BlockCopy(cipherBytes, 0, result, aes.IV.Length, cipherBytes.Length);
            return result;
        }

        private string DecryptBackupJson(byte[] data)
        {
            if (data == null || data.Length == 0 || _backupEncryptionKey == null)
            {
                return Encoding.UTF8.GetString(data);
            }

            using var aes = Aes.Create();
            aes.Key = _backupEncryptionKey;
            aes.Mode = CipherMode.CBC;
            aes.Padding = PaddingMode.PKCS7;

            var ivLength = aes.BlockSize / 8;
            if (data.Length <= ivLength)
            {
                return Encoding.UTF8.GetString(data);
            }

            var iv = new byte[ivLength];
            var cipherBytes = new byte[data.Length - ivLength];
            Buffer.BlockCopy(data, 0, iv, 0, ivLength);
            Buffer.BlockCopy(data, ivLength, cipherBytes, 0, cipherBytes.Length);
            aes.IV = iv;

            using var decryptor = aes.CreateDecryptor(aes.Key, aes.IV);
            var plainBytes = decryptor.TransformFinalBlock(cipherBytes, 0, cipherBytes.Length);
            return Encoding.UTF8.GetString(plainBytes);
        }

        [HttpPost("login")]
        public async Task<IActionResult> AdminLogin([FromBody] LoginRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.TenTaiKhoan) || string.IsNullOrWhiteSpace(request.Password))
            {
                return BadRequest("Tên tài khoản và mật khẩu không được để trống.");
            }

            var adminAccount = await _context.TaiKhoans
                .Include(t => t.ThanhVien)
                .Include(t => t.Quyen)
                .FirstOrDefaultAsync(t => t.TenTaiKhoan == request.TenTaiKhoan);

            if (adminAccount == null)
            {
                return Unauthorized("Tên tài khoản hoặc mật khẩu không đúng.");
            }

            if (adminAccount.QuyenId != 1)
            {
                return StatusCode(StatusCodes.Status403Forbidden, "Tài khoản không có quyền quản trị.");
            }

            if (string.IsNullOrEmpty(adminAccount.MatKhau) || !BCrypt.Net.BCrypt.Verify(request.Password, adminAccount.MatKhau))
            {
                return Unauthorized("Sai mật khẩu.");
            }

            adminAccount.LanDangNhapGanNhat = DateTime.Now;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                user = new
                {
                    taiKhoanId = adminAccount.TaiKhoanId,
                    tenTaiKhoan = adminAccount.TenTaiKhoan,
                    email = adminAccount.Email,
                    quyenId = adminAccount.QuyenId,
                    tenQuyen = adminAccount.Quyen?.TenQuyen,
                    thanhVienId = adminAccount.ThanhVienId,
                    hoTen = adminAccount.ThanhVien?.HoTen
                }
            });
        }

        [HttpPost("forgot-password")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request, CancellationToken cancellationToken)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.TenTaiKhoan))
            {
                return BadRequest("Email và tên tài khoản không được để trống.");
            }

            var account = await _context.TaiKhoans
                .Include(t => t.ThanhVien)
                .FirstOrDefaultAsync(t => t.Email == request.Email && t.TenTaiKhoan == request.TenTaiKhoan, cancellationToken);

            if (account == null)
            {
                return BadRequest("Email hoặc tên tài khoản không chính xác.");
            }

            if (account.QuyenId != 1)
            {
                return StatusCode(StatusCodes.Status403Forbidden, "Tài khoản không có quyền quản trị.");
            }

            // Tạo OTP
            var otp = _otpService.GenerateOtp(request.Email, "admin-reset-password");

            // Gửi email
            try
            {
                var hoTen = account.ThanhVien?.HoTen ?? account.TenTaiKhoan;
                var subject = "Đặt lại mật khẩu tài khoản Admin";
                var body = $@"
Xin chào {hoTen},

Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản quản trị.

Mã OTP của bạn là: {otp}

Mã OTP này có hiệu lực trong 10 phút.

Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.

Trân trọng,
Hệ thống quản lý nhóm CyberTeamWork
";
                await _emailService.SendEmailAsync(request.Email, subject, body);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Không thể gửi email reset password cho {Email}", request.Email);
                return StatusCode(StatusCodes.Status500InternalServerError, new
                {
                    message = "Không thể gửi email. Vui lòng thử lại sau."
                });
            }

            return Ok(new { message = "Mã OTP đã được gửi đến email của bạn." });
        }

        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request, CancellationToken cancellationToken)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.TenTaiKhoan) || 
                string.IsNullOrWhiteSpace(request.Otp) || string.IsNullOrWhiteSpace(request.NewPassword))
            {
                return BadRequest("Vui lòng nhập đầy đủ thông tin.");
            }

            // Xác thực OTP
            if (!_otpService.VerifyOtp(request.Email, request.Otp, "admin-reset-password"))
            {
                return BadRequest("Mã OTP không hợp lệ hoặc đã hết hạn.");
            }

            // Kiểm tra tài khoản
            var account = await _context.TaiKhoans
                .FirstOrDefaultAsync(t => t.Email == request.Email && t.TenTaiKhoan == request.TenTaiKhoan, cancellationToken);
            
            if (account == null)
            {
                return NotFound("Tài khoản không tồn tại.");
            }

            if (account.QuyenId != 1)
            {
                return StatusCode(StatusCodes.Status403Forbidden, "Tài khoản không có quyền quản trị.");
            }

            // Đổi mật khẩu
            account.MatKhau = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
            await _context.SaveChangesAsync(cancellationToken);

            return Ok(new { message = "Đặt lại mật khẩu thành công." });
        }

        [HttpPost("change-password")]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request, CancellationToken cancellationToken)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.CurrentPassword) || string.IsNullOrWhiteSpace(request.NewPassword))
            {
                return BadRequest("Mật khẩu hiện tại và mật khẩu mới không được để trống.");
            }

            // Lấy thông tin admin từ session/token (giả sử lưu trong header hoặc claim)
            // Trong trường hợp này, chúng ta cần biết admin nào đang đổi mật khẩu
            // Tạm thời sử dụng email hoặc username từ request
            // Bạn nên triển khai JWT authentication để lấy thông tin user hiện tại

            // Để đơn giản, tạm thời yêu cầu email trong request
            if (string.IsNullOrWhiteSpace(request.Email))
            {
                return BadRequest("Email không được để trống.");
            }

            var account = await _context.TaiKhoans
                .FirstOrDefaultAsync(t => t.Email == request.Email && t.QuyenId == 1, cancellationToken);

            if (account == null)
            {
                return NotFound("Tài khoản admin không tồn tại.");
            }

            // Xác thực mật khẩu hiện tại
            if (string.IsNullOrEmpty(account.MatKhau) || !BCrypt.Net.BCrypt.Verify(request.CurrentPassword, account.MatKhau))
            {
                return BadRequest("Mật khẩu hiện tại không đúng.");
            }

            // Kiểm tra mật khẩu mới không trùng với mật khẩu cũ
            if (BCrypt.Net.BCrypt.Verify(request.NewPassword, account.MatKhau))
            {
                return BadRequest("Mật khẩu mới phải khác mật khẩu hiện tại.");
            }

            // Đổi mật khẩu
            account.MatKhau = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
            await _context.SaveChangesAsync(cancellationToken);

            return Ok(new { message = "Đổi mật khẩu thành công." });
        }

        [HttpPut("profile")]
        public async Task<IActionResult> UpdateAdminProfile([FromBody] UpdateAdminProfileRequest request, CancellationToken cancellationToken)
        {
            if (request == null)
            {
                return BadRequest("Dữ liệu cập nhật không được để trống.");
            }

            // Tìm admin bằng email (giả sử email được lưu trong localStorage của frontend)
            // Trong thực tế, nên sử dụng JWT token để lấy thông tin admin hiện tại
            if (string.IsNullOrWhiteSpace(request.Email))
            {
                return BadRequest("Email không được để trống để xác định tài khoản admin.");
            }

            var account = await _context.TaiKhoans
                .Include(t => t.ThanhVien)
                .FirstOrDefaultAsync(t => t.Email == request.Email && t.QuyenId == 1, cancellationToken);

            if (account == null)
            {
                return NotFound("Không tìm thấy tài khoản admin.");
            }

            try
            {
                // Kiểm tra tên tài khoản đã tồn tại (nếu thay đổi)
                if (!string.IsNullOrWhiteSpace(request.TenTaiKhoan) && request.TenTaiKhoan != account.TenTaiKhoan)
                {
                    if (await _context.TaiKhoans.AnyAsync(t => t.TenTaiKhoan == request.TenTaiKhoan && t.TaiKhoanId != account.TaiKhoanId, cancellationToken))
                    {
                        return BadRequest("Tên tài khoản đã tồn tại.");
                    }
                    account.TenTaiKhoan = request.TenTaiKhoan;
                }

                // Không cho phép thay đổi email của admin để tránh mất quyền truy cập
                // Nếu cần thay đổi email, cần có flow riêng với xác thực bảo mật

                // Nếu chưa có ThanhVien, tạo mới
                if (account.ThanhVien == null && account.ThanhVienId == null)
                {
                    var newThanhVien = new ThanhVien
                    {
                        HoTen = request.HoTen ?? account.TenTaiKhoan,
                        GioiTinh = request.GioiTinh,
                        NgaySinh = !string.IsNullOrWhiteSpace(request.NgaySinh) && DateOnly.TryParse(request.NgaySinh, out var parsedDate) ? parsedDate : null,
                        Sdt = request.Sdt,
                        DiaChi = request.DiaChi,
                        ChuyenMonId = request.ChuyenMonId
                    };

                    _context.ThanhViens.Add(newThanhVien);
                    await _context.SaveChangesAsync(cancellationToken);
                    
                    account.ThanhVienId = newThanhVien.ThanhVienId;
                    await _context.SaveChangesAsync(cancellationToken);

                    // Reload để có thông tin ThanhVien
                    account = await _context.TaiKhoans
                        .Include(t => t.ThanhVien)
                        .FirstOrDefaultAsync(t => t.TaiKhoanId == account.TaiKhoanId, cancellationToken);
                }
                // Cập nhật thông tin thành viên nếu đã có
                else if (account.ThanhVien != null)
                {
                    if (!string.IsNullOrWhiteSpace(request.HoTen))
                    {
                        account.ThanhVien.HoTen = request.HoTen;
                    }
                    
                    if (!string.IsNullOrWhiteSpace(request.GioiTinh))
                    {
                        account.ThanhVien.GioiTinh = request.GioiTinh;
                    }

                    if (!string.IsNullOrWhiteSpace(request.NgaySinh))
                    {
                        if (DateOnly.TryParse(request.NgaySinh, out var parsedDate))
                        {
                            account.ThanhVien.NgaySinh = parsedDate;
                        }
                    }

                    if (!string.IsNullOrWhiteSpace(request.Sdt))
                    {
                        account.ThanhVien.Sdt = request.Sdt;
                    }

                    if (!string.IsNullOrWhiteSpace(request.DiaChi))
                    {
                        account.ThanhVien.DiaChi = request.DiaChi;
                    }

                    if (request.ChuyenMonId.HasValue)
                    {
                        account.ThanhVien.ChuyenMonId = request.ChuyenMonId.Value;
                    }

                    await _context.SaveChangesAsync(cancellationToken);
                }

                return Ok(new
                {
                    success = true,
                    message = "Cập nhật thông tin admin thành công.",
                    account = new
                    {
                        taiKhoanId = account.TaiKhoanId,
                        tenTaiKhoan = account.TenTaiKhoan,
                        email = account.Email,
                        thanhVien = account.ThanhVien != null ? new
                        {
                            hoTen = account.ThanhVien.HoTen,
                            gioiTinh = account.ThanhVien.GioiTinh,
                            ngaySinh = account.ThanhVien.NgaySinh,
                            sdt = account.ThanhVien.Sdt,
                            diaChi = account.ThanhVien.DiaChi,
                            chuyenMonId = account.ThanhVien.ChuyenMonId
                        } : null
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi cập nhật thông tin admin {Email}", request.Email);
                return StatusCode(StatusCodes.Status500InternalServerError, new
                {
                    message = "Có lỗi xảy ra khi cập nhật thông tin admin.",
                    error = ex.Message
                });
            }
        }

        [HttpGet("accounts")]
        public async Task<IActionResult> GetAccounts(CancellationToken cancellationToken)
        {
            var accounts = await _context.TaiKhoans
                .AsNoTracking()
                .Include(t => t.ThanhVien)
                .Include(t => t.Quyen)
                .Where(t => t.QuyenId == null || t.QuyenId != 1)
                .Select(t => new
                {
                    taiKhoanId = t.TaiKhoanId,
                    tenTaiKhoan = t.TenTaiKhoan,
                    email = t.Email,
                    trangThai = t.TrangThai,
                    loaiTaiKhoan = t.LoaiTaiKhoan,
                    ngayTao = t.NgayTao,
                    lanDangNhapGanNhat = t.LanDangNhapGanNhat,
                    quyenId = t.QuyenId,
                    tenQuyen = t.Quyen != null ? t.Quyen.TenQuyen : null,
                    thanhVien = t.ThanhVien == null ? null : new
                    {
                        thanhVienId = t.ThanhVien.ThanhVienId,
                        hoTen = t.ThanhVien.HoTen,
                        gioiTinh = t.ThanhVien.GioiTinh,
                        ngaySinh = t.ThanhVien.NgaySinh,
                        sdt = t.ThanhVien.Sdt,
                        diaChi = t.ThanhVien.DiaChi,
                        chuyenMonId = t.ThanhVien.ChuyenMonId,
                        anhBia = t.ThanhVien.AnhBia
                    }
                })
                .ToListAsync(cancellationToken);

            return Ok(new
            {
                success = true,
                data = accounts
            });
        }

        [HttpGet("profile")]
        public async Task<IActionResult> GetAdminProfile([FromQuery] string? email, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(email))
            {
                return BadRequest("Email không được để trống.");
            }

            var account = await _context.TaiKhoans
                .AsNoTracking()
                .Include(t => t.ThanhVien)
                .Include(t => t.Quyen)
                .Where(t => t.Email == email && t.QuyenId == 1)
                .Select(t => new
                {
                    taiKhoanId = t.TaiKhoanId,
                    tenTaiKhoan = t.TenTaiKhoan,
                    email = t.Email,
                    trangThai = t.TrangThai,
                    loaiTaiKhoan = t.LoaiTaiKhoan,
                    ngayTao = t.NgayTao,
                    lanDangNhapGanNhat = t.LanDangNhapGanNhat,
                    quyenId = t.QuyenId,
                    tenQuyen = t.Quyen != null ? t.Quyen.TenQuyen : null,
                    thanhVien = t.ThanhVien == null ? null : new
                    {
                        thanhVienId = t.ThanhVien.ThanhVienId,
                        hoTen = t.ThanhVien.HoTen,
                        gioiTinh = t.ThanhVien.GioiTinh,
                        ngaySinh = t.ThanhVien.NgaySinh,
                        sdt = t.ThanhVien.Sdt,
                        diaChi = t.ThanhVien.DiaChi,
                        chuyenMonId = t.ThanhVien.ChuyenMonId,
                        anhBia = t.ThanhVien.AnhBia
                    }
                })
                .FirstOrDefaultAsync(cancellationToken);

            if (account == null)
            {
                return NotFound("Không tìm thấy tài khoản admin.");
            }

            return Ok(new
            {
                success = true,
                data = account
            });
        }

        [HttpPost("reset-password-requests")]
        public async Task<IActionResult> CreateResetPasswordRequest([FromBody] ResetPasswordRequestSubmit request, CancellationToken cancellationToken)
        {
            if (request == null)
            {
                return BadRequest("Thông tin yêu cầu không được để trống.");
            }

            if (string.IsNullOrWhiteSpace(request.TenTaiKhoan) || string.IsNullOrWhiteSpace(request.HoTen) || string.IsNullOrWhiteSpace(request.LyDo))
            {
                return BadRequest("Vui lòng cung cấp đầy đủ tên tài khoản, họ tên và lý do.");
            }

            var notification = new PasswordResetRequestCacheItem
            {
                NotificationId = Guid.NewGuid().ToString(),
                TenTaiKhoan = request.TenTaiKhoan,
                HoTen = request.HoTen,
                Email = request.Email,
                SoDienThoai = request.SoDienThoai,
                LyDo = request.LyDo,
                CreatedAt = DateTime.UtcNow
            };

            var cacheKey = $"PasswordResetRequest:{notification.NotificationId}";
            var json = JsonSerializer.Serialize(notification);

            await _cache.SetStringAsync(cacheKey, json, new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = _recoveryNotificationTtl
            }, cancellationToken);

            const string listKey = "PasswordResetRequest:List";
            var listJson = await _cache.GetStringAsync(listKey, cancellationToken);
            var list = listJson != null
                ? JsonSerializer.Deserialize<List<string>>(listJson) ?? new List<string>()
                : new List<string>();

            if (!list.Contains(notification.NotificationId))
            {
                list.Add(notification.NotificationId);
                await _cache.SetStringAsync(listKey, JsonSerializer.Serialize(list), new DistributedCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = _recoveryNotificationTtl
                }, cancellationToken);
            }

            return Ok(new
            {
                success = true,
                message = "Đã ghi nhận yêu cầu reset mật khẩu.",
                notificationId = notification.NotificationId
            });
        }

        [HttpGet("reset-password-requests")]
        public async Task<IActionResult> GetResetPasswordRequests(CancellationToken cancellationToken)
        {
            const string listKey = "PasswordResetRequest:List";
            var listJson = await _cache.GetStringAsync(listKey, cancellationToken);

            if (string.IsNullOrEmpty(listJson))
            {
                return Ok(new
                {
                    success = true,
                    data = Array.Empty<PasswordResetRequestCacheItem>()
                });
            }

            var notificationIds = JsonSerializer.Deserialize<List<string>>(listJson) ?? new List<string>();
            var notifications = new List<PasswordResetRequestCacheItem>();
            var missingIds = new List<string>();

            foreach (var id in notificationIds)
            {
                var cacheKey = $"PasswordResetRequest:{id}";
                var json = await _cache.GetStringAsync(cacheKey, cancellationToken);
                if (string.IsNullOrEmpty(json))
                {
                    missingIds.Add(id);
                    continue;
                }

                try
                {
                    var item = JsonSerializer.Deserialize<PasswordResetRequestCacheItem>(json);
                    if (item != null)
                    {
                        notifications.Add(item);
                    }
                    else
                    {
                        missingIds.Add(id);
                    }
                }
                catch (JsonException)
                {
                    missingIds.Add(id);
                }
            }

            if (missingIds.Count > 0)
            {
                var updatedIds = notificationIds.Except(missingIds).ToList();
                await _cache.SetStringAsync(listKey, JsonSerializer.Serialize(updatedIds), new DistributedCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = _recoveryNotificationTtl
                }, cancellationToken);
            }

            notifications = notifications
                .OrderByDescending(n => n.CreatedAt)
                .ToList();

            return Ok(new
            {
                success = true,
                data = notifications
            });
        }

        [HttpDelete("reset-password-requests/{notificationId}")]
        public async Task<IActionResult> DeleteResetPasswordRequest(string notificationId, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(notificationId))
            {
                return BadRequest("notificationId không hợp lệ.");
            }

            const string listKey = "PasswordResetRequest:List";
            var listJson = await _cache.GetStringAsync(listKey, cancellationToken);

            if (string.IsNullOrEmpty(listJson))
            {
                return NotFound("Không tìm thấy yêu cầu cần xoá.");
            }

            var notificationIds = JsonSerializer.Deserialize<List<string>>(listJson) ?? new List<string>();

            if (!notificationIds.Remove(notificationId))
            {
                return NotFound("Yêu cầu reset mật khẩu không tồn tại.");
            }

            var cacheKey = $"PasswordResetRequest:{notificationId}";
            await _cache.RemoveAsync(cacheKey, cancellationToken);

            if (notificationIds.Count == 0)
            {
                await _cache.RemoveAsync(listKey, cancellationToken);
            }
            else
            {
                await _cache.SetStringAsync(listKey, JsonSerializer.Serialize(notificationIds), new DistributedCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = _recoveryNotificationTtl
                }, cancellationToken);
            }

            return Ok(new
            {
                success = true,
                message = "Đã xoá yêu cầu reset mật khẩu thành công.",
                notificationId
            });
        }

        [HttpGet("accounts/banned")]
        public async Task<IActionResult> GetBannedAccounts(CancellationToken cancellationToken)
        {
            var accounts = await _context.TaiKhoans
                .AsNoTracking()
                .Include(t => t.ThanhVien)
                .Include(t => t.Quyen)
                .Where(t => (t.QuyenId == null || t.QuyenId != 1) && t.TrangThai == false)
                .Select(t => new
                {
                    taiKhoanId = t.TaiKhoanId,
                    tenTaiKhoan = t.TenTaiKhoan,
                    email = t.Email,
                    trangThai = t.TrangThai,
                    loaiTaiKhoan = t.LoaiTaiKhoan,
                    quyenId = t.QuyenId,
                    tenQuyen = t.Quyen != null ? t.Quyen.TenQuyen : null,
                    ngayTao = t.NgayTao,
                    lanDangNhapGanNhat = t.LanDangNhapGanNhat,
                    thanhVien = t.ThanhVien == null ? null : new                    
                    {
                        thanhVienId = t.ThanhVien.ThanhVienId,
                        hoTen = t.ThanhVien.HoTen,
                        gioiTinh = t.ThanhVien.GioiTinh,
                        ngaySinh = t.ThanhVien.NgaySinh,
                        sdt = t.ThanhVien.Sdt,
                        diaChi = t.ThanhVien.DiaChi,
                        chuyenMonId = t.ThanhVien.ChuyenMonId,
                        anhBia = t.ThanhVien.AnhBia
                    }
                })
                .ToListAsync(cancellationToken);

            return Ok(new
            {
                success = true,
                data = accounts
            });
        }

        [HttpPost("accounts/{taiKhoanId}/change-email")]
        public async Task<IActionResult> ChangeAccountEmail(int taiKhoanId, [FromBody] ChangeEmailByAdminRequest request, CancellationToken cancellationToken)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.NewEmail))
            {
                return BadRequest("Email mới không được để trống.");
            }

            var account = await _context.TaiKhoans
                .Include(t => t.ThanhVien)
                .FirstOrDefaultAsync(t => t.TaiKhoanId == taiKhoanId, cancellationToken);

            if (account == null)
            {
                return NotFound("Không tìm thấy tài khoản.");
            }

            if (account.QuyenId == 1)
            {
                return StatusCode(StatusCodes.Status403Forbidden, "Không thể thay đổi email của tài khoản quản trị.");
            }

            var emailExists = await _context.TaiKhoans
                .AnyAsync(t => t.Email != null && t.Email == request.NewEmail && t.TaiKhoanId != taiKhoanId, cancellationToken);

            if (emailExists)
            {
                return BadRequest("Email mới đã được sử dụng bởi tài khoản khác.");
            }

            var oldEmail = account.Email;
            account.Email = request.NewEmail;
            await _context.SaveChangesAsync(cancellationToken);

            var subject = "Thông báo đổi email";
            var hoTen = account.ThanhVien?.HoTen ?? account.TenTaiKhoan ?? "bạn";
            var bodyBuilder = new StringBuilder();
            bodyBuilder.AppendLine($"Xin chào {hoTen},");
            bodyBuilder.AppendLine();
            bodyBuilder.AppendLine($"Tên tài khoản: {account.TenTaiKhoan}");
            bodyBuilder.AppendLine();
            bodyBuilder.AppendLine("Chúng tôi muốn thông báo rằng địa chỉ email của bạn đã được cập nhật thành công.");
            bodyBuilder.AppendLine($"- Email cũ: {oldEmail ?? "(không có)"}");
            bodyBuilder.AppendLine($"- Email mới: {request.NewEmail}");
            bodyBuilder.AppendLine("Bạn có thể tiến hành khôi phục mật khẩu của mình với email mới!");
            bodyBuilder.AppendLine();
            bodyBuilder.AppendLine("Nếu bạn không thực hiện yêu cầu này, vui lòng liên hệ ngay với bộ phận hỗ trợ để được trợ giúp.");
            bodyBuilder.AppendLine();
            bodyBuilder.AppendLine("Trân trọng,");
            bodyBuilder.AppendLine("Đội ngũ hỗ trợ hệ thống quản lý nhóm");

            try
            {
                await _emailService.SendEmailAsync(request.NewEmail, subject, bodyBuilder.ToString());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Không thể gửi email thông báo đổi email cho tài khoản {TaiKhoanId}", taiKhoanId);
            }

            return Ok(new
            {
                success = true,
                message = "Đã cập nhật email tài khoản và gửi thông báo.",
                taiKhoanId = account.TaiKhoanId,
                oldEmail,
                newEmail = request.NewEmail
            });
        }

        [HttpPost("accounts/{taiKhoanId}/reset-password")]
        public async Task<IActionResult> AdminResetPassword(int taiKhoanId, CancellationToken cancellationToken)
        {
            var account = await _context.TaiKhoans
                .Include(t => t.ThanhVien)
                .FirstOrDefaultAsync(t => t.TaiKhoanId == taiKhoanId, cancellationToken);

            if (account == null)
            {
                return NotFound("Không tìm thấy tài khoản.");
            }

            if (account.QuyenId == 1)
            {
                return StatusCode(StatusCodes.Status403Forbidden, "Không thể reset mật khẩu của tài khoản quản trị.");
            }

            // Reset mật khẩu về mặc định "123"
            var defaultPassword = "123";
            account.MatKhau = BCrypt.Net.BCrypt.HashPassword(defaultPassword);
            await _context.SaveChangesAsync(cancellationToken);

            // Gửi email thông báo
            if (!string.IsNullOrWhiteSpace(account.Email))
            {
                try
                {
                    var hoTen = account.ThanhVien?.HoTen ?? account.TenTaiKhoan;
                    var subject = "Mật khẩu của bạn đã được reset";
                    var body = $@"
Xin chào {hoTen},

Mật khẩu tài khoản của bạn đã được reset bởi quản trị viên.

Thông tin đăng nhập:
- Tên tài khoản: {account.TenTaiKhoan}
- Mật khẩu mới: {defaultPassword}

Vui lòng đăng nhập và đổi mật khẩu ngay sau khi nhận được email này.

Trân trọng,
Hệ thống quản lý nhóm CyberTeamWork
";
                    await _emailService.SendEmailAsync(account.Email, subject, body);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Không thể gửi email thông báo reset password cho tài khoản {TaiKhoanId}", taiKhoanId);
                }
            }

            return Ok(new
            {
                success = true,
                message = $"Đã reset mật khẩu cho tài khoản {account.TenTaiKhoan}. Mật khẩu mới: {defaultPassword}",
                newPassword = defaultPassword
            });
        }

        [HttpDelete("accounts/{taiKhoanId}")]
        public async Task<IActionResult> DeleteAccount(int taiKhoanId, CancellationToken cancellationToken)
        {
            var account = await _context.TaiKhoans
                .Include(t => t.ThanhVien)
                .FirstOrDefaultAsync(t => t.TaiKhoanId == taiKhoanId, cancellationToken);

            if (account == null)
            {
                return NotFound("Không tìm thấy tài khoản.");
            }

            if (account.QuyenId == 1)
            {
                return StatusCode(StatusCodes.Status403Forbidden, "Không thể xoá tài khoản quản trị.");
            }

            try
            {
                if (account.ThanhVienId.HasValue)
                {
                    var transferResult = await TransferAssignmentsToGroupLeaderAsync(account.ThanhVienId.Value, cancellationToken);

                    if (!transferResult.Success)
                    {
                        return BadRequest(new
                        {
                            message = transferResult.ErrorMessage ?? "Không thể chuyển phân công của thành viên trước khi xoá tài khoản."
                        });
                    }
                }

                if (account.ThanhVien != null)
                {
                    _context.ThanhViens.Remove(account.ThanhVien);
                }
                else if (account.ThanhVienId.HasValue)
                {
                    var member = await _context.ThanhViens
                        .FindAsync(new object[] { account.ThanhVienId.Value }, cancellationToken);

                    if (member != null)
                    {
                        _context.ThanhViens.Remove(member);
                    }
                }

                _context.TaiKhoans.Remove(account);
                await _context.SaveChangesAsync(cancellationToken);

                return Ok(new
                {
                    success = true,
                    message = "Đã xoá tài khoản thành công.",
                    taiKhoanId
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi xoá tài khoản {TaiKhoanId}", taiKhoanId);
                return StatusCode(StatusCodes.Status500InternalServerError, new
                {
                    message = "Có lỗi xảy ra khi xoá tài khoản.",
                    error = ex.Message
                });
            }
        }

        [HttpPut("accounts/{taiKhoanId}")]
        public async Task<IActionResult> UpdateAccount(int taiKhoanId, [FromBody] UpdateAccountByAdminRequest request, CancellationToken cancellationToken)
        {
            if (request == null)
            {
                return BadRequest("Dữ liệu cập nhật không được để trống.");
            }

            var account = await _context.TaiKhoans
                .Include(t => t.ThanhVien)
                .FirstOrDefaultAsync(t => t.TaiKhoanId == taiKhoanId, cancellationToken);

            if (account == null)
            {
                return NotFound("Không tìm thấy tài khoản.");
            }

            if (account.QuyenId == 1)
            {
                return StatusCode(StatusCodes.Status403Forbidden, "Không thể chỉnh sửa tài khoản quản trị.");
            }

            try
            {
                // Kiểm tra tên tài khoản đã tồn tại (nếu thay đổi)
                if (!string.IsNullOrWhiteSpace(request.TenTaiKhoan) && request.TenTaiKhoan != account.TenTaiKhoan)
                {
                    if (await _context.TaiKhoans.AnyAsync(t => t.TenTaiKhoan == request.TenTaiKhoan && t.TaiKhoanId != taiKhoanId, cancellationToken))
                    {
                        return BadRequest("Tên tài khoản đã tồn tại.");
                    }
                    account.TenTaiKhoan = request.TenTaiKhoan;
                }

                // Kiểm tra email đã tồn tại (nếu thay đổi)
                if (!string.IsNullOrWhiteSpace(request.Email) && request.Email != account.Email)
                {
                    if (await _context.TaiKhoans.AnyAsync(t => t.Email == request.Email && t.TaiKhoanId != taiKhoanId, cancellationToken))
                    {
                        return BadRequest("Email đã được sử dụng bởi tài khoản khác.");
                    }
                    account.Email = request.Email;
                }

                // Cập nhật thông tin thành viên
                if (account.ThanhVien != null)
                {
                    if (!string.IsNullOrWhiteSpace(request.HoTen))
                    {
                        account.ThanhVien.HoTen = request.HoTen;
                    }
                    
                    if (!string.IsNullOrWhiteSpace(request.GioiTinh))
                    {
                        account.ThanhVien.GioiTinh = request.GioiTinh;
                    }

                    if (!string.IsNullOrWhiteSpace(request.NgaySinh))
                    {
                        if (DateOnly.TryParse(request.NgaySinh, out var parsedDate))
                        {
                            account.ThanhVien.NgaySinh = parsedDate;
                        }
                    }

                    if (!string.IsNullOrWhiteSpace(request.Sdt))
                    {
                        account.ThanhVien.Sdt = request.Sdt;
                    }

                    if (!string.IsNullOrWhiteSpace(request.DiaChi))
                    {
                        account.ThanhVien.DiaChi = request.DiaChi;
                    }

                    if (request.ChuyenMonId.HasValue)
                    {
                        account.ThanhVien.ChuyenMonId = request.ChuyenMonId.Value;
                    }
                }

                await _context.SaveChangesAsync(cancellationToken);

                return Ok(new
                {
                    success = true,
                    message = "Cập nhật thông tin tài khoản thành công.",
                    account = new
                    {
                        taiKhoanId = account.TaiKhoanId,
                        tenTaiKhoan = account.TenTaiKhoan,
                        email = account.Email,
                        thanhVien = account.ThanhVien != null ? new
                        {
                            hoTen = account.ThanhVien.HoTen,
                            gioiTinh = account.ThanhVien.GioiTinh,
                            ngaySinh = account.ThanhVien.NgaySinh,
                            sdt = account.ThanhVien.Sdt,
                            diaChi = account.ThanhVien.DiaChi,
                            chuyenMonId = account.ThanhVien.ChuyenMonId
                        } : null
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi cập nhật tài khoản {TaiKhoanId}", taiKhoanId);
                return StatusCode(StatusCodes.Status500InternalServerError, new
                {
                    message = "Có lỗi xảy ra khi cập nhật tài khoản.",
                    error = ex.Message
                });
            }
        }

        [HttpPatch("accounts/{taiKhoanId}/ban")]
        public async Task<IActionResult> BanAccount(int taiKhoanId, CancellationToken cancellationToken)
        {
            var account = await _context.TaiKhoans.FirstOrDefaultAsync(t => t.TaiKhoanId == taiKhoanId, cancellationToken);

            if (account == null)
            {
                return NotFound("Không tìm thấy tài khoản.");
            }

            if (account.QuyenId == 1)
            {
                return StatusCode(StatusCodes.Status403Forbidden, "Không thể khoá tài khoản quản trị.");
            }

            account.TrangThai = false;
            await _context.SaveChangesAsync(cancellationToken);

            return Ok(new
            {
                success = true,
                message = "Khoá tài khoản thành công.",
                taiKhoanId = account.TaiKhoanId
            });
        }

        [HttpPatch("accounts/{taiKhoanId}/unban")]
        public async Task<IActionResult> UnbanAccount(int taiKhoanId, CancellationToken cancellationToken)
        {
            var account = await _context.TaiKhoans.FirstOrDefaultAsync(t => t.TaiKhoanId == taiKhoanId, cancellationToken);

            if (account == null)
            {
                return NotFound("Không tìm thấy tài khoản.");
            }

            if (account.QuyenId == 1)
            {
                return StatusCode(StatusCodes.Status403Forbidden, "Không thể thao tác trên tài khoản quản trị.");
            }

            account.TrangThai = true;
            await _context.SaveChangesAsync(cancellationToken);

            return Ok(new
            {
                success = true,
                message = "Mở khoá tài khoản thành công.",
                taiKhoanId = account.TaiKhoanId
            });
        }

        [HttpPatch("accounts/{taiKhoanId}/change-role")]
        public async Task<IActionResult> ChangeAccountRole(int taiKhoanId, [FromBody] ChangeRoleRequest request, CancellationToken cancellationToken)
        {
            if (request == null || !request.QuyenId.HasValue)
            {
                return BadRequest("Vui lòng chọn quyền mới.");
            }

            var account = await _context.TaiKhoans
                .Include(t => t.Quyen)
                .Include(t => t.ThanhVien)
                .FirstOrDefaultAsync(t => t.TaiKhoanId == taiKhoanId, cancellationToken);

            if (account == null)
            {
                return NotFound("Không tìm thấy tài khoản.");
            }

            if (account.QuyenId == 1)
            {
                return StatusCode(StatusCodes.Status403Forbidden, "Không thể thay đổi quyền của tài khoản quản trị.");
            }

            // Kiểm tra quyền Admin không được phép gán
            if (request.QuyenId == 1)
            {
                return BadRequest("Không thể gán quyền Admin cho tài khoản này.");
            }

            // Kiểm tra quyền mới có tồn tại không
            var newRole = await _context.Quyens.FindAsync(new object[] { request.QuyenId.Value }, cancellationToken);
            if (newRole == null)
            {
                return BadRequest("Quyền được chọn không tồn tại.");
            }

            var oldRoleName = account.Quyen?.TenQuyen ?? "Không xác định";
            account.QuyenId = request.QuyenId.Value;
            await _context.SaveChangesAsync(cancellationToken);

            // Gửi email thông báo thay đổi quyền
            if (!string.IsNullOrWhiteSpace(account.Email))
            {
                try
                {
                    var hoTen = account.ThanhVien?.HoTen ?? account.TenTaiKhoan;
                    var subject = "Thông báo thay đổi quyền tài khoản";
                    var body = $@"
Xin chào {hoTen},

Quyền của tài khoản {account.TenTaiKhoan} đã được cập nhật.

- Quyền cũ: {oldRoleName}
- Quyền mới: {newRole.TenQuyen}

Nếu có thắc mắc, vui lòng liên hệ quản trị viên.

Trân trọng,
Hệ thống quản lý nhóm CyberTeamWork
";
                    await _emailService.SendEmailAsync(account.Email, subject, body);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Không thể gửi email thông báo thay đổi quyền cho tài khoản {TaiKhoanId}", taiKhoanId);
                }
            }

            return Ok(new
            {
                success = true,
                message = "Thay đổi quyền tài khoản thành công.",
                taiKhoanId = account.TaiKhoanId,
                oldRole = oldRoleName,
                newRole = newRole.TenQuyen
            });
        }

        [HttpGet("roles")]
        public async Task<IActionResult> GetRoles(CancellationToken cancellationToken)
        {
            try
            {
                var roles = await _context.Quyens
                    .AsNoTracking()
                    .Where(q => q.QuyenId != 1) // Loại trừ quyền Admin (QuyenId = 1)
                    .Select(q => new
                    {
                        quyenId = q.QuyenId,
                        tenQuyen = q.TenQuyen,
                        moTa = q.MoTa
                    })
                    .ToListAsync(cancellationToken);

                return Ok(new
                {
                    success = true,
                    data = roles
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi lấy danh sách quyền");
                return StatusCode(StatusCodes.Status500InternalServerError, new
                {
                    message = "Có lỗi xảy ra khi lấy danh sách quyền.",
                    error = ex.Message
                });
            }
        }

        [HttpPost("accounts/create")]
        public async Task<IActionResult> CreateAccount([FromBody] CreateAccountByAdminRequest request, CancellationToken cancellationToken)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.TenTaiKhoan) || string.IsNullOrWhiteSpace(request.Email))
            {
                return BadRequest("Tên tài khoản và email không được để trống.");
            }

            // Kiểm tra tên tài khoản đã tồn tại
            if (await _context.TaiKhoans.AnyAsync(t => t.TenTaiKhoan == request.TenTaiKhoan, cancellationToken))
            {
                return BadRequest("Tên tài khoản đã tồn tại.");
            }

            // Kiểm tra email đã tồn tại
            if (await _context.TaiKhoans.AnyAsync(t => t.Email == request.Email, cancellationToken))
            {
                return BadRequest("Email đã tồn tại.");
            }

            try
            {
                // Tạo ThanhVien trước
                var thanhVien = new ThanhVien
                {
                    HoTen = request.HoTen ?? request.TenTaiKhoan,
                    GioiTinh = request.GioiTinh,
                    Sdt = request.Sdt,
                    DiaChi = request.DiaChi,
                    ChuyenMonId = request.ChuyenMonId
                };

                _context.ThanhViens.Add(thanhVien);
                await _context.SaveChangesAsync(cancellationToken);

                // Mật khẩu mặc định là "123"
                var defaultPassword = "123";
                var hashedPassword = BCrypt.Net.BCrypt.HashPassword(defaultPassword);

                // Xác định quyền cho tài khoản
                int quyenId;
                if (request.QuyenId.HasValue && request.QuyenId.Value != 1)
                {
                    // Sử dụng quyền được chỉ định (đảm bảo không phải Admin)
                    quyenId = request.QuyenId.Value;
                }
                else
                {
                    // Mặc định là quyền User nếu không chỉ định
                    quyenId = _context.Quyens
                                .Where(q => q.TenQuyen == "User")
                                .Select(q => q.QuyenId)
                                .FirstOrDefault();
                }

                // Tạo TaiKhoan
                var taiKhoan = new TaiKhoan
                {
                    ThanhVienId = thanhVien.ThanhVienId,
                    TenTaiKhoan = request.TenTaiKhoan,
                    Email = request.Email,
                    MatKhau = hashedPassword,
                    NgayTao = DateTime.Now,
                    TrangThai = true,
                    LoaiTaiKhoan = "local",
                    QuyenId = quyenId
                };

                _context.TaiKhoans.Add(taiKhoan);
                await _context.SaveChangesAsync(cancellationToken);

                // Gửi email thông báo tài khoản mới
                try
                {
                    var subject = "Tài khoản của bạn đã được tạo";
                    var body = $@"
Xin chào {thanhVien.HoTen},

Tài khoản của bạn đã được tạo thành công bởi quản trị viên.

Thông tin đăng nhập:
- Tên tài khoản: {taiKhoan.TenTaiKhoan}
- Email: {taiKhoan.Email}
- Mật khẩu tạm thời: {defaultPassword}

Vui lòng đăng nhập và đổi mật khẩu ngay sau khi nhận được email này.

Trân trọng,
Hệ thống quản lý nhóm CyberTeamWork
";
                    await _emailService.SendEmailAsync(request.Email, subject, body);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Không thể gửi email thông báo tài khoản mới cho {Email}", request.Email);
                }

                return Ok(new
                {
                    success = true,
                    message = "Tạo tài khoản thành công và đã gửi thông tin đăng nhập qua email.",
                    account = new
                    {
                        taiKhoanId = taiKhoan.TaiKhoanId,
                        thanhVienId = thanhVien.ThanhVienId,
                        tenTaiKhoan = taiKhoan.TenTaiKhoan,
                        email = taiKhoan.Email,
                        hoTen = thanhVien.HoTen
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi tạo tài khoản mới");
                return StatusCode(StatusCodes.Status500InternalServerError, new
                {
                    message = "Có lỗi xảy ra khi tạo tài khoản.",
                    error = ex.Message
                });
            }
        }

        [HttpGet("groups/{nhomId}/members/ids")]
        public async Task<IActionResult> GetGroupMemberIds(int nhomId, CancellationToken cancellationToken)
        {
            var groupExists = await _context.Nhoms
                .AsNoTracking()
                .AnyAsync(n => n.NhomId == nhomId, cancellationToken);

            if (!groupExists)
            {
                return NotFound(new
                {
                    message = $"Không tìm thấy nhóm với ID {nhomId}."
                });
            }

            var members = await _context.ChiTietThanhVienNhoms
                .AsNoTracking()
                .Where(ct => ct.NhomId == nhomId)
                .Select(ct => new { ct.ThanhVienId, ct.ChucVu })
                .ToListAsync(cancellationToken);

            var memberIds = members
                .Select(ct => ct.ThanhVienId)
                .Distinct()
                .ToList();

            var leaderId = members
                .FirstOrDefault(ct =>
                    !string.IsNullOrWhiteSpace(ct.ChucVu) &&
                    string.Equals(ct.ChucVu, "Trưởng nhóm", StringComparison.OrdinalIgnoreCase))?.ThanhVienId;

            return Ok(new
            {
                groupId = nhomId,
                leaderId,
                memberIds,
                memberCount = memberIds.Count
            });
        }

    
        // Backup toàn bộ hệ thống
        [HttpGet("backup/full-system")]
        public async Task<IActionResult> BackupFullSystem(CancellationToken cancellationToken)
        {
            try
            {
                // Backup ThanhVien
                var thanhVienDtos = await _context.ThanhViens
                    .AsNoTracking()
                    .Select(tv => new ThanhVienBackupDto
                    {
                        ThanhVienId = tv.ThanhVienId,
                        HoTen = tv.HoTen,
                        GioiTinh = tv.GioiTinh,
                        NgaySinh = tv.NgaySinh.HasValue ? tv.NgaySinh.Value.ToString("yyyy-MM-dd") : null,
                        MoTaBanThan = tv.MoTaBanThan,
                        Sdt = tv.Sdt,
                        DiaChi = tv.DiaChi,
                        ChuyenMonId = tv.ChuyenMonId,
                        AnhBia = tv.AnhBia
                    })
                    .ToListAsync(cancellationToken);

                // Backup TaiKhoan (trừ Admin)
                var taiKhoanDtos = await _context.TaiKhoans
                    .AsNoTracking()
                    .Where(tk => tk.QuyenId == null || tk.QuyenId != 1)
                    .Select(tk => new TaiKhoanBackupDto
                    {
                        TaiKhoanId = tk.TaiKhoanId,
                        TenTaiKhoan = tk.TenTaiKhoan,
                        Email = tk.Email,
                        MatKhau = tk.MatKhau,
                        NgayTao = tk.NgayTao,
                        TrangThai = tk.TrangThai,
                        LoaiTaiKhoan = tk.LoaiTaiKhoan,
                        LanDangNhapGanNhat = tk.LanDangNhapGanNhat,
                        ThanhVienId = tk.ThanhVienId,
                        QuyenId = tk.QuyenId
                    })
                    .ToListAsync(cancellationToken);

                // Backup Nhom
                var nhomDtos = await _context.Nhoms
                    .AsNoTracking()
                    .Select(n => new NhomBackupDto
                    {
                        NhomId = n.NhomId,
                        TenNhom = n.TenNhom,
                        MoTa = n.MoTa,
                        SoLuongTv = n.SoLuongTv,
                        NgayLapNhom = n.NgayLapNhom.HasValue ? n.NgayLapNhom.Value.ToString("yyyy-MM-dd") : null,
                        NgayCapNhat = n.NgayCapNhat,
                        AnhBia = n.AnhBia
                    })
                    .ToListAsync(cancellationToken);

                // Backup ChiTietThanhVienNhom
                var chiTietThanhVienNhomDtos = await _context.ChiTietThanhVienNhoms
                    .AsNoTracking()
                    .Select(ct => new ChiTietThanhVienNhomBackupDto
                    {
                        NhomId = ct.NhomId,
                        ThanhVienId = ct.ThanhVienId,
                        ChucVu = ct.ChucVu,
                        NgayThamGia = ct.NgayThamGia.HasValue ? ct.NgayThamGia.Value.ToString("yyyy-MM-dd") : null
                    })
                    .ToListAsync(cancellationToken);

                // Backup DuAn
                var duAnDtos = await _context.DuAns
                    .AsNoTracking()
                    .Select(d => new DuAnBackupDto
                    {
                        DuAnId = d.DuAnId,
                        TenDuAn = d.TenDuAn,
                        MoTa = d.MoTa,
                        NgayBd = d.NgayBd.HasValue ? d.NgayBd.Value.ToString("yyyy-MM-dd") : null,
                        NgayKt = d.NgayKt.HasValue ? d.NgayKt.Value.ToString("yyyy-MM-dd") : null,
                        TrangThai = d.TrangThai,
                        AnhBia = d.AnhBia,
                        NhomId = d.NhomId,
                        LinhVucId = d.LinhVucId
                    })
                    .ToListAsync(cancellationToken);

                // Backup CongViec
                var congViecDtos = await _context.CongViecs
                    .AsNoTracking()
                    .Select(cv => new CongViecBackupDto
                    {
                        CongViecId = cv.CongViecId,
                        TenCongViec = cv.TenCongViec,
                        NgayBd = cv.NgayBd.HasValue ? cv.NgayBd.Value.ToString("yyyy-MM-dd") : null,
                        NgayKt = cv.NgayKt.HasValue ? cv.NgayKt.Value.ToString("yyyy-MM-dd") : null,
                        TrangThai = cv.TrangThai,
                        PhamTramHoanThanh = cv.PhamTramHoanThanh,
                        AnhBia = cv.AnhBia,
                        DuAnId = cv.DuAnId,
                        FileDinhKem = cv.FileDinhKem
                    })
                    .ToListAsync(cancellationToken);

                // Backup PhanCong
                var phanCongDtos = await _context.PhanCongs
                    .AsNoTracking()
                    .Select(pc => new PhanCongBackupDto
                    {
                        CongViecId = pc.CongViecId,
                        ThanhVienId = pc.ThanhVienId,
                        NoiDungPhanCong = pc.NoiDungPhanCong
                    })
                    .ToListAsync(cancellationToken);

                // Backup BinhLuan
                var binhLuanDtos = await _context.BinhLuans
                    .AsNoTracking()
                    .Select(bl => new BinhLuanBackupDto
                    {
                        BinhLuanId = bl.BinhLuanId,
                        NoiDung = bl.NoiDung,
                        NgayBinhLuan = bl.NgayBinhLuan,
                        NgayCapNhat = bl.NgayCapNhat,
                        ThanhVienId = bl.ThanhVienId,
                        CongViecId = bl.CongViecId
                    })
                    .ToListAsync(cancellationToken);

                var backupPayload = new FullSystemBackupDto
                {
                    GeneratedAtUtc = DateTime.UtcNow,
                    ThanhViens = thanhVienDtos,
                    TaiKhoans = taiKhoanDtos,
                    Nhoms = nhomDtos,
                    ChiTietThanhVienNhoms = chiTietThanhVienNhomDtos,
                    DuAns = duAnDtos,
                    CongViecs = congViecDtos,
                    PhanCongs = phanCongDtos,
                    BinhLuans = binhLuanDtos
                };

                var json = JsonSerializer.Serialize(backupPayload, new JsonSerializerOptions
                {
                    WriteIndented = true
                });

                var encryptedBytes = EncryptBackupJson(json);
                var fileName = $"QuanLyNhom_FullBackup_{DateTime.UtcNow:yyyyMMdd_HHmmss}.json";
                return File(encryptedBytes, "application/octet-stream", fileName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi sao lưu toàn bộ hệ thống.");
                return StatusCode(StatusCodes.Status500InternalServerError, new
                {
                    message = "Có lỗi xảy ra khi sao lưu toàn bộ hệ thống.",
                    error = ex.Message
                });
            }
        }

        [HttpGet("backup/sql")]
        public async Task<IActionResult> BackupSql(CancellationToken cancellationToken)
        {
            try
            {
                var folder = @"C:\Backups";
                if (!Directory.Exists(folder))
                    Directory.CreateDirectory(folder);

                var backupPath = Path.Combine(folder,
                    $"QuanLyNhom_{DateTime.Now:yyyyMMdd_HHmmss}.bak");

                var sql = $@"BACKUP DATABASE [QuanLyCongViecNhom]
                            TO DISK = '{backupPath.Replace("'", "''")}'
                            WITH FORMAT, INIT";

                await _context.Database.ExecuteSqlRawAsync(sql, cancellationToken);

                var bytes = await System.IO.File.ReadAllBytesAsync(backupPath, cancellationToken);

                return File(bytes, "application/octet-stream", Path.GetFileName(backupPath));
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Backup dạng .bak DIFFERENTIAL (incremental) dựa trên bản full backup gần nhất.
        /// Yêu cầu database ở chế độ FULL hoặc BULK_LOGGED.
        /// </summary>
        [HttpGet("backup/sql-incremental")]
        public async Task<IActionResult> BackupSqlIncremental(CancellationToken cancellationToken)
        {
            try
            {
                var folder = @"C:\Backups\Incremental";
                if (!Directory.Exists(folder))
                    Directory.CreateDirectory(folder);

                var backupPath = Path.Combine(folder,
                    $"QuanLyNhom_DIFF_{DateTime.Now:yyyyMMdd_HHmmss}.bak");

                var sql = $@"BACKUP DATABASE [QuanLyCongViecNhom]
                            TO DISK = '{backupPath.Replace("'", "''")}'
                            WITH DIFFERENTIAL, INIT";

                await _context.Database.ExecuteSqlRawAsync(sql, cancellationToken);

                var bytes = await System.IO.File.ReadAllBytesAsync(backupPath, cancellationToken);

                return File(bytes, "application/octet-stream", Path.GetFileName(backupPath));
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Restore database từ file .bak được upload.
        /// Cực kỳ cẩn thận: sẽ ghi đè database hiện tại.
        /// </summary>
        [HttpPost("restore/sql")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> RestoreSql(IFormFile? backupFile, CancellationToken cancellationToken)
        {
            if (backupFile == null || backupFile.Length == 0)
            {
                return BadRequest("Vui lòng tải lên file sao lưu .bak hợp lệ.");
            }

            // Lưu file upload tạm thời vào thư mục backup
            var folder = @"C:\Backups\RestoreUploads";
            if (!Directory.Exists(folder))
                Directory.CreateDirectory(folder);

            var safeFileName = Path.GetFileNameWithoutExtension(backupFile.FileName);
            if (string.IsNullOrWhiteSpace(safeFileName))
            {
                safeFileName = "QuanLyNhom_Restore";
            }

            var restorePath = Path.Combine(folder,
                $"{safeFileName}_{DateTime.Now:yyyyMMdd_HHmmss}.bak");

            try
            {
                await using (var stream = new FileStream(restorePath, FileMode.Create, FileAccess.Write, FileShare.None))
                {
                    await backupFile.CopyToAsync(stream, cancellationToken);
                }

                // Chuỗi lệnh RESTORE: chuyển sang master, set SINGLE_USER, restore, rồi set MULTI_USER
                var sql = $@"
USE [master];
ALTER DATABASE [QuanLyCongViecNhom] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
RESTORE DATABASE [QuanLyCongViecNhom]
FROM DISK = '{restorePath.Replace("'", "''")}'
WITH REPLACE;
ALTER DATABASE [QuanLyCongViecNhom] SET MULTI_USER;";

                await _context.Database.ExecuteSqlRawAsync(sql, cancellationToken);

                return Ok(new
                {
                    success = true,
                    message = "Khôi phục database từ file .bak thành công. Ứng dụng có thể cần khởi động lại kết nối."
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "Có lỗi xảy ra khi khôi phục database từ file .bak.",
                    error = ex.Message
                });
            }
        }


        // Backup incremental theo khoảng thời gian
        [HttpGet("backup/incremental")]
        public async Task<IActionResult> BackupIncremental(
            [FromQuery] string startDate,
            [FromQuery] string? endDate,
            CancellationToken cancellationToken)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(startDate))
                {
                    return BadRequest("Vui lòng cung cấp startDate (yyyy-MM-dd).");
                }

                if (!DateTime.TryParse(startDate, out var parsedStartDate))
                {
                    return BadRequest("startDate không hợp lệ. Định dạng: yyyy-MM-dd");
                }

                DateTime parsedEndDate = DateTime.UtcNow;
                if (!string.IsNullOrWhiteSpace(endDate))
                {
                    if (!DateTime.TryParse(endDate, out parsedEndDate))
                    {
                        return BadRequest("endDate không hợp lệ. Định dạng: yyyy-MM-dd");
                    }
                }

                // Convert to UTC for comparison
                var startUtc = parsedStartDate.ToUniversalTime();
                var endUtc = parsedEndDate.ToUniversalTime().AddDays(1).AddSeconds(-1); // End of day

                // Backup ThanhVien (không có timestamp, lấy tất cả)
                var thanhVienDtos = await _context.ThanhViens
                    .AsNoTracking()
                    .Select(tv => new ThanhVienBackupDto
                    {
                        ThanhVienId = tv.ThanhVienId,
                        HoTen = tv.HoTen,
                        GioiTinh = tv.GioiTinh,
                        NgaySinh = tv.NgaySinh.HasValue ? tv.NgaySinh.Value.ToString("yyyy-MM-dd") : null,
                        MoTaBanThan = tv.MoTaBanThan,
                        Sdt = tv.Sdt,
                        DiaChi = tv.DiaChi,
                        ChuyenMonId = tv.ChuyenMonId,
                        AnhBia = tv.AnhBia
                    })
                    .ToListAsync(cancellationToken);

                // Backup TaiKhoan (filter by NgayTao)
                var taiKhoanDtos = await _context.TaiKhoans
                    .AsNoTracking()
                    .Where(tk => (tk.QuyenId == null || tk.QuyenId != 1) && 
                                 tk.NgayTao >= startUtc && tk.NgayTao <= endUtc)
                    .Select(tk => new TaiKhoanBackupDto
                    {
                        TaiKhoanId = tk.TaiKhoanId,
                        TenTaiKhoan = tk.TenTaiKhoan,
                        Email = tk.Email,
                        MatKhau = tk.MatKhau,
                        NgayTao = tk.NgayTao,
                        TrangThai = tk.TrangThai,
                        LoaiTaiKhoan = tk.LoaiTaiKhoan,
                        LanDangNhapGanNhat = tk.LanDangNhapGanNhat,
                        ThanhVienId = tk.ThanhVienId,
                        QuyenId = tk.QuyenId
                    })
                    .ToListAsync(cancellationToken);

                // Backup Nhom (filter by NgayCapNhat or NgayLapNhom)
                var nhomDtos = await _context.Nhoms
                    .AsNoTracking()
                    .Where(n => (n.NgayCapNhat.HasValue && n.NgayCapNhat.Value >= startUtc && n.NgayCapNhat.Value <= endUtc) ||
                                (!n.NgayCapNhat.HasValue && n.NgayLapNhom.HasValue))
                    .Select(n => new NhomBackupDto
                    {
                        NhomId = n.NhomId,
                        TenNhom = n.TenNhom,
                        MoTa = n.MoTa,
                        SoLuongTv = n.SoLuongTv,
                        NgayLapNhom = n.NgayLapNhom.HasValue ? n.NgayLapNhom.Value.ToString("yyyy-MM-dd") : null,
                        NgayCapNhat = n.NgayCapNhat,
                        AnhBia = n.AnhBia
                    })
                    .ToListAsync(cancellationToken);

                // Filter NgayLapNhom in memory if NgayCapNhat is null
                nhomDtos = nhomDtos.Where(n => 
                    (n.NgayCapNhat.HasValue) ||
                    (!string.IsNullOrEmpty(n.NgayLapNhom) && 
                     DateTime.Parse(n.NgayLapNhom) >= startUtc.Date && 
                     DateTime.Parse(n.NgayLapNhom) <= endUtc.Date))
                    .ToList();

                // Backup ChiTietThanhVienNhom (filter by NgayThamGia)
                var chiTietThanhVienNhomDtos = await _context.ChiTietThanhVienNhoms
                    .AsNoTracking()
                    .Where(ct => ct.NgayThamGia.HasValue)
                    .Select(ct => new ChiTietThanhVienNhomBackupDto
                    {
                        NhomId = ct.NhomId,
                        ThanhVienId = ct.ThanhVienId,
                        ChucVu = ct.ChucVu,
                        NgayThamGia = ct.NgayThamGia.HasValue ? ct.NgayThamGia.Value.ToString("yyyy-MM-dd") : null
                    })
                    .ToListAsync(cancellationToken);

                // Filter in memory
                chiTietThanhVienNhomDtos = chiTietThanhVienNhomDtos.Where(ct =>
                    !string.IsNullOrEmpty(ct.NgayThamGia) &&
                    DateTime.Parse(ct.NgayThamGia) >= startUtc.Date &&
                    DateTime.Parse(ct.NgayThamGia) <= endUtc.Date)
                    .ToList();

                // Backup DuAn (filter by NgayBd or NgayKt)
                var duAnDtos = await _context.DuAns
                    .AsNoTracking()
                    .Where(d => (d.NgayBd.HasValue || d.NgayKt.HasValue))
                    .Select(d => new DuAnBackupDto
                    {
                        DuAnId = d.DuAnId,
                        TenDuAn = d.TenDuAn,
                        MoTa = d.MoTa,
                        NgayBd = d.NgayBd.HasValue ? d.NgayBd.Value.ToString("yyyy-MM-dd") : null,
                        NgayKt = d.NgayKt.HasValue ? d.NgayKt.Value.ToString("yyyy-MM-dd") : null,
                        TrangThai = d.TrangThai,
                        AnhBia = d.AnhBia,
                        NhomId = d.NhomId,
                        LinhVucId = d.LinhVucId
                    })
                    .ToListAsync(cancellationToken);

                // Filter in memory
                duAnDtos = duAnDtos.Where(d =>
                    (!string.IsNullOrEmpty(d.NgayBd) && DateTime.Parse(d.NgayBd) >= startUtc.Date && DateTime.Parse(d.NgayBd) <= endUtc.Date) ||
                    (!string.IsNullOrEmpty(d.NgayKt) && DateTime.Parse(d.NgayKt) >= startUtc.Date && DateTime.Parse(d.NgayKt) <= endUtc.Date))
                    .ToList();

                // Backup CongViec (filter by NgayBd or NgayKt)
                var congViecDtos = await _context.CongViecs
                    .AsNoTracking()
                    .Where(cv => (cv.NgayBd.HasValue || cv.NgayKt.HasValue))
                    .Select(cv => new CongViecBackupDto
                    {
                        CongViecId = cv.CongViecId,
                        TenCongViec = cv.TenCongViec,
                        NgayBd = cv.NgayBd.HasValue ? cv.NgayBd.Value.ToString("yyyy-MM-dd") : null,
                        NgayKt = cv.NgayKt.HasValue ? cv.NgayKt.Value.ToString("yyyy-MM-dd") : null,
                        TrangThai = cv.TrangThai,
                        PhamTramHoanThanh = cv.PhamTramHoanThanh,
                        AnhBia = cv.AnhBia,
                        DuAnId = cv.DuAnId,
                        FileDinhKem = cv.FileDinhKem
                    })
                    .ToListAsync(cancellationToken);

                // Filter in memory
                congViecDtos = congViecDtos.Where(cv =>
                    (!string.IsNullOrEmpty(cv.NgayBd) && DateTime.Parse(cv.NgayBd) >= startUtc.Date && DateTime.Parse(cv.NgayBd) <= endUtc.Date) ||
                    (!string.IsNullOrEmpty(cv.NgayKt) && DateTime.Parse(cv.NgayKt) >= startUtc.Date && DateTime.Parse(cv.NgayKt) <= endUtc.Date))
                    .ToList();

                // Get related CongViecIds for PhanCong and BinhLuan
                var congViecIds = congViecDtos.Select(cv => cv.CongViecId).ToList();

                // Backup PhanCong (related to filtered CongViecs)
                var phanCongDtos = await _context.PhanCongs
                    .AsNoTracking()
                    .Where(pc => congViecIds.Contains(pc.CongViecId))
                    .Select(pc => new PhanCongBackupDto
                    {
                        CongViecId = pc.CongViecId,
                        ThanhVienId = pc.ThanhVienId,
                        NoiDungPhanCong = pc.NoiDungPhanCong
                    })
                    .ToListAsync(cancellationToken);

                // Backup BinhLuan (filter by NgayBinhLuan or NgayCapNhat)
                var binhLuanDtos = await _context.BinhLuans
                    .AsNoTracking()
                    .Where(bl => (bl.NgayBinhLuan >= startUtc && bl.NgayBinhLuan <= endUtc) ||
                                 (bl.NgayCapNhat.HasValue && bl.NgayCapNhat.Value >= startUtc && bl.NgayCapNhat.Value <= endUtc))
                    .Select(bl => new BinhLuanBackupDto
                    {
                        BinhLuanId = bl.BinhLuanId,
                        NoiDung = bl.NoiDung,
                        NgayBinhLuan = bl.NgayBinhLuan,
                        NgayCapNhat = bl.NgayCapNhat,
                        ThanhVienId = bl.ThanhVienId,
                        CongViecId = bl.CongViecId
                    })
                    .ToListAsync(cancellationToken);

                var backupPayload = new FullSystemBackupDto
                {
                    GeneratedAtUtc = DateTime.UtcNow,
                    ThanhViens = thanhVienDtos,
                    TaiKhoans = taiKhoanDtos,
                    Nhoms = nhomDtos,
                    ChiTietThanhVienNhoms = chiTietThanhVienNhomDtos,
                    DuAns = duAnDtos,
                    CongViecs = congViecDtos,
                    PhanCongs = phanCongDtos,
                    BinhLuans = binhLuanDtos
                };

                var json = JsonSerializer.Serialize(backupPayload, new JsonSerializerOptions
                {
                    WriteIndented = true
                });

                var encryptedBytes = EncryptBackupJson(json);
                var fileName = $"QuanLyNhom_Incremental_{parsedStartDate:yyyyMMdd}_to_{parsedEndDate:yyyyMMdd}_{DateTime.UtcNow:HHmmss}.json";
                return File(encryptedBytes, "application/octet-stream", fileName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi sao lưu incremental.");
                return StatusCode(StatusCodes.Status500InternalServerError, new
                {
                    message = "Có lỗi xảy ra khi sao lưu theo khoảng thời gian.",
                    error = ex.Message
                });
            }
        }

        // Restore toàn bộ hệ thống
        [HttpPost("restore/full-system")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> RestoreFullSystem(IFormFile? backupFile, CancellationToken cancellationToken)
        {
            if (backupFile == null || backupFile.Length == 0)
            {
                return BadRequest("Vui lòng tải lên file sao lưu hợp lệ.");
            }

            FullSystemBackupDto? payload;

            try
            {
                await using var stream = backupFile.OpenReadStream();
                using var ms = new MemoryStream();
                await stream.CopyToAsync(ms, cancellationToken);
                var rawBytes = ms.ToArray();

                string json;
                try
                {
                    // Thử giải mã (trường hợp file đã được mã hoá)
                    json = DecryptBackupJson(rawBytes);
                }
                catch (Exception decryptEx)
                {
                    _logger.LogWarning(decryptEx, "Giải mã file backup thất bại, thử đọc như JSON thuần.");
                    json = Encoding.UTF8.GetString(rawBytes);
                }

                payload = JsonSerializer.Deserialize<FullSystemBackupDto>(json, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
            }
            catch (JsonException jsonEx)
            {
                _logger.LogWarning(jsonEx, "Không thể phân tích file backup.");
                return BadRequest("Nội dung file backup không đúng định dạng JSON.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi đọc file backup.");
                return StatusCode(StatusCodes.Status500InternalServerError, new
                {
                    message = "Có lỗi xảy ra khi đọc file sao lưu.",
                    error = ex.Message
                });
            }

            if (payload == null)
            {
                return BadRequest("Dữ liệu trong file sao lưu trống hoặc không hợp lệ.");
            }

            await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

            try
            {
                // 1. Restore ThanhVien
                var existingThanhViens = await _context.ThanhViens
                    .AsTracking()
                    .ToDictionaryAsync(tv => tv.ThanhVienId, cancellationToken);

                var newThanhViens = new List<ThanhVien>();
                foreach (var dto in payload.ThanhViens)
                {
                    if (existingThanhViens.TryGetValue(dto.ThanhVienId, out var entity))
                    {
                        ApplyThanhVienUpdates(entity, dto);
                    }
                    else
                    {
                        newThanhViens.Add(CreateThanhVienEntity(dto));
                    }
                }
                if (existingThanhViens.Count > 0)
                {
                    await _context.SaveChangesAsync(cancellationToken);
                }
                if (newThanhViens.Count > 0)
                {
                    await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT [dbo].[ThanhVien] ON", cancellationToken);
                    _context.ThanhViens.AddRange(newThanhViens);
                    await _context.SaveChangesAsync(cancellationToken);
                    await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT [dbo].[ThanhVien] OFF", cancellationToken);
                }

                var validThanhVienIds = await _context.ThanhViens
                    .AsNoTracking()
                    .Select(tv => tv.ThanhVienId)
                    .ToListAsync(cancellationToken);
                var validThanhVienIdSet = validThanhVienIds.ToHashSet();

                // 2. Restore TaiKhoan
                var existingTaiKhoans = await _context.TaiKhoans
                    .AsTracking()
                    .ToDictionaryAsync(tk => tk.TaiKhoanId, cancellationToken);

                var newTaiKhoans = new List<TaiKhoan>();
                foreach (var dto in payload.TaiKhoans)
                {
                    if (dto.ThanhVienId.HasValue && !validThanhVienIdSet.Contains(dto.ThanhVienId.Value))
                    {
                        await transaction.RollbackAsync(cancellationToken);
                        return BadRequest($"Không tồn tại Thành viên với ID {dto.ThanhVienId} cho tài khoản {dto.TenTaiKhoan}.");
                    }

                    if (existingTaiKhoans.TryGetValue(dto.TaiKhoanId, out var entity))
                    {
                        ApplyTaiKhoanUpdates(entity, dto);
                    }
                    else
                    {
                        newTaiKhoans.Add(CreateTaiKhoanEntity(dto));
                    }
                }
                if (existingTaiKhoans.Count > 0)
                {
                    await _context.SaveChangesAsync(cancellationToken);
                }
                if (newTaiKhoans.Count > 0)
                {
                    await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT [dbo].[TaiKhoan] ON", cancellationToken);
                    _context.TaiKhoans.AddRange(newTaiKhoans);
                    await _context.SaveChangesAsync(cancellationToken);
                    await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT [dbo].[TaiKhoan] OFF", cancellationToken);
                }

                // 3. Restore Nhom
                var existingNhoms = await _context.Nhoms
                    .AsTracking()
                    .ToDictionaryAsync(n => n.NhomId, cancellationToken);

                var newNhoms = new List<Nhom>();
                foreach (var dto in payload.Nhoms)
                {
                    if (existingNhoms.TryGetValue(dto.NhomId, out var entity))
                    {
                        entity.TenNhom = dto.TenNhom;
                        entity.MoTa = dto.MoTa;
                        entity.SoLuongTv = dto.SoLuongTv;
                        entity.NgayLapNhom = !string.IsNullOrWhiteSpace(dto.NgayLapNhom) ? DateOnly.Parse(dto.NgayLapNhom) : null;
                        entity.NgayCapNhat = dto.NgayCapNhat;
                        entity.AnhBia = dto.AnhBia;
                    }
                    else
                    {
                        newNhoms.Add(new Nhom
                        {
                            NhomId = dto.NhomId,
                            TenNhom = dto.TenNhom,
                            MoTa = dto.MoTa,
                            SoLuongTv = dto.SoLuongTv,
                            NgayLapNhom = !string.IsNullOrWhiteSpace(dto.NgayLapNhom) ? DateOnly.Parse(dto.NgayLapNhom) : null,
                            NgayCapNhat = dto.NgayCapNhat,
                            AnhBia = dto.AnhBia
                        });
                    }
                }
                if (existingNhoms.Count > 0)
                {
                    await _context.SaveChangesAsync(cancellationToken);
                }
                if (newNhoms.Count > 0)
                {
                    await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT [dbo].[Nhom] ON", cancellationToken);
                    _context.Nhoms.AddRange(newNhoms);
                    await _context.SaveChangesAsync(cancellationToken);
                    await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT [dbo].[Nhom] OFF", cancellationToken);
                }

                var validNhomIds = await _context.Nhoms
                    .AsNoTracking()
                    .Select(n => n.NhomId)
                    .ToListAsync(cancellationToken);
                var validNhomIdSet = validNhomIds.ToHashSet();

                // 4. Restore ChiTietThanhVienNhom
                var existingChiTiet = await _context.ChiTietThanhVienNhoms
                    .AsTracking()
                    .ToDictionaryAsync(ct => (ct.NhomId, ct.ThanhVienId), cancellationToken);

                var newChiTiet = new List<ChiTietThanhVienNhom>();
                foreach (var dto in payload.ChiTietThanhVienNhoms)
                {
                    if (!validThanhVienIdSet.Contains(dto.ThanhVienId))
                    {
                        await transaction.RollbackAsync(cancellationToken);
                        return BadRequest($"Thành viên {dto.ThanhVienId} trong dữ liệu nhóm không tồn tại.");
                    }
                    if (!validNhomIdSet.Contains(dto.NhomId))
                    {
                        await transaction.RollbackAsync(cancellationToken);
                        return BadRequest($"Nhóm {dto.NhomId} không tồn tại.");
                    }

                    if (existingChiTiet.TryGetValue((dto.NhomId, dto.ThanhVienId), out var entity))
                    {
                        ApplyChiTietThanhVienNhomUpdates(entity, dto);
                    }
                    else
                    {
                        newChiTiet.Add(CreateChiTietThanhVienNhomEntity(dto));
                    }
                }
                if (existingChiTiet.Count > 0)
                {
                    await _context.SaveChangesAsync(cancellationToken);
                }
                if (newChiTiet.Count > 0)
                {
                    _context.ChiTietThanhVienNhoms.AddRange(newChiTiet);
                    await _context.SaveChangesAsync(cancellationToken);
                }

                // 5. Restore DuAn
                var existingDuAns = await _context.DuAns
                    .AsTracking()
                    .ToDictionaryAsync(d => d.DuAnId, cancellationToken);

                var newDuAns = new List<DuAn>();
                foreach (var dto in payload.DuAns)
                {
                    if (dto.NhomId.HasValue && !validNhomIdSet.Contains(dto.NhomId.Value))
                    {
                        await transaction.RollbackAsync(cancellationToken);
                        return BadRequest($"Dự án {dto.DuAnId} tham chiếu nhóm {dto.NhomId} không tồn tại.");
                    }

                    if (existingDuAns.TryGetValue(dto.DuAnId, out var entity))
                    {
                        entity.TenDuAn = dto.TenDuAn;
                        entity.MoTa = dto.MoTa;
                        entity.NgayBd = !string.IsNullOrWhiteSpace(dto.NgayBd) ? DateOnly.Parse(dto.NgayBd) : null;
                        entity.NgayKt = !string.IsNullOrWhiteSpace(dto.NgayKt) ? DateOnly.Parse(dto.NgayKt) : null;
                        entity.TrangThai = dto.TrangThai;
                        entity.AnhBia = dto.AnhBia;
                        entity.NhomId = dto.NhomId;
                        entity.LinhVucId = dto.LinhVucId;
                    }
                    else
                    {
                        newDuAns.Add(new DuAn
                        {
                            DuAnId = dto.DuAnId,
                            TenDuAn = dto.TenDuAn,
                            MoTa = dto.MoTa,
                            NgayBd = !string.IsNullOrWhiteSpace(dto.NgayBd) ? DateOnly.Parse(dto.NgayBd) : null,
                            NgayKt = !string.IsNullOrWhiteSpace(dto.NgayKt) ? DateOnly.Parse(dto.NgayKt) : null,
                            TrangThai = dto.TrangThai,
                            AnhBia = dto.AnhBia,
                            NhomId = dto.NhomId,
                            LinhVucId = dto.LinhVucId
                        });
                    }
                }
                if (existingDuAns.Count > 0)
                {
                    await _context.SaveChangesAsync(cancellationToken);
                }
                if (newDuAns.Count > 0)
                {
                    await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT [dbo].[DuAn] ON", cancellationToken);
                    _context.DuAns.AddRange(newDuAns);
                    await _context.SaveChangesAsync(cancellationToken);
                    await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT [dbo].[DuAn] OFF", cancellationToken);
                }

                var validDuAnIds = await _context.DuAns
                    .AsNoTracking()
                    .Select(d => d.DuAnId)
                    .ToListAsync(cancellationToken);
                var validDuAnIdSet = validDuAnIds.ToHashSet();

                // 6. Restore CongViec
                var existingCongViecs = await _context.CongViecs
                    .AsTracking()
                    .ToDictionaryAsync(cv => cv.CongViecId, cancellationToken);

                var newCongViecs = new List<CongViec>();
                foreach (var dto in payload.CongViecs)
                {
                    if (dto.DuAnId.HasValue && !validDuAnIdSet.Contains(dto.DuAnId.Value))
                    {
                        await transaction.RollbackAsync(cancellationToken);
                        return BadRequest($"Công việc {dto.CongViecId} tham chiếu dự án {dto.DuAnId} không tồn tại.");
                    }

                    if (existingCongViecs.TryGetValue(dto.CongViecId, out var entity))
                    {
                        entity.TenCongViec = dto.TenCongViec;
                        entity.NgayBd = !string.IsNullOrWhiteSpace(dto.NgayBd) ? DateOnly.Parse(dto.NgayBd) : null;
                        entity.NgayKt = !string.IsNullOrWhiteSpace(dto.NgayKt) ? DateOnly.Parse(dto.NgayKt) : null;
                        entity.TrangThai = dto.TrangThai;
                        entity.PhamTramHoanThanh = dto.PhamTramHoanThanh;
                        entity.AnhBia = dto.AnhBia;
                        entity.DuAnId = dto.DuAnId;
                        entity.FileDinhKem = dto.FileDinhKem;
                    }
                    else
                    {
                        newCongViecs.Add(new CongViec
                        {
                            CongViecId = dto.CongViecId,
                            TenCongViec = dto.TenCongViec,
                            NgayBd = !string.IsNullOrWhiteSpace(dto.NgayBd) ? DateOnly.Parse(dto.NgayBd) : null,
                            NgayKt = !string.IsNullOrWhiteSpace(dto.NgayKt) ? DateOnly.Parse(dto.NgayKt) : null,
                            TrangThai = dto.TrangThai,
                            PhamTramHoanThanh = dto.PhamTramHoanThanh,
                            AnhBia = dto.AnhBia,
                            DuAnId = dto.DuAnId,
                            FileDinhKem = dto.FileDinhKem
                        });
                    }
                }
                if (existingCongViecs.Count > 0)
                {
                    await _context.SaveChangesAsync(cancellationToken);
                }
                if (newCongViecs.Count > 0)
                {
                    await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT [dbo].[CongViec] ON", cancellationToken);
                    _context.CongViecs.AddRange(newCongViecs);
                    await _context.SaveChangesAsync(cancellationToken);
                    await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT [dbo].[CongViec] OFF", cancellationToken);
                }

                var validCongViecIds = await _context.CongViecs
                    .AsNoTracking()
                    .Select(cv => cv.CongViecId)
                    .ToListAsync(cancellationToken);
                var validCongViecIdSet = validCongViecIds.ToHashSet();

                // 7. Restore PhanCong
                var existingPhanCongs = await _context.PhanCongs
                    .AsTracking()
                    .ToDictionaryAsync(pc => (pc.CongViecId, pc.ThanhVienId), cancellationToken);

                var newPhanCongs = new List<PhanCong>();
                foreach (var dto in payload.PhanCongs)
                {
                    if (!validThanhVienIdSet.Contains(dto.ThanhVienId))
                    {
                        await transaction.RollbackAsync(cancellationToken);
                        return BadRequest($"Phân công cho thành viên {dto.ThanhVienId} không tồn tại.");
                    }
                    if (!validCongViecIdSet.Contains(dto.CongViecId))
                    {
                        await transaction.RollbackAsync(cancellationToken);
                        return BadRequest($"Phân công cho công việc {dto.CongViecId} không tồn tại.");
                    }

                    if (existingPhanCongs.TryGetValue((dto.CongViecId, dto.ThanhVienId), out var entity))
                    {
                        ApplyPhanCongUpdates(entity, dto);
                    }
                    else
                    {
                        newPhanCongs.Add(CreatePhanCongEntity(dto));
                    }
                }
                if (existingPhanCongs.Count > 0)
                {
                    await _context.SaveChangesAsync(cancellationToken);
                }
                if (newPhanCongs.Count > 0)
                {
                    _context.PhanCongs.AddRange(newPhanCongs);
                    await _context.SaveChangesAsync(cancellationToken);
                }

                // 8. Restore BinhLuan
                var existingBinhLuans = await _context.BinhLuans
                    .AsTracking()
                    .ToDictionaryAsync(bl => bl.BinhLuanId, cancellationToken);

                var newBinhLuans = new List<BinhLuan>();
                foreach (var dto in payload.BinhLuans)
                {
                    if (dto.ThanhVienId.HasValue && !validThanhVienIdSet.Contains(dto.ThanhVienId.Value))
                    {
                        await transaction.RollbackAsync(cancellationToken);
                        return BadRequest($"Bình luận {dto.BinhLuanId} tham chiếu thành viên {dto.ThanhVienId} không tồn tại.");
                    }
                    if (dto.CongViecId.HasValue && !validCongViecIdSet.Contains(dto.CongViecId.Value))
                    {
                        await transaction.RollbackAsync(cancellationToken);
                        return BadRequest($"Bình luận {dto.BinhLuanId} tham chiếu công việc {dto.CongViecId} không tồn tại.");
                    }

                    if (existingBinhLuans.TryGetValue(dto.BinhLuanId, out var entity))
                    {
                        ApplyBinhLuanUpdates(entity, dto);
                    }
                    else
                    {
                        newBinhLuans.Add(CreateBinhLuanEntity(dto));
                    }
                }
                if (existingBinhLuans.Count > 0)
                {
                    await _context.SaveChangesAsync(cancellationToken);
                }
                if (newBinhLuans.Count > 0)
                {
                    await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT [dbo].[BinhLuan] ON", cancellationToken);
                    _context.BinhLuans.AddRange(newBinhLuans);
                    await _context.SaveChangesAsync(cancellationToken);
                    await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT [dbo].[BinhLuan] OFF", cancellationToken);
                }

                await transaction.CommitAsync(cancellationToken);

                return Ok(new
                {
                    message = "Phục hồi toàn bộ hệ thống thành công.",
                    membersRestored = payload.ThanhViens.Count,
                    accountsRestored = payload.TaiKhoans.Count,
                    groupsRestored = payload.Nhoms.Count,
                    memberGroupsRestored = payload.ChiTietThanhVienNhoms.Count,
                    projectsRestored = payload.DuAns.Count,
                    tasksRestored = payload.CongViecs.Count,
                    assignmentsRestored = payload.PhanCongs.Count,
                    commentsRestored = payload.BinhLuans.Count
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                _logger.LogError(ex, "Lỗi khi phục hồi toàn bộ hệ thống.");
                return StatusCode(StatusCodes.Status500InternalServerError, new
                {
                    message = "Có lỗi xảy ra khi phục hồi toàn bộ hệ thống.",
                    error = ex.Message
                });
            }
        }

        private static void ApplyThanhVienUpdates(ThanhVien entity, ThanhVienBackupDto dto)
        {
            entity.HoTen = dto.HoTen;
            entity.GioiTinh = dto.GioiTinh;
            entity.NgaySinh = ParseNullableDateOnly(dto.NgaySinh);
            entity.MoTaBanThan = dto.MoTaBanThan;
            entity.Sdt = dto.Sdt;
            entity.DiaChi = dto.DiaChi;
            entity.ChuyenMonId = dto.ChuyenMonId;
            entity.AnhBia = dto.AnhBia;
        }

        private static ThanhVien CreateThanhVienEntity(ThanhVienBackupDto dto)
        {
            return new ThanhVien
            {
                ThanhVienId = dto.ThanhVienId,
                HoTen = dto.HoTen,
                GioiTinh = dto.GioiTinh,
                NgaySinh = ParseNullableDateOnly(dto.NgaySinh),
                MoTaBanThan = dto.MoTaBanThan,
                Sdt = dto.Sdt,
                DiaChi = dto.DiaChi,
                ChuyenMonId = dto.ChuyenMonId,
                AnhBia = dto.AnhBia
            };
        }

        private static void ApplyTaiKhoanUpdates(TaiKhoan entity, TaiKhoanBackupDto dto)
        {
            entity.TenTaiKhoan = dto.TenTaiKhoan;
            entity.Email = dto.Email;
            entity.MatKhau = dto.MatKhau;
            entity.NgayTao = dto.NgayTao;
            entity.TrangThai = dto.TrangThai;
            entity.LoaiTaiKhoan = dto.LoaiTaiKhoan;
            entity.LanDangNhapGanNhat = dto.LanDangNhapGanNhat;
            entity.ThanhVienId = dto.ThanhVienId;
            entity.QuyenId = dto.QuyenId;
        }

        private static TaiKhoan CreateTaiKhoanEntity(TaiKhoanBackupDto dto)
        {
            return new TaiKhoan
            {
                TaiKhoanId = dto.TaiKhoanId,
                TenTaiKhoan = dto.TenTaiKhoan,
                Email = dto.Email,
                MatKhau = dto.MatKhau,
                NgayTao = dto.NgayTao,
                TrangThai = dto.TrangThai,
                LoaiTaiKhoan = dto.LoaiTaiKhoan,
                LanDangNhapGanNhat = dto.LanDangNhapGanNhat,
                ThanhVienId = dto.ThanhVienId,
                QuyenId = dto.QuyenId
            };
        }

        private static void ApplyChiTietThanhVienNhomUpdates(ChiTietThanhVienNhom entity, ChiTietThanhVienNhomBackupDto dto)
        {
            entity.ChucVu = dto.ChucVu;
            entity.NgayThamGia = ParseNullableDateOnly(dto.NgayThamGia);
        }

        private static ChiTietThanhVienNhom CreateChiTietThanhVienNhomEntity(ChiTietThanhVienNhomBackupDto dto)
        {
            return new ChiTietThanhVienNhom
            {
                NhomId = dto.NhomId,
                ThanhVienId = dto.ThanhVienId,
                ChucVu = dto.ChucVu,
                NgayThamGia = ParseNullableDateOnly(dto.NgayThamGia)
            };
        }

        private static void ApplyBinhLuanUpdates(BinhLuan entity, BinhLuanBackupDto dto)
        {
            entity.NoiDung = dto.NoiDung;
            entity.NgayBinhLuan = dto.NgayBinhLuan;
            entity.NgayCapNhat = dto.NgayCapNhat;
            entity.ThanhVienId = dto.ThanhVienId;
            entity.CongViecId = dto.CongViecId;
        }

        private static BinhLuan CreateBinhLuanEntity(BinhLuanBackupDto dto)
        {
            return new BinhLuan
            {
                BinhLuanId = dto.BinhLuanId,
                NoiDung = dto.NoiDung,
                NgayBinhLuan = dto.NgayBinhLuan,
                NgayCapNhat = dto.NgayCapNhat,
                ThanhVienId = dto.ThanhVienId,
                CongViecId = dto.CongViecId
            };
        }

        private static void ApplyPhanCongUpdates(PhanCong entity, PhanCongBackupDto dto)
        {
            entity.NoiDungPhanCong = dto.NoiDungPhanCong;
        }

        private static PhanCong CreatePhanCongEntity(PhanCongBackupDto dto)
        {
            return new PhanCong
            {
                CongViecId = dto.CongViecId,
                ThanhVienId = dto.ThanhVienId,
                NoiDungPhanCong = dto.NoiDungPhanCong
            };
        }

        private static void ApplyDuAnUpdates(DuAn entity, ProjectInfoBackupDto dto)
        {
            entity.TenDuAn = dto.TenDuAn ?? entity.TenDuAn;
            entity.MoTa = dto.MoTa;
            entity.TrangThai = dto.TrangThai ?? entity.TrangThai;
            entity.AnhBia = dto.AnhBia;
            entity.NgayBd = ParseNullableDateOnly(dto.NgayBatDau);
            entity.NgayKt = ParseNullableDateOnly(dto.NgayKetThuc);
            entity.NhomId = dto.NhomId;
            entity.LinhVucId = dto.LinhVucId;
        }

        private static DuAn CreateDuAnEntity(ProjectInfoBackupDto dto)
        {
            return new DuAn
            {
                DuAnId = dto.DuAnId,
                TenDuAn = dto.TenDuAn ?? string.Empty,
                MoTa = dto.MoTa,
                TrangThai = dto.TrangThai,
                AnhBia = dto.AnhBia,
                NgayBd = ParseNullableDateOnly(dto.NgayBatDau),
                NgayKt = ParseNullableDateOnly(dto.NgayKetThuc),
                NhomId = dto.NhomId,
                LinhVucId = dto.LinhVucId
            };
        }

        private static void ApplyCongViecUpdates(CongViec entity, ProjectTaskBackupDto dto, int duAnId)
        {
            entity.TenCongViec = dto.TenCongViec ?? entity.TenCongViec;
            entity.TrangThai = dto.TrangThai;
            entity.PhamTramHoanThanh = dto.PhanTramHoanThanh;
            entity.NgayBd = ParseNullableDateOnly(dto.NgayBatDau);
            entity.NgayKt = ParseNullableDateOnly(dto.NgayKetThuc);
            entity.AnhBia = dto.AnhBia;
            entity.FileDinhKem = dto.FileDinhKem;
            entity.DuAnId = duAnId;
        }

        private static CongViec CreateCongViecEntity(ProjectTaskBackupDto dto, int duAnId)
        {
            return new CongViec
            {
                CongViecId = dto.CongViecId,
                TenCongViec = dto.TenCongViec ?? string.Empty,
                TrangThai = dto.TrangThai,
                PhamTramHoanThanh = dto.PhanTramHoanThanh,
                NgayBd = ParseNullableDateOnly(dto.NgayBatDau),
                NgayKt = ParseNullableDateOnly(dto.NgayKetThuc),
                AnhBia = dto.AnhBia,
                FileDinhKem = dto.FileDinhKem,
                DuAnId = duAnId
            };
        }

        private static DateOnly? ParseNullableDateOnly(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            return DateOnly.TryParse(value, out var result) ? result : null;
        }

        private async Task RemoveExistingProjectDataAsync(int duAnId, CancellationToken cancellationToken)
        {
            var existingTasks = await _context.CongViecs
                .Where(cv => cv.DuAnId == duAnId)
                .ToListAsync(cancellationToken);

            if (existingTasks.Count > 0)
            {
                var taskIds = existingTasks.Select(cv => cv.CongViecId).ToList();

                var comments = await _context.BinhLuans
                    .Where(bl => taskIds.Contains(bl.CongViecId ?? 0))
                    .ToListAsync(cancellationToken);

                if (comments.Count > 0)
                {
                    _context.BinhLuans.RemoveRange(comments);
                }

                var assignments = await _context.PhanCongs
                    .Where(pc => taskIds.Contains(pc.CongViecId))
                    .ToListAsync(cancellationToken);

                if (assignments.Count > 0)
                {
                    _context.PhanCongs.RemoveRange(assignments);
                }

                _context.CongViecs.RemoveRange(existingTasks);
            }

            var existingProject = await _context.DuAns
                .FirstOrDefaultAsync(da => da.DuAnId == duAnId, cancellationToken);

            if (existingProject != null)
            {
                _context.DuAns.Remove(existingProject);
                await _context.SaveChangesAsync(cancellationToken);
            }
        }

        private async Task<AssignmentTransferResult> TransferAssignmentsToGroupLeaderAsync(int thanhVienId, CancellationToken cancellationToken)
        {
            var assignments = await _context.PhanCongs
                .Include(pc => pc.CongViec)
                    .ThenInclude(cv => cv.DuAn)
                .Where(pc => pc.ThanhVienId == thanhVienId)
                .ToListAsync(cancellationToken);

            if (assignments.Count == 0)
            {
                return AssignmentTransferResult.CreateSuccess();
            }

            var groupIds = assignments
                .Select(pc => pc.CongViec?.DuAn?.NhomId)
                .Where(id => id.HasValue)
                .Select(id => id.Value)
                .Distinct()
                .ToList();

            if (groupIds.Count == 0)
            {
                return AssignmentTransferResult.CreateSuccess();
            }

            var leaders = await _context.ChiTietThanhVienNhoms
                .AsNoTracking()
                .Where(ct => groupIds.Contains(ct.NhomId) && ct.ChucVu != null)
                .ToListAsync(cancellationToken);

            var leaderByGroup = leaders
                .Where(ct => string.Equals(ct.ChucVu, "Trưởng nhóm", StringComparison.OrdinalIgnoreCase))
                .ToDictionary(ct => ct.NhomId, ct => ct.ThanhVienId);

            foreach (var groupId in groupIds)
            {
                if (!leaderByGroup.ContainsKey(groupId))
                {
                    return AssignmentTransferResult.CreateFailure($"Không tìm thấy trưởng nhóm cho nhóm ID {groupId}.");
                }

                if (leaderByGroup[groupId] == thanhVienId)
                {
                    return AssignmentTransferResult.CreateFailure("Không thể chuyển phân công khi thành viên đang là trưởng nhóm. Vui lòng chuyển quyền trưởng nhóm trước.");
                }
            }

            var leaderIds = leaderByGroup.Values.Distinct().ToList();
            var taskIds = assignments.Select(pc => pc.CongViecId).Distinct().ToList();

            var leaderAssignments = await _context.PhanCongs
                .Where(pc => leaderIds.Contains(pc.ThanhVienId) && taskIds.Contains(pc.CongViecId))
                .ToDictionaryAsync(pc => (pc.CongViecId, pc.ThanhVienId), cancellationToken);

            foreach (var assignment in assignments)
            {
                var congViec = assignment.CongViec;
                var duAn = congViec?.DuAn;

                if (duAn == null || !duAn.NhomId.HasValue)
                {
                    _context.PhanCongs.Remove(assignment);
                    continue;
                }

                var groupId = duAn.NhomId.Value;
                var leaderId = leaderByGroup[groupId];

                if (leaderAssignments.TryGetValue((assignment.CongViecId, leaderId), out var leaderAssignment))
                {
                    leaderAssignment.NoiDungPhanCong = MergeAssignmentContents(new[]
                    {
                        leaderAssignment.NoiDungPhanCong,
                        assignment.NoiDungPhanCong
                    });
                }
                else
                {
                    var reassigned = new PhanCong
                    {
                        CongViecId = assignment.CongViecId,
                        ThanhVienId = leaderId,
                        NoiDungPhanCong = assignment.NoiDungPhanCong
                    };

                    _context.PhanCongs.Add(reassigned);
                    leaderAssignments[(assignment.CongViecId, leaderId)] = reassigned;
                }

                _context.PhanCongs.Remove(assignment);
            }

            return AssignmentTransferResult.CreateSuccess();
        }

        private class AssignmentTransferResult
        {
            public bool Success { get; init; }

            public string? ErrorMessage { get; init; }

            public static AssignmentTransferResult CreateSuccess() => new()
            {
                Success = true
            };

            public static AssignmentTransferResult CreateFailure(string message) => new()
            {
                Success = false,
                ErrorMessage = message
            };
        }

        private static string? MergeAssignmentContents(IEnumerable<string?> contents)
        {
            var aggregatedItems = new List<PhanCongItemRequest>();
            string? fallbackContent = null;

            foreach (var content in contents)
            {
                if (string.IsNullOrWhiteSpace(content))
                {
                    continue;
                }

                fallbackContent = content;

                try
                {
                    var items = JsonSerializer.Deserialize<List<PhanCongItemRequest>>(content);
                    if (items != null && items.Count > 0)
                    {
                        aggregatedItems.AddRange(items);
                    }
                }
                catch
                {
                    // Nếu không parse được thì giữ lại nội dung fallback.
                }
            }

            if (aggregatedItems.Count > 0)
            {
                return JsonSerializer.Serialize(aggregatedItems);
            }

            return fallbackContent;
        }

        public class AccountsBackupDto
        {
            public DateTime GeneratedAtUtc { get; set; }

            public List<ThanhVienBackupDto> ThanhViens { get; set; } = new();

            public List<TaiKhoanBackupDto> TaiKhoans { get; set; } = new();

            public List<ChiTietThanhVienNhomBackupDto> ChiTietThanhVienNhoms { get; set; } = new();

            public List<BinhLuanBackupDto> BinhLuans { get; set; } = new();

            public List<PhanCongBackupDto> PhanCongs { get; set; } = new();
        }

        public class ThanhVienBackupDto
        {
            public int ThanhVienId { get; set; }

            public string? HoTen { get; set; }

            public string? GioiTinh { get; set; }

            public string? NgaySinh { get; set; }

            public string? MoTaBanThan { get; set; }

            public string? Sdt { get; set; }

            public string? DiaChi { get; set; }

            public int? ChuyenMonId { get; set; }

            public string? AnhBia { get; set; }
        }

        public class TaiKhoanBackupDto
        {
            public int TaiKhoanId { get; set; }

            public string? TenTaiKhoan { get; set; }

            public string? Email { get; set; }

            public string? MatKhau { get; set; }

            public DateTime? NgayTao { get; set; }

            public bool? TrangThai { get; set; }

            public string? LoaiTaiKhoan { get; set; }

            public DateTime? LanDangNhapGanNhat { get; set; }

            public int? ThanhVienId { get; set; }

            public int? QuyenId { get; set; }
        }

        public class ChiTietThanhVienNhomBackupDto
        {
            public int NhomId { get; set; }

            public int ThanhVienId { get; set; }

            public string? ChucVu { get; set; }

            public string? NgayThamGia { get; set; }
        }

        public class BinhLuanBackupDto
        {
            public int BinhLuanId { get; set; }

            public string? NoiDung { get; set; }

            public DateTime? NgayBinhLuan { get; set; }

            public DateTime? NgayCapNhat { get; set; }

            public int? ThanhVienId { get; set; }

            public int? CongViecId { get; set; }
        }

        public class PhanCongBackupDto
        {
            public int CongViecId { get; set; }

            public int ThanhVienId { get; set; }

            public string? NoiDungPhanCong { get; set; }
        }

        public class PartialProjectBackupRequest
        {
            public int DuAnId { get; set; }

            public DateTime? Since { get; set; }
        }

        public class PartialAccountsBackupRequest
        {
            public DateTime? Since { get; set; }
        }

        public class ProjectBackupDto
        {
            public DateTime GeneratedAtUtc { get; set; }

            public ProjectInfoBackupDto Project { get; set; } = new();

            public List<ProjectTaskBackupDto> Tasks { get; set; } = new();
        }

        public class ProjectInfoBackupDto
        {
            public int DuAnId { get; set; }

            public string? TenDuAn { get; set; }

            public string? MoTa { get; set; }

            public string? TrangThai { get; set; }

            public string? AnhBia { get; set; }

            public int? NhomId { get; set; }

            public int? LinhVucId { get; set; }

            public string? NgayBatDau { get; set; }

            public string? NgayKetThuc { get; set; }
        }

        public class ProjectTaskBackupDto
        {
            public int CongViecId { get; set; }

            public string? TenCongViec { get; set; }

            public string? TrangThai { get; set; }

            public double? PhanTramHoanThanh { get; set; }

            public string? NgayBatDau { get; set; }

            public string? NgayKetThuc { get; set; }

            public string? AnhBia { get; set; }

            public string? FileDinhKem { get; set; }

            public List<BinhLuanBackupDto>? BinhLuans { get; set; } = new();

            public List<PhanCongBackupDto>? PhanCongs { get; set; } = new();
        }

        public class RecoveryNotificationRequest
        {
            public string TenTaiKhoan { get; set; } = string.Empty;

            public string HoTen { get; set; } = string.Empty;

            public string EmailThayThe { get; set; } = string.Empty;

            public string? EmailGanDay { get; set; }

            public string? SoDienThoaiGanDay { get; set; }

            public DateTime? NgaySinh { get; set; }

            public string? GioiTinh { get; set; }

            public string? DiaChiGanDay { get; set; }

            public string? GhiChuBoSung { get; set; }
        }

        public class RecoveryNotificationCacheItem : RecoveryNotificationRequest
        {
            public string NotificationId { get; set; } = string.Empty;

            public DateTime CreatedAt { get; set; }
        }

        public class ChangeEmailByAdminRequest
        {
            public string NewEmail { get; set; } = string.Empty;
        }

        public class CreateAccountByAdminRequest
        {
            public string TenTaiKhoan { get; set; } = string.Empty;
            public string Email { get; set; } = string.Empty;
            public string? HoTen { get; set; }
            public string? GioiTinh { get; set; }
            public string? Sdt { get; set; }
            public string? DiaChi { get; set; }
            public int? ChuyenMonId { get; set; }
            public int? QuyenId { get; set; } // Quyền của tài khoản (không được là Admin - QuyenId = 1)
        }

        // DTOs cho Full System Backup
        public class FullSystemBackupDto
        {
            public DateTime GeneratedAtUtc { get; set; }
            public List<ThanhVienBackupDto> ThanhViens { get; set; } = new();
            public List<TaiKhoanBackupDto> TaiKhoans { get; set; } = new();
            public List<NhomBackupDto> Nhoms { get; set; } = new();
            public List<ChiTietThanhVienNhomBackupDto> ChiTietThanhVienNhoms { get; set; } = new();
            public List<DuAnBackupDto> DuAns { get; set; } = new();
            public List<CongViecBackupDto> CongViecs { get; set; } = new();
            public List<PhanCongBackupDto> PhanCongs { get; set; } = new();
            public List<BinhLuanBackupDto> BinhLuans { get; set; } = new();
        }

        public class NhomBackupDto
        {
            public int NhomId { get; set; }
            public string? TenNhom { get; set; }
            public string? MoTa { get; set; }
            public int? SoLuongTv { get; set; }
            public string? NgayLapNhom { get; set; }
            public DateTime? NgayCapNhat { get; set; }
            public string? AnhBia { get; set; }
        }

        public class DuAnBackupDto
        {
            public int DuAnId { get; set; }
            public string TenDuAn { get; set; } = null!;
            public string? MoTa { get; set; }
            public string? NgayBd { get; set; }
            public string? NgayKt { get; set; }
            public string? TrangThai { get; set; }
            public string? AnhBia { get; set; }
            public int? NhomId { get; set; }
            public int? LinhVucId { get; set; }
        }

        public class CongViecBackupDto
        {
            public int CongViecId { get; set; }
            public string TenCongViec { get; set; } = null!;
            public string? NgayBd { get; set; }
            public string? NgayKt { get; set; }
            public string? TrangThai { get; set; }
            public double? PhamTramHoanThanh { get; set; }
            public string? AnhBia { get; set; }
            public int? DuAnId { get; set; }
            public string? FileDinhKem { get; set; }
        }
    }
}
