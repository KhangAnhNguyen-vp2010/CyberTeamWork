using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using Newtonsoft.Json;
using ServerQuanLyNhom.DTOs.Nhoms;
using ServerQuanLyNhom.DTOs.PhanCongs;
using ServerQuanLyNhom.Models;
using ServerQuanLyNhom.Services;
using ServerQuanLyNhom.Services.Email;

namespace ServerQuanLyNhom.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ThanhVienController : ControllerBase
    {
        private readonly QuanLyCongViecNhomContext _context;
        private readonly OtpService _otpService;
        private readonly EmailService _emailService;
        private readonly IDistributedCache _cache;
        private readonly TimeSpan _thongBaoTTL = TimeSpan.FromDays(5);

        public ThanhVienController(QuanLyCongViecNhomContext context, OtpService otpService, EmailService emailService, IDistributedCache cache)
        {
            _context = context;
            _otpService = otpService;
            _emailService = emailService;
            _cache = cache;
        }

        [HttpDelete("KickThanhVienKhoiNhom/{nhomId}/{thanhVienId}")]
        public async Task<IActionResult> KickThanhVienKhoiNhom(int nhomId, int thanhVienId)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // 1️⃣ Kiểm tra nhóm & thành viên
                var nhom = await _context.Nhoms.FindAsync(nhomId);
                if (nhom == null)
                    return NotFound(new { Message = "Nhóm không tồn tại" });

                var thanhVien = await _context.ThanhViens.FindAsync(thanhVienId);
                if (thanhVien == null)
                    return NotFound(new { Message = "Thành viên không tồn tại" });

                // 2️⃣ Kiểm tra thành viên có thuộc nhóm không
                var thamGia = await _context.ChiTietThanhVienNhoms
                    .FirstOrDefaultAsync(x => x.NhomId == nhomId && x.ThanhVienId == thanhVienId);
                if (thamGia == null)
                    return BadRequest(new { Message = "Thành viên không thuộc nhóm này" });

                // 3️⃣ Chuyển giao phân công công việc của thành viên cho trưởng nhóm
                var phanCongs = await _context.PhanCongs
                    .Include(pc => pc.CongViec)
                    .ThenInclude(cv => cv.DuAn)
                    .Where(pc => pc.ThanhVienId == thanhVienId && pc.CongViec.DuAn.NhomId == nhomId)
                    .ToListAsync();

                if (phanCongs.Any())
                {
                    var truongNhom = await _context.ChiTietThanhVienNhoms
                        .FirstOrDefaultAsync(ct => ct.NhomId == nhomId && ct.ChucVu == "Trưởng nhóm");

                    if (truongNhom == null)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { Message = "Không tìm thấy trưởng nhóm để chuyển giao phân công." });
                    }

                    if (truongNhom.ThanhVienId == thanhVienId)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { Message = "Không thể chuyển giao phân công khi trưởng nhóm bị xoá. Vui lòng chuyển quyền trưởng nhóm trước." });
                    }

                    var truongNhomId = truongNhom.ThanhVienId;
                    var congViecIds = phanCongs.Select(pc => pc.CongViecId).Distinct().ToList();

                    var phanCongCuaTruongNhom = await _context.PhanCongs
                        .Where(pc => pc.ThanhVienId == truongNhomId && congViecIds.Contains(pc.CongViecId))
                        .ToListAsync();

                    foreach (var phanCong in phanCongs)
                    {
                        var assignmentOfLeader = phanCongCuaTruongNhom.FirstOrDefault(pc => pc.CongViecId == phanCong.CongViecId);
                        if (assignmentOfLeader != null)
                        {
                            var leaderItems = DeserializePhanCongItems(assignmentOfLeader.NoiDungPhanCong);
                            var memberItems = DeserializePhanCongItems(phanCong.NoiDungPhanCong);

                            if (memberItems.Count > 0)
                            {
                                leaderItems.AddRange(memberItems);
                                assignmentOfLeader.NoiDungPhanCong = System.Text.Json.JsonSerializer.Serialize(leaderItems);
                            }

                            _context.PhanCongs.Remove(phanCong);
                        }
                        else
                        {
                            var reassignedAssignment = new PhanCong
                            {
                                CongViecId = phanCong.CongViecId,
                                ThanhVienId = truongNhomId,
                                NoiDungPhanCong = phanCong.NoiDungPhanCong
                            };

                            _context.PhanCongs.Remove(phanCong);
                            phanCongCuaTruongNhom.Add(reassignedAssignment);
                            _context.PhanCongs.Add(reassignedAssignment);
                        }
                    }
                }

                // 4️⃣ Xóa thành viên khỏi nhóm
                _context.ChiTietThanhVienNhoms.Remove(thamGia);

                // 5️⃣ Cập nhật số lượng thành viên
                if (nhom.SoLuongTv > 0)
                    nhom.SoLuongTv -= 1;

                // 6️⃣ Lưu tất cả thay đổi 1 lần
                await _context.SaveChangesAsync();


                // 4️⃣ (Tuỳ chọn) Gửi thông báo Redis
                var thongBao = new
                {
                    ThongBaoId = Guid.NewGuid().ToString(),
                    LoaiThongBao = "Rời Nhóm",
                    TieuDe = "Bạn đã bị xoá khỏi nhóm",
                    NoiDung = $"Bạn đã bị xoá khỏi nhóm \"{nhom.TenNhom}\" cùng các dự án liên quan.",
                    MailNguoiGui = "Hệ thống",
                    ThanhVienId = thanhVienId,
                    NgayTao = DateTime.Now,
                    TrangThai = "Chưa Đọc",
                    Ghim = 0
                };

                string thongBaoKey = $"ThongBao:{thanhVienId}:{thongBao.ThongBaoId}";
                string thongBaoJson = JsonConvert.SerializeObject(thongBao);

                await _cache.SetStringAsync(thongBaoKey, thongBaoJson,
                    new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = _thongBaoTTL });

                string listKey = $"ThongBaoList:{thanhVienId}";
                var listJson = await _cache.GetStringAsync(listKey);
                var list = listJson != null
                    ? JsonConvert.DeserializeObject<List<string>>(listJson)
                    : new List<string>();
                list.Add(thongBao.ThongBaoId);
                await _cache.SetStringAsync(listKey, JsonConvert.SerializeObject(list),
                    new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = _thongBaoTTL });

                await transaction.CommitAsync();

                return Ok(new
                {
                    Message = $"Đã xoá thành viên \"{thanhVien.HoTen}\" khỏi nhóm \"{nhom.TenNhom}\" và chuyển giao các phân công cho trưởng nhóm"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest(new { Message = "Kick thành viên khỏi nhóm thất bại", Error = ex.InnerException?.Message ?? ex.Message });
            }
        }

        [HttpGet("thanh-vien")]
        public async Task<IActionResult> LayTatCaThanhVien()
        {
            var thanhViens = await _context.ThanhViens
                .Include(tv => tv.ChuyenMon)
                .Include(tv => tv.TaiKhoan)
                    .ThenInclude(tk => tk.Quyen)
                .Include(tv => tv.ChiTietThanhVienNhoms)
                    .ThenInclude(ct => ct.Nhom)
                        .ThenInclude(n => n.DuAns)
                            .ThenInclude(da => da.LinhVuc)
                .ToListAsync();

            var ketQua = thanhViens.Select(tv => new
            {
                tv.ThanhVienId,
                tv.HoTen,
                Email = tv.TaiKhoan?.Email,
                QuyenId = tv.TaiKhoan?.QuyenId,
                ChuyenMon = tv.ChuyenMon?.TenChuyenMon,
                DanhSachNhom = tv.ChiTietThanhVienNhoms.Select(ct => new
                {
                    ct.Nhom.NhomId,
                    ct.Nhom.TenNhom,
                    ct.ChucVu,
                    DuAnThuocNhom = ct.Nhom.DuAns.Select(da => new
                    {
                        da.DuAnId,                       
                        da.TenDuAn,
                        da.TrangThai,
                        LinhVuc = da.LinhVuc?.TenLinhVuc
                    }).ToList()
                }).ToList()
            });

            return Ok(ketQua);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> LayChiTietThanhVien(int id)
        {
            var thanhVien = await _context.ThanhViens
                .Include(tv => tv.ChuyenMon)
                .Include(tv => tv.TaiKhoan)
                    .ThenInclude(tk => tk.Quyen)
                .Include(tv => tv.ChiTietThanhVienNhoms)
                    .ThenInclude(ct => ct.Nhom)
                        .ThenInclude(n => n.DuAns)
                            .ThenInclude(da => da.LinhVuc)
                .FirstOrDefaultAsync(tv => tv.ThanhVienId == id);

            if (thanhVien == null)
            {
                return NotFound(new { Message = "Không tìm thấy thành viên" });
            }

            var ketQua = new
            {
                thanhVien.ThanhVienId,
                thanhVien.HoTen,
                Email = thanhVien.TaiKhoan?.Email,
                ChuyenMon = thanhVien.ChuyenMon?.TenChuyenMon,
                SoDienThoai = thanhVien.Sdt,
                DiaChi = thanhVien.DiaChi,
                NgayThamGia = thanhVien.TaiKhoan?.NgayTao,
                QuyenId = thanhVien.TaiKhoan?.QuyenId,
                TenQuyen = thanhVien.TaiKhoan?.Quyen?.TenQuyen,
                DanhSachNhom = thanhVien.ChiTietThanhVienNhoms.Select(ct => new
                {
                    ct.Nhom.NhomId,
                    ct.Nhom.TenNhom,
                    MoTa = ct.Nhom.MoTa,
                    ct.ChucVu,
                    DuAnThuocNhom = ct.Nhom.DuAns.Select(da => new
                    {
                        da.DuAnId,
                        da.TenDuAn,
                        da.MoTa,
                        NgayBatDau = da.NgayBd,
                        NgayKetThuc = da.NgayKt,
                        da.TrangThai,
                        LinhVuc = da.LinhVuc?.TenLinhVuc
                    }).ToList()
                }).ToList()
            };

            return Ok(ketQua);
        }




        private static List<PhanCongItemRequest> DeserializePhanCongItems(string? json)
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                return new List<PhanCongItemRequest>();
            }

            try
            {
                return System.Text.Json.JsonSerializer.Deserialize<List<PhanCongItemRequest>>(json) ?? new List<PhanCongItemRequest>();
            }
            catch
            {
                return new List<PhanCongItemRequest>();
            }
        }

    }
}
