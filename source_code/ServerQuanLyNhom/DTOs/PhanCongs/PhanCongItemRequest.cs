using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ServerQuanLyNhom.DTOs.PhanCongs
{
    public class PhanCongItemRequest
    {
        public string SubTaskId { get; set; } = Guid.NewGuid().ToString();
        public string MoTa { get; set; }
        public DateOnly NgayPC { get; set; }
        public string DoUuTien { get; set; }
        [JsonConverter(typeof(KetQuaThucHienJsonConverter))]
        public KetQuaThucHienRequest KetQuaThucHien { get; set; } = new();
        public string DanhGia { get; set; }
        public string TienDoHoanThanh { get; set; }
        [JsonConverter(typeof(BooleanJsonConverter))]
        public bool TrangThaiKhoa { get; set; } = false;
        public List<DateTime> NgayNop { get; set; } = new();
    }

    public class KetQuaThucHienRequest
    {
        public string NoiDung { get; set; } = string.Empty;

        public List<string> File { get; set; } = new();
    }

    public class KetQuaThucHienUpdateRequest
    {
        public string? NoiDung { get; set; }

        public List<string>? File { get; set; }
    }

    public class KetQuaThucHienJsonConverter : JsonConverter<KetQuaThucHienRequest>
    {
        public override KetQuaThucHienRequest? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            if (reader.TokenType == JsonTokenType.Null)
            {
                return new KetQuaThucHienRequest();
            }

            if (reader.TokenType == JsonTokenType.StartObject)
            {
                using var document = JsonDocument.ParseValue(ref reader);
                var obj = document.RootElement;

                var result = new KetQuaThucHienRequest();

                if (obj.TryGetProperty("NoiDung", out var noiDungProp))
                {
                    result.NoiDung = noiDungProp.GetString() ?? string.Empty;
                }

                if (obj.TryGetProperty("File", out var fileProp) && fileProp.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in fileProp.EnumerateArray())
                    {
                        var fileUrl = item.GetString();
                        if (!string.IsNullOrWhiteSpace(fileUrl))
                        {
                            result.File.Add(fileUrl);
                        }
                    }
                }

                return result;
            }

            if (reader.TokenType == JsonTokenType.StartArray)
            {
                var result = new KetQuaThucHienRequest();

                while (reader.Read() && reader.TokenType != JsonTokenType.EndArray)
                {
                    if (reader.TokenType == JsonTokenType.String)
                    {
                        var fileUrl = reader.GetString();
                        if (!string.IsNullOrWhiteSpace(fileUrl))
                        {
                            result.File.Add(fileUrl);
                        }
                    }
                    else
                    {
                        reader.Skip();
                    }
                }

                return result;
            }

            if (reader.TokenType == JsonTokenType.String)
            {
                var content = reader.GetString() ?? string.Empty;
                return new KetQuaThucHienRequest
                {
                    NoiDung = content
                };
            }

            // Bất kỳ dạng nào khác -> bỏ qua, tạo object mặc định
            reader.Skip();
            return new KetQuaThucHienRequest();
        }

        public override void Write(Utf8JsonWriter writer, KetQuaThucHienRequest value, JsonSerializerOptions options)
        {
            writer.WriteStartObject();
            writer.WriteString("NoiDung", value?.NoiDung ?? string.Empty);

            writer.WritePropertyName("File");
            writer.WriteStartArray();
            if (value?.File != null)
            {
                foreach (var file in value.File)
                {
                    if (!string.IsNullOrWhiteSpace(file))
                    {
                        writer.WriteStringValue(file);
                    }
                }
            }
            writer.WriteEndArray();

            writer.WriteEndObject();
        }
    }

    public class BooleanJsonConverter : JsonConverter<bool>
    {
        public override bool Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            switch (reader.TokenType)
            {
                case JsonTokenType.True:
                    return true;
                case JsonTokenType.False:
                    return false;
                case JsonTokenType.Number:
                    return reader.GetInt32() != 0;
                case JsonTokenType.String:
                    var stringValue = reader.GetString();
                    if (int.TryParse(stringValue, out var intValue))
                    {
                        return intValue != 0;
                    }
                    if (bool.TryParse(stringValue, out var boolValue))
                    {
                        return boolValue;
                    }
                    return false;
                default:
                    return false;
            }
        }

        public override void Write(Utf8JsonWriter writer, bool value, JsonSerializerOptions options)
        {
            writer.WriteNumberValue(value ? 1 : 0);
        }
    }
}
