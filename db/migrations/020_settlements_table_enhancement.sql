-- ============================================================================
-- MIGRATION 020: Settlements Table Enhancement
-- ============================================================================
-- Date: 2024-12-23
-- Purpose: Add missing columns to settlements table for marketplace settlements
-- Migration: Phase 1, Task 1.4 - KV to SQL
-- ============================================================================

-- Add missing columns to settlements table
DO $$ BEGIN
    -- Add booking_id for individual booking settlements
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='settlements' AND column_name='booking_id') THEN
        ALTER TABLE settlements ADD COLUMN booking_id UUID REFERENCES bookings(id);
    END IF;
    
    -- Add payment_id for individual payment settlements (if not using payment_ids array)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='settlements' AND column_name='payment_id') THEN
        ALTER TABLE settlements ADD COLUMN payment_id UUID REFERENCES payments(id);
    END IF;
    
    -- Add settlement_date for individual settlements (alternative to period)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='settlements' AND column_name='settlement_date') THEN
        ALTER TABLE settlements ADD COLUMN settlement_date DATE;
    END IF;
    
    -- Add razorpay_settlement_id for Razorpay integration
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='settlements' AND column_name='razorpay_settlement_id') THEN
        ALTER TABLE settlements ADD COLUMN razorpay_settlement_id TEXT;
    END IF;
    
    -- Add currency field
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='settlements' AND column_name='currency') THEN
        ALTER TABLE settlements ADD COLUMN currency TEXT DEFAULT 'INR';
    END IF;
    
    -- Add failure_reason for failed settlements
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='settlements' AND column_name='failure_reason') THEN
        ALTER TABLE settlements ADD COLUMN failure_reason TEXT;
    END IF;
    
    -- Make settlement_period_start and settlement_period_end nullable for individual settlements
    -- (They're already nullable in some cases, but ensure they can be null)
    
    COMMENT ON COLUMN settlements.booking_id IS 'Individual booking settlement (optional)';
    COMMENT ON COLUMN settlements.payment_id IS 'Individual payment settlement (optional)';
    COMMENT ON COLUMN settlements.settlement_date IS 'Settlement date for individual settlements';
    COMMENT ON COLUMN settlements.razorpay_settlement_id IS 'Razorpay settlement ID';
    COMMENT ON COLUMN settlements.currency IS 'Currency code (default: INR)';
    COMMENT ON COLUMN settlements.failure_reason IS 'Reason for failed settlement';
END $$;

-- Add alias columns for compatibility (settlement_amount = total_amount, vendor_amount = net_amount)
-- These will be handled in the repository mapping

CREATE INDEX IF NOT EXISTS idx_settlements_booking_id ON settlements(booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_settlements_payment_id ON settlements(payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_settlements_vendor_status ON settlements(vendor_id, settlement_status);

