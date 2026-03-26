namespace ServerQuanLyNhom.DTOs.ThongBaos
{
    public class NhacHanCongViecRequest
    {
        public int CongViecID { get; set; }
        public string MailNguoiGui { get; set; } // email của người nhắc hạn (admin hoặc leader)
        
    }
}
