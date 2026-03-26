namespace ServerQuanLyNhom.DTOs.Nhoms
{
    public class LoiMoiCacheItem
    {
        public int NguoiGuiId { get; set; }
        public string MailNguoiNhan { get; set; } = "";
        public int NhomId { get; set; }
        public string TrangThaiLoiMoi { get; set; } = "Đang chờ"; // "Đã chấp nhận", "Đã từ chối"
        public string TieuDe { get; set; } = "";
        public string NoiDung { get; set; } = "";
        public DateTime ThoiGianGui { get; set; } = DateTime.Now;
    }
}
