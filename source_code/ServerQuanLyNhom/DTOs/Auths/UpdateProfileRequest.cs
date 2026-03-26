namespace ServerQuanLyNhom.DTOs.Auths
{
    public class UpdateProfileRequest
    {
        public string? HoTen { get; set; }
        public string? GioiTinh { get; set; }
        public DateOnly? NgaySinh { get; set; }
        public string? MoTaBanThan { get; set; }
        public string? SoDienThoai { get; set; }
        public string? DiaChi { get; set; }
        public int? ChuyenMonId { get; set; }

        public IFormFile? AnhBia { get; set; } // ảnh có thể null
    }
}
