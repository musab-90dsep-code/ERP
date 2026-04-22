'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Plus, Trash2, FileText, ShoppingCart, ArrowLeftRight, Calculator, CreditCard, PenTool, CheckCircle, PackageSearch, Banknote, Building2, Wallet, Eye, X, Printer } from 'lucide-react';

type InvoiceType = 'buy' | 'sell' | 'return' | 'exchange';
type PaymentMethod = 'cash' | 'bikash' | 'nagad' | 'rocket' | 'upay' | 'bank_transfer' | 'bank_to_bank_transfer' | 'cheque';
type ChequeType = 'own' | 'customer';

export default function InvoicesPage() {
   return (
      <Suspense fallback={<div className="p-10 font-bold text-center">Loading invoices...</div>}>
         <InvoicesContent />
      </Suspense>
   );
}

type InvoiceItem = { product_id: string; quantity: any; price: any; selected_head?: string };

function InvoicesContent() {
   const router = useRouter();
   const searchParams = useSearchParams();
   const initTab = (searchParams.get('tab') as InvoiceType) || 'buy';

   const [activeTab, setActiveTab] = useState<InvoiceType>(initTab);
   const [showBuilder, setShowBuilder] = useState(false);
   const [viewingInvoice, setViewingInvoice] = useState<any>(null);

   // Data
   const [invoices, setInvoices] = useState<any[]>([]);
   const [contacts, setContacts] = useState<any[]>([]);
   const [products, setProducts] = useState<any[]>([]);
   const [employees, setEmployees] = useState<any[]>([]);
   const [internalAccounts, setInternalAccounts] = useState<any[]>([]);

   // Toggles
   const [hasPayment, setHasPayment] = useState(false);
   const [hasDiscount, setHasDiscount] = useState(false);

   // Form State
   const [form, setForm] = useState({
      contact_id: '',
      date: new Date().toISOString().split('T')[0],
      items: [{ product_id: '', quantity: '', price: '' as any }] as InvoiceItem[],
      discount: '' as any,
      discount_type: 'amount',
      discount_method: '',

      // Payment
      payment_amount: '' as any,
      payment_method: 'cash' as PaymentMethod,
      cheque_type: 'own' as ChequeType, // For Paid/Buy invoices
      payment_details: {} as any,

      // Exchange specific
      returnedItems: [] as InvoiceItem[],

      // Signatures
      authorized_signature: '',
      received_by: ''
   });

   const [submitting, setSubmitting] = useState(false);
   const [previousDue, setPreviousDue] = useState(0);

   useEffect(() => {
      async function calcDue() {
         if (!form.contact_id) {
            setPreviousDue(0);
            return;
         }
         try {
            const invsRaw = await api.getInvoices({ contact: form.contact_id });
            const paysRaw = await api.getPayments({ contact: form.contact_id });
            const invs = Array.isArray(invsRaw) ? invsRaw : invsRaw.results || [];
            const pays = Array.isArray(paysRaw) ? paysRaw : paysRaw.results || [];

            let due = 0;
            if (activeTab === 'sell' || activeTab === 'return' || activeTab === 'exchange') {
               // Customer Ledger
               const totalSellDue = (invs || []).filter((i: any) => i.type === 'sell').reduce((acc: number, i: any) => acc + Number(i.due_amount || 0), 0);

               // Full return credit (abs of total for exchange/return invoices)
               const totalReturnCredit = (invs || [])
                  .filter((i: any) => i.type === 'return' || (i.type === 'exchange' && Number(i.total) < 0))
                  .reduce((acc: number, i: any) => acc + Math.abs(Number(i.total || 0)), 0);

               // Cash refunds paid out (payments OUT linked to exchange invoices)
               const exchangeInvoiceIds = new Set((invs || [])
                  .filter((i: any) => i.type === 'exchange' && Number(i.total) < 0)
                  .map((i: any) => i.id));
               const cashRefundsPaid = (pays || [])
                  .filter((p: any) => p.type === 'out' && p.invoice && exchangeInvoiceIds.has(p.invoice))
                  .reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0);

               const standalonePaysIn = (pays || []).filter((p: any) => p.type === 'in' && !p.invoice).reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0);
               const standalonePaysOut = (pays || []).filter((p: any) => p.type === 'out' && !p.invoice).reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0);

               // Due = sell due - full return credit - cash refunds - standalone in payments + standalone out payments
               due = totalSellDue - totalReturnCredit - cashRefundsPaid - (standalonePaysIn - standalonePaysOut);
            } else if (activeTab === 'buy') {
               // Supplier Ledger: Sum of all unpaid 'buy' balances minus unpaid returns, minus extra standalone payments
               const totalBuyDue = (invs || []).filter((i: any) => i.type === 'buy').reduce((acc: number, i: any) => acc + Number(i.due_amount || 0), 0);
               const totalReturnDue = (invs || []).filter((i: any) => i.type === 'return' && i.purchase_return).reduce((acc: number, i: any) => acc + Number(i.due_amount || 0), 0);
               const standalonePaysOut = (pays || []).filter((p: any) => p.type === 'out' && !p.invoice).reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0);
               const standalonePaysIn = (pays || []).filter((p: any) => p.type === 'in' && !p.invoice).reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0);

               due = (totalBuyDue - totalReturnDue) - (standalonePaysOut - standalonePaysIn);
            }
            // Force round to 2 decimals to prevent floating point drift (e.g. 50.300004 -> 50.30)
            setPreviousDue(Math.round(due * 100) / 100 > 0 ? Math.round(due * 100) / 100 : 0);
         } catch (e) {
            setPreviousDue(0);
         }
      }
      calcDue();
   }, [form.contact_id, activeTab]);

   useEffect(() => {
      fetchInvoices();
      fetchData();
   }, [activeTab]);

   useEffect(() => {
      const tab = searchParams.get('tab');
      const fromOrder = searchParams.get('from_order');

      if (tab === 'buy' || tab === 'sell' || tab === 'return' || tab === 'exchange') {
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
                     quantity: i.quantity || '',
                     price: Number(i.price) || 0,
                     selected_head: i.selected_head || ''
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
      try {
         const targetType = (activeTab === 'buy') ? 'supplier' : 'customer';
         const [pData, cData, eData, accData] = await Promise.all([
            api.getProducts({}),
            api.getContacts({ type: targetType }),
            api.getEmployees({}),
            api.getInternalAccounts({ ordering: 'provider_name' }),
         ]);
         setProducts(Array.isArray(pData) ? pData : pData.results ?? []);
         setContacts(Array.isArray(cData) ? cData : cData.results ?? []);
         setEmployees(Array.isArray(eData) ? eData : eData.results ?? []);
         setInternalAccounts(Array.isArray(accData) ? accData : accData.results ?? []);
      } catch (err) { console.error('fetchData:', err); }
   };

   const fetchInvoices = async () => {
      try {
         const data = await api.getInvoices({ type: activeTab, ordering: '-created_at' });
         setInvoices(Array.isArray(data) ? data : data.results ?? []);
      } catch (err) { console.error('fetchInvoices:', err); }
   };

   const handleAddItem = () => setForm({ ...form, items: [...form.items, { product_id: '', quantity: '', price: '' as any }] });
   const handleAddReturnedItem = () => setForm({ ...form, returnedItems: [...form.returnedItems, { product_id: '', quantity: '', price: '' as any }] });

   const handleRemoveItem = (index: number) => {
      const newItems = [...form.items];
      newItems.splice(index, 1);
      setForm({ ...form, items: newItems });
   };

   const handleRemoveReturnedItem = (index: number) => {
      const newItems = [...form.returnedItems];
      newItems.splice(index, 1);
      setForm({ ...form, returnedItems: newItems });
   };

   const handleItemChange = (index: number, field: string, value: any, isReturned: boolean = false) => {
      const listName = isReturned ? 'returnedItems' : 'items';
      const newItems = [...(form as any)[listName]] as any;
      let finalValue = value;

      // Auto-limit quantity for 'sell' (and exchange sales) based on available stock
      if (field === 'quantity' && (activeTab === 'sell' || (activeTab === 'exchange' && !isReturned))) {
         const prod = products.find(p => p.id === newItems[index].product_id);
         if (prod && prod.stock_quantity !== undefined) {
            const available = Number(prod.stock_quantity);
            if (Number(finalValue) > available) {
               finalValue = available;
            }
         }
      }

      newItems[index][field] = finalValue;

      if (field === 'product_id') {
         const prod = products.find(p => p.id === finalValue);
         if (prod) {
            newItems[index].price = Number(prod.price || 0);
            newItems[index].selected_head = '';

            if ((activeTab === 'sell' || (activeTab === 'exchange' && !isReturned)) && prod.stock_quantity !== undefined) {
               const available = Number(prod.stock_quantity);
               if (newItems[index].quantity > available) {
                  newItems[index].quantity = Math.max(0, available);
               }
            }
         }
      }
      setForm({ ...form, [listName]: newItems });
   };

   const saleSubtotal = form.items.reduce((acc, item) => acc + (Number(item.quantity) * Number(item.price)), 0);
   const returnSubtotal = form.returnedItems.reduce((acc, item) => acc + (Number(item.quantity) * Number(item.price)), 0);

   const subtotal = Math.round((saleSubtotal - returnSubtotal) * 100) / 100;

   const rawDiscount = form.discount_type === 'percentage'
      ? (Math.abs(subtotal) * (Number(form.discount) / 100))
      : Number(form.discount);
   const actualDiscount = Math.round(rawDiscount * 100) / 100;

   const total = subtotal > 0 ? Math.max(0, Math.round((subtotal - actualDiscount) * 100) / 100) : Math.round((subtotal + actualDiscount) * 100) / 100;

   // User can now enter any amount
   const handlePaymentAmountChange = (val: string) => {
      if (val === '') {
         setForm({ ...form, payment_amount: '' });
         return;
      }
      let amt = Number(val);
      if (amt < 0) amt = 0;
      setForm({ ...form, payment_amount: amt });
   };

   // For returns (negative total): remaining credit = |total| - paid. For sales: remaining due = total - paid.
   const remainingCredit = total < 0 ? Math.max(0, Math.abs(total) - Number(form.payment_amount)) : 0;
   const due = total >= 0 ? Math.max(0, total - Number(form.payment_amount)) : 0;

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!form.contact_id || (form.items.length === 0 && form.returnedItems.length === 0)) {
         alert('Please fill out all required fields and select products.');
         return;
      }
      setSubmitting(true);

      try {
         // 1. Create Invoice
         const combinedItems = [
            ...form.items.map(item => ({
               product: item.product_id,
               quantity: Number(item.quantity),
               price: Number(item.price),
               subtotal: Number(item.quantity) * Number(item.price),
               selected_head: item.selected_head || null,
               is_return: false
            })),
            ...form.returnedItems.map(item => ({
               product: item.product_id,
               quantity: Number(item.quantity),
               price: Number(item.price),
               subtotal: Number(item.quantity) * Number(item.price),
               selected_head: item.selected_head || null,
               is_return: true
            }))
         ];

         const invPayload = {
            type: activeTab,
            contact: form.contact_id,
            date: form.date,
            subtotal: subtotal,
            discount: actualDiscount,
            total: total,
            paid_amount: Math.round(Number(form.payment_amount) * 100) / 100,
            due_amount: Math.round((total < 0 ? remainingCredit : due) * 100) / 100,
            payment_status: total < 0
               ? (remainingCredit <= 0 ? 'paid' : (Number(form.payment_amount) > 0 ? 'partial' : 'unpaid'))
               : (due <= 0 ? 'paid' : (Number(form.payment_amount) > 0 ? 'partial' : 'unpaid')),
            authorized_signature: form.authorized_signature,
            received_by: form.received_by,
            items: combinedItems
         };

         const invData = await api.createInvoice(invPayload);

         // 3. Create Payment entry if applicable
         if (Number(form.payment_amount) > 0) {
            // buy = payment goes out, sell = payment comes in, return = payment goes out (refund), exchange = in if total > 0, out if total < 0
            const paymentType = (activeTab === 'sell' || (activeTab === 'exchange' && total > 0)) ? 'in' : 'out';

            let finalPaymentDetails = { ...form.payment_details };
            if (form.payment_method === 'cheque' && activeTab === 'buy') {
               finalPaymentDetails.cheque_type = form.cheque_type;
            }

            const paymentPayload = {
               invoice: invData.id,
               contact: form.contact_id,
               type: paymentType,
               amount: Number(form.payment_amount),
               method: form.payment_method,
               payment_method_details: finalPaymentDetails,
               authorized_signature: form.authorized_signature,
               received_by: form.received_by
            };
            await api.createPayment(paymentPayload);

            // Register Cheque
            if (form.payment_method === 'cheque') {
               await api.createCheck({
                  type: paymentType === 'out' ? 'issued' : 'received',
                  check_number: form.payment_details.cheque_number || 'UNKNOWN',
                  bank_name: form.payment_details.bank_name || 'UNKNOWN',
                  amount: Number(form.payment_amount),
                  issue_date: form.date,
                  cash_date: form.payment_details.cheque_date || form.date,
                  status: 'pending',
                  partner_id: form.contact_id
               });
            }
         }

         // (Inventory Stock adjustment is now handled automatically by the backend serializer)

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
         contact_id: '', date: new Date().toISOString().split('T')[0], items: [{ product_id: '', quantity: '', price: '' as any }] as InvoiceItem[], discount: '' as any, discount_type: 'amount', discount_method: '',
         payment_amount: '' as any, payment_method: 'cash', cheque_type: 'own', payment_details: {}, authorized_signature: '', received_by: '',
         returnedItems: []
      });
   };

   const handleDelete = async (id: string) => {
      if (!window.confirm("Delete this invoice completely?")) return;
      try {
         await api.deleteInvoice(id);
         fetchInvoices();
      } catch (err) { console.error('deleteInvoice:', err); }
   };

   const N = {
      bg: '#0b0f1a', card: '#131929', card2: '#1a2235',
      gold: '#c9a84c', goldBr: '#f0c040', goldFt: 'rgba(201,168,76,.10)',
      border: 'rgba(201,168,76,.18)', borderSub: 'rgba(255,255,255,.06)',
      text: '#e8eaf0', textSub: 'rgba(255,255,255,.45)', textMut: 'rgba(255,255,255,.28)',
      green: '#34d399', red: '#f87171', blue: '#60a5fa', orange: '#fb923c'
   };

   const inp: React.CSSProperties = {
      width: '100%', padding: '9px 12px',
      background: 'rgba(255,255,255,.06)', border: '1px solid ' + N.border,
      borderRadius: 9, color: N.text, fontSize: 13, outline: 'none',
   };
   const lbl: React.CSSProperties = {
      display: 'block', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em',
      color: 'rgba(201,168,76,.65)', marginBottom: 6,
   };

   const renderPaymentDetails = () => {
      if (['bikash', 'nagad', 'rocket', 'upay'].includes(form.payment_method)) {
         return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16, padding: 16, background: 'rgba(255,255,255,.02)', borderRadius: 12, border: '1px solid ' + N.borderSub }}>
               <div style={{ gridColumn: '1/-1' }}>
                  <label style={lbl}>{activeTab === 'sell' ? 'Receiving To (Your Account)' : 'Paying From (Your Account)'}</label>
                  <select required value={form.payment_details.internal_account_id || ''} onChange={e => setForm({ ...form, payment_details: { ...form.payment_details, internal_account_id: e.target.value } })} style={{ ...inp, background: N.card2 }}>
                     <option value="" disabled>Select your {form.payment_method} account</option>
                     {internalAccounts.filter(acc => acc.account_type === 'wallet' && acc.provider_name.toLowerCase() === form.payment_method.toLowerCase()).map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.provider_name} - {acc.account_number} {acc.account_name ? '(' + acc.account_name + ')' : ''}</option>
                     ))}
                  </select>
               </div>
               <div>
                  <label style={lbl}>{activeTab === 'sell' ? "Send Number (Customer's)" : "Received Number (Supplier/Processor's)"}</label>
                  <input required placeholder="+8801..." type="text" value={form.payment_details.number || ''} onChange={e => setForm({ ...form, payment_details: { ...form.payment_details, number: e.target.value } })} style={inp} />
               </div>
               {activeTab !== 'return' && (
                  <div>
                     <label style={lbl}>Transaction ID</label>
                     <input required placeholder="TRX..." type="text" value={form.payment_details.transaction_id || ''} onChange={e => setForm({ ...form, payment_details: { ...form.payment_details, transaction_id: e.target.value } })} style={{ ...inp, fontFamily: 'monospace', textTransform: 'uppercase' }} />
                  </div>
               )}
            </div>
         );
      }

      if (form.payment_method === 'bank_to_bank_transfer') {
         const selectedContact = contacts.find(c => c.id === form.contact_id);
         const contactBanks = selectedContact && Array.isArray(selectedContact.bank_details) ? selectedContact.bank_details : (selectedContact && selectedContact.bank_details && Object.keys(selectedContact.bank_details).length > 0 ? [selectedContact.bank_details] : []);

         return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16, padding: 16, background: 'rgba(255,255,255,.02)', borderRadius: 12, border: '1px solid ' + N.borderSub }}>
               <div>
                  <label style={lbl}>Your Bank Account</label>
                  <select required value={form.payment_details.internal_account_id || ''} onChange={e => {
                     setForm({ ...form, payment_details: { ...form.payment_details, internal_account_id: e.target.value } });
                  }} style={{ ...inp, background: N.card2 }}>
                     <option value="" disabled>Select your Bank Account</option>
                     {internalAccounts.filter(acc => acc.account_type === 'bank').map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.provider_name} - {acc.account_number}</option>
                     ))}
                  </select>
               </div>
               <div>
                  <label style={lbl}>{activeTab === 'sell' ? "Customer's Bank Account" : "Supplier's Bank Account"}</label>
                  <select required value={form.payment_details.bank_name ? form.payment_details.bank_name + '|' + form.payment_details.account_number : '|'} onChange={e => {
                     const val = e.target.value;
                     const selectedBank = contactBanks.find((b: any) => b.bank_name + '|' + b.account_number === val);
                     if (selectedBank) {
                        setForm({ ...form, payment_details: { ...form.payment_details, bank_name: selectedBank.bank_name, account_name: selectedBank.account_name, account_number: selectedBank.account_number, branch: selectedBank.branch } });
                     }
                  }} style={{ ...inp, background: N.card2 }}>
                     <option value="|" disabled>Select Partner Bank Account</option>
                     {contactBanks.map((b: any, idx: number) => {
                        if (!b.bank_name) return null;
                        return <option key={idx} value={b.bank_name + '|' + b.account_number}>{b.bank_name} - {b.account_number}</option>
                     })}
                  </select>
                  {contactBanks.length === 0 && <span style={{ fontSize: 10, color: N.red, fontWeight: 800, marginTop: 4, display: 'block' }}>No banks added to this contact yet. Please add in Contacts manager.</span>}
               </div>

               <div style={{ gridColumn: '1/-1' }}>
                  <label style={lbl}>Transfer Date and Time</label>
                  <input required type="datetime-local" value={form.payment_details.datetime || ''} onChange={e => setForm({ ...form, payment_details: { ...form.payment_details, datetime: e.target.value } })} style={inp} />
               </div>
            </div>
         );
      }

      if (form.payment_method === 'bank_transfer') {
         const selectedContact = contacts.find(c => c.id === form.contact_id);
         const contactBanks = selectedContact && Array.isArray(selectedContact.bank_details) ? selectedContact.bank_details : (selectedContact && selectedContact.bank_details && Object.keys(selectedContact.bank_details).length > 0 ? [selectedContact.bank_details] : []);

         return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16, padding: 16, background: 'rgba(255,255,255,.02)', borderRadius: 12, border: '1px solid ' + N.borderSub }}>
               <div style={{ gridColumn: '1/-1' }}>
                  <label style={lbl}>{activeTab === 'sell' ? "Customer's Bank Account" : "Supplier's Bank Account"}</label>
                  <select required value={form.payment_details.bank_name ? (form.payment_details.bank_name + '|' + form.payment_details.account_number) : '|'} onChange={e => {
                     const val = e.target.value;
                     const selectedBank = contactBanks.find((b: any) => b.bank_name + '|' + b.account_number === val);
                     if (selectedBank) {
                        setForm({ ...form, payment_details: { ...form.payment_details, bank_name: selectedBank.bank_name, account_name: selectedBank.account_name, account_number: selectedBank.account_number, branch: selectedBank.branch } });
                     }
                  }} style={{ ...inp, background: N.card2 }}>
                     <option value="|" disabled>Select Partner Bank Account</option>
                     {contactBanks.map((b: any, idx: number) => {
                        if (!b.bank_name) return null;
                        return <option key={idx} value={b.bank_name + '|' + b.account_number}>{b.bank_name} - {b.account_number}</option>
                     })}
                  </select>
                  {contactBanks.length === 0 && <span style={{ fontSize: 10, color: N.red, fontWeight: 800, marginTop: 4, display: 'block' }}>No banks added to this contact yet. Please add in Contacts manager.</span>}
               </div>
               <div style={{ gridColumn: '1/-1' }}>
                  <label style={lbl}>{activeTab === 'sell' ? "Receive Date and Time" : "Send Date and Time"}</label>
                  <input required type="datetime-local" value={form.payment_details.datetime || ''} onChange={e => setForm({ ...form, payment_details: { ...form.payment_details, datetime: e.target.value } })} style={inp} />
               </div>
            </div>
         );
      }

      if (form.payment_method === 'cheque') {
         const selectedContact = contacts.find(c => c.id === form.contact_id);
         const contactBanks = selectedContact && Array.isArray(selectedContact.bank_details) ? selectedContact.bank_details : (selectedContact && selectedContact.bank_details && Object.keys(selectedContact.bank_details).length > 0 ? [selectedContact.bank_details] : []);

         return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16, padding: 16, background: 'rgba(255,255,255,.02)', borderRadius: 12, border: '1px solid ' + N.borderSub }}>
               <div style={{ gridColumn: '1/-1' }}>
                  <label style={lbl}>{activeTab === 'sell' ? "Customer's Bank Account" : "Supplier's Bank Account"}</label>
                  <select required value={form.payment_details.bank_name ? form.payment_details.bank_name + '|' + form.payment_details.account_number : '|'} onChange={e => {
                     const val = e.target.value;
                     const selectedBank = contactBanks.find((b: any) => b.bank_name + '|' + b.account_number === val);
                     if (selectedBank) {
                        setForm({ ...form, payment_details: { ...form.payment_details, bank_name: selectedBank.bank_name, account_name: selectedBank.account_name, account_number: selectedBank.account_number, branch: selectedBank.branch } });
                     }
                  }} style={{ ...inp, background: N.card2 }}>
                     <option value="|" disabled>Select Partner Bank Account</option>
                     {contactBanks.map((b: any, idx: number) => {
                        if (!b.bank_name) return null;
                        return <option key={idx} value={b.bank_name + '|' + b.account_number}>{b.bank_name} - {b.account_number}</option>
                     })}
                  </select>
                  {contactBanks.length === 0 && <span style={{ fontSize: 10, color: N.red, fontWeight: 800, marginTop: 4, display: 'block' }}>No banks added to this contact yet. Please add in Contacts manager.</span>}
               </div>
               <div>
                  <label style={lbl}>Cheque Number</label>
                  <input required type="text" value={form.payment_details.cheque_number || ''} onChange={e => setForm({ ...form, payment_details: { ...form.payment_details, cheque_number: e.target.value } })} style={{ ...inp, fontFamily: 'monospace' }} />
               </div>
               <div>
                  <label style={lbl}>Cheque Date</label>
                  <input required type="date" value={form.payment_details.cheque_date || ''} onChange={e => setForm({ ...form, payment_details: { ...form.payment_details, cheque_date: e.target.value } })} style={inp} />
               </div>
            </div>
         );
      }

      return null;
   };

   // --------------------------------------------------------
   // LOGIC: Filter products specifically for dropdowns
   // --------------------------------------------------------
   const availableProducts = products.filter(p => {
      const pType = String(p.type || p.category || '').toLowerCase();
      if (activeTab === 'buy') {
         return pType.includes('raw'); // Only allow raw materials in Buy
      } else if (activeTab === 'sell' || activeTab === 'return' || activeTab === 'exchange') {
         return pType.includes('finish'); // Only allow finished goods in Sell, Return & Exchange
      }
      return true; // Fallback filter just in case 'type' is missing/different
   });

   return (
      <div className="pb-12 dropdown-container" style={{ fontFamily: "'Inter', sans-serif" }}>
         <div style={{
            background: 'linear-gradient(135deg, #0e1628, #131929)',
            border: '1px solid ' + N.border,
            borderRadius: 16,
            padding: '24px 30px',
            marginBottom: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            gap: 16
         }}>
            <div>
               <p style={{ color: N.gold, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText style={{ width: 14, height: 14 }} /> Comprehensive Invoicing Engine
               </p>
               <h1 style={{ fontSize: 24, fontWeight: 900, color: N.goldBr, margin: '0 0 6px' }}>
                  {activeTab === 'buy' ? 'Purchases (Buy)' : activeTab === 'sell' ? 'Sales (Sell)' : 'Sales Returns (Exchange)'}
               </h1>
               <p style={{ color: N.textSub, fontSize: 13, margin: 0 }}>
                  {activeTab === 'buy' ? 'Record vendor purchases, process upfront payments.' :
                     activeTab === 'sell' ? 'Generate customer invoices and track revenue.' :
                        'Process item exchange: items returned vs items issued.'}
               </p>
            </div>

            {!showBuilder && (
               <button onClick={() => { resetForm(); setShowBuilder(true); }}
                  style={{
                     display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10,
                     border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, ' + N.gold + ', ' + N.goldBr + ')',
                     color: '#0a0900', fontWeight: 800, fontSize: 13, boxShadow: '0 4px 14px rgba(201,168,76,.35)'
                  }}>
                  <Plus style={{ width: 16, height: 16 }} />
                  Create {activeTab === 'buy' ? 'Purchase' : activeTab === 'sell' ? 'Sale' : 'Return/Exchange'}
               </button>
            )}
         </div>

         {!showBuilder && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, overflowX: 'auto', paddingBottom: 10 }}>
               {[
                  { id: 'buy', name: 'Purchase (Buy)', icon: ShoppingCart },
                  { id: 'sell', name: 'Sales (Sell)', icon: FileText },
                  { id: 'exchange', name: 'Sales Returns', icon: ArrowLeftRight },
               ].map(t => (
                  <button key={t.id} onClick={() => {
                     setActiveTab(t.id as any);
                     router.push(`/invoices?tab=${t.id}`);
                  }} style={{
                     display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 12, border: '1px solid ' + (activeTab === t.id ? N.gold : N.borderSub),
                     background: activeTab === t.id ? 'rgba(201,168,76,.15)' : N.card, color: activeTab === t.id ? N.goldBr : N.textSub,
                     fontSize: 13, fontWeight: 800, cursor: 'pointer', transition: 'all .2s', whiteSpace: 'nowrap'
                  }}>
                     <t.icon style={{ width: 14, height: 14 }} />
                     {t.name}
                  </button>
               ))}
            </div>
         )}

         {!showBuilder ? (
            <div style={{ background: N.card, border: '1px solid ' + N.borderSub, borderRadius: 14, overflow: 'hidden' }}>
               <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                     <thead>
                        <tr style={{ background: 'rgba(201,168,76,.06)' }}>
                           <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: N.gold, textTransform: 'uppercase', letterSpacing: '.07em', borderBottom: '1px solid rgba(201,168,76,.12)' }}>Invoice ID / Date</th>
                           <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: N.gold, textTransform: 'uppercase', letterSpacing: '.07em', borderBottom: '1px solid rgba(201,168,76,.12)' }}>{activeTab === 'buy' ? 'Supplier' : 'Customer'}</th>
                           <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: N.gold, textTransform: 'uppercase', letterSpacing: '.07em', borderBottom: '1px solid rgba(201,168,76,.12)' }}>Total Value</th>
                           <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: N.gold, textTransform: 'uppercase', letterSpacing: '.07em', borderBottom: '1px solid rgba(201,168,76,.12)' }}>Payment Status</th>
                           <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: 11, fontWeight: 800, color: N.gold, textTransform: 'uppercase', letterSpacing: '.07em', borderBottom: '1px solid rgba(201,168,76,.12)' }}>Actions</th>
                        </tr>
                     </thead>
                     <tbody>
                        {invoices.length === 0 && (
                           <tr>
                              <td colSpan={5} style={{ padding: '56px 20px', textAlign: 'center' }}>
                                 <FileText style={{ width: 34, height: 34, color: 'rgba(201,168,76,.18)', margin: '0 auto 10px' }} />
                                 <p style={{ fontSize: 14, color: N.textMut, fontWeight: 600, margin: 0 }}>No records found for {activeTab}</p>
                              </td>
                           </tr>
                        )}
                        {invoices.map((inv, i) => (
                           <tr key={inv.id}
                              onClick={() => setViewingInvoice(inv)}
                              style={{ borderBottom: i < invoices.length - 1 ? '1px solid ' + N.borderSub : 'none', transition: 'background .12s', cursor: 'pointer' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(201,168,76,.04)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              <td style={{ padding: '13px 20px' }}>
                                 <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 800, color: N.text }}>#{inv.id.substring(0, 8).toUpperCase()}</span>
                                 <div style={{ fontSize: 11, color: N.textSub, marginTop: 2 }}>{new Date(inv.date).toLocaleDateString()}</div>
                              </td>
                              <td style={{ padding: '13px 20px' }}>
                                 <span style={{ fontWeight: 800, color: N.goldBr, fontSize: 13 }}>{inv.contact_details?.name || inv.contacts?.name || 'Unknown'}</span>
                                 {(inv.contact_details?.shop_name || inv.contacts?.shop_name) && <span style={{ display: 'block', fontSize: 11, color: 'rgba(201,168,76,.6)' }}>{inv.contact_details?.shop_name || inv.contacts?.shop_name}</span>}
                              </td>
                              <td style={{ padding: '13px 20px', fontWeight: 900, color: N.text, fontSize: 14 }}>
                                 ৳ {Number(inv.total).toLocaleString()}
                              </td>
                              <td style={{ padding: '13px 20px' }}>
                                 <span style={{
                                    display: 'inline-flex', padding: '3px 9px', borderRadius: 999, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em',
                                    background: inv.payment_status === 'paid' ? 'rgba(52,211,153,.1)' : inv.payment_status === 'partial' ? 'rgba(201,168,76,.1)' : 'rgba(248,113,113,.1)',
                                    color: inv.payment_status === 'paid' ? N.green : inv.payment_status === 'partial' ? N.gold : N.red,
                                    border: '1px solid ' + (inv.payment_status === 'paid' ? 'rgba(52,211,153,.2)' : inv.payment_status === 'partial' ? 'rgba(201,168,76,.2)' : 'rgba(248,113,113,.2)')
                                 }}>
                                    {inv.payment_status}
                                 </span>
                                 {Number(inv.due_amount) > 0 && <div style={{ fontSize: 10, color: N.red, fontWeight: 800, marginTop: 4 }}>Due: ৳ {inv.due_amount}</div>}
                              </td>
                              <td style={{ padding: '13px 20px', textAlign: 'right' }}>
                                 <div style={{ display: 'inline-flex', gap: 4 }}>
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(inv.id); }} title="Delete"
                                       style={{ padding: '6px 8px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', color: 'rgba(255,255,255,.3)', transition: 'all .12s' }}
                                       onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,.1)'; e.currentTarget.style.color = N.red; }}
                                       onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,.3)'; }}>
                                       <Trash2 style={{ width: 15, height: 15 }} />
                                    </button>
                                 </div>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
         ) : (
            <div style={{ background: N.card, border: '1px solid ' + N.border, borderRadius: 16, overflow: 'hidden', padding: 24 }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: N.goldBr, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                     <Calculator style={{ width: 18, height: 18 }} />
                     New {activeTab === 'buy' ? 'Purchase Invoice' : activeTab === 'sell' ? 'Sales Invoice' : 'Sales Return / Exchange Memo'}
                  </h2>
                  <button onClick={() => setShowBuilder(false)}
                     style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.6)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                     Cancel
                  </button>
               </div>

               <form onSubmit={handleSubmit}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24, padding: 16, background: 'rgba(255,255,255,.02)', borderRadius: 12, border: '1px solid ' + N.borderSub }}>
                     <div style={{ gridColumn: '1 / -1' }}>
                        <label style={lbl}><FileText style={{ width: 12, height: 12, display: 'inline-block', marginRight: 4 }} /> Memo no</label>
                        <input type="text" disabled value="[ Auto-generated upon save ]" style={{ ...inp, color: N.textMut, background: 'transparent', border: '1px dashed ' + N.borderSub, cursor: 'not-allowed' }} />
                     </div>
                     <div>
                        <label style={lbl}>{activeTab === 'buy' ? 'Supplier *' : 'Customer *'}</label>
                        <select required value={form.contact_id} onChange={e => setForm({ ...form, contact_id: e.target.value })} style={{ ...inp, background: N.card2 }}>
                           <option value="" disabled>-- Select {activeTab === 'buy' ? 'Supplier' : 'Customer'} --</option>
                           {contacts.map(c => <option key={c.id} value={c.id}>{c.name} {c.shop_name ? '(' + c.shop_name + ')' : ''}</option>)}
                        </select>
                     </div>
                     <div>
                        <label style={lbl}>Date *</label>
                        <input required type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={inp} />
                     </div>
                  </div>

                  <div style={{ marginBottom: 24 }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 800, color: N.green, margin: 0, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                           {activeTab === 'exchange' ? '1. New Items Given (Sale)' : 'Items'}
                        </h3>
                     </div>

                     <div style={{ background: N.card2, border: '1px solid ' + N.borderSub, borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
                        <div style={{ overflowX: 'auto' }}>
                           <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                              <thead>
                                 <tr style={{ background: 'rgba(201,168,76,.08)' }}>
                                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: N.gold, textTransform: 'uppercase', borderBottom: '1px solid ' + N.borderSub }}>Product</th>
                                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: N.gold, textTransform: 'uppercase', width: 140, borderBottom: '1px solid ' + N.borderSub }}>Variant/Head</th>
                                    <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 10, fontWeight: 800, color: N.gold, textTransform: 'uppercase', width: 100, borderBottom: '1px solid ' + N.borderSub }}>Quantity</th>
                                    <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 10, fontWeight: 800, color: N.gold, textTransform: 'uppercase', width: 140, borderBottom: '1px solid ' + N.borderSub }}>Unit Price (৳)</th>
                                    <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 10, fontWeight: 800, color: N.gold, textTransform: 'uppercase', width: 120, borderBottom: '1px solid ' + N.borderSub }}>Subtotal (৳)</th>
                                    <th style={{ padding: '10px 14px', width: 50, borderBottom: '1px solid ' + N.borderSub }}></th>
                                 </tr>
                              </thead>
                              <tbody>
                                 {form.items.map((item, index) => {
                                    const selProd = products.find(p => p.id === item.product_id);
                                    return (
                                       <tr key={index} style={{ borderBottom: index < form.items.length - 1 ? '1px solid ' + N.borderSub : 'none' }}>
                                          <td style={{ padding: '10px 14px' }}>
                                             <select required value={item.product_id} onChange={e => handleItemChange(index, 'product_id', e.target.value)} style={{ ...inp, padding: '7px 10px', fontSize: 12, background: 'rgba(255,255,255,.03)' }}>
                                                <option value="" disabled>Select Product</option>
                                                {availableProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                             </select>
                                          </td>
                                          <td style={{ padding: '10px 14px' }}>
                                             {(selProd?.product_heads && Array.isArray(selProd.product_heads) && selProd.product_heads.length > 0) ? (
                                                <select value={item.selected_head || ''} onChange={e => handleItemChange(index, 'selected_head', e.target.value)} style={{ ...inp, padding: '7px 10px', fontSize: 12, background: 'rgba(255,255,255,.03)' }}>
                                                   <option value="">No Variant</option>
                                                   {selProd.product_heads.map((h: string, hi: number) => <option key={hi} value={h}>{h}</option>)}
                                                </select>
                                             ) : (
                                                <span style={{ fontSize: 11, color: N.textMut, paddingLeft: 8 }}>N/A</span>
                                             )}
                                          </td>
                                          <td style={{ padding: '10px 14px' }}>
                                             <input required type="number" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value === '' ? '' : Number(e.target.value))} style={{ ...inp, padding: '7px 10px', fontSize: 12, textAlign: 'right', background: 'rgba(255,255,255,.03)' }} />
                                          </td>
                                          <td style={{ padding: '10px 14px' }}>
                                             <input required type="number" step="0.01" value={item.price} onChange={e => handleItemChange(index, 'price', e.target.value === '' ? '' : Number(e.target.value))} style={{ ...inp, padding: '7px 10px', fontSize: 12, textAlign: 'right', background: 'rgba(255,255,255,.03)' }} />
                                          </td>
                                          <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, fontWeight: 800, color: N.text }}>
                                             {(Number(item.quantity) * Number(item.price)).toFixed(2)}
                                          </td>
                                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                             <button type="button" onClick={() => handleRemoveItem(index)} disabled={activeTab !== 'exchange' && form.items.length === 1}
                                                style={{ padding: '6px', borderRadius: 6, border: 'none', background: (activeTab !== 'exchange' && form.items.length === 1) ? 'transparent' : 'rgba(248,113,113,.1)', color: (activeTab !== 'exchange' && form.items.length === 1) ? N.textMut : N.red, cursor: (activeTab !== 'exchange' && form.items.length === 1) ? 'not-allowed' : 'pointer' }}>
                                                <Trash2 style={{ width: 14, height: 14 }} />
                                             </button>
                                          </td>
                                       </tr>
                                    );
                                 })}
                              </tbody>
                           </table>
                        </div>
                        <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,.01)' }}>
                           <button type="button" onClick={handleAddItem}
                              style={{ padding: '7px 14px', borderRadius: 8, border: '1px dashed ' + N.border, background: 'rgba(201,168,76,.05)', color: N.gold, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center' }}>
                              <Plus style={{ width: 14, height: 14 }} /> Add Row
                           </button>
                        </div>
                     </div>

                     {activeTab === 'exchange' && (
                        <div style={{ marginBottom: 24, marginTop: 32 }}>
                           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                              <h3 style={{ fontSize: 14, fontWeight: 800, color: N.red, margin: 0, textTransform: 'uppercase', letterSpacing: '.05em' }}>2. Items Received Back (Return)</h3>
                           </div>

                           <div style={{ background: N.card2, border: '1px solid ' + N.borderSub, borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
                              <div style={{ overflowX: 'auto' }}>
                                 <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                                    <thead>
                                       <tr style={{ background: 'rgba(248,113,113,.08)' }}>
                                          <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: N.red, textTransform: 'uppercase', borderBottom: '1px solid ' + N.borderSub }}>Product</th>
                                          <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: N.red, textTransform: 'uppercase', width: 140, borderBottom: '1px solid ' + N.borderSub }}>Variant/Head</th>
                                          <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 10, fontWeight: 800, color: N.red, textTransform: 'uppercase', width: 100, borderBottom: '1px solid ' + N.borderSub }}>Quantity</th>
                                          <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 10, fontWeight: 800, color: N.red, textTransform: 'uppercase', width: 140, borderBottom: '1px solid ' + N.borderSub }}>Unit Price (৳)</th>
                                          <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 10, fontWeight: 800, color: N.red, textTransform: 'uppercase', width: 120, borderBottom: '1px solid ' + N.borderSub }}>Credit (৳)</th>
                                          <th style={{ padding: '10px 14px', width: 50, borderBottom: '1px solid ' + N.borderSub }}></th>
                                       </tr>
                                    </thead>
                                    <tbody>
                                       {form.returnedItems.map((item, index) => {
                                          const selProd = products.find(p => p.id === item.product_id);
                                          return (
                                             <tr key={index} style={{ borderBottom: index < form.returnedItems.length - 1 ? '1px solid ' + N.borderSub : 'none' }}>
                                                <td style={{ padding: '10px 14px' }}>
                                                   <select required value={item.product_id} onChange={e => handleItemChange(index, 'product_id', e.target.value, true)} style={{ ...inp, padding: '7px 10px', fontSize: 12, background: 'rgba(255,255,255,.03)' }}>
                                                      <option value="" disabled>Select Product</option>
                                                      {availableProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                   </select>
                                                </td>
                                                <td style={{ padding: '10px 14px' }}>
                                                   {(selProd?.product_heads && Array.isArray(selProd.product_heads) && selProd.product_heads.length > 0) ? (
                                                      <select value={item.selected_head || ''} onChange={e => handleItemChange(index, 'selected_head', e.target.value, true)} style={{ ...inp, padding: '7px 10px', fontSize: 12, background: 'rgba(255,255,255,.03)' }}>
                                                         <option value="">No Variant</option>
                                                         {selProd.product_heads.map((h: string, hi: number) => <option key={hi} value={h}>{h}</option>)}
                                                      </select>
                                                   ) : (
                                                      <span style={{ fontSize: 11, color: N.textMut, paddingLeft: 8 }}>N/A</span>
                                                   )}
                                                </td>
                                                <td style={{ padding: '10px 14px' }}>
                                                   <input required type="number" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value === '' ? '' : Number(e.target.value), true)} style={{ ...inp, padding: '7px 10px', fontSize: 12, textAlign: 'right', background: 'rgba(255,255,255,.03)' }} />
                                                </td>
                                                <td style={{ padding: '10px 14px' }}>
                                                   <input required type="number" step="0.01" value={item.price} onChange={e => handleItemChange(index, 'price', e.target.value === '' ? '' : Number(e.target.value), true)} style={{ ...inp, padding: '7px 10px', fontSize: 12, textAlign: 'right', background: 'rgba(255,255,255,.03)' }} />
                                                </td>
                                                <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, fontWeight: 800, color: N.text }}>
                                                   {(Number(item.quantity) * Number(item.price)).toFixed(2)}
                                                </td>
                                                <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                                   <button type="button" onClick={() => handleRemoveReturnedItem(index)}
                                                      style={{ padding: '6px', borderRadius: 6, border: 'none', background: 'rgba(248,113,113,.1)', color: N.red, cursor: 'pointer' }}>
                                                      <Trash2 style={{ width: 14, height: 14 }} />
                                                   </button>
                                                </td>
                                             </tr>
                                          );
                                       })}
                                       {form.returnedItems.length === 0 && (
                                          <tr>
                                             <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: N.textMut, fontSize: 12 }}>No items added to return list.</td>
                                          </tr>
                                       )}
                                    </tbody>
                                 </table>
                              </div>
                              <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,.01)' }}>
                                 <button type="button" onClick={handleAddReturnedItem}
                                    style={{ padding: '7px 14px', borderRadius: 8, border: '1px dashed ' + N.red, background: 'rgba(248,113,113,.05)', color: N.red, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <Plus style={{ width: 14, height: 14 }} /> Add Return Item
                                 </button>
                              </div>
                           </div>
                        </div>
                     )}

                     <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <div style={{ width: '100%', maxWidth: 360, background: 'rgba(201,168,76,.04)', border: '1px solid ' + N.border, borderRadius: 12, padding: 16 }}>
                           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 13 }}>
                              <span style={{ color: N.textSub }}>{activeTab === 'exchange' ? 'Net Subtotal (New - Return):' : 'Subtotal:'}</span>
                              <span style={{ fontWeight: 800, color: subtotal >= 0 ? N.text : N.red, fontFamily: 'monospace' }}>৳ {subtotal.toFixed(2)}</span>
                           </div>
                           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: N.gold, fontSize: 13, fontWeight: 700 }}>
                                 <input type="checkbox" checked={hasDiscount} onChange={e => { setHasDiscount(e.target.checked); if (!e.target.checked) setForm({ ...form, discount: 0 }); }} style={{ accentColor: N.gold }} />
                                 Apply Discount
                              </label>
                              {hasDiscount && (
                                 <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <select value={form.discount_type} onChange={e => setForm({ ...form, discount_type: e.target.value })} style={{ ...inp, width: 60, padding: '4px 6px', fontSize: 11, background: N.card2 }}>
                                       <option value="amount">৳</option>
                                       <option value="percentage">%</option>
                                    </select>
                                    <input type="number" placeholder="Amt" value={form.discount} onChange={e => setForm({ ...form, discount: e.target.value === '' ? '' : Number(e.target.value) })} style={{ ...inp, width: 70, padding: '4px 8px', fontSize: 12, textAlign: 'right', background: N.card2 }} />
                                    {form.discount_type === 'percentage' && Number(form.discount) > 0 && (
                                       <span style={{ fontSize: 13, color: N.gold, fontWeight: 800, whiteSpace: 'nowrap' }}>
                                          (-৳ {actualDiscount.toFixed(2)})
                                       </span>
                                    )}
                                 </div>
                              )}
                           </div>
                           {activeTab === 'exchange' && total < 0 ? (
                              <div style={{ paddingTop: 12, borderTop: '1px solid ' + N.borderSub }}>
                                 <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
                                    <span style={{ color: N.textSub }}>Return Credit:</span>
                                    <span style={{ fontWeight: 800, color: N.red, fontFamily: 'monospace' }}>৳ {Math.abs(total).toFixed(2)}</span>
                                 </div>
                                 {hasPayment && Number(form.payment_amount) > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
                                       <span style={{ color: N.textSub }}>Cash Refund (Out):</span>
                                       <span style={{ fontWeight: 800, color: N.orange, fontFamily: 'monospace' }}>- ৳ {Number(form.payment_amount).toFixed(2)}</span>
                                    </div>
                                 )}
                                 <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px dashed ' + N.borderSub, fontSize: 15, fontWeight: 900 }}>
                                    <span style={{ color: N.text }}>Net Credit to Account:</span>
                                    <span style={{ color: N.green, fontFamily: 'monospace' }}>৳ {remainingCredit.toFixed(2)}</span>
                                 </div>
                                 <p style={{ fontSize: 10, color: N.textMut, marginTop: 6, textAlign: 'right' }}>
                                    {previousDue > 0
                                       ? `Will reduce customer due: ৳${previousDue.toFixed(2)} → ৳${Math.max(0, previousDue - Math.abs(total) - Number(form.payment_amount || 0)).toFixed(2)}`
                                       : `Will be added to customer advance`}
                                 </p>
                              </div>
                           ) : (
                              <>
                                 <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid ' + N.borderSub, fontSize: 15, fontWeight: 900 }}>
                                    <span style={{ color: N.text }}>{previousDue > 0 ? 'Current Total:' : 'Total:'}</span>
                                    <span style={{ color: N.goldBr, fontFamily: 'monospace' }}>৳ {total.toFixed(2)}</span>
                                 </div>
                                 {previousDue > 0 && (
                                    <>
                                       <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 13, color: N.textSub }}>
                                          <span>Previous Due:</span>
                                          <span style={{ color: N.red, fontWeight: 800, fontFamily: 'monospace' }}>৳ {previousDue.toFixed(2)}</span>
                                       </div>
                                       <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, marginTop: 10, borderTop: '1px dashed ' + N.borderSub, fontSize: 16, fontWeight: 900 }}>
                                          <span style={{ color: N.text }}>Grand Total:</span>
                                          <span style={{ color: N.goldBr, fontFamily: 'monospace' }}>৳ {(total + previousDue).toFixed(2)}</span>
                                       </div>
                                    </>
                                 )}
                              </>
                           )}
                        </div>
                     </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
                     <div style={{ flex: '1 1 300px', background: 'rgba(255,255,255,.02)', border: '1px solid ' + N.borderSub, borderRadius: 12, padding: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                           <input type="checkbox" checked={hasPayment} onChange={e => { setHasPayment(e.target.checked); setForm({ ...form, payment_amount: e.target.checked ? total : 0 }); }} id="pay-cb" style={{ accentColor: N.gold, width: 16, height: 16 }} />
                           <label htmlFor="pay-cb" style={{ fontSize: 14, fontWeight: 800, color: N.text, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Wallet style={{ width: 16, height: 16, color: N.gold }} /> Register Payment
                           </label>
                        </div>
                        {hasPayment && (
                           <div style={{ background: 'rgba(201,168,76,.03)', padding: 14, borderRadius: 10, border: '1px solid ' + N.border }}>
                              <label style={lbl}>{activeTab === 'buy' ? 'Paid Upfront Amount' : activeTab === 'sell' ? 'Received Amount' : 'Refund Amount'}</label>
                              <div style={{ position: 'relative', marginBottom: 16 }}>
                                 <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontWeight: 900, color: N.gold }}>৳</span>
                                 <input type="number" min="0" value={form.payment_amount === 0 && !hasPayment ? '' : form.payment_amount} onChange={e => handlePaymentAmountChange(e.target.value)}
                                    style={{ ...inp, paddingLeft: 34, fontSize: 18, fontWeight: 900, color: N.goldBr, background: N.card2 }} />
                              </div>
                              {due > 0 && <p style={{ fontSize: 11, fontWeight: 800, color: N.red, textAlign: 'right', marginTop: -10, marginBottom: 14 }}>Remaining Due: ৳ {due.toFixed(2)}</p>}
                              {total < 0 && Number(form.payment_amount) > 0 && (
                                 <p style={{ fontSize: 11, fontWeight: 800, color: N.green, textAlign: 'right', marginTop: -10, marginBottom: 14 }}>
                                    Remaining Credit to Customer: ৳ {Math.abs(total + Number(form.payment_amount)).toFixed(2)}
                                 </p>
                              )}

                              <label style={lbl}>Payment Method</label>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8, marginBottom: 16 }}>
                                 {['cash', 'bikash', 'nagad', 'rocket', 'upay', 'bank_transfer', 'bank_to_bank_transfer', 'cheque'].map(m => (
                                    <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 8, background: form.payment_method === m ? 'rgba(201,168,76,.15)' : 'rgba(255,255,255,.04)', border: '1px solid ' + (form.payment_method === m ? N.gold : N.borderSub), cursor: 'pointer' }}>
                                       <input type="radio" value={m} checked={form.payment_method === m} onChange={() => setForm({ ...form, payment_method: m as PaymentMethod })} style={{ display: 'none' }} />
                                       <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: form.payment_method === m ? N.goldBr : N.textSub }}>{m.replace(/_/g, ' ')}</span>
                                    </label>
                                 ))}
                              </div>

                              <div style={{ borderTop: '1px solid ' + N.borderSub, marginTop: 16 }}>
                                 {renderPaymentDetails()}
                              </div>
                           </div>
                        )}
                     </div>

                     <div style={{ flex: '1 1 300px', background: 'rgba(255,255,255,.02)', border: '1px solid ' + N.borderSub, borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ fontSize: 14, fontWeight: 800, color: N.text, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}><PenTool style={{ width: 15, height: 15, color: N.gold }} /> Signatures</h3>
                        <div style={{ marginBottom: 16 }}>
                           <label style={lbl}>Authorized By *</label>
                           <select required value={form.authorized_signature} onChange={e => setForm({ ...form, authorized_signature: e.target.value })} style={{ ...inp, background: N.card2 }}>
                              <option value="" disabled>-- Select Employee --</option>
                              {employees.filter(emp => emp.is_authorizer).map(emp => <option key={emp.id} value={emp.name}>{emp.name}</option>)}
                           </select>
                        </div>
                        <div style={{ marginBottom: 24 }}>
                           <label style={lbl}>Received / Handled By *</label>
                           <input required type="text" placeholder="e.g. Courier or Employee Name" value={form.received_by} onChange={e => setForm({ ...form, received_by: e.target.value })} style={inp} />
                        </div>

                        <div style={{ marginTop: 'auto' }}>
                           <button type="submit" disabled={submitting}
                              style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, ' + N.gold + ', ' + N.goldBr + ')', color: '#0a0900', fontWeight: 900, fontSize: 15, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, boxShadow: '0 4px 14px rgba(201,168,76,.35)', opacity: submitting ? .6 : 1 }}>
                              <CheckCircle style={{ width: 20, height: 20 }} />
                              {submitting ? 'Processing...' : (activeTab === 'buy' ? 'Confirm Purchase' : activeTab === 'sell' ? 'Confirm Sale' : 'Complete Return/Exchange')}
                           </button>
                        </div>
                     </div>
                  </div>
               </form>
            </div>
         )}

         {viewingInvoice && <InvoiceViewModal invoice={viewingInvoice} onClose={() => setViewingInvoice(null)} />}
      </div>
   );
}

function InvoiceViewModal({ invoice, onClose }: { invoice: any, onClose: () => void }) {
   const [items, setItems] = useState<any[]>([]);
   const [loading, setLoading] = useState(true);

   const N = {
      bg: '#0b0f1a', card: '#131929', card2: '#1a2235',
      gold: '#c9a84c', goldBr: '#f0c040', goldFt: 'rgba(201,168,76,.10)',
      border: 'rgba(201,168,76,.18)', borderSub: 'rgba(255,255,255,.06)',
      text: '#e8eaf0', textSub: 'rgba(255,255,255,.45)', textMut: 'rgba(255,255,255,.28)',
      green: '#34d399', red: '#f87171', blue: '#60a5fa', orange: '#fb923c'
   };

   useEffect(() => {
      async function fetchDetails() {
         try {
            const data = await api.getInvoiceItems(invoice.id);
            setItems(Array.isArray(data) ? data : data.results ?? []);
         } catch (e) {
            console.error('fetchDetails error:', e);
         } finally {
            setLoading(false);
         }
      }
      fetchDetails();
   }, [invoice.id]);

   const handlePrintInvoice = () => { window.print(); };

   return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(5px)', padding: 16 }}>
         <style>{`
            @media print {
               body * { visibility: hidden; }
               #printable-memo, #printable-memo * { visibility: visible; }
               #printable-memo { position: absolute; left: 0; top: 0; width: 100%; color: black !important; background: white !important; }
               .no-print { display: none !important; }
            }
         `}</style>

         <div className="invoice-memo-container" style={{ background: N.card, border: '1px solid ' + N.border, borderRadius: 20, width: '100%', maxWidth: 840, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,.8)', overflow: 'hidden' }}>
            <div className="no-print" style={{ padding: '20px 24px', background: 'linear-gradient(135deg, rgba(201,168,76,.15), rgba(201,168,76,.05))', borderBottom: '1px solid ' + N.border, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <div>
                  <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em', color: N.gold }}>
                     {invoice.type === 'buy' ? 'Purchase Invoice' : invoice.type === 'sell' ? 'Sales Invoice' : 'Return Invoice'}
                  </p>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: N.text, display: 'flex', alignItems: 'center', gap: 10 }}>
                     <FileText style={{ width: 20, height: 20, color: N.goldBr }} /> #{invoice.id.substring(0, 8).toUpperCase()}
                  </h2>
               </div>
               <button onClick={onClose} style={{ background: 'rgba(255,255,255,.05)', border: 'none', borderRadius: 10, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: N.textMut }}>
                  <X size={18} />
               </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 40, background: 'white', color: 'black' }} id="printable-memo">
               {/* --- MEMO HEADER --- */}
               <div style={{ textAlign: 'center', marginBottom: 40, borderBottom: '3px solid black', paddingBottom: 20 }}>
                  <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900, letterSpacing: '4px', textTransform: 'uppercase' }}>MEMORANDUM</h1>
                  <p style={{ margin: '8px 0', fontSize: 14, fontWeight: 700 }}>{invoice.type === 'sell' ? 'Sales Invoice' : invoice.type === 'buy' ? 'Purchase Record' : 'Return Credit Note'}</p>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 10, fontSize: 12 }}>
                     <span><strong>ID:</strong> #{invoice.id.substring(0, 12).toUpperCase()}</span>
                     <span><strong>DATE:</strong> {new Date(invoice.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                  </div>
               </div>

               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginBottom: 40 }}>
                  <div>
                     <h3 style={{ margin: '0 0 10px', fontSize: 12, textTransform: 'uppercase', color: '#666' }}>{invoice.type === 'buy' ? 'Vendor / Supplier:' : 'Bill To / Customer:'}</h3>
                     <p style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>{invoice.contact_details?.name || invoice.contacts?.name || 'Walk-in Customer'}</p>
                     <p style={{ margin: '4px 0', fontSize: 14 }}>{invoice.contact_details?.shop_name || invoice.contacts?.shop_name || ''}</p>
                     <p style={{ margin: 0, fontSize: 14 }}>{invoice.contact_details?.phone || invoice.contacts?.phone || ''}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                     <h3 style={{ margin: '0 0 10px', fontSize: 12, textTransform: 'uppercase', color: '#666' }}>Payment Summary:</h3>
                     <p style={{ margin: 0, fontSize: 16 }}>Status: <strong style={{ color: invoice.payment_status === 'paid' ? 'green' : 'red' }}>{invoice.payment_status.toUpperCase()}</strong></p>
                     <p style={{ margin: '4px 0', fontSize: 14 }}>Method: {invoice.payment_method?.toUpperCase() || 'CASH'}</p>
                  </div>
               </div>

               <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 40 }}>
                  <thead>
                     <tr style={{ borderBottom: '2px solid black' }}>
                        <th style={{ padding: '12px 0', textAlign: 'left', fontSize: 12, textTransform: 'uppercase' }}>Description</th>
                        <th style={{ padding: '12px 0', textAlign: 'right', fontSize: 12, textTransform: 'uppercase', width: 80 }}>Qty</th>
                        <th style={{ padding: '12px 0', textAlign: 'right', fontSize: 12, textTransform: 'uppercase', width: 120 }}>Unit Price</th>
                        <th style={{ padding: '12px 0', textAlign: 'right', fontSize: 12, textTransform: 'uppercase', width: 140 }}>Amount</th>
                     </tr>
                  </thead>
                  <tbody>
                     {items.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                           <td style={{ padding: '12px 0', fontSize: 14 }}>
                              <div style={{ fontWeight: 700 }}>{item.product_name}</div>
                              {item.selected_head && <div style={{ fontSize: 12, color: '#666' }}>Variant: {item.selected_head}</div>}
                           </td>
                           <td style={{ padding: '12px 0', textAlign: 'right', fontSize: 14 }}>{item.quantity}</td>
                           <td style={{ padding: '12px 0', textAlign: 'right', fontSize: 14 }}>৳{Number(item.price).toLocaleString()}</td>
                           <td style={{ padding: '12px 0', textAlign: 'right', fontSize: 14, fontWeight: 700 }}>৳{Number(item.subtotal).toLocaleString()}</td>
                        </tr>
                     ))}
                  </tbody>
               </table>

               <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 60 }}>
                  <div style={{ width: 300 }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
                        <span>Subtotal:</span>
                        <span>৳{Number(invoice.subtotal).toLocaleString()}</span>
                     </div>
                     {Number(invoice.discount) > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14, color: 'red' }}>
                           <span>Discount:</span>
                           <span>- ৳{Number(invoice.discount).toLocaleString()}</span>
                        </div>
                     )}
                     <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '2px solid black', marginTop: 10, fontWeight: 900, fontSize: 20 }}>
                        <span>{Number(invoice.total) < 0 ? 'Total Credit:' : 'Total:'}</span>
                        <span style={{ color: Number(invoice.total) < 0 ? '#c00' : 'black' }}>
                           ৳{Math.abs(Number(invoice.total)).toLocaleString()}
                        </span>
                     </div>
                     {Number(invoice.paid_amount) > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14, fontWeight: 700, color: 'green' }}>
                           <span>{Number(invoice.total) < 0 ? 'Refund Paid (Cash):' : 'Amount Paid:'}</span>
                           <span>৳{Number(invoice.paid_amount).toLocaleString()}</span>
                        </div>
                     )}
                     {(() => {
                        const t = Number(invoice.total);
                        const p = Number(invoice.paid_amount);
                        if (t < 0) {
                           const credit = Math.abs(t) - p;
                           return credit > 0 ? (
                              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', fontSize: 14, fontWeight: 700, color: '#1a6b3c', background: '#f0fff4', borderRadius: 6, marginTop: 6 }}>
                                 <span>✅ Added to Customer Advance:</span>
                                 <span>৳{credit.toLocaleString()}</span>
                              </div>
                           ) : null;
                        }
                        return t >= 0 && p < t ? (
                           <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14, fontWeight: 700, color: 'red' }}>
                              <span>Balance Due:</span>
                              <span>৳{Number(invoice.due_amount).toLocaleString()}</span>
                           </div>
                        ) : null;
                     })()}
                  </div>
               </div>

               <div style={{ marginTop: 100, display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ textAlign: 'center', width: 220 }}>
                     <div style={{ borderTop: '1px solid black', paddingTop: 10, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Customer Signature</div>
                  </div>
                  <div style={{ textAlign: 'center', width: 220 }}>
                     <div style={{ borderTop: '1px solid black', paddingTop: 10, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Authorized Signature</div>
                     {invoice.authorized_signature && <div style={{ fontSize: 11, marginTop: 4 }}>({invoice.authorized_signature})</div>}
                  </div>
               </div>

               <div style={{ marginTop: 40, textAlign: 'center', fontSize: 10, color: '#999', fontStyle: 'italic' }}>
                  This is a computer generated document. No signature is required.
               </div>
            </div>

            <div className="no-print" style={{ padding: '16px 24px', background: 'rgba(255,255,255,.02)', borderTop: '1px solid ' + N.borderSub, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
               <button onClick={handlePrintInvoice} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, ' + N.gold + ', ' + N.goldBr + ')', color: 'black', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                  <Printer size={16} /> Print Memo
               </button>
               <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid ' + N.borderSub, background: 'transparent', color: N.text, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>Close</button>
            </div>
         </div>
      </div>
   );
}