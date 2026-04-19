'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import { InvoiceEntry, InvoiceEntryType, Contact, Transaction, InvoiceLine, Material, InvoicePayment, StockEntry } from '@/types'
import { RECEIVE_CATEGORIES, RECEIVE_SUB_CATEGORIES, SEND_CATEGORIES, SEND_SUB_CATEGORIES } from '@/lib/constants'

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
  invoiceLines: InvoiceLine[]
  invoicePayments: InvoicePayment[]
  materials: Material[]
  transactions: Transaction[]
  contacts: Contact[]
  loading: boolean
  fyMonths: { label: string; value: string }[]
  onAdd: (entry: Omit<InvoiceEntry, 'id' | 'created_at'>, lines: Omit<InvoiceLine, 'id' | 'invoice_id' | 'created_at'>[]) => Promise<void>
  onUpdate?: (id: string, entry: Omit<InvoiceEntry, 'id' | 'created_at'>, lines: Omit<InvoiceLine, 'id' | 'invoice_id' | 'created_at'>[]) => Promise<void>
  onPayNow: (inv: InvoiceEntry) => void
  onUnpay: (inv: InvoiceEntry) => void
  onMultiPay: (invs: InvoiceEntry[]) => void
  onConfirmPayment: (invoices: InvoiceEntry[], amount: number, date: string, account: string, mode: string, utr: string, notes: string, isPartial: boolean, category: string, subCategory: string, tdsAmount: number) => Promise<void>
  payModalInvoices: InvoiceEntry[]
  onClosePayModal: () => void
  onDelete: (id: string) => Promise<void>
  externalAddOpen?: boolean
  onExternalAddClose?: () => void
  stockEntries?: StockEntry[]
  onAddStock?: (s: Omit<StockEntry, 'id' | 'created_at'>) => Promise<void>
}

export default function InvoiceSection({ invoices, invoiceLines, invoicePayments, materials, transactions, contacts, loading, fyMonths, onAdd, onUpdate, onPayNow, onUnpay, onMultiPay, onConfirmPayment, payModalInvoices, onClosePayModal, onDelete, externalAddOpen, onExternalAddClose, stockEntries = [], onAddStock }: Props) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [ageFilter, setAgeFilter] = useState<AgeFilter>('all')
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [sortDateDesc, setSortDateDesc] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [editEntry, setEditEntry] = useState<InvoiceEntry | null>(null)
  const [viewEntry, setViewEntry] = useState<InvoiceEntry | null>(null)
  const [passwordAction, setPasswordAction] = useState<null | { label: string; onConfirm: () => void }>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const toggleSelect = (id: string) => setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  const clearSelected = () => setSelectedIds(new Set())
  const selectedInvoices = invoices.filter(i => selectedIds.has(i.id))

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
      // Month filter — bypassed when showAll is on OR when a custom date range is active
      let monthMatch = true
      const hasDateRange = !!dateFrom || !!dateTo
      if (!showAll && !hasDateRange && selectedMonth) monthMatch = inv.invoice_date.startsWith(selectedMonth)
      const dateMatch = (!dateFrom || inv.invoice_date >= dateFrom) && (!dateTo || inv.invoice_date <= dateTo)
      return typeMatch && statMatch && searchMatch && ageMatch && monthMatch && dateMatch
    })
    // Sort by invoice_date, direction driven by sortDateDesc toggle
    list.sort((a, b) =>
      sortDateDesc
        ? b.invoice_date.localeCompare(a.invoice_date) || b.created_at.localeCompare(a.created_at)
        : a.invoice_date.localeCompare(b.invoice_date) || a.created_at.localeCompare(b.created_at)
    )
    return list
  }, [invoices, typeFilter, statusFilter, ageFilter, search, selectedMonth, dateFrom, dateTo, sortDateDesc, showAll])

  const searchTotal = useMemo(() => {
    if (!search.trim()) return null
    return filtered.reduce((sum, inv) => sum + inv.amount, 0)
  }, [filtered, search])

  // Filtered summary totals
  const filteredAmtTotal = useMemo(() => filtered.reduce((s, i) => s + i.amount, 0), [filtered])
  const filteredDueTotal = useMemo(() => filtered.reduce((s, i) => s + (i.status === 'paid' ? 0 : i.amount - (i.amount_paid ?? 0)), 0), [filtered])
  const filteredPaidTotal = useMemo(() => filtered.reduce((s, i) => s + (i.amount_paid ?? 0), 0), [filtered])
  const filteredSalesTotal = useMemo(() => filtered.filter(i => i.entry_type === 'sale').reduce((s, i) => s + i.amount, 0), [filtered])
  const filteredPurchasesTotal = useMemo(() => filtered.filter(i => i.entry_type === 'purchase').reduce((s, i) => s + i.amount, 0), [filtered])

  // This month / this year sales (based on invoice_date, not bank transactions)
  const thisMonthSales = useMemo(() => {
    const now = new Date()
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return invoices.filter(i => i.entry_type === 'sale' && i.invoice_date.startsWith(ym)).reduce((s, i) => s + i.amount, 0)
  }, [invoices])
  // Fiscal year = April 1 → March 31 (Indian FY)
  const thisFYSales = useMemo(() => {
    const now = new Date()
    const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
    const fyStart = `${fyStartYear}-04-01`
    const fyEnd   = `${fyStartYear + 1}-03-31`
    return invoices.filter(i => i.entry_type === 'sale' && i.invoice_date >= fyStart && i.invoice_date <= fyEnd).reduce((s, i) => s + i.amount, 0)
  }, [invoices])

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

      {/* ── Compact Summary Bar ── */}
      <div className="bg-white rounded-xl border border-slate-100 px-3 py-2 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Receivable</span>
          <span className="text-xs font-bold text-emerald-600 tabular-nums">{fmtAmt(totalUnpaidSales)}</span>
          <span className="text-[9px] text-slate-300">({unpaidSales.length})</span>
        </div>
        <span className="text-slate-200 text-xs">|</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Payable</span>
          <span className="text-xs font-bold text-red-500 tabular-nums">{fmtAmt(totalUnpaidPurchases)}</span>
          <span className="text-[9px] text-slate-300">({unpaidPurchases.length})</span>
        </div>
        {(() => {
          const overdue90Sales = unpaidSales.filter(i => daysSince(i.invoice_date) > 90)
          const overdue90SalesAmt = overdue90Sales.reduce((s, i) => s + i.amount, 0)
          if (!overdue90Sales.length) return null
          return <>
            <span className="text-slate-200 text-xs">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider">&gt;90d Recv</span>
              <span className="text-xs font-bold text-amber-600 tabular-nums">{fmtAmt(overdue90SalesAmt)}</span>
            </div>
          </>
        })()}
        {(() => {
          const overdue90Purch = unpaidPurchases.filter(i => daysSince(i.invoice_date) > 90)
          const overdue90PurchAmt = overdue90Purch.reduce((s, i) => s + i.amount, 0)
          if (!overdue90Purch.length) return null
          return <>
            <span className="text-slate-200 text-xs">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold text-orange-500 uppercase tracking-wider">&gt;90d Pay</span>
              <span className="text-xs font-bold text-orange-600 tabular-nums">{fmtAmt(overdue90PurchAmt)}</span>
            </div>
          </>
        })()}
        <span className="text-slate-200 text-xs">|</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-bold text-blue-500 uppercase tracking-wider">This Mo. Sales</span>
          <span className="text-xs font-bold text-blue-600 tabular-nums">{fmtAmt(thisMonthSales)}</span>
        </div>
        <span className="text-slate-200 text-xs">|</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider">This FY Sales</span>
          <span className="text-xs font-bold text-indigo-600 tabular-nums">{fmtAmt(thisFYSales)}</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col gap-2.5">
        {/* Mobile search — full width, same as TransactionList */}
        <div className="sm:hidden relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
          </svg>
          <input type="text" placeholder="Search invoice no., company, amount…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm outline-none focus:border-blue-400" />
        </div>
        {/* Row 1: type + search(desktop) + filter toggle + export */}
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
            <select value={showAll ? '' : selectedMonth}
              onChange={e => { setSelectedMonth(e.target.value); setDateFrom(''); setDateTo(''); setShowAll(false) }}
              disabled={showAll}
              className={`appearance-none pl-3 pr-7 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer ${showAll ? 'opacity-40' : ''}`}>
              <option value="">All Months</option>
              {fyMonths.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {/* Show All toggle */}
          <button
            onClick={() => setShowAll(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold transition-colors
              ${showAll
                ? 'bg-[#1d4ed8] border-[#1d4ed8] text-white shadow-sm'
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
            </svg>
            Show All
          </button>

          <div className="relative flex-1 min-w-[140px] hidden sm:block">
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

          <button onClick={() => downloadInvoiceExcel(filtered, invoiceLines)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors text-xs font-bold" title="Download Excel (Sales + Purchases)">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Excel
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
            {/* Table header with count + filter totals */}
            <div className="bg-white px-3 py-2 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Invoices</span>
                <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {filtered.length}/{invoices.length}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] tabular-nums flex-wrap">
                <span className="text-slate-400">Total <strong className="text-slate-700">{fmtAmt(filteredAmtTotal)}</strong></span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-400">Sales <strong className="text-emerald-600">{fmtAmt(filteredSalesTotal)}</strong></span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-400">Purchases <strong className="text-red-500">{fmtAmt(filteredPurchasesTotal)}</strong></span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-400">Paid <strong className="text-emerald-600">{fmtAmt(filteredPaidTotal)}</strong></span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-400">Due <strong className="text-red-500">{fmtAmt(filteredDueTotal)}</strong></span>
              </div>
            </div>
            {selectedIds.size > 0 && (() => {
              const selTotal = selectedInvoices.reduce((s, i) => s + Math.max(0, i.amount - (i.amount_paid ?? 0)), 0)
              return (
              <div className="bg-blue-50 border-b border-blue-200 px-4 py-2.5 flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-700">{selectedIds.size} invoice{selectedIds.size > 1 ? 's' : ''} selected · <span className="text-emerald-700">Due {fmtAmt(selTotal)}</span></span>
                <div className="flex items-center gap-2">
                  <button onClick={clearSelected} className="text-[11px] text-blue-400 hover:text-blue-600 font-semibold">Clear</button>
                  <button onClick={() => { onMultiPay(selectedInvoices); clearSelected() }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors shadow-sm">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                    Pay {selectedIds.size} · {fmtAmt(selTotal)}
                  </button>
                </div>
              </div>
              )
            })()}
            {/* Horizontally scrollable table wrapper */}
            <div className="overflow-x-auto">
              <table className="text-xs" style={{minWidth: '700px', width: '100%', tableLayout: 'auto'}}>
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-2 w-7"></th>
                    <th className="py-2 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide text-left whitespace-nowrap cursor-pointer select-none hover:text-slate-600" onClick={() => setSortDateDesc(v => !v)}>
                      Date {sortDateDesc ? '↓' : '↑'}
                    </th>
                    <th className="py-2 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide text-left whitespace-nowrap">Invoice No.</th>
                    <th className="py-2 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide text-left">Company</th>
                    <th className="py-2 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide text-right whitespace-nowrap">Amount</th>
                    <th className="py-2 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide text-right whitespace-nowrap">Paid</th>
                    <th className="py-2 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide text-right whitespace-nowrap">Due</th>
                    <th className="py-2 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide text-left">Status</th>
                    <th className="py-2 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide text-center whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inv, idx) => {
                    const days = daysSince(inv.invoice_date)
                    const isSale = inv.entry_type === 'sale'
                    const ageCls = ageBadgeCls(days, inv.status)
                    const amtPaid = inv.amount_paid ?? 0
                    const amtDue = inv.status === 'paid' ? 0 : inv.amount - amtPaid
                    return (
                      <tr key={inv.id} className={`border-b border-slate-100 last:border-0 transition-colors ${selectedIds.has(inv.id) ? 'bg-blue-50' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-blue-50/30`}>
                        <td className="py-2 px-2 text-center">
                          {(inv.status !== 'paid') && (
                            <input type="checkbox" checked={selectedIds.has(inv.id)} onChange={() => toggleSelect(inv.id)}
                              className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer" />
                          )}
                        </td>
                        <td className="py-2 px-2 text-slate-500 whitespace-nowrap text-[11px]">{fmtDate(inv.invoice_date)}</td>
                        <td className="py-2 px-2 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          <span className={`inline-block mr-1 text-[9px] font-bold px-1 py-0.5 rounded ${isSale ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{isSale ? 'S' : 'P'}</span>
                          {inv.invoice_number}
                        </td>
                        <td className="py-2 px-2 font-medium text-slate-800 text-[11px]" style={{maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{inv.company_name}</td>
                        <td className={`py-2 px-2 font-semibold text-right whitespace-nowrap text-[11px] tabular-nums ${isSale ? 'text-emerald-600' : 'text-red-500'}`}>{fmtAmt(inv.amount)}</td>
                        <td className="py-2 px-2 text-right whitespace-nowrap text-[11px] tabular-nums text-slate-500">{amtPaid > 0 ? fmtAmt(amtPaid) : <span className="text-slate-200">—</span>}</td>
                        <td className="py-2 px-2 text-right whitespace-nowrap text-[11px] tabular-nums">
                          {amtDue > 0
                            ? <span className={`font-semibold ${inv.status === 'unpaid' && days > 90 ? 'text-red-500' : inv.status === 'unpaid' && days > 60 ? 'text-orange-500' : 'text-amber-600'}`}>{fmtAmt(amtDue)}</span>
                            : <span className="text-slate-200">—</span>}
                        </td>
                        <td className="py-2 px-2">{statusBadge(inv)}</td>
                        <td className="py-2 px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => setViewEntry(inv)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-semibold transition-colors border border-blue-100 whitespace-nowrap">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              View
                            </button>
                            {(inv.status === 'unpaid' || inv.status === 'partial') && (
                              <button onClick={() => onPayNow(inv)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-semibold transition-colors border border-emerald-100 whitespace-nowrap">
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
            </div>
            {/* Footer totals */}
            <div className="bg-slate-50 border-t border-slate-200 px-3 py-2 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">{filtered.length} invoice{filtered.length !== 1 ? 's' : ''}</span>
              <div className="flex gap-3 text-[10px] tabular-nums">
                <span className="text-slate-400">Amt <strong className="text-slate-600">{fmtAmt(filteredAmtTotal)}</strong></span>
                <span className="text-slate-400">Paid <strong className="text-emerald-600">{fmtAmt(filteredPaidTotal)}</strong></span>
                <span className="text-slate-400">Due <strong className="text-red-500">{fmtAmt(filteredDueTotal)}</strong></span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile totals */}
      <div className="sm:hidden flex gap-3 text-xs font-semibold px-1 mb-1">
        {filtered.some(i => i.entry_type === 'sale') && (
          <span className="text-emerald-600">+{fmtAmt(filtered.filter(i => i.entry_type === 'sale').reduce((s,i) => s+i.amount,0))}</span>
        )}
        {filtered.some(i => i.entry_type === 'purchase') && (
          <span className="text-red-500">−{fmtAmt(filtered.filter(i => i.entry_type === 'purchase').reduce((s,i) => s+i.amount,0))}</span>
        )}
      </div>

      {selectedIds.size > 0 && (() => {
        const selTotal = selectedInvoices.reduce((s, i) => s + Math.max(0, i.amount - (i.amount_paid ?? 0)), 0)
        return (
        <div className="sm:hidden sticky bottom-20 z-30 mx-1 mb-2 bg-blue-600 text-white rounded-2xl px-4 py-3 flex items-center justify-between shadow-2xl">
          <div>
            <span className="text-sm font-semibold">{selectedIds.size} selected</span>
            <span className="text-xs text-blue-200 ml-2">Due {fmtAmt(selTotal)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={clearSelected} className="text-[11px] text-blue-200 font-semibold">Clear</button>
            <button onClick={() => { onMultiPay(selectedInvoices); clearSelected() }}
              className="px-3 py-1.5 rounded-xl bg-white text-blue-600 text-xs font-bold">
              Pay · {fmtAmt(selTotal)}
            </button>
          </div>
        </div>
        )
      })()}
      {/* Mobile cards */}
      <div className="sm:hidden flex flex-col gap-1.5">
        {/* Mobile filter totals bar */}
        {filtered.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-100 px-3 py-1.5 flex items-center gap-2 flex-wrap text-[11px] tabular-nums">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{filtered.length} shown</span>
            <span className="text-slate-200">|</span>
            <span className="text-slate-500">Amt <strong className="text-slate-700">{fmtAmt(filteredAmtTotal)}</strong></span>
            <span className="text-slate-200">·</span>
            <span className="text-slate-500">Due <strong className="text-red-500">{fmtAmt(filteredDueTotal)}</strong></span>
          </div>
        )}
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm bg-white rounded-xl border border-slate-200">No invoices match the current filters</div>
        ) : filtered.map(inv => {
          const days = daysSince(inv.invoice_date)
          const isSale = inv.entry_type === 'sale'
          const ageCls = ageBadgeCls(days, inv.status)
          const amtDue = inv.status === 'paid' ? 0 : inv.amount - (inv.amount_paid ?? 0)
          return (
            <div key={inv.id} className={`rounded-xl px-3 py-2.5 border transition-colors ${selectedIds.has(inv.id) ? 'border-blue-400 bg-blue-50' : 'bg-white border-slate-100'}`}>
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isSale ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{isSale ? 'SALE' : 'PUR'}</span>
                    <p className="font-semibold text-[12px] text-slate-800 truncate">{inv.company_name}</p>
                  </div>
                  <p className="font-mono text-[10px] text-slate-400">{inv.invoice_number} · {fmtDate(inv.invoice_date)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-xs font-bold ${isSale ? 'text-emerald-600' : 'text-red-500'}`}>{fmtAmt(inv.amount)}</p>
                  {amtDue > 0 && <p className="text-[10px] text-amber-600 tabular-nums">Due {fmtAmt(amtDue)}</p>}
                </div>
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <div className="flex gap-1 flex-wrap items-center">
                  {statusBadge(inv)}
                  {inv.status === 'unpaid' && ageCls && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${ageCls}`}>{days}d</span>}
                  {inv.status !== 'paid' && (
                    <input type="checkbox" checked={selectedIds.has(inv.id)} onChange={() => toggleSelect(inv.id)}
                      className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer ml-1" />
                  )}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setViewEntry(inv)} className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-semibold hover:bg-blue-100 transition-colors border border-blue-100">View</button>
                  {(inv.status === 'unpaid' || inv.status === 'partial') && (
                    <button onClick={() => onPayNow(inv)} className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-semibold hover:bg-emerald-100 transition-colors border border-emerald-100">
                      {inv.status === 'partial' ? 'Pay+' : 'Pay'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modals */}
      {addOpen && (
        <InvoiceFormDrawer contacts={contacts} materials={materials} stockEntries={stockEntries} onClose={() => setAddOpen(false)}
          onSubmit={async (data, lines) => { await onAdd(data, lines); setAddOpen(false) }} onAddStock={onAddStock} />
      )}
      {editEntry && (
        <InvoiceFormDrawer contacts={contacts} materials={materials} stockEntries={stockEntries} editInvoice={editEntry}
          editLines={invoiceLines.filter(l => l.invoice_id === editEntry.id)}
          onClose={() => setEditEntry(null)}
          onSubmit={async (data, lines) => { await onUpdate?.(editEntry.id, data, lines); setEditEntry(null) }} onAddStock={onAddStock} />
      )}
      {viewEntry && (
        <InvoiceDetailModal
          inv={viewEntry}
          lines={invoiceLines.filter(l => l.invoice_id === viewEntry.id)}
          transactions={transactions}
          invoicePayments={invoicePayments}
          onClose={() => setViewEntry(null)}
          onEdit={() => requestPassword('Edit Invoice', () => { setEditEntry(viewEntry); setViewEntry(null) })}
          onMarkPaid={() => { onPayNow(viewEntry); setViewEntry(null) }}
          onUnpay={() => { onUnpay(viewEntry); setViewEntry(null) }}
          onDelete={(id) => requestPassword('Delete Invoice', async () => { setViewEntry(null); await onDelete(id) })}
          onUpdateNotes={async (invId, notes) => {
            if (onUpdate) {
              const inv = invoices.find(i => i.id === invId)
              const existingLines = invoiceLines.filter(l => l.invoice_id === invId)
              if (inv) await onUpdate(invId, { ...inv, notes: notes || null },
                existingLines.map(l => ({ material_name: l.material_name, hsn_code: l.hsn_code, quantity: l.quantity, unit: l.unit, rate: l.rate, gst_rate: l.gst_rate, cgst_rate: l.cgst_rate, sgst_rate: l.sgst_rate, igst_rate: l.igst_rate, batch_number: l.batch_number, mfd_date: l.mfd_date, expiry_date: l.expiry_date })))
            }
          }}
        />
      )}
      {passwordAction && (
        <PasswordModal title={passwordAction.label}
          onConfirm={() => { passwordAction.onConfirm(); setPasswordAction(null) }}
          onCancel={() => setPasswordAction(null)} />
      )}
      {payModalInvoices.length > 0 && (
        <PayModal
          invoices={payModalInvoices}
          invoiceLines={invoiceLines}
          invoicePayments={invoicePayments}
          onClose={onClosePayModal}
          onConfirm={onConfirmPayment}
        />
      )}
    </div>
  )
}

// ── Invoice Detail Modal ──────────────────────────────────────────────────────


function statusBadge(inv: InvoiceEntry) {
  if (inv.status === 'paid')
    return <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700">Paid</span>
  if (inv.status === 'partial') {
    const rem = inv.amount - (inv.amount_paid ?? 0)
    return <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-orange-50 text-orange-700">Partial · ₹{rem.toLocaleString('en-IN', { maximumFractionDigits: 0 })} left</span>
  }
  return <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700">Unpaid</span>
}


function InvoiceDetailModal({ inv, lines, transactions, invoicePayments, onClose, onEdit, onMarkPaid, onUnpay, onDelete, onUpdateNotes }: {
  inv: InvoiceEntry; lines: InvoiceLine[]; transactions: Transaction[]; invoicePayments: InvoicePayment[]; onClose: () => void; onEdit: () => void; onMarkPaid: () => void; onUnpay: () => void
  onDelete: (id: string) => void; onUpdateNotes: (invId: string, notes: string) => Promise<void>
}) {
  const days = daysSince(inv.invoice_date)
  const isSale = inv.entry_type === 'sale'
  const invPayments = invoicePayments.filter(p => p.invoice_id === inv.id).sort((a, b) => b.payment_date.localeCompare(a.payment_date))

  const [notes, setNotes] = React.useState(inv.notes || '')
  const [notesSaving, setNotesSaving] = React.useState(false)
  const [notesDirty, setNotesDirty] = React.useState(false)
  React.useEffect(() => { setNotes(inv.notes || ''); setNotesDirty(false) }, [inv.notes])
  const handleSaveNotes = async () => {
    setNotesSaving(true)
    await onUpdateNotes(inv.id, notes)
    setNotesSaving(false); setNotesDirty(false)
  }

  // Line item calculations
  const lineTotals = lines.map(line => {
    const base = (line.quantity ?? 0) * (line.rate ?? 0)
    const cgstAmt = base * ((line.cgst_rate ?? 0) / 100)
    const sgstAmt = base * ((line.sgst_rate ?? 0) / 100)
    const igstAmt = base * ((line.igst_rate ?? 0) / 100)
    const taxAmt = cgstAmt + sgstAmt + igstAmt
    return { base, cgstAmt, sgstAmt, igstAmt, taxAmt, total: base + taxAmt }
  })
  const grandSubtotal = lineTotals.reduce((s, l) => s + l.base, 0)
  const grandCgst     = lineTotals.reduce((s, l) => s + l.cgstAmt, 0)
  const grandSgst     = lineTotals.reduce((s, l) => s + l.sgstAmt, 0)
  const grandIgst     = lineTotals.reduce((s, l) => s + l.igstAmt, 0)
  const grandTotal    = lineTotals.reduce((s, l) => s + l.total, 0)

  const amtPaid = inv.amount_paid ?? 0
  const amtDue  = inv.status === 'paid' ? 0 : inv.amount - amtPaid

  // Payment terms label
  const payTermsLabel = inv.payment_terms
    ? inv.payment_terms === 'advance' ? 'Advance'
    : inv.payment_terms === 'custom' ? (inv.payment_terms_custom || 'Custom')
    : `Net ${inv.payment_terms} days`
    : null

  const KVRow = ({ label, value, mono, color, small }: { label: string; value: string; mono?: boolean; color?: string; small?: boolean }) => (
    <div className="flex items-start justify-between gap-2 px-3 py-1.5 border-b border-slate-50 last:border-0">
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex-shrink-0 mt-0.5 w-24">{label}</p>
      <p className={`text-right flex-1 ${small ? 'text-[10px]' : 'text-xs'} font-semibold ${color || 'text-slate-700'} ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col sm:flex-row sm:overflow-hidden">

      {/* ── Left Panel: meta + payment summary ─────────────────────────── */}
      <div className="flex-shrink-0 sm:w-64 sm:border-r sm:border-slate-100 sm:overflow-y-auto flex flex-col">

        {/* Header bar */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isSale ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{isSale ? 'SALE' : 'PURCHASE'}</span>
            {statusBadge(inv)}
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-colors">
            <svg className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Company + amount hero */}
        <div className="px-3 pt-3 pb-2 border-b border-slate-100">
          <p className="font-mono text-[10px] text-slate-400">{inv.invoice_number}</p>
          <p className="text-sm font-bold text-slate-900 leading-tight mt-0.5 mb-1">{inv.company_name}</p>
          <p className={`text-xl font-extrabold tabular-nums ${isSale ? 'text-emerald-600' : 'text-red-500'}`}>{isSale ? '+' : '−'}{fmtAmt(inv.amount)}</p>
          {inv.status === 'unpaid' && (
            <p className={`text-[10px] mt-0.5 font-semibold ${days > 90 ? 'text-red-500' : days > 60 ? 'text-orange-500' : 'text-amber-500'}`}>{days}d outstanding</p>
          )}
        </div>

        {/* Invoice meta */}
        <div className="border-b border-slate-100">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider px-3 pt-2 pb-1">Invoice Details</p>
          <KVRow label="Date" value={fmtDateLong(inv.invoice_date)} />
          {inv.received_date && <KVRow label="Received" value={fmtDateLong(inv.received_date)} />}
          {inv.gst_number && <KVRow label="GST No." value={inv.gst_number} mono small />}
          {payTermsLabel && <KVRow label="Pay Terms" value={payTermsLabel} />}
        </div>

        {/* Payment summary */}
        <div className="border-b border-slate-100">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider px-3 pt-2 pb-1">Payment</p>
          <KVRow label="Invoice Amt" value={fmtAmt(inv.amount)} color={isSale ? 'text-emerald-600' : 'text-red-500'} />
          <KVRow label="Paid" value={amtPaid > 0 ? fmtAmt(amtPaid) : '—'} color="text-emerald-600" />
          <KVRow label="Due" value={amtDue > 0 ? fmtAmt(amtDue) : '—'} color={amtDue > 0 ? 'text-amber-600' : 'text-slate-400'} />
          {inv.transaction_date && <KVRow label="Paid On" value={fmtDateLong(inv.transaction_date)} color="text-emerald-700" />}
          {inv.bank_account && <KVRow label="Account" value={inv.bank_account} small />}
          {inv.utr && <KVRow label="UTR/Ref" value={inv.utr} mono small />}
        </div>

        {/* Payment history — if multiple payments */}
        {invPayments.length > 1 && (
          <div className="border-b border-slate-100">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider px-3 pt-2 pb-1">Payment History</p>
            {invPayments.map(p => (
              <div key={p.id} className="flex items-center justify-between px-3 py-1.5 border-b border-slate-50 last:border-0">
                <div>
                  <p className="text-[10px] font-semibold text-slate-700 tabular-nums">{fmtAmt(p.amount)}</p>
                  <p className="text-[9px] text-slate-400">{fmtDate(p.payment_date)}{p.bank_account ? ` · ${p.bank_account}` : ''}</p>
                </div>
                {p.utr && <p className="text-[9px] font-mono text-slate-400">{p.utr}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Notes */}
        <div className="px-3 py-2.5 flex-1">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Notes</p>
          <textarea value={notes} onChange={e => { setNotes(e.target.value); setNotesDirty(true) }}
            rows={3} placeholder="Add notes…"
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-700 placeholder-slate-300 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300" />
          {notesDirty && (
            <button onClick={handleSaveNotes} disabled={notesSaving}
              className="mt-1 px-3 py-1 rounded-lg bg-blue-600 text-white text-[10px] font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {notesSaving ? 'Saving…' : 'Save Notes'}
            </button>
          )}
        </div>

        {/* Action buttons */}
        <div className="px-3 py-2.5 border-t border-slate-100 flex gap-1.5 flex-wrap">
          <button onClick={() => onDelete(inv.id)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 transition-colors">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
          <button onClick={onEdit}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
            </svg>
            Edit
          </button>
          {(inv.status === 'unpaid' || inv.status === 'partial') && (
            <button onClick={onMarkPaid}
              className="flex-1 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              {inv.status === 'partial' ? 'Pay More' : 'Record Payment'}
            </button>
          )}
          {inv.status === 'paid' && (
            <button onClick={onUnpay}
              className="flex-1 py-1.5 rounded-lg text-[11px] font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors flex items-center justify-center gap-1">
              Mark Unpaid
            </button>
          )}
        </div>
      </div>

      {/* ── Right Panel: line items table ───────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 sm:overflow-hidden border-t border-slate-100 sm:border-0">

        {/* Right header */}
        <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <p className="text-xs font-bold text-slate-700">Line Items</p>
          <span className="text-[10px] text-slate-400">{lines.length} item{lines.length !== 1 ? 's' : ''}</span>
        </div>

        {lines.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-300 text-sm">No line items recorded</div>
        ) : (
          <>
            {/* Scrollable table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-[11px]" style={{minWidth: '560px'}}>
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="py-2 px-3 text-[9px] font-bold text-slate-400 uppercase tracking-wide text-left">Material</th>
                    <th className="py-2 px-2 text-[9px] font-bold text-slate-400 uppercase tracking-wide text-left whitespace-nowrap">HSN</th>
                    <th className="py-2 px-2 text-[9px] font-bold text-slate-400 uppercase tracking-wide text-right whitespace-nowrap">Qty</th>
                    <th className="py-2 px-2 text-[9px] font-bold text-slate-400 uppercase tracking-wide text-right whitespace-nowrap">Rate</th>
                    <th className="py-2 px-2 text-[9px] font-bold text-slate-400 uppercase tracking-wide text-right whitespace-nowrap">Subtotal</th>
                    <th className="py-2 px-2 text-[9px] font-bold text-slate-400 uppercase tracking-wide text-right whitespace-nowrap">Tax</th>
                    <th className="py-2 px-2 text-[9px] font-bold text-slate-400 uppercase tracking-wide text-right whitespace-nowrap">Total</th>
                    <th className="py-2 px-2 text-[9px] font-bold text-slate-400 uppercase tracking-wide text-left whitespace-nowrap">Batch</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => {
                    const lt = lineTotals[i]
                    const hasIgst = (line.igst_rate ?? 0) > 0
                    const taxLabel = hasIgst
                      ? `IGST ${line.igst_rate}%`
                      : (line.cgst_rate ?? 0) > 0
                        ? `C+S ${line.cgst_rate}%+${line.sgst_rate ?? 0}%`
                        : line.gst_rate ? `GST ${line.gst_rate}%` : '—'
                    return (
                      <tr key={line.id} className={`border-b border-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                        <td className="py-2 px-3 font-medium text-slate-800" style={{maxWidth: 160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                          {line.material_name}
                        </td>
                        <td className="py-2 px-2 font-mono text-slate-400 whitespace-nowrap">{line.hsn_code || '—'}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-slate-600 whitespace-nowrap">{line.quantity != null ? `${line.quantity.toLocaleString('en-IN')} ${line.unit || ''}` : '—'}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-slate-600 whitespace-nowrap">{line.rate != null ? `₹${line.rate.toLocaleString('en-IN', {maximumFractionDigits: 2})}` : '—'}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-slate-600 whitespace-nowrap">{lt.base > 0 ? `₹${lt.base.toLocaleString('en-IN', {maximumFractionDigits: 2})}` : '—'}</td>
                        <td className="py-2 px-2 text-right whitespace-nowrap">
                          {lt.taxAmt > 0
                            ? <span className="text-blue-600 tabular-nums">{`₹${lt.taxAmt.toLocaleString('en-IN', {maximumFractionDigits: 2})}`}</span>
                            : <span className="text-slate-300">—</span>}
                          {lt.taxAmt > 0 && <span className="text-[9px] text-slate-400 ml-1">{taxLabel}</span>}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums font-semibold text-slate-800 whitespace-nowrap">{lt.total > 0 ? `₹${lt.total.toLocaleString('en-IN', {maximumFractionDigits: 2})}` : '—'}</td>
                        <td className="py-2 px-2 text-slate-400 whitespace-nowrap text-[10px]">
                          {line.batch_number && <span className="font-mono">{line.batch_number}</span>}
                          {line.mfd_date && <span className="ml-1 text-[9px]">Mfg {fmtDate(line.mfd_date)}</span>}
                          {line.expiry_date && <span className="ml-1 text-[9px] text-amber-600">Exp {fmtDate(line.expiry_date)}</span>}
                          {!line.batch_number && !line.mfd_date && !line.expiry_date && <span className="text-slate-200">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals footer */}
            <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 flex items-center justify-end gap-4 flex-wrap text-[11px] tabular-nums">
              {grandSubtotal > 0 && <span className="text-slate-500">Subtotal <strong className="text-slate-700">{fmtAmt(grandSubtotal)}</strong></span>}
              {grandCgst > 0   && <span className="text-slate-500">CGST <strong className="text-blue-600">{fmtAmt(grandCgst)}</strong></span>}
              {grandSgst > 0   && <span className="text-slate-500">SGST <strong className="text-purple-600">{fmtAmt(grandSgst)}</strong></span>}
              {grandIgst > 0   && <span className="text-slate-500">IGST <strong className="text-blue-600">{fmtAmt(grandIgst)}</strong></span>}
              {grandTotal > 0  && <span className="text-slate-500">Grand Total <strong className="text-slate-900 text-xs">{fmtAmt(grandTotal)}</strong></span>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Invoice Form Drawer ───────────────────────────────────────────────────────


function InvoiceFormDrawer({ contacts, materials, stockEntries = [], editInvoice, editLines, onClose, onSubmit, onAddStock }: {
  contacts: Contact[]
  materials: Material[]
  stockEntries?: StockEntry[]
  editInvoice?: InvoiceEntry | null
  editLines?: InvoiceLine[]
  onClose: () => void
  onSubmit: (data: Omit<InvoiceEntry, 'id' | 'created_at'>, lines: Omit<InvoiceLine, 'id' | 'invoice_id' | 'created_at'>[]) => Promise<void>
  onAddStock?: (s: Omit<StockEntry, 'id' | 'created_at'>) => Promise<void>
}) {
  const isEdit = !!editInvoice
  const today  = new Date().toISOString().split('T')[0]

  // Compute current stock per material name (sum of all entries, negative = sold)
  const stockMap = React.useMemo(() => {
    const map: Record<string, { qty: number; unit: string | null }> = {}
    stockEntries.forEach(s => {
      const key = s.material_name.toLowerCase()
      if (!map[key]) map[key] = { qty: 0, unit: s.unit }
      map[key].qty += s.quantity
      if (!map[key].unit && s.unit) map[key].unit = s.unit
    })
    return map
  }, [stockEntries])

  const getStock = (name: string) => {
    const key = name.toLowerCase()
    const s = stockMap[key]
    if (!s || s.qty <= 0) return null
    return s
  }
  const UNITS  = ['Kg', 'Gms', 'Ltr', 'Ml', 'Ths', 'Nos', 'Pcs', 'Boxes', 'Bags', 'Bottles', 'Strips', 'Other']
  const PAYMENT_TERMS = [
    { value: 'advance', label: 'Advance' },
    { value: '30',      label: '30 days' },
    { value: '45',      label: '45 days' },
    { value: '60',      label: '60 days' },
    { value: '90',      label: '90 days' },
    { value: 'custom',  label: 'Custom'  },
  ] as const

  type TaxMode = 'cgst_sgst' | 'igst'
  type LineInput = {
    material_name: string; hsn_code: string; quantity: string
    unit: string; rate: string; custom_unit: string
    tax_mode: TaxMode
    cgst_rate: string; sgst_rate: string; igst_rate: string
    batch_number: string; mfd_date: string; expiry_date: string
    is_sample: boolean
  }

  const emptyLine = (): LineInput => ({
    material_name: '', hsn_code: '', quantity: '', unit: 'Kg', rate: '', custom_unit: '',
    tax_mode: 'cgst_sgst', cgst_rate: '', sgst_rate: '', igst_rate: '',
    batch_number: '', mfd_date: '', expiry_date: '',
    is_sample: false,
  })

  const [entryType,    setEntryType]    = React.useState<InvoiceEntryType>(editInvoice?.entry_type ?? 'purchase')
  const [companySearch, setCompanySearch] = React.useState(editInvoice?.company_name ?? '')
  const [selectedContact, setSelectedContact] = React.useState<Contact | null>(null)
  const [showContactDrop, setShowContactDrop] = React.useState(false)
  const [invoiceNumber, setInvoiceNumber] = React.useState(editInvoice?.invoice_number ?? '')
  const [invoiceDate,  setInvoiceDate]  = React.useState(editInvoice?.invoice_date ?? today)
  const [receivedDate, setReceivedDate] = React.useState(editInvoice?.received_date ?? '')
  const [paymentTerms, setPaymentTerms] = React.useState<string>(editInvoice?.payment_terms ?? '')
  const [paymentTermsCustom, setPaymentTermsCustom] = React.useState(editInvoice?.payment_terms_custom ?? '')
  const [amountRaw,    setAmountRaw]    = React.useState(editInvoice?.amount ? String(editInvoice.amount) : '')
  const [amountManuallyEdited, setAmountManuallyEdited] = React.useState(!!editInvoice)
  const [notes,        setNotes]        = React.useState(editInvoice?.notes ?? '')
  const [saving,       setSaving]       = React.useState(false)
  const [showMatDrop,  setShowMatDrop]  = React.useState<boolean[]>([false])
  // Sample modal: when user clicks a sample-checked line after submit
  const [sampleModal, setSampleModal] = React.useState<{ lineIdx: number; materialName: string; qty: number; unit: string | null; batchNo: string | null; mfdDate: string | null; expiryDate: string | null } | null>(null)
  const [sampleCompany, setSampleCompany] = React.useState('')
  const [sampleSaving, setSampleSaving] = React.useState(false)

  const [lines, setLines] = React.useState<LineInput[]>(() => {
    if (editLines && editLines.length > 0) {
      return editLines.map(l => {
        const hasIgst = (l.igst_rate ?? 0) > 0
        return {
          material_name: l.material_name,
          hsn_code:      l.hsn_code ?? '',
          quantity:      l.quantity != null ? String(l.quantity) : '',
          unit:          UNITS.includes(l.unit ?? '') ? (l.unit ?? 'Kg') : 'Other',
          rate:          l.rate != null ? String(l.rate) : '',
          custom_unit:   UNITS.includes(l.unit ?? '') ? '' : (l.unit ?? ''),
          tax_mode:      hasIgst ? 'igst' : 'cgst_sgst',
          cgst_rate:     l.cgst_rate != null ? String(l.cgst_rate) : '',
          sgst_rate:     l.sgst_rate != null ? String(l.sgst_rate) : '',
          igst_rate:     l.igst_rate != null ? String(l.igst_rate) : '',
          batch_number:  l.batch_number ?? '',
          mfd_date:      l.mfd_date ?? '',
          expiry_date:   l.expiry_date ?? '',
          is_sample:     false,
        }
      })
    }
    return [emptyLine()]
  })

  const lineCalcs = lines.map(l => {
    const qty  = parseFloat(l.quantity) || 0
    const rate = parseFloat(l.rate)     || 0
    const base = qty * rate
    if (l.tax_mode === 'igst') {
      const igst    = parseFloat(l.igst_rate) || 0
      const igstAmt = base * (igst / 100)
      return { base, cgstAmt: 0, sgstAmt: 0, igstAmt, gstAmt: igstAmt, total: base + igstAmt, cgst: 0, sgst: 0, igst }
    } else {
      const cgst    = parseFloat(l.cgst_rate) || 0
      const sgst    = parseFloat(l.sgst_rate) || 0
      const cgstAmt = base * (cgst / 100)
      const sgstAmt = base * (sgst / 100)
      const gstAmt  = cgstAmt + sgstAmt
      return { base, cgstAmt, sgstAmt, igstAmt: 0, gstAmt, total: base + gstAmt, cgst, sgst, igst: 0 }
    }
  })
  const calculatedTotal = lineCalcs.reduce((s, c) => s + c.total, 0)

  React.useEffect(() => {
    if (!amountManuallyEdited && calculatedTotal > 0) setAmountRaw(calculatedTotal.toFixed(2))
  }, [calculatedTotal, amountManuallyEdited])

  const parsedAmount = parseFloat(amountRaw.replace(/,/g, '')) || 0

  const filteredContacts = React.useMemo(() => {
    if (!companySearch.trim()) return contacts.slice(0, 8)
    return contacts.filter(c => c.company_name.toLowerCase().includes(companySearch.toLowerCase())).slice(0, 8)
  }, [contacts, companySearch])

  const filteredMaterials = (search: string) => {
    if (!search.trim()) return materials.slice(0, 8)
    return materials.filter(m => m.material_name.toLowerCase().includes(search.toLowerCase())).slice(0, 8)
  }

  const updateLine = (idx: number, field: keyof LineInput, value: string) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l))
    if (['quantity','rate','cgst_rate','sgst_rate','igst_rate'].includes(field)) setAmountManuallyEdited(false)
  }

  const pickMaterial = (idx: number, mat: Material) => {
    const totalGst = mat.gst_rate ?? 0
    const half     = totalGst / 2
    setLines(prev => prev.map((l, i) => i === idx ? {
      ...l,
      material_name: mat.material_name,
      hsn_code:      mat.hsn_code ?? '',
      cgst_rate:     mat.gst_rate != null ? String(half) : l.cgst_rate,
      sgst_rate:     mat.gst_rate != null ? String(half) : l.sgst_rate,
      igst_rate:     '',
      tax_mode:      'cgst_sgst' as TaxMode,
    } : l))
    setShowMatDrop(prev => prev.map((v, i) => i === idx ? false : v))
    setAmountManuallyEdited(false)
  }

  const addLine = () => { setLines(prev => [...prev, emptyLine()]); setShowMatDrop(prev => [...prev, false]) }
  const removeLine = (idx: number) => {
    if (lines.length === 1) return
    setLines(prev => prev.filter((_, i) => i !== idx))
    setShowMatDrop(prev => prev.filter((_, i) => i !== idx))
    setAmountManuallyEdited(false)
  }

  const handleSubmit = async () => {
    if (!companySearch.trim() || !invoiceNumber.trim() || !invoiceDate || parsedAmount <= 0) return
    const validLines = lines.filter(l => l.material_name.trim())
    setSaving(true)
    const contact = selectedContact
      ?? contacts.find(c => c.company_name.toLowerCase() === companySearch.toLowerCase().trim())
      ?? null
    await onSubmit(
      {
        invoice_number:       invoiceNumber.trim(),
        invoice_date:         invoiceDate,
        received_date:        receivedDate || null,
        entry_type:           entryType,
        contact_id:           contact?.id ?? editInvoice?.contact_id ?? null,
        company_name:         companySearch.trim(),
        gst_number:           contact?.gst_number ?? editInvoice?.gst_number ?? null,
        amount:               parsedAmount,
        notes:                notes.trim() || null,
        payment_terms:        (paymentTerms as InvoiceEntry['payment_terms']) || null,
        payment_terms_custom: paymentTerms === 'custom' ? (paymentTermsCustom.trim() || null) : null,
        status:               editInvoice?.status ?? 'unpaid',
        transaction_date:     editInvoice?.transaction_date ?? null,
        utr:                  editInvoice?.utr ?? null,
        bank_account:         editInvoice?.bank_account ?? null,
        sub_category:         editInvoice?.sub_category ?? null,
        settled_tx_id:        editInvoice?.settled_tx_id ?? null,
        amount_paid:          editInvoice?.amount_paid ?? 0,
      },
      validLines.map(l => ({
        material_name: l.material_name.trim(),
        hsn_code:      l.hsn_code.trim() || null,
        quantity:      l.quantity ? parseFloat(l.quantity) : null,
        unit:          l.unit === 'Other' ? (l.custom_unit.trim() || null) : (l.unit || null),
        rate:          l.rate ? parseFloat(l.rate) : null,
        gst_rate:      l.tax_mode === 'igst'
          ? (l.igst_rate ? parseFloat(l.igst_rate) : null)
          : ((l.cgst_rate ? parseFloat(l.cgst_rate) : 0) + (l.sgst_rate ? parseFloat(l.sgst_rate) : 0)) || null,
        cgst_rate:     l.tax_mode === 'cgst_sgst' && l.cgst_rate ? parseFloat(l.cgst_rate) : null,
        sgst_rate:     l.tax_mode === 'cgst_sgst' && l.sgst_rate ? parseFloat(l.sgst_rate) : null,
        igst_rate:     l.tax_mode === 'igst'      && l.igst_rate ? parseFloat(l.igst_rate) : null,
        batch_number:  l.batch_number.trim() || null,
        mfd_date:      l.mfd_date   || null,
        expiry_date:   l.expiry_date || null,
      }))
    )

    // For purchase invoices, auto-save stock entries for all valid lines
    if (entryType === 'purchase' && onAddStock) {
      const mat = materials.find(m => m.material_name.toLowerCase() === 'dummy') // just for type ref
      for (const l of validLines) {
        const qty = l.quantity ? parseFloat(l.quantity) : null
        if (!qty || qty <= 0) continue
        const resolvedUnit = l.unit === 'Other' ? (l.custom_unit.trim() || null) : (l.unit || null)
        await onAddStock({
          material_id:    materials.find(m => m.material_name.toLowerCase() === l.material_name.toLowerCase().trim())?.id ?? '',
          material_name:  l.material_name.trim(),
          invoice_id:     null,
          invoice_number: invoiceNumber.trim(),
          supplier_name:  companySearch.trim(),
          quantity:       qty,
          unit:           resolvedUnit,
          rate:           l.rate ? parseFloat(l.rate) : null,
          batch_number:   l.batch_number.trim() || null,
          mfd_date:       l.mfd_date || null,
          expiry_date:    l.expiry_date || null,
          entry_date:     receivedDate || invoiceDate,
          notes:          l.is_sample ? '🧪 Sample' : null,
        })
      }
      // Queue sample modal for sample-flagged lines (first one found)
      const firstSampleLine = validLines.find(l => l.is_sample && l.quantity && parseFloat(l.quantity) > 0)
      if (firstSampleLine) {
        setSaving(false)
        setSampleModal({
          lineIdx: validLines.indexOf(firstSampleLine),
          materialName: firstSampleLine.material_name.trim(),
          qty: parseFloat(firstSampleLine.quantity),
          unit: firstSampleLine.unit === 'Other' ? (firstSampleLine.custom_unit.trim() || null) : (firstSampleLine.unit || null),
          batchNo: firstSampleLine.batch_number.trim() || null,
          mfdDate: firstSampleLine.mfd_date || null,
          expiryDate: firstSampleLine.expiry_date || null,
        })
        return
      }
    }

    setSaving(false)
  }

  const handleSampleSubmit = async () => {
    if (!sampleModal || !sampleCompany.trim() || !onAddStock) return
    setSampleSaving(true)
    await onAddStock({
      material_id:    materials.find(m => m.material_name.toLowerCase() === sampleModal.materialName.toLowerCase())?.id ?? '',
      material_name:  sampleModal.materialName,
      invoice_id:     null,
      invoice_number: null,
      supplier_name:  null,
      quantity:       -Math.abs(sampleModal.qty),
      unit:           sampleModal.unit,
      rate:           null,
      batch_number:   sampleModal.batchNo,
      mfd_date:       sampleModal.mfdDate,
      expiry_date:    sampleModal.expiryDate,
      entry_date:     new Date().toISOString().split('T')[0],
      notes:          sampleModal.materialName ? `🧪 Sample → ${sampleCompany.trim()}` : sampleCompany.trim(),
    })
    setSampleSaving(false)
    setSampleModal(null)
    setSampleCompany('')
    onClose()
  }

  const inp = 'w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-300'
  const lbl = 'text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5'

  const CGST_SGST_SLABS = [
    { label: '5%',  cgst: '2.5', sgst: '2.5' },
    { label: '12%', cgst: '6',   sgst: '6'   },
    { label: '18%', cgst: '9',   sgst: '9'   },
    { label: '28%', cgst: '14',  sgst: '14'  },
    { label: 'Nil', cgst: '0',   sgst: '0'   },
  ]
  const IGST_SLABS = [
    { label: '5%',  igst: '5'  },
    { label: '12%', igst: '12' },
    { label: '18%', igst: '18' },
    { label: '28%', igst: '28' },
    { label: 'Nil', igst: '0'  },
  ]

  // ── Validation chips ─────────────────────────────────────────────────────
  const validCompany = companySearch.trim().length > 0
  const validInvNo   = invoiceNumber.trim().length > 0
  const validDate    = !!invoiceDate
  const validLines   = lines.some(l => l.material_name.trim())

  // ── Summary calcs ─────────────────────────────────────────────────────────
  const totalTaxable = lineCalcs.reduce((s, c) => s + c.base, 0)
  const totalCgst    = lineCalcs.reduce((s, c) => s + c.cgstAmt, 0)
  const totalSgst    = lineCalcs.reduce((s, c) => s + c.sgstAmt, 0)
  const totalIgst    = lineCalcs.reduce((s, c) => s + c.igstAmt, 0)
  const hasIgstLines = totalIgst > 0
  const hasCgstLines = totalCgst > 0

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 640

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* ── DESKTOP: Full-screen two-panel modal ── */}
      <div className="fixed inset-0 z-50 hidden sm:flex flex-col bg-white">

        {/* Top bar */}
        <div className="flex-shrink-0 bg-[#1d4ed8] px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-white font-bold text-sm">{isEdit ? 'Edit Invoice' : 'New Invoice'}</h2>
            {/* Purchase / Sale toggle */}
            <div className="flex bg-white/20 rounded-lg p-0.5 gap-0.5">
              {(['purchase', 'sale'] as const).map(t => (
                <button key={t} onClick={() => !isEdit && setEntryType(t)}
                  disabled={isEdit}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-colors
                    ${entryType === t
                      ? t === 'purchase' ? 'bg-red-600 text-white shadow' : 'bg-emerald-500 text-white shadow'
                      : 'text-white/70 hover:text-white'
                    } ${isEdit ? 'cursor-default' : ''}`}>
                  {t === 'purchase' ? '↑ Purchase' : '↓ Sale'}
                </button>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Body: left = form, right = summary */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── LEFT: form ── */}
          <div className="flex-1 overflow-y-auto px-8 py-6 flex flex-col gap-6">

            {/* Company + Invoice meta */}
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4">
              <div className="relative">
                <label className={lbl}>Company / Party</label>
                <input value={companySearch}
                  onChange={e => { setCompanySearch(e.target.value); setSelectedContact(null); setShowContactDrop(true) }}
                  onFocus={() => setShowContactDrop(true)}
                  placeholder="Search or type company name…"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-300" />
                {showContactDrop && filteredContacts.length > 0 && (
                  <div className="absolute z-20 w-full bg-white border border-slate-200 rounded-xl shadow-xl mt-1 max-h-48 overflow-y-auto">
                    {filteredContacts.map(c => (
                      <button key={c.id} onClick={() => { setSelectedContact(c); setCompanySearch(c.company_name); setShowContactDrop(false) }}
                        className="w-full text-left px-3 py-2.5 hover:bg-blue-50 text-sm flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-800">{c.company_name}</span>
                        {c.gst_number && <span className="text-xs text-slate-400 font-mono">{c.gst_number}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className={lbl}>Invoice No.</label>
                <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value.toUpperCase())}
                  placeholder="INV-001"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-300" />
              </div>
              <div>
                <label className={lbl}>Invoice Date</label>
                <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-300" />
              </div>
              {entryType === 'purchase' ? (
                <div>
                  <label className={lbl}>Received Date</label>
                  <input type="date" value={receivedDate} onChange={e => setReceivedDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-300" />
                </div>
              ) : <div />}
            </div>

            {/* Payment terms row (purchase only) */}
            {entryType === 'purchase' && (
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Payment Terms</span>
                {[
                  { value: 'advance', label: 'Advance' },
                  { value: '30', label: '30 days' },
                  { value: '45', label: '45 days' },
                  { value: '60', label: '60 days' },
                  { value: '90', label: '90 days' },
                  { value: 'custom', label: 'Custom' },
                ].map(t => (
                  <button key={t.value} onClick={() => setPaymentTerms(paymentTerms === t.value ? '' : t.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors
                      ${paymentTerms === t.value ? 'bg-[#1d4ed8] text-white border-[#1d4ed8]' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                    {t.label}
                  </button>
                ))}
                {paymentTerms === 'custom' && (
                  <input value={paymentTermsCustom} onChange={e => setPaymentTermsCustom(e.target.value)}
                    placeholder="e.g. 15 days after delivery"
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-300 w-52" />
                )}
              </div>
            )}

            {/* ── LINE ITEMS TABLE ── */}
            <div className="border border-slate-200 rounded-xl">
              <div className="bg-slate-50 px-5 py-3 border-b border-slate-200">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Line Items</span>
              </div>

              {/* Column headers */}
              <div className="grid gap-x-3 px-4 py-1.5 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider"
                style={{gridTemplateColumns:'100px 90px 110px 130px 150px 36px'}}>
                <span>HSN Code</span>
                <span className="text-right">Qty</span>
                <span>Unit</span>
                <span className="text-right">Rate (₹)</span>
                <span className="text-right">Line Total</span>
                <span/>
              </div>

              {/* Rows */}
              <div className="divide-y divide-slate-100">
                {lines.map((line, lidx) => {
                  const calc = lineCalcs[lidx]
                  const inpLg = 'w-full px-3 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-300'
                  return (
                    <div key={lidx} className="group hover:bg-blue-50/20 transition-colors">

                      {/* ── Row 1: Material name (full width) ── */}
                      <div className="px-5 pt-4 pb-2">
                        <div className="relative">
                          <input value={line.material_name}
                            onChange={e => { updateLine(lidx, 'material_name', e.target.value); setShowMatDrop(prev => prev.map((v, i) => i === lidx ? true : v)) }}
                            onFocus={() => setShowMatDrop(prev => prev.map((v, i) => i === lidx ? true : v))}
                            placeholder="Material name…" className={inpLg + ' font-medium pr-32'} />
                          {entryType === 'sale' && line.material_name.trim() && !showMatDrop[lidx] && (() => {
                            const st = getStock(line.material_name)
                            return st
                              ? <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded font-bold pointer-events-none whitespace-nowrap">Stock: {st.qty.toLocaleString('en-IN')}{st.unit ? ` ${st.unit}` : ''}</span>
                              : <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded pointer-events-none">no stock</span>
                          })()}
                          {showMatDrop[lidx] && filteredMaterials(line.material_name).length > 0 && (
                            <div className="absolute z-30 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-2xl mt-1 max-h-52 overflow-y-auto">
                              {filteredMaterials(line.material_name).map(m => (
                                <button key={m.id} onClick={() => pickMaterial(lidx, m)}
                                  className="w-full text-left px-3 py-2.5 hover:bg-blue-50 text-sm flex items-center justify-between gap-2">
                                  <span className="font-medium text-slate-800 truncate">{m.material_name}</span>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {m.hsn_code && <span className="text-xs text-slate-400 font-mono">{m.hsn_code}</span>}
                                    {m.gst_rate != null && <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-bold">{m.gst_rate}%</span>}
                                    {entryType === 'sale' && (() => {
                                      const st = getStock(m.material_name)
                                      return st
                                        ? <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded font-bold whitespace-nowrap">Stock: {st.qty.toLocaleString('en-IN')}{st.unit ? ` ${st.unit}` : ''}</span>
                                        : <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-400 rounded">no stock</span>
                                    })()}
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ── Row 2: HSN | Qty | Unit | Rate | Total | ✕ ── */}
                      <div className="grid gap-x-4 px-5 pb-2 items-start"
                        style={{gridTemplateColumns:'100px 90px 110px 130px 150px 36px'}}>

                        {/* HSN */}
                        <input value={line.hsn_code} onChange={e => updateLine(lidx, 'hsn_code', e.target.value)}
                          placeholder="e.g. 2835" className={inpLg + ' font-mono'} />

                        {/* Qty */}
                        <input type="number" inputMode="decimal" value={line.quantity}
                          onChange={e => updateLine(lidx, 'quantity', e.target.value)}
                          onWheel={e => (e.target as HTMLInputElement).blur()}
                          placeholder="0" className={inpLg + ' text-right'} />

                        {/* Unit */}
                        <select value={line.unit} onChange={e => updateLine(lidx, 'unit', e.target.value)} className={inpLg}>
                          {UNITS.map(u => <option key={u}>{u}</option>)}
                        </select>

                        {/* Rate */}
                        <input type="number" inputMode="decimal" value={line.rate}
                          onChange={e => updateLine(lidx, 'rate', e.target.value)}
                          onWheel={e => (e.target as HTMLInputElement).blur()}
                          placeholder="0.00" className={inpLg + ' text-right'} />

                        {/* Line total */}
                        <div className={`${inpLg} text-right font-bold tabular-nums border-slate-100 bg-slate-50 ${calc.total > 0 ? 'text-slate-800' : 'text-slate-300'}`}>
                          {calc.total > 0 ? fmtAmt(calc.total) : '—'}
                        </div>

                        {/* Remove */}
                        <div className="flex items-center justify-center pt-1">
                          {lines.length > 1 ? (
                            <button onClick={() => removeLine(lidx)}
                              className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-full bg-red-100 text-red-500 flex items-center justify-center hover:bg-red-200 transition-all">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
                            </button>
                          ) : <span/>}
                        </div>
                      </div>

                      {/* ── Row 3: GST + Batch (horizontally scrollable) ── */}
                      <div className="px-5 pb-5 pt-1 overflow-x-auto">
                        <div className="flex items-end gap-4 min-w-max">
                          {/* Tax section */}
                          <div className="flex items-center gap-2">
                            {/* Mode toggle */}
                            <div className="flex rounded-lg overflow-hidden border border-slate-200">
                              {(['cgst_sgst', 'igst'] as const).map(m => (
                                <button key={m} onClick={() => updateLine(lidx, 'tax_mode', m)}
                                  className={`px-2.5 py-1 text-xs font-bold transition-colors
                                    ${line.tax_mode === m ? 'bg-slate-700 text-white' : 'bg-white text-slate-400 hover:bg-slate-50'}`}>
                                  {m === 'cgst_sgst' ? 'CGST+SGST' : 'IGST'}
                                </button>
                              ))}
                            </div>
                            {/* Slab pills */}
                            <div className="flex gap-1">
                              {(line.tax_mode === 'cgst_sgst' ? CGST_SGST_SLABS : IGST_SLABS).map((s: any) => {
                                const active = line.tax_mode === 'cgst_sgst'
                                  ? (line.cgst_rate === s.cgst && line.sgst_rate === s.sgst)
                                  : line.igst_rate === s.igst
                                return (
                                  <button key={s.label} onClick={() => {
                                    if (line.tax_mode === 'cgst_sgst') { updateLine(lidx, 'cgst_rate', s.cgst); updateLine(lidx, 'sgst_rate', s.sgst) }
                                    else { updateLine(lidx, 'igst_rate', s.igst) }
                                  }}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors
                                      ${active
                                        ? line.tax_mode === 'cgst_sgst' ? 'bg-blue-600 text-white border-blue-600' : 'bg-purple-600 text-white border-purple-600'
                                        : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600'}`}>
                                    {s.label}
                                  </button>
                                )
                              })}
                            </div>
                            {calc.gstAmt > 0 && (
                              <span className="text-xs text-slate-400 font-mono whitespace-nowrap">+{fmtAmt(calc.gstAmt)} tax</span>
                            )}
                          </div>

                          {/* Divider */}
                          <div className="h-8 w-px bg-slate-200 flex-shrink-0"/>

                          {/* Batch No */}
                          <div className="flex-shrink-0 w-28">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Batch No.</p>
                            <input value={line.batch_number} onChange={e => updateLine(lidx, 'batch_number', e.target.value)}
                              placeholder="—" className={inpLg + ' font-mono'} />
                          </div>

                          {/* Mfg Date */}
                          <div className="flex-shrink-0 w-36">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Mfg Date</p>
                            <input type="date" value={line.mfd_date} onChange={e => updateLine(lidx, 'mfd_date', e.target.value)}
                              className={inpLg} />
                          </div>

                          {/* Expiry Date */}
                          <div className="flex-shrink-0 w-36">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Expiry Date</p>
                            <input type="date" value={line.expiry_date} onChange={e => updateLine(lidx, 'expiry_date', e.target.value)}
                              className={inpLg} />
                          </div>

                          {/* Sample checkbox — purchase only */}
                          {entryType === 'purchase' && (
                            <div className="flex-shrink-0 flex flex-col items-center justify-end gap-1 pb-0.5">
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Sample</p>
                              <button
                                onClick={() => setLines(prev => prev.map((l, i) => i === lidx ? { ...l, is_sample: !l.is_sample } : l))}
                                className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all ${
                                  line.is_sample
                                    ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                                    : 'bg-white border-slate-200 text-slate-300 hover:border-amber-400 hover:text-amber-400'
                                }`}
                                title="Mark as sample"
                              >
                                🧪
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Custom unit input if needed */}
                      {line.unit === 'Other' && (
                        <div className="px-5 pb-4 -mt-1">
                          <input value={line.custom_unit} onChange={e => updateLine(lidx, 'custom_unit', e.target.value)}
                            placeholder="Specify unit…" className={inpLg + ' w-40 text-sm'} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Add Line button — bottom of table */}
              <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 rounded-b-xl">
                <button onClick={addLine}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-bold hover:bg-blue-100 transition-colors border border-blue-100">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg>
                  Add Line
                </button>
              </div>
            </div>

            {/* Remarks */}
            <div>
              <label className={lbl}>Remarks / Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                placeholder="Freight charges, special terms, delivery notes…"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-300 resize-none" />
            </div>
          </div>

          {/* ── RIGHT: Invoice Summary panel ── */}
          <div className="w-80 flex-shrink-0 border-l border-slate-200 bg-slate-50 flex flex-col">
            <div className="px-5 py-3.5 border-b border-slate-200">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Invoice Summary</p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
              {/* Tax breakdown */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Taxable Amount</span>
                  <span className="font-semibold text-slate-800 tabular-nums">{totalTaxable > 0 ? fmtAmt(totalTaxable) : '—'}</span>
                </div>
                {hasCgstLines && <>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">CGST</span>
                    <span className="font-semibold text-blue-600 tabular-nums">{fmtAmt(totalCgst)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">SGST</span>
                    <span className="font-semibold text-blue-600 tabular-nums">{fmtAmt(totalSgst)}</span>
                  </div>
                </>}
                {hasIgstLines && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">IGST</span>
                    <span className="font-semibold text-purple-600 tabular-nums">{fmtAmt(totalIgst)}</span>
                  </div>
                )}
                {!hasCgstLines && !hasIgstLines && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Tax</span>
                    <span className="text-slate-300">—</span>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 pt-3 flex justify-between items-center">
                <span className="text-sm font-bold text-slate-700">Grand Total</span>
                <span className="text-2xl font-extrabold tabular-nums" style={{color: entryType === 'purchase' ? '#dc2626' : '#059669'}}>
                  {calculatedTotal > 0 ? fmtAmt(calculatedTotal) : '—'}
                </span>
              </div>

              {/* Override */}
              <div className="border border-slate-200 rounded-xl p-3.5 bg-white">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Invoice Total (Override)</p>
                <input value={amountRaw}
                  onChange={e => { setAmountRaw(e.target.value); setAmountManuallyEdited(true) }}
                  placeholder={calculatedTotal > 0 ? calculatedTotal.toFixed(2) : '0.00'}
                  inputMode="numeric"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-300" />
                {amountManuallyEdited && calculatedTotal > 0 && (
                  <button onClick={() => { setAmountRaw(calculatedTotal.toFixed(2)); setAmountManuallyEdited(false) }}
                    className="text-xs text-blue-600 font-semibold hover:underline mt-1.5 block">
                    ↺ Use calculated ({fmtAmt(calculatedTotal)})
                  </button>
                )}
                <p className="text-[10px] text-slate-400 mt-1.5">Auto-calculated from lines · edit if freight / round-off differs</p>
              </div>

              {/* Validation chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  { ok: validCompany, label: 'Company' },
                  { ok: validInvNo,   label: 'Inv No.' },
                  { ok: validDate,    label: 'Date' },
                  { ok: validLines,   label: `${lines.filter(l => l.material_name.trim()).length} line${lines.filter(l => l.material_name.trim()).length !== 1 ? 's' : ''}` },
                ].map(v => (
                  <span key={v.label} className={`px-2.5 py-1 rounded-full text-xs font-semibold border
                    ${v.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                    {v.ok ? '✓' : '○'} {v.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Save button */}
            <div className="px-5 py-4 border-t border-slate-200 flex flex-col gap-2">
              <button onClick={handleSubmit}
                disabled={saving || !validCompany || !validInvNo || parsedAmount <= 0}
                style={{ background: saving || !validCompany || !validInvNo || parsedAmount <= 0 ? '#94a3b8' : entryType === 'purchase' ? '#dc2626' : '#059669' }}
                className="w-full py-3 rounded-xl font-bold text-sm text-white transition-colors">
                {saving ? 'Saving…' : isEdit ? 'Save Changes' : entryType === 'purchase' ? 'Save Purchase Invoice' : 'Save Sale Invoice'}
              </button>
              <button onClick={onClose} className="w-full py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── MOBILE: Fullscreen sheet ── */}
      <div className="fixed inset-0 z-50 sm:hidden bg-white flex flex-col">

        {/* Header */}
        <div className="flex-shrink-0 bg-[#1d4ed8] px-4 py-3 flex items-center justify-between">
          <p className="text-white font-bold text-sm">{isEdit ? 'Edit Invoice' : 'New Invoice'}</p>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Purchase / Sale toggle */}
        <div className="flex-shrink-0 px-4 pt-3 pb-0">
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            {(['purchase', 'sale'] as const).map(t => (
              <button key={t} onClick={() => !isEdit && setEntryType(t)}
                disabled={isEdit}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors
                  ${entryType === t
                    ? t === 'purchase' ? 'bg-red-600 text-white shadow-sm' : 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-500'
                  } ${isEdit ? 'opacity-60 cursor-default' : ''}`}>
                {t === 'purchase' ? '↑ Purchase' : '↓ Sale'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">

          {/* Company */}
          <div className="relative">
            <label className={lbl}>Company</label>
            <input value={companySearch}
              onChange={e => { setCompanySearch(e.target.value); setSelectedContact(null); setShowContactDrop(true) }}
              onFocus={() => setShowContactDrop(true)}
              placeholder="Search or type…" className={inp} />
            {showContactDrop && filteredContacts.length > 0 && (
              <div className="absolute z-10 w-full bg-white border border-slate-200 rounded-xl shadow-xl mt-1 max-h-36 overflow-y-auto">
                {filteredContacts.map(c => (
                  <button key={c.id} onClick={() => { setSelectedContact(c); setCompanySearch(c.company_name); setShowContactDrop(false) }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 text-xs flex items-center justify-between">
                    <span className="font-medium text-slate-800">{c.company_name}</span>
                    {c.gst_number && <span className="text-[10px] text-slate-400 font-mono">{c.gst_number}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Invoice No + Date */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={lbl}>Invoice No.</label>
              <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value.toUpperCase())}
                placeholder="INV-001" className={inp + ' font-mono'} />
            </div>
            <div>
              <label className={lbl}>Invoice Date</label>
              <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className={inp} />
            </div>
          </div>

          {/* Received Date + Terms (purchase) */}
          {entryType === 'purchase' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={lbl}>Received Date <span className="normal-case font-normal text-slate-300">(opt)</span></label>
                <input type="date" value={receivedDate} onChange={e => setReceivedDate(e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Payment Terms</label>
                <select value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} className={inp}>
                  <option value="">— Select —</option>
                  {[{value:'advance',label:'Advance'},{value:'30',label:'30 days'},{value:'45',label:'45 days'},{value:'60',label:'60 days'},{value:'90',label:'90 days'},{value:'custom',label:'Custom'}].map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Line Items (mobile cards) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={lbl}>Line Items</label>
              <button onClick={addLine}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 text-[10px] font-bold hover:bg-blue-100 border border-blue-100">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg>
                + Add Line
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {lines.map((line, lidx) => {
                const calc = lineCalcs[lidx]
                return (
                  <div key={lidx} className="border border-slate-200 rounded-xl p-3 bg-slate-50 relative">
                    {lines.length > 1 && (
                      <button onClick={() => removeLine(lidx)}
                        className="absolute top-2 right-2 w-5 h-5 rounded-full bg-red-100 text-red-500 flex items-center justify-center">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    )}
                    {/* Material name (full width row) */}
                    <div className="relative mb-2 pr-6">
                      <input value={line.material_name}
                        onChange={e => { updateLine(lidx, 'material_name', e.target.value); setShowMatDrop(prev => prev.map((v, i) => i === lidx ? true : v)) }}
                        onFocus={() => setShowMatDrop(prev => prev.map((v, i) => i === lidx ? true : v))}
                        placeholder="Material name…" className={inp + ' font-semibold text-slate-800'} />
                      {showMatDrop[lidx] && filteredMaterials(line.material_name).length > 0 && (
                        <div className="absolute z-20 w-full bg-white border border-slate-200 rounded-xl shadow-xl mt-1 max-h-32 overflow-y-auto">
                          {filteredMaterials(line.material_name).map(m => (
                            <button key={m.id} onClick={() => pickMaterial(lidx, m)}
                              className="w-full text-left px-3 py-2 hover:bg-blue-50 text-xs flex items-center justify-between gap-2">
                              <span className="font-medium text-slate-800 truncate">{m.material_name}</span>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {m.gst_rate != null && <span className="text-[9px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full font-bold">{m.gst_rate}%</span>}
                                {entryType === 'sale' && (() => {
                                  const st = getStock(m.material_name)
                                  return st
                                    ? <span className="text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-bold whitespace-nowrap">Stock: {st.qty.toLocaleString('en-IN')}{st.unit ? ` ${st.unit}` : ''}</span>
                                    : <span className="text-[9px] text-slate-400 italic">no stock</span>
                                })()}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {entryType === 'sale' && line.material_name.trim() && !showMatDrop[lidx] && (() => {
                        const st = getStock(line.material_name)
                        return st
                          ? <span className="mt-1 inline-block text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded font-bold">Stock: {st.qty.toLocaleString('en-IN')}{st.unit ? ` ${st.unit}` : ''}</span>
                          : <span className="mt-1 inline-block text-[10px] text-slate-400 italic">no stock</span>
                      })()}
                      {calc.total > 0 && (
                        <span className="absolute right-7 top-2.5 text-xs font-bold text-slate-700 tabular-nums whitespace-nowrap">{fmtAmt(calc.total)}</span>
                      )}
                    </div>

                    {/* Qty + Unit + Rate + HSN */}
                    <div className="grid grid-cols-4 gap-1.5 mb-2">
                      <div>
                        <label className={lbl}>Qty</label>
                        <input type="number" inputMode="decimal" value={line.quantity}
                          onChange={e => updateLine(lidx, 'quantity', e.target.value)}
                          onWheel={e => (e.target as HTMLInputElement).blur()}
                          placeholder="0" className={inp} />
                      </div>
                      <div>
                        <label className={lbl}>Unit</label>
                        <select value={line.unit} onChange={e => updateLine(lidx, 'unit', e.target.value)} className={inp}>
                          {UNITS.map(u => <option key={u}>{u}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={lbl}>@ Rate ₹</label>
                        <input type="number" inputMode="decimal" value={line.rate}
                          onChange={e => updateLine(lidx, 'rate', e.target.value)}
                          onWheel={e => (e.target as HTMLInputElement).blur()}
                          placeholder="0" className={inp} />
                      </div>
                      <div>
                        <label className={lbl}>HSN</label>
                        <input value={line.hsn_code} onChange={e => updateLine(lidx, 'hsn_code', e.target.value)}
                          placeholder="HSN" className={inp + ' font-mono'} />
                      </div>
                    </div>

                    {/* GST + Batch (horizontally scrollable) */}
                    <div className="border-t border-slate-200 pt-2 -mx-3 px-3 overflow-x-auto">
                      <div className="flex items-end gap-3 min-w-max pb-1">
                        {/* Tax mode + slabs */}
                        <div className="flex items-center gap-1.5">
                          {(['cgst_sgst', 'igst'] as const).map(m => (
                            <button key={m} onClick={() => updateLine(lidx, 'tax_mode', m)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors
                                ${line.tax_mode === m ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-400 border-slate-200'}`}>
                              {m === 'cgst_sgst' ? 'CGST+SGST' : 'IGST'}
                            </button>
                          ))}
                          {(line.tax_mode === 'cgst_sgst' ? CGST_SGST_SLABS : IGST_SLABS).map((s: any) => (
                            <button key={s.label} onClick={() => {
                              if (line.tax_mode === 'cgst_sgst') {
                                updateLine(lidx, 'cgst_rate', s.cgst); updateLine(lidx, 'sgst_rate', s.sgst)
                              } else {
                                updateLine(lidx, 'igst_rate', s.igst)
                              }
                            }}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors
                                ${(line.tax_mode === 'cgst_sgst' ? (line.cgst_rate === s.cgst && line.sgst_rate === s.sgst) : line.igst_rate === s.igst)
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white text-slate-400 border-slate-200 hover:border-blue-300'}`}>
                              {s.label}
                            </button>
                          ))}
                        </div>

                        <div className="h-6 w-px bg-slate-200 flex-shrink-0"/>

                        {/* Batch No */}
                        <div className="flex-shrink-0 w-24">
                          <label className={lbl}>Batch No.</label>
                          <input value={line.batch_number} onChange={e => updateLine(lidx, 'batch_number', e.target.value)}
                            placeholder="Batch" className={inp + ' font-mono'} />
                        </div>
                        {/* Mfg Date */}
                        <div className="flex-shrink-0 w-32">
                          <label className={lbl}>Mfg Date</label>
                          <input type="date" value={line.mfd_date} onChange={e => updateLine(lidx, 'mfd_date', e.target.value)} className={inp} />
                        </div>
                        {/* Expiry */}
                        <div className="flex-shrink-0 w-32">
                          <label className={lbl}>Expiry</label>
                          <input type="date" value={line.expiry_date} onChange={e => updateLine(lidx, 'expiry_date', e.target.value)} className={inp} />
                        </div>

                        {/* Sample toggle — purchase only */}
                        {entryType === 'purchase' && (
                          <div className="flex-shrink-0 flex flex-col items-center justify-end gap-1">
                            <label className={lbl}>Sample</label>
                            <button
                              onClick={() => setLines(prev => prev.map((l, i) => i === lidx ? { ...l, is_sample: !l.is_sample } : l))}
                              className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-bold transition-all ${
                                line.is_sample
                                  ? 'bg-amber-500 border-amber-500 text-white'
                                  : 'bg-white border-slate-200 text-slate-400 hover:border-amber-400 hover:text-amber-500'
                              }`}
                            >
                              🧪 {line.is_sample ? 'Yes' : 'No'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Mobile Grand Total summary */}
          <div className="bg-slate-900 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Grand Total</span>
              <span className="text-xs text-slate-400">{lines.filter(l=>l.material_name.trim()).length} lines · {hasCgstLines ? 'CGST+SGST' : hasIgstLines ? 'IGST' : 'No tax'}</span>
            </div>
            <p className="text-2xl font-extrabold text-white tabular-nums">
              {parsedAmount > 0 ? fmtAmt(parsedAmount) : '—'}
            </p>
            {amountManuallyEdited && calculatedTotal > 0 && calculatedTotal !== parsedAmount && (
              <div className="mt-2 flex items-center gap-2">
                <input value={amountRaw}
                  onChange={e => { setAmountRaw(e.target.value); setAmountManuallyEdited(true) }}
                  placeholder="Override amount" inputMode="numeric"
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-white/10 text-white text-xs border border-white/20 outline-none" />
                <button onClick={() => { setAmountRaw(calculatedTotal.toFixed(2)); setAmountManuallyEdited(false) }}
                  className="text-[10px] text-blue-300 font-semibold hover:underline whitespace-nowrap">
                  ↺ Use calc
                </button>
              </div>
            )}
          </div>

          {/* Remarks */}
          <div>
            <label className={lbl}>Remarks (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Freight, special terms, notes…" className={inp + ' resize-none'} />
          </div>

        </div>

        {/* Save footer */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-slate-100 flex flex-col gap-2">
          {/* Validation chips */}
          <div className="flex gap-1.5 flex-wrap">
            {[
              { ok: validCompany, label: 'Company' },
              { ok: validInvNo,   label: 'Inv No.' },
              { ok: validDate,    label: 'Date' },
              { ok: validLines,   label: `${lines.filter(l => l.material_name.trim()).length} lines` },
            ].map(v => (
              <span key={v.label} className={`px-2 py-0.5 rounded-full text-[10px] font-semibold
                ${v.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                {v.ok ? '✓' : '○'} {v.label}
              </span>
            ))}
          </div>
          <button onClick={handleSubmit}
            disabled={saving || !validCompany || !validInvNo || parsedAmount <= 0}
            style={{ background: saving || !validCompany || !validInvNo || parsedAmount <= 0 ? '#94a3b8' : entryType === 'purchase' ? '#dc2626' : '#059669' }}
            className="w-full py-3 rounded-xl font-bold text-sm text-white transition-colors">
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : entryType === 'purchase' ? 'Save Purchase Invoice' : 'Save Sale Invoice'}
          </button>
          <button onClick={onClose} className="w-full py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-colors text-center">
            Cancel
          </button>
        </div>
      </div>

      {/* ── Sample Company Modal ── */}
      {sampleModal && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[60]" onClick={() => { setSampleModal(null); onClose() }} />
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 pointer-events-none">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm pointer-events-auto">
              <div className="px-5 pt-5 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">🧪</span>
                  <p className="font-bold text-slate-800 text-sm">Give Sample</p>
                </div>
                <p className="text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-700">{sampleModal.materialName}</span>
                  {' '}· {sampleModal.qty} {sampleModal.unit ?? ''}
                  {sampleModal.batchNo && <span className="font-mono ml-1 text-slate-400">({sampleModal.batchNo})</span>}
                </p>
                <p className="text-[10px] text-amber-600 font-medium mt-1">Stock has been added. This will deduct the sample qty from stock.</p>
              </div>
              <div className="px-5 py-4 flex flex-col gap-3">
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Company / Recipient *</label>
                  <input
                    value={sampleCompany}
                    onChange={e => setSampleCompany(e.target.value)}
                    placeholder="e.g. ABC Pharma"
                    autoFocus
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                </div>
              </div>
              <div className="px-5 pb-5 flex gap-2">
                <button
                  onClick={() => { setSampleModal(null); onClose() }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  Skip
                </button>
                <button
                  onClick={handleSampleSubmit}
                  disabled={sampleSaving || !sampleCompany.trim()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-40 transition-colors"
                >
                  {sampleSaving ? 'Saving…' : 'Give Sample'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}


// ── Download helpers ──────────────────────────────────────────────────────────

function r(n: number): number { return Math.round(n * 100) / 100 }

// Two-sheet Excel: Sales + Purchases — GST-filing grade, slab-split columns
function downloadInvoiceExcel(invoices: InvoiceEntry[], allLines: InvoiceLine[]) {
  import('xlsx').then(XLSX => {
    const today = new Date().toISOString().split('T')[0]

    // ── Column layout ─────────────────────────────────────────────────────────
    // Invoice header columns (repeated on every line row)
    // then per-line: Material, HSN, Qty, Unit, Rate, Taxable Value
    // then GST columns split by slab and type:
    //   Taxable @5%  | CGST @2.5% | SGST @2.5%  | IGST @5%
    //   Taxable @12% | CGST @6%   | SGST @6%    | IGST @12%
    //   Taxable @18% | CGST @9%   | SGST @9%    | IGST @18%
    //   Taxable @28% | CGST @14%  | SGST @14%   | IGST @28%
    //   Nil/Exempt   (taxable only, no GST)
    // then: Total Tax | Invoice Total | Batch | Mfg Date | Expiry

    // Helper: round to 2dp
    const rv = (n: number) => Math.round(n * 100) / 100

    // Snap a rate to nearest slab (2.5/5/6/9/12/14/18/28) — handles float drift
    const snapRate = (rate: number) => {
      const slabs = [0, 2.5, 5, 6, 9, 12, 14, 18, 28]
      return slabs.reduce((best, s) => Math.abs(s - rate) < Math.abs(best - rate) ? s : best, 0)
    }

    function buildRows(invList: InvoiceEntry[]) {
      const rows: Record<string, string | number>[] = []

      for (const inv of invList) {
        const lines = allLines.filter(l => l.invoice_id === inv.id)
        const dateStr = inv.invoice_date     ? inv.invoice_date.split('-').reverse().join('/')     : ''
        const recvStr = inv.received_date    ? inv.received_date.split('-').reverse().join('/')    : ''
        const txStr   = inv.transaction_date ? inv.transaction_date.split('-').reverse().join('/') : ''

        const invBase = {
          'Invoice Date':   dateStr,
          'Invoice No':     inv.invoice_number,
          'Party Name':     inv.company_name,
          'GSTIN':          inv.gst_number ?? '',
          'Status':         inv.status,
          'Payment Date':   txStr,
          'UTR / Ref':      inv.utr ?? '',
          'Bank Account':   inv.bank_account ?? '',
          'Invoice Amount': inv.amount,
          'Amount Paid':    inv.amount_paid ?? 0,
          'Balance Due':    inv.status === 'paid' ? 0 : rv(inv.amount - (inv.amount_paid ?? 0)),
          'Notes':          inv.notes ?? '',
        }

        const emptyGst = {
          'Material': '', 'HSN Code': '', 'Qty': '', 'Unit': '', 'Rate (₹)': '',
          'Taxable Value': '',
          // requested GST columns only
          'IGST @18%': '',
          'CGST @9%': '',  'SGST @9%': '',
          'CGST @2.5%': '', 'SGST @2.5%': '',
          // Totals
          'Total Tax': '', 'Line Total': '',
          // Batch info
          'Batch No': '', 'Mfg Date': '', 'Expiry Date': '',
        }

        if (lines.length === 0) {
          rows.push({ ...invBase, ...emptyGst })
          continue
        }

        for (const l of lines) {
          const qty      = l.quantity ?? 0
          const rate     = l.rate ?? 0
          const taxable  = rv(qty * rate)

          const rawCgst  = l.cgst_rate ?? 0
          const rawSgst  = l.sgst_rate ?? 0
          const rawIgst  = l.igst_rate ?? 0

          const cgst     = snapRate(rawCgst)
          const sgst     = snapRate(rawSgst)
          const igst     = snapRate(rawIgst)

          const cgstAmt  = rv(taxable * cgst  / 100)
          const sgstAmt  = rv(taxable * sgst  / 100)
          const igstAmt  = rv(taxable * igst  / 100)
          const totalTax = rv(cgstAmt + sgstAmt + igstAmt)
          const lineTotal = rv(taxable + totalTax)

          // Determine total GST slab (CGST+SGST combined, or IGST alone)
          const combinedSlab = cgst > 0 ? snapRate(cgst + sgst) : 0
          const igstSlab     = igst > 0 ? igst : 0
          const totalSlab    = combinedSlab || igstSlab

          const gst: Record<string, string | number> = {
            'Material':      l.material_name,
            'HSN Code':      l.hsn_code ?? '',
            'Qty':           qty || '',
            'Unit':          l.unit ?? '',
            'Rate (₹)':      rate || '',
            'Taxable Value': taxable || '',
            // requested GST columns only
            'IGST @18%':    igst === 18      ? igstAmt : '',
            'CGST @9%':     cgst === 9       ? cgstAmt : '',
            'SGST @9%':     sgst === 9       ? sgstAmt : '',
            'CGST @2.5%':   cgst === 2.5     ? cgstAmt : '',
            'SGST @2.5%':   sgst === 2.5     ? sgstAmt : '',
            // Totals
            'Total Tax':    totalTax  || '',
            'Line Total':   lineTotal || '',
            // Batch
            'Batch No':     l.batch_number ?? '',
            'Mfg Date':     l.mfd_date    ? l.mfd_date.split('-').reverse().join('/')    : '',
            'Expiry Date':  l.expiry_date ? l.expiry_date.split('-').reverse().join('/') : '',
          }

          rows.push({ ...invBase, ...gst })
        }
      }

      // ── Grand totals row ───────────────────────────────────────────────────
      const numCols = [
        'Invoice Amount','Amount Paid','Balance Due','Taxable Value',
        'IGST @18%','CGST @9%','SGST @9%','CGST @2.5%','SGST @2.5%',
        'Total Tax','Line Total',
      ]
      const totals: Record<string, string | number> = {
        'Invoice Date': '', 'Invoice No': 'GRAND TOTAL', 'Party Name': `${rows.length} line(s)`,
      }
      for (const col of numCols) {
        totals[col] = rv(rows.reduce((s, row) => s + (parseFloat(String(row[col])) || 0), 0))
      }
      rows.push(totals)
      return rows
    }

    // ── Header order ──────────────────────────────────────────────────────────
    const headers = [
      // Invoice info
      'Invoice Date','Invoice No','Party Name','GSTIN',
      'Status','Payment Date','UTR / Ref','Bank Account',
      'Invoice Amount','Amount Paid','Balance Due','Notes',
      // Line info
      'Material','HSN Code','Qty','Unit','Rate (₹)','Taxable Value',
      // GST columns
      'IGST @18%','CGST @9%','SGST @9%','CGST @2.5%','SGST @2.5%',
      // Line totals
      'Total Tax','Line Total',
      // Batch / pharma info
      'Batch No','Mfg Date','Expiry Date',
    ]

    const colWidths = [
      12,18,30,20,            // Invoice Date, No, Party, GSTIN
      8,12,18,14,             // Status, PayDate, UTR, Bank
      14,12,12,28,            // Inv Amt, Paid, Due, Notes
      30,10,7,6,10,12,        // Material, HSN, Qty, Unit, Rate, Taxable
      12,11,11,11,11,         // IGST@18, CGST@9, SGST@9, CGST@2.5, SGST@2.5
      10,12,                  // Total Tax, Line Total
      12,11,11,               // Batch, Mfg, Expiry
    ]

    const wb = XLSX.utils.book_new()

    // ── Style helper — bold + background for header row ───────────────────────
    const styleSheet = (ws: ReturnType<typeof XLSX.utils.json_to_sheet>, rowCount: number) => {
      ws['!cols'] = colWidths.map(wch => ({ wch }))
      // Freeze top row
      ws['!freeze'] = { xSplit: 0, ySplit: 1 }
      return ws
    }

    const salesList = invoices.filter(i => i.entry_type === 'sale')
    const purList   = invoices.filter(i => i.entry_type === 'purchase')

    if (salesList.length > 0) {
      const rows = buildRows(salesList)
      const ws   = XLSX.utils.json_to_sheet(rows, { header: headers })
      styleSheet(ws, rows.length)
      XLSX.utils.book_append_sheet(wb, ws, 'Sales')
    }

    if (purList.length > 0) {
      const rows = buildRows(purList)
      const ws   = XLSX.utils.json_to_sheet(rows, { header: headers })
      styleSheet(ws, rows.length)
      XLSX.utils.book_append_sheet(wb, ws, 'Purchases')
    }

    XLSX.writeFile(wb, `GST_Invoices_${today}.xlsx`)
  })
}

// ── Pay Modal ─────────────────────────────────────────────────────────────────

function PayModal({ invoices, invoiceLines, invoicePayments, onClose, onConfirm }: {
  invoices: InvoiceEntry[]
  invoiceLines: InvoiceLine[]
  invoicePayments: InvoicePayment[]
  onClose: () => void
  onConfirm: (invoices: InvoiceEntry[], amount: number, date: string, account: string, mode: string, utr: string, notes: string, isPartial: boolean, category: string, subCategory: string, tdsAmount: number) => Promise<void>
}) {
  const today = new Date().toISOString().split('T')[0]
  const isSale      = invoices[0].entry_type === 'sale'
  const isMulti     = invoices.length > 1
  const totalDue    = invoices.reduce((s, i) => s + Math.max(0, i.amount - (i.amount_paid ?? 0)), 0)

  const defaultCategory    = isSale ? 'Sales & Collections' : 'Procurement & Purchases'
  const defaultSubCategory = isSale ? 'Advance Customer Payment' : 'Credit Vendor Payment'

  const [payDate,      setPayDate]      = React.useState(today)
  const [account,      setAccount]      = React.useState('SBI')
  const [payMode,      setPayMode]      = React.useState('RTGS/NEFT')
  const [utr,          setUtr]          = React.useState('')
  const [notes,        setNotes]        = React.useState('')
  const [amountRaw,    setAmountRaw]    = React.useState(totalDue.toFixed(2))
  const [isPartial,    setIsPartial]    = React.useState(false)
  const [saving,       setSaving]       = React.useState(false)
  const [category,     setCategory]     = React.useState(defaultCategory)
  const [subCategory,  setSubCategory]  = React.useState(defaultSubCategory)
  const [isTDS,        setIsTDS]        = React.useState(false)
  const [tdsRaw,       setTdsRaw]       = React.useState('')

  const parsedAmount = parseFloat(amountRaw.replace(/,/g, '')) || 0
  const parsedTDS    = isTDS ? (parseFloat(tdsRaw.replace(/,/g, '')) || 0) : 0
  const coveredByPayment = parsedAmount + parsedTDS
  const excessAmount = !isTDS && parsedAmount > totalDue ? parsedAmount - totalDue : 0
  const tdsFullyCovered = isTDS && coveredByPayment >= totalDue - 0.01
  const isValid = parsedAmount > 0 && payDate && (!isTDS || parsedTDS > 0)

  // When partial toggled on — keep current amount editable; off — snap back to full due
  React.useEffect(() => {
    if (!isPartial && !isTDS) setAmountRaw(totalDue.toFixed(2))
  }, [isPartial, totalDue, isTDS])

  // When TDS toggled on — set received = totalDue, tds = 0 (user fills in tds, amount auto-adjusts)
  React.useEffect(() => {
    if (isTDS) {
      setIsPartial(false)
      setAmountRaw(totalDue.toFixed(2))
      setTdsRaw('')
    } else {
      setAmountRaw(totalDue.toFixed(2))
      setTdsRaw('')
    }
  }, [isTDS, totalDue])

  // Auto-compute received amount = totalDue - tds when tds changes
  React.useEffect(() => {
    if (isTDS && parsedTDS > 0) {
      const received = Math.max(0, totalDue - parsedTDS)
      setAmountRaw(received.toFixed(2))
    }
  }, [tdsRaw, isTDS, totalDue])

  // Auto-update subCategory when category changes
  const catOptions    = isSale ? RECEIVE_CATEGORIES : SEND_CATEGORIES
  const subCatOptions = isSale
    ? (RECEIVE_SUB_CATEGORIES[category] ?? [])
    : (SEND_SUB_CATEGORIES[category] ?? [])

  React.useEffect(() => {
    if (!subCatOptions.includes(subCategory)) setSubCategory(subCatOptions[0] ?? '')
  }, [category])

  const handleConfirm = async () => {
    if (!isValid) return
    setSaving(true)
    await onConfirm(invoices, parsedAmount, payDate, account, payMode, utr, notes, isPartial, category, subCategory, parsedTDS)
    setSaving(false)
  }

  const ACCOUNTS    = ['SBI', 'ICICI', 'Cash']
  const PAY_MODES   = ['RTGS/NEFT', 'PhonePe', 'Cheque', 'Cash', 'Others']
  const accentColor = isSale ? '#059669' : '#dc2626'

  // Payment history for these invoices
  const history = invoicePayments
    .filter(p => invoices.some(i => i.id === p.invoice_id))
    .sort((a, b) => b.payment_date.localeCompare(a.payment_date))
    .slice(0, 8)

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-[60] bg-white rounded-t-2xl max-h-[96vh] flex flex-col shadow-2xl">

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-9 h-1 bg-slate-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-100 flex-shrink-0 flex items-center justify-between">
          <div>
            <p className="font-bold text-sm text-slate-800">
              {isMulti ? `Pay ${invoices.length} Invoices` : 'Record Payment'}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">{invoices[0].company_name}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-4">

          {/* ── Invoice details (read-only) ── */}
          <div className="flex flex-col gap-2">
            {invoices.map(inv => {
              const remaining = inv.amount - (inv.amount_paid ?? 0)
              const linesForInv = invoiceLines.filter(l => l.invoice_id === inv.id)
              return (
                <div key={inv.id} className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden">
                  {/* Invoice header row */}
                  <div className="flex items-start justify-between px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[11px] text-slate-500">{inv.invoice_number}</span>
                        <span className="text-[10px] text-slate-400">{fmtDateLong(inv.invoice_date)}</span>
                        {inv.status === 'partial' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">Partial</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Total: <strong>₹{inv.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
                        {(inv.amount_paid ?? 0) > 0 && (
                          <span className="text-orange-600 ml-2">
                            Paid: ₹{(inv.amount_paid ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </p>
                    </div>
                    <p className={`text-sm font-bold flex-shrink-0 ${isSale ? 'text-emerald-600' : 'text-red-500'}`}>
                      {isSale ? '+' : '−'}₹{remaining.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      <span className="block text-[9px] font-normal text-slate-400 text-right">due</span>
                    </p>
                  </div>
                  {/* Material lines */}
                  {linesForInv.length > 0 && (
                    <div className="border-t border-slate-200 bg-white px-4 py-2 flex flex-col gap-1">
                      {linesForInv.map(line => (
                        <div key={line.id} className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-700 truncate flex-1">{line.material_name}</span>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2 text-slate-400">
                            {line.quantity != null && <span>{line.quantity} {line.unit || ''}</span>}
                            {line.hsn_code && <span className="font-mono text-[10px]">{line.hsn_code}</span>}
                            {line.cgst_rate != null && line.cgst_rate > 0
                              ? <span className="text-blue-600 font-semibold">C{line.cgst_rate}+S{line.sgst_rate ?? 0}%</span>
                              : line.gst_rate != null && line.gst_rate > 0
                                ? <span className="text-blue-600 font-semibold">{line.gst_rate}%</span>
                                : null
                            }
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* ── Total Due summary ── */}
          <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
            <span className="text-xs font-semibold text-slate-600">
              {isMulti ? `Total Due (${invoices.length} invoices)` : 'Amount Due'}
            </span>
            <span className="text-lg font-extrabold" style={{ color: accentColor }}>
              ₹{totalDue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* ── Category & Sub-category ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white">
                {catOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sub-category</label>
              <select value={subCategory} onChange={e => setSubCategory(e.target.value)}
                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white">
                {subCatOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* ── TDS toggle ── */}
          <div className="flex items-center justify-between px-1">
            <div>
              <p className="text-sm font-semibold text-slate-700">TDS Deducted</p>
              <p className="text-[11px] text-slate-400">Customer paid less due to TDS — invoice will be fully settled</p>
            </div>
            <button
              onClick={() => setIsTDS(v => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors ${isTDS ? 'bg-amber-500' : 'bg-slate-300'}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${isTDS ? 'left-5.5 translate-x-0.5' : 'left-0.5'}`} />
            </button>
          </div>

          {/* ── TDS amount field ── */}
          {isTDS && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">TDS Amount (₹)</span>
                <span className="text-[10px] text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full font-semibold">Invoice will be marked Paid</span>
              </div>
              <input
                type="number" inputMode="decimal"
                value={tdsRaw}
                onChange={e => setTdsRaw(e.target.value)}
                placeholder="e.g. 200"
                className="w-full px-4 py-2.5 rounded-xl border border-amber-300 bg-white text-base font-bold focus:outline-none focus:ring-2 focus:ring-amber-300 transition-colors"
              />
              {parsedTDS > 0 && (
                <div className="flex flex-col gap-1 text-[11px]">
                  <div className="flex justify-between text-slate-600">
                    <span>Invoice total</span>
                    <span className="font-semibold tabular-nums">₹{totalDue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-amber-700">
                    <span>TDS deducted</span>
                    <span className="font-semibold tabular-nums">− ₹{parsedTDS.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-800 border-t border-amber-200 pt-1 mt-0.5">
                    <span>Amount received</span>
                    <span className="tabular-nums text-emerald-700">₹{parsedAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                  </div>
                  {!tdsFullyCovered && (
                    <p className="text-red-600 font-semibold mt-1">⚠ TDS + received (₹{coveredByPayment.toLocaleString('en-IN', { maximumFractionDigits: 2 })}) is less than total due</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Partial payment toggle ── */}
          <div className={`flex items-center justify-between px-1 ${isTDS ? 'opacity-40 pointer-events-none' : ''}`}>
            <div>
              <p className="text-sm font-semibold text-slate-700">Partial Payment</p>
              <p className="text-[11px] text-slate-400">Enter the actual amount received/paid</p>
            </div>
            <button
              onClick={() => setIsPartial(v => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors ${isPartial ? 'bg-blue-600' : 'bg-slate-300'}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${isPartial ? 'left-5.5 translate-x-0.5' : 'left-0.5'}`} />
            </button>
          </div>

          {/* ── Payment amount ── */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              {isTDS ? 'Amount Received (₹) — auto-calculated' : isPartial ? 'Partial Amount (₹)' : 'Amount (₹)'}
            </label>
            <input
              type="number" inputMode="decimal"
              value={amountRaw}
              onChange={e => { if (!isTDS) setAmountRaw(e.target.value) }}
              readOnly={isTDS}
              className={`mt-1 w-full px-4 py-3 rounded-xl border text-base font-bold focus:outline-none transition-colors ${isTDS ? 'border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed' : 'border-blue-300 bg-white focus:ring-2 focus:ring-blue-300'}`}
              placeholder="0.00"
            />
            {isMulti && isPartial && (
              <p className="text-[10px] text-slate-400 mt-1">Will be split proportionally across invoices</p>
            )}
            {!isTDS && excessAmount > 0 && (
              <p className="text-[11px] text-purple-700 font-semibold mt-1 bg-purple-50 border border-purple-200 rounded-lg px-3 py-1.5">
                ₹{excessAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })} excess — will be saved as advance balance for {invoices[0].company_name}
              </p>
            )}
          </div>

          {/* ── Payment Date ── */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Payment Date</label>
            <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
              className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          {/* ── Account chips ── */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Bank Account</label>
            <div className="flex gap-2 mt-1.5 flex-wrap">
              {ACCOUNTS.map(a => (
                <button key={a} onClick={() => setAccount(a)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border
                    ${account === a ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* ── Payment mode chips ── */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Payment Mode</label>
            <div className="flex gap-2 mt-1.5 flex-wrap">
              {PAY_MODES.map(m => (
                <button key={m} onClick={() => setPayMode(m)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border
                    ${payMode === m ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* ── UTR / Ref ── */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">UTR / Cheque No. / Reference</label>
            <input value={utr} onChange={e => setUtr(e.target.value)}
              placeholder="Transaction reference number…"
              className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          {/* ── Notes ── */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Notes (optional)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Remarks, memo…"
              className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          {/* ── Payment history ── */}
          {history.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Previous Payments</p>
              <div className="flex flex-col gap-1.5">
                {history.map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                    <div>
                      <p className="text-[11px] font-semibold text-slate-700">
                        ₹{p.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        {p.payment_mode && <span className="text-slate-400 font-normal ml-1.5">· {p.payment_mode}</span>}
                      </p>
                      {p.utr && <p className="text-[10px] font-mono text-slate-400">{p.utr}</p>}
                    </div>
                    <p className="text-[10px] text-slate-400">{fmtDate(p.payment_date)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* ── Confirm button ── */}
        <div className="px-5 py-4 border-t border-slate-100 flex-shrink-0">
          {isTDS && parsedTDS > 0 && (
            <p className="text-[11px] text-amber-700 font-semibold text-center mb-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
              Transaction ₹{parsedAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })} · TDS ₹{parsedTDS.toLocaleString('en-IN', { maximumFractionDigits: 2 })} → Invoice marked Paid
            </p>
          )}
          {!isTDS && isPartial && parsedAmount > 0 && parsedAmount < totalDue && (
            <p className="text-[11px] text-orange-600 font-semibold text-center mb-2">
              Partial — ₹{(totalDue - parsedAmount).toLocaleString('en-IN', { maximumFractionDigits: 2 })} will remain outstanding
            </p>
          )}
          {!isTDS && excessAmount > 0 && (
            <p className="text-[11px] text-purple-700 font-semibold text-center mb-2">
              ₹{excessAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })} excess → saved as advance in {invoices[0].company_name}
            </p>
          )}
          <button
            onClick={handleConfirm}
            disabled={!isValid || saving || (isTDS && !tdsFullyCovered)}
            className="w-full py-4 rounded-2xl font-bold text-white text-sm transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: (isValid && !saving && (!isTDS || tdsFullyCovered)) ? (isTDS ? '#d97706' : accentColor) : '#94a3b8' }}>
            {saving
              ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg> Recording…</>
              : isTDS && parsedTDS > 0
                ? `Record ₹${parsedAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })} + TDS ₹${parsedTDS.toLocaleString('en-IN', { maximumFractionDigits: 2 })} · Mark Paid`
                : excessAmount > 0
                  ? `Record ₹${parsedAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })} + save ₹${excessAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })} advance`
                  : isPartial
                    ? `Record Partial Payment · ₹${parsedAmount > 0 ? parsedAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '0'}`
                    : isMulti
                      ? `Pay ${invoices.length} Invoices · ₹${parsedAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
                      : `Confirm Payment · ₹${parsedAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
            }
          </button>
        </div>

      </div>
    </>
  )
}