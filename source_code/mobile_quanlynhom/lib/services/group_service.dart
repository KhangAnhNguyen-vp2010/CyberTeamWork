import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:http/io_client.dart';
import 'package:http_parser/http_parser.dart';
import 'package:mobile_quanlynhom/constants/api_constants.dart';
import 'package:mobile_quanlynhom/models/group_summary.dart';
import 'package:mobile_quanlynhom/models/project_summary.dart';
import 'package:mobile_quanlynhom/models/project_task.dart';
import 'package:mobile_quanlynhom/models/project_domain.dart';
import 'package:mobile_quanlynhom/models/task_assignment.dart';
import 'package:mobile_quanlynhom/models/task_attachment.dart';
import 'package:mobile_quanlynhom/models/task_comment.dart';
import 'package:mobile_quanlynhom/models/notification_item.dart';
import 'package:mobile_quanlynhom/models/group_member.dart';
import 'package:mobile_quanlynhom/models/member_task_overview.dart';
import 'package:shared_preferences/shared_preferences.dart';

class TaskReminderException implements Exception {
  TaskReminderException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() {
    if (statusCode != null) {
      return 'TaskReminderException($statusCode): $message';
    }
    return 'TaskReminderException: $message';
  }
}

class ReportUploadFile {
  ReportUploadFile({
    required this.bytes,
    required this.fileName,
    this.mimeType,
  });

  final Uint8List bytes;
  final String fileName;
  final String? mimeType;
}

class GroupService {
  GroupService()
    : _baseUrl = ApiConstants.baseUrl,
      _isHttps = ApiConstants.baseUrl.startsWith('https');

  final String _baseUrl;
  final bool _isHttps;

  http.Client get _client {
    if (!_isHttps) return http.Client();

    final httpClient =
        HttpClient()..badCertificateCallback = (cert, host, port) => true;
    return IOClient(httpClient);
  }

  Future<void> deleteTaskAttachment({
    required int taskId,
    required String filePath,
  }) async {
    final client = _client;
    try {
      final encodedPath = Uri.encodeComponent(filePath);
      final url = Uri.parse(
        '$_baseUrl${ApiConstants.taskAttachmentDelete}/$taskId?filePath=$encodedPath',
      );

      final response = await client.delete(
        url,
        headers: {'Accept': 'application/json'},
      );

      if (response.statusCode != 200 && response.statusCode != 204) {
        final snippet =
            response.body.isNotEmpty
                ? response.body.substring(0, response.body.length.clamp(0, 200))
                : '';
        throw http.ClientException(
          'Không xóa được file (mã ${response.statusCode}): $snippet',
          response.request?.url,
        );
      }
    } finally {
      client.close();
    }
  }

  Future<MemberProjectTasksResult> fetchMemberTasks({
    required int projectId,
    required int memberId,
  }) async {
    final client = _client;
    try {
      final url = Uri.parse(
        '$_baseUrl${ApiConstants.memberProjectTasks}/$projectId/$memberId',
      );

      final response = await client.get(
        url,
        headers: const {'Accept': 'application/json'},
      );

      if (response.statusCode == 404) {
        final raw =
            response.bodyBytes.isEmpty ? '' : utf8.decode(response.bodyBytes);
        String? message;
        if (raw.isNotEmpty) {
          try {
            final decoded = jsonDecode(raw);
            if (decoded is Map<String, dynamic>) {
              message = decoded['message']?.toString();
            }
          } catch (_) {
            message = raw;
          }
        }

        return MemberProjectTasksResult(
          message:
              message ??
              'Không tìm thấy công việc nào trong dự án này cho bạn.',
          duAnId: projectId,
          tongSoCongViec: 0,
          danhSachCongViec: const [],
        );
      }

      if (response.statusCode != 200) {
        final snippet =
            response.body.isNotEmpty
                ? response.body.substring(0, response.body.length.clamp(0, 200))
                : '';
        throw http.ClientException(
          'Unexpected status ${response.statusCode}: $snippet',
          response.request?.url,
        );
      }

      final raw = utf8.decode(response.bodyBytes);
      if (raw.isEmpty) {
        throw const FormatException(
          'Empty response when fetching member tasks',
        );
      }

      final decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) {
        return MemberProjectTasksResult.fromJson(decoded);
      }

      throw FormatException(
        'Unexpected response type for member tasks: ${decoded.runtimeType}',
      );
    } finally {
      client.close();
    }
  }

  Future<String> submitMemberProgressReport({
    required int taskId,
    required int memberId,
    required String subTaskId,
    String? noiDung,
    required List<ReportUploadFile> files,
  }) async {
    final trimmedSubTaskId = subTaskId.trim();
    if (trimmedSubTaskId.isEmpty) {
      throw ArgumentError('subTaskId must not be empty');
    }
    final trimmedNote = noiDung?.trim() ?? '';

    final client = _client;
    try {
      final url = Uri.parse('$_baseUrl${ApiConstants.memberProgressReport}');
      final request =
          http.MultipartRequest('POST', url)
            ..headers['Accept'] = 'application/json'
            ..fields['CongViecId'] = taskId.toString()
            ..fields['ThanhVienId'] = memberId.toString()
            ..fields['SubTaskId'] = trimmedSubTaskId
            ..fields['NoiDung'] = trimmedNote;

      for (final file in files) {
        final multipart = http.MultipartFile.fromBytes(
          'Files',
          file.bytes,
          filename: file.fileName,
          contentType:
              file.mimeType != null ? MediaType.parse(file.mimeType!) : null,
        );
        request.files.add(multipart);
      }

      final streamedResponse = await client.send(request);
      final response = await http.Response.fromStream(streamedResponse);
      final message = _parseMessage(response.bodyBytes);

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw http.ClientException(
          message ?? 'Không thể báo cáo tiến độ.',
          response.request?.url,
        );
      }

      return message ?? 'Đã gửi báo cáo tiến độ.';
    } finally {
      client.close();
    }
  }

  Future<String> addSubmissionDate({
    required int taskId,
    required int memberId,
    required DateTime submissionDate,
  }) async {
    final client = _client;
    try {
      final url = Uri.parse('$_baseUrl${ApiConstants.addSubmissionDate}');
      final response = await client.put(
        url,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'CongViecId': taskId,
          'ThanhVienId': memberId,
          'NgayNop': submissionDate.toIso8601String(),
        }),
      );

      final message = _parseMessage(response.bodyBytes);

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw http.ClientException(
          message ?? 'Không thể thêm ngày nộp.',
          response.request?.url,
        );
      }

      return message ?? 'Đã thêm ngày nộp thành công.';
    } finally {
      client.close();
    }
  }

  Future<String> deleteMemberProgressReportFile({
    required int taskId,
    required int memberId,
    required String subTaskId,
    required String fileUrl,
  }) async {
    final client = _client;
    try {
      final url = Uri.parse(
        '$_baseUrl${ApiConstants.memberProgressReportDelete}',
      );
      final headers = await _authenticatedJsonHeaders();
      final payload = jsonEncode({
        'congViecId': taskId,
        'thanhVienId': memberId,
        'subTaskId': subTaskId,
        'fileUrl': fileUrl,
      });

      print('Delete report request: ${url.toString()} with body: $payload');

      final request =
          http.Request('DELETE', url)
            ..headers.addAll(headers)
            ..body = payload;

      final streamed = await client.send(request);
      final response = await http.Response.fromStream(streamed);

      final message = _parseMessage(response.bodyBytes);
      print(
        'Delete report response: status=${response.statusCode}, body=${utf8.decode(response.bodyBytes)}',
      );
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw http.ClientException(
          message ?? 'Không thể xoá file báo cáo.',
          response.request?.url,
        );
      }

      return message ?? 'Đã xoá file báo cáo.';
    } finally {
      client.close();
    }
  }

  Future<void> updateTaskProgress({required int taskId}) async {
    final client = _client;
    try {
      final url = Uri.parse(
        '$_baseUrl/api/CongViec/CapNhatTienDoCongViec/$taskId',
      );

      final response = await client.put(
        url,
        headers: {'Accept': 'application/json'},
      );

      if (response.statusCode != 200 && response.statusCode != 204) {
        debugPrint(
          '[updateTaskProgress] Warning: status ${response.statusCode} for task $taskId',
        );
      }
    } catch (e) {
      debugPrint('[updateTaskProgress] Error for task $taskId: $e');
    } finally {
      client.close();
    }
  }

  Future<String> deleteAssignmentItem({
    required int taskId,
    required int memberId,
    required String subTaskId,
  }) async {
    final trimmedId = subTaskId.trim();
    if (trimmedId.isEmpty) {
      throw ArgumentError('subTaskId must not be empty');
    }

    final client = _client;
    try {
      final url = Uri.parse(
        '$_baseUrl${ApiConstants.taskAssignmentDeleteItem}/$taskId/$memberId/$trimmedId',
      );

      final response = await client.delete(
        url,
        headers: const {'Accept': 'application/json'},
      );

      final message = _parseMessage(response.bodyBytes);

      if (response.statusCode != 200 && response.statusCode != 204) {
        throw http.ClientException(
          message ?? 'Không thể xoá công việc con.',
          response.request?.url,
        );
      }

      return message ?? 'Đã xoá công việc con.';
    } finally {
      client.close();
    }
  }

  Future<List<GroupMember>> fetchGroupMembers({required int groupId}) async {
    final client = _client;
    try {
      final url = Uri.parse(
        '$_baseUrl${ApiConstants.groupMembers}/$groupId/ThanhVien',
      );

      final response = await client.get(
        url,
        headers: const {'Accept': 'application/json'},
      );

      if (response.statusCode != 200) {
        final snippet =
            response.body.isNotEmpty
                ? response.body.substring(0, response.body.length.clamp(0, 200))
                : '';
        throw http.ClientException(
          'Unexpected status ${response.statusCode}: $snippet',
          response.request?.url,
        );
      }

      final raw = utf8.decode(response.bodyBytes);
      if (raw.isEmpty) return const [];

      final decoded = jsonDecode(raw);
      if (decoded is List) {
        return decoded
            .map((item) => GroupMember.fromJson(_ensureMap(item)))
            .toList(growable: false);
      }

      throw FormatException(
        'Unexpected response for group members: ${decoded.runtimeType}',
      );
    } finally {
      client.close();
    }
  }

  Future<String> createAssignmentItem({
    required int taskId,
    required int memberId,
    required String description,
    required DateTime assignedDate,
    required String priority,
  }) async {
    final trimmedDescription = description.trim();
    if (trimmedDescription.isEmpty) {
      throw ArgumentError('description must not be empty');
    }

    final client = _client;
    try {
      final dateString = assignedDate.toIso8601String().split('T').first;
      final url = Uri.parse(
        '$_baseUrl${ApiConstants.taskAssignmentAddItem}/$taskId/$memberId',
      );

      final payload = jsonEncode({
        'subTaskId': 'string',
        'moTa': trimmedDescription,
        'ngayPC': dateString,
        'doUuTien': priority,
        'ketQuaThucHien': <String>[],
        'danhGia': '',
        'tienDoHoanThanh': '0%',
      });

      final response = await client.post(
        url,
        headers: const {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: payload,
      );

      final message = _parseMessage(response.bodyBytes);

      if (response.statusCode != 200 && response.statusCode != 201) {
        throw http.ClientException(
          message ?? 'Không thể thêm công việc con.',
          response.request?.url,
        );
      }

      return message ?? 'Đã thêm công việc con.';
    } finally {
      client.close();
    }
  }

  Future<String> updateAssignmentItem({
    required int taskId,
    required int memberId,
    required String subTaskId,
    required String description,
    required DateTime assignedDate,
    required String priority,
  }) async {
    final trimmedDescription = description.trim();
    if (trimmedDescription.isEmpty) {
      throw ArgumentError('description must not be empty');
    }
    if (subTaskId.trim().isEmpty) {
      throw ArgumentError('subTaskId must not be empty');
    }

    final client = _client;
    try {
      final dateString = assignedDate.toIso8601String().split('T').first;
      final url = Uri.parse(
        '$_baseUrl${ApiConstants.taskAssignmentUpdateItem}/$taskId/$memberId',
      );

      final payload = jsonEncode({
        'subTaskId': subTaskId,
        'moTa': trimmedDescription,
        'ngayPC': dateString,
        'doUuTien': priority,
      });

      final response = await client.put(
        url,
        headers: const {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: payload,
      );

      final message = _parseMessage(response.bodyBytes);

      if (response.statusCode != 200 && response.statusCode != 201) {
        throw http.ClientException(
          message ?? 'Không thể cập nhật công việc con.',
          response.request?.url,
        );
      }

      return message ?? 'Đã cập nhật công việc con.';
    } finally {
      client.close();
    }
  }

  Future<String> deleteTask({required int taskId}) async {
    final client = _client;
    try {
      final url = Uri.parse('$_baseUrl${ApiConstants.taskDelete}/$taskId');

      final response = await client.delete(
        url,
        headers: const {'Accept': 'application/json'},
      );

      final message = _parseMessage(response.bodyBytes);

      if (response.statusCode != 200 && response.statusCode != 204) {
        throw http.ClientException(
          message ?? 'Không thể xoá công việc.',
          response.request?.url,
        );
      }

      return message ?? 'Đã xoá công việc.';
    } finally {
      client.close();
    }
  }

  Future<void> evaluateTaskProgress({
    required int taskId,
    required int memberId,
    required String subTaskId,
    required String rating,
  }) async {
    final client = _client;
    try {
      final url = Uri.parse('$_baseUrl${ApiConstants.taskEvaluation}');

      final payload = jsonEncode({
        'congViecId': taskId,
        'thanhVienId': memberId,
        'subTaskId': subTaskId,
        'danhGia': rating,
      });

      final response = await client.put(
        url,
        headers: const {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: payload,
      );

      if (response.statusCode < 200 || response.statusCode >= 300) {
        final snippet =
            response.body.isNotEmpty
                ? response.body.substring(0, response.body.length.clamp(0, 200))
                : '';
        throw http.ClientException(
          'Unexpected status ${response.statusCode}: $snippet',
          response.request?.url,
        );
      }
    } finally {
      client.close();
    }
  }

  Future<void> updateSubTaskProgress({
    required int taskId,
    required int memberId,
    required String subTaskId,
    required String progress,
  }) async {
    final client = _client;
    try {
      final url = Uri.parse('$_baseUrl${ApiConstants.subTaskProgressUpdate}');

      final payload = jsonEncode({
        'congViecId': taskId,
        'thanhVienId': memberId,
        'subTaskId': subTaskId,
        'tienDoHoanThanh': progress,
      });

      final response = await client.put(
        url,
        headers: const {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: payload,
      );

      if (response.statusCode < 200 || response.statusCode >= 300) {
        final snippet =
            response.body.isNotEmpty
                ? response.body.substring(0, response.body.length.clamp(0, 200))
                : '';
        throw http.ClientException(
          'Unexpected status ${response.statusCode}: $snippet',
          response.request?.url,
        );
      }
    } finally {
      client.close();
    }
  }

  Future<void> toggleLockSubTask({
    required int taskId,
    required int memberId,
    required String subTaskId,
    required int lockState,
  }) async {
    final client = _client;
    try {
      final url = Uri.parse('$_baseUrl/api/PhanCong/ToggleLockSubTask');

      final payload = jsonEncode({
        'congViecId': taskId,
        'thanhVienId': memberId,
        'subTaskId': subTaskId,
        'trangThaiKhoa': lockState,
      });

      final response = await client.put(
        url,
        headers: const {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: payload,
      );

      if (response.statusCode < 200 || response.statusCode >= 300) {
        final snippet =
            response.body.isNotEmpty
                ? response.body.substring(0, response.body.length.clamp(0, 200))
                : '';
        throw http.ClientException(
          'Unexpected status ${response.statusCode}: $snippet',
          response.request?.url,
        );
      }
    } finally {
      client.close();
    }
  }

  Future<List<TaskAssignment>> fetchTaskAssignments({
    required int taskId,
  }) async {
    final client = _client;
    try {
      final url = Uri.parse('$_baseUrl${ApiConstants.taskAssignments}/$taskId');

      final response = await client.get(
        url,
        headers: const {'Accept': 'application/json'},
      );

      if (response.statusCode != 200) {
        final snippet =
            response.body.isNotEmpty
                ? response.body.substring(0, response.body.length.clamp(0, 200))
                : '';
        throw http.ClientException(
          'Unexpected status ${response.statusCode}: $snippet',
          response.request?.url,
        );
      }

      final raw = utf8.decode(response.bodyBytes);
      final decoded = jsonDecode(raw);
      if (decoded is List) {
        return decoded
            .map(
              (item) => TaskAssignment.fromJson(item as Map<String, dynamic>),
            )
            .toList(growable: false);
      }

      throw FormatException(
        'Unexpected response for task assignments: ${decoded.runtimeType}',
      );
    } finally {
      client.close();
    }
  }

  Future<List<TaskComment>> fetchTaskComments({required int taskId}) async {
    final client = _client;
    try {
      final url = Uri.parse('$_baseUrl${ApiConstants.taskComments}/$taskId');

      final response = await client.get(
        url,
        headers: const {'Accept': 'application/json'},
      );

      if (response.statusCode != 200) {
        final snippet =
            response.body.isNotEmpty
                ? response.body.substring(0, response.body.length.clamp(0, 200))
                : '';
        throw http.ClientException(
          'Unexpected status ${response.statusCode}: $snippet',
          response.request?.url,
        );
      }

      final raw = utf8.decode(response.bodyBytes);
      if (raw.isEmpty) return const [];

      final decoded = jsonDecode(raw);
      if (decoded is List) {
        return decoded
            .map((item) => TaskComment.fromJson(_ensureMap(item)))
            .toList(growable: false);
      }

      throw FormatException(
        'Unexpected response for task comments: ${decoded.runtimeType}',
      );
    } finally {
      client.close();
    }
  }

  Future<TaskComment?> createTaskComment({
    required int taskId,
    required int memberId,
    required String content,
  }) async {
    final client = _client;
    try {
      final url = Uri.parse('$_baseUrl${ApiConstants.taskCommentCreate}');

      final payload = jsonEncode({
        'congViecID': taskId,
        'thanhVienID': memberId,
        'noiDung': content,
      });

      final response = await client.post(
        url,
        headers: const {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: payload,
      );

      if (response.statusCode != 200 && response.statusCode != 201) {
        final snippet =
            response.body.isNotEmpty
                ? response.body.substring(0, response.body.length.clamp(0, 200))
                : '';
        throw http.ClientException(
          'Unexpected status ${response.statusCode}: $snippet',
          response.request?.url,
        );
      }

      try {
        return _parseTaskComment(response.bodyBytes);
      } on FormatException catch (e) {
        if (_looksLikeSuccess(e.message)) {
          return null;
        }
        rethrow;
      }
    } finally {
      client.close();
    }
  }

  Future<TaskComment?> updateTaskComment({
    required int commentId,
    required int memberId,
    required String content,
  }) async {
    final client = _client;
    try {
      final url = Uri.parse(
        '$_baseUrl${ApiConstants.taskCommentUpdate}/$commentId',
      );

      final payload = jsonEncode({
        'binhLuanId': commentId,
        'thanhVienID': memberId,
        'noiDung': content,
      });

      final response = await client.put(
        url,
        headers: const {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: payload,
      );

      if (response.statusCode != 200 && response.statusCode != 204) {
        final snippet =
            response.body.isNotEmpty
                ? response.body.substring(0, response.body.length.clamp(0, 200))
                : '';
        throw http.ClientException(
          'Unexpected status ${response.statusCode}: $snippet',
          response.request?.url,
        );
      }

      if (response.statusCode == 204 || response.bodyBytes.isEmpty) {
        return null;
      }

      try {
        return _parseTaskComment(response.bodyBytes);
      } on FormatException catch (e) {
        final message = e.message?.toLowerCase();
        if (message != null && (_looksLikeSuccess(message))) {
          return null;
        }
        rethrow;
      }
    } finally {
      client.close();
    }
  }

  Future<void> deleteTaskComment({required int commentId}) async {
    final client = _client;
    try {
      final url = Uri.parse(
        '$_baseUrl${ApiConstants.taskCommentDelete}/$commentId',
      );

      final response = await client.delete(
        url,
        headers: const {'Accept': 'application/json'},
      );

      if (response.statusCode != 200 && response.statusCode != 204) {
        final snippet =
            response.body.isNotEmpty
                ? response.body.substring(0, response.body.length.clamp(0, 200))
                : '';
        throw http.ClientException(
          'Unexpected status ${response.statusCode}: $snippet',
          response.request?.url,
        );
      }
    } finally {
      client.close();
    }
  }

  Future<List<TaskAttachment>> fetchTaskAttachments({
    required int taskId,
  }) async {
    final client = _client;
    try {
      final url = Uri.parse('$_baseUrl${ApiConstants.taskAttachments}/$taskId');

      final response = await client.get(
        url,
        headers: const {'Accept': 'application/json'},
      );

      if (response.statusCode != 200) {
        final snippet =
            response.body.isNotEmpty
                ? response.body.substring(0, response.body.length.clamp(0, 200))
                : '';
        throw http.ClientException(
          'Unexpected status ${response.statusCode}: $snippet',
          response.request?.url,
        );
      }

      final raw = utf8.decode(response.bodyBytes);
      if (raw.isEmpty) return const [];

      final decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) {
        return TaskAttachmentResponse.fromJson(decoded).files;
      }

      throw FormatException(
        'Unexpected response for task attachments: ${decoded.runtimeType}',
      );
    } finally {
      client.close();
    }
  }

  Future<String> uploadTaskAttachments({
    required int taskId,
    required List<File> files,
  }) async {
    if (files.isEmpty) {
      throw ArgumentError('files must not be empty');
    }

    final client = _client;
    try {
      final url = Uri.parse(
        '$_baseUrl${ApiConstants.taskAttachmentUpload}/$taskId',
      );

      final request = http.MultipartRequest('POST', url)
        ..headers['Accept'] = 'application/json';

      for (final file in files) {
        request.files.add(
          await http.MultipartFile.fromPath('files', file.path),
        );
      }

      final streamed = await client.send(request);
      final response = await http.Response.fromStream(streamed);

      if (response.statusCode != 200 && response.statusCode != 201) {
        final snippet =
            response.body.isNotEmpty
                ? response.body.substring(0, response.body.length.clamp(0, 200))
                : '';
        throw http.ClientException(
          'Unexpected status ${response.statusCode}: $snippet',
          response.request?.url,
        );
      }

      final raw = utf8.decode(response.bodyBytes).trim();
      if (raw.isEmpty) {
        return 'Tải file thành công.';
      }

      try {
        final decoded = jsonDecode(raw);
        if (decoded is Map<String, dynamic>) {
          if (decoded['message'] != null) {
            return decoded['message'].toString();
          }
          if (decoded['data'] is Map<String, dynamic> &&
              decoded['data']['message'] != null) {
            return decoded['data']['message'].toString();
          }
        }
        if (decoded is List && decoded.isNotEmpty) {
          final first = decoded.first;
          if (first is Map<String, dynamic> && first['message'] != null) {
            return first['message'].toString();
          }
        }
      } catch (e) {
        print('[GroupService] Unable to parse upload attachment response: $e');
      }

      return raw;
    } finally {
      client.close();
    }
  }

  Future<String> updateTask({
    required int taskId,
    required String name,
    required int projectId,
    DateTime? startDate,
    DateTime? endDate,
    File? coverImage,
  }) async {
    final client = _client;
    try {
      final url = Uri.parse('$_baseUrl${ApiConstants.taskUpdate}');

      final request =
          http.MultipartRequest('PUT', url)
            ..headers['Accept'] = 'application/json'
            ..fields['CongViecID'] = taskId.toString()
            ..fields['TenCongViec'] = name
            ..fields['DuAnID'] = projectId.toString();

      if (startDate != null) {
        request.fields['NgayBD'] = startDate.toIso8601String();
      }
      if (endDate != null) {
        request.fields['NgayKT'] = endDate.toIso8601String();
      }

      if (coverImage != null) {
        final file = await http.MultipartFile.fromPath(
          'AnhBia',
          coverImage.path,
        );
        request.files.add(file);
      }

      final streamed = await client.send(request);
      final response = await http.Response.fromStream(streamed);

      if (response.statusCode < 200 || response.statusCode >= 300) {
        final snippet =
            response.body.isNotEmpty
                ? response.body.substring(0, response.body.length.clamp(0, 200))
                : '';
        throw http.ClientException(
          'Unexpected status ${response.statusCode}: $snippet',
          response.request?.url,
        );
      }

      final raw = utf8.decode(response.bodyBytes).trim();
      if (raw.isEmpty) {
        return 'Đã cập nhật công việc.';
      }

      try {
        final decoded = jsonDecode(raw);
        if (decoded is Map<String, dynamic>) {
          if (decoded['message'] != null) {
            return decoded['message'].toString();
          }
          if (decoded['data'] is Map<String, dynamic> &&
              decoded['data']['message'] != null) {
            return decoded['data']['message'].toString();
          }
        }
        if (decoded is List && decoded.isNotEmpty) {
          final first = decoded.first;
          if (first is Map<String, dynamic> && first['message'] != null) {
            return first['message'].toString();
          }
        }
      } catch (e) {
        print('[GroupService] Unable to parse update task response: $e');
      }

      return raw;
    } finally {
      client.close();
    }
  }

  Future<ProjectTask> createTask({
    required String name,
    required DateTime? startDate,
    required DateTime? endDate,
    required String status,
    required double progress,
    required int projectId,
    File? coverImage,
  }) async {
    final client = _client;
    try {
      final url = Uri.parse('$_baseUrl${ApiConstants.taskCreate}');

      final request =
          http.MultipartRequest('POST', url)
            ..headers['Accept'] = 'application/json'
            ..fields['TenCongViec'] = name
            ..fields['TrangThai'] = status
            ..fields['PhamTramHoanThanh'] = progress.round().toString()
            ..fields['DuAnID'] = projectId.toString()
            ..fields['TrangThaiKhoa'] = '1';

      if (startDate != null) {
        request.fields['NgayBD'] = startDate.toIso8601String();
      }
      if (endDate != null) {
        request.fields['NgayKT'] = endDate.toIso8601String();
      }

      if (coverImage != null) {
        final file = await http.MultipartFile.fromPath(
          'AnhBia',
          coverImage.path,
        );
        request.files.add(file);
      }

      final streamed = await client.send(request);
      final response = await http.Response.fromStream(streamed);

      if (response.statusCode != 200 && response.statusCode != 201) {
        final snippet =
            response.body.isNotEmpty
                ? response.body.substring(0, response.body.length.clamp(0, 200))
                : '';
        throw http.ClientException(
          'Unexpected status ${response.statusCode}: $snippet',
          response.request?.url,
        );
      }

      final raw = utf8.decode(response.bodyBytes).trim();
      if (raw.isEmpty) {
        throw const FormatException('Empty response when parsing created task');
      }

      try {
        final decoded = jsonDecode(raw);
        if (decoded is Map<String, dynamic>) {
          final data = decoded['data'];
          if (data is Map<String, dynamic>) {
            return ProjectTask.fromJson(data);
          }
          if (decoded.containsKey('congViecId')) {
            return ProjectTask.fromJson(decoded);
          }
        }
        if (decoded is List && decoded.isNotEmpty) {
          final first = decoded.first;
          if (first is Map<String, dynamic>) {
            return ProjectTask.fromJson(first);
          }
        }
        if (decoded is String && decoded.toLowerCase().contains('thành công')) {
          print('[GroupService] Create task success message: $decoded');
        }
      } catch (e) {
        print('[GroupService] Unable to parse create task response: $e');
      }

      print(
        '[GroupService] Falling back to local task model for createTask response.',
      );
      return ProjectTask(
        congViecId: 0,
        tenCongViec: name,
        ngayBd: startDate,
        ngayKt: endDate,
        trangThai: status,
        phamTramHoanThanh: progress,
        anhBia: null,
      );
    } finally {
      client.close();
    }
  }

  Future<List<NotificationItem>> fetchNotifications({
    required int memberId,
  }) async {
    final client = _client;
    try {
      final url = Uri.parse(
        '$_baseUrl${ApiConstants.memberNotifications}/$memberId',
      );

      final response = await client.get(
        url,
        headers: const {'Accept': 'application/json'},
      );

      if (response.statusCode != 200) {
        final snippet =
            response.body.isNotEmpty
                ? response.body.substring(0, response.body.length.clamp(0, 200))
                : '';
        throw http.ClientException(
          'Unexpected status ${response.statusCode}: $snippet',
          response.request?.url,
        );
      }

      final raw = utf8.decode(response.bodyBytes);
      if (raw.isEmpty) return const [];

      final decoded = jsonDecode(raw);
      if (decoded is List) {
        return decoded
            .map((e) => NotificationItem.fromJson(_ensureMap(e)))
            .toList();
      }

      if (decoded is Map<String, dynamic>) {
        final data = decoded['data'];
        if (data is List) {
          return data
              .map((e) => NotificationItem.fromJson(_ensureMap(e)))
              .toList();
        }
      }

      throw FormatException(
        'Unexpected notifications response: ${decoded.runtimeType}',
      );
    } finally {
      client.close();
    }
  }

  Future<void> markNotificationAsRead({
    required int memberId,
    required String notificationId,
  }) async {
    final client = _client;
    try {
      final url = Uri.parse(
        '$_baseUrl${ApiConstants.memberNotificationMarkAsRead}/$memberId/$notificationId',
      );

      final response = await client.put(
        url,
        headers: const {'Accept': 'application/json'},
      );

      if (response.statusCode != 200 && response.statusCode != 204) {
        final snippet =
            response.body.isNotEmpty
                ? response.body.substring(0, response.body.length.clamp(0, 200))
                : '';
        throw http.ClientException(
          'Unexpected status ${response.statusCode}: $snippet',
          response.request?.url,
        );
      }
    } finally {
      client.close();
    }
  }

  Future<String> markAllNotificationsAsRead({required int memberId}) async {
    final client = _client;
    try {
      final url = Uri.parse(
        '$_baseUrl${ApiConstants.notificationsMarkAllRead}/$memberId',
      );

      final response = await client.put(
        url,
        headers: const {'Accept': 'application/json'},
      );

      final message = _parseMessage(response.bodyBytes);

      if (response.statusCode != 200 && response.statusCode != 204) {
        throw http.ClientException(
          message ?? 'Không thể đánh dấu tất cả thông báo.',
          response.request?.url,
        );
      }

      return message ?? 'Đã đánh dấu tất cả thông báo là đã đọc.';
    } finally {
      client.close();
    }
  }

  Future<String> toggleNotificationPin({
    required int memberId,
    required String notificationId,
  }) async {
    final client = _client;
    try {
      final url = Uri.parse(
        '$_baseUrl${ApiConstants.notificationsTogglePin}/$memberId/$notificationId',
      );

      final response = await client.put(
        url,
        headers: const {'Accept': 'application/json'},
      );

      final message = _parseMessage(response.bodyBytes);

      if (response.statusCode != 200 && response.statusCode != 204) {
        throw http.ClientException(
          message ?? 'Không thể thay đổi trạng thái ghim.',
          response.request?.url,
        );
      }

      return message ?? 'Đã thay đổi trạng thái ghim.';
    } finally {
      client.close();
    }
  }

  Future<String> deleteNotification({
    required int memberId,
    required String notificationId,
  }) async {
    final client = _client;
    try {
      final url = Uri.parse(
        '$_baseUrl${ApiConstants.notificationsDelete}/$memberId/$notificationId',
      );

      final response = await client.delete(
        url,
        headers: const {'Accept': 'application/json'},
      );

      final message = _parseMessage(response.bodyBytes);

      if (response.statusCode != 200 && response.statusCode != 204) {
        throw http.ClientException(
          message ?? 'Không thể xoá thông báo.',
          response.request?.url,
        );
      }

      return message ?? 'Đã xoá thông báo.';
    } finally {
      client.close();
    }
  }

  Future<String> remindTaskDeadline({
    required int taskId,
    required String senderEmail,
  }) async {
    final client = _client;
    try {
      final url = Uri.parse('$_baseUrl${ApiConstants.taskReminder}');

      final response = await client.post(
        url,
        headers: const {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'congViecID': taskId, 'mailNguoiGui': senderEmail}),
      );

      final message = _parseMessage(response.bodyBytes);

      if (response.statusCode != 200 && response.statusCode != 201) {
        throw TaskReminderException(
          message ?? 'Nhắc hạn thất bại (mã ${response.statusCode}).',
          statusCode: response.statusCode,
        );
      }

      return message ?? 'Đã gửi nhắc hạn thành công.';
    } finally {
      client.close();
    }
  }

  Future<String> notifyNewAssignment({
    required int taskId,
    required int memberId,
    required String senderEmail,
  }) async {
    final client = _client;
    try {
      final url = Uri.parse('$_baseUrl${ApiConstants.taskAssignmentNotify}');
      final response = await client.post(
        url,
        headers: const {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'congViecID': taskId,
          'thanhVienID': memberId,
          'mailNguoiGui': senderEmail,
        }),
      );

      final message = _parseMessage(response.bodyBytes);

      if (response.statusCode != 200 && response.statusCode != 201) {
        throw http.ClientException(
          message ?? 'Không thể gửi thông báo phân công.',
          response.request?.url,
        );
      }

      return message ?? 'Đã gửi thông báo phân công.';
    } finally {
      client.close();
    }
  }

  Future<String> notifyNewComment({
    required int taskId,
    required int memberId,
    required String content,
  }) async {
    final client = _client;
    try {
      final url = Uri.parse('$_baseUrl${ApiConstants.taskCommentNotify}');
      final response = await client.post(
        url,
        headers: const {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'congViecID': taskId,
          'thanhVienGuiID': memberId,
          'noiDungBinhLuan': content,
        }),
      );

      final message = _parseMessage(response.bodyBytes);

      if (response.statusCode != 200 && response.statusCode != 201) {
        throw http.ClientException(
          message ?? 'Không thể gửi thông báo bình luận.',
          response.request?.url,
        );
      }

      return message ?? 'Đã gửi thông báo bình luận.';
    } finally {
      client.close();
    }
  }

  TaskComment _parseTaskComment(List<int> bodyBytes) {
    final raw = utf8.decode(bodyBytes).trim();
    if (raw.isEmpty) {
      throw const FormatException('Empty response when parsing task comment');
    }

    dynamic decoded;
    try {
      decoded = jsonDecode(raw);
    } catch (e) {
      throw FormatException('Invalid JSON for task comment: $e');
    }

    Map<String, dynamic>? _resolveCommentMap(dynamic value) {
      if (value is Map<String, dynamic>) {
        if (value.containsKey('binhLuanId') || value.containsKey('noiDung')) {
          return value;
        }
        final data = value['data'];
        if (data is Map) {
          return _ensureMap(data);
        }
        final comment = value['binhLuan'] ?? value['comment'];
        if (comment is Map) {
          return _ensureMap(comment);
        }
        if (data is List && data.isNotEmpty) {
          return _ensureMap(data.first);
        }
      }

      if (value is List && value.isNotEmpty) {
        return _ensureMap(value.first);
      }

      return null;
    }

    String? _extractMessage(dynamic value) {
      if (value is Map) {
        final message = value['message'] ?? value['error'] ?? value['detail'];
        if (message is String && message.trim().isNotEmpty) {
          return message.trim();
        }
        final data = value['data'];
        final nested = _extractMessage(data);
        if (nested != null) {
          return nested;
        }
      } else if (value is Iterable) {
        for (final item in value) {
          final message = _extractMessage(item);
          if (message != null) {
            return message;
          }
        }
      }
      return null;
    }

    final resolved = _resolveCommentMap(decoded);
    if (resolved != null) {
      return TaskComment.fromJson(resolved);
    }

    final message = _extractMessage(decoded);
    if (message != null) {
      throw FormatException(message);
    }

    throw FormatException(
      'Unable to parse task comment payload: ${decoded.runtimeType}',
    );
  }

  bool _looksLikeSuccess(String? message) {
    if (message == null || message.trim().isEmpty) {
      return false;
    }
    final normalized = message.toLowerCase();
    return normalized.contains('thành công') || normalized.contains('success');
  }

  String? _parseMessage(List<int> bodyBytes) {
    if (bodyBytes.isEmpty) return null;
    final raw = utf8.decode(bodyBytes).trim();
    if (raw.isEmpty) return null;

    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map && decoded['message'] != null) {
        return decoded['message'].toString();
      }
      if (decoded is String) {
        return decoded;
      }
    } catch (_) {
      // Fallback to raw string below.
    }

    return raw;
  }

  Future<Map<String, String>> _authenticatedJsonHeaders({
    bool includeContentType = true,
  }) async {
    final headers = <String, String>{'Accept': 'application/json'};

    if (includeContentType) {
      headers['Content-Type'] = 'application/json';
    }

    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('accessToken');
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }

    return headers;
  }

  Future<void> updateTaskStatus({
    required int taskId,
    required String status,
  }) async {
    final client = _client;
    try {
      final payload = <String, dynamic>{
        'congViecID': taskId,
        'trangThai': status,
      };

      // Nếu chuyển sang "Đang làm" thì mở khóa (trangThaiKhoa = 0)
      final normalizedStatus = status.trim().toLowerCase();
      if (normalizedStatus == 'đang làm' || normalizedStatus == 'dang lam') {
        payload['trangThaiKhoa'] = 0;
      }

      final response = await client.put(
        Uri.parse('$_baseUrl${ApiConstants.taskUpdateStatus}'),
        headers: const {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: jsonEncode(payload),
      );

      if (response.statusCode != 200) {
        final snippet =
            response.body.isNotEmpty
                ? response.body.substring(0, response.body.length.clamp(0, 200))
                : '';
        throw http.ClientException(
          'Unexpected status ${response.statusCode}: $snippet',
          response.request?.url,
        );
      }
    } finally {
      client.close();
    }
  }

  Future<List<String>> fetchTaskStatuses({required int projectId}) async {
    final client = _client;
    try {
      final url = Uri.parse(
        '$_baseUrl${ApiConstants.taskStatuses}/$projectId/trangthai',
      );

      final response = await client.get(
        url,
        headers: const {'Accept': 'application/json'},
      );

      if (response.statusCode != 200) {
        final snippet =
            response.body.isNotEmpty
                ? response.body.substring(0, response.body.length.clamp(0, 200))
                : '';
        throw http.ClientException(
          'Unexpected status ${response.statusCode}: $snippet',
          response.request?.url,
        );
      }

      final raw = utf8.decode(response.bodyBytes);
      final decoded = jsonDecode(raw);
      if (decoded is List) {
        return decoded.map((e) => e.toString()).toList();
      }

      throw FormatException(
        'Unexpected response for task statuses: ${decoded.runtimeType}',
      );
    } finally {
      client.close();
    }
  }

  Future<String> createTaskStatus({
    required int projectId,
    required String status,
  }) async {
    if (status.trim().isEmpty) {
      throw ArgumentError('status must not be empty');
    }

    final client = _client;
    try {
      final url = Uri.parse(
        '$_baseUrl${ApiConstants.taskStatuses}/$projectId/trangthai',
      );

      final response = await client.post(
        url,
        headers: const {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: jsonEncode(status.trim()),
      );

      final message = _parseMessage(response.bodyBytes);

      if (response.statusCode != 200 && response.statusCode != 201) {
        throw http.ClientException(
          message ?? 'Không thể thêm trạng thái.',
          response.request?.url,
        );
      }

      return message ?? 'Đã thêm trạng thái mới.';
    } finally {
      client.close();
    }
  }

  Future<String> deleteTaskStatus({
    required int projectId,
    required String status,
  }) async {
    final trimmed = status.trim();
    if (trimmed.isEmpty) {
      throw ArgumentError('status must not be empty');
    }

    final client = _client;
    try {
      final encodedStatus = Uri.encodeComponent(trimmed);
      final url = Uri.parse(
        '$_baseUrl${ApiConstants.taskStatuses}/$projectId/trangthai/$encodedStatus',
      );

      final response = await client.delete(
        url,
        headers: const {'Accept': 'application/json'},
      );

      final message = _parseMessage(response.bodyBytes);

      if (response.statusCode != 200 && response.statusCode != 204) {
        throw http.ClientException(
          message ?? 'Không thể xoá trạng thái.',
          response.request?.url,
        );
      }

      return message?.isNotEmpty == true ? message! : 'Đã xoá trạng thái.';
    } finally {
      client.close();
    }
  }

  Future<ProjectTasksPayload> fetchProjectTasks({
    required int projectId,
  }) async {
    final client = _client;
    try {
      final response = await client.get(
        Uri.parse('$_baseUrl${ApiConstants.projectTasks}/$projectId'),
        headers: const {'Accept': 'application/json'},
      );

      if (response.statusCode != 200) {
        final bodySnippet =
            response.body.isNotEmpty
                ? response.body.substring(0, response.body.length.clamp(0, 200))
                : '';
        throw http.ClientException(
          'Unexpected status ${response.statusCode}: $bodySnippet',
          response.request?.url,
        );
      }

      final raw = utf8.decode(response.bodyBytes);
      if (raw.isEmpty) {
        return ProjectTasksPayload(
          duAnId: projectId,
          tenDuAn: '',
          tasks: const [],
        );
      }

      final decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) {
        return ProjectTasksPayload.fromJson(decoded);
      }

      throw FormatException(
        'Unexpected tasks response: ${decoded.runtimeType}',
      );
    } finally {
      client.close();
    }
  }

  Future<List<GroupSummary>> fetchGroups({required int memberId}) async {
    final client = _client;
    try {
      final response = await client.get(
        Uri.parse('$_baseUrl${ApiConstants.memberGroups}/$memberId'),
        headers: const {'Accept': 'application/json'},
      );

      if (response.statusCode != 200) {
        final bodySnippet =
            response.body.isNotEmpty
                ? response.body.substring(0, response.body.length.clamp(0, 200))
                : '';
        throw http.ClientException(
          'Unexpected status ${response.statusCode}: $bodySnippet',
          response.request?.url,
        );
      }

      final raw = utf8.decode(response.bodyBytes);
      if (raw.isEmpty) {
        return const [];
      }

      final decoded = jsonDecode(raw);
      if (decoded is List) {
        return decoded
            .map((e) => GroupSummary.fromJson(_ensureMap(e)))
            .toList();
      }

      if (decoded is Map<String, dynamic>) {
        final data = decoded['data'];

        if (data is List) {
          return data.map((e) => GroupSummary.fromJson(_ensureMap(e))).toList();
        }
        if (decoded.containsKey('nhomId')) {
          return [GroupSummary.fromJson(decoded)];
        }
        throw FormatException(
          'Unexpected map structure: ${decoded.keys.join(', ')}',
        );
      }

      throw FormatException(
        'Unsupported response type: ${decoded.runtimeType}',
      );
    } finally {
      client.close();
    }
  }

  Future<List<ProjectSummary>> fetchProjects({required int groupId}) async {
    final client = _client;
    try {
      final response = await client.get(
        Uri.parse('$_baseUrl${ApiConstants.groupProjects}/$groupId'),
        headers: const {'Accept': 'application/json'},
      );

      if (response.statusCode != 200) {
        final bodySnippet =
            response.body.isNotEmpty
                ? response.body.substring(0, response.body.length.clamp(0, 200))
                : '';
        throw http.ClientException(
          'Unexpected status ${response.statusCode}: $bodySnippet',
          response.request?.url,
        );
      }

      final raw = utf8.decode(response.bodyBytes);
      if (raw.isEmpty) {
        return const [];
      }

      final decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) {
        final projects = decoded['projects'];
        if (projects is List) {
          return projects
              .map((e) => ProjectSummary.fromJson(_ensureMap(e)))
              .toList();
        }
      }

      throw FormatException(
        'Unexpected project response: ${decoded.runtimeType}',
      );
    } finally {
      client.close();
    }
  }

  Future<List<ProjectDomain>> fetchDomains() async {
    final client = _client;
    try {
      final response = await client.get(
        Uri.parse('$_baseUrl${ApiConstants.projectDomains}'),
        headers: const {'Accept': 'application/json'},
      );

      if (response.statusCode != 200) {
        final bodySnippet =
            response.body.isNotEmpty
                ? response.body.substring(0, response.body.length.clamp(0, 200))
                : '';
        throw http.ClientException(
          'Unexpected status ${response.statusCode}: $bodySnippet',
          response.request?.url,
        );
      }

      final raw = utf8.decode(response.bodyBytes);
      if (raw.isEmpty) {
        return const [];
      }

      final decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) {
        final data = decoded['data'];
        if (data is List) {
          return data
              .map((e) => ProjectDomain.fromJson(_ensureMap(e)))
              .toList();
        }
      }

      if (decoded is List) {
        return decoded
            .map((e) => ProjectDomain.fromJson(_ensureMap(e)))
            .toList();
      }

      throw FormatException(
        'Unexpected domain response: ${decoded.runtimeType}',
      );
    } finally {
      client.close();
    }
  }
}

Map<String, dynamic> _ensureMap(Object? value) {
  if (value is Map<String, dynamic>) {
    return value;
  }
  if (value is Map) {
    return value.map((key, dynamic val) => MapEntry(key.toString(), val));
  }
  throw FormatException('Expected map item but found ${value.runtimeType}');
}
