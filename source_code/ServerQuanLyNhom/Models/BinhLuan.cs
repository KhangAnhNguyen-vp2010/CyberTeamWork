using System;
using System.Collections.Generic;

namespace ServerQuanLyNhom.Models;

public partial class BinhLuan
{
    public int BinhLuanId { get; set; }

    public string? NoiDung { get; set; }

    public DateTime? NgayBinhLuan { get; set; }

    public DateTime? NgayCapNhat { get; set; }

    public int? ThanhVienId { get; set; }

    public int? CongViecId { get; set; }

    public virtual CongViec? CongViec { get; set; }

    public virtual ThanhVien? ThanhVien { get; set; }
}
