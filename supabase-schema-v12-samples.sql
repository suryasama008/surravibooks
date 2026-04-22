-- =============================================
-- Migration v12 — Sample Entries
-- Run in: Supabase Dashboard → SQL Editor
-- =============================================

create table if not exists sample_entries (
  id                uuid primary key default gen_random_uuid(),
  material_id       uuid not null references materials(id) on delete cascade,
  material_name     text not null,
  batch_number      text,
  quantity          numeric(12,3) not null,
  unit              text,
  recipient_name    text not null,
  recipient_company text,
  purpose           text,
  dispatch_date     date not null,
  notes             text,
  created_at        timestamptz not null default now()
);

create index if not exists idx_sample_entries_material_id  on sample_entries(material_id);
create index if not exists idx_sample_entries_dispatch_date on sample_entries(dispatch_date desc);

alter table sample_entries enable row level security;
create policy if not exists "sample_entries_all" on sample_entries
  for all using (true) with check (true);
