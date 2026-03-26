class ProjectTask {
  ProjectTask({
    required this.congViecId,
    required this.tenCongViec,
    required this.ngayBd,
    required this.ngayKt,
    required this.trangThai,
    required this.phamTramHoanThanh,
    required this.anhBia,
  });

  final int congViecId;
  final String tenCongViec;
  final DateTime? ngayBd;
  final DateTime? ngayKt;
  final String trangThai;
  final double phamTramHoanThanh;
  final String? anhBia;

  factory ProjectTask.fromJson(Map<String, dynamic> json) {
    DateTime? parseDate(String? value) {
      if (value == null || value.isEmpty) return null;
      return DateTime.tryParse(value);
    }

    double parseProgress(dynamic value) {
      if (value is num) return value.toDouble();
      if (value is String) {
        final cleaned = value.replaceAll('%', '').trim();
        return double.tryParse(cleaned) ?? 0;
      }
      return 0;
    }

    return ProjectTask(
      congViecId: json['congViecId'] is int
          ? json['congViecId'] as int
          : int.tryParse(json['congViecId']?.toString() ?? '') ?? 0,
      tenCongViec: json['tenCongViec']?.toString() ?? 'Công việc không tên',
      ngayBd: parseDate(json['ngayBd']?.toString()),
      ngayKt: parseDate(json['ngayKt']?.toString()),
      trangThai: json['trangThai']?.toString() ?? 'Không xác định',
      phamTramHoanThanh: parseProgress(json['phamTramHoanThanh']),
      anhBia: json['anhBia']?.toString(),
    );
  }

  ProjectTask copyWith({
    int? congViecId,
    String? tenCongViec,
    DateTime? ngayBd,
    DateTime? ngayKt,
    String? trangThai,
    double? phamTramHoanThanh,
    String? anhBia,
  }) {
    return ProjectTask(
      congViecId: congViecId ?? this.congViecId,
      tenCongViec: tenCongViec ?? this.tenCongViec,
      ngayBd: ngayBd ?? this.ngayBd,
      ngayKt: ngayKt ?? this.ngayKt,
      trangThai: trangThai ?? this.trangThai,
      phamTramHoanThanh: phamTramHoanThanh ?? this.phamTramHoanThanh,
      anhBia: anhBia ?? this.anhBia,
    );
  }

}

class ProjectTasksPayload {
  ProjectTasksPayload({
    required this.duAnId,
    required this.tenDuAn,
    required this.tasks,
  });

  final int duAnId;
  final String tenDuAn;
  final List<ProjectTask> tasks;

  factory ProjectTasksPayload.fromJson(Map<String, dynamic> json) {
    final tasks = (json['congViecs'] as List<dynamic>? ?? [])
        .map((e) => ProjectTask.fromJson(_ensureMap(e)))
        .toList();

    return ProjectTasksPayload(
      duAnId: json['duAnID'] is int
          ? json['duAnID'] as int
          : int.tryParse(json['duAnID']?.toString() ?? '') ?? 0,
      tenDuAn: json['tenDuAn']?.toString() ?? 'Dự án',
      tasks: tasks,
    );
  }

  ProjectTasksPayload copyWith({
    int? duAnId,
    String? tenDuAn,
    List<ProjectTask>? tasks,
  }) {
    return ProjectTasksPayload(
      duAnId: duAnId ?? this.duAnId,
      tenDuAn: tenDuAn ?? this.tenDuAn,
      tasks: tasks ?? this.tasks,
    );
  }
}

Map<String, dynamic> _ensureMap(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) {
    return value.map((key, val) => MapEntry(key.toString(), val));
  }
  throw ArgumentError('Expected Map but got ${value.runtimeType}');
}
