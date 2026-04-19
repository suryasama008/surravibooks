-- =============================================
-- Migration v13 — Sample flags on stock_entries
-- Run in: Supabase Dashboard → SQL Editor
-- =============================================

-- Add paid_sample badge (purchase that is a paid sample)
alter table stock_entries
  add column if not exists is_paid_sample  boolean default null,
  add column if not exists is_sample_give  boolean default null,
  add column if not exists sample_company  text    default null;

-- Index for quick sample-give queries
create index if not exists idx_stock_entries_is_sample_give on stock_entries(is_sample_give) where is_sample_give = true;
