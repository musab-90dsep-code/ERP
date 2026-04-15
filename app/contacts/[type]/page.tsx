'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

import { Plus, Trash2, Pencil, Image as ImageIcon, MapPin, Mail, Building2, UserCircle2, X, Phone, MessageSquare, CreditCard, Eye, Users, LayoutGrid, List, Activity, Receipt, Banknote, PhoneCall, Send, Video, Settings } from 'lucide-react';

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
  const [transactions, setTransactions] = useState({ invoices: [] as any[], payments: [] as any[], processingOrders: [] as any[], loading: false });

  useEffect(() => {
    if (viewingContact) {
      setModalTab('profile');
      fetchTransactions(viewingContact.id, viewingContact.type);
    } else {
      setTransactions({ invoices: [], payments: [], processingOrders: [], loading: false });
    }
  }, [viewingContact]);

  const fetchTransactions = async (contactId: string, contactType?: string) => {
    setTransactions(prev => ({ ...prev, loading: true }));
    try {
      const [invs, pays] = await Promise.all([
        api.getInvoices({ contact_id: contactId, ordering: '-date' }),
        api.getPayments({ contact_id: contactId, ordering: '-date' }),
      ]);
      let procOrders: any[] = [];
      if (contactType === 'processor') {
        const pOrders = await api.getProcessingOrders({ processor_id: contactId, ordering: '-date' });
        procOrders = Array.isArray(pOrders) ? pOrders : pOrders.results ?? [];
      }
      setTransactions({
        invoices: Array.isArray(invs) ? invs : invs.results ?? [],
        payments: Array.isArray(pays) ? pays : pays.results ?? [],
        processingOrders: procOrders,
        loading: false
      });
    } catch (e) {
      setTransactions({ invoices: [], payments: [], processingOrders: [], loading: false });
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
    try {
      const data = await api.getContacts({ type: dbType, ordering: '-created_at' });
      setContacts(Array.isArray(data) ? data : data.results ?? []);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const uploadFile = async (file: File): Promise<string> => {
    return api.uploadFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let finalImageUrl = formData.profile_image_url;
      if (profileImageFile) {
        finalImageUrl = await uploadFile(profileImageFile);
      }

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
        await api.updateContact(editingId, contactPayload);
        // Delete old employees, re-insert
        await api.deleteContactEmployeesBulk(editingId).catch(() => { });
      } else {
        const newContact = await api.createContact(contactPayload);
        currentContactId = newContact.id;
      }

      const cleanedPersonnel = personnel.filter(p => p.name.trim() !== '');
      if (cleanedPersonnel.length > 0 && currentContactId) {
        const employeePayloads = await Promise.all(cleanedPersonnel.map(async (p) => {
          let pPhotoUrl = p.photo_url || '';
          if (p._file) {
            pPhotoUrl = await uploadFile(p._file);
          }
          return {
            contact: currentContactId,
            name: p.name,
            position: p.position,
            phone: p.phone_numbers,
            photo_url: pPhotoUrl
          };
        }));

        await Promise.all(employeePayloads.map(ep => api.createContactEmployee(ep)));
      }

      resetForm();
      fetchContacts();
    } catch (error: any) {
      console.error(error);
      alert(error.message);
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
        return {
          id: p.id,
          name: p.name || '',
          position: p.position || 'Employee',
          phone_numbers: Array.isArray(p.phone) ? p.phone : [{ number: p.phone || '', is_whatsapp: false, is_imo: false, is_telegram: false }],
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
    if (!window.confirm('Are you sure you want to delete this contact?')) return;
    try {
      await api.deleteContact(id);
      fetchContacts();
    } catch (error: any) { alert(error.message); }
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

  // Quick Action Phone Number Component
  const InteractivePhone = ({ pn, legacyNum, legacyWa }: { pn?: any, legacyNum?: string, legacyWa?: string }) => {
    const number = pn ? pn.number : legacyNum;
    if (!number) return null;
    const cleanNum = number.replace(/[^0-9+]/g, '');
    const waNum = cleanNum.replace('+', '');
    const isWa = pn ? pn.is_whatsapp : !!legacyWa;
    const isImo = pn ? pn.is_imo : false;
    const isTg = pn ? pn.is_telegram : false;

    return (
      <div className="flex flex-wrap items-center gap-2 mb-1.5">
        <a href={`tel:${cleanNum}`} className="flex items-center gap-2 text-[#e8eaf0] hover:text-[#c9a84c] font-bold transition group">
          <div className="w-6 h-6 rounded-full bg-[#1a2235] border border-[rgba(201,168,76,0.18)] flex items-center justify-center group-hover:bg-[#c9a84c] group-hover:text-[#131929] transition-colors">
            <PhoneCall className="w-3 h-3" />
          </div>
          {number}
        </a>
        <div className="flex gap-1.5 ml-2">
          {isWa && (
            <a href={`https://wa.me/${waNum}`} target="_blank" rel="noreferrer" className="w-6 h-6 rounded-md bg-[rgba(52,211,153,0.1)] flex items-center justify-center text-green-500 hover:bg-green-500 hover:text-white transition-colors" title="WhatsApp">
              <MessageSquare className="w-3.5 h-3.5" />
            </a>
          )}
          {isTg && (
            <a href={`https://t.me/${waNum}`} target="_blank" rel="noreferrer" className="w-6 h-6 rounded-md bg-[rgba(96,165,250,0.1)] flex items-center justify-center text-blue-500 hover:bg-blue-500 hover:text-white transition-colors" title="Telegram">
              <Send className="w-3.5 h-3.5" />
            </a>
          )}
          {isImo && (
            <a href={`tel:${cleanNum}`} className="w-6 h-6 rounded-md bg-[rgba(201,168,76,0.1)] flex items-center justify-center text-[#c9a84c] hover:bg-[#c9a84c] hover:text-[#131929] transition-colors" title="IMO (Call)">
              <Video className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="pb-10">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-[#e8eaf0]">{displayTitle} Management</h1>
        <div className="flex items-center gap-3">
          <div className="bg-[#131929] border border-[rgba(201,168,76,0.18)] rounded-lg p-1 flex items-center shadow-[0_4px_24px_rgba(0,0,0,0.5)] hidden sm:flex">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-[rgba(201,168,76,0.1)] text-[#c9a84c]' : 'text-[#4a5568] hover:text-[#8a95a8]'}`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'card' ? 'bg-[rgba(201,168,76,0.1)] text-[#c9a84c]' : 'text-[#4a5568] hover:text-[#8a95a8]'}`}
              title="Card View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          <button onClick={() => { if (showForm) resetForm(); else setShowForm(true); }} className="w-full sm:w-auto bg-gradient-to-br from-[#c9a84c] to-[#f0c040] text-[#0a0900] shadow-[0_4px_14px_rgba(201,168,76,0.35)] px-5 py-2.5 rounded-lg flex justify-center items-center gap-2 hover:opacity-90 hover:scale-[1.02] transform transition-all font-bold">
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cancel' : `Add ${singularType}`}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-[#131929] p-4 sm:p-6 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.5)] border border-[rgba(255,255,255,0.06)] mb-8 flex flex-col gap-6 animate-in slide-in-from-top-4">
          <h2 className="text-lg font-bold text-[#e8eaf0] border-b border-[rgba(255,255,255,0.06)] pb-3 flex justify-between items-center">
            <span>{editingId ? `Edit ${singularType}` : `New ${singularType}`}</span>
            {formData.customer_code && <span className="text-xs font-mono bg-[rgba(201,168,76,0.1)] text-[#f0c040] px-3 py-1 rounded-full border border-[rgba(201,168,76,0.18)]">{formData.customer_code}</span>}
          </h2>

          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex flex-col items-center justify-start w-full md:w-1/4">
              <div className="w-32 h-32 rounded-2xl bg-[#1a2235] flex items-center justify-center overflow-hidden border border-[rgba(201,168,76,0.18)] mb-4 shadow-[0_4px_24px_rgba(0,0,0,0.5)] object-cover">
                {profilePreview ? (
                  <img src={profilePreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-12 h-12 text-[#4a5568]" />
                )}
              </div>
              <label className="bg-[#1a2235] text-[#8a95a8] px-4 py-2 rounded-lg text-sm font-bold cursor-pointer hover:bg-[rgba(201,168,76,0.1)] hover:text-[#c9a84c] transition-colors border border-[rgba(201,168,76,0.18)] shadow-[0_4px_24px_rgba(0,0,0,0.5)] w-full text-center">
                Upload Photo
                <input type="file" className="hidden" accept="image/*" onChange={e => {
                  if (e.target.files?.[0]) {
                    setProfileImageFile(e.target.files[0]);
                    setProfilePreview(URL.createObjectURL(e.target.files[0]));
                  }
                }} />
              </label>
            </div>

            <div className="w-full md:w-3/4 flex flex-col gap-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-[#8a95a8] mb-1.5"><UserCircle2 className="w-4 h-4 text-[#c9a84c]" /> Contact Name</label>
                  <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full border border-[rgba(201,168,76,0.18)] rounded-lg p-2.5 focus:ring-2 focus:ring-[#c9a84c] outline-none bg-[#1a2235] text-[#e8eaf0] placeholder-[#4a5568]" placeholder={`e.g. John Doe`} />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-[#8a95a8] mb-1.5"><Building2 className="w-4 h-4 text-[#c9a84c]" /> Shop / Business Name</label>
                  <input type="text" value={formData.shop_name} onChange={e => setFormData({ ...formData, shop_name: e.target.value })} className="w-full border border-[rgba(201,168,76,0.18)] rounded-lg p-2.5 focus:ring-2 focus:ring-[#c9a84c] outline-none bg-[#1a2235] text-[#e8eaf0] placeholder-[#4a5568]" placeholder="e.g. Super Mart Ltd." />
                </div>
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-2 text-sm font-bold text-[#8a95a8]"><Phone className="w-4 h-4 text-[#c9a84c]" /> Phone Numbers</label>
                    <button type="button" onClick={() => setFormData({ ...formData, phone_numbers: [...formData.phone_numbers, { number: '', is_whatsapp: false, is_imo: false, is_telegram: false }] })} className="text-xs font-bold text-[#c9a84c] hover:bg-[rgba(201,168,76,0.1)] px-2 py-1 rounded border border-[rgba(201,168,76,0.18)]">
                      + Add Number
                    </button>
                  </div>
                  <div className="space-y-3">
                    {formData.phone_numbers.map((pn, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-[#1a2235] border border-[rgba(201,168,76,0.18)] p-3 rounded-lg">
                        <input required type="text" value={pn.number} onChange={e => {
                          const newPn = [...formData.phone_numbers];
                          newPn[idx].number = e.target.value;
                          setFormData({ ...formData, phone_numbers: newPn });
                        }} className="flex-1 w-full border border-[rgba(201,168,76,0.18)] rounded-lg p-2 focus:ring-2 focus:ring-[#c9a84c] outline-none bg-[#131929] text-[#e8eaf0] placeholder-[#4a5568] text-sm" placeholder="e.g. +8801..." />

                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 shrink-0">
                          <label className="flex items-center gap-1.5 cursor-pointer hover:bg-[#131929] px-2 py-1 rounded transition">
                            <input type="checkbox" checked={pn.is_whatsapp} onChange={e => {
                              const newPn = [...formData.phone_numbers];
                              newPn[idx].is_whatsapp = e.target.checked;
                              setFormData({ ...formData, phone_numbers: newPn });
                            }} className="w-4 h-4 text-green-500 rounded border-[rgba(201,168,76,0.18)] accent-green-500 bg-[#131929]" />
                            <span className="text-xs font-bold text-[#8a95a8]">WhatsApp</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer hover:bg-[#131929] px-2 py-1 rounded transition">
                            <input type="checkbox" checked={pn.is_imo} onChange={e => {
                              const newPn = [...formData.phone_numbers];
                              newPn[idx].is_imo = e.target.checked;
                              setFormData({ ...formData, phone_numbers: newPn });
                            }} className="w-4 h-4 text-[#c9a84c] rounded border-[rgba(201,168,76,0.18)] accent-[#c9a84c] bg-[#131929]" />
                            <span className="text-xs font-bold text-[#8a95a8]">imo</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer hover:bg-[#131929] px-2 py-1 rounded transition">
                            <input type="checkbox" checked={pn.is_telegram} onChange={e => {
                              const newPn = [...formData.phone_numbers];
                              newPn[idx].is_telegram = e.target.checked;
                              setFormData({ ...formData, phone_numbers: newPn });
                            }} className="w-4 h-4 text-blue-500 rounded border-[rgba(201,168,76,0.18)] accent-blue-500 bg-[#131929]" />
                            <span className="text-xs font-bold text-[#8a95a8]">Telegram</span>
                          </label>
                        </div>
                        {formData.phone_numbers.length > 1 && (
                          <button type="button" onClick={() => {
                            const newPn = formData.phone_numbers.filter((_, i) => i !== idx);
                            setFormData({ ...formData, phone_numbers: newPn });
                          }} className="text-red-400 hover:text-red-500 bg-[rgba(248,113,113,0.1)] p-1.5 rounded-md shrink-0">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-[#8a95a8] mb-1.5"><Mail className="w-4 h-4 text-[#c9a84c]" /> Email</label>
                    <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full border border-[rgba(201,168,76,0.18)] rounded-lg p-2.5 focus:ring-2 focus:ring-[#c9a84c] outline-none bg-[#1a2235] text-[#e8eaf0] placeholder-[#4a5568]" placeholder="contact@example.com" />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-[#8a95a8] mb-1.5"><MapPin className="w-4 h-4 text-[#c9a84c]" /> Address</label>
                    <input type="text" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="w-full border border-[rgba(201,168,76,0.18)] rounded-lg p-2.5 focus:ring-2 focus:ring-[#c9a84c] outline-none bg-[#1a2235] text-[#e8eaf0] placeholder-[#4a5568]" placeholder="Physical Address" />
                  </div>
                </div>
              </div>

              {/* Dynamic Sub-Employees */}
              <div className="mt-4 border-t border-[rgba(255,255,255,0.06)] pt-6">
                <label className="flex items-center gap-3 cursor-pointer mb-3 p-3 border border-[rgba(201,168,76,0.18)] rounded-xl hover:bg-[#1a2235] transition w-full sm:w-max">
                  <input type="checkbox" checked={showEmployeeSection} onChange={e => setShowEmployeeSection(e.target.checked)} className="w-5 h-5 text-[#c9a84c] rounded accent-[#c9a84c] bg-[#131929]" />
                  <span className="font-bold text-[#e8eaf0]">Add Employee / Personnel Details</span>
                </label>

                {showEmployeeSection && (
                  <div className="animate-in fade-in slide-in-from-top-2 mt-4 space-y-4">
                    <div className="flex justify-between items-center bg-[#1a2235] px-4 py-2.5 rounded-lg border border-[rgba(201,168,76,0.18)]">
                      <label className="text-sm font-bold text-[#e8eaf0]">Linked Employees</label>
                      <button type="button" onClick={addPersonnel} className="text-xs font-bold text-[#c9a84c] border border-[rgba(201,168,76,0.18)] hover:bg-[rgba(201,168,76,0.1)] px-3 py-1.5 rounded-lg transition">+ Add Member</button>
                    </div>
                    {personnel.length > 0 && (
                      <div className="flex flex-col gap-4">
                        {personnel.map((p, pIdx) => (
                          <div key={pIdx} className="flex flex-col md:flex-row items-start md:items-center gap-4 p-4 border border-[rgba(201,168,76,0.18)] rounded-xl bg-[#1a2235]/50 relative">
                            <div className="w-16 h-16 rounded-full bg-[#131929] flex items-center justify-center overflow-hidden border border-[rgba(201,168,76,0.18)] shadow-[0_4px_24px_rgba(0,0,0,0.5)] shrink-0 relative group">
                              {p._preview || p.photo_url ? (
                                <img src={p._preview || p.photo_url} alt="sub" className="w-full h-full object-cover" />
                              ) : (
                                <UserCircle2 className="w-8 h-8 text-[#4a5568]" />
                              )}
                              <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                <ImageIcon className="w-5 h-5 text-white" />
                                <input type="file" className="hidden" accept="image/*" onChange={e => handlePersonnelImage(pIdx, e)} />
                              </label>
                            </div>

                            <div className="flex-1 w-full flex flex-col gap-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                                <input type="text" value={p.name} onChange={e => updatePersonnel(pIdx, 'name', e.target.value)} placeholder="Employee Name" className="border border-[rgba(201,168,76,0.18)] rounded-md p-2 text-sm focus:ring-2 focus:ring-[#c9a84c] outline-none bg-[#131929] text-[#e8eaf0] placeholder-[#4a5568]" />
                                <select value={p.position} onChange={e => updatePersonnel(pIdx, 'position', e.target.value)} className="border border-[rgba(201,168,76,0.18)] rounded-md p-2 text-sm focus:ring-2 focus:ring-[#c9a84c] outline-none bg-[#131929] text-[#e8eaf0] appearance-none">
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
                                </select>
                              </div>

                              <div className="flex flex-col gap-2 border-l-2 border-[rgba(201,168,76,0.18)] pl-3">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-bold text-[#8a95a8]">Phone Numbers</label>
                                  <button type="button" onClick={() => {
                                    const currentPn = [...(p.phone_numbers || [])];
                                    currentPn.push({ number: '', is_whatsapp: false, is_imo: false, is_telegram: false });
                                    updatePersonnel(pIdx, 'phone_numbers', currentPn);
                                  }} className="text-[10px] font-bold text-[#c9a84c] hover:bg-[rgba(201,168,76,0.1)] px-2 py-1 rounded border border-[rgba(201,168,76,0.18)]">
                                    + Add Phone
                                  </button>
                                </div>

                                {p.phone_numbers && p.phone_numbers.map((pn: any, pnIdx: number) => (
                                  <div key={pnIdx} className="flex flex-col xl:flex-row gap-2 items-start xl:items-center bg-[#131929] border border-[rgba(201,168,76,0.18)] p-2 rounded-lg">
                                    <input type="text" value={pn.number} onChange={e => {
                                      const currentPn = [...p.phone_numbers];
                                      currentPn[pnIdx].number = e.target.value;
                                      updatePersonnel(pIdx, 'phone_numbers', currentPn);
                                    }} placeholder="Phone Number" className="flex-1 w-full border border-[rgba(255,255,255,0.06)] bg-[#1a2235] text-[#e8eaf0] rounded-md p-1.5 text-xs focus:ring-2 focus:ring-[#c9a84c] outline-none placeholder-[#4a5568]" />
                                    <div className="flex items-center gap-3 shrink-0">
                                      <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input type="checkbox" checked={pn.is_whatsapp} onChange={e => {
                                          const currentPn = [...p.phone_numbers];
                                          currentPn[pnIdx].is_whatsapp = e.target.checked;
                                          updatePersonnel(pIdx, 'phone_numbers', currentPn);
                                        }} className="w-3.5 h-3.5 text-green-500 rounded bg-[#1a2235] accent-green-500 border-none" />
                                        <span className="text-[10px] font-bold text-[#8a95a8]">WA</span>
                                      </label>
                                      <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input type="checkbox" checked={pn.is_imo} onChange={e => {
                                          const currentPn = [...p.phone_numbers];
                                          currentPn[pnIdx].is_imo = e.target.checked;
                                          updatePersonnel(pIdx, 'phone_numbers', currentPn);
                                        }} className="w-3.5 h-3.5 text-[#c9a84c] rounded bg-[#1a2235] accent-[#c9a84c] border-none" />
                                        <span className="text-[10px] font-bold text-[#8a95a8]">imo</span>
                                      </label>
                                      <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input type="checkbox" checked={pn.is_telegram} onChange={e => {
                                          const currentPn = [...p.phone_numbers];
                                          currentPn[pnIdx].is_telegram = e.target.checked;
                                          updatePersonnel(pIdx, 'phone_numbers', currentPn);
                                        }} className="w-3.5 h-3.5 text-blue-500 rounded bg-[#1a2235] accent-blue-500 border-none" />
                                        <span className="text-[10px] font-bold text-[#8a95a8]">TG</span>
                                      </label>
                                      {p.phone_numbers.length > 1 && (
                                        <button type="button" onClick={() => {
                                          const currentPn = p.phone_numbers.filter((_: any, i: number) => i !== pnIdx);
                                          updatePersonnel(pIdx, 'phone_numbers', currentPn);
                                        }} className="text-red-400 hover:text-red-500 ml-1 bg-[rgba(248,113,113,0.1)] p-1 rounded-md">
                                          <X className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <button type="button" onClick={() => removePersonnel(pIdx)} className="absolute top-2 right-2 text-red-500 p-1.5 bg-[#131929] hover:bg-[rgba(248,113,113,0.1)] rounded-lg transition-colors border border-[rgba(255,255,255,0.06)]"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    {personnel.length === 0 && <p className="text-xs text-[#4a5568] italic p-4 bg-[#131929] rounded-lg border border-dashed border-[rgba(255,255,255,0.06)]">No employees added. You can add the shop owner or managers here.</p>}
                  </div>
                )}
              </div>

              {/* Bank Details Section */}
              <div className="border-t border-[rgba(255,255,255,0.06)] pt-6">
                <label className="flex items-center gap-3 cursor-pointer mb-3 p-3 border border-[rgba(201,168,76,0.18)] rounded-xl hover:bg-[rgba(96,165,250,0.1)] hover:border-[rgba(96,165,250,0.3)] transition w-full sm:w-max">
                  <input type="checkbox" checked={showBankSection} onChange={e => setShowBankSection(e.target.checked)} className="w-5 h-5 text-blue-500 rounded accent-blue-500 bg-[#131929]" />
                  <span className="font-bold text-[#e8eaf0] flex items-center gap-2"><CreditCard className="w-4 h-4 text-blue-400" /> Add Bank Account</span>
                </label>

                {showBankSection && (
                  <div className="animate-in fade-in slide-in-from-top-2 mt-4 space-y-4">
                    <div className="flex justify-end mb-2">
                      <button type="button" onClick={() => setFormData({ ...formData, bank_details: [...formData.bank_details, { bank_name: '', account_name: '', account_number: '', branch: '' }] })} className="text-xs font-bold text-blue-400 hover:bg-[rgba(96,165,250,0.1)] px-3 py-1.5 rounded-lg border border-[rgba(96,165,250,0.2)] transition-colors">
                        + Add Another Bank
                      </button>
                    </div>

                    {formData.bank_details.map((bank, bankIdx) => (
                      <div key={bankIdx} className="relative grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[rgba(96,165,250,0.05)] p-5 rounded-2xl border border-[rgba(96,165,250,0.2)]">
                        {formData.bank_details.length > 1 && (
                          <button type="button" onClick={() => {
                            const newBanks = formData.bank_details.filter((_, i) => i !== bankIdx);
                            setFormData({ ...formData, bank_details: newBanks });
                          }} className="absolute top-2 right-2 text-red-400 hover:bg-[rgba(248,113,113,0.1)] p-1.5 rounded-lg transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        <div>
                          <label className="block text-[10px] font-bold text-[#8a95a8] mb-1.5 uppercase">Bank Name</label>
                          <input type="text" value={bank.bank_name} onChange={e => {
                            const newBanks = [...formData.bank_details];
                            newBanks[bankIdx].bank_name = e.target.value;
                            setFormData({ ...formData, bank_details: newBanks });
                          }} className="w-full border border-[rgba(201,168,76,0.18)] rounded-lg p-2.5 outline-none focus:border-blue-400 bg-[#131929] text-[#e8eaf0] text-sm placeholder-[#4a5568]" placeholder="e.g. City Bank" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-[#8a95a8] mb-1.5 uppercase">Account Name</label>
                          <input type="text" value={bank.account_name} onChange={e => {
                            const newBanks = [...formData.bank_details];
                            newBanks[bankIdx].account_name = e.target.value;
                            setFormData({ ...formData, bank_details: newBanks });
                          }} className="w-full border border-[rgba(201,168,76,0.18)] rounded-lg p-2.5 outline-none focus:border-blue-400 bg-[#131929] text-[#e8eaf0] text-sm placeholder-[#4a5568]" placeholder="e.g. John Doe" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-[#8a95a8] mb-1.5 uppercase">Account Number</label>
                          <input type="text" value={bank.account_number} onChange={e => {
                            const newBanks = [...formData.bank_details];
                            newBanks[bankIdx].account_number = e.target.value;
                            setFormData({ ...formData, bank_details: newBanks });
                          }} className="w-full border border-[rgba(201,168,76,0.18)] rounded-lg p-2.5 outline-none focus:border-blue-400 font-mono bg-[#131929] text-[#e8eaf0] text-sm placeholder-[#4a5568]" placeholder="1234567890" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-[#8a95a8] mb-1.5 uppercase">Branch</label>
                          <input type="text" value={bank.branch} onChange={e => {
                            const newBanks = [...formData.bank_details];
                            newBanks[bankIdx].branch = e.target.value;
                            setFormData({ ...formData, bank_details: newBanks });
                          }} className="w-full border border-[rgba(201,168,76,0.18)] rounded-lg p-2.5 outline-none focus:border-blue-400 bg-[#131929] text-[#e8eaf0] text-sm placeholder-[#4a5568]" placeholder="e.g. Gulshan" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* MFS Section */}
              <div className="border-t border-[rgba(255,255,255,0.06)] pt-6">
                <label className="flex items-center gap-3 cursor-pointer mb-3 p-3 border border-[rgba(201,168,76,0.18)] rounded-xl hover:bg-[rgba(52,211,153,0.1)] hover:border-[rgba(52,211,153,0.3)] transition w-full sm:w-max">
                  <input type="checkbox" checked={showMfsSection} onChange={e => setShowMfsSection(e.target.checked)} className="w-5 h-5 text-emerald-500 rounded accent-emerald-500 bg-[#131929]" />
                  <span className="font-bold text-[#e8eaf0] flex items-center gap-2"><CreditCard className="w-4 h-4 text-emerald-400" /> Add MFS (Bikash/Nagad)</span>
                </label>
                {showMfsSection && (
                  <div className="animate-in fade-in slide-in-from-top-2 mt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-[rgba(52,211,153,0.05)] p-5 rounded-2xl border border-[rgba(52,211,153,0.2)]">
                      <div>
                        <label className="block text-[10px] font-bold mb-1.5 uppercase tracking-wider text-pink-400">Bikash</label>
                        <input type="text" value={mfsData.bikash} onChange={e => setMfsData({ ...mfsData, bikash: e.target.value })} className="w-full border border-[rgba(244,114,182,0.3)] rounded-lg p-2.5 outline-none focus:border-pink-400 bg-[#131929] font-mono text-sm text-[#e8eaf0] placeholder-[#4a5568]" placeholder="+8801..." />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-orange-400 mb-1.5 uppercase tracking-wider">Nagad</label>
                        <input type="text" value={mfsData.nagad} onChange={e => setMfsData({ ...mfsData, nagad: e.target.value })} className="w-full border border-[rgba(251,146,60,0.3)] rounded-lg p-2.5 outline-none focus:border-orange-400 bg-[#131929] font-mono text-sm text-[#e8eaf0] placeholder-[#4a5568]" placeholder="+8801..." />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-purple-400 mb-1.5 uppercase tracking-wider">Rocket</label>
                        <input type="text" value={mfsData.rocket} onChange={e => setMfsData({ ...mfsData, rocket: e.target.value })} className="w-full border border-[rgba(192,132,252,0.3)] rounded-lg p-2.5 outline-none focus:border-purple-400 bg-[#131929] font-mono text-sm text-[#e8eaf0] placeholder-[#4a5568]" placeholder="+8801..." />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-blue-400 mb-1.5 uppercase tracking-wider">Upay</label>
                        <input type="text" value={mfsData.upay} onChange={e => setMfsData({ ...mfsData, upay: e.target.value })} className="w-full border border-[rgba(96,165,250,0.3)] rounded-lg p-2.5 outline-none focus:border-blue-400 bg-[#131929] font-mono text-sm text-[#e8eaf0] placeholder-[#4a5568]" placeholder="+8801..." />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-4 items-center justify-end border-t border-[rgba(255,255,255,0.06)] pt-5 mt-2">
            <button type="button" onClick={resetForm} className="px-6 py-2.5 font-bold text-[#8a95a8] hover:bg-[rgba(255,255,255,0.06)] rounded-lg transition-colors">Cancel</button>
            <button type="submit" disabled={submitting} className="bg-gradient-to-br from-[#c9a84c] to-[#f0c040] text-[#0a0900] px-8 py-2.5 font-bold rounded-lg hover:opacity-90 hover:scale-[1.02] transform transition-all shadow-[0_4px_24px_rgba(0,0,0,0.6)] disabled:opacity-60 flex items-center gap-2">
              {submitting ? 'Saving...' : editingId ? `Update ${singularType}` : `Save ${singularType}`}
            </button>
          </div>
        </form>
      )}

      {/* Main Data Display */}
      {viewMode === 'table' ? (
        <div className="bg-[#131929] rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.5)] border border-[rgba(201,168,76,0.18)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[800px]">
              <thead className="bg-[#1a2235] border-b border-[rgba(201,168,76,0.18)]">
                <tr>
                  <th className="px-6 py-4 text-[11px] font-extrabold text-[#c9a84c] uppercase tracking-wider">Contact Profile</th>
                  <th className="px-6 py-4 text-[11px] font-extrabold text-[#c9a84c] uppercase tracking-wider">Quick Connect</th>
                  <th className="px-6 py-4 text-[11px] font-extrabold text-[#c9a84c] uppercase tracking-wider">Address details</th>
                  <th className="px-6 py-4 text-[11px] font-extrabold text-[#c9a84c] uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(255,255,255,0.06)]">
                {contacts.map(contact => (
                  <tr key={contact.id} className="hover:bg-[#1a2235]/50 transition-colors cursor-pointer group/row" onClick={() => setViewingContact(contact)}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-[rgba(201,168,76,0.1)] flex items-center justify-center overflow-hidden border border-[rgba(201,168,76,0.18)] shadow-[0_4px_24px_rgba(0,0,0,0.5)] shrink-0">
                          {contact.photo_url ? (
                            <img src={contact.photo_url} alt={contact.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[#c9a84c] font-extrabold text-lg">{contact.name.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div>
                          <span className="font-extrabold text-[#e8eaf0] block text-base leading-tight cursor-pointer hover:text-[#c9a84c] transition" onClick={() => setViewingContact(contact)}>{contact.name}</span>
                          {contact.shop_name && (
                            <span className="inline-flex items-center gap-1.5 mt-1.5 text-[10px] font-bold text-[#f0c040] bg-[rgba(201,168,76,0.1)] px-2 py-0.5 rounded border border-[rgba(201,168,76,0.18)] uppercase tracking-wide">
                              <Building2 className="w-3 h-3" /> {contact.shop_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5 text-sm">
                        {contact.phone_numbers && contact.phone_numbers.length > 0 ? (
                          contact.phone_numbers.map((pn: any, i: number) => (
                            <InteractivePhone key={i} pn={pn} />
                          ))
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {contact.phone && <InteractivePhone legacyNum={contact.phone} />}
                            {contact.whatsapp && <InteractivePhone legacyNum={contact.whatsapp} legacyWa="true" />}
                          </div>
                        )}
                        {contact.email && <span className="flex items-center gap-2 text-[#8a95a8] mt-1 text-xs font-semibold"><Mail className="w-3 h-3 text-[#4a5568]" /> {contact.email}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-start gap-1">
                        {contact.address ? (
                          <span className="text-sm text-[#8a95a8] flex gap-2 w-48 truncate" title={contact.address}><MapPin className="w-4 h-4 text-[#4a5568] shrink-0" /> {contact.address}</span>
                        ) : <span className="text-[#4a5568] text-xs italic font-medium">No address</span>}

                        {contact.contact_employees?.length > 0 && (
                          <span className="text-[10px] bg-[rgba(255,255,255,0.06)] text-[#8a95a8] border border-[rgba(255,255,255,0.1)] px-2 py-1 rounded-md font-bold mt-1.5 uppercase tracking-wide flex items-center gap-1.5 w-max">
                            <Users className="w-3 h-3" /> {contact.contact_employees.length} Linked
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setViewingContact(contact)} className="p-2 text-[#8a95a8] hover:text-blue-500 hover:bg-[rgba(96,165,250,0.1)] rounded-lg transition-colors border border-transparent hover:border-[rgba(96,165,250,0.2)]" title="View Profile Ledger">
                          <Activity className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleEdit(contact)} className="p-2 text-[#8a95a8] hover:text-[#c9a84c] hover:bg-[rgba(201,168,76,0.1)] rounded-lg transition-colors border border-transparent hover:border-[rgba(201,168,76,0.18)]" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(contact.id)} className="p-2 text-[#8a95a8] hover:text-red-500 hover:bg-[rgba(248,113,113,0.1)] rounded-lg transition-colors border border-transparent hover:border-red-200" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {contacts.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-[#8a95a8] italic">
                      No {displayTitle} found. Click "Add {singularType}" to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {contacts.map(contact => (
            <div key={contact.id} onClick={() => setViewingContact(contact)} className="bg-[#131929] rounded-[2.5rem] p-7 shadow-[0_4px_24px_rgba(0,0,0,0.5)] border border-[rgba(255,255,255,0.06)] flex flex-col hover:shadow-[0_12px_44px_rgba(201,168,76,0.12)] transition-all hover:-translate-y-1.5 cursor-pointer relative group animate-in zoom-in-95 duration-200">

              <div className="absolute top-5 right-6 flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-all" onClick={e => e.stopPropagation()}>
                <button onClick={() => handleEdit(contact)} className="p-2 text-[#8a95a8] hover:text-[#c9a84c] bg-[#1a2235]/80 backdrop-blur-md hover:bg-[rgba(201,168,76,0.1)] rounded-xl border border-[rgba(255,255,255,0.06)] transition-all transform hover:scale-110"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(contact.id)} className="p-2 text-[#8a95a8] hover:text-red-500 bg-[#1a2235]/80 backdrop-blur-md hover:bg-red-500/10 rounded-xl border border-[rgba(255,255,255,0.06)] transition-all transform hover:scale-110"><Trash2 className="w-4 h-4" /></button>
              </div>

              <div className="flex items-start gap-4 mb-5">
                <div className="w-14 h-14 rounded-2xl bg-[rgba(201,168,76,0.1)] flex items-center justify-center overflow-hidden border border-[rgba(201,168,76,0.18)] shadow-[0_4px_24px_rgba(0,0,0,0.5)] shrink-0 cursor-pointer" onClick={() => setViewingContact(contact)}>
                  {contact.photo_url ? (
                    <img src={contact.photo_url} alt={contact.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[#c9a84c] font-extrabold text-xl">{contact.name.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="pt-1">
                  <h3 className="font-extrabold text-[#e8eaf0] text-lg leading-tight line-clamp-1 cursor-pointer hover:text-[#c9a84c] transition" title={contact.name} onClick={() => setViewingContact(contact)}>{contact.name}</h3>
                  {contact.shop_name && (
                    <span className="inline-flex items-center gap-1.5 mt-1.5 text-[10px] font-bold text-[#f0c040] bg-[rgba(201,168,76,0.1)] px-2 py-0.5 rounded border border-[rgba(201,168,76,0.18)] uppercase tracking-wide line-clamp-1" title={contact.shop_name}>
                      <Building2 className="w-3 h-3" /> {contact.shop_name}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 space-y-4 mb-5">
                <div className="flex flex-col gap-2 text-sm bg-[#1a2235]/60 p-4 rounded-2xl border border-[rgba(255,255,255,0.06)]">
                  {contact.phone_numbers && contact.phone_numbers.length > 0 ? (
                    contact.phone_numbers.map((pn: any, i: number) => (
                      <InteractivePhone key={i} pn={pn} />
                    ))
                  ) : (
                    <div className="flex flex-col gap-2">
                      {contact.phone && <InteractivePhone legacyNum={contact.phone} />}
                      {contact.whatsapp && <InteractivePhone legacyNum={contact.whatsapp} legacyWa="true" />}
                    </div>
                  )}
                  {contact.email && <span className="flex items-center gap-2.5 text-[#8a95a8] pt-2 border-t border-[rgba(255,255,255,0.06)] font-medium text-xs break-all"><Mail className="w-3.5 h-3.5 text-[#4a5568] shrink-0" /> {contact.email}</span>}
                </div>

                <div className="flex items-start gap-2.5 text-xs text-[#8a95a8] px-2">
                  <MapPin className="w-4 h-4 text-[#4a5568] shrink-0 mt-0.5" />
                  <span className={contact.address ? "line-clamp-2 leading-relaxed" : "italic"} title={contact.address}>
                    {contact.address || 'No address provided'}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-[rgba(255,255,255,0.06)] flex items-center justify-between">
                {contact.contact_employees?.length > 0 ? (
                  <span className="text-[10px] font-bold text-[#8a95a8] uppercase tracking-wide flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#4a5568]" /> {contact.contact_employees.length} Employee{contact.contact_employees.length !== 1 && 's'}
                  </span>
                ) : (
                  <span className="text-xs text-[#4a5568] italic font-medium">No personnel</span>
                )}

                <button onClick={() => setViewingContact(contact)} className="text-[11px] font-extrabold uppercase tracking-wide bg-[rgba(201,168,76,0.1)] text-[#c9a84c] border border-[rgba(201,168,76,0.18)] px-4 py-1.5 rounded-lg hover:bg-[#c9a84c] hover:text-[#131929] transition flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5" /> Ledger Profile
                </button>
              </div>
            </div>
          ))}

          {contacts.length === 0 && (
            <div className="col-span-full py-20 text-center bg-[#131929] rounded-3xl border-2 border-dashed border-[rgba(201,168,76,0.18)] shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
              <div className="w-20 h-20 bg-[#1a2235] rounded-full flex items-center justify-center mx-auto mb-4 border border-[rgba(255,255,255,0.06)]">
                <UserCircle2 className="w-10 h-10 text-[#4a5568]" />
              </div>
              <h3 className="text-xl font-extrabold text-[#e8eaf0] mb-2">No {displayTitle} Found</h3>
              <p className="text-[#8a95a8] font-medium text-sm">Click "Add {singularType}" to start building your directory.</p>
            </div>
          )}
        </div>
      )}

      {/* View Profile Modal - LEDGER INCLUDED */}
      {viewingContact && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 w-full h-[100dvh]">
          <div className="bg-[#131929] rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] border border-[rgba(201,168,76,0.18)] w-full max-w-5xl h-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col relative custom-scrollbar">

            {/* Modal Header Cover */}
            <div className={`h-24 sm:h-32 bg-gradient-to-r from-[#131929] to-[#1a2235] relative shrink-0 border-b border-[rgba(201,168,76,0.18)]`}>
              {/* Pattern overlay */}
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#c9a84c 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
              <button onClick={() => setViewingContact(null)} className="absolute top-4 right-4 text-[#8a95a8] hover:text-white bg-[#1a2235]/80 hover:bg-red-500/80 p-2 rounded-full transition-colors backdrop-blur-md z-10 border border-[rgba(255,255,255,0.1)]"><X className="w-5 h-5" /></button>
            </div>

            {/* Modal Content */}
            <div className="px-6 sm:px-10 pb-10 pt-0 relative flex-1 flex flex-col">

              {/* Contact Header */}
              <div className="flex flex-col sm:flex-row gap-5 sm:gap-6 items-center sm:items-end -mt-12 sm:-mt-16 mb-8 relative z-10">
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-[2rem] bg-[#131929] p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.8)] border border-[rgba(201,168,76,0.18)] shrink-0">
                  <div className="w-full h-full rounded-[1.5rem] bg-[#1a2235] flex items-center justify-center overflow-hidden border border-[rgba(255,255,255,0.06)]">
                    {viewingContact.photo_url ? (
                      <img src={viewingContact.photo_url} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <UserCircle2 className="w-12 h-12 sm:w-16 sm:h-16 text-[#4a5568]" />
                    )}
                  </div>
                </div>
                <div className="flex-1 pb-2 text-center sm:text-left">
                  <h3 className="text-2xl sm:text-3xl font-black text-[#e8eaf0] tracking-tight">{viewingContact.name}</h3>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3">
                    {viewingContact.customer_code && <span className="text-[11px] font-mono font-extrabold text-[#c9a84c] bg-[rgba(201,168,76,0.1)] px-3 py-1 rounded border border-[rgba(201,168,76,0.18)] shadow-[0_4px_12px_rgba(0,0,0,0.5)]">{viewingContact.customer_code}</span>}
                    {viewingContact.shop_name && <span className="text-[11px] font-extrabold text-[#f0c040] bg-[rgba(201,168,76,0.1)] px-3 py-1 rounded border border-[rgba(201,168,76,0.18)] flex items-center gap-1.5 uppercase tracking-wider shadow-[0_4px_12px_rgba(0,0,0,0.5)]"><Building2 className="w-3 h-3" /> {viewingContact.shop_name}</span>}
                    <span className="text-[11px] font-extrabold text-[#8a95a8] bg-[#1a2235] px-3 py-1 rounded border border-[rgba(255,255,255,0.06)] shadow-[0_4px_12px_rgba(0,0,0,0.5)] uppercase tracking-wider">{viewingContact.type}</span>
                  </div>
                </div>
              </div>

              {/* Modal Tabs */}
              <div className="flex gap-2 sm:gap-6 border-b border-[rgba(255,255,255,0.06)] mb-8 overflow-x-auto no-scrollbar">
                <button onClick={() => setModalTab('profile')} className={`px-4 sm:px-6 py-3 font-extrabold text-xs sm:text-sm border-b-2 transition-all whitespace-nowrap ${modalTab === 'profile' ? 'border-[#c9a84c] text-[#c9a84c]' : 'border-transparent text-[#8a95a8] hover:text-[#e8eaf0] hover:border-[rgba(255,255,255,0.1)]'}`}>Profile Details</button>
                <button onClick={() => setModalTab('ledger')} className={`px-4 sm:px-6 py-3 font-extrabold text-xs sm:text-sm border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${modalTab === 'ledger' ? 'border-[#c9a84c] text-[#c9a84c]' : 'border-transparent text-[#8a95a8] hover:text-[#e8eaf0] hover:border-[rgba(255,255,255,0.1)]'}`}>
                  <Activity className="w-4 h-4" /> Len Den (Ledger)
                </button>
              </div>

              {modalTab === 'profile' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  {/* Left Column (Details & Bank) */}
                  <div className="space-y-6">
                    <div className="bg-[#1a2235]/40 border border-[rgba(255,255,255,0.06)] p-5 sm:p-6 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
                      <h4 className="text-[11px] font-black text-[#8a95a8] uppercase tracking-widest mb-5 flex items-center gap-2"><MapPin className="w-4 h-4 text-[#c9a84c]" /> Contact Info</h4>
                      <div className="space-y-4">
                        {viewingContact.phone_numbers?.length > 0 ? viewingContact.phone_numbers.map((pn: any, i: number) => (
                          <div key={i} className="flex items-center gap-4 bg-[#131929] p-3.5 rounded-2xl border border-[rgba(201,168,76,0.18)] shadow-inner">
                            <div className="w-10 h-10 rounded-xl bg-[rgba(201,168,76,0.1)] text-[#c9a84c] flex items-center justify-center shrink-0 border border-[rgba(201,168,76,0.18)]"><Phone className="w-4 h-4" /></div>
                            <div className="flex-1">
                              <InteractivePhone pn={pn} />
                            </div>
                          </div>
                        )) : (
                          <>
                            {viewingContact.phone && (
                              <div className="flex items-center gap-4 bg-[#131929] p-3.5 rounded-2xl border border-[rgba(201,168,76,0.18)] shadow-inner">
                                <div className="w-10 h-10 rounded-xl bg-[rgba(201,168,76,0.1)] text-[#c9a84c] flex items-center justify-center shrink-0 border border-[rgba(201,168,76,0.18)]"><Phone className="w-4 h-4" /></div>
                                <InteractivePhone legacyNum={viewingContact.phone} />
                              </div>
                            )}
                            {viewingContact.whatsapp && (
                              <div className="flex items-center gap-4 bg-[#131929] p-3.5 rounded-2xl border border-[rgba(201,168,76,0.18)] shadow-inner">
                                <div className="w-10 h-10 rounded-xl bg-[rgba(52,211,153,0.1)] text-green-500 flex items-center justify-center shrink-0 border border-[rgba(52,211,153,0.2)]"><MessageSquare className="w-4 h-4" /></div>
                                <InteractivePhone legacyNum={viewingContact.whatsapp} legacyWa="true" />
                              </div>
                            )}
                          </>
                        )}

                        {viewingContact.email && (
                          <div className="flex items-center gap-4 bg-[#131929] p-3.5 rounded-2xl border border-[rgba(255,255,255,0.06)] shadow-inner">
                            <div className="w-10 h-10 rounded-xl bg-[rgba(251,146,60,0.1)] text-orange-500 flex items-center justify-center shrink-0 border border-[rgba(251,146,60,0.2)]"><Mail className="w-4 h-4" /></div>
                            <div className="overflow-hidden">
                              <p className="text-[10px] font-black text-[#8a95a8] uppercase tracking-wider mb-0.5">Email Address</p>
                              <p className="font-bold text-[#e8eaf0] truncate" title={viewingContact.email}>{viewingContact.email}</p>
                            </div>
                          </div>
                        )}
                        {viewingContact.address && (
                          <div className="flex items-start gap-4 bg-[#131929] p-3.5 rounded-2xl border border-[rgba(255,255,255,0.06)] shadow-inner">
                            <div className="w-10 h-10 rounded-xl bg-[rgba(244,63,94,0.1)] text-rose-500 flex items-center justify-center shrink-0 border border-[rgba(244,63,94,0.2)]"><MapPin className="w-4 h-4" /></div>
                            <div className="flex-1 pt-0.5">
                              <p className="text-[10px] font-black text-[#8a95a8] uppercase tracking-wider mb-1">Physical Address</p>
                              <p className="font-semibold text-[#e8eaf0] text-sm leading-relaxed">{viewingContact.address}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Viewing Bank */}
                    {viewingContact.bank_details && viewingContact.bank_details.length > 0 && viewingContact.bank_details[0].bank_name !== '' && (
                      <div className="bg-[#1a2235]/40 border border-[rgba(96,165,250,0.2)] p-5 sm:p-6 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
                        <h4 className="text-[11px] font-black text-blue-400 uppercase tracking-widest mb-5 flex items-center gap-2"><CreditCard className="w-4 h-4" /> Bank/Financial Accounts</h4>
                        <div className="space-y-4">
                          {viewingContact.bank_details.map((b: any, i: number) => {
                            // Simple logic to style MFS differently
                            const isMFS = ['bikash', 'nagad', 'rocket', 'upay'].includes(b.bank_name?.toLowerCase());
                            const colorCls = isMFS ? 'text-emerald-400 border-[rgba(52,211,153,0.2)]' : 'text-blue-400 border-[rgba(96,165,250,0.2)]';

                            return (
                              <div key={i} className={`bg-[#131929] p-5 rounded-2xl shadow-inner border ${colorCls} relative overflow-hidden group`}>
                                <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full -mr-10 -mt-10 opacity-20 group-hover:scale-110 transition-transform ${isMFS ? 'bg-emerald-500' : 'bg-blue-500'}`}></div>
                                <p className={`font-black text-lg sm:text-xl uppercase tracking-tight ${isMFS ? 'text-emerald-500' : 'text-blue-500'}`}>{b.bank_name}</p>
                                <p className="text-[10px] font-black text-[#8a95a8] mt-2 uppercase tracking-widest">A/C Name: <span className="text-[#e8eaf0] normal-case text-sm">{b.account_name}</span></p>
                                <p className="text-xl font-mono font-black text-[#e8eaf0] mt-1.5 tracking-wider">{b.account_number}</p>
                                {b.branch && <p className="text-xs font-bold text-[#8a95a8] mt-2.5 flex items-center gap-1.5 bg-[rgba(255,255,255,0.06)] w-max px-2 py-1 rounded"><MapPin className="w-3 h-3" /> {b.branch} Branch</p>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column (Personnel) */}
                  <div className="space-y-6 flex flex-col h-full">
                    <div className="bg-[#1a2235]/40 border border-[rgba(201,168,76,0.18)] p-5 sm:p-6 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.5)] flex-1 flex flex-col">
                      <h4 className="text-[11px] font-black text-[#c9a84c] uppercase tracking-widest mb-5 flex items-center gap-2"><Users className="w-5 h-5" /> Linked Personnel</h4>
                      {viewingContact.contact_employees?.length > 0 ? (
                        <div className="space-y-4 overflow-y-auto pr-1 flex-1 custom-scrollbar">
                          {viewingContact.contact_employees.map((emp: any, idx: number) => (
                            <div key={idx} className="bg-[#131929] p-4 sm:p-5 rounded-2xl border border-[rgba(255,255,255,0.06)] shadow-inner flex flex-col gap-4">
                              <div className="flex items-center gap-4 border-b border-[rgba(255,255,255,0.06)] pb-4">
                                <div className="w-14 h-14 rounded-2xl bg-[#1a2235] border border-[rgba(201,168,76,0.18)] overflow-hidden shrink-0 shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                                  {emp.photo_url ? <img src={emp.photo_url} alt="Emp" className="w-full h-full object-cover" /> : <UserCircle2 className="w-full h-full text-[#4a5568] p-1.5" />}
                                </div>
                                <div>
                                  <p className="font-black text-[#e8eaf0] text-lg">{emp.name}</p>
                                  <p className="text-[10px] font-extrabold text-[#f0c040] bg-[rgba(201,168,76,0.1)] px-2.5 py-1 rounded border border-[rgba(201,168,76,0.18)] inline-block mt-1.5 uppercase tracking-widest">{emp.position}</p>
                                </div>
                              </div>
                              <div className="pt-1">
                                {(() => {
                                  let parsedPhone = [{ number: emp.phone || '', is_whatsapp: false, is_imo: false, is_telegram: false }];
                                  if (emp.phone && emp.phone.startsWith('[')) {
                                    try { parsedPhone = JSON.parse(emp.phone); } catch (e) { }
                                  }
                                  return parsedPhone.map((pn: any, i: number) => (
                                    <div key={i} className="mb-2 last:mb-0">
                                      <InteractivePhone pn={pn} />
                                    </div>
                                  ));
                                })()}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-[rgba(255,255,255,0.06)] rounded-2xl bg-[#131929] m-auto">
                          <UserCircle2 className="w-12 h-12 text-[#4a5568] mb-3 opacity-50" />
                          <p className="text-[#8a95a8] font-black text-sm uppercase tracking-widest">No personnel</p>
                          <p className="text-xs text-[#4a5568] mt-1 max-w-[200px] font-medium">Individual employee records not added.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                // LEDGER TAB (LEN DEN)
                <div className="bg-[#1a2235]/40 rounded-3xl border border-[rgba(201,168,76,0.18)] p-5 sm:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.5)] min-h-[400px] animate-in fade-in slide-in-from-bottom-4 duration-300">

                  <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-[rgba(201,168,76,0.1)] rounded-xl border border-[rgba(201,168,76,0.18)]">
                        <Activity className="w-6 h-6 text-[#c9a84c]" />
                      </div>
                      <div>
                        <h4 className="font-black text-[#e8eaf0] text-xl">Ledger Summary</h4>
                        <p className="text-xs text-[#8a95a8] font-bold tracking-wide uppercase mt-1">Real-time Transaction Due & Balance</p>
                      </div>
                    </div>

                    {/* Financial Due Cards */}
                    {(() => {
                      const totalInvoiced = transactions.invoices.filter(i => i.type !== 'return').reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);
                      const totalReturns = transactions.invoices.filter(i => i.type === 'return').reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);
                      const netInvoiced = totalInvoiced - totalReturns;
                      const totalPaid = transactions.payments.reduce((sum, pay) => sum + (Number(pay.amount) || 0), 0);
                      // For processor: add processing costs to due
                      const processingCost = viewingContact.type === 'processor'
                        ? transactions.processingOrders.filter((o: any) => o.type === 'issued').reduce((sum: number, o: any) => sum + (Number(o.total_cost) || 0), 0)
                        : 0;
                      const currentDue = (netInvoiced + processingCost) - totalPaid;
                      const hasAdvance = currentDue < 0;

                      return (
                        <div className="flex flex-wrap sm:flex-nowrap gap-3 sm:gap-4 w-full xl:w-auto">
                          {viewingContact.type === 'processor' && processingCost > 0 && (
                            <div className="flex-1 min-w-[120px] bg-[#131929] border border-[rgba(251,146,60,0.25)] rounded-2xl p-4 sm:p-5 shadow-inner">
                              <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1.5 whitespace-nowrap">Processing Cost</p>
                              <p className="font-black text-orange-300 text-lg sm:text-2xl font-mono">৳ {processingCost.toLocaleString()}</p>
                            </div>
                          )}
                          <div className="flex-1 min-w-[120px] bg-[#131929] border border-[rgba(52,211,153,0.2)] rounded-2xl p-4 sm:p-5 shadow-inner">
                            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1.5 whitespace-nowrap">Total Paid</p>
                            <p className="font-black text-emerald-400 text-lg sm:text-2xl font-mono">৳ {totalPaid.toLocaleString()}</p>
                          </div>
                          <div className={`flex-1 min-w-[140px] bg-[#131929] border ${hasAdvance ? 'border-[rgba(52,211,153,0.4)]' : currentDue > 0 ? 'border-[rgba(244,63,94,0.4)]' : 'border-[rgba(201,168,76,0.3)]'} rounded-2xl p-4 sm:p-5 shadow-[0_4px_24px_rgba(0,0,0,0.6)] relative overflow-hidden`}>
                            {currentDue > 0 && <div className="absolute top-0 right-0 w-2 h-full bg-rose-500"></div>}
                            {hasAdvance && <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500"></div>}
                            <p className={`text-[10px] font-black uppercase tracking-widest mb-1.5 whitespace-nowrap ${hasAdvance ? 'text-emerald-500' : currentDue > 0 ? 'text-rose-500' : 'text-[#c9a84c]'}`}>
                              {hasAdvance ? 'Advance Balance' : 'Current Due'}
                            </p>
                            <p className={`font-black text-xl sm:text-3xl font-mono ${hasAdvance ? 'text-emerald-400' : currentDue > 0 ? 'text-rose-500' : 'text-[#c9a84c]'}`}>
                              ৳ {Math.abs(currentDue).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* ── PROCESSOR: মাল এর হিসাব (product-wise) ── */}
                  {viewingContact.type === 'processor' && transactions.processingOrders.length > 0 && (() => {
                    const productMap: Record<string, { name: string; unit: string; issued: number; received: number }> = {};
                    transactions.processingOrders.forEach((o: any) => {
                      const key = (o.products as any)?.name || 'Unknown';
                      if (!productMap[key]) productMap[key] = { name: key, unit: (o.products as any)?.unit || 'u', issued: 0, received: 0 };
                      if (o.type === 'issued') productMap[key].issued += Number(o.quantity) || 0;
                      if (o.type === 'received') productMap[key].received += Number(o.quantity) || 0;
                    });
                    const items = Object.values(productMap);
                    return (
                      <div className="mb-6 bg-[#131929] rounded-2xl border border-[rgba(251,146,60,0.2)] p-4 sm:p-5">
                        <p className="text-[10px] font-black text-[#8a95a8] uppercase tracking-widest mb-4 flex items-center gap-2">
                          <Settings className="w-3.5 h-3.5 text-[#c9a84c]" /> Processor এর কাছে মাল
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {items.map((p, idx) => {
                            const outstanding = p.issued - p.received;
                            return (
                              <div key={idx} className={`flex items-center justify-between px-4 py-3 rounded-xl border ${outstanding > 0 ? 'border-[rgba(251,146,60,0.3)] bg-[rgba(251,146,60,0.05)]' : 'border-[rgba(52,211,153,0.3)] bg-[rgba(52,211,153,0.05)]'}`}>
                                <div>
                                  <p className="font-black text-[#e8eaf0] text-sm">{p.name}</p>
                                  <p className="text-[10px] text-[#8a95a8] font-bold mt-0.5">Issued {p.issued} · Received {p.received}</p>
                                </div>
                                <div className="text-right">
                                  <p className={`font-black text-2xl font-mono ${outstanding > 0 ? 'text-orange-400' : 'text-emerald-400'}`}>{outstanding}</p>
                                  <p className="text-[9px] text-[#4a5568] font-bold uppercase">{p.unit} বাকি</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex items-center gap-3 mb-4 pl-2">
                    <List className="w-4 h-4 text-[#8a95a8]" />
                    <h4 className="text-sm font-black text-[#8a95a8] uppercase tracking-widest">Detailed Timeline</h4>
                  </div>

                  {transactions.loading ? (
                    <div className="text-center py-20 flex flex-col items-center justify-center bg-[#131929] rounded-3xl border border-[rgba(255,255,255,0.06)]">
                      <div className="w-10 h-10 border-4 border-[#1a2235] border-t-[#c9a84c] rounded-full animate-spin mb-5 shadow-[0_0_15px_rgba(201,168,76,0.5)]"></div>
                      <p className="text-[#8a95a8] font-bold uppercase tracking-widest text-xs">Loading ledger...</p>
                    </div>
                  ) : transactions.invoices.length > 0 || transactions.payments.length > 0 || transactions.processingOrders.length > 0 ? (
                    <div className="space-y-3">
                      {[
                        ...transactions.invoices.map(inv => ({ ...inv, _itemType: 'invoice', sortDate: new Date(inv.date).getTime() })),
                        ...transactions.payments.map(pay => ({ ...pay, _itemType: 'payment', sortDate: new Date(pay.date).getTime() })),
                        ...transactions.processingOrders.map(po => ({ ...po, _itemType: 'processing', sortDate: new Date(po.date).getTime() }))
                      ].sort((a, b) => b.sortDate - a.sortDate).map((item, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#131929] hover:bg-[#1a2235] hover:border-[rgba(201,168,76,0.18)] transition-all group gap-4 relative overflow-hidden">
                          {/* Left Colored Accent Bar based on type */}
                          <div className={`absolute top-0 left-0 w-1.5 h-full ${item._itemType === 'processing'
                            ? (item.type === 'issued' ? 'bg-orange-500' : 'bg-emerald-500')
                            : item._itemType === 'invoice'
                              ? (item.type === 'return' ? 'bg-orange-500' : 'bg-blue-500')
                              : 'bg-emerald-500'
                            }`}></div>

                          <div className="flex items-center gap-4 sm:gap-5 pl-2">
                            <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner border ${item._itemType === 'processing'
                              ? (item.type === 'issued' ? 'bg-[rgba(251,146,60,0.1)] border-[rgba(251,146,60,0.2)] text-orange-500' : 'bg-[rgba(52,211,153,0.1)] border-[rgba(52,211,153,0.2)] text-emerald-500')
                              : item._itemType === 'invoice'
                                ? (item.type === 'return' ? 'bg-[rgba(251,146,60,0.1)] border-[rgba(251,146,60,0.2)] text-orange-500' : 'bg-[rgba(96,165,250,0.1)] border-[rgba(96,165,250,0.2)] text-blue-500')
                                : 'bg-[rgba(52,211,153,0.1)] border-[rgba(52,211,153,0.2)] text-emerald-500'
                              }`}>
                              {item._itemType === 'invoice' ? <Receipt className="w-5 h-5 sm:w-6 sm:h-6" /> : item._itemType === 'payment' ? <Banknote className="w-5 h-5 sm:w-6 sm:h-6" /> : <Settings className="w-5 h-5 sm:w-6 sm:h-6" />}
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                <p className="font-black text-[#e8eaf0] text-sm sm:text-base">
                                  {item._itemType === 'processing'
                                    ? `Processing ${item.type === 'issued' ? 'Issued' : 'Received'} — ${(item.products as any)?.name || 'Product'}`
                                    : item._itemType === 'invoice'
                                      ? `Invoice #${item.id.substring(0, 8).toUpperCase()}`
                                      : `Payment ${item.method ? `(${item.method.replace('_', ' ')})` : ''}`}
                                </p>
                                <span className={`text-[9px] uppercase font-black tracking-widest px-2 py-0.5 rounded border ${item._itemType === 'processing'
                                  ? (item.type === 'issued' ? 'bg-[rgba(251,146,60,0.1)] text-orange-400 border-[rgba(251,146,60,0.2)]' : 'bg-[rgba(52,211,153,0.1)] text-emerald-400 border-[rgba(52,211,153,0.2)]')
                                  : item.type === 'buy' ? 'bg-[rgba(201,168,76,0.1)] text-[#c9a84c] border-[rgba(201,168,76,0.18)]'
                                    : item.type === 'sell' ? 'bg-[rgba(52,211,153,0.1)] text-emerald-500 border-[rgba(52,211,153,0.2)]'
                                      : item.type === 'return' ? 'bg-[rgba(251,146,60,0.1)] text-orange-500 border-[rgba(251,146,60,0.2)]'
                                        : item.type === 'in' ? 'bg-[rgba(52,211,153,0.1)] text-emerald-500 border-[rgba(52,211,153,0.2)]'
                                          : 'bg-[rgba(201,168,76,0.1)] text-[#c9a84c] border-[rgba(201,168,76,0.18)]'
                                  }`}>
                                  {item._itemType === 'processing' ? item.type : item.type}
                                </span>
                              </div>
                              <p className="text-xs text-[#8a95a8] font-bold flex items-center gap-1.5">
                                {new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                {item._itemType === 'processing' && item.memo_no && <><span className="w-1 h-1 rounded-full bg-[#4a5568]"></span><span className="uppercase text-[9px] tracking-wider">{item.memo_no}</span></>}
                                {item._itemType === 'processing' && item.process_type && <><span className="w-1 h-1 rounded-full bg-[#4a5568]"></span><span className="uppercase text-[9px] tracking-wider">{item.process_type}</span></>}
                                {item.method && <span className="w-1 h-1 rounded-full bg-[#4a5568]"></span>}
                                {item.method && <span className="uppercase text-[9px] tracking-wider">{item.method.replace(/_/g, ' ')}</span>}
                              </p>
                            </div>
                          </div>
                          <div className="text-left pl-[4.5rem] sm:pl-0 sm:text-right">
                            {item._itemType === 'processing' ? (
                              <>
                                <p className={`font-black text-lg sm:text-xl font-mono ${item.type === 'received' ? 'text-emerald-500' : 'text-orange-400'}`}>
                                  {Number(item.quantity).toLocaleString()} <span className="text-xs text-[#8a95a8]">{(item.products as any)?.unit || 'u'}</span>
                                </p>
                                {item.total_cost > 0 && <p className="text-xs text-[#8a95a8] font-bold mt-1">৳ {Number(item.total_cost).toLocaleString()}</p>}
                              </>
                            ) : (
                              <>
                                <p className={`font-black text-lg sm:text-xl font-mono ${item._itemType === 'payment' ? 'text-emerald-500' : 'text-[#e8eaf0]'} transition-colors`}>
                                  {item._itemType === 'payment' ? '+' : ''}৳ {Number(item.total || item.amount).toLocaleString()}
                                </p>
                                {item._itemType === 'invoice' && item.payment_status && (
                                  <p className={`text-[9px] font-black uppercase tracking-widest mt-2 inline-flex border ${item.payment_status === 'paid' ? 'text-emerald-500 border-[rgba(52,211,153,0.3)] bg-[rgba(52,211,153,0.1)] px-2 py-0.5 rounded' : item.payment_status === 'partial' ? 'text-orange-500 border-[rgba(251,146,60,0.3)] bg-[rgba(251,146,60,0.1)] px-2 py-0.5 rounded' : 'text-rose-500 border-[rgba(244,63,94,0.3)] bg-[rgba(244,63,94,0.1)] px-2 py-0.5 rounded'}`}>
                                    {item.payment_status}
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-20 bg-[#131929] rounded-3xl border-2 border-dashed border-[rgba(255,255,255,0.06)]">
                      <div className="w-16 h-16 rounded-full bg-[#1a2235] flex items-center justify-center mx-auto mb-4 border border-[rgba(201,168,76,0.18)]">
                        <Activity className="w-8 h-8 text-[#4a5568]" />
                      </div>
                      <h3 className="font-black text-[#e8eaf0] text-lg uppercase tracking-wider">No Len Den Yet</h3>
                      <p className="text-xs text-[#8a95a8] mt-2 max-w-sm mx-auto font-medium">This contact doesn't have any recorded invoices or payments in the system history.</p>
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