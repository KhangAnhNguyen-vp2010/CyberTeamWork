using System;
using System.Collections.Generic;

namespace ServerQuanLyNhom.Models;

public partial class ChuyenMon
{
    public int ChuyenMonId { get; set; }

    public string TenChuyenMon { get; set; } = null!;

    public virtual ICollection<ThanhVien> ThanhViens { get; set; } = new List<ThanhVien>();
}
