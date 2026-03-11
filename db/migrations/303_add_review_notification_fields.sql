-- ============================================================================
-- MIGRATION 303: Add Review and Notification Fields to Bookings Table
-- ============================================================================
-- Date: 2026-01-28
-- Purpose: Add review_skipped_at and notification_sent_at columns to bookings table
-- Phase: Phase 2 - Customer Engagement & Notifications
-- 
-- IMPORTANT: This migration is idempotent and safe to re-run
-- ============================================================================

-- Add review_skipped_at timestamp column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'review_skipped_at'
    ) THEN
        ALTER TABLE bookings ADD COLUMN review_skipped_at TIMESTAMPTZ;
        COMMENT ON COLUMN bookings.review_skipped_at IS 'Timestamp when customer skipped the review';
    END IF;
END $$;

-- Add notification_sent_at timestamp column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'notification_sent_at'
    ) THEN
        ALTER TABLE bookings ADD COLUMN notification_sent_at TIMESTAMPTZ;
        COMMENT ON COLUMN bookings.notification_sent_at IS 'Timestamp when notification was sent to customer';
    END IF;
END $$;

-- Create index on review_skipped_at for faster queries
CREATE INDEX IF NOT EXISTS idx_bookings_review_skipped_at ON bookings(review_skipped_at) WHERE review_skipped_at IS NOT NULL;

-- Create index on notification_sent_at for faster queries
CREATE INDEX IF NOT EXISTS idx_bookings_notification_sent_at ON bookings(notification_sent_at) WHERE notification_sent_at IS NOT NULL;

COMMENT ON TABLE bookings IS 'Bookings with review and notification tracking';
