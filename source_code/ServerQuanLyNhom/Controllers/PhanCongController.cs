using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using ServerQuanLyNhom.DTOs.PhanCongs;
using ServerQuanLyNhom.Models;
using ServerQuanLyNhom.Services;
using ServerQuanLyNhom.Services.Email;
using System.Text.Json;

namespace ServerQuanLyNhom.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PhanCongController : ControllerBase
    {
        private readonly QuanLyCongViecNhomContext _context;
        private readonly OtpService _otpService;
        private readonly EmailService _emailService;
        private readonly IMemoryCache _cache;

        public PhanCongController(QuanLyCongViecNhomContext context, OtpService otpService, EmailService emailService, IMemoryCache cache)
        {
            _context = context;
            _otpService = otpService;
            _emailService = emailService;
            _cache = cache;
        }

        [HttpPost("AddPhanCongItem/{congViecId}/{thanhVienId}")]
        public async Task<IActionResult> AddPhanCongItem(int congViecId, int thanhVienId, [FromBody] PhanCongItemRequest newItem)
        {
            try
            {
                if (newItem.SubTaskId == "string")
                    newItem.SubTaskId = Guid.NewGuid().ToString();

                newItem.KetQuaThucHien = new KetQuaThucHienRequest();
                newItem.KetQuaThucHien.File ??= new List<string>();

                var phanCong = await _context.PhanCongs
                    .FirstOrDefaultAsync(p => p.CongViecId == congViecId && p.ThanhVienId == thanhVienId);

                List<PhanCongItemRequest> currentList;

                if (phanCong == null)
                {
                    // Nếu chưa có phân công nào cho cặp này, tạo mới
                    currentList = new List<PhanCongItemRequest> { newItem };

                    phanCong = new PhanCong
                    {
                        CongViecId = congViecId,
                        ThanhVienId = thanhVienId,
                        NoiDungPhanCong = JsonSerializer.Serialize(currentList)
                    };

                    _context.PhanCongs.Add(phanCong);
                }
                else
                {
                    // Deserialize JSON hiện tại
                    if (string.IsNullOrEmpty(phanCong.NoiDungPhanCong))
                        currentList = new List<PhanCongItemRequest>();
                    else
                        currentList = JsonSerializer.Deserialize<List<PhanCongItemRequest>>(phanCong.NoiDungPhanCong) ?? new List<PhanCongItemRequest>();

                    // Đảm bảo cấu trúc KetQuaThucHien không null
                    foreach (var item in currentList)
                    {
                        item.KetQuaThucHien ??= new KetQuaThucHienRequest();
                        item.KetQuaThucHien.File ??= new List<string>();
                    }

                    // Append item mới
                    currentList.Add(newItem);

                    // Serialize lại
                    phanCong.NoiDungPhanCong = JsonSerializer.Serialize(currentList);

                    _context.PhanCongs.Update(phanCong);
                }

                await _context.SaveChangesAsync();
                return Ok(new { Message = "Thêm phân công con thành công", NoiDungPhanCong = currentList });
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = "Thêm phân công con thất bại", Error = ex.InnerException?.Message ?? ex.Message });
            }
        }

        [HttpPut("UpdatePhanCongItem/{congViecId}/{thanhVienId}")]
        public async Task<IActionResult> UpdatePhanCongItem(int congViecId, int thanhVienId, [FromBody] UpdatePhanCongItemRequest dto)
        {
            try
            {
                var phanCong = await _context.PhanCongs
                    .FirstOrDefaultAsync(p => p.CongViecId == congViecId && p.ThanhVienId == thanhVienId);

                if (phanCong == null)
                    return NotFound(new { Message = "Phân công không tồn tại" });

                var currentList = string.IsNullOrEmpty(phanCong.NoiDungPhanCong)
                    ? new List<PhanCongItemRequest>()
                    : JsonSerializer.Deserialize<List<PhanCongItemRequest>>(phanCong.NoiDungPhanCong) ?? new List<PhanCongItemRequest>();

                // Tìm subtask theo subTaskId
                var existingItem = currentList.FirstOrDefault(x => x.SubTaskId == dto.SubTaskId);
                if (existingItem == null)
                    return NotFound(new { Message = "Không tìm thấy sub-task với ID đã cho" });

                // Update item
                existingItem.MoTa = dto.MoTa ?? existingItem.MoTa;
                existingItem.NgayPC = dto.NgayPC != default ? dto.NgayPC : existingItem.NgayPC;
                existingItem.DoUuTien = dto.DoUuTien ?? existingItem.DoUuTien;

                phanCong.NoiDungPhanCong = JsonSerializer.Serialize(currentList);
                _context.PhanCongs.Update(phanCong);
                await _context.SaveChangesAsync();

                return Ok(new { Message = "Cập nhật phân công con thành công", NoiDungPhanCong = currentList });
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = "Cập nhật thất bại", Error = ex.InnerException?.Message ?? ex.Message });
            }
        }

        [HttpDelete("DeletePhanCongItem/{congViecId}/{thanhVienId}/{subTaskId}")]
        public async Task<IActionResult> DeletePhanCongItem(int congViecId, int thanhVienId, string subTaskId)
        {
            try
            {
                // 1️⃣ Tìm bản ghi Phân Công tương ứng
                var phanCong = await _context.PhanCongs
                    .FirstOrDefaultAsync(p => p.CongViecId == congViecId && p.ThanhVienId == thanhVienId);

                if (phanCong == null)
                    return NotFound(new { Message = "Phân công không tồn tại" });

                // 2️⃣ Parse JSON nội dung phân công thành danh sách object
                var currentList = string.IsNullOrEmpty(phanCong.NoiDungPhanCong)
                    ? new List<PhanCongItemRequest>()
                    : System.Text.Json.JsonSerializer.Deserialize<List<PhanCongItemRequest>>(phanCong.NoiDungPhanCong) ?? new List<PhanCongItemRequest>();

                // 3️⃣ Tìm sub-task cần xóa
                var subTask = currentList.FirstOrDefault(x => x.SubTaskId == subTaskId);
                if (subTask == null)
                    return NotFound(new { Message = "Sub-task không tồn tại trong phân công này" });

                // 4️⃣ Xóa sub-task khỏi danh sách
                currentList.Remove(subTask);

                // 5️⃣ Cập nhật lại JSON
                phanCong.NoiDungPhanCong = System.Text.Json.JsonSerializer.Serialize(currentList);

                _context.PhanCongs.Update(phanCong);
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    Message = "Xóa phân công con thành công",
                    NoiDungPhanCong = currentList
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    Message = "Xóa thất bại",
                    Error = ex.InnerException?.Message ?? ex.Message
                });
            }
        }


        [HttpGet("GetPhanCongOfCongViec/{congViecId}")]
        public async Task<IActionResult> GetPhanCongOfCongViec(int congViecId)
        {
            // Lấy tất cả phân công liên quan tới công việc này
            var phanCongs = await _context.PhanCongs
                .Where(p => p.CongViecId == congViecId)
                .Include(p => p.ThanhVien) // nếu muốn lấy info thành viên
                .ToListAsync();

            var result = phanCongs.Select(p => new
            {
                p.ThanhVienId,
                HoTen = p.ThanhVien.HoTen,
                NoiDungPhanCong = string.IsNullOrEmpty(p.NoiDungPhanCong)
                    ? new List<PhanCongItemRequest>()
                    : JsonSerializer.Deserialize<List<PhanCongItemRequest>>(p.NoiDungPhanCong)
            });

            return Ok(result);
        }

        [HttpPut("ChuyenNguoiPhanCong")]
        public async Task<IActionResult> ChuyenNguoiPhanCong([FromBody] ChuyenPhanCongRequest dto)
        {
            try
            {
                // Lấy phân công hiện tại của người cũ
                var phanCongCu = await _context.PhanCongs
                    .FirstOrDefaultAsync(p => p.CongViecId == dto.CongViecId && p.ThanhVienId == dto.ThanhVienCuId);

                if (phanCongCu == null)
                    return NotFound(new { Message = "Không tìm thấy phân công của người cũ." });

                // Parse JSON nội dung phân công
                var noiDungCu = string.IsNullOrEmpty(phanCongCu.NoiDungPhanCong)
                    ? new List<PhanCongItemRequest>()
                    : JsonSerializer.Deserialize<List<PhanCongItemRequest>>(phanCongCu.NoiDungPhanCong) ?? new List<PhanCongItemRequest>();

                // Tìm task cần chuyển
                var taskCanChuyen = noiDungCu
                    .Where(x => dto.SubTaskIds.Contains(x.SubTaskId))
                    .ToList();

                if (!taskCanChuyen.Any())
                    return BadRequest(new { Message = "Không có task nào hợp lệ để chuyển." });

                // Xóa task khỏi người cũ
                noiDungCu.RemoveAll(x => dto.SubTaskIds.Contains(x.SubTaskId));
                phanCongCu.NoiDungPhanCong = JsonSerializer.Serialize(noiDungCu);

                // Lấy hoặc tạo mới phân công cho người mới
                var phanCongMoi = await _context.PhanCongs
                    .FirstOrDefaultAsync(p => p.CongViecId == dto.CongViecId && p.ThanhVienId == dto.ThanhVienMoiId);

                List<PhanCongItemRequest> noiDungMoi;

                if (phanCongMoi == null)
                {
                    noiDungMoi = taskCanChuyen;
                    phanCongMoi = new PhanCong
                    {
                        CongViecId = dto.CongViecId,
                        ThanhVienId = dto.ThanhVienMoiId,
                        NoiDungPhanCong = JsonSerializer.Serialize(noiDungMoi)
                    };
                    _context.PhanCongs.Add(phanCongMoi);
                }
                else
                {
                    noiDungMoi = string.IsNullOrEmpty(phanCongMoi.NoiDungPhanCong)
                        ? new List<PhanCongItemRequest>()
                        : JsonSerializer.Deserialize<List<PhanCongItemRequest>>(phanCongMoi.NoiDungPhanCong) ?? new List<PhanCongItemRequest>();

                    noiDungMoi.AddRange(taskCanChuyen);
                    phanCongMoi.NoiDungPhanCong = JsonSerializer.Serialize(noiDungMoi);
                    _context.PhanCongs.Update(phanCongMoi);
                }

                _context.PhanCongs.Update(phanCongCu);
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    Message = "Đã chuyển người phân công thành công.",
                    TuThanhVienId = dto.ThanhVienCuId,
                    DenThanhVienId = dto.ThanhVienMoiId,
                    TaskDaChuyen = taskCanChuyen.Select(x => x.MoTa)
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = "Chuyển người phân công thất bại", Error = ex.Message });
            }
        }

        [HttpPost("BaoCaoTienDoUpload")]
        public async Task<IActionResult> BaoCaoTienDoUpload([FromForm] BaoCaoTienDoUploadRequest request)
        {
            try
            {
                var phanCong = await _context.PhanCongs
                    .FirstOrDefaultAsync(p => p.CongViecId == request.CongViecId && p.ThanhVienId == request.ThanhVienId);

                if (phanCong == null)
                    return NotFound(new { Message = "Không tìm thấy phân công tương ứng." });

                // Deserialize JSON
                var subTasks = string.IsNullOrEmpty(phanCong.NoiDungPhanCong)
                    ? new List<PhanCongItemRequest>()
                    : JsonSerializer.Deserialize<List<PhanCongItemRequest>>(phanCong.NoiDungPhanCong) ?? new List<PhanCongItemRequest>();

                var targetSubTask = subTasks.FirstOrDefault(st => st.SubTaskId == request.SubTaskId);

                if (targetSubTask == null)
                    return NotFound(new { Message = "Không tìm thấy sub-task tương ứng." });

                targetSubTask.KetQuaThucHien ??= new KetQuaThucHienRequest();

                if (request.NoiDung != null)
                {
                    targetSubTask.KetQuaThucHien.NoiDung = request.NoiDung;
                }

                // --- Xử lý upload file ---
                var uploadDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "baocao");
                if (!Directory.Exists(uploadDir))
                    Directory.CreateDirectory(uploadDir);

                var savedFiles = new List<string>();

                foreach (var file in request.Files)
                {
                    if (file.Length > 0)
                    {
                        string fileName = $"{Guid.NewGuid()}_{Path.GetFileName(file.FileName)}";
                        string filePath = Path.Combine(uploadDir, fileName);

                        using (var stream = new FileStream(filePath, FileMode.Create))
                        {
                            await file.CopyToAsync(stream);
                        }

                        // URL để client hiển thị
                        string fileUrl = $"/uploads/baocao/{fileName}";
                        savedFiles.Add(fileUrl);
                    }
                }

                // --- Cập nhật JSON ---
                targetSubTask.KetQuaThucHien.File ??= new List<string>();
                targetSubTask.KetQuaThucHien.File.AddRange(savedFiles);

                // Serialize lại toàn bộ JSON
                phanCong.NoiDungPhanCong = JsonSerializer.Serialize(subTasks);
                _context.PhanCongs.Update(phanCong);
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    Message = "Upload và cập nhật báo cáo tiến độ thành công",
                    UploadedFiles = savedFiles,
                    UpdatedSubTask = targetSubTask
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    Message = "Báo cáo tiến độ thất bại",
                    Error = ex.InnerException?.Message ?? ex.Message
                });
            }
        }

        [HttpDelete("XoaFileBaoCao")]
        public async Task<IActionResult> XoaFileBaoCao([FromBody] XoaFileBaoCaoRequest request)
        {
            try
            {
                var phanCong = await _context.PhanCongs
                    .FirstOrDefaultAsync(p => p.CongViecId == request.CongViecId && p.ThanhVienId == request.ThanhVienId);

                if (phanCong == null)
                    return NotFound(new { Message = "Không tìm thấy phân công tương ứng." });

                // Deserialize JSON
                var subTasks = string.IsNullOrEmpty(phanCong.NoiDungPhanCong)
                    ? new List<PhanCongItemRequest>()
                    : JsonSerializer.Deserialize<List<PhanCongItemRequest>>(phanCong.NoiDungPhanCong) ?? new List<PhanCongItemRequest>();

                var targetSubTask = subTasks.FirstOrDefault(st => st.SubTaskId == request.SubTaskId);

                if (targetSubTask == null)
                    return NotFound(new { Message = "Không tìm thấy sub-task tương ứng." });

                targetSubTask.KetQuaThucHien ??= new KetQuaThucHienRequest();
                targetSubTask.KetQuaThucHien.File ??= new List<string>();

                // --- Xóa file trong danh sách ---
                if (!targetSubTask.KetQuaThucHien.File.Contains(request.FileUrl))
                    return NotFound(new { Message = "Không tìm thấy file cần xóa trong sub-task." });

                targetSubTask.KetQuaThucHien.File.Remove(request.FileUrl);

                // --- Xóa file vật lý ---
                var physicalPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", request.FileUrl.TrimStart('/'));
                if (System.IO.File.Exists(physicalPath))
                    System.IO.File.Delete(physicalPath);

                // --- Cập nhật JSON ---
                phanCong.NoiDungPhanCong = JsonSerializer.Serialize(subTasks);
                _context.PhanCongs.Update(phanCong);
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    Message = "Xóa file báo cáo thành công.",
                    DeletedFile = request.FileUrl,
                    UpdatedSubTask = targetSubTask
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    Message = "Xóa file báo cáo thất bại.",
                    Error = ex.InnerException?.Message ?? ex.Message
                });
            }
        }


        [HttpPut("DanhGiaTienDo")]
        public async Task<IActionResult> DanhGiaTienDo([FromBody] DanhGiaTienDoRequest request)
        {
            try
            {
                var phanCong = await _context.PhanCongs
                    .FirstOrDefaultAsync(p => p.CongViecId == request.CongViecId && p.ThanhVienId == request.ThanhVienId);

                if (phanCong == null)
                    return NotFound(new { Message = "Không tìm thấy phân công tương ứng." });

                if (string.IsNullOrEmpty(phanCong.NoiDungPhanCong))
                    return BadRequest(new { Message = "Không có nội dung phân công để đánh giá." });

                // Deserialize JSON
                var subTasks = string.IsNullOrEmpty(phanCong.NoiDungPhanCong)
                    ? new List<PhanCongItemRequest>()
                    : JsonSerializer.Deserialize<List<PhanCongItemRequest>>(phanCong.NoiDungPhanCong) ?? new List<PhanCongItemRequest>();

                var targetSubTask = subTasks.FirstOrDefault(st => st.SubTaskId == request.SubTaskId);

                if (targetSubTask == null)
                    return NotFound(new { Message = "Không tìm thấy sub-task tương ứng." });

                targetSubTask.KetQuaThucHien ??= new KetQuaThucHienRequest();
                targetSubTask.DanhGia = request.DanhGia;

                // Serialize lại toàn bộ JSON
                phanCong.NoiDungPhanCong = JsonSerializer.Serialize(subTasks);

                _context.PhanCongs.Update(phanCong);
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    Message = "Cập nhật đánh giá và tiến độ thành công.",
                    SubTaskId = request.SubTaskId,
                    NewDanhGia = request.DanhGia
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    Message = "Cập nhật thất bại.",
                    Error = ex.InnerException?.Message ?? ex.Message
                });
            }
        }

        [HttpPut("ToggleLockSubTask")]
        public async Task<IActionResult> ToggleLockSubTask([FromBody] ToggleLockSubTaskRequest request)
        {
            try
            {
                var phanCong = await _context.PhanCongs
                    .FirstOrDefaultAsync(p => p.CongViecId == request.CongViecId && p.ThanhVienId == request.ThanhVienId);

                if (phanCong == null)
                    return NotFound(new { Message = "Không tìm thấy phân công tương ứng." });

                if (string.IsNullOrEmpty(phanCong.NoiDungPhanCong))
                    return BadRequest(new { Message = "Không có nội dung phân công." });

                var subTasks = JsonSerializer.Deserialize<List<PhanCongItemRequest>>(phanCong.NoiDungPhanCong) ?? new List<PhanCongItemRequest>();
                var targetSubTask = subTasks.FirstOrDefault(st => st.SubTaskId == request.SubTaskId);

                if (targetSubTask == null)
                    return NotFound(new { Message = "Không tìm thấy sub-task tương ứng." });

                targetSubTask.TrangThaiKhoa = request.TrangThaiKhoa == 1;

                phanCong.NoiDungPhanCong = JsonSerializer.Serialize(subTasks);
                _context.PhanCongs.Update(phanCong);
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    Message = request.TrangThaiKhoa == 1 ? "Đã khóa subtask thành công." : "Đã mở khóa subtask thành công.",
                    SubTaskId = request.SubTaskId,
                    TrangThaiKhoa = request.TrangThaiKhoa
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    Message = "Cập nhật trạng thái khóa thất bại.",
                    Error = ex.InnerException?.Message ?? ex.Message
                });
            }
        }

        [HttpPut("CapNhatTienDoHoanThanh")]
        public async Task<IActionResult> CapNhatTienDoHoanThanh([FromBody] CapNhatTienDoRequest request)
        {
            try
            {
                var phanCong = await _context.PhanCongs
                    .FirstOrDefaultAsync(p => p.CongViecId == request.CongViecId && p.ThanhVienId == request.ThanhVienId);

                if (phanCong == null)
                    return NotFound(new { Message = "Không tìm thấy phân công tương ứng." });

                if (string.IsNullOrEmpty(phanCong.NoiDungPhanCong))
                    return BadRequest(new { Message = "Không có nội dung phân công để cập nhật tiến độ." });

                var subTasks = JsonSerializer.Deserialize<List<PhanCongItemRequest>>(phanCong.NoiDungPhanCong) ?? new List<PhanCongItemRequest>();

                var targetSubTask = subTasks.FirstOrDefault(st => st.SubTaskId == request.SubTaskId);

                if (targetSubTask == null)
                    return NotFound(new { Message = "Không tìm thấy sub-task tương ứng." });

                targetSubTask.TienDoHoanThanh = request.TienDoHoanThanh;

                phanCong.NoiDungPhanCong = JsonSerializer.Serialize(subTasks);
                _context.PhanCongs.Update(phanCong);
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    Message = "Cập nhật tiến độ thành công.",
                    SubTaskId = request.SubTaskId,
                    NewTienDo = targetSubTask.TienDoHoanThanh
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    Message = "Cập nhật tiến độ thất bại.",
                    Error = ex.InnerException?.Message ?? ex.Message
                });
            }
        }

        [HttpGet("GetAllSubTasksInProject/{duAnId}/{thanhVienId}")]
        public async Task<IActionResult> GetAllSubTasksInProject(int duAnId, int thanhVienId)
        {
            try
            {
                // 1️⃣ Lấy tất cả công việc thuộc dự án và có phân công cho thành viên này
                var phanCongs = await _context.PhanCongs
                    .Include(p => p.CongViec)
                    .Where(p => p.ThanhVienId == thanhVienId && p.CongViec.DuAnId == duAnId)
                    .ToListAsync();

                if (!phanCongs.Any())
                    return NotFound(new { Message = "Không tìm thấy công việc nào trong dự án này cho thành viên." });

                // 2️⃣ Chuẩn bị danh sách kết quả
                var result = new List<object>();

                foreach (var phanCong in phanCongs)
                {
                    var options = new JsonSerializerOptions
                    {
                        Converters = { new ServerQuanLyNhom.DTOs.PhanCongs.BooleanJsonConverter() }
                    };

                    var subTasks = string.IsNullOrEmpty(phanCong.NoiDungPhanCong)
                        ? new List<PhanCongItemRequest>()
                        : System.Text.Json.JsonSerializer.Deserialize<List<PhanCongItemRequest>>(phanCong.NoiDungPhanCong, options);

                    result.Add(new
                    {
                        CongViec = new
                        {
                            phanCong.CongViecId,
                            phanCong.CongViec?.TenCongViec,
                            phanCong.CongViec?.TrangThai,
                            NgayBatDau = phanCong.CongViec?.NgayBd?.ToString("yyyy-MM-dd"),
                            NgayKetThuc = phanCong.CongViec?.NgayKt?.ToString("yyyy-MM-dd")
                        },
                        ThanhVienId = thanhVienId,
                        SoLuongSubTask = subTasks.Count,
                        SubTasks = subTasks
                    });
                }

                // 3️⃣ Trả về kết quả
                return Ok(new
                {
                    Message = "Lấy danh sách công việc và sub-task của thành viên trong dự án thành công",
                    DuAnId = duAnId,
                    TongSoCongViec = result.Count,
                    DanhSachCongViec = result
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    Message = "Lấy danh sách thất bại",
                    Error = ex.InnerException?.Message ?? ex.Message
                });
            }
        }

        [HttpGet("phancong/duan/{duAnId}")]
        public async Task<IActionResult> LayTatCaPhanCongTheoDuAn(int duAnId)
        {
            try
            {
                var duAn = await _context.DuAns
                    .Include(da => da.CongViecs)
                        .ThenInclude(cv => cv.PhanCongs)
                            .ThenInclude(pc => pc.ThanhVien)
                                .ThenInclude(tv => tv.ChuyenMon)
                    .FirstOrDefaultAsync(da => da.DuAnId == duAnId);

                if (duAn == null)
                    return NotFound(new { Message = "Dự án không tồn tại." });

                // Map dữ liệu trả về
                var options = new JsonSerializerOptions
                {
                    Converters = { new ServerQuanLyNhom.DTOs.PhanCongs.BooleanJsonConverter() }
                };

                var ketQua = duAn.CongViecs.Select(cv => new
                {
                    cv.CongViecId,
                    cv.TenCongViec,
                    cv.TrangThai,
                    cv.PhamTramHoanThanh,
                    cv.NgayBd,
                    cv.NgayKt,

                    DanhSachPhanCong = cv.PhanCongs.Select(pc => new
                    {
                        pc.ThanhVienId,
                        HoTen = pc.ThanhVien?.HoTen,
                        ChuyenMon = pc.ThanhVien?.ChuyenMon?.TenChuyenMon,
                        NoiDungPhanCong = string.IsNullOrEmpty(pc.NoiDungPhanCong)
                            ? new List<PhanCongItemRequest>()
                            : JsonSerializer.Deserialize<List<PhanCongItemRequest>>(pc.NoiDungPhanCong, options) ?? new List<PhanCongItemRequest>()
                    }).ToList()
                }).ToList();

                return Ok(new
                {
                    DuAnID = duAn.DuAnId,
                    duAn.TenDuAn,
                    duAn.TrangThai,
                    SoLuongCongViec = duAn.CongViecs.Count,
                    TongPhanCong = duAn.CongViecs.Sum(cv => cv.PhanCongs.Count),
                    DanhSachCongViec = ketQua
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    Message = "Không thể lấy danh sách phân công",
                    Error = ex.InnerException?.Message ?? ex.Message
                });
            }
        }

        // API: Lấy task sắp đến hạn của thành viên trong dự án
        [HttpGet("TasksSapHetHan/{duAnId}/{thanhVienId}")]
        public async Task<IActionResult> GetTasksSapHetHan(int duAnId, int thanhVienId)
        {
            try
            {
                var today = DateOnly.FromDateTime(DateTime.Today);

                // Lấy tất cả công việc được giao cho thành viên này trong dự án
                var congViecsOfMember = await _context.PhanCongs
                    .Where(pc => pc.ThanhVienId == thanhVienId && pc.CongViec.DuAnId == duAnId)
                    .Include(pc => pc.CongViec)
                    .Select(pc => pc.CongViec)
                    .Distinct()
                    .ToListAsync();

                // Lọc task sắp hết hạn (trong 7 ngày) và chưa hoàn thành
                var tasksSapHetHan = congViecsOfMember
                    .Where(cv => (cv.PhamTramHoanThanh ?? 0) < 100 &&
                                 cv.NgayKt.HasValue &&
                                 cv.NgayKt.Value.DayNumber - today.DayNumber <= 7 &&
                                 cv.NgayKt.Value.DayNumber - today.DayNumber >= 0)
                    .Select(cv => new
                    {
                        congViecId = cv.CongViecId,
                        tenCongViec = cv.TenCongViec,
                        trangThai = cv.TrangThai,
                        phamTramHoanThanh = cv.PhamTramHoanThanh ?? 0,
                        ngayKetThuc = cv.NgayKt,
                        soNgayConLai = cv.NgayKt.HasValue ? (int?)(cv.NgayKt.Value.DayNumber - today.DayNumber) : (int?)null,
                        mucDoUuTien = cv.NgayKt.HasValue && cv.NgayKt.Value.DayNumber - today.DayNumber <= 3
                            ? "Khẩn cấp"
                            : "Cao"
                    })
                    .OrderBy(cv => cv.soNgayConLai)
                    .ToList();

                // Lọc task quá hạn của thành viên
                var tasksQuaHan = congViecsOfMember
                    .Where(cv => (cv.PhamTramHoanThanh ?? 0) < 100 &&
                                 cv.NgayKt.HasValue &&
                                 cv.NgayKt.Value.DayNumber < today.DayNumber)
                    .Select(cv => new
                    {
                        congViecId = cv.CongViecId,
                        tenCongViec = cv.TenCongViec,
                        trangThai = cv.TrangThai,
                        phamTramHoanThanh = cv.PhamTramHoanThanh ?? 0,
                        ngayKetThuc = cv.NgayKt,
                        soNgayTreHan = cv.NgayKt.HasValue ? today.DayNumber - cv.NgayKt.Value.DayNumber : 0
                    })
                    .OrderByDescending(cv => cv.soNgayTreHan)
                    .ToList();

                return Ok(new
                {
                    duAnId,
                    thanhVienId,
                    tongQuan = new
                    {
                        sapHetHan = tasksSapHetHan.Count,
                        quaHan = tasksQuaHan.Count,
                        tongCanChuY = tasksSapHetHan.Count + tasksQuaHan.Count
                    },
                    tasksSapHetHan,
                    tasksQuaHan
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Lỗi: {ex.Message}" });
            }
        }

        [HttpPut("ThemNgayNop")]
        public async Task<IActionResult> ThemNgayNop([FromBody] ThemNgayNopRequest request)
        {
            try
            {
                var phanCong = await _context.PhanCongs
                    .FirstOrDefaultAsync(p => p.CongViecId == request.CongViecId && p.ThanhVienId == request.ThanhVienId);

                if (phanCong == null)
                    return NotFound(new { Message = "Không tìm thấy phân công tương ứng." });

                if (string.IsNullOrEmpty(phanCong.NoiDungPhanCong))
                    return BadRequest(new { Message = "Không có nội dung phân công." });

                var subTasks = JsonSerializer.Deserialize<List<PhanCongItemRequest>>(phanCong.NoiDungPhanCong) ?? new List<PhanCongItemRequest>();

                if (subTasks.Count == 0)
                    return BadRequest(new { Message = "Không có sub-task nào để thêm ngày nộp." });

                // Thêm ngày nộp vào tất cả các sub-task
                foreach (var subTask in subTasks)
                {
                    subTask.NgayNop ??= new List<DateTime>();
                    if (!subTask.NgayNop.Contains(request.NgayNop))
                    {
                        subTask.NgayNop.Add(request.NgayNop);
                    }
                }

                phanCong.NoiDungPhanCong = JsonSerializer.Serialize(subTasks);
                _context.PhanCongs.Update(phanCong);
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    Message = "Đã thêm ngày nộp vào tất cả các sub-task thành công.",
                    CongViecId = request.CongViecId,
                    ThanhVienId = request.ThanhVienId,
                    NgayNop = request.NgayNop,
                    SoLuongSubTask = subTasks.Count,
                    SubTasks = subTasks
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    Message = "Thêm ngày nộp thất bại.",
                    Error = ex.InnerException?.Message ?? ex.Message
                });
            }
        }

        

    }
}
