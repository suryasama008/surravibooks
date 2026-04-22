'use client'

import React, { useMemo, useState } from 'react'
import { Transaction, CreditEntry } from '@/types'

interface Props {
  transactions: Transaction[]        // full FY — for top companies
  filtered: Transaction[]            // period-filtered — for stats
  loading: boolean
  fiscalYear: string
  isFiltered: boolean
  filterLabel: string
  credits: CreditEntry[]
  selectedMonth: string
  setSelectedMonth: (v: string) => void
  dateFrom: string
  setDateFrom: (v: string) => void
  dateTo: string
  setDateTo: (v: string) => void
  fyMonths: { label: string; value: string }[]
  clearFilter: () => void
  openingBalances: Record<string, number>
  onSaveOpeningBalance: (account: string, balance: number) => Promise<void>
}

// Full Indian format with paise — used everywhere
function fmt(n: number) {
  return '₹' + Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
// Short format for company bars only
function fmtShort(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_00_000) return '₹' + (abs / 1_00_000).toFixed(1) + 'L'
  if (abs >= 1_000)    return '₹' + (abs / 1_000).toFixed(0) + 'K'
  return '₹' + abs.toLocaleString('en-IN')
}

export default function Dashboard({
  transactions, filtered, loading, fiscalYear, isFiltered, filterLabel,
  credits,
  selectedMonth, setSelectedMonth, dateFrom, setDateFrom, dateTo, setDateTo,
  fyMonths, clearFilter,
  openingBalances, onSaveOpeningBalance,
}: Props) {
  const [periodOpen, setPeriodOpen] = useState(false)
  const [obModal, setObModal] = useState<{ account: string; value: string } | null>(null)
  const [obSaving, setObSaving] = useState(false)
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({})

  const toggleCat = (cat: string) =>
    setOpenCats(prev => ({ ...prev, [cat]: !prev[cat] }))

  // Dot colour per category — matches TransactionList mode colours
  const CAT_DOT: Record<string, string> = {
    'Procurement & Purchases': '#dc2626',
    'Services':                '#f97316',
    'Sales & Collections':     '#059669',
    'Office':                  '#7c3aed',
    'Staff':                   '#7c3aed',
    'Travel & Fuel':           '#2563eb',
    'Operations':              '#2563eb',
    'Personal':                '#db2777',
    'Miscellaneous':           '#64748b',
    'Others':                  '#64748b',
  }
  const catDot = (cat: string) => CAT_DOT[cat] ?? '#64748b'

  // ── Stats from FILTERED period ────────────────────────────────────
  const stats = useMemo(() => {
    const totalSales     = filtered.filter(t => t.mode === 'receive').reduce((s, t) => s + t.amount, 0)
    const totalPurchases = filtered.filter(t => t.mode === 'send').reduce((s, t) => s + t.amount, 0)
    const totalExpenses  = filtered.filter(t => t.mode === 'expense' || (!t.mode && t.type === 'expense')).reduce((s, t) => s + t.amount, 0)
    const net = totalSales - totalPurchases - totalExpenses

    // Account balances always from full-year (more accurate)
    const accountBalances: Record<string, number> = {
      ICICI: openingBalances.ICICI ?? 0,
      SBI:   openingBalances.SBI   ?? 0,
      Cash:  openingBalances.Cash  ?? 0,
    }
    transactions.forEach(t => {
      if (accountBalances[t.account] !== undefined) {
        accountBalances[t.account] += t.type === 'income' ? t.amount : -t.amount
      }
    })

    return { totalSales, totalPurchases, totalExpenses, net, accountBalances }
  }, [filtered, transactions, openingBalances])

  // ── Category Summary from FILTERED period ────────────────────────────────
  const categorySummary = useMemo(() => {
    const map: Record<string, { total: number; subs: Record<string, number>; count: number }> = {}
    filtered.forEach(t => {
      const cat = t.category?.trim() || '(Uncategorized)'
      const sub = t.sub_category?.trim() || ''
      if (!map[cat]) map[cat] = { total: 0, subs: {}, count: 0 }
      map[cat].total += t.amount
      map[cat].count += 1
      if (sub) {
        map[cat].subs[sub] = (map[cat].subs[sub] || 0) + t.amount
      }
    })
    return Object.entries(map)
      .sort((a, b) => b[1].total - a[1].total)
  }, [filtered])
  const topCompanies = useMemo(() => {
    const salesMap: Record<string, number> = {}
    const purchaseMap: Record<string, number> = {}

    transactions.forEach(t => {
      const name = t.company_name?.trim() || t.description?.trim() || ''
      if (!name) return
      if (t.mode === 'receive') {
        salesMap[name] = (salesMap[name] || 0) + t.amount
      } else if (t.mode === 'send') {
        purchaseMap[name] = (purchaseMap[name] || 0) + t.amount
      }
    })

    const top5Sales = Object.entries(salesMap)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
    const top5Purchases = Object.entries(purchaseMap)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)

    const salesMax = top5Sales[0]?.[1] || 1
    const purchaseMax = top5Purchases[0]?.[1] || 1

    return { top5Sales, top5Purchases, salesMax, purchaseMax }
  }, [transactions])

  // ── Credits ──────────────────────────────────────────────────────
  const pendingCredits  = credits.filter(c => c.status === 'pending')
  const toReceive       = pendingCredits.filter(c => c.credit_type === 'credit_given').reduce((s, c) => s + c.amount, 0)
  const toPay           = pendingCredits.filter(c => c.credit_type === 'credit_taken').reduce((s, c) => s + c.amount, 0)
  const toReceiveCount  = pendingCredits.filter(c => c.credit_type === 'credit_given').length
  const toPayCount      = pendingCredits.filter(c => c.credit_type === 'credit_taken').length

  if (loading) return <DashboardSkeleton />

  const periodLabel = isFiltered
    ? filterLabel
    : `FY ${fiscalYear}`

  return (
    <div className="flex flex-col gap-0">

      {/* ── Period Filter Bar ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-800 mr-1">Surravi Pharma</span>

          {/* Month dropdown */}
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={e => { if (e.target.value === '') { clearFilter() } else { setSelectedMonth(e.target.value); setDateFrom(''); setDateTo('') } }}
              className="appearance-none pl-3 pr-6 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer">
              <option value="">Full Year</option>
              {fyMonths.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <svg className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7"/></svg>
          </div>

          {/* FY badge */}
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-[#1d4ed8] text-white">{fiscalYear}</span>

          {/* Date range toggle */}
          <button onClick={() => setPeriodOpen(v => !v)}
            className={`ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors
              ${(dateFrom || dateTo) ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'}`}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            {(dateFrom || dateTo) ? `${dateFrom||'…'} → ${dateTo||'…'}` : 'Date range'}
          </button>

          {isFiltered && (
            <button onClick={clearFilter} className="text-[11px] text-red-500 font-semibold hover:underline">Clear</button>
          )}
        </div>

        {periodOpen && (
          <div className="flex gap-2 items-center pt-1 border-t border-slate-100">
            <div className="flex-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">From</label>
              <input type="date" value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setSelectedMonth('') }}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs outline-none focus:border-blue-400"/>
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">To</label>
              <input type="date" value={dateTo}
                onChange={e => { setDateTo(e.target.value); setSelectedMonth('') }}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs outline-none focus:border-blue-400"/>
            </div>
          </div>
        )}
      </div>

      {/* ── Main layout: single column on mobile, two-col on desktop ── */}
      <div className="flex flex-col sm:flex-row gap-3">

        {/* ── LEFT COLUMN ── */}
        <div className="flex-1 flex flex-col gap-3">

          {/* TRANSACTIONS section */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-100">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Transactions</p>
            </div>
            <table className="w-full text-xs">
              <tbody>
                <tr className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-3 py-2 text-slate-600">Send</td>
                  <td className="px-3 py-2 text-right font-bold text-red-500 tabular-nums">{fmt(stats.totalPurchases)}</td>
                  <td className="px-3 py-2 text-right text-[10px] text-slate-400 tabular-nums hidden sm:table-cell">
                    {filtered.filter(t => t.mode === 'send').length} tx
                  </td>
                </tr>
                <tr className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-3 py-2 text-slate-600">Receive</td>
                  <td className="px-3 py-2 text-right font-bold text-emerald-600 tabular-nums">{fmt(stats.totalSales)}</td>
                  <td className="px-3 py-2 text-right text-[10px] text-slate-400 tabular-nums hidden sm:table-cell">
                    {filtered.filter(t => t.mode === 'receive').length} tx
                  </td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="px-3 py-2 text-slate-600">Expenses</td>
                  <td className="px-3 py-2 text-right font-bold text-violet-600 tabular-nums">{fmt(stats.totalExpenses)}</td>
                  <td className="px-3 py-2 text-right text-[10px] text-slate-400 tabular-nums hidden sm:table-cell">
                    {filtered.filter(t => t.mode === 'expense' || (!t.mode && t.type === 'expense')).length} tx
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* BANK BALANCES */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-100">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Bank Balances</p>
            </div>
            <table className="w-full text-xs">
              <tbody>
                {Object.entries(stats.accountBalances).filter(([k]) => k !== 'Cash').map(([key, bal]) => {
                  const ob = openingBalances[key] ?? 0
                  const dots: Record<string, string> = { ICICI: 'bg-sky-500', SBI: 'bg-violet-500' }
                  return (
                    <tr key={key} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 group">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dots[key] || 'bg-slate-400'}`}/>
                          <span className="text-slate-700 font-semibold">{key}</span>
                        </div>
                      </td>
                      <td className={`px-3 py-2 text-right font-bold tabular-nums ${bal >= 0 ? 'text-slate-800' : 'text-red-600'}`}>
                        {bal < 0 ? '−' : ''}{fmt(Math.abs(bal))}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => setObModal({ account: key, value: String(ob) })}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-slate-400 hover:text-blue-600 font-semibold flex items-center gap-1 ml-auto">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536M9 13l6.293-6.293a1 1 0 011.414 0l1.586 1.586a1 1 0 010 1.414L12 16H9v-3z"/></svg>
                          edit
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* CREDITS (if any) */}
          {(toReceive > 0 || toPay > 0) && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-100">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Credit</p>
              </div>
              <table className="w-full text-xs">
                <tbody>
                  {toReceive > 0 && (
                    <tr className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-3 py-2 text-slate-600">
                        To Receive
                        {toReceiveCount > 0 && <span className="ml-1.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full">{toReceiveCount}</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-emerald-600 tabular-nums">{fmt(toReceive)}</td>
                    </tr>
                  )}
                  {toPay > 0 && (
                    <tr className="hover:bg-slate-50/50">
                      <td className="px-3 py-2 text-slate-600">
                        To Pay
                        {toPayCount > 0 && <span className="ml-1.5 bg-red-100 text-red-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full">{toPayCount}</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-red-500 tabular-nums">{fmt(toPay)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TOP SALES PARTIES */}
          {topCompanies.top5Sales.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">↑ Top 5 Sales Parties</p>
                <span className="text-[9px] text-slate-400">Full FY {fiscalYear}</span>
              </div>
              <table className="w-full text-xs">
                <tbody>
                  {topCompanies.top5Sales.map(([name, amt], i) => (
                    <tr key={name} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                      <td className="px-3 py-2 text-slate-400 font-bold w-5">{i + 1}</td>
                      <td className="px-2 py-2 text-slate-700 font-medium truncate max-w-[120px]">{name}</td>
                      <td className="px-2 py-2">
                        <div className="h-1.5 rounded-full bg-emerald-100 overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500" style={{width: `${(amt/topCompanies.salesMax)*100}%`}}/>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-emerald-600 tabular-nums whitespace-nowrap">{fmtShort(amt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>

        {/* ── RIGHT COLUMN (desktop only) ── */}
        <div className="hidden sm:flex flex-col gap-3 w-72 flex-shrink-0">

          {/* EXPENSE SUMMARY */}
          {categorySummary.length > 0 && (() => {
            const maxAmt = Math.max(...categorySummary.map(([, d]) => d.total))
            const grandTotal = categorySummary.reduce((s, [, d]) => s + d.total, 0)
            return (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Expense Summary</p>
                  <span className="text-[9px] text-slate-400">{filterLabel}</span>
                </div>
                <div className="divide-y divide-slate-50">
                  {categorySummary.map(([cat, data]) => {
                    const dot = catDot(cat)
                    const barPct = maxAmt > 0 ? (data.total / maxAmt) * 100 : 0
                    const isOpen = !!openCats[cat]
                    const subEntries = Object.entries(data.subs).sort((a, b) => b[1] - a[1])

                    return (
                      <div key={cat}>
                        <button onClick={() => subEntries.length > 0 && toggleCat(cat)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50/70 transition-colors">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{background: dot}}/>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs text-slate-700 truncate">{cat}</span>
                              <span className="text-xs font-bold text-slate-700 tabular-nums flex-shrink-0">{fmtShort(data.total)}</span>
                            </div>
                            <div className="mt-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{width: `${barPct}%`, background: dot}}/>
                            </div>
                          </div>
                          {subEntries.length > 0 && (
                            <svg className={`w-3 h-3 text-slate-300 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7"/></svg>
                          )}
                        </button>
                        {isOpen && subEntries.map(([sub, amt]) => (
                          <div key={sub} className="flex items-center gap-2 px-8 py-1.5 hover:bg-slate-50">
                            <span className="text-[10px] text-slate-500 flex-1 truncate">{sub}</span>
                            <span className="text-[10px] font-semibold text-slate-600 tabular-nums">{fmtShort(amt)}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
                <div className="px-3 py-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total</span>
                  <span className="text-xs font-extrabold text-slate-800 tabular-nums">{fmt(grandTotal)}</span>
                </div>
              </div>
            )
          })()}

          {/* TOP PURCHASE PARTIES */}
          {topCompanies.top5Purchases.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">↓ Top 5 Purchase Parties</p>
                <span className="text-[9px] text-slate-400">Full FY {fiscalYear}</span>
              </div>
              <table className="w-full text-xs">
                <tbody>
                  {topCompanies.top5Purchases.map(([name, amt], i) => (
                    <tr key={name} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                      <td className="px-3 py-2 text-slate-400 font-bold w-5">{i + 1}</td>
                      <td className="px-2 py-2 text-slate-700 font-medium truncate max-w-[100px]">{name}</td>
                      <td className="px-2 py-2">
                        <div className="h-1.5 rounded-full bg-red-100 overflow-hidden">
                          <div className="h-full rounded-full bg-red-500" style={{width: `${(amt/topCompanies.purchaseMax)*100}%`}}/>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-red-500 tabular-nums whitespace-nowrap">{fmtShort(amt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>

      {/* Mobile-only: expense summary + top purchase (below main column) */}
      <div className="sm:hidden flex flex-col gap-3 mt-3">
        {categorySummary.length > 0 && (() => {
          const maxAmt = Math.max(...categorySummary.map(([, d]) => d.total))
          const grandTotal = categorySummary.reduce((s, [, d]) => s + d.total, 0)
          return (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Expense Summary</p>
                <span className="text-[9px] text-slate-400">{filterLabel}</span>
              </div>
              <div className="divide-y divide-slate-50">
                {categorySummary.map(([cat, data]) => {
                  const dot = catDot(cat)
                  const barPct = maxAmt > 0 ? (data.total / maxAmt) * 100 : 0
                  return (
                    <div key={cat} className="flex items-center gap-2.5 px-3 py-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{background: dot}}/>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-slate-700 truncate">{cat}</span>
                          <span className="text-xs font-bold text-slate-700 tabular-nums flex-shrink-0">{fmtShort(data.total)}</span>
                        </div>
                        <div className="mt-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full" style={{width: `${barPct}%`, background: dot}}/>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="px-3 py-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Total</span>
                <span className="text-xs font-extrabold text-slate-800 tabular-nums">{fmt(grandTotal)}</span>
              </div>
            </div>
          )
        })()}

        {topCompanies.top5Purchases.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">↓ Top 5 Purchase Parties</p>
              <span className="text-[9px] text-slate-400">Full FY {fiscalYear}</span>
            </div>
            <table className="w-full text-xs">
              <tbody>
                {topCompanies.top5Purchases.map(([name, amt], i) => (
                  <tr key={name} className="border-b border-slate-50 last:border-0">
                    <td className="px-3 py-2 text-slate-400 font-bold w-5">{i + 1}</td>
                    <td className="px-2 py-2 text-slate-700 font-medium truncate max-w-[120px]">{name}</td>
                    <td className="px-2 py-2">
                      <div className="h-1.5 rounded-full bg-red-100 overflow-hidden">
                        <div className="h-full rounded-full bg-red-500" style={{width: `${(amt/topCompanies.purchaseMax)*100}%`}}/>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-red-500 tabular-nums whitespace-nowrap">{fmtShort(amt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* OB Modal */}
      {obModal && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setObModal(null)}/>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs pointer-events-auto p-5">
              <p className="font-bold text-sm text-slate-800 mb-1">Opening Balance — {obModal.account}</p>
              <p className="text-[11px] text-slate-400 mb-3">Set the opening balance for this account at the start of FY {fiscalYear}</p>
              <input type="number" value={obModal.value}
                onChange={e => setObModal(m => m ? {...m, value: e.target.value} : m)}
                placeholder="0.00" inputMode="numeric"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300 mb-3"/>
              <div className="flex gap-2">
                <button onClick={() => setObModal(null)}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
                  Cancel
                </button>
                <button
                  disabled={obSaving}
                  onClick={async () => {
                    setObSaving(true)
                    await onSaveOpeningBalance(obModal.account, parseFloat(obModal.value) || 0)
                    setObSaving(false); setObModal(null)
                  }}
                  className="flex-1 py-2 rounded-xl text-sm font-bold bg-[#1d4ed8] text-white hover:bg-blue-700 transition-colors disabled:opacity-50">
                  {obSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="bg-white rounded-xl border border-slate-200 p-4 h-28"/>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1,2,3,4].map(i => <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 h-20"/>)}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[1,2,3].map(i => <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 h-16"/>)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[1,2].map(i => <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 h-48"/>)}
      </div>
    </div>
  )
}
