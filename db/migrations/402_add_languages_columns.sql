-- ============================================================================
-- MIGRATION 402: Add Languages Column to Vendors and Staff Tables
-- ============================================================================
-- Date: 2026-01-26
-- Purpose: Add languages field to capture vendor and staff language proficiency
--          for display in service discovery and booking flows
-- ============================================================================

-- Add languages column to vendors table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vendors' AND column_name = 'languages'
    ) THEN
        ALTER TABLE vendors ADD COLUMN languages JSONB DEFAULT '["English", "Hindi"]'::jsonb;
        COMMENT ON COLUMN vendors.languages IS 'Array of languages the vendor can communicate in. Example: ["English", "Hindi", "Kannada"]';
    END IF;
END $$;

-- Add languages column to staff table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'staff' AND column_name = 'languages'
    ) THEN
        ALTER TABLE staff ADD COLUMN languages JSONB DEFAULT '["English", "Hindi"]'::jsonb;
        COMMENT ON COLUMN staff.languages IS 'Array of languages the staff member can communicate in. Example: ["English", "Hindi", "Tamil"]';
    END IF;
END $$;

-- Add is_verified column to vendors if not exists (for verified badge in listings)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vendors' AND column_name = 'is_verified'
    ) THEN
        ALTER TABLE vendors ADD COLUMN is_verified BOOLEAN DEFAULT false;
        COMMENT ON COLUMN vendors.is_verified IS 'Whether the vendor has been verified (for displaying verified badge)';
    END IF;
END $$;

-- Add is_verified column to staff if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'staff' AND column_name = 'is_verified'
    ) THEN
        ALTER TABLE staff ADD COLUMN is_verified BOOLEAN DEFAULT false;
        COMMENT ON COLUMN staff.is_verified IS 'Whether the staff member has been verified';
    END IF;
END $$;

-- Add profile_image column to vendors if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vendors' AND column_name = 'profile_image'
    ) THEN
        ALTER TABLE vendors ADD COLUMN profile_image TEXT;
        COMMENT ON COLUMN vendors.profile_image IS 'URL to vendor profile image/logo';
    END IF;
END $$;

-- Add completed_bookings_count column to vendors for performance caching
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vendors' AND column_name = 'completed_bookings_count'
    ) THEN
        ALTER TABLE vendors ADD COLUMN completed_bookings_count INTEGER DEFAULT 0;
        COMMENT ON COLUMN vendors.completed_bookings_count IS 'Cached count of completed bookings for performance';
    END IF;
END $$;

-- Add completed_bookings_count column to staff for performance caching
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'staff' AND column_name = 'completed_bookings_count'
    ) THEN
        ALTER TABLE staff ADD COLUMN completed_bookings_count INTEGER DEFAULT 0;
        COMMENT ON COLUMN staff.completed_bookings_count IS 'Cached count of completed bookings for performance';
    END IF;
END $$;

-- Add specializations JSONB column to vendors (for faster access without joining)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vendors' AND column_name = 'specializations'
    ) THEN
        ALTER TABLE vendors ADD COLUMN specializations JSONB DEFAULT '[]'::jsonb;
        COMMENT ON COLUMN vendors.specializations IS 'Array of specialization strings for the vendor';
    END IF;
END $$;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_vendors_languages ON vendors USING GIN (languages);
CREATE INDEX IF NOT EXISTS idx_staff_languages ON staff USING GIN (languages);
CREATE INDEX IF NOT EXISTS idx_vendors_is_verified ON vendors (is_verified) WHERE is_verified = true;
CREATE INDEX IF NOT EXISTS idx_staff_is_verified ON staff (is_verified) WHERE is_verified = true;
CREATE INDEX IF NOT EXISTS idx_vendors_specializations ON vendors USING GIN (specializations);

-- ============================================================================
-- END OF MIGRATION 402
-- ============================================================================
