'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard, Package, FileText, Users, Briefcase, CreditCard,
  LogOut, ChevronDown, Landmark, Boxes, ReceiptText,
  ArrowRightLeft, Building, Factory, Menu, X, Download, CheckCircle, Wallet, ShoppingCart,
  ChevronLeft, ChevronRight, Plus, Store, TrendingUp
} from 'lucide-react';
import { useAuth } from './AuthProvider';
import { useIsMobile } from '@/hooks/use-mobile';
import api from '@/lib/api';

const navItems = [
  // ── Dashboard (always visible) ─────────────────────────────────────────────
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, moduleKey: 'dashboard' },

  // ── Inventory ──────────────────────────────────────────────────────────────
  {
    name: 'Inventory', basePath: '/stock', icon: Boxes, moduleKey: 'inventory',
    subItems: [
      { name: 'Raw Materials', href: '/stock?tab=raw-materials' },
      { name: 'Finished Goods', href: '/stock?tab=finished-goods' },
    ]
  },

  // ── Sales ──────────────────────────────────────────────────────────────────
  {
    name: 'Sales', icon: TrendingUp, moduleKey: 'sales',
    subItems: [
      { name: 'Customer', href: '/contacts/customers' },
      { name: 'Sales Order', href: '/orders?tab=sales' },
      { name: 'Sales Invoices', href: '/invoices?tab=sell' },
      { name: 'Returns', href: '/invoices?tab=exchange' },
      { name: 'Receive Payment', href: '/payments?tab=in' },
    ]
  },

  // ── Purchase ───────────────────────────────────────────────────────────────
  {
    name: 'Purchase', icon: ShoppingCart, moduleKey: 'purchase',
    subItems: [
      { name: 'Suppliers', href: '/contacts/suppliers' },
      { name: 'Purchase Order', href: '/orders?tab=purchase' },
      { name: 'Purchase Invoice', href: '/invoices?tab=buy' },
      { name: 'Transfer Payment', href: '/payments?tab=out' },
    ]
  },

  // ── Manufacturing ──────────────────────────────────────────────────────────
  {
    name: 'Manufacturing', basePath: '/processing', icon: Factory, moduleKey: 'processing',
    subItems: [
      { name: 'Manufacturer', href: '/contacts/processors' },
      { name: 'Material Issue', href: '/processing?tab=issued' },
      { name: 'Material Receive', href: '/processing?tab=received' },
    ]
  },

  // ── Account and Finance ───────────────────────────────────────────────────
  {
    name: 'Account & Finance', icon: Landmark, moduleKey: 'finance',
    subItems: [
      { name: 'Account', href: '/accounts' },
      { name: 'Finance', href: '/finance' },
      { name: 'Add Money', href: '/payments?tab=add_money' },
    ]
  },

  // ── Employees ───────────────────────────────────────────────────────────────
  {
    name: 'Employees', basePath: '/employees', icon: Briefcase, moduleKey: 'employees',
    subItems: [
      { name: 'Employee List', href: '/employees/list' },
      { name: 'Attendance', href: '/employees/attendance' },
      { name: 'Payroll', href: '/employees/transactions' },
    ]
  },

  // ── Daily Expenses ──────────────────────────────────────────────────────────
  {
    name: 'Daily Expenses', basePath: '/expenses', icon: ReceiptText, moduleKey: 'expenses',
    subItems: [
      { name: 'Make a Receipt', href: '/expenses?tab=make' },
      { name: 'Pay for Receipt', href: '/expenses?tab=pay' },
    ]
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, setRole, signOut, activeShopId, activeShop, setActiveShopId, shops, refreshShops } = useAuth();

  // Filter nav items based on active shop's enabled modules
  const filteredNavItems = navItems.filter(item =>
    item.moduleKey === null ||
    !activeShop?.modules?.length ||
    activeShop.modules.includes(item.moduleKey)
  );

  // Desktop collapse state
  const [isCollapsed, setIsCollapsed] = useState(true);
  // Hover state for desktop
  const [isHovered, setIsHovered] = useState(false);

  // sidebarOpen controls the drawer on mobile
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});

  const isMobile = useIsMobile();

  // Close sidebar on route change
  useEffect(() => { 
    if (isMobile) setSidebarOpen(false); 
  }, [pathname, searchParams, activeShopId, isMobile]);

  // Set initial dropdown open-state based on current URL
  useEffect(() => {
    const onInvoices = pathname.startsWith('/invoices');
    const onOrders = pathname.startsWith('/orders');
    const onProcessing = pathname.startsWith('/processing');
    setOpenDropdowns({
      Sales: onInvoices || onOrders,
      Purchase: onOrders || onInvoices,
      Manufacturing: onProcessing,
      Contacts: pathname.startsWith('/contacts'),
      Payments: pathname.startsWith('/payments'),
      Employees: pathname.startsWith('/employees'),
      Inventory: pathname.startsWith('/stock'),
      'Daily Expenses': pathname.startsWith('/expenses'),
    });
  }, []);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (isMobile && sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen, isMobile]);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler as EventListener);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    });
    return () => {
      window.removeEventListener('beforeinstallprompt', handler as EventListener);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallSuccess(true);
      setInstallPrompt(null);
      setTimeout(() => setInstallSuccess(false), 3000);
    }
  };

  const toggleDropdown = (name: string) => {
    if (isCollapsed && !isMobile && !isHovered) {
      setIsCollapsed(false); 
    }
    setOpenDropdowns(prev => ({ ...prev, [name]: !prev[name] }));
  }

  const isItemActive = (item: any) => {
    if (item.href) {
      if (item.href.includes('?')) {
        const [path, query] = item.href.split('?');
        const [key, val] = query.split('=');
        return pathname === path && searchParams.get(key) === val;
      }
      return pathname === item.href;
    }
    if (item.basePath) return pathname.startsWith(item.basePath);
    return false;
  };

  // Sidebar is effectively expanded if manually toggled OR hovered
  const isExpanded = !isCollapsed || isHovered || isMobile;
  const isMini = !isExpanded; 
  const sidebarWidth = isMobile ? 260 : (isExpanded ? 260 : 80);

  const sidebarContent = (
    <aside
      onMouseEnter={() => !isMobile && setIsHovered(true)}
      onMouseLeave={() => !isMobile && setIsHovered(false)}
      className="relative flex flex-col h-full bg-[#0d1220] transition-all duration-300 ease-in-out overflow-hidden"
      style={{
        width: sidebarWidth,
        boxShadow: '4px 0 40px rgba(0,0,0,.9)',
        borderRight: '1px solid rgba(201,168,76,.12)',
      }}
    >
      {/* ── Brand & Toggle/Close ── */}
      <div className={`flex items-center pt-5 pb-3 px-4 ${(!isExpanded && !isMobile) ? 'justify-center' : 'justify-between'}`}>
        <div className={`flex items-center gap-3 ${(!isExpanded && !isMobile) ? 'justify-center w-full' : ''}`}>
          <div className="flex items-center justify-center flex-shrink-0 w-10 h-10 overflow-hidden drop-shadow-lg rounded-xl">
            <img src="/icon.PNG" alt="LedgerGhor" className="w-full h-full object-contain" />
          </div>
          {(isExpanded) && (
            <div className="flex flex-col whitespace-nowrap overflow-hidden transition-opacity duration-300">
              <span className="font-extrabold text-[14px] text-[#f0c040] leading-tight tracking-wide">LedgerGhor</span>
              <span className="text-[10px] font-medium text-[#c9a84c]/60 mt-0.5 uppercase tracking-wider">Business Suite</span>
            </div>
          )}
        </div>

        {/* Standard Toggle/Close Button */}
        <button
          onClick={() => isMobile ? setSidebarOpen(false) : setIsCollapsed(!isCollapsed)}
          className={`flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 hover:bg-[#c9a84c]/10 text-white/50 hover:text-[#c9a84c] transition-all ${(!isExpanded && !isMobile) ? 'hidden' : ''}`}
        >
          {isMobile ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden p-3 custom-scrollbar mt-2">
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          const hasSubItems = !!item.subItems;
          const isOpen = openDropdowns[item.name] || false;
          const isGroupActive = item.basePath ? pathname.startsWith(item.basePath) : false;
          const isActive = isItemActive(item);

          const baseBtnClass = `flex items-center rounded-xl transition-all duration-200 mb-1 group relative py-2.5
            ${isMini ? 'justify-center px-0' : 'justify-between px-3'}
            ${(isGroupActive || isActive)
              ? 'bg-gradient-to-r from-[#c9a84c] to-[#f0c040] text-[#0a0900] font-bold shadow-[0_2px_14px_rgba(201,168,76,.3)]'
              : 'text-[#c8cdd7]/60 font-medium hover:bg-[#c9a84c]/10 hover:text-[#e0c070]'}`;

          if (hasSubItems) {
            return (
              <div key={item.name} className="mb-1">
                <button
                  onClick={() => toggleDropdown(item.name)}
                  className={`w-full ${baseBtnClass}`}
                  title={isMini ? item.name : undefined}
                >
                  <div className={`flex items-center ${isMini ? 'justify-center' : 'gap-3'}`}>
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {!isMini && <span className="whitespace-nowrap text-[13px]">{item.name}</span>}
                  </div>
                  {!isMini && <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`} />}
                </button>

                {/* Sub-items */}
                {!isMini && (
                  <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[400px] opacity-100 mt-1 mb-2' : 'max-h-0 opacity-0'}`}>
                    <div className="ml-4 pl-3 border-l-2 border-[#c9a84c]/15 flex flex-col gap-1">
                      {item.subItems?.map(sub => {
                        const isSubActive = isItemActive(sub);
                        return (
                          <Link
                            key={sub.name} href={sub.href}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all duration-200 whitespace-nowrap
                              ${isSubActive
                                ? 'bg-[#c9a84c]/15 text-[#f0c040] font-bold border border-[#c9a84c]/20'
                                : 'text-[#c8cdd7]/50 font-medium hover:bg-[#c9a84c]/5 hover:text-[#e0c070]'}`}
                          >
                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${isSubActive ? 'bg-[#f0c040]' : 'bg-[#c9a84c]/30'}`} />
                            {sub.name}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link key={item.name} href={item.href as string} className={baseBtnClass} title={isMini ? item.name : undefined}>
              <div className={`flex items-center ${isMini ? 'justify-center' : 'gap-3'}`}>
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!isMini && <span className="whitespace-nowrap text-[13px]">{item.name}</span>}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* ── Footer ── */}
      <div className={`p-4 border-t border-white/5 flex flex-col ${isMini ? 'items-center gap-4' : 'gap-2'}`}>
        {isMini ? (
          <button onClick={() => signOut()} className="text-[#c8cdd7]/40 hover:text-red-400 p-2" title="Sign Out">
            <LogOut className="w-5 h-5 flex-shrink-0" />
          </button>
        ) : (
          <>
            {!isInstalled && installPrompt && (
              <button
                onClick={handleInstall}
                className={`flex items-center rounded-xl text-[13px] font-medium transition-all duration-200 w-full justify-start gap-3 px-3 py-2.5
                  ${installSuccess ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[#c9a84c]/10 text-[#c9a84c] hover:bg-[#c9a84c]/20'}`}
              >
                {installSuccess ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> : <Download className="w-5 h-5 flex-shrink-0" />}
                <span>{installSuccess ? 'Installed!' : 'Install App'}</span>
              </button>
            )}

            {user && (
              <div className="w-full mb-2 mt-2 px-3">
                <label className="text-[10px] uppercase font-bold text-[#8a95a8] mb-1 block">Test Role:</label>
                <select
                  value={user.role}
                  onChange={(e) => setRole(e.target.value as 'admin' | 'manager' | 'member')}
                  className="w-full bg-[#1a2035] border border-[#c9a84c]/20 rounded-md text-xs text-[#e0c070] py-1.5 px-2 outline-none focus:border-[#c9a84c]/50"
                >
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="member">Member</option>
                </select>
              </div>
            )}

            <button
              onClick={() => signOut()}
              className="flex items-center rounded-xl text-[13px] font-medium transition-all duration-200 w-full text-[#c8cdd7]/40 hover:bg-red-500/10 hover:text-red-400 justify-start gap-3 px-3 py-2.5"
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              <span>Sign Out</span>
            </button>
          </>
        )}
      </div>

      {/* Scrollbar styling */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.2); border-radius: 4px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.4); }
      `}} />
    </aside>
  );

  return (
    <>
      {/* ═══ Hamburger Button for Mobile ═══ */}
      {isMobile && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-4 left-4 z-50 w-10 h-10 flex items-center justify-center rounded-xl shadow-[0_4px_16px_rgba(201,168,76,.3)] bg-gradient-to-br from-[#c9a84c] to-[#f0c040] text-[#0a0900] hover:scale-105 transition-transform"
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* ═══ Dark Backdrop Overlay for Mobile ═══ */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ═══ Sidebar ═══ */}
      <div
        className={`fixed top-0 left-0 h-full z-[60] transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          isMobile ? (sidebarOpen ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'
        }`}
      >
        {sidebarContent}
      </div>
    </>
  );
}