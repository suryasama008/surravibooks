-- =============================================
-- Surravi Books v5 — Invoice Lines + Materials
-- Run AFTER existing schema in Supabase SQL Editor
-- =============================================

-- ── Materials master table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS materials (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  material_name text          NOT NULL,
  hsn_code      text,
  gst_rate      numeric(4,1),
  created_at    timestamptz   DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_materials_name ON materials(material_name);
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='materials' AND policyname='Allow all') THEN
    CREATE POLICY "Allow all" ON materials FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── Invoice lines table ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_lines (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    uuid          NOT NULL REFERENCES invoice_entries(id) ON DELETE CASCADE,
  material_name text          NOT NULL,
  hsn_code      text,
  quantity      numeric(12,3),
  unit          text,
  rate          numeric(12,2),
  gst_rate      numeric(4,1),
  created_at    timestamptz   DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines(invoice_id);
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invoice_lines' AND policyname='Allow all') THEN
    CREATE POLICY "Allow all" ON invoice_lines FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
