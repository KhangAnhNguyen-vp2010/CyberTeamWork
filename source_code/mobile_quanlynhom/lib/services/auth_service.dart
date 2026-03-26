import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:http/io_client.dart';
import 'package:mobile_quanlynhom/constants/api_constants.dart';
import 'package:mobile_quanlynhom/models/login_request.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AuthService {
  static const String tag = 'AuthService';
  final String baseUrl = ApiConstants.baseUrl;
  final bool isHttps = ApiConstants.baseUrl.startsWith('https');

  http.Client get _httpClient {
    final client =
        isHttps
            ? IOClient(
              HttpClient()..badCertificateCallback = (cert, host, port) => true,
            )
            : http.Client();

    return _LoggingClient(
      inner: client,
      onRequest: (request) {
        print('$tag - Request: ${request.method} ${request.url}');
        print('$tag - Headers: ${request.headers}');
        if (request is http.Request && request.body.isNotEmpty) {
          print('$tag - Body: ${request.body}');
        }
      },
      onResponse: (response) {
        print(
          '$tag - Response: ${response.statusCode} ${response.reasonPhrase}',
        );
        print('$tag - Response body: ${response.body}');
      },
      onError: (error) {
        print('$tag - Error: $error');
      },
    );
  }

  Future<Map<String, String>> _authJsonHeaders({
    bool includeContentType = true,
  }) async {
    final headers = <String, String>{'Accept': 'application/json'};

    if (includeContentType) {
      headers['Content-Type'] = 'application/json';
    }

    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('accessToken');
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }

    return headers;
  }

  Future<String> changePassword({
    required int accountId,
    required String oldPassword,
    required String newPassword,
  }) async {
    final client = _httpClient;
    try {
      final headers = await _authJsonHeaders();

      final uri = Uri.parse(
        '$baseUrl${ApiConstants.changePassword}/$accountId',
      );
      final response = await client.post(
        uri,
        headers: headers,
        body: jsonEncode({
          'oldPassword': oldPassword,
          'newPassword': newPassword,
        }),
      );

      final message = _extractMessage(response.bodyBytes);

      if (response.statusCode >= 200 && response.statusCode < 300) {
        return message ?? 'Đổi mật khẩu thành công.';
      }

      throw http.ClientException(
        message ?? 'Đổi mật khẩu thất bại (${response.statusCode}).',
        uri,
      );
    } finally {
      client.close();
    }
  }

  Future<String> requestChangeEmail({
    required int accountId,
    required String newEmail,
  }) async {
    final client = _httpClient;
    try {
      final headers = await _authJsonHeaders();
      final uri = Uri.parse('$baseUrl${ApiConstants.changeEmailRequest}');
      final response = await client.post(
        uri,
        headers: headers,
        body: jsonEncode({'taiKhoanId': accountId, 'newEmail': newEmail}),
      );

      final message = _extractMessage(response.bodyBytes);
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return message ?? 'Đã gửi OTP tới email mới.';
      }

      throw http.ClientException(
        message ?? 'Không thể gửi OTP (${response.statusCode}).',
        uri,
      );
    } finally {
      client.close();
    }
  }

  Future<String> verifyChangeEmail({
    required int accountId,
    required String newEmail,
    required String otp,
  }) async {
    final client = _httpClient;
    try {
      final headers = await _authJsonHeaders();
      final uri = Uri.parse('$baseUrl${ApiConstants.changeEmailVerify}');
      final response = await client.post(
        uri,
        headers: headers,
        body: jsonEncode({
          'taiKhoanId': accountId,
          'newEmail': newEmail,
          'otp': otp,
        }),
      );

      final message = _extractMessage(response.bodyBytes);
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return message ?? 'Đổi email thành công.';
      }

      throw http.ClientException(
        message ?? 'Không thể xác thực OTP (${response.statusCode}).',
        uri,
      );
    } finally {
      client.close();
    }
  }

  Future<String> resendChangeEmailOtp({required int accountId}) async {
    final client = _httpClient;
    try {
      final headers = await _authJsonHeaders();
      final uri = Uri.parse('$baseUrl${ApiConstants.changeEmailResend}');
      final response = await client.post(
        uri,
        headers: headers,
        body: jsonEncode({'taiKhoanId': accountId}),
      );

      final message = _extractMessage(response.bodyBytes);
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return message ?? 'Đã gửi lại OTP.';
      }

      throw http.ClientException(
        message ?? 'Không thể gửi lại OTP (${response.statusCode}).',
        uri,
      );
    } finally {
      client.close();
    }
  }

  Future<Map<String, dynamic>> login(LoginRequest loginRequest) async {
    print('$tag - Attempting login to: $baseUrl${ApiConstants.login}');

    final client = _httpClient;
    try {
      final response = await client
          .post(
            Uri.parse('$baseUrl${ApiConstants.login}'),
            headers: {
              'Content-Type': 'application/json; charset=UTF-8',
              'Accept': 'application/json',
            },
            body: jsonEncode(loginRequest.toJson()),
          )
          .timeout(
            ApiConstants.receiveTimeout,
            onTimeout:
                () => http.Response(
                  jsonEncode({
                    'success': false,
                    'message':
                        'Request timed out. Please check your connection.',
                  }),
                  408,
                ),
          );

      if (response.body.isEmpty) {
        return {
          'success': false,
          'message': 'Empty response from server',
          'statusCode': response.statusCode,
        };
      }

      final rawBody = utf8.decode(response.bodyBytes);
      final responseBody =
          rawBody.isNotEmpty
              ? (rawBody.trim().startsWith('{')
                  ? jsonDecode(rawBody)
                  : {'message': rawBody})
              : {};

      if (response.statusCode == 200) {
        return {
          'success': true,
          'message':
              responseBody['message']?.toString() ?? 'Đăng nhập thành công!',
          'data': responseBody,
        };
      } else {
        return {
          'success': false,
          'message':
              responseBody['message']?.toString() ??
              'Đăng nhập thất bại (${response.statusCode}). Vui lòng thử lại sau.',
          'statusCode': response.statusCode,
        };
      }
    } on SocketException catch (e) {
      return {
        'success': false,
        'message':
            'Không thể kết nối đến máy chủ ($baseUrl). '
            'Vui lòng kiểm tra:\n'
            '1. Máy chủ có đang chạy không?\n'
            '2. Địa chỉ IP và cổng có đúng không?\n'
            '3. Có tường lửa nào chặn kết nối không?\n'
            'Lỗi: ${e.message}',
        'error': e.toString(),
      };
    } on TimeoutException catch (e) {
      return {
        'success': false,
        'message':
            'Kết nối quá thời gian chờ. Vui lòng kiểm tra mạng và thử lại.',
        'error': e.toString(),
      };
    } on FormatException catch (e) {
      return {
        'success': false,
        'message': 'Lỗi định dạng dữ liệu từ máy chủ: ${e.message}',
        'error': e.toString(),
      };
    } catch (e) {
      print('$tag - Error during login: $e');
      return {
        'success': false,
        'message': 'Có lỗi xảy ra: ${e.toString().split('\n').first}',
        'error': e.toString(),
      };
    } finally {
      client.close();
    }
  }

  Future<Map<String, dynamic>> register({
    required String userName,
    required String fullName,
    required String email,
    required String password,
  }) async {
    print('$tag - Attempting to register user: $userName');

    final client = _httpClient;
    try {
      final response = await client
          .post(
            Uri.parse('$baseUrl${ApiConstants.register}'),
            headers: {
              'Content-Type': 'application/json; charset=UTF-8',
              'Accept': 'application/json',
            },
            body: jsonEncode({
              'userName': userName,
              'fullName': fullName,
              'email': email,
              'password': password,
            }),
          )
          .timeout(
            ApiConstants.receiveTimeout,
            onTimeout: () {
              print('$tag - Register request timed out');
              return http.Response(
                jsonEncode({
                  'success': false,
                  'message': 'Request timed out. Please try again.',
                }),
                408,
              );
            },
          );

      final rawBody = utf8.decode(response.bodyBytes);
      final responseBody =
          rawBody.isNotEmpty
              ? (rawBody.trim().startsWith('{')
                  ? jsonDecode(rawBody)
                  : {'message': rawBody})
              : {};

      if (response.statusCode == 200 || response.statusCode == 201) {
        return {
          'success': true,
          'message':
              responseBody['message']?.toString() ??
              'Đăng ký thành công! Vui lòng nhập mã OTP.',
          'data': responseBody,
        };
      } else {
        return {
          'success': false,
          'message':
              responseBody['message']?.toString() ??
              'Đăng ký thất bại (${response.statusCode})',
          'statusCode': response.statusCode,
          'error': responseBody.toString(),
        };
      }
    } catch (e) {
      print('$tag - Error during registration: $e');
      return {
        'success': false,
        'message': 'Có lỗi xảy ra khi đăng ký. Vui lòng thử lại sau.',
        'error': e.toString(),
      };
    } finally {
      client.close();
    }
  }

  Future<Map<String, dynamic>> resendOtp({
    required String email,
    required String purpose,
  }) async {
    print('$tag - Resending OTP for $email with purpose $purpose');

    final client = _httpClient;
    try {
      final response = await client.post(
        Uri.parse('$baseUrl${ApiConstants.resendOtp}'),
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'Accept': 'application/json',
        },
        body: jsonEncode({'email': email, 'purpose': purpose}),
      );

      final rawBody = utf8.decode(response.bodyBytes);
      final responseBody =
          rawBody.isNotEmpty
              ? (rawBody.trim().startsWith('{')
                  ? jsonDecode(rawBody)
                  : {'message': rawBody})
              : {};

      if (response.statusCode == 200) {
        return {
          'success': true,
          'message':
              responseBody['message']?.toString() ??
              'Đã gửi lại mã OTP. Vui lòng kiểm tra email.',
          'data': responseBody,
        };
      } else {
        return {
          'success': false,
          'message':
              responseBody['message']?.toString() ??
              'Gửi lại OTP thất bại (${response.statusCode})',
          'statusCode': response.statusCode,
          'error': responseBody.toString(),
        };
      }
    } catch (e) {
      print('$tag - Error during resend OTP: $e');
      return {
        'success': false,
        'message': 'Có lỗi xảy ra khi gửi lại OTP. Vui lòng thử lại sau.',
        'error': e.toString(),
      };
    } finally {
      client.close();
    }
  }

  Future<Map<String, dynamic>> verifyOtp({
    required String email,
    required String otp,
    required String purpose,
  }) async {
    print('$tag - Verifying OTP for $email with purpose $purpose');

    final client = _httpClient;
    try {
      final response = await client.post(
        Uri.parse('$baseUrl${ApiConstants.verifyOtp}'),
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'Accept': 'application/json',
        },
        body: jsonEncode({'email': email, 'otp': otp, 'purpose': purpose}),
      );

      final rawBody = utf8.decode(response.bodyBytes);
      final responseBody =
          rawBody.isNotEmpty
              ? (rawBody.trim().startsWith('{')
                  ? jsonDecode(rawBody)
                  : {'message': rawBody})
              : {};

      if (response.statusCode == 200) {
        return {
          'success': true,
          'message':
              responseBody['message']?.toString() ?? 'Xác thực OTP thành công!',
          'data': responseBody,
        };
      } else {
        return {
          'success': false,
          'message':
              responseBody['message']?.toString() ??
              'Xác thực OTP thất bại (${response.statusCode})',
          'statusCode': response.statusCode,
          'error': responseBody.toString(),
        };
      }
    } catch (e) {
      print('$tag - Error during verify OTP: $e');
      return {
        'success': false,
        'message': 'Có lỗi xảy ra khi xác thực OTP. Vui lòng thử lại sau.',
        'error': e.toString(),
      };
    } finally {
      client.close();
    }
  }

  Future<Map<String, dynamic>> resetPassword({
    required String email,
    required String newPassword,
  }) async {
    print('$tag - Resetting password for: $email');

    final client = _httpClient;
    try {
      final response = await client.post(
        Uri.parse('$baseUrl${ApiConstants.resetPassword}'),
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'Accept': 'application/json',
        },
        body: jsonEncode({'email': email, 'newPassword': newPassword}),
      );

      final rawBody = utf8.decode(response.bodyBytes);
      final responseBody =
          rawBody.isNotEmpty
              ? (rawBody.trim().startsWith('{')
                  ? jsonDecode(rawBody)
                  : {'message': rawBody})
              : {};

      if (response.statusCode == 200) {
        return {
          'success': true,
          'message':
              responseBody['message']?.toString() ??
              'Đặt lại mật khẩu thành công.',
          'data': responseBody,
        };
      } else {
        return {
          'success': false,
          'message':
              responseBody['message']?.toString() ??
              'Đặt lại mật khẩu thất bại (${response.statusCode})',
          'statusCode': response.statusCode,
          'error': responseBody.toString(),
        };
      }
    } catch (e) {
      print('$tag - Error during reset password: $e');
      return {
        'success': false,
        'message': 'Có lỗi xảy ra khi đặt lại mật khẩu. Vui lòng thử lại sau.',
        'error': e.toString(),
      };
    } finally {
      client.close();
    }
  }

  Future<Map<String, dynamic>> forgotPassword({required String email}) async {
    print('$tag - Attempting to reset password for: $email');

    final client = _httpClient;
    try {
      final response = await client
          .post(
            Uri.parse('$baseUrl${ApiConstants.forgotPassword}'),
            headers: {
              'Content-Type': 'application/json; charset=UTF-8',
              'Accept': 'application/json',
            },
            body: jsonEncode({'email': email}),
          )
          .timeout(
            const Duration(seconds: 30),
            onTimeout: () {
              print('$tag - Forgot password request timed out');
              return http.Response(
                jsonEncode({
                  'success': false,
                  'message': 'Request timed out. Please try again.',
                }),
                408,
              );
            },
          );

      final rawBody = utf8.decode(response.bodyBytes);
      final responseBody =
          rawBody.isNotEmpty
              ? (rawBody.trim().startsWith('{')
                  ? jsonDecode(rawBody)
                  : {'message': rawBody})
              : {};

      if (response.statusCode == 200) {
        return {
          'success': true,
          'message':
              responseBody['message']?.toString() ??
              'Đã gửi email đặt lại mật khẩu.',
          'data': responseBody,
        };
      } else {
        return {
          'success': false,
          'message':
              responseBody['message']?.toString() ??
              'Gửi email thất bại (${response.statusCode})',
          'statusCode': response.statusCode,
          'error': responseBody.toString(),
        };
      }
    } catch (e) {
      print('$tag - Error during password reset: $e');
      return {
        'success': false,
        'message': 'Có lỗi xảy ra. Vui lòng thử lại sau.',
        'error': e.toString(),
      };
    } finally {
      client.close();
    }
  }

  Future<Map<String, dynamic>> requestPasswordReset({
    required String username,
    required String fullName,
    required String email,
    required String phone,
    required String reason,
  }) async {
    print('$tag - Sending password reset request for username: $username');

    final client = _httpClient;
    try {
      final response = await client
          .post(
            Uri.parse('$baseUrl/api/Admin/reset-password-requests'),
            headers: {
              'Content-Type': 'application/json; charset=UTF-8',
              'Accept': 'application/json',
            },
            body: jsonEncode({
              'tenTaiKhoan': username,
              'hoTen': fullName,
              'email': email,
              'soDienThoai': phone,
              'lyDo': reason,
            }),
          )
          .timeout(
            const Duration(seconds: 30),
            onTimeout: () {
              print('$tag - Password reset request timed out');
              return http.Response(
                jsonEncode({
                  'success': false,
                  'message': 'Request timed out. Please try again.',
                }),
                408,
              );
            },
          );

      final rawBody = utf8.decode(response.bodyBytes);
      final responseBody =
          rawBody.isNotEmpty
              ? (rawBody.trim().startsWith('{')
                  ? jsonDecode(rawBody)
                  : {'message': rawBody})
              : {};

      if (response.statusCode == 200) {
        return {
          'success': true,
          'message':
              responseBody['message']?.toString() ??
              'Yêu cầu đã được gửi đến quản trị viên.',
          'data': responseBody,
        };
      } else {
        return {
          'success': false,
          'message':
              responseBody['message']?.toString() ??
              'Gửi yêu cầu thất bại (${response.statusCode})',
          'statusCode': response.statusCode,
          'error': responseBody.toString(),
        };
      }
    } catch (e) {
      print('$tag - Error during password reset request: $e');
      return {
        'success': false,
        'message': 'Có lỗi xảy ra. Vui lòng thử lại sau.',
        'error': e.toString(),
      };
    } finally {
      client.close();
    }
  }

  String? _extractMessage(List<int> bodyBytes) {
    if (bodyBytes.isEmpty) return null;
    final raw = utf8.decode(bodyBytes).trim();
    if (raw.isEmpty) return null;

    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map && decoded['message'] != null) {
        return decoded['message'].toString();
      }
      if (decoded is String) {
        return decoded;
      }
    } catch (_) {
      // ignore, fallback to raw string
    }

    return raw;
  }
}

class _LoggingClient extends http.BaseClient {
  final http.Client inner;
  final Function(http.BaseRequest) onRequest;
  final Function(http.Response) onResponse;
  final Function(dynamic) onError;

  _LoggingClient({
    required this.inner,
    required this.onRequest,
    required this.onResponse,
    required this.onError,
  });

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    onRequest(request);
    try {
      final response = await inner.send(request);
      final bytes = await response.stream.toBytes();
      onResponse(
        http.Response.bytes(
          bytes,
          response.statusCode,
          request: request,
          headers: response.headers,
          isRedirect: response.isRedirect,
          persistentConnection: response.persistentConnection,
          reasonPhrase: response.reasonPhrase,
        ),
      );
      return http.StreamedResponse(
        Stream.value(bytes),
        response.statusCode,
        contentLength: response.contentLength,
        request: request,
        headers: response.headers,
        isRedirect: response.isRedirect,
        persistentConnection: response.persistentConnection,
        reasonPhrase: response.reasonPhrase,
      );
    } catch (e) {
      onError(e);
      rethrow;
    }
  }
}
