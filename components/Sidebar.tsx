'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard, Package, FileText, Users, Briefcase, CreditCard,
  LogOut, ChevronDown, Landmark, Settings, Boxes, ReceiptText,
  ArrowRightLeft, Building, Factory, Menu, X, Download, CheckCircle, Wallet, ShoppingCart
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useIsMobile } from '@/hooks/use-mobile';

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  {
    name: 'Inventory', basePath: '/stock', icon: Boxes,
    subItems: [
      { name: 'Raw Materials',  href: '/stock?tab=raw-materials' },
      { name: 'Finished Goods', href: '/stock?tab=finished-goods' },
    ]
  },
  {
    name: 'Invoices', basePath: '/invoices', icon: ReceiptText,
    subItems: [
      { name: 'Buy Invoices',  href: '/invoices?tab=buy' },
      { name: 'Sell Invoices', href: '/invoices?tab=sell' },
      { name: 'Sells Returns', href: '/invoices?tab=return' },
    ]
  },
  {
    name: 'Contacts', basePath: '/contacts', icon: Users,
    subItems: [
      { name: 'Customers',  href: '/contacts/customers' },
      { name: 'Suppliers',  href: '/contacts/suppliers' },
      { name: 'Processors', href: '/contacts/processors' },
    ]
  },
  {
    name: 'Employees', basePath: '/employees', icon: Briefcase,
    subItems: [
      { name: 'Employee List',  href: '/employees/list' },
      { name: 'Attendance',     href: '/employees/attendance' },
      { name: 'Pay Salary',     href: '/employees/transactions' },
    ]
  },
  {
    name: 'Orders', basePath: '/orders', icon: ShoppingCart,
    subItems: [
      { name: 'Sales Orders',    href: '/orders?tab=sales' },
      { name: 'Purchase Orders', href: '/orders?tab=purchase' },
    ]
  },
  {
    name: 'Processing', basePath: '/processing', icon: Settings,
    subItems: [
      { name: 'Material Issued',   href: '/processing?tab=issued' },
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
      { name: 'Paid',     href: '/payments?tab=out' },
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
  const pathname  = usePathname();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({
    Inventory:  pathname.startsWith('/stock'),
    Invoices:   pathname.startsWith('/invoices'),
    Contacts:   pathname.startsWith('/contacts'),
    Employees:  pathname.startsWith('/employees'),
    Orders:     pathname.startsWith('/orders'),
    Processing: pathname.startsWith('/processing'),
    Expenses:   pathname.startsWith('/expenses'),
    Payments:   pathname.startsWith('/payments'),
  });

  // Use the mobile hook instead of manual resize listeners
  const isMobile = useIsMobile();

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false); }, [pathname, searchParams]);

  // Close on resize to desktop
  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  // ── PWA Install prompt capture ──
  useEffect(() => {
    // Check if already installed as PWA
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
      style={{
        width: 252, flexShrink: 0,
        background: 'linear-gradient(175deg, #12101e 0%, #1b1540 45%, #251d5a 100%)',
        boxShadow: '4px 0 24px rgba(0,0,0,.35)',
      }}
      className="h-full flex flex-col overflow-hidden"
    >
      {/* ── Brand ── */}
      <div className="px-5 py-5 flex items-center justify-between border-b"
        style={{ borderColor: 'rgba(255,255,255,.08)' }}>
        <div className="flex items-center gap-3">
          <div style={{
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: 10,
            boxShadow: '0 4px 12px rgba(99,102,241,.5)',
            width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="block text-white font-bold text-sm tracking-wide leading-tight">ERP Manager</span>
            <span className="block text-xs font-medium" style={{ color: 'rgba(255,255,255,.35)' }}>Business Suite</span>
          </div>
        </div>

        {/* Close button — mobile only */}
        <button onClick={() => setMobileOpen(false)}
          className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-white transition-all"
          style={{ background: 'rgba(255,255,255,.1)' }}>
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const hasSubItems = !!item.subItems;
          const isOpen = openDropdowns[item.name] || false;
          const isGroupActive = item.basePath ? pathname.startsWith(item.basePath) : false;
          const isActive = isItemActive(item);

          const btnBase: React.CSSProperties = {
            color: isGroupActive || isActive ? '#fff' : 'rgba(255,255,255,.6)',
            background: (isGroupActive || isActive)
              ? 'linear-gradient(90deg, #6366f1, #8b5cf6)'
              : 'transparent',
            boxShadow: (isGroupActive || isActive) ? '0 2px 12px rgba(99,102,241,.4)' : 'none',
          };

          if (hasSubItems) {
            return (
              <div key={item.name}>
                <button
                  onClick={() => toggleDropdown(item.name)}
                  className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                  style={{ ...btnBase, background: isGroupActive ? 'rgba(139,92,246,.25)' : 'transparent' }}
                  onMouseEnter={e => { if (!isGroupActive) { (e.currentTarget as HTMLElement).style.background = 'rgba(139,92,246,.15)'; (e.currentTarget as HTMLElement).style.color = '#fff'; } }}
                  onMouseLeave={e => { if (!isGroupActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,.6)'; } }}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span>{item.name}</span>
                  </div>
                  <ChevronDown
                    className="w-4 h-4 flex-shrink-0 transition-transform duration-300"
                    style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', color: 'inherit' }}
                  />
                </button>

                <div className="overflow-hidden transition-all duration-300 ease-in-out"
                  style={{ maxHeight: isOpen ? '400px' : '0px', opacity: isOpen ? 1 : 0 }}>
                  <div className="mt-0.5 ml-4 pl-3 mb-1 space-y-0.5"
                    style={{ borderLeft: '1.5px solid rgba(255,255,255,.1)' }}>
                    {item.subItems?.map(sub => {
                      const isSubActive = isItemActive(sub);
                      return (
                        <Link
                          key={sub.name} href={sub.href}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150"
                          style={{
                            color: isSubActive ? '#fff' : 'rgba(255,255,255,.5)',
                            background: isSubActive ? 'linear-gradient(90deg, #6366f1, #8b5cf6)' : 'transparent',
                            boxShadow: isSubActive ? '0 2px 8px rgba(99,102,241,.4)' : 'none',
                          }}
                          onMouseEnter={e => { if (!isSubActive) { (e.currentTarget as HTMLElement).style.background = 'rgba(139,92,246,.15)'; (e.currentTarget as HTMLElement).style.color = '#fff'; } }}
                          onMouseLeave={e => { if (!isSubActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,.5)'; } }}
                        >
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ background: isSubActive ? '#fff' : 'rgba(255,255,255,.3)' }} />
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
            <Link key={item.name} href={item.href as string}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
              style={btnBase}
              onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'rgba(139,92,246,.15)'; (e.currentTarget as HTMLElement).style.color = '#fff'; } }}
              onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,.6)'; } }}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* ── Install App + Sign Out ── */}
      <div className="px-3 py-4 border-t space-y-1" style={{ borderColor: 'rgba(255,255,255,.08)' }}>

        {/* Install App button — shows only if prompt available or not yet installed */}
        {!isInstalled && installPrompt && (
          <button
            onClick={handleInstall}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
            style={{
              background: installSuccess
                ? 'rgba(34,197,94,.15)'
                : 'linear-gradient(90deg, rgba(99,102,241,.2), rgba(139,92,246,.2))',
              color: installSuccess ? '#86efac' : 'rgba(167,139,250,1)',
              border: '1px solid rgba(139,92,246,.3)',
            }}
          >
            {installSuccess
              ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
              : <Download className="w-4 h-4 flex-shrink-0" />}
            {installSuccess ? 'Installed!' : 'Install App'}
          </button>
        )}

        <button
          onClick={() => supabase.auth.signOut()}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
          style={{ color: 'rgba(255,255,255,.5)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,.15)'; (e.currentTarget as HTMLElement).style.color = '#fca5a5'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,.5)'; }}
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* ═══ DESKTOP — always visible ═══ */}
      <div className="hidden lg:flex h-full">
        {sidebarContent}
      </div>

      {/* ═══ MOBILE — floating hamburger button ═══ */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 flex items-center justify-center rounded-xl text-white shadow-lg transition-all"
        style={{
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          boxShadow: '0 4px 16px rgba(99,102,241,.5)',
        }}
        aria-label="Open navigation"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* ═══ MOBILE — overlay backdrop ═══ */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(2px)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ═══ MOBILE — sliding drawer ═══ */}
      <div
        className="lg:hidden fixed top-0 left-0 h-full z-50 transition-transform duration-300 ease-in-out"
        style={{
          width: 252,
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        {sidebarContent}
      </div>
    </>
  );
}
