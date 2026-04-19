-- =============================================
-- Migration v9 — Contact address + notes
-- Run in: Supabase Dashboard → SQL Editor
-- =============================================

-- 1. Add address column to contacts
alter table contacts
  add column if not exists address text;

-- 2. Create contact_notes table for activity/notes per company
create table if not exists contact_notes (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid not null references contacts(id) on delete cascade,
  note_text   text not null,
  created_at  timestamptz not null default now()
);

-- Index for fast lookup by contact
create index if not exists idx_contact_notes_contact_id on contact_notes(contact_id);

-- RLS (match your existing contacts policy pattern)
alter table contact_notes enable row level security;

-- Allow all operations for authenticated users (adjust to match your existing RLS)
create policy if not exists "contact_notes_all" on contact_notes
  for all using (true) with check (true);
