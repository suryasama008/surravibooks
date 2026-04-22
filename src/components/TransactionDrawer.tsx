'use client'

import React, { useState, useEffect } from 'react'
import { Transaction, TransactionInput, TransactionMode, Contact } from '@/types'
import {
  ACCOUNTS,
  SEND_CATEGORIES, SEND_SUB_CATEGORIES,
  RECEIVE_CATEGORIES, RECEIVE_SUB_CATEGORIES,
  EXPENSE_CATEGORIES, EXPENSE_SUB_CATEGORIES,
  PAYMENT_MODES,
} from '@/lib/constants'

interface Props {
  open: boolean
  initialMode?: TransactionMode
  editTransaction?: Transaction | null
  contacts: Contact[]
  onClose: () => void
  onSubmit: (tx: TransactionInput) => Promise<void>
  onUpdate?: (id: string, tx: TransactionInput) => Promise<void>
  onAddContact?: (name: string, type: 'supplier' | 'customer') => Promise<Contact | null>
}

const MODE_CONFIG = {
  send: {
    label: 'Send',
    icon: '↑',
    accent: '#dc2626',
    bg: 'bg-red-600',
    bgLight: 'bg-red-50',
    sign: '−',
    typeDB: 'expense' as const,
    placeholder: 'Supplier payment, advance…',
    categories: SEND_CATEGORIES,
    subCategories: SEND_SUB_CATEGORIES,
  },
  receive: {
    label: 'Receive',
    icon: '↓',
    accent: '#059669',
    bg: 'bg-emerald-600',
    bgLight: 'bg-emerald-50',
    sign: '+',
    typeDB: 'income' as const,
    placeholder: 'Customer payment, collection…',
    categories: RECEIVE_CATEGORIES,
    subCategories: RECEIVE_SUB_CATEGORIES,
  },
  expense: {
    label: 'Expense',
    icon: '+',
    accent: '#7c3aed',
    bg: 'bg-violet-600',
    bgLight: 'bg-violet-50',
    sign: '−',
    typeDB: 'expense' as const,
    placeholder: 'Rent, fuel, salary…',
    categories: EXPENSE_CATEGORIES,
    subCategories: EXPENSE_SUB_CATEGORIES,
  },
}

export default function TransactionDrawer({
  open, initialMode = 'expense', editTransaction, onClose, onSubmit, onUpdate,
}: Props) {
  const today = new Date().toISOString().split('T')[0]
  const isEdit = !!editTransaction

  // Format number with Indian commas for display
  function formatWithCommas(val: string): string {
    const digits = val.replace(/[^0-9.]/g, '')
    const parts = digits.split('.')
    const num = parseFloat(digits)
    if (isNaN(num)) return digits
    return num.toLocaleString('en-IN', { maximumFractionDigits: parts[1] !== undefined ? parts[1].length : 0 }) + (digits.endsWith('.') ? '.' : '')
  }

  const [mode, setMode] = useState<TransactionMode>(initialMode)
  const [amount, setAmount] = useState('')
  const [amountDisplay, setAmountDisplay] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(today)
  const [account, setAccount] = useState('SBI')
  const [category, setCategory] = useState('')
  const [subCategory, setSubCategory] = useState('')
  const [paymentMode, setPaymentMode] = useState('PhonePe')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const cfg = MODE_CONFIG[mode]

  useEffect(() => {
    if (open && editTransaction) {
      const m = (editTransaction.mode as TransactionMode) ||
        (editTransaction.type === 'income' ? 'receive' : 'expense')
      setMode(m)
      setAmount(editTransaction.amount.toString())
      setAmountDisplay(editTransaction.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 }))
      setDescription(editTransaction.description || '')
      setDate(editTransaction.date)
      setAccount(editTransaction.account)
      setCategory(editTransaction.category || '')
      setSubCategory(editTransaction.sub_category || '')
      setPaymentMode(editTransaction.payment_mode || 'PhonePe')
      setNotes(editTransaction.notes || '')
    } else if (open && !editTransaction) {
      setMode(initialMode)
      setCategory('')
      setSubCategory(initialMode === 'send' ? 'Advance Vendor Payment' : initialMode === 'receive' ? 'Advance Customer Payment' : '')
    }
  }, [open, editTransaction, initialMode])

  const reset = () => {
    setAmount(''); setAmountDisplay(''); setDescription(''); setDate(today)
    setAccount('SBI'); setCategory(''); setSubCategory('')
    setPaymentMode('PhonePe'); setNotes('')
  }

  const handleClose = () => { reset(); onClose() }

  const handleModeChange = (m: TransactionMode) => {
    setMode(m); setCategory(''); setSubCategory('')
    if (m === 'send') setSubCategory('Advance Vendor Payment')
    if (m === 'receive') setSubCategory('Advance Customer Payment')
  }

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) return
    setSaving(true)
    const payload: TransactionInput = {
      date,
      type: cfg.typeDB,
      mode,
      account,
      amount: parseFloat(amount),
      category:     category    || undefined,
      sub_category: subCategory || (mode === 'send' ? 'Advance Vendor Payment' : mode === 'receive' ? 'Advance Customer Payment' : undefined),
      description:  description || undefined,
      payment_mode: paymentMode || undefined,
      notes:        notes       || undefined,
      contact_id:   null,
      company_name: null,
    }
    if (isEdit && onUpdate && editTransaction && editTransaction.id) {
      await onUpdate(editTransaction.id, payload)
    } else {
      await onSubmit(payload)
    }
    setSaving(false)
    reset()
  }

  if (!open) return null

  // Sub-category options per mode
  const BUSINESS_SUBCATS: Record<string, string[]> = {
    send:    ['HandLoan Paid', ' Internal Transfer', 'Other'],
    receive: ['HandLoan Recieved','Internal Transfer', 'Other'],
  }
  const subCats = (mode === 'send' || mode === 'receive')
    ? BUSINESS_SUBCATS[mode]
    : (category ? (cfg.subCategories[category] || []) : [])

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 transition-opacity" onClick={handleClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-md max-h-[88vh] flex flex-col shadow-2xl">

          {/* Header */}
          <div className="px-4 pt-4 pb-3 flex-shrink-0 border-b border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-sm text-slate-800">{isEdit ? '✏️ Edit Entry' : 'New Entry'}</span>
              <button onClick={handleClose} className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Mode selector */}
            <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
              {(['send', 'receive', 'expense'] as TransactionMode[]).map(m => {
                const c = MODE_CONFIG[m]
                const active = mode === m
                return (
                  <button key={m} onClick={() => handleModeChange(m)}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg font-bold text-xs transition-all
                      ${active ? c.bg + ' text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}>
                    <span className="font-mono text-sm leading-none">{c.icon}</span>
                    {c.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 px-4 py-3">

            {/* Amount */}
            <div className="text-center py-3 mb-2">
              <div className="inline-flex items-baseline gap-1">
                <span className="text-xl font-light" style={{ color: cfg.accent }}>{cfg.sign} ₹</span>
                <input
                  type="text" inputMode="decimal" value={amountDisplay}
                  onChange={e => {
                    const raw = e.target.value.replace(/,/g, '')
                    if (/^\d*\.?\d*$/.test(raw)) {
                      setAmount(raw)
                      setAmountDisplay(raw === '' ? '' : formatWithCommas(raw))
                    }
                  }}
                  placeholder="0"
                  className="text-4xl font-light bg-transparent border-none outline-none w-40 tracking-tight"
                  style={{ color: cfg.accent, caretColor: cfg.accent }}
                />
              </div>
              <div className="h-px w-20 mx-auto mt-1.5 rounded-full opacity-30" style={{ background: cfg.accent }} />
            </div>

            {/* Description */}
            <input
              type="text" placeholder={cfg.placeholder}
              value={description} onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-blue-400 focus:bg-white transition-colors mb-3"
            />

            {/* Account */}
            <TagSection label="Account" items={ACCOUNTS} selected={account}
              onSelect={v => setAccount(v || 'ICICI')} accent={cfg.accent} />

            {/* Category */}
            <TagSection label="Category" items={cfg.categories} selected={category}
              onSelect={v => { setCategory(v); setSubCategory('') }} accent={cfg.accent} />

            {/* Sub-category */}
            {subCats.length > 0 && (
              <TagSection label="Sub-Category" items={subCats} selected={subCategory}
                onSelect={setSubCategory} accent={cfg.accent}
                chipClass="bg-sky-50 text-sky-700 border border-sky-200" />
            )}

            {/* Payment Mode */}
            <TagSection label="Payment Mode" items={PAYMENT_MODES} selected={paymentMode}
              onSelect={v => setPaymentMode(v || 'PhonePe')} accent={cfg.accent}
              chipClass="bg-emerald-50 text-emerald-700 border border-emerald-200" />

            <hr className="my-2.5 border-slate-100" />

            {/* Date + Notes */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-blue-400 transition-colors" />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Notes / Ref No.</label>
                <input type="text" placeholder="UTR / cheque no. / memo" value={notes} onChange={e => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-blue-400 transition-colors" />
              </div>
            </div>
          </div>

          {/* Save button */}
          <div className="px-4 pt-2.5 pb-4 border-t border-slate-100 flex-shrink-0">
            <button
              onClick={handleSubmit}
              disabled={!amount || parseFloat(amount) <= 0 || saving}
              className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ background: !amount || parseFloat(amount) <= 0 || saving ? '#94a3b8' : cfg.accent }}
            >
              {saving ? <><Spinner /> Saving…</> : isEdit ? 'Update Entry' : `Save ${cfg.label}`}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function TagSection({ label, items, selected, onSelect, accent, chipClass }: {
  label: string; items: string[]; selected: string
  onSelect: (v: string) => void; accent: string; chipClass?: string
}) {
  return (
    <div className="mb-4">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map(item => {
          const isSel = selected === item
          return (
            <button key={item} onClick={() => onSelect(isSel ? '' : item)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-all
                ${isSel ? 'text-white shadow-sm' : chipClass ?? 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              style={isSel ? { background: accent } : {}}>
              {item}
            </button>
          )
        })}
      </div>
    </div>
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
