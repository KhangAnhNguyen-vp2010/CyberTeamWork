namespace ServerQuanLyNhom.DTOs.ThongBaos
{
    public class ThongBaoBinhLuanRequest
    {
        public int CongViecID { get; set; }
        public int ThanhVienGuiID { get; set; }   // Người bình luận
        public string NoiDungBinhLuan { get; set; }        
    }
}
