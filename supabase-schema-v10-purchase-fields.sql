-- =============================================
-- Migration v10 — Purchase invoice extra fields
-- Run in: Supabase Dashboard → SQL Editor
-- =============================================

-- InvoiceEntry: received date + payment terms
alter table invoice_entries
  add column if not exists received_date        date,
  add column if not exists payment_terms        text,        -- 'advance'|'30'|'45'|'60'|'90'|'custom'
  add column if not exists payment_terms_custom text;        -- free text when payment_terms = 'custom'

-- InvoiceLine: batch info + IGST
alter table invoice_lines
  add column if not exists igst_rate    numeric(5,2),
  add column if not exists batch_number text,
  add column if not exists mfd_date     date,
  add column if not exists expiry_date  date;
