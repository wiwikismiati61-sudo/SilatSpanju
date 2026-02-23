
export interface Student {
  id: string;
  name: string;
  className: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  date: string; // ISO String
  time: string; // HH:mm
  status: 'Tepat Waktu' | 'Terlambat';
  reason: string;
}

export interface AppUser {
  username: string;
  password: string;
}

export interface AppData {
  students: Student[];
  attendance: AttendanceRecord[];
  user: AppUser;
}

export enum Tab {
  Dashboard = 'Dashboard',
  Absensi = 'Absensi',
  Operator = 'Operator',
  Report = 'Report'
}

export const CLASSES = [
  '7A', '7B', '7C', '7D', '7E', '7F', '7G', '7H',
  '8A', '8B', '8C', '8D', '8E', '8F', '8G', '8H',
  '9A', '9B', '9C', '9D', '9E', '9F', '9G', '9H'
];

export const REASONS = [
  'Ban Bocor',
  'Telat Bangun',
  'Jalan Macet',
  'Jalan Banjir',
  'Anter Adik',
  'Ada Tugas Sekolah',
  'Lainnya'
];
