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
  address: string | null
  notes: string | null
  advance_balance: number | null   // excess/advance held from overpayments
  created_at: string
}

export interface ContactNote {
  id: string
  contact_id: string
  note_text: string
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
export type InvoiceStatus = 'unpaid' | 'partial' | 'paid'
export type PaymentTerms = 'advance' | '30' | '45' | '60' | '90' | 'custom'

export interface InvoiceEntry {
  id: string
  invoice_number: string
  invoice_date: string        // date of invoice — set at entry time (never changes)
  received_date: string | null // purchase only — date goods were received
  entry_type: InvoiceEntryType
  contact_id: string | null
  company_name: string
  gst_number: string | null   // auto-pulled from contact
  amount: number
  notes: string | null
  payment_terms: PaymentTerms | null
  payment_terms_custom: string | null  // free text when payment_terms = 'custom'
  status: InvoiceStatus
  transaction_date: string | null  // set only when payment is recorded
  utr: string | null               // UTR/ref entered at payment time
  bank_account: string | null      // bank account used for payment
  sub_category: string | null      // subcategory set at payment time
  amount_paid: number               // cumulative payments recorded
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

export interface InvoiceLine {
  id: string
  invoice_id: string
  material_name: string
  hsn_code: string | null
  quantity: number | null
  unit: string | null
  rate: number | null
  gst_rate: number | null   // total GST % (legacy compat — cgst+sgst or igst)
  cgst_rate: number | null  // CGST %
  sgst_rate: number | null  // SGST %
  igst_rate: number | null  // IGST % (interstate — mutually exclusive with cgst/sgst)
  batch_number: string | null
  mfd_date: string | null   // manufacturing date
  expiry_date: string | null
  created_at: string
}

export interface Material {
  id: string
  material_name: string
  hsn_code: string | null
  gst_rate: number | null
  created_at: string
}

export interface InvoicePayment {
  id: string
  invoice_id: string
  transaction_id: string | null
  payment_date: string
  amount: number
  bank_account: string | null
  payment_mode: string | null
  utr: string | null
  notes: string | null
  created_at: string
}

export interface StockEntry {
  id: string
  material_id: string
  material_name: string
  invoice_id: string | null        // null = manually added
  invoice_number: string | null
  supplier_name: string | null
  quantity: number
  unit: string | null
  rate: number | null
  batch_number: string | null
  mfd_date: string | null
  expiry_date: string | null
  entry_date: string               // purchase invoice date or manual entry date
  notes: string | null

  created_at: string
}

export interface SampleEntry {
  id: string
  material_id: string
  material_name: string
  batch_number: string | null
  quantity: number
  unit: string | null
  recipient_name: string
  recipient_company: string | null
  purpose: string | null
  dispatch_date: string
  notes: string | null
  created_at: string
}