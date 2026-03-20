-- ============================================================================
-- MIGRATION 411: Add Pharmacy Broadcast Expansion Columns
-- ============================================================================
-- Date: 2026-01-27
-- Purpose: Add columns to support server-side automated broadcast radius expansion
-- Phase: Pharmacy Order Broadcast Enhancement
-- ============================================================================

-- Add expansion tracking columns to pharmacy_orders table
ALTER TABLE pharmacy_orders
ADD COLUMN IF NOT EXISTS last_expanded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS expansion_count INTEGER DEFAULT 0;

-- Add comments
COMMENT ON COLUMN pharmacy_orders.last_expanded_at IS 'Timestamp of last radius expansion. Used by scheduled job to determine when next expansion is due.';
COMMENT ON COLUMN pharmacy_orders.expansion_count IS 'Number of times the broadcast radius has been expanded (0=5km, 1=10km, 2=20km).';

-- Add index for efficient querying of orders needing expansion
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_broadcast_expansion 
ON pharmacy_orders(status, current_broadcast_radius_km, last_expanded_at)
WHERE status = 'broadcasting' AND current_broadcast_radius_km < 20;

-- Add index for scheduled job query performance
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_pending_expansion
ON pharmacy_orders(broadcast_started_at, last_expanded_at)
WHERE status = 'broadcasting';

-- Also add to pharmacy_broadcasts table if it exists
DO $$
BEGIN
    -- Check if pharmacy_broadcasts table exists and add columns
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pharmacy_broadcasts') THEN
        -- Add columns if they don't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'pharmacy_broadcasts' AND column_name = 'last_expanded_at') THEN
            ALTER TABLE pharmacy_broadcasts ADD COLUMN last_expanded_at TIMESTAMPTZ;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'pharmacy_broadcasts' AND column_name = 'expansion_count') THEN
            ALTER TABLE pharmacy_broadcasts ADD COLUMN expansion_count INTEGER DEFAULT 0;
        END IF;
    END IF;
END $$;

-- Verify columns added successfully
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pharmacy_orders' AND column_name = 'last_expanded_at'
    ) THEN
        RAISE EXCEPTION 'last_expanded_at column not added to pharmacy_orders';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pharmacy_orders' AND column_name = 'expansion_count'
    ) THEN
        RAISE EXCEPTION 'expansion_count column not added to pharmacy_orders';
    END IF;
    
    RAISE NOTICE 'Migration 411 completed successfully: pharmacy broadcast expansion columns added';
END $$;
