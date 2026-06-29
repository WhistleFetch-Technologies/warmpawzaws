-- ============================================================================
-- MIGRATION 1046: Platform tax documents (WarmPawz → vendor)
-- ============================================================================
-- Purpose: GST tax invoices / credit notes for platform commission & fees
-- ============================================================================

CREATE TABLE IF NOT EXISTS platform_tax_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    sac_code TEXT,
    default_gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 18.00
        CONSTRAINT chk_platform_tax_product_gst_rate CHECK (default_gst_rate >= 0 AND default_gst_rate <= 100),
    invoice_grouping TEXT NOT NULL DEFAULT 'MONTHLY'
        CONSTRAINT chk_platform_tax_product_invoice_grouping CHECK (invoice_grouping IN ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY')),
    active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_platform_tax_products_code UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_platform_tax_products_active
    ON platform_tax_products (active) WHERE active = true;

CREATE TABLE IF NOT EXISTS platform_tax_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL DEFAULT 'TAX_INVOICE'
        CONSTRAINT chk_platform_tax_document_type CHECK (document_type IN ('TAX_INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE')),
    status TEXT NOT NULL DEFAULT 'DRAFT'
        CONSTRAINT chk_platform_tax_document_status CHECK (status IN ('DRAFT', 'ISSUED', 'VOID')),
    invoice_number TEXT,
    period_from DATE NOT NULL,
    period_to DATE NOT NULL,
    taxable_amount NUMERIC(12, 2) NOT NULL DEFAULT 0
        CONSTRAINT chk_platform_tax_doc_taxable CHECK (taxable_amount >= 0),
    gst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0
        CONSTRAINT chk_platform_tax_doc_gst CHECK (gst_amount >= 0),
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0
        CONSTRAINT chk_platform_tax_doc_total CHECK (total_amount >= 0),
    pdf_url TEXT,
    supplier_snapshot JSONB,
    recipient_snapshot JSONB,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    issued_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_platform_tax_doc_period CHECK (period_to >= period_from)
);

CREATE INDEX IF NOT EXISTS idx_platform_tax_documents_vendor
    ON platform_tax_documents (vendor_id);
CREATE INDEX IF NOT EXISTS idx_platform_tax_documents_status
    ON platform_tax_documents (status);
CREATE INDEX IF NOT EXISTS idx_platform_tax_documents_period
    ON platform_tax_documents (vendor_id, period_from, period_to);

CREATE UNIQUE INDEX IF NOT EXISTS uq_platform_tax_invoice_vendor_period
    ON platform_tax_documents (vendor_id, period_from, period_to)
    WHERE document_type = 'TAX_INVOICE' AND status != 'VOID';

CREATE TABLE IF NOT EXISTS platform_tax_document_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tax_document_id UUID NOT NULL REFERENCES platform_tax_documents(id) ON DELETE CASCADE,
    charge_type TEXT NOT NULL DEFAULT 'PLATFORM_COMMISSION',
    description TEXT NOT NULL,
    sac_code TEXT,
    gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 0
        CONSTRAINT chk_platform_tax_doc_line_gst_rate CHECK (gst_rate >= 0 AND gst_rate <= 100),
    taxable_amount NUMERIC(12, 2) NOT NULL DEFAULT 0
        CONSTRAINT chk_platform_tax_doc_line_taxable CHECK (taxable_amount >= 0),
    gst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0
        CONSTRAINT chk_platform_tax_doc_line_gst CHECK (gst_amount >= 0),
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0
        CONSTRAINT chk_platform_tax_doc_line_total CHECK (total_amount >= 0),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_tax_document_lines_document
    ON platform_tax_document_lines (tax_document_id);

COMMENT ON TABLE platform_tax_documents IS 'WarmPawz → vendor GST tax invoices and credit notes';
COMMENT ON TABLE platform_tax_products IS 'Billable platform charge catalog (SAC, GST rate) — admin-configurable via DB';

INSERT INTO platform_tax_products (code, name, sac_code, default_gst_rate, invoice_grouping, active, metadata)
VALUES (
    'PLATFORM_COMMISSION',
    'Platform commission on marketplace sales',
    '998599',
    18.00,
    'MONTHLY',
    true,
    '{"source":"migration_1046"}'::jsonb
)
ON CONFLICT (code) DO NOTHING;
