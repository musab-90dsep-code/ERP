'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, AlertCircle, ArrowRightLeft, CreditCard, Calendar as CalendarIcon, Briefcase, Landmark, RefreshCw, CheckCircle2, X, Ticket, PenTool, UserCheck } from 'lucide-react';

function FinanceContent() {
   const searchParams = useSearchParams();
   const tab = searchParams.get('tab') || 'management';

   const [checks, setChecks] = useState<any[]>([]);
   const [contacts, setContacts] = useState<any[]>([]);
   const [employees, setEmployees] = useState<any[]>([]);

   const [showForm, setShowForm] = useState(false);
   const [selectedCheckId, setSelectedCheckId] = useState<string>('');

   // Default Form Data
   const [checkData, setCheckData] = useState({
      type: 'received', check_number: '', bank_name: '', amount: '',
      issue_date: new Date().toISOString().split('T')[0],
      cash_date: '', alert_date: '', status: 'pending', partner_id: ''
   });

   const generateMemoNo = () => `TRN-${Math.floor(100000 + Math.random() * 900000)}`;

   const [transferData, setTransferData] = useState({
      contact_id: '',
      transfer_date: new Date().toISOString().split('T')[0],
      memo_no: generateMemoNo(),
      authorized_signature: '',
      received_by: ''
   });

   useEffect(() => {
      fetchChecks();
      fetchContacts();
      fetchEmployees();
   }, []);

   const fetchEmployees = async () => {
      const { data } = await supabase.from('employees').select('id, name').order('name');
      setEmployees(data ?? []);
   };

   const fetchChecks = async () => {
      const { data } = await supabase.from('checks').select('*').order('cash_date', { ascending: true });
      setChecks(data ?? []);
   };

   const fetchContacts = async () => {
      const { data } = await supabase
         .from('contacts')
         .select('id, name, type, shop_name')
         .in('type', ['supplier', 'processor']);
      setContacts(data ?? []);
   };

   const handleCheckSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const payload = {
         ...checkData,
         amount: Number(checkData.amount)
      };

      const { error } = await supabase.from('checks').insert(payload);
      if (!error) {
         setShowForm(false);
         setCheckData({ type: 'received', check_number: '', bank_name: '', amount: '', issue_date: new Date().toISOString().split('T')[0], cash_date: '', alert_date: '', status: 'pending', partner_id: '' });
         fetchChecks();
      } else {
         alert('Error saving cheque. Please check your inputs or database schema.');
      }
   };

   const handleTransferSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedCheckId || !transferData.contact_id) {
         alert("Please select a cheque to transfer!");
         return;
      }

      const { error } = await supabase.from('checks').update({
         status: 'transferred',
         partner_id: transferData.contact_id,
         transfer_memo_no: transferData.memo_no,
         transfer_date: transferData.transfer_date,
         transfer_auth_signature: transferData.authorized_signature,
         transfer_received_by: transferData.received_by
      }).eq('id', selectedCheckId);

      if (!error) {
         alert("Cheque successfully transferred!");
         setTransferData({ ...transferData, memo_no: generateMemoNo(), contact_id: '', authorized_signature: '', received_by: '' });
         setSelectedCheckId('');
         fetchChecks();
      } else {
         alert('Error transferring check. Make sure your database supports this operation!');
      }
   };

   const handleDelete = async (table: string, id: string) => {
      if (!window.confirm('Are you sure you want to delete this record?')) return;
      await supabase.from(table).delete().eq('id', id);
      fetchChecks();
   };

   const markStatus = async (id: string, newStatus: string) => {
      await supabase.from('checks').update({ status: newStatus }).eq('id', id);
      fetchChecks();
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

   const pendingChecks = checks.filter(c => c.status === 'pending');
   const transferredChecks = checks.filter(c => c.status === 'transferred');

   return (
      <div className="pb-10 font-sans animate-in fade-in duration-300">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-gradient-to-r from-teal-900 to-indigo-900 p-8 rounded-3xl text-white shadow-lg relative overflow-hidden mb-8">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white opacity-5 blur-3xl pointer-events-none"></div>
            <div className="relative z-10">
               <p className="text-teal-200 font-medium mb-1 text-sm tracking-widest uppercase flex items-center gap-2">
                  <Landmark className="w-4 h-4" /> Finance Operations
               </p>
               <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">
                  {tab === 'transfer' ? 'Cheque Transfer' : 'Cheque Management'}
               </h1>
               <p className="text-teal-100 max-w-xl text-sm md:text-base">
                  {tab === 'transfer' ? 'Endorse and transfer checks to suppliers or processors.' : 'Track cheques, date alerts, and update statuses.'}
               </p>
            </div>
         </div>

         {tab === 'management' && (
            <div className="space-y-6">
               {/* CHEQUE ALERTS WIDGET */}
               {alertChecks.length > 0 && (
                  <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-4 opacity-10 text-orange-600">
                        <AlertCircle className="w-24 h-24" />
                     </div>
                     <div className="relative z-10">
                        <h3 className="text-orange-900 font-extrabold text-lg flex items-center gap-2 mb-3">
                           <AlertCircle className="w-6 h-6 text-orange-600 animate-pulse" /> Action Required: Upcoming Cheque Alerts!
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                           {alertChecks.map(c => (
                              <div key={c.id} className="bg-white rounded-xl p-4 shadow-sm border border-orange-100 flex flex-col gap-2">
                                 <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full uppercase tracking-wide">{c.type}</span>
                                    <span className="font-mono text-sm font-bold text-gray-500">#{c.check_number}</span>
                                 </div>
                                 <div className="font-extrabold text-xl text-gray-900">${Number(c.amount).toLocaleString()}</div>
                                 <div className="text-sm font-semibold text-gray-600 flex items-center gap-1.5"><Landmark className="w-4 h-4 text-gray-400" /> {c.bank_name}</div>
                                 <div className="text-sm font-bold text-red-600 flex items-center gap-1.5 mt-2 bg-red-50 p-2 rounded-lg border border-red-100">
                                    <CalendarIcon className="w-4 h-4" />
                                    Due: {new Date(c.cash_date).toLocaleDateString()}
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>
               )}

               <div className="flex justify-between items-center mb-2">
                  <h2 className="text-xl font-bold text-gray-800">All Cheques Masterlist</h2>
                  <button onClick={() => setShowForm(!showForm)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-sm transition-all focus:ring-2 focus:ring-indigo-500">
                     {showForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                     {showForm ? 'Cancel' : 'Add New Cheque'}
                  </button>
               </div>

               {showForm && (
                  <form onSubmit={handleCheckSubmit} className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-in slide-in-from-top-4 duration-300">
                     <div className="lg:col-span-3 pb-3 border-b border-gray-100 mb-2">
                        <h3 className="font-bold text-lg text-gray-900">Cheque Details Entry</h3>
                     </div>

                     <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5 pl-1">Cheque Type</label>
                        <select value={checkData.type} onChange={e => setCheckData({ ...checkData, type: e.target.value })} className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none font-medium bg-gray-50 text-gray-900">
                           <option value="received">Cheque Received (From Customer)</option>
                           <option value="issued">Cheque Issued (By Us)</option>
                        </select>
                     </div>
                     <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5 pl-1">Cheque / Leaf Number</label>
                        <input required type="text" placeholder="e.g. 00874512" value={checkData.check_number} onChange={e => setCheckData({ ...checkData, check_number: e.target.value })} className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-gray-900" />
                     </div>
                     <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5 pl-1">Amount</label>
                        <input required type="number" placeholder="0.00" value={checkData.amount} onChange={e => setCheckData({ ...checkData, amount: e.target.value })} className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-gray-900" />
                     </div>
                     <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5 pl-1">Bank Name</label>
                        <input required type="text" placeholder="e.g. City Bank" value={checkData.bank_name} onChange={e => setCheckData({ ...checkData, bank_name: e.target.value })} className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-gray-900" />
                     </div>
                     <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5 pl-1">Issue Date</label>
                        <input required type="date" value={checkData.issue_date} onChange={e => setCheckData({ ...checkData, issue_date: e.target.value })} className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-gray-900" />
                     </div>
                     <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5 pl-1 relative">
                           Expected Cash Date
                        </label>
                        <input required type="date" value={checkData.cash_date} onChange={e => setCheckData({ ...checkData, cash_date: e.target.value })} className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-gray-900" />
                     </div>
                     <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5 pl-1 flex items-center gap-1.5">
                           <AlertCircle className="w-4 h-4 text-orange-500" /> Reminder / Alert Date
                        </label>
                        <input required type="date" value={checkData.alert_date} onChange={e => setCheckData({ ...checkData, alert_date: e.target.value })} className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-gray-900" />
                     </div>
                     <div className="lg:col-span-3 flex justify-end pt-3 mt-2 border-t border-gray-100">
                        <button type="button" onClick={() => setShowForm(false)} className="px-6 py-3 font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-all mr-3">Cancel</button>
                        <button type="submit" className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-md transition-all">Save Cheque Record</button>
                     </div>
                  </form>
               )}

               <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                     <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-200">
                           <tr>
                              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Cheque Details</th>
                              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Target Dates</th>
                              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                           {checks.map(c => {
                              const isCashed = c.status === 'cashed';
                              const isBounced = c.status === 'bounced';
                              const isTransferred = c.status === 'transferred';

                              return (
                                 <tr key={c.id} className="hover:bg-indigo-50/30 transition-colors group">
                                    <td className="px-6 py-4">
                                       <div className="flex flex-col gap-1">
                                          <div className="flex items-center gap-2">
                                             <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${c.type === 'received' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{c.type}</span>
                                             <span className="font-mono font-bold text-gray-900 border border-gray-200 px-2 py-0.5 rounded shadow-sm bg-white">#{c.check_number}</span>
                                          </div>
                                          <div className="text-sm font-semibold text-gray-600 mt-1 flex items-center gap-1.5">
                                             <Landmark className="w-3.5 h-3.5" /> {c.bank_name}
                                          </div>
                                          {isTransferred && c.partner_id && (
                                             <div className="text-xs text-indigo-600 font-bold bg-indigo-50 px-2 py-1 rounded inline-flex w-max mt-1 border border-indigo-100">
                                                Transferred to ID: {c.partner_id.substring(0, 8)}...
                                             </div>
                                          )}
                                       </div>
                                    </td>
                                    <td className="px-6 py-4">
                                       <div className="flex flex-col gap-1.5 text-sm">
                                          <span className="text-gray-500 font-medium">Issued: {new Date(c.issue_date).toLocaleDateString()}</span>
                                          <span className={`font-bold ${isCashed ? 'text-green-600' : 'text-gray-900'}`}>Cash: {new Date(c.cash_date).toLocaleDateString()}</span>
                                          {c.alert_date && !isCashed && !isTransferred && !isBounced && (
                                             <span className="text-orange-500 text-xs font-bold flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Alert: {new Date(c.alert_date).toLocaleDateString()}</span>
                                          )}
                                       </div>
                                    </td>
                                    <td className="px-6 py-4">
                                       <span className="font-extrabold text-lg text-gray-900">${Number(c.amount).toLocaleString()}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                       <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border
                            ${isCashed ? 'bg-green-50 text-green-700 border-green-200' :
                                             isBounced ? 'bg-red-50 text-red-700 border-red-200' :
                                                isTransferred ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                                   'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                                          {c.status}
                                       </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                       <div className="flex justify-end gap-1 flex-wrap w-20 ml-auto">
                                          {!isCashed && !isTransferred && (
                                             <>
                                                <button onClick={() => markStatus(c.id, 'cashed')} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors border border-transparent hover:border-green-200" title="Mark Cashed">
                                                   <CheckCircle2 className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => markStatus(c.id, 'bounced')} className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors border border-transparent hover:border-orange-200" title="Mark Bounced">
                                                   <RefreshCw className="w-4 h-4" />
                                                </button>
                                             </>
                                          )}
                                          <button onClick={() => handleDelete('checks', c.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200" title="Delete record">
                                             <Trash2 className="w-4 h-4" />
                                          </button>
                                       </div>
                                    </td>
                                 </tr>
                              );
                           })}

                           {checks.length === 0 && (
                              <tr>
                                 <td colSpan={5} className="py-12 text-center text-gray-500">
                                    <CreditCard className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                                    <p className="font-medium text-gray-600">No cheques found.</p>
                                    <p className="text-sm mt-1">Click "Add New Cheque" to begin logging operations.</p>
                                 </td>
                              </tr>
                           )}
                        </tbody>
                     </table>
                  </div>
               </div>
            </div>
         )}

         {tab === 'transfer' && (
            <div className="space-y-8 animate-in fade-in duration-300">
               {/* TRANSFER FORM */}
               <div className="bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden">
                  <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-indigo-700 to-blue-700 text-white flex justify-between items-center relative overflow-hidden">
                     <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white opacity-10 blur-2xl pointer-events-none"></div>
                     <h2 className="text-xl font-bold flex items-center gap-2 relative z-10">
                        <ArrowRightLeft className="w-5 h-5" /> Endorse and Transfer Cheque
                     </h2>
                  </div>
                  <div className="p-8">
                     <p className="text-sm text-gray-600 mb-6 flex gap-3 bg-blue-50 border border-blue-100 p-4 rounded-xl items-center font-medium">
                        <AlertCircle className="w-6 h-6 text-blue-500 shrink-0" />
                        You are legally endorsing and transferring a pending cheque to a Supplier or Processor. Completing this action will lock the cheque status.
                     </p>

                     <form onSubmit={handleTransferSubmit} className="flex flex-col gap-6">
                        {/* SELECT CHEQUE ROW */}
                        <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 relative">
                           <label className="block text-sm font-bold text-gray-800 mb-2">Select Pending Cheque to Transfer</label>
                           <select required value={selectedCheckId} onChange={e => setSelectedCheckId(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-gray-900 bg-white shadow-sm appearance-none cursor-pointer">
                              <option value="" disabled>-- Select an Eligible Cheque --</option>
                              {pendingChecks.map(c => (
                                 <option key={c.id} value={c.id}>#{c.check_number} - {c.bank_name} - ${Number(c.amount).toLocaleString()}</option>
                              ))}
                           </select>
                           {pendingChecks.length === 0 && (
                              <p className="text-xs text-red-500 mt-2 font-bold flex items-center gap-1"><AlertCircle className="w-3 h-3" /> No pending cheques found. Go to 'Cheque Management' to add one.</p>
                           )}
                        </div>

                        <div className="flex justify-between items-center bg-indigo-50 border border-indigo-100 p-4 rounded-xl shadow-inner">
                           <span className="text-sm font-bold text-indigo-900 uppercase tracking-widest">Transfer Memo Ref</span>
                           <span className="font-mono font-bold text-indigo-700 tracking-wider flex items-center gap-2 text-lg"><Ticket className="w-5 h-5" />{transferData.memo_no}</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div className="md:col-span-2">
                              <label className="block text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-2">
                                 <Briefcase className="w-4 h-4 text-gray-400" /> Target Supplier / Processor
                              </label>
                              <select required value={transferData.contact_id} onChange={e => setTransferData({ ...transferData, contact_id: e.target.value })} className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-gray-900 bg-gray-50 appearance-none">
                                 <option value="" disabled>-- Choose Contact --</option>
                                 {contacts.map(c => (
                                    <option key={c.id} value={c.id}>{c.name} {c.shop_name ? `(${c.shop_name})` : ''} - [{c.type}]</option>
                                 ))}
                              </select>
                           </div>

                           <div className="md:col-span-2">
                              <label className="block text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-2">
                                 <CalendarIcon className="w-4 h-4 text-gray-400" /> Date of Transfer
                              </label>
                              <input required type="date" value={transferData.transfer_date} onChange={e => setTransferData({ ...transferData, transfer_date: e.target.value })} className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-gray-900 bg-gray-50" />
                           </div>

                           <div>
                              <label className="block text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-2"><PenTool className="w-4 h-4 text-indigo-500" /> Authorized Signature</label>
                              <select required value={transferData.authorized_signature} onChange={e => setTransferData({ ...transferData, authorized_signature: e.target.value })} className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-gray-800 bg-gray-50 hover:bg-white appearance-none">
                                 <option value="" disabled>-- Select Employee --</option>
                                 {employees.map(emp => (
                                    <option key={`tauth-${emp.id}`} value={emp.name}>{emp.name}</option>
                                 ))}
                              </select>
                           </div>

                           <div>
                              <label className="block text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-2"><UserCheck className="w-4 h-4 text-emerald-500" /> Received By</label>
                              <select required value={transferData.received_by} onChange={e => setTransferData({ ...transferData, received_by: e.target.value })} className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-gray-800 bg-gray-50 hover:bg-white appearance-none">
                                 <option value="" disabled>-- Select Employee --</option>
                                 {employees.map(emp => (
                                    <option key={`trec-${emp.id}`} value={emp.name}>{emp.name}</option>
                                 ))}
                              </select>
                           </div>
                        </div>

                        <div className="pt-6 mt-2 border-t border-gray-100 flex justify-end">
                           <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-10 py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-lg disabled:opacity-50" disabled={pendingChecks.length === 0}>
                              <CheckCircle2 className="w-6 h-6" /> Confirm Transfer
                           </button>
                        </div>
                     </form>
                  </div>
               </div>

               {/* TRANSFER HISTORY LIST */}
               <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mt-8">
                  <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                     <h3 className="font-extrabold text-gray-800">Transfer History</h3>
                  </div>
                  <div className="overflow-x-auto">
                     <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                           <tr>
                              <th className="px-6 py-4">Memo No</th>
                              <th className="px-6 py-4">Cheque Ref</th>
                              <th className="px-6 py-4">Recipient</th>
                              <th className="px-6 py-4">Transfer Date</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                           {transferredChecks.map(c => {
                              const partner = contacts.find(contact => contact.id === c.partner_id);
                              return (
                                 <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                       <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded border border-indigo-100">{c.transfer_memo_no}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                       <div className="font-bold text-gray-900">#{c.check_number}</div>
                                       <div className="text-sm font-semibold text-gray-500">{c.bank_name} - ${Number(c.amount).toLocaleString()}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                       <div className="font-bold text-gray-800">{partner?.name || 'Unknown Contact'}</div>
                                       <div className="text-xs text-gray-500">{partner?.type}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-bold text-gray-700">
                                       {new Date(c.transfer_date).toLocaleDateString()}
                                    </td>
                                 </tr>
                              );
                           })}
                           {transferredChecks.length === 0 && (
                              <tr>
                                 <td colSpan={4} className="py-8 text-center text-gray-500 font-medium">No transfer history found.</td>
                              </tr>
                           )}
                        </tbody>
                     </table>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
}

export default function FinancePage() {
   return (
      <Suspense fallback={<div className="flex justify-center py-20 text-indigo-600 font-bold">Loading Finance Data...</div>}>
         <FinanceContent />
      </Suspense>
   );
}
