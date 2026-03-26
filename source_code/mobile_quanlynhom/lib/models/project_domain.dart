class ProjectDomain {
  ProjectDomain({
    required this.linhVucId,
    required this.tenLinhVuc,
  });

  final int linhVucId;
  final String tenLinhVuc;

  factory ProjectDomain.fromJson(Map<String, dynamic> json) {
    return ProjectDomain(
      linhVucId: json['linhVucId'] is int
          ? json['linhVucId'] as int
          : int.tryParse(json['linhVucId']?.toString() ?? '') ?? 0,
      tenLinhVuc: json['tenLinhVuc']?.toString() ?? 'Không xác định',
    );
  }
}
