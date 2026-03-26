// import 'dart:async';
// import 'dart:convert';
// import 'dart:io';

// import 'package:flutter/material.dart';
// import 'package:http/http.dart' as http;
// import 'package:shared_preferences/shared_preferences.dart';

// import '../../widgets/custom_toast.dart';
// import 'profile_edit_screen.dart';
// import '../../constants/api_constants.dart';
// import '../../models/profile_specialty.dart';
// import '../../services/auth_service.dart';

// class ProfileDetailScreen extends StatefulWidget {
//   const ProfileDetailScreen({super.key});

//   @override
//   State<ProfileDetailScreen> createState() => _ProfileDetailScreenState();
// }

// class _ProfileDetailScreenState extends State<ProfileDetailScreen> {
//   Map<String, dynamic>? _profile;
//   bool _loading = false;
//   String? _error;
//   List<ProfileSpecialty> _specialties = const [];
//   bool _profileUpdated = false;
//   int? _accountId;

//   @override
//   void initState() {
//     super.initState();
//     _loadProfile();
//     _loadSpecialties();
//   }

//   int? _extractAccountId(Map<String, dynamic>? payload) {
//     if (payload == null) return null;
//     dynamic idValue = payload['taiKhoanId'] ?? payload['nguoiDungId'] ?? payload['userId'] ?? payload['id'];
//     if (idValue == null && payload['nguoiDung'] is Map<String, dynamic>) {
//       final user = payload['nguoiDung'] as Map<String, dynamic>;
//       idValue = user['taiKhoanId'] ?? user['nguoiDungId'];
//     }
//     if (idValue == null && payload['thanhVien'] is Map<String, dynamic>) {
//       final member = payload['thanhVien'] as Map<String, dynamic>;
//       idValue = member['taiKhoanId'] ?? member['nguoiDungId'];
//     }
//     if (idValue == null && payload['data'] is Map<String, dynamic>) {
//       return _extractAccountId(payload['data'] as Map<String, dynamic>);
//     }
//     if (idValue is String) {
//       return int.tryParse(idValue);
//     }
//     if (idValue is int) {
//       return idValue;
//     }
//     return null;
//   }

//   Future<void> _openChangeEmailDialog() async {
//     final accountId = _accountId;
//     final currentEmail = _stringValue(_profile?['email']);
//     if (accountId == null || currentEmail == null) {
//       CustomToast.show(
//         context,
//         message: 'Không xác định được tài khoản hoặc email hiện tại.',
//         icon: Icons.error_outline,
//         isError: true,
//       );
//       return;
//     }

//     final result = await showDialog<_EmailChangeResult>(
//       context: context,
//       barrierDismissible: false,
//       builder: (_) => _ChangeEmailDialog(
//         accountId: accountId,
//         currentEmail: currentEmail,
//       ),
//     );

//     if (result == null) return;

//     await _updateStoredEmail(result.newEmail);
//     await _loadProfile();
//     if (!mounted) return;
//     CustomToast.show(
//       context,
//       message: result.message,
//       icon: Icons.check_circle_outline,
//     );
//   }

//   Future<void> _updateStoredEmail(String email) async {
//     try {
//       final prefs = await SharedPreferences.getInstance();
//       final raw = prefs.getString('user_info');
//       if (raw == null || raw.isEmpty) return;

//       final decoded = jsonDecode(raw);
//       Map<String, dynamic>? payload;
//       if (decoded is Map<String, dynamic>) {
//         payload = decoded;
//         if (payload['data'] is Map<String, dynamic>) {
//           payload = payload['data'] as Map<String, dynamic>;
//         }
//         if (payload['user'] is Map<String, dynamic>) {
//           payload = payload['user'] as Map<String, dynamic>;
//         }
//       }

//       if (payload == null) return;
//       payload['email'] = email;

//       if (decoded is Map<String, dynamic>) {
//         if (decoded['data'] is Map<String, dynamic>) {
//           decoded['data'] = payload;
//         } else {
//           decoded['user'] = payload;
//         }
//         await prefs.setString('user_info', jsonEncode(decoded));
//       }
//     } catch (e) {
//       debugPrint('[ProfileDetail] Failed to update stored email: $e');
//     }
//   }

//   Future<void> _loadProfile() async {
//     setState(() {
//       _loading = true;
//       _error = null;
//     });

//     try {
//       final prefs = await SharedPreferences.getInstance();
//       final raw = prefs.getString('user_info');
//       if (raw == null || raw.isEmpty) {
//         setState(() {
//           _profile = null;
//           _loading = false;
//         });
//         return;
//       }

//       final decoded = jsonDecode(raw);
//       Map<String, dynamic>? payload;
//       if (decoded is Map<String, dynamic>) {
//         payload = decoded;
//         if (payload['data'] is Map<String, dynamic>) {
//           payload = payload['data'] as Map<String, dynamic>;
//         }
//         if (payload['user'] is Map<String, dynamic>) {
//           payload = payload['user'] as Map<String, dynamic>;
//         }
//       }

//       setState(() {
//         _profile = payload ?? const {};
//         _accountId = _extractAccountId(payload);
//         _loading = false;
//       });
//     } catch (e) {
//       setState(() {
//         _error = 'Không thể tải thông tin người dùng: $e';
//         _loading = false;
//       });
//     }
//   }

//   @override
//   Widget build(BuildContext context) {
//     final theme = Theme.of(context);
//     return WillPopScope(
//       onWillPop: _onWillPop,
//       child: Scaffold(
//         backgroundColor: Colors.grey.shade100,
//         appBar: AppBar(
//           leading: IconButton(
//             icon: const Icon(Icons.arrow_back),
//             onPressed: _finishAndPop,
//           ),
//           title: const Text('Thông tin cá nhân'),
//         ),
//         body: SafeArea(
//           child: _loading
//               ? const Center(child: CircularProgressIndicator())
//               : _error != null
//                   ? _ErrorView(message: _error!, onRetry: _loadProfile)
//                   : SingleChildScrollView(
//                       padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
//                       child: Column(
//                         crossAxisAlignment: CrossAxisAlignment.start,
//                         children: [
//                           _buildHeader(theme),
//                           const SizedBox(height: 16),
//                           _buildInfoCard(theme),
//                         ],
//                       ),
//                     ),
//         ),
//       ),
//     );
//   }

//   Widget _buildHeader(ThemeData theme) {
//     return Container(
//       padding: const EdgeInsets.all(20),
//       decoration: BoxDecoration(
//         color: Colors.white,
//         borderRadius: BorderRadius.circular(20),
//         boxShadow: [
//           BoxShadow(
//             color: Colors.black.withOpacity(0.04),
//             blurRadius: 12,
//             offset: const Offset(0, 6),
//           ),
//         ],
//       ),
//       child: Row(
//         children: [
//           CircleAvatar(
//             radius: 28,
//             backgroundColor: Colors.deepPurple.shade50,
//             child: Icon(Icons.person_outline, size: 28, color: theme.colorScheme.primary),
//           ),
//           const SizedBox(width: 16),
//           Expanded(
//             child: Column(
//               crossAxisAlignment: CrossAxisAlignment.start,
//               children: [
//                 Text(
//                   'Thông tin cá nhân',
//                   style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
//                 ),
//                 const SizedBox(height: 4),
//                 Text(
//                   'Cập nhật thông tin cơ bản của bạn',
//                   style: theme.textTheme.bodyMedium?.copyWith(color: Colors.grey.shade600),
//                 ),
//               ],
//             ),
//           ),
//           ElevatedButton.icon(
//             onPressed: _profile == null ? null : _openEditProfile,
//             icon: const Icon(Icons.edit_outlined, size: 18),
//             label: const Text('Chỉnh sửa'),
//             style: ElevatedButton.styleFrom(
//               backgroundColor: theme.colorScheme.primary,
//               foregroundColor: Colors.white,
//               padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
//               shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
//               elevation: 0,
//             ),
//           ),
//         ],
//       ),
//     );
//   }

//   Future<void> _loadSpecialties() async {
//     try {
//       final client = HttpClient()..badCertificateCallback = (cert, host, port) => true;
//       final request = await client.getUrl(Uri.parse('${ApiConstants.baseUrl}${ApiConstants.profileSpecialties}'));
//       final response = await request.close();

//       if (response.statusCode == 200) {
//         final body = await response.transform(utf8.decoder).join();
//         final decoded = jsonDecode(body);
//         List<dynamic> items;
//         if (decoded is List) {
//           items = decoded;
//         } else if (decoded is Map<String, dynamic>) {
//           final data = decoded['data'];
//           if (data is List) {
//             items = data;
//           } else if (decoded['items'] is List) {
//             items = decoded['items'] as List;
//           } else {
//             items = const [];
//           }
//         } else {
//           items = const [];
//         }

//         final specialties = items
//             .whereType<Map>()
//             .map((e) => ProfileSpecialty.fromJson(Map<String, dynamic>.from(e)))
//             .toList(growable: false);

//         if (mounted) {
//           setState(() {
//             _specialties = specialties;
//           });
//         }
//       } else {
//         if (mounted) {
//           setState(() {});
//         }
//       }
//       client.close();
//     } catch (_) {
//       if (mounted) {
//         setState(() {});
//       }
//     }
//   }

//   Future<void> _finishAndPop() async {
//     if (!mounted) return;
//     Navigator.of(context).pop(_profileUpdated);
//   }

//   Future<bool> _onWillPop() async {
//     await _finishAndPop();
//     return false;
//   }

//   Future<void> _openEditProfile() async {
//     final profile = _profile;
//     if (profile == null) return;

//     final result = await Navigator.of(context).push<bool>(
//       MaterialPageRoute(
//         builder: (_) => ProfileEditScreen(
//           initialProfile: Map<String, dynamic>.from(profile),
//         ),
//       ),
//     );

//     if (result == true) {
//       _profileUpdated = true;
//       await _loadProfile();
//       if (!mounted) return;
//       CustomToast.show(
//         context,
//         message: 'Đã cập nhật thông tin cá nhân.',
//         icon: Icons.check_circle_outline,
//       );
//     }
//   }

//   Widget _buildInfoCard(ThemeData theme) {
    
//     final name = _stringValue(_profile?['hoTen'] ?? _profile?['ten'] ?? _profile?['fullName']);
//     final email = _stringValue(_profile?['email']);
//     final gender = _genderLabel(_profile?['gioiTinh']);
//     final dob = _formatDate(_profile?['ngaySinh']);
//     final phone = _stringValue(_profile?['sdt'] ?? _profile?['phone']);
//     final jobTitle = _resolveSpecialtyName(_profile?['chuyenMonId']) ?? _stringValue(_profile?['tenChuyenMon']);
//     final bio = _stringValue(_profile?['moTaBanThan']);

//     return Container(
//       width: double.infinity,
//       padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
//       decoration: BoxDecoration(
//         color: Colors.deepPurple.shade50,
//         borderRadius: BorderRadius.circular(24),
//       ),
//       child: Column(
//         crossAxisAlignment: CrossAxisAlignment.start,
//         children: [
//           _ProfileField(label: 'Họ tên', value: name ?? '---'),
//           _ProfileField(
//             label: 'Email',
//             value: email ?? '---',
//             action: TextButton(
//               onPressed: (_profile == null || _accountId == null) ? null : _openChangeEmailDialog,
//               style: TextButton.styleFrom(
//                 padding: EdgeInsets.zero,
//                 minimumSize: const Size(0, 0),
//                 tapTargetSize: MaterialTapTargetSize.shrinkWrap,
//               ),
//               child: const Text('Đổi email'),
//             ),
//           ),
//           _ProfileField(label: 'Giới tính', value: gender ?? '---'),
//           _ProfileField(label: 'Ngày sinh', value: dob ?? '---'),
//           _ProfileField(label: 'Số điện thoại', value: phone ?? '---'),
//           if (jobTitle != null) ...[
//             const SizedBox(height: 12),
//             Text(
//               jobTitle,
//               style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
//             ),
//           ],
//           const SizedBox(height: 16),
//           Text(
//             'Mô tả bản thân:',
//             style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600, color: theme.colorScheme.primary),
//           ),
//           const SizedBox(height: 8),
//           Text(
//             bio ?? '---',
//             style: theme.textTheme.bodyMedium,
//           ),
//         ],
//       ),
//     );
//   }

//   String? _stringValue(dynamic value) {
//     if (value == null) return null;
//     final text = value.toString().trim();
//     return text.isEmpty ? null : text;
//   }

//   String? _resolveSpecialtyName(dynamic idValue) {
//     int? id;
//     if (idValue is int) {
//       id = idValue;
//     } else if (idValue != null) {
//       id = int.tryParse(idValue.toString());
//     }

//     if (id == null || _specialties.isEmpty) return null;

//     final match = _specialties.firstWhere(
//       (item) => item.id == id,
//       orElse: () => const ProfileSpecialty(id: 0, name: ''),
//     );

//     return match.id == 0 ? null : (match.name.isEmpty ? null : match.name);
//   }

//   String? _genderLabel(dynamic value) {
//     final text = _stringValue(value);
//     if (text == null) return null;
//     switch (text.toLowerCase()) {
//       case 'nam':
//       case 'male':
//       case 'm':
//       case '1':
//         return 'Nam';
//       case 'nu':
//       case 'nữ':
//       case 'female':
//       case 'f':
//       case '0':
//         return 'Nữ';
//       default:
//         return text;
//     }
//   }

//   String? _formatDate(dynamic value) {
//     final text = _stringValue(value);
//     if (text == null) return null;
//     try {
//       final parsed = DateTime.parse(text);
//       return parsed.toIso8601String().split('T').first;
//     } catch (_) {
//       return text;
//     }
//   }
// }

// class _EmailChangeResult {
//   const _EmailChangeResult({required this.newEmail, required this.message});

//   final String newEmail;
//   final String message;
// }

// class _ChangeEmailDialog extends StatefulWidget {
//   const _ChangeEmailDialog({
//     required this.accountId,
//     required this.currentEmail,
//   });

//   final int accountId;
//   final String currentEmail;

//   @override
//   State<_ChangeEmailDialog> createState() => _ChangeEmailDialogState();
// }

// class _ChangeEmailDialogState extends State<_ChangeEmailDialog> {
//   final _formKey = GlobalKey<FormState>();
//   final TextEditingController _emailController = TextEditingController();
//   final TextEditingController _otpController = TextEditingController();

//   bool _otpSent = false;
//   bool _loading = false;
//   int _resendCooldown = 0;
//   Timer? _resendTimer;
//   String? _lockedEmail;

//   @override
//   void initState() {
//     super.initState();
//     _emailController.text = '';
//   }

//   @override
//   void dispose() {
//     _resendTimer?.cancel();
//     _emailController.dispose();
//     _otpController.dispose();
//     super.dispose();
//   }

//   bool _validateEmailFormat(String email) {
//     final emailRegex = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
//     return emailRegex.hasMatch(email);
//   }

//   void _startCooldown() {
//     setState(() {
//       _resendCooldown = 60;
//     });
//     _resendTimer?.cancel();
//     _resendTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
//       if (_resendCooldown <= 1) {
//         timer.cancel();
//         setState(() {
//           _resendCooldown = 0;
//         });
//       } else {
//         setState(() {
//           _resendCooldown -= 1;
//         });
//       }
//     });
//   }

//   Future<void> _requestOtp() async {
//     if (_loading) return;
//     final email = _emailController.text.trim();

//     if (!_otpSent && !_validateEmailInputs(email)) {
//       return;
//     }

//     setState(() => _loading = true);
//     try {
//       final message = await AuthService().requestChangeEmail(
//         accountId: widget.accountId,
//         newEmail: email,
//       );
//       if (!mounted) return;
//       _lockedEmail = email;
//       setState(() {
//         _otpSent = true;
//         _loading = false;
//       });
//       _startCooldown();
//       CustomToast.show(
//         context,
//         message: message,
//         icon: Icons.mail_lock_outlined,
//       );
//     } catch (e) {
//       if (!mounted) return;
//       final message = e is http.ClientException ? e.message : 'Không thể gửi OTP: $e';
//       setState(() => _loading = false);
//       CustomToast.show(
//         context,
//         message: message,
//         icon: Icons.error_outline,
//         isError: true,
//       );
//     }
//   }

//   Future<void> _verifyOtp() async {
//     if (_loading || !_otpSent) return;
//     final formValid = _formKey.currentState?.validate() ?? false;
//     if (!formValid) return;

//     final otp = _otpController.text.trim();
//     final email = _lockedEmail ?? _emailController.text.trim();

//     setState(() => _loading = true);
//     try {
//       final message = await AuthService().verifyChangeEmail(
//         accountId: widget.accountId,
//         newEmail: email,
//         otp: otp,
//       );
//       if (!mounted) return;
//       Navigator.of(context).pop(_EmailChangeResult(newEmail: email, message: message));
//     } catch (e) {
//       if (!mounted) return;
//       final message = e is http.ClientException ? e.message : 'Không thể xác thực OTP: $e';
//       setState(() => _loading = false);
//       CustomToast.show(
//         context,
//         message: message,
//         icon: Icons.error_outline,
//         isError: true,
//       );
//     }
//   }

//   Future<void> _resendOtp() async {
//     if (_loading || !_otpSent || _resendCooldown > 0) return;
//     setState(() => _loading = true);
//     try {
//       final message = await AuthService().resendChangeEmailOtp(
//         accountId: widget.accountId,
//       );
//       if (!mounted) return;
//       setState(() => _loading = false);
//       _startCooldown();
//       CustomToast.show(
//         context,
//         message: message,
//         icon: Icons.mark_email_unread_outlined,
//       );
//     } catch (e) {
//       if (!mounted) return;
//       final message = e is http.ClientException ? e.message : 'Không thể gửi lại OTP: $e';
//       setState(() => _loading = false);
//       CustomToast.show(
//         context,
//         message: message,
//         icon: Icons.error_outline,
//         isError: true,
//       );
//     }
//   }

//   bool _validateEmailInputs(String email) {
//     if (email.isEmpty) {
//       CustomToast.show(
//         context,
//         message: 'Vui lòng nhập email mới.',
//         icon: Icons.error_outline,
//         isError: true,
//       );
//       return false;
//     }
//     if (!_validateEmailFormat(email)) {
//       CustomToast.show(
//         context,
//         message: 'Email không hợp lệ.',
//         icon: Icons.error_outline,
//         isError: true,
//       );
//       return false;
//     }
//     if (email.toLowerCase() == widget.currentEmail.toLowerCase()) {
//       CustomToast.show(
//         context,
//         message: 'Email mới phải khác email hiện tại.',
//         icon: Icons.error_outline,
//         isError: true,
//       );
//       return false;
//     }
//     return true;
//   }

//   @override
//   Widget build(BuildContext context) {
//     final emailField = TextFormField(
//       controller: _emailController,
//       readOnly: _otpSent,
//       decoration: const InputDecoration(
//         labelText: 'Email mới',
//         prefixIcon: Icon(Icons.email_outlined),
//       ),
//       validator: (value) {
//         final text = value?.trim() ?? '';
//         if (text.isEmpty) {
//           return 'Vui lòng nhập email mới';
//         }
//         if (!_validateEmailFormat(text)) {
//           return 'Email không hợp lệ';
//         }
//         if (text.toLowerCase() == widget.currentEmail.toLowerCase()) {
//           return 'Email mới phải khác email hiện tại';
//         }
//         return null;
//       },
//     );

//     final otpField = TextFormField(
//       controller: _otpController,
//       keyboardType: TextInputType.number,
//       maxLength: 6,
//       decoration: const InputDecoration(
//         labelText: 'OTP 6 chữ số',
//         prefixIcon: Icon(Icons.shield_outlined),
//         counterText: '',
//       ),
//       validator: (value) {
//         if (!_otpSent) return null;
//         final text = value?.trim() ?? '';
//         if (text.length != 6 || int.tryParse(text) == null) {
//           return 'Vui lòng nhập đủ 6 chữ số OTP';
//         }
//         return null;
//       },
//     );

//     return AlertDialog(
//       title: const Text('Đổi email đăng nhập'),
//       content: Form(
//         key: _formKey,
//         child: Column(
//           mainAxisSize: MainAxisSize.min,
//           children: [
//             Align(
//               alignment: Alignment.centerLeft,
//               child: Text(
//                 'Email hiện tại: ${widget.currentEmail}',
//                 style: Theme.of(context).textTheme.bodySmall,
//               ),
//             ),
//             const SizedBox(height: 12),
//             emailField,
//             if (_otpSent) ...[
//               const SizedBox(height: 16),
//               otpField,
//             ],
//             const SizedBox(height: 12),
//             if (_otpSent)
//               Align(
//                 alignment: Alignment.centerRight,
//                 child: TextButton.icon(
//                   onPressed: (_loading || _resendCooldown > 0) ? null : _resendOtp,
//                   icon: const Icon(Icons.refresh_outlined),
//                   label: Text(
//                     _resendCooldown > 0
//                         ? 'Gửi lại OTP ($_resendCooldown s)'
//                         : 'Gửi lại OTP',
//                   ),
//                 ),
//               ),
//           ],
//         ),
//       ),
//       actions: [
//         TextButton(
//           onPressed: _loading ? null : () => Navigator.of(context).pop(),
//           child: const Text('Huỷ'),
//         ),
//         FilledButton(
//           onPressed: _loading
//               ? null
//               : () {
//                   if (_otpSent) {
//                     _verifyOtp();
//                   } else {
//                     final email = _emailController.text.trim();
//                     if (_validateEmailInputs(email)) {
//                       _requestOtp();
//                     }
//                   }
//                 },
//           child: _loading
//               ? const SizedBox(
//                   width: 18,
//                   height: 18,
//                   child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
//                 )
//               : Text(_otpSent ? 'Xác nhận' : 'Gửi OTP'),
//         ),
//       ],
//     );
//   }
// }

// class _ProfileField extends StatelessWidget {
//   const _ProfileField({
//     required this.label,
//     required this.value,
//     this.action,
//   });

//   final String label;
//   final String value;
//   final Widget? action;

//   @override
//   Widget build(BuildContext context) {
//     final theme = Theme.of(context);
//     return Padding(
//       padding: const EdgeInsets.symmetric(vertical: 8),
//       child: Row(
//         crossAxisAlignment: CrossAxisAlignment.start,
//         children: [
//           SizedBox(
//             width: 120,
//             child: Text(
//               '$label:',
//               style: theme.textTheme.titleMedium?.copyWith(
//                 fontWeight: FontWeight.w600,
//                 color: theme.colorScheme.primary,
//               ),
//             ),
//           ),
//           const SizedBox(width: 12),
//           Expanded(
//             child: Column(
//               crossAxisAlignment: CrossAxisAlignment.start,
//               children: [
//                 Text(
//                   value,
//                   style: theme.textTheme.bodyMedium,
//                 ),
//                 if (action != null) ...[
//                   const SizedBox(height: 4),
//                   action!,
//                 ],
//               ],
//             ),
//           ),
//         ],
//       ),
//     );
//   }
// }

// class _ErrorView extends StatelessWidget {
//   const _ErrorView({required this.message, required this.onRetry});

//   final String message;
//   final VoidCallback onRetry;

//   @override
//   Widget build(BuildContext context) {
//     return Center(
//       child: Padding(
//         padding: const EdgeInsets.symmetric(horizontal: 32),
//         child: Column(
//           mainAxisSize: MainAxisSize.min,
//           children: [
//             Icon(Icons.error_outline, size: 48, color: Colors.red.shade300),
//             const SizedBox(height: 12),
//             Text(
//               message,
//               style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.red.shade400),
//               textAlign: TextAlign.center,
//             ),
//             const SizedBox(height: 16),
//             ElevatedButton.icon(
//               onPressed: onRetry,
//               icon: const Icon(Icons.refresh),
//               label: const Text('Thử lại'),
//             ),
//           ],
//         ),
//       ),
//     );
//   }
// }

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../../widgets/custom_toast.dart';
import 'profile_edit_screen.dart';
import '../../constants/api_constants.dart';
import '../../models/profile_specialty.dart';
import '../../services/auth_service.dart';

class AppColors {
  static const Color primary = Color(0xFF1E3A5F); // Xanh lam chuyên nghiệp
  static const Color primaryLight = Color(0xFFF0F4F9); // Nền xanh nhẹ
  static const Color accent = Color(0xFF2563EB); // Xanh nhấn
  static const Color surface = Color(0xFFFFFFFF); // Trắng
  static const Color border = Color(0xFFE5E7EB); // Xám nhạt
  static const Color textPrimary = Color(0xFF1F2937); // Xám đậm
  static const Color textSecondary = Color(0xFF6B7280); // Xám trung
  static const Color divider = Color(0xFFF3F4F6); // Xám rất nhạt
}

class ProfileDetailScreen extends StatefulWidget {
  const ProfileDetailScreen({super.key});

  @override
  State<ProfileDetailScreen> createState() => _ProfileDetailScreenState();
}

class _ProfileDetailScreenState extends State<ProfileDetailScreen> {
  Map<String, dynamic>? _profile;
  bool _loading = false;
  String? _error;
  List<ProfileSpecialty> _specialties = const [];
  bool _profileUpdated = false;
  int? _accountId;

  @override
  void initState() {
    super.initState();
    _loadProfile();
    _loadSpecialties();
  }

  int? _extractAccountId(Map<String, dynamic>? payload) {
    if (payload == null) return null;
    dynamic idValue = payload['taiKhoanId'] ?? payload['nguoiDungId'] ?? payload['userId'] ?? payload['id'];
    if (idValue == null && payload['nguoiDung'] is Map<String, dynamic>) {
      final user = payload['nguoiDung'] as Map<String, dynamic>;
      idValue = user['taiKhoanId'] ?? user['nguoiDungId'];
    }
    if (idValue == null && payload['thanhVien'] is Map<String, dynamic>) {
      final member = payload['thanhVien'] as Map<String, dynamic>;
      idValue = member['taiKhoanId'] ?? member['nguoiDungId'];
    }
    if (idValue == null && payload['data'] is Map<String, dynamic>) {
      return _extractAccountId(payload['data'] as Map<String, dynamic>);
    }
    if (idValue is String) {
      return int.tryParse(idValue);
    }
    if (idValue is int) {
      return idValue;
    }
    return null;
  }

  Future<void> _openChangeEmailDialog() async {
    final accountId = _accountId;
    final currentEmail = _stringValue(_profile?['email']);
    if (accountId == null || currentEmail == null) {
      CustomToast.show(
        context,
        message: 'Không xác định được tài khoản hoặc email hiện tại.',
        icon: Icons.error_outline,
        isError: true,
      );
      return;
    }

    final result = await showDialog<_EmailChangeResult>(
      context: context,
      barrierDismissible: false,
      builder: (_) => _ChangeEmailDialog(
        accountId: accountId,
        currentEmail: currentEmail,
      ),
    );

    if (result == null) return;

    await _updateStoredEmail(result.newEmail);
    await _loadProfile();
    if (!mounted) return;
    CustomToast.show(
      context,
      message: result.message,
      icon: Icons.check_circle_outline,
    );
  }

  Future<void> _updateStoredEmail(String email) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString('user_info');
      if (raw == null || raw.isEmpty) return;

      final decoded = jsonDecode(raw);
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

      if (payload == null) return;
      payload['email'] = email;

      if (decoded is Map<String, dynamic>) {
        if (decoded['data'] is Map<String, dynamic>) {
          decoded['data'] = payload;
        } else {
          decoded['user'] = payload;
        }
        await prefs.setString('user_info', jsonEncode(decoded));
      }
    } catch (e) {
      debugPrint('[ProfileDetail] Failed to update stored email: $e');
    }
  }

  Future<void> _loadProfile() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString('user_info');
      if (raw == null || raw.isEmpty) {
        setState(() {
          _profile = null;
          _loading = false;
        });
        return;
      }

      final decoded = jsonDecode(raw);
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

      setState(() {
        _profile = payload ?? const {};
        _accountId = _extractAccountId(payload);
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Không thể tải thông tin người dùng: $e';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return WillPopScope(
      onWillPop: _onWillPop,
      child: Scaffold(
        backgroundColor: AppColors.surface,
        appBar: AppBar(
          elevation: 0,
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: _finishAndPop,
          ),
          title: const Text('Thông tin cá nhân', style: TextStyle(fontWeight: FontWeight.w600)),
        ),
        body: SafeArea(
          child: _loading
              ? const Center(child: CircularProgressIndicator(color: AppColors.accent))
              : _error != null
                  ? _ErrorView(message: _error!, onRetry: _loadProfile)
                  : SingleChildScrollView(
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _buildHeader(),
                          const SizedBox(height: 24),
                          _buildInfoCard(),
                        ],
                      ),
                    ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.primaryLight,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Avatar lớn hơn, ở giữa
          CircleAvatar(
            radius: 40,
            backgroundColor: AppColors.accent,
            child: Icon(
              Icons.person_outline,
              size: 48,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 16),
          // Title và description
          Text(
            'Thông tin cá nhân',
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Cập nhật và quản lý thông tin cơ bản của bạn',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              color: AppColors.textSecondary,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 20),
          // Edit button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _profile == null ? null : _openEditProfile,
              icon: const Icon(Icons.edit_outlined, size: 16),
              label: const Text('Chỉnh sửa thông tin'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.accent,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                elevation: 0,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoCard() {
    final name = _stringValue(_profile?['hoTen'] ?? _profile?['ten'] ?? _profile?['fullName']);
    final email = _stringValue(_profile?['email']);
    final gender = _genderLabel(_profile?['gioiTinh']);
    final dob = _formatDate(_profile?['ngaySinh']);
    final phone = _stringValue(_profile?['sdt'] ?? _profile?['phone']);
    final jobTitle = _resolveSpecialtyName(_profile?['chuyenMonId']) ?? _stringValue(_profile?['tenChuyenMon']);
    final bio = _stringValue(_profile?['moTaBanThan']);

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _ProfileField(label: 'Họ tên', value: name ?? '---'),
                _buildDivider(),
                _ProfileField(
                  label: 'Email',
                  value: email ?? '---',
                  action: TextButton(
                    onPressed: (_profile == null || _accountId == null) ? null : _openChangeEmailDialog,
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      minimumSize: const Size(0, 0),
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: const Text(
                      'Đổi email',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
                    ),
                  ),
                ),
                _buildDivider(),
                _ProfileField(label: 'Giới tính', value: gender ?? '---'),
                _buildDivider(),
                _ProfileField(label: 'Ngày sinh', value: dob ?? '---'),
                _buildDivider(),
                _ProfileField(label: 'Số điện thoại', value: phone ?? '---'),
              ],
            ),
          ),
          if (jobTitle != null || bio != null) ...[
            Container(color: AppColors.divider, height: 1),
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (jobTitle != null) ...[
                    Text(
                      'Chuyên môn',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textSecondary,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      jobTitle,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppColors.accent,
                      ),
                    ),
                    if (bio != null) const SizedBox(height: 16),
                  ],
                  if (bio != null) ...[
                    Text(
                      'Mô tả bản thân',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textSecondary,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      bio,
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.textPrimary,
                        height: 1.6,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildDivider() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Container(
        color: AppColors.divider,
        height: 1,
      ),
    );
  }

  Future<void> _loadSpecialties() async {
    try {
      final client = HttpClient()..badCertificateCallback = (cert, host, port) => true;
      final request = await client.getUrl(Uri.parse('${ApiConstants.baseUrl}${ApiConstants.profileSpecialties}'));
      final response = await request.close();

      if (response.statusCode == 200) {
        final body = await response.transform(utf8.decoder).join();
        final decoded = jsonDecode(body);
        List<dynamic> items;
        if (decoded is List) {
          items = decoded;
        } else if (decoded is Map<String, dynamic>) {
          final data = decoded['data'];
          if (data is List) {
            items = data;
          } else if (decoded['items'] is List) {
            items = decoded['items'] as List;
          } else {
            items = const [];
          }
        } else {
          items = const [];
        }

        final specialties = items
            .whereType<Map>()
            .map((e) => ProfileSpecialty.fromJson(Map<String, dynamic>.from(e)))
            .toList(growable: false);

        if (mounted) {
          setState(() {
            _specialties = specialties;
          });
        }
      } else {
        if (mounted) {
          setState(() {});
        }
      }
      client.close();
    } catch (_) {
      if (mounted) {
        setState(() {});
      }
    }
  }

  Future<void> _finishAndPop() async {
    if (!mounted) return;
    Navigator.of(context).pop(_profileUpdated);
  }

  Future<bool> _onWillPop() async {
    await _finishAndPop();
    return false;
  }

  Future<void> _openEditProfile() async {
    final profile = _profile;
    if (profile == null) return;

    final result = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => ProfileEditScreen(
          initialProfile: Map<String, dynamic>.from(profile),
        ),
      ),
    );

    if (result == true) {
      _profileUpdated = true;
      await _loadProfile();
      if (!mounted) return;
      CustomToast.show(
        context,
        message: 'Đã cập nhật thông tin cá nhân.',
        icon: Icons.check_circle_outline,
      );
    }
  }

  String? _stringValue(dynamic value) {
    if (value == null) return null;
    final text = value.toString().trim();
    return text.isEmpty ? null : text;
  }

  String? _resolveSpecialtyName(dynamic idValue) {
    int? id;
    if (idValue is int) {
      id = idValue;
    } else if (idValue != null) {
      id = int.tryParse(idValue.toString());
    }

    if (id == null || _specialties.isEmpty) return null;

    final match = _specialties.firstWhere(
      (item) => item.id == id,
      orElse: () => const ProfileSpecialty(id: 0, name: ''),
    );

    return match.id == 0 ? null : (match.name.isEmpty ? null : match.name);
  }

  String? _genderLabel(dynamic value) {
    final text = _stringValue(value);
    if (text == null) return null;
    switch (text.toLowerCase()) {
      case 'nam':
      case 'male':
      case 'm':
      case '1':
        return 'Nam';
      case 'nu':
      case 'nữ':
      case 'female':
      case 'f':
      case '0':
        return 'Nữ';
      default:
        return text;
    }
  }

  String? _formatDate(dynamic value) {
    final text = _stringValue(value);
    if (text == null) return null;
    try {
      final parsed = DateTime.parse(text);
      return parsed.toIso8601String().split('T').first;
    } catch (_) {
      return text;
    }
  }
}

class _EmailChangeResult {
  const _EmailChangeResult({required this.newEmail, required this.message});

  final String newEmail;
  final String message;
}

class _ChangeEmailDialog extends StatefulWidget {
  const _ChangeEmailDialog({
    required this.accountId,
    required this.currentEmail,
  });

  final int accountId;
  final String currentEmail;

  @override
  State<_ChangeEmailDialog> createState() => _ChangeEmailDialogState();
}

class _ChangeEmailDialogState extends State<_ChangeEmailDialog> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _otpController = TextEditingController();

  bool _otpSent = false;
  bool _loading = false;
  int _resendCooldown = 0;
  Timer? _resendTimer;
  String? _lockedEmail;

  @override
  void initState() {
    super.initState();
    _emailController.text = '';
  }

  @override
  void dispose() {
    _resendTimer?.cancel();
    _emailController.dispose();
    _otpController.dispose();
    super.dispose();
  }

  bool _validateEmailFormat(String email) {
    final emailRegex = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
    return emailRegex.hasMatch(email);
  }

  void _startCooldown() {
    setState(() {
      _resendCooldown = 60;
    });
    _resendTimer?.cancel();
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_resendCooldown <= 1) {
        timer.cancel();
        setState(() {
          _resendCooldown = 0;
        });
      } else {
        setState(() {
          _resendCooldown -= 1;
        });
      }
    });
  }

  Future<void> _requestOtp() async {
    if (_loading) return;
    final email = _emailController.text.trim();

    if (!_otpSent && !_validateEmailInputs(email)) {
      return;
    }

    setState(() => _loading = true);
    try {
      final message = await AuthService().requestChangeEmail(
        accountId: widget.accountId,
        newEmail: email,
      );
      if (!mounted) return;
      _lockedEmail = email;
      setState(() {
        _otpSent = true;
        _loading = false;
      });
      _startCooldown();
      CustomToast.show(
        context,
        message: message,
        icon: Icons.mail_lock_outlined,
      );
    } catch (e) {
      if (!mounted) return;
      final message = e is http.ClientException ? e.message : 'Không thể gửi OTP: $e';
      setState(() => _loading = false);
      CustomToast.show(
        context,
        message: message,
        icon: Icons.error_outline,
        isError: true,
      );
    }
  }

  Future<void> _verifyOtp() async {
    if (_loading || !_otpSent) return;
    final formValid = _formKey.currentState?.validate() ?? false;
    if (!formValid) return;

    final otp = _otpController.text.trim();
    final email = _lockedEmail ?? _emailController.text.trim();

    setState(() => _loading = true);
    try {
      final message = await AuthService().verifyChangeEmail(
        accountId: widget.accountId,
        newEmail: email,
        otp: otp,
      );
      if (!mounted) return;
      Navigator.of(context).pop(_EmailChangeResult(newEmail: email, message: message));
    } catch (e) {
      if (!mounted) return;
      final message = e is http.ClientException ? e.message : 'Không thể xác thực OTP: $e';
      setState(() => _loading = false);
      CustomToast.show(
        context,
        message: message,
        icon: Icons.error_outline,
        isError: true,
      );
    }
  }

  Future<void> _resendOtp() async {
    if (_loading || !_otpSent || _resendCooldown > 0) return;
    setState(() => _loading = true);
    try {
      final message = await AuthService().resendChangeEmailOtp(
        accountId: widget.accountId,
      );
      if (!mounted) return;
      setState(() => _loading = false);
      _startCooldown();
      CustomToast.show(
        context,
        message: message,
        icon: Icons.mark_email_unread_outlined,
      );
    } catch (e) {
      if (!mounted) return;
      final message = e is http.ClientException ? e.message : 'Không thể gửi lại OTP: $e';
      setState(() => _loading = false);
      CustomToast.show(
        context,
        message: message,
        icon: Icons.error_outline,
        isError: true,
      );
    }
  }

  bool _validateEmailInputs(String email) {
    if (email.isEmpty) {
      CustomToast.show(
        context,
        message: 'Vui lòng nhập email mới.',
        icon: Icons.error_outline,
        isError: true,
      );
      return false;
    }
    if (!_validateEmailFormat(email)) {
      CustomToast.show(
        context,
        message: 'Email không hợp lệ.',
        icon: Icons.error_outline,
        isError: true,
      );
      return false;
    }
    if (email.toLowerCase() == widget.currentEmail.toLowerCase()) {
      CustomToast.show(
        context,
        message: 'Email mới phải khác email hiện tại.',
        icon: Icons.error_outline,
        isError: true,
      );
      return false;
    }
    return true;
  }

  @override
  Widget build(BuildContext context) {
    final emailField = TextFormField(
      controller: _emailController,
      readOnly: _otpSent,
      decoration: InputDecoration(
        labelText: 'Email mới',
        prefixIcon: const Icon(Icons.email_outlined, color: AppColors.accent),
        labelStyle: const TextStyle(color: AppColors.textSecondary),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.accent, width: 2),
        ),
      ),
      validator: (value) {
        final text = value?.trim() ?? '';
        if (text.isEmpty) {
          return 'Vui lòng nhập email mới';
        }
        if (!_validateEmailFormat(text)) {
          return 'Email không hợp lệ';
        }
        if (text.toLowerCase() == widget.currentEmail.toLowerCase()) {
          return 'Email mới phải khác email hiện tại';
        }
        return null;
      },
    );

    final otpField = TextFormField(
      controller: _otpController,
      keyboardType: TextInputType.number,
      maxLength: 6,
      decoration: InputDecoration(
        labelText: 'OTP 6 chữ số',
        prefixIcon: const Icon(Icons.shield_outlined, color: AppColors.accent),
        labelStyle: const TextStyle(color: AppColors.textSecondary),
        counterText: '',
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.accent, width: 2),
        ),
      ),
      validator: (value) {
        if (!_otpSent) return null;
        final text = value?.trim() ?? '';
        if (text.length != 6 || int.tryParse(text) == null) {
          return 'Vui lòng nhập đủ 6 chữ số OTP';
        }
        return null;
      },
    );

    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: const Text(
        'Đổi email đăng nhập',
        style: TextStyle(
          fontWeight: FontWeight.w700,
          color: AppColors.textPrimary,
        ),
      ),
      content: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.primaryLight,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline, color: AppColors.accent, size: 18),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Email hiện tại: ${widget.currentEmail}',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              emailField,
              if (_otpSent) ...[
                const SizedBox(height: 16),
                otpField,
              ],
              const SizedBox(height: 12),
              if (_otpSent)
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton.icon(
                    onPressed: (_loading || _resendCooldown > 0) ? null : _resendOtp,
                    icon: const Icon(Icons.refresh_outlined, size: 16),
                    label: Text(
                      _resendCooldown > 0
                          ? 'Gửi lại ($_resendCooldown s)'
                          : 'Gửi lại OTP',
                      style: const TextStyle(fontSize: 12),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _loading ? null : () => Navigator.of(context).pop(),
          child: const Text('Huỷ', style: TextStyle(color: AppColors.textSecondary)),
        ),
        FilledButton(
          onPressed: _loading
              ? null
              : () {
                  if (_otpSent) {
                    _verifyOtp();
                  } else {
                    final email = _emailController.text.trim();
                    if (_validateEmailInputs(email)) {
                      _requestOtp();
                    }
                  }
                },
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.accent,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
          child: _loading
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : Text(_otpSent ? 'Xác nhận' : 'Gửi OTP', style: const TextStyle(fontWeight: FontWeight.w600)),
        ),
      ],
    );
  }
}

class _ProfileField extends StatelessWidget {
  const _ProfileField({
    required this.label,
    required this.value,
    this.action,
  });

  final String label;
  final String value;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.textSecondary,
                letterSpacing: 0.3,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: AppColors.textPrimary,
                  ),
                ),
                if (action != null) ...[
                  const SizedBox(height: 4),
                  action!,
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, size: 48, color: AppColors.accent),
            const SizedBox(height: 12),
            Text(
              message,
              style: const TextStyle(
                fontSize: 14,
                color: AppColors.textPrimary,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Thử lại'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.accent,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
