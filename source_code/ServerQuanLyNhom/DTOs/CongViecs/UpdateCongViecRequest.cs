namespace ServerQuanLyNhom.DTOs.CongViecs
{
    public class UpdateCongViecRequest
    {
        public int CongViecID { get; set; }
        public string TenCongViec { get; set; }
        public DateOnly? NgayBD { get; set; }
        public DateOnly? NgayKT { get; set; }        
        
        public int? DuAnID { get; set; }
        public IFormFile? AnhBia { get; set; } // đổi ảnh bìa nếu muốn
    }
}
