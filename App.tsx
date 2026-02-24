
import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  ClipboardCheck, 
  FileBarChart, 
  LogOut, 
  LogIn, 
  Clock, 
  ShieldCheck 
} from 'lucide-react';
import DashboardView from './components/DashboardView';
import AbsensiView from './components/AbsensiView';
import OperatorView from './components/OperatorView';
import ReportView from './components/ReportView';
import { AppData, Tab } from './types';

const INITIAL_DATA: AppData = {
  students: [],
  attendance: [],
  user: {
    username: 'admin',
    password: 'admin123'
  }
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.Dashboard);
  const [data, setData] = useState<AppData>(INITIAL_DATA);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '', role: 'Operator' });
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const isOperator = userRole === 'Operator';
  const isAuthenticated = userRole !== null;

  // Load data from API
  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/api/data');
        if (response.ok) {
          const parsed = await response.json();
          if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
            setData(parsed);
          }
        }
      } catch (e) {
        console.error("Failed to load data from API", e);
        // Fallback to local storage if API fails (e.g. offline)
        const savedData = localStorage.getItem('absensi_db');
        if (savedData) {
          try {
            const parsed = JSON.parse(savedData);
            if (parsed && typeof parsed === 'object') {
              setData(parsed);
            }
          } catch (err) {
            console.error("Failed to parse local data", err);
          }
        }
      }
    };
    
    loadData();
    
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Save data to API whenever it changes
  useEffect(() => {
    const saveData = async () => {
      // Don't save initial empty data immediately to avoid overwriting DB on load
      if (data === INITIAL_DATA) return;
      
      try {
        await fetch('/api/data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });
      } catch (e) {
        console.error("Failed to save data to API", e);
      }
      
      // Also save to localStorage as backup
      localStorage.setItem('absensi_db', JSON.stringify(data));
    };
    
    saveData();
  }, [data]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginForm.role === 'Operator') {
      if (loginForm.username === data.user.username && loginForm.password === data.user.password) {
        setUserRole('Operator');
        setShowLoginModal(false);
        setLoginForm({ username: '', password: '', role: 'Operator' });
      } else {
        alert("Username atau Password salah!");
      }
    } else {
      setUserRole(loginForm.role);
      setShowLoginModal(false);
      setLoginForm({ username: '', password: '', role: 'Operator' });
    }
  };

  const handleLogout = () => {
    setUserRole(null);
    setActiveTab(Tab.Dashboard);
  };

  // Improved update function to handle partial or full replacements
  const updateAppData = (newData: Partial<AppData> | AppData) => {
    setData(prev => {
      // If it's a full restore (has all primary keys)
      if ('students' in newData && 'attendance' in newData && 'user' in newData) {
        return newData as AppData;
      }
      // Otherwise, partial update
      return { ...prev, ...newData };
    });
  };

  const renderContent = () => {
    switch (activeTab) {
      case Tab.Dashboard:
        return <DashboardView data={data} currentTime={currentTime} isLoggedIn={isOperator} updateData={updateAppData} />;
      case Tab.Absensi:
        return <AbsensiView data={data} onAddRecord={(record) => updateAppData({ attendance: [record, ...data.attendance] })} />;
      case Tab.Operator:
        return isOperator ? (
          <OperatorView data={data} updateData={updateAppData} setActiveTab={setActiveTab} />
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <ShieldCheck size={64} className="text-slate-300 mb-4" />
            <h2 className="text-2xl font-bold text-slate-800">Akses Terbatas</h2>
            <p className="text-slate-500 mb-6">Hanya Operator yang dapat mengakses menu ini.</p>
            <button 
              onClick={() => setShowLoginModal(true)}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              Login Sekarang
            </button>
          </div>
        );
      case Tab.Report:
        return isOperator || userRole === 'Kepala Sekolah' || userRole === 'Guru' ? (
          <ReportView data={data} updateData={updateAppData} />
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <ShieldCheck size={64} className="text-slate-300 mb-4" />
            <h2 className="text-2xl font-bold text-slate-800">Akses Terbatas</h2>
            <p className="text-slate-500 mb-6">Hanya Operator, Kepala Sekolah, dan Guru yang dapat mengakses menu laporan.</p>
            <button 
              onClick={() => setShowLoginModal(true)}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              Login Sekarang
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20">
            <div className="flex items-center">
              <img src="https://iili.io/KDFk4fI.png" alt="Logo" className="h-12 w-auto mr-4 cursor-pointer" onClick={() => setActiveTab(Tab.Dashboard)} />
              <div className="hidden md:block">
                <h1 className="text-xl font-bold text-slate-900 leading-tight">Siswa Terlambat Hadir</h1>
                <p className="text-xs text-slate-500 font-medium">Sistem Informasi Monitoring Pendidikan</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-1 sm:space-x-4">
              <div className="hidden sm:flex flex-col items-end mr-4 text-right">
                <div className="flex items-center text-slate-700 font-semibold">
                  <Clock size={16} className="mr-2 text-indigo-500" />
                  {currentTime.toLocaleTimeString('id-ID')}
                </div>
                <div className="text-xs text-slate-500">
                  {currentTime.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </div>

              {isAuthenticated ? (
                <div className="flex items-center gap-3">
                  <span className="hidden md:block text-sm font-medium text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full">
                    {userRole}
                  </span>
                  <button 
                    onClick={handleLogout}
                    className="flex items-center px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition"
                  >
                    <LogOut size={18} className="mr-2" />
                    Logout
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setShowLoginModal(true)}
                  className="flex items-center px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition"
                >
                  <LogIn size={18} className="mr-2" />
                  Login
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="flex-1 flex flex-col md:flex-row max-w-7xl w-full mx-auto md:px-6 lg:px-8 py-6 gap-6">
        <aside className="w-full md:w-64 flex-shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-2 overflow-hidden sticky top-28">
            <nav className="space-y-1">
              {[
                { id: Tab.Dashboard, icon: LayoutDashboard, label: 'Beranda' },
                { id: Tab.Absensi, icon: ClipboardCheck, label: 'Absensi Siswa' },
                { id: Tab.Operator, icon: Users, label: 'Operator' },
                { id: Tab.Report, icon: FileBarChart, label: 'Report' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as Tab)}
                  className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                    activeTab === item.id 
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'
                  }`}
                >
                  <item.icon size={20} className="mr-3" />
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-8 min-h-[calc(100vh-12rem)]">
            {renderContent()}
          </div>
        </main>
      </div>

      {showLoginModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative">
            <button 
              onClick={() => setShowLoginModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full mb-4">
                <ShieldCheck size={32} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Login Sistem</h2>
              <p className="text-slate-500">Pilih peran Anda untuk masuk</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Masuk Sebagai</label>
                <select 
                  value={loginForm.role}
                  onChange={(e) => setLoginForm({ ...loginForm, role: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"
                >
                  <option value="Operator">Operator</option>
                  <option value="Kepala Sekolah">Kepala Sekolah</option>
                  <option value="Guru">Guru</option>
                  <option value="Orang Tua">Orang Tua</option>
                  <option value="Siswa">Siswa</option>
                </select>
              </div>
              
              {loginForm.role === 'Operator' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                    <input 
                      type="text" 
                      required
                      value={loginForm.username}
                      onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                    <input 
                      type="password" 
                      required
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"
                    />
                  </div>
                </>
              )}
              
              <button 
                type="submit"
                className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition shadow-lg shadow-indigo-100"
              >
                Masuk
              </button>
            </form>
          </div>
        </div>
      )}

      <footer className="bg-white border-t border-slate-200 py-6 text-center text-slate-500 text-sm">
        <p>&copy; {new Date().getFullYear()} Siswa Terlambat Hadir</p>
      </footer>
    </div>
  );
};

export default App;