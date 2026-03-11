-- Migration: Regulated Flows SQL Migration
-- Purpose: Create SQL tables for regulated flows (NO KV STORE)
-- Date: 2025-01-22

-- ============================================
-- MEDICAL RECORDS TABLE
-- ============================================
-- Immutable medical records (read-only after creation)
CREATE TABLE IF NOT EXISTS medical_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id),
    vendor_id UUID REFERENCES vendors(id),
    staff_id UUID REFERENCES staff(id),
    
    -- Record details
    record_type TEXT NOT NULL CHECK (record_type IN ('checkup', 'vaccination', 'surgery', 'illness', 'injury', 'prescription', 'diagnostic', 'other')),
    description TEXT NOT NULL,
    diagnosis TEXT,
    observations TEXT,
    treatment_notes TEXT,
    
    -- Medications (if applicable)
    medications JSONB, -- Array of medication objects
    
    -- Vitals (if applicable)
    vitals JSONB, -- { weight, temperature, heartRate, respiratoryRate, bloodPressure }
    
    -- Attachments
    attachments JSONB, -- Array of attachment URLs
    
    -- Immutability
    is_immutable BOOLEAN DEFAULT true, -- Medical records are immutable by default
    created_by UUID NOT NULL, -- User who created the record
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Audit
    version INTEGER DEFAULT 1,
    previous_version_id UUID REFERENCES medical_records(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_medical_records_pet_id ON medical_records(pet_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_booking_id ON medical_records(booking_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_vendor_id ON medical_records(vendor_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_created_at ON medical_records(created_at DESC);

-- Prevent updates (immutability)
CREATE OR REPLACE FUNCTION prevent_medical_record_updates()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_immutable = true THEN
        RAISE EXCEPTION 'Medical records are immutable and cannot be updated';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_medical_record_updates
    BEFORE UPDATE ON medical_records
    FOR EACH ROW
    EXECUTE FUNCTION prevent_medical_record_updates();

-- ============================================
-- PRESCRIPTIONS TABLE
-- ============================================
-- Immutable prescriptions (after finalization)
CREATE TABLE IF NOT EXISTS prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES staff(id),
    
    -- Prescription details
    diagnosis TEXT,
    observations TEXT,
    medications JSONB NOT NULL, -- Array of medication objects with name, dosage, frequency, duration, instructions
    products_used JSONB, -- Array of products used
    tests_recommended JSONB, -- Array of recommended tests
    general_notes TEXT,
    recommendations TEXT,
    next_follow_up_date DATE,
    follow_up_reason TEXT,
    
    -- Vitals
    vitals JSONB,
    
    -- Attachments
    attachments JSONB,
    
    -- Status & Immutability
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized', 'immutable')),
    is_immutable BOOLEAN DEFAULT false,
    finalized_at TIMESTAMPTZ,
    finalized_by UUID REFERENCES staff(id),
    
    -- Digital signature (for future implementation)
    digital_signature TEXT,
    signature_timestamp TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Audit
    version INTEGER DEFAULT 1,
    previous_version_id UUID REFERENCES prescriptions(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prescriptions_booking_id ON prescriptions(booking_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_pet_id ON prescriptions(pet_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_customer_id ON prescriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_vendor_id ON prescriptions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_prescriptions_created_at ON prescriptions(created_at DESC);

-- Prevent updates after finalization (immutability)
CREATE OR REPLACE FUNCTION prevent_prescription_updates()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'immutable' OR OLD.is_immutable = true THEN
        RAISE EXCEPTION 'Prescription is immutable and cannot be updated';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_prescription_updates
    BEFORE UPDATE ON prescriptions
    FOR EACH ROW
    EXECUTE FUNCTION prevent_prescription_updates();

-- Function to finalize prescription (make immutable)
CREATE OR REPLACE FUNCTION finalize_prescription(p_prescription_id UUID, p_finalized_by UUID)
RETURNS void AS $$
BEGIN
    UPDATE prescriptions
    SET 
        status = 'immutable',
        is_immutable = true,
        finalized_at = NOW(),
        finalized_by = p_finalized_by,
        updated_at = NOW()
    WHERE id = p_prescription_id AND status = 'draft';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- MEDICINE ORDERS TABLE
-- ============================================
-- Medicine order flow with state transitions
CREATE TABLE IF NOT EXISTS medicine_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    prescription_id UUID REFERENCES prescriptions(id),
    
    -- Order details
    order_number TEXT NOT NULL UNIQUE,
    medicines JSONB NOT NULL, -- Array of medicine items
    delivery_address JSONB NOT NULL, -- { street, city, state, pincode, lat, lng }
    delivery_instructions TEXT,
    prescription_url TEXT,
    
    -- Pharmacy assignment
    pharmacy_vendor_id UUID REFERENCES vendors(id),
    pharmacy_name TEXT,
    pharmacy_phone TEXT,
    
    -- Pricing
    subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
    delivery_charge DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    
    -- Proforma invoice
    proforma_invoice_url TEXT,
    proforma_invoice_generated_at TIMESTAMPTZ,
    
    -- Payment
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    payment_id UUID,
    payment_method TEXT,
    paid_at TIMESTAMPTZ,
    
    -- State transitions
    status TEXT NOT NULL DEFAULT 'prescription_uploaded' CHECK (status IN (
        'prescription_uploaded',
        'broadcasted_to_pharmacies',
        'quotes_received',
        'pharmacy_selected',
        'proforma_invoice_generated',
        'payment_pending',
        'payment_completed',
        'order_confirmed',
        'preparing',
        'shipped',
        'out_for_delivery',
        'delivered',
        'cancelled',
        'refunded'
    )),
    status_changed_at TIMESTAMPTZ DEFAULT NOW(),
    status_changed_by UUID,
    status_change_reason TEXT,
    
    -- Delivery tracking
    tracking_id TEXT,
    tracking_url TEXT,
    estimated_delivery_date DATE,
    estimated_delivery_time TEXT,
    actual_delivery_date DATE,
    actual_delivery_time TEXT,
    delivery_agent_name TEXT,
    delivery_agent_phone TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_medicine_orders_customer_id ON medicine_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_medicine_orders_prescription_id ON medicine_orders(prescription_id);
CREATE INDEX IF NOT EXISTS idx_medicine_orders_status ON medicine_orders(status);
CREATE INDEX IF NOT EXISTS idx_medicine_orders_order_number ON medicine_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_medicine_orders_created_at ON medicine_orders(created_at DESC);

-- State transition validation
CREATE OR REPLACE FUNCTION validate_medicine_order_transition()
RETURNS TRIGGER AS $$
BEGIN
    -- Define valid state transitions
    IF OLD.status = 'prescription_uploaded' AND NEW.status NOT IN ('broadcasted_to_pharmacies', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid state transition from prescription_uploaded';
    END IF;
    
    IF OLD.status = 'broadcasted_to_pharmacies' AND NEW.status NOT IN ('quotes_received', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid state transition from broadcasted_to_pharmacies';
    END IF;
    
    IF OLD.status = 'quotes_received' AND NEW.status NOT IN ('pharmacy_selected', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid state transition from quotes_received';
    END IF;
    
    IF OLD.status = 'pharmacy_selected' AND NEW.status NOT IN ('proforma_invoice_generated', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid state transition from pharmacy_selected';
    END IF;
    
    IF OLD.status = 'proforma_invoice_generated' AND NEW.status NOT IN ('payment_pending', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid state transition from proforma_invoice_generated';
    END IF;
    
    IF OLD.status = 'payment_pending' AND NEW.status NOT IN ('payment_completed', 'payment_failed', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid state transition from payment_pending';
    END IF;
    
    IF OLD.status = 'payment_completed' AND NEW.status NOT IN ('order_confirmed', 'refunded') THEN
        RAISE EXCEPTION 'Invalid state transition from payment_completed';
    END IF;
    
    IF OLD.status = 'order_confirmed' AND NEW.status NOT IN ('preparing', 'cancelled', 'refunded') THEN
        RAISE EXCEPTION 'Invalid state transition from order_confirmed';
    END IF;
    
    IF OLD.status = 'preparing' AND NEW.status NOT IN ('shipped', 'cancelled', 'refunded') THEN
        RAISE EXCEPTION 'Invalid state transition from preparing';
    END IF;
    
    IF OLD.status = 'shipped' AND NEW.status NOT IN ('out_for_delivery', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid state transition from shipped';
    END IF;
    
    IF OLD.status = 'out_for_delivery' AND NEW.status NOT IN ('delivered', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid state transition from out_for_delivery';
    END IF;
    
    -- Update status change timestamp
    NEW.status_changed_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_medicine_order_transition
    BEFORE UPDATE ON medicine_orders
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION validate_medicine_order_transition();

-- ============================================
-- PHARMACY QUOTES TABLE
-- ============================================
-- Quotes from pharmacies for medicine orders
CREATE TABLE IF NOT EXISTS pharmacy_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medicine_order_id UUID NOT NULL REFERENCES medicine_orders(id) ON DELETE CASCADE,
    pharmacy_vendor_id UUID NOT NULL REFERENCES vendors(id),
    pharmacy_name TEXT NOT NULL,
    
    -- Quote details
    quote_items JSONB NOT NULL, -- Array of { medicineId, medicineName, quantity, unitPrice, totalPrice }
    subtotal DECIMAL(10, 2) NOT NULL,
    delivery_charge DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(10, 2) NOT NULL,
    
    -- Availability
    estimated_delivery_date DATE,
    estimated_delivery_time TEXT,
    availability_status TEXT NOT NULL DEFAULT 'available' CHECK (availability_status IN ('available', 'partial', 'unavailable')),
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
    
    -- Timestamps
    quoted_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pharmacy_quotes_order_id ON pharmacy_quotes(medicine_order_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_quotes_pharmacy_id ON pharmacy_quotes(pharmacy_vendor_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_quotes_status ON pharmacy_quotes(status);

-- ============================================
-- DIAGNOSTIC BOOKINGS TABLE
-- ============================================
-- Diagnostic test bookings with state transitions
CREATE TABLE IF NOT EXISTS diagnostic_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    center_id TEXT, -- Diagnostic center ID
    
    -- Booking details
    booking_number TEXT NOT NULL UNIQUE,
    tests JSONB NOT NULL, -- Array of { testId, testName, price }
    booking_type TEXT NOT NULL CHECK (booking_type IN ('home_collection', 'center_visit')),
    
    -- Scheduling
    scheduled_date DATE NOT NULL,
    scheduled_time TEXT NOT NULL,
    
    -- Address (for home collection)
    collection_address JSONB,
    
    -- Prescription
    prescription_id UUID REFERENCES prescriptions(id),
    prescription_url TEXT,
    special_instructions TEXT,
    
    -- State transitions
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
        'scheduled',
        'sample_collected',
        'sample_received_at_lab',
        'processing',
        'reports_ready',
        'completed',
        'cancelled'
    )),
    status_changed_at TIMESTAMPTZ DEFAULT NOW(),
    status_changed_by UUID,
    status_change_reason TEXT,
    
    -- Sample collection
    collector_id UUID REFERENCES staff(id),
    collector_name TEXT,
    sample_collection_time TIMESTAMPTZ,
    
    -- Reports
    reports JSONB, -- Array of { testId, testName, reportUrl, uploadedAt }
    report_generation_time TIMESTAMPTZ,
    all_reports_uploaded BOOLEAN DEFAULT false,
    
    -- Pricing
    total_amount DECIMAL(10, 2) NOT NULL,
    home_collection_charge DECIMAL(10, 2) DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_diagnostic_bookings_customer_id ON diagnostic_bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_bookings_pet_id ON diagnostic_bookings(pet_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_bookings_vendor_id ON diagnostic_bookings(vendor_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_bookings_status ON diagnostic_bookings(status);
CREATE INDEX IF NOT EXISTS idx_diagnostic_bookings_booking_number ON diagnostic_bookings(booking_number);

-- State transition validation
CREATE OR REPLACE FUNCTION validate_diagnostic_booking_transition()
RETURNS TRIGGER AS $$
BEGIN
    -- Define valid state transitions
    IF OLD.status = 'scheduled' AND NEW.status NOT IN ('sample_collected', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid state transition from scheduled';
    END IF;
    
    IF OLD.status = 'sample_collected' AND NEW.status NOT IN ('sample_received_at_lab', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid state transition from sample_collected';
    END IF;
    
    IF OLD.status = 'sample_received_at_lab' AND NEW.status NOT IN ('processing', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid state transition from sample_received_at_lab';
    END IF;
    
    IF OLD.status = 'processing' AND NEW.status NOT IN ('reports_ready', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid state transition from processing';
    END IF;
    
    IF OLD.status = 'reports_ready' AND NEW.status NOT IN ('completed', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid state transition from reports_ready';
    END IF;
    
    -- Update status change timestamp
    NEW.status_changed_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_diagnostic_booking_transition
    BEFORE UPDATE ON diagnostic_bookings
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION validate_diagnostic_booking_transition();

-- ============================================
-- REPORTS TABLE
-- ============================================
-- Diagnostic reports with access control
CREATE TABLE IF NOT EXISTS diagnostic_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diagnostic_booking_id UUID NOT NULL REFERENCES diagnostic_bookings(id) ON DELETE CASCADE,
    test_id TEXT NOT NULL,
    test_name TEXT NOT NULL,
    
    -- Report details
    report_url TEXT NOT NULL,
    report_type TEXT CHECK (report_type IN ('pdf', 'image', 'document')),
    file_size BIGINT,
    
    -- Versioning
    version INTEGER DEFAULT 1,
    previous_version_id UUID REFERENCES diagnostic_reports(id),
    is_latest BOOLEAN DEFAULT true,
    
    -- Access control
    uploaded_by UUID NOT NULL REFERENCES staff(id),
    uploaded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_diagnostic_reports_booking_id ON diagnostic_reports(diagnostic_booking_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_reports_test_id ON diagnostic_reports(test_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_reports_uploaded_at ON diagnostic_reports(uploaded_at DESC);

-- ============================================
-- AUDIT TRAIL TABLE
-- ============================================
-- Comprehensive audit trail for all regulated operations
CREATE TABLE IF NOT EXISTS audit_trail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Entity information
    entity_type TEXT NOT NULL, -- 'medical_record', 'prescription', 'medicine_order', 'diagnostic_booking', 'report'
    entity_id UUID NOT NULL,
    
    -- Action information
    action TEXT NOT NULL, -- 'create', 'read', 'update', 'delete', 'status_change', 'access'
    action_details JSONB, -- Additional action details
    
    -- User information
    user_id UUID,
    user_type TEXT, -- 'customer', 'vendor', 'staff', 'admin'
    user_name TEXT,
    
    -- Changes (for updates)
    old_values JSONB,
    new_values JSONB,
    
    -- IP and device (for security)
    ip_address TEXT,
    user_agent TEXT,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_trail_entity ON audit_trail(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_user ON audit_trail(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_action ON audit_trail(action);
CREATE INDEX IF NOT EXISTS idx_audit_trail_created_at ON audit_trail(created_at DESC);

-- ============================================
-- ROLE PERMISSIONS FOR REGULATED FLOWS
-- ============================================
-- Add permissions to roles table (if not exists)
-- These will be managed via RBAC system

-- Common permissions for regulated flows:
-- medical_records:read, medical_records:create, medical_records:update
-- prescriptions:create, prescriptions:read, prescriptions:finalize
-- medicine_orders:create, medicine_orders:verify, medicine_orders:update_status
-- diagnostics:create_booking, diagnostics:update_status, diagnostics:upload_report, diagnostics:download_report

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE medical_records IS 'Immutable medical records (NO KV STORE)';
COMMENT ON TABLE prescriptions IS 'Prescriptions with immutability after finalization (NO KV STORE)';
COMMENT ON TABLE medicine_orders IS 'Medicine order flow with state transitions (NO KV STORE)';
COMMENT ON TABLE pharmacy_quotes IS 'Pharmacy quotes for medicine orders (NO KV STORE)';
COMMENT ON TABLE diagnostic_bookings IS 'Diagnostic bookings with state transitions (NO KV STORE)';
COMMENT ON TABLE diagnostic_reports IS 'Diagnostic reports with access control (NO KV STORE)';
COMMENT ON TABLE audit_trail IS 'Comprehensive audit trail for all regulated operations (NO KV STORE)';

