'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import {
   ReceiptText, Banknote, Calendar as CalendarIcon, CheckCircle2,
   X, AlertCircle, Plus, Hash, Tag, PenTool, UserCheck, Eye, UploadCloud,
   Wallet, Landmark, Building2, CreditCard, ArrowRightLeft, Store, Users, Ticket, Info
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
      payment_date: new Date().toISOString().split('T')[0],
      note: '',
      authorized_signature: ''
   });
   const [photoFiles, setPhotoFiles] = useState<File[]>([]);
   const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [viewingExpense, setViewingExpense] = useState<any | null>(null);

   // "Add Money" states
   const generateAddMoneyMemo = () => `ADM-${Math.floor(100000 + Math.random() * 900000)}`;
   const [addMoneyList, setAddMoneyList] = useState<any[]>([]);
   const [internalAccounts, setInternalAccounts] = useState<any[]>([]);
   const [contacts, setContacts] = useState<any[]>([]);
   const [addMoneyForm, setAddMoneyForm] = useState({
      memo_no: generateAddMoneyMemo(),
      date: new Date().toISOString().split('T')[0],
      purpose: '',
      amount: '',
      note: '',
      payment_method: 'cash',
      payment_method_details: {
         memo_no: '',
         number: '', 
         transaction_id: '',
         bank_name: '',
         account_name: '',
         account_number: '',
         branch: '',
         datetime: '',
         cheque_number: '',
         cheque_date: '',
         internal_account_id: ''
      },
      authorized_signature: ''
   });
   const [addMoneyPhotos, setAddMoneyPhotos] = useState<File[]>([]);
   const [addMoneyPreviews, setAddMoneyPreviews] = useState<string[]>([]);

   useEffect(() => {
      fetchExpenses();
      fetchEmployees();
      if (tab === 'add_money') {
         fetchAddMoney();
         fetchInternalAccounts();
         fetchContacts();
      }
   }, [tab]);

   const fetchInternalAccounts = async () => {
      try {
         const data = await api.getInternalAccounts({ ordering: 'provider_name' });
         setInternalAccounts(Array.isArray(data) ? data : data.results ?? []);
      } catch (err) { console.error('fetchInternalAccounts:', err); }
   };

   const fetchContacts = async () => {
      try {
         const data = await api.getContacts({ ordering: 'name' });
         setContacts(Array.isArray(data) ? data : data.results ?? []);
      } catch (err) { console.error('fetchContacts:', err); }
   };

   const fetchAddMoney = async () => {
      try {
         const data = await api.getAddMoney({ ordering: '-created_at' });
         setAddMoneyList(Array.isArray(data) ? data : data.results ?? []);
      } catch (err) { console.error('fetchAddMoney:', err); }
   };

   const fetchEmployees = async () => {
      try {
        const data = await api.getEmployees({ ordering: 'name' });
        setEmployees(Array.isArray(data) ? data : data.results ?? []);
      } catch (err) { console.error('fetchEmployees:', err); }
   };

   const fetchExpenses = async () => {
      try {
        const data = await api.getDailyExpenses({ ordering: '-created_at' });
        setExpenses(Array.isArray(data) ? data : data.results ?? []);
      } catch (err) { console.error('fetchExpenses:', err); }
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
         await api.createDailyExpense(payload);
         alert('Expense receipt created successfully!');
         setMakeData({ ...makeData, invoice_no: generateInvoiceNo(), item_name: '', quantity: '', unit: '' });
         fetchExpenses();
      } catch(err) {
         console.error(err);
         alert('Failed to save receipt.');
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
         // Upload photos to backend server
         const uploadedUrls = photoFiles.length > 0
            ? await Promise.all(photoFiles.map((file) => api.uploadFile(file)))
            : [];

         const pricePerUnit = Number(payData.price_per_unit);
         const totalAmount = selectedExpense.quantity * pricePerUnit;

         await api.updateDailyExpense(selectedExpense.id, {
            price_per_unit: pricePerUnit,
            total_amount: totalAmount,
            payment_date: payData.payment_date,
            note: payData.note,
            photo_urls: uploadedUrls,
            authorized_signature: payData.authorized_signature,
            status: 'paid'
         });

         alert('Expense paid and recorded!');
         setSelectedExpense(null);
         setPayData({ price_per_unit: '', payment_date: new Date().toISOString().split('T')[0], note: '', authorized_signature: '' });
         setPhotoFiles([]);
         setPhotoPreviews([]);
         fetchExpenses();
      } catch (err) {
         console.error(err);
         alert('Failed to process payment.');
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
      setPhotoPreviews(prev => [...prev.filter((_, i) => i !== index)]);
   };

   const handleAddMoneySubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!addMoneyForm.purpose || !addMoneyForm.amount || !addMoneyForm.authorized_signature) {
         alert('Please fill out all required fields.');
         return;
      }
      setIsSubmitting(true);
      try {
         const uploadedUrls = addMoneyPhotos.length > 0
            ? await Promise.all(addMoneyPhotos.map((file) => api.uploadFile(file)))
            : [];

         const payload = {
            ...addMoneyForm,
            amount: Number(addMoneyForm.amount),
            photo_urls: uploadedUrls,
         };
         
         await api.createAddMoney(payload);
         alert('Money added successfully!');
         setAddMoneyForm({
            ...addMoneyForm,
            memo_no: generateAddMoneyMemo(),
            purpose: '',
            amount: '',
            note: '',
            payment_method: 'cash',
            payment_method_details: { ...addMoneyForm.payment_method_details, memo_no: generateAddMoneyMemo() }
         });
         setAddMoneyPhotos([]);
         setAddMoneyPreviews([]);
         fetchAddMoney();
      } catch (err) {
         console.error(err);
         alert('Failed to save record.');
      } finally {
         setIsSubmitting(false);
      }
   };

   const handleAddMoneyPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
         const filesArray = Array.from(e.target.files);
         if (addMoneyPhotos.length + filesArray.length > 5) {
            alert('Max 5 photos allowed.');
            return;
         }
         setAddMoneyPhotos(prev => [...prev, ...filesArray]);
         setAddMoneyPreviews(prev => [...prev, ...filesArray.map(f => URL.createObjectURL(f))]);
      }
   };

   const removeAddMoneyPhoto = (index: number) => {
      setAddMoneyPhotos(prev => prev.filter((_, i) => i !== index));
      setAddMoneyPreviews(prev => prev.filter((_, i) => i !== index));
   };

   const renderPaymentMethodForm = () => {
      const m = addMoneyForm.payment_method;
      const details = addMoneyForm.payment_method_details;
      const setDetails = (d: any) => setAddMoneyForm({ ...addMoneyForm, payment_method_details: { ...details, ...d } });

      if (['bikash', 'nagad', 'rocket', 'upay'].includes(m)) {
         return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 p-4 bg-[#1a2235]/40 rounded-xl border border-[rgba(255,255,255,0.06)]">
               <div className="col-span-1 sm:col-span-2">
                  <label className={C.label}>Receiving To (Your Account)</label>
                  <select required value={details.internal_account_id} onChange={e => setDetails({ internal_account_id: e.target.value })} className={C.input}>
                     <option value="" disabled>Select your {m} account</option>
                     {internalAccounts.filter(acc => acc.account_type === 'wallet' && acc.provider_name.toLowerCase() === m.toLowerCase()).map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.provider_name} - {acc.account_number}</option>
                     ))}
                  </select>
               </div>
               <div>
                  <label className={C.label}>Send Number</label>
                  <input required placeholder="+8801..." type="text" value={details.number} onChange={e => setDetails({ number: e.target.value })} className={C.input} />
               </div>
               <div>
                  <label className={C.label}>Transaction ID</label>
                  <input required placeholder="TRX..." type="text" value={details.transaction_id} onChange={e => setDetails({ transaction_id: e.target.value })} className={C.input} />
               </div>
            </div>
         );
      }

      if (m === 'bank_transfer' || m === 'bank_to_bank_transfer') {
         return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 p-4 bg-[#1a2235]/40 rounded-xl border border-[rgba(255,255,255,0.06)]">
               <div className="col-span-1 sm:col-span-2">
                  <label className={C.label}>Your Receiving Bank Account</label>
                  <select required value={details.internal_account_id} onChange={e => setDetails({ internal_account_id: e.target.value })} className={C.input}>
                     <option value="" disabled>Select your Bank Account</option>
                     {internalAccounts.filter(acc => acc.account_type === 'bank').map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.provider_name} - {acc.account_number}</option>
                     ))}
                  </select>
               </div>
               <div className="col-span-1 sm:col-span-2">
                  <label className={C.label}>Transfer Date & Time</label>
                  <input required type="datetime-local" value={details.datetime} onChange={e => setDetails({ datetime: e.target.value })} className={C.input} />
               </div>
            </div>
         );
      }

      if (m === 'cheque') {
         return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 p-4 bg-[#1a2235]/40 rounded-xl border border-[rgba(255,255,255,0.06)]">
               <div>
                  <label className={C.label}>Cheque Number</label>
                  <input required type="text" value={details.cheque_number} onChange={e => setDetails({ cheque_number: e.target.value })} className={C.input} />
               </div>
               <div>
                  <label className={C.label}>Cheque Date</label>
                  <input required type="date" value={details.cheque_date} onChange={e => setDetails({ cheque_date: e.target.value })} className={C.input} />
               </div>
               <div className="col-span-1 sm:col-span-2">
                  <label className={C.label}>Bank Name</label>
                  <input required type="text" value={details.bank_name} onChange={e => setDetails({ bank_name: e.target.value })} className={C.input} />
               </div>
            </div>
         );
      }

      return null;
   };

   const pendingExpenses = expenses.filter(e => e.status === 'pending');
   const paidExpenses = expenses.filter(e => e.status === 'paid');

   // Common CSS properties
   const C = {
      card: "bg-[#131929] rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.5)] border border-[rgba(201,168,76,0.18)]",
      input: "w-full border border-[rgba(201,168,76,0.18)] rounded-xl p-3 bg-[#1a2235] text-[#e8eaf0] placeholder-[#4a5568] focus:ring-2 focus:ring-[#c9a84c] outline-none transition-all text-sm",
      label: "block text-xs font-bold text-[#8a95a8] mb-1.5 uppercase tracking-wider",
      buttonPrimary: "w-full bg-gradient-to-br from-[#c9a84c] to-[#f0c040] hover:opacity-90 text-[#0a0900] font-extrabold py-3.5 rounded-xl transition-all shadow-[0_4px_14px_rgba(201,168,76,0.35)] disabled:opacity-60 flex items-center justify-center gap-2"
   };

   return (
      <div className="pb-10 font-sans animate-in fade-in duration-300">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-[#131929] to-[#1a2235] p-8 rounded-3xl border border-[rgba(201,168,76,0.18)] text-[#e8eaf0] shadow-[0_4px_24px_rgba(0,0,0,0.5)] relative overflow-hidden mb-8">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-[#c9a84c] opacity-5 blur-3xl pointer-events-none"></div>
            <div className="relative z-10">
               <p className="text-[#c9a84c] font-bold mb-1 text-sm tracking-widest uppercase flex items-center gap-2">
                  <ReceiptText className="w-4 h-4" /> Daily Expenses
               </p>
               <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">
                  {tab === 'pay' ? 'Pay for Receipt' : tab === 'add_money' ? 'Add Money' : 'Make a Receipt'}
               </h1>
               <p className="text-[#8a95a8] max-w-xl text-sm md:text-base font-medium">
                  {tab === 'pay' ? 'Authorize, append proof, and pay for pending petty-cash expenses.' : 
                   tab === 'add_money' ? 'Record fund injections or income into the petty cash system.' : 
                   'Log operational items and generate a new expense layout.'}
               </p>
            </div>
         </div>

         {tab === 'add_money' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 animate-in slide-in-from-bottom-5 duration-500">
               <div className={`xl:col-span-12 ${C.card} p-6 md:p-10`}>
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 border-b border-[rgba(255,255,255,0.06)] pb-8">
                     <div>
                        <h2 className="text-2xl font-black text-[#e8eaf0] flex items-center gap-3">
                           <Landmark className="w-7 h-7 text-[#c9a84c]" /> Add Business Capital / Fund
                        </h2>
                        <p className="text-[#8a95a8] text-sm mt-1 font-medium">Log money added to the system for petty cash or other purposes.</p>
                     </div>
                     <div className="bg-[#1a2235]/40 border border-[rgba(201,168,76,0.18)] px-5 py-3 rounded-2xl flex flex-col items-center">
                        <span className="text-[10px] font-black text-[#8a95a8] uppercase tracking-widest mb-1 leading-none">Memo No</span>
                        <span className="text-lg font-mono font-black text-[#c9a84c] tracking-wider">{addMoneyForm.memo_no}</span>
                     </div>
                  </div>

                  <form onSubmit={handleAddMoneySubmit} className="space-y-8">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                           <div>
                              <label className={C.label}>Purpose / Title *</label>
                              <div className="relative">
                                 <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#c9a84c] opacity-50" />
                                 <input required type="text" placeholder="e.g. Funding for Petty Cash, Capital Injection" value={addMoneyForm.purpose} onChange={e => setAddMoneyForm({...addMoneyForm, purpose: e.target.value})} className={`${C.input} pl-10`} />
                              </div>
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                              <div>
                                 <label className={C.label}>Amount (৳) *</label>
                                 <div className="relative">
                                    <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#c9a84c]" />
                                    <input required type="number" step="0.01" min="0.01" placeholder="0.00" value={addMoneyForm.amount} onChange={e => setAddMoneyForm({...addMoneyForm, amount: e.target.value})} className={`${C.input} pl-10 text-lg font-mono text-[#c9a84c]`} />
                                 </div>
                              </div>
                              <div>
                                 <label className={C.label}>Date *</label>
                                 <input required type="date" value={addMoneyForm.date} onChange={e => setAddMoneyForm({...addMoneyForm, date: e.target.value})} className={C.input} />
                              </div>
                           </div>
                        </div>

                        <div className="space-y-6">
                           <div>
                              <label className={C.label}>Note (Optional)</label>
                              <textarea rows={4} placeholder="Detailed description of where this fund came from..." value={addMoneyForm.note} onChange={e => setAddMoneyForm({...addMoneyForm, note: e.target.value})} className={`${C.input} resize-none`} />
                           </div>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                        <div className="bg-[#1a2235]/20 p-6 rounded-2xl border border-[rgba(255,255,255,0.06)] shadow-inner">
                           <h3 className="text-sm font-black text-[#c9a84c] uppercase tracking-widest mb-6 flex items-center gap-2">
                              <CreditCard className="w-4 h-4" /> Payment Definition
                           </h3>
                           <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {['cash', 'bikash', 'nagad', 'rocket', 'upay', 'bank_transfer', 'bank_to_bank_transfer', 'cheque'].map(m => (
                                 <label key={m} className={`flex items-center justify-center p-3 rounded-xl border text-center cursor-pointer transition-all ${addMoneyForm.payment_method === m ? 'bg-[#c9a84c]/10 border-[#c9a84c] text-[#c9a84c]' : 'bg-[#131929]/50 border-[rgba(255,255,255,0.06)] text-[#8a95a8] hover:bg-[#1a2235]'}`}>
                                    <input type="radio" value={m} checked={addMoneyForm.payment_method === m} onChange={() => setAddMoneyForm({...addMoneyForm, payment_method: m})} className="hidden" />
                                    <span className="text-[10px] font-black uppercase tracking-tighter">{m.replace(/_/g, ' ')}</span>
                                 </label>
                              ))}
                           </div>
                           {renderPaymentMethodForm()}
                        </div>

                        <div className="flex flex-col gap-6">
                           <div className="flex-1 bg-[#1a2235]/20 p-6 rounded-2xl border border-[rgba(255,255,255,0.06)] shadow-inner">
                              <h3 className="text-sm font-black text-[#c9a84c] uppercase tracking-widest mb-4 flex items-center gap-2">
                                 <UploadCloud className="w-4 h-4" /> Proof Document / Image
                              </h3>
                              <div className="flex flex-wrap gap-3">
                                 {addMoneyPreviews.map((src, idx) => (
                                    <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-[#c9a84c]/30">
                                       <img src={src} className="w-full h-full object-cover" alt="preview" />
                                       <button type="button" onClick={() => removeAddMoneyPhoto(idx)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"><X className="w-3 h-3"/></button>
                                    </div>
                                 ))}
                                 {addMoneyPreviews.length < 5 && (
                                    <label className="w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed border-[#c9a84c]/30 rounded-xl cursor-pointer hover:bg-[#c9a84c]/5 translate-all">
                                       <Plus className="w-6 h-6 text-[#c9a84c]" />
                                       <input type="file" multiple accept="image/*" className="hidden" onChange={handleAddMoneyPhotoChange} />
                                    </label>
                                 )}
                              </div>
                           </div>

                           <div>
                              <label className={C.label}>Authorized By *</label>
                              <select required value={addMoneyForm.authorized_signature} onChange={e => setAddMoneyForm({...addMoneyForm, authorized_signature: e.target.value})} className={C.input}>
                                 <option value="" disabled>-- Select Authorizer --</option>
                                 {employees.filter(e => e.is_authorizer).map(emp => (
                                    <option key={emp.id} value={emp.name}>{emp.name}</option>
                                 ))}
                              </select>
                           </div>
                        </div>
                     </div>

                     <div className="pt-8 border-t border-[rgba(255,255,255,0.06)] flex justify-end gap-4">
                        <button type="button" onClick={() => setAddMoneyForm({...addMoneyForm, purpose: '', amount: '', note: ''})} className="px-8 py-4 font-bold text-[#8a95a8] hover:text-[#e8eaf0] transition-colors uppercase tracking-widest text-xs">Reset Form</button>
                        <button type="submit" disabled={isSubmitting} className="px-10 py-4 bg-gradient-to-br from-[#c9a84c] to-[#f0c040] text-[#0a0900] font-black rounded-2xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3 text-lg uppercase">
                           {isSubmitting ? 'Saving...' : <><Landmark className="w-6 h-6" /> Save Transaction</>}
                        </button>
                     </div>
                  </form>
               </div>

               {/* Add Money History List Below */}
               <div className={`xl:col-span-12 mt-4 ${C.card} overflow-hidden bg-[#131929]`}>
                  <div className="p-6 border-b border-[rgba(255,255,255,0.06)] flex justify-between items-center bg-[#1a2235]/30">
                     <h3 className="font-black text-[#e8eaf0] text-lg flex items-center gap-3"><ArrowRightLeft className="w-5 h-5 text-[#c9a84c]" /> Add Money History</h3>
                     <span className="bg-[#c9a84c]/10 text-[#c9a84c] border border-[#c9a84c]/20 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">{addMoneyList.length} Total Records</span>
                  </div>
                  <div className="overflow-x-auto">
                     <table className="w-full text-left">
                        <thead className="bg-[#131929] border-b border-[rgba(201,168,76,0.18)] text-[#8a95a8] text-[10px] font-black uppercase tracking-widest">
                           <tr>
                              <th className="px-6 py-4">Memo / Date</th>
                              <th className="px-6 py-4">Purpose / Source</th>
                              <th className="px-6 py-4">Payment Info</th>
                              <th className="px-6 py-4 text-right">Amount (৳)</th>
                              <th className="px-6 py-4">Auth Sign</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-[rgba(255,255,255,0.06)]">
                           {addMoneyList.map(item => (
                              <tr key={item.id} className="hover:bg-[#1a2235]/40 transition-colors">
                                 <td className="px-6 py-6">
                                    <div className="font-mono text-[11px] font-black text-[#c9a84c] bg-[#c9a84c]/5 border border-[#c9a84c]/20 inline-block px-2.5 py-1 rounded-lg mb-2 shadow-sm uppercase tracking-wider">{item.memo_no}</div>
                                    <div className="text-xs text-[#8a95a8] font-bold flex items-center gap-1.5"><CalendarIcon className="w-3 h-3"/> {new Date(item.date).toLocaleDateString()}</div>
                                 </td>
                                 <td className="px-6 py-6">
                                    <div className="font-extrabold text-[#e8eaf0] text-base">{item.purpose}</div>
                                    {item.note && <div className="text-[10px] text-[#8a95a8] mt-2 italic font-medium max-w-xs">{item.note}</div>}
                                    {item.photo_urls && item.photo_urls.length > 0 && (
                                       <div className="flex gap-2 mt-3">
                                          {item.photo_urls.map((u: string, i: number) => (
                                             <a key={i} href={u} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-lg overflow-hidden border border-[#c9a84c]/30 block shadow-sm"><img src={u} className="w-full h-full object-cover" alt="Proof"/></a>
                                          ))}
                                       </div>
                                    )}
                                 </td>
                                 <td className="px-6 py-6">
                                    <span className="text-[10px] px-2.5 py-1 bg-[#c9a84c]/5 text-[#c9a84c] border border-[#c9a84c]/20 rounded-md font-black uppercase tracking-widest inline-block mb-2 shadow-sm">{item.payment_method.replace('_', ' ')}</span>
                                    {item.payment_method_details && item.payment_method_details.internal_account_id && (
                                       <div className="text-[10px] font-bold text-[#8a95a8] flex flex-col gap-0.5">
                                          {internalAccounts.find(a => a.id === item.payment_method_details.internal_account_id)?.provider_name}
                                          <span className="font-mono text-[#c9a84c]">{internalAccounts.find(a => a.id === item.payment_method_details.internal_account_id)?.account_number}</span>
                                       </div>
                                    )}
                                 </td>
                                 <td className="px-6 py-6 text-right">
                                    <span className="font-black text-2xl text-[#c9a84c] font-mono drop-shadow-sm">{Number(item.amount).toLocaleString(undefined, {minimumFractionDigits:2})}</span>
                                 </td>
                                 <td className="px-6 py-6">
                                    <div className="flex items-center gap-2 text-xs font-black text-[#e8eaf0] uppercase tracking-wider"><PenTool className="w-3.5 h-3.5 text-[#c9a84c]"/> {item.authorized_signature}</div>
                                 </td>
                              </tr>
                           ))}
                           {addMoneyList.length === 0 && (
                              <tr><td colSpan={5} className="py-20 text-center text-[#8a95a8] text-sm font-medium italic">No fund records found yet. Record your first fund injection above.</td></tr>
                           )}
                        </tbody>
                     </table>
                  </div>
               </div>
            </div>
         )}

         {tab === 'make' && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
               <div className={`${C.card} p-6 md:p-8 flex flex-col`}>
                  <h2 className="text-xl font-black text-[#e8eaf0] mb-6 flex items-center gap-2 border-b border-[rgba(255,255,255,0.06)] pb-4">
                     <Plus className="w-5 h-5 text-[#c9a84c]" /> Create Expense Receipt
                  </h2>
                  <form onSubmit={handleMakeSubmit} className="space-y-5 flex-1 flex flex-col">
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                           <label className={C.label}>Invoice No</label>
                           <input type="text" readOnly value={makeData.invoice_no} className={`${C.input} cursor-not-allowed font-mono font-bold opacity-70`} />
                        </div>
                        <div>
                           <label className={C.label}>Date</label>
                           <input required type="date" value={makeData.date} onChange={e => setMakeData({...makeData, date: e.target.value})} className={C.input} />
                        </div>
                     </div>
                     <div>
                        <label className={`${C.label} flex items-center gap-1.5`}><Tag className="w-3.5 h-3.5 text-[#c9a84c]" /> Item Name</label>
                        <input required type="text" placeholder="e.g. Office Snacks, Printer Ink" value={makeData.item_name} onChange={e => setMakeData({...makeData, item_name: e.target.value})} className={C.input} />
                     </div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                           <label className={C.label}>Quantity</label>
                           <input required type="number" step="0.01" min="0.01" placeholder="0" value={makeData.quantity} onChange={e => setMakeData({...makeData, quantity: e.target.value})} className={C.input} />
                        </div>
                        <div>
                           <label className={C.label}>Unit (Optional)</label>
                           <input type="text" placeholder="e.g. kg, pcs, box" value={makeData.unit} onChange={e => setMakeData({...makeData, unit: e.target.value})} className={C.input} />
                        </div>
                     </div>
                     <div className="pt-4 mt-auto">
                        <button type="submit" disabled={isSubmitting} className={C.buttonPrimary}>
                           {isSubmitting ? 'Generating...' : 'Generate Receipt'}
                        </button>
                     </div>
                  </form>
               </div>

               <div className={`${C.card} overflow-hidden flex flex-col h-full min-h-[500px]`}>
                  <div className="p-5 md:p-6 border-b border-[rgba(255,255,255,0.06)] bg-[#1a2235]/40 flex justify-between items-center">
                     <h3 className="font-black text-[#e8eaf0] text-lg flex items-center gap-2"><AlertCircle className="w-5 h-5 text-orange-500" /> Pending Receipts</h3>
                     <span className="bg-[rgba(251,146,60,0.1)] text-orange-500 border border-[rgba(251,146,60,0.2)] text-xs font-bold px-3 py-1 rounded-full">{pendingExpenses.length} Items</span>
                  </div>
                  <div className="flex-1 overflow-y-auto max-h-[600px] custom-scrollbar p-2">
                     {pendingExpenses.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full p-10 text-[#4a5568]">
                           <CheckCircle2 className="w-14 h-14 mx-auto mb-4 opacity-30" />
                           <p className="font-bold text-[#8a95a8] uppercase tracking-wider">No pending receipts.</p>
                           <p className="text-xs mt-1">All expenses are paid up.</p>
                        </div>
                     ) : (
                        <ul className="space-y-2 p-2">
                           {pendingExpenses.map(e => (
                              <li key={e.id} className="p-4 bg-[#1a2235]/50 border border-[rgba(255,255,255,0.06)] rounded-xl hover:border-[rgba(201,168,76,0.3)] flex justify-between items-center transition-colors group">
                                 <div>
                                    <div className="font-bold text-[#c9a84c] bg-[rgba(201,168,76,0.1)] border border-[rgba(201,168,76,0.2)] px-2 py-0.5 rounded shadow-sm w-max mb-2 text-[10px] font-mono uppercase tracking-wider">{e.invoice_no}</div>
                                    <h4 className="font-extrabold text-[#e8eaf0] text-base group-hover:text-[#c9a84c] transition-colors">{e.item_name}</h4>
                                    <p className="text-xs text-[#8a95a8] font-medium mt-1 flex items-center gap-2">
                                       <span className="text-[#e8eaf0] bg-[#131929] px-1.5 py-0.5 rounded">{e.quantity} {e.unit}</span> • {new Date(e.date).toLocaleDateString()}
                                    </p>
                                 </div>
                                 <span className="text-[10px] font-extrabold text-orange-500 bg-[rgba(251,146,60,0.1)] px-2.5 py-1 rounded-md border border-[rgba(251,146,60,0.2)] uppercase tracking-wider whitespace-nowrap ml-4">
                                    Action Req.
                                 </span>
                              </li>
                           ))}
                        </ul>
                     )}
                  </div>
               </div>
            </div>
         )}

         {tab === 'pay' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
               <div className={`xl:col-span-4 ${C.card} overflow-hidden flex flex-col max-h-[850px]`}>
                  <div className="p-6 border-b border-[rgba(255,255,255,0.06)] bg-[#1a2235]/40 flex items-center gap-2">
                     <AlertCircle className="w-5 h-5 text-orange-500" />
                     <h2 className="font-black text-[#e8eaf0] text-lg">Select Receipt</h2>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                     {pendingExpenses.length === 0 ? (
                         <div className="p-10 text-center flex flex-col items-center justify-center h-full">
                           <CheckCircle2 className="w-12 h-12 text-[#4a5568] opacity-50 mb-3" />
                           <p className="font-bold text-[#8a95a8] text-sm uppercase tracking-wider">No waiting receipts.</p>
                         </div>
                     ) : (
                        pendingExpenses.map(e => (
                           <button 
                              key={e.id} 
                              onClick={() => { setSelectedExpense(e); setPayData({ price_per_unit: '', payment_date: new Date().toISOString().split('T')[0], note: '', authorized_signature: '' }); setPhotoFiles([]); setPhotoPreviews([]); }}
                              className={`w-full text-left p-4 rounded-xl border transition-all ${selectedExpense?.id === e.id ? 'border-[#c9a84c] bg-[rgba(201,168,76,0.1)] shadow-[0_0_15px_rgba(201,168,76,0.15)]' : 'border-[rgba(255,255,255,0.06)] bg-[#1a2235]/40 hover:border-[rgba(201,168,76,0.3)] hover:bg-[#1a2235]'}`}
                           >
                              <div className="flex justify-between items-start mb-1.5">
                                 <span className="font-mono text-[10px] font-black text-[#8a95a8] uppercase tracking-wider">{e.invoice_no}</span>
                                 <span className="text-[10px] text-[#4a5568] font-bold">{new Date(e.date).toLocaleDateString()}</span>
                              </div>
                              <h3 className={`font-extrabold text-base truncate ${selectedExpense?.id === e.id ? 'text-[#c9a84c]' : 'text-[#e8eaf0]'}`}>{e.item_name}</h3>
                              <p className="text-xs font-bold text-[#8a95a8] mt-1.5 flex items-center gap-1.5">
                                 <span className={`px-1.5 py-0.5 rounded ${selectedExpense?.id === e.id ? 'bg-[#c9a84c] text-[#0a0900]' : 'bg-[#131929] text-[#e8eaf0]'}`}>{e.quantity}</span> 
                                 <span className="uppercase text-[10px]">{e.unit}</span>
                              </p>
                           </button>
                        ))
                     )}
                  </div>
               </div>

               <div className="xl:col-span-8">
                  {selectedExpense ? (
                     <div className={`${C.card} p-6 sm:p-8 animate-in slide-in-from-right-4 duration-300 relative overflow-hidden`}>
                        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                           <Banknote className="w-64 h-64 text-[#c9a84c]" />
                        </div>
                        
                        <h2 className="text-2xl font-black text-[#e8eaf0] mb-4">Finalize Payment</h2>
                        
                        <div className="flex flex-wrap gap-3 items-center mb-8 border-b border-[rgba(255,255,255,0.06)] pb-5 text-sm font-medium">
                           <span className="bg-[#1a2235] border border-[rgba(255,255,255,0.06)] px-3 py-1.5 rounded-lg text-[#e8eaf0] shadow-sm">
                              <span className="text-[#8a95a8] font-bold mr-1 uppercase text-[10px] tracking-wider">Item:</span> 
                              {selectedExpense.item_name}
                           </span>
                           <span className="bg-[#1a2235] border border-[rgba(255,255,255,0.06)] px-3 py-1.5 rounded-lg text-[#c9a84c] font-bold shadow-sm">
                              <span className="text-[#8a95a8] font-bold mr-1 uppercase text-[10px] tracking-wider">Qty:</span> 
                              {selectedExpense.quantity} {selectedExpense.unit}
                           </span>
                        </div>

                        <form onSubmit={handlePaySubmit} className="space-y-6 relative z-10">
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                              <div>
                                 <label className={`${C.label} flex items-center gap-1.5`}><Banknote className="w-3.5 h-3.5 text-[#c9a84c]" /> Price per Unit</label>
                                 <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-[#c9a84c]">৳</span>
                                    <input required type="number" step="0.01" min="0" placeholder="0.00" value={payData.price_per_unit} onChange={e => setPayData({...payData, price_per_unit: e.target.value})} className={`${C.input} pl-9 font-extrabold text-lg text-[#c9a84c]`} />
                                 </div>
                              </div>
                              <div>
                                 <label className={`${C.label} flex items-center gap-1.5`}><CalendarIcon className="w-3.5 h-3.5 text-[#c9a84c]" /> Payment Date</label>
                                 <input required type="date" value={payData.payment_date} onChange={e => setPayData({...payData, payment_date: e.target.value})} className={C.input} />
                              </div>
                           </div>

                           <div className="bg-[rgba(201,168,76,0.05)] border border-[rgba(201,168,76,0.18)] p-5 rounded-2xl flex justify-between items-center shadow-inner">
                              <span className="text-xs font-black text-[#8a95a8] uppercase tracking-widest">Total Amount</span>
                              <span className="text-3xl font-black text-[#c9a84c] font-mono">
                                 ৳ {(Number(payData.price_per_unit || 0) * selectedExpense.quantity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                           </div>

                           <div>
                              <label className={`${C.label} flex items-center gap-1.5`}><PenTool className="w-3.5 h-3.5 text-[#c9a84c]" /> Note (Optional)</label>
                              <textarea rows={2} placeholder="Add specific expense details or reasons..." value={payData.note} onChange={e => setPayData({...payData, note: e.target.value})} className={`${C.input} resize-none`} />
                           </div>

                           <div className="bg-[#1a2235]/40 border border-[rgba(255,255,255,0.06)] p-5 rounded-2xl">
                              <label className={`${C.label} flex items-center gap-1.5 mb-3`}><UploadCloud className="w-3.5 h-3.5 text-[#c9a84c]" /> Photos Proof (Max 5)</label>
                              <div className="flex flex-wrap gap-4 items-start">
                                 {photoPreviews.map((src, idx) => (
                                    <div key={idx} className="relative w-24 h-24 rounded-xl overflow-hidden border border-[rgba(201,168,76,0.18)] shadow-md group">
                                       <img src={src} alt="preview" className="w-full h-full object-cover" />
                                       <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                          <button type="button" onClick={() => removePhoto(idx)} className="bg-red-500 text-white rounded-full p-2 hover:scale-110 transition-transform shadow-lg"><X className="w-4 h-4" /></button>
                                       </div>
                                    </div>
                                 ))}
                                 {photoPreviews.length < 5 && (
                                    <label className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed border-[rgba(201,168,76,0.3)] rounded-xl cursor-pointer hover:bg-[rgba(201,168,76,0.05)] hover:border-[#c9a84c] transition-all text-[#8a95a8] hover:text-[#c9a84c] bg-[#131929] shadow-sm">
                                       <Plus className="w-6 h-6 mb-1" />
                                       <span className="text-[10px] font-bold uppercase tracking-wider">Upload</span>
                                       <input type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoChange} />
                                    </label>
                                 )}
                              </div>
                           </div>

                           <div>
                              <label className={`${C.label} flex items-center gap-1.5`}><UserCheck className="w-3.5 h-3.5 text-[#c9a84c]" /> Authorized Signature</label>
                              <select required value={payData.authorized_signature} onChange={e => setPayData({...payData, authorized_signature: e.target.value})} className={`${C.input} appearance-none`}>
                                 <option value="" disabled>-- Select Authorizer Employee --</option>
                                 {employees.filter(e => e.is_authorizer).map(emp => (
                                    <option key={emp.id} value={emp.name}>{emp.name}</option>
                                 ))}
                              </select>
                           </div>

                           <div className="pt-6 border-t border-[rgba(255,255,255,0.06)] flex flex-col-reverse sm:flex-row justify-end gap-4 mt-8">
                              <button type="button" onClick={() => setSelectedExpense(null)} className="w-full sm:w-auto px-6 py-3.5 font-bold text-[#8a95a8] hover:text-[#e8eaf0] hover:bg-[#1a2235] rounded-xl transition-all border border-transparent hover:border-[rgba(255,255,255,0.06)]">Cancel</button>
                              <button type="submit" disabled={isSubmitting} className={`${C.buttonPrimary} w-full sm:w-auto px-8`}>
                                 {isSubmitting ? 'Saving...' : <><CheckCircle2 className="w-5 h-5"/> Pay & Secure Record</>}
                              </button>
                           </div>
                        </form>
                     </div>
                  ) : (
                     <div className="bg-[#131929] rounded-3xl border-2 border-dashed border-[rgba(201,168,76,0.18)] h-full min-h-[500px] flex flex-col items-center justify-center text-[#4a5568] p-8 text-center shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
                        <Banknote className="w-20 h-20 mb-6 opacity-20" />
                        <h3 className="text-2xl font-black text-[#e8eaf0] mb-2">No Receipt Selected</h3>
                        <p className="text-sm text-[#8a95a8] max-w-md font-medium leading-relaxed">Select a pending receipt from the list on the left to add payment details, attach photos, and complete the authorization.</p>
                     </div>
                  )}
               </div>

               {/* Paid History Table Below */}
               <div className={`xl:col-span-12 mt-4 ${C.card} overflow-hidden`}>
                  <div className="p-5 md:p-6 border-b border-[rgba(255,255,255,0.06)] flex flex-wrap gap-4 justify-between items-center bg-[#1a2235]/40">
                     <h3 className="font-black text-[#e8eaf0] text-lg flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-500" /> Paid Expenses History</h3>
                     <span className="text-[10px] font-black text-[#c9a84c] bg-[rgba(201,168,76,0.1)] px-3 py-1.5 rounded-md border border-[rgba(201,168,76,0.2)] uppercase tracking-widest">{paidExpenses.length} Records</span>
                  </div>
                  <div className="overflow-x-auto custom-scrollbar">
                     <table className="w-full text-left min-w-[800px]">
                        <thead className="bg-[#131929] border-b border-[rgba(201,168,76,0.18)] text-[#8a95a8] text-[10px] font-black uppercase tracking-widest">
                           <tr>
                              <th className="px-6 py-4">Receipt Ref</th>
                              <th className="px-6 py-4">Item Details</th>
                              <th className="px-6 py-4">Sign & Proof</th>
                              <th className="px-6 py-4 text-right">Total Paid</th>
                              <th className="px-6 py-4 text-center">Actions</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-[rgba(255,255,255,0.06)] bg-[#1a2235]/20">
                           {paidExpenses.map(e => (
                              <tr key={e.id} className="hover:bg-[#1a2235]/80 transition-colors">
                                 <td className="px-6 py-4">
                                    <div className="font-mono text-[11px] font-black text-[#c9a84c] bg-[rgba(201,168,76,0.05)] border border-[rgba(201,168,76,0.18)] inline-block px-2.5 py-1 rounded mb-1.5">{e.invoice_no}</div>
                                    <div className="text-xs text-[#8a95a8] font-bold">{new Date(e.date).toLocaleDateString()}</div>
                                 </td>
                                 <td className="px-6 py-4">
                                    <div className="font-extrabold text-[#e8eaf0] text-base">{e.item_name}</div>
                                    <div className="text-xs text-[#c9a84c] font-bold mt-1">
                                       <span className="bg-[#131929] px-1.5 py-0.5 rounded text-[#e8eaf0] mr-1">{e.quantity} {e.unit}</span> 
                                       <span className="text-[#8a95a8] font-medium">@ ৳{Number(e.price_per_unit).toLocaleString()}</span>
                                    </div>
                                    {e.note && <div className="text-[10px] text-[#8a95a8] mt-1.5 italic w-48 truncate border-l-2 border-[#4a5568] pl-2">{e.note}</div>}
                                 </td>
                                 <td className="px-6 py-4">
                                    <div className="text-[10px] font-extrabold text-[#e8eaf0] bg-[#131929] inline-flex px-2.5 py-1 rounded border border-[rgba(255,255,255,0.06)] mb-2 items-center gap-1.5 uppercase tracking-wider">
                                       <PenTool className="w-3 h-3 text-[#c9a84c]" /> {e.authorized_signature}
                                    </div>
                                    {e.photo_urls && e.photo_urls.length > 0 ? (
                                       <div className="flex gap-1.5">
                                          {(e.photo_urls as string[]).map((u: string, i: number) => (
                                             <a key={i} href={u} target="_blank" rel="noreferrer" className="block w-8 h-8 rounded-md border border-[rgba(201,168,76,0.3)] overflow-hidden shadow-sm hover:scale-110 transition-transform relative group">
                                                <img src={u} alt="Proof" className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                             </a>
                                          ))}
                                       </div>
                                    ) : <div className="text-[10px] text-[#4a5568] font-bold uppercase tracking-wider">No photos</div>}
                                 </td>
                                 <td className="px-6 py-4 text-right">
                                    <span className="font-black text-xl text-[#c9a84c] font-mono shadow-sm">৳ {Number(e.total_amount).toLocaleString()}</span>
                                    <span className="block text-[9px] uppercase font-black text-emerald-500 mt-1 tracking-widest">Paid Successfully</span>
                                 </td>
                                 <td className="px-6 py-4 text-center">
                                    <button onClick={() => setViewingExpense(e)} className="p-2.5 text-[#8a95a8] hover:text-[#c9a84c] hover:bg-[rgba(201,168,76,0.1)] rounded-lg transition-colors border border-transparent hover:border-[rgba(201,168,76,0.18)]" title="View Details">
                                       <Eye className="w-5 h-5" />
                                    </button>
                                 </td>
                              </tr>
                           ))}
                           {paidExpenses.length === 0 && (
                              <tr>
                                 <td colSpan={5} className="py-12 text-center text-[#8a95a8] text-sm font-medium italic">No paid expenses yet.</td>
                              </tr>
                           )}
                        </tbody>
                     </table>
                  </div>
               </div>
            </div>
         )}
         {viewingExpense && <ExpenseViewModal expense={viewingExpense} onClose={() => setViewingExpense(null)} />}
      </div>
   );
}

function ExpenseViewModal({ expense, onClose }: { expense: any, onClose: () => void }) {
   return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 w-full h-[100dvh]">
         <div className="bg-[#131929] rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 border border-[rgba(201,168,76,0.18)] custom-scrollbar flex flex-col">
            
            <div className="h-28 sm:h-32 bg-gradient-to-r from-[#131929] to-[#1a2235] border-b border-[rgba(201,168,76,0.18)] relative shrink-0">
               <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#c9a84c 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
               <button onClick={onClose} className="absolute top-4 right-4 text-[#8a95a8] hover:text-white bg-[#1a2235]/80 hover:bg-red-500/80 p-2 rounded-full transition-colors backdrop-blur-md z-10 border border-[rgba(255,255,255,0.1)]"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="px-6 sm:px-8 pb-8 pt-0 relative flex-1">
               <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 mb-8 -mt-12 sm:-mt-14 relative z-10">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 bg-[#131929] border border-[rgba(201,168,76,0.18)] rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] flex items-center justify-center shrink-0 p-2">
                     <div className="w-full h-full bg-[#1a2235] border border-[rgba(255,255,255,0.06)] rounded-2xl flex items-center justify-center">
                        <ReceiptText className="w-10 h-10 sm:w-12 sm:h-12 text-[#c9a84c]" />
                     </div>
                  </div>
                  <div className="text-center sm:text-left pb-2">
                     <p className="font-mono text-[11px] font-black text-[#8a95a8] uppercase tracking-widest mb-1.5">{expense.invoice_no}</p>
                     <h3 className="font-black text-[#e8eaf0] text-2xl sm:text-3xl tracking-tight leading-tight">{expense.item_name}</h3>
                  </div>
               </div>
               
               <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
                  <div className="bg-[#1a2235]/50 rounded-2xl p-4 sm:p-5 border border-[rgba(255,255,255,0.06)] shadow-inner">
                     <p className="text-[9px] sm:text-[10px] font-black text-[#8a95a8] uppercase tracking-widest mb-1.5">Receipt Date</p>
                     <p className="font-bold text-[#e8eaf0] text-sm sm:text-base">{expense.date ? new Date(expense.date).toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'}) : '—'}</p>
                  </div>
                  <div className="bg-[rgba(52,211,153,0.05)] rounded-2xl p-4 sm:p-5 border border-[rgba(52,211,153,0.2)] shadow-inner">
                     <p className="text-[9px] sm:text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1.5">Payment Date</p>
                     <p className="font-bold text-emerald-400 text-sm sm:text-base">{expense.payment_date ? new Date(expense.payment_date).toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'}) : '—'}</p>
                  </div>
                  <div className="bg-[#1a2235]/50 rounded-2xl p-4 sm:p-5 border border-[rgba(255,255,255,0.06)] shadow-inner">
                     <p className="text-[9px] sm:text-[10px] font-black text-[#8a95a8] uppercase tracking-widest mb-1.5">Quantity</p>
                     <p className="font-bold text-[#e8eaf0] text-sm sm:text-base flex items-baseline gap-1.5">{expense.quantity} <span className="text-[#8a95a8] font-bold text-[10px] uppercase tracking-wider">{expense.unit}</span></p>
                  </div>
                  <div className="bg-[#1a2235]/50 rounded-2xl p-4 sm:p-5 border border-[rgba(255,255,255,0.06)] shadow-inner">
                     <p className="text-[9px] sm:text-[10px] font-black text-[#8a95a8] uppercase tracking-widest mb-1.5">Price / Unit</p>
                     <p className="font-bold text-[#c9a84c] text-sm sm:text-base font-mono">৳ {Number(expense.price_per_unit).toLocaleString()}</p>
                  </div>
               </div>
               
               <div className="bg-gradient-to-r from-[#c9a84c] to-[#f0c040] text-[#0a0900] rounded-2xl p-5 sm:p-6 flex justify-between items-center mb-6 shadow-[0_4px_24px_rgba(201,168,76,0.3)] border border-[#f0c040]">
                  <span className="font-black text-xs sm:text-sm uppercase tracking-wider opacity-80">Total Amount Paid</span>
                  <span className="font-black text-2xl sm:text-3xl font-mono">৳ {Number(expense.total_amount).toLocaleString()}</span>
               </div>
               
               {expense.authorized_signature && (
                  <div className="flex items-center gap-4 mb-5 bg-[#131929] px-5 py-4 rounded-2xl border border-[rgba(201,168,76,0.18)] shadow-inner">
                     <div className="w-10 h-10 rounded-full bg-[rgba(201,168,76,0.1)] flex items-center justify-center border border-[rgba(201,168,76,0.3)]">
                        <PenTool className="w-4 h-4 text-[#c9a84c]" />
                     </div>
                     <div>
                        <p className="text-[9px] font-black text-[#8a95a8] uppercase tracking-widest mb-0.5">Authorized By</p>
                        <p className="font-extrabold text-[#e8eaf0] text-sm sm:text-base">{expense.authorized_signature}</p>
                     </div>
                  </div>
               )}
               
               {expense.note && (
                  <div className="mb-6 bg-[#1a2235]/50 p-5 rounded-2xl border border-[rgba(255,255,255,0.06)] shadow-inner">
                     <p className="text-[9px] font-black text-[#c9a84c] uppercase tracking-widest mb-2 flex items-center gap-1.5"><ReceiptText className="w-3 h-3"/> Note</p>
                     <p className="text-sm font-medium text-[#8a95a8] leading-relaxed">{expense.note}</p>
                  </div>
               )}
               
               {expense.photo_urls && expense.photo_urls.length > 0 && (
                  <div>
                     <p className="text-[10px] font-black text-[#8a95a8] uppercase tracking-widest mb-3 flex items-center gap-2"><UploadCloud className="w-4 h-4 text-[#c9a84c]"/> Attached Proofs</p>
                     <div className="flex flex-wrap gap-3">
                        {(expense.photo_urls as string[]).map((u: string, i: number) => (
                           <a key={i} href={u} target="_blank" rel="noreferrer" className="block w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border border-[rgba(201,168,76,0.3)] shadow-[0_4px_12px_rgba(0,0,0,0.5)] hover:scale-105 transition-transform relative group">
                              <img src={u} alt={`Proof ${i+1}`} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                 <Eye className="w-6 h-6 text-white drop-shadow-md" />
                              </div>
                           </a>
                        ))}
                     </div>
                  </div>
               )}
            </div>
         </div>
      </div>
   );
}

export default function ExpensesPage() {
   return (
      <Suspense fallback={<div className="font-bold p-10 text-center text-[#c9a84c]">Loading Expenses...</div>}>
         <ExpensesContent />
      </Suspense>
   );
}