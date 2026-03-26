using System;
using System.Collections.Generic;

namespace ServerQuanLyNhom.Models;

public partial class TaiKhoan
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

    public virtual Quyen? Quyen { get; set; }

    public virtual ThanhVien? ThanhVien { get; set; }
}
