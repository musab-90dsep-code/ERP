import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Save, Calendar, ArrowLeft } from 'lucide-react';
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
      const existingRecord = attendance.find(a => a.employee_id === emp.id && a.date === selectedDate);
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
      employee_id: empId,
      date: selectedDate,
      status: status
    }));

    try {
      const { error } = await supabase.from('attendance').upsert(payload, { onConflict: 'employee_id, date' }); 
      if (error) throw error;
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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push('/employees/attendance')}
            className="flex items-center justify-center w-10 h-10 bg-white rounded-full border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Record Attendance</h1>
            <p className="text-sm text-gray-500 font-medium mt-0.5">Quickly mark present, absent or half-day for your staff</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 border-b border-gray-100 bg-gray-50/50 gap-4">
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm">
            <Calendar className="w-5 h-5 text-blue-600" /> 
            <div className="flex flex-col">
              <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider leading-none mb-1">Attendance Date</label>
              <input 
                type="date" 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-sm font-bold text-gray-800 border-none bg-transparent p-0 focus:ring-0 outline-none leading-none"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => markAllAs('present')}
              className="text-sm font-bold text-green-700 bg-green-50 hover:bg-green-100 px-4 py-2 rounded-lg border border-green-200 transition-colors"
            >
              Mark All Present
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white border-b border-gray-200 uppercase text-[10px] font-black text-gray-400 tracking-wider">
              <tr>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4 text-center">Attendance Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {employees.length === 0 ? (
                <tr><td colSpan={3} className="text-center py-10 text-gray-500">No employees registered yet.</td></tr>
              ) : (
                employees.map(emp => {
                  const currentStatus = statusMap[emp.id] || 'present';
                  return (
                    <tr key={emp.id} className={`transition-colors ${currentStatus === 'absent' ? 'bg-red-50/30' : currentStatus === 'half' ? 'bg-yellow-50/30' : 'hover:bg-gray-50'}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
                            {emp.profile_image_url ? (
                              <img src={emp.profile_image_url} alt={emp.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="font-bold text-gray-400">{emp.name?.charAt(0)}</span>
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">{emp.name}</p>
                            <p className="text-xs text-gray-500">{emp.phone || 'No phone'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md border border-gray-200">
                          {emp.role || 'Staff'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center gap-1.5 p-1 bg-gray-100/80 rounded-xl w-max mx-auto shadow-inner border border-gray-200/60">
                          <button
                            onClick={() => handleStatusChange(emp.id, 'present')}
                            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${currentStatus === 'present' ? 'bg-white text-green-600 shadow-sm ring-1 ring-gray-200/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}
                          >
                            Present
                          </button>
                          <button
                            onClick={() => handleStatusChange(emp.id, 'absent')}
                            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${currentStatus === 'absent' ? 'bg-white text-red-600 shadow-sm ring-1 ring-gray-200/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}
                          >
                            Absent
                          </button>
                          <button
                            onClick={() => handleStatusChange(emp.id, 'half')}
                            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${currentStatus === 'half' ? 'bg-white text-yellow-600 shadow-sm ring-1 ring-gray-200/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}
                          >
                            Half Day
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end">
          <button 
            onClick={handleBulkSave} 
            disabled={isSaving || employees.length === 0}
            className="bg-blue-600 text-white px-8 py-3 rounded-xl flex items-center gap-2 hover:bg-blue-700 disabled:opacity-60 font-bold transition-all shadow-md hover:shadow-lg focus:ring-4 focus:ring-blue-100"
          >
            {isSaving ? <span className="animate-pulse">Saving Records...</span> : <><Save className="w-5 h-5" /> Save All Attendance</>}
          </button>
        </div>
      </div>
    </div>
  );
}
