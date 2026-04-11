'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-utils';
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
};

type Order = {
  id: string;
  order_no: string;
  type: 'sales' | 'purchase';
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
  pending:   'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100   text-blue-700',
  delivered: 'bg-green-100  text-green-700',
  cancelled: 'bg-red-100    text-red-600',
};

// ─── Main content ─────────────────────────────────────────────────────
function OrdersContent() {
  const searchParams  = useSearchParams();
  const router        = useRouter();
  const tab           = searchParams.get('tab') ?? 'sales';
  const isSales       = tab === 'sales';
  const orderType     = isSales ? 'sales' : 'purchase';

  // ── list state ──
  const [orders,       setOrders]       = useState<Order[]>([]);
  const [contacts,     setContacts]     = useState<any[]>([]);
  const [products,     setProducts]     = useState<any[]>([]);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [showForm,     setShowForm]     = useState(false);
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [submitting,   setSubmitting]   = useState(false);

  // ── view modal state ──
  const [viewingOrder,  setViewingOrder]  = useState<Order | null>(null);
  const [stockMap,      setStockMap]      = useState<Record<string, number>>({});
  const [loadingStock,  setLoadingStock]  = useState(false);

  // ── form state ──
  const emptyForm = {
    contact_id:   '',
    contact_name: '',
    status:       'pending' as Order['status'],
    date:         new Date().toISOString().slice(0, 10),
  };
  const [formData,  setFormData]  = useState(emptyForm);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [itemForm,   setItemForm]   = useState<any>({
    product_id: '', product_name: '', quantity: 1, unit: '', unit_price: '',
  });

  // ── fetch ──
  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('type', orderType)
      .order('created_at', { ascending: false });
    if (error) handleSupabaseError(error, 'list', 'orders');
    else setOrders((data ?? []) as Order[]);
  };

  const fetchContacts = async () => {
    const type = isSales ? 'customer' : 'supplier';
    const { data } = await supabase.from('contacts').select('id,name,shop_name').eq('type', type);
    setContacts(data ?? []);
  };

  const fetchProducts = async () => {
    const category = isSales ? 'finished-goods' : 'raw-materials';
    const { data } = await supabase.from('products').select('id,name,price,cost,unit').eq('category', category);
    setProducts(data ?? []);
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
    const subtotal = itemForm.quantity * itemForm.unit_price;
    setOrderItems(prev => [...prev, { ...itemForm, subtotal }]);
    setItemForm({ product_id: '', product_name: '', quantity: 1, unit: '', unit_price: '' });
  };

  const removeItem = (idx: number) =>
    setOrderItems(prev => prev.filter((_, i) => i !== idx));

  const orderTotal = orderItems.reduce((s, i) => s + i.subtotal, 0);

  // ── product select helper ──
  const selectProduct = (id: string) => {
    const p = products.find(x => x.id === id);
    if (!p) return;
    // For purchase: prefer cost, fallback to price. For sales: prefer price, fallback to cost.
    const autoPrice = isSales
      ? (Number(p.price) || Number(p.cost) || 0)
      : (Number(p.cost)  || Number(p.price) || 0);
    setItemForm((prev: any) => ({
      ...prev,
      product_id:   p.id,
      product_name: p.name,
      unit:         p.unit || 'pcs',
      unit_price:   autoPrice,
    }));
  };

  // ── submit ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (orderItems.length === 0) { alert('Please add at least one product.'); return; }
    setSubmitting(true);
    try {
      const contactLabel = formData.contact_name ||
        contacts.find(c => c.id === formData.contact_id)?.name || '';

      const payload = {
        type:         orderType,
        contact_id:   formData.contact_id || null,
        contact_name: contactLabel,
        items:        orderItems,
        total:        orderTotal,
        status:       formData.status,
        date:         formData.date,
      };

      if (editingId) {
        const { error } = await supabase.from('orders').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const order_no = `ORD-${Date.now().toString().slice(-7)}`;
        const { error } = await supabase.from('orders').insert({ ...payload, order_no });
        if (error) throw error;
      }
      resetForm();
      fetchOrders();
    } catch (err) {
      handleSupabaseError(err, editingId ? 'update' : 'create', 'orders');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(emptyForm);
    setOrderItems([]);
    setItemForm({ product_id: '', product_name: '', quantity: 1, unit: '', unit_price: '' });
  };

  const handleEdit = (order: Order) => {
    setFormData({
      contact_id:   order.contact_id ?? '',
      contact_name: order.contact_name ?? '',
      status:       order.status,
      date:         order.date,
    });
    setOrderItems(order.items ?? []);
    setEditingId(order.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this order?')) return;
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) handleSupabaseError(error, 'delete', 'orders');
    else fetchOrders();
  };

  const headingTitle = isSales ? 'Sales Orders' : 'Purchase Orders';

  // ── open view modal and fetch live stock ──
  const openView = async (order: Order) => {
    setViewingOrder(order);
    setLoadingStock(true);
    const ids = (order.items ?? []).map(i => i.product_id).filter(Boolean);
    if (ids.length > 0) {
      const { data } = await supabase
        .from('products')
        .select('id, stock_quantity')
        .in('id', ids);
      const map: Record<string, number> = {};
      (data ?? []).forEach((p: any) => { map[p.id] = Number(p.stock_quantity ?? 0); });
      setStockMap(map);
    } else {
      setStockMap({});
    }
    setLoadingStock(false);
  };

  // ── generate invoice from order ──
  const generateInvoice = (order: Order) => {
    const invoiceTab = order.type === 'sales' ? 'sell' : 'buy';
    const payload = {
      contact_id:   order.contact_id ?? '',
      contact_name: order.contact_name ?? '',
      date:         order.date,
      items: (order.items ?? []).map(i => ({
        product_id: i.product_id,
        quantity:   i.quantity,
        price:      i.unit_price,
      })),
    };
    const encoded = encodeURIComponent(JSON.stringify(payload));
    router.push(`/invoices?tab=${invoiceTab}&from_order=${encoded}`);
  };

  return (
    <div className="pb-10">

      {/* ─── VIEW ORDER MODAL ─── */}
      {viewingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex justify-between items-start p-6 border-b border-gray-100 bg-gradient-to-r from-indigo-700 to-indigo-900 text-white rounded-t-2xl">
              <div>
                <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest mb-1">Order Details</p>
                <h2 className="text-2xl font-black">{viewingOrder.order_no}</h2>
                <div className="flex items-center gap-3 mt-2 text-sm text-indigo-100">
                  <span>{viewingOrder.contact_name || '—'}</span>
                  <span>·</span>
                  <span>{viewingOrder.date}</span>
                  <span>·</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold capitalize ${statusStyles[viewingOrder.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {viewingOrder.status}
                  </span>
                </div>
              </div>
              <button onClick={() => setViewingOrder(null)} className="text-indigo-200 hover:text-white hover:bg-indigo-800 p-2 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Product Stock Table */}
            <div className="p-6">
              <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Package className="w-4 h-4" /> Products & Stock Availability
              </h3>

              {loadingStock ? (
                <div className="py-10 text-center text-indigo-600 font-bold animate-pulse">Loading stock data...</div>
              ) : (
                <div className="space-y-3">
                  {(viewingOrder.items ?? []).map((item, idx) => {
                    const inStock = stockMap[item.product_id] ?? 0;
                    const ordered = Number(item.quantity);
                    const isSufficient = inStock >= ordered;
                    const isPartial = inStock > 0 && inStock < ordered;

                    return (
                      <div key={idx} className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isSufficient ? 'border-green-200 bg-green-50/40' :
                        isPartial    ? 'border-yellow-200 bg-yellow-50/40' :
                                       'border-red-200 bg-red-50/40'
                      }`}>
                        <div className="flex items-center gap-3">
                          {isSufficient ? (
                            <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                          ) : isPartial ? (
                            <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                          )}
                          <div>
                            <p className="font-bold text-gray-900">{item.product_name}</p>
                            <p className="text-xs text-gray-500 font-medium mt-0.5">
                              Unit Price: ৳ {item.unit_price} · Subtotal: ৳ {item.subtotal?.toFixed(2)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {/* Ordered badge */}
                          <div className="text-center bg-indigo-100 rounded-xl px-4 py-2">
                            <p className="text-xs font-bold text-indigo-500 uppercase tracking-wide">Ordered</p>
                            <p className="text-xl font-black text-indigo-700">{ordered} <span className="text-xs font-semibold">{item.unit}</span></p>
                          </div>

                          <span className="text-gray-400 font-bold">out of</span>

                          {/* In Stock badge */}
                          <div className={`text-center rounded-xl px-4 py-2 ${
                            isSufficient ? 'bg-green-100' : isPartial ? 'bg-yellow-100' : 'bg-red-100'
                          }`}>
                            <p className={`text-xs font-bold uppercase tracking-wide ${
                              isSufficient ? 'text-green-600' : isPartial ? 'text-yellow-600' : 'text-red-500'
                            }`}>In Stock</p>
                            <p className={`text-xl font-black ${
                              isSufficient ? 'text-green-700' : isPartial ? 'text-yellow-700' : 'text-red-600'
                            }`}>{inStock} <span className="text-xs font-semibold">{item.unit}</span></p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Total */}
              <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between items-center">
                <span className="text-sm font-bold text-gray-500">Order Total</span>
                <span className="text-2xl font-black text-indigo-700">৳ {Number(viewingOrder.total).toFixed(2)}</span>
              </div>

              {/* Legend */}
              <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-green-500" /> Sufficient stock</span>
                <span className="flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-yellow-500" /> Partial stock</span>
                <span className="flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5 text-red-500" /> Out of stock</span>
              </div>

              {/* Generate Invoice Button */}
              <div className="mt-6 pt-5 border-t border-gray-100 flex justify-end">
                <button
                  onClick={() => generateInvoice(viewingOrder)}
                  className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold px-6 py-3 rounded-xl shadow-lg transition-all hover:shadow-xl"
                >
                  <FileText className="w-5 h-5" />
                  Generate Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ShoppingCart className="w-6 h-6 text-indigo-600" />
          {headingTitle}
        </h1>
        <button
          onClick={() => { if (!showForm) resetForm(); setShowForm(!showForm); }}
          className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 hover:bg-indigo-700 font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Order
        </button>
      </div>

      {/* ─── FORM ─── */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
          <h2 className="text-lg font-bold text-gray-800 mb-5">
            {editingId ? 'Edit Order' : `New ${headingTitle.slice(0, -1)}`}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 mb-6">

            {/* Contact */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">
                {isSales ? 'Customer Name' : 'Supplier Name'}
              </label>
              <select
                value={formData.contact_id}
                onChange={e => {
                  const c = contacts.find(x => x.id === e.target.value);
                  setFormData({ ...formData, contact_id: e.target.value, contact_name: c?.name ?? '' });
                }}
                className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">— Select {isSales ? 'Customer' : 'Supplier'} —</option>
                {contacts.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.shop_name ? ` (${c.shop_name})` : ''}</option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Order Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Status</label>
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value as Order['status'] })}
                className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* ── Add Product Row ── */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
            <p className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-indigo-500" /> Add Product
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Product</label>
                <select
                  value={itemForm.product_id}
                  onChange={e => selectProduct(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">— Select Product —</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Quantity</label>
                <input
                  type="number" min="0.01" step="0.01"
                  value={itemForm.quantity}
                  onChange={e => setItemForm({ ...itemForm, quantity: Number(e.target.value) })}
                  className="w-full border border-gray-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Unit Price</label>
                <input
                  type="number" min="0" step="0.01"
                  value={itemForm.unit_price}
                  onChange={e => setItemForm({ ...itemForm, unit_price: e.target.value === '' ? '' : Number(e.target.value) })}
                  className="w-full border border-gray-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <button
                  type="button"
                  onClick={addItem}
                  className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
            </div>

            {/* Item list */}
            {orderItems.length > 0 && (
              <div className="mt-4 rounded-lg overflow-hidden border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Product</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Qty</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Unit Price</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Subtotal</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {orderItems.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 font-medium text-gray-800">{item.product_name}</td>
                        <td className="px-3 py-2 text-gray-600">{item.quantity} {item.unit}</td>
                        <td className="px-3 py-2 text-gray-600">৳ {item.unit_price}</td>
                        <td className="px-3 py-2 font-bold text-gray-800">৳ {item.subtotal.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right">
                          <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600">
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-right text-sm font-bold text-gray-700">Total:</td>
                      <td className="px-3 py-2 text-base font-bold text-indigo-700">৳ {orderTotal.toFixed(2)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 mt-4 border-t border-gray-100 pt-5">
            <button type="button" onClick={resetForm}
              className="bg-white text-gray-700 px-6 py-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 font-bold transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="bg-indigo-600 text-white px-8 py-2.5 rounded-lg hover:bg-indigo-700 font-bold transition-colors shadow-md disabled:opacity-50">
              {submitting ? 'Saving...' : (editingId ? 'Update Order' : 'Save Order')}
            </button>
          </div>
        </form>
      )}

      {/* ─── SEARCH ─── */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by order no or name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          />
        </div>
        <span className="text-sm text-gray-500">{filtered.length} order{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* ─── TABLE ─── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Order No</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">
                  {isSales ? 'Customer' : 'Supplier'}
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Products</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Total</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Date</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-gray-400">
                    <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">No orders found</p>
                  </td>
                </tr>
              ) : filtered.map(order => (
                <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded">
                      {order.order_no}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-800">{order.contact_name || '—'}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-0.5">
                      {(order.items ?? []).slice(0, 2).map((item, i) => (
                        <span key={i} className="text-xs text-gray-600">
                          {item.product_name} × {item.quantity}
                        </span>
                      ))}
                      {(order.items ?? []).length > 2 && (
                        <span className="text-xs text-gray-400">+{order.items.length - 2} more</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-gray-900">৳ {Number(order.total).toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full capitalize ${statusStyles[order.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{order.date}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => openView(order)} className="text-gray-400 hover:text-indigo-600 p-2" title="View Order">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleEdit(order)} className="text-gray-400 hover:text-indigo-600 p-2">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(order.id)} className="text-gray-400 hover:text-red-600 p-2">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20 text-indigo-600 font-bold">Loading Orders...</div>}>
      <OrdersContent />
    </Suspense>
  );
}
