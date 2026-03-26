using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using ServerQuanLyNhom.DTOs.BinhLuan;
using ServerQuanLyNhom.Models;
using ServerQuanLyNhom.Services;
using ServerQuanLyNhom.Services.Email;

namespace ServerQuanLyNhom.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class BinhLuanController : ControllerBase
    {
        private readonly QuanLyCongViecNhomContext _context;
        private readonly OtpService _otpService;
        private readonly EmailService _emailService;
        private readonly IMemoryCache _cache;

        public BinhLuanController(QuanLyCongViecNhomContext context, OtpService otpService, EmailService emailService, IMemoryCache cache)
        {
            _context = context;
            _otpService = otpService;
            _emailService = emailService;
            _cache = cache;
        }

        [HttpPost("CreateBinhLuan")]
        public async Task<IActionResult> CreateBinhLuan([FromBody] CreateBinhLuanRequest dto)
        {
            try
            {
                var congViec = await _context.CongViecs.FindAsync(dto.CongViecID);
                if (congViec == null)
                    return NotFound(new { Message = "Công việc không tồn tại" });

                var thanhVien = await _context.ThanhViens.FindAsync(dto.ThanhVienID);
                if (thanhVien == null)
                    return NotFound(new { Message = "Thành viên không tồn tại" });

                var binhLuan = new BinhLuan
                {
                    CongViecId = dto.CongViecID,
                    ThanhVienId = dto.ThanhVienID,
                    NoiDung = dto.NoiDung,
                    NgayBinhLuan = DateTime.Now
                };

                _context.BinhLuans.Add(binhLuan);
                await _context.SaveChangesAsync();

                return Ok(new { Message = "Thêm bình luận thành công", BinhLuanID = binhLuan.BinhLuanId });
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = "Thêm bình luận thất bại", Error = ex.InnerException?.Message ?? ex.Message });
            }
        }

        [HttpPut("UpdateBinhLuan/{binhLuanId}")]
        public async Task<IActionResult> UpdateBinhLuan(int binhLuanId, [FromBody] UpdateBinhLuanRequest dto)
        {
            try
            {
                var binhLuan = await _context.BinhLuans.FindAsync(binhLuanId);
                if (binhLuan == null)
                    return NotFound(new { Message = "Bình luận không tồn tại" });

                binhLuan.NoiDung = dto.NoiDung;
                binhLuan.NgayCapNhat = DateTime.Now;

                _context.BinhLuans.Update(binhLuan);
                await _context.SaveChangesAsync();

                return Ok(new { Message = "Cập nhật bình luận thành công" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = "Cập nhật thất bại", Error = ex.InnerException?.Message ?? ex.Message });
            }
        }

        [HttpDelete("DeleteBinhLuan/{binhLuanId}")]
        public async Task<IActionResult> DeleteBinhLuan(int binhLuanId)
        {
            try
            {
                var binhLuan = await _context.BinhLuans.FindAsync(binhLuanId);
                if (binhLuan == null)
                    return NotFound(new { Message = "Bình luận không tồn tại" });

                _context.BinhLuans.Remove(binhLuan);
                await _context.SaveChangesAsync();

                return Ok(new { Message = "Xóa bình luận thành công" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = "Xóa thất bại", Error = ex.InnerException?.Message ?? ex.Message });
            }
        }

        [HttpGet("GetBinhLuansOfCongViec/{congViecId}")]
        public async Task<IActionResult> GetBinhLuansOfCongViec(int congViecId)
        {
            // Lấy tất cả bình luận liên quan tới công việc
            var binhLuans = await _context.BinhLuans
                .Where(b => b.CongViecId == congViecId)
                .Include(b => b.ThanhVien) // lấy thông tin thành viên
                .OrderBy(b => b.NgayBinhLuan) // sắp xếp theo thời gian
                .Select(b => new
                {
                    b.BinhLuanId,
                    b.NoiDung,
                    b.NgayBinhLuan,
                    b.NgayCapNhat,
                    ThanhVienID = b.ThanhVienId,
                    HoTen = b.ThanhVien.HoTen
                })
                .ToListAsync();

            return Ok(binhLuans);
        }

    }
}
