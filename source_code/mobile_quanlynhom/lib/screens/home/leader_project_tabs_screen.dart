import 'package:flutter/material.dart';
import '../../models/project_summary.dart';
import 'task_details_screen.dart';
import 'member_project_tasks_screen.dart';
import 'project_overview_screen.dart';

class LeaderProjectTabsScreen extends StatefulWidget {
  const LeaderProjectTabsScreen({
    super.key,
    required this.project,
    required this.groupId,
    required this.memberId,
  });

  final ProjectSummary project;
  final int groupId;
  final int memberId;

  @override
  State<LeaderProjectTabsScreen> createState() =>
      _LeaderProjectTabsScreenState();
}

class _LeaderProjectTabsScreenState extends State<LeaderProjectTabsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final GlobalKey<TaskDetailsScreenState> _taskDetailsKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(_onTabChanged);
  }

  @override
  void dispose() {
    _tabController.removeListener(_onTabChanged);
    _tabController.dispose();
    super.dispose();
  }

  void _onTabChanged() {
    setState(() {});
  }

  void _onCreateTask() {
    _taskDetailsKey.currentState?.openCreateTaskSheet();
  }

  void _openProjectOverview() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder:
            (_) => ProjectOverviewScreen(
              project: widget.project,
              groupId: widget.groupId,
            ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: const Color(0xFF2563EB),
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
        title: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Text(
              widget.project.tenDuAn,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 2),
            Text(
              'Quản lý dự án',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Colors.white.withOpacity(0.9),
                fontSize: 12,
              ),
            ),
          ],
        ),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: Colors.white,
          indicatorWeight: 3,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white.withOpacity(0.7),
          labelStyle: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
          unselectedLabelStyle: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w500,
          ),
          tabs: const [
            Tab(
              icon: Icon(Icons.assignment_outlined, size: 22),
              text: 'Tất cả công việc',
            ),
            Tab(
              icon: Icon(Icons.person_outline, size: 22),
              text: 'Công việc của tôi',
            ),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          TaskDetailsScreen(
            key: _taskDetailsKey,
            project: widget.project,
            groupId: widget.groupId,
            isEmbedded: true,
          ),
          MemberProjectTasksScreen(
            project: widget.project,
            memberId: widget.memberId,
            showAssignmentsTab: true,
            isEmbedded: true,
          ),
        ],
      ),
      floatingActionButton:
          _tabController.index == 0
              ? Column(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  FloatingActionButton(
                    heroTag: 'overview',
                    onPressed: _openProjectOverview,
                    backgroundColor: const Color(0xFF10B981),
                    child: const Icon(Icons.analytics_outlined, size: 28),
                  ),
                  const SizedBox(height: 16),
                  FloatingActionButton(
                    heroTag: 'add',
                    onPressed: _onCreateTask,
                    backgroundColor: const Color(0xFF2563EB),
                    child: const Icon(Icons.add, size: 28),
                  ),
                ],
              )
              : null,
    );
  }
}
