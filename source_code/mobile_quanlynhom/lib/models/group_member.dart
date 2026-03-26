class GroupMember {
  GroupMember({
    required this.thanhVienId,
    required this.hoTen,
    required this.chuyenMon,
  });

  factory GroupMember.fromJson(Map<String, dynamic> json) {
    return GroupMember(
      thanhVienId:
          json['thanhVienId'] is int
              ? json['thanhVienId'] as int
              : int.tryParse(json['thanhVienId']?.toString() ?? '') ?? 0,
      hoTen: json['hoTen']?.toString() ?? 'Không rõ',
      chuyenMon: json['chuyenMon']?['tenChuyenMon']?.toString() ?? 'Không rõ',
    );
  }

  final int thanhVienId;
  final String hoTen;
  final String chuyenMon;
}
