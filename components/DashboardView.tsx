
import React, { useMemo } from 'react';
import { Users, UserX, Clock, CalendarCheck, PhoneCall, CheckCircle2 } from 'lucide-react';
import { AppData, Student } from '../types';

interface Props {
  data: AppData;
  currentTime: Date;
}

const DashboardView: React.FC<Props> = ({ data, currentTime }) => {
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


      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Log Kedatangan Hari Ini</h3>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Terakhir update: {currentTime.toLocaleTimeString('id-ID')}</span>
        </div>
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700 font-bold">
              <tr>
                <th className="px-6 py-4">Waktu</th>
                <th className="px-6 py-4">Nama Siswa</th>
                <th className="px-6 py-4">Kelas</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Alasan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {todayAttendance.length > 0 ? (
                todayAttendance.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50 transition-colors">
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
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">Belum ada data absensi untuk hari ini.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
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
