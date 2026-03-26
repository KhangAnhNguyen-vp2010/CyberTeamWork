using System;
using System.Collections.Generic;

namespace ServerQuanLyNhom.Models;

public partial class ThanhVien
{
    public int ThanhVienId { get; set; }

    public string? HoTen { get; set; }

    public string? GioiTinh { get; set; }

    public DateOnly? NgaySinh { get; set; }

    public string? MoTaBanThan { get; set; }

    public string? Sdt { get; set; }

    public string? DiaChi { get; set; }

    public int? ChuyenMonId { get; set; }

    public string? AnhBia { get; set; }

    public virtual ICollection<BinhLuan> BinhLuans { get; set; } = new List<BinhLuan>();

    public virtual ICollection<ChiTietThanhVienNhom> ChiTietThanhVienNhoms { get; set; } = new List<ChiTietThanhVienNhom>();

    public virtual ChuyenMon? ChuyenMon { get; set; }

    public virtual ICollection<PhanCong> PhanCongs { get; set; } = new List<PhanCong>();

    public virtual TaiKhoan? TaiKhoan { get; set; }
}
