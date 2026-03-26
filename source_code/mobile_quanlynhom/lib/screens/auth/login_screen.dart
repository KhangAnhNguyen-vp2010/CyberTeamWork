import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:loading_animation_widget/loading_animation_widget.dart';
import 'package:mobile_quanlynhom/models/login_request.dart';
import 'package:mobile_quanlynhom/screens/auth/forgot_password_screen.dart';
import 'package:mobile_quanlynhom/screens/home/home_screen.dart';
import 'package:mobile_quanlynhom/services/auth_service.dart';
import 'package:mobile_quanlynhom/widgets/custom_text_field.dart';
import 'package:mobile_quanlynhom/widgets/custom_toast.dart';
import 'package:shared_preferences/shared_preferences.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({Key? key}) : super(key: key);

  @override
  _LoginScreenState createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _authService = AuthService();

  bool _isLoading = false;
  bool _obscurePassword = true;
  bool _rememberMe = false;

  @override
  void initState() {
    super.initState();
    _attemptAutoLogin();
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _attemptAutoLogin() async {
    final prefs = await SharedPreferences.getInstance();
    final rememberMe = prefs.getBool('rememberMe') ?? false;
    final savedUserRaw = prefs.getString('user_info');

    if (!mounted) return;

    setState(() {
      _rememberMe = rememberMe;
      if (rememberMe) {
        _usernameController.text = prefs.getString('tenTaiKhoan') ?? '';
        _passwordController.text = prefs.getString('password') ?? '';
      }
    });

    if (rememberMe && savedUserRaw != null && savedUserRaw.isNotEmpty) {
      try {
        final decoded = jsonDecode(savedUserRaw);
        Map<String, dynamic>? payload;
        if (decoded is Map<String, dynamic>) {
          payload = decoded;
          if (payload['data'] is Map<String, dynamic>) {
            payload = payload['data'] as Map<String, dynamic>;
          }
          if (payload['user'] is Map<String, dynamic>) {
            payload = payload['user'] as Map<String, dynamic>;
          }
        }

        final memberIdValue = payload?['thanhVienId'] ?? payload?['memberId'];
        final memberId =
            memberIdValue is int
                ? memberIdValue
                : int.tryParse(memberIdValue?.toString() ?? '');

        if (!mounted) return;
        if (memberId != null) {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (_) => HomeScreen(memberId: memberId)),
          );
          return;
        }
      } catch (_) {
        // Ignore and stay on login screen
      }
    }
  }

  Future<void> _saveUserCredentials() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('rememberMe', _rememberMe);
    if (_rememberMe) {
      await prefs.setString('tenTaiKhoan', _usernameController.text.trim());
      await prefs.setString('password', _passwordController.text);
    } else {
      await prefs.remove('tenTaiKhoan');
      await prefs.remove('password');
    }
  }

  Future<void> _login() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
    });

    try {
      await _saveUserCredentials();

      final loginRequest = LoginRequest(
        tenTaiKhoan: _usernameController.text.trim(),
        password: _passwordController.text,
      );

      final response = await _authService.login(loginRequest);
      final responseData = response['data'] as Map<String, dynamic>?;

      if (!mounted) return;

      CustomToast.show(
        context,
        message:
            response['success']
                ? 'Đăng nhập thành công!'
                : response['message'] ?? 'Có lỗi xảy ra',
        isError: !response['success'],
        icon: response['success'] ? Icons.check_circle : Icons.error_outline,
      );

      if (response['success']) {
        if (responseData != null) {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('user_info', jsonEncode(responseData));
        }

        final memberId =
            responseData?['thanhVienId'] ?? responseData?['memberId'];

        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder:
                (_) => HomeScreen(
                  memberId:
                      memberId is int
                          ? memberId
                          : int.tryParse(memberId?.toString() ?? ''),
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
      body: SafeArea(
        child:
            _isLoading
                ? Center(
                  child: LoadingAnimationWidget.staggeredDotsWave(
                    color: primary,
                    size: 50,
                  ),
                )
                : SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 24.0),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const SizedBox(height: 40.0),
                        // Image illustration
                        ClipRRect(
                          borderRadius: BorderRadius.circular(16),
                          child: Image.asset(
                            'assets/images/auth/login.png',
                            height: 200,
                            fit: BoxFit.contain,
                          ),
                        ),
                        const SizedBox(height: 32.0),
                        const Text(
                          'Chào mừng trở lại',
                          style: TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF1F2937),
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 8.0),
                        const Text(
                          'Đăng nhập để tiếp tục',
                          style: TextStyle(fontSize: 16, color: textSecondary),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 32.0),
                        CustomTextField(
                          label: 'Tên tài khoản',
                          hint: 'Nhập tên tài khoản của bạn',
                          keyboardType: TextInputType.text,
                          controller: _usernameController,
                          prefixIcon: Icons.person_outline,
                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return 'Vui lòng nhập tên tài khoản';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 16.0),
                        CustomTextField(
                          label: 'Mật khẩu',
                          hint: 'Nhập mật khẩu của bạn',
                          obscureText: _obscurePassword,
                          controller: _passwordController,
                          prefixIcon: Icons.lock_outline,
                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return 'Vui lòng nhập mật khẩu';
                            }
                            return null;
                          },
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
                        const SizedBox(height: 8.0),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: Checkbox(
                                    value: _rememberMe,
                                    onChanged: (value) {
                                      setState(() {
                                        _rememberMe = value ?? false;
                                      });
                                    },
                                    activeColor: primary,
                                    materialTapTargetSize:
                                        MaterialTapTargetSize.shrinkWrap,
                                    visualDensity: VisualDensity.compact,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                const Text(
                                  'Ghi nhớ tôi',
                                  style: TextStyle(
                                    fontSize: 14,
                                    color: Color(0xFF374151),
                                  ),
                                ),
                              ],
                            ),
                            TextButton(
                              onPressed:
                                  () => Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder:
                                          (_) => const ForgotPasswordScreen(),
                                    ),
                                  ),
                              style: TextButton.styleFrom(
                                foregroundColor: primary,
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 4,
                                ),
                              ),
                              child: const Text(
                                'Quên mật khẩu?',
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16.0),
                        ElevatedButton(
                          onPressed: _login,
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
                            'Đăng nhập',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        const SizedBox(height: 24.0),
                        const SizedBox(height: 16.0),
                      ],
                    ),
                  ),
                ),
      ),
    );
  }
}
