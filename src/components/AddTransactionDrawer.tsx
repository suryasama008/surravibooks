'use client'

import React, { useState, useEffect } from 'react'
import { Transaction, TransactionInput, TransactionType } from '@/types'
import { ACCOUNTS, INCOME_CATEGORIES, EXPENSE_CATEGORIES, SUB_CATEGORIES, PAYMENT_MODES } from '@/lib/constants'

interface Props {
  open: boolean
  initialType?: TransactionType
  editTransaction?: Transaction | null   // if set, we are editing
  onClose: () => void
  onSubmit: (tx: TransactionInput) => Promise<void>
  onUpdate?: (id: string, tx: TransactionInput) => Promise<void>
}

export default function AddTransactionDrawer({ open, initialType = 'expense', editTransaction, onClose, onSubmit, onUpdate }: Props) {
  const today = new Date().toISOString().split('T')[0]
  const isEdit = !!editTransaction

  const [type, setType]             = useState<TransactionType>(initialType)
  const [amount, setAmount]         = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate]             = useState(today)
  const [account, setAccount]       = useState('ICICI')
  const [category, setCategory]     = useState('')
  const [subCategory, setSubCategory] = useState('')
  const [paymentMode, setPaymentMode] = useState('PhonePe')
  const [notes, setNotes]           = useState('')
  const [saving, setSaving]         = useState(false)

  // When editing, pre-fill form
  useEffect(() => {
    if (open && editTransaction) {
      setType(editTransaction.type)
      setAmount(editTransaction.amount.toString())
      setDescription(editTransaction.description || '')
      setDate(editTransaction.date)
      setAccount(editTransaction.account)
      setCategory(editTransaction.category || '')
      setSubCategory(editTransaction.sub_category || '')
      setPaymentMode(editTransaction.payment_mode || 'PhonePe')
      setNotes(editTransaction.notes || '')
    } else if (open && !editTransaction) {
      setType(initialType)
    }
  }, [open, editTransaction, initialType])

  const reset = () => {
    setAmount(''); setDescription(''); setDate(today)
    setAccount('ICICI'); setCategory(''); setSubCategory('')
    setPaymentMode('PhonePe'); setNotes('')
  }

  const handleClose = () => { reset(); onClose() }

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) return
    setSaving(true)
    const payload: TransactionInput = {
      date, type, account, amount: parseFloat(amount),
      category:     category     || undefined,
      sub_category: subCategory  || undefined,
      description:  description  || undefined,
      payment_mode: paymentMode  || undefined,
      notes:        notes        || undefined,
    }
    if (isEdit && onUpdate && editTransaction) {
      await onUpdate(editTransaction.id, payload)
    } else {
      await onSubmit(payload)
    }
    setSaving(false)
    reset()
  }

  const isIncome = type === 'income'
  const accent   = isIncome ? '#059669' : '#dc2626'

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40 transition-opacity" onClick={handleClose} />

      {/* Drawer */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl max-h-[94vh] flex flex-col drawer-slide-up shadow-2xl">

        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-9 h-1 bg-slate-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 pb-3 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-base text-slate-800">{isEdit ? '✏️ Edit Entry' : 'New Entry'}</span>
            <button onClick={handleClose} className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Income / Expense toggle */}
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
            {(['income', 'expense'] as TransactionType[]).map(t => (
              <button key={t} onClick={() => { setType(t); setCategory(''); setSubCategory('') }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-bold text-sm transition-all
                  ${type === t
                    ? t === 'income' ? 'bg-emerald-600 text-white shadow' : 'bg-red-600 text-white shadow'
                    : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t === 'income'
                  ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                  : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
                }
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 pb-2">

          {/* Amount */}
          <div className="text-center py-4 mb-2">
            <div className="inline-flex items-baseline gap-1">
              <span className="text-2xl font-light" style={{ color: accent }}>{isIncome ? '+' : '−'} ₹</span>
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="text-5xl font-light bg-transparent border-none outline-none w-44 tracking-tight"
                style={{ color: accent, caretColor: accent }}
              />
            </div>
            <div className="h-px w-24 mx-auto mt-2 rounded-full opacity-30" style={{ background: accent }} />
          </div>

          {/* Description */}
          <input
            type="text"
            placeholder="What's this for? (description)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-blue-400 focus:bg-white transition-colors mb-4"
          />

          {/* Account */}
          <TagSection label="Account" items={ACCOUNTS} selected={account}
            onSelect={v => setAccount(v || 'ICICI')} accent={accent} />

          {/* Category */}
          <TagSection label="Category" items={isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES} selected={category}
            onSelect={v => { setCategory(v); setSubCategory('') }} accent={accent} />

          {/* Sub-category */}
          {category && (SUB_CATEGORIES[category]?.length ?? 0) > 0 && (
            <TagSection label="Sub-Category" items={SUB_CATEGORIES[category]} selected={subCategory}
              onSelect={setSubCategory} accent={accent}
              chipClass="bg-sky-50 text-sky-700 border border-sky-200" />
          )}

          {/* Payment Mode */}
          <TagSection label="Payment Mode" items={PAYMENT_MODES} selected={paymentMode}
            onSelect={v => setPaymentMode(v || 'PhonePe')} accent={accent}
            chipClass="bg-emerald-50 text-emerald-700 border border-emerald-200" />

          <hr className="my-3 border-slate-100" />

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
        <div className="px-5 pt-3 pb-6 border-t border-slate-100 flex-shrink-0">
          <button
            onClick={handleSubmit}
            disabled={!amount || parseFloat(amount) <= 0 || saving}
            className="w-full py-4 rounded-xl font-bold text-white text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ background: !amount || parseFloat(amount) <= 0 || saving ? '#94a3b8' : accent }}
          >
            {saving
              ? <><Spinner /> Saving…</>
              : isEdit ? 'Update Entry' : `Save ${isIncome ? 'Income' : 'Expense'}`
            }
          </button>
        </div>
      </div>
    </>
  )
}

function TagSection({ label, items, selected, onSelect, accent, chipClass }: {
  label: string
  items: string[]
  selected: string
  onSelect: (v: string) => void
  accent: string
  chipClass?: string
}) {
  return (
    <div className="mb-4">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map(item => {
          const isSel = selected === item
          return (
            <button
              key={item}
              onClick={() => onSelect(isSel ? '' : item)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-all
                ${isSel ? 'text-white shadow-sm' : chipClass ?? 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              style={isSel ? { background: accent } : {}}
            >
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
