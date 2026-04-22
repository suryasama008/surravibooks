-- =============================================
-- Migration v14 — Add `make` column to invoice_lines
-- Run in: Supabase Dashboard → SQL Editor
-- =============================================

alter table invoice_lines
  add column if not exists make text;

comment on column invoice_lines.make is 'Manufacturer / brand name for the line item';
