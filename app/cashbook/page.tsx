"use client";
import React, { useState, useEffect, Suspense, useMemo } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, ArrowDownLeft, ArrowUpRight, TrendingDown, Banknote, Search, 
  Filter, Download, Printer, Calendar, X, ChevronDown, FileSpreadsheet
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

type TabType = 'inflow' | 'outflow';

function CashbookContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  
  const [activeTab, setActiveTab] = useState<TabType>(tabParam === 'outflow' ? 'outflow' : 'inflow');
  const [loading, setLoading] = useState(true);
  const [inflowLog, setInflowLog] = useState<any[]>([]);
  const [outflowLog, setOutflowLog] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Advanced Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    method: 'all',
    label: 'all'
  });

  useEffect(() => {
    if (tabParam === 'outflow') {
      setActiveTab('outflow');
    } else if (tabParam === 'inflow') {
      setActiveTab('inflow');
    }
  }, [tabParam]);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.getCashbookLogs();
      if (res && res.unified_inflow) {
        setInflowLog(res.unified_inflow);
        setOutflowLog(res.unified_outflow);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const currentData = useMemo(() => activeTab === 'inflow' ? inflowLog : outflowLog, [activeTab, inflowLog, outflowLog]);
  
  const uniqueMethods = useMemo(() => {
    const methods = currentData.map(item => item.method || 'Cash');
    return Array.from(new Set(methods));
  }, [currentData]);

  const uniqueLabels = useMemo(() => {
    const labels = currentData.map(item => item.label);
    return Array.from(new Set(labels));
  }, [currentData]);

  const filteredData = useMemo(() => {
    return currentData.filter(item => {
      // Search term filter
      const matchesSearch = 
        item.source?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.label?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.amount?.toString().includes(searchTerm);
      
      if (!matchesSearch) return false;

      // Date filter
      if (filters.startDate) {
        if (new Date(item.date) < new Date(filters.startDate)) return false;
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        if (new Date(item.date) > end) return false;
      }

      // Method filter
      if (filters.method !== 'all') {
        const itemMethod = item.method || 'Cash';
        if (itemMethod !== filters.method) return false;
      }

      // Label/Type filter
      if (filters.label !== 'all') {
        if (item.label !== filters.label) return false;
      }

      return true;
    });
  }, [currentData, searchTerm, filters]);

  const handleDownloadCSV = () => {
    if (filteredData.length === 0) return;
    
    const headers = ['Date', 'Source', 'Type', 'Method', 'Amount'];
    const rows = filteredData.map(item => [
      new Date(item.date).toLocaleDateString(),
      item.source,
      item.label,
      item.method || 'Cash',
      item.amount
    ]);

    let csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Cashbook_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const resetFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      method: 'all',
      label: 'all'
    });
    setSearchTerm('');
  };

  return (
    <div className="pb-24 w-full min-h-screen bg-[#0b0f1a] px-6 pt-6 max-w-[1400px] mx-auto" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style jsx global>{`
        @media print {
          nav, aside, button, .no-print {
            display: none !important;
          }
          body {
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print-only {
            display: block !important;
          }
          .main-content {
            width: 100% !important;
            max-width: none !important;
            padding: 0 !important;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          th, td {
            border: 1px solid #ddd !important;
            color: black !important;
            background: white !important;
          }
          .transaction-row {
            break-inside: avoid;
          }
        }
      `}</style>

      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-8 no-print">
        <div>
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-[#8a95a8] hover:text-white uppercase tracking-widest transition-colors mb-3">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${activeTab === 'inflow' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
              {activeTab === 'inflow' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
            </div>
            <h1 className="text-3xl font-black text-white uppercase tracking-tight">Transaction History</h1>
          </div>
          <p className="text-[#8a95a8] text-sm font-medium mt-2">Comprehensive log of all cash movements</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handleDownloadCSV}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#131929] border border-[rgba(255,255,255,0.05)] text-[#e8eaf0] text-xs font-bold uppercase tracking-widest hover:bg-[#1a2235] hover:border-[#c9a84c]/30 transition-all"
          >
            <Download className="w-4 h-4 text-[#c9a84c]" />
            Export CSV
          </button>
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#c9a84c] text-[#0a0900] text-xs font-black uppercase tracking-widest hover:brightness-110 shadow-[0_4px_14px_rgba(201,168,76,0.3)] transition-all"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>
        </div>
      </div>

      <div className="print-only hidden mb-8">
        <h1 className="text-2xl font-bold">Cash {activeTab === 'inflow' ? 'Inflow' : 'Outflow'} Report</h1>
        <p className="text-gray-600">Generated on: {new Date().toLocaleString()}</p>
        {filters.startDate && <p className="text-gray-600">From: {filters.startDate} To: {filters.endDate || 'Today'}</p>}
      </div>

      {/* ── TABS & QUICK SEARCH ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 no-print">
        <div className="flex items-center bg-[#131929] p-1.5 rounded-xl border border-[rgba(255,255,255,0.05)] w-fit">
          <button
            onClick={() => setActiveTab('inflow')}
            className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'inflow' ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'text-[#8a95a8] hover:text-white'
            }`}
          >
            Cash Inflow
          </button>
          <button
            onClick={() => setActiveTab('outflow')}
            className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'outflow' ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'text-[#8a95a8] hover:text-white'
            }`}
          >
            Cash Outflow
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-[#8a95a8] absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search records..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#131929] text-white text-sm font-medium pl-10 pr-4 py-3 rounded-xl border border-[rgba(255,255,255,0.05)] focus:border-[#c9a84c] focus:outline-none focus:ring-1 focus:ring-[#c9a84c] transition-all"
            />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all ${
              showFilters 
                ? 'bg-[#c9a84c]/10 border-[#c9a84c] text-[#c9a84c]' 
                : 'bg-[#131929] border-[rgba(255,255,255,0.05)] text-[#8a95a8] hover:text-white'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Filters</span>
            {Object.values(filters).some(v => v !== 'all' && v !== '') && (
              <span className="w-2 h-2 rounded-full bg-[#c9a84c] animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* ── ADVANCED FILTERS ── */}
      {showFilters && (
        <div className="bg-[#131929] p-6 rounded-2xl border border-[#c9a84c]/20 mb-8 no-print animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-black text-[#c9a84c] uppercase tracking-widest flex items-center gap-2">
              <Filter className="w-4 h-4" /> Advanced Filtering
            </h3>
            <button onClick={resetFilters} className="text-[10px] font-bold text-[#8a95a8] hover:text-red-400 uppercase tracking-widest flex items-center gap-1.5 transition-colors">
              <X className="w-3 h-3" /> Reset All
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <label className="block text-[10px] font-black text-[#8a95a8] uppercase tracking-widest mb-2.5">Start Date</label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-[#4a5568] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="date" 
                  value={filters.startDate}
                  onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                  className="w-full bg-[#0b0f1a] text-white text-sm font-medium pl-10 pr-4 py-2.5 rounded-xl border border-[rgba(255,255,255,0.05)] focus:border-[#c9a84c] outline-none transition-all" 
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-[#8a95a8] uppercase tracking-widest mb-2.5">End Date</label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-[#4a5568] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="date" 
                  value={filters.endDate}
                  onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                  className="w-full bg-[#0b0f1a] text-white text-sm font-medium pl-10 pr-4 py-2.5 rounded-xl border border-[rgba(255,255,255,0.05)] focus:border-[#c9a84c] outline-none transition-all" 
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-[#8a95a8] uppercase tracking-widest mb-2.5">Payment Method</label>
              <select 
                value={filters.method}
                onChange={(e) => setFilters({...filters, method: e.target.value})}
                className="w-full bg-[#0b0f1a] text-white text-sm font-medium px-4 py-2.5 rounded-xl border border-[rgba(255,255,255,0.05)] focus:border-[#c9a84c] outline-none appearance-none transition-all"
              >
                <option value="all">All Methods</option>
                {uniqueMethods.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black text-[#8a95a8] uppercase tracking-widest mb-2.5">Transaction Type</label>
              <select 
                value={filters.label}
                onChange={(e) => setFilters({...filters, label: e.target.value})}
                className="w-full bg-[#0b0f1a] text-white text-sm font-medium px-4 py-2.5 rounded-xl border border-[rgba(255,255,255,0.05)] focus:border-[#c9a84c] outline-none appearance-none transition-all"
              >
                <option value="all">All Types</option>
                {uniqueLabels.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ── DATA TABLE ── */}
      <div className="bg-[#131929] rounded-2xl border border-[rgba(255,255,255,0.04)] shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden main-content">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-12 h-12 border-4 border-[#c9a84c] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-[#8a95a8] text-sm font-bold uppercase tracking-widest">Loading Records...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#1a2235] border-b border-[rgba(255,255,255,0.05)]">
                  <th className="py-4 px-6 text-[10px] font-black text-[#8a95a8] uppercase tracking-widest w-1/4">Date</th>
                  <th className="py-4 px-6 text-[10px] font-black text-[#8a95a8] uppercase tracking-widest w-1/3">Source / Details</th>
                  <th className="py-4 px-6 text-[10px] font-black text-[#8a95a8] uppercase tracking-widest">Type</th>
                  <th className="py-4 px-6 text-[10px] font-black text-[#8a95a8] uppercase tracking-widest">Method</th>
                  <th className="py-4 px-6 text-[10px] font-black text-[#8a95a8] uppercase tracking-widest text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(255,255,255,0.02)]">
                {filteredData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-[#1a2235]/40 transition-colors group transaction-row">
                    <td className="py-4 px-6">
                      <p className="text-sm font-medium text-[#e8eaf0]">{new Date(item.date).toLocaleDateString()}</p>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center no-print ${activeTab === 'inflow' ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                          {activeTab === 'inflow' ? <Banknote className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
                        </div>
                        <p className="text-sm font-black text-[#e8eaf0] group-hover:text-white transition-colors">{item.source}</p>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-[10px] font-bold text-[#8a95a8] uppercase tracking-widest bg-[#0b0f1a] px-2.5 py-1 rounded-md border border-[rgba(255,255,255,0.05)]">
                        {item.label}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <p className="text-xs font-bold text-[#8a95a8] uppercase tracking-widest">{item.method || 'Cash'}</p>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <p className={`text-base font-black font-mono ${activeTab === 'inflow' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {activeTab === 'inflow' ? '+' : '-'}৳{item.amount.toLocaleString()}
                      </p>
                    </td>
                  </tr>
                ))}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-16 text-center">
                      <div className="w-16 h-16 rounded-full bg-[#1a2235] flex items-center justify-center mx-auto mb-4 no-print">
                        <Filter className="w-6 h-6 text-[#4a5568]" />
                      </div>
                      <p className="text-[#8a95a8] text-sm font-bold uppercase tracking-widest">No matching records found</p>
                    </td>
                  </tr>
                )}
              </tbody>
              {filteredData.length > 0 && (
                <tfoot>
                  <tr className="bg-[#1a2235]/50 font-black">
                    <td colSpan={4} className="py-4 px-6 text-right text-[10px] text-[#8a95a8] uppercase tracking-widest">Total {activeTab}</td>
                    <td className="py-4 px-6 text-right text-lg text-white font-mono">
                      ৳{filteredData.reduce((acc, item) => acc + Number(item.amount), 0).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CashbookPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-white">Loading...</div>}>
      <CashbookContent />
    </Suspense>
  );
}
