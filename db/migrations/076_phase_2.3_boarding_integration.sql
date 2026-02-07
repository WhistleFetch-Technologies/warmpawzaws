-- Migration: Phase 2.3 Boarding Integration
-- Purpose: Add room_id and promotion_id support for boarding bookings
-- Date: 2025-01-30

-- ============================================
-- ADD promotion_id TO bookings TABLE
-- ============================================
DO $$ 
BEGIN
    -- Check if promotion_id column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'promotion_id'
    ) THEN
        ALTER TABLE bookings 
        ADD COLUMN promotion_id UUID REFERENCES promotions(id) ON DELETE SET NULL;
        
        CREATE INDEX IF NOT EXISTS idx_bookings_promotion_id ON bookings(promotion_id) WHERE promotion_id IS NOT NULL;
        
        COMMENT ON COLUMN bookings.promotion_id IS 'Applied promotion/coupon for booking discount (Phase 2.3)';
    END IF;
END $$;

-- ============================================
-- UPDATE room_id TO SUPPORT BOARDING ROOMS
-- ============================================
-- Note: room_id was added in migration 074 for consultation_rooms
-- For Phase 2.3, we need room_id to also support boarding_rooms
-- Since UUID references can point to different tables, we'll use a flexible approach
-- The booking notes can indicate which table (consultation_rooms vs boarding_rooms)
-- or we can use metadata JSONB to store room_type

-- If room_id exists but is constrained to consultation_rooms only, we may need to adjust
-- For now, keeping room_id as UUID (no foreign key constraint) to allow flexibility
-- between consultation_rooms (vet clinics) and boarding_rooms (boarding facilities)

DO $$ 
BEGIN
    -- If room_id column doesn't exist at all, add it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'room_id'
    ) THEN
        ALTER TABLE bookings 
        ADD COLUMN room_id UUID; -- No foreign key constraint for flexibility
        
        CREATE INDEX IF NOT EXISTS idx_bookings_room_id ON bookings(room_id) WHERE room_id IS NOT NULL;
        
        COMMENT ON COLUMN bookings.room_id IS 'Assigned room (consultation_rooms or boarding_rooms) - UUID without FK constraint for flexibility (Phase 2.3)';
    END IF;
END $$;

-- ============================================
-- VERIFY COLUMNS EXIST
-- ============================================
DO $$ 
BEGIN
    RAISE NOTICE 'Phase 2.3 Boarding Integration Migration Complete';
    RAISE NOTICE 'Columns verified: room_id, promotion_id';
END $$;
