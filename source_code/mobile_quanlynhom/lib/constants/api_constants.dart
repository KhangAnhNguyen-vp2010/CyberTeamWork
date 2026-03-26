class ApiConstants {
  // Development environment - Uncomment the appropriate one for your setup

  // For Android emulator
  // static const String baseUrl = 'http://10.0.2.2:7036';

  // For physical device (replace with your computer's local IP)
  // static const String baseUrl = 'http://192.168.2.15:7036';

  static const String baseUrl = 'https://75604e1d99f8.ngrok-free.app';

  // For iOS simulator (if using Mac)
  // static const String baseUrl = 'http://localhost:7036';

  // Production environment
  // static const String baseUrl = 'https://your-production-api.com';

  // Auth endpoints
  static const String login = '/api/Auth/login';
  static const String register = '/api/Auth/register';
  static const String resendOtp = '/api/Auth/resend-otp';
  static const String verifyOtp = '/api/Auth/verify-otp';
  static const String forgotPassword = '/api/auth/forgot-password';
  static const String resetPassword = '/api/Auth/reset-password';
  static const String memberGroups = '/api/Nhom/GetGroupsOfMember';
  static const String groupProjects = '/api/DuAn/GetProjectsOfGroup';
  static const String projectDomains = '/api/DuAn/linh-vuc';
  static const String projectTasks = '/api/CongViec/GetCongViecsOfDuAn';
  static const String taskCreate = '/api/CongViec/CreateCongViec';
  static const String taskUpdate = '/api/CongViec/UpdateCongViec';
  static const String taskDelete = '/api/CongViec/DeleteCongViec';
  static const String taskUpdateStatus = '/api/CongViec/UpdateTrangThai';
  static const String taskUpdateProgress =
      '/api/CongViec/CapNhatTienDoCongViec';
  static const String taskStatuses = '/api/CongViec';
  static const String taskAssignments = '/api/PhanCong/GetPhanCongOfCongViec';
  static const String taskAssignmentAddItem = '/api/PhanCong/AddPhanCongItem';
  static const String taskAssignmentUpdateItem =
      '/api/PhanCong/UpdatePhanCongItem';
  static const String taskAssignmentDeleteItem =
      '/api/PhanCong/DeletePhanCongItem';
  static const String taskEvaluation = '/api/PhanCong/DanhGiaTienDo';
  static const String subTaskProgressUpdate =
      '/api/PhanCong/CapNhatTienDoHoanThanh';
  static const String groupMembers = '/api/Nhom';
  static const String taskAttachments = '/api/CongViec/GetFileDinhKem';
  static const String taskAttachmentUpload = '/api/CongViec/UploadFileDinhKem';
  static const String taskAttachmentDelete = '/api/CongViec/DeleteFileDinhKem';
  static const String memberProjectTasks =
      '/api/PhanCong/GetAllSubTasksInProject';
  static const String memberProgressReport = '/api/PhanCong/BaoCaoTienDoUpload';
  static const String memberProgressReportDelete =
      '/api/PhanCong/XoaFileBaoCao';
  static const String addSubmissionDate = '/api/PhanCong/ThemNgayNop';
  static const String profileUpdate = '/api/Auth/update-profile';
  static const String profileSpecialties = '/api/Auth/chuyen-mon';
  static const String changePassword = '/api/Auth/ChangePassword';
  static const String changeEmailRequest = '/api/Auth/change-email/request';
  static const String changeEmailVerify = '/api/Auth/change-email/verify';
  static const String changeEmailResend = '/api/Auth/change-email/resend';
  static const String taskComments = '/api/BinhLuan/GetBinhLuansOfCongViec';
  static const String taskCommentCreate = '/api/BinhLuan/CreateBinhLuan';
  static const String taskCommentUpdate = '/api/BinhLuan/UpdateBinhLuan';
  static const String taskCommentDelete = '/api/BinhLuan/DeleteBinhLuan';
  static const String taskReminder = '/api/ThongBao/NhacHanCongViec';
  static const String taskAssignmentNotify =
      '/api/ThongBao/ThongBaoCongViecMoi_ChoThanhVien';
  static const String taskCommentNotify = '/api/ThongBao/ThongBaoBinhLuanMoi';
  static const String memberNotifications =
      '/api/ThongBao/GetThongBaoOfThanhVien';
  static const String memberNotificationMarkAsRead = '/api/ThongBao/MarkAsRead';
  static const String notificationsMarkAllRead = '/api/ThongBao/MarkAllAsRead';
  static const String notificationsTogglePin = '/api/ThongBao/ToggleGhim';
  static const String notificationsDelete = '/api/ThongBao/DeleteThongBao';

  // Timeout settings
  static const Duration connectTimeout = Duration(seconds: 30);
  static const Duration receiveTimeout = Duration(seconds: 30);

  // Add other API endpoints here
}
