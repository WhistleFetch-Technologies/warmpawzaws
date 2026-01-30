-- Migration: Add platform_fee and convenience_fee columns to payments table
-- Date: 2026-01-27
-- Description: Adds columns to store platform and convenience fees for each payment

-- Add platform_fee column to payments table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' AND column_name = 'platform_fee'
    ) THEN
        ALTER TABLE payments ADD COLUMN platform_fee NUMERIC(10, 2) DEFAULT 0;
        COMMENT ON COLUMN payments.platform_fee IS 'Platform service fee charged on transaction';
        RAISE NOTICE 'Added platform_fee column to payments table';
    ELSE
        RAISE NOTICE 'platform_fee column already exists in payments table';
    END IF;
END $$;

-- Add convenience_fee column to payments table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' AND column_name = 'convenience_fee'
    ) THEN
        ALTER TABLE payments ADD COLUMN convenience_fee NUMERIC(10, 2) DEFAULT 0;
        COMMENT ON COLUMN payments.convenience_fee IS 'Convenience fee for online booking';
        RAISE NOTICE 'Added convenience_fee column to payments table';
    ELSE
        RAISE NOTICE 'convenience_fee column already exists in payments table';
    END IF;
END $$;

-- Add delivery_fee column to payments table (for at_home services and orders)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' AND column_name = 'delivery_fee'
    ) THEN
        ALTER TABLE payments ADD COLUMN delivery_fee NUMERIC(10, 2) DEFAULT 0;
        COMMENT ON COLUMN payments.delivery_fee IS 'Delivery fee for at-home services or orders';
        RAISE NOTICE 'Added delivery_fee column to payments table';
    ELSE
        RAISE NOTICE 'delivery_fee column already exists in payments table';
    END IF;
END $$;

-- Add packaging_fee column to payments table (for orders)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' AND column_name = 'packaging_fee'
    ) THEN
        ALTER TABLE payments ADD COLUMN packaging_fee NUMERIC(10, 2) DEFAULT 0;
        COMMENT ON COLUMN payments.packaging_fee IS 'Packaging fee for product orders';
        RAISE NOTICE 'Added packaging_fee column to payments table';
    ELSE
        RAISE NOTICE 'packaging_fee column already exists in payments table';
    END IF;
END $$;

-- Add fee_breakdown column to store detailed fee breakdown as JSONB
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' AND column_name = 'fee_breakdown'
    ) THEN
        ALTER TABLE payments ADD COLUMN fee_breakdown JSONB;
        COMMENT ON COLUMN payments.fee_breakdown IS 'Detailed fee breakdown including percentage, caps, etc.';
        RAISE NOTICE 'Added fee_breakdown column to payments table';
    ELSE
        RAISE NOTICE 'fee_breakdown column already exists in payments table';
    END IF;
END $$;

-- Create index for fee analysis queries
CREATE INDEX IF NOT EXISTS idx_payments_fees 
ON payments (platform_fee, convenience_fee) 
WHERE platform_fee > 0 OR convenience_fee > 0;

-- Verification query (run manually to confirm)
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'payments' 
-- AND column_name IN ('platform_fee', 'convenience_fee', 'delivery_fee', 'packaging_fee', 'fee_breakdown', 'total_amount');
