using System;

namespace ServerQuanLyNhom.DTOs.PhanCongs
{
    public class ThemNgayNopRequest
    {
        public int CongViecId { get; set; }
        public int ThanhVienId { get; set; }
        public DateTime NgayNop { get; set; }
    }
}
