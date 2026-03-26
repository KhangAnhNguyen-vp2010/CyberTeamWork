using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using ServerQuanLyNhom.DTOs.CongViecs;
using ServerQuanLyNhom.Models;
using ServerQuanLyNhom.Services;
using ServerQuanLyNhom.Services.Email;
using System.Text.Json;

namespace ServerQuanLyNhom.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class CongViecController : ControllerBase
    {
        private readonly QuanLyCongViecNhomContext _context;
        private readonly OtpService _otpService;
        private readonly EmailService _emailService;
        private readonly IDistributedCache _cache;

        public CongViecController(QuanLyCongViecNhomContext context, OtpService otpService, EmailService emailService, IDistributedCache cache)
        {
            _context = context;
            _otpService = otpService;
            _emailService = emailService;
            _cache = cache;
        }

        [HttpPost("CreateCongViec")]
        public async Task<IActionResult> CreateCongViec([FromForm] CreateCongViecRequest dto)
        {
            try
            {
                string? filePath = null;

                // Upload ảnh bìa nếu có
                if (dto.AnhBia != null && dto.AnhBia.Length > 0)
                {
                    var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot/uploads/congviec");
                    if (!Directory.Exists(uploadsFolder))
                        Directory.CreateDirectory(uploadsFolder);

                    var uniqueFileName = $"{Guid.NewGuid()}_{dto.AnhBia.FileName}";
                    var fullPath = Path.Combine(uploadsFolder, uniqueFileName);

                    using var fileStream = new FileStream(fullPath, FileMode.Create);
                    await dto.AnhBia.CopyToAsync(fileStream);

                    filePath = $"/uploads/congviec/{uniqueFileName}";
                }

                // Kiểm tra DuAnID nếu có
                if (dto.DuAnID.HasValue)
                {
                    var duAn = await _context.DuAns.FindAsync(dto.DuAnID.Value);
                    if (duAn == null)
                        return BadRequest(new { Message = "Dự án không tồn tại" });
                }

                var congViec = new CongViec
                {
                    TenCongViec = dto.TenCongViec,
                    NgayBd = dto.NgayBD,
                    NgayKt = dto.NgayKT,
                    TrangThai = dto.TrangThai ?? "Đang thực hiện",
                    PhamTramHoanThanh = dto.PhamTramHoanThanh ?? 0,
                    DuAnId = dto.DuAnID,
                    AnhBia = filePath
                };

                _context.CongViecs.Add(congViec);
                await _context.SaveChangesAsync();

                return Ok(new { Message = "Thêm công việc thành công", CongViecID = congViec.CongViecId, AnhBia = congViec.AnhBia });
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = "Thêm công việc thất bại", Error = ex.InnerException?.Message ?? ex.Message });
            }
        }

        [HttpPost("UploadFileDinhKem/{congViecId}")]
        public async Task<IActionResult> UploadFileDinhKem(int congViecId, [FromForm] List<IFormFile> files)
        {
            try
            {
                var congViec = await _context.CongViecs.FindAsync(congViecId);
                if (congViec == null)
                    return NotFound(new { Message = "Không tìm thấy công việc." });

                if (files == null || files.Count == 0)
                    return BadRequest(new { Message = "Không có file nào được tải lên." });

                var attachFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot/uploads/congviec_attachments");
                if (!Directory.Exists(attachFolder))
                    Directory.CreateDirectory(attachFolder);

                var uploadedFiles = new List<object>();

                // Nếu đã có file đính kèm cũ → parse JSON cũ ra danh sách
                var existingFiles = new List<object>();
                if (!string.IsNullOrEmpty(congViec.FileDinhKem))
                {
                    try
                    {
                        existingFiles = System.Text.Json.JsonSerializer.Deserialize<List<object>>(congViec.FileDinhKem)
                                        ?? new List<object>();
                    }
                    catch
                    {
                        existingFiles = new List<object>();
                    }
                }

                // Upload từng file
                foreach (var file in files)
                {
                    if (file.Length > 0)
                    {
                        var uniqueFileName = $"{Guid.NewGuid()}_{file.FileName}";
                        var fullPath = Path.Combine(attachFolder, uniqueFileName);

                        using var stream = new FileStream(fullPath, FileMode.Create);
                        await file.CopyToAsync(stream);

                        var fileInfo = new
                        {
                            FileName = file.FileName,
                            FilePath = $"/uploads/congviec_attachments/{uniqueFileName}"
                        };

                        uploadedFiles.Add(fileInfo);
                        existingFiles.Add(fileInfo);
                    }
                }

                // Cập nhật lại danh sách file đính kèm
                congViec.FileDinhKem = System.Text.Json.JsonSerializer.Serialize(existingFiles);
                _context.CongViecs.Update(congViec);
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    Message = "Upload file đính kèm thành công",
                    CongViecId = congViecId,
                    NewFiles = uploadedFiles,
                    AllFiles = existingFiles
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    Message = "Upload thất bại",
                    Error = ex.InnerException?.Message ?? ex.Message
                });
            }
        }

        [HttpGet("GetFileDinhKem/{congViecId}")]
        public async Task<IActionResult> GetFileDinhKem(int congViecId)
        {
            try
            {
                var congViec = await _context.CongViecs.FindAsync(congViecId);
                if (congViec == null)
                    return NotFound(new { Message = "Không tìm thấy công việc." });

                if (string.IsNullOrEmpty(congViec.FileDinhKem))
                    return Ok(new
                    {
                        Message = "Công việc này chưa có file đính kèm.",
                        Files = new List<object>()
                    });

                // Giải mã JSON danh sách file
                var files = System.Text.Json.JsonSerializer.Deserialize<List<FileDinhKemDto>>(congViec.FileDinhKem)
                            ?? new List<FileDinhKemDto>();

                return Ok(new
                {
                    Message = "Lấy danh sách file đính kèm thành công",
                    CongViecId = congViecId,
                    Total = files.Count,
                    Files = files
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    Message = "Không thể lấy danh sách file đính kèm",
                    Error = ex.InnerException?.Message ?? ex.Message
                });
            }
        }

        [HttpDelete("DeleteFileDinhKem/{congViecId}")]
        public async Task<IActionResult> DeleteFileDinhKem(int congViecId, [FromQuery] string filePath)
        {
            try
            {
                var congViec = await _context.CongViecs.FindAsync(congViecId);
                if (congViec == null)
                    return NotFound(new { Message = "Không tìm thấy công việc." });

                if (string.IsNullOrEmpty(congViec.FileDinhKem))
                    return BadRequest(new { Message = "Công việc này không có file đính kèm." });

                // Parse danh sách file hiện có
                var fileList = System.Text.Json.JsonSerializer.Deserialize<List<FileDinhKemDto>>(congViec.FileDinhKem)
                                ?? new List<FileDinhKemDto>();

                // Tìm file cần xóa
                var fileToDelete = fileList.FirstOrDefault(f => f.FilePath.Equals(filePath, StringComparison.OrdinalIgnoreCase));
                if (fileToDelete == null)
                    return NotFound(new { Message = "Không tìm thấy file cần xóa trong danh sách đính kèm." });

                // Xóa file trong thư mục vật lý
                var fullPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", fileToDelete.FilePath.TrimStart('/'));
                if (System.IO.File.Exists(fullPath))
                    System.IO.File.Delete(fullPath);

                // Cập nhật lại danh sách JSON
                fileList.Remove(fileToDelete);
                congViec.FileDinhKem = System.Text.Json.JsonSerializer.Serialize(fileList);

                _context.CongViecs.Update(congViec);
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    Message = "Xóa file đính kèm thành công",
                    CongViecId = congViecId,
                    DeletedFile = fileToDelete,
                    RemainingFiles = fileList
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    Message = "Xóa file đính kèm thất bại",
                    Error = ex.InnerException?.Message ?? ex.Message
                });
            }
        }



        [HttpDelete("DeleteCongViec/{congViecId}")]
        public async Task<IActionResult> DeleteCongViec(int congViecId)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var congViec = await _context.CongViecs.FindAsync(congViecId);
                if (congViec == null)
                    return NotFound(new { Message = "Công việc không tồn tại" });

                // Xóa các phân công liên quan
                var phanCongs = _context.PhanCongs.Where(p => p.CongViecId == congViecId);
                _context.PhanCongs.RemoveRange(phanCongs);

                // Xóa các bình luận liên quan
                var binhLuans = _context.BinhLuans.Where(b => b.CongViecId == congViecId);
                _context.BinhLuans.RemoveRange(binhLuans);

                // Xóa công việc
                _context.CongViecs.Remove(congViec);

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new { Message = "Xóa công việc thành công" });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest(new { Message = "Xóa công việc thất bại", Error = ex.InnerException?.Message ?? ex.Message });
            }
        }

        [HttpGet("GetCongViecsOfDuAn/{duAnId}")]
        public async Task<IActionResult> GetCongViecsOfDuAn(int duAnId)
        {
            // Kiểm tra dự án có tồn tại không
            var duAn = await _context.DuAns.FindAsync(duAnId);
            if (duAn == null)
                return NotFound(new { Message = "Dự án không tồn tại" });

            var congViecs = await _context.CongViecs
                .Where(cv => cv.DuAnId == duAnId)
                .Select(cv => new
                {
                    cv.CongViecId,
                    cv.TenCongViec,
                    cv.NgayBd,
                    cv.NgayKt,
                    cv.TrangThai,
                    cv.PhamTramHoanThanh,
                    cv.AnhBia
                })
                .ToListAsync();

            return Ok(new
            {
                DuAnID = duAn.DuAnId,
                TenDuAn = duAn.TenDuAn,
                CongViecs = congViecs
            });
        }

        [HttpPut("UpdateCongViec")]
        public async Task<IActionResult> UpdateCongViec([FromForm] UpdateCongViecRequest dto)
        {
            try
            {
                var congViec = await _context.CongViecs.FindAsync(dto.CongViecID);
                if (congViec == null)
                    return NotFound(new { Message = "Công việc không tồn tại" });

                congViec.TenCongViec = dto.TenCongViec;
                congViec.NgayBd = dto.NgayBD;
                congViec.NgayKt = dto.NgayKT;                
                

                if (dto.DuAnID.HasValue)
                {
                    var duAn = await _context.DuAns.FindAsync(dto.DuAnID.Value);
                    if (duAn == null)
                        return BadRequest(new { Message = "Dự án không tồn tại" });
                    congViec.DuAnId = dto.DuAnID;
                }

                // Xử lý ảnh bìa mới
                if (dto.AnhBia != null && dto.AnhBia.Length > 0)
                {
                    var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot/uploads/congviec");
                    if (!Directory.Exists(uploadsFolder))
                        Directory.CreateDirectory(uploadsFolder);

                    var uniqueFileName = $"{Guid.NewGuid()}_{dto.AnhBia.FileName}";
                    var fullPath = Path.Combine(uploadsFolder, uniqueFileName);

                    using var fileStream = new FileStream(fullPath, FileMode.Create);
                    await dto.AnhBia.CopyToAsync(fileStream);

                    congViec.AnhBia = $"/uploads/congviec/{uniqueFileName}";
                }

                _context.CongViecs.Update(congViec);
                await _context.SaveChangesAsync();

                return Ok(new { Message = "Cập nhật công việc thành công", CongViecID = congViec.CongViecId, AnhBia = congViec.AnhBia });
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = "Cập nhật công việc thất bại", Error = ex.InnerException?.Message ?? ex.Message });
            }
        }


        [HttpPut("UpdateTrangThai")]
        public async Task<IActionResult> UpdateTrangThai([FromBody] UpdateTrangThaiRequest dto)
        {
            try
            {
                var congViec = await _context.CongViecs.FindAsync(dto.CongViecID);
                if (congViec == null)
                    return NotFound(new { Message = "Công việc không tồn tại" });

                congViec.TrangThai = dto.TrangThai;

                _context.CongViecs.Update(congViec);
                await _context.SaveChangesAsync();

                return Ok(new { Message = "Cập nhật công việc thành công", CongViecID = congViec.CongViecId, AnhBia = congViec.AnhBia });
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = "Cập nhật công việc thất bại", Error = ex.InnerException?.Message ?? ex.Message });
            }
        }

        [HttpPut("CapNhatTienDoCongViec/{congViecId}")]
        public async Task<IActionResult> CapNhatTienDoCongViec(int congViecId)
        {
            try
            {
                var congViec = await _context.CongViecs.FirstOrDefaultAsync(cv => cv.CongViecId == congViecId);
                if (congViec == null)
                    return NotFound(new { Message = "Không tìm thấy công việc tương ứng." });

                var danhSachPhanCong = await _context.PhanCongs
                    .Where(p => p.CongViecId == congViecId)
                    .ToListAsync();

                if (!danhSachPhanCong.Any())
                    return Ok(new { Message = "Công việc chưa có phân công nào.", TienDoCongViec = "0%" });

                double tongTienDo = 0;
                int tongSubTask = 0;

                foreach (var phanCong in danhSachPhanCong)
                {
                    if (string.IsNullOrEmpty(phanCong.NoiDungPhanCong))
                        continue;

                    var subTasks = JsonSerializer.Deserialize<List<JsonElement>>(phanCong.NoiDungPhanCong);
                    if (subTasks == null) continue;

                    foreach (var st in subTasks)
                    {
                        var subTask = JsonSerializer.Deserialize<Dictionary<string, object>>(st.GetRawText());
                        if (subTask.ContainsKey("TienDoHoanThanh"))
                        {
                            string tienDoStr = subTask["TienDoHoanThanh"]?.ToString()?.Trim() ?? "0";
                            if (tienDoStr.EndsWith("%"))
                                tienDoStr = tienDoStr.Substring(0, tienDoStr.Length - 1);

                            if (double.TryParse(tienDoStr, out double tienDo))
                            {
                                tongTienDo += Math.Clamp(tienDo, 0, 100);
                                tongSubTask++;
                            }
                        }
                    }
                }

                double tiLeHoanThanh = tongSubTask > 0
                    ? Math.Round(tongTienDo / tongSubTask, 2)
                    : 0;

                // --- Cập nhật vào bảng Công Việc ---
                congViec.PhamTramHoanThanh = tiLeHoanThanh;
                _context.CongViecs.Update(congViec);
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    Message = "Cập nhật tiến độ công việc thành công.",
                    CongViecId = congViecId,
                    TongSoPhanCong = danhSachPhanCong.Count,
                    TongSoSubTask = tongSubTask,
                    TienDoCongViec = $"{tiLeHoanThanh}%"
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    Message = "Cập nhật tiến độ công việc thất bại.",
                    Error = ex.InnerException?.Message ?? ex.Message
                });
            }
        }

        // 🟢 Lấy danh sách trạng thái của dự án
        [HttpGet("{duanId}/trangthai")]
        public async Task<IActionResult> GetTrangThaiDuAn(int duanId)
        {
            var key = $"workflow:duan:{duanId}";
            var json = await _cache.GetStringAsync(key);

            List<string> trangThais;

            if (string.IsNullOrEmpty(json))
            {
                // Mặc định 4 trạng thái chuẩn
                trangThais = new List<string>
            {
                "Chưa bắt đầu",
                "Đang làm",
                "Hoàn thành",
                "Trễ hạn"
            };

                await _cache.SetStringAsync(key, JsonSerializer.Serialize(trangThais));
            }
            else
            {
                trangThais = JsonSerializer.Deserialize<List<string>>(json);
            }

            return Ok(trangThais);
        }

        // 🟡 Thêm trạng thái mới
        [HttpPost("{duanId}/trangthai")]
        public async Task<IActionResult> AddTrangThai(int duanId, [FromBody] string tenTrangThai)
        {
            if (string.IsNullOrWhiteSpace(tenTrangThai))
                return BadRequest("Tên trạng thái không được để trống");

            var key = $"workflow:duan:{duanId}";
            var json = await _cache.GetStringAsync(key);
            var trangThais = string.IsNullOrEmpty(json)
                ? new List<string>()
                : JsonSerializer.Deserialize<List<string>>(json);

            if (trangThais.Contains(tenTrangThai, StringComparer.OrdinalIgnoreCase))
                return BadRequest("Trạng thái đã tồn tại");

            trangThais.Add(tenTrangThai);
            await _cache.SetStringAsync(key, JsonSerializer.Serialize(trangThais));

            return Ok(new { Message = "Đã thêm trạng thái mới", TrangThais = trangThais });
        }

        // 🔴 Xoá trạng thái (nếu không phải mặc định)
        [HttpDelete("{duanId}/trangthai/{tenTrangThai}")]
        public async Task<IActionResult> DeleteTrangThai(int duanId, string tenTrangThai)
        {
            var key = $"workflow:duan:{duanId}";
            var json = await _cache.GetStringAsync(key);

            if (string.IsNullOrEmpty(json))
                return NotFound("Chưa có dữ liệu workflow cho dự án này");

            var trangThais = JsonSerializer.Deserialize<List<string>>(json);
            var macDinh = new[] { "Chưa bắt đầu", "Đang làm", "Hoàn thành", "Trễ hạn" };

            // 🟡 Không cho xoá trạng thái mặc định
            if (macDinh.Contains(tenTrangThai))
                return BadRequest("Không thể xóa trạng thái mặc định");

            // 🟢 Nếu không tồn tại thì báo lỗi
            if (!trangThais.Remove(tenTrangThai))
                return NotFound("Trạng thái không tồn tại");

            // 🧠 Lưu lại danh sách mới vào Redis
            await _cache.SetStringAsync(key, JsonSerializer.Serialize(trangThais));

            // 🔄 Cập nhật các công việc có trạng thái bị xoá
            // Nếu tiến độ > 0% → "Đang làm", nếu = 0% → "Chưa bắt đầu"
            var congViecs = await _context.CongViecs
                .Where(cv => cv.DuAnId == duanId && cv.TrangThai == tenTrangThai)
                .ToListAsync();

            foreach (var cv in congViecs)
            {
                cv.TrangThai = (cv.PhamTramHoanThanh ?? 0) > 0 ? "Đang làm" : "Chưa bắt đầu";
            }

            await _context.SaveChangesAsync();

            // ✅ Trả kết quả
            var chuaBatDauCount = congViecs.Count(cv => cv.TrangThai == "Chưa bắt đầu");
            var dangLamCount = congViecs.Count(cv => cv.TrangThai == "Đang làm");

            return Ok(new
            {
                Message = $"Đã xóa trạng thái '{tenTrangThai}' và cập nhật {congViecs.Count} công việc ({chuaBatDauCount} về 'Chưa bắt đầu', {dangLamCount} về 'Đang làm').",
                TrangThais = trangThais
            });
        }

        // API: Lấy công việc theo stat type (cho modal chi tiết)
        [HttpGet("GetCongViecsByStat/{duAnId}/{statType}")]
        public async Task<IActionResult> GetCongViecsByStat(int duAnId, string statType)
        {
            try
            {
                // Kiểm tra dự án có tồn tại không
                var duAn = await _context.DuAns.FindAsync(duAnId);
                if (duAn == null)
                    return NotFound(new { message = "Dự án không tồn tại" });

                // Nếu dự án tạm dừng, không trả về công việc nào
                if (duAn.TrangThai == "Tạm dừng")
                {
                    return Ok(new
                    {
                        duAnId = duAn.DuAnId,
                        tenDuAn = duAn.TenDuAn,
                        trangThaiDuAn = duAn.TrangThai,
                        congViecs = new List<object>()
                    });
                }

                var today = DateOnly.FromDateTime(DateTime.Today);

                // Lấy tất cả công việc của dự án - xử lý tất cả trong memory
                var allCongViecs = await _context.CongViecs
                    .Where(cv => cv.DuAnId == duAnId)
                    .ToListAsync();

                object result;

                switch (statType.ToLower())
                {
                    case "dangthuchien":
                        // Công việc đang thực hiện
                        result = allCongViecs
                            .Where(cv => cv.TrangThai == "Đang thực hiện" || cv.TrangThai == "Đang làm")
                            .Select(cv => new
                            {
                                congViecId = cv.CongViecId,
                                tenCongViec = cv.TenCongViec,
                                trangThai = cv.TrangThai ?? "Chưa xác định",
                                phamTramHoanThanh = cv.PhamTramHoanThanh ?? 0,
                                ngayBatDau = cv.NgayBd,
                                ngayKetThuc = cv.NgayKt,
                                soNgayConLai = cv.NgayKt.HasValue 
                                    ? (int?)(cv.NgayKt.Value.DayNumber - today.DayNumber) 
                                    : (int?)null
                            })
                            .OrderBy(cv => cv.soNgayConLai)
                            .ToList();
                        break;

                    case "tongcongviec":
                        // Tất cả công việc
                        result = allCongViecs
                            .Select(cv => new
                            {
                                congViecId = cv.CongViecId,
                                tenCongViec = cv.TenCongViec,
                                trangThai = cv.TrangThai ?? "Chưa xác định",
                                phamTramHoanThanh = cv.PhamTramHoanThanh ?? 0,
                                ngayBatDau = cv.NgayBd,
                                ngayKetThuc = cv.NgayKt,
                                soNgayConLai = cv.NgayKt.HasValue 
                                    ? (int?)(cv.NgayKt.Value.DayNumber - today.DayNumber) 
                                    : (int?)null
                            })
                            .OrderBy(cv => cv.trangThai)
                            .ThenBy(cv => cv.soNgayConLai)
                            .ToList();
                        break;

                    case "congviechoanthanh":
                        // Công việc đã hoàn thành
                        result = allCongViecs
                            .Where(cv => (cv.PhamTramHoanThanh ?? 0) >= 100 || cv.TrangThai == "Hoàn thành")
                            .Select(cv => new
                            {
                                congViecId = cv.CongViecId,
                                tenCongViec = cv.TenCongViec,
                                trangThai = cv.TrangThai ?? "Hoàn thành",
                                phamTramHoanThanh = cv.PhamTramHoanThanh ?? 100,
                                ngayBatDau = cv.NgayBd,
                                ngayKetThuc = cv.NgayKt
                            })
                            .OrderByDescending(cv => cv.ngayKetThuc)
                            .ToList();
                        break;

                    case "congviecquahan":
                        // Công việc quá hạn
                        result = allCongViecs
                            .Where(cv => cv.NgayKt.HasValue && 
                                         cv.NgayKt.Value.DayNumber < today.DayNumber &&
                                         (cv.PhamTramHoanThanh ?? 0) < 100)
                            .Select(cv => new
                            {
                                congViecId = cv.CongViecId,
                                tenCongViec = cv.TenCongViec,
                                trangThai = cv.TrangThai ?? "Quá hạn",
                                phamTramHoanThanh = cv.PhamTramHoanThanh ?? 0,
                                ngayBatDau = cv.NgayBd,
                                ngayKetThuc = cv.NgayKt,
                                soNgayQuaHan = today.DayNumber - cv.NgayKt.Value.DayNumber
                            })
                            .OrderByDescending(cv => cv.soNgayQuaHan)
                            .ToList();
                        break;

                    case "congvieckhancap":
                        // Công việc khẩn cấp (còn <= 3 ngày)
                        result = allCongViecs
                            .Where(cv => cv.NgayKt.HasValue &&
                                         cv.NgayKt.Value.DayNumber - today.DayNumber <= 3 &&
                                         cv.NgayKt.Value.DayNumber - today.DayNumber >= 0 &&
                                         (cv.PhamTramHoanThanh ?? 0) < 100)
                            .Select(cv => new
                            {
                                congViecId = cv.CongViecId,
                                tenCongViec = cv.TenCongViec,
                                trangThai = cv.TrangThai ?? "Khẩn cấp",
                                phamTramHoanThanh = cv.PhamTramHoanThanh ?? 0,
                                ngayBatDau = cv.NgayBd,
                                ngayKetThuc = cv.NgayKt,
                                soNgayConLai = cv.NgayKt.Value.DayNumber - today.DayNumber
                            })
                            .OrderBy(cv => cv.soNgayConLai)
                            .ToList();
                        break;

                    default:
                        return BadRequest(new { message = "Loại thống kê không hợp lệ. Các giá trị được chấp nhận: dangthuchien, tongcongviec, congviechoanthanh, congviecquahan, congvieckhancap" });
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new 
                { 
                    message = "Lỗi khi lấy danh sách công việc",
                    error = ex.Message,
                    innerError = ex.InnerException?.Message,
                    stackTrace = ex.StackTrace
                });
            }
        }

    }
}
