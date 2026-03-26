import 'dart:convert';
import 'dart:io';

import 'package:file_selector/file_selector.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../constants/api_constants.dart';
import '../../models/profile_specialty.dart';
import '../../models/profile_update_request.dart';
import '../../widgets/custom_toast.dart';

class _EditColors {
  static const background = Color(0xFFF3F4F8);
  static const surface = Colors.white;
  static const primary = Color(0xFF1E3A5F);
  static const accent = Color(0xFF2563EB);
  static const border = Color(0xFFE5E7EB);
  static const textPrimary = Color(0xFF1F2937);
  static const textSecondary = Color(0xFF6B7280);
  static const danger = Color(0xFFDC2626);
}

class ProfileEditScreen extends StatefulWidget {
  const ProfileEditScreen({super.key, required this.initialProfile});

  final Map<String, dynamic> initialProfile;

  @override
  State<ProfileEditScreen> createState() => _ProfileEditScreenState();
}

class _Base64Payload {
  const _Base64Payload({required this.data, this.extension});

  final String data;
  final String? extension;
}

class _ProfileEditScreenState extends State<ProfileEditScreen> {
  final _formKey = GlobalKey<FormState>();
  final _picker = ImagePicker();

  late TextEditingController _nameController;
  late TextEditingController _bioController;
  late TextEditingController _phoneController;
  late TextEditingController _addressController;
  late TextEditingController _dobController;

  String _gender = 'Nam';
  int? _selectedSpecialty;
  List<ProfileSpecialty> _specialties = const [];
  bool _loading = false;
  bool _saving = false;
  File? _selectedFile;
  String? _error;
  String? _existingCover;

  int? _userId;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.initialProfile['hoTen']?.toString() ?? '');
    _bioController = TextEditingController(text: widget.initialProfile['moTaBanThan']?.toString() ?? '');
    _phoneController = TextEditingController(
      text: widget.initialProfile['sdt']?.toString() ?? widget.initialProfile['soDienThoai']?.toString() ?? '',
    );
    _addressController = TextEditingController(text: widget.initialProfile['diaChi']?.toString() ?? '');
    _dobController = TextEditingController(text: _resolveDate(widget.initialProfile['ngaySinh']));
    _gender = _resolveGender(widget.initialProfile['gioiTinh']);
    _selectedSpecialty = _resolveSpecialtyId(widget.initialProfile['chuyenMonId']);
    _existingCover = widget.initialProfile['anhBia']?.toString() ??
        widget.initialProfile['anhDaiDien']?.toString();

    _loadUserId();
    _fetchSpecialties();
  }

  Future<http.MultipartFile?> _prepareCoverFile({required bool hasNewImage}) async {
    try {
      if (hasNewImage && _selectedFile != null) {
        return await http.MultipartFile.fromPath('AnhBia', _selectedFile!.path);
      }

      final existing = _existingCover?.trim();
      if (existing == null || existing.isEmpty) {
        return null;
      }

      final dataPayload = _extractBase64Payload(existing);
      if (dataPayload != null) {
        final bytes = base64Decode(dataPayload.data);
        final extension = dataPayload.extension ?? 'png';
        return http.MultipartFile.fromBytes(
          'AnhBia',
          bytes,
          filename: 'cover.$extension',
        );
      }

      final uri = _resolveCoverUri(existing);
      if (uri == null) {
        return null;
      }

      final client = HttpClient()..badCertificateCallback = (cert, host, port) => true;
      try {
        final request = await client.getUrl(uri);
        final response = await request.close();
        if (response.statusCode != 200) {
          debugPrint('[ProfileEdit] Unable to download existing cover ($uri): ${response.statusCode}');
          return null;
        }

        final bytes = await response.fold<List<int>>(<int>[], (previous, element) {
          previous.addAll(element);
          return previous;
        });

        final fileName = uri.pathSegments.isNotEmpty ? uri.pathSegments.last : 'cover.jpg';
        return http.MultipartFile.fromBytes(
          'AnhBia',
          bytes,
          filename: fileName.isNotEmpty ? fileName : 'cover.jpg',
        );
      } finally {
        client.close(force: true);
      }
    } catch (e) {
      debugPrint('[ProfileEdit] Failed to prepare cover file: $e');
      return null;
    }
  }

  _Base64Payload? _extractBase64Payload(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return null;

    final dataUriRegex = RegExp(r'^data:(image\/[^;]+);base64,(.+)$', caseSensitive: false);
    final dataUriMatch = dataUriRegex.firstMatch(trimmed);
    if (dataUriMatch != null) {
      return _Base64Payload(
        data: dataUriMatch.group(2)!,
        extension: dataUriMatch.group(1)!.split('/').last,
      );
    }

    if (_looksLikeRawBase64(trimmed)) {
      return _Base64Payload(data: trimmed, extension: 'png');
    }

    return null;
  }

  bool _looksLikeRawBase64(String value) {
    if (value.contains('/') || value.contains('http') || value.contains('=')) {
      final sanitized = value.replaceAll(RegExp(r'\s'), '');
      if (sanitized.length % 4 == 0) {
        final base64Regex = RegExp(r'^[A-Za-z0-9+/=]+$');
        if (base64Regex.hasMatch(sanitized)) {
          return true;
        }
      }
      return false;
    }

    if (value.length < 20) return false;
    final sanitized = value.replaceAll(RegExp(r'\s'), '');
    if (sanitized.length % 4 != 0) return false;
    final base64Regex = RegExp(r'^[A-Za-z0-9+/=]+$');
    return base64Regex.hasMatch(sanitized);
  }

  Uri? _resolveCoverUri(String value) {
    try {
      if (value.startsWith('http://') || value.startsWith('https://')) {
        return Uri.parse(value);
      }
      if (value.startsWith('/')) {
        return Uri.parse('${ApiConstants.baseUrl}$value');
      }
      if (value.startsWith('data:')) {
        return null;
      }
      return Uri.parse('${ApiConstants.baseUrl}/$value');
    } catch (_) {
      return null;
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _bioController.dispose();
    _phoneController.dispose();
    _addressController.dispose();
    _dobController.dispose();
    super.dispose();
  }

  String _resolveGender(dynamic value) {
    final text = value?.toString().toLowerCase();
    if (text == null) return 'Nam';
    switch (text) {
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
        return text[0].toUpperCase() + text.substring(1);
    }
  }

  String _resolveDate(dynamic value) {
    if (value == null) return '';
    try {
      final parsed = DateTime.parse(value.toString());
      return DateFormat('yyyy-MM-dd').format(parsed);
    } catch (_) {
      return value.toString();
    }
  }

  int? _resolveSpecialtyId(dynamic value) {
    if (value == null) return null;
    if (value is int) return value;
    return int.tryParse(value.toString());
  }

  Future<void> _loadUserId() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString('user_info');
    if (raw == null || raw.isEmpty) return;

    try {
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
      dynamic idValue = payload?['nguoiDungId'] ?? payload?['userId'] ?? payload?['id'];
      if (idValue == null && payload?['nguoiDung'] is Map<String, dynamic>) {
        idValue = (payload?['nguoiDung'] as Map<String, dynamic>)['nguoiDungId'];
      }
      if (idValue == null && payload?['thanhVien'] is Map<String, dynamic>) {
        idValue = (payload?['thanhVien'] as Map<String, dynamic>)['nguoiDungId'];
      }
      idValue ??= payload?['thanhVienId'] ?? payload?['taiKhoanId'];
      if (idValue is int) {
        _userId = idValue;
      } else {
        _userId = int.tryParse(idValue?.toString() ?? '');
      }
    } catch (_) {
      // ignore errors
    }
  }

  Future<void> _fetchSpecialties() async {
    setState(() {
      _loading = true;
      _error = null;
    });

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
          } else {
            items = decoded['items'] is List ? decoded['items'] as List : const [];
          }
        } else {
          items = const [];
        }

        final list = items
            .whereType<Map>()
            .map((e) => ProfileSpecialty.fromJson(Map<String, dynamic>.from(e)))
            .toList(growable: false);

        setState(() {
          _specialties = list;
          if (_selectedSpecialty == null && list.isNotEmpty) {
            _selectedSpecialty = list.first.id;
          }
          _loading = false;
        });
      } else {
        setState(() {
          _error = 'Không thể tải danh sách chuyên môn (mã ${response.statusCode}).';
          _loading = false;
        });
      }
      client.close();
    } catch (e) {
      setState(() {
        _error = 'Không thể tải danh sách chuyên môn: $e';
        _loading = false;
      });
    }
  }

  Future<void> _pickImageFromGallery() async {
    final picked = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (picked != null) {
      setState(() {
        _selectedFile = File(picked.path);
        _existingCover = null;
      });
    }
  }

  Future<void> _pickImageFromFileSystem() async {
    final typeGroup = XTypeGroup(label: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp']);
    final file = await openFile(acceptedTypeGroups: [typeGroup]);
    if (file != null) {
      setState(() {
        _selectedFile = File(file.path);
        _existingCover = null;
      });
    }
  }

  Future<void> _selectDate() async {
    final initialDate = _dobController.text.isNotEmpty
        ? DateTime.tryParse(_dobController.text) ?? DateTime.now()
        : DateTime(2000, 1, 1);

    final picked = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: DateTime(1950),
      lastDate: DateTime.now(),
    );

    if (picked != null) {
      setState(() {
        _dobController.text = DateFormat('yyyy-MM-dd').format(picked);
      });
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final userId = _userId;
    if (userId == null) {
      CustomToast.show(
        context,
        message: 'Không xác định được người dùng. Vui lòng đăng nhập lại.',
        icon: Icons.error_outline,
        isError: true,
      );
      return;
    }

    setState(() {
      _saving = true;
    });

    try {
      final hasNewImage = _selectedFile != null;
      final updateRequest = ProfileUpdateRequest(
        userId: userId,
        hoTen: _nameController.text.trim(),
        gioiTinh: _gender,
        ngaySinh: _dobController.text.trim(),
        moTaBanThan: _bioController.text.trim(),
        soDienThoai: _phoneController.text.trim(),
        diaChi: _addressController.text.trim(),
        chuyenMonId: _selectedSpecialty,
        anhBia: hasNewImage ? null : _existingCover,
      );

      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('accessToken');

      final uri = Uri.parse('${ApiConstants.baseUrl}${ApiConstants.profileUpdate}/$userId');
      final request = http.MultipartRequest('PUT', uri)
        ..headers['Accept'] = 'application/json';

      if (token != null && token.isNotEmpty) {
        request.headers['Authorization'] = 'Bearer $token';
      }

      final fields = Map<String, dynamic>.from(updateRequest.toJson());
      final coverString = fields.remove('AnhBia')?.toString();
      fields.forEach((key, value) {
        request.fields[key] = value.toString();
      });

      final coverPart = await _prepareCoverFile(hasNewImage: hasNewImage);
      if (coverPart != null) {
        request.files.add(coverPart);
      } else if (coverString != null && coverString.isNotEmpty) {
        request.fields['AnhBia'] = coverString;
      }

      final streamed = await request.send();
      final response = await http.Response.fromStream(streamed);
      debugPrint('[ProfileEdit] Update response ${response.statusCode}: ${response.body}');

      if (response.statusCode == 200 || response.statusCode == 204) {
        if (mounted) {
          CustomToast.show(
            context,
            message: 'Đã cập nhật thông tin cá nhân.',
            icon: Icons.check_circle_outline,
          );
        }

        await _updateStoredProfile(updateRequest, response.body);
        if (!mounted) return;
        Navigator.of(context).pop(true);
      } else {
        if (!mounted) return;
        CustomToast.show(
          context,
          message: 'Cập nhật thất bại (${response.statusCode}): ${response.body}',
          icon: Icons.error_outline,
          isError: true,
        );
      }
    } catch (e) {
      if (!mounted) return;
      CustomToast.show(
        context,
        message: 'Không thể cập nhật hồ sơ: $e',
        icon: Icons.error_outline,
        isError: true,
      );
    } finally {
      if (mounted) {
        setState(() {
          _saving = false;
        });
      }
    }
  }

  Future<void> _updateStoredProfile(ProfileUpdateRequest request, String responseBody) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString('user_info');
      if (raw == null || raw.isEmpty) {
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

      if (payload == null) return;

      final target = payload;

      void applyIfNotNull(String key, dynamic value) {
        if (value != null) {
          target[key] = value;
        }
      }

      applyIfNotNull('hoTen', request.hoTen);
      applyIfNotNull('gioiTinh', request.gioiTinh);
      applyIfNotNull('ngaySinh', request.ngaySinh);
      applyIfNotNull('moTaBanThan', request.moTaBanThan);
      applyIfNotNull('sdt', request.soDienThoai);
      applyIfNotNull('soDienThoai', request.soDienThoai);
      applyIfNotNull('diaChi', request.diaChi);
      applyIfNotNull('chuyenMonId', request.chuyenMonId);
      
      // Try to get avatar from response body first
      try {
        if (responseBody.isNotEmpty) {
          final responseData = jsonDecode(responseBody);
          final avatarFromResponse = responseData['anhBia'] ?? 
              responseData['data']?['anhBia'] ?? 
              responseData['user']?['anhBia'];
          if (avatarFromResponse != null) {
            target['anhBia'] = avatarFromResponse;
            debugPrint('[ProfileEdit] Updated anhBia from response: ${avatarFromResponse.toString().substring(0, 50)}...');
          }
        }
      } catch (e) {
        debugPrint('[ProfileEdit] Could not parse response for avatar: $e');
      }
      
      // Fallback to request avatar if available
      if (request.anhBia != null && request.anhBia!.isNotEmpty && !target.containsKey('anhBia')) {
        target['anhBia'] = request.anhBia;
        debugPrint('[ProfileEdit] Updated anhBia from request');
      }

      if (decoded is Map<String, dynamic>) {
        if (decoded['data'] is Map<String, dynamic>) {
          decoded['data'] = target;
        } else {
          decoded['user'] = target;
        }
        final updatedJson = jsonEncode(decoded);
        await prefs.setString('user_info', updatedJson);
        debugPrint('[ProfileEdit] Saved user_info with anhBia: ${target['anhBia']?.toString().substring(0, 50) ?? 'null'}...');
      }
    } catch (e) {
      debugPrint('[ProfileEdit] Failed to update stored profile: $e');
    }
  }

  Widget _buildAvatarSection() {
    final avatarUrl = widget.initialProfile['anhBia']?.toString() ?? widget.initialProfile['anhDaiDien']?.toString();
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: _EditColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _EditColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 96,
                height: 96,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  color: _EditColors.background,
                  border: Border.all(color: _EditColors.border),
                  image: _selectedFile != null
                      ? DecorationImage(image: FileImage(_selectedFile!), fit: BoxFit.cover)
                      : (avatarUrl != null && avatarUrl.isNotEmpty)
                          ? DecorationImage(image: NetworkImage(_resolveAvatarUrl(avatarUrl)), fit: BoxFit.cover)
                          : null,
                ),
                child: (_selectedFile == null && (avatarUrl == null || avatarUrl.isEmpty))
                    ? Icon(Icons.image_outlined, size: 32, color: _EditColors.textSecondary)
                    : null,
              ),
              const SizedBox(width: 18),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Ảnh bìa',
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: _EditColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Hình ảnh giúp hồ sơ của bạn trông chuyên nghiệp hơn.',
                      style: theme.textTheme.bodySmall?.copyWith(color: _EditColors.textSecondary),
                    ),
                    const SizedBox(height: 14),
                    Wrap(
                      spacing: 12,
                      runSpacing: 8,
                      children: [
                        FilledButton.icon(
                          onPressed: _pickImageFromGallery,
                          style: FilledButton.styleFrom(
                            backgroundColor: _EditColors.accent,
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          ),
                          icon: const Icon(Icons.photo_library_outlined, size: 18),
                          label: const Text('Chọn từ thư viện'),
                        ),
                        OutlinedButton.icon(
                          onPressed: _pickImageFromFileSystem,
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                            side: const BorderSide(color: _EditColors.border),
                          ),
                          icon: const Icon(Icons.upload_file_outlined, size: 18),
                          label: const Text('Tải lên từ máy'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _resolveAvatarUrl(String path) {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    if (path.startsWith('/')) {
      return '${ApiConstants.baseUrl}$path';
    }
    return '${ApiConstants.baseUrl}/$path';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _EditColors.background,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: _EditColors.surface,
        foregroundColor: _EditColors.primary,
        title: const Text('Chỉnh sửa thông tin', style: TextStyle(fontWeight: FontWeight.w600)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
                children: [
                  _buildAvatarSection(),
                  const SizedBox(height: 20),
                  _SectionCard(
                    title: 'Thông tin cá nhân',
                    description: 'Vui lòng cập nhật đầy đủ các trường bên dưới.',
                    children: [
                      _LabeledField(
                        label: 'Họ tên',
                        child: TextFormField(
                          controller: _nameController,
                          decoration: _inputDecoration('Nhập đầy đủ họ tên', prefixIcon: Icons.person_outline),
                          validator: (value) {
                            if (value == null || value.trim().isEmpty) {
                              return 'Vui lòng nhập họ tên';
                            }
                            return null;
                          },
                        ),
                      ),
                      _LabeledField(
                        label: 'Số điện thoại',
                        child: TextFormField(
                          controller: _phoneController,
                          decoration: _inputDecoration('Ví dụ: 0912 345 678', prefixIcon: Icons.phone_outlined),
                          keyboardType: TextInputType.phone,
                          validator: (value) {
                            if (value == null || value.trim().isEmpty) {
                              return 'Vui lòng nhập số điện thoại';
                            }
                            return null;
                          },
                        ),
                      ),
                      _LabeledField(
                        label: 'Địa chỉ',
                        child: TextFormField(
                          controller: _addressController,
                          decoration: _inputDecoration('Số nhà, đường, quận/huyện...', prefixIcon: Icons.home_outlined),
                        ),
                      ),
                      _LabeledField(
                        label: 'Giới tính',
                        child: DropdownButtonFormField<String>(
                          value: _gender,
                          decoration: _inputDecoration(null, prefixIcon: Icons.wc_outlined),
                          items: const [
                            DropdownMenuItem(value: 'Nam', child: Text('Nam')),
                            DropdownMenuItem(value: 'Nữ', child: Text('Nữ')),
                            DropdownMenuItem(value: 'Khác', child: Text('Khác')),
                          ],
                          onChanged: (value) {
                            if (value != null) {
                              setState(() => _gender = value);
                            }
                          },
                        ),
                      ),
                      _LabeledField(
                        label: 'Ngày sinh',
                        child: TextFormField(
                          controller: _dobController,
                          readOnly: true,
                          decoration: _inputDecoration('Chọn ngày sinh', prefixIcon: Icons.calendar_today_outlined).copyWith(
                                suffixIcon: IconButton(
                                  icon: const Icon(Icons.date_range_outlined),
                                  onPressed: _selectDate,
                                ),
                              ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  _SectionCard(
                    title: 'Chuyên môn & Mô tả',
                    description: 'Giúp mọi người hiểu hơn về năng lực của bạn.',
                    children: [
                      _LabeledField(
                        label: 'Chuyên môn',
                        child: DropdownButtonFormField<int>(
                          value: _selectedSpecialty,
                          decoration: _inputDecoration(null, prefixIcon: Icons.school_outlined),
                          items: _specialties
                              .map(
                                (item) => DropdownMenuItem<int>(
                                  value: item.id,
                                  child: Text(item.name),
                                ),
                              )
                              .toList(),
                          onChanged: (value) => setState(() => _selectedSpecialty = value),
                        ),
                      ),
                      _LabeledField(
                        label: 'Mô tả bản thân',
                        child: TextFormField(
                          controller: _bioController,
                          minLines: 4,
                          maxLines: 6,
                          decoration: _inputDecoration('Chia sẻ điểm mạnh, kinh nghiệm của bạn', prefixIcon: Icons.article_outlined)
                              .copyWith(alignLabelWithHint: true),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  _ActionBar(
                    saving: _saving,
                    onCancel: _saving ? null : () => Navigator.of(context).pop(false),
                    onSubmit: _saving ? null : _submit,
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 16),
                    Text(
                      _error!,
                      style: const TextStyle(color: _EditColors.danger, fontWeight: FontWeight.w500),
                    ),
                  ],
                  const SizedBox(height: 8),
                ],
              ),
            ),
    );
  }

  InputDecoration _inputDecoration(String? hint, {required IconData prefixIcon}) {
    return InputDecoration(
      hintText: hint,
      prefixIcon: Icon(prefixIcon, color: _EditColors.textSecondary),
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: _EditColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: _EditColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: _EditColors.accent, width: 1.8),
      ),
      hintStyle: const TextStyle(color: _EditColors.textSecondary, fontSize: 14),
      labelStyle: const TextStyle(color: _EditColors.textSecondary),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.title,
    required this.description,
    required this.children,
  });

  final String title;
  final String description;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      decoration: BoxDecoration(
        color: _EditColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _EditColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
              color: _EditColors.textPrimary,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            description,
            style: theme.textTheme.bodySmall?.copyWith(color: _EditColors.textSecondary, height: 1.5),
          ),
          const SizedBox(height: 20),
          ...children,
        ],
      ),
    );
  }
}

class _LabeledField extends StatelessWidget {
  const _LabeledField({
    required this.label,
    required this.child,
  });

  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: _EditColors.textSecondary,
              letterSpacing: 0.3,
            ),
          ),
          const SizedBox(height: 8),
          child,
        ],
      ),
    );
  }
}

class _ActionBar extends StatelessWidget {
  const _ActionBar({
    required this.saving,
    required this.onCancel,
    required this.onSubmit,
  });

  final bool saving;
  final VoidCallback? onCancel;
  final VoidCallback? onSubmit;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: OutlinedButton(
            onPressed: onCancel,
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 14),
              side: const BorderSide(color: _EditColors.border),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Huỷ'),
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: FilledButton.icon(
            onPressed: onSubmit,
            style: FilledButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 14),
              backgroundColor: _EditColors.accent,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            icon: saving
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.save_outlined, size: 20),
            label: Text(saving ? 'Đang lưu...' : 'Lưu thay đổi'),
          ),
        ),
      ],
    );
  }
}
