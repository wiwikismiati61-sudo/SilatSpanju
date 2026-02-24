
import React, { useMemo, useState, useRef } from 'react';
import { Users, UserX, Clock, CalendarCheck, PhoneCall, CheckCircle2, Edit2, Trash2, Download, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { AppData, Student, AttendanceRecord } from '../types';

interface Props {
  data: AppData;
  currentTime: Date;
  isLoggedIn?: boolean;
  updateData?: (newData: Partial<AppData> | AppData) => void;
}

const DashboardView: React.FC<Props> = ({ data, currentTime, isLoggedIn, updateData }) => {
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editForm, setEditForm] = useState({ time: '', status: 'Terlambat', reason: '' });
  const [selectedDate, setSelectedDate] = useState<string>(currentTime.toISOString().split('T')[0]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const today = currentTime.toISOString().split('T')[0];
  const attendance = data.attendance || [];
  const students = data.students || [];

  const todayAttendance = attendance.filter(r => r.date && r.date.startsWith(today));
  const lateCount = todayAttendance.filter(r => r.status === 'Terlambat').length;
  const onTimeCount = todayAttendance.filter(r => r.status === 'Tepat Waktu').length;

  const parentCallList = useMemo(() => {
    const lateRecords = attendance.filter(r => r.status === 'Terlambat');
    const lateCounts: Record<string, number> = {};

    lateRecords.forEach(record => {
      lateCounts[record.studentId] = (lateCounts[record.studentId] || 0) + 1;
    });

    return Object.entries(lateCounts)
      .filter(([, count]) => count > 2)
      .map(([studentId, count]) => {
        const student = students.find(s => s.id === studentId);
        return student ? { ...student, lateCount: count } : null;
      })
      .filter((item): item is Student & { lateCount: number } => item !== null)
      .sort((a, b) => b.lateCount - a.lateCount);
  }, [attendance, students]);

  const handleDelete = (id: string) => {
    if (confirm("Hapus data absensi ini?")) {
      if (updateData) {
        updateData({ attendance: data.attendance.filter(r => r.id !== id) });
      }
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRecord && updateData) {
      updateData({
        attendance: data.attendance.map(r => 
          r.id === editingRecord.id 
            ? { ...r, time: editForm.time, status: editForm.status as 'Tepat Waktu' | 'Terlambat', reason: editForm.reason } 
            : r
        )
      });
      setEditingRecord(null);
    }
  };

  const weeklyData = useMemo(() => {
    const now = new Date(selectedDate);
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // adjust when day is sunday
    const startOfWeek = new Date(now.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const weeklyRecords = attendance.filter(r => {
      const recordDate = new Date(r.date);
      return recordDate >= startOfWeek && recordDate <= endOfWeek && r.status === 'Terlambat';
    });

    const report: Record<string, { studentName: string, className: string, count: number, latestTime: string }[]> = {
      '7': [], '8': [], '9': []
    };

    const grouped: Record<string, Record<string, { studentName: string, className: string, count: number, latestTime: string }>> = {
      '7': {}, '8': {}, '9': {}
    };

    weeklyRecords.forEach(record => {
      const grade = record.className.charAt(0);
      if (grouped[grade]) {
        const studentId = record.studentId || record.studentName;
        if (!grouped[grade][studentId]) {
          grouped[grade][studentId] = {
            studentName: record.studentName,
            className: record.className,
            count: 0,
            latestTime: record.time
          };
        }
        grouped[grade][studentId].count++;
        // Keep the latest time or the first time encountered
        if (record.time && record.time !== '00:00') {
           // If latestTime is empty or '00:00', or if the new time is later
           if (!grouped[grade][studentId].latestTime || grouped[grade][studentId].latestTime === '00:00' || record.time > grouped[grade][studentId].latestTime) {
               grouped[grade][studentId].latestTime = record.time;
           }
        }
      }
    });

    Object.keys(grouped).forEach(grade => {
      report[grade] = Object.values(grouped[grade]).sort((a, b) => b.count - a.count);
    });

    return { report, rawRecords: weeklyRecords };
  }, [attendance, selectedDate]);

  const downloadWeeklyReport = () => {
    const allRecords = weeklyData.rawRecords;
    
    if (allRecords.length === 0) {
      alert('Tidak ada data keterlambatan untuk minggu ini.');
      return;
    }

    const excelData = allRecords.map(r => ({
      'Tanggal': new Date(r.date).toLocaleDateString('id-ID'),
      'Waktu': r.time,
      'Nama Siswa': r.studentName,
      'Kelas': r.className,
      'Alasan': r.reason || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Mingguan");
    XLSX.writeFile(wb, `Laporan_Mingguan_Terlambat_${new Date(selectedDate).toLocaleDateString('id-ID').replace(/\//g, '-')}.xlsx`);
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const excelData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        const importedRecords: AttendanceRecord[] = [];
        
        if (excelData.length > 1) {
          const headers = excelData[0].map(h => String(h).toLowerCase());
          const dateIdx = headers.findIndex(h => h.includes('tanggal') || h.includes('date'));
          const timeIdx = headers.findIndex(h => h.includes('waktu') || h.includes('time'));
          const nameIdx = headers.findIndex(h => h.includes('nama') || h.includes('name') || h.includes('siswa'));
          const classIdx = headers.findIndex(h => h.includes('kelas') || h.includes('class'));
          const reasonIdx = headers.findIndex(h => h.includes('alasan') || h.includes('reason'));

          excelData.slice(1).forEach(row => {
            if (row.length === 0) return;
            
            let dateStr = new Date().toISOString();
            if (dateIdx !== -1 && row[dateIdx]) {
              const d = row[dateIdx];
              if (typeof d === 'number') {
                 const date = new Date((d - (25567 + 1)) * 86400 * 1000);
                 dateStr = date.toISOString();
              } else {
                 const parts = String(d).split(/[-/]/);
                 if (parts.length === 3) {
                   if (parts[2].length === 4) {
                     dateStr = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).toISOString();
                   } else {
                     dateStr = new Date(String(d)).toISOString();
                   }
                 } else {
                   dateStr = new Date(String(d)).toISOString();
                 }
              }
            }

            const name = nameIdx !== -1 ? String(row[nameIdx] || '') : '';
            const className = classIdx !== -1 ? String(row[classIdx] || '') : '';
            let time = '00:00';
            if (timeIdx !== -1 && row[timeIdx] !== undefined && row[timeIdx] !== null) {
                const t = row[timeIdx];
                if (typeof t === 'number') {
                    // Excel time is a fraction of a day
                    const totalSeconds = Math.round(t * 86400);
                    const hours = Math.floor(totalSeconds / 3600);
                    const minutes = Math.floor((totalSeconds % 3600) / 60);
                    time = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                } else if (typeof t === 'string') {
                    // Handle string time like "08:03" or "08:03:00"
                    const timeParts = t.split(':');
                    if (timeParts.length >= 2) {
                        time = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}`;
                    } else {
                        time = t;
                    }
                } else {
                    time = String(t);
                }
            }
            const reason = reasonIdx !== -1 ? String(row[reasonIdx] || '') : '';

            if (name && className) {
              const student = students.find(s => s.name.toLowerCase() === name.toLowerCase() && s.className.toLowerCase() === className.toLowerCase());
              
              importedRecords.push({
                id: crypto.randomUUID(),
                studentId: student ? student.id : `imported-${crypto.randomUUID()}`,
                studentName: name,
                className: className,
                date: dateStr,
                time: time,
                status: 'Terlambat',
                reason: reason
              });
            }
          });
        }

        if (importedRecords.length > 0 && updateData) {
          updateData({ attendance: [...data.attendance, ...importedRecords] });
          alert(`Berhasil mengimpor ${importedRecords.length} data keterlambatan.`);
        } else {
          alert('Tidak ada data valid yang ditemukan untuk diimpor. Pastikan format kolom sesuai (Tanggal, Waktu, Nama Siswa, Kelas, Alasan).');
        }
      } catch (err) {
        console.error(err);
        alert("Gagal membaca file Excel (.xlsx). Pastikan formatnya sesuai.");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Ringkasan Hari Ini</h2>
          <p className="text-slate-500">Pantau kehadiran siswa secara real-time</p>
        </div>
        <div className="px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-3">
          <CalendarCheck className="text-indigo-600" size={20} />
          <span className="text-indigo-900 font-semibold">{currentTime.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          icon={<Users className="text-blue-600" />}
          label="Total Siswa"
          value={students.length}
          color="bg-blue-50"
        />
        <StatCard 
          icon={<UserX className="text-rose-600" />}
          label="Terlambat Hari Ini"
          value={lateCount}
          color="bg-rose-50"
        />
        <StatCard 
          icon={<Clock className="text-emerald-600" />}
          label="Tepat Waktu"
          value={onTimeCount}
          color="bg-emerald-50"
        />
        <StatCard 
          icon={<PhoneCall className="text-orange-600" />}
          label="Panggilan Ortu"
          value={parentCallList.length}
          color="bg-orange-50"
        />
      </div>

      {/* Parent Call Report */}
      <div className="bg-white border border-rose-100 rounded-2xl shadow-sm">
        <div className="p-6 border-b border-rose-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 flex items-center justify-center bg-rose-50 text-rose-600 rounded-xl">
                    <PhoneCall size={24}/>
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-900">Report Panggilan Orang Tua</h3>
                    <p className="text-sm text-slate-500">Daftar siswa dengan keterlambatan lebih dari 2 kali.</p>
                </div>
            </div>
            <span className="px-3 py-1 bg-rose-600 text-white text-xs font-bold rounded-full uppercase">Penting</span>
        </div>
        {parentCallList.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-700 font-bold">
                    <tr>
                        <th className="px-6 py-4">Nama Siswa</th>
                        <th className="px-6 py-4">Kelas</th>
                        <th className="px-6 py-4 text-center">Jumlah Terlambat</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {parentCallList.map(student => (
                        <tr key={student.id} className="hover:bg-rose-50/50 transition-colors">
                            <td className="px-6 py-4 font-bold text-slate-900">{student.name}</td>
                            <td className="px-6 py-4">
                                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md font-semibold text-xs">{student.className}</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                                <span className="text-lg font-black text-rose-600">{student.lateCount} kali</span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>
        ) : (
            <div className="text-center py-16 px-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full mb-4">
                    <CheckCircle2 size={32} />
                </div>
                <p className="text-slate-500 font-semibold">Tidak ada siswa yang perlu dipanggil saat ini.</p>
            </div>
        )}
      </div>

      {/* Weekly Report Section */}
      <div className="bg-white border border-indigo-100 rounded-2xl shadow-sm">
        <div className="p-6 border-b border-indigo-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-xl">
              <CalendarCheck size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Laporan Mingguan Terlambat</h3>
              <p className="text-sm text-slate-500">Rekap siswa terlambat minggu ini (Kelas 7, 8, 9).</p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <input 
              type="date" 
              className="px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
            {isLoggedIn && (
              <>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 transition shadow-sm whitespace-nowrap"
                >
                  <Upload size={18} className="mr-2" /> Import Excel
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls" onChange={handleImportExcel} />
              </>
            )}
            <button 
              onClick={downloadWeeklyReport}
              className="flex items-center justify-center px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition shadow-sm whitespace-nowrap"
            >
              <Download size={18} className="mr-2" /> Download Excel
            </button>
          </div>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {['7', '8', '9'].map(grade => {
            const students = weeklyData.report[grade];
            const totalLate = students.reduce((sum, s) => sum + s.count, 0);
            return (
            <div key={grade} className="border border-slate-100 rounded-xl p-4 bg-slate-50 flex flex-col h-full">
              <div className="flex justify-between items-center mb-3 border-b border-slate-200 pb-2">
                <h4 className="font-bold text-slate-800">Kelas {grade}</h4>
                <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">{totalLate} Terlambat</span>
              </div>
              {students.length > 0 ? (
                <ul className="space-y-2 max-h-64 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
                  {students.map((student, idx) => (
                    <li key={idx} className="text-sm flex justify-between items-center">
                      <span className="font-medium text-slate-700 truncate pr-2" title={student.studentName}>{student.studentName}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs font-mono text-slate-500">{student.latestTime}</span>
                        {student.count > 1 && (
                          <span className="text-xs font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">{student.count}x</span>
                        )}
                        <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded">{student.className}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500 italic text-center py-4">Tidak ada yang terlambat</p>
              )}
            </div>
          )})}
        </div>
      </div>


      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Log Kedatangan Hari Ini</h3>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Terakhir update: {currentTime.toLocaleTimeString('id-ID')}</span>
        </div>
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700 font-bold">
              <tr>
                <th className="px-6 py-4">Tanggal</th>
                <th className="px-6 py-4">Waktu</th>
                <th className="px-6 py-4">Nama Siswa</th>
                <th className="px-6 py-4">Kelas</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Alasan</th>
                {isLoggedIn && <th className="px-6 py-4 text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {todayAttendance.length > 0 ? (
                todayAttendance.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-600">
                      {new Date(record.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-600">{record.time}</td>
                    <td className="px-6 py-4 font-bold text-slate-900">{record.studentName}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md font-semibold text-xs">{record.className}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        record.status === 'Terlambat' 
                          ? 'bg-rose-100 text-rose-700' 
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 italic max-w-xs truncate">{record.reason || '-'}</td>
                    {isLoggedIn && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => {
                              setEditingRecord(record);
                              setEditForm({ time: record.time, status: record.status, reason: record.reason });
                            }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(record.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isLoggedIn ? 7 : 6} className="px-6 py-12 text-center text-slate-400">Belum ada data absensi untuk hari ini.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingRecord && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Edit Data Absensi</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Waktu</label>
                <input 
                  type="time" 
                  required
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  value={editForm.time}
                  onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select 
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none"
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                >
                  <option value="Tepat Waktu">Tepat Waktu</option>
                  <option value="Terlambat">Terlambat</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Alasan</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  value={editForm.reason}
                  onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setEditingRecord(null)} className="flex-1 py-3 border border-slate-200 font-bold rounded-lg">Batal</button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-lg">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color }) => (
  <div className={`p-6 rounded-2xl border border-slate-100 shadow-sm ${color} transition transform hover:-translate-y-1`}>
    <div className="flex items-center gap-4">
      <div className="p-3 bg-white rounded-xl shadow-sm">{icon}</div>
      <div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  </div>
);

export default DashboardView;
