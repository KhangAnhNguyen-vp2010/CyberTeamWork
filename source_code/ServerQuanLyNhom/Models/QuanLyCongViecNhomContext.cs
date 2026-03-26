using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;

namespace ServerQuanLyNhom.Models;

public partial class QuanLyCongViecNhomContext : DbContext
{
    public QuanLyCongViecNhomContext()
    {
    }

    public QuanLyCongViecNhomContext(DbContextOptions<QuanLyCongViecNhomContext> options)
        : base(options)
    {
    }

    public virtual DbSet<BinhLuan> BinhLuans { get; set; }

    public virtual DbSet<ChiTietThanhVienNhom> ChiTietThanhVienNhoms { get; set; }

    public virtual DbSet<ChuyenMon> ChuyenMons { get; set; }

    public virtual DbSet<CongViec> CongViecs { get; set; }

    public virtual DbSet<DuAn> DuAns { get; set; }

    public virtual DbSet<LinhVuc> LinhVucs { get; set; }

    public virtual DbSet<Nhom> Nhoms { get; set; }

    public virtual DbSet<PhanCong> PhanCongs { get; set; }

    public virtual DbSet<Quyen> Quyens { get; set; }

    public virtual DbSet<TaiKhoan> TaiKhoans { get; set; }

    public virtual DbSet<ThanhVien> ThanhViens { get; set; }

    public DbSet<ThongKeBaoCaoDuAnResponse> ThongKeBaoCaoDuAnResponses { get; set; }

    

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
#warning To protect potentially sensitive information in your connection string, you should move it out of source code. You can avoid scaffolding the connection string by using the Name= syntax to read it from configuration - see https://go.microsoft.com/fwlink/?linkid=2131148. For more guidance on storing connection strings, see https://go.microsoft.com/fwlink/?LinkId=723263.
        => optionsBuilder.UseSqlServer("Server=LAPTOP-8HLF4UKP\\SQLEXPRESS;Database=QuanLyCongViecNhom;Trusted_Connection=True;TrustServerCertificate=True;");

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<BinhLuan>(entity =>
        {
            entity.HasKey(e => e.BinhLuanId).HasName("PK__BinhLuan__54F56E50348450EF");

            entity.ToTable("BinhLuan");

            entity.Property(e => e.BinhLuanId).HasColumnName("BinhLuanID");
            entity.Property(e => e.CongViecId).HasColumnName("CongViecID");
            entity.Property(e => e.NgayBinhLuan)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.NgayCapNhat).HasColumnType("datetime");
            entity.Property(e => e.ThanhVienId).HasColumnName("ThanhVienID");

            entity.HasOne(d => d.CongViec).WithMany(p => p.BinhLuans)
                .HasForeignKey(d => d.CongViecId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK__BinhLuan__CongVi__72910220");

            entity.HasOne(d => d.ThanhVien).WithMany(p => p.BinhLuans)
                .HasForeignKey(d => d.ThanhVienId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK__BinhLuan__ThanhV__73852659");
        });

        modelBuilder.Entity<ChiTietThanhVienNhom>(entity =>
        {
            entity.HasKey(e => new { e.NhomId, e.ThanhVienId }).HasName("PK_ChiTietNhom");

            entity.ToTable("ChiTietThanhVienNhom");

            entity.Property(e => e.NhomId).HasColumnName("NhomID");
            entity.Property(e => e.ThanhVienId).HasColumnName("ThanhVienID");
            entity.Property(e => e.ChucVu).HasMaxLength(50);

            entity.HasOne(d => d.Nhom).WithMany(p => p.ChiTietThanhVienNhoms)
                .HasForeignKey(d => d.NhomId)
                .HasConstraintName("FK__ChiTietTh__NhomI__59C55456");

            entity.HasOne(d => d.ThanhVien).WithMany(p => p.ChiTietThanhVienNhoms)
                .HasForeignKey(d => d.ThanhVienId)
                .HasConstraintName("FK__ChiTietTh__Thanh__5AB9788F");
        });

        modelBuilder.Entity<ChuyenMon>(entity =>
        {
            entity.HasKey(e => e.ChuyenMonId).HasName("PK__ChuyenMo__ADDA8F8AFA2E46DF");

            entity.ToTable("ChuyenMon");

            entity.Property(e => e.ChuyenMonId).HasColumnName("ChuyenMonID");
            entity.Property(e => e.TenChuyenMon).HasMaxLength(100);
        });

        modelBuilder.Entity<CongViec>(entity =>
        {
            entity.HasKey(e => e.CongViecId).HasName("PK__CongViec__97B7B44F3D4765EA");

            entity.ToTable("CongViec");

            entity.Property(e => e.CongViecId).HasColumnName("CongViecID");
            entity.Property(e => e.DuAnId).HasColumnName("DuAnID");
            entity.Property(e => e.NgayBd).HasColumnName("NgayBD");
            entity.Property(e => e.NgayKt).HasColumnName("NgayKT");
            entity.Property(e => e.TenCongViec).HasMaxLength(200);
            entity.Property(e => e.TrangThai).HasMaxLength(50);

            entity.HasOne(d => d.DuAn).WithMany(p => p.CongViecs)
                .HasForeignKey(d => d.DuAnId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK__CongViec__DuAnID__6AEFE058");
        });

        modelBuilder.Entity<DuAn>(entity =>
        {
            entity.HasKey(e => e.DuAnId).HasName("PK__DuAn__2007B3CB0DCBD8CB");

            entity.ToTable("DuAn");

            entity.Property(e => e.DuAnId).HasColumnName("DuAnID");
            entity.Property(e => e.LinhVucId).HasColumnName("LinhVucID");
            entity.Property(e => e.MoTa).HasMaxLength(500);
            entity.Property(e => e.NgayBd).HasColumnName("NgayBD");
            entity.Property(e => e.NgayKt).HasColumnName("NgayKT");
            entity.Property(e => e.NhomId).HasColumnName("NhomID");
            entity.Property(e => e.TenDuAn).HasMaxLength(200);
            entity.Property(e => e.TrangThai)
                .HasMaxLength(50)
                .HasDefaultValue("Đang thực hiện");

            entity.HasOne(d => d.LinhVuc).WithMany(p => p.DuAns)
                .HasForeignKey(d => d.LinhVucId)
                .HasConstraintName("FK__DuAn__LinhVucID__681373AD");

            entity.HasOne(d => d.Nhom).WithMany(p => p.DuAns)
                .HasForeignKey(d => d.NhomId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK__DuAn__NhomID__671F4F74");
        });

        modelBuilder.Entity<LinhVuc>(entity =>
        {
            entity.HasKey(e => e.LinhVucId).HasName("PK__LinhVuc__F06AD8A62DC63E47");

            entity.ToTable("LinhVuc");

            entity.Property(e => e.LinhVucId).HasColumnName("LinhVucID");
            entity.Property(e => e.TenLinhVuc).HasMaxLength(100);
        });

        modelBuilder.Entity<Nhom>(entity =>
        {
            entity.HasKey(e => e.NhomId).HasName("PK__Nhom__E983B00587BBD88B");

            entity.ToTable("Nhom");

            entity.Property(e => e.NhomId).HasColumnName("NhomID");
            entity.Property(e => e.MoTa).HasMaxLength(255);
            entity.Property(e => e.NgayCapNhat)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.NgayLapNhom).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.SoLuongTv).HasColumnName("SoLuongTV");
            entity.Property(e => e.TenNhom).HasMaxLength(100);
        });

        modelBuilder.Entity<PhanCong>(entity =>
        {
            entity.HasKey(e => new { e.CongViecId, e.ThanhVienId });

            entity.ToTable("PhanCong");

            entity.Property(e => e.CongViecId).HasColumnName("CongViecID");
            entity.Property(e => e.ThanhVienId).HasColumnName("ThanhVienID");

            entity.HasOne(d => d.CongViec).WithMany(p => p.PhanCongs)
                .HasForeignKey(d => d.CongViecId)
                .HasConstraintName("FK__PhanCong__CongVi__2DB1C7EE");

            entity.HasOne(d => d.ThanhVien).WithMany(p => p.PhanCongs)
                .HasForeignKey(d => d.ThanhVienId)
                .HasConstraintName("FK__PhanCong__ThanhV__2EA5EC27");
        });

        modelBuilder.Entity<Quyen>(entity =>
        {
            entity.HasKey(e => e.QuyenId).HasName("PK__Quyen__12926E0CA07A5D66");

            entity.ToTable("Quyen");

            entity.Property(e => e.QuyenId).HasColumnName("QuyenID");
            entity.Property(e => e.MoTa).HasMaxLength(255);
            entity.Property(e => e.TenQuyen).HasMaxLength(100);
        });

        modelBuilder.Entity<TaiKhoan>(entity =>
        {
            entity.HasKey(e => e.TaiKhoanId).HasName("PK__TaiKhoan__9A124B656A78EFFC");

            entity.ToTable("TaiKhoan");

            entity.HasIndex(e => e.Email, "UQ__TaiKhoan__A9D1053437040AFE").IsUnique();

            entity.HasIndex(e => e.TenTaiKhoan, "UQ__TaiKhoan__B106EAF82899435E").IsUnique();

            entity.HasIndex(e => e.ThanhVienId, "UQ__TaiKhoan__C309D8A7D9C5298A").IsUnique();

            entity.Property(e => e.TaiKhoanId).HasColumnName("TaiKhoanID");
            entity.Property(e => e.Email).HasMaxLength(100);
            entity.Property(e => e.LanDangNhapGanNhat).HasColumnType("datetime");
            entity.Property(e => e.LoaiTaiKhoan)
                .HasMaxLength(100)
                .HasDefaultValue("Local");
            entity.Property(e => e.MatKhau).HasMaxLength(255);
            entity.Property(e => e.NgayTao)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.QuyenId).HasColumnName("QuyenID");
            entity.Property(e => e.TenTaiKhoan).HasMaxLength(200);
            entity.Property(e => e.ThanhVienId).HasColumnName("ThanhVienID");
            entity.Property(e => e.TrangThai).HasDefaultValue(true);

            entity.HasOne(d => d.Quyen).WithMany(p => p.TaiKhoans)
                .HasForeignKey(d => d.QuyenId)
                .HasConstraintName("FK__TaiKhoan__QuyenI__41B8C09B");

            entity.HasOne(d => d.ThanhVien).WithOne(p => p.TaiKhoan)
                .HasForeignKey<TaiKhoan>(d => d.ThanhVienId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK__TaiKhoan__ThanhV__16CE6296");
        });

        modelBuilder.Entity<ThanhVien>(entity =>
        {
            entity.HasKey(e => e.ThanhVienId).HasName("PK__ThanhVie__C309D8A6B547D588");

            entity.ToTable("ThanhVien");

            entity.Property(e => e.ThanhVienId).HasColumnName("ThanhVienID");
            entity.Property(e => e.ChuyenMonId).HasColumnName("ChuyenMonID");
            entity.Property(e => e.DiaChi).HasMaxLength(100);
            entity.Property(e => e.GioiTinh).HasMaxLength(10);
            entity.Property(e => e.HoTen).HasMaxLength(100);
            entity.Property(e => e.MoTaBanThan).HasMaxLength(500);
            entity.Property(e => e.Sdt)
                .HasMaxLength(15)
                .HasColumnName("SDT");

            entity.HasOne(d => d.ChuyenMon).WithMany(p => p.ThanhViens)
                .HasForeignKey(d => d.ChuyenMonId)
                .HasConstraintName("FK__ThanhVien__Chuye__57DD0BE4");
        });

        OnModelCreatingPartial(modelBuilder);

        modelBuilder.Entity<ThongKeBaoCaoDuAnResponse>().HasNoKey();

        
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
