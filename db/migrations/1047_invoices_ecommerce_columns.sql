-- ============================================================================
-- MIGRATION 1047: Invoices ecommerce columns (210 schema on legacy 021 table)
-- ============================================================================
-- Purpose: Add tax-invoice columns expected by tax-invoice-pdf when migration
--          210 CREATE TABLE IF NOT EXISTS skipped an existing invoices table.
-- ============================================================================

ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS invoice_type TEXT DEFAULT 'tax_invoice';

ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS shipping_amount NUMERIC(12, 2) DEFAULT 0;

ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) DEFAULT 0;

ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS is_inter_state BOOLEAN DEFAULT false;

ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS customer_gstin TEXT;

ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS place_of_supply TEXT;

ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS gst_filed BOOLEAN DEFAULT false;

ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS gst_filed_at TIMESTAMPTZ;

-- Backfill invoice_type for existing rows
UPDATE invoices
SET invoice_type = 'tax_invoice'
WHERE invoice_type IS NULL;

COMMENT ON COLUMN invoices.invoice_type IS 'tax_invoice, credit_note, debit_note, or proforma';
