import 'package:flutter/material.dart';
import '../../../../models/project_summary.dart';

class _CardColors {
  static const surface = Colors.white;
  static const border = Color(0xFFE5E7EB);
  static const textPrimary = Color(0xFF1F2937);
  static const textSecondary = Color(0xFF6B7280);
  static const iconSecondary = Color(0xFF9CA3AF);
}

class ProjectCard extends StatelessWidget {
  const ProjectCard({
    super.key,
    required this.project,
    required this.imageUrlResolver,
    required this.onTap,
  });

  final ProjectSummary project;
  final String? Function(ProjectSummary project) imageUrlResolver;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final imageUrl = imageUrlResolver(project);
    final dateRange = _formatDateRange(project);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: _CardColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: _CardColors.border, width: 1),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: _buildImage(imageUrl),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            project.tenDuAn,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              color: _CardColors.textPrimary,
                              height: 1.3,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),
                        _StatusBadge(status: project.trangThai ?? 'Không rõ'),
                      ],
                    ),
                    const SizedBox(height: 10),
                    if (project.tenLinhVuc != null && project.tenLinhVuc!.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Row(
                          children: [
                            Icon(Icons.category_outlined, size: 14, color: _CardColors.iconSecondary),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                project.tenLinhVuc!,
                                style: const TextStyle(
                                  fontSize: 13,
                                  color: _CardColors.textSecondary,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    if (dateRange != null)
                      Row(
                        children: [
                          Icon(Icons.calendar_today_outlined, size: 14, color: _CardColors.iconSecondary),
                          const SizedBox(width: 6),
                          Text(
                            dateRange,
                            style: const TextStyle(
                              fontSize: 13,
                              color: _CardColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    if (project.moTa != null && project.moTa!.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          project.moTa!,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 12,
                            color: _CardColors.textSecondary,
                            height: 1.5,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildImage(String? imageUrl) {
    if (imageUrl == null) {
      return _placeholderImage();
    }

    if (imageUrl.startsWith('assets/images/')) {
      return Image.asset(
        imageUrl,
        width: 72,
        height: 72,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => _placeholderImage(),
      );
    }

    return Image.network(
      imageUrl,
      width: 72,
      height: 72,
      fit: BoxFit.cover,
      errorBuilder: (_, __, ___) => _placeholderImage(),
    );
  }

  Widget _placeholderImage() {
    return Container(
      width: 72,
      height: 72,
      decoration: BoxDecoration(
        color: _CardColors.border,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Icon(Icons.folder_open, color: _CardColors.iconSecondary, size: 28),
    );
  }

  String? _formatDateRange(ProjectSummary project) {
    final start = project.ngayBd;
    final end = project.ngayKt;
    if (start == null && end == null) return null;

    final buffer = StringBuffer();
    if (start != null) {
      buffer.write(_formatDate(start));
    }

    if (end != null) {
      if (buffer.isNotEmpty) {
        buffer.write(' - ');
      }
      buffer.write(_formatDate(end));
    }

    return buffer.isEmpty ? null : buffer.toString();
  }

  String _formatDate(DateTime date) {
    return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status});

  final String status;

  Color _statusColor(String status) {
    final normalized = status.toLowerCase();
    if (normalized.contains('đang') || normalized.contains('in progress')) {
      return const Color(0xFF2563EB);
    }
    if (normalized.contains('hoàn') || normalized.contains('done') || normalized.contains('completed')) {
      return const Color(0xFF10B981);
    }
    if (normalized.contains('tạm') || normalized.contains('pause')) {
      return const Color(0xFFF59E0B);
    }
    if (normalized.contains('hủy') || normalized.contains('cancel')) {
      return const Color(0xFFEF4444);
    }
    return const Color(0xFF6B7280);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: _statusColor(status),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        status,
        style: const TextStyle(
          fontSize: 11,
          color: Colors.white,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
