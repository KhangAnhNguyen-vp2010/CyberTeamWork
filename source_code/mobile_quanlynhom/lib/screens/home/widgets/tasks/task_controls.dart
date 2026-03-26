import 'package:flutter/material.dart';

enum TaskSortOption { progressDesc, startDateAsc, endDateAsc }

class _TaskColors {
  static const primary = Color(0xFF2563EB);
  static const border = Color(0xFFE5E7EB);
  static const textSecondary = Color(0xFF6B7280);
}

class TaskControls extends StatelessWidget {
  const TaskControls({
    super.key,
    required this.searchController,
    required this.searchQuery,
    required this.onSearchChanged,
    required this.sortOption,
    required this.onSortChanged,
    required this.onAddStatus,
    required this.isAddingStatus,
  });

  final TextEditingController searchController;
  final String searchQuery;
  final ValueChanged<String> onSearchChanged;
  final TaskSortOption sortOption;
  final ValueChanged<TaskSortOption> onSortChanged;
  final VoidCallback onAddStatus;
  final bool isAddingStatus;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: searchController,
                onChanged: onSearchChanged,
                decoration: InputDecoration(
                  prefixIcon: Icon(Icons.search, color: _TaskColors.textSecondary, size: 20),
                  hintText: 'Tìm kiếm công việc...',
                  hintStyle: TextStyle(color: _TaskColors.textSecondary, fontSize: 14),
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: _TaskColors.border),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: _TaskColors.border),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: _TaskColors.primary, width: 1.5),
                  ),
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                ),
              ),
            ),
            const SizedBox(width: 12),
            _SortIconButton(
              sortOption: sortOption,
              onChanged: onSortChanged,
            ),
          ],
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: isAddingStatus ? null : onAddStatus,
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 12),
              side: BorderSide(color: _TaskColors.border),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            icon: isAddingStatus
                ? SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(_TaskColors.primary),
                    ),
                  )
                : Icon(Icons.add, size: 18, color: _TaskColors.primary),
            label: Text(
              isAddingStatus ? 'Đang thêm...' : 'Thêm trạng thái',
              style: TextStyle(color: _TaskColors.primary, fontSize: 14),
            ),
          ),
        ),
      ],
    );
  }
}

class _SortIconButton extends StatelessWidget {
  const _SortIconButton({
    required this.sortOption,
    required this.onChanged,
  });

  final TaskSortOption sortOption;
  final ValueChanged<TaskSortOption> onChanged;

  String _getSortLabel(TaskSortOption option) {
    switch (option) {
      case TaskSortOption.progressDesc:
        return 'Tiến độ cao trước';
      case TaskSortOption.startDateAsc:
        return 'Ngày bắt đầu sớm nhất';
      case TaskSortOption.endDateAsc:
        return 'Hạn chót gần nhất';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _TaskColors.border),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => _showSortMenu(context),
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Icon(Icons.sort, color: _TaskColors.primary, size: 24),
          ),
        ),
      ),
    );
  }

  void _showSortMenu(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.sort, color: _TaskColors.primary),
                    const SizedBox(width: 12),
                    const Text(
                      'Sắp xếp theo',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                ..._buildSortOptions(context),
              ],
            ),
          ),
        );
      },
    );
  }

  List<Widget> _buildSortOptions(BuildContext context) {
    final options = [
      TaskSortOption.progressDesc,
      TaskSortOption.startDateAsc,
      TaskSortOption.endDateAsc,
    ];

    return options.map((option) {
      final isSelected = option == sortOption;
      return ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 8),
        leading: Icon(
          isSelected ? Icons.radio_button_checked : Icons.radio_button_unchecked,
          color: isSelected ? _TaskColors.primary : _TaskColors.textSecondary,
        ),
        title: Text(
          _getSortLabel(option),
          style: TextStyle(
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
            color: isSelected ? _TaskColors.primary : Colors.black87,
          ),
        ),
        onTap: () {
          Navigator.of(context).pop();
          onChanged(option);
        },
      );
    }).toList();
  }
}
