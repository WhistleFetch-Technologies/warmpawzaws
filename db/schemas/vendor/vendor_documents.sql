-- ============================================================================
-- VENDOR_DOCUMENTS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_documents (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL,
    document_type TEXT NOT NULL,
    document_name TEXT NOT NULL,
    document_url TEXT NOT NULL,
    file_type TEXT,
    file_size BIGINT,
    is_verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMPTZ,
    uploaded_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE vendor_documents ADD CONSTRAINT vendor_documents_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON UPDATE NO ACTION ON DELETE CASCADE;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX vendor_documents_pkey ON public.vendor_documents USING btree (id);
CREATE INDEX idx_vendor_documents_vendor ON public.vendor_documents USING btree (vendor_id);
CREATE INDEX idx_vendor_documents_type ON public.vendor_documents USING btree (document_type);
CREATE INDEX idx_vendor_documents_verified ON public.vendor_documents USING btree (is_verified) WHERE is_verified = true;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE vendor_documents IS 'Maps from DynamicVendorOnboardingForm document uploads';
COMMENT ON COLUMN vendor_documents.vendor_id IS 'Reference to vendors table';
COMMENT ON COLUMN vendor_documents.document_type IS 'Type of document: registration, gst, pan, license, etc.';
COMMENT ON COLUMN vendor_documents.document_name IS 'Name of the document file';
COMMENT ON COLUMN vendor_documents.document_url IS 'URL/path to the uploaded document';
COMMENT ON COLUMN vendor_documents.file_type IS 'File type/MIME type';
COMMENT ON COLUMN vendor_documents.file_size IS 'File size in bytes';
COMMENT ON COLUMN vendor_documents.is_verified IS 'Whether document has been verified by admin';
COMMENT ON COLUMN vendor_documents.verified_at IS 'Timestamp when document was verified';
