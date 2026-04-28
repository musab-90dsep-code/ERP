'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

import { Plus, Trash2, Pencil, Search, Filter, Printer, Download, ChevronDown, Package, Image as ImageIcon, X, Upload, Eye, LayoutGrid, List, Clock, History, Box, AlertTriangle } from 'lucide-react';

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
  const [showRawHeads, setShowRawHeads] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [trackedFilter, setTrackedFilter] = useState('all');

  const [visibleColumns, setVisibleColumns] = useState({
    name: true, sku: true, price: true, stock: true, unit: true, barcode: true, actions: true,
  });

  // ── Add Stock Modal State ──
  const [addStockModal, setAddStockModal] = useState<{ product: any } | null>(null);
  const [addStockQty, setAddStockQty] = useState('');
  const [addStockNote, setAddStockNote] = useState('');
  const [addStockSubmitting, setAddStockSubmitting] = useState(false);

  // ── Global Stock History State ──
  const [showGlobalHistory, setShowGlobalHistory] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Variant popup state (per-product view)
  const [variantPopup, setVariantPopup] = useState<{product: any} | null>(null);

  // ── Global Variant Manager ──
  // Stored in localStorage per category: erp_variants_raw / erp_variants_finished
  const getStorageKey = (cat: string) => cat === 'raw-materials' ? 'erp_variants_raw' : 'erp_variants_finished';
  const loadGlobalVariants = (cat: string): string[] => {
    try { return JSON.parse(localStorage.getItem(getStorageKey(cat)) || '[]'); } catch { return []; }
  };
  const saveGlobalVariants = (cat: string, list: string[]) => {
    localStorage.setItem(getStorageKey(cat), JSON.stringify(list));
  };
  const [showVariantManager, setShowVariantManager] = useState(false);
  const [globalVariants, setGlobalVariants] = useState<string[]>([]);
  const [newVariantInput, setNewVariantInput] = useState('');



  const [formData, setFormData] = useState<any>({
    name: '', sku: '', cost: '', stock_quantity: '', is_tracked: true,
    low_stock_alert: false, minimum_stock: '',
    unit: 'pcs', unit_value: 1, barcode: '', use_for_processing: false,
    processing_price_auto: '', processing_price_manual: '',
    image_urls: [] as string[],
    variants: [] as {name: string; price: string}[],
    product_quality: ''
  });

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const isRawMaterials = tab === 'raw-materials';
  const category = tab === 'raw-materials' ? 'raw-materials' : 'finished-goods';

  // Load global variants when tab or manager opens
  useEffect(() => { setGlobalVariants(loadGlobalVariants(category)); }, [category, showVariantManager]);

  // দশমিক এবং অন্যান্য অদরকারি ক্যারেক্টার ব্লক করার ফাংশন
  const blockInvalidChar = (e: any) => {
    if (['e', 'E', '+', '-'].includes(e.key)) {
      e.preventDefault();
    }
  };

  const fetchProducts = async () => {
    try {
      // Limit to 500 products to prevent UI freeze
      const data = await api.getProducts({ category, limit: 500 });
      let list = Array.isArray(data) ? data : (data.results ?? []);
      list = list.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setProducts(list);
    } catch (err: any) { alert(err.message); }
  };

  useEffect(() => {
    setSearchQuery('');
    setStockFilter('all');
    setTrackedFilter('all');
    fetchProducts();
  }, [tab]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchName = p.name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchSku = p.sku?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchBarcode = p.barcode?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSearch = matchName || matchSku || matchBarcode;

      let matchesFilters = true;
      if (stockFilter === 'low' && (!p.is_tracked || p.stock_quantity > (p.minimum_stock || 0))) matchesFilters = false;
      if (stockFilter === 'in_stock' && (!p.is_tracked || p.stock_quantity <= (p.minimum_stock || 0))) matchesFilters = false;
      if (trackedFilter === 'tracked' && !p.is_tracked) matchesFilters = false;
      if (trackedFilter === 'untracked' && p.is_tracked) matchesFilters = false;

      return matchesSearch && matchesFilters;
    });
  }, [products, searchQuery, stockFilter, trackedFilter]);

  // ── Add Stock Handler ──
  const handleAddStock = async () => {
    const qtyToAdd = parseFloat(addStockQty);
    if (!addStockModal || isNaN(qtyToAdd) || qtyToAdd <= 0) return;
    setAddStockSubmitting(true);
    try {
      const product = addStockModal.product;
      const stockBefore = Number(product.stock_quantity ?? 0);
      const stockAfter = Math.round((stockBefore + qtyToAdd) * 1000) / 1000;

      await api.updateProduct(product.id, { stock_quantity: stockAfter });

      try {
        await api.createStockHistory({
          product: product.id,
          item_type: category,
          item_name: product.name,
          quantity_added: qtyToAdd,
          stock_before: stockBefore,
          stock_after: stockAfter,
          note: addStockNote || null,
        });
      } catch (e) {
        console.warn('Stock history API failed. Ensure the endpoint exists.', e);
      }

      fetchProducts();
      setAddStockModal(null);
      setAddStockQty('');
      setAddStockNote('');
    } catch (e: any) {
      alert('Update Failed: ' + (e.message || 'Unknown Error'));
    } finally {
      setAddStockSubmitting(false);
    }
  };

  const handleDownloadCSV = () => {
    if (filteredProducts.length === 0) return;
    const headers = ['Product Name', 'SKU', 'Barcode', 'Price', 'Stock', 'Unit'];
    const rows = filteredProducts.map(p => [
      p.name,
      p.sku || '',
      p.barcode || '',
      p.price,
      p.stock_quantity,
      p.unit
    ]);
    const csvContent = "data:text/csv;charset=utf-8,"
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Stock_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => { window.print(); };

  const fetchGlobalStockHistory = async () => {
    setShowGlobalHistory(true);
    setHistoryLoading(true);
    setHistoryData([]);
    try {
      // Limit to 200 recent history entries
      const data = await api.getStockHistory({ item_type: category, limit: 200 });
      setHistoryData(Array.isArray(data) ? data : data.results ?? []);
    } catch { setHistoryData([]); }
    setHistoryLoading(false);
  };

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

  const uploadImagesToServer = async (): Promise<string[]> => {
    if (imageFiles.length === 0) return [...formData.image_urls];
    const newUrls: string[] = [];
    for (const file of imageFiles) {
      try {
        const url = await api.uploadFile(file);
        newUrls.push(url);
      } catch (error) {
        console.error("Failed to upload an image:", error);
        alert("One or more images failed to upload.");
      }
    }
    return [...formData.image_urls, ...newUrls];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const finalImageUrls = await uploadImagesToServer();

      let finalSku = formData.sku.trim();
      if (!finalSku) finalSku = `SKU-${Date.now().toString().slice(-6)}`;

      // ডেটাকে পূর্ণ সংখ্যায় কনভার্ট করা হচ্ছে
      const cleanVariants = (formData.variants || []).filter((v: any) => v.name?.trim());
      // For backwards compat: also store first variant price as product price
      const firstPrice = cleanVariants.length > 0 ? parseFloat(String(cleanVariants[0].price)) || 0 : 0;
      const payload = {
        category,
        name: formData.name,
        sku: finalSku,
        price: firstPrice,
        cost: formData.cost === '' ? 0 : Math.round(parseFloat(String(formData.cost)) * 100) / 100,
        stock_quantity: formData.stock_quantity === '' ? 0 : Math.round(parseFloat(String(formData.stock_quantity)) * 1000) / 1000,
        unit: formData.unit || 'pcs',
        unit_value: formData.unit_value ? parseFloat(String(formData.unit_value)) : 1,
        barcode: formData.barcode || null,
        is_tracked: !!formData.is_tracked,
        low_stock_alert: !!formData.low_stock_alert,
        minimum_stock: formData.minimum_stock === '' ? 0 : Math.round(parseFloat(String(formData.minimum_stock)) * 1000) / 1000,
        use_for_processing: !!formData.use_for_processing,
        processing_price_auto: formData.processing_price_auto === '' ? 0 : Math.round(parseFloat(String(formData.processing_price_auto)) * 100) / 100,
        processing_price_manual: formData.processing_price_manual === '' ? 0 : Math.round(parseFloat(String(formData.processing_price_manual)) * 100) / 100,
        image_urls: finalImageUrls,
        variants: cleanVariants,
        product_heads: cleanVariants.map((v: any) => v.name),
        product_quality: formData.product_quality || '',
      };

      if (editingId) {
        await api.updateProduct(editingId, payload);
      } else {
        await api.createProduct(payload);
      }
      resetEmpForm();
      fetchProducts();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetEmpForm = () => {
    setShowForm(false);
    setEditingId(null);
    setHasBarcode(false);
    setShowHeads(false);
    setShowRawHeads(false);
    setFormData({
      name: '', sku: '', cost: '', stock_quantity: '', is_tracked: true,
      low_stock_alert: false, minimum_stock: '',
      unit: 'pcs', barcode: '', use_for_processing: false, processing_price_auto: '', processing_price_manual: '', image_urls: [],
      variants: [],
      product_quality: ''
    });
    setImageFiles([]);
    setImagePreviews([]);
  };

  const handleEdit = (product: any) => {
    const rawVariants = product.variants || [];
    const legacyHeads: {name: string; price: string}[] = (product.product_heads || []).map((h: string) => ({ name: h, price: '' }));
    const variants = rawVariants.length > 0 ? rawVariants : legacyHeads;
    setFormData({
      name: product.name || '',
      sku: product.sku || '',
      cost: product.cost ? Math.floor(Number(product.cost)) : '',
      stock_quantity: product.stock_quantity ? Math.floor(Number(product.stock_quantity)) : '',
      is_tracked: product.is_tracked ?? true,
      low_stock_alert: product.low_stock_alert ?? false,
      minimum_stock: product.minimum_stock ? Math.floor(Number(product.minimum_stock)) : '',
      unit: product.unit || 'pcs',
      barcode: product.barcode || '',
      use_for_processing: product.use_for_processing ?? false,
      processing_price_auto: product.processing_price_auto ? Math.floor(Number(product.processing_price_auto)) : '',
      processing_price_manual: product.processing_price_manual ? Math.floor(Number(product.processing_price_manual)) : '',
      image_urls: product.image_urls || [],
      variants,
      product_quality: product.product_quality || ''
    });
    setHasBarcode(!!product.barcode);
    setShowHeads(variants.length > 0 && product.category === 'finished-goods');
    setShowRawHeads(variants.length > 0 && product.category === 'raw-materials');
    setImagePreviews(product.image_urls || []);
    setImageFiles([]);
    setEditingId(product.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await api.deleteProduct(id);
      fetchProducts();
    } catch (err: any) { alert(err.message); }
  };

  const headingTitle = isRawMaterials ? 'Raw Materials' : 'Finished Goods';

  const isLowStock = (p: any) =>
    p.is_tracked && p.low_stock_alert && p.stock_quantity <= (p.minimum_stock || 0);

  const inputClass = "w-full bg-[#1a2235] border border-[rgba(255,255,255,0.06)] rounded-lg p-2.5 text-sm text-[#e8eaf0] focus:border-[#c9a84c] focus:ring-1 focus:ring-[rgba(201,168,76,0.3)] outline-none transition-colors";
  const labelClass = "block text-[10px] uppercase font-bold text-[#8a95a8] tracking-widest mb-2";

  return (
    <div className="pb-10 max-w-[1400px] mx-auto">
      <style jsx global>{`
        @media print {
          nav, aside, button, .no-print, .actions-column { display: none !important; }
          body { background: white !important; color: black !important; padding: 0 !important; }
          .main-content { width: 100% !important; max-width: none !important; padding: 0 !important; }
          table { border-collapse: collapse !important; width: 100% !important; }
          th, td { border: 1px solid #ddd !important; color: black !important; background: white !important; padding: 8px !important; }
          .low-stock-badge { color: red !important; font-weight: bold !important; }
        }
      `}</style>
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6 bg-[#131929] p-6 rounded-2xl border border-[rgba(255,255,255,0.04)] shadow-[0_4px_24px_rgba(0,0,0,0.5)] no-print">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-[#c9a84c]" />
            <span className="text-xs font-bold tracking-[0.2em] text-[#8a95a8] uppercase">
              Inventory Management
            </span>
          </div>
          <h1 className="flex items-center gap-3 text-2xl font-black text-white tracking-tight">
            <Package className="w-6 h-6 text-[#c9a84c]" /> {headingTitle}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="bg-[#1a2235] border border-[rgba(255,255,255,0.06)] rounded-lg p-1 flex items-center shadow-sm">
            <button onClick={() => setViewMode('table')} className={`p-2 rounded-md transition-colors ${viewMode === 'table' ? 'bg-[#c9a84c] text-black' : 'text-[#8a95a8] hover:text-white'}`} title="Table View">
              <List className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('card')} className={`p-2 rounded-md transition-colors ${viewMode === 'card' ? 'bg-[#c9a84c] text-black' : 'text-[#8a95a8] hover:text-white'}`} title="Card View">
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          <button onClick={fetchGlobalStockHistory} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1a2235] border border-[rgba(255,255,255,0.1)] text-[#e8eaf0] text-sm font-bold shadow-sm transition hover:bg-[rgba(255,255,255,0.05)]">
            <History className="w-4 h-4 text-blue-400" /> Stock History
          </button>

          <button onClick={() => setShowVariantManager(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1a2235] border border-[rgba(255,255,255,0.1)] text-[#c9a84c] text-sm font-bold shadow-sm transition hover:bg-[rgba(201,168,76,0.08)]">
            <ChevronDown className="w-4 h-4" /> Variants
          </button>

          <div className="flex items-center gap-2">
            <button onClick={handleDownloadCSV} title="Download CSV" className="p-2.5 rounded-lg bg-[#1a2235] border border-[rgba(255,255,255,0.1)] text-[#8a95a8] hover:text-[#c9a84c] transition-colors">
              <Download className="w-4 h-4" />
            </button>
            <button onClick={handlePrint} title="Print Report" className="p-2.5 rounded-lg bg-[#1a2235] border border-[rgba(255,255,255,0.1)] text-[#8a95a8] hover:text-[#c9a84c] transition-colors">
              <Printer className="w-4 h-4" />
            </button>
          </div>

          <button onClick={() => { if (!showForm) resetEmpForm(); setShowForm(!showForm); }} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-br from-[#c9a84c] to-[#f0c040] text-[#0a0900] text-sm font-extrabold shadow-[0_4px_24px_rgba(0,0,0,0.5)] transition hover:opacity-90">
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {/* ── Search and Filter Bar ── */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8 no-print">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8a95a8]" />
          <input type="text" placeholder="Search products by name, SKU, or barcode..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-[#131929] border border-[rgba(255,255,255,0.04)] rounded-xl py-3 pl-12 pr-4 text-sm text-[#e8eaf0] focus:border-[#c9a84c] focus:ring-1 focus:ring-[rgba(201,168,76,0.3)] outline-none transition-colors shadow-sm" />
        </div>
        <div className="flex gap-4">
          <select value={stockFilter} onChange={e => setStockFilter(e.target.value)} className="bg-[#131929] border border-[rgba(255,255,255,0.04)] rounded-xl px-4 py-3 text-sm font-bold text-[#8a95a8] outline-none shadow-sm cursor-pointer">
            <option value="all">All Stock Level</option>
            <option value="low">Low Stock Only</option>
            <option value="in_stock">In Stock Only</option>
          </select>

          <select value={trackedFilter} onChange={e => setTrackedFilter(e.target.value)} className="bg-[#131929] border border-[rgba(255,255,255,0.04)] rounded-xl px-4 py-3 text-sm font-bold text-[#8a95a8] outline-none shadow-sm cursor-pointer">
            <option value="all">All Tracked Types</option>
            <option value="tracked">Tracked Items</option>
            <option value="untracked">Untracked Items</option>
          </select>
        </div>
      </div>

      {/* ── Form Section ── */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-[#131929] p-6 sm:p-8 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.5)] border border-[rgba(255,255,255,0.04)] mb-8 animate-fade-in">
          <h2 className="text-lg font-black text-white mb-6 border-b border-[rgba(255,255,255,0.04)] pb-4">
            {editingId ? 'Edit Product' : 'Add New Product'}
          </h2>

          <div className="mb-6 p-5 bg-[#1a2235] border border-[rgba(255,255,255,0.04)] rounded-xl">
            <label className="text-sm font-bold text-[#e8eaf0] mb-3 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-[#c9a84c]" /> Product Images (Max 5)
            </label>
            <div className="flex flex-wrap gap-4 items-start">
              {imagePreviews.map((src, idx) => (
                <div key={idx} className="relative w-24 h-24 rounded-lg overflow-hidden border border-[rgba(255,255,255,0.1)] shadow-sm group bg-[#131929]">
                  <img src={src} alt="preview" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removeImage(idx)} className="absolute top-1 right-1 bg-red-500/90 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {imagePreviews.length < 5 && (
                <label className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed border-[rgba(255,255,255,0.1)] rounded-lg cursor-pointer hover:bg-[rgba(255,255,255,0.02)] transition-colors text-[#8a95a8] hover:text-[#c9a84c]">
                  <Upload className="w-6 h-6 mb-1" />
                  <span className="text-[10px] uppercase font-bold tracking-wider">Upload</span>
                  <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageChange} />
                </label>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <label className={labelClass}>Product Name</label>
              <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Enter product name" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Product ID (Auto-generated)</label>
              <input type="text" value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value })} placeholder="Leave blank to auto-generate" className={inputClass} />
            </div>
            {/* Price moved to variants — no standalone price field */}
            <div>
              <label className={labelClass}>Product Quality</label>
              <select value={formData.product_quality} onChange={e => setFormData({ ...formData, product_quality: e.target.value })} className={inputClass}>
                <option value="">— Select Quality —</option>
                <option value="Light Series">Light Series</option>
                <option value="Medium Series">Medium Series</option>
                <option value="AC Series">AC Series</option>
                <option value="Essential Series">Essential Series</option>
                <option value="Classic Series">Classic Series</option>
                <option value="Signature Series">Signature Series</option>
                <option value="Elite Series">Elite Series</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Unit</label>
              <select value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} className={inputClass}>
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

            <div className="flex flex-col justify-start mt-6">
              <label className="flex items-center cursor-pointer mb-2 w-max">
                <input type="checkbox" checked={hasBarcode} onChange={e => { setHasBarcode(e.target.checked); if (!e.target.checked) setFormData({ ...formData, barcode: '' }); }} className="w-5 h-5 accent-[#c9a84c] rounded bg-[#1a2235] border-[rgba(255,255,255,0.1)]" />
                <span className="text-sm font-bold text-[#e8eaf0] ml-3">Add Barcode</span>
              </label>
              {hasBarcode && (
                <div className="ml-8 mt-2 animate-slide-up">
                  <input type="text" value={formData.barcode} onChange={e => setFormData({ ...formData, barcode: e.target.value })} placeholder="Scan or type barcode" className={inputClass} />
                </div>
              )}
            </div>

            <div className="md:col-span-3 bg-[#1a2235] p-5 rounded-xl border border-[rgba(255,255,255,0.04)]">
              <label className="flex items-center cursor-pointer mb-3">
                <input type="checkbox" checked={formData.is_tracked} onChange={e => setFormData({ ...formData, is_tracked: e.target.checked })} className="w-5 h-5 accent-[#c9a84c] rounded bg-[#131929]" />
                <span className="text-sm font-bold text-[#e8eaf0] ml-3">Track Inventory Stock</span>
              </label>

              {formData.is_tracked && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 ml-8 mt-3 animate-fade-in border-l-2 border-[rgba(201,168,76,0.3)] pl-4">
                  <div>
                    <label className={labelClass}>Current Stock</label>
                    <input type="number" onKeyDown={blockInvalidChar} value={formData.stock_quantity} onChange={e => setFormData({ ...formData, stock_quantity: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className="flex items-center cursor-pointer mt-2 mb-2">
                      <input type="checkbox" checked={formData.low_stock_alert} onChange={e => setFormData({ ...formData, low_stock_alert: e.target.checked })} className="w-4 h-4 accent-red-500 rounded" />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#8a95a8] ml-2">Enable Low Stock Alert</span>
                    </label>
                    {formData.low_stock_alert && (
                      <div className="animate-fade-in">
                        <input type="number" onKeyDown={blockInvalidChar} placeholder="Min Stock Qty" value={formData.minimum_stock} onChange={e => setFormData({ ...formData, minimum_stock: e.target.value })} className={inputClass} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {isRawMaterials && (
              <div className="md:col-span-3 flex flex-col justify-start p-5 bg-[rgba(96,165,250,0.05)] rounded-xl border border-[rgba(96,165,250,0.15)]">
                <label className="flex items-center cursor-pointer mb-2">
                  <input type="checkbox" checked={formData.use_for_processing} onChange={e => setFormData({ ...formData, use_for_processing: e.target.checked })} className="w-5 h-5 accent-blue-500 rounded" />
                  <span className="text-sm font-bold text-[#60a5fa] ml-3">Use for Processing Material</span>
                </label>
                {formData.use_for_processing && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 ml-8 mt-3 animate-fade-in">
                    <div>
                      <label className={labelClass}>Auto Processing Price</label>
                      <input type="number" onKeyDown={blockInvalidChar} value={formData.processing_price_auto} onChange={e => setFormData({ ...formData, processing_price_auto: e.target.value })} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Manual Processing Price</label>
                      <input type="number" onKeyDown={blockInvalidChar} value={formData.processing_price_manual} onChange={e => setFormData({ ...formData, processing_price_manual: e.target.value })} className={inputClass} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Variants Section: Select from Global Variants ── */}
            <div className="md:col-span-3 p-5 bg-[rgba(201,168,76,0.05)] border border-[rgba(201,168,76,0.15)] rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-sm font-bold text-[#c9a84c]">
                    {isRawMaterials ? 'Material Variants' : 'Product Variants'}
                  </span>
                  <p className="text-[11px] text-[#8a95a8] mt-0.5">
                    Select from global variants list and set price for each.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowVariantManager(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1a2235] border border-[rgba(201,168,76,0.3)] text-[#c9a84c] text-[11px] font-bold transition-colors hover:bg-[rgba(201,168,76,0.1)]"
                  >
                    <ChevronDown className="w-3.5 h-3.5" /> Manage
                  </button>
                </div>
              </div>

              {/* Available global variants as checkboxes */}
              {globalVariants.length === 0 ? (
                <div className="text-center py-5 border border-dashed border-[rgba(255,255,255,0.06)] rounded-lg">
                  <p className="text-[11px] text-[#4a5568] mb-2">No variants defined yet.</p>
                  <button type="button" onClick={() => setShowVariantManager(true)} className="text-[11px] font-bold text-[#c9a84c] underline">Click here to add variants</button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {globalVariants.map((gv, gi) => {
                    const existing = (formData.variants || []).find((v: any) => v.name === gv);
                    const isSelected = !!existing;
                    return (
                      <div key={gi} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                        isSelected ? 'bg-[rgba(201,168,76,0.08)] border-[rgba(201,168,76,0.3)]' : 'bg-[#131929] border-[rgba(255,255,255,0.04)]'
                      }`}>
                        <input
                          type="checkbox"
                          id={`variant-${gi}`}
                          checked={isSelected}
                          onChange={e => {
                            if (e.target.checked) {
                              setFormData({ ...formData, variants: [...(formData.variants || []), { name: gv, price: '' }] });
                            } else {
                              setFormData({ ...formData, variants: (formData.variants || []).filter((v: any) => v.name !== gv) });
                            }
                          }}
                          className="w-4 h-4 accent-[#c9a84c] rounded shrink-0"
                        />
                        <label htmlFor={`variant-${gi}`} className="flex-1 text-sm font-bold text-[#e8eaf0] cursor-pointer">{gv}</label>
                        {isSelected && (
                          <div className="w-32 shrink-0">
                            <input
                              type="number"
                              placeholder="Price ৳"
                              onKeyDown={blockInvalidChar}
                              value={existing?.price || ''}
                              onChange={e => {
                                const updated = (formData.variants || []).map((v: any) =>
                                  v.name === gv ? { ...v, price: e.target.value } : v
                                );
                                setFormData({ ...formData, variants: updated });
                              }}
                              className={`${inputClass} text-[#f0c040] font-bold`}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="md:col-span-3 flex justify-end gap-3 mt-4 pt-6 border-t border-[rgba(255,255,255,0.04)]">
              <button type="button" onClick={resetEmpForm} className="px-6 py-2.5 rounded-lg border border-[rgba(255,255,255,0.1)] text-[#8a95a8] hover:text-white hover:bg-[rgba(255,255,255,0.05)] font-bold transition-colors text-sm">
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="px-8 py-2.5 rounded-lg bg-gradient-to-br from-[#c9a84c] to-[#f0c040] text-[#0a0900] font-extrabold hover:opacity-90 transition-opacity shadow-[0_4px_16px_rgba(201,168,76,0.3)] text-sm disabled:opacity-50">
                {submitting ? 'Saving...' : (editingId ? 'Update Product' : 'Save Product')}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ── Table / Card View ── */}
      {viewMode === 'table' ? (
        <div className="bg-[#131929] rounded-2xl border border-[rgba(255,255,255,0.04)] shadow-[0_4px_24px_rgba(0,0,0,0.5)] overflow-hidden">
          <div className="overflow-x-auto min-h-[300px]">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[rgba(201,168,76,0.05)] border-b border-[rgba(201,168,76,0.15)]">
                <tr>
                  {visibleColumns.name && <th className="px-6 py-4 text-[11px] font-extrabold text-[#c9a84c] uppercase tracking-wider">Product Details</th>}
                  {!isRawMaterials && visibleColumns.sku && <th className="px-6 py-4 text-[11px] font-extrabold text-[#c9a84c] uppercase tracking-wider">SKU</th>}
                  {visibleColumns.barcode && <th className="px-6 py-4 text-[11px] font-extrabold text-[#c9a84c] uppercase tracking-wider">Barcode</th>}
                  {visibleColumns.price && <th className="px-6 py-4 text-[11px] font-extrabold text-[#c9a84c] uppercase tracking-wider">Price</th>}
                  {visibleColumns.stock && <th className="px-6 py-4 text-[11px] font-extrabold text-[#c9a84c] uppercase tracking-wider">Stock</th>}
                  {visibleColumns.actions && <th className="px-6 py-4 text-[11px] font-extrabold text-[#c9a84c] uppercase tracking-wider text-right no-print">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(255,255,255,0.02)]">
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-[#8a95a8]">
                      <Package className="w-10 h-10 text-[rgba(255,255,255,0.1)] mx-auto mb-3" />
                      <p className="font-semibold text-sm">No products found matching your filters.</p>
                    </td>
                  </tr>
                )}
                {filteredProducts.map(product => (
                  <tr key={product.id}
                    onClick={() => setViewingProduct(product)}
                    className="hover:bg-[rgba(201,168,76,0.03)] transition-colors group cursor-pointer"
                  >
                    {visibleColumns.name && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-[#1a2235] border border-[rgba(255,255,255,0.05)] overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {product.image_urls && product.image_urls.length > 0 ? (
                              <img src={product.image_urls[0]} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-5 h-5 text-[#4a5568]" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-[#e8eaf0] text-sm group-hover:text-[#c9a84c] transition-colors">{product.name}</p>
                            {product.use_for_processing && <span className="mt-1 inline-block text-[9px] bg-[rgba(96,165,250,0.1)] text-[#60a5fa] border border-[rgba(96,165,250,0.2)] px-2 py-0.5 rounded uppercase font-bold tracking-wider">For Processing</span>}
                            {product.variants && product.variants.length > 0 && (
                              <button
                                type="button"
                                onClick={e => { e.stopPropagation(); setVariantPopup({ product }); }}
                                className="mt-1 inline-flex items-center gap-1 text-[9px] bg-[rgba(201,168,76,0.1)] text-[#c9a84c] border border-[rgba(201,168,76,0.2)] px-2 py-0.5 rounded uppercase font-bold tracking-wider hover:bg-[rgba(201,168,76,0.2)] transition-colors"
                              >
                                {product.variants.length} Variants
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    )}
                    {!isRawMaterials && visibleColumns.sku && <td className="px-6 py-4 text-xs font-medium text-[#8a95a8]">{product.sku || '-'}</td>}
                    {visibleColumns.barcode && <td className="px-6 py-4 text-xs font-medium text-[#8a95a8]">{product.barcode || '-'}</td>}
                    {visibleColumns.price && (
                      <td className="px-6 py-4">
                        {product.variants && product.variants.length > 0 ? (
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); setVariantPopup({ product }); }}
                            className="text-xs font-bold text-[#c9a84c] bg-[rgba(201,168,76,0.1)] border border-[rgba(201,168,76,0.2)] px-2 py-1 rounded-lg hover:bg-[rgba(201,168,76,0.2)] transition-colors"
                          >
                            ৳ {Math.floor(Number(product.variants[0].price))}+
                          </button>
                        ) : (
                          <span className="font-black text-white">৳{Math.floor(Number(product.price))}</span>
                        )}
                      </td>
                    )}
                    {visibleColumns.stock && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-black ${isLowStock(product) ? 'text-red-400' : 'text-emerald-400'}`}>
                            {product.is_tracked ? Math.floor(Number(product.stock_quantity)) : 'N/A'}
                          </span>
                          <span className="text-[10px] font-bold text-[#4a5568] uppercase tracking-widest">{product.unit_value > 1 ? `${product.unit_value} ${product.unit}` : product.unit}</span>
                          {isLowStock(product) && (
                            <span className="text-[9px] bg-[#2a1315] text-red-500 border border-red-500/20 px-2 py-0.5 rounded uppercase font-bold tracking-widest">Low</span>
                          )}
                        </div>
                      </td>
                    )}
                    {visibleColumns.actions && (
                      <td className="px-6 py-4 text-right no-print" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {product.is_tracked && (
                            <button onClick={() => { setAddStockModal({ product }); setAddStockQty(''); setAddStockNote(''); }} title="Add Stock" className="p-2 text-[#8a95a8] hover:text-emerald-400 hover:bg-[rgba(52,211,153,0.1)] rounded-lg transition-colors">
                              <Plus className="w-4 h-4" />
                            </button>
                          )}
                          <button onClick={() => handleEdit(product)} className="p-2 text-[#8a95a8] hover:text-[#c9a84c] hover:bg-[rgba(201,168,76,0.1)] rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(product.id)} className="p-2 text-[#8a95a8] hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
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
            <div key={product.id}
              onClick={() => setViewingProduct(product)}
              className="bg-[#131929] border border-[rgba(255,255,255,0.04)] hover:border-[rgba(201,168,76,0.3)] shadow-[0_4px_24px_rgba(0,0,0,0.5)] rounded-2xl overflow-hidden flex flex-col group transition-all duration-300 cursor-pointer"
            >
              <div className="relative aspect-video bg-[#0b0f1a] overflow-hidden flex-shrink-0 border-b border-[rgba(255,255,255,0.02)]">
                {product.image_urls && product.image_urls.length > 0 ? (
                  <img src={product.image_urls[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 opacity-80 group-hover:opacity-100" />
                ) : (
                  <Package className="w-12 h-12 text-[#1a2235] m-auto mt-8" />
                )}
                {product.use_for_processing && (
                  <div className="absolute top-3 left-3 bg-[#1a2235]/90 backdrop-blur border border-[rgba(96,165,250,0.3)] text-[#60a5fa] text-[9px] uppercase tracking-widest px-2 py-1 rounded font-bold shadow-sm">Process Item</div>
                )}

                {/* ── Action Buttons for Card ── */}
                <div className="absolute top-3 right-3 flex flex-wrap justify-end gap-1.5 transform sm:-translate-y-[150%] sm:opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 max-w-[80%] z-10" onClick={(e) => e.stopPropagation()}>
                  {product.is_tracked && (
                    <button onClick={() => { setAddStockModal({ product }); setAddStockQty(''); setAddStockNote(''); }} title="Add Stock" className="bg-[#131929]/90 backdrop-blur border border-[rgba(255,255,255,0.1)] p-2 rounded text-[#8a95a8] hover:text-emerald-400">
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => handleEdit(product)} title="Edit Product" className="bg-[#131929]/90 backdrop-blur border border-[rgba(255,255,255,0.1)] p-2 rounded text-[#8a95a8] hover:text-[#c9a84c]">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(product.id)} title="Delete Product" className="bg-[#131929]/90 backdrop-blur border border-[rgba(255,255,255,0.1)] p-2 rounded text-[#8a95a8] hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-5 flex flex-col flex-grow">
                <div className="flex justify-between items-start mb-3 gap-2">
                  <h3 className="font-bold text-[#e8eaf0] text-base leading-tight group-hover:text-[#c9a84c] transition-colors">{product.name}</h3>
                  <div className="bg-[#1a2235] text-emerald-400 border border-[rgba(52,211,153,0.2)] px-2 py-1 rounded font-black text-sm whitespace-nowrap">৳{Math.floor(Number(product.price))}</div>
                </div>
                <div className="text-[11px] font-semibold text-[#8a95a8] mb-4 flex flex-col gap-1 uppercase tracking-wider">
                  {!isRawMaterials && <span>SKU: {product.sku || '-'}</span>}
                  <span>BAR: {product.barcode || '-'}</span>
                </div>
                <div className="mt-auto pt-4 border-t border-[rgba(255,255,255,0.04)] flex justify-between items-center">
                  <span className="text-[10px] font-black text-[#4a5568] uppercase tracking-widest">Stock</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-base font-black ${isLowStock(product) ? 'text-red-400' : 'text-white'}`}>
                      {product.is_tracked ? Math.floor(Number(product.stock_quantity)) : 'N/A'}
                    </span>
                    <span className="text-[10px] font-bold text-[#8a95a8] uppercase">{product.unit_value > 1 ? `${product.unit_value} ${product.unit}` : product.unit}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {filteredProducts.length === 0 && (
            <div className="col-span-full py-20 text-center text-[#4a5568] bg-[#131929] rounded-2xl border border-[rgba(255,255,255,0.02)] border-dashed">
              <Package className="w-12 h-12 text-[#1a2235] mx-auto mb-4" />
              <p className="text-sm font-bold text-[#8a95a8]">No products found</p>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════
          ADD STOCK MODAL
      ══════════════════════════════════════ */}
      {addStockModal && (
        <div className="fixed inset-0 bg-[#0b0f1a]/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-[#131929] border border-[rgba(201,168,76,0.2)] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] w-full max-w-md overflow-hidden">
            <div className="bg-[#1a2235] border-b border-[rgba(255,255,255,0.04)] px-6 py-4 flex justify-between items-center">
              <h2 className="text-sm font-black text-emerald-400 flex items-center gap-2 uppercase tracking-widest">
                <Plus className="w-4 h-4" /> Add Stock
              </h2>
              <button onClick={() => setAddStockModal(null)} className="text-[#8a95a8] hover:text-white p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.05)] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="bg-[#1a2235] rounded-xl p-4 border border-[rgba(255,255,255,0.04)] flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-[#0b0f1a] border border-[rgba(255,255,255,0.05)] overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {addStockModal.product.image_urls?.[0] ? (
                    <img src={addStockModal.product.image_urls[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-5 h-5 text-[#4a5568]" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-[#e8eaf0] text-sm">{addStockModal.product.name}</p>
                  <p className="text-[11px] font-bold text-[#8a95a8] mt-1 uppercase tracking-wider">
                    Current:{' '}
                    <span className="text-emerald-400 ml-1">
                      {Math.floor(Number(addStockModal.product.stock_quantity ?? 0))} {addStockModal.product.unit}
                    </span>
                  </p>
                </div>
              </div>

              <div>
                <label className={labelClass}>Quantity to Add</label>
                <input
                  type="number" min="1" autoFocus
                  onKeyDown={blockInvalidChar}
                  value={addStockQty} onChange={e => setAddStockQty(e.target.value)}
                  placeholder="Enter quantity"
                  className={`${inputClass} text-lg font-black text-white focus:border-emerald-500 focus:ring-emerald-500/20`}
                />
              </div>

              <div>
                <label className={labelClass}>Note / Reason <span className="font-medium text-[#4a5568]">(optional)</span></label>
                <input
                  type="text" value={addStockNote} onChange={e => setAddStockNote(e.target.value)}
                  placeholder="e.g. Restocked from supplier" className={inputClass}
                />
              </div>

              {addStockQty && Number(addStockQty) > 0 && (
                <div className="bg-[#1a2235] border border-[rgba(52,211,153,0.2)] rounded-xl p-4 flex justify-between items-center">
                  <div className="text-sm font-bold text-[#8a95a8]">
                    <span>{Math.floor(Number(addStockModal.product.stock_quantity ?? 0))}</span>
                    <span className="mx-2 text-[#4a5568]">+</span>
                    <span className="text-emerald-400">{Math.floor(Number(addStockQty))}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-[#8a95a8] uppercase tracking-widest mb-1">New Stock</p>
                    <p className="text-xl font-black text-emerald-400">
                      {Math.floor(Number(addStockModal.product.stock_quantity ?? 0)) + Math.floor(Number(addStockQty))} <span className="text-xs uppercase text-[#4a5568]">{addStockModal.product.unit}</span>
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-[#1a2235] border-t border-[rgba(255,255,255,0.04)] flex gap-3 justify-end">
              <button onClick={() => setAddStockModal(null)} className="px-5 py-2.5 rounded-lg font-bold text-[#8a95a8] hover:text-white hover:bg-[rgba(255,255,255,0.05)] transition-colors text-sm">
                Cancel
              </button>
              <button onClick={handleAddStock} disabled={addStockSubmitting || !addStockQty || Number(addStockQty) <= 0} className="px-6 py-2.5 bg-emerald-500 text-white font-extrabold rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-colors shadow-[0_4px_16px_rgba(52,211,153,0.3)] text-sm">
                {addStockSubmitting ? 'Saving...' : 'Add Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          GLOBAL VARIANT MANAGER POPUP
      ══════════════════════════════════════ */}
      {showVariantManager && (
        <div className="fixed inset-0 bg-[#0b0f1a]/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#131929] border border-[rgba(201,168,76,0.3)] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] w-full max-w-md overflow-hidden">
            <div className="bg-[#1a2235] border-b border-[rgba(255,255,255,0.04)] px-6 py-4 flex justify-between items-center">
              <div>
                <h2 className="text-sm font-black text-[#c9a84c] uppercase tracking-widest">
                  {isRawMaterials ? 'Material Variants' : 'Product Variants'}
                </h2>
                <p className="text-[10px] text-[#8a95a8] mt-0.5">Manage global variant names for {isRawMaterials ? 'Raw Materials' : 'Finished Goods'}</p>
              </div>
              <button onClick={() => setShowVariantManager(false)} className="text-[#8a95a8] hover:text-white p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.05)] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Add new variant */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newVariantInput}
                  onChange={e => setNewVariantInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const v = newVariantInput.trim();
                      if (v && !globalVariants.includes(v)) {
                        const updated = [...globalVariants, v];
                        setGlobalVariants(updated);
                        saveGlobalVariants(category, updated);
                        setNewVariantInput('');
                      }
                    }
                  }}
                  placeholder={isRawMaterials ? 'e.g. Grade A, Type-1' : 'e.g. Size L, Color Red'}
                  className="flex-1 bg-[#1a2235] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2.5 text-sm text-[#e8eaf0] outline-none focus:border-[#c9a84c]"
                />
                <button
                  type="button"
                  onClick={() => {
                    const v = newVariantInput.trim();
                    if (v && !globalVariants.includes(v)) {
                      const updated = [...globalVariants, v];
                      setGlobalVariants(updated);
                      saveGlobalVariants(category, updated);
                      setNewVariantInput('');
                    }
                  }}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#c9a84c] hover:bg-[#f0c040] text-[#0a0900] text-sm font-extrabold transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>

              {/* Variant list */}
              {globalVariants.length === 0 ? (
                <p className="text-center text-sm text-[#4a5568] py-6">No variants added yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {globalVariants.map((gv, gi) => (
                    <div key={gi} className="flex items-center justify-between bg-[#1a2235] px-4 py-3 rounded-xl border border-[rgba(255,255,255,0.04)]">
                      <span className="text-sm font-bold text-[#e8eaf0]">{gv}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = globalVariants.filter((_, i) => i !== gi);
                          setGlobalVariants(updated);
                          saveGlobalVariants(category, updated);
                        }}
                        className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-[#1a2235] border-t border-[rgba(255,255,255,0.04)] flex justify-end">
              <button onClick={() => setShowVariantManager(false)} className="px-6 py-2.5 bg-[#131929] border border-[rgba(255,255,255,0.1)] text-[#e8eaf0] font-bold rounded-lg hover:bg-[rgba(255,255,255,0.05)] transition-colors text-sm">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          VARIANT POPUP MODAL (per product)
      ══════════════════════════════════════ */}
      {variantPopup && (
        <div className="fixed inset-0 bg-[#0b0f1a]/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-[#131929] border border-[rgba(201,168,76,0.3)] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] w-full max-w-md overflow-hidden">
            <div className="bg-[#1a2235] border-b border-[rgba(255,255,255,0.04)] px-6 py-4 flex justify-between items-center">
              <div>
                <h2 className="text-sm font-black text-[#c9a84c] uppercase tracking-widest">{variantPopup.product.name}</h2>
                <p className="text-[10px] text-[#8a95a8] mt-0.5 uppercase tracking-widest">
                  {variantPopup.product.category === 'raw-materials' ? 'Material Variants' : 'Product Variants'}
                </p>
              </div>
              <button onClick={() => setVariantPopup(null)} className="text-[#8a95a8] hover:text-white p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.05)] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              {variantPopup.product.variants && variantPopup.product.variants.length > 0 ? (
                variantPopup.product.variants.map((v: any, i: number) => (
                  <div key={i} className="flex items-center justify-between bg-[#1a2235] px-4 py-3 rounded-xl border border-[rgba(255,255,255,0.04)]">
                    <span className="text-sm font-bold text-[#e8eaf0]">{v.name || `Variant ${i+1}`}</span>
                    <span className="text-base font-black text-[#f0c040]">৳ {Math.floor(Number(v.price) || 0)}</span>
                  </div>
                ))
              ) : (
                <p className="text-center text-sm text-[#4a5568] py-6">No variants found.</p>
              )}
            </div>
            <div className="px-6 py-4 bg-[#1a2235] border-t border-[rgba(255,255,255,0.04)] flex justify-end">
              <button onClick={() => setVariantPopup(null)} className="px-6 py-2.5 bg-[#131929] border border-[rgba(255,255,255,0.1)] text-[#e8eaf0] font-bold rounded-lg hover:bg-[rgba(255,255,255,0.05)] transition-colors text-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          GLOBAL STOCK HISTORY MODAL
      ══════════════════════════════════════ */}
      {showGlobalHistory && (
        <div className="fixed inset-0 bg-[#0b0f1a]/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-[#131929] border border-[rgba(96,165,250,0.3)] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="bg-[#1a2235] border-b border-[rgba(255,255,255,0.04)] px-6 py-4 flex justify-between items-center">
              <h2 className="text-sm font-black text-blue-400 flex items-center gap-2 uppercase tracking-widest">
                <History className="w-4 h-4" /> Recent Stock Updates ({headingTitle})
              </h2>
              <button onClick={() => setShowGlobalHistory(false)} className="text-[#8a95a8] hover:text-white p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.05)] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6">
              {historyLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="w-8 h-8 rounded-full border-4 border-[#1a2235] border-t-blue-500 animate-spin" />
                  <span className="text-sm font-bold text-[#8a95a8]">Loading history...</span>
                </div>
              ) : historyData.length === 0 ? (
                <div className="text-center py-16 text-[#4a5568]">
                  <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="font-bold text-sm text-[#8a95a8]">No stock history records found. (Verify if your backend has this API)</p>
                </div>
              ) : (
                <div className="bg-[#1a2235] rounded-xl border border-[rgba(255,255,255,0.04)] overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-[#131929] border-b border-[rgba(255,255,255,0.04)]">
                      <tr>
                        <th className="px-5 py-3 text-[10px] font-bold text-[#8a95a8] uppercase tracking-wider">Date & Time</th>
                        <th className="px-5 py-3 text-[10px] font-bold text-[#8a95a8] uppercase tracking-wider">Product Name</th>
                        <th className="px-5 py-3 text-[10px] font-bold text-[#8a95a8] uppercase tracking-wider text-right">Added</th>
                        <th className="px-5 py-3 text-[10px] font-bold text-[#8a95a8] uppercase tracking-wider text-right">Before</th>
                        <th className="px-5 py-3 text-[10px] font-bold text-[#8a95a8] uppercase tracking-wider text-right">After</th>
                        <th className="px-5 py-3 text-[10px] font-bold text-[#8a95a8] uppercase tracking-wider pl-6">Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(255,255,255,0.02)]">
                      {historyData.map((h: any, idx: number) => (
                        <tr key={h.id} className={`hover:bg-[rgba(255,255,255,0.02)] transition-colors ${idx === 0 ? 'bg-[rgba(52,211,153,0.05)]' : ''}`}>
                          <td className="px-5 py-3 text-xs font-semibold text-[#8a95a8] whitespace-nowrap">
                            {new Date(h.created_at).toLocaleString('en-BD', {
                              day: '2-digit', month: 'short', year: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </td>
                          <td className="px-5 py-3 text-sm font-bold text-white max-w-[200px] truncate" title={h.item_name}>
                            {h.item_name}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span className="text-[11px] font-black text-emerald-400 bg-[rgba(52,211,153,0.1)] px-2 py-0.5 rounded border border-[rgba(52,211,153,0.2)]">
                              +{Math.floor(Number(h.quantity_added))}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right text-xs font-bold text-[#8a95a8]">{Math.floor(Number(h.stock_before))}</td>
                          <td className="px-5 py-3 text-right text-sm font-black text-white">{Math.floor(Number(h.stock_after))}</td>
                          <td className="px-5 py-3 text-xs text-[#8a95a8] italic pl-6">{h.note || <span className="text-[#4a5568]">—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-[#1a2235] border-t border-[rgba(255,255,255,0.04)] flex justify-between items-center">
              <p className="text-[11px] font-bold text-[#4a5568] uppercase tracking-widest">
                {historyData.length > 0 && <span>Showing latest {historyData.length} Updates</span>}
              </p>
              <button onClick={() => setShowGlobalHistory(false)} className="px-6 py-2.5 bg-[#131929] border border-[rgba(255,255,255,0.1)] text-[#e8eaf0] font-bold rounded-lg hover:bg-[rgba(255,255,255,0.05)] transition-colors text-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          VIEW PRODUCT MODAL
      ══════════════════════════════════════ */}
      {viewingProduct && (
        <div className="fixed inset-0 bg-[#0b0f1a]/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-[#131929] border border-[rgba(201,168,76,0.2)] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-[#1a2235] border-b border-[rgba(255,255,255,0.04)] px-6 py-4 flex justify-between items-center">
              <h2 className="text-sm font-black text-[#c9a84c] flex items-center gap-2 uppercase tracking-widest">
                <Package className="w-4 h-4" /> Product Details
              </h2>
              <button onClick={() => setViewingProduct(null)} className="text-[#8a95a8] hover:text-white p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.05)] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <div className="flex flex-col sm:flex-row gap-6 mb-8">
                <div className="w-32 h-32 rounded-xl bg-[#0b0f1a] border border-[rgba(255,255,255,0.05)] overflow-hidden flex-shrink-0 flex items-center justify-center mx-auto sm:mx-0 shadow-sm">
                  {viewingProduct.image_urls && viewingProduct.image_urls.length > 0 ? (
                    <img src={viewingProduct.image_urls[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-10 h-10 text-[#1a2235]" />
                  )}
                </div>
                <div className="text-center sm:text-left flex-1 flex flex-col justify-center border-b border-[rgba(255,255,255,0.04)] sm:border-b-0 pb-4 sm:pb-0">
                  <h3 className="text-2xl font-black text-white mb-1">{viewingProduct.name}</h3>
                  <div className="text-[10px] font-bold text-[#8a95a8] mb-3 uppercase tracking-widest">
                    {viewingProduct.category === 'raw-materials' ? 'Raw Material' : 'Finished Goods'}
                  </div>
                  <div className="flex flex-wrap gap-2 mb-2 justify-center sm:justify-start">
                    <div className="inline-flex w-max items-center gap-1.5 px-3 py-1 bg-[#1a2235] text-[#c9a84c] border border-[rgba(201,168,76,0.2)] rounded-lg font-black text-lg shadow-sm">
                      ৳ {Math.floor(Number(viewingProduct.price))}
                    </div>
                    {viewingProduct.product_quality && (
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-black text-sm shadow-sm border ${
                        viewingProduct.product_quality === 'AC'
                          ? 'bg-[rgba(96,165,250,0.1)] text-[#60a5fa] border-[rgba(96,165,250,0.3)]'
                          : viewingProduct.product_quality === 'Medium'
                          ? 'bg-[rgba(201,168,76,0.1)] text-[#c9a84c] border-[rgba(201,168,76,0.3)]'
                          : 'bg-[rgba(52,211,153,0.1)] text-emerald-400 border-[rgba(52,211,153,0.3)]'
                      }`}>
                        ★ {viewingProduct.product_quality}
                      </div>
                    )}
                  </div>
                  {viewingProduct.use_for_processing && (
                    <div className="mt-1">
                      <span className="text-[9px] bg-[rgba(96,165,250,0.1)] text-[#60a5fa] border border-[rgba(96,165,250,0.2)] px-2 py-1 rounded uppercase font-bold tracking-widest inline-block">Used for Processing</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-[#1a2235] p-5 rounded-xl border border-[rgba(255,255,255,0.04)]">
                  <h4 className="text-[10px] font-black text-[#c9a84c] uppercase tracking-widest mb-4 flex items-center gap-2"><Box className="w-3 h-3" /> Inventory Information</h4>
                  <ul className="space-y-3">
                    <li className="flex justify-between items-center text-sm border-b border-[rgba(255,255,255,0.02)] pb-2">
                      <span className="text-[#8a95a8] font-semibold">SKU</span>
                      <span className="font-bold text-white">{viewingProduct.sku || '-'}</span>
                    </li>
                    <li className="flex justify-between items-center text-sm border-b border-[rgba(255,255,255,0.02)] pb-2">
                      <span className="text-[#8a95a8] font-semibold">Barcode</span>
                      <span className="font-bold text-white">{viewingProduct.barcode || '-'}</span>
                    </li>
                    <li className="flex justify-between items-center text-sm border-b border-[rgba(255,255,255,0.02)] pb-2">
                      <span className="text-[#8a95a8] font-semibold">Stock Quantity</span>
                      <span className={`font-black ${isLowStock(viewingProduct) ? 'text-red-400' : 'text-emerald-400'}`}>
                        {viewingProduct.is_tracked ? Math.floor(Number(viewingProduct.stock_quantity)) : 'Untracked'} <span className="text-xs uppercase text-[#4a5568] ml-1">{viewingProduct.unit_value > 1 ? `${Math.floor(Number(viewingProduct.unit_value))} ${viewingProduct.unit}` : viewingProduct.unit}</span>
                      </span>
                    </li>
                    {viewingProduct.is_tracked && viewingProduct.low_stock_alert && (
                      <li className="flex justify-between items-center text-sm">
                        <span className="text-red-400 font-semibold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Min Stock</span>
                        <span className="font-bold text-white">{Math.floor(Number(viewingProduct.minimum_stock))}</span>
                      </li>
                    )}
                  </ul>
                </div>
                <div className="bg-[#1a2235] p-5 rounded-xl border border-[rgba(255,255,255,0.04)]">
                  {viewingProduct.category === 'finished-goods' ? (
                    <>
                      <h4 className="text-[10px] font-black text-[#c9a84c] uppercase tracking-widest mb-4 flex items-center gap-2"><List className="w-3 h-3" /> Product Variants</h4>
                      {viewingProduct.product_heads && viewingProduct.product_heads.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {viewingProduct.product_heads.map((head: string, hi: number) => (
                            <span key={hi} className="bg-[#131929] text-[#e8eaf0] border border-[rgba(255,255,255,0.06)] px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm">
                              {head}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="flex justify-center items-center py-6">
                          <span className="text-xs font-bold text-[#4a5568] uppercase tracking-widest">No Variants Available</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <h4 className="text-[10px] font-black text-[#c9a84c] uppercase tracking-widest mb-4 flex items-center gap-2"><List className="w-3 h-3" /> Material Variants</h4>
                      {viewingProduct.product_heads && viewingProduct.product_heads.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {viewingProduct.product_heads.map((head: string, hi: number) => (
                            <span key={hi} className="bg-[#131929] text-[#e8eaf0] border border-[rgba(255,255,255,0.06)] px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm">
                              {head}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="flex justify-center items-center py-6">
                          <span className="text-xs font-bold text-[#4a5568] uppercase tracking-widest">No Variants Available</span>
                        </div>
                      )}
                      {viewingProduct.use_for_processing && (
                        <div className="mt-4 pt-3 border-t border-[rgba(255,255,255,0.04)] space-y-2">
                          <p className="text-[10px] font-black text-[#8a95a8] uppercase tracking-widest mb-2">Processing Prices</p>
                          <div className="flex justify-between text-sm">
                            <span className="text-[#8a95a8]">Auto</span>
                            <span className="font-bold text-white">৳ {Math.floor(Number(viewingProduct.processing_price_auto))}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-[#8a95a8]">Manual</span>
                            <span className="font-bold text-white">৳ {Math.floor(Number(viewingProduct.processing_price_manual))}</span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {viewingProduct.image_urls && viewingProduct.image_urls.length > 1 && (
                <div className="mt-6 border-t border-[rgba(255,255,255,0.04)] pt-5">
                  <h4 className="text-[10px] font-black text-[#8a95a8] uppercase tracking-widest mb-3">Additional Images</h4>
                  <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                    {viewingProduct.image_urls.slice(1).map((url: string, idx: number) => (
                      <img key={idx} src={url} alt={`Image ${idx + 2}`} className="w-20 h-20 rounded-lg object-cover border border-[rgba(255,255,255,0.05)] flex-shrink-0 bg-[#0b0f1a]" />
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-5 border-t border-[rgba(255,255,255,0.04)] bg-[#1a2235] flex justify-end">
              <button onClick={() => setViewingProduct(null)} className="px-6 py-2.5 bg-[#131929] border border-[rgba(255,255,255,0.1)] text-[#e8eaf0] font-bold rounded-lg shadow-sm hover:bg-[rgba(255,255,255,0.05)] transition-colors text-sm">
                Close Modal
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
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="w-10 h-10 rounded-full border-4 border-[#131929] border-t-[#c9a84c] animate-spin" />
        <div className="text-sm font-bold text-[#8a95a8] uppercase tracking-widest">Loading Inventory...</div>
      </div>
    }>
      <StockContent />
    </Suspense>
  );
}