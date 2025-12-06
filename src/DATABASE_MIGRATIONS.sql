-- ============================================
-- WARMPAWZ DATABASE MIGRATIONS
-- Run this SQL in Supabase SQL Editor
-- ============================================

-- MIGRATION 1: Create prescriptions table
-- ============================================
CREATE TABLE IF NOT EXISTS prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id TEXT NOT NULL,
  vendor_id TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  diagnosis TEXT,
  medications TEXT NOT NULL,
  dosage TEXT,
  frequency TEXT,
  duration TEXT,
  notes TEXT,
  follow_up_date DATE,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_booking ON prescriptions(booking_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_vendor ON prescriptions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_uploaded_at ON prescriptions(uploaded_at DESC);

-- ============================================
-- MIGRATION 2: Create booking_activities table
-- ============================================
CREATE TABLE IF NOT EXISTS booking_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('status_change', 'prescription', 'chat', 'note', 'follow_up', 'otp_verified', 'session_started', 'session_ended')),
  description TEXT NOT NULL,
  actor TEXT NOT NULL CHECK (actor IN ('vendor', 'customer', 'system')),
  actor_name TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_booking ON booking_activities(booking_id);
CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON booking_activities(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activities_type ON booking_activities(type);

-- ============================================
-- MIGRATION 3: Update chat_messages table (if exists)
-- ============================================
DO $$ 
BEGIN
  -- Check if chat_messages table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='chat_messages') THEN
    -- Add archived column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name='chat_messages' AND column_name='archived') THEN
      ALTER TABLE chat_messages ADD COLUMN archived BOOLEAN DEFAULT FALSE;
      CREATE INDEX IF NOT EXISTS idx_chat_messages_archived ON chat_messages(archived);
    END IF;
  END IF;
END $$;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify tables were created:

-- SELECT * FROM prescriptions LIMIT 1;
-- SELECT * FROM booking_activities LIMIT 1;
-- SELECT column_name FROM information_schema.columns WHERE table_name='prescriptions';
-- SELECT column_name FROM information_schema.columns WHERE table_name='booking_activities';
