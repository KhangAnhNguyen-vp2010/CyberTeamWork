using System;
using System.Collections.Generic;

namespace ServerQuanLyNhom.Models;

public partial class Nhom
{
    public int NhomId { get; set; }

    public string? TenNhom { get; set; }

    public string? MoTa { get; set; }

    public int? SoLuongTv { get; set; }

    public DateOnly? NgayLapNhom { get; set; }

    public DateTime? NgayCapNhat { get; set; }

    public string? AnhBia { get; set; }

    public virtual ICollection<ChiTietThanhVienNhom> ChiTietThanhVienNhoms { get; set; } = new List<ChiTietThanhVienNhom>();

    public virtual ICollection<DuAn> DuAns { get; set; } = new List<DuAn>();
}
