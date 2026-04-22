'use client'

import React, { useState, useMemo, useRef } from 'react'
import { Contact, Transaction, CreditEntry, InvoiceEntry, InvoiceLine, ContactNote } from '@/types'

interface Props {
  contacts: Contact[]
  bizTransactions: unknown[]
  loading: boolean
  onAdd: (c: Omit<Contact, 'id' | 'created_at'>) => Promise<void>
  onDelete: (id: string) => void
  onUpdate: (id: string, updates: Partial<Omit<Contact, 'id' | 'created_at'>>) => Promise<void>
  onBulkImport?: (contacts: Omit<Contact, 'id' | 'created_at'>[]) => Promise<void>
  transactions?: Transaction[]
  credits?: CreditEntry[]
  invoices?: InvoiceEntry[]
  invoiceLines?: InvoiceLine[]
  contactNotes?: ContactNote[]
  onAddNote?: (contactId: string, text: string) => Promise<void>
  onDeleteNote?: (noteId: string) => Promise<void>
}

function fmt(n: number) {
  return '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

export default function Contacts({ contacts, loading, onAdd, onDelete, onUpdate, onBulkImport, transactions = [], credits = [], invoices = [], invoiceLines = [], contactNotes = [], onAddNote, onDeleteNote }: Props) {
  const [showAdd, setShowAdd]       = useState(false)
  const [search, setSearch]         = useState('')
  const [newName, setNewName]       = useState('')
  const [newGST, setNewGST]         = useState('')
  const [newPhone, setNewPhone]     = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [saving, setSaving]         = useState(false)
  const [confirmId, setConfirmId]   = useState<string | null>(null)
  const [editId, setEditId]         = useState<string | null>(null)
  const [editName, setEditName]     = useState('')
  const [editGST, setEditGST]       = useState('')
  const [editPhone, setEditPhone]   = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [openCompanyId, setOpenCompanyId] = useState<string | null>(null)

  const summaries = useMemo(() => {
    const map: Record<string, { sent: number; received: number; txCount: number; pendingCredit: number; pendingDebit: number }> = {}
    contacts.forEach(c => { map[c.id] = { sent: 0, received: 0, txCount: 0, pendingCredit: 0, pendingDebit: 0 } })
    transactions.forEach(t => {
      if (!t.contact_id || !map[t.contact_id]) return
      map[t.contact_id].txCount++
      if (t.type === 'income') map[t.contact_id].received += t.amount
      else map[t.contact_id].sent += t.amount
    })
    credits.forEach(ce => {
      const contact = ce.contact_id
        ? contacts.find(ct => ct.id === ce.contact_id)
        : contacts.find(ct => ct.company_name === ce.company_name)
      if (!contact || !map[contact.id]) return
      if (ce.status === 'pending') {
        if (ce.credit_type === 'credit_given') map[contact.id].pendingCredit += ce.amount
        else map[contact.id].pendingDebit += ce.amount
      }
    })
    return map
  }, [contacts, transactions, credits])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return contacts
      .filter(c => !q || c.company_name.toLowerCase().includes(q) || (c.gst_number || '').toLowerCase().includes(q) || (c.phone || '').includes(q))
      .sort((a, b) => {
        const aTotal = (summaries[a.id]?.sent || 0) + (summaries[a.id]?.received || 0)
        const bTotal = (summaries[b.id]?.sent || 0) + (summaries[b.id]?.received || 0)
        return bTotal - aTotal
      })
  }, [contacts, search, summaries])

  const handleAdd = async () => {
    if (!newName.trim()) return
    setSaving(true)
    await onAdd({ company_name: newName.trim(), gst_number: newGST || null, contact_type: 'both', phone: newPhone || null, address: newAddress || null, email: null, notes: null, advance_balance: 0 })
    setSaving(false)
    setNewName(''); setNewGST(''); setNewPhone(''); setNewAddress(''); setShowAdd(false)
  }

  const openEdit = (c: Contact) => {
    setEditId(c.id); setEditName(c.company_name); setEditGST(c.gst_number || ''); setEditPhone(c.phone || ''); setEditAddress(c.address || ''); setConfirmId(null)
  }

  const handleUpdate = async () => {
    if (!editId || !editName.trim()) return
    setEditSaving(true)
    await onUpdate(editId, { company_name: editName.trim(), gst_number: editGST || null, phone: editPhone || null, address: editAddress || null })
    setEditSaving(false)
    setEditId(null)
  }

  const openContact = contacts.find(c => c.id === openCompanyId) ?? null

  if (loading) return <div className="animate-pulse px-3 sm:px-0"><div className="bg-white rounded-2xl border p-4 h-32" /></div>

  // ── Company Detail overlay ─────────────────────────────────────
  if (openContact) {
    // Dynamic import to avoid circular dependency
    const CompanyDetail = require('./CompanyDetail').default
    return (
      <CompanyDetail
        contact={openContact}
        transactions={transactions}
        invoices={invoices}
        invoiceLines={invoiceLines}
        notes={contactNotes}
        onClose={() => setOpenCompanyId(null)}
        onAddNote={onAddNote ?? (async () => {})}
        onDeleteNote={onDeleteNote ?? (async () => {})}
        onEditContact={(c: Contact) => { setOpenCompanyId(null); openEdit(c) }}
      />
    )
  }

  return (
    <div className="px-3 sm:px-0 flex flex-col gap-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-extrabold text-slate-800">Contacts</h2>
          <p className="text-[11px] text-slate-400">{contacts.length} contact{contacts.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-700 text-white text-xs font-bold shadow transition-colors hover:bg-slate-800">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import
          </button>
          <button onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-700 text-white text-sm font-bold shadow transition-colors hover:bg-blue-800">
            + Add
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">New Contact</p>
          <input type="text" placeholder="Company Name *" value={newName} onChange={e => setNewName(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-blue-400 mb-2" />
          <input type="text" placeholder="GST Number" value={newGST} onChange={e => setNewGST(e.target.value.toUpperCase())}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-blue-400 font-mono mb-2" />
          <input type="text" placeholder="Phone" value={newPhone} onChange={e => setNewPhone(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-blue-400 mb-2" />
          <textarea placeholder="Address" value={newAddress} onChange={e => setNewAddress(e.target.value)} rows={2}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-blue-400 mb-3 resize-none" />
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold hover:bg-slate-200">Cancel</button>
            <button onClick={handleAdd} disabled={!newName.trim() || saving} className="flex-1 py-2.5 rounded-xl bg-blue-700 text-white font-bold text-sm disabled:opacity-40">
              {saving ? 'Saving…' : 'Add Contact'}
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
        </svg>
        <input type="text" placeholder="Search company, GST, phone…" value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-8 py-2 rounded-xl bg-white border border-slate-200 text-sm outline-none focus:border-blue-400" />
        {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold">✕</button>}
      </div>

      {/* ── TABLE LIST ── */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 text-center py-14">
          <div className="text-4xl mb-3">👤</div>
          <p className="font-bold text-slate-700">No contacts yet</p>
          <p className="text-sm text-slate-400 mt-1">Add contacts above or import from Excel</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="grid text-[9px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-100 px-3 py-2"
            style={{gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 1fr 90px'}}>
            <span>Company</span>
            <span className="text-right">Invoiced (FY)</span>
            <span className="text-right">Purchases</span>
            <span className="text-right">Sales</span>
            <span className="text-right">Unpaid</span>
            <span className="text-right">Advance</span>
            <span className="text-right">Actions</span>
          </div>

          <div className="divide-y divide-slate-50">
          {filtered.map(c => {
            const s = summaries[c.id]
            const isEditing = editId === c.id
            // Invoice sums for this FY
            const cInvoices = (invoices || []).filter(i => i.contact_id === c.id || i.company_name === c.company_name)
            const fyStart = (() => { const d = new Date(); const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-04-01` })()
            const fyInvoices = cInvoices.filter(i => i.invoice_date >= fyStart)
            const fyPurchases = fyInvoices.filter(i => i.entry_type === 'purchase')
            const fySales = fyInvoices.filter(i => i.entry_type === 'sale')
            const fyPurAmt = fyPurchases.reduce((s, i) => s + i.amount, 0)
            const fySaleAmt = fySales.reduce((s, i) => s + i.amount, 0)
            const fyTotal = fyPurAmt + fySaleAmt
            const unpaidPur = fyPurchases.filter(i => i.status !== 'paid').reduce((s, i) => s + (i.amount - (i.amount_paid ?? 0)), 0)
            const unpaidSale = fySales.filter(i => i.status !== 'paid').reduce((s, i) => s + (i.amount - (i.amount_paid ?? 0)), 0)
            const totalUnpaid = unpaidPur + unpaidSale
            const adv = c.advance_balance ?? 0
            return (
              <div key={c.id}>
                {isEditing ? (
                  <div className="p-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Edit Contact</p>
                    <input type="text" placeholder="Company Name *" value={editName} onChange={e => setEditName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-blue-400 mb-2" />
                    <input type="text" placeholder="GST Number" value={editGST} onChange={e => setEditGST(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-blue-400 font-mono mb-2" />
                    <input type="text" placeholder="Phone" value={editPhone} onChange={e => setEditPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-blue-400 mb-2" />
                    <textarea placeholder="Address" value={editAddress} onChange={e => setEditAddress(e.target.value)} rows={2}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-blue-400 mb-3 resize-none" />
                    <div className="flex gap-2">
                      <button onClick={() => setEditId(null)} className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold hover:bg-slate-200">Cancel</button>
                      <button onClick={handleUpdate} disabled={!editName.trim() || editSaving} className="flex-1 py-2 rounded-xl bg-blue-700 text-white font-bold text-sm disabled:opacity-40">
                        {editSaving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid items-center px-3 py-2.5 hover:bg-slate-50/60 transition-colors group"
                    style={{gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 1fr 90px'}}>
                    {/* Company name + meta */}
                    <button onClick={() => setOpenCompanyId(c.id)} className="text-left min-w-0 pr-2">
                      <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-blue-700 transition-colors">{c.company_name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {c.gst_number && <span className="text-[10px] text-slate-400 font-mono">{c.gst_number}</span>}
                        {c.phone && <span className="text-[10px] text-slate-400">{c.phone}</span>}
                      </div>
                      {fyInvoices.length > 0 && (
                        <span className="text-[9px] text-slate-400">{fyInvoices.length} inv this FY</span>
                      )}
                    </button>
                    {/* Total invoiced */}
                    <div className="text-right pr-2">
                      {fyTotal > 0
                        ? <span className="text-xs font-bold text-slate-700 tabular-nums">{fmt(fyTotal)}</span>
                        : <span className="text-slate-200 text-xs">—</span>}
                    </div>
                    {/* Purchases */}
                    <div className="text-right pr-2">
                      {fyPurAmt > 0
                        ? <><span className="text-xs font-semibold text-red-600 tabular-nums">{fmt(fyPurAmt)}</span>
                           <span className="block text-[9px] text-slate-400">{fyPurchases.length} inv</span></>
                        : <span className="text-slate-200 text-xs">—</span>}
                    </div>
                    {/* Sales */}
                    <div className="text-right pr-2">
                      {fySaleAmt > 0
                        ? <><span className="text-xs font-semibold text-emerald-600 tabular-nums">{fmt(fySaleAmt)}</span>
                           <span className="block text-[9px] text-slate-400">{fySales.length} inv</span></>
                        : <span className="text-slate-200 text-xs">—</span>}
                    </div>
                    {/* Unpaid */}
                    <div className="text-right pr-2">
                      {totalUnpaid > 0
                        ? <span className="text-xs font-bold text-amber-600 tabular-nums">{fmt(totalUnpaid)}</span>
                        : <span className="text-slate-200 text-xs">—</span>}
                    </div>
                    {/* Advance */}
                    <div className="text-right pr-2">
                      {adv > 0
                        ? <span className="text-xs font-bold text-purple-600 tabular-nums">{fmt(adv)}</span>
                        : <span className="text-slate-200 text-xs">—</span>}
                    </div>
                    {/* Actions */}
                    <div className="flex items-center justify-end gap-0.5">
                      <button onClick={() => setOpenCompanyId(c.id)}
                        className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-bold hover:bg-blue-100 transition-colors border border-blue-100">
                        View
                      </button>
                      <button onClick={() => openEdit(c)}
                        className="w-6 h-6 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center transition-colors">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.293-6.293a1 1 0 011.414 0l1.586 1.586a1 1 0 010 1.414L12 16H9v-3z"/>
                        </svg>
                      </button>
                      {confirmId === c.id ? (
                        <button onClick={() => { onDelete(c.id); setConfirmId(null) }} className="px-1.5 py-0.5 rounded-lg bg-red-600 text-white text-[10px] font-bold">Del?</button>
                      ) : (
                        <button onClick={() => setConfirmId(c.id)}
                          className="w-6 h-6 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          </div>
        </div>
      )}

      {importOpen && (
        <ImportContactsDrawer
          existingContacts={contacts}
          onClose={() => setImportOpen(false)}
          onImport={async (rows) => {
            if (onBulkImport) await onBulkImport(rows)
            setImportOpen(false)
          }} />
      )}
    </div>
  )
}

// ── Import Contacts Drawer ───────────────────────────────────────────
interface ImportContactsProps {
  existingContacts: Contact[]
  onClose: () => void
  onImport: (contacts: Omit<Contact, 'id' | 'created_at'>[]) => Promise<void>
}

type ContactRow = { name: string; gst: string; duplicate: boolean; error?: string }

function ImportContactsDrawer({ existingContacts, onClose, onImport }: ImportContactsProps) {
  const [rows, setRows] = useState<ContactRow[]>([])
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [parseError, setParseError] = useState('')
  const [done, setDone] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setParseError(''); setRows([])
    try {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false })
      if (raw.length < 2) { setParseError('Sheet appears empty'); return }

      const headers = (raw[0] as string[]).map(h => String(h || '').toLowerCase().trim())
      const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('company'))
      const gstIdx  = headers.findIndex(h => h.includes('gst') || h.includes('gstin') || h.includes('pan'))

      if (nameIdx === -1) {
        setParseError('Could not find a "name" or "company" column. Please check your sheet headers.')
        return
      }

      const existingNames = new Set(existingContacts.map(c => c.company_name.toLowerCase()))
      const parsed: ContactRow[] = []
      const seenInFile = new Set<string>()

      for (let i = 1; i < raw.length; i++) {
        const row = raw[i] as unknown[]
        const name = String(row[nameIdx] ?? '').trim()
        const gst  = gstIdx !== -1 ? String(row[gstIdx] ?? '').trim().toUpperCase() : ''
        if (!name) continue
        const nameLower = name.toLowerCase()
        const duplicate = existingNames.has(nameLower) || seenInFile.has(nameLower)
        seenInFile.add(nameLower)
        parsed.push({ name, gst, duplicate })
      }
      setRows(parsed)
    } catch {
      setParseError('Failed to read file. Please use a valid .xlsx, .xls or .csv file.')
    }
  }

  const newRows   = rows.filter(r => !r.duplicate && !r.error)
  const dupRows   = rows.filter(r => r.duplicate)

  const handleImport = async () => {
    if (!newRows.length) return
    setImporting(true)
    setProgress(0)

    // Process in chunks (handled by parent), with progress tracking
    const contacts: Omit<Contact, 'id' | 'created_at'>[] = newRows.map(r => ({
      company_name: r.name,
      gst_number: r.gst || null,
      contact_type: 'both' as const,
      phone: null, email: null, address: null, notes: null, advance_balance: 0,
    }))

    // We'll pass all at once to the parent which handles batching
    await onImport(contacts)
    setProgress(100)
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
              <p className="font-bold text-slate-800 text-sm">Import Contacts from Excel</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Columns: name (company) · GST number</p>
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
                <p className="text-sm text-slate-400 mt-1">{newRows.length} contacts added successfully.</p>
                {dupRows.length > 0 && <p className="text-[11px] text-slate-400 mt-1">{dupRows.length} duplicates were skipped.</p>}
                <button onClick={onClose} className="mt-5 px-6 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700">Done</button>
              </div>
            ) : (
              <>
                <div
                  className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
                  onClick={() => fileRef.current?.click()}>
                  <div className="w-10 h-10 rounded-xl mx-auto mb-3 bg-blue-50 flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-slate-700">Click to upload Excel / CSV</p>
                  <p className="text-[11px] text-slate-400 mt-1">.xlsx · .xls · .csv supported</p>
                  <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
                </div>

                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Expected columns (row 1 = header)</p>
                  <div className="grid grid-cols-2 gap-1">
                    {['name', 'GST number'].map(col => (
                      <span key={col} className="text-[11px] font-mono bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-600 text-center">{col}</span>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">Existing contacts with the same name will be automatically skipped to avoid duplicates.</p>
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
                        {newRows.length > 0 && <span className="text-[11px] text-blue-600 font-semibold">{newRows.length} new</span>}
                        {dupRows.length > 0 && <span className="text-[11px] text-slate-400 font-semibold">{dupRows.length} duplicates</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto">
                      {rows.map((r, i) => (
                        <div key={i} className={`rounded-xl p-2.5 border text-xs flex items-center gap-2 ${r.duplicate ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200'}`}>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-700 truncate">{r.name}</p>
                            {r.gst && <p className="text-slate-400 text-[10px] font-mono">{r.gst}</p>}
                          </div>
                          {r.duplicate
                            ? <span className="text-[10px] text-slate-400 font-semibold bg-slate-100 px-2 py-0.5 rounded-md flex-shrink-0">duplicate</span>
                            : <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-md flex-shrink-0">new</span>
                          }
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {importing && (
                  <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-semibold text-blue-700">Importing contacts…</p>
                      <p className="text-xs text-blue-600">{progress}%</p>
                    </div>
                    <div className="w-full bg-blue-100 rounded-full h-1.5">
                      <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {!done && newRows.length > 0 && !importing && (
            <div className="px-4 pb-5 pt-3 border-t border-slate-100 flex-shrink-0">
              <button onClick={handleImport}
                className="w-full py-2.5 rounded-xl font-bold text-white text-sm bg-blue-700 hover:bg-blue-800 transition-all">
                Import {newRows.length} contact{newRows.length !== 1 ? 's' : ''}
                {dupRows.length > 0 && ` (skip ${dupRows.length} duplicates)`}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
