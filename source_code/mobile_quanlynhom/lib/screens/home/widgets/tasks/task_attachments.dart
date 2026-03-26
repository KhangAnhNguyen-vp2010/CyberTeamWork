import 'package:flutter/material.dart';
import '../../../../models/task_attachment.dart';

class TaskAttachments extends StatelessWidget {
  const TaskAttachments({
    super.key,
    required this.attachments,
    required this.isLoading,
    required this.error,
    required this.onRetry,
    required this.onDownload,
    required this.onDelete,
    this.deletingPaths = const <String>{},
  });

  final List<TaskAttachment> attachments;
  final bool isLoading;
  final String? error;
  final VoidCallback onRetry;
  final ValueChanged<TaskAttachment> onDownload;
  final ValueChanged<TaskAttachment> onDelete;
  final Set<String> deletingPaths;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (isLoading) {
      return Row(
        children: [
          const SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(strokeWidth: 2.5),
          ),
          const SizedBox(width: 10),
          Text(
            'Đang tải file đính kèm...',
            style: theme.textTheme.bodySmall?.copyWith(color: Colors.grey.shade700),
          ),
        ],
      );
    }

    if (error != null) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFFFFEBEE),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFFFCDD2)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.error_outline, size: 18, color: Color(0xFFD32F2F)),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    error!,
                    style: theme.textTheme.bodySmall?.copyWith(color: const Color(0xFFD32F2F)),
                  ),
                  const SizedBox(height: 6),
                  TextButton(
                    onPressed: onRetry,
                    style: TextButton.styleFrom(
                      padding: EdgeInsets.zero,
                      minimumSize: const Size(0, 0),
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: const Text('Thử lại'),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    if (attachments.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.grey.shade100,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            const Icon(Icons.attachment, size: 18, color: Color(0xFF616161)),
            const SizedBox(width: 8),
            Text(
              'Không có file đính kèm',
              style: theme.textTheme.bodySmall?.copyWith(color: Colors.grey.shade700),
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'File đính kèm',
          style: theme.textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 8),
        ...attachments.map((attachment) {
          final isDeleting = deletingPaths.contains(attachment.filePath);
          return Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.grey.shade100,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.insert_drive_file, size: 18, color: Color(0xFF424242)),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    attachment.fileName,
                    style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                  ),
                ),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.download, size: 20),
                      tooltip: 'Tải xuống',
                      onPressed: () => onDownload(attachment),
                    ),
                    IconButton(
                      icon: isDeleting
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2.2),
                            )
                          : const Icon(Icons.delete_outline, size: 20),
                      tooltip: 'Xóa file',
                      onPressed: isDeleting ? null : () => onDelete(attachment),
                    ),
                  ],
                ),
              ],
            ),
          );
        }),
      ],
    );
  }
}
