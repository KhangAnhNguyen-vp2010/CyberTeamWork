import 'package:flutter/material.dart';

class TaskStatusButton extends StatelessWidget {
  const TaskStatusButton({
    super.key,
    required this.currentStatus,
    required this.onSelected,
    required this.isLoading,
    required this.availableStatuses,
    required this.statusesLoading,
    required this.statusError,
  });

  final String currentStatus;
  final ValueChanged<String> onSelected;
  final bool isLoading;
  final List<String> availableStatuses;
  final bool statusesLoading;
  final String? statusError;

  @override
  Widget build(BuildContext context) {
    final label = _displayStatus(currentStatus, availableStatuses);

    Widget buildStaticPill({required Color background, required Color border, required Color iconColor, required Color textColor, bool showArrow = false}) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          border: Border.all(color: border),
          borderRadius: BorderRadius.circular(12),
          color: background,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.compare_arrows, size: 16, color: iconColor),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: textColor),
            ),
            if (showArrow) ...[
              const SizedBox(width: 4),
              Icon(Icons.arrow_drop_down, size: 18, color: iconColor),
            ],
          ],
        ),
      );
    }

    if (isLoading || statusesLoading) {
      return IgnorePointer(
        child: buildStaticPill(
          background: Colors.grey.shade100,
          border: Colors.grey.shade200,
          iconColor: Colors.grey.shade500,
          textColor: Colors.grey.shade600,
        ),
      );
    }

    if (statusError != null) {
      return Tooltip(
        message: statusError!,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            border: Border.all(color: Colors.redAccent.shade100),
            borderRadius: BorderRadius.circular(12),
            color: Colors.redAccent.withOpacity(0.1),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline, size: 16, color: Colors.redAccent.shade200),
              const SizedBox(width: 4),
              Text(
                label,
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),
      );
    }

    if (availableStatuses.isEmpty) {
      return buildStaticPill(
        background: Colors.grey.shade100,
        border: Colors.grey.shade200,
        iconColor: Colors.grey.shade500,
        textColor: Colors.grey.shade600,
      );
    }

    final normalizedStatuses = availableStatuses
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toList(growable: false);
    final selectedValue = _matchStatus(currentStatus, normalizedStatuses);

    return PopupMenuButton<String>(
      tooltip: 'Thay đổi trạng thái',
      initialValue: normalizedStatuses.contains(selectedValue) ? selectedValue : null,
      onSelected: onSelected,
      itemBuilder: (context) {
        return normalizedStatuses.map((status) {
          final isSelected = status.toLowerCase() == selectedValue.toLowerCase();
          return PopupMenuItem<String>(
            value: status,
            child: Row(
              children: [
                if (isSelected)
                  Icon(Icons.check, size: 16, color: Theme.of(context).colorScheme.primary)
                else
                  const SizedBox(width: 16),
                const SizedBox(width: 8),
                Text(status),
              ],
            ),
          );
        }).toList();
      },
      child: buildStaticPill(
        background: Colors.white,
        border: Colors.grey.shade300,
        iconColor: Colors.grey.shade700,
        textColor: Colors.black87,
        showArrow: true,
      ),
    );
  }

  static String _displayStatus(String status, List<String> availableStatuses) {
    if (availableStatuses.isEmpty) return status;
    final normalizedStatus = status.toLowerCase();
    final match = availableStatuses.firstWhere(
      (element) => element.toLowerCase() == normalizedStatus,
      orElse: () => status,
    );
    return match;
  }

  static String _matchStatus(String status, List<String> availableStatuses) {
    if (availableStatuses.isEmpty) return status;
    final normalizedStatus = status.toLowerCase();
    final match = availableStatuses.firstWhere(
      (element) => element.toLowerCase() == normalizedStatus,
      orElse: () => availableStatuses.first,
    );
    return match;
  }
}
