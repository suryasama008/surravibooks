export const ACCOUNTS = ['ICICI', 'SBI', 'Cash']

// Send (payment to supplier / purchase invoice) categories
export const SEND_CATEGORIES = ['Procurement & Purchases', 'Transfer', 'Others']
export const SEND_SUB_CATEGORIES: Record<string, string[]> = {
  'Procurement & Purchases': ['Credit Vendor Payment', 'Advance Vendor Payment'],
  'Transfer': ['Handloan Paid', 'Handloan Received'],
  'Others':   ['Bank Charges', 'Refund', 'Miscellaneous', 'Misc-2'],
}

// Receive (payment from customer / sale invoice) categories
export const RECEIVE_CATEGORIES = ['Sales & Collections', 'Transfer', 'Others']
export const RECEIVE_SUB_CATEGORIES: Record<string, string[]> = {
  'Sales & Collections': ['Advance Customer Payment', 'Credit Customer Payment'],
  'Transfer': ['Handloan Received', 'Handloan Paid'],
  'Others':   ['Refund Received', 'Miscellaneous', 'Misc-2'],
}

// Expense (day-to-day operations) categories
export const EXPENSE_CATEGORIES = [
  'Office',
  'Staff',
  'Travel & Fuel',
  'Operations',
  'Personal',
  'Miscellaneous',
]
export const EXPENSE_SUB_CATEGORIES: Record<string, string[]> = {
  'Office':          ['Rent', 'Electricity', 'WiFi', 'Stationery', 'GST Fee Consultant', 'Other'],
  'Staff':           ['Salaries', 'Staff Welfare', 'Salary Advance', 'Other'],
  'Travel & Fuel':   ['Fuel', 'Travel', 'Vehicle Maintenance', 'Accommodation'],
  'Operations':      ['Logistics', 'Loading/Unloading', 'Gifts', 'Other'],
  'Personal':        ['Personal Expense'],
  'Miscellaneous':   ['Miscellaneous', 'Misc-2'],
}

export const PAYMENT_MODES = ['PhonePe', 'RTGS/NEFT', 'Cash', 'Cheque', 'Others']

export const CREDIT_TERMS = [
  { value: '30', label: '30 Days' },
  { value: '45', label: '45 Days' },
  { value: '60', label: '60 Days' },
  { value: '90', label: '90 Days' },
  { value: 'open', label: 'Open Credit' },
]

export const FY_MONTHS_LABELS = [
  'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar',
]

// Legacy compat
export const CATEGORIES = [...SEND_CATEGORIES, ...RECEIVE_CATEGORIES, ...EXPENSE_CATEGORIES]
export const INCOME_CATEGORIES = RECEIVE_CATEGORIES
export const EXPENSE_CATEGORIES_LEGACY = EXPENSE_CATEGORIES
export const SUB_CATEGORIES: Record<string, string[]> = {
  ...SEND_SUB_CATEGORIES,
  ...RECEIVE_SUB_CATEGORIES,
  ...EXPENSE_SUB_CATEGORIES,
}
