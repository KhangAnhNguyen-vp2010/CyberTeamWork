class GroupSummary {
  GroupSummary({
    required this.nhomId,
    required this.tenNhom,
    required this.moTa,
    required this.soLuongTv,
    required this.ngayLapNhom,
    required this.anhBia,
    required this.chucVu,
  });

  final int nhomId;
  final String tenNhom;
  final String? moTa;
  final int soLuongTv;
  final DateTime? ngayLapNhom;
  final String? anhBia;
  final String? chucVu;

  factory GroupSummary.fromJson(Map<String, dynamic> json) {
    return GroupSummary(
      nhomId: json['nhomId'] is int
          ? json['nhomId'] as int
          : int.tryParse(json['nhomId']?.toString() ?? '') ?? 0,
      tenNhom: json['tenNhom']?.toString() ?? 'Nhóm không tên',
      moTa: json['moTa']?.toString(),
      soLuongTv: json['soLuongTv'] is int
          ? json['soLuongTv'] as int
          : int.tryParse(json['soLuongTv']?.toString() ?? '') ?? 0,
      ngayLapNhom: json['ngayLapNhom'] != null
          ? DateTime.tryParse(json['ngayLapNhom'].toString())
          : null,
      anhBia: json['anhBia']?.toString(),
      chucVu: json['chucVu']?.toString(),
    );
  }
}
