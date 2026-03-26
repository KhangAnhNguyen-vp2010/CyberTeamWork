namespace ServerQuanLyNhom.DTOs.PhanCongs
{
    public class UpdatePhanCongItemRequest
    {
        public string SubTaskId { get; set; } = string.Empty;
        public string MoTa { get; set; }
        public DateOnly NgayPC { get; set; }
        public string DoUuTien { get; set; }
    }
}
