-- =============================================
-- Migration v11 — Stock Entries (Inventory)
-- Run in: Supabase Dashboard → SQL Editor
-- =============================================

create table if not exists stock_entries (
  id              uuid primary key default gen_random_uuid(),
  material_id     uuid not null references materials(id) on delete cascade,
  material_name   text not null,
  invoice_id      uuid references invoice_entries(id) on delete set null,
  invoice_number  text,
  supplier_name   text,
  quantity        numeric(12,3) not null,
  unit            text,
  rate            numeric(12,2),
  batch_number    text,
  mfd_date        date,
  expiry_date     date,
  entry_date      date not null,
  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_stock_entries_material_id on stock_entries(material_id);
create index if not exists idx_stock_entries_invoice_id  on stock_entries(invoice_id);
create index if not exists idx_stock_entries_entry_date  on stock_entries(entry_date desc);

alter table stock_entries enable row level security;
create policy if not exists "stock_entries_all" on stock_entries
  for all using (true) with check (true);
