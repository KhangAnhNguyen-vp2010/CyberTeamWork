import 'package:flutter/material.dart';
import '../../../../constants/api_constants.dart';
import '../../../../models/project_task.dart';
import '../../../../models/task_attachment.dart';
import 'task_status_chip.dart';
import 'task_status_button.dart';
import 'task_attachments.dart';

class TaskCard extends StatelessWidget {
  const TaskCard({
    super.key,
    required this.task,
    required this.onStatusChange,
    required this.isUpdating,
    required this.availableStatuses,
    required this.statusesLoading,
    required this.statusError,
    required this.onTap,
    required this.attachments,
    required this.attachmentsLoading,
    this.attachmentsError,
    required this.onRetryAttachments,
    required this.onDownloadAttachment,
    required this.onRemind,
    required this.isReminding,
    required this.onAddAttachment,
    required this.isUploadingAttachment,
    required this.onDeleteAttachment,
    this.deletingAttachmentPaths = const <String>{},
    required this.onEdit,
    required this.isEditing,
    required this.onDelete,
    required this.isDeleting,
  });

  final ProjectTask task;
  final void Function(ProjectTask task, String status) onStatusChange;
  final bool isUpdating;
  final List<String> availableStatuses;
  final bool statusesLoading;
  final String? statusError;
  final VoidCallback onTap;
  final List<TaskAttachment> attachments;
  final bool attachmentsLoading;
  final String? attachmentsError;
  final VoidCallback onRetryAttachments;
  final ValueChanged<TaskAttachment> onDownloadAttachment;
  final VoidCallback onRemind;
  final bool isReminding;
  final VoidCallback onAddAttachment;
  final bool isUploadingAttachment;
  final ValueChanged<TaskAttachment> onDeleteAttachment;
  final Set<String> deletingAttachmentPaths;
  final VoidCallback onEdit;
  final bool isEditing;
  final VoidCallback onDelete;
  final bool isDeleting;

  @override
  Widget build(BuildContext context) {
    final dateRange = _formatRange(task.ngayBd, task.ngayKt);

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.grey.shade200),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 50,
                  height: 50,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    image: DecorationImage(
                      image: _resolveTaskImage(task.anhBia),
                      fit: BoxFit.cover,
                      onError: (_, __) {},
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              task.tenCongViec,
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(
                                icon: isEditing
                                    ? const SizedBox(
                                        width: 20,
                                        height: 20,
                                        child: CircularProgressIndicator(strokeWidth: 2.2),
                                      )
                                    : const Icon(Icons.edit_outlined, size: 20),
                                tooltip: 'Chỉnh sửa',
                                onPressed: isEditing ? null : onEdit,
                              ),
                              IconButton(
                                icon: isDeleting
                                    ? const SizedBox(
                                        width: 20,
                                        height: 20,
                                        child: CircularProgressIndicator(strokeWidth: 2.2),
                                      )
                                    : const Icon(Icons.delete_outline, size: 20, color: Colors.redAccent),
                                tooltip: 'Xoá',
                                onPressed: (isDeleting || isEditing) ? null : onDelete,
                              ),
                            ],
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      TaskStatusChip(
                        status: task.trangThai,
                        color: _statusColorFor(task.trangThai),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: LinearProgressIndicator(
                      value: _normalizeProgress(task.phamTramHoanThanh),
                      minHeight: 8,
                      backgroundColor: Colors.grey.shade200,
                      valueColor: AlwaysStoppedAnimation(_statusColorFor(task.trangThai)),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Text(
                  '${task.phamTramHoanThanh.toStringAsFixed(1)}%',
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(width: 12),
                TaskStatusButton(
                  currentStatus: task.trangThai,
                  onSelected: (status) => onStatusChange(task, status),
                  isLoading: isUpdating,
                  availableStatuses: availableStatuses,
                  statusesLoading: statusesLoading,
                  statusError: statusError,
                ),
              ],
            ),
            if (dateRange != null) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(Icons.calendar_month, size: 16, color: Color(0xFF616161)),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      dateRange,
                      style: const TextStyle(fontSize: 12, color: Color(0xFF616161)),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 12),
            TaskAttachments(
              attachments: attachments,
              isLoading: attachmentsLoading,
              error: attachmentsError,
              onRetry: onRetryAttachments,
              onDownload: onDownloadAttachment,
              onDelete: onDeleteAttachment,
              deletingPaths: deletingAttachmentPaths,
            ),
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerLeft,
              child: OutlinedButton.icon(
                onPressed: isUploadingAttachment ? null : onAddAttachment,
                icon: isUploadingAttachment
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.attach_file, size: 18),
                label: Text(isUploadingAttachment ? 'Đang tải...' : 'Thêm file'),
                style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12)),
              ),
            ),
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerRight,
              child: isReminding
                  ? const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(strokeWidth: 2.5),
                    )
                  : OutlinedButton.icon(
                      onPressed: onRemind,
                      icon: const Icon(Icons.alarm, size: 18),
                      label: const Text('Nhắc hạn'),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  static ImageProvider _resolveTaskImage(String? anhBia) {
    if (anhBia == null || anhBia.isEmpty) {
      return const AssetImage('assets/images/task-default.png');
    }
    if (anhBia.startsWith('http')) {
      return NetworkImage(anhBia);
    }
    final base = ApiConstants.baseUrl;
    final path = anhBia.startsWith('/') ? '$base$anhBia' : '$base/$anhBia';
    return NetworkImage(path);
  }

  static String? _formatRange(DateTime? start, DateTime? end) {
    if (start == null && end == null) return null;
    final startText = start != null ? _formatDate(start) : '—';
    final endText = end != null ? _formatDate(end) : '—';
    return '$startText → $endText';
  }

  static String _formatDate(DateTime date) {
    return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
  }

  static double _normalizeProgress(double raw) {
    if (raw.isNaN || raw.isInfinite) return 0;
    return raw.clamp(0, 100) / 100;
  }

  static Color _statusColorFor(String status) {
    final normalized = status.trim().toLowerCase();
    if (normalized.contains('hoàn') || normalized.contains('done') || normalized.contains('completed')) {
      return const Color(0xFF43A047);
    }
    if (normalized.contains('đang') || normalized.contains('in progress')) {
      return const Color(0xFF1E88E5);
    }
    if (normalized.contains('trễ') || normalized.contains('overdue')) {
      return const Color(0xFFE53935);
    }
    if (normalized.contains('chưa') || normalized.contains('not')) {
      return const Color(0xFF757575);
    }
    return const Color(0xFFFB8C00);
  }
}
