import 'dart:async';

import 'package:flutter/material.dart';
import 'package:loading_animation_widget/loading_animation_widget.dart';
import 'package:mobile_quanlynhom/services/auth_service.dart';
import 'package:mobile_quanlynhom/widgets/custom_toast.dart';

class OTPVerificationScreen extends StatefulWidget {
  const OTPVerificationScreen({
    super.key,
    required this.email,
    required this.purpose,
    this.onVerified,
  });

  final String email;
  final String purpose;
  final void Function(BuildContext context)? onVerified;

  @override
  State<OTPVerificationScreen> createState() => _OTPVerificationScreenState();
}

class _OTPVerificationScreenState extends State<OTPVerificationScreen> {
  final _formKey = GlobalKey<FormState>();
  final _otpController = TextEditingController();
  final _authService = AuthService();

  Timer? _countdownTimer;
  int _secondsRemaining = 60;
  bool _isVerifying = false;
  bool _isResending = false;

  @override
  void initState() {
    super.initState();
    _startCountdown();
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    _otpController.dispose();
    super.dispose();
  }

  void _startCountdown() {
    _countdownTimer?.cancel();
    setState(() {
      _secondsRemaining = 60;
    });

    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_secondsRemaining <= 1) {
        timer.cancel();
        setState(() {
          _secondsRemaining = 0;
        });
      } else {
        setState(() {
          _secondsRemaining--;
        });
      }
    });
  }

  Future<void> _verifyOtp() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isVerifying = true;
    });

    try {
      final response = await _authService.verifyOtp(
        email: widget.email,
        otp: _otpController.text.trim(),
        purpose: widget.purpose,
      );

      if (!mounted) return;

      CustomToast.show(
        context,
        message: response['success']
            ? response['message'] ?? 'Xác thực OTP thành công!'
            : response['message'] ?? 'Có lỗi xảy ra',
        isError: !response['success'],
        icon: response['success'] ? Icons.check_circle : Icons.error_outline,
      );

      if (response['success']) {
        if (widget.onVerified != null) {
          widget.onVerified!(context);
        } else {
          Navigator.popUntil(context, (route) => route.isFirst);
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
          _isVerifying = false;
        });
      }
    }
  }

  Future<void> _resendOtp() async {
    if (_secondsRemaining > 0 || _isResending) return;

    setState(() {
      _isResending = true;
    });

    try {
      final response = await _authService.resendOtp(
        email: widget.email,
        purpose: widget.purpose,
      );

      if (!mounted) return;

      CustomToast.show(
        context,
        message: response['success']
            ? response['message'] ?? 'Đã gửi lại OTP. Vui lòng kiểm tra email.'
            : response['message'] ?? 'Có lỗi xảy ra',
        isError: !response['success'],
        icon: response['success'] ? Icons.check_circle : Icons.error_outline,
      );

      if (response['success']) {
        _startCountdown();
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
          _isResending = false;
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
        title: const Text(
          'Xác thực OTP',
          style: TextStyle(color: Color(0xFF1F2937), fontSize: 18, fontWeight: FontWeight.w600),
        ),
        iconTheme: const IconThemeData(color: Color(0xFF1F2937)),
      ),
      body: SingleChildScrollView(
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
                child: const Icon(Icons.mail_outline, size: 64, color: primary),
              ),
              const SizedBox(height: 32.0),
              const Text(
                'Nhập mã xác thực',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Color(0xFF1F2937)),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12.0),
              Text(
                'Mã OTP đã được gửi đến\n${widget.email}',
                style: const TextStyle(fontSize: 14, color: textSecondary, height: 1.5),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32.0),
              TextFormField(
                controller: _otpController,
                keyboardType: TextInputType.number,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  letterSpacing: 12,
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF1F2937),
                ),
                maxLength: 6,
                decoration: InputDecoration(
                  counterText: '',
                  hintText: '------',
                  hintStyle: const TextStyle(color: Color(0xFFD1D5DB)),
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12.0),
                    borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12.0),
                    borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12.0),
                    borderSide: const BorderSide(color: primary, width: 2),
                  ),
                  contentPadding: const EdgeInsets.symmetric(vertical: 20),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Vui lòng nhập mã OTP';
                  }
                  if (value.length != 6) {
                    return 'OTP phải gồm 6 chữ số';
                  }
                  if (!RegExp(r'^\d{6}$').hasMatch(value)) {
                    return 'OTP chỉ bao gồm số';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 24.0),
              ElevatedButton(
                onPressed: _isVerifying ? null : _verifyOtp,
                style: ElevatedButton.styleFrom(
                  backgroundColor: primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16.0),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12.0),
                  ),
                  elevation: 0,
                ),
                child: _isVerifying
                    ? LoadingAnimationWidget.staggeredDotsWave(
                        color: Colors.white,
                        size: 32,
                      )
                    : const Text(
                        'Xác thực',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
              ),
              const SizedBox(height: 24.0),
              Text(
                _secondsRemaining > 0
                    ? 'Bạn có thể gửi lại OTP sau ${_secondsRemaining}s'
                    : 'Không nhận được mã?',
                textAlign: TextAlign.center,
                style: const TextStyle(color: textSecondary, fontSize: 14),
              ),
              const SizedBox(height: 8.0),
              TextButton(
                onPressed:
                    _isResending || _secondsRemaining > 0 ? null : _resendOtp,
                style: TextButton.styleFrom(
                  foregroundColor: primary,
                ),
                child: _isResending
                    ? LoadingAnimationWidget.threeArchedCircle(
                        color: primary,
                        size: 28,
                      )
                    : const Text(
                        'Gửi lại OTP',
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
