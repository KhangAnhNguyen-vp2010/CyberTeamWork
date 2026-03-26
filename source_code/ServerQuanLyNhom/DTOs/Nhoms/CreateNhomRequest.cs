namespace ServerQuanLyNhom.DTOs.NewFolder
{
    public class CreateNhomRequest
    {
        public string TenNhom { get; set; }
        public string MoTa { get; set; }
        public IFormFile? AnhBia { get; set; } // ảnh có thể null
        public int ThanhVienID { get; set; }  // Ai là người tạo nhóm
    }
}
