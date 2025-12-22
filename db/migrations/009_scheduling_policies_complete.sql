-- Migration: Complete Scheduling Policies
-- Purpose: Add missing policies for centre and staff schedules
-- Date: 2025-01-22

-- Centre Schedule Policy
INSERT INTO scheduling_policies (policy_name, policy_type, policy_config) VALUES
('Centre Schedule Policy', 'centre_schedule', '{
  "enforceOperatingHours": true,
  "allowHolidayBookings": false,
  "specialHoursAllowed": true,
  "maxAdvanceBookingDays": 90,
  "minAdvanceBookingMinutes": 30,
  "slotGenerationInterval": 30,
  "allowVendorOverride": true,
  "requireConfirmation": false
}')
ON CONFLICT (policy_name) DO UPDATE SET
  policy_config = EXCLUDED.policy_config,
  updated_at = NOW();

-- Staff Schedule Policy
INSERT INTO scheduling_policies (policy_name, policy_type, policy_config) VALUES
('Staff Schedule Policy', 'staff_schedule', '{
  "enforceWorkingHours": true,
  "allowHolidayBookings": false,
  "enforceBreaks": true,
  "multiLocationAllowed": true,
  "minTravelTimeBetweenLocations": 30,
  "maxLocationsPerDay": 5,
  "requireLocationConfirmation": true,
  "trackRealTimeLocation": true,
  "allowScheduleOverride": false
}')
ON CONFLICT (policy_name) DO UPDATE SET
  policy_config = EXCLUDED.policy_config,
  updated_at = NOW();

-- Update existing policies if needed
UPDATE scheduling_policies
SET policy_config = jsonb_set(
  policy_config,
  '{lockTimeout}',
  '30000'::jsonb
)
WHERE policy_type = 'overbooking_prevention';

-- Add automated lock cleanup job (via pg_cron if available)
-- This would be set up separately in production
COMMENT ON TABLE scheduling_policies IS 'All scheduling policies including centre and staff schedules';

