using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Org.BouncyCastle.Crypto.Generators;
using ServerQuanLyNhom.DTOs.Auths;
using ServerQuanLyNhom.Models;
using ServerQuanLyNhom.Services;
using ServerQuanLyNhom.Services.Email;
using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using BCrypt.Net;


namespace ServerQuanLyNhom.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly QuanLyCongViecNhomContext _context;
        private readonly OtpService _otpService;
        private readonly EmailService _emailService;
        private readonly IMemoryCache _cache;

        public AuthController(QuanLyCongViecNhomContext context, OtpService otpService, EmailService emailService, IMemoryCache cache)
        {
            _context = context;
            _otpService = otpService;
            _emailService = emailService;
            _cache = cache;
        }

        // Thay thế SHA256 bằng BCrypt để tăng cường bảo mật mật khẩu
        private string HashPassword(string password)
        {
            return BCrypt.Net.BCrypt.HashPassword(password);
        }

        // Đăng nhập thường
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            if (string.IsNullOrEmpty(request.TenTaiKhoan) || string.IsNullOrEmpty(request.Password))
                return BadRequest("Tên tài khoản và mật khẩu không được để trống");

            // Tìm user trong database (bao gồm cả mixed accounts)
            var account = await _context.TaiKhoans
                .Include(t => t.ThanhVien)
                    .ThenInclude(tv => tv.ChuyenMon)
                .FirstOrDefaultAsync(t => t.TenTaiKhoan == request.TenTaiKhoan);

            if (account == null)
                return Unauthorized("Tên tài khoản hoặc mật khẩu không đúng");

            // Đối với tài khoản local, xác thực mật khẩu bằng BCrypt
            // Tài khoản OAuth không có mật khẩu để kiểm tra
            if (
                !BCrypt.Net.BCrypt.Verify(request.Password, account.MatKhau))
            {
                return Unauthorized("Sai mật khẩu");
            }

            if (account.TrangThai == false)
            {
                return Unauthorized("Tài khoản của bạn đã bị khoá");
            }

            // Cập nhật lần đăng nhập gần nhất
            account.LanDangNhapGanNhat = DateTime.Now;
            await _context.SaveChangesAsync();

            // Lấy thông tin quyền
            var quyen = await _context.Quyens
                .Where(q => q.QuyenId == account.QuyenId)
                .FirstOrDefaultAsync();

            // Trả về thông tin user
            return Ok(new
            {
                success = true,
                user = new
                {
                    taiKhoanId = account.TaiKhoanId,
                    thanhVienId = account.ThanhVienId,
                    tenTaiKhoa = account.TenTaiKhoan,
                    email = account.Email,
                    hoTen = account.ThanhVien.HoTen,
                    gioiTinh = account.ThanhVien.GioiTinh,
                    ngaySinh = account.ThanhVien.NgaySinh,
                    moTaBanThan = account.ThanhVien.MoTaBanThan,
                    sdt = account.ThanhVien.Sdt,
                    diaChi = account.ThanhVien.DiaChi,
                    loaiTaiKhoan = account.LoaiTaiKhoan,
                    trangThai = account.TrangThai,
                    chuyenMonId = account.ThanhVien.ChuyenMonId,
                    tenChuyenMon = account.ThanhVien.ChuyenMon?.TenChuyenMon,
                    anhBia = account.ThanhVien?.AnhBia,
                    quyenId = account.QuyenId,
                    tenQuyen = quyen?.TenQuyen
                }
            });
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            // Endpoint này đã bị vô hiệu hóa - chỉ admin mới có thể tạo tài khoản
            return StatusCode(403, new { message = "Đăng ký tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên để được tạo tài khoản." });
        }

        [HttpPost("verify-otp")]
        public async Task<IActionResult> VerifyOtp([FromBody] VerifyOtpRequest request)
        {

            var email = request.Email;
            var otp = request.Otp;
            var purpose = request.Purpose ?? "register";

            // Kiểm tra OTP trước
            if (!_otpService.VerifyOtp(email, otp, purpose))
                return BadRequest("OTP không đúng hoặc đã hết hạn.");

            if (purpose == "register")
            {
                // Sau khi OTP đúng, kiểm tra thông tin đăng ký
                if (!_cache.TryGetValue<RegisterRequest>($"pending_{email}", out var pendingUser))
                {
                    Console.WriteLine($"Cache miss for pending_{email}");
                    return BadRequest("Không tìm thấy thông tin đăng ký. Vui lòng đăng ký lại.");
                }

                // Tạo người dùng trước
                var nguoiDung = new ThanhVien
                {
                    HoTen = pendingUser.FullName
                };

                _context.ThanhViens.Add(nguoiDung);
                await _context.SaveChangesAsync(); // Lưu để lấy NguoiDungId

                // Tạo tài khoản với NguoiDungId
                var taiKhoan = new TaiKhoan
                {
                    ThanhVienId = nguoiDung.ThanhVienId,
                    TenTaiKhoan = pendingUser.UserName,
                    Email = pendingUser.Email,
                    MatKhau = HashPassword(pendingUser.Password),
                    NgayTao = DateTime.Now,
                    TrangThai = true,
                    LoaiTaiKhoan = "local",
                    QuyenId = _context.Quyens
                                .Where(q => q.TenQuyen == "User")
                                .Select(q => q.QuyenId)
                                .FirstOrDefault()
                };

                _context.TaiKhoans.Add(taiKhoan);
                await _context.SaveChangesAsync();

                _cache.Remove($"pending_{email}");

                return Ok(new
                {
                    message = "Đăng ký thành công!",
                    success = true,
                    user = new
                    {
                        taiKhoanId = taiKhoan.TaiKhoanId,
                        nguoiDungId = nguoiDung.ThanhVienId,
                        tenTaiKhoan = taiKhoan.TenTaiKhoan,
                        email = taiKhoan.Email,
                        hoTen = nguoiDung.HoTen
                    }
                });
            }
            else if (purpose == "forgot-password")
            {
                // Kiểm tra forgot password session
                if (!_cache.TryGetValue($"forgot_{email}", out var forgotSession))
                {
                    Console.WriteLine($"Forgot password session not found for {email}");
                    return BadRequest("Phiên đặt lại mật khẩu đã hết hạn. Vui lòng thử lại!");
                }

                Console.WriteLine($"Forgot password OTP verified successfully for {email}");
                return Ok(new
                {
                    message = "OTP xác thực thành công! Bạn có thể đặt lại mật khẩu.",
                    success = true
                });
            }

            return BadRequest("Mục đích OTP không hợp lệ!");
        }

        [HttpPost("resend-otp")]
        public async Task<IActionResult> ResendOtp([FromBody] ResendOtpRequest request)
        {
            var email = request.Email;
            var purpose = request.Purpose?.ToLower() ?? "register";

            if (string.IsNullOrEmpty(email))
                return BadRequest("Email không được để trống.");

            if (purpose != "register" && purpose != "forgot-password")
                return BadRequest("Mục đích gửi lại OTP không hợp lệ.");

            // Kiểm tra session tương ứng trong cache
            var cacheKey = purpose == "register" ? $"pending_{email}" : $"forgot_{email}";
            var exists = _cache.TryGetValue(cacheKey, out _);

            if (!exists)
                return BadRequest(purpose == "register"
                    ? "Không tìm thấy thông tin đăng ký, vui lòng đăng ký lại."
                    : "Không tìm thấy phiên quên mật khẩu, vui lòng thử lại!");

            if (!_otpService.CanResend(email, purpose))
                return BadRequest("Bạn đã vượt quá số lần gửi lại OTP, vui lòng thử lại sau.");

            // Sinh OTP mới
            var otp = _otpService.GenerateOtp(email, purpose);

            // Gửi email OTP theo mục đích
            if (purpose == "register")
            {
                await _emailService.SendEmailAsync(email, "Xác thực đăng ký - OTP mới",
                    $"Mã OTP mới của bạn là: {otp}");
            }
            else if (purpose == "forgot-password")
            {
                await _emailService.SendEmailAsync(email, "Đặt lại mật khẩu - OTP mới",
                    $"Mã OTP mới để đặt lại mật khẩu của bạn là: {otp}");
            }

            Console.WriteLine($"Resent {purpose} OTP {otp} to {email}");

            return Ok($"OTP mới đã được gửi tới email ({purpose}).");
        }



        [HttpPost("forgot-password")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
        {
            var email = request.Email;

            // Kiểm tra email có tồn tại không (bao gồm cả mixed accounts)
            var user = await _context.TaiKhoans.FirstOrDefaultAsync(u => u.Email == email);
            if (user == null)
                return BadRequest("Email không tồn tại trong hệ thống!");

            // Sinh OTP cho forgot password
            var otp = _otpService.GenerateOtp(email, "forgot-password");

            // Lưu thông tin forgot password vào cache
            _cache.Set($"forgot_{email}", new { email, timestamp = DateTime.UtcNow }, TimeSpan.FromMinutes(15));
            Console.WriteLine($"Set forgot password session for {email}");

            // Gửi email OTP
            await _emailService.SendEmailAsync(email, "Đặt lại mật khẩu", $"Mã OTP để đặt lại mật khẩu của bạn là: {otp}");

            Console.WriteLine($"Sent forgot password OTP {otp} to {email}");

            return Ok(new { message = "OTP đã được gửi tới email để đặt lại mật khẩu!", success = true });
        }

        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
        {
            var email = request.Email;
            var newPassword = request.NewPassword;
            // Kiểm tra forgot password session
            if (!_cache.TryGetValue($"forgot_{email}", out var forgotSession))
                return BadRequest("Phiên đặt lại mật khẩu đã hết hạn. Vui lòng thử lại!");

            // Tìm user (bao gồm cả mixed accounts)
            var user = await _context.TaiKhoans.FirstOrDefaultAsync(u => u.Email == email);
            if (user == null)
                return BadRequest("Email không tồn tại!");

            // Cập nhật mật khẩu mới
            user.MatKhau = HashPassword(newPassword);
            await _context.SaveChangesAsync();
            // Xóa forgot password session
            _cache.Remove($"forgot_{email}");

            Console.WriteLine($"Password reset successfully for {email}");

            return Ok(new { message = "Đặt lại mật khẩu thành công!", success = true });
        }

        // OAuth Login - không lưu vào ExternalLogin nữa
        [HttpPost("oauth-login")]
        public async Task<IActionResult> OAuthLogin([FromBody] OAuthLoginRequest request)
        {
            Console.WriteLine($"OAuth login request: Email={request.Email}, Provider={request.Provider}, Name={request.Name}");

            if (string.IsNullOrEmpty(request.Email) || string.IsNullOrEmpty(request.Provider))
                return BadRequest("Email và Provider không được để trống");

            try
            {
                // Kiểm tra tất cả các tài khoản với email này
                var allAccountsWithEmail = await _context.TaiKhoans
                    .Include(t => t.ThanhVien)
                        .ThenInclude(tv => tv.ChuyenMon)
                    .Where(t => t.Email.ToLower() == request.Email.ToLower())
                    .ToListAsync();

                Console.WriteLine($"Found {allAccountsWithEmail.Count} accounts with email {request.Email}");

                // Kiểm tra xem đã có tài khoản OAuth với provider này chưa
                var existingOAuthAccount = allAccountsWithEmail
                    .FirstOrDefault(t => t.LoaiTaiKhoan.ToLower() == request.Provider.ToLower() ||
                                        t.LoaiTaiKhoan.ToLower().Contains(request.Provider.ToLower()));

                if (existingOAuthAccount != null)
                {
                    Console.WriteLine($"Found existing OAuth account for {request.Email} with provider {request.Provider}");
                    // Đã có tài khoản OAuth này -> đăng nhập
                    existingOAuthAccount.LanDangNhapGanNhat = DateTime.Now;
                    await _context.SaveChangesAsync();

                    return Ok(new
                    {
                        success = true,
                        user = new
                        {
                            taiKhoanId = existingOAuthAccount.TaiKhoanId,
                            thanhVienId = existingOAuthAccount.ThanhVienId,
                            email = existingOAuthAccount.Email,
                            hoTen = existingOAuthAccount.ThanhVien.HoTen,
                            gioiTinh = existingOAuthAccount.ThanhVien.GioiTinh,
                            ngaySinh = existingOAuthAccount.ThanhVien.NgaySinh,
                            moTaBanThan = existingOAuthAccount.ThanhVien.MoTaBanThan,
                            sdt = existingOAuthAccount.ThanhVien.Sdt,
                            diaChi = existingOAuthAccount.ThanhVien.DiaChi,
                            loaiTaiKhoan = existingOAuthAccount.LoaiTaiKhoan,
                            trangThai = existingOAuthAccount.TrangThai,
                            chuyenMonId = existingOAuthAccount.ThanhVien.ChuyenMonId,
                            tenChuyenMon = existingOAuthAccount.ThanhVien.ChuyenMon?.TenChuyenMon
                        }
                    });
                }

                // Kiểm tra xem có tài khoản local không
                var localAccount = allAccountsWithEmail
                    .FirstOrDefault(t => t.LoaiTaiKhoan.ToLower() == "local");

                if (localAccount != null)
                {
                    Console.WriteLine($"Found existing local account for {request.Email}, linking with OAuth");

                    // Thay vì tạo account mới, update existing account để support OAuth
                    // Đánh dấu account này có thể login bằng cả email và OAuth
                    localAccount.LoaiTaiKhoan = $"local+{request.Provider.ToLower()}"; // e.g., "local+google"
                    localAccount.LanDangNhapGanNhat = DateTime.Now;

                    await _context.SaveChangesAsync();

                    return Ok(new
                    {
                        success = true,
                        user = new
                        {
                            taiKhoanId = localAccount.TaiKhoanId,
                            thanhVienId = localAccount.ThanhVienId,
                            email = localAccount.Email,
                            hoTen = localAccount.ThanhVien.HoTen,
                            gioiTinh = localAccount.ThanhVien.GioiTinh,
                            ngaySinh = localAccount.ThanhVien.NgaySinh,
                            moTaBanThan = localAccount.ThanhVien.MoTaBanThan,
                            sdt = localAccount.ThanhVien.Sdt,
                            diaChi = localAccount.ThanhVien.DiaChi,
                            loaiTaiKhoan = localAccount.LoaiTaiKhoan,
                            trangThai = localAccount.TrangThai,
                            chuyenMonId = localAccount.ThanhVien.ChuyenMonId,
                            tenChuyenMon = localAccount.ThanhVien.ChuyenMon?.TenChuyenMon
                        }
                    });
                }

                // Chưa có tài khoản nào -> tạo mới cả NguoiDung và TaiKhoan
                Console.WriteLine($"Creating new account for {request.Email}");
                var nguoiDung = new ThanhVien
                {
                    HoTen = request.Name
                };

                _context.ThanhViens.Add(nguoiDung);
                await _context.SaveChangesAsync(); // Lưu để lấy NguoiDungId

                var taiKhoan = new TaiKhoan
                {
                    ThanhVienId = nguoiDung.ThanhVienId,
                    Email = request.Email,
                    MatKhau = "[OAUTH_NO_PASSWORD]", // OAuth không cần mật khẩu
                    NgayTao = DateTime.Now,
                    TrangThai = true,
                    LoaiTaiKhoan = request.Provider.ToLower(),
                    LanDangNhapGanNhat = DateTime.Now
                };

                _context.TaiKhoans.Add(taiKhoan);
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    success = true,
                    user = new
                    {
                        taiKhoanId = taiKhoan.TaiKhoanId,
                        thanhVienId = nguoiDung.ThanhVienId,
                        email = taiKhoan.Email,
                        hoTen = nguoiDung.HoTen,
                        gioiTinh = nguoiDung.GioiTinh,
                        ngaySinh = nguoiDung.NgaySinh,
                        moTaBanThan = nguoiDung.MoTaBanThan,
                        sdt = nguoiDung.Sdt,
                        diaChi = nguoiDung.DiaChi,
                        loaiTaiKhoan = taiKhoan.LoaiTaiKhoan,
                        trangThai = taiKhoan.TrangThai,
                        chuyenMonId = nguoiDung.ChuyenMonId,
                        tenChuyenMon = nguoiDung.ChuyenMon?.TenChuyenMon
                    }
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"OAuth login error: {ex.Message}");
                Console.WriteLine($"Inner exception: {ex.InnerException?.Message}");
                Console.WriteLine($"Stack trace: {ex.StackTrace}");
                return StatusCode(500, new { message = "Lỗi khi đăng nhập OAuth", error = ex.Message, innerError = ex.InnerException?.Message });
            }
        }

        // Cập nhật thông tin cá nhân
        [HttpPut("update-profile/{nguoiDungId}")]
        public async Task<IActionResult> UpdateProfile(int nguoiDungId, [FromForm] UpdateProfileRequest request)
        {
            try
            {
                var nguoiDung = await _context.ThanhViens
                    .Include(n => n.ChuyenMon)
                    .FirstOrDefaultAsync(n => n.ThanhVienId == nguoiDungId);
                if (nguoiDung == null)
                    return NotFound("Không tìm thấy người dùng");

                // Cập nhật thông tin
                nguoiDung.HoTen = request.HoTen ?? nguoiDung.HoTen;
                nguoiDung.GioiTinh = request.GioiTinh ?? nguoiDung.GioiTinh;
                nguoiDung.NgaySinh = request.NgaySinh ?? nguoiDung.NgaySinh;
                nguoiDung.MoTaBanThan = request.MoTaBanThan ?? nguoiDung.MoTaBanThan;
                nguoiDung.Sdt = request.SoDienThoai ?? nguoiDung.Sdt;
                nguoiDung.DiaChi = request.DiaChi ?? nguoiDung.DiaChi;
                nguoiDung.ChuyenMonId = request.ChuyenMonId ?? nguoiDung.ChuyenMonId;

                string? filePath = null;

                // 1. Xử lý upload file nếu có
                if (request.AnhBia != null && request.AnhBia.Length > 0)
                {
                    var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot/uploads/ThanhVien");
                    if (!Directory.Exists(uploadsFolder))
                        Directory.CreateDirectory(uploadsFolder);

                    var uniqueFileName = $"{Guid.NewGuid()}_{request.AnhBia.FileName}";
                    filePath = Path.Combine(uploadsFolder, uniqueFileName);

                    using var fileStream = new FileStream(filePath, FileMode.Create);
                    await request.AnhBia.CopyToAsync(fileStream);

                    // Lưu đường dẫn tương đối vào DB
                    filePath = $"/uploads/ThanhVien/{uniqueFileName}";
                    nguoiDung.AnhBia = filePath;
                }
                

                await _context.SaveChangesAsync();

                return Ok(new
                {
                    success = true,
                    message = "Cập nhật thông tin thành công!",
                    user = new
                    {
                        thanhVienId = nguoiDung.ThanhVienId,
                        hoTen = nguoiDung.HoTen,
                        gioiTinh = nguoiDung.GioiTinh,
                        ngaySinh = nguoiDung.NgaySinh,
                        moTaBanThan = nguoiDung.MoTaBanThan,
                        sdt = nguoiDung.Sdt,
                        diaChi = nguoiDung.DiaChi,
                        chuyenMonId = nguoiDung.ChuyenMonId,
                        tenChuyenMon = nguoiDung.ChuyenMon?.TenChuyenMon,
                        anhBia = nguoiDung.AnhBia,
                    }
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Update profile error: {ex.Message}");
                return StatusCode(500, new { message = "Lỗi khi cập nhật thông tin", error = ex.Message });
            }
        }

        // Lấy danh sách chuyên môn để chọn
        [HttpGet("chuyen-mon")]
        public async Task<IActionResult> GetChuyenMon()
        {
            var chuyenMonList = await _context.ChuyenMons.ToListAsync();
            return Ok(new
            {
                success = true,
                data = chuyenMonList.Select(cm => new
                {
                    chuyenMonId = cm.ChuyenMonId,
                    tenChuyenMon = cm.TenChuyenMon
                })
            });
        }

        [HttpPost("change-email/request")]
        public async Task<IActionResult> RequestChangeEmail([FromBody] ChangeEmailRequest request)
        {
            if (request.TaiKhoanId <= 0 || string.IsNullOrEmpty(request.NewEmail))
                return BadRequest("Thiếu thông tin tài khoản hoặc email mới.");

            // Kiểm tra tài khoản tồn tại
            var user = await _context.TaiKhoans.FindAsync(request.TaiKhoanId);
            if (user == null)
                return NotFound("Không tìm thấy tài khoản.");

            // Kiểm tra email mới có trùng với người khác không
            if (await _context.TaiKhoans.AnyAsync(u => u.Email == request.NewEmail))
                return BadRequest("Email này đã được sử dụng bởi tài khoản khác.");

            // Lưu tạm thông tin vào cache (15 phút)
            var cacheKey = $"changeEmail_{request.TaiKhoanId}";
            _cache.Set(cacheKey, request.NewEmail, TimeSpan.FromMinutes(15));

            // Sinh OTP
            var otp = _otpService.GenerateOtp(request.NewEmail, "change-email");

            // Gửi email OTP đến email mới
            await _emailService.SendEmailAsync(request.NewEmail, "Xác nhận đổi email",
                $"Mã OTP để xác nhận đổi email của bạn là: {otp}");

            Console.WriteLine($"Sent change-email OTP {otp} to {request.NewEmail}");

            return Ok(new { message = "OTP đã được gửi đến email mới!", success = true });
        }

        [HttpPost("change-email/verify")]
        public async Task<IActionResult> VerifyChangeEmail([FromBody] VerifyChangeEmailRequest request)
        {
            if (request.TaiKhoanId <= 0 || string.IsNullOrEmpty(request.NewEmail) || string.IsNullOrEmpty(request.Otp))
                return BadRequest("Thiếu thông tin cần thiết.");

            // Kiểm tra OTP hợp lệ
            if (!_otpService.VerifyOtp(request.NewEmail, request.Otp, "change-email"))
                return BadRequest("OTP không đúng hoặc đã hết hạn.");

            // Lấy email mới từ cache để xác thực
            var cacheKey = $"changeEmail_{request.TaiKhoanId}";
            if (!_cache.TryGetValue<string>(cacheKey, out var cachedEmail) || cachedEmail != request.NewEmail)
                return BadRequest("Phiên đổi email đã hết hạn hoặc không hợp lệ.");

            // Cập nhật email trong database
            var user = await _context.TaiKhoans.FindAsync(request.TaiKhoanId);
            if (user == null)
                return NotFound("Không tìm thấy tài khoản.");

            user.Email = request.NewEmail;
            await _context.SaveChangesAsync();

            // Xoá session cache
            _cache.Remove(cacheKey);

            Console.WriteLine($"Email changed successfully for user {user.TenTaiKhoan} to {request.NewEmail}");

            return Ok(new { message = "Đổi email thành công!", success = true });
        }

        [HttpPost("change-email/resend")]
        public async Task<IActionResult> ResendChangeEmailOtp([FromBody] ChangeEmailResendRequest request)
        {
            if (request.TaiKhoanId <= 0)
                return BadRequest("Thiếu thông tin tài khoản.");

            var cacheKey = $"changeEmail_{request.TaiKhoanId}";

            // Kiểm tra xem đã có yêu cầu đổi email chưa
            if (!_cache.TryGetValue<string>(cacheKey, out var newEmail))
                return BadRequest("Không tìm thấy yêu cầu đổi email hoặc đã hết hạn.");

            

            // Tạo OTP mới
            var otp = _otpService.GenerateOtp(newEmail, "change-email");

            // Gửi lại OTP đến email mới
            await _emailService.SendEmailAsync(newEmail, "Mã OTP xác nhận đổi email (Gửi lại)",
                $"Mã OTP mới để xác nhận đổi email của bạn là: {otp}");

            Console.WriteLine($"Resent change-email OTP {otp} to {newEmail}");

            return Ok(new { message = "Đã gửi lại mã OTP đến email mới.", success = true });
        }

        [HttpPost("ChangePassword/{taiKhoanId}")]
        public async Task<IActionResult> ChangePassword(int taiKhoanId, [FromBody] ChangePasswordRequest model)
        {
            if (
                string.IsNullOrWhiteSpace(model.CurrentPassword) ||
                string.IsNullOrWhiteSpace(model.NewPassword))
            {
                return BadRequest(new { Message = "Vui lòng nhập đầy đủ thông tin" });
            }

            // 1️⃣ Kiểm tra người dùng tồn tại
            var user = await _context.TaiKhoans.FirstOrDefaultAsync(u => u.TaiKhoanId == taiKhoanId);
            if (user == null)
                return NotFound(new { Message = "Tài khoản không tồn tại" });

            // 2️⃣ Kiểm tra mật khẩu cũ
            if (!BCrypt.Net.BCrypt.Verify(model.CurrentPassword, user.MatKhau))
                return BadRequest(new { Message = "Mật khẩu cũ không chính xác" });

            // 3️⃣ Cập nhật mật khẩu mới (băm lại)
            user.MatKhau = BCrypt.Net.BCrypt.HashPassword(model.NewPassword);
            

            _context.TaiKhoans.Update(user);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Đổi mật khẩu thành công" });
        }

    }
}
