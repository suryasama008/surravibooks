'use client'

import React, { useState, useMemo } from 'react'
import { BizTransaction, BizTransactionType } from '@/types'

interface Props {
  transactions: BizTransaction[]
  loading: boolean
  onDelete: (id: string) => void
  onSettle: (id: string) => void
  onEdit: (tx: BizTransaction) => void
}

function fmtFull(n: number) {
  return '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })
}
function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

const BIZ_STYLE: Record<BizTransactionType, { label: string; color: string; bg: string; textColor: string }> = {
  send:       { label: 'Sent',       color: 'bg-red-100',    bg: 'bg-red-50',    textColor: 'text-red-700' },
  receive:    { label: 'Received',   color: 'bg-emerald-100',bg: 'bg-emerald-50',textColor: 'text-emerald-700' },
  to_receive: { label: 'To Receive', color: 'bg-amber-100',  bg: 'bg-amber-50',  textColor: 'text-amber-700' },
  to_pay:     { label: 'To Pay',     color: 'bg-violet-100', bg: 'bg-violet-50', textColor: 'text-violet-700' },
}

export default function BizTransactionList({ transactions, loading, onDelete, onSettle, onEdit }: Props) {
  const [filterType, setFilterType] = useState<'all' | BizTransactionType>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'settled'>('all')
  const [search, setSearch] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return transactions.filter(t =>
      (filterType === 'all' || t.biz_type === filterType) &&
      (filterStatus === 'all' || t.status === filterStatus) &&
      (!q || t.company_name.toLowerCase().includes(q) || (t.gst_number || '').toLowerCase().includes(q))
    )
  }, [transactions, filterType, filterStatus, search])

  // Totals
  const totals = useMemo(() => {
    const toReceive = transactions.filter(t => t.biz_type === 'to_receive' && t.status === 'pending').reduce((s, t) => s + t.amount, 0)
    const toPay     = transactions.filter(t => t.biz_type === 'to_pay'     && t.status === 'pending').reduce((s, t) => s + t.amount, 0)
    return { toReceive, toPay }
  }, [transactions])

  if (loading) return <div className="animate-pulse px-3 sm:px-0"><div className="bg-white rounded-2xl border p-4 h-32" /></div>

  return (
    <div className="px-3 sm:px-0 flex flex-col gap-3">

      {/* Pending summary */}
      {(totals.toReceive > 0 || totals.toPay > 0) && (
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3">
            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">To Receive</p>
            <p className="text-base font-extrabold text-amber-700">{fmtFull(totals.toReceive)}</p>
          </div>
          <div className="bg-violet-50 border border-violet-100 rounded-2xl p-3">
            <p className="text-[10px] font-bold text-violet-600 uppercase tracking-wider mb-1">To Pay</p>
            <p className="text-base font-extrabold text-violet-700">{fmtFull(totals.toPay)}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
        <div className="relative mb-2">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
          </svg>
          <input type="text" placeholder="Search company, GST…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm outline-none focus:border-blue-400" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(['all', 'send', 'receive', 'to_receive', 'to_pay'] as const).map(t => {
            const style = t === 'all' ? null : BIZ_STYLE[t]
            return (
              <button key={t} onClick={() => setFilterType(t)}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors
                  ${filterType === t ? (style ? style.color + ' ' + style.textColor : 'bg-blue-700 text-white') : 'bg-slate-100 text-slate-600'}`}>
                {t === 'all' ? 'All' : t === 'to_receive' ? 'To Receive' : t === 'to_pay' ? 'To Pay' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            )
          })}
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
            className="px-2 py-1 rounded-xl border border-slate-200 bg-slate-50 text-xs outline-none">
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="settled">Settled</option>
          </select>
        </div>
      </div>

      {/* Count */}
      <div className="text-xs text-slate-400 font-semibold px-1">{filtered.length} entries</div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 text-center py-14">
          <div className="text-4xl mb-3">🏢</div>
          <p className="font-bold text-slate-700">No business entries</p>
          <p className="text-sm text-slate-400 mt-1">Use the + button to add business transactions</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {filtered.map((t, i) => {
            const style = BIZ_STYLE[t.biz_type]
            return (
              <div key={t.id}>
                <div className="flex items-center px-4 py-3 gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${style.color}`}>
                    <span className={`text-sm font-bold ${style.textColor}`}>
                      {t.biz_type === 'send' ? '↑' : t.biz_type === 'receive' ? '↓' : '⏳'}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onEdit(t)}>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-slate-800 truncate">{t.company_name}</p>
                      {t.status === 'settled' && (
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-semibold">Settled</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[11px] px-1.5 py-0.5 rounded font-semibold ${style.color} ${style.textColor}`}>{style.label}</span>
                      {t.gst_number && <span className="text-[11px] text-slate-400 font-mono">{t.gst_number}</span>}
                      <span className="text-[11px] text-slate-400">{fmtDate(t.date)}</span>
                    </div>
                    {t.notes && <p className="text-[11px] text-slate-400 italic mt-0.5">{t.notes}</p>}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className={`text-sm font-extrabold ${style.textColor}`}>{fmtFull(t.amount)}</span>
                    {(t.biz_type === 'to_receive' || t.biz_type === 'to_pay') && t.status === 'pending' && (
                      <button onClick={() => onSettle(t.id)}
                        className="ml-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-bold hover:bg-emerald-100 transition-colors">
                        Settle
                      </button>
                    )}
                    {confirmId === t.id ? (
                      <button onClick={() => { onDelete(t.id); setConfirmId(null) }}
                        className="ml-1 px-2 py-0.5 rounded-lg bg-red-600 text-white text-[11px] font-bold">
                        Delete?
                      </button>
                    ) : (
                      <button onClick={() => setConfirmId(t.id)}
                        className="w-7 h-7 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                {i < filtered.length - 1 && <hr className="mx-4 border-slate-100" />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
