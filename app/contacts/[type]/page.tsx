'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-utils';
import { Plus, Trash2, Pencil, Image as ImageIcon, MapPin, Mail, Building2, UserCircle2, X, Phone, MessageSquare, CreditCard, Eye, Users, LayoutGrid, List, Activity, Receipt, Banknote } from 'lucide-react';

interface Personnel {
  id?: string;
  name: string;
  position: string;
  phone_numbers: any[];
  photo_url?: string;
  _file?: File;
  _preview?: string;
}

export default function ContactsTypePage() {
  const params = useParams();
  const router = useRouter();
  const rawType = params.type as string; // customers, suppliers, processors
  
  const typeMap: Record<string, string> = {
    customers: 'customer',
    suppliers: 'supplier',
    processors: 'processor'
  };
  const dbType = typeMap[rawType];

  const [contacts, setContacts] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingContact, setViewingContact] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    customer_code: '',
    name: '',
    shop_name: '',
    email: '',
    address: '',
    phone_numbers: [{ number: '', is_whatsapp: false, is_imo: false, is_telegram: false }],
    profile_image_url: '',
    bank_details: [{ bank_name: '', account_name: '', account_number: '', branch: '' }]
  });
  
  const [showEmployeeSection, setShowEmployeeSection] = useState(false);
  const [showBankSection, setShowBankSection] = useState(false);
  const [mfsData, setMfsData] = useState({ bikash: '', nagad: '', rocket: '', upay: '' });
  const [showMfsSection, setShowMfsSection] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('card');
  
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);

  const [modalTab, setModalTab] = useState<'profile' | 'ledger'>('profile');
  const [transactions, setTransactions] = useState({ invoices: [] as any[], payments: [] as any[], loading: false });

  useEffect(() => {
    if (viewingContact) {
      setModalTab('profile');
      fetchTransactions(viewingContact.id);
    } else {
      setTransactions({ invoices: [], payments: [], loading: false });
    }
  }, [viewingContact]);

  const fetchTransactions = async (contactId: string) => {
    setTransactions(prev => ({ ...prev, loading: true }));
    try {
      const { data: invs } = await supabase.from('invoices').select('*').eq('contact_id', contactId).order('date', { ascending: false });
      const { data: pays } = await supabase.from('payments').select('*').eq('contact_id', contactId).order('date', { ascending: false });
      setTransactions({ invoices: invs || [], payments: pays || [], loading: false });
    } catch (e) {
      setTransactions({ invoices: [], payments: [], loading: false });
    }
  };

  useEffect(() => {
    if (!dbType) {
      router.replace('/contacts/customers');
      return;
    }
    fetchContacts();
    resetForm();
  }, [rawType]);

  const fetchContacts = async () => {
    // We use the new relational table created in Phase 1 SQL
    const { data, error } = await supabase
      .from('contacts')
      .select('*, contact_employees(*)')
      .eq('type', dbType)
      .order('created_at', { ascending: false });
      
    if (error) {
      // Graceful fallback if the user hasn't run the Phase 1 SQL yet, but still allow UI to work if they migrate later.
      console.error(error);
    } else {
      setContacts(data ?? []);
    }
  };

  const uploadFile = async (file: File, folder: string): Promise<string> => {
    const path = `${folder}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
    const { error } = await supabase.storage.from('employee-files').upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('employee-files').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // 1. Upload Main Profile Image
      let finalImageUrl = formData.profile_image_url;
      if (profileImageFile) {
        finalImageUrl = await uploadFile(profileImageFile, 'contacts');
      }

      // 2. Prep Contact Payload
      const contactPayload = {
        type: dbType,
        customer_code: formData.customer_code,
        name: formData.name,
        shop_name: formData.shop_name,
        phone_numbers: formData.phone_numbers,
        email: formData.email,
        address: formData.address,
        photo_url: finalImageUrl,
        bank_details: (() => {
          let banks = showBankSection ? formData.bank_details.filter(b => b.bank_name) : [];
          if (showMfsSection) {
             Object.entries(mfsData).forEach(([provider, number]) => {
                if (number) {
                   banks.push({ bank_name: provider, account_name: formData.name, account_number: number, branch: '' });
                }
             });
          }
          return banks;
        })()
      };

      let currentContactId = editingId;

      if (editingId) {
        const { error } = await supabase.from('contacts').update(contactPayload).eq('id', editingId);
        if (error) throw error;
        
        // Wipe old personnel out (simple sync strategy)
        await supabase.from('contact_employees').delete().eq('contact_id', editingId);
      } else {
        const { data: newContact, error } = await supabase.from('contacts').insert([contactPayload]).select('id').single();
        if (error) throw error;
        currentContactId = newContact.id;
      }

      // 3. Handle Nested Personnel Insertions
      const cleanedPersonnel = personnel.filter(p => p.name.trim() !== '');
      if (cleanedPersonnel.length > 0 && currentContactId) {
        const employeePayloads = await Promise.all(cleanedPersonnel.map(async (p) => {
          let pPhotoUrl = p.photo_url || '';
          if (p._file) {
             pPhotoUrl = await uploadFile(p._file, 'contact_employees');
          }
          return {
            contact_id: currentContactId,
            name: p.name,
            position: p.position,
            phone: JSON.stringify(p.phone_numbers),
            photo_url: pPhotoUrl
          };
        }));

        const { error: empError } = await supabase.from('contact_employees').insert(employeePayloads);
        if (empError) throw empError;
      }

      resetForm();
      fetchContacts();
    } catch (error) {
      console.error(error);
      handleSupabaseError(error, editingId ? 'update' : 'create', 'contacts');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (contact: any) => {
    setFormData({
      customer_code: contact.customer_code || '',
      name: contact.name || '',
      shop_name: contact.shop_name || '',
      phone_numbers: contact.phone_numbers && contact.phone_numbers.length > 0 ? contact.phone_numbers : [{ number: contact.phone || '', is_whatsapp: !!contact.whatsapp, is_imo: false, is_telegram: false }],
      email: contact.email || '',
      address: contact.address || '',
      profile_image_url: contact.photo_url || '',
      bank_details: Array.isArray(contact.bank_details) && contact.bank_details.length > 0 ? contact.bank_details : (contact.bank_details && Object.keys(contact.bank_details).length > 0 ? [contact.bank_details] : [{ bank_name: '', account_name: '', account_number: '', branch: '' }])
    });
    
    
    let mfs = { bikash: '', nagad: '', rocket: '', upay: '' };
    let actualBanks: { bank_name: string; account_name: string; account_number: string; branch: string }[] = [];
    let hasMfs = false;
    let hasBanks = false;
    if (Array.isArray(contact.bank_details)) {
       contact.bank_details.forEach((b: any) => {
          if (b && typeof b.bank_name === 'string' && ['bikash', 'nagad', 'rocket', 'upay'].includes(b.bank_name.toLowerCase())) {
             mfs[b.bank_name.toLowerCase() as keyof typeof mfs] = b.account_number;
             hasMfs = true;
          } else if (b && b.bank_name !== '') {
             actualBanks.push(b);
             hasBanks = true;
          }
       });
    }
    setMfsData(mfs);
    
    // reset actual banks to form
    setFormData(prev => ({
       ...prev,
       bank_details: actualBanks.length > 0 ? actualBanks : [{ bank_name: '', account_name: '', account_number: '', branch: '' }]
    }));
    
    setShowMfsSection(hasMfs);

    if (hasBanks) {
      setShowBankSection(true);
    } else {
      setShowBankSection(false);
    setShowMfsSection(false);
    setMfsData({ bikash: '', nagad: '', rocket: '', upay: '' });
    }
    
    const emps = contact.contact_employees || [];
    setPersonnel(
      emps.map((p: any) => {
        let parsedPhone = [{ number: p.phone || '', is_whatsapp: false, is_imo: false, is_telegram: false }];
        if (p.phone && p.phone.startsWith('[')) {
          try { parsedPhone = JSON.parse(p.phone); } catch(e){}
        }
        return {
          id: p.id,
          name: p.name || '',
          position: p.position || 'Employee',
          phone_numbers: parsedPhone,
          photo_url: p.photo_url || '',
          _preview: p.photo_url || ''
        };
      })
    );
    setShowEmployeeSection(emps.length > 0);
    
    setProfilePreview(contact.photo_url || null);
    setProfileImageFile(null);
    setEditingId(contact.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if(!window.confirm('Are you sure you want to delete this contact?')) return;
    const { error } = await supabase.from('contacts').delete().eq('id', id);
    if (error) handleSupabaseError(error, 'delete', 'contacts');
    else fetchContacts();
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    const prefix = dbType === 'customer' ? 'CUST' : dbType === 'supplier' ? 'SUPP' : 'PROC';
    const initCode = `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
    setFormData({ customer_code: initCode, name: '', shop_name: '', phone_numbers: [{ number: '', is_whatsapp: false, is_imo: false, is_telegram: false }], email: '', address: '', profile_image_url: '', bank_details: [{ bank_name: '', account_name: '', account_number: '', branch: '' }] });
    setShowEmployeeSection(false);
    setShowBankSection(false);
    setPersonnel([]);
    setProfilePreview(null);
    setProfileImageFile(null);
  };

  // Dynamic Personnel Handlers
  const addPersonnel = () => setPersonnel([...personnel, { name: '', position: 'Employee', phone_numbers: [{ number: '', is_whatsapp: false, is_imo: false, is_telegram: false }] }]);
  const removePersonnel = (index: number) => {
    const newPers = [...personnel];
    newPers.splice(index, 1);
    setPersonnel(newPers);
  };
  const updatePersonnel = (index: number, key: keyof Personnel, val: any) => {
    const newPers = [...personnel];
    newPers[index] = { ...newPers[index], [key]: val };
    setPersonnel(newPers);
  };

  const handlePersonnelImage = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      const newPers = [...personnel];
      newPers[index]._file = file;
      newPers[index]._preview = URL.createObjectURL(file);
      setPersonnel(newPers);
    }
  };

  const displayTitle = rawType.replace(/^[a-z]/, char => char.toUpperCase());
  const singularType = displayTitle.slice(0, -1);

  return (
    <div className="pb-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{displayTitle} Management</h1>
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
          <button onClick={() => { if (showForm) resetForm(); else setShowForm(true); }} className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 hover:bg-indigo-700 font-semibold shadow-sm transition">
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cancel' : `Add ${singularType}`}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8 flex flex-col gap-6">
          <h2 className="text-lg font-bold text-gray-800 border-b border-gray-100 pb-3 flex justify-between items-center">
             <span>{editingId ? `Edit ${singularType}` : `New ${singularType}`}</span>
             {formData.customer_code && <span className="text-xs font-mono bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-100">{formData.customer_code}</span>}
          </h2>

          <div className="flex flex-col md:flex-row gap-8">
            {/* Main Profile Image Upload */}
            <div className="flex flex-col items-center justify-start w-full md:w-1/4">
              <div className="w-32 h-32 rounded-2xl bg-gray-50 flex items-center justify-center overflow-hidden border border-gray-200 mb-4 shadow-sm object-cover">
                {profilePreview ? (
                  <img src={profilePreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-12 h-12 text-gray-300" />
                )}
              </div>
              <label className="bg-white text-gray-700 px-4 py-2 rounded-lg text-sm font-bold cursor-pointer hover:bg-gray-50 transition-colors border border-gray-200 shadow-sm w-full text-center">
                Upload Photo
                <input type="file" className="hidden" accept="image/*" onChange={e => {
                  if (e.target.files?.[0]) {
                     setProfileImageFile(e.target.files[0]);
                     setProfilePreview(URL.createObjectURL(e.target.files[0]));
                  }
                }} />
              </label>
            </div>

            {/* Main Form Fields */}
            <div className="w-full md:w-3/4 flex flex-col gap-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-1.5"><UserCircle2 className="w-4 h-4 text-indigo-500" /> Contact Name</label>
                  <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder={`e.g. John Doe`} />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-1.5"><Building2 className="w-4 h-4 text-indigo-500" /> Shop / Business Name</label>
                  <input type="text" value={formData.shop_name} onChange={e => setFormData({ ...formData, shop_name: e.target.value })} className="w-full border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. Super Mart Ltd." />
                </div>
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-700"><Phone className="w-4 h-4 text-indigo-500" /> Phone Numbers</label>
                    <button type="button" onClick={() => setFormData({...formData, phone_numbers: [...formData.phone_numbers, { number: '', is_whatsapp: false, is_imo: false, is_telegram: false }]})} className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded">
                      + Add Number
                    </button>
                  </div>
                  <div className="space-y-3">
                    {formData.phone_numbers.map((pn, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-gray-50 border border-gray-200 p-3 rounded-lg">
                        <input required type="text" value={pn.number} onChange={e => {
                          const newPn = [...formData.phone_numbers];
                          newPn[idx].number = e.target.value;
                          setFormData({...formData, phone_numbers: newPn});
                        }} className="flex-1 w-full border border-gray-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" placeholder="e.g. +8801..." />
                        
                        <div className="flex items-center gap-4 shrink-0">
                          <label className="flex items-center gap-1.5 cursor-pointer hover:bg-white px-2 py-1 rounded transition">
                            <input type="checkbox" checked={pn.is_whatsapp} onChange={e => {
                              const newPn = [...formData.phone_numbers];
                              newPn[idx].is_whatsapp = e.target.checked;
                              setFormData({...formData, phone_numbers: newPn});
                            }} className="w-4 h-4 text-green-500 rounded border-gray-300 focus:ring-green-500" />
                            <span className="text-xs font-bold text-gray-600">WhatsApp</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer hover:bg-white px-2 py-1 rounded transition">
                            <input type="checkbox" checked={pn.is_imo} onChange={e => {
                              const newPn = [...formData.phone_numbers];
                              newPn[idx].is_imo = e.target.checked;
                              setFormData({...formData, phone_numbers: newPn});
                            }} className="w-4 h-4 text-indigo-500 rounded border-gray-300 focus:ring-indigo-500" />
                            <span className="text-xs font-bold text-gray-600">imo</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer hover:bg-white px-2 py-1 rounded transition">
                            <input type="checkbox" checked={pn.is_telegram} onChange={e => {
                              const newPn = [...formData.phone_numbers];
                              newPn[idx].is_telegram = e.target.checked;
                              setFormData({...formData, phone_numbers: newPn});
                            }} className="w-4 h-4 text-blue-500 rounded border-gray-300 focus:ring-blue-500" />
                            <span className="text-xs font-bold text-gray-600">Telegram</span>
                          </label>
                        </div>
                        {formData.phone_numbers.length > 1 && (
                          <button type="button" onClick={() => {
                            const newPn = formData.phone_numbers.filter((_, i) => i !== idx);
                            setFormData({...formData, phone_numbers: newPn});
                          }} className="text-red-400 hover:text-red-600 p-1 shrink-0">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-5">
                   <div>
                     <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-1.5"><Mail className="w-4 h-4 text-indigo-500" /> Email</label>
                     <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="contact@example.com" />
                   </div>
                   <div>
                     <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-1.5"><MapPin className="w-4 h-4 text-indigo-500" /> Address</label>
                     <input type="text" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="w-full border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Physical Address" />
                   </div>
                </div>
              </div>

              {/* Dynamic Sub-Employees */}
              <div className="mt-4 border-t border-gray-100 pt-6">
                <label className="flex items-center gap-3 cursor-pointer mb-3 p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition w-full md:w-max">
                   <input type="checkbox" checked={showEmployeeSection} onChange={e => setShowEmployeeSection(e.target.checked)} className="w-5 h-5 text-indigo-600 rounded accent-indigo-600" />
                   <span className="font-bold text-gray-800">Add Employee / Personnel Details</span>
                </label>

                {showEmployeeSection && (
                  <div className="animate-in fade-in slide-in-from-top-2 mt-4 space-y-4">
                    <div className="flex justify-between items-center bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                      <label className="text-sm font-bold text-gray-800">Linked Employees</label>
                      <button type="button" onClick={addPersonnel} className="text-sm text-indigo-600 font-bold hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition">+ Add Member</button>
                    </div>
                {personnel.length > 0 && (
                  <div className="flex flex-col gap-4">
                    {personnel.map((p, pIdx) => (
                      <div key={pIdx} className="flex flex-col sm:flex-row items-center gap-4 p-4 border border-gray-200 rounded-xl bg-gray-50/50">
                        {/* Sub-Employee Image */}
                        <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center overflow-hidden border border-gray-200 shadow-sm shrink-0 relative group">
                          {p._preview || p.photo_url ? (
                            <img src={p._preview || p.photo_url} alt="sub" className="w-full h-full object-cover" />
                          ) : (
                            <UserCircle2 className="w-8 h-8 text-gray-300" />
                          )}
                          <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                            <ImageIcon className="w-5 h-5 text-white" />
                            <input type="file" className="hidden" accept="image/*" onChange={e => handlePersonnelImage(pIdx, e)} />
                          </label>
                        </div>
                        
                        
                        <div className="flex-1 w-full flex flex-col gap-3">
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                             <input type="text" value={p.name} onChange={e => updatePersonnel(pIdx, 'name', e.target.value)} placeholder="Employee Name" className="border border-gray-200 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                             <select value={p.position} onChange={e => updatePersonnel(pIdx, 'position', e.target.value)} className="border border-gray-200 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white appearance-none">
                                <option value="" disabled>Select Position</option>
                                <option value="Owner">Owner</option>
                                <option value="Manager">Manager</option>
                                <option value="Procurement">Procurement</option>
                                <option value="Finance/Accounting">Finance/Accounting</option>
                                <option value="Sales Representative">Sales Representative</option>
                                <option value="Technical Support">Technical Support</option>
                                <option value="Employee">Employee</option>
                                <option value="General Staff">General Staff</option>
                                <option value="Other">Other</option>
                                {p.position && !['Owner', 'Manager', 'Procurement', 'Finance/Accounting', 'Sales Representative', 'Technical Support', 'Employee', 'General Staff', 'Other'].includes(p.position) && (
                                  <option value={p.position}>{p.position} (Legacy)</option>
                                )}
                             </select>
                           </div>
                           
                           <div className="flex flex-col gap-2 border-l-2 border-indigo-100 pl-3">
                             <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-gray-500">Employee Phone Numbers</label>
                                <button type="button" onClick={() => {
                                   const currentPn = [...(p.phone_numbers || [])];
                                   currentPn.push({ number: '', is_whatsapp: false, is_imo: false, is_telegram: false });
                                   updatePersonnel(pIdx, 'phone_numbers', currentPn);
                                }} className="text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded">
                                  + Add Phone
                                </button>
                             </div>
                             
                             {p.phone_numbers && p.phone_numbers.map((pn: any, pnIdx: number) => (
                               <div key={pnIdx} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-white border border-gray-200 p-2 rounded-lg">
                                  <input type="text" value={pn.number} onChange={e => {
                                    const currentPn = [...p.phone_numbers];
                                    currentPn[pnIdx].number = e.target.value;
                                    updatePersonnel(pIdx, 'phone_numbers', currentPn);
                                  }} placeholder="Phone Number" className="flex-1 w-full border border-gray-200 rounded-md p-1.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none" />
                                  <div className="flex items-center gap-2 shrink-0">
                                    <label className="flex items-center gap-1 cursor-pointer">
                                      <input type="checkbox" checked={pn.is_whatsapp} onChange={e => {
                                        const currentPn = [...p.phone_numbers];
                                        currentPn[pnIdx].is_whatsapp = e.target.checked;
                                        updatePersonnel(pIdx, 'phone_numbers', currentPn);
                                      }} className="w-3.5 h-3.5 text-green-500 rounded border-gray-300" />
                                      <span className="text-[10px] font-bold text-gray-600">WA</span>
                                    </label>
                                    <label className="flex items-center gap-1 cursor-pointer">
                                      <input type="checkbox" checked={pn.is_imo} onChange={e => {
                                        const currentPn = [...p.phone_numbers];
                                        currentPn[pnIdx].is_imo = e.target.checked;
                                        updatePersonnel(pIdx, 'phone_numbers', currentPn);
                                      }} className="w-3.5 h-3.5 text-indigo-500 rounded border-gray-300" />
                                      <span className="text-[10px] font-bold text-gray-600">imo</span>
                                    </label>
                                    <label className="flex items-center gap-1 cursor-pointer">
                                      <input type="checkbox" checked={pn.is_telegram} onChange={e => {
                                        const currentPn = [...p.phone_numbers];
                                        currentPn[pnIdx].is_telegram = e.target.checked;
                                        updatePersonnel(pIdx, 'phone_numbers', currentPn);
                                      }} className="w-3.5 h-3.5 text-blue-500 rounded border-gray-300" />
                                      <span className="text-[10px] font-bold text-gray-600">TG</span>
                                    </label>
                                  </div>
                                  {p.phone_numbers.length > 1 && (
                                     <button type="button" onClick={() => {
                                       const currentPn = p.phone_numbers.filter((_: any, i: number) => i !== pnIdx);
                                       updatePersonnel(pIdx, 'phone_numbers', currentPn);
                                     }} className="text-red-400 hover:text-red-600 p-1">
                                       <X className="w-3 h-3" />
                                     </button>
                                  )}
                               </div>
                             ))}
                           </div>
                        </div>
                        <button type="button" onClick={() => removePersonnel(pIdx)} className="text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-5 h-5" /></button>
                      </div>
                    ))}
                  </div>
                )}
                    {personnel.length === 0 && <p className="text-xs text-gray-400 italic">No employees added. You can add the shop owner or managers here.</p>}
                  </div>
                )}
              </div>

              {/* Bank Details Section */}
              <div className="border-t border-gray-100 pt-6">
                 <label className="flex items-center gap-3 cursor-pointer mb-3 p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition w-full md:w-max">
                   <input type="checkbox" checked={showBankSection} onChange={e => setShowBankSection(e.target.checked)} className="w-5 h-5 text-indigo-600 rounded accent-indigo-600" />
                   <span className="font-bold text-gray-800 flex items-center gap-2"><CreditCard className="w-4 h-4"/> Add Bank Account</span>
                 </label>
                 
                 {showBankSection && (
                    <div className="animate-in fade-in slide-in-from-top-2 mt-4 space-y-4">
                       <div className="flex justify-end mb-2">
                          <button type="button" onClick={() => setFormData({...formData, bank_details: [...formData.bank_details, { bank_name: '', account_name: '', account_number: '', branch: '' }]})} className="text-sm font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 transition-colors">
                             + Add Another Bank Account
                          </button>
                       </div>
                       
                       {formData.bank_details.map((bank, bankIdx) => (
                          <div key={bankIdx} className="relative grid grid-cols-1 sm:grid-cols-2 gap-5 bg-gray-50/50 p-6 rounded-2xl border border-gray-200 mt-2">
                             {formData.bank_details.length > 1 && (
                                <button type="button" onClick={() => {
                                   const newBanks = formData.bank_details.filter((_, i) => i !== bankIdx);
                                   setFormData({...formData, bank_details: newBanks});
                                }} className="absolute top-3 right-3 text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors">
                                   <X className="w-4 h-4"/>
                                </button>
                             )}
                             <div>
                               <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase">Bank Name</label>
                               <input type="text" value={bank.bank_name} onChange={e => {
                                  const newBanks = [...formData.bank_details];
                                  newBanks[bankIdx].bank_name = e.target.value;
                                  setFormData({...formData, bank_details: newBanks});
                               }} className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:border-indigo-500 bg-white" placeholder="e.g. City Bank" />
                             </div>
                             <div>
                               <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase">Account Name</label>
                               <input type="text" value={bank.account_name} onChange={e => {
                                  const newBanks = [...formData.bank_details];
                                  newBanks[bankIdx].account_name = e.target.value;
                                  setFormData({...formData, bank_details: newBanks});
                               }} className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:border-indigo-500 bg-white" placeholder="e.g. John Doe" />
                             </div>
                             <div>
                               <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase">Account Number</label>
                               <input type="text" value={bank.account_number} onChange={e => {
                                  const newBanks = [...formData.bank_details];
                                  newBanks[bankIdx].account_number = e.target.value;
                                  setFormData({...formData, bank_details: newBanks});
                               }} className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:border-indigo-500 font-mono bg-white" placeholder="1234567890" />
                             </div>
                             <div>
                               <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase">Account Branch</label>
                               <input type="text" value={bank.branch} onChange={e => {
                                  const newBanks = [...formData.bank_details];
                                  newBanks[bankIdx].branch = e.target.value;
                                  setFormData({...formData, bank_details: newBanks});
                               }} className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:border-indigo-500 bg-white" placeholder="e.g. Gulshan Branch" />
                             </div>
                          </div>
                       ))}
                    </div>
                 )}
              </div>
               {/* MFS Section */}
               <div className="border-t border-gray-100 pt-6">
                  <label className="flex items-center gap-3 cursor-pointer mb-3 p-3 border border-gray-200 rounded-xl hover:bg-emerald-50 transition w-full md:w-max">
                    <input type="checkbox" checked={showMfsSection} onChange={e => setShowMfsSection(e.target.checked)} className="w-5 h-5 text-emerald-600 rounded accent-emerald-600" />
                    <span className="font-bold text-gray-800 flex items-center gap-2"><CreditCard className="w-4 h-4 text-emerald-600"/> Add Mobile Financial Accounts (MFS)</span>
                  </label>
                  {showMfsSection && (
                     <div className="animate-in fade-in slide-in-from-top-2 mt-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-2xl border border-emerald-100">
                           <div>
                             <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{color:'#e91e8c'}}>Bikash Number</label>
                             <input type="text" value={mfsData.bikash} onChange={e => setMfsData({...mfsData, bikash: e.target.value})} className="w-full border border-pink-200 rounded-lg p-3 outline-none focus:border-pink-500 bg-white font-mono text-sm placeholder:text-gray-300" placeholder="+8801..." />
                           </div>
                           <div>
                             <label className="block text-xs font-bold text-orange-600 mb-1.5 uppercase tracking-wider">Nagad Number</label>
                             <input type="text" value={mfsData.nagad} onChange={e => setMfsData({...mfsData, nagad: e.target.value})} className="w-full border border-orange-200 rounded-lg p-3 outline-none focus:border-orange-500 bg-white font-mono text-sm placeholder:text-gray-300" placeholder="+8801..." />
                           </div>
                           <div>
                             <label className="block text-xs font-bold text-purple-600 mb-1.5 uppercase tracking-wider">Rocket Number</label>
                             <input type="text" value={mfsData.rocket} onChange={e => setMfsData({...mfsData, rocket: e.target.value})} className="w-full border border-purple-200 rounded-lg p-3 outline-none focus:border-purple-500 bg-white font-mono text-sm placeholder:text-gray-300" placeholder="+8801..." />
                           </div>
                           <div>
                             <label className="block text-xs font-bold text-blue-600 mb-1.5 uppercase tracking-wider">Upay Number</label>
                             <input type="text" value={mfsData.upay} onChange={e => setMfsData({...mfsData, upay: e.target.value})} className="w-full border border-blue-200 rounded-lg p-3 outline-none focus:border-blue-500 bg-white font-mono text-sm placeholder:text-gray-300" placeholder="+8801..." />
                           </div>
                        </div>
                     </div>
                  )}
               </div>
            </div>
          </div>


          <div className="flex gap-4 items-center justify-end border-t border-gray-100 pt-5 mt-2">
            <button type="button" onClick={resetForm} className="px-6 py-2.5 font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
            <button type="submit" disabled={submitting} className="bg-indigo-600 text-white px-8 py-2.5 font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-md disabled:opacity-60">
              {submitting ? 'Saving...' : editingId ? `Update ${singularType}` : `Save ${singularType}`}
            </button>
          </div>
        </form>
      )}

      {/* Main Data Display */}
      {viewMode === 'table' ? (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Contact Profile</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Contact Info</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Address details</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {contacts.map(contact => (
              <tr key={contact.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center overflow-hidden border border-indigo-100 shadow-sm shrink-0">
                      {contact.photo_url ? (
                        <img src={contact.photo_url} alt={contact.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-indigo-600 font-bold text-lg">{contact.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div>
                      <span className="font-bold text-gray-900 block text-base">{contact.name}</span>
                      {contact.shop_name && (
                        <span className="inline-flex items-center gap-1.5 mt-1 text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100">
                          <Building2 className="w-3 h-3" /> {contact.shop_name}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-2 text-sm">
                    {contact.phone_numbers && contact.phone_numbers.length > 0 ? (
                      contact.phone_numbers.map((pn: any, i: number) => (
                        <div key={i} className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-2 text-gray-800 font-semibold"><Phone className="w-3.5 h-3.5 text-gray-400" /> {pn.number}</span>
                          <div className="flex gap-2 ml-5">
                            {pn.is_whatsapp && <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">WhatsApp</span>}
                            {pn.is_imo && <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">imo</span>}
                            {pn.is_telegram && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Telegram</span>}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {contact.phone && <span className="flex items-center gap-2 text-gray-800 font-semibold"><Phone className="w-3.5 h-3.5 text-gray-400" /> {contact.phone}</span>}
                        {contact.whatsapp && <span className="flex items-center gap-2 text-gray-800 font-semibold"><MessageSquare className="w-3.5 h-3.5 text-green-500" /> {contact.whatsapp}</span>}
                      </div>
                    )}
                    {contact.email && <span className="flex items-center gap-2 text-gray-500 mt-1"><Mail className="w-3.5 h-3.5 text-gray-400" /> {contact.email}</span>}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col items-start gap-1">
                    {contact.address ? (
                      <span className="text-sm text-gray-600 flex gap-2 w-48 truncate" title={contact.address}><MapPin className="w-4 h-4 text-gray-400 shrink-0" /> {contact.address}</span>
                    ) : <span className="text-gray-400 text-sm italic">No address</span>}
                    
                    {contact.contact_employees?.length > 0 && (
                      <span className="text-xs bg-gray-100 text-gray-600 border border-gray-200 px-2 py-1 rounded-md font-bold mt-1">
                        + {contact.contact_employees.length} Employee(s)
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => setViewingContact(contact)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View Profile">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleEdit(contact)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(contact.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {contacts.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                  No {displayTitle} found. Click "Add {singularType}" to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {contacts.map(contact => (
            <div key={contact.id} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col hover:shadow-xl hover:shadow-indigo-500/5 transition-all hover:-translate-y-1">
               <div className="flex justify-between items-start mb-5">
                  <div className="flex items-center gap-4">
                     <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center overflow-hidden border border-indigo-100/50 shadow-inner shrink-0">
                       {contact.photo_url ? (
                         <img src={contact.photo_url} alt={contact.name} className="w-full h-full object-cover" />
                       ) : (
                         <span className="text-indigo-600 font-extrabold text-xl">{contact.name.charAt(0).toUpperCase()}</span>
                       )}
                     </div>
                     <div>
                       <h3 className="font-extrabold text-gray-900 text-lg leading-tight line-clamp-1" title={contact.name}>{contact.name}</h3>
                       {contact.shop_name && (
                         <span className="inline-flex items-center gap-1.5 mt-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 uppercase tracking-wide line-clamp-1" title={contact.shop_name}>
                           <Building2 className="w-3 h-3" /> {contact.shop_name}
                         </span>
                       )}
                     </div>
                  </div>
                  <div className="flex flex-col gap-1">
                     <button onClick={() => setViewingContact(contact)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors" title="View Profile">
                       <Eye className="w-5 h-5" />
                     </button>
                  </div>
               </div>
               
               <div className="flex-1 space-y-4 mb-5">
                  <div className="flex flex-col gap-2.5 text-sm bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                    {contact.phone_numbers && contact.phone_numbers.length > 0 ? (
                      contact.phone_numbers.map((pn: any, i: number) => (
                        <div key={i} className="flex flex-wrap items-center justify-between gap-2">
                          <span className="flex items-center gap-2.5 text-gray-800 font-bold"><Phone className="w-4 h-4 text-indigo-400" /> {pn.number}</span>
                          <div className="flex gap-1.5">
                            {pn.is_whatsapp && <span className="text-[10px] font-extrabold text-green-600 bg-green-100 px-1.5 py-0.5 rounded uppercase">WA</span>}
                            {pn.is_imo && <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded uppercase">imo</span>}
                            {pn.is_telegram && <span className="text-[10px] font-extrabold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded uppercase">TG</span>}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col gap-2.5">
                        {contact.phone && <span className="flex items-center gap-2.5 text-gray-800 font-bold"><Phone className="w-4 h-4 text-indigo-400" /> {contact.phone}</span>}
                        {contact.whatsapp && <span className="flex items-center gap-2.5 text-gray-800 font-bold"><MessageSquare className="w-4 h-4 text-green-500" /> {contact.whatsapp}</span>}
                      </div>
                    )}
                    {contact.email && <span className="flex items-center gap-2.5 text-gray-600 pt-2.5 border-t border-gray-200/60 font-semibold break-all"><Mail className="w-4 h-4 text-orange-400 shrink-0" /> {contact.email}</span>}
                  </div>

                  <div className="flex items-start gap-2.5 text-sm text-gray-600 px-2">
                    <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span className={contact.address ? "line-clamp-2 leading-relaxed font-medium" : "italic text-gray-400 font-medium"} title={contact.address}>
                       {contact.address || 'No address provided'}
                    </span>
                  </div>
               </div>

               <div className="pt-5 border-t border-gray-100 flex items-center justify-between">
                  {contact.contact_employees?.length > 0 ? (
                     <span className="text-xs font-bold text-gray-700 bg-gray-100 px-3 py-1 rounded-lg flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-gray-500"/> {contact.contact_employees.length} Employee{contact.contact_employees.length !== 1 && 's'}
                     </span>
                  ) : (
                     <span className="text-xs text-gray-400 italic font-medium">No employees</span>
                  )}
                  
                  <div className="flex gap-1.5">
                     <button onClick={() => handleEdit(contact)} className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100" title="Edit">
                       <Pencil className="w-4 h-4" />
                     </button>
                     <button onClick={() => handleDelete(contact.id)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100" title="Delete">
                       <Trash2 className="w-4 h-4" />
                     </button>
                  </div>
               </div>
            </div>
         ))}
         
         {contacts.length === 0 && (
            <div className="col-span-full py-20 text-center bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-200">
               <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-100">
                  <UserCircle2 className="w-10 h-10 text-gray-300" />
               </div>
               <h3 className="text-xl font-extrabold text-gray-900 mb-2">No {displayTitle} Found</h3>
               <p className="text-gray-500 font-medium">Click "Add {singularType}" to start creating your contact directory.</p>
            </div>
         )}
      </div>
      )}

      {/* View Profile Modal */}
      {viewingContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 w-full">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col">
            <div className={`h-32 bg-gradient-to-r ${viewingContact.type === 'customer' ? 'from-emerald-500 to-teal-600' : viewingContact.type === 'supplier' ? 'from-blue-600 to-indigo-600' : 'from-purple-500 to-pink-600'} relative shrink-0`}>
               <button onClick={() => setViewingContact(null)} className="absolute top-4 right-4 text-white hover:text-red-300 bg-black/20 hover:bg-black/30 p-1.5 rounded-full transition-colors backdrop-blur-sm z-10"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-8 pb-8 pt-0 relative flex-1">
               <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-end -mt-16 mb-6">
                 <div className="w-32 h-32 rounded-3xl bg-white p-1.5 shadow-xl shrink-0">
                    <div className="w-full h-full rounded-2xl bg-gray-50 flex items-center justify-center overflow-hidden border border-gray-100">
                       {viewingContact.photo_url ? (
                         <img src={viewingContact.photo_url} alt="Profile" className="w-full h-full object-cover" />
                       ) : (
                         <UserCircle2 className="w-16 h-16 text-gray-300" />
                       )}
                    </div>
                 </div>
                 <div className="flex-1 pb-2">
                    <h3 className="text-3xl font-extrabold text-gray-900">{viewingContact.name}</h3>
                    <div className="flex flex-wrap items-center gap-3 mt-3">
                       {viewingContact.customer_code && <span className="text-sm font-mono font-bold text-gray-700 bg-gray-100 px-4 py-1.5 rounded-full border border-gray-200">{viewingContact.customer_code}</span>}
                       {viewingContact.shop_name && <span className="text-sm font-bold text-indigo-700 bg-indigo-50 px-4 py-1.5 rounded-full border border-indigo-100 flex items-center gap-1.5"><Building2 className="w-4 h-4" /> {viewingContact.shop_name}</span>}
                       <span className="text-sm font-bold text-gray-600 bg-white px-4 py-1.5 rounded-full border border-gray-200 shadow-sm capitalize">{viewingContact.type}</span>
                    </div>
                 </div>
               </div>
               
               <div className="flex gap-4 border-b border-gray-200 mb-8">
                  <button onClick={() => setModalTab('profile')} className={`px-6 py-3 font-extrabold text-sm border-b-2 transition-colors ${modalTab === 'profile' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>Profile Information</button>
                  <button onClick={() => setModalTab('ledger')} className={`px-6 py-3 font-extrabold text-sm border-b-2 transition-colors flex items-center gap-2 ${modalTab === 'ledger' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                     <Activity className="w-4 h-4"/> Len Den (Ledger)
                  </button>
               </div>
               
               {modalTab === 'profile' ? (
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  {/* Left Column (Details & Bank) */}
                  <div className="space-y-6">
                     <div className="bg-white border border-gray-200 p-6 rounded-3xl shadow-sm">
                        <h4 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider mb-5 flex items-center gap-2"><MapPin className="w-4 h-4 text-indigo-500" /> Contact Info</h4>
                        <div className="space-y-4">
                           {viewingContact.phone_numbers?.length > 0 ? viewingContact.phone_numbers.map((pn: any, i: number) => (
                              <div key={i} className="flex items-center gap-4 bg-gray-50/80 p-3.5 rounded-2xl border border-gray-100">
                                <div className="w-10 h-10 rounded-full bg-white text-indigo-500 flex items-center justify-center shrink-0 shadow-sm border border-gray-100"><Phone className="w-4 h-4"/></div>
                                <div className="flex-1">
                                   <p className="font-extrabold text-gray-900">{pn.number}</p>
                                   <div className="flex gap-2 mt-1">
                                     {pn.is_whatsapp && <span className="text-[10px] uppercase font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-md">WhatsApp</span>}
                                     {pn.is_imo && <span className="text-[10px] uppercase font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-md">imo</span>}
                                     {pn.is_telegram && <span className="text-[10px] uppercase font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-md">Telegram</span>}
                                   </div>
                                </div>
                              </div>
                           )) : (
                              <>
                                 {viewingContact.phone && <div className="flex items-center gap-4 bg-gray-50/80 p-3.5 rounded-2xl border border-gray-100"><div className="w-10 h-10 rounded-full bg-white text-indigo-500 flex items-center justify-center shrink-0 shadow-sm border border-gray-100"><Phone className="w-4 h-4"/></div><p className="font-extrabold text-gray-900">{viewingContact.phone}</p></div>}
                                 {viewingContact.whatsapp && <div className="flex items-center gap-4 bg-gray-50/80 p-3.5 rounded-2xl border border-gray-100"><div className="w-10 h-10 rounded-full bg-white text-green-500 flex items-center justify-center shrink-0 shadow-sm border border-gray-100"><MessageSquare className="w-4 h-4"/></div><p className="font-extrabold text-gray-900">{viewingContact.whatsapp}</p></div>}
                              </>
                           )}
                           
                           {viewingContact.email && (
                              <div className="flex items-center gap-4 bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm">
                                <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center shrink-0 border border-orange-100"><Mail className="w-4 h-4"/></div>
                                <div>
                                   <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5">Email Address</p>
                                   <p className="font-bold text-gray-900 break-all">{viewingContact.email}</p>
                                </div>
                              </div>
                           )}
                           {viewingContact.address && (
                              <div className="flex items-start gap-4 bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm">
                                <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center shrink-0 border border-rose-100"><MapPin className="w-4 h-4"/></div>
                                <div className="flex-1 pt-0.5">
                                   <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Physical Address</p>
                                   <p className="font-semibold text-gray-800 leading-relaxed">{viewingContact.address}</p>
                                </div>
                              </div>
                           )}
                        </div>
                     </div>

                     {viewingContact.bank_details && viewingContact.bank_details.length > 0 && viewingContact.bank_details[0].bank_name !== '' && (
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 p-6 rounded-3xl shadow-sm">
                           <h4 className="text-sm font-extrabold text-blue-900 uppercase tracking-wider mb-5 flex items-center gap-2"><CreditCard className="w-4 h-4" /> Bank Accounts</h4>
                           <div className="space-y-4">
                              {viewingContact.bank_details.map((b: any, i: number) => (
                                 <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-blue-100 relative overflow-hidden group hover:border-blue-300 transition-colors">
                                    <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 rounded-bl-full -mr-8 -mt-8 opacity-60 group-hover:scale-110 transition-transform"></div>
                                    <p className="font-extrabold text-blue-900 text-lg">{b.bank_name}</p>
                                    <p className="text-xs font-bold text-gray-500 mt-2 uppercase tracking-wide">A/C: <span className="text-gray-900 normal-case text-sm">{b.account_name}</span></p>
                                    <p className="text-base font-mono font-extrabold text-gray-800 mt-1">{b.account_number}</p>
                                    {b.branch && <p className="text-sm font-medium text-gray-500 mt-2 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {b.branch} Branch</p>}
                                 </div>
                              ))}
                           </div>
                        </div>
                     )}
                  </div>

                  {/* Right Column (Personnel) */}
                  <div className="space-y-6">
                     <div className="bg-white border border-gray-200 p-6 rounded-3xl shadow-sm h-full max-h-[800px] overflow-y-auto">
                        <h4 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider mb-5 flex items-center gap-2"><UserCircle2 className="w-5 h-5 text-indigo-500" /> Linked Personnel / Employees</h4>
                        {viewingContact.contact_employees?.length > 0 ? (
                           <div className="space-y-4">
                              {viewingContact.contact_employees.map((emp: any, idx: number) => (
                                 <div key={idx} className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-4">
                                    <div className="flex items-center gap-4">
                                       <div className="w-12 h-12 rounded-full bg-white border border-gray-200 overflow-hidden shrink-0 shadow-sm p-0.5">
                                          <div className="w-full h-full rounded-full overflow-hidden bg-gray-100">
                                             {emp.photo_url ? <img src={emp.photo_url} alt="Emp" className="w-full h-full object-cover" /> : <UserCircle2 className="w-full h-full text-gray-300" />}
                                          </div>
                                       </div>
                                       <div>
                                          <p className="font-extrabold text-gray-900 text-base">{emp.name}</p>
                                          <p className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md inline-block mt-1 border border-indigo-100 uppercase tracking-wide">{emp.position}</p>
                                       </div>
                                    </div>
                                    <div className="pt-2 border-t border-gray-200/60">
                                       {(() => {
                                          let parsedPhone = [{ number: emp.phone || '', is_whatsapp: false, is_imo: false, is_telegram: false }];
                                          if (emp.phone && emp.phone.startsWith('[')) {
                                            try { parsedPhone = JSON.parse(emp.phone); } catch(e){}
                                          }
                                          return parsedPhone.map((pn: any, i: number) => (
                                             <div key={i} className="flex justify-between items-center bg-white rounded-xl p-2.5 mb-2 border border-gray-200 shadow-sm">
                                                <span className="font-extrabold text-gray-800 text-sm flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-gray-400" /> {pn.number}</span>
                                                <div className="flex gap-1.5">
                                                  {pn.is_whatsapp && <span className="text-[10px] font-extrabold text-green-600 bg-green-50 px-1.5 py-0.5 rounded uppercase">WA</span>}
                                                  {pn.is_imo && <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded uppercase">imo</span>}
                                                  {pn.is_telegram && <span className="text-[10px] font-extrabold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase">TG</span>}
                                                </div>
                                             </div>
                                          ));
                                       })()}
                                    </div>
                                 </div>
                              ))}
                           </div>
                        ) : (
                           <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/50">
                              <UserCircle2 className="w-14 h-14 text-gray-300 mb-3" />
                              <p className="text-gray-600 font-extrabold text-sm">No linked personnel</p>
                              <p className="text-xs text-gray-400 mt-1 max-w-[200px]">This contact currently has no individual employees listed.</p>
                           </div>
                        )}
                     </div>
                  </div>
               </div>
               ) : (
               <div className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-8 shadow-sm min-h-[400px] animate-in fade-in slide-in-from-bottom-4 duration-300">
                  
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                     <h4 className="font-extrabold text-gray-900 text-xl flex items-center gap-3"><Activity className="w-6 h-6 text-indigo-500"/> Transaction History</h4>
                     {/* Summary Badges */}
                     <div className="flex gap-3">
                        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2 text-center shadow-sm">
                           <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-0.5">Total Invoiced</p>
                           <p className="font-extrabold text-blue-900">৳ {transactions.invoices.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0).toLocaleString()}</p>
                        </div>
                        <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-2 text-center shadow-sm">
                           <p className="text-[10px] font-bold text-green-500 uppercase tracking-wider mb-0.5">Total Paid</p>
                           <p className="font-extrabold text-green-900">৳ {transactions.payments.reduce((sum, pay) => sum + (Number(pay.amount) || 0), 0).toLocaleString()}</p>
                        </div>
                     </div>
                  </div>
                  
                  {transactions.loading ? (
                     <div className="text-center py-20 flex flex-col items-center justify-center bg-gray-50/50 rounded-2xl border border-gray-100">
                        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                        <p className="text-gray-500 font-bold">Loading transactions...</p>
                     </div>
                  ) : transactions.invoices.length > 0 || transactions.payments.length > 0 ? (
                     <div className="space-y-4">
                        {[
                          ...transactions.invoices.map(inv => ({ ...inv, _itemType: 'invoice', sortDate: new Date(inv.date).getTime() })),
                          ...transactions.payments.map(pay => ({ ...pay, _itemType: 'payment', sortDate: new Date(pay.date).getTime() }))
                        ].sort((a, b) => b.sortDate - a.sortDate).map((item, idx) => (
                           <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl border border-gray-100 bg-gray-50/50 hover:bg-white hover:shadow-md transition-all group gap-4">
                              <div className="flex items-center gap-4">
                                 <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border ${item._itemType === 'invoice' ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100 text-blue-600' : 'bg-gradient-to-br from-emerald-50 to-green-50 border-green-100 text-green-600'}`}>
                                    {item._itemType === 'invoice' ? <Receipt className="w-6 h-6"/> : <Banknote className="w-6 h-6"/>}
                                 </div>
                                 <div>
                                    <p className="font-extrabold text-gray-900 text-base md:text-lg flex items-center gap-2.5 flex-wrap">
                                       {item._itemType === 'invoice' ? `Invoice #${item.id.substring(0,8).toUpperCase()}` : `Payment ${item.method ? `(${item.method.replace('_', ' ')})` : ''}`}
                                       <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-md ${item.type === 'buy' ? 'bg-indigo-100 text-indigo-700' : item.type === 'sell' ? 'bg-emerald-100 text-emerald-700' : item.type === 'return' ? 'bg-orange-100 text-orange-700' : item.type === 'in' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                          {item.type}
                                       </span>
                                    </p>
                                    <p className="text-sm text-gray-500 font-bold mt-1">{new Date(item.date).toLocaleDateString()}</p>
                                 </div>
                              </div>
                              <div className="text-left sm:text-right">
                                 <p className={`font-extrabold text-xl md:text-2xl ${item._itemType === 'payment' ? 'text-green-600 group-hover:text-green-700' : 'text-slate-900 group-hover:text-blue-700'} transition-colors`}>
                                    {item._itemType === 'payment' ? '+' : ''}৳ {Number(item.total || item.amount).toLocaleString()}
                                 </p>
                                 {item._itemType === 'invoice' && item.payment_status && (
                                    <p className={`text-[10px] font-extrabold uppercase mt-1.5 ${item.payment_status === 'paid' ? 'text-green-600 bg-green-50 inline-block px-2 py-0.5 rounded' : item.payment_status === 'partial' ? 'text-orange-600 bg-orange-50 inline-block px-2 py-0.5 rounded' : 'text-red-600 bg-red-50 inline-block px-2 py-0.5 rounded'}`}>
                                       {item.payment_status}
                                    </p>
                                 )}
                              </div>
                           </div>
                        ))}
                     </div>
                  ) : (
                     <div className="text-center py-24 bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-200">
                        <Activity className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="font-extrabold text-gray-900 text-lg">No transactions yet</h3>
                        <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">This contact doesn't have any recorded invoices or payments in the system.</p>
                     </div>
                  )}
               </div>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
