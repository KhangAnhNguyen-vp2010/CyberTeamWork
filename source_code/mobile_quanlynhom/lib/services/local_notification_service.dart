import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class LocalNotificationService {
  LocalNotificationService._internal();

  static final LocalNotificationService _instance = LocalNotificationService._internal();

  factory LocalNotificationService() => _instance;

  final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();
  bool _initialized = false;

  Future<void> init() async {
    if (_initialized) {
      return;
    }

    const initializationSettings = InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      iOS: DarwinInitializationSettings(),
      macOS: DarwinInitializationSettings(),
    );

    await _plugin.initialize(initializationSettings);
    _initialized = true;

    await _requestPermissions();
  }

  Future<void> _requestPermissions() async {
    final iosImplementation =
        _plugin.resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>();
    await iosImplementation?.requestPermissions(alert: true, badge: true, sound: true);

    final macImplementation =
        _plugin.resolvePlatformSpecificImplementation<MacOSFlutterLocalNotificationsPlugin>();
    await macImplementation?.requestPermissions(alert: true, badge: true, sound: true);

    final androidImplementation =
        _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    await androidImplementation?.requestNotificationsPermission();
  }

  Future<void> showNotification({
    required int id,
    required String title,
    required String body,
  }) async {
    if (!_initialized) {
      await init();
    }

    const androidDetails = AndroidNotificationDetails(
      'group_notifications',
      'Thông báo nhóm',
      channelDescription: 'Thông báo từ hệ thống quản lý nhóm',
      importance: Importance.high,
      priority: Priority.high,
      playSound: true,
      enableLights: true,
    );

    const darwinDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentSound: true,
      presentBadge: true,
    );

    final notificationDetails = const NotificationDetails(
      android: androidDetails,
      iOS: darwinDetails,
      macOS: darwinDetails,
    );

    await _plugin.show(id, title, body, notificationDetails);
  }
}
