class TaskAssignment {
  TaskAssignment({
    required this.thanhVienId,
    required this.hoTen,
    required this.noiDungPhanCong,
  });

  factory TaskAssignment.fromJson(Map<String, dynamic> json) {
    final rawAssignments =
        json['noiDungPhanCong'] as List<dynamic>? ?? const [];
    return TaskAssignment(
      thanhVienId: json['thanhVienId'] as int? ?? 0,
      hoTen: json['hoTen'] as String? ?? 'Không rõ',
      noiDungPhanCong: rawAssignments
          .map(
            (item) => AssignmentDetail.fromJson(item as Map<String, dynamic>),
          )
          .toList(growable: false),
    );
  }

  final int thanhVienId;
  final String hoTen;
  final List<AssignmentDetail> noiDungPhanCong;
}

class AssignmentResult {
  const AssignmentResult({this.noiDung = '', this.files = const <String>[]});

  factory AssignmentResult.fromJson(dynamic json) {
    if (json is Map<String, dynamic>) {
      final note = json['NoiDung'] ?? json['noiDung'] ?? json['note'] ?? '';
      final rawFiles =
          json['File'] ?? json['Files'] ?? json['file'] ?? json['files'];
      final files =
          rawFiles is List
              ? rawFiles
                  .map((item) => item?.toString() ?? '')
                  .where((item) => item.isNotEmpty)
                  .toList(growable: false)
              : const <String>[];
      return AssignmentResult(noiDung: note.toString(), files: files);
    }

    if (json is List) {
      final files = json
          .map((item) => item?.toString() ?? '')
          .where((item) => item.isNotEmpty)
          .toList(growable: false);
      return AssignmentResult(files: files);
    }

    if (json is String && json.trim().isNotEmpty) {
      return AssignmentResult(noiDung: json.trim());
    }

    return const AssignmentResult();
  }

  Map<String, dynamic> toJson() => {'NoiDung': noiDung, 'File': files};

  bool get hasFiles => files.isNotEmpty;

  bool get hasNote => noiDung.trim().isNotEmpty;

  bool get isEmpty => !hasNote && files.isEmpty;

  final String noiDung;
  final List<String> files;
}

class AssignmentDetail {
  AssignmentDetail({
    required this.subTaskId,
    required this.moTa,
    required this.ngayPhanCong,
    required this.doUuTien,
    required this.ketQuaThucHien,
    required this.danhGia,
    required this.tienDoHoanThanh,
    required this.trangThaiKhoa,
    this.ngayNop = const <DateTime>[],
  });

  factory AssignmentDetail.fromJson(Map<String, dynamic> json) {
    String resolveSubTaskId() {
      const normalizedKeys = {
        'subtaskid',
        'subtask_id',
        'phancongitemid',
        'phancongitem_id',
        'phancongid',
        'phancong_id',
        'id',
      };

      for (final entry in json.entries) {
        final key = entry.key.toString().toLowerCase().replaceAll(
          RegExp(r'[^a-z0-9]'),
          '',
        );
        if (!normalizedKeys.contains(key)) {
          continue;
        }

        final value = entry.value;
        if (value == null) continue;
        final text = value.toString().trim();
        if (text.isNotEmpty) {
          return text;
        }
      }

      return '';
    }

    final rawNgayNop = json['ngayNop'] as List<dynamic>? ?? [];
    final ngayNopList = rawNgayNop
        .map((item) => DateTime.tryParse(item.toString()))
        .where((date) => date != null)
        .cast<DateTime>()
        .toList(growable: false);

    return AssignmentDetail(
      subTaskId: resolveSubTaskId(),
      moTa: json['moTa'] as String? ?? 'Không có mô tả',
      ngayPhanCong: DateTime.tryParse(json['ngayPC'] as String? ?? ''),
      doUuTien: json['doUuTien'] as String? ?? 'không rõ',
      ketQuaThucHien: AssignmentResult.fromJson(json['ketQuaThucHien']),
      danhGia: json['danhGia'] as String? ?? 'Chưa có',
      tienDoHoanThanh: json['tienDoHoanThanh'] as String? ?? '0%',
      trangThaiKhoa: json['trangThaiKhoa'] as int? ?? 0,
      ngayNop: ngayNopList,
    );
  }

  final String subTaskId;
  final String moTa;
  final DateTime? ngayPhanCong;
  final String doUuTien;
  final AssignmentResult ketQuaThucHien;
  final String danhGia;
  final String tienDoHoanThanh;
  final int trangThaiKhoa;
  final List<DateTime> ngayNop;
}
