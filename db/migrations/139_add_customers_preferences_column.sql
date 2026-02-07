-- ============================================================================
-- Migration: Add preferences column to customers table
-- Description: Adds JSONB preferences column to store profile_photo_url, search history, reminder preferences, and other customer settings
-- Date: 2026-01-16
-- Issue: Customer profile update fails with "column preferences of relation customers does not exist"
-- ============================================================================

-- Add preferences column to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;

-- Add comment to document the column
COMMENT ON COLUMN customers.preferences IS 'Stores customer preferences including profile_photo_url, searchHistory, reminderPreferences, and other settings';

-- Create index for better query performance on preferences
CREATE INDEX IF NOT EXISTS idx_customers_preferences_gin ON customers USING gin (preferences);

-- Example preferences structure:
-- {
--   "profile_photo_url": "https://example.com/photo.jpg",
--   "searchHistory": [
--     { "query": "vet consultation", "timestamp": "2026-01-16T10:30:00Z" }
--   ],
--   "reminderPreferences": {
--     "enabled": true,
--     "timings": [24, 2],
--     "channels": ["sms", "push"]
--   }
-- }
