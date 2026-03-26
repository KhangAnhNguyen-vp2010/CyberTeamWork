import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../models/project_summary.dart';
import '../../models/project_task.dart';
import '../../services/group_service.dart';
import '../../widgets/custom_toast.dart';
import 'task_assignments_screen.dart';

class ProjectOverviewScreen extends StatefulWidget {
  const ProjectOverviewScreen({
    super.key,
    required this.project,
    required this.groupId,
  });

  final ProjectSummary project;
  final int groupId;

  @override
  State<ProjectOverviewScreen> createState() => _ProjectOverviewScreenState();
}

class _ProjectOverviewScreenState extends State<ProjectOverviewScreen> {
  final GroupService _service = GroupService();

  bool _loading = false;
  String? _error;

  double _completionPercent = 0.0;
  List<ProjectTask> _remainingTasks = [];
  List<ProjectTask> _overdueTasks = [];
  List<ProjectTask> _upcomingTasks = [];
  List<ProjectTask> _completedTasks = [];

  @override
  void initState() {
    super.initState();
    _loadOverview();
  }

  Future<void> _loadOverview() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final payload = await _service.fetchProjectTasks(
        projectId: widget.project.duAnId,
      );

      if (!mounted) return;

      final tasks = payload.tasks;

      // Tính phần trăm hoàn thành
      if (tasks.isEmpty) {
        _completionPercent = 0.0;
      } else {
        final totalProgress = tasks.fold<double>(
          0.0,
          (sum, task) => sum + task.phamTramHoanThanh,
        );
        _completionPercent = totalProgress / tasks.length;
      }

      // Lọc task còn lại (chưa hoàn thành)
      _remainingTasks =
          tasks
              .where((task) => task.trangThai.toLowerCase() != 'hoàn thành')
              .toList();

      // Lọc task đã hoàn thành
      _completedTasks =
          tasks
              .where((task) => task.trangThai.toLowerCase() == 'hoàn thành')
              .toList();

      // Lọc task quá hạn (ngày kết thúc < hôm nay và chưa hoàn thành)
      final now = DateTime.now();
      _overdueTasks =
          tasks.where((task) {
            if (task.trangThai.toLowerCase() == 'hoàn thành') return false;
            if (task.ngayKt == null) return false;
            return task.ngayKt!.isBefore(now);
          }).toList();

      // Lọc task sắp đến hạn (còn 3 ngày hoặc ít hơn, chưa hoàn thành, chưa quá hạn)
      final threeDaysLater = now.add(const Duration(days: 3));
      _upcomingTasks =
          tasks.where((task) {
            if (task.trangThai.toLowerCase() == 'hoàn thành') return false;
            if (task.ngayKt == null) return false;
            // Chưa quá hạn và còn trong vòng 3 ngày
            return !task.ngayKt!.isBefore(now) &&
                task.ngayKt!.isBefore(threeDaysLater);
          }).toList();

      setState(() {
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        title: Text(widget.project.tenDuAn),
        elevation: 0,
        backgroundColor: const Color(0xFF2563EB),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadOverview,
            tooltip: 'Tải lại',
          ),
        ],
      ),
      body: RefreshIndicator(onRefresh: _loadOverview, child: _buildContent()),
    );
  }

  Widget _buildContent() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(24),
        children: [_ErrorView(message: _error!, onRetry: _loadOverview)],
      );
    }

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(20),
      children: [
        _buildCompletionCard(),
        const SizedBox(height: 16),
        _buildStatisticsCard(),
        const SizedBox(height: 24),
        _buildTaskSection(
          title: 'Công việc còn lại',
          tasks: _remainingTasks,
          emptyMessage: 'Tất cả công việc đã hoàn thành! 🎉',
          icon: Icons.pending_actions,
          color: const Color(0xFFF59E0B),
        ),
        const SizedBox(height: 24),
        _buildTaskSection(
          title: 'Công việc sắp đến hạn',
          tasks: _upcomingTasks,
          emptyMessage: 'Không có công việc sắp đến hạn.',
          icon: Icons.schedule_outlined,
          color: const Color(0xFFF97316),
        ),
        const SizedBox(height: 24),
        _buildTaskSection(
          title: 'Công việc quá hạn',
          tasks: _overdueTasks,
          emptyMessage: 'Không có công việc quá hạn.',
          icon: Icons.warning_amber_rounded,
          color: const Color(0xFFEF4444),
        ),
        const SizedBox(height: 24),
        _buildTaskSection(
          title: 'Công việc đã hoàn thành',
          tasks: _completedTasks,
          emptyMessage: 'Chưa có công việc nào hoàn thành.',
          icon: Icons.check_circle_outline,
          color: const Color(0xFF10B981),
        ),
      ],
    );
  }

  Widget _buildCompletionCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF2563EB), Color(0xFF1D4ED8)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF2563EB).withOpacity(0.3),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.analytics_outlined,
                  color: Colors.white,
                  size: 28,
                ),
              ),
              const SizedBox(width: 16),
              const Expanded(
                child: Text(
                  'Tiến độ dự án',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Text(
            '${_completionPercent.toStringAsFixed(1)}%',
            style: const TextStyle(
              fontSize: 48,
              fontWeight: FontWeight.w800,
              color: Colors.white,
              height: 1,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'hoàn thành',
            style: TextStyle(
              fontSize: 16,
              color: Colors.white70,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 20),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: _completionPercent / 100,
              minHeight: 12,
              backgroundColor: Colors.white.withOpacity(0.3),
              valueColor: const AlwaysStoppedAnimation<Color>(Colors.white),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatisticsCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Tổng quan',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: Color(0xFF1F2937),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _StatCard(
                  icon: Icons.pending_actions,
                  label: 'Còn lại',
                  value: _remainingTasks.length.toString(),
                  color: const Color(0xFFF59E0B),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _StatCard(
                  icon: Icons.schedule_outlined,
                  label: 'Sắp hạn',
                  value: _upcomingTasks.length.toString(),
                  color: const Color(0xFFF97316),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _StatCard(
                  icon: Icons.warning_amber_rounded,
                  label: 'Quá hạn',
                  value: _overdueTasks.length.toString(),
                  color: const Color(0xFFEF4444),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _StatCard(
                  icon: Icons.check_circle,
                  label: 'Hoàn thành',
                  value: _completedTasks.length.toString(),
                  color: const Color(0xFF10B981),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTaskSection({
    required String title,
    required List<ProjectTask> tasks,
    required String emptyMessage,
    required IconData icon,
    required Color color,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, color: color, size: 24),
            const SizedBox(width: 8),
            Text(
              title,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: Color(0xFF1F2937),
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                tasks.length.toString(),
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: color,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (tasks.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE5E7EB)),
            ),
            child: Column(
              children: [
                Icon(
                  Icons.check_circle_outline,
                  size: 48,
                  color: Colors.grey.shade300,
                ),
                const SizedBox(height: 12),
                Text(
                  emptyMessage,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 15,
                    color: Color(0xFF6B7280),
                  ),
                ),
              ],
            ),
          )
        else
          ...tasks.map((task) => _buildTaskCard(task, color)),
      ],
    );
  }

  Widget _buildTaskCard(ProjectTask task, Color accentColor) {
    final dateFormat = DateFormat('dd/MM/yyyy');

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => _openTaskAssignments(task),
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        task.tenCongViec,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF1F2937),
                        ),
                      ),
                    ),
                    Icon(
                      Icons.arrow_forward_ios,
                      size: 16,
                      color: Colors.grey.shade400,
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: _getStatusColor(task.trangThai).withOpacity(0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        task.trangThai,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: _getStatusColor(task.trangThai),
                        ),
                      ),
                    ),
                    const Spacer(),
                    Text(
                      '${task.phamTramHoanThanh.toStringAsFixed(0)}%',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: accentColor,
                      ),
                    ),
                  ],
                ),
                if (task.ngayKt != null) ...[
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Icon(
                        Icons.event_outlined,
                        size: 16,
                        color: Colors.grey.shade600,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        'Hạn: ${dateFormat.format(task.ngayKt!)}',
                        style: TextStyle(
                          fontSize: 13,
                          color: Colors.grey.shade600,
                        ),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 12),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: task.phamTramHoanThanh / 100,
                    minHeight: 6,
                    backgroundColor: const Color(0xFFE5E7EB),
                    valueColor: AlwaysStoppedAnimation<Color>(accentColor),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Color _getStatusColor(String status) {
    final normalized = status.toLowerCase();
    if (normalized.contains('hoàn thành') || normalized.contains('complete')) {
      return const Color(0xFF10B981);
    }
    if (normalized.contains('đang') || normalized.contains('progress')) {
      return const Color(0xFF3B82F6);
    }
    if (normalized.contains('trễ') || normalized.contains('overdue')) {
      return const Color(0xFFEF4444);
    }
    return const Color(0xFF6B7280);
  }

  Future<void> _openTaskAssignments(ProjectTask task) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder:
            (_) => TaskAssignmentsScreen(
              task: task,
              groupId: widget.groupId,
              initialTabIndex: 0,
              showAssignmentsTab: true,
            ),
      ),
    );

    // Reload sau khi quay lại
    _loadOverview();
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withOpacity(0.05),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 32),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w800,
              color: color,
              height: 1,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: color.withOpacity(0.8),
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Column(
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
          'Không thể tải dữ liệu',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w600,
            color: Color(0xFF1F2937),
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          message,
          style: const TextStyle(fontSize: 14, color: Color(0xFF6B7280)),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 24),
        FilledButton.icon(
          onPressed: onRetry,
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFF2563EB),
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          icon: const Icon(Icons.refresh, size: 20),
          label: const Text('Thử lại'),
        ),
      ],
    );
  }
}
