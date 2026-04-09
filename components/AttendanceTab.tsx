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
  
  // ড্যাশবোর্ড স্টেট
  const [selectedDate, setSelectedDate] = useState(getToday());

  // হিস্ট্রি ফিল্টার স্টেট
  const [filterDate, setFilterDate] = useState(''); 
  const [filterEmployee, setFilterEmployee] = useState('');

  const getEmployee = (id: string) => employees.find(e => e.id === id);
  const getEmployeeName = (id: string) => getEmployee(id)?.name ?? id;

  // ---------------- ১. টপ ড্যাশবোর্ডের লজিক (Selected Date এর উপর ভিত্তি করে) ----------------
  const selectedDateRecords = attendance.filter(a => a.date === selectedDate);
  const totalPresent = selectedDateRecords.filter(a => a.status === 'present').length;
  const totalAbsent = selectedDateRecords.filter(a => a.status === 'absent').length;
  const totalHalfDay = selectedDateRecords.filter(a => a.status === 'half').length;

  // ---------------- ২. হিস্ট্রি ফিল্টার লজিক ----------------
  const filteredAttendance = attendance.filter(a => {
    const matchDate = filterDate ? a.date === filterDate : true;
    const matchEmployee = filterEmployee ? a.employee_id === filterEmployee : true;
    return matchDate && matchEmployee;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-8">
      
      {/* ==================== হেডার এবং এন্ট্রি বাটন ==================== */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-800">Attendance Management</h1>
        <button 
          onClick={() => router.push('/employees/attendance-entry')}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 hover:bg-blue-700 font-bold shadow-md transition-all"
        >
          <CalendarPlus className="w-5 h-5" /> Entry Attendance
        </button>
      </div>

      {/* ==================== ১. ড্যাশবোর্ড কার্ডস ==================== */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 border-b border-gray-100 gap-4 bg-gray-50/50">
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            Daily Overview
          </h2>
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-gray-200 shadow-sm">
            <CalendarPlus className="w-4 h-4 text-gray-400" />
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border-none bg-transparent rounded-md p-0 text-sm font-bold text-gray-700 focus:ring-0 outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 p-6">
          <div className="bg-gradient-to-br from-green-50 to-green-100/50 border border-green-100 rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform">
              <UserCheck className="w-32 h-32 text-green-600" />
            </div>
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="bg-white p-2.5 rounded-xl shadow-sm border border-green-50">
                <UserCheck className="w-6 h-6 text-green-600" />
              </div>
              <span className="text-xs font-bold text-green-700 bg-green-200/50 px-2 py-1 rounded-md">Present</span>
            </div>
            <div className="relative z-10">
              <h3 className="text-4xl font-black text-gray-900">{totalPresent}</h3>
              <p className="text-sm text-gray-600 font-medium mt-1">Employees present</p>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-red-50 to-red-100/50 border border-red-100 rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform">
              <UserX className="w-32 h-32 text-red-600" />
            </div>
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="bg-white p-2.5 rounded-xl shadow-sm border border-red-50">
                <UserX className="w-6 h-6 text-red-600" />
              </div>
              <span className="text-xs font-bold text-red-700 bg-red-200/50 px-2 py-1 rounded-md">Absent</span>
            </div>
            <div className="relative z-10">
              <h3 className="text-4xl font-black text-gray-900">{totalAbsent}</h3>
              <p className="text-sm text-gray-600 font-medium mt-1">Employees absent</p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100/50 border border-yellow-100 rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform">
              <Clock className="w-32 h-32 text-yellow-600" />
            </div>
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="bg-white p-2.5 rounded-xl shadow-sm border border-yellow-50">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <span className="text-xs font-bold text-yellow-700 bg-yellow-200/50 px-2 py-1 rounded-md">Half Day</span>
            </div>
            <div className="relative z-10">
              <h3 className="text-4xl font-black text-gray-900">{totalHalfDay}</h3>
              <p className="text-sm text-gray-600 font-medium mt-1">Half day logged</p>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== ২. হিস্ট্রি এবং ফিল্টার ==================== */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            Attendance History
          </h2>
          
          {/* হিস্ট্রির জন্য আলাদা ফিল্টার */}
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
              <span className="text-sm text-gray-500 font-medium">Date:</span>
              <input 
                type="date" 
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="text-sm outline-none text-gray-700 font-medium bg-transparent"
              />
              {filterDate && (
                <button onClick={() => setFilterDate('')} className="text-xs text-red-500 hover:text-red-700 ml-1 font-bold">Clear</button>
              )}
            </div>
            
            <select 
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              className="border border-gray-200 rounded-lg p-2 text-sm outline-none focus:border-blue-500 bg-white min-w-[150px]"
            >
              <option value="">All Employees</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full text-left relative">
            <thead className="bg-white sticky top-0 border-b border-gray-200 z-10">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Employee</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredAttendance.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      <History className="w-10 h-10 mb-3 text-gray-300" />
                      <p className="text-base font-semibold text-gray-600">No attendance records found</p>
                      <p className="text-sm mt-1">Select a different date or staff member.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAttendance.map(a => {
                  const empInfo = getEmployee(a.employee_id);
                  return (
                  <tr key={a.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-bold text-gray-800">{a.date}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200">
                          {empInfo?.profile_image_url ? (
                             <img src={empInfo.profile_image_url} alt={empInfo.name} className="w-full h-full object-cover" />
                          ) : (
                             <span className="font-bold text-gray-400 text-xs">{empInfo?.name?.charAt(0) || '?'}</span>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{empInfo?.name || 'Unknown'}</p>
                          <p className="text-[10px] uppercase font-bold text-gray-500">{empInfo?.role || 'Staff'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold capitalize border ${
                        a.status === 'present' ? 'bg-green-50 text-green-700 border-green-200' : 
                        a.status === 'absent' ? 'bg-red-50 text-red-700 border-red-200' : 
                        'bg-yellow-50 text-yellow-700 border-yellow-200'
                      }`}>
                        {a.status === 'present' ? <UserCheck className="w-3.5 h-3.5" /> : a.status === 'absent' ? <UserX className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
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
                        className="text-gray-400 hover:text-red-600 transition-colors bg-white hover:bg-red-50 p-2 rounded-md border border-transparent hover:border-red-100 shadow-sm"
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