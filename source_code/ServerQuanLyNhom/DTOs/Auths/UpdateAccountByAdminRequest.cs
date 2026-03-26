namespace ServerQuanLyNhom.DTOs.Auths;

public class UpdateAccountByAdminRequest
{
    public string? TenTaiKhoan { get; set; }
    public string? Email { get; set; }
    public string? HoTen { get; set; }
    public string? GioiTinh { get; set; }
    public string? NgaySinh { get; set; }
    public string? Sdt { get; set; }
    public string? DiaChi { get; set; }
    public int? ChuyenMonId { get; set; }
}
