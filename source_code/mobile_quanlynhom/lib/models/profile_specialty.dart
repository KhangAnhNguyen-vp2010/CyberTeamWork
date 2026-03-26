class ProfileSpecialty {
  const ProfileSpecialty({
    required this.id,
    required this.name,
  });

  final int id;
  final String name;

  factory ProfileSpecialty.fromJson(Map<String, dynamic> json) {
    final idValue = json['id'] ?? json['chuyenMonId'] ?? json['Id'];
    final nameValue = json['ten'] ?? json['name'] ?? json['tenChuyenMon'] ?? json['Title'];

    return ProfileSpecialty(
      id: idValue is int ? idValue : int.tryParse(idValue?.toString() ?? '') ?? 0,
      name: nameValue?.toString() ?? 'Không rõ',
    );
  }
}
