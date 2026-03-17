-- ============================================================================
-- PRESCRIPTIONS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS prescriptions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    booking_id UUID,
    customer_id UUID NOT NULL,
    pet_id UUID,
    vendor_id UUID NOT NULL,
    staff_id UUID,
    medications JSONB NOT NULL,
    instructions TEXT,
    diagnosis TEXT,
    follow_up_date DATE,
    created_by UUID,
    created_by_role TEXT DEFAULT 'vendor',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES pets(id) ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staff(id) ON UPDATE NO ACTION ON DELETE SET NULL;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX prescriptions_pkey ON public.prescriptions USING btree (id);
CREATE INDEX idx_prescriptions_booking_id ON public.prescriptions USING btree (booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX idx_prescriptions_customer_id ON public.prescriptions USING btree (customer_id);
CREATE INDEX idx_prescriptions_pet_id ON public.prescriptions USING btree (pet_id) WHERE pet_id IS NOT NULL;
CREATE INDEX idx_prescriptions_vendor_id ON public.prescriptions USING btree (vendor_id);
CREATE INDEX idx_prescriptions_staff_id ON public.prescriptions USING btree (staff_id) WHERE staff_id IS NOT NULL;
CREATE INDEX idx_prescriptions_is_active ON public.prescriptions USING btree (is_active) WHERE is_active = true;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE prescriptions IS 'Prescriptions (immutable) - healthcare compliance';
COMMENT ON COLUMN prescriptions.booking_id IS 'Reference to bookings table';
COMMENT ON COLUMN prescriptions.customer_id IS 'Reference to customers table';
COMMENT ON COLUMN prescriptions.pet_id IS 'Reference to pets table';
COMMENT ON COLUMN prescriptions.vendor_id IS 'Reference to vendors table';
COMMENT ON COLUMN prescriptions.staff_id IS 'Reference to staff table';
COMMENT ON COLUMN prescriptions.medications IS 'Array of medication objects (JSONB)';
COMMENT ON COLUMN prescriptions.instructions IS 'Prescription instructions';
COMMENT ON COLUMN prescriptions.diagnosis IS 'Diagnosis';
COMMENT ON COLUMN prescriptions.follow_up_date IS 'Follow-up date';
COMMENT ON COLUMN prescriptions.created_by_role IS 'Role of creator: vendor, staff, etc.';
