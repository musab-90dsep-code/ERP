'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ReceiptText, Banknote, Calendar as CalendarIcon, CheckCircle2,
  X, AlertCircle, Plus, Hash, Tag, PenTool, UserCheck, Eye, UploadCloud
} from 'lucide-react';

function ExpensesContent() {
   const searchParams = useSearchParams();
   const tab = searchParams.get('tab') || 'make';

   const [expenses, setExpenses] = useState<any[]>([]);
   const [employees, setEmployees] = useState<any[]>([]);

   // Form States
   const generateInvoiceNo = () => `EXP-${Math.floor(10000 + Math.random() * 90000)}`;

   // "Make" form data
   const [makeData, setMakeData] = useState({
      invoice_no: generateInvoiceNo(),
      date: new Date().toISOString().split('T')[0],
      item_name: '',
      unit: '',
      quantity: ''
   });

   // "Pay" form data (for updating a selected expense)
   const [selectedExpense, setSelectedExpense] = useState<any>(null);
   const [payData, setPayData] = useState({
      price_per_unit: '',
      note: '',
      authorized_signature: ''
   });
   const [photoFiles, setPhotoFiles] = useState<File[]>([]);
   const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
   const [isSubmitting, setIsSubmitting] = useState(false);

   useEffect(() => {
      fetchExpenses();
      fetchEmployees();
   }, [tab]);

   const fetchEmployees = async () => {
      const { data } = await supabase.from('employees').select('id, name, is_authorizer').order('name');
      setEmployees(data ?? []);
   };

   const fetchExpenses = async () => {
      const { data } = await supabase
         .from('daily_expenses')
         .select('*')
         .order('created_at', { ascending: false });
      setExpenses(data ?? []);
   };

   const handleMakeSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!makeData.item_name || !makeData.quantity) return;

      setIsSubmitting(true);
      try {
         const payload = {
            invoice_no: makeData.invoice_no,
            date: makeData.date,
            item_name: makeData.item_name,
            unit: makeData.unit || 'pcs',
            quantity: Number(makeData.quantity),
            status: 'pending'
         };

         const { error } = await supabase.from('daily_expenses').insert([payload]);
         if (error) throw error;

         alert('Expense receipt created successfully!');
         setMakeData({ ...makeData, invoice_no: generateInvoiceNo(), item_name: '', quantity: '', unit: '' });
         fetchExpenses();
      } catch(err) {
         console.error(err);
         alert('Failed to save receipt. Make sure the database table exists.');
      } finally {
         setIsSubmitting(false);
      }
   };

   const handlePaySubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedExpense || !payData.price_per_unit || !payData.authorized_signature) {
         alert('Please fill out all required payment details.');
         return;
      }
      setIsSubmitting(true);
      try {
         // Upload photos
         const uploadedUrls: string[] = [];
         for (const file of photoFiles) {
            const path = `expenses/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
            const { error: uploadErr } = await supabase.storage.from('expense-files').upload(path, file);
            if (!uploadErr) {
               const { data } = supabase.storage.from('expense-files').getPublicUrl(path);
               uploadedUrls.push(data.publicUrl);
            }
         }

         const pricePerUnit = Number(payData.price_per_unit);
         const totalAmount = selectedExpense.quantity * pricePerUnit;

         const { error } = await supabase.from('daily_expenses').update({
            price_per_unit: pricePerUnit,
            total_amount: totalAmount,
            note: payData.note,
            photo_urls: uploadedUrls,
            authorized_signature: payData.authorized_signature,
            status: 'paid'
         }).eq('id', selectedExpense.id);

         if (error) throw error;
         
         alert('Expense paid and recorded!');
         setSelectedExpense(null);
         setPayData({ price_per_unit: '', note: '', authorized_signature: '' });
         setPhotoFiles([]);
         setPhotoPreviews([]);
         fetchExpenses();
      } catch (err) {
         console.error(err);
         alert('Failed to process payment. Ensure the expense-files bucket is created.');
      } finally {
         setIsSubmitting(false);
      }
   };

   const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
         const filesArray = Array.from(e.target.files);
         if (photoFiles.length + filesArray.length > 5) {
            alert('You can only upload up to 5 photos.');
            return;
         }
         setPhotoFiles(prev => [...prev, ...filesArray]);
         setPhotoPreviews(prev => [...prev, ...filesArray.map(f => URL.createObjectURL(f))]);
      }
   };

   const removePhoto = (index: number) => {
      setPhotoFiles(prev => prev.filter((_, i) => i !== index));
      setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
   };

   const pendingExpenses = expenses.filter(e => e.status === 'pending');
   const paidExpenses = expenses.filter(e => e.status === 'paid');

   return (
      <div className="pb-10 font-sans animate-in fade-in duration-300">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-gradient-to-r from-emerald-900 to-teal-800 p-8 rounded-3xl text-white shadow-lg relative overflow-hidden mb-8">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white opacity-5 blur-3xl pointer-events-none"></div>
            <div className="relative z-10">
               <p className="text-emerald-200 font-medium mb-1 text-sm tracking-widest uppercase flex items-center gap-2">
                  <ReceiptText className="w-4 h-4" /> Daily Expenses
               </p>
               <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">
                  {tab === 'pay' ? 'Pay for Receipt' : 'Make a Receipt'}
               </h1>
               <p className="text-emerald-100 max-w-xl text-sm md:text-base">
                  {tab === 'pay' ? 'Authorize, append proof, and pay for pending petty-cash expenses.' : 'Log operational items and generate a new expense layout.'}
               </p>
            </div>
         </div>

         {tab === 'make' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                     <Plus className="w-5 h-5 text-emerald-600" /> Create Expense Receipt
                  </h2>
                  <form onSubmit={handleMakeSubmit} className="space-y-5">
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="block text-sm font-bold text-gray-700 mb-1">Invoice No</label>
                           <input type="text" readOnly value={makeData.invoice_no} className="w-full border border-gray-200 rounded-xl p-3 bg-gray-50 text-gray-500 cursor-not-allowed font-mono font-bold" />
                        </div>
                        <div>
                           <label className="block text-sm font-bold text-gray-700 mb-1">Date</label>
                           <input required type="date" value={makeData.date} onChange={e => setMakeData({...makeData, date: e.target.value})} className="w-full border border-gray-200 rounded-xl p-3 font-bold focus:ring-2 focus:ring-emerald-500 outline-none" />
                        </div>
                     </div>
                     <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1"><Tag className="w-4 h-4" /> Item Name</label>
                        <input required type="text" placeholder="e.g. Office Snacks, Printer Ink" value={makeData.item_name} onChange={e => setMakeData({...makeData, item_name: e.target.value})} className="w-full border border-gray-200 rounded-xl p-3 font-medium focus:ring-2 focus:ring-emerald-500 outline-none" />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="block text-sm font-bold text-gray-700 mb-1">Quantity</label>
                           <input required type="number" step="0.01" min="0.01" placeholder="0" value={makeData.quantity} onChange={e => setMakeData({...makeData, quantity: e.target.value})} className="w-full border border-gray-200 rounded-xl p-3 font-bold focus:ring-2 focus:ring-emerald-500 outline-none" />
                        </div>
                        <div>
                           <label className="block text-sm font-bold text-gray-700 mb-1">Unit (Optional)</label>
                           <input type="text" placeholder="e.g. kg, pcs, box" value={makeData.unit} onChange={e => setMakeData({...makeData, unit: e.target.value})} className="w-full border border-gray-200 rounded-xl p-3 font-medium focus:ring-2 focus:ring-emerald-500 outline-none" />
                        </div>
                     </div>
                     <button type="submit" disabled={isSubmitting} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-md mt-4 disabled:opacity-50">
                        {isSubmitting ? 'Generating...' : 'Generate Receipt'}
                     </button>
                  </form>
               </div>

               <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
                  <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between">
                     <h3 className="font-bold text-gray-800 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-orange-500" /> Pending Receipts</h3>
                     <span className="bg-orange-100 text-orange-800 text-xs font-bold px-2.5 py-1 rounded-full">{pendingExpenses.length}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto max-h-[500px]">
                     {pendingExpenses.length === 0 ? (
                        <div className="p-10 text-center text-gray-400">
                           <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                           <p className="font-medium">No pending receipts.</p>
                        </div>
                     ) : (
                        <ul className="divide-y divide-gray-100">
                           {pendingExpenses.map(e => (
                              <li key={e.id} className="p-4 hover:bg-gray-50 flex justify-between items-center transition-colors">
                                 <div>
                                    <div className="font-bold text-gray-900 border border-gray-200 px-2 rounded-md shadow-sm w-max mb-1.5 text-xs text-mono">{e.invoice_no}</div>
                                    <h4 className="font-semibold text-gray-800">{e.item_name}</h4>
                                    <p className="text-xs text-gray-500 mt-0.5">{e.quantity} {e.unit} • {new Date(e.date).toLocaleDateString()}</p>
                                 </div>
                                 <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-lg border border-orange-100">Action Req.</span>
                              </li>
                           ))}
                        </ul>
                     )}
                  </div>
               </div>
            </div>
         )}

         {tab === 'pay' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
               <div className="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col max-h-[800px]">
                  <div className="p-5 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                     <AlertCircle className="w-5 h-5 text-orange-500" />
                     <h2 className="font-bold text-gray-800 text-lg">Select Receipt</h2>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                     {pendingExpenses.length === 0 ? (
                         <div className="p-8 text-center text-gray-400">No receipts waiting for payment.</div>
                     ) : (
                        pendingExpenses.map(e => (
                           <button 
                              key={e.id} 
                              onClick={() => { setSelectedExpense(e); setPayData({ price_per_unit: '', note: '', authorized_signature: '' }); setPhotoFiles([]); setPhotoPreviews([]); }}
                              className={`w-full text-left p-4 rounded-xl border transition-all ${selectedExpense?.id === e.id ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                           >
                              <div className="flex justify-between items-start mb-1">
                                 <span className="font-mono text-xs font-bold text-gray-500">{e.invoice_no}</span>
                                 <span className="text-[10px] text-gray-400">{new Date(e.date).toLocaleDateString()}</span>
                              </div>
                              <h3 className="font-bold text-gray-900 truncate">{e.item_name}</h3>
                              <p className="text-sm font-semibold text-emerald-600 mt-1">{e.quantity} <span className="text-xs uppercase text-emerald-500">{e.unit}</span></p>
                           </button>
                        ))
                     )}
                  </div>
               </div>

               <div className="lg:col-span-8">
                  {selectedExpense ? (
                     <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-6 md:p-8 animate-in slide-in-from-right-4 duration-300 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                           <Banknote className="w-48 h-48" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Finalize Payment</h2>
                        <div className="flex gap-4 items-center mb-6 border-b border-gray-100 pb-4 text-sm font-medium text-gray-500">
                           <span className="bg-gray-100 px-3 py-1 rounded-lg text-gray-800"><span className="opacity-60">Item:</span> {selectedExpense.item_name}</span>
                           <span className="bg-gray-100 px-3 py-1 rounded-lg text-gray-800"><span className="opacity-60">Qty:</span> {selectedExpense.quantity} {selectedExpense.unit}</span>
                        </div>

                        <form onSubmit={handlePaySubmit} className="space-y-6 relative z-10">
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div>
                                 <label className="block text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-1.5"><Banknote className="w-4 h-4 text-emerald-500" /> Price per Unit</label>
                                 <input required type="number" step="0.01" min="0" placeholder="0.00" value={payData.price_per_unit} onChange={e => setPayData({...payData, price_per_unit: e.target.value})} className="w-full border border-gray-200 rounded-xl p-3 font-extrabold text-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-gray-50" />
                              </div>
                              <div className="flex flex-col justify-end">
                                 <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex justify-between items-center h-[54px]">
                                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Total</span>
                                    <span className="text-2xl font-black text-emerald-600">${(Number(payData.price_per_unit || 0) * selectedExpense.quantity).toLocaleString()}</span>
                                 </div>
                              </div>
                           </div>

                           <div>
                              <label className="block text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-1.5"><PenTool className="w-4 h-4 text-gray-400" /> Note</label>
                              <textarea rows={2} placeholder="Add specific expense details or reasons..." value={payData.note} onChange={e => setPayData({...payData, note: e.target.value})} className="w-full border border-gray-200 rounded-xl p-3 font-medium focus:ring-2 focus:ring-emerald-500 outline-none bg-gray-50 resize-none" />
                           </div>

                           <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl">
                              <label className="block text-sm font-bold text-gray-700 mb-2.5 flex items-center gap-2"><UploadCloud className="w-4 h-4" /> Photos Proof (Max 5)</label>
                              <div className="flex flex-wrap gap-3 items-start">
                                 {photoPreviews.map((src, idx) => (
                                    <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-300 shadow-sm group">
                                       <img src={src} alt="preview" className="w-full h-full object-cover" />
                                       <button type="button" onClick={() => removePhoto(idx)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                                    </div>
                                 ))}
                                 {photoPreviews.length < 5 && (
                                    <label className="w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors text-gray-500 bg-white shadow-sm">
                                       <Plus className="w-6 h-6 mb-1" />
                                       <input type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoChange} />
                                    </label>
                                 )}
                              </div>
                           </div>

                           <div>
                              <label className="block text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-1.5"><UserCheck className="w-4 h-4 text-emerald-500" /> Authorized Signature</label>
                              <select required value={payData.authorized_signature} onChange={e => setPayData({...payData, authorized_signature: e.target.value})} className="w-full border border-gray-200 rounded-xl p-3 font-bold focus:ring-2 focus:ring-emerald-500 outline-none bg-gray-50 appearance-none">
                                 <option value="" disabled>-- Select Authorizer Employee --</option>
                                 {employees.filter(e => e.is_authorizer).map(emp => (
                                    <option key={emp.id} value={emp.name}>{emp.name}</option>
                                 ))}
                              </select>
                           </div>

                           <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                              <button type="button" onClick={() => setSelectedExpense(null)} className="px-6 py-3 font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-all">Cancel</button>
                              <button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 py-3 rounded-xl transition-all shadow-lg flex items-center gap-2">
                                 {isSubmitting ? 'Saving...' : <><CheckCircle2 className="w-5 h-5"/> Pay & Secure Record</>}
                              </button>
                           </div>
                        </form>
                     </div>
                  ) : (
                     <div className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 h-full min-h-[400px] flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                        <Banknote className="w-16 h-16 mb-4 opacity-20" />
                        <h3 className="text-xl font-bold text-gray-600">No Receipt Selected</h3>
                        <p className="mt-2 text-sm text-gray-500 max-w-sm">Select a pending receipt from the list on the left to add payment details, attach photos, and complete the authorization.</p>
                     </div>
                  )}
               </div>

               {/* Paid History Table Below */}
               <div className="lg:col-span-12 mt-4 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                     <h3 className="font-extrabold text-gray-800">Paid Expenses History</h3>
                     <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">{paidExpenses.length} Records</span>
                  </div>
                  <div className="overflow-x-auto">
                     <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs font-bold uppercase tracking-wider">
                           <tr>
                              <th className="px-6 py-4">Receipt Ref</th>
                              <th className="px-6 py-4">Item Details</th>
                              <th className="px-6 py-4">Sign & Proof</th>
                              <th className="px-6 py-4 text-right">Total Paid</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                           {paidExpenses.map(e => (
                              <tr key={e.id} className="hover:bg-gray-50/50">
                                 <td className="px-6 py-4">
                                    <div className="font-mono text-xs font-bold text-gray-800 bg-gray-100 inline-block px-2 py-0.5 rounded border border-gray-200 mb-1">{e.invoice_no}</div>
                                    <div className="text-xs text-gray-500 font-semibold">{new Date(e.date).toLocaleDateString()}</div>
                                 </td>
                                 <td className="px-6 py-4">
                                    <div className="font-bold text-gray-900">{e.item_name}</div>
                                    <div className="text-xs text-emerald-600 font-bold mt-0.5">{e.quantity} {e.unit} <span className="text-gray-400 font-normal">@ ${e.price_per_unit}</span></div>
                                    {e.note && <div className="text-[10px] text-gray-500 mt-1 italic w-48 truncate">{e.note}</div>}
                                 </td>
                                 <td className="px-6 py-4">
                                    <div className="text-xs font-bold text-indigo-700 bg-indigo-50 inline-block px-2 py-0.5 rounded-sm border border-indigo-100 mb-1.5 flex items-center gap-1 w-max">
                                       <PenTool className="w-3 h-3" /> {e.authorized_signature}
                                    </div>
                                    {e.photo_urls && e.photo_urls.length > 0 ? (
                                       <div className="flex gap-1">
                                          {(e.photo_urls as string[]).map((u: string, i: number) => (
                                             <a key={i} href={u} target="_blank" rel="noreferrer" className="block w-6 h-6 rounded border border-gray-200 overflow-hidden shadow-sm hover:scale-110 transition-transform">
                                                <img src={u} alt="Proof" className="w-full h-full object-cover" />
                                             </a>
                                          ))}
                                       </div>
                                    ) : <div className="text-[10px] text-gray-400">No photos attached</div>}
                                 </td>
                                 <td className="px-6 py-4 text-right">
                                    <span className="font-black text-lg text-emerald-600">${Number(e.total_amount).toLocaleString()}</span>
                                    <span className="block text-[10px] uppercase font-bold text-green-500 mt-0.5">Paid</span>
                                 </td>
                              </tr>
                           ))}
                           {paidExpenses.length === 0 && (
                              <tr>
                                 <td colSpan={4} className="py-10 text-center text-gray-500 text-sm font-medium">No paid expenses yet.</td>
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

export default function ExpensesPage() {
   return (
      <Suspense fallback={<div className="font-bold p-10 text-center">Loading Expenses...</div>}>
         <ExpensesContent />
      </Suspense>
   );
}
