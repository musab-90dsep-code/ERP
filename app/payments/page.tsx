'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, Banknote, ArrowUpRight, ArrowDownLeft, Store, Users, UserCheck, Calendar, CheckCircle2, X, Wallet, Building2, Ticket, Eye } from 'lucide-react';

type PaymentType = 'in' | 'out'; // in = Received (Customers), out = Paid (Suppliers/Processors)
type PaymentMethod = 'cash' | 'bikash' | 'nagad' | 'rocket' | 'upay' | 'bank_transfer' | 'bank_to_bank_transfer' | 'cheque';

export default function PaymentsPage() {
  return (
    <Suspense fallback={<div className="p-10 font-bold text-center">Loading payments...</div>}>
      <PaymentsContent />
    </Suspense>
  );
}

function PaymentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initTab = (searchParams.get('tab') as PaymentType) || 'in';
  
  const [activeTab, setActiveTab] = useState<PaymentType>(initTab);
  const [showBuilder, setShowBuilder] = useState(false);
  
  const [payments, setPayments] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [internalAccounts, setInternalAccounts] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  
  const generateMemoNo = () => `MEMO-${Math.floor(100000 + Math.random() * 900000)}`;

  const [form, setForm] = useState({
    contact_id: '',
    date: new Date().toISOString().split('T')[0],
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
      setForm(prev => ({ ...prev, details: { ...prev.details, memo_no: generateMemoNo() } }));
    }
    const tab = searchParams.get('tab');
    if (tab === 'in' || tab === 'out') {
      setActiveTab(tab as PaymentType);
      setShowBuilder(false);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchPayments();
    fetchContacts();
    fetchInternalAccounts();
    fetchEmployees();
  }, [activeTab]);

  const fetchInternalAccounts = async () => {
    const { data } = await supabase.from('internal_accounts').select('*').order('provider_name');
    setInternalAccounts(data || []);
  };

  const fetchEmployees = async () => {
    const { data } = await supabase.from('employees').select('id, name, is_authorizer').order('name');
    setEmployees(data || []);
  };

  const handleTabChange = (tab: PaymentType) => {
    setActiveTab(tab);
    router.push(`/payments?tab=${tab}`);
  };

  const fetchContacts = async () => {
    // If Received ('in') => Customers
    // If Paid ('out') => Suppliers or Processors
    const targetTypes = activeTab === 'in' ? ['customer'] : ['supplier', 'processor'];
    const { data } = await supabase.from('contacts').select('*').in('type', targetTypes);
    setContacts(data || []);
  };

  const fetchPayments = async () => {
    const { data } = await supabase
      .from('payments')
      .select('*, contacts(name, shop_name, type)')
      .eq('type', activeTab)
      .order('created_at', { ascending: false });
    setPayments(data || []);
  };

  useEffect(() => {
    if (!form.contact_id || !showBuilder) {
      setSelectedContactDue(null);
      return;
    }
    
    const fetchCalculatedDue = async () => {
      setLoadingDue(true);
      try {
        const invType = activeTab === 'in' ? 'sell' : 'buy';
        
        // Sum all invoice totals for this contact
        const { data: invData, error: invErr } = await supabase
          .from('invoices')
          .select('total')
          .eq('type', invType)
          .eq('contact_id', form.contact_id);
          
        if (invErr) throw invErr;
        
        const totalInvoiced = (invData || []).reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);
        
        // Sum all payments for this contact
        const { data: payData, error: payErr } = await supabase
          .from('payments')
          .select('amount')
          .eq('type', activeTab)
          .eq('contact_id', form.contact_id);
          
        if (payErr) throw payErr;
        
        const totalPaid = (payData || []).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
        
        const calcDue = Math.max(0, totalInvoiced - totalPaid);
        setSelectedContactDue(calcDue);
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
      // 1. Prepare Payment Payload
      const paymentPayload = {
         type: activeTab,
         contact_id: form.contact_id,
         amount: Number(form.amount),
         method: form.method,
         date: form.date,
         payment_method_details: form.details,
         authorized_signature: form.authorized_signature,
         received_by: form.received_by,
      };

      const { data: payData, error: payErr } = await supabase.from('payments').insert([paymentPayload]).select().single();
      if (payErr) {
         // Fallback if there is a schema error
         console.error(payErr);
         throw new Error("Make sure Supabase Schema is up to date");
      }

      // 2. Advanced Action: Cross-reference Check Endorsements
      if (form.method === 'cheque') {
         if (activeTab === 'in') { // Received Cheque
            await supabase.from('checks').insert([{
               type: 'received',
               check_number: form.details.cheque_number,
               bank_name: form.details.account_name, // Map account name/bank 
               amount: Number(form.amount),
               issue_date: form.date,
               cash_date: form.details.cheque_date,
               status: 'pending',
               partner_id: form.contact_id
            }]);
         } else if (activeTab === 'out') { // Paid Cheque
            await supabase.from('checks').insert([{
               type: 'issued',
               check_number: form.details.cheque_number,
               bank_name: form.details.bank_name,
               amount: Number(form.amount),
               issue_date: form.date,
               cash_date: form.details.cheque_date,
               status: 'pending',
               partner_id: form.contact_id
            }]);
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

  const handleDelete = async (id: string, paymentDetails: any) => {
    if(!window.confirm("Delete this payment? This cannot be undone.")) return;
    await supabase.from('payments').delete().eq('id', id);
    fetchPayments();
  };

  // Complex Dynamic Form rendering
  const renderMethodForm = () => {
      // --- MOBILE WALLET ---
      if (['bikash', 'nagad', 'rocket', 'upay'].includes(form.method)) {
         return (
            <div className={`grid grid-cols-2 gap-4 mt-4 p-4 text-sm bg-white rounded-xl shadow-inner border border-gray-100`}>
               <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                     {activeTab === 'in' ? 'Receiving To (Your Account)' : 'Paying From (Your Account)'}
                  </label>
                  <select required value={form.details.internal_account_id} onChange={e => setForm({...form, details: {...form.details, internal_account_id: e.target.value}})} className="w-full border rounded-lg p-2.5 outline-none focus:ring-1 bg-gray-50 text-gray-900 font-bold">
                     <option value="" disabled>Select your {form.method} account</option>
                     {internalAccounts.filter(acc => acc.account_type === 'wallet' && acc.provider_name.toLowerCase() === form.method.toLowerCase()).map(acc => (
                         <option key={acc.id} value={acc.id}>{acc.provider_name} - {acc.account_number} {acc.account_name ? `(${acc.account_name})` : ''}</option>
                     ))}
                  </select>
               </div>
               <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                     {activeTab === 'in' ? 'Send Number (Customer\'s)' : 'Received Number (Supplier/Processor\'s)'}
                  </label>
                  <input required placeholder="+8801..." type="text" value={form.details.number} onChange={e => setForm({...form, details: {...form.details, number: e.target.value}})} className="w-full border rounded-lg p-2.5 outline-none focus:ring-1 bg-gray-50 text-gray-900 font-bold" />
               </div>
               <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Transaction ID</label>
                  <input required placeholder="TRX..." type="text" value={form.details.transaction_id} onChange={e => setForm({...form, details: {...form.details, transaction_id: e.target.value}})} className="w-full border rounded-lg p-2.5 outline-none focus:ring-1 bg-gray-50 text-gray-900 font-mono font-bold uppercase cursor-text select-text" />
               </div>
            </div>
         );
      }
      
      // --- BANK TO BANK TRANSFER ---
      if (form.method === 'bank_to_bank_transfer') {
         const selectedContact = contacts.find(c => c.id === form.contact_id);
         const contactBanks = selectedContact && Array.isArray(selectedContact.bank_details) ? selectedContact.bank_details : (selectedContact && selectedContact.bank_details && Object.keys(selectedContact.bank_details).length > 0 ? [selectedContact.bank_details] : []);

         return (
            <div className="grid grid-cols-2 gap-4 mt-4 p-4 text-sm bg-white rounded-xl shadow-inner border border-gray-100">
               <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Your Bank Account</label>
                  <select required value={form.details.internal_account_id} onChange={e => {
                     setForm({...form, details: {...form.details, internal_account_id: e.target.value}});
                  }} className="w-full border rounded-lg p-2.5 bg-gray-50 font-bold text-gray-900 outline-none">
                     <option value="" disabled>Select your Bank Account</option>
                     {internalAccounts.filter(acc => acc.account_type === 'bank').map(acc => (
                         <option key={acc.id} value={acc.id}>{acc.provider_name} - {acc.account_number}</option>
                     ))}
                  </select>
               </div>
               <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                     {activeTab === 'in' ? 'Customer\'s Bank Account' : 'Supplier/Processor\'s Bank Account'}
                  </label>
                  <select required value={`${form.details.bank_name}|${form.details.account_number}`} onChange={e => {
                     const val = e.target.value;
                     const selectedBank = contactBanks.find((b: any) => `${b.bank_name}|${b.account_number}` === val);
                     if (selectedBank) {
                        setForm({...form, details: {...form.details, bank_name: selectedBank.bank_name, account_name: selectedBank.account_name, account_number: selectedBank.account_number, branch: selectedBank.branch}});
                     }
                  }} className="w-full border rounded-lg p-2.5 bg-gray-50 font-bold text-gray-900 outline-none">
                     <option value="|" disabled>Select Partner Bank Account</option>
                     {contactBanks.map((b: any, idx: number) => {
                         if (!b.bank_name) return null;
                         return <option key={idx} value={`${b.bank_name}|${b.account_number}`}>{b.bank_name} - {b.account_number}</option>
                     })}
                  </select>
                  {contactBanks.length === 0 && <span className="text-[10px] text-red-500 font-bold mt-1 block">No banks added to this contact yet. Please add in Contacts manager.</span>}
               </div>

               <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Transfer Date and Time</label>
                  <input required type="datetime-local" value={form.details.datetime} onChange={e => setForm({...form, details: {...form.details, datetime: e.target.value}})} className="w-full border rounded-lg p-2.5 bg-gray-50 font-bold text-gray-900 outline-none" />
               </div>
            </div>
         );
      }

      // --- BANK TRANSFER ---
      if (form.method === 'bank_transfer') {
         if (activeTab === 'in') { // Received
            return (
               <div className="grid grid-cols-2 gap-4 mt-4 p-4 text-sm bg-white rounded-xl shadow-inner border border-gray-100">
                  <div className="col-span-2">
                     <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Receiving Bank Account (Your Account)</label>
                     <select required value={form.details.internal_account_id} onChange={e => {
                        const selected = internalAccounts.find(a => a.id === e.target.value);
                        setForm({...form, details: {...form.details, internal_account_id: e.target.value, bank_name: selected?.provider_name || '', account_number: selected?.account_number || '', account_name: selected?.account_name || '', branch: selected?.branch || ''}});
                     }} className="w-full border rounded-lg p-2.5 bg-gray-50 font-bold text-gray-900 outline-none">
                        <option value="" disabled>Select your Bank Account</option>
                        {internalAccounts.filter(acc => acc.account_type === 'bank').map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.provider_name} - {acc.account_number}</option>
                        ))}
                     </select>
                  </div>
                  <div className="col-span-2 md:col-span-1">
                     <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Receive Date and Time</label>
                     <input required type="datetime-local" value={form.details.datetime} onChange={e => setForm({...form, details: {...form.details, datetime: e.target.value}})} className="w-full border rounded-lg p-2.5 bg-gray-50 font-bold text-gray-900 outline-none" />
                  </div>
               </div>
            );
         } else { // Paid
            return (
               <div className="grid grid-cols-2 gap-4 mt-4 p-4 text-sm bg-white rounded-xl shadow-inner border border-gray-100">
                  <div className="col-span-2">
                     <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Paying Bank Account (Your Account)</label>
                     <select required value={form.details.internal_account_id} onChange={e => {
                        const selected = internalAccounts.find(a => a.id === e.target.value);
                        setForm({...form, details: {...form.details, internal_account_id: e.target.value, bank_name: selected?.provider_name || '', account_number: selected?.account_number || '', account_name: selected?.account_name || '', branch: selected?.branch || ''}});
                     }} className="w-full border rounded-lg p-2.5 bg-gray-50 font-bold text-gray-900 outline-none">
                        <option value="" disabled>Select your Bank Account</option>
                        {internalAccounts.filter(acc => acc.account_type === 'bank').map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.provider_name} - {acc.account_number}</option>
                        ))}
                     </select>
                  </div>
                  <div className="col-span-2">
                     <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Send Date and Time</label>
                     <input required type="datetime-local" value={form.details.datetime} onChange={e => setForm({...form, details: {...form.details, datetime: e.target.value}})} className="w-full border rounded-lg p-2.5 bg-gray-50 font-bold text-gray-900 outline-none" />
                  </div>
               </div>
            );
         }
      }

      // --- CHEQUE ---
      if (form.method === 'cheque') {
         if (activeTab === 'in') { // Received
            return (
               <div className="grid grid-cols-2 gap-4 mt-4 p-4 text-sm bg-white rounded-xl shadow-inner border border-gray-100">
                  <div className="col-span-2 md:col-span-1">
                     <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Bank Account Name</label>
                     <input required type="text" value={form.details.account_name} onChange={e => setForm({...form, details: {...form.details, account_name: e.target.value}})} className="w-full border rounded-lg p-2.5 bg-gray-50 font-bold text-gray-900 outline-none" />
                  </div>
                  <div className="col-span-2 md:col-span-1">
                     <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Bank Account Number</label>
                     <input required type="text" value={form.details.account_number} onChange={e => setForm({...form, details: {...form.details, account_number: e.target.value}})} className="w-full border rounded-lg p-2.5 bg-gray-50 font-bold text-gray-900 outline-none font-mono" />
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cheque Number</label>
                     <input required type="text" value={form.details.cheque_number} onChange={e => setForm({...form, details: {...form.details, cheque_number: e.target.value}})} className="w-full border rounded-lg p-2.5 bg-gray-50 font-bold text-gray-900 outline-none font-mono" />
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cheque Date</label>
                     <input required type="date" value={form.details.cheque_date} onChange={e => setForm({...form, details: {...form.details, cheque_date: e.target.value}})} className="w-full border rounded-lg p-2.5 bg-gray-50 font-bold text-gray-900 outline-none" />
                  </div>
               </div>
            );
         } else { // Paid
            return (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-4 text-sm bg-white rounded-xl shadow-inner border border-gray-100">
                  <div className="col-span-2">
                     <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Bank Name</label>
                     <input required type="text" value={form.details.bank_name} onChange={e => setForm({...form, details: {...form.details, bank_name: e.target.value}})} className="w-full border rounded-lg p-2.5 bg-gray-50 font-bold text-gray-900 outline-none" />
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cheque Number</label>
                     <input required type="text" value={form.details.cheque_number} onChange={e => setForm({...form, details: {...form.details, cheque_number: e.target.value}})} className="w-full border rounded-lg p-2.5 bg-gray-50 font-bold text-gray-900 outline-none font-mono" />
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cheque Date</label>
                     <input required type="date" value={form.details.cheque_date} onChange={e => setForm({...form, details: {...form.details, cheque_date: e.target.value}})} className="w-full border rounded-lg p-2.5 bg-gray-50 font-bold text-gray-900 outline-none" />
                  </div>
               </div>
            );
         }
      }

      return null; // Cash needs no extra fields
  };

  return (
    <div className="pb-12 font-sans animate-in fade-in duration-300">
      
      {/* Dynamic Header */}
      <div className={`p-8 rounded-3xl text-white shadow-lg relative overflow-hidden mb-8 transition-colors duration-500 
         ${activeTab === 'in' ? 'bg-gradient-to-r from-emerald-800 to-green-900' : 'bg-gradient-to-r from-orange-800 to-rose-900'}`}>
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white opacity-5 blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex justify-between items-end">
           <div>
             <p className="text-white/60 font-bold mb-1 text-sm tracking-widest uppercase flex items-center gap-2">
               <Wallet className="w-4 h-4" /> Comprehensive Transactions
             </p>
             <h1 className="text-4xl font-extrabold tracking-tight mb-2">
                {activeTab === 'in' ? 'Received Payments' : 'Paid Out'}
             </h1>
             <p className="text-white/80 max-w-xl text-sm md:text-base">
                {activeTab === 'in' ? 'Log incoming payments directly from Customers via Cash, Mobile Wallet, Bank, or direct Cheque.' : 
                 'Log outgoing payments directly to Suppliers/Processors using Cash, Wallet, Bank, or issuing Cheques.'}
             </p>
           </div>
           
           {!showBuilder && (
             <button onClick={() => { resetForm(); setShowBuilder(true); }} className="bg-white/20 hover:bg-white text-white hover:text-slate-900 px-6 py-3 rounded-xl font-bold flex items-center gap-2 backdrop-blur-sm transition-all shadow-lg">
                <Plus className="w-5 h-5" /> 
                Add New Record
             </button>
           )}
        </div>
      </div>

      {!showBuilder ? (
         <>
            {/* Invoices Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
               <table className="w-full text-left">
               <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                     <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                     <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{activeTab === 'in' ? 'Customer Name' : 'Supplier / Processor'}</th>
                     <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Method</th>
                     <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                     <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Signature / Received</th>
                     <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                  {payments.map(p => {
                     const isJSON = p.payment_method_details !== null;
                     const target_id = isJSON ? p.payment_method_details.partner_contact_id : null;
                     // We match target_id against contacts in memory (or relying on join if it existed). We will just render json data.
                     
                     return (
                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                           <span className="text-sm font-bold text-slate-800 block">{new Date(p.date).toLocaleDateString()}</span>
                           <span className="text-[10px] text-gray-400 font-mono">#{p.id.substring(0,6)}</span>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-indigo-900 border-l border-gray-100">
                           {contacts.find(c => c.id === target_id)?.name || 'Linked to Invoice'}
                        </td>
                        <td className="px-6 py-4">
                           <span className="text-xs px-2 py-1 bg-slate-100 text-slate-700 font-extrabold uppercase rounded border border-slate-200 whitespace-nowrap">{p.method.replace('_', ' ')}</span>
                           {isJSON && p.payment_method_details.internal_account_id && internalAccounts.find(a => a.id === p.payment_method_details.internal_account_id) && (
                              <div className="text-[10px] font-bold mt-1 text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded border border-indigo-100 inline-block">
                                 {internalAccounts.find(a => a.id === p.payment_method_details.internal_account_id)?.provider_name} - {internalAccounts.find(a => a.id === p.payment_method_details.internal_account_id)?.account_number}
                              </div>
                           )}
                           {isJSON && p.payment_method_details.transaction_id && <div className="text-[10px] font-mono mt-1 text-gray-500 uppercase block">TX: {p.payment_method_details.transaction_id}</div>}
                           {isJSON && p.payment_method_details.cheque_number && <div className="text-[10px] font-mono mt-1 text-gray-500 uppercase block">CHK: {p.payment_method_details.cheque_number}</div>}
                        </td>
                        <td className="px-6 py-4 font-extrabold text-slate-900 text-lg">
                           <span style={{fontFamily: "sans-serif"}} className="font-extrabold pr-[2px]">৳</span> {Number(p.amount).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                           <div className="text-xs font-semibold text-gray-600 block"><span className="text-gray-400">Sig:</span> {p.authorized_signature || '-'}</div>
                           <div className="text-xs font-semibold text-gray-600 block mt-0.5"><span className="text-gray-400">Rcv:</span> {p.received_by || '-'}</div>
                        </td>
                        <td className="px-6 py-4 text-right">
                           <div className="flex justify-end gap-2">
                              <button onClick={() => setViewPayment(p)} className="text-gray-400 hover:text-indigo-600 p-2 rounded-lg hover:bg-indigo-50 transition-colors" title="View Details">
                                 <Eye className="w-5 h-5"/>
                              </button>
                              <button onClick={() => handleDelete(p.id, p)} className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors" title="Delete Payment"><Trash2 className="w-5 h-5"/></button>
                           </div>
                        </td>
                        </tr>
                     );
                  })}
                  {payments.length === 0 && (
                     <tr>
                        <td colSpan={6} className="p-12 text-center text-gray-400">
                           <Wallet className="w-12 h-12 mx-auto text-gray-200 mb-3" />
                           <p className="font-medium">No records found. Note: Standalone tracking only.</p>
                        </td>
                     </tr>
                  )}
               </tbody>
               </table>
            </div>
         </>
      ) : (

         /* --- PAYMENT BUILDER --- */
         <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden animate-in slide-in-from-bottom-8 duration-500 pb-10">
            <div className={`p-6 border-b border-gray-100 flex justify-between items-center text-white
               ${activeTab === 'in' ? 'bg-green-600' : 'bg-orange-600'}`}>
               <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Banknote className="w-6 h-6" /> 
                  Log New {activeTab === 'in' ? 'Received Payment' : 'Outgoing Payment'}
               </h2>
               <button onClick={() => setShowBuilder(false)} className="bg-black/20 hover:bg-black/40 px-4 py-2 rounded-lg text-sm font-bold transition-all">Cancel</button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 max-w-5xl mx-auto space-y-10">
               
               {/* 1. Core Info */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 bg-slate-50 border border-slate-200 rounded-2xl shadow-inner relative">
                  <div className="absolute top-4 right-4 text-slate-200"><Users className="w-16 h-16"/></div>

                  <div className="col-span-1 md:col-span-2 relative z-10 mb-2 border-b border-gray-200 pb-4 flex items-center justify-between">
                     <span className="text-gray-500 font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                        <Ticket className="w-4 h-4" /> Memo Number (Auto-generated)
                     </span>
                     <span className="font-mono text-lg font-extrabold text-indigo-900 bg-indigo-50 px-4 py-1.5 rounded-lg border border-indigo-100 shadow-sm">
                        {form.details.memo_no}
                     </span>
                  </div>

                  <div className="relative z-10">
                     <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-2">
                        <label className="block text-sm font-bold text-gray-700 flex items-center gap-2">
                           <UserCheck className="w-4 h-4 text-indigo-500" /> Select {activeTab === 'in' ? 'Customer' : 'Supplier / Processor'}
                        </label>
                        {form.contact_id && selectedContactDue !== null && (
                           <span className="text-sm font-bold px-4 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-full shadow-sm animate-in fade-in zoom-in">
                              {loadingDue ? 'Calculating due...' : `Total Due: ৳ ${Number(selectedContactDue).toLocaleString()}`}
                           </span>
                        )}
                     </div>
                     <select required value={form.contact_id} onChange={e => setForm({...form, contact_id: e.target.value})} className="w-full border border-gray-200 rounded-xl p-3.5 focus:ring-2 focus:ring-slate-800 outline-none font-bold text-gray-900 bg-white text-lg">
                        <option value="" disabled>-- Choose Contact --</option>
                        {contacts.map(c => <option key={c.id} value={c.id}>{c.name} {c.shop_name ? `- ${c.shop_name}` : ''}</option>)}
                     </select>
                  </div>
                  <div className="relative z-10">
                     <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-indigo-500" /> Payment Date
                     </label>
                     <input required type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full border border-gray-200 rounded-xl p-3.5 focus:ring-2 focus:ring-slate-800 outline-none font-bold text-gray-900 bg-white text-lg" />
                  </div>
               </div>

               {/* 2. Transaction Module */}
               <div className={`p-6 rounded-2xl border shadow-sm ${activeTab === 'in' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-orange-50/50 border-orange-100'}`}>
                  <h3 className={`text-xl font-extrabold mb-6 flex items-center gap-2 ${activeTab === 'in' ? 'text-green-900' : 'text-orange-900'}`}>
                     <Wallet className="w-5 h-5" /> Transaction Definition
                  </h3>
                  
                  <div className="space-y-6">
                     <div>
                        <label className={`block text-sm font-bold mb-1.5 ${activeTab === 'in' ? 'text-green-900' : 'text-orange-900'}`}>
                           Total Amount
                        </label>
                        <div className="relative">
                           <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-bold ${activeTab === 'in' ? 'text-green-600' : 'text-orange-600'}`}><span style={{fontFamily: "sans-serif"}} className="font-extrabold pr-[2px]">৳</span></span>
                           <input required type="number" min="0.01" step="0.01" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className={`w-full pl-8 pr-4 py-3.5 border rounded-xl text-2xl font-extrabold outline-none focus:ring-2 shadow-inner bg-white ${activeTab === 'in' ? 'border-green-200 text-green-900 focus:ring-green-500' : 'border-orange-200 text-orange-900 focus:ring-orange-500'}`} />
                        </div>
                     </div>

                     <div className="animate-in fade-in slide-in-from-top-2 border-t pt-4 border-opacity-50 border-inherit">
                        <label className={`block text-sm font-bold mb-2 ${activeTab === 'in' ? 'text-green-900' : 'text-orange-900'}`}>Payment Engine Type</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white p-3 rounded-2xl border shadow-inner">
                           {['cash', 'bikash', 'nagad', 'rocket', 'upay', 'bank_transfer', 'bank_to_bank_transfer', 'cheque'].map(m => (
                              <label key={m} className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${form.method === m ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-500 shadow-sm' : 'border-gray-100 hover:bg-gray-50'}`}>
                                 <input type="radio" value={m} checked={form.method === m} onChange={() => setForm({...form, method: m as PaymentMethod})} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                                 <span className={`font-bold text-sm uppercase tracking-wide ${form.method === m ? 'text-indigo-900' : 'text-gray-600'}`}>{m.replace('_', ' ')}</span>
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
               <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <h3 className="text-xl font-extrabold text-slate-800 mb-6 flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> Signatures & Authorizations</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
                     <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-1.5"><UserCheck className="w-4 h-4 text-slate-500" /> Authorized Signature</label>
                        <select required value={form.authorized_signature} onChange={e => setForm({...form, authorized_signature: e.target.value})} className="w-full border border-gray-200 rounded-xl p-3.5 font-bold text-gray-900 bg-white outline-none focus:ring-2 focus:ring-slate-800 appearance-none">
                           <option value="" disabled>-- Select Authorizer --</option>
                           {employees.filter(e => e.is_authorizer).map(emp => (
                              <option key={emp.id} value={emp.name}>{emp.name}</option>
                           ))}
                        </select>
                     </div>
                     <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-1.5"><Users className="w-4 h-4 text-slate-500" /> Received By</label>
                        <input required type="text" placeholder="e.g. Alice Teller" value={form.received_by} onChange={e => setForm({...form, received_by: e.target.value})} className="w-full border border-gray-200 rounded-xl p-3.5 font-bold text-gray-900 bg-white outline-none focus:ring-2 focus:ring-slate-800" />
                     </div>
                  </div>

                  <div className="border-t border-slate-200 pt-6">
                     <button type="submit" disabled={submitting} className={`w-full py-4 rounded-xl font-extrabold text-white shadow-xl transition-all flex items-center justify-center gap-3 text-lg disabled:opacity-70 disabled:cursor-not-allowed
                        ${activeTab === 'in' ? 'bg-green-600 hover:bg-green-700 hover:shadow-green-200' : 'bg-orange-600 hover:bg-orange-700 hover:shadow-orange-200'}`}>
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
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden shadow-black/50 flex flex-col max-h-[90vh]">
               <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50">
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                     <Wallet className="w-5 h-5 text-indigo-600" />
                     Payment Details
                  </h2>
                  <button onClick={() => setViewPayment(null)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                     <X className="w-5 h-5" />
                  </button>
               </div>
               
               <div className="p-6 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-6">
                     <div className="col-span-2 md:col-span-1">
                        <p className="text-xs font-bold text-gray-500 uppercase">Payment ID</p>
                        <p className="font-mono text-slate-800 mt-1">{viewPayment.id}</p>
                     </div>
                     <div className="col-span-2 md:col-span-1">
                        <p className="text-xs font-bold text-gray-500 uppercase">Transaction Date</p>
                        <p className="text-slate-800 font-bold mt-1">{new Date(viewPayment.date).toLocaleDateString()}</p>
                     </div>
                     
                     <div className="col-span-2">
                        <p className="text-xs font-bold text-gray-500 uppercase">{activeTab === 'in' ? 'Customer' : 'Supplier / Processor'}</p>
                        <p className="text-lg font-bold text-indigo-900 mt-1">
                           {contacts.find(c => c.id === (viewPayment.payment_method_details?.partner_contact_id || viewPayment.contact_id))?.name || 'Linked to Invoice'}
                        </p>
                     </div>

                     <div className="col-span-2 md:col-span-1">
                        <p className="text-xs font-bold text-gray-500 uppercase">Amount</p>
                        <p className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight">
                           <span className="font-sans">৳</span> {Number(viewPayment.amount).toLocaleString()}
                        </p>
                     </div>
                     
                     <div className="col-span-2 md:col-span-1">
                        <p className="text-xs font-bold text-gray-500 uppercase">Method</p>
                        <p className="inline-block mt-1 px-3 py-1 bg-slate-100 text-slate-800 font-bold text-sm rounded-lg uppercase border border-slate-200">
                           {viewPayment.method.replace('_', ' ')}
                        </p>
                     </div>

                     {viewPayment.payment_method_details && Object.keys(viewPayment.payment_method_details).length > 0 && (
                        <div className="col-span-2 bg-slate-50 rounded-xl p-4 border border-slate-200 mt-2">
                           <p className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                              <Ticket className="w-4 h-4" /> Method Specific Details
                           </p>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {Object.entries(viewPayment.payment_method_details).map(([key, value]) => {
                                 if (!value) return null;
                                 if (key === 'partner_contact_id') return null;
                                 
                                 let displayValue: any = value;
                                 if (key === 'internal_account_id') {
                                    const acc = internalAccounts.find(a => a.id === value);
                                    if (acc) {
                                       displayValue = `${acc.provider_name} - ${acc.account_number}`;
                                    }
                                 }

                                 return (
                                    <div key={key} className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm overflow-hidden">
                                       <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
                                          {key.replace(/_/g, ' ')}
                                       </span>
                                       <span className="text-sm font-semibold text-slate-700 break-all">
                                          {displayValue}
                                       </span>
                                    </div>
                                 );
                              })}
                           </div>
                        </div>
                     )}

                     <div className="col-span-2 grid grid-cols-2 gap-4 border-t border-gray-100 pt-6 mt-2">
                        <div>
                           <p className="text-xs font-bold text-gray-500 uppercase text-center">Authorized By</p>
                           <p className="text-slate-800 font-semibold text-center mt-2 font-mono bg-slate-50 py-2 rounded-lg border border-slate-200">
                              {viewPayment.authorized_signature || 'N/A'}
                           </p>
                        </div>
                        <div>
                           <p className="text-xs font-bold text-gray-500 uppercase text-center">Received By</p>
                           <p className="text-slate-800 font-semibold text-center mt-2 font-mono bg-slate-50 py-2 rounded-lg border border-slate-200">
                              {viewPayment.received_by || 'N/A'}
                           </p>
                        </div>
                     </div>
                  </div>
               </div>
               
               <div className="p-6 border-t border-gray-100 bg-slate-50 flex justify-end">
                  <button onClick={() => setViewPayment(null)} className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-all shadow-sm">
                     Close
                  </button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
