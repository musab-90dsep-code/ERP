'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Plus, Trash2, AlertCircle, ArrowRightLeft, CreditCard, Calendar as CalendarIcon, Briefcase, Landmark, RefreshCw, CheckCircle2, X, Ticket, PenTool, UserCheck } from 'lucide-react';

function FinanceContent() {
   const searchParams = useSearchParams();
   const tab = searchParams.get('tab') || 'management';

   const [checks, setChecks] = useState<any[]>([]);
   const [employees, setEmployees] = useState<any[]>([]);

   useEffect(() => {
      fetchChecks();
      fetchEmployees();
   }, []);

   const fetchEmployees = async () => {
      try {
        const data = await api.getEmployees({ ordering: 'name' });
        setEmployees(Array.isArray(data) ? data : data.results ?? []);
      } catch (err) { console.error('fetchEmployees:', err); }
   };

   const fetchChecks = async () => {
      try {
        const data = await api.getChecks({ ordering: 'cash_date' });
        setChecks(Array.isArray(data) ? data : data.results ?? []);
      } catch (err) { console.error('fetchChecks:', err); }
   };



   const handleDelete = async (_table: string, id: string) => {
      if (!window.confirm('Are you sure you want to delete this record?')) return;
      try {
        await api.deleteCheck(id);
        fetchChecks();
      } catch (err) { console.error('deleteCheck:', err); }
   };

   const markStatus = async (id: string, newStatus: string) => {
      try {
        await api.updateCheck(id, { status: newStatus });
        fetchChecks();
      } catch (err) { console.error('markStatus:', err); }
   };

   // derived values
   const today = new Date();
   const alertChecks = checks.filter(c => {
      if (c.status === 'cashed' || c.status === 'transferred' || c.status === 'bounced') return false;
      const alertDate = new Date(c.alert_date || c.cash_date);
      const diffTime = alertDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 3; // Alert if within 3 days
   });

   // Design Constants
   const C = {
      card: "bg-[#131929] rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-[rgba(201,168,76,0.18)]",
      input: "w-full border border-[rgba(201,168,76,0.18)] rounded-xl p-3.5 bg-[#131929] text-[#e8eaf0] placeholder-[#4a5568] focus:ring-2 focus:ring-[#c9a84c] outline-none transition-all font-bold",
      label: "block text-[11px] font-black text-[#8a95a8] mb-2 uppercase tracking-widest pl-1",
      buttonPrimary: "bg-gradient-to-br from-[#c9a84c] to-[#f0c040] hover:opacity-90 text-[#0a0900] font-extrabold px-8 py-3.5 rounded-xl transition-all shadow-[0_4px_14px_rgba(201,168,76,0.35)] disabled:opacity-60 flex items-center justify-center gap-2"
   };

   return (
      <div className="pb-12 font-sans animate-in fade-in duration-300">
         
         {/* Dynamic Header */}
         <div className="p-8 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.5)] border border-[rgba(201,168,76,0.18)] relative overflow-hidden mb-8 bg-gradient-to-r from-[#0d1613] to-[#121e1a]">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-[#c9a84c] opacity-5 blur-3xl pointer-events-none"></div>
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
               <div>
                  <p className="text-[#c9a84c] font-black mb-1.5 text-xs tracking-widest uppercase flex items-center gap-2">
                     <Landmark className="w-4 h-4" /> Finance Operations
                  </p>
                  <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2 text-[#e8eaf0]">
                     Cheque Management
                  </h1>
                  <p className="text-[#8a95a8] max-w-xl text-sm md:text-base font-medium">
                     Track incoming and outgoing cheques, date alerts, and update statuses.
                  </p>
               </div>
            </div>
         </div>

         <div className="space-y-8">
               {/* CHEQUE ALERTS WIDGET */}
               {alertChecks.length > 0 && (
                  <div className="bg-[rgba(251,146,60,0.05)] border border-[rgba(251,146,60,0.2)] rounded-3xl p-6 sm:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.5)] relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-4 opacity-[0.03] text-orange-400">
                        <AlertCircle className="w-48 h-48" />
                     </div>
                     <div className="relative z-10">
                        <h3 className="text-orange-400 font-black text-xl flex items-center gap-3 mb-5 tracking-tight">
                           <AlertCircle className="w-6 h-6 text-orange-500 animate-pulse" /> Action Required: Upcoming Cheque Alerts!
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                           {alertChecks.map(c => (
                              <div key={c.id} className="bg-[#131929] rounded-2xl p-5 shadow-inner border border-[rgba(251,146,60,0.15)] flex flex-col gap-3 group hover:border-[rgba(251,146,60,0.4)] transition-colors">
                                 <div className="flex justify-between items-center border-b border-[rgba(255,255,255,0.06)] pb-3">
                                    <span className={`text-[10px] font-black px-2.5 py-1 rounded uppercase tracking-widest ${c.type === 'received' ? 'bg-[rgba(59,130,246,0.1)] text-blue-400 border border-[rgba(59,130,246,0.2)]' : 'bg-[rgba(251,146,60,0.1)] text-orange-400 border border-[rgba(251,146,60,0.2)]'}`}>
                                       {c.type}
                                    </span>
                                    <span className="font-mono text-sm font-bold text-[#8a95a8] bg-[#1a2235] px-2 py-0.5 rounded border border-[rgba(255,255,255,0.06)]">#{c.check_number}</span>
                                 </div>
                                 <div className="font-black text-2xl text-[#e8eaf0] font-mono">
                                    <span className="font-sans pr-1 text-lg text-[#8a95a8]">৳</span>{Number(c.amount).toLocaleString()}
                                 </div>
                                 <div className="text-sm font-bold text-[#8a95a8] flex items-center gap-2">
                                    <Landmark className="w-4 h-4 text-[#c9a84c]" /> {c.bank_name}
                                 </div>
                                 <div className="text-xs font-black text-rose-400 flex items-center gap-2 mt-auto pt-3 border-t border-[rgba(255,255,255,0.06)] uppercase tracking-wider">
                                    <CalendarIcon className="w-4 h-4 text-rose-500" />
                                    Due: {new Date(c.cash_date).toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'})}
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>
               )}

               <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-2">
                  <div>
                     <h2 className="text-2xl font-black text-[#e8eaf0] tracking-tight">All Cheques Masterlist</h2>
                     <p className="text-sm text-[#8a95a8] font-medium mt-1">Manage and track statuses of all company cheques.</p>
                  </div>
               </div>


               {/* Table Section */}
               <div className={`${C.card} overflow-hidden`}>
                  <div className="overflow-x-auto custom-scrollbar">
                     <table className="w-full text-left min-w-[900px]">
                        <thead className="bg-[#1a2235] border-b border-[rgba(201,168,76,0.18)]">
                           <tr>
                              <th className="px-6 py-4 text-[11px] font-black text-[#c9a84c] uppercase tracking-widest">Cheque Details</th>
                              <th className="px-6 py-4 text-[11px] font-black text-[#c9a84c] uppercase tracking-widest">Target Dates</th>
                              <th className="px-6 py-4 text-[11px] font-black text-[#c9a84c] uppercase tracking-widest">Amount</th>
                              <th className="px-6 py-4 text-[11px] font-black text-[#c9a84c] uppercase tracking-widest">Status</th>
                              <th className="px-6 py-4 text-[11px] font-black text-[#c9a84c] uppercase tracking-widest text-right">Actions</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-[rgba(255,255,255,0.06)] bg-[#131929]">
                           {checks.map(c => {
                              const isCashed = c.status === 'cashed';
                              const isBounced = c.status === 'bounced';
                              const isTransferred = c.status === 'transferred';

                              return (
                                 <tr key={c.id} className="hover:bg-[#1a2235]/60 transition-colors group">
                                    <td className="px-6 py-4">
                                       <div className="flex flex-col gap-1.5">
                                          <div className="flex items-center gap-2.5">
                                             <span className={`px-2.5 py-1 rounded text-[9px] uppercase font-black tracking-widest border ${c.type === 'received' ? 'bg-[rgba(59,130,246,0.1)] text-blue-400 border-[rgba(59,130,246,0.2)]' : 'bg-[rgba(251,146,60,0.1)] text-orange-400 border-[rgba(251,146,60,0.2)]'}`}>
                                                {c.type}
                                             </span>
                                             <span className="font-mono text-xs font-black text-[#e8eaf0] border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] px-2 py-0.5 rounded shadow-sm">#{c.check_number}</span>
                                          </div>
                                          <div className="text-xs font-bold text-[#8a95a8] mt-1 flex items-center gap-2">
                                             <Landmark className="w-3.5 h-3.5 text-[#c9a84c]" /> {c.bank_name}
                                          </div>
                                          {c.partner_details && (
                                             <div className="text-[10px] text-purple-400 font-bold bg-[rgba(168,85,247,0.1)] px-2 py-1 rounded inline-flex w-max mt-1 border border-[rgba(168,85,247,0.2)]">
                                                Partner: {c.partner_details.name}
                                             </div>
                                          )}
                                       </div>
                                    </td>
                                    <td className="px-6 py-4">
                                       <div className="flex flex-col gap-1.5 text-xs font-bold">
                                          <span className="text-[#8a95a8]">Issued: {new Date(c.issue_date).toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'})}</span>
                                          <span className={`font-black ${isCashed ? 'text-emerald-400' : 'text-[#e8eaf0]'}`}>Cash: {new Date(c.cash_date).toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'})}</span>
                                          {c.alert_date && !isCashed && !isTransferred && !isBounced && (
                                             <span className="text-orange-400 text-[10px] uppercase tracking-wider flex items-center gap-1.5 mt-0.5"><AlertCircle className="w-3 h-3" /> Alert: {new Date(c.alert_date).toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'})}</span>
                                          )}
                                       </div>
                                    </td>
                                    <td className="px-6 py-4">
                                       <span className="font-black text-lg font-mono text-[#c9a84c]">
                                          <span className="font-sans pr-1 text-[#8a95a8] text-sm">৳</span>{Number(c.amount).toLocaleString()}
                                       </span>
                                    </td>
                                    <td className="px-6 py-4">
                                       <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border
                            ${isCashed ? 'bg-[rgba(52,211,153,0.1)] text-emerald-400 border-[rgba(52,211,153,0.2)]' :
                                             isBounced ? 'bg-[rgba(244,63,94,0.1)] text-rose-400 border-[rgba(244,63,94,0.2)]' :
                                                isTransferred ? 'bg-[rgba(168,85,247,0.1)] text-purple-400 border-[rgba(168,85,247,0.2)]' :
                                                   'bg-[rgba(250,204,21,0.1)] text-yellow-400 border-[rgba(250,204,21,0.2)]'}`}>
                                          {c.status}
                                       </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                       <div className="flex justify-end gap-1.5 flex-wrap w-24 ml-auto">
                                          {!isCashed && !isTransferred && (
                                             <>
                                                <button onClick={() => markStatus(c.id, 'cashed')} className="p-2 text-[#8a95a8] hover:text-emerald-400 hover:bg-[rgba(52,211,153,0.1)] rounded-lg transition-colors border border-transparent hover:border-[rgba(52,211,153,0.2)]" title="Mark Cashed">
                                                   <CheckCircle2 className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => markStatus(c.id, 'bounced')} className="p-2 text-[#8a95a8] hover:text-orange-400 hover:bg-[rgba(251,146,60,0.1)] rounded-lg transition-colors border border-transparent hover:border-[rgba(251,146,60,0.2)]" title="Mark Bounced">
                                                   <RefreshCw className="w-4 h-4" />
                                                </button>
                                             </>
                                          )}
                                          <button onClick={() => handleDelete('checks', c.id)} className="p-2 text-[#8a95a8] hover:text-rose-400 hover:bg-[rgba(244,63,94,0.1)] rounded-lg transition-colors border border-transparent hover:border-[rgba(244,63,94,0.2)]" title="Delete record">
                                             <Trash2 className="w-4 h-4" />
                                          </button>
                                       </div>
                                    </td>
                                 </tr>
                              );
                           })}

                           {checks.length === 0 && (
                              <tr>
                                 <td colSpan={5} className="py-16 text-center text-[#8a95a8] bg-[#1a2235]/20 border-2 border-dashed border-[rgba(255,255,255,0.06)]">
                                    <CreditCard className="w-14 h-14 mx-auto text-[#4a5568] mb-4 opacity-50" />
                                    <p className="font-black text-lg text-[#e8eaf0] uppercase tracking-wider mb-1">No cheques found.</p>
                                    <p className="text-sm font-medium">All cheques are tracked through Invoices and Payments.</p>
                                 </td>
                              </tr>
                           )}
                        </tbody>
                     </table>
                  </div>
               </div>
         </div>
      </div>
   );
}

export default function FinancePage() {
   return (
      <Suspense fallback={<div className="flex justify-center py-20 text-[#c9a84c] font-black uppercase tracking-widest text-lg">Loading Finance Data...</div>}>
         <FinanceContent />
      </Suspense>
   );
}