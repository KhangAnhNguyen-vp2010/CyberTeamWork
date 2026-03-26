namespace ServerQuanLyNhom.DTOs.PhanCongs
{
    public class CapNhatTienDoRequest
    {
        public int CongViecId { get; set; }
        public int ThanhVienId { get; set; }
        public string SubTaskId { get; set; } = string.Empty;
        public string TienDoHoanThanh { get; set; } = "0%";
    }
}
