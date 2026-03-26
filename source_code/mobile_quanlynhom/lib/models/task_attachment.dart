class TaskAttachment {
  TaskAttachment({
    required this.fileName,
    required this.filePath,
  });

  final String fileName;
  final String filePath;

  factory TaskAttachment.fromJson(Map<String, dynamic> json) {
    return TaskAttachment(
      fileName: json['fileName']?.toString() ?? 'Tệp không tên',
      filePath: json['filePath']?.toString() ?? '',
    );
  }
}

class TaskAttachmentResponse {
  TaskAttachmentResponse({
    required this.message,
    required this.congViecId,
    required this.total,
    required this.files,
  });

  final String message;
  final int congViecId;
  final int total;
  final List<TaskAttachment> files;

  factory TaskAttachmentResponse.fromJson(Map<String, dynamic> json) {
    final files = (json['files'] as List<dynamic>? ?? [])
        .map((file) => TaskAttachment.fromJson(_ensureMap(file)))
        .toList();

    return TaskAttachmentResponse(
      message: json['message']?.toString() ?? '',
      congViecId: json['congViecId'] is int
          ? json['congViecId'] as int
          : int.tryParse(json['congViecId']?.toString() ?? '') ?? 0,
      total: json['total'] is int
          ? json['total'] as int
          : int.tryParse(json['total']?.toString() ?? '') ?? files.length,
      files: files,
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
