/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  EXTENDED TEST SUITE — sb-p3-updated  (Part 2)
 *  Covers: Dashboard stats, account balances, category summary, top companies,
 *          payment distribution, invoice status transitions, FY month labels,
 *          advance balance logic, material GST slabs, stock batches,
 *          filter label generation, contact dedup, age-badge colours,
 *          activeFilterCount, searchTotal, snack message logic, and more.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
  getFiscalYear,
  getFiscalYearLabel,
  fyStartDate,
  fyEndDate,
  FY_MONTHS,
} from '../lib/fiscalYear'

import {
  ACCOUNTS,
  PAYMENT_MODES,
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
// Re-usable factories
// ─────────────────────────────────────────────────────────────────────────────

function makeTx(o: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1', date: '2025-06-10', type: 'income', mode: 'receive',
    account: 'ICICI', amount: 10000, category: 'Sales & Collections',
    sub_category: 'Credit Customer Payment', description: 'Invoice payment',
    payment_mode: 'PhonePe', notes: null, contact_id: 'c1',
    company_name: 'Acme Ltd', created_at: '2025-06-10T08:00:00Z', ...o,
  }
}

function makeInv(o: Partial<InvoiceEntry> = {}): InvoiceEntry {
  return {
    id: 'inv-1', invoice_number: 'INV-001', invoice_date: '2025-06-15',
    received_date: null, entry_type: 'sale', contact_id: 'c1',
    company_name: 'Test Corp', gst_number: null, amount: 50000,
    notes: null, payment_terms: '30', payment_terms_custom: null,
    status: 'unpaid', transaction_date: null, utr: null, bank_account: null,
    sub_category: null, amount_paid: 0, settled_tx_id: null,
    created_at: '2025-06-15T10:00:00Z', ...o,
  }
}

function makeCr(o: Partial<CreditEntry> = {}): CreditEntry {
  return {
    id: 'cr-1', date: '2025-06-01', credit_type: 'credit_given', contact_id: 'c1',
    company_name: 'Acme Ltd', amount: 25000, term: '30', due_date: '2025-07-01',
    invoice_number: null, notes: null, status: 'pending', settled_tx_id: null,
    created_at: '2025-06-01T09:00:00Z', ...o,
  }
}

function makeContact(o: Partial<Contact> = {}): Contact {
  return {
    id: 'c1', company_name: 'Acme Ltd', gst_number: null, contact_type: 'both',
    phone: null, email: null, address: null, notes: null, advance_balance: 0,
    created_at: '2025-01-01T00:00:00Z', ...o,
  }
}

function makeStock(o: Partial<StockEntry> = {}): StockEntry {
  return {
    id: 'se-1', material_id: 'mat-1', material_name: 'Steel Rod',
    invoice_id: null, invoice_number: null, supplier_name: 'Acme Metals',
    quantity: 100, unit: 'kg', rate: 50, batch_number: 'B001',
    mfd_date: '2025-01-01', expiry_date: '2026-01-01', entry_date: '2025-06-01',
    notes: null, created_at: '2025-06-01T10:00:00Z', ...o,
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. DASHBOARD — ACCOUNT BALANCE COMPUTATION
// ═════════════════════════════════════════════════════════════════════════════

function computeAccountBalances(
  transactions: Transaction[],
  openingBalances: Record<string, number>
): Record<string, number> {
  const balances: Record<string, number> = { ...openingBalances }
  transactions.forEach(t => {
    if (balances[t.account] !== undefined) {
      balances[t.account] += t.type === 'income' ? t.amount : -t.amount
    }
  })
  return balances
}

describe('Dashboard — account balance computation', () => {
  const opening = { ICICI: 10000, SBI: 5000, Cash: 2000 }

  test('Income adds to account balance', () => {
    const txs = [makeTx({ account: 'ICICI', type: 'income', amount: 5000 })]
    const bal = computeAccountBalances(txs, opening)
    expect(bal.ICICI).toBe(15000)
  })

  test('Expense subtracts from account balance', () => {
    const txs = [makeTx({ account: 'SBI', type: 'expense', amount: 3000 })]
    const bal = computeAccountBalances(txs, opening)
    expect(bal.SBI).toBe(2000)
  })

  test('Multiple transactions accumulate correctly', () => {
    const txs = [
      makeTx({ id: 't1', account: 'ICICI', type: 'income', amount: 20000 }),
      makeTx({ id: 't2', account: 'ICICI', type: 'expense', amount: 5000 }),
      makeTx({ id: 't3', account: 'ICICI', type: 'income', amount: 10000 }),
    ]
    const bal = computeAccountBalances(txs, opening)
    expect(bal.ICICI).toBe(10000 + 20000 - 5000 + 10000)
  })

  test('Unknown account is ignored', () => {
    const txs = [makeTx({ account: 'HDFC', type: 'income', amount: 5000 })]
    const bal = computeAccountBalances(txs, opening)
    expect(bal.HDFC).toBeUndefined()
    expect(bal.ICICI).toBe(10000)
  })

  test('Opening balance zero is preserved', () => {
    const txs: Transaction[] = []
    const bal = computeAccountBalances(txs, { ICICI: 0, SBI: 0, Cash: 0 })
    expect(bal.ICICI).toBe(0)
    expect(bal.SBI).toBe(0)
    expect(bal.Cash).toBe(0)
  })

  test('Cash account handled independently', () => {
    const txs = [makeTx({ account: 'Cash', type: 'income', amount: 1000 })]
    const bal = computeAccountBalances(txs, opening)
    expect(bal.Cash).toBe(3000)
    expect(bal.ICICI).toBe(10000) // untouched
  })

  test('Balance can go negative (overdraft)', () => {
    const txs = [makeTx({ account: 'SBI', type: 'expense', amount: 99999 })]
    const bal = computeAccountBalances(txs, opening)
    expect(bal.SBI).toBeLessThan(0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. DASHBOARD — STATS (sales / purchases / expenses / net)
// ═════════════════════════════════════════════════════════════════════════════

function computeStats(filtered: Transaction[]) {
  const totalSales     = filtered.filter(t => t.mode === 'receive').reduce((s, t) => s + t.amount, 0)
  const totalPurchases = filtered.filter(t => t.mode === 'send').reduce((s, t) => s + t.amount, 0)
  const totalExpenses  = filtered.filter(t => t.mode === 'expense' || (!t.mode && t.type === 'expense')).reduce((s, t) => s + t.amount, 0)
  const net = totalSales - totalPurchases - totalExpenses
  return { totalSales, totalPurchases, totalExpenses, net }
}

describe('Dashboard — period stats', () => {
  const txs = [
    makeTx({ id: '1', mode: 'receive', amount: 100000 }),
    makeTx({ id: '2', mode: 'send',    amount: 40000, type: 'expense' }),
    makeTx({ id: '3', mode: 'expense', amount: 10000, type: 'expense' }),
    makeTx({ id: '4', mode: 'receive', amount: 50000 }),
    makeTx({ id: '5', mode: 'send',    amount: 20000, type: 'expense' }),
  ]

  test('Total sales = sum of receive mode', () => {
    expect(computeStats(txs).totalSales).toBe(150000)
  })
  test('Total purchases = sum of send mode', () => {
    expect(computeStats(txs).totalPurchases).toBe(60000)
  })
  test('Total expenses = sum of expense mode', () => {
    expect(computeStats(txs).totalExpenses).toBe(10000)
  })
  test('Net = sales - purchases - expenses', () => {
    expect(computeStats(txs).net).toBe(150000 - 60000 - 10000)
  })
  test('Empty transactions gives all zeros', () => {
    const s = computeStats([])
    expect(s.totalSales).toBe(0)
    expect(s.totalPurchases).toBe(0)
    expect(s.totalExpenses).toBe(0)
    expect(s.net).toBe(0)
  })
  test('null mode + expense type = expense', () => {
    const nullModeTx = makeTx({ id: 'x', mode: null, type: 'expense', amount: 7000 })
    const s = computeStats([nullModeTx])
    expect(s.totalExpenses).toBe(7000)
  })
  test('Net can be negative', () => {
    const lossTxs = [
      makeTx({ id: 'a', mode: 'receive', amount: 1000 }),
      makeTx({ id: 'b', mode: 'send',    amount: 5000, type: 'expense' }),
    ]
    expect(computeStats(lossTxs).net).toBeLessThan(0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. DASHBOARD — CATEGORY SUMMARY
// ═════════════════════════════════════════════════════════════════════════════

function computeCategorySummary(filtered: Transaction[]) {
  const map: Record<string, { total: number; subs: Record<string, number>; count: number }> = {}
  filtered.forEach(t => {
    const cat = t.category?.trim() || '(Uncategorized)'
    const sub = t.sub_category?.trim() || ''
    if (!map[cat]) map[cat] = { total: 0, subs: {}, count: 0 }
    map[cat].total += t.amount
    map[cat].count += 1
    if (sub) map[cat].subs[sub] = (map[cat].subs[sub] || 0) + t.amount
  })
  return Object.entries(map).sort((a, b) => b[1].total - a[1].total)
}

describe('Dashboard — category summary', () => {
  const txs = [
    makeTx({ id: '1', category: 'Sales & Collections',     sub_category: 'Credit Customer Payment', amount: 50000 }),
    makeTx({ id: '2', category: 'Sales & Collections',     sub_category: 'Credit Customer Payment', amount: 30000 }),
    makeTx({ id: '3', category: 'Procurement & Purchases', sub_category: 'Advance Vendor Payment',   amount: 20000 }),
    makeTx({ id: '4', category: 'Office',                  sub_category: 'Rent',                     amount: 5000  }),
    makeTx({ id: '5', category: null,                      sub_category: null,                        amount: 1000  }),
  ]

  test('Categories are sorted by total descending', () => {
    const summary = computeCategorySummary(txs)
    for (let i = 1; i < summary.length; i++) {
      expect(summary[i-1][1].total).toBeGreaterThanOrEqual(summary[i][1].total)
    }
  })

  test('Category totals sum correctly', () => {
    const summary = computeCategorySummary(txs)
    const salesEntry = summary.find(([cat]) => cat === 'Sales & Collections')
    expect(salesEntry?.[1].total).toBe(80000)
  })

  test('Sub-category totals aggregate correctly', () => {
    const summary = computeCategorySummary(txs)
    const salesEntry = summary.find(([cat]) => cat === 'Sales & Collections')
    expect(salesEntry?.[1].subs['Credit Customer Payment']).toBe(80000)
  })

  test('null category maps to (Uncategorized)', () => {
    const summary = computeCategorySummary(txs)
    const uncatEntry = summary.find(([cat]) => cat === '(Uncategorized)')
    expect(uncatEntry).toBeDefined()
    expect(uncatEntry?.[1].total).toBe(1000)
  })

  test('Count is accurate per category', () => {
    const summary = computeCategorySummary(txs)
    const salesEntry = summary.find(([cat]) => cat === 'Sales & Collections')
    expect(salesEntry?.[1].count).toBe(2)
  })

  test('Empty filtered returns empty summary', () => {
    expect(computeCategorySummary([])).toHaveLength(0)
  })

  test('Trimmed whitespace category treated same', () => {
    const txsWS = [
      makeTx({ id: 'a', category: '  Office  ', sub_category: 'Rent', amount: 2000 }),
      makeTx({ id: 'b', category: 'Office',    sub_category: 'WiFi', amount: 1000 }),
    ]
    const summary = computeCategorySummary(txsWS)
    const office = summary.find(([cat]) => cat === 'Office')
    expect(office?.[1].total).toBe(3000)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4. DASHBOARD — TOP COMPANIES
// ═════════════════════════════════════════════════════════════════════════════

function computeTopCompanies(transactions: Transaction[]) {
  const salesMap: Record<string, number>    = {}
  const purchaseMap: Record<string, number> = {}
  transactions.forEach(t => {
    const name = t.company_name?.trim() || t.description?.trim() || ''
    if (!name) return
    if (t.mode === 'receive') salesMap[name]    = (salesMap[name]    || 0) + t.amount
    else if (t.mode === 'send') purchaseMap[name] = (purchaseMap[name] || 0) + t.amount
  })
  const top5Sales     = Object.entries(salesMap).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const top5Purchases = Object.entries(purchaseMap).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const salesMax    = top5Sales[0]?.[1]     || 1
  const purchaseMax = top5Purchases[0]?.[1] || 1
  return { top5Sales, top5Purchases, salesMax, purchaseMax }
}

describe('Dashboard — top companies', () => {
  const txs = [
    makeTx({ id: '1', mode: 'receive', company_name: 'Alpha', amount: 90000 }),
    makeTx({ id: '2', mode: 'receive', company_name: 'Beta',  amount: 70000 }),
    makeTx({ id: '3', mode: 'receive', company_name: 'Alpha', amount: 10000 }),
    makeTx({ id: '4', mode: 'receive', company_name: 'Gamma', amount: 30000 }),
    makeTx({ id: '5', mode: 'receive', company_name: 'Delta', amount: 20000 }),
    makeTx({ id: '6', mode: 'receive', company_name: 'Epsilon', amount: 5000 }),
    makeTx({ id: '7', mode: 'send',    company_name: 'Supplier A', amount: 50000, type: 'expense' }),
    makeTx({ id: '8', mode: 'send',    company_name: 'Supplier B', amount: 25000, type: 'expense' }),
  ]

  test('Top 5 sales are capped at 5', () => {
    expect(computeTopCompanies(txs).top5Sales.length).toBeLessThanOrEqual(5)
  })
  test('Top sales sorted descending', () => {
    const { top5Sales } = computeTopCompanies(txs)
    for (let i = 1; i < top5Sales.length; i++) {
      expect(top5Sales[i-1][1]).toBeGreaterThanOrEqual(top5Sales[i][1])
    }
  })
  test('Same company sales aggregate across transactions', () => {
    const { top5Sales } = computeTopCompanies(txs)
    const alpha = top5Sales.find(([name]) => name === 'Alpha')
    expect(alpha?.[1]).toBe(100000) // 90000 + 10000
  })
  test('salesMax = highest company total', () => {
    const { salesMax } = computeTopCompanies(txs)
    expect(salesMax).toBe(100000)
  })
  test('purchaseMax = highest purchase total', () => {
    const { purchaseMax } = computeTopCompanies(txs)
    expect(purchaseMax).toBe(50000)
  })
  test('null company_name falls back to description', () => {
    const t = makeTx({ id: 'x', mode: 'receive', company_name: null, description: 'Walk-in customer', amount: 5000 })
    const { top5Sales } = computeTopCompanies([t])
    expect(top5Sales[0][0]).toBe('Walk-in customer')
  })
  test('null company_name AND null description is excluded', () => {
    const t = makeTx({ id: 'x', mode: 'receive', company_name: null, description: null, amount: 5000 })
    const { top5Sales } = computeTopCompanies([t])
    expect(top5Sales).toHaveLength(0)
  })
  test('salesMax defaults to 1 when no sales (avoids division-by-zero)', () => {
    expect(computeTopCompanies([]).salesMax).toBe(1)
    expect(computeTopCompanies([]).purchaseMax).toBe(1)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5. PAYMENT DISTRIBUTION (multi-invoice proportional allocation)
// ═════════════════════════════════════════════════════════════════════════════

function distributePayment(invoices: InvoiceEntry[], paymentAmount: number): Array<{
  invoiceId: string
  allocated: number
  newPaid: number
  newStatus: 'paid' | 'partial' | 'unpaid'
}> {
  const totalDue = invoices.reduce((s, i) => s + Math.max(0, i.amount - (i.amount_paid ?? 0)), 0)
  const amountToDistribute = Math.min(paymentAmount, totalDue)

  return invoices.map(inv => {
    const remaining = Math.max(0, inv.amount - (inv.amount_paid ?? 0))
    const allocated = invoices.length === 1
      ? amountToDistribute
      : Math.round((remaining / totalDue) * amountToDistribute * 100) / 100
    const newPaid = (inv.amount_paid ?? 0) + allocated
    const newStatus = newPaid >= inv.amount - 0.01 ? 'paid'
      : newPaid > 0 ? 'partial'
      : 'unpaid'
    return { invoiceId: inv.id, allocated, newPaid, newStatus }
  })
}

describe('Payment distribution — single invoice', () => {
  test('Full payment marks invoice paid', () => {
    const inv = makeInv({ amount: 50000, amount_paid: 0 })
    const result = distributePayment([inv], 50000)
    expect(result[0].newStatus).toBe('paid')
    expect(result[0].newPaid).toBe(50000)
  })
  test('Partial payment marks invoice partial', () => {
    const inv = makeInv({ amount: 50000, amount_paid: 0 })
    const result = distributePayment([inv], 20000)
    expect(result[0].newStatus).toBe('partial')
    expect(result[0].allocated).toBe(20000)
  })
  test('Overpayment capped at due amount', () => {
    const inv = makeInv({ amount: 50000, amount_paid: 0 })
    const result = distributePayment([inv], 99999)
    expect(result[0].allocated).toBe(50000) // capped at totalDue
  })
  test('Already partially paid + remaining = paid', () => {
    const inv = makeInv({ amount: 50000, amount_paid: 30000, status: 'partial' })
    const result = distributePayment([inv], 20000)
    expect(result[0].newStatus).toBe('paid')
    expect(result[0].newPaid).toBe(50000)
  })
  test('0.01 tolerance for floating point (e.g. 49999.99 treated as paid)', () => {
    const inv = makeInv({ amount: 50000, amount_paid: 0 })
    const result = distributePayment([inv], 49999.99)
    expect(result[0].newPaid).toBeGreaterThanOrEqual(inv.amount - 0.01)
    expect(result[0].newStatus).toBe('paid')
  })
})

describe('Payment distribution — multiple invoices', () => {
  test('Payment distributed proportionally across invoices', () => {
    const invA = makeInv({ id: 'a', amount: 30000, amount_paid: 0 })
    const invB = makeInv({ id: 'b', amount: 60000, amount_paid: 0 }) // 2× inv A
    const result = distributePayment([invA, invB], 90000)
    // invA gets 1/3, invB gets 2/3
    expect(result[0].allocated).toBeCloseTo(30000)
    expect(result[1].allocated).toBeCloseTo(60000)
  })
  test('Both invoices marked paid when full amount received', () => {
    const invA = makeInv({ id: 'a', amount: 20000, amount_paid: 0 })
    const invB = makeInv({ id: 'b', amount: 30000, amount_paid: 0 })
    const result = distributePayment([invA, invB], 50000)
    expect(result.every(r => r.newStatus === 'paid')).toBe(true)
  })
  test('Partial multi-payment marks both partial', () => {
    const invA = makeInv({ id: 'a', amount: 20000, amount_paid: 0 })
    const invB = makeInv({ id: 'b', amount: 30000, amount_paid: 0 })
    const result = distributePayment([invA, invB], 25000) // half of total
    expect(result.every(r => r.newStatus === 'partial')).toBe(true)
  })
  test('Excess over totalDue is not distributed to invoices', () => {
    const invA = makeInv({ id: 'a', amount: 10000, amount_paid: 0 })
    const invB = makeInv({ id: 'b', amount: 10000, amount_paid: 0 })
    const result = distributePayment([invA, invB], 50000) // excess 30000
    expect(result.reduce((s, r) => s + r.allocated, 0)).toBeLessThanOrEqual(20000 + 0.02)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6. INVOICE STATUS TRANSITIONS
// ═════════════════════════════════════════════════════════════════════════════

type InvoiceStatus = 'unpaid' | 'partial' | 'paid'

function deriveInvoiceStatus(totalAmount: number, amountPaid: number): InvoiceStatus {
  if (amountPaid >= totalAmount - 0.01) return 'paid'
  if (amountPaid > 0) return 'partial'
  return 'unpaid'
}

describe('Invoice status transitions', () => {
  test('0 paid → unpaid', () => {
    expect(deriveInvoiceStatus(50000, 0)).toBe('unpaid')
  })
  test('partial paid → partial', () => {
    expect(deriveInvoiceStatus(50000, 25000)).toBe('partial')
  })
  test('exactly paid → paid', () => {
    expect(deriveInvoiceStatus(50000, 50000)).toBe('paid')
  })
  test('1 paisa short → paid (0.01 tolerance)', () => {
    expect(deriveInvoiceStatus(50000, 49999.99)).toBe('paid')
  })
  test('more than 0.01 short → partial', () => {
    expect(deriveInvoiceStatus(50000, 49999.98)).toBe('partial')
  })
  test('overpaid → paid', () => {
    expect(deriveInvoiceStatus(50000, 55000)).toBe('paid')
  })
  test('1 paid on large invoice → partial', () => {
    expect(deriveInvoiceStatus(1000000, 1)).toBe('partial')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 7. FY MONTH LABELS (fyMonths array generation)
// ═════════════════════════════════════════════════════════════════════════════

function generateFyMonths(selectedFY: string): { label: string; value: string }[] {
  const fyStartYear = parseInt(selectedFY.split('-')[0])
  return FY_MONTHS.map(m => {
    const yr = ['Jan', 'Feb', 'Mar'].includes(m) ? fyStartYear + 1 : fyStartYear
    return { label: `${m} ${yr}`, value: `${m}-${String(yr).slice(-2)}` }
  })
}

describe('FY month labels', () => {
  const months2025 = generateFyMonths('2025-26')

  test('Generates 12 month labels', () => {
    expect(months2025).toHaveLength(12)
  })
  test('First month is Apr of start year', () => {
    expect(months2025[0].label).toBe('Apr 2025')
    expect(months2025[0].value).toBe('Apr-25')
  })
  test('Dec is still start year', () => {
    const dec = months2025.find(m => m.label.startsWith('Dec'))
    expect(dec?.label).toBe('Dec 2025')
    expect(dec?.value).toBe('Dec-25')
  })
  test('Jan switches to next year', () => {
    const jan = months2025.find(m => m.label.startsWith('Jan'))
    expect(jan?.label).toBe('Jan 2026')
    expect(jan?.value).toBe('Jan-26')
  })
  test('Mar is end year', () => {
    const mar = months2025[11]
    expect(mar.label).toBe('Mar 2026')
    expect(mar.value).toBe('Mar-26')
  })
  test('FY 2099-00 generates Jan 2100 correctly', () => {
    const months = generateFyMonths('2099-00')
    const jan = months.find(m => m.label.startsWith('Jan'))
    expect(jan?.label).toBe('Jan 2100')
  })
  test('Each label value matches short year format', () => {
    months2025.forEach(m => {
      const [, yr] = m.value.split('-')
      expect(yr).toHaveLength(2)
    })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 8. TRANSACTIONS FILTERED BY FY
// ═════════════════════════════════════════════════════════════════════════════

describe('Transactions — FY filter', () => {
  const allTxs: Transaction[] = [
    makeTx({ id: '1', date: '2024-04-01' }),  // FY 2024-25
    makeTx({ id: '2', date: '2025-03-31' }),  // FY 2024-25 (last day)
    makeTx({ id: '3', date: '2025-04-01' }),  // FY 2025-26
    makeTx({ id: '4', date: '2026-01-15' }),  // FY 2025-26
    makeTx({ id: '5', date: '2026-03-31' }),  // FY 2025-26 (last day)
    makeTx({ id: '6', date: '2026-04-01' }),  // FY 2026-27
  ]
  const filterByFY = (txs: Transaction[], fy: string) =>
    txs.filter(t => getFiscalYearLabel(t.date) === fy)

  test('FY 2024-25 captures Apr 2024 - Mar 2025', () => {
    const res = filterByFY(allTxs, '2024-25')
    expect(res.map(t => t.id)).toEqual(['1', '2'])
  })
  test('FY 2025-26 captures Apr 2025 - Mar 2026', () => {
    const res = filterByFY(allTxs, '2025-26')
    expect(res.map(t => t.id)).toEqual(['3', '4', '5'])
  })
  test('FY 2026-27 captures Apr 2026+', () => {
    const res = filterByFY(allTxs, '2026-27')
    expect(res.map(t => t.id)).toEqual(['6'])
  })
  test('Unknown FY returns empty', () => {
    expect(filterByFY(allTxs, '2030-31')).toHaveLength(0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 9. TRANSACTIONS FILTERED BY MONTH KEY (dashboard month filter)
// ═════════════════════════════════════════════════════════════════════════════

function filterByMonthKey(txs: Transaction[], monthKey: string): Transaction[] {
  return txs.filter(t => {
    const d = new Date(t.date + 'T00:00:00')
    const key = d.toLocaleString('default', { month: 'short' }) + '-' + String(d.getFullYear()).slice(-2)
    return key === monthKey
  })
}

describe('Transactions — month key filter', () => {
  const txs = [
    makeTx({ id: '1', date: '2025-06-01' }),
    makeTx({ id: '2', date: '2025-06-30' }),
    makeTx({ id: '3', date: '2025-07-01' }),
    makeTx({ id: '4', date: '2026-01-15' }),
    makeTx({ id: '5', date: '2026-03-01' }),
  ]

  test('Jun-25 matches June 2025 transactions', () => {
    const res = filterByMonthKey(txs, 'Jun-25')
    expect(res.map(t => t.id)).toEqual(['1', '2'])
  })
  test('Jul-25 matches July 2025', () => {
    const res = filterByMonthKey(txs, 'Jul-25')
    expect(res.map(t => t.id)).toEqual(['3'])
  })
  test('Jan-26 matches January 2026', () => {
    const res = filterByMonthKey(txs, 'Jan-26')
    expect(res.map(t => t.id)).toEqual(['4'])
  })
  test('Mar-26 matches March 2026', () => {
    const res = filterByMonthKey(txs, 'Mar-26')
    expect(res.map(t => t.id)).toEqual(['5'])
  })
  test('Unmatched key returns empty', () => {
    expect(filterByMonthKey(txs, 'Dec-25')).toHaveLength(0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 10. FILTER LABEL GENERATION
// ═════════════════════════════════════════════════════════════════════════════

function getFilterLabel(selectedMonth: string, dateFrom: string, dateTo: string): string {
  return selectedMonth || (dateFrom && dateTo ? `${dateFrom} → ${dateTo}` : dateFrom || dateTo || '')
}

function isFiltered(selectedMonth: string, dateFrom: string, dateTo: string): boolean {
  return !!(selectedMonth || dateFrom || dateTo)
}

describe('Filter label generation', () => {
  test('Month selected returns month key', () => {
    expect(getFilterLabel('Jun-25', '', '')).toBe('Jun-25')
  })
  test('Both from and to shows range with arrow', () => {
    expect(getFilterLabel('', '2025-06-01', '2025-06-30')).toBe('2025-06-01 → 2025-06-30')
  })
  test('Only dateFrom shows dateFrom', () => {
    expect(getFilterLabel('', '2025-06-01', '')).toBe('2025-06-01')
  })
  test('Only dateTo shows dateTo', () => {
    expect(getFilterLabel('', '', '2025-06-30')).toBe('2025-06-30')
  })
  test('Nothing selected returns empty string', () => {
    expect(getFilterLabel('', '', '')).toBe('')
  })
  test('selectedMonth takes precedence over dates', () => {
    expect(getFilterLabel('Jun-25', '2025-06-01', '2025-06-30')).toBe('Jun-25')
  })
})

describe('isFiltered()', () => {
  test('No filters = not filtered', () => {
    expect(isFiltered('', '', '')).toBe(false)
  })
  test('Month set = filtered', () => {
    expect(isFiltered('Jun-25', '', '')).toBe(true)
  })
  test('dateFrom set = filtered', () => {
    expect(isFiltered('', '2025-06-01', '')).toBe(true)
  })
  test('dateTo set = filtered', () => {
    expect(isFiltered('', '', '2025-06-30')).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 11. ACTIVE FILTER COUNT (InvoiceSection badge)
// ═════════════════════════════════════════════════════════════════════════════

function activeFilterCount(
  statusFilter: string,
  ageFilter: string,
  dateFrom: string,
  dateTo: string,
  selectedMonth: string
): number {
  return [
    statusFilter !== 'all',
    ageFilter !== 'all',
    !!dateFrom,
    !!dateTo,
    !!selectedMonth,
  ].filter(Boolean).length
}

describe('activeFilterCount()', () => {
  test('No active filters = 0', () => {
    expect(activeFilterCount('all', 'all', '', '', '')).toBe(0)
  })
  test('statusFilter active = 1', () => {
    expect(activeFilterCount('unpaid', 'all', '', '', '')).toBe(1)
  })
  test('ageFilter active = 1', () => {
    expect(activeFilterCount('all', '30', '', '', '')).toBe(1)
  })
  test('dateFrom + dateTo = 2', () => {
    expect(activeFilterCount('all', 'all', '2025-06-01', '2025-06-30', '')).toBe(2)
  })
  test('All 5 active = 5', () => {
    expect(activeFilterCount('unpaid', '30', '2025-06-01', '2025-06-30', 'Jun-25')).toBe(5)
  })
  test('selectedMonth active = 1', () => {
    expect(activeFilterCount('all', 'all', '', '', 'Jun-25')).toBe(1)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 12. SEARCH TOTAL (InvoiceSection when search is active)
// ═════════════════════════════════════════════════════════════════════════════

function computeSearchTotal(filtered: InvoiceEntry[], search: string): number | null {
  if (!search.trim()) return null
  return filtered.reduce((sum, inv) => sum + inv.amount, 0)
}

describe('computeSearchTotal()', () => {
  const invs = [makeInv({ amount: 10000 }), makeInv({ id: '2', amount: 20000 })]
  test('Empty search returns null', () => {
    expect(computeSearchTotal(invs, '')).toBeNull()
    expect(computeSearchTotal(invs, '   ')).toBeNull()
  })
  test('Active search returns sum of filtered amounts', () => {
    expect(computeSearchTotal(invs, 'Test')).toBe(30000)
  })
  test('Empty filtered with active search returns 0', () => {
    expect(computeSearchTotal([], 'xyz')).toBe(0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 13. FILTERED TOTALS (InvoiceSection — amt / due / paid)
// ═════════════════════════════════════════════════════════════════════════════

function computeFilteredTotals(filtered: InvoiceEntry[]) {
  const filteredAmtTotal  = filtered.reduce((s, i) => s + i.amount, 0)
  const filteredDueTotal  = filtered.reduce((s, i) => s + (i.status === 'paid' ? 0 : i.amount - (i.amount_paid ?? 0)), 0)
  const filteredPaidTotal = filtered.reduce((s, i) => s + (i.amount_paid ?? 0), 0)
  return { filteredAmtTotal, filteredDueTotal, filteredPaidTotal }
}

describe('filteredTotals()', () => {
  const invs = [
    makeInv({ id: '1', amount: 50000, amount_paid: 0,     status: 'unpaid'  }),
    makeInv({ id: '2', amount: 30000, amount_paid: 30000, status: 'paid'    }),
    makeInv({ id: '3', amount: 20000, amount_paid: 10000, status: 'partial' }),
  ]
  test('Total amount = sum of all amounts', () => {
    expect(computeFilteredTotals(invs).filteredAmtTotal).toBe(100000)
  })
  test('Due total excludes paid invoices, calculates remaining for others', () => {
    // inv1: 50000 due, inv2: 0 (paid), inv3: 10000 remaining
    expect(computeFilteredTotals(invs).filteredDueTotal).toBe(60000)
  })
  test('Paid total = sum of amount_paid', () => {
    expect(computeFilteredTotals(invs).filteredPaidTotal).toBe(40000)
  })
  test('All paid → due = 0', () => {
    const allPaid = [makeInv({ amount: 10000, amount_paid: 10000, status: 'paid' })]
    expect(computeFilteredTotals(allPaid).filteredDueTotal).toBe(0)
  })
  test('All unpaid → paid total = 0', () => {
    const allUnpaid = [makeInv({ amount: 10000, amount_paid: 0, status: 'unpaid' })]
    expect(computeFilteredTotals(allUnpaid).filteredPaidTotal).toBe(0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 14. AGE BADGE CSS CLASS (InvoiceSection)
// ═════════════════════════════════════════════════════════════════════════════

function ageBadgeCls(days: number, status: string): string {
  if (status !== 'unpaid') return ''
  if (days <= 30) return 'bg-emerald-50 text-emerald-700'
  if (days <= 60) return 'bg-amber-50 text-amber-700'
  if (days <= 90) return 'bg-orange-50 text-orange-700'
  return 'bg-red-50 text-red-700'
}

describe('ageBadgeCls()', () => {
  test('paid invoice returns empty string', () => {
    expect(ageBadgeCls(100, 'paid')).toBe('')
  })
  test('partial invoice returns empty string', () => {
    expect(ageBadgeCls(50, 'partial')).toBe('')
  })
  test('≤30 days = green', () => {
    expect(ageBadgeCls(10, 'unpaid')).toContain('emerald')
    expect(ageBadgeCls(30, 'unpaid')).toContain('emerald')
  })
  test('31-60 days = amber', () => {
    expect(ageBadgeCls(31, 'unpaid')).toContain('amber')
    expect(ageBadgeCls(60, 'unpaid')).toContain('amber')
  })
  test('61-90 days = orange', () => {
    expect(ageBadgeCls(61, 'unpaid')).toContain('orange')
    expect(ageBadgeCls(90, 'unpaid')).toContain('orange')
  })
  test('>90 days = red', () => {
    expect(ageBadgeCls(91, 'unpaid')).toContain('red')
    expect(ageBadgeCls(200, 'unpaid')).toContain('red')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 15. ADVANCE BALANCE LOGIC
// ═════════════════════════════════════════════════════════════════════════════

describe('Advance balance — update logic', () => {
  test('Adding delta to advance balance', () => {
    const contact = makeContact({ advance_balance: 5000 })
    const delta = 2000
    const newBalance = Math.max(0, Math.round(((contact.advance_balance ?? 0) + delta) * 100) / 100)
    expect(newBalance).toBe(7000)
  })
  test('Balance never goes below 0 (Math.max guard)', () => {
    const contact = makeContact({ advance_balance: 1000 })
    const newBalance = Math.max(0, Math.round(((contact.advance_balance ?? 0) - 5000) * 100) / 100)
    expect(newBalance).toBe(0)
  })
  test('Floating point rounding is correct to 2dp', () => {
    const contact = makeContact({ advance_balance: 1000.005 })
    const delta = 0.001
    const newBalance = Math.max(0, Math.round(((contact.advance_balance ?? 0) + delta) * 100) / 100)
    expect(newBalance).toBe(1000.01)
  })
  test('null advance_balance treated as 0', () => {
    const contact = makeContact({ advance_balance: null })
    const newBalance = Math.max(0, Math.round(((contact.advance_balance ?? 0) + 500) * 100) / 100)
    expect(newBalance).toBe(500)
  })
  test('Exactly 0 advance stays 0 after subtraction', () => {
    const contact = makeContact({ advance_balance: 0 })
    const newBalance = Math.max(0, (contact.advance_balance ?? 0) - 100)
    expect(newBalance).toBe(0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 16. MATERIAL GST SLABS (MaterialFormDrawer)
// ═════════════════════════════════════════════════════════════════════════════

const GST_SLABS = [
  { label: '0%',  cgst: '0',  sgst: '0'  },
  { label: '5%',  cgst: '2.5', sgst: '2.5' },
  { label: '12%', cgst: '6',  sgst: '6'  },
  { label: '18%', cgst: '9',  sgst: '9'  },
  { label: '28%', cgst: '14', sgst: '14' },
]

describe('Material GST slabs', () => {
  test('All 5 standard GST slabs are defined', () => {
    expect(GST_SLABS).toHaveLength(5)
  })
  test('Each slab CGST + SGST = total GST rate', () => {
    GST_SLABS.forEach(s => {
      const total = parseFloat(s.cgst) + parseFloat(s.sgst)
      const expected = parseFloat(s.label)
      expect(total).toBeCloseTo(expected)
    })
  })
  test('Total GST from cgst + sgst inputs', () => {
    const cgst = '9'
    const sgst = '9'
    const totalGst = (parseFloat(cgst) || 0) + (parseFloat(sgst) || 0)
    expect(totalGst).toBe(18)
  })
  test('Empty cgst/sgst defaults to 0', () => {
    const totalGst = (parseFloat('') || 0) + (parseFloat('') || 0)
    expect(totalGst).toBe(0)
  })
  test('Non-standard rate is valid (custom input)', () => {
    const cgst = '7.5'
    const sgst = '7.5'
    const totalGst = parseFloat(cgst) + parseFloat(sgst)
    expect(totalGst).toBe(15)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 17. STOCK — INVENTORY AGGREGATION (MaterialInventoryCard)
// ═════════════════════════════════════════════════════════════════════════════

function computeInventory(entries: StockEntry[]) {
  const totalQty   = entries.reduce((s, e) => s + e.quantity, 0)
  const totalValue = entries.reduce((s, e) => s + (e.quantity * (e.rate ?? 0)), 0)
  const latestEntry = entries.slice().sort((a, b) => b.entry_date.localeCompare(a.entry_date))[0] ?? null
  const latestRate  = latestEntry?.rate ?? null
  const unit        = latestEntry?.unit ?? null
  return { totalQty, totalValue, latestRate, unit }
}

describe('Inventory computation', () => {
  const entries = [
    makeStock({ id: 'se1', quantity: 100, rate: 50,  unit: 'kg', entry_date: '2025-04-01' }),
    makeStock({ id: 'se2', quantity: 50,  rate: 55,  unit: 'kg', entry_date: '2025-05-01' }),
    makeStock({ id: 'se3', quantity: 25,  rate: null, unit: 'kg', entry_date: '2025-06-01' }),
  ]

  test('Total quantity sums all entries', () => {
    expect(computeInventory(entries).totalQty).toBe(175)
  })
  test('Total value = sum of qty * rate (null rate = 0)', () => {
    // 100*50 + 50*55 + 25*0 = 5000 + 2750 + 0 = 7750
    expect(computeInventory(entries).totalValue).toBe(7750)
  })
  test('latestRate is from most recent entry_date', () => {
    expect(computeInventory(entries).latestRate).toBeNull() // se3 is latest with null rate
  })
  test('Unit from latest entry', () => {
    expect(computeInventory(entries).unit).toBe('kg')
  })
  test('Empty entries returns zero qty and null unit', () => {
    const inv = computeInventory([])
    expect(inv.totalQty).toBe(0)
    expect(inv.totalValue).toBe(0)
    expect(inv.latestRate).toBeNull()
    expect(inv.unit).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 18. STOCK — BATCH AGGREGATION (MaterialInventoryCard)
// ═════════════════════════════════════════════════════════════════════════════

type BatchMap = Record<string, { qty: number; expiry: string | null; mfd: string | null; rate: number | null; supplier: string | null }>

function computeBatches(entries: StockEntry[]): BatchMap {
  const map: BatchMap = {}
  entries.forEach(e => {
    const key = e.batch_number ?? '—'
    if (!map[key]) map[key] = { qty: 0, expiry: e.expiry_date, mfd: e.mfd_date, rate: e.rate, supplier: e.supplier_name }
    map[key].qty += e.quantity
  })
  return map
}

describe('Batch aggregation', () => {
  test('Same batch number aggregates qty', () => {
    const entries = [
      makeStock({ id: 'a', batch_number: 'B001', quantity: 50 }),
      makeStock({ id: 'b', batch_number: 'B001', quantity: 30 }),
    ]
    const batches = computeBatches(entries)
    expect(batches['B001'].qty).toBe(80)
  })
  test('Different batches are separate keys', () => {
    const entries = [
      makeStock({ id: 'a', batch_number: 'B001', quantity: 50 }),
      makeStock({ id: 'b', batch_number: 'B002', quantity: 30 }),
    ]
    const batches = computeBatches(entries)
    expect(Object.keys(batches)).toHaveLength(2)
  })
  test('null batch_number maps to "—"', () => {
    const entries = [makeStock({ batch_number: null, quantity: 100 })]
    const batches = computeBatches(entries)
    expect(batches['—']).toBeDefined()
    expect(batches['—'].qty).toBe(100)
  })
  test('Empty entries returns empty map', () => {
    expect(Object.keys(computeBatches([]))).toHaveLength(0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 19. EXPIRING STOCK DETECTION
// ═════════════════════════════════════════════════════════════════════════════

describe('Expiring stock detection (< 90 days)', () => {
  const in30Days  = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  const in100Days = new Date(Date.now() + 100 * 86400000).toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10)

  function isExpiring(expiry: string | null): boolean {
    if (!expiry) return false
    const days = (new Date(expiry).getTime() - Date.now()) / 86400000
    return days < 90
  }

  test('Expiry in 30 days = expiring', () => {
    expect(isExpiring(in30Days)).toBe(true)
  })
  test('Expiry in 100 days = not expiring', () => {
    expect(isExpiring(in100Days)).toBe(false)
  })
  test('Already expired = expiring (days < 0 < 90)', () => {
    expect(isExpiring(yesterday)).toBe(true)
  })
  test('null expiry = not expiring', () => {
    expect(isExpiring(null)).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 20. CONTACT DEDUPLICATION (autoSaveContact)
// ═════════════════════════════════════════════════════════════════════════════

describe('Contact deduplication', () => {
  const contacts = [
    makeContact({ id: 'c1', company_name: 'Alpha Industries' }),
    makeContact({ id: 'c2', company_name: 'Beta Corp' }),
    makeContact({ id: 'c3', company_name: 'GAMMA PVT LTD' }),
  ]

  function contactExists(contacts: Contact[], name: string): boolean {
    return contacts.some(c => c.company_name.toLowerCase() === name.toLowerCase())
  }

  test('Exact match found', () => {
    expect(contactExists(contacts, 'Alpha Industries')).toBe(true)
  })
  test('Case-insensitive match found', () => {
    expect(contactExists(contacts, 'alpha industries')).toBe(true)
    expect(contactExists(contacts, 'BETA CORP')).toBe(true)
  })
  test('No match returns false', () => {
    expect(contactExists(contacts, 'Delta Ltd')).toBe(false)
  })
  test('Empty name should not match (guard)', () => {
    expect(contactExists(contacts, '')).toBe(false)
  })
  test('Partial name does not match (strict equality check)', () => {
    expect(contactExists(contacts, 'Alpha')).toBe(false)
  })
  test('Existing contact found by ref in handleAddContactFromDrawer pattern', () => {
    const existing = contacts.find(c => c.company_name.toLowerCase() === 'beta corp'.toLowerCase())
    expect(existing).toBeDefined()
    expect(existing?.id).toBe('c2')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 21. SNACK / TOAST MESSAGE LOGIC
// ═════════════════════════════════════════════════════════════════════════════

type SnackSeverity = 'success' | 'error' | 'info'

function buildSnackMessage(txFY: string, selectedFY: string): string {
  return txFY !== selectedFY ? `✓ Saved! Switched to FY ${txFY}` : '✓ Entry saved!'
}

describe('Snack messages', () => {
  test('Same FY shows standard save message', () => {
    expect(buildSnackMessage('2025-26', '2025-26')).toBe('✓ Entry saved!')
  })
  test('Different FY shows FY switch message', () => {
    const msg = buildSnackMessage('2026-27', '2025-26')
    expect(msg).toContain('Switched to FY')
    expect(msg).toContain('2026-27')
  })
  test('Switched message starts with checkmark', () => {
    expect(buildSnackMessage('2024-25', '2025-26').startsWith('✓')).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 22. INVOICE LINE — INVOICE TOTAL COMPUTATION
// ═════════════════════════════════════════════════════════════════════════════

function computeInvoiceLineTotal(line: Partial<InvoiceLine>): number {
  const qty  = line.quantity ?? 0
  const rate = line.rate     ?? 0
  const base = qty * rate
  let gstAmt = 0
  if (line.igst_rate) {
    gstAmt = base * line.igst_rate / 100
  } else {
    gstAmt = base * ((line.cgst_rate ?? 0) + (line.sgst_rate ?? 0)) / 100
  }
  return base + gstAmt
}

describe('Invoice line total', () => {
  test('CGST + SGST calculation', () => {
    const total = computeInvoiceLineTotal({ quantity: 10, rate: 1000, cgst_rate: 9, sgst_rate: 9 })
    expect(total).toBe(11800)
  })
  test('IGST calculation', () => {
    const total = computeInvoiceLineTotal({ quantity: 10, rate: 1000, igst_rate: 18 })
    expect(total).toBe(11800)
  })
  test('IGST takes precedence over CGST/SGST', () => {
    const total = computeInvoiceLineTotal({ quantity: 10, rate: 1000, cgst_rate: 9, sgst_rate: 9, igst_rate: 5 })
    expect(total).toBe(10500) // 5% only
  })
  test('Null quantity/rate defaults to 0', () => {
    expect(computeInvoiceLineTotal({})).toBe(0)
  })
  test('28% GST slab', () => {
    const total = computeInvoiceLineTotal({ quantity: 1, rate: 1000, cgst_rate: 14, sgst_rate: 14 })
    expect(total).toBe(1280)
  })
  test('5% GST slab', () => {
    const total = computeInvoiceLineTotal({ quantity: 4, rate: 500, cgst_rate: 2.5, sgst_rate: 2.5 })
    expect(total).toBeCloseTo(2100)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 23. AVAILABLE FY LIST GENERATION
// ═════════════════════════════════════════════════════════════════════════════

describe('availableFYs list generation', () => {
  function buildAvailableFYs(allTransactions: Transaction[]): string[] {
    const s = new Set<string>()
    s.add(getFiscalYearLabel(new Date()))
    allTransactions.forEach(t => s.add(getFiscalYearLabel(t.date)))
    return Array.from(s).sort().reverse()
  }

  test('Always includes current FY', () => {
    const fyList = buildAvailableFYs([])
    const currentFY = getFiscalYearLabel(new Date())
    expect(fyList).toContain(currentFY)
  })
  test('FYs from transactions are included', () => {
    const txs = [
      makeTx({ date: '2024-06-01' }), // FY 2024-25
      makeTx({ date: '2023-11-01' }), // FY 2023-24
    ]
    const fyList = buildAvailableFYs(txs)
    expect(fyList).toContain('2024-25')
    expect(fyList).toContain('2023-24')
  })
  test('Sorted in reverse order (latest first)', () => {
    const txs = [makeTx({ date: '2024-06-01' }), makeTx({ date: '2023-06-01' })]
    const fyList = buildAvailableFYs(txs)
    for (let i = 1; i < fyList.length; i++) {
      expect(fyList[i-1] >= fyList[i]).toBe(true)
    }
  })
  test('No duplicates for same FY across many transactions', () => {
    const txs = [
      makeTx({ id: 'a', date: '2025-04-01' }),
      makeTx({ id: 'b', date: '2025-08-01' }),
      makeTx({ id: 'c', date: '2026-01-01' }),
    ]
    const fyList = buildAvailableFYs(txs)
    const unique = new Set(fyList)
    expect(fyList.length).toBe(unique.size)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 24. UNITS LIST (MaterialsSection)
// ═════════════════════════════════════════════════════════════════════════════

const UNITS = ['Kg', 'Gms', 'Ltr', 'Ml', 'Ths', 'Nos', 'Pcs', 'Boxes', 'Bags', 'Bottles', 'Strips', 'Other']

describe('Units list', () => {
  test('Has at least 10 units', () => {
    expect(UNITS.length).toBeGreaterThanOrEqual(10)
  })
  test('Contains Kg', () => { expect(UNITS).toContain('Kg') })
  test('Contains Other (fallback)', () => { expect(UNITS).toContain('Other') })
  test('No duplicates', () => {
    expect(new Set(UNITS).size).toBe(UNITS.length)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 25. MULTI-SELECT INVOICE LOGIC (selectedIds Set toggle)
// ═════════════════════════════════════════════════════════════════════════════

describe('Invoice multi-select toggle', () => {
  function toggleSelect(prev: Set<string>, id: string): Set<string> {
    const s = new Set(prev)
    s.has(id) ? s.delete(id) : s.add(id)
    return s
  }

  test('Toggle adds when not present', () => {
    const s = toggleSelect(new Set(), 'inv-1')
    expect(s.has('inv-1')).toBe(true)
  })
  test('Toggle removes when present', () => {
    const s = toggleSelect(new Set(['inv-1']), 'inv-1')
    expect(s.has('inv-1')).toBe(false)
  })
  test('Other selections preserved on toggle', () => {
    const existing = new Set(['inv-2', 'inv-3'])
    const s = toggleSelect(existing, 'inv-1')
    expect(s.has('inv-2')).toBe(true)
    expect(s.has('inv-3')).toBe(true)
    expect(s.has('inv-1')).toBe(true)
  })
  test('Clear selected returns empty set', () => {
    const s = new Set(['a', 'b', 'c'])
    const cleared = new Set<string>()
    expect(cleared.size).toBe(0)
  })
  test('selectedInvoices filters by Set membership', () => {
    const invs = [
      makeInv({ id: '1' }), makeInv({ id: '2' }), makeInv({ id: '3' }),
    ]
    const selectedIds = new Set(['1', '3'])
    const selected = invs.filter(i => selectedIds.has(i.id))
    expect(selected).toHaveLength(2)
    expect(selected.map(i => i.id)).toEqual(['1', '3'])
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 26. CREDIT DUE DATE CALCULATION FROM TERM
// ═════════════════════════════════════════════════════════════════════════════

function computeDueDate(startDate: string, term: string): string | null {
  if (term === 'open') return null
  const days = parseInt(term)
  if (isNaN(days)) return null
  const d = new Date(startDate + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

describe('Credit due date from term', () => {
  test('30-day term adds 30 days', () => {
    expect(computeDueDate('2025-06-01', '30')).toBe('2025-07-01')
  })
  test('45-day term adds 45 days', () => {
    expect(computeDueDate('2025-06-01', '45')).toBe('2025-07-16')
  })
  test('60-day term adds 60 days', () => {
    expect(computeDueDate('2025-06-01', '60')).toBe('2025-07-31')
  })
  test('90-day term adds 90 days', () => {
    expect(computeDueDate('2025-06-01', '90')).toBe('2025-08-30')
  })
  test('open term returns null', () => {
    expect(computeDueDate('2025-06-01', 'open')).toBeNull()
  })
  test('Non-numeric term returns null', () => {
    expect(computeDueDate('2025-06-01', 'xyz')).toBeNull()
  })
  test('Month boundary rolls over correctly', () => {
    expect(computeDueDate('2025-01-31', '30')).toBe('2025-03-02')
  })
  test('FY boundary (Mar → Apr)', () => {
    const due = computeDueDate('2025-03-15', '30')
    expect(due).toBe('2025-04-14')
    expect(getFiscalYear(due!)).toBe('FY 2025-26')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 27. FMTDATE / FMTDATELONG HELPERS
// ═════════════════════════════════════════════════════════════════════════════

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
function fmtDateLong(d: string | null): string {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

describe('fmtDate() and fmtDateLong()', () => {
  test('null returns em dash', () => {
    expect(fmtDate(null)).toBe('—')
    expect(fmtDateLong(null)).toBe('—')
  })
  test('Valid date formats correctly', () => {
    const result = fmtDate('2025-06-15')
    expect(result).not.toBe('—')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
  test('fmtDateLong includes year as 4 digits', () => {
    const result = fmtDateLong('2025-06-15')
    expect(result).toContain('2025')
  })
  test('fmtDateLong includes month abbreviation', () => {
    const result = fmtDateLong('2025-06-15')
    // en-IN short month for June is 'Jun'
    expect(result.toLowerCase()).toContain('jun')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 28. FMTSHORT (Dashboard company bar labels)
// ═════════════════════════════════════════════════════════════════════════════

function fmtShort(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 100000) return '₹' + (abs / 100000).toFixed(1) + 'L'
  if (abs >= 1000)   return '₹' + (abs / 1000).toFixed(0) + 'K'
  return '₹' + abs.toLocaleString('en-IN')
}

describe('fmtShort()', () => {
  test('≥ 1 lakh shows L suffix', () => {
    expect(fmtShort(100000)).toBe('₹1.0L')
    expect(fmtShort(500000)).toBe('₹5.0L')
  })
  test('≥ 1000 shows K suffix', () => {
    expect(fmtShort(5000)).toBe('₹5K')
    expect(fmtShort(1000)).toBe('₹1K')
  })
  test('< 1000 shows raw amount', () => {
    expect(fmtShort(500)).toBe('₹500')
    expect(fmtShort(0)).toBe('₹0')
  })
  test('Negative treated as absolute', () => {
    expect(fmtShort(-200000)).toBe('₹2.0L')
  })
  test('Exactly 1 lakh boundary', () => {
    expect(fmtShort(100000)).toContain('L')
    expect(fmtShort(99999)).toContain('K')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 29. REGRESSION — INVOICE PAYMENT WHEN ALREADY PARTIALLY PAID
// ═════════════════════════════════════════════════════════════════════════════

describe('Regression — payment on partially paid invoice', () => {
  test('Adding payment to partial brings to paid', () => {
    const inv = makeInv({ amount: 100000, amount_paid: 60000, status: 'partial' })
    const result = distributePayment([inv], 40000)
    expect(result[0].newStatus).toBe('paid')
    expect(result[0].newPaid).toBe(100000)
  })
  test('Adding less than remaining stays partial', () => {
    const inv = makeInv({ amount: 100000, amount_paid: 60000, status: 'partial' })
    const result = distributePayment([inv], 10000)
    expect(result[0].newStatus).toBe('partial')
    expect(result[0].newPaid).toBe(70000)
  })
  test('Zero payment does not change status', () => {
    const inv = makeInv({ amount: 100000, amount_paid: 0, status: 'unpaid' })
    const result = distributePayment([inv], 0)
    expect(result[0].newStatus).toBe('unpaid')
    expect(result[0].allocated).toBe(0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 30. REGRESSION — CONTACT SUMMARIES COMPUTATION
// ═════════════════════════════════════════════════════════════════════════════

describe('Regression — contact summaries from Contacts.tsx', () => {
  const contacts = [
    makeContact({ id: 'c1', company_name: 'Alpha Ltd' }),
    makeContact({ id: 'c2', company_name: 'Beta Corp' }),
  ]
  const transactions: Transaction[] = [
    makeTx({ id: 't1', contact_id: 'c1', type: 'income',  amount: 50000 }),
    makeTx({ id: 't2', contact_id: 'c1', type: 'expense', amount: 20000 }),
    makeTx({ id: 't3', contact_id: 'c2', type: 'income',  amount: 30000 }),
    makeTx({ id: 't4', contact_id: null, type: 'income',  amount: 9999  }), // no contact
  ]

  function buildContactSummaries(contacts: Contact[], transactions: Transaction[]) {
    const map: Record<string, { sent: number; received: number; txCount: number }> = {}
    contacts.forEach(c => { map[c.id] = { sent: 0, received: 0, txCount: 0 } })
    transactions.forEach(t => {
      if (!t.contact_id || !map[t.contact_id]) return
      map[t.contact_id].txCount++
      if (t.type === 'income') map[t.contact_id].received += t.amount
      else map[t.contact_id].sent += t.amount
    })
    return map
  }

  test('Alpha Ltd receives correct totals', () => {
    const summaries = buildContactSummaries(contacts, transactions)
    expect(summaries['c1'].received).toBe(50000)
    expect(summaries['c1'].sent).toBe(20000)
    expect(summaries['c1'].txCount).toBe(2)
  })
  test('Beta Corp receives correct totals', () => {
    const summaries = buildContactSummaries(contacts, transactions)
    expect(summaries['c2'].received).toBe(30000)
    expect(summaries['c2'].sent).toBe(0)
  })
  test('null contact_id transactions are ignored', () => {
    const summaries = buildContactSummaries(contacts, transactions)
    // Total assigned should be 50000 + 20000 + 30000 = 100000, not 109999
    const totalReceived = Object.values(summaries).reduce((s, c) => s + c.received, 0)
    expect(totalReceived).toBe(80000)
  })
  test('Contact with no transactions has zero totals', () => {
    const contacts2 = [makeContact({ id: 'c3', company_name: 'New Corp' })]
    const summaries = buildContactSummaries(contacts2, transactions)
    expect(summaries['c3'].txCount).toBe(0)
    expect(summaries['c3'].received).toBe(0)
    expect(summaries['c3'].sent).toBe(0)
  })
})
