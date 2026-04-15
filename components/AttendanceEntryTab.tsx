'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Save, Calendar, ArrowLeft, UserCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface AttendanceEntryTabProps {
  employees: any[];
  attendance: any[];
  fetchAttendance: () => Promise<void>;
}

export default function AttendanceEntryTab({ employees, attendance, fetchAttendance }: AttendanceEntryTabProps) {
  const router = useRouter();
  const getToday = () => new Date().toISOString().split('T')[0];
  
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const newStatusMap: Record<string, string> = {};
    employees.forEach(emp => {
      const existingRecord = attendance.find(a => a.employee === emp.id && a.date === selectedDate);
      newStatusMap[emp.id] = existingRecord ? existingRecord.status : 'present';
    });
    setStatusMap(newStatusMap);
  }, [employees, attendance, selectedDate]);

  const handleStatusChange = (empId: string, status: string) => {
    setStatusMap(prev => ({ ...prev, [empId]: status }));
  };

  const markAllAs = (status: string) => {
    const newStatusMap: Record<string, string> = {};
    employees.forEach(emp => {
      newStatusMap[emp.id] = status;
    });
    setStatusMap(newStatusMap);
  };

  const handleBulkSave = async () => {
    setIsSaving(true);
    const payload = Object.entries(statusMap).map(([empId, status]) => ({
      employee: empId,
      date: selectedDate,
      status: status
    }));

    try {
      await api.bulkMarkAttendance(payload);
      alert('Attendance saved successfully!');
      fetchAttendance(); 
      router.push('/employees/attendance');
    } catch (error) {
      console.error('Error saving attendance:', error);
      alert('Failed to save attendance.');
    } finally {
      setIsSaving(false);
    }
  };

  // Helper function to safely parse phone numbers
  const parsePhones = (phoneVal: any) => {
    if (Array.isArray(phoneVal)) return phoneVal;
    if (typeof phoneVal === 'string' && phoneVal.startsWith('[')) {
      try { return JSON.parse(phoneVal); } catch(e){}
    }
    if (phoneVal) {
      return [{ number: phoneVal, is_whatsapp: false, is_imo: false, is_telegram: false }];
    }
    return [];
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-[1400px] mx-auto pb-10 px-2 sm:px-0">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2 sm:mb-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <button 
            onClick={() => router.push('/employees/attendance')}
            className="flex items-center justify-center w-10 h-10 shrink-0 bg-[#1a2235] rounded-xl border border-[rgba(255,255,255,0.05)] text-[#8a95a8] hover:text-white hover:border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.05)] transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Record Attendance</h1>
            <p className="text-[10px] sm:text-[11px] uppercase font-bold tracking-wider text-[#8a95a8] mt-1">Quickly mark present, absent or half-day</p>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="bg-[#131929] rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.5)] border border-[rgba(255,255,255,0.04)] overflow-hidden relative">
        
        {/* Top Controls */}
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center p-4 sm:p-6 border-b border-[rgba(255,255,255,0.04)] bg-[#1a2235] gap-4">
          <div className="flex items-center gap-3 bg-[#0b0f1a] px-4 py-2.5 rounded-xl border border-[rgba(255,255,255,0.05)] shadow-inner w-full md:w-auto">
            <Calendar className="w-4 h-4 text-[#c9a84c] shrink-0" /> 
            <div className="flex flex-col w-full">
              <label className="text-[9px] uppercase font-bold text-[#8a95a8] tracking-widest leading-none mb-1">Attendance Date</label>
              <input 
                type="date" 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-sm font-bold text-[#e8eaf0] border-none bg-transparent p-0 w-full focus:ring-0 outline-none leading-none [color-scheme:dark]"
              />
            </div>
          </div>
          
          <button 
            onClick={() => markAllAs('present')}
            className="flex justify-center items-center gap-2 text-[11px] uppercase tracking-widest font-black text-emerald-400 bg-[rgba(52,211,153,0.1)] hover:bg-[rgba(52,211,153,0.15)] px-4 py-3 rounded-lg border border-[rgba(52,211,153,0.2)] transition-colors w-full md:w-auto"
          >
            <UserCheck className="w-4 h-4" /> Mark All Present
          </button>
        </div>

        {/* ── RESPONSIVE EMPLOYEE LIST ── */}
        <div className="p-0">
          {employees.length === 0 ? (
            <div className="text-center py-16 text-[#4a5568]">
              <p className="font-bold text-sm text-[#8a95a8]">No employees registered yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-[rgba(255,255,255,0.02)]">
              {employees.map(emp => {
                const currentStatus = statusMap[emp.id] || 'present';
                // Parse the phone number to display correctly
                const phones = parsePhones(emp.phone);
                const displayPhone = phones.length > 0 ? phones[0].number : 'No phone';

                return (
                  <div key={emp.id} className={`p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${
                    currentStatus === 'absent' ? 'bg-[rgba(248,113,113,0.03)] hover:bg-[rgba(248,113,113,0.05)]' : 
                    currentStatus === 'half' ? 'bg-[rgba(251,191,36,0.03)] hover:bg-[rgba(251,191,36,0.05)]' : 
                    'hover:bg-[rgba(255,255,255,0.02)]'
                  }`}>
                    
                    {/* Employee Info */}
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 sm:w-10 sm:h-10 rounded-full bg-[#0b0f1a] border border-[rgba(255,255,255,0.05)] overflow-hidden shrink-0 flex items-center justify-center shadow-inner">
                        {emp.profile_image_url ? (
                          <img src={emp.profile_image_url} alt={emp.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="font-black text-[#4a5568] text-lg sm:text-sm uppercase">{emp.name?.charAt(0)}</span>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <p className="font-bold text-[#e8eaf0] text-base sm:text-sm">{emp.name}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold tracking-wider text-[#8a95a8] uppercase">{displayPhone}</span>
                          <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-[rgba(255,255,255,0.1)]"></span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-[rgba(201,168,76,0.1)] text-[#c9a84c] border border-[rgba(201,168,76,0.2)]">
                            {emp.role || 'Staff'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status Toggle Group (Responsive) */}
                    <div className="flex justify-center sm:justify-start gap-1.5 p-1.5 bg-[#0b0f1a] rounded-xl w-full lg:w-max shadow-inner border border-[rgba(255,255,255,0.02)] mt-2 lg:mt-0">
                      <button
                        onClick={() => handleStatusChange(emp.id, 'present')}
                        className={`flex-1 lg:flex-none px-3 sm:px-5 py-2.5 sm:py-2 rounded-lg text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all border ${
                          currentStatus === 'present' 
                          ? 'bg-[rgba(52,211,153,0.15)] text-emerald-400 border-[rgba(52,211,153,0.3)] shadow-[0_0_15px_rgba(52,211,153,0.1)]' 
                          : 'border-transparent text-[#4a5568] hover:text-[#8a95a8] hover:bg-[rgba(255,255,255,0.05)]'
                        }`}
                      >
                        Present
                      </button>
                      <button
                        onClick={() => handleStatusChange(emp.id, 'absent')}
                        className={`flex-1 lg:flex-none px-3 sm:px-5 py-2.5 sm:py-2 rounded-lg text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all border ${
                          currentStatus === 'absent' 
                          ? 'bg-[rgba(248,113,113,0.15)] text-red-400 border-[rgba(248,113,113,0.3)] shadow-[0_0_15px_rgba(248,113,113,0.1)]' 
                          : 'border-transparent text-[#4a5568] hover:text-[#8a95a8] hover:bg-[rgba(255,255,255,0.05)]'
                        }`}
                      >
                        Absent
                      </button>
                      <button
                        onClick={() => handleStatusChange(emp.id, 'half')}
                        className={`flex-1 lg:flex-none px-3 sm:px-5 py-2.5 sm:py-2 rounded-lg text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all border ${
                          currentStatus === 'half' 
                          ? 'bg-[rgba(251,191,36,0.15)] text-yellow-400 border-[rgba(251,191,36,0.3)] shadow-[0_0_15px_rgba(251,191,36,0.1)]' 
                          : 'border-transparent text-[#4a5568] hover:text-[#8a95a8] hover:bg-[rgba(255,255,255,0.05)]'
                        }`}
                      >
                        Half Day
                      </button>
                    </div>

                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 border-t border-[rgba(255,255,255,0.04)] bg-[#1a2235] flex justify-end">
          <button 
            onClick={handleBulkSave} 
            disabled={isSaving || employees.length === 0}
            className="w-full sm:w-auto justify-center px-8 py-3.5 sm:py-3 rounded-xl flex items-center gap-2 bg-gradient-to-br from-[#c9a84c] to-[#f0c040] text-[#0a0900] disabled:opacity-60 font-extrabold transition-all shadow-[0_4px_16px_rgba(201,168,76,0.3)] hover:opacity-90 text-sm uppercase tracking-wider"
          >
            {isSaving ? (
               <><div className="w-4 h-4 border-2 border-[#0a0900] border-t-transparent rounded-full animate-spin"></div> Saving Records...</>
            ) : (
               <><Save className="w-5 h-5" /> Save All Attendance</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}