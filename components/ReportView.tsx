
import React, { useState, useMemo, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LabelList
} from 'recharts';
import { Download } from 'lucide-react';
import { AppData, CLASSES, AttendanceRecord } from '../types';
import * as ExcelJS from 'exceljs';

interface Props {
  data: AppData;
  updateData: (newData: Partial<AppData> | AppData) => void;
}

const ALL_CLASSES_OPTION = 'Semua Kelas';

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        // Tooltip untuk grafik harian per kelas
        if (data.names) {
            return (
                <div className="p-3 bg-slate-800 text-white rounded-lg shadow-lg border border-slate-700 text-xs max-w-xs">
                    <p className="font-bold text-sm mb-2">Tanggal: {label}</p>
                    <p className="font-bold mb-1">Total Terlambat: {data.Total}</p>
                    {data.names.length > 0 && (
                        <ul className="list-disc list-inside mt-2 space-y-1">
                            {data.names.map((name: string, index: number) => (
                                <li key={index}>{name}</li>
                            ))}
                        </ul>
                    )}
                </div>
            );
        }
        // Tooltip default untuk grafik "Semua Kelas"
        return (
             <div className="p-3 bg-slate-800 text-white rounded-lg shadow-lg border border-slate-700 text-xs">
                <p className="font-bold">Kelas: {label}</p>
                <p>Total Terlambat: {payload[0].value}</p>
            </div>
        )
    }
    return null;
};


const ReportView: React.FC<Props> = ({ data }) => {
  const [selectedClass, setSelectedClass] = useState(ALL_CLASSES_OPTION);
  const [selectedMonth, setSelectedMonth] = useState('');

  const uniqueMonths = useMemo(() => {
    const months = new Set<string>();
    (data.attendance || []).forEach(record => {
      if (record.date) {
        months.add(record.date.substring(0, 7)); // Format YYYY-MM
      }
    });
    return Array.from(months).sort().reverse(); // Urutkan dari yang terbaru
  }, [data.attendance]);
  
  useEffect(() => {
    if (uniqueMonths.length > 0 && !selectedMonth) {
      setSelectedMonth(uniqueMonths[0]);
    }
  }, [uniqueMonths, selectedMonth]);

  const monthlyLateRecords = useMemo(() => {
    if (!selectedMonth) return [];
    return (data.attendance || [])
      .filter(r => r.status === 'Terlambat' && r.date.startsWith(selectedMonth));
  }, [data.attendance, selectedMonth]);

  const lateStudentsInClass = useMemo(() => {
    const records = selectedClass === ALL_CLASSES_OPTION 
      ? monthlyLateRecords 
      : monthlyLateRecords.filter(r => r.className === selectedClass);
    
    return records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [monthlyLateRecords, selectedClass]);
  
  const groupedLateStudents = useMemo(() => {
    const groups: Record<string, AttendanceRecord[]> = {};
    lateStudentsInClass.forEach(record => {
      if (!groups[record.studentName]) {
        groups[record.studentName] = [];
      }
      groups[record.studentName].push(record);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [lateStudentsInClass]);

  const chartData = useMemo(() => {
    const countsByClass = CLASSES.reduce((acc, className) => {
      acc[className] = 0;
      return acc;
    }, {} as Record<string, number>);

    monthlyLateRecords.forEach(record => {
      if (countsByClass[record.className] !== undefined) {
        countsByClass[record.className]++;
      }
    });

    return Object.entries(countsByClass).map(([name, Total]) => ({ name, Total }));
  }, [monthlyLateRecords]);
  
  const dailyChartData = useMemo(() => {
    if (selectedClass === ALL_CLASSES_OPTION || !selectedMonth) return [];

    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    const countsByDay: { day: string, Total: number, names: string[] }[] = Array.from({ length: daysInMonth }, (_, i) => ({
        day: (i + 1).toString().padStart(2, '0'),
        Total: 0,
        names: []
    }));

    lateStudentsInClass.forEach(record => {
        const dayIndex = new Date(record.date).getDate() - 1;
        if (countsByDay[dayIndex]) {
            countsByDay[dayIndex].Total++;
            countsByDay[dayIndex].names.push(record.studentName);
        }
    });

    return countsByDay;
  }, [lateStudentsInClass, selectedClass, selectedMonth]);


  const handleExportToExcel = async () => {
    const today = new Date();
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const dateStr = `Pasuruan, ${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`Report ${selectedClass}`);

    // Set column widths
    worksheet.columns = [
      { header: '', key: 'A', width: 40 },
      { header: '', key: 'B', width: 10 },
      { header: '', key: 'C', width: 15 },
      { header: '', key: 'D', width: 10 },
      { header: '', key: 'E', width: 15 },
      { header: '', key: 'F', width: 30 },
    ];

    // Add Logo
    try {
      const logoUrl = "https://iili.io/KDFk4fI.png";
      const response = await fetch(logoUrl);
      const buffer = await response.arrayBuffer();
      const logoId = workbook.addImage({
        buffer: buffer,
        extension: 'png',
      });
      
      // Left Logo
      worksheet.addImage(logoId, {
        tl: { col: 0.2, row: 0.2 },
        ext: { width: 80, height: 80 }
      });
    } catch (e) {
      console.error("Failed to add logo to Excel", e);
    }

    // Header Text
    const headerRows = [
      ["PEMERINTAH KOTA PASURUAN"],
      ["SMP NEGERI 7"],
      ["Jalan Simpang Slamet Riadi Nomor 2, Kota Pasuruan, Jawa Timur, 67139"],
      ["Telepon (0343) 426845"],
      ["Pos-el smp7pas@yahoo.co.id , Laman www.smpn7pasuruan.sch.id"],
    ];

    headerRows.forEach((row, index) => {
      const cell = worksheet.getCell(index + 1, 1);
      cell.value = row[0];
      worksheet.mergeCells(index + 1, 1, index + 1, 6);
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      if (index === 0) cell.font = { size: 14, bold: true };
      if (index === 1) cell.font = { size: 18, bold: true };
      if (index > 1) cell.font = { size: 10 };
      if (index === 4) cell.font = { size: 9, italic: true };
    });

    // Thick Blue Line
    const lineRow = worksheet.getRow(6);
    lineRow.height = 5;
    for (let i = 1; i <= 6; i++) {
      const cell = lineRow.getCell(i);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4A90E2' }
      };
    }

    // Report Title
    const titleCell = worksheet.getCell(8, 1);
    titleCell.value = "Laporan Siswa Terlambat Hadir";
    worksheet.mergeCells(8, 1, 8, 6);
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.font = { size: 24, bold: true };
    worksheet.getRow(8).height = 40;

    // Table Headers
    const headerRow = worksheet.getRow(10);
    const headers = ["NAMA SISWA", "KELAS", "TANGGAL", "JAM", "STATUS", "ALASAN"];
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4A90E2' }
      };
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
    headerRow.height = 25;

    // Table Data
    lateStudentsInClass.forEach((record, index) => {
      const row = worksheet.getRow(11 + index);
      const rowData = [
        record.studentName.toUpperCase(),
        record.className,
        new Date(record.date).toISOString().split('T')[0],
        record.time,
        record.status,
        record.reason || '-'
      ];
      
      rowData.forEach((val, i) => {
        const cell = row.getCell(i + 1);
        cell.value = val;
        cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        // Alternating row colors
        if (index % 2 === 1) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF0F8FF' }
          };
        }
      });
    });

    // Auto Filter
    worksheet.autoFilter = {
      from: { row: 10, column: 1 },
      to: { row: 10 + lateStudentsInClass.length, column: 6 }
    };

    // Signature Section
    const footerStartRow = 11 + lateStudentsInClass.length + 2;
    
    // Mengetahui
    worksheet.getCell(footerStartRow, 1).value = "Mengetahui";
    worksheet.getCell(footerStartRow + 1, 1).value = "Kepala Sekolah";
    worksheet.getCell(footerStartRow + 5, 1).value = "NUR FADILAH, S.Pd";
    worksheet.getCell(footerStartRow + 5, 1).font = { bold: true, underline: true };
    worksheet.getCell(footerStartRow + 6, 1).value = "NIP. 19860410 201001 2 030";

    // Guru BK
    worksheet.getCell(footerStartRow, 5).value = dateStr;
    worksheet.getCell(footerStartRow + 1, 5).value = "Guru BK";
    worksheet.getCell(footerStartRow + 5, 5).value = "WIWIK ISMIATI, S.Pd";
    worksheet.getCell(footerStartRow + 5, 5).font = { bold: true, underline: true };
    worksheet.getCell(footerStartRow + 6, 5).value = "NIP. 19831116 200904 2 003";

    // Center signature text
    for (let r = footerStartRow; r <= footerStartRow + 6; r++) {
      worksheet.getCell(r, 1).alignment = { horizontal: 'center' };
      worksheet.getCell(r, 5).alignment = { horizontal: 'center' };
      worksheet.mergeCells(r, 1, r, 2);
      worksheet.mergeCells(r, 5, r, 6);
    }

    // Generate and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `Report_Terlambat_${selectedClass}_${selectedMonth}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Report Siswa Terlambat</h2>
          <p className="text-slate-500 text-xs sm:text-sm">Rekapitulasi keterlambatan siswa per kelas</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={handleExportToExcel}
            className="flex items-center justify-center px-3 sm:px-4 py-1.5 sm:py-2 bg-emerald-600 text-white rounded-lg font-bold text-xs sm:text-sm hover:bg-emerald-700 transition shadow-lg shadow-emerald-100"
          >
            <Download size={16} className="mr-1.5 sm:mr-2 sm:w-[18px] sm:h-[18px]" /> Download (.xlsx)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-1 border-2 border-slate-200 bg-white rounded-xl overflow-hidden">
          <div className="p-3 sm:p-4 bg-slate-900 text-white font-black text-lg sm:text-xl text-center tracking-wider">
            REPORT SISWA TERLAMBAT
          </div>
          <div className="p-3 sm:p-4 border-b border-slate-200 space-y-3 sm:space-y-4">
            <div>
              <label htmlFor="month-filter" className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5 sm:mb-2">Pilih Bulan</label>
              <select
                id="month-filter"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full p-1.5 sm:p-2 border border-slate-300 rounded-md font-bold text-xs sm:text-sm"
              >
                {uniqueMonths.map(month => {
                  const date = new Date(`${month}-02`); // Use day 2 to avoid timezone issue
                  const monthName = date.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
                  return <option key={month} value={month}>{monthName}</option>
                })}
              </select>
            </div>
            <div>
              <label htmlFor="class-filter" className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5 sm:mb-2">Kelas</label>
              <select
                id="class-filter"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full p-1.5 sm:p-2 border border-slate-300 rounded-md font-bold text-xs sm:text-sm"
              >
                <option value={ALL_CLASSES_OPTION}>{ALL_CLASSES_OPTION}</option>
                {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="p-3 sm:p-4">
            <div className="flex justify-between font-bold bg-slate-200 p-1.5 sm:p-2 border-b-2 border-slate-300 text-xs sm:text-sm">
              <span>NAMA SISWA</span>
              <span>Jumlah</span>
            </div>
            <div className="max-h-[300px] sm:max-h-[400px] overflow-y-auto">
              {groupedLateStudents.length > 0 ? groupedLateStudents.map(([studentName, records]) => (
                <div key={studentName} className="border-b border-slate-200 last:border-b-0">
                  <div className="flex justify-between items-center p-1.5 sm:p-2 bg-blue-50">
                    <p className="font-bold text-blue-800 uppercase text-[10px] sm:text-sm">{studentName}</p>
                    <span className="px-1.5 sm:px-2 py-0.5 bg-blue-600 text-white text-[10px] sm:text-xs font-bold rounded-full">{records.length}</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {records.map(record => (
                      <div key={record.id} className="pl-4 sm:pl-6 pr-2 py-1.5 sm:py-2 text-[10px] sm:text-xs text-slate-600 space-y-0.5">
                        <p className="italic text-slate-800">"{record.reason || 'Tidak ada alasan'}"</p>
                        <p className="font-semibold text-rose-600">{record.status} ({record.className})</p>
                        <p>{new Date(record.date).toISOString().split('T')[0]}</p>
                        <p>{record.time}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )) : (
                <div className="text-center py-6 sm:py-10 text-xs sm:text-sm text-slate-400">
                  Tidak ada data keterlambatan untuk filter ini.
                </div>
              )}
            </div>
            <div className="flex justify-between font-black bg-slate-200 p-1.5 sm:p-2 border-t-2 border-slate-300 mt-2 text-xs sm:text-sm">
              <span>Total Siswa Terlambat</span>
              <span>{groupedLateStudents.length}</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-[#2E5C3B] p-4 sm:p-6 rounded-xl shadow-lg">
          <h3 className="text-lg sm:text-2xl font-bold text-white mb-4 sm:mb-6">
            {selectedClass === ALL_CLASSES_OPTION
              ? `Total Keterlambatan Bulan ${selectedMonth ? new Date(`${selectedMonth}-02`).toLocaleString('id-ID', { month: 'long', year: 'numeric' }) : ''}`
              : `Grafik Keterlambatan Harian Kelas ${selectedClass}`
            }
          </h3>
          <div className="h-64 sm:h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={selectedClass === ALL_CLASSES_OPTION ? chartData : dailyChartData}
                margin={{ top: 20, right: 10, left: -10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.2)" vertical={false}/>
                <XAxis 
                  dataKey={selectedClass === ALL_CLASSES_OPTION ? "name" : "day"} 
                  tick={{ fill: 'white', fontSize: 10 }} 
                  axisLine={false} 
                  tickLine={false} 
                  interval={0}
                  angle={selectedClass === ALL_CLASSES_OPTION ? -45 : 0}
                  textAnchor={selectedClass === ALL_CLASSES_OPTION ? "end" : "middle"}
                  height={selectedClass === ALL_CLASSES_OPTION ? 60 : 30}
                />
                <YAxis 
                  tick={{ fill: 'white', fontSize: 12 }} 
                  axisLine={false} 
                  tickLine={false} 
                  allowDecimals={false}
                />
                <Tooltip 
                  cursor={{fill: 'rgba(255, 255, 255, 0.1)'}}
                  content={<CustomTooltip />}
                />
                <Bar dataKey="Total" fill="#4A90E2" barSize={selectedClass === ALL_CLASSES_OPTION ? 20 : 15} radius={[4, 4, 0, 0]}>
                  <LabelList 
                    dataKey="Total" 
                    position="top" 
                    style={{ fill: 'white', fontSize: '12px', fontWeight: 'bold' }} 
                    formatter={(value: number) => (value > 0 ? value : '')}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportView;
