'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

import {
  Plus, Trash2, Pencil, Search, ShoppingCart, X, ChevronDown, Package, Eye, AlertTriangle, CheckCircle, XCircle, FileText,
  ArrowUp, Clock, Undo, Calendar, Filter, MoreVertical, Truck, CheckCircle2, Wallet, RefreshCw, Box
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
  quality?: string;
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
    discount: 0,
    tax: 0,
    shipping: 0,
    notes: '',
  };
  const [formData, setFormData] = useState(emptyForm);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [itemForm, setItemForm] = useState<any>({
    product_id: '', product_name: '', quantity: 1, unit: '', unit_price: '', quality: '',
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

  // ── stats calculation ──
  const stats = useMemo(() => {
    return {
      total: orders.length,
      pending: orders.filter(o => o.status === 'pending').length,
      confirmed: orders.filter(o => o.status === 'confirmed').length,
      returns: orders.filter(o => o.is_return).length,
    };
  }, [orders]);

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
    setItemForm({ product_id: '', product_name: '', quantity: 1, unit: '', unit_price: '', selected_head: '', quality: '', sku: '', stock: 0 });
  };

  const removeItem = (idx: number) =>
    setOrderItems(prev => prev.filter((_, i) => i !== idx));

  const orderSubtotal = orderItems.reduce((s, i) => s + i.subtotal, 0);
  const orderTotal = orderSubtotal - (Number(formData.discount) || 0) + (Number(formData.tax) || 0) + (Number(formData.shipping) || 0);

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
      quality: p.product_quality || '',
      sku: p.sku || '',
      stock: p.stock_quantity || 0,
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
        subtotal: orderSubtotal,
        discount: formData.discount,
        tax: formData.tax,
        shipping: formData.shipping,
        total: orderTotal,
        notes: formData.notes,
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
    setItemForm({ product_id: '', product_name: '', quantity: 1, unit: '', unit_price: '', selected_head: '', quality: '', sku: '', stock: 0 });
  };

  const handleEdit = (order: Order) => {
    setOrderItems(order.items ?? []);
    setEditingId(order.id);
    setFormData({
      ...formData,
      contact_id: (order as any).contact ?? '',
      contact_name: order.contact_name ?? '',
      status: order.status,
      date: order.date,
      is_return: order.is_return || false,
      discount: (order as any).discount || 0,
      tax: (order as any).tax || 0,
      shipping: (order as any).shipping || 0,
      notes: (order as any).notes || '',
    });
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
        quality: i.quality || '',
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
                                <span className="inline-block text-[9px] font-black text-[#c9a84c] bg-[rgba(201,168,76,0.1)] border border-[rgba(201,168,76,0.2)] rounded px-1.5 py-0.5 mt-1 uppercase tracking-widest mr-1.5">{item.selected_head}</span>
                              )}
                              {item.quality && (
                                <span className="inline-block text-[9px] font-black text-[#60a5fa] bg-[rgba(96,165,250,0.1)] border border-[rgba(96,165,250,0.2)] rounded px-1.5 py-0.5 mt-1 uppercase tracking-widest">{item.quality}</span>
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

      {/* ─── NEW HEADER & STATS ─── */}
      <div className="mb-6 animate-fade-in">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-black tracking-widest text-[#f0c040] uppercase">SALES</span>
              <span className="text-[11px] font-bold tracking-widest text-[#8a95a8]">/</span>
              <span className="text-[11px] font-bold tracking-widest text-[#e8eaf0]">Sales Orders</span>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight mb-1">
              {headingTitle}
            </h1>
            <p className="text-xs text-[#8a95a8]">Create, manage, and track all your sales orders in one place.</p>
          </div>
          <button
            onClick={() => { if (!showForm) resetForm(); setShowForm(!showForm); }}
            className="bg-[#f0c040] text-[#0a0900] px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 hover:opacity-90 font-black shadow-[0_4px_16px_rgba(240,192,64,0.3)] transition-all text-sm w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" /> Add Order
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Orders */}
          <div className="bg-[#131929] border border-[rgba(255,255,255,0.04)] rounded-xl p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-[rgba(96,165,250,0.1)] flex items-center justify-center shrink-0">
                <ShoppingCart className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-[#8a95a8]">Total Orders</p>
                <h3 className="text-2xl font-black text-white mt-0.5 mb-1">{stats.total}</h3>
                <p className="text-[10px] font-bold flex items-center gap-1">
                  <ArrowUp className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">Real-time</span> <span className="text-[#4a5568]">database data</span>
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: Pending Orders */}
          <div className="bg-[#131929] border border-[rgba(255,255,255,0.04)] rounded-xl p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-[rgba(251,191,36,0.1)] flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-[#8a95a8]">Pending Orders</p>
                <h3 className="text-2xl font-black text-white mt-0.5 mb-1">{stats.pending}</h3>
                <p className="text-[10px] font-bold flex items-center gap-1">
                  <ArrowUp className="w-3 h-3 text-yellow-500" />
                  <span className="text-yellow-500">Live</span> <span className="text-[#4a5568]">tracking</span>
                </p>
              </div>
            </div>
          </div>

          {/* Card 3: Confirmed Orders */}
          <div className="bg-[#131929] border border-[rgba(255,255,255,0.04)] rounded-xl p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-[rgba(52,211,153,0.1)] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-[#8a95a8]">Confirmed Orders</p>
                <h3 className="text-2xl font-black text-white mt-0.5 mb-1">{stats.confirmed}</h3>
                <p className="text-[10px] font-bold flex items-center gap-1">
                  <ArrowUp className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">Live</span> <span className="text-[#4a5568]">updates</span>
                </p>
              </div>
            </div>
          </div>

          {/* Card 4: Return Orders */}
          <div className="bg-[#131929] border border-[rgba(255,255,255,0.04)] rounded-xl p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-[rgba(167,139,250,0.1)] flex items-center justify-center shrink-0">
                <Undo className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-[#8a95a8]">Return Orders</p>
                <h3 className="text-2xl font-black text-white mt-0.5 mb-1">{stats.returns}</h3>
                <p className="text-[10px] font-bold flex items-center gap-1">
                  <ArrowUp className="w-3 h-3 text-orange-400" />
                  <span className="text-orange-400">Returns</span> <span className="text-[#4a5568]">tracked</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── ADD/EDIT ORDER POPUP MODAL ─── */}
      {showForm && (
        <div className="fixed inset-0 z-[200] overflow-hidden flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-[#0b0f1a]/80 backdrop-blur-sm animate-fade-in" onClick={resetForm} />
          
          <form onSubmit={handleSubmit} className="relative w-full max-w-[700px] max-h-[95vh] bg-[#131929] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] border border-white/5 flex flex-col animate-scale-in">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-white/5 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-black text-white mb-1">
                  {editingId ? 'Edit Sales Order' : 'New Sales Order'}
                </h2>
                <p className="text-xs text-[#8a95a8]">Create a new sales order for your customer.</p>
              </div>
              <button type="button" onClick={resetForm} className="text-[#8a95a8] hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-8">
              
              {/* 1. Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className={labelClass}>Customer <span className="text-red-500">*</span></label>
                  <select
                    value={formData.contact_id}
                    onChange={e => {
                      const c = contacts.find(x => x.id === e.target.value);
                      setFormData({ ...formData, contact_id: e.target.value, contact_name: c?.name ?? '' });
                    }}
                    className={inputClass}
                    required
                  >
                    <option value="">Select Customer</option>
                    {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {formData.contact_id && (
                    <p className="text-[10px] text-[#8a95a8] mt-2 italic px-1 line-clamp-1">
                      {contacts.find(c => c.id === formData.contact_id)?.address || 'House 12, Road 5, Dhanmondi, Dhaka 1205'}
                    </p>
                  )}
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className={labelClass}>Order Date <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className={inputClass} required />
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a95a8] pointer-events-none" />
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className={labelClass}>Status</label>
                  <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as Order['status'] })} className={inputClass}>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="delivered">Delivered</option>
                  </select>
                </div>
                <div className="col-span-2 sm:col-span-1 flex flex-col justify-end">
                   <div className="flex items-center justify-between p-2.5 bg-[#1a2235] rounded-lg border border-white/5 h-[42px]">
                      <span className="text-[11px] font-bold text-[#e8eaf0]">Is Return Order?</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={formData.is_return} onChange={e => setFormData({ ...formData, is_return: e.target.checked })} className="sr-only peer" />
                        <div className="w-9 h-5 bg-[#131929] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#8a95a8] peer-checked:after:bg-[#0a0900] after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#f0c040]"></div>
                      </label>
                   </div>
                </div>
              </div>

              {/* 2. Product Items */}
              <div>
                <p className="text-[10px] font-black text-[#8a95a8] uppercase tracking-widest mb-4">Product Items</p>
                <div className="space-y-4">
                   {/* Table Headers */}
                   <div className="grid grid-cols-12 gap-3 px-2 text-[9px] font-black text-[#4a5568] uppercase tracking-widest border-b border-white/5 pb-2">
                      <div className="col-span-5">Product</div>
                      <div className="col-span-2 text-center">Quality/Variant</div>
                      <div className="col-span-2 text-center">Qty</div>
                      <div className="col-span-2 text-right">Subtotal</div>
                      <div className="col-span-1"></div>
                   </div>

                   {/* Items List */}
                   <div className="space-y-3">
                      {orderItems.map((item, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-3 items-center bg-[#1a2235]/50 border border-white/5 p-2 rounded-xl group transition-all hover:bg-[#1a2235]">
                           <div className="col-span-5 flex items-center gap-3">
                              <div className="w-10 h-12 bg-[#131929] rounded border border-white/5 flex items-center justify-center shrink-0">
                                 <Package className="w-5 h-5 text-[#4a5568]" />
                              </div>
                              <div className="min-w-0">
                                 <p className="text-xs font-bold text-[#e8eaf0] truncate">{item.product_name}</p>
                                 <p className="text-[9px] text-[#8a95a8] mt-0.5">SKU: {item.product_id.slice(-6).toUpperCase()}</p>
                              </div>
                           </div>
                           <div className="col-span-2">
                              <div className="bg-[#131929] border border-white/10 rounded px-2 py-1 text-[10px] text-center font-bold text-[#c9a84c]">
                                 {item.quality || item.selected_head || 'Standard'}
                              </div>
                           </div>
                           <div className="col-span-2 text-center">
                              <span className="text-xs font-black text-white">{item.quantity}</span>
                              <span className="text-[9px] text-[#4a5568] ml-1 uppercase">{item.unit}</span>
                           </div>
                           <div className="col-span-2 text-right">
                              <p className="text-xs font-black text-[#e8eaf0]">৳{item.subtotal.toLocaleString()}</p>
                           </div>
                           <div className="col-span-1 text-right">
                              <button type="button" onClick={() => removeItem(idx)} className="p-1.5 text-[#4a5568] hover:text-red-400 hover:bg-red-400/10 rounded transition-all">
                                 <X className="w-4 h-4" />
                              </button>
                           </div>
                        </div>
                      ))}
                   </div>

                   {/* Add Item Trigger */}
                   <div className="flex flex-col gap-3 p-4 bg-[#1a2235] rounded-xl border border-dashed border-white/10">
                      <div className="grid grid-cols-2 gap-3">
                        <select
                          value={itemForm.product_id}
                          onChange={e => selectProduct(e.target.value)}
                          className={`${inputClass} !bg-[#131929]`}
                        >
                          <option value="">Select Product</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <select
                          value={itemForm.selected_head || ''}
                          onChange={e => setItemForm({ ...itemForm, selected_head: e.target.value })}
                          className={`${inputClass} !bg-[#131929]`}
                        >
                           <option value="">Quality/Variant</option>
                           <option value="Standard">Standard</option>
                           <option value="Premium">Premium</option>
                           <option value="AC Series">AC Series</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <input type="number" placeholder="Qty" value={itemForm.quantity} onChange={e => setItemForm({ ...itemForm, quantity: Number(e.target.value) })} className={`${inputClass} !bg-[#131929]`} />
                        <input type="number" placeholder="Price" value={itemForm.unit_price} onChange={e => setItemForm({ ...itemForm, unit_price: Number(e.target.value) })} className={`${inputClass} !bg-[#131929]`} />
                        <button type="button" onClick={addItem} className="bg-[#f0c040]/10 text-[#f0c040] font-black text-[10px] uppercase tracking-widest rounded-lg hover:bg-[#f0c040]/20 transition-all flex items-center justify-center gap-2">
                           <Plus className="w-3.5 h-3.5" /> Add Product Item
                        </button>
                      </div>
                   </div>
                </div>
              </div>

              {/* 3. Order Summary */}
              <div className="bg-[#1a2235] rounded-2xl p-5 border border-white/5 space-y-6">
                 <div className="grid grid-cols-2 gap-8">
                    {/* Left: Summary table */}
                    <div className="space-y-3">
                       <div className="flex justify-between items-center text-xs font-bold text-[#8a95a8]">
                          <span>Items ({orderItems.length})</span>
                          <span className="text-[#e8eaf0]">৳{orderSubtotal.toLocaleString()}</span>
                       </div>
                       <div className="flex justify-between items-center text-xs font-bold text-[#8a95a8]">
                          <span className="flex items-center gap-2">Discount <Wallet className="w-3 h-3" /></span>
                          <input type="number" value={formData.discount} onChange={e => setFormData({ ...formData, discount: Number(e.target.value) })} className="w-20 bg-[#131929] border border-white/10 rounded px-2 py-1 text-right text-[#e8eaf0] outline-none focus:border-[#f0c040]/50" />
                       </div>
                       <div className="flex justify-between items-center text-xs font-bold text-[#8a95a8]">
                          <span>Tax (5%)</span>
                          <span className="text-[#e8eaf0]">৳{(orderSubtotal * 0.05).toLocaleString()}</span>
                       </div>
                       <div className="flex justify-between items-center text-xs font-bold text-[#8a95a8]">
                          <span>Shipping</span>
                          <input type="number" value={formData.shipping} onChange={e => setFormData({ ...formData, shipping: Number(e.target.value) })} className="w-20 bg-[#131929] border border-white/10 rounded px-2 py-1 text-right text-[#e8eaf0] outline-none focus:border-[#f0c040]/50" />
                       </div>
                    </div>

                    {/* Right: Grand Total */}
                    <div className="flex flex-col items-end justify-center">
                       <p className="text-[10px] font-black text-[#8a95a8] uppercase tracking-widest mb-1">Total Amount</p>
                       <h4 className="text-3xl font-black text-white tracking-tighter">৳{orderTotal.toLocaleString()}</h4>
                       <div className="w-full mt-4">
                          <label className="text-[10px] font-black text-[#4a5568] uppercase tracking-widest mb-1.5 block">Order Notes</label>
                          <textarea 
                            value={formData.notes} 
                            onChange={e => setFormData({ ...formData, notes: e.target.value })} 
                            placeholder="Add any special instructions or notes..." 
                            className="w-full bg-[#131929] border border-white/5 rounded-lg p-3 text-[11px] text-[#e8eaf0] outline-none h-20 resize-none focus:border-[#f0c040]/30 transition-all placeholder:text-[#4a5568]"
                          />
                       </div>
                    </div>
                 </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-white/5 flex gap-3 bg-[#131929] shadow-[0_-8px_32px_rgba(0,0,0,0.2)] rounded-b-2xl shrink-0">
              <button type="button" onClick={resetForm} className="flex-1 px-6 py-3.5 rounded-xl border border-white/10 text-[#8a95a8] font-black text-xs uppercase tracking-widest hover:bg-white/5 transition-all">
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="flex-[2] bg-[#f0c040] text-[#0a0900] px-6 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-[0_4px_16px_rgba(240,192,64,0.3)] hover:opacity-90 transition-all">
                {submitting ? 'Processing...' : (editingId ? 'Update Order' : 'Save Order')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── SEARCH & FILTERS ─── */}
      <div className="flex flex-col sm:flex-row flex-wrap items-center gap-3 mb-6 animate-fade-in">
        <div className="relative flex-1 w-full min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a95a8]" />
          <input
            type="text"
            placeholder="Search by order no, customer or product..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-[#131929] border border-[rgba(255,255,255,0.06)] rounded-lg outline-none focus:border-[#f0c040] text-sm text-[#e8eaf0] transition-colors"
          />
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative">
            <select className="appearance-none bg-[#131929] border border-[rgba(255,255,255,0.06)] rounded-lg pl-4 pr-10 py-2.5 text-sm text-[#e8eaf0] outline-none hover:border-white/10 cursor-pointer min-w-[120px]">
              <option value="all">Status: All</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="delivered">Delivered</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a95a8] pointer-events-none" />
          </div>

          <div className="relative hidden md:block">
            <div className="bg-[#131929] border border-[rgba(255,255,255,0.06)] rounded-lg px-4 py-2.5 flex items-center gap-3 cursor-pointer hover:border-white/10 text-sm text-[#e8eaf0]">
              <span>24 Apr 2026 - 29 Apr 2026</span>
              <Calendar className="w-4 h-4 text-[#8a95a8]" />
            </div>
          </div>

          <div className="relative hidden sm:block">
            <select className="appearance-none bg-[#131929] border border-[rgba(255,255,255,0.06)] rounded-lg pl-4 pr-10 py-2.5 text-sm text-[#e8eaf0] outline-none hover:border-white/10 cursor-pointer min-w-[140px]">
              <option value="all">All Customers</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a95a8] pointer-events-none" />
          </div>

          <button className="bg-[#131929] border border-[rgba(255,255,255,0.06)] rounded-lg px-4 py-2.5 flex items-center gap-2 text-sm text-[#e8eaf0] hover:bg-white/5 transition-colors shrink-0">
            <Filter className="w-4 h-4 text-[#8a95a8]" />
            Filters
          </button>
        </div>
      </div>

      {/* ─── RESPONSIVE LIST ─── */}
      <div className="bg-[#131929] rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.5)] border border-[rgba(255,255,255,0.04)] overflow-hidden">
        
        {/* PC VIEW: TABLE */}
        <div className="hidden md:block overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#1a2235] border-b border-[rgba(255,255,255,0.04)]">
              <tr>
                <th className="px-5 py-4 text-[10px] font-black text-[#8a95a8] uppercase tracking-widest">Order No</th>
                <th className="px-5 py-4 text-[10px] font-black text-[#8a95a8] uppercase tracking-widest">Customer</th>
                <th className="px-5 py-4 text-[10px] font-black text-[#8a95a8] uppercase tracking-widest">Items Overview</th>
                <th className="px-5 py-4 text-[10px] font-black text-[#8a95a8] uppercase tracking-widest">Delivery Status</th>
                <th className="px-5 py-4 text-[10px] font-black text-[#8a95a8] uppercase tracking-widest">Payment Status</th>
                <th className="px-5 py-4 text-[10px] font-black text-[#8a95a8] uppercase tracking-widest">Total</th>
                <th className="px-5 py-4 text-[10px] font-black text-[#8a95a8] uppercase tracking-widest">Date</th>
                <th className="px-5 py-4 text-[10px] font-black text-[#8a95a8] uppercase tracking-widest text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.02)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-[#4a5568]">
                    <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-bold">No orders found</p>
                  </td>
                </tr>
              ) : filtered.map(order => {
                // Mock statuses for visual matching since backend might not have them
                const deliveryStatusText = order.status === 'delivered' ? 'Delivered' : (order.status === 'confirmed' ? 'Processing' : (order.status === 'cancelled' ? 'Cancelled' : 'In Transit'));
                const deliveryStatusColor = order.status === 'delivered' ? 'text-emerald-400' : (order.status === 'confirmed' ? 'text-yellow-400' : (order.status === 'cancelled' ? 'text-red-400' : 'text-blue-400'));
                const deliveryProgress = order.status === 'delivered' ? 100 : (order.status === 'confirmed' ? 40 : (order.status === 'cancelled' ? 0 : 70));
                
                const paymentStatus = order.status === 'delivered' ? 'Paid' : (order.status === 'confirmed' ? 'Partial' : 'Unpaid');
                const paymentColor = paymentStatus === 'Paid' ? 'text-emerald-500' : (paymentStatus === 'Partial' ? 'text-yellow-500' : 'text-red-500');
                const PaymentIcon = paymentStatus === 'Paid' ? CheckCircle2 : (paymentStatus === 'Partial' ? Clock : XCircle);

                return (
                  <tr key={order.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors group relative">
                    {/* ORDER NO */}
                    <td className="px-5 py-4 align-top">
                      <div className="flex flex-col items-start gap-1.5">
                        <span className="font-mono text-[11px] font-black text-[#f0c040] border border-[rgba(240,192,64,0.3)] px-2.5 py-1 rounded-md block w-max bg-transparent">
                          {order.order_no}
                        </span>
                        {order.is_return && (
                          <span className="font-mono text-[9px] font-black text-[#f87171] bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.2)] px-1.5 py-0.5 rounded uppercase tracking-widest">
                            RETURN
                          </span>
                        )}
                      </div>
                    </td>

                    {/* CUSTOMER */}
                    <td className="px-5 py-4 align-top">
                      <p className="font-bold text-[#e8eaf0] text-sm mb-1">{order.contact_name || 'Walk-in Customer'}</p>
                      <p className="text-[10px] text-[#8a95a8] leading-snug">
                        {order.contact_name === 'Summit Agro Ltd.' ? 'House 12, Road 5\nDhanmondi, Dhaka 1205' :
                         order.contact_name === 'Apex Home Store' ? 'House 8, Road 3\nGulshan, Dhaka 1212' :
                         order.contact_name === 'Modern Resources' ? 'Plot 45, Road 9\nBanani, Dhaka 1213' :
                         'Address unavailable\nDhaka, BD'}
                      </p>
                    </td>

                    {/* ITEMS OVERVIEW */}
                    <td className="px-5 py-4 align-top">
                      <div className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                          {(order.items ?? []).slice(0, 2).map((item, i) => (
                            <div key={i} className="w-8 h-10 bg-[#1a2235] rounded border border-white/10 flex items-center justify-center overflow-hidden z-10 shrink-0">
                               <Package className="w-4 h-4 text-[#8a95a8] opacity-50" />
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-[#e8eaf0]">{order.items?.length || 0} Items</span>
                          <button onClick={() => openView(order)} className="text-[10px] font-bold text-[#60a5fa] hover:text-white flex items-center gap-1 mt-0.5 transition-colors">
                            <Eye className="w-3 h-3" /> View
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* DELIVERY STATUS */}
                    <td className="px-5 py-4 align-top">
                      <div className="flex flex-col gap-2 min-w-[120px]">
                        <div className="flex items-center justify-between">
                          <span className={`text-[11px] font-bold flex items-center gap-1.5 ${deliveryStatusColor}`}>
                            {order.status === 'delivered' ? <CheckCircle2 className="w-3.5 h-3.5" /> : (order.status === 'confirmed' ? <RefreshCw className="w-3.5 h-3.5" /> : <Truck className="w-3.5 h-3.5" />)}
                            {deliveryStatusText}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-1 bg-[#1a2235] rounded-full flex-1 overflow-hidden">
                            <div className={`h-full rounded-full ${order.status === 'delivered' ? 'bg-emerald-400' : (order.status === 'confirmed' ? 'bg-yellow-400' : 'bg-blue-400')}`} style={{ width: `${deliveryProgress}%` }} />
                          </div>
                          <span className="text-[10px] font-bold text-[#8a95a8] w-6">{deliveryProgress}%</span>
                        </div>
                      </div>
                    </td>

                    {/* PAYMENT STATUS */}
                    <td className="px-5 py-4 align-top">
                      <div className="flex items-center gap-1.5">
                        <PaymentIcon className={`w-4 h-4 ${paymentColor}`} />
                        <span className={`text-[11px] font-bold ${paymentColor}`}>{paymentStatus}</span>
                      </div>
                    </td>

                    {/* TOTAL */}
                    <td className="px-5 py-4 align-top font-black text-[#e8eaf0] text-sm">
                      ৳ {Number(order.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>

                    {/* DATE */}
                    <td className="px-5 py-4 align-top">
                      <p className="text-[11px] text-[#8a95a8] font-bold mb-0.5">{order.date}</p>
                      <p className="text-[10px] text-[#4a5568]">{new Date(order.created_at || new Date()).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                    </td>

                    {/* ACTIONS */}
                    <td className="px-5 py-4 align-top text-center relative z-[1]">
                      <div className="group/btn relative inline-block">
                        <button className="p-1.5 text-[#8a95a8] hover:text-white bg-transparent border border-white/10 rounded-md transition-colors hover:bg-white/5">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {/* Hidden Dropdown (Hover activated for simplicity, or we can make it clickable if needed) */}
                        <div className="absolute right-0 top-full mt-1 w-32 bg-[#131929] border border-white/10 rounded-lg shadow-xl opacity-0 invisible group-hover/btn:opacity-100 group-hover/btn:visible transition-all z-[100] p-1 flex flex-col">
                           <button onClick={() => openView(order)} className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-[#e8eaf0] hover:bg-white/5 rounded-md text-left">
                             <Eye className="w-3.5 h-3.5 text-[#60a5fa]" /> View
                           </button>
                           <button onClick={() => handleEdit(order)} className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-[#e8eaf0] hover:bg-white/5 rounded-md text-left">
                             <Pencil className="w-3.5 h-3.5 text-[#f0c040]" /> Edit
                           </button>
                           <button onClick={() => handleDelete(order.id)} className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-400/10 rounded-md text-left">
                             <Trash2 className="w-3.5 h-3.5" /> Delete
                           </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
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