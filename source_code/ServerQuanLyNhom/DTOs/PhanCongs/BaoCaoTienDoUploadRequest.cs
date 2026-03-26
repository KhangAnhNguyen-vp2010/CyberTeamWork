namespace ServerQuanLyNhom.DTOs.PhanCongs
{
    public class BaoCaoTienDoUploadRequest
    {
        public int CongViecId { get; set; }
        public int ThanhVienId { get; set; }
        public string SubTaskId { get; set; } = string.Empty;
        public string? NoiDung { get; set; }
        public List<IFormFile> Files { get; set; } = new();
    }
}
