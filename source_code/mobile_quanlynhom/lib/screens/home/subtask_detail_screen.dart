import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../models/task_assignment.dart';
import '../../services/group_service.dart';

typedef AttachmentOpener = Future<void> Function(String path);

class SubTaskDetailScreen extends StatefulWidget {
  const SubTaskDetailScreen({
    super.key,
    required this.taskId,
    required this.memberId,
    required this.taskName,
    required this.memberName,
    required this.detail,
    required this.onOpenAttachment,
  });

  final int taskId;
  final int memberId;
  final String taskName;
  final String memberName;
  final AssignmentDetail detail;
  final AttachmentOpener onOpenAttachment;

  @override
  State<SubTaskDetailScreen> createState() => _SubTaskDetailScreenState();
}

class _SubTaskDetailScreenState extends State<SubTaskDetailScreen> {
  final GroupService _service = GroupService();

  bool _isSubmitting = false;
  bool _isTogglingLock = false;
  bool _shouldRefresh = false;
  late String _currentRating;
  late String _currentProgress;
  late int _currentLockState;
  late TextEditingController _ratingController;

  @override
  void initState() {
    super.initState();
    final normalized = widget.detail.danhGia.trim();
    _currentRating = normalized.isEmpty ? 'Chưa có' : normalized;
    _ratingController = TextEditingController(text: normalized);

    final progressRaw = widget.detail.tienDoHoanThanh.trim();
    _currentProgress = progressRaw.isEmpty ? '0%' : progressRaw;

    _currentLockState = widget.detail.trangThaiKhoa;
  }

  @override
  void dispose() {
    _ratingController.dispose();
    super.dispose();
  }

  Future<void> _toggleLockState() async {
    if (_isTogglingLock || widget.detail.subTaskId.isEmpty) return;

    setState(() {
      _isTogglingLock = true;
    });

    final newLockState = _currentLockState == 1 ? 0 : 1;

    try {
      await _service.toggleLockSubTask(
        taskId: widget.taskId,
        memberId: widget.memberId,
        subTaskId: widget.detail.subTaskId,
        lockState: newLockState,
      );

      if (!mounted) return;
      setState(() {
        _currentLockState = newLockState;
        _shouldRefresh = true;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              newLockState == 1
                  ? 'Đã khóa subtask thành công.'
                  : 'Đã mở khóa subtask thành công.',
            ),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Không thể ${newLockState == 1 ? "khóa" : "mở khóa"}: $e',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isTogglingLock = false;
        });
      }
    }
  }

  Future<void> _submitEvaluation() async {
    if (_isSubmitting || widget.detail.subTaskId.isEmpty) return;

    setState(() {
      _isSubmitting = true;
    });

    final rating = _ratingController.text.trim();
    if (rating.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Vui lòng nhập nội dung đánh giá.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      setState(() {
        _isSubmitting = false;
      });
      return;
    }
    try {
      await _service.evaluateTaskProgress(
        taskId: widget.taskId,
        memberId: widget.memberId,
        subTaskId: widget.detail.subTaskId,
        rating: rating,
      );

      try {
        await _service.updateTaskProgress(taskId: widget.taskId);
      } catch (progressError) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Không thể cập nhật tiến độ: $progressError'),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      }

      if (!mounted) return;
      setState(() {
        _currentRating = rating;
        _ratingController.text = rating;
        _shouldRefresh = true;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Đánh giá thành công.'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Không thể đánh giá: $e'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  Future<bool> _handleWillPop() async {
    Navigator.of(context).pop(_shouldRefresh);
    return false;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final assignedDate =
        widget.detail.ngayPhanCong != null
            ? DateFormat('dd/MM/yyyy').format(widget.detail.ngayPhanCong!)
            : 'Không rõ';
    final result = widget.detail.ketQuaThucHien;
    final attachments = result.files;
    final hasResultNote = result.hasNote;
    final canEvaluate =
        widget.detail.subTaskId.isNotEmpty && _currentLockState != 1;

    return WillPopScope(
      onWillPop: _handleWillPop,
      child: Scaffold(
        appBar: AppBar(
          title: Text(
            'Chi tiết sub-task',
            style: theme.textTheme.titleMedium?.copyWith(color: Colors.black),
          ),
          foregroundColor: Colors.white,
          leading: BackButton(
            onPressed: () => Navigator.of(context).pop(_shouldRefresh),
          ),
        ),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
          children: [
            _SectionCard(
              title: 'Thông tin chung',
              children: [
                _InfoRow(label: 'Công việc', value: widget.taskName),
                _InfoRow(label: 'Giao cho', value: widget.memberName),
                _InfoRow(label: 'Mô tả', value: widget.detail.moTa),
              ],
            ),
            const SizedBox(height: 16),
            _SectionCard(
              title: 'Chi tiết phân công',
              children: [
                _InfoRow(label: 'Ngày phân công', value: assignedDate),
                _InfoRow(
                  label: 'Độ ưu tiên',
                  value: _priorityDisplay(widget.detail.doUuTien),
                ),
                _InfoRow(label: 'Đánh giá hiện tại', value: _currentRating),
                _ProgressInfo(progressLabel: _currentProgress),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Icon(
                      _currentLockState == 1 ? Icons.lock : Icons.lock_open,
                      size: 20,
                      color: _currentLockState == 1 ? Colors.red : Colors.green,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      _currentLockState == 1 ? 'Đã khóa' : 'Chưa khóa',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                        color:
                            _currentLockState == 1 ? Colors.red : Colors.green,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _isTogglingLock ? null : _toggleLockState,
                    icon:
                        _isTogglingLock
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
                              _currentLockState == 1
                                  ? Icons.lock_open
                                  : Icons.lock,
                            ),
                    label: Text(
                      _isTogglingLock
                          ? 'Đang xử lý...'
                          : (_currentLockState == 1 ? 'Mở khóa' : 'Khóa'),
                    ),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      backgroundColor:
                          _currentLockState == 1 ? Colors.green : Colors.red,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
              ],
            ),
            if (canEvaluate) ...[
              const SizedBox(height: 16),
              _SectionCard(
                title: 'Cập nhật đánh giá',
                children: [
                  Text(
                    'Nhập nội dung đánh giá mới cho sub-task này.',
                    style: theme.textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _ratingController,
                    maxLines: null,
                    minLines: 2,
                    decoration: InputDecoration(
                      hintText: 'Nhập đánh giá...',
                      filled: true,
                      fillColor: const Color(0xFFF9FAFB),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
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
                    textInputAction: TextInputAction.newline,
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _isSubmitting ? null : _submitEvaluation,
                      icon:
                          _isSubmitting
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
                              : const Icon(Icons.save_outlined),
                      label: Text(
                        _isSubmitting ? 'Đang lưu...' : 'Lưu đánh giá',
                      ),
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        backgroundColor: const Color(0xFF2563EB),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ] else ...[
              const SizedBox(height: 16),
              _SectionCard(
                title: 'Cập nhật sub-task',
                children: const [
                  Text('Không thể cập nhật do thiếu mã công việc con.'),
                ],
              ),
            ],
            if (hasResultNote) ...[
              const SizedBox(height: 16),
              _SectionCard(
                title: 'Kết quả đạt được',
                children: [
                  Text(result.noiDung, style: theme.textTheme.bodyMedium),
                ],
              ),
            ],
            if (attachments.isNotEmpty) ...[
              const SizedBox(height: 16),
              _SectionCard(
                title: 'Tệp đính kèm',
                children: attachments
                    .map(
                      (file) => ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.attach_file, size: 22),
                        title: Text(
                          _filenameFromPath(file),
                          style: theme.textTheme.bodyMedium,
                        ),
                        onTap: () => widget.onOpenAttachment(file),
                      ),
                    )
                    .toList(growable: false),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 12),
          ...children,
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
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
          Expanded(
            child: Text(
              value.isEmpty ? '—' : value,
              style: theme.textTheme.bodyMedium,
            ),
          ),
        ],
      ),
    );
  }
}

class _ProgressInfo extends StatelessWidget {
  const _ProgressInfo({required this.progressLabel});

  final String progressLabel;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final progress = _progressValue(progressLabel);
    final progressColor = _progressColor(progress);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Tiến độ',
          style: theme.textTheme.bodyMedium?.copyWith(
            fontWeight: FontWeight.w600,
            color: const Color(0xFF374151),
          ),
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: LinearProgressIndicator(
            value: progress,
            minHeight: 10,
            backgroundColor: const Color(0xFFE5E7EB),
            valueColor: AlwaysStoppedAnimation<Color>(progressColor),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          progressLabel,
          style: theme.textTheme.bodySmall?.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

String _priorityDisplay(String raw) {
  final key = _priorityKey(raw);
  switch (key) {
    case 'high':
      return 'Ưu tiên cao';
    case 'medium':
      return 'Ưu tiên trung bình';
    case 'low':
      return 'Ưu tiên thấp';
    default:
      return raw.trim().isEmpty ? 'Không rõ' : raw;
  }
}

String _priorityKey(String raw) {
  final normalized = raw.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');
  if (normalized.contains('cao') || normalized.contains('high')) return 'high';
  if (normalized.contains('trung') || normalized.contains('medium'))
    return 'medium';
  if (normalized.contains('thap') || normalized.contains('low')) return 'low';
  return 'other';
}

double _progressValue(String raw) {
  final match = RegExp(r'(\d{1,3})(?:\.\d+)?').firstMatch(raw);
  if (match == null) return 0;
  final value = double.tryParse(match.group(1) ?? '0') ?? 0;
  final clamped = value.clamp(0, 100);
  return clamped / 100;
}

Color _progressColor(double progress) {
  if (progress >= 0.9) return const Color(0xFF16A34A);
  if (progress >= 0.75) return const Color(0xFF22C55E);
  if (progress >= 0.5) return const Color(0xFFF59E0B);
  if (progress >= 0.25) return const Color(0xFFF97316);
  return const Color(0xFFEF4444);
}

String _filenameFromPath(String path) {
  if (path.isEmpty) return 'Tệp đính kèm';
  final segments = path.split('/');
  if (segments.isEmpty) return path;
  final rawFileName = segments.last.trim();
  if (rawFileName.isEmpty) return 'Tệp đính kèm';

  final uuidPattern = RegExp(
    r'^[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}_',
  );
  final shortCodePattern = RegExp(r'^[A-Za-z0-9\-]{8,}_');

  final uuidMatch = uuidPattern.matchAsPrefix(rawFileName);
  if (uuidMatch != null) {
    final candidate = rawFileName.substring(uuidMatch.end);
    if (candidate.isNotEmpty) return candidate;
  }

  final shortCodeMatch = shortCodePattern.matchAsPrefix(rawFileName);
  if (shortCodeMatch != null) {
    final candidate = rawFileName.substring(shortCodeMatch.end);
    if (candidate.isNotEmpty) return candidate;
  }

  return rawFileName;
}
