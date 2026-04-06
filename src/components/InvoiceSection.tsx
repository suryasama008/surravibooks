'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import { InvoiceEntry, InvoiceEntryType, Contact } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtAmt(n: number) {
  return '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })
}
function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
function fmtDateLong(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
function daysSince(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.floor((today.getTime() - d.getTime()) / 86400000)
}

type AgeFilter = 'all' | '30' | '45' | '60' | '90' | '90+'
type StatusFilter = 'all' | 'unpaid' | 'paid'
type TypeFilter = 'all' | 'sale' | 'purchase'

// ── Password Modal ────────────────────────────────────────────────────────────

function PasswordModal({ title, onConfirm, onCancel }: { title: string; onConfirm: () => void; onCancel: () => void }) {
  const [pins, setPins] = useState(['', '', '', ''])
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)
  const r0 = useRef<HTMLInputElement>(null)
  const r1 = useRef<HTMLInputElement>(null)
  const r2 = useRef<HTMLInputElement>(null)
  const r3 = useRef<HTMLInputElement>(null)
  const refArr = [r0, r1, r2, r3]

  useEffect(() => { r0.current?.focus() }, [])

  const check = (next: string[]) => {
    if (next.join('') === '0000') { onConfirm(); return }
    setError(true); setShake(true)
    setTimeout(() => { setShake(false); setPins(['', '', '', '']); setError(false); r0.current?.focus() }, 600)
  }
  const handleChange = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return
    const next = [...pins]; next[idx] = val; setPins(next)
    if (val && idx < 3) refArr[idx + 1].current?.focus()
    if (idx === 3 && val) check(next)
  }
  const handleKey = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pins[idx] && idx > 0) refArr[idx - 1].current?.focus()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[60]" onClick={onCancel} />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs pointer-events-auto">
          <div className="px-6 pt-6 pb-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="font-semibold text-slate-800 text-sm">{title}</p>
            <p className="text-xs text-slate-400 mt-1">Enter your 4-digit PIN</p>
          </div>
          <div className={`flex gap-3 justify-center px-6 pb-2 transition-transform ${shake ? 'translate-x-2' : ''}`}>
            {pins.map((p, i) => (
              <input key={i} ref={refArr[i]} type="password" inputMode="numeric" maxLength={1} value={p}
                onChange={e => handleChange(i, e.target.value)} onKeyDown={e => handleKey(i, e)}
                className={`w-12 h-12 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all
                  ${error ? 'border-red-400 bg-red-50 text-red-600' : p ? 'border-[#1d4ed8] bg-blue-50 text-[#1d4ed8]' : 'border-slate-200 bg-slate-50'}
                  focus:border-[#1d4ed8]`}
              />
            ))}
          </div>
          {error && <p className="text-center text-xs text-red-500 font-medium pb-1">Incorrect PIN</p>}
          <div className="px-6 pb-5 pt-3">
            <button onClick={onCancel} className="w-full py-2.5 rounded-xl text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">Cancel</button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  invoices: InvoiceEntry[]
  contacts: Contact[]
  loading: boolean
  fyMonths: { label: string; value: string }[]
  onAdd: (entry: Omit<InvoiceEntry, 'id' | 'created_at'>) => Promise<void>
  onUpdate?: (id: string, entry: Omit<InvoiceEntry, 'id' | 'created_at'>) => Promise<void>
  onPayNow: (inv: InvoiceEntry) => void
  onDelete: (id: string) => Promise<void>
  onBulkImport?: (entries: Omit<InvoiceEntry, 'id' | 'created_at'>[]) => Promise<void>
  externalAddOpen?: boolean
  onExternalAddClose?: () => void
}

export default function InvoiceSection({ invoices, contacts, loading, fyMonths, onAdd, onUpdate, onPayNow, onDelete, externalAddOpen, onExternalAddClose }: Props) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [ageFilter, setAgeFilter] = useState<AgeFilter>('all')
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editEntry, setEditEntry] = useState<InvoiceEntry | null>(null)
  const [viewEntry, setViewEntry] = useState<InvoiceEntry | null>(null)
  const [passwordAction, setPasswordAction] = useState<null | { label: string; onConfirm: () => void }>(null)

  useEffect(() => {
    if (externalAddOpen) { setAddOpen(true); onExternalAddClose?.() }
  }, [externalAddOpen, onExternalAddClose])

  const unpaidSales     = useMemo(() => invoices.filter(i => i.entry_type === 'sale'     && i.status === 'unpaid'), [invoices])
  const unpaidPurchases = useMemo(() => invoices.filter(i => i.entry_type === 'purchase' && i.status === 'unpaid'), [invoices])
  const totalUnpaidSales     = unpaidSales.reduce((s, i) => s + i.amount, 0)
  const totalUnpaidPurchases = unpaidPurchases.reduce((s, i) => s + i.amount, 0)

  const activeFilterCount = [statusFilter !== 'all', ageFilter !== 'all', !!dateFrom, !!dateTo, !!selectedMonth].filter(Boolean).length

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = invoices.filter(inv => {
      const typeMatch   = typeFilter === 'all' || inv.entry_type === typeFilter
      const statMatch   = statusFilter === 'all' || inv.status === statusFilter
      const searchMatch = !q || inv.invoice_number.toLowerCase().includes(q) || inv.company_name.toLowerCase().includes(q) || String(inv.amount).includes(q)
      let ageMatch = true
      if (ageFilter !== 'all' && inv.status === 'unpaid') {
        const days = daysSince(inv.invoice_date)
        if (ageFilter === '30')  ageMatch = days <= 30
        if (ageFilter === '45')  ageMatch = days <= 45
        if (ageFilter === '60')  ageMatch = days <= 60
        if (ageFilter === '90')  ageMatch = days <= 90
        if (ageFilter === '90+') ageMatch = days > 90
      }
      // Month filter
      let monthMatch = true
      if (selectedMonth) monthMatch = inv.invoice_date.startsWith(selectedMonth)
      const dateMatch = (!dateFrom || inv.invoice_date >= dateFrom) && (!dateTo || inv.invoice_date <= dateTo)
      return typeMatch && statMatch && searchMatch && ageMatch && monthMatch && dateMatch
    })
    // Sales: newest created_at first; Purchases: newest date first
    list.sort((a, b) => {
      if (typeFilter === 'sale') return b.created_at.localeCompare(a.created_at)
      return b.invoice_date.localeCompare(a.invoice_date)
    })
    return list
  }, [invoices, typeFilter, statusFilter, ageFilter, search, selectedMonth, dateFrom, dateTo])

  const searchTotal = useMemo(() => {
    if (!search.trim()) return null
    return filtered.reduce((sum, inv) => sum + inv.amount, 0)
  }, [filtered, search])

  if (loading) return <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Loading invoices…</div>

  const ageBadgeCls = (days: number, status: string) => {
    if (status !== 'unpaid') return ''
    if (days <= 30) return 'bg-emerald-50 text-emerald-700'
    if (days <= 60) return 'bg-amber-50 text-amber-700'
    if (days <= 90) return 'bg-orange-50 text-orange-700'
    return 'bg-red-50 text-red-700'
  }

  const requestPassword = (label: string, onConfirm: () => void) => setPasswordAction({ label, onConfirm })

  const clearFilters = () => {
    setStatusFilter('all'); setAgeFilter('all')
    setDateFrom(''); setDateTo(''); setSelectedMonth('')
  }

  return (
    <div className="flex flex-col gap-3 pb-2">

      {/* ── 4 Stat Tiles ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Sales Receivable */}
        <div className="bg-white rounded-xl p-3 border border-slate-200">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Receivable</p>
          <p className="text-base font-bold text-emerald-600">{fmtAmt(totalUnpaidSales)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{unpaidSales.length} unpaid sales</p>
        </div>

        {/* Purchase Payable */}
        <div className="bg-white rounded-xl p-3 border border-slate-200">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Payable</p>
          <p className="text-base font-bold text-red-500">{fmtAmt(totalUnpaidPurchases)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{unpaidPurchases.length} unpaid purch.</p>
        </div>

        {/* >90d Sales Receivable */}
        {(() => {
          const overdue90Sales = unpaidSales.filter(i => daysSince(i.invoice_date) > 90)
          const overdue90SalesAmt = overdue90Sales.reduce((s, i) => s + i.amount, 0)
          return (
            <div className="bg-white rounded-xl p-3 border border-slate-200">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">&gt;90d Receivable</p>
              <p className="text-base font-bold text-amber-600">{fmtAmt(overdue90SalesAmt)}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{overdue90Sales.length} overdue sale{overdue90Sales.length !== 1 ? 's' : ''}</p>
            </div>
          )
        })()}

        {/* >90d Purchase Payable */}
        {(() => {
          const overdue90Purch = unpaidPurchases.filter(i => daysSince(i.invoice_date) > 90)
          const overdue90PurchAmt = overdue90Purch.reduce((s, i) => s + i.amount, 0)
          return (
            <div className="bg-white rounded-xl p-3 border border-slate-200">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">&gt;90d Payable</p>
              <p className="text-base font-bold text-orange-600">{fmtAmt(overdue90PurchAmt)}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{overdue90Purch.length} overdue purch.</p>
            </div>
          )
        })()}
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col gap-2.5">
        {/* Row 1: type + search + filter toggle + export */}
        <div className="flex gap-2 items-center flex-wrap">
          <div className="relative">
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as TypeFilter)}
              className="appearance-none pl-3 pr-7 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer">
              <option value="all">All Types</option>
              <option value="sale">Sales</option>
              <option value="purchase">Purchases</option>
            </select>
            <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {/* Month filter */}
          <div className="relative">
            <select value={selectedMonth}
              onChange={e => { setSelectedMonth(e.target.value); setDateFrom(''); setDateTo('') }}
              className="appearance-none pl-3 pr-7 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer">
              <option value="">All Months</option>
              {fyMonths.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          <div className="relative flex-1 min-w-[140px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Invoice no., company…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          <button onClick={() => setShowFilters(v => !v)}
            className={`relative px-3 py-2 rounded-lg border text-xs font-semibold transition-colors flex items-center gap-1.5
              ${showFilters || activeFilterCount > 0 ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M7 12h10M11 20h2" />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{activeFilterCount}</span>
            )}
          </button>

          <button onClick={() => downloadExcel(filtered, typeFilter === 'purchase' ? 'purchase' : 'sale')}
            className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors" title="Download Excel">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
        </div>

        {/* Extended filter panel */}
        {showFilters && (
          <div className="border-t border-slate-100 pt-2.5 flex flex-col gap-2.5">
            {/* Status chips */}
            <div className="flex gap-1.5 flex-wrap items-center">
              {(['all', 'unpaid', 'paid'] as StatusFilter[]).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors border
                    ${statusFilter === s
                      ? s === 'unpaid' ? 'bg-amber-500 text-white border-amber-500'
                        : s === 'paid' ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-700 text-white border-slate-700'
                      : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                  {s === 'all' ? 'All Status' : s === 'unpaid' ? 'Unpaid' : 'Paid'}
                </button>
              ))}
            </div>
            {/* Age chips */}
            <div className="flex gap-1.5 flex-wrap items-center">
              <span className="text-[10px] text-slate-400 font-semibold">Age:</span>
              {(['all', '30', '45', '60', '90', '90+'] as AgeFilter[]).map(a => (
                <button key={a} onClick={() => setAgeFilter(a)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors border
                    ${ageFilter === a ? 'bg-[#1d4ed8] text-white border-[#1d4ed8]' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                  {a === 'all' ? 'All' : a === '90+' ? '>90d' : `≤${a}d`}
                </button>
              ))}
            </div>
            {/* Date range */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Date Range</p>
              <div className="flex gap-2 items-center flex-wrap">
                <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setSelectedMonth('') }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                <span className="text-slate-400 text-xs">to</span>
                <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setSelectedMonth('') }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                {(dateFrom || dateTo) && (
                  <button onClick={() => { setDateFrom(''); setDateTo('') }} className="text-[11px] text-slate-400 hover:text-red-500 font-semibold">Clear</button>
                )}
              </div>
            </div>
            {(activeFilterCount > 0 || selectedMonth) && (
              <button onClick={clearFilters} className="self-start text-[11px] text-red-500 font-semibold hover:underline">Reset all filters</button>
            )}
          </div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm bg-white rounded-xl border border-slate-200">No invoices match the current filters</div>
        ) : (
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
            {/* Table header with count */}
            <div className="bg-white px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Invoices</span>
                <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {filtered.length} shown · {invoices.length} total
                </span>
              </div>
              {search.trim() && searchTotal !== null && (
                <span className="text-[11px] text-slate-500">
                  Total: <strong className="text-slate-800">{fmtAmt(searchTotal)}</strong>
                </span>
              )}
            </div>
            <table className="w-full text-xs" style={{tableLayout:'fixed'}}>
              <colgroup>
                <col style={{width:'10%'}} /><col style={{width:'18%'}} /><col style={{width:'7%'}} />
                <col style={{width:'10%'}} /><col style={{width:'6%'}} /><col style={{width:'5%'}} />
                <col style={{width:'7%'}} /><col style={{width:'7%'}} /><col style={{width:'17%'}} /><col style={{width:'13%'}} />
              </colgroup>
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wide text-left">Invoice no.</th>
                  <th className="py-2.5 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wide text-left">Company</th>
                  <th className="py-2.5 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wide text-left">Date</th>
                  <th className="py-2.5 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wide text-right">Amount</th>
                  <th className="py-2.5 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wide text-left">Type</th>
                  <th className="py-2.5 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wide text-left">Age</th>
                  <th className="py-2.5 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wide text-left">GST</th>
                  <th className="py-2.5 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wide text-left">Status</th>
                  <th className="py-2.5 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wide text-left">Remarks / Notes</th>
                  <th className="py-2.5 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wide text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv, idx) => {
                  const days = daysSince(inv.invoice_date)
                  const isSale = inv.entry_type === 'sale'
                  const ageCls = ageBadgeCls(days, inv.status)
                  return (
                    <tr key={inv.id} className={`border-b border-slate-100 last:border-0 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-blue-50/30`}>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 truncate">{inv.invoice_number}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-800 truncate">{inv.company_name}</td>
                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{fmtDate(inv.invoice_date)}</td>
                      <td className={`py-2.5 px-3 font-semibold text-right ${isSale ? 'text-emerald-600' : 'text-red-500'}`}>{fmtAmt(inv.amount)}</td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${isSale ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                          {isSale ? 'Sale' : 'Purch.'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {inv.status === 'unpaid'
                          ? <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${ageCls}`}>{days}d</span>
                          : <span className="text-slate-300 text-[10px]">—</span>}
                      </td>
                      <td className="py-2.5 px-3 text-[10px] font-mono text-slate-400 truncate">{inv.gst_number ? inv.gst_number.substring(0, 8) + '…' : '—'}</td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${inv.status === 'unpaid' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                          {inv.status === 'unpaid' ? 'Unpaid' : 'Paid'}
                        </span>
                      </td>
                      {/* Notes / Remarks */}
                      <td className="py-2.5 px-3 text-[11px] text-slate-500 truncate italic">
                        {inv.notes || <span className="text-slate-300 not-italic">—</span>}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => setViewEntry(inv)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-semibold transition-colors border border-blue-100">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            View
                          </button>
                          {inv.status === 'unpaid' && (
                            <button onClick={() => onPayNow(inv)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-semibold transition-colors border border-emerald-100">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                              Pay
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {/* Footer totals */}
            <div className="bg-slate-50 border-t border-slate-200 px-4 py-2.5 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">{filtered.length} invoice{filtered.length !== 1 ? 's' : ''} shown</span>
              <div className="flex gap-4 text-[11px]">
                <span className="text-slate-400">Receivable: <strong className="text-emerald-600">{fmtAmt(filtered.filter(i=>i.entry_type==='sale'&&i.status==='unpaid').reduce((s,i)=>s+i.amount,0))}</strong></span>
                <span className="text-slate-400">Payable: <strong className="text-red-500">{fmtAmt(filtered.filter(i=>i.entry_type==='purchase'&&i.status==='unpaid').reduce((s,i)=>s+i.amount,0))}</strong></span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden flex flex-col gap-2">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm bg-white rounded-xl border border-slate-200">No invoices match the current filters</div>
        ) : filtered.map(inv => {
          const days = daysSince(inv.invoice_date)
          const isSale = inv.entry_type === 'sale'
          const ageCls = ageBadgeCls(days, inv.status)
          return (
            <div key={inv.id} className="bg-white rounded-xl px-4 py-3 border border-slate-200">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1 min-w-0 pr-3">
                  <p className="font-semibold text-sm text-slate-800 truncate">{inv.company_name}</p>
                  <p className="font-mono text-[11px] text-slate-400 mt-0.5">{inv.invoice_number} · {fmtDate(inv.invoice_date)}</p>
                </div>
                <p className={`text-sm font-bold flex-shrink-0 ${isSale ? 'text-emerald-600' : 'text-red-500'}`}>{fmtAmt(inv.amount)}</p>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-1.5 flex-wrap">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isSale ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{isSale ? 'Sale' : 'Purchase'}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${inv.status === 'unpaid' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{inv.status === 'unpaid' ? 'Unpaid' : 'Paid'}</span>
                  {inv.status === 'unpaid' && ageCls && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ageCls}`}>{days}d</span>}
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => setViewEntry(inv)} className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-[11px] font-semibold hover:bg-blue-100 transition-colors border border-blue-100">View</button>
                  {inv.status === 'unpaid' && (
                    <button onClick={() => onPayNow(inv)} className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-semibold hover:bg-emerald-100 transition-colors">Pay</button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modals */}
      {addOpen && (
        <InvoiceFormDrawer contacts={contacts} onClose={() => setAddOpen(false)}
          onSubmit={async (data) => { await onAdd(data); setAddOpen(false) }} />
      )}
      {editEntry && (
        <InvoiceFormDrawer contacts={contacts} editInvoice={editEntry} onClose={() => setEditEntry(null)}
          onSubmit={async (data) => { await onUpdate?.(editEntry.id, data); setEditEntry(null) }} />
      )}
      {viewEntry && (
        <InvoiceDetailModal
          inv={viewEntry}
          onClose={() => setViewEntry(null)}
          onEdit={() => requestPassword('Edit Invoice', () => { setEditEntry(viewEntry); setViewEntry(null) })}
          onMarkPaid={() => { onPayNow(viewEntry); setViewEntry(null) }}
          onDelete={(id) => requestPassword('Delete Invoice', async () => { setViewEntry(null); await onDelete(id) })}
        />
      )}
      {passwordAction && (
        <PasswordModal title={passwordAction.label}
          onConfirm={() => { passwordAction.onConfirm(); setPasswordAction(null) }}
          onCancel={() => setPasswordAction(null)} />
      )}
    </div>
  )
}

// ── Invoice Detail Modal ──────────────────────────────────────────────────────

function InvoiceDetailModal({ inv, onClose, onEdit, onMarkPaid, onDelete }: {
  inv: InvoiceEntry; onClose: () => void; onEdit: () => void; onMarkPaid: () => void; onDelete: (id: string) => void
}) {
  const days = daysSince(inv.invoice_date)
  const isSale = inv.entry_type === 'sale'

  const KV = ({ label, value, mono, color, full }: { label: string; value: string; mono?: boolean; color?: string; full?: boolean }) => (
    <div className={`py-2.5 px-5 border-b border-slate-100 last:border-0 ${full ? '' : ''}`}>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-sm font-semibold ${color || 'text-slate-800'} ${mono ? 'font-mono text-xs tracking-wide' : ''}`}>{value}</p>
    </div>
  )

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl flex flex-col shadow-2xl w-full max-w-sm pointer-events-auto overflow-hidden">

          {/* Header */}
          <div className="bg-slate-50 border-b border-slate-200 px-5 pt-4 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isSale ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{isSale ? 'Sale' : 'Purchase'}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${inv.status === 'unpaid' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{inv.status === 'unpaid' ? 'Unpaid' : 'Paid'}</span>
                  {inv.status === 'unpaid' && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${days > 90 ? 'bg-red-100 text-red-800' : days > 45 ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-600'}`}>{days}d old</span>
                  )}
                </div>
                <p className="text-[11px] font-mono text-slate-400 mb-0.5">{inv.invoice_number}</p>
                <p className="text-base font-bold text-slate-900 leading-tight truncate">{inv.company_name}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-2xl font-extrabold ${isSale ? 'text-emerald-600' : 'text-red-600'}`}>{isSale ? '+' : '−'}{fmtAmt(inv.amount)}</p>
                <button onClick={onClose}
                  className="mt-2 w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center ml-auto transition-colors">
                  <svg className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* KV body */}
          <div className="overflow-y-auto max-h-[55vh]">
            <KV label="Invoice Number" value={inv.invoice_number} mono />
            <KV label="Invoice Date" value={fmtDateLong(inv.invoice_date)} />
            <KV label="Type" value={isSale ? 'Sale (Receivable)' : 'Purchase (Payable)'} color={isSale ? 'text-emerald-700' : 'text-red-700'} />
            <KV label="Amount" value={fmtAmt(inv.amount)} color={isSale ? 'text-emerald-700' : 'text-red-700'} />
            <KV label="Status" value={inv.status === 'unpaid' ? `Unpaid · ${days} days outstanding` : 'Paid'} color={inv.status === 'unpaid' ? 'text-amber-700' : 'text-emerald-700'} />
            {inv.gst_number && <KV label="GST Number" value={inv.gst_number} mono />}
            {inv.status === 'paid' && inv.transaction_date && <KV label="Payment Date" value={fmtDateLong(inv.transaction_date)} color="text-emerald-700" />}
            {inv.bank_account && <KV label="Bank Account" value={inv.bank_account} />}
            {inv.utr && <KV label="UTR / Reference" value={inv.utr} mono />}
            {inv.notes && <KV label="Notes" value={inv.notes} />}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-slate-100 flex gap-2">
            <button onClick={() => onDelete(inv.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors border border-red-100">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
            <button onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
              </svg>
              Edit
            </button>
            {inv.status === 'unpaid' && (
              <button onClick={onMarkPaid}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Record Payment
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Invoice Form Drawer ───────────────────────────────────────────────────────

function InvoiceFormDrawer({ contacts, editInvoice, onClose, onSubmit }: {
  contacts: Contact[]; editInvoice?: InvoiceEntry | null; onClose: () => void
  onSubmit: (data: Omit<InvoiceEntry, 'id' | 'created_at'>) => Promise<void>
}) {
  const isEdit = !!editInvoice
  const [entryType, setEntryType] = useState<InvoiceEntryType>(editInvoice?.entry_type ?? 'purchase')
  const [companySearch, setCompanySearch] = useState(editInvoice?.company_name ?? '')
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [invoiceNumber, setInvoiceNumber] = useState(editInvoice?.invoice_number ?? '')
  const [invoiceDate, setInvoiceDate] = useState(editInvoice?.invoice_date ?? new Date().toISOString().split('T')[0])
  const [amountRaw, setAmountRaw] = useState(editInvoice?.amount ? String(editInvoice.amount) : '')
  const [notes, setNotes] = useState(editInvoice?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const parsedAmount = parseFloat(amountRaw.replace(/,/g, '')) || 0

  const filteredContacts = useMemo(() => {
    if (!companySearch.trim()) return contacts.slice(0, 8)
    return contacts.filter(c => c.company_name.toLowerCase().includes(companySearch.toLowerCase())).slice(0, 8)
  }, [contacts, companySearch])

  const handleSubmit = async () => {
    if (!companySearch.trim() || !invoiceNumber.trim() || !invoiceDate || parsedAmount <= 0) return
    setSaving(true)
    const contact = selectedContact ?? contacts.find(c => c.company_name.toLowerCase() === companySearch.toLowerCase().trim()) ?? null
    await onSubmit({
      invoice_number: invoiceNumber.trim(), invoice_date: invoiceDate, entry_type: entryType,
      contact_id: contact?.id ?? editInvoice?.contact_id ?? null,
      company_name: companySearch.trim(), gst_number: contact?.gst_number ?? editInvoice?.gst_number ?? null,
      amount: parsedAmount, notes: notes.trim() || null, status: editInvoice?.status ?? 'unpaid',
      transaction_date: editInvoice?.transaction_date ?? null, utr: editInvoice?.utr ?? null,
      bank_account: editInvoice?.bank_account ?? null, sub_category: editInvoice?.sub_category ?? null,
      settled_tx_id: editInvoice?.settled_tx_id ?? null,
    })
    setSaving(false)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0"><div className="w-9 h-1 bg-slate-200 rounded-full" /></div>
        <div className="px-5 py-3 flex-shrink-0 border-b border-slate-100 flex items-center justify-between">
          <p className="font-bold text-sm text-slate-800">{isEdit ? 'Edit Invoice' : 'New Invoice Entry'}</p>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-4">
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            {(['purchase', 'sale'] as const).map(t => (
              <button key={t} onClick={() => !isEdit && setEntryType(t)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors
                  ${entryType === t ? t === 'purchase' ? 'bg-red-600 text-white shadow-sm' : 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500'}
                  ${isEdit ? 'opacity-60 cursor-default' : ''}`}>
                {t === 'purchase' ? '↑ Purchase' : '↓ Sale'}
              </button>
            ))}
          </div>
          <div className="relative" ref={dropdownRef}>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Company</label>
            <input value={companySearch} onChange={e => { setCompanySearch(e.target.value); setSelectedContact(null); setShowDropdown(true) }}
              onFocus={() => setShowDropdown(true)} placeholder="Search or type company name…"
              className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            {showDropdown && filteredContacts.length > 0 && (
              <div className="absolute z-10 w-full bg-white border border-slate-200 rounded-xl shadow-xl mt-1 max-h-40 overflow-y-auto">
                {filteredContacts.map(c => (
                  <button key={c.id} onClick={() => { setSelectedContact(c); setCompanySearch(c.company_name); setShowDropdown(false) }}
                    className="w-full text-left px-3 py-2.5 hover:bg-slate-50 text-sm flex items-center justify-between">
                    <span className="font-medium text-slate-800">{c.company_name}</span>
                    {c.gst_number && <span className="text-[10px] text-slate-400 font-mono">{c.gst_number}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Invoice No.</label>
              <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="INV-001"
                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Invoice Date</label>
              <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Amount (₹)</label>
            <input value={amountRaw} onChange={e => setAmountRaw(e.target.value)} placeholder="0" inputMode="numeric"
              className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            {parsedAmount > 0 && <p className="text-[10px] text-slate-400 mt-1">= ₹{parsedAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>}
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Remarks, product details…"
              className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-slate-100 flex-shrink-0">
          <button onClick={handleSubmit} disabled={saving || !companySearch.trim() || !invoiceNumber.trim() || parsedAmount <= 0}
            className="w-full py-3 rounded-2xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 transition-colors">
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Save Invoice'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Download helper ───────────────────────────────────────────────────────────

function downloadExcel(invoices: InvoiceEntry[], type: 'sale' | 'purchase') {
  import('xlsx').then(XLSX => {
    const label = type === 'sale' ? 'Sales' : 'Purchases'
    const rows = invoices.map(inv => ({
      DATE: inv.invoice_date ? inv.invoice_date.split('-').reverse().join('.') : '',
      'INVOICE NO': inv.invoice_number, 'PARTY NAME': inv.company_name,
      'GST Number': inv.gst_number ?? '', 'GRAND TOTAL': inv.amount,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 30 }, { wch: 18 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, label)
    XLSX.writeFile(wb, `${label}_${new Date().toISOString().split('T')[0]}.xlsx`)
  })
}
