namespace ServerQuanLyNhom.Models
{
    public class ThongBaoModel
    {
        public string ThongBaoId { get; set; }
        public string LoaiThongBao { get; set; }
        public string TieuDe { get; set; }
        public string NoiDung { get; set; }
        public string MailNguoiGui { get; set; }
        public int ThanhVienId { get; set; }
        public DateTime NgayTao { get; set; }
        public DateTime? NgayDoc { get; set; }
        public string TrangThai { get; set; }
        public int Ghim { get; set; }
    }
}
