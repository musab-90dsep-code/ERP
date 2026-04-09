'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
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
    const { data, error } = await supabase.from('employees').select('*').order('created_at', { ascending: false });
    if (!error) setEmployees(data ?? []);
  };

  const fetchAttendance = async () => {
    const { data, error } = await supabase.from('attendance').select('*').order('date', { ascending: false });
    if (!error) setAttendance(data ?? []);
  };

  const fetchTransactions = async () => {
    const { data, error } = await supabase.from('employee_transactions').select('*').order('date', { ascending: false });
    if (!error) setTransactions(data ?? []);
  };

  const handleDelete = async (table: string, id: string) => {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (!error) {
      if (table === 'employees') fetchEmployees();
      if (table === 'attendance') fetchAttendance();
      if (table === 'employee_transactions') fetchTransactions();
    }
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
