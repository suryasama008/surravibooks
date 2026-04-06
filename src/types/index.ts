export type TransactionMode = 'send' | 'receive' | 'expense'
export type TransactionType = 'income' | 'expense'
export type CreditType = 'credit_given' | 'credit_taken'
export type CreditTerm = string // e.g. '30', '45', '60', '90', 'open', or any custom number of days

export interface Transaction {
  id: string
  date: string
  type: TransactionType
  mode: TransactionMode | null
  account: string
  amount: number
  category: string | null
  sub_category: string | null
  description: string | null
  payment_mode: string | null
  notes: string | null
  contact_id: string | null
  company_name: string | null
  created_at: string
}

export interface CreditEntry {
  id: string
  date: string
  credit_type: CreditType
  contact_id: string | null
  company_name: string
  amount: number
  term: CreditTerm
  due_date: string | null
  invoice_number: string | null
  notes: string | null
  status: 'pending' | 'settled'
  settled_tx_id: string | null
  created_at: string
}

export interface Contact {
  id: string
  company_name: string
  gst_number: string | null
  contact_type: 'supplier' | 'customer' | 'both'
  phone: string | null
  email: string | null
  notes: string | null
  created_at: string
}

export interface OpeningBalance {
  id: string
  account: string
  balance: number
  as_of_date: string
}

export interface TransactionInput {
  date: string
  type: TransactionType
  mode?: TransactionMode
  account: string
  amount: number
  category?: string
  sub_category?: string
  description?: string
  payment_mode?: string
  notes?: string
  contact_id?: string | null
  company_name?: string | null
}

export interface MonthlySummary {
  month: string
  income: number
  expense: number
  net: number
}

export type InvoiceEntryType = 'sale' | 'purchase'
export type InvoiceStatus = 'unpaid' | 'paid'

export interface InvoiceEntry {
  id: string
  invoice_number: string
  invoice_date: string        // date of invoice — set at entry time (never changes)
  entry_type: InvoiceEntryType
  contact_id: string | null
  company_name: string
  gst_number: string | null   // auto-pulled from contact
  amount: number
  notes: string | null
  status: InvoiceStatus
  transaction_date: string | null  // set only when payment is recorded
  utr: string | null               // UTR/ref entered at payment time
  bank_account: string | null      // bank account used for payment
  sub_category: string | null      // subcategory set at payment time
  settled_tx_id: string | null     // links to Transaction record
  created_at: string
}

// Legacy compat
export type BizTransactionType = 'send' | 'receive' | 'to_receive' | 'to_pay'
export interface BizTransaction {
  id: string
  date: string
  biz_type: BizTransactionType
  contact_id: string | null
  company_name: string
  gst_number: string | null
  amount: number
  notes: string | null
  status: 'pending' | 'settled'
  created_at: string
}
