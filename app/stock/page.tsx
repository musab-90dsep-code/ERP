'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-utils';
import { Plus, Trash2, Pencil, Search, Filter, Printer, Download, ChevronDown, Package, Image as ImageIcon, X, Upload, Eye, LayoutGrid, List, Clock, History } from 'lucide-react';

function StockContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab');
  const [products, setProducts] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingProduct, setViewingProduct] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [submitting, setSubmitting] = useState(false);
  const [hasBarcode, setHasBarcode] = useState(false);
  const [showHeads, setShowHeads] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [stockFilter, setStockFilter] = useState('all');
  const [trackedFilter, setTrackedFilter] = useState('all');

  const [visibleColumns, setVisibleColumns] = useState({
    name: true, sku: true, price: true, stock: true, unit: true, barcode: true, actions: true,
  });

  const toggleColumn = (col: string) => {
    setVisibleColumns(prev => ({ ...prev, [col]: !prev[col as keyof typeof prev] }));
  };

  // ── Add Stock Modal State ──
  const [addStockModal, setAddStockModal] = useState<{ product: any } | null>(null);
  const [addStockQty, setAddStockQty] = useState('');
  const [addStockNote, setAddStockNote] = useState('');
  const [addStockSubmitting, setAddStockSubmitting] = useState(false);

  // ── Stock History Modal State ──
  const [historyModal, setHistoryModal] = useState<{ product: any } | null>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [formData, setFormData] = useState<any>({
    name: '', sku: '', price: '', cost: '', stock_quantity: '', is_tracked: true,
    low_stock_alert: false, minimum_stock: '',
    unit: 'pcs', unit_value: 1, barcode: '', use_for_processing: false,
    processing_price_auto: '', processing_price_manual: '',
    image_urls: [] as string[],
    product_heads: [] as string[]
  });

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const isRawMaterials = tab === 'raw-materials';
  const category = tab === 'raw-materials' ? 'raw-materials' : 'finished-goods';

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('category', category)
      .order('created_at', { ascending: false });
    if (error) handleSupabaseError(error, 'list', 'products');
    else setProducts(data ?? []);
  };

  useEffect(() => {
    setSearchQuery('');
    setStockFilter('all');
    setTrackedFilter('all');
    fetchProducts();
  }, [tab]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.dropdown-container')) {
        setShowFilterMenu(false); setShowColumnMenu(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchName = p.name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchSku = p.sku?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchBarcode = p.barcode?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSearch = matchName || matchSku || matchBarcode;

      let matchesFilters = true;
      if (stockFilter === 'low' && (!p.is_tracked || p.stock_quantity >= 5)) matchesFilters = false;
      if (stockFilter === 'in_stock' && (!p.is_tracked || p.stock_quantity < 5)) matchesFilters = false;
      if (trackedFilter === 'tracked' && !p.is_tracked) matchesFilters = false;
      if (trackedFilter === 'untracked' && p.is_tracked) matchesFilters = false;

      return matchesSearch && matchesFilters;
    });
  }, [products, searchQuery, stockFilter, trackedFilter]);

  // ── Add Stock Handler ──
  const handleAddStock = async () => {
    if (!addStockModal || !addStockQty || Number(addStockQty) <= 0) return;
    setAddStockSubmitting(true);
    try {
      const product = addStockModal.product;
      const stockBefore = product.stock_quantity ?? 0;
      const stockAfter = stockBefore + Number(addStockQty);

      const { error: updateError } = await supabase
        .from('products')
        .update({ stock_quantity: stockAfter })
        .eq('id', product.id);
      if (updateError) throw updateError;

      const { error: histError } = await supabase
        .from('stock_history')
        .insert({
          product_id: product.id,
          item_type: category,
          item_name: product.name,
          quantity_added: Number(addStockQty),
          stock_before: stockBefore,
          stock_after: stockAfter,
          note: addStockNote || null,
        });
      if (histError) throw histError;

      fetchProducts();
      setAddStockModal(null);
      setAddStockQty('');
      setAddStockNote('');
    } catch (e: any) {
      alert("Update Failed: " + (e.message || "Unknown Error"));
      handleSupabaseError(e, 'update', 'products');
    } finally {
      setAddStockSubmitting(false);
    }
  };

  // ── Fetch Stock History ──
  const fetchStockHistory = async (productId: string) => {
    setHistoryLoading(true);
    setHistoryData([]);
    const { data, error } = await supabase
      .from('stock_history')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });
    if (!error) setHistoryData(data ?? []);
    setHistoryLoading(false);
  };

  // Image Upload Logic (Max 5)
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      const totalImages = imageFiles.length + filesArray.length;
      if (totalImages > 5) { alert('You can only upload a maximum of 5 images.'); return; }
      setImageFiles(prev => [...prev, ...filesArray]);
      const newPreviews = filesArray.map(file => URL.createObjectURL(file));
      setImagePreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
    if (formData.image_urls[index]) {
      setFormData((prev: any) => ({
        ...prev,
        image_urls: prev.image_urls.filter((_: any, i: number) => i !== index)
      }));
    }
  };

  const uploadImagesToSupabase = async (): Promise<string[]> => {
    const uploadedUrls: string[] = [...formData.image_urls];
    for (const file of imageFiles) {
      const path = `products/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
      const { error } = await supabase.storage.from('product-files').upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from('product-files').getPublicUrl(path);
        uploadedUrls.push(data.publicUrl);
      }
    }
    return uploadedUrls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const finalImageUrls = imageFiles.length > 0 ? await uploadImagesToSupabase() : formData.image_urls;
      let finalSku = formData.sku.trim();
      if (!finalSku) finalSku = `SKU-${Date.now().toString().slice(-6)}`;

      const payload = {
        category,
        name: formData.name,
        sku: finalSku,
        price: formData.price === '' ? 0 : Number(formData.price),
        cost: formData.cost === '' ? 0 : Number(formData.cost),
        stock_quantity: formData.stock_quantity === '' ? 0 : Number(formData.stock_quantity),
        unit: formData.unit || 'pcs',
        unit_value: formData.unit_value ? Number(formData.unit_value) : 1,
        barcode: formData.barcode || null,
        is_tracked: !!formData.is_tracked,
        low_stock_alert: !!formData.low_stock_alert,
        minimum_stock: formData.minimum_stock === '' ? 0 : Number(formData.minimum_stock),
        use_for_processing: !!formData.use_for_processing,
        processing_price_auto: formData.processing_price_auto === '' ? 0 : Number(formData.processing_price_auto),
        processing_price_manual: formData.processing_price_manual === '' ? 0 : Number(formData.processing_price_manual),
        image_urls: finalImageUrls,
        product_heads: category === 'finished-goods' && formData.product_heads ? formData.product_heads.filter((h: string) => h.trim()) : [],
      };

      if (editingId) {
        const { error } = await supabase.from('products').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('products').insert(payload);
        if (error) throw error;
      }
      resetEmpForm();
      fetchProducts();
    } catch (error) {
      handleSupabaseError(error, editingId ? 'update' : 'create', 'products');
    } finally {
      setSubmitting(false);
    }
  };

  const resetEmpForm = () => {
    setShowForm(false);
    setEditingId(null);
    setHasBarcode(false);
    setShowHeads(false);
    setFormData({
      name: '', sku: '', price: '', cost: '', stock_quantity: '', is_tracked: true,
      low_stock_alert: false, minimum_stock: '',
      unit: 'pcs', barcode: '', use_for_processing: false, processing_price_auto: '', processing_price_manual: '', image_urls: [],
      product_heads: []
    });
    setImageFiles([]);
    setImagePreviews([]);
  };

  const handleEdit = (product: any) => {
    setFormData({
      name: product.name || '',
      sku: product.sku || '',
      price: product.price ?? '',
      cost: product.cost ?? '',
      stock_quantity: product.stock_quantity ?? '',
      is_tracked: product.is_tracked ?? true,
      low_stock_alert: product.low_stock_alert ?? false,
      minimum_stock: product.minimum_stock ?? '',
      unit: product.unit || 'pcs',
      barcode: product.barcode || '',
      use_for_processing: product.use_for_processing ?? false,
      processing_price_auto: product.processing_price_auto ?? '',
      processing_price_manual: product.processing_price_manual ?? '',
      image_urls: product.image_urls || [],
      product_heads: product.product_heads || []
    });
    setHasBarcode(!!product.barcode);
    const heads = product.product_heads || [];
    setShowHeads(heads.length > 0);
    setImagePreviews(product.image_urls || []);
    setImageFiles([]);
    setEditingId(product.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) handleSupabaseError(error, 'delete', 'products');
    else fetchProducts();
  };

  const downloadCSV = () => {
    const csvRows = ['Name,Price,Stock,Unit,Barcode,Tracked'];
    filteredProducts.forEach(p => {
      csvRows.push(`"${p.name}",${p.price},${p.stock_quantity},"${p.unit}","${p.barcode || ''}","${p.is_tracked ? 'Yes' : 'No'}"`);
    });
    const csvData = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(csvData);
    link.download = `${category}-export.csv`;
    link.click();
  };

  const headingTitle = isRawMaterials ? 'Raw Materials' : 'Finished Goods';

  // ── Stock status helper ──
  const isLowStock = (p: any) =>
    p.is_tracked && p.low_stock_alert && p.stock_quantity <= (p.minimum_stock || 0);

  return (
    <div className="pb-10 dropdown-container">
      {/* ── Header ── */}
      <div className="flex justify-between items-center mb-6 print:hidden">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Package className="w-6 h-6 text-indigo-600" />
          {headingTitle} Management
        </h1>
        <div className="flex items-center gap-3">
          <div className="bg-white border border-gray-200 rounded-lg p-1 flex items-center shadow-sm">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'card' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
              title="Card View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => { if (!showForm) resetEmpForm(); setShowForm(!showForm); }}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 hover:bg-indigo-700 font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {/* ── Form Section ── */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8 print:hidden">
          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
              <ImageIcon className="w-4 h-4" /> Product Images (Max 5)
            </label>
            <div className="flex flex-wrap gap-4 items-start">
              {imagePreviews.map((src, idx) => (
                <div key={idx} className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-300 shadow-sm group">
                  <img src={src} alt="preview" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removeImage(idx)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {imagePreviews.length < 5 && (
                <label className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors text-gray-500 hover:text-indigo-600">
                  <Upload className="w-6 h-6 mb-1" />
                  <span className="text-xs font-semibold">Upload</span>
                  <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageChange} />
                </label>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Product Name</label>
              <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Enter product name" className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Product ID (Auto-generated)</label>
              <input type="text" value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value })} placeholder="Leave blank to auto-generate" className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Price</label>
              <input required type="number" step="0.01" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value === '' ? '' : Number(e.target.value) })} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Unit</label>
              <select value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                <option value="pcs">Pieces (pcs)</option>
                <option value="kg">Kilogram (kg)</option>
                <option value="g">Gram (g)</option>
                <option value="ltr">Liter (ltr)</option>
                <option value="ml">Milliliter (ml)</option>
                <option value="box">Box</option>
                <option value="dozen">Dozen</option>
                <option value="meter">Meter (m)</option>
                <option value="feet">Feet (ft)</option>
              </select>
            </div>
            <div className="flex flex-col justify-center mt-6">
              <label className="flex items-center cursor-pointer mb-2">
                <input type="checkbox" checked={formData.is_tracked} onChange={e => setFormData({ ...formData, is_tracked: e.target.checked })} className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" />
                <span className="text-sm font-bold text-gray-800 ml-3">Track stock</span>
              </label>
              {formData.is_tracked && (
                <div className="flex flex-col gap-3 ml-8">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Current stock:</span>
                    <input type="number" value={formData.stock_quantity} onChange={e => setFormData({ ...formData, stock_quantity: e.target.value === '' ? '' : Number(e.target.value) })} className="w-24 border border-gray-200 rounded-lg p-1.5 outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <label className="flex items-center cursor-pointer">
                    <input type="checkbox" checked={formData.low_stock_alert} onChange={e => setFormData({ ...formData, low_stock_alert: e.target.checked })} className="w-4 h-4 text-orange-500 rounded border-gray-300 focus:ring-orange-500" />
                    <span className="text-sm font-semibold text-gray-700 ml-2">Low stock alert</span>
                  </label>
                  {formData.low_stock_alert && (
                    <div className="flex items-center gap-2 ml-6">
                      <span className="text-sm text-gray-600">Minimum stock:</span>
                      <input type="number" value={formData.minimum_stock} onChange={e => setFormData({ ...formData, minimum_stock: e.target.value === '' ? '' : Number(e.target.value) })} className="w-24 border border-gray-200 rounded-lg p-1.5 outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col justify-start mt-2">
              <label className="flex items-center cursor-pointer mb-2">
                <input type="checkbox" checked={hasBarcode} onChange={e => { setHasBarcode(e.target.checked); if (!e.target.checked) setFormData({ ...formData, barcode: '' }); }} className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" />
                <span className="text-sm font-bold text-gray-800 ml-3">Add barcode</span>
              </label>
              {hasBarcode && (
                <div className="ml-8">
                  <input type="text" value={formData.barcode} onChange={e => setFormData({ ...formData, barcode: e.target.value })} placeholder="Scan or type barcode" className="w-full border border-gray-200 rounded-lg p-1.5 outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              )}
            </div>

            {isRawMaterials && (
              <div className="md:col-span-2 flex flex-col justify-start mt-2 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                <label className="flex items-center cursor-pointer mb-2">
                  <input type="checkbox" checked={formData.use_for_processing} onChange={e => setFormData({ ...formData, use_for_processing: e.target.checked })} className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" />
                  <span className="text-sm font-bold text-gray-800 ml-3">Use for processing material</span>
                </label>
                {formData.use_for_processing && (
                  <div className="flex flex-col gap-2 ml-8 mt-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 font-semibold w-60">Price for processing in auto:</span>
                      <input type="number" step="0.01" value={formData.processing_price_auto} onChange={e => setFormData({ ...formData, processing_price_auto: e.target.value === '' ? '' : Number(e.target.value) })} className="w-32 border border-gray-200 rounded-lg p-1.5 outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 font-semibold w-60">Price for processing manually:</span>
                      <input type="number" step="0.01" value={formData.processing_price_manual} onChange={e => setFormData({ ...formData, processing_price_manual: e.target.value === '' ? '' : Number(e.target.value) })} className="w-32 border border-gray-200 rounded-lg p-1.5 outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {!isRawMaterials && (
              <div className="md:col-span-3 mt-2 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                <label className="flex items-center gap-3 cursor-pointer mb-1 w-max select-none">
                  <input
                    type="checkbox"
                    checked={showHeads}
                    onChange={e => {
                      setShowHeads(e.target.checked);
                      if (!e.target.checked) setFormData({ ...formData, product_heads: [] });
                      else if (formData.product_heads.length === 0) setFormData({ ...formData, product_heads: [''] });
                    }}
                    className="w-5 h-5 accent-indigo-600"
                  />
                  <span className="text-sm font-bold text-indigo-800">Add Product Heads (Categories / Variants)</span>
                </label>
                <p className="text-xs text-indigo-500 mb-3 ml-8">e.g. Size: S, M, L — or Color: Red, Blue — or Brand: A, B</p>
                {showHeads && (
                  <div className="animate-in fade-in slide-in-from-top-2 ml-2">
                    <div className="flex flex-col gap-2 mb-3">
                      {formData.product_heads.map((head: string, hi: number) => (
                        <div key={hi} className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-indigo-400 w-5 text-right shrink-0">{hi + 1}.</span>
                          <input
                            type="text"
                            placeholder="e.g. Large, Red, Premium Grade..."
                            value={head}
                            onChange={e => {
                              const updated = [...formData.product_heads];
                              updated[hi] = e.target.value;
                              setFormData({ ...formData, product_heads: updated });
                            }}
                            className="flex-1 border border-indigo-200 rounded-lg p-2 text-sm font-bold text-indigo-900 bg-white outline-none focus:ring-2 focus:ring-indigo-400"
                          />
                          {formData.product_heads.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, product_heads: formData.product_heads.filter((_: string, i: number) => i !== hi) })}
                              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, product_heads: [...formData.product_heads, ''] })}
                      className="text-xs font-bold text-indigo-600 bg-white border border-indigo-200 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Another Head
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="md:col-span-3 flex justify-end gap-3 mt-4 border-t border-gray-100 pt-5">
              <button type="button" onClick={resetEmpForm} className="bg-white text-gray-700 px-6 py-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 font-bold transition-colors">Cancel</button>
              <button type="submit" disabled={submitting} className="bg-indigo-600 text-white px-8 py-2.5 rounded-lg hover:bg-indigo-700 font-bold transition-colors shadow-md disabled:opacity-50">
                {submitting ? 'Saving...' : (editingId ? 'Update Product' : 'Save Product')}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ── Table / Card View ── */}
      {viewMode === 'table' ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto min-h-[300px]">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {visibleColumns.name && <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Product Details</th>}
                  {!isRawMaterials && visibleColumns.sku && <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">SKU</th>}
                  {visibleColumns.barcode && <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Barcode</th>}
                  {visibleColumns.price && <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Price</th>}
                  {visibleColumns.stock && <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Stock</th>}
                  {visibleColumns.actions && <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-gray-400">
                      <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                      <p className="font-semibold">No products found</p>
                    </td>
                  </tr>
                )}
                {filteredProducts.map(product => (
                  <tr key={product.id} className="hover:bg-gray-50/50 transition-colors">
                    {visibleColumns.name && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0">
                            {product.image_urls && product.image_urls.length > 0 ? (
                              <img src={product.image_urls[0]} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-5 h-5 text-gray-400 m-auto mt-2.5" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800">{product.name}</p>
                            {product.use_for_processing && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">For Processing</span>}
                          </div>
                        </div>
                      </td>
                    )}
                    {!isRawMaterials && visibleColumns.sku && <td className="px-6 py-4 text-sm text-gray-600">{product.sku || '-'}</td>}
                    {visibleColumns.barcode && <td className="px-6 py-4 text-sm text-gray-600">{product.barcode || '-'}</td>}
                    {visibleColumns.price && <td className="px-6 py-4 font-bold text-gray-900">৳ {product.price}</td>}
                    {visibleColumns.stock && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${isLowStock(product) ? 'text-red-600' : 'text-green-600'}`}>
                            {product.is_tracked ? product.stock_quantity : 'N/A'}
                          </span>
                          <span className="text-xs text-gray-500 uppercase">{product.unit_value > 1 ? `${product.unit_value} ${product.unit}` : product.unit}</span>
                          {isLowStock(product) && (
                            <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">Low</span>
                          )}
                        </div>
                      </td>
                    )}
                    {visibleColumns.actions && (
                      <td className="px-6 py-4 text-right">
                        {/* ── Add Stock Button ── */}
                        {product.is_tracked && (
                          <button
                            onClick={() => { setAddStockModal({ product }); setAddStockQty(''); setAddStockNote(''); }}
                            title="Add Stock"
                            className="text-gray-400 hover:text-green-600 p-2 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        )}
                        {/* ── Stock History Button ── */}
                        {product.is_tracked && (
                          <button
                            onClick={() => { setHistoryModal({ product }); fetchStockHistory(product.id); }}
                            title="Stock History"
                            className="text-gray-400 hover:text-indigo-500 p-2 transition-colors"
                          >
                            <Clock className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => setViewingProduct(product)} className="text-gray-400 hover:text-blue-600 p-2"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => handleEdit(product)} className="text-gray-400 hover:text-indigo-600 p-2"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(product.id)} className="text-gray-400 hover:text-red-600 p-2"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map(product => (
            <div key={product.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col hover:shadow-md transition-shadow group">
              <div className="relative aspect-video bg-gray-100 overflow-hidden flex-shrink-0">
                {product.image_urls && product.image_urls.length > 0 ? (
                  <img src={product.image_urls[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <Package className="w-12 h-12 text-gray-400 m-auto mt-8" />
                )}
                {product.use_for_processing && (
                  <div className="absolute top-2 left-2 bg-indigo-600/90 backdrop-blur text-white text-[10px] px-2 py-1 rounded-md font-bold shadow-sm">For Processing</div>
                )}
                <div className="absolute top-2 right-2 flex gap-1 transform sm:translate-y-[-120%] sm:opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-200">
                  {product.is_tracked && (
                    <button
                      onClick={() => { setAddStockModal({ product }); setAddStockQty(''); setAddStockNote(''); }}
                      title="Add Stock"
                      className="bg-white/90 backdrop-blur p-1.5 rounded-md text-gray-700 hover:text-green-600 shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                  {product.is_tracked && (
                    <button
                      onClick={() => { setHistoryModal({ product }); fetchStockHistory(product.id); }}
                      title="Stock History"
                      className="bg-white/90 backdrop-blur p-1.5 rounded-md text-gray-700 hover:text-indigo-500 shadow-sm"
                    >
                      <Clock className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => setViewingProduct(product)} className="bg-white/90 backdrop-blur p-1.5 rounded-md text-gray-700 hover:text-blue-600 shadow-sm"><Eye className="w-4 h-4" /></button>
                  <button onClick={() => handleEdit(product)} className="bg-white/90 backdrop-blur p-1.5 rounded-md text-gray-700 hover:text-indigo-600 shadow-sm"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(product.id)} className="bg-white/90 backdrop-blur p-1.5 rounded-md text-gray-700 hover:text-red-600 shadow-sm"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="p-4 flex flex-col flex-grow">
                <div className="flex justify-between items-start mb-2 gap-2">
                  <h3 className="font-bold text-gray-900 line-clamp-2 leading-tight">{product.name}</h3>
                  <div className="bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-md font-bold text-sm whitespace-nowrap">৳ {product.price}</div>
                </div>
                <div className="text-xs text-gray-500 mb-4 flex flex-col gap-1">
                  {!isRawMaterials && <span>SKU: {product.sku || '-'}</span>}
                  <span>Barcode: {product.barcode || '-'}</span>
                </div>
                <div className="mt-auto pt-4 border-t border-gray-100 flex justify-between items-center">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`font-bold ${isLowStock(product) ? 'text-red-600' : 'text-green-600'}`}>
                      {product.is_tracked ? product.stock_quantity : 'N/A'}
                    </span>
                    <span className="text-xs text-gray-500 uppercase">{product.unit_value > 1 ? `${product.unit_value} ${product.unit}` : product.unit}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {filteredProducts.length === 0 && (
            <div className="col-span-full py-16 text-center text-gray-500 bg-white rounded-xl border border-gray-200 border-dashed">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-lg font-medium">No products found</p>
              <p className="text-sm">Try adjusting your filters or add a new product.</p>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════
          ADD STOCK MODAL
      ══════════════════════════════════════ */}
      {addStockModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="bg-green-600 px-6 py-4 flex justify-between items-center rounded-t-2xl">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5" /> Add Stock
              </h2>
              <button onClick={() => setAddStockModal(null)} className="text-white/80 hover:text-white p-1.5 rounded-lg bg-green-700/40 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Product info */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-white border border-gray-200 overflow-hidden flex-shrink-0">
                  {addStockModal.product.image_urls?.[0] ? (
                    <img src={addStockModal.product.image_urls[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-5 h-5 text-gray-400 m-auto mt-3.5" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-gray-900">{addStockModal.product.name}</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Current Stock:{' '}
                    <span className="font-bold text-green-600">
                      {addStockModal.product.stock_quantity ?? 0} {addStockModal.product.unit}
                    </span>
                  </p>
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Quantity to Add</label>
                <input
                  type="number"
                  min="1"
                  autoFocus
                  value={addStockQty}
                  onChange={e => setAddStockQty(e.target.value)}
                  placeholder="Enter quantity"
                  className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-green-500 text-lg font-semibold"
                />
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Note / Reason <span className="font-normal text-gray-400">(optional)</span></label>
                <input
                  type="text"
                  value={addStockNote}
                  onChange={e => setAddStockNote(e.target.value)}
                  placeholder="e.g. Restocked from supplier"
                  className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Preview */}
              {addStockQty && Number(addStockQty) > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    <span className="font-semibold">{addStockModal.product.stock_quantity ?? 0}</span>
                    <span className="mx-2 text-gray-400">+</span>
                    <span className="font-semibold text-green-600">{addStockQty}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 mb-0.5">New Stock</p>
                    <p className="text-xl font-bold text-green-700">
                      {(addStockModal.product.stock_quantity ?? 0) + Number(addStockQty)} {addStockModal.product.unit}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 pb-6 flex gap-3 justify-end border-t border-gray-100 pt-4">
              <button
                onClick={() => setAddStockModal(null)}
                className="px-5 py-2.5 border border-gray-200 rounded-lg font-bold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddStock}
                disabled={addStockSubmitting || !addStockQty || Number(addStockQty) <= 0}
                className="px-6 py-2.5 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                {addStockSubmitting ? 'Saving...' : 'Add Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          STOCK HISTORY MODAL
      ══════════════════════════════════════ */}
      {historyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center rounded-t-2xl flex-shrink-0">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <History className="w-5 h-5" />
                Stock History — {historyModal.product.name}
              </h2>
              <button
                onClick={() => setHistoryModal(null)}
                className="text-white/80 hover:text-white p-1.5 rounded-lg bg-indigo-700/40 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6">
              {historyLoading ? (
                <div className="flex items-center justify-center py-16 text-indigo-600">
                  <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mr-3" />
                  <span className="font-bold">Loading history...</span>
                </div>
              ) : historyData.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <Clock className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="font-semibold text-lg">No stock history yet</p>
                  <p className="text-sm mt-1">Stock additions will appear here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                        <th className="px-4 py-3 text-left font-bold rounded-l-lg">Date & Time</th>
                        <th className="px-4 py-3 text-right font-bold">Added</th>
                        <th className="px-4 py-3 text-right font-bold">Before</th>
                        <th className="px-4 py-3 text-right font-bold">After</th>
                        <th className="px-4 py-3 text-left font-bold rounded-r-lg">Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {historyData.map((h: any, idx: number) => (
                        <tr key={h.id} className={`hover:bg-gray-50 transition-colors ${idx === 0 ? 'bg-green-50/50' : ''}`}>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-medium">
                            {new Date(h.created_at).toLocaleString('en-BD', {
                              day: '2-digit', month: 'short', year: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="inline-flex items-center gap-1 font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-md">
                              +{h.quantity_added}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-500 font-medium">{h.stock_before}</td>
                          <td className="px-4 py-3 text-right font-bold text-gray-800">{h.stock_after}</td>
                          <td className="px-4 py-3 text-gray-500 italic">{h.note || <span className="not-italic text-gray-300">—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center flex-shrink-0 bg-gray-50 rounded-b-2xl">
              <p className="text-sm text-gray-500">
                {historyData.length > 0 && <span>{historyData.length} record{historyData.length > 1 ? 's' : ''} found</span>}
              </p>
              <button
                onClick={() => setHistoryModal(null)}
                className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-100 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          VIEW PRODUCT MODAL (unchanged)
      ══════════════════════════════════════ */}
      {viewingProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center flex-shrink-0">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Package className="w-5 h-5" /> Product Details
              </h2>
              <button onClick={() => setViewingProduct(null)} className="text-white/80 hover:text-white bg-indigo-700/50 hover:bg-indigo-700 p-1.5 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="flex flex-col sm:flex-row gap-6 mb-6">
                <div className="w-32 h-32 rounded-xl bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0 shadow-sm mx-auto sm:mx-0">
                  {viewingProduct.image_urls && viewingProduct.image_urls.length > 0 ? (
                    <img src={viewingProduct.image_urls[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-10 h-10 text-gray-400 m-auto mt-11" />
                  )}
                </div>
                <div className="text-center sm:text-left flex-1 border-b sm:border-b-0 border-gray-100 pb-4 sm:pb-0">
                  <h3 className="text-2xl font-bold text-gray-900 mb-1">{viewingProduct.name}</h3>
                  <div className="text-sm text-gray-500 mb-3 uppercase tracking-wide">
                    {viewingProduct.category === 'raw-materials' ? 'Raw Material' : 'Finished Goods'}
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-lg font-bold text-lg mb-2">
                    ৳ {viewingProduct.price}
                  </div>
                  {viewingProduct.use_for_processing && (
                    <div className="mt-1">
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md font-bold inline-block">Used for Processing</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6 bg-gray-50 p-5 rounded-xl border border-gray-100">
                <div>
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Inventory Information</h4>
                  <ul className="space-y-3">
                    <li className="flex justify-between items-center text-sm border-b border-gray-200/60 pb-2">
                      <span className="text-gray-500">SKU</span>
                      <span className="font-semibold text-gray-900">{viewingProduct.sku || '-'}</span>
                    </li>
                    <li className="flex justify-between items-center text-sm border-b border-gray-200/60 pb-2">
                      <span className="text-gray-500">Barcode</span>
                      <span className="font-semibold text-gray-900">{viewingProduct.barcode || '-'}</span>
                    </li>
                    <li className="flex justify-between items-center text-sm border-b border-gray-200/60 pb-2">
                      <span className="text-gray-500">Stock Quantity</span>
                      <span className={`font-bold ${isLowStock(viewingProduct) ? 'text-red-600' : 'text-green-600'}`}>
                        {viewingProduct.is_tracked ? viewingProduct.stock_quantity : 'Untracked'} {viewingProduct.unit_value > 1 ? `${viewingProduct.unit_value} ${viewingProduct.unit}` : viewingProduct.unit}
                      </span>
                    </li>
                    {viewingProduct.is_tracked && viewingProduct.low_stock_alert && (
                      <li className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Minimum Stock</span>
                        <span className="font-semibold text-gray-900">{viewingProduct.minimum_stock}</span>
                      </li>
                    )}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Pricing Details</h4>
                  <ul className="space-y-3">
                    {isRawMaterials && (
                      <li className="flex justify-between items-center text-sm border-b border-gray-200/60 pb-2">
                        <span className="text-gray-500">Cost Price</span>
                        <span className="font-semibold text-gray-900">৳ {viewingProduct.cost || 0}</span>
                      </li>
                    )}
                    {viewingProduct.use_for_processing && (
                      <>
                        <li className="flex justify-between items-center text-sm border-b border-gray-200/60 pb-2">
                          <span className="text-gray-500">Auto Process Price</span>
                          <span className="font-semibold text-gray-900">৳ {viewingProduct.processing_price_auto}</span>
                        </li>
                        <li className="flex justify-between items-center text-sm border-b border-gray-200/60 pb-2">
                          <span className="text-gray-500">Manual Process Price</span>
                          <span className="font-semibold text-gray-900">৳ {viewingProduct.processing_price_manual}</span>
                        </li>
                      </>
                    )}
                  </ul>
                </div>
              </div>

              {viewingProduct.image_urls && viewingProduct.image_urls.length > 1 && (
                <div className="mt-6 border-t border-gray-100 pt-5">
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Additional Images</h4>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {viewingProduct.image_urls.slice(1).map((url: string, idx: number) => (
                      <img key={idx} src={url} alt={`Image ${idx + 2}`} className="w-20 h-20 rounded-lg object-cover border border-gray-200 flex-shrink-0 shadow-sm" />
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-5 border-t border-gray-100 bg-white flex justify-end flex-shrink-0 rounded-b-2xl">
              <button onClick={() => setViewingProduct(null)} className="px-6 py-2.5 bg-gray-100 border border-gray-200 text-gray-700 font-bold rounded-lg shadow-sm hover:bg-gray-200 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StockPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20 text-indigo-600 font-bold">Loading Inventory...</div>}>
      <StockContent />
    </Suspense>
  );
}