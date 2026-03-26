namespace ServerQuanLyNhom.DTOs.PhanCongs
{
    public class DanhGiaTienDoRequest
    {
        public int CongViecId { get; set; }
        public int ThanhVienId { get; set; }
        public string SubTaskId { get; set; } = string.Empty;
        public string DanhGia { get; set; } = string.Empty;
    }
}
