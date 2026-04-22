'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import { CreditEntry, CreditType, CreditTerm, Contact } from '@/types'

interface Props {
  credits: CreditEntry[]
  contacts: Contact[]
  loading: boolean
  _onAdd?: (entry: Omit<CreditEntry, 'id' | 'created_at'>) => Promise<void>
  onSettle: (id: string) => void
  onDelete: (id: string) => void
  onPayNow: (credit: CreditEntry) => void
  onUpdate?: (id: string, data: Omit<CreditEntry, 'id' | 'created_at'>) => Promise<void>
  onBulkImport?: (entries: Omit<CreditEntry, 'id' | 'created_at'>[]) => Promise<void>
}

function fmtFull(n: number) {
  return '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })
}
function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function getDueDateUrgency(dueDate: string | null, status: string): 'overdue' | 'red' | 'yellow' | 'normal' | 'settled' {
  if (status === 'settled') return 'settled'
  if (!dueDate) return 'normal'
  const today = new Date(); today.setHours(0,0,0,0)
  const due = new Date(dueDate + 'T00:00:00')
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'overdue'
  if (diffDays <= 7) return 'red'
  if (diffDays <= 14) return 'yellow'
  return 'normal'
}

type DurationFilter = 'all' | '30' | '45' | '90' | '90+'

export default function CreditSection({ credits, contacts, loading, onSettle, onDelete, onPayNow, onUpdate, onBulkImport }: Props) {
  const [typeTab, setTypeTab] = useState<'to_receive' | 'to_pay' | 'all'>('all')
  const [section, setSection] = useState<'pending' | 'completed'>('pending')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [editEntry, setEditEntry] = useState<CreditEntry | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [viewEntry, setViewEntry] = useState<CreditEntry | null>(null)
  const [viewOpen, setViewOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [durationFilter, setDurationFilter] = useState<DurationFilter>('all')
  const [sectionDropdownOpen, setSectionDropdownOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importType, setImportType] = useState<'to_pay' | 'to_receive'>('to_pay')
  const sectionDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (sectionDropdownRef.current && !sectionDropdownRef.current.contains(e.target as Node))
        setSectionDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const pending = useMemo(() => credits.filter(c => c.status === 'pending'), [credits])
  const totalToReceive = pending.filter(c => c.credit_type === 'credit_given').reduce((s, c) => s + c.amount, 0)
  const totalToPay     = pending.filter(c => c.credit_type === 'credit_taken').reduce((s, c) => s + c.amount, 0)
  const countToReceive = pending.filter(c => c.credit_type === 'credit_given').length
  const countToPay     = pending.filter(c => c.credit_type === 'credit_taken').length
  const completedCount = useMemo(() => credits.filter(c => c.status === 'settled').length, [credits])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return credits.filter(c => {
      const statusMatch = section === 'pending' ? c.status === 'pending' : c.status === 'settled'
      const typeMatch =
        typeTab === 'all'        ? true :
        typeTab === 'to_receive' ? c.credit_type === 'credit_given' :
                                   c.credit_type === 'credit_taken'
      const searchMatch = !q || (
        c.company_name?.toLowerCase().includes(q) ||
        c.notes?.toLowerCase().includes(q) ||
        String(c.amount).includes(q)
      )
      let durationMatch = true
      if (durationFilter !== 'all') {
        const invoiceDate = new Date(c.date + 'T00:00:00')
        const todayD = new Date(); todayD.setHours(0, 0, 0, 0)
        const daysSince = Math.floor((todayD.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24))
        if (durationFilter === '30')  durationMatch = daysSince <= 30
        if (durationFilter === '45')  durationMatch = daysSince > 30 && daysSince <= 45
        if (durationFilter === '90')  durationMatch = daysSince > 45 && daysSince <= 90
        if (durationFilter === '90+') durationMatch = daysSince > 90
      }
      return statusMatch && typeMatch && searchMatch && durationMatch
    })
  }, [credits, section, typeTab, searchQuery, durationFilter])

  const handleViewOpen = (c: CreditEntry) => { setViewEntry(c); setViewOpen(true) }
  const handleEditOpen = (c: CreditEntry) => { setEditEntry(c); setEditOpen(true) }
  const openImport = (type: 'to_pay' | 'to_receive') => { setImportType(type); setImportOpen(true) }

  if (loading) return (
    <div className="animate-pulse px-3 sm:px-0 flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white rounded-2xl border p-4 h-20" />
        <div className="bg-white rounded-2xl border p-4 h-20" />
      </div>
      <div className="bg-white rounded-2xl border p-4 h-32" />
    </div>
  )

  return (
    <div className="px-3 sm:px-0 flex flex-col gap-3">

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl p-4 text-left border bg-emerald-50 border-emerald-100">
          <p className="text-[10px] font-bold uppercase tracking-wider mb-1 text-emerald-600">To Receive</p>
          <p className="text-lg font-extrabold text-emerald-700">{fmtFull(totalToReceive)}</p>
          {countToReceive > 0 && <p className="text-[10px] mt-0.5 text-emerald-500">{countToReceive} pending</p>}
        </div>
        <div className="rounded-2xl p-4 text-left border bg-red-50 border-red-100">
          <p className="text-[10px] font-bold uppercase tracking-wider mb-1 text-red-500">To Pay</p>
          <p className="text-lg font-extrabold text-red-600">{fmtFull(totalToPay)}</p>
          {countToPay > 0 && <p className="text-[10px] mt-0.5 text-red-400">{countToPay} pending</p>}
        </div>
      </div>

      {/* Type tabs + import + section dropdown */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {([
          { id: 'all',        label: 'All'        },
          { id: 'to_receive', label: 'To Receive' },
          { id: 'to_pay',     label: 'To Pay'     },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTypeTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
              ${typeTab === t.id ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}

        <div className="flex-1" />

        {/* Import button — visible when a specific type tab is selected */}
        {typeTab !== 'all' && (
          <button
            onClick={() => openImport(typeTab === 'to_pay' ? 'to_pay' : 'to_receive')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-white hover:bg-slate-900 transition-colors">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import
          </button>
        )}

        {/* Pending/Completed dropdown */}
        <div className="relative" ref={sectionDropdownRef}>
          <button
            onClick={() => setSectionDropdownOpen(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:border-slate-400 transition-colors">
            <span className={`w-1.5 h-1.5 rounded-full inline-block ${section === 'pending' ? 'bg-amber-400' : 'bg-emerald-500'}`} />
            {section === 'pending' ? 'Pending' : 'Completed'}
            {section === 'pending' && pending.length > 0 && (
              <span className="bg-slate-100 text-slate-500 rounded-md px-1 text-[10px] font-bold">{pending.length}</span>
            )}
            <svg className={`w-3 h-3 text-slate-400 transition-transform ${sectionDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {sectionDropdownOpen && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden min-w-[150px]">
              <button
                onClick={() => { setSection('pending'); setSectionDropdownOpen(false) }}
                className={`w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-left hover:bg-slate-50 transition-colors
                  ${section === 'pending' ? 'text-amber-600 bg-amber-50' : 'text-slate-600'}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                Pending
                {pending.length > 0 && <span className="ml-auto bg-amber-100 text-amber-600 rounded-md px-1.5 text-[10px] font-bold">{pending.length}</span>}
              </button>
              <button
                onClick={() => { setSection('completed'); setSectionDropdownOpen(false) }}
                className={`w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-left hover:bg-slate-50 transition-colors border-t border-slate-100
                  ${section === 'completed' ? 'text-emerald-600 bg-emerald-50' : 'text-slate-600'}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                Completed
                {completedCount > 0 && <span className="ml-auto bg-emerald-100 text-emerald-600 rounded-md px-1.5 text-[10px] font-bold">{completedCount}</span>}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Duration filters */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Age:</span>
        {([
          { id: 'all',  label: 'All'      },
          { id: '30',   label: '0–30 days' },
          { id: '45',   label: '30–45 days'  },
          { id: '90',   label: '45–90 days'  },
          { id: '90+',  label: '90+ days' },
        ] as const).map(d => (
          <button key={d.id} onClick={() => setDurationFilter(d.id)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors
              ${durationFilter === d.id
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-700'}`}>
            {d.label}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by name, notes, amount…"
          className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 placeholder:text-slate-400" />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm font-bold">✕</button>
        )}
      </div>

      {/* Credit list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 text-center py-12 px-6">
          <div className="text-3xl mb-3">{section === 'completed' ? '✅' : '📋'}</div>
          <p className="font-semibold text-slate-600 text-sm">
            {section === 'completed' ? 'No completed entries yet' : 'No pending credit entries'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {section === 'completed' ? 'Entries move here after recording payment/receipt' : 'Tap + to record credit given or taken'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(c => {
            const isCompleted = c.status === 'settled'
            const urgency = getDueDateUrgency(c.due_date, c.status)
            const borderClass =
              urgency === 'overdue' ? 'border-red-300' :
              urgency === 'red'     ? 'border-red-200' :
              urgency === 'yellow'  ? 'border-amber-200' :
              isCompleted           ? 'border-slate-100' :
              'border-slate-200'
            const dueDateClass =
              urgency === 'overdue' ? 'text-red-600 font-bold' :
              urgency === 'red'     ? 'text-red-500 font-bold' :
              urgency === 'yellow'  ? 'text-amber-500 font-bold' :
              'text-slate-500 font-bold'
            const amountColor = c.credit_type === 'credit_given' ? 'text-emerald-600' : 'text-red-600'

            return (
              <div key={c.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${borderClass} ${isCompleted ? 'opacity-70' : ''}`}>
                <div className="p-4 cursor-pointer" onClick={() => handleViewOpen(c)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-2">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md
                          ${c.credit_type === 'credit_given' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                          {c.credit_type === 'credit_given' ? 'Credit Given' : 'Credit Taken'}
                        </span>
                        {urgency === 'overdue' && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-red-50 text-red-600">Overdue</span>}
                        {isCompleted && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 flex items-center gap-1">
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            Completed
                          </span>
                        )}

                      </div>
                      <p className="font-semibold text-slate-800 text-sm truncate">{c.company_name}</p>
                      {c.invoice_number && (
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">#{c.invoice_number}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="text-sm font-bold text-slate-700">{fmtDate(c.date)}</span>
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-semibold">
                          {Math.floor((new Date().setHours(0,0,0,0) - new Date(c.date + 'T00:00:00').getTime()) / 86400000)}d ago
                        </span>
                        {c.due_date && <span className={`text-[11px] ${dueDateClass}`}>Due: {fmtDate(c.due_date)}</span>}
                      </div>
                      {c.notes && <p className="text-[11px] text-slate-400 mt-1 truncate">{c.notes}</p>}
                    </div>

                    <div className="flex flex-col items-end gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <p className={`font-bold text-base ${amountColor}`}>{fmtFull(c.amount)}</p>
                      <div className="flex items-center gap-1">
                        {!isCompleted && (
                          <button onClick={() => onPayNow(c)}
                            className="h-6 px-2 rounded-md text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors">
                            {c.credit_type === 'credit_given' ? 'Receive' : 'Pay'}
                          </button>
                        )}
                        {!isCompleted && (
                          <button onClick={() => handleEditOpen(c)}
                            className="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-colors">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
                            </svg>
                          </button>
                        )}
                        {confirmId === c.id ? (
                          <button onClick={() => { onDelete(c.id); setConfirmId(null) }}
                            className="h-6 px-2 rounded-md text-[10px] font-bold bg-red-600 text-white hover:bg-red-700 transition-colors">Sure?</button>
                        ) : (
                          <button onClick={() => setConfirmId(c.id)}
                            className="w-6 h-6 flex items-center justify-center rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {viewOpen && viewEntry && (
        <ViewCreditDrawer entry={viewEntry}
          onClose={() => { setViewOpen(false); setViewEntry(null) }}
          onEdit={() => { setViewOpen(false); handleEditOpen(viewEntry) }}
          onDelete={(id) => { onDelete(id); setViewOpen(false); setViewEntry(null) }}
          onPayNow={() => { onPayNow(viewEntry); setViewOpen(false); setViewEntry(null) }} />
      )}

      {editOpen && editEntry && (
        <EditCreditDrawer entry={editEntry} contacts={contacts}
          onClose={() => { setEditOpen(false); setEditEntry(null) }}
          onDelete={(id) => { onDelete(id); setEditOpen(false); setEditEntry(null) }}
          onSettle={(id) => { onSettle(id); setEditOpen(false); setEditEntry(null) }}
          onUpdate={onUpdate} />
      )}

      {importOpen && (
        <ImportCreditDrawer type={importType} contacts={contacts}
          onClose={() => setImportOpen(false)}
          onImport={async (entries) => {
            if (onBulkImport) await onBulkImport(entries)
            setImportOpen(false)
          }} />
      )}

      <div className="h-20" />
    </div>
  )
}

// ── Import Credit Drawer ─────────────────────────────────────────────
interface ImportCreditProps {
  type: 'to_pay' | 'to_receive'
  contacts: Contact[]
  onClose: () => void
  onImport: (entries: Omit<CreditEntry, 'id' | 'created_at'>[]) => Promise<void>
}

type ImportRow = { invoice_number: string; invoice_date: string; amount: number; company_name: string; error?: string }

function ImportCreditDrawer({ type, contacts, onClose, onImport }: ImportCreditProps) {
  const [rows, setRows] = useState<ImportRow[]>([])
  const [importing, setImporting] = useState(false)
  const [parseError, setParseError] = useState('')
  const [done, setDone] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const creditType: CreditType = type === 'to_pay' ? 'credit_taken' : 'credit_given'
  const isReceive = type === 'to_receive'

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setParseError(''); setRows([])
    try {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' })
      if (raw.length < 2) { setParseError('Sheet appears empty'); return }
      const headers = (raw[0] as string[]).map(h => String(h || '').toLowerCase().trim())
      const invNoIdx   = headers.findIndex(h => h.includes('invoice') && (h.includes('no') || h.includes('num') || h.includes('#')))
      const dateIdx    = headers.findIndex(h => h.includes('date'))
      const amtIdx     = headers.findIndex(h => h.includes('amount') || h.includes('amt'))
      const companyIdx = headers.findIndex(h => h.includes('company') || h.includes('name') || h.includes('party') || h.includes('vendor'))
      if (dateIdx === -1 || amtIdx === -1 || companyIdx === -1) {
        setParseError('Could not find required columns. Expected: invoice number · invoice date · amount · company name')
        return
      }
      const parsed: ImportRow[] = []
      for (let i = 1; i < raw.length; i++) {
        const row = raw[i] as unknown[]
        const invoice_number = invNoIdx !== -1 ? String(row[invNoIdx] ?? '').trim() : ''
        const rawDate        = String(row[dateIdx] ?? '').trim()
        const rawAmt         = String(row[amtIdx] ?? '').replace(/[^0-9.]/g, '')
        const company_name   = String(row[companyIdx] ?? '').trim()
        if (!company_name && !rawAmt) continue
        let invoice_date = rawDate
        if (rawDate && !rawDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const d = new Date(rawDate)
          invoice_date = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
        }
        const amount = parseFloat(rawAmt)
        const error  = !company_name ? 'Missing company name' : isNaN(amount) || amount <= 0 ? 'Invalid amount' : ''
        parsed.push({ invoice_number, invoice_date, amount: isNaN(amount) ? 0 : amount, company_name, error })
      }
      setRows(parsed)
    } catch {
      setParseError('Failed to read file. Please use a valid .xlsx, .xls or .csv file.')
    }
  }

  const validRows = rows.filter(r => !r.error)

  const handleImport = async () => {
    if (!validRows.length) return
    setImporting(true)
    // Process in batches of 50 to avoid timeouts
    const entries: Omit<CreditEntry, 'id' | 'created_at'>[] = validRows.map(r => {
      const contact = contacts.find(c => c.company_name.toLowerCase() === r.company_name.toLowerCase())
      return {
        date: r.invoice_date,
        credit_type: creditType,
        contact_id: contact?.id ?? null,
        company_name: r.company_name,
        amount: r.amount,
        term: 'open' as CreditTerm,
        due_date: null,
        invoice_number: r.invoice_number || null,
        notes: null,
        status: 'pending' as const,
        settled_tx_id: null,
      }
    })
    await onImport(entries)
    setImporting(false)
    setDone(true)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
        <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl">
          <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
            <div>
              <p className="font-bold text-slate-800 text-sm">Import {isReceive ? 'To Receive' : 'To Pay'} from Excel</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Columns: invoice number · invoice date · amount · company name</p>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
            {done ? (
              <div className="text-center py-10">
                <div className="text-4xl mb-3">✅</div>
                <p className="font-bold text-slate-700">Import Complete!</p>
                <p className="text-sm text-slate-400 mt-1">{validRows.length} entries imported successfully.</p>
                <button onClick={onClose} className="mt-5 px-6 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700">Done</button>
              </div>
            ) : (
              <>
                <div
                  className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
                  onClick={() => fileRef.current?.click()}>
                  <div className={`w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center ${isReceive ? 'bg-emerald-50' : 'bg-red-50'}`}>
                    <svg className={`w-5 h-5 ${isReceive ? 'text-emerald-600' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-slate-700">Click to upload Excel / CSV</p>
                  <p className="text-[11px] text-slate-400 mt-1">.xlsx · .xls · .csv supported</p>
                  <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
                </div>

                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Expected columns (row 1 = header)</p>
                  <div className="grid grid-cols-4 gap-1">
                    {['invoice number', 'invoice date', 'amount', 'company name'].map(col => (
                      <span key={col} className="text-[11px] font-mono bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-600 text-center">{col}</span>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">Column order doesn&apos;t matter — detected by header name. Invoice number is optional.</p>
                </div>

                {parseError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                    <p className="text-xs text-red-600 font-medium">{parseError}</p>
                  </div>
                )}

                {rows.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-slate-700">{rows.length} rows detected</p>
                      <div className="flex gap-2">
                        {validRows.length > 0 && <span className="text-[11px] text-emerald-600 font-semibold">{validRows.length} valid</span>}
                        {rows.filter(r => r.error).length > 0 && <span className="text-[11px] text-red-600 font-semibold">{rows.filter(r => r.error).length} errors</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto">
                      {rows.map((r, i) => (
                        <div key={i} className={`rounded-xl p-2.5 border text-xs flex items-center gap-2 ${r.error ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                          <div className="flex-1 min-w-0">
                            <p className={`font-semibold truncate ${r.error ? 'text-red-700' : 'text-slate-700'}`}>{r.company_name || '(no name)'}</p>
                            <p className="text-slate-400 text-[10px] font-mono">{r.invoice_date}{r.invoice_number ? ` · #${r.invoice_number}` : ''}</p>
                          </div>
                          <p className={`font-bold flex-shrink-0 ${r.error ? 'text-red-500' : isReceive ? 'text-emerald-600' : 'text-red-600'}`}>
                            {r.error ? r.error : `₹${r.amount.toLocaleString('en-IN')}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {!done && validRows.length > 0 && (
            <div className="px-4 pb-5 pt-3 border-t border-slate-100 flex-shrink-0">
              <button onClick={handleImport} disabled={importing}
                className={`w-full py-2.5 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-50
                  ${isReceive ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {importing ? `Importing ${validRows.length} entries…` : `Import ${validRows.length} ${isReceive ? 'To Receive' : 'To Pay'} entries`}
              </button>
              {rows.filter(r => r.error).length > 0 && (
                <p className="text-[11px] text-slate-400 text-center mt-2">{rows.filter(r => r.error).length} rows with errors will be skipped</p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── View Credit Drawer ───────────────────────────────────────────────
interface ViewCreditProps {
  entry: CreditEntry; onClose: () => void; onEdit: () => void
  onDelete: (id: string) => void; onPayNow: () => void
}

function ViewCreditDrawer({ entry, onClose, onEdit, onDelete, onPayNow }: ViewCreditProps) {
  const urgency = getDueDateUrgency(entry.due_date, entry.status)
  const isPending = entry.status === 'pending'
  const amountColor = entry.credit_type === 'credit_given' ? 'text-emerald-600' : 'text-red-600'
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl">
        <div className="px-4 py-3 flex-shrink-0 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800 text-sm">Credit Details</span>
            <button onClick={onClose} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 px-4 py-3 flex flex-col gap-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-bold text-slate-800 text-base">{entry.company_name}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${entry.credit_type === 'credit_given' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {entry.credit_type === 'credit_given' ? 'Credit Given' : 'Credit Taken'}
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${isPending ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {isPending ? 'Pending' : 'Settled'}
                </span>
                {urgency === 'overdue' && isPending && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-red-50 text-red-600">Overdue</span>}
              </div>
            </div>
            <p className={`font-extrabold text-xl ${amountColor}`}>{fmtFull(entry.amount)}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Invoice Date</p>
              <p className="text-slate-700 font-semibold text-sm">{fmtDate(entry.date)}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {Math.floor((new Date().setHours(0,0,0,0) - new Date(entry.date + 'T00:00:00').getTime()) / 86400000)}d ago
              </p>
            </div>
            {entry.invoice_number && (
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Invoice No.</p>
                <p className="text-slate-700 font-mono font-semibold">#{entry.invoice_number}</p>
              </div>
            )}
            {entry.due_date && (
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Due Date</p>
                <p className={`font-medium ${urgency === 'overdue' ? 'text-red-600' : urgency === 'red' ? 'text-red-500' : urgency === 'yellow' ? 'text-amber-500' : 'text-slate-700'}`}>{fmtDate(entry.due_date)}</p>
              </div>
            )}
            {entry.notes && (
              <div className="bg-slate-50 rounded-xl p-3 col-span-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Notes</p>
                <p className="text-slate-700">{entry.notes}</p>
              </div>
            )}
          </div>
        </div>
        <div className="px-5 py-3 border-t border-slate-100 flex gap-2 flex-shrink-0">
          {isPending && (
            <button onClick={onPayNow} className="flex-1 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors">
              {entry.credit_type === 'credit_given' ? 'Record Receipt' : 'Record Payment'}
            </button>
          )}
          {isPending && (
            <button onClick={onEdit} className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
              </svg>
              Edit
            </button>
          )}
          <button onClick={() => onDelete(entry.id)} className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors">Delete</button>
        </div>
      </div>
      </div>
    </>
  )
}

// ── Edit Credit Drawer ───────────────────────────────────────────────
interface EditCreditProps {
  entry: CreditEntry; contacts: Contact[]; onClose: () => void
  onDelete: (id: string) => void; onSettle: (id: string) => void
  onUpdate?: (id: string, data: Omit<CreditEntry, 'id' | 'created_at'>) => Promise<void>
}

function EditCreditDrawer({ entry, contacts, onClose, onDelete, onSettle, onUpdate }: EditCreditProps) {
  function formatWithCommas(val: string): string {
    const digits = val.replace(/[^0-9.]/g, '')
    const num = parseFloat(digits)
    if (isNaN(num)) return digits
    return num.toLocaleString('en-IN', { maximumFractionDigits: digits.includes('.') ? digits.split('.')[1].length : 0 }) + (digits.endsWith('.') ? '.' : '')
  }
  const [creditType, setCreditType] = useState<CreditType>(entry.credit_type)
  const [contactQuery, setContactQuery] = useState(entry.company_name)
  const [selectedContactId, setSelectedContactId] = useState<string | null>(entry.contact_id)
  const [showDropdown, setShowDropdown] = useState(false)
  const [amount, setAmount] = useState(String(entry.amount))
  const [amountDisplay, setAmountDisplay] = useState(formatWithCommas(String(entry.amount)))
  const [date, setDate] = useState(entry.date)
  const [invoiceNumber, setInvoiceNumber] = useState(entry.invoice_number || '')
  const [notes, setNotes] = useState(entry.notes || '')
  const [saving, setSaving] = useState(false)
  const contactRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (contactRef.current && !contactRef.current.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filteredContacts = contactQuery.length > 0
    ? contacts.filter(c => c.company_name.toLowerCase().includes(contactQuery.toLowerCase()))
    : contacts

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0 || !contactQuery) return
    setSaving(true)
    if (onUpdate) await onUpdate(entry.id, { date, credit_type: creditType, contact_id: selectedContactId || null, company_name: contactQuery, amount: parseFloat(amount), term: 'open', due_date: null, invoice_number: invoiceNumber || null, notes: notes || null, status: entry.status, settled_tx_id: entry.settled_tx_id })
    setSaving(false)
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[88vh] flex flex-col shadow-2xl">
        <div className="px-4 pb-3 pt-4 flex-shrink-0 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-slate-800 text-sm">Edit Credit Entry</span>
            <button onClick={onClose} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
            <button onClick={() => setCreditType('credit_given')} className={`flex-1 py-2 rounded-lg font-semibold text-xs transition-all ${creditType === 'credit_given' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
              Credit Given <span className="text-[10px] opacity-60 ml-1">(To Receive)</span>
            </button>
            <button onClick={() => setCreditType('credit_taken')} className={`flex-1 py-2 rounded-lg font-semibold text-xs transition-all ${creditType === 'credit_taken' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
              Credit Taken <span className="text-[10px] opacity-60 ml-1">(To Pay)</span>
            </button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 px-4 pb-2">
          <div className="text-center py-4 mb-3">
            <div className="inline-flex items-baseline gap-1">
              <span className="text-2xl font-light text-slate-400">₹</span>
              <input type="text" inputMode="decimal" value={amountDisplay}
                onChange={e => { const raw = e.target.value.replace(/,/g, ''); if (/^\d*\.?\d*$/.test(raw)) { setAmount(raw); setAmountDisplay(raw === '' ? '' : formatWithCommas(raw)) } }}
                placeholder="0" className="text-5xl font-light bg-transparent border-none outline-none w-48 tracking-tight text-slate-800" />
            </div>
            <div className="h-px w-24 mx-auto mt-2 bg-slate-200 rounded-full" />
          </div>
          <div className="mb-3" ref={contactRef}>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Party / Company *</label>
            <div className="relative">
              <input type="text" value={contactQuery} onChange={e => { setContactQuery(e.target.value); setSelectedContactId(null); setShowDropdown(true) }} onFocus={() => setShowDropdown(true)}
                placeholder="Search or type company name…" className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-slate-400" />
              {selectedContactId && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">✓</span>}
              {showDropdown && filteredContacts.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-40 overflow-y-auto">
                  {filteredContacts.map(c => (
                    <button key={c.id} onClick={() => { setContactQuery(c.company_name); setSelectedContactId(c.id); setShowDropdown(false) }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm text-slate-700 border-b border-slate-50 last:border-0">{c.company_name}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-3 mb-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Invoice Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-slate-400" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Invoice No.</label>
                <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
                  placeholder="e.g. INV-001"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-slate-400 font-mono" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Notes / Remarks</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Remarks, reference details…"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-slate-400 resize-none" />
            </div>
          </div>
        </div>
        <div className="px-4 pt-3 pb-4 border-t border-slate-100 flex gap-2 flex-shrink-0">
          {entry.status === 'pending' && (
            <button onClick={() => onSettle(entry.id)} className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors whitespace-nowrap">Mark Settled</button>
          )}
          <button onClick={() => onDelete(entry.id)} className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors">Delete</button>
          <button onClick={handleSubmit} disabled={!amount || parseFloat(amount) <= 0 || !contactQuery || saving}
            className="flex-1 py-2.5 rounded-xl font-semibold text-white text-xs transition-all disabled:opacity-40 bg-emerald-600 hover:bg-emerald-700">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
      </div>
    </>
  )
}

// ── Add Credit Drawer ────────────────────────────────────────────────
interface AddCreditProps {
  contacts: Contact[]
  onClose: () => void
  onSubmit: (data: Omit<CreditEntry, 'id' | 'created_at'>) => Promise<void>
}

export function AddCreditDrawer({ contacts, onClose, onSubmit }: AddCreditProps) {
  const today = new Date().toISOString().split('T')[0]
  const [creditType, setCreditType] = useState<CreditType>('credit_given')
  const [contactQuery, setContactQuery] = useState('')
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [amount, setAmount] = useState('')
  const [amountDisplay, setAmountDisplay] = useState('')
  function formatWithCommas(val: string): string {
    const digits = val.replace(/[^0-9.]/g, '')
    const num = parseFloat(digits)
    if (isNaN(num)) return digits
    return num.toLocaleString('en-IN', { maximumFractionDigits: digits.includes('.') ? digits.split('.')[1].length : 0 }) + (digits.endsWith('.') ? '.' : '')
  }
  const [date, setDate] = useState(today)
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const contactRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (contactRef.current && !contactRef.current.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filteredContacts = contactQuery.length > 0
    ? contacts.filter(c => c.company_name.toLowerCase().includes(contactQuery.toLowerCase()))
    : contacts

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0 || !contactQuery) return
    setSaving(true)
    await onSubmit({ date, credit_type: creditType, contact_id: selectedContactId || null, company_name: contactQuery, amount: parseFloat(amount), term: 'open', due_date: null, invoice_number: invoiceNumber || null, notes: notes || null, status: 'pending', settled_tx_id: null })
    setSaving(false)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[88vh] flex flex-col shadow-2xl">
        <div className="px-4 pb-3 pt-4 flex-shrink-0 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-slate-800 text-sm">New Credit Entry</span>
            <button onClick={onClose} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
            <button onClick={() => setCreditType('credit_given')} className={`flex-1 py-2 rounded-lg font-semibold text-xs transition-all ${creditType === 'credit_given' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
              Credit Given <span className="text-[10px] opacity-60 ml-1">(To Receive)</span>
            </button>
            <button onClick={() => setCreditType('credit_taken')} className={`flex-1 py-2 rounded-lg font-semibold text-xs transition-all ${creditType === 'credit_taken' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
              Credit Taken <span className="text-[10px] opacity-60 ml-1">(To Pay)</span>
            </button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 px-4 pb-2">
          <div className="text-center py-4 mb-3">
            <div className="inline-flex items-baseline gap-1">
              <span className="text-2xl font-light text-slate-400">₹</span>
              <input type="text" inputMode="decimal" value={amountDisplay}
                onChange={e => { const raw = e.target.value.replace(/,/g, ''); if (/^\d*\.?\d*$/.test(raw)) { setAmount(raw); setAmountDisplay(raw === '' ? '' : formatWithCommas(raw)) } }}
                placeholder="0" className="text-5xl font-light bg-transparent border-none outline-none w-48 tracking-tight text-slate-800" />
            </div>
            <div className="h-px w-24 mx-auto mt-2 bg-slate-200 rounded-full" />
          </div>
          <div className="mb-3" ref={contactRef}>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Party / Company *</label>
            <div className="relative">
              <input type="text" value={contactQuery} onChange={e => { setContactQuery(e.target.value); setSelectedContactId(null); setShowDropdown(true) }} onFocus={() => setShowDropdown(true)}
                placeholder="Search or type company name…" className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-slate-400" />
              {selectedContactId && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">✓</span>}
              {showDropdown && filteredContacts.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-40 overflow-y-auto">
                  {filteredContacts.map(c => (
                    <button key={c.id} onClick={() => { setContactQuery(c.company_name); setSelectedContactId(c.id); setShowDropdown(false) }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm text-slate-700 border-b border-slate-50 last:border-0">{c.company_name}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-3 mb-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Invoice Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-slate-400" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Invoice No.</label>
                <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
                  placeholder="e.g. INV-001"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-slate-400 font-mono" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Notes / Remarks</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder="Remarks, reference details…"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-slate-400 resize-none" />
            </div>
          </div>
        </div>
        <div className="px-4 pt-3 pb-4 border-t border-slate-100 flex-shrink-0">
          <button onClick={handleSubmit} disabled={!amount || parseFloat(amount) <= 0 || !contactQuery || saving}
            className="w-full py-2.5 rounded-xl font-semibold text-white text-xs transition-all disabled:opacity-40 bg-emerald-600 hover:bg-emerald-700">
            {saving ? 'Saving…' : `Save ${creditType === 'credit_given' ? 'Credit Given' : 'Credit Taken'}`}
          </button>
        </div>
      </div>
      </div>
    </>
  )
}
