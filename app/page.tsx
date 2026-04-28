'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  Users, Package, CreditCard, ArrowRight, Box, UserPlus, Boxes,
  ArrowUpRight, ReceiptText, Wallet, ShoppingBag, TrendingUp,
  TrendingDown, Banknote, CheckCircle, CalendarDays, Zap,
  Activity, Clock, Star, AlertTriangle, XCircle
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

type Period = 'day' | 'week' | 'month' | 'year';

export default function Dashboard() {
  const { activeShopId, shops } = useAuth();
  const [stats, setStats] = useState({ products: 0, invoices: 0, employees: 0, checks: 0 });
  const [recentEmployees, setRecentEmployees] = useState<any[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [greeting, setGreeting] = useState('');
  const [greetingEmoji, setGreetingEmoji] = useState('👋');
  const [totalBalance, setTotalBalance] = useState(0);
  const [totalDue, setTotalDue] = useState(0);
  const [salesPeriod, setSalesPeriod] = useState<Period>('month');
  const [expensePeriod, setExpensePeriod] = useState<Period>('month');
  const [salesByPeriod, setSalesByPeriod] = useState<Record<Period, number>>({ day: 0, week: 0, month: 0, year: 0 });
  const [expensesByPeriod, setExpensesByPeriod] = useState<Record<Period, number>>({ day: 0, week: 0, month: 0, year: 0 });
  const [attendance, setAttendance] = useState({ present: 0, total: 0 });
  const [low_stock_items, setLowStockItems] = useState<any[]>([]);
  const [bounced_checks, setBouncedChecks] = useState<any[]>([]);
  const [sales_history, setSalesHistory] = useState<number[]>([]);
  const [expenses_history, setExpensesHistory] = useState<number[]>([]);
  const [balance_history, setBalanceHistory] = useState<number[]>([]);
  const [stock_history, setStockHistory] = useState<number[]>([]);
  const [due_history, setDueHistory] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  const getFrom = (p: Period) => {
    const n = new Date();
    if (p === 'day') { const d = new Date(n); d.setHours(0, 0, 0, 0); return d.toISOString(); }
    if (p === 'week') { const d = new Date(n); d.setDate(n.getDate() - 7); return d.toISOString(); }
    if (p === 'month') return new Date(n.getFullYear(), n.getMonth(), 1).toISOString();
    return new Date(n.getFullYear(), 0, 1).toISOString();
  };

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) { setGreeting('Good Morning'); setGreetingEmoji('🌅'); }
    else if (hour < 18) { setGreeting('Good Afternoon'); setGreetingEmoji('☀️'); }
    else { setGreeting('Good Evening'); setGreetingEmoji('🌙'); }

    (async () => {
      try {
        // Single call — Django returns all dashboard data at once
        const dashData = await api.getDashboardStats();

        setStats({
          products: dashData.total_products ?? 0,
          invoices: dashData.total_invoices ?? 0,
          employees: dashData.total_employees ?? 0,
          checks: dashData.total_checks ?? 0,
        });
        setRecentEmployees(dashData.recent_employees ?? []);
        setRecentInvoices(dashData.recent_invoices ?? []);
        setTotalBalance(dashData.total_balance ?? 0);
        setTotalDue(dashData.total_due ?? 0);
        setSalesByPeriod(dashData.sales_by_period ?? { day: 0, week: 0, month: 0, year: 0 });
        setExpensesByPeriod(dashData.expenses_by_period ?? { day: 0, week: 0, month: 0, year: 0 });
        setAttendance({
          present: dashData.attendance_present ?? 0,
          total: dashData.total_employees ?? 0,
        });
        setLowStockItems(dashData.low_stock_items ?? []);
        setBouncedChecks(dashData.bounced_checks ?? []);
        setSalesHistory(dashData.sales_history ?? []);
        setExpensesHistory(dashData.expenses_history ?? []);
        setBalanceHistory(dashData.balance_history ?? []);
        setStockHistory(dashData.stock_history_values ?? []);
        setDueHistory(dashData.due_history ?? []);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const pct = attendance.total > 0 ? Math.round((attendance.present / attendance.total) * 100) : 0;
  const periodLabel: Record<Period, string> = { day: 'Today', week: 'This Week', month: 'This Month', year: 'This Year' };
  const profit = salesByPeriod[salesPeriod] - expensesByPeriod[expensePeriod];

  const statusStyle = (s: string) => {
    if (s === 'paid') return { bg: '#dcfce7', color: '#15803d' };
    if (s === 'partial') return { bg: '#fef9c3', color: '#854d0e' };
    return { bg: '#fee2e2', color: '#b91c1c' };
  };

  const avatarGrads = [
    'linear-gradient(135deg,#6366f1,#8b5cf6)',
    'linear-gradient(135deg,#059669,#10b981)',
    'linear-gradient(135deg,#0ea5e9,#2563eb)',
    'linear-gradient(135deg,#d97706,#f59e0b)',
    'linear-gradient(135deg,#e11d48,#f43f5e)',
  ];

  const quickActions = [
    { name: 'New Sale Invoice', desc: 'Create a sell invoice', icon: ShoppingBag, link: '/invoices?tab=sell', color: '#6366f1', bg: '#eef2ff' },
    { name: 'New Purchase', desc: 'Record a buying invoice', icon: Box, link: '/invoices?tab=buy', color: '#0ea5e9', bg: '#e0f2fe' },
    { name: 'Log Payment', desc: 'Record received or paid', icon: Wallet, link: '/payments?tab=in', color: '#10b981', bg: '#d1fae5' },
    { name: 'Add Employee', desc: 'Register new staff member', icon: UserPlus, link: '/employees/list', color: '#8b5cf6', bg: '#ede9fe' },
    { name: 'Update Inventory', desc: 'Add or adjust stock', icon: Package, link: '/stock', color: '#f59e0b', bg: '#fef3c7' },
    { name: 'Mark Attendance', desc: 'Track today\'s presence', icon: CalendarDays, link: '/employees/attendance-entry', color: '#e11d48', bg: '#ffe4e6' },
  ];

  return (
    <div className="pb-16 w-full min-h-screen bg-[#0b0f1a] px-6 pt-2 max-w-[1400px] mx-auto" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-8 bg-[#131929] p-6 rounded-2xl border border-[rgba(255,255,255,0.04)] shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs font-bold tracking-[0.2em] text-[#8a95a8] uppercase">
              {loading ? '...' : new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
          <h1 className="flex items-center gap-3 text-3xl font-black text-[#c9a84c] tracking-tight">
            <span>🌙</span> {shops.find(s => s.id === activeShopId)?.name || 'BRASSFLOW ERP'} <span className="text-[#4a5568] font-semibold text-2xl mx-1">•</span> <span className="text-[#8a95a8] font-medium text-xl tracking-normal">Business Manager</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/invoices?tab=sell" className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[rgba(201,168,76,0.18)] bg-[#131929] text-[#e8eaf0] text-sm font-bold shadow-[0_4px_24px_rgba(0,0,0,0.5)] transition hover:bg-[#1a2235]">
            <ShoppingBag className="w-4 h-4 text-[#c9a84c]" /> New Sale
          </Link>
          <Link href="/invoices?tab=buy" className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-br from-[#c9a84c] to-[#f0c040] text-[#0a0900] text-sm font-extrabold shadow-[0_4px_24px_rgba(0,0,0,0.5)] transition hover:opacity-90">
            <Box className="w-4 h-4" /> New Purchase
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full border-4 border-[#131929] border-t-[#c9a84c] animate-spin" />
            <p className="text-sm font-semibold text-[#8a95a8]">Loading dashboard...</p>
          </div>
        </div>
      ) : (
        <>
          {/* ── KPI ROW ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 mb-8">

            {/* Net Cash Balance */}
            <div className="bg-[#131929] rounded-2xl p-5 border border-[rgba(255,255,255,0.04)] shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col justify-between overflow-hidden relative group hover:border-[rgba(201,168,76,0.2)] transition-all duration-300">
              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <Wallet className="w-12 h-12 text-[#c9a84c]" />
              </div>
              <div className="relative z-10">
                <div className="text-[10px] uppercase font-black text-[#8a95a8] tracking-[0.15em] mb-1 flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-[#c9a84c]" /> Net Cash Balance
                </div>
                <div className={`text-2xl font-black mb-1 tracking-tight ${totalBalance >= 0 ? 'text-white' : 'text-red-400'}`}>
                  {totalBalance < 0 ? '-' : ''}৳{Math.abs(totalBalance).toLocaleString()}
                </div>
                <div className={`flex items-center gap-1 text-[10px] font-bold ${totalBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {totalBalance >= 0 ? <><TrendingUp className="w-3 h-3" /> Surplus Status</> : <><TrendingDown className="w-3 h-3" /> Deficit Status</>}
                </div>
              </div>
              <div className="mt-6 flex items-end gap-1 h-10 relative z-10">
                {balance_history.map((val, i) => {
                  const max = Math.max(...balance_history, 1);
                  const h = (val / max) * 100;
                  return <div key={i} className="flex-1 rounded-t-[2px] bg-gradient-to-t from-[rgba(201,168,76,0.1)] to-[rgba(201,168,76,0.5)] transition-all hover:to-[rgba(201,168,76,0.8)]" style={{ height: `${Math.max(h, 4)}%` }} />;
                })}
              </div>
            </div>

            {/* Market Outstanding */}
            <div className="bg-[#131929] rounded-2xl p-5 border border-[rgba(255,255,255,0.04)] shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col justify-between overflow-hidden relative group hover:border-orange-500/20 transition-all duration-300">
              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <ReceiptText className="w-12 h-12 text-orange-400" />
              </div>
              <div className="relative z-10">
                <div className="text-[10px] uppercase font-black text-[#8a95a8] tracking-[0.15em] mb-1 flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-orange-500" /> Market Outstanding
                </div>
                <div className="text-2xl font-black text-white mb-1 tracking-tight">৳{totalDue.toLocaleString()}</div>
                <div className="text-[10px] font-bold text-orange-400/80 flex items-center gap-1">
                  <Activity className="w-3 h-3" /> Receivables from Customers
                </div>
              </div>
              <div className="mt-6 flex items-end gap-1 h-10 relative z-10">
                {due_history.map((val, i) => {
                  const max = Math.max(...due_history, 1);
                  // Generate SVG path for a smooth area chart
                  const points = due_history.map((v, idx) => {
                    const x = (idx / (due_history.length - 1)) * 100;
                    const y = 100 - (v / max) * 100;
                    return `${x},${y}`;
                  }).join(' ');

                  if (i === 0) return (
                    <div key="svg-chart" className="w-full h-full">
                      <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="dueGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="rgba(249, 115, 22, 0.4)" />
                            <stop offset="100%" stopColor="transparent" />
                          </linearGradient>
                        </defs>
                        <path d={`M 0,100 L ${points} L 100,100 Z`} fill="url(#dueGrad)" />
                        <polyline points={points} fill="none" stroke="rgba(249, 115, 22, 0.8)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                      </svg>
                    </div>
                  );
                  return null;
                })}
              </div>
            </div>

            {/* Cash Inflow */}
            <Link href="/cashbook?tab=inflow" className="bg-[#131929] rounded-2xl p-5 border border-[rgba(255,255,255,0.04)] shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col justify-between overflow-hidden relative group hover:border-emerald-500/20 transition-all duration-300 block">
              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <Banknote className="w-12 h-12 text-emerald-400" />
              </div>
              <div className="relative z-10">
                <div className="flex justify-between items-center mb-1">
                  <div className="text-[10px] uppercase font-black text-[#8a95a8] tracking-[0.15em] flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-emerald-500" /> Cash Inflow
                  </div>
                  <div className="flex gap-1 bg-[#0b0f1a] p-0.5 rounded-md border border-white/5">
                    {(['day', 'week', 'month', 'year'] as Period[]).map(p => (
                      <button key={p} onClick={(e) => { e.preventDefault(); setSalesPeriod(p); }} className={`text-[8px] font-black w-3.5 h-3.5 rounded flex items-center justify-center transition-all ${salesPeriod === p ? 'bg-emerald-500 text-black shadow-lg' : 'text-[#4a5568] hover:text-[#8a95a8]'}`}>
                        {p.charAt(0).toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="text-2xl font-black text-white mb-1 tracking-tight">৳{salesByPeriod[salesPeriod].toLocaleString()}</div>
                <div className="text-[10px] font-bold text-emerald-400/80">Received {periodLabel[salesPeriod]}</div>
              </div>
              <div className="mt-6 flex items-end gap-1.5 h-10 relative z-10">
                {sales_history.map((val, i) => {
                  const max = Math.max(...sales_history, 1);
                  const h = Math.max((val / max) * 100, 10);
                  return (
                    <div key={i} className="flex-1 flex flex-col gap-0.5 justify-end h-full">
                      {Array.from({ length: 3 }).map((_, idx) => (
                        <div key={idx} className="w-full rounded-[1px] transition-all duration-300" style={{ height: `${h / 3}%`, backgroundColor: h > 20 ? `rgba(16, 185, 129, ${0.2 + (idx * 0.3)})` : 'rgba(16, 185, 129, 0.1)' }} />
                      ))}
                    </div>
                  );
                })}
              </div>
            </Link>

            {/* Cash Outflow */}
            <Link href="/cashbook?tab=outflow" className="bg-[#131929] rounded-2xl p-5 border border-[rgba(255,255,255,0.04)] shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col justify-between overflow-hidden relative group hover:border-red-500/20 transition-all duration-300 block">
              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <TrendingDown className="w-12 h-12 text-red-400" />
              </div>
              <div className="relative z-10">
                <div className="flex justify-between items-center mb-1">
                  <div className="text-[10px] uppercase font-black text-[#8a95a8] tracking-[0.15em] flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-red-500" /> Cash Outflow
                  </div>
                  <div className="flex gap-1 bg-[#0b0f1a] p-0.5 rounded-md border border-white/5">
                    {(['day', 'week', 'month', 'year'] as Period[]).map(p => (
                      <button key={p} onClick={(e) => { e.preventDefault(); setExpensePeriod(p); }} className={`text-[8px] font-black w-3.5 h-3.5 rounded flex items-center justify-center transition-all ${expensePeriod === p ? 'bg-red-500 text-white shadow-lg' : 'text-[#4a5568] hover:text-[#8a95a8]'}`}>
                        {p.charAt(0).toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="text-2xl font-black text-white mb-1 tracking-tight">৳{expensesByPeriod[expensePeriod].toLocaleString()}</div>
                <div className="text-[10px] font-bold text-red-400/80 flex items-center gap-1">
                  {profit >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  Surplus: {profit.toLocaleString()}
                </div>
              </div>
              <div className="mt-6 flex items-end gap-1 h-10 relative z-10">
                {expenses_history.map((val, i) => {
                  const max = Math.max(...expenses_history, 1);
                  const h = (val / max) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group/bar">
                      <div className="w-[2px] h-full bg-white/5 absolute bottom-0" />
                      <div className="w-full rounded-full bg-red-500/60 shadow-[0_0_8px_rgba(239,68,68,0.4)]" style={{ height: `${Math.max(h, 6)}%` }} />
                    </div>
                  );
                })}
              </div>
            </Link>

            {/* Daily Attendance */}
            <div className="bg-[#131929] rounded-2xl p-5 border border-[rgba(255,255,255,0.04)] shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col items-center justify-center relative overflow-hidden group hover:border-purple-500/20 transition-all duration-300">
              <div className="text-[10px] uppercase font-black text-[#8a95a8] tracking-[0.15em] absolute top-5 left-5 flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-purple-500" /> Attendance
              </div>
              <div className="relative w-16 h-16 flex items-center justify-center rounded-full mt-4" style={{ background: `conic-gradient(#a855f7 ${pct}%, rgba(255,255,255,0.03) 0)`, boxShadow: '0 0 30px rgba(168,85,247,0.15)' }}>
                <div className="w-13 h-13 bg-[#131929] rounded-full flex items-center justify-center z-10 font-black text-white text-base">
                  {pct}%
                </div>
              </div>
              <div className="text-[10px] font-bold text-[#8a95a8] mt-3">{attendance.present}/{attendance.total} Staff Present</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ── LEFT COLUMN (Quick Actions & Invoices) ── */}
            <div className="lg:col-span-2 flex flex-col gap-6">

              {/* Quick Actions */}
              <div className="bg-[#131929] rounded-2xl p-5 border border-[rgba(255,255,255,0.04)] shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="flex items-center gap-2 font-black text-white text-sm"><Zap className="w-4 h-4 text-[#c9a84c]" /> Quick Actions</h3>
                  <span className="text-[11px] font-semibold text-[#4a5568]">Shortcuts</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
                  {[
                    { name: 'New Sale', icon: ShoppingBag, link: '/invoices?tab=sell', color: '#c9a84c' },
                    { name: 'Purchase', icon: Box, link: '/invoices?tab=buy', color: '#60a5fa' },
                    { name: 'Payment', icon: Wallet, link: '/payments?tab=in', color: '#10b981' },
                    { name: 'Employee', icon: UserPlus, link: '/employees/list', color: '#a855f7' },
                    { name: 'Inventory', icon: Package, link: '/stock', color: '#f59e0b' },
                    { name: 'Attendance', icon: CalendarDays, link: '/employees/attendance-entry', color: '#f43f5e' },
                  ].map((a, i) => (
                    <Link key={i} href={a.link} className="flex flex-col items-center justify-center gap-2 bg-[#1a2235] border border-[rgba(201,168,76,0.1)] p-4 rounded-xl transition hover:bg-[#232d43] hover:border-[rgba(201,168,76,0.3)] group text-center">
                      <a.icon className="w-5 h-5 mb-1 group-hover:scale-110 transition-transform" style={{ color: a.color }} />
                      <span className="text-xs font-bold text-[#8a95a8] group-hover:text-white transition-colors">{a.name}</span>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Recent Invoices */}
              <div className="bg-[#131929] rounded-2xl border border-[rgba(255,255,255,0.04)] shadow-[0_4px_24px_rgba(0,0,0,0.5)] flex flex-col">
                <div className="px-5 py-5 border-b border-[rgba(255,255,255,0.04)] flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-black text-white text-sm"><ReceiptText className="w-4 h-4 text-emerald-400" /> Recent Invoices</h3>
                  <Link href="/invoices?tab=sell" className="text-[11px] font-bold text-[#c9a84c] hover:underline">View More ➔</Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="border-b border-[rgba(255,255,255,0.04)] text-[10px] font-bold text-[#8a95a8] uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4">Item / Type</th>
                        <th className="px-6 py-4 text-center">Date</th>
                        <th className="px-6 py-4 text-center">Amount</th>
                        <th className="px-6 py-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(255,255,255,0.02)]">
                      {recentInvoices.length === 0 ? (
                        <tr><td colSpan={4} className="text-center py-8 text-[#8a95a8] text-sm">No recent invoices</td></tr>
                      ) : recentInvoices.map((inv, i) => (
                        <tr key={i} className="hover:bg-[rgba(201,168,76,0.02)] transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded bg-[rgba(52,211,153,0.05)] border border-[rgba(52,211,153,0.1)] flex items-center justify-center">
                                <ReceiptText className="w-4 h-4 text-emerald-400" />
                              </div>
                              <span className="font-bold text-[#e8eaf0] text-sm">{inv.type === 'sell' ? 'Sale Invoice' : inv.type === 'buy' ? 'Purchase' : 'Return'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center text-xs font-medium text-[#8a95a8]">
                            {new Date(inv.date || inv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </td>
                          <td className="px-6 py-4 text-center font-black text-[#e8eaf0]">
                            ৳{Number(inv.total || 0).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded inline-block ${inv.payment_status === 'paid' ? 'bg-[#1a2235] text-emerald-400 border border-[rgba(52,211,153,0.2)]' : inv.payment_status === 'partial' ? 'bg-[#1a2235] text-[#c9a84c] border border-[rgba(201,168,76,0.2)]' : 'bg-[#2a1315] text-red-500 border border-red-500/20'}`}>
                              {inv.payment_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* ── RIGHT COLUMN (Profit & Snapshot) ── */}
            <div className="flex flex-col gap-6">

              {/* Net Profit */}
              <div className="bg-[#0b1914] rounded-2xl p-6 border border-emerald-900 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                      <Star className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-emerald-400">Net Profit</div>
                      <div className="text-[11px] text-[#4a5568]">This {salesPeriod.charAt(0).toUpperCase() + salesPeriod.slice(1)}</div>
                    </div>
                  </div>
                </div>
                <div className="text-3xl font-black text-emerald-400 mb-2">
                  {profit >= 0 ? '+' : '-'}৳{Math.abs(profit).toLocaleString()}
                </div>
              </div>

              {/* Business Snapshot */}
              <div className="bg-[#131929] rounded-2xl border border-[rgba(255,255,255,0.04)] shadow-[0_4px_24px_rgba(0,0,0,0.5)] p-5">
                <h3 className="font-black text-white text-sm mb-5">Business Snapshot</h3>
                <div className="space-y-5">
                  <div className="flex justify-between items-center text-sm">
                    <span className="flex items-center gap-3 text-[#8a95a8] font-bold"><ReceiptText className="w-4 h-4 text-pink-400" /> Total Invoices</span>
                    <span className="font-black text-[#c9a84c]">{stats.invoices}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="flex items-center gap-3 text-[#8a95a8] font-bold"><Box className="w-4 h-4 text-amber-600" /> Total Products</span>
                    <span className="font-black text-[#60a5fa]">{stats.products}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="flex items-center gap-3 text-[#8a95a8] font-bold"><Users className="w-4 h-4 text-purple-600" /> Total Staff</span>
                    <span className="font-black text-[#c9a84c]">{stats.employees}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="flex items-center gap-3 text-[#8a95a8] font-bold"><CheckCircle className="w-4 h-4 text-emerald-400" /> Attendance</span>
                    <span className="font-black text-emerald-400">{attendance.present}/{attendance.total}</span>
                  </div>
                </div>
              </div>

              {/* Team Snippet */}
              <div className="bg-[#131929] rounded-2xl border border-[rgba(255,255,255,0.04)] shadow-[0_4px_24px_rgba(0,0,0,0.5)] flex flex-col">
                <div className="px-5 py-4 flex justify-between items-center border-b border-[rgba(255,255,255,0.04)]">
                  <h3 className="flex items-center gap-3 text-[#e8eaf0] font-bold text-sm">
                    <span className="w-6 h-6 rounded bg-purple-600 flex items-center justify-center"><Users className="w-3 h-3 text-white" /></span> Team
                  </h3>
                  <Link href="/employees/list" className="font-bold text-[#c9a84c] text-[11px] hover:underline">All ➔</Link>
                </div>
                <div className="p-4 space-y-3">
                  {recentEmployees.length === 0 ? (
                    <div className="py-2 text-center text-xs text-[#8a95a8]">No employees yet</div>
                  ) : recentEmployees.map((emp, i) => (
                    <div key={i} className="flex items-center gap-3">
                      {emp.profile_image_url ? (
                        <img src={emp.profile_image_url} alt={emp.name} className="w-8 h-8 rounded-full object-cover border border-[rgba(255,255,255,0.1)]" />
                      ) : (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-xs bg-gradient-to-br from-[#8b5cf6] to-[#6366f1]">
                          {emp.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm truncate text-[#e8eaf0]">{emp.name}</div>
                        <div className="text-[10px] truncate text-[#8a95a8]">{emp.role || 'Employee'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ALERTS */}
              {(low_stock_items.length > 0 || bounced_checks.length > 0) && (
                <div className="bg-[#1a0e10] rounded-2xl border border-red-900/50 shadow-[0_4px_24px_rgba(0,0,0,0.5)] p-5">
                  <h3 className="flex items-center gap-2 font-black text-red-500 text-sm mb-4"><AlertTriangle className="w-4 h-4" /> Action Required</h3>
                  {low_stock_items.length > 0 && (
                    <div className="mb-3 text-xs font-bold text-[#8a95a8] flex justify-between">
                      <span className="text-amber-500">{low_stock_items.length} Low Stock item(s)</span>
                      <Link href="/stock" className="text-red-400 hover:underline">View ➔</Link>
                    </div>
                  )}
                  {bounced_checks.length > 0 && (
                    <div className="text-xs font-bold text-[#8a95a8] flex justify-between">
                      <span className="text-red-500">{bounced_checks.length} Bounced cheque(s)</span>
                      <Link href="/finance" className="text-red-400 hover:underline">Resolve ➔</Link>
                    </div>
                  )}
                </div>
              )}

            </div>

          </div>
        </>
      )}
    </div>
  );
}
