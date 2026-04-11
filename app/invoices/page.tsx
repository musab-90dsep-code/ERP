'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, FileText, ShoppingCart, ArrowLeftRight, Calculator, CreditCard, PenTool, CheckCircle, PackageSearch, Banknote, Building2, Wallet } from 'lucide-react';

type InvoiceType = 'buy' | 'sell' | 'return';
type PaymentMethod = 'cash' | 'bikash' | 'nagad' | 'rocket' | 'upay' | 'bank_transfer' | 'cheque';
type ChequeType = 'own' | 'customer';

export default function InvoicesPage() {
   return (
      <Suspense fallback={<div className="p-10 font-bold text-center">Loading invoices...</div>}>
         <InvoicesContent />
      </Suspense>
   );
}

function InvoicesContent() {
   const router = useRouter();
   const searchParams = useSearchParams();
   const initTab = (searchParams.get('tab') as InvoiceType) || 'buy';

   const [activeTab, setActiveTab] = useState<InvoiceType>(initTab);
   const [showBuilder, setShowBuilder] = useState(false);

   // Data
   const [invoices, setInvoices] = useState<any[]>([]);
   const [contacts, setContacts] = useState<any[]>([]);
   const [products, setProducts] = useState<any[]>([]);
   const [employees, setEmployees] = useState<any[]>([]);

   // Toggles
   const [hasPayment, setHasPayment] = useState(false);
   const [hasDiscount, setHasDiscount] = useState(false);

   // Form State
   const [form, setForm] = useState({
      contact_id: '',
      date: new Date().toISOString().split('T')[0],
      items: [{ product_id: '', quantity: 1, price: '' as any }],
      discount: '' as any,
      discount_type: 'amount',
      discount_method: '',

      // Payment
      payment_amount: '' as any,
      payment_method: 'cash' as PaymentMethod,
      cheque_type: 'own' as ChequeType, // For Paid/Buy invoices
      payment_details: {} as any,

      // Signatures
      authorized_signature: '',
      received_by: ''
   });

   const [submitting, setSubmitting] = useState(false);

   useEffect(() => {
      fetchInvoices();
      fetchData();
   }, [activeTab]);

   useEffect(() => {
      const tab = searchParams.get('tab');
      const fromOrder = searchParams.get('from_order');

      if (tab === 'buy' || tab === 'sell' || tab === 'return') {
         setActiveTab(tab as InvoiceType);
      }

      // Pre-fill from Order if param exists
      if (fromOrder) {
         try {
            const order = JSON.parse(decodeURIComponent(fromOrder));
            setForm(prev => ({
               ...prev,
               contact_id: order.contact_id || '',
               date: order.date || prev.date,
               items: (order.items && order.items.length > 0)
                  ? order.items.map((i: any) => ({
                     product_id: i.product_id || '',
                     quantity: Number(i.quantity) || 1,
                     price: Number(i.price) || 0,
                  }))
                  : prev.items,
            }));
            setShowBuilder(true);
         } catch (e) {
            console.error('Failed to parse from_order param', e);
         }
      } else {
         setShowBuilder(false);
      }
   }, [searchParams]);

   const fetchData = async () => {
      const { data: pData } = await supabase.from('products').select('*');
      setProducts(pData || []);

      // Fetch contacts
      const targetType = activeTab === 'buy' ? 'supplier' : 'customer';
      const { data: cData } = await supabase.from('contacts').select('*').eq('type', targetType);
      setContacts(cData || []);

      // Fetch employees
      const { data: eData } = await supabase.from('employees').select('id, name, role, is_authorizer');
      setEmployees(eData || []);
   };

   const fetchInvoices = async () => {
      const { data } = await supabase
         .from('invoices')
         .select('*, contacts(name, shop_name)')
         .eq('type', activeTab)
         .order('created_at', { ascending: false });
      setInvoices(data || []);
   };

   const handleAddItem = () => setForm({ ...form, items: [...form.items, { product_id: '', quantity: 1, price: '' as any }] });

   const handleRemoveItem = (index: number) => {
      const newItems = [...form.items];
      newItems.splice(index, 1);
      setForm({ ...form, items: newItems });
   };

   const handleItemChange = (index: number, field: string, value: any) => {
      const newItems = [...form.items] as any;
      newItems[index][field] = value;

      if (field === 'product_id') {
         const prod = products.find(p => p.id === value);
         if (prod) newItems[index].price = Number(prod.price || 0);
      }
      setForm({ ...form, items: newItems });
   };

   const subtotal = form.items.reduce((acc, item) => acc + (Number(item.quantity) * Number(item.price)), 0);
   const actualDiscount = form.discount_type === 'percentage'
      ? (subtotal * (Number(form.discount) / 100))
      : Number(form.discount);
   const total = Math.max(0, subtotal - actualDiscount);

   // Safe payment amount handler to prevent over-paying
   const handlePaymentAmountChange = (val: string) => {
      if (val === '') {
         setForm({ ...form, payment_amount: '' });
         return;
      }
      let amt = Number(val);
      if (amt > total) amt = total;
      if (amt < 0) amt = 0;
      setForm({ ...form, payment_amount: amt });
   };

   const due = Math.max(0, total - Number(form.payment_amount));

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!form.contact_id || form.items.some(i => !i.product_id)) {
         alert('Please fill out all required fields and select products.');
         return;
      }
      setSubmitting(true);

      try {
         // 1. Create Invoice
         const invPayload = {
            type: activeTab,
            contact_id: form.contact_id,
            date: form.date,
            subtotal: subtotal,
            discount: actualDiscount,
            total: total,
            paid_amount: Number(form.payment_amount),
            due_amount: due,
            payment_status: due <= 0 ? 'paid' : (form.payment_amount > 0 ? 'partial' : 'unpaid'),
            authorized_signature: form.authorized_signature,
            received_by: form.received_by
         };

         const { data: invData, error: invErr } = await supabase.from('invoices').insert([invPayload]).select().single();
         if (invErr) throw invErr;

         // 2. Create Invoice Items
         const invoiceItemsTarget = form.items.map(item => ({
            invoice_id: invData.id,
            product_id: item.product_id,
            quantity: Number(item.quantity),
            price: Number(item.price),
            subtotal: Number(item.quantity) * Number(item.price)
         }));
         await supabase.from('invoice_items').insert(invoiceItemsTarget);

         // 3. Create Payment entry if applicable
         if (Number(form.payment_amount) > 0) {
            // buy = payment goes out, sell = payment comes in, return = payment goes out (refund)
            const paymentType = activeTab === 'sell' ? 'in' : 'out';

            let finalPaymentDetails = { ...form.payment_details };
            if (form.payment_method === 'cheque' && activeTab === 'buy') {
               finalPaymentDetails.cheque_type = form.cheque_type;
            }

            const paymentPayload = {
               invoice_id: invData.id,
               type: paymentType,
               amount: Number(form.payment_amount),
               method: form.payment_method,
               date: form.date,
               payment_method_details: finalPaymentDetails,
               authorized_signature: form.authorized_signature,
               received_by: form.received_by
            };
            await supabase.from('payments').insert([paymentPayload]);

            // Register Cheque
            if (form.payment_method === 'cheque') {
               await supabase.from('checks').insert([{
                  type: paymentType === 'out' ? 'issued' : 'received',
                  check_number: form.payment_details.cheque_number || 'UNKNOWN',
                  bank_name: form.payment_details.bank_name || 'UNKNOWN',
                  amount: Number(form.payment_amount),
                  issue_date: form.date,
                  cash_date: form.payment_details.cheque_date || form.date,
                  status: 'pending',
                  partner_id: form.contact_id
               }]);
            }
         }

         // 4. Adjust Product Inventory Stock
         for (const item of form.items) {
            const p = products.find(prod => prod.id === item.product_id);
            if (p && p.stock_quantity !== undefined) {
               let newStock = Number(p.stock_quantity);
               if (activeTab === 'buy') newStock += Number(item.quantity);
               else if (activeTab === 'sell') newStock -= Number(item.quantity);
               else if (activeTab === 'return') newStock += Number(item.quantity);

               await supabase.from('products').update({ stock_quantity: newStock }).eq('id', p.id);
            }
         }

         setShowBuilder(false);
         resetForm();
         fetchInvoices();
         fetchData();

      } catch (e: any) {
         console.error(e);
         alert('Failed to save Invoice.');
      } finally {
         setSubmitting(false);
      }
   };

   const resetForm = () => {
      setHasPayment(false);
      setHasDiscount(false);
      setForm({
         contact_id: '', date: new Date().toISOString().split('T')[0], items: [{ product_id: '', quantity: 1, price: '' as any }], discount: '' as any, discount_type: 'amount', discount_method: '',
         payment_amount: '' as any, payment_method: 'cash', cheque_type: 'own', payment_details: {}, authorized_signature: '', received_by: ''
      });
   };

   const handleDelete = async (id: string) => {
      if (!window.confirm("Delete this invoice completely?")) return;
      await supabase.from('invoices').delete().eq('id', id);
      fetchInvoices();
   };

   const renderPaymentDetails = () => {
      if (['bikash', 'nagad', 'rocket', 'upay'].includes(form.payment_method)) {
         return (
            <div className="grid grid-cols-2 gap-4 mt-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
               <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                     {activeTab === 'buy' || activeTab === 'return' ? 'Received Number' : 'Send Number'}
                  </label>
                  <input type="text" placeholder="+8801..." value={form.payment_details.number || ''} onChange={e => setForm({ ...form, payment_details: { ...form.payment_details, number: e.target.value } })} className="w-full border p-2.5 rounded-lg text-sm bg-white" />
               </div>
               <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Transaction ID (TrxID)</label>
                  <input type="text" placeholder="TXN..." value={form.payment_details.transaction_id || ''} onChange={e => setForm({ ...form, payment_details: { ...form.payment_details, transaction_id: e.target.value } })} className="w-full border p-2.5 rounded-lg text-sm bg-white font-mono uppercase" />
               </div>
            </div>
         );
      }
      if (form.payment_method === 'bank_transfer') {
         return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
               <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Bank Name</label>
                  <input type="text" placeholder="e.g. City Bank" value={form.payment_details.bank_name || ''} onChange={e => setForm({ ...form, payment_details: { ...form.payment_details, bank_name: e.target.value } })} className="w-full border p-2.5 rounded-lg text-sm bg-white" />
               </div>
               <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Account Name</label>
                  <input type="text" value={form.payment_details.account_name || ''} onChange={e => setForm({ ...form, payment_details: { ...form.payment_details, account_name: e.target.value } })} className="w-full border p-2.5 rounded-lg text-sm bg-white" />
               </div>
               <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Account Number</label>
                  <input type="text" value={form.payment_details.account_number || ''} onChange={e => setForm({ ...form, payment_details: { ...form.payment_details, account_number: e.target.value } })} className="w-full border p-2.5 rounded-lg text-sm bg-white font-mono" />
               </div>
               <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Branch</label>
                  <input type="text" value={form.payment_details.branch || ''} onChange={e => setForm({ ...form, payment_details: { ...form.payment_details, branch: e.target.value } })} className="w-full border p-2.5 rounded-lg text-sm bg-white" />
               </div>
               <div className="col-span-2 md:col-span-4">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Date & Time</label>
                  <input type="datetime-local" value={form.payment_details.datetime || ''} onChange={e => setForm({ ...form, payment_details: { ...form.payment_details, datetime: e.target.value } })} className="w-full border p-2.5 rounded-lg text-sm bg-white" />
               </div>
            </div>
         );
      }
      if (form.payment_method === 'cheque') {
         return (
            <div className="grid grid-cols-2 gap-4 mt-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
               {activeTab === 'buy' && (
                  <div className="col-span-2">
                     <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Cheque Type</label>
                     <select value={form.cheque_type} onChange={e => setForm({ ...form, cheque_type: e.target.value as ChequeType })} className="w-full border p-2.5 rounded-lg text-sm bg-white font-bold text-indigo-700">
                        <option value="own">Own Cheque</option>
                        <option value="customer">Customers Cheque (Transferred)</option>
                     </select>
                  </div>
               )}

               {/* If it's a transferred customer cheque, we might only need to select which one, but for simplicity we take details */}
               <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Bank Name</label>
                  <input type="text" value={form.payment_details.bank_name || ''} onChange={e => setForm({ ...form, payment_details: { ...form.payment_details, bank_name: e.target.value } })} className="w-full border p-2.5 rounded-lg text-sm bg-white" />
               </div>
               {activeTab === 'sell' && (
                  <>
                     <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Account Name</label>
                        <input type="text" value={form.payment_details.account_name || ''} onChange={e => setForm({ ...form, payment_details: { ...form.payment_details, account_name: e.target.value } })} className="w-full border p-2.5 rounded-lg text-sm bg-white" />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Account Number</label>
                        <input type="text" value={form.payment_details.account_number || ''} onChange={e => setForm({ ...form, payment_details: { ...form.payment_details, account_number: e.target.value } })} className="w-full border p-2.5 rounded-lg text-sm bg-white font-mono" />
                     </div>
                  </>
               )}
               <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Cheque Number</label>
                  <input type="text" value={form.payment_details.cheque_number || ''} onChange={e => setForm({ ...form, payment_details: { ...form.payment_details, cheque_number: e.target.value } })} className="w-full border p-2.5 rounded-lg text-sm bg-white font-mono" />
               </div>
               <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Cheque Date</label>
                  <input type="date" value={form.payment_details.cheque_date || ''} onChange={e => setForm({ ...form, payment_details: { ...form.payment_details, cheque_date: e.target.value } })} className="w-full border p-2.5 rounded-lg text-sm bg-white" />
               </div>
            </div>
         );
      }
      return null;
   };

   return (
      <div className="pb-12 font-sans animate-in fade-in duration-300">

         {/* Dynamic Header */}
         <div className={`p-8 rounded-3xl text-white shadow-lg relative overflow-hidden mb-8 transition-colors duration-500 
         ${activeTab === 'buy' ? 'bg-gradient-to-r from-blue-900 to-sky-900' :
               activeTab === 'sell' ? 'bg-gradient-to-r from-emerald-900 to-teal-800' :
                  'bg-gradient-to-r from-orange-900 to-rose-900'}`}>
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white opacity-5 blur-3xl pointer-events-none"></div>
            <div className="relative z-10 flex justify-between items-end">
               <div>
                  <p className="text-white/60 font-bold mb-1 text-sm tracking-widest uppercase flex items-center gap-2">
                     <FileText className="w-4 h-4" /> Comprehensive Invoicing Engine
                  </p>
                  <h1 className="text-4xl font-extrabold tracking-tight mb-2">
                     {activeTab === 'buy' ? 'Purchases (Buy)' : activeTab === 'sell' ? 'Sales (Sell)' : 'Sales Returns'}
                  </h1>
                  <p className="text-white/80 max-w-xl text-sm md:text-base">
                     {activeTab === 'buy' ? 'Record vendor purchases, increase your stock, and process upfront payments.' :
                        activeTab === 'sell' ? 'Generate customer invoices, decrease stock securely, and track revenue.' :
                           'Process customer returns to accurately place finished goods back into inventory and log refunds.'}
                  </p>
               </div>

               {!showBuilder && (
                  <button onClick={() => { resetForm(); setShowBuilder(true); }} className="bg-white/20 hover:bg-white text-white hover:text-slate-900 px-6 py-3 rounded-xl font-bold flex items-center gap-2 backdrop-blur-sm transition-all shadow-lg">
                     <Plus className="w-5 h-5" />
                     Create {activeTab === 'buy' ? 'Purchase' : activeTab === 'sell' ? 'Sale' : 'Return'}
                  </button>
               )}
            </div>
         </div>

         {!showBuilder ? (
            <>
               {/* Tabs handled by sidebar navigation now */}

               {/* Invoices Table */}
               <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <table className="w-full text-left">
                     <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                           <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Invoice ID / Date</th>
                           <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{activeTab === 'buy' ? 'Supplier' : 'Customer'}</th>
                           <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Total Value</th>
                           <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Payment Status</th>
                           <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-100">
                        {invoices.map(inv => (
                           <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4">
                                 <span className="font-mono text-sm font-bold text-slate-800">#{inv.id.substring(0, 8).toUpperCase()}</span>
                                 <div className="text-xs text-gray-500 mt-0.5">{new Date(inv.date).toLocaleDateString()}</div>
                              </td>
                              <td className="px-6 py-4">
                                 <span className="font-bold text-indigo-900">{inv.contacts?.name || 'Unknown'}</span>
                                 {inv.contacts?.shop_name && <span className="block text-xs text-indigo-500">{inv.contacts.shop_name}</span>}
                              </td>
                              <td className="px-6 py-4 font-extrabold text-slate-900">৳ {Number(inv.total).toLocaleString()}</td>
                              <td className="px-6 py-4">
                                 <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border
                           ${inv.payment_status === 'paid' ? 'bg-green-50 text-green-700 border-green-200' :
                                       inv.payment_status === 'partial' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                          'bg-red-50 text-red-700 border-red-200'}`}>
                                    {inv.payment_status}
                                 </span>
                                 {Number(inv.due_amount) > 0 && <div className="text-[10px] text-red-500 font-bold mt-1">Due: ৳ {inv.due_amount}</div>}
                              </td>
                              <td className="px-6 py-4 text-right">
                                 <button onClick={() => handleDelete(inv.id)} className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors"><Trash2 className="w-5 h-5" /></button>
                              </td>
                           </tr>
                        ))}
                        {invoices.length === 0 && (
                           <tr>
                              <td colSpan={5} className="p-12 text-center text-gray-400">
                                 <FileText className="w-12 h-12 mx-auto text-gray-200 mb-3" />
                                 <p className="font-medium">No records found for {activeTab}</p>
                              </td>
                           </tr>
                        )}
                     </tbody>
                  </table>
               </div>
            </>
         ) : (

            /* --- INVOICE BUILDER --- */
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden animate-in slide-in-from-bottom-8 duration-500 pb-10">
               <div className={`p-6 border-b border-gray-100 flex justify-between items-center text-white
               ${activeTab === 'buy' ? 'bg-blue-600' : activeTab === 'sell' ? 'bg-emerald-600' : 'bg-orange-600'}`}>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                     <Calculator className="w-6 h-6" />
                     New {activeTab === 'buy' ? 'Purchase Invoice' : activeTab === 'sell' ? 'Sales Invoice' : 'Return Invoice'}
                  </h2>
                  <button onClick={() => setShowBuilder(false)} className="bg-black/20 hover:bg-black/40 px-4 py-2 rounded-lg text-sm font-bold transition-all">Cancel</button>
               </div>

               <form onSubmit={handleSubmit} className="p-8">

                  {/* 1. Core Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                     <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                           <FileText className="w-4 h-4 text-gray-400" /> Memo no
                        </label>
                        <input type="text" disabled placeholder="[ Auto-generated upon save ]" className="w-full border border-gray-200 rounded-xl p-3.5 bg-gray-50 text-gray-500 font-bold text-lg cursor-not-allowed" />
                     </div>
                     <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                           <Building2 className="w-4 h-4 text-gray-400" /> Add {activeTab === 'buy' ? 'supplier' : 'customer'}
                        </label>
                        <select required value={form.contact_id} onChange={e => setForm({ ...form, contact_id: e.target.value })} className="w-full border border-gray-200 rounded-xl p-3.5 focus:ring-2 focus:ring-slate-800 outline-none font-bold text-gray-900 bg-gray-50 text-lg">
                           <option value="" disabled>-- Choose Contact --</option>
                           {contacts.map(c => <option key={c.id} value={c.id}>{c.name} {c.shop_name ? `- ${c.shop_name}` : ''}</option>)}
                        </select>
                     </div>
                     <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                           <PenTool className="w-4 h-4 text-gray-400" /> Add date
                        </label>
                        <input required type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full border border-gray-200 rounded-xl p-3.5 focus:ring-2 focus:ring-slate-800 outline-none font-bold text-gray-900 bg-gray-50 text-lg" />
                     </div>
                  </div>

                  {/* 2. Dynamic Products Section */}
                  <div className="mb-10 p-6 bg-slate-50 border border-slate-200 rounded-2xl shadow-inner">
                     <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <PackageSearch className="w-5 h-5 text-indigo-500" /> Product Line Items
                     </h3>

                     {form.items.map((item, index) => (
                        <div key={index} className="grid grid-cols-12 gap-3 mb-3 bg-white p-3 rounded-xl shadow-sm border border-slate-100 items-end">
                           <div className="col-span-12 md:col-span-5">
                              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Product</label>
                              <select required value={item.product_id} onChange={e => handleItemChange(index, 'product_id', e.target.value)} className="w-full border border-gray-200 rounded-lg p-2.5 font-bold text-gray-900 bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-500">
                                 <option value="" disabled>Select Product...</option>
                                 {products.filter(p => activeTab === 'sell' ? p.category === 'finished-goods' : p.category === 'raw-materials').map(p => <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock_quantity})</option>)}
                              </select>
                           </div>
                           <div className="col-span-6 md:col-span-2">
                              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Price</label>
                              <input type="number" step="0.01" value={item.price} onChange={e => handleItemChange(index, 'price', e.target.value === '' ? '' : Number(e.target.value))} className="w-full border border-gray-200 rounded-lg p-2.5 font-bold text-gray-900 bg-gray-50" />
                           </div>
                           <div className="col-span-6 md:col-span-2">
                              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Quantity</label>
                              <input type="number" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value)} min="1" className="w-full border border-gray-200 rounded-lg p-2.5 font-bold text-gray-900 bg-gray-50 text-center" />
                           </div>
                           <div className="col-span-10 md:col-span-2">
                              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Subtotal</label>
                              <div className="w-full bg-slate-100 rounded-lg p-2.5 font-mono font-bold text-slate-800 text-center">
                                 <span style={{ fontFamily: "sans-serif" }} className="font-extrabold pr-[2px]">৳</span> {(Number(item.quantity) * Number(item.price)).toFixed(2)}
                              </div>
                           </div>
                           <div className="col-span-2 md:col-span-1 flex justify-end">
                              <button type="button" onClick={() => handleRemoveItem(index)} disabled={form.items.length === 1} className="p-3 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30">
                                 <Trash2 className="w-5 h-5" />
                              </button>
                           </div>
                        </div>
                     ))}
                     <button type="button" onClick={handleAddItem} className="mt-3 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5">
                        <Plus className="w-4 h-4" /> Add Another Item
                     </button>

                     {/* Calculations total */}
                     <div className="mt-6 border-t border-slate-200 pt-6 flex flex-col items-end">
                        <div className="w-full max-w-sm space-y-3">
                           <div className="flex justify-between items-center text-sm font-bold text-slate-600">
                              <span>Subtotal:</span>
                              <span className="font-mono text-base">৳ {subtotal.toFixed(2)}</span>
                           </div>
                           <div className="flex flex-col items-end gap-2 w-full pt-2">
                              <label className="flex items-center cursor-pointer justify-end gap-2 text-sm font-bold text-slate-800">
                                 <span>Discount</span>
                                 <input type="checkbox" checked={hasDiscount} onChange={e => { setHasDiscount(e.target.checked); if (!e.target.checked) setForm({ ...form, discount: 0, discount_type: 'amount', discount_method: '' }); }} className="w-4 h-4 text-indigo-600 rounded" />
                              </label>
                              {hasDiscount && (
                                 <div className="flex gap-2 justify-end w-full max-w-[300px] items-center animate-in fade-in slide-in-from-top-1">
                                    {form.discount_type === 'percentage' && (
                                       <span className="text-xs text-gray-500 font-bold mr-1">
                                          -Tk {actualDiscount.toFixed(2)}
                                       </span>
                                    )}
                                    <select value={form.discount_type || 'amount'} onChange={e => setForm({ ...form, discount_type: e.target.value })} className="border border-slate-300 rounded p-1.5 focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white cursor-pointer">
                                       <option value="amount">Taka (৳)</option>
                                       <option value="percentage">Percentage (%)</option>
                                    </select>
                                    <input type="number" placeholder={form.discount_type === 'percentage' ? '%' : 'Amt'} value={form.discount} onChange={e => setForm({ ...form, discount: e.target.value === '' ? '' : Number(e.target.value) })} className="w-[100px] text-right border border-slate-300 rounded p-1.5 font-mono outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                                 </div>
                              )}
                           </div>
                           <div className="flex justify-between items-center text-xl font-extrabold text-slate-900 pt-3 border-t border-slate-200 mt-2">
                              <span>Total:</span>
                              <span className="font-mono text-2xl text-indigo-700">৳ {total.toFixed(2)}</span>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">

                     {/* 3. Payment Method Binding */}
                     <div className={`p-6 rounded-2xl border shadow-sm relative ${activeTab === 'return' ? 'bg-orange-50/50 border-orange-100' : 'bg-blue-50/50 border-blue-100'}`}>
                        <div className={`absolute top-4 right-4 opacity-10 ${activeTab === 'return' ? 'text-orange-500' : 'text-blue-500'}`}><CreditCard className="w-20 h-20" /></div>

                        <div className={`flex items-center gap-3 relative z-10 mb-6 ${hasPayment ? 'border-b border-blue-200/50 pb-4' : ''}`}>
                           <input type="checkbox" checked={hasPayment} onChange={e => { setHasPayment(e.target.checked); setForm({ ...form, payment_amount: e.target.checked ? total : 0 }); }} className="w-6 h-6 text-blue-600 rounded" id="add-payment-cb" />
                           <label htmlFor="add-payment-cb" className={`text-xl font-extrabold cursor-pointer flex items-center gap-2 ${activeTab === 'return' ? 'text-orange-900' : 'text-blue-900'}`}>
                              <Wallet className="w-5 h-5" /> Transaction Definition
                           </label>
                        </div>

                        {hasPayment && (
                           <div className="space-y-6 relative z-10 animate-in fade-in slide-in-from-top-2">
                              <div>
                                 <label className={`block text-sm font-bold mb-1.5 ${activeTab === 'return' ? 'text-orange-900' : 'text-blue-900'}`}>
                                    {activeTab === 'buy' ? 'Paid Upfront Amount' : activeTab === 'sell' ? 'Received Amount' : 'Refund Amount'}
                                 </label>
                                 <div className="relative">
                                    <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-bold ${activeTab === 'return' ? 'text-orange-600' : 'text-blue-600'}`}><span style={{ fontFamily: "sans-serif" }} className="font-extrabold pr-[2px]">৳</span></span>
                                    <input type="number" min="0" max={total} value={form.payment_amount === 0 && !hasPayment ? '' : form.payment_amount} onChange={e => handlePaymentAmountChange(e.target.value)} className={`w-full pl-8 pr-4 py-3.5 border rounded-xl text-2xl font-extrabold outline-none focus:ring-2 shadow-inner bg-white ${activeTab === 'return' ? 'border-orange-200 text-orange-900 focus:ring-orange-500' : 'border-blue-200 text-blue-900 focus:ring-blue-500'}`} />
                                 </div>
                                 {due > 0 && <p className="text-xs font-bold text-red-500 mt-2 text-right">Remaining Due: ৳ {due.toFixed(2)}</p>}
                              </div>

                              <div className="animate-in fade-in slide-in-from-top-2 border-t pt-5 border-opacity-50 border-inherit">
                                 <label className={`block text-sm font-bold mb-3 ${activeTab === 'return' ? 'text-orange-900' : 'text-blue-900'}`}>Payment Engine Type</label>
                                 <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 bg-white p-3 rounded-2xl border shadow-inner">
                                    {['cash', 'bikash', 'nagad', 'rocket', 'upay', 'bank_transfer', 'cheque'].map(m => (
                                       <label key={m} className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${form.payment_method === m ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-500 shadow-sm' : 'border-gray-100 hover:bg-gray-50'}`}>
                                          <input type="radio" value={m} checked={form.payment_method === m} onChange={() => setForm({ ...form, payment_method: m as PaymentMethod })} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                                          <span className={`font-bold text-sm uppercase tracking-wide ${form.payment_method === m ? 'text-indigo-900' : 'text-gray-600'}`}>{m.replace('_', ' ')}</span>
                                       </label>
                                    ))}
                                 </div>

                                 <div className="mt-4">
                                    {renderPaymentDetails()}
                                 </div>
                              </div>
                           </div>
                        )}
                     </div>

                     {/* 4. Signatures / Final */}
                     <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                        <div>
                           <h3 className="text-xl font-extrabold text-slate-800 mb-6 flex items-center gap-2"><PenTool className="w-5 h-5" /> Official Signatures</h3>
                           <div className="space-y-5">
                              <div>
                                 <div className="mb-1.5 flex flex-col">
                                    <label className="text-sm font-bold text-gray-700">Add authorized signature</label>
                                    <span className="text-xs text-gray-400 font-medium">Select your authorizer employee</span>
                                 </div>
                                 <select required value={form.authorized_signature} onChange={e => setForm({ ...form, authorized_signature: e.target.value })} className="w-full border border-gray-200 rounded-xl p-3 font-bold text-gray-900 bg-white outline-none focus:ring-2 focus:ring-slate-800">
                                    <option value="" disabled>-- Select Employee --</option>
                                    {employees.filter(emp => emp.is_authorizer).map(emp => <option key={emp.id} value={emp.name}>{emp.name} {emp.role ? `(${emp.role})` : ''}</option>)}
                                 </select>
                              </div>
                              <div>
                                 <label className="block text-sm font-bold text-gray-700 mb-1.5">Add received by</label>
                                 <input required type="text" placeholder="e.g. Courier / Employee Name" value={form.received_by} onChange={e => setForm({ ...form, received_by: e.target.value })} className="w-full border border-gray-200 rounded-xl p-3 font-bold text-gray-900 bg-white outline-none focus:ring-2 focus:ring-slate-800" />
                              </div>
                           </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-200">
                           <button type="submit" disabled={submitting} className={`w-full py-4 rounded-xl font-extrabold text-white shadow-xl transition-all flex items-center justify-center gap-3 text-lg disabled:opacity-70 disabled:cursor-not-allowed
                           ${activeTab === 'buy' ? 'bg-blue-600 hover:bg-blue-700 hover:shadow-blue-200' :
                                 activeTab === 'sell' ? 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-emerald-200' :
                                    'bg-orange-600 hover:bg-orange-700 hover:shadow-orange-200'}`}>
                              {submitting ? 'Generating Invoice...' : (
                                 <>
                                    <CheckCircle className="w-6 h-6" />
                                    {activeTab === 'buy' ? 'Confirm Purchase Invoice' : activeTab === 'sell' ? 'Confirm Sales Invoice' : 'Process Sales Return'}
                                 </>
                              )}
                           </button>
                        </div>
                     </div>

                  </div>
               </form>
            </div>
         )}
      </div>
   );
}