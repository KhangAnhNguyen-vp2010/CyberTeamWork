class ProjectSummary {
  ProjectSummary({
    required this.duAnId,
    required this.tenDuAn,
    required this.moTa,
    required this.ngayBd,
    required this.ngayKt,
    required this.trangThai,
    required this.anhBia,
    required this.tenLinhVuc,
    this.chucVu,
  });

  final int duAnId;
  final String tenDuAn;
  final String? moTa;
  final DateTime? ngayBd;
  final DateTime? ngayKt;
  final String trangThai;
  final String? anhBia;
  final String? tenLinhVuc;
  final String? chucVu;

  factory ProjectSummary.fromJson(Map<String, dynamic> json) {
    DateTime? parseDate(String? value) {
      if (value == null || value.isEmpty) return null;
      return DateTime.tryParse(value);
    }

    return ProjectSummary(
      duAnId: json['duAnId'] is int
          ? json['duAnId'] as int
          : int.tryParse(json['duAnId']?.toString() ?? '') ?? 0,
      tenDuAn: json['tenDuAn']?.toString() ?? 'Dự án không tên',
      moTa: json['moTa']?.toString(),
      ngayBd: parseDate(json['ngayBd']?.toString()),
      ngayKt: parseDate(json['ngayKt']?.toString()),
      trangThai: json['trangThai']?.toString() ?? 'Không xác định',
      anhBia: json['anhBia']?.toString(),
      tenLinhVuc: json['tenLinhVuc']?.toString(),
      chucVu: json['chucVu']?.toString(),
    );
  }
}
