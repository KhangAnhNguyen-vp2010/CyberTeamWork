import 'dart:convert';

class NotificationItem {
  NotificationItem({
    required this.id,
    required this.type,
    required this.title,
    required this.content,
    required this.senderEmail,
    required this.memberId,
    required this.createdAt,
    required this.status,
    required this.pin,
    this.readAt,
  });

  final String id;
  final String type;
  final String title;
  final String content;
  final String senderEmail;
  final int memberId;
  final DateTime createdAt;
  final String status;
  final int pin;
  final DateTime? readAt;

  factory NotificationItem.fromJson(Map<String, dynamic> json) {
    return NotificationItem(
      id: json['thongBaoId']?.toString() ?? '',
      type: json['loaiThongBao']?.toString() ?? '',
      title: json['tieuDe']?.toString() ?? '',
      content: json['noiDung']?.toString() ?? '',
      senderEmail: json['mailNguoiGui']?.toString() ?? '',
      memberId: _parseInt(json['thanhVienId']),
      createdAt: _parseDate(json['ngayTao']),
      readAt: _parseNullableDate(json['ngayDoc']),
      status: json['trangThai']?.toString() ?? '',
      pin: _parseInt(json['ghim']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'thongBaoId': id,
      'loaiThongBao': type,
      'tieuDe': title,
      'noiDung': content,
      'mailNguoiGui': senderEmail,
      'thanhVienId': memberId,
      'ngayTao': createdAt.toIso8601String(),
      'ngayDoc': readAt?.toIso8601String(),
      'trangThai': status,
      'ghim': pin,
    };
  }

  NotificationItem copyWith({
    String? id,
    String? type,
    String? title,
    String? content,
    String? senderEmail,
    int? memberId,
    DateTime? createdAt,
    DateTime? readAt,
    String? status,
    int? pin,
  }) {
    return NotificationItem(
      id: id ?? this.id,
      type: type ?? this.type,
      title: title ?? this.title,
      content: content ?? this.content,
      senderEmail: senderEmail ?? this.senderEmail,
      memberId: memberId ?? this.memberId,
      createdAt: createdAt ?? this.createdAt,
      readAt: readAt ?? this.readAt,
      status: status ?? this.status,
      pin: pin ?? this.pin,
    );
  }

  static int _parseInt(dynamic value) {
    if (value is int) return value;
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }

  static DateTime _parseDate(dynamic value) {
    if (value is DateTime) return value;
    final parsed = DateTime.tryParse(value?.toString() ?? '');
    return parsed ?? DateTime.fromMillisecondsSinceEpoch(0);
  }

  static DateTime? _parseNullableDate(dynamic value) {
    if (value == null) return null;
    if (value is DateTime) return value;
    return DateTime.tryParse(value.toString());
  }

  static List<NotificationItem> listFromJson(String jsonStr) {
    final decoded = jsonDecode(jsonStr);
    if (decoded is List) {
      return decoded
          .map((item) => NotificationItem.fromJson(item as Map<String, dynamic>))
          .toList();
    }
    if (decoded is Map<String, dynamic> && decoded['data'] is List) {
      return (decoded['data'] as List)
          .map((item) => NotificationItem.fromJson(item as Map<String, dynamic>))
          .toList();
    }
    return const [];
  }
}
