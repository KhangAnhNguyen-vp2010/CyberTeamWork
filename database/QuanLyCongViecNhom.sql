-- Tạo database
CREATE DATABASE QuanLyCongViecNhom;
GO

-- Sử dụng database
USE QuanLyCongViecNhom;
GO




-- Bảng ChuyenMon
CREATE TABLE ChuyenMon (
    ChuyenMonID INT IDENTITY(1,1) PRIMARY KEY,
    TenChuyenMon NVARCHAR(100) NOT NULL,
);

-- Bảng LinhVuc
CREATE TABLE LinhVuc (
    LinhVucID INT IDENTITY(1,1) PRIMARY KEY,
    TenLinhVuc NVARCHAR(100) NOT NULL,
);

-- Bảng Nhom
CREATE TABLE Nhom (
	NhomID INT IDENTITY(1,1) PRIMARY KEY,
	TenNhom NVARCHAR(100),
	MoTa NVARCHAR(100),
	SoLuongTV int,
	NgayLapNhom Date DEFAULT GETDATE(),
	NgayCapNhat DATETIME DEFAULT GETDATE(),
	AnhBia NVARCHAR(MAX),
)


CREATE TABLE ThanhVien (
    ThanhVienID INT IDENTITY(1,1) PRIMARY KEY,
    HoTen NVARCHAR(100),
    GioiTinh NVARCHAR(10) CHECK (GioiTinh IN (N'Nam', N'Nữ', N'Khác')),
    NgaySinh DATE,
    MoTaBanThan NVARCHAR(500),
    SDT NVARCHAR(15),
    DiaChi NVARCHAR(100),
	ChuyenMonID INT NULL,
	FOREIGN KEY (ChuyenMonID) REFERENCES ChuyenMon(ChuyenMonID),
);
alter table ThanhVien
add AnhBia NVARCHAR(MAX)

CREATE TABLE ChiTietThanhVienNhom (
	NhomID INT NOT NULL,
	ThanhVienID INT NOT NULL,
	ChucVu NVARCHAR(50),
	NgayThamGia Date,
	FOREIGN KEY (NhomID) REFERENCES Nhom(NhomID) ON DELETE CASCADE,
	FOREIGN KEY (ThanhVienID) REFERENCES ThanhVien(ThanhVienID) ON DELETE CASCADE,
)
ALTER TABLE ChiTietThanhVienNhom
ADD CONSTRAINT PK_ChiTietNhom PRIMARY KEY (NhomID, ThanhVienID);


CREATE TABLE TaiKhoan (
    TaiKhoanID INT IDENTITY(1,1) PRIMARY KEY,
	TenTaiKhoan NVARCHAR(200) UNIQUE,
    Email NVARCHAR(100) UNIQUE,
    MatKhau NVARCHAR(255),
    NgayTao DATETIME DEFAULT GETDATE(),
    TrangThai BIT DEFAULT 1,
    LoaiTaiKhoan NVARCHAR(100) DEFAULT N'Local',
    LanDangNhapGanNhat DATETIME,
    ThanhVienID INT UNIQUE,  -- đảm bảo 1-1
    FOREIGN KEY (ThanhVienID) REFERENCES ThanhVien(ThanhVienID) ON DELETE CASCADE
);

-- Bảng DuAn
CREATE TABLE DuAn (
    DuAnID INT IDENTITY(1,1) PRIMARY KEY,
	TenDuAn NVARCHAR(200) NOT NULL,
    MoTa NVARCHAR(500),
    NgayBD DATE,
    NgayKT DATE,
    TrangThai NVARCHAR(50) DEFAULT N'Đang thực hiện', -- ví dụ: Đang thực hiện, Hoàn thành, Tạm dừng
	AnhBia NVARCHAR(MAX),
	NhomID INT NULL,
	LinhVucID INT NULL,
	FOREIGN KEY (NhomID) REFERENCES Nhom(NhomID) ON DELETE CASCADE,
	FOREIGN KEY (LinhVucID) REFERENCES LinhVuc(LinhVucID),
);

-- Bảng CongViec
CREATE TABLE CongViec (
    CongViecID INT IDENTITY(1,1) PRIMARY KEY,
    TenCongViec NVARCHAR(200) NOT NULL,
    NgayBD DATE,
    NgayKT DATE,
    TrangThai NVARCHAR(50),
	PhamTramHoanThanh FLOAT,
    AnhBia NVARCHAR(MAX),
	DuAnID INT NULL,
    FOREIGN KEY (DuAnID) REFERENCES DuAn(DuAnID) ON DELETE CASCADE
);
alter table CongViec
add FileDinhKem NVARCHAR(MAX)


---------
-- Bảng Phan Cong
CREATE TABLE PhanCong (
    CongViecID INT NOT NULL,
	ThanhVienID INT NOT NULL,
    NoiDungPhanCong NVARCHAR(MAX),
    FOREIGN KEY (CongViecID) REFERENCES CongViec(CongViecID) ON DELETE CASCADE,
	FOREIGN KEY (ThanhVienID) REFERENCES ThanhVien(ThanhVienID) ON DELETE CASCADE
);
ALTER TABLE PhanCong
ADD CONSTRAINT PK_PhanCong PRIMARY KEY (CongViecID, ThanhVienID);


-- Bang Binh Luan
CREATE TABLE BinhLuan (
    BinhLuanID INT NOT NULL IDENTITY(1,1) PRIMARY KEY,
    NoiDung NVARCHAR(MAX),
    NgayBinhLuan DATETIME DEFAULT GETDATE(),
	NgayCapNhat DATETIME,
	ThanhVienID INT NULL,
	CongViecID INT NULL,
    FOREIGN KEY (CongViecID) REFERENCES CongViec(CongViecID) ON DELETE CASCADE,
	FOREIGN KEY (ThanhVienID) REFERENCES ThanhVien(ThanhVienID) ON DELETE CASCADE
);

CREATE TABLE Quyen (
    QuyenID INT IDENTITY(1,1) PRIMARY KEY,
    TenQuyen NVARCHAR(100) NOT NULL,  -- Ví dụ: 'Admin', 'User'
    MoTa NVARCHAR(255)
);
ALTER TABLE TaiKhoan
ADD QuyenID INT NULL,
    FOREIGN KEY (QuyenID) REFERENCES Quyen(QuyenID);

INSERT INTO Quyen (TenQuyen, MoTa)
VALUES 
(N'Admin', N'Tài khoản quản trị toàn hệ thống'),
(N'Quản lí', N'Tài khoản người quản lí dự án');

INSERT INTO Quyen (TenQuyen, MoTa)
VALUES 
(N'Thành viên', N'Tài khoản thành viên thực hiện dự án');

update Quyen set TenQuyen = N'Quản lí', MoTa  = N'Tài khoản người quản lí dự án' where QuyenID = 2
select * from Quyen
delete from Quyen
DBCC CHECKIDENT ('Quyen', RESEED, 0);


CREATE OR ALTER PROCEDURE sp_ThongKeBaoCao_DuAn
    @DuAnID INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        DA.DuAnID,
        DA.TenDuAn,

        -- 1. Tổng hợp công việc
        COUNT(CV.CongViecID) AS TongSoCV,
		COUNT(CASE WHEN CV.TrangThai = N'Chưa bắt đầu' THEN 1 END) AS SoCVChuaBatDau,
        COUNT(CASE WHEN CV.TrangThai = N'Hoàn thành' THEN 1 END) AS SoCVHoanThanh,
        COUNT(CASE WHEN CV.TrangThai = N'Đang làm' THEN 1 END) AS SoCVDangLam,
        COUNT(CASE WHEN CV.TrangThai = N'Trễ hạn' THEN 1 END) AS SoCVTreHan,

        -- 2. Phần trăm và thời gian trung bình
        CAST(ISNULL(AVG(CV.PhamTramHoanThanh), 0) AS DECIMAL(5,2)) AS PhanTramHoanThanh,
        CAST(ISNULL(AVG(DATEDIFF(DAY, CV.NgayBD, CV.NgayKT)), 0) AS DECIMAL(10,2)) AS ThoiGianHoanThanhTrungBinh,

        -- 3. Ngày sớm nhất / muộn nhất
        MIN(CV.NgayBD) AS NgayBatDauSomNhatCuaCongViec,
        MAX(CV.NgayKT) AS NgayKetThucMuonNhatCuaCongViec,

        -- 4. Số ngày còn lại đến hạn cuối
        DATEDIFF(DAY, GETDATE(), MAX(DA.NgayKT)) AS SoNgayConLai,

        -- 5. Tiến độ thực tế dựa theo số lượng công việc
        CASE 
            WHEN COUNT(CV.CongViecID) = 0 THEN 0
            ELSE CAST(
                (COUNT(CASE WHEN CV.TrangThai = N'Hoàn thành' THEN 1 END) * 100.0) /
                COUNT(CV.CongViecID)
                AS DECIMAL(5,2)
            )
        END AS TienDoThucTe,

        -- 6. Đánh giá tiến độ
        CASE 
            WHEN MAX(CV.NgayKT) < GETDATE() AND 
                 (COUNT(CASE WHEN CV.TrangThai = N'Hoàn thành' THEN 1 END) < COUNT(CV.CongViecID))
                THEN N'⛔ Chậm tiến độ'
            WHEN CAST(ISNULL(AVG(CV.PhamTramHoanThanh),0) AS DECIMAL(5,2)) < 50 
                THEN N'⚠️ Cần cải thiện'
            WHEN CAST(ISNULL(AVG(CV.PhamTramHoanThanh),0) AS DECIMAL(5,2)) <= 90 
                THEN N'✅ Gần hoàn thành'
            WHEN CAST(ISNULL(AVG(CV.PhamTramHoanThanh),0) AS DECIMAL(5,2)) = 100 
                THEN N'🕓 Đúng tiến độ'			
        END AS DanhGiaTienDo,

        GETDATE() AS NgayCapNhatBaoCao

    FROM DuAn DA
    LEFT JOIN CongViec CV ON DA.DuAnID = CV.DuAnID
    WHERE DA.DuAnID = @DuAnID
    GROUP BY DA.DuAnID, DA.TenDuAn;
END;


EXEC sp_ThongKeBaoCao_DuAn @DuAnID = 6;


CREATE PROCEDURE sp_ThongKeThanhVienTheoDuAn
    @DuAnID INT,
    @Top INT = 3,
    @Loai NVARCHAR(20) = N'NhieuNhat'
AS
BEGIN
    SET NOCOUNT ON;

    ;WITH PhanCongChiTiet AS (
        SELECT 
            pc.ThanhVienID,
            cv.DuAnID,
            REPLACE(JSON_VALUE(j.value, '$.TienDoHoanThanh'), '%', '') AS TienDoHoanThanh
        FROM PhanCong pc
        INNER JOIN CongViec cv ON pc.CongViecID = cv.CongViecID
        CROSS APPLY OPENJSON(pc.NoiDungPhanCong) AS j
        WHERE cv.DuAnID = @DuAnID
    ),
    ThongKe AS (
        SELECT 
            tv.ThanhVienID,
            tv.HoTen,
            COUNT(*) AS SoLuongCongViec,
            SUM(CASE WHEN TRY_CAST(pcct.TienDoHoanThanh AS INT) = 100 THEN 1 ELSE 0 END) AS SoLuongHoanThanh,
            ISNULL(AVG(TRY_CAST(pcct.TienDoHoanThanh AS FLOAT)), 0) AS TrungBinhHT
        FROM PhanCongChiTiet pcct
        INNER JOIN ThanhVien tv ON pcct.ThanhVienID = tv.ThanhVienID
        GROUP BY tv.ThanhVienID, tv.HoTen
    )

    SELECT TOP (@Top)
        tk.ThanhVienID,
        tk.HoTen,
        tk.SoLuongCongViec,
        tk.SoLuongHoanThanh,
        tk.TrungBinhHT,
        CASE 
            WHEN @Loai = N'NhieuNhat' THEN N'Người làm việc tích cực nhất'
            WHEN @Loai = N'ItNhat' THEN N'Người làm việc ít nhất'
            ELSE N'Trung bình'
        END AS MucDoHoatDong
    FROM ThongKe tk
    ORDER BY 
        CASE WHEN @Loai = N'NhieuNhat' THEN tk.SoLuongCongViec END DESC,
        CASE WHEN @Loai = N'ItNhat' THEN tk.SoLuongCongViec END ASC;
END;




EXEC sp_ThongKeThanhVienTheoDuAn @DuAnID = 11, @Top = 3, @Loai = N'NhieuNhat';

EXEC sp_ThongKeThanhVienTheoDuAn @DuAnID = 11, @Top = 5, @Loai = N'ItNhat';


select * from Quyen
select * from ThanhVien
select * from TaiKhoan
DBCC CHECKIDENT ('ThanhVien', RESEED, 0);
DBCC CHECKIDENT ('TaiKhoan', RESEED, 0);

delete from ThanhVien
delete from TaiKhoan

INSERT INTO ChuyenMon (TenChuyenMon) VALUES
(N'Front-end Developer'),
(N'Back-end Developer'),
(N'Tester');

INSERT INTO ChuyenMon (TenChuyenMon) VALUES
(N'Full-stack Developer'),
(N'Mobile Developer'),
(N'Game Developer'),
(N'Data Engineer'),
(N'Data Scientist'),
(N'Machine Learning Engineer'),
(N'DevOps Engineer'),
(N'Cloud Engineer'),
(N'Software Architect'),
(N'System Administrator'),
(N'UI/UX Designer'),
(N'Product Manager'),
(N'Project Manager'),
(N'Business Analyst'),
(N'QA Engineer'),
(N'Security Engineer'),
(N'Network Engineer'),
(N'Embedded Systems Engineer'),
(N'Blockchain Developer'),
(N'AI Engineer'),
(N'Site Reliability Engineer (SRE)'),
(N'Database Administrator'),
(N'Automation Engineer'),
(N'Support Engineer'),
(N'Technical Writer'),
(N'Game Designer'),
(N'Scrum Master');


select * from ChuyenMon
select * from LinhVuc


INSERT INTO LinhVuc (TenLinhVuc) VALUES
(N'Công nghệ thông tin'),
(N'Giáo dục và đào tạo'),
(N'Tài chính - Ngân hàng');
INSERT INTO LinhVuc (TenLinhVuc) VALUES
(N'Phát triển phần mềm'),
(N'Công nghệ thông tin tổng hợp'),
(N'Thiết kế và phát triển website'),
(N'Phát triển ứng dụng di động'),
(N'Phát triển game'),
(N'Trí tuệ nhân tạo (AI)'),
(N'Học máy (Machine Learning)'),
(N'Phân tích và khoa học dữ liệu (Data Science)'),
(N'Kỹ sư dữ liệu (Data Engineering)'),
(N'Điện toán đám mây (Cloud Computing)'),
(N'An toàn thông tin và bảo mật mạng (Cyber Security)'),
(N'Hệ thống nhúng và IoT (Internet of Things)'),
(N'Thiết kế giao diện người dùng (UI/UX Design)'),
(N'Thiết kế hệ thống và kiến trúc phần mềm'),
(N'Tự động hoá và robot (Automation & Robotics)'),
(N'Blockchain và Web3'),
(N'Quản trị hệ thống (System Administration)'),
(N'Quản lý dự án công nghệ (IT Project Management)'),
(N'Tích hợp hệ thống (System Integration)'),
(N'Kiểm thử phần mềm (Software Testing)'),
(N'Đảm bảo chất lượng phần mềm (QA/QC)'),
(N'Phát triển phần mềm mã nguồn mở (Open Source Development)'),
(N'Công nghệ thực tế ảo và tăng cường (VR/AR)'),
(N'Công nghệ tài chính (FinTech)'),
(N'Công nghệ giáo dục (EdTech)'),
(N'Công nghệ y tế (HealthTech)'),
(N'Công nghệ môi trường (GreenTech)'),
(N'Công nghệ chuỗi cung ứng (Supply Chain Tech)'),
(N'Công nghệ thương mại điện tử (E-Commerce Tech)'),
(N'Công nghệ truyền thông và giải trí (Media & Entertainment Tech)');

select * from Quyen
select * from ThanhVien
select * from TaiKhoan
select * from Nhom
select * from ChiTietThanhVienNhom
select * from DuAn
select * from CongViec
select * from PhanCong
select * from BinhLuan

delete from TaiKhoan
delete from ThanhVien
delete from ChiTietThanhVienNhom
delete from CongViec
delete from PhanCong
delete from DuAn
delete from Nhom where NhomID = 17
delete from BinhLuan

--tách thông báo ra thành:
--LoiMoiNhom
--Thêm Chuc Năng nhận thông báo khi được phân công
select * from Nhom
select * from ChiTietThanhVienNhom
delete from ChiTietThanhVienNhom where NhomID = 5 and ThanhVienID = 2
delete from Nhom where NhomID >= 13

update DuAn
set NhomID = 5 where DuAnID = 15

update CongViec
set TrangThai = N'Chưa bắt đầu' where CongViecID = 2
select * from CongViec

go
update TaiKhoan set QuyenID = 2

delete PhanCong where CongViecID = 18

delete TaiKhoan

delete ThanhVien

insert into TaiKhoan(TenTaiKhoan, Email, NgayTao, TrangThai, LanDangNhapGanNhat, QuyenID)
values('Admin123', 'khangphuhuyanh@gmail.com', GETDATE(), 1, GETDATE(), 1);

insert into ThanhVien(HoTen)
values(N'Admin đẹp trai')

update TaiKhoan set ThanhVienID = 6 where TaiKhoanID = 6




