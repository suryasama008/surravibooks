'use client'

import React, { useState, useMemo } from 'react'
import { Contact, Transaction, InvoiceEntry, InvoiceLine, ContactNote } from '@/types'

interface Props {
  contact: Contact
  transactions: Transaction[]
  invoices: InvoiceEntry[]
  invoiceLines: InvoiceLine[]
  notes: ContactNote[]
  onClose: () => void
  onAddNote: (contactId: string, text: string) => Promise<void>
  onDeleteNote: (noteId: string) => Promise<void>
  onEditContact: (c: Contact) => void
}

function fmt(n: number) {
  return '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })
}
function fmtDate(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

type TabType = 'transactions' | 'notes'

export default function CompanyDetail({
  contact, transactions, invoices, invoiceLines, notes,
  onClose, onAddNote, onDeleteNote, onEditContact,
}: Props) {
  const [tab, setTab] = useState<TabType>('transactions')
  const [txFilter, setTxFilter] = useState<'all' | 'sale' | 'purchase'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [newNote, setNewNote] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [confirmNoteId, setConfirmNoteId] = useState<string | null>(null)

  // ── Derived data ─────────────────────────────────────────────────
  const contactTxns = useMemo(() =>
    transactions
      .filter(t => t.contact_id === contact.id || t.company_name === contact.company_name)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [transactions, contact]
  )

  const contactInvoices = useMemo(() =>
    invoices
      .filter(i => i.contact_id === contact.id || i.company_name === contact.company_name)
      .sort((a, b) => b.invoice_date.localeCompare(a.invoice_date)),
    [invoices, contact]
  )

  const hasDateFilter = !!(dateFrom || dateTo)

  // Date-filtered invoices
  const filteredInvoices = useMemo(() => {
    let inv = contactInvoices
    if (dateFrom) inv = inv.filter(i => i.invoice_date >= dateFrom)
    if (dateTo)   inv = inv.filter(i => i.invoice_date <= dateTo)
    return inv
  }, [contactInvoices, dateFrom, dateTo])

  const saleInvoices  = filteredInvoices.filter(i => i.entry_type === 'sale')
  const purInvoices   = filteredInvoices.filter(i => i.entry_type === 'purchase')
  const totalSale     = saleInvoices.reduce((s, i) => s + i.amount, 0)
  const totalPurchase = purInvoices.reduce((s, i) => s + i.amount, 0)
  const unpaidSale    = saleInvoices.filter(i => i.status !== 'paid').reduce((s, i) => s + (i.amount - (i.amount_paid ?? 0)), 0)
  const unpaidPurch   = purInvoices.filter(i => i.status !== 'paid').reduce((s, i) => s + (i.amount - (i.amount_paid ?? 0)), 0)
  const advance       = contact.advance_balance ?? 0

  // Material summary – per-material
  const materialSummary = useMemo(() => {
    const map: Record<string, {
      name: string; hsn: string | null
      saleAmt: number; purAmt: number
      saleQty: number; purQty: number; purUnit: string | null; latestRate: number | null; latestDate: string
    }> = {}
    filteredInvoices.forEach(inv => {
      invoiceLines.filter(l => l.invoice_id === inv.id).forEach(line => {
        if (!map[line.material_name]) map[line.material_name] = {
          name: line.material_name, hsn: line.hsn_code,
          saleAmt: 0, purAmt: 0, saleQty: 0, purQty: 0, purUnit: null, latestRate: null, latestDate: ''
        }
        const m = map[line.material_name]
        const amt = (line.quantity ?? 0) * (line.rate ?? 0)
        if (inv.entry_type === 'sale') {
          m.saleAmt += amt
          m.saleQty += (line.quantity ?? 0)
        } else {
          m.purAmt += amt
          m.purQty += (line.quantity ?? 0)
          if (!m.purUnit && line.unit) m.purUnit = line.unit
          if (inv.invoice_date > m.latestDate && line.rate != null) {
            m.latestRate = line.rate
            m.latestDate = inv.invoice_date
          }
        }
      })
    })
    return Object.values(map).sort((a, b) => (b.saleAmt + b.purAmt) - (a.saleAmt + a.purAmt))
  }, [filteredInvoices, invoiceLines])

  // Transactions filtered
  const filteredTxns = useMemo(() => {
    let txns = contactTxns
    if (txFilter === 'sale')     txns = txns.filter(t => t.type === 'income')
    if (txFilter === 'purchase') txns = txns.filter(t => t.type === 'expense' && t.mode === 'send')
    if (dateFrom) txns = txns.filter(t => t.date >= dateFrom)
    if (dateTo)   txns = txns.filter(t => t.date <= dateTo)
    return txns
  }, [contactTxns, txFilter, dateFrom, dateTo])

  const filteredIncome  = filteredTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const filteredExpense = filteredTxns.filter(t => t.type === 'expense' && t.mode === 'send').reduce((s, t) => s + t.amount, 0)

  const contactNotes = useMemo(() =>
    notes
      .filter(n => n.contact_id === contact.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [notes, contact]
  )

  const handleAddNote = async () => {
    if (!newNote.trim()) return
    setSavingNote(true)
    await onAddNote(contact.id, newNote.trim())
    setNewNote('')
    setAddingNote(false)
    setSavingNote(false)
  }

  const hasSaleCol = materialSummary.some(m => m.saleAmt > 0)
  const hasPurCol  = materialSummary.some(m => m.purAmt  > 0)
  const hasSaleQty = materialSummary.some(m => m.saleQty > 0)
  const hasPurQty  = materialSummary.some(m => m.purQty  > 0)

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col sm:flex-row sm:overflow-hidden">

      {/* ══ LEFT PANEL — wider, more data ══ */}
      <div className="flex-shrink-0 sm:w-96 sm:border-r sm:border-slate-100 sm:overflow-y-auto flex flex-col bg-slate-50/40">

        {/* Header */}
        <div className="bg-white border-b border-slate-100">
          <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 hover:bg-slate-200 transition-colors">
              <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-slate-800 text-base truncate leading-tight">{contact.company_name}</h1>
              <div className="flex flex-wrap gap-x-3 mt-0.5">
                {contact.gst_number && <span className="text-[11px] text-slate-400 font-mono">{contact.gst_number}</span>}
                {contact.phone      && <span className="text-[11px] text-slate-400">{contact.phone}</span>}
              </div>
            </div>
            <button onClick={() => onEditContact(contact)}
              className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 hover:bg-blue-50 transition-colors">
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.293-6.293a1 1 0 011.414 0l1.586 1.586a1 1 0 010 1.414L12 16H9v-3z"/>
              </svg>
            </button>
          </div>
          {contact.address && (
            <p className="px-4 pb-3 text-xs text-slate-500 flex items-start gap-1.5">
              <svg className="w-3 h-3 mt-0.5 flex-shrink-0 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              {contact.address}
            </p>
          )}
        </div>

        {/* ── Date Filter — always visible ── */}
        <div className="px-4 pt-3 pb-3 bg-white border-b border-slate-100">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Filter by Date</p>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-[9px] text-slate-400 font-semibold block mb-1">From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white outline-none focus:border-blue-400"/>
            </div>
            <div className="flex-1">
              <label className="text-[9px] text-slate-400 font-semibold block mb-1">To</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white outline-none focus:border-blue-400"/>
            </div>
            {hasDateFilter && (
              <button onClick={() => { setDateFrom(''); setDateTo('') }}
                className="mt-4 px-2 py-2 rounded-lg bg-red-50 text-red-500 text-[10px] font-bold hover:bg-red-100 transition-colors border border-red-100">
                Clear
              </button>
            )}
          </div>
          {hasDateFilter && (
            <p className="text-[10px] text-blue-600 font-semibold mt-1">
              Showing {filteredInvoices.length} of {contactInvoices.length} invoices
            </p>
          )}
        </div>

        {/* ── Summary table ── */}
        <div className="px-4 py-3">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Summary</p>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {[
              totalSale     > 0 ? { label: 'Sales (invoiced)',   val: fmt(totalSale),     sub: `${saleInvoices.length} invoices`, color: 'text-emerald-700', bg: 'bg-emerald-50/50' } : null,
              totalPurchase > 0 ? { label: 'Purchases (invoiced)', val: fmt(totalPurchase), sub: `${purInvoices.length} invoices`, color: 'text-red-700', bg: 'bg-red-50/50' } : null,
              unpaidSale    > 0 ? { label: 'Receivable (due)',   val: fmt(unpaidSale),    sub: 'unpaid sale invoices', color: 'text-amber-700', bg: 'bg-amber-50/50' } : null,
              unpaidPurch   > 0 ? { label: 'Payable (due)',      val: fmt(unpaidPurch),   sub: 'unpaid purchase invoices', color: 'text-orange-700', bg: 'bg-orange-50/50' } : null,
              advance       > 0 ? { label: 'Advance Balance',    val: fmt(advance),       sub: 'excess overpayment', color: 'text-purple-700', bg: 'bg-purple-50/50' } : null,
            ].filter(Boolean).map((row, i, arr) => row && (
              <div key={row.label}
                className={`flex items-center justify-between px-3 py-2.5 ${row.bg} ${i < arr.length - 1 ? 'border-b border-slate-100' : ''}`}>
                <div>
                  <p className="text-xs font-semibold text-slate-600">{row.label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{row.sub}</p>
                </div>
                <p className={`text-sm font-bold tabular-nums ${row.color}`}>{row.val}</p>
              </div>
            ))}
            {totalSale === 0 && totalPurchase === 0 && (
              <div className="px-3 py-4 text-center text-xs text-slate-400">No invoices{hasDateFilter ? ' in period' : ''}</div>
            )}
          </div>
        </div>

        {/* ── Invoice list (all, newest first) ── */}
        {filteredInvoices.length > 0 && (
          <div className="px-4 pb-3">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Invoices {hasDateFilter ? `(${filteredInvoices.length} in period)` : `(${filteredInvoices.length} total)`}
            </p>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Table header */}
              <div className="grid text-[9px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-100 px-3 py-1.5"
                style={{gridTemplateColumns:'1fr 60px 80px 60px'}}>
                <span>Invoice</span>
                <span>Date</span>
                <span className="text-right">Amount</span>
                <span className="text-right">Status</span>
              </div>
              <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
                {filteredInvoices.map(inv => (
                  <div key={inv.id} className="grid items-center px-3 py-2 hover:bg-slate-50/60 transition-colors"
                    style={{gridTemplateColumns:'1fr 60px 80px 60px'}}>
                    <div className="min-w-0 pr-1">
                      <p className="text-[11px] font-semibold text-slate-700 truncate">{inv.invoice_number}</p>
                      <span className={`text-[9px] font-bold uppercase ${inv.entry_type === 'sale' ? 'text-emerald-600' : 'text-red-500'}`}>
                        {inv.entry_type}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">{fmtDate(inv.invoice_date)}</span>
                    <span className={`text-[11px] font-bold tabular-nums text-right ${inv.entry_type === 'sale' ? 'text-emerald-700' : 'text-red-600'}`}>
                      {fmt(inv.amount)}
                    </span>
                    <span className={`text-[9px] font-bold text-right ${
                      inv.status === 'paid' ? 'text-emerald-600' :
                      inv.status === 'partial' ? 'text-amber-600' : 'text-red-500'
                    }`}>
                      {inv.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Materials table ── */}
        {materialSummary.length > 0 && (
          <div className="px-4 pb-4">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Materials traded{hasDateFilter ? ' (filtered)' : ''}
            </p>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="grid text-[9px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-100"
                style={{gridTemplateColumns:`1fr${hasPurQty ? ' 55px' : ''}${hasSaleQty ? ' 55px' : ''}${hasPurCol ? ' 72px' : ''}${hasSaleCol ? ' 72px' : ''}`}}>
                <div className="px-3 py-1.5">Material</div>
                {hasPurQty  && <div className="px-1 py-1.5 text-right">Buy Qty</div>}
                {hasSaleQty && <div className="px-1 py-1.5 text-right">Sell Qty</div>}
                {hasPurCol  && <div className="px-1.5 py-1.5 text-right">Pur ₹</div>}
                {hasSaleCol && <div className="px-1.5 py-1.5 text-right">Sale ₹</div>}
              </div>
              <div className="divide-y divide-slate-50">
                {materialSummary.map(m => (
                  <div key={m.name} className="grid items-start hover:bg-slate-50/50"
                    style={{gridTemplateColumns:`1fr${hasPurQty ? ' 55px' : ''}${hasSaleQty ? ' 55px' : ''}${hasPurCol ? ' 72px' : ''}${hasSaleCol ? ' 72px' : ''}`}}>
                    <div className="px-3 py-2">
                      <p className="text-xs font-medium text-slate-700 leading-tight">{m.name}</p>
                      {m.hsn && <p className="text-[9px] text-slate-400 font-mono">{m.hsn}</p>}
                      {m.latestRate != null && (
                        <p className="text-[9px] text-slate-400">@ ₹{m.latestRate.toLocaleString('en-IN', {maximumFractionDigits: 2})}</p>
                      )}
                    </div>
                    {hasPurQty && (
                      <div className="px-1 py-2 text-right">
                        {m.purQty > 0
                          ? <span className="text-[10px] text-slate-600 tabular-nums">{m.purQty.toLocaleString('en-IN')}{m.purUnit ? ` ${m.purUnit}` : ''}</span>
                          : <span className="text-slate-200 text-[10px]">—</span>}
                      </div>
                    )}
                    {hasSaleQty && (
                      <div className="px-1 py-2 text-right">
                        {m.saleQty > 0
                          ? <span className="text-[10px] text-slate-600 tabular-nums">{m.saleQty.toLocaleString('en-IN')}{m.purUnit ? ` ${m.purUnit}` : ''}</span>
                          : <span className="text-slate-200 text-[10px]">—</span>}
                      </div>
                    )}
                    {hasPurCol && (
                      <div className="px-1.5 py-2 text-right">
                        {m.purAmt > 0
                          ? <span className="text-[10px] font-semibold text-red-600 tabular-nums">{fmt(m.purAmt)}</span>
                          : <span className="text-slate-200 text-[10px]">—</span>}
                      </div>
                    )}
                    {hasSaleCol && (
                      <div className="px-1.5 py-2 text-right">
                        {m.saleAmt > 0
                          ? <span className="text-[10px] font-semibold text-emerald-700 tabular-nums">{fmt(m.saleAmt)}</span>
                          : <span className="text-slate-200 text-[10px]">—</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══ RIGHT PANEL: Transactions first, then Notes ══ */}
      <div className="flex-1 flex flex-col min-h-0">

        {/* Tab bar */}
        <div className="flex-shrink-0 flex border-b border-slate-100 bg-white">
          {(['transactions', 'notes'] as TabType[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-6 py-3 text-xs font-bold border-b-2 transition-colors
                ${tab === t ? 'border-blue-700 text-blue-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
              {t === 'transactions'
                ? `Transactions (${contactTxns.length})`
                : `Notes (${contactNotes.length})`}
            </button>
          ))}
        </div>

        {/* ── TRANSACTIONS TAB ── */}
        {tab === 'transactions' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Filter bar */}
            <div className="flex-shrink-0 px-4 py-2.5 flex items-center gap-2 border-b border-slate-50 bg-slate-50/50 flex-wrap">
              {(['all', 'sale', 'purchase'] as const).map(f => (
                <button key={f} onClick={() => setTxFilter(f)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold border transition-colors
                    ${txFilter === f
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                  {f === 'all' ? 'All' : f === 'sale' ? 'Sale receipts' : 'Payments made'}
                </button>
              ))}
              <span className="text-[10px] text-slate-400 ml-auto">{filteredTxns.length} txn{filteredTxns.length !== 1 ? 's' : ''}{hasDateFilter ? ' in period' : ''}</span>
            </div>

            {/* Totals bar */}
            {filteredTxns.length > 0 && (filteredIncome > 0 || filteredExpense > 0) && (
              <div className="flex-shrink-0 flex gap-5 px-4 py-2 border-b border-slate-50">
                {filteredIncome  > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-wide">Received</span>
                    <span className="text-xs font-bold text-emerald-700 tabular-nums">{fmt(filteredIncome)}</span>
                  </div>
                )}
                {filteredExpense > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-red-400 font-bold uppercase tracking-wide">Paid out</span>
                    <span className="text-xs font-bold text-red-600 tabular-nums">{fmt(filteredExpense)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Transaction list */}
            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-1.5">
              {filteredTxns.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-slate-400 text-sm">No transactions{hasDateFilter ? ' in period' : ''}</p>
                </div>
              ) : (
                filteredTxns.map(tx => {
                  const isIncome = tx.type === 'income'
                  return (
                    <div key={tx.id} className="bg-white rounded-xl border border-slate-100 px-4 py-3 flex items-start gap-3">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold mt-0.5
                        ${isIncome ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                        {isIncome ? '+' : '−'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700 truncate">
                          {tx.description || tx.category || (isIncome ? 'Sale receipt' : 'Purchase payment')}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {fmtDate(tx.date)} · {tx.account}
                          {tx.payment_mode ? ` · ${tx.payment_mode}` : ''}
                        </p>
                        {tx.notes && <p className="text-[11px] text-slate-400 mt-0.5 italic">{tx.notes}</p>}
                      </div>
                      <p className={`text-sm font-bold flex-shrink-0 tabular-nums ${isIncome ? 'text-emerald-600' : 'text-red-500'}`}>
                        {isIncome ? '+' : '−'}{fmt(tx.amount)}
                      </p>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* ── NOTES TAB ── */}
        {tab === 'notes' && (
          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
            {!addingNote ? (
              <button onClick={() => setAddingNote(true)}
                className="self-start flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors border border-blue-100">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                </svg>
                Add note or activity
              </button>
            ) : (
              <div className="bg-blue-50 rounded-xl border border-blue-100 p-3 flex flex-col gap-2">
                <textarea value={newNote} onChange={e => setNewNote(e.target.value)} autoFocus
                  rows={3} placeholder="Write a note, call log, or follow-up…"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"/>
                <div className="flex gap-2">
                  <button onClick={handleAddNote} disabled={savingNote || !newNote.trim()}
                    className="px-4 py-1.5 rounded-lg bg-blue-700 text-white text-xs font-bold disabled:opacity-40 hover:bg-blue-800 transition-colors">
                    {savingNote ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => { setAddingNote(false); setNewNote('') }}
                    className="px-4 py-1.5 rounded-lg bg-slate-100 text-slate-500 text-xs font-semibold hover:bg-slate-200 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {contactNotes.length === 0 && !addingNote ? (
              <div className="text-center py-16">
                <p className="text-slate-400 text-sm">No notes yet</p>
                <p className="text-slate-300 text-xs mt-1">Payments, calls, follow-ups — all go here</p>
              </div>
            ) : (
              contactNotes.map(note => (
                <div key={note.id} className="bg-white rounded-xl border border-slate-100 p-3.5">
                  <div className="flex items-start gap-2">
                    <p className="text-sm text-slate-700 flex-1 whitespace-pre-wrap leading-relaxed">{note.note_text}</p>
                    {confirmNoteId === note.id ? (
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => setConfirmNoteId(null)}
                          className="px-2 py-1 rounded-md bg-slate-100 text-[10px] font-semibold text-slate-500">No</button>
                        <button onClick={async () => { await onDeleteNote(note.id); setConfirmNoteId(null) }}
                          className="px-2 py-1 rounded-md bg-red-600 text-white text-[10px] font-semibold">Del</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmNoteId(note.id)}
                        className="w-5 h-5 rounded-md flex items-center justify-center text-slate-200 hover:text-red-500 hover:bg-red-50 flex-shrink-0 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M4 7h16"/>
                        </svg>
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300 mt-2">
                    {new Date(note.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
