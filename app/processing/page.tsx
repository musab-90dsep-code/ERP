'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Settings, Plus, Send, Download, Truck, Package, Box, Calendar, UserCheck, Ticket, PenTool, X, Trash2, Eye, Wallet, DollarSign, CreditCard, Layers, FileText, CheckCircle, Calculator } from 'lucide-react';

export default function ProcessingPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="w-10 h-10 rounded-full border-4 border-[#131929] border-t-[#c9a84c] animate-spin" />
        <div className="text-[10px] font-black text-[#8a95a8] uppercase tracking-widest">Loading Operations...</div>
      </div>
    }>
      <ProcessingContent />
    </Suspense>
  );
}

interface ProductItem {
  product_id: string;
  quantity: string;
  process_type: string;
  selected_head?: string;
}

type PaymentMethod = 'cash' | 'bikash' | 'nagad' | 'rocket' | 'upay' | 'bank_transfer' | 'bank_to_bank_transfer' | 'cheque';

function ProcessingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initTab = (searchParams.get('tab') as 'issued' | 'received') || 'issued';

  const [activeTab, setActiveTab] = useState<'issued' | 'received'>(initTab);
  const [showBuilder, setShowBuilder] = useState(false);

  const [processors, setProcessors] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [internalAccounts, setInternalAccounts] = useState<any[]>([]);
  const [issuedRecords, setIssuedRecords] = useState<any[]>([]);

  // Processor Balances State
  const [showBalancesModal, setShowBalancesModal] = useState(false);
  const [processorBalances, setProcessorBalances] = useState<any[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(false);

  // Form State
  const generateMemoNo = () => `MEMO-${Math.floor(100000 + Math.random() * 900000)}`;
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [processorId, setProcessorId] = useState('');
  const [memoNo, setMemoNo] = useState('');
  const [note, setNote] = useState('');
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [authorizedSignature, setAuthorizedSignature] = useState('');
  const [receivedBy, setReceivedBy] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [viewingLog, setViewingLog] = useState<any | null>(null);

  // Multiple product items
  const [items, setItems] = useState<ProductItem[]>([
    { product_id: '', quantity: '', process_type: '', selected_head: '' }
  ]);

  // Payment Engine State (For Issued)
  const [hasPayment, setHasPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentDetails, setPaymentDetails] = useState<any>({});

  useEffect(() => {
    fetchData();
    if (!memoNo) setMemoNo(generateMemoNo());
  }, []);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'issued' || tab === 'received') {
      setActiveTab(tab as 'issued' | 'received');
      setShowBuilder(false); // Reset builder on tab change
      resetForm();
    }
  }, [searchParams]);

  useEffect(() => {
    fetchLogs();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      const [procData, prodData, empData, accData] = await Promise.all([
        api.getContacts({ type: 'processor' }),
        api.getProducts({ use_for_processing: true }),
        api.getEmployees({ ordering: 'name' }),
        api.getInternalAccounts({ ordering: 'provider_name' }),
      ]);
      setProcessors(Array.isArray(procData) ? procData : procData.results ?? []);
      setProducts(Array.isArray(prodData) ? prodData : prodData.results ?? []);
      setEmployees(Array.isArray(empData) ? empData : empData.results ?? []);
      setInternalAccounts(Array.isArray(accData) ? accData : accData.results ?? []);

      const issuedData = await api.getProcessingOrders({ type: 'issued' });
      setIssuedRecords(Array.isArray(issuedData) ? issuedData : issuedData.results ?? []);
    } catch (err) { console.error('fetchData:', err); }
  };

  const fetchLogs = async () => {
    try {
      const data = await api.getProcessingOrders({ type: activeTab, ordering: '-created_at' });
      setLogs(Array.isArray(data) ? data : data.results ?? []);
    } catch (err) { console.error('fetchLogs:', err); }
  };

  // Fetch Balances Logic
  const openBalancesModal = async () => {
    setShowBalancesModal(true);
    setBalancesLoading(true);
    try {
      const data = await api.getProcessingBalances();
      setProcessorBalances(Array.isArray(data) ? data : data.results ?? []);
    } catch { setProcessorBalances([]); }
    setBalancesLoading(false);
  };

  const addItem = () => setItems([...items, { product_id: '', quantity: '', process_type: '', selected_head: '' }]);

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof ProductItem, value: string) => {
    const newItems = [...items];
    newItems[index][field] = value;
    if (field === 'product_id') newItems[index].selected_head = '';
    setItems(newItems);
  };

  const getProduct = (id: string) => products.find(p => p.id === id);

  const getUnitCost = (item: ProductItem) => {
    if (activeTab === 'received') return 0;
    const prod = getProduct(item.product_id);
    if (!prod || !item.process_type) return 0;
    return item.process_type === 'auto' ? Number(prod.processing_price_auto || 0) : Number(prod.processing_price_manual || 0);
  };

  const getItemTotal = (item: ProductItem) => Number(item.quantity || 0) * getUnitCost(item);
  const grandTotal = items.reduce((acc, item) => acc + getItemTotal(item), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validItems = items.filter(item => item.product_id && Number(item.quantity) > 0);
    if (validItems.length === 0) {
      alert('Please add at least one valid product with a quantity.');
      return;
    }

    for (const item of validItems) {
      const prod = getProduct(item.product_id);
      const heads = (prod?.product_heads || []).filter((h: string) => h.trim());
      if (heads.length > 0 && !item.selected_head) {
        alert(`Please select a Variant/Head for ${prod.name}`);
        return;
      }
    }

    if (!processorId || !authorizedSignature || !receivedBy) {
      alert('Please fill out all required fields (Processor, Authorized Signature, Received By).');
      return;
    }

    if (activeTab === 'issued' && hasPayment && Number(paymentAmount) > 0) {
      if (['bikash', 'nagad', 'rocket', 'upay', 'bank_to_bank_transfer'].includes(paymentMethod)) {
        if (!paymentDetails.internal_account_id) {
          alert('Please select an internal account for the transaction.');
          return;
        }
      }
      if (['bank_transfer', 'bank_to_bank_transfer'].includes(paymentMethod)) {
        if (!paymentDetails.bank_name || !paymentDetails.account_number) {
          alert("Please select the processor's bank account.");
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const uploadedUrls = photoFiles.length > 0
        ? await Promise.all(photoFiles.map((file) => api.uploadFile(file)))
        : [];

      for (const item of validItems) {
        const numericQuantity = Number(item.quantity);
        const prod = getProduct(item.product_id);
        if (!prod) continue;

        const unitCost = getUnitCost(item);
        const totalCost = getItemTotal(item);

        const payload = {
          type: activeTab,
          memo_no: memoNo,
          processor: processorId,
          product: item.product_id,
          quantity: numericQuantity,
          date: date,
          authorized_signature: authorizedSignature,
          received_by: receivedBy,
          process_type: activeTab === 'issued' ? (item.process_type || null) : null,
          note: note || null,
          unit_cost: unitCost,
          total_cost: totalCost,
          photo_urls: uploadedUrls.length > 0 ? uploadedUrls : undefined
        };

        await api.createProcessingOrder(payload);
      }

      if (activeTab === 'issued' && hasPayment && Number(paymentAmount) > 0) {
        try {
          const finalPaymentDetails = { ...paymentDetails };
          const paymentPayload = {
            contact: processorId,
            type: 'out',
            amount: Number(paymentAmount),
            method: paymentMethod,
            date: date,
            payment_method_details: finalPaymentDetails,
            authorized_signature: authorizedSignature,
            received_by: receivedBy,
            reference: memoNo,
            note: `Advance for Processing Memo: ${memoNo}`
          };
          await api.createPayment(paymentPayload);

          if (paymentMethod === 'cheque') {
            await api.createCheck({ type: 'issued', check_number: finalPaymentDetails.cheque_number || 'UNKNOWN', bank_name: finalPaymentDetails.bank_name || 'UNKNOWN', amount: Number(paymentAmount), issue_date: date, cash_date: finalPaymentDetails.cheque_date || date, status: 'pending', partner_id: processorId });
          }
        } catch (payEx) {
          console.error('Payment Error:', payEx);
        }
      }

      setShowBuilder(false);
      resetForm();
      fetchData();
      fetchLogs();
    } catch (error: any) {
      console.error('Processing Error:', JSON.stringify(error, null, 2));
      alert('Error Details: ' + (error?.message || JSON.stringify(error)));
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setItems([{ product_id: '', quantity: '', process_type: '', selected_head: '' }]);
    setNote('');
    setPhotoFiles([]);
    setPhotoPreviews([]);
    setProcessorId('');
    setAuthorizedSignature('');
    setReceivedBy('');
    setHasPayment(false);
    setPaymentAmount('');
    setPaymentMethod('cash');
    setPaymentDetails({});
    setMemoNo(generateMemoNo());
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      if (photoFiles.length + filesArray.length > 5) {
        alert('You can only upload a maximum of 5 images.');
        return;
      }
      setPhotoFiles(prev => [...prev, ...filesArray]);
      setPhotoPreviews(prev => [...prev, ...filesArray.map(f => URL.createObjectURL(f))]);
    }
  };

  const removeImage = (index: number) => {
    setPhotoFiles(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const inputClass = "w-full bg-[#0b0f1a] border border-[rgba(255,255,255,0.05)] rounded-lg p-2.5 text-sm text-[#e8eaf0] focus:border-[#c9a84c] focus:ring-1 focus:ring-[rgba(201,168,76,0.3)] outline-none transition-colors appearance-none";
  const labelClass = "block text-[10px] uppercase font-bold text-[#8a95a8] tracking-widest mb-1.5 flex items-center gap-2";

  const availableProducts = products.filter(pr => {
    if (activeTab === 'issued') {
      return pr.category === 'raw-materials';
    }
    if (activeTab === 'received') {
      if (processorId) return issuedRecords.some(r => r.product === pr.id && r.processor === processorId);
      return issuedRecords.some(r => r.product === pr.id);
    }
    return true;
  });

  const renderPaymentDetails = () => {
    if (['bikash', 'nagad', 'rocket', 'upay'].includes(paymentMethod)) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 p-4 bg-[#0b0f1a] rounded-xl border border-[rgba(255,255,255,0.05)]">
          <div className="sm:col-span-2">
            <label className={labelClass}>Paying From (Your Account)</label>
            <select required value={paymentDetails.internal_account_id || ''} onChange={e => setPaymentDetails({ ...paymentDetails, internal_account_id: e.target.value })} className={inputClass}>
              <option value="" disabled>Select your {paymentMethod} account</option>
              {internalAccounts.filter(acc => acc.account_type === 'wallet' && acc.provider_name.toLowerCase() === paymentMethod.toLowerCase()).map(acc => (
                <option key={acc.id} value={acc.id}>{acc.provider_name} - {acc.account_number} {acc.account_name ? `(${acc.account_name})` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Processor's Receive Number</label>
            <input required placeholder="+8801..." type="text" value={paymentDetails.number || ''} onChange={e => setPaymentDetails({ ...paymentDetails, number: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Transaction ID</label>
            <input required placeholder="TRX..." type="text" value={paymentDetails.transaction_id || ''} onChange={e => setPaymentDetails({ ...paymentDetails, transaction_id: e.target.value })} className={`${inputClass} font-mono uppercase`} />
          </div>
        </div>
      );
    }

    if (paymentMethod === 'bank_to_bank_transfer') {
      const selectedContact = processors.find(c => c.id === processorId);
      const contactBanks = selectedContact && Array.isArray(selectedContact.bank_details) ? selectedContact.bank_details : (selectedContact && selectedContact.bank_details && Object.keys(selectedContact.bank_details).length > 0 ? [selectedContact.bank_details] : []);

      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 p-4 bg-[#0b0f1a] rounded-xl border border-[rgba(255,255,255,0.05)]">
          <div className="sm:col-span-2 md:col-span-1">
            <label className={labelClass}>Your Bank Account</label>
            <select required value={paymentDetails.internal_account_id || ''} onChange={e => {
              setPaymentDetails({ ...paymentDetails, internal_account_id: e.target.value });
            }} className={inputClass}>
              <option value="" disabled>Select your Bank Account</option>
              {internalAccounts.filter(acc => acc.account_type === 'bank').map(acc => (
                <option key={acc.id} value={acc.id}>{acc.provider_name} - {acc.account_number}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 md:col-span-1">
            <label className={labelClass}>Processor's Bank Account</label>
            <select required value={`${paymentDetails.bank_name || ''}|${paymentDetails.account_number || ''}`} onChange={e => {
              const val = e.target.value;
              const selectedBank = contactBanks.find((b: any) => `${b.bank_name}|${b.account_number}` === val);
              if (selectedBank) {
                setPaymentDetails({ ...paymentDetails, bank_name: selectedBank.bank_name, account_name: selectedBank.account_name, account_number: selectedBank.account_number, branch: selectedBank.branch });
              }
            }} className={inputClass}>
              <option value="|" disabled>Select Partner Bank Account</option>
              {contactBanks.map((b: any, idx: number) => {
                if (!b.bank_name) return null;
                return <option key={idx} value={`${b.bank_name}|${b.account_number}`}>{b.bank_name} - {b.account_number}</option>
              })}
            </select>
            {contactBanks.length === 0 && <span className="text-[10px] text-red-400 font-bold mt-1 block">No banks added to this contact yet.</span>}
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Transfer Date and Time</label>
            <input required type="datetime-local" value={paymentDetails.datetime || ''} onChange={e => setPaymentDetails({ ...paymentDetails, datetime: e.target.value })} className={`${inputClass} [color-scheme:dark]`} />
          </div>
        </div>
      );
    }

    if (paymentMethod === 'bank_transfer') {
      const selectedContact = processors.find(c => c.id === processorId);
      const contactBanks = selectedContact && Array.isArray(selectedContact.bank_details) ? selectedContact.bank_details : (selectedContact && selectedContact.bank_details && Object.keys(selectedContact.bank_details).length > 0 ? [selectedContact.bank_details] : []);

      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 p-4 bg-[#0b0f1a] rounded-xl border border-[rgba(255,255,255,0.05)]">
          <div className="sm:col-span-2 md:col-span-1">
            <label className={labelClass}>Processor's Bank Account</label>
            <select required value={`${paymentDetails.bank_name || ''}|${paymentDetails.account_number || ''}`} onChange={e => {
              const val = e.target.value;
              const selectedBank = contactBanks.find((b: any) => `${b.bank_name}|${b.account_number}` === val);
              if (selectedBank) {
                setPaymentDetails({ ...paymentDetails, bank_name: selectedBank.bank_name, account_name: selectedBank.account_name, account_number: selectedBank.account_number, branch: selectedBank.branch });
              }
            }} className={inputClass}>
              <option value="|" disabled>Select Processor's Bank Account</option>
              {contactBanks.map((b: any, idx: number) => {
                if (!b.bank_name) return null;
                return <option key={idx} value={`${b.bank_name}|${b.account_number}`}>{b.bank_name} - {b.account_number}</option>
              })}
            </select>
            {contactBanks.length === 0 && <span className="text-[10px] text-red-400 font-bold mt-1 block">No banks added to this processor yet.</span>}
          </div>
          <div className="sm:col-span-2 md:col-span-1">
            <label className={labelClass}>Transfer Date and Time</label>
            <input required type="datetime-local" value={paymentDetails.datetime || ''} onChange={e => setPaymentDetails({ ...paymentDetails, datetime: e.target.value })} className={`${inputClass} [color-scheme:dark]`} />
          </div>
        </div>
      );
    }

    if (paymentMethod === 'cheque') {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 p-4 bg-[#0b0f1a] rounded-xl border border-[rgba(255,255,255,0.05)]">
          <div className="sm:col-span-2">
            <label className={labelClass}>Bank Name</label>
            <input required type="text" value={paymentDetails.bank_name || ''} onChange={e => setPaymentDetails({ ...paymentDetails, bank_name: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Cheque Number</label>
            <input required type="text" value={paymentDetails.cheque_number || ''} onChange={e => setPaymentDetails({ ...paymentDetails, cheque_number: e.target.value })} className={`${inputClass} font-mono`} />
          </div>
          <div>
            <label className={labelClass}>Cheque Date</label>
            <input required type="date" value={paymentDetails.cheque_date || ''} onChange={e => setPaymentDetails({ ...paymentDetails, cheque_date: e.target.value })} className={`${inputClass} [color-scheme:dark]`} />
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="pb-10 font-sans animate-in fade-in duration-300 max-w-[1400px] mx-auto px-2 sm:px-0">

      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 bg-[#131929] p-6 rounded-2xl border border-[rgba(255,255,255,0.04)] shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-[#c9a84c]" />
            <span className="text-xs font-bold tracking-[0.2em] text-[#8a95a8] uppercase">Operations Tracking</span>
          </div>
          <h1 className="flex items-center gap-3 text-2xl font-black text-white tracking-tight">
            <Settings className="w-6 h-6 text-[#c9a84c]" /> Processing Sector
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={openBalancesModal} className="flex-1 sm:flex-none items-center justify-center gap-2 px-5 py-2.5 bg-[#1a2235] border border-[rgba(255,255,255,0.05)] rounded-xl text-[#8a95a8] hover:text-white hover:border-[rgba(201,168,76,0.3)] hover:bg-[rgba(201,168,76,0.1)] transition-colors shadow-sm text-sm font-bold flex">
            <Layers className="w-4 h-4 text-[#c9a84c]" /> Balances
          </button>
          {!showBuilder && (
            <button onClick={() => setShowBuilder(true)} className="flex-1 sm:flex-none bg-gradient-to-br from-[#c9a84c] to-[#f0c040] text-[#0a0900] px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 font-extrabold shadow-[0_4px_16px_rgba(201,168,76,0.3)] transition-all text-sm">
              <Plus className="w-4 h-4" /> Create {activeTab === 'issued' ? 'Issue' : 'Receipt'}
            </button>
          )}
        </div>
      </div>

      {/* ── TABS (Visible when builder is closed) ── */}
      {!showBuilder && (
        <div className="flex bg-[#131929] rounded-xl p-1.5 mb-6 border border-[rgba(255,255,255,0.04)] shadow-sm max-w-sm mx-auto sm:mx-0">
          <button onClick={() => { setActiveTab('issued'); router.push('/processing?tab=issued'); }} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'issued' ? 'bg-[#1a2235] text-orange-400 shadow-sm border border-[rgba(251,146,60,0.2)]' : 'text-[#4a5568] hover:text-[#8a95a8]'}`}>
            <Send className="w-4 h-4" /> Issued Logs
          </button>
          <button onClick={() => { setActiveTab('received'); router.push('/processing?tab=received'); }} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'received' ? 'bg-[#1a2235] text-emerald-400 shadow-sm border border-[rgba(52,211,153,0.2)]' : 'text-[#4a5568] hover:text-[#8a95a8]'}`}>
            <Download className="w-4 h-4" /> Received Logs
          </button>
        </div>
      )}

      {/* ── BUILDER FORM ── */}
      {showBuilder ? (
        <div className="bg-[#131929] p-5 sm:p-8 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.5)] border border-[rgba(255,255,255,0.04)] animate-in fade-in slide-in-from-bottom-4">
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-[rgba(255,255,255,0.04)]">
            <h2 className="text-lg font-black text-white flex items-center gap-2 uppercase tracking-widest">
              <Calculator className="w-5 h-5 text-[#c9a84c]" /> New {activeTab === 'issued' ? 'Material Issue' : 'Material Receipt'}
            </h2>
            <button onClick={() => { setShowBuilder(false); resetForm(); }} className="px-4 py-2 rounded-lg border border-[rgba(255,255,255,0.1)] text-[#8a95a8] hover:text-white hover:bg-[rgba(255,255,255,0.05)] font-bold transition-colors text-sm">
              Cancel
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">

            {/* Core Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-[#1a2235] p-5 rounded-xl border border-[rgba(255,255,255,0.04)]">
              <div className="md:col-span-3 lg:col-span-1">
                <label className={labelClass}><FileText className="w-3 h-3 text-[#c9a84c]" /> Memo No</label>
                <input type="text" disabled value={memoNo} className={`${inputClass} !text-[#8a95a8] font-mono cursor-not-allowed`} />
              </div>
              <div className="md:col-span-1 lg:col-span-1">
                <label className={labelClass}><UserCheck className="w-3 h-3 text-[#c9a84c]" /> Processor *</label>
                <select required value={processorId} onChange={e => setProcessorId(e.target.value)} className={inputClass}>
                  <option value="" disabled>-- Select Processor --</option>
                  {processors.map(p => <option key={p.id} value={p.id}>{p.name} {p.shop_name ? `(${p.shop_name})` : ''}</option>)}
                </select>
              </div>
              <div className="md:col-span-1 lg:col-span-1">
                <label className={labelClass}><Calendar className="w-3 h-3 text-[#c9a84c]" /> Date *</label>
                <input required type="date" value={date} onChange={e => setDate(e.target.value)} className={`${inputClass} [color-scheme:dark]`} />
              </div>
            </div>

            {/* Products Table Area */}
            <div className="bg-[#1a2235] border border-[rgba(255,255,255,0.04)] rounded-xl p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <label className="text-[10px] font-black text-[#c9a84c] uppercase tracking-widest flex items-center gap-2">
                  <Box className="w-3.5 h-3.5" /> Line Items
                </label>
              </div>

              {/* PC View Table */}
              <div className="hidden md:block overflow-x-auto rounded-lg border border-[rgba(255,255,255,0.04)] mb-4">
                <table className="w-full text-left bg-[#0b0f1a]">
                  <thead className="bg-[#131929] border-b border-[rgba(255,255,255,0.04)]">
                    <tr>
                      <th className="px-3 py-2.5 text-[10px] font-black text-[#8a95a8] uppercase tracking-widest">Product</th>
                      <th className="px-3 py-2.5 text-[10px] font-black text-[#8a95a8] uppercase tracking-widest w-36">Variant</th>
                      <th className="px-3 py-2.5 text-[10px] font-black text-[#8a95a8] uppercase tracking-widest text-right w-28">Quantity</th>
                      {activeTab === 'issued' && <th className="px-3 py-2.5 text-[10px] font-black text-[#8a95a8] uppercase tracking-widest w-36">Process</th>}
                      {activeTab === 'issued' && <th className="px-3 py-2.5 text-[10px] font-black text-[#8a95a8] uppercase tracking-widest text-right">Subtotal</th>}
                      <th className="px-3 py-2.5 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(255,255,255,0.02)]">
                    {items.map((item, idx) => {
                      const prod = getProduct(item.product_id);
                      const heads = (prod?.product_heads || []).filter((h: string) => h.trim());
                      return (
                        <tr key={idx}>
                          <td className="px-3 py-2">
                            <select required value={item.product_id} onChange={e => updateItem(idx, 'product_id', e.target.value)} className={`${inputClass} !py-1.5 !px-2 text-xs`}>
                              <option value="" disabled>Select Product</option>
                              {availableProducts.map(pr => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            {heads.length > 0 ? (
                              <select required value={item.selected_head || ''} onChange={e => updateItem(idx, 'selected_head', e.target.value)} className={`${inputClass} !py-1.5 !px-2 text-xs !bg-[rgba(201,168,76,0.1)] !text-[#c9a84c]`}>
                                <option value="" disabled>Select...</option>
                                {heads.map((h: string, hi: number) => <option key={hi} value={h}>{h}</option>)}
                              </select>
                            ) : <span className="text-[#4a5568] text-xs font-bold pl-2">—</span>}
                          </td>
                          <td className="px-3 py-2 relative">
                            <input required type="number" min="1" step="1" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} placeholder="0" className={`${inputClass} !py-1.5 !px-2 text-xs text-right pr-8 font-bold ${activeTab === 'received' ? '!border-emerald-500/50 !text-emerald-400' : ''}`} />
                            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[9px] text-[#8a95a8] uppercase">{prod?.unit || 'U'}</span>
                          </td>
                          {activeTab === 'issued' && (
                            <td className="px-3 py-2">
                              <select required value={item.process_type} onChange={e => updateItem(idx, 'process_type', e.target.value)} className={`${inputClass} !py-1.5 !px-2 text-xs`}>
                                <option value="" disabled>Select...</option>
                                <option value="auto">Auto</option>
                                <option value="manual">Manual</option>
                              </select>
                            </td>
                          )}
                          {activeTab === 'issued' && (
                            <td className="px-3 py-2 text-right font-black text-[#e8eaf0] text-sm">
                              ৳{getItemTotal(item).toFixed(2)}
                            </td>
                          )}
                          <td className="px-3 py-2 text-center">
                            <button type="button" onClick={() => removeItem(idx)} disabled={items.length === 1} className="p-1.5 text-[#4a5568] hover:text-red-400 hover:bg-[#1a2235] rounded disabled:opacity-30 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile View Cards */}
              <div className="md:hidden flex flex-col gap-3 mb-4">
                {items.map((item, idx) => {
                  const prod = getProduct(item.product_id);
                  const heads = (prod?.product_heads || []).filter((h: string) => h.trim());
                  return (
                    <div key={idx} className="bg-[#0b0f1a] border border-[rgba(255,255,255,0.05)] rounded-xl p-4 relative">
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItem(idx)} className="absolute top-2 right-2 text-[#4a5568] hover:text-red-400 p-1.5 bg-[#1a2235] rounded-md transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <div className="space-y-4">
                        <div className={items.length > 1 ? "pr-8" : ""}>
                          <label className="block text-[9px] font-bold text-[#8a95a8] uppercase tracking-widest mb-1.5">Select Product</label>
                          <select required value={item.product_id} onChange={e => updateItem(idx, 'product_id', e.target.value)} className={inputClass}>
                            <option value="" disabled>-- Choose product --</option>
                            {availableProducts.map(pr => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
                          </select>
                        </div>
                        {heads.length > 0 && (
                          <div>
                            <label className="block text-[9px] font-bold text-[#c9a84c] uppercase tracking-widest mb-1.5">Variant / Head</label>
                            <select required value={item.selected_head || ''} onChange={e => updateItem(idx, 'selected_head', e.target.value)} className={`${inputClass} !bg-[rgba(201,168,76,0.1)] !text-[#c9a84c] font-bold`}>
                              <option value="" disabled>-- Select Variant --</option>
                              {heads.map((h: string, hi: number) => <option key={hi} value={h}>{h}</option>)}
                            </select>
                          </div>
                        )}
                        <div className={`grid ${activeTab === 'issued' ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
                          <div>
                            <label className={`block text-[9px] font-black uppercase tracking-widest mb-1.5 ${activeTab === 'received' ? 'text-emerald-400' : 'text-[#8a95a8]'}`}>
                              {activeTab === 'received' ? 'Received Qty' : 'Issued Qty'} ({prod?.unit || 'U'})
                            </label>
                            <input required type="number" min="1" step="1" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} placeholder="0" className={`${inputClass} font-bold ${activeTab === 'received' ? 'border-emerald-500/50 text-white' : ''}`} />
                          </div>
                          {activeTab === 'issued' && (
                            <div>
                              <label className="block text-[9px] font-bold text-[#8a95a8] uppercase tracking-widest mb-1.5">Process Type</label>
                              <select required value={item.process_type} onChange={e => updateItem(idx, 'process_type', e.target.value)} className={inputClass}>
                                <option value="" disabled>-- Select --</option>
                                <option value="auto">Auto</option>
                                <option value="manual">Manual</option>
                              </select>
                            </div>
                          )}
                        </div>
                        {activeTab === 'issued' && prod && item.process_type && Number(item.quantity) > 0 && (
                          <div className="bg-[rgba(96,165,250,0.1)] border border-[rgba(96,165,250,0.2)] rounded-lg p-3 flex justify-between items-center">
                            <div>
                              <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Unit Cost</p>
                              <p className="font-black text-[#e8eaf0] text-sm">৳ {getUnitCost(item).toFixed(2)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Est. Subtotal</p>
                              <p className="font-black text-white text-base">৳ {getItemTotal(item).toFixed(2)}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <button type="button" onClick={addItem} className="text-[11px] font-bold text-[#c9a84c] bg-[rgba(201,168,76,0.1)] hover:bg-[rgba(201,168,76,0.15)] border border-[rgba(201,168,76,0.2)] px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Add Another Row
              </button>

              {/* Grand Total for Issued */}
              {activeTab === 'issued' && items.length > 0 && grandTotal > 0 && (
                <div className="mt-5 border-t border-[rgba(255,255,255,0.04)] pt-5 flex flex-col items-end">
                  <div className="w-full md:w-72 bg-[#0b0f1a] border border-[rgba(255,255,255,0.05)] rounded-xl p-4 flex justify-between items-center shadow-inner">
                    <span className="text-xs font-black text-[#8a95a8] uppercase tracking-widest">Est. Grand Total</span>
                    <span className="font-black text-xl text-[#c9a84c]">৳ {grandTotal.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Section Grid: Payments & Signatures */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* ── TRANSACTION / PAYMENT (ONLY FOR ISSUED) ── */}
              {activeTab === 'issued' ? (
                <div className="bg-[#1a2235] border border-[rgba(255,255,255,0.04)] rounded-xl p-5 flex flex-col">
                  <div className="flex items-center gap-3 mb-5">
                    <input type="checkbox" checked={hasPayment} onChange={e => { setHasPayment(e.target.checked); if (!e.target.checked) setPaymentAmount(''); }} className="w-5 h-5 accent-[#c9a84c] rounded bg-[#131929]" id="add-adv-payment" />
                    <label htmlFor="add-adv-payment" className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2 cursor-pointer">
                      <Wallet className="w-4 h-4 text-[#c9a84c]" /> Register Payment
                    </label>
                  </div>

                  {hasPayment && (
                    <div className="space-y-5 animate-fade-in flex-1">
                      <div className="bg-[#0b0f1a] rounded-xl p-4 border border-[rgba(255,255,255,0.05)]">
                        <label className={labelClass}>Advance Amount (৳)</label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a95a8]" />
                          <input type="number" min="0" step="0.01" placeholder="0.00" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value ? Number(e.target.value) : '')} className={`${inputClass} pl-10 font-black text-white text-lg focus:border-[#c9a84c] focus:ring-[#c9a84c]/20`} />
                        </div>
                      </div>

                      <div className="border-t border-[rgba(255,255,255,0.05)] pt-5">
                        <label className={labelClass}>Payment Method</label>
                        <div className="grid grid-cols-3 lg:grid-cols-4 gap-2">
                          {['cash', 'bikash', 'nagad', 'rocket', 'bank_transfer', 'cheque'].map(m => (
                            <label key={m} className={`flex items-center gap-1.5 p-2 rounded-lg border cursor-pointer transition-all justify-center ${paymentMethod === m ? 'border-[#c9a84c] bg-[rgba(201,168,76,0.1)] shadow-sm' : 'border-[rgba(255,255,255,0.05)] bg-[#0b0f1a] hover:bg-[rgba(255,255,255,0.02)]'}`}>
                              <input type="radio" value={m} checked={paymentMethod === m} onChange={() => setPaymentMethod(m as PaymentMethod)} className="hidden" />
                              <span className={`font-bold text-[9px] uppercase tracking-wider text-center ${paymentMethod === m ? 'text-[#c9a84c]' : 'text-[#8a95a8]'}`}>{m.replace(/_/g, ' ')}</span>
                            </label>
                          ))}
                        </div>
                        {renderPaymentDetails()}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // Empty div to keep grid layout balanced when receiving
                <div className="hidden md:block"></div>
              )}

              {/* Signatures & Submit */}
              <div className="bg-[#1a2235] border border-[rgba(255,255,255,0.04)] rounded-xl p-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <h3 className="text-sm font-black text-white flex items-center gap-2 mb-4 uppercase tracking-widest"><PenTool className="w-4 h-4 text-[#c9a84c]" /> Authorization</h3>
                  <div>
                    <label className={labelClass}>Authorized By *</label>
                    <select required value={authorizedSignature} onChange={e => setAuthorizedSignature(e.target.value)} className={inputClass}>
                      <option value="" disabled>-- Select Employee --</option>
                      {employees.filter(emp => emp.is_authorizer).map(emp => (
                        <option key={`auth-${emp.id}`} value={emp.name}>{emp.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Received / Handled By *</label>
                    <input required type="text" value={receivedBy} onChange={e => setReceivedBy(e.target.value)} placeholder="e.g. Driver / Employee Name" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Note / Remarks</label>
                    <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Optional note..." className={`${inputClass} resize-none min-h-[60px]`} />
                  </div>
                </div>

                <div className="mt-8 pt-5 border-t border-[rgba(255,255,255,0.04)]">
                  <button type="submit" disabled={submitting} className={`w-full py-4 rounded-xl font-extrabold text-[#0a0900] text-sm uppercase tracking-wider shadow-[0_4px_16px_rgba(201,168,76,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90 ${activeTab === 'issued' ? 'bg-gradient-to-r from-orange-400 to-amber-500' : 'bg-gradient-to-r from-emerald-400 to-green-500'}`}>
                    {submitting
                      ? <><div className="w-4 h-4 border-2 border-[#0a0900] border-t-transparent rounded-full animate-spin"></div> Processing...</>
                      : activeTab === 'issued' ? 'Confirm Issue Material' : 'Confirm Receive Material'
                    }
                  </button>
                </div>
              </div>

            </div>
          </form>
        </div>
      ) : (

        /* ── LIST VIEW (Visible when builder is closed) ── */
        <div className="bg-[#131929] rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.5)] border border-[rgba(255,255,255,0.04)] overflow-hidden flex flex-col animate-in fade-in">
          <div className="p-5 border-b border-[rgba(255,255,255,0.04)] bg-[#1a2235] flex justify-between items-center">
            <h3 className="font-black text-[#e8eaf0] text-sm flex items-center gap-2 uppercase tracking-widest">
              <Truck className={`w-4 h-4 ${activeTab === 'issued' ? 'text-orange-400' : 'text-emerald-400'}`} /> Recent {activeTab === 'issued' ? 'Issues' : 'Receipts'} Log
            </h3>
            <span className="text-[10px] font-black bg-[#0b0f1a] border border-[rgba(255,255,255,0.05)] text-[#8a95a8] px-3 py-1 rounded uppercase tracking-widest shadow-inner">
              {logs.length} Records
            </span>
          </div>

          <div className="overflow-x-auto custom-scrollbar">

            {/* PC Table */}
            <table className="w-full text-left hidden md:table">
              <thead className="bg-[#131929] border-b border-[rgba(255,255,255,0.04)]">
                <tr>
                  <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-[#8a95a8]">Date & Ref</th>
                  <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-[#8a95a8]">Processor</th>
                  <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-[#8a95a8]">Material / Product</th>
                  <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-[#8a95a8]">Details</th>
                  <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-[#8a95a8] text-right">Qty {activeTab === 'issued' ? 'Issued' : 'Received'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(255,255,255,0.02)]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors cursor-pointer group" onClick={() => setViewingLog(log)}>
                    <td className="px-5 py-4">
                      <span className="font-bold text-[#e8eaf0] block text-sm">{new Date(log.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      <span className="text-[10px] text-[#c9a84c] font-black uppercase tracking-widest mt-0.5 block">#{log.id.split('-')[0].toUpperCase()}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-bold text-white block text-sm group-hover:text-[#c9a84c] transition-colors">{log.processor_details?.name || 'Unknown'}</span>
                      {log.processor_details?.shop_name && <span className="text-[10px] font-bold text-[#8a95a8] uppercase tracking-wider mt-0.5 block">{log.processor_details.shop_name}</span>}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border shadow-inner ${activeTab === 'issued' ? 'bg-[rgba(251,146,60,0.1)] text-orange-400 border-[rgba(251,146,60,0.2)]' : 'bg-[rgba(52,211,153,0.1)] text-emerald-400 border-[rgba(52,211,153,0.2)]'}`}>
                          <Package className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-[#e8eaf0] text-sm">{log.product_details?.name || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm max-w-[200px]">
                      {log.process_type && <span className="inline-block bg-[rgba(96,165,250,0.1)] text-blue-400 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded mb-1.5 mr-1 border border-[rgba(96,165,250,0.2)]">{log.process_type} {log.total_cost ? `(৳ ${Number(log.total_cost).toLocaleString()})` : ''}</span>}
                      {log.note && <p className="text-[10px] font-bold text-[#8a95a8] truncate mb-1" title={log.note}>{log.note}</p>}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className={`inline-flex items-center gap-1 font-black text-sm px-3 py-1.5 rounded-lg border ${activeTab === 'issued' ? 'bg-[rgba(251,146,60,0.1)] text-orange-400 border-[rgba(251,146,60,0.2)]' : 'bg-[rgba(52,211,153,0.1)] text-emerald-400 border-[rgba(52,211,153,0.2)]'}`}>
                        {activeTab === 'issued' ? '-' : '+'}{Math.round(Number(log.quantity))} <span className="text-[10px] font-black uppercase tracking-widest ml-1">{log.product_details?.unit || 'UNIT'}</span>
                      </span>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center text-[#4a5568]">
                      <Truck className="w-12 h-12 mx-auto mb-4 opacity-30" />
                      <span className="block font-bold text-sm text-[#8a95a8]">No {activeTab} material logs found.</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-[rgba(255,255,255,0.02)]">
              {logs.length === 0 ? (
                <div className="px-6 py-16 text-center text-[#4a5568]">
                  <Truck className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <span className="block font-bold text-sm text-[#8a95a8]">No {activeTab} logs found.</span>
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} onClick={() => setViewingLog(log)} className="p-4 hover:bg-[rgba(255,255,255,0.02)] transition-colors cursor-pointer">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border shadow-inner ${activeTab === 'issued' ? 'bg-[rgba(251,146,60,0.1)] text-orange-400 border-[rgba(251,146,60,0.2)]' : 'bg-[rgba(52,211,153,0.1)] text-emerald-400 border-[rgba(52,211,153,0.2)]'}`}>
                          <Package className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="font-bold text-[#e8eaf0] text-sm block">{log.products?.name || 'Unknown'}</span>
                          <span className="text-[10px] font-black text-[#c9a84c] uppercase tracking-widest">#{log.id.split('-')[0].toUpperCase()}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`inline-block font-black text-sm px-2 py-1 rounded border ${activeTab === 'issued' ? 'bg-[rgba(251,146,60,0.1)] text-orange-400 border-[rgba(251,146,60,0.2)]' : 'bg-[rgba(52,211,153,0.1)] text-emerald-400 border-[rgba(52,211,153,0.2)]'}`}>
                          {activeTab === 'issued' ? '-' : '+'}{log.quantity} <span className="text-[9px] uppercase">{log.products?.unit}</span>
                        </span>
                      </div>
                    </div>
                    <div className="bg-[#0b0f1a] border border-[rgba(255,255,255,0.02)] p-2.5 rounded-lg flex justify-between items-center">
                      <div>
                        <p className="font-bold text-white text-xs">{log.contacts?.name}</p>
                        <p className="text-[9px] font-bold text-[#8a95a8] uppercase tracking-widest">{new Date(log.date).toLocaleDateString('en-GB')}</p>
                      </div>
                      {log.process_type && <span className="inline-block bg-[rgba(96,165,250,0.1)] text-blue-400 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border border-[rgba(96,165,250,0.2)]">{log.process_type}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODAL */}
      {viewingLog && <ProcessingLogModal log={viewingLog} onClose={() => setViewingLog(null)} />}
    </div>
  );
}

function ProcessingLogModal({ log, onClose }: { log: any, onClose: () => void }) {
  const isIssued = log.type === 'issued';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0f1a]/80 backdrop-blur-sm p-4 w-full animate-fade-in">
      <div className="bg-[#131929] border border-[rgba(201,168,76,0.2)] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className={`h-24 relative ${isIssued ? 'bg-[#1a2235] border-b border-[rgba(251,146,60,0.3)]' : 'bg-[#1a2235] border-b border-[rgba(52,211,153,0.3)]'}`}>
          <div className={`absolute inset-0 opacity-20 ${isIssued ? 'bg-gradient-to-r from-orange-600 to-amber-500' : 'bg-gradient-to-r from-green-600 to-emerald-500'}`}></div>
          <button onClick={onClose} className="absolute top-4 right-4 text-[#8a95a8] hover:text-white bg-[#131929]/50 hover:bg-[#131929] p-1.5 rounded-lg transition-colors border border-[rgba(255,255,255,0.05)] z-10"><X className="w-5 h-5" /></button>
          <div className="absolute bottom-4 left-6 z-10">
            <span className={`text-[9px] font-black px-3 py-1 rounded uppercase tracking-widest border ${isIssued ? 'bg-[rgba(251,146,60,0.1)] text-orange-400 border-[rgba(251,146,60,0.3)]' : 'bg-[rgba(52,211,153,0.1)] text-emerald-400 border-[rgba(52,211,153,0.3)]'}`}>
              {isIssued ? 'Material Issued' : 'Material Received'}
            </span>
          </div>
        </div>
        <div className="px-6 pb-6 pt-5 overflow-y-auto custom-scrollbar">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="font-black text-white text-xl">{log.products?.name || 'Unknown Product'}</h3>
              <p className="text-xs text-[#c9a84c] font-bold mt-1 uppercase tracking-wider">{log.contacts?.name || '—'} {log.contacts?.shop_name ? `(${log.contacts.shop_name})` : ''}</p>
            </div>
            <span className="font-mono text-[10px] font-black text-[#8a95a8] bg-[#0b0f1a] border border-[rgba(255,255,255,0.05)] px-2 py-1 rounded uppercase tracking-widest shadow-inner">#{log.id?.split('-')[0]?.toUpperCase()}</span>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="bg-[#1a2235] rounded-xl p-4 border border-[rgba(255,255,255,0.04)] shadow-inner">
              <p className="text-[9px] font-black text-[#8a95a8] uppercase tracking-widest mb-1">Date</p>
              <p className="font-bold text-[#e8eaf0] text-sm">{log.date ? new Date(log.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</p>
            </div>
            <div className={`rounded-xl p-4 border shadow-inner ${isIssued ? 'bg-[rgba(251,146,60,0.05)] border-[rgba(251,146,60,0.2)]' : 'bg-[rgba(52,211,153,0.05)] border-[rgba(52,211,153,0.2)]'}`}>
              <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isIssued ? 'text-orange-500' : 'text-emerald-500'}`}>Quantity</p>
              <p className={`font-black text-xl ${isIssued ? 'text-orange-400' : 'text-emerald-400'}`}>{isIssued ? '-' : '+'}{log.quantity} <span className="text-[10px] font-bold opacity-70 uppercase tracking-widest">{log.products?.unit || 'UNIT'}</span></p>
            </div>
            {log.process_type && (
              <div className="bg-[#1a2235] rounded-xl p-4 border border-[rgba(255,255,255,0.04)] shadow-inner">
                <p className="text-[9px] font-black text-[#8a95a8] uppercase tracking-widest mb-1">Process Type</p>
                <p className="font-bold text-[#e8eaf0] text-sm capitalize">{log.process_type}</p>
              </div>
            )}
            {Number(log.total_cost) > 0 && (
              <div className="bg-[rgba(96,165,250,0.05)] rounded-xl p-4 border border-[rgba(96,165,250,0.2)] shadow-inner">
                <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Total Cost</p>
                <p className="font-black text-white text-lg"><span className="text-xs text-blue-400 mr-0.5">৳</span>{Number(log.total_cost || 0).toLocaleString()}</p>
              </div>
            )}
          </div>
          {log.note && (
            <div className="mb-5 bg-[#1a2235] p-4 rounded-xl border border-[rgba(255,255,255,0.04)] shadow-inner">
              <p className="text-[9px] font-black text-[#8a95a8] uppercase tracking-widest mb-1.5">Note</p>
              <p className="text-sm font-bold text-[#e8eaf0]">{log.note}</p>
            </div>
          )}
          {log.photo_urls && log.photo_urls.length > 0 && (
            <div>
              <p className="text-[9px] font-black text-[#c9a84c] uppercase tracking-widest mb-2.5">Attached Photos</p>
              <div className="flex flex-wrap gap-2 custom-scrollbar overflow-x-auto pb-1">
                {(log.photo_urls as string[]).map((url: string, i: number) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer" className="block w-16 h-16 rounded-xl overflow-hidden border border-[rgba(255,255,255,0.1)] hover:border-[#c9a84c] transition-colors shadow-sm shrink-0">
                    <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-[rgba(255,255,255,0.04)] bg-[#1a2235] flex justify-end shrink-0">
          <button onClick={onClose} className="px-6 py-2.5 bg-[#131929] border border-[rgba(255,255,255,0.1)] text-[#e8eaf0] font-bold rounded-lg shadow-sm hover:bg-[rgba(255,255,255,0.05)] transition-colors text-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}