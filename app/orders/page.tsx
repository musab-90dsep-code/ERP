'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

import {
  Plus, Trash2, Pencil, Search, ShoppingCart, X, ChevronDown, Package, Eye, AlertTriangle, CheckCircle, XCircle, FileText
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────
type OrderItem = {
  product_id: string;
  product_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  subtotal: number;
  selected_head?: string;
};

type Order = {
  id: string;
  order_no: string;
  type: 'sales' | 'purchase';
  is_return?: boolean;
  contact_id: string | null;
  contact_name: string;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'confirmed' | 'delivered' | 'cancelled';
  date: string;
  created_at: string;
};

// ─── Status badge colours ─────────────────────────────────────────────
const statusStyles: Record<string, string> = {
  pending: 'bg-[rgba(251,191,36,0.1)] text-yellow-500 border-[rgba(251,191,36,0.2)]',
  confirmed: 'bg-[rgba(96,165,250,0.1)] text-blue-400 border-[rgba(96,165,250,0.2)]',
  delivered: 'bg-[rgba(52,211,153,0.1)] text-emerald-400 border-[rgba(52,211,153,0.2)]',
  cancelled: 'bg-[rgba(248,113,113,0.1)] text-red-400 border-[rgba(248,113,113,0.2)]',
};

// ─── Main content ─────────────────────────────────────────────────────
function OrdersContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = searchParams.get('tab') ?? 'sales';
  const isSales = tab === 'sales';
  const orderType = isSales ? 'sales' : 'purchase';

  // ── list state ──
  const [orders, setOrders] = useState<Order[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ── view modal state ──
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [loadingStock, setLoadingStock] = useState(false);

  // ── form state ──
  const emptyForm = {
    contact_id: '',
    contact_name: '',
    status: 'pending' as Order['status'],
    date: new Date().toISOString().slice(0, 10),
    is_return: false,
  };
  const [formData, setFormData] = useState(emptyForm);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [itemForm, setItemForm] = useState<any>({
    product_id: '', product_name: '', quantity: 1, unit: '', unit_price: '',
  });

  // ── fetch ──
  const fetchOrders = async () => {
    try {
      const data = await api.getOrders({ type: orderType, ordering: '-created_at' });
      setOrders((Array.isArray(data) ? data : data.results ?? []) as Order[]);
    } catch (err: any) { alert(err.message); }
  };

  const fetchContacts = async () => {
    try {
      const contactType = isSales ? 'customer' : 'supplier';
      const data = await api.getContacts({ type: contactType });
      setContacts(Array.isArray(data) ? data : data.results ?? []);
    } catch (err) { console.error('fetchContacts:', err); }
  };

  const fetchProducts = async () => {
    try {
      const category = isSales ? 'finished-goods' : 'raw-materials';
      const data = await api.getProducts({ category });
      setProducts(Array.isArray(data) ? data : data.results ?? []);
    } catch (err) { console.error('fetchProducts:', err); }
  };

  useEffect(() => {
    setSearchQuery('');
    setShowForm(false);
    setEditingId(null);
    fetchOrders();
    fetchContacts();
    fetchProducts();
  }, [tab]);

  // ── filtered ──
  const filtered = useMemo(() =>
    orders.filter(o =>
      o.order_no?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.contact_name?.toLowerCase().includes(searchQuery.toLowerCase())
    ), [orders, searchQuery]);

  // ── order items helpers ──
  const addItem = () => {
    if (!itemForm.product_id || itemForm.quantity <= 0) return;
    
    const p = products.find((x: any) => x.id === itemForm.product_id);
    const heads = (p?.product_heads || []).filter((h: string) => h && h.trim());
    if (heads.length > 0 && !itemForm.selected_head) {
      alert('Please select a Variant/Head for this product before adding.');
      return;
    }

    const subtotal = itemForm.quantity * itemForm.unit_price;
    setOrderItems(prev => [...prev, { ...itemForm, subtotal }]);
    setItemForm({ product_id: '', product_name: '', quantity: 1, unit: '', unit_price: '', selected_head: '' });
  };

  const removeItem = (idx: number) =>
    setOrderItems(prev => prev.filter((_, i) => i !== idx));

  const orderTotal = orderItems.reduce((s, i) => s + i.subtotal, 0);

  // ── product select helper ──
  const selectProduct = (id: string) => {
    const p = products.find(x => x.id === id);
    if (!p) return;
    const autoPrice = isSales
      ? (Number(p.price) || Number(p.cost) || 0)
      : (Number(p.cost) || Number(p.price) || 0);
    setItemForm((prev: any) => ({
      ...prev,
      product_id: p.id,
      product_name: p.name,
      unit: p.unit || 'pcs',
      unit_price: autoPrice,
      selected_head: '',
    }));
  };

  const selectedProductHeads: string[] = (() => {
    const p = products.find((x: any) => x.id === itemForm.product_id);
    return (p?.product_heads || []).filter((h: string) => h && h.trim());
  })();

  // ── submit ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (orderItems.length === 0) { alert('Please add at least one product.'); return; }
    setSubmitting(true);
    try {
      const contactLabel = formData.contact_name ||
        contacts.find(c => c.id === formData.contact_id)?.name || '';

      const payload = {
        type: orderType,
        contact: formData.contact_id || null,
        contact_name: contactLabel,
        items: orderItems,
        total: orderTotal,
        status: formData.status,
        date: formData.date,
        is_return: isSales ? formData.is_return : false,
      };

      if (editingId) {
        await api.updateOrder(editingId, payload);
      } else {
        const order_no = `ORD-${Date.now().toString().slice(-7)}`;
        await api.createOrder({ ...payload, order_no });
      }
      resetForm();
      fetchOrders();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(emptyForm);
    setOrderItems([]);
    setItemForm({ product_id: '', product_name: '', quantity: 1, unit: '', unit_price: '', selected_head: '' });
  };

  const handleEdit = (order: Order) => {
    setFormData({
      contact_id: (order as any).contact ?? '',
      contact_name: order.contact_name ?? '',
      status: order.status,
      date: order.date,
      is_return: order.is_return || false,
    });
    setOrderItems(order.items ?? []);
    setEditingId(order.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this order?')) return;
    try {
      await api.deleteOrder(id);
      fetchOrders();
    } catch (err: any) { alert(err.message); }
  };

  const headingTitle = isSales ? 'Sales Orders' : 'Purchase Orders';

  // ── open view modal and fetch live stock ──
  const openView = async (order: Order) => {
    setViewingOrder(order);
    setLoadingStock(true);
    const ids = (order.items ?? []).map(i => i.product_id).filter(Boolean);
    if (ids.length > 0) {
      try {
        const data = await api.getProducts();
        const allProducts = Array.isArray(data) ? data : data.results ?? [];
        const map: Record<string, number> = {};
        allProducts
          .filter((p: any) => ids.includes(p.id))
          .forEach((p: any) => { map[p.id] = Number(p.stock_quantity ?? 0); });
        setStockMap(map);
      } catch { setStockMap({}); }
    } else {
      setStockMap({});
    }
    setLoadingStock(false);
  };

  // ── generate invoice from order ──
  const generateInvoice = (order: Order) => {
    let invoiceTab = order.type === 'sales' ? 'sell' : 'buy';
    if (order.type === 'sales' && order.is_return) {
      invoiceTab = 'exchange';
    }
    const payload = {
      contact_id: (order as any).contact || order.contact_id || '',
      contact_name: order.contact_name ?? '',
      date: order.date,
      items: (order.items ?? []).map(i => ({
        product_id: i.product_id,
        quantity: i.quantity,
        price: i.unit_price,
        selected_head: i.selected_head || '',
      })),
    };
    const encoded = encodeURIComponent(JSON.stringify(payload));
    router.push(`/invoices?tab=${invoiceTab}&from_order=${encoded}`);
  };

  const inputClass = "w-full bg-[#1a2235] border border-[rgba(255,255,255,0.06)] rounded-lg p-2.5 text-sm text-[#e8eaf0] focus:border-[#c9a84c] focus:ring-1 focus:ring-[rgba(201,168,76,0.3)] outline-none transition-colors";
  const labelClass = "block text-[10px] uppercase font-bold text-[#8a95a8] tracking-widest mb-2";

  return (
    <div className="pb-10 max-w-[1400px] mx-auto px-2 sm:px-0">

      {/* ─── VIEW ORDER MODAL ─── */}
      {viewingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0f1a]/80 backdrop-blur-sm p-4 w-full animate-fade-in">
          <div className="bg-[#131929] border border-[rgba(201,168,76,0.2)] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex justify-between items-start p-6 border-b border-[rgba(255,255,255,0.04)] bg-[#1a2235] shrink-0 relative">
               <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at center, #c9a84c 0%, transparent 70%)' }}></div>
              <div className="relative z-10">
                <p className="text-[10px] font-black text-[#8a95a8] uppercase tracking-widest mb-1 flex items-center gap-1.5"><FileText className="w-3 h-3 text-[#c9a84c]"/> Order Details</p>
                <h2 className="text-2xl font-black text-white">{viewingOrder.order_no}</h2>
                <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] font-bold text-[#8a95a8] uppercase tracking-wider">
                  <span className="text-[#e8eaf0]">{viewingOrder.contact_name || 'Unknown Contact'}</span>
                  <span className="w-1 h-1 rounded-full bg-[rgba(255,255,255,0.2)]"></span>
                  <span>{viewingOrder.date}</span>
                  <span className="w-1 h-1 rounded-full bg-[rgba(255,255,255,0.2)]"></span>
                  <span className={`px-2.5 py-0.5 rounded border ${statusStyles[viewingOrder.status] ?? 'bg-[rgba(255,255,255,0.05)] text-[#8a95a8] border-[rgba(255,255,255,0.1)]'}`}>
                    {viewingOrder.status}
                  </span>
                </div>
              </div>
              <button onClick={() => setViewingOrder(null)} className="text-[#8a95a8] hover:text-white bg-[#131929]/50 hover:bg-[#131929] p-1.5 rounded-lg transition-colors border border-[rgba(255,255,255,0.05)] relative z-10">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Product Stock Table */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <h3 className="text-[10px] font-black text-[#8a95a8] uppercase tracking-widest mb-4 flex items-center gap-2">
                <Package className="w-4 h-4 text-[#c9a84c]" /> Products & Stock Availability
              </h3>

              {loadingStock ? (
                <div className="py-10 flex flex-col items-center gap-3">
                   <div className="w-6 h-6 border-2 border-[#1a2235] border-t-[#c9a84c] rounded-full animate-spin"></div>
                   <div className="text-[10px] font-bold text-[#8a95a8] uppercase tracking-widest">Loading stock data...</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {(viewingOrder.items ?? []).map((item, idx) => {
                    const inStock = stockMap[item.product_id] ?? 0;
                    const ordered = Number(item.quantity);
                    const isSufficient = inStock >= ordered;
                    const isPartial = inStock > 0 && inStock < ordered;

                    return (
                      <div key={idx} className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                           isSufficient ? 'border-[rgba(52,211,153,0.2)] bg-[rgba(52,211,153,0.05)]' :
                           isPartial ? 'border-[rgba(251,191,36,0.2)] bg-[rgba(251,191,36,0.05)]' :
                           'border-[rgba(248,113,113,0.2)] bg-[rgba(248,113,113,0.05)]'
                        }`}>
                        
                        <div className="flex items-start sm:items-center gap-3">
                          <div className="mt-1 sm:mt-0">
                            {isSufficient ? (
                              <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                            ) : isPartial ? (
                              <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                            )}
                          </div>
                          <div>
                              <p className="font-bold text-[#e8eaf0] text-sm">{item.product_name}</p>
                              {item.selected_head && (
                                <span className="inline-block text-[9px] font-black text-[#c9a84c] bg-[rgba(201,168,76,0.1)] border border-[rgba(201,168,76,0.2)] rounded px-1.5 py-0.5 mt-1 uppercase tracking-widest">{item.selected_head}</span>
                              )}
                              <p className="text-[10px] text-[#8a95a8] font-bold uppercase tracking-wider mt-1.5">
                                Unit: <span className="text-[#e8eaf0]">৳{item.unit_price}</span> <span className="mx-1">·</span> Sub: <span className="text-[#e8eaf0]">৳{item.subtotal?.toFixed(2)}</span>
                              </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-8 sm:ml-0 border-t border-[rgba(255,255,255,0.05)] sm:border-0 pt-3 sm:pt-0">
                          {/* Ordered badge */}
                          <div className="text-center bg-[#131929] border border-[rgba(255,255,255,0.05)] rounded-lg px-3 py-1.5 flex-1 sm:flex-none">
                            <p className="text-[9px] font-black text-[#8a95a8] uppercase tracking-widest">Ordered</p>
                            <p className="text-sm font-black text-white">{ordered} <span className="text-[10px] text-[#8a95a8]">{item.unit}</span></p>
                          </div>

                          <span className="text-[#4a5568] font-black text-[10px] uppercase tracking-widest">of</span>

                          {/* In Stock badge */}
                          <div className={`text-center rounded-lg px-3 py-1.5 flex-1 sm:flex-none border ${
                              isSufficient ? 'bg-[rgba(52,211,153,0.1)] border-[rgba(52,211,153,0.2)]' : 
                              isPartial ? 'bg-[rgba(251,191,36,0.1)] border-[rgba(251,191,36,0.2)]' : 
                              'bg-[rgba(248,113,113,0.1)] border-[rgba(248,113,113,0.2)]'
                            }`}>
                            <p className={`text-[9px] font-black uppercase tracking-widest ${isSufficient ? 'text-emerald-500' : isPartial ? 'text-yellow-500' : 'text-red-500'}`}>Stock</p>
                            <p className={`text-sm font-black ${isSufficient ? 'text-emerald-400' : isPartial ? 'text-yellow-400' : 'text-red-400'}`}>
                               {inStock} <span className="text-[10px] opacity-70">{item.unit}</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Total */}
              <div className="mt-6 pt-5 border-t border-[rgba(255,255,255,0.04)] flex justify-between items-center bg-[#1a2235] p-4 rounded-xl">
                <span className="text-[10px] font-black text-[#8a95a8] uppercase tracking-widest">Order Total</span>
                <span className="text-2xl font-black text-[#c9a84c]">৳ {Number(viewingOrder.total).toFixed(2)}</span>
              </div>

              {/* Legend */}
              <div className="mt-5 flex flex-wrap gap-4 text-[10px] font-bold text-[#8a95a8] uppercase tracking-widest justify-center">
                <span className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Sufficient</span>
                <span className="flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-yellow-500" /> Partial</span>
                <span className="flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5 text-red-500" /> Out of stock</span>
              </div>

            </div>
            
            <div className="p-5 border-t border-[rgba(255,255,255,0.04)] bg-[#1a2235] flex justify-end shrink-0">
               <button
                 onClick={() => generateInvoice(viewingOrder)}
                 className="flex w-full sm:w-auto justify-center items-center gap-2 bg-gradient-to-br from-[#c9a84c] to-[#f0c040] text-[#0a0900] font-extrabold px-6 py-3 rounded-xl shadow-[0_4px_16px_rgba(201,168,76,0.3)] transition-all hover:opacity-90 text-sm uppercase tracking-wider"
               >
                 <FileText className="w-4 h-4" />
                 Generate Invoice
               </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── HEADER ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 bg-[#131929] p-5 sm:p-6 rounded-2xl border border-[rgba(255,255,255,0.04)] shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-[#c9a84c]" />
            <span className="text-[10px] sm:text-xs font-bold tracking-[0.2em] text-[#8a95a8] uppercase">
              Order Management
            </span>
          </div>
          <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-black text-white tracking-tight">
            <ShoppingCart className="w-5 h-5 text-[#c9a84c]" />
            {headingTitle}
          </h1>
        </div>
        <button
          onClick={() => { if (!showForm) resetForm(); setShowForm(!showForm); }}
          className="bg-gradient-to-br from-[#c9a84c] to-[#f0c040] text-[#0a0900] px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 hover:opacity-90 font-extrabold shadow-[0_4px_16px_rgba(201,168,76,0.3)] transition-all text-sm w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" /> Add Order
        </button>
      </div>

      {/* ─── FORM ─── */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-[#131929] p-5 sm:p-8 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.5)] border border-[rgba(255,255,255,0.04)] mb-8 animate-fade-in">
          <h2 className="text-sm font-black text-[#c9a84c] uppercase tracking-widest mb-6 border-b border-[rgba(255,255,255,0.04)] pb-4">
            {editingId ? 'Edit Order' : `New ${headingTitle.slice(0, -1)}`}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mb-6">
            {/* Contact */}
            <div>
              <label className={labelClass}>
                {isSales ? 'Customer Name' : 'Supplier Name'}
              </label>
              <select
                value={formData.contact_id}
                onChange={e => {
                  const c = contacts.find(x => x.id === e.target.value);
                  setFormData({ ...formData, contact_id: e.target.value, contact_name: c?.name ?? '' });
                }}
                className={`${inputClass} appearance-none`}
              >
                <option value="">— Select {isSales ? 'Customer' : 'Supplier'} —</option>
                {contacts.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.shop_name ? ` (${c.shop_name})` : ''}</option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className={labelClass}>Order Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                className={`${inputClass} [color-scheme:dark]`}
              />
            </div>

            {/* Status */}
            <div>
              <label className={labelClass}>Status</label>
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value as Order['status'] })}
                className={`${inputClass} appearance-none`}
              >
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            
            {/* Is Return (Sales Only) */}
            {isSales && (
              <div className="sm:col-span-1 md:col-span-3">
                <label className="flex items-center gap-3 cursor-pointer p-4 bg-[#1a2235] rounded-xl border border-[rgba(255,255,255,0.04)] w-max">
                  <input 
                    type="checkbox" 
                    checked={formData.is_return} 
                    onChange={e => setFormData({ ...formData, is_return: e.target.checked })} 
                    className="w-5 h-5 accent-[#c9a84c] rounded bg-[#131929]" 
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white uppercase tracking-wide">Is Return Order?</span>
                    <span className="text-[10px] text-[#8a95a8] mt-0.5 uppercase tracking-widest">Mark as Sales Return</span>
                  </div>
                </label>
              </div>
            )}
          </div>

          {/* ── Add Product Row ── */}
          <div className="bg-[#1a2235] border border-[rgba(255,255,255,0.04)] rounded-xl p-4 sm:p-5 mb-6">
            <p className="text-[10px] font-black text-[#8a95a8] uppercase tracking-widest mb-4 flex items-center gap-2">
              <Package className="w-3.5 h-3.5 text-[#c9a84c]" /> Add Product Items
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-end">
              <div className={selectedProductHeads.length > 0 ? 'sm:col-span-1' : 'sm:col-span-2'}>
                <label className={labelClass}>Product</label>
                <select
                  value={itemForm.product_id}
                  onChange={e => selectProduct(e.target.value)}
                  className={`${inputClass} appearance-none`}
                >
                  <option value="">— Select Product —</option>
                  {products.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              {selectedProductHeads.length > 0 && (
                <div className="sm:col-span-1 animate-in fade-in slide-in-from-top-1">
                  <label className="block text-[10px] font-black text-[#c9a84c] uppercase tracking-widest mb-2">Variant/Head</label>
                  <select
                    value={itemForm.selected_head || ''}
                    onChange={e => setItemForm({ ...itemForm, selected_head: e.target.value })}
                    className="w-full bg-[rgba(201,168,76,0.1)] border border-[rgba(201,168,76,0.2)] rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-[#c9a84c] text-[#c9a84c] font-bold appearance-none"
                  >
                    <option value="" disabled>-- Select --</option>
                    {selectedProductHeads.map((h: string, hi: number) => (
                      <option key={hi} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className={labelClass}>Quantity</label>
                <input
                  type="number" min="0.01" step="0.01"
                  value={itemForm.quantity}
                  onChange={e => setItemForm({ ...itemForm, quantity: Number(e.target.value) })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Unit Price</label>
                <input
                  type="number" min="0" step="0.01"
                  value={itemForm.unit_price}
                  onChange={e => setItemForm({ ...itemForm, unit_price: e.target.value === '' ? '' : Number(e.target.value) })}
                  className={inputClass}
                />
              </div>
              <div>
                <button
                  type="button"
                  onClick={addItem}
                  className="w-full bg-[#131929] border border-[rgba(255,255,255,0.1)] text-[#e8eaf0] rounded-lg py-2.5 text-[11px] uppercase tracking-widest font-black hover:bg-[rgba(255,255,255,0.05)] transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Add Item
                </button>
              </div>
            </div>

            {/* Mobile/Card Item list */}
            {orderItems.length > 0 && (
              <div className="mt-5 space-y-2 sm:hidden">
                {orderItems.map((item, idx) => (
                   <div key={idx} className="bg-[#131929] border border-[rgba(255,255,255,0.05)] rounded-lg p-3 relative pr-10">
                      <p className="font-bold text-sm text-[#e8eaf0]">{item.product_name}</p>
                      {item.selected_head && <span className="inline-block mt-1 text-[9px] font-black text-[#c9a84c] bg-[rgba(201,168,76,0.1)] border border-[rgba(201,168,76,0.2)] rounded px-1.5 py-0.5 uppercase tracking-widest">{item.selected_head}</span>}
                      <div className="flex justify-between items-center mt-2 text-xs font-bold text-[#8a95a8]">
                         <span>{item.quantity} {item.unit} × ৳{item.unit_price}</span>
                         <span className="text-[#c9a84c]">৳{item.subtotal.toFixed(2)}</span>
                      </div>
                      <button type="button" onClick={() => removeItem(idx)} className="absolute top-1/2 right-2 -translate-y-1/2 text-[#4a5568] hover:text-red-400 p-2 bg-[#1a2235] rounded-md">
                        <X className="w-4 h-4" />
                      </button>
                   </div>
                ))}
                <div className="bg-[#131929] border border-[rgba(255,255,255,0.05)] rounded-lg p-4 flex justify-between items-center">
                   <span className="text-[10px] font-black text-[#8a95a8] uppercase tracking-widest">Total:</span>
                   <span className="text-lg font-black text-[#c9a84c]">৳ {orderTotal.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* PC Item list */}
            {orderItems.length > 0 && (
              <div className="mt-5 rounded-xl overflow-hidden border border-[rgba(255,255,255,0.04)] hidden sm:block">
                <table className="w-full text-left">
                  <thead className="bg-[#131929] border-b border-[rgba(255,255,255,0.04)]">
                    <tr>
                      <th className="px-4 py-3 text-[10px] font-black text-[#8a95a8] uppercase tracking-widest">Product</th>
                      <th className="px-4 py-3 text-[10px] font-black text-[#8a95a8] uppercase tracking-widest">Variant</th>
                      <th className="px-4 py-3 text-[10px] font-black text-[#8a95a8] uppercase tracking-widest">Qty</th>
                      <th className="px-4 py-3 text-[10px] font-black text-[#8a95a8] uppercase tracking-widest">Unit Price</th>
                      <th className="px-4 py-3 text-[10px] font-black text-[#8a95a8] uppercase tracking-widest">Subtotal</th>
                      <th className="px-4 py-3 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(255,255,255,0.02)] bg-[#1a2235]">
                    {orderItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-[rgba(255,255,255,0.02)]">
                        <td className="px-4 py-3 font-bold text-[#e8eaf0] text-sm">{item.product_name}</td>
                        <td className="px-4 py-3">
                          {item.selected_head
                            ? <span className="text-[9px] font-black text-[#c9a84c] bg-[rgba(201,168,76,0.1)] border border-[rgba(201,168,76,0.2)] rounded px-1.5 py-0.5 uppercase tracking-widest">{item.selected_head}</span>
                            : <span className="text-[#4a5568] text-xs font-bold">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs font-bold text-[#8a95a8]">{item.quantity} <span className="text-[10px] uppercase tracking-widest opacity-70">{item.unit}</span></td>
                        <td className="px-4 py-3 text-xs font-bold text-[#8a95a8]">৳{item.unit_price}</td>
                        <td className="px-4 py-3 font-black text-[#e8eaf0] text-sm">৳{item.subtotal.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">
                          <button type="button" onClick={() => removeItem(idx)} className="text-[#4a5568] hover:text-red-400 p-1.5 bg-[#131929] rounded-md transition-colors border border-[rgba(255,255,255,0.05)]">
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-[#131929] border-t border-[rgba(255,255,255,0.04)]">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-right text-[10px] font-black text-[#8a95a8] uppercase tracking-widest">Total:</td>
                      <td className="px-4 py-3 text-lg font-black text-[#c9a84c]">৳ {orderTotal.toFixed(2)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 mt-4 border-t border-[rgba(255,255,255,0.04)] pt-6">
            <button type="button" onClick={resetForm}
              className="px-6 py-2.5 rounded-lg border border-[rgba(255,255,255,0.1)] text-[#8a95a8] hover:text-white hover:bg-[rgba(255,255,255,0.05)] font-bold transition-colors text-sm">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="bg-gradient-to-br from-[#c9a84c] to-[#f0c040] text-[#0a0900] px-8 py-2.5 rounded-lg text-sm font-extrabold hover:opacity-90 transition-opacity shadow-[0_4px_16px_rgba(201,168,76,0.3)] disabled:opacity-50">
              {submitting ? 'Saving...' : (editingId ? 'Update Order' : 'Save Order')}
            </button>
          </div>
        </form>
      )}

      {/* ─── SEARCH ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 bg-[#131929] p-4 rounded-xl border border-[rgba(255,255,255,0.04)] shadow-sm">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a95a8]" />
          <input
            type="text"
            placeholder="Search by order no or name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#1a2235] border border-[rgba(255,255,255,0.06)] rounded-lg outline-none focus:border-[#c9a84c] text-sm text-[#e8eaf0] transition-colors"
          />
        </div>
        <span className="text-[10px] font-black text-[#4a5568] uppercase tracking-widest">{filtered.length} order{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* ─── RESPONSIVE LIST ─── */}
      <div className="bg-[#131929] rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.5)] border border-[rgba(255,255,255,0.04)] overflow-hidden">
        
        {/* PC VIEW: TABLE */}
        <div className="hidden md:block overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#1a2235] border-b border-[rgba(255,255,255,0.04)]">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-[#8a95a8] uppercase tracking-widest">Order No</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#8a95a8] uppercase tracking-widest">
                  {isSales ? 'Customer' : 'Supplier'}
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-[#8a95a8] uppercase tracking-widest">Products Overview</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#8a95a8] uppercase tracking-widest">Total</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#8a95a8] uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#8a95a8] uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#8a95a8] uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.02)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-[#4a5568]">
                    <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-bold">No orders found</p>
                  </td>
                </tr>
              ) : filtered.map(order => (
                <tr key={order.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors group">
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs font-black text-[#c9a84c] bg-[rgba(201,168,76,0.1)] border border-[rgba(201,168,76,0.2)] px-2 py-1 rounded block w-max">
                      {order.order_no}
                    </span>
                    {order.is_return && (
                      <span className="inline-block mt-2 font-mono text-[9px] font-black text-red-400 bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.2)] px-1.5 py-0.5 rounded uppercase tracking-widest">
                        Return
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-bold text-[#e8eaf0] text-sm">{order.contact_name || '—'}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      {(order.items ?? []).slice(0, 2).map((item, i) => (
                        <span key={i} className="text-xs font-bold text-[#8a95a8]">
                          {item.product_name} <span className="text-[#4a5568]">× {item.quantity}</span>
                        </span>
                      ))}
                      {(order.items ?? []).length > 2 && (
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#4a5568] mt-1">+{order.items.length - 2} more items</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-black text-white">৳ {Number(order.total).toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span className={`text-[9px] font-black px-2.5 py-1 rounded border uppercase tracking-widest ${statusStyles[order.status] ?? 'bg-[rgba(255,255,255,0.05)] text-[#8a95a8] border-[rgba(255,255,255,0.1)]'}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-[#8a95a8]">{order.date}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openView(order)} className="p-2 text-[#8a95a8] hover:text-white bg-[#1a2235] rounded-md transition-colors border border-[rgba(255,255,255,0.05)]" title="View Order">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleEdit(order)} className="p-2 text-[#8a95a8] hover:text-[#c9a84c] bg-[#1a2235] rounded-md transition-colors border border-[rgba(255,255,255,0.05)]" title="Edit Order">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(order.id)} className="p-2 text-[#8a95a8] hover:text-red-400 bg-[#1a2235] rounded-md transition-colors border border-[rgba(255,255,255,0.05)]" title="Delete Order">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* MOBILE VIEW: CARDS */}
        <div className="block md:hidden divide-y divide-[rgba(255,255,255,0.02)]">
          {filtered.length === 0 ? (
             <div className="py-16 text-center text-[#4a5568]">
               <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
               <p className="text-sm font-bold">No orders found</p>
             </div>
          ) : (
            filtered.map(order => (
               <div key={order.id} className="p-4 hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                  <div className="flex justify-between items-start mb-3">
                     <div>
                        <span className="font-mono text-[10px] font-black text-[#c9a84c] bg-[rgba(201,168,76,0.1)] border border-[rgba(201,168,76,0.2)] px-2 py-0.5 rounded block w-max mb-1">
                          {order.order_no}
                        </span>
                        {order.is_return && (
                          <span className="inline-block mb-1 font-mono text-[9px] font-black text-red-400 bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.2)] px-1.5 py-0.5 rounded uppercase tracking-widest">
                            Return
                          </span>
                        )}
                        <span className="font-bold text-[#e8eaf0] text-sm block">{order.contact_name || 'Unknown Contact'}</span>
                     </div>
                     <div className="text-right">
                        <span className="font-black text-white text-base block leading-tight">৳ {Number(order.total).toFixed(2)}</span>
                        <span className={`inline-block mt-1 text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-widest ${statusStyles[order.status] ?? 'bg-[rgba(255,255,255,0.05)] text-[#8a95a8] border-[rgba(255,255,255,0.1)]'}`}>
                          {order.status}
                        </span>
                     </div>
                  </div>
                  
                  <div className="bg-[#0b0f1a] rounded-lg p-2.5 border border-[rgba(255,255,255,0.02)] mb-3">
                     <p className="text-[9px] font-black text-[#4a5568] uppercase tracking-widest mb-1.5">Products:</p>
                     <div className="flex flex-col gap-1">
                      {(order.items ?? []).slice(0, 2).map((item, i) => (
                        <span key={i} className="text-xs font-bold text-[#8a95a8] flex justify-between">
                          <span className="truncate pr-2">{item.product_name}</span> 
                          <span className="text-[#4a5568] shrink-0">× {item.quantity}</span>
                        </span>
                      ))}
                      {(order.items ?? []).length > 2 && (
                        <span className="text-[9px] font-black uppercase tracking-widest text-[#4a5568] mt-0.5">+{order.items.length - 2} more items</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-[rgba(255,255,255,0.02)]">
                     <span className="text-[10px] font-bold text-[#8a95a8] uppercase tracking-widest">{order.date}</span>
                     <div className="flex gap-1.5">
                       <button onClick={() => openView(order)} className="p-2 text-[#8a95a8] hover:text-white bg-[#1a2235] rounded-md transition-colors border border-[rgba(255,255,255,0.05)]">
                         <Eye className="w-3.5 h-3.5" />
                       </button>
                       <button onClick={() => handleEdit(order)} className="p-2 text-[#8a95a8] hover:text-[#c9a84c] bg-[#1a2235] rounded-md transition-colors border border-[rgba(255,255,255,0.05)]">
                         <Pencil className="w-3.5 h-3.5" />
                       </button>
                       <button onClick={() => handleDelete(order.id)} className="p-2 text-[#4a5568] hover:text-red-400 bg-[#1a2235] rounded-md transition-colors border border-[rgba(255,255,255,0.05)]">
                         <Trash2 className="w-3.5 h-3.5" />
                       </button>
                     </div>
                  </div>
               </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="w-10 h-10 rounded-full border-4 border-[#131929] border-t-[#c9a84c] animate-spin" />
        <div className="text-[10px] font-black text-[#8a95a8] uppercase tracking-widest">Loading Orders...</div>
      </div>
    }>
      <OrdersContent />
    </Suspense>
  );
}