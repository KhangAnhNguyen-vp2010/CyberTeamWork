import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile_quanlynhom/services/local_notification_service.dart';

import '../../constants/api_constants.dart';
import '../../models/project_task.dart';
import '../../models/task_assignment.dart';
import '../../models/task_comment.dart';
import '../../models/group_member.dart';
import '../../services/group_service.dart';
import '../../services/ai_suggestion_service.dart';
import '../../widgets/custom_toast.dart';
import 'subtask_detail_screen.dart';

enum AssignmentSortOption { nameAsc, nameDesc, taskCountDesc }

extension AssignmentSortOptionX on AssignmentSortOption {
  String get label {
    switch (this) {
      case AssignmentSortOption.nameAsc:
        return 'Tên (A → Z)';
      case AssignmentSortOption.nameDesc:
        return 'Tên (Z → A)';
      case AssignmentSortOption.taskCountDesc:
        return 'Nhiệm vụ nhiều nhất';
    }
  }
}

enum PriorityFilter { all, high, medium, low }

extension PriorityFilterX on PriorityFilter {
  String get label {
    switch (this) {
      case PriorityFilter.all:
        return 'Tất cả ưu tiên';
      case PriorityFilter.high:
        return 'Ưu tiên cao';
      case PriorityFilter.medium:
        return 'Ưu tiên trung bình';
      case PriorityFilter.low:
        return 'Ưu tiên thấp';
    }
  }
}

class TaskAssignmentsScreen extends StatefulWidget {
  const TaskAssignmentsScreen({
    super.key,
    required this.task,
    required this.groupId,
    this.initialTabIndex = 0,
    this.showAssignmentsTab = true,
  });

  final ProjectTask task;
  final int groupId;
  final int initialTabIndex;
  final bool showAssignmentsTab;

  @override
  State<TaskAssignmentsScreen> createState() => _TaskAssignmentsScreenState();
}

class _TaskAssignmentsScreenState extends State<TaskAssignmentsScreen>
    with SingleTickerProviderStateMixin {
  late final bool _hasAssignmentsTab;
  late TabController _tabController;
  static const Map<String, String> _priorityOptions = {
    'cao': 'Cao',
    'trungbinh': 'Trung bình',
    'thap': 'Thấp',
  };

  final GroupService _service = GroupService();
  List<TaskAssignment> _assignments = const [];
  List<TaskComment> _comments = const [];
  bool _isLoading = false;
  bool _commentsLoading = false;
  String? _error;
  String? _commentsError;
  final TextEditingController _searchController = TextEditingController();
  final TextEditingController _commentController = TextEditingController();
  final FocusNode _commentFocusNode = FocusNode();
  final ScrollController _assignmentsScrollController = ScrollController();
  AssignmentSortOption _sortOption = AssignmentSortOption.nameAsc;
  PriorityFilter _priorityFilter = PriorityFilter.all;
  String _searchQuery = '';
  int _currentPage = 0;
  static const int _pageSize = 4;
  final Set<int> _expandedMembers = <int>{};
  bool _creatingSubtask = false;
  String? _editingSubtaskId;
  final Set<String> _deletingSubtaskIds = <String>{};
  int? _currentMemberId;
  String? _currentUserEmail;
  bool _submittingComment = false;
  int? _editingCommentId;
  final Set<int> _deletingCommentIds = <int>{};
  Timer? _commentsTimer;
  bool _isFetchingComments = false;
  List<GroupMember> _groupMembers = const [];
  bool _membersLoading = false;
  String? _membersError;

  @override
  void initState() {
    super.initState();
    _hasAssignmentsTab = widget.showAssignmentsTab;
    _tabController = TabController(
      length: _hasAssignmentsTab ? 2 : 1,
      vsync: this,
      initialIndex: _hasAssignmentsTab ? widget.initialTabIndex.clamp(0, 1) : 0,
    );
    _tabController.addListener(_onTabChanged);
    if (_hasAssignmentsTab) {
      _loadAssignments();
      _loadGroupMembers();
    }
    _resolveCurrentMemberId();

    // Load comments if starting on comments tab
    final isCommentsTab =
        _hasAssignmentsTab
            ? _tabController.index == 1
            : _tabController.index == 0;
    if (isCommentsTab) {
      _loadComments();
      _startCommentsPolling();
    }
  }

  void _onTabChanged() {
    if (!_tabController.indexIsChanging) return;

    // Check if switched to comments tab
    final isCommentsTab =
        _hasAssignmentsTab
            ? _tabController.index == 1
            : _tabController.index == 0;
    if (isCommentsTab) {
      _loadComments();
      _startCommentsPolling();
    } else {
      _stopCommentsPolling();
    }
  }

  void _stopCommentsPolling() {
    _commentsTimer?.cancel();
    _commentsTimer = null;
  }

  @override
  void dispose() {
    _tabController.removeListener(_onTabChanged);
    _tabController.dispose();
    _searchController.dispose();
    _assignmentsScrollController.dispose();
    _commentController.dispose();
    _commentFocusNode.dispose();
    _stopCommentsPolling();
    super.dispose();
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
                    _formatDateTimeWithSeconds(date),
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

  Future<void> _loadAssignments({bool showLoading = true}) async {
    if (showLoading) {
      setState(() {
        _isLoading = true;
        _error = null;
      });
    } else {
      setState(() {
        _error = null;
      });
    }

    try {
      final assignments = await _service.fetchTaskAssignments(
        taskId: widget.task.congViecId,
      );
      if (!mounted) return;
      setState(() {
        _assignments = assignments;
        _expandedMembers.clear();
        _currentPage = 0;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
      });
    } finally {
      if (showLoading && mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _confirmDeleteSubtask({
    required TaskAssignment assignment,
    required AssignmentDetail detail,
  }) async {
    final subTaskId = detail.subTaskId.trim();
    if (subTaskId.isEmpty) {
      CustomToast.show(
        context,
        message: 'Không thể xoá vì thiếu mã công việc con.',
        icon: Icons.error_outline,
        isError: true,
      );
      return;
    }

    // Kiểm tra task cha đã hoàn thành
    if (widget.task.trangThai.toLowerCase() == 'hoàn thành') {
      await showDialog<void>(
        context: context,
        builder: (dialogContext) {
          return AlertDialog(
            title: const Text('Không thể xoá'),
            content: const Text(
              'Không thể xoá công việc con vì task cha đã hoàn thành.',
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

    // Kiểm tra xem subtask đã hoàn thành 100% hoặc đã bị khoá
    if (detail.trangThaiKhoa == 1 || detail.tienDoHoanThanh == '100%') {
      String message;
      if (detail.trangThaiKhoa == 1 && detail.tienDoHoanThanh == '100%') {
        message =
            'Không thể xoá công việc con đã hoàn thành 100% và đã bị khoá.';
      } else if (detail.trangThaiKhoa == 1) {
        message = 'Không thể xoá công việc con đã bị khoá.';
      } else {
        message = 'Không thể xoá công việc con đã hoàn thành 100%.';
      }

      await showDialog<void>(
        context: context,
        builder: (dialogContext) {
          return AlertDialog(
            title: const Text('Không thể xoá'),
            content: Text(message),
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

    final confirm = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Xoá công việc con'),
          content: Text(
            'Bạn có chắc chắn muốn xoá công việc "${detail.moTa}" khỏi ${assignment.hoTen}? '
            'Thao tác này không thể hoàn tác.',
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

    if (confirm != true) return;

    final previousPage = _currentPage;
    final previousExpanded = Set<int>.from(_expandedMembers)
      ..add(assignment.thanhVienId);

    setState(() => _deletingSubtaskIds.add(subTaskId));

    try {
      final message = await _service.deleteAssignmentItem(
        taskId: widget.task.congViecId,
        memberId: assignment.thanhVienId,
        subTaskId: subTaskId,
      );

      await _loadAssignments(showLoading: false);
      if (!mounted) return;

      final filtered = _filteredAssignments();
      final targetIndex = filtered.indexWhere(
        (item) => item.thanhVienId == assignment.thanhVienId,
      );
      final totalPages = math.max(1, (filtered.length / _pageSize).ceil());
      final restoredPage =
          targetIndex >= 0
              ? (targetIndex ~/ _pageSize)
              : previousPage.clamp(0, totalPages - 1);

      setState(() {
        _currentPage = restoredPage;
        _expandedMembers
          ..clear()
          ..addAll(previousExpanded);
      });

      CustomToast.show(
        context,
        message: message,
        icon: Icons.check_circle_outline,
      );
    } catch (e) {
      if (!mounted) return;
      CustomToast.show(
        context,
        message: 'Không thể xoá: $e',
        icon: Icons.error_outline,
        isError: true,
      );
    } finally {
      if (mounted) {
        setState(() => _deletingSubtaskIds.remove(subTaskId));
      } else {
        _deletingSubtaskIds.remove(subTaskId);
      }
    }
  }

  String _resolvePriorityValue(String raw) {
    switch (_priorityKey(raw)) {
      case 'high':
        return 'cao';
      case 'medium':
        return 'trungbinh';
      case 'low':
        return 'thap';
      default:
        return 'trungbinh';
    }
  }

  Future<void> _openEditSubtaskDialog({
    required TaskAssignment assignment,
    required AssignmentDetail detail,
  }) async {
    final subTaskId = detail.subTaskId.trim();
    if (subTaskId.isEmpty) {
      CustomToast.show(
        context,
        message: 'Không thể chỉnh sửa vì thiếu mã công việc con.',
        icon: Icons.error_outline,
        isError: true,
      );
      return;
    }

    final descriptionController = TextEditingController(text: detail.moTa);
    final DateTime selectedDate = detail.ngayPhanCong ?? DateTime.now();
    String selectedPriority = _resolvePriorityValue(detail.doUuTien);
    String? errorMessage;

    String formatDisplayDate(DateTime date) {
      return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
    }

    final message = await showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (localContext, setDialogState) {
            final isSubmitting = _editingSubtaskId == detail.subTaskId;

            return AlertDialog(
              title: const Text('Chỉnh sửa công việc con'),
              content: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                      controller: descriptionController,
                      maxLines: 3,
                      decoration: const InputDecoration(
                        labelText: 'Mô tả công việc',
                        hintText: 'Nhập nội dung công việc con...',
                        border: OutlineInputBorder(),
                      ),
                      enabled: !isSubmitting,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Ngày phân công',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 12,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.blue.shade50,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.blue.shade100),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            formatDisplayDate(selectedDate),
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                          Icon(
                            Icons.schedule,
                            size: 18,
                            color: Theme.of(context).colorScheme.primary,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Độ ưu tiên',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<String>(
                      value: selectedPriority,
                      items: _priorityOptions.entries
                          .map(
                            (entry) => DropdownMenuItem<String>(
                              value: entry.key,
                              child: Text(entry.value),
                            ),
                          )
                          .toList(growable: false),
                      onChanged:
                          isSubmitting
                              ? null
                              : (value) {
                                if (value != null) {
                                  setDialogState(
                                    () => selectedPriority = value,
                                  );
                                }
                              },
                      decoration: const InputDecoration(
                        border: OutlineInputBorder(),
                      ),
                    ),
                    if (errorMessage != null) ...[
                      const SizedBox(height: 12),
                      Text(
                        errorMessage!,
                        style: const TextStyle(color: Colors.redAccent),
                      ),
                    ],
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed:
                      isSubmitting
                          ? null
                          : () => Navigator.of(dialogContext).pop(),
                  child: const Text('Huỷ'),
                ),
                FilledButton.icon(
                  onPressed:
                      isSubmitting
                          ? null
                          : () async {
                            final description =
                                descriptionController.text.trim();
                            if (description.isEmpty) {
                              setDialogState(
                                () =>
                                    errorMessage =
                                        'Vui lòng nhập mô tả công việc.',
                              );
                              return;
                            }

                            setDialogState(() => errorMessage = null);
                            setState(() => _editingSubtaskId = subTaskId);

                            try {
                              final responseMessage = await _service
                                  .updateAssignmentItem(
                                    taskId: widget.task.congViecId,
                                    memberId: assignment.thanhVienId,
                                    subTaskId: subTaskId,
                                    description: description,
                                    assignedDate: selectedDate,
                                    priority: selectedPriority,
                                  );
                              if (!mounted) return;
                              Navigator.of(dialogContext).pop(responseMessage);
                            } catch (e) {
                              if (!mounted) return;
                              setDialogState(
                                () => errorMessage = 'Không thể cập nhật: $e',
                              );
                            } finally {
                              if (mounted) {
                                setState(() => _editingSubtaskId = null);
                              }
                            }
                          },
                  icon:
                      isSubmitting
                          ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.2,
                              color: Colors.white,
                            ),
                          )
                          : const Icon(Icons.save_rounded),
                  label: Text(isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'),
                ),
              ],
            );
          },
        );
      },
    );

    descriptionController.dispose();

    if (message != null && mounted) {
      final previousPage = _currentPage;
      final previousExpanded = Set<int>.from(_expandedMembers)
        ..add(assignment.thanhVienId);

      await _loadAssignments(showLoading: false);
      if (!mounted) return;

      final filtered = _filteredAssignments();
      final targetIndex = filtered.indexWhere(
        (item) => item.thanhVienId == assignment.thanhVienId,
      );
      final totalPages = math.max(1, (filtered.length / _pageSize).ceil());
      final restoredPage =
          targetIndex >= 0
              ? (targetIndex ~/ _pageSize)
              : previousPage.clamp(0, totalPages - 1);

      setState(() {
        _currentPage = restoredPage;
        _expandedMembers
          ..clear()
          ..addAll(previousExpanded);
      });

      CustomToast.show(
        context,
        message: message,
        icon: Icons.check_circle_outline,
      );
    }
  }

  Future<void> _loadGroupMembers() async {
    setState(() {
      _membersLoading = true;
      _membersError = null;
    });

    try {
      final members = await _service.fetchGroupMembers(groupId: widget.groupId);
      if (!mounted) return;
      setState(() {
        _groupMembers = members;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _membersError = e.toString();
        _groupMembers = const [];
      });
    } finally {
      if (mounted) {
        setState(() {
          _membersLoading = false;
        });
      }
    }
  }

  Future<void> _openCreateSubtaskDialog() async {
    // Kiểm tra trạng thái task và tiến độ
    if (widget.task.trangThai.toLowerCase() == 'hoàn thành' ||
        widget.task.phamTramHoanThanh >= 100) {
      await showDialog<void>(
        context: context,
        builder: (dialogContext) {
          return AlertDialog(
            title: const Text('Không thể thêm'),
            content: const Text(
              'Không thể thêm công việc con vào task đã hoàn thành hoặc đạt 100% tiến độ.',
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

    if (_membersLoading) {
      CustomToast.show(
        context,
        message: 'Đang tải danh sách thành viên. Vui lòng thử lại sau.',
        icon: Icons.info_outline,
      );
      return;
    }

    if (_groupMembers.isEmpty) {
      await _loadGroupMembers();
      if (!mounted) return;
      if (_groupMembers.isEmpty) {
        CustomToast.show(
          context,
          message:
              _membersError != null
                  ? 'Không thể tải danh sách thành viên: $_membersError'
                  : 'Chưa có thành viên nào trong nhóm.',
          icon: Icons.error_outline,
          isError: true,
        );
        return;
      }
    }

    final descriptionController = TextEditingController();
    final DateTime selectedDate = DateTime.now();
    String selectedPriority = 'cao';
    String? errorMessage;
    int? selectedMemberId =
        _groupMembers.isNotEmpty ? _groupMembers.first.thanhVienId : null;
    int? createdMemberId;
    String? createdMemberName;
    String? createdDescription;
    bool fetchingAiSuggestions = false;
    List<MemberSuggestion> aiSuggestions = [];

    String formatDisplayDate(DateTime date) {
      return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
    }

    final message = await showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (localContext, setDialogState) {
            final isSubmitting = _creatingSubtask;

            return AlertDialog(
              title: const Text('Thêm công việc con'),
              content: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Nút AI gợi ý
                    OutlinedButton.icon(
                      onPressed:
                          fetchingAiSuggestions || isSubmitting
                              ? null
                              : () async {
                                setDialogState(() {
                                  fetchingAiSuggestions = true;
                                  errorMessage = null;
                                  aiSuggestions = [];
                                });

                                try {
                                  final aiService = AISuggestionService();
                                  final suggestions = await aiService
                                      .getSuggestedMembers(
                                        members:
                                            _groupMembers.map((m) {
                                              return {
                                                'thanhVienId': m.thanhVienId,
                                                'hoTen': m.hoTen,
                                                'chuyenMon': m.chuyenMon,
                                                'soLuongCongViecHienTai': 0,
                                                'tienDoTrungBinh': 0,
                                                'danhGiaGanDay': 'Chưa có',
                                              };
                                            }).toList(),
                                        taskName: widget.task.tenCongViec,
                                        taskDescription:
                                            descriptionController.text.trim(),
                                        priority:
                                            _priorityOptions[selectedPriority] ??
                                            'Cao',
                                        projectDomain: null,
                                        startDate:
                                            widget.task.ngayBd != null
                                                ? formatDisplayDate(
                                                  widget.task.ngayBd!,
                                                )
                                                : null,
                                        endDate:
                                            widget.task.ngayKt != null
                                                ? formatDisplayDate(
                                                  widget.task.ngayKt!,
                                                )
                                                : null,
                                      );

                                  setDialogState(() {
                                    fetchingAiSuggestions = false;
                                    aiSuggestions = suggestions;
                                  });
                                } catch (e) {
                                  setDialogState(() {
                                    fetchingAiSuggestions = false;
                                    errorMessage =
                                        'Lỗi AI: ${e.toString().replaceAll('Exception: ', '')}';
                                  });
                                }
                              },
                      icon:
                          fetchingAiSuggestions
                              ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                              : const Icon(Icons.auto_awesome),
                      label: Text(
                        fetchingAiSuggestions
                            ? 'Đang phân tích...'
                            : 'AI Gợi ý thành viên',
                      ),
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size(double.infinity, 42),
                      ),
                    ),
                    if (aiSuggestions.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.green.shade50,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.green.shade200),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  Icons.lightbulb_outline,
                                  size: 18,
                                  color: Colors.green.shade700,
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  'Gợi ý từ AI:',
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    color: Colors.green.shade700,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            ...aiSuggestions.map((suggestion) {
                              final member = _groupMembers.firstWhere(
                                (m) => m.thanhVienId == suggestion.thanhVienId,
                              );
                              final isSelected =
                                  selectedMemberId == suggestion.thanhVienId;
                              return Container(
                                margin: const EdgeInsets.only(bottom: 8),
                                decoration: BoxDecoration(
                                  color:
                                      isSelected
                                          ? Colors.blue.shade100
                                          : Colors.white,
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(
                                    color:
                                        isSelected
                                            ? Colors.blue.shade400
                                            : Colors.grey.shade300,
                                    width: isSelected ? 2 : 1,
                                  ),
                                ),
                                child: ListTile(
                                  dense: true,
                                  contentPadding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 4,
                                  ),
                                  leading: CircleAvatar(
                                    radius: 16,
                                    backgroundColor: Colors.blue.shade600,
                                    child: Text(
                                      '${suggestion.score.toInt()}',
                                      style: const TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                        color: Colors.white,
                                      ),
                                    ),
                                  ),
                                  title: Text(
                                    member.hoTen,
                                    style: TextStyle(
                                      fontWeight:
                                          isSelected
                                              ? FontWeight.bold
                                              : FontWeight.w600,
                                      fontSize: 13,
                                    ),
                                  ),
                                  subtitle: Text(
                                    suggestion.reason,
                                    style: const TextStyle(fontSize: 11),
                                  ),
                                  onTap:
                                      isSubmitting
                                          ? null
                                          : () {
                                            setDialogState(() {
                                              selectedMemberId =
                                                  suggestion.thanhVienId;
                                            });
                                          },
                                ),
                              );
                            }),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 12),
                    DropdownButtonFormField<int>(
                      value: selectedMemberId,
                      isExpanded: true,
                      items:
                          _groupMembers
                              .map(
                                (member) => DropdownMenuItem<int>(
                                  value: member.thanhVienId,
                                  child: Text(
                                    "${member.hoTen} - ${member.chuyenMon}",
                                    overflow: TextOverflow.ellipsis,
                                    maxLines: 1,
                                  ),
                                ),
                              )
                              .toList(),
                      onChanged:
                          isSubmitting
                              ? null
                              : (value) {
                                setDialogState(() {
                                  selectedMemberId = value;
                                });
                              },
                      decoration: const InputDecoration(
                        labelText: 'Thành viên được giao',
                        border: OutlineInputBorder(),
                        isDense: true,
                        contentPadding: EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 10,
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: descriptionController,
                      maxLines: 3,
                      decoration: const InputDecoration(
                        labelText: 'Mô tả công việc',
                        hintText: 'Nhập nội dung công việc con...',
                        border: OutlineInputBorder(),
                      ),
                      enabled: !isSubmitting,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Ngày phân công',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 12,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.blue.shade50,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.blue.shade100),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            formatDisplayDate(selectedDate),
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                          Icon(
                            Icons.schedule,
                            size: 18,
                            color: Theme.of(context).colorScheme.primary,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Độ ưu tiên',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<String>(
                      value: selectedPriority,
                      items: _priorityOptions.entries
                          .map(
                            (entry) => DropdownMenuItem<String>(
                              value: entry.key,
                              child: Text(entry.value),
                            ),
                          )
                          .toList(growable: false),
                      onChanged:
                          isSubmitting
                              ? null
                              : (value) {
                                if (value != null) {
                                  setDialogState(
                                    () => selectedPriority = value,
                                  );
                                }
                              },
                      decoration: const InputDecoration(
                        border: OutlineInputBorder(),
                      ),
                    ),
                    if (errorMessage != null) ...[
                      const SizedBox(height: 12),
                      Text(
                        errorMessage!,
                        style: const TextStyle(color: Colors.redAccent),
                      ),
                    ],
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed:
                      isSubmitting
                          ? null
                          : () => Navigator.of(dialogContext).pop(),
                  child: const Text('Huỷ'),
                ),
                FilledButton.icon(
                  onPressed:
                      isSubmitting
                          ? null
                          : () async {
                            final memberId = selectedMemberId;
                            final description =
                                descriptionController.text.trim();
                            if (memberId == null) {
                              setDialogState(
                                () =>
                                    errorMessage = 'Vui lòng chọn thành viên.',
                              );
                              return;
                            }

                            if (description.isEmpty) {
                              setDialogState(
                                () =>
                                    errorMessage =
                                        'Vui lòng nhập mô tả công việc.',
                              );
                              return;
                            }

                            setDialogState(() => errorMessage = null);
                            setState(() => _creatingSubtask = true);

                            try {
                              final responseMessage = await _service
                                  .createAssignmentItem(
                                    taskId: widget.task.congViecId,
                                    memberId: memberId,
                                    description: description,
                                    assignedDate: selectedDate,
                                    priority: selectedPriority,
                                  );
                              if (!mounted) return;

                              setState(() => _creatingSubtask = false);

                              createdMemberId = memberId;
                              createdDescription = description;
                              final matchedMembers = _groupMembers.where(
                                (member) => member.thanhVienId == memberId,
                              );
                              createdMemberName =
                                  matchedMembers.isNotEmpty
                                      ? matchedMembers.first.hoTen
                                      : null;
                              Navigator.of(dialogContext).pop(responseMessage);
                            } catch (e) {
                              if (!mounted) return;
                              setState(() => _creatingSubtask = false);
                              setDialogState(
                                () =>
                                    errorMessage =
                                        'Không thể thêm công việc con: $e',
                              );
                            }
                          },
                  icon:
                      isSubmitting
                          ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.2,
                              color: Colors.white,
                            ),
                          )
                          : const Icon(Icons.playlist_add_rounded),
                  label: Text(isSubmitting ? 'Đang thêm...' : 'Thêm'),
                ),
              ],
            );
          },
        );
      },
    );

    descriptionController.dispose();

    debugPrint('[CreateSubtask] Dialog closed with message: $message');
    debugPrint(
      '[CreateSubtask] createdMemberId: $createdMemberId, mounted: $mounted',
    );

    if (message != null && mounted) {
      String? notifyError;
      if (createdMemberId != null) {
        final senderEmail =
            (_currentUserEmail != null && _currentUserEmail!.isNotEmpty)
                ? _currentUserEmail!
                : 'system@app.com';
        try {
          await _service.notifyNewAssignment(
            taskId: widget.task.congViecId,
            memberId: createdMemberId!,
            senderEmail: senderEmail,
          );
        } catch (e) {
          notifyError = e.toString();
        }

        // Cập nhật tiến độ công việc sau khi tạo subtask
        try {
          await _service.updateTaskProgress(taskId: widget.task.congViecId);
        } catch (e) {
          debugPrint('[CreateSubtask] Failed to update task progress: $e');
        }

        final assignedName =
            (createdMemberName != null && createdMemberName!.trim().isNotEmpty)
                ? createdMemberName!
                : 'thành viên';
        final description =
            (createdDescription != null &&
                    createdDescription!.trim().isNotEmpty)
                ? createdDescription!
                : widget.task.tenCongViec;
        await LocalNotificationService().showNotification(
          id: DateTime.now().millisecondsSinceEpoch.remainder(1 << 31),
          title: 'Phân công công việc mới',
          body: 'Đã giao "$description" cho $assignedName.',
        );
      }

      if (notifyError != null) {
        CustomToast.show(
          context,
          message: 'Không gửi được thông báo phân công: $notifyError',
          isError: true,
          icon: Icons.error_outline,
        );
      }

      final previousPage = _currentPage;
      final previousExpanded = Set<int>.from(_expandedMembers);
      final previousScrollOffset =
          _assignmentsScrollController.hasClients
              ? _assignmentsScrollController.offset
              : 0.0;
      if (createdMemberId != null) {
        previousExpanded.add(createdMemberId!);
      }

      await _loadAssignments(showLoading: false);
      if (!mounted) return;

      final filtered = _filteredAssignments();
      final targetIndex =
          createdMemberId != null
              ? filtered.indexWhere(
                (assignment) => assignment.thanhVienId == createdMemberId,
              )
              : -1;
      final totalPages = math.max(1, (filtered.length / _pageSize).ceil());
      final restoredPage =
          targetIndex >= 0
              ? (targetIndex ~/ _pageSize)
              : previousPage.clamp(0, totalPages - 1);

      setState(() {
        _currentPage = restoredPage;
        _expandedMembers
          ..clear()
          ..addAll(previousExpanded);
      });

      // Restore scroll position after build
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _assignmentsScrollController.hasClients) {
          final maxScroll =
              _assignmentsScrollController.position.maxScrollExtent;
          final targetScroll = previousScrollOffset.clamp(0.0, maxScroll);
          _assignmentsScrollController.jumpTo(targetScroll);
        }
      });

      CustomToast.show(
        context,
        message: message,
        icon: Icons.check_circle_outline,
      );
    }
  }

  Future<void> _loadComments({bool showLoading = true}) async {
    if (_isFetchingComments) return;
    _isFetchingComments = true;

    if (showLoading) {
      setState(() {
        _commentsLoading = true;
        _commentsError = null;
      });
    } else {
      setState(() {
        _commentsError = null;
      });
    }

    try {
      final comments = await _service.fetchTaskComments(
        taskId: widget.task.congViecId,
      );
      if (!mounted) return;
      setState(() {
        _comments = _sortComments(comments);
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _commentsError = e.toString();
      });
    } finally {
      if (showLoading && mounted) {
        setState(() {
          _commentsLoading = false;
        });
      }
      _isFetchingComments = false;
    }
  }

  void _startCommentsPolling() {
    _commentsTimer?.cancel();
    _commentsTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      if (_submittingComment) return;
      if (_deletingCommentIds.isNotEmpty) return;
      if (_editingCommentId != null) return;
      _loadComments(showLoading: false);
    });
  }

  Future<void> _resolveCurrentMemberId() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString('user_info');
      if (raw == null || raw.isEmpty) return;

      final decoded = jsonDecode(raw);
      Map<String, dynamic>? payload;
      if (decoded is Map<String, dynamic>) {
        payload = decoded;

        final dataValue = payload['data'];
        if (dataValue is Map<String, dynamic>) {
          payload = dataValue;
        }

        final userValue = payload['user'];
        if (userValue is Map<String, dynamic>) {
          payload = userValue;
        }
      }

      final memberValue =
          payload?['thanhVienId'] ??
          payload?['memberId'] ??
          payload?['thanhVienID'];
      final emailValue =
          payload?['email'] ?? payload?['mail'] ?? payload?['userEmail'];
      final resolved =
          memberValue is int
              ? memberValue
              : int.tryParse(memberValue?.toString() ?? '');
      final resolvedEmail = emailValue?.toString().trim();

      if (!mounted) return;
      final shouldUpdateEmail =
          resolvedEmail != null &&
          resolvedEmail.isNotEmpty &&
          resolvedEmail != _currentUserEmail;
      if (resolved != _currentMemberId || shouldUpdateEmail) {
        setState(() {
          _currentMemberId = resolved;
          if (shouldUpdateEmail) {
            _currentUserEmail = resolvedEmail;
          }
        });
      }
    } catch (e) {
      debugPrint(
        '[TaskAssignmentsScreen] Failed to resolve current member: $e',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.task.tenCongViec),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              if (_hasAssignmentsTab && _tabController.index == 0) {
                _loadAssignments();
                CustomToast.show(
                  context,
                  message: 'Đã tải lại danh sách phân công',
                  icon: Icons.check_circle_outline,
                );
              } else {
                _loadComments();
                CustomToast.show(
                  context,
                  message: 'Đã tải lại danh sách bình luận',
                  icon: Icons.check_circle_outline,
                );
              }
            },
            tooltip: 'Tải lại',
          ),
        ],
        bottom:
            _hasAssignmentsTab
                ? TabBar(
                  controller: _tabController,
                  tabs: const [
                    Tab(
                      icon: Icon(Icons.assignment_outlined),
                      text: 'Phân công',
                    ),
                    Tab(icon: Icon(Icons.comment_outlined), text: 'Bình luận'),
                  ],
                )
                : null,
      ),
      body:
          _hasAssignmentsTab
              ? TabBarView(
                controller: _tabController,
                children: [_buildAssignmentsTab(), _buildCommentsTab()],
              )
              : _buildCommentsTab(),
    );
  }

  Widget _buildAssignmentsTab() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, size: 48, color: Colors.red.shade300),
            const SizedBox(height: 16),
            Text('Lỗi: $_error'),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _loadAssignments,
              child: const Text('Thử lại'),
            ),
          ],
        ),
      );
    }

    return _buildAssignmentsContent();
  }

  Widget _buildAssignmentsContent() {
    final filtered = _filteredAssignments();
    final totalItems = filtered.length;
    final totalPages = math.max(1, (totalItems / _pageSize).ceil());
    final currentPage = _currentPage.clamp(0, totalPages - 1);
    final visible = filtered
        .skip(currentPage * _pageSize)
        .take(_pageSize)
        .toList(growable: false);

    return Container(
      color: Colors.blue.shade50,
      child: Column(
        children: [
          _buildControls(
            filteredCount: totalItems,
            totalPages: totalPages,
            currentPage: currentPage,
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: Row(
              children: [
                Expanded(
                  child:
                      _membersLoading
                          ? Row(
                            mainAxisSize: MainAxisSize.min,
                            children: const [
                              SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              ),
                              SizedBox(width: 8),
                              Text('Đang tải danh sách thành viên...'),
                            ],
                          )
                          : _membersError != null
                          ? Text(
                            'Không thể tải thành viên: $_membersError',
                            style: const TextStyle(color: Colors.redAccent),
                          )
                          : const SizedBox.shrink(),
                ),
                if (_membersLoading || _membersError != null)
                  const SizedBox(width: 12),
                FilledButton.icon(
                  onPressed: _creatingSubtask ? null : _openCreateSubtaskDialog,
                  icon:
                      _creatingSubtask
                          ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.2,
                              color: Colors.white,
                            ),
                          )
                          : const Icon(Icons.add_task_rounded),
                  label: Text(
                    _creatingSubtask ? 'Đang thêm...' : 'Thêm công việc con',
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Expanded(
            child:
                visible.isEmpty
                    ? _buildEmptyFilteredState()
                    : ListView.separated(
                      controller: _assignmentsScrollController,
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                      physics: const BouncingScrollPhysics(),
                      itemCount: visible.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 16),
                      itemBuilder: (context, index) {
                        final assignment = visible[index];
                        final isExpanded = _expandedMembers.contains(
                          assignment.thanhVienId,
                        );
                        return _AssignmentCard(
                          assignment: assignment,
                          isExpanded: isExpanded,
                          onToggle: () => _toggleMember(assignment.thanhVienId),
                          onViewDetail:
                              (detail) => _openSubTaskDetail(
                                assignment: assignment,
                                detail: detail,
                              ),
                          onOpenAttachment: _openAttachment,
                          onEdit:
                              (detail) => _openEditSubtaskDialog(
                                assignment: assignment,
                                detail: detail,
                              ),
                          onDelete:
                              (detail) => _confirmDeleteSubtask(
                                assignment: assignment,
                                detail: detail,
                              ),
                          editingSubtaskId: _editingSubtaskId,
                          deletingSubtaskIds: _deletingSubtaskIds,
                          onShowSubmissionHistory:
                              (ngayNop) =>
                                  _showSubmissionHistory(context, ngayNop),
                        );
                      },
                    ),
          ),
        ],
      ),
    );
  }

  Widget _buildCommentsTab() {
    if (_commentsLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_commentsError != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, size: 48, color: Colors.red.shade300),
            const SizedBox(height: 16),
            Text('Lỗi: $_commentsError'),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _loadComments,
              child: const Text('Thử lại'),
            ),
          ],
        ),
      );
    }

    return Container(
      color: Colors.blue.shade50,
      child: Column(
        children: [
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => _loadComments(showLoading: false),
              displacement: 24,
              child:
                  _comments.isEmpty
                      ? ListView(
                        physics: const AlwaysScrollableScrollPhysics(
                          parent: BouncingScrollPhysics(),
                        ),
                        padding: const EdgeInsets.fromLTRB(16, 64, 16, 24),
                        children: [_buildEmptyCommentsState()],
                      )
                      : ListView.separated(
                        physics: const BouncingScrollPhysics(
                          parent: AlwaysScrollableScrollPhysics(),
                        ),
                        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                        itemCount: _comments.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder:
                            (context, index) =>
                                _buildCommentTile(_comments[index]),
                      ),
            ),
          ),
          _buildCommentComposer(),
        ],
      ),
    );
  }

  Widget _buildEmptyCommentsState() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Icon(Icons.chat_bubble_outline, size: 64, color: Colors.blue.shade200),
        const SizedBox(height: 16),
        Text(
          'Chưa có bình luận nào.',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.titleMedium,
        ),
      ],
    );
  }

  Widget _buildCommentTile(TaskComment comment) {
    final theme = Theme.of(context);
    final createdAt = comment.commentedAt;
    final updatedAt = comment.updatedAt;
    final createdLabel = _formatDateTime(createdAt);
    final updatedLabel = _formatDateTime(updatedAt);
    final hasEdited =
        updatedAt != null &&
        (createdAt == null || !updatedAt.isAtSameMomentAs(createdAt));
    final isOwn =
        _currentMemberId != null && comment.memberId == _currentMemberId;
    final isDeleting = _deletingCommentIds.contains(comment.commentId);
    final isBeingEdited = _editingCommentId == comment.commentId;

    final bubbleColor = isOwn ? Colors.blue.shade600 : Colors.white;
    final primaryTextColor =
        isOwn ? Colors.white : theme.textTheme.bodyMedium?.color;
    final secondaryTextColor = isOwn ? Colors.white70 : Colors.blueGrey;

    return Align(
      alignment: isOwn ? Alignment.centerRight : Alignment.centerLeft,
      child: Column(
        crossAxisAlignment:
            isOwn ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          Container(
            constraints: BoxConstraints(
              maxWidth: MediaQuery.of(context).size.width * 0.78,
            ),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: bubbleColor,
              borderRadius: BorderRadius.only(
                topLeft: const Radius.circular(20),
                topRight: const Radius.circular(20),
                bottomLeft: Radius.circular(isOwn ? 20 : 8),
                bottomRight: Radius.circular(isOwn ? 8 : 20),
              ),
              border: Border.all(
                color: isOwn ? Colors.blue.shade200 : Colors.blue.shade100,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.blue.shade100.withOpacity(0.3),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment:
                  isOwn ? CrossAxisAlignment.end : CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment:
                      isOwn ? MainAxisAlignment.end : MainAxisAlignment.start,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CircleAvatar(
                      radius: 18,
                      backgroundColor:
                          isOwn
                              ? Colors.white.withOpacity(0.3)
                              : Colors.blue.shade100,
                      child: Text(
                        comment.memberName.isNotEmpty
                            ? comment.memberName[0].toUpperCase()
                            : '?',
                        style: theme.textTheme.titleMedium?.copyWith(
                          color: isOwn ? Colors.white : Colors.blue.shade700,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment:
                            isOwn
                                ? CrossAxisAlignment.end
                                : CrossAxisAlignment.start,
                        children: [
                          Text(
                            comment.memberName,
                            style: theme.textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w700,
                              color: primaryTextColor,
                            ),
                            textAlign: isOwn ? TextAlign.right : TextAlign.left,
                          ),
                          const SizedBox(height: 4),
                          Text(
                            createdLabel,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: secondaryTextColor,
                            ),
                            textAlign: isOwn ? TextAlign.right : TextAlign.left,
                          ),
                          if (hasEdited)
                            Padding(
                              padding: const EdgeInsets.only(top: 2),
                              child: Text(
                                'Chỉnh sửa: $updatedLabel',
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: secondaryTextColor,
                                  fontStyle: FontStyle.italic,
                                ),
                                textAlign:
                                    isOwn ? TextAlign.right : TextAlign.left,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  comment.content,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: primaryTextColor,
                  ),
                  textAlign: isOwn ? TextAlign.right : TextAlign.left,
                ),
              ],
            ),
          ),
          if (isOwn)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (isBeingEdited)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          color: Colors.blue.shade100,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 4,
                          ),
                          child: Text(
                            'Đang chỉnh sửa',
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: Colors.blue.shade900,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                    ),
                  TextButton.icon(
                    onPressed:
                        (_submittingComment || isDeleting)
                            ? null
                            : () => _startEditingComment(comment),
                    icon: const Icon(Icons.edit, size: 16),
                    label: const Text('Sửa'),
                    style: TextButton.styleFrom(
                      foregroundColor: Colors.blue.shade700,
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      minimumSize: const Size(0, 36),
                    ),
                  ),
                  const SizedBox(width: 4),
                  isDeleting
                      ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                      : TextButton.icon(
                        onPressed: () => _confirmDeleteComment(comment),
                        icon: const Icon(Icons.delete_outline, size: 16),
                        label: const Text('Xoá'),
                        style: TextButton.styleFrom(
                          foregroundColor: Colors.red.shade400,
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          minimumSize: const Size(0, 36),
                        ),
                      ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildCommentComposer() {
    final theme = Theme.of(context);
    final isEditing = _editingCommentId != null;
    final canSubmit =
        !_submittingComment &&
        _currentMemberId != null &&
        _commentController.text.trim().isNotEmpty;

    return SafeArea(
      top: false,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.blue.shade100.withOpacity(0.4),
              blurRadius: 20,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (isEditing)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    Icon(Icons.edit, size: 18, color: Colors.blue.shade600),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Đang chỉnh sửa bình luận',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                          color: Colors.blue.shade600,
                        ),
                      ),
                    ),
                    TextButton(
                      onPressed:
                          _submittingComment ? null : _cancelEditingComment,
                      child: const Text('Huỷ'),
                    ),
                  ],
                ),
              ),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: TextField(
                    controller: _commentController,
                    focusNode: _commentFocusNode,
                    minLines: 1,
                    maxLines: 4,
                    readOnly: _currentMemberId == null,
                    onChanged: (_) => setState(() {}),
                    decoration: InputDecoration(
                      hintText:
                          _currentMemberId == null
                              ? 'Không thể gửi bình luận. Vui lòng đăng nhập lại.'
                              : 'Nhập bình luận...',
                      filled: true,
                      fillColor: Colors.blue.shade50,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: BorderSide.none,
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 14,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                ElevatedButton(
                  onPressed:
                      canSubmit
                          ? () =>
                              isEditing ? _updateComment() : _submitComment()
                          : null,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 18,
                      vertical: 14,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  child:
                      _submittingComment
                          ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor: AlwaysStoppedAnimation<Color>(
                                Colors.white,
                              ),
                            ),
                          )
                          : Icon(
                            isEditing
                                ? Icons.check_rounded
                                : Icons.send_rounded,
                          ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _startEditingComment(TaskComment comment) {
    if (_submittingComment) return;
    setState(() {
      _editingCommentId = comment.commentId;
      _commentController
        ..text = comment.content
        ..selection = TextSelection.fromPosition(
          TextPosition(offset: comment.content.length),
        );
    });
    Future<void>.delayed(const Duration(milliseconds: 50), () {
      if (mounted) {
        _commentFocusNode.requestFocus();
      }
    });
  }

  void _cancelEditingComment() {
    if (_submittingComment) return;
    setState(() {
      _editingCommentId = null;
      _commentController.clear();
    });
  }

  Future<void> _submitComment() async {
    final memberId = _currentMemberId;
    final content = _commentController.text.trim();
    if (memberId == null || content.isEmpty || _submittingComment) {
      return;
    }

    setState(() => _submittingComment = true);

    try {
      final created = await _service.createTaskComment(
        taskId: widget.task.congViecId,
        memberId: memberId,
        content: content,
      );

      if (!mounted) return;

      setState(() {
        if (created != null) {
          _comments = _sortComments([..._comments, created]);
        }
        _commentController.clear();
        _submittingComment = false;
      });

      _commentFocusNode.unfocus();
      await _handleCommentNotification(memberId: memberId, content: content);
      CustomToast.show(
        context,
        message: 'Đã gửi bình luận.',
        icon: Icons.check_circle_outline,
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _submittingComment = false);
      _showMessage('Không thể gửi bình luận: $e');
    }
  }

  Future<void> _updateComment() async {
    final commentId = _editingCommentId;
    final memberId = _currentMemberId;
    final content = _commentController.text.trim();
    if (commentId == null ||
        memberId == null ||
        content.isEmpty ||
        _submittingComment) {
      return;
    }

    setState(() => _submittingComment = true);

    try {
      final updated = await _service.updateTaskComment(
        commentId: commentId,
        memberId: memberId,
        content: content,
      );

      if (!mounted) return;

      setState(() {
        if (updated != null) {
          final mapped = _comments
              .map(
                (item) => item.commentId == updated.commentId ? updated : item,
              )
              .toList(growable: false);
          _comments = _sortComments(mapped);
        }
        _editingCommentId = null;
        _commentController.clear();
        _submittingComment = false;
      });

      _commentFocusNode.unfocus();
      CustomToast.show(
        context,
        message: 'Đã cập nhật bình luận.',
        icon: Icons.check_circle_outline,
      );
      await _loadComments(showLoading: false);
    } catch (e) {
      if (!mounted) return;
      setState(() => _submittingComment = false);
      _showMessage('Không thể cập nhật bình luận: $e');
    }
  }

  Future<void> _confirmDeleteComment(TaskComment comment) async {
    if (_deletingCommentIds.contains(comment.commentId)) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Xoá bình luận'),
          content: const Text('Bạn có chắc muốn xoá bình luận này?'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Huỷ'),
            ),
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: const Text('Xoá'),
            ),
          ],
        );
      },
    );

    if (confirmed == true && mounted) {
      await _deleteComment(comment);
    }
  }

  Future<void> _deleteComment(TaskComment comment) async {
    setState(() => _deletingCommentIds.add(comment.commentId));

    try {
      await _service.deleteTaskComment(commentId: comment.commentId);
      if (!mounted) return;

      setState(() {
        _deletingCommentIds.remove(comment.commentId);
        _comments = _comments
            .where((item) => item.commentId != comment.commentId)
            .toList(growable: false);
        if (_editingCommentId == comment.commentId) {
          _editingCommentId = null;
          _commentController.clear();
        }
      });

      CustomToast.show(
        context,
        message: 'Đã xoá bình luận.',
        icon: Icons.check_circle_outline,
      );
      await _loadComments(showLoading: false);
    } catch (e) {
      if (!mounted) return;
      setState(() => _deletingCommentIds.remove(comment.commentId));
      _showMessage('Không thể xoá bình luận: $e');
    }
  }

  Future<void> _handleCommentNotification({
    required int memberId,
    required String content,
  }) async {
    String? notifyError;
    try {
      await _service.notifyNewComment(
        taskId: widget.task.congViecId,
        memberId: memberId,
        content: content,
      );
    } catch (e) {
      notifyError = e.toString();
    }

    if (_currentMemberId == null || memberId != _currentMemberId) {
      await LocalNotificationService().showNotification(
        id: DateTime.now().millisecondsSinceEpoch.remainder(1 << 31),
        title: 'Bình luận mới',
        body: content,
      );
    }

    if (notifyError != null && mounted) {
      CustomToast.show(
        context,
        message: 'Không gửi được thông báo bình luận: $notifyError',
        isError: true,
        icon: Icons.error_outline,
      );
    }
  }

  List<TaskComment> _sortComments(Iterable<TaskComment> source) {
    final sorted = List<TaskComment>.from(source);
    sorted.sort((a, b) {
      final aTime = a.commentedAt ?? a.updatedAt;
      final bTime = b.commentedAt ?? b.updatedAt;
      if (aTime == null && bTime == null) {
        return a.commentId.compareTo(b.commentId);
      }
      if (aTime == null) return -1;
      if (bTime == null) return 1;
      final compare = aTime.compareTo(bTime);
      return compare != 0 ? compare : a.commentId.compareTo(b.commentId);
    });
    return sorted;
  }

  List<TaskAssignment> _filteredAssignments() {
    if (_assignments.isEmpty) return const [];

    final query = _searchQuery.trim().toLowerCase();
    final filtered = _assignments
        .where((assignment) {
          final matchesQuery =
              query.isEmpty ||
              assignment.hoTen.toLowerCase().contains(query) ||
              assignment.noiDungPhanCong.any(
                (detail) => detail.moTa.toLowerCase().contains(query),
              );

          bool matchesPriority;
          switch (_priorityFilter) {
            case PriorityFilter.all:
              matchesPriority = true;
              break;
            case PriorityFilter.high:
              matchesPriority = assignment.noiDungPhanCong.any(
                (d) => _priorityKey(d.doUuTien) == 'high',
              );
              break;
            case PriorityFilter.medium:
              matchesPriority = assignment.noiDungPhanCong.any(
                (d) => _priorityKey(d.doUuTien) == 'medium',
              );
              break;
            case PriorityFilter.low:
              matchesPriority = assignment.noiDungPhanCong.any(
                (d) => _priorityKey(d.doUuTien) == 'low',
              );
              break;
          }

          return matchesQuery && matchesPriority;
        })
        .toList(growable: false);

    filtered.sort((a, b) {
      switch (_sortOption) {
        case AssignmentSortOption.nameAsc:
          return a.hoTen.toLowerCase().compareTo(b.hoTen.toLowerCase());
        case AssignmentSortOption.nameDesc:
          return b.hoTen.toLowerCase().compareTo(a.hoTen.toLowerCase());
        case AssignmentSortOption.taskCountDesc:
          return b.noiDungPhanCong.length.compareTo(a.noiDungPhanCong.length);
      }
    });

    return filtered;
  }

  Widget _buildControls({
    required int filteredCount,
    required int totalPages,
    required int currentPage,
  }) {
    const primary = Color(0xFF2563EB);
    const border = Color(0xFFE5E7EB);
    const textSecondary = Color(0xFF6B7280);

    return Container(
      margin: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _searchController,
                  onChanged: (value) {
                    setState(() {
                      _searchQuery = value;
                      _currentPage = 0;
                    });
                  },
                  decoration: InputDecoration(
                    hintText: 'Tìm kiếm thành viên hoặc nhiệm vụ...',
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
              _SortIconButton(
                sortOption: _sortOption,
                onChanged: (value) {
                  setState(() {
                    _sortOption = value;
                  });
                },
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 36,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: PriorityFilter.values.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final filter = PriorityFilter.values[index];
                final selected = _priorityFilter == filter;
                return _FilterChip(
                  label: filter.label,
                  isSelected: selected,
                  onTap: () {
                    setState(() {
                      _priorityFilter = filter;
                      _currentPage = 0;
                    });
                  },
                );
              },
            ),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '$filteredCount phân công',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: textSecondary,
                ),
              ),
              Row(
                children: [
                  Text(
                    'Trang ${currentPage + 1}/$totalPages',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF1F2937),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Container(
                    decoration: BoxDecoration(
                      border: Border.all(color: border),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      children: [
                        InkWell(
                          onTap:
                              currentPage > 0
                                  ? () {
                                    setState(() {
                                      _currentPage = currentPage - 1;
                                    });
                                  }
                                  : null,
                          borderRadius: const BorderRadius.horizontal(
                            left: Radius.circular(8),
                          ),
                          child: Padding(
                            padding: const EdgeInsets.all(8),
                            child: Icon(
                              Icons.chevron_left,
                              size: 18,
                              color: currentPage > 0 ? primary : textSecondary,
                            ),
                          ),
                        ),
                        Container(width: 1, height: 24, color: border),
                        InkWell(
                          onTap:
                              currentPage < totalPages - 1
                                  ? () {
                                    setState(() {
                                      _currentPage = currentPage + 1;
                                    });
                                  }
                                  : null,
                          borderRadius: const BorderRadius.horizontal(
                            right: Radius.circular(8),
                          ),
                          child: Padding(
                            padding: const EdgeInsets.all(8),
                            child: Icon(
                              Icons.chevron_right,
                              size: 18,
                              color:
                                  currentPage < totalPages - 1
                                      ? primary
                                      : textSecondary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyFilteredState() {
    final hasFilters =
        _searchQuery.trim().isNotEmpty || _priorityFilter != PriorityFilter.all;
    final message =
        hasFilters
            ? 'Không tìm thấy kết quả phù hợp.'
            : 'Chưa có phân công nào.';
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.inbox_outlined, size: 64, color: Colors.grey.shade300),
            const SizedBox(height: 16),
            Text(
              message,
              style: const TextStyle(fontSize: 15, color: Color(0xFF6B7280)),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  void _toggleMember(int memberId) {
    setState(() {
      if (_expandedMembers.contains(memberId)) {
        _expandedMembers.remove(memberId);
      } else {
        _expandedMembers.add(memberId);
      }
    });
  }

  Future<void> _openAttachment(String path) async {
    final resolved = _resolveAttachmentUrl(path);
    final uri = Uri.tryParse(resolved);
    if (uri == null) {
      _showMessage('Đường dẫn tệp không hợp lệ.');
      return;
    }

    try {
      final launched = await launchUrl(
        uri,
        mode: LaunchMode.externalApplication,
      );
      if (!launched) {
        _showMessage('Không thể mở tệp đính kèm.');
      }
    } catch (e) {
      _showMessage('Mở tệp thất bại: $e');
    }
  }

  Future<void> _openSubTaskDetail({
    required TaskAssignment assignment,
    required AssignmentDetail detail,
  }) async {
    if (!mounted) return;

    final shouldRefresh = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder:
            (_) => SubTaskDetailScreen(
              taskId: widget.task.congViecId,
              memberId: assignment.thanhVienId,
              taskName: widget.task.tenCongViec,
              memberName: assignment.hoTen,
              detail: detail,
              onOpenAttachment: (path) => _openAttachment(path),
            ),
      ),
    );

    if (shouldRefresh == true && mounted) {
      await _loadAssignments(showLoading: false);
    }
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
    );
  }

  String _resolveAttachmentUrl(String path) {
    if (path.startsWith('http')) return path;
    final base = ApiConstants.baseUrl;
    if (path.startsWith('/')) return '$base$path';
    return '$base/$path';
  }
}

String _priorityKey(String raw) {
  final normalized = raw.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');
  if (normalized.contains('cao')) return 'high';
  if (normalized.contains('trung')) return 'medium';
  if (normalized.contains('thap')) return 'low';
  if (normalized.contains('high')) return 'high';
  if (normalized.contains('medium')) return 'medium';
  if (normalized.contains('low')) return 'low';
  return 'other';
}

int _priorityScore(String raw) {
  switch (_priorityKey(raw)) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
}

Color _priorityColor(String raw) {
  switch (_priorityKey(raw)) {
    case 'high':
      return const Color(0xFFE53935);
    case 'medium':
      return const Color(0xFFFB8C00);
    case 'low':
      return const Color(0xFF43A047);
    default:
      return const Color(0xFF546E7A);
  }
}

String _priorityDisplay(String raw) {
  switch (_priorityKey(raw)) {
    case 'high':
      return 'Ưu tiên cao';
    case 'medium':
      return 'Ưu tiên trung bình';
    case 'low':
      return 'Ưu tiên thấp';
    default:
      return 'Ưu tiên khác';
  }
}

double _progressValue(String raw) {
  final match = RegExp(r'(\d{1,3})(?:\.\d+)?').firstMatch(raw);
  if (match == null) return 0;
  final value = double.tryParse(match.group(1) ?? '0') ?? 0;
  final clamped = value.clamp(0, 100);
  return clamped / 100;
}

Color _progressColor(double progress) {
  if (progress >= 0.9) return const Color(0xFF16A34A); // Emerald
  if (progress >= 0.75) return const Color(0xFF22C55E); // Green
  if (progress >= 0.5) return const Color(0xFFF59E0B); // Amber
  if (progress >= 0.25) return const Color(0xFFF97316); // Orange
  return const Color(0xFFEF4444); // Red
}

class _AssignmentCard extends StatelessWidget {
  const _AssignmentCard({
    required this.assignment,
    required this.isExpanded,
    required this.onToggle,
    required this.onViewDetail,
    required this.onOpenAttachment,
    required this.onEdit,
    required this.onDelete,
    required this.editingSubtaskId,
    required this.deletingSubtaskIds,
    required this.onShowSubmissionHistory,
  });

  final TaskAssignment assignment;
  final bool isExpanded;
  final VoidCallback onToggle;
  final ValueChanged<AssignmentDetail> onViewDetail;
  final ValueChanged<String> onOpenAttachment;
  final ValueChanged<AssignmentDetail> onEdit;
  final ValueChanged<AssignmentDetail> onDelete;
  final String? editingSubtaskId;
  final Set<String> deletingSubtaskIds;
  final ValueChanged<List<DateTime>> onShowSubmissionHistory;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final details = assignment.noiDungPhanCong;
    final highestPriority =
        details.isEmpty
            ? null
            : details.reduce(
              (value, element) =>
                  _priorityScore(element.doUuTien) >
                          _priorityScore(value.doUuTien)
                      ? element
                      : value,
            );

    const border = Color(0xFFE5E7EB);
    const primary = Color(0xFF2563EB);

    return AnimatedContainer(
      duration: const Duration(milliseconds: 250),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: IconButton(
                  onPressed: onToggle,
                  icon: Icon(
                    isExpanded ? Icons.expand_less : Icons.expand_more,
                  ),
                  color: primary,
                  splashRadius: 20,
                  iconSize: 22,
                ),
              ),
              const SizedBox(width: 12),
              CircleAvatar(
                radius: 24,
                backgroundColor: const Color(0xFFDEECFF),
                child: Text(
                  assignment.hoTen.isNotEmpty
                      ? assignment.hoTen[0].toUpperCase()
                      : '?',
                  style: const TextStyle(
                    color: Color(0xFF1E40AF),
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      assignment.hoTen,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      details.isEmpty
                          ? 'Chưa có nhiệm vụ'
                          : '${details.length} nhiệm vụ được giao',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: const Color(0xFF6B7280),
                      ),
                    ),
                  ],
                ),
              ),
              if (highestPriority != null)
                _PriorityBadge(priority: highestPriority.doUuTien),
            ],
          ),
          if (isExpanded && details.isNotEmpty) const SizedBox(height: 16),
          AnimatedCrossFade(
            firstChild: const SizedBox.shrink(),
            secondChild: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: List.generate(details.length, (index) {
                final detail = details[index];
                final isLast = index == details.length - 1;
                return _AssignmentDetailTile(
                  detail: detail,
                  isLast: isLast,
                  onTap: () => onViewDetail(detail),
                  onOpenAttachment: onOpenAttachment,
                  onEdit: onEdit,
                  onDelete: onDelete,
                  isEvaluating: false,
                  isEditing: editingSubtaskId == detail.subTaskId,
                  isDeleting: deletingSubtaskIds.contains(detail.subTaskId),
                  onShowSubmissionHistory: onShowSubmissionHistory,
                );
              }),
            ),
            crossFadeState:
                isExpanded
                    ? CrossFadeState.showSecond
                    : CrossFadeState.showFirst,
            duration: const Duration(milliseconds: 250),
          ),
        ],
      ),
    );
  }
}

class _PriorityBadge extends StatelessWidget {
  const _PriorityBadge({required this.priority});

  final String priority;

  @override
  Widget build(BuildContext context) {
    final color = _priorityColor(priority);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        _priorityDisplay(priority),
        style: TextStyle(color: color, fontWeight: FontWeight.w700),
      ),
    );
  }
}

class _AssignmentDetailTile extends StatelessWidget {
  const _AssignmentDetailTile({
    required this.detail,
    required this.isLast,
    required this.onTap,
    required this.onOpenAttachment,
    required this.onEdit,
    required this.onDelete,
    required this.isEvaluating,
    required this.isEditing,
    required this.isDeleting,
    required this.onShowSubmissionHistory,
  });

  final AssignmentDetail detail;
  final bool isLast;
  final VoidCallback onTap;
  final ValueChanged<String> onOpenAttachment;
  final ValueChanged<AssignmentDetail> onEdit;
  final ValueChanged<AssignmentDetail> onDelete;
  final bool isEvaluating;
  final bool isEditing;
  final bool isDeleting;
  final ValueChanged<List<DateTime>> onShowSubmissionHistory;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dateText = _formatDate(detail.ngayPhanCong) ?? 'Không rõ';
    final result = detail.ketQuaThucHien;
    final attachments = result.files;
    final hasResultNote = result.hasNote;
    final priorityColor = _priorityColor(detail.doUuTien);

    const bgColor = Color(0xFFF9FAFB);
    const borderColor = Color(0xFFE5E7EB);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Container(
          margin: EdgeInsets.only(bottom: isLast ? 0 : 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: bgColor,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: borderColor),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      detail.moTa,
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFF1F2937),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: priorityColor.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      _priorityDisplay(detail.doUuTien),
                      style: TextStyle(
                        color: priorityColor,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _DetailInfoRow(label: 'Ngày phân công', value: dateText),
              if (detail.ngayNop.isNotEmpty)
                GestureDetector(
                  onTap: () => onShowSubmissionHistory(detail.ngayNop),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Row(
                      children: [
                        const SizedBox(width: 120),
                        const Icon(
                          Icons.history,
                          size: 16,
                          color: Color(0xFF2563EB),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Ngày nộp: ${_formatDate(detail.ngayNop.last)} (${detail.ngayNop.length} lần)',
                            style: const TextStyle(
                              color: Color(0xFF2563EB),
                              fontSize: 13,
                              decoration: TextDecoration.underline,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              _DetailInfoRow(label: 'Đánh giá', value: detail.danhGia),
              const SizedBox(height: 8),
              Text(
                'Tiến độ',
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: const Color(0xFF374151),
                ),
              ),
              const SizedBox(height: 6),
              _ProgressBar(
                progress: _progressValue(detail.tienDoHoanThanh),
                label: detail.tienDoHoanThanh,
              ),
              if (hasResultNote) ...[
                const SizedBox(height: 12),
                Text(
                  'Kết quả đạt được',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: const Color(0xFF374151),
                  ),
                ),
                const SizedBox(height: 6),
                Text(result.noiDung, style: theme.textTheme.bodySmall),
              ],
              if (attachments.isNotEmpty) ...[
                const SizedBox(height: 12),
                Text(
                  'Kết quả thực hiện',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: const Color(0xFF374151),
                  ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: attachments
                      .map(
                        (file) => OutlinedButton.icon(
                          onPressed: () => onOpenAttachment(file),
                          icon: const Icon(Icons.download, size: 18),
                          label: Text(
                            _filenameFromPath(file),
                            overflow: TextOverflow.ellipsis,
                          ),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(0xFF2563EB),
                            side: const BorderSide(color: Color(0xFFE5E7EB)),
                          ),
                        ),
                      )
                      .toList(growable: false),
                ),
              ],
              const SizedBox(height: 12),
              Wrap(
                alignment: WrapAlignment.end,
                spacing: 8,
                runSpacing: 8,
                children: [
                  OutlinedButton.icon(
                    onPressed:
                        (isEvaluating || isEditing || isDeleting)
                            ? null
                            : () => onEdit(detail),
                    icon:
                        isEditing
                            ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                            : const Icon(Icons.edit_outlined, size: 18),
                    label: Text(isEditing ? 'Đang lưu...' : 'Chỉnh sửa'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.blue.shade700,
                      side: BorderSide(color: Colors.blue.shade200),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 10,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                  OutlinedButton.icon(
                    onPressed:
                        (isEvaluating || isEditing || isDeleting)
                            ? null
                            : () => onDelete(detail),
                    icon:
                        isDeleting
                            ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                            : const Icon(Icons.delete_outline, size: 18),
                    label: Text(isDeleting ? 'Đang xoá...' : 'Xoá'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.red.shade600,
                      side: BorderSide(color: Colors.red.shade200),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 10,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProgressBar extends StatelessWidget {
  const _ProgressBar({required this.progress, required this.label});

  final double progress;
  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final effective = progress.clamp(0.0, 1.0);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: LinearProgressIndicator(
            value: effective,
            minHeight: 10,
            backgroundColor: const Color(0xFFE5E7EB),
            valueColor: AlwaysStoppedAnimation<Color>(
              _progressColor(effective),
            ),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: theme.textTheme.bodySmall?.copyWith(
            color: const Color(0xFF1F2937),
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

class _DetailInfoRow extends StatelessWidget {
  const _DetailInfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: theme.textTheme.bodySmall?.copyWith(
                color: Colors.grey.shade700,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Expanded(child: Text(value, style: theme.textTheme.bodySmall)),
        ],
      ),
    );
  }
}

String? _formatDate(DateTime? date) {
  if (date == null) return null;
  return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
}

String _formatDateTime(DateTime? dateTime) {
  if (dateTime == null) return 'Không rõ thời gian';
  final value = dateTime.toLocal();
  final day = value.day.toString().padLeft(2, '0');
  final month = value.month.toString().padLeft(2, '0');
  final year = value.year.toString();
  final hour = value.hour.toString().padLeft(2, '0');
  final minute = value.minute.toString().padLeft(2, '0');
  return '$day/$month/$year $hour:$minute';
}

String _formatDateTimeWithSeconds(DateTime? dateTime) {
  if (dateTime == null) return 'Không rõ thời gian';
  final value = dateTime.toLocal();
  final day = value.day.toString().padLeft(2, '0');
  final month = value.month.toString().padLeft(2, '0');
  final year = value.year.toString();
  final hour = value.hour.toString().padLeft(2, '0');
  final minute = value.minute.toString().padLeft(2, '0');
  final second = value.second.toString().padLeft(2, '0');
  return '$day/$month/$year $hour:$minute:$second';
}

String _filenameFromPath(String path) {
  if (path.isEmpty) return 'Tệp đính kèm';
  final segments = path.split('/');
  if (segments.isEmpty) return path;
  final fileName = segments.last;
  final index = fileName.indexOf('_');
  if (index >= 0 && index < fileName.length - 1) {
    return fileName.substring(index + 1);
  }
  return fileName;
}

class _SortIconButton extends StatelessWidget {
  const _SortIconButton({required this.sortOption, required this.onChanged});

  final AssignmentSortOption sortOption;
  final ValueChanged<AssignmentSortOption> onChanged;

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
                ...AssignmentSortOption.values.map((option) {
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
                      option.label,
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
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    const primary = Color(0xFF2563EB);
    const chipBackground = Color(0xFFF3F4F6);
    const border = Color(0xFFE5E7EB);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? primary : chipBackground,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: isSelected ? primary : border, width: 1),
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
