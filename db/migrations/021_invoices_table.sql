-- ============================================================================
-- MIGRATION 021: Invoices Table
-- ============================================================================
-- Date: 2024-12-23
-- Purpose: Create invoices table for GST invoice generation
-- Migration: Phase 2, Task 2.1 - GST Invoice Generation
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT UNIQUE NOT NULL,
    order_id UUID REFERENCES orders(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    vendor_id UUID REFERENCES vendors(id),
    
    -- Invoice Details
    invoice_date DATE NOT NULL,
    due_date DATE,
    
    -- Amounts
    subtotal NUMERIC(10, 2) NOT NULL,
    tax_amount NUMERIC(10, 2) NOT NULL,
    cgst_amount NUMERIC(10, 2),
    sgst_amount NUMERIC(10, 2),
    igst_amount NUMERIC(10, 2),
    total_amount NUMERIC(10, 2) NOT NULL,
    
    -- Tax Details
    hsn_codes JSONB DEFAULT '[]'::jsonb, -- Array of HSN codes with rates
    tax_breakdown JSONB DEFAULT '{}'::jsonb, -- Detailed tax breakdown
    
    -- Invoice Data
    invoice_data JSONB NOT NULL, -- Complete invoice data (items, addresses, etc.)
    
    -- PDF
    pdf_url TEXT,
    pdf_generated_at TIMESTAMPTZ,
    
    -- Status
    status TEXT DEFAULT 'generated' CHECK (status IN ('generated', 'sent', 'paid', 'cancelled')),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON invoices(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_vendor_id ON invoices(vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);

COMMENT ON TABLE invoices IS 'GST invoices for orders - auto-generated on order completion';
COMMENT ON COLUMN invoices.invoice_number IS 'Unique invoice number (e.g., INV-2024-001)';
COMMENT ON COLUMN invoices.hsn_codes IS 'Array of HSN codes with GST rates';
COMMENT ON COLUMN invoices.tax_breakdown IS 'Detailed tax breakdown (CGST, SGST, IGST by item)';
COMMENT ON COLUMN invoices.invoice_data IS 'Complete invoice data (items, billing address, shipping address, etc.)';

