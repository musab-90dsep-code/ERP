'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Users, Package, CreditCard, ArrowRight, Box, UserPlus, Boxes,
  ArrowUpRight, ReceiptText, Wallet, ShoppingBag, TrendingUp,
  TrendingDown, Banknote, CheckCircle, CalendarDays, Zap,
  Activity, Clock, Star, AlertTriangle, XCircle
} from 'lucide-react';
import Link from 'next/link';

type Period = 'day' | 'week' | 'month' | 'year';

export default function Dashboard() {
  const [stats, setStats] = useState({ products: 0, invoices: 0, employees: 0, checks: 0 });
  const [recentEmployees, setRecentEmployees] = useState<any[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [greeting, setGreeting] = useState('');
  const [greetingEmoji, setGreetingEmoji] = useState('👋');
  const [totalBalance, setTotalBalance] = useState(0);
  const [totalStockValue, setTotalStockValue] = useState(0);
  const [salesPeriod, setSalesPeriod] = useState<Period>('month');
  const [expensePeriod, setExpensePeriod] = useState<Period>('month');
  const [salesByPeriod, setSalesByPeriod] = useState<Record<Period, number>>({ day: 0, week: 0, month: 0, year: 0 });
  const [expensesByPeriod, setExpensesByPeriod] = useState<Record<Period, number>>({ day: 0, week: 0, month: 0, year: 0 });
  const [attendance, setAttendance] = useState({ present: 0, total: 0 });
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [bouncedChecks, setBouncedChecks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const getFrom = (p: Period) => {
    const n = new Date();
    if (p === 'day') { const d = new Date(n); d.setHours(0,0,0,0); return d.toISOString(); }
    if (p === 'week') { const d = new Date(n); d.setDate(n.getDate()-7); return d.toISOString(); }
    if (p === 'month') return new Date(n.getFullYear(), n.getMonth(), 1).toISOString();
    return new Date(n.getFullYear(), 0, 1).toISOString();
  };

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) { setGreeting('Good Morning'); setGreetingEmoji('🌅'); }
    else if (hour < 18) { setGreeting('Good Afternoon'); setGreetingEmoji('☀️'); }
    else { setGreeting('Good Evening'); setGreetingEmoji('🌙'); }

    (async () => {
      const [prod, inv, emp, chk] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('invoices').select('id', { count: 'exact', head: true }),
        supabase.from('employees').select('id', { count: 'exact', head: true }),
        supabase.from('checks').select('id', { count: 'exact', head: true }),
      ]);
      setStats({ products: prod.count??0, invoices: inv.count??0, employees: emp.count??0, checks: chk.count??0 });

      const { data: empList } = await supabase.from('employees').select('id,name,role,created_at,profile_image_url').order('created_at',{ascending:false}).limit(5);
      if (empList) setRecentEmployees(empList);

      const { data: invList } = await supabase.from('invoices').select('id,type,total,payment_status,date,created_at').order('created_at',{ascending:false}).limit(5);
      if (invList) setRecentInvoices(invList);

      // Balance
      const { data: pays } = await supabase.from('payments').select('type,amount');
      if (pays) setTotalBalance(pays.reduce((a,p) => p.type==='received' ? a+Number(p.amount||0) : p.type==='paid' ? a-Number(p.amount||0) : a, 0));

      // Stock value
      const { data: stock } = await supabase.from('products').select('stock_quantity,cost');
      if (stock) setTotalStockValue(stock.reduce((a,p) => a + Number(p.stock_quantity||0)*Number(p.cost||0), 0));

      // Sales & Expenses by period
      const periods: Period[] = ['day','week','month','year'];
      const sm: Record<Period,number> = {day:0,week:0,month:0,year:0};
      const em: Record<Period,number> = {day:0,week:0,month:0,year:0};
      for (const p of periods) {
        const fr = getFrom(p);
        const { data: sd } = await supabase.from('invoices').select('total').eq('type','sell').gte('created_at',fr);
        sm[p] = (sd||[]).reduce((a,r)=>a+Number(r.total||0),0);
        const { data: ed } = await supabase.from('invoices').select('total').eq('type','buy').gte('created_at',fr);
        em[p] = (ed||[]).reduce((a,r)=>a+Number(r.total||0),0);
      }
      setSalesByPeriod(sm);
      setExpensesByPeriod(em);

      // Today's attendance
      const today = new Date().toISOString().split('T')[0];
      const { data: att } = await supabase.from('attendance').select('status').eq('date',today);
      setAttendance({ present: (att||[]).filter(a=>a.status==='present'||a.status==='half').length, total: emp.count??0 });

      // Low stock items (stock_quantity <= minimum_stock or very low)
      const { data: lowStock } = await supabase
        .from('products')
        .select('id,name,stock_quantity,unit,minimum_stock')
        .order('stock_quantity', { ascending: true })
        .limit(10);
      if (lowStock) {
        setLowStockItems(lowStock.filter(p => {
          const minStock = Number(p.minimum_stock || 5);
          return Number(p.stock_quantity || 0) <= minStock;
        }));
      }

      // Bounced cheques
      const { data: bounced } = await supabase
        .from('checks')
        .select('id,check_number,amount,contacts(name),alert_date,cash_date,bank_name')
        .eq('status','bounced')
        .order('alert_date', { ascending: false })
        .limit(10);
      if (bounced) setBouncedChecks(bounced);

      setLoading(false);
    })();
  }, []);

  const pct = attendance.total > 0 ? Math.round((attendance.present/attendance.total)*100) : 0;
  const periodLabel: Record<Period,string> = { day:'Today', week:'This Week', month:'This Month', year:'This Year' };
  const profit = salesByPeriod[salesPeriod] - expensesByPeriod[expensePeriod];

  const statusStyle = (s: string) => {
    if (s==='paid') return { bg:'#dcfce7', color:'#15803d' };
    if (s==='partial') return { bg:'#fef9c3', color:'#854d0e' };
    return { bg:'#fee2e2', color:'#b91c1c' };
  };

  const avatarGrads = [
    'linear-gradient(135deg,#6366f1,#8b5cf6)',
    'linear-gradient(135deg,#059669,#10b981)',
    'linear-gradient(135deg,#0ea5e9,#2563eb)',
    'linear-gradient(135deg,#d97706,#f59e0b)',
    'linear-gradient(135deg,#e11d48,#f43f5e)',
  ];

  const quickActions = [
    { name:'New Sale Invoice', desc:'Create a sell invoice', icon:ShoppingBag, link:'/invoices?tab=sell', color:'#6366f1', bg:'#eef2ff' },
    { name:'New Purchase', desc:'Record a buying invoice', icon:Box, link:'/invoices?tab=buy', color:'#0ea5e9', bg:'#e0f2fe' },
    { name:'Log Payment', desc:'Record received or paid', icon:Wallet, link:'/payments?tab=in', color:'#10b981', bg:'#d1fae5' },
    { name:'Add Employee', desc:'Register new staff member', icon:UserPlus, link:'/employees/list', color:'#8b5cf6', bg:'#ede9fe' },
    { name:'Update Inventory', desc:'Add or adjust stock', icon:Package, link:'/stock', color:'#f59e0b', bg:'#fef3c7' },
    { name:'Mark Attendance', desc:'Track today\'s presence', icon:CalendarDays, link:'/employees/attendance-entry', color:'#e11d48', bg:'#ffe4e6' },
  ];

  return (
    <div className="pb-16 w-full" style={{ maxWidth: 1400, margin: '0 auto', fontFamily: "'Inter', sans-serif" }}>

      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-3xl mb-8 text-white"
        style={{ background: 'linear-gradient(135deg, #0f0c29 0%, #1e1b4b 35%, #302b63 70%, #24243e 100%)', padding:'clamp(28px,5vw,48px)' }}>
        {/* Decorative orbs */}
        <div className="absolute pointer-events-none" style={{top:-60,right:-60,width:240,height:240,borderRadius:'50%',background:'rgba(99,102,241,.15)',filter:'blur(40px)'}} />
        <div className="absolute pointer-events-none" style={{bottom:-40,left:'30%',width:180,height:180,borderRadius:'50%',background:'rgba(139,92,246,.1)',filter:'blur(30px)'}} />
        {/* Grid */}
        <div className="absolute inset-0 pointer-events-none opacity-[.06]"
          style={{backgroundImage:'linear-gradient(rgba(255,255,255,.4) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.4) 1px,transparent 1px)',backgroundSize:'44px 44px'}} />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{background:'#4ade80'}} />
              <span className="text-xs font-bold tracking-widest uppercase" style={{color:'rgba(255,255,255,.4)'}}>
                {new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
              </span>
            </div>
            <h1 className="font-black leading-tight mb-2" style={{fontSize:'clamp(28px,4.5vw,44px)'}}>
              {greetingEmoji} {greeting}, Admin!
            </h1>
            <p style={{color:'rgba(255,255,255,.55)',fontSize:'clamp(13px,1.5vw,15px)',maxWidth:480}}>
              Here's what's happening with your business today. Stay informed and act fast.
            </p>
            {/* Mini live stats */}
            <div className="flex gap-4 mt-4 flex-wrap">
              {[
                {label:'Total Invoices', val: stats.invoices, icon:'📋'},
                {label:'Active Staff', val: stats.employees, icon:'👥'},
                {label:'Products', val: stats.products, icon:'📦'},
              ].map((s,i)=>(
                <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.12)'}}>
                  <span className="text-sm">{s.icon}</span>
                  <div>
                    <div className="font-black text-sm">{loading ? '...' : s.val}</div>
                    <div className="text-[10px]" style={{color:'rgba(255,255,255,.4)'}}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link href="/invoices?tab=sell"
              className="inline-flex items-center gap-2 text-sm font-bold rounded-xl transition-all duration-200 hover:scale-105"
              style={{padding:'11px 20px',background:'rgba(255,255,255,.12)',border:'1px solid rgba(255,255,255,.2)',backdropFilter:'blur(12px)',textDecoration:'none',color:'#fff'}}>
              <ShoppingBag className="w-4 h-4"/> New Sale
            </Link>
            <Link href="/invoices?tab=buy"
              className="inline-flex items-center gap-2 text-sm font-bold rounded-xl transition-all duration-200 hover:scale-105"
              style={{padding:'11px 20px',background:'#fff',color:'#312e81',textDecoration:'none'}}>
              <Box className="w-4 h-4"/> New Purchase
            </Link>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-2xl animate-pulse" style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)'}} />
            <p className="text-sm font-semibold" style={{color:'#9ca3af'}}>Loading dashboard...</p>
          </div>
        </div>
      ) : (
        <>
          {/* ── Overview Dashboard KPIs ── */}
          <div className="mb-3 flex items-center gap-2.5">
        <div className="w-1 h-5 rounded-full" style={{background:'linear-gradient(180deg,#6366f1,#8b5cf6)'}} />
        <h2 className="font-black text-sm tracking-wide" style={{color:'#111827'}}>OVERVIEW DASHBOARD</h2>
        <div className="flex-1 h-px" style={{background:'#f3f4f6'}} />
        <span className="text-[11px] font-semibold flex items-center gap-1" style={{color:'#9ca3af'}}>
          <Activity className="w-3 h-3"/> Live
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-8">

        {/* 1. Total Balance */}
        <div className="rounded-2xl p-5 relative overflow-hidden flex flex-col" style={{background:'#fff',boxShadow:'0 1px 4px rgba(0,0,0,.06)',border:'1px solid #f0f0f5'}}>
          <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl" style={{background:'linear-gradient(90deg,#6366f1,#8b5cf6)'}} />
          <div className="flex items-start justify-between mb-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg" style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)'}}>
              <Banknote className="w-5 h-5 text-white"/>
            </div>
            <span className="text-[10px] font-black px-2.5 py-1 rounded-full" style={{background:'#eef2ff',color:'#6366f1'}}>NET</span>
          </div>
          <div className="font-black text-3xl mb-0.5" style={{color: totalBalance >= 0 ? '#111827' : '#dc2626', lineHeight:1}}>
            ৳{Math.abs(totalBalance).toLocaleString()}
          </div>
          <div className="text-xs font-bold mb-3" style={{color:'#6b7280'}}>Total Balance</div>
          <div className="mt-auto flex items-center gap-1.5 text-[11px] font-bold" style={{color: totalBalance >= 0 ? '#16a34a' : '#dc2626'}}>
            {totalBalance >= 0 ? <TrendingUp className="w-3.5 h-3.5"/> : <TrendingDown className="w-3.5 h-3.5"/>}
            {totalBalance >= 0 ? 'Positive Cash Flow' : 'Negative — review expenses'}
          </div>
        </div>

        {/* 2. Total Stock Value */}
        <div className="rounded-2xl p-5 relative overflow-hidden flex flex-col" style={{background:'#fff',boxShadow:'0 1px 4px rgba(0,0,0,.06)',border:'1px solid #f0f0f5'}}>
          <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl" style={{background:'linear-gradient(90deg,#0ea5e9,#2563eb)'}} />
          <div className="flex items-start justify-between mb-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg" style={{background:'linear-gradient(135deg,#0ea5e9,#2563eb)'}}>
              <Boxes className="w-5 h-5 text-white"/>
            </div>
            <span className="text-[10px] font-black px-2.5 py-1 rounded-full" style={{background:'#e0f2fe',color:'#0284c7'}}>{stats.products} SKUs</span>
          </div>
          <div className="font-black text-3xl mb-0.5" style={{color:'#111827',lineHeight:1}}>
            ৳{totalStockValue.toLocaleString()}
          </div>
          <div className="text-xs font-bold mb-3" style={{color:'#6b7280'}}>Total Stock Value</div>
          <div className="mt-auto flex items-center gap-1.5 text-[11px] font-bold" style={{color:'#0284c7'}}>
            <Package className="w-3.5 h-3.5"/> {stats.products} product types in stock
          </div>
        </div>

        {/* 3. Total Sales */}
        <div className="rounded-2xl p-5 relative overflow-hidden flex flex-col" style={{background:'#fff',boxShadow:'0 1px 4px rgba(0,0,0,.06)',border:'1px solid #f0f0f5'}}>
          <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl" style={{background:'linear-gradient(90deg,#10b981,#059669)'}} />
          <div className="flex items-start justify-between mb-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg" style={{background:'linear-gradient(135deg,#10b981,#059669)'}}>
              <TrendingUp className="w-5 h-5 text-white"/>
            </div>
            <div className="flex gap-1">
              {(['day','week','month','year'] as Period[]).map(p=>(
                <button key={p} onClick={()=>setSalesPeriod(p)}
                  className="text-[10px] font-black px-2 py-1 rounded-lg transition-all"
                  style={{background: salesPeriod===p ? '#10b981':'#f0fdf4', color: salesPeriod===p?'#fff':'#059669'}}>
                  {p==='day'?'D':p==='week'?'W':p==='month'?'M':'Y'}
                </button>
              ))}
            </div>
          </div>
          <div className="font-black text-3xl mb-0.5" style={{color:'#111827',lineHeight:1}}>
            ৳{salesByPeriod[salesPeriod].toLocaleString()}
          </div>
          <div className="text-xs font-bold mb-3" style={{color:'#6b7280'}}>Total Sales</div>
          <div className="mt-auto flex items-center gap-1.5 text-[11px] font-bold" style={{color:'#059669'}}>
            <Clock className="w-3.5 h-3.5"/> {periodLabel[salesPeriod]}
          </div>
        </div>

        {/* 4. Total Expenses */}
        <div className="rounded-2xl p-5 relative overflow-hidden flex flex-col" style={{background:'#fff',boxShadow:'0 1px 4px rgba(0,0,0,.06)',border:'1px solid #f0f0f5'}}>
          <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl" style={{background:'linear-gradient(90deg,#f59e0b,#d97706)'}} />
          <div className="flex items-start justify-between mb-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg" style={{background:'linear-gradient(135deg,#f59e0b,#d97706)'}}>
              <TrendingDown className="w-5 h-5 text-white"/>
            </div>
            <div className="flex gap-1">
              {(['day','week','month','year'] as Period[]).map(p=>(
                <button key={p} onClick={()=>setExpensePeriod(p)}
                  className="text-[10px] font-black px-2 py-1 rounded-lg transition-all"
                  style={{background: expensePeriod===p?'#f59e0b':'#fffbeb', color: expensePeriod===p?'#fff':'#d97706'}}>
                  {p==='day'?'D':p==='week'?'W':p==='month'?'M':'Y'}
                </button>
              ))}
            </div>
          </div>
          <div className="font-black text-3xl mb-0.5" style={{color:'#111827',lineHeight:1}}>
            ৳{expensesByPeriod[expensePeriod].toLocaleString()}
          </div>
          <div className="text-xs font-bold mb-3" style={{color:'#6b7280'}}>Total Expenses</div>
          <div className="mt-auto flex items-center gap-1.5 text-[11px] font-bold" style={{color:'#d97706'}}>
            <Clock className="w-3.5 h-3.5"/> {periodLabel[expensePeriod]}
          </div>
        </div>

        {/* 5. Today's Attendance */}
        <div className="rounded-2xl p-5 relative overflow-hidden flex flex-col" style={{background:'#fff',boxShadow:'0 1px 4px rgba(0,0,0,.06)',border:'1px solid #f0f0f5'}}>
          <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl" style={{background:'linear-gradient(90deg,#8b5cf6,#6366f1)'}} />
          <div className="flex items-start justify-between mb-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg" style={{background:'linear-gradient(135deg,#8b5cf6,#6366f1)'}}>
              <CalendarDays className="w-5 h-5 text-white"/>
            </div>
            <Link href="/employees/attendance-entry" className="text-[10px] font-black px-2.5 py-1 rounded-full transition-all hover:opacity-80" style={{background:'#ede9fe',color:'#7c3aed',textDecoration:'none'}}>
              Mark →
            </Link>
          </div>
          <div className="flex items-end gap-1.5 mb-1">
            <div className="font-black text-3xl" style={{color:'#111827',lineHeight:1}}>{attendance.present}</div>
            <div className="font-bold text-xl mb-0.5" style={{color:'#d1d5db'}}>/ {attendance.total}</div>
          </div>
          <div className="text-xs font-bold mb-3" style={{color:'#6b7280'}}>Today&apos;s Attendance</div>
          {/* Progress bar */}
          <div className="w-full h-2 rounded-full mb-2" style={{background:'#ede9fe'}}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{width:`${pct}%`,background:'linear-gradient(90deg,#8b5cf6,#6366f1)'}} />
          </div>
          <div className="mt-auto flex items-center gap-1.5 text-[11px] font-bold"
            style={{color: pct>=75?'#16a34a':pct>=50?'#d97706':'#dc2626'}}>
            <CheckCircle className="w-3.5 h-3.5"/> {pct}% Present Today
          </div>
        </div>

      </div>

      {/* ── Secondary Grid ── */}
      <div className="mb-3 flex items-center gap-2.5">
        <div className="w-1 h-5 rounded-full" style={{background:'linear-gradient(180deg,#10b981,#059669)'}} />
        <h2 className="font-black text-sm tracking-wide" style={{color:'#111827'}}>WORKSPACE</h2>
        <div className="flex-1 h-px" style={{background:'#f3f4f6'}} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Quick Actions */}
        <div className="rounded-2xl overflow-hidden" style={{background:'#fff',boxShadow:'0 1px 4px rgba(0,0,0,.06)',border:'1px solid #f0f0f5'}}>
          <div className="px-5 py-4 flex items-center justify-between" style={{borderBottom:'1px solid #f8f8f8'}}>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)'}}>
                <Zap className="w-3.5 h-3.5 text-white"/>
              </div>
              <span className="font-black text-sm" style={{color:'#111827'}}>Quick Actions</span>
            </div>
            <span className="text-[11px] font-semibold" style={{color:'#9ca3af'}}>Shortcuts</span>
          </div>
          <div className="p-3">
            {quickActions.map((a,i)=>{
              const Icon = a.icon;
              return (
                <Link key={i} href={a.link} style={{textDecoration:'none',display:'block'}}>
                  <div className="group flex items-center gap-3 p-3 rounded-xl transition-all duration-150 cursor-pointer"
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background='#fafafa';(e.currentTarget as HTMLElement).style.transform='translateX(4px)';}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background='transparent';(e.currentTarget as HTMLElement).style.transform='translateX(0)';}}>
                    <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center" style={{background:a.bg}}>
                      <Icon className="w-4 h-4" style={{color:a.color}}/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate" style={{color:'#111827'}}>{a.name}</div>
                      <div className="text-xs truncate" style={{color:'#9ca3af'}}>{a.desc}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 flex-shrink-0 opacity-30" style={{color:'#6b7280'}}/>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Recent Invoices */}
        <div className="rounded-2xl overflow-hidden" style={{background:'#fff',boxShadow:'0 1px 4px rgba(0,0,0,.06)',border:'1px solid #f0f0f5'}}>
          <div className="px-5 py-4 flex items-center justify-between" style={{borderBottom:'1px solid #f8f8f8'}}>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{background:'linear-gradient(135deg,#10b981,#059669)'}}>
                <ReceiptText className="w-3.5 h-3.5 text-white"/>
              </div>
              <span className="font-black text-sm" style={{color:'#111827'}}>Recent Invoices</span>
            </div>
            <Link href="/invoices?tab=sell" className="text-[11px] font-bold" style={{color:'#6366f1',textDecoration:'none'}}>View all →</Link>
          </div>

          <div className="divide-y" style={{borderColor:'#fafafa'}}>
            {recentInvoices.length===0 ? (
              <div className="py-12 text-center">
                <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{background:'#f9fafb'}}>
                  <ReceiptText className="w-6 h-6" style={{color:'#d1d5db'}}/>
                </div>
                <p className="text-sm font-semibold" style={{color:'#9ca3af'}}>No invoices yet</p>
                <Link href="/invoices?tab=sell" className="text-sm font-bold" style={{color:'#6366f1',textDecoration:'none'}}>Create first →</Link>
              </div>
            ) : recentInvoices.map((inv,i)=>{
              const sc = statusStyle(inv.payment_status);
              const isS = inv.type==='sell', isB = inv.type==='buy';
              return (
                <div key={i} className="flex items-center gap-3 px-5 py-3.5 transition-colors"
                  onMouseEnter={e=>(e.currentTarget.style.background='#fafafa')}
                  onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                  <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center"
                    style={{background: isS?'#f0fdf4':isB?'#eff6ff':'#fff7ed'}}>
                    <ReceiptText className="w-4 h-4" style={{color: isS?'#22c55e':isB?'#3b82f6':'#f97316'}}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm" style={{color:'#111827'}}>
                      {isS?'Sale Invoice':isB?'Purchase':'Return'}
                    </div>
                    <div className="text-xs" style={{color:'#9ca3af'}}>
                      {new Date(inv.date||inv.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit'})}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-black text-sm" style={{color:'#111827'}}>৳{Number(inv.total||0).toLocaleString()}</div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{background:sc.bg,color:sc.color}}>
                      {inv.payment_status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Profit Summary + Team */}
        <div className="flex flex-col gap-5">

          {/* Net Profit Card */}
          <div className="rounded-2xl p-5 relative overflow-hidden" style={{background: profit>=0 ? 'linear-gradient(135deg,#f0fdf4,#dcfce7)' : 'linear-gradient(135deg,#fff1f2,#ffe4e6)', border: profit>=0 ? '1px solid #bbf7d0' : '1px solid #fecdd3'}}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background: profit>=0?'#16a34a':'#dc2626'}}>
                <Star className="w-5 h-5 text-white"/>
              </div>
              <div>
                <div className="text-xs font-bold" style={{color: profit>=0?'#15803d':'#b91c1c'}}>Net Profit (this {salesPeriod})</div>
                <div className="text-xs" style={{color: profit>=0?'#16a34a99':'#dc262699'}}>Sales minus Expenses</div>
              </div>
            </div>
            <div className="font-black text-3xl" style={{color: profit>=0?'#15803d':'#b91c1c',lineHeight:1}}>
              {profit>=0?'+':'-'}৳{Math.abs(profit).toLocaleString()}
            </div>
          </div>

          {/* Team */}
          <div className="rounded-2xl overflow-hidden flex-1" style={{background:'#fff',boxShadow:'0 1px 4px rgba(0,0,0,.06)',border:'1px solid #f0f0f5'}}>
            <div className="px-5 py-4 flex items-center justify-between" style={{borderBottom:'1px solid #f8f8f8'}}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{background:'linear-gradient(135deg,#8b5cf6,#6366f1)'}}>
                  <Users className="w-3.5 h-3.5 text-white"/>
                </div>
                <span className="font-black text-sm" style={{color:'#111827'}}>Team Members</span>
              </div>
              <Link href="/employees/list" className="text-[11px] font-bold" style={{color:'#6366f1',textDecoration:'none'}}>See all →</Link>
            </div>
            <div className="p-4 space-y-3">
              {recentEmployees.length===0 ? (
                <div className="py-6 text-center">
                  <Users className="w-9 h-9 mx-auto mb-2 opacity-20"/>
                  <p className="text-sm" style={{color:'#9ca3af'}}>No employees yet</p>
                </div>
              ) : recentEmployees.map((emp,i)=>(
                <div key={i} className="flex items-center gap-3">
                  {emp.profile_image_url ? (
                    <img src={emp.profile_image_url} alt={emp.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0 border-2" style={{borderColor:'#f0f0f5'}}/>
                  ) : (
                    <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white font-black text-sm"
                      style={{background: avatarGrads[i%avatarGrads.length]}}>
                      {emp.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate" style={{color:'#111827'}}>{emp.name}</div>
                    <div className="text-xs truncate" style={{color:'#9ca3af'}}>{emp.role||'Employee'}</div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 flex-shrink-0 opacity-20"/>
                </div>
              ))}
            </div>
            <div className="px-4 pb-4">
              <Link href="/employees/list"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-bold text-sm transition-all"
                style={{background:'#eef2ff',color:'#6366f1',textDecoration:'none'}}
                onMouseEnter={e=>(e.currentTarget.style.background='#e0e7ff')}
                onMouseLeave={e=>(e.currentTarget.style.background='#eef2ff')}>
                <UserPlus className="w-4 h-4"/> Add New Employee
              </Link>
            </div>
          </div>

        </div>
      </div>

      {/* ── Alert Panels ── */}
      {(lowStockItems.length > 0 || bouncedChecks.length > 0) && (
        <div className="mt-8">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="w-1 h-5 rounded-full" style={{background:'linear-gradient(180deg,#ef4444,#f97316)'}} />
            <h2 className="font-black text-sm tracking-wide" style={{color:'#111827'}}>ALERTS & WARNINGS</h2>
            <div className="flex-1 h-px" style={{background:'#f3f4f6'}} />
            {(lowStockItems.length + bouncedChecks.length) > 0 && (
              <span className="text-[11px] font-black px-2.5 py-1 rounded-full flex items-center gap-1" style={{background:'#fee2e2',color:'#dc2626'}}>
                <AlertTriangle className="w-3 h-3"/> {lowStockItems.length + bouncedChecks.length} Alerts
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Low Stock Alert */}
            <div className="rounded-2xl overflow-hidden" style={{background:'#fff',border:'1px solid #fed7aa',boxShadow:'0 1px 4px rgba(249,115,22,.08)'}}>
              <div className="px-5 py-4 flex items-center justify-between" style={{background:'linear-gradient(135deg,#fff7ed,#ffedd5)',borderBottom:'1px solid #fed7aa'}}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{background:'linear-gradient(135deg,#f97316,#ea580c)'}}>
                    <AlertTriangle className="w-4 h-4 text-white"/>
                  </div>
                  <div>
                    <div className="font-black text-sm" style={{color:'#9a3412'}}>Low Stock Alert</div>
                    <div className="text-[11px]" style={{color:'#c2410c'}}>{lowStockItems.length} product{lowStockItems.length !== 1 ? 's' : ''} need restocking</div>
                  </div>
                </div>
                <Link href="/stock" className="text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all" style={{background:'#f97316',color:'#fff',textDecoration:'none'}}>
                  Manage Stock →
                </Link>
              </div>
              {lowStockItems.length === 0 ? (
                <div className="py-10 text-center">
                  <CheckCircle className="w-10 h-10 mx-auto mb-2" style={{color:'#22c55e'}}/>
                  <p className="text-sm font-semibold" style={{color:'#16a34a'}}>All products are well-stocked!</p>
                </div>
              ) : (
                <div className="divide-y" style={{borderColor:'#fff7ed'}}>
                  {lowStockItems.map((p, i) => {
                    const qty = Number(p.stock_quantity || 0);
                    const min = Number(p.minimum_stock || 5);
                    const isCritical = qty === 0;
                    return (
                      <div key={i} className="flex items-center gap-3 px-5 py-3.5 transition-colors"
                        onMouseEnter={e => (e.currentTarget.style.background = '#fff7ed')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{background: isCritical ? '#fee2e2' : '#fff7ed'}}>
                          <Package className="w-4 h-4" style={{color: isCritical ? '#dc2626' : '#f97316'}}/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm truncate" style={{color:'#111827'}}>{p.name}</div>
                          <div className="text-xs" style={{color:'#9ca3af'}}>Min required: {min} {p.unit || 'pcs'}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-black text-sm" style={{color: isCritical ? '#dc2626' : '#f97316'}}>
                            {qty} <span className="font-medium text-xs" style={{color:'#9ca3af'}}>{p.unit || 'pcs'}</span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{background: isCritical ? '#fee2e2' : '#fff7ed', color: isCritical ? '#dc2626' : '#ea580c'}}>
                            {isCritical ? 'OUT OF STOCK' : 'LOW'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cheque Bounce Alert */}
            <div className="rounded-2xl overflow-hidden" style={{background:'#fff',border:'1px solid #fecaca',boxShadow:'0 1px 4px rgba(239,68,68,.08)'}}>
              <div className="px-5 py-4 flex items-center justify-between" style={{background:'linear-gradient(135deg,#fff1f2,#ffe4e6)',borderBottom:'1px solid #fecaca'}}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{background:'linear-gradient(135deg,#ef4444,#dc2626)'}}>
                    <XCircle className="w-4 h-4 text-white"/>
                  </div>
                  <div>
                    <div className="font-black text-sm" style={{color:'#991b1b'}}>Cheque Bounce Alert</div>
                    <div className="text-[11px]" style={{color:'#b91c1c'}}>{bouncedChecks.length} bounced cheque{bouncedChecks.length !== 1 ? 's' : ''} need action</div>
                  </div>
                </div>
                <Link href="/finance" className="text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all" style={{background:'#ef4444',color:'#fff',textDecoration:'none'}}>
                  View Finance →
                </Link>
              </div>
              {bouncedChecks.length === 0 ? (
                <div className="py-10 text-center">
                  <CheckCircle className="w-10 h-10 mx-auto mb-2" style={{color:'#22c55e'}}/>
                  <p className="text-sm font-semibold" style={{color:'#16a34a'}}>No bounced cheques found!</p>
                </div>
              ) : (
                <div className="divide-y" style={{borderColor:'#fff1f2'}}>
                  {bouncedChecks.map((c, i) => (
                    <div key={i} className="flex items-center gap-3 px-5 py-3.5 transition-colors"
                      onMouseEnter={e => (e.currentTarget.style.background = '#fff1f2')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:'#fee2e2'}}>
                        <CreditCard className="w-4 h-4" style={{color:'#dc2626'}}/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm truncate" style={{color:'#111827'}}>
                          {c.contacts?.name || 'Unknown Issuer'}
                        </div>
                        <div className="text-xs" style={{color:'#9ca3af'}}>
                          #{c.check_number || 'N/A'} · {c.bank_name || 'Unknown Bank'}
                          {(c.alert_date || c.cash_date) && ` · ${new Date(c.alert_date || c.cash_date).toLocaleDateString('en-US',{month:'short',day:'numeric'})}`}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-black text-sm" style={{color:'#dc2626'}}>৳{Number(c.amount||0).toLocaleString()}</div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{background:'#fee2e2',color:'#b91c1c'}}>BOUNCED</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}
      </>
      )}

    </div>
  );
}
