-- ============================================================================
-- MIGRATION: Advanced Availability System
-- Version: 500
-- Description: Adds support for multi-slot, multi-style availability with 
--              breaks, holidays, vacation, and online status for vendors
-- 
-- Changes:
-- 1. Add service_styles array to vendor_availability_v2
-- 2. Add location_data JSONB per slot for solo providers
-- 3. Create vendor_breaks table for lunch/tea/custom breaks
-- 4. Create vendor_holidays_enhanced table for holidays and vacation
-- 5. Add is_online and went_offline_at to vendors for solo offline toggle
-- ============================================================================

-- ============================================================================
-- 1. Enhance vendor_availability_v2 with service_styles array
-- ============================================================================

-- Add service_styles array column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendor_availability_v2' AND column_name = 'service_styles'
  ) THEN
    ALTER TABLE vendor_availability_v2 
    ADD COLUMN service_styles TEXT[] DEFAULT '{}';
    
    COMMENT ON COLUMN vendor_availability_v2.service_styles IS 
      'Array of service styles this slot supports: at_center, at_home, tele';
  END IF;
END $$;

-- Add location_data JSONB for solo providers (per-slot location)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendor_availability_v2' AND column_name = 'location_data'
  ) THEN
    ALTER TABLE vendor_availability_v2 
    ADD COLUMN location_data JSONB;
    
    COMMENT ON COLUMN vendor_availability_v2.location_data IS 
      'Location data for solo providers: {address, lat, lng, place_id, formatted_address}';
  END IF;
END $$;

-- Add buffer_time column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendor_availability_v2' AND column_name = 'buffer_time'
  ) THEN
    ALTER TABLE vendor_availability_v2 
    ADD COLUMN buffer_time INTEGER DEFAULT 15;
    
    COMMENT ON COLUMN vendor_availability_v2.buffer_time IS 
      'Buffer time between appointments in minutes';
  END IF;
END $$;

-- Add max_capacity column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendor_availability_v2' AND column_name = 'max_capacity'
  ) THEN
    ALTER TABLE vendor_availability_v2 
    ADD COLUMN max_capacity INTEGER DEFAULT 1;
    
    COMMENT ON COLUMN vendor_availability_v2.max_capacity IS 
      'Maximum number of bookings that can be scheduled in this slot';
  END IF;
END $$;

-- ============================================================================
-- 2. Create vendor_breaks table
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_breaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    slot_id UUID REFERENCES vendor_availability_v2(id) ON DELETE SET NULL,
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
    break_date DATE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_type VARCHAR(50) DEFAULT 'custom',
    reason TEXT,
    is_recurring BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_break_time CHECK (start_time < end_time),
    CONSTRAINT break_type_check CHECK (break_type IN ('lunch', 'tea', 'custom', 'personal'))
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_vendor_breaks_vendor_id ON vendor_breaks(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_breaks_day_of_week ON vendor_breaks(day_of_week) WHERE is_recurring = true;
CREATE INDEX IF NOT EXISTS idx_vendor_breaks_date ON vendor_breaks(break_date) WHERE break_date IS NOT NULL;

COMMENT ON TABLE vendor_breaks IS 'Vendor break times (lunch, tea, custom) for scheduling';

-- ============================================================================
-- 3. Create vendor_holidays_enhanced table
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_holidays_enhanced (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    holiday_type VARCHAR(50) DEFAULT 'holiday',
    reason TEXT,
    is_recurring_yearly BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_holiday_dates CHECK (start_date <= end_date),
    CONSTRAINT holiday_type_check CHECK (holiday_type IN ('holiday', 'vacation', 'closed', 'personal', 'sick'))
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_vendor_holidays_vendor_id ON vendor_holidays_enhanced(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_holidays_dates ON vendor_holidays_enhanced(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_vendor_holidays_recurring ON vendor_holidays_enhanced(is_recurring_yearly) WHERE is_recurring_yearly = true;

COMMENT ON TABLE vendor_holidays_enhanced IS 'Vendor holidays and vacation periods for scheduling';

-- ============================================================================
-- 4. Add is_online and went_offline_at to vendors for solo offline toggle
-- ============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'is_online'
  ) THEN
    ALTER TABLE vendors 
    ADD COLUMN is_online BOOLEAN DEFAULT true;
    
    COMMENT ON COLUMN vendors.is_online IS 
      'Whether the vendor is currently online and accepting bookings (for solo providers)';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'went_offline_at'
  ) THEN
    ALTER TABLE vendors 
    ADD COLUMN went_offline_at TIMESTAMPTZ;
    
    COMMENT ON COLUMN vendors.went_offline_at IS 
      'Timestamp when vendor went offline (for tracking)';
  END IF;
END $$;

-- Add vendor_type column if not exists (solo, business, center)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'vendor_type'
  ) THEN
    ALTER TABLE vendors 
    ADD COLUMN vendor_type VARCHAR(20) DEFAULT 'business';
    
    COMMENT ON COLUMN vendors.vendor_type IS 
      'Type of vendor: solo (individual provider), business (clinic/salon), center (multi-service)';
  END IF;
END $$;

-- ============================================================================
-- 5. Add indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_vendors_is_online ON vendors(is_online) WHERE is_online = true;
CREATE INDEX IF NOT EXISTS idx_vendors_vendor_type ON vendors(vendor_type);
CREATE INDEX IF NOT EXISTS idx_vendor_availability_service_styles ON vendor_availability_v2 USING GIN(service_styles);

-- ============================================================================
-- 6. Migrate existing data - populate service_styles from service_style
-- ============================================================================

-- Populate service_styles array from existing service_style column
UPDATE vendor_availability_v2
SET service_styles = ARRAY[service_style]
WHERE service_styles = '{}' 
  AND service_style IS NOT NULL
  AND service_style != '';

-- ============================================================================
-- 7. Create helper functions for availability checking
-- ============================================================================

-- Function to check if a vendor has a break at a specific time
CREATE OR REPLACE FUNCTION check_vendor_break(
    p_vendor_id UUID,
    p_date DATE,
    p_time TIME
) RETURNS BOOLEAN AS $$
DECLARE
    has_break BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM vendor_breaks
        WHERE vendor_id = p_vendor_id
          AND is_active = true
          AND (
            -- Recurring break on this day of week
            (is_recurring = true AND day_of_week = EXTRACT(DOW FROM p_date))
            OR
            -- Specific date break
            (break_date = p_date)
          )
          AND p_time >= start_time
          AND p_time < end_time
    ) INTO has_break;
    
    RETURN has_break;
END;
$$ LANGUAGE plpgsql;

-- Function to check if a vendor is on holiday
CREATE OR REPLACE FUNCTION check_vendor_holiday(
    p_vendor_id UUID,
    p_date DATE
) RETURNS BOOLEAN AS $$
DECLARE
    on_holiday BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM vendor_holidays_enhanced
        WHERE vendor_id = p_vendor_id
          AND is_active = true
          AND (
            -- Check if date falls within holiday range
            (p_date >= start_date AND p_date <= end_date)
            OR
            -- Check recurring yearly holidays (compare month and day)
            (is_recurring_yearly = true 
             AND EXTRACT(MONTH FROM p_date) = EXTRACT(MONTH FROM start_date)
             AND EXTRACT(DAY FROM p_date) >= EXTRACT(DAY FROM start_date)
             AND EXTRACT(DAY FROM p_date) <= EXTRACT(DAY FROM end_date))
          )
    ) INTO on_holiday;
    
    RETURN on_holiday;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. Create view for vendor availability with breaks and holidays
-- ============================================================================

CREATE OR REPLACE VIEW vendor_availability_full AS
SELECT 
    va.id,
    va.vendor_id,
    va.day_of_week,
    va.time_window_start,
    va.time_window_end,
    va.service_styles,
    va.service_style,
    va.location_data,
    va.buffer_time,
    va.max_capacity,
    va.is_enabled,
    v.is_online,
    v.vendor_type,
    v.business_name
FROM vendor_availability_v2 va
JOIN vendors v ON va.vendor_id = v.id
WHERE va.is_enabled = true
  AND v.status = 'approved'
  AND v.is_active = true
  AND COALESCE(v.is_online, true) = true;

COMMENT ON VIEW vendor_availability_full IS 
  'Combined view of vendor availability with online status';

-- ============================================================================
-- ROLLBACK SCRIPT (for reference)
-- ============================================================================
-- DROP VIEW IF EXISTS vendor_availability_full;
-- DROP FUNCTION IF EXISTS check_vendor_holiday(UUID, DATE);
-- DROP FUNCTION IF EXISTS check_vendor_break(UUID, DATE, TIME);
-- DROP TABLE IF EXISTS vendor_holidays_enhanced;
-- DROP TABLE IF EXISTS vendor_breaks;
-- ALTER TABLE vendor_availability_v2 DROP COLUMN IF EXISTS service_styles;
-- ALTER TABLE vendor_availability_v2 DROP COLUMN IF EXISTS location_data;
-- ALTER TABLE vendor_availability_v2 DROP COLUMN IF EXISTS buffer_time;
-- ALTER TABLE vendor_availability_v2 DROP COLUMN IF EXISTS max_capacity;
-- ALTER TABLE vendors DROP COLUMN IF EXISTS is_online;
-- ALTER TABLE vendors DROP COLUMN IF EXISTS went_offline_at;
-- ALTER TABLE vendors DROP COLUMN IF EXISTS vendor_type;
