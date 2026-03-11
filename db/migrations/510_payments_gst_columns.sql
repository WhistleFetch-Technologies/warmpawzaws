-- Add GST and fee columns to payments if missing (fixes 42703 when code inserts gst_amount etc.)
-- Safe to run multiple times (idempotent).
-- Run this on any environment where payments table was created before 007/008/410.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'gst_amount') THEN
    ALTER TABLE payments ADD COLUMN gst_amount NUMERIC(10, 2) DEFAULT 0;
    COMMENT ON COLUMN payments.gst_amount IS 'Total GST amount';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'cgst_amount') THEN
    ALTER TABLE payments ADD COLUMN cgst_amount NUMERIC(10, 2) DEFAULT 0;
    COMMENT ON COLUMN payments.cgst_amount IS 'Central GST (intra-state)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'sgst_amount') THEN
    ALTER TABLE payments ADD COLUMN sgst_amount NUMERIC(10, 2) DEFAULT 0;
    COMMENT ON COLUMN payments.sgst_amount IS 'State GST (intra-state)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'igst_amount') THEN
    ALTER TABLE payments ADD COLUMN igst_amount NUMERIC(10, 2) DEFAULT 0;
    COMMENT ON COLUMN payments.igst_amount IS 'Integrated GST (inter-state)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'gst_rule_id') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'gst_rules') THEN
      ALTER TABLE payments ADD COLUMN gst_rule_id UUID REFERENCES gst_rules(id);
    ELSE
      ALTER TABLE payments ADD COLUMN gst_rule_id UUID;
    END IF;
    COMMENT ON COLUMN payments.gst_rule_id IS 'GST rule applied to this payment';
  END IF;
END $$;
