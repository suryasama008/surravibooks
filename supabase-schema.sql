-- =============================================
-- Cash Book App v2 — Supabase Schema
-- Run in: https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new
-- =============================================

-- ── Transactions table ───────────────────────────────────────────
create table if not exists transactions (
  id           uuid          primary key default gen_random_uuid(),
  date         date          not null,
  type         text          not null check (type in ('income', 'expense')),
  account      text          not null,
  amount       numeric(12,2) not null,
  category     text,
  sub_category text,
  description  text,
  payment_mode text,
  notes        text,
  created_at   timestamptz   default now()
);

-- ── Transaction History (Audit Log) ─────────────────────────────
create table if not exists transaction_history (
  id             uuid        primary key default gen_random_uuid(),
  transaction_id uuid,
  action         text        not null check (action in ('create', 'update', 'delete')),
  snapshot       jsonb,
  created_at     timestamptz default now()
);

-- ── Contacts ─────────────────────────────────────────────────────
create table if not exists contacts (
  id           uuid        primary key default gen_random_uuid(),
  company_name text        not null,
  gst_number   text,
  contact_type text        not null check (contact_type in ('supplier', 'customer')),
  phone        text,
  email        text,
  notes        text,
  created_at   timestamptz default now()
);

-- ── Business Transactions ────────────────────────────────────────
create table if not exists biz_transactions (
  id           uuid          primary key default gen_random_uuid(),
  date         date          not null,
  biz_type     text          not null check (biz_type in ('send', 'receive', 'to_receive', 'to_pay')),
  contact_id   uuid          references contacts(id) on delete set null,
  company_name text          not null,
  gst_number   text,
  amount       numeric(12,2) not null,
  notes        text,
  status       text          not null default 'pending' check (status in ('pending', 'settled')),
  created_at   timestamptz   default now()
);

-- ── Opening Balances ─────────────────────────────────────────────
create table if not exists opening_balances (
  id          uuid          primary key default gen_random_uuid(),
  account     text          not null unique,
  balance     numeric(12,2) not null default 0,
  as_of_date  date          not null,
  updated_at  timestamptz   default now()
);

-- Insert default opening balances
insert into opening_balances (account, balance, as_of_date) values
  ('ICICI', 0, now()::date),
  ('SBI',   0, now()::date)
on conflict (account) do nothing;

-- ── Recurring Entries ─────────────────────────────────────────────
create table if not exists recurring_entries (
  id           uuid          primary key default gen_random_uuid(),
  name         text          not null,
  type         text          not null check (type in ('income', 'expense')),
  account      text          not null,
  amount       numeric(12,2) not null,
  category     text,
  sub_category text,
  description  text,
  payment_mode text,
  day_of_month int           not null default 1 check (day_of_month between 1 and 28),
  last_applied date,
  is_active    boolean       not null default true,
  created_at   timestamptz   default now()
);

-- ── Settings ─────────────────────────────────────────────────────
create table if not exists settings (
  id         uuid        primary key default gen_random_uuid(),
  key        text        not null unique,
  value      text,
  updated_at timestamptz default now()
);

-- ── Enable RLS ───────────────────────────────────────────────────
alter table transactions       enable row level security;
alter table transaction_history enable row level security;
alter table contacts            enable row level security;
alter table biz_transactions    enable row level security;
alter table opening_balances    enable row level security;
alter table recurring_entries   enable row level security;
alter table settings            enable row level security;

-- ── Policies ─────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_policies where tablename='transactions' and policyname='Allow all') then
    create policy "Allow all" on transactions for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='transaction_history' and policyname='Allow all') then
    create policy "Allow all" on transaction_history for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='contacts' and policyname='Allow all') then
    create policy "Allow all" on contacts for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='biz_transactions' and policyname='Allow all') then
    create policy "Allow all" on biz_transactions for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='opening_balances' and policyname='Allow all') then
    create policy "Allow all" on opening_balances for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='recurring_entries' and policyname='Allow all') then
    create policy "Allow all" on recurring_entries for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='settings' and policyname='Allow all') then
    create policy "Allow all" on settings for all using (true) with check (true);
  end if;
end $$;

-- ── Indexes ──────────────────────────────────────────────────────
create index if not exists idx_transactions_date       on transactions(date desc);
create index if not exists idx_transactions_type       on transactions(type);
create index if not exists idx_biz_transactions_date   on biz_transactions(date desc);
create index if not exists idx_biz_transactions_contact on biz_transactions(contact_id);
create index if not exists idx_contacts_type           on contacts(contact_type);
create index if not exists idx_tx_history_tx_id        on transaction_history(transaction_id);
