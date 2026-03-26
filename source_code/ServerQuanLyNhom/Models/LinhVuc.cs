using System;
using System.Collections.Generic;

namespace ServerQuanLyNhom.Models;

public partial class LinhVuc
{
    public int LinhVucId { get; set; }

    public string TenLinhVuc { get; set; } = null!;

    public virtual ICollection<DuAn> DuAns { get; set; } = new List<DuAn>();
}
