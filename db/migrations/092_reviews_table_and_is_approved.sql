-- ============================================================================
-- Migration 092: Create reviews table and add is_approved column
-- Date: 2026-02-09
-- Purpose: Create reviews table if missing and add is_approved column for analytics
-- ============================================================================

BEGIN;

-- Create reviews table if it doesn't exist
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  service_type VARCHAR(100),
  is_verified BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE reviews IS 'Customer reviews and ratings for vendors';

-- Add is_approved column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'reviews' AND column_name = 'is_approved'
  ) THEN
    ALTER TABLE reviews ADD COLUMN is_approved BOOLEAN DEFAULT false;
    ALTER TABLE reviews ADD COLUMN approved_at TIMESTAMPTZ;
    ALTER TABLE reviews ADD COLUMN rejection_reason TEXT;
    COMMENT ON COLUMN reviews.is_approved IS 'Whether review is approved by admin';
    COMMENT ON COLUMN reviews.approved_at IS 'When review was approved';
    COMMENT ON COLUMN reviews.rejection_reason IS 'Reason for rejection if not approved';
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_reviews_vendor ON reviews(vendor_id);
CREATE INDEX IF NOT EXISTS idx_reviews_customer ON reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_booking ON reviews(booking_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_is_approved ON reviews(is_approved) WHERE is_approved = true;
CREATE INDEX IF NOT EXISTS idx_reviews_vendor_approved ON reviews(vendor_id, is_approved) WHERE is_approved = true;

-- Set default is_approved for existing reviews (if any)
UPDATE reviews SET is_approved = false WHERE is_approved IS NULL;

COMMIT;
