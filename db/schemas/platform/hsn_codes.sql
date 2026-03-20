-- ============================================================================
-- HSN_CODES TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS hsn_codes (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    hsn_code TEXT NOT NULL,
    description TEXT,
    gst_rate NUMERIC(5, 2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE hsn_codes ADD CONSTRAINT hsn_codes_hsn_code_key UNIQUE (hsn_code);

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

ALTER TABLE hsn_codes ADD CONSTRAINT hsn_codes_gst_rate_check CHECK (gst_rate BETWEEN 0 AND 100);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX hsn_codes_pkey ON public.hsn_codes USING btree (id);
CREATE UNIQUE INDEX hsn_codes_hsn_code_key ON public.hsn_codes USING btree (hsn_code);
CREATE INDEX idx_hsn_codes_active ON public.hsn_codes USING btree (is_active) WHERE is_active = true;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE hsn_codes IS 'HSN codes - maps from platform:hsn_codes KV key';
COMMENT ON COLUMN hsn_codes.hsn_code IS 'HSN code (unique)';
COMMENT ON COLUMN hsn_codes.description IS 'HSN code description';
COMMENT ON COLUMN hsn_codes.gst_rate IS 'GST rate for this HSN code (0-100)';
