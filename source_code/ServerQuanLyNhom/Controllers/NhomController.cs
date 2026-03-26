using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using ServerQuanLyNhom.DTOs.NewFolder;
using ServerQuanLyNhom.DTOs.Nhoms;
using ServerQuanLyNhom.Models;
using ServerQuanLyNhom.Services;
using ServerQuanLyNhom.Services.Email;
using System.Text.Json;
using System.Threading.Tasks;

// For more information on enabling Web API for empty projects, visit https://go.microsoft.com/fwlink/?LinkID=397860

namespace ServerQuanLyNhom.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class NhomController : ControllerBase
    {
        private readonly QuanLyCongViecNhomContext _context;
        private readonly OtpService _otpService;
        private readonly EmailService _emailService;
        //private readonly IMemoryCache _cache;
        private readonly IDistributedCache _cache;

        public NhomController(QuanLyCongViecNhomContext context, OtpService otpService, EmailService emailService, IDistributedCache cache)
        {
            _context = context;
            _otpService = otpService;
            _emailService = emailService;
            _cache = cache;
        }

        [HttpPost("CreateGroup")]
        public async Task<IActionResult> CreateGroup([FromForm] CreateNhomRequest dto)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                string? filePath = null;

                // 1. Xử lý upload file nếu có
                if (dto.AnhBia != null && dto.AnhBia.Length > 0)
                {
                    var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot/uploads/nhom");
                    if (!Directory.Exists(uploadsFolder))
                        Directory.CreateDirectory(uploadsFolder);

                    var uniqueFileName = $"{Guid.NewGuid()}_{dto.AnhBia.FileName}";
                    filePath = Path.Combine(uploadsFolder, uniqueFileName);

                    using var fileStream = new FileStream(filePath, FileMode.Create);
                    await dto.AnhBia.CopyToAsync(fileStream);

                    // Lưu đường dẫn tương đối vào DB
                    filePath = $"/uploads/nhom/{uniqueFileName}";
                }

                // 2. Tạo nhóm
                var nhom = new Nhom
                {
                    TenNhom = dto.TenNhom,
                    MoTa = dto.MoTa,
                    SoLuongTv = 1, // mặc định 1
                    AnhBia = filePath,
                    NgayLapNhom = DateOnly.FromDateTime(DateTime.Now),
                    NgayCapNhat = DateTime.Now
                };
                _context.Nhoms.Add(nhom);
                await _context.SaveChangesAsync();

                // 3. Thêm ChiTietNhom
                var chiTiet = new ChiTietThanhVienNhom
                {
                    NhomId = nhom.NhomId,
                    ThanhVienId = dto.ThanhVienID,
                    ChucVu = "Trưởng nhóm",
                    NgayThamGia = DateOnly.FromDateTime(DateTime.Now),
                };
                _context.ChiTietThanhVienNhoms.Add(chiTiet);
                await _context.SaveChangesAsync();



                await transaction.CommitAsync();

                return Ok(new { Message = "Tạo nhóm thành công", NhomID = nhom.NhomId, AnhBia = nhom.AnhBia });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest(new { Message = "Tạo nhóm thất bại", Error = ex.Message });
            }
        }

        [HttpPut("UpdateGroup")]
        public async Task<IActionResult> UpdateGroup([FromForm] UpdateNhomRequest dto)
        {
            try
            {
                var nhom = await _context.Nhoms.FindAsync(dto.NhomID);
                if (nhom == null)
                    return NotFound(new { Message = "Nhóm không tồn tại" });

                nhom.TenNhom = dto.TenNhom;
                nhom.MoTa = dto.MoTa;
                nhom.NgayCapNhat = DateTime.Now;

                // Xử lý đổi ảnh bìa nếu có
                if (dto.AnhBia != null && dto.AnhBia.Length > 0)
                {
                    var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot/uploads/nhom");
                    if (!Directory.Exists(uploadsFolder))
                        Directory.CreateDirectory(uploadsFolder);

                    var uniqueFileName = $"{Guid.NewGuid()}_{dto.AnhBia.FileName}";
                    var filePath = Path.Combine(uploadsFolder, uniqueFileName);

                    using var fileStream = new FileStream(filePath, FileMode.Create);
                    await dto.AnhBia.CopyToAsync(fileStream);

                    nhom.AnhBia = $"/uploads/Nhom/{uniqueFileName}";
                }

                _context.Nhoms.Update(nhom);
                await _context.SaveChangesAsync();

                return Ok(new { Message = "Cập nhật nhóm thành công", NhomID = nhom.NhomId });
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = "Cập nhật nhóm thất bại", Error = ex.Message });
            }
        }

        [HttpDelete("DeleteGroup/{nhomId}")]
        public async Task<IActionResult> DeleteGroup(int nhomId)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var nhom = await _context.Nhoms.FindAsync(nhomId);
                if (nhom == null)
                    return NotFound(new { Message = "Nhóm không tồn tại" });

                // 1. Xóa ChiTietNhom liên quan
                var chiTiets = _context.ChiTietThanhVienNhoms.Where(c => c.NhomId == nhomId);
                _context.ChiTietThanhVienNhoms.RemoveRange(chiTiets);


                // 3. Xóa nhóm
                _context.Nhoms.Remove(nhom);

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new { Message = "Xóa nhóm thành công" });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest(new { Message = "Xóa nhóm thất bại", Error = ex.Message });
            }
        }

        [HttpGet("GetGroupsOfMember/{thanhVienId}")]
        public async Task<IActionResult> GetGroupsOfMember(int thanhVienId)
        {
            var groups = await _context.ChiTietThanhVienNhoms
                .Where(ct => ct.ThanhVienId == thanhVienId)
                .Select(ct => new
                {
                    ct.Nhom.NhomId,
                    ct.Nhom.TenNhom,
                    ct.Nhom.MoTa,
                    ct.Nhom.SoLuongTv,
                    ct.Nhom.NgayLapNhom,
                    ct.Nhom.AnhBia,
                    ct.ChucVu
                })
                .ToListAsync();

            return Ok(groups);
        }

        [HttpPost("gui-loi-moi")]
        public async Task<IActionResult> GuiLoiMoi([FromBody] MoiThanhVienRequest dto)
        {
            int nguoiGuiId = dto.nguoiGuiId;
            string mailNguoiNhan = dto.mailNguoiNhan;
            int nhomId = dto.nhomId;

            string cacheKey = $"LoiMoi_{mailNguoiNhan}_{nhomId}";

            var taiKhoanGui = await _context.TaiKhoans.FirstOrDefaultAsync(tv => tv.TaiKhoanId == nguoiGuiId);
            var thanhVienGui = await _context.ThanhViens.FirstOrDefaultAsync(tv => tv.ThanhVienId == taiKhoanGui.ThanhVienId);
            var taiKhoanNhan = await _context.TaiKhoans.FirstOrDefaultAsync(tv => tv.Email == mailNguoiNhan);

            if (taiKhoanNhan == null)
                return BadRequest(new { message = "Không tìm thấy người nhận." });

            bool daTrongNhom = await _context.ChiTietThanhVienNhoms
                .AnyAsync(ct => ct.NhomId == nhomId && ct.ThanhVienId == taiKhoanNhan.ThanhVienId);

            if (daTrongNhom)
                return BadRequest(new { message = "Thành viên này đã ở trong nhóm rồi." });

            // Kiểm tra đã có lời mời chưa
            if (await _cache.GetStringAsync(cacheKey) is not null)
                return BadRequest(new { message = "Lời mời đã được gửi tới người ngày. Hãy chờ 5 phút sau để gửi lại" });

            var nhom = await _context.Nhoms.FirstOrDefaultAsync(n => n.NhomId == nhomId);


            var loiMoi = new LoiMoiCacheItem
            {
                NguoiGuiId = nguoiGuiId,
                MailNguoiNhan = mailNguoiNhan,
                NhomId = nhomId,
                TieuDe = $"Lời mời tham gia nhóm {nhom.TenNhom}",
                NoiDung = $"Bạn được {thanhVienGui.HoTen} ({taiKhoanGui.Email}) mời tham gia nhóm {nhom.TenNhom}.",
                TrangThaiLoiMoi = "Chờ phản hồi"
            };

            // Lưu cache lời mời (10 phút)
            var json = JsonSerializer.Serialize(loiMoi);
            await _cache.SetStringAsync(cacheKey, json, new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5)
            });

            // Lưu danh sách key lời mời của người nhận
            string listKey = $"DanhSachLoiMoi_{mailNguoiNhan}";
            var listStr = await _cache.GetStringAsync(listKey);
            var list = listStr != null ? JsonSerializer.Deserialize<List<string>>(listStr) : new List<string>();

            if (!list.Contains(cacheKey))
                list.Add(cacheKey);

            await _cache.SetStringAsync(listKey, JsonSerializer.Serialize(list), new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10)
            });

            // Lưu danh sách lời mời mà người gửi đã gửi trong nhóm này
            string listKeyGui = $"DanhSachLoiMoiGui_{nguoiGuiId}_{nhomId}";
            var listGuiStr = await _cache.GetStringAsync(listKeyGui);
            var listGui = listGuiStr != null ? JsonSerializer.Deserialize<List<string>>(listGuiStr) : new List<string>();

            if (!listGui.Contains(cacheKey))
                listGui.Add(cacheKey);

            await _cache.SetStringAsync(listKeyGui, JsonSerializer.Serialize(listGui), new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10)
            });


            return Ok(new
            {
                message = "Đã gửi lời mời.",
                loiMoi.TieuDe,
                loiMoi.NoiDung
            });
        }

        [HttpGet("loi-moi/{mailNguoiNhan}")]
        public async Task<IActionResult> LayLoiMoiTheoThanhVien(string mailNguoiNhan)
        {
            string listKey = $"DanhSachLoiMoi_{mailNguoiNhan}";
            var listStr = await _cache.GetStringAsync(listKey);

            if (listStr == null)
                return Ok(new { message = "Không có lời mời nào.", loiMoi = new List<object>() });

            var cacheKeys = JsonSerializer.Deserialize<List<string>>(listStr);
            var loiMoiList = new List<LoiMoiCacheItem>();

            foreach (var key in cacheKeys)
            {
                var json = await _cache.GetStringAsync(key);
                if (json != null)
                {
                    var loiMoi = JsonSerializer.Deserialize<LoiMoiCacheItem>(json);
                    loiMoiList.Add(loiMoi);
                }
            }

            return Ok(loiMoiList);
        }

        [HttpPost("phan-hoi-loi-moi")]
        public async Task<IActionResult> PhanHoiLoiMoi([FromBody] PhanHoiLoiMoiRequest dto)
        {
            string mailNguoiNhan = dto.mailNguoiNhan;
            int nhomId = dto.nhomId;
            bool chapNhan = dto.chapNhan;
            string cacheKey = $"LoiMoi_{mailNguoiNhan}_{nhomId}";
            var json = await _cache.GetStringAsync(cacheKey);

            if (json == null)
                return NotFound(new { message = "Lời mời không còn hiệu lực hoặc đã hết hạn." });

            var loiMoi = JsonSerializer.Deserialize<LoiMoiCacheItem>(json);
            var taiKhoan = await _context.TaiKhoans.FirstOrDefaultAsync(tv => tv.Email == mailNguoiNhan);

            if (taiKhoan == null)
                return BadRequest(new { message = "Không tìm thấy thông tin thành viên được mời." });

            var nhom = await _context.Nhoms.FirstOrDefaultAsync(n => n.NhomId == nhomId);
            var thanhVien = await _context.ThanhViens.FirstOrDefaultAsync(tv => tv.ThanhVienId == taiKhoan.ThanhVienId);

            if (chapNhan)
            {
                bool daTonTai = await _context.ChiTietThanhVienNhoms
                    .AnyAsync(ct => ct.NhomId == nhomId && ct.ThanhVienId == thanhVien.ThanhVienId);

                if (!daTonTai)
                {
                    var chiTietNhom = new ChiTietThanhVienNhom
                    {
                        NhomId = nhomId,
                        ThanhVienId = thanhVien.ThanhVienId,
                        ChucVu = "Thành viên",
                        NgayThamGia = DateOnly.FromDateTime(DateTime.Now),
                    };



                    _context.ChiTietThanhVienNhoms.Add(chiTietNhom);

                    nhom.SoLuongTv += 1;

                    await _context.SaveChangesAsync();
                }

                loiMoi.TrangThaiLoiMoi = "Đã chấp nhận";
                loiMoi.TieuDe = "Phản hồi lời mời nhóm";
                loiMoi.NoiDung = $"Bạn đã chấp nhận tham gia nhóm {nhom.TenNhom}.";
            }
            else
            {
                loiMoi.TrangThaiLoiMoi = "Đã từ chối";
                loiMoi.TieuDe = "Từ chối lời mời nhóm";
                loiMoi.NoiDung = $"Bạn đã từ chối tham gia nhóm {nhom.TenNhom}.";
            }

            // Cập nhật lại cache giữ thêm 5 phút
            var updatedJson = JsonSerializer.Serialize(loiMoi);
            await _cache.SetStringAsync(cacheKey, updatedJson, new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5)
            });

            string listKey = $"DanhSachLoiMoi_{mailNguoiNhan}";
            var listStr = await _cache.GetStringAsync(listKey);
            if (listStr != null)
            {
                var cacheKeys = JsonSerializer.Deserialize<List<string>>(listStr);
                await _cache.SetStringAsync(listKey, JsonSerializer.Serialize(cacheKeys),
                    new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5) });
            }

            return Ok(new
            {
                message = chapNhan
                    ? "Bạn đã chấp nhận và tham gia nhóm thành công."
                    : "Bạn đã từ chối lời mời.",
                loiMoi.TieuDe,
                loiMoi.NoiDung
            });
        }

        [HttpGet("da-gui/{nguoiGuiId}/{nhomId}")]
        public async Task<IActionResult> LayLoiMoiDaGui(int nguoiGuiId, int nhomId)
        {
            // 🔹 Vì ta không lưu danh sách tất cả các cache key theo người gửi,
            // ta sẽ quét qua tất cả lời mời đang tồn tại (theo tất cả user)
            // => Cách đơn giản: lấy tất cả "DanhSachLoiMoi_*" trong Redis.
            // Tuy nhiên Redis IDistributedCache không hỗ trợ scan trực tiếp.
            // Nên để tối ưu, ta có thể lưu thêm 1 danh sách riêng cho người gửi khi gửi lời mời.

            // => Nếu bạn chưa làm, ta sẽ bổ sung logic này ở API "gui-loi-moi"
            //    (mình sẽ ghi ở dưới). Còn đây là phần đọc:
            

            string listKey = $"DanhSachLoiMoiGui_{nguoiGuiId}_{nhomId}";
            var listStr = await _cache.GetStringAsync(listKey);

            if (listStr == null)
            {
                return Ok(new { message = "Không có lời mời nào đã gửi trong nhóm này.", loiMoi = new List<object>() });
            }

            var cacheKeys = JsonSerializer.Deserialize<List<string>>(listStr);
            var loiMoiList = new List<LoiMoiCacheItem>();

            foreach (var key in cacheKeys)
            {
                var json = await _cache.GetStringAsync(key);
                if (json != null)
                {
                    var loiMoi = JsonSerializer.Deserialize<LoiMoiCacheItem>(json);
                    loiMoiList.Add(loiMoi);
                }
            }

            return Ok(new
            {
                message = $"Đã lấy {loiMoiList.Count} lời mời trong nhóm {nhomId}",
                loiMoi = loiMoiList
            });
        }

        [HttpGet("{nhomId}")]
        public async Task<IActionResult> GetNhomDetail(int nhomId)
        {
            try
            {
                var nhom = await _context.Nhoms
                    .Where(n => n.NhomId == nhomId)
                    .Select(n => new
                    {
                        n.NhomId,
                        n.TenNhom,
                        n.MoTa,
                        n.SoLuongTv,
                        n.NgayLapNhom,
                        n.AnhBia,
                    })
                    .FirstOrDefaultAsync();

                if (nhom == null)
                {
                    return NotFound(new { Message = "Không tìm thấy nhóm." });
                }

                return Ok(nhom);
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    Message = "Lỗi khi lấy thông tin nhóm.",
                    Error = ex.InnerException?.Message ?? ex.Message
                });
            }
        }

        [HttpGet("{nhomId}/ThanhVien")]
        public async Task<IActionResult> GetThanhVienByNhom(int nhomId)
        {
            try
            {
                var thanhVienList = await _context.ChiTietThanhVienNhoms
                    .Where(ct => ct.NhomId == nhomId)
                    .Join(
                        _context.ThanhViens,
                        ct => ct.ThanhVienId,
                        tv => tv.ThanhVienId,
                        (ct, tv) => new
                        {
                            tv.ThanhVienId,
                            tv.HoTen,
                            tv.ChuyenMon,
                            ct.ChucVu,
                            ct.NgayThamGia,
                            tv.AnhBia,
                        }
                    )
                    .ToListAsync();

                if (!thanhVienList.Any())
                {
                    return NotFound(new { Message = "Nhóm này chưa có thành viên nào." });
                }

                return Ok(thanhVienList);
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    Message = "Lỗi khi lấy danh sách thành viên.",
                    Error = ex.InnerException?.Message ?? ex.Message
                });
            }
        }

        [HttpGet("{nhomId}/ThanhVien/{thanhVienId}")]
        public async Task<IActionResult> GetThanhVienInNhom(int nhomId, int thanhVienId)
        {
            try
            {
                var thanhVien = await _context.ChiTietThanhVienNhoms
                    .Where(ct => ct.NhomId == nhomId && ct.ThanhVienId == thanhVienId)
                    .Join(
                        _context.ThanhViens,
                        ct => ct.ThanhVienId,
                        tv => tv.ThanhVienId,
                        (ct, tv) => new
                        {
                            tv.ThanhVienId,                            
                            tv.HoTen,
                            tv.Sdt,
                            tv.NgaySinh,
                            ct.ChucVu,
                            ct.NgayThamGia
                        }
                    )
                    .FirstOrDefaultAsync();

                if (thanhVien == null)
                    return NotFound(new { Message = "Thành viên này không thuộc nhóm hoặc không tồn tại." });

                return Ok(thanhVien);
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    Message = "Lỗi khi lấy thông tin thành viên trong nhóm.",
                    Error = ex.InnerException?.Message ?? ex.Message
                });
            }
        }



    }
}
