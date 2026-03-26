using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using ServerQuanLyNhom.DTOs.PhanCongs;
using ServerQuanLyNhom.DTOs.ThongBaos;
using ServerQuanLyNhom.Models;
using ServerQuanLyNhom.Services;
using ServerQuanLyNhom.Services.Email;
using System.Collections.Generic;
using System.Text.Json;
using STJ = System.Text.Json.JsonSerializer;

namespace ServerQuanLyNhom.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ThongBaoController : ControllerBase
    {
        private readonly QuanLyCongViecNhomContext _context;
        private readonly OtpService _otpService;
        private readonly EmailService _emailService;
        private readonly IDistributedCache _cache;
        private readonly TimeSpan _thongBaoTTL = TimeSpan.FromDays(30);

        public ThongBaoController(QuanLyCongViecNhomContext context, OtpService otpService, EmailService emailService, IDistributedCache cache)
        {
            _context = context;
            _otpService = otpService;
            _emailService = emailService;
            _cache = cache;
        }

        [HttpPost("NhacHanCongViec")]
        public async Task<IActionResult> NhacHanCongViec([FromBody] NhacHanCongViecRequest dto)
        {
            var congViec = await _context.CongViecs.Include(t=>t.DuAn).FirstOrDefaultAsync(t=>t.CongViecId == dto.CongViecID);
            if (congViec == null)
                return NotFound(new { Message = "Công việc không tồn tại" });

            var thanhViens = await _context.PhanCongs
                .Where(p => p.CongViecId == dto.CongViecID)
                .Select(p => p.ThanhVien)
                .ToListAsync();

            if (!thanhViens.Any())
                return BadRequest(new { Message = "Công việc chưa có thành viên được phân công" });

            foreach (var tv in thanhViens)
            {
                var thongBao = new
                {
                    ThongBaoId = Guid.NewGuid().ToString(),
                    LoaiThongBao = "Nhắc Hạn Công Việc",
                    TieuDe = $"Dự án: \"{congViec.DuAn.TenDuAn}\" - Hãy sớm hoàn thành công việc của bạn!!!",
                    NoiDung = $"Công việc \"{congViec.TenCongViec}\" sẽ hết hạn vào {congViec.NgayKt?.ToString("yyyy-MM-dd")}.",
                    MailNguoiGui = dto.MailNguoiGui,
                    ThanhVienId = tv.ThanhVienId,
                    NgayTao = DateTime.Now,
                    TrangThai = "Chưa Đọc",
                    Ghim = 0
                };

                string thongBaoKey = $"ThongBao:{tv.ThanhVienId}:{thongBao.ThongBaoId}";
                string thongBaoJson = JsonConvert.SerializeObject(thongBao);

                await _cache.SetStringAsync(thongBaoKey, thongBaoJson,
                    new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = _thongBaoTTL });

                // Danh sách thông báo của thành viên
                string listKey = $"ThongBaoList:{tv.ThanhVienId}";
                var listJson = await _cache.GetStringAsync(listKey);
                var list = listJson != null
                    ? JsonConvert.DeserializeObject<List<string>>(listJson)
                    : new List<string>();

                list.Add(thongBao.ThongBaoId);

                await _cache.SetStringAsync(listKey, JsonConvert.SerializeObject(list),
                    new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = _thongBaoTTL });
            }

            return Ok(new { Message = "Đã gửi nhắc hạn công việc tới tất cả thành viên!" });
        }

        [HttpGet("GetThongBaoOfThanhVien/{thanhVienId}")]
        public async Task<IActionResult> GetThongBaoOfThanhVien(int thanhVienId)
        {
            string listKey = $"ThongBaoList:{thanhVienId}";
            var listJson = await _cache.GetStringAsync(listKey);
            if (listJson == null)
                return Ok(new List<object>());

            var thongBaoIds = JsonConvert.DeserializeObject<List<string>>(listJson);
            var result = new List<dynamic>();

            foreach (var id in thongBaoIds)
            {
                string thongBaoKey = $"ThongBao:{thanhVienId}:{id}";
                var thongBaoJson = await _cache.GetStringAsync(thongBaoKey);
                if (thongBaoJson != null)
                {
                    var tb = JsonConvert.DeserializeObject<ThongBaoModel>(thongBaoJson);
                    result.Add(tb);
                }
            }

            var sorted = result.OrderByDescending(tb => (DateTime)tb.NgayTao).ToList();
            return Ok(sorted);
        }

        [HttpPut("MarkAsRead/{thanhVienId}/{thongBaoId}")]
        public async Task<IActionResult> MarkAsRead(int thanhVienId, string thongBaoId)
        {
            string thongBaoKey = $"ThongBao:{thanhVienId}:{thongBaoId}";
            var thongBaoJson = await _cache.GetStringAsync(thongBaoKey);

            if (thongBaoJson == null)
                return NotFound(new { Message = "Thông báo không tồn tại" });

            var thongBao = JObject.Parse(thongBaoJson);
            string trangThaiHienTai = (string)thongBao["TrangThai"];
            thongBao["TrangThai"] = trangThaiHienTai == null ? "Đã Đọc" : (trangThaiHienTai == "Đã Đọc" ? "Chưa Đọc" : "Đã Đọc");
            thongBao["NgayDoc"] = DateTime.Now;


            await _cache.SetStringAsync(thongBaoKey, JsonConvert.SerializeObject(thongBao),
                new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = _thongBaoTTL });

            return Ok(new { Message = "Đã đánh dấu trạng thái", ThongBaoId = thongBaoId });
        }

        [HttpPut("MarkAllAsRead/{thanhVienId}")]
        public async Task<IActionResult> MarkAllAsRead(int thanhVienId)
        {
            string listKey = $"ThongBaoList:{thanhVienId}";
            var listJson = await _cache.GetStringAsync(listKey);
            if (listJson == null)
                return Ok(new { Message = "Không có thông báo chưa đọc" });

            var thongBaoIds = JsonConvert.DeserializeObject<List<string>>(listJson);
            int count = 0;

            foreach (var id in thongBaoIds)
            {
                string thongBaoKey = $"ThongBao:{thanhVienId}:{id}";
                var thongBaoJson = await _cache.GetStringAsync(thongBaoKey);
                if (thongBaoJson == null) continue;

                var thongBao = JObject.Parse(thongBaoJson);
                if ((string)thongBao["TrangThai"] == "Chưa Đọc")
                {
                    thongBao["TrangThai"] = "Đã Đọc";
                    thongBao["NgayDoc"] = DateTime.Now;
                    count++;

                    await _cache.SetStringAsync(thongBaoKey, JsonConvert.SerializeObject(thongBao),
                        new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = _thongBaoTTL });
                }
            }

            return Ok(new { Message = $"Đã đánh dấu {count} thông báo là đã đọc" });
        }

        [HttpPut("ToggleGhim/{thanhVienId}/{thongBaoId}")]
        public async Task<IActionResult> ToggleGhim(int thanhVienId, string thongBaoId)
        {
            string thongBaoKey = $"ThongBao:{thanhVienId}:{thongBaoId}";
            var thongBaoJson = await _cache.GetStringAsync(thongBaoKey);

            if (thongBaoJson == null)
                return NotFound(new { Message = "Thông báo không tồn tại" });

            var thongBao = JObject.Parse(thongBaoJson);
            thongBao["Ghim"] = (int)thongBao["Ghim"] == 0 ? 1 : 0;

            await _cache.SetStringAsync(thongBaoKey, JsonConvert.SerializeObject(thongBao),
                new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = _thongBaoTTL });

            string action = (int)thongBao["Ghim"] == 1 ? "ghim" : "bỏ ghim";
            return Ok(new { Message = $"Đã {action} thông báo", ThongBaoId = thongBaoId, Ghim = thongBao["Ghim"] });
        }

        [HttpDelete("DeleteThongBao/{thanhVienId}/{thongBaoId}")]
        public async Task<IActionResult> DeleteThongBao(int thanhVienId, string thongBaoId)
        {
            try
            {
                string thongBaoKey = $"ThongBao:{thanhVienId}:{thongBaoId}";
                string listKey = $"ThongBaoList:{thanhVienId}";

                // Xóa thông báo cụ thể
                await _cache.RemoveAsync(thongBaoKey);

                // Cập nhật lại danh sách thông báo
                var listJson = await _cache.GetStringAsync(listKey);
                if (listJson != null)
                {
                    var thongBaoIds = JsonConvert.DeserializeObject<List<string>>(listJson);
                    if (thongBaoIds.Remove(thongBaoId))
                    {
                        // Ghi lại danh sách đã cập nhật
                        await _cache.SetStringAsync(
                            listKey,
                            JsonConvert.SerializeObject(thongBaoIds),
                            new DistributedCacheEntryOptions
                            {
                                AbsoluteExpirationRelativeToNow = TimeSpan.FromDays(30)
                            }
                        );
                    }
                }

                return Ok(new { Message = "Đã xoá thông báo thành công", ThongBaoId = thongBaoId });
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = "Xóa thông báo thất bại", Error = ex.InnerException?.Message ?? ex.Message });
            }
        }

        [HttpPost("ThongBaoCongViecMoi_ChoThanhVien")]
        public async Task<IActionResult> ThongBaoCongViecMoi_ChoThanhVien([FromBody] ThongBaoCongViecMoiRequest dto)
        {
            try
            {
                var congViec = await _context.CongViecs.Include(t => t.DuAn).FirstOrDefaultAsync(t => t.CongViecId == dto.CongViecID);
                if (congViec == null)
                    return NotFound(new { Message = "Công việc không tồn tại" });

                var phanCong = await _context.PhanCongs
                    .Include(p => p.ThanhVien)
                    .FirstOrDefaultAsync(p => p.CongViecId == dto.CongViecID && p.ThanhVienId == dto.ThanhVienID);

                if (phanCong == null)
                    return BadRequest(new { Message = "Thành viên này chưa được phân công trong công việc." });

                if (string.IsNullOrEmpty(phanCong.NoiDungPhanCong))
                    return BadRequest(new { Message = "Thành viên chưa có sub-task nào." });

                // Deserialize danh sách sub-task
                var subTasks = STJ.Deserialize<List<PhanCongItemRequest>>(phanCong.NoiDungPhanCong);

                foreach (var task in subTasks)
                {
                    var thongBao = new
                    {
                        ThongBaoId = Guid.NewGuid().ToString(),
                        LoaiThongBao = "Công Việc Mới",
                        TieuDe = $"Dự án:\"{congViec.DuAn.TenDuAn}\" - Bạn vừa được giao một nhiệm vụ mới!",
                        NoiDung = $"Sub-task \"{task.MoTa}\" thuộc công việc \"{congViec.TenCongViec}\" đã được giao cho bạn.\n" +
                                  $"📅 Ngày phân công: {task.NgayPC:yyyy-MM-dd}\n🔥 Mức độ ưu tiên: {task.DoUuTien}",
                        MailNguoiGui = dto.MailNguoiGui,
                        ThanhVienId = dto.ThanhVienID,
                        NgayTao = DateTime.Now,
                        TrangThai = "Chưa Đọc",
                        Ghim = 0
                    };

                    // Redis Key
                    string thongBaoKey = $"ThongBao:{dto.ThanhVienID}:{thongBao.ThongBaoId}";
                    string thongBaoJson = JsonConvert.SerializeObject(thongBao);

                    await _cache.SetStringAsync(thongBaoKey, thongBaoJson,
                        new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = _thongBaoTTL });

                    // Danh sách thông báo của thành viên
                    string listKey = $"ThongBaoList:{dto.ThanhVienID}";
                    var listJson = await _cache.GetStringAsync(listKey);
                    var list = listJson != null
                        ? JsonConvert.DeserializeObject<List<string>>(listJson)
                        : new List<string>();

                    list.Add(thongBao.ThongBaoId);

                    await _cache.SetStringAsync(listKey, JsonConvert.SerializeObject(list),
                        new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = _thongBaoTTL });
                }

                return Ok(new
                {
                    Message = $"Đã gửi thông báo công việc mới tới thành viên ID = {dto.ThanhVienID}",
                    SoLuongSubTask = subTasks.Count
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    Message = "Gửi thông báo thất bại",
                    Error = ex.InnerException?.Message ?? ex.Message
                });
            }
        }


        [HttpPost("ThongBaoBinhLuanMoi")]
        public async Task<IActionResult> ThongBaoBinhLuanMoi([FromBody] ThongBaoBinhLuanRequest dto)
        {
            var congViec = await _context.CongViecs.Include(t => t.DuAn).FirstOrDefaultAsync(t=>t.CongViecId == dto.CongViecID);
            if (congViec == null)
                return NotFound(new { Message = "Công việc không tồn tại" });

            var thanhViens = await _context.PhanCongs
                .Where(p => p.CongViecId == dto.CongViecID)
                .Select(p => p.ThanhVien)
                .ToListAsync();

            if (!thanhViens.Any())
                return BadRequest(new { Message = "Công việc chưa có thành viên được phân công" });

            // Loại bỏ người đã bình luận khỏi danh sách nhận thông báo
            thanhViens = thanhViens.Where(tv => tv.ThanhVienId != dto.ThanhVienGuiID).ToList();

            var nguoiGui = await _context.ThanhViens.FirstOrDefaultAsync(t => t.ThanhVienId == dto.ThanhVienGuiID);

            if (!thanhViens.Any())
                return Ok(new { Message = "Không có thành viên nào khác để gửi thông báo." });

            foreach (var tv in thanhViens)
            {
                var thongBao = new
                {
                    ThongBaoId = Guid.NewGuid().ToString(),
                    LoaiThongBao = "Bình luận mới",
                    TieuDe = $"Dự án: \"{congViec.DuAn.TenDuAn}\" - Có bình luận mới trong công việc \"{congViec.TenCongViec}\"!",
                    NoiDung = $"\"{nguoiGui?.HoTen}\": \"{dto.NoiDungBinhLuan}\"",                    
                    ThanhVienId = tv.ThanhVienId,
                    NgayTao = DateTime.Now,
                    TrangThai = "Chưa Đọc",
                    Ghim = 0
                };

                string thongBaoKey = $"ThongBao:{tv.ThanhVienId}:{thongBao.ThongBaoId}";
                string thongBaoJson = JsonConvert.SerializeObject(thongBao);

                await _cache.SetStringAsync(thongBaoKey, thongBaoJson,
                    new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = _thongBaoTTL });

                // Danh sách thông báo của thành viên
                string listKey = $"ThongBaoList:{tv.ThanhVienId}";
                var listJson = await _cache.GetStringAsync(listKey);
                var list = listJson != null
                    ? JsonConvert.DeserializeObject<List<string>>(listJson)
                    : new List<string>();

                list.Add(thongBao.ThongBaoId);

                await _cache.SetStringAsync(listKey, JsonConvert.SerializeObject(list),
                    new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = _thongBaoTTL });
            }

            return Ok(new { Message = "Đã gửi thông báo bình luận mới tới các thành viên!" });
        }


    }
}
