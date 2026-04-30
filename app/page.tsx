'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  Users, Package, CreditCard, ArrowRight, Box, UserPlus, Boxes,
  ArrowUpRight, ReceiptText, Wallet, ShoppingBag, TrendingUp,
  TrendingDown, Banknote, CheckCircle, CalendarDays, Zap,
  Activity, Clock, Star, AlertTriangle, XCircle, ShoppingCart,
  ChevronRight, Briefcase, Building2, Search, Bell, ChevronDown
} from 'lucide-react';

import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

type Period = 'day' | 'week' | 'month' | 'year';

/* ────────────────────────────────────────────────────────────
   Mini Sparkline Bar Chart
──────────────────────────────────────────────────────────── */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[1.5px] h-6 w-full">
      {data.map((val, i) => {
        const h = Math.max((val / max) * 100, 12);
        return (
          <div
            key={i}
            className="flex-1 rounded-t-[1px] transition-all"
            style={{
              height: `${h}%`,
              background: `linear-gradient(to top, ${color}22, ${color}aa)`,
            }}
          />
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   KPI Card (matches image design)
──────────────────────────────────────────────────────────── */
function KpiCard({
  title, value, sub, subColor, sparkData, sparkColor, icon: Icon, iconColor,
}: {
  title: string;
  value: string;
  sub?: string;
  subColor?: string;
  sparkData?: number[];
  sparkColor?: string;
  icon: any;
  iconColor: string;
}) {
  return (
    <div className="erp-card flex flex-col h-full relative overflow-hidden group">
      {/* bg icon watermark */}
      <div
        className="absolute right-3 top-3 opacity-[0.06] group-hover:opacity-[0.12] transition-opacity"
        style={{ color: iconColor }}
      >
        <Icon className="w-10 h-10" />
      </div>

      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${iconColor}22` }}
        >
          <Icon className="w-4 h-4" style={{ color: iconColor }} />
        </div>
        <span className="text-[11px] font-bold text-[#8a95a8] uppercase tracking-[0.1em]">{title}</span>
      </div>

      <div className="text-[22px] font-black text-white tracking-tight leading-none mb-1">{value}</div>

      {sub && (
        <div className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: subColor || '#8a95a8' }}>
          <ArrowUpRight className="w-3 h-3" />
          {sub}
        </div>
      )}

      {/* Push sparkline to the very bottom */}
      <div className="mt-auto pt-4">
        {sparkData && sparkColor && <Sparkline data={sparkData} color={sparkColor} />}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Donut Chart for Attendance
──────────────────────────────────────────────────────────── */
function DonutChart({ pct }: { pct: number }) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <svg width="96" height="96" viewBox="0 0 96 96">
      <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
      <circle
        cx="48" cy="48" r={r} fill="none"
        stroke="#f0c040" strokeWidth="10"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 48 48)"
        style={{ transition: 'stroke-dasharray 1s ease' }}
      />
      <text x="48" y="44" textAnchor="middle" fill="white" fontSize="13" fontWeight="900">{pct}%</text>
      <text x="48" y="57" textAnchor="middle" fill="#8a95a8" fontSize="8" fontWeight="600">Present</text>
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────
   Main Dashboard Page
──────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const { activeShopId, shops } = useAuth();
  const [stats, setStats] = useState({ products: 0, invoices: 0, employees: 0, customers: 0, suppliers: 0 });
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [totalDue, setTotalDue] = useState(0);
  const [salesPeriod, setSalesPeriod] = useState<Period>('month');
  const [expensePeriod, setExpensePeriod] = useState<Period>('month');
  const [salesByPeriod, setSalesByPeriod] = useState<Record<Period, number>>({ day: 0, week: 0, month: 0, year: 0 });
  const [expensesByPeriod, setExpensesByPeriod] = useState<Record<Period, number>>({ day: 0, week: 0, month: 0, year: 0 });
  const [attendance, setAttendance] = useState({ present: 0, absent: 0, on_leave: 0, total: 0 });
  const [low_stock_items, setLowStockItems] = useState<any[]>([]);
  const [sales_history, setSalesHistory] = useState<number[]>([]);
  const [expenses_history, setExpensesHistory] = useState<number[]>([]);
  const [balance_history, setBalanceHistory] = useState<number[]>([]);
  const [due_history, setDueHistory] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoicePage, setInvoicePage] = useState(1);
  const [currentDate, setCurrentDate] = useState('');

  // Set Topbar Date
  useEffect(() => {
    const date = new Date();
    setCurrentDate(date.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    }));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const dashData = await api.getDashboardStats();
        setStats({
          products: dashData.total_products ?? 0,
          invoices: dashData.total_invoices ?? 0,
          employees: dashData.total_employees ?? 0,
          customers: dashData.total_customers ?? 0,
          suppliers: dashData.total_suppliers ?? 0,
        });
        setRecentInvoices(dashData.recent_invoices ?? []);
        setTotalBalance(dashData.total_balance ?? 0);
        setTotalDue(dashData.total_due ?? 0);
        setSalesByPeriod(dashData.sales_by_period ?? { day: 0, week: 0, month: 0, year: 0 });
        setExpensesByPeriod(dashData.expenses_by_period ?? { day: 0, week: 0, month: 0, year: 0 });
        setAttendance({
          present: dashData.attendance_present ?? 0,
          absent: dashData.attendance_absent ?? 0,
          on_leave: dashData.attendance_on_leave ?? 0,
          total: dashData.total_employees ?? 0,
        });
        setLowStockItems(dashData.low_stock_items ?? []);
        setSalesHistory(dashData.sales_history ?? []);
        setExpensesHistory(dashData.expenses_history ?? []);
        setBalanceHistory(dashData.balance_history ?? []);
        setDueHistory(dashData.due_history ?? []);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [activeShopId]);

  const pct = attendance.total > 0 ? Math.round((attendance.present / attendance.total) * 100) : 0;
  const profit = salesByPeriod[salesPeriod] - expensesByPeriod[expensePeriod];
  const shopName = shops.find(s => s.id === activeShopId)?.name || 'Business Manager';

  /* Invoice status badge */
  const statusBadge = (s: string) => {
    if (s === 'paid') return 'erp-badge-paid';
    if (s === 'partial') return 'erp-badge-partial';
    if (s === 'overdue') return 'erp-badge-overdue';
    return 'erp-badge-pending';
  };

  const statusLabel = (s: string) =>
    s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Unknown';

  /* Pagination */
  const ITEMS_PER_PAGE = 5;
  const totalPages = Math.max(1, Math.ceil(recentInvoices.length / ITEMS_PER_PAGE));
  const pagedInvoices = recentInvoices.slice((invoicePage - 1) * ITEMS_PER_PAGE, invoicePage * ITEMS_PER_PAGE);

  const periodLabel: Record<Period, string> = { day: 'Today', week: 'This Week', month: 'This Month', year: 'This Year' };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-[#131929] border-t-[#c9a84c] animate-spin" />
          <p className="text-sm font-semibold text-[#8a95a8]">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen pb-16" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ════════════ TOP HEADER BAR ════════════ */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/[0.05]">
        {/* Left Section */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#c9a84c]/10 flex items-center justify-center border border-[#c9a84c]/20">
              <Building2 className="w-4 h-4 text-[#c9a84c]" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-medium text-[#8a95a8]">Business:</span>
              <span className="text-[13px] font-black text-[#c9a84c]">BrassFlow ERP</span>
            </div>
          </div>
          <div className="hidden sm:block w-px h-4 bg-white/[0.08]" />
          <div className="flex items-center gap-2 hidden sm:flex">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[12px] font-medium text-[#8a95a8]">{currentDate}</span>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4">
          <div className="relative hidden lg:block">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-[#4a5568]" />
            </div>
            <input
              type="text"
              placeholder="Search anything..."
              className="block w-64 pl-9 pr-3 py-1.5 bg-[#131929] border border-white/[0.05] rounded-xl text-[12px] text-white placeholder-[#4a5568] focus:outline-none focus:border-[#c9a84c]/50 focus:ring-1 focus:ring-[#c9a84c]/50 transition-colors"
            />
          </div>
          <button className="relative p-2 rounded-full hover:bg-white/[0.05] transition-colors">
            <Bell className="w-5 h-5 text-[#8a95a8]" />
            <span className="absolute top-1 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white border-2 border-[#0b0f1a]">
              4
            </span>
          </button>
          <button className="flex items-center gap-2 pl-2 border-l border-white/[0.08] hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-full bg-[#3b4256] flex items-center justify-center">
              <span className="text-[13px] font-bold text-white">A</span>
            </div>
            <div className="flex items-center gap-1 hidden sm:flex">
              <span className="text-[13px] font-medium text-[#c8cdd7]">Admin</span>
              <ChevronDown className="w-4 h-4 text-[#8a95a8]" />
            </div>
          </button>
        </div>
      </div>

      {/* ════════════ MAIN DASHBOARD GRID ════════════ */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 items-stretch">

        {/* ── LEFT COLUMN (Spans 3/4 width on desktop) ── */}
        <div className="xl:col-span-3 flex flex-col gap-4 h-full">

          {/* ════════════ TOP KPI ROW ════════════ */}

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">

            <KpiCard
              title="Sales This Month"
              value={`৳${salesByPeriod['month'].toLocaleString()}`}
              sub={`${salesPeriod === 'month' ? '18.6%' : ''} vs Last Month`}
              subColor="#22c55e"
              sparkData={sales_history}
              sparkColor="#22c55e"
              icon={TrendingUp}
              iconColor="#22c55e"
            />

            <KpiCard
              title="Cash Balance"
              value={`৳${Math.abs(totalBalance).toLocaleString()}`}
              sub={totalBalance >= 0 ? 'Healthy Balance' : 'Deficit'}
              subColor={totalBalance >= 0 ? '#22c55e' : '#ef4444'}
              sparkData={balance_history}
              sparkColor="#c9a84c"
              icon={Wallet}
              iconColor="#c9a84c"
            />

            <KpiCard
              title="Customer Due"
              value={`৳${totalDue.toLocaleString()}`}
              sub="12.4% vs Last Month"
              subColor="#f97316"
              sparkData={due_history}
              sparkColor="#f97316"
              icon={ReceiptText}
              iconColor="#f97316"
            />

            <KpiCard
              title="Expense"
              value={`৳${expensesByPeriod['month'].toLocaleString()}`}
              sub="6.3% vs Last Month"
              subColor="#ef4444"
              sparkData={expenses_history}
              sparkColor="#ef4444"
              icon={ArrowRight}
              iconColor="#ef4444"
            />

            <KpiCard
              title="Net Profit"
              value={`৳${Math.abs(profit).toLocaleString()}`}
              sub="22.1% vs Last Month"
              subColor={profit >= 0 ? '#22c55e' : '#ef4444'}
              sparkData={sales_history}
              sparkColor="#a855f7"
              icon={Star}
              iconColor="#a855f7"
            />
          </div>

          {/* ════════════ QUICK ACTIONS ════════════ */}
          <div className="erp-card">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-[#c9a84c]" />
              <h3 className="text-[13px] font-black text-white">Quick Actions</h3>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[
                { name: 'New Sale', icon: ShoppingBag, link: '/invoices?tab=sell', color: '#c9a84c' },
                { name: 'New Purchase', icon: ShoppingCart, link: '/invoices?tab=buy', color: '#60a5fa' },
                { name: 'Receive Payment', icon: Wallet, link: '/payments?tab=in', color: '#22c55e' },
                { name: 'Add Customer', icon: UserPlus, link: '/contacts/customers', color: '#a855f7' },
                { name: 'Add Product', icon: Package, link: '/stock', color: '#f59e0b' },
                { name: 'Attendance', icon: CalendarDays, link: '/employees/attendance-entry', color: '#f43f5e' },
              ].map((a, i) => (
                <Link
                  key={i}
                  href={a.link}
                  className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-white/5 bg-[#0d1525] hover:bg-[#1a2235] hover:border-[rgba(201,168,76,0.2)] transition-all group text-center"
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110"
                    style={{ background: `${a.color}22` }}
                  >
                    <a.icon className="w-4 h-4" style={{ color: a.color }} />
                  </div>
                  <span className="text-[10px] font-bold text-[#8a95a8] group-hover:text-white transition-colors leading-tight">{a.name}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* ── RECENT INVOICES ── */}
          <div className="erp-card flex-1 flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ReceiptText className="w-4 h-4 text-[#c9a84c]" />
                <h3 className="text-[13px] font-black text-white">Recent Invoices</h3>
              </div>
              <Link href="/invoices?tab=sell" className="text-[11px] font-bold text-[#c9a84c] hover:underline flex items-center gap-1">
                View All <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Table */}
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="py-2 pr-4 text-[10px] font-bold text-[#4a5568] uppercase tracking-wider">Invoice No</th>
                    <th className="py-2 pr-4 text-[10px] font-bold text-[#4a5568] uppercase tracking-wider">Party</th>
                    <th className="py-2 pr-4 text-[10px] font-bold text-[#4a5568] uppercase tracking-wider">Date</th>
                    <th className="py-2 pr-4 text-[10px] font-bold text-[#4a5568] uppercase tracking-wider">Amount</th>
                    <th className="py-2 text-[10px] font-bold text-[#4a5568] uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {pagedInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-[#4a5568] text-xs">No recent invoices found</td>
                    </tr>
                  ) : pagedInvoices.map((inv, i) => (
                    <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 pr-4 font-bold text-[#c9a84c]">
                        {inv.invoice_number || `INV-${String(i + 1).padStart(4, '0')}`}
                      </td>
                      <td className="py-3 pr-4 font-medium text-[#c8cdd7]">
                        {inv.party_name || inv.customer_name || 'N/A'}
                      </td>
                      <td className="py-3 pr-4 text-[#8a95a8]">
                        {new Date(inv.date || inv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="py-3 pr-4 font-black text-white">
                        ৳{Number(inv.total || 0).toLocaleString()}
                      </td>
                      <td className="py-3">
                        <span className={`erp-badge ${statusBadge(inv.payment_status)}`}>
                          {statusLabel(inv.payment_status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {recentInvoices.length > 0 && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                <span className="text-[10px] text-[#4a5568]">
                  Showing {(invoicePage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(invoicePage * ITEMS_PER_PAGE, recentInvoices.length)} of {recentInvoices.length} invoices
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setInvoicePage(p => Math.max(1, p - 1))}
                    disabled={invoicePage === 1}
                    className="w-6 h-6 rounded flex items-center justify-center text-xs bg-[#0d1525] border border-white/5 text-[#8a95a8] disabled:opacity-30 hover:border-[#c9a84c]/30 hover:text-[#c9a84c] transition-all"
                  >‹</button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => setInvoicePage(p)}
                      className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold transition-all
                        ${invoicePage === p
                          ? 'bg-[#c9a84c] text-[#0a0900]'
                          : 'bg-[#0d1525] border border-white/5 text-[#8a95a8] hover:border-[#c9a84c]/30 hover:text-[#c9a84c]'}`}
                    >{p}</button>
                  ))}
                  {totalPages > 5 && <span className="text-[#4a5568] text-xs px-1">…</span>}
                  {totalPages > 5 && (
                    <button
                      onClick={() => setInvoicePage(totalPages)}
                      className="w-7 h-6 rounded flex items-center justify-center text-[10px] font-bold bg-[#0d1525] border border-white/5 text-[#8a95a8] hover:border-[#c9a84c]/30 hover:text-[#c9a84c] transition-all"
                    >{totalPages}</button>
                  )}
                  <button
                    onClick={() => setInvoicePage(p => Math.min(totalPages, p + 1))}
                    disabled={invoicePage === totalPages}
                    className="w-6 h-6 rounded flex items-center justify-center text-xs bg-[#0d1525] border border-white/5 text-[#8a95a8] disabled:opacity-30 hover:border-[#c9a84c]/30 hover:text-[#c9a84c] transition-all"
                  >›</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN — full height, 3 sections stacked top → bottom ── */}
        <div className="flex flex-col gap-4 h-full">

          {/* ① Attendance Card */}
          <div className="erp-card flex-shrink-0">

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-[#c9a84c]" />
                <h3 className="text-[13px] font-black text-white">Attendance</h3>
              </div>
              <Link href="/employees/attendance" className="text-[11px] font-bold text-[#c9a84c] hover:underline flex items-center gap-1">
                View All <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="flex items-center gap-4">
              <DonutChart pct={pct} />
              <div className="flex flex-col gap-2.5 flex-1">
                {/* Present */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#c9a84c]" />
                    <span className="text-[12px] font-medium text-[#8a95a8]">Present</span>
                  </div>
                  <span className="text-[13px] font-black text-[#f0c040]">{attendance.present}</span>
                </div>
                {/* Absent */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-[12px] font-medium text-[#8a95a8]">Absent</span>
                  </div>
                  <span className="text-[13px] font-black text-red-400">{attendance.absent}</span>
                </div>
                {/* On Leave */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                    <span className="text-[12px] font-medium text-[#8a95a8]">On Leave</span>
                  </div>
                  <span className="text-[13px] font-black text-blue-400">{attendance.on_leave}</span>
                </div>
                {/* Divider + Total */}
                <div className="pt-2 border-t border-white/5 flex justify-between items-center">
                  <span className="text-[10px] text-[#4a5568] font-bold uppercase tracking-wider">Total Staff</span>
                  <span className="text-[12px] font-black text-white">{attendance.total}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ② Business Snapshot */}
          <div className="erp-card flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#c9a84c]" />
                <h3 className="text-[13px] font-black text-white">Business Snapshot</h3>
              </div>
              <Link href="/" className="text-[11px] font-bold text-[#c9a84c] hover:underline flex items-center gap-1">
                View All <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="flex flex-col gap-1">
              {[
                { label: 'Total Invoices',  value: stats.invoices,  icon: ReceiptText, color: '#f43f5e' },
                { label: 'Total Products',  value: stats.products,  icon: Package,     color: '#f59e0b' },
                { label: 'Total Customers', value: stats.customers, icon: Users,       color: '#a855f7' },
                { label: 'Total Staff',     value: stats.employees, icon: Briefcase,   color: '#60a5fa' },
                { label: 'Total Suppliers', value: stats.suppliers, icon: Box,         color: '#22c55e' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
                      <Icon className="w-3.5 h-3.5" style={{ color }} />
                    </div>
                    <span className="text-[12px] font-medium text-[#8a95a8]">{label}</span>
                  </div>
                  <span className="text-[13px] font-black text-white">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ③ Low Stock Alerts — always visible, shows empty state if none */}
          <div className="erp-card flex-1" style={{ borderColor: low_stock_items.length > 0 ? 'rgba(239,68,68,0.2)' : undefined }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`w-4 h-4 ${low_stock_items.length > 0 ? 'text-red-400' : 'text-[#4a5568]'}`} />
                <h3 className={`text-[13px] font-black ${low_stock_items.length > 0 ? 'text-red-400' : 'text-[#8a95a8]'}`}>
                  Low Stock Alerts
                </h3>
              </div>
              <Link href="/stock" className="text-[11px] font-bold text-[#c9a84c] hover:underline flex items-center gap-1">
                View All <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            {low_stock_items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <CheckCircle className="w-8 h-8 text-emerald-500/40 mb-2" />
                <p className="text-[11px] font-semibold text-[#4a5568]">All stock levels are healthy</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {low_stock_items.slice(0, 6).map((item: any, i: number) => {
                  const qty = item.quantity ?? 0;
                  const color = qty <= 2 ? '#ef4444' : qty <= 5 ? '#f97316' : '#f59e0b';
                  const bg    = qty <= 2 ? '#ef444418' : qty <= 5 ? '#f9731618' : '#f59e0b18';
                  return (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                          <Package className="w-3.5 h-3.5" style={{ color }} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[12px] font-bold text-[#c8cdd7] truncate">{item.name}</div>
                          <div className="text-[10px] text-[#4a5568]">SKU: {item.sku || 'N/A'}</div>
                        </div>
                      </div>
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black flex-shrink-0 ml-2"
                        style={{ background: bg, color }}
                      >
                        {qty}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

