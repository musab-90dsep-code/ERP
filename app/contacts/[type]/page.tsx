'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-utils';
import { Plus, Trash2, Pencil, Image as ImageIcon, MapPin, Mail, Building2, UserCircle2, X, Phone, MessageSquare, CreditCard } from 'lucide-react';

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
  
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);

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
        bank_details: showBankSection ? formData.bank_details : {}
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
    
    if ((Array.isArray(contact.bank_details) && contact.bank_details.length > 0) || (contact.bank_details && Object.keys(contact.bank_details).length > 0)) {
      setShowBankSection(true);
    } else {
      setShowBankSection(false);
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
        <button onClick={() => { if (showForm) resetForm(); else setShowForm(true); }} className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 hover:bg-indigo-700 font-semibold shadow-sm transition">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : `Add ${singularType}`}
        </button>
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
                             <input type="text" value={p.position} onChange={e => updatePersonnel(pIdx, 'position', e.target.value)} placeholder="Position (e.g. Manager)" className="border border-gray-200 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
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

      {/* Main Data Table */}
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
                        <span className="inline-flex items-center gap-1.5 mt-1 text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
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
                      <>
                        {contact.phone && <span className="flex items-center gap-2 text-gray-800 font-semibold"><Phone className="w-3.5 h-3.5 text-gray-400" /> {contact.phone}</span>}
                        {contact.whatsapp && <span className="flex items-center gap-2 text-gray-800 font-semibold"><MessageSquare className="w-3.5 h-3.5 text-green-500" /> {contact.whatsapp}</span>}
                      </>
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
    </div>
  );
}
