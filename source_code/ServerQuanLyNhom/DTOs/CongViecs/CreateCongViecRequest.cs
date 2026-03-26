namespace ServerQuanLyNhom.DTOs.CongViecs
{
    public class CreateCongViecRequest
    {
        public string TenCongViec { get; set; }
        public DateOnly? NgayBD { get; set; }
        public DateOnly? NgayKT { get; set; }
        public string? TrangThai { get; set; } // ví dụ: Đang thực hiện, Hoàn thành
        public float? PhamTramHoanThanh { get; set; }
        public int? DuAnID { get; set; }       // công việc thuộc dự án nào
        public IFormFile? AnhBia { get; set; }
    }
}
