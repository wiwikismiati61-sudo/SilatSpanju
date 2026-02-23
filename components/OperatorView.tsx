
import React, { useState, useRef } from 'react';
import { 
  UserPlus, 
  Upload, 
  Download, 
  Settings, 
  Database, 
  Trash2, 
  Edit2, 
  Search,
  AlertCircle
} from 'lucide-react';
import { AppData, Student, AttendanceRecord, CLASSES, Tab } from '../types';

interface Props {
  data: AppData;
  updateData: (newData: Partial<AppData> | AppData) => void;
  setActiveTab: (tab: Tab) => void;
}

const OperatorView: React.FC<Props> = ({ data, updateData, setActiveTab }) => {
  const [currentSubTab, setCurrentSubTab] = useState<'students' | 'account' | 'database'>('students');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [newStudent, setNewStudent] = useState({ name: '', className: CLASSES[0] });
  const [accountForm, setAccountForm] = useState({ ...data.user });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  const filteredStudents = (data.students || []).filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (s.className && s.className.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingStudent) {
      updateData({
        students: data.students.map(s => s.id === editingStudent.id ? { ...editingStudent, ...newStudent } : s)
      });
      setEditingStudent(null);
    } else {
      const student: Student = {
        id: crypto.randomUUID(),
        ...newStudent
      };
      updateData({ students: [...data.students, student] });
    }
    setNewStudent({ name: '', className: CLASSES[0] });
    setShowAddModal(false);
  };

  const handleDeleteStudent = (id: string) => {
    if (confirm("Hapus data siswa ini?")) {
      updateData({ students: data.students.filter(s => s.id !== id) });
    }
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        // @ts-ignore
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        // @ts-ignore
        const excelData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        const importedStudents: Student[] = [];
        excelData.slice(1).forEach(row => {
          if (row[0] && row[1]) {
            importedStudents.push({
              id: crypto.randomUUID(),
              name: String(row[0]).trim(),
              className: String(row[1]).trim().toUpperCase()
            });
          }
        });

        if (importedStudents.length > 0) {
          updateData({ students: [...data.students, ...importedStudents] });
          alert(`Berhasil mengimpor ${importedStudents.length} siswa.`);
        }
      } catch (err) {
        alert("Gagal membaca file Excel (.xlsx).");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleBackup = () => {
    const backupObj = { ...data };
    const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toLocaleString('id-ID').replace(/[/:]/g, '-');
    a.href = url;
    a.download = `Backup_Absensi_Full_${timestamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const rawData = JSON.parse(evt.target?.result as string);
        
        // 1. Map Students (handle 'class' vs 'className')
        const mappedStudents: Student[] = (rawData.students || []).map((s: any) => ({
          id: String(s.id || crypto.randomUUID()),
          name: s.name || '',
          className: s.className || s.class || ''
        }));

        // 2. Map Attendance (handle 'dateString', 'timeString', 'class', format waktu)
        const mappedAttendance: AttendanceRecord[] = (rawData.attendance || []).map((a: any) => {
          const sName = a.studentName || a.name || '';
          const sClass = a.className || a.class || '';
          
          // CRITICAL FIX: Link to student ID by searching by name and class if ID is missing/generic
          let sId = String(a.studentId || '');
          if (!sId || sId === '') {
            const foundStudent = mappedStudents.find(s => 
              s.name.toLowerCase() === sName.toLowerCase() && 
              s.className.toUpperCase() === sClass.toUpperCase()
            );
            if (foundStudent) sId = foundStudent.id;
            else sId = `unlinked-${sName}-${sClass}`; // Fallback group
          }

          // Normalisasi waktu: "07.12.00" -> "07:12"
          let normalizedTime = a.time || a.timeString || '00:00';
          normalizedTime = normalizedTime.replace(/\./g, ':').substring(0, 5);

          return {
            id: String(a.id || crypto.randomUUID()),
            studentId: sId,
            studentName: sName,
            className: sClass,
            date: a.date || a.dateString || new Date().toISOString(),
            time: normalizedTime,
            status: a.status || 'Terlambat',
            reason: a.reason || ''
          };
        });

        // 3. Map User Account
        const mappedUser = {
          username: rawData.user?.username || rawData.admin?.user || 'admin',
          password: rawData.user?.password || rawData.admin?.pass || 'admin123'
        };

        const finalData: AppData = {
          students: mappedStudents,
          attendance: mappedAttendance,
          user: mappedUser
        };

        updateData(finalData);
        alert(`Restore Berhasil!\n- ${mappedStudents.length} Siswa\n- ${mappedAttendance.length} Data Absensi`);
        setCurrentSubTab('students');
      } catch (err) {
        console.error(err);
        alert("File backup tidak cocok atau rusak.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Operator</h2>
          <p className="text-slate-500 text-sm">Setup Login, Upload Siswa, Database</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setCurrentSubTab('students')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition ${currentSubTab === 'students' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
          >
            Data Siswa
          </button>
          <button 
            onClick={() => setCurrentSubTab('account')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition ${currentSubTab === 'account' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
          >
            Setup Login
          </button>
          <button 
            onClick={() => setCurrentSubTab('database')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition ${currentSubTab === 'database' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
          >
            Database
          </button>
        </div>
      </div>

      {currentSubTab === 'students' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Cari nama atau kelas..." 
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button 
                onClick={() => { setEditingStudent(null); setNewStudent({ name: '', className: CLASSES[0] }); setShowAddModal(true); }}
                className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold transition"
              >
                <UserPlus size={18} className="mr-2" /> Tambah Siswa
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold transition"
              >
                <Upload size={18} className="mr-2" /> Upload XLSX
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls" onChange={handleExcelUpload} />
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-700 font-bold">
                <tr>
                  <th className="px-6 py-4">Nama Siswa</th>
                  <th className="px-6 py-4">Kelas</th>
                  <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.length > 0 ? (
                  filteredStudents.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-bold text-slate-900">{s.name}</td>
                      <td className="px-6 py-4 font-medium text-slate-600">{s.className}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => { setEditingStudent(s); setNewStudent({ name: s.name, className: s.className }); setShowAddModal(true); }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDeleteStudent(s.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-slate-400">Belum ada data siswa.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {currentSubTab === 'account' && (
        <div className="max-w-md mx-auto py-8">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Settings className="text-indigo-600" size={24} /> Edit Akun Operator
            </h3>
            <form onSubmit={(e) => { e.preventDefault(); updateData({ user: accountForm }); alert("Akun diperbarui!"); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none"
                  value={accountForm.username}
                  onChange={(e) => setAccountForm({ ...accountForm, username: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input 
                  type="password" 
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none"
                  value={accountForm.password}
                  onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })}
                />
              </div>
              <button 
                type="submit"
                className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition"
              >
                Simpan Perubahan
              </button>
            </form>
          </div>
        </div>
      )}

      {currentSubTab === 'database' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Database className="text-indigo-600" size={24} /> Backup & Restore
            </h3>
            <div className="space-y-4">
              <button 
                onClick={handleBackup}
                className="w-full flex items-center justify-center px-4 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition"
              >
                <Download size={20} className="mr-3" /> Backup Full (.json)
              </button>
              <button 
                onClick={() => restoreInputRef.current?.click()}
                className="w-full flex items-center justify-center px-4 py-3 border-2 border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition"
              >
                <Upload size={20} className="mr-3" /> Restore Full (.json)
              </button>
              <input type="file" ref={restoreInputRef} className="hidden" accept=".json" onChange={handleRestore} />
            </div>
          </div>

          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <AlertCircle className="text-indigo-600" size={24} /> Lokasi Database
            </h3>
            <div className="space-y-2 text-sm">
              <p className="text-indigo-900 font-mono break-all p-3 bg-white rounded-lg border border-indigo-100">
                LocalStorage Browser: {window.location.hostname}
              </p>
              <p className="text-slate-500">
                Data disimpan secara lokal di browser ini. Gunakan fitur Backup/Restore untuk memindahkan data ke komputer lain atau untuk cadangan.
              </p>
              <div className="pt-4 flex justify-between font-bold text-indigo-700">
                <span>Total Data Absensi:</span>
                <span>{data.attendance ? data.attendance.length : 0} Record</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">{editingStudent ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}</h2>
            <form onSubmit={handleAddStudent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap</label>
                <input 
                  type="text" 
                  required
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newStudent.name}
                  onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kelas</label>
                <select 
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none"
                  value={newStudent.className}
                  onChange={(e) => setNewStudent({ ...newStudent, className: e.target.value })}
                >
                  {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 border border-slate-200 font-bold rounded-lg">Batal</button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-lg">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OperatorView;
