'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Plus, Trash2, Wallet, Building2, X, Eye, Pencil, FileText } from 'lucide-react';

export default function AccountsPage() {
   const [internalAccounts, setInternalAccounts] = useState<any[]>([]);
   const [showAccountForm, setShowAccountForm] = useState(false);

   const [accountData, setAccountData] = useState({
      account_type: 'wallet', provider_name: '', account_name: '', account_number: '', branch: ''
   });
   const [editingId, setEditingId] = useState<string | null>(null);
   const [viewingAccount, setViewingAccount] = useState<any | null>(null);

   useEffect(() => {
      fetchInternalAccounts();
   }, []);

   const fetchInternalAccounts = async () => {
      try {
         const data = await api.getInternalAccounts({ ordering: '-created_at' });
         setInternalAccounts(Array.isArray(data) ? data : data.results ?? []);
      } catch (err) { console.error('fetchInternalAccounts:', err); }
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
         account_type: acc.account_type,
         provider_name: acc.provider_name,
         account_name: acc.account_name,
         account_number: acc.account_number,
         branch: acc.branch || ''
      });
      setEditingId(acc.id);
      setShowAccountForm(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
   };

   const resetForm = () => {
      setShowAccountForm(false);
      setEditingId(null);
      setAccountData({ account_type: 'wallet', provider_name: '', account_name: '', account_number: '', branch: '' });
   };

   const handleDelete = async (_table: string, id: string) => {
      if (!window.confirm('Are you sure you want to delete this record?')) return;
      try {
         await api.deleteInternalAccount(id);
         fetchInternalAccounts();
      } catch (err) { console.error('deleteInternalAccount:', err); }
   };

   // Design Constants
   const C = {
      input: "w-full border border-[rgba(201,168,76,0.18)] rounded-xl p-3.5 bg-[#131929] text-[#e8eaf0] placeholder-[#4a5568] focus:ring-2 focus:ring-[#c9a84c] outline-none transition-all font-bold",
      label: "block text-[11px] font-black text-[#8a95a8] mb-2 uppercase tracking-widest",
      buttonPrimary: "bg-gradient-to-br from-[#c9a84c] to-[#f0c040] hover:opacity-90 text-[#0a0900] font-extrabold px-8 py-3.5 rounded-xl transition-all shadow-[0_4px_14px_rgba(201,168,76,0.35)] disabled:opacity-60 flex items-center justify-center gap-2"
   };

   return (
      <div className="pb-12 font-sans animate-in fade-in duration-300">

         {/* ─── VIEW MODAL ─── */}
         {viewingAccount && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0f1a]/80 backdrop-blur-sm p-4 w-full animate-fade-in">
               <div className="bg-[#131929] border border-[rgba(201,168,76,0.2)] rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] w-full max-w-lg overflow-hidden flex flex-col">
                  <div className="p-6 border-b border-[rgba(255,255,255,0.04)] bg-[#1a2235] flex justify-between items-center">
                     <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${viewingAccount.account_type === 'wallet' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>
                           {viewingAccount.account_type === 'wallet' ? <Wallet className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                        </div>
                        <h3 className="font-black text-white uppercase tracking-wider">Account Details</h3>
                     </div>
                     <button onClick={() => setViewingAccount(null)} className="p-2 text-[#8a95a8] hover:text-white bg-[#131929] rounded-xl border border-white/5">
                        <X className="w-5 h-5" />
                     </button>
                  </div>

                  <div className="p-8 space-y-6">
                     <div>
                        <label className="text-[10px] font-black text-[#8a95a8] uppercase tracking-[0.2em] mb-2 block">Provider / Bank</label>
                        <p className={`text-2xl font-black ${viewingAccount.account_type === 'wallet' ? 'text-emerald-400' : 'text-blue-400'}`}>{viewingAccount.provider_name}</p>
                     </div>

                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                           <label className="text-[10px] font-black text-[#8a95a8] uppercase tracking-[0.2em] mb-2 block">Account Number</label>
                           <p className="text-lg font-black text-white font-mono tracking-wider">{viewingAccount.account_number}</p>
                        </div>
                        <div>
                           <label className="text-[10px] font-black text-[#8a95a8] uppercase tracking-[0.2em] mb-2 block">Type</label>
                           <p className="text-sm font-bold text-[#c9a84c] uppercase">{viewingAccount.account_type}</p>
                        </div>
                     </div>

                     <div className="pt-6 border-t border-white/5">
                        <div className="flex justify-between items-center mb-4">
                           <span className="text-[10px] font-black text-[#8a95a8] uppercase tracking-widest">Account Holder</span>
                           <span className="text-sm font-bold text-white">{viewingAccount.account_name || 'N/A'}</span>
                        </div>
                        {viewingAccount.branch && (
                           <div className="flex justify-between items-center">
                              <span className="text-[10px] font-black text-[#8a95a8] uppercase tracking-widest">Branch</span>
                              <span className="text-sm font-bold text-[#c9a84c]">{viewingAccount.branch}</span>
                           </div>
                        )}
                     </div>
                  </div>

                  <div className="p-6 bg-[#1a2235]/40 border-t border-white/5 flex justify-end">
                     <button onClick={() => setViewingAccount(null)} className="px-6 py-2.5 bg-[#131929] text-[#e8eaf0] rounded-xl font-black text-xs uppercase tracking-widest border border-white/10 hover:bg-[#1a2235] transition-colors">
                        Close Window
                     </button>
                  </div>
               </div>
            </div>
         )}

         {/* Dynamic Header */}
         <div className="p-8 rounded-3xl text-white shadow-[0_4px_24px_rgba(0,0,0,0.5)] border border-[rgba(201,168,76,0.18)] relative overflow-hidden mb-8 transition-colors duration-500 bg-gradient-to-r from-[#0d1613] to-[#121e1a]">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-[#c9a84c] opacity-5 blur-3xl pointer-events-none"></div>
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
               <div>
                  <p className="text-[#c9a84c] font-black mb-1.5 text-xs tracking-widest uppercase flex items-center gap-2">
                     <Wallet className="w-4 h-4" /> Company Assets
                  </p>
                  <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2 text-[#e8eaf0]">
                     My Internal Accounts
                  </h1>
                  <p className="text-[#8a95a8] max-w-xl text-sm md:text-base font-medium">
                     Securely manage and track your business bank and mobile wallet accounts.
                  </p>
               </div>
            </div>
         </div>

         <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
               <div>
                  <h2 className="text-2xl font-black text-[#e8eaf0] tracking-tight">Saved Accounts</h2>
                  <p className="text-sm text-[#8a95a8] font-medium mt-1">Manage your internal company bank and mobile wallet accounts.</p>
               </div>
               <button onClick={() => { if (showAccountForm) resetForm(); else setShowAccountForm(true); }} className="w-full sm:w-auto bg-gradient-to-br from-[#c9a84c] to-[#f0c040] text-[#0a0900] px-6 py-3 rounded-xl font-extrabold flex justify-center items-center gap-2 hover:scale-[1.02] transform transition-all shadow-[0_4px_14px_rgba(201,168,76,0.35)]">
                  {showAccountForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                  {showAccountForm ? 'Cancel Form' : 'Add New Account'}
               </button>
            </div>

            {showAccountForm && (
               <div className="bg-[#131929] rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] border border-[rgba(201,168,76,0.18)] overflow-hidden animate-in slide-in-from-top-4 duration-300 pb-2">
                  <div className="p-6 border-b border-[rgba(255,255,255,0.06)] bg-[#1a2235]/40 flex items-center gap-3">
                     <div className="p-2 bg-[rgba(201,168,76,0.1)] rounded-lg border border-[rgba(201,168,76,0.18)]">
                        <FileText className="w-5 h-5 text-[#c9a84c]" />
                     </div>
                     <h3 className="font-black text-[#e8eaf0] text-lg uppercase tracking-wider">{editingId ? 'Edit Account' : 'New Account Details'}</h3>
                  </div>

                  <form onSubmit={handleAccountSubmit} className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                     <div className="md:col-span-2 flex flex-col sm:flex-row gap-4 pb-4">
                        <button type="button" onClick={() => setAccountData({ ...accountData, account_type: 'wallet' })} className={`flex-1 py-4 px-4 rounded-2xl flex items-center justify-center gap-3 font-black uppercase tracking-widest text-xs transition-all border ${accountData.account_type === 'wallet' ? 'bg-[rgba(52,211,153,0.1)] border-[rgba(52,211,153,0.3)] text-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.15)]' : 'bg-[#1a2235] border-[rgba(255,255,255,0.06)] text-[#8a95a8] hover:bg-[#1a2235]/80'}`}>
                           <Wallet className={`w-5 h-5 ${accountData.account_type === 'wallet' ? 'text-emerald-400' : 'text-[#4a5568]'}`} />
                           Mobile Wallet
                        </button>
                        <button type="button" onClick={() => setAccountData({ ...accountData, account_type: 'bank' })} className={`flex-1 py-4 px-4 rounded-2xl flex items-center justify-center gap-3 font-black uppercase tracking-widest text-xs transition-all border ${accountData.account_type === 'bank' ? 'bg-[rgba(96,165,250,0.1)] border-[rgba(96,165,250,0.3)] text-blue-400 shadow-[0_0_15px_rgba(96,165,250,0.15)]' : 'bg-[#1a2235] border-[rgba(255,255,255,0.06)] text-[#8a95a8] hover:bg-[#1a2235]/80'}`}>
                           <Building2 className={`w-5 h-5 ${accountData.account_type === 'bank' ? 'text-blue-400' : 'text-[#4a5568]'}`} />
                           Bank Account
                        </button>
                     </div>

                     {accountData.account_type === 'wallet' ? (
                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#1a2235]/40 p-6 sm:p-8 rounded-3xl border border-[rgba(255,255,255,0.06)] shadow-inner relative">
                           <div className="md:col-span-2">
                              <label className={C.label}>Select Wallet Provider</label>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                                 {['Bikash', 'Nagad', 'Rocket', 'Upay'].map(wallet => {
                                    let colorCls = '';
                                    if (accountData.provider_name === wallet) {
                                       if (wallet === 'Bikash') colorCls = 'bg-[rgba(244,114,182,0.1)] border-pink-500/40 text-pink-400 shadow-[0_0_10px_rgba(244,114,182,0.15)]';
                                       if (wallet === 'Nagad') colorCls = 'bg-[rgba(251,146,60,0.1)] border-orange-500/40 text-orange-400 shadow-[0_0_10px_rgba(251,146,60,0.15)]';
                                       if (wallet === 'Rocket') colorCls = 'bg-[rgba(192,132,252,0.1)] border-purple-500/40 text-purple-400 shadow-[0_0_10px_rgba(192,132,252,0.15)]';
                                       if (wallet === 'Upay') colorCls = 'bg-[rgba(96,165,250,0.1)] border-blue-500/40 text-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.15)]';
                                    } else {
                                       colorCls = 'bg-[#131929] border-[rgba(255,255,255,0.06)] text-[#8a95a8] hover:border-[rgba(201,168,76,0.3)] hover:text-[#e8eaf0]';
                                    }

                                    return (
                                       <label key={wallet} className={`cursor-pointer w-full text-center py-3.5 px-2 rounded-xl font-black uppercase tracking-widest text-[10px] sm:text-xs transition-all border ${colorCls}`}>
                                          <input type="radio" required name="walletProvider" value={wallet} className="hidden" checked={accountData.provider_name === wallet} onChange={e => setAccountData({ ...accountData, provider_name: e.target.value })} />
                                          {wallet}
                                       </label>
                                    );
                                 })}
                              </div>
                           </div>
                           <div>
                              <label className={C.label}>Wallet Name (Optional)</label>
                              <input type="text" placeholder="e.g. John Doe" value={accountData.account_name} onChange={e => setAccountData({ ...accountData, account_name: e.target.value })} className={C.input} />
                           </div>
                           <div>
                              <label className={C.label}>Wallet Number</label>
                              <input required type="text" placeholder="e.g. 017..." value={accountData.account_number} onChange={e => setAccountData({ ...accountData, account_number: e.target.value })} className={`${C.input} font-mono text-emerald-400 placeholder:text-[#4a5568]`} />
                           </div>
                        </div>
                     ) : (
                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#1a2235]/40 p-6 sm:p-8 rounded-3xl border border-[rgba(255,255,255,0.06)] shadow-inner">
                           <div className="md:col-span-2">
                              <label className={C.label}>Bank Name</label>
                              <input required type="text" placeholder="e.g. City Bank" value={accountData.provider_name} onChange={e => setAccountData({ ...accountData, provider_name: e.target.value })} className={C.input} />
                           </div>
                           <div className="md:col-span-2">
                              <label className={C.label}>Bank Account Name</label>
                              <input required type="text" placeholder="e.g. John Doe" value={accountData.account_name} onChange={e => setAccountData({ ...accountData, account_name: e.target.value })} className={C.input} />
                           </div>
                           <div>
                              <label className={C.label}>Account Number</label>
                              <input required type="text" placeholder="e.g. 1234567..." value={accountData.account_number} onChange={e => setAccountData({ ...accountData, account_number: e.target.value })} className={`${C.input} font-mono text-blue-400 placeholder:text-[#4a5568]`} />
                           </div>
                           <div>
                              <label className={C.label}>Branch</label>
                              <input required type="text" placeholder="e.g. Gulshan Branch" value={accountData.branch} onChange={e => setAccountData({ ...accountData, branch: e.target.value })} className={C.input} />
                           </div>
                        </div>
                     )}

                     <div className="md:col-span-2 flex justify-end gap-3 pt-6 border-t border-[rgba(255,255,255,0.06)] mt-2">
                        {editingId && (
                           <button type="button" onClick={resetForm} className="px-6 py-3.5 rounded-xl border border-white/10 text-[#8a95a8] font-bold text-xs uppercase tracking-widest hover:bg-white/5 transition-colors">
                              Discard Changes
                           </button>
                        )}
                        <button type="submit" className={`${C.buttonPrimary} w-full sm:w-auto`}>{editingId ? 'Update Account' : 'Save Account Securely'}</button>
                     </div>
                  </form>
               </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {internalAccounts.map(acc => (
                  <div
                     key={acc.id}
                     onClick={() => setViewingAccount(acc)}
                     className="bg-[#131929] rounded-3xl p-6 sm:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.5)] border border-[rgba(201,168,76,0.18)] flex flex-col relative overflow-hidden group hover:border-[rgba(201,168,76,0.4)] transition-colors hover:-translate-y-1 duration-300 cursor-pointer"
                  >
                     {/* Decorative Background Element */}
                     <div className={`absolute -right-10 -top-10 w-40 h-40 rounded-full opacity-[0.03] transition-transform duration-500 group-hover:scale-[1.8] group-hover:opacity-10 pointer-events-none ${acc.account_type === 'wallet' ? 'bg-emerald-500' : 'bg-blue-500'}`}></div>

                     <div className="flex justify-between items-start mb-6 relative z-10">
                        <div className={`p-4 rounded-2xl border shadow-inner ${acc.account_type === 'wallet' ? 'bg-[rgba(52,211,153,0.05)] text-emerald-400 border-[rgba(52,211,153,0.2)]' : 'bg-[rgba(96,165,250,0.05)] text-blue-400 border-[rgba(96,165,250,0.2)]'}`}>
                           {acc.account_type === 'wallet' ? <Wallet className="w-8 h-8" /> : <Building2 className="w-8 h-8" />}
                        </div>
                        <div className="flex gap-2">
                           <button
                              onClick={(e) => { e.stopPropagation(); handleEdit(acc); }}
                              className="p-2.5 text-[#8a95a8] hover:text-[#c9a84c] bg-[#1a2235] rounded-xl transition-colors border border-white/5"
                              title="Edit Account"
                           >
                              <Pencil className="w-5 h-5" />
                           </button>
                           <button
                              onClick={(e) => { e.stopPropagation(); handleDelete('internal_accounts', acc.id); }}
                              className="p-2.5 text-[#4a5568] hover:text-red-500 bg-[#1a2235] hover:bg-[rgba(244,63,94,0.1)] rounded-xl transition-colors border border-[rgba(255,255,255,0.06)] hover:border-[rgba(244,63,94,0.2)]"
                              title="Delete Account"
                           >
                              <Trash2 className="w-5 h-5" />
                           </button>
                        </div>
                     </div>

                     <div className="relative z-10 flex flex-col h-full">
                        <h4 className={`font-black text-2xl mb-1.5 uppercase tracking-tight ${acc.account_type === 'wallet' ? 'text-emerald-500' : 'text-blue-500'}`}>{acc.provider_name}</h4>

                        <div className="bg-[#1a2235]/50 rounded-2xl p-4 mt-2 mb-5 border border-[rgba(255,255,255,0.06)] shadow-inner">
                           <p className="text-[10px] font-black text-[#8a95a8] uppercase tracking-widest mb-1.5">Account Number</p>
                           <p className="text-xl font-black text-[#e8eaf0] tracking-wider font-mono">{acc.account_number}</p>
                        </div>

                        <div className="flex flex-col gap-1 mb-4 border-l-2 pl-3 border-[rgba(201,168,76,0.3)]">
                           <span className="text-[10px] text-[#8a95a8] font-black uppercase tracking-widest">Account Name</span>
                           <span className="text-sm font-bold text-[#e8eaf0]">{acc.account_name || 'N/A'}</span>
                        </div>

                        {acc.branch && (
                           <div className="flex flex-col gap-1 mt-auto pt-4 border-t border-[rgba(255,255,255,0.06)]">
                              <span className="text-[10px] text-[#8a95a8] font-black uppercase tracking-widest">Branch</span>
                              <span className="text-sm font-bold text-[#c9a84c]">{acc.branch}</span>
                           </div>
                        )}
                     </div>
                  </div>
               ))}

               {internalAccounts.length === 0 && (
                  <div className="md:col-span-2 lg:col-span-3 text-center py-24 bg-[#131929] rounded-3xl border-2 border-[rgba(201,168,76,0.18)] border-dashed shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
                     <div className="w-20 h-20 bg-[#1a2235] rounded-full flex items-center justify-center mx-auto mb-5 border border-[rgba(255,255,255,0.06)]">
                        <Wallet className="w-10 h-10 text-[#4a5568]" />
                     </div>
                     <p className="font-black text-[#e8eaf0] text-xl uppercase tracking-wider mb-2">No accounts saved yet.</p>
                     <p className="text-sm text-[#8a95a8] font-medium">Click "Add New Account" to set up your financial assets.</p>
                  </div>
               )}
            </div>
         </div>
      </div>
   );
}