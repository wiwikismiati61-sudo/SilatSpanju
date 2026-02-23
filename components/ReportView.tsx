
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


  const handleExportToExcel = () => {
    const reportSheetData = lateStudentsInClass.map(record => ({
      "NAMA SISWA": record.studentName,
      "KELAS": record.className,
      "TANGGAL": new Date(record.date).toISOString().split('T')[0],
      "JAM": record.time,
      "STATUS": record.status,
      "ALASAN": record.reason || '-',
    }));
    
    const chartSheetData = chartData.map(item => ({
      'Kelas': item.name,
      'Jumlah Terlambat': item.Total
    }));

    // @ts-ignore
    const reportWS = XLSX.utils.json_to_sheet(reportSheetData);
    // @ts-ignore
    const chartWS = XLSX.utils.json_to_sheet(chartSheetData);
    // @ts-ignore
    const wb = XLSX.utils.book_new();
    // @ts-ignore
    XLSX.utils.book_append_sheet(wb, reportWS, `Report ${selectedClass}`);
    // @ts-ignore
    XLSX.utils.book_append_sheet(wb, chartWS, "Rekap Total per Kelas");
    // @ts-ignore
    XLSX.writeFile(wb, `Report_Terlambat_${selectedClass}_${selectedMonth}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Report Siswa Terlambat</h2>
          <p className="text-slate-500 text-sm">Rekapitulasi keterlambatan siswa per kelas</p>
        </div>
        <button 
          onClick={handleExportToExcel}
          className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 transition shadow-lg shadow-emerald-100"
        >
          <Download size={18} className="mr-2" /> Download Laporan (.xlsx)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 border-2 border-slate-200 bg-white">
          <div className="p-4 bg-slate-900 text-white font-black text-xl text-center tracking-wider">
            REPORT SISWA TERLAMBAT
          </div>
          <div className="p-4 border-b border-slate-200 space-y-4">
            <div>
              <label htmlFor="month-filter" className="block text-sm font-bold text-slate-700 mb-2">Pilih Bulan</label>
              <select
                id="month-filter"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-md font-bold"
              >
                {uniqueMonths.map(month => {
                  const date = new Date(`${month}-02`); // Use day 2 to avoid timezone issue
                  const monthName = date.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
                  return <option key={month} value={month}>{monthName}</option>
                })}
              </select>
            </div>
            <div>
              <label htmlFor="class-filter" className="block text-sm font-bold text-slate-700 mb-2">Kelas</label>
              <select
                id="class-filter"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-md font-bold"
              >
                <option value={ALL_CLASSES_OPTION}>{ALL_CLASSES_OPTION}</option>
                {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="p-4">
            <div className="flex justify-between font-bold bg-slate-200 p-2 border-b-2 border-slate-300">
              <span>NAMA SISWA</span>
              <span>Jumlah</span>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {groupedLateStudents.length > 0 ? groupedLateStudents.map(([studentName, records]) => (
                <div key={studentName} className="border-b border-slate-200 last:border-b-0">
                  <div className="flex justify-between items-center p-2 bg-blue-50">
                    <p className="font-bold text-blue-800 uppercase text-sm">{studentName}</p>
                    <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-bold rounded-full">{records.length}</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {records.map(record => (
                      <div key={record.id} className="pl-6 pr-2 py-2 text-xs text-slate-600 space-y-0.5">
                        <p className="italic text-slate-800">"{record.reason || 'Tidak ada alasan'}"</p>
                        <p className="font-semibold text-rose-600">{record.status} ({record.className})</p>
                        <p>{new Date(record.date).toISOString().split('T')[0]}</p>
                        <p>{record.time}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )) : (
                <div className="text-center py-10 text-sm text-slate-400">
                  Tidak ada data keterlambatan untuk filter ini.
                </div>
              )}
            </div>
            <div className="flex justify-between font-black bg-slate-200 p-2 border-t-2 border-slate-300 mt-2">
              <span>Total Siswa Terlambat</span>
              <span>{groupedLateStudents.length}</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-[#2E5C3B] p-6 rounded-xl shadow-lg">
          <h3 className="text-2xl font-bold text-white mb-6">
            {selectedClass === ALL_CLASSES_OPTION
              ? `Total Keterlambatan Bulan ${selectedMonth ? new Date(`${selectedMonth}-02`).toLocaleString('id-ID', { month: 'long', year: 'numeric' }) : ''}`
              : `Grafik Keterlambatan Harian Kelas ${selectedClass}`
            }
          </h3>
          <div className="h-96 w-full">
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
