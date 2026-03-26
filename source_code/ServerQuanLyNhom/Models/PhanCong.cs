using System;
using System.Collections.Generic;

namespace ServerQuanLyNhom.Models;

public partial class PhanCong
{
    public int CongViecId { get; set; }

    public int ThanhVienId { get; set; }

    public string? NoiDungPhanCong { get; set; }

    public virtual CongViec CongViec { get; set; } = null!;

    public virtual ThanhVien ThanhVien { get; set; } = null!;
}
