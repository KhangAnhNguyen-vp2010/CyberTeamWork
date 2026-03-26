using System;
using System.Collections.Generic;

namespace ServerQuanLyNhom.Models;

public partial class CongViec
{
    public int CongViecId { get; set; }

    public string TenCongViec { get; set; } = null!;

    public DateOnly? NgayBd { get; set; }

    public DateOnly? NgayKt { get; set; }

    public string? TrangThai { get; set; }

    public double? PhamTramHoanThanh { get; set; }

    public string? AnhBia { get; set; }

    public int? DuAnId { get; set; }

    public string? FileDinhKem { get; set; }

    public virtual ICollection<BinhLuan> BinhLuans { get; set; } = new List<BinhLuan>();

    public virtual DuAn? DuAn { get; set; }

    public virtual ICollection<PhanCong> PhanCongs { get; set; } = new List<PhanCong>();
}
