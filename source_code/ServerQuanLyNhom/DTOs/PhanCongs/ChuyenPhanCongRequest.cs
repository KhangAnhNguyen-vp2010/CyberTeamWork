namespace ServerQuanLyNhom.DTOs.PhanCongs
{
    public class ChuyenPhanCongRequest
    {
        public int CongViecId { get; set; }
        public int ThanhVienCuId { get; set; }
        public int ThanhVienMoiId { get; set; }
        public List<string> SubTaskIds { get; set; } = new();
    }
}
