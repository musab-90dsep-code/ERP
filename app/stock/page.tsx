'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-utils';
import { Plus, Trash2, Pencil, Search, Filter, Printer, Download, ChevronDown, Package, Image as ImageIcon, X, Upload } from 'lucide-react';

function StockContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab');
  const [products, setProducts] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hasBarcode, setHasBarcode] = useState(false);

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

  // ---------------- নতুন ফিল্ডগুলো যুক্ত করা হলো ----------------
  const [formData, setFormData] = useState<any>({
    name: '', sku: '', price: '', cost: '', stock_quantity: '', is_tracked: true,
    low_stock_alert: false, minimum_stock: '',
    unit: 'pcs', unit_value: 1, barcode: '', use_for_processing: false,
    processing_price_auto: '', processing_price_manual: '',
    image_urls: [] as string[]
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

  // Click outside to close menus
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

  // Image Upload Logic (Max 5)
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      const totalImages = imageFiles.length + filesArray.length;

      if (totalImages > 5) {
        alert('You can only upload a maximum of 5 images.');
        return;
      }

      setImageFiles(prev => [...prev, ...filesArray]);
      const newPreviews = filesArray.map(file => URL.createObjectURL(file));
      setImagePreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
    // Remove from formData if it's an existing URL
    if (formData.image_urls[index]) {
      setFormData((prev: any) => ({
        ...prev,
        image_urls: prev.image_urls.filter((_: any, i: number) => i !== index)
      }));
    }
  };

  const uploadImagesToSupabase = async (): Promise<string[]> => {
    const uploadedUrls: string[] = [...formData.image_urls]; // Keep existing ones
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
      // 1. Upload new images if any
      const finalImageUrls = imageFiles.length > 0 ? await uploadImagesToSupabase() : formData.image_urls;

      let finalSku = formData.sku.trim();
      if (!finalSku) {
        finalSku = `SKU-${Date.now().toString().slice(-6)}`;
      }

      const payload = { ...formData, sku: finalSku, image_urls: finalImageUrls, category };

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
    setFormData({
      name: '', sku: '', price: '', cost: '', stock_quantity: '', is_tracked: true,
      low_stock_alert: false, minimum_stock: '',
      unit: 'pcs', barcode: '', use_for_processing: false, processing_price_auto: '', processing_price_manual: '', image_urls: []
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
      image_urls: product.image_urls || []
    });
    setHasBarcode(!!product.barcode);
    setImagePreviews(product.image_urls || []);
    setImageFiles([]); // Clear new files array since we are loading existing ones
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
    // Basic CSV download logic...
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

  return (
    <div className="pb-10 dropdown-container">
      <div className="flex justify-between items-center mb-6 print:hidden">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Package className="w-6 h-6 text-indigo-600" />
          {headingTitle} Management
        </h1>
        <button onClick={() => { if (!showForm) resetEmpForm(); setShowForm(!showForm); }}
          className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 hover:bg-indigo-700 font-semibold shadow-sm transition-colors">
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      {/* ---------------- FORM SECTION ---------------- */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8 print:hidden">

          {/* Image Upload Area (5 pics slot) */}
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
            {/* Common Fields */}
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
              <div className="flex gap-2">
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

            {/* Raw Material Specific Fields */}
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

            <div className="md:col-span-3 flex justify-end gap-3 mt-4 border-t border-gray-100 pt-5">
              <button type="button" onClick={resetEmpForm} className="bg-white text-gray-700 px-6 py-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 font-bold transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="bg-indigo-600 text-white px-8 py-2.5 rounded-lg hover:bg-indigo-700 font-bold transition-colors shadow-md disabled:opacity-50">
                {submitting ? 'Saving...' : (editingId ? 'Update Product' : 'Save Product')}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ---------------- TABLE SECTION ---------------- */}
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
                  {visibleColumns.price && <td className="px-6 py-4 font-bold text-gray-900">${product.price}</td>}
                  {visibleColumns.stock && (
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${product.is_tracked && product.stock_quantity <= (product.minimum_stock || 0) && product.low_stock_alert ? 'text-red-600' : 'text-green-600'}`}>
                          {product.is_tracked ? product.stock_quantity : 'N/A'}
                        </span>
                        <span className="text-xs text-gray-500 uppercase">{product.unit_value > 1 ? `${product.unit_value} ${product.unit}` : product.unit}</span>
                      </div>
                    </td>
                  )}
                  {visibleColumns.actions && (
                    <td className="px-6 py-4 text-right">
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