-- =============================================
-- Cash Book App v3 — Schema Migration
-- Run in: https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new
-- =============================================

-- ── Add new columns to transactions ─────────────────────────────
alter table transactions add column if not exists mode        text check (mode in ('send', 'receive', 'expense'));
alter table transactions add column if not exists contact_id  uuid references contacts(id) on delete set null;
alter table transactions add column if not exists company_name text;

-- Update type check to allow more flexibility (mode now carries semantics)
-- existing check (type in ('income','expense')) stays valid

-- ── Credit Entries table ─────────────────────────────────────────
create table if not exists credit_entries (
  id             uuid          primary key default gen_random_uuid(),
  date           date          not null,
  credit_type    text          not null check (credit_type in ('credit_given', 'credit_taken')),
  contact_id     uuid          references contacts(id) on delete set null,
  company_name   text          not null,
  amount         numeric(12,2) not null,
  term           text          not null default 'open',
  due_date       date,
  invoice_number text,
  notes          text,
  status         text          not null default 'pending' check (status in ('pending', 'settled')),
  settled_tx_id  uuid          references transactions(id) on delete set null,
  created_at     timestamptz   default now()
);

-- ── Update contacts to support 'both' type ───────────────────────
alter table contacts drop constraint if exists contacts_contact_type_check;
alter table contacts add constraint contacts_contact_type_check
  check (contact_type in ('supplier', 'customer', 'both'));

-- ── Enable RLS on new table ──────────────────────────────────────
alter table credit_entries enable row level security;

-- ── Policies ─────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_policies where tablename='credit_entries' and policyname='Allow all') then
    create policy "Allow all" on credit_entries for all using (true) with check (true);
  end if;
end $$;

-- ── Indexes ──────────────────────────────────────────────────────
create index if not exists idx_credit_entries_date    on credit_entries(date desc);
create index if not exists idx_credit_entries_status  on credit_entries(status);
create index if not exists idx_credit_entries_contact on credit_entries(contact_id);
create index if not exists idx_transactions_mode      on transactions(mode);
create index if not exists idx_transactions_contact   on transactions(contact_id);

-- ── Migration: add invoice_number column if upgrading from older schema ──
alter table credit_entries add column if not exists invoice_number text;
alter table credit_entries alter column term set default 'open';
alter table credit_entries drop constraint if exists credit_entries_term_check;

-- ── v4 Migration: Invoice Entries ────────────────────────────────
-- Run this block in Supabase SQL editor

CREATE TABLE IF NOT EXISTS invoice_entries (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number   text          NOT NULL,
  invoice_date     date          NOT NULL,
  entry_type       text          NOT NULL CHECK (entry_type IN ('sale', 'purchase')),
  contact_id       uuid          REFERENCES contacts(id) ON DELETE SET NULL,
  company_name     text          NOT NULL,
  gst_number       text,
  amount           numeric(12,2) NOT NULL,
  notes            text,
  status           text          NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid')),
  transaction_date date,
  utr              text,
  bank_account     text,
  sub_category     text,
  settled_tx_id    uuid          REFERENCES transactions(id) ON DELETE SET NULL,
  created_at       timestamptz   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_entries_date    ON invoice_entries(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_entries_status  ON invoice_entries(status);
CREATE INDEX IF NOT EXISTS idx_invoice_entries_contact ON invoice_entries(contact_id);
CREATE INDEX IF NOT EXISTS idx_invoice_entries_type    ON invoice_entries(entry_type);

ALTER TABLE invoice_entries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invoice_entries' AND policyname='Allow all') THEN
    CREATE POLICY "Allow all" ON invoice_entries FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
