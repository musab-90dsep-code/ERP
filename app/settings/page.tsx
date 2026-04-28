'use client';

import { useState, Suspense } from 'react';
import {
  Store, Plus, CheckCircle, StoreIcon, AlertCircle, Package, Users,
  ReceiptText, CreditCard, Landmark, Wallet, ShoppingCart, Settings,
  Briefcase, LayoutDashboard, ArrowLeftRight, ChevronRight, Loader2,
  Building2, Sparkles, X
} from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import api from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────
interface ModuleType {
  key: string;
  label: string;
  icon: React.ElementType;
  desc: string;
}

interface Shop {
  id: string;
  name: string;
  modules: string[];
}

// ─── All available modules ───────────────────────────────────────────────────
const ALL_MODULES: ModuleType[] = [
  { key: 'dashboard',  label: 'Dashboard',      icon: LayoutDashboard, desc: 'Business overview & KPIs' },
  { key: 'inventory',  label: 'Inventory',      icon: Package,         desc: 'Products, raw materials, stock' },
  { key: 'invoices',   label: 'Invoices',       icon: ReceiptText,     desc: 'Buy & sell invoices, returns' },
  { key: 'contacts',   label: 'Contacts',       icon: Users,           desc: 'Customers, suppliers, processors' },
  { key: 'employees',  label: 'Employees',      icon: Briefcase,       desc: 'Staff, attendance, salary' },
  { key: 'orders',     label: 'Orders',         icon: ShoppingCart,    desc: 'Sales & purchase orders' },
  { key: 'processing', label: 'Processing',     icon: Settings,        desc: 'Material issued & received' },
  { key: 'expenses',   label: 'Daily Expenses', icon: CreditCard,      desc: 'Receipts & expense payments' },
  { key: 'payments',   label: 'Payments',       icon: Wallet,          desc: 'Cash in, cash out, add money' },
  { key: 'accounts',   label: 'Accounts',       icon: Landmark,        desc: 'Internal account ledger' },
  { key: 'finance',    label: 'Finance',        icon: Landmark,        desc: 'Cashbook, cheques & finance' },
];

// ─── Sidebar nav sections ─────────────────────────────────────────────────────
const NAV_SECTIONS = [
  {
    key: 'switch',
    label: 'Switch Shop',
    icon: ArrowLeftRight,
    desc: 'Switch between your shops',
  },
  {
    key: 'add',
    label: 'Add Shop',
    icon: Plus,
    desc: 'Create a new shop',
  },
];

// ─── Switch Tab ───────────────────────────────────────────────────────────────
function SwitchTab({
  shops,
  activeShopId,
  setActiveShopId,
}: {
  shops: Shop[];
  activeShopId: string | null;
  setActiveShopId: (id: string) => void;
}) {
  const router = useRouter();
  const [switching, setSwitching] = useState<string | null>(null);

  const handleSwitch = async (id: string) => {
    if (id === activeShopId) return;
    setSwitching(id);
    await new Promise(r => setTimeout(r, 400)); // subtle delay for feel
    setActiveShopId(id);
    setSwitching(null);
  };

  return (
    <div className="flex-1">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#c9a84c]/10 flex items-center justify-center">
            <ArrowLeftRight className="w-5 h-5 text-[#f0c040]" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">Switch Shop</h2>
            <p className="text-xs text-[#8a95a8]">Switch between your active shops</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-[#c9a84c]/20 to-transparent mt-4" />
      </div>

      {shops.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-2xl bg-[#c9a84c]/5 border border-[#c9a84c]/10 flex items-center justify-center mb-5">
            <AlertCircle className="w-9 h-9 text-[#8a95a8]/50" />
          </div>
          <p className="text-[#8a95a8] font-semibold text-base mb-1">No Shops Found</p>
          <p className="text-[#4a5568] text-sm mb-6">You haven't added any shops yet.</p>
          <button
            onClick={() => router.push('/settings?action=add')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#c9a84c]/10 hover:bg-[#c9a84c]/20 border border-[#c9a84c]/30 text-[#f0c040] font-semibold text-sm transition-all hover:scale-[1.03] active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Add Your First Shop
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {shops.map(shop => {
            const isActive = activeShopId === shop.id;
            const isLoading = switching === shop.id;
            return (
              <button
                key={shop.id}
                id={`shop-card-${shop.id}`}
                onClick={() => handleSwitch(shop.id)}
                disabled={isLoading}
                className={`relative text-left p-5 rounded-2xl border transition-all duration-300 group overflow-hidden ${
                  isActive
                    ? 'bg-gradient-to-br from-[#c9a84c]/20 via-[#f0c040]/8 to-[#c9a84c]/5 border-[#f0c040]/60 shadow-[0_0_24px_rgba(201,168,76,0.18)]'
                    : 'bg-[#0d1220] border-[#c9a84c]/10 hover:border-[#c9a84c]/40 hover:bg-[#131d30] hover:shadow-[0_4px_20px_rgba(0,0,0,.4)]'
                }`}
              >
                {/* Active glow bg */}
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#f0c040]/5 to-transparent pointer-events-none" />
                )}

                {/* Top row */}
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                    isActive ? 'bg-[#f0c040]/15' : 'bg-white/5 group-hover:bg-[#c9a84c]/10'
                  }`}>
                    {isLoading
                      ? <Loader2 className="w-5 h-5 text-[#f0c040] animate-spin" />
                      : <Building2 className={`w-5 h-5 ${isActive ? 'text-[#f0c040]' : 'text-[#8a95a8] group-hover:text-[#c9a84c]'}`} />
                    }
                  </div>
                  {isActive && (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#f0c040]/15 border border-[#f0c040]/30 text-[#f0c040] text-[10px] font-extrabold uppercase tracking-wider">
                      <CheckCircle className="w-3 h-3" />
                      Active
                    </span>
                  )}
                </div>

                {/* Shop name */}
                <h3 className={`font-extrabold text-base truncate mb-1 ${isActive ? 'text-white' : 'text-[#c8cdd7] group-hover:text-white'}`}>
                  {shop.name}
                </h3>

                {/* Module pills */}
                {shop.modules && shop.modules.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {shop.modules.slice(0, 4).map((m: string) => {
                      const mod = ALL_MODULES.find(x => x.key === m);
                      return mod ? (
                        <span key={m} className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#c9a84c]/10 text-[#c9a84c]/80 border border-[#c9a84c]/15">
                          {mod.label}
                        </span>
                      ) : null;
                    })}
                    {shop.modules.length > 4 && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-[#8a95a8]">
                        +{shop.modules.length - 4}
                      </span>
                    )}
                  </div>
                )}

                {/* Action hint */}
                <p className={`text-xs font-medium flex items-center gap-1 ${isActive ? 'text-[#f0c040]/70' : 'text-[#4a5568] group-hover:text-[#c9a84c]/70'}`}>
                  {isActive ? 'Currently Active' : (
                    <>
                      Click to switch
                      <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Add Tab ──────────────────────────────────────────────────────────────────
function AddTab({ refreshShops }: { refreshShops: () => void | Promise<void> }) {
  const [newShopName, setNewShopName] = useState('');
  const [selectedModules, setSelectedModules] = useState<string[]>(
    ALL_MODULES.map(m => m.key)
  );
  const [addingShop, setAddingShop] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');

  const toggleModule = (key: string) => {
    setSelectedModules(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleAddShop = async (e: React.FormEvent) => {
    e.preventDefault(); 
    if (!newShopName.trim()) { setError('Please enter a shop name.'); return; }
    if (selectedModules.length === 0) { setError('Please select at least one module.'); return; }
    
    setAddingShop(true);
    setSuccessMsg('');
    setError('');
    
    try {
      await api.createShop({ name: newShopName, modules: selectedModules });
      setNewShopName('');
      setSelectedModules(ALL_MODULES.map(m => m.key));
      setSuccessMsg(`"${newShopName}" added successfully!`);
      await refreshShops();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e) {
      console.error(e);
      setError('Failed to add shop. Please try again.');
    } finally {
      setAddingShop(false);
    }
  };

  return (
    <div className="flex-1 max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#c9a84c]/10 flex items-center justify-center">
            <Plus className="w-5 h-5 text-[#f0c040]" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">Add New Shop</h2>
            <p className="text-xs text-[#8a95a8]">Enter a name and select required modules</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-[#c9a84c]/20 to-transparent mt-4" />
      </div>

      {/* Success banner */}
      {successMsg && (
        <div className="mb-6 flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span className="font-semibold text-sm flex-1">{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="hover:opacity-70">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mb-6 flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="font-semibold text-sm flex-1">{error}</span>
          <button onClick={() => setError('')} className="hover:opacity-70">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <form onSubmit={handleAddShop} className="space-y-7">
        {/* Shop Name Input */}
        <div>
          <label htmlFor="new-shop-name" className="block text-xs font-bold text-[#8a95a8] uppercase tracking-widest mb-2">
            Shop Name
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <Building2 className="w-5 h-5 text-[#c9a84c]/50" />
            </div>
            <input
              id="new-shop-name"
              type="text"
              value={newShopName}
              onChange={e => { setNewShopName(e.target.value); setError(''); }}
              className="w-full bg-[#0d1220] border border-[#c9a84c]/20 text-white pl-12 pr-5 py-4 rounded-xl outline-none focus:border-[#c9a84c]/70 focus:ring-2 focus:ring-[#c9a84c]/15 transition-all text-base font-semibold placeholder:text-[#4a5568]"
              placeholder="e.g., Downtown Branch, Main Store..."
            />
          </div>
        </div>

        {/* Module Selection */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-bold text-[#8a95a8] uppercase tracking-widest">
              Select Modules / Sections
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedModules(ALL_MODULES.map(m => m.key))}
                className="text-xs font-bold text-[#c9a84c] hover:text-[#f0c040] transition-colors"
              >
                All
              </button>
              <span className="text-[#2a3348]">|</span>
              <button
                type="button"
                onClick={() => setSelectedModules([])}
                className="text-xs font-bold text-[#8a95a8] hover:text-white transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {ALL_MODULES.map(({ key, label, icon: Icon, desc }) => {
              const isSelected = selectedModules.includes(key);
              return (
                <button
                  key={key}
                  id={`module-toggle-${key}`}
                  type="button"
                  role="checkbox"
                  aria-checked={isSelected}
                  onClick={() => toggleModule(key)}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all duration-200 group ${
                    isSelected
                      ? 'bg-[#c9a84c]/10 border-[#c9a84c]/50 shadow-[0_0_12px_rgba(201,168,76,0.08)]'
                      : 'bg-[#0d1220] border-[#c9a84c]/8 hover:border-[#c9a84c]/25 hover:bg-[#111827]'
                  }`}
                >
                  {/* Custom checkbox */}
                  <div className={`w-4.5 h-4.5 rounded flex-shrink-0 flex items-center justify-center border-2 transition-all ${
                    isSelected ? 'bg-[#c9a84c] border-[#c9a84c]' : 'border-[#2a3348] group-hover:border-[#c9a84c]/40'
                  }`}
                    style={{ width: 18, height: 18 }}
                  >
                    {isSelected && (
                      <svg className="w-2.5 h-2.5 text-black" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>

                  {/* Icon */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                    isSelected ? 'bg-[#c9a84c]/20' : 'bg-white/4 group-hover:bg-[#c9a84c]/8'
                  }`}>
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-[#f0c040]' : 'text-[#8a95a8]'}`} />
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm leading-tight ${isSelected ? 'text-white' : 'text-[#c8cdd7]'}`}>
                      {label}
                    </p>
                    <p className="text-[10px] text-[#8a95a8]/70 truncate mt-0.5">{desc}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <p className="text-xs text-[#4a5568] mt-3">
            <span className="text-[#c9a84c]/70 font-bold">{selectedModules.length}</span>
            /{ALL_MODULES.length} modules selected.
          </p>
        </div>

        {/* Submit button */}
        <button
          id="btn-add-shop"
          type="submit"
          disabled={addingShop || !newShopName.trim() || selectedModules.length === 0}
          className="w-full py-4 rounded-xl text-[#0a0900] bg-gradient-to-r from-[#c9a84c] to-[#f0c040] hover:from-[#d4b050] hover:to-[#f5ca45] hover:scale-[1.015] active:scale-[0.98] transition-all font-extrabold text-base shadow-[0_4px_20px_rgba(201,168,76,.28)] disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2.5"
        >
          {addingShop ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Add Shop
            </>
          )}
        </button>
      </form>
    </div>
  );
}

// ─── Main Content ─────────────────────────────────────────────────────────────
function SettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get('action') || 'switch';

  const { activeShopId, activeShop, setActiveShopId, shops, refreshShops } = useAuth();

  const setTab = (key: string) => {
    router.push(`/settings?action=${key}`);
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#f0c040] mb-1 flex items-center gap-3">
            <StoreIcon className="w-7 h-7" />
            Shop Settings
          </h1>
          <p className="text-sm text-[#8a95a8]">
            Manage your shops and switch between them easily.
          </p>
        </div>

        {/* Layout: sidebar + content */}
        <div className="flex flex-col lg:flex-row gap-5 lg:gap-8 items-start">

          {/* ── Left Sidebar Nav ── */}
          <div className="lg:w-64 w-full flex-shrink-0">
            <div className="bg-[#0d1220] border border-[#c9a84c]/12 rounded-2xl overflow-hidden shadow-xl">
              {/* Active shop badge */}
              {activeShop && (
                <div className="p-4 border-b border-[#c9a84c]/8">
                  <p className="text-[10px] uppercase font-bold text-[#8a95a8] tracking-widest mb-2">
                    Active Shop
                  </p>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#f0c040]/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-4 h-4 text-[#f0c040]" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-extrabold text-sm text-white truncate">{activeShop.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[10px] text-emerald-400 font-semibold">Active</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Nav items */}
              <nav className="p-2">
                {NAV_SECTIONS.map(({ key, label, icon: Icon, desc }) => {
                  const isActive = activeTab === key;
                  return (
                    <button
                      key={key}
                      id={`settings-nav-${key}`}
                      onClick={() => setTab(key)}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 text-left mb-1 group ${
                        isActive
                          ? 'bg-gradient-to-r from-[#c9a84c] to-[#f0c040] text-[#0a0900] shadow-[0_2px_14px_rgba(201,168,76,.28)]'
                          : 'text-[#8a95a8] hover:bg-[#c9a84c]/8 hover:text-[#e0c070]'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                        isActive ? 'bg-black/10' : 'bg-white/5 group-hover:bg-[#c9a84c]/10'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold text-sm leading-tight ${isActive ? 'text-[#0a0900]' : ''}`}>
                          {label}
                        </p>
                        <p className={`text-[10px] truncate mt-0.5 ${isActive ? 'text-[#0a0900]/60' : 'text-[#4a5568] group-hover:text-[#8a95a8]'}`}>
                          {desc}
                        </p>
                      </div>
                      <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-transform ${isActive ? 'translate-x-0.5' : 'opacity-0 group-hover:opacity-60'}`} />
                    </button>
                  );
                })}
              </nav>

              {/* Total shop count */}
              <div className="px-4 py-3 border-t border-[#c9a84c]/8">
                <p className="text-[10px] text-[#4a5568]">
                  Total <span className="text-[#c9a84c]/80 font-bold">{shops?.length || 0}</span> shops
                </p>
              </div>
            </div>
          </div>

          {/* ── Right Panel ── */}
          <div className="flex-1 w-full">
            <div className="bg-[#0d1220] border border-[#c9a84c]/12 rounded-2xl shadow-xl p-6 md:p-8 min-h-[460px] flex flex-col">
              {activeTab === 'switch' ? (
                <SwitchTab
                  shops={shops || []}
                  activeShopId={activeShopId}
                  setActiveShopId={setActiveShopId}
                />
              ) : (
                <AddTab refreshShops={refreshShops} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────
export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#f0c040] animate-spin" />
          <p className="text-sm font-semibold text-[#8a95a8]">Loading...</p>
        </div>
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}