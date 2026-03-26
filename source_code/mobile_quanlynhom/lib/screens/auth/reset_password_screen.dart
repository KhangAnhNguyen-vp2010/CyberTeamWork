import 'package:flutter/material.dart';
import 'package:loading_animation_widget/loading_animation_widget.dart';
import 'package:mobile_quanlynhom/services/auth_service.dart';
import 'package:mobile_quanlynhom/widgets/custom_text_field.dart';
import 'package:mobile_quanlynhom/widgets/custom_toast.dart';

class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({
    super.key,
    required this.email,
  });

  final String email;

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _authService = AuthService();

  bool _isLoading = false;
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;

  @override
  void dispose() {
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _resetPassword() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
    });

    try {
      final response = await _authService.resetPassword(
        email: widget.email,
        newPassword: _passwordController.text,
      );

      if (!mounted) return;

      CustomToast.show(
        context,
        message: response['message'] ??
            (response['success'] == true
                ? 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.'
                : 'Có lỗi xảy ra. Vui lòng thử lại sau.'),
        isError: response['success'] != true,
        icon: response['success'] == true ? Icons.check_circle : Icons.error_outline,
      );

      if (response['success'] == true) {
        Navigator.popUntil(context, (route) => route.isFirst);
      }
    } catch (e) {
      if (!mounted) return;
      CustomToast.show(
        context,
        message: 'Có lỗi xảy ra. Vui lòng thử lại sau.',
        isError: true,
        icon: Icons.error_outline,
      );
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  String? _validatePassword(String? value) {
    if (value == null || value.isEmpty) {
      return 'Vui lòng nhập mật khẩu mới';
    }
    if (value.length < 8) {
      return 'Mật khẩu phải có ít nhất 8 ký tự';
    }
    final hasUppercase = value.contains(RegExp(r'[A-Z]'));
    final hasLowercase = value.contains(RegExp(r'[a-z]'));
    final hasDigit = value.contains(RegExp(r'[0-9]'));
    final hasSpecial = value.contains(RegExp(r'[!@#\$%^&*(),.?":{}|<>]'));
    if (!hasUppercase || !hasLowercase || !hasDigit || !hasSpecial) {
      return 'Mật khẩu cần gồm chữ hoa, chữ thường, số và ký tự đặc biệt';
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    const primary = Color(0xFF2563EB);
    const textSecondary = Color(0xFF6B7280);
    const background = Color(0xFFF9FAFB);

    return Scaffold(
      backgroundColor: background,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Đặt lại mật khẩu',
          style: TextStyle(color: Color(0xFF1F2937), fontSize: 18, fontWeight: FontWeight.w600),
        ),
        iconTheme: const IconThemeData(color: Color(0xFF1F2937)),
      ),
      body: _isLoading
          ? Center(
              child: LoadingAnimationWidget.staggeredDotsWave(
                color: primary,
                size: 48,
              ),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.all(24.0),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: 24.0),
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: const BoxDecoration(
                        color: Color(0xFFEFF6FF),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.lock_reset, size: 64, color: primary),
                    ),
                    const SizedBox(height: 32.0),
                    const Text(
                      'Tạo mật khẩu mới',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF1F2937),
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 12.0),
                    Text(
                      'Cho tài khoản ${widget.email}',
                      style: const TextStyle(
                        fontSize: 14,
                        color: textSecondary,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 32.0),
                    CustomTextField(
                      label: 'Mật khẩu mới',
                      hint: 'Nhập mật khẩu mạnh (8 ký tự, chữ hoa/thường, số, ký hiệu)',
                      controller: _passwordController,
                      obscureText: _obscurePassword,
                      validator: _validatePassword,
                      prefixIcon: Icons.lock_outline,
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscurePassword
                              ? Icons.visibility_off_outlined
                              : Icons.visibility_outlined,
                          color: Colors.grey,
                        ),
                        onPressed: () {
                          setState(() {
                            _obscurePassword = !_obscurePassword;
                          });
                        },
                      ),
                    ),
                    const SizedBox(height: 16.0),
                    CustomTextField(
                      label: 'Xác nhận mật khẩu',
                      hint: 'Nhập lại mật khẩu mới',
                      controller: _confirmPasswordController,
                      obscureText: _obscureConfirmPassword,
                      validator: (value) {
                        if (value == null || value.isEmpty) {
                          return 'Vui lòng xác nhận mật khẩu';
                        }
                        if (value != _passwordController.text) {
                          return 'Mật khẩu không khớp';
                        }
                        return null;
                      },
                      prefixIcon: Icons.lock_outline,
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscureConfirmPassword
                              ? Icons.visibility_off_outlined
                              : Icons.visibility_outlined,
                          color: Colors.grey,
                        ),
                        onPressed: () {
                          setState(() {
                            _obscureConfirmPassword = !_obscureConfirmPassword;
                          });
                        },
                      ),
                    ),
                    const SizedBox(height: 32.0),
                    ElevatedButton(
                      onPressed: _resetPassword,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: primary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16.0),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12.0),
                        ),
                        elevation: 0,
                      ),
                      child: const Text(
                        'Cập nhật mật khẩu',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16.0),
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      style: TextButton.styleFrom(
                        foregroundColor: primary,
                      ),
                      child: const Text(
                        'Quay lại',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}
