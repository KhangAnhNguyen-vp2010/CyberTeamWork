namespace ServerQuanLyNhom.Models
{
    public class ThongKeBaoCaoDuAnResponse
    {
        public int DuAnID { get; set; }
        public string? TenDuAn { get; set; }

        public int TongSoCV { get; set; }
        public int SoCVChuaBatDau { get; set; }
        public int SoCVHoanThanh { get; set; }
        public int SoCVDangLam { get; set; }
        public int SoCVTreHan { get; set; }

        public decimal PhanTramHoanThanh { get; set; }
        public decimal ThoiGianHoanThanhTrungBinh { get; set; }

        public DateTime? NgayBatDauSomNhatCuaCongViec { get; set; }
        public DateTime? NgayKetThucMuonNhatCuaCongViec { get; set; }

        public int SoNgayConLai { get; set; }
        public decimal TienDoThucTe { get; set; }
        public string? DanhGiaTienDo { get; set; }

        public DateTime NgayCapNhatBaoCao { get; set; }
    }
}
