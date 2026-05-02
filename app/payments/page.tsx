'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Plus, Trash2, Banknote, ArrowUpRight, ArrowDownLeft, Store, Users, UserCheck, Calendar, CheckCircle2, X, Wallet, Building2, Ticket, Eye, Info, PenTool, ArrowRightLeft, Receipt, Search, Filter, ChevronLeft, ChevronRight, MoreVertical, Smartphone, Zap, Flame, Rocket, Link, Check, FileText, ChevronDown } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

type PaymentType = 'in' | 'out' | 'add_money';
type PaymentMethod = 'cash' | 'bikash' | 'nagad' | 'rocket' | 'upay' | 'bank_transfer' | 'bank_to_bank_transfer' | 'cheque';

export default function PaymentsPage() {
   return (
      <Suspense fallback={<div className="p-10 font-bold text-center text-[#c9a84c]">Loading payments...</div>}>
         <PaymentsContent />
      </Suspense>
   );
}

function PaymentsContent() {
   const router = useRouter();
   const searchParams = useSearchParams();
   const initTab = (searchParams.get('tab') as PaymentType) || 'in';

   const { user } = useAuth();
   const role = user?.role || 'member';
   const canAdd = role === 'admin' || role === 'manager';
   const canDelete = role === 'admin';

   const [activeTab, setActiveTab] = useState<PaymentType>(initTab);
   const [showBuilder, setShowBuilder] = useState(false);

   const [payments, setPayments] = useState<any[]>([]);
   const [contacts, setContacts] = useState<any[]>([]);
   const [internalAccounts, setInternalAccounts] = useState<any[]>([]);
   const [employees, setEmployees] = useState<any[]>([]);

   // Add Money states
   const [addMoneyList, setAddMoneyList] = useState<any[]>([]);
   const generateAddMoneyMemo = () => `ADM-${Math.floor(100000 + Math.random() * 900000)}`;
   const [addMoneyForm, setAddMoneyForm] = useState({
      memo_no: '',
      date: new Date().toISOString().split('T')[0],
      purpose: '',
      amount: '',
      note: '',
      payment_method: 'cash' as PaymentMethod,
      payment_method_details: {
         memo_no: '', number: '', transaction_id: '', bank_name: '', account_name: '', account_number: '', branch: '', datetime: '', cheque_number: '', cheque_date: '', internal_account_id: ''
      },
      authorized_signature: ''
   });
   const [addMoneyPhotos, setAddMoneyPhotos] = useState<File[]>([]);
   const [addMoneyPreviews, setAddMoneyPreviews] = useState<string[]>([]);

   const generateMemoNo = () => `MEMO-${Math.floor(100000 + Math.random() * 900000)}`;

   const [form, setForm] = useState({
      contact_id: '',
      date: '',
      amount: '',
      method: 'cash' as PaymentMethod,
      details: {
         memo_no: '', number: '', transaction_id: '', bank_name: '', account_name: '', account_number: '', branch: '', datetime: '', cheque_number: '', cheque_date: '', internal_account_id: ''
      },
      authorized_signature: '',
      received_by: '',
      notes: '',
      linked_invoice: '',
      cash_received: '',
      cash_change: ''
   });

   const [submitting, setSubmitting] = useState(false);
   const [viewPayment, setViewPayment] = useState<any>(null);
   const [selectedContactDue, setSelectedContactDue] = useState<number | null>(null);
   const [loadingDue, setLoadingDue] = useState(false);
   const [allPaymentsIn, setAllPaymentsIn] = useState<any[]>([]);
   const [allPaymentsOut, setAllPaymentsOut] = useState<any[]>([]);
   const [searchQuery, setSearchQuery] = useState('');
   const [currentPage, setCurrentPage] = useState(1);
   const [pageSize, setPageSize] = useState(10);

   useEffect(() => {
      if (!form.details.memo_no) {
         setForm(prev => ({
            ...prev,
            date: prev.date || new Date().toISOString().split('T')[0],
            details: { ...prev.details, memo_no: generateMemoNo() }
         }));
      }
      const tab = searchParams.get('tab');
      if (tab === 'in' || tab === 'out' || tab === 'add_money') {
         setActiveTab(tab as PaymentType);
         setShowBuilder(false);
      }
      if (!addMoneyForm.memo_no) {
         setAddMoneyForm(prev => ({ ...prev, memo_no: generateAddMoneyMemo() }));
      }
   }, [searchParams]);

   useEffect(() => {
      if (activeTab === 'add_money') {
         fetchAddMoney();
      } else {
         fetchPayments();
      }
      fetchAllPayments();
      fetchContacts();
      fetchInternalAccounts();
      fetchEmployees();
   }, [activeTab]);

   const fetchInternalAccounts = async () => {
      if (internalAccounts.length > 0) return;
      try {
         const data = await api.getInternalAccounts({ ordering: 'provider_name' });
         setInternalAccounts(Array.isArray(data) ? data : data.results ?? []);
      } catch (err) { console.error('fetchInternalAccounts:', err); }
   };

   const fetchEmployees = async () => {
      if (employees.length > 0) return;
      try {
         const data = await api.getEmployees({ ordering: 'name' });
         setEmployees(Array.isArray(data) ? data : data.results ?? []);
      } catch (err) { console.error('fetchEmployees:', err); }
   };

   const handleTabChange = (tab: PaymentType) => {
      setActiveTab(tab);
      setShowBuilder(false);
      router.push(`/payments?tab=${tab}`);
   };

   const fetchContacts = async () => {
      try {
         const targetTypes = activeTab === 'in' ? ['customer'] : ['supplier', 'processor'];
         const results = await Promise.all(targetTypes.map(t => api.getContacts({ type: t })));
         const combined = results.flatMap(r => Array.isArray(r) ? r : r.results ?? []);
         setContacts(combined);
      } catch (err) { console.error('fetchContacts:', err); }
   };

   const fetchPayments = async () => {
      try {
         const data = await api.getPayments({ type: activeTab as 'in' | 'out', ordering: '-created_at', limit: 100 });
         setPayments(Array.isArray(data) ? data : data.results ?? []);
      } catch (err) { console.error('fetchPayments:', err); }
   };

   const fetchAllPayments = async () => {
      try {
         const [inData, outData] = await Promise.all([
            api.getPayments({ type: 'in', ordering: '-created_at', limit: 500 }),
            api.getPayments({ type: 'out', ordering: '-created_at', limit: 500 }),
         ]);
         setAllPaymentsIn(Array.isArray(inData) ? inData : inData.results ?? []);
         setAllPaymentsOut(Array.isArray(outData) ? outData : outData.results ?? []);
      } catch (err) { console.error('fetchAllPayments:', err); }
   };

   const fetchAddMoney = async () => {
      try {
         const data = await api.getAddMoney({ ordering: '-created_at', limit: 100 });
         setAddMoneyList(Array.isArray(data) ? data : data.results ?? []);
      } catch (err) { console.error('fetchAddMoney:', err); }
   };

   useEffect(() => {
      if (!form.contact_id || !showBuilder) {
         setSelectedContactDue(null);
         return;
      }
      const fetchCalculatedDue = async () => {
         setLoadingDue(true);
         try {
             const contactType = activeTab;
             const res = await api.getContactDue(form.contact_id, contactType);
             setSelectedContactDue(res.due || 0);
         } catch (err) {
            setSelectedContactDue(null);
         } finally {
            setLoadingDue(false);
         }
      };
      fetchCalculatedDue();
   }, [form.contact_id, activeTab, showBuilder]);

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!form.contact_id || !form.amount || Number(form.amount) <= 0) {
         alert('Please fill out required fields securely.');
         return;
      }
      setSubmitting(true);

      try {
         const paymentPayload = {
            type: activeTab,
            contact: form.contact_id,
            amount: Number(form.amount),
            method: form.method,
            date: form.date,
            payment_method_details: form.details,
            authorized_signature: form.authorized_signature,
            received_by: form.received_by,
            notes: form.notes
         };

         const result = await api.createPayment(paymentPayload);
         setViewPayment(result);

         if (form.method === 'cheque') {
            await api.createCheck({
               type: activeTab === 'in' ? 'received' : 'issued',
               check_number: form.details.cheque_number,
               bank_name: activeTab === 'in' ? form.details.account_name : form.details.bank_name,
               amount: Number(form.amount),
               issue_date: form.date,
               cash_date: form.details.cheque_date,
               status: 'pending',
               partner_id: form.contact_id
            });
         }

         setShowBuilder(false);
         resetForm();
         fetchPayments();
      } catch (e: any) {
         console.error(e);
         alert('Failed saving payment logs.');
      } finally {
         setSubmitting(false);
      }
   };

   const resetForm = () => {
      setForm({
         contact_id: '', date: new Date().toISOString().split('T')[0], amount: '', method: 'cash',
         details: { memo_no: generateMemoNo(), number: '', transaction_id: '', bank_name: '', account_name: '', account_number: '', branch: '', datetime: '', cheque_number: '', cheque_date: '', internal_account_id: '' },
         authorized_signature: '', received_by: '', notes: '', linked_invoice: '', cash_received: '', cash_change: ''
      });
   };

   const handleDelete = async (id: string) => {
      if (!canDelete) { alert("You don't have permission to delete."); return; }
      if (!window.confirm('Delete this payment? This cannot be undone.')) return;
      try {
         await api.deletePayment(id);
         fetchPayments();
      } catch (err) { console.error('deletePayment:', err); }
   };

   const handlePrintReceipt = (payment: any) => { /* Same print logic as before */
      if (!payment) return;
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;
      const contactName = payment.contact_details?.name || 'Customer/Supplier';
      const memoNo = payment.payment_method_details?.memo_no || 'N/A';
      printWindow.document.write(`
      <html>
        <head>
          <title>Money Receipt - ${memoNo}</title>
          <style>
            body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #333; }
            .receipt-container { border: 2px solid #000; padding: 30px; border-radius: 10px; max-width: 800px; margin: auto; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 20px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 15px; }
            .label { font-weight: bold; color: #666; font-size: 14px; text-transform: uppercase; }
            .value { font-weight: 800; font-size: 16px; border-bottom: 1px dotted #ccc; flex: 1; margin-left: 10px; }
            .amount-box { background: #f8f9fa; padding: 20px; border: 2px solid #000; display: inline-block; font-size: 24px; font-weight: 900; margin-top: 20px; }
            .signature-row { display: flex; justify-content: space-between; margin-top: 60px; }
            .signature { border-top: 2px solid #000; width: 200px; text-align: center; padding-top: 5px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <div class="header">
              <h1 style="margin:0;">LedgerGhor ERP</h1>
              <p style="margin:5px 0;">Official Money Receipt</p>
              <h3 style="margin:10px 0; background: #000; color: #fff; display: inline-block; padding: 5px 20px;">${payment.type === 'in' ? 'RECEIPT' : 'PAYMENT VOUCHER'}</h3>
            </div>
            <div class="row">
              <div style="flex: 1; display: flex;"><span class="label">Memo No:</span> <span class="value">${memoNo}</span></div>
              <div style="width: 200px; display: flex;"><span class="label">Date:</span> <span class="value">${new Date(payment.date).toLocaleDateString()}</span></div>
            </div>
            <div class="row"><span class="label">Received From / Paid To:</span><span class="value">${contactName}</span></div>
            <div class="row"><span class="label">Payment Method:</span><span class="value">${payment.method.toUpperCase().replace('_', ' ')}</span></div>
            ${payment.payment_method_details?.transaction_id ? `<div class="row"><span class="label">Trx ID:</span> <span class="value">${payment.payment_method_details.transaction_id}</span></div>` : ''}
            <div class="amount-box">TK. ${Number(payment.amount).toLocaleString()} /-</div>
            <div class="signature-row">
              <div class="signature">Authorized Signature</div>
              <div class="signature">Receiver's Signature</div>
            </div>
          </div>
          <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
      printWindow.document.close();
   };

   const handleAddMoneySubmit = async (e: React.FormEvent) => { /* Add money logic */
      e.preventDefault();
      if (!addMoneyForm.purpose || !addMoneyForm.amount || !addMoneyForm.authorized_signature) return;
      setSubmitting(true);
      try {
         const uploadedUrls = addMoneyPhotos.length > 0 ? await Promise.all(addMoneyPhotos.map((file) => api.uploadFile(file))) : [];
         await api.createAddMoney({ ...addMoneyForm, amount: Number(addMoneyForm.amount), photo_urls: uploadedUrls });
         alert('Money added successfully!');
         setAddMoneyForm({ ...addMoneyForm, memo_no: generateAddMoneyMemo(), purpose: '', amount: '', note: '', payment_method: 'cash', payment_method_details: { ...addMoneyForm.payment_method_details, memo_no: generateAddMoneyMemo() }});
         setAddMoneyPhotos([]); setAddMoneyPreviews([]); fetchAddMoney();
      } catch (err) { alert('Failed to save record.'); } finally { setSubmitting(false); }
   };
   const handleAddMoneyPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
         const filesArray = Array.from(e.target.files);
         if (addMoneyPhotos.length + filesArray.length > 5) return alert('Max 5 photos allowed.');
         setAddMoneyPhotos(prev => [...prev, ...filesArray]);
         setAddMoneyPreviews(prev => [...prev, ...filesArray.map(f => URL.createObjectURL(f))]);
      }
   };
   const removeAddMoneyPhoto = (index: number) => {
      setAddMoneyPhotos(prev => prev.filter((_, i) => i !== index));
      setAddMoneyPreviews(prev => prev.filter((_, i) => i !== index));
   };

   const C = {
      card: "bg-[#111827] rounded-2xl shadow-lg border border-[#1f2937]",
      input: "w-full border border-[rgba(255,255,255,0.1)] rounded-xl p-3 bg-[#0f172a] text-[#f8fafc] placeholder-[#64748b] focus:border-[#c9a84c] focus:ring-1 focus:ring-[#c9a84c] outline-none transition-all font-medium text-sm",
      label: "text-[11px] font-semibold text-[#94a3b8] uppercase tracking-widest flex items-center gap-2 mb-1.5",
      labelAccent: "w-1 h-3 rounded-full"
   };

   // RENDER BADGE HELPER
   const renderMethodBadge = (method: string) => {
      switch(method) {
         case 'cash': return <span className="flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium rounded-lg bg-[#22c55e]/10 text-[#22c55e] w-fit whitespace-nowrap"><Banknote className="w-4 h-4" /> Cash</span>;
         case 'bikash': case 'bkash': return <span className="flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium rounded-lg bg-[#e2136e]/10 text-[#e2136e] w-fit whitespace-nowrap">
            <svg viewBox="58 0 62 60" className="w-[20px] h-[20px] fill-current" xmlns="http://www.w3.org/2000/svg"><path d="M110 30l-26-4 3.5 15.5z" /><path d="M110 30L90 3l-6.5 23.5z" /><path d="M83 26L62 1l27.5 3.5z" /><path d="M75 15l-11.5-11h3z" /><path d="M117 17l-5 13-8-11z" /><path d="M92 42l19-7.5 1-2.5z" /><path d="M76 56l8-29 4 19z" /><path d="M118 17l-2 5.5 7.5-.1z" /></svg> bKash</span>;
         case 'nagad': return <span className="flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium rounded-lg bg-[#f97316]/10 text-[#f97316] w-fit whitespace-nowrap">
            <svg viewBox="0 0 100 100" className="w-[18px] h-[18px] fill-current" xmlns="http://www.w3.org/2000/svg"><path d="M50 0C22.4 0 0 22.4 0 50s22.4 50 50 50 50-22.4 50-50S77.6 0 50 0zm0 85C30.7 85 15 69.3 15 50S30.7 15 50 15s35 15.7 35 35-15.7 35-35 35z" opacity={0.3} /><path d="M50 25c-13.8 0-25 11.2-25 25s11.2 25 25 25h3.2v-1.8c-2.4-4.8-2.6-11.4 1.3-16.7 4-5.3 11.3-7.5 17.6-5.4 6 2 10.3 7.8 10.3 14.1 0 12.5-9.6 22.2-22.4 22.2V90c21 0 38.6-17.7 38.6-39.6S80.4 25 50 25z" /></svg> Nagad</span>;
         case 'bank_transfer': return <span className="flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium rounded-lg bg-[#3b82f6]/10 text-[#3b82f6] w-fit whitespace-nowrap"><Building2 className="w-4 h-4" /> Bank Transfer</span>;
         case 'cheque': return <span className="flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium rounded-lg bg-[#eab308]/10 text-[#eab308] w-fit whitespace-nowrap"><Wallet className="w-4 h-4" /> Cheque</span>;
         case 'rocket': return <span className="flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium rounded-lg bg-[#a855f7]/10 text-[#a855f7] w-fit whitespace-nowrap"><Rocket className="w-4 h-4" /> Rocket</span>;
         case 'upay': return <span className="flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium rounded-lg bg-[#14b8a6]/10 text-[#14b8a6] w-fit whitespace-nowrap">
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4 11c0 2.2-1.8 4-4 4s-4-1.8-4-4V7h2v6c0 1.1.9 2 2 2s2-.9 2-2V7h2v6z" /></svg> Upay</span>;
         case 'bank_to_bank_transfer': return <span className="flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium rounded-lg bg-[#3b82f6]/10 text-[#3b82f6] w-fit whitespace-nowrap"><Link className="w-4 h-4" /> Bank-to-Bank</span>;
         default: return <span className="flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium rounded-lg bg-[#1a2235] text-[#8a95a8] border border-[rgba(255,255,255,0.1)] w-fit whitespace-nowrap">{method.replace(/_/g, ' ')}</span>;
      }
   };

   // Dynamic Detail section for Modal
   const renderModalMethodDetails = () => {

      const selectedContact = contacts.find(c => c.id === form.contact_id);
      const contactBanks = selectedContact && Array.isArray(selectedContact.bank_details) ? selectedContact.bank_details : (selectedContact && selectedContact.bank_details && Object.keys(selectedContact.bank_details).length > 0 ? [selectedContact.bank_details] : []);

      if (['bikash', 'nagad', 'rocket', 'upay'].includes(form.method)) {
         return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 p-4 bg-[#131929] rounded-xl border border-[rgba(255,255,255,0.05)]">
               <div className="col-span-1 sm:col-span-2">
                  <label className={C.label}><span className={`${C.labelAccent} bg-[#c9a84c]`}></span> Account / Wallet</label>
                  <select required value={form.details.internal_account_id} onChange={e => setForm({ ...form, details: { ...form.details, internal_account_id: e.target.value } })} className={`${C.input} appearance-none`}>
                     <option value="" disabled>Select your {form.method} account</option>
                     {internalAccounts.filter(acc => acc.account_type === 'wallet' && acc.provider_name.toLowerCase() === form.method.toLowerCase()).map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.provider_name} - {acc.account_number}</option>
                     ))}
                  </select>
               </div>
               <div>
                  <label className={C.label}><span className={`${C.labelAccent} bg-[#8a95a8]`}></span> Number</label>
                  <input required placeholder="+8801..." type="text" value={form.details.number} onChange={e => setForm({ ...form, details: { ...form.details, number: e.target.value } })} className={C.input} />
               </div>
               <div>
                  <label className={C.label}><span className={`${C.labelAccent} bg-[#8a95a8]`}></span> Trx ID</label>
                  <input required placeholder="TRX..." type="text" value={form.details.transaction_id} onChange={e => setForm({ ...form, details: { ...form.details, transaction_id: e.target.value } })} className={`${C.input} font-mono uppercase`} />
               </div>
            </div>
         );
      }

      if (form.method === 'bank_transfer' || form.method === 'bank_to_bank_transfer') {
         return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 p-4 bg-[#131929] rounded-xl border border-[rgba(255,255,255,0.05)]">
               <div className="col-span-1 sm:col-span-2">
                  <label className={C.label}><span className={`${C.labelAccent} bg-[#3b82f6]`}></span> Your Bank Account</label>
                  <select required value={form.details.internal_account_id} onChange={e => setForm({ ...form, details: { ...form.details, internal_account_id: e.target.value } })} className={`${C.input} appearance-none`}>
                     <option value="" disabled>Select your Bank Account</option>
                     {internalAccounts.filter(acc => acc.account_type === 'bank').map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.provider_name} - {acc.account_number}</option>
                     ))}
                  </select>
               </div>
               {form.method === 'bank_to_bank_transfer' && (
                  <div className="col-span-1 sm:col-span-2">
                     <label className={C.label}><span className={`${C.labelAccent} bg-[#8a95a8]`}></span> Partner's Bank Account</label>
                     <select required value={form.details.bank_name ? `${form.details.bank_name}|${form.details.account_number}` : '|'} onChange={e => {
                        const val = e.target.value;
                        const sel = contactBanks.find((b:any) => `${b.bank_name}|${b.account_number}` === val);
                        if (sel) setForm({ ...form, details: { ...form.details, bank_name: sel.bank_name, account_name: sel.account_name, account_number: sel.account_number, branch: sel.branch } });
                     }} className={`${C.input} appearance-none`}>
                        <option value="|" disabled>Select Partner Bank Account</option>
                        {contactBanks.map((b: any, idx: number) => b.bank_name ? <option key={idx} value={`${b.bank_name}|${b.account_number}`}>{b.bank_name} - {b.account_number}</option> : null)}
                     </select>
                  </div>
               )}
            </div>
         );
      }

      if (form.method === 'cheque') {
         return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 p-4 bg-[#131929] rounded-xl border border-[rgba(255,255,255,0.05)]">
               <div>
                  <label className={C.label}><span className={`${C.labelAccent} bg-[#eab308]`}></span> Cheque Number</label>
                  <input required type="text" value={form.details.cheque_number} onChange={e => setForm({ ...form, details: { ...form.details, cheque_number: e.target.value } })} className={C.input} />
               </div>
               <div>
                  <label className={C.label}><span className={`${C.labelAccent} bg-[#8a95a8]`}></span> Cheque Date</label>
                  <input required type="date" value={form.details.cheque_date} onChange={e => setForm({ ...form, details: { ...form.details, cheque_date: e.target.value } })} className={C.input} />
               </div>
               <div className="col-span-1 sm:col-span-2">
                  <label className={C.label}><span className={`${C.labelAccent} bg-[#8a95a8]`}></span> Bank Name</label>
                  <input required type="text" value={activeTab === 'in' ? form.details.account_name : form.details.bank_name} onChange={e => {
                     const val = e.target.value;
                     activeTab === 'in' ? setForm({ ...form, details: { ...form.details, account_name: val } }) : setForm({ ...form, details: { ...form.details, bank_name: val } });
                  }} className={C.input} />
               </div>
            </div>
         );
      }
      return null;
   };

   // Add Money Section Render Details
   const renderAddMoneyMethodForm = () => { /* Remains unchanged */
      const m = addMoneyForm.payment_method;
      const details = addMoneyForm.payment_method_details;
      const setDetails = (d: any) => setAddMoneyForm({ ...addMoneyForm, payment_method_details: { ...details, ...d } });
      if (['bikash', 'nagad', 'rocket', 'upay'].includes(m)) {
         return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 p-4 bg-[#1a2235]/40 rounded-xl border border-[rgba(255,255,255,0.06)]">
               <div className="col-span-1 sm:col-span-2">
                  <label className={C.label}>Receiving To</label>
                  <select required value={details.internal_account_id} onChange={e => setDetails({ internal_account_id: e.target.value })} className={`${C.input} appearance-none`}>
                     <option value="" disabled>Select your {m} account</option>
                     {internalAccounts.filter(acc => acc.account_type === 'wallet' && acc.provider_name.toLowerCase() === m.toLowerCase()).map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.provider_name} - {acc.account_number}</option>
                     ))}
                  </select>
               </div>
               <div><label className={C.label}>Send Number</label><input required type="text" value={details.number} onChange={e => setDetails({ number: e.target.value })} className={C.input} /></div>
               <div><label className={C.label}>Trx ID</label><input required type="text" value={details.transaction_id} onChange={e => setDetails({ transaction_id: e.target.value })} className={C.input} /></div>
            </div>
         );
      }
      if (m === 'bank_transfer' || m === 'bank_to_bank_transfer') {
         return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 p-4 bg-[#1a2235]/40 rounded-xl border border-[rgba(255,255,255,0.06)]">
               <div className="col-span-1 sm:col-span-2">
                  <label className={C.label}>Receiving Bank Account</label>
                  <select required value={details.internal_account_id} onChange={e => setDetails({ internal_account_id: e.target.value })} className={`${C.input} appearance-none`}>
                     <option value="" disabled>Select Bank Account</option>
                     {internalAccounts.filter(acc => acc.account_type === 'bank').map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.provider_name} - {acc.account_number}</option>
                     ))}
                  </select>
               </div>
            </div>
         );
      }
      if (m === 'cheque') {
         return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 p-4 bg-[#1a2235]/40 rounded-xl border border-[rgba(255,255,255,0.06)]">
               <div><label className={C.label}>Cheque No</label><input required type="text" value={details.cheque_number} onChange={e => setDetails({ cheque_number: e.target.value })} className={C.input} /></div>
               <div><label className={C.label}>Cheque Date</label><input required type="date" value={details.cheque_date} onChange={e => setDetails({ cheque_date: e.target.value })} className={C.input} /></div>
               <div className="col-span-1 sm:col-span-2"><label className={C.label}>Bank Name</label><input required type="text" value={details.bank_name} onChange={e => setDetails({ bank_name: e.target.value })} className={C.input} /></div>
            </div>
         );
      }
      return null;
   };

   // Filter and Pagination logic
   const filteredPayments = payments.filter(p => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
         p.id?.toLowerCase().includes(q) ||
         p.contact_details?.name?.toLowerCase().includes(q) ||
         p.contact_details?.phone?.toLowerCase().includes(q) ||
         p.method?.toLowerCase().includes(q) ||
         p.payment_method_details?.memo_no?.toLowerCase().includes(q) ||
         p.payment_method_details?.transaction_id?.toLowerCase().includes(q)
      );
   });
   const totalPages = Math.max(1, Math.ceil(filteredPayments.length / pageSize));
   const pagedPayments = filteredPayments.slice((currentPage - 1) * pageSize, currentPage * pageSize);


   return (
      <div className="pb-12 font-sans animate-in fade-in duration-300 relative">

         {/* --- MAIN DASHBOARD VIEW --- */}
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
               <h1 className="text-2xl font-black text-[#e8eaf0] tracking-tight">Financial Transactions</h1>
               <p className="text-sm text-[#8a95a8] font-medium mt-1">Manage all incoming and outgoing payments.</p>
            </div>

            <div className="flex items-center gap-3">
               <div className="flex bg-[#1a2235] p-1 rounded-xl border border-[rgba(255,255,255,0.06)] shadow-sm">
                  <button onClick={() => handleTabChange('in')} className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'in' ? 'bg-[#c9a84c] text-[#0a0900] shadow-[0_2px_10px_rgba(201,168,76,0.3)]' : 'text-[#8a95a8] hover:text-[#e8eaf0]'}`}>
                     Received (In)
                  </button>
                  <button onClick={() => handleTabChange('out')} className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'out' ? 'bg-[#c9a84c] text-[#0a0900] shadow-[0_2px_10px_rgba(201,168,76,0.3)]' : 'text-[#8a95a8] hover:text-[#e8eaf0]'}`}>
                     Paid (Out)
                  </button>
                  <button onClick={() => handleTabChange('add_money')} className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'add_money' ? 'bg-[#c9a84c] text-[#0a0900] shadow-[0_2px_10px_rgba(201,168,76,0.3)]' : 'text-[#8a95a8] hover:text-[#e8eaf0]'}`}>
                     Add Money
                  </button>
               </div>
               {canAdd && activeTab !== 'add_money' && (
                  <button onClick={() => { resetForm(); setShowBuilder(true); }} className="bg-gradient-to-br from-[#c9a84c] to-[#f0c040] text-[#0a0900] px-5 py-2.5 rounded-xl font-extrabold flex justify-center items-center gap-2 transition-all shadow-[0_4px_14px_rgba(201,168,76,0.35)] hover:scale-[1.02]">
                     <Plus className="w-4 h-4" /> Add Record
                  </button>
               )}
            </div>
         </div>

         {/* Summary Metric Cards */}
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className={`${C.card} p-5 bg-[#111827] border-[#1f2937] flex flex-col gap-2`}>
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                     <ArrowDownLeft className="w-5 h-5 text-emerald-500" />
                  </div>
                  <span className="text-[13px] font-medium text-[#9ca3af]">Total Received (In)</span>
               </div>
               <p className="text-2xl font-bold text-[#f9fafb] mt-1">৳ {allPaymentsIn.reduce((a: number, p: any) => a + Number(p.amount), 0).toLocaleString()}</p>
               <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[12px] text-emerald-500 font-medium flex items-center gap-1">
                     <ArrowUpRight className="w-3 h-3" /> 12.6%
                  </span>
                  <span className="text-[12px] text-[#4b5563]">vs last 30 days</span>
               </div>
            </div>

            <div className={`${C.card} p-5 bg-[#111827] border-[#1f2937] flex flex-col gap-2`}>
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center">
                     <ArrowUpRight className="w-5 h-5 text-rose-500" />
                  </div>
                  <span className="text-[13px] font-medium text-[#9ca3af]">Total Paid (Out)</span>
               </div>
               <p className="text-2xl font-bold text-[#f9fafb] mt-1">৳ {allPaymentsOut.reduce((a: number, p: any) => a + Number(p.amount), 0).toLocaleString()}</p>
               <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[12px] text-rose-500 font-medium flex items-center gap-1">
                     <ArrowUpRight className="w-3 h-3" /> 8.3%
                  </span>
                  <span className="text-[12px] text-[#4b5563]">vs last 30 days</span>
               </div>
            </div>

            <div className={`${C.card} p-5 bg-[#111827] border-[#1f2937] flex flex-col gap-2`}>
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                     <ArrowRightLeft className="w-5 h-5 text-blue-500" />
                  </div>
                  <span className="text-[13px] font-medium text-[#9ca3af]">Net Cash Flow</span>
               </div>
               <p className="text-2xl font-bold text-[#f9fafb] mt-1">৳ {(allPaymentsIn.reduce((a: number, p: any) => a + Number(p.amount), 0) - allPaymentsOut.reduce((a: number, p: any) => a + Number(p.amount), 0)).toLocaleString()}</p>
               <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[12px] text-emerald-500 font-medium flex items-center gap-1">
                     <ArrowUpRight className="w-3 h-3" /> 14.5%
                  </span>
                  <span className="text-[12px] text-[#4b5563]">vs last 30 days</span>
               </div>
            </div>

            <div className={`${C.card} p-5 bg-[#111827] border-[#1f2937] flex flex-col gap-2`}>
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-violet-500/10 flex items-center justify-center">
                     <Users className="w-5 h-5 text-violet-500" />
                  </div>
                  <span className="text-[13px] font-medium text-[#9ca3af]">Total Records</span>
               </div>
               <p className="text-2xl font-bold text-[#f9fafb] mt-1">{allPaymentsIn.length + allPaymentsOut.length}</p>
               <p className="text-[12px] text-[#9ca3af] mt-1">{allPaymentsIn.length} In &bull; {allPaymentsOut.length} Out</p>
            </div>

            <div className={`${C.card} p-5 bg-[#111827] border-[#1f2937] flex flex-col gap-2`}>
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                     <Wallet className="w-5 h-5 text-amber-500" />
                  </div>
                  <span className="text-[13px] font-medium text-[#9ca3af]">Cash Balance</span>
               </div>
               <p className="text-2xl font-bold text-[#c9a84c] mt-1">৳ {(allPaymentsIn.reduce((a: number, p: any) => a + Number(p.amount), 0) - allPaymentsOut.reduce((a: number, p: any) => a + Number(p.amount), 0) + addMoneyList.reduce((a: number, p: any) => a + Number(p.amount), 0)).toLocaleString()}</p>
               <p className="text-[12px] text-[#9ca3af] mt-1">As of today</p>
            </div>
         </div>

         {/* Add Money Tab Content */}
         {activeTab === 'add_money' ? (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 animate-in slide-in-from-bottom-5 duration-500">
               <div className={`xl:col-span-12 ${C.card} p-6 md:p-10`}>
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 border-b border-[rgba(255,255,255,0.06)] pb-8">
                     <div>
                        <h2 className="text-2xl font-black text-[#e8eaf0] flex items-center gap-3"><ArrowRightLeft className="w-7 h-7 text-[#c9a84c]" /> Add Business Capital / Fund</h2>
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
                           <div><label className={C.label}>Purpose / Title *</label><div className="relative"><Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#c9a84c] opacity-50" /><input required type="text" placeholder="e.g. Funding for Petty Cash" value={addMoneyForm.purpose} onChange={e => setAddMoneyForm({ ...addMoneyForm, purpose: e.target.value })} className={`${C.input} pl-10`} /></div></div>
                           <div className="grid grid-cols-2 gap-4">
                              <div><label className={C.label}>Amount (৳) *</label><div className="relative"><Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#c9a84c]" /><input required type="number" step="0.01" min="0.01" placeholder="0.00" value={addMoneyForm.amount} onChange={e => setAddMoneyForm({ ...addMoneyForm, amount: e.target.value })} className={`${C.input} pl-10 text-lg font-mono text-[#c9a84c]`} /></div></div>
                              <div><label className={C.label}>Date *</label><input required type="date" value={addMoneyForm.date} onChange={e => setAddMoneyForm({ ...addMoneyForm, date: e.target.value })} className={C.input} /></div>
                           </div>
                        </div>
                        <div className="space-y-6"><div><label className={C.label}>Note (Optional)</label><textarea rows={4} placeholder="Description..." value={addMoneyForm.note} onChange={e => setAddMoneyForm({ ...addMoneyForm, note: e.target.value })} className={`${C.input} resize-none`} /></div></div>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                        <div className="bg-[#1a2235]/20 p-6 rounded-2xl border border-[rgba(255,255,255,0.06)] shadow-inner">
                           <h3 className="text-sm font-black text-[#c9a84c] uppercase tracking-widest mb-6 flex items-center gap-2"><ArrowRightLeft className="w-4 h-4" /> Payment Definition</h3>
                           <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {['cash', 'bikash', 'nagad', 'rocket', 'upay', 'bank_transfer', 'bank_to_bank_transfer', 'cheque'].map(m => (
                                 <label key={m} className={`flex items-center justify-center p-3 rounded-xl border text-center cursor-pointer transition-all ${addMoneyForm.payment_method === m ? 'bg-[#c9a84c]/10 border-[#c9a84c] text-[#c9a84c]' : 'bg-[#131929]/50 border-[rgba(255,255,255,0.06)] text-[#8a95a8] hover:bg-[#1a2235]'}`}>
                                    <input type="radio" value={m} checked={addMoneyForm.payment_method === m} onChange={() => setAddMoneyForm({ ...addMoneyForm, payment_method: m as PaymentMethod })} className="hidden" />
                                    <span className="text-[10px] font-black uppercase tracking-tighter">{m.replace(/_/g, ' ')}</span>
                                 </label>
                              ))}
                           </div>
                           {renderAddMoneyMethodForm()}
                        </div>
                        <div className="flex flex-col gap-6">
                           <div className="flex-1 bg-[#1a2235]/20 p-6 rounded-2xl border border-[rgba(255,255,255,0.06)] shadow-inner">
                              <h3 className="text-sm font-black text-[#c9a84c] uppercase tracking-widest mb-4 flex items-center gap-2"><Plus className="w-4 h-4" /> Proof Document / Image</h3>
                              <div className="flex flex-wrap gap-3">
                                 {addMoneyPreviews.map((src, idx) => (
                                    <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-[#c9a84c]/30"><img src={src} className="w-full h-full object-cover" alt="preview" /><button type="button" onClick={() => removeAddMoneyPhoto(idx)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"><X className="w-3 h-3" /></button></div>
                                 ))}
                                 {addMoneyPreviews.length < 5 && (
                                    <label className="w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed border-[#c9a84c]/30 rounded-xl cursor-pointer hover:bg-[#c9a84c]/5 translate-all"><Plus className="w-6 h-6 text-[#c9a84c]" /><input type="file" multiple accept="image/*" className="hidden" onChange={handleAddMoneyPhotoChange} /></label>
                                 )}
                              </div>
                           </div>
                           <div>
                              <label className={C.label}>Authorized By *</label>
                              <select required value={addMoneyForm.authorized_signature} onChange={e => setAddMoneyForm({ ...addMoneyForm, authorized_signature: e.target.value })} className={`${C.input} appearance-none`}>
                                 <option value="" disabled>-- Select Authorizer --</option>
                                 {employees.filter(e => e.is_authorizer).map(emp => <option key={emp.id} value={emp.name}>{emp.name}</option>)}
                              </select>
                           </div>
                        </div>
                     </div>
                     <div className="pt-8 border-t border-[rgba(255,255,255,0.06)] flex justify-end gap-4">
                        <button type="button" onClick={() => setAddMoneyForm({ ...addMoneyForm, purpose: '', amount: '', note: '' })} className="px-8 py-4 font-bold text-[#8a95a8] hover:text-[#e8eaf0] transition-colors uppercase tracking-widest text-xs">Reset Form</button>
                        <button type="submit" disabled={submitting} className="px-10 py-4 bg-gradient-to-br from-[#c9a84c] to-[#f0c040] text-[#0a0900] font-black rounded-2xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3 text-lg uppercase">{submitting ? 'Saving...' : <><ArrowRightLeft className="w-6 h-6" /> Save Transaction</>}</button>
                     </div>
                  </form>
               </div>
               <div className={`xl:col-span-12 mt-4 ${C.card} overflow-hidden bg-[#131929]`}>
                  <div className="p-6 border-b border-[rgba(255,255,255,0.06)] flex justify-between items-center bg-[#1a2235]/30">
                     <h3 className="font-black text-[#e8eaf0] text-lg flex items-center gap-3"><ArrowRightLeft className="w-5 h-5 text-[#c9a84c]" /> Add Money History</h3>
                     <span className="bg-[#c9a84c]/10 text-[#c9a84c] border border-[#c9a84c]/20 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">{addMoneyList.length} Total Records</span>
                  </div>
                  <div className="overflow-x-auto">
                     <table className="w-full text-left">
                        <thead className="bg-[#131929] border-b border-[rgba(201,168,76,0.18)] text-[#8a95a8] text-[10px] font-black uppercase tracking-widest">
                           <tr><th className="px-6 py-4">Memo / Date</th><th className="px-6 py-4">Purpose / Source</th><th className="px-6 py-4">Payment Info</th><th className="px-6 py-4 text-right">Amount (৳)</th><th className="px-6 py-4">Auth Sign</th></tr>
                        </thead>
                        <tbody className="divide-y divide-[rgba(255,255,255,0.06)]">
                           {addMoneyList.map(item => (
                              <tr key={item.id} className="hover:bg-[#1a2235]/40 transition-colors">
                                 <td className="px-6 py-6">
                                    <div className="font-mono text-[11px] font-black text-[#c9a84c] bg-[#c9a84c]/5 border border-[#c9a84c]/20 inline-block px-2.5 py-1 rounded-lg mb-2 shadow-sm uppercase tracking-wider">{item.memo_no}</div>
                                    <div className="text-xs text-[#8a95a8] font-bold flex items-center gap-1.5"><Calendar className="w-3 h-3" /> {new Date(item.date).toLocaleDateString()}</div>
                                 </td>
                                 <td className="px-6 py-6">
                                    <div className="font-extrabold text-[#e8eaf0] text-base">{item.purpose}</div>
                                    {item.note && <div className="text-[10px] text-[#8a95a8] mt-2 italic font-medium max-w-xs">{item.note}</div>}
                                    {item.photo_urls && item.photo_urls.length > 0 && <div className="flex gap-2 mt-3">{item.photo_urls.map((u: string, i: number) => <a key={i} href={u} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-lg overflow-hidden border border-[#c9a84c]/30 block shadow-sm"><img src={u} className="w-full h-full object-cover" alt="Proof" /></a>)}</div>}
                                 </td>
                                 <td className="px-6 py-6">
                                    <span className="text-[10px] px-2.5 py-1 bg-[#c9a84c]/5 text-[#c9a84c] border border-[#c9a84c]/20 rounded-md font-black uppercase tracking-widest inline-block mb-2 shadow-sm">{item.payment_method.replace('_', ' ')}</span>
                                    {item.payment_method_details && item.payment_method_details.internal_account_id && <div className="text-[10px] font-bold text-[#8a95a8] flex flex-col gap-0.5">{internalAccounts.find(a => a.id === item.payment_method_details.internal_account_id)?.provider_name}<span className="font-mono text-[#c9a84c]">{internalAccounts.find(a => a.id === item.payment_method_details.internal_account_id)?.account_number}</span></div>}
                                 </td>
                                 <td className="px-6 py-6 text-right"><span className="font-black text-2xl text-[#c9a84c] font-mono drop-shadow-sm">{Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></td>
                                 <td className="px-6 py-6"><div className="flex items-center gap-2 text-xs font-black text-[#e8eaf0] uppercase tracking-wider"><PenTool className="w-3.5 h-3.5 text-[#c9a84c]" /> {item.authorized_signature}</div></td>
                              </tr>
                           ))}
                           {addMoneyList.length === 0 && <tr><td colSpan={5} className="py-20 text-center text-[#8a95a8] text-sm font-medium italic">No fund records found.</td></tr>}
                        </tbody>
                     </table>
                  </div>
               </div>
            </div>
         ) : (
            <>
               {/* Search + Filter Bar */}
               <div className="flex gap-3 mb-4 flex-wrap items-center mt-2">
                  <div className="flex-1 relative min-w-[220px]">
                     <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4a5568]" />
                     <input type="text" placeholder="Search by ref, customer, invoice, method, or memo..."
                        value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        className="w-full pl-11 pr-4 py-3 bg-[#131929] border border-[rgba(255,255,255,0.07)] rounded-xl text-[#e8eaf0] text-sm outline-none placeholder-[#4a5568] focus:border-[rgba(201,168,76,0.4)] transition-all shadow-sm" />
                  </div>
                  <button className="flex items-center gap-2 px-4 py-3 bg-[#131929] border border-[rgba(255,255,255,0.07)] rounded-xl text-[#8a95a8] text-sm hover:text-[#e8eaf0] transition-all shadow-sm">
                     <Filter className="w-4 h-4" /> Filters
                  </button>
                  <button className="p-3 bg-[#131929] border border-[rgba(255,255,255,0.07)] rounded-xl text-[#8a95a8] hover:text-[#e8eaf0] transition-all shadow-sm">
                     <Receipt className="w-4 h-4" />
                  </button>
               </div>

               {/* Payments Table */}
               <div className={`${C.card} overflow-hidden`}>
                  <div className="overflow-x-auto custom-scrollbar">
                     <table className="w-full text-left min-w-[1100px]">
                        <thead className="bg-[#1a2235] border-b border-[rgba(255,255,255,0.05)]">
                           <tr>
                              <th className="px-5 py-4 text-[10px] font-bold text-[#8a95a8] uppercase tracking-widest">Date / Ref</th>
                              <th className="px-5 py-4 text-[10px] font-bold text-[#8a95a8] uppercase tracking-widest">Partner / Customer</th>
                              <th className="px-5 py-4 text-[10px] font-bold text-[#8a95a8] uppercase tracking-widest">Type</th>
                              <th className="px-5 py-4 text-[10px] font-bold text-[#8a95a8] uppercase tracking-widest">Method</th>
                              <th className="px-5 py-4 text-[10px] font-bold text-[#8a95a8] uppercase tracking-widest">Amount</th>
                              <th className="px-5 py-4 text-[10px] font-bold text-[#8a95a8] uppercase tracking-widest">Linked Invoice</th>
                              <th className="px-5 py-4 text-[10px] font-bold text-[#8a95a8] uppercase tracking-widest">Authorized By</th>
                              <th className="px-5 py-4 text-[10px] font-bold text-[#8a95a8] uppercase tracking-widest">Received By</th>
                              <th className="px-5 py-4 text-[10px] font-bold text-[#8a95a8] uppercase tracking-widest text-right">Actions</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-[rgba(255,255,255,0.03)]">
                           {pagedPayments.map(p => {
                              const isJSON = p.payment_method_details !== null;
                              return (
                                 <tr key={p.id} onClick={() => setViewPayment(p)} className="hover:bg-[#1a2235]/40 transition-colors cursor-pointer group">
                                    <td className="px-5 py-4">
                                       <span className="text-sm font-bold text-[#e8eaf0] block">{new Date(p.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                       <span className="text-[10px] text-[#4a5568] font-mono mt-0.5 block">#{p.id.substring(0, 8).toUpperCase()}</span>
                                    </td>
                                    <td className="px-5 py-4">
                                       <div className="flex items-center gap-2">
                                          <span className="text-sm font-bold text-[#e8eaf0]">{p.contact_details?.name || 'N/A'}</span>
                                          <span className="bg-[#c9a84c]/10 text-[#c9a84c] text-[9px] font-black px-1.5 py-0.5 rounded uppercase border border-[#c9a84c]/20">Business</span>
                                       </div>
                                       <span className="text-[10px] text-[#8a95a8] mt-1 block">{p.contact_details?.phone || p.contact_details?.shop_name || ''}</span>
                                    </td>
                                    <td className="px-5 py-4">
                                       <span className={`text-[12px] px-3 py-1 font-medium rounded-lg w-fit flex justify-center ${p.type === 'in' ? 'bg-[#22c55e]/10 text-[#22c55e]' : 'bg-[#ef4444]/10 text-[#ef4444]'}`}>
                                          {p.type === 'in' ? 'In' : 'Out'}
                                       </span>
                                    </td>
                                    <td className="px-5 py-4">
                                       {renderMethodBadge(p.method)}
                                       {isJSON && p.payment_method_details?.transaction_id && <div className="text-[10px] font-mono mt-1 text-[#4a5568]">TX: {p.payment_method_details.transaction_id}</div>}
                                    </td>
                                    <td className={`px-5 py-4 font-black text-base font-mono ${p.type === 'in' ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                                       <span className="font-sans pr-0.5">৳</span>{Number(p.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                    </td>
                                    <td className="px-5 py-4">
                                       {p.invoice ? (
                                          <>
                                             <span className="text-[11px] font-mono font-bold text-[#c9a84c] block">{typeof p.invoice === 'object' ? p.invoice.id?.substring(0,8).toUpperCase() : String(p.invoice).substring(0,8).toUpperCase()}</span>
                                             <span className="text-[10px] text-[#4a5568] block mt-0.5">Linked</span>
                                          </>
                                       ) : <span className="text-[#4a5568] text-xs">—</span>}
                                    </td>
                                    <td className="px-5 py-4">
                                       <span className="text-xs font-bold text-[#e8eaf0] block">{p.authorized_signature || '—'}</span>
                                       {p.authorized_signature && <span className="text-[10px] text-[#8a95a8]">Accountant</span>}
                                    </td>
                                    <td className="px-5 py-4">
                                       <span className="text-xs font-bold text-[#e8eaf0] block">{p.received_by || '—'}</span>
                                       {p.received_by && <span className="text-[10px] text-[#8a95a8]">Super Admin</span>}
                                    </td>
                                    <td className="px-5 py-4 text-right">
                                       <button className="text-[#4a5568] hover:text-[#e8eaf0] p-2 rounded-lg hover:bg-[#1a2235] transition-colors"><MoreVertical className="w-4 h-4" /></button>
                                    </td>
                                 </tr>
                              );
                           })}
                           {filteredPayments.length === 0 && (
                              <tr><td colSpan={9} className="p-16 text-center text-[#8a95a8]">
                                 <Wallet className="w-12 h-12 mx-auto text-[#4a5568] mb-3 opacity-50" />
                                 <p className="font-black text-base text-[#e8eaf0] uppercase tracking-wide">No Records Found</p>
                                 <p className="text-sm mt-1">Add a new payment to see it listed here.</p>
                              </td></tr>
                           )}
                        </tbody>
                     </table>
                  </div>
                  {/* Pagination */}
                  <div className="px-6 py-4 border-t border-[rgba(255,255,255,0.05)] flex items-center justify-between">
                     <span className="text-xs text-[#8a95a8] font-medium">
                        Showing {filteredPayments.length === 0 ? 0 : (currentPage-1)*pageSize+1} to {Math.min(currentPage*pageSize, filteredPayments.length)} of {filteredPayments.length} records
                     </span>
                     <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentPage(p => Math.max(1,p-1))} disabled={currentPage===1} className="p-2 rounded-lg border border-[rgba(255,255,255,0.08)] text-[#8a95a8] hover:text-[#e8eaf0] disabled:opacity-30 transition-all"><ChevronLeft className="w-4 h-4" /></button>
                        {Array.from({length: Math.min(totalPages, 5)}, (_,i) => {
                           let start = Math.max(1, currentPage - 2);
                           let end = Math.min(totalPages, start + 4);
                           if (end - start < 4) start = Math.max(1, end - 4);
                           return start + i;
                        }).filter(p => p <= totalPages).map(pg => (
                           <button key={pg} onClick={() => setCurrentPage(pg)} className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${pg === currentPage ? 'bg-[#c9a84c] text-[#0a0900]' : 'border border-[rgba(255,255,255,0.08)] text-[#8a95a8] hover:text-[#e8eaf0]'}`}>{pg}</button>
                        ))}
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages,p+1))} disabled={currentPage===totalPages} className="p-2 rounded-lg border border-[rgba(255,255,255,0.08)] text-[#8a95a8] hover:text-[#e8eaf0] disabled:opacity-30 transition-all"><ChevronRight className="w-4 h-4" /></button>
                        <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} className="ml-2 bg-[#131929] border border-[rgba(255,255,255,0.08)] text-[#8a95a8] text-xs rounded-lg px-2 py-1.5 outline-none">
                           {[10,25,50].map(s => <option key={s} value={s}>{s} / page</option>)}
                        </select>
                     </div>
                  </div>
               </div>
            </>
         )}

         {/* --- POPUP PAYMENT BUILDER (MODAL) --- */}
         {showBuilder && activeTab !== 'add_money' && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a0900]/80 backdrop-blur-sm p-4 overflow-y-auto">
               <div className="bg-[#0f1423] border border-[rgba(255,255,255,0.05)] rounded-2xl w-full max-w-[650px] shadow-2xl relative my-auto animate-in zoom-in-95 duration-200">
                  
                  {/* Header */}
                  <div className="flex justify-between items-center p-5 border-b border-[rgba(255,255,255,0.05)] sticky top-0 bg-[#0f1423] z-20 rounded-t-2xl">
                     <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-[#c9a84c]" />
                        Log New Payment ({activeTab === 'in' ? 'Received In' : 'Paid Out'})
                     </h2>
                     <button onClick={() => setShowBuilder(false)} className="text-[#8a95a8] hover:text-white transition-colors p-1"><X className="w-5 h-5" /></button>
                  </div>

                  {/* Form Content */}
                  <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6">
                     
                     {/* Row 1: Memo & Date */}
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                           <label className={C.label}><span className={`${C.labelAccent} bg-[#c9a84c]`}></span> Memo Number (Auto)</label>
                           <input readOnly value={form.details.memo_no} className={`${C.input} text-[#c9a84c] border-[#c9a84c]/30 bg-[#c9a84c]/5 font-mono`} />
                        </div>
                        <div>
                           <label className={C.label}><span className={`${C.labelAccent} bg-[#c9a84c]`}></span> Payment Date</label>
                           <div className="relative">
                              <input required type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className={`${C.input} appearance-none pr-10`} />
                              <Calendar className="w-4 h-4 text-[#8a95a8] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                           </div>
                        </div>
                     </div>

                     {/* Row 2: Customer */}
                     <div>
                        <label className={C.label}><span className={`${C.labelAccent} bg-[#c9a84c]`}></span> Select {activeTab === 'in' ? 'Customer' : 'Supplier'} / Partner</label>
                        <select required value={form.contact_id} onChange={e => setForm({ ...form, contact_id: e.target.value })} className={`${C.input} appearance-none`}>
                           <option value="" disabled>Select a profile...</option>
                           {contacts.map(c => <option key={c.id} value={c.id}>{c.name} {c.phone ? `- ${c.phone}` : ''} {c.shop_name ? `(${c.shop_name})` : ''}</option>)}
                        </select>
                        {form.contact_id && selectedContactDue !== null && (
                           <div className="text-[11px] mt-2 font-medium flex items-center gap-1">
                              <Info className="w-3 h-3 text-[#c9a84c]" /> Current Due: <span className="font-mono text-white">৳ {Math.abs(selectedContactDue).toLocaleString()}</span>
                           </div>
                        )}
                     </div>

                     {/* Row 3: Amount */}
                     <div>
                        <label className={C.label}><span className={`${C.labelAccent} bg-[#c9a84c]`}></span> Total Amount</label>
                        <div className="relative">
                           <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a95a8] font-bold font-sans">৳</span>
                           <input required type="number" min="0.01" step="0.01" placeholder="0.00" value={form.amount} onChange={e => {
                              const val = e.target.value;
                              setForm({ ...form, amount: val });
                           }} className={`${C.input} pl-8 font-mono font-bold text-white`} />
                        </div>
                     </div>

                     {/* Row 4: Methods */}
                     <div>
                        <label className={C.label}><span className={`${C.labelAccent} bg-[#c9a84c]`}></span> Payment Method</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                           {['cash', 'bikash', 'nagad', 'rocket', 'upay', 'bank_transfer', 'bank_to_bank_transfer', 'cheque'].map(m => {
                              const isSelected = form.method === m;
                              const getMethodStyle = (method: string) => {
                                 let textColor = '';
                                 switch(method) {
                                    case 'cash': textColor = 'text-[#22c55e]'; break;
                                    case 'bikash': case 'bkash': textColor = 'text-[#e2136e]'; break;
                                    case 'nagad': textColor = 'text-[#f97316]'; break;
                                    case 'bank_transfer': case 'bank_to_bank_transfer': textColor = 'text-[#3b82f6]'; break;
                                    case 'cheque': textColor = 'text-[#eab308]'; break;
                                    case 'rocket': textColor = 'text-[#a855f7]'; break;
                                    case 'upay': textColor = 'text-[#14b8a6]'; break;
                                    default: textColor = 'text-[#c9a84c]'; break;
                                 }

                                 if(!isSelected) return `border-[rgba(255,255,255,0.05)] bg-[#0f1423] hover:border-[rgba(255,255,255,0.1)] hover:bg-[#131929] transition-all opacity-80 ${textColor}`;
                                 
                                 switch(method) {
                                    case 'cash': return 'border-[#22c55e] text-[#22c55e] bg-[#22c55e]/10';
                                    case 'bikash': case 'bkash': return 'border-[#e2136e] text-[#e2136e] bg-[#e2136e]/10';
                                    case 'nagad': return 'border-[#f97316] text-[#f97316] bg-[#f97316]/10';
                                    case 'bank_transfer': case 'bank_to_bank_transfer': return 'border-[#3b82f6] text-[#3b82f6] bg-[#3b82f6]/10';
                                    case 'cheque': return 'border-[#eab308] text-[#eab308] bg-[#eab308]/10';
                                    case 'rocket': return 'border-[#a855f7] text-[#a855f7] bg-[#a855f7]/10';
                                    case 'upay': return 'border-[#14b8a6] text-[#14b8a6] bg-[#14b8a6]/10';
                                    default: return 'border-[#c9a84c] text-[#c9a84c] bg-[#c9a84c]/10';
                                 }
                              };

                              const getIcon = (method: string) => {
                                 switch(method) {
                                    case 'cash': return <Banknote className="w-4 h-4" />;
                                    case 'bikash': case 'bkash': return <svg viewBox="58 0 62 60" className="w-[18px] h-[18px] fill-current"><path d="M110 30l-26-4 3.5 15.5z"/><path d="M110 30L90 3l-6.5 23.5z"/><path d="M83 26L62 1l27.5 3.5z"/><path d="M75 15l-11.5-11h3z"/><path d="M117 17l-5 13-8-11z"/><path d="M92 42l19-7.5 1-2.5z"/><path d="M76 56l8-29 4 19z"/><path d="M118 17l-2 5.5 7.5-.1z"/></svg>;
                                    case 'nagad': return <svg viewBox="0 0 100 100" className="w-[16px] h-[16px] fill-current"><path d="M50 0C22.4 0 0 22.4 0 50s22.4 50 50 50 50-22.4 50-50S77.6 0 50 0zm0 85C30.7 85 15 69.3 15 50S30.7 15 50 15s35 15.7 35 35-15.7 35-35 35z" opacity={0.3} /><path d="M50 25c-13.8 0-25 11.2-25 25s11.2 25 25 25h3.2v-1.8c-2.4-4.8-2.6-11.4 1.3-16.7 4-5.3 11.3-7.5 17.6-5.4 6 2 10.3 7.8 10.3 14.1 0 12.5-9.6 22.2-22.4 22.2V90c21 0 38.6-17.7 38.6-39.6S80.4 25 50 25z" /></svg>;
                                    case 'bank_transfer': return <Building2 className="w-4 h-4" />;
                                    case 'cheque': return <Wallet className="w-4 h-4" />;
                                    case 'rocket': return <Rocket className="w-4 h-4" />;
                                    case 'upay': return <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4 11c0 2.2-1.8 4-4 4s-4-1.8-4-4V7h2v6c0 1.1.9 2 2 2s2-.9 2-2V7h2v6z"/></svg>;
                                    case 'bank_to_bank_transfer': return <Link className="w-4 h-4" />;
                                    default: return null;
                                 }
                              };

                              let methodText = m === 'bikash' ? 'bKash' : m === 'bank_to_bank_transfer' ? 'Bank-to-Bank' : m.replace(/_/g, ' ');
                              methodText = methodText.charAt(0).toUpperCase() + methodText.slice(1);

                              return (
                                 <label key={m} className={`relative flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${getMethodStyle(m)}`}>
                                    <input type="radio" value={m} checked={isSelected} onChange={() => setForm({ ...form, method: m as PaymentMethod, cash_received: form.amount })} className="hidden" />
                                    {getIcon(m)}
                                    <span className="text-[11px] font-bold">{methodText}</span>
                                    {isSelected && <div className="absolute right-2 w-4 h-4 bg-current rounded-full flex items-center justify-center text-white"><Check className="w-3 h-3 text-[#131929]" /></div>}
                                 </label>
                              );
                           })}
                        </div>
                     </div>

                     {/* Dynamic Details Area */}
                     {renderModalMethodDetails()}

                     {/* Linked Invoice */}
                     <div>
                        <label className={C.label}><span className={`${C.labelAccent} bg-[#c9a84c]`}></span> Linked Invoice (Optional)</label>
                        <div className="relative">
                           <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a95a8]" />
                           <input type="text" placeholder="Enter invoice ID..." value={form.linked_invoice} onChange={e => setForm({...form, linked_invoice: e.target.value})} className={`${C.input} pl-10`} />
                        </div>
                     </div>

                     {/* Signatures */}
                     {/* Signatures & Authorizations */}
                     <div className="pt-4">
                        <h3 className="text-[10px] font-black text-[#8a95a8] uppercase tracking-[2px] mb-3 flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-[#c9a84c]" /> Signatures & Authorizations</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                           {/* Authorized By */}
                           <div className="space-y-1">
                              <label className={C.label}>Authorized By</label>
                              <div className="relative">
                                 <select required value={form.authorized_signature} onChange={e => setForm({ ...form, authorized_signature: e.target.value })} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10">
                                    <option value="" disabled>Select...</option>
                                    {employees.filter(e => e.is_authorizer).map(emp => <option key={emp.id} value={emp.name}>{emp.name}</option>)}
                                 </select>
                                 <div className="flex items-center justify-between p-3 bg-[#0f172a] border border-[rgba(255,255,255,0.05)] rounded-2xl hover:border-[rgba(255,255,255,0.1)] transition-colors">
                                    <div className="flex items-center gap-3">
                                       <div className="w-10 h-10 rounded-full bg-[#1e293b] border border-[rgba(255,255,255,0.1)] overflow-hidden shrink-0">
                                          {form.authorized_signature ? (
                                             <img src={employees.find(e => e.name === form.authorized_signature)?.photo_url || employees.find(e => e.name === form.authorized_signature)?.profile_image_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${form.authorized_signature}`} alt="Avatar" className="w-full h-full object-cover" />
                                          ) : (
                                             <div className="w-full h-full flex items-center justify-center text-[#8a95a8]"><UserCheck className="w-5 h-5" /></div>
                                          )}
                                       </div>
                                       <div>
                                          <div className="font-bold text-white text-[13px]">{form.authorized_signature || 'Select Authorizer'}</div>
                                          <div className="text-[10px] text-[#94a3b8] font-medium">{form.authorized_signature ? (employees.find(e => e.name === form.authorized_signature)?.role || 'Accountant') : 'Required Role'}</div>
                                       </div>
                                    </div>
                                    <ChevronDown className="w-4 h-4 text-[#8a95a8]" />
                                 </div>
                              </div>
                           </div>

                           {/* Received By */}
                           <div className="space-y-1">
                              <label className={C.label}>Received By</label>
                              <input 
                                 type="text" 
                                 placeholder="Enter receiver name..." 
                                 value={form.received_by} 
                                 onChange={e => setForm({ ...form, received_by: e.target.value })} 
                                 className={`${C.input} appearance-none py-3 font-medium`}
                              />
                           </div>
                        </div>
                     </div>

                     {/* Notes */}
                     <div>
                        <label className={C.label}><span className={`${C.labelAccent} bg-[#c9a84c]`}></span> Notes (Optional)</label>
                        <textarea rows={2} placeholder="Add any notes about this payment..." value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className={`${C.input} resize-none`} />
                     </div>

                     {/* Submit Button */}
                     <div className="pt-2 sticky bottom-[-24px] bg-[#0f1423] pb-6 mt-4 z-20">
                        <button type="submit" disabled={submitting} className="w-full bg-[#fcd34d] hover:bg-[#fde68a] text-black font-bold text-sm py-4 rounded-xl transition-all flex justify-center items-center gap-2 shadow-[0_4px_14px_rgba(252,211,77,0.2)]">
                           {submitting ? 'Saving...' : <><Ticket className="w-4 h-4" /> Save Payment to Ledger</>}
                        </button>
                     </div>

                  </form>
               </div>
            </div>
         )}

         {/* View Modal (Receipt Print) */}
         {viewPayment && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
               <div className="bg-white rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] w-full max-w-[800px] overflow-hidden flex flex-col max-h-[95vh] text-[#1a1a1a]">

                  <div className="p-4 bg-[#f8fafc] border-b flex justify-between items-center no-print">
                     <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-[#c9a84c] rounded-lg flex items-center justify-center text-white font-black text-xs shadow-sm">LG</div>
                        <span className="font-black text-xs uppercase tracking-widest text-[#64748b]">Money Receipt Preview</span>
                     </div>
                     <div className="flex items-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); handlePrintReceipt(viewPayment); }} className="flex items-center gap-2 px-4 py-2 bg-[#c9a84c] text-[#0a0900] rounded-lg text-xs font-black hover:opacity-90 transition-all shadow-sm">
                           <Receipt className="w-4 h-4" /> Download / Print
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setViewPayment(null); }} className="p-2 text-[#64748b] hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                           <X className="w-5 h-5" />
                        </button>
                     </div>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', padding: 40, background: 'white', color: 'black' }} id="printable-memo">
                     <div style={{ textAlign: 'center', marginBottom: 40, borderBottom: '3px solid black', paddingBottom: 20 }}>
                        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900, letterSpacing: '4px', textTransform: 'uppercase' }}>MEMORANDUM</h1>
                        <p style={{ margin: '8px 0', fontSize: 14, fontWeight: 700 }}>{viewPayment.type === 'in' ? 'Money Receipt' : 'Payment Voucher'}</p>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 10, fontSize: 12 }}>
                           <span><strong>MEMO NO:</strong> {viewPayment.payment_method_details?.memo_no || 'N/A'}</span>
                           <span><strong>DATE:</strong> {new Date(viewPayment.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                        </div>
                     </div>

                     <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginBottom: 40 }}>
                        <div>
                           <h3 style={{ margin: '0 0 10px', fontSize: 12, textTransform: 'uppercase', color: '#666' }}>{viewPayment.type === 'in' ? 'Received From:' : 'Paid To:'}</h3>
                           <p style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>{viewPayment.contact_details?.name || 'Linked to Invoice'}</p>
                           <p style={{ margin: '4px 0', fontSize: 14 }}>{viewPayment.contact_details?.shop_name || ''}</p>
                           <p style={{ margin: 0, fontSize: 14 }}>{viewPayment.contact_details?.phone || ''}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                           <h3 style={{ margin: '0 0 10px', fontSize: 12, textTransform: 'uppercase', color: '#666' }}>Payment Summary:</h3>
                           <p style={{ margin: 0, fontSize: 16 }}>Status: <strong style={{ color: 'green' }}>SUCCESS</strong></p>
                           <p style={{ margin: '4px 0', fontSize: 14 }}>Method: {viewPayment.method.toUpperCase().replace('_', ' ')}</p>
                           {viewPayment.payment_method_details?.transaction_id && <p style={{ margin: 0, fontSize: 14 }}>TRX ID: {viewPayment.payment_method_details.transaction_id}</p>}
                           {viewPayment.payment_method_details?.cheque_number && <p style={{ margin: 0, fontSize: 14 }}>Cheque: {viewPayment.payment_method_details.cheque_number}</p>}
                        </div>
                     </div>

                     <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 40 }}>
                        <thead>
                           <tr style={{ borderBottom: '2px solid black' }}>
                              <th style={{ padding: '12px 0', textAlign: 'left', fontSize: 12, textTransform: 'uppercase' }}>Description</th>
                              <th style={{ padding: '12px 0', textAlign: 'right', fontSize: 12, textTransform: 'uppercase', width: 140 }}>Amount</th>
                           </tr>
                        </thead>
                        <tbody>
                           <tr style={{ borderBottom: '1px solid #eee' }}>
                              <td style={{ padding: '12px 0', fontSize: 14 }}>
                                 <div style={{ fontWeight: 700 }}>{viewPayment.type === 'in' ? 'Customer Outstanding Payment Collection' : 'Supplier/Processor Disbursement'}</div>
                                 <div style={{ fontSize: 12, color: '#666' }}>Payment via {viewPayment.method.replace('_', ' ')}</div>
                              </td>
                              <td style={{ padding: '12px 0', textAlign: 'right', fontSize: 14, fontWeight: 700 }}>৳{Number(viewPayment.amount).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                           </tr>
                        </tbody>
                     </table>

                     <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 60 }}>
                        <div style={{ width: 300 }}>
                           <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '2px solid black', marginTop: 10, fontWeight: 900, fontSize: 20 }}>
                              <span>Total Paid:</span>
                              <span>৳{Number(viewPayment.amount).toLocaleString(undefined, {minimumFractionDigits:2})}</span>
                           </div>
                           {viewPayment.contact_details && viewPayment.contact_details.total_due !== undefined && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14, fontWeight: 700, color: 'red' }}>
                                 <span>Current Due:</span>
                                 <span>৳{Number(viewPayment.contact_details.total_due).toLocaleString()}</span>
                              </div>
                           )}
                        </div>
                     </div>

                     <div style={{ marginTop: 100, display: 'flex', justifyContent: 'space-between' }}>
                        <div style={{ textAlign: 'center', width: 220 }}>
                           <div style={{ borderTop: '1px solid black', paddingTop: 10, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Customer Signature</div>
                           {viewPayment.received_by && <div style={{ fontSize: 11, marginTop: 4 }}>({viewPayment.received_by})</div>}
                        </div>
                        <div style={{ textAlign: 'center', width: 220 }}>
                           <div style={{ borderTop: '1px solid black', paddingTop: 10, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Authorized Signature</div>
                           {viewPayment.authorized_signature && <div style={{ fontSize: 11, marginTop: 4 }}>({viewPayment.authorized_signature})</div>}
                        </div>
                     </div>

                     <div style={{ marginTop: 40, textAlign: 'center', fontSize: 10, color: '#999', fontStyle: 'italic' }}>
                        This is a computer generated document. No signature is required.
                     </div>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
}