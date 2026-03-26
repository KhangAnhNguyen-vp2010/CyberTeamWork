namespace ServerQuanLyNhom.DTOs.PhanCongs
{
    public class XoaFileBaoCaoRequest
    {
        public int CongViecId { get; set; }
        public int ThanhVienId { get; set; }
        public string SubTaskId { get; set; } = string.Empty;
        public string FileUrl { get; set; } = string.Empty;
    }
}
