// Sử dụng Groq API - miễn phí, nhanh, quota cao
// Lấy API key miễn phí tại: https://console.groq.com/keys
const GROQ_API_KEY = "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"; // <-- THAY KEY TẠI ĐÂY

export interface MemberInfo {
  thanhVienId: number;
  hoTen: string;
  chuyenMon: string;
  email: string;
  soLuongCongViecHienTai?: number;
  tienDoTrungBinh?: number;
  danhGiaGanDay?: string;
}

export interface TaskInfo {
  tenCongViec: string;
  moTa: string;
  doUuTien: string;
  ngayBd?: string;
  ngayKt?: string;
  linhVucDuAn?: string;
}

export interface MemberSuggestion {
  thanhVienId: number;
  score: number;
  reason: string;
}

export async function getSuggestedMembers(
  members: MemberInfo[],
  taskInfo: TaskInfo
): Promise<{
  suggestions: MemberSuggestion[];
  error?: string;
}> {
  try {
    if (members.length === 0) {
      return { suggestions: [] };
    }

    const prompt = `
Bạn là AI chuyên gia phân công công việc trong quản lý dự án. Hãy phân tích và gợi ý thành viên phù hợp nhất.

**Thông tin công việc cần phân công:**
- Tên: ${taskInfo.tenCongViec || "Công việc mới"}
- Mô tả: ${taskInfo.moTa}
- Độ ưu tiên: ${taskInfo.doUuTien}
- Lĩnh vực dự án: ${taskInfo.linhVucDuAn || "Không xác định"}
- Thời gian: ${taskInfo.ngayBd || "N/A"} → ${taskInfo.ngayKt || "N/A"}

**Danh sách thành viên khả dụng:**
${members
  .map(
    (m, i) => `
${i + 1}. ID: ${m.thanhVienId}
   - Họ tên: ${m.hoTen}
   - Chuyên môn: ${m.chuyenMon}
   - Số công việc hiện tại: ${m.soLuongCongViecHienTai || 0}
   - Tiến độ trung bình: ${m.tienDoTrungBinh || 0}%
   - Đánh giá gần đây: ${m.danhGiaGanDay || "Chưa có"}
`
  )
  .join("\n")}

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
`;

    // Gọi Groq API
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile", // Model mạnh nhất của Groq, miễn phí
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 500,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error?.message || `HTTP error ${response.status}`
      );
    }

    const data = await response.json();
    let text = data.choices[0]?.message?.content?.trim() || "";

    // Loại bỏ markdown code block nếu có
    text = text.replace(/```json\s*/g, "").replace(/```\s*/g, "");

    // Parse JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid AI response format");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate và sắp xếp theo score
    const suggestions = (parsed.suggestions || [])
      .filter((s: any) => members.some((m) => m.thanhVienId === s.thanhVienId))
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 3);

    return { suggestions };
  } catch (error: any) {
    console.error("AI suggestion error:", error);
    return {
      suggestions: [],
      error:
        error.message || "Không thể lấy gợi ý từ AI. Vui lòng chọn thủ công.",
    };
  }
}
