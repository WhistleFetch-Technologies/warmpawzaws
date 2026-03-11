-- ============================================================================
-- MIGRATION 015: Sample Collection Assignments Table
-- ============================================================================
-- Date: 2025-01-27
-- Purpose: Create sample_collection_assignments table for home diagnostic sample collection
-- ============================================================================

CREATE TABLE IF NOT EXISTS sample_collection_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id TEXT NOT NULL UNIQUE, -- Human-readable assignment ID
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    diagnostic_booking_id UUID REFERENCES diagnostic_bookings(id),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    
    -- Customer information (snapshot at assignment time)
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_address JSONB NOT NULL, -- { street, city, state, pincode, lat, lng }
    
    -- Pet information
    pet_id UUID REFERENCES pets(id),
    pet_name TEXT,
    
    -- Diagnostic tests
    diagnostic_tests JSONB DEFAULT '[]'::JSONB,
    
    -- Scheduling
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    scheduled_datetime TIMESTAMPTZ NOT NULL,
    estimated_duration INTEGER DEFAULT 30, -- minutes
    
    -- Status
    status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN (
        'assigned',
        'in_transit',
        'arrived',
        'collecting',
        'collected',
        'returning',
        'completed',
        'cancelled'
    )),
    
    -- OTP for sample collection
    collection_otp TEXT,
    otp_verified BOOLEAN DEFAULT false,
    
    -- Tracking
    departure_time TIMESTAMPTZ,
    arrival_time TIMESTAMPTZ,
    collection_start_time TIMESTAMPTZ,
    collection_completed_time TIMESTAMPTZ,
    return_time TIMESTAMPTZ,
    completion_time TIMESTAMPTZ,
    
    -- Location tracking
    current_location JSONB, -- { lat, lng }
    route JSONB DEFAULT '[]'::JSONB, -- Array of { lat, lng, timestamp }
    
    -- Notes
    notes TEXT,
    cancellation_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sample_collection_assignments_booking ON sample_collection_assignments(booking_id);
CREATE INDEX idx_sample_collection_assignments_diagnostic ON sample_collection_assignments(diagnostic_booking_id);
CREATE INDEX idx_sample_collection_assignments_vendor ON sample_collection_assignments(vendor_id);
CREATE INDEX idx_sample_collection_assignments_staff ON sample_collection_assignments(staff_id);
CREATE INDEX idx_sample_collection_assignments_customer ON sample_collection_assignments(customer_id);
CREATE INDEX idx_sample_collection_assignments_status ON sample_collection_assignments(status);
CREATE INDEX idx_sample_collection_assignments_assignment_id ON sample_collection_assignments(assignment_id);
CREATE INDEX idx_sample_collection_assignments_scheduled ON sample_collection_assignments(scheduled_date, scheduled_time);

COMMENT ON TABLE sample_collection_assignments IS 'Stores staff assignments for home diagnostic sample collection, replacing KV store usage';
COMMENT ON COLUMN sample_collection_assignments.assignment_id IS 'Human-readable assignment ID (e.g., SAMPLE-COLLECT-1234567890-ABC123)';

