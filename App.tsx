
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
import { db, auth, googleProvider } from './firebase';
import { doc, onSnapshot, setDoc, getDoc, getDocFromServer } from 'firebase/firestore';
import { signInWithPopup, onAuthStateChanged, signInAnonymously } from 'firebase/auth';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Terjadi kesalahan pada aplikasi.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error) errorMessage = `Firebase Error: ${parsed.error}`;
      } catch (e) {
        errorMessage = this.state.error.message || String(this.state.error);
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center border border-red-100">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-50 text-red-500 rounded-full mb-6">
              <ShieldCheck size={32} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-4">Waduh! Terjadi Kesalahan</h1>
            <p className="text-slate-600 mb-6">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
            >
              Muat Ulang Aplikasi
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFirebaseLoaded, setIsFirebaseLoaded] = useState(false);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  const [firebaseErrorDetail, setFirebaseErrorDetail] = useState<string | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<any>(null);

  const isOperator = userRole === 'Operator';
  const isAuthenticated = userRole !== null;

  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo: auth.currentUser?.providerData.map(provider => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL
        })) || []
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  };

  const testConnection = async () => {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
    } catch (error) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.error("Please check your Firebase configuration.");
        setFirebaseErrorDetail("Firestore backend tidak terjangkau. Periksa koneksi internet atau konfigurasi Firebase Anda.");
        setFirebaseError('auth-required');
      }
    }
  };

  // Handle Firebase Auth
  useEffect(() => {
    testConnection();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setFirebaseUser(user);
        setFirebaseError(null);
      } else {
        // Try anonymous auth first
        signInAnonymously(auth).catch(e => {
          // Log the error to help debug API key restriction issues on Vercel
          console.error("Anonymous auth failed (likely API key restriction on Vercel):", e);
          setFirebaseErrorDetail(e.message || String(e));
          setFirebaseError('auth-required');
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // Load data from Firebase
  useEffect(() => {
    if (!firebaseUser) return; // Wait until authenticated

    const docRef = doc(db, 'appData', 'main');

    // First check if we need to migrate local data to Firebase
    const migrateLocalData = async () => {
      try {
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          // Firebase is empty, check local storage
          const savedData = localStorage.getItem('absensi_db');
          if (savedData) {
            const parsed = JSON.parse(savedData);
            if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
              console.log("Migrating local data to Firebase...");
              await setDoc(docRef, parsed);
            } else {
              await setDoc(docRef, INITIAL_DATA);
            }
          } else {
            await setDoc(docRef, INITIAL_DATA);
          }
        }
      } catch (e: any) {
        console.error("Migration check failed:", e);
        if (e?.message?.includes("Missing or insufficient permissions") || e?.code === 'permission-denied') {
          setFirebaseError('permission-denied');
        } else {
          handleFirestoreError(e, OperationType.GET, 'appData/main');
        }
      }
    };

    migrateLocalData().then(() => {
      // Set up real-time listener
      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const firebaseData = docSnap.data() as AppData;
          setData(firebaseData);
          // Keep local storage updated as a fallback
          localStorage.setItem('absensi_db', JSON.stringify(firebaseData));
        }
        setIsFirebaseLoaded(true);
      }, (error: any) => {
        console.error("Firebase listen error:", error);
        if (error?.message?.includes("Missing or insufficient permissions") || error?.code === 'permission-denied') {
          setFirebaseError('permission-denied');
        } else {
          handleFirestoreError(error, OperationType.GET, 'appData/main');
        }
        // Fallback to local storage if Firebase fails
        const savedData = localStorage.getItem('absensi_db');
        if (savedData) {
          try {
            setData(JSON.parse(savedData));
          } catch (err) {
            console.error("Failed to parse local data", err);
          }
        }
        setIsFirebaseLoaded(true);
      });

      return () => unsubscribe();
    });
    
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [firebaseUser]);

  // Save data to Firebase whenever it changes
  const saveToFirebase = async (newData: AppData) => {
    try {
      await setDoc(doc(db, 'appData', 'main'), newData);
    } catch (e) {
      console.error("Failed to save data to Firebase", e);
      // Fallback to local storage
      localStorage.setItem('absensi_db', JSON.stringify(newData));
      handleFirestoreError(e, OperationType.WRITE, 'appData/main');
    }
  };

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
      let updatedData: AppData;
      // If it's a full restore (has all primary keys)
      if ('students' in newData && 'attendance' in newData && 'user' in newData) {
        updatedData = newData as AppData;
      } else {
        // Otherwise, partial update
        updatedData = { ...prev, ...newData };
      }
      
      // Save to Firebase asynchronously
      if (isFirebaseLoaded) {
        saveToFirebase(updatedData);
      }
      
      return updatedData;
    });
  };

  const renderContent = () => {
    switch (activeTab) {
      case Tab.Dashboard:
        return <DashboardView data={data} currentTime={currentTime} isLoggedIn={isOperator} updateData={updateAppData} />;
      case Tab.Absensi:
        return isAuthenticated ? (
          <AbsensiView data={data} onAddRecord={(record) => updateAppData({ attendance: [record, ...data.attendance] })} />
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <ShieldCheck size={64} className="text-slate-300 mb-4" />
            <h2 className="text-2xl font-bold text-slate-800">Akses Terbatas</h2>
            <p className="text-slate-500 mb-6">Silakan login terlebih dahulu untuk melakukan absensi.</p>
            <button 
              onClick={() => setShowLoginModal(true)}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              Login Sekarang
            </button>
          </div>
        );
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
        return <ReportView data={data} updateData={updateAppData} />;
      default:
        return null;
    }
  };

  if (firebaseError === 'auth-required') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8 text-center border border-indigo-100">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-50 text-indigo-500 rounded-full mb-6">
            <ShieldCheck size={40} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-4">Autentikasi Database Diperlukan</h1>
          <p className="text-lg text-slate-600 mb-4">
            Aplikasi ini membutuhkan akses ke database Firebase. Karena fitur <strong>Anonymous Authentication</strong> belum diaktifkan, Anda dapat menggunakan Akun Google Anda untuk melanjutkan.
          </p>
          
          {/* Debug info for Vercel */}
          <div className="mb-8 p-4 bg-red-50 text-red-700 text-sm rounded-lg text-left font-mono overflow-auto border border-red-100">
            <strong>Detail Error:</strong><br/>
            {firebaseErrorDetail || "Tidak ada detail error tambahan."}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => signInWithPopup(auth, googleProvider).catch(e => console.error(e))}
              className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-200"
            >
              Login dengan Google
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-3 bg-white text-slate-700 border border-slate-200 font-bold rounded-xl hover:bg-slate-50 transition"
            >
              Coba Ulang (Refresh)
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 text-sm text-slate-500 text-left">
            <p className="font-semibold mb-2">Opsi Alternatif (Untuk Admin):</p>
            <p>Jika Anda tidak ingin menggunakan Login Google, Anda bisa mengaktifkan "Anonymous Authentication" di Firebase Console &gt; Authentication &gt; Sign-in method.</p>
          </div>
        </div>
      </div>
    );
  }

  if (firebaseError === 'permission-denied') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8 text-center border border-red-100">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-red-50 text-red-500 rounded-full mb-6">
            <ShieldCheck size={40} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-4">Akses Database Diblokir</h1>
          <p className="text-lg text-slate-600 mb-8">
            Firebase secara otomatis memblokir akses karena fitur <strong>Anonymous Authentication</strong> belum diaktifkan.
            Data Anda aman, namun aplikasi tidak dapat membaca atau menyimpannya.
          </p>
          
          <div className="bg-slate-50 rounded-xl p-6 text-left mb-8 border border-slate-200">
            <h3 className="font-bold text-slate-800 mb-4 text-lg">Cara Memperbaiki (Hanya 1 Menit):</h3>
            <ol className="list-decimal list-inside space-y-3 text-slate-700">
              <li>Buka <a href="https://console.firebase.google.com/project/gen-lang-client-0253660305/authentication/providers" target="_blank" rel="noreferrer" className="text-indigo-600 font-bold hover:underline">Firebase Console</a> di tab baru.</li>
              <li>Klik tombol <strong>Get Started</strong> (jika diminta).</li>
              <li>Pilih tab <strong>Sign-in method</strong>.</li>
              <li>Klik <strong>Add new provider</strong>, lalu pilih <strong>Anonymous</strong>.</li>
              <li>Geser tombol ke <strong>Enable</strong> (Aktif).</li>
              <li>Klik <strong>Save</strong> (Simpan).</li>
              <li>Kembali ke halaman ini dan <strong>Refresh (F5)</strong>.</li>
            </ol>
          </div>
          
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-200"
          >
            Saya Sudah Mengaktifkannya (Refresh)
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 sm:h-16">
            <div className="flex items-center">
              <button 
                className="md:hidden mr-2 sm:mr-4 text-slate-500 hover:text-slate-700"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
              </button>
              <img src="https://iili.io/KDFk4fI.png" alt="Logo" className="h-8 sm:h-10 w-auto mr-2 sm:mr-3 cursor-pointer" onClick={() => setActiveTab(Tab.Dashboard)} />
              <div className="hidden md:block">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">Siswa Terlambat Hadir</h1>
                <p className="text-[10px] sm:text-xs text-slate-500 font-medium">Sistem Informasi Monitoring Pendidikan</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-1 sm:space-x-2">
              <div className="hidden sm:flex flex-col items-end mr-2 sm:mr-4 text-right">
                <div className="flex items-center text-slate-700 font-semibold text-xs sm:text-sm">
                  <Clock size={14} className="mr-1 sm:mr-2 text-indigo-500" />
                  {currentTime.toLocaleTimeString('id-ID')}
                </div>
                <div className="text-[10px] sm:text-xs text-slate-500">
                  {currentTime.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </div>

              {isAuthenticated ? (
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="hidden md:block text-xs sm:text-sm font-medium text-slate-600 bg-slate-100 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full">
                    {userRole}
                  </span>
                  <button 
                    onClick={handleLogout}
                    className="flex items-center px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition"
                  >
                    <LogOut size={16} className="md:mr-2" />
                    <span className="hidden md:block">Logout</span>
                  </button>
                </div>
              ) : activeTab !== Tab.Dashboard ? (
                <button 
                  onClick={() => setShowLoginModal(true)}
                  className="flex items-center px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition"
                >
                  <LogIn size={16} className="md:mr-2" />
                  <span className="hidden md:block">Login</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </nav>

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <aside className={`fixed md:relative z-40 md:z-auto w-48 md:w-52 flex-shrink-0 bg-white md:bg-transparent h-full md:h-auto transition-transform duration-300 ease-in-out ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
          <div className="bg-white rounded-r-2xl md:rounded-2xl shadow-lg md:shadow-sm border border-slate-200 p-1 sm:p-2 h-full md:sticky md:top-20">
            <nav className="space-y-1 mt-14 md:mt-0">
              {[
                { id: Tab.Dashboard, icon: LayoutDashboard, label: 'Beranda' },
                { id: Tab.Absensi, icon: ClipboardCheck, label: 'Absensi Siswa' },
                { id: Tab.Operator, icon: Users, label: 'Operator' },
                { id: Tab.Report, icon: FileBarChart, label: 'Report' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id as Tab); setIsMenuOpen(false); }}
                  className={`w-full flex items-center px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-xl transition-all duration-200 ${
                    activeTab === item.id 
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'
                  }`}
                >
                  <item.icon size={16} className="mr-2 sm:mr-3 sm:w-[18px] sm:h-[18px]" />
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        <div className="flex-1 flex flex-col w-full md:px-3 lg:px-4 py-3 sm:py-4 gap-3 sm:gap-4">
          <main className="flex-1 min-w-0 px-2 sm:px-0">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-2 sm:p-4 min-h-[calc(100vh-10rem)]">
              {renderContent()}
            </div>
          </main>
        </div>
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
    </ErrorBoundary>
  );
};

export default App;