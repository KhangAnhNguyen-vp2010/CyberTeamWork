using Google.Apis.Auth.OAuth2;
using Google.Apis.Drive.v3;
using Google.Apis.Services;
using Google.Apis.Upload;

namespace ServerQuanLyNhom.Helpers
{
    public class GoogleDriveService
    {
        private readonly DriveService _driveService;
        private readonly string _folderId = "1tZb0HFOaZ4zhQK94ogJMKhSSp3Che_Nt"; // ID thư mục của bạn

        public GoogleDriveService()
        {
            GoogleCredential credential;
            using (var stream = new FileStream(Path.Combine(Directory.GetCurrentDirectory(), "Config", "drive-service-account.json"), FileMode.Open, FileAccess.Read))
            {
                credential = GoogleCredential.FromStream(stream)
                    .CreateScoped(DriveService.ScopeConstants.Drive);
            }

            _driveService = new DriveService(new BaseClientService.Initializer()
            {
                HttpClientInitializer = credential,
                ApplicationName = "QuanLyNhom"
            });
        }

        public async Task<string> UploadFileAsync(IFormFile file)
        {
            if (file == null || file.Length == 0)
                throw new Exception("File không hợp lệ");

            var fileMetadata = new Google.Apis.Drive.v3.Data.File()
            {
                Name = $"{Guid.NewGuid()}_{file.FileName}",
                Parents = new List<string> { _folderId }
            };

            using (var stream = file.OpenReadStream())
            {
                var request = _driveService.Files.Create(fileMetadata, stream, file.ContentType);
                request.Fields = "id, webViewLink";
                await request.UploadAsync();

                var uploadedFile = request.ResponseBody;
                return uploadedFile?.WebViewLink ?? "";
            }
        }
    }
}
