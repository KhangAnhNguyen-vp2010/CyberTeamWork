import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:mobile_quanlynhom/constants/api_constants.dart';
import 'package:mobile_quanlynhom/constants/app_colors.dart';
import 'package:mobile_quanlynhom/models/group_summary.dart';
import 'package:mobile_quanlynhom/models/project_domain.dart';
import 'package:mobile_quanlynhom/models/project_summary.dart';
import 'package:mobile_quanlynhom/services/group_service.dart';
import 'package:mobile_quanlynhom/models/notification_item.dart';
import 'package:mobile_quanlynhom/services/local_notification_service.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../widgets/custom_toast.dart';
import 'widgets/header.dart';
import 'widgets/projects/project_card.dart';
import 'widgets/projects/project_controls.dart';
import 'widgets/projects/pagination_controls.dart';
import 'member_project_tasks_screen.dart';
import 'leader_project_tabs_screen.dart';
import 'notifications_screen.dart';

enum AssignmentSortOption {
  memberNameAsc,
  memberNameDesc,
  taskCountDesc,
  progressDesc,
}

enum _AssignmentPriorityFilter { all, high, medium, low }

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFFFEE2E2),
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
              'Đã xảy ra lỗi',
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
              style: const TextStyle(
                fontSize: 14,
                color: Color(0xFF6B7280),
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: onRetry,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF2563EB),
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 14,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              icon: const Icon(Icons.refresh, size: 20),
              label: const Text('Thử lại'),
            ),
          ],
        ),
      ),
    );
  }
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, this.memberId});

  final int? memberId;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _groupService = GroupService();
  final TextEditingController _searchController = TextEditingController();
  List<GroupSummary> _groups = const [];
  GroupSummary? _selectedGroup;
  bool _isLoading = false;
  String? _error;
  int? _memberId;
  List<ProjectSummary> _projects = const [];
  bool _isLoadingProjects = false;
  String? _projectError;
  String _searchQuery = '';
  ProjectSortOption _sortOption = ProjectSortOption.nameAsc;
  int _selectedDomainId = _allDomainId;
  List<ProjectDomain> _domains = const [];
  bool _isLoadingDomains = false;
  int _currentProjectPage = 0;
  List<NotificationItem> _notifications = const <NotificationItem>[];
  bool _notificationsLoading = false;
  bool _hasLoadedNotifications = false;
  bool _notificationsFetching = false;
  Timer? _notificationTimer;
  bool _hasInitializedNotificationWatcher = false;
  bool _suppressLocalNotifications = false;

  static const int _allDomainId = -1;
  static const int _pageSize = 4;

  @override
  void initState() {
    super.initState();
    _loadGroups();
    _loadDomains();
  }

  @override
  void dispose() {
    _notificationTimer?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadProjects(int groupId) async {
    setState(() {
      _isLoadingProjects = true;
      _projectError = null;
    });

    try {
      final projects = await _groupService.fetchProjects(groupId: groupId);
      if (!mounted) return;
      setState(() {
        _projects = projects;
        _projectError = null;
        _currentProjectPage = 0;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _projectError = 'Không thể tải danh sách dự án. Vui lòng thử lại sau.';
        _projects = const [];
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoadingProjects = false;
        });
      }
    }
  }

  String? _resolveProjectImageUrl(ProjectSummary project) {
    final path = project.anhBia;
    if (path == null || path.isEmpty) {
      return 'assets/images/project-default.png';
    }
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    final base = ApiConstants.baseUrl;
    if (path.startsWith('/')) {
      return '$base$path';
    }
    return '$base/$path';
  }

  Future<void> _openTasks(ProjectSummary project) async {
    if (!mounted) return;

    final role = _selectedGroup?.chucVu?.toLowerCase().trim();
    final isLeader =
        role != null && (role.contains('trưởng') || role.contains('leader'));

    if (isLeader) {
      final memberId = await _getMemberId();
      if (!mounted) return;

      if (memberId == null) {
        CustomToast.show(
          context,
          message: 'Không xác định được thành viên. Vui lòng đăng nhập lại.',
          icon: Icons.error_outline,
          isError: true,
        );
        return;
      }

      await Navigator.of(context).push(
        MaterialPageRoute(
          builder:
              (_) => LeaderProjectTabsScreen(
                project: project,
                groupId: _selectedGroup?.nhomId ?? 0,
                memberId: memberId,
              ),
        ),
      );
      return;
    }

    final memberId = await _getMemberId();
    if (!mounted) return;

    if (memberId == null) {
      CustomToast.show(
        context,
        message: 'Không xác định được thành viên. Vui lòng đăng nhập lại.',
        icon: Icons.error_outline,
        isError: true,
      );
      return;
    }

    await Navigator.of(context).push(
      MaterialPageRoute(
        builder:
            (_) => MemberProjectTasksScreen(
              project: project,
              memberId: memberId,
              showAssignmentsTab: isLeader,
            ),
      ),
    );
  }

  Future<void> _loadDomains() async {
    setState(() {
      _isLoadingDomains = true;
    });

    try {
      final domains = await _groupService.fetchDomains();
      if (!mounted) return;
      setState(() {
        _domains = domains;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _domains = const [];
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoadingDomains = false;
        });
      }
    }
  }

  Future<void> _loadGroups() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final memberId = await _getMemberId();
      if (!mounted) return;

      if (memberId == null) {
        setState(() {
          _isLoading = false;
          _error = 'Không tìm thấy thông tin thành viên.';
        });
        return;
      }

      final groups = await _groupService.fetchGroups(memberId: memberId);
      if (!mounted) return;
      setState(() {
        _groups = groups;
        _memberId = memberId;
        if (groups.isNotEmpty) {
          _selectedGroup = groups.first;
        }
      });

      if (groups.isNotEmpty) {
        await _loadProjects(groups.first.nhomId);
      }

      unawaited(_initializeNotificationWatcher());
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Không thể tải danh sách nhóm. Vui lòng thử lại sau.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  String? _resolveImageUrl(GroupSummary group) {
    final path = group.anhBia;
    if (path == null || path.isEmpty) {
      return null;
    }

    if (path.startsWith('http')) {
      return path;
    }

    final base = ApiConstants.baseUrl;
    return path.startsWith('/') ? '$base$path' : '$base/$path';
  }

  Future<int?> _getMemberId() async {
    if (_memberId != null) return _memberId;
    if (widget.memberId != null) {
      _memberId = widget.memberId;
      return _memberId;
    }

    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString('user_info');
    if (raw == null || raw.isEmpty) {
      return null;
    }

    try {
      final decoded = jsonDecode(raw);
      print('[HomeScreen] user_info decoded = $decoded');
      if (decoded is Map<String, dynamic>) {
        Map<String, dynamic>? payload = decoded;
        if (payload['data'] is Map<String, dynamic>) {
          payload = payload['data'] as Map<String, dynamic>;
        }
        if (payload['user'] is Map<String, dynamic>) {
          payload = payload['user'] as Map<String, dynamic>;
        }

        final memberIdValue = payload['thanhVienId'] ?? payload['memberId'];
        print('[HomeScreen] resolved memberId value = $memberIdValue');
        if (memberIdValue is int) {
          _memberId = memberIdValue;
          return _memberId;
        }
        final parsed = int.tryParse(memberIdValue?.toString() ?? '');
        _memberId = parsed;
        return _memberId;
      }
    } catch (_) {
      return null;
    }
    return null;
  }

  Widget _buildContent() {
    if (_selectedGroup == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.groups_outlined,
                size: 64,
                color: Colors.grey.shade300,
              ),
              const SizedBox(height: 16),
              Text(
                _error ?? 'Chưa có nhóm nào.',
                style: const TextStyle(fontSize: 15, color: Color(0xFF6B7280)),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    if (_isLoadingProjects) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFF2563EB)),
      );
    }

    if (_projectError != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline, size: 64, color: Colors.red.shade300),
              const SizedBox(height: 16),
              Text(
                _projectError!,
                style: const TextStyle(fontSize: 15, color: Color(0xFFEF4444)),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    if (_projects.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.folder_open_outlined,
                size: 64,
                color: Colors.grey.shade300,
              ),
              const SizedBox(height: 16),
              Text(
                'Nhóm "${_selectedGroup!.tenNhom}" chưa có dự án nào.',
                style: const TextStyle(fontSize: 15, color: Color(0xFF6B7280)),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    final filteredProjects = _applyFilters();

    if (filteredProjects.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.search_off, size: 64, color: Colors.grey.shade300),
              const SizedBox(height: 16),
              const Text(
                'Không tìm thấy dự án phù hợp.',
                style: TextStyle(fontSize: 15, color: Color(0xFF6B7280)),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    final totalPages = (filteredProjects.length / _pageSize).ceil();
    final startIndex = _currentProjectPage * _pageSize;
    final pageItems = filteredProjects.sublist(
      startIndex,
      (startIndex + _pageSize).clamp(0, filteredProjects.length),
    );

    return Column(
      children: [
        Expanded(
          child: ListView.separated(
            itemCount: pageItems.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final project = pageItems[index];
              return ProjectCard(
                project: project,
                imageUrlResolver: _resolveProjectImageUrl,
                onTap: () => _openTasks(project),
              );
            },
          ),
        ),
        const SizedBox(height: 8),
        if (totalPages > 1)
          PaginationControls(
            currentPage: _currentProjectPage,
            totalPages: totalPages,
            onPageChanged: (page) {
              setState(() {
                _currentProjectPage = page;
              });
            },
          ),
      ],
    );
  }

  List<ProjectSummary> _applyFilters() {
    List<ProjectSummary> result = List<ProjectSummary>.from(_projects);

    if (_searchQuery.isNotEmpty) {
      final query = _searchQuery.toLowerCase();
      result =
          result
              .where(
                (project) =>
                    project.tenDuAn.toLowerCase().contains(query) ||
                    (project.moTa?.toLowerCase().contains(query) ?? false),
              )
              .toList();
    }

    if (_selectedDomainId != _allDomainId) {
      final selectedDomain = _domains.firstWhere(
        (domain) => domain.linhVucId == _selectedDomainId,
        orElse: () => ProjectDomain(linhVucId: _allDomainId, tenLinhVuc: ''),
      );

      if (selectedDomain.linhVucId != _allDomainId) {
        final domainName = selectedDomain.tenLinhVuc.toLowerCase();
        result =
            result
                .where(
                  (project) => project.tenLinhVuc?.toLowerCase() == domainName,
                )
                .toList();
      }
    }

    result.sort((a, b) {
      switch (_sortOption) {
        case ProjectSortOption.nameAsc:
          return a.tenDuAn.toLowerCase().compareTo(b.tenDuAn.toLowerCase());
        case ProjectSortOption.nameDesc:
          return b.tenDuAn.toLowerCase().compareTo(a.tenDuAn.toLowerCase());
        case ProjectSortOption.startDateAsc:
          return _compareDate(a.ngayBd, b.ngayBd);
        case ProjectSortOption.startDateDesc:
          return _compareDate(b.ngayBd, a.ngayBd);
      }
    });

    return result;
  }

  int _compareDate(DateTime? a, DateTime? b) {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    return a.compareTo(b);
  }

  Future<void> _handleNotificationsTap() async {
    final memberId = await _getMemberId();
    if (memberId == null) {
      if (!mounted) return;
      CustomToast.show(
        context,
        message: 'Không xác định được thành viên để tải thông báo.',
        isError: true,
        icon: Icons.error_outline,
      );
      return;
    }

    if (!_hasLoadedNotifications && !_notificationsLoading) {
      await _loadNotifications(
        memberIdOverride: memberId,
        allowLocalNotification: false,
      );
    }

    if (!mounted) return;

    _suppressLocalNotifications = true;
    try {
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder:
              (_) => NotificationsScreen(
                memberId: memberId,
                groupService: _groupService,
              ),
        ),
      );

      if (!mounted) return;
      await _loadNotifications(
        memberIdOverride: memberId,
        allowLocalNotification: false,
      );
    } finally {
      if (mounted) {
        _suppressLocalNotifications = false;
      } else {
        _suppressLocalNotifications = false;
      }
    }
  }

  Future<void> _initializeNotificationWatcher() async {
    if (_notificationTimer != null) {
      return;
    }

    await _loadNotifications(
      showLoadingIndicator: false,
      allowLocalNotification:
          !_suppressLocalNotifications && _hasInitializedNotificationWatcher,
    );

    _hasInitializedNotificationWatcher = true;

    if (!mounted) {
      return;
    }

    _notificationTimer?.cancel();
    _notificationTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      if (!mounted) return;
      unawaited(_loadNotifications(showLoadingIndicator: false));
    });
  }

  Future<void> _loadNotifications({
    int? memberIdOverride,
    bool showLoadingIndicator = true,
    bool allowLocalNotification = true,
  }) async {
    if (_notificationsFetching && !showLoadingIndicator) {
      return;
    }

    _notificationsFetching = true;

    final memberId = memberIdOverride ?? await _getMemberId();
    if (memberId == null) {
      if (!mounted) return;
      if (showLoadingIndicator) {
        setState(() {
          _notifications = const <NotificationItem>[];
          _hasLoadedNotifications = true;
        });
        CustomToast.show(
          context,
          message: 'Không xác định được thành viên để tải thông báo.',
          isError: true,
          icon: Icons.error_outline,
        );
      }
      _notificationsFetching = false;
      return;
    }

    if (showLoadingIndicator) {
      setState(() {
        _notificationsLoading = true;
      });
    }

    final previousIds = _notifications.map((item) => item.id).toSet();

    try {
      final items = await _groupService.fetchNotifications(memberId: memberId);
      if (!mounted) return;
      final newItems = items
          .where((item) => !previousIds.contains(item.id))
          .toList(growable: false);
      setState(() {
        _notifications = items;
        _hasLoadedNotifications = true;
      });

      if (allowLocalNotification &&
          !_suppressLocalNotifications &&
          newItems.isNotEmpty) {
        for (final item in newItems) {
          unawaited(
            LocalNotificationService().showNotification(
              id: item.createdAt.millisecondsSinceEpoch.remainder(1 << 31),
              title: item.title,
              body: item.content,
            ),
          );
        }
      }
    } catch (error) {
      print('[HomeScreen] Load notifications error: $error');
      if (!mounted) return;
      if (showLoadingIndicator) {
        setState(() {
          _notifications = const <NotificationItem>[];
          _hasLoadedNotifications = true;
        });
        CustomToast.show(
          context,
          message: 'Tải thông báo thất bại. Vui lòng thử lại.',
          isError: true,
          icon: Icons.error_outline,
        );
      }
    } finally {
      _notificationsFetching = false;
      if (mounted && showLoadingIndicator) {
        setState(() {
          _notificationsLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 12.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Header(
                groups: _groups,
                selectedGroup: _selectedGroup,
                isLoading: _isLoading,
                error: _error,
                onReload: _loadGroups,
                imageUrlResolver: _resolveImageUrl,
                onSelected: (group) {
                  setState(() {
                    _selectedGroup = group;
                  });
                  _loadProjects(group.nhomId);
                },
                onNotificationsTap: _handleNotificationsTap,
                hasUnreadNotifications: _notifications.any(
                  (item) => item.readAt == null,
                ),
              ),
              const SizedBox(height: 20.0),
              ProjectControls(
                searchController: _searchController,
                onSearchChanged: (value) {
                  setState(() {
                    _searchQuery = value;
                  });
                },
                sortOption: _sortOption,
                onSortChanged: (option) {
                  setState(() {
                    _sortOption = option;
                  });
                },
                domains: _domains,
                isLoadingDomains: _isLoadingDomains,
                selectedDomainId: _selectedDomainId,
                allDomainId: _allDomainId,
                onFilterChanged: (domainId) {
                  setState(() {
                    _selectedDomainId = domainId;
                  });
                },
              ),
              const SizedBox(height: 16.0),
              Expanded(child: _buildContent()),
            ],
          ),
        ),
      ),
    );
  }
}
