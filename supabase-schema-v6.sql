-- =============================================
-- Surravi Books v6 — Invoice Payments (Partial + Multi)
-- Run AFTER v5 schema in Supabase SQL Editor
-- =============================================

-- ── Add amount_paid to invoice_entries ───────────────────────────
ALTER TABLE invoice_entries ADD COLUMN IF NOT EXISTS amount_paid numeric(12,2) NOT NULL DEFAULT 0;

-- Update status to allow 'partial'
ALTER TABLE invoice_entries DROP CONSTRAINT IF EXISTS invoice_entries_status_check;
ALTER TABLE invoice_entries ADD CONSTRAINT invoice_entries_status_check
  CHECK (status IN ('unpaid', 'partial', 'paid'));

-- ── Invoice payments table ────────────────────────────────────────
-- One row per payment event per invoice.
-- Multiple invoices paid together share the same transaction_id.
CREATE TABLE IF NOT EXISTS invoice_payments (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id     uuid          NOT NULL REFERENCES invoice_entries(id) ON DELETE CASCADE,
  transaction_id uuid          REFERENCES transactions(id) ON DELETE SET NULL,
  payment_date   date          NOT NULL,
  amount         numeric(12,2) NOT NULL,
  bank_account   text,
  payment_mode   text,
  utr            text,
  notes          text,
  created_at     timestamptz   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_payments_invoice ON invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_inv_payments_tx      ON invoice_payments(transaction_id);

ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invoice_payments' AND policyname='Allow all') THEN
    CREATE POLICY "Allow all" ON invoice_payments FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
