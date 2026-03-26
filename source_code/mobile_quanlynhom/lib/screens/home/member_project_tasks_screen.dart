import 'dart:typed_data';

import 'package:file_selector/file_selector.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../models/project_task.dart';

import '../../constants/api_constants.dart';
import '../../models/member_task_overview.dart';
import '../../models/project_summary.dart';
import '../../services/group_service.dart';
import '../../widgets/custom_toast.dart';
import 'task_assignments_screen.dart';

enum TaskSortOption { nameAsc, nameDesc, progressDesc }

enum PriorityFilterOption { all, high, medium, low }

enum StatusFilterOption { all, notStarted, inProgress, completed }

class MemberProjectTasksScreen extends StatefulWidget {
  const MemberProjectTasksScreen({
    super.key,
    required this.project,
    required this.memberId,
    this.showAssignmentsTab = false,
    this.isEmbedded = false,
  });

  final ProjectSummary project;
  final int memberId;
  final bool showAssignmentsTab;
  final bool isEmbedded;

  @override
  State<MemberProjectTasksScreen> createState() =>
      _MemberProjectTasksScreenState();
}

class _MemberProjectTasksScreenState extends State<MemberProjectTasksScreen> {
  final GroupService _service = GroupService();

  MemberProjectTasksResult? _result;
  bool _loading = false;
  String? _error;
  final Set<String> _reportingSubTaskIds = <String>{};
  final Set<String> _deletingReportUrls = <String>{};

  final DateFormat _dateFormat = DateFormat('dd/MM/yyyy');
  final DateFormat _dateTimeFormat = DateFormat('dd/MM/yyyy HH:mm:ss');
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  TaskSortOption _sortOption = TaskSortOption.nameAsc;
  PriorityFilterOption _priorityFilter = PriorityFilterOption.all;
  StatusFilterOption _statusFilter = StatusFilterOption.all;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadData({bool showSpinner = true}) async {
    if (showSpinner) {
      setState(() {
        _loading = true;
        _error = null;
      });
    } else {
      setState(() {
        _error = null;
      });
    }

    try {
      final data = await _service.fetchMemberTasks(
        projectId: widget.project.duAnId,
        memberId: widget.memberId,
      );

      if (!mounted) return;
      setState(() {
        _result = data;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _result = null;
        _loading = false;
      });
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
                backgroundColor: const Color(0xFF2563EB),
                foregroundColor: Colors.white,
                elevation: 0,
                centerTitle: true,
                title: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Text(widget.project.tenDuAn, textAlign: TextAlign.center),
                    const SizedBox(height: 2),
                    Text(
                      'Công việc của tôi',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Colors.white.withOpacity(0.9),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
      body: RefreshIndicator(
        onRefresh: () => _loadData(showSpinner: false),
        child: _buildContent(context),
      ),
    );
  }

  Widget _buildContent(BuildContext context) {
    if (_loading) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [
          SizedBox(height: 160),
          Center(child: CircularProgressIndicator()),
          SizedBox(height: 160),
        ],
      );
    }

    if (_error != null) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(24),
        children: [_ErrorView(message: _error!, onRetry: _loadData)],
      );
    }

    final allTasks = _result?.danhSachCongViec ?? const <MemberTaskItem>[];

    if (allTasks.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(24),
        children: const [_EmptyView()],
      );
    }

    final filteredTasks = _applyFilters(allTasks);
    final summary = _result;

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
      children: [
        if (summary != null) _buildSummaryCard(summary),
        const SizedBox(height: 8),
        _buildControls(
          totalCount: allTasks.length,
          filteredCount: filteredTasks.length,
        ),
        const SizedBox(height: 16),
        if (filteredTasks.isEmpty)
          const _EmptyFilteredView()
        else
          ...filteredTasks.map(_buildTaskCard),
      ],
    );
  }

  List<MemberTaskItem> _applyFilters(List<MemberTaskItem> tasks) {
    var filtered =
        tasks.where((item) {
          final query = _searchQuery.trim().toLowerCase();
          if (query.isNotEmpty) {
            final matchesTaskName = item.congViec.tenCongViec
                .toLowerCase()
                .contains(query);
            final matchesSubtask = item.subTasks.any(
              (sub) => sub.moTa.toLowerCase().contains(query),
            );
            if (!matchesTaskName && !matchesSubtask) return false;
          }

          if (_statusFilter != StatusFilterOption.all) {
            final status = item.congViec.trangThai.toLowerCase();
            bool matchesStatus = false;
            switch (_statusFilter) {
              case StatusFilterOption.notStarted:
                matchesStatus =
                    status.contains('chưa') || status.contains('not');
                break;
              case StatusFilterOption.inProgress:
                matchesStatus =
                    status.contains('đang') || status.contains('progress');
                break;
              case StatusFilterOption.completed:
                matchesStatus =
                    status.contains('hoàn') || status.contains('complete');
                break;
              default:
                matchesStatus = true;
            }
            if (!matchesStatus) return false;
          }

          if (_priorityFilter != PriorityFilterOption.all) {
            final hasPriority = item.subTasks.any((sub) {
              final resolved = _resolvePriorityValue(sub.doUuTien);
              switch (_priorityFilter) {
                case PriorityFilterOption.high:
                  return resolved == PriorityFilterOption.high;
                case PriorityFilterOption.medium:
                  return resolved == PriorityFilterOption.medium;
                case PriorityFilterOption.low:
                  return resolved == PriorityFilterOption.low;
                default:
                  return true;
              }
            });
            if (!hasPriority) return false;
          }

          return true;
        }).toList();

    filtered.sort((a, b) {
      switch (_sortOption) {
        case TaskSortOption.nameAsc:
          return a.congViec.tenCongViec.toLowerCase().compareTo(
            b.congViec.tenCongViec.toLowerCase(),
          );
        case TaskSortOption.nameDesc:
          return b.congViec.tenCongViec.toLowerCase().compareTo(
            a.congViec.tenCongViec.toLowerCase(),
          );
        case TaskSortOption.progressDesc:
          final aProgress = _calculateAverageProgress(a.subTasks);
          final bProgress = _calculateAverageProgress(b.subTasks);
          return bProgress.compareTo(aProgress);
      }
    });

    return filtered;
  }

  double _calculateAverageProgress(List<MemberSubTask> subTasks) {
    if (subTasks.isEmpty) return 0;
    final total = subTasks.fold<double>(0, (sum, sub) {
      return sum + (_parseProgressPercent(sub.tienDoHoanThanh) ?? 0);
    });
    return total / subTasks.length;
  }

  Widget _buildControls({required int totalCount, required int filteredCount}) {
    const primary = Color(0xFF2563EB);
    const border = Color(0xFFE5E7EB);
    const textSecondary = Color(0xFF6B7280);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: border),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _searchController,
                  onChanged: (value) {
                    setState(() => _searchQuery = value);
                  },
                  decoration: InputDecoration(
                    hintText: 'Tìm kiếm công việc...',
                    hintStyle: const TextStyle(
                      color: textSecondary,
                      fontSize: 14,
                    ),
                    prefixIcon: const Icon(
                      Icons.search,
                      color: textSecondary,
                      size: 20,
                    ),
                    filled: true,
                    fillColor: Colors.white,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: border),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: border),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: primary, width: 1.5),
                    ),
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              _SortButton(
                sortOption: _sortOption,
                onChanged: (value) {
                  setState(() => _sortOption = value);
                },
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _FilterDropdown(
                  label: 'Trạng thái',
                  value: _statusFilter,
                  items: StatusFilterOption.values,
                  onChanged: (value) {
                    setState(() => _statusFilter = value!);
                  },
                  itemLabel: (option) {
                    switch (option) {
                      case StatusFilterOption.all:
                        return 'Tất cả trạng thái';
                      case StatusFilterOption.notStarted:
                        return 'Chưa bắt đầu';
                      case StatusFilterOption.inProgress:
                        return 'Đang làm';
                      case StatusFilterOption.completed:
                        return 'Hoàn thành';
                    }
                  },
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _FilterDropdown(
                  label: 'Ưu tiên',
                  value: _priorityFilter,
                  items: PriorityFilterOption.values,
                  onChanged: (value) {
                    setState(() => _priorityFilter = value!);
                  },
                  itemLabel: (option) {
                    switch (option) {
                      case PriorityFilterOption.all:
                        return 'Tất cả độ ưu tiên';
                      case PriorityFilterOption.high:
                        return 'Cao';
                      case PriorityFilterOption.medium:
                        return 'Trung bình';
                      case PriorityFilterOption.low:
                        return 'Thấp';
                    }
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '$filteredCount / $totalCount công việc',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: textSecondary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryCard(MemberProjectTasksResult result) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF9FAFB),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Tổng quan',
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Text(
            result.message ?? 'Danh sách công việc của bạn trong dự án.',
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: const Color(0xFF6B7280)),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _SummaryStat(
                label: 'Tổng công việc',
                value: result.tongSoCongViec.toString(),
              ),
              const SizedBox(width: 16),
              _SummaryStat(
                label: 'Sub-task',
                value: _countTotalSubtasks(result.danhSachCongViec).toString(),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTaskCard(MemberTaskItem item) {
    final summary = item.congViec;
    final subTasks = item.subTasks;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 0,
      color: Colors.white,
      shadowColor: Colors.transparent,
      child: ExpansionTile(
        title: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: Text(
                summary.tenCongViec,
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
              ),
            ),
            const SizedBox(width: 12),
            OutlinedButton.icon(
              onPressed:
                  () =>
                      _openComments(summary.congViecId, showAssignments: false),
              icon: const Icon(Icons.chat_bubble_outline, size: 18),
              label: const Text('Bình luận'),
            ),
          ],
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _StatusBadge(text: summary.trangThai),
              const SizedBox(height: 6),
              Text(
                _buildDateRange(summary),
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: const Color(0xFF6B7280)),
              ),
            ],
          ),
        ),
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        children:
            subTasks.isEmpty
                ? [const _EmptySubTaskView()]
                : subTasks
                    .map(
                      (subTask) => _buildSubTaskTile(
                        taskId: summary.congViecId,
                        subTask: subTask,
                      ),
                    )
                    .toList(growable: false),
      ),
    );
  }

  Widget _buildSubTaskTile({
    required int taskId,
    required MemberSubTask subTask,
  }) {
    final assignedDate =
        subTask.ngayPC != null
            ? _dateFormat.format(subTask.ngayPC!)
            : 'Chưa phân công';
    final normalizedPriority = _resolvePriorityLabel(subTask.doUuTien);
    final priorityStyle = _priorityStyle(subTask.doUuTien);
    final progressPercent = _parseProgressPercent(subTask.tienDoHoanThanh);
    final normalizedProgress = ((progressPercent ?? 0).clamp(0, 100)) / 100;
    final progressDisplay =
        progressPercent != null
            ? '${progressPercent.toStringAsFixed(progressPercent % 1 == 0 ? 0 : 1)}%'
            : (subTask.tienDoHoanThanh.isNotEmpty
                ? subTask.tienDoHoanThanh
                : '0%');
    final evaluationStyle = _evaluationStyle(subTask.danhGia);

    return Container(
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: const Color(0xFFF9FAFB),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            subTask.moTa,
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(
                Icons.calendar_today_outlined,
                size: 18,
                color: Color(0xFF9CA3AF),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Ngày phân công: $assignedDate',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: const Color(0xFF6B7280),
                    fontSize: 14,
                  ),
                ),
              ),
            ],
          ),
          if (subTask.ngayNop.isNotEmpty) ...[
            const SizedBox(height: 8),
            InkWell(
              onTap: () => _showSubmissionHistory(context, subTask.ngayNop),
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.history,
                      size: 18,
                      color: Color(0xFF2563EB),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Ngày nộp gần nhất: ${_dateFormat.format(subTask.ngayNop.last)} (${subTask.ngayNop.length} lần)',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: const Color(0xFF2563EB),
                          fontSize: 14,
                          decoration: TextDecoration.underline,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              Icon(
                Icons.flag_outlined,
                size: 20,
                color: priorityStyle.foreground,
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: priorityStyle.background,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  'Ưu tiên: $normalizedPriority',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: priorityStyle.foreground,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Text(
                'Tiến độ',
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
              ),
              Text(
                progressDisplay,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: _progressColor(progressPercent ?? 0),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: normalizedProgress,
              minHeight: 8,
              backgroundColor: const Color(0xFFE5E7EB),
              valueColor: AlwaysStoppedAnimation<Color>(
                _progressColor(progressPercent ?? 0),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: evaluationStyle.background,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.emoji_events_outlined,
                  size: 20,
                  color: evaluationStyle.foreground,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    subTask.danhGia,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: evaluationStyle.foreground,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (subTask.ketQuaThucHien.hasFiles ||
              subTask.ketQuaThucHien.hasNote) ...[
            const SizedBox(height: 12),
            Text(
              'Kết quả thực hiện',
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            if (subTask.ketQuaThucHien.hasNote) ...[
              Text(
                subTask.ketQuaThucHien.noiDung,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              if (subTask.ketQuaThucHien.hasFiles) const SizedBox(height: 10),
            ],
            if (subTask.ketQuaThucHien.hasFiles)
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children:
                    subTask.ketQuaThucHien.files
                        .map(
                          (filePath) => _buildAttachmentChip(
                            taskId: taskId,
                            subTask: subTask,
                            filePath: filePath,
                          ),
                        )
                        .toList(),
              ),
          ],
          const SizedBox(height: 16),
          Builder(
            builder: (context) {
              final isReporting = _reportingSubTaskIds.contains(
                subTask.subTaskId,
              );
              final isLocked = subTask.trangThaiKhoa == 1;
              return Align(
                alignment: Alignment.centerRight,
                child: FilledButton.icon(
                  onPressed:
                      (isReporting || isLocked)
                          ? null
                          : () => _onReportProgressFor(
                            taskId: taskId,
                            subTask: subTask,
                          ),
                  icon:
                      isReporting
                          ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                          : Icon(
                            isLocked ? Icons.lock : Icons.assignment_outlined,
                          ),
                  label: Text(
                    isReporting
                        ? 'Đang gửi...'
                        : (isLocked ? 'Đã khóa' : 'Báo cáo tiến độ'),
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Future<void> _openComments(
    int taskId, {
    required bool showAssignments,
  }) async {
    final projectTask = ProjectTask(
      congViecId: taskId,
      tenCongViec: _resolveTaskName(taskId),
      ngayBd: null,
      ngayKt: null,
      trangThai: '',
      phamTramHoanThanh: 0,
      anhBia: null,
    );

    if (!mounted) return;

    await Navigator.of(context).push(
      MaterialPageRoute(
        builder:
            (_) => TaskAssignmentsScreen(
              task: projectTask,
              groupId: widget.project.duAnId,
              initialTabIndex: 0,
              showAssignmentsTab: false,
            ),
      ),
    );
  }

  String _resolveTaskName(int taskId) {
    final tasks = _result?.danhSachCongViec ?? const <MemberTaskItem>[];
    final match = tasks.firstWhere(
      (item) => item.congViec.congViecId == taskId,
      orElse:
          () =>
              tasks.isNotEmpty
                  ? tasks.first
                  : MemberTaskItem(
                    congViec: MemberTaskSummary(
                      congViecId: taskId,
                      tenCongViec: 'Công việc',
                      trangThai: '',
                      ngayBatDau: null,
                      ngayKetThuc: null,
                    ),
                    thanhVienId: widget.memberId,
                    soLuongSubTask: 0,
                    subTasks: const [],
                  ),
    );
    return match.congViec.tenCongViec;
  }

  Widget _buildAttachmentChip({
    required int taskId,
    required MemberSubTask subTask,
    required String filePath,
  }) {
    final fileName = _prettifyFileName(filePath.split('/').last);
    final isDeleting = _deletingReportUrls.contains(filePath);
    final isLocked = subTask.trangThaiKhoa == 1;
    return InputChip(
      avatar: const Icon(Icons.attach_file, size: 18),
      label: Text(fileName, overflow: TextOverflow.ellipsis),
      onPressed: isDeleting ? null : () => _openAttachment(filePath),
      deleteIcon:
          (isDeleting || isLocked)
              ? (isDeleting
                  ? SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(
                        Theme.of(context).colorScheme.error,
                      ),
                    ),
                  )
                  : null)
              : Icon(
                Icons.delete_outline,
                color: Theme.of(context).colorScheme.error,
              ),
      onDeleted:
          (isDeleting || isLocked)
              ? null
              : () => _confirmDeleteReportFile(
                taskId: taskId,
                subTask: subTask,
                filePath: filePath,
              ),
    );
  }

  Future<void> _openAttachment(String rawPath) async {
    final resolved = _resolveAttachmentUrl(rawPath);
    final uri = Uri.tryParse(resolved);
    if (uri == null) {
      if (!mounted) return;
      CustomToast.show(
        context,
        message: 'Đường dẫn tệp không hợp lệ.',
        icon: Icons.error_outline,
        isError: true,
      );
      return;
    }

    try {
      final launched = await launchUrl(
        uri,
        mode: LaunchMode.externalApplication,
      );
      if (!launched && mounted) {
        CustomToast.show(
          context,
          message: 'Không thể mở tệp đính kèm.',
          icon: Icons.error_outline,
          isError: true,
        );
      }
    } catch (e) {
      if (!mounted) return;
      CustomToast.show(
        context,
        message: 'Mở tệp thất bại: $e',
        icon: Icons.error_outline,
        isError: true,
      );
    }
  }

  String _resolveAttachmentUrl(String path) {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    final base = ApiConstants.baseUrl;
    if (path.startsWith('/')) {
      return '$base$path';
    }
    return '$base/$path';
  }

  Future<void> _onReportProgressFor({
    required int taskId,
    required MemberSubTask subTask,
  }) async {
    if (!mounted) return;

    final result = await _promptReportPayload(subTask: subTask);
    if (!mounted || result == null) {
      return;
    }

    final selectedFiles = result.files;

    setState(() {
      _reportingSubTaskIds.add(subTask.subTaskId);
    });

    try {
      final mappedFiles = selectedFiles
          .map(
            (file) => ReportUploadFile(
              bytes: file.bytes,
              fileName: file.name,
              mimeType: _guessMimeType(file.name),
            ),
          )
          .toList(growable: false);

      // Cập nhật tiến độ trước
      if (result.progress != null && result.progress!.isNotEmpty) {
        try {
          await _service.updateSubTaskProgress(
            taskId: taskId,
            memberId: widget.memberId,
            subTaskId: subTask.subTaskId,
            progress: result.progress!,
          );
        } catch (progressError) {
          if (!mounted) return;
          CustomToast.show(
            context,
            message: 'Cập nhật tiến độ thất bại: $progressError',
            icon: Icons.warning_outlined,
            isError: true,
          );
        }
      }

      // Gửi báo cáo (với hoặc không có file)
      final message = await _service.submitMemberProgressReport(
        taskId: taskId,
        memberId: widget.memberId,
        subTaskId: subTask.subTaskId,
        noiDung: result.note,
        files: mappedFiles,
      );

      // Thêm ngày nộp sau khi báo cáo thành công
      try {
        await _service.addSubmissionDate(
          taskId: taskId,
          memberId: widget.memberId,
          submissionDate: DateTime.now(),
        );
      } catch (dateError) {
        debugPrint(
          '[ReportProgress] Failed to add submission date: $dateError',
        );
      }

      if (!mounted) return;
      CustomToast.show(
        context,
        message: message,
        icon: Icons.check_circle_outline,
      );

      // Cập nhật tiến độ công việc sau khi báo cáo
      try {
        await _service.updateTaskProgress(taskId: taskId);
      } catch (e) {
        debugPrint('[ReportProgress] Failed to update task progress: $e');
      }

      await _loadData(showSpinner: false);
    } catch (e) {
      if (!mounted) return;
      CustomToast.show(
        context,
        message: 'Gửi báo cáo thất bại: $e',
        icon: Icons.error_outline,
        isError: true,
      );
    } finally {
      if (mounted) {
        setState(() {
          _reportingSubTaskIds.remove(subTask.subTaskId);
        });
      }
    }
  }

  Future<_ReportPayload?> _promptReportPayload({
    required MemberSubTask subTask,
  }) async {
    // Load nội dung báo cáo cũ
    final oldNote = subTask.ketQuaThucHien.noiDung;
    final oldProgress = subTask.tienDoHoanThanh;

    final noteController = TextEditingController(text: oldNote);
    final files = <_SelectedReportFile>[];
    bool pickingFiles = false;
    String? fileError;

    // Progress tracking
    final List<String> progressOptions = [
      '0%',
      '5%',
      '10%',
      '15%',
      '20%',
      '25%',
      '30%',
      '35%',
      '40%',
      '45%',
      '50%',
      '55%',
      '60%',
      '65%',
      '70%',
      '75%',
      '80%',
      '85%',
      '90%',
      '95%',
      '100%',
    ];
    String selectedProgress = oldProgress.isNotEmpty ? oldProgress : '0%';

    Future<void> pickFiles(StateSetter setState) async {
      setState(() {
        pickingFiles = true;
        fileError = null;
      });
      try {
        final result = await openFiles();
        if (result.isEmpty) {
          setState(() {
            pickingFiles = false;
          });
          return;
        }

        final picked = await Future.wait(
          result.map((xFile) async {
            final bytes = await xFile.readAsBytes();
            return _SelectedReportFile(name: xFile.name, bytes: bytes);
          }),
        );

        setState(() {
          files
            ..clear()
            ..addAll(picked);
          pickingFiles = false;
        });
      } catch (e) {
        setState(() {
          pickingFiles = false;
          fileError = 'Không thể chọn tệp: $e';
        });
      }
    }

    final payload = await showDialog<_ReportPayload>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setState) {
            return AlertDialog(
              title: const Text('Báo cáo tiến độ'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextField(
                      controller: noteController,
                      maxLines: 4,
                      decoration: const InputDecoration(
                        hintText: 'Nhập nội dung (không bắt buộc)',
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Tiến độ hoàn thành',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      value: selectedProgress,
                      items:
                          progressOptions
                              .map(
                                (option) => DropdownMenuItem<String>(
                                  value: option,
                                  child: Text(option),
                                ),
                              )
                              .toList(),
                      onChanged: (value) {
                        if (value != null) {
                          setState(() {
                            selectedProgress = value;
                          });
                        }
                      },
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: const Color(0xFFF9FAFB),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(
                            color: Color(0xFFE5E7EB),
                          ),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(
                            color: Color(0xFFE5E7EB),
                          ),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(
                            color: Color(0xFF2563EB),
                            width: 1.5,
                          ),
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 12,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Tệp đính kèm',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 8),
                    OutlinedButton.icon(
                      onPressed:
                          pickingFiles ? null : () => pickFiles(setState),
                      icon:
                          pickingFiles
                              ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                              : const Icon(Icons.attach_file_outlined),
                      label: Text(pickingFiles ? 'Đang chọn tệp…' : 'Chọn tệp'),
                    ),
                    if (fileError != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        fileError!,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                        ),
                      ),
                    ],
                    if (files.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children:
                            files
                                .map(
                                  (file) => Chip(
                                    avatar: const Icon(
                                      Icons.insert_drive_file_outlined,
                                      size: 18,
                                    ),
                                    label: Text(
                                      file.name,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                )
                                .toList(),
                      ),
                    ],
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(dialogContext).pop(),
                  child: const Text('Huỷ'),
                ),
                FilledButton(
                  onPressed: () {
                    Navigator.of(dialogContext).pop(
                      _ReportPayload(
                        note:
                            noteController.text.trim().isEmpty
                                ? null
                                : noteController.text.trim(),
                        files: List.unmodifiable(files),
                        progress: selectedProgress,
                      ),
                    );
                  },
                  child: const Text('Gửi'),
                ),
              ],
            );
          },
        );
      },
    );

    return payload;
  }

  String? _guessMimeType(String fileName) {
    final lower = fileName.toLowerCase();
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.pdf')) return 'application/pdf';
    if (lower.endsWith('.doc') || lower.endsWith('.docx'))
      return 'application/msword';
    if (lower.endsWith('.xls') || lower.endsWith('.xlsx')) {
      return 'application/vnd.ms-excel';
    }
    if (lower.endsWith('.ppt') || lower.endsWith('.pptx')) {
      return 'application/vnd.ms-powerpoint';
    }
    if (lower.endsWith('.txt')) return 'text/plain';
    return null;
  }

  String _prettifyFileName(String rawFileName) {
    final trimmed = rawFileName.trim();
    if (trimmed.isEmpty) return 'tập tin';

    final uuidPattern = RegExp(
      r'^[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}_',
    );
    final shortCodePattern = RegExp(r'^[A-Za-z0-9\-]{8,}_');

    final uuidMatch = uuidPattern.matchAsPrefix(trimmed);
    if (uuidMatch != null) {
      final candidate = trimmed.substring(uuidMatch.end);
      if (candidate.isNotEmpty) return candidate;
    }

    final shortCodeMatch = shortCodePattern.matchAsPrefix(trimmed);
    if (shortCodeMatch != null) {
      final candidate = trimmed.substring(shortCodeMatch.end);
      if (candidate.isNotEmpty) return candidate;
    }

    return trimmed;
  }

  Future<void> _confirmDeleteReportFile({
    required int taskId,
    required MemberSubTask subTask,
    required String filePath,
  }) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        final prettyName = _prettifyFileName(filePath.split('/').last);
        return AlertDialog(
          title: const Text('Xoá file báo cáo'),
          content: Text('Bạn có chắc muốn xoá "$prettyName" khỏi báo cáo?'),
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

    setState(() {
      _deletingReportUrls.add(filePath);
    });

    try {
      final message = await _service.deleteMemberProgressReportFile(
        taskId: taskId,
        memberId: widget.memberId,
        subTaskId: subTask.subTaskId,
        fileUrl: filePath,
      );

      if (!mounted) return;
      CustomToast.show(context, message: message, icon: Icons.delete_outline);

      await _loadData(showSpinner: false);
    } catch (e) {
      if (!mounted) return;
      CustomToast.show(
        context,
        message: 'Xoá file thất bại: $e',
        icon: Icons.error_outline,
        isError: true,
      );
    } finally {
      if (mounted) {
        setState(() {
          _deletingReportUrls.remove(filePath);
        });
      }
    }
  }

  double? _parseProgressPercent(String raw) {
    final trimmed = raw.trim();
    if (trimmed.isEmpty) return null;
    final normalized = trimmed.replaceAll('%', '').replaceAll(',', '.');
    final value = double.tryParse(normalized);
    if (value == null) return null;
    return value;
  }

  Color _progressColor(double percent) {
    final value = percent.clamp(0, 100);
    if (value >= 80) return const Color(0xFF10B981);
    if (value >= 50) return const Color(0xFFF59E0B);
    if (value > 0) return const Color(0xFFEF4444);
    return const Color(0xFF9CA3AF);
  }

  _BadgeStyle _priorityStyle(String rawPriority) {
    final normalized = rawPriority.trim().toLowerCase();
    if (normalized.contains('cao') || normalized.contains('high')) {
      return const _BadgeStyle(
        background: Color(0xFFFEE2E2),
        foreground: Color(0xFFDC2626),
      );
    }
    if (normalized.contains('trung') || normalized.contains('medium')) {
      return const _BadgeStyle(
        background: Color(0xFFFEF3C7),
        foreground: Color(0xFFD97706),
      );
    }
    if (normalized.contains('thấp') || normalized.contains('low')) {
      return const _BadgeStyle(
        background: Color(0xFFD1FAE5),
        foreground: Color(0xFF059669),
      );
    }
    return const _BadgeStyle(
      background: Color(0xFFF3F4F6),
      foreground: Color(0xFF6B7280),
    );
  }

  String _resolvePriorityLabel(String rawPriority) {
    switch (_resolvePriorityValue(rawPriority)) {
      case PriorityFilterOption.high:
        return 'Cao';
      case PriorityFilterOption.medium:
        return 'Trung bình';
      case PriorityFilterOption.low:
        return 'Thấp';
      case PriorityFilterOption.all:
        return rawPriority.trim().isEmpty ? 'Không rõ' : rawPriority;
    }
  }

  PriorityFilterOption _resolvePriorityValue(String rawPriority) {
    final normalized = rawPriority.trim().toLowerCase();
    if (normalized.contains('cao') || normalized == 'high') {
      return PriorityFilterOption.high;
    }
    if (normalized.contains('trung') ||
        normalized.contains('binh') ||
        normalized == 'medium') {
      return PriorityFilterOption.medium;
    }
    if (normalized.contains('thấp') ||
        normalized.contains('thap') ||
        normalized == 'low') {
      return PriorityFilterOption.low;
    }
    return PriorityFilterOption.all;
  }

  _BadgeStyle _evaluationStyle(String rawEvaluation) {
    final normalized = rawEvaluation.trim().toLowerCase();
    if (normalized.isEmpty) {
      return const _BadgeStyle(
        background: Color(0xFFF3F4F6),
        foreground: Color(0xFF6B7280),
      );
    }
    if (normalized.contains('tốt') ||
        normalized.contains('hoàn thành') ||
        normalized.contains('đạt') ||
        normalized.contains('excellent') ||
        normalized.contains('good')) {
      return const _BadgeStyle(
        background: Color(0xFFD1FAE5),
        foreground: Color(0xFF059669),
      );
    }
    if (normalized.contains('chưa') ||
        normalized.contains('kém') ||
        normalized.contains('không') ||
        normalized.contains('poor') ||
        normalized.contains('bad') ||
        normalized.contains('trễ') ||
        normalized.contains('chậm')) {
      return const _BadgeStyle(
        background: Color(0xFFFEE2E2),
        foreground: Color(0xFFDC2626),
      );
    }
    return const _BadgeStyle(
      background: Color(0xFFFEF3C7),
      foreground: Color(0xFFD97706),
    );
  }

  String _buildDateRange(MemberTaskSummary summary) {
    final start =
        summary.ngayBatDau != null
            ? _dateFormat.format(summary.ngayBatDau!)
            : '---';
    final end =
        summary.ngayKetThuc != null
            ? _dateFormat.format(summary.ngayKetThuc!)
            : '---';
    return 'Từ $start đến $end';
  }

  int _countTotalSubtasks(List<MemberTaskItem> items) {
    if (items.isEmpty) return 0;
    return items.fold<int>(0, (acc, item) => acc + item.subTasks.length);
  }

  void _showSubmissionHistory(BuildContext context, List<DateTime> ngayNop) {
    showDialog(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: Row(
            children: [
              const Icon(Icons.history, color: Color(0xFF2563EB)),
              const SizedBox(width: 8),
              const Text('Lịch sử nộp bài'),
            ],
          ),
          content: SizedBox(
            width: double.maxFinite,
            child: ListView.separated(
              shrinkWrap: true,
              itemCount: ngayNop.length,
              separatorBuilder: (_, __) => const Divider(height: 16),
              itemBuilder: (context, index) {
                final reversedIndex = ngayNop.length - 1 - index;
                final date = ngayNop[reversedIndex];
                return ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: CircleAvatar(
                    backgroundColor: const Color(0xFFEFF6FF),
                    child: Text(
                      '${reversedIndex + 1}',
                      style: const TextStyle(
                        color: Color(0xFF2563EB),
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  title: Text(
                    _dateTimeFormat.format(date),
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  subtitle: Text(
                    'Lần ${reversedIndex + 1}',
                    style: const TextStyle(
                      color: Color(0xFF6B7280),
                      fontSize: 12,
                    ),
                  ),
                );
              },
            ),
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
  }
}

class _SummaryStat extends StatelessWidget {
  const _SummaryStat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          color: Colors.white,
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              value,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w700,
                color: const Color(0xFF2563EB),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: const Color(0xFF6B7280)),
            ),
          ],
        ),
      ),
    );
  }
}

class _SelectedReportFile {
  const _SelectedReportFile({required this.name, required this.bytes});

  final String name;
  final Uint8List bytes;
}

class _ReportPayload {
  const _ReportPayload({required this.files, this.note, this.progress});

  final List<_SelectedReportFile> files;
  final String? note;
  final String? progress;
}

class _BadgeStyle {
  const _BadgeStyle({required this.background, required this.foreground});

  final Color background;
  final Color foreground;
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFFD1FAE5),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        text,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: const Color(0xFF059669),
          fontWeight: FontWeight.w600,
          fontSize: 12,
        ),
      ),
    );
  }
}

class _EmptyView extends StatelessWidget {
  const _EmptyView();

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.inbox_outlined, size: 64, color: Colors.grey.shade300),
        const SizedBox(height: 16),
        Text(
          'Bạn chưa có công việc nào trong dự án này.',
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 15, color: Color(0xFF1F2937)),
        ),
        const SizedBox(height: 8),
        const Text(
          'Hãy chờ trưởng nhóm phân công nhiệm vụ cho bạn nhé!',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
        ),
      ],
    );
  }
}

class _EmptySubTaskView extends StatelessWidget {
  const _EmptySubTaskView();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          Icon(Icons.inbox_outlined, color: Colors.grey.shade500),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Chưa có sub-task nào.',
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(color: Colors.grey.shade600),
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
          'Không thể tải danh sách công việc.',
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

class _EmptyFilteredView extends StatelessWidget {
  const _EmptyFilteredView();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(32.0),
      child: Column(
        children: [
          Icon(Icons.search_off, size: 64, color: Colors.grey.shade300),
          const SizedBox(height: 16),
          const Text(
            'Không tìm thấy công việc phù hợp.',
            style: TextStyle(fontSize: 15, color: Color(0xFF6B7280)),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

class _SortButton extends StatelessWidget {
  const _SortButton({required this.sortOption, required this.onChanged});

  final TaskSortOption sortOption;
  final ValueChanged<TaskSortOption> onChanged;

  @override
  Widget build(BuildContext context) {
    const primary = Color(0xFF2563EB);
    const border = Color(0xFFE5E7EB);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: border),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => _showSortMenu(context),
          borderRadius: BorderRadius.circular(12),
          child: const Padding(
            padding: EdgeInsets.all(12),
            child: Icon(Icons.sort, color: primary, size: 24),
          ),
        ),
      ),
    );
  }

  void _showSortMenu(BuildContext context) {
    const primary = Color(0xFF2563EB);
    const textSecondary = Color(0xFF6B7280);

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
                const Row(
                  children: [
                    Icon(Icons.sort, color: primary),
                    SizedBox(width: 12),
                    Text(
                      'Sắp xếp theo',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                ...TaskSortOption.values.map((option) {
                  final isSelected = option == sortOption;
                  return ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 8),
                    leading: Icon(
                      isSelected
                          ? Icons.radio_button_checked
                          : Icons.radio_button_unchecked,
                      color: isSelected ? primary : textSecondary,
                    ),
                    title: Text(
                      _getSortLabel(option),
                      style: TextStyle(
                        fontWeight:
                            isSelected ? FontWeight.w600 : FontWeight.normal,
                        color: isSelected ? primary : Colors.black87,
                      ),
                    ),
                    onTap: () {
                      Navigator.of(context).pop();
                      onChanged(option);
                    },
                  );
                }).toList(),
              ],
            ),
          ),
        );
      },
    );
  }

  String _getSortLabel(TaskSortOption option) {
    switch (option) {
      case TaskSortOption.nameAsc:
        return 'Tên (A → Z)';
      case TaskSortOption.nameDesc:
        return 'Tên (Z → A)';
      case TaskSortOption.progressDesc:
        return 'Tiến độ cao trước';
    }
  }
}

class _FilterDropdown<T> extends StatelessWidget {
  const _FilterDropdown({
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
    required this.itemLabel,
  });

  final String label;
  final T value;
  final List<T> items;
  final ValueChanged<T?> onChanged;
  final String Function(T) itemLabel;

  @override
  Widget build(BuildContext context) {
    const border = Color(0xFFE5E7EB);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: border),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<T>(
          value: value,
          isExpanded: true,
          isDense: true,
          items:
              items
                  .map(
                    (item) => DropdownMenuItem<T>(
                      value: item,
                      child: Text(
                        itemLabel(item),
                        style: const TextStyle(fontSize: 14),
                      ),
                    ),
                  )
                  .toList(),
          onChanged: onChanged,
        ),
      ),
    );
  }
}
