const fs = require('fs');

const file = 'app/page.tsx';
let content = fs.readFileSync(file, 'utf-8');

// Find the return statement
const returnIndex = content.indexOf('return (');
if (returnIndex === -1) {
  console.log("Could not find start of return statement.");
  process.exit(1);
}

const beforeReturn = content.substring(0, returnIndex);

const newJSX = `return (
    <div className="pb-16 w-full min-h-screen bg-[#0b0f1a] rounded-lg p-6 max-w-[1400px] mx-auto" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-8 mt-2">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs font-bold tracking-[0.2em] text-[#8a95a8] uppercase">
              {new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
            </span>
          </div>
          <h1 className="flex items-center gap-3 text-3xl font-black text-[#c9a84c] tracking-tight">
            <span>🌙</span> BRASSFLOW ERP <span className="text-[#4a5568] font-semibold text-2xl mx-1">•</span> <span className="text-[#8a95a8] font-medium text-xl tracking-normal">Business Manager</span>
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
            
            {/* Total Balance */}
            <div className="bg-[#131929] rounded-2xl p-5 border border-[rgba(255,255,255,0.04)] shadow-[0_4px_24px_rgba(0,0,0,0.5)] flex flex-col justify-between overflow-hidden relative">
              <div>
                <div className="text-[10px] uppercase font-bold text-[#8a95a8] tracking-widest mb-1">TOTAL BALANCE</div>
                <div className="text-2xl font-black text-white mb-1">৳{Math.abs(totalBalance).toLocaleString()}</div>
                <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                  <TrendingUp className="w-3 h-3" /> Positive
                </div>
              </div>
              <div className="mt-6 flex items-end gap-1 h-12">
                {[40, 60, 45, 75, 55, 90, 30].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t-sm bg-gradient-to-t from-[rgba(201,168,76,0.2)] to-[rgba(201,168,76,0.6)]" style={{ height: \`\${h}%\` }} />
                ))}
              </div>
            </div>

            {/* Stock Value */}
            <div className="bg-[#131929] rounded-2xl p-5 border border-[rgba(255,255,255,0.04)] shadow-[0_4px_24px_rgba(0,0,0,0.5)] flex flex-col justify-between overflow-hidden relative">
              <div>
                <div className="text-[10px] uppercase font-bold text-[#8a95a8] tracking-widest mb-1">STOCK VALUE</div>
                <div className="text-2xl font-black text-white mb-1">৳{(totalStockValue/1000).toFixed(1)}K</div>
                <div className="text-[11px] font-bold text-[#60a5fa]">{stats.products} SKUs in stock</div>
              </div>
              <div className="mt-6 flex items-end gap-1 h-12">
                {[60, 80, 50, 40, 70, 90, 80].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t-sm bg-gradient-to-t from-[rgba(59,130,246,0.2)] to-[rgba(59,130,246,0.7)]" style={{ height: \`\${h}%\` }} />
                ))}
              </div>
            </div>

            {/* Total Sales */}
            <div className="bg-[#131929] rounded-2xl p-5 border border-[rgba(255,255,255,0.04)] shadow-[0_4px_24px_rgba(0,0,0,0.5)] flex flex-col justify-between overflow-hidden relative">
               <div className="flex justify-between items-start">
                 <div>
                   <div className="flex items-center gap-2 mb-1">
                     <span className="text-[10px] uppercase font-bold text-[#8a95a8] tracking-widest">TOTAL SALES</span>
                     <div className="flex gap-1">
                       {(['day','week','month','year'] as Period[]).map(p=>(
                         <button key={p} onClick={()=>setSalesPeriod(p)} className={\`text-[9px] font-black w-4 h-4 rounded flex items-center justify-center \${salesPeriod===p ? 'bg-[#c9a84c] text-black' : 'text-[#8a95a8]'}\`}>
                           {p.charAt(0).toUpperCase()}
                         </button>
                       ))}
                     </div>
                   </div>
                   <div className="text-2xl font-black text-white mb-1">৳{salesByPeriod[salesPeriod].toLocaleString()}</div>
                   <div className="text-[11px] font-bold text-emerald-400">This {salesPeriod.charAt(0).toUpperCase() + salesPeriod.slice(1)}</div>
                 </div>
               </div>
               <div className="mt-6 h-12 relative overflow-hidden">
                 <div className="absolute inset-x-0 bottom-0 top-auto h-12 border-b-2 border-emerald-400" 
                      style={{ background: 'linear-gradient(180deg, rgba(52,211,153,0.3) 0%, rgba(52,211,153,0) 100%)', clipPath: 'polygon(0 80%, 20% 60%, 40% 70%, 60% 40%, 80% 50%, 100% 20%, 100% 100%, 0 100%)' }} />
               </div>
            </div>

            {/* Expenses */}
            <div className="bg-[#131929] rounded-2xl p-5 border border-[rgba(255,255,255,0.04)] shadow-[0_4px_24px_rgba(0,0,0,0.5)] flex flex-col justify-between overflow-hidden relative">
               <div className="flex justify-between items-start">
                 <div>
                   <div className="flex items-center gap-2 mb-1">
                     <span className="text-[10px] uppercase font-bold text-[#8a95a8] tracking-widest">EXPENSES</span>
                     <div className="flex gap-1">
                       {(['day','week','month','year'] as Period[]).map(p=>(
                         <button key={p} onClick={()=>setExpensePeriod(p)} className={\`text-[9px] font-black w-4 h-4 rounded flex items-center justify-center \${expensePeriod===p ? 'bg-[#c9a84c] text-black' : 'text-[#8a95a8]'}\`}>
                           {p.charAt(0).toUpperCase()}
                         </button>
                       ))}
                     </div>
                   </div>
                   <div className="text-2xl font-black text-white mb-1">৳{expensesByPeriod[expensePeriod].toLocaleString()}</div>
                   <div className="text-[11px] font-bold text-emerald-400">Net: {profit >= 0 ? '+' : ''}{profit.toLocaleString()}</div>
                 </div>
               </div>
               <div className="mt-6 flex items-end gap-1 h-12">
                 {[40, 30, 45, 30, 50, 40, 60, 30, 45].map((h, i) => (
                   <div key={i} className="flex-1 rounded-t-sm bg-[#f59e0b]" style={{ height: \`\${h}%\` }} />
                 ))}
               </div>
            </div>

            {/* Attendance */}
            <div className="bg-[#131929] rounded-2xl p-5 border border-[rgba(255,255,255,0.04)] shadow-[0_4px_24px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center relative overflow-hidden">
               <div className="text-[10px] uppercase font-bold text-[#8a95a8] tracking-widest mb-4 absolute top-5 left-5">ATTENDANCE</div>
               <div className="relative w-20 h-20 flex items-center justify-center rounded-full mt-4" style={{ background: \`conic-gradient(#a855f7 \${pct}%, rgba(255,255,255,0.05) 0)\`, boxShadow: '0 0 20px rgba(168,85,247,0.4)' }}>
                 <div className="w-16 h-16 bg-[#131929] rounded-full flex items-center justify-center z-10 font-black text-white text-lg">
                   {pct}%
                 </div>
               </div>
               <div className="text-[11px] font-bold text-[#8a95a8] mt-3">{attendance.present}/{attendance.total} Present</div>
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
                <div className="flex flex-wrap gap-3">
                  {[
                    { name:'New Sale', icon:ShoppingBag, link:'/invoices?tab=sell', color:'#c9a84c' },
                    { name:'Purchase', icon:Box, link:'/invoices?tab=buy', color:'#60a5fa' },
                    { name:'Payment', icon:Wallet, link:'/payments?tab=in', color:'#10b981' },
                    { name:'Employee', icon:UserPlus, link:'/employees/list', color:'#a855f7' },
                    { name:'Inventory', icon:Package, link:'/stock', color:'#f59e0b' },
                    { name:'Attendance', icon:CalendarDays, link:'/employees/attendance-entry', color:'#f43f5e' },
                  ].map((a, i) => (
                    <Link key={i} href={a.link} className="flex-1 min-w-[100px] flex flex-col items-center justify-center gap-2 bg-[#1a2235] border border-[rgba(201,168,76,0.1)] p-4 rounded-xl transition hover:bg-[#232d43] hover:border-[rgba(201,168,76,0.3)] group text-center">
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
                      {recentInvoices.length===0 ? (
                        <tr><td colSpan={4} className="text-center py-8 text-[#8a95a8] text-sm">No recent invoices</td></tr>
                      ) : recentInvoices.map((inv, i) => (
                        <tr key={i} className="hover:bg-[rgba(201,168,76,0.02)] transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded bg-[rgba(52,211,153,0.05)] border border-[rgba(52,211,153,0.1)] flex items-center justify-center">
                                <ReceiptText className="w-4 h-4 text-emerald-400" />
                              </div>
                              <span className="font-bold text-[#e8eaf0] text-sm">{inv.type==='sell'?'Sale Invoice':inv.type==='buy'?'Purchase':'Return'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center text-xs font-medium text-[#8a95a8]">
                            {new Date(inv.date||inv.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                          </td>
                          <td className="px-6 py-4 text-center font-black text-[#e8eaf0]">
                            ৳{Number(inv.total||0).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                             <span className={\`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded inline-block \${inv.payment_status==='paid' ? 'bg-[#1a2235] text-emerald-400 border border-[rgba(52,211,153,0.2)]' : inv.payment_status==='partial' ? 'bg-[#1a2235] text-[#c9a84c] border border-[rgba(201,168,76,0.2)]' : 'bg-[#2a1315] text-red-500 border border-red-500/20'}\`}>
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
                    <span className="flex items-center gap-3 text-[#8a95a8] font-bold"><ReceiptText className="w-4 h-4 text-pink-400"/> Total Invoices</span>
                    <span className="font-black text-[#c9a84c]">{stats.invoices}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="flex items-center gap-3 text-[#8a95a8] font-bold"><Box className="w-4 h-4 text-amber-600"/> Total Products</span>
                    <span className="font-black text-[#60a5fa]">{stats.products}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="flex items-center gap-3 text-[#8a95a8] font-bold"><Users className="w-4 h-4 text-purple-600"/> Total Staff</span>
                    <span className="font-black text-[#c9a84c]">{stats.employees}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="flex items-center gap-3 text-[#8a95a8] font-bold"><CheckCircle className="w-4 h-4 text-emerald-400"/> Attendance</span>
                    <span className="font-black text-emerald-400">{attendance.present}/{attendance.total}</span>
                  </div>
                </div>
              </div>

              {/* Team Snippet */}
              <div className="bg-[#131929] rounded-2xl border border-[rgba(255,255,255,0.04)] shadow-[0_4px_24px_rgba(0,0,0,0.5)] px-5 py-4 flex justify-between items-center cursor-pointer transition hover:bg-[#1a2235]">
                 <span className="flex items-center gap-3 text-[#e8eaf0] font-bold text-sm">
                    <span className="w-6 h-6 rounded bg-purple-600 flex items-center justify-center"><Users className="w-3 h-3" /></span> Team
                 </span>
                 <span className="font-bold text-[#8a95a8] text-xs">All ➔</span>
              </div>
              
              {/* ALERTS */}
              {(lowStockItems.length > 0 || bouncedChecks.length > 0) && (
                <div className="bg-[#1a0e10] rounded-2xl border border-red-900/50 shadow-[0_4px_24px_rgba(0,0,0,0.5)] p-5">
                  <h3 className="flex items-center gap-2 font-black text-red-500 text-sm mb-4"><AlertTriangle className="w-4 h-4" /> Action Required</h3>
                  {lowStockItems.length > 0 && (
                    <div className="mb-3 text-xs font-bold text-[#8a95a8] flex justify-between">
                      <span className="text-amber-500">{lowStockItems.length} Low Stock item(s)</span>
                      <Link href="/stock" className="text-red-400 hover:underline">View ➔</Link>
                    </div>
                  )}
                  {bouncedChecks.length > 0 && (
                    <div className="text-xs font-bold text-[#8a95a8] flex justify-between">
                      <span className="text-red-500">{bouncedChecks.length} Bounced cheque(s)</span>
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
}`;

fs.writeFileSync(file, beforeReturn + newJSX, 'utf-8');
console.log('Successfully completed dashboard rewrite');
