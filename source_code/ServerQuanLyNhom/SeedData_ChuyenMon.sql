-- Script để thêm dữ liệu mẫu cho bảng ChuyenMon
USE QuanLyCongViecNhom;
GO

-- Xóa dữ liệu cũ nếu có (optional)
-- DELETE FROM ChuyenMon;
-- GO

-- Insert các chuyên môn phổ biến
INSERT INTO ChuyenMon (TenChuyenMon, MoTa) VALUES
('Lập trình Frontend', N'Phát triển giao diện người dùng với HTML, CSS, JavaScript, React, Vue, Angular'),
('Lập trình Backend', N'Phát triển server-side với Node.js, .NET, Java, Python, PHP'),
('Fullstack Developer', N'Phát triển cả Frontend và Backend'),
('Mobile Development', N'Phát triển ứng dụng di động iOS/Android với React Native, Flutter, Swift, Kotlin'),
('DevOps', N'Quản lý hạ tầng, CI/CD, Docker, Kubernetes, Cloud services'),
('UI/UX Design', N'Thiết kế giao diện và trải nghiệm người dùng'),
('Database Administrator', N'Quản trị cơ sở dữ liệu SQL Server, MySQL, PostgreSQL, MongoDB'),
('Data Science', N'Phân tích dữ liệu, Machine Learning, AI'),
('QA/Testing', N'Kiểm thử phần mềm, Automation testing'),
('Project Management', N'Quản lý dự án, Scrum Master, Product Owner'),
('Business Analysis', N'Phân tích nghiệp vụ, Requirements gathering'),
('Security Engineer', N'Bảo mật ứng dụng và hệ thống'),
('System Administrator', N'Quản trị hệ thống máy chủ và mạng'),
('Content Marketing', N'Marketing nội dung, SEO, Social media'),
('Graphic Design', N'Thiết kế đồ họa, Branding, Visual design');
GO

-- Kiểm tra dữ liệu đã insert
SELECT * FROM ChuyenMon;
GO
