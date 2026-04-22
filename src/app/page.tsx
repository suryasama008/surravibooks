'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Transaction, TransactionInput, TransactionMode, CreditEntry, Contact, ContactNote, InvoiceEntry, InvoiceLine, Material, InvoicePayment, InvoiceStatus, StockEntry } from '@/types'
import { getFiscalYearLabel, FY_MONTHS } from '@/lib/fiscalYear'
import dynamic from 'next/dynamic'

const Dashboard         = dynamic(() => import('@/components/Dashboard'),           { ssr: false })
const TransactionList   = dynamic(() => import('@/components/TransactionList'),     { ssr: false })
const TransactionDrawer = dynamic(() => import('@/components/TransactionDrawer'),   { ssr: false })
const AddCreditDrawer   = dynamic(() => import('@/components/AddCreditDrawerWrapper'), { ssr: false })
const ContactsComponent = dynamic(() => import('@/components/Contacts'),            { ssr: false })
const InvoiceSection    = dynamic(() => import('@/components/InvoiceSection'),      { ssr: false })
const MaterialsSection  = dynamic(() => import('@/components/MaterialsSection'),    { ssr: false })

type SnackSeverity = 'success' | 'error' | 'info'
interface Snack { open: boolean; msg: string; severity: SnackSeverity }

// Main tabs now include invoices
type MainTab = 'dashboard' | 'transactions' | 'invoices' | 'materials'
type SidebarTab = 'contacts'

export default function HomePage() {
  const [tab, setTab]               = useState<MainTab>('dashboard')
  const [sidebarTab, setSidebarTab] = useState<SidebarTab | null>(null)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<TransactionMode>('send')
  const [editTx, setEditTx]         = useState<Transaction | null>(null)
  const [viewTx, setViewTx]         = useState<Transaction | null>(null)
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false)

  const [creditDrawerOpen, setCreditDrawerOpen] = useState(false)
  const [invoiceAddOpen, setInvoiceAddOpen] = useState(false)
  const [fabMenuOpen, setFabMenuOpen]       = useState(false)

  const [allTransactions, setAllTransactions] = useState<Transaction[]>([])
  const [credits, setCredits]       = useState<CreditEntry[]>([])
  const [invoices, setInvoices]     = useState<InvoiceEntry[]>([])
  const [invoiceLines, setInvoiceLines]       = useState<InvoiceLine[]>([])
  const [invoicePayments, setInvoicePayments] = useState<InvoicePayment[]>([])
  const [materials, setMaterials]             = useState<Material[]>([])
  const [payModalInvoices, setPayModalInvoices] = useState<InvoiceEntry[]>([])
  const [contacts, setContacts]     = useState<Contact[]>([])
  const [contactNotes, setContactNotes] = useState<ContactNote[]>([])
  const [stockEntries, setStockEntries] = useState<StockEntry[]>([])
  const [loading, setLoading]       = useState(true)
  const [openingBalances, setOpeningBalances] = useState<Record<string, number>>({ ICICI: 0, SBI: 0 })
  const [exporting, setExporting]   = useState(false)
  const [selectedFY, setSelectedFY] = useState<string>(getFiscalYearLabel(new Date()))
  const [fyMenuOpen, setFyMenuOpen] = useState(false)
  const [snack, setSnack]           = useState<Snack>({ open: false, msg: '', severity: 'success' })

  // Filter state — now lives here and is passed into Dashboard
  const [selectedMonth, setSelectedMonth] = useState('')
  const [dateFrom, setDateFrom]           = useState('')
  const [dateTo, setDateTo]               = useState('')

  const fyMenuRef  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (fyMenuRef.current && !fyMenuRef.current.contains(e.target as Node)) setFyMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])

  const showSnack = (msg: string, severity: SnackSeverity = 'success') => {
    setSnack({ open: true, msg, severity })
    setTimeout(() => setSnack(s => ({ ...s, open: false })), 3500)
  }

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [txRes, creditRes, contactRes, obRes, invoiceRes, linesRes, matRes, pmtRes, notesRes, stockRes] = await Promise.all([
      supabase.from('transactions').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('credit_entries').select('*').order('date', { ascending: false }),
      supabase.from('contacts').select('*').order('company_name', { ascending: true }),
      supabase.from('opening_balances').select('*'),
      supabase.from('invoice_entries').select('*').order('invoice_date', { ascending: false }),
      supabase.from('invoice_lines').select('*'),
      supabase.from('materials').select('*').order('material_name', { ascending: true }),
      supabase.from('invoice_payments').select('*').order('payment_date', { ascending: false }),
      supabase.from('contact_notes').select('*').order('created_at', { ascending: false }),
      supabase.from('stock_entries').select('*').order('entry_date', { ascending: false }),
    ])
    if (txRes.error)      showSnack(`DB Error: ${txRes.error.message}`, 'error')
    else if (txRes.data)  setAllTransactions(txRes.data as Transaction[])
    if (creditRes.data)   setCredits(creditRes.data as CreditEntry[])
    if (contactRes.data)  setContacts(contactRes.data as Contact[])
    if (invoiceRes.data)  setInvoices(invoiceRes.data as InvoiceEntry[])
    if (linesRes.data)    setInvoiceLines(linesRes.data as InvoiceLine[])
    if (matRes.data)      setMaterials(matRes.data as Material[])
    if (pmtRes.data)      setInvoicePayments(pmtRes.data as InvoicePayment[])
    if (notesRes.data)    setContactNotes(notesRes.data as ContactNote[])
    if (stockRes.data)    setStockEntries(stockRes.data as StockEntry[])
    if (obRes.data) {
      const ob: Record<string, number> = { ICICI: 0, SBI: 0 }
      obRes.data.forEach((row: { account: string; balance: number }) => { ob[row.account] = Number(row.balance) })
      setOpeningBalances(ob)
    }
    setLoading(false)
  }, [])

  const handleSaveOpeningBalance = useCallback(async (account: string, balance: number) => {
    const { error } = await supabase.from('opening_balances')
      .upsert({ account, balance, as_of_date: new Date().toISOString().slice(0, 10) }, { onConflict: 'account' })
    if (error) { showSnack(`Error saving: ${error.message}`, 'error'); return }
    setOpeningBalances(prev => ({ ...prev, [account]: balance }))
    showSnack(`${account} opening balance updated`)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const availableFYs = useMemo(() => {
    const s = new Set<string>()
    s.add(getFiscalYearLabel(new Date()))
    allTransactions.forEach(t => s.add(getFiscalYearLabel(t.date)))
    return Array.from(s).sort().reverse()
  }, [allTransactions])

  const transactions = useMemo(() =>
    allTransactions.filter(t => getFiscalYearLabel(t.date) === selectedFY),
    [allTransactions, selectedFY])

  const fyStartYear = parseInt(selectedFY.split('-')[0])
  const fyMonths = FY_MONTHS.map(m => {
    const yr = ['Jan', 'Feb', 'Mar'].includes(m) ? fyStartYear + 1 : fyStartYear
    return { label: `${m} ${yr}`, value: `${m}-${String(yr).slice(-2)}` }
  })

  const filtered = useMemo(() => {
    let txns = transactions
    if (selectedMonth) {
      txns = txns.filter(t => {
        const d = new Date(t.date + 'T00:00:00')
        const key = d.toLocaleString('default', { month: 'short' }) + '-' + String(d.getFullYear()).slice(-2)
        return key === selectedMonth
      })
    } else {
      if (dateFrom) txns = txns.filter(t => t.date >= dateFrom)
      if (dateTo)   txns = txns.filter(t => t.date <= dateTo)
    }
    return txns
  }, [transactions, selectedMonth, dateFrom, dateTo])

  const isFiltered  = !!(selectedMonth || dateFrom || dateTo)
  const filterLabel = selectedMonth || (dateFrom && dateTo ? `${dateFrom} → ${dateTo}` : dateFrom || dateTo || '')
  const clearFilter = () => { setSelectedMonth(''); setDateFrom(''); setDateTo('') }

  // ── Auto-save new company name to contacts ──────────────────────
  const autoSaveContact = async (companyName: string, contactType: 'supplier' | 'customer') => {
    if (!companyName.trim()) return
    const exists = contacts.some(c => c.company_name.toLowerCase() === companyName.toLowerCase())
    if (!exists) {
      const { data, error } = await supabase.from('contacts').insert([{
        company_name: companyName,
        contact_type: contactType,
        phone: null, email: null, gst_number: null, address: null, notes: null,
      }]).select().single()
      if (!error && data) {
        setContacts(prev => [...prev, data as Contact].sort((a, b) => a.company_name.localeCompare(b.company_name)))
      }
    }
  }

  // ── Add contact from drawer (returns new contact for selection) ──
  const handleAddContactFromDrawer = async (companyName: string, contactType: 'supplier' | 'customer'): Promise<Contact | null> => {
    if (!companyName.trim()) return null
    const existing = contacts.find(c => c.company_name.toLowerCase() === companyName.toLowerCase())
    if (existing) return existing
    const { data, error } = await supabase.from('contacts').insert([{
      company_name: companyName,
      contact_type: contactType,
      phone: null, email: null, gst_number: null, address: null, notes: null,
    }]).select().single()
    if (!error && data) {
      setContacts(prev => [...prev, data as Contact].sort((a, b) => a.company_name.localeCompare(b.company_name)))
      return data as Contact
    }
    return null
  }

  // ── Transaction CRUD ────────────────────────────────────────────
  const handleAdd = async (tx: TransactionInput) => {
    const { data, error } = await supabase.from('transactions').insert([tx]).select().single()
    if (error) { showSnack(`Save failed: ${error.message}`, 'error'); return }
    const txFY = getFiscalYearLabel(data.date)
    showSnack(txFY !== selectedFY ? `✓ Saved! Switched to FY ${txFY}` : '✓ Entry saved!')
    setDrawerOpen(false); setEditTx(null)
    if (txFY !== selectedFY) setSelectedFY(txFY)
    setAllTransactions(prev => [data, ...prev])
    // Auto-settle linked credit entry
    if (pendingCreditId) {
      handleSettleCredit(pendingCreditId)
      setPendingCreditId(null)
    }
    // Auto-settle linked invoice
    if (pendingInvoiceId) {
      const invId = pendingInvoiceId
      setPendingInvoiceId(null)
      const { data: updated, error: invErr } = await supabase.from('invoice_entries').update({
        status: 'paid',
        transaction_date: data.date,
        bank_account: data.account,
        sub_category: data.sub_category,
        settled_tx_id: data.id,
        notes: data.notes || null,
      }).eq('id', invId).select().single()
      if (!invErr && updated) {
        setInvoices(prev => prev.map(i => i.id === invId ? updated as InvoiceEntry : i))
        showSnack('✓ Invoice marked paid!')
      }
    }
    // Auto-save new company names to contacts
    if (tx.company_name && !tx.contact_id) {
      autoSaveContact(tx.company_name, tx.mode === 'send' ? 'supplier' : 'customer')
    }
  }

  const handleUpdate = async (id: string, tx: TransactionInput) => {
    // Get old transaction before update for cascade diff
    const oldTx = allTransactions.find(t => t.id === id)

    const { data, error } = await supabase.from('transactions').update(tx).eq('id', id).select().single()
    if (error) { showSnack(`Update failed: ${error.message}`, 'error'); return }
    showSnack('✓ Entry updated!')
    setDrawerOpen(false); setEditTx(null)
    setAllTransactions(prev => prev.map(t => t.id === id ? data : t))

    // ── Cascade 1: sync notes to any linked invoice ──────────────
    const linkedInvoice = invoices.find(i => i.settled_tx_id === id)
    if (linkedInvoice) {
      const { data: updatedInv } = await supabase.from('invoice_entries')
        .update({ notes: tx.notes || null }).eq('id', linkedInvoice.id).select().single()
      if (updatedInv) setInvoices(prev => prev.map(i => i.id === linkedInvoice.id ? updatedInv as InvoiceEntry : i))
    }

    // ── Cascade 2: sync date/amount to linked invoice_payments ───
    // Find invoice_payments that reference this transaction
    const linkedPayments = invoicePayments.filter(p => p.transaction_id === id)
    if (linkedPayments.length > 0 && oldTx) {
      const dateChanged   = tx.date   !== oldTx.date
      const amountChanged = tx.amount !== oldTx.amount

      if (dateChanged || amountChanged) {
        for (const pmt of linkedPayments) {
          // For amount: if only one payment on the invoice, update it proportionally
          const newPmtAmount = amountChanged
            ? Math.round((pmt.amount / oldTx.amount) * tx.amount * 100) / 100
            : pmt.amount
          const updates: Partial<typeof pmt> = {}
          if (dateChanged)   updates.payment_date = tx.date
          if (amountChanged) updates.amount = newPmtAmount

          const { data: updPmt } = await supabase.from('invoice_payments')
            .update(updates).eq('id', pmt.id).select().single()
          if (updPmt) setInvoicePayments(prev => prev.map(p => p.id === pmt.id ? updPmt as InvoicePayment : p))

          // Also sync invoice_entries amount_paid and transaction_date
          if (dateChanged || amountChanged) {
            const inv = invoices.find(i => i.id === pmt.invoice_id)
            if (inv) {
              const allInvPayments = invoicePayments.filter(p => p.invoice_id === inv.id)
              const newTotalPaid = allInvPayments.reduce((s, p) =>
                s + (p.id === pmt.id ? newPmtAmount : p.amount), 0)
              const newStatus: InvoiceStatus = newTotalPaid >= inv.amount - 0.01 ? 'paid'
                : newTotalPaid > 0 ? 'partial' : 'unpaid'
              const { data: updInv } = await supabase.from('invoice_entries')
                .update({
                  amount_paid: newTotalPaid,
                  status: newStatus,
                  ...(dateChanged ? { transaction_date: tx.date } : {}),
                })
                .eq('id', inv.id).select().single()
              if (updInv) setInvoices(prev => prev.map(i => i.id === inv.id ? updInv as InvoiceEntry : i))
            }
          }
        }
      }
    }

    // ── Cascade 3: recalculate advance_balance if amount changed ─
    if (oldTx && tx.amount !== oldTx.amount && tx.contact_id) {
      const cid = tx.contact_id
      const contact = contacts.find(c => c.id === cid)
      if (contact) {
        // Recalculate: advance = sum of overpayments recorded against this contact
        // Simplified: adjust by delta if this was an overpayment transaction
        const delta = tx.amount - oldTx.amount
        const newBalance = Math.max(0, Math.round(((contact.advance_balance ?? 0) + delta) * 100) / 100)
        const { data: updContact } = await supabase.from('contacts')
          .update({ advance_balance: newBalance }).eq('id', cid).select().single()
        if (updContact) setContacts(prev => prev.map(c => c.id === cid ? updContact as Contact : c))
      }
    }
  }

  const handleDelete = async (id: string) => {
    const oldTx = allTransactions.find(t => t.id === id)

    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) { showSnack(`Delete failed: ${error.message}`, 'error'); return }
    setAllTransactions(prev => prev.filter(t => t.id !== id))
    showSnack('Entry deleted', 'info')

    // ── Cascade: remove linked invoice_payments + reset invoice ──
    const linkedPayments = invoicePayments.filter(p => p.transaction_id === id)
    for (const pmt of linkedPayments) {
      await supabase.from('invoice_payments').delete().eq('id', pmt.id)
      setInvoicePayments(prev => prev.filter(p => p.id !== pmt.id))

      const inv = invoices.find(i => i.id === pmt.invoice_id)
      if (inv) {
        const remainingPayments = invoicePayments.filter(p => p.transaction_id !== id && p.invoice_id === inv.id)
        const newPaid = remainingPayments.reduce((s, p) => s + p.amount, 0)
        const newStatus: InvoiceStatus = newPaid >= inv.amount - 0.01 ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid'
        const { data: updInv } = await supabase.from('invoice_entries')
          .update({
            amount_paid: newPaid,
            status: newStatus,
            transaction_date: newStatus === 'unpaid' ? null : inv.transaction_date,
            settled_tx_id: newStatus === 'paid' ? inv.settled_tx_id : null,
          })
          .eq('id', inv.id).select().single()
        if (updInv) setInvoices(prev => prev.map(i => i.id === inv.id ? updInv as InvoiceEntry : i))
      }
    }

    // ── Cascade: recalculate advance_balance if contact linked ───
    if (oldTx?.contact_id) {
      const cid = oldTx.contact_id
      const contact = contacts.find(c => c.id === cid)
      if (contact && (contact.advance_balance ?? 0) > 0) {
        // Remove any advance that was attributed to this transaction
        const newBalance = Math.max(0, Math.round(((contact.advance_balance ?? 0) - oldTx.amount) * 100) / 100)
        const { data: updContact } = await supabase.from('contacts')
          .update({ advance_balance: newBalance }).eq('id', cid).select().single()
        if (updContact) setContacts(prev => prev.map(c => c.id === cid ? updContact as Contact : c))
      }
    }
  }

  const handleEditTx = (tx: Transaction) => {
    const mode = tx.mode || (tx.type === 'income' ? 'receive' : 'expense')
    setEditTx(tx); setDrawerMode(mode as TransactionMode); setDrawerOpen(true)
  }

  // ── Credit CRUD ─────────────────────────────────────────────────
  const handleAddCredit = async (data: Omit<CreditEntry, 'id' | 'created_at'>) => {
    const { data: saved, error } = await supabase.from('credit_entries').insert([data]).select().single()
    if (error) { showSnack(`Save failed: ${error.message}`, 'error'); return }
    showSnack('✓ Credit entry saved!')
    setCredits(prev => [saved as CreditEntry, ...prev])
  }

  const handleSettleCredit = async (id: string) => {
    const { error } = await supabase.from('credit_entries').update({ status: 'settled' }).eq('id', id)
    if (!error) {
      setCredits(prev => prev.map(c => c.id === id ? { ...c, status: 'settled' } : c))
      showSnack('✓ Marked as settled!')
    }
  }

  const [pendingCreditId, setPendingCreditId] = useState<string | null>(null)
  const [pendingInvoiceId, setPendingInvoiceId] = useState<string | null>(null)

  const handleInvoicePayNow  = (inv: InvoiceEntry)          => setPayModalInvoices([inv])
  const handleMultiPayNow    = (invs: InvoiceEntry[])        => setPayModalInvoices(invs)

  const handleUnpay = async (inv: InvoiceEntry) => {
    const { data: updInv, error } = await supabase.from('invoice_entries').update({
      status: 'unpaid',
      amount_paid: 0,
      transaction_date: null,
      bank_account: null,
      utr: null,
      settled_tx_id: null,
    }).eq('id', inv.id).select().single()
    if (error) { showSnack(`Failed: ${error.message}`, 'error'); return }
    setInvoices(prev => prev.map(i => i.id === inv.id ? updInv as InvoiceEntry : i))
    showSnack('↩ Invoice marked unpaid')
  }

  const handleConfirmPayment = async (
    invoicesToPay: InvoiceEntry[],
    paymentAmount: number,
    paymentDate: string,
    account: string,
    payMode: string,
    utr: string,
    notes: string,
    isPartial: boolean,
    category: string,
    subCategory: string,
    tdsAmount: number = 0,
  ) => {
    const isSale = invoicesToPay[0].entry_type === 'sale'
    const txMode: TransactionMode = isSale ? 'receive' : 'send'
    const invNums = invoicesToPay.map(i => i.invoice_number).join(', ')
    const desc = `${isSale ? 'Receipt from' : 'Payment to'} ${invoicesToPay[0].company_name} — Inv ${invNums}`

    // 1. single transaction = actual cash received/paid (TDS is not a cash movement)
    const txPayload: TransactionInput = {
      date: paymentDate, type: isSale ? 'income' : 'expense', mode: txMode,
      account, amount: paymentAmount,
      category,
      sub_category: subCategory,
      description: desc, payment_mode: payMode,
      notes: notes || undefined,
      contact_id: invoicesToPay[0].contact_id ?? undefined,
      company_name: invoicesToPay[0].company_name,
    }
    const { data: txData, error: txErr } = await supabase.from('transactions').insert([txPayload]).select().single()
    if (txErr) { showSnack(`Payment failed: ${txErr.message}`, 'error'); return }
    const tx = txData as Transaction
    setAllTransactions(prev => [tx, ...prev])

    // 2. distribute across invoices — with TDS, effective settlement = cash + TDS
    const totalDue = invoicesToPay.reduce((s, i) => s + Math.max(0, i.amount - (i.amount_paid ?? 0)), 0)
    const effectivePayment = tdsAmount > 0 ? paymentAmount + tdsAmount : paymentAmount
    const amountToDistribute = Math.min(effectivePayment, totalDue)
    const excessAmount = !tdsAmount && paymentAmount > totalDue ? Math.round((paymentAmount - totalDue) * 100) / 100 : 0

    for (const inv of invoicesToPay) {
      const remaining = Math.max(0, inv.amount - (inv.amount_paid ?? 0))
      const allocatedEffective = invoicesToPay.length === 1
        ? amountToDistribute
        : Math.round((remaining / totalDue) * amountToDistribute * 100) / 100
      const allocatedCash = invoicesToPay.length === 1
        ? paymentAmount
        : Math.round((remaining / totalDue) * paymentAmount * 100) / 100
      const newPaid = (inv.amount_paid ?? 0) + allocatedEffective
      const fullyPaid = newPaid >= inv.amount - 0.01
      const newStatus: InvoiceStatus = fullyPaid ? 'paid' : 'partial'

      // Build TDS note for invoice
      const tdsNote = tdsAmount > 0
        ? `TDS deducted: ₹${tdsAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })} (${((tdsAmount / inv.amount) * 100).toFixed(1)}% of invoice). Amount received: ₹${paymentAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}.`
        : null
      const existingNotes = inv.notes || notes || null
      const updatedNotes = tdsNote
        ? (existingNotes ? `${existingNotes} | ${tdsNote}` : tdsNote)
        : (notes || inv.notes || null)

      const { data: pmtData } = await supabase.from('invoice_payments').insert([{
        invoice_id: inv.id, transaction_id: tx.id,
        payment_date: paymentDate, amount: allocatedCash,
        bank_account: account, payment_mode: payMode,
        utr: utr || null, notes: tdsNote || notes || null,
      }]).select().single()
      if (pmtData) setInvoicePayments(prev => [pmtData as InvoicePayment, ...prev])

      const { data: updInv } = await supabase.from('invoice_entries').update({
        amount_paid: newPaid, status: newStatus,
        transaction_date: paymentDate, bank_account: account,
        utr: utr || inv.utr || null,
        settled_tx_id: fullyPaid ? tx.id : inv.settled_tx_id,
        notes: updatedNotes,
      }).eq('id', inv.id).select().single()
      if (updInv) setInvoices(prev => prev.map(i => i.id === inv.id ? updInv as InvoiceEntry : i))
    }

    // 3. if overpaid (no TDS) — add excess to contact's advance_balance
    if (excessAmount > 0 && invoicesToPay[0].contact_id) {
      const cid = invoicesToPay[0].contact_id
      const contact = contacts.find(c => c.id === cid)
      const currentBalance = contact?.advance_balance ?? 0
      const newBalance = Math.round((currentBalance + excessAmount) * 100) / 100
      const { data: updContact } = await supabase
        .from('contacts')
        .update({ advance_balance: newBalance })
        .eq('id', cid)
        .select().single()
      if (updContact) setContacts(prev => prev.map(c => c.id === cid ? updContact as Contact : c))

      const noteText = `[Auto] Excess payment of ₹${excessAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })} added as advance balance on ${paymentDate} (Inv: ${invNums}). New advance total: ₹${newBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}.`
      const { data: noteData } = await supabase.from('contact_notes')
        .insert([{ contact_id: cid, note_text: noteText }]).select().single()
      if (noteData) setContactNotes(prev => [noteData as ContactNote, ...prev])
    }

    setPayModalInvoices([])
    const excessMsg = excessAmount > 0 ? ` · ₹${excessAmount.toLocaleString('en-IN')} saved as advance` : ''
    showSnack(tdsAmount > 0
      ? `✓ Invoice marked paid · ₹${paymentAmount.toLocaleString('en-IN')} received + ₹${tdsAmount.toLocaleString('en-IN')} TDS`
      : isPartial
        ? `✓ Partial payment ₹${paymentAmount.toLocaleString('en-IN')} recorded`
        : `✓ ${invoicesToPay.length} invoice${invoicesToPay.length > 1 ? 's' : ''} marked paid!${excessMsg}`)

  }

  // ── Contacts CRUD ───────────────────────────────────────────────
  const handleAddContact = async (c: Omit<Contact, 'id' | 'created_at'>) => {
    const { data, error } = await supabase.from('contacts').insert([c]).select().single()
    if (error) { showSnack(`Save failed: ${error.message}`, 'error'); return }
    showSnack('✓ Contact added!')
    setContacts(prev => [...prev, data as Contact].sort((a, b) => a.company_name.localeCompare(b.company_name)))
  }

  const handleDeleteContact = async (id: string) => {
    await supabase.from('contacts').delete().eq('id', id)
    setContacts(prev => prev.filter(c => c.id !== id))
    showSnack('Contact deleted', 'info')
  }

  const handleUpdateContact = async (id: string, updates: Partial<Omit<Contact, 'id' | 'created_at'>>) => {
    const { data, error } = await supabase.from('contacts').update(updates).eq('id', id).select().single()
    if (error) { showSnack(`Update failed: ${error.message}`, 'error'); return }
    setContacts(prev => prev.map(c => c.id === id ? data as Contact : c).sort((a, b) => a.company_name.localeCompare(b.company_name)))
    showSnack('✓ Contact updated!')
  }

  // Bulk import contacts — chunked to avoid timeouts
  const handleBulkImportContacts = async (rows: Omit<Contact, 'id' | 'created_at'>[]) => {
    const CHUNK = 50
    const added: Contact[] = []
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK)
      const { data, error } = await supabase.from('contacts').insert(chunk).select()
      if (!error && data) added.push(...(data as Contact[]))
    }
    setContacts(prev => [...prev, ...added].sort((a, b) => a.company_name.localeCompare(b.company_name)))
    showSnack(`✓ ${added.length} contacts imported!`)
  }

  // ── Contact Notes CRUD ──────────────────────────────────────────
  const handleAddNote = async (contactId: string, text: string) => {
    const { data, error } = await supabase.from('contact_notes')
      .insert([{ contact_id: contactId, note_text: text }]).select().single()
    if (error) { showSnack(`Failed: ${error.message}`, 'error'); return }
    setContactNotes(prev => [data as ContactNote, ...prev])
    showSnack('✓ Note saved!')
  }

  const handleDeleteNote = async (noteId: string) => {
    const { error } = await supabase.from('contact_notes').delete().eq('id', noteId)
    if (!error) {
      setContactNotes(prev => prev.filter(n => n.id !== noteId))
      showSnack('Note deleted', 'info')
    }
  }

  // ── Invoice CRUD ────────────────────────────────────────────────
  const handleAddInvoice = async (data: Omit<InvoiceEntry, 'id' | 'created_at'>, lines: Omit<InvoiceLine, 'id' | 'invoice_id' | 'created_at'>[]) => {
    const sanitized = { ...data, amount_paid: data.amount_paid ?? 0 }
    const { data: saved, error } = await supabase.from('invoice_entries').insert([sanitized]).select().single()
    if (error) { showSnack(`Save failed: ${error.message}`, 'error'); return }
    const newInv = saved as InvoiceEntry
    setInvoices(prev => [newInv, ...prev])
    if (lines.length > 0) {
      const { data: savedLines } = await supabase.from('invoice_lines')
        .insert(lines.map(l => ({ ...l, invoice_id: newInv.id }))).select()
      if (savedLines) setInvoiceLines(prev => [...prev, ...(savedLines as InvoiceLine[])])

      // ── Auto-manage stock ────────────────────────────────────────────
      if (data.entry_type === 'purchase') {
        // PURCHASE: add positive stock entries. Auto-create material record if not found.
        const linesWithQty = (savedLines as InvoiceLine[]).filter(l => l.quantity && l.quantity > 0)
        let localMaterials = [...materials]
        const stockRows: Omit<StockEntry, 'id' | 'created_at'>[] = []

        for (const l of linesWithQty) {
          let mat = localMaterials.find(m => m.material_name.toLowerCase() === l.material_name.toLowerCase())
          if (!mat) {
            // Auto-create material so stock FK is satisfied
            const { data: newMat } = await supabase.from('materials')
              .insert([{ material_name: l.material_name, hsn_code: l.hsn_code ?? null, gst_rate: null }])
              .select().single()
            if (newMat) {
              mat = newMat as typeof materials[0]
              localMaterials = [...localMaterials, mat]
              setMaterials(prev => [...prev, mat!].sort((a, b) => a.material_name.localeCompare(b.material_name)))
            }
          }
          if (!mat) continue
          stockRows.push({
            material_id:    mat.id,
            material_name:  l.material_name,
            invoice_id:     newInv.id,
            invoice_number: newInv.invoice_number,
            supplier_name:  newInv.company_name,
            quantity:       l.quantity!,
            unit:           l.unit,
            rate:           l.rate,
            batch_number:   l.batch_number,
            mfd_date:       l.mfd_date,
            expiry_date:    l.expiry_date,
            entry_date:     newInv.invoice_date,
            notes:          null,
          })
        }
        if (stockRows.length > 0) {
          const { data: savedStock } = await supabase.from('stock_entries').insert(stockRows).select()
          if (savedStock) setStockEntries(prev => [...(savedStock as StockEntry[]), ...prev])
        }
      } else if (data.entry_type === 'sale') {
        // SALE: deduct stock — only for lines where current stock > 0, never go negative
        const deductRows: Omit<StockEntry, 'id' | 'created_at'>[] = []
        for (const l of (savedLines as InvoiceLine[]).filter(l => l.quantity && l.quantity > 0)) {
          const mat = materials.find(m => m.material_name.toLowerCase() === l.material_name.toLowerCase())
          if (!mat) continue // no material record = no stock to deduct
          const currentStock = stockEntries
            .filter(s => s.material_name.toLowerCase() === l.material_name.toLowerCase())
            .reduce((sum, s) => sum + s.quantity, 0)
          if (currentStock <= 0) continue // nothing to deduct
          const deductQty = Math.min(l.quantity!, currentStock)
          deductRows.push({
            material_id:    mat.id,
            material_name:  l.material_name,
            invoice_id:     newInv.id,
            invoice_number: newInv.invoice_number,
            supplier_name:  null,
            quantity:       -deductQty,
            unit:           l.unit,
            rate:           l.rate,
            batch_number:   l.batch_number,
            mfd_date:       l.mfd_date,
            expiry_date:    l.expiry_date,
            entry_date:     newInv.invoice_date,
            notes:          `Sale — ${newInv.company_name}`,
          })
        }
        if (deductRows.length > 0) {
          const { data: savedStock } = await supabase.from('stock_entries').insert(deductRows).select()
          if (savedStock) setStockEntries(prev => [...(savedStock as StockEntry[]), ...prev])
        }
      }
    }
    showSnack('✓ Invoice saved!')
  }

  const handleUpdateInvoice = async (id: string, data: Omit<InvoiceEntry, 'id' | 'created_at'>, lines: Omit<InvoiceLine, 'id' | 'invoice_id' | 'created_at'>[]) => {
    const { data: saved, error } = await supabase.from('invoice_entries').update(data).eq('id', id).select().single()
    if (error) { showSnack(`Update failed: ${error.message}`, 'error'); return }
    setInvoices(prev => prev.map(i => i.id === id ? saved as InvoiceEntry : i))
    // Replace lines: delete old, insert new
    await supabase.from('invoice_lines').delete().eq('invoice_id', id)
    if (lines.length > 0) {
      const { data: savedLines } = await supabase.from('invoice_lines')
        .insert(lines.map(l => ({ ...l, invoice_id: id }))).select()
      if (savedLines) setInvoiceLines(prev => [...prev.filter(l => l.invoice_id !== id), ...(savedLines as InvoiceLine[])])
    } else {
      setInvoiceLines(prev => prev.filter(l => l.invoice_id !== id))
    }
    showSnack('✓ Invoice updated!')
    if (data.settled_tx_id) {
      const { data: updatedTx } = await supabase.from('transactions')
        .update({ notes: data.notes || null }).eq('id', data.settled_tx_id).select().single()
      if (updatedTx) setAllTransactions(prev => prev.map(t => t.id === data.settled_tx_id ? updatedTx : t))
    }
  }

  const handleDeleteInvoice = async (id: string) => {
    const { error } = await supabase.from('invoice_entries').delete().eq('id', id)
    if (error) { showSnack(`Delete failed: ${error.message}`, 'error'); return }
    setInvoices(prev => prev.filter(i => i.id !== id))
    showSnack('Invoice deleted', 'info')
  }

  // ── Materials CRUD ──────────────────────────────────────────────
  const handleAddMaterial = async (m: Omit<typeof materials[0], 'id' | 'created_at'>): Promise<typeof materials[0]> => {
    const { data, error } = await supabase.from('materials').insert([m]).select().single()
    if (error) { showSnack(`Save failed: ${error.message}`, 'error'); throw error }
    const mat = data as typeof materials[0]
    setMaterials(prev => [...prev, mat].sort((a, b) => a.material_name.localeCompare(b.material_name)))
    showSnack('✓ Material added!')
    return mat
  }

  const handleUpdateMaterial = async (id: string, m: Omit<typeof materials[0], 'id' | 'created_at'>) => {
    const { data, error } = await supabase.from('materials').update(m).eq('id', id).select().single()
    if (error) { showSnack(`Update failed: ${error.message}`, 'error'); return }
    setMaterials(prev => prev.map(x => x.id === id ? data as typeof materials[0] : x).sort((a, b) => a.material_name.localeCompare(b.material_name)))
    showSnack('✓ Material updated!')
  }

  const handleDeleteMaterial = async (id: string) => {
    const { error } = await supabase.from('materials').delete().eq('id', id)
    if (error) { showSnack(`Delete failed: ${error.message}`, 'error'); return }
    setMaterials(prev => prev.filter(m => m.id !== id))
    showSnack('Material deleted', 'info')
  }

  // ── Stock Entries CRUD ──────────────────────────────────────────
  const handleAddStock = async (s: Omit<StockEntry, 'id' | 'created_at'>) => {
    const { data, error } = await supabase.from('stock_entries').insert([s]).select().single()
    if (error) { showSnack(`Stock save failed: ${error.message}`, 'error'); return }
    setStockEntries(prev => [data as StockEntry, ...prev])
    showSnack('✓ Stock entry added!')
  }

  const handleUpdateStock = async (id: string, s: Partial<Omit<StockEntry, 'id' | 'created_at'>>) => {
    const { data, error } = await supabase.from('stock_entries').update(s).eq('id', id).select().single()
    if (error) { showSnack(`Stock update failed: ${error.message}`, 'error'); return }
    setStockEntries(prev => prev.map(e => e.id === id ? { ...e, ...(data as StockEntry) } : e))
    showSnack('✓ Stock entry updated!')
  }

  const handleDeleteStock = async (id: string) => {
    const { error } = await supabase.from('stock_entries').delete().eq('id', id)
    if (error) { showSnack(`Delete failed: ${error.message}`, 'error'); return }
    setStockEntries(prev => prev.filter(e => e.id !== id))
    showSnack('Stock entry deleted', 'info')
  }

  const handleBulkImportStock = async (
    newMaterials: Omit<Material, 'id' | 'created_at'>[],
    stockRows: (Omit<StockEntry, 'id' | 'created_at' | 'material_id'> & { material_name: string })[]
  ): Promise<{ stockCount: number; newMatCount: number }> => {
    // Insert new materials first, then resolve material_id for each stock row
    const matMap = new Map(materials.map(m => [m.material_name.toLowerCase(), m.id]))
    let newMatCount = 0
    if (newMaterials.length > 0) {
      const { data, error } = await supabase.from('materials').insert(newMaterials).select()
      if (error) { showSnack(`Material import failed: ${error.message}`, 'error'); throw error }
      const added = data as Material[]
      newMatCount = added.length
      added.forEach(m => matMap.set(m.material_name.toLowerCase(), m.id))
      setMaterials(prev => [...prev, ...added].sort((a, b) => a.material_name.localeCompare(b.material_name)))
    }
    const entries = stockRows
      .map(({ material_name, ...rest }) => ({ ...rest, material_id: matMap.get(material_name.toLowerCase()) ?? '', material_name }))
      .filter(e => e.material_id)
    const CHUNK = 50; const added: StockEntry[] = []
    for (let i = 0; i < entries.length; i += CHUNK) {
      const { data, error } = await supabase.from('stock_entries').insert(entries.slice(i, i + CHUNK)).select()
      if (!error && data) added.push(...(data as StockEntry[]))
    }
    setStockEntries(prev => [...added, ...prev])
    showSnack(`✓ ${added.length} stock entries imported!`)
    return { stockCount: added.length, newMatCount }
  }

  const handleBulkImportMaterials = async (rows: Omit<typeof materials[0], 'id' | 'created_at'>[]) => {
    // Deduplicate against existing
    const existingNames = new Set(materials.map(m => m.material_name.toLowerCase()))
    const newRows = rows.filter(r => !existingNames.has(r.material_name.toLowerCase()))
    const skipped = rows.length - newRows.length
    const CHUNK = 50; const added: typeof materials = []
    for (let i = 0; i < newRows.length; i += CHUNK) {
      const { data, error } = await supabase.from('materials').insert(newRows.slice(i, i + CHUNK)).select()
      if (!error && data) added.push(...(data as typeof materials))
    }
    setMaterials(prev => [...prev, ...added].sort((a, b) => a.material_name.localeCompare(b.material_name)))
    showSnack(`✓ ${added.length} materials imported!`)
    return { added: added.length, skipped }
  }

  const handleBulkImportInvoices = async (entries: Omit<InvoiceEntry, 'id' | 'created_at'>[]) => {
    const CHUNK = 50
    const added: InvoiceEntry[] = []
    for (let i = 0; i < entries.length; i += CHUNK) {
      const chunk = entries.slice(i, i + CHUNK).map(e => ({ ...e, amount_paid: e.amount_paid ?? 0 }))
      const { data, error } = await supabase.from('invoice_entries').insert(chunk).select()
      if (!error && data) added.push(...(data as InvoiceEntry[]))
    }
    setInvoices(prev => [...added, ...prev])
    showSnack(`✓ ${added.length} invoice entries imported!`)
  }

  // ── Export ──────────────────────────────────────────────────────
  const handleExport = async () => {
    if (exporting) return
    setExporting(true)
    showSnack('⏳ Generating Excel…', 'info')
    try {
      const res = await fetch('/api/export')
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = `CashBook_${getFiscalYearLabel(new Date())}_${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showSnack('✓ Excel downloaded!')
    } catch { showSnack('Export failed', 'error') }
    setExporting(false)
  }

  const snackColors: Record<SnackSeverity, string> = {
    success: 'bg-emerald-600', error: 'bg-red-600', info: 'bg-blue-600',
  }

  const openDrawer = (mode: TransactionMode) => { setEditTx(null); setDrawerMode(mode); setDrawerOpen(true) }

  // Effective active content view
  const activeView = sidebarTab || tab

  const NAV_TABS = [
    {
      id: 'dashboard', label: 'Dashboard',
      svg: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" strokeWidth="1.8"/><rect x="14" y="3" width="7" height="7" rx="1" strokeWidth="1.8"/><rect x="3" y="14" width="7" height="7" rx="1" strokeWidth="1.8"/><rect x="14" y="14" width="7" height="7" rx="1" strokeWidth="1.8"/></svg>,
    },
    {
      id: 'transactions', label: 'Transactions',
      svg: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 6h16M4 10h16M4 14h10M4 18h7"/></svg>,
    },
    {
      id: 'invoices', label: 'Invoices',
      svg: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>,
    },
    {
      id: 'materials', label: 'Materials',
      svg: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>,
    },
    {
      id: 'contacts', label: 'Contacts',
      svg: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"/></svg>,
    },
  ] as const

  const handleNavClick = (id: string) => {
    if (id === 'contacts') { setSidebarTab('contacts'); setTab('dashboard') }
    else { setTab(id as MainTab); setSidebarTab(null) }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* ── TOP NAVBAR (full-width, responsive) ── */}
      <nav className="bg-[#1d4ed8] text-white sticky top-0 z-30 shadow-lg">

        {/* ── Mobile: brand only (tabs moved to bottom) ── */}
        <div className="sm:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <div className="font-bold text-sm leading-tight">Surravi Books</div>
                <div className="text-[10px] opacity-40 leading-none">Surravi Pharma · FY {selectedFY}</div>
              </div>
            </div>
            {/* FY picker — mobile */}
            <div className="relative" ref={fyMenuRef}>
              <button onClick={() => setFyMenuOpen(v => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/18 text-xs font-semibold transition-colors border border-white/10">
                <svg className="w-3 h-3 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                FY {selectedFY}
                <svg className="w-2.5 h-2.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {fyMenuOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 min-w-[170px] z-50 overflow-hidden">
                  <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">Fiscal Year (Apr–Mar)</div>
                  {availableFYs.map(fy => (
                    <button key={fy} onClick={() => { setSelectedFY(fy); setFyMenuOpen(false); clearFilter() }}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-slate-50 transition-colors
                        ${fy === selectedFY ? 'font-bold text-blue-700' : 'font-medium text-slate-700'}`}>
                      FY {fy}
                      {fy === getFiscalYearLabel(new Date()) && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 font-semibold px-1.5 py-0.5 rounded-full">Current</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Desktop: single-row layout ── */}
        <div className="hidden sm:flex items-stretch px-6 h-14">
          {/* Brand */}
          <div className="flex items-center gap-2.5 pr-4 mr-2 border-r border-white/10 flex-shrink-0">
            <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-sm leading-tight">Surravi Books</div>
              <div className="text-[10px] opacity-40 leading-tight">Surravi Pharma</div>
            </div>
          </div>

          {/* Nav tabs */}
          <div className="flex items-stretch gap-0 flex-1 overflow-x-auto scrollbar-none">
            {NAV_TABS.map(item => (
              <button key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`flex items-center gap-1.5 px-4 h-full text-xs font-semibold border-b-2 transition-colors whitespace-nowrap flex-shrink-0
                  ${activeView === item.id
                    ? 'border-[#60a5fa] text-white'
                    : 'border-transparent text-white/45 hover:text-white/80 hover:bg-white/5'}`}>
                {item.svg}
                {item.label}
              </button>
            ))}
          </div>

          {/* Right side — FY picker + action buttons */}
          <div className="flex items-center gap-2 pl-2 border-l border-white/10 flex-shrink-0">
            {/* FY picker */}
            <div className="relative" ref={fyMenuRef}>
              <button onClick={() => setFyMenuOpen(v => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/18 text-xs font-semibold transition-colors border border-white/10">
                <svg className="w-3 h-3 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                FY {selectedFY}
                <svg className="w-2.5 h-2.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {fyMenuOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 min-w-[170px] z-50 overflow-hidden">
                  <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">Fiscal Year (Apr–Mar)</div>
                  {availableFYs.map(fy => (
                    <button key={fy} onClick={() => { setSelectedFY(fy); setFyMenuOpen(false); clearFilter() }}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-slate-50 transition-colors
                        ${fy === selectedFY ? 'font-bold text-blue-700' : 'font-medium text-slate-700'}`}>
                      FY {fy}
                      {fy === getFiscalYearLabel(new Date()) && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 font-semibold px-1.5 py-0.5 rounded-full">Current</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Single + action button — context-aware */}
            {(activeView === 'dashboard' || activeView === 'transactions') && (
              <button onClick={() => openDrawer('expense')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e40af] hover:bg-[#1d3faa] text-white text-xs font-bold transition-colors shadow-sm">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg>
                New Expense
              </button>
            )}
            {activeView === 'invoices' && (
              <button onClick={() => setInvoiceAddOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e40af] hover:bg-[#1d3faa] text-white text-xs font-bold transition-colors shadow-sm">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg>
                New Invoice
              </button>
            )}
            <button onClick={handleExport} disabled={exporting}
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/18 text-white text-xs font-semibold transition-colors border border-white/10 disabled:opacity-40">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              {exporting ? 'Exporting…' : 'Export'}
            </button>
          </div>
        </div>
      </nav>

      {/* ── MAIN CONTENT (full width, no max-w cap) ── */}
      <main className="flex-1 w-full">
        <div className="px-3 sm:px-6 py-4 pb-20 sm:pb-6">

          {activeView === 'dashboard' && (
            <Dashboard
              transactions={transactions} filtered={filtered}
              loading={loading} fiscalYear={selectedFY}
              isFiltered={isFiltered} filterLabel={filterLabel}
              credits={credits}
              selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
              dateFrom={dateFrom} setDateFrom={setDateFrom}
              dateTo={dateTo} setDateTo={setDateTo}
              fyMonths={fyMonths} clearFilter={clearFilter}
              openingBalances={openingBalances}
              onSaveOpeningBalance={handleSaveOpeningBalance}
            />
          )}
          {activeView === 'transactions' && (
            <TransactionList
              transactions={filtered} allCount={transactions.length}
              loading={loading} onDelete={handleDelete} onEdit={handleEditTx}
              isFiltered={isFiltered}
              selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
              dateFrom={dateFrom} setDateFrom={setDateFrom}
              dateTo={dateTo} setDateTo={setDateTo}
              fyMonths={fyMonths} clearFilter={clearFilter}
            />
          )}
          {activeView === 'invoices' && (
            <InvoiceSection
              invoices={invoices}
              invoiceLines={invoiceLines}
              invoicePayments={invoicePayments}
              materials={materials}
              transactions={allTransactions}
              contacts={contacts}
              loading={loading}
              onAdd={handleAddInvoice}
              onUpdate={handleUpdateInvoice}
              onPayNow={handleInvoicePayNow}
              onUnpay={handleUnpay}
              onMultiPay={handleMultiPayNow}
              onConfirmPayment={handleConfirmPayment}
              payModalInvoices={payModalInvoices}
              onClosePayModal={() => setPayModalInvoices([])}
              onDelete={handleDeleteInvoice}
              externalAddOpen={invoiceAddOpen}
              onExternalAddClose={() => setInvoiceAddOpen(false)}
              fyMonths={fyMonths}
              stockEntries={stockEntries}
              onAddStock={handleAddStock}
              onUpdateStock={handleUpdateStock}
            />
          )}
          {activeView === 'materials' && (
            <MaterialsSection
              materials={materials}
              stockEntries={stockEntries}
              loading={loading}
              onAddMaterial={handleAddMaterial}
              onUpdateMaterial={handleUpdateMaterial}
              onDeleteMaterial={handleDeleteMaterial}
              onAddStock={handleAddStock}
              onUpdateStock={handleUpdateStock}
              onDeleteStock={handleDeleteStock}
              onBulkImportStock={handleBulkImportStock}
            />
          )}
          {activeView === 'contacts' && (
            <ContactsComponent
              contacts={contacts}
              bizTransactions={[]}
              loading={loading}
              onAdd={handleAddContact}
              onDelete={handleDeleteContact}
              onUpdate={handleUpdateContact}
              onBulkImport={handleBulkImportContacts}
              transactions={transactions}
              credits={credits}
              invoices={invoices}
              invoiceLines={invoiceLines}
              contactNotes={contactNotes}
              onAddNote={handleAddNote}
              onDeleteNote={handleDeleteNote}
            />
          )}
        </div>
      </main>

      {/* ── MOBILE BOTTOM TAB BAR ── */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200"
        style={{paddingBottom: 'env(safe-area-inset-bottom)'}}>
        <div className="flex items-end h-16">

          {/* Home */}
          <button onClick={() => handleNavClick('dashboard')}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 h-full transition-colors
              ${activeView === 'dashboard' ? 'text-[#1d4ed8]' : 'text-slate-400'}`}>
            <svg className="w-5 h-5" fill={activeView === 'dashboard' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth="1.8"/>
              <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth="1.8"/>
              <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth="1.8"/>
              <rect x="14" y="14" width="7" height="7" rx="1" strokeWidth="1.8"/>
            </svg>
            <span className="text-[9px] font-semibold">Home</span>
          </button>

          {/* Transactions */}
          <button onClick={() => handleNavClick('transactions')}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 h-full transition-colors
              ${activeView === 'transactions' ? 'text-[#1d4ed8]' : 'text-slate-400'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={activeView === 'transactions' ? 2.5 : 1.8} d="M4 6h16M4 10h16M4 14h10M4 18h7"/>
            </svg>
            <span className="text-[9px] font-semibold">Txns</span>
          </button>

          {/* Center FAB — always Expense. Long-press / ⋯ for invoices */}
          <div className="flex-1 flex flex-col items-center justify-center relative">
            {/* Invoice quick-menu popup */}
            {fabMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setFabMenuOpen(false)} />
                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden w-48">
                  <div className="px-4 py-2.5 border-b border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">New Invoice</p>
                  </div>
                  <button
                    onClick={() => { setFabMenuOpen(false); handleNavClick('invoices'); setTimeout(() => setInvoiceAddOpen(true), 80) }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left">
                    <span className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-base">↑</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Sale Invoice</p>
                      <p className="text-[10px] text-slate-400">Money to receive</p>
                    </div>
                  </button>
                  <button
                    onClick={() => { setFabMenuOpen(false); handleNavClick('invoices'); setTimeout(() => setInvoiceAddOpen(true), 80) }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-t border-slate-50">
                    <span className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-base">↓</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Purchase Invoice</p>
                      <p className="text-[10px] text-slate-400">Money to pay</p>
                    </div>
                  </button>
                  <div className="border-t border-slate-100">
                    <button
                      onClick={() => { setFabMenuOpen(false); openDrawer('send') }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left">
                      <span className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-sm font-bold">₹</span>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">Send / Receive</p>
                        <p className="text-[10px] text-slate-400">Non-invoice payment</p>
                      </div>
                    </button>
                  </div>
                </div>
              </>
            )}
            {/* Main FAB — Expense */}
            <button
              onClick={() => { setFabMenuOpen(false); openDrawer('expense') }}
              className="w-12 h-12 rounded-full bg-[#1d4ed8] flex items-center justify-center shadow-lg shadow-blue-500/40 active:scale-95 transition-all -mt-3">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/>
              </svg>
            </button>
            {/* ⋯ menu trigger */}
            <button
              onClick={e => { e.stopPropagation(); setFabMenuOpen(v => !v) }}
              className="absolute -right-1 -top-1 w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center shadow">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
              </svg>
            </button>
            <span className="text-[9px] font-semibold text-slate-400 mt-0.5">Expense</span>
          </div>

          {/* Invoices */}
          <button onClick={() => handleNavClick('invoices')}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 h-full transition-colors
              ${activeView === 'invoices' ? 'text-[#1d4ed8]' : 'text-slate-400'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={activeView === 'invoices' ? 2.5 : 1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <span className="text-[9px] font-semibold">Invoices</span>
          </button>

          {/* Materials */}
          <button onClick={() => handleNavClick('materials')}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 h-full transition-colors
              ${activeView === 'materials' ? 'text-[#1d4ed8]' : 'text-slate-400'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={activeView === 'materials' ? 2.5 : 1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
            </svg>
            <span className="text-[9px] font-semibold">Materials</span>
          </button>

          {/* Contacts */}
          <button onClick={() => handleNavClick('contacts')}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 h-full transition-colors
              ${activeView === 'contacts' ? 'text-[#1d4ed8]' : 'text-slate-400'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={activeView === 'contacts' ? 2.5 : 1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"/>
            </svg>
            <span className="text-[9px] font-semibold">Contacts</span>
          </button>

        </div>
      </div>

      {/* ── DRAWERS ── */}
      <TransactionDrawer
        open={drawerOpen}
        initialMode={drawerMode}
        editTransaction={editTx}
        contacts={contacts}
        onClose={() => { setDrawerOpen(false); setEditTx(null); setPendingCreditId(null) }}
        onSubmit={handleAdd}
        onUpdate={handleUpdate}
        onAddContact={handleAddContactFromDrawer}
      />

      {viewDrawerOpen && viewTx && (
        <TransactionViewDrawer
          tx={viewTx}
          onClose={() => { setViewDrawerOpen(false); setViewTx(null) }}
          onEdit={() => { setViewDrawerOpen(false); handleEditTx(viewTx) }}
          onDelete={async (id) => { setViewDrawerOpen(false); setViewTx(null); await handleDelete(id) }}
        />
      )}

      {creditDrawerOpen && (
        <AddCreditDrawer
          contacts={contacts}
          onClose={() => setCreditDrawerOpen(false)}
          onSubmit={async (data) => { await handleAddCredit(data); setCreditDrawerOpen(false) }}
        />
      )}

      {snack.open && (
        <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-white text-sm font-semibold shadow-xl ${snackColors[snack.severity]}`}>
          {snack.msg}
        </div>
      )}
    </div>
  )
}


// ── Transaction View Drawer (read-only) ───────────────────────────────
const MODE_STYLE_VIEW = {
  send:    { label: 'Purchase', bg: 'bg-red-50',     text: 'text-red-600',     sign: '−' },
  receive: { label: 'Sale',     bg: 'bg-emerald-50', text: 'text-emerald-600', sign: '+' },
  expense: { label: 'Expense',  bg: 'bg-violet-50',  text: 'text-violet-600',  sign: '−' },
} as const

function TransactionViewDrawer({
  tx, onClose, onEdit, onDelete,
}: {
  tx: Transaction
  onClose: () => void
  onEdit: () => void
  onDelete: (id: string) => void
}) {
  const [confirming, setConfirming] = React.useState(false)
  const mode = (tx.mode || (tx.type === 'income' ? 'receive' : 'expense')) as keyof typeof MODE_STYLE_VIEW
  const style = MODE_STYLE_VIEW[mode] || MODE_STYLE_VIEW.expense
  const amtStr = '₹' + tx.amount.toLocaleString('en-IN', { maximumFractionDigits: 5 })
  const dateStr = new Date(tx.date + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl max-h-[80vh] flex flex-col shadow-2xl">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-9 h-1 bg-slate-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 py-3 flex-shrink-0 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2 py-1 rounded-lg ${style.bg} ${style.text}`}>{style.label}</span>
            <span className="text-[11px] text-slate-400">{tx.account}</span>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-4">
          {/* Amount */}
          <div className="text-center py-2">
            <p className={`text-4xl font-extrabold ${style.text}`}>
              {style.sign}{amtStr}
            </p>
            <p className="text-xs text-slate-400 mt-1">{dateStr}</p>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-2">
            {tx.company_name && (
              <div className="bg-slate-50 rounded-xl p-3 col-span-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Party</p>
                <p className="text-sm font-semibold text-slate-800">{tx.company_name}</p>
              </div>
            )}
            {tx.category && (
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Category</p>
                <p className="text-xs font-medium text-slate-700">{tx.category}</p>
              </div>
            )}
            {tx.sub_category && (
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Sub-category</p>
                <p className="text-xs font-medium text-slate-700">{tx.sub_category}</p>
              </div>
            )}
            {tx.payment_mode && (
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Payment Mode</p>
                <p className="text-xs font-medium text-slate-700">{tx.payment_mode}</p>
              </div>
            )}
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Account</p>
              <p className="text-xs font-medium text-slate-700">{tx.account}</p>
            </div>
            {tx.description && (
              <div className="bg-slate-50 rounded-xl p-3 col-span-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Description</p>
                <p className="text-xs text-slate-700">{tx.description}</p>
              </div>
            )}
            {tx.notes && (
              <div className="bg-slate-50 rounded-xl p-3 col-span-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Notes</p>
                <p className="text-xs text-slate-600 italic">{tx.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex gap-2 flex-shrink-0">
          {confirming ? (
            <>
              <p className="flex-1 text-xs text-slate-500 flex items-center">Delete this entry?</p>
              <button onClick={() => setConfirming(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200">
                Cancel
              </button>
              <button onClick={() => onDelete(tx.id)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 text-white hover:bg-red-700">
                Delete
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setConfirming(true)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                Delete
              </button>
              <button onClick={onEdit}
                className="flex-1 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-white hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
                </svg>
                Edit
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
