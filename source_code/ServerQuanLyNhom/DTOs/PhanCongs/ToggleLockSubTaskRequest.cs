namespace ServerQuanLyNhom.DTOs.PhanCongs
{
    public class ToggleLockSubTaskRequest
    {
        public int CongViecId { get; set; }
        public int ThanhVienId { get; set; }
        public string SubTaskId { get; set; } = string.Empty;
        public int TrangThaiKhoa { get; set; }
    }
}
