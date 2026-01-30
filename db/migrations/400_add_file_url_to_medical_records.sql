-- ============================================================================
-- MIGRATION 400: Add file_url column to medical_records table
-- ============================================================================
-- Date: 2026-01-23
-- Purpose: Add file_url column to medical_records if it doesn't exist
--          This fixes the error: column "file_url" of relation "medical_records" does not exist
-- ============================================================================

-- Add file_url column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'medical_records' 
        AND column_name = 'file_url'
    ) THEN
        ALTER TABLE medical_records ADD COLUMN file_url TEXT;
        COMMENT ON COLUMN medical_records.file_url IS 'URL to the medical record file (prescription, diagnostic report, etc.)';
        RAISE NOTICE 'Added file_url column to medical_records table';
    ELSE
        RAISE NOTICE 'file_url column already exists in medical_records table';
    END IF;
END $$;

-- Also ensure other columns from migration 100 exist
DO $$
BEGIN
    -- Add customer_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'medical_records' 
        AND column_name = 'customer_id'
    ) THEN
        ALTER TABLE medical_records ADD COLUMN customer_id UUID REFERENCES customers(id);
        RAISE NOTICE 'Added customer_id column to medical_records table';
    END IF;

    -- Add content_data if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'medical_records' 
        AND column_name = 'content_data'
    ) THEN
        ALTER TABLE medical_records ADD COLUMN content_data JSONB;
        RAISE NOTICE 'Added content_data column to medical_records table';
    END IF;

    -- Add prescribed_by if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'medical_records' 
        AND column_name = 'prescribed_by'
    ) THEN
        ALTER TABLE medical_records ADD COLUMN prescribed_by UUID;
        RAISE NOTICE 'Added prescribed_by column to medical_records table';
    END IF;

    -- Add prescribed_by_name if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'medical_records' 
        AND column_name = 'prescribed_by_name'
    ) THEN
        ALTER TABLE medical_records ADD COLUMN prescribed_by_name VARCHAR(200);
        RAISE NOTICE 'Added prescribed_by_name column to medical_records table';
    END IF;

    -- Add referred_from_booking_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'medical_records' 
        AND column_name = 'referred_from_booking_id'
    ) THEN
        ALTER TABLE medical_records ADD COLUMN referred_from_booking_id UUID REFERENCES bookings(id);
        RAISE NOTICE 'Added referred_from_booking_id column to medical_records table';
    END IF;

    -- Add record_date if it doesn't exist (for handwritten prescriptions)
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'medical_records' 
        AND column_name = 'record_date'
    ) THEN
        ALTER TABLE medical_records ADD COLUMN record_date TIMESTAMPTZ;
        RAISE NOTICE 'Added record_date column to medical_records table';
    END IF;
END $$;
