'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, Wallet, Building2, X } from 'lucide-react';

export default function AccountsPage() {
  const [internalAccounts, setInternalAccounts] = useState<any[]>([]);
  const [showAccountForm, setShowAccountForm] = useState(false);

  const [accountData, setAccountData] = useState({
    account_type: 'wallet', provider_name: '', account_name: '', account_number: '', branch: ''
  });

  useEffect(() => {
    fetchInternalAccounts();
  }, []);

  const fetchInternalAccounts = async () => {
    const { data } = await supabase.from('internal_accounts').select('*').order('created_at', { ascending: false });
    setInternalAccounts(data ?? []);
  };

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('internal_accounts').insert(accountData);
    if (!error) {
      setShowAccountForm(false);
      setAccountData({ account_type: 'wallet', provider_name: '', account_name: '', account_number: '', branch: '' });
      fetchInternalAccounts();
    } else {
      alert('Error saving account. Ensure you updated the database schema.');
    }
  };

  const handleDelete = async (table: string, id: string) => {
    if(!window.confirm('Are you sure you want to delete this record?')) return;
    await supabase.from(table).delete().eq('id', id);
    fetchInternalAccounts();
  };

  return (
    <div className="pb-10 font-sans animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-gradient-to-r from-emerald-900 to-teal-900 p-8 rounded-3xl text-white shadow-lg relative overflow-hidden mb-8">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white opacity-5 blur-3xl pointer-events-none"></div>
        <div className="relative z-10">
          <p className="text-teal-200 font-medium mb-1 text-sm tracking-widest uppercase flex items-center gap-2">
            <Wallet className="w-4 h-4" /> Company Assets
          </p>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">My Internal Accounts</h1>
          <p className="text-teal-100 max-w-xl text-sm md:text-base">
            Securely manage and track your business bank and mobile wallet accounts.
          </p>
        </div>
      </div>

      <div className="space-y-6">
         <div className="flex justify-between items-center mb-4">
            <div>
               <h2 className="text-xl font-bold text-gray-800">My Saved Accounts</h2>
               <p className="text-sm text-gray-500 font-medium">Manage your internal company bank and mobile wallet accounts.</p>
            </div>
            <button onClick={() => setShowAccountForm(!showAccountForm)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-sm transition-all focus:ring-2 focus:ring-indigo-500">
              {showAccountForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              {showAccountForm ? 'Cancel' : 'Add Account'}
            </button>
         </div>

         {showAccountForm && (
            <form onSubmit={handleAccountSubmit} className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-5 animate-in slide-in-from-top-4 duration-300">
               <div className="md:col-span-2 pb-3 border-b border-gray-100 mb-2">
                  <h3 className="font-bold text-lg text-gray-900">New Account Details</h3>
               </div>

               <div className="md:col-span-2 flex gap-3 pb-2">
                  <button type="button" onClick={() => setAccountData({...accountData, account_type: 'wallet'})} className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all border ${accountData.account_type === 'wallet' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100'}`}>
                     <Wallet className={`w-5 h-5 ${accountData.account_type === 'wallet' ? 'text-indigo-500' : 'text-gray-400'}`} />
                     Mobile Wallet
                  </button>
                  <button type="button" onClick={() => setAccountData({...accountData, account_type: 'bank'})} className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all border ${accountData.account_type === 'bank' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100'}`}>
                     <Building2 className={`w-5 h-5 ${accountData.account_type === 'bank' ? 'text-indigo-500' : 'text-gray-400'}`} />
                     Bank Account
                  </button>
               </div>

               {accountData.account_type === 'wallet' ? (
                  <>
                     <div className="md:col-span-2 border-t border-gray-100 pt-3 pb-1">
                        <label className="block text-sm font-bold text-gray-700 mb-2">Select Wallet</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                           {['Bikash', 'Nagad', 'Rocket', 'Upay'].map(wallet => (
                              <label key={wallet} className={`cursor-pointer w-full text-center py-2.5 px-3 rounded-xl font-bold transition-all border shadow-sm ${accountData.provider_name === wallet ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                 <input type="radio" required name="walletProvider" value={wallet} className="hidden" checked={accountData.provider_name === wallet} onChange={e => setAccountData({...accountData, provider_name: e.target.value})} />
                                 {wallet}
                              </label>
                           ))}
                        </div>
                     </div>
                     <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">Wallet Name (Optional)</label>
                        <input type="text" placeholder="e.g. John Doe" value={accountData.account_name} onChange={e => setAccountData({...accountData, account_name: e.target.value})} className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-gray-900" />
                     </div>
                     <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">Wallet Number</label>
                        <input required type="text" placeholder="e.g. 017..." value={accountData.account_number} onChange={e => setAccountData({...accountData, account_number: e.target.value})} className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-gray-900 font-mono" />
                     </div>
                  </>
               ) : (
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-gray-100 pt-3">
                     <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">Bank Name</label>
                        <input required type="text" placeholder="e.g. City Bank" value={accountData.provider_name} onChange={e => setAccountData({...accountData, provider_name: e.target.value})} className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-gray-900" />
                     </div>
                     <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">Bank Account Name</label>
                        <input required type="text" placeholder="e.g. John Doe" value={accountData.account_name} onChange={e => setAccountData({...accountData, account_name: e.target.value})} className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-gray-900" />
                     </div>
                     <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">Account Number</label>
                        <input required type="text" placeholder="e.g. 017..." value={accountData.account_number} onChange={e => setAccountData({...accountData, account_number: e.target.value})} className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-gray-900 font-mono" />
                     </div>
                     <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">Branch</label>
                        <input required type="text" placeholder="e.g. Gulshan Branch" value={accountData.branch} onChange={e => setAccountData({...accountData, branch: e.target.value})} className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-gray-900" />
                     </div>
                  </div>
               )}

               <div className="md:col-span-2 flex justify-end pt-3 mt-2 border-t border-gray-100">
                  <button type="submit" className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-md transition-all">Save Account</button>
               </div>
            </form>
         )}

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {internalAccounts.map(acc => (
               <div key={acc.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col relative overflow-hidden group">
                  {/* decorative bg */}
                  <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 transition-transform group-hover:scale-150 ${acc.account_type === 'wallet' ? 'bg-emerald-500' : 'bg-indigo-500'}`}></div>
                  
                  <div className="flex justify-between items-start mb-4 relative z-10">
                     <div className={`p-3 rounded-xl ${acc.account_type === 'wallet' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                        {acc.account_type === 'wallet' ? <Wallet className="w-6 h-6" /> : <Building2 className="w-6 h-6" />}
                     </div>
                     <button onClick={() => handleDelete('internal_accounts', acc.id)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  
                  <div className="relative z-10">
                     <h4 className="font-extrabold text-xl text-gray-900 mb-1">{acc.provider_name}</h4>
                     <p className="text-sm font-bold text-gray-500 tracking-wide font-mono uppercase border-b border-gray-100 pb-3 mb-3">{acc.account_number}</p>
                     
                     <div className="flex flex-col gap-1">
                        <span className="text-xs text-gray-400 font-bold uppercase">Account Name</span>
                        <span className="text-sm font-semibold text-gray-800">{acc.account_name}</span>
                     </div>
                     
                     {acc.branch && (
                        <div className="flex flex-col gap-1 mt-3">
                           <span className="text-xs text-gray-400 font-bold uppercase">Branch</span>
                           <span className="text-sm font-semibold text-gray-800">{acc.branch}</span>
                        </div>
                     )}
                  </div>
               </div>
            ))}
            {internalAccounts.length === 0 && (
               <div className="md:col-span-2 lg:col-span-3 text-center py-16 bg-gray-50 rounded-2xl border border-gray-200 border-dashed">
                  <Wallet className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="font-bold text-gray-600">No accounts saved yet.</p>
                  <p className="text-sm text-gray-500 mt-1">Add your company bank or wallet accounts securely.</p>
               </div>
            )}
         </div>
      </div>
    </div>
  );
}
