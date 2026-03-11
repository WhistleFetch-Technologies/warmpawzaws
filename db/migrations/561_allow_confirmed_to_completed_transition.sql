-- ============================================================================
-- Migration 561: Allow confirmed -> completed booking state transition
-- ============================================================================
-- PROD FIX: Allow vendors to complete bookings directly from 'confirmed' status
-- This is needed for services that don't require an 'in_progress' state
-- ============================================================================

DO $$
BEGIN
  -- Check which schema version we're using and insert accordingly
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'booking_state_transitions' 
    AND column_name = 'is_allowed'
  ) THEN
    -- Newer schema with is_allowed column
    INSERT INTO booking_state_transitions (from_status, to_status, requires_payment, description, is_allowed)
    VALUES ('confirmed', 'completed', false, 'Vendor completes booking directly from confirmed state', true)
    ON CONFLICT (from_status, to_status) 
    DO UPDATE SET 
      is_allowed = true,
      description = 'Vendor completes booking directly from confirmed state',
      requires_payment = false;
    
    RAISE NOTICE 'Added confirmed -> completed transition (newer schema)';
    
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'booking_state_transitions' 
    AND column_name = 'allowed'
  ) THEN
    -- Older schema with allowed column
    INSERT INTO booking_state_transitions (from_status, to_status, allowed, requires_otp, requires_payment)
    VALUES ('confirmed', 'completed', true, false, false)
    ON CONFLICT (from_status, to_status) 
    DO UPDATE SET 
      allowed = true,
      requires_otp = false,
      requires_payment = false;
    
    RAISE NOTICE 'Added confirmed -> completed transition (older schema)';
  ELSE
    -- Fallback: try to insert with minimal columns
    INSERT INTO booking_state_transitions (from_status, to_status)
    VALUES ('confirmed', 'completed')
    ON CONFLICT (from_status, to_status) DO NOTHING;
    
    RAISE NOTICE 'Added confirmed -> completed transition (fallback)';
  END IF;
END $$;

-- Update table comment
COMMENT ON TABLE booking_state_transitions IS 'Defines allowed state transitions for bookings - updated to allow confirmed -> completed';
