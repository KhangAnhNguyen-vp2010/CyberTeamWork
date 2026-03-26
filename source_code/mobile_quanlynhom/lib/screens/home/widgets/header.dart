// import 'dart:convert';
// import 'dart:typed_data';

// import 'package:flutter/material.dart';
// import 'package:http/http.dart' as http;
// import 'package:shared_preferences/shared_preferences.dart';

// import '../../../models/group_summary.dart';
// import '../../../widgets/custom_toast.dart';
// import '../../auth/login_screen.dart';
// import '../../../constants/api_constants.dart';
// import '../../profile/profile_detail_screen.dart';
// import '../../../services/auth_service.dart';

// class Header extends StatefulWidget {
//   const Header({
//     super.key,
//     required this.groups,
//     required this.selectedGroup,
//     required this.isLoading,
//     required this.error,
//     required this.onReload,
//     required this.imageUrlResolver,
//     required this.onSelected,
//     required this.onNotificationsTap,
//     required this.hasUnreadNotifications,
//   });

//   final List<GroupSummary> groups;
//   final GroupSummary? selectedGroup;
//   final bool isLoading;
//   final String? error;
//   final VoidCallback onReload;
//   final String? Function(GroupSummary) imageUrlResolver;
//   final ValueChanged<GroupSummary> onSelected;
//   final VoidCallback onNotificationsTap;
//   final bool hasUnreadNotifications;

//   @override
//   State<Header> createState() => _HeaderState();
// }

// class _ChangePasswordDialog extends StatefulWidget {
//   const _ChangePasswordDialog({
//     required this.accountId,
//     required this.policyEvaluator,
//   });

//   final int accountId;
//   final String? Function(String) policyEvaluator;

//   @override
//   State<_ChangePasswordDialog> createState() => _ChangePasswordDialogState();
// }

// class _ChangePasswordDialogState extends State<_ChangePasswordDialog> {
//   final _formKey = GlobalKey<FormState>();
//   final TextEditingController _oldController = TextEditingController();
//   final TextEditingController _newController = TextEditingController();
//   final TextEditingController _confirmController = TextEditingController();

//   bool _obscureOld = true;
//   bool _obscureNew = true;
//   bool _obscureConfirm = true;
//   bool _submitting = false;

//   @override
//   void dispose() {
//     _oldController.dispose();
//     _newController.dispose();
//     _confirmController.dispose();
//     super.dispose();
//   }

//   Future<void> _handleSubmit() async {
//     if (_submitting) return;
//     if (!_formKey.currentState!.validate()) return;

//     setState(() => _submitting = true);
//     try {
//       final message = await AuthService().changePassword(
//         accountId: widget.accountId,
//         oldPassword: _oldController.text.trim(),
//         newPassword: _newController.text.trim(),
//       );
//       if (!mounted) return;
//       Navigator.of(context).pop(message);
//     } catch (e) {
//       if (!mounted) return;
//       String errorMessage;
//       if (e is http.ClientException) {
//         errorMessage = e.message;
//       } else {
//         errorMessage = 'Đổi mật khẩu thất bại: $e';
//       }
//       CustomToast.show(
//         context,
//         message: errorMessage,
//         icon: Icons.error_outline,
//         isError: true,
//       );
//     } finally {
//       if (mounted) {
//         setState(() => _submitting = false);
//       }
//     }
//   }

//   String? _validateNewPassword(String? value) {
//     if (value == null || value.trim().isEmpty) {
//       return 'Vui lòng nhập mật khẩu mới';
//     }
//     final trimmed = value.trim();
//     final message = widget.policyEvaluator(trimmed);
//     if (message != null) {
//       return message;
//     }
//     if (trimmed == _oldController.text.trim()) {
//       return 'Mật khẩu mới phải khác mật khẩu hiện tại';
//     }
//     return null;
//   }

//   @override
//   Widget build(BuildContext context) {
//     return AlertDialog(
//       title: const Text('Đổi mật khẩu'),
//       content: Form(
//         key: _formKey,
//         child: Column(
//           mainAxisSize: MainAxisSize.min,
//           children: [
//             _PasswordField(
//               controller: _oldController,
//               label: 'Mật khẩu hiện tại',
//               obscureText: _obscureOld,
//               onToggleVisibility: () => setState(() => _obscureOld = !_obscureOld),
//               validator: (value) {
//                 if (value == null || value.trim().isEmpty) {
//                   return 'Vui lòng nhập mật khẩu hiện tại';
//                 }
//                 return null;
//               },
//             ),
//             const SizedBox(height: 12),
//             _PasswordField(
//               controller: _newController,
//               label: 'Mật khẩu mới',
//               obscureText: _obscureNew,
//               onToggleVisibility: () => setState(() => _obscureNew = !_obscureNew),
//               validator: _validateNewPassword,
//             ),
//             const SizedBox(height: 12),
//             _PasswordField(
//               controller: _confirmController,
//               label: 'Xác nhận mật khẩu mới',
//               obscureText: _obscureConfirm,
//               onToggleVisibility: () => setState(() => _obscureConfirm = !_obscureConfirm),
//               validator: (value) {
//                 if (value == null || value.trim().isEmpty) {
//                   return 'Vui lòng xác nhận mật khẩu mới';
//                 }
//                 final trimmed = value.trim();
//                 if (trimmed != _newController.text.trim()) {
//                   return 'Mật khẩu xác nhận không khớp';
//                 }
//                 final message = widget.policyEvaluator(trimmed);
//                 if (message != null) {
//                   return message;
//                 }
//                 return null;
//               },
//             ),
//           ],
//         ),
//       ),
//       actions: [
//         TextButton(
//           onPressed: _submitting ? null : () => Navigator.of(context).pop(),
//           child: const Text('Huỷ'),
//         ),
//         FilledButton(
//           onPressed: _submitting ? null : _handleSubmit,
//           child: _submitting
//               ? const SizedBox(
//                   width: 18,
//                   height: 18,
//                   child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
//                 )
//               : const Text('Đổi mật khẩu'),
//         ),
//       ],
//     );
//   }
// }

// class _PasswordField extends StatelessWidget {
//   const _PasswordField({
//     required this.controller,
//     required this.label,
//     required this.obscureText,
//     required this.onToggleVisibility,
//     required this.validator,
//   });

//   final TextEditingController controller;
//   final String label;
//   final bool obscureText;
//   final VoidCallback onToggleVisibility;
//   final String? Function(String?) validator;

//   @override
//   Widget build(BuildContext context) {
//     return TextFormField(
//       controller: controller,
//       obscureText: obscureText,
//       validator: validator,
//       decoration: InputDecoration(
//         labelText: label,
//         border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
//         suffixIcon: IconButton(
//           icon: Icon(obscureText ? Icons.visibility_off_outlined : Icons.visibility_outlined),
//           onPressed: onToggleVisibility,
//         ),
//       ),
//     );
//   }
// }

// class _HeaderState extends State<Header> {
//   String? _userName;
//   String? _userEmail;
//   String? _avatarUrl;
//   Uint8List? _avatarBytes;
//   int? _accountId;

//   @override
//   void initState() {
//     super.initState();
//     _loadUserInfo();
//   }

//   int? _extractAccountId(Map<String, dynamic> payload) {
//     dynamic idValue = payload['taiKhoanId'] ?? payload['nguoiDungId'] ?? payload['userId'] ?? payload['id'];
//     if (idValue == null && payload['nguoiDung'] is Map<String, dynamic>) {
//       idValue = (payload['nguoiDung'] as Map<String, dynamic>)['taiKhoanId'] ??
//           (payload['nguoiDung'] as Map<String, dynamic>)['nguoiDungId'];
//     }
//     if (idValue == null && payload['thanhVien'] is Map<String, dynamic>) {
//       idValue = (payload['thanhVien'] as Map<String, dynamic>)['taiKhoanId'] ??
//           (payload['thanhVien'] as Map<String, dynamic>)['nguoiDungId'];
//     }
//     if (idValue == null && payload['user'] is Map<String, dynamic>) {
//       final user = payload['user'] as Map<String, dynamic>;
//       idValue = user['taiKhoanId'] ?? user['nguoiDungId'] ?? user['id'];
//     }
//     if (idValue == null && payload['data'] is Map<String, dynamic>) {
//       final data = payload['data'];
//       if (data is Map<String, dynamic>) {
//         return _extractAccountId(data);
//       }
//       return null;
//     }
//     if (idValue is String) {
//       return int.tryParse(idValue);
//     }
//     if (idValue is int) {
//       return idValue;
//     }
//     return null;
//   }

//   String? _passwordPolicyMessage(String password) {
//     if (password.length < 8) {
//       return 'Mật khẩu phải có ít nhất 8 ký tự';
//     }

//     final policy = RegExp(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$');
//     if (!policy.hasMatch(password)) {
//       return 'Mật khẩu phải gồm chữ thường, chữ hoa, số và ký tự đặc biệt';
//     }

//     return null;
//   }

//   Future<void> _openChangePasswordDialog() async {
//     final accountId = _accountId;
//     if (accountId == null) {
//       CustomToast.show(
//         context,
//         message: 'Không xác định được tài khoản. Vui lòng đăng nhập lại.',
//         icon: Icons.error_outline,
//         isError: true,
//       );
//       return;
//     }

//     final result = await showDialog<String>(
//       context: context,
//       barrierDismissible: false,
//       builder: (dialogContext) => _ChangePasswordDialog(
//         accountId: accountId,
//         policyEvaluator: _passwordPolicyMessage,
//       ),
//     );

//     if (!mounted || result == null) return;

//     CustomToast.show(
//       context,
//       message: result,
//       icon: Icons.check_circle_outline,
//     );
//   }

//   String? _resolveAvatarUrl(String? path) {
//     if (path == null || path.isEmpty) return null;
//     final trimmed = path.trim();
//     if (trimmed.startsWith('data:')) {
//       return trimmed;
//     }
//     if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
//       return trimmed;
//     }

//     final base = ApiConstants.baseUrl;
//     if (trimmed.startsWith('/')) {
//       return '$base$trimmed';
//     }
//     return '$base/$trimmed';
//   }

//   Future<void> _loadUserInfo() async {
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

//       if (!mounted) return;

//       final name = payload['hoTen']?.toString().trim();
//       final email = payload['email']?.toString().trim();
//       final rawAvatar = payload['anhDaiDien'] ?? payload['anhBia'] ?? payload['avatarUrl'] ?? payload['avatar'];
//       final avatarString = rawAvatar?.toString().trim();

//       Uint8List? avatarBytes;
//       String? avatarUrl;

//       if (avatarString != null && avatarString.isNotEmpty) {
//         avatarBytes = _decodeBase64Avatar(avatarString);
//         if (avatarBytes == null) {
//           avatarUrl = _resolveAvatarUrl(avatarString);
//         }
//       }

//       debugPrint('[Header] Loading user info - name: $name, avatarUrl: $avatarUrl, avatarBytes length: ${avatarBytes?.length}');
      
//       setState(() {
//         _userName = (name == null || name.isEmpty) ? null : name;
//         _userEmail = (email == null || email.isEmpty) ? null : email;
//         _avatarUrl = (avatarUrl == null || avatarUrl.isEmpty) ? null : avatarUrl;
//         _avatarBytes = avatarBytes;
//         _accountId = _extractAccountId(payload!);
//       });
      
//       debugPrint('[Header] Updated state - _avatarUrl: $_avatarUrl, _avatarBytes: ${_avatarBytes?.length}');
//     } catch (e) {
//       debugPrint('[Header] Failed to load user info: $e');
//     }
//   }

//   Future<void> _openProfileDetail() async {
//     final updated = await Navigator.of(context).push<bool>(
//       MaterialPageRoute(builder: (_) => const ProfileDetailScreen()),
//     );

//     if (!mounted) return;

//     if (updated == true) {
//       // Clear entire image cache to force reload
//       PaintingBinding.instance.imageCache.clear();
//       PaintingBinding.instance.imageCache.clearLiveImages();
      
//       // Force clear current avatar state
//       setState(() {
//         _avatarUrl = null;
//         _avatarBytes = null;
//       });
      
//       // Small delay to ensure cache is cleared
//       await Future.delayed(const Duration(milliseconds: 100));
//     }

//     await _loadUserInfo();
//   }

//   @override
//   Widget build(BuildContext context) {
//     return Row(
//       children: [
//         Expanded(
//           child: _buildGroupSelector(context),
//         ),
//         const SizedBox(width: 12),
//         _buildNotificationButton(context),
//         const SizedBox(width: 12),
//         _buildUserDropdown(context),
//       ],
//     );
//   }

//   Widget _buildGroupSelector(BuildContext context) {
//     if (widget.isLoading) {
//       return Container(
//         height: 56,
//         padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
//         decoration: BoxDecoration(
//           color: Colors.white,
//           borderRadius: BorderRadius.circular(12),
//           border: Border.all(color: Colors.grey.shade300),
//         ),
//         child: Row(
//           children: [
//             SizedBox(
//               width: 20,
//               height: 20,
//               child: CircularProgressIndicator(
//                 strokeWidth: 2,
//                 color: Theme.of(context).colorScheme.primary,
//               ),
//             ),
//             const SizedBox(width: 12),
//             Text(
//               'Đang tải nhóm...',
//               style: Theme.of(context).textTheme.bodyMedium,
//             ),
//           ],
//         ),
//       );
//     }

//     if (widget.error != null) {
//       return Container(
//         height: 56,
//         padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
//         decoration: BoxDecoration(
//           color: Colors.red.shade50,
//           borderRadius: BorderRadius.circular(12),
//           border: Border.all(color: Colors.red.shade200),
//         ),
//         child: Row(
//           children: [
//             Icon(Icons.error_outline, color: Colors.red.shade700, size: 20),
//             const SizedBox(width: 12),
//             Expanded(
//               child: Text(
//                 widget.error!,
//                 style: Theme.of(context).textTheme.bodySmall?.copyWith(
//                       color: Colors.red.shade700,
//                     ),
//                 overflow: TextOverflow.ellipsis,
//               ),
//             ),
//             IconButton(
//               icon: Icon(Icons.refresh, size: 20, color: Colors.red.shade700),
//               onPressed: widget.onReload,
//               padding: EdgeInsets.zero,
//               constraints: const BoxConstraints(),
//             ),
//           ],
//         ),
//       );
//     }

//     if (widget.groups.isEmpty) {
//       return Container(
//         height: 56,
//         padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
//         decoration: BoxDecoration(
//           color: Colors.grey.shade100,
//           borderRadius: BorderRadius.circular(12),
//           border: Border.all(color: Colors.grey.shade300),
//         ),
//         child: Row(
//           children: [
//             Icon(Icons.info_outline, color: Colors.grey.shade600, size: 20),
//             const SizedBox(width: 12),
//             Expanded(
//               child: Text(
//                 'Chưa có nhóm nào',
//                 style: Theme.of(context).textTheme.bodyMedium?.copyWith(
//                       color: Colors.grey.shade600,
//                     ),
//               ),
//             ),
//           ],
//         ),
//       );
//     }

//     return Container(
//       padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
//       decoration: BoxDecoration(
//         color: Colors.white,
//         borderRadius: BorderRadius.circular(12),
//         border: Border.all(color: Colors.grey.shade300),
//       ),
//       child: DropdownButtonHideUnderline(
//         child: DropdownButton<GroupSummary>(
//           value: widget.selectedGroup,
//           isExpanded: true,
//           icon: Icon(Icons.arrow_drop_down, color: Theme.of(context).colorScheme.primary),
//           items: widget.groups.map((group) {
//             final role = group.chucVu;
//             return DropdownMenuItem<GroupSummary>(
//               value: group,
//               child: Row(
//                 children: [
//                   _buildGroupImage(group),
//                   const SizedBox(width: 12),
//                   Expanded(
//                     child: Column(
//                       crossAxisAlignment: CrossAxisAlignment.start,
//                       mainAxisSize: MainAxisSize.min,
//                       children: [
//                         Text(
//                           group.tenNhom,
//                           style: const TextStyle(
//                             fontSize: 16,
//                             fontWeight: FontWeight.w600,
//                           ),
//                           overflow: TextOverflow.ellipsis,
//                         ),
//                         if (role != null && role.isNotEmpty)
//                           Text(
//                             role,
//                             style: TextStyle(
//                               fontSize: 12,
//                               color: Colors.grey.shade600,
//                             ),
//                             overflow: TextOverflow.ellipsis,
//                             maxLines: 1,
//                           ),
//                       ],
//                     ),
//                   ),
//                 ],
//               ),
//             );
//           }).toList(),
//           onChanged: (group) {
//             if (group != null) {
//               widget.onSelected(group);
//             }
//           },
//         ),
//       ),
//     );
//   }

//   Widget _buildGroupImage(GroupSummary group) {
//     final imageUrl = widget.imageUrlResolver(group);

//     Widget buildDefault() {
//       return ClipRRect(
//         borderRadius: BorderRadius.circular(8),
//         child: Image.asset(
//           'assets/images/group-default.png',
//           width: 40,
//           height: 40,
//           fit: BoxFit.cover,
//         ),
//       );
//     }

//     if (imageUrl == null || imageUrl.isEmpty) {
//       return buildDefault();
//     }

//     return ClipRRect(
//       borderRadius: BorderRadius.circular(8),
//       child: Image.network(
//         imageUrl,
//         width: 40,
//         height: 40,
//         fit: BoxFit.cover,
//         errorBuilder: (_, __, ___) => buildDefault(),
//       ),
//     );
//   }

//   Widget _buildNotificationButton(BuildContext context) {
//     return Stack(
//       children: [
//         Container(
//           width: 56,
//           height: 56,
//           decoration: BoxDecoration(
//             color: Colors.white,
//             borderRadius: BorderRadius.circular(12),
//             border: Border.all(color: Colors.grey.shade300),
//           ),
//           child: IconButton(
//             icon: Icon(
//               Icons.notifications_outlined,
//               color: Theme.of(context).colorScheme.primary,
//             ),
//             onPressed: widget.onNotificationsTap,
//           ),
//         ),
//         if (widget.hasUnreadNotifications)
//           Positioned(
//             right: 8,
//             top: 8,
//             child: Container(
//               width: 12,
//               height: 12,
//               decoration: BoxDecoration(
//                 color: Colors.red,
//                 shape: BoxShape.circle,
//                 border: Border.all(color: Colors.white, width: 2),
//               ),
//             ),
//           ),
//       ],
//     );
//   }

//   Widget _buildUserDropdown(BuildContext context) {
//     final theme = Theme.of(context);
//     final avatar = _avatarUrl;
//     final avatarBytes = _avatarBytes;
//     final displayName = _userName ?? 'Người dùng';
//     final displayEmail = _userEmail ?? '---';
//     final avatarKey = avatarBytes != null 
//         ? ValueKey('avatar_bytes_${avatarBytes.hashCode}')
//         : (avatar != null ? ValueKey('avatar_url_$avatar') : const ValueKey('avatar_none'));

//     return PopupMenuButton<_UserAction>(
//       tooltip: 'Tài khoản',
//       offset: const Offset(0, 12),
//       position: PopupMenuPosition.under,
//       shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
//       elevation: 6,
//       itemBuilder: (context) {
//         return [
//           PopupMenuItem<_UserAction>(
//             enabled: false,
//             padding: const EdgeInsets.only(left: 16, right: 16, top: 12, bottom: 8),
//             child: Column(
//               crossAxisAlignment: CrossAxisAlignment.start,
//               children: [
//                 Row(
//                   children: [
//                     _AvatarBadge(key: avatarKey, avatar: avatar, avatarBytes: avatarBytes, radius: 24),
//                     const SizedBox(width: 12),
//                     Expanded(
//                       child: Column(
//                         crossAxisAlignment: CrossAxisAlignment.start,
//                         children: [
//                           Text(
//                             displayName,
//                             style: theme.textTheme.titleMedium?.copyWith(
//                               fontWeight: FontWeight.w700,
//                               color: theme.colorScheme.primary,
//                             ),
//                           ),
//                           const SizedBox(height: 4),
//                           Text(
//                             displayEmail,
//                             style: theme.textTheme.bodyMedium?.copyWith(color: Colors.grey.shade700),
//                           ),
//                         ],
//                       ),
//                     ),
//                   ],
//                 ),
//               ],
//             ),
//           ),
//           const PopupMenuDivider(height: 8),
//           PopupMenuItem<_UserAction>(
//             value: _UserAction.profile,
//             child: Row(
//               children: const [
//                 Icon(Icons.edit_outlined, size: 20),
//                 SizedBox(width: 12),
//                 Text('Chỉnh sửa profile'),
//               ],
//             ),
//           ),
//           PopupMenuItem<_UserAction>(
//             value: _UserAction.changePassword,
//             child: Row(
//               children: const [
//                 Icon(Icons.key_outlined, size: 20),
//                 SizedBox(width: 12),
//                 Text('Đổi mật khẩu'),
//               ],
//             ),
//           ),
//           PopupMenuItem<_UserAction>(
//             value: _UserAction.logout,
//             textStyle: const TextStyle(color: Colors.redAccent, fontWeight: FontWeight.w600),
//             child: Row(
//               children: const [
//                 Icon(Icons.logout_outlined, size: 20, color: Colors.redAccent),
//                 SizedBox(width: 12),
//                 Text('Đăng xuất'),
//               ],
//             ),
//           ),
//         ];
//       },
//       onSelected: (action) async {
//         switch (action) {
//           case _UserAction.profile:
//             await _openProfileDetail();
//             break;
//           case _UserAction.changePassword:
//             _openChangePasswordDialog();
//             break;
//           case _UserAction.logout:
//             _handleLogout();
//             break;
//         }
//       },
//       child: Container(
//         padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
//         decoration: BoxDecoration(
//           color: Colors.white,
//           borderRadius: BorderRadius.circular(24),
//           border: Border.all(color: Colors.blueGrey.shade100),
//           boxShadow: [
//             BoxShadow(
//               color: Colors.black.withOpacity(0.04),
//               blurRadius: 6,
//               offset: const Offset(0, 2),
//             ),
//           ],
//         ),
//         child: Row(
//           mainAxisSize: MainAxisSize.min,
//           children: [
//             _AvatarBadge(key: avatarKey, avatar: avatar, avatarBytes: avatarBytes, radius: 18),
//             const SizedBox(width: 6),
//             const Icon(Icons.keyboard_arrow_down_rounded, size: 20),
//           ],
//         ),
//       ),
//     );
//   }

//   Future<void> _handleLogout() async {
//     final confirmed = await showDialog<bool>(
//       context: context,
//       builder: (dialogContext) {
//         return AlertDialog(
//           title: const Text('Đăng xuất'),
//           content: const Text('Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng?'),
//           actions: [
//             TextButton(
//               onPressed: () => Navigator.of(dialogContext).pop(false),
//               child: const Text('Huỷ'),
//             ),
//             FilledButton(
//               onPressed: () => Navigator.of(dialogContext).pop(true),
//               style: FilledButton.styleFrom(backgroundColor: Colors.redAccent),
//               child: const Text('Đăng xuất'),
//             ),
//           ],
//         );
//       },
//     );

//     if (confirmed != true) return;

//     final prefs = await SharedPreferences.getInstance();
//     await prefs.remove('user_info');
//     await prefs.remove('accessToken');
//     await prefs.remove('refreshToken');

//     if (!mounted) return;

//     CustomToast.show(
//       context,
//       message: 'Đăng xuất thành công.',
//       icon: Icons.logout,
//     );

//     Navigator.of(context).pushAndRemoveUntil(
//       MaterialPageRoute(builder: (_) => const LoginScreen()),
//       (route) => false,
//     );
//   }
// }

// enum _UserAction { profile, changePassword, logout }

// class _AvatarBadge extends StatelessWidget {
//   const _AvatarBadge({super.key, this.avatar, this.avatarBytes, required this.radius});

//   final String? avatar;
//   final Uint8List? avatarBytes;
//   final double radius;

//   @override
//   Widget build(BuildContext context) {
//     final placeholder = CircleAvatar(
//       radius: radius,
//       backgroundColor: Colors.blueGrey.shade100,
//       child: Icon(Icons.person_outline, color: Colors.blueGrey.shade500, size: radius + 6),
//     );

//     if (avatarBytes != null && avatarBytes!.isNotEmpty) {
//       return CircleAvatar(
//         radius: radius,
//         backgroundColor: Colors.transparent,
//         backgroundImage: MemoryImage(avatarBytes!),
//       );
//     }

//     final avatarPath = avatar;
//     if (avatarPath == null || avatarPath.isEmpty) {
//       return placeholder;
//     }

//     return CircleAvatar(
//       radius: radius,
//       backgroundColor: Colors.transparent,
//       backgroundImage: NetworkImage(avatarPath),
//       onBackgroundImageError: (_, __) {},
//     );
//   }
// }

//   Uint8List? _decodeBase64Avatar(String value) {
//     try {
//       final trimmed = value.trim();
//       if (trimmed.startsWith('data:')) {
//         final index = trimmed.indexOf(',');
//         if (index != -1 && index < trimmed.length - 1) {
//           return base64Decode(trimmed.substring(index + 1));
//         }
//       }

//       if (_looksLikeRawBase64(trimmed)) {
//         return base64Decode(trimmed);
//       }
//     } catch (e) {
//       debugPrint('[Header] Failed to decode base64 avatar: $e');
//     }
//     return null;
//   }

//   bool _looksLikeRawBase64(String value) {
//     if (value.length < 20) return false;
//     final sanitized = value.replaceAll(RegExp(r'\s'), '');
//     if (sanitized.length % 4 != 0) return false;
//     final base64Regex = RegExp(r'^[A-Za-z0-9+/=]+$');
//     return base64Regex.hasMatch(sanitized);
//   }


import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../../../models/group_summary.dart';
import '../../../widgets/custom_toast.dart';
import '../../auth/login_screen.dart';
import '../../../constants/api_constants.dart';
import '../../profile/profile_detail_screen.dart';
import '../../../services/auth_service.dart';

class Header extends StatefulWidget {
  const Header({
    super.key,
    required this.groups,
    required this.selectedGroup,
    required this.isLoading,
    required this.error,
    required this.onReload,
    required this.imageUrlResolver,
    required this.onSelected,
    required this.onNotificationsTap,
    required this.hasUnreadNotifications,
  });

  final List<GroupSummary> groups;
  final GroupSummary? selectedGroup;
  final bool isLoading;
  final String? error;
  final VoidCallback onReload;
  final String? Function(GroupSummary) imageUrlResolver;
  final ValueChanged<GroupSummary> onSelected;
  final VoidCallback onNotificationsTap;
  final bool hasUnreadNotifications;

  @override
  State<Header> createState() => _HeaderState();
}

class _ChangePasswordDialog extends StatefulWidget {
  const _ChangePasswordDialog({
    required this.accountId,
    required this.policyEvaluator,
  });

  final int accountId;
  final String? Function(String) policyEvaluator;

  @override
  State<_ChangePasswordDialog> createState() => _ChangePasswordDialogState();
}

class _ChangePasswordDialogState extends State<_ChangePasswordDialog> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _oldController = TextEditingController();
  final TextEditingController _newController = TextEditingController();
  final TextEditingController _confirmController = TextEditingController();

  bool _obscureOld = true;
  bool _obscureNew = true;
  bool _obscureConfirm = true;
  bool _submitting = false;

  @override
  void dispose() {
    _oldController.dispose();
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (_submitting) return;
    if (!_formKey.currentState!.validate()) return;

    setState(() => _submitting = true);
    try {
      final message = await AuthService().changePassword(
        accountId: widget.accountId,
        oldPassword: _oldController.text.trim(),
        newPassword: _newController.text.trim(),
      );
      if (!mounted) return;
      Navigator.of(context).pop(message);
    } catch (e) {
      if (!mounted) return;
      String errorMessage;
      if (e is http.ClientException) {
        errorMessage = e.message;
      } else {
        errorMessage = 'Đổi mật khẩu thất bại: $e';
      }
      CustomToast.show(
        context,
        message: errorMessage,
        icon: Icons.error_outline,
        isError: true,
      );
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  String? _validateNewPassword(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Vui lòng nhập mật khẩu mới';
    }
    final trimmed = value.trim();
    final message = widget.policyEvaluator(trimmed);
    if (message != null) {
      return message;
    }
    if (trimmed == _oldController.text.trim()) {
      return 'Mật khẩu mới phải khác mật khẩu hiện tại';
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      elevation: 8,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 450),
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Colors.white,
              Colors.blue.shade50.withOpacity(0.3),
            ],
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Colors.blue.shade400, Colors.blue.shade600],
                    ),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.lock_outline, color: Colors.white, size: 24),
                ),
                const SizedBox(width: 16),
                const Text(
                  'Đổi mật khẩu',
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                ),
              ],
            ),
            const SizedBox(height: 24),
            Form(
              key: _formKey,
              child: Column(
                children: [
                  _ModernPasswordField(
                    controller: _oldController,
                    label: 'Mật khẩu hiện tại',
                    obscureText: _obscureOld,
                    onToggleVisibility: () => setState(() => _obscureOld = !_obscureOld),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Vui lòng nhập mật khẩu hiện tại';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                  _ModernPasswordField(
                    controller: _newController,
                    label: 'Mật khẩu mới',
                    obscureText: _obscureNew,
                    onToggleVisibility: () => setState(() => _obscureNew = !_obscureNew),
                    validator: _validateNewPassword,
                  ),
                  const SizedBox(height: 16),
                  _ModernPasswordField(
                    controller: _confirmController,
                    label: 'Xác nhận mật khẩu mới',
                    obscureText: _obscureConfirm,
                    onToggleVisibility: () => setState(() => _obscureConfirm = !_obscureConfirm),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Vui lòng xác nhận mật khẩu mới';
                      }
                      final trimmed = value.trim();
                      if (trimmed != _newController.text.trim()) {
                        return 'Mật khẩu xác nhận không khớp';
                      }
                      final message = widget.policyEvaluator(trimmed);
                      if (message != null) {
                        return message;
                      }
                      return null;
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(
                  onPressed: _submitting ? null : () => Navigator.of(context).pop(),
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('Huỷ', style: TextStyle(fontSize: 16)),
                ),
                const SizedBox(width: 12),
                ElevatedButton(
                  onPressed: _submitting ? null : _handleSubmit,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                    backgroundColor: Colors.blue.shade600,
                    foregroundColor: Colors.white,
                  ),
                  child: _submitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Đổi mật khẩu', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}


class _ModernPasswordField extends StatelessWidget {
  const _ModernPasswordField({
    required this.controller,
    required this.label,
    required this.obscureText,
    required this.onToggleVisibility,
    required this.validator,
  });

  final TextEditingController controller;
  final String label;
  final bool obscureText;
  final VoidCallback onToggleVisibility;
  final String? Function(String?) validator;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      obscureText: obscureText,
      validator: validator,
      style: const TextStyle(fontSize: 16),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(color: Colors.grey.shade600),
        filled: true,
        fillColor: Colors.grey.shade50,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: Colors.grey.shade300),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: Colors.grey.shade300),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: Colors.blue.shade400, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: Colors.red, width: 1),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
        suffixIcon: IconButton(
          icon: Icon(
            obscureText ? Icons.visibility_off_outlined : Icons.visibility_outlined,
            color: Colors.grey.shade600,
          ),
          onPressed: onToggleVisibility,
        ),
      ),
    );
  }
}

class _HeaderState extends State<Header> with SingleTickerProviderStateMixin {
  String? _userName;
  String? _userEmail;
  String? _avatarUrl;
  Uint8List? _avatarBytes;
  int? _accountId;
  late AnimationController _notificationController;

  @override
  void initState() {
    super.initState();
    _loadUserInfo();
    _notificationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _notificationController.dispose();
    super.dispose();
  }

  int? _extractAccountId(Map<String, dynamic> payload) {
    dynamic idValue = payload['taiKhoanId'] ?? payload['nguoiDungId'] ?? payload['userId'] ?? payload['id'];
    if (idValue == null && payload['nguoiDung'] is Map<String, dynamic>) {
      idValue = (payload['nguoiDung'] as Map<String, dynamic>)['taiKhoanId'] ??
          (payload['nguoiDung'] as Map<String, dynamic>)['nguoiDungId'];
    }
    if (idValue == null && payload['thanhVien'] is Map<String, dynamic>) {
      idValue = (payload['thanhVien'] as Map<String, dynamic>)['taiKhoanId'] ??
          (payload['thanhVien'] as Map<String, dynamic>)['nguoiDungId'];
    }
    if (idValue == null && payload['user'] is Map<String, dynamic>) {
      final user = payload['user'] as Map<String, dynamic>;
      idValue = user['taiKhoanId'] ?? user['nguoiDungId'] ?? user['id'];
    }
    if (idValue == null && payload['data'] is Map<String, dynamic>) {
      final data = payload['data'];
      if (data is Map<String, dynamic>) {
        return _extractAccountId(data);
      }
      return null;
    }
    if (idValue is String) {
      return int.tryParse(idValue);
    }
    if (idValue is int) {
      return idValue;
    }
    return null;
  }

  String? _passwordPolicyMessage(String password) {
    if (password.length < 8) {
      return 'Mật khẩu phải có ít nhất 8 ký tự';
    }

    final policy = RegExp(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$');
    if (!policy.hasMatch(password)) {
      return 'Mật khẩu phải gồm chữ thường, chữ hoa, số và ký tự đặc biệt';
    }

    return null;
  }

  Future<void> _openChangePasswordDialog() async {
    final accountId = _accountId;
    if (accountId == null) {
      CustomToast.show(
        context,
        message: 'Không xác định được tài khoản. Vui lòng đăng nhập lại.',
        icon: Icons.error_outline,
        isError: true,
      );
      return;
    }

    final result = await showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => _ChangePasswordDialog(
        accountId: accountId,
        policyEvaluator: _passwordPolicyMessage,
      ),
    );

    if (!mounted || result == null) return;

    CustomToast.show(
      context,
      message: result,
      icon: Icons.check_circle_outline,
    );
  }

  String? _resolveAvatarUrl(String? path) {
    if (path == null || path.isEmpty) return null;
    final trimmed = path.trim();
    if (trimmed.startsWith('data:')) {
      return trimmed;
    }
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }

    final base = ApiConstants.baseUrl;
    if (trimmed.startsWith('/')) {
      return '$base$trimmed';
    }
    return '$base/$trimmed';
  }

  Future<void> _loadUserInfo() async {
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

      if (!mounted) return;

      final name = payload['hoTen']?.toString().trim();
      final email = payload['email']?.toString().trim();
      final rawAvatar = payload['anhDaiDien'] ?? payload['anhBia'] ?? payload['avatarUrl'] ?? payload['avatar'];
      final avatarString = rawAvatar?.toString().trim();

      Uint8List? avatarBytes;
      String? avatarUrl;

      if (avatarString != null && avatarString.isNotEmpty) {
        avatarBytes = _decodeBase64Avatar(avatarString);
        if (avatarBytes == null) {
          avatarUrl = _resolveAvatarUrl(avatarString);
        }
      }

      debugPrint('[Header] Loading user info - name: $name, avatarUrl: $avatarUrl, avatarBytes length: ${avatarBytes?.length}');
      
      setState(() {
        _userName = (name == null || name.isEmpty) ? null : name;
        _userEmail = (email == null || email.isEmpty) ? null : email;
        _avatarUrl = (avatarUrl == null || avatarUrl.isEmpty) ? null : avatarUrl;
        _avatarBytes = avatarBytes;
        _accountId = _extractAccountId(payload!);
      });
      
      debugPrint('[Header] Updated state - _avatarUrl: $_avatarUrl, _avatarBytes: ${_avatarBytes?.length}');
    } catch (e) {
      debugPrint('[Header] Failed to load user info: $e');
    }
  }

  Future<void> _openProfileDetail() async {
    final updated = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const ProfileDetailScreen()),
    );

    if (!mounted) return;

    if (updated == true) {
      PaintingBinding.instance.imageCache.clear();
      PaintingBinding.instance.imageCache.clearLiveImages();
      
      setState(() {
        _avatarUrl = null;
        _avatarBytes = null;
      });
      
      await Future.delayed(const Duration(milliseconds: 100));
    }

    await _loadUserInfo();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            flex: 3,
            child: _buildGroupSelector(context),
          ),
          const SizedBox(width: 12),
          _buildNotificationButton(context),
          const SizedBox(width: 12),
          _buildUserDropdown(context),
        ],
      ),
    );
  }

  Widget _buildGroupSelector(BuildContext context) {
    if (widget.isLoading) {
      return Container(
        height: 50,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [Colors.grey.shade100, Colors.grey.shade50],
          ),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.grey.shade200),
        ),
        child: Row(
          children: [
            SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation<Color>(Colors.blue.shade600),
              ),
            ),
            const SizedBox(width: 12),
            Text(
              'Đang tải nhóm...',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: Colors.grey.shade700,
              ),
            ),
          ],
        ),
      );
    }

    if (widget.error != null) {
      return Container(
        height: 50,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [Colors.red.shade50, Colors.red.shade100.withOpacity(0.3)],
          ),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.red.shade300),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: Colors.red.shade100,
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.error_outline, color: Colors.red.shade700, size: 18),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                widget.error!,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: Colors.red.shade800,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            IconButton(
              icon: Icon(Icons.refresh_rounded, size: 20, color: Colors.red.shade700),
              onPressed: widget.onReload,
              style: IconButton.styleFrom(
                backgroundColor: Colors.red.shade100,
                padding: const EdgeInsets.all(6),
              ),
            ),
          ],
        ),
      );
    }

    if (widget.groups.isEmpty) {
      return Container(
        height: 50,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [Colors.grey.shade50, Colors.grey.shade100.withOpacity(0.5)],
          ),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.grey.shade300),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: Colors.grey.shade200,
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.group_outlined, color: Colors.grey.shade600, size: 18),
            ),
            const SizedBox(width: 10),
            Text(
              'Chưa có nhóm nào',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: Colors.grey.shade700,
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [Colors.blue.shade50.withOpacity(0.3), Colors.white],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.blue.shade200.withOpacity(0.5), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: Colors.blue.shade100.withOpacity(0.2),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<GroupSummary>(
          value: widget.selectedGroup,
          isExpanded: true,
          itemHeight: null,
          icon: Icon(Icons.keyboard_arrow_down_rounded, color: Colors.blue.shade700, size: 22),
          dropdownColor: Colors.white,
          borderRadius: BorderRadius.circular(16),
          elevation: 8,
          items: widget.groups.map((group) {
            final role = group.chucVu;
            return DropdownMenuItem<GroupSummary>(
              value: group,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  children: [
                    _buildGroupImage(group),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            group.tenNhom,
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: Colors.black87,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (role != null && role.isNotEmpty) ...[
                            const SizedBox(height: 3),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.blue.shade100,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                role,
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w500,
                                  color: Colors.blue.shade700,
                                ),
                                overflow: TextOverflow.ellipsis,
                                maxLines: 1,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            );
          }).toList(),
          onChanged: (group) {
            if (group != null) {
              widget.onSelected(group);
            }
          },
        ),
      ),
    );
  }

  Widget _buildGroupImage(GroupSummary group) {
    final imageUrl = widget.imageUrlResolver(group);

    Widget buildDefault() {
      return Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [Colors.blue.shade300, Colors.blue.shade600],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(10),
          boxShadow: [
            BoxShadow(
              color: Colors.blue.shade200.withOpacity(0.5),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: const Icon(Icons.group_outlined, color: Colors.white, size: 20),
      );
    }

    if (imageUrl == null || imageUrl.isEmpty) {
      return buildDefault();
    }

    return Container(
      width: 38,
      height: 38,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: Image.network(
          imageUrl,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => buildDefault(),
        ),
      ),
    );
  }

  Widget _buildNotificationButton(BuildContext context) {
    return AnimatedBuilder(
      animation: _notificationController,
      builder: (context, child) {
        return Stack(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: widget.hasUnreadNotifications
                      ? [Colors.orange.shade400, Colors.deepOrange.shade500]
                      : [Colors.blue.shade400, Colors.blue.shade600],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(
                    color: (widget.hasUnreadNotifications ? Colors.orange : Colors.blue)
                        .withOpacity(0.3),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: widget.onNotificationsTap,
                  child: const Center(
                    child: Icon(
                      Icons.notifications_outlined,
                      color: Colors.white,
                      size: 22,
                    ),
                  ),
                ),
              ),
            ),
            if (widget.hasUnreadNotifications)
              Positioned(
                right: 4,
                top: 4,
                child: Transform.scale(
                  scale: 1.0 + (_notificationController.value * 0.2),
                  child: Container(
                    width: 12,
                    height: 12,
                    decoration: BoxDecoration(
                      color: Colors.red.shade500,
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 2),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.red.withOpacity(0.5),
                          blurRadius: 4,
                          spreadRadius: 1,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }

  Widget _buildUserDropdown(BuildContext context) {
    final theme = Theme.of(context);
    final avatar = _avatarUrl;
    final avatarBytes = _avatarBytes;
    final displayName = _userName ?? 'Người dùng';
    final displayEmail = _userEmail ?? '---';
    final avatarKey = avatarBytes != null 
        ? ValueKey('avatar_bytes_${avatarBytes.hashCode}')
        : (avatar != null ? ValueKey('avatar_url_$avatar') : const ValueKey('avatar_none'));

    return PopupMenuButton<_UserAction>(
      tooltip: 'Tài khoản',
      offset: const Offset(0, 16),
      position: PopupMenuPosition.under,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      elevation: 12,
      shadowColor: Colors.black.withOpacity(0.2),
      itemBuilder: (context) {
        return [
          PopupMenuItem<_UserAction>(
            enabled: false,
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    _ModernAvatarBadge(
                      key: avatarKey,
                      avatar: avatar,
                      avatarBytes: avatarBytes,
                      radius: 28,
                      hasGradientBorder: true,
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            displayName,
                            style: theme.textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w700,
                              fontSize: 17,
                              color: Colors.black87,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: Colors.blue.shade50,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              displayEmail,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                                color: Colors.blue.shade700,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const PopupMenuDivider(height: 1),
          PopupMenuItem<_UserAction>(
            value: _UserAction.profile,
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Colors.blue.shade400, Colors.blue.shade600],
                    ),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.edit_outlined, size: 20, color: Colors.white),
                ),
                const SizedBox(width: 12),
                const Text(
                  'Chỉnh sửa profile',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ),
          PopupMenuItem<_UserAction>(
            value: _UserAction.changePassword,
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Colors.purple.shade400, Colors.purple.shade600],
                    ),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.key_outlined, size: 20, color: Colors.white),
                ),
                const SizedBox(width: 12),
                const Text(
                  'Đổi mật khẩu',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ),
          const PopupMenuDivider(height: 1),
          PopupMenuItem<_UserAction>(
            value: _UserAction.logout,
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Colors.red.shade400, Colors.red.shade600],
                    ),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.logout_outlined, size: 20, color: Colors.white),
                ),
                const SizedBox(width: 12),
                const Text(
                  'Đăng xuất',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: Colors.redAccent,
                  ),
                ),
              ],
            ),
          ),
        ];
      },
      onSelected: (action) async {
        switch (action) {
          case _UserAction.profile:
            await _openProfileDetail();
            break;
          case _UserAction.changePassword:
            _openChangePasswordDialog();
            break;
          case _UserAction.logout:
            _handleLogout();
            break;
        }
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [Colors.white, Colors.grey.shade50],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(
            color: Colors.blue.shade200.withOpacity(0.5),
            width: 1.5,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.blue.shade100.withOpacity(0.3),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _ModernAvatarBadge(
              key: avatarKey,
              avatar: avatar,
              avatarBytes: avatarBytes,
              radius: 16,
              hasGradientBorder: true,
            ),
            const SizedBox(width: 6),
            Icon(
              Icons.keyboard_arrow_down_rounded,
              size: 20,
              color: Colors.blue.shade700,
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _handleLogout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return Dialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          child: Container(
            constraints: const BoxConstraints(maxWidth: 400),
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(24),
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Colors.white, Colors.red.shade50.withOpacity(0.3)],
              ),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Colors.red.shade400, Colors.red.shade600],
                    ),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.logout_outlined,
                    color: Colors.white,
                    size: 32,
                  ),
                ),
                const SizedBox(height: 20),
                const Text(
                  'Đăng xuất',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  'Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng?',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.grey.shade700,
                  ),
                ),
                const SizedBox(height: 24),
                Row(
                  children: [
                    Expanded(
                      child: TextButton(
                        onPressed: () => Navigator.of(dialogContext).pop(false),
                        style: TextButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: const Text(
                          'Huỷ',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: () => Navigator.of(dialogContext).pop(true),
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          backgroundColor: Colors.red.shade600,
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: const Text(
                          'Đăng xuất',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );

    if (confirmed != true) return;

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('user_info');
    await prefs.remove('accessToken');
    await prefs.remove('refreshToken');

    if (!mounted) return;

    CustomToast.show(
      context,
      message: 'Đăng xuất thành công.',
      icon: Icons.logout,
    );

    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  Uint8List? _decodeBase64Avatar(String value) {
    try {
      final trimmed = value.trim();
      if (trimmed.startsWith('data:')) {
        final index = trimmed.indexOf(',');
        if (index != -1 && index < trimmed.length - 1) {
          return base64Decode(trimmed.substring(index + 1));
        }
      }

      if (_looksLikeRawBase64(trimmed)) {
        return base64Decode(trimmed);
      }
    } catch (e) {
      debugPrint('[Header] Failed to decode base64 avatar: $e');
    }
    return null;
  }

  bool _looksLikeRawBase64(String value) {
    if (value.length < 20) return false;
    final sanitized = value.replaceAll(RegExp(r'\s'), '');
    if (sanitized.length % 4 != 0) return false;
    final base64Regex = RegExp(r'^[A-Za-z0-9+/=]+$');
    return base64Regex.hasMatch(sanitized);
  }
}

enum _UserAction { profile, changePassword, logout }

class _ModernAvatarBadge extends StatelessWidget {
  const _ModernAvatarBadge({
    super.key,
    this.avatar,
    this.avatarBytes,
    required this.radius,
    this.hasGradientBorder = false,
  });

  final String? avatar;
  final Uint8List? avatarBytes;
  final double radius;
  final bool hasGradientBorder;

  @override
  Widget build(BuildContext context) {
    final placeholder = Container(
      width: radius * 2,
      height: radius * 2,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [Colors.blue.shade300, Colors.blue.shade600],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        shape: BoxShape.circle,
      ),
      child: Icon(
        Icons.person_outline,
        color: Colors.white,
        size: radius * 1.2,
      ),
    );

    Widget avatarWidget = placeholder;

    if (avatarBytes != null && avatarBytes!.isNotEmpty) {
      avatarWidget = Container(
        width: radius * 2,
        height: radius * 2,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          image: DecorationImage(
            image: MemoryImage(avatarBytes!),
            fit: BoxFit.cover,
          ),
        ),
      );
    } else if (avatar != null && avatar!.isNotEmpty) {
      avatarWidget = Container(
        width: radius * 2,
        height: radius * 2,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          image: DecorationImage(
            image: NetworkImage(avatar!),
            fit: BoxFit.cover,
            onError: (_, __) {},
          ),
        ),
      );
    }

    if (!hasGradientBorder) {
      return avatarWidget;
    }

    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [Colors.blue.shade400, Colors.purple.shade400, Colors.pink.shade400],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: Colors.blue.shade200.withOpacity(0.5),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Container(
        padding: const EdgeInsets.all(2),
        decoration: const BoxDecoration(
          color: Colors.white,
          shape: BoxShape.circle,
        ),
        child: avatarWidget,
      ),
    );
  }
}