'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Plus, Trash2, DollarSign, Calendar, FileText, User, Receipt, Search, X, Banknote, Wallet, CreditCard, CheckCircle, Clock, ChevronDown } from 'lucide-react';

interface TransactionTabProps {
  employees: any[];
  transactions: any[];
  attendance?: any[];
  fetchTransactions: () => Promise<void>;
  handleDelete: (table: string, id: string) => Promise<void>;
}

// Review Table Row Interface
interface PreviewRow {
  employee: string;
  name: string;
  role: string;
  photo?: string;
  eligibleDays: number;
  unpaidDates: string[]; // <-- NEW: Array of specific dates to display
  baseRate: number;
  hours?: number; // Added for overtime
  finalAmount: number;
  note: string;
  systemTag: string;
}

export default function TransactionTab({ employees, transactions, attendance = [], fetchTransactions, handleDelete }: TransactionTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [transData, setTransData] = useState({ employee: '', date: new Date().toISOString().split('T')[0], type: 'salary', amount: 0, note: '' });

  const [allowanceModal, setAllowanceModal] = useState<{ isOpen: boolean; type: 'daily' | 'monthly' | 'overtime' }>({ isOpen: false, type: 'daily' });
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]); // Format: YYYY-MM-DD
  const [previewList, setPreviewList] = useState<PreviewRow[]>([]);
  const [showAllowanceMenu, setShowAllowanceMenu] = useState(false);

  const getEmployeeName = (id: string) => employees.find(e => e.id === id)?.name ?? id;
  const getEmployeePhoto = (id: string) => employees.find(e => e.id === id)?.profile_image_url;

  // ── CORE LOGIC: Exact Date Tracking ──
  const generatePreview = (type: 'daily' | 'monthly' | 'overtime', dateStr: string) => {
    const list: PreviewRow[] = [];
    const formattedDate = new Date(dateStr).toLocaleDateString('default', { day: 'numeric', month: 'short', year: 'numeric' });

    employees.forEach(emp => {
      if (type === 'daily') {
        if (!emp.daily_allowance || emp.daily_allowance <= 0) return;

        // 1. Check if already paid for this exact date
        const isAlreadyPaid = transactions.some(t =>
          t.employee === emp.id &&
          t.type === 'allowance' &&
          t.note && t.note.includes(`[Paid Date: ${dateStr}]`)
        );

        if (isAlreadyPaid) return;

        // 2. Check if present on this exact date
        const isPresent = attendance.some(a =>
          a.employee === emp.id &&
          a.date === dateStr &&
          (a.status === 'present' || a.status === 'half')
        );

        if (isPresent) {
          list.push({
            employee: emp.id,
            name: emp.name,
            role: emp.role,
            photo: emp.profile_image_url,
            eligibleDays: 1,
            unpaidDates: [dateStr],
            baseRate: emp.daily_allowance,
            finalAmount: emp.daily_allowance,
            note: `Daily Allowance - ${formattedDate}`,
            systemTag: `[Paid Date: ${dateStr}]`
          });
        }
      } else if (type === 'monthly') {
        // --- MONTHLY ALLOWANCE LOGIC (Still monthly) ---
        if (!emp.monthly_allowance || emp.monthly_allowance <= 0) return;
        const monthStr = dateStr.slice(0, 7);

        const isAlreadyPaid = transactions.some(t =>
          t.employee === emp.id &&
          t.type === 'allowance' &&
          t.note && t.note.includes(`[Paid Month: ${monthStr}]`)
        );

        if (!isAlreadyPaid) {
          list.push({
            employee: emp.id,
            name: emp.name,
            role: emp.role,
            photo: emp.profile_image_url,
            eligibleDays: 0,
            unpaidDates: [],
            baseRate: emp.monthly_allowance,
            finalAmount: emp.monthly_allowance,
            note: `Monthly Fixed Allowance - ${new Date(monthStr + '-01').toLocaleString('default', { month: 'short', year: 'numeric' })}`,
            systemTag: `[Paid Month: ${monthStr}]`
          });
        }
      } else if (type === 'overtime') {
        // --- OVERTIME ALLOWANCE LOGIC (Day by Day) ---
        const isAlreadyPaid = transactions.some(t =>
          t.employee === emp.id &&
          t.type === 'overtime' &&
          t.note && t.note.includes(`[Paid OT Date: ${dateStr}]`)
        );

        if (!isAlreadyPaid) {
          list.push({
            employee: emp.id,
            name: emp.name,
            role: emp.role,
            photo: emp.profile_image_url,
            eligibleDays: 0,
            unpaidDates: [],
            baseRate: emp.overtime_rate || 0,
            hours: 0,
            finalAmount: 0,
            note: `Overtime Allowance - ${formattedDate}`,
            systemTag: `[Paid OT Date: ${dateStr}]`
          });
        }
      }
    });

    setPreviewList(list);
  };

  useEffect(() => {
    if (allowanceModal.isOpen) {
      generatePreview(allowanceModal.type, selectedDate);
    }
  }, [allowanceModal.isOpen, allowanceModal.type, selectedDate, employees, attendance, transactions]);

  const handleAmountEdit = (empId: string, newAmount: number) => {
    setPreviewList(prev => prev.map(row => row.employee === empId ? { ...row, finalAmount: newAmount } : row));
  };

  const handleHoursEdit = (empId: string, newHours: number) => {
    setPreviewList(prev => prev.map(row => {
      if (row.employee === empId) {
        const amount = newHours * (row.baseRate || 0);
        return { ...row, hours: newHours, finalAmount: amount };
      }
      return row;
    }));
  };

  const handleNoteEdit = (empId: string, newNote: string) => {
    setPreviewList(prev => prev.map(row => row.employee === empId ? { ...row, note: newNote } : row));
  };

  const handleConfirmDisburse = async () => {
    if (previewList.length === 0) {
      alert("No valid allowances to disburse.");
      return;
    }

    setIsProcessing(true);
    const transactionsToInsert = previewList
      .filter(row => row.finalAmount > 0)
      .map(row => ({
        employee: row.employee,
        date: selectedDate,
        type: allowanceModal.type === 'overtime' ? 'overtime_allowance' : 'allowance',
        amount: row.finalAmount,
        note: row.note ? `${row.note} ${row.systemTag}` : row.systemTag
      }));

    if (transactionsToInsert.length > 0) {
      try {
        await api.bulkCreateEmployeeTransactions(transactionsToInsert);
        fetchTransactions();
        setAllowanceModal({ isOpen: false, type: 'daily' });
      } catch (error) {
        alert('Failed to pay allowances.');
        console.error(error);
      }
    }
    setIsProcessing(false);
  };

  const handleTransSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createEmployeeTransaction({ ...transData });
      setShowForm(false);
      setTransData({ employee: '', date: new Date().toISOString().split('T')[0], type: 'salary', amount: 0, note: '' });
      fetchTransactions();
    } catch (e) {
      console.error(e);
      alert('Failed to save transaction.');
    }
  };

  const filteredTransactions = transactions.filter(t => {
    const empName = getEmployeeName(t.employee).toLowerCase();
    return empName.includes(searchQuery.toLowerCase()) || t.type.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const totalPaid = transactions.reduce((acc, t) => acc + Number(t.amount || 0), 0);
  const totalSalary = transactions.filter(t => t.type === 'salary').reduce((acc, t) => acc + Number(t.amount || 0), 0);
  const totalAdvance = transactions.filter(t => t.type === 'advance').reduce((acc, t) => acc + Number(t.amount || 0), 0);
  const totalOvertime = transactions.filter(t => t.type === 'overtime' || t.type === 'overtime_allowance').reduce((acc, t) => acc + Number(t.amount || 0), 0);

  const inputClass = "w-full bg-[#1a2235] border border-[rgba(255,255,255,0.06)] rounded-lg p-2.5 text-sm text-[#e8eaf0] focus:border-[#c9a84c] focus:ring-1 focus:ring-[rgba(201,168,76,0.3)] outline-none transition-colors";
  const labelClass = "block text-[10px] uppercase font-bold text-[#8a95a8] tracking-widest mb-2";

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'salary': return 'bg-[rgba(52,211,153,0.1)] text-emerald-400 border-[rgba(52,211,153,0.2)]';
      case 'bonus': return 'bg-[rgba(96,165,250,0.1)] text-blue-400 border-[rgba(96,165,250,0.2)]';
      case 'advance': return 'bg-[rgba(251,191,36,0.1)] text-yellow-400 border-[rgba(251,191,36,0.2)]';
      case 'allowance': return 'bg-[rgba(168,85,247,0.1)] text-purple-400 border-[rgba(168,85,247,0.2)]';
      case 'overtime': return 'bg-[rgba(249,115,22,0.1)] text-orange-400 border-[rgba(249,115,22,0.2)]';
      case 'overtime_allowance': return 'bg-[rgba(249,115,22,0.1)] text-orange-400 border-[rgba(249,115,22,0.2)]';
      default: return 'bg-[rgba(255,255,255,0.05)] text-[#8a95a8] border-[rgba(255,255,255,0.1)]';
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-[1400px] mx-auto pb-10 px-2 sm:px-0">

      {/* ── HEADER SECTION ── */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-[#131929] p-6 rounded-2xl border border-[rgba(255,255,255,0.04)] shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-[#c9a84c]" />
            <span className="text-xs font-bold tracking-[0.2em] text-[#8a95a8] uppercase">Financial Operations</span>
          </div>
          <h1 className="flex items-center gap-3 text-2xl font-black text-white tracking-tight">
            <Banknote className="w-6 h-6 text-[#c9a84c]" /> Salary & Payments
          </h1>
          <p className="text-[11px] font-bold text-[#8a95a8] uppercase tracking-wider mt-2">Manage payroll, advances, and allowances</p>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full xl:w-auto">
          {/* ── CONSOLIDATED ALLOWANCE DROPDOWN ── */}
          <div className="relative w-full sm:w-auto">
            <button
              onClick={() => setShowAllowanceMenu(!showAllowanceMenu)}
              className="w-full sm:w-auto justify-center bg-[#1a2235] text-[#c9a84c] px-6 py-3 rounded-lg text-[11px] uppercase tracking-widest font-black border border-[rgba(201,168,76,0.3)] shadow-sm hover:bg-[rgba(201,168,76,0.1)] transition-all flex items-center gap-2 group"
            >
              Pay Allowance
              <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${showAllowanceMenu ? 'rotate-180' : ''}`} />
            </button>

            {showAllowanceMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowAllowanceMenu(false)}
                />
                <div className="absolute right-0 left-0 sm:left-auto mt-3 sm:w-64 bg-[#131929] border border-[rgba(201,168,76,0.2)] rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.7)] z-50 overflow-hidden animate-in fade-in zoom-in slide-in-from-top-2 duration-200">
                  <div className="px-4 py-2 border-b border-[rgba(255,255,255,0.03)] bg-[#1a2235]/50">
                    <span className="text-[9px] font-black text-[#8a95a8] uppercase tracking-[0.2em]">Select Allowance Type</span>
                  </div>
                  <button
                    onClick={() => { setAllowanceModal({ isOpen: true, type: 'daily' }); setShowAllowanceMenu(false); }}
                    className="w-full text-left px-5 py-4 text-[10px] uppercase tracking-widest font-black text-blue-400 hover:bg-[rgba(96,165,250,0.1)] transition-all flex items-center justify-between group/item"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-[rgba(96,165,250,0.1)] border border-[rgba(96,165,250,0.1)] group-hover/item:border-[rgba(96,165,250,0.3)]">
                        <Calendar className="w-3.5 h-3.5" />
                      </div>
                      Daily Allowance
                    </div>
                    <Plus className="w-3 h-3 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                  </button>
                  <button
                    onClick={() => { setAllowanceModal({ isOpen: true, type: 'monthly' }); setShowAllowanceMenu(false); }}
                    className="w-full text-left px-5 py-4 text-[10px] uppercase tracking-widest font-black text-purple-400 hover:bg-[rgba(168,85,247,0.1)] transition-all flex items-center justify-between group/item"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-[rgba(168,85,247,0.1)] border border-[rgba(168,85,247,0.1)] group-hover/item:border-[rgba(168,85,247,0.3)]">
                        <Wallet className="w-3.5 h-3.5" />
                      </div>
                      Monthly Allowance
                    </div>
                    <Plus className="w-3 h-3 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                  </button>
                  <button
                    onClick={() => { setAllowanceModal({ isOpen: true, type: 'overtime' }); setShowAllowanceMenu(false); }}
                    className="w-full text-left px-5 py-4 text-[10px] uppercase tracking-widest font-black text-orange-400 hover:bg-[rgba(249,115,22,0.1)] transition-all flex items-center justify-between group/item"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-[rgba(249,115,22,0.1)] border border-[rgba(249,115,22,0.1)] group-hover/item:border-[rgba(249,115,22,0.3)]">
                        <Clock className="w-3.5 h-3.5" />
                      </div>
                      Overtime Allowance
                    </div>
                    <Plus className="w-3 h-3 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => setShowForm(true)}
            className="w-full sm:w-auto justify-center bg-gradient-to-br from-[#c9a84c] to-[#f0c040] text-[#0a0900] px-8 py-3 rounded-lg flex items-center gap-2 hover:opacity-90 font-extrabold shadow-[0_4px_16px_rgba(201,168,76,0.3)] transition-all"
          >
            <Plus className="w-4 h-4" /> Record Payment
          </button>
        </div>
      </div>

      {/* ── ALLOWANCE REVIEW MODAL ── */}
      {allowanceModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0b0f1a]/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-[#131929] rounded-2xl shadow-[0_16px_64px_rgba(0,0,0,0.9)] border border-[rgba(201,168,76,0.3)] w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">

            <div className="flex justify-between items-center p-6 border-b border-[rgba(255,255,255,0.06)] bg-[#1a2235]">
              <h2 className="text-base font-black text-white uppercase tracking-widest flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-[#c9a84c]" />
                Review Unpaid {allowanceModal.type === 'daily' ? 'Daily' : allowanceModal.type === 'monthly' ? 'Monthly' : 'Overtime'} Allowances
              </h2>
              <button type="button" onClick={() => setAllowanceModal({ isOpen: false, type: 'daily' })} className="text-[#8a95a8] hover:text-red-400 bg-[rgba(255,255,255,0.05)] p-2 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 bg-[#0b0f1a] border-b border-[rgba(255,255,255,0.04)] flex flex-wrap gap-4 items-center justify-between">
              <div>
                <label className={labelClass}>
                  {allowanceModal.type === 'monthly' ? 'Select Target Month' : 'Select Target Date'}
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a95a8]" />
                  <input
                    type={allowanceModal.type === 'monthly' ? 'month' : 'date'}
                    value={allowanceModal.type === 'monthly' ? selectedDate.slice(0, 7) : selectedDate}
                    onChange={e => {
                      if (allowanceModal.type === 'monthly') {
                        setSelectedDate(e.target.value + '-01'); // Ensure it becomes a valid date string
                      } else {
                        setSelectedDate(e.target.value);
                      }
                    }}
                    className={`${inputClass} pl-10 w-[200px] [color-scheme:dark]`}
                  />
                </div>
              </div>
              <div className="bg-[rgba(201,168,76,0.1)] px-4 py-3 rounded-xl border border-[rgba(201,168,76,0.2)]">
                <p className="text-[10px] uppercase tracking-widest text-[#c9a84c] font-bold">Total Disbursing</p>
                <p className="text-xl font-black text-white mt-1">৳ {previewList.reduce((acc, curr) => acc + Number(curr.finalAmount), 0).toLocaleString()}</p>
              </div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar p-6">
              {previewList.length === 0 ? (
                <div className="text-center py-16">
                  <FileText className="w-12 h-12 mx-auto text-[#1a2235] mb-4" />
                  <p className="font-bold text-[#8a95a8]">
                    No unpaid allowances found for this {allowanceModal.type === 'monthly' ? 'month' : 'date'}.
                  </p>
                  <p className="text-xs text-[#4a5568] mt-2">
                    All eligible allowances for {allowanceModal.type === 'monthly'
                      ? new Date(selectedDate).toLocaleDateString('default', { month: 'long', year: 'numeric' })
                      : new Date(selectedDate).toLocaleDateString('default', { day: 'numeric', month: 'short', year: 'numeric' })
                    } have already been paid or no records match.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[#1a2235] border-b border-[rgba(255,255,255,0.06)] sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-[10px] font-extrabold text-[#8a95a8] uppercase tracking-widest rounded-tl-lg">Employee</th>
                        {/* NEW: Updated Header for Unpaid Dates */}
                        {allowanceModal.type === 'daily' && <th className="px-4 py-3 text-[10px] font-extrabold text-[#8a95a8] uppercase tracking-widest">Unpaid Dates</th>}
                        {allowanceModal.type === 'overtime' && <th className="px-4 py-3 text-[10px] font-extrabold text-orange-400 uppercase tracking-widest text-right">Rate/Hr (৳)</th>}
                        {allowanceModal.type === 'overtime' && <th className="px-4 py-3 text-[10px] font-extrabold text-orange-400 uppercase tracking-widest text-right w-24">Hours</th>}
                        <th className="px-4 py-3 text-[10px] font-extrabold text-[#8a95a8] uppercase tracking-widest text-right">{allowanceModal.type === 'overtime' ? 'Total (৳)' : 'Base Rate'}</th>
                        <th className="px-4 py-3 text-[10px] font-extrabold text-[#c9a84c] uppercase tracking-widest text-right w-32">{allowanceModal.type === 'overtime' ? 'Final (৳)' : 'Final Amount (৳)'}</th>
                        <th className="px-4 py-3 text-[10px] font-extrabold text-[#8a95a8] uppercase tracking-widest rounded-tr-lg">Note / Memo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(255,255,255,0.02)]">
                      {previewList.map(row => (
                        <tr key={row.employee} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#0b0f1a] overflow-hidden flex items-center justify-center shrink-0 border border-[rgba(255,255,255,0.05)]">
                                {row.photo ? <img src={row.photo} alt={row.name} className="w-full h-full object-cover" /> : <span className="font-black text-[#4a5568] text-[10px] uppercase">{row.name.charAt(0)}</span>}
                              </div>
                              <div>
                                <span className="font-bold text-[#e8eaf0] text-sm block">{row.name}</span>
                                <span className="text-[9px] text-[#8a95a8] uppercase tracking-widest">{row.role}</span>
                              </div>
                            </div>
                          </td>
                          {/* NEW: Showing exact dates nicely */}
                          {allowanceModal.type === 'daily' && (
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1 max-w-[160px]">
                                {row.unpaidDates.map(date => (
                                  <span key={date} className="bg-[rgba(96,165,250,0.1)] text-blue-400 border border-[rgba(96,165,250,0.2)] px-1.5 py-0.5 rounded text-[10px] font-bold">
                                    {date.split('-')[2]} {/* Extracts day e.g., '15' from '2026-04-15' */}
                                  </span>
                                ))}
                              </div>
                              <div className="text-[9px] font-bold text-[#8a95a8] uppercase tracking-widest mt-1.5">
                                Total: {row.eligibleDays} Days
                              </div>
                            </td>
                          )}
                          {allowanceModal.type === 'overtime' && (
                            <td className="px-4 py-3 text-right">
                              <input
                                type="number"
                                value={row.baseRate}
                                onChange={(e) => setPreviewList(prev => prev.map(r => r.employee === row.employee ? { ...r, baseRate: Number(e.target.value), finalAmount: Number(e.target.value) * (r.hours || 0) } : r))}
                                className="w-20 bg-[#0b0f1a] border border-[rgba(255,255,255,0.05)] rounded text-right px-2 py-1 text-xs font-bold text-white focus:outline-none focus:border-[#c9a84c]"
                              />
                            </td>
                          )}
                          {allowanceModal.type === 'overtime' && (
                            <td className="px-4 py-3 text-right">
                              <input
                                type="number"
                                value={row.hours}
                                step="0.5"
                                onChange={(e) => handleHoursEdit(row.employee, Number(e.target.value))}
                                className="w-16 bg-[#0b0f1a] border border-orange-400/30 rounded text-right px-2 py-1 text-xs font-bold text-white focus:outline-none focus:border-orange-400"
                              />
                            </td>
                          )}
                          <td className="px-4 py-3 text-right font-medium text-[#8a95a8]">৳{allowanceModal.type === 'overtime' ? (row.baseRate * (row.hours || 0)).toLocaleString() : row.baseRate}</td>
                          <td className="px-4 py-3">
                            <div className="relative flex items-center">
                              <span className="absolute left-2 text-[#8a95a8] text-xs">৳</span>
                              <input
                                type="number"
                                value={row.finalAmount}
                                onChange={(e) => handleAmountEdit(row.employee, Number(e.target.value))}
                                className="w-full bg-[#0b0f1a] border border-[#c9a84c]/30 rounded text-right pr-2 pl-6 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-[#c9a84c]"
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={row.note}
                              onChange={(e) => handleNoteEdit(row.employee, e.target.value)}
                              className="w-full bg-[#0b0f1a] border border-[rgba(255,255,255,0.05)] rounded px-3 py-1.5 text-xs text-[#8a95a8] focus:outline-none focus:border-[#c9a84c]/50"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-[rgba(255,255,255,0.06)] bg-[#1a2235] flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setAllowanceModal({ isOpen: false, type: 'daily' })}
                className="px-6 py-2.5 text-sm font-bold text-[#8a95a8] border border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.05)] hover:text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDisburse}
                disabled={isProcessing || previewList.length === 0}
                className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white px-8 py-2.5 rounded-lg text-sm font-extrabold hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {isProcessing ? 'Processing...' : <><CheckCircle className="w-4 h-4" /> Confirm & Disburse</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STATS CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#131929] rounded-2xl p-4 border border-[rgba(255,255,255,0.04)] shadow-[0_4px_24px_rgba(0,0,0,0.5)] flex items-center gap-4 relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
            <Wallet className="w-32 h-32 text-blue-500" />
          </div>
          <div className="bg-[rgba(96,165,250,0.1)] p-3 rounded-xl border border-[rgba(96,165,250,0.2)] text-blue-400 relative z-10"><DollarSign className="w-5 h-5" /></div>
          <div className="relative z-10">
            <p className="text-[9px] font-bold text-[#8a95a8] uppercase tracking-widest mb-1">Total Disbursed</p>
            <h3 className="text-xl font-black text-white"><span className="text-[#8a95a8] font-bold mr-1">৳</span>{totalPaid.toLocaleString()}</h3>
          </div>
        </div>

        <div className="bg-[#131929] rounded-2xl p-4 border border-[rgba(255,255,255,0.04)] shadow-[0_4px_24px_rgba(0,0,0,0.5)] flex items-center gap-4 relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
            <Receipt className="w-32 h-32 text-emerald-500" />
          </div>
          <div className="bg-[rgba(52,211,153,0.1)] p-3 rounded-xl border border-[rgba(52,211,153,0.2)] text-emerald-400 relative z-10"><Receipt className="w-5 h-5" /></div>
          <div className="relative z-10">
            <p className="text-[9px] font-bold text-[#8a95a8] uppercase tracking-widest mb-1">Salary Paid</p>
            <h3 className="text-xl font-black text-white"><span className="text-[#8a95a8] font-bold mr-1">৳</span>{totalSalary.toLocaleString()}</h3>
          </div>
        </div>

        <div className="bg-[#131929] rounded-2xl p-4 border border-[rgba(255,255,255,0.04)] shadow-[0_4px_24px_rgba(0,0,0,0.5)] flex items-center gap-4 relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
            <CreditCard className="w-32 h-32 text-yellow-500" />
          </div>
          <div className="bg-[rgba(251,191,36,0.1)] p-3 rounded-xl border border-[rgba(251,191,36,0.2)] text-yellow-400 relative z-10"><FileText className="w-5 h-5" /></div>
          <div className="relative z-10">
            <p className="text-[9px] font-bold text-[#8a95a8] uppercase tracking-widest mb-1">Advances Issued</p>
            <h3 className="text-xl font-black text-white"><span className="text-[#8a95a8] font-bold mr-1">৳</span>{totalAdvance.toLocaleString()}</h3>
          </div>
        </div>

        <div className="bg-[#131929] rounded-2xl p-4 border border-[rgba(255,255,255,0.04)] shadow-[0_4px_24px_rgba(0,0,0,0.5)] flex items-center gap-4 relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
            <Clock className="w-32 h-32 text-orange-500" />
          </div>
          <div className="bg-[rgba(249,115,22,0.1)] p-3 rounded-xl border border-[rgba(249,115,22,0.2)] text-orange-400 relative z-10"><Clock className="w-5 h-5" /></div>
          <div className="relative z-10">
            <p className="text-[9px] font-bold text-[#8a95a8] uppercase tracking-widest mb-1">Overtime Paid</p>
            <h3 className="text-xl font-black text-white"><span className="text-[#8a95a8] font-bold mr-1">৳</span>{totalOvertime.toLocaleString()}</h3>
          </div>
        </div>
      </div>

      {/* ── RECORD PAYMENT MODAL ── */}
      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0b0f1a]/80 backdrop-blur-sm p-4 w-full animate-fade-in">
          <div className="bg-[#131929] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] border border-[rgba(201,168,76,0.2)] w-full max-w-lg overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-[rgba(255,255,255,0.04)] bg-[#1a2235]">
              <h2 className="text-sm font-black text-[#c9a84c] uppercase tracking-widest flex items-center gap-2">
                <Plus className="w-4 h-4" /> Record New Payment
              </h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-[#8a95a8] hover:text-white hover:bg-[rgba(255,255,255,0.05)] p-1.5 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleTransSubmit} className="p-6 sm:p-8 space-y-6">
              <div>
                <label className={labelClass}>Employee</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a95a8]" />
                  <select required value={transData.employee} onChange={e => setTransData({ ...transData, employee: e.target.value })} className={`${inputClass} pl-10 appearance-none`}>
                    <option value="" disabled>Select an employee</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.role}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className={labelClass}>Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a95a8]" />
                    <input required type="date" value={transData.date} onChange={e => setTransData({ ...transData, date: e.target.value })} className={`${inputClass} pl-10 [color-scheme:dark]`} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Payment Type</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a95a8]" />
                    <select value={transData.type} onChange={e => setTransData({ ...transData, type: e.target.value })} className={`${inputClass} pl-10 appearance-none`}>
                      <option value="salary">Salary</option>
                      <option value="bonus">Bonus</option>
                      <option value="advance">Advance</option>
                      <option value="allowance">Allowance</option>
                      <option value="overtime">Overtime</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className={labelClass}>Amount (৳)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a95a8]" />
                  <input required type="number" value={transData.amount || ''} onChange={e => setTransData({ ...transData, amount: Number(e.target.value) })} className={`${inputClass} pl-10 font-bold text-lg text-white`} placeholder="0.00" />
                </div>
              </div>

              <div>
                <label className={labelClass}>Description / Memo</label>
                <textarea rows={2} value={transData.note} onChange={e => setTransData({ ...transData, note: e.target.value })} className={`${inputClass} resize-none min-h-[80px]`} placeholder="E.g. March 2026 Salary" />
              </div>

              <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-[rgba(255,255,255,0.04)]">
                <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 text-sm font-bold text-[#8a95a8] border border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.05)] hover:text-white rounded-lg transition-colors">Cancel</button>
                <button type="submit" className="bg-gradient-to-br from-[#c9a84c] to-[#f0c040] text-[#0a0900] px-8 py-2.5 rounded-lg text-sm font-extrabold hover:opacity-90 shadow-[0_4px_16px_rgba(201,168,76,0.3)] transition-all">Submit Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── PAYMENT HISTORY ── */}
      <div className="bg-[#131929] rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.5)] border border-[rgba(255,255,255,0.04)] overflow-hidden">

        {/* Search Header */}
        <div className="p-6 border-b border-[rgba(255,255,255,0.04)] bg-[#1a2235] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-sm font-black text-[#c9a84c] flex items-center gap-2 uppercase tracking-widest">
            <Receipt className="w-4 h-4" /> Payment History
          </h2>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a95a8]" />
            <input
              type="text"
              placeholder="Search entries..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#0b0f1a] border border-[rgba(255,255,255,0.05)] rounded-xl text-sm text-[#e8eaf0] focus:outline-none focus:border-[#c9a84c] transition-colors shadow-inner"
            />
          </div>
        </div>

        {/* PC VIEW: TABLE */}
        <div className="hidden md:block overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#131929] border-b border-[rgba(255,255,255,0.04)]">
              <tr>
                <th className="px-6 py-4 text-[10px] font-extrabold text-[#8a95a8] uppercase tracking-widest">Employee</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-[#8a95a8] uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-[#8a95a8] uppercase tracking-widest">Type</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-[#8a95a8] uppercase tracking-widest">Memo</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-[#8a95a8] uppercase tracking-widest text-right">Amount</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-[#8a95a8] uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.02)]">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16">
                    <Banknote className="w-12 h-12 mx-auto text-[#1a2235] mb-4" />
                    <p className="font-bold text-[#8a95a8] text-sm">No payment records found.</p>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(t => {
                  const empPhoto = getEmployeePhoto(t.employee);
                  const empName = getEmployeeName(t.employee);
                  return (
                    <tr key={t.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#0b0f1a] border border-[rgba(255,255,255,0.05)] overflow-hidden flex items-center justify-center shrink-0">
                            {empPhoto ? <img src={empPhoto} alt={empName} className="w-full h-full object-cover" /> : <span className="font-black text-[#4a5568] uppercase text-[10px]">{empName.charAt(0)}</span>}
                          </div>
                          <span className="font-bold text-[#e8eaf0] text-sm group-hover:text-[#c9a84c] transition-colors">{empName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-[#8a95a8] text-xs">{t.date}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${getTypeBadge(t.type)}`}>
                          {t.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-semibold text-[#8a95a8] truncate max-w-[250px] block">{t.note || <span className="italic opacity-50">N/A</span>}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-black text-white text-base"><span className="text-xs text-[#8a95a8] mr-0.5">৳</span>{Number(t.amount || 0).toLocaleString()}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => { if (window.confirm('Delete this payment record?')) handleDelete('employee_transactions', t.id); }} className="p-2 text-[#8a95a8] hover:text-red-400 hover:bg-[rgba(248,113,113,0.1)] rounded-lg transition-colors border border-transparent hover:border-[rgba(248,113,113,0.2)] opacity-0 group-hover:opacity-100">
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

        {/* MOBILE VIEW: CARDS */}
        <div className="block md:hidden divide-y divide-[rgba(255,255,255,0.02)]">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-16">
              <Banknote className="w-12 h-12 mx-auto text-[#1a2235] mb-4" />
              <p className="font-bold text-[#8a95a8] text-sm">No payment records found.</p>
            </div>
          ) : (
            filteredTransactions.map(t => {
              const empPhoto = getEmployeePhoto(t.employee);
              const empName = getEmployeeName(t.employee);
              return (
                <div key={t.id} className="p-5 hover:bg-[rgba(255,255,255,0.02)] transition-colors">

                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#0b0f1a] border border-[rgba(255,255,255,0.05)] overflow-hidden flex items-center justify-center shrink-0">
                        {empPhoto ? <img src={empPhoto} alt={empName} className="w-full h-full object-cover" /> : <span className="font-black text-[#4a5568] uppercase">{empName.charAt(0)}</span>}
                      </div>
                      <div>
                        <span className="font-bold text-[#e8eaf0] text-sm block">{empName}</span>
                        <span className="text-[10px] font-bold text-[#8a95a8] uppercase tracking-widest">{t.date}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-white text-lg block leading-none"><span className="text-xs text-[#8a95a8] mr-0.5">৳</span>{Number(t.amount || 0).toLocaleString()}</span>
                      <span className={`inline-flex mt-1.5 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${getTypeBadge(t.type)}`}>
                        {t.type.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-[rgba(255,255,255,0.02)]">
                    <span className="text-[11px] font-medium text-[#8a95a8] italic overflow-hidden text-ellipsis whitespace-nowrap max-w-[200px]">{t.note || 'No memo attached'}</span>
                    <button onClick={() => { if (window.confirm('Delete this payment record?')) handleDelete('employee_transactions', t.id); }} className="p-2 text-[#4a5568] hover:text-red-400 bg-[#1a2235] hover:bg-[rgba(248,113,113,0.1)] rounded-lg transition-colors border border-[rgba(255,255,255,0.05)]">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

      </div>
    </div>
  );
}