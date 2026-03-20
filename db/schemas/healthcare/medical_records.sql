-- ============================================================================
-- MEDICAL_RECORDS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS medical_records (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    pet_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    vendor_id UUID NOT NULL,
    booking_id UUID,
    record_type TEXT NOT NULL,
    title TEXT,
    description TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_by UUID,
    created_by_role TEXT DEFAULT 'vendor',
    updated_by UUID,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE medical_records ADD CONSTRAINT medical_records_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES pets(id) ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE medical_records ADD CONSTRAINT medical_records_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE medical_records ADD CONSTRAINT medical_records_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE medical_records ADD CONSTRAINT medical_records_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE NO ACTION ON DELETE SET NULL;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX medical_records_pkey ON public.medical_records USING btree (id);
CREATE INDEX idx_medical_records_pet_id ON public.medical_records USING btree (pet_id);
CREATE INDEX idx_medical_records_customer_id ON public.medical_records USING btree (customer_id);
CREATE INDEX idx_medical_records_vendor_id ON public.medical_records USING btree (vendor_id);
CREATE INDEX idx_medical_records_booking_id ON public.medical_records USING btree (booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX idx_medical_records_type ON public.medical_records USING btree (record_type);
CREATE INDEX idx_medical_records_date ON public.medical_records USING btree (created_at DESC);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE medical_records IS 'Medical records - healthcare compliance';
COMMENT ON COLUMN medical_records.pet_id IS 'Reference to pets table';
COMMENT ON COLUMN medical_records.customer_id IS 'Reference to customers table';
COMMENT ON COLUMN medical_records.vendor_id IS 'Reference to vendors table';
COMMENT ON COLUMN medical_records.booking_id IS 'Reference to bookings table';
COMMENT ON COLUMN medical_records.record_type IS 'Record type: consultation, vaccination, surgery, test_result, etc.';
COMMENT ON COLUMN medical_records.title IS 'Record title';
COMMENT ON COLUMN medical_records.description IS 'Record description';
COMMENT ON COLUMN medical_records.attachments IS 'Array of file URLs (JSONB)';
COMMENT ON COLUMN medical_records.created_by_role IS 'Role of creator: vendor, staff, etc.';
