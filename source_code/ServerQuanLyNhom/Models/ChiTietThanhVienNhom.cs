using System;
using System.Collections.Generic;

namespace ServerQuanLyNhom.Models;

public partial class ChiTietThanhVienNhom
{
    public int NhomId { get; set; }

    public int ThanhVienId { get; set; }

    public string? ChucVu { get; set; }

    public DateOnly? NgayThamGia { get; set; }

    public virtual Nhom Nhom { get; set; } = null!;

    public virtual ThanhVien ThanhVien { get; set; } = null!;
}
