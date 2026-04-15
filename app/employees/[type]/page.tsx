'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import EmployeeTab from '@/components/EmployeeTab';
import AttendanceTab from '@/components/AttendanceTab';
import AttendanceEntryTab from '@/components/AttendanceEntryTab';
import TransactionTab from '@/components/TransactionTab';

export default function EmployeesTypePage() {
  const params = useParams();
  const router = useRouter();
  const typeParam = params.type as string;

  const activeTab = typeParam === 'list' ? 'employees' : typeParam === 'attendance' ? 'attendance' : typeParam === 'transactions' ? 'transactions' : typeParam === 'attendance-entry' ? 'attendance-entry' : 'employees';

  const [employees, setEmployees] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    if (!['list', 'attendance', 'transactions', 'attendance-entry'].includes(typeParam)) {
      router.replace('/employees/list');
      return;
    }
    fetchEmployees();
    if (typeParam === 'attendance' || typeParam === 'attendance-entry' || typeParam === 'transactions') fetchAttendance();
    if (typeParam === 'transactions') fetchTransactions();
  }, [typeParam]);

  const fetchEmployees = async () => {
    try {
      const data = await api.getEmployees({ ordering: '-created_at' });
      setEmployees(Array.isArray(data) ? data : data.results ?? []);
    } catch (err) { console.error('fetchEmployees:', err); }
  };

  const fetchAttendance = async () => {
    try {
      const data = await api.getAttendance({ ordering: '-date' });
      setAttendance(Array.isArray(data) ? data : data.results ?? []);
    } catch (err) { console.error('fetchAttendance:', err); }
  };

  const fetchTransactions = async () => {
    try {
      const data = await api.getEmployeeTransactions({ ordering: '-date' });
      setTransactions(Array.isArray(data) ? data : data.results ?? []);
    } catch (err) { console.error('fetchTransactions:', err); }
  };

  const handleDelete = async (table: string, id: string) => {
    try {
      if (table === 'employees') { await api.deleteEmployee(id); fetchEmployees(); }
      else if (table === 'attendance') { await api.deleteAttendance(id); fetchAttendance(); }
      else if (table === 'employee_transactions') { await api.deleteEmployeeTransaction(id); fetchTransactions(); }
    } catch (err) { console.error('handleDelete:', err); }
  };

  return (
    <div>
      {activeTab === 'employees' && (
        <EmployeeTab 
          employees={employees} 
          fetchEmployees={fetchEmployees} 
          handleDelete={handleDelete} 
        />
      )}
      
      {activeTab === 'attendance' && (
        <AttendanceTab 
          employees={employees} 
          attendance={attendance} 
          handleDelete={handleDelete} 
        />
      )}
      
      {activeTab === 'transactions' && (
        <TransactionTab 
          employees={employees} 
          transactions={transactions} 
          attendance={attendance}
          fetchTransactions={fetchTransactions} 
          handleDelete={handleDelete} 
        />
      )}
      
      {activeTab === 'attendance-entry' && (
        <AttendanceEntryTab 
          employees={employees} 
          attendance={attendance} 
          fetchAttendance={fetchAttendance} 
        />
      )}
    </div>
  );
}
