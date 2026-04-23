'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Plus, Trash2, Banknote, ArrowUpRight, ArrowDownLeft, Store, Users, UserCheck, Calendar, CheckCircle2, X, Wallet, Building2, Ticket, Eye, Info, PenTool, ArrowRightLeft, Receipt } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

type PaymentType = 'in' | 'out' | 'add_money'; // in = Received (Customers), out = Paid (Suppliers/Processors), add_money = Business Capital
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

   const generateMemoNo = () => `MEMO-${Math.floor(100000 + Math.random() * 900000)}`;

   const [form, setForm] = useState({
      contact_id: '',
      date: '', // Initialize empty to avoid hydration mismatch
      amount: '',
      method: 'cash' as PaymentMethod,
      details: {
         memo_no: '',
         number: '', // Mobile wallet send/receive number
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
      authorized_signature: '',
      received_by: ''
   });

   const [submitting, setSubmitting] = useState(false);
   const [viewPayment, setViewPayment] = useState<any>(null);
   const [selectedContactDue, setSelectedContactDue] = useState<number | null>(null);
   const [loadingDue, setLoadingDue] = useState(false);

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
      fetchContacts();
      fetchInternalAccounts();
      fetchEmployees();
   }, [activeTab]);

   const fetchInternalAccounts = async () => {
      try {
         const data = await api.getInternalAccounts({ ordering: 'provider_name' });
         setInternalAccounts(Array.isArray(data) ? data : data.results ?? []);
      } catch (err) { console.error('fetchInternalAccounts:', err); }
   };

   const fetchEmployees = async () => {
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
         const data = await api.getPayments({ type: activeTab as 'in' | 'out', ordering: '-created_at' });
         setPayments(Array.isArray(data) ? data : data.results ?? []);
      } catch (err) { console.error('fetchPayments:', err); }
   };

   const fetchAddMoney = async () => {
      try {
         const data = await api.getAddMoney({ ordering: '-created_at' });
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
            const [invsRaw, paysRaw] = await Promise.all([
               api.getInvoices({ contact: form.contact_id }),
               api.getPayments({ contact: form.contact_id })
            ]);
            const invs = Array.isArray(invsRaw) ? invsRaw : invsRaw.results || [];
            const pays = Array.isArray(paysRaw) ? paysRaw : paysRaw.results || [];

            let due = 0;
            if (activeTab === 'in') { // Received (Customer Due)
               const totalSellDue = (invs || []).filter((i: any) => i.type === 'sell').reduce((acc: number, i: any) => acc + Number(i.due_amount || 0), 0);
               const totalReturnDue = (invs || []).filter((i: any) => i.type === 'return').reduce((acc: number, i: any) => acc + Number(i.due_amount || 0), 0);
               const standalonePaysIn = (pays || []).filter((p: any) => p.type === 'in' && !p.invoice).reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0);
               const standalonePaysOut = (pays || []).filter((p: any) => p.type === 'out' && !p.invoice).reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0);
               due = (totalSellDue - totalReturnDue) - (standalonePaysIn - standalonePaysOut);
            } else { // Paid (Supplier Due)
               const totalBuyDue = (invs || []).filter((i: any) => i.type === 'buy').reduce((acc: number, i: any) => acc + Number(i.due_amount || 0), 0);
               const totalReturnDue = (invs || []).filter((i: any) => i.type === 'return' && i.purchase_return).reduce((acc: number, i: any) => acc + Number(i.due_amount || 0), 0);
               const standalonePaysOut = (pays || []).filter((p: any) => p.type === 'out' && !p.invoice).reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0);
               const standalonePaysIn = (pays || []).filter((p: any) => p.type === 'in' && !p.invoice).reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0);
               due = (totalBuyDue - totalReturnDue) - (standalonePaysOut - standalonePaysIn);
            }
            setSelectedContactDue(due);
         } catch (err) {
            console.error('Failed to fetch due', err);
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
         };

         const result = await api.createPayment(paymentPayload);

         // Auto-show receipt
         setViewPayment(result);

         // Cross-reference cheque endorsement
         if (form.method === 'cheque') {
            if (activeTab === 'in') {
               await api.createCheck({
                  type: 'received',
                  check_number: form.details.cheque_number,
                  bank_name: form.details.account_name,
                  amount: Number(form.amount),
                  issue_date: form.date,
                  cash_date: form.details.cheque_date,
                  status: 'pending',
                  partner_id: form.contact_id
               });
            } else if (activeTab === 'out') {
               await api.createCheck({
                  type: 'issued',
                  check_number: form.details.cheque_number,
                  bank_name: form.details.bank_name,
                  amount: Number(form.amount),
                  issue_date: form.date,
                  cash_date: form.details.cheque_date,
                  status: 'pending',
                  partner_id: form.contact_id
               });
            }
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
         authorized_signature: '', received_by: ''
      });
   };

   const handleDelete = async (id: string, _paymentDetails: any) => {
      if (!canDelete) { alert("You don't have permission to delete."); return; }
      if (!window.confirm('Delete this payment? This cannot be undone.')) return;
      try {
         await api.deletePayment(id);
         fetchPayments();
      } catch (err) { console.error('deletePayment:', err); }
   };

   const handlePrintReceipt = (payment: any) => {
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

            <div class="row">
              <span class="label">Received From / Paid To:</span>
              <span class="value">${contactName}</span>
            </div>

            <div class="row">
              <span class="label">Payment Method:</span>
              <span class="value">${payment.method.toUpperCase().replace('_', ' ')}</span>
            </div>

            ${payment.payment_method_details?.transaction_id ? `<div class="row"><span class="label">Trx ID:</span> <span class="value">${payment.payment_method_details.transaction_id}</span></div>` : ''}

            <div class="amount-box">
              TK. ${Number(payment.amount).toLocaleString()} /-
            </div>

            <div class="signature-row">
              <div class="signature">Authorized Signature</div>
              <div class="signature">Receiver's Signature</div>
            </div>

            <p style="margin-top: 40px; text-align: center; font-size: 10px; color: #888;">This is a computer-generated receipt from LedgerGhor.com</p>
          </div>
          <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
      printWindow.document.close();
   };

   const handleAddMoneySubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!addMoneyForm.purpose || !addMoneyForm.amount || !addMoneyForm.authorized_signature) {
         alert('Please fill out all required fields.');
         return;
      }
      setSubmitting(true);
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
         setSubmitting(false);
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

   // Design Constants
   const C = {
      card: "bg-[#131929] rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-[rgba(201,168,76,0.18)]",
      input: "w-full border border-[rgba(201,168,76,0.18)] rounded-xl p-3.5 bg-[#1a2235] text-[#e8eaf0] placeholder-[#4a5568] focus:ring-2 focus:ring-[#c9a84c] outline-none transition-all font-bold",
      label: "block text-[11px] font-black text-[#8a95a8] mb-2 uppercase tracking-widest",
      buttonPrimary: "w-full bg-gradient-to-br from-[#c9a84c] to-[#f0c040] hover:opacity-90 text-[#0a0900] font-extrabold py-4 rounded-xl transition-all shadow-[0_4px_14px_rgba(201,168,76,0.35)] disabled:opacity-60 flex items-center justify-center gap-2 text-lg"
   };

   // Complex Dynamic Form rendering
   const renderMethodForm = () => {
      // --- MOBILE WALLET ---
      if (['bikash', 'nagad', 'rocket', 'upay'].includes(form.method)) {
         return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-5 p-5 bg-[#1a2235]/40 rounded-2xl shadow-inner border border-[rgba(255,255,255,0.06)]">
               <div className="col-span-1 sm:col-span-2">
                  <label className={C.label}>
                     {activeTab === 'in' ? 'Receiving To (Your Account)' : 'Paying From (Your Account)'}
                  </label>
                  <select required value={form.details.internal_account_id} onChange={e => setForm({ ...form, details: { ...form.details, internal_account_id: e.target.value } })} className={`${C.input} appearance-none`}>
                     <option value="" disabled>Select your {form.method} account</option>
                     {internalAccounts.filter(acc => acc.account_type === 'wallet' && acc.provider_name.toLowerCase() === form.method.toLowerCase()).map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.provider_name} - {acc.account_number} {acc.account_name ? `(${acc.account_name})` : ''}</option>
                     ))}
                  </select>
               </div>
               <div>
                  <label className={C.label}>
                     {activeTab === 'in' ? 'Send Number (Customer\'s)' : 'Received Number (Supplier/Processor\'s)'}
                  </label>
                  <input required placeholder="+8801..." type="text" value={form.details.number} onChange={e => setForm({ ...form, details: { ...form.details, number: e.target.value } })} className={C.input} />
               </div>
               <div>
                  <label className={C.label}>Transaction ID</label>
                  <input required placeholder="TRX..." type="text" value={form.details.transaction_id} onChange={e => setForm({ ...form, details: { ...form.details, transaction_id: e.target.value } })} className={`${C.input} font-mono uppercase`} />
               </div>
            </div>
         );
      }

      // --- BANK TO BANK TRANSFER ---
      if (form.method === 'bank_to_bank_transfer') {
         const selectedContact = contacts.find(c => c.id === form.contact_id);
         const contactBanks = selectedContact && Array.isArray(selectedContact.bank_details) ? selectedContact.bank_details : (selectedContact && selectedContact.bank_details && Object.keys(selectedContact.bank_details).length > 0 ? [selectedContact.bank_details] : []);

         return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-5 p-5 bg-[#1a2235]/40 rounded-2xl shadow-inner border border-[rgba(255,255,255,0.06)]">
               <div>
                  <label className={C.label}>Your Bank Account</label>
                  <select required value={form.details.internal_account_id} onChange={e => {
                     setForm({ ...form, details: { ...form.details, internal_account_id: e.target.value } });
                  }} className={`${C.input} appearance-none`}>
                     <option value="" disabled>Select your Bank Account</option>
                     {internalAccounts.filter(acc => acc.account_type === 'bank').map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.provider_name} - {acc.account_number}</option>
                     ))}
                  </select>
               </div>
               <div>
                  <label className={C.label}>
                     {activeTab === 'in' ? 'Customer\'s Bank Account' : 'Supplier/Processor\'s Bank Account'}
                  </label>
                  <select required value={form.details.bank_name ? `${form.details.bank_name}|${form.details.account_number}` : '|'} onChange={e => {
                     const val = e.target.value;
                     const selectedBank = contactBanks.find((b: any) => `${b.bank_name}|${b.account_number}` === val);
                     if (selectedBank) {
                        setForm({ ...form, details: { ...form.details, bank_name: selectedBank.bank_name, account_name: selectedBank.account_name, account_number: selectedBank.account_number, branch: selectedBank.branch } });
                     }
                  }} className={`${C.input} appearance-none`}>
                     <option value="|" disabled>Select Partner Bank Account</option>
                     {contactBanks.map((b: any, idx: number) => {
                        if (!b.bank_name) return null;
                        return <option key={idx} value={`${b.bank_name}|${b.account_number}`}>{b.bank_name} - {b.account_number}</option>
                     })}
                  </select>
                  {contactBanks.length === 0 && form.contact_id && <span className="text-[10px] text-red-400 font-bold mt-1.5 block flex items-center gap-1"><Info className="w-3 h-3" /> No banks added to this contact yet. Please add in Contacts manager.</span>}
               </div>

               <div className="col-span-1 sm:col-span-2">
                  <label className={C.label}>Transfer Date and Time</label>
                  <input required type="datetime-local" value={form.details.datetime} onChange={e => setForm({ ...form, details: { ...form.details, datetime: e.target.value } })} className={C.input} />
               </div>
            </div>
         );
      }

      // --- BANK TRANSFER ---
      if (form.method === 'bank_transfer') {
         const selectedContact = contacts.find(c => c.id === form.contact_id);
         const contactBanks = selectedContact && Array.isArray(selectedContact.bank_details) ? selectedContact.bank_details : (selectedContact && selectedContact.bank_details && Object.keys(selectedContact.bank_details).length > 0 ? [selectedContact.bank_details] : []);

         if (activeTab === 'in') { // Received (From Customer to Us)
            return (
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-5 p-5 bg-[#1a2235]/40 rounded-2xl shadow-inner border border-[rgba(255,255,255,0.06)]">
                  <div className="col-span-1 sm:col-span-2">
                     <label className={C.label}>Receiving Bank Account (Your Account)</label>
                     <select required value={form.details.internal_account_id} onChange={e => {
                        const selected = internalAccounts.find(a => a.id === e.target.value);
                        setForm({ ...form, details: { ...form.details, internal_account_id: e.target.value, bank_name: selected?.provider_name || '', account_number: selected?.account_number || '', account_name: selected?.account_name || '', branch: selected?.branch || '' } });
                     }} className={`${C.input} appearance-none`}>
                        <option value="" disabled>Select your Bank Account</option>
                        {internalAccounts.filter(acc => acc.account_type === 'bank').map(acc => (
                           <option key={acc.id} value={acc.id}>{acc.provider_name} - {acc.account_number}</option>
                        ))}
                     </select>
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                     <label className={C.label}>Receive Date and Time</label>
                     <input required type="datetime-local" value={form.details.datetime} onChange={e => setForm({ ...form, details: { ...form.details, datetime: e.target.value } })} className={C.input} />
                  </div>
               </div>
            );
         } else { // Paid (From Us to Supplier/Processor)
            // UPDATED: Simply ask for the target account and the date
            return (
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-5 p-5 bg-[#1a2235]/40 rounded-2xl shadow-inner border border-[rgba(255,255,255,0.06)]">
                  <div className="col-span-1 sm:col-span-2">
                     <label className={C.label}>Supplier/Processor's Bank Account</label>
                     <select required value={form.details.bank_name ? `${form.details.bank_name}|${form.details.account_number}` : '|'} onChange={e => {
                        const val = e.target.value;
                        const selectedBank = contactBanks.find((b: any) => `${b.bank_name}|${b.account_number}` === val);
                        if (selectedBank) {
                           setForm({ ...form, details: { ...form.details, bank_name: selectedBank.bank_name, account_name: selectedBank.account_name, account_number: selectedBank.account_number, branch: selectedBank.branch } });
                        }
                     }} className={`${C.input} appearance-none`}>
                        <option value="|" disabled>Select Partner Bank Account</option>
                        {contactBanks.map((b: any, idx: number) => {
                           if (!b.bank_name) return null;
                           return <option key={idx} value={`${b.bank_name}|${b.account_number}`}>{b.bank_name} - {b.account_number}</option>
                        })}
                     </select>
                     {contactBanks.length === 0 && form.contact_id && <span className="text-[10px] text-red-400 font-bold mt-1.5 block flex items-center gap-1"><Info className="w-3 h-3" /> No banks added to this contact yet. Please add in Contacts manager.</span>}
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                     <label className={C.label}>Transfer Date and Time</label>
                     <input required type="datetime-local" value={form.details.datetime} onChange={e => setForm({ ...form, details: { ...form.details, datetime: e.target.value } })} className={C.input} />
                  </div>
               </div>
            );
         }
      }

      // --- CHEQUE ---
      if (form.method === 'cheque') {
         if (activeTab === 'in') { // Received Cheque
            return (
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-5 p-5 bg-[#1a2235]/40 rounded-2xl shadow-inner border border-[rgba(255,255,255,0.06)]">
                  <div>
                     <label className={C.label}>Bank Account Name</label>
                     <input required type="text" value={form.details.account_name} onChange={e => setForm({ ...form, details: { ...form.details, account_name: e.target.value } })} className={C.input} placeholder="e.g. City Bank" />
                  </div>
                  <div>
                     <label className={C.label}>Bank Account Number</label>
                     <input required type="text" value={form.details.account_number} onChange={e => setForm({ ...form, details: { ...form.details, account_number: e.target.value } })} className={`${C.input} font-mono`} placeholder="12345678" />
                  </div>
                  <div>
                     <label className={C.label}>Cheque Number</label>
                     <input required type="text" value={form.details.cheque_number} onChange={e => setForm({ ...form, details: { ...form.details, cheque_number: e.target.value } })} className={`${C.input} font-mono`} placeholder="CHK-123" />
                  </div>
                  <div>
                     <label className={C.label}>Cheque Date</label>
                     <input required type="date" value={form.details.cheque_date} onChange={e => setForm({ ...form, details: { ...form.details, cheque_date: e.target.value } })} className={C.input} />
                  </div>
               </div>
            );
         } else { // Paid Cheque (Issued by Us)
            // UPDATED: Simply ask for the target account, Cheque Number and Cheque date
            const selectedContact = contacts.find(c => c.id === form.contact_id);
            const contactBanks = selectedContact && Array.isArray(selectedContact.bank_details) ? selectedContact.bank_details : (selectedContact && selectedContact.bank_details && Object.keys(selectedContact.bank_details).length > 0 ? [selectedContact.bank_details] : []);

            return (
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-5 p-5 bg-[#1a2235]/40 rounded-2xl shadow-inner border border-[rgba(255,255,255,0.06)]">
                  <div className="col-span-1 sm:col-span-2">
                     <label className={C.label}>Supplier/Processor's Bank Account (For Cheque Details)</label>
                     <select required value={form.details.bank_name ? `${form.details.bank_name}|${form.details.account_number}` : '|'} onChange={e => {
                        const val = e.target.value;
                        const selectedBank = contactBanks.find((b: any) => `${b.bank_name}|${b.account_number}` === val);
                        if (selectedBank) {
                           setForm({ ...form, details: { ...form.details, bank_name: selectedBank.bank_name, account_name: selectedBank.account_name, account_number: selectedBank.account_number, branch: selectedBank.branch } });
                        }
                     }} className={`${C.input} appearance-none`}>
                        <option value="|" disabled>Select Partner Bank Account</option>
                        {contactBanks.map((b: any, idx: number) => {
                           if (!b.bank_name) return null;
                           return <option key={idx} value={`${b.bank_name}|${b.account_number}`}>{b.bank_name} - {b.account_number}</option>
                        })}
                     </select>
                     {contactBanks.length === 0 && form.contact_id && <span className="text-[10px] text-red-400 font-bold mt-1.5 block flex items-center gap-1"><Info className="w-3 h-3" /> No banks added to this contact yet. Please add in Contacts manager.</span>}
                  </div>
                  <div>
                     <label className={C.label}>Cheque Number</label>
                     <input required type="text" value={form.details.cheque_number} onChange={e => setForm({ ...form, details: { ...form.details, cheque_number: e.target.value } })} className={`${C.input} font-mono`} placeholder="CHK-123" />
                  </div>
                  <div>
                     <label className={C.label}>Cheque Date</label>
                     <input required type="date" value={form.details.cheque_date} onChange={e => setForm({ ...form, details: { ...form.details, cheque_date: e.target.value } })} className={C.input} />
                  </div>
               </div>
            );
         }
      }

      return null; // Cash needs no extra fields
   };

   const renderAddMoneyMethodForm = () => {
      const m = addMoneyForm.payment_method;
      const details = addMoneyForm.payment_method_details;
      const setDetails = (d: any) => setAddMoneyForm({ ...addMoneyForm, payment_method_details: { ...details, ...d } });

      if (['bikash', 'nagad', 'rocket', 'upay'].includes(m)) {
         return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 p-4 bg-[#1a2235]/40 rounded-xl border border-[rgba(255,255,255,0.06)]">
               <div className="col-span-1 sm:col-span-2">
                  <label className={C.label}>Receiving To (Your Account)</label>
                  <select required value={details.internal_account_id} onChange={e => setDetails({ internal_account_id: e.target.value })} className={`${C.input} appearance-none`}>
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
                  <select required value={details.internal_account_id} onChange={e => setDetails({ internal_account_id: e.target.value })} className={`${C.input} appearance-none`}>
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

   return (
      <div className="pb-12 font-sans animate-in fade-in duration-300">

         {/* Top Header & Tab Controls */}
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
               <h1 className="text-2xl font-black text-[#e8eaf0] tracking-tight">Financial Transactions</h1>
               <p className="text-sm text-[#8a95a8] font-medium mt-1">Manage all incoming and outgoing payments.</p>
            </div>

            {!showBuilder && (
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

                  {canAdd && (
                     <button onClick={() => { resetForm(); setShowBuilder(true); }} className="bg-gradient-to-br from-[#c9a84c] to-[#f0c040] text-[#0a0900] px-5 py-2.5 rounded-xl font-extrabold flex justify-center items-center gap-2 transition-all shadow-[0_4px_14px_rgba(201,168,76,0.35)] hover:scale-[1.02]">
                        <Plus className="w-4 h-4" />
                        Add Record
                     </button>
                  )}
               </div>
            )}
         </div>

         {/* Dynamic Summary Cards Based on Tab */}
         {!showBuilder && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
               <div className="bg-[#131929] border border-[rgba(201,168,76,0.18)] p-5 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
                  <p className="text-[10px] font-black text-[#c9a84c] uppercase tracking-widest mb-2 flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> Total {activeTab === 'in' ? 'Received' : activeTab === 'out' ? 'Paid' : 'Capital Added'}</p>
                  <p className="text-2xl font-black text-[#e8eaf0] font-mono">
                     ৳ {(activeTab === 'add_money' ? addMoneyList : payments).reduce((acc, curr) => acc + Number(curr.amount), 0).toLocaleString()}
                  </p>
               </div>
               <div className="bg-[#131929] border border-[rgba(201,168,76,0.18)] p-5 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
                  <p className="text-[10px] font-black text-[#c9a84c] uppercase tracking-widest mb-2 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Number of Records</p>
                  <p className="text-2xl font-black text-[#e8eaf0] font-mono">
                     {activeTab === 'add_money' ? addMoneyList.length : payments.length} <span className="text-sm font-bold text-[#8a95a8] font-sans">Txns</span>
                  </p>
               </div>
            </div>
         )}

         {!showBuilder ? (
            <>
               {activeTab === 'add_money' ? (
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 animate-in slide-in-from-bottom-5 duration-500">
                     <div className={`xl:col-span-12 ${C.card} p-6 md:p-10`}>
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 border-b border-[rgba(255,255,255,0.06)] pb-8">
                           <div>
                              <h2 className="text-2xl font-black text-[#e8eaf0] flex items-center gap-3">
                                 <ArrowRightLeft className="w-7 h-7 text-[#c9a84c]" /> Add Business Capital / Fund
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
                                       <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#c9a84c] opacity-50" />
                                       <input required type="text" placeholder="e.g. Funding for Petty Cash, Capital Injection" value={addMoneyForm.purpose} onChange={e => setAddMoneyForm({ ...addMoneyForm, purpose: e.target.value })} className={`${C.input} pl-10`} />
                                    </div>
                                 </div>
                                 <div className="grid grid-cols-2 gap-4">
                                    <div>
                                       <label className={C.label}>Amount (৳) *</label>
                                       <div className="relative">
                                          <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#c9a84c]" />
                                          <input required type="number" step="0.01" min="0.01" placeholder="0.00" value={addMoneyForm.amount} onChange={e => setAddMoneyForm({ ...addMoneyForm, amount: e.target.value })} className={`${C.input} pl-10 text-lg font-mono text-[#c9a84c]`} />
                                       </div>
                                    </div>
                                    <div>
                                       <label className={C.label}>Date *</label>
                                       <input required type="date" value={addMoneyForm.date} onChange={e => setAddMoneyForm({ ...addMoneyForm, date: e.target.value })} className={C.input} />
                                    </div>
                                 </div>
                              </div>

                              <div className="space-y-6">
                                 <div>
                                    <label className={C.label}>Note (Optional)</label>
                                    <textarea rows={4} placeholder="Detailed description of where this fund came from..." value={addMoneyForm.note} onChange={e => setAddMoneyForm({ ...addMoneyForm, note: e.target.value })} className={`${C.input} resize-none`} />
                                 </div>
                              </div>
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                              <div className="bg-[#1a2235]/20 p-6 rounded-2xl border border-[rgba(255,255,255,0.06)] shadow-inner">
                                 <h3 className="text-sm font-black text-[#c9a84c] uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <ArrowRightLeft className="w-4 h-4" /> Payment Definition
                                 </h3>
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
                                    <h3 className="text-sm font-black text-[#c9a84c] uppercase tracking-widest mb-4 flex items-center gap-2">
                                       <Plus className="w-4 h-4" /> Proof Document / Image
                                    </h3>
                                    <div className="flex flex-wrap gap-3">
                                       {addMoneyPreviews.map((src, idx) => (
                                          <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-[#c9a84c]/30">
                                             <img src={src} className="w-full h-full object-cover" alt="preview" />
                                             <button type="button" onClick={() => removeAddMoneyPhoto(idx)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"><X className="w-3 h-3" /></button>
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
                                    <select required value={addMoneyForm.authorized_signature} onChange={e => setAddMoneyForm({ ...addMoneyForm, authorized_signature: e.target.value })} className={`${C.input} appearance-none`}>
                                       <option value="" disabled>-- Select Authorizer --</option>
                                       {employees.filter(e => e.is_authorizer).map(emp => (
                                          <option key={emp.id} value={emp.name}>{emp.name}</option>
                                       ))}
                                    </select>
                                 </div>
                              </div>
                           </div>

                           <div className="pt-8 border-t border-[rgba(255,255,255,0.06)] flex justify-end gap-4">
                              <button type="button" onClick={() => setAddMoneyForm({ ...addMoneyForm, purpose: '', amount: '', note: '' })} className="px-8 py-4 font-bold text-[#8a95a8] hover:text-[#e8eaf0] transition-colors uppercase tracking-widest text-xs">Reset Form</button>
                              <button type="submit" disabled={submitting} className="px-10 py-4 bg-gradient-to-br from-[#c9a84c] to-[#f0c040] text-[#0a0900] font-black rounded-2xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3 text-lg uppercase">
                                 {submitting ? 'Saving...' : <><ArrowRightLeft className="w-6 h-6" /> Save Transaction</>}
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
                                          <div className="text-xs text-[#8a95a8] font-bold flex items-center gap-1.5"><Calendar className="w-3 h-3" /> {new Date(item.date).toLocaleDateString()}</div>
                                       </td>
                                       <td className="px-6 py-6">
                                          <div className="font-extrabold text-[#e8eaf0] text-base">{item.purpose}</div>
                                          {item.note && <div className="text-[10px] text-[#8a95a8] mt-2 italic font-medium max-w-xs">{item.note}</div>}
                                          {item.photo_urls && item.photo_urls.length > 0 && (
                                             <div className="flex gap-2 mt-3">
                                                {item.photo_urls.map((u: string, i: number) => (
                                                   <a key={i} href={u} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-lg overflow-hidden border border-[#c9a84c]/30 block shadow-sm"><img src={u} className="w-full h-full object-cover" alt="Proof" /></a>
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
                                          <span className="font-black text-2xl text-[#c9a84c] font-mono drop-shadow-sm">{Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                       </td>
                                       <td className="px-6 py-6">
                                          <div className="flex items-center gap-2 text-xs font-black text-[#e8eaf0] uppercase tracking-wider"><PenTool className="w-3.5 h-3.5 text-[#c9a84c]" /> {item.authorized_signature}</div>
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
               ) : (
                  <>
                     {/* Payments Table */}
                     <div className={`${C.card} overflow-hidden`}>
                        <div className="overflow-x-auto custom-scrollbar">
                           <table className="w-full text-left min-w-[900px]">
                              <thead className="bg-[#1a2235] border-b border-[rgba(201,168,76,0.18)]">
                                 <tr>
                                    <th className="px-6 py-4 text-[11px] font-black text-[#c9a84c] uppercase tracking-widest">Date / Ref</th>
                                    <th className="px-6 py-4 text-[11px] font-black text-[#c9a84c] uppercase tracking-widest">{activeTab === 'in' ? 'Customer Name' : 'Supplier / Processor'}</th>
                                    <th className="px-6 py-4 text-[11px] font-black text-[#c9a84c] uppercase tracking-widest">Method</th>
                                    <th className="px-6 py-4 text-[11px] font-black text-[#c9a84c] uppercase tracking-widest">Amount</th>
                                    <th className="px-6 py-4 text-[11px] font-black text-[#c9a84c] uppercase tracking-widest">Signature / Received</th>
                                    <th className="px-6 py-4 text-[11px] font-black text-[#c9a84c] uppercase tracking-widest text-right">Actions</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-[rgba(255,255,255,0.06)]">
                                 {payments.map(p => {
                                    const isJSON = p.payment_method_details !== null;
                                    const target_id = isJSON ? p.payment_method_details.partner_contact_id : null;

                                    return (
                                       <tr key={p.id} onClick={() => setViewPayment(p)} className="hover:bg-[#1a2235]/60 transition-colors cursor-pointer group">
                                          <td className="px-6 py-4">
                                             <span className="text-sm font-extrabold text-[#e8eaf0] block">{new Date(p.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                             <span className="text-[10px] text-[#8a95a8] font-mono font-bold mt-0.5 block tracking-widest">#{p.id.substring(0, 8).toUpperCase()}</span>
                                          </td>
                                          <td className="px-6 py-4 text-sm font-extrabold text-[#c9a84c]">
                                             {p.contact_details?.name || 'Linked to Invoice'}
                                             {p.contact_details?.shop_name && <span className="block text-[10px] font-bold text-[#8a95a8] mt-0.5 uppercase tracking-wide">{p.contact_details.shop_name}</span>}
                                          </td>
                                          <td className="px-6 py-4">
                                             <span className={`text-[9px] px-2.5 py-1 font-black uppercase tracking-widest rounded border whitespace-nowrap ${activeTab === 'in' ? 'bg-[rgba(52,211,153,0.1)] text-emerald-500 border-[rgba(52,211,153,0.2)]' : 'bg-[rgba(251,146,60,0.1)] text-orange-500 border-[rgba(251,146,60,0.2)]'}`}>
                                                {p.method.replace('_', ' ')}
                                             </span>
                                             {isJSON && p.payment_method_details.internal_account_id && internalAccounts.find(a => a.id === p.payment_method_details.internal_account_id) && (
                                                <div className="text-[10px] font-bold mt-2 text-[#8a95a8] flex flex-col gap-0.5">
                                                   <span>Acc: {internalAccounts.find(a => a.id === p.payment_method_details.internal_account_id)?.provider_name}</span>
                                                   <span className="font-mono text-[#c9a84c]">{internalAccounts.find(a => a.id === p.payment_method_details.internal_account_id)?.account_number}</span>
                                                </div>
                                             )}
                                             {isJSON && p.payment_method_details.transaction_id && <div className="text-[10px] font-mono mt-1.5 text-[#4a5568] uppercase block">TX: <span className="text-[#8a95a8]">{p.payment_method_details.transaction_id}</span></div>}
                                             {isJSON && p.payment_method_details.cheque_number && <div className="text-[10px] font-mono mt-1.5 text-[#4a5568] uppercase block">CHK: <span className="text-[#8a95a8]">{p.payment_method_details.cheque_number}</span></div>}
                                          </td>
                                          <td className={`px-6 py-4 font-black text-lg font-mono ${activeTab === 'in' ? 'text-emerald-400' : 'text-orange-400'}`}>
                                             <span className="font-sans pr-[2px]">৳</span> {Number(p.amount).toLocaleString()}
                                          </td>
                                          <td className="px-6 py-4">
                                             <div className="text-xs font-bold text-[#e8eaf0] block flex items-center gap-1.5"><PenTool className="w-3 h-3 text-[#c9a84c]" /> {p.authorized_signature || '-'}</div>
                                             <div className="text-[10px] font-bold text-[#8a95a8] block mt-1.5 uppercase tracking-wider flex items-center gap-1.5"><UserCheck className="w-3 h-3 text-[#c9a84c]" /> {p.received_by || '-'}</div>
                                          </td>
                                          <td className="px-6 py-4 text-right">
                                             <div className="flex justify-end gap-1.5">
                                                {canDelete && (
                                                   <button 
                                                     onClick={(e) => { e.stopPropagation(); handleDelete(p.id, p); }} 
                                                     className="text-[#8a95a8] hover:text-red-500 p-2 rounded-lg hover:bg-[rgba(244,63,94,0.1)] transition-colors border border-transparent hover:border-[rgba(244,63,94,0.2)]" 
                                                     title="Delete Payment"
                                                   >
                                                      <Trash2 className="w-5 h-5" />
                                                   </button>
                                                )}
                                             </div>
                                          </td>
                                       </tr>
                                    );
                                 })}
                                 {payments.length === 0 && (
                                    <tr>
                                       <td colSpan={6} className="p-20 text-center text-[#8a95a8] border-2 border-dashed border-[rgba(255,255,255,0.06)] bg-[#1a2235]/20">
                                          <Wallet className="w-16 h-16 mx-auto text-[#4a5568] mb-4 opacity-50" />
                                          <p className="font-black text-lg text-[#e8eaf0] uppercase tracking-wider">No Records Found</p>
                                          <p className="text-sm mt-1 font-medium">Add a new payment to see it listed here.</p>
                                       </td>
                                    </tr>
                                 )}
                              </tbody>
                           </table>
                        </div>
                     </div>
                  </>
               )}
            </>
         ) : (

            /* --- PAYMENT BUILDER --- */
            <div className={`${C.card} overflow-hidden animate-in slide-in-from-bottom-8 duration-500 pb-10`}>
               <div className={`p-6 sm:p-8 border-b border-[rgba(201,168,76,0.18)] flex flex-col sm:flex-row justify-between items-start sm:items-center text-white gap-4 relative overflow-hidden bg-[#1a2235]`}>
                  <h2 className="text-2xl sm:text-3xl font-black flex items-center gap-3 relative z-10 text-[#e8eaf0]">
                     <Banknote className={`w-8 h-8 ${activeTab === 'in' ? 'text-emerald-400' : 'text-orange-400'}`} />
                     Log New {activeTab === 'in' ? 'Received Payment' : 'Outgoing Payment'}
                  </h2>
                  <button onClick={() => setShowBuilder(false)} className="bg-[#131929] hover:bg-red-500/20 hover:text-red-400 text-[#8a95a8] px-5 py-2.5 rounded-xl text-sm font-bold transition-all border border-[rgba(255,255,255,0.06)] relative z-10">Cancel Form</button>
               </div>

               <form onSubmit={handleSubmit} className="p-6 sm:p-8 max-w-5xl mx-auto space-y-10 mt-4">

                  {/* 1. Core Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 sm:p-8 bg-[#1a2235]/40 border border-[rgba(255,255,255,0.06)] rounded-3xl shadow-inner relative overflow-hidden">
                     <div className="absolute top-4 right-4 text-[#131929]"><Users className="w-32 h-32 opacity-50" /></div>

                     <div className="col-span-1 md:col-span-2 relative z-10 mb-2 border-b border-[rgba(255,255,255,0.06)] pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <span className="text-[#8a95a8] font-black uppercase tracking-widest text-[11px] flex items-center gap-2">
                           <Ticket className="w-4 h-4 text-[#c9a84c]" /> Memo Number (Auto)
                        </span>
                        <span className="font-mono text-lg font-black text-[#c9a84c] bg-[rgba(201,168,76,0.1)] px-5 py-2 rounded-xl border border-[rgba(201,168,76,0.18)] shadow-sm">
                           {form.details.memo_no}
                        </span>
                     </div>

                     <div className="relative z-10">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-2">
                           <label className="block text-[11px] font-black text-[#e8eaf0] flex items-center gap-2 uppercase tracking-widest">
                              <UserCheck className="w-4 h-4 text-[#c9a84c]" /> Select {activeTab === 'in' ? 'Customer' : 'Supplier / Processor'}
                           </label>
                           {form.contact_id && selectedContactDue !== null && (
                              <span className={`text-[10px] font-black px-3 py-1.5 rounded-lg border uppercase tracking-widest shadow-sm animate-in fade-in zoom-in ${selectedContactDue > 0 ? 'bg-[rgba(244,63,94,0.1)] text-rose-400 border-[rgba(244,63,94,0.2)]' : 'bg-[rgba(52,211,153,0.1)] text-emerald-400 border-[rgba(52,211,153,0.2)]'}`}>
                                 {loadingDue ? 'Calculating...' : `Due: ৳ ${Math.abs(selectedContactDue).toLocaleString()}`}
                              </span>
                           )}
                        </div>
                        <select required value={form.contact_id} onChange={e => setForm({ ...form, contact_id: e.target.value })} className={`${C.input} appearance-none`}>
                           <option value="" disabled>-- Choose Contact Profile --</option>
                           {contacts.map(c => <option key={c.id} value={c.id}>{c.name} {c.shop_name ? `- ${c.shop_name}` : ''}</option>)}
                        </select>
                     </div>
                     <div className="relative z-10">
                        <label className="block text-[11px] font-black text-[#e8eaf0] mb-3 flex items-center gap-2 uppercase tracking-widest">
                           <Calendar className="w-4 h-4 text-[#c9a84c]" /> Payment Date
                        </label>
                        <input required type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className={C.input} />
                     </div>
                  </div>

                  {/* 2. Transaction Module */}
                  <div className={`p-6 sm:p-8 rounded-3xl border shadow-sm bg-[#1a2235]/20 ${activeTab === 'in' ? 'border-[rgba(52,211,153,0.3)]' : 'border-[rgba(251,146,60,0.3)]'}`}>
                     <h3 className={`text-xl font-black mb-8 flex items-center gap-3 ${activeTab === 'in' ? 'text-emerald-400' : 'text-orange-400'}`}>
                        <Wallet className="w-6 h-6" /> Transaction Definition
                     </h3>

                     <div className="space-y-8">
                        <div>
                           <label className={`block text-[11px] font-black mb-3 uppercase tracking-widest ${activeTab === 'in' ? 'text-emerald-500' : 'text-orange-500'}`}>
                              Total Transfer Amount
                           </label>
                           <div className="relative">
                              <span className={`absolute left-5 top-1/2 -translate-y-1/2 font-black text-2xl ${activeTab === 'in' ? 'text-emerald-600' : 'text-orange-600'}`}><span className="font-sans">৳</span></span>
                              <input required type="number" min="0.01" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className={`w-full pl-12 pr-5 py-4 border rounded-2xl text-3xl font-black outline-none focus:ring-2 bg-[#131929] font-mono ${activeTab === 'in' ? 'border-[rgba(52,211,153,0.3)] text-emerald-400 focus:ring-emerald-500/50' : 'border-[rgba(251,146,60,0.3)] text-orange-400 focus:ring-orange-500/50'}`} placeholder="0.00" />
                           </div>
                        </div>

                        <div className="animate-in fade-in slide-in-from-top-2 border-t pt-8 border-[rgba(255,255,255,0.06)]">
                           <label className={`block text-[11px] font-black mb-4 uppercase tracking-widest ${activeTab === 'in' ? 'text-emerald-600' : 'text-orange-600'}`}>Payment Engine Type</label>
                           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-[#131929] p-4 rounded-3xl border border-[rgba(255,255,255,0.06)] shadow-inner">
                              {['cash', 'bikash', 'nagad', 'rocket', 'upay', 'bank_transfer', 'bank_to_bank_transfer', 'cheque'].map(m => (
                                 <label key={m} className={`flex items-center justify-center gap-2 p-3.5 rounded-xl border cursor-pointer transition-all text-center ${form.method === m ? 'border-[#c9a84c] bg-[rgba(201,168,76,0.1)] shadow-[0_0_15px_rgba(201,168,76,0.15)]' : 'border-[rgba(255,255,255,0.06)] hover:bg-[#1a2235] hover:border-[rgba(255,255,255,0.1)]'}`}>
                                    <input type="radio" value={m} checked={form.method === m} onChange={() => setForm({ ...form, method: m as PaymentMethod })} className="hidden" />
                                    <span className={`font-bold text-[10px] sm:text-xs uppercase tracking-widest ${form.method === m ? 'text-[#c9a84c]' : 'text-[#8a95a8]'}`}>{m.replace(/_/g, ' ')}</span>
                                 </label>
                              ))}
                           </div>

                           <div className="mt-4">
                              {renderMethodForm()}
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* 3. Signatures */}
                  <div className="bg-[#1a2235]/40 p-6 sm:p-8 rounded-3xl border border-[rgba(255,255,255,0.06)] shadow-sm flex flex-col justify-between">
                     <h3 className="text-xl font-black text-[#e8eaf0] mb-6 flex items-center gap-3"><CheckCircle2 className="w-6 h-6 text-[#c9a84c]" /> Signatures & Authorizations</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div>
                           <label className={`${C.label} flex items-center gap-2`}><UserCheck className="w-4 h-4 text-[#c9a84c]" /> Authorized Signature</label>
                           <select required value={form.authorized_signature} onChange={e => setForm({ ...form, authorized_signature: e.target.value })} className={`${C.input} appearance-none`}>
                              <option value="" disabled>-- Select Authorizer --</option>
                              {employees.filter(e => e.is_authorizer).map(emp => (
                                 <option key={emp.id} value={emp.name}>{emp.name}</option>
                              ))}
                           </select>
                        </div>
                        <div>
                           <label className={`${C.label} flex items-center gap-2`}><Users className="w-4 h-4 text-[#c9a84c]" /> Received By</label>
                           <input required type="text" placeholder="e.g. Alice Teller" value={form.received_by} onChange={e => setForm({ ...form, received_by: e.target.value })} className={C.input} />
                        </div>
                     </div>

                     <div className="border-t border-[rgba(255,255,255,0.06)] pt-8 mt-2">
                        <button type="submit" disabled={submitting} className={`w-full py-4 sm:py-5 rounded-2xl font-black text-[#0a0900] shadow-[0_4px_24px_rgba(0,0,0,0.6)] transition-all flex items-center justify-center gap-3 text-lg disabled:opacity-60 disabled:scale-100 hover:scale-[1.02]
                        ${activeTab === 'in' ? 'bg-gradient-to-br from-[#c9a84c] to-[#f0c040]' : 'bg-gradient-to-br from-[#c9a84c] to-[#f0c040]'}`}>
                           {submitting ? 'Executing Server Record...' : (
                              <>
                                 <Ticket className="w-6 h-6" />
                                 {activeTab === 'in' ? 'Log Received Payment to Ledger' : 'Process and Log Paid Disbursement'}
                              </>
                           )}
                        </button>
                     </div>
                  </div>

               </form>
            </div>
         )}

         {/* View Modal */}
         {viewPayment && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
               <div className="bg-white rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] w-full max-w-[800px] overflow-hidden flex flex-col max-h-[95vh] text-[#1a1a1a]">

                  {/* Modal Header/Toolbar */}
                  <div className="p-4 bg-[#f8fafc] border-b flex justify-between items-center no-print">
                     <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-[#c9a84c] rounded-lg flex items-center justify-center text-white font-black text-xs shadow-sm">LG</div>
                        <span className="font-black text-xs uppercase tracking-widest text-[#64748b]">Money Receipt Preview</span>
                     </div>
                     <div className="flex items-center gap-2">
                        <button
                           onClick={(e) => { e.stopPropagation(); handlePrintReceipt(viewPayment); }}
                           className="flex items-center gap-2 px-4 py-2 bg-[#c9a84c] text-[#0a0900] rounded-lg text-xs font-black hover:opacity-90 transition-all shadow-sm"
                        >
                           <Receipt className="w-4 h-4" /> Download / Print
                        </button>
                        <button
                           onClick={(e) => { e.stopPropagation(); setViewPayment(null); }}
                           className="p-2 text-[#64748b] hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                           <X className="w-5 h-5" />
                        </button>
                     </div>
                  </div>

                  {/* Paper Content (Invoice Style) */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: 40, background: 'white', color: 'black' }} id="printable-memo">
                     {/* --- MEMO HEADER --- */}
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
                           {viewPayment.payment_method_details?.transaction_id && (
                              <p style={{ margin: 0, fontSize: 14 }}>TRX ID: {viewPayment.payment_method_details.transaction_id}</p>
                           )}
                           {viewPayment.payment_method_details?.cheque_number && (
                              <p style={{ margin: 0, fontSize: 14 }}>Cheque: {viewPayment.payment_method_details.cheque_number}</p>
                           )}
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
                                 <div style={{ fontWeight: 700 }}>
                                    {viewPayment.type === 'in' ? 'Customer Outstanding Payment Collection' : 'Supplier/Processor Disbursement'}
                                 </div>
                                 <div style={{ fontSize: 12, color: '#666' }}>Payment via {viewPayment.method.replace('_', ' ')}</div>
                              </td>
                              <td style={{ padding: '12px 0', textAlign: 'right', fontSize: 14, fontWeight: 700 }}>৳{Number(viewPayment.amount).toLocaleString()}</td>
                           </tr>
                        </tbody>
                     </table>

                     <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 60 }}>
                        <div style={{ width: 300 }}>
                           <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '2px solid black', marginTop: 10, fontWeight: 900, fontSize: 20 }}>
                              <span>Total Paid:</span>
                              <span>৳{Number(viewPayment.amount).toLocaleString()}</span>
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