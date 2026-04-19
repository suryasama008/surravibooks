-- =============================================
-- Migration v7 — Add cgst_rate & sgst_rate to invoice_lines
-- Run in: Supabase Dashboard → SQL Editor
-- =============================================

-- Add CGST and SGST columns to invoice_lines
alter table invoice_lines
  add column if not exists cgst_rate numeric(5,2),
  add column if not exists sgst_rate numeric(5,2);

-- Backfill: for existing rows that have gst_rate, split equally into cgst+sgst
update invoice_lines
set
  cgst_rate = gst_rate / 2.0,
  sgst_rate = gst_rate / 2.0
where gst_rate is not null
  and cgst_rate is null;

-- Indexes for GST reporting queries
create index if not exists idx_invoice_lines_invoice_id on invoice_lines(invoice_id);
