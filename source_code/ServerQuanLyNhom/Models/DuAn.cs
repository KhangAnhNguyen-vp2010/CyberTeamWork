using System;
using System.Collections.Generic;

namespace ServerQuanLyNhom.Models;

public partial class DuAn
{
    public int DuAnId { get; set; }

    public string TenDuAn { get; set; } = null!;

    public string? MoTa { get; set; }

    public DateOnly? NgayBd { get; set; }

    public DateOnly? NgayKt { get; set; }

    public string? TrangThai { get; set; }

    public string? AnhBia { get; set; }

    public int? NhomId { get; set; }

    public int? LinhVucId { get; set; }

    public virtual ICollection<CongViec> CongViecs { get; set; } = new List<CongViec>();

    public virtual LinhVuc? LinhVuc { get; set; }

    public virtual Nhom? Nhom { get; set; }
}
