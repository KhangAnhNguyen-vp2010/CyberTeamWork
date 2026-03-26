using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using ServerQuanLyNhom.DTOs.DuAns;
using ServerQuanLyNhom.DTOs.PhanCongs;
using ServerQuanLyNhom.Models;
using ServerQuanLyNhom.Services;
using ServerQuanLyNhom.Services.Email;
using System.Text.Json;

namespace ServerQuanLyNhom.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class DuAnController : ControllerBase
    {
        private readonly QuanLyCongViecNhomContext _context;
        private readonly OtpService _otpService;
        private readonly EmailService _emailService;
        private readonly IDistributedCache _cache;

        public DuAnController(QuanLyCongViecNhomContext context, OtpService otpService, EmailService emailService, IDistributedCache cache)
        {
            _context = context;
            _otpService = otpService;
            _emailService = emailService;
            _cache = cache;
        }

        [HttpPost("CreateDuAn")]
        public async Task<IActionResult> CreateDuAn([FromForm] CreateDuAnRequest dto)
        {
            try
            {
                string? filePath = null;

                // 1. Xử lý upload ảnh bìa nếu có
                if (dto.AnhBia != null && dto.AnhBia.Length > 0)
                {
                    var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot/uploads/duan");
                    if (!Directory.Exists(uploadsFolder))
                        Directory.CreateDirectory(uploadsFolder);

                    var uniqueFileName = $"{Guid.NewGuid()}_{dto.AnhBia.FileName}";
                    var fullPath = Path.Combine(uploadsFolder, uniqueFileName);

                    using var fileStream = new FileStream(fullPath, FileMode.Create);
                    await dto.AnhBia.CopyToAsync(fileStream);

                    filePath = $"/uploads/DuAn/{uniqueFileName}";
                }

                // 2. Tạo dự án mới
                var duAn = new DuAn
                {
                    TenDuAn = dto.TenDuAn,
                    MoTa = dto.MoTa,
                    NgayBd = dto.NgayBD,
                    NgayKt = dto.NgayKT,
                    NhomId = dto.NhomID,
                    LinhVucId = dto.LinhVucID,
                    AnhBia = filePath,
                    TrangThai = "Đang thực hiện"
                };

                _context.DuAns.Add(duAn);
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    Message = "Tạo dự án thành công",
                    DuAnID = duAn.DuAnId,
                    AnhBia = duAn.AnhBia
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = "Tạo dự án thất bại", Error = ex.Message });
            }
        }

        [HttpPut("UpdateDuAn")]
        public async Task<IActionResult> UpdateDuAn([FromForm] UpdateDuAnRequest dto)
        {
            try
            {
                var duAn = await _context.DuAns.FindAsync(dto.DuAnID);
                if (duAn == null)
                    return NotFound(new { Message = "Dự án không tồn tại" });

                duAn.TenDuAn = dto.TenDuAn;
                duAn.MoTa = dto.MoTa;
                duAn.NgayBd = dto.NgayBD;
                duAn.NgayKt = dto.NgayKT;               
                duAn.LinhVucId = dto.LinhVucID;
                duAn.TrangThai = dto.TrangThai ?? duAn.TrangThai;               

                // Xử lý đổi ảnh bìa
                if (dto.AnhBia != null && dto.AnhBia.Length > 0)
                {
                    var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot/uploads/duan");
                    if (!Directory.Exists(uploadsFolder))
                        Directory.CreateDirectory(uploadsFolder);

                    var uniqueFileName = $"{Guid.NewGuid()}_{dto.AnhBia.FileName}";
                    var filePath = Path.Combine(uploadsFolder, uniqueFileName);

                    using var fileStream = new FileStream(filePath, FileMode.Create);
                    await dto.AnhBia.CopyToAsync(fileStream);

                    duAn.AnhBia = $"/uploads/duan/{uniqueFileName}";
                }

                _context.DuAns.Update(duAn);
                await _context.SaveChangesAsync();

                return Ok(new { Message = "Cập nhật dự án thành công", DuAnID = duAn.DuAnId, AnhBia = duAn.AnhBia });
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = "Cập nhật dự án thất bại", Error = ex.Message });
            }
        }

        [HttpDelete("DeleteDuAn/{duAnId}")]
        public async Task<IActionResult> DeleteDuAn(int duAnId)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var duAn = await _context.DuAns.FindAsync(duAnId);
                if (duAn == null)
                    return NotFound(new { Message = "Dự án không tồn tại" });

                // 1️⃣ Xóa các công việc liên quan
                var congViecs = _context.CongViecs.Where(c => c.DuAnId == duAnId);
                _context.CongViecs.RemoveRange(congViecs);

                // 2️⃣ Xóa dự án
                _context.DuAns.Remove(duAn);

                // 3️⃣ Xóa trạng thái workflow trong Redis
                var workflowKey = $"workflow:duan:{duAnId}";
                await _cache.RemoveAsync(workflowKey);

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new
                {
                    Message = "Xóa dự án thành công (bao gồm các công việc và trạng thái workflow)"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest(new
                {
                    Message = "Xóa dự án thất bại",
                    Error = ex.Message
                });
            }
        }


        [HttpGet("GetProjectsOfGroup/{nhomId}")]
        public async Task<IActionResult> GetProjectsOfGroup(int nhomId)
        {
            try
            {
                // Kiểm tra nhóm có tồn tại không
                var nhom = await _context.Nhoms.FindAsync(nhomId);
                if (nhom == null)
                    return NotFound(new { Message = "Nhóm không tồn tại" });

                var projects = await _context.DuAns
                    .Where(d => d.NhomId == nhomId)
                    .Include(d => d.LinhVuc)
                    .Select(d => new
                    {
                        duAnId = d.DuAnId,
                        tenDuAn = d.TenDuAn,
                        moTa = d.MoTa,
                        ngayBd = d.NgayBd,
                        ngayKt = d.NgayKt,
                        trangThai = d.TrangThai,
                        anhBia = d.AnhBia,
                        linhVucId = d.LinhVucId,
                        tenLinhVuc = d.LinhVuc != null ? d.LinhVuc.TenLinhVuc : null
                    })
                    .ToListAsync();

                return Ok(new
                {
                    nhomId = nhom.NhomId,
                    tenNhom = nhom.TenNhom,
                    projects = projects
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new 
                { 
                    message = "Lỗi khi lấy danh sách dự án",
                    error = ex.Message,
                    innerError = ex.InnerException?.Message
                });
            }
        }

        [HttpGet("linh-vuc")]
        public async Task<IActionResult> GetLinhVuc()
        {
            var linhVucList = await _context.LinhVucs.ToListAsync();
            return Ok(new
            {
                success = true,
                data = linhVucList.Select(cm => new
                {
                    linhVucId = cm.LinhVucId,
                    tenLinhVuc = cm.TenLinhVuc
                })
            });
        }

        [HttpGet("{duAnId}")]
        public async Task<IActionResult> GetDuAnDetail(int duAnId)
        {
            try
            {
                var duAn = await _context.DuAns
                    .Where(d => d.DuAnId == duAnId)
                    .Select(d => new
                    {
                        d.DuAnId,
                        d.TenDuAn,
                        d.MoTa,
                        d.NgayBd,
                        d.NgayKt,
                        d.TrangThai,                       
                        d.AnhBia,
                        d.LinhVuc,
                    })
                    .FirstOrDefaultAsync();

                if (duAn == null)
                    return NotFound(new { Message = "Không tìm thấy dự án." });

                return Ok(duAn);
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    Message = "Lỗi khi lấy thông tin dự án.",
                    Error = ex.InnerException?.Message ?? ex.Message
                });
            }
        }

        [HttpGet("ThongKeBaoCaoDuAn/{duAnId}")]
        public async Task<IActionResult> ThongKeBaoCaoDuAn(int duAnId)
        {
            try
            {
                // Lấy thông tin dự án
                var duAn = await _context.DuAns
                    .FirstOrDefaultAsync(d => d.DuAnId == duAnId);

                if (duAn == null)
                    return NotFound(new { Message = "Không tìm thấy dự án" });

                // Lấy tất cả công việc của dự án
                var congViecs = await _context.CongViecs
                    .Where(cv => cv.DuAnId == duAnId)
                    .ToListAsync();

                int tongSoCV = congViecs.Count;
                int soCVChuaBatDau = congViecs.Count(cv => cv.TrangThai == "Chưa bắt đầu");
                int soCVHoanThanh = congViecs.Count(cv => cv.TrangThai == "Hoàn thành");
                int soCVDangLam = congViecs.Count(cv => cv.TrangThai == "Đang làm");
                int soCVTreHan = congViecs.Count(cv => cv.TrangThai == "Trễ hạn");

                // Tính % hoàn thành theo công việc
                decimal phanTramHoanThanh = tongSoCV > 0 
                    ? Math.Round((decimal)soCVHoanThanh * 100 / tongSoCV, 2) 
                    : 0;

                // Tính % thực tế dựa trên PhamTramHoanThanh của các công việc
                decimal tienDoThucTe = 0;
                if (tongSoCV > 0)
                {
                    // Lấy trung bình PhamTramHoanThanh từ tất cả công việc
                    var totalProgress = congViecs
                        .Where(cv => cv.PhamTramHoanThanh.HasValue)
                        .Sum(cv => cv.PhamTramHoanThanh.Value);
                    
                    var countWithProgress = congViecs.Count(cv => cv.PhamTramHoanThanh.HasValue);
                    
                    if (countWithProgress > 0)
                    {
                        tienDoThucTe = Math.Round((decimal)(totalProgress / countWithProgress), 2);
                    }
                }

                // Tính thời gian hoàn thành trung bình
                var completedTasks = congViecs
                    .Where(cv => cv.TrangThai == "Hoàn thành" && cv.NgayBd.HasValue)
                    .ToList();

                decimal thoiGianHoanThanhTrungBinh = 0;
                if (completedTasks.Any())
                {
                    var today = DateOnly.FromDateTime(DateTime.Now);
                    var avgDays = completedTasks.Average(cv => 
                    {
                        // Tính số ngày từ ngày bắt đầu đến ngày kết thúc deadline
                        // Nếu hoàn thành trước deadline thì dùng deadline, nếu không có deadline thì dùng hôm nay
                        var endDate = cv.NgayKt.HasValue ? cv.NgayKt.Value : today;
                        return endDate.DayNumber - cv.NgayBd!.Value.DayNumber;
                    });
                    thoiGianHoanThanhTrungBinh = Math.Round((decimal)avgDays, 2);
                }

                // Ngày bắt đầu sớm nhất và kết thúc muộn nhất
                DateTime? ngayBatDauSomNhat = congViecs
                    .Where(cv => cv.NgayBd.HasValue)
                    .OrderBy(cv => cv.NgayBd)
                    .FirstOrDefault()?.NgayBd?.ToDateTime(TimeOnly.MinValue);

                DateTime? ngayKetThucMuonNhat = congViecs
                    .Where(cv => cv.NgayKt.HasValue)
                    .OrderByDescending(cv => cv.NgayKt)
                    .FirstOrDefault()?.NgayKt?.ToDateTime(TimeOnly.MinValue);

                // Số ngày còn lại (tính theo ngày kết thúc dự án, không phải công việc)
                int soNgayConLai = 0;
                if (duAn.NgayKt.HasValue)
                {
                    var ngayKetThucDuAn = duAn.NgayKt.Value.ToDateTime(TimeOnly.MinValue);
                    var daysLeft = (ngayKetThucDuAn - DateTime.Now).TotalDays;
                    soNgayConLai = daysLeft > 0 ? (int)Math.Ceiling(daysLeft) : 0;
                }

                // Đánh giá tiến độ
                string danhGiaTienDo = "Bình thường";
                var chenhLech = tienDoThucTe - phanTramHoanThanh;
                
                // Ưu tiên cao nhất: Dự án đã hoàn thành 100%
                if (phanTramHoanThanh >= 100)
                    danhGiaTienDo = "Hoàn thành - Đã hoàn tất tất cả công việc";
                else if (soCVTreHan > 0)
                    danhGiaTienDo = "Cần cải thiện - Có công việc trễ hạn";
                else if (chenhLech >= 15)
                    danhGiaTienDo = "Xuất sắc - Vượt tiến độ";
                else if (chenhLech >= 5)
                    danhGiaTienDo = "Tốt - Trước tiến độ";
                else if (chenhLech >= -5)
                    danhGiaTienDo = "Khá - Đúng tiến độ";
                else if (chenhLech >= -15)
                    danhGiaTienDo = "Cần theo dõi - Hơi chậm";
                else
                    danhGiaTienDo = "Cần chú ý - Chậm tiến độ";

                var result = new ThongKeBaoCaoDuAnResponse
                {
                    DuAnID = duAnId,
                    TenDuAn = duAn.TenDuAn,
                    TongSoCV = tongSoCV,
                    SoCVChuaBatDau = soCVChuaBatDau,
                    SoCVHoanThanh = soCVHoanThanh,
                    SoCVDangLam = soCVDangLam,
                    SoCVTreHan = soCVTreHan,
                    PhanTramHoanThanh = phanTramHoanThanh,
                    ThoiGianHoanThanhTrungBinh = thoiGianHoanThanhTrungBinh,
                    NgayBatDauSomNhatCuaCongViec = ngayBatDauSomNhat,
                    NgayKetThucMuonNhatCuaCongViec = ngayKetThucMuonNhat,
                    SoNgayConLai = soNgayConLai,
                    TienDoThucTe = tienDoThucTe,
                    DanhGiaTienDo = danhGiaTienDo,
                    NgayCapNhatBaoCao = DateTime.Now
                };

                return Ok(new
                {
                    Message = "Lấy báo cáo thống kê dự án thành công",
                    Data = result
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    Message = "Lỗi khi thống kê báo cáo dự án",
                    Error = ex.InnerException?.Message ?? ex.Message
                });
            }
        }

        [HttpGet("ThanhVienTheoDuAn/{duAnId}/{top}/{loai}")]
        public async Task<IActionResult> ThongKeThanhVienTheoDuAn(int duAnId, int top, string loai)
        {
            try
            {
                // Lấy tất cả phân công của dự án
                var phanCongs = await _context.PhanCongs
                    .Include(pc => pc.ThanhVien)
                    .Include(pc => pc.CongViec)
                    .Where(pc => pc.CongViec != null && pc.CongViec.DuAnId == duAnId)
                    .ToListAsync();

                var memberStats = new List<ThongKeThanhVienResponse>();

                // Nhóm theo thành viên
                var groupedByMember = phanCongs.GroupBy(pc => pc.ThanhVienId);

                foreach (var group in groupedByMember)
                {
                    var thanhVien = group.First().ThanhVien;
                    if (thanhVien == null) continue;

                    int totalSubTasks = 0;
                    int completedSubTasks = 0;
                    double totalProgress = 0;

                    foreach (var pc in group)
                    {
                        if (string.IsNullOrEmpty(pc.NoiDungPhanCong)) continue;

                        try
                        {
                            var subTasks = JsonSerializer.Deserialize<List<PhanCongItemRequest>>(pc.NoiDungPhanCong);
                            if (subTasks == null) continue;

                            foreach (var subTask in subTasks)
                            {
                                totalSubTasks++;
                                
                                // Parse progress
                                double progress = 0;
                                if (!string.IsNullOrEmpty(subTask.TienDoHoanThanh))
                                {
                                    var progressStr = subTask.TienDoHoanThanh.Replace("%", "").Trim();
                                    if (double.TryParse(progressStr, out double parsed))
                                    {
                                        progress = parsed;
                                    }
                                }

                                totalProgress += progress;
                                
                                // Count as completed if 100%
                                if (progress >= 100)
                                {
                                    completedSubTasks++;
                                }
                            }
                        }
                        catch { }
                    }

                    var avgProgress = totalSubTasks > 0 ? totalProgress / totalSubTasks : 0;

                    // Xác định mức độ hoạt động
                    string mucDoHoatDong = "Trung bình";
                    if (avgProgress >= 80) mucDoHoatDong = "Người làm việc tích cực nhất";
                    else if (avgProgress >= 50) mucDoHoatDong = "Hoạt động tốt";
                    else if (avgProgress > 0) mucDoHoatDong = "Cần theo dõi";
                    else mucDoHoatDong = "Chưa hoạt động";

                    memberStats.Add(new ThongKeThanhVienResponse
                    {
                        ThanhVienID = thanhVien.ThanhVienId,
                        HoTen = thanhVien.HoTen ?? "N/A",
                        SoLuongCongViec = totalSubTasks,
                        SoLuongHoanThanh = completedSubTasks,
                        TrungBinhHT = avgProgress,
                        MucDoHoatDong = mucDoHoatDong
                    });
                }

                // Sắp xếp theo loại
                List<ThongKeThanhVienResponse> result;
                if (loai.Equals("NhieuNhat", StringComparison.OrdinalIgnoreCase))
                {
                    // Sắp xếp giảm dần theo trung bình hoàn thành
                    result = memberStats
                        .OrderByDescending(m => m.TrungBinhHT)
                        .ThenByDescending(m => m.SoLuongHoanThanh)
                        .Take(top)
                        .ToList();
                }
                else // ItNhat
                {
                    // Sắp xếp tăng dần theo trung bình hoàn thành
                    result = memberStats
                        .OrderBy(m => m.TrungBinhHT)
                        .ThenBy(m => m.SoLuongHoanThanh)
                        .Take(top)
                        .ToList();
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = "Lỗi khi thống kê thành viên", error = ex.Message });
            }
        }

        // API thống kê tổng quan dự án
        [HttpGet("ThongKe/{duAnId}")]
        public async Task<IActionResult> ThongKeDuAn(int duAnId)
        {
            try
            {
                // Lấy thông tin dự án
                var duAn = await _context.DuAns
                    .Include(d => d.Nhom)
                    .Include(d => d.LinhVuc)
                    .FirstOrDefaultAsync(d => d.DuAnId == duAnId);

                if (duAn == null)
                {
                    return NotFound(new { message = "Không tìm thấy dự án" });
                }

                // Lấy tất cả công việc của dự án
                var congViecs = await _context.CongViecs
                    .Where(cv => cv.DuAnId == duAnId)
                    .Include(cv => cv.PhanCongs)
                    .Include(cv => cv.BinhLuans)
                    .ToListAsync();

                var totalTasks = congViecs.Count;
                var completedTasks = congViecs.Count(cv => cv.TrangThai == "Hoàn thành");
                var inProgressTasks = congViecs.Count(cv => cv.TrangThai == "Đang thực hiện");
                var pendingTasks = congViecs.Count(cv => cv.TrangThai == "Chưa bắt đầu");

                // Tính tiến độ trung bình
                var avgProgress = totalTasks > 0 
                    ? congViecs.Average(cv => cv.PhamTramHoanThanh ?? 0) 
                    : 0;

                // Tính số ngày còn lại
                var today = DateOnly.FromDateTime(DateTime.Today);
                int? daysRemaining = null;
                if (duAn.NgayKt.HasValue)
                {
                    daysRemaining = duAn.NgayKt.Value.DayNumber - today.DayNumber;
                }

                // Xác định mức độ ưu tiên dựa trên ngày kết thúc
                string priority = "Bình thường";
                if (daysRemaining.HasValue)
                {
                    if (daysRemaining.Value <= 3) priority = "Khẩn cấp";
                    else if (daysRemaining.Value <= 7) priority = "Cao";
                    else if (daysRemaining.Value <= 14) priority = "Trung bình";
                }

                // Công việc sắp hết hạn (trong vòng 3 ngày)
                var urgentTasks = congViecs
                    .Where(cv => cv.NgayKt.HasValue && 
                                 cv.TrangThai != "Hoàn thành" &&
                                 cv.NgayKt.Value.DayNumber - today.DayNumber <= 3)
                    .OrderBy(cv => cv.NgayKt)
                    .Take(5)
                    .Select(cv => new
                    {
                        congViecId = cv.CongViecId,
                        tenCongViec = cv.TenCongViec,
                        trangThai = cv.TrangThai,
                        phamTramHoanThanh = cv.PhamTramHoanThanh,
                        ngayKetThuc = cv.NgayKt,
                        soNgayConLai = cv.NgayKt.HasValue ? (int?)(cv.NgayKt.Value.DayNumber - today.DayNumber) : (int?)null,
                        soThanhVienPhanCong = cv.PhanCongs.Count
                    })
                    .ToList();

                // Phân bố trạng thái công việc
                var tasksByStatus = new
                {
                    chuaBatDau = pendingTasks,
                    dangThucHien = inProgressTasks,
                    hoanThanh = completedTasks
                };

                // Thống kê theo thành viên
                var memberStats = await _context.PhanCongs
                    .Where(pc => congViecs.Select(cv => cv.CongViecId).Contains(pc.CongViecId))
                    .GroupBy(pc => pc.ThanhVienId)
                    .Select(g => new
                    {
                        thanhVienId = g.Key,
                        soLuongCongViec = g.Count(),
                        tasks = g.Select(pc => pc.CongViec).ToList()
                    })
                    .ToListAsync();

                var memberStatsWithDetails = new List<object>();
                foreach (var stat in memberStats)
                {
                    var thanhVien = await _context.ThanhViens
                        .FirstOrDefaultAsync(tv => tv.ThanhVienId == stat.thanhVienId);

                    var completedCount = stat.tasks.Count(t => t.TrangThai == "Hoàn thành");
                    var inProgressCount = stat.tasks.Count(t => t.TrangThai == "Đang thực hiện");

                    memberStatsWithDetails.Add(new
                    {
                        thanhVienId = stat.thanhVienId,
                        hoTen = thanhVien?.HoTen ?? "N/A",
                        anhBia = thanhVien?.AnhBia,
                        tongCongViec = stat.soLuongCongViec,
                        hoanThanh = completedCount,
                        dangThucHien = inProgressCount,
                        tiLe = stat.soLuongCongViec > 0 
                            ? Math.Round((double)completedCount / stat.soLuongCongViec * 100, 1) 
                            : 0
                    });
                }

                // Biểu đồ tiến độ theo thời gian (7 ngày gần nhất)
                var last7Days = Enumerable.Range(0, 7)
                    .Select(i => today.AddDays(-6 + i))
                    .ToList();

                var progressHistory = last7Days.Select(date => new
                {
                    ngay = date.ToString("dd/MM"),
                    soLuongHoanThanh = congViecs.Count(cv => 
                        cv.TrangThai == "Hoàn thành" && 
                        cv.NgayKt.HasValue && 
                        cv.NgayKt.Value <= date)
                }).ToList();

                return Ok(new
                {
                    // Thông tin cơ bản
                    duAn = new
                    {
                        duAnId = duAn.DuAnId,
                        tenDuAn = duAn.TenDuAn,
                        moTa = duAn.MoTa,
                        trangThai = duAn.TrangThai,
                        anhBia = duAn.AnhBia,
                        ngayBatDau = duAn.NgayBd,
                        ngayKetThuc = duAn.NgayKt,
                        tenNhom = duAn.Nhom?.TenNhom,
                        linhVuc = duAn.LinhVuc?.TenLinhVuc
                    },
                    
                    // Tổng quan
                    tongQuan = new
                    {
                        tongSoCongViec = totalTasks,
                        hoanThanh = completedTasks,
                        dangThucHien = inProgressTasks,
                        chuaBatDau = pendingTasks,
                        tienDoTrungBinh = Math.Round(avgProgress, 1),
                        soNgayConLai = daysRemaining,
                        mucDoUuTien = priority
                    },

                    // Công việc khẩn cấp
                    congViecKhanCap = urgentTasks,

                    // Phân bố trạng thái
                    phanBoTrangThai = tasksByStatus,

                    // Thống kê thành viên
                    thongKeThanhVien = memberStatsWithDetails,

                    // Biểu đồ tiến độ
                    bieuDoTienDo = progressHistory
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Lỗi khi lấy thống kê dự án", error = ex.Message });
            }
        }

        // API: Lấy thông tin task ưu tiên và deadline cho theo dõi tiến độ
        [HttpGet("TienDoUuTien/{duAnId}")]
        public async Task<IActionResult> GetProgressPriority(int duAnId)
        {
            try
            {
                var duAn = await _context.DuAns
                    .FirstOrDefaultAsync(d => d.DuAnId == duAnId);

                if (duAn == null)
                {
                    return NotFound(new { message = "Không tìm thấy dự án." });
                }

                var today = DateOnly.FromDateTime(DateTime.Today);

                // Lấy danh sách công việc của dự án
                var congViecs = await _context.CongViecs
                    .Where(cv => cv.DuAnId == duAnId)
                    .Include(cv => cv.PhanCongs)
                        .ThenInclude(pc => pc.ThanhVien)
                    .ToListAsync();

                // 1. Công việc ưu tiên cao (chưa hoàn thành + có deadline gần hoặc đã quá hạn)
                var highPriorityTasks = congViecs
                    .Where(cv => (cv.PhamTramHoanThanh ?? 0) < 100 && cv.NgayKt.HasValue)
                    .Select(cv => new
                    {
                        congViecId = cv.CongViecId,
                        tenCongViec = cv.TenCongViec,
                        trangThai = cv.TrangThai,
                        phamTramHoanThanh = cv.PhamTramHoanThanh ?? 0,
                        ngayKetThuc = cv.NgayKt,
                        soNgayConLai = cv.NgayKt.HasValue ? (int?)(cv.NgayKt.Value.DayNumber - today.DayNumber) : (int?)null,
                        soThanhVienPhanCong = cv.PhanCongs.Count,
                        thanhVienPhanCong = cv.PhanCongs.Select(pc => new
                        {
                            thanhVienId = pc.ThanhVienId,
                            hoTen = pc.ThanhVien.HoTen,
                            anhBia = pc.ThanhVien.AnhBia
                        }).ToList(),
                        mucDoUuTien = cv.NgayKt.HasValue && cv.NgayKt.Value.DayNumber < today.DayNumber
                            ? "Quá hạn"
                            : cv.NgayKt.HasValue && cv.NgayKt.Value.DayNumber - today.DayNumber <= 3 
                                ? "Khẩn cấp" 
                                : cv.NgayKt.HasValue && cv.NgayKt.Value.DayNumber - today.DayNumber <= 7 
                                    ? "Cao" 
                                    : "Trung bình"
                    })
                    .OrderBy(cv => cv.soNgayConLai)
                    .Take(10)
                    .ToList();

                // 2. Công việc sắp hết hạn (trong vòng 7 ngày, chưa hoàn thành)
                var upcomingDeadlines = congViecs
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
                        soThanhVienPhanCong = cv.PhanCongs.Count,
                        thanhVienPhanCong = cv.PhanCongs.Select(pc => new
                        {
                            thanhVienId = pc.ThanhVienId,
                            hoTen = pc.ThanhVien.HoTen,
                            anhBia = pc.ThanhVien.AnhBia
                        }).ToList()
                    })
                    .OrderBy(cv => cv.soNgayConLai)
                    .ToList();

                // 3. Công việc đã quá hạn (chưa hoàn thành 100%)
                var overdueTasks = congViecs
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
                        soNgayTreHan = today.DayNumber - cv.NgayKt.Value.DayNumber,
                        soThanhVienPhanCong = cv.PhanCongs.Count,
                        thanhVienPhanCong = cv.PhanCongs.Select(pc => new
                        {
                            thanhVienId = pc.ThanhVienId,
                            hoTen = pc.ThanhVien.HoTen,
                            anhBia = pc.ThanhVien.AnhBia
                        }).ToList()
                    })
                    .OrderByDescending(cv => cv.soNgayTreHan)
                    .ToList();

                // 4. Công việc tiến độ chậm (chưa hoàn thành + tiến độ thực tế < tiến độ mong đợi)
                var slowProgressTasks = congViecs
                    .Where(cv => (cv.PhamTramHoanThanh ?? 0) < 100 && 
                                 cv.NgayBd.HasValue && 
                                 cv.NgayKt.HasValue)
                    .Select(cv => new
                    {
                        cv,
                        totalDays = cv.NgayKt!.Value.DayNumber - cv.NgayBd!.Value.DayNumber,
                        elapsedDays = today.DayNumber - cv.NgayBd!.Value.DayNumber,
                        expectedProgress = cv.NgayKt.Value.DayNumber - cv.NgayBd.Value.DayNumber > 0
                            ? (double)(today.DayNumber - cv.NgayBd.Value.DayNumber) / (cv.NgayKt.Value.DayNumber - cv.NgayBd.Value.DayNumber) * 100
                            : 0,
                        actualProgress = cv.PhamTramHoanThanh ?? 0
                    })
                    .Where(x => x.actualProgress < x.expectedProgress - 20) // Chậm hơn 20%
                    .Select(x => new
                    {
                        congViecId = x.cv.CongViecId,
                        tenCongViec = x.cv.TenCongViec,
                        trangThai = x.cv.TrangThai,
                        tienDoThucTe = x.actualProgress,
                        tienDoMongDoi = Math.Round(x.expectedProgress, 1),
                        chenhLech = Math.Round(x.expectedProgress - x.actualProgress, 1),
                        ngayKetThuc = x.cv.NgayKt,
                        soThanhVienPhanCong = x.cv.PhanCongs.Count,
                        thanhVienPhanCong = x.cv.PhanCongs.Select(pc => new
                        {
                            thanhVienId = pc.ThanhVienId,
                            hoTen = pc.ThanhVien.HoTen,
                            anhBia = pc.ThanhVien.AnhBia
                        }).ToList()
                    })
                    .OrderByDescending(x => x.chenhLech)
                    .Take(5)
                    .ToList();

                // 5. Tổng quan
                var tongQuan = new
                {
                    tongCongViec = congViecs.Count,
                    chuaHoanThanh = congViecs.Count(cv => (cv.PhamTramHoanThanh ?? 0) < 100),
                    sapHetHan = upcomingDeadlines.Count,
                    quaHan = overdueTasks.Count,
                    tienDoChham = slowProgressTasks.Count,
                    uuTienCao = highPriorityTasks.Count(t => t.mucDoUuTien == "Khẩn cấp" || t.mucDoUuTien == "Cao" || t.mucDoUuTien == "Quá hạn")
                };

                return Ok(new
                {
                    duAn = new
                    {
                        duAnId = duAn.DuAnId,
                        tenDuAn = duAn.TenDuAn
                    },
                    tongQuan,
                    congViecUuTienCao = highPriorityTasks,
                    congViecSapHetHan = upcomingDeadlines,
                    congViecQuaHan = overdueTasks,
                    congViecTienDoChham = slowProgressTasks
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Lỗi: {ex.Message}" });
            }
        }

        [HttpGet("ThongKeTongQuan/{nhomId}")]
        public async Task<IActionResult> ThongKeTongQuan(int nhomId)
        {
            try
            {
                var duAns = await _context.DuAns
                    .Where(da => da.NhomId == nhomId)
                    .Include(da => da.CongViecs)
                    .ToListAsync();

                if (!duAns.Any())
                {
                    return Ok(new
                    {
                        tongQuan = new
                        {
                            tongDuAn = 0,
                            duAnDangThucHien = 0,
                            duAnHoanThanh = 0,
                            duAnQuaHan = 0,
                            duAnTamDung = 0,
                            tongCongViec = 0,
                            congViecHoanThanh = 0,
                            congViecKhanCap = 0,
                            congViecQuaHan = 0,
                            tienDoTrungBinh = 0
                        },
                        duAnKhanCap = new List<object>(),
                        duAnQuaHan = new List<object>(),
                        duAnTienDoThap = new List<object>()
                    });
                }

                var today = DateOnly.FromDateTime(DateTime.Today);
                var duAnKhanCap = new List<object>();
                var duAnQuaHan = new List<object>();
                var duAnTienDoThap = new List<object>();

                int tongCongViec = 0;
                int congViecHoanThanh = 0;
                int congViecKhanCap = 0;
                int congViecQuaHan = 0;
                double tongTienDo = 0;

                foreach (var duAn in duAns)
                {
                    var congViecs = duAn.CongViecs.ToList();
                    
                    // Chỉ tính công việc của dự án không tạm dừng
                    if (duAn.TrangThai != "Tạm dừng")
                    {
                        tongCongViec += congViecs.Count;
                        congViecHoanThanh += congViecs.Count(cv => (cv.PhamTramHoanThanh ?? 0) >= 100);
                    }

                    int tienDoHienTai = congViecs.Any() ? (int)congViecs.Average(cv => cv.PhamTramHoanThanh ?? 0) : 0;
                    tongTienDo += tienDoHienTai;

                    // Tính số ngày còn lại
                    int? soNgayConLai = null;
                    if (duAn.NgayKt.HasValue)
                    {
                        soNgayConLai = duAn.NgayKt.Value.DayNumber - today.DayNumber;
                    }

                    // Dự án khẩn cấp (còn <= 7 ngày và chưa hoàn thành và không phải tạm dừng)
                    if (soNgayConLai.HasValue && soNgayConLai.Value <= 7 && soNgayConLai.Value >= 0 && tienDoHienTai < 100 && duAn.TrangThai != "Tạm dừng")
                    {
                        duAnKhanCap.Add(new
                        {
                            duAnId = duAn.DuAnId,
                            tenDuAn = duAn.TenDuAn,
                            tienDo = tienDoHienTai,
                            soNgayConLai = soNgayConLai.Value,
                            tongCongViec = congViecs.Count,
                            hoanThanh = congViecs.Count(cv => (cv.PhamTramHoanThanh ?? 0) >= 100),
                            mucDoUuTien = soNgayConLai.Value <= 3 ? "Khẩn cấp" : "Cao"
                        });
                    }

                    // Dự án quá hạn (không bao gồm dự án tạm dừng)
                    if (soNgayConLai.HasValue && soNgayConLai.Value < 0 && tienDoHienTai < 100 && duAn.TrangThai != "Tạm dừng")
                    {
                        duAnQuaHan.Add(new
                        {
                            duAnId = duAn.DuAnId,
                            tenDuAn = duAn.TenDuAn,
                            tienDo = tienDoHienTai,
                            soNgayQuaHan = Math.Abs(soNgayConLai.Value),
                            tongCongViec = congViecs.Count,
                            hoanThanh = congViecs.Count(cv => (cv.PhamTramHoanThanh ?? 0) >= 100)
                        });
                    }

                    // Dự án tiến độ thấp (< 50% và đã qua 50% thời gian và không phải tạm dừng)
                    if (duAn.NgayBd.HasValue && duAn.NgayKt.HasValue && duAn.TrangThai != "Tạm dừng")
                    {
                        int tongNgay = duAn.NgayKt.Value.DayNumber - duAn.NgayBd.Value.DayNumber;
                        int ngayDaQua = today.DayNumber - duAn.NgayBd.Value.DayNumber;
                        double phanTramThoiGian = tongNgay > 0 ? (double)ngayDaQua / tongNgay * 100 : 0;

                        if (phanTramThoiGian >= 50 && tienDoHienTai < 50 && tienDoHienTai < 100)
                        {
                            duAnTienDoThap.Add(new
                            {
                                duAnId = duAn.DuAnId,
                                tenDuAn = duAn.TenDuAn,
                                tienDo = tienDoHienTai,
                                tienDoMongDoi = (int)phanTramThoiGian,
                                chenhLech = (int)phanTramThoiGian - tienDoHienTai,
                                tongCongViec = congViecs.Count,
                                hoanThanh = congViecs.Count(cv => (cv.PhamTramHoanThanh ?? 0) >= 100)
                            });
                        }
                    }

                    // Đếm công việc khẩn cấp và quá hạn (chỉ tính dự án không tạm dừng)
                    if (duAn.TrangThai != "Tạm dừng")
                    {
                        foreach (var cv in congViecs)
                        {
                            if (cv.PhamTramHoanThanh < 100)
                            {
                                if (cv.NgayKt.HasValue)
                                {
                                    int ngayConLai = cv.NgayKt.Value.DayNumber - today.DayNumber;
                                    if (ngayConLai < 0)
                                        congViecQuaHan++;
                                    else if (ngayConLai <= 3)
                                        congViecKhanCap++;
                                }
                            }
                        }
                    }
                }

                int duAnDangThucHien = duAns.Count(da => da.TrangThai == "Đang thực hiện");

                int duAnHoanThanh = duAns.Count(da => da.TrangThai == "Hoàn thành");

                int duAnTamDung = duAns.Count(da => da.TrangThai == "Tạm dừng");

                return Ok(new
                {
                    tongQuan = new
                    {
                        tongDuAn = duAns.Count,
                        duAnDangThucHien,
                        duAnHoanThanh,
                        duAnQuaHan = duAnQuaHan.Count,
                        duAnTamDung,
                        tongCongViec,
                        congViecHoanThanh,
                        congViecKhanCap,
                        congViecQuaHan,
                        tienDoTrungBinh = duAns.Any() ? (int)(tongTienDo / duAns.Count) : 0
                    },
                    duAnKhanCap = duAnKhanCap.OrderBy(d => ((dynamic)d).soNgayConLai).Take(5).ToList(),
                    duAnQuaHan = duAnQuaHan.OrderByDescending(d => ((dynamic)d).soNgayQuaHan).Take(5).ToList(),
                    duAnTienDoThap = duAnTienDoThap.OrderByDescending(d => ((dynamic)d).chenhLech).Take(5).ToList()
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Lỗi: {ex.Message}" });
            }
        }

        // API: Lấy danh sách dự án quá hạn của nhóm
        [HttpGet("GetDuAnQuaHan/{nhomId}")]
        public async Task<IActionResult> GetDuAnQuaHan(int nhomId)
        {
            try
            {
                var today = DateOnly.FromDateTime(DateTime.Today);

                // Lấy tất cả dự án của nhóm
                var duAns = await _context.DuAns
                    .Where(da => da.NhomId == nhomId)
                    .Include(da => da.CongViecs)
                    .Include(da => da.LinhVuc)
                    .ToListAsync();

                // Filter và tính toán trong memory
                var duAnQuaHan = duAns
                    .Where(da => da.NgayKt.HasValue && da.NgayKt.Value.DayNumber < today.DayNumber)
                    .Select(da =>
                    {
                        var congViecs = da.CongViecs.ToList();
                        var tienDo = congViecs.Any() ? (int)congViecs.Average(cv => cv.PhamTramHoanThanh ?? 0) : 0;
                        
                        return new
                        {
                            duAnId = da.DuAnId,
                            tenDuAn = da.TenDuAn,
                            moTa = da.MoTa,
                            ngayBatDau = da.NgayBd,
                            ngayKetThuc = da.NgayKt,
                            trangThai = da.TrangThai,
                            anhBia = da.AnhBia,
                            tenLinhVuc = da.LinhVuc?.TenLinhVuc,
                            tienDo = tienDo,
                            tongCongViec = congViecs.Count,
                            congViecHoanThanh = congViecs.Count(cv => (cv.PhamTramHoanThanh ?? 0) >= 100),
                            soNgayQuaHan = today.DayNumber - da.NgayKt.Value.DayNumber
                        };
                    })
                    .OrderByDescending(da => da.soNgayQuaHan)
                    .ToList();

                return Ok(duAnQuaHan);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    message = "Lỗi khi lấy danh sách dự án quá hạn",
                    error = ex.Message,
                    innerError = ex.InnerException?.Message
                });
            }
        }

    }
}

