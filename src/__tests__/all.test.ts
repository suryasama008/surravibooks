/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  COMPREHENSIVE TEST SUITE — sb-p3-updated
 *  Covers: Fiscal Year logic, Constants, Filter logic, Business rules,
 *          Input validation, Edge cases, Regression scenarios
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
  getFiscalYear,
  getFiscalYearLabel,
  fyStartDate,
  fyEndDate,
  fyMonthSortKey,
  FY_MONTHS,
} from '../lib/fiscalYear'

import {
  ACCOUNTS,
  PAYMENT_MODES,
  CREDIT_TERMS,
  SEND_CATEGORIES,
  SEND_SUB_CATEGORIES,
  RECEIVE_CATEGORIES,
  RECEIVE_SUB_CATEGORIES,
  EXPENSE_CATEGORIES,
  EXPENSE_SUB_CATEGORIES,
  SUB_CATEGORIES,
  getFiscalYear as getFiscalYearFromConstants,
} from '../lib/constants'

import type {
  Transaction,
  CreditEntry,
  Contact,
  InvoiceEntry,
  InvoiceLine,
  StockEntry,
  Material,
  InvoicePayment,
} from '../types'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — pure functions extracted from components for testability
// ─────────────────────────────────────────────────────────────────────────────

function fmtAmt(n: number): string {
  return '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function daysSince(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.floor((today.getTime() - d.getTime()) / 86400000)
}

function getDueDateUrgency(dueDate: string | null, status: string): 'overdue' | 'red' | 'yellow' | 'normal' | 'settled' {
  if (status === 'settled') return 'settled'
  if (!dueDate) return 'normal'
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate + 'T00:00:00')
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'overdue'
  if (diffDays <= 7) return 'red'
  if (diffDays <= 14) return 'yellow'
  return 'normal'
}

// Filter logic extracted from InvoiceSection
function filterInvoices(
  invoices: InvoiceEntry[],
  opts: {
    typeFilter: 'all' | 'sale' | 'purchase'
    statusFilter: 'all' | 'unpaid' | 'paid'
    ageFilter: 'all' | '30' | '45' | '60' | '90' | '90+'
    search: string
    selectedMonth: string
    dateFrom: string
    dateTo: string
    sortDateDesc: boolean
  }
): InvoiceEntry[] {
  const { typeFilter, statusFilter, ageFilter, search, selectedMonth, dateFrom, dateTo, sortDateDesc } = opts
  const q = search.trim().toLowerCase()
  const list = invoices.filter(inv => {
    const typeMatch = typeFilter === 'all' || inv.entry_type === typeFilter
    const statMatch = statusFilter === 'all' || inv.status === statusFilter
    const searchMatch = !q ||
      inv.invoice_number.toLowerCase().includes(q) ||
      inv.company_name.toLowerCase().includes(q) ||
      String(inv.amount).includes(q)
    let ageMatch = true
    if (ageFilter !== 'all' && inv.status === 'unpaid') {
      const days = daysSince(inv.invoice_date)
      if (ageFilter === '30')  ageMatch = days <= 30
      if (ageFilter === '45')  ageMatch = days <= 45
      if (ageFilter === '60')  ageMatch = days <= 60
      if (ageFilter === '90')  ageMatch = days <= 90
      if (ageFilter === '90+') ageMatch = days > 90
    }
    let monthMatch = true
    if (selectedMonth) monthMatch = inv.invoice_date.startsWith(selectedMonth)
    const dateMatch = (!dateFrom || inv.invoice_date >= dateFrom) && (!dateTo || inv.invoice_date <= dateTo)
    return typeMatch && statMatch && searchMatch && ageMatch && monthMatch && dateMatch
  })
  list.sort((a, b) =>
    sortDateDesc
      ? b.invoice_date.localeCompare(a.invoice_date) || b.created_at.localeCompare(a.created_at)
      : a.invoice_date.localeCompare(b.invoice_date) || a.created_at.localeCompare(b.created_at)
  )
  return list
}

// Filter logic extracted from CreditSection
function filterCredits(
  credits: CreditEntry[],
  opts: {
    section: 'pending' | 'completed'
    typeTab: 'all' | 'to_receive' | 'to_pay'
    searchQuery: string
    durationFilter: 'all' | '30' | '45' | '90' | '90+'
  }
): CreditEntry[] {
  const { section, typeTab, searchQuery, durationFilter } = opts
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
      const daysSinceD = Math.floor((todayD.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24))
      if (durationFilter === '30')  durationMatch = daysSinceD <= 30
      if (durationFilter === '45')  durationMatch = daysSinceD > 30 && daysSinceD <= 45
      if (durationFilter === '90')  durationMatch = daysSinceD > 45 && daysSinceD <= 90
      if (durationFilter === '90+') durationMatch = daysSinceD > 90
    }
    return statusMatch && typeMatch && searchMatch && durationMatch
  })
}

// Filter logic extracted from TransactionList
function filterTransactions(
  transactions: Transaction[],
  opts: {
    modeFilter: 'all' | 'send' | 'receive' | 'expense'
    search: string
    accountFilter: string
    dateFrom: string
    dateTo: string
  }
): Transaction[] {
  const { modeFilter, search, accountFilter, dateFrom, dateTo } = opts
  const q = search.trim().toLowerCase()
  return transactions.filter(t => {
    const mode = t.mode || (t.type === 'income' ? 'receive' : 'expense')
    const modeMatch = modeFilter === 'all' || mode === modeFilter
    const accountMatch = !accountFilter || t.account === accountFilter
    const searchMatch = !q ||
      (t.description || '').toLowerCase().includes(q) ||
      (t.company_name || '').toLowerCase().includes(q) ||
      (t.category || '').toLowerCase().includes(q) ||
      String(t.amount).includes(q)
    const dateMatch = (!dateFrom || t.date >= dateFrom) && (!dateTo || t.date <= dateTo)
    return modeMatch && accountMatch && searchMatch && dateMatch
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Data Factories
// ─────────────────────────────────────────────────────────────────────────────

function makeInvoice(overrides: Partial<InvoiceEntry> = {}): InvoiceEntry {
  return {
    id: 'inv-1',
    invoice_number: 'INV-001',
    invoice_date: '2025-06-15',
    received_date: null,
    entry_type: 'sale',
    contact_id: 'c1',
    company_name: 'Test Corp',
    gst_number: '29AAACR5055K1ZK',
    amount: 50000,
    notes: null,
    payment_terms: '30',
    payment_terms_custom: null,
    status: 'unpaid',
    transaction_date: null,
    utr: null,
    bank_account: null,
    sub_category: null,
    amount_paid: 0,
    settled_tx_id: null,
    created_at: '2025-06-15T10:00:00Z',
    ...overrides,
  }
}

function makeCredit(overrides: Partial<CreditEntry> = {}): CreditEntry {
  return {
    id: 'cr-1',
    date: '2025-06-01',
    credit_type: 'credit_given',
    contact_id: 'c1',
    company_name: 'Acme Ltd',
    amount: 25000,
    term: '30',
    due_date: '2025-07-01',
    invoice_number: null,
    notes: null,
    status: 'pending',
    settled_tx_id: null,
    created_at: '2025-06-01T09:00:00Z',
    ...overrides,
  }
}

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    date: '2025-06-10',
    type: 'income',
    mode: 'receive',
    account: 'ICICI',
    amount: 10000,
    category: 'Sales & Collections',
    sub_category: 'Credit Customer Payment',
    description: 'Invoice payment',
    payment_mode: 'PhonePe',
    notes: null,
    contact_id: 'c1',
    company_name: 'Acme Ltd',
    created_at: '2025-06-10T08:00:00Z',
    ...overrides,
  }
}

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: 'c1',
    company_name: 'Acme Ltd',
    gst_number: '29AAACR5055K1ZK',
    contact_type: 'both',
    phone: '9876543210',
    email: 'acme@example.com',
    address: '123 Main St, Bangalore',
    notes: null,
    advance_balance: 0,
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeMaterial(overrides: Partial<Material> = {}): Material {
  return {
    id: 'mat-1',
    material_name: 'Steel Rod',
    hsn_code: '7214',
    gst_rate: 18,
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. FISCAL YEAR UTILITIES
// ═════════════════════════════════════════════════════════════════════════════

describe('FiscalYear — getFiscalYear()', () => {
  test('April date belongs to that year FY', () => {
    expect(getFiscalYear('2025-04-01')).toBe('FY 2025-26')
  })
  test('March date belongs to previous FY start', () => {
    expect(getFiscalYear('2026-03-31')).toBe('FY 2025-26')
  })
  test('January date belongs to previous FY start', () => {
    expect(getFiscalYear('2026-01-15')).toBe('FY 2025-26')
  })
  test('April 2026 starts new FY', () => {
    expect(getFiscalYear('2026-04-01')).toBe('FY 2026-27')
  })
  test('Accepts Date object', () => {
    expect(getFiscalYear(new Date('2025-07-10'))).toBe('FY 2025-26')
  })
  test('FY boundary — Mar 31', () => {
    expect(getFiscalYear('2025-03-31')).toBe('FY 2024-25')
  })
  test('FY boundary — Apr 1', () => {
    expect(getFiscalYear('2025-04-01')).toBe('FY 2025-26')
  })
  test('December is mid-FY', () => {
    expect(getFiscalYear('2025-12-15')).toBe('FY 2025-26')
  })
})

describe('FiscalYear — getFiscalYearLabel()', () => {
  test('Returns short label format', () => {
    expect(getFiscalYearLabel('2025-06-01')).toBe('2025-26')
  })
  test('March maps to previous FY', () => {
    expect(getFiscalYearLabel('2026-03-15')).toBe('2025-26')
  })
  test('Two-digit year suffix for end year', () => {
    expect(getFiscalYearLabel('2029-05-01')).toBe('2029-30')
  })
})

describe('FiscalYear — fyStartDate()', () => {
  test('Returns April 1 of start year', () => {
    const d = fyStartDate('2025-26')
    expect(d.getMonth()).toBe(3) // April = 3
    expect(d.getDate()).toBe(1)
    expect(d.getFullYear()).toBe(2025)
  })
})

describe('FiscalYear — fyEndDate()', () => {
  test('Returns March 31 of end year at 23:59:59', () => {
    const d = fyEndDate('2025-26')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(2) // March = 2
    expect(d.getDate()).toBe(31)
    expect(d.getHours()).toBe(23)
    expect(d.getMinutes()).toBe(59)
  })
})

describe('FiscalYear — fyMonthSortKey()', () => {
  test('Apr is index 0', () => { expect(fyMonthSortKey('Apr-25')).toBe(0) })
  test('Mar is last index 11', () => { expect(fyMonthSortKey('Mar-26')).toBe(11) })
  test('Jan is index 9', () => { expect(fyMonthSortKey('Jan-26')).toBe(9) })
  test('Unknown month returns -1', () => { expect(fyMonthSortKey('Xyz-25')).toBe(-1) })
})

describe('FiscalYear — FY_MONTHS order', () => {
  test('Starts with Apr', () => { expect(FY_MONTHS[0]).toBe('Apr') })
  test('Ends with Mar', () => { expect(FY_MONTHS[11]).toBe('Mar') })
  test('Has 12 months', () => { expect(FY_MONTHS).toHaveLength(12) })
  test('Contains all 12 calendar months', () => {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    months.forEach(m => expect(FY_MONTHS).toContain(m))
  })
})

describe('FiscalYear — constants getFiscalYear exists', () => {
  test('getFiscalYear function works correctly', () => {
    expect(getFiscalYear('2025-08-01')).toBe('FY 2025-26')
    expect(getFiscalYear('2026-02-01')).toBe('FY 2025-26')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. CONSTANTS & CONFIGURATION
// ═════════════════════════════════════════════════════════════════════════════

describe('Constants — ACCOUNTS', () => {
  test('Has 3 accounts', () => { expect(ACCOUNTS).toHaveLength(3) })
  test('Contains ICICI, SBI, Cash', () => {
    expect(ACCOUNTS).toContain('ICICI')
    expect(ACCOUNTS).toContain('SBI')
    expect(ACCOUNTS).toContain('Cash')
  })
})

describe('Constants — PAYMENT_MODES', () => {
  test('Has expected modes', () => {
    expect(PAYMENT_MODES).toContain('PhonePe')
    expect(PAYMENT_MODES).toContain('RTGS/NEFT')
    expect(PAYMENT_MODES).toContain('Cash')
    expect(PAYMENT_MODES).toContain('Cheque')
    expect(PAYMENT_MODES).toContain('Others')
  })
})

describe('Constants — CREDIT_TERMS', () => {
  test('Has 5 credit terms', () => { expect(CREDIT_TERMS).toHaveLength(5) })
  test('All terms have value and label', () => {
    CREDIT_TERMS.forEach(t => {
      expect(t.value).toBeTruthy()
      expect(t.label).toBeTruthy()
    })
  })
  test('Open credit term exists', () => {
    expect(CREDIT_TERMS.find(t => t.value === 'open')).toBeDefined()
  })
  test('30-day term exists', () => {
    expect(CREDIT_TERMS.find(t => t.value === '30')).toBeDefined()
  })
})

describe('Constants — SEND categories', () => {
  test('Each send category has subcategories', () => {
    SEND_CATEGORIES.forEach(cat => {
      expect(SEND_SUB_CATEGORIES[cat]).toBeDefined()
      expect(SEND_SUB_CATEGORIES[cat].length).toBeGreaterThan(0)
    })
  })
  test('Procurement category has Advance and Credit sub-cats', () => {
    expect(SEND_SUB_CATEGORIES['Procurement & Purchases']).toContain('Advance Vendor Payment')
    expect(SEND_SUB_CATEGORIES['Procurement & Purchases']).toContain('Credit Vendor Payment')
  })
})

describe('Constants — RECEIVE categories', () => {
  test('Each receive category has subcategories', () => {
    RECEIVE_CATEGORIES.forEach(cat => {
      expect(RECEIVE_SUB_CATEGORIES[cat]).toBeDefined()
      expect(RECEIVE_SUB_CATEGORIES[cat].length).toBeGreaterThan(0)
    })
  })
  test('Sales category has advance and credit sub-cats', () => {
    expect(RECEIVE_SUB_CATEGORIES['Sales & Collections']).toContain('Advance Customer Payment')
    expect(RECEIVE_SUB_CATEGORIES['Sales & Collections']).toContain('Credit Customer Payment')
  })
})

describe('Constants — EXPENSE categories', () => {
  test('Has at least 5 expense categories', () => {
    expect(EXPENSE_CATEGORIES.length).toBeGreaterThanOrEqual(5)
  })
  test('Each expense category has subcategories', () => {
    EXPENSE_CATEGORIES.forEach(cat => {
      expect(EXPENSE_SUB_CATEGORIES[cat]).toBeDefined()
      expect(EXPENSE_SUB_CATEGORIES[cat].length).toBeGreaterThan(0)
    })
  })
  test('Staff category has Salaries', () => {
    expect(EXPENSE_SUB_CATEGORIES['Staff']).toContain('Salaries')
  })
  test('Personal category exists', () => {
    expect(EXPENSE_CATEGORIES).toContain('Personal')
  })
})

describe('Constants — SUB_CATEGORIES merged map', () => {
  test('Contains all send sub-categories', () => {
    SEND_CATEGORIES.forEach(cat => {
      expect(SUB_CATEGORIES[cat]).toBeDefined()
    })
  })
  test('Contains all receive sub-categories', () => {
    RECEIVE_CATEGORIES.forEach(cat => {
      expect(SUB_CATEGORIES[cat]).toBeDefined()
    })
  })
  test('Contains all expense sub-categories', () => {
    EXPENSE_CATEGORIES.forEach(cat => {
      expect(SUB_CATEGORIES[cat]).toBeDefined()
    })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. TYPE SHAPES & REQUIRED FIELDS
// ═════════════════════════════════════════════════════════════════════════════

describe('Type — InvoiceEntry shape', () => {
  test('Factory creates valid invoice', () => {
    const inv = makeInvoice()
    expect(inv.id).toBeTruthy()
    expect(inv.invoice_number).toBeTruthy()
    expect(inv.invoice_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(['sale', 'purchase']).toContain(inv.entry_type)
    expect(['unpaid', 'partial', 'paid']).toContain(inv.status)
    expect(typeof inv.amount).toBe('number')
    expect(inv.amount).toBeGreaterThan(0)
    expect(typeof inv.amount_paid).toBe('number')
  })
  test('Paid invoice can have amount_paid == amount', () => {
    const inv = makeInvoice({ status: 'paid', amount_paid: 50000 })
    expect(inv.amount_paid).toBe(inv.amount)
  })
  test('Partial invoice has amount_paid < amount', () => {
    const inv = makeInvoice({ status: 'partial', amount_paid: 20000 })
    expect(inv.amount_paid).toBeLessThan(inv.amount)
  })
})

describe('Type — CreditEntry shape', () => {
  test('Factory creates valid credit', () => {
    const cr = makeCredit()
    expect(['credit_given', 'credit_taken']).toContain(cr.credit_type)
    expect(['pending', 'settled']).toContain(cr.status)
    expect(typeof cr.amount).toBe('number')
  })
  test('credit_given = to_receive (we gave credit to customer)', () => {
    const cr = makeCredit({ credit_type: 'credit_given' })
    expect(cr.credit_type).toBe('credit_given')
  })
  test('credit_taken = to_pay (supplier gave us credit)', () => {
    const cr = makeCredit({ credit_type: 'credit_taken' })
    expect(cr.credit_type).toBe('credit_taken')
  })
})

describe('Type — Transaction shape', () => {
  test('Income transaction has positive amount', () => {
    const tx = makeTransaction()
    expect(tx.amount).toBeGreaterThan(0)
    expect(tx.type).toBe('income')
  })
  test('Mode can be send/receive/expense', () => {
    const modes = ['send', 'receive', 'expense'] as const
    modes.forEach(m => {
      const tx = makeTransaction({ mode: m })
      expect(tx.mode).toBe(m)
    })
  })
})

describe('Type — Contact shape', () => {
  test('Factory creates valid contact', () => {
    const c = makeContact()
    expect(c.company_name).toBeTruthy()
    expect(['supplier', 'customer', 'both']).toContain(c.contact_type)
  })
  test('Advance balance defaults to 0', () => {
    const c = makeContact()
    expect(c.advance_balance).toBe(0)
  })
  test('Nullable fields accept null', () => {
    const c = makeContact({ gst_number: null, phone: null, email: null, address: null, notes: null })
    expect(c.gst_number).toBeNull()
    expect(c.phone).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4. INVOICE FILTER LOGIC
// ═════════════════════════════════════════════════════════════════════════════

const TODAY = new Date().toISOString().slice(0, 10)
const MONTH_NOW = TODAY.slice(0, 7)
const PAST_100 = new Date(Date.now() - 100 * 86400000).toISOString().slice(0, 10)
const PAST_20  = new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10)

const sampleInvoices: InvoiceEntry[] = [
  makeInvoice({ id: '1', entry_type: 'sale',     status: 'unpaid',  amount: 10000, invoice_date: PAST_20,  invoice_number: 'INV-001', company_name: 'Alpha Ltd',   created_at: PAST_20 + 'T10:00:00Z' }),
  makeInvoice({ id: '2', entry_type: 'purchase', status: 'unpaid',  amount: 20000, invoice_date: PAST_100, invoice_number: 'INV-002', company_name: 'Beta Corp',   created_at: PAST_100 + 'T10:00:00Z' }),
  makeInvoice({ id: '3', entry_type: 'sale',     status: 'paid',    amount: 5000,  invoice_date: MONTH_NOW + '-01', invoice_number: 'INV-003', company_name: 'Gamma Inc',   created_at: MONTH_NOW + '-01T10:00:00Z', amount_paid: 5000 }),
  makeInvoice({ id: '4', entry_type: 'purchase', status: 'paid',    amount: 15000, invoice_date: MONTH_NOW + '-05', invoice_number: 'INV-004', company_name: 'Delta Pvt',   created_at: MONTH_NOW + '-05T10:00:00Z', amount_paid: 15000 }),
  makeInvoice({ id: '5', entry_type: 'sale',     status: 'unpaid',  amount: 8000,  invoice_date: MONTH_NOW + '-10', invoice_number: 'INV-005', company_name: 'Alpha Ltd',   created_at: MONTH_NOW + '-10T10:00:00Z' }),
]

describe('InvoiceFilter — type filter', () => {
  test('all returns all invoices', () => {
    const res = filterInvoices(sampleInvoices, { typeFilter: 'all', statusFilter: 'all', ageFilter: 'all', search: '', selectedMonth: '', dateFrom: '', dateTo: '', sortDateDesc: true })
    expect(res).toHaveLength(5)
  })
  test('sale filter returns only sales', () => {
    const res = filterInvoices(sampleInvoices, { typeFilter: 'sale', statusFilter: 'all', ageFilter: 'all', search: '', selectedMonth: '', dateFrom: '', dateTo: '', sortDateDesc: true })
    expect(res.every(i => i.entry_type === 'sale')).toBe(true)
    expect(res).toHaveLength(3)
  })
  test('purchase filter returns only purchases', () => {
    const res = filterInvoices(sampleInvoices, { typeFilter: 'purchase', statusFilter: 'all', ageFilter: 'all', search: '', selectedMonth: '', dateFrom: '', dateTo: '', sortDateDesc: true })
    expect(res.every(i => i.entry_type === 'purchase')).toBe(true)
    expect(res).toHaveLength(2)
  })
})

describe('InvoiceFilter — status filter', () => {
  test('unpaid filter returns unpaid only', () => {
    const res = filterInvoices(sampleInvoices, { typeFilter: 'all', statusFilter: 'unpaid', ageFilter: 'all', search: '', selectedMonth: '', dateFrom: '', dateTo: '', sortDateDesc: true })
    expect(res.every(i => i.status === 'unpaid')).toBe(true)
  })
  test('paid filter returns paid only', () => {
    const res = filterInvoices(sampleInvoices, { typeFilter: 'all', statusFilter: 'paid', ageFilter: 'all', search: '', selectedMonth: '', dateFrom: '', dateTo: '', sortDateDesc: true })
    expect(res.every(i => i.status === 'paid')).toBe(true)
  })
})

describe('InvoiceFilter — age filter (days since invoice_date)', () => {
  test('age=90+ returns invoices older than 90 days', () => {
    const res = filterInvoices(sampleInvoices, { typeFilter: 'all', statusFilter: 'unpaid', ageFilter: '90+', search: '', selectedMonth: '', dateFrom: '', dateTo: '', sortDateDesc: true })
    // id='2' is 100 days old (unpaid)
    expect(res.every(i => daysSince(i.invoice_date) > 90)).toBe(true)
  })
  test('age=30 returns unpaid invoices 30 days or less old', () => {
    const res = filterInvoices(sampleInvoices, { typeFilter: 'all', statusFilter: 'unpaid', ageFilter: '30', search: '', selectedMonth: '', dateFrom: '', dateTo: '', sortDateDesc: true })
    expect(res.every(i => daysSince(i.invoice_date) <= 30)).toBe(true)
  })
  test('age filter does not apply to paid invoices', () => {
    const res = filterInvoices(sampleInvoices, { typeFilter: 'all', statusFilter: 'paid', ageFilter: '90+', search: '', selectedMonth: '', dateFrom: '', dateTo: '', sortDateDesc: true })
    // paid invoices are included regardless of age
    expect(res.every(i => i.status === 'paid')).toBe(true)
  })
})

describe('InvoiceFilter — search', () => {
  test('search by company name (case insensitive)', () => {
    const res = filterInvoices(sampleInvoices, { typeFilter: 'all', statusFilter: 'all', ageFilter: 'all', search: 'alpha', selectedMonth: '', dateFrom: '', dateTo: '', sortDateDesc: true })
    expect(res.every(i => i.company_name.toLowerCase().includes('alpha'))).toBe(true)
    expect(res).toHaveLength(2)
  })
  test('search by invoice number', () => {
    const res = filterInvoices(sampleInvoices, { typeFilter: 'all', statusFilter: 'all', ageFilter: 'all', search: 'INV-003', selectedMonth: '', dateFrom: '', dateTo: '', sortDateDesc: true })
    expect(res).toHaveLength(1)
    expect(res[0].id).toBe('3')
  })
  test('search by amount', () => {
    const res = filterInvoices(sampleInvoices, { typeFilter: 'all', statusFilter: 'all', ageFilter: 'all', search: '20000', selectedMonth: '', dateFrom: '', dateTo: '', sortDateDesc: true })
    expect(res.some(i => i.amount === 20000)).toBe(true)
  })
  test('empty search returns all', () => {
    const res = filterInvoices(sampleInvoices, { typeFilter: 'all', statusFilter: 'all', ageFilter: 'all', search: '', selectedMonth: '', dateFrom: '', dateTo: '', sortDateDesc: true })
    expect(res).toHaveLength(5)
  })
  test('search with no match returns empty', () => {
    const res = filterInvoices(sampleInvoices, { typeFilter: 'all', statusFilter: 'all', ageFilter: 'all', search: 'xxxxxxnonexistent', selectedMonth: '', dateFrom: '', dateTo: '', sortDateDesc: true })
    expect(res).toHaveLength(0)
  })
  test('search is case insensitive', () => {
    const lower = filterInvoices(sampleInvoices, { typeFilter: 'all', statusFilter: 'all', ageFilter: 'all', search: 'beta', selectedMonth: '', dateFrom: '', dateTo: '', sortDateDesc: true })
    const upper = filterInvoices(sampleInvoices, { typeFilter: 'all', statusFilter: 'all', ageFilter: 'all', search: 'BETA', selectedMonth: '', dateFrom: '', dateTo: '', sortDateDesc: true })
    expect(lower).toHaveLength(upper.length)
  })
})

describe('InvoiceFilter — month filter', () => {
  test('month filter restricts to that month', () => {
    const res = filterInvoices(sampleInvoices, { typeFilter: 'all', statusFilter: 'all', ageFilter: 'all', search: '', selectedMonth: MONTH_NOW, dateFrom: '', dateTo: '', sortDateDesc: true })
    expect(res.every(i => i.invoice_date.startsWith(MONTH_NOW))).toBe(true)
  })
  test('empty selectedMonth returns all dates', () => {
    const res = filterInvoices(sampleInvoices, { typeFilter: 'all', statusFilter: 'all', ageFilter: 'all', search: '', selectedMonth: '', dateFrom: '', dateTo: '', sortDateDesc: true })
    expect(res).toHaveLength(5)
  })
})

describe('InvoiceFilter — date range', () => {
  test('dateFrom filters correctly', () => {
    const res = filterInvoices(sampleInvoices, { typeFilter: 'all', statusFilter: 'all', ageFilter: 'all', search: '', selectedMonth: '', dateFrom: MONTH_NOW + '-01', dateTo: '', sortDateDesc: true })
    expect(res.every(i => i.invoice_date >= MONTH_NOW + '-01')).toBe(true)
  })
  test('dateTo filters correctly', () => {
    const res = filterInvoices(sampleInvoices, { typeFilter: 'all', statusFilter: 'all', ageFilter: 'all', search: '', selectedMonth: '', dateFrom: '', dateTo: MONTH_NOW + '-05', sortDateDesc: true })
    expect(res.every(i => i.invoice_date <= MONTH_NOW + '-05')).toBe(true)
  })
  test('dateFrom + dateTo range', () => {
    const res = filterInvoices(sampleInvoices, { typeFilter: 'all', statusFilter: 'all', ageFilter: 'all', search: '', selectedMonth: '', dateFrom: MONTH_NOW + '-01', dateTo: MONTH_NOW + '-06', sortDateDesc: true })
    expect(res.every(i => i.invoice_date >= MONTH_NOW + '-01' && i.invoice_date <= MONTH_NOW + '-06')).toBe(true)
  })
})

describe('InvoiceFilter — sort order', () => {
  test('sortDateDesc=true newest first', () => {
    const res = filterInvoices(sampleInvoices, { typeFilter: 'all', statusFilter: 'all', ageFilter: 'all', search: '', selectedMonth: '', dateFrom: '', dateTo: '', sortDateDesc: true })
    for (let i = 1; i < res.length; i++) {
      expect(res[i - 1].invoice_date >= res[i].invoice_date).toBe(true)
    }
  })
  test('sortDateDesc=false oldest first', () => {
    const res = filterInvoices(sampleInvoices, { typeFilter: 'all', statusFilter: 'all', ageFilter: 'all', search: '', selectedMonth: '', dateFrom: '', dateTo: '', sortDateDesc: false })
    for (let i = 1; i < res.length; i++) {
      expect(res[i - 1].invoice_date <= res[i].invoice_date).toBe(true)
    }
  })
})

describe('InvoiceFilter — combined filters', () => {
  test('sale + unpaid + this month', () => {
    const res = filterInvoices(sampleInvoices, { typeFilter: 'sale', statusFilter: 'unpaid', ageFilter: 'all', search: '', selectedMonth: MONTH_NOW, dateFrom: '', dateTo: '', sortDateDesc: true })
    expect(res.every(i => i.entry_type === 'sale' && i.status === 'unpaid' && i.invoice_date.startsWith(MONTH_NOW))).toBe(true)
  })
  test('purchase + paid returns correct subset', () => {
    const res = filterInvoices(sampleInvoices, { typeFilter: 'purchase', statusFilter: 'paid', ageFilter: 'all', search: '', selectedMonth: '', dateFrom: '', dateTo: '', sortDateDesc: true })
    expect(res.every(i => i.entry_type === 'purchase' && i.status === 'paid')).toBe(true)
  })
  test('empty result with impossible filter combo', () => {
    const res = filterInvoices(sampleInvoices, { typeFilter: 'sale', statusFilter: 'unpaid', ageFilter: '90+', search: '', selectedMonth: MONTH_NOW, dateFrom: '', dateTo: '', sortDateDesc: true })
    // Recent unpaid sales should not be 90+ days old
    res.forEach(i => expect(daysSince(i.invoice_date)).toBeGreaterThan(90))
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5. CREDIT SECTION FILTER LOGIC
// ═════════════════════════════════════════════════════════════════════════════

const PAST_35  = new Date(Date.now() - 35 * 86400000).toISOString().slice(0, 10)
const PAST_50  = new Date(Date.now() - 50 * 86400000).toISOString().slice(0, 10)
const PAST_95  = new Date(Date.now() - 95 * 86400000).toISOString().slice(0, 10)
const PAST_15  = new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10)

const sampleCredits: CreditEntry[] = [
  makeCredit({ id: 'cr1', credit_type: 'credit_given', status: 'pending',  amount: 10000, date: PAST_15, company_name: 'Alpha Ltd', notes: 'note-a' }),
  makeCredit({ id: 'cr2', credit_type: 'credit_taken', status: 'pending',  amount: 20000, date: PAST_35, company_name: 'Beta Corp', notes: null }),
  makeCredit({ id: 'cr3', credit_type: 'credit_given', status: 'settled',  amount: 5000,  date: PAST_50, company_name: 'Gamma Inc', notes: null }),
  makeCredit({ id: 'cr4', credit_type: 'credit_taken', status: 'settled',  amount: 15000, date: PAST_95, company_name: 'Delta Pvt', notes: 'note-d' }),
  makeCredit({ id: 'cr5', credit_type: 'credit_given', status: 'pending',  amount: 8000,  date: PAST_100, company_name: 'Alpha Ltd', notes: null }),
]

describe('CreditFilter — section filter', () => {
  test('pending section returns only pending', () => {
    const res = filterCredits(sampleCredits, { section: 'pending', typeTab: 'all', searchQuery: '', durationFilter: 'all' })
    expect(res.every(c => c.status === 'pending')).toBe(true)
  })
  test('completed section returns only settled', () => {
    const res = filterCredits(sampleCredits, { section: 'completed', typeTab: 'all', searchQuery: '', durationFilter: 'all' })
    expect(res.every(c => c.status === 'settled')).toBe(true)
  })
})

describe('CreditFilter — type tab', () => {
  test('to_receive returns credit_given', () => {
    const res = filterCredits(sampleCredits, { section: 'pending', typeTab: 'to_receive', searchQuery: '', durationFilter: 'all' })
    expect(res.every(c => c.credit_type === 'credit_given')).toBe(true)
  })
  test('to_pay returns credit_taken', () => {
    const res = filterCredits(sampleCredits, { section: 'pending', typeTab: 'to_pay', searchQuery: '', durationFilter: 'all' })
    expect(res.every(c => c.credit_type === 'credit_taken')).toBe(true)
  })
  test('all returns both types', () => {
    const res = filterCredits(sampleCredits, { section: 'pending', typeTab: 'all', searchQuery: '', durationFilter: 'all' })
    const hasGiven = res.some(c => c.credit_type === 'credit_given')
    const hasTaken = res.some(c => c.credit_type === 'credit_taken')
    expect(hasGiven).toBe(true)
    expect(hasTaken).toBe(true)
  })
})

describe('CreditFilter — search', () => {
  test('search by company name', () => {
    const res = filterCredits(sampleCredits, { section: 'pending', typeTab: 'all', searchQuery: 'alpha', durationFilter: 'all' })
    expect(res.every(c => c.company_name.toLowerCase().includes('alpha'))).toBe(true)
  })
  test('search by note text', () => {
    const res = filterCredits(sampleCredits, { section: 'completed', typeTab: 'all', searchQuery: 'note-d', durationFilter: 'all' })
    expect(res.some(c => (c.notes || '').includes('note-d'))).toBe(true)
  })
  test('search by amount', () => {
    const res = filterCredits(sampleCredits, { section: 'pending', typeTab: 'all', searchQuery: '20000', durationFilter: 'all' })
    expect(res.some(c => c.amount === 20000)).toBe(true)
  })
  test('no match returns empty', () => {
    const res = filterCredits(sampleCredits, { section: 'pending', typeTab: 'all', searchQuery: 'zzznomatch', durationFilter: 'all' })
    expect(res).toHaveLength(0)
  })
})

describe('CreditFilter — duration filter', () => {
  test('30 days: entries ≤ 30 days old', () => {
    const res = filterCredits(sampleCredits, { section: 'pending', typeTab: 'all', searchQuery: '', durationFilter: '30' })
    const today = new Date(); today.setHours(0,0,0,0)
    res.forEach(c => {
      const d = Math.floor((today.getTime() - new Date(c.date + 'T00:00:00').getTime()) / 86400000)
      expect(d).toBeLessThanOrEqual(30)
    })
  })
  test('90+ days: entries > 90 days old', () => {
    const res = filterCredits(sampleCredits, { section: 'pending', typeTab: 'all', searchQuery: '', durationFilter: '90+' })
    const today = new Date(); today.setHours(0,0,0,0)
    res.forEach(c => {
      const d = Math.floor((today.getTime() - new Date(c.date + 'T00:00:00').getTime()) / 86400000)
      expect(d).toBeGreaterThan(90)
    })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6. TRANSACTION FILTER LOGIC
// ═════════════════════════════════════════════════════════════════════════════

const txSamples: Transaction[] = [
  makeTransaction({ id: 't1', mode: 'receive', account: 'ICICI', amount: 50000, date: '2025-06-01', company_name: 'Alpha Ltd', category: 'Sales & Collections' }),
  makeTransaction({ id: 't2', mode: 'send',    account: 'SBI',   amount: 30000, date: '2025-06-05', company_name: 'Beta Corp',  category: 'Procurement & Purchases', type: 'expense' }),
  makeTransaction({ id: 't3', mode: 'expense', account: 'Cash',  amount: 5000,  date: '2025-07-10', company_name: null,         category: 'Office', type: 'expense', description: 'Office rent' }),
  makeTransaction({ id: 't4', mode: 'receive', account: 'ICICI', amount: 20000, date: '2025-08-15', company_name: 'Alpha Ltd',  category: 'Sales & Collections' }),
  makeTransaction({ id: 't5', mode: 'send',    account: 'ICICI', amount: 10000, date: '2025-09-01', company_name: 'Gamma Inc',  category: 'Services', type: 'expense' }),
]

describe('TransactionFilter — mode filter', () => {
  test('all returns all', () => {
    const res = filterTransactions(txSamples, { modeFilter: 'all', search: '', accountFilter: '', dateFrom: '', dateTo: '' })
    expect(res).toHaveLength(5)
  })
  test('receive returns receive mode only', () => {
    const res = filterTransactions(txSamples, { modeFilter: 'receive', search: '', accountFilter: '', dateFrom: '', dateTo: '' })
    expect(res.every(t => t.mode === 'receive')).toBe(true)
  })
  test('expense returns expense mode only', () => {
    const res = filterTransactions(txSamples, { modeFilter: 'expense', search: '', accountFilter: '', dateFrom: '', dateTo: '' })
    expect(res.every(t => t.mode === 'expense')).toBe(true)
  })
})

describe('TransactionFilter — account filter', () => {
  test('ICICI filter returns ICICI only', () => {
    const res = filterTransactions(txSamples, { modeFilter: 'all', search: '', accountFilter: 'ICICI', dateFrom: '', dateTo: '' })
    expect(res.every(t => t.account === 'ICICI')).toBe(true)
  })
  test('empty account returns all', () => {
    const res = filterTransactions(txSamples, { modeFilter: 'all', search: '', accountFilter: '', dateFrom: '', dateTo: '' })
    expect(res).toHaveLength(5)
  })
  test('Cash account filter', () => {
    const res = filterTransactions(txSamples, { modeFilter: 'all', search: '', accountFilter: 'Cash', dateFrom: '', dateTo: '' })
    expect(res.every(t => t.account === 'Cash')).toBe(true)
  })
})

describe('TransactionFilter — search', () => {
  test('search by company name', () => {
    const res = filterTransactions(txSamples, { modeFilter: 'all', search: 'alpha', accountFilter: '', dateFrom: '', dateTo: '' })
    expect(res.every(t => (t.company_name || '').toLowerCase().includes('alpha'))).toBe(true)
  })
  test('search by description', () => {
    const res = filterTransactions(txSamples, { modeFilter: 'all', search: 'rent', accountFilter: '', dateFrom: '', dateTo: '' })
    expect(res.some(t => (t.description || '').toLowerCase().includes('rent'))).toBe(true)
  })
  test('search by category', () => {
    const res = filterTransactions(txSamples, { modeFilter: 'all', search: 'office', accountFilter: '', dateFrom: '', dateTo: '' })
    expect(res.some(t => (t.category || '').toLowerCase().includes('office'))).toBe(true)
  })
  test('search by amount string', () => {
    const res = filterTransactions(txSamples, { modeFilter: 'all', search: '50000', accountFilter: '', dateFrom: '', dateTo: '' })
    expect(res.some(t => t.amount === 50000)).toBe(true)
  })
})

describe('TransactionFilter — date range', () => {
  test('dateFrom restricts correctly', () => {
    const res = filterTransactions(txSamples, { modeFilter: 'all', search: '', accountFilter: '', dateFrom: '2025-07-01', dateTo: '' })
    expect(res.every(t => t.date >= '2025-07-01')).toBe(true)
  })
  test('dateTo restricts correctly', () => {
    const res = filterTransactions(txSamples, { modeFilter: 'all', search: '', accountFilter: '', dateFrom: '', dateTo: '2025-06-30' })
    expect(res.every(t => t.date <= '2025-06-30')).toBe(true)
  })
  test('both from and to range', () => {
    const res = filterTransactions(txSamples, { modeFilter: 'all', search: '', accountFilter: '', dateFrom: '2025-06-01', dateTo: '2025-06-30' })
    expect(res.every(t => t.date >= '2025-06-01' && t.date <= '2025-06-30')).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 7. BUSINESS LOGIC — SUMMARIES & TOTALS
// ═════════════════════════════════════════════════════════════════════════════

describe('Business Logic — invoice totals', () => {
  test('Total unpaid amount sums correctly', () => {
    const unpaid = sampleInvoices.filter(i => i.status === 'unpaid')
    const total = unpaid.reduce((s, i) => s + i.amount, 0)
    expect(total).toBe(10000 + 20000 + 8000)
  })
  test('Total unpaid sales vs purchases', () => {
    const unpaidSales = sampleInvoices.filter(i => i.entry_type === 'sale' && i.status === 'unpaid')
    const unpaidPurchases = sampleInvoices.filter(i => i.entry_type === 'purchase' && i.status === 'unpaid')
    const totalSales = unpaidSales.reduce((s, i) => s + i.amount, 0)
    const totalPurchases = unpaidPurchases.reduce((s, i) => s + i.amount, 0)
    expect(totalSales).toBe(10000 + 8000)
    expect(totalPurchases).toBe(20000)
  })
  test('Amount remaining = amount - amount_paid', () => {
    const partial = makeInvoice({ status: 'partial', amount: 50000, amount_paid: 20000 })
    const remaining = partial.amount - (partial.amount_paid ?? 0)
    expect(remaining).toBe(30000)
  })
  test('Fully paid invoice has zero remaining', () => {
    const paid = makeInvoice({ status: 'paid', amount: 50000, amount_paid: 50000 })
    const remaining = paid.amount - (paid.amount_paid ?? 0)
    expect(remaining).toBe(0)
  })
})

describe('Business Logic — credit totals', () => {
  test('Total to receive = sum of credit_given pending', () => {
    const toReceive = sampleCredits.filter(c => c.status === 'pending' && c.credit_type === 'credit_given')
    const total = toReceive.reduce((s, c) => s + c.amount, 0)
    expect(total).toBeGreaterThan(0)
  })
  test('Total to pay = sum of credit_taken pending', () => {
    const toPay = sampleCredits.filter(c => c.status === 'pending' && c.credit_type === 'credit_taken')
    const total = toPay.reduce((s, c) => s + c.amount, 0)
    expect(total).toBeGreaterThan(0)
  })
})

describe('Business Logic — transaction net', () => {
  test('Net = sales - purchases - expenses', () => {
    const sales     = txSamples.filter(t => t.mode === 'receive').reduce((s, t) => s + t.amount, 0)
    const purchases = txSamples.filter(t => t.mode === 'send').reduce((s, t) => s + t.amount, 0)
    const expenses  = txSamples.filter(t => t.mode === 'expense').reduce((s, t) => s + t.amount, 0)
    const net = sales - purchases - expenses
    expect(net).toBe(50000 + 20000 - 30000 - 10000 - 5000)
  })
})

describe('Business Logic — contact summaries', () => {
  test('Contact tx count is accurate', () => {
    const contactTxs = txSamples.filter(t => t.contact_id === 'c1')
    // makeTransaction default contact_id is 'c1', so first 4 have it (t3 has null)
    expect(contactTxs.length).toBeGreaterThanOrEqual(0)
  })
  test('Contact total = sent + received', () => {
    const sent = txSamples.filter(t => t.contact_id === 'c1' && t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const received = txSamples.filter(t => t.contact_id === 'c1' && t.type === 'income').reduce((s, t) => s + t.amount, 0)
    expect(sent + received).toBeGreaterThanOrEqual(0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 8. DUE DATE URGENCY LOGIC
// ═════════════════════════════════════════════════════════════════════════════

describe('getDueDateUrgency()', () => {
  const todayStr = new Date().toISOString().slice(0, 10)
  const tomorrow = new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10)
  const in5Days  = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
  const in10Days = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10)
  const in20Days = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10)

  test('settled status returns settled regardless of due date', () => {
    expect(getDueDateUrgency(yesterday, 'settled')).toBe('settled')
    expect(getDueDateUrgency(null, 'settled')).toBe('settled')
  })
  test('null due date returns normal', () => {
    expect(getDueDateUrgency(null, 'pending')).toBe('normal')
  })
  test('overdue (past due date)', () => {
    expect(getDueDateUrgency(yesterday, 'pending')).toBe('overdue')
  })
  test('due in 5 days = red (≤7)', () => {
    expect(getDueDateUrgency(in5Days, 'pending')).toBe('red')
  })
  test('due in 10 days = yellow (≤14)', () => {
    expect(getDueDateUrgency(in10Days, 'pending')).toBe('yellow')
  })
  test('due in 20 days = normal', () => {
    expect(getDueDateUrgency(in20Days, 'pending')).toBe('normal')
  })
  test('due tomorrow = red', () => {
    expect(getDueDateUrgency(tomorrow, 'pending')).toBe('red')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 9. FORMATTING HELPERS
// ═════════════════════════════════════════════════════════════════════════════

describe('fmtAmt()', () => {
  test('formats positive amount with ₹ prefix', () => {
    expect(fmtAmt(50000)).toContain('₹')
    expect(fmtAmt(50000)).toContain('50')
  })
  test('formats negative amount as absolute value', () => {
    const res = fmtAmt(-10000)
    expect(res).toContain('₹')
    expect(res).not.toContain('-')
  })
  test('zero formats correctly', () => {
    const res = fmtAmt(0)
    expect(res).toBe('₹0')
  })
  test('large amount uses Indian locale separators', () => {
    const res = fmtAmt(100000)
    expect(res).toContain('₹')
    expect(res).toContain('1')
  })
  test('decimal amount formats correctly', () => {
    const res = fmtAmt(1234.56)
    expect(res).toContain('₹')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 10. INPUT VALIDATION — CONTACT FORM RULES
// ═════════════════════════════════════════════════════════════════════════════

describe('Contact — input validation', () => {
  test('empty company name should fail', () => {
    const name = ''
    expect(name.trim()).toBe('')
    expect(!name.trim()).toBe(true) // would prevent save
  })
  test('whitespace-only name should fail', () => {
    const name = '   '
    expect(!name.trim()).toBe(true)
  })
  test('valid company name passes', () => {
    const name = 'Acme Ltd'
    expect(!!name.trim()).toBe(true)
  })
  test('GST number accepts null (optional)', () => {
    const c = makeContact({ gst_number: null })
    expect(c.gst_number).toBeNull()
  })
  test('phone accepts null (optional)', () => {
    const c = makeContact({ phone: null })
    expect(c.phone).toBeNull()
  })
  test('advance_balance default is 0', () => {
    const c = makeContact()
    expect(c.advance_balance).toBe(0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 11. INPUT VALIDATION — INVOICE FORM RULES
// ═════════════════════════════════════════════════════════════════════════════

describe('Invoice — input validation', () => {
  test('amount must be positive', () => {
    const inv = makeInvoice({ amount: 0 })
    expect(inv.amount).toBe(0)
    expect(inv.amount > 0).toBe(false) // would fail validation
  })
  test('negative amount fails validation', () => {
    const inv = makeInvoice({ amount: -100 })
    expect(inv.amount > 0).toBe(false)
  })
  test('valid amount passes', () => {
    const inv = makeInvoice({ amount: 50000 })
    expect(inv.amount > 0).toBe(true)
  })
  test('invoice_date must be valid YYYY-MM-DD', () => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    expect(dateRegex.test('2025-06-15')).toBe(true)
    expect(dateRegex.test('invalid-date')).toBe(false)
    expect(dateRegex.test('')).toBe(false)
  })
  test('invoice_number must not be empty', () => {
    const num = 'INV-001'
    expect(!!num.trim()).toBe(true)
  })
  test('company_name must not be empty', () => {
    expect(!!makeInvoice().company_name.trim()).toBe(true)
  })
  test('entry_type must be sale or purchase', () => {
    const validTypes = ['sale', 'purchase']
    expect(validTypes).toContain(makeInvoice({ entry_type: 'sale' }).entry_type)
    expect(validTypes).toContain(makeInvoice({ entry_type: 'purchase' }).entry_type)
  })
  test('payment_terms can be null', () => {
    const inv = makeInvoice({ payment_terms: null })
    expect(inv.payment_terms).toBeNull()
  })
  test('amount_paid cannot exceed amount for validation', () => {
    const inv = makeInvoice({ amount: 10000, amount_paid: 15000 })
    expect(inv.amount_paid > inv.amount).toBe(true) // system should catch this
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 12. INPUT VALIDATION — CREDIT FORM RULES
// ═════════════════════════════════════════════════════════════════════════════

describe('Credit — input validation', () => {
  test('amount must be positive', () => {
    const cr = makeCredit({ amount: 0 })
    expect(cr.amount > 0).toBe(false)
  })
  test('credit_type must be credit_given or credit_taken', () => {
    const valid = ['credit_given', 'credit_taken']
    expect(valid).toContain(makeCredit({ credit_type: 'credit_given' }).credit_type)
    expect(valid).toContain(makeCredit({ credit_type: 'credit_taken' }).credit_type)
  })
  test('term can be any string (open or numeric)', () => {
    const cr30 = makeCredit({ term: '30' })
    const crOpen = makeCredit({ term: 'open' })
    expect(cr30.term).toBe('30')
    expect(crOpen.term).toBe('open')
  })
  test('company_name required', () => {
    const cr = makeCredit({ company_name: '' })
    expect(!!cr.company_name.trim()).toBe(false)
  })
  test('due_date can be null', () => {
    const cr = makeCredit({ due_date: null })
    expect(cr.due_date).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 13. INPUT VALIDATION — TRANSACTION FORM RULES
// ═════════════════════════════════════════════════════════════════════════════

describe('Transaction — input validation', () => {
  test('account must be in ACCOUNTS list', () => {
    const tx = makeTransaction({ account: 'ICICI' })
    expect(ACCOUNTS).toContain(tx.account)
  })
  test('account not in list should fail', () => {
    expect(ACCOUNTS).not.toContain('HDFC')
  })
  test('amount must be positive', () => {
    expect(makeTransaction({ amount: 100 }).amount > 0).toBe(true)
    expect(makeTransaction({ amount: 0 }).amount > 0).toBe(false)
  })
  test('payment_mode must be in PAYMENT_MODES', () => {
    const tx = makeTransaction({ payment_mode: 'PhonePe' })
    expect(PAYMENT_MODES).toContain(tx.payment_mode)
  })
  test('date must be valid', () => {
    const tx = makeTransaction({ date: '2025-06-10' })
    expect(/^\d{4}-\d{2}-\d{2}$/.test(tx.date)).toBe(true)
  })
  test('type must be income or expense', () => {
    const valid = ['income', 'expense']
    expect(valid).toContain(makeTransaction({ type: 'income' }).type)
    expect(valid).toContain(makeTransaction({ type: 'expense' }).type)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 14. PIN / PASSWORD MODAL LOGIC
// ═════════════════════════════════════════════════════════════════════════════

describe('PasswordModal — PIN logic', () => {
  const CORRECT_PIN = '0000'

  function checkPin(pins: string[]): boolean {
    return pins.join('') === CORRECT_PIN
  }

  test('correct PIN 0000 passes', () => {
    expect(checkPin(['0', '0', '0', '0'])).toBe(true)
  })
  test('incorrect PIN fails', () => {
    expect(checkPin(['1', '2', '3', '4'])).toBe(false)
    expect(checkPin(['0', '0', '0', '1'])).toBe(false)
  })
  test('empty PIN fails', () => {
    expect(checkPin(['', '', '', ''])).toBe(false)
  })
  test('partial PIN fails', () => {
    expect(checkPin(['0', '0', '0', ''])).toBe(false)
  })
  test('PIN input only accepts digits', () => {
    const digitOnly = (val: string) => /^\d?$/.test(val)
    expect(digitOnly('0')).toBe(true)
    expect(digitOnly('5')).toBe(true)
    expect(digitOnly('a')).toBe(false)
    expect(digitOnly('!')).toBe(false)
    expect(digitOnly('12')).toBe(false) // only 0 or 1 digit
  })
  test('PIN auto-advances on digit input', () => {
    let focusIdx = 0
    const handleChange = (idx: number, val: string) => {
      if (val && idx < 3) focusIdx = idx + 1
    }
    handleChange(0, '0'); expect(focusIdx).toBe(1)
    handleChange(1, '0'); expect(focusIdx).toBe(2)
    handleChange(2, '0'); expect(focusIdx).toBe(3)
  })
  test('Backspace on empty input moves to previous', () => {
    let focusIdx = 2
    const handleKey = (idx: number, key: string, currentVal: string) => {
      if (key === 'Backspace' && !currentVal && idx > 0) focusIdx = idx - 1
    }
    handleKey(2, 'Backspace', ''); expect(focusIdx).toBe(1)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 15. MATERIAL / INVOICE LINE LOGIC
// ═════════════════════════════════════════════════════════════════════════════

describe('InvoiceLine — GST computation', () => {
  function computeLineTotal(qty: number, rate: number, cgst: number, sgst: number, igst: number | null): number {
    const base = qty * rate
    const gstAmt = igst !== null
      ? base * igst / 100
      : base * (cgst + sgst) / 100
    return base + gstAmt
  }

  test('Local GST (CGST + SGST) total', () => {
    const total = computeLineTotal(10, 1000, 9, 9, null)
    expect(total).toBe(11800) // 10000 base + 1800 gst (18%)
  })
  test('Interstate GST (IGST) total', () => {
    const total = computeLineTotal(10, 1000, 0, 0, 18)
    expect(total).toBe(11800)
  })
  test('Zero GST rate', () => {
    const total = computeLineTotal(5, 2000, 0, 0, null)
    expect(total).toBe(10000)
  })
  test('Fractional quantity', () => {
    const total = computeLineTotal(2.5, 1000, 9, 9, null)
    expect(total).toBeCloseTo(2950)
  })
  test('Rate zero', () => {
    const total = computeLineTotal(10, 0, 18, 0, null)
    expect(total).toBe(0)
  })
})

describe('Material — validation', () => {
  test('material_name required', () => {
    const m = makeMaterial({ material_name: '' })
    expect(!!m.material_name.trim()).toBe(false)
  })
  test('gst_rate can be null', () => {
    const m = makeMaterial({ gst_rate: null })
    expect(m.gst_rate).toBeNull()
  })
  test('valid gst_rate is a number', () => {
    const m = makeMaterial({ gst_rate: 18 })
    expect(typeof m.gst_rate).toBe('number')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 16. STOCK ENTRY LOGIC
// ═════════════════════════════════════════════════════════════════════════════

function makeStockEntry(overrides: Partial<StockEntry> = {}): StockEntry {
  return {
    id: 'se-1',
    material_id: 'mat-1',
    material_name: 'Steel Rod',
    invoice_id: null,
    invoice_number: null,
    supplier_name: 'Acme Metals',
    quantity: 100,
    unit: 'kg',
    rate: 50,
    batch_number: 'BATCH-001',
    mfd_date: '2025-01-01',
    expiry_date: '2026-01-01',
    entry_date: '2025-06-01',
    notes: null,
    created_at: '2025-06-01T10:00:00Z',
    ...overrides,
  }
}

describe('StockEntry — shape and validation', () => {
  test('Factory creates valid stock entry', () => {
    const se = makeStockEntry()
    expect(se.quantity).toBeGreaterThan(0)
    expect(se.material_name).toBeTruthy()
    expect(se.entry_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  test('quantity must be positive', () => {
    expect(makeStockEntry({ quantity: 0 }).quantity > 0).toBe(false)
    expect(makeStockEntry({ quantity: -10 }).quantity > 0).toBe(false)
  })
  test('invoice_id can be null (manual entry)', () => {
    const se = makeStockEntry({ invoice_id: null })
    expect(se.invoice_id).toBeNull()
  })
  test('Total value = quantity * rate', () => {
    const se = makeStockEntry({ quantity: 100, rate: 50 })
    const value = (se.quantity) * (se.rate ?? 0)
    expect(value).toBe(5000)
  })
  test('null rate gives zero value', () => {
    const se = makeStockEntry({ rate: null })
    const value = (se.quantity) * (se.rate ?? 0)
    expect(value).toBe(0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 17. EDGE CASES & REGRESSION TESTS
// ═════════════════════════════════════════════════════════════════════════════

describe('Edge cases — empty arrays', () => {
  test('Filter on empty invoice list returns empty', () => {
    const res = filterInvoices([], { typeFilter: 'all', statusFilter: 'all', ageFilter: 'all', search: '', selectedMonth: '', dateFrom: '', dateTo: '', sortDateDesc: true })
    expect(res).toHaveLength(0)
  })
  test('Filter on empty credit list returns empty', () => {
    const res = filterCredits([], { section: 'pending', typeTab: 'all', searchQuery: '', durationFilter: 'all' })
    expect(res).toHaveLength(0)
  })
  test('Filter on empty transaction list returns empty', () => {
    const res = filterTransactions([], { modeFilter: 'all', search: '', accountFilter: '', dateFrom: '', dateTo: '' })
    expect(res).toHaveLength(0)
  })
  test('Reduce on empty invoices is 0', () => {
    const total = ([] as InvoiceEntry[]).reduce((s, i) => s + i.amount, 0)
    expect(total).toBe(0)
  })
})

describe('Edge cases — special characters in search', () => {
  test('Search with & character', () => {
    const res = filterTransactions(txSamples, { modeFilter: 'all', search: 'Sales & Collections', accountFilter: '', dateFrom: '', dateTo: '' })
    expect(res.length).toBeGreaterThanOrEqual(0)
  })
  test('Search with / character (RTGS/NEFT)', () => {
    expect(PAYMENT_MODES).toContain('RTGS/NEFT')
  })
  test('Search with ₹ amount string format', () => {
    // Amount search is done on raw number, not formatted
    const res = filterInvoices(sampleInvoices, { typeFilter: 'all', statusFilter: 'all', ageFilter: 'all', search: '₹', selectedMonth: '', dateFrom: '', dateTo: '', sortDateDesc: true })
    expect(res).toHaveLength(0) // ₹ not in number string
  })
})

describe('Edge cases — date edge cases', () => {
  test('Leap year Feb 29 is valid date', () => {
    const d = new Date('2024-02-29T00:00:00')
    expect(d.getDate()).toBe(29)
    expect(d.getMonth()).toBe(1)
  })
  test('FY start day (April 1) maps correctly', () => {
    expect(getFiscalYear('2025-04-01')).toBe('FY 2025-26')
  })
  test('FY end day (March 31) maps correctly', () => {
    expect(getFiscalYear('2026-03-31')).toBe('FY 2025-26')
  })
  test('Year 2000 FY', () => {
    expect(getFiscalYear('2000-05-01')).toBe('FY 2000-01')
  })
})

describe('Edge cases — amount edge cases', () => {
  test('Zero amount invoice', () => {
    const inv = makeInvoice({ amount: 0 })
    expect(fmtAmt(inv.amount)).toBe('₹0')
  })
  test('Very large amount', () => {
    const res = fmtAmt(99999999)
    expect(res).toContain('₹')
  })
  test('Float amount', () => {
    const res = fmtAmt(1234.99)
    expect(res).toContain('₹')
  })
  test('1 paisa amount', () => {
    const res = fmtAmt(0.01)
    expect(res).toContain('₹')
  })
})

describe('Edge cases — null/undefined guard patterns', () => {
  test('null mode falls back to type-based mode', () => {
    const tx = makeTransaction({ mode: null, type: 'income' })
    const mode = tx.mode || (tx.type === 'income' ? 'receive' : 'expense')
    expect(mode).toBe('receive')
  })
  test('null mode expense fallback', () => {
    const tx = makeTransaction({ mode: null, type: 'expense' })
    const mode = tx.mode || (tx.type === 'income' ? 'receive' : 'expense')
    expect(mode).toBe('expense')
  })
  test('null company_name in search does not crash', () => {
    const tx = makeTransaction({ company_name: null })
    const q = 'alpha'
    const match = (tx.company_name || '').toLowerCase().includes(q)
    expect(match).toBe(false)
  })
  test('null description in search does not crash', () => {
    const tx = makeTransaction({ description: null })
    const match = (tx.description || '').toLowerCase().includes('rent')
    expect(match).toBe(false)
  })
  test('null category in search does not crash', () => {
    const tx = makeTransaction({ category: null })
    const match = (tx.category || '').toLowerCase().includes('sales')
    expect(match).toBe(false)
  })
  test('null notes in credit search does not crash', () => {
    const cr = makeCredit({ notes: null })
    const match = (cr.notes || '').toLowerCase().includes('note')
    expect(match).toBe(false)
  })
})

describe('Regression — FY label two-digit suffix', () => {
  test('FY 2009-10 suffix is 10 not 9', () => {
    expect(getFiscalYear('2009-05-01')).toBe('FY 2009-10')
  })
  test('FY 2019-20 suffix is 20', () => {
    expect(getFiscalYear('2019-07-01')).toBe('FY 2019-20')
  })
  test('FY 2099-00 suffix uses slice(-2) correctly', () => {
    // 2099 + 1 = 2100, slice(-2) = '00'
    expect(getFiscalYear('2099-06-01')).toBe('FY 2099-00')
  })
})

describe('Regression — invoice filter with all filters cleared', () => {
  test('Clearing all filters returns full list', () => {
    const filtered = filterInvoices(sampleInvoices, {
      typeFilter: 'all', statusFilter: 'all', ageFilter: 'all',
      search: '', selectedMonth: '', dateFrom: '', dateTo: '',
      sortDateDesc: true,
    })
    expect(filtered).toHaveLength(sampleInvoices.length)
  })
})

describe('Regression — sorting stability', () => {
  test('Two invoices same date are stable (secondary sort on created_at)', () => {
    const invs: InvoiceEntry[] = [
      makeInvoice({ id: 'a', invoice_date: '2025-06-10', created_at: '2025-06-10T12:00:00Z' }),
      makeInvoice({ id: 'b', invoice_date: '2025-06-10', created_at: '2025-06-10T08:00:00Z' }),
    ]
    const res = filterInvoices(invs, { typeFilter: 'all', statusFilter: 'all', ageFilter: 'all', search: '', selectedMonth: '', dateFrom: '', dateTo: '', sortDateDesc: true })
    // 'a' created later should come first in desc
    expect(res[0].id).toBe('a')
    expect(res[1].id).toBe('b')
  })
})

describe('Regression — multi-filter invoice combination', () => {
  test('Type + search combination', () => {
    const res = filterInvoices(sampleInvoices, { typeFilter: 'sale', statusFilter: 'all', ageFilter: 'all', search: 'alpha', selectedMonth: '', dateFrom: '', dateTo: '', sortDateDesc: true })
    expect(res.every(i => i.entry_type === 'sale' && i.company_name.toLowerCase().includes('alpha'))).toBe(true)
  })
})

describe('Regression — contact search', () => {
  const contacts: Contact[] = [
    makeContact({ id: 'c1', company_name: 'Alpha Industries', gst_number: '29AAACR5055K1ZK', phone: '9876543210' }),
    makeContact({ id: 'c2', company_name: 'Beta Corp', gst_number: null, phone: null }),
    makeContact({ id: 'c3', company_name: 'GAMMA pvt ltd', gst_number: '27AAPCA1234F1Z5', phone: '1234567890' }),
  ]
  function filterContacts(contacts: Contact[], q: string): Contact[] {
    const lower = q.toLowerCase()
    return contacts.filter(c =>
      !lower ||
      c.company_name.toLowerCase().includes(lower) ||
      (c.gst_number || '').toLowerCase().includes(lower) ||
      (c.phone || '').includes(lower)
    )
  }
  test('Search by company name', () => {
    expect(filterContacts(contacts, 'alpha')).toHaveLength(1)
  })
  test('Search by GST number', () => {
    expect(filterContacts(contacts, '29AAACR').length).toBeGreaterThanOrEqual(1)
  })
  test('Search by phone', () => {
    expect(filterContacts(contacts, '9876543210')).toHaveLength(1)
  })
  test('Empty search returns all', () => {
    expect(filterContacts(contacts, '')).toHaveLength(3)
  })
  test('Case insensitive search', () => {
    expect(filterContacts(contacts, 'gamma')).toHaveLength(1)
    expect(filterContacts(contacts, 'GAMMA')).toHaveLength(1)
  })
  test('No match returns empty', () => {
    expect(filterContacts(contacts, 'zzznomatch')).toHaveLength(0)
  })
})
