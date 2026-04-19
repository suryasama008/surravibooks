'use client'

import React, { useState, useEffect } from 'react'
import { BizTransaction, BizTransactionType, Contact } from '@/types'

interface Props {
  open: boolean
  contacts: Contact[]
  editTx?: BizTransaction | null
  onClose: () => void
  onSubmit: (data: Omit<BizTransaction, 'id' | 'created_at'>) => Promise<void>
}

const BIZ_TYPES: { value: BizTransactionType; label: string; icon: string; color: string }[] = [
  { value: 'send',       label: 'Send',       icon: '↑', color: 'bg-red-600' },
  { value: 'receive',    label: 'Receive',     icon: '↓', color: 'bg-emerald-600' },
  { value: 'to_receive', label: 'To Receive',  icon: '⏳', color: 'bg-amber-500' },
  { value: 'to_pay',     label: 'To Pay',      icon: '⏳', color: 'bg-violet-600' },
]

export default function BizTransactionDrawer({ open, contacts, editTx, onClose, onSubmit }: Props) {
  const today = new Date().toISOString().split('T')[0]
  const [bizType, setBizType]       = useState<BizTransactionType>('receive')
  const [contactId, setContactId]   = useState<string>('')
  const [companyName, setCompanyName] = useState('')
  const [gstNumber, setGstNumber]   = useState('')
  const [amount, setAmount]         = useState('')
  const [notes, setNotes]           = useState('')
  const [date, setDate]             = useState(today)
  const [saving, setSaving]         = useState(false)
  const [useContact, setUseContact] = useState(false)

  useEffect(() => {
    if (open && editTx) {
      setBizType(editTx.biz_type)
      setContactId(editTx.contact_id || '')
      setCompanyName(editTx.company_name)
      setGstNumber(editTx.gst_number || '')
      setAmount(editTx.amount.toString())
      setNotes(editTx.notes || '')
      setDate(editTx.date)
      setUseContact(!!editTx.contact_id)
    }
  }, [open, editTx])

  // When contact selected, fill company/GST
  useEffect(() => {
    if (contactId) {
      const c = contacts.find(c => c.id === contactId)
      if (c) { setCompanyName(c.company_name); setGstNumber(c.gst_number || '') }
    }
  }, [contactId, contacts])

  const reset = () => {
    setBizType('receive'); setContactId(''); setCompanyName(''); setGstNumber('')
    setAmount(''); setNotes(''); setDate(today); setUseContact(false)
  }

  const handleClose = () => { reset(); onClose() }

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0 || !companyName) return
    setSaving(true)
    await onSubmit({
      biz_type: bizType,
      contact_id: contactId || null,
      company_name: companyName,
      gst_number: gstNumber || null,
      amount: parseFloat(amount),
      notes: notes || null,
      date,
      status: 'pending',
    })
    setSaving(false)
    reset()
  }

  const selectedType = BIZ_TYPES.find(b => b.value === bizType)!

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={handleClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl max-h-[90vh] flex flex-col shadow-2xl drawer-slide-up">

        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-9 h-1 bg-slate-300 rounded-full" />
        </div>

        <div className="px-5 pb-3 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-base text-slate-800">Business Entry</span>
            <button onClick={handleClose} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Type selector */}
          <div className="grid grid-cols-4 gap-1.5">
            {BIZ_TYPES.map(bt => (
              <button key={bt.value} onClick={() => setBizType(bt.value)}
                className={`flex flex-col items-center py-2 rounded-xl text-xs font-bold transition-all
                  ${bizType === bt.value ? bt.color + ' text-white shadow' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                <span className="text-base mb-0.5">{bt.icon}</span>
                {bt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-5 pb-2">

          {/* Amount */}
          <div className="text-center py-4 mb-2">
            <div className="inline-flex items-baseline gap-1">
              <span className="text-2xl font-light text-slate-500">₹</span>
              <input
                type="number" inputMode="decimal" value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="text-5xl font-light bg-transparent border-none outline-none w-44 tracking-tight text-slate-700"
              />
            </div>
            <div className="h-px w-24 mx-auto mt-2 bg-slate-300 rounded-full opacity-50" />
          </div>

          {/* Contact toggle */}
          <div className="flex items-center gap-2 mb-3">
            <button onClick={() => setUseContact(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors
                ${useContact ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
              👤 Pick from Contacts
            </button>
          </div>

          {useContact && contacts.length > 0 && (
            <div className="mb-3">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Contact</label>
              <select value={contactId} onChange={e => setContactId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-blue-400">
                <option value="">Select contact…</option>
                {contacts.map(c => (
                  <option key={c.id} value={c.id}>{c.company_name} ({c.contact_type})</option>
                ))}
              </select>
            </div>
          )}

          {/* Company name */}
          <div className="mb-3">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Company Name *</label>
            <input type="text" placeholder="Company / Party name"
              value={companyName} onChange={e => setCompanyName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-blue-400" />
          </div>

          {/* GST number */}
          <div className="mb-3">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">GST Number</label>
            <input type="text" placeholder="22AAAAA0000A1Z5"
              value={gstNumber} onChange={e => setGstNumber(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-blue-400 font-mono" />
          </div>

          {/* Date + Notes */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-blue-400" />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Notes</label>
              <input type="text" placeholder="Reference / memo"
                value={notes} onChange={e => setNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-blue-400" />
            </div>
          </div>
        </div>

        <div className="px-5 pt-3 pb-6 border-t border-slate-100 flex-shrink-0">
          <button
            onClick={handleSubmit}
            disabled={!amount || parseFloat(amount) <= 0 || !companyName || saving}
            className={`w-full py-4 rounded-xl font-bold text-white text-base transition-all disabled:opacity-40 flex items-center justify-center gap-2 ${selectedType.color}`}
          >
            {saving ? <Spinner /> : null}
            {saving ? 'Saving…' : `Save ${selectedType.label}`}
          </button>
        </div>
      </div>
    </>
  )
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}
