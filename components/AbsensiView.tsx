
import React, { useState, useMemo } from 'react';
import { Search, ChevronRight, CheckCircle2, Clock } from 'lucide-react';
import { AppData, AttendanceRecord, CLASSES, REASONS } from '../types';

interface Props {
  data: AppData;
  onAddRecord: (record: AttendanceRecord) => void;
}

const AbsensiView: React.FC<Props> = ({ data, onAddRecord }) => {
  const [step, setStep] = useState(1);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<{id: string, name: string} | null>(null);
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const filteredStudents = useMemo(() => {
    return data.students.filter(s => s.className === selectedClass).sort((a, b) => a.name.localeCompare(b.name));
  }, [data.students, selectedClass]);

  const handleSubmit = () => {
    if (!selectedStudent || !selectedClass) return;

    const now = new Date();
    const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // Check lateness: after 06:55 is late
    const limitMinutes = 6 * 60 + 55;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const status = currentMinutes > limitMinutes ? 'Terlambat' : 'Tepat Waktu';

    const newRecord: AttendanceRecord = {
      id: crypto.randomUUID(),
      studentId: selectedStudent.id,
      studentName: selectedStudent.name,
      className: selectedClass,
      date: now.toISOString(),
      time: currentTimeStr,
      status: status,
      reason: selectedReason === 'Lainnya' ? customReason : selectedReason
    };

    onAddRecord(newRecord);
    setSubmitted(true);
    
    // Reset after 4 seconds
    setTimeout(() => {
      setStep(1);
      setSelectedClass('');
      setSelectedStudent(null);
      setSelectedReason('');
      setCustomReason('');
      setSubmitted(false);
    }, 4000);
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-bounceIn">
        <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-emerald-100">
          <CheckCircle2 size={48} />
        </div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Terima Kasih!</h2>
        <p className="text-slate-600 text-lg">Absensi kamu berhasil tercatat.</p>
        <div className="mt-8 px-6 py-3 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-sm font-medium text-slate-500">Otomatis kembali dalam beberapa detik...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fadeIn">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-extrabold text-slate-900">Input Kehadiran Mandiri</h2>
        <p className="text-slate-500 text-lg">Silakan ikuti langkah-langkah di bawah ini.</p>
      </div>

      {/* Progress Stepper */}
      <div className="flex items-center justify-center space-x-4 mb-12">
        {[1, 2, 3].map((num) => (
          <div key={num} className="flex items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${
              step === num ? 'bg-indigo-600 text-white shadow-lg ring-4 ring-indigo-100' : 
              step > num ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
            }`}>
              {step > num ? <CheckCircle2 size={20} /> : num}
            </div>
            {num < 3 && <div className={`w-12 h-1 bg-slate-200 mx-2 rounded ${step > num ? 'bg-emerald-500' : ''}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Pilih Kelas */}
      {step === 1 && (
        <div className="space-y-6">
          <h3 className="text-xl font-bold text-slate-800 text-center uppercase tracking-wide">Pilih Kelas Kamu</h3>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
            {CLASSES.map((cls) => (
              <button
                key={cls}
                onClick={() => { setSelectedClass(cls); setStep(2); }}
                className="py-4 rounded-xl border-2 border-slate-100 font-bold text-slate-700 hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all text-center text-lg shadow-sm"
              >
                {cls}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Pilih Nama (Modified to single column vertical scroll) */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button onClick={() => setStep(1)} className="text-indigo-600 font-bold flex items-center hover:underline group">
              <ChevronRight className="rotate-180 mr-1 group-hover:-translate-x-1 transition-transform" size={20} /> Kembali ke Kelas
            </button>
            <div className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-black shadow-md shadow-indigo-100">Kelas {selectedClass}</div>
          </div>
          <h3 className="text-2xl font-black text-slate-800 text-center mb-8">Siapa Nama Kamu?</h3>
          {filteredStudents.length > 0 ? (
            <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-200 pr-4">
              {filteredStudents.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedStudent(s); setStep(3); }}
                  className="w-full p-5 text-left rounded-2xl border border-slate-200 bg-white hover:border-indigo-500 hover:bg-indigo-50 transition-all font-bold text-slate-700 flex justify-between items-center shadow-sm active:scale-[0.99]"
                >
                  <span className="truncate pr-4 uppercase tracking-wide">{s.name}</span>
                  <ChevronRight size={20} className="text-slate-300 flex-shrink-0" />
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
              <p className="text-slate-400 font-bold italic">Data siswa kelas ini belum diupload oleh Operator.</p>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Alasan & Konfirmasi */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button onClick={() => setStep(2)} className="text-indigo-600 font-bold flex items-center hover:underline group">
              <ChevronRight className="rotate-180 mr-1 group-hover:-translate-x-1 transition-transform" size={20} /> Ganti Nama
            </button>
            <div className="text-right">
              <div className="font-black text-slate-900 uppercase tracking-tight">{selectedStudent?.name}</div>
              <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Kelas {selectedClass}</div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-3xl p-8 text-amber-900 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
                <Clock size={24} />
              </div>
              <div>
                <h4 className="text-xl font-black uppercase tracking-tight">Kenapa Terlambat?</h4>
                <p className="text-xs font-bold text-amber-600/70 uppercase tracking-widest">Pilih salah satu alasan di bawah</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setSelectedReason(r)}
                  className={`p-4 rounded-2xl border-2 text-left font-bold transition-all ${
                    selectedReason === r 
                      ? 'bg-white border-amber-500 text-amber-900 shadow-md ring-4 ring-amber-100' 
                      : 'bg-white/50 border-white hover:border-amber-200'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            
            {selectedReason === 'Lainnya' && (
              <textarea
                placeholder="Tuliskan alasan lainnya secara singkat di sini..."
                className="w-full p-5 rounded-2xl border-2 border-amber-100 focus:border-amber-400 focus:bg-white outline-none min-h-[120px] font-bold transition-all"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
              />
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!selectedReason || (selectedReason === 'Lainnya' && !customReason)}
            className="w-full py-5 bg-indigo-600 text-white text-xl font-black uppercase tracking-[0.1em] rounded-3xl shadow-2xl shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            Kirim Absensi Saya
          </button>
        </div>
      )}
    </div>
  );
};

export default AbsensiView;
