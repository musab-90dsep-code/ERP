'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard, Package, FileText, Users, Briefcase, CreditCard,
  LogOut, ChevronDown, Landmark, Settings, Boxes, ReceiptText,
  ArrowRightLeft, Building, Factory, Menu, X, Download, CheckCircle, Wallet, ShoppingCart,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { useAuth } from './AuthProvider';
import { useIsMobile } from '@/hooks/use-mobile';

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  {
    name: 'Inventory', basePath: '/stock', icon: Boxes,
    subItems: [
      { name: 'Raw Materials', href: '/stock?tab=raw-materials' },
      { name: 'Finished Goods', href: '/stock?tab=finished-goods' },
    ]
  },
  {
    name: 'Invoices', basePath: '/invoices', icon: ReceiptText,
    subItems: [
      { name: 'Buy Invoices', href: '/invoices?tab=buy' },
      { name: 'Sell Invoices', href: '/invoices?tab=sell' },
      { name: 'Sells Returns', href: '/invoices?tab=exchange' },
    ]
  },
  {
    name: 'Contacts', basePath: '/contacts', icon: Users,
    subItems: [
      { name: 'Customers', href: '/contacts/customers' },
      { name: 'Suppliers', href: '/contacts/suppliers' },
      { name: 'Processors', href: '/contacts/processors' },
    ]
  },
  {
    name: 'Employees', basePath: '/employees', icon: Briefcase,
    subItems: [
      { name: 'Employee List', href: '/employees/list' },
      { name: 'Attendance', href: '/employees/attendance' },
      { name: 'Pay Salary', href: '/employees/transactions' },
    ]
  },
  {
    name: 'Orders', basePath: '/orders', icon: ShoppingCart,
    subItems: [
      { name: 'Sales Orders', href: '/orders?tab=sales' },
      { name: 'Purchase Orders', href: '/orders?tab=purchase' },
    ]
  },
  {
    name: 'Processing', basePath: '/processing', icon: Settings,
    subItems: [
      { name: 'Material Issued', href: '/processing?tab=issued' },
      { name: 'Material Received', href: '/processing?tab=received' },
    ]
  },
  {
    name: 'Daily Expenses', basePath: '/expenses', icon: ReceiptText,
    subItems: [
      { name: 'Make a Receipt', href: '/expenses?tab=make' },
      { name: 'Pay for Receipt', href: '/expenses?tab=pay' },
    ]
  },
  {
    name: 'Payments', basePath: '/payments', icon: CreditCard,
    subItems: [
      { name: 'Received', href: '/payments?tab=in' },
      { name: 'Paid', href: '/payments?tab=out' },
      { name: 'Add Money', href: '/payments?tab=add_money' },
    ]
  },
  {
    name: 'Accounts', href: '/accounts', icon: Wallet
  },
  {
    name: 'Finance', href: '/finance', icon: Landmark
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, setRole, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});

  const isMobile = useIsMobile();
  const minimized = !isMobile && isMinimized;

  useEffect(() => { setMobileOpen(false); }, [pathname, searchParams]);
  useEffect(() => { if (!isMobile) setMobileOpen(false); }, [isMobile]);

  useEffect(() => {
    // Initial dropdown state based on current path
    setOpenDropdowns({
      Inventory: pathname.startsWith('/stock'),
      Invoices: pathname.startsWith('/invoices'),
      Contacts: pathname.startsWith('/contacts'),
      Employees: pathname.startsWith('/employees'),
      Orders: pathname.startsWith('/orders'),
      Processing: pathname.startsWith('/processing'),
      Expenses: pathname.startsWith('/expenses'),
      Payments: pathname.startsWith('/payments'),
    });
  }, []);

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

  const toggleDropdown = (name: string) =>
    setOpenDropdowns(prev => ({ ...prev, [name]: !prev[name] }));

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

  const sidebarContent = (
    <aside
      className="relative flex flex-col h-full bg-[#0d1220]"
      style={{
        width: minimized ? 80 : 250,
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: '4px 0 32px rgba(0,0,0,.8)',
        borderRight: '1px solid rgba(201,168,76,.10)',
      }}
    >
      {/* ── Brand & Controls ── */}
      <div className="flex items-center justify-between pt-5 pb-1 px-4">
        <div className={`flex items-center gap-3 ${minimized ? 'justify-center w-full' : ''}`}>
          <div className="flex items-center justify-center flex-shrink-0 w-16 h-14 overflow-hidden drop-shadow-lg">
            <img src="/logo2.png" alt="LedgerGhor" className="w-full h-full object-contain scale-[3.2]" />
          </div>
          {!minimized && (
            <div className="flex flex-col whitespace-nowrap overflow-hidden transition-all duration-300">
              <span className="font-extrabold text-[14px] text-[#f0c040] leading-tight tracking-wide">LedgerGhor</span>
              <span className="text-[10px] font-medium text-[#c9a84c]/60 mt-0.5 uppercase tracking-wider">Business Suite</span>
            </div>
          )}
        </div>

        {/* Toggle Button - Desktop Only */}
        {!isMobile && (
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className={`absolute right-[-14px] top-6 bg-[#1a2035] border border-[#c9a84c]/20 hover:border-[#c9a84c]/50 hover:bg-[#c9a84c]/10 text-white/50 hover:text-[#f0c040] rounded-full p-1.5 transition-all duration-200 z-10 ${minimized ? '' : 'hidden lg:block'}`}
            title={minimized ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {minimized ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}

        {/* Close Button - Mobile Only */}
        {isMobile && (
          <button
            onClick={() => setMobileOpen(false)}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden p-3 custom-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const hasSubItems = !!item.subItems;
          const isOpen = openDropdowns[item.name] || false;
          const isGroupActive = item.basePath ? pathname.startsWith(item.basePath) : false;
          const isActive = isItemActive(item);

          const baseBtnClass = `flex items-center rounded-xl text-[13px] transition-all duration-200 mb-1 group relative
            ${minimized ? 'justify-center p-3' : 'justify-between px-3 py-2.5'}
            ${(isGroupActive || isActive)
              ? 'bg-gradient-to-r from-[#c9a84c] to-[#f0c040] text-[#0a0900] font-bold shadow-[0_2px_14px_rgba(201,168,76,.3)]'
              : 'text-[#c8cdd7]/60 font-medium hover:bg-[#c9a84c]/10 hover:text-[#e0c070]'}`;

          // Tooltip for minimized state
          const tooltip = minimized && (
            <div className="absolute left-full ml-3 px-3 py-1.5 bg-[#1a2035] border border-[#c9a84c]/20 text-[#e0c070] text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl">
              {item.name}
            </div>
          );

          if (hasSubItems) {
            return (
              <div key={item.name} className="mb-1">
                <button
                  onClick={() => {
                    if (minimized) setIsMinimized(false);
                    toggleDropdown(item.name);
                  }}
                  className={`w-full ${baseBtnClass}`}
                >
                  <div className={`flex items-center gap-3 ${minimized ? 'justify-center' : ''}`}>
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {!minimized && <span className="whitespace-nowrap">{item.name}</span>}
                  </div>
                  {!minimized && (
                    <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`} />
                  )}
                  {tooltip}
                </button>

                {/* Sub-items */}
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen && !minimized ? 'max-h-[400px] opacity-100 mt-1 mb-2' : 'max-h-0 opacity-0'}`}
                >
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
              </div>
            );
          }

          return (
            <Link key={item.name} href={item.href as string} className={baseBtnClass}>
              <div className={`flex items-center gap-3 ${minimized ? 'justify-center' : ''}`}>
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!minimized && <span className="whitespace-nowrap">{item.name}</span>}
              </div>
              {tooltip}
            </Link>
          );
        })}
      </nav>

      {/* ── Footer ── */}
      <div className={`p-4 border-t border-white/5 transition-all duration-300 flex flex-col gap-2 ${minimized ? 'items-center' : ''}`}>
        {!isInstalled && installPrompt && (
          <button
            onClick={handleInstall}
            className={`flex items-center rounded-xl text-[13px] font-medium transition-all duration-200 w-full group relative
              ${minimized ? 'justify-center p-3' : 'justify-start gap-3 px-3 py-2.5'}
              ${installSuccess ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[#c9a84c]/10 text-[#c9a84c] hover:bg-[#c9a84c]/20'}`}
          >
            {installSuccess ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> : <Download className="w-5 h-5 flex-shrink-0" />}
            {!minimized && <span>{installSuccess ? 'Installed!' : 'Install App'}</span>}
            {minimized && (
              <div className="absolute left-full ml-3 px-3 py-1.5 bg-[#1a2035] border border-[#c9a84c]/20 text-[#e0c070] text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                Install App
              </div>
            )}
          </button>
        )}

        {/* Role Switcher for Testing */}
        {user && (
          <div className={`w-full ${minimized ? 'hidden' : 'block'} mb-2 mt-2 px-3`}>
            <label className="text-[10px] uppercase font-bold text-[#8a95a8] mb-1 block">Test Role:</label>
            <select 
              value={user.role} 
              onChange={(e) => setRole(e.target.value as 'admin'|'manager'|'member')}
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
          className={`flex items-center rounded-xl text-[13px] font-medium transition-all duration-200 w-full text-[#c8cdd7]/40 hover:bg-red-500/10 hover:text-red-400 group relative
            ${minimized ? 'justify-center p-3' : 'justify-start gap-3 px-3 py-2.5'}`}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!minimized && <span>Sign Out</span>}
          {minimized && (
            <div className="absolute left-full ml-3 px-3 py-1.5 bg-[#1a2035] border border-red-500/20 text-red-400 text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
              Sign Out
            </div>
          )}
        </button>
      </div>

      {/* Scrollbar styling for Webkit browsers */}
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
      {/* ═══ DESKTOP ═══ */}
      <div className="hidden lg:flex h-full z-40">
        {sidebarContent}
      </div>

      {/* ═══ MOBILE ═══ */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 w-10 h-10 flex items-center justify-center rounded-xl shadow-[0_4px_16px_rgba(201,168,76,.3)] bg-gradient-to-br from-[#c9a84c] to-[#f0c040] text-[#0a0900] hover:scale-105 transition-transform"
        aria-label="Open navigation"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`lg:hidden fixed top-0 left-0 h-full z-50 transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {sidebarContent}
      </div>
    </>
  );
}
