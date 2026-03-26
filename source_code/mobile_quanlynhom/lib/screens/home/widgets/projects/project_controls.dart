import 'package:flutter/material.dart';
import '../../../../models/project_domain.dart';

enum ProjectSortOption { nameAsc, nameDesc, startDateAsc, startDateDesc }

class _ControlColors {
  static const primary = Color(0xFF2563EB);
  static const border = Color(0xFFE5E7EB);
  static const textSecondary = Color(0xFF6B7280);
  static const chipSelected = Color(0xFF2563EB);
  static const chipBackground = Color(0xFFF3F4F6);
}

class ProjectControls extends StatelessWidget {
  const ProjectControls({
    super.key,
    required this.searchController,
    required this.onSearchChanged,
    required this.sortOption,
    required this.onSortChanged,
    required this.domains,
    required this.isLoadingDomains,
    required this.selectedDomainId,
    required this.onFilterChanged,
    required this.allDomainId,
  });

  final TextEditingController searchController;
  final ValueChanged<String> onSearchChanged;
  final ProjectSortOption sortOption;
  final ValueChanged<ProjectSortOption> onSortChanged;
  final List<ProjectDomain> domains;
  final bool isLoadingDomains;
  final int selectedDomainId;
  final ValueChanged<int> onFilterChanged;
  final int allDomainId;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: searchController,
                onChanged: onSearchChanged,
                decoration: InputDecoration(
                  prefixIcon: Icon(Icons.search, color: _ControlColors.textSecondary, size: 20),
                  hintText: 'Tìm kiếm dự án...',
                  hintStyle: TextStyle(color: _ControlColors.textSecondary, fontSize: 14),
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: _ControlColors.border),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: _ControlColors.border),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: _ControlColors.primary, width: 1.5),
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
        _DomainChips(
          domains: domains,
          isLoading: isLoadingDomains,
          selectedDomainId: selectedDomainId,
          allDomainId: allDomainId,
          onChanged: onFilterChanged,
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

  final ProjectSortOption sortOption;
  final ValueChanged<ProjectSortOption> onChanged;

  String _getSortLabel(ProjectSortOption option) {
    switch (option) {
      case ProjectSortOption.nameAsc:
        return 'Tên (A-Z)';
      case ProjectSortOption.nameDesc:
        return 'Tên (Z-A)';
      case ProjectSortOption.startDateAsc:
        return 'Ngày bắt đầu ↑';
      case ProjectSortOption.startDateDesc:
        return 'Ngày bắt đầu ↓';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _ControlColors.border),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => _showSortMenu(context),
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Icon(Icons.sort, color: _ControlColors.primary, size: 24),
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
                    Icon(Icons.sort, color: _ControlColors.primary),
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
      ProjectSortOption.nameAsc,
      ProjectSortOption.nameDesc,
      ProjectSortOption.startDateAsc,
      ProjectSortOption.startDateDesc,
    ];

    return options.map((option) {
      final isSelected = option == sortOption;
      return ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 8),
        leading: Icon(
          isSelected ? Icons.radio_button_checked : Icons.radio_button_unchecked,
          color: isSelected ? _ControlColors.primary : _ControlColors.textSecondary,
        ),
        title: Text(
          _getSortLabel(option),
          style: TextStyle(
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
            color: isSelected ? _ControlColors.primary : Colors.black87,
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

class _DomainChips extends StatelessWidget {
  const _DomainChips({
    required this.domains,
    required this.isLoading,
    required this.selectedDomainId,
    required this.allDomainId,
    required this.onChanged,
  });

  final List<ProjectDomain> domains;
  final bool isLoading;
  final int selectedDomainId;
  final int allDomainId;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return const SizedBox(
        height: 36,
        child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }

    final items = [
      ProjectDomain(linhVucId: allDomainId, tenLinhVuc: 'Tất cả'),
      ...domains,
    ];

    if (items.length <= 1) {
      return const SizedBox.shrink();
    }

    return SizedBox(
      height: 36,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final domain = items[index];
          final isSelected = domain.linhVucId == selectedDomainId;
          return _DomainChip(
            label: domain.tenLinhVuc,
            isSelected: isSelected,
            onTap: () => onChanged(domain.linhVucId),
          );
        },
      ),
    );
  }
}

class _DomainChip extends StatelessWidget {
  const _DomainChip({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? _ControlColors.chipSelected : _ControlColors.chipBackground,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: isSelected ? _ControlColors.chipSelected : _ControlColors.border,
              width: 1,
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
              color: isSelected ? Colors.white : Colors.black87,
            ),
          ),
        ),
      ),
    );
  }
}
