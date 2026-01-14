-- ============================================================================
-- MIGRATION 063: Event Approval Workflow and Booking Verification
-- ============================================================================
-- Date: 2025-01-13
-- Purpose: Add approval workflow for vendor events and booking verification
-- ============================================================================

-- Add approval workflow columns to events table
DO $$ BEGIN
    -- Approval status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='approval_status') THEN
        ALTER TABLE events ADD COLUMN approval_status TEXT DEFAULT 'pending' 
            CHECK (approval_status IN ('pending', 'approved', 'rejected'));
    END IF;
    
    -- Created by (admin or vendor)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='created_by') THEN
        ALTER TABLE events ADD COLUMN created_by TEXT DEFAULT 'vendor' 
            CHECK (created_by IN ('admin', 'vendor'));
    END IF;
    
    -- Admin who approved/rejected
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='reviewed_by') THEN
        ALTER TABLE events ADD COLUMN reviewed_by UUID REFERENCES admins(id);
    END IF;
    
    -- Review timestamp
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='reviewed_at') THEN
        ALTER TABLE events ADD COLUMN reviewed_at TIMESTAMPTZ;
    END IF;
    
    -- Rejection reason
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='rejection_reason') THEN
        ALTER TABLE events ADD COLUMN rejection_reason TEXT;
    END IF;
    
    -- Update status constraint to include 'pending_approval'
    -- Note: We'll keep existing status values and use approval_status separately
    -- This allows draft events to be pending approval
    
    COMMENT ON COLUMN events.approval_status IS 'Approval status: pending, approved, rejected';
    COMMENT ON COLUMN events.created_by IS 'Who created the event: admin or vendor';
    COMMENT ON COLUMN events.reviewed_by IS 'Admin who reviewed the event';
    COMMENT ON COLUMN events.reviewed_at IS 'When the event was reviewed';
    COMMENT ON COLUMN events.rejection_reason IS 'Reason for rejection if rejected';
END $$;

-- Add booking verification columns to event_registrations table
DO $$ BEGIN
    -- Booking reference number (human-readable)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='event_registrations' AND column_name='booking_reference') THEN
        ALTER TABLE event_registrations ADD COLUMN booking_reference TEXT UNIQUE;
    END IF;
    
    -- QR code data (JSON stringified)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='event_registrations' AND column_name='qr_code') THEN
        ALTER TABLE event_registrations ADD COLUMN qr_code TEXT;
    END IF;
    
    -- Check-in verified by (vendor/admin ID)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='event_registrations' AND column_name='checked_in_by') THEN
        ALTER TABLE event_registrations ADD COLUMN checked_in_by UUID;
    END IF;
    
    COMMENT ON COLUMN event_registrations.booking_reference IS 'Human-readable booking reference (e.g., EVT-20250113-847293)';
    COMMENT ON COLUMN event_registrations.qr_code IS 'QR code data (JSON stringified)';
    COMMENT ON COLUMN event_registrations.checked_in_by IS 'Vendor/Admin who checked in the customer';
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_approval_status ON events(approval_status) WHERE approval_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);
CREATE INDEX IF NOT EXISTS idx_event_registrations_booking_reference ON event_registrations(booking_reference) WHERE booking_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_registrations_check_in_status ON event_registrations(check_in_status);

-- Update existing events: Admin-created events are auto-approved
UPDATE events 
SET approval_status = 'approved', created_by = 'admin' 
WHERE approval_status IS NULL OR approval_status = 'pending';

-- Function to generate booking reference
CREATE OR REPLACE FUNCTION generate_booking_reference()
RETURNS TEXT AS $$
DECLARE
    ref TEXT;
    exists_check INTEGER;
BEGIN
    LOOP
        -- Format: EVT-YYYYMMDD-XXXXXX (6 random digits)
        ref := 'EVT-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || 
               LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
        
        -- Check if reference already exists
        SELECT COUNT(*) INTO exists_check 
        FROM event_registrations 
        WHERE booking_reference = ref;
        
        -- Exit loop if unique
        EXIT WHEN exists_check = 0;
    END LOOP;
    
    RETURN ref;
END;
$$ LANGUAGE plpgsql;
