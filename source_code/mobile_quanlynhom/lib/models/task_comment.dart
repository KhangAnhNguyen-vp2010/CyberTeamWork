class TaskComment {
  TaskComment({
    required this.commentId,
    required this.content,
    required this.commentedAt,
    required this.updatedAt,
    required this.memberId,
    required this.memberName,
  });

  factory TaskComment.fromJson(Map<String, dynamic> json) {
    DateTime? _parseDate(String? raw) {
      if (raw == null || raw.isEmpty) return null;
      return DateTime.tryParse(raw);
    }

    return TaskComment(
      commentId: json['binhLuanId'] as int? ?? 0,
      content: json['noiDung'] as String? ?? '',
      commentedAt: _parseDate(json['ngayBinhLuan'] as String?),
      updatedAt: _parseDate(json['ngayCapNhat'] as String?),
      memberId: json['thanhVienID'] as int? ?? 0,
      memberName: json['hoTen'] as String? ?? 'Không rõ',
    );
  }

  final int commentId;
  final String content;
  final DateTime? commentedAt;
  final DateTime? updatedAt;
  final int memberId;
  final String memberName;
}
