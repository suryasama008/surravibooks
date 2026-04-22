-- =============================================
-- Migration v8 — Add advance_balance to contacts
-- Run in: Supabase Dashboard → SQL Editor
-- =============================================

-- Stores excess/overpayment amounts received from a contact
-- beyond what their invoices required. Shown as "advance" in the contact card.
alter table contacts
  add column if not exists advance_balance numeric(12,2) default 0;

-- Set null rows to 0
update contacts
set advance_balance = 0
where advance_balance is null;
