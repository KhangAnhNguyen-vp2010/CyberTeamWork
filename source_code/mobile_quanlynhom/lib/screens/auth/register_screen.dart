import 'package:flutter/material.dart';
import 'package:loading_animation_widget/loading_animation_widget.dart';
import 'package:mobile_quanlynhom/screens/auth/otp_verification_screen.dart';
import 'package:mobile_quanlynhom/services/auth_service.dart';
import 'package:mobile_quanlynhom/widgets/custom_text_field.dart';
import 'package:mobile_quanlynhom/widgets/custom_toast.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({Key? key}) : super(key: key);

  @override
  _RegisterScreenState createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _fullNameController = TextEditingController();
  final _userNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _authService = AuthService();
  bool _isLoading = false;
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;

  @override
  void dispose() {
    _fullNameController.dispose();
    _userNameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _register() async {
    if (!_formKey.currentState!.validate()) return;

    if (_passwordController.text != _confirmPasswordController.text) {
      CustomToast.show(
        context,
        message: 'Mật khẩu xác nhận không khớp',
        isError: true,
        icon: Icons.error_outline,
      );
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final response = await _authService.register(
        userName: _userNameController.text.trim(),
        fullName: _fullNameController.text.trim(),
        email: _emailController.text.trim(),
        password: _passwordController.text,
      );

      if (!mounted) return;

      CustomToast.show(
        context,
        message: response['success'] 
            ? response['message'] ?? 'Đăng ký thành công! Vui lòng kiểm tra email.' 
            : response['message'] ?? 'Có lỗi xảy ra',
        isError: !response['success'],
        icon: response['success'] ? Icons.check_circle : Icons.error_outline,
      );

      if (response['success']) {
        if (!mounted) return;
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (_) => OTPVerificationScreen(
              email: _emailController.text.trim(),
              purpose: 'register',
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
          'Đăng ký tài khoản',
          style: TextStyle(color: Color(0xFF1F2937), fontSize: 18, fontWeight: FontWeight.w600),
        ),
      ),
      body: _isLoading
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
                    // Image illustration
                    ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: Image.asset(
                        'assets/images/auth/register.png',
                        height: 180,
                        fit: BoxFit.contain,
                      ),
                    ),
                    const SizedBox(height: 24.0),
                    const Text(
                      'Tạo tài khoản mới',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF1F2937),
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8.0),
                    const Text(
                      'Điền thông tin để bắt đầu',
                      style: TextStyle(
                        fontSize: 14,
                        color: textSecondary,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 24.0),
                    // Full Name Field
                    CustomTextField(
                      label: 'Họ và tên',
                      hint: 'Nhập họ và tên của bạn',
                      controller: _fullNameController,
                      validator: (value) {
                        if (value == null || value.isEmpty) {
                          return 'Vui lòng nhập họ và tên';
                        }
                        return null;
                      },
                      prefixIcon: Icons.person_outline,
                    ),
                    const SizedBox(height: 16.0),
                    
                    // Username Field
                    CustomTextField(
                      label: 'Tên tài khoản',
                      hint: 'Nhập tên tài khoản của bạn',
                      controller: _userNameController,
                      validator: (value) {
                        if (value == null || value.isEmpty) {
                          return 'Vui lòng nhập tên tài khoản';
                        }
                        if (value.length < 4) {
                          return 'Tên tài khoản phải có ít nhất 4 ký tự';
                        }
                        return null;
                      },
                      prefixIcon: Icons.account_circle_outlined,
                    ),
                    const SizedBox(height: 16.0),

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
                        if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(value)) {
                          return 'Email không hợp lệ';
                        }
                        return null;
                      },
                      prefixIcon: Icons.email_outlined,
                    ),
                    const SizedBox(height: 16.0),
                    
                    // Password Field
                    CustomTextField(
                      label: 'Mật khẩu',
                      hint: 'Nhập mật khẩu (ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt)',
                      obscureText: _obscurePassword,
                      controller: _passwordController,
                      validator: (value) {
                        if (value == null || value.isEmpty) {
                          return 'Vui lòng nhập mật khẩu';
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
                      },
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
                    
                    // Confirm Password Field
                    CustomTextField(
                      label: 'Xác nhận mật khẩu',
                      hint: 'Nhập lại mật khẩu',
                      obscureText: _obscureConfirmPassword,
                      controller: _confirmPasswordController,
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
                    
                    // Register Button
                    ElevatedButton(
                      onPressed: _register,
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
                        'Đăng ký',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    
                    const SizedBox(height: 16.0),
                    
                    // Login Link
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Text(
                          'Đã có tài khoản? ',
                          style: TextStyle(fontSize: 14, color: textSecondary),
                        ),
                        TextButton(
                          onPressed: () => Navigator.pop(context),
                          style: TextButton.styleFrom(
                            foregroundColor: primary,
                            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 0),
                          ),
                          child: const Text(
                            'Đăng nhập ngay',
                            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16.0),
                  ],
                ),
              ),
            ),
    );
  }
}
