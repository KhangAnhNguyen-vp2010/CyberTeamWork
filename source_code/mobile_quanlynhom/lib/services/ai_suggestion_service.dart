import 'dart:convert';
import 'package:google_generative_ai/google_generative_ai.dart';

class MemberSuggestion {
  final int thanhVienId;
  final double score;
  final String reason;

  MemberSuggestion({
    required this.thanhVienId,
    required this.score,
    required this.reason,
  });

  factory MemberSuggestion.fromJson(Map<String, dynamic> json) {
    return MemberSuggestion(
      thanhVienId: json['thanhVienId'] as int,
      score: (json['score'] as num).toDouble(),
      reason: json['reason'] as String,
    );
  }
}

class AISuggestionService {
  static const String _apiKey = 'AIzaSyDuiFCNYiPCyayCqEWZ9B6EeZP9kcw5SoI';

  Future<List<MemberSuggestion>> getSuggestedMembers({
    required List<Map<String, dynamic>> members,
    required String taskName,
    required String taskDescription,
    required String priority,
    String? projectDomain,
    String? startDate,
    String? endDate,
  }) async {
    try {
      if (members.isEmpty) {
        return [];
      }

      final model = GenerativeModel(model: 'gemini-2.5-pro', apiKey: _apiKey);

      final prompt = _buildPrompt(
        members: members,
        taskName: taskName,
        taskDescription: taskDescription,
        priority: priority,
        projectDomain: projectDomain,
        startDate: startDate,
        endDate: endDate,
      );

      final content = [Content.text(prompt)];
      final response = await model.generateContent(content);

      String text = response.text?.trim() ?? '';

      // Loại bỏ markdown code block nếu có
      text = text
          .replaceAll(RegExp(r'```json\s*'), '')
          .replaceAll(RegExp(r'```\s*'), '');

      // Tìm JSON object
      final jsonMatch = RegExp(r'\{[\s\S]*\}').firstMatch(text);
      if (jsonMatch == null) {
        throw Exception('Invalid AI response format');
      }

      final parsed = jsonDecode(jsonMatch.group(0)!) as Map<String, dynamic>;
      final suggestions =
          (parsed['suggestions'] as List<dynamic>?)
              ?.map((s) => MemberSuggestion.fromJson(s as Map<String, dynamic>))
              .where(
                (s) => members.any((m) => m['thanhVienId'] == s.thanhVienId),
              )
              .toList();

      if (suggestions != null && suggestions.isNotEmpty) {
        suggestions.sort((a, b) => b.score.compareTo(a.score));
        return suggestions.take(3).toList();
      }

      return [];
    } catch (e) {
      throw Exception('Không thể lấy gợi ý từ AI: ${e.toString()}');
    }
  }

  String _buildPrompt({
    required List<Map<String, dynamic>> members,
    required String taskName,
    required String taskDescription,
    required String priority,
    String? projectDomain,
    String? startDate,
    String? endDate,
  }) {
    final membersInfo = members
        .asMap()
        .entries
        .map((entry) {
          final i = entry.key;
          final m = entry.value;
          return '''
${i + 1}. ID: ${m['thanhVienId']}
   - Họ tên: ${m['hoTen']}
   - Chuyên môn: ${m['chuyenMon']}
   - Số công việc hiện tại: ${m['soLuongCongViecHienTai'] ?? 0}
   - Tiến độ trung bình: ${m['tienDoTrungBinh'] ?? 0}%
   - Đánh giá gần đây: ${m['danhGiaGanDay'] ?? 'Chưa có'}''';
        })
        .join('\n');

    return '''
Bạn là AI chuyên gia phân công công việc trong quản lý dự án. Hãy phân tích và gợi ý thành viên phù hợp nhất.

**Thông tin công việc cần phân công:**
- Tên: ${taskName.isEmpty ? "Công việc mới" : taskName}
- Mô tả: $taskDescription
- Độ ưu tiên: $priority
- Lĩnh vực dự án: ${projectDomain ?? "Không xác định"}
- Thời gian: ${startDate ?? "N/A"} → ${endDate ?? "N/A"}

**Danh sách thành viên khả dụng:**
$membersInfo

**Yêu cầu:**
1. Chọn TOP 3 thành viên PHÙ HỢP NHẤT dựa trên:
   - Chuyên môn khớp với công việc (quan trọng nhất)
   - Khối lượng công việc hiện tại (ưu tiên người ít việc hơn)
   - Tiến độ hoàn thành trung bình (ưu tiên người có tiến độ cao)
   - Đánh giá gần đây

2. Trả về ĐÚNG định dạng JSON sau (KHÔNG thêm markdown, KHÔNG thêm \`\`\`json):
{
  "suggestions": [
    {
      "thanhVienId": 123,
      "score": 95,
      "reason": "Chuyên môn phù hợp, ít công việc, tiến độ tốt"
    }
  ]
}

QUAN TRỌNG: 
- Chỉ trả về JSON thuần, không có markdown
- Score từ 0-100
- Reason ngắn gọn, 1 câu
- Sắp xếp theo score giảm dần
''';
  }
}
