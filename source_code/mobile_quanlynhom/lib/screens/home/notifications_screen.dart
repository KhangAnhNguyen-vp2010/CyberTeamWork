import 'package:flutter/material.dart';

import '../../models/notification_item.dart';
import '../../services/group_service.dart';
import '../../widgets/custom_toast.dart';
import '../../services/local_notification_service.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({
    super.key,
    required this.memberId,
    required this.groupService,
    this.enableLocalAlerts = false,
  });

  final int memberId;
  final GroupService groupService;
  final bool enableLocalAlerts;

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationIconPalette {
  const _NotificationIconPalette({
    required this.background,
    required this.foreground,
  });

  final Color background;
  final Color foreground;
}

enum NotificationSortOption { newest, oldest, unreadFirst, pinnedFirst }

extension NotificationSortOptionX on NotificationSortOption {
  String get label {
    switch (this) {
      case NotificationSortOption.newest:
        return 'Mới nhất';
      case NotificationSortOption.oldest:
        return 'Cũ nhất';
      case NotificationSortOption.unreadFirst:
        return 'Ưu tiên chưa đọc';
      case NotificationSortOption.pinnedFirst:
        return 'Ưu tiên ghim';
    }
  }
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<NotificationItem> _notifications = const <NotificationItem>[];
  List<NotificationItem> _filteredNotifications = const <NotificationItem>[];
  bool _isLoading = false;
  bool _hasLoadedOnce = false;
  String? _error;
  final Set<String> _markingNotificationIds = <String>{};
  final Set<String> _pinningNotificationIds = <String>{};
  final Set<String> _deletingNotificationIds = <String>{};
  bool _markingAll = false;
  late final TextEditingController _searchController;
  NotificationSortOption _sortOption = NotificationSortOption.newest;

  List<NotificationItem> _applyFilters(List<NotificationItem> source) {
    final query = _searchController.text.trim().toLowerCase();
    Iterable<NotificationItem> result = source;

    if (query.isNotEmpty) {
      result = result.where((item) {
        final title = item.title.toLowerCase();
        final content = item.content.toLowerCase();
        final sender = item.senderEmail.toLowerCase();
        return title.contains(query) || content.contains(query) || sender.contains(query);
      });
    }

    final list = result.toList(growable: false);

    switch (_sortOption) {
      case NotificationSortOption.newest:
        list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
        break;
      case NotificationSortOption.oldest:
        list.sort((a, b) => a.createdAt.compareTo(b.createdAt));
        break;
      case NotificationSortOption.unreadFirst:
        list.sort((a, b) {
          final unreadCompare = (b.readAt == null ? 1 : 0) - (a.readAt == null ? 1 : 0);
          if (unreadCompare != 0) return -unreadCompare;
          return b.createdAt.compareTo(a.createdAt);
        });
        break;
      case NotificationSortOption.pinnedFirst:
        list.sort((a, b) {
          final pinCompare = b.pin.compareTo(a.pin);
          if (pinCompare != 0) return pinCompare;
          return b.createdAt.compareTo(a.createdAt);
        });
        break;
    }

    return list;
  }

  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController();
    _loadNotifications();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadNotifications() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final items = await widget.groupService.fetchNotifications(memberId: widget.memberId);
      if (!mounted) return;
      final previousIds = _notifications.map((e) => e.id).toSet();
      final newItems = items.where((item) => !previousIds.contains(item.id)).toList();
      setState(() {
        _notifications = items;
        _filteredNotifications = _applyFilters(items);
        _hasLoadedOnce = true;
        _error = null;
      });

      if (widget.enableLocalAlerts && newItems.isNotEmpty) {
        final newest = newItems.reduce((a, b) => a.createdAt.isAfter(b.createdAt) ? a : b);
        await LocalNotificationService().showNotification(
          id: newest.createdAt.millisecondsSinceEpoch.remainder(1 << 31),
          title: newest.title,
          body: newest.content,
        );
      }
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = 'Tải thông báo thất bại. Vui lòng thử lại.';
        _notifications = const <NotificationItem>[];
        _filteredNotifications = const <NotificationItem>[];
        _hasLoadedOnce = true;
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _markAllAsRead() async {
    if (_notifications.isEmpty || _markingAll) return;

    setState(() => _markingAll = true);

    try {
      final message = await widget.groupService.markAllNotificationsAsRead(memberId: widget.memberId);
      if (!mounted) return;
      final now = DateTime.now();
      setState(() {
        _notifications = _notifications
            .map((item) => item.readAt != null ? item : item.copyWith(readAt: now))
            .toList(growable: false);
        _filteredNotifications = _applyFilters(_notifications);
      });

      CustomToast.show(
        context,
        message: message,
        icon: Icons.done_all,
      );
    } catch (error) {
      if (!mounted) return;
      CustomToast.show(
        context,
        message: 'Không thể đánh dấu tất cả: $error',
        isError: true,
        icon: Icons.error_outline,
      );
    } finally {
      if (mounted) {
        setState(() => _markingAll = false);
      }
    }
  }

  Future<void> _toggleNotificationPin(NotificationItem item) async {
    if (_pinningNotificationIds.contains(item.id)) return;

    setState(() => _pinningNotificationIds.add(item.id));

    try {
      final message = await widget.groupService.toggleNotificationPin(
        memberId: widget.memberId,
        notificationId: item.id,
      );
      if (!mounted) return;
      setState(() {
        _notifications = _notifications
            .map(
              (notification) => notification.id == item.id
                  ? notification.copyWith(pin: notification.pin == 1 ? 0 : 1)
                  : notification,
            )
            .toList(growable: false);
        _filteredNotifications = _applyFilters(_notifications);
      });

      CustomToast.show(
        context,
        message: message,
        icon: Icons.push_pin_outlined,
      );
    } catch (error) {
      if (!mounted) return;
      CustomToast.show(
        context,
        message: 'Không thể thay đổi trạng thái ghim: $error',
        isError: true,
        icon: Icons.error_outline,
      );
    } finally {
      if (mounted) {
        setState(() => _pinningNotificationIds.remove(item.id));
      }
    }
  }

  Future<void> _deleteNotification(NotificationItem item) async {
    if (_deletingNotificationIds.contains(item.id)) return;

    setState(() => _deletingNotificationIds.add(item.id));

    try {
      final message = await widget.groupService.deleteNotification(
        memberId: widget.memberId,
        notificationId: item.id,
      );
      if (!mounted) return;
      setState(() {
        _notifications = _notifications.where((notification) => notification.id != item.id).toList(growable: false);
        _filteredNotifications = _applyFilters(_notifications);
      });

      CustomToast.show(
        context,
        message: message,
        icon: Icons.delete_outline,
      );
    } catch (error) {
      if (!mounted) return;
      CustomToast.show(
        context,
        message: 'Không thể xoá thông báo: $error',
        isError: true,
        icon: Icons.error_outline,
      );
    } finally {
      if (mounted) {
        setState(() => _deletingNotificationIds.remove(item.id));
      }
    }
  }

  Future<void> _markNotificationAsRead(NotificationItem item) async {
    if (item.readAt != null || _markingNotificationIds.contains(item.id)) {
      return;
    }

    setState(() {
      _markingNotificationIds.add(item.id);
    });

    try {
      await widget.groupService.markNotificationAsRead(
        memberId: widget.memberId,
        notificationId: item.id,
      );
      if (!mounted) return;
      final updated = _notifications.map((notification) {
        if (notification.id == item.id) {
          return notification.copyWith(readAt: DateTime.now());
        }
        return notification;
      }).toList(growable: false);
      setState(() {
        _notifications = updated;
        _filteredNotifications = _applyFilters(updated);
      });
    } catch (error) {
      if (!mounted) return;
      CustomToast.show(
        context,
        message: 'Đánh dấu thông báo thất bại. Vui lòng thử lại.',
        isError: true,
        icon: Icons.error_outline,
      );
    } finally {
      if (mounted) {
        setState(() {
          _markingNotificationIds.remove(item.id);
        });
      }
    }
  }

  Future<void> _refresh() async {
    await _loadNotifications();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF2F6FF),
      appBar: AppBar(
        title: const Text('Thông báo'),
        actions: [
          IconButton(
            onPressed: (_isLoading || _markingAll || _notifications.isEmpty) ? null : _markAllAsRead,
            icon: _markingAll
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.done_all),
            tooltip: 'Đánh dấu tất cả đã đọc',
          ),
          IconButton(
            onPressed: _isLoading ? null : _refresh,
            icon: const Icon(Icons.refresh),
            tooltip: 'Làm mới',
          ),
        ],
      ),
      body: Column(
        children: [
          if (_isLoading && _hasLoadedOnce)
            const LinearProgressIndicator(minHeight: 2),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  controller: _searchController,
                  onChanged: (_) => setState(() => _filteredNotifications = _applyFilters(_notifications)),
                  decoration: InputDecoration(
                    prefixIcon: const Icon(Icons.search),
                    hintText: 'Tìm kiếm theo tiêu đề, nội dung, người gửi...',
                    filled: true,
                    fillColor: Colors.white,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('${_filteredNotifications.length} thông báo',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.grey.shade600)),
                    PopupMenuButton<NotificationSortOption>(
                      initialValue: _sortOption,
                      onSelected: (option) {
                        setState(() {
                          _sortOption = option;
                          _filteredNotifications = _applyFilters(_notifications);
                        });
                      },
                      itemBuilder: (context) => NotificationSortOption.values
                          .map(
                            (option) => PopupMenuItem(
                              value: option,
                              child: Text(option.label),
                            ),
                          )
                          .toList(),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.grey.shade200),
                        ),
                        child: Row(
                          children: [
                            Text(_sortOption.label),
                            const SizedBox(width: 8),
                            const Icon(Icons.arrow_drop_down),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _refresh,
              edgeOffset: 16,
              child: _buildBody(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading && !_hasLoadedOnce) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return ListView(
        padding: const EdgeInsets.all(24),
        children: [
          _NotificationStateMessage(
            icon: Icons.error_outline,
            message: _error!,
            actionLabel: 'Thử lại',
            onActionPressed: _refresh,
          ),
        ],
      );
    }

    if (_notifications.isEmpty) {
      return ListView(
        padding: const EdgeInsets.all(24),
        children: const [
          _NotificationStateMessage(
            icon: Icons.notifications_none,
            message: 'Bạn chưa có thông báo nào.',
          ),
        ],
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      itemCount: _filteredNotifications.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final item = _filteredNotifications[index];
        return _NotificationTile(
          item: item,
          isMarking: _markingNotificationIds.contains(item.id),
          isTogglingPin: _pinningNotificationIds.contains(item.id),
          isDeleting: _deletingNotificationIds.contains(item.id),
          onTap: () => _markNotificationAsRead(item),
          onTogglePin: () => _toggleNotificationPin(item),
          onDelete: () => _deleteNotification(item),
        );
      },
    );
  }
}

class _NotificationStateMessage extends StatelessWidget {
  const _NotificationStateMessage({
    required this.icon,
    required this.message,
    this.actionLabel,
    this.onActionPressed,
  });

  final IconData icon;
  final String message;
  final String? actionLabel;
  final Future<void> Function()? onActionPressed;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Icon(icon, size: 56, color: Colors.blueGrey.shade300),
        const SizedBox(height: 16),
        Text(
          message,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                fontWeight: FontWeight.w600,
                color: Colors.blueGrey.shade700,
              ),
        ),
        if (actionLabel != null && onActionPressed != null) ...[
          const SizedBox(height: 16),
          SizedBox(
            width: 160,
            child: ElevatedButton(
              onPressed: () => onActionPressed?.call(),
              child: Text(actionLabel!),
            ),
          ),
        ],
      ],
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({
    required this.item,
    required this.isMarking,
    required this.isTogglingPin,
    required this.isDeleting,
    required this.onTap,
    required this.onTogglePin,
    required this.onDelete,
  });

  final NotificationItem item;
  final bool isMarking;
  final bool isTogglingPin;
  final bool isDeleting;
  final VoidCallback onTap;
  final VoidCallback onTogglePin;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final subtitleStyle = theme.textTheme.bodyMedium?.copyWith(color: Colors.grey.shade700);
    final isUnread = item.readAt == null;
    final palette = _iconPalette(item.type);

    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: isMarking ? null : onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isUnread ? const Color(0xFFF4F6FF) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.grey.withOpacity(0.15)),
          boxShadow: [
            if (isUnread)
              BoxShadow(
                color: const Color(0xFF1E88E5).withOpacity(0.1),
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
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: palette.background,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    _mapTypeToIcon(item.type),
                    color: palette.foreground,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.title,
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: isUnread ? FontWeight.w700 : FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(item.content, style: subtitleStyle),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (isMarking)
                      Padding(
                        padding: const EdgeInsets.only(right: 8.0),
                        child: SizedBox(
                          height: 16,
                          width: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(theme.colorScheme.primary),
                          ),
                        ),
                      ),
                    if (isTogglingPin)
                      Padding(
                        padding: const EdgeInsets.only(right: 4.0),
                        child: SizedBox(
                          height: 16,
                          width: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(theme.colorScheme.primary),
                          ),
                        ),
                      )
                    else
                      IconButton(
                        onPressed: (isMarking || isDeleting) ? null : onTogglePin,
                        icon: Icon(
                          item.pin == 1 ? Icons.push_pin : Icons.push_pin_outlined,
                          color: item.pin == 1 ? Colors.amber.shade700 : Colors.grey.shade500,
                        ),
                        tooltip: item.pin == 1 ? 'Bỏ ghim' : 'Ghim thông báo',
                        visualDensity: VisualDensity.compact,
                      ),
                    if (isDeleting)
                      SizedBox(
                        height: 16,
                        width: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation<Color>(theme.colorScheme.primary),
                        ),
                      )
                    else
                      IconButton(
                        onPressed: (isMarking || isTogglingPin) ? null : onDelete,
                        icon: Icon(Icons.delete_outline, color: Colors.red.shade400),
                        tooltip: 'Xoá thông báo',
                        visualDensity: VisualDensity.compact,
                      ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Người gửi: ${item.senderEmail}',
                  style: theme.textTheme.bodySmall?.copyWith(color: Colors.grey.shade600),
                ),
                Row(
                  children: [
                    if (item.pin == 1)
                      Padding(
                        padding: const EdgeInsets.only(right: 8.0),
                        child: Icon(Icons.push_pin, size: 16, color: Colors.amber.shade700),
                      ),
                    Text(
                      _formatTimeAgo(item.createdAt),
                      style: theme.textTheme.bodySmall?.copyWith(color: Colors.grey.shade500),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  IconData _mapTypeToIcon(String type) {
    final normalized = type.toLowerCase();
    if (normalized.contains('task') || normalized.contains('công việc')) {
      return Icons.assignment_turned_in;
    }
    if (normalized.contains('deadline') || normalized.contains('hạn')) {
      return Icons.notifications_active_outlined;
    }
    if (normalized.contains('pin') || normalized.contains('ghim')) {
      return Icons.push_pin_outlined;
    }
    return Icons.notifications;
  }

  _NotificationIconPalette _iconPalette(String type) {
    final normalized = type.toLowerCase();

    if (normalized.contains('nhắc') || normalized.contains('deadline') || normalized.contains('hạn')) {
      return _NotificationIconPalette(
        background: const Color(0xFFFFF4E5),
        foreground: const Color(0xFFFB8C00),
      );
    }

    if (normalized.contains('task') || normalized.contains('công việc') || normalized.contains('giao việc')) {
      return _NotificationIconPalette(
        background: const Color(0xFFE8F0FF),
        foreground: const Color(0xFF1E88E5),
      );
    }

    if (normalized.contains('pin') || normalized.contains('ghim')) {
      return _NotificationIconPalette(
        background: const Color(0xFFF3E8FF),
        foreground: const Color(0xFF8E24AA),
      );
    }

    if (normalized.contains('nhóm') || normalized.contains('group')) {
      return _NotificationIconPalette(
        background: const Color(0xFFE1F5FE),
        foreground: const Color(0xFF0277BD),
      );
    }

    return _NotificationIconPalette(
      background: const Color(0xFFF1F5F9),
      foreground: const Color(0xFF4A5568),
    );
  }

  String _formatTimeAgo(DateTime dateTime) {
    final now = DateTime.now();
    final difference = now.difference(dateTime);

    if (difference.inSeconds < 60) {
      return 'Vừa xong';
    }
    if (difference.inMinutes < 60) {
      return '${difference.inMinutes} phút trước';
    }
    if (difference.inHours < 24) {
      return '${difference.inHours} giờ trước';
    }
    if (difference.inDays == 1) {
      return 'Hôm qua';
    }
    if (difference.inDays < 7) {
      return '${difference.inDays} ngày trước';
    }
    if (difference.inDays < 30) {
      final weeks = (difference.inDays / 7).floor();
      return '$weeks tuần trước';
    }
    if (difference.inDays < 365) {
      final months = (difference.inDays / 30).floor();
      return '$months tháng trước';
    }
    final years = (difference.inDays / 365).floor();
    return '$years năm trước';
  }
}
