import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:file_selector/file_selector.dart';
import 'package:image_picker/image_picker.dart';
import '../../constants/api_constants.dart';
import '../../models/project_task.dart';
import '../../models/task_attachment.dart';
import '../../models/project_summary.dart';
import '../../services/group_service.dart';
import '../../widgets/custom_toast.dart';
import 'widgets/tasks/task_card.dart';
import 'widgets/tasks/task_controls.dart';
import 'task_assignments_screen.dart';
import 'project_overview_screen.dart';

class TaskDetailsScreen extends StatefulWidget {
  const TaskDetailsScreen({
    super.key,
    required this.project,
    required this.groupId,
    this.isEmbedded = false,
    this.onCreateTask,
  });

  final ProjectSummary project;
  final int groupId;
  final bool isEmbedded;
  final VoidCallback? onCreateTask;

  @override
  State<TaskDetailsScreen> createState() => TaskDetailsScreenState();
}

class TaskDetailsScreenState extends State<TaskDetailsScreen> {
  final GroupService _service = GroupService();
  ProjectTasksPayload? _payload;
  bool _isLoading = false;
  String? _error;
  String _searchQuery = '';
  TaskSortOption _sortOption = TaskSortOption.progressDesc;
  final TextEditingController _searchController = TextEditingController();
  final TextEditingController _createTaskNameController =
      TextEditingController();
  final Set<int> _updatingTaskIds = <int>{};
  final Map<int, List<TaskAttachment>> _attachments = {};
  final Set<int> _attachmentsLoading = {};
  final Map<int, String> _attachmentsError = {};
  final Set<int> _remindingTaskIds = {};
  final Set<int> _uploadingAttachmentIds = {};
  final Set<int> _editingTaskIds = {};
  final Set<int> _deletingTaskIds = {};
  final Set<String> _deletingAttachmentPaths = {};
  bool _isLoadingStatuses = false;
  List<String> _availableStatuses = const [];
  String? _statusError;
  bool _creatingStatus = false;
  String? _deletingStatus;
  DateTime? _lastReminderCheck;

  static const Set<String> _defaultStatuses = {
    'chưa bắt đầu',
    'đang làm',
    'hoàn thành',
    'trễ hạn',
  };

  @override
  void initState() {
    super.initState();
    _loadTasks();
    _loadStatuses();
    if (widget.onCreateTask != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        // Expose _openCreateTaskSheet via callback
      });
    }
  }

  void openCreateTaskSheet() {
    _openCreateTaskSheet();
  }

  bool _isDefaultStatus(String status) {
    return _defaultStatuses.contains(status.trim().toLowerCase());
  }

  Future<void> _deleteStatus(String status) async {
    final trimmed = status.trim();
    if (trimmed.isEmpty || _creatingStatus || _deletingStatus != null) {
      return;
    }

    if (_isDefaultStatus(trimmed)) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Xoá trạng thái'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Bạn có chắc muốn xoá trạng thái "$trimmed"?'),
              const SizedBox(height: 12),
              const Text(
                'Lưu ý: Các công việc có trạng thái này sẽ được chuyển về:\n'
                '• "Chưa bắt đầu" nếu tiến độ = 0%\n'
                '• "Đang làm" nếu tiến độ > 0%',
                style: TextStyle(fontSize: 12, color: Colors.orange),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Huỷ'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: Colors.redAccent),
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: const Text('Xoá'),
            ),
          ],
        );
      },
    );

    if (confirmed != true || !mounted) {
      return;
    }

    setState(() => _deletingStatus = trimmed);

    try {
      final message = await _service.deleteTaskStatus(
        projectId: widget.project.duAnId,
        status: trimmed,
      );
      if (!mounted) return;

      await _loadStatuses();
      if (!mounted) return;

      await _loadTasks();
      if (!mounted) return;

      CustomToast.show(context, message: message, icon: Icons.delete_outline);
    } catch (e) {
      if (!mounted) return;
      CustomToast.show(
        context,
        message: 'Không thể xoá trạng thái: $e',
        icon: Icons.error_outline,
        isError: true,
      );
    } finally {
      if (mounted) {
        setState(() => _deletingStatus = null);
      }
    }
  }

  Future<void> _openAssignments(ProjectTask task) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder:
            (_) => TaskAssignmentsScreen(task: task, groupId: widget.groupId),
      ),
    );

    if (!mounted) return;
    await _loadTasks();
  }

  Future<void> _deleteAttachment(
    ProjectTask task,
    TaskAttachment attachment,
  ) async {
    final filePath = attachment.filePath;
    if (filePath.isEmpty) {
      CustomToast.show(
        context,
        message: 'Không tìm thấy đường dẫn file để xóa.',
        isError: true,
        icon: Icons.error_outline,
      );
      return;
    }

    setState(() {
      _deletingAttachmentPaths.add(filePath);
      _attachmentsError.remove(task.congViecId);
    });

    try {
      await _service.deleteTaskAttachment(
        taskId: task.congViecId,
        filePath: filePath,
      );
      if (!mounted) return;
      CustomToast.show(
        context,
        message: 'Đã xóa file đính kèm.',
        icon: Icons.delete_outline,
      );
      await _loadAttachments(task.congViecId);
    } catch (e) {
      if (!mounted) return;
      CustomToast.show(
        context,
        message: 'Xóa file thất bại: $e',
        isError: true,
        icon: Icons.error_outline,
      );
    } finally {
      if (mounted) {
        setState(() => _deletingAttachmentPaths.remove(filePath));
      }
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    _createTaskNameController.dispose();
    super.dispose();
  }

  Future<void> _loadTasks() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final payload = await _service.fetchProjectTasks(
        projectId: widget.project.duAnId,
      );
      if (!mounted) return;
      setState(() {
        _payload = payload;
        _isLoading = false;
      });

      for (final task in payload.tasks) {
        _loadAttachments(task.congViecId);
      }

      // Tự động check và cập nhật trạng thái
      _autoUpdateTaskStatuses();

      // Tự động nhắc hạn (6 giờ một lần)
      _autoRemindUpcomingDeadlines();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<void> _autoRemindUpcomingDeadlines() async {
    final now = DateTime.now();

    // Kiểm tra đã nhắc trong vòng 6 giờ chưa
    if (_lastReminderCheck != null) {
      final timeSinceLastCheck = now.difference(_lastReminderCheck!);
      if (timeSinceLastCheck.inHours < 6) {
        return; // Chưa đủ 6 giờ
      }
    }

    _lastReminderCheck = now;

    final tasks = _payload?.tasks;
    if (tasks == null || tasks.isEmpty) return;

    final tomorrow = DateTime(now.year, now.month, now.day + 1);
    final dayAfterTomorrow = DateTime(now.year, now.month, now.day + 2);

    for (final task in tasks) {
      final deadline = task.ngayKt;
      if (deadline == null) continue;

      final status = task.trangThai.trim().toLowerCase();
      // Bỏ qua task đã hoàn thành hoặc trễ hạn
      if (status == 'hoàn thành' ||
          status == 'hoan thanh' ||
          status == 'trễ hạn' ||
          status == 'tre han') {
        continue;
      }

      // Kiểm tra deadline vào ngày mai
      final deadlineDate = DateTime(
        deadline.year,
        deadline.month,
        deadline.day,
      );
      if (deadlineDate.isAtSameMomentAs(tomorrow) ||
          (deadlineDate.isAfter(now) &&
              deadlineDate.isBefore(dayAfterTomorrow))) {
        try {
          await _service.remindTaskDeadline(
            taskId: task.congViecId,
            senderEmail: 'system@app.com',
          );
        } catch (e) {
          // Bỏ qua lỗi nhắc nhở
          debugPrint('[AutoReminder] Failed for task ${task.congViecId}: $e');
        }
      }
    }
  }

  Future<void> _autoUpdateTaskStatuses() async {
    final tasks = _payload?.tasks;
    if (tasks == null || tasks.isEmpty) return;

    final now = DateTime.now();
    for (final task in tasks) {
      final currentStatus = task.trangThai.trim().toLowerCase();
      final progress = task.phamTramHoanThanh;
      final deadline = task.ngayKt;

      // 1. Tự động chuyển sang "Trễ hạn" nếu quá deadline
      if (deadline != null && now.isAfter(deadline)) {
        if (currentStatus != 'hoàn thành' &&
            currentStatus != 'hoan thanh' &&
            currentStatus != 'trễ hạn' &&
            currentStatus != 'tre han') {
          await _updateTaskStatus(task, 'Trễ hạn', silent: true);
          continue;
        }
      }

      // 2. Task đạt 100% + tất cả subtasks khóa → Hoàn thành
      if (progress >= 100 &&
          currentStatus != 'hoàn thành' &&
          currentStatus != 'hoan thanh' &&
          currentStatus != 'trễ hạn' &&
          currentStatus != 'tre han') {
        final allSubtasksLocked = await _checkAllSubtasksLocked(
          task.congViecId,
        );
        if (allSubtasksLocked) {
          await _updateTaskStatus(task, 'Hoàn thành', silent: true);
          continue;
        }
      }

      // 3. Task "Hoàn thành" nhưng < 100% → Đang làm
      if ((currentStatus == 'hoàn thành' || currentStatus == 'hoan thanh') &&
          progress < 100) {
        await _updateTaskStatus(task, 'Đang làm', silent: true);
        continue;
      }
    }
  }

  Future<bool> _checkAllSubtasksLocked(int taskId) async {
    try {
      final assignments = await _service.fetchTaskAssignments(taskId: taskId);
      if (assignments.isEmpty) return true; // Không có subtask = OK

      // Kiểm tra tất cả subtasks đã khóa
      for (final assignment in assignments) {
        for (final detail in assignment.noiDungPhanCong) {
          if (detail.trangThaiKhoa != 1) {
            return false; // Có subtask chưa khóa
          }
        }
      }
      return true; // Tất cả đã khóa
    } catch (e) {
      return false; // Lỗi = không cho chuyển
    }
  }

  Future<void> _openProjectOverview() async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder:
            (_) => ProjectOverviewScreen(
              project: widget.project,
              groupId: widget.groupId,
            ),
      ),
    );
    // Reload tasks sau khi quay lại
    _loadTasks();
  }

  Future<void> _loadStatuses() async {
    setState(() => _isLoadingStatuses = true);
    try {
      final statuses = await _service.fetchTaskStatuses(
        projectId: widget.project.duAnId,
      );
      if (!mounted) return;
      setState(() {
        _availableStatuses = statuses;
        _isLoadingStatuses = false;
        _statusError = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _statusError = 'Không tải được trạng thái: $e';
        _isLoadingStatuses = false;
      });
    }
  }

  Future<void> _openAddStatusDialog() async {
    if (_creatingStatus) return;

    final formKey = GlobalKey<FormState>();
    String pendingStatus = '';

    try {
      final result = await showDialog<String>(
        context: context,
        builder: (dialogContext) {
          return AlertDialog(
            title: const Text('Thêm trạng thái'),
            content: Form(
              key: formKey,
              child: TextFormField(
                initialValue: pendingStatus,
                autofocus: true,
                decoration: const InputDecoration(
                  labelText: 'Tên trạng thái',
                  hintText: 'Ví dụ: Đang review',
                ),
                textCapitalization: TextCapitalization.sentences,
                onChanged: (value) => pendingStatus = value,
                validator: (value) {
                  final text = value?.trim() ?? '';
                  if (text.isEmpty) {
                    return 'Vui lòng nhập tên trạng thái';
                  }
                  final exists = _availableStatuses.any(
                    (status) => status.toLowerCase() == text.toLowerCase(),
                  );
                  if (exists) {
                    return 'Trạng thái này đã tồn tại';
                  }
                  return null;
                },
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(),
                child: const Text('Huỷ'),
              ),
              FilledButton(
                onPressed: () {
                  if (formKey.currentState?.validate() ?? false) {
                    Navigator.of(dialogContext).pop(pendingStatus.trim());
                  }
                },
                child: const Text('Thêm'),
              ),
            ],
          );
        },
      );

      if (result != null && result.isNotEmpty) {
        await _createStatus(result);
      }
    } catch (e) {
      CustomToast.show(
        context,
        message: 'Không thể thêm trạng thái: $e',
        icon: Icons.error_outline,
        isError: true,
      );
    }
  }

  Future<void> _createStatus(String status) async {
    if (!mounted) return;

    setState(() => _creatingStatus = true);

    try {
      final message = await _service.createTaskStatus(
        projectId: widget.project.duAnId,
        status: status,
      );
      if (!mounted) return;

      await _loadStatuses();
      if (!mounted) return;

      CustomToast.show(
        context,
        message: message,
        icon: Icons.check_circle_outline,
      );
    } catch (e) {
      if (!mounted) return;
      CustomToast.show(
        context,
        message: 'Không thể thêm trạng thái: $e',
        icon: Icons.error_outline,
        isError: true,
      );
    } finally {
      if (mounted) {
        setState(() => _creatingStatus = false);
      }
    }
  }

  String _statusLabel(String status) {
    final normalized = status.trim();
    final lower = normalized.toLowerCase();
    if (lower.contains('chưa') ||
        lower.contains('not') ||
        lower.contains('bắt đầu')) {
      return 'Chưa bắt đầu';
    }
    if (lower.contains('đang') ||
        lower.contains('doing') ||
        lower.contains('in progress')) {
      return 'Đang làm';
    }
    if (lower.contains('hoàn') ||
        lower.contains('done') ||
        lower.contains('complete')) {
      return 'Hoàn thành';
    }
    return normalized.isEmpty ? 'Trạng thái khác' : normalized;
  }

  String _resolveStatusLabel(String status) {
    final normalized = status.trim();
    if (normalized.isEmpty) {
      return 'Chưa xác định';
    }

    final match = _availableStatuses.firstWhere(
      (value) => value.trim().toLowerCase() == normalized.toLowerCase(),
      orElse: () => '',
    );

    if (match.isNotEmpty) {
      return match.trim();
    }

    return _statusLabel(normalized);
  }

  Future<void> _loadAttachments(int taskId) async {
    setState(() {
      _attachmentsLoading.add(taskId);
      _attachmentsError.remove(taskId);
    });

    try {
      final attachments = await _service.fetchTaskAttachments(taskId: taskId);
      if (!mounted) return;
      setState(() {
        _attachments[taskId] = attachments;
        _attachmentsLoading.remove(taskId);
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _attachmentsError[taskId] = e.toString();
        _attachmentsLoading.remove(taskId);
      });
    }
  }

  Future<void> _updateTaskStatus(
    ProjectTask task,
    String newStatus, {
    bool silent = false,
  }) async {
    // Validate status change
    final currentStatus = task.trangThai.trim().toLowerCase();
    final targetStatus = newStatus.trim().toLowerCase();
    final progress = task.phamTramHoanThanh;

    // Không cho chuyển từ "Trễ hạn" về trạng thái khác
    if (currentStatus == 'trễ hạn' || currentStatus == 'tre han') {
      if (targetStatus != 'trễ hạn' && targetStatus != 'tre han') {
        if (!mounted || silent) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Không thể chuyển task "Trễ hạn" về trạng thái khác'),
            backgroundColor: Colors.red,
          ),
        );
        return;
      }
    }

    // Chỉ cho chuyển về "Chưa bắt đầu" nếu từ "Đang làm" VÀ tiến độ = 0%
    if (targetStatus == 'chưa bắt đầu' || targetStatus == 'chua bat dau') {
      if (currentStatus != 'đang làm' && currentStatus != 'dang lam') {
        if (!mounted || silent) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Chỉ có thể chuyển về "Chưa bắt đầu" từ trạng thái "Đang làm"',
            ),
            backgroundColor: Colors.orange,
          ),
        );
        return;
      }
      if (progress > 0) {
        if (!mounted || silent) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Không thể chuyển về "Chưa bắt đầu". Tiến độ hiện tại: ${progress.toStringAsFixed(1)}% (phải = 0%)',
            ),
            backgroundColor: Colors.orange,
          ),
        );
        return;
      }
    }

    // Từ "Chưa bắt đầu" chỉ cho chuyển sang "Đang làm"
    if (currentStatus == 'chưa bắt đầu' || currentStatus == 'chua bat dau') {
      if (targetStatus != 'đang làm' && targetStatus != 'dang lam') {
        if (!mounted || silent) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Từ "Chưa bắt đầu" chỉ có thể chuyển sang "Đang làm"',
            ),
            backgroundColor: Colors.orange,
          ),
        );
        return;
      }
    }

    // Cho phép chuyển từ "Hoàn thành" về "Đang làm" nếu tiến độ < 100%
    if (currentStatus == 'hoàn thành' || currentStatus == 'hoan thanh') {
      if (targetStatus != 'đang làm' && targetStatus != 'dang lam') {
        if (!mounted || silent) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Chỉ có thể chuyển công việc "Hoàn thành" về "Đang làm"',
            ),
            backgroundColor: Colors.orange,
          ),
        );
        return;
      }

      // Kiểm tra tiến độ phải < 100% mới được về "Đang làm"
      if (progress >= 100) {
        if (!mounted || silent) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Không thể chuyển về "Đang làm". Tiến độ hiện tại: ${progress.toStringAsFixed(1)}% (phải < 100%)',
            ),
            backgroundColor: Colors.orange,
          ),
        );
        return;
      }
    }

    // Chuyển sang "Hoàn thành" phải có tiến độ 100% VÀ tất cả subtasks khóa
    if (targetStatus == 'hoàn thành' || targetStatus == 'hoan thanh') {
      if (progress < 100) {
        if (!mounted || silent) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Không thể chuyển sang "Hoàn thành". Tiến độ hiện tại: ${progress.toStringAsFixed(1)}% (cần 100%)',
            ),
            backgroundColor: Colors.orange,
          ),
        );
        return;
      }

      // Kiểm tra tất cả subtasks đã khóa
      final allSubtasksLocked = await _checkAllSubtasksLocked(task.congViecId);
      if (!allSubtasksLocked) {
        if (!mounted || silent) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Không thể chuyển sang "Hoàn thành". Vẫn còn subtask chưa khóa',
            ),
            backgroundColor: Colors.orange,
          ),
        );
        return;
      }

      // Kiểm tra không phải trễ hạn
      if (currentStatus == 'trễ hạn' || currentStatus == 'tre han') {
        if (!mounted || silent) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Không thể chuyển task "Trễ hạn" sang "Hoàn thành"'),
            backgroundColor: Colors.orange,
          ),
        );
        return;
      }
    }

    // Chuyển sang "Trễ hạn" phải kiểm tra deadline
    if (targetStatus == 'trễ hạn' || targetStatus == 'tre han') {
      final deadline = task.ngayKt;
      if (deadline == null || DateTime.now().isBefore(deadline)) {
        if (!mounted || silent) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Không thể chuyển sang "Trễ hạn". Công việc chưa quá hạn',
            ),
            backgroundColor: Colors.orange,
          ),
        );
        return;
      }
    }

    setState(() => _updatingTaskIds.add(task.congViecId));
    try {
      await _service.updateTaskStatus(
        taskId: task.congViecId,
        status: newStatus,
      );
      if (!mounted) return;
      setState(() {
        final payload = _payload;
        if (payload != null) {
          final updatedTasks = payload.tasks
              .map(
                (item) =>
                    item.congViecId == task.congViecId
                        ? item.copyWith(trangThai: newStatus)
                        : item,
              )
              .toList(growable: false);
          _payload = payload.copyWith(tasks: updatedTasks);
        }
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Lỗi: $e')));
    } finally {
      if (mounted) {
        setState(() => _updatingTaskIds.remove(task.congViecId));
      }
    }
  }

  Future<void> _sendReminder(ProjectTask task) async {
    setState(() => _remindingTaskIds.add(task.congViecId));
    try {
      final message = await _service.remindTaskDeadline(
        taskId: task.congViecId,
        senderEmail: 'system@app.com',
      );
      if (!mounted) return;
      CustomToast.show(
        context,
        message: message,
        icon: Icons.check_circle_outline,
      );
    } catch (e) {
      if (!mounted) return;
      final errorMessage =
          e is TaskReminderException ? e.message : e.toString();
      CustomToast.show(
        context,
        message: 'Lỗi: $errorMessage',
        isError: true,
        icon: Icons.error_outline,
      );
    } finally {
      if (mounted) {
        setState(() => _remindingTaskIds.remove(task.congViecId));
      }
    }
  }

  Future<void> _addAttachments(ProjectTask task) async {
    final typeGroup = const XTypeGroup(label: 'files');
    final selected = await openFiles(acceptedTypeGroups: [typeGroup]);
    if (selected.isEmpty) {
      return;
    }

    final selectedFiles =
        selected
            .where((file) => file.path != null && file.path!.isNotEmpty)
            .map((file) => File(file.path!))
            .toList();

    if (selectedFiles.isEmpty) {
      if (!mounted) return;
      CustomToast.show(
        context,
        message: 'Không lấy được đường dẫn file. Vui lòng thử lại.',
        isError: true,
        icon: Icons.error_outline,
      );
      return;
    }

    setState(() {
      _uploadingAttachmentIds.add(task.congViecId);
      _attachmentsError.remove(task.congViecId);
    });

    try {
      final message = await _service.uploadTaskAttachments(
        taskId: task.congViecId,
        files: selectedFiles,
      );
      if (!mounted) return;
      CustomToast.show(
        context,
        message: message.isEmpty ? 'Đã tải file thành công.' : message,
        icon: Icons.cloud_upload_outlined,
      );
      await _loadAttachments(task.congViecId);
    } catch (e) {
      if (!mounted) return;
      CustomToast.show(
        context,
        message: 'Tải file thất bại: $e',
        isError: true,
        icon: Icons.error_outline,
      );
    } finally {
      if (mounted) {
        setState(() => _uploadingAttachmentIds.remove(task.congViecId));
      }
    }
  }

  ImageProvider? _buildImageProvider(String? imagePath) {
    if (imagePath == null || imagePath.isEmpty) {
      return null;
    }
    if (imagePath.startsWith('http')) {
      return NetworkImage(imagePath);
    }
    final base = ApiConstants.baseUrl;
    final normalized =
        imagePath.startsWith('/') ? '$base$imagePath' : '$base/$imagePath';
    return NetworkImage(normalized);
  }

  Future<void> _confirmDeleteTask(ProjectTask task) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Xoá công việc'),
          content: Text(
            'Bạn có chắc muốn xoá công việc "${task.tenCongViec}"? Hành động này không thể hoàn tác.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Huỷ'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: Colors.redAccent),
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: const Text('Xoá'),
            ),
          ],
        );
      },
    );

    if (result == true) {
      await _deleteTask(task);
    }
  }

  Future<void> _deleteTask(ProjectTask task) async {
    // Kiểm tra xem task đã hoàn thành hoặc tiến độ >= 100%
    if (task.trangThai.toLowerCase() == 'hoàn thành' ||
        task.phamTramHoanThanh >= 100) {
      await showDialog<void>(
        context: context,
        builder: (dialogContext) {
          return AlertDialog(
            title: const Text('Không thể xoá'),
            content: const Text(
              'Không thể xoá công việc đã hoàn thành hoặc đạt 100% tiến độ.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(),
                child: const Text('Đóng'),
              ),
            ],
          );
        },
      );
      return;
    }

    if (mounted) {
      setState(() => _deletingTaskIds.add(task.congViecId));
    }

    try {
      final message = await _service.deleteTask(taskId: task.congViecId);
      if (!mounted) return;

      await _loadTasks();
      if (!mounted) return;

      CustomToast.show(context, message: message, icon: Icons.delete_outline);
    } catch (e) {
      if (!mounted) return;
      CustomToast.show(
        context,
        message: e.toString(),
        isError: true,
        icon: Icons.error_outline,
      );
    } finally {
      if (mounted) {
        setState(() => _deletingTaskIds.remove(task.congViecId));
      }
    }
  }

  Future<void> _openEditTaskSheet(ProjectTask task) async {
    final formKey = GlobalKey<FormState>();
    final nameController = TextEditingController(text: task.tenCongViec);
    final DateTime? projectStart = widget.project.ngayBd;
    final DateTime? projectEnd = widget.project.ngayKt;
    DateTime? startDate = task.ngayBd;
    DateTime? endDate = task.ngayKt;
    final picker = ImagePicker();
    XFile? selectedImage;
    bool isSubmitting = false;
    String? submitError;

    String? projectRangeText;
    if (projectStart != null && projectEnd != null) {
      projectRangeText =
          '${_formatShortDate(projectStart)} - ${_formatShortDate(projectEnd)}';
    } else if (projectStart != null) {
      projectRangeText = 'Từ ${_formatShortDate(projectStart)}';
    } else if (projectEnd != null) {
      projectRangeText = 'Đến ${_formatShortDate(projectEnd)}';
    }

    bool isWithinProjectRange(DateTime date) {
      if (projectStart != null && date.isBefore(projectStart)) {
        return false;
      }
      if (projectEnd != null && date.isAfter(projectEnd)) {
        return false;
      }
      return true;
    }

    Future<void> pickDate({
      required bool isStart,
      required void Function(void Function()) setModalState,
    }) async {
      final fallbackFirst = DateTime(2000);
      final fallbackLast = DateTime(2100);
      DateTime firstBound = projectStart ?? fallbackFirst;
      DateTime lastBound = projectEnd ?? fallbackLast;

      if (projectStart != null &&
          projectEnd != null &&
          projectStart.isAfter(projectEnd)) {
        firstBound = fallbackFirst;
        lastBound = fallbackLast;
      }

      if (!isStart) {
        firstBound = startDate ?? firstBound;
      }

      if (firstBound.isAfter(lastBound)) {
        firstBound = fallbackFirst;
        lastBound = fallbackLast;
      }

      DateTime initial =
          isStart
              ? (startDate ?? DateTime.now())
              : (endDate ?? startDate ?? DateTime.now());
      if (initial.isBefore(firstBound)) {
        initial = firstBound;
      }
      if (initial.isAfter(lastBound)) {
        initial = lastBound;
      }

      final picked = await showDatePicker(
        context: context,
        initialDate: initial,
        firstDate: firstBound,
        lastDate: lastBound,
      );
      if (picked != null) {
        setModalState(() {
          if (isStart) {
            startDate = picked;
            if (endDate != null && endDate!.isBefore(startDate!)) {
              endDate = picked;
            }
          } else {
            endDate = picked;
          }
        });
      }
    }

    Future<void> pickImage(void Function(void Function()) setModalState) async {
      final result = await picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 80,
      );
      if (result != null) {
        setModalState(() => selectedImage = result);
      }
    }

    Map<String, dynamic>? updateResult;
    try {
      updateResult = await showModalBottomSheet<Map<String, dynamic>>(
        context: context,
        isScrollControlled: true,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        backgroundColor: const Color(0xFFF9FBFF),
        builder: (modalContext) {
          return StatefulBuilder(
            builder: (context, setModalState) {
              final bottomInset = MediaQuery.of(context).viewInsets.bottom;
              final currentImageProvider =
                  selectedImage != null
                      ? FileImage(File(selectedImage!.path))
                      : _buildImageProvider(task.anhBia);
              final hasSelectedImage = selectedImage != null;

              return Padding(
                padding: EdgeInsets.only(bottom: bottomInset),
                child: DecoratedBox(
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.vertical(
                      top: Radius.circular(24),
                    ),
                  ),
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
                    child: Form(
                      key: formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 48,
                                height: 48,
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF1F6FF),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: const Icon(
                                  Icons.edit_note_rounded,
                                  color: Color(0xFF1D4ED8),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  'Chỉnh sửa công việc',
                                  style: Theme.of(context).textTheme.titleMedium
                                      ?.copyWith(fontWeight: FontWeight.w700),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 20),
                          TextFormField(
                            controller: nameController,
                            textInputAction: TextInputAction.next,
                            decoration: const InputDecoration(
                              labelText: 'Tên công việc',
                              border: OutlineInputBorder(),
                            ),
                            validator: (value) {
                              if (value == null || value.trim().isEmpty) {
                                return 'Vui lòng nhập tên công việc';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 16),
                          Row(
                            children: [
                              Expanded(
                                child: OutlinedButton.icon(
                                  onPressed:
                                      isSubmitting
                                          ? null
                                          : () => pickDate(
                                            isStart: true,
                                            setModalState: setModalState,
                                          ),
                                  icon: const Icon(
                                    Icons.calendar_today,
                                    size: 18,
                                  ),
                                  label: Text(
                                    startDate != null
                                        ? _formatShortDate(startDate!)
                                        : 'Ngày bắt đầu',
                                  ),
                                  style: OutlinedButton.styleFrom(
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 14,
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: OutlinedButton.icon(
                                  onPressed:
                                      isSubmitting
                                          ? null
                                          : () => pickDate(
                                            isStart: false,
                                            setModalState: setModalState,
                                          ),
                                  icon: const Icon(
                                    Icons.event_available,
                                    size: 18,
                                  ),
                                  label: Text(
                                    endDate != null
                                        ? _formatShortDate(endDate!)
                                        : 'Ngày kết thúc',
                                  ),
                                  style: OutlinedButton.styleFrom(
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 14,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          if (projectRangeText != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 8),
                              child: Text(
                                'Thời gian dự án: $projectRangeText',
                                style: Theme.of(
                                  context,
                                ).textTheme.bodySmall?.copyWith(
                                  color: const Color(0xFF2563EB),
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          if (startDate != null &&
                              endDate != null &&
                              endDate!.isBefore(startDate!))
                            Padding(
                              padding: const EdgeInsets.only(top: 8),
                              child: Text(
                                'Ngày kết thúc phải sau ngày bắt đầu',
                                style: TextStyle(
                                  color: Theme.of(context).colorScheme.error,
                                ),
                              ),
                            ),
                          if (startDate != null &&
                              !isWithinProjectRange(startDate!))
                            Padding(
                              padding: const EdgeInsets.only(top: 8),
                              child: Text(
                                projectRangeText != null
                                    ? 'Ngày bắt đầu phải nằm trong khoảng $projectRangeText.'
                                    : 'Ngày bắt đầu phải nằm trong thời gian của dự án.',
                                style: TextStyle(
                                  color: Theme.of(context).colorScheme.error,
                                ),
                              ),
                            ),
                          if (endDate != null &&
                              !isWithinProjectRange(endDate!))
                            Padding(
                              padding: const EdgeInsets.only(top: 8),
                              child: Text(
                                projectRangeText != null
                                    ? 'Ngày kết thúc phải nằm trong khoảng $projectRangeText.'
                                    : 'Ngày kết thúc phải nằm trong thời gian của dự án.',
                                style: TextStyle(
                                  color: Theme.of(context).colorScheme.error,
                                ),
                              ),
                            ),
                          const SizedBox(height: 16),
                          Text(
                            'Ảnh bìa (không bắt buộc)',
                            style: Theme.of(context).textTheme.bodyMedium
                                ?.copyWith(fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(height: 8),
                          GestureDetector(
                            onTap:
                                isSubmitting
                                    ? null
                                    : () => pickImage(setModalState),
                            child: Container(
                              width: double.infinity,
                              height: 160,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(
                                  color:
                                      (hasSelectedImage ||
                                              currentImageProvider != null)
                                          ? const Color(0xFFBFDBFE)
                                          : const Color(0xFFB6CCFF),
                                  width: 1.2,
                                ),
                                color:
                                    (hasSelectedImage ||
                                            currentImageProvider != null)
                                        ? Colors.white
                                        : const Color(0xFFEAF2FF),
                                image:
                                    currentImageProvider != null
                                        ? DecorationImage(
                                          image: currentImageProvider,
                                          fit: BoxFit.cover,
                                        )
                                        : null,
                              ),
                              child:
                                  hasSelectedImage
                                      ? Align(
                                        alignment: Alignment.topRight,
                                        child: Padding(
                                          padding: const EdgeInsets.all(8.0),
                                          child: CircleAvatar(
                                            radius: 18,
                                            backgroundColor: Colors.black54,
                                            child: IconButton(
                                              icon: const Icon(
                                                Icons.close,
                                                size: 18,
                                                color: Colors.white,
                                              ),
                                              onPressed:
                                                  isSubmitting
                                                      ? null
                                                      : () => setModalState(
                                                        () =>
                                                            selectedImage =
                                                                null,
                                                      ),
                                            ),
                                          ),
                                        ),
                                      )
                                      : Column(
                                        mainAxisAlignment:
                                            MainAxisAlignment.center,
                                        children: const [
                                          Icon(
                                            Icons.add_a_photo_outlined,
                                            size: 36,
                                            color: Color(0xFF1D4ED8),
                                          ),
                                          SizedBox(height: 8),
                                          Text(
                                            'Chọn ảnh bìa (tùy chọn)',
                                            style: TextStyle(
                                              color: Color(0xFF1D4ED8),
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                          SizedBox(height: 4),
                                          Text(
                                            'Không chọn sẽ giữ ảnh hiện tại',
                                            style: TextStyle(
                                              color: Color(0xFF1D4ED8),
                                              fontSize: 12,
                                            ),
                                          ),
                                        ],
                                      ),
                            ),
                          ),
                          const SizedBox(height: 16),
                          if (submitError != null)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: Text(
                                submitError!,
                                style: Theme.of(
                                  context,
                                ).textTheme.bodyMedium?.copyWith(
                                  color: Theme.of(context).colorScheme.error,
                                ),
                              ),
                            ),
                          Row(
                            children: [
                              Expanded(
                                child: OutlinedButton(
                                  onPressed:
                                      isSubmitting
                                          ? null
                                          : () => Navigator.of(context).pop(),
                                  child: const Text('Hủy'),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: ElevatedButton(
                                  onPressed:
                                      isSubmitting
                                          ? null
                                          : () async {
                                            FocusScope.of(context).unfocus();
                                            if (!(formKey.currentState
                                                    ?.validate() ??
                                                false)) {
                                              return;
                                            }
                                            if (startDate != null &&
                                                !isWithinProjectRange(
                                                  startDate!,
                                                )) {
                                              setModalState(() {
                                                submitError =
                                                    projectRangeText != null
                                                        ? 'Ngày bắt đầu phải nằm trong khoảng $projectRangeText.'
                                                        : 'Ngày bắt đầu phải nằm trong thời gian của dự án.';
                                              });
                                              return;
                                            }
                                            if (endDate != null &&
                                                !isWithinProjectRange(
                                                  endDate!,
                                                )) {
                                              setModalState(() {
                                                submitError =
                                                    projectRangeText != null
                                                        ? 'Ngày kết thúc phải nằm trong khoảng $projectRangeText.'
                                                        : 'Ngày kết thúc phải nằm trong thời gian của dự án.';
                                              });
                                              return;
                                            }
                                            if (startDate != null &&
                                                endDate != null &&
                                                endDate!.isBefore(startDate!)) {
                                              setModalState(() {
                                                submitError =
                                                    'Ngày kết thúc phải sau ngày bắt đầu.';
                                              });
                                              return;
                                            }

                                            setModalState(() {
                                              submitError = null;
                                              isSubmitting = true;
                                            });

                                            try {
                                              final message = await _service
                                                  .updateTask(
                                                    taskId: task.congViecId,
                                                    name:
                                                        nameController.text
                                                            .trim(),
                                                    projectId:
                                                        widget.project.duAnId,
                                                    startDate: startDate,
                                                    endDate: endDate,
                                                    coverImage:
                                                        selectedImage != null
                                                            ? File(
                                                              selectedImage!
                                                                  .path,
                                                            )
                                                            : null,
                                                  );
                                              if (!mounted) return;
                                              Navigator.of(context).pop({
                                                'success': true,
                                                'message': message,
                                              });
                                            } catch (e) {
                                              if (!mounted) return;
                                              setModalState(() {
                                                isSubmitting = false;
                                                submitError = e.toString();
                                              });
                                            }
                                          },
                                  child:
                                      isSubmitting
                                          ? const SizedBox(
                                            width: 22,
                                            height: 22,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2.5,
                                              valueColor:
                                                  AlwaysStoppedAnimation<Color>(
                                                    Colors.white,
                                                  ),
                                            ),
                                          )
                                          : const Text('Lưu thay đổi'),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            },
          );
        },
      );
    } catch (e) {
      nameController.dispose();
      rethrow;
    }

    await Future.delayed(const Duration(milliseconds: 350));
    nameController.dispose();

    if (updateResult != null && updateResult['success'] == true) {
      final message =
          (updateResult['message']?.toString().trim().isNotEmpty ?? false)
              ? updateResult['message'].toString()
              : 'Đã cập nhật công việc.';
      if (!mounted) return;

      await _loadTasks();
      if (!mounted) return;

      CustomToast.show(
        context,
        message: message,
        icon: Icons.check_circle_outline,
      );
    }
  }

  Future<void> _openCreateTaskSheet() async {
    final formKey = GlobalKey<FormState>();
    final nameController = _createTaskNameController;
    nameController.text = '';
    final DateTime? projectStart = widget.project.ngayBd;
    final DateTime? projectEnd = widget.project.ngayKt;
    DateTime? startDate;
    DateTime? endDate;
    const String status = 'Chưa bắt đầu';
    const double defaultProgress = 0;
    String? projectRangeText;
    if (projectStart != null && projectEnd != null) {
      projectRangeText =
          '${_formatShortDate(projectStart)} - ${_formatShortDate(projectEnd)}';
    } else if (projectStart != null) {
      projectRangeText = 'Từ ${_formatShortDate(projectStart)}';
    } else if (projectEnd != null) {
      projectRangeText = 'Đến ${_formatShortDate(projectEnd)}';
    }
    XFile? selectedImage;
    bool isSubmitting = false;
    String? submitError;
    final picker = ImagePicker();

    bool? created;
    try {
      created = await showModalBottomSheet<bool>(
        context: context,
        isScrollControlled: true,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        backgroundColor: const Color(0xFFF9FBFF),
        builder: (modalContext) {
          return StatefulBuilder(
            builder: (context, setModalState) {
              bool isWithinProjectRange(DateTime date) {
                if (projectStart != null && date.isBefore(projectStart)) {
                  return false;
                }
                if (projectEnd != null && date.isAfter(projectEnd)) {
                  return false;
                }
                return true;
              }

              Future<void> pickDate({required bool isStart}) async {
                final fallbackFirst = DateTime(2000);
                final fallbackLast = DateTime(2100);
                DateTime firstBound = projectStart ?? fallbackFirst;
                DateTime lastBound = projectEnd ?? fallbackLast;

                if (projectStart != null &&
                    projectEnd != null &&
                    projectStart.isAfter(projectEnd)) {
                  firstBound = fallbackFirst;
                  lastBound = fallbackLast;
                }

                if (!isStart) {
                  firstBound = startDate ?? firstBound;
                }

                if (firstBound.isAfter(lastBound)) {
                  firstBound = fallbackFirst;
                  lastBound = fallbackLast;
                }

                DateTime initial =
                    isStart
                        ? (startDate ?? DateTime.now())
                        : (endDate ?? startDate ?? DateTime.now());
                if (initial.isBefore(firstBound)) {
                  initial = firstBound;
                }
                if (initial.isAfter(lastBound)) {
                  initial = lastBound;
                }

                final picked = await showDatePicker(
                  context: context,
                  initialDate: initial,
                  firstDate: firstBound,
                  lastDate: lastBound,
                );
                if (picked != null) {
                  setModalState(() {
                    if (isStart) {
                      startDate = picked;
                      if (endDate != null && endDate!.isBefore(startDate!)) {
                        endDate = picked;
                      }
                    } else {
                      endDate = picked;
                    }
                  });
                }
              }

              Future<void> pickImage() async {
                final result = await picker.pickImage(
                  source: ImageSource.gallery,
                  imageQuality: 80,
                );
                if (result != null) {
                  setModalState(() => selectedImage = result);
                }
              }

              final bottomInset = MediaQuery.of(context).viewInsets.bottom;
              final hasImage = selectedImage != null;

              return Padding(
                padding: EdgeInsets.only(bottom: bottomInset),
                child: DecoratedBox(
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.vertical(
                      top: Radius.circular(24),
                    ),
                  ),
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
                    child: Form(
                      key: formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 48,
                                height: 48,
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF1F6FF),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: const Icon(
                                  Icons.task_alt,
                                  color: Color(0xFF1D4ED8),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  'Tạo công việc mới',
                                  style: Theme.of(context).textTheme.titleMedium
                                      ?.copyWith(fontWeight: FontWeight.w700),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 20),
                          TextFormField(
                            controller: nameController,
                            textInputAction: TextInputAction.next,
                            decoration: const InputDecoration(
                              labelText: 'Tên công việc',
                              border: OutlineInputBorder(),
                            ),
                            validator: (value) {
                              if (value == null || value.trim().isEmpty) {
                                return 'Vui lòng nhập tên công việc';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 16),
                          Row(
                            children: [
                              Expanded(
                                child: OutlinedButton.icon(
                                  onPressed:
                                      isSubmitting
                                          ? null
                                          : () => pickDate(isStart: true),
                                  icon: const Icon(
                                    Icons.calendar_today,
                                    size: 18,
                                  ),
                                  label: Text(
                                    startDate != null
                                        ? _formatShortDate(startDate!)
                                        : 'Ngày bắt đầu',
                                  ),
                                  style: OutlinedButton.styleFrom(
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 14,
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: OutlinedButton.icon(
                                  onPressed:
                                      isSubmitting
                                          ? null
                                          : () => pickDate(isStart: false),
                                  icon: const Icon(
                                    Icons.event_available,
                                    size: 18,
                                  ),
                                  label: Text(
                                    endDate != null
                                        ? _formatShortDate(endDate!)
                                        : 'Ngày kết thúc',
                                  ),
                                  style: OutlinedButton.styleFrom(
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 14,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          if (projectRangeText != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 8),
                              child: Text(
                                'Thời gian dự án: $projectRangeText',
                                style: Theme.of(
                                  context,
                                ).textTheme.bodySmall?.copyWith(
                                  color: const Color(0xFF2563EB),
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          if (startDate != null &&
                              endDate != null &&
                              endDate!.isBefore(startDate!))
                            Padding(
                              padding: const EdgeInsets.only(top: 8),
                              child: Text(
                                'Ngày kết thúc phải sau ngày bắt đầu',
                                style: TextStyle(
                                  color: Theme.of(context).colorScheme.error,
                                ),
                              ),
                            ),
                          if (startDate != null &&
                              !isWithinProjectRange(startDate!))
                            Padding(
                              padding: const EdgeInsets.only(top: 8),
                              child: Text(
                                projectRangeText != null
                                    ? 'Ngày bắt đầu phải nằm trong khoảng $projectRangeText.'
                                    : 'Ngày bắt đầu phải nằm trong thời gian của dự án.',
                                style: TextStyle(
                                  color: Theme.of(context).colorScheme.error,
                                ),
                              ),
                            ),
                          if (endDate != null &&
                              !isWithinProjectRange(endDate!))
                            Padding(
                              padding: const EdgeInsets.only(top: 8),
                              child: Text(
                                projectRangeText != null
                                    ? 'Ngày kết thúc phải nằm trong khoảng $projectRangeText.'
                                    : 'Ngày kết thúc phải nằm trong thời gian của dự án.',
                                style: TextStyle(
                                  color: Theme.of(context).colorScheme.error,
                                ),
                              ),
                            ),
                          const SizedBox(height: 16),
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF1F6FF),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: const Color(0xFF2563EB).withOpacity(0.3),
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  Icons.info_outline,
                                  size: 20,
                                  color: const Color(0xFF2563EB),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    'Trạng thái mặc định: Chưa bắt đầu',
                                    style: TextStyle(
                                      fontSize: 14,
                                      color: const Color(0xFF2563EB),
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            'Ảnh bìa (không bắt buộc)',
                            style: Theme.of(context).textTheme.bodyMedium
                                ?.copyWith(fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(height: 8),
                          GestureDetector(
                            onTap: isSubmitting ? null : pickImage,
                            child: Container(
                              width: double.infinity,
                              height: 160,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(
                                  color:
                                      hasImage
                                          ? const Color(0xFFBFDBFE)
                                          : const Color(0xFFB6CCFF),
                                  width: 1.2,
                                ),
                                color:
                                    hasImage
                                        ? Colors.white
                                        : const Color(0xFFEAF2FF),
                                image:
                                    hasImage
                                        ? DecorationImage(
                                          image: FileImage(
                                            File(selectedImage!.path),
                                          ),
                                          fit: BoxFit.cover,
                                        )
                                        : null,
                              ),
                              child:
                                  hasImage
                                      ? Align(
                                        alignment: Alignment.topRight,
                                        child: Padding(
                                          padding: const EdgeInsets.all(8.0),
                                          child: CircleAvatar(
                                            radius: 18,
                                            backgroundColor: Colors.black54,
                                            child: IconButton(
                                              icon: const Icon(
                                                Icons.close,
                                                size: 18,
                                                color: Colors.white,
                                              ),
                                              onPressed:
                                                  isSubmitting
                                                      ? null
                                                      : () => setModalState(
                                                        () =>
                                                            selectedImage =
                                                                null,
                                                      ),
                                            ),
                                          ),
                                        ),
                                      )
                                      : Column(
                                        mainAxisAlignment:
                                            MainAxisAlignment.center,
                                        children: const [
                                          Icon(
                                            Icons.add_a_photo_outlined,
                                            size: 36,
                                            color: Color(0xFF1D4ED8),
                                          ),
                                          SizedBox(height: 8),
                                          Text(
                                            'Chọn ảnh bìa (tùy chọn)',
                                            style: TextStyle(
                                              color: Color(0xFF1D4ED8),
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                          SizedBox(height: 4),
                                          Text(
                                            'Bạn có thể bỏ qua bước này',
                                            style: TextStyle(
                                              color: Color(0xFF1D4ED8),
                                              fontSize: 12,
                                            ),
                                          ),
                                        ],
                                      ),
                            ),
                          ),
                          const SizedBox(height: 16),
                          if (submitError != null)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: Text(
                                submitError!,
                                style: Theme.of(
                                  context,
                                ).textTheme.bodyMedium?.copyWith(
                                  color: Theme.of(context).colorScheme.error,
                                ),
                              ),
                            ),
                          Row(
                            children: [
                              Expanded(
                                child: OutlinedButton(
                                  onPressed:
                                      isSubmitting
                                          ? null
                                          : () =>
                                              Navigator.of(context).pop(false),
                                  child: const Text('Hủy'),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: ElevatedButton(
                                  onPressed:
                                      isSubmitting
                                          ? null
                                          : () async {
                                            FocusScope.of(context).unfocus();
                                            if (!(formKey.currentState
                                                    ?.validate() ??
                                                false)) {
                                              return;
                                            }
                                            if (startDate != null &&
                                                !isWithinProjectRange(
                                                  startDate!,
                                                )) {
                                              setModalState(() {
                                                submitError =
                                                    projectRangeText != null
                                                        ? 'Ngày bắt đầu phải nằm trong khoảng $projectRangeText.'
                                                        : 'Ngày bắt đầu phải nằm trong thời gian của dự án.';
                                              });
                                              return;
                                            }
                                            if (endDate != null &&
                                                !isWithinProjectRange(
                                                  endDate!,
                                                )) {
                                              setModalState(() {
                                                submitError =
                                                    projectRangeText != null
                                                        ? 'Ngày kết thúc phải nằm trong khoảng $projectRangeText.'
                                                        : 'Ngày kết thúc phải nằm trong thời gian của dự án.';
                                              });
                                              return;
                                            }

                                            // Validation: Bắt buộc nhập ngày bắt đầu và kết thúc
                                            if (startDate == null) {
                                              setModalState(() {
                                                submitError =
                                                    'Vui lòng chọn ngày bắt đầu.';
                                              });
                                              return;
                                            }
                                            if (endDate == null) {
                                              setModalState(() {
                                                submitError =
                                                    'Vui lòng chọn ngày kết thúc.';
                                              });
                                              return;
                                            }

                                            if (startDate != null &&
                                                endDate != null &&
                                                endDate!.isBefore(startDate!)) {
                                              setModalState(() {
                                                submitError =
                                                    'Ngày kết thúc phải sau ngày bắt đầu.';
                                              });
                                              return;
                                            }

                                            setModalState(() {
                                              submitError = null;
                                              isSubmitting = true;
                                            });

                                            try {
                                              await _service.createTask(
                                                name:
                                                    nameController.text.trim(),
                                                startDate: startDate,
                                                endDate: endDate,
                                                status: status,
                                                progress: defaultProgress,
                                                projectId:
                                                    widget.project.duAnId,
                                                coverImage:
                                                    selectedImage != null
                                                        ? File(
                                                          selectedImage!.path,
                                                        )
                                                        : null,
                                              );
                                              if (mounted && context.mounted) {
                                                nameController.clear();
                                                Navigator.of(context).pop(true);
                                              }
                                            } catch (e) {
                                              if (!mounted) return;
                                              setModalState(() {
                                                isSubmitting = false;
                                                submitError = e.toString();
                                              });
                                            }
                                          },
                                  child:
                                      isSubmitting
                                          ? const SizedBox(
                                            width: 22,
                                            height: 22,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2.5,
                                              valueColor:
                                                  AlwaysStoppedAnimation<Color>(
                                                    Colors.white,
                                                  ),
                                            ),
                                          )
                                          : const Text('Tạo công việc'),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            },
          );
        },
      );
    } finally {
      nameController.clear();
    }

    if (created == true) {
      if (!mounted) return;
      await _loadTasks();
      if (!mounted) return;
      CustomToast.show(
        context,
        message: 'Đã tạo công việc mới.',
        icon: Icons.check_circle_outline,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar:
          widget.isEmbedded
              ? null
              : AppBar(
                title: Text(widget.project.tenDuAn),
                elevation: 0,
                backgroundColor: const Color(0xFF2563EB),
                foregroundColor: Colors.white,
                actions: [
                  IconButton(
                    icon: const Icon(Icons.analytics_outlined),
                    onPressed: _openProjectOverview,
                    tooltip: 'Tổng quan dự án',
                  ),
                ],
              ),
      floatingActionButton:
          widget.isEmbedded
              ? null
              : FloatingActionButton(
                onPressed: _openCreateTaskSheet,
                backgroundColor: const Color(0xFF2563EB),
                child: const Icon(Icons.add, size: 28),
              ),
      body:
          _isLoading
              ? const Center(
                child: CircularProgressIndicator(color: Color(0xFF2563EB)),
              )
              : _error != null
              ? Center(
                child: Padding(
                  padding: const EdgeInsets.all(32.0),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(20),
                        decoration: const BoxDecoration(
                          color: Color(0xFFFEE2E2),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.error_outline,
                          size: 48,
                          color: Color(0xFFEF4444),
                        ),
                      ),
                      const SizedBox(height: 20),
                      const Text(
                        'Đã xảy ra lỗi',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF1F2937),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _error!,
                        style: const TextStyle(
                          fontSize: 14,
                          color: Color(0xFF6B7280),
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 24),
                      FilledButton.icon(
                        onPressed: _loadTasks,
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF2563EB),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 24,
                            vertical: 14,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        icon: const Icon(Icons.refresh, size: 20),
                        label: const Text('Thử lại'),
                      ),
                    ],
                  ),
                ),
              )
              : _buildContent(),
    );
  }

  final Map<String, bool> _sectionExpanded = {};

  Widget _buildContent() {
    final payload = _payload;
    if (payload == null || payload.tasks.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.task_alt, size: 64, color: Colors.grey.shade300),
              const SizedBox(height: 16),
              const Text(
                'Chưa có công việc nào',
                style: TextStyle(fontSize: 15, color: Color(0xFF6B7280)),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              const Text(
                'Nhấn nút + để tạo công việc mới',
                style: TextStyle(fontSize: 13, color: Color(0xFF9CA3AF)),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    final tasks = payload.tasks;
    final filtered =
        tasks.where((task) {
          if (_searchQuery.isEmpty) return true;
          return task.tenCongViec.toLowerCase().contains(
            _searchQuery.toLowerCase(),
          );
        }).toList();

    filtered.sort((a, b) {
      switch (_sortOption) {
        case TaskSortOption.progressDesc:
          return b.phamTramHoanThanh.compareTo(a.phamTramHoanThanh);
        case TaskSortOption.startDateAsc:
          if (a.ngayBd == null && b.ngayBd == null) return 0;
          if (a.ngayBd == null) return 1;
          if (b.ngayBd == null) return -1;
          return a.ngayBd!.compareTo(b.ngayBd!);
        case TaskSortOption.endDateAsc:
          if (a.ngayKt == null && b.ngayKt == null) return 0;
          if (a.ngayKt == null) return 1;
          if (b.ngayKt == null) return -1;
          return a.ngayKt!.compareTo(b.ngayKt!);
      }
    });

    const standardOrder = ['Chưa bắt đầu', 'Đang làm', 'Hoàn thành', 'Trễ hạn'];
    final grouped = <String, List<ProjectTask>>{};

    for (final status in standardOrder) {
      grouped[status] = <ProjectTask>[];
      _sectionExpanded.putIfAbsent(status, () => true);
    }

    for (final task in filtered) {
      final label = _resolveStatusLabel(task.trangThai);
      grouped.putIfAbsent(label, () => <ProjectTask>[]);
      grouped[label]!.add(task);
      _sectionExpanded.putIfAbsent(label, () => true);
    }

    // Add statuses that currently have no tasks so the user still sees them.
    for (final status in _availableStatuses) {
      final label = _resolveStatusLabel(status);
      if (label.isEmpty) continue;
      grouped.putIfAbsent(label, () => <ProjectTask>[]);
      _sectionExpanded.putIfAbsent(label, () => true);
    }

    _sectionExpanded.removeWhere((key, _) => !grouped.containsKey(key));

    final remaining =
        grouped.keys.where((key) => !standardOrder.contains(key)).toList()
          ..sort((a, b) => a.toLowerCase().compareTo(b.toLowerCase()));
    final orderedKeys =
        <String>[
          ...standardOrder,
          ...remaining,
        ].where(grouped.containsKey).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(
              bottom: BorderSide(color: Color(0xFFE5E7EB), width: 1),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                widget.project.tenDuAn,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF1F2937),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                '${tasks.length} công việc tổng cộng',
                style: const TextStyle(
                  fontSize: 13,
                  color: Color(0xFF6B7280),
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE5E7EB)),
            ),
            padding: const EdgeInsets.all(16),
            child: TaskControls(
              searchController: _searchController,
              searchQuery: _searchQuery,
              onSearchChanged: (value) {
                setState(() => _searchQuery = value);
              },
              sortOption: _sortOption,
              onSortChanged: (option) {
                setState(() => _sortOption = option);
              },
              onAddStatus: _openAddStatusDialog,
              isAddingStatus: _creatingStatus,
            ),
          ),
        ),
        const SizedBox(height: 16),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            children:
                orderedKeys.map((status) {
                  final items = grouped[status] ?? <ProjectTask>[];
                  final expanded = _sectionExpanded[status] ?? true;
                  final normalizedStatus = status.trim();
                  final lowerStatus = normalizedStatus.toLowerCase();
                  final isDefaultStatus = _isDefaultStatus(normalizedStatus);
                  final hasApiStatus = _availableStatuses.any(
                    (value) => value.trim().toLowerCase() == lowerStatus,
                  );
                  final canDeleteStatus = hasApiStatus && !isDefaultStatus;
                  final isDeletingStatus =
                      _deletingStatus != null &&
                      _deletingStatus!.toLowerCase() == lowerStatus;

                  return Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE5E7EB)),
                    ),
                    child: Column(
                      children: [
                        Material(
                          color: Colors.transparent,
                          child: InkWell(
                            onTap: () {
                              setState(() {
                                _sectionExpanded[status] = !expanded;
                              });
                            },
                            borderRadius: const BorderRadius.vertical(
                              top: Radius.circular(16),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 14,
                              ),
                              child: Row(
                                children: [
                                  Icon(
                                    expanded
                                        ? Icons.expand_more
                                        : Icons.chevron_right,
                                    color: const Color(0xFF2563EB),
                                    size: 22,
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Text(
                                      normalizedStatus.isEmpty
                                          ? status
                                          : normalizedStatus,
                                      style: const TextStyle(
                                        fontSize: 15,
                                        color: Color(0xFF1F2937),
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 8,
                                      vertical: 4,
                                    ),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFEFF6FF),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      '${items.length}',
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: Color(0xFF2563EB),
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                  if (canDeleteStatus) const SizedBox(width: 8),
                                  if (canDeleteStatus)
                                    isDeletingStatus
                                        ? const SizedBox(
                                          width: 20,
                                          height: 20,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                          ),
                                        )
                                        : IconButton(
                                          tooltip: 'Xoá trạng thái',
                                          icon: const Icon(
                                            Icons.delete_outline,
                                            size: 20,
                                          ),
                                          color: const Color(0xFFEF4444),
                                          onPressed:
                                              () => _deleteStatus(
                                                normalizedStatus,
                                              ),
                                          padding: EdgeInsets.zero,
                                          constraints: const BoxConstraints(),
                                        ),
                                ],
                              ),
                            ),
                          ),
                        ),
                        if (expanded)
                          const Divider(height: 1, color: Color(0xFFE5E7EB)),
                        if (expanded)
                          Padding(
                            padding: const EdgeInsets.all(12),
                            child:
                                items.isEmpty
                                    ? Padding(
                                      padding: const EdgeInsets.symmetric(
                                        vertical: 20,
                                      ),
                                      child: Column(
                                        children: [
                                          Icon(
                                            Icons.task_alt,
                                            size: 40,
                                            color: Colors.grey.shade300,
                                          ),
                                          const SizedBox(height: 8),
                                          const Text(
                                            'Chưa có công việc nào trong trạng thái này.',
                                            textAlign: TextAlign.center,
                                            style: TextStyle(
                                              fontSize: 13,
                                              color: Color(0xFF9CA3AF),
                                            ),
                                          ),
                                        ],
                                      ),
                                    )
                                    : Column(
                                      children:
                                          items
                                              .map(
                                                (task) => Padding(
                                                  padding:
                                                      const EdgeInsets.only(
                                                        bottom: 10,
                                                      ),
                                                  child: TaskCard(
                                                    task: task,
                                                    onStatusChange: (
                                                      task,
                                                      newStatus,
                                                    ) {
                                                      _updateTaskStatus(
                                                        task,
                                                        newStatus,
                                                      );
                                                    },
                                                    isUpdating: _updatingTaskIds
                                                        .contains(
                                                          task.congViecId,
                                                        ),
                                                    availableStatuses:
                                                        _availableStatuses,
                                                    statusesLoading:
                                                        _isLoadingStatuses,
                                                    statusError: _statusError,
                                                    onTap:
                                                        () => _openAssignments(
                                                          task,
                                                        ),
                                                    attachments:
                                                        _attachments[task
                                                            .congViecId] ??
                                                        const [],
                                                    attachmentsLoading:
                                                        _attachmentsLoading
                                                            .contains(
                                                              task.congViecId,
                                                            ),
                                                    attachmentsError:
                                                        _attachmentsError[task
                                                            .congViecId],
                                                    onRetryAttachments:
                                                        () => _loadAttachments(
                                                          task.congViecId,
                                                        ),
                                                    onDownloadAttachment:
                                                        (_) {},
                                                    onRemind:
                                                        () =>
                                                            _sendReminder(task),
                                                    isReminding:
                                                        _remindingTaskIds
                                                            .contains(
                                                              task.congViecId,
                                                            ),
                                                    onAddAttachment:
                                                        () => _addAttachments(
                                                          task,
                                                        ),
                                                    isUploadingAttachment:
                                                        _uploadingAttachmentIds
                                                            .contains(
                                                              task.congViecId,
                                                            ),
                                                    onDeleteAttachment:
                                                        (attachment) =>
                                                            _deleteAttachment(
                                                              task,
                                                              attachment,
                                                            ),
                                                    deletingAttachmentPaths:
                                                        _deletingAttachmentPaths,
                                                    onEdit:
                                                        () =>
                                                            _openEditTaskSheet(
                                                              task,
                                                            ),
                                                    isEditing: _editingTaskIds
                                                        .contains(
                                                          task.congViecId,
                                                        ),
                                                    onDelete:
                                                        () =>
                                                            _confirmDeleteTask(
                                                              task,
                                                            ),
                                                    isDeleting: _deletingTaskIds
                                                        .contains(
                                                          task.congViecId,
                                                        ),
                                                  ),
                                                ),
                                              )
                                              .toList(),
                                    ),
                          ),
                      ],
                    ),
                  );
                }).toList(),
          ),
        ),
      ],
    );
  }
}

String _formatShortDate(DateTime date) {
  return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
}
