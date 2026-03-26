import 'package:flutter/material.dart';
import 'package:loading_animation_widget/loading_animation_widget.dart';
import 'package:mobile_quanlynhom/screens/auth/otp_verification_screen.dart';
import 'package:mobile_quanlynhom/screens/auth/reset_password_screen.dart';
import 'package:mobile_quanlynhom/screens/auth/request_password_reset_screen.dart';
import 'package:mobile_quanlynhom/services/auth_service.dart';
import 'package:mobile_quanlynhom/widgets/custom_text_field.dart';
import 'package:mobile_quanlynhom/widgets/custom_toast.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({Key? key}) : super(key: key);

  @override
  _ForgotPasswordScreenState createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _authService = AuthService();
  bool _isLoading = false;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _sendResetPasswordEmail() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
    });

    try {
      final email = _emailController.text.trim();
      final response = await _authService.forgotPassword(email: email);

      if (!mounted) return;

      CustomToast.show(
        context,
        message:
            response['message'] ??
            (response['success']
                ? 'Mã OTP đã được gửi. Vui lòng kiểm tra email của bạn.'
                : 'Có lỗi xảy ra. Vui lòng thử lại sau.'),
        isError: !(response['success'] ?? false),
        icon: response['success'] ? Icons.mark_email_read : Icons.error_outline,
      );

      if (response['success'] == true) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder:
                (_) => OTPVerificationScreen(
                  email: email,
                  purpose: 'forgot-password',
                  onVerified: (otpContext) {
                    Navigator.pushReplacement(
                      otpContext,
                      MaterialPageRoute(
                        builder: (_) => ResetPasswordScreen(email: email),
                      ),
                    );
                  },
                ),
          ),
        );
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
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF1F2937)),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Quên mật khẩu',
          style: TextStyle(
            color: Color(0xFF1F2937),
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      body:
          _isLoading
              ? Center(
                child: LoadingAnimationWidget.staggeredDotsWave(
                  color: primary,
                  size: 50,
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

                      // Image illustration
                      ClipRRect(
                        borderRadius: BorderRadius.circular(16),
                        child: Image.asset(
                          'assets/images/auth/forgot-password.png',
                          height: 200,
                          fit: BoxFit.contain,
                        ),
                      ),

                      const SizedBox(height: 32.0),

                      // Title
                      const Text(
                        'Quên mật khẩu?',
                        style: TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF1F2937),
                        ),
                        textAlign: TextAlign.center,
                      ),

                      const SizedBox(height: 12.0),

                      // Description
                      const Text(
                        'Nhập email đã đăng ký để nhận mã OTP\nxác nhận đặt lại mật khẩu.',
                        style: TextStyle(
                          color: textSecondary,
                          fontSize: 14,
                          height: 1.5,
                        ),
                        textAlign: TextAlign.center,
                      ),

                      const SizedBox(height: 32.0),

                      // Email Field
                      CustomTextField(
                        label: 'Email',
                        hint: 'Nhập email của bạn',
                        keyboardType: TextInputType.emailAddress,
                        controller: _emailController,
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Vui lòng nhập email';
                          }
                          if (!RegExp(
                            r'^[^@\s]+@[^@\s]+\.[^@\s]+$',
                          ).hasMatch(value)) {
                            return 'Email không hợp lệ';
                          }
                          return null;
                        },
                        prefixIcon: Icons.email_outlined,
                      ),

                      const SizedBox(height: 32.0),

                      // Send OTP Button
                      ElevatedButton(
                        onPressed: _sendResetPasswordEmail,
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
                          'Gửi mã OTP',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),

                      const SizedBox(height: 16.0),

                      // Back to Login Link
                      TextButton(
                        onPressed: () => Navigator.pop(context),
                        style: TextButton.styleFrom(foregroundColor: primary),
                        child: const Text(
                          'Quay lại đăng nhập',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),

                      const SizedBox(height: 8.0),

                      // Forgot Email Link
                      TextButton(
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder:
                                  (_) => const RequestPasswordResetScreen(),
                            ),
                          );
                        },
                        style: TextButton.styleFrom(
                          foregroundColor: textSecondary,
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: const [
                            Icon(Icons.help_outline, size: 18),
                            SizedBox(width: 6),
                            Text(
                              'Bạn quên email?',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
    );
  }
}
