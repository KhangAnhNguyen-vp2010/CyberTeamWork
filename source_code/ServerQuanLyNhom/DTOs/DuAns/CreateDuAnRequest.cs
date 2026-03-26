namespace ServerQuanLyNhom.DTOs.DuAns
{
    public class CreateDuAnRequest
    {
        public string TenDuAn { get; set; }
        public string MoTa { get; set; }
        public DateOnly? NgayBD { get; set; }
        public DateOnly? NgayKT { get; set; }
        public int? NhomID { get; set; }       // có thể null
        public int LinhVucID { get; set; }    // bắt buộc chọn LinhVuc
        public IFormFile? AnhBia { get; set; } // ảnh bìa dự án
    }
}
