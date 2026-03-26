namespace ServerQuanLyNhom.DTOs.DuAns
{
    public class UpdateDuAnRequest
    {
        public int DuAnID { get; set; }
        public string TenDuAn { get; set; }
        public string MoTa { get; set; }
        public DateOnly? NgayBD { get; set; }
        public DateOnly? NgayKT { get; set; }        
        public int LinhVucID { get; set; }
        public string? TrangThai { get; set; } // Đang thực hiện / Hoàn thành / Tạm dừng
        public IFormFile? AnhBia { get; set; } // đổi ảnh bìa nếu muốn
    }
}
