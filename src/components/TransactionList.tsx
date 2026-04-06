'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Transaction } from '@/types'
import { ACCOUNTS } from '@/lib/constants'

function fmt(n: number) {
  return '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })
}
function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
function fmtDateLong(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const MODE_STYLE = {
  send:    { label: 'Purchase', badgeCls: 'bg-red-50 text-red-700',     amtCls: 'text-red-600',     sign: '−' },
  receive: { label: 'Sale',     badgeCls: 'bg-emerald-50 text-emerald-700', amtCls: 'text-emerald-600', sign: '+' },
  expense: { label: 'Expense',  badgeCls: 'bg-violet-50 text-violet-700',   amtCls: 'text-violet-600',  sign: '−' },
} as const

function getMode(t: Transaction): keyof typeof MODE_STYLE {
  const m = t.mode || (t.type === 'income' ? 'receive' : 'expense')
  return (m as keyof typeof MODE_STYLE) in MODE_STYLE ? (m as keyof typeof MODE_STYLE) : 'expense'
}

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

// ── Transaction Detail Modal ──────────────────────────────────────────────────

function TransactionDetailModal({ tx, onClose, onEdit, onDelete }: {
  tx: Transaction; onClose: () => void; onEdit: () => void; onDelete: () => void
}) {
  const mode = getMode(tx)
  const style = MODE_STYLE[mode]

  const KV = ({ label, value, mono, color }: { label: string; value: string; mono?: boolean; color?: string }) => (
    <div className="py-2.5 px-5 border-b border-slate-100 last:border-0">
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
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${style.badgeCls}`}>{style.label}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{tx.account}</span>
                </div>
                <p className="text-[11px] text-slate-400 mb-0.5">{fmtDateLong(tx.date)}</p>
                <p className="text-base font-bold text-slate-900 leading-tight truncate">
                  {tx.company_name || tx.description || tx.category || style.label}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-2xl font-extrabold ${style.amtCls}`}>{style.sign}{fmt(tx.amount)}</p>
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
            <KV label="Date" value={fmtDateLong(tx.date)} />
            <KV label="Type" value={style.label} color={style.amtCls} />
            <KV label="Amount" value={fmt(tx.amount)} color={style.amtCls} />
            <KV label="Account" value={tx.account} />
            {tx.company_name && <KV label="Party / Company" value={tx.company_name} />}
            {tx.category && <KV label="Category" value={tx.category} />}
            {tx.sub_category && <KV label="Sub-category" value={tx.sub_category} />}
            {tx.description && <KV label="Description" value={tx.description} />}
            {tx.payment_mode && <KV label="Payment Mode" value={tx.payment_mode} />}
            {tx.notes && <KV label="Notes" value={tx.notes} />}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-slate-100 flex gap-2">
            <button onClick={onDelete}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors border border-red-100">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
            <button onClick={onEdit}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#1d4ed8] text-white hover:bg-[#1e40af] transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
              </svg>
              Edit Transaction
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  transactions: Transaction[]
  allCount: number
  loading: boolean
  onDelete: (id: string) => void
  onEdit: (tx: Transaction) => void
  onView?: (tx: Transaction) => void
  isFiltered: boolean
  selectedMonth: string
  setSelectedMonth: (v: string) => void
  dateFrom: string
  setDateFrom: (v: string) => void
  dateTo: string
  setDateTo: (v: string) => void
  fyMonths: { label: string; value: string }[]
  clearFilter: () => void
}

export default function TransactionList({
  transactions, allCount, loading, onDelete, onEdit, isFiltered,
  selectedMonth, setSelectedMonth, dateFrom, setDateFrom, dateTo, setDateTo, fyMonths, clearFilter,
}: Props) {
  const [search, setSearch]           = useState('')
  const [filterMode, setFilterMode]   = useState<'all' | 'send' | 'receive' | 'expense'>('all')
  const [filterAccount, setFilterAccount] = useState('all')
  const [periodOpen, setPeriodOpen]   = useState(false)
  const [viewTx, setViewTx]           = useState<Transaction | null>(null)
  const [passwordAction, setPasswordAction] = useState<null | { label: string; onConfirm: () => void }>(null)

  const filteredTx = useMemo(() => {
    const q = search.toLowerCase()
    return transactions.filter(t => {
      const mode = getMode(t)
      return (
        (!q || (t.description ?? '').toLowerCase().includes(q) || (t.category ?? '').toLowerCase().includes(q) ||
          (t.company_name ?? '').toLowerCase().includes(q) || (t.notes ?? '').toLowerCase().includes(q) ||
          t.account.toLowerCase().includes(q) || t.amount.toString().includes(q)) &&
        (filterMode === 'all' || mode === filterMode) &&
        (filterAccount === 'all' || t.account === filterAccount)
      )
    })
  }, [transactions, search, filterMode, filterAccount])

  const filterLabel = selectedMonth || (dateFrom && dateTo ? `${dateFrom} → ${dateTo}` : dateFrom || dateTo || '')

  const requestPassword = (label: string, onConfirm: () => void) => setPasswordAction({ label, onConfirm })

  if (loading) return <ListSkeleton />

  return (
    <div className="px-3 sm:px-0">

      {/* Search + Filter row */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 mb-3">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
          </svg>
          <input type="text" placeholder="Search party, description, amount…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm outline-none focus:border-blue-400" />
        </div>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <div className="flex gap-1.5">
          {([
            { id: 'all',     label: 'All'       },
            { id: 'receive', label: 'Sales'     },
            { id: 'send',    label: 'Purchases' },
            { id: 'expense', label: 'Expenses'  },
          ] as const).map(m => (
            <button key={m.id} onClick={() => setFilterMode(m.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors
                ${filterMode === m.id
                  ? m.id === 'receive' ? 'bg-emerald-600 text-white border-emerald-600'
                    : m.id === 'send'    ? 'bg-red-600 text-white border-red-600'
                    : m.id === 'expense' ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-[#1d4ed8] text-white border-[#1d4ed8]'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
              {m.label}
            </button>
          ))}
        </div>

        <select value={filterAccount} onChange={e => setFilterAccount(e.target.value)}
          className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-600 outline-none font-semibold">
          <option value="all">All Accounts</option>
          {ACCOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        <div className="relative ml-auto">
          <button onClick={() => setPeriodOpen(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors
              ${isFiltered ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {isFiltered ? filterLabel : 'Period'}
          </button>
          {periodOpen && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 p-4 min-w-[280px]">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Filter Period</p>
              <select value={selectedMonth} onChange={e => { setSelectedMonth(e.target.value); setDateFrom(''); setDateTo('') }}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-blue-400 mb-3">
                <option value="">All months</option>
                {fyMonths.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <p className="text-[10px] text-slate-400 font-medium mb-2 text-center">— or date range —</p>
              <div className="flex gap-2 mb-3">
                <div className="flex-1">
                  <label className="text-[10px] text-slate-400 font-semibold uppercase block mb-1">From</label>
                  <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setSelectedMonth('') }}
                    className="w-full px-2 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs outline-none" />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-slate-400 font-semibold uppercase block mb-1">To</label>
                  <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setSelectedMonth('') }}
                    className="w-full px-2 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs outline-none" />
                </div>
              </div>
              {isFiltered && (
                <button onClick={() => { clearFilter(); setPeriodOpen(false) }}
                  className="w-full py-2 rounded-xl bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100">
                  Clear Filter ✕
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Count */}
      <div className="text-xs text-slate-400 font-semibold px-1 mb-2">
        {filteredTx.length} entr{filteredTx.length !== 1 ? 'ies' : 'y'}
        {filterMode !== 'all' || filterAccount !== 'all' || !!search || isFiltered ? ' (filtered)' : ''}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block">
        {filteredTx.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 text-center py-14 px-6">
            <p className="font-bold text-slate-700 mb-1">{allCount === 0 ? 'No entries yet' : 'No results found'}</p>
            <p className="text-sm text-slate-400">{allCount === 0 ? 'Tap Purchases or Sales below to add your first entry.' : 'Try adjusting the filters.'}</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
            <table className="w-full text-xs" style={{tableLayout:'fixed'}}>
              <colgroup>
                <col style={{width:'6%'}} /><col style={{width:'18%'}} /><col style={{width:'12%'}} />
                <col style={{width:'10%'}} /><col style={{width:'7%'}} /><col style={{width:'6%'}} />
                <col style={{width:'7%'}} /><col style={{width:'11%'}} /><col style={{width:'11%'}} /><col style={{width:'12%'}} />
              </colgroup>
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide text-left">Date</th>
                  <th className="py-2.5 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide text-left">Party</th>
                  <th className="py-2.5 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide text-left">Category</th>
                  <th className="py-2.5 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide text-right">Amount</th>
                  <th className="py-2.5 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide text-left">Type</th>
                  <th className="py-2.5 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide text-left">Acct.</th>
                  <th className="py-2.5 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide text-left">Mode</th>
                  <th className="py-2.5 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide text-left">Sub-cat</th>
                  <th className="py-2.5 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide text-left">Notes</th>
                  <th className="py-2.5 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredTx.map((t, idx) => {
                  const mode = getMode(t)
                  const style = MODE_STYLE[mode]
                  const party = t.company_name || t.description || t.category || style.label
                  const shortDate = (() => {
                    const d = new Date(t.date + 'T00:00:00')
                    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`
                  })()
                  const shortLabel = mode === 'send' ? 'Purch.' : mode === 'receive' ? 'Sale' : 'Exp.'
                  return (
                    <tr key={t.id} className={`border-b border-slate-100 last:border-0 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'} hover:bg-blue-50/20`}>
                      <td className="py-2 px-2 text-slate-500 whitespace-nowrap font-mono text-[11px]">{shortDate}</td>
                      <td className="py-2 px-2">
                        <p className="font-medium text-slate-800 truncate text-xs">{party}</p>
                        {t.company_name && t.description && <p className="text-[10px] text-slate-400 truncate">{t.description}</p>}
                      </td>
                      <td className="py-2 px-2 text-slate-500 truncate text-[11px]">{t.category || '—'}</td>
                      <td className={`py-2 px-2 font-semibold text-right text-xs ${style.amtCls}`}>{style.sign}{fmt(t.amount)}</td>
                      <td className="py-2 px-2">
                        <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${style.badgeCls}`}>{shortLabel}</span>
                      </td>
                      <td className="py-2 px-2 text-slate-500 text-[11px]">{t.account}</td>
                      <td className="py-2 px-2 text-slate-400 text-[10px] truncate">{t.payment_mode || '—'}</td>
                      <td className="py-2 px-2 text-[10px] text-slate-500 truncate">{t.sub_category || '—'}</td>
                      <td className="py-2 px-2 text-[10px] text-slate-400 truncate italic">{t.notes || '—'}</td>
                      <td className="py-2 px-2 text-center">
                        <button onClick={() => setViewTx(t)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-semibold transition-colors border border-blue-100">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden flex flex-col gap-2">
        {filteredTx.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 text-center py-14 px-6">
            <p className="font-bold text-slate-700 mb-1">{allCount === 0 ? 'No entries yet' : 'No results found'}</p>
            <p className="text-sm text-slate-400">{allCount === 0 ? 'Tap Purchases or Sales below to add your first entry.' : 'Try adjusting the filters.'}</p>
          </div>
        ) : filteredTx.map(t => {
          const mode = getMode(t)
          const style = MODE_STYLE[mode]
          const party = t.company_name || t.description || t.category || style.label
          return (
            <div key={t.id} className="bg-white rounded-2xl px-4 py-3 border border-slate-200">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1 min-w-0 pr-3">
                  <p className="font-medium text-sm text-slate-800 truncate">{party}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{fmtDate(t.date)} · {t.account}</p>
                </div>
                <p className={`text-sm font-semibold flex-shrink-0 ${style.amtCls}`}>{style.sign}{fmt(t.amount)}</p>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-1.5 flex-wrap">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${style.badgeCls}`}>{style.label}</span>
                  {t.category && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{t.category}</span>}
                </div>
                <button onClick={() => setViewTx(t)}
                  className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-[11px] font-semibold hover:bg-blue-100 transition-colors border border-blue-100">
                  View
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modals */}
      {viewTx && (
        <TransactionDetailModal
          tx={viewTx}
          onClose={() => setViewTx(null)}
          onEdit={() => requestPassword('Edit Transaction', () => { onEdit(viewTx); setViewTx(null) })}
          onDelete={() => requestPassword('Delete Transaction', () => { onDelete(viewTx.id); setViewTx(null) })}
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

function ListSkeleton() {
  return (
    <div className="px-3 sm:px-0 animate-pulse">
      <div className="bg-white rounded-2xl border border-slate-200 p-3 mb-3 h-14" />
      <div className="flex gap-2 mb-3">{[1,2,3,4].map(i => <div key={i} className="h-8 w-20 bg-white rounded-xl border border-slate-200" />)}</div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {[1,2,3,4,5].map(i => <div key={i} className="h-12 border-b border-slate-100 bg-slate-50/50" />)}
      </div>
    </div>
  )
}
