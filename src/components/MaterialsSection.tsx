'use client'

import React, { useState, useMemo, useRef } from 'react'
import { Material, StockEntry } from '@/types'
import * as XLSX from 'xlsx'

interface Props {
  materials: Material[]
  stockEntries: StockEntry[]
  loading: boolean
  onAddMaterial: (m: Omit<Material, 'id' | 'created_at'>) => Promise<Material>
  onUpdateMaterial: (id: string, m: Omit<Material, 'id' | 'created_at'>) => Promise<void>
  onDeleteMaterial: (id: string) => Promise<void>
  onAddStock: (s: Omit<StockEntry, 'id' | 'created_at'>) => Promise<void>
  onUpdateStock: (id: string, s: Partial<Omit<StockEntry, 'id' | 'created_at'>>) => Promise<void>
  onDeleteStock: (id: string) => Promise<void>
  onBulkImportStock?: (newMaterials: Omit<Material, 'id' | 'created_at'>[], stockRows: (Omit<StockEntry, 'id' | 'created_at' | 'material_id'> & { material_name: string })[]) => Promise<{ stockCount: number; newMatCount: number } | void>
}

function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}
function fmtQty(n: number) {
  return n % 1 === 0 ? n.toLocaleString('en-IN') : n.toLocaleString('en-IN', { maximumFractionDigits: 3 })
}
function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
}
function daysTo(s: string | null): number | null {
  if (!s) return null
  return Math.round((new Date(s + 'T00:00:00').getTime() - Date.now()) / 86400000)
}

const UNITS = ['Kg', 'Gms', 'Ltr', 'Ml', 'Ths', 'Nos', 'Pcs', 'Boxes', 'Bags', 'Bottles', 'Strips', 'Other']
const inp = 'w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-300'
const lbl = 'text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5'

const IconPlus    = () => <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg>
const IconEdit    = () => <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.293-6.293a1 1 0 011.414 0l1.586 1.586a1 1 0 010 1.414L12 16H9v-3z"/></svg>
const IconTrash   = () => <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M4 7h16"/></svg>
const IconChevron = ({ open }: { open: boolean }) => <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
const IconClose   = () => <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>

function Drawer({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl max-h-[92vh] flex flex-col shadow-2xl">
        <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0"><div className="w-8 h-1 bg-slate-200 rounded-full" /></div>
        <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <p className="font-bold text-sm text-slate-800">{title}</p>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center"><IconClose /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-4 py-3 flex flex-col gap-3">{children}</div>
        <div className="px-4 py-3 border-t border-slate-100 flex-shrink-0">{footer}</div>
      </div>
    </>
  )
}

function SubmitBtn({ saving, disabled, label, onClick }: { saving: boolean; disabled?: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={saving || disabled}
      className="w-full py-2.5 rounded-xl font-bold text-sm text-white bg-blue-700 disabled:opacity-40 hover:bg-blue-800 transition-colors">
      {saving ? 'Saving…' : label}
    </button>
  )
}

// ── Shelf Life Bar (compact inline) ──────────────────────────────────────────
function shelfLifeData(mfdDate: string | null, expiryDate: string | null) {
  if (!expiryDate) return null
  const now = Date.now()
  const expTime = new Date(expiryDate + 'T00:00:00').getTime()
  const daysLeft = Math.round((expTime - now) / 86400000)

  let pct = 100
  if (mfdDate) {
    const mfdTime = new Date(mfdDate + 'T00:00:00').getTime()
    const totalLife = expTime - mfdTime
    const elapsed = now - mfdTime
    pct = totalLife > 0 ? Math.max(0, Math.min(100, Math.round(((totalLife - elapsed) / totalLife) * 100))) : 0
  } else {
    const assumedStart = expTime - (3 * 365 * 86400000)
    const totalLife = expTime - assumedStart
    const elapsed = now - assumedStart
    pct = totalLife > 0 ? Math.max(0, Math.min(100, Math.round(((totalLife - elapsed) / totalLife) * 100))) : 0
  }

  const isExpired  = daysLeft < 0
  const isCritical = !isExpired && daysLeft < 30
  const isWarning  = !isExpired && !isCritical && daysLeft < 90

  let timeLabel = ''
  if (isExpired) {
    const absDays = Math.abs(daysLeft)
    const yrs = Math.floor(absDays / 365)
    const mos = Math.floor((absDays % 365) / 30)
    const ds  = absDays % 30
    timeLabel = 'Exp ' + (yrs > 0 ? `${yrs}y ` : '') + (mos > 0 ? `${mos}m ` : '') + `${ds}d ago`
  } else {
    const yrs = Math.floor(daysLeft / 365)
    const mos = Math.floor((daysLeft % 365) / 30)
    const ds  = daysLeft % 30
    if (yrs > 0)      timeLabel = `${yrs}y ${mos}m`
    else if (mos > 0) timeLabel = `${mos}m ${ds}d`
    else              timeLabel = `${ds}d`
  }

  const barColor  = isExpired ? 'bg-red-500'   : isCritical ? 'bg-red-400'   : isWarning ? 'bg-amber-400' : pct > 50 ? 'bg-emerald-500' : 'bg-blue-400'
  const textColor = isExpired ? 'text-red-600' : isCritical ? 'text-red-500' : isWarning ? 'text-amber-600' : 'text-slate-500'
  const trackColor = isExpired ? 'bg-red-100'  : isCritical ? 'bg-red-50'    : isWarning ? 'bg-amber-50'   : 'bg-slate-100'

  return { pct: isExpired ? 0 : pct, timeLabel, barColor, textColor, trackColor, isExpired, isCritical, isWarning }
}

// Compact inline bar — fits inside a table cell
function ShelfLifeCell({ mfdDate, expiryDate }: { mfdDate: string | null; expiryDate: string | null }) {
  const d = shelfLifeData(mfdDate, expiryDate)
  if (!d) return <span className="text-[9px] text-slate-300">—</span>
  return (
    <div className="flex items-center gap-1.5 min-w-[80px]">
      <div className={`flex-1 h-1 rounded-full ${d.trackColor} overflow-hidden`}>
        <div className={`h-full rounded-full ${d.barColor}`} style={{ width: `${d.pct}%` }} />
      </div>
      <span className={`text-[10px] font-bold whitespace-nowrap tabular-nums ${d.textColor}`}>{d.timeLabel}</span>
    </div>
  )
}

// Header-level compact bar (collapsed card preview) — slightly wider
function ShelfLifeBar({ mfdDate, expiryDate, inline }: { mfdDate: string | null; expiryDate: string | null; inline?: boolean }) {
  const d = shelfLifeData(mfdDate, expiryDate)
  if (!d) return null
  return (
    <div className={`flex items-center gap-1.5 ${inline ? '' : 'mt-1'}`}>
      <div className={`h-1 rounded-full ${d.trackColor} overflow-hidden ${inline ? 'w-12' : 'flex-1'}`} style={inline ? undefined : { maxWidth: 80 }}>
        <div className={`h-full rounded-full ${d.barColor}`} style={{ width: `${d.pct}%` }} />
      </div>
      <span className={`text-[10px] font-bold ${d.textColor} whitespace-nowrap`}>{d.pct}% · {d.timeLabel}</span>
    </div>
  )
}

// ── Stock Drawer ──────────────────────────────────────────────────────────────
function StockDrawer({ materials, editEntry, defaultMaterialId, onClose, onSubmit }: {
  materials: Material[]
  editEntry?: StockEntry | null
  defaultMaterialId?: string
  onClose: () => void
  onSubmit: (s: Omit<StockEntry, 'id' | 'created_at'>) => Promise<void>
}) {
  const today = new Date().toISOString().split('T')[0]
  const defaultMat = editEntry ? materials.find(m => m.id === editEntry.material_id) ?? null
    : materials.find(m => m.id === defaultMaterialId) ?? null

  const [matSearch, setMatSearch]     = useState(editEntry?.material_name ?? defaultMat?.material_name ?? '')
  const [selectedMat, setSelectedMat] = useState<Material | null>(editEntry ? (materials.find(m => m.id === editEntry.material_id) ?? null) : defaultMat)
  const [showMatDrop, setShowMatDrop] = useState(false)
  const [supplier, setSupplier]       = useState(editEntry?.supplier_name ?? '')
  const [qty, setQty]                 = useState(editEntry?.quantity != null ? String(editEntry.quantity) : '')
  const [unit, setUnit]               = useState(editEntry?.unit ?? 'Kg')
  const [rate, setRate]               = useState(editEntry?.rate != null ? String(editEntry.rate) : '')
  const [batch, setBatch]             = useState(editEntry?.batch_number ?? '')
  const [mfdDate, setMfdDate]         = useState(editEntry?.mfd_date ?? '')
  const [expiry, setExpiry]           = useState(editEntry?.expiry_date ?? '')
  const [entryDate, setEntryDate]     = useState(editEntry?.entry_date ?? today)
  const [notes, setNotes]             = useState(editEntry?.notes ?? '')
  const [saving, setSaving]           = useState(false)

  const filteredMats = useMemo(() => {
    if (!matSearch.trim()) return materials.slice(0, 8)
    return materials.filter(m => m.material_name.toLowerCase().includes(matSearch.toLowerCase())).slice(0, 8)
  }, [materials, matSearch])

  const handleSubmit = async () => {
    if (!selectedMat || !qty) return
    setSaving(true)
    await onSubmit({
      material_id: selectedMat.id, material_name: selectedMat.material_name,
      invoice_id: editEntry?.invoice_id ?? null, invoice_number: editEntry?.invoice_number ?? null,
      supplier_name: supplier.trim() || null, quantity: parseFloat(qty),
      unit: unit === 'Other' ? null : unit, rate: rate ? parseFloat(rate) : null,
      batch_number: batch.trim() || null, mfd_date: mfdDate || null,
      expiry_date: expiry || null, entry_date: entryDate, notes: notes.trim() || null,
    })
    setSaving(false)
    onClose()
  }

  return (
    <Drawer title={editEntry ? 'Edit Stock Entry' : 'Add Stock Entry'} onClose={onClose}
      footer={<SubmitBtn saving={saving} disabled={!selectedMat || !qty} label={editEntry ? 'Save Changes' : 'Add Stock'} onClick={handleSubmit} />}>
      <div className="relative">
        <label className={lbl}>Material *</label>
        {editEntry ? (
          <div className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">{editEntry.material_name}</div>
        ) : (
          <>
            <input value={matSearch} onChange={e => { setMatSearch(e.target.value); setSelectedMat(null); setShowMatDrop(true) }}
              onFocus={() => setShowMatDrop(true)} placeholder="Search material…" className={inp} />
            {selectedMat && <p className="text-[10px] text-emerald-600 mt-0.5 font-semibold">✓ {selectedMat.material_name}</p>}
            {showMatDrop && filteredMats.length > 0 && (
              <div className="absolute z-20 w-full bg-white border border-slate-200 rounded-xl shadow-xl mt-1 max-h-36 overflow-y-auto">
                {filteredMats.map(m => (
                  <button key={m.id} onClick={() => { setSelectedMat(m); setMatSearch(m.material_name); setShowMatDrop(false) }}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 text-xs font-medium text-slate-800">
                    {m.material_name}{m.hsn_code && <span className="text-slate-400 font-mono ml-2 text-[10px]">{m.hsn_code}</span>}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div><label className={lbl}>Supplier</label><input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Supplier name" className={inp} /></div>
        <div><label className={lbl}>Entry Date</label><input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className={inp} /></div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div><label className={lbl}>Qty *</label><input type="number" inputMode="decimal" value={qty} onChange={e => setQty(e.target.value)} onWheel={e => (e.target as HTMLInputElement).blur()} placeholder="0" className={inp} /></div>
        <div><label className={lbl}>Unit</label><select value={unit} onChange={e => setUnit(e.target.value)} className={inp}>{UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select></div>
        <div><label className={lbl}>Rate ₹</label><input type="number" inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} onWheel={e => (e.target as HTMLInputElement).blur()} placeholder="0.00" className={inp} /></div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div><label className={lbl}>Batch No.</label><input value={batch} onChange={e => setBatch(e.target.value)} placeholder="Batch" className={inp + ' font-mono'} /></div>
        <div><label className={lbl}>Mfg Date</label><input type="date" value={mfdDate} onChange={e => setMfdDate(e.target.value)} className={inp} /></div>
        <div><label className={lbl}>Expiry</label><input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} className={inp} /></div>
      </div>
      <div><label className={lbl}>Notes</label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Remarks…" className={inp + ' resize-none'} /></div>
    </Drawer>
  )
}

// ── Give Sample Drawer ────────────────────────────────────────────────────────
function GiveSampleDrawer({ mat, defaultUnit, prefillEntry, onClose, onSubmit }: {
  mat: Material
  defaultUnit: string | null
  prefillEntry?: StockEntry | null
  onClose: () => void
  onSubmit: (s: Omit<StockEntry, 'id' | 'created_at'>) => Promise<void>
}) {
  const today = new Date().toISOString().split('T')[0]
  const [company, setCompany] = useState('')
  const [qty, setQty]         = useState(prefillEntry?.quantity != null ? String(Math.abs(prefillEntry.quantity)) : '')
  const [unit, setUnit]       = useState(prefillEntry?.unit ?? defaultUnit ?? 'Gms')
  const [date, setDate]       = useState(today)
  const [saving, setSaving]   = useState(false)

  const handleSubmit = async () => {
    if (!qty || !company.trim()) return
    setSaving(true)
    await onSubmit({
      material_id: mat.id, material_name: mat.material_name,
      invoice_id: null, invoice_number: null, supplier_name: null,
      quantity: -Math.abs(parseFloat(qty)),
      unit: unit === 'Other' ? null : unit,
      rate: null,
      batch_number: prefillEntry?.batch_number ?? null,
      mfd_date: prefillEntry?.mfd_date ?? null,
      expiry_date: prefillEntry?.expiry_date ?? null,
      entry_date: date,
      notes: `🧪 Sample → ${company.trim()}`,
    })
    setSaving(false)
    onClose()
  }

  return (
    <Drawer title="Give Sample" onClose={onClose}
      footer={<SubmitBtn saving={saving} disabled={!qty || !company.trim()} label="Give Sample" onClick={handleSubmit} />}>
      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
        <span className="text-base">🧪</span>
        <div>
          <p className="text-[11px] text-amber-800 font-medium">Deducts from stock. Company name required.</p>
          {prefillEntry?.batch_number && (
            <p className="text-[10px] text-amber-600 mt-0.5">Batch: <span className="font-mono font-bold">{prefillEntry.batch_number}</span></p>
          )}
        </div>
      </div>
      <div><label className={lbl}>Company Name *</label><input value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. ABC Pharma" className={inp} autoFocus /></div>
      <div className="grid grid-cols-3 gap-2">
        <div><label className={lbl}>Qty *</label><input type="number" inputMode="decimal" value={qty} onChange={e => setQty(e.target.value)} onWheel={e => (e.target as HTMLInputElement).blur()} placeholder="0" className={inp} /></div>
        <div><label className={lbl}>Unit</label><select value={unit} onChange={e => setUnit(e.target.value)} className={inp}>{UNITS.filter(u => u !== 'Other').map(u => <option key={u} value={u}>{u}</option>)}</select></div>
        <div><label className={lbl}>Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className={inp} /></div>
      </div>
    </Drawer>
  )
}

// ── Material Form Drawer ──────────────────────────────────────────────────────
function MaterialFormDrawer({ editMaterial, onClose, onSubmit }: {
  editMaterial?: Material | null; onClose: () => void
  onSubmit: (m: Omit<Material, 'id' | 'created_at'>) => Promise<void>
}) {
  const [name, setName]   = useState(editMaterial?.material_name ?? '')
  const [hsn, setHsn]     = useState(editMaterial?.hsn_code ?? '')
  const [cgst, setCgst]   = useState<string>(editMaterial?.gst_rate != null ? String(editMaterial.gst_rate / 2) : '')
  const [sgst, setSgst]   = useState<string>(editMaterial?.gst_rate != null ? String(editMaterial.gst_rate / 2) : '')
  const [saving, setSaving] = useState(false)
  const totalGst = (parseFloat(cgst) || 0) + (parseFloat(sgst) || 0)
  const slabs = [{ label: '5%', cgst: '2.5', sgst: '2.5' }, { label: '12%', cgst: '6', sgst: '6' }, { label: '18%', cgst: '9', sgst: '9' }, { label: '28%', cgst: '14', sgst: '14' }, { label: 'Nil', cgst: '0', sgst: '0' }]
  const handleSubmit = async () => {
    if (!name.trim()) return
    setSaving(true)
    await onSubmit({ material_name: name.trim(), hsn_code: hsn.trim() || null, gst_rate: totalGst > 0 ? totalGst : null })
    setSaving(false)
  }
  return (
    <Drawer title={editMaterial ? 'Edit Material' : 'New Material'} onClose={onClose}
      footer={<SubmitBtn saving={saving} disabled={!name.trim()} label={editMaterial ? 'Save Changes' : 'Add Material'} onClick={handleSubmit} />}>
      <div><label className={lbl}>Material Name *</label><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Magnesium Stearate" className={inp} /></div>
      <div><label className={lbl}>HSN Code</label><input value={hsn} onChange={e => setHsn(e.target.value)} placeholder="e.g. 29153990" className={inp + ' font-mono'} /></div>
      <div>
        <label className={lbl + ' mb-1.5'}>GST Rate</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {slabs.map(s => {
            const active = cgst === s.cgst && sgst === s.sgst
            return <button key={s.label} onClick={() => { setCgst(s.cgst); setSgst(s.sgst) }}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'}`}>{s.label}</button>
          })}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={lbl}>CGST %</label><input type="number" value={cgst} onChange={e => setCgst(e.target.value)} placeholder="2.5" className={inp} /></div>
          <div><label className={lbl}>SGST %</label><input type="number" value={sgst} onChange={e => setSgst(e.target.value)} placeholder="2.5" className={inp} /></div>
        </div>
        {totalGst > 0 && <p className="text-[10px] text-blue-600 font-semibold mt-1">Total GST: {totalGst}%</p>}
      </div>
    </Drawer>
  )
}

// ── Stock Entry Row (inside entries tab) ──────────────────────────────────────
function StockEntryRow({ entry, onEdit, onDelete, onGiveSample }: {
  entry: StockEntry
  onEdit: () => void
  onDelete: () => void
  onGiveSample: () => void
}) {
  const [confirmDel, setConfirmDel] = useState(false)
  const days = daysTo(entry.expiry_date)
  const isExpired  = days !== null && days < 0
  const isExpiring = days !== null && days >= 0 && days < 90
  const isSampleEntry = entry.quantity < 0 && entry.notes?.startsWith('🧪')

  return (
    <div className="grid text-[10px] border-b border-slate-50 last:border-b-0 hover:bg-slate-50/80 transition-colors"
      style={{ gridTemplateColumns: '68px 1fr 64px 56px 64px 72px' }}>
      <div className="px-2 py-2 text-slate-500">{fmtDate(entry.entry_date)}</div>
      <div className="px-1.5 py-2 min-w-0">
        <p className="font-medium text-slate-700 truncate text-[10px]">{entry.supplier_name ?? entry.invoice_number ?? 'Manual'}</p>
        <div className="flex items-center gap-1 flex-wrap">
          {entry.batch_number && <span className="font-mono text-[9px] text-slate-400 bg-slate-100 px-1 py-0.5 rounded">{entry.batch_number}</span>}
          {entry.expiry_date && <span className={`text-[9px] font-semibold ${isExpired ? 'text-red-600' : isExpiring ? 'text-amber-600' : 'text-slate-400'}`}>{isExpired ? 'EXP' : isExpiring ? `${days}d` : fmtDate(entry.expiry_date)}</span>}
          {isSampleEntry && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-amber-100 text-amber-700">🧪 sample</span>}
        </div>
      </div>
      <div className="px-1.5 py-2 text-right font-semibold tabular-nums">
        <span className={entry.quantity < 0 ? 'text-red-600' : 'text-slate-700'}>{fmtQty(entry.quantity)}</span>
        <span className="text-slate-400 font-normal"> {entry.unit ?? ''}</span>
      </div>
      <div className="px-1.5 py-2 text-right text-slate-500 tabular-nums">{entry.rate != null ? fmt(entry.rate) : '—'}</div>
      <div className="px-1.5 py-2 text-right font-semibold text-slate-600 tabular-nums">{entry.rate != null ? fmt(Math.abs(entry.quantity) * entry.rate) : '—'}</div>
      <div className="px-1.5 py-2 flex items-center justify-end gap-1">
        {/* Sample button — only on positive stock entries */}
        {entry.quantity > 0 && (
          <button
            onClick={onGiveSample}
            title="Give sample from this entry"
            className="w-5 h-5 rounded flex items-center justify-center text-slate-300 hover:text-amber-500 hover:bg-amber-50 transition-colors text-xs"
          >🧪</button>
        )}
        <button onClick={onEdit} className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><IconEdit /></button>
        {confirmDel ? (
          <div className="flex gap-0.5">
            <button onClick={() => setConfirmDel(false)} className="px-1 py-0.5 rounded text-[9px] bg-slate-100 text-slate-600 font-bold">No</button>
            <button onClick={onDelete} className="px-1 py-0.5 rounded text-[9px] bg-red-600 text-white font-bold">Del</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDel(true)} className="w-5 h-5 rounded flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"><IconTrash /></button>
        )}
      </div>
    </div>
  )
}

// ── Batches Table ─────────────────────────────────────────────────────────────
function BatchesTable({ batches, unit }: {
  batches: [string, { qty: number; expiry: string | null; mfd: string | null; rate: number | null; supplier: string | null }][]
  unit: string | null
}) {
  if (batches.length === 0) return <p className="text-center text-[11px] text-slate-400 py-3">No stock entries</p>
  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <table className="w-full text-[10px]">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-100">
            <th className="px-2.5 py-1.5 text-left font-bold text-slate-500 uppercase tracking-wide text-[9px]">Batch</th>
            <th className="px-2.5 py-1.5 text-left font-bold text-slate-500 uppercase tracking-wide text-[9px]">Make</th>
            <th className="px-2.5 py-1.5 text-right font-bold text-slate-500 uppercase tracking-wide text-[9px]">Qty</th>
            <th className="px-2.5 py-1.5 text-left font-bold text-slate-500 uppercase tracking-wide text-[9px]">Mfg</th>
            <th className="px-2.5 py-1.5 text-left font-bold text-slate-500 uppercase tracking-wide text-[9px]">Expiry</th>
            <th className="px-2.5 py-1.5 text-right font-bold text-slate-500 uppercase tracking-wide text-[9px]">Rate</th>
            <th className="px-2.5 py-1.5 text-right font-bold text-slate-500 uppercase tracking-wide text-[9px]">Value</th>
            <th className="px-2.5 py-1.5 text-left font-bold text-slate-500 uppercase tracking-wide text-[9px]">Shelf Life</th>
          </tr>
        </thead>
        <tbody>
          {batches.map(([batchNo, b], i) => {
            const days = daysTo(b.expiry)
            const isExpired  = days !== null && days < 0
            const isCritical = !isExpired && days !== null && days < 30
            const isWarning  = !isExpired && !isCritical && days !== null && days < 90
            const rowBg = isExpired ? 'bg-red-50/60' : isCritical ? 'bg-red-50/40' : isWarning ? 'bg-amber-50/50' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
            const expColor = isExpired ? 'text-red-600 font-bold' : isCritical ? 'text-red-500 font-semibold' : isWarning ? 'text-amber-600 font-semibold' : 'text-slate-600'

            return (
              <tr key={batchNo} className={`border-b border-slate-100 last:border-b-0 ${rowBg}`}>
                <td className="px-2.5 py-2">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="font-mono font-semibold text-slate-700">{batchNo === '—' ? <span className="text-slate-300 font-normal italic">No batch</span> : batchNo}</span>
                    {isExpired  && <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-red-100 text-red-700">EXP</span>}
                    {isCritical && <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-red-100 text-red-600">!</span>}
                    {isWarning  && <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-amber-100 text-amber-700">⚠</span>}
                  </div>
                </td>
                <td className="px-2.5 py-2 text-slate-500 max-w-[80px] truncate">{b.supplier ?? <span className="text-slate-300">—</span>}</td>
                <td className="px-2.5 py-2 text-right font-semibold tabular-nums text-slate-800">
                  {fmtQty(b.qty)} <span className="text-[9px] text-slate-400 font-normal">{unit ?? ''}</span>
                </td>
                <td className="px-2.5 py-2 text-slate-500 whitespace-nowrap">{fmtDate(b.mfd)}</td>
                <td className={`px-2.5 py-2 whitespace-nowrap ${expColor}`}>{fmtDate(b.expiry)}</td>
                <td className="px-2.5 py-2 text-right text-slate-500 tabular-nums">{b.rate != null ? fmt(b.rate) : <span className="text-slate-300">—</span>}</td>
                <td className="px-2.5 py-2 text-right font-semibold text-slate-700 tabular-nums">
                  {b.rate != null ? fmt(Math.abs(b.qty) * b.rate) : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-2.5 py-2">
                  <ShelfLifeCell mfdDate={b.mfd} expiryDate={b.expiry} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Material Card ─────────────────────────────────────────────────────────────
type CardTab = 'batches' | 'entries'

function MaterialCard({ mat, entries, onAddStock, onEditStock, onDeleteStock, onGiveSample, onEdit, onDelete }: {
  mat: Material; entries: StockEntry[]
  onAddStock: () => void; onEditStock: (e: StockEntry) => void; onDeleteStock: (id: string) => void
  onGiveSample: (entry?: StockEntry) => void
  onEdit: () => void; onDelete: () => void
}) {
  const [expanded, setExpanded]     = useState(false)
  const [tab, setTab]               = useState<CardTab>('batches')
  const [confirmDel, setConfirmDel] = useState(false)

  // ── Totals (all correct, no rounding errors) ──
  const totalIn    = entries.reduce((s, e) => e.quantity > 0 ? s + e.quantity : s, 0)
  const totalOut   = entries.reduce((s, e) => e.quantity < 0 ? s + Math.abs(e.quantity) : s, 0)
  const netStock   = entries.reduce((s, e) => s + e.quantity, 0)

  // Total value: sum of (qty × rate) for positive entries only
  const totalValue = entries.reduce((s, e) => {
    if (e.quantity > 0 && e.rate != null) return s + (e.quantity * e.rate)
    return s
  }, 0)

  const latestEntry = [...entries].sort((a, b) => b.entry_date.localeCompare(a.entry_date))[0]
  const latestRate  = latestEntry?.rate ?? null
  const unit        = latestEntry?.unit ?? null

  // Batch summary (group by batch_number)
  const batches = useMemo(() => {
    const map: Record<string, { qty: number; expiry: string | null; mfd: string | null; rate: number | null; supplier: string | null }> = {}
    entries.forEach(e => {
      const key = e.batch_number ?? '—'
      if (!map[key]) map[key] = { qty: 0, expiry: e.expiry_date, mfd: e.mfd_date, rate: e.rate, supplier: e.supplier_name }
      map[key].qty += e.quantity
      // Prefer most recent expiry data if multiple entries share a batch
      if (e.expiry_date && !map[key].expiry) map[key].expiry = e.expiry_date
      if (e.mfd_date && !map[key].mfd) map[key].mfd = e.mfd_date
      if (e.rate != null && map[key].rate == null) map[key].rate = e.rate
    })
    // Sort: active batches first (positive qty), then by expiry ascending
    return Object.entries(map).sort((a, b) => {
      if (a[1].qty > 0 && b[1].qty <= 0) return -1
      if (a[1].qty <= 0 && b[1].qty > 0) return 1
      if (a[1].expiry && b[1].expiry) return a[1].expiry.localeCompare(b[1].expiry)
      if (a[1].expiry) return -1
      if (b[1].expiry) return 1
      return 0
    })
  }, [entries])

  const batchCount    = batches.length
  const expiringCount = batches.filter(([, b]) => { const d = daysTo(b.expiry); return d !== null && d < 90 && d >= 0 }).length
  const expiredCount  = batches.filter(([, b]) => { const d = daysTo(b.expiry); return d !== null && d < 0 }).length

  // Nearest expiry for the shelf life bar shown in collapsed header
  const nearestBatch = batches.find(([, b]) => b.expiry != null) ?? null

  return (
    <div className={`bg-white rounded-xl border overflow-hidden transition-all ${expiredCount > 0 ? 'border-red-200' : expiringCount > 0 ? 'border-amber-200' : 'border-slate-200'}`}>

      {/* ── Header row ── */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button onClick={() => setExpanded(v => !v)} className="flex-shrink-0">
          <IconChevron open={expanded} />
        </button>

        {/* Left: name + tags — clickable to expand */}
        <button onClick={() => setExpanded(v => !v)} className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <p className="text-xs font-semibold text-slate-800 truncate">{mat.material_name}</p>
            {mat.hsn_code && <span className="text-[9px] text-slate-400 font-mono whitespace-nowrap">{mat.hsn_code}</span>}
            {mat.gst_rate != null && <span className="text-[9px] text-blue-500 font-bold bg-blue-50 px-1 rounded whitespace-nowrap">{mat.gst_rate}%</span>}
            {expiredCount > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 whitespace-nowrap">{expiredCount} exp</span>}
            {expiringCount > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">⚠{expiringCount}</span>}
            {batchCount > 0 && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 whitespace-nowrap">{batchCount}B</span>}
            {/* Shelf life bar inline — only when collapsed */}
            {!expanded && nearestBatch && nearestBatch[1].expiry && (
              <ShelfLifeBar mfdDate={nearestBatch[1].mfd} expiryDate={nearestBatch[1].expiry} inline />
            )}
          </div>
        </button>

        {/* Right: stock info inline — all on one row */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          {netStock > 0 ? (
            <>
              <span className="text-xs font-bold text-slate-800 tabular-nums whitespace-nowrap">
                {fmtQty(netStock)}<span className="text-[10px] font-medium text-slate-500 ml-0.5">{unit ?? ''}</span>
              </span>
              {latestRate != null && (
                <span className="text-[10px] text-slate-400 tabular-nums whitespace-nowrap hidden sm:inline">@{fmt(latestRate)}</span>
              )}
              {totalValue > 0 && (
                <span className="text-[10px] font-semibold text-slate-600 tabular-nums whitespace-nowrap">{fmt(totalValue)}</span>
              )}
            </>
          ) : netStock === 0 && entries.length > 0 ? (
            <span className="text-[10px] text-red-400 font-semibold whitespace-nowrap">Out of stock</span>
          ) : (
            <span className="text-[10px] text-slate-300 whitespace-nowrap">no stock</span>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-1 border-l border-slate-100 pl-2">
            <button onClick={onAddStock} title="Add stock" className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center text-blue-600 hover:bg-blue-100 transition-colors"><IconPlus /></button>
            <button onClick={onEdit} title="Edit material" className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"><IconEdit /></button>
            {confirmDel ? (
              <div className="flex gap-1">
                <button onClick={() => setConfirmDel(false)} className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 font-semibold">No</button>
                <button onClick={onDelete} className="px-1.5 py-0.5 rounded text-[10px] bg-red-600 text-white font-semibold">Del</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDel(true)} className="w-6 h-6 rounded-md flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"><IconTrash /></button>
            )}
          </div>
        </div>
      </div>

      {/* ── Expanded section ── */}
      {expanded && (
        <div className="border-t border-slate-100">

          {/* Stats strip */}
          {(totalIn > 0 || totalOut > 0) && (
            <div className="flex gap-3 px-3 py-1.5 bg-slate-50/60 border-b border-slate-100 text-[10px] flex-wrap">
              {totalIn > 0 && <span className="text-slate-500">In: <strong className="text-emerald-700">{fmtQty(totalIn)} {unit}</strong></span>}
              {totalOut > 0 && <span className="text-slate-500">Out: <strong className="text-red-600">−{fmtQty(totalOut)} {unit}</strong></span>}
              <span className="text-slate-500">Net: <strong className={netStock <= 0 ? 'text-red-600' : 'text-slate-800'}>{fmtQty(netStock)} {unit}</strong></span>
              {totalValue > 0 && <span className="text-slate-500">Value: <strong className="text-slate-700">{fmt(totalValue)}</strong></span>}
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-slate-100">
            {(['batches', 'entries'] as CardTab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-1.5 text-[10px] font-bold capitalize transition-colors ${tab === t ? 'text-blue-600 border-b-2 border-blue-600 -mb-px' : 'text-slate-400 hover:text-slate-600'}`}>
                {t === 'batches' ? `Batches (${batchCount})` : `Entries (${entries.length})`}
              </button>
            ))}
          </div>

          {/* ── Batches tab: inline batch cards ── */}
          {tab === 'batches' && (
            <div className="px-3 py-2.5">
              <BatchesTable batches={batches} unit={unit} />
              <div className="flex gap-2 mt-3">
                <button onClick={onAddStock} className="flex-1 py-1.5 rounded-lg border border-dashed border-blue-300 text-[11px] font-bold text-blue-500 hover:bg-blue-50 transition-colors flex items-center justify-center gap-1">
                  <IconPlus /> Add Stock
                </button>
                <button onClick={() => onGiveSample()} className="flex-1 py-1.5 rounded-lg border border-dashed border-amber-300 text-[11px] font-bold text-amber-600 hover:bg-amber-50 transition-colors flex items-center justify-center gap-1">
                  🧪 Give Sample
                </button>
              </div>
            </div>
          )}

          {/* ── Entries tab ── */}
          {tab === 'entries' && (
            <div className="px-3 py-2">
              {entries.length === 0 ? (
                <p className="text-center text-[11px] text-slate-400 py-3">No stock entries</p>
              ) : (
                <div className="rounded-lg border border-slate-100 overflow-hidden">
                  <div className="grid text-[9px] font-bold text-slate-400 uppercase tracking-wide bg-slate-50 border-b border-slate-100" style={{ gridTemplateColumns: '68px 1fr 64px 56px 64px 72px' }}>
                    <div className="px-2 py-1.5">Date</div><div className="px-1.5 py-1.5">Source / Info</div>
                    <div className="px-1.5 py-1.5 text-right">Qty</div><div className="px-1.5 py-1.5 text-right">Rate</div>
                    <div className="px-1.5 py-1.5 text-right">Value</div><div className="px-1.5 py-1.5 text-right">Act.</div>
                  </div>
                  {[...entries].sort((a, b) => b.entry_date.localeCompare(a.entry_date)).map(e => (
                    <StockEntryRow key={e.id} entry={e} onEdit={() => onEditStock(e)} onDelete={() => onDeleteStock(e.id)} onGiveSample={() => onGiveSample(e)} />
                  ))}
                </div>
              )}
              <div className="flex gap-2 mt-2">
                <button onClick={onAddStock} className="flex-1 py-1.5 rounded-lg border border-dashed border-blue-300 text-[11px] font-bold text-blue-500 hover:bg-blue-50 transition-colors flex items-center justify-center gap-1">
                  <IconPlus /> Add Stock
                </button>
                <button onClick={() => onGiveSample()} className="flex-1 py-1.5 rounded-lg border border-dashed border-amber-300 text-[11px] font-bold text-amber-600 hover:bg-amber-50 transition-colors flex items-center justify-center gap-1">
                  🧪 Give Sample
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}


// ── Excel Download Helpers ────────────────────────────────────────────────────
function downloadStockSummary(materials: Material[], stockEntries: StockEntry[]) {
  const rows: unknown[][] = [
    ['Material Name', 'HSN Code', 'GST %', 'Net Stock', 'Unit', 'Total In', 'Total Out', 'Latest Rate (₹)', 'Stock Value (₹)', 'Batches', 'Expiring Batches', 'Expired Batches']
  ]
  materials.forEach(mat => {
    const entries = stockEntries.filter(e => e.material_id === mat.id)
    const totalIn  = entries.reduce((s, e) => e.quantity > 0 ? s + e.quantity : s, 0)
    const totalOut = entries.reduce((s, e) => e.quantity < 0 ? s + Math.abs(e.quantity) : s, 0)
    const netStock = entries.reduce((s, e) => s + e.quantity, 0)
    const latestEntry = [...entries].sort((a, b) => b.entry_date.localeCompare(a.entry_date))[0]
    const latestRate  = latestEntry?.rate ?? null
    const unit        = latestEntry?.unit ?? null
    const totalValue  = entries.reduce((s, e) => e.quantity > 0 && e.rate != null ? s + (e.quantity * e.rate) : s, 0)
    const batchMap: Record<string, { qty: number; expiry: string | null }> = {}
    entries.forEach(e => {
      const key = e.batch_number ?? '—'
      if (!batchMap[key]) batchMap[key] = { qty: 0, expiry: e.expiry_date }
      batchMap[key].qty += e.quantity
      if (e.expiry_date && !batchMap[key].expiry) batchMap[key].expiry = e.expiry_date
    })
    const batches = Object.entries(batchMap)
    const expiringCount = batches.filter(([, b]) => { const d = daysTo(b.expiry); return d !== null && d < 90 && d >= 0 }).length
    const expiredCount  = batches.filter(([, b]) => { const d = daysTo(b.expiry); return d !== null && d < 0 }).length
    rows.push([
      mat.material_name, mat.hsn_code ?? '', mat.gst_rate ?? '',
      netStock, unit ?? '', totalIn, totalOut,
      latestRate ?? '', totalValue > 0 ? totalValue.toFixed(2) : '',
      batches.length, expiringCount, expiredCount
    ])
  })
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 32 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 9 }, { wch: 14 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Stock Summary')
  XLSX.writeFile(wb, `stock-summary-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

function downloadItemSummary(materials: Material[], stockEntries: StockEntry[]) {
  const rows: unknown[][] = [
    ['Material Name', 'Batch No.', 'Supplier', 'Entry Date', 'Qty', 'Unit', 'Rate (₹)', 'Value (₹)', 'Mfg Date', 'Expiry Date', 'Invoice No.', 'Notes']
  ]
  materials.forEach(mat => {
    const entries = stockEntries.filter(e => e.material_id === mat.id)
    const sorted = [...entries].sort((a, b) => b.entry_date.localeCompare(a.entry_date))
    sorted.forEach(e => {
      rows.push([
        mat.material_name,
        e.batch_number ?? '',
        e.supplier_name ?? '',
        e.entry_date,
        e.quantity,
        e.unit ?? '',
        e.rate ?? '',
        e.rate != null ? (Math.abs(e.quantity) * e.rate).toFixed(2) : '',
        e.mfd_date ?? '',
        e.expiry_date ?? '',
        e.invoice_number ?? '',
        e.notes ?? '',
      ])
    })
  })
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 32 }, { wch: 14 }, { wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 24 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Item Detail')
  XLSX.writeFile(wb, `item-summary-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

// ── Main ──────────────────────────────────────────────────────────────────────
type SortMode =
  | 'name_az'      | 'name_za'
  | 'expiry_soon'  | 'expiry_late'
  | 'qty_high'     | 'qty_low'
  | 'value_high'   | 'value_low'
  | 'rate_high'    | 'rate_low'
  | 'batches_most' | 'batches_least'

const SORT_OPTIONS: { value: SortMode; label: string; desc: string }[] = [
  { value: 'name_az',       label: 'Name A → Z',          desc: 'Alphabetical ascending'          },
  { value: 'name_za',       label: 'Name Z → A',          desc: 'Alphabetical descending'         },
  { value: 'expiry_soon',   label: 'Expiry: Soonest First', desc: 'Nearest expiry date at top'    },
  { value: 'expiry_late',   label: 'Expiry: Latest First',  desc: 'Furthest expiry date at top'   },
  { value: 'qty_high',      label: 'Qty: Highest First',   desc: 'Most stock quantity at top'      },
  { value: 'qty_low',       label: 'Qty: Lowest First',    desc: 'Least stock quantity at top'     },
  { value: 'value_high',    label: 'Value: Highest First', desc: 'Highest stock value at top'      },
  { value: 'value_low',     label: 'Value: Lowest First',  desc: 'Lowest stock value at top'       },
  { value: 'rate_high',     label: 'Rate: Highest First',  desc: 'Highest unit rate at top'        },
  { value: 'rate_low',      label: 'Rate: Lowest First',   desc: 'Lowest unit rate at top'         },
  { value: 'batches_most',  label: 'Most Batches',         desc: 'Most batch entries at top'       },
  { value: 'batches_least', label: 'Fewest Batches',       desc: 'Fewest batch entries at top'     },
]

export default function MaterialsSection({
  materials, stockEntries, loading,
  onAddMaterial, onUpdateMaterial, onDeleteMaterial,
  onAddStock, onUpdateStock, onDeleteStock,
}: Props) {
  const [search, setSearch]               = useState('')
  const [sortMode, setSortMode]           = useState<SortMode>('name_az')
  const [showSortDrop, setShowSortDrop]   = useState(false)
  const [addMatOpen, setAddMatOpen]       = useState(false)
  const [editMat, setEditMat]             = useState<Material | null>(null)
  const [stockDrawer, setStockDrawer]     = useState<{ matId?: string } | null>(null)
  const [editStockEntry, setEditStockEntry] = useState<StockEntry | null>(null)
  const [giveSampleFor, setGiveSampleFor] = useState<{ mat: Material; entry?: StockEntry } | null>(null)
  const [showDlDrop, setShowDlDrop]       = useState(false)
  const dlRef                             = useRef<HTMLDivElement>(null)

  // ── Summary stats ──
  const totalValue = stockEntries.reduce((s, e) => {
    if (e.quantity > 0 && e.rate != null) return s + (e.quantity * e.rate)
    return s
  }, 0)

  // Expired stock value: entries where expiry_date < today and quantity > 0
  const expiredValue = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    // Group by material+batch to get net qty per batch, then value expired batches
    const batchMap: Record<string, { qty: number; expiry: string | null; rate: number | null }> = {}
    stockEntries.forEach(e => {
      const key = `${e.material_id}__${e.batch_number ?? '—'}`
      if (!batchMap[key]) batchMap[key] = { qty: 0, expiry: e.expiry_date, rate: e.rate }
      batchMap[key].qty += e.quantity
      if (e.expiry_date && !batchMap[key].expiry) batchMap[key].expiry = e.expiry_date
      if (e.rate != null && batchMap[key].rate == null) batchMap[key].rate = e.rate
    })
    return Object.values(batchMap).reduce((s, b) => {
      if (b.qty > 0 && b.expiry && b.expiry < today && b.rate != null) return s + b.qty * b.rate
      return s
    }, 0)
  }, [stockEntries])

  const withStock = materials.filter(m => {
    const net = stockEntries.filter(e => e.material_id === m.id).reduce((s, e) => s + e.quantity, 0)
    return net > 0
  }).length

  const expiringMats = useMemo(() => new Set(
    stockEntries.filter(e => { const d = daysTo(e.expiry_date); return d !== null && d < 90 && d >= 0 }).map(e => e.material_id)
  ), [stockEntries])

  const filtered = useMemo(() => {
    let list = materials
    const q = search.trim().toLowerCase()
    if (q) list = list.filter(m => m.material_name.toLowerCase().includes(q) || (m.hsn_code ?? '').toLowerCase().includes(q))

    // Build quick-lookup maps for sort
    const netQtyMap: Record<string, number> = {}
    const valueMap:  Record<string, number> = {}
    const rateMap:   Record<string, number | null> = {}
    const expiryMap: Record<string, string | null> = {}
    const batchesMap: Record<string, number> = {}

    list.forEach(m => {
      const entries = stockEntries.filter(e => e.material_id === m.id)
      netQtyMap[m.id] = entries.reduce((s, e) => s + e.quantity, 0)
      valueMap[m.id]  = entries.reduce((s, e) => e.quantity > 0 && e.rate != null ? s + e.quantity * e.rate : s, 0)
      const latest    = [...entries].sort((a, b) => b.entry_date.localeCompare(a.entry_date))[0]
      rateMap[m.id]   = latest?.rate ?? null
      // Earliest expiry for this material (only future/current batches)
      const batchMap: Record<string, { qty: number; expiry: string | null }> = {}
      entries.forEach(e => {
        const k = e.batch_number ?? '—'
        if (!batchMap[k]) batchMap[k] = { qty: 0, expiry: e.expiry_date }
        batchMap[k].qty += e.quantity
        if (e.expiry_date && !batchMap[k].expiry) batchMap[k].expiry = e.expiry_date
      })
      const activeBatches = Object.values(batchMap).filter(b => b.qty > 0)
      const expiries = activeBatches.map(b => b.expiry).filter(Boolean) as string[]
      expiryMap[m.id] = expiries.length ? expiries.sort()[0] : null
      batchesMap[m.id] = Object.keys(batchMap).length
    })

    const sorted = [...list].sort((a, b) => {
      switch (sortMode) {
        case 'name_az':       return a.material_name.localeCompare(b.material_name)
        case 'name_za':       return b.material_name.localeCompare(a.material_name)
        case 'expiry_soon': {
          const ea = expiryMap[a.id], eb = expiryMap[b.id]
          if (!ea && !eb) return 0
          if (!ea) return 1
          if (!eb) return -1
          return ea.localeCompare(eb)
        }
        case 'expiry_late': {
          const ea = expiryMap[a.id], eb = expiryMap[b.id]
          if (!ea && !eb) return 0
          if (!ea) return 1
          if (!eb) return -1
          return eb.localeCompare(ea)
        }
        case 'qty_high':      return (netQtyMap[b.id] ?? 0) - (netQtyMap[a.id] ?? 0)
        case 'qty_low':       return (netQtyMap[a.id] ?? 0) - (netQtyMap[b.id] ?? 0)
        case 'value_high':    return (valueMap[b.id] ?? 0) - (valueMap[a.id] ?? 0)
        case 'value_low':     return (valueMap[a.id] ?? 0) - (valueMap[b.id] ?? 0)
        case 'rate_high':     return ((rateMap[b.id] ?? -1)) - ((rateMap[a.id] ?? -1))
        case 'rate_low': {
          const ra = rateMap[a.id], rb = rateMap[b.id]
          if (ra == null && rb == null) return 0
          if (ra == null) return 1
          if (rb == null) return -1
          return ra - rb
        }
        case 'batches_most':  return (batchesMap[b.id] ?? 0) - (batchesMap[a.id] ?? 0)
        case 'batches_least': return (batchesMap[a.id] ?? 0) - (batchesMap[b.id] ?? 0)
        default: return 0
      }
    })
    return sorted
  }, [materials, search, expiringMats, stockEntries, sortMode])

  if (loading) return <div className="text-center py-12 text-slate-400 text-sm">Loading inventory…</div>

  return (
    <div className="flex flex-col gap-2.5 pb-4 px-3 sm:px-0">
      {/* Toolbar: desktop = search + buttons on one row; mobile = search then buttons below */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="relative sm:flex-1">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search material or HSN…"
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-300" />
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:flex-shrink-0">

        {/* Sort dropdown */}
        <div className="relative">
          <button onClick={() => setShowSortDrop(v => !v)}
            className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap border ${sortMode !== 'name_az' ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"/></svg>
            Sort
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7"/></svg>
          </button>
          {showSortDrop && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowSortDrop(false)} />
              <div className="absolute right-0 top-full mt-1.5 z-40 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden w-60">
                <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sort By</p>
                  {sortMode !== 'name_az' && (
                    <button onClick={() => { setSortMode('name_az'); setShowSortDrop(false) }}
                      className="text-[10px] text-blue-600 font-semibold hover:underline">Reset</button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {SORT_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => { setSortMode(opt.value); setShowSortDrop(false) }}
                      className={`w-full text-left px-4 py-2.5 transition-colors flex items-center justify-between gap-2 ${sortMode === opt.value ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                      <div>
                        <p className={`text-xs font-semibold ${sortMode === opt.value ? 'text-blue-700' : 'text-slate-700'}`}>{opt.label}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</p>
                      </div>
                      {sortMode === opt.value && (
                        <svg className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Download Excel dropdown */}
        <div className="relative" ref={dlRef}>
          <button onClick={() => setShowDlDrop(v => !v)}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors whitespace-nowrap">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            Excel
            <svg className="w-2.5 h-2.5 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7"/></svg>
          </button>
          {showDlDrop && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowDlDrop(false)} />
              <div className="absolute right-0 top-full mt-1.5 z-40 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden w-52">
                <button onClick={() => { downloadStockSummary(materials, stockEntries); setShowDlDrop(false) }}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors">
                  <p className="text-xs font-bold text-slate-800">Stock Summary</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">One row per material with totals</p>
                </button>
                <div className="border-t border-slate-100" />
                <button onClick={() => { downloadItemSummary(materials, stockEntries); setShowDlDrop(false) }}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors">
                  <p className="text-xs font-bold text-slate-800">Item Detail</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Every stock entry with batch info</p>
                </button>
              </div>
            </>
          )}
        </div>
        <button onClick={() => setStockDrawer({})} className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-700 text-white text-xs font-bold hover:bg-slate-800 transition-colors whitespace-nowrap"><IconPlus /> Stock</button>
        <button onClick={() => setAddMatOpen(true)} className="flex items-center gap-1 px-3 py-2 rounded-xl bg-blue-700 text-white text-xs font-bold hover:bg-blue-800 transition-colors whitespace-nowrap">+ Mat</button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 text-[11px] text-slate-400 px-0.5 flex-wrap">
        <span><strong className="text-slate-600">{materials.length}</strong> materials</span>
        <span><strong className="text-slate-600">{withStock}</strong> in stock</span>
        {totalValue > 0 && <span>Value: <strong className="text-slate-600">{fmt(totalValue)}</strong></span>}
        {expiredValue > 0 && <span className="text-red-500 font-semibold">Expired: {fmt(expiredValue)}</span>}
        {expiringMats.size > 0 && <span className="text-amber-600 font-semibold">⚠ {expiringMats.size} expiring</span>}
        {sortMode !== 'name_az' && (
          <span className="text-blue-600 font-semibold text-[10px]">
            ↕ {SORT_OPTIONS.find(o => o.value === sortMode)?.label}
          </span>
        )}
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-14 text-center">
          <p className="text-slate-400 text-sm">{search ? 'No materials match' : 'No materials yet'}</p>
          {!search && <button onClick={() => setAddMatOpen(true)} className="mt-3 px-4 py-2 rounded-xl bg-blue-700 text-white text-xs font-bold hover:bg-blue-800">Add First Material</button>}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {filtered.map(mat => (
            <MaterialCard key={mat.id} mat={mat}
              entries={stockEntries.filter(e => e.material_id === mat.id)}
              onAddStock={() => setStockDrawer({ matId: mat.id })}
              onEditStock={e => setEditStockEntry(e)}
              onDeleteStock={onDeleteStock}
              onGiveSample={(entry) => setGiveSampleFor({ mat, entry })}
              onEdit={() => setEditMat(mat)}
              onDelete={async () => { await onDeleteMaterial(mat.id) }}
            />
          ))}
        </div>
      )}

      {/* Drawers */}
      {addMatOpen && <MaterialFormDrawer onClose={() => setAddMatOpen(false)} onSubmit={async m => { await onAddMaterial(m); setAddMatOpen(false) }} />}
      {editMat && <MaterialFormDrawer editMaterial={editMat} onClose={() => setEditMat(null)} onSubmit={async m => { await onUpdateMaterial(editMat.id, m); setEditMat(null) }} />}
      {stockDrawer && <StockDrawer materials={materials} defaultMaterialId={stockDrawer.matId} onClose={() => setStockDrawer(null)} onSubmit={async s => { await onAddStock(s); setStockDrawer(null) }} />}
      {editStockEntry && <StockDrawer materials={materials} editEntry={editStockEntry} onClose={() => setEditStockEntry(null)} onSubmit={async s => { await onUpdateStock(editStockEntry.id, s); setEditStockEntry(null) }} />}
      {giveSampleFor && (
        <GiveSampleDrawer
          mat={giveSampleFor.mat}
          prefillEntry={giveSampleFor.entry ?? null}
          defaultUnit={stockEntries.find(e => e.material_id === giveSampleFor.mat.id)?.unit ?? null}
          onClose={() => setGiveSampleFor(null)}
          onSubmit={async s => { await onAddStock(s); setGiveSampleFor(null) }}
        />
      )}
    </div>
  )
}