import 'task_assignment.dart';

class MemberProjectTasksResult {
  MemberProjectTasksResult({
    this.message,
    required this.duAnId,
    required this.tongSoCongViec,
    required this.danhSachCongViec,
  });

  factory MemberProjectTasksResult.fromJson(Map<String, dynamic> json) {
    return MemberProjectTasksResult(
      message: json['message']?.toString(),
      duAnId:
          json['duAnId'] is int
              ? json['duAnId'] as int
              : int.tryParse(json['duAnId']?.toString() ?? ''),
      tongSoCongViec:
          json['tongSoCongViec'] is int
              ? json['tongSoCongViec'] as int
              : int.tryParse(json['tongSoCongViec']?.toString() ?? '') ?? 0,
      danhSachCongViec: (json['danhSachCongViec'] as List<dynamic>? ?? const [])
          .map((item) => MemberTaskItem.fromJson(item as Map<String, dynamic>))
          .toList(growable: false),
    );
  }

  final String? message;
  final int? duAnId;
  final int tongSoCongViec;
  final List<MemberTaskItem> danhSachCongViec;
}

class MemberTaskItem {
  MemberTaskItem({
    required this.congViec,
    required this.thanhVienId,
    required this.soLuongSubTask,
    required this.subTasks,
  });

  factory MemberTaskItem.fromJson(Map<String, dynamic> json) {
    return MemberTaskItem(
      congViec: MemberTaskSummary.fromJson(
        (json['congViec'] as Map<String, dynamic>? ?? const {}),
      ),
      thanhVienId:
          json['thanhVienId'] is int
              ? json['thanhVienId'] as int
              : int.tryParse(json['thanhVienId']?.toString() ?? '') ?? 0,
      soLuongSubTask:
          json['soLuongSubTask'] is int
              ? json['soLuongSubTask'] as int
              : int.tryParse(json['soLuongSubTask']?.toString() ?? '') ?? 0,
      subTasks: (json['subTasks'] as List<dynamic>? ?? const [])
          .map((item) => MemberSubTask.fromJson(item as Map<String, dynamic>))
          .toList(growable: false),
    );
  }

  final MemberTaskSummary congViec;
  final int thanhVienId;
  final int soLuongSubTask;
  final List<MemberSubTask> subTasks;
}

class MemberTaskSummary {
  MemberTaskSummary({
    required this.congViecId,
    required this.tenCongViec,
    required this.trangThai,
    required this.ngayBatDau,
    required this.ngayKetThuc,
  });

  factory MemberTaskSummary.fromJson(Map<String, dynamic> json) {
    return MemberTaskSummary(
      congViecId:
          json['congViecId'] is int
              ? json['congViecId'] as int
              : int.tryParse(json['congViecId']?.toString() ?? '') ?? 0,
      tenCongViec: json['tenCongViec']?.toString() ?? 'Không rõ tên',
      trangThai: json['trangThai']?.toString() ?? 'Không xác định',
      ngayBatDau: DateTime.tryParse(json['ngayBatDau']?.toString() ?? ''),
      ngayKetThuc: DateTime.tryParse(json['ngayKetThuc']?.toString() ?? ''),
    );
  }

  final int congViecId;
  final String tenCongViec;
  final String trangThai;
  final DateTime? ngayBatDau;
  final DateTime? ngayKetThuc;
}

class MemberSubTask {
  MemberSubTask({
    required this.subTaskId,
    required this.moTa,
    required this.ngayPC,
    required this.doUuTien,
    required this.ketQuaThucHien,
    required this.danhGia,
    required this.tienDoHoanThanh,
    required this.trangThaiKhoa,
    this.ngayNop = const <DateTime>[],
  });

  factory MemberSubTask.fromJson(Map<String, dynamic> json) {
    final rawNgayNop = json['ngayNop'] as List<dynamic>? ?? [];
    final ngayNopList = rawNgayNop
        .map((item) => DateTime.tryParse(item.toString()))
        .where((date) => date != null)
        .cast<DateTime>()
        .toList(growable: false);

    return MemberSubTask(
      subTaskId: json['subTaskId']?.toString() ?? '',
      moTa: json['moTa']?.toString() ?? 'Không có mô tả',
      ngayPC: DateTime.tryParse(json['ngayPC']?.toString() ?? ''),
      doUuTien: json['doUuTien']?.toString() ?? 'Không rõ',
      ketQuaThucHien: AssignmentResult.fromJson(json['ketQuaThucHien']),
      danhGia: json['danhGia']?.toString() ?? 'Chưa có',
      tienDoHoanThanh: json['tienDoHoanThanh']?.toString() ?? '0%',
      trangThaiKhoa: json['trangThaiKhoa'] as int? ?? 0,
      ngayNop: ngayNopList,
    );
  }

  final String subTaskId;
  final String moTa;
  final DateTime? ngayPC;
  final String doUuTien;
  final AssignmentResult ketQuaThucHien;
  final String danhGia;
  final String tienDoHoanThanh;
  final int trangThaiKhoa;
  final List<DateTime> ngayNop;
}
