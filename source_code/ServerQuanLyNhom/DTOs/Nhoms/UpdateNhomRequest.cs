namespace ServerQuanLyNhom.DTOs.Nhoms
{
    public class UpdateNhomRequest
    {
        public int NhomID { get; set; }
        public string TenNhom { get; set; }
        public string MoTa { get; set; }
        public IFormFile? AnhBia { get; set; }  // Có thể đổi ảnh bìa
    }
}
