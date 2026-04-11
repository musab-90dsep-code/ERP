'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-utils';
import { Settings, Plus, Send, Download, Truck, Package, Box, Calendar, UserCheck, Hash, LogIn, LogOut, Ticket, PenTool, X } from 'lucide-react';

export default function ProcessingPage() {
  return (
    <Suspense fallback={<div className="p-10 font-bold text-center">Loading processing...</div>}>
      <ProcessingContent />
    </Suspense>
  );
}

function ProcessingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initTab = (searchParams.get('tab') as 'issued' | 'received') || 'issued';
  
  const [activeTab, setActiveTab] = useState<'issued' | 'received'>(initTab);
  
  const [processors, setProcessors] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  
  // Form State
  const generateMemoNo = () => `MEMO-${Math.floor(100000 + Math.random() * 900000)}`;
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [processorId, setProcessorId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [memoNo, setMemoNo] = useState('');
  const [processType, setProcessType] = useState('');
  const [note, setNote] = useState('');
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [authorizedSignature, setAuthorizedSignature] = useState('');
  const [receivedBy, setReceivedBy] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
    if (!memoNo) setMemoNo(generateMemoNo());
  }, []);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'issued' || tab === 'received') {
      setActiveTab(tab as 'issued' | 'received');
      setQuantity('');
      setMemoNo(generateMemoNo());
    }
  }, [searchParams]);

  useEffect(() => {
    fetchLogs();
  }, [activeTab]);

  const fetchData = async () => {
    // 1. Fetch Processors
    const { data: procData, error: procErr } = await supabase
      .from('contacts')
      .select('id, name, shop_name')
      .eq('type', 'processor');
    if (procErr) console.error(procErr);
    else setProcessors(procData || []);

    // 2. Fetch Products
    const { data: prodData, error: prodErr } = await supabase
      .from('products')
      .select('id, name, unit, stock_quantity, category, processing_price_auto, processing_price_manual')
      .eq('use_for_processing', true);
    if (prodErr) console.error(prodErr);
    else setProducts(prodData || []);

    // 3. Fetch Employees
    const { data: empData, error: empErr } = await supabase
      .from('employees')
      .select('id, name, is_authorizer')
      .order('name');
    if (empErr) console.error(empErr);
    else setEmployees(empData || []);
  };

  const fetchLogs = async () => {
    const { data, error } = await supabase
      .from('processing_orders')
      .select(`
        id, created_at, type, quantity, date, process_type, note, photo_urls, unit_cost, total_cost,
        contacts ( name, shop_name ),
        products ( name, unit )
      `)
      .eq('type', activeTab)
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error(error);
    } else {
      setLogs(data || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!processorId || !productId || !quantity || Number(quantity) <= 0 || !authorizedSignature || !receivedBy) {
      alert('Please fill out all required fields correctly. (Process Type and Notes are optional)');
      return;
    }

    setSubmitting(true);
    try {
      const numericQuantity = Number(quantity);

      // 1. Fetch the exact current stock to prevent race conditions as best as possible without RPC
      const { data: currentProduct, error: fetchErr } = await supabase
        .from('products')
        .select('stock_quantity')
        .eq('id', productId)
        .single();
        
      if (fetchErr) throw fetchErr;

      let newStock = Number(currentProduct.stock_quantity || 0);

      // If grouping: Issue means stock goes DOWN (we give to processor). Received means stock goes UP.
      if (activeTab === 'issued') {
        newStock = newStock - numericQuantity;
      } else {
        newStock = newStock + numericQuantity;
      }

      // 2. Update stock
      const { error: updateErr } = await supabase
        .from('products')
        .update({ stock_quantity: newStock })
        .eq('id', productId);
      
      if (updateErr) throw updateErr;

      // 3. Upload images
      const uploadedUrls: string[] = [];
      for (const file of photoFiles) {
        const path = `processing/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
        const { error: uploadError } = await supabase.storage.from('processing-files').upload(path, file);
        if (!uploadError) {
          const { data } = supabase.storage.from('processing-files').getPublicUrl(path);
          uploadedUrls.push(data.publicUrl);
        }
      }

      const unitCost = processType === 'auto' ? Number(selectedProductObj?.processing_price_auto || 0) : processType === 'manual' ? Number(selectedProductObj?.processing_price_manual || 0) : 0;
      const totalCost = numericQuantity * unitCost;

      const payload = {
        type: activeTab,
        memo_no: memoNo,
        processor_id: processorId,
        product_id: productId,
        quantity: numericQuantity,
        date: date,
        authorized_signature: authorizedSignature,
        received_by: receivedBy,
        process_type: processType || null,
        note: note || null,
        unit_cost: unitCost,
        total_cost: totalCost,
        photo_urls: uploadedUrls.length > 0 ? uploadedUrls : undefined
      };

      const { error: insertErr } = await supabase
        .from('processing_orders')
        .insert([payload]);

      if (insertErr) throw insertErr;

      // Finish up
      setQuantity('');
      setProcessType('');
      setNote('');
      setPhotoFiles([]);
      setPhotoPreviews([]);
      setMemoNo(generateMemoNo());
      setAuthorizedSignature('');
      setReceivedBy('');
      fetchData(); // refresh product stocks
      fetchLogs();
    } catch (error) {
      console.error(error);
      alert('An error occurred while saving. Make sure you ran the SQL queries provided previously!');
    } finally {
      setSubmitting(false);
    }
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

  // derived values for selected product
  const selectedProductObj = products.find(p => p.id === productId);

  return (
    <div className="pb-10 font-sans animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-gradient-to-r from-slate-900 to-slate-800 p-8 rounded-3xl text-white shadow-lg relative overflow-hidden mb-8">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white opacity-5 blur-3xl pointer-events-none"></div>
        <div className="relative z-10">
          <p className="text-slate-300 font-medium mb-1 text-sm tracking-widest uppercase flex items-center gap-2">
            <Settings className="w-4 h-4" /> Operations Tracking
          </p>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">Processing Sector Management</h1>
          <p className="text-slate-300 max-w-xl text-sm md:text-base">
            Track materials issued to factory processors and log the receipt of finished/processed goods. Submitting these forms automatically updates your core product inventory.
          </p>
        </div>
      </div>

      {/* Tabs handled by sidebar navigation now */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Form Action */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sticky top-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-inner ${activeTab === 'issued' ? 'bg-orange-500' : 'bg-green-500'}`}>
                {activeTab === 'issued' ? <Send className="w-5 h-5" /> : <Download className="w-5 h-5" />}
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 leading-tight">
                  {activeTab === 'issued' ? 'Issue to Processor' : 'Receive from Processor'}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 font-mono font-bold flex items-center gap-1">
                     <Ticket className="w-3 h-3" /> {memoNo}
                  </span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-2"><Calendar className="w-4 h-4 text-gray-400" /> Transaction Date</label>
                <input required type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-slate-800 transition-all font-medium text-sm text-gray-800 bg-gray-50 hover:bg-white" />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-2"><UserCheck className="w-4 h-4 text-gray-400" /> Select Processor</label>
                <select required value={processorId} onChange={e => setProcessorId(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-slate-800 transition-all font-medium text-sm text-gray-800 bg-gray-50 hover:bg-white appearance-none">
                  <option value="" disabled>-- Choose a processor --</option>
                  {processors.map(p => (
                     <option key={p.id} value={p.id}>{p.name} {p.shop_name ? `(${p.shop_name})` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-2"><Box className="w-4 h-4 text-gray-400" /> Select Product</label>
                <select required value={productId} onChange={e => setProductId(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-slate-800 transition-all font-medium text-sm text-gray-800 bg-gray-50 hover:bg-white appearance-none">
                  <option value="" disabled>-- Choose a product --</option>
                  {products.map(pr => (
                     <option key={pr.id} value={pr.id}>{pr.name} (In stock: {pr.stock_quantity} {pr.unit || 'pcs'})</option>
                  ))}
                </select>
                {selectedProductObj && (
                  <p className="text-xs font-semibold mt-2 px-3 py-1.5 rounded-md bg-slate-100 text-slate-600 block w-max">
                     Current Stock: <span className="text-slate-900">{selectedProductObj.stock_quantity} {selectedProductObj.unit || 'pcs'}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-2"><Hash className="w-4 h-4 text-gray-400" /> {activeTab === 'issued' ? 'Issue' : 'Receive'} Quantity</label>
                <div className="relative">
                  <input required type="number" min="0.01" step="0.01" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0.00" className="w-full pl-3 pr-12 py-2.5 border border-gray-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-slate-800 transition-all text-gray-900 bg-gray-50 hover:bg-white" />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold uppercase tracking-wide">
                     {selectedProductObj?.unit || 'Unit'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-2"><Settings className="w-4 h-4 text-gray-400" /> Process Type (Optional)</label>
                  <select value={processType} onChange={e => setProcessType(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-slate-800 transition-all font-medium text-sm text-gray-800 bg-gray-50 hover:bg-white appearance-none">
                    <option value="">-- Let system decide / Not specified --</option>
                    <option value="auto">Auto</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>
                
                {processType && selectedProductObj && (
                  <div className="md:col-span-2 bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex justify-between items-center transition-all animate-in fade-in">
                     <div>
                       <span className="text-xs font-bold text-indigo-700 block uppercase tracking-wider">Unit Processing Cost</span>
                       <span className="text-lg font-extrabold text-indigo-900">${(processType === 'auto' ? Number(selectedProductObj.processing_price_auto || 0) : Number(selectedProductObj.processing_price_manual || 0)).toFixed(2)}</span>
                     </div>
                     <div className="text-right">
                       <span className="text-xs font-bold text-indigo-700 block uppercase tracking-wider">Total Est. Cost</span>
                       <span className="text-xl font-extrabold text-indigo-900">${(Number(quantity || 0) * (processType === 'auto' ? Number(selectedProductObj.processing_price_auto || 0) : Number(selectedProductObj.processing_price_manual || 0))).toFixed(2)}</span>
                     </div>
                  </div>
                )}
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-2"><PenTool className="w-4 h-4 text-gray-400" /> Note (Optional)</label>
                  <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Add any special instructions or notes..." className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-slate-800 transition-all font-medium text-sm text-gray-800 bg-gray-50 hover:bg-white resize-none" />
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                <label className="block text-sm font-bold text-slate-700 mb-2.5 flex items-center gap-2">Attach Photos (Max 5)</label>
                <div className="flex flex-wrap gap-3 items-start pb-2">
                  {photoPreviews.map((src, idx) => (
                    <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-300 shadow-sm group">
                      <img src={src} alt="preview" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removeImage(idx)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {photoPreviews.length < 5 && (
                    <label className="w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors text-slate-500 hover:text-indigo-600 bg-white shadow-sm">
                      <Plus className="w-6 h-6 mb-1" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Upload</span>
                      <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageChange} />
                    </label>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-4 pt-4 border-t border-gray-100">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-2"><PenTool className="w-4 h-4 text-indigo-500" /> Authorized Signature</label>
                  <select required value={authorizedSignature} onChange={e => setAuthorizedSignature(e.target.value)} className="w-full border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-slate-800 transition-all font-bold text-sm text-gray-800 bg-gray-50 hover:bg-white appearance-none">
                     <option value="" disabled>-- Select Employee --</option>
                     {employees.filter(emp => emp.is_authorizer).map(emp => (
                        <option key={`auth-${emp.id}`} value={emp.name}>{emp.name}</option>
                     ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-2"><UserCheck className="w-4 h-4 text-emerald-500" /> Received By</label>
                  <select required value={receivedBy} onChange={e => setReceivedBy(e.target.value)} className="w-full border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-slate-800 transition-all font-bold text-sm text-gray-800 bg-gray-50 hover:bg-white appearance-none">
                     <option value="" disabled>-- Select Employee --</option>
                     {employees.map(emp => (
                        <option key={`rec-${emp.id}`} value={emp.name}>{emp.name}</option>
                     ))}
                  </select>
                </div>
              </div>

              <div className="pt-2 mt-2">
                <button type="submit" disabled={submitting} className={`w-full py-3 rounded-xl font-bold text-white shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-70 ${activeTab === 'issued' ? 'bg-orange-600 hover:bg-orange-700 hover:shadow-orange-200' : 'bg-green-600 hover:bg-green-700 hover:shadow-green-200'}`}>
                  {submitting ? 'Processing...' : activeTab === 'issued' ? 'Confirm Issue Material' : 'Confirm Receive Material'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: History Tracker Data Table */}
        <div className="lg:col-span-2">
           <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
              <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                 <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                    <Truck className="w-5 h-5 text-indigo-500" /> Recent {activeTab === 'issued' ? 'Issues' : 'Receipts'} Log
                 </h3>
                 <span className="text-xs font-bold bg-white border border-gray-200 text-gray-500 px-3 py-1 rounded-full shadow-sm">
                    {logs.length} Records
                 </span>
              </div>
              <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-200">
                       <tr>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Date & Ref</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Processor</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Material / Product</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Details</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500 text-right">Qty {activeTab === 'issued' ? 'Issued' : 'Received'}</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                       {logs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                             <td className="px-6 py-4">
                                <span className="font-bold text-gray-900 block text-sm">{new Date(log.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                <span className="text-[10px] text-gray-400 font-mono tracking-wider">#{log.id.split('-')[0].toUpperCase()}</span>
                             </td>
                             <td className="px-6 py-4">
                                <span className="font-semibold text-indigo-900 block text-sm">{log.contacts?.name || 'Unknown'}</span>
                                {log.contacts?.shop_name && <span className="text-xs text-indigo-600 mt-0.5 block">{log.contacts.shop_name}</span>}
                             </td>
                             <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                   <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${activeTab === 'issued' ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>
                                      <Package className="w-4 h-4" />
                                   </div>
                                   <span className="font-semibold text-gray-800 text-sm">{log.products?.name || 'Unknown'}</span>
                                </div>
                             </td>
                             <td className="px-6 py-4 text-sm max-w-[200px]">
                                {log.process_type && <span className="inline-block bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded capitalize mb-1 mr-1 border border-slate-200">{log.process_type} {log.total_cost ? `($${Number(log.total_cost).toLocaleString()})` : ''}</span>}
                                {log.note && <p className="text-xs text-gray-500 truncate mb-1" title={log.note}>{log.note}</p>}
                                
                                {log.photo_urls && log.photo_urls.length > 0 && (
                                  <div className="flex gap-1 mt-1">
                                     {(log.photo_urls as string[]).map((url, i) => (
                                       <a key={i} href={url} target="_blank" rel="noreferrer" className="block w-6 h-6 rounded overflow-hidden border border-gray-200 hover:scale-110 transition-transform">
                                         <img src={url} alt="Proof" className="w-full h-full object-cover" />
                                       </a>
                                     ))}
                                  </div>
                                )}
                                {!log.process_type && !log.note && (!log.photo_urls || log.photo_urls.length === 0) && (
                                  <span className="text-gray-300 text-xs italic">-</span>
                                )}
                             </td>
                             <td className="px-6 py-4 text-right">
                                <span className={`inline-flex items-center gap-1 font-extrabold text-sm px-3 py-1.5 rounded-lg border ${activeTab === 'issued' ? 'bg-orange-50 text-orange-700 border-orange-100' : 'bg-green-50 text-green-700 border-green-100'}`}>
                                   {activeTab === 'issued' ? '-' : '+'}{log.quantity} <span className="text-xs font-medium opacity-80 uppercase ml-0.5">{log.products?.unit || 'UNIT'}</span>
                                </span>
                             </td>
                          </tr>
                       ))}
                       {logs.length === 0 && (
                          <tr>
                             <td colSpan={5} className="px-6 py-16 text-center text-gray-400">
                                <Truck className="w-12 h-12 mx-auto text-gray-200 mb-3" />
                                <span className="block font-medium text-gray-500">No {activeTab} material logs found.</span>
                                <span className="block text-sm mt-1">Submit the form on the left to record your first transaction.</span>
                             </td>
                          </tr>
                       )}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
