class LoginRequest {
  final String tenTaiKhoan;
  final String password;

  LoginRequest({
    required this.tenTaiKhoan,
    required this.password,
  });

  Map<String, dynamic> toJson() {
    return {
      'tenTaiKhoan': tenTaiKhoan,
      'password': password,
    };
  }
}
