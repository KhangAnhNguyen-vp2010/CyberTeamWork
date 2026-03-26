namespace ServerQuanLyNhom.DTOs.Nhoms
{
    public class MoiThanhVienRequest
    {
        public int nhomId { get; set; }
        public string? mailNguoiNhan { get; set; }   // email người được mời
        public int nguoiGuiId { get; set; }// email người mời

    }
}
