'use client';

import { useState, useEffect, Suspense, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

import { Plus, Trash2, Pencil, Search, Filter, Printer, Download, ChevronDown, Package, Image as ImageIcon, X, Upload, Eye, LayoutGrid, List, Clock, History, Box, AlertTriangle, MoreVertical, TrendingUp, DollarSign, CheckCircle } from 'lucide-react';

function StockContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab');
  const [products, setProducts] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingProduct, setViewingProduct] = useState<any | null>(null);
  const [showVariantDropdown, setShowVariantDropdown] = useState(false);
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

  // ── Stock History Modal State (Global and Per-Product) ──
  const [showGlobalHistory, setShowGlobalHistory] = useState(false);
  const [historyModal, setHistoryModal] = useState<{ product: any } | null>(null);
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
    setHistoryModal(null);
    setHistoryLoading(true);
    setHistoryData([]);
    try {
      const data = await api.getStockHistory({ item_type: category, limit: 200 });
      setHistoryData(Array.isArray(data) ? data : data.results ?? []);
    } catch { setHistoryData([]); }
    setHistoryLoading(false);
  };

  const fetchProductHistory = async (productId: string) => {
    setHistoryLoading(true);
    setHistoryData([]);
    try {
      const data = await api.getStockHistory({ product: productId, limit: 200 });
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

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  useEffect(() => {
    const closeDropdown = () => setActiveDropdown(null);
    document.addEventListener('click', closeDropdown);
    return () => document.removeEventListener('click', closeDropdown);
  }, []);

  const totalProducts = products.length;
  const inStockCount = products.filter(p => p.stock_quantity > 0).length;
  const lowStockCount = products.filter(isLowStock).length;
  const totalStockValue = products.reduce((acc, p) => acc + ((Number(p.stock_quantity) || 0) * (Number(p.price) || 0)), 0);

  const topSelling = [...products].slice(0, 5); // Mocked Top Selling
  const lowStockItemsList = products.filter(isLowStock).slice(0, 5);



  return (
    <div className="pb-10 max-w-[1600px] mx-auto min-h-screen">
      <style jsx global>{`
        @media print {
          nav, aside, button, .no-print, .actions-column { display: none !important; }
          body { background: white !important; color: black !important; padding: 0 !important; }
          .main-content { width: 100% !important; max-width: none !important; padding: 0 !important; }
          table { border-collapse: collapse !important; width: 100% !important; }
          th, td { border: 1px solid #ddd !important; color: black !important; background: white !important; padding: 8px !important; }
        }
      `}</style>
      
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 no-print">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
            <span className="text-[10px] font-bold tracking-[0.15em] text-[#8a95a8] uppercase">
              Inventory Management
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-[#f59e0b]" /> {headingTitle}
          </h1>
          <p className="text-xs text-[#8a95a8] mt-1">{isRawMaterials ? 'Materials for production' : 'Ready-to-sell products'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={fetchGlobalStockHistory} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a2235] border border-white/5 text-[#c8cdd7] text-xs font-bold hover:bg-white/5 transition">
            <History className="w-3.5 h-3.5 text-[#3b82f6]" /> Stock History
          </button>
          <button onClick={() => setShowVariantManager(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a2235] border border-white/5 text-[#c8cdd7] text-xs font-bold hover:bg-white/5 transition">
            <List className="w-3.5 h-3.5 text-[#8a95a8]" /> Manage Variants
          </button>
          <button onClick={handleDownloadCSV} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a2235] border border-white/5 text-[#c8cdd7] text-xs font-bold hover:bg-white/5 transition">
            <Download className="w-3.5 h-3.5 text-[#8a95a8]" /> Export
          </button>
          <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a2235] border border-white/5 text-[#c8cdd7] text-xs font-bold hover:bg-white/5 transition">
            <Printer className="w-3.5 h-3.5 text-[#8a95a8]" /> Print
          </button>
          <button onClick={() => { if (!showForm) resetEmpForm(); setShowForm(!showForm); }} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#f0c040] text-[#0a0900] text-xs font-extrabold hover:bg-[#f5d061] transition">
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#131929] p-4 rounded-xl border border-white/5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-[#f0c040]/10 flex items-center justify-center border border-[#f0c040]/20">
            <Package className="w-5 h-5 text-[#f0c040]" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-[#8a95a8] uppercase tracking-wider mb-1">Total Products</p>
            <p className="text-xl font-black text-white">{totalProducts}</p>
          </div>
        </div>
        <div className="bg-[#131929] p-4 rounded-xl border border-white/5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-[#22c55e]/10 flex items-center justify-center border border-[#22c55e]/20">
            <CheckCircle className="w-5 h-5 text-[#22c55e]" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-[#8a95a8] uppercase tracking-wider mb-1">In Stock</p>
            <p className="text-xl font-black text-white">{inStockCount}</p>
          </div>
        </div>
        <div className="bg-[#131929] p-4 rounded-xl border border-white/5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-[#f59e0b]/10 flex items-center justify-center border border-[#f59e0b]/20">
            <AlertTriangle className="w-5 h-5 text-[#f59e0b]" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-[#8a95a8] uppercase tracking-wider mb-1">Low Stock</p>
            <p className="text-xl font-black text-white">{lowStockCount}</p>
          </div>
        </div>
        <div className="bg-[#131929] p-4 rounded-xl border border-white/5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-[#a855f7]/10 flex items-center justify-center border border-[#a855f7]/20">
            <DollarSign className="w-5 h-5 text-[#a855f7]" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-[#8a95a8] uppercase tracking-wider mb-1">Total Value</p>
            <p className="text-xl font-black text-white">৳ {totalStockValue.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* ── Search & Filters ── */}
      <div className="flex flex-col xl:flex-row gap-4 mb-6">
        <div className="flex-1 flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a95a8]" />
            <input type="text" placeholder="Search by name, SKU, or barcode..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-[#131929] border border-white/5 rounded-lg py-2.5 pl-10 pr-4 text-xs text-white focus:border-[#f0c040]/50 outline-none transition-colors" />
          </div>
          <select value={stockFilter} onChange={e => setStockFilter(e.target.value)} className="bg-[#131929] border border-white/5 rounded-lg px-3 py-2.5 text-xs font-bold text-[#8a95a8] outline-none">
            <option value="all">All Levels</option>
            <option value="low">Low Stock</option>
            <option value="in_stock">In Stock</option>
          </select>
          <select value={trackedFilter} onChange={e => setTrackedFilter(e.target.value)} className="bg-[#131929] border border-white/5 rounded-lg px-3 py-2.5 text-xs font-bold text-[#8a95a8] outline-none">
            <option value="all">All Types</option>
            <option value="tracked">Tracked</option>
            <option value="untracked">Untracked</option>
          </select>
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#131929] border border-white/5 text-[#8a95a8] text-xs font-bold hover:text-white transition">
            <Filter className="w-4 h-4" /> More Filters
          </button>
        </div>
      </div>

      {/* ── Main Layout Grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        
        {/* Left Column - Table */}
        <div className="xl:col-span-3 bg-[#131929] rounded-2xl border border-white/5 overflow-hidden shadow-lg">
          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-left border-collapse">
              <thead className="border-b border-white/5">
                <tr>
                  <th className="px-5 py-3 text-[10px] font-black text-[#f0c040] uppercase tracking-wider">Product</th>
                  <th className="px-5 py-3 text-[10px] font-black text-[#f0c040] uppercase tracking-wider">SKU</th>
                  <th className="px-5 py-3 text-[10px] font-black text-[#f0c040] uppercase tracking-wider">Barcode</th>
                  <th className="px-5 py-3 text-[10px] font-black text-[#f0c040] uppercase tracking-wider">Selling Price</th>
                  <th className="px-5 py-3 text-[10px] font-black text-[#f0c040] uppercase tracking-wider text-center">Stock</th>
                  <th className="px-5 py-3 text-[10px] font-black text-[#f0c040] uppercase tracking-wider">Last Sale / Updated</th>
                  <th className="px-5 py-3 text-[10px] font-black text-[#f0c040] uppercase tracking-wider text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02]">
                {filteredProducts.map(product => {
                  const qty = Math.floor(Number(product.stock_quantity || 0));
                  const isLow = isLowStock(product);
                  return (
                    <tr key={product.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded bg-[#1a2235] border border-white/5 overflow-hidden shrink-0 flex items-center justify-center">
                            {product.image_urls?.[0] ? <img src={product.image_urls[0]} className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-[#4a5568]" />}
                          </div>
                          <div>
                            <p className="font-bold text-[#e8eaf0] text-xs">{product.name}</p>
                            <p className="text-[10px] text-[#8a95a8] mt-0.5">{product.product_quality || 'Standard'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs font-medium text-[#8a95a8]">{product.sku || '-'}</td>
                      <td className="px-5 py-4 text-xs font-medium text-[#8a95a8]">{product.barcode || '-'}</td>
                      <td className="px-5 py-4 text-xs font-bold text-white">৳ {Math.floor(Number(product.price)).toLocaleString()}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className={`text-xs font-bold ${qty <= 0 ? 'text-[#ef4444]' : isLow ? 'text-[#f59e0b]' : 'text-[#22c55e]'}`}>
                            {qty} <span className="text-[10px]">{product.unit}</span>
                          </span>
                          <span className={`text-[10px] mt-0.5 ${qty <= 0 ? 'text-[#ef4444]' : isLow ? 'text-[#f59e0b]' : 'text-[#8a95a8]'}`}>
                            {qty <= 0 ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs text-[#8a95a8]">{new Date(product.updated_at || product.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          <span className="text-[10px] text-[#4a5568] mt-0.5">{new Date(product.updated_at || product.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </td>
                      <td className={`px-5 py-4 text-center relative ${activeDropdown === product.id ? 'z-50' : 'z-0'}`}>
                        <button 
                          onClick={(e) => { 
                            e.preventDefault();
                            e.stopPropagation();
                            if (e.nativeEvent) { e.nativeEvent.stopImmediatePropagation(); }
                            setActiveDropdown(activeDropdown === product.id ? null : product.id); 
                          }}
                          className="p-1.5 rounded-lg bg-[#1a2235] border border-white/5 text-[#8a95a8] hover:text-white transition relative z-10"
                        >
                          <MoreVertical className="w-4 h-4 pointer-events-none" />
                        </button>
                        
                        {activeDropdown === product.id && (
                          <div className="absolute right-8 top-10 w-44 bg-[#131929] border border-[rgba(201,168,76,0.2)] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] z-50 py-1.5 overflow-hidden animate-fade-in text-left">
                            <button onClick={() => setViewingProduct(product)} className="w-full px-4 py-2.5 text-xs text-[#e8eaf0] hover:bg-white/5 flex items-center gap-3 transition-colors">
                              <Eye className="w-4 h-4 text-[#8a95a8]" /> View Details
                            </button>
                            <button onClick={() => handleEdit(product)} className="w-full px-4 py-2.5 text-xs text-[#e8eaf0] hover:bg-white/5 flex items-center gap-3 transition-colors">
                              <Pencil className="w-4 h-4 text-[#8a95a8]" /> Edit Product
                            </button>
                            <button onClick={() => setVariantPopup({product})} className="w-full px-4 py-2.5 text-xs text-[#e8eaf0] hover:bg-white/5 flex items-center gap-3 transition-colors">
                              <LayoutGrid className="w-4 h-4 text-[#8a95a8]" /> Manage Variants
                            </button>
                            {product.is_tracked && (
                              <button onClick={() => { setAddStockModal({ product }); setAddStockQty(''); setAddStockNote(''); }} className="w-full px-4 py-2.5 text-xs text-[#e8eaf0] hover:bg-white/5 flex items-center gap-3 transition-colors">
                                <Plus className="w-4 h-4 text-[#8a95a8]" /> Adjust Stock
                              </button>
                            )}
                            <div className="border-t border-white/5 my-1.5"></div>
                            <button onClick={() => { setHistoryModal({ product }); fetchProductHistory(product.id); }} className="w-full px-4 py-2.5 text-xs text-[#e8eaf0] hover:bg-white/5 flex items-center gap-3 transition-colors">
                              <History className="w-4 h-4 text-[#8a95a8]" /> Stock History
                            </button>
                            <div className="border-t border-white/5 my-1.5"></div>
                            <button onClick={() => handleDelete(product.id)} className="w-full px-4 py-2.5 text-xs text-[#ef4444] hover:bg-red-500/10 flex items-center gap-3 transition-colors font-bold">
                              <Trash2 className="w-4 h-4 text-[#ef4444]" /> Delete Product
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-white/5 flex items-center justify-between">
            <span className="text-xs text-[#8a95a8]">Showing 1 to {Math.min(filteredProducts.length, 10)} of {filteredProducts.length} products</span>
            {/* Simple pagination mock for UI */}
            <div className="flex gap-1">
              <button className="px-2 py-1 bg-[#1a2235] text-xs text-[#8a95a8] rounded hover:bg-white/5">‹</button>
              <button className="px-2 py-1 bg-[#f0c040] text-xs text-black font-bold rounded">1</button>
              <button className="px-2 py-1 bg-[#1a2235] text-xs text-[#8a95a8] rounded hover:bg-white/5">2</button>
              <button className="px-2 py-1 bg-[#1a2235] text-xs text-[#8a95a8] rounded hover:bg-white/5">›</button>
            </div>
          </div>
        </div>

        {/* Right Column - Sidebar */}
        <div className="xl:col-span-1 flex flex-col gap-6">
          
          {/* Top Selling (Only Finished Goods) */}
          {!isRawMaterials && (
            <div className="bg-[#131929] p-5 rounded-xl border border-white/5 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-black text-[#f0c040] uppercase tracking-wider">Top Selling Products</h3>
                <select className="bg-transparent text-[10px] text-[#8a95a8] outline-none">
                  <option>This Month</option>
                  <option>Last Month</option>
                </select>
              </div>
              <div className="flex flex-col gap-3">
                {topSelling.map((p, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-[#f0c040] text-xs font-bold">{i + 1}</span>
                      <div className="w-8 h-8 rounded bg-[#1a2235] overflow-hidden">
                        {p.image_urls?.[0] ? <img src={p.image_urls[0]} className="w-full h-full object-cover" /> : <Package className="w-4 h-4 m-2 text-[#4a5568]" />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white truncate max-w-[100px]">{p.name}</p>
                        <p className="text-[9px] text-[#8a95a8]">{Math.floor(Math.random() * 50 + 10)} units sold</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-white">৳ {(Number(p.price) * 10).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Low Stock Alerts */}
          <div className="bg-[#131929] p-5 rounded-xl border border-white/5 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#ef4444]/5 blur-[50px] pointer-events-none" />
            <div className="flex items-center justify-between mb-4 relative z-10">
              <h3 className="text-[10px] font-black text-[#f0c040] uppercase tracking-wider">Low Stock Alerts</h3>
              <button className="text-[10px] text-[#3b82f6] hover:underline">View All</button>
            </div>
            <div className="flex flex-col gap-3 relative z-10">
              {lowStockItemsList.length === 0 ? (
                <p className="text-xs text-[#8a95a8] py-4 text-center">No low stock alerts.</p>
              ) : (
                lowStockItemsList.map((p, i) => {
                  const qty = Math.floor(Number(p.stock_quantity || 0));
                  return (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-[#1a2235] overflow-hidden">
                          {p.image_urls?.[0] ? <img src={p.image_urls[0]} className="w-full h-full object-cover" /> : <Package className="w-4 h-4 m-2 text-[#4a5568]" />}
                        </div>
                        <p className="text-xs font-bold text-white truncate max-w-[120px]">{p.name}</p>
                      </div>
                      <span className={`text-[10px] font-bold ${qty <= 0 ? 'text-[#ef4444]' : 'text-[#f59e0b]'}`}>{qty} pcs left</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Workflow Diagram */}
          <div className="bg-[#131929] p-5 rounded-xl border border-white/5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black text-[#f0c040] uppercase tracking-wider">{isRawMaterials ? 'Raw Materials Workflow' : 'Finished Goods Workflow'}</h3>
              <button className="text-[9px] border border-white/10 px-2 py-0.5 rounded text-[#8a95a8] hover:text-white">Learn More</button>
            </div>
            <div className="flex items-center justify-between px-2">
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-full border border-[#f0c040]/30 flex items-center justify-center text-[#f0c040] bg-[#f0c040]/10"><Package className="w-4 h-4" /></div>
                <span className="text-[9px] text-[#8a95a8] text-center w-12">Create<br/>Product</span>
              </div>
              <div className="flex-1 h-px bg-white/10 -mt-6 mx-1"></div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-full border border-[#f0c040]/30 flex items-center justify-center text-[#f0c040] bg-[#f0c040]/10"><List className="w-4 h-4" /></div>
                <span className="text-[9px] text-[#8a95a8] text-center w-12">Manage<br/>Variants</span>
              </div>
              <div className="flex-1 h-px bg-white/10 -mt-6 mx-1"></div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-full border border-[#f0c040]/30 flex items-center justify-center text-[#f0c040] bg-[#f0c040]/10"><Box className="w-4 h-4" /></div>
                <span className="text-[9px] text-[#8a95a8] text-center w-12">Track<br/>Stock</span>
              </div>
              <div className="flex-1 h-px bg-white/10 -mt-6 mx-1"></div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-full border border-[#f0c040]/30 flex items-center justify-center text-[#f0c040] bg-[#f0c040]/10"><TrendingUp className="w-4 h-4" /></div>
                <span className="text-[9px] text-[#8a95a8] text-center w-12">{isRawMaterials ? 'Use in\nProduction' : 'Make\nSales'}</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Forms and Modals (Preserved from original) */}
      {/* Forms and Modals */}
      {showForm && (
        <div className="fixed inset-0 z-[100] bg-[#0b0f1a]/95 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-fade-in md:pl-[80px]">
          <form onSubmit={handleSubmit} className="bg-[#131929] w-full max-w-[1200px] h-full max-h-[95vh] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] border border-white/5 flex flex-col relative">
            
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/5 shrink-0 bg-[#131929] rounded-t-2xl z-10">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-[#f0c040]/10 flex items-center justify-center border border-[#f0c040]/20 text-[#f0c040]">
                  <Box className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[#8a95a8] uppercase tracking-wider mb-0.5">Inventory Management</p>
                  <h2 className="text-xl font-black text-white">{editingId ? 'Edit Product' : 'Add New Product'}</h2>
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowVariantManager(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a2235] border border-white/5 text-[#c8cdd7] text-xs font-bold hover:bg-white/5 transition">
                  <List className="w-3.5 h-3.5 text-[#8a95a8]" /> Manage Variants
                </button>
                <button type="button" onClick={resetEmpForm} className="text-[#8a95a8] hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Column (Main Form Sections) */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                  
                  {/* 1. Basic Information */}
                  <div className="bg-[#1a2235] p-5 sm:p-6 rounded-xl border border-[rgba(255,255,255,0.04)]">
                    <h3 className="text-sm font-bold text-[#e8eaf0] mb-5 flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-[#f0c040] text-[#0a0900] flex items-center justify-center text-[11px] font-black">1</span> 
                      Basic Information
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className={labelClass}>Product Name <span className="text-red-500">*</span></label>
                        <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Enter product name" className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>SKU <span className="text-red-500">*</span></label>
                        <input type="text" value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value })} placeholder="Unique product code" className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>Product Type / Grade <span className="text-red-500">*</span></label>
                        <select value={formData.product_quality} onChange={e => setFormData({ ...formData, product_quality: e.target.value })} className={inputClass}>
                          <option value="">— Select Grade / Quality —</option>
                          <option value="Light Series">Light Series</option>
                          <option value="Medium Series">Medium Series</option>
                          <option value="AC Series">AC Series</option>
                          <option value="Essential Series">Essential Series</option>
                          <option value="Classic Series">Classic Series</option>
                          <option value="Signature Series">Signature Series</option>
                          <option value="Elite Series">Elite Series</option>
                        </select>
                        <p className="text-[10px] text-[#8a95a8] mt-1.5">e.g. Standard, Premium, Economy</p>
                      </div>
                      <div>
                        <label className={labelClass}>Unit <span className="text-red-500">*</span></label>
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
                        <p className="text-[9px] text-[#8a95a8] mt-1.5">Base unit for this product</p>
                      </div>
                      <div className="flex flex-col justify-start">
                        <div className="flex items-center justify-between mb-2 mt-1">
                          <span className="text-[11px] font-bold text-[#8a95a8]">This product has a barcode</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={hasBarcode} onChange={e => { setHasBarcode(e.target.checked); if (!e.target.checked) setFormData({ ...formData, barcode: '' }); }} className="sr-only peer" />
                            <div className="w-9 h-5 bg-[#131929] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#8a95a8] peer-checked:after:bg-[#0a0900] after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#f0c040]"></div>
                          </label>
                        </div>
                        {hasBarcode && (
                          <div className="animate-slide-up mt-1">
                            <label className={labelClass}>Barcode</label>
                            <input type="text" value={formData.barcode} onChange={e => setFormData({ ...formData, barcode: e.target.value })} placeholder="Enter or scan barcode" className={inputClass} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 2 & 3 row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 2. Manufacturing */}
                    <div className="bg-[#1a2235] p-5 sm:p-6 rounded-xl border border-[rgba(255,255,255,0.04)]">
                      <h3 className="text-sm font-bold text-[#e8eaf0] mb-5 flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-[#f0c040] text-[#0a0900] flex items-center justify-center text-[11px] font-black">2</span> 
                        Manufacturing
                      </h3>
                      <div className="space-y-4">
                        <label className="flex items-center cursor-pointer mb-2">
                          <input type="checkbox" checked={formData.use_for_processing} onChange={e => setFormData({ ...formData, use_for_processing: e.target.checked })} className="w-4 h-4 accent-[#f0c040] rounded bg-[#131929] border-white/10" />
                          <span className="text-xs font-bold text-[#e8eaf0] ml-3">Used in Manufacturing</span>
                        </label>
                        
                        {formData.use_for_processing && (
                          <div className="space-y-4 animate-fade-in">
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
                    </div>

                    {/* 3. Stock Tracking */}
                    <div className="bg-[#1a2235] p-5 sm:p-6 rounded-xl border border-[rgba(255,255,255,0.04)] flex flex-col">
                      <div className="flex items-center justify-between mb-5">
                        <h3 className="text-sm font-bold text-[#e8eaf0] flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-[#f0c040] text-[#0a0900] flex items-center justify-center text-[11px] font-black">3</span> 
                          Stock Tracking
                        </h3>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <label className={labelClass}>Cost Price (৳) <span className="text-red-500">*</span></label>
                          <input type="number" onKeyDown={blockInvalidChar} value={formData.cost} onChange={e => setFormData({ ...formData, cost: e.target.value })} className={inputClass} />
                        </div>

                        <label className="flex items-center cursor-pointer my-2">
                          <input type="checkbox" checked={formData.is_tracked} onChange={e => setFormData({ ...formData, is_tracked: e.target.checked })} className="w-4 h-4 accent-[#f0c040] rounded bg-[#131929] border-white/10" />
                          <span className="text-xs font-bold text-[#e8eaf0] ml-3">Track inventory for this product</span>
                        </label>

                        {formData.is_tracked && (
                          <div className="space-y-4 animate-fade-in">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className={labelClass}>Opening Stock</label>
                                <div className="relative">
                                  <input type="number" onKeyDown={blockInvalidChar} value={formData.stock_quantity} onChange={e => setFormData({ ...formData, stock_quantity: e.target.value })} className={`${inputClass} pr-10`} />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#8a95a8]">{formData.unit}</span>
                                </div>
                              </div>
                              <div>
                                <label className={labelClass}>Reorder Level</label>
                                <div className="relative">
                                  <input type="number" onKeyDown={blockInvalidChar} value={formData.minimum_stock} onChange={e => setFormData({ ...formData, minimum_stock: e.target.value })} className={`${inputClass} pr-10`} />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>



                  {/* 5. Variants & Attributes */}
                  <div className="bg-[#1a2235] p-5 sm:p-6 rounded-xl border border-[rgba(255,255,255,0.04)]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-4">
                      <h3 className="text-sm font-bold text-[#e8eaf0] flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-[#f0c040] text-[#0a0900] flex items-center justify-center text-[11px] font-black">4</span> 
                        Variants & Attributes
                        <span className="text-[10px] font-normal text-[#8a95a8] ml-2 hidden sm:inline">Add variants like size, color, material, etc.</span>
                      </h3>
                    </div>

                    <div className="flex flex-wrap gap-3 mb-4">
                      {globalVariants.map((gv, gi) => {
                        const existing = (formData.variants || []).find((v: any) => v.name === gv);
                        if (!existing) return null;
                        return (
                          <div key={gi} className="bg-[#131929] border border-[rgba(201,168,76,0.3)] rounded-lg p-3 flex items-start gap-4 min-w-[160px]">
                            <div>
                              <p className="text-[11px] font-bold text-[#e8eaf0]">{gv}</p>
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-[10px] text-[#8a95a8]">৳</span>
                                <input
                                  type="number"
                                  placeholder="0.00"
                                  onKeyDown={blockInvalidChar}
                                  value={existing.price}
                                  onChange={e => {
                                    const updated = (formData.variants || []).map((v: any) =>
                                      v.name === gv ? { ...v, price: e.target.value } : v
                                    );
                                    setFormData({ ...formData, variants: updated });
                                  }}
                                  className="bg-transparent text-[11px] font-bold text-[#f0c040] w-14 outline-none placeholder:text-[#f0c040]/30"
                                />
                                <span className="text-[10px] text-[#8a95a8]">· 0 pcs</span>
                              </div>
                            </div>
                            <button type="button" onClick={() => setFormData({ ...formData, variants: (formData.variants || []).filter((v: any) => v.name !== gv) })} className="text-[#8a95a8] hover:text-white">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                      
                       <div className="relative self-center h-[52px]">
                        <button 
                          type="button" 
                          onClick={(e) => { e.stopPropagation(); setShowVariantDropdown(!showVariantDropdown); }}
                          className="h-full px-5 rounded-lg border border-dashed border-[#f0c040]/30 flex items-center justify-center gap-2 text-[11px] font-bold text-[#f0c040] bg-[#f0c040]/5 hover:bg-[#f0c040]/10 transition-all"
                        >
                          <Plus className="w-3 h-3" /> {showVariantDropdown ? 'Close' : 'Add Variant'}
                        </button>
                        
                        {showVariantDropdown && (
                          <div className="absolute bottom-full left-0 mb-2 w-56 bg-[#131929] border border-white/10 rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-2 z-[110] animate-slide-up" onClick={(e) => e.stopPropagation()}>
                            <div className="p-2 border-b border-white/5 mb-2">
                              <p className="text-[9px] font-bold text-[#8a95a8] uppercase tracking-widest mb-2">Quick Add New Name</p>
                              <div className="flex gap-1">
                                <input 
                                  type="text" 
                                  placeholder="e.g. XL, Red..." 
                                  className="flex-1 bg-[#1a2235] border border-white/10 rounded px-2 py-1 text-[10px] text-white outline-none focus:border-[#f0c040]/50"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      const val = (e.target as HTMLInputElement).value.trim();
                                      if (val && !globalVariants.includes(val)) {
                                        const updated = [...globalVariants, val];
                                        setGlobalVariants(updated);
                                        saveGlobalVariants(category, updated);
                                        setFormData({ ...formData, variants: [...(formData.variants || []), { name: val, price: '' }] });
                                        (e.target as HTMLInputElement).value = '';
                                        setShowVariantDropdown(false);
                                      }
                                    }
                                  }}
                                />
                              </div>
                            </div>

                            <p className="text-[9px] font-bold text-[#8a95a8] uppercase tracking-widest px-2 mb-1">Select Existing</p>
                            <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto custom-scrollbar">
                              {globalVariants.filter(gv => !(formData.variants || []).find((v: any) => v.name === gv)).length === 0 ? (
                                <p className="text-[10px] text-center text-[#4a5568] py-2 italic">No more variants.</p>
                              ) : (
                                globalVariants.map((gv, gi) => {
                                  if ((formData.variants || []).find((v: any) => v.name === gv)) return null;
                                  return (
                                    <button 
                                      key={gi} 
                                      type="button" 
                                      onClick={() => {
                                        setFormData({ ...formData, variants: [...(formData.variants || []), { name: gv, price: '' }] });
                                        setShowVariantDropdown(false);
                                      }} 
                                      className="text-left px-3 py-2 text-xs text-[#e8eaf0] hover:bg-[#f0c040]/10 hover:text-[#f0c040] rounded transition-colors"
                                    >
                                      {gv}
                                    </button>
                                  );
                                })
                              )}
                            </div>
                            <button 
                              type="button" 
                              onClick={() => { setShowVariantManager(true); setShowVariantDropdown(false); }}
                              className="w-full mt-2 pt-2 border-t border-white/5 text-[10px] font-bold text-[#c9a84c] hover:text-[#f0c040] py-1 transition-colors"
                            >
                              Manage All Variants
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 flex justify-end items-center">
                        <button type="button" onClick={() => setShowVariantManager(true)} className="px-4 py-2 rounded-lg border border-[rgba(255,255,255,0.1)] flex items-center justify-center gap-2 text-[11px] font-bold text-[#e8eaf0] hover:bg-white/5 transition-colors">
                          <LayoutGrid className="w-3 h-3 text-[#f0c040]" /> Manage Variants
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="bg-[#1a2235] p-5 sm:p-6 rounded-xl border border-[rgba(255,255,255,0.04)]">
                    <label className="text-sm font-bold text-[#e8eaf0] mb-3 flex items-center gap-2">
                      <List className="w-4 h-4 text-[#f0c040]" /> Notes (Optional)
                    </label>
                    <textarea placeholder="Add any additional notes about this product..." className={`${inputClass} min-h-[80px] resize-y bg-[#131929]`} />
                    <div className="flex justify-between items-center mt-2">
                      <p className="text-[10px] text-[#8a95a8]">Internal notes are visible only to your team.</p>
                      <p className="text-[10px] text-[#8a95a8]">0 / 300</p>
                    </div>
                  </div>

                </div>

                {/* Right Column (Preview & Validation) */}
                <div className="lg:col-span-1 flex flex-col gap-6">
                  
                  {/* Product Preview */}
                  <div className="bg-[#1a2235] p-5 sm:p-6 rounded-xl border border-[rgba(255,255,255,0.04)]">
                    <h3 className="text-sm font-bold text-[#e8eaf0] mb-4 flex items-center gap-2">
                      <Box className="w-4 h-4 text-[#8a95a8]" /> Product Preview
                    </h3>
                    
                    <div className="border border-dashed border-[rgba(255,255,255,0.1)] rounded-xl p-8 flex flex-col items-center justify-center text-center bg-[#131929] mb-4 min-h-[240px]">
                      {imagePreviews.length > 0 ? (
                        <div className="relative w-full aspect-square rounded-lg overflow-hidden group">
                          <img src={imagePreviews[0]} alt="Main Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-sm">
                            <label className="cursor-pointer bg-black/60 hover:bg-black/80 text-white p-2 rounded-lg transition-colors">
                              <Upload className="w-4 h-4" />
                              <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageChange} />
                            </label>
                            <button type="button" onClick={() => removeImage(0)} className="bg-red-500/80 hover:bg-red-500 text-white p-2 rounded-lg transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="w-16 h-16 bg-[rgba(255,255,255,0.02)] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[rgba(255,255,255,0.05)]">
                            <Box className="w-8 h-8 text-[rgba(255,255,255,0.1)]" />
                          </div>
                          <p className="text-[11px] font-bold text-[#8a95a8]">No image uploaded</p>
                          <p className="text-[10px] text-[#4a5568] mt-1 mb-5">Upload up to 5 images</p>
                          <label className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-[rgba(201,168,76,0.3)] text-[11px] font-bold text-[#f0c040] hover:bg-[rgba(201,168,76,0.05)] transition-colors cursor-pointer">
                            Upload Images
                            <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageChange} />
                          </label>
                        </div>
                      )}
                    </div>

                    {imagePreviews.length > 1 && (
                      <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2">
                        {imagePreviews.slice(1).map((src, idx) => (
                          <div key={idx + 1} className="relative w-12 h-12 rounded border border-[rgba(255,255,255,0.1)] shrink-0 overflow-hidden group">
                            <img src={src} className="w-full h-full object-cover" />
                            <button type="button" onClick={() => removeImage(idx + 1)} className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <X className="w-3 h-3 text-white" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Validation Checklist */}
                  <div className="bg-[#1a2235] p-5 sm:p-6 rounded-xl border border-[rgba(255,255,255,0.04)] flex-1">
                    <ul className="space-y-4">
                      <li className="flex items-center gap-3 text-xs font-bold">
                        <CheckCircle className={`w-4 h-4 ${formData.name.trim() ? 'text-[#22c55e]' : 'text-[#4a5568]'}`} />
                        <span className={formData.name.trim() ? 'text-[#e8eaf0]' : 'text-[#8a95a8]'}>Product name is required</span>
                      </li>
                      <li className="flex items-center gap-3 text-xs font-bold">
                        <CheckCircle className={`w-4 h-4 ${formData.sku.trim() ? 'text-[#22c55e]' : 'text-[#4a5568]'}`} />
                        <span className={formData.sku.trim() ? 'text-[#e8eaf0]' : 'text-[#8a95a8]'}>SKU must be unique</span>
                      </li>
                      <li className="flex items-center gap-3 text-xs font-bold">
                        <CheckCircle className={`w-4 h-4 ${Number(formData.stock_quantity) >= 0 || formData.stock_quantity === '' ? 'text-[#22c55e]' : 'text-[#4a5568]'}`} />
                        <span className={Number(formData.stock_quantity) >= 0 || formData.stock_quantity === '' ? 'text-[#e8eaf0]' : 'text-[#8a95a8]'}>Opening stock can be 0 or more</span>
                      </li>
                      <li className="flex items-start gap-3 text-xs font-bold pt-4 mt-4 border-t border-[rgba(255,255,255,0.05)]">
                        <div className="w-4 h-4 rounded-full border border-[#3b82f6] text-[#3b82f6] flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-[10px]">i</span>
                        </div>
                        <span className="text-[#8a95a8] leading-relaxed">You can edit all details after saving</span>
                      </li>
                    </ul>
                  </div>

                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 sm:p-5 border-t border-white/5 bg-[#1a2235] flex flex-col sm:flex-row items-center justify-between shrink-0 rounded-b-2xl gap-4 z-10 mx-6 mb-6 mt-2 border-[rgba(201,168,76,0.2)] shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full border border-[rgba(201,168,76,0.3)] flex items-center justify-center bg-[rgba(201,168,76,0.05)]">
                  <CheckCircle className="w-5 h-5 text-[#f0c040]" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Review your details before saving.</p>
                  <p className="text-[10px] text-[#8a95a8] mt-0.5">You can save as draft anytime.</p>
                </div>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button type="button" onClick={resetEmpForm} className="flex-1 sm:flex-none px-6 py-2.5 rounded-lg border border-[rgba(255,255,255,0.1)] text-[#8a95a8] hover:text-white hover:bg-[rgba(255,255,255,0.05)] font-bold transition-colors text-xs text-center">
                  Cancel
                </button>
                <button type="button" className="hidden sm:block px-6 py-2.5 rounded-lg border border-[rgba(255,255,255,0.1)] text-[#e8eaf0] hover:text-white hover:bg-[rgba(255,255,255,0.05)] font-bold transition-colors text-xs text-center flex items-center gap-2">
                  <Printer className="w-3.5 h-3.5" /> Save Draft
                </button>
                <button type="submit" disabled={submitting} className="flex-1 sm:flex-none px-8 py-2.5 rounded-lg bg-[#f0c040] text-[#0a0900] font-extrabold hover:bg-[#f5d061] transition-colors shadow-[0_4px_16px_rgba(201,168,76,0.2)] text-xs disabled:opacity-50 text-center flex items-center justify-center gap-2">
                  <List className="w-3.5 h-3.5" /> {submitting ? 'Saving...' : (editingId ? 'Update Product' : 'Save Product')}
                </button>
              </div>
            </div>

          </form>
        </div>
      )}

      {/* ══════════════════════════════════════
          ADD STOCK MODAL
      ══════════════════════════════════════ */}
      {addStockModal && (
        <div className="fixed inset-0 bg-[#0b0f1a]/80 backdrop-blur-sm flex items-center justify-center z-[100] md:pl-[80px] p-4 animate-fade-in">
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
        <div className="fixed inset-0 bg-[#0b0f1a]/80 backdrop-blur-sm flex items-center justify-center z-[100] md:pl-[80px] p-4">
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
        <div className="fixed inset-0 bg-[#0b0f1a]/80 backdrop-blur-sm flex items-center justify-center z-[100] md:pl-[80px] p-4 animate-fade-in">
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
      {(showGlobalHistory || historyModal) && (
        <div className="fixed inset-0 bg-[#0b0f1a]/80 backdrop-blur-sm flex items-center justify-center z-[100] md:pl-[80px] p-4 animate-fade-in">
          <div className="bg-[#131929] border border-[rgba(96,165,250,0.3)] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="bg-[#1a2235] border-b border-[rgba(255,255,255,0.04)] px-6 py-4 flex justify-between items-center">
              <h2 className="text-sm font-black text-blue-400 flex items-center gap-2 uppercase tracking-widest">
                <History className="w-4 h-4" /> 
                {historyModal ? `Stock History: ${historyModal.product.name}` : `Recent Stock Updates (${headingTitle})`}
              </h2>
              <button onClick={() => { setShowGlobalHistory(false); setHistoryModal(null); }} className="text-[#8a95a8] hover:text-white p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.05)] transition-colors">
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
              <button onClick={() => { setShowGlobalHistory(false); setHistoryModal(null); }} className="px-6 py-2.5 bg-[#131929] border border-[rgba(255,255,255,0.1)] text-[#e8eaf0] font-bold rounded-lg hover:bg-[rgba(255,255,255,0.05)] transition-colors text-sm">
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
        <div className="fixed inset-0 bg-[#0b0f1a]/80 backdrop-blur-sm flex items-center justify-center z-[100] md:pl-[80px] p-4 animate-fade-in">
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