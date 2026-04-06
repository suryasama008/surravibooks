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

function fmt(n: number) {
  return '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })
}
function fmtShort(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 10_00_000)  return '₹' + (abs / 10_00_000).toFixed(1) + 'L'
  if (abs >= 1_00_000)   return '₹' + (abs / 1_00_000).toFixed(1) + 'L'
  if (abs >= 1_000)      return '₹' + (abs / 1_000).toFixed(0) + 'K'
  return '₹' + abs.toString()
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
    <div className="flex flex-col gap-4">

      {/* ── Period Filter Bar ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-bold text-slate-800">Surravi Pharma</h1>
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg ${isFiltered ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-500'}`}>
            {periodLabel}
          </span>
        </div>

        {/* Month dropdown + date range row */}
        <div className="flex gap-2 items-center flex-wrap">
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={e => { if (e.target.value === '') { clearFilter() } else { setSelectedMonth(e.target.value); setDateFrom(''); setDateTo('') } }}
              className="appearance-none pl-3 pr-7 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer">
              <option value="">Full Year</option>
              {fyMonths.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          {/* Date range picker toggle */}
          <button
            onClick={() => setPeriodOpen(v => !v)}
            className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors
              ${(dateFrom || dateTo) ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'}`}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            {(dateFrom || dateTo) ? `${dateFrom || '…'} → ${dateTo || '…'}` : 'Date range'}
          </button>
        </div>

        {/* Date range inputs */}
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
            {isFiltered && (
              <button onClick={() => { clearFilter(); setPeriodOpen(false) }}
                className="mt-4 px-3 py-2 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 border border-red-100">
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Stat Cards Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Sales</p>
          <p className="text-lg font-extrabold text-emerald-600">{fmtShort(stats.totalSales)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{filtered.filter(t => t.mode === 'receive').length} transactions</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Purchases</p>
          <p className="text-lg font-extrabold text-red-600">{fmtShort(stats.totalPurchases)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{filtered.filter(t => t.mode === 'send').length} transactions</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Expenses</p>
          <p className="text-lg font-extrabold text-violet-600">{fmtShort(stats.totalExpenses)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{filtered.filter(t => t.mode === 'expense' || (!t.mode && t.type === 'expense')).length} transactions</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Net Flow</p>
          <p className={`text-lg font-extrabold ${stats.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{stats.net >= 0 ? '+' : '−'}{fmtShort(Math.abs(stats.net))}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{periodLabel}</p>
        </div>
      </div>



      {/* ── Bank Balances (ICICI & SBI only) ── */}
      <div className="grid grid-cols-2 gap-3">
        {Object.entries(stats.accountBalances).filter(([key]) => key !== 'Cash').map(([key, bal]) => {
          const ob = openingBalances[key] ?? 0
          const colors: Record<string, { dot: string; bg: string }> = {
            ICICI: { dot: 'bg-sky-500',    bg: 'bg-sky-50 border-sky-100' },
            SBI:   { dot: 'bg-violet-500', bg: 'bg-violet-50 border-violet-100' },
          }
          const c = colors[key] || { dot: 'bg-slate-400', bg: 'bg-slate-50 border-slate-200' }
          return (
            <div key={key} className={`rounded-xl border p-3 relative group ${c.bg}`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${c.dot}`}/>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{key} Bank</span>
                </div>
                <button onClick={() => setObModal({ account: key, value: String(ob) })}
                  className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded flex items-center justify-center bg-white border border-slate-200 shadow-sm">
                  <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536M9 13l6.293-6.293a1 1 0 011.414 0l1.586 1.586a1 1 0 010 1.414L12 16H9v-3z"/>
                  </svg>
                </button>
              </div>
              <p className={`text-xl font-extrabold ${bal >= 0 ? 'text-slate-800' : 'text-red-600'}`}>
                {bal < 0 ? '−' : ''}{fmt(Math.abs(bal))}
              </p>
              {ob !== 0 && <p className="text-[9px] text-slate-400 mt-0.5">Opening: {fmt(ob)}</p>}
            </div>
          )
        })}
      </div>

      {/* ── Credit Summary ── */}
      {(toReceive > 0 || toPay > 0) && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 p-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              To Receive
              {toReceiveCount > 0 && <span className="ml-1.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full">{toReceiveCount}</span>}
            </p>
            <p className="text-base font-extrabold text-emerald-600">{fmt(toReceive)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              To Pay
              {toPayCount > 0 && <span className="ml-1.5 bg-red-100 text-red-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full">{toPayCount}</span>}
            </p>
            <p className="text-base font-extrabold text-red-600">{fmt(toPay)}</p>
          </div>
        </div>
      )}

      {/* ── Category Summary ── */}
      {categorySummary.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-bold text-slate-800">Category Summary</p>
            <p className="text-[10px] text-slate-400">{periodLabel}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            {categorySummary.map(([cat, data]) => (
              <div key={cat}>
                <div className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-semibold text-slate-700 truncate">{cat}</span>
                    <span className="text-[10px] text-slate-400 flex-shrink-0">{data.count} tx</span>
                  </div>
                  <span className="text-xs font-bold text-slate-800 flex-shrink-0 ml-2">{fmtShort(data.total)}</span>
                </div>
                {Object.entries(data.subs).sort((a, b) => b[1] - a[1]).map(([sub, amt]) => (
                  <div key={sub} className="flex items-center justify-between pl-4 py-0.5">
                    <span className="text-[11px] text-slate-400 truncate">↳ {sub}</span>
                    <span className="text-[11px] text-slate-500 flex-shrink-0 ml-2">{fmtShort(amt)}</span>
                  </div>
                ))}
                <div className="h-px bg-slate-100 mt-1" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Top 5 Companies ── (always from full FY) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Top Sales */}
        {topCompanies.top5Sales.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[11px] font-bold text-slate-800">Top Sales Parties</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Full FY {fiscalYear}</p>
              </div>
              <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                </svg>
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              {topCompanies.top5Sales.map(([name, amt], i) => (
                <div key={name} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 w-4">{i + 1}</span>
                      <span className="text-xs font-semibold text-slate-700 truncate max-w-[140px]">{name}</span>
                    </div>
                    <span className="text-xs font-bold text-emerald-600">{fmtShort(amt)}</span>
                  </div>
                  <div className="ml-6 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{width: `${(amt / topCompanies.salesMax) * 100}%`}}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Purchases */}
        {topCompanies.top5Purchases.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[11px] font-bold text-slate-800">Top Purchase Parties</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Full FY {fiscalYear}</p>
              </div>
              <div className="w-6 h-6 rounded-lg bg-red-100 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"/>
                </svg>
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              {topCompanies.top5Purchases.map(([name, amt], i) => (
                <div key={name} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 w-4">{i + 1}</span>
                      <span className="text-xs font-semibold text-slate-700 truncate max-w-[140px]">{name}</span>
                    </div>
                    <span className="text-xs font-bold text-red-600">{fmtShort(amt)}</span>
                  </div>
                  <div className="ml-6 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 rounded-full transition-all"
                      style={{width: `${(amt / topCompanies.purchaseMax) * 100}%`}}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Empty state ── */}
      {transactions.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 text-center py-16 px-6">
          <div className="text-5xl mb-4">📒</div>
          <p className="font-bold text-lg text-slate-700 mb-1">No entries for FY {fiscalYear}</p>
          <p className="text-sm text-slate-400">Use the + button to start recording.</p>
        </div>
      )}

      {/* ── Opening Balance Modal ── */}
      {obModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4"
          onClick={e => { if (e.target === e.currentTarget) setObModal(null) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">Opening Balance</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{obModal.account} account</p>
              </div>
              <button onClick={() => setObModal(null)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 text-xs font-bold">✕</button>
            </div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Amount (₹)</label>
            <input type="number" value={obModal.value}
              onChange={e => setObModal(m => m ? { ...m, value: e.target.value } : null)}
              placeholder="0" autoFocus
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400"/>
            <p className="text-[10px] text-slate-400 mt-1.5">Starting balance before any recorded transactions.</p>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setObModal(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200">Cancel</button>
              <button disabled={obSaving}
                onClick={async () => {
                  const val = parseFloat(obModal.value)
                  if (isNaN(val)) return
                  setObSaving(true)
                  await onSaveOpeningBalance(obModal.account, val)
                  setObSaving(false); setObModal(null)
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#1d4ed8] text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-50">
                {obSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
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
