namespace ServerQuanLyNhom.Models
{
    public class ThongKeThanhVienResponse
    {
        public int ThanhVienID { get; set; }
        public string? HoTen { get; set; }
        public int SoLuongCongViec { get; set; }
        public int SoLuongHoanThanh { get; set; }
        public double TrungBinhHT { get; set; }
        public string? MucDoHoatDong { get; set; }
    }
}
