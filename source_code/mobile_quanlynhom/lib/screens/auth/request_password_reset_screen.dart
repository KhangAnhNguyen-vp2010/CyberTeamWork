import 'package:flutter/material.dart';
import 'package:loading_animation_widget/loading_animation_widget.dart';
import 'package:mobile_quanlynhom/services/auth_service.dart';
import 'package:mobile_quanlynhom/widgets/custom_text_field.dart';
import 'package:mobile_quanlynhom/widgets/custom_toast.dart';

class RequestPasswordResetScreen extends StatefulWidget {
  const RequestPasswordResetScreen({Key? key}) : super(key: key);

  @override
  _RequestPasswordResetScreenState createState() =>
      _RequestPasswordResetScreenState();
}

class _RequestPasswordResetScreenState
    extends State<RequestPasswordResetScreen> {
  final _formKey = GlobalKey<FormState>();
  final _usernameController = TextEditingController();
  final _fullNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _reasonController = TextEditingController();
  final _authService = AuthService();
  bool _isLoading = false;

  @override
  void dispose() {
    _usernameController.dispose();
    _fullNameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _sendRequest() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
    });

    try {
      final username = _usernameController.text.trim();
      final fullName = _fullNameController.text.trim();
      final email = _emailController.text.trim();
      final phone = _phoneController.text.trim();
      final reason = _reasonController.text.trim();

      final response = await _authService.requestPasswordReset(
        username: username,
        fullName: fullName,
        email: email,
        phone: phone,
        reason: reason,
      );

      if (!mounted) return;

      CustomToast.show(
        context,
        message:
            response['message'] ??
            (response['success']
                ? 'Yêu cầu đã được gửi. Quản trị viên sẽ xem xét và phản hồi qua số điện thoại của bạn.'
                : 'Có lỗi xảy ra. Vui lòng thử lại sau.'),
        isError: !(response['success'] ?? false),
        icon: response['success'] ? Icons.check_circle : Icons.error_outline,
      );

      if (response['success'] == true) {
        // Đợi 2 giây rồi quay lại màn hình đăng nhập
        await Future.delayed(const Duration(seconds: 2));
        if (mounted) {
          Navigator.of(context).popUntil((route) => route.isFirst);
        }
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
          'Yêu cầu đặt lại mật khẩu',
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

                      // Icon
                      Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: primary.withOpacity(0.1),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.help_outline,
                          size: 64,
                          color: primary,
                        ),
                      ),

                      const SizedBox(height: 32.0),

                      // Title
                      const Text(
                        'Quên email đăng nhập?',
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
                        'Điền thông tin bên dưới để gửi yêu cầu đặt lại mật khẩu đến quản trị viên. Họ sẽ liên hệ với bạn để xác minh và hỗ trợ.',
                        style: TextStyle(
                          color: textSecondary,
                          fontSize: 14,
                          height: 1.5,
                        ),
                        textAlign: TextAlign.center,
                      ),

                      const SizedBox(height: 32.0),

                      // Username Field
                      CustomTextField(
                        label: 'Tên đăng nhập',
                        hint: 'Nhập tên đăng nhập của bạn',
                        controller: _usernameController,
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Vui lòng nhập tên đăng nhập';
                          }
                          return null;
                        },
                        prefixIcon: Icons.person_outline,
                      ),

                      const SizedBox(height: 16.0),

                      // Full Name Field
                      CustomTextField(
                        label: 'Họ và tên',
                        hint: 'Nguyễn Văn A',
                        controller: _fullNameController,
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Vui lòng nhập họ và tên';
                          }
                          return null;
                        },
                        prefixIcon: Icons.badge_outlined,
                      ),

                      const SizedBox(height: 16.0),

                      // Email Field
                      CustomTextField(
                        label: 'Email',
                        hint: 'Ví dụ: user@gmail.com',
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

                      const SizedBox(height: 16.0),

                      // Phone Field
                      CustomTextField(
                        label: 'Số điện thoại',
                        hint: 'Ví dụ: 0987...',
                        keyboardType: TextInputType.phone,
                        controller: _phoneController,
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Vui lòng nhập số điện thoại';
                          }
                          if (!RegExp(r'^[0-9]{10,11}$').hasMatch(value)) {
                            return 'Số điện thoại không hợp lệ';
                          }
                          return null;
                        },
                        prefixIcon: Icons.phone_outlined,
                      ),

                      const SizedBox(height: 16.0),

                      // Reason Field
                      CustomTextField(
                        label: 'Lý do cần reset mật khẩu',
                        hint:
                            'Mô tả lý do bạn cần reset mật khẩu (ví dụ: quên mật khẩu, bị hack, v.v...)',
                        controller: _reasonController,
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Vui lòng nhập lý do';
                          }
                          return null;
                        },
                        prefixIcon: Icons.message_outlined,
                      ),

                      const SizedBox(height: 32.0),

                      // Send Request Button
                      ElevatedButton(
                        onPressed: _sendRequest,
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
                          'Gửi yêu cầu',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),

                      const SizedBox(height: 16.0),

                      // Back Link
                      TextButton(
                        onPressed: () => Navigator.pop(context),
                        style: TextButton.styleFrom(foregroundColor: primary),
                        child: const Text(
                          'Quay lại',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
    );
  }
}
