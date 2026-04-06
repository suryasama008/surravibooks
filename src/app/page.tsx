'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Transaction, TransactionInput, TransactionMode, CreditEntry, Contact, InvoiceEntry } from '@/types'
import { getFiscalYearLabel, FY_MONTHS } from '@/lib/fiscalYear'
import dynamic from 'next/dynamic'

const Dashboard         = dynamic(() => import('@/components/Dashboard'),           { ssr: false })
const TransactionList   = dynamic(() => import('@/components/TransactionList'),     { ssr: false })
const TransactionDrawer = dynamic(() => import('@/components/TransactionDrawer'),   { ssr: false })
const AddCreditDrawer   = dynamic(() => import('@/components/AddCreditDrawerWrapper'), { ssr: false })
const ContactsComponent = dynamic(() => import('@/components/Contacts'),            { ssr: false })
const InvoiceSection    = dynamic(() => import('@/components/InvoiceSection'),      { ssr: false })

type SnackSeverity = 'success' | 'error' | 'info'
interface Snack { open: boolean; msg: string; severity: SnackSeverity }

// Main tabs now include invoices
type MainTab = 'dashboard' | 'transactions' | 'invoices'
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

  const [allTransactions, setAllTransactions] = useState<Transaction[]>([])
  const [credits, setCredits]       = useState<CreditEntry[]>([])
  const [invoices, setInvoices]     = useState<InvoiceEntry[]>([])
  const [contacts, setContacts]     = useState<Contact[]>([])
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
    const [txRes, creditRes, contactRes, obRes, invoiceRes] = await Promise.all([
      supabase.from('transactions').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('credit_entries').select('*').order('date', { ascending: false }),
      supabase.from('contacts').select('*').order('company_name', { ascending: true }),
      supabase.from('opening_balances').select('*'),
      supabase.from('invoice_entries').select('*').order('invoice_date', { ascending: false }),
    ])
    if (txRes.error)      showSnack(`DB Error: ${txRes.error.message}`, 'error')
    else if (txRes.data)  setAllTransactions(txRes.data as Transaction[])
    if (creditRes.data)   setCredits(creditRes.data as CreditEntry[])
    if (contactRes.data)  setContacts(contactRes.data as Contact[])
    if (invoiceRes.data)  setInvoices(invoiceRes.data as InvoiceEntry[])
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
    fetch('/api/google-sheets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transaction: data }) }).catch(() => {})
  }

  const handleUpdate = async (id: string, tx: TransactionInput) => {
    const { data, error } = await supabase.from('transactions').update(tx).eq('id', id).select().single()
    if (error) { showSnack(`Update failed: ${error.message}`, 'error'); return }
    showSnack('✓ Entry updated!')
    setDrawerOpen(false); setEditTx(null)
    setAllTransactions(prev => prev.map(t => t.id === id ? data : t))
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (!error) {
      setAllTransactions(prev => prev.filter(t => t.id !== id))
      showSnack('Entry deleted', 'info')
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

  const handleInvoicePayNow = (inv: InvoiceEntry) => {
    const mode: TransactionMode = inv.entry_type === 'sale' ? 'receive' : 'send'
    const prefill: Transaction = {
      id: '',
      date: new Date().toISOString().split('T')[0],
      type: mode === 'receive' ? 'income' : 'expense',
      mode,
      account: 'ICICI',
      amount: inv.amount,
      category: mode === 'send' ? 'Procurement & Purchases' : 'Sales & Collections',
      sub_category: mode === 'send' ? 'Supplier Payment' : 'Customer Collection',
      description: `${inv.entry_type === 'sale' ? 'Receipt from' : 'Payment to'} ${inv.company_name} — Inv ${inv.invoice_number}`,
      payment_mode: 'RTGS/NEFT',
      notes: null,
      contact_id: inv.contact_id,
      company_name: inv.company_name,
      created_at: '',
    }
    setPendingInvoiceId(inv.id)
    setTab('transactions')
    setSidebarTab(null)
    setEditTx(prefill)
    setDrawerMode(mode)
    setDrawerOpen(true)
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

  // ── Invoice CRUD ────────────────────────────────────────────────
  const handleAddInvoice = async (data: Omit<InvoiceEntry, 'id' | 'created_at'>) => {
    const { data: saved, error } = await supabase.from('invoice_entries').insert([data]).select().single()
    if (error) { showSnack(`Save failed: ${error.message}`, 'error'); return }
    setInvoices(prev => [saved as InvoiceEntry, ...prev])
    showSnack('✓ Invoice entry saved!')
  }

  const handleUpdateInvoice = async (id: string, data: Omit<InvoiceEntry, 'id' | 'created_at'>) => {
    const { data: saved, error } = await supabase.from('invoice_entries').update(data).eq('id', id).select().single()
    if (error) { showSnack(`Update failed: ${error.message}`, 'error'); return }
    setInvoices(prev => prev.map(i => i.id === id ? saved as InvoiceEntry : i))
    showSnack('✓ Invoice updated!')
  }

  const handleDeleteInvoice = async (id: string) => {
    const { error } = await supabase.from('invoice_entries').delete().eq('id', id)
    if (error) { showSnack(`Delete failed: ${error.message}`, 'error'); return }
    setInvoices(prev => prev.filter(i => i.id !== id))
    showSnack('Invoice deleted', 'info')
  }

  const handleBulkImportInvoices = async (entries: Omit<InvoiceEntry, 'id' | 'created_at'>[]) => {
    const CHUNK = 50
    const added: InvoiceEntry[] = []
    for (let i = 0; i < entries.length; i += CHUNK) {
      const chunk = entries.slice(i, i + CHUNK)
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
              <button onClick={() => openDrawer('send')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e40af] hover:bg-[#1d3faa] text-white text-xs font-bold transition-colors shadow-sm">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg>
                New Entry
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
              contacts={contacts}
              loading={loading}
              onAdd={handleAddInvoice}
              onUpdate={handleUpdateInvoice}
              onPayNow={handleInvoicePayNow}
              onDelete={handleDeleteInvoice}
              onBulkImport={handleBulkImportInvoices}
              externalAddOpen={invoiceAddOpen}
              onExternalAddClose={() => setInvoiceAddOpen(false)}
              fyMonths={fyMonths}
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

          {/* Center + button */}
          <div className="flex-1 flex flex-col items-center justify-center relative">
            <button
              onClick={() => {
                if (activeView === 'invoices') setInvoiceAddOpen(true)
                else openDrawer('send')
              }}
              className="w-12 h-12 rounded-full bg-[#1d4ed8] flex items-center justify-center shadow-lg shadow-blue-500/40 active:scale-95 transition-all -mt-3">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/>
              </svg>
            </button>
            <span className="text-[9px] font-semibold text-slate-400 mt-0.5">Add</span>
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
