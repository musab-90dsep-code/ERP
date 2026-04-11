import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, DollarSign, Calendar, FileText, User, Receipt, Search, X, Banknote } from 'lucide-react';

interface TransactionTabProps {
  employees: any[];
  transactions: any[];
  attendance?: any[];
  fetchTransactions: () => Promise<void>;
  handleDelete: (table: string, id: string) => Promise<void>;
}

export default function TransactionTab({ employees, transactions, attendance = [], fetchTransactions, handleDelete }: TransactionTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [transData, setTransData] = useState({ employee_id: '', date: new Date().toISOString().split('T')[0], type: 'salary', amount: 0, note: '' });

  const handleTransSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('employee_transactions').insert({ ...transData });
    if (!error) { 
      setShowForm(false); 
      setTransData({ employee_id: '', date: new Date().toISOString().split('T')[0], type: 'salary', amount: 0, note: '' }); 
      fetchTransactions(); 
    }
  };

  const getEmployeeName = (id: string) => employees.find(e => e.id === id)?.name ?? id;
  const getEmployeePhoto = (id: string) => employees.find(e => e.id === id)?.profile_image_url;

  const filteredTransactions = transactions.filter(t => {
    const empName = getEmployeeName(t.employee_id).toLowerCase();
    return empName.includes(searchQuery.toLowerCase()) || t.type.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleDailyAllowances = async () => {
    if (!window.confirm('Calculate and pay daily allowances for the current month?')) return;
    setIsProcessing(true);
    const currentDate = new Date().toISOString().split('T')[0];
    const currentMonthPrefix = currentDate.slice(0, 7);
    const transactionsToInsert = [];

    for (const emp of employees) {
      if (!emp.daily_allowance || emp.daily_allowance <= 0) continue;
      const empAttendance = attendance.filter(a => 
        a.employee_id === emp.id && 
        a.date.startsWith(currentMonthPrefix) && 
        (a.status === 'present' || a.status === 'half')
      );
      const eligibleDays = empAttendance.length;
      if (eligibleDays > 0) {
        transactionsToInsert.push({
          employee_id: emp.id,
          date: currentDate,
          type: 'allowance',
          amount: eligibleDays * emp.daily_allowance,
          note: `Daily Allowance (${eligibleDays} days present)`
        });
      }
    }

    if (transactionsToInsert.length > 0) {
      const { error } = await supabase.from('employee_transactions').insert(transactionsToInsert);
      if (!error) {
        fetchTransactions();
        alert('Daily allowances paid successfully!');
      } else {
        alert('Failed to pay daily allowances.');
      }
    } else {
        alert('No eligible daily allowances found for this month.');
    }
    setIsProcessing(false);
  };

  const handleMonthlyAllowances = async () => {
    if (!window.confirm('Pay fixed monthly allowances to all eligible employees?')) return;
    setIsProcessing(true);
    const currentDate = new Date().toISOString().split('T')[0];
    const transactionsToInsert = [];

    for (const emp of employees) {
      if (!emp.monthly_allowance || emp.monthly_allowance <= 0) continue;
      transactionsToInsert.push({
        employee_id: emp.id,
        date: currentDate,
        type: 'allowance',
        amount: emp.monthly_allowance,
        note: `Monthly Allowance`
      });
    }

    if (transactionsToInsert.length > 0) {
      const { error } = await supabase.from('employee_transactions').insert(transactionsToInsert);
      if (!error) {
        fetchTransactions();
        alert('Monthly allowances paid successfully!');
      } else {
        alert('Failed to pay monthly allowances.');
      }
    } else {
      alert('No employees have monthly allowances configured.');
    }
    setIsProcessing(false);
  };

  // Calculate stats
  const totalPaid = transactions.reduce((acc, t) => acc + Number(t.amount || 0), 0);
  const totalSalary = transactions.filter(t => t.type === 'salary').reduce((acc, t) => acc + Number(t.amount || 0), 0);
  const totalAdvance = transactions.filter(t => t.type === 'advance').reduce((acc, t) => acc + Number(t.amount || 0), 0);

  return (
    <div className="space-y-8">
      {/* Header section with Stats */}
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-start sm:items-center flex-col sm:flex-row gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <Banknote className="w-7 h-7 text-green-600" />
              Salary & Payments
            </h1>
            <p className="text-sm text-gray-500 font-medium mt-1">Manage payroll, advances, and bonuses</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
             <button 
               onClick={handleDailyAllowances} 
               disabled={isProcessing}
               className="bg-indigo-50 text-indigo-700 px-4 py-2.5 rounded-xl font-bold border border-indigo-200 shadow-sm hover:bg-indigo-100 transition-colors disabled:opacity-50"
             >
               {isProcessing ? 'Processing...' : 'Pay Daily Allowances'}
             </button>
             <button 
               onClick={handleMonthlyAllowances} 
               disabled={isProcessing}
               className="bg-purple-50 text-purple-700 px-4 py-2.5 rounded-xl font-bold border border-purple-200 shadow-sm hover:bg-purple-100 transition-colors disabled:opacity-50"
             >
               {isProcessing ? 'Processing...' : 'Pay Monthly Allowances'}
             </button>
             <button 
               onClick={() => setShowForm(true)} 
               className="bg-green-600 text-white px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-green-700 font-bold shadow-md hover:shadow-lg transition-all w-full md:w-auto mt-2 sm:mt-0"
             >
               <Plus className="w-5 h-5" /> Record Payment
             </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
           <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="bg-blue-50 p-3 rounded-xl text-blue-600"><DollarSign className="w-6 h-6"/></div>
              <div>
                 <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Disbursed</p>
                 <h3 className="text-2xl font-black text-gray-900">${totalPaid.toLocaleString()}</h3>
              </div>
           </div>
           <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="bg-green-50 p-3 rounded-xl text-green-600"><Receipt className="w-6 h-6"/></div>
              <div>
                 <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Salary Paid</p>
                 <h3 className="text-2xl font-black text-gray-900">${totalSalary.toLocaleString()}</h3>
              </div>
           </div>
           <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="bg-purple-50 p-3 rounded-xl text-purple-600"><FileText className="w-6 h-6"/></div>
              <div>
                 <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Advances Issued</p>
                 <h3 className="text-2xl font-black text-gray-900">${totalAdvance.toLocaleString()}</h3>
              </div>
           </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 w-full">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-lg font-black text-gray-900">Record New Payment</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700 hover:bg-gray-200 p-1.5 rounded-full transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={handleTransSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Employee</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select required value={transData.employee_id} onChange={e => setTransData({ ...transData, employee_id: e.target.value })} className="w-full border border-gray-200 rounded-lg pl-10 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500 outline-none appearance-none bg-white font-medium">
                      <option value="" disabled>Select an employee</option>
                      {employees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.role}</option>)}
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input required type="date" value={transData.date} onChange={e => setTransData({ ...transData, date: e.target.value })} className="w-full border border-gray-200 rounded-lg pl-10 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500 outline-none font-medium" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Payment Type</label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <select value={transData.type} onChange={e => setTransData({ ...transData, type: e.target.value })} className="w-full border border-gray-200 rounded-lg pl-10 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500 outline-none appearance-none bg-white font-medium">
                        <option value="salary">Salary</option>
                        <option value="bonus">Bonus</option>
                        <option value="advance">Advance</option>
                        <option value="allowance">Allowance</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Amount</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input required type="number" value={transData.amount || ''} onChange={e => setTransData({ ...transData, amount: Number(e.target.value) })} className="w-full border border-gray-200 rounded-lg pl-10 pr-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-green-500 outline-none" placeholder="0.00" />
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Description / Memo</label>
                  <textarea rows={2} value={transData.note} onChange={e => setTransData({ ...transData, note: e.target.value })} className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none font-medium resize-none" placeholder="E.g. March 2026 Salary" />
                </div>
              </div>
              
              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                <button type="submit" className="bg-green-600 text-white px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-green-700 shadow-md transition-all">Submit Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
           <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-gray-500" /> Payment History
           </h2>
           <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                 type="text" 
                 placeholder="Search entries..." 
                 value={searchQuery}
                 onChange={e => setSearchQuery(e.target.value)}
                 className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
              />
           </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-white border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider">Employee</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider">Date & Time</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider">Payment Type</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider text-right">Amount</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider">Memo / Note</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-500">
                    <Banknote className="w-12 h-12 mx-auto text-gray-200 mb-3" />
                    <p className="font-semibold text-gray-600">No payment records found.</p>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(t => {
                   const empPhoto = getEmployeePhoto(t.employee_id);
                   const empName = getEmployeeName(t.employee_id);
                   return (
                   <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                     <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center shrink-0">
                              {empPhoto ? <img src={empPhoto} alt={empName} className="w-full h-full object-cover" /> : <span className="font-bold text-gray-400 text-xs">{empName.charAt(0)}</span>}
                           </div>
                           <span className="font-bold text-gray-900">{empName}</span>
                        </div>
                     </td>
                     <td className="px-6 py-4 font-medium text-gray-600 text-sm">{t.date}</td>
                     <td className="px-6 py-4">
                       <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                         t.type === 'salary' ? 'bg-green-50 text-green-700 border-green-200' :
                         t.type === 'bonus' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                         t.type === 'advance' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                         'bg-gray-100 text-gray-700 border-gray-200'
                       }`}>
                         {t.type}
                       </span>
                     </td>
                     <td className="px-6 py-4 text-right">
                       <span className="font-black text-gray-900">${Number(t.amount || 0).toLocaleString()}</span>
                     </td>
                     <td className="px-6 py-4">
                       <span className="text-sm font-medium text-gray-500">{t.note || <span className="italic opacity-50">N/A</span>}</span>
                     </td>
                     <td className="px-6 py-4 text-right">
                       <button onClick={() => { if(window.confirm('Delete this payment record?')) handleDelete('employee_transactions', t.id); }} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100">
                         <Trash2 className="w-4 h-4" />
                       </button>
                     </td>
                   </tr>
                 )})
               )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
