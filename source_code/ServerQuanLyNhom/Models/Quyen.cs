using System;
using System.Collections.Generic;

namespace ServerQuanLyNhom.Models;

public partial class Quyen
{
    public int QuyenId { get; set; }

    public string TenQuyen { get; set; } = null!;

    public string? MoTa { get; set; }

    public virtual ICollection<TaiKhoan> TaiKhoans { get; set; } = new List<TaiKhoan>();
}
