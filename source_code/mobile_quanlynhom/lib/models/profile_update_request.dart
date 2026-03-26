class ProfileUpdateRequest {
  ProfileUpdateRequest({
    required this.userId,
    this.hoTen,
    this.gioiTinh,
    this.ngaySinh,
    this.moTaBanThan,
    this.soDienThoai,
    this.diaChi,
    this.chuyenMonId,
    this.anhBia,
  });

  final int userId;
  final String? hoTen;
  final String? gioiTinh;
  final String? ngaySinh;
  final String? moTaBanThan;
  final String? soDienThoai;
  final String? diaChi;
  final int? chuyenMonId;
  final String? anhBia;

  Map<String, dynamic> toJson() {
    return {
      if (hoTen != null) 'HoTen': hoTen,
      if (gioiTinh != null) 'GioiTinh': gioiTinh,
      if (ngaySinh != null) 'NgaySinh': ngaySinh,
      if (moTaBanThan != null) 'MoTaBanThan': moTaBanThan,
      if (soDienThoai != null) 'SoDienThoai': soDienThoai,
      if (diaChi != null) 'DiaChi': diaChi,
      if (chuyenMonId != null) 'ChuyenMonId': chuyenMonId,
      if (anhBia != null && anhBia!.isNotEmpty) 'AnhBia': anhBia,
    };
  }
}
