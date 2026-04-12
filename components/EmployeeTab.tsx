import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, Mail, FileText, Upload, User, Eye, Pencil, X, Search, Briefcase, Phone, DollarSign, DownloadCloud, Calendar, MessageSquare, MapPin, Hash, LayoutGrid, List } from 'lucide-react';

interface EmployeeTabProps {
  employees: any[];
  fetchEmployees: () => Promise<void>;
  handleDelete: (table: string, id: string) => Promise<void>;
}

export default function EmployeeTab({ employees, fetchEmployees, handleDelete }: EmployeeTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('card');
  const [viewingEmployee, setViewingEmployee] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const [empData, setEmpData] = useState({
    name: '', role: '', salary: 0, phone: '', whatsapp: '', email: '', dob: '', address: '',
    id_document_type: 'NID', id_document_number: '', profile_image_url: '', id_photo_urls: [] as string[],
    phone_numbers: [{ number: '', is_whatsapp: false, is_imo: false, is_telegram: false }],
    daily_allowance: 0, monthly_allowance: 0,
    is_authorizer: false
  });

  const parsePhones = (phoneStr: string, whatsappStr: string = '') => {
    if (phoneStr && phoneStr.startsWith('[')) {
      try { return JSON.parse(phoneStr); } catch(e){}
    }
    if (phoneStr || whatsappStr) {
      return [{ number: phoneStr, is_whatsapp: !!whatsappStr, is_imo: false, is_telegram: false }];
    }
    return [];
  };

  const [idPhotoFiles, setIdPhotoFiles] = useState<File[]>([]);
  const [idPhotoPreviews, setIdPhotoPreviews] = useState<string[]>([]);

  // Extract unique roles for the filter dropdown
  const uniqueRoles = useMemo(() => Array.from(new Set(employees.map(e => e.role).filter(Boolean))), [employees]);

  // Filter employees
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const phones = parsePhones(emp.phone, emp.whatsapp);
      const matchesPhone = phones.some((p: any) => p.number.includes(searchQuery));
      const matchesSearch = emp.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            emp.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            matchesPhone;
      const matchesRole = roleFilter ? emp.role === roleFilter : true;
      return matchesSearch && matchesRole;
    });
  }, [employees, searchQuery, roleFilter]);

  const uploadFile = async (file: File, bucket: string, folder: string): Promise<string> => {
    const path = `${folder}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  const handleIdImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      const totalImages = idPhotoFiles.length + filesArray.length;
      
      if (totalImages > 5) {
        alert('You can only upload a maximum of 5 ID images.');
        return;
      }
      
      setIdPhotoFiles(prev => [...prev, ...filesArray]);
      const newPreviews = filesArray.map(file => URL.createObjectURL(file));
      setIdPhotoPreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const removeIdImage = (index: number) => {
    setIdPhotoFiles(prev => prev.filter((_, i) => i !== index));
    setIdPhotoPreviews(prev => prev.filter((_, i) => i !== index));
    if (empData.id_photo_urls[index]) {
      setEmpData(prev => ({
        ...prev,
        id_photo_urls: prev.id_photo_urls.filter((_, i) => i !== index)
      }));
    }
  };

  const uploadIdImagesToSupabase = async (): Promise<string[]> => {
    const uploadedUrls: string[] = [...empData.id_photo_urls];
    for (const file of idPhotoFiles) {
      const path = `documents/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
      const { error } = await supabase.storage.from('employee-files').upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from('employee-files').getPublicUrl(path);
        uploadedUrls.push(data.publicUrl);
      }
    }
    return uploadedUrls;
  };

  const handleEmpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let profileImageUrl = empData.profile_image_url;
      if (profileImageFile) profileImageUrl = await uploadFile(profileImageFile, 'employee-files', 'profiles');
      
      const finalIdUrls = idPhotoFiles.length > 0 ? await uploadIdImagesToSupabase() : empData.id_photo_urls;

      const payload = { ...empData, profile_image_url: profileImageUrl, id_photo_urls: finalIdUrls, phone: JSON.stringify(empData.phone_numbers), whatsapp: '' };
      delete (payload as any).phone_numbers;

      if (editingId) {
        const { error } = await supabase.from('employees').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('employees').insert(payload);
        if (error) throw error;
      }
      resetEmpForm();
      fetchEmployees();
    } catch (error) {
      console.error(error);
      alert('Failed to save employee. Check console for details.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetEmpForm = () => {
    setShowForm(false);
    setEditingId(null);
    setEmpData({ name: '', role: '', salary: 0, phone: '', whatsapp: '', email: '', dob: '', address: '', id_document_type: 'NID', id_document_number: '', profile_image_url: '', id_photo_urls: [], phone_numbers: [{ number: '', is_whatsapp: false, is_imo: false, is_telegram: false }], daily_allowance: 0, monthly_allowance: 0, is_authorizer: false });
    setProfilePreview(null);
    setProfileImageFile(null);
    setIdPhotoFiles([]);
    setIdPhotoPreviews([]);
  };

  const handleEdit = (emp: any) => {
    let parsedPhone = [{ number: '', is_whatsapp: false, is_imo: false, is_telegram: false }];
    if (emp.phone && emp.phone.startsWith('[')) {
      try { parsedPhone = JSON.parse(emp.phone); } catch(e){}
    } else if (emp.phone) {
      parsedPhone = [{ number: emp.phone, is_whatsapp: !!emp.whatsapp, is_imo: false, is_telegram: false }];
    }

    setEmpData({
      name: emp.name,
      role: emp.role,
      salary: emp.salary,
      phone: '',
      whatsapp: '',
      email: emp.email || '',
      dob: emp.dob || '',
      address: emp.address || '',
      id_document_type: emp.id_document_type || 'NID',
      id_document_number: emp.id_document_number || '',
      profile_image_url: emp.profile_image_url || '',
      id_photo_urls: emp.id_photo_urls || [],
      phone_numbers: parsedPhone,
      daily_allowance: emp.daily_allowance || 0,
      monthly_allowance: emp.monthly_allowance || 0,
      is_authorizer: emp.is_authorizer || false
    });
    setProfilePreview(emp.profile_image_url || null);
    setIdPhotoPreviews(emp.id_photo_urls || []);
    setIdPhotoFiles([]);
    setEditingId(emp.id);
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <h1 className="text-2xl font-bold text-gray-900 leading-tight">Employee Directory</h1>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* Search bar */}
          <div className="relative flex-grow sm:min-w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search employees..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
            />
          </div>

          {/* Role Filter */}
          <select 
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm bg-white"
          >
            <option value="">All Roles</option>
            {uniqueRoles.map((role, idx) => (
              <option key={idx} value={role}>{role}</option>
            ))}
          </select>

          <div className="bg-white border border-gray-200 rounded-lg p-1 flex items-center shadow-sm">
            <button 
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'card' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
              title="Card View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => { resetEmpForm(); setShowForm(true); }}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors shadow-md font-semibold"
          >
            <Plus className="w-4 h-4" /> Add Employee
          </button>
        </div>
      </div>

      {/* Employee Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4 overflow-y-auto w-full">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col my-auto max-h-[95vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-white sticky top-0 z-10 w-full">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{editingId ? 'Edit Employee Profile' : 'Register New Employee'}</h2>
                <p className="text-sm text-gray-500 mt-1">{editingId ? 'Update employee details and documents below.' : 'Fill out the details to add a new employee to the directory.'}</p>
              </div>
              <button type="button" onClick={resetEmpForm} className="text-gray-400 hover:text-gray-700 transition-colors bg-gray-50 hover:bg-gray-100 p-2 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="overflow-y-auto p-6 w-full">
              <form id="emp-form" onSubmit={handleEmpSubmit} className="flex flex-col gap-6 w-full">
                <div className="flex flex-col md:flex-row gap-8 w-full">
                  {/* Profile picture */}
                  <div className="flex flex-col items-center justify-start w-full md:w-1/3 space-y-4">
                    <div className="w-40 h-40 rounded-2xl bg-gray-50 flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300 relative shadow-inner group">
                      {profilePreview ? (
                        <img src={profilePreview} alt="Preview" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      ) : (
                        <div className="flex flex-col items-center text-gray-400">
                          <User className="w-12 h-12 mb-2" />
                          <span className="text-xs font-semibold">No Image</span>
                        </div>
                      )}
                      <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        <Upload className="w-8 h-8 text-white" />
                        <input type="file" className="hidden" accept="image/*" onChange={e => {
                          if (e.target.files?.[0]) { setProfileImageFile(e.target.files[0]); setProfilePreview(URL.createObjectURL(e.target.files[0])); }
                        }} />
                      </label>
                    </div>
                    <label className="text-blue-600 bg-blue-50 px-4 py-2 rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-100 transition-colors border border-blue-100 shadow-sm w-full text-center">
                      Change Photo
                      <input type="file" className="hidden" accept="image/*" onChange={e => {
                        if (e.target.files?.[0]) { setProfileImageFile(e.target.files[0]); setProfilePreview(URL.createObjectURL(e.target.files[0])); }
                      }} />
                    </label>
                  </div>

                  {/* Details grid */}
                  <div className="w-full md:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5 pl-1">Full Name</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input required type="text" placeholder="John Doe" value={empData.name} onChange={e => setEmpData({ ...empData, name: e.target.value })} className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5 pl-1">Date of Birth</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input type="date" value={empData.dob} onChange={e => setEmpData({ ...empData, dob: e.target.value })} className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5 pl-1">Job Role</label>
                      <div className="relative">
                        <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <select required value={empData.role} onChange={e => setEmpData({ ...empData, role: e.target.value })} className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all appearance-none bg-white">
                          <option value="" disabled>Select Job Role</option>
                          <option value="Manager">Manager</option>
                          <option value="Admin">Admin</option>
                          <option value="Sales Representative">Sales Representative</option>
                          <option value="Accountant">Accountant</option>
                          <option value="Operations">Operations</option>
                          <option value="Delivery Personnel">Delivery Personnel</option>
                          <option value="Factory Worker">Factory Worker</option>
                          <option value="Processor">Processor</option>
                          <option value="Support Staff">Support Staff</option>
                          <option value="Driver">Driver</option>
                          <option value="Labor">Labor</option>
                          <option value="Other">Other</option>
                          {empData.role && !['Manager', 'Admin', 'Sales Representative', 'Accountant', 'Operations', 'Delivery Personnel', 'Factory Worker', 'Processor', 'Support Staff', 'Driver', 'Labor', 'Other'].includes(empData.role) && (
                            <option value={empData.role}>{empData.role} (Legacy)</option>
                          )}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5 pl-1">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input required type="email" placeholder="john@example.com" value={empData.email} onChange={e => setEmpData({ ...empData, email: e.target.value })} className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                       <div className="flex items-center justify-between mb-2">
                         <label className="flex items-center gap-2 text-sm font-bold text-gray-700 ml-1">
                           <Phone className="w-4 h-4 text-blue-500" /> Phone Numbers
                         </label>
                         <button type="button" onClick={() => setEmpData({...empData, phone_numbers: [...empData.phone_numbers, { number: '', is_whatsapp: false, is_imo: false, is_telegram: false }]})} className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors">
                           + Add Phone Number
                         </button>
                       </div>
                       
                       <div className="space-y-3">
                         {empData.phone_numbers.map((pn, idx) => (
                           <div key={idx} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-gray-50 border border-gray-200 p-3 rounded-lg">
                             <input required type="text" value={pn.number} onChange={e => {
                               const newPn = [...empData.phone_numbers];
                               newPn[idx].number = e.target.value;
                               setEmpData({...empData, phone_numbers: newPn});
                             }} className="flex-1 w-full border border-gray-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. +8801..." />
                             
                             <div className="flex items-center gap-4 shrink-0">
                               <label className="flex items-center gap-1.5 cursor-pointer hover:bg-white px-2 py-1 rounded transition border border-transparent hover:border-gray-200 shadow-sm">
                                 <input type="checkbox" checked={pn.is_whatsapp} onChange={e => {
                                   const newPn = [...empData.phone_numbers];
                                   newPn[idx].is_whatsapp = e.target.checked;
                                   setEmpData({...empData, phone_numbers: newPn});
                                 }} className="w-4 h-4 text-green-500 rounded border-gray-300 focus:ring-green-500" />
                                 <span className="text-xs font-bold text-gray-600">WhatsApp</span>
                               </label>
                               <label className="flex items-center gap-1.5 cursor-pointer hover:bg-white px-2 py-1 rounded transition border border-transparent hover:border-gray-200 shadow-sm">
                                 <input type="checkbox" checked={pn.is_imo} onChange={e => {
                                   const newPn = [...empData.phone_numbers];
                                   newPn[idx].is_imo = e.target.checked;
                                   setEmpData({...empData, phone_numbers: newPn});
                                 }} className="w-4 h-4 text-indigo-500 rounded border-gray-300 focus:ring-indigo-500" />
                                 <span className="text-xs font-bold text-gray-600">imo</span>
                               </label>
                               <label className="flex items-center gap-1.5 cursor-pointer hover:bg-white px-2 py-1 rounded transition border border-transparent hover:border-gray-200 shadow-sm">
                                 <input type="checkbox" checked={pn.is_telegram} onChange={e => {
                                   const newPn = [...empData.phone_numbers];
                                   newPn[idx].is_telegram = e.target.checked;
                                   setEmpData({...empData, phone_numbers: newPn});
                                 }} className="w-4 h-4 text-blue-500 rounded border-gray-300 focus:ring-blue-500" />
                                 <span className="text-xs font-bold text-gray-600">Telegram</span>
                               </label>
                             </div>
                             
                             {empData.phone_numbers.length > 1 && (
                               <button type="button" onClick={() => {
                                 const newPn = empData.phone_numbers.filter((_, i) => i !== idx);
                                 setEmpData({...empData, phone_numbers: newPn});
                               }} className="text-red-400 hover:text-red-600 p-1.5 shrink-0 bg-white border border-gray-200 rounded-lg hover:border-red-200 hover:bg-red-50">
                                 <X className="w-4 h-4" />
                               </button>
                             )}
                           </div>
                         ))}
                       </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5 pl-1">Salary</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input required type="number" placeholder="0.00" value={empData.salary} onChange={e => setEmpData({ ...empData, salary: Number(e.target.value) })} className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5 pl-1">Daily Allowance</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input type="number" placeholder="0.00" value={empData.daily_allowance || ''} onChange={e => setEmpData({ ...empData, daily_allowance: Number(e.target.value) })} className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-yellow-50/30" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5 pl-1">Monthly Allowance</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input type="number" placeholder="0.00" value={empData.monthly_allowance || ''} onChange={e => setEmpData({ ...empData, monthly_allowance: Number(e.target.value) })} className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-green-50/30" />
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="flex items-center gap-3 cursor-pointer p-3 border border-gray-200 rounded-lg bg-gray-50 hover:bg-white transition-colors mb-2">
                        <input type="checkbox" checked={empData.is_authorizer} onChange={e => setEmpData({ ...empData, is_authorizer: e.target.checked })} className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-gray-800">Assign as Authorizer</span>
                          <span className="text-xs text-gray-500">Check this if the employee should appear in signature dropdowns.</span>
                        </div>
                      </label>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-bold text-gray-700 mb-1.5 pl-1">Address</label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input type="text" placeholder="Full Address" value={empData.address} onChange={e => setEmpData({ ...empData, address: e.target.value })} className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5 pl-1">ID Document Type</label>
                      <div className="relative">
                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <select value={empData.id_document_type} onChange={e => setEmpData({ ...empData, id_document_type: e.target.value })} className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all appearance-none bg-white">
                          <option value="NID">National ID (NID)</option>
                          <option value="Driving License">Driving License</option>
                          <option value="Passport">Passport</option>
                          <option value="Birth Certificate">Birth Certificate</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5 pl-1">{empData.id_document_type} Number</label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input type="text" placeholder="Document Number" value={empData.id_document_number} onChange={e => setEmpData({ ...empData, id_document_number: e.target.value })} className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-5 rounded-xl border border-gray-200/60 w-full mb-4">
                  <label className="block text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                    {empData.id_document_type} Document Photos (Max 5)
                  </label>
                  <div className="flex flex-wrap gap-4 items-start pb-2">
                    {idPhotoPreviews.map((src, idx) => (
                      <div key={idx} className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-300 shadow-sm group">
                        <img src={src} alt="preview" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => removeIdImage(idx)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {idPhotoPreviews.length < 5 && (
                      <label className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors text-gray-500 hover:text-blue-600 bg-white shadow-sm">
                        <Upload className="w-6 h-6 mb-1" />
                        <span className="text-xs font-semibold">Upload</span>
                        <input type="file" multiple accept="image/*" className="hidden" onChange={handleIdImageChange} />
                      </label>
                    )}
                  </div>
                </div>
              </form>
            </div>
            
            <div className="flex gap-3 items-center justify-end p-6 border-t border-gray-100 bg-white sticky bottom-0 z-10 w-full rounded-b-2xl">
              <button type="button" onClick={resetEmpForm} className="bg-gray-50 text-gray-700 px-6 py-2.5 font-bold rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 shadow-sm">
                Cancel
              </button>
              <button form="emp-form" type="submit" disabled={submitting} className="bg-blue-600 text-white px-8 py-2.5 font-bold rounded-lg hover:bg-blue-700 hover:shadow-lg transition-all shadow-md disabled:opacity-70 flex items-center gap-2">
                {submitting ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Saving...</>
                ) : editingId ? (
                  'Update Employee'
                ) : (
                  'Save Employee'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Employee Data Display */}
      {viewMode === 'table' ? (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-500">
              <tr>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Employee</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Role</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Contact</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Salary</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      <User className="w-12 h-12 mb-3 text-gray-300" />
                      <p className="text-base font-semibold text-gray-600">No employees found</p>
                      <p className="text-sm mt-1">Try adjusting your filters or add a new employee.</p>
                      <button onClick={() => { resetEmpForm(); setShowForm(true); }} className="mt-4 text-blue-600 font-semibold text-sm hover:underline">
                        + Add New Employee
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredEmployees.map(e => (
                  <tr key={e.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200 flex-shrink-0">
                          {e.profile_image_url ? (
                            <img src={e.profile_image_url} alt={e.name} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 group-hover:text-blue-700 transition-colors">{e.name}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Mail className="w-3 h-3" /> {e.email || 'No email'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {e.role || 'Unassigned'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                        {(() => {
                           const phones = parsePhones(e.phone, e.whatsapp);
                           if (phones.length === 0) return <span className="text-gray-400 italic">Not provided</span>;
                           return phones.map((pn: any, i: number) => (
                              <div key={i} className="flex items-center gap-2">
                                <Phone className="w-3 h-3 text-gray-400 shrink-0" />
                                <span>{pn.number}</span>
                                <div className="flex gap-1">
                                  {pn.is_whatsapp && <span className="text-[9px] text-green-600 font-bold bg-green-50 px-1 rounded-sm">WA</span>}
                                  {pn.is_imo && <span className="text-[9px] text-indigo-600 font-bold bg-indigo-50 px-1 rounded-sm">imo</span>}
                                  {pn.is_telegram && <span className="text-[9px] text-blue-600 font-bold bg-blue-50 px-1 rounded-sm">TG</span>}
                                </div>
                              </div>
                           ));
                        })()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-gray-900">
                        <span className="text-base font-bold mr-0.5">৳</span>{Number(e.salary || 0).toLocaleString()} <span className="text-xs font-normal text-gray-500">/mo</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2 items-center justify-end">
                        <button onClick={() => setViewingEmployee(e)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all" title="View Details">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleEdit(e)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-all" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => { if(window.confirm('Are you sure you want to remove this employee?')) handleDelete('employees', e.id); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
         {filteredEmployees.map(e => (
            <div key={e.id} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col hover:shadow-xl hover:shadow-blue-500/5 transition-all hover:-translate-y-1 relative group">
               <div className="flex justify-between items-start mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center overflow-hidden border border-blue-100/50 shadow-inner shrink-0 relative">
                     {e.profile_image_url ? (
                        <img src={e.profile_image_url} alt={e.name} className="w-full h-full object-cover" />
                     ) : (
                        <User className="w-8 h-8 text-blue-300" />
                     )}
                     {e.is_authorizer && (
                        <div className="absolute top-0 right-0 bg-yellow-400 w-3 h-3 rounded-bl-lg shadow-sm" title="Authorizer"></div>
                     )}
                  </div>
                  <div className="flex flex-col gap-1 -mt-2 -mr-2">
                     <button onClick={() => setViewingEmployee(e)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors" title="View Profile">
                       <Eye className="w-5 h-5" />
                     </button>
                  </div>
               </div>
               
               <div className="mb-4">
                  <h3 className="font-extrabold text-gray-900 text-lg leading-tight line-clamp-1">{e.name}</h3>
                  <span className="inline-flex items-center mt-1.5 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 uppercase tracking-wide">
                     {e.role || 'Unassigned'}
                  </span>
               </div>
               
               <div className="flex-1 space-y-3 mb-5 border-t border-gray-100 pt-4">
                  {(() => {
                     const phones = parsePhones(e.phone, e.whatsapp);
                     if (phones.length > 0) {
                        return (
                           <div className="flex items-center justify-between gap-2 overflow-hidden bg-gray-50 rounded-lg p-2 border border-gray-100">
                             <span className="flex items-center gap-2 text-gray-800 font-bold text-sm truncate"><Phone className="w-3.5 h-3.5 text-blue-500 shrink-0" /> {phones[0].number}</span>
                             <div className="flex gap-1 shrink-0">
                               {phones[0].is_whatsapp && <span className="text-[9px] font-extrabold text-green-600 bg-green-100 px-1 py-0.5 rounded">WA</span>}
                               {phones[0].is_imo && <span className="text-[9px] font-extrabold text-indigo-600 bg-indigo-100 px-1 py-0.5 rounded">imo</span>}
                               {phones[0].is_telegram && <span className="text-[9px] font-extrabold text-blue-600 bg-blue-100 px-1 py-0.5 rounded">TG</span>}
                             </div>
                           </div>
                        )
                     }
                     return <div className="text-gray-400 italic text-sm p-2">No phone number</div>
                  })()}
                  
                  <span className="flex items-center gap-2.5 text-sm text-gray-600 font-medium px-1 truncate"><Mail className="w-4 h-4 text-orange-400 shrink-0" /> {e.email || 'No email'}</span>
               </div>

               <div className="pt-4 border-t border-gray-100 flex items-center justify-between relative z-10 bg-white">
                  <div>
                     <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Base Salary</p>
                     <p className="font-extrabold text-gray-900"><span className="mr-0.5 text-sm text-gray-600">৳</span>{Number(e.salary || 0).toLocaleString()} <span className="text-xs font-medium text-gray-500">/mo</span></p>
                  </div>
                  
                  <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button onClick={() => handleEdit(e)} className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100" title="Edit">
                       <Pencil className="w-4 h-4" />
                     </button>
                     <button onClick={() => { if(window.confirm('Are you sure you want to remove this employee?')) handleDelete('employees', e.id); }} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100" title="Delete">
                       <Trash2 className="w-4 h-4" />
                     </button>
                  </div>
               </div>
            </div>
         ))}
         
         {filteredEmployees.length === 0 && (
            <div className="col-span-full py-20 text-center bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-200">
               <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-100">
                  <User className="w-10 h-10 text-gray-300" />
               </div>
               <h3 className="text-xl font-extrabold text-gray-900 mb-2">No Employees Found</h3>
               <p className="text-gray-500 font-medium">Clear filters or add a new employee to update your directory.</p>
            </div>
         )}
      </div>
      )}

      {/* View Profile Modal */}
      {viewingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 w-full">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="h-24 bg-gradient-to-r from-blue-600 to-indigo-600 relative">
              <button onClick={() => setViewingEmployee(null)} className="absolute top-4 right-4 text-white hover:text-red-300 bg-black/20 hover:bg-black/30 p-1.5 rounded-full transition-colors backdrop-blur-sm"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="px-6 pb-6 pt-0 relative">
              <div className="flex flex-col items-center -mt-12 mb-5">
                <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center overflow-hidden border-4 border-white shadow-md">
                  {viewingEmployee.profile_image_url ? (
                    <img src={viewingEmployee.profile_image_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                      <User className="w-10 h-10 text-gray-400" />
                    </div>
                  )}
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mt-2 text-center">{viewingEmployee.name}</h3>
                <span className="text-sm font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full mt-1.5 border border-blue-100">{viewingEmployee.role}</span>
              </div>
              
              <div className="space-y-4 bg-gray-50 p-5 rounded-xl border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm flex-shrink-0 text-gray-400">
                    <Calendar className="w-4 h-4 text-orange-500" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Date of Birth</p>
                    <p className="font-semibold text-gray-900 truncate">{viewingEmployee.dob || 'Not provided'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm flex-shrink-0 text-gray-400">
                    <Mail className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Email Address</p>
                    <p className="font-semibold text-gray-900 truncate">{viewingEmployee.email || 'N/A'}</p>
                  </div>
                </div>
                
                <div className="flex flex-col gap-2">
                   <p className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1 mb-1">Contact Numbers</p>
                   {parsePhones(viewingEmployee.phone, viewingEmployee.whatsapp).length > 0 ? (
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                       {parsePhones(viewingEmployee.phone, viewingEmployee.whatsapp).map((pn: any, i: number) => (
                         <div key={i} className="flex items-center justify-between gap-3 bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                           <div className="flex items-center gap-2">
                             <Phone className="w-4 h-4 text-gray-400" />
                             <span className="font-semibold text-sm text-gray-900">{pn.number}</span>
                           </div>
                           <div className="flex gap-1.5">
                             {pn.is_whatsapp && <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">WA</span>}
                             {pn.is_imo && <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">imo</span>}
                             {pn.is_telegram && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">TG</span>}
                           </div>
                         </div>
                       ))}
                     </div>
                   ) : (
                     <span className="text-gray-400 text-sm italic pl-1">No contact number provided</span>
                   )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm flex-shrink-0 text-gray-400">
                    <MapPin className="w-4 h-4 text-red-500" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Address</p>
                    <p className="font-semibold text-gray-900 truncate" title={viewingEmployee.address}>{viewingEmployee.address || 'N/A'}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm flex-shrink-0 text-gray-400">
                    <DollarSign className="w-4 h-4 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Base Salary</p>
                    <p className="font-semibold text-gray-900"><span className="text-lg font-bold mr-0.5">৳</span>{Number(viewingEmployee.salary || 0).toLocaleString()} <span className="text-xs font-normal text-gray-500">/ month</span></p>
                  </div>
                </div>
                
                <div className="flex flex-col gap-2 pt-2 border-t border-gray-200">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    ID Document ({viewingEmployee.id_document_type || 'NID'} {viewingEmployee.id_document_number ? `- ${viewingEmployee.id_document_number}` : ''})
                  </p>
                  {viewingEmployee.id_photo_urls && viewingEmployee.id_photo_urls.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                       {viewingEmployee.id_photo_urls.map((url: string, i: number) => (
                         <a key={i} href={url} target="_blank" rel="noreferrer" className="w-14 h-14 rounded-lg overflow-hidden border border-gray-300 hover:border-blue-500 transition-colors shadow-sm block">
                           <img src={url} alt={`ID ${i+1}`} className="w-full h-full object-cover" />
                         </a>
                       ))}
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-gray-400 italic">No documents uploaded.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
