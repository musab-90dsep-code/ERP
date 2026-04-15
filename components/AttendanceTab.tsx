'use client';

import { useState } from 'react';
import { Trash2, Users, UserCheck, UserX, Clock, History, CalendarPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface AttendanceTabProps {
  employees: any[];
  attendance: any[];
  handleDelete: (table: string, id: string) => Promise<void>;
}

export default function AttendanceTab({ employees, attendance, handleDelete }: AttendanceTabProps) {
  const router = useRouter();
  const getToday = () => new Date().toISOString().split('T')[0];
  
  // Dashboard State
  const [selectedDate, setSelectedDate] = useState(getToday());

  // History Filter State
  const [filterDate, setFilterDate] = useState(''); 
  const [filterEmployee, setFilterEmployee] = useState('');

  const getEmployee = (id: string) => employees.find(e => e.id === id);
  const getEmployeeName = (id: string) => getEmployee(id)?.name ?? id;

  // ---------------- 1. Top Dashboard Logic ----------------
  const selectedDateRecords = attendance.filter(a => a.date === selectedDate);
  const totalPresent = selectedDateRecords.filter(a => a.status === 'present').length;
  const totalAbsent = selectedDateRecords.filter(a => a.status === 'absent').length;
  const totalHalfDay = selectedDateRecords.filter(a => a.status === 'half').length;

  // ---------------- 2. History Filter Logic ----------------
  const filteredAttendance = attendance.filter(a => {
    const matchDate = filterDate ? a.date === filterDate : true;
    const matchEmployee = filterEmployee ? a.employee_id === filterEmployee : true;
    return matchDate && matchEmployee;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto pb-10">
      
      {/* ==================== HEADER & ENTRY BUTTON ==================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-[#131929] p-6 rounded-2xl border border-[rgba(255,255,255,0.04)] shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs font-bold tracking-[0.2em] text-[#8a95a8] uppercase">
              Staff Tracking
            </span>
          </div>
          <h1 className="flex items-center gap-3 text-2xl font-black text-white tracking-tight">
            <UserCheck className="w-6 h-6 text-emerald-400" /> Attendance Management
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/employees/attendance-entry')}
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white text-sm font-extrabold shadow-[0_4px_16px_rgba(52,211,153,0.3)] transition hover:opacity-90"
          >
            <CalendarPlus className="w-4 h-4" /> Entry Attendance
          </button>
        </div>
      </div>

      {/* ==================== 1. DASHBOARD CARDS ==================== */}
      <div className="bg-[#131929] rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.5)] border border-[rgba(255,255,255,0.04)] overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 border-b border-[rgba(255,255,255,0.04)] gap-4 bg-[#1a2235]">
          <h2 className="text-lg font-black text-white flex items-center gap-2 uppercase tracking-widest">
            <Users className="w-5 h-5 text-[#c9a84c]" />
            Daily Overview
          </h2>
          <div className="flex items-center gap-2 bg-[#0b0f1a] px-4 py-2.5 rounded-xl border border-[rgba(255,255,255,0.05)] shadow-inner">
            <CalendarPlus className="w-4 h-4 text-[#8a95a8]" />
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border-none bg-transparent rounded-md p-0 text-sm font-bold text-[#e8eaf0] focus:ring-0 outline-none [color-scheme:dark]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 p-6">
          {/* Present Card */}
          <div className="bg-[#1a2235] border border-[rgba(52,211,153,0.2)] rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden group shadow-[inset_0_0_20px_rgba(52,211,153,0.05)]">
            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all duration-500">
              <UserCheck className="w-32 h-32 text-emerald-400" />
            </div>
            <div className="flex justify-between items-start mb-6 relative z-10">
              <div className="bg-[rgba(52,211,153,0.1)] p-2.5 rounded-xl border border-[rgba(52,211,153,0.2)]">
                <UserCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-[10px] font-black text-emerald-400 bg-[rgba(52,211,153,0.1)] px-2.5 py-1 rounded uppercase tracking-widest border border-[rgba(52,211,153,0.2)]">Present</span>
            </div>
            <div className="relative z-10">
              <h3 className="text-4xl font-black text-white">{totalPresent}</h3>
              <p className="text-xs text-[#8a95a8] font-bold uppercase tracking-wider mt-2">Employees Present</p>
            </div>
          </div>
          
          {/* Absent Card */}
          <div className="bg-[#1a2235] border border-[rgba(248,113,113,0.2)] rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden group shadow-[inset_0_0_20px_rgba(248,113,113,0.05)]">
            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all duration-500">
              <UserX className="w-32 h-32 text-red-500" />
            </div>
            <div className="flex justify-between items-start mb-6 relative z-10">
              <div className="bg-[rgba(248,113,113,0.1)] p-2.5 rounded-xl border border-[rgba(248,113,113,0.2)]">
                <UserX className="w-5 h-5 text-red-500" />
              </div>
              <span className="text-[10px] font-black text-red-400 bg-[rgba(248,113,113,0.1)] px-2.5 py-1 rounded uppercase tracking-widest border border-[rgba(248,113,113,0.2)]">Absent</span>
            </div>
            <div className="relative z-10">
              <h3 className="text-4xl font-black text-white">{totalAbsent}</h3>
              <p className="text-xs text-[#8a95a8] font-bold uppercase tracking-wider mt-2">Employees Absent</p>
            </div>
          </div>

          {/* Half Day Card */}
          <div className="bg-[#1a2235] border border-[rgba(251,191,36,0.2)] rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden group shadow-[inset_0_0_20px_rgba(251,191,36,0.05)]">
            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all duration-500">
              <Clock className="w-32 h-32 text-yellow-500" />
            </div>
            <div className="flex justify-between items-start mb-6 relative z-10">
              <div className="bg-[rgba(251,191,36,0.1)] p-2.5 rounded-xl border border-[rgba(251,191,36,0.2)]">
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
              <span className="text-[10px] font-black text-yellow-500 bg-[rgba(251,191,36,0.1)] px-2.5 py-1 rounded uppercase tracking-widest border border-[rgba(251,191,36,0.2)]">Half Day</span>
            </div>
            <div className="relative z-10">
              <h3 className="text-4xl font-black text-white">{totalHalfDay}</h3>
              <p className="text-xs text-[#8a95a8] font-bold uppercase tracking-wider mt-2">Half Day Logged</p>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== 2. HISTORY & FILTERS ==================== */}
      <div className="bg-[#131929] rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.5)] border border-[rgba(255,255,255,0.04)] overflow-hidden">
        <div className="p-6 border-b border-[rgba(255,255,255,0.04)] bg-[#1a2235] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h2 className="text-sm font-black text-[#c9a84c] flex items-center gap-2 uppercase tracking-widest">
            <History className="w-4 h-4" />
            Attendance History
          </h2>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            {/* Date Filter */}
            <div className="flex items-center gap-2 bg-[#0b0f1a] px-4 py-2.5 rounded-lg border border-[rgba(255,255,255,0.05)]">
              <span className="text-[10px] text-[#8a95a8] font-bold uppercase tracking-widest">Date:</span>
              <input 
                type="date" 
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="text-sm outline-none text-[#e8eaf0] font-bold bg-transparent [color-scheme:dark]"
              />
              {filterDate && (
                <button onClick={() => setFilterDate('')} className="text-[10px] text-red-400 hover:text-red-500 ml-1 font-black uppercase tracking-wider bg-[rgba(248,113,113,0.1)] px-1.5 py-0.5 rounded">Clear</button>
              )}
            </div>
            
            {/* Employee Filter */}
            <select 
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              className="bg-[#0b0f1a] border border-[rgba(255,255,255,0.05)] text-[#e8eaf0] rounded-lg px-4 py-2.5 text-sm font-bold outline-none focus:border-[#c9a84c] min-w-[180px] appearance-none"
            >
              <option value="">All Employees</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left relative">
            <thead className="bg-[#131929] sticky top-0 border-b border-[rgba(255,255,255,0.04)] z-10">
              <tr>
                <th className="px-6 py-4 text-[10px] font-extrabold text-[#8a95a8] uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-[#8a95a8] uppercase tracking-widest">Employee</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-[#8a95a8] uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-[#8a95a8] uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.02)]">
              {filteredAttendance.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-16 bg-[#1a2235]/50">
                    <div className="flex flex-col items-center justify-center text-[#4a5568]">
                      <History className="w-12 h-12 mb-4 opacity-50" />
                      <p className="text-sm font-bold text-[#e8eaf0]">No attendance records found</p>
                      <p className="text-[11px] font-semibold text-[#8a95a8] mt-1 uppercase tracking-wider">Select a different date or staff member.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAttendance.map(a => {
                  const empInfo = getEmployee(a.employee_id);
                  return (
                  <tr key={a.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors group">
                    <td className="px-6 py-4 text-sm font-bold text-[#e8eaf0] whitespace-nowrap">{a.date}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#0b0f1a] flex items-center justify-center overflow-hidden border border-[rgba(255,255,255,0.05)]">
                          {empInfo?.profile_image_url ? (
                             <img src={empInfo.profile_image_url} alt={empInfo.name} className="w-full h-full object-cover" />
                          ) : (
                             <span className="font-black text-[#8a95a8] text-[10px] uppercase">{empInfo?.name?.charAt(0) || '?'}</span>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-[#e8eaf0] group-hover:text-[#c9a84c] transition-colors">{empInfo?.name || 'Unknown'}</p>
                          <p className="text-[10px] uppercase font-bold text-[#4a5568] tracking-widest">{empInfo?.role || 'Staff'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest border ${
                        a.status === 'present' ? 'bg-[rgba(52,211,153,0.1)] text-emerald-400 border-[rgba(52,211,153,0.2)]' : 
                        a.status === 'absent' ? 'bg-[rgba(248,113,113,0.1)] text-red-400 border-[rgba(248,113,113,0.2)]' : 
                        'bg-[rgba(251,191,36,0.1)] text-yellow-500 border-[rgba(251,191,36,0.2)]'
                      }`}>
                        {a.status === 'present' ? <UserCheck className="w-3 h-3" /> : a.status === 'absent' ? <UserX className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {a.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => {
                          if(window.confirm('Are you sure you want to delete this record?')) {
                            handleDelete('attendance', a.id);
                          }
                        }} 
                        className="text-[#8a95a8] hover:text-red-400 transition-colors bg-[#1a2235] hover:bg-[rgba(248,113,113,0.1)] p-2 rounded-md border border-[rgba(255,255,255,0.05)] hover:border-[rgba(248,113,113,0.2)] shadow-sm opacity-0 group-hover:opacity-100"
                        title="Delete Record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
    </div>
  );
}