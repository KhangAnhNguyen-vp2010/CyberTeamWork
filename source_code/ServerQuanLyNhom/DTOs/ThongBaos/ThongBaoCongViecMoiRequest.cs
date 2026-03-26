namespace ServerQuanLyNhom.DTOs.ThongBaos
{
    public class ThongBaoCongViecMoiRequest
    {
        public int CongViecID { get; set; }

        public int ThanhVienID { get; set; }
        public string MailNguoiGui { get; set; } = string.Empty;
    }
}
