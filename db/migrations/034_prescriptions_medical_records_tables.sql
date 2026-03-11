-- ============================================================================
-- PRESCRIPTIONS AND MEDICAL RECORDS TABLES
-- ============================================================================
-- Tables for healthcare compliance:
-- - Prescriptions (immutable)
-- - Medical records
-- - Cart items (for e-commerce)
-- ============================================================================

-- Prescriptions
CREATE TABLE IF NOT EXISTS prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    pet_id UUID REFERENCES pets(id) ON DELETE SET NULL,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    medications JSONB NOT NULL, -- Array of medication objects
    instructions TEXT,
    diagnosis TEXT,
    follow_up_date DATE,
    created_by UUID,
    created_by_role TEXT DEFAULT 'vendor',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_booking_id ON prescriptions(booking_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_customer_id ON prescriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_pet_id ON prescriptions(pet_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_vendor_id ON prescriptions(vendor_id);

-- Medical Records
CREATE TABLE IF NOT EXISTS medical_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    record_type TEXT NOT NULL, -- 'consultation', 'vaccination', 'surgery', 'test_result', etc.
    title TEXT,
    description TEXT,
    attachments JSONB DEFAULT '[]'::jsonb, -- Array of file URLs
    created_by UUID,
    created_by_role TEXT DEFAULT 'vendor',
    updated_by UUID,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medical_records_pet_id ON medical_records(pet_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_customer_id ON medical_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_vendor_id ON medical_records(vendor_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_booking_id ON medical_records(booking_id);

-- Cart Items (for e-commerce)
CREATE TABLE IF NOT EXISTS cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(customer_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_customer_id ON cart_items(customer_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON cart_items(product_id);

-- Updated timestamp triggers
CREATE OR REPLACE FUNCTION update_prescriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_prescriptions_updated_at
    BEFORE UPDATE ON prescriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_prescriptions_updated_at();

CREATE TRIGGER trigger_update_medical_records_updated_at
    BEFORE UPDATE ON medical_records
    FOR EACH ROW
    EXECUTE FUNCTION update_prescriptions_updated_at();

CREATE TRIGGER trigger_update_cart_items_updated_at
    BEFORE UPDATE ON cart_items
    FOR EACH ROW
    EXECUTE FUNCTION update_prescriptions_updated_at();

