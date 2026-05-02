'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Plus, Trash2, Wallet, Building2, X, Eye, Pencil, FileText, Search, Filter, MoreVertical, ChevronLeft, ChevronRight, Check, Lock, RefreshCcw, CheckCircle2, BarChart2, ShieldCheck, Target, LineChart, Info } from 'lucide-react';

export default function AccountsPage() {
   const [internalAccounts, setInternalAccounts] = useState<any[]>([]);
   const [paymentsIn, setPaymentsIn] = useState<any[]>([]);
   const [paymentsOut, setPaymentsOut] = useState<any[]>([]);
   const [addMoneyList, setAddMoneyList] = useState<any[]>([]);

   const [showAccountForm, setShowAccountForm] = useState(false);
   const [accountData, setAccountData] = useState({
      account_type: 'wallet', provider_name: '', account_name: '', account_number: '', branch: ''
   });
   const [editingId, setEditingId] = useState<string | null>(null);
   const [viewingAccount, setViewingAccount] = useState<any | null>(null);

   const [activeTab, setActiveTab] = useState<'all' | 'bank' | 'wallet'>('all');
   const [searchQuery, setSearchQuery] = useState('');
   const [currentPage, setCurrentPage] = useState(1);
   const pageSize = 5;

   useEffect(() => {
      fetchInternalAccounts();
   }, []);

   const fetchInternalAccounts = async () => {
      try {
         const data = await api.getInternalAccounts({ ordering: '-created_at' });
         setInternalAccounts(Array.isArray(data) ? data : data.results ?? []);
         
         const [pIn, pOut, addM] = await Promise.all([
            api.getPayments({ type: 'in', limit: 1000 }),
            api.getPayments({ type: 'out', limit: 1000 }),
            api.getAddMoney({ limit: 1000 })
         ]);
         
         setPaymentsIn(Array.isArray(pIn) ? pIn : pIn.results ?? []);
         setPaymentsOut(Array.isArray(pOut) ? pOut : pOut.results ?? []);
         setAddMoneyList(Array.isArray(addM) ? addM : addM.results ?? []);
      } catch (err) { console.error('fetchInternalAccounts:', err); }
   };

   const totalBalance = (paymentsIn.reduce((a, p) => a + Number(p.amount), 0) - paymentsOut.reduce((a, p) => a + Number(p.amount), 0) + addMoneyList.reduce((a, p) => a + Number(p.amount), 0));

   const getAccountBalance = (accountId: string) => {
      const pIn = paymentsIn.filter(p => p.payment_method_details?.internal_account_id === accountId).reduce((a, p) => a + Number(p.amount), 0);
      const pOut = paymentsOut.filter(p => p.payment_method_details?.internal_account_id === accountId).reduce((a, p) => a + Number(p.amount), 0);
      const am = addMoneyList.filter(m => m.payment_method_details?.internal_account_id === accountId).reduce((a, p) => a + Number(p.amount), 0);
      return pIn - pOut + am;
   };

   const handleAccountSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
         if (editingId) {
            await api.updateInternalAccount(editingId, accountData);
         } else {
            await api.createInternalAccount(accountData);
         }
         resetForm();
         fetchInternalAccounts();
      } catch (err) {
         alert('Error saving account. Please check your connection.');
      }
   };

   const handleEdit = (acc: any) => {
      setAccountData({
         account_type: acc.account_type || 'wallet',
         provider_name: acc.provider_name || '',
         account_name: acc.account_name || '',
         account_number: acc.account_number || '',
         branch: acc.branch || ''
      });
      setEditingId(acc.id);
      setShowAccountForm(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
   };

   const resetForm = () => {
      setShowAccountForm(false);
      setEditingId(null);
      setAccountData({ 
         account_type: 'wallet', 
         provider_name: '', 
         account_name: '', 
         account_number: '', 
         branch: '' 
      });
   };

   const handleDelete = async (_table: string, id: string) => {
      if (!window.confirm('Are you sure you want to delete this record?')) return;
      try {
         await api.deleteInternalAccount(id);
         fetchInternalAccounts();
      } catch (err) { console.error('deleteInternalAccount:', err); }
   };

   // Filtering & Pagination
   const filteredAccounts = internalAccounts.filter(acc => {
      if (activeTab === 'bank' && acc.account_type !== 'bank') return false;
      if (activeTab === 'wallet' && acc.account_type !== 'wallet') return false;
      
      if (searchQuery) {
         const q = searchQuery.toLowerCase();
         return (
            acc.provider_name?.toLowerCase().includes(q) ||
            acc.account_name?.toLowerCase().includes(q) ||
            acc.account_number?.toLowerCase().includes(q)
         );
      }
      return true;
   });

   const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / pageSize));
   const pagedAccounts = filteredAccounts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

   // Icons & Badges logic
   const getProviderIcon = (provider: string, type: string) => {
      const p = (provider || '').toLowerCase();
      if (p.includes('bkash')) return <div className="w-full h-full bg-[#e2136e] flex items-center justify-center"><svg className="w-4 h-4 text-white fill-current" viewBox="58 0 62 60"><path d="M110 30l-26-4 3.5 15.5z"/><path d="M110 30L90 3l-6.5 23.5z"/><path d="M83 26L62 1l27.5 3.5z"/><path d="M75 15l-11.5-11h3z"/><path d="M117 17l-5 13-8-11z"/><path d="M92 42l19-7.5 1-2.5z"/><path d="M76 56l8-29 4 19z"/><path d="M118 17l-2 5.5 7.5-.1z"/></svg></div>;
      if (p.includes('nagad')) return <div className="w-full h-full bg-[#f97316] flex items-center justify-center"><svg className="w-4 h-4 text-white fill-current" viewBox="0 0 100 100"><path d="M50 0C22.4 0 0 22.4 0 50s22.4 50 50 50 50-22.4 50-50S77.6 0 50 0zm0 85C30.7 85 15 69.3 15 50S30.7 15 50 15s35 15.7 35 35-15.7 35-35 35z" opacity={0.3} /><path d="M50 25c-13.8 0-25 11.2-25 25s11.2 25 25 25h3.2v-1.8c-2.4-4.8-2.6-11.4 1.3-16.7 4-5.3 11.3-7.5 17.6-5.4 6 2 10.3 7.8 10.3 14.1 0 12.5-9.6 22.2-22.4 22.2V90c21 0 38.6-17.7 38.6-39.6S80.4 25 50 25z" /></svg></div>;
      if (p.includes('brac')) return <div className="w-full h-full bg-[#2563eb] flex items-center justify-center"><Building2 className="w-4 h-4 text-white" /></div>;
      if (p.includes('city')) return <div className="w-full h-full bg-blue-500 flex items-center justify-center"><Building2 className="w-4 h-4 text-white" /></div>;
      if (p.includes('dutch') || p.includes('dbbl')) return <div className="w-full h-full bg-white flex items-center justify-center text-red-500 font-black text-[10px] italic"><span className="text-[#0a3a6a]">DB</span>BL</div>;
      
      return <div className="w-full h-full bg-[#1e293b] flex items-center justify-center">{type === 'wallet' ? <Wallet className="w-4 h-4 text-white" /> : <Building2 className="w-4 h-4 text-white" />}</div>;
   }

   const getProviderBadge = (provider: string, type: string) => {
      const p = (provider || '').toLowerCase();
      if (p.includes('bkash')) return <span className="px-2.5 py-1 rounded-md border border-[#e2136e]/30 bg-[#e2136e]/10 text-[#e2136e] text-[10px] font-bold tracking-wider">bKash</span>;
      if (p.includes('nagad')) return <span className="px-2.5 py-1 rounded-md border border-[#f97316]/30 bg-[#f97316]/10 text-[#f97316] text-[10px] font-bold tracking-wider">Nagad</span>;
      return <span className="px-2.5 py-1 rounded-md border border-[#3b82f6]/30 bg-[#3b82f6]/10 text-[#3b82f6] text-[10px] font-bold tracking-wider">Bank</span>;
   }

   // Design Constants
   const C = {
      input: "w-full border border-[rgba(255,255,255,0.1)] rounded-xl p-3 bg-[#0f172a] text-[#e8eaf0] placeholder-[#64748b] focus:ring-1 focus:ring-[#fbbf24] focus:border-[#fbbf24] outline-none transition-all font-medium text-sm",
      label: "block text-[11px] font-bold text-[#94a3b8] mb-1.5 uppercase tracking-widest",
      buttonPrimary: "bg-[#fbbf24] hover:bg-[#f59e0b] text-[#0f172a] font-bold px-8 py-3 rounded-xl transition-all shadow-lg disabled:opacity-60 flex items-center justify-center gap-2"
   };

   return (
      <div className="pb-12 font-sans animate-in fade-in duration-300">

         {/* ─── VIEW MODAL ─── */}
         {viewingAccount && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0f1a]/80 backdrop-blur-sm p-4 w-full animate-fade-in">
               <div className="bg-[#111827] border border-[#1f2937] rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
                  <div className="p-6 border-b border-[#1f2937] bg-[#0f172a] flex justify-between items-center">
                     <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${viewingAccount.account_type === 'wallet' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>
                           {viewingAccount.account_type === 'wallet' ? <Wallet className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                        </div>
                        <h3 className="font-bold text-white uppercase tracking-wider text-sm">Account Details</h3>
                     </div>
                     <button onClick={() => setViewingAccount(null)} className="p-2 text-[#64748b] hover:text-white bg-[#1e293b] rounded-xl border border-[#334155]">
                        <X className="w-4 h-4" />
                     </button>
                  </div>

                  <div className="p-8 space-y-6">
                     <div>
                        <label className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest mb-1 block">Provider / Bank</label>
                        <p className={`text-2xl font-bold ${viewingAccount.account_type === 'wallet' ? 'text-emerald-400' : 'text-blue-400'}`}>{viewingAccount.provider_name}</p>
                     </div>

                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                           <label className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest mb-1 block">Account Number</label>
                           <p className="text-lg font-bold text-white font-mono">{viewingAccount.account_number}</p>
                        </div>
                        <div>
                           <label className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest mb-1 block">Type</label>
                           <p className="text-sm font-bold text-[#fbbf24] uppercase">{viewingAccount.account_type}</p>
                        </div>
                     </div>

                     <div className="pt-6 border-t border-[#1f2937]">
                        <div className="flex justify-between items-center mb-4">
                           <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-widest">Account Holder</span>
                           <span className="text-sm font-bold text-white">{viewingAccount.account_name || 'N/A'}</span>
                        </div>
                        {viewingAccount.branch && (
                           <div className="flex justify-between items-center">
                              <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-widest">Branch</span>
                              <span className="text-sm font-bold text-[#fbbf24]">{viewingAccount.branch}</span>
                           </div>
                        )}
                        <div className="flex justify-between items-center mt-4">
                           <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-widest">Calculated Balance</span>
                           <span className="text-sm font-bold text-emerald-400 font-mono">৳ {getAccountBalance(viewingAccount.id).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                     </div>
                  </div>

                  <div className="p-6 bg-[#0f172a] border-t border-[#1f2937] flex justify-end">
                     <button onClick={() => setViewingAccount(null)} className="px-6 py-2 bg-[#1e293b] text-white rounded-xl font-bold text-xs uppercase tracking-widest border border-[#334155] hover:bg-[#334155] transition-colors">
                        Close Window
                     </button>
                  </div>
               </div>
            </div>
         )}

         {/* Dynamic Header */}
         <div className="p-8 rounded-3xl text-white shadow-xl border border-[#1f2937] relative overflow-hidden mb-8 transition-colors duration-500 bg-gradient-to-r from-[#0d1613] to-[#121e1a]">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-[#fbbf24] opacity-5 blur-3xl pointer-events-none"></div>
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
               <div>
                  <p className="text-[#fbbf24] font-bold mb-1.5 text-xs tracking-widest uppercase flex items-center gap-2">
                     <Wallet className="w-4 h-4" /> Company Assets
                  </p>
                  <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2 text-[#f8fafc]">
                     My Internal Accounts
                  </h1>
                  <p className="text-[#94a3b8] max-w-xl text-sm font-medium">
                     Securely manage and track your business bank and mobile wallet accounts.
                  </p>
               </div>
               <button onClick={() => { if (showAccountForm) resetForm(); else setShowAccountForm(true); }} className="bg-[#fbbf24] text-[#0f172a] px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-[#f59e0b] transition-colors shadow-lg text-sm">
                  <Plus className="w-4 h-4" /> Add New Account
               </button>
            </div>

            {/* Summary Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
               <div className="bg-[#0f172a]/80 backdrop-blur-md p-5 rounded-2xl border border-white/5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                     <Wallet className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                     <p className="text-[11px] font-bold text-[#94a3b8] mb-0.5">Total Accounts</p>
                     <p className="text-xl font-bold text-white">{internalAccounts.length}</p>
                     <p className="text-[11px] text-[#64748b] mt-0.5">All active accounts</p>
                  </div>
               </div>

               <div className="bg-[#0f172a]/80 backdrop-blur-md p-5 rounded-2xl border border-white/5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                     <Building2 className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                     <p className="text-[11px] font-bold text-[#94a3b8] mb-0.5">Total Balance</p>
                     <p className="text-xl font-bold text-white font-mono">৳ {totalBalance.toLocaleString()}</p>
                     <p className="text-[11px] text-[#64748b] mt-0.5">All accounts balance</p>
                  </div>
               </div>

               <div className="bg-[#0f172a]/80 backdrop-blur-md p-5 rounded-2xl border border-white/5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                     <Building2 className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                     <p className="text-[11px] font-bold text-[#94a3b8] mb-0.5">Bank Accounts</p>
                     <p className="text-xl font-bold text-white">{internalAccounts.filter(a => a.account_type === 'bank').length}</p>
                     <p className="text-[11px] text-[#64748b] mt-0.5">Active bank accounts</p>
                  </div>
               </div>

               <div className="bg-[#0f172a]/80 backdrop-blur-md p-5 rounded-2xl border border-white/5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                     <Wallet className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                     <p className="text-[11px] font-bold text-[#94a3b8] mb-0.5">Mobile Wallets</p>
                     <p className="text-xl font-bold text-white">{internalAccounts.filter(a => a.account_type === 'wallet').length}</p>
                     <p className="text-[11px] text-[#64748b] mt-0.5">Active wallet accounts</p>
                  </div>
               </div>
            </div>
         </div>

         <div className="space-y-6">
            {showAccountForm && (
               <div className="bg-[#0f172a] rounded-2xl shadow-2xl border border-[#1f2937] overflow-hidden animate-in slide-in-from-top-4 duration-300 pb-0 mb-8">
                  {/* Header */}
                  <div className="p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-[#1f2937]">
                     <div>
                        <div className="flex items-center gap-2 text-xs font-bold text-[#64748b] mb-2">
                           <span>My Internal Accounts</span> <ChevronRight className="w-3 h-3" /> <span className="text-white">Add New Account</span>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-1">{editingId ? 'Edit Account' : 'Add New Account'}</h2>
                        <p className="text-sm text-[#94a3b8]">{accountData.account_type === 'wallet' ? 'Add your mobile wallet account to manage transactions.' : 'Add your bank account to manage business transactions.'}</p>
                     </div>
                     <div className="flex gap-3">
                        <button onClick={resetForm} className="px-6 py-2.5 rounded-xl border border-[#334155] text-white font-bold text-sm hover:bg-[#1e293b] transition-colors">Cancel</button>
                        <button onClick={handleAccountSubmit} className="px-6 py-2.5 bg-[#fbbf24] hover:bg-[#f59e0b] text-[#0f172a] font-bold text-sm rounded-xl transition-all shadow-[0_0_15px_rgba(251,191,36,0.2)] flex items-center gap-2">
                           <Lock className="w-4 h-4" /> {editingId ? 'Update Account' : 'Save Account'}
                        </button>
                     </div>
                  </div>

                  {/* Stepper */}
                  <div className="border-b border-[#1f2937] px-6 sm:px-8 py-5 flex items-center justify-between overflow-x-auto no-scrollbar gap-8">
                     {/* Step 1 */}
                     <div className={`flex items-center gap-4 ${accountData.account_type === 'wallet' ? '' : 'opacity-100'}`}>
                        {accountData.account_type === 'wallet' ? (
                           <div className="w-10 h-10 rounded-full bg-[#fbbf24] flex items-center justify-center font-bold text-[#0f172a] shrink-0">1</div>
                        ) : (
                           <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-[#0f172a] shrink-0"><Check className="w-5 h-5" /></div>
                        )}
                        <div>
                           <div className={`text-sm font-bold ${accountData.account_type === 'wallet' ? 'text-[#fbbf24]' : 'text-emerald-500'}`}>Account Information</div>
                           <div className="text-xs text-[#64748b]">Enter basic details</div>
                        </div>
                     </div>
                     {/* Arrow */}
                     <div className="hidden md:block w-24 lg:w-32 h-[1px] bg-[#334155] relative shrink-0">
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 border-t border-r border-[#334155] rotate-45"></div>
                     </div>
                     {/* Step 2 */}
                     <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 ${accountData.account_type === 'bank' ? 'bg-[#fbbf24] text-[#0f172a]' : 'bg-[#1e293b] text-[#94a3b8]'}`}>2</div>
                        <div>
                           <div className={`text-sm font-bold ${accountData.account_type === 'bank' ? 'text-[#fbbf24]' : 'text-[#94a3b8]'}`}>Account Details</div>
                           <div className="text-xs text-[#64748b]">Provide account information</div>
                        </div>
                     </div>
                     {/* Arrow */}
                     <div className="hidden md:block w-24 lg:w-32 h-[1px] bg-[#334155] relative shrink-0">
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 border-t border-r border-[#334155] rotate-45"></div>
                     </div>
                     {/* Step 3 */}
                     <div className="flex items-center gap-4 opacity-50">
                        <div className="w-10 h-10 rounded-full bg-[#1e293b] flex items-center justify-center font-bold text-[#94a3b8] shrink-0">3</div>
                        <div>
                           <div className="text-sm font-bold text-[#94a3b8]">Review & Save</div>
                           <div className="text-xs text-[#64748b]">Confirm and save account</div>
                        </div>
                     </div>
                  </div>

                  {/* Main Content Area */}
                  <div className="flex flex-col lg:flex-row border-b border-[#1f2937]">
                     
                     {/* Left Sidebar - Account Type */}
                     <div className="w-full lg:w-80 border-r border-[#1f2937] p-6 sm:p-8 bg-[#0b1120]">
                        <div className="text-[11px] font-bold text-[#64748b] uppercase tracking-widest mb-4">Account Type</div>
                        
                        <div className="space-y-3 mb-8">
                           <button type="button" onClick={() => setAccountData({ ...accountData, account_type: 'wallet' })} className={`w-full p-4 rounded-xl flex items-center gap-4 font-bold text-sm transition-all border-2 ${accountData.account_type === 'wallet' ? 'bg-[#fbbf24]/5 border-[#fbbf24] text-[#fbbf24] shadow-[0_0_15px_rgba(251,191,36,0.1)]' : 'bg-[#111827] border-[#1f2937] text-[#f8fafc] hover:border-[#334155]'}`}>
                              <Wallet className={`w-6 h-6 ${accountData.account_type === 'wallet' ? 'text-[#fbbf24]' : 'text-[#f8fafc]'}`} />
                              Mobile Wallet
                           </button>
                           <button type="button" onClick={() => setAccountData({ ...accountData, account_type: 'bank' })} className={`w-full p-4 rounded-xl flex items-center gap-4 font-bold text-sm transition-all border-2 ${accountData.account_type === 'bank' ? 'bg-[#fbbf24]/5 border-[#fbbf24] text-[#fbbf24] shadow-[0_0_15px_rgba(251,191,36,0.1)]' : 'bg-[#111827] border-[#1f2937] text-[#f8fafc] hover:border-[#334155]'}`}>
                              <Building2 className={`w-6 h-6 ${accountData.account_type === 'bank' ? 'text-[#fbbf24]' : 'text-[#f8fafc]'}`} />
                              Bank Account
                           </button>
                        </div>

                        <div className={`p-4 rounded-xl border flex items-start gap-3 ${accountData.account_type === 'wallet' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-200' : 'bg-blue-500/10 border-blue-500/20 text-blue-200'}`}>
                           <Info className={`w-5 h-5 shrink-0 ${accountData.account_type === 'wallet' ? 'text-indigo-400' : 'text-blue-400'}`} />
                           <p className="text-[13px] leading-relaxed">
                              {accountData.account_type === 'wallet' 
                                 ? 'Mobile wallets help you manage digital payments quickly and securely.' 
                                 : 'Add your company bank account to easily track receipts and payments.'}
                           </p>
                        </div>
                     </div>

                     {/* Right Content - Form Fields */}
                     <div className="flex-1 p-6 sm:p-8">
                        {accountData.account_type === 'wallet' ? (
                           <div className="space-y-8 animate-in fade-in">
                              <div>
                                 <div className="text-[11px] font-bold text-[#64748b] uppercase tracking-widest mb-4">Wallet Provider</div>
                                 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    {['bKash', 'Nagad', 'Rocket', 'Upay'].map(wallet => {
                                       const isSelected = accountData.provider_name === wallet;
                                       return (
                                          <button 
                                             key={wallet} 
                                             type="button"
                                             onClick={() => setAccountData({ ...accountData, provider_name: wallet })}
                                             className={`p-4 rounded-xl border flex items-center justify-center gap-2 font-bold text-sm transition-all ${isSelected ? (wallet==='bKash' ? 'border-[#e2136e] bg-[#e2136e]/10 shadow-[0_0_15px_rgba(226,19,110,0.15)] text-white' : wallet==='Nagad' ? 'border-[#f97316] bg-[#f97316]/10 shadow-[0_0_15px_rgba(249,115,22,0.15)] text-white' : wallet==='Rocket' ? 'border-[#a855f7] bg-[#a855f7]/10 shadow-[0_0_15px_rgba(168,85,247,0.15)] text-white' : 'border-[#3b82f6] bg-[#3b82f6]/10 shadow-[0_0_15px_rgba(59,130,246,0.15)] text-white') : 'border-[#1f2937] bg-[#0b1120] text-[#f8fafc] hover:border-[#334155]'}`}
                                          >
                                             {wallet === 'bKash' ? <span className="text-[#e2136e]"><svg className="w-4 h-4 fill-current" viewBox="58 0 62 60"><path d="M110 30l-26-4 3.5 15.5z"/><path d="M110 30L90 3l-6.5 23.5z"/><path d="M83 26L62 1l27.5 3.5z"/><path d="M75 15l-11.5-11h3z"/><path d="M117 17l-5 13-8-11z"/><path d="M92 42l19-7.5 1-2.5z"/><path d="M76 56l8-29 4 19z"/><path d="M118 17l-2 5.5 7.5-.1z"/></svg></span> :
                                              wallet === 'Nagad' ? <span className="text-[#f97316]"><svg className="w-4 h-4 fill-current" viewBox="0 0 100 100"><path d="M50 0C22.4 0 0 22.4 0 50s22.4 50 50 50 50-22.4 50-50S77.6 0 50 0zm0 85C30.7 85 15 69.3 15 50S30.7 15 50 15s35 15.7 35 35-15.7 35-35 35z" opacity={0.3} /><path d="M50 25c-13.8 0-25 11.2-25 25s11.2 25 25 25h3.2v-1.8c-2.4-4.8-2.6-11.4 1.3-16.7 4-5.3 11.3-7.5 17.6-5.4 6 2 10.3 7.8 10.3 14.1 0 12.5-9.6 22.2-22.4 22.2V90c21 0 38.6-17.7 38.6-39.6S80.4 25 50 25z" /></svg></span> :
                                              wallet === 'Rocket' ? <span className="text-[#a855f7]"><svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 2L2 22l10-5 10 5L12 2z"/></svg></span> :
                                              <span className="text-[#fbbf24]"><Wallet className="w-4 h-4" /></span>}
                                             {wallet}
                                          </button>
                                       );
                                    })}
                                 </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                 <div>
                                    <label className={C.label}>Account / Wallet Name</label>
                                    <input type="text" placeholder="e.g. bKash Personal" value={accountData.account_name || ''} onChange={e => setAccountData({ ...accountData, account_name: e.target.value })} className={C.input} />
                                 </div>
                                 <div>
                                    <label className={C.label}>Wallet Number <span className="text-red-500">*</span></label>
                                    <input required type="text" placeholder="e.g. 017XXXXXXXX" value={accountData.account_number || ''} onChange={e => setAccountData({ ...accountData, account_number: e.target.value })} className={`${C.input} font-mono`} />
                                 </div>
                                 <div>
                                    <label className={C.label}>Account Holder Name</label>
                                    <input type="text" placeholder="e.g. John Doe" className={C.input} />
                                 </div>
                                 <div>
                                    <label className={C.label}>Nickname (Optional)</label>
                                    <input type="text" placeholder="e.g. Personal Wallet" className={C.input} />
                                 </div>
                                 <div className="md:col-span-2">
                                    <label className={C.label}>Additional Note (Optional)</label>
                                    <textarea placeholder="Enter any note..." rows={3} className={C.input} />
                                 </div>
                              </div>
                           </div>
                        ) : (
                           <div className="space-y-8 animate-in fade-in">
                              <div className="text-[11px] font-bold text-[#64748b] uppercase tracking-widest mb-4">Bank Information</div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                 <div>
                                    <label className={C.label}>Bank Name <span className="text-red-500">*</span></label>
                                    <input required type="text" placeholder="e.g. City Bank Limited" value={accountData.provider_name || ''} onChange={e => setAccountData({ ...accountData, provider_name: e.target.value })} className={C.input} />
                                 </div>
                                 <div>
                                    <label className={C.label}>Branch <span className="text-red-500">*</span></label>
                                    <input required type="text" placeholder="e.g. Gulshan Branch" value={accountData.branch || ''} onChange={e => setAccountData({ ...accountData, branch: e.target.value })} className={C.input} />
                                 </div>
                                 <div>
                                    <label className={C.label}>Account Number <span className="text-red-500">*</span></label>
                                    <input required type="text" placeholder="e.g. 1234567890123" value={accountData.account_number || ''} onChange={e => setAccountData({ ...accountData, account_number: e.target.value })} className={`${C.input} font-mono`} />
                                 </div>
                                 <div>
                                    <label className={C.label}>Account Name <span className="text-red-500">*</span></label>
                                    <input required type="text" placeholder="e.g. LedgerGhor Ltd." value={accountData.account_name || ''} onChange={e => setAccountData({ ...accountData, account_name: e.target.value })} className={C.input} />
                                 </div>
                                 <div>
                                    <label className={C.label}>Account Type</label>
                                    <select className={C.input}>
                                       <option>-- Select Account Type --</option>
                                       <option>Current Account</option>
                                       <option>Savings Account</option>
                                    </select>
                                 </div>
                                 <div>
                                    <label className={C.label}>Currency</label>
                                    <select className={C.input}>
                                       <option>BDT (৳)</option>
                                       <option>USD ($)</option>
                                    </select>
                                 </div>
                                 <div className="md:col-span-2">
                                    <label className={C.label}>Additional Note (Optional)</label>
                                    <textarea placeholder="Enter any note..." rows={3} className={C.input} />
                                 </div>
                              </div>
                           </div>
                        )}
                     </div>
                  </div>

                  {/* Footer Features */}
                  <div className="p-6 bg-[#0b1120] flex flex-row items-center justify-between gap-6 overflow-x-auto no-scrollbar">
                     {accountData.account_type === 'wallet' ? (
                        <>
                           <div className="flex items-center gap-3 shrink-0 md:w-1/4">
                              <div className="w-8 h-8 rounded-lg border border-[#fbbf24]/20 flex items-center justify-center shrink-0"><Lock className="w-4 h-4 text-[#fbbf24]" /></div>
                              <div>
                                 <div className="text-xs font-bold text-white">Secure</div>
                                 <div className="text-[10px] text-[#64748b]">256-bit encryption</div>
                              </div>
                           </div>
                           <div className="flex items-center gap-3 shrink-0 md:w-1/4 border-l border-[#1f2937] pl-6">
                              <div className="w-8 h-8 rounded-lg border border-[#fbbf24]/20 flex items-center justify-center shrink-0"><RefreshCcw className="w-4 h-4 text-[#fbbf24]" /></div>
                              <div>
                                 <div className="text-xs font-bold text-white">Real-time Sync</div>
                                 <div className="text-[10px] text-[#64748b]">Instant balance update</div>
                              </div>
                           </div>
                           <div className="flex items-center gap-3 shrink-0 md:w-1/4 border-l border-[#1f2937] pl-6">
                              <div className="w-8 h-8 rounded-lg border border-emerald-500/20 flex items-center justify-center shrink-0"><CheckCircle2 className="w-4 h-4 text-emerald-400" /></div>
                              <div>
                                 <div className="text-xs font-bold text-white">Easy Tracking</div>
                                 <div className="text-[10px] text-[#64748b]">All transactions in one place</div>
                              </div>
                           </div>
                           <div className="flex items-center gap-3 shrink-0 md:w-1/4 border-l border-[#1f2937] pl-6">
                              <div className="w-8 h-8 rounded-lg border border-[#fbbf24]/20 flex items-center justify-center shrink-0"><BarChart2 className="w-4 h-4 text-[#fbbf24]" /></div>
                              <div>
                                 <div className="text-xs font-bold text-white">Smart Reports</div>
                                 <div className="text-[10px] text-[#64748b]">Detailed analytics</div>
                              </div>
                           </div>
                        </>
                     ) : (
                        <>
                           <div className="flex items-center gap-3 shrink-0 md:w-1/4">
                              <div className="w-8 h-8 rounded-lg border border-[#fbbf24]/20 flex items-center justify-center shrink-0"><ShieldCheck className="w-4 h-4 text-[#fbbf24]" /></div>
                              <div>
                                 <div className="text-xs font-bold text-white">Safe & Secure</div>
                                 <div className="text-[10px] text-[#64748b]">Your data is protected</div>
                              </div>
                           </div>
                           <div className="flex items-center gap-3 shrink-0 md:w-1/4 border-l border-[#1f2937] pl-6">
                              <div className="w-8 h-8 rounded-lg border border-[#fbbf24]/20 flex items-center justify-center shrink-0"><Target className="w-4 h-4 text-[#fbbf24]" /></div>
                              <div>
                                 <div className="text-xs font-bold text-white">Accurate Tracking</div>
                                 <div className="text-[10px] text-[#64748b]">Track every transaction</div>
                              </div>
                           </div>
                           <div className="flex items-center gap-3 shrink-0 md:w-1/4 border-l border-[#1f2937] pl-6">
                              <div className="w-8 h-8 rounded-lg border border-[#fbbf24]/20 flex items-center justify-center shrink-0"><Building2 className="w-4 h-4 text-[#fbbf24]" /></div>
                              <div>
                                 <div className="text-xs font-bold text-white">Multi-Bank Support</div>
                                 <div className="text-[10px] text-[#64748b]">All banks in one place</div>
                              </div>
                           </div>
                           <div className="flex items-center gap-3 shrink-0 md:w-1/4 border-l border-[#1f2937] pl-6">
                              <div className="w-8 h-8 rounded-lg border border-[#fbbf24]/20 flex items-center justify-center shrink-0"><LineChart className="w-4 h-4 text-[#fbbf24]" /></div>
                              <div>
                                 <div className="text-xs font-bold text-white">Financial Control</div>
                                 <div className="text-[10px] text-[#64748b]">Better cash flow control</div>
                              </div>
                           </div>
                        </>
                     )}
                  </div>
               </div>
            )}

            {/* Table Layout */}
            <div className="bg-[#111827] rounded-2xl border border-[#1f2937] overflow-hidden shadow-lg">
               
               {/* Tabs & Search Row */}
               <div className="px-4 pt-4 border-b border-[#1f2937] flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                  <div className="flex gap-6 overflow-x-auto w-full md:w-auto no-scrollbar">
                     <button onClick={() => {setActiveTab('all'); setCurrentPage(1);}} className={`pb-4 border-b-2 font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'all' ? 'border-[#fbbf24] text-[#fbbf24]' : 'border-transparent text-[#94a3b8] hover:text-[#cbd5e1]'}`}>All Accounts</button>
                     <button onClick={() => {setActiveTab('bank'); setCurrentPage(1);}} className={`pb-4 border-b-2 font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'bank' ? 'border-[#fbbf24] text-[#fbbf24]' : 'border-transparent text-[#94a3b8] hover:text-[#cbd5e1]'}`}>Bank Accounts</button>
                     <button onClick={() => {setActiveTab('wallet'); setCurrentPage(1);}} className={`pb-4 border-b-2 font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'wallet' ? 'border-[#fbbf24] text-[#fbbf24]' : 'border-transparent text-[#94a3b8] hover:text-[#cbd5e1]'}`}>Mobile Wallets</button>
                  </div>
                  <div className="flex items-center gap-3 w-full md:w-auto pb-4">
                     <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />
                        <input 
                           type="text" 
                           placeholder="Search account by name, number..." 
                           value={searchQuery} 
                           onChange={e => {setSearchQuery(e.target.value); setCurrentPage(1);}} 
                           className="w-full bg-[#0f172a] border border-[#1f2937] rounded-xl py-2 pl-9 pr-4 text-sm text-[#e8eaf0] outline-none focus:border-[#fbbf24] transition-colors" 
                        />
                     </div>
                     <button className="p-2 border border-[#fbbf24]/30 rounded-xl bg-[#fbbf24]/10 text-[#fbbf24] hover:bg-[#fbbf24]/20 transition-colors">
                        <Filter className="w-4 h-4" />
                     </button>
                  </div>
               </div>

               {/* Table Content */}
               <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                     <thead>
                        <tr className="border-b border-[#1f2937] text-[10px] font-bold text-[#64748b] uppercase tracking-wider bg-[#0f172a]">
                           <th className="p-4 pl-6">Account Name</th>
                           <th className="p-4">Type</th>
                           <th className="p-4">Account / Wallet No.</th>
                           <th className="p-4">Balance</th>
                           <th className="p-4">Status</th>
                           <th className="p-4 pr-6 text-right">Actions</th>
                        </tr>
                     </thead>
                     <tbody>
                        {pagedAccounts.length === 0 ? (
                           <tr>
                              <td colSpan={6} className="p-8 text-center text-[#64748b]">
                                 No accounts found.
                              </td>
                           </tr>
                        ) : (
                           pagedAccounts.map(acc => (
                              <tr key={acc.id} className="border-b border-[#1f2937]/50 hover:bg-[#1e293b]/50 transition-colors">
                                 <td className="p-4 pl-6">
                                    <div className="flex items-center gap-3">
                                       <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                                          {getProviderIcon(acc.provider_name, acc.account_type)}
                                       </div>
                                       <div>
                                          <div className="font-bold text-[#f8fafc] text-[13px]">{acc.provider_name}</div>
                                          <div className="text-[11px] text-[#94a3b8] mt-0.5">{acc.account_name ? acc.account_name : (acc.account_type === 'wallet' ? 'Mobile Wallet' : 'Bank Account')}</div>
                                       </div>
                                    </div>
                                 </td>
                                 <td className="p-4">
                                    {getProviderBadge(acc.provider_name, acc.account_type)}
                                 </td>
                                 <td className="p-4 font-mono text-[13px] text-[#cbd5e1]">
                                    {acc.account_number}
                                 </td>
                                 <td className="p-4 font-mono text-[13px] font-bold text-emerald-400">
                                    <span className="flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> ৳ {getAccountBalance(acc.id).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                 </td>
                                 <td className="p-4">
                                    <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-500 text-[10px] font-bold border border-emerald-500/20">Active</span>
                                 </td>
                                 <td className="p-4 pr-6">
                                    <div className="flex items-center justify-end gap-1.5">
                                       <button onClick={() => setViewingAccount(acc)} title="View Details" className="p-1.5 text-[#64748b] hover:text-white bg-[#1e293b] rounded-lg border border-[#334155] hover:border-[#64748b] transition-colors"><Eye className="w-4 h-4" /></button>
                                       <button onClick={() => handleEdit(acc)} title="Edit Account" className="p-1.5 text-[#64748b] hover:text-[#fbbf24] bg-[#1e293b] rounded-lg border border-[#334155] hover:border-[#fbbf24]/50 transition-colors"><Pencil className="w-4 h-4" /></button>
                                       <button onClick={() => handleDelete('internal_accounts', acc.id)} title="Delete Account" className="p-1.5 text-[#64748b] hover:text-red-500 bg-[#1e293b] rounded-lg border border-[#334155] hover:border-red-500/50 transition-colors"><MoreVertical className="w-4 h-4" /></button>
                                    </div>
                                 </td>
                              </tr>
                           ))
                        )}
                     </tbody>
                  </table>
               </div>

               {/* Pagination Row */}
               {filteredAccounts.length > 0 && (
                  <div className="p-4 border-t border-[#1f2937] flex flex-col sm:flex-row justify-between items-center gap-4 bg-[#0f172a]/50">
                     <div className="text-[12px] text-[#64748b]">
                        Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredAccounts.length)} of {filteredAccounts.length} accounts
                     </div>
                     <div className="flex items-center gap-1.5">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#64748b] hover:text-white hover:bg-[#1e293b] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#64748b] transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                        {[...Array(totalPages)].map((_, i) => (
                           <button 
                              key={i} 
                              onClick={() => setCurrentPage(i+1)} 
                              className={`w-8 h-8 rounded-lg text-[13px] font-bold flex items-center justify-center transition-colors ${currentPage === i+1 ? 'bg-[#fbbf24]/10 text-[#fbbf24] border border-[#fbbf24]/30' : 'text-[#64748b] hover:text-white hover:bg-[#1e293b]'}`}
                           >
                              {i+1}
                           </button>
                        ))}
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#64748b] hover:text-white hover:bg-[#1e293b] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#64748b] transition-colors"><ChevronRight className="w-4 h-4" /></button>
                     </div>
                  </div>
               )}
            </div>
         </div>
      </div>
   );
}