-- =============================================
-- Migration v14 — Batch Stock Management
-- Run in: Supabase Dashboard → SQL Editor
-- =============================================
-- No schema changes needed — all batch logic is
-- handled at the application level using existing
-- stock_entries table columns:
--   batch_number, mfd_date, expiry_date, quantity
--
-- This migration adds a helpful index for batch lookups
-- and a view for current batch stock levels.
-- =============================================

-- Index for fast batch-level queries (material + batch)
create index if not exists idx_stock_entries_batch
  on stock_entries(material_name, batch_number)
  where batch_number is not null;

-- View: current stock per material + batch (net qty after sales deductions)
create or replace view batch_stock_summary as
select
  material_id,
  material_name,
  batch_number,
  sum(quantity)                                     as net_qty,
  max(unit)                                         as unit,
  max(mfd_date)                                     as mfd_date,
  max(expiry_date)                                  as expiry_date,
  max(entry_date)                                   as last_entry_date,
  count(*) filter (where quantity > 0)              as purchase_entries,
  count(*) filter (where quantity < 0)              as sale_entries
from stock_entries
where batch_number is not null
group by material_id, material_name, batch_number
order by material_name, expiry_date nulls last;

-- View: current stock per material (all batches combined)
create or replace view material_stock_summary as
select
  material_id,
  material_name,
  sum(quantity)  as net_qty,
  max(unit)      as unit,
  count(distinct batch_number) filter (where batch_number is not null and quantity > 0) as active_batches
from stock_entries
group by material_id, material_name
order by material_name;
