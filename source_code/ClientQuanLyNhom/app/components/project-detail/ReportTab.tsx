import React, { useMemo, useState } from "react";
import styles from "./ReportTab.module.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendarDay,
  faTasks,
  faClock,
  faChartPie,
  faUsers,
  faGaugeHigh,
  faTriangleExclamation,
  faChartLine,
  faInfoCircle,
  faFileExcel,
} from "@fortawesome/free-solid-svg-icons";
import ExcelJS from "exceljs";
import api from "../../apis/api";
import { toast } from "react-toastify";
import { Pie, Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
} from "chart.js";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement
);

interface ProjectMemberStat {
  thanhVienID: number;
  hoTen: string;
  soLuongCongViec: number;
  soLuongHoanThanh: number;
  trungBinhHT: number;
  mucDoHoatDong: string;
}

interface ReportTabData {
  duAnID: number;
  tenDuAn: string;
  tongSoCV: number;
  soCVChuaBatDau: number;
  soCVHoanThanh: number;
  soCVDangLam: number;
  soCVTreHan: number;
  phanTramHoanThanh: number;
  thoiGianHoanThanhTrungBinh: number;
  ngayBatDauSomNhatCuaCongViec: string | null;
  ngayKetThucMuonNhatCuaCongViec: string | null;
  soNgayConLai: number;
  tienDoThucTe: number;
  danhGiaTienDo: string;
  ngayCapNhatBaoCao: string;
}

interface ReportTabProps {
  project: { tenDuAn: string; duAnId: number };
  report: ReportTabData;
  memberStats: ProjectMemberStat[] | null;
  memberStatsLoading: boolean;
  memberStatsError: string | null;
  memberStatsTop: number;
  memberStatsType: "NhieuNhat" | "ItNhat";
  onMemberStatsTopChange: (value: number) => void;
  onMemberStatsTypeChange: (value: "NhieuNhat" | "ItNhat") => void;
  userRole?: string;
}

const formatDate = (value: string | null) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("vi-VN");
  } catch (error) {
    return value;
  }
};

const ReportTab: React.FC<ReportTabProps> = ({
  project,
  report,
  memberStats,
  memberStatsLoading,
  memberStatsError,
  memberStatsTop,
  memberStatsType,
  onMemberStatsTopChange,
  onMemberStatsTypeChange,
  userRole = "",
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [tasksLoaded, setTasksLoaded] = useState(false);

  // Fetch tasks để tính toán chính xác số công việc trễ hạn (loại bỏ task 100%)
  React.useEffect(() => {
    const fetchTasks = async () => {
      try {
        const tasksResponse = await api.get(
          `/CongViec/GetCongViecsOfDuAn/${report.duAnID}`
        );
        const tasksRaw = tasksResponse.data;
        const tasksList = Array.isArray(tasksRaw)
          ? tasksRaw
          : Array.isArray(tasksRaw?.congViecs)
            ? tasksRaw.congViecs
            : [];
        setTasks(tasksList);
        setTasksLoaded(true);
      } catch (error) {
        console.error("Error fetching tasks:", error);
        setTasksLoaded(true);
      }
    };
    fetchTasks();
  }, [report.duAnID]);

  // Tính lại số công việc trễ hạn thực sự (loại bỏ task đã hoàn thành 100%)
  const adjustedReport = useMemo(() => {
    if (!tasksLoaded) return report;

    // Đếm số task trễ hạn nhưng chưa hoàn thành 100%
    const actualOverdueTasks = tasks.filter(
      (task) =>
        task.trangThai?.toLowerCase() === "trễ hạn" &&
        (task.phamTramHoanThanh || 0) < 100
    ).length;

    return {
      ...report,
      soCVTreHan: actualOverdueTasks,
    };
  }, [report, tasks, tasksLoaded]);

  const exportToExcel = async () => {
    try {
      setIsExporting(true);
      toast.info("Đang thu thập dữ liệu...");

      // Lấy thông tin chi tiết dự án
      const projectResponse = await api.get(`/DuAn/${report.duAnID}`);
      const projectDetail = projectResponse.data;

      // Lấy danh sách công việc
      const tasksResponse = await api.get(
        `/CongViec/GetCongViecsOfDuAn/${report.duAnID}`
      );
      const tasksRaw = tasksResponse.data;
      const tasks = Array.isArray(tasksRaw)
        ? tasksRaw
        : Array.isArray(tasksRaw?.congViecs)
          ? tasksRaw.congViecs
          : [];

      // Lấy danh sách phân công
      const assignmentsResponse = await api.get(
        `/PhanCong/phancong/duan/${report.duAnID}`
      );
      const assignmentsRaw = assignmentsResponse.data;

      // Flatten nested structure
      const assignments: any[] = [];
      if (
        assignmentsRaw?.danhSachCongViec &&
        Array.isArray(assignmentsRaw.danhSachCongViec)
      ) {
        assignmentsRaw.danhSachCongViec.forEach((congViec: any) => {
          if (
            congViec.danhSachPhanCong &&
            Array.isArray(congViec.danhSachPhanCong)
          ) {
            congViec.danhSachPhanCong.forEach((phanCong: any) => {
              const subtasks = Array.isArray(phanCong.noiDungPhanCong)
                ? phanCong.noiDungPhanCong
                : [];

              if (subtasks.length > 0) {
                subtasks.forEach((subtask: any) => {
                  // Format ngày nộp mới nhất và tất cả lịch sử
                  let ngayNopMoiNhat = "-";
                  let lichSuNgayNop = "-";

                  const ngayNopArray = subtask.NgayNop || subtask.ngayNop;
                  if (
                    ngayNopArray &&
                    Array.isArray(ngayNopArray) &&
                    ngayNopArray.length > 0
                  ) {
                    const sortedDates = ngayNopArray
                      .slice()
                      .sort(
                        (a: string, b: string) =>
                          new Date(b).getTime() - new Date(a).getTime()
                      );

                    // Ngày nộp mới nhất
                    const latestDate = new Date(sortedDates[0]);
                    ngayNopMoiNhat = latestDate.toLocaleString("vi-VN", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    });

                    // Tất cả lịch sử ngày nộp
                    lichSuNgayNop = sortedDates
                      .map((date: string) => {
                        const d = new Date(date);
                        return d.toLocaleString("vi-VN", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        });
                      })
                      .join(" | ");
                  }

                  assignments.push({
                    tenCongViec: congViec.tenCongViec,
                    hoTen: phanCong.hoTen,
                    chuyenMon: phanCong.chuyenMon,
                    moTaSubtask: subtask.moTa || "",
                    ngayPhanCong: formatDate(subtask.ngayPC),
                    ngayNopMoiNhat: ngayNopMoiNhat,
                    lichSuNgayNop: lichSuNgayNop,
                    doUuTien: subtask.doUuTien || "",
                    tienDoHoanThanh: subtask.tienDoHoanThanh || "0%",
                    trangThaiKhoa: subtask.trangThaiKhoa
                      ? "Đã khóa"
                      : "Chưa khóa",
                    danhGia: subtask.danhGia || "",
                    trangThaiCongViec: congViec.trangThai,
                    phamTramHoanThanhCongViec: congViec.phamTramHoanThanh,
                  });
                });
              } else {
                assignments.push({
                  tenCongViec: congViec.tenCongViec,
                  hoTen: phanCong.hoTen,
                  chuyenMon: phanCong.chuyenMon,
                  moTaSubtask: "(Chưa có công việc con)",
                  ngayPhanCong: "-",
                  ngayNopMoiNhat: "-",
                  lichSuNgayNop: "-",
                  doUuTien: "-",
                  tienDoHoanThanh: "-",
                  trangThaiKhoa: "-",
                  danhGia: "-",
                  trangThaiCongViec: congViec.trangThai,
                  phamTramHoanThanhCongViec: congViec.phamTramHoanThanh,
                });
              }
            });
          }
        });
      }

      // Tạo workbook với ExcelJS
      const workbook = new ExcelJS.Workbook();

      // Sheet 1: Tổng quan dự án
      const sheet1 = workbook.addWorksheet("Tổng quan");

      // Tiêu đề chính
      sheet1.mergeCells("A1:B1");
      const titleCell = sheet1.getCell("A1");
      titleCell.value = "BÁO CÁO CHI TIẾT DỰ ÁN";
      titleCell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
      titleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4472C4" },
      };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      titleCell.border = {
        top: { style: "medium", color: { argb: "FF000000" } },
        left: { style: "medium", color: { argb: "FF000000" } },
        bottom: { style: "medium", color: { argb: "FF000000" } },
        right: { style: "medium", color: { argb: "FF000000" } },
      };
      sheet1.getRow(1).height = 30;

      // Thông tin dự án
      sheet1.addRow([]);
      const row3 = sheet1.addRow(["Tên dự án:", project.tenDuAn]);
      row3.getCell(1).font = { bold: true };
      row3.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE7E6E6" },
      };

      const row4 = sheet1.addRow(["Mô tả:", projectDetail.moTa || ""]);
      row4.getCell(1).font = { bold: true };
      row4.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE7E6E6" },
      };

      const row5 = sheet1.addRow([
        "Ngày bắt đầu:",
        formatDate(projectDetail.ngayBd),
      ]);
      row5.getCell(1).font = { bold: true };
      row5.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE7E6E6" },
      };

      const row6 = sheet1.addRow([
        "Ngày kết thúc:",
        formatDate(projectDetail.ngayKt),
      ]);
      row6.getCell(1).font = { bold: true };
      row6.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE7E6E6" },
      };

      const row7 = sheet1.addRow([
        "Trạng thái:",
        projectDetail.trangThai || "",
      ]);
      row7.getCell(1).font = { bold: true };
      row7.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE7E6E6" },
      };

      sheet1.addRow([]);

      // Tiêu đề thống kê
      sheet1.mergeCells("A9:B9");
      const statsTitle = sheet1.getCell("A9");
      statsTitle.value = "THỐNG KÊ TỔNG QUAN";
      statsTitle.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
      statsTitle.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF70AD47" },
      };
      statsTitle.alignment = { horizontal: "center", vertical: "middle" };
      statsTitle.border = {
        top: { style: "medium", color: { argb: "FF000000" } },
        left: { style: "medium", color: { argb: "FF000000" } },
        bottom: { style: "medium", color: { argb: "FF000000" } },
        right: { style: "medium", color: { argb: "FF000000" } },
      };
      sheet1.getRow(9).height = 25;

      // Thống kê với màu sắc xen kẽ
      const row10 = sheet1.addRow(["Tổng số công việc:", report.tongSoCV]);
      row10.getCell(1).font = { bold: true };
      row10.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9E1F2" },
      };
      row10.getCell(2).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF2F2F2" },
      };

      const row11 = sheet1.addRow([
        "Công việc hoàn thành:",
        report.soCVHoanThanh,
      ]);
      row11.getCell(1).font = { bold: true };
      row11.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9E1F2" },
      };
      row11.getCell(2).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFFFFF" },
      };
      row11.getCell(2).font = { color: { argb: "FF70AD47" }, bold: true };

      const row12 = sheet1.addRow(["Công việc đang làm:", report.soCVDangLam]);
      row12.getCell(1).font = { bold: true };
      row12.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9E1F2" },
      };
      row12.getCell(2).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF2F2F2" },
      };
      row12.getCell(2).font = { color: { argb: "FFFFC000" }, bold: true };

      const row13 = sheet1.addRow([
        "Công việc chưa bắt đầu:",
        report.soCVChuaBatDau,
      ]);
      row13.getCell(1).font = { bold: true };
      row13.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9E1F2" },
      };
      row13.getCell(2).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFFFFF" },
      };
      row13.getCell(2).font = { color: { argb: "FF808080" }, bold: true };

      const row14 = sheet1.addRow(["Công việc trễ hạn:", report.soCVTreHan]);
      row14.getCell(1).font = { bold: true };
      row14.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9E1F2" },
      };
      row14.getCell(2).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF2F2F2" },
      };
      row14.getCell(2).font = { color: { argb: "FFFF0000" }, bold: true };

      const row15 = sheet1.addRow([
        "Tiến độ hoàn thành (Kế hoạch):",
        `${report.phanTramHoanThanh}%`,
      ]);
      row15.getCell(1).font = { bold: true };
      row15.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9E1F2" },
      };
      row15.getCell(2).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFFFFF" },
      };

      const row16 = sheet1.addRow([
        "Tiến độ thực tế:",
        `${report.tienDoThucTe}%`,
      ]);
      row16.getCell(1).font = { bold: true };
      row16.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9E1F2" },
      };
      row16.getCell(2).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF2F2F2" },
      };

      const row17 = sheet1.addRow([
        "Thời gian hoàn thành trung bình:",
        `${report.thoiGianHoanThanhTrungBinh} ngày`,
      ]);
      row17.getCell(1).font = { bold: true };
      row17.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9E1F2" },
      };
      row17.getCell(2).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFFFFF" },
      };

      const row18 = sheet1.addRow(["Số ngày còn lại:", report.soNgayConLai]);
      row18.getCell(1).font = { bold: true };
      row18.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9E1F2" },
      };
      row18.getCell(2).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF2F2F2" },
      };

      const row19 = sheet1.addRow(["Đánh giá tiến độ:", report.danhGiaTienDo]);
      row19.getCell(1).font = { bold: true };
      row19.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9E1F2" },
      };
      row19.getCell(2).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFFFFF" },
      };

      const row20 = sheet1.addRow([
        "Ngày cập nhật báo cáo:",
        formatDate(report.ngayCapNhatBaoCao),
      ]);
      row20.getCell(1).font = { bold: true };
      row20.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9E1F2" },
      };
      row20.getCell(2).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF2F2F2" },
      };

      sheet1.getColumn(1).width = 30;
      sheet1.getColumn(2).width = 50;

      // Sheet 2: Chi tiết công việc
      const sheet2 = workbook.addWorksheet("Công việc");
      sheet2.addRow([
        "STT",
        "Tên công việc",
        "Ngày bắt đầu",
        "Ngày kết thúc",
        "Trạng thái",
        "% Hoàn thành",
      ]);

      // Style header
      const headerRow2 = sheet2.getRow(1);
      headerRow2.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow2.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4472C4" },
      };
      headerRow2.alignment = { horizontal: "center", vertical: "middle" };
      headerRow2.height = 25;
      headerRow2.eachCell((cell) => {
        cell.border = {
          top: { style: "medium", color: { argb: "FF000000" } },
          left: { style: "medium", color: { argb: "FF000000" } },
          bottom: { style: "medium", color: { argb: "FF000000" } },
          right: { style: "medium", color: { argb: "FF000000" } },
        };
      });

      tasks.forEach((task: any, index: number) => {
        const row = sheet2.addRow([
          index + 1,
          task.tenCongViec || "",
          formatDate(task.ngayBd),
          formatDate(task.ngayKt),
          task.trangThai || "",
          `${task.phamTramHoanThanh || 0}%`,
        ]);

        // Màu xen kẽ cho rows
        if (index % 2 === 0) {
          row.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF2F2F2" },
          };
        }

        // Màu theo trạng thái
        const statusCell = row.getCell(5);
        const trangThai = task.trangThai?.toLowerCase() || "";
        if (
          trangThai.includes("hoàn thành") ||
          trangThai.includes("hoàn tất")
        ) {
          statusCell.font = { bold: true, color: { argb: "FF70AD47" } };
          statusCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE2EFDA" },
          };
        } else if (
          trangThai.includes("đang") ||
          trangThai.includes("tiến hành")
        ) {
          statusCell.font = { bold: true, color: { argb: "FFFFC000" } };
          statusCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFF2CC" },
          };
        } else if (trangThai.includes("chưa") || trangThai.includes("mới")) {
          statusCell.font = { color: { argb: "FF808080" } };
          statusCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF2F2F2" },
          };
        }

        // Màu theo % hoàn thành
        const percentCell = row.getCell(6);
        const percent = task.phamTramHoanThanh || 0;
        if (percent >= 100) {
          percentCell.font = { bold: true, color: { argb: "FF70AD47" } };
          percentCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE2EFDA" },
          };
        } else if (percent >= 50) {
          percentCell.font = { bold: true, color: { argb: "FFFFC000" } };
          percentCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFF2CC" },
          };
        } else if (percent > 0) {
          percentCell.font = { color: { argb: "FFFF6600" } };
          percentCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFCE4D6" },
          };
        } else {
          percentCell.font = { color: { argb: "FFFF0000" } };
          percentCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFC7CE" },
          };
        }

        // Border cho tất cả cells
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin", color: { argb: "FFD0D0D0" } },
            left: { style: "thin", color: { argb: "FFD0D0D0" } },
            bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
            right: { style: "thin", color: { argb: "FFD0D0D0" } },
          };
        });
      });

      sheet2.getColumn(1).width = 5;
      sheet2.getColumn(2).width = 40;
      sheet2.getColumn(3).width = 15;
      sheet2.getColumn(4).width = 15;
      sheet2.getColumn(5).width = 15;
      sheet2.getColumn(6).width = 15;

      // Sheet 3: Phân công
      const sheet3 = workbook.addWorksheet("Phân công");
      sheet3.addRow([
        "STT",
        "Công việc chính",
        "Thành viên",
        "Chuyên môn",
        "Mô tả công việc con",
        "Ngày phân công",
        "Ngày nộp (mới nhất)",
        "Lịch sử nộp báo cáo",
        "Độ ưu tiên",
        "Tiến độ",
        "Trạng thái khóa",
        "Đánh giá",
        "Trạng thái CV chính",
        "% HT CV chính",
      ]);

      // Style header
      const headerRow3 = sheet3.getRow(1);
      headerRow3.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow3.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF70AD47" },
      };
      headerRow3.alignment = { horizontal: "center", vertical: "middle" };
      headerRow3.height = 25;
      headerRow3.eachCell((cell) => {
        cell.border = {
          top: { style: "medium", color: { argb: "FF000000" } },
          left: { style: "medium", color: { argb: "FF000000" } },
          bottom: { style: "medium", color: { argb: "FF000000" } },
          right: { style: "medium", color: { argb: "FF000000" } },
        };
      });

      assignments.forEach((assignment: any, index: number) => {
        const row = sheet3.addRow([
          index + 1,
          assignment.tenCongViec || "",
          assignment.hoTen || "",
          assignment.chuyenMon || "",
          assignment.moTaSubtask || "",
          assignment.ngayPhanCong || "",
          assignment.ngayNopMoiNhat || "",
          assignment.lichSuNgayNop || "",
          assignment.doUuTien || "",
          assignment.tienDoHoanThanh || "",
          assignment.trangThaiKhoa || "",
          assignment.danhGia || "",
          assignment.trangThaiCongViec || "",
          `${assignment.phamTramHoanThanhCongViec || 0}%`,
        ]);

        // Màu xen kẽ
        if (index % 2 === 0) {
          row.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF8F9FA" },
          };
        }

        // Màu theo độ ưu tiên
        const priorityCell = row.getCell(9);
        const priority = assignment.doUuTien?.toLowerCase() || "";
        if (priority.includes("cao") || priority.includes("high")) {
          priorityCell.font = { bold: true, color: { argb: "FFFF0000" } };
          priorityCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFC7CE" },
          };
        } else if (priority.includes("trung") || priority.includes("medium")) {
          priorityCell.font = { bold: true, color: { argb: "FFFFC000" } };
          priorityCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFF2CC" },
          };
        } else if (priority.includes("thấp") || priority.includes("low")) {
          priorityCell.font = { color: { argb: "FF70AD47" } };
          priorityCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE2EFDA" },
          };
        }

        // Màu theo trạng thái khóa
        const lockCell = row.getCell(9);
        if (assignment.trangThaiKhoa === "Đã khóa") {
          lockCell.font = { bold: true, color: { argb: "FFFF0000" } };
          lockCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFC7CE" },
          };
        } else {
          lockCell.font = { color: { argb: "FF70AD47" } };
          lockCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE2EFDA" },
          };
        }

        // Highlight chuyên môn
        const expertiseCell = row.getCell(4);
        expertiseCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFD9E1F2" },
        };
        expertiseCell.font = { bold: true };

        // Border
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin", color: { argb: "FFD0D0D0" } },
            left: { style: "thin", color: { argb: "FFD0D0D0" } },
            bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
            right: { style: "thin", color: { argb: "FFD0D0D0" } },
          };
        });
      });

      sheet3.getColumn(1).width = 5;
      sheet3.getColumn(2).width = 30;
      sheet3.getColumn(3).width = 20;
      sheet3.getColumn(4).width = 20;
      sheet3.getColumn(5).width = 40;
      sheet3.getColumn(6).width = 15;
      sheet3.getColumn(7).width = 20;
      sheet3.getColumn(8).width = 50;
      sheet3.getColumn(9).width = 15;
      sheet3.getColumn(10).width = 12;
      sheet3.getColumn(11).width = 15;
      sheet3.getColumn(12).width = 30;
      sheet3.getColumn(13).width = 18;
      sheet3.getColumn(14).width = 12;

      // Sheet 4: Thống kê thành viên
      if (memberStats && memberStats.length > 0) {
        const sheet4 = workbook.addWorksheet("Thống kê thành viên");
        sheet4.addRow([
          "STT",
          "Họ tên",
          "Số lượng công việc",
          "Số lượng hoàn thành",
          "Trung bình hoàn thành (%)",
          "Mức độ hoạt động",
        ]);

        // Style header
        const headerRow4 = sheet4.getRow(1);
        headerRow4.font = { bold: true, color: { argb: "FFFFFFFF" } };
        headerRow4.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF4B084" },
        };
        headerRow4.alignment = { horizontal: "center", vertical: "middle" };
        headerRow4.height = 25;
        headerRow4.eachCell((cell) => {
          cell.border = {
            top: { style: "medium", color: { argb: "FF000000" } },
            left: { style: "medium", color: { argb: "FF000000" } },
            bottom: { style: "medium", color: { argb: "FF000000" } },
            right: { style: "medium", color: { argb: "FF000000" } },
          };
        });

        memberStats.forEach((member, index) => {
          const row = sheet4.addRow([
            index + 1,
            member.hoTen || "",
            member.soLuongCongViec,
            member.soLuongHoanThanh,
            `${member.trungBinhHT}%`,
            member.mucDoHoatDong || "",
          ]);

          // Màu xen kẽ
          if (index % 2 === 0) {
            row.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFFFF9E6" },
            };
          }

          // Màu theo trung bình hoàn thành
          const avgCell = row.getCell(5);
          const avg = member.trungBinhHT || 0;
          if (avg >= 80) {
            avgCell.font = { bold: true, color: { argb: "FF70AD47" } };
            avgCell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFE2EFDA" },
            };
          } else if (avg >= 50) {
            avgCell.font = { bold: true, color: { argb: "FFFFC000" } };
            avgCell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFFFF2CC" },
            };
          } else {
            avgCell.font = { bold: true, color: { argb: "FFFF0000" } };
            avgCell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFFFC7CE" },
            };
          }

          // Màu theo mức độ hoạt động
          const activityCell = row.getCell(6);
          const activity = member.mucDoHoatDong?.toLowerCase() || "";
          if (activity.includes("cao") || activity.includes("tích cực")) {
            activityCell.font = { bold: true, color: { argb: "FF70AD47" } };
            activityCell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFE2EFDA" },
            };
          } else if (
            activity.includes("trung") ||
            activity.includes("bình thường")
          ) {
            activityCell.font = { color: { argb: "FFFFC000" } };
            activityCell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFFFF2CC" },
            };
          } else if (activity.includes("thấp") || activity.includes("kém")) {
            activityCell.font = { color: { argb: "FFFF0000" } };
            activityCell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFFFC7CE" },
            };
          }

          // Highlight tên thành viên
          const nameCell = row.getCell(2);
          nameCell.font = { bold: true };

          // Border
          row.eachCell((cell) => {
            cell.border = {
              top: { style: "thin", color: { argb: "FFD0D0D0" } },
              left: { style: "thin", color: { argb: "FFD0D0D0" } },
              bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
              right: { style: "thin", color: { argb: "FFD0D0D0" } },
            };
          });
        });

        sheet4.getColumn(1).width = 5;
        sheet4.getColumn(2).width = 25;
        sheet4.getColumn(3).width = 20;
        sheet4.getColumn(4).width = 20;
        sheet4.getColumn(5).width = 25;
        sheet4.getColumn(6).width = 20;
      }

      // Xuất file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `BaoCao_${project.tenDuAn.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);

      toast.success("Xuất Excel thành công!");
    } catch (error: any) {
      console.error("Lỗi xuất Excel:", error);
      toast.error("Lỗi khi xuất Excel: " + (error.message || ""));
    } finally {
      setIsExporting(false);
    }
  };

  const derivedMetrics = useMemo(() => {
    const total = report.tongSoCV || 1;
    const delayedPercentage = (report.soCVTreHan / total) * 100;
    const notStartedPercentage = (report.soCVChuaBatDau / total) * 100;
    const inProgressPercentage = (report.soCVDangLam / total) * 100;

    return {
      delayedPercentage,
      notStartedPercentage,
      inProgressPercentage,
    };
  }, [report]);

  const hasWorkData = report.tongSoCV > 0;

  const topOptions = useMemo(() => [3, 5, 10], []);

  const memberStatsHeading = useMemo(() => {
    return memberStatsType === "NhieuNhat"
      ? "Thành viên hoạt động tích cực"
      : "Thành viên hoạt động ít nhất";
  }, [memberStatsType]);

  const memberStatsList = memberStats ?? [];

  const statusPieData = useMemo(() => {
    const piePalette = ["#22c55e", "#6366f1", "#f97316", "#ec4899"];
    const pieBorder = ["#16a34a", "#4338ca", "#ea580c", "#db2777"];

    return {
      labels: ["Hoàn thành", "Đang làm", "Chưa bắt đầu", "Trễ hạn"],
      datasets: [
        {
          data: [
            report.soCVHoanThanh,
            report.soCVDangLam,
            report.soCVChuaBatDau,
            report.soCVTreHan,
          ],
          backgroundColor: piePalette,
          borderColor: pieBorder,
          borderWidth: 1,
        },
      ],
    };
  }, [report]);

  const timeMetricsData = useMemo(() => {
    const daysElapsed = (() => {
      if (!report.ngayBatDauSomNhatCuaCongViec) {
        return 0;
      }

      const start = new Date(report.ngayBatDauSomNhatCuaCongViec);
      const today = new Date();

      const normalizedStart = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate()
      );
      const normalizedToday = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );

      const diffMs = normalizedToday.getTime() - normalizedStart.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : 0;
    })();

    const barPalette = [
      "rgba(249, 115, 22, 0.85)",
      "rgba(59, 130, 246, 0.85)",
      "rgba(16, 185, 129, 0.85)",
    ];

    return {
      labels: [
        "Thời gian hoàn thành TB",
        "Số ngày còn lại",
        "Số ngày đã thực hiện dự án",
      ],
      datasets: [
        {
          label: "Số ngày",
          data: [
            Math.max(0, report.thoiGianHoanThanhTrungBinh),
            Math.max(0, report.soNgayConLai),
            daysElapsed,
          ],
          backgroundColor: barPalette,
          borderRadius: 12,
          maxBarThickness: 44,
        },
      ],
    };
  }, [
    report.ngayBatDauSomNhatCuaCongViec,
    report.soNgayConLai,
    report.thoiGianHoanThanhTrungBinh,
  ]);

  const progressComparisonData = useMemo(() => {
    const planned = Math.max(0, Math.min(report.phanTramHoanThanh, 100));
    const actual = Math.max(0, Math.min(report.tienDoThucTe, 100));

    return {
      labels: ["Kế hoạch", "Thực tế"],
      datasets: [
        {
          label: "Tiến độ (%)",
          data: [planned, actual],
          backgroundColor: [
            "rgba(99, 102, 241, 0.85)",
            "rgba(14, 165, 233, 0.85)",
          ],
          borderRadius: 10,
          maxBarThickness: 32,
        },
      ],
    };
  }, [report]);

  const taskReadinessData = useMemo(() => {
    const started = Math.max(
      0,
      report.soCVHoanThanh + report.soCVDangLam + report.soCVTreHan
    );
    const notStarted = Math.max(0, report.soCVChuaBatDau);

    return {
      labels: ["Đã bắt đầu", "Chưa bắt đầu"],
      datasets: [
        {
          data: [started, notStarted],
          backgroundColor: ["#38bdf8", "#e879f9"],
          borderColor: ["#0284c7", "#c026d3"],
          borderWidth: 1,
        },
      ],
    };
  }, [
    report.soCVChuaBatDau,
    report.soCVDangLam,
    report.soCVHoanThanh,
    report.soCVTreHan,
  ]);

  const barOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top" as const, labels: { usePointStyle: true } },
        tooltip: {
          callbacks: {
            label: (ctx: any) => `${ctx.dataset.label}: ${ctx.parsed.y}%`,
          },
        },
      },
      scales: {
        x: {
          ticks: {
            precision: 0,
          },
          grid: {
            drawBorder: false,
            color: "rgba(148, 163, 184, 0.2)",
          },
        },
        y: {
          grid: {
            drawBorder: false,
            color: "rgba(148, 163, 184, 0.2)",
          },
        },
      },
    };
  }, []);

  const horizontalBarOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y" as const,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: any) => `${ctx.label}: ${ctx.parsed.x} ngày`,
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            precision: 0,
          },
          grid: {
            drawBorder: false,
            color: "rgba(148, 163, 184, 0.2)",
          },
        },
        y: {
          grid: {
            drawBorder: false,
            color: "rgba(148, 163, 184, 0.2)",
          },
        },
      },
    };
  }, []);

  const [showDetailedMetrics, setShowDetailedMetrics] = useState(false);
  const [showMemberStats, setShowMemberStats] = useState(false);

  // Đánh giá mức độ cảnh báo
  const alertLevel = useMemo(() => {
    // Nếu dự án đã hoàn thành 100% thì không cần cảnh báo
    if (adjustedReport.phanTramHoanThanh >= 100) {
      return { type: "excellent", label: "✅ Hoàn thành", color: "#10b981" };
    }

    // Ưu tiên cao nhất: Có công việc trễ hạn
    if (adjustedReport.soCVTreHan > 0) {
      return { type: "critical", label: "⚠️ Cần chú ý", color: "#dc2626" };
    }

    // Ưu tiên thứ 2: Đánh giá theo tiến độ thực tế
    const chenhLech =
      adjustedReport.tienDoThucTe - adjustedReport.phanTramHoanThanh;

    if (chenhLech >= 15) {
      return { type: "excellent", label: "🌟 Xuất sắc", color: "#8b5cf6" };
    }
    if (chenhLech >= 5) {
      return { type: "great", label: "🚀 Vượt tiến độ", color: "#06b6d4" };
    }
    if (chenhLech <= -15) {
      return { type: "critical", label: "⚠️ Cần chú ý", color: "#dc2626" };
    }
    if (chenhLech <= -5) {
      return { type: "warning", label: "⏰ Cần theo dõi", color: "#f59e0b" };
    }

    // Tiến độ đúng hẹn (chênh lệch trong khoảng -5 đến 5)
    // Ưu tiên cảnh báo thời gian nếu sắp hết hạn
    if (adjustedReport.soNgayConLai <= 7 && adjustedReport.soNgayConLai > 0) {
      return { type: "warning", label: "⏰ Sắp hết hạn", color: "#f59e0b" };
    }

    // Nếu tiến độ đúng hẹn và không sắp hết hạn
    return { type: "good", label: "✅ Đúng tiến độ", color: "#10b981" };
  }, [adjustedReport]);

  return (
    <div className={styles.reportSection}>
      <div className={styles.reportHeader}>
        <div>
          <h2 className={styles.title}>{project.tenDuAn}</h2>
          <p className={styles.subtitle}>
            Cập nhật: {formatDate(report.ngayCapNhatBaoCao)}
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          {userRole?.toLowerCase() !== "thành viên" && (
            <button
              className={styles.exportButton}
              onClick={exportToExcel}
              disabled={isExporting}
              title="Xuất báo cáo Excel đầy đủ"
            >
              <FontAwesomeIcon icon={faFileExcel} />
              <span>{isExporting ? "Đang xuất..." : "Xuất Excel"}</span>
            </button>
          )}
          <div
            className={styles.alertBadge}
            style={{ backgroundColor: alertLevel.color }}
          >
            <FontAwesomeIcon icon={faGaugeHigh} />
            <span>{alertLevel.label}</span>
          </div>
        </div>
      </div>

      {/* PHẦN 1: TỔNG QUAN QUAN TRỌNG NHẤT */}
      <div className={styles.statsGrid}>
        <div className={`${styles.statCard} ${styles.large}`}>
          <div className={styles.statIcon}>
            <FontAwesomeIcon icon={faChartPie} size="2x" />
          </div>
          <div className={styles.statContent}>
            <div className={styles.statLabel}>
              Tiến độ hoàn thành (Kế hoạch)
            </div>
            <div className={styles.statValue}>{report.phanTramHoanThanh}%</div>
            <div className={styles.progressComparison}>
              <span
                className={
                  report.tienDoThucTe >= report.phanTramHoanThanh
                    ? styles.ahead
                    : styles.behind
                }
              >
                Thực tế: {report.tienDoThucTe}%
              </span>
            </div>
          </div>
        </div>

        <div
          className={`${styles.statCard} ${adjustedReport.soCVTreHan > 0 ? styles.danger : styles.success}`}
        >
          <div className={styles.statIcon}>
            <FontAwesomeIcon
              icon={
                adjustedReport.soCVTreHan > 0 ? faTriangleExclamation : faTasks
              }
              size="2x"
            />
          </div>
          <div className={styles.statContent}>
            <div className={styles.statLabel}>Công việc</div>
            <div className={styles.statValue}>{report.tongSoCV}</div>
            <div className={styles.statBreakdown}>
              <span className={styles.completed}>✓ {report.soCVHoanThanh}</span>
              <span className={styles.inProgress}>⟳ {report.soCVDangLam}</span>
              {adjustedReport.soCVTreHan > 0 && (
                <span className={styles.delayed}>
                  ⚠ {adjustedReport.soCVTreHan}
                </span>
              )}
            </div>
          </div>
        </div>

        <div
          className={`${styles.statCard} ${report.soNgayConLai <= 7 ? styles.warning : styles.info}`}
        >
          <div className={styles.statIcon}>
            <FontAwesomeIcon icon={faClock} size="2x" />
          </div>
          <div className={styles.statContent}>
            <div className={styles.statLabel}>Thời gian còn lại</div>
            <div className={styles.statValue}>{report.soNgayConLai}</div>
            <div className={styles.statSubtext}>ngày</div>
          </div>
        </div>
      </div>

      {/* PHẦN 2: BIỂU ĐỒ CHÍNH - CHỈ 2 BIỂU ĐỒ QUAN TRỌNG NHẤT */}
      {hasWorkData ? (
        <div className={styles.mainChartsGrid}>
          <div className={styles.chartCard}>
            <h3>
              <FontAwesomeIcon icon={faChartPie} /> Phân bố trạng thái công việc
            </h3>
            <div className={styles.chartWrapper}>
              <Pie
                data={statusPieData}
                options={{
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: "right" as const,
                      labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: { size: 13 },
                      },
                    },
                  },
                }}
              />
            </div>
          </div>
          <div className={styles.chartCard}>
            <h3>
              <FontAwesomeIcon icon={faChartLine} /> So sánh tiến độ (Kế hoạch
              vs Thực tế)
            </h3>
            <div className={styles.chartWrapper}>
              <Bar data={progressComparisonData} options={barOptions} />
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.reportStatus}>
          Chưa có công việc nào để hiển thị biểu đồ.
        </div>
      )}

      {/* PHẦN 3: CHI TIẾT NÂNG CAO (TÙY CHỌN) */}
      <div className={styles.collapsibleSection}>
        <button
          className={styles.collapsibleToggle}
          onClick={() => setShowDetailedMetrics(!showDetailedMetrics)}
        >
          <FontAwesomeIcon icon={faInfoCircle} />
          <span>Chi tiết thống kê nâng cao</span>
          <FontAwesomeIcon
            icon={showDetailedMetrics ? faChartLine : faChartLine}
            rotation={showDetailedMetrics ? 180 : undefined}
          />
        </button>

        {showDetailedMetrics && (
          <div className={styles.collapsibleContent}>
            <div className={styles.detailedChartsGrid}>
              <div className={styles.chartCard}>
                <h4>Các chỉ số thời gian</h4>
                <div className={styles.chartWrapper}>
                  <Bar data={timeMetricsData} options={horizontalBarOptions} />
                </div>
              </div>
              <div className={styles.chartCard}>
                <h4>Tỷ lệ công việc đã bắt đầu</h4>
                <div className={styles.chartWrapper}>
                  <Doughnut
                    data={taskReadinessData}
                    options={{
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: "bottom" as const,
                          labels: { usePointStyle: true },
                        },
                        tooltip: {
                          callbacks: {
                            label: (ctx: any) => `${ctx.label}: ${ctx.parsed}`,
                          },
                        },
                      },
                    }}
                  />
                </div>
              </div>
            </div>

            <div className={styles.metricsCard}>
              <div className={styles.metricsCompact}>
                <section>
                  <h4 className={styles.metricTitle}>
                    <FontAwesomeIcon icon={faCalendarDay} /> Cột mốc quan trọng
                  </h4>
                  <div className={styles.metricList}>
                    <div className={styles.metric}>
                      <span className={styles.metricLabel}>
                        Bắt đầu sớm nhất
                      </span>
                      <span className={styles.metricValue}>
                        {formatDate(report.ngayBatDauSomNhatCuaCongViec)}
                      </span>
                    </div>
                    <div className={styles.metric}>
                      <span className={styles.metricLabel}>
                        Kết thúc muộn nhất
                      </span>
                      <span className={styles.metricValue}>
                        {formatDate(report.ngayKetThucMuonNhatCuaCongViec)}
                      </span>
                    </div>
                  </div>
                </section>

                <section>
                  <h4 className={styles.metricTitle}>
                    <FontAwesomeIcon icon={faInfoCircle} /> Đánh giá
                  </h4>
                  <div
                    className={styles.assessmentBadge}
                    style={{ borderColor: alertLevel.color }}
                  >
                    {report.danhGiaTienDo}
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PHẦN 4: THỐNG KÊ THÀNH VIÊN (TÙY CHỌN) */}
      <div className={styles.collapsibleSection}>
        <button
          className={styles.collapsibleToggle}
          onClick={() => setShowMemberStats(!showMemberStats)}
        >
          <FontAwesomeIcon icon={faUsers} />
          <span>Thống kê hiệu suất thành viên</span>
          <FontAwesomeIcon
            icon={faChartLine}
            rotation={showMemberStats ? 180 : undefined}
          />
        </button>

        {showMemberStats && (
          <div className={styles.collapsibleContent}>
            <div className={styles.memberStatsCard}>
              <div className={styles.memberStatsHeader}>
                <div>
                  <h3>{memberStatsHeading}</h3>
                  <p className={styles.memberStatsSubtitle}>
                    Dữ liệu dựa trên thống kê công việc của dự án.
                  </p>
                </div>
                <div className={styles.memberStatsControls}>
                  <div className={styles.memberStatsToggleGroup}>
                    <button
                      type="button"
                      className={`${styles.memberStatsToggle} ${
                        memberStatsType === "NhieuNhat" ? styles.active : ""
                      }`}
                      onClick={() => onMemberStatsTypeChange("NhieuNhat")}
                    >
                      Nhiều nhất
                    </button>
                    <button
                      type="button"
                      className={`${styles.memberStatsToggle} ${
                        memberStatsType === "ItNhat" ? styles.active : ""
                      }`}
                      onClick={() => onMemberStatsTypeChange("ItNhat")}
                    >
                      Ít nhất
                    </button>
                  </div>
                  <label className={styles.memberStatsSelectWrapper}>
                    Top
                    <select
                      value={memberStatsTop}
                      onChange={(event) =>
                        onMemberStatsTopChange(Number(event.target.value))
                      }
                    >
                      {topOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              {memberStatsLoading ? (
                <div className={styles.memberStatsStatus}>
                  Đang tải thống kê...
                </div>
              ) : memberStatsError ? (
                <div className={styles.memberStatsError}>
                  {memberStatsError}
                </div>
              ) : memberStatsList.length === 0 ? (
                <div className={styles.memberStatsStatus}>
                  Chưa có dữ liệu thống kê thành viên.
                </div>
              ) : (
                <ul className={styles.memberStatsList}>
                  {memberStatsList.map((stat) => (
                    <li
                      key={stat.thanhVienID}
                      className={styles.memberStatItem}
                    >
                      <div className={styles.memberStatHeader}>
                        <span className={styles.memberStatName}>
                          {stat.hoTen}
                        </span>
                        {stat.mucDoHoatDong && (
                          <span className={styles.memberStatBadge}>
                            {stat.mucDoHoatDong}
                          </span>
                        )}
                      </div>
                      <div className={styles.memberStatDetails}>
                        <span>
                          Nhiệm vụ: <strong>{stat.soLuongCongViec}</strong>
                        </span>
                        <span>
                          Subtask hoàn thành:{" "}
                          <strong>{stat.soLuongHoanThanh ?? 0}</strong>
                        </span>
                        <span>
                          TB % hoàn thành subtask:{" "}
                          <strong>{(stat.trungBinhHT ?? 0).toFixed(1)}%</strong>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportTab;
