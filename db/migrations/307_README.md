# Migration 307: Update Service Type Constraints

## Overview
This migration updates the `bookings.service_type` CHECK constraint to accept the new service type values used by the frontend.

## Problem
- **Database constraint:** Only allows `'at_vendor'`, `'at_home'`, `'online'`
- **Frontend sends:** `'at_center'`, `'at_home'`, `'tele'`
- **Impact:** Booking creation fails with constraint violation error

## Solution
Update the CHECK constraint to accept both legacy and new values:
- Legacy: `'at_vendor'` (center), `'online'` (tele)
- New: `'at_center'` (center), `'tele'` (tele/video)
- Common: `'at_home'` (home visit)

## Changes
1. Drops existing `bookings_service_type_check` constraint
2. Creates new constraint accepting all 5 values
3. Creates index on `service_type` for performance
4. Verifies existing data compatibility

## Testing
After running this migration:
1. Test booking creation with `'at_center'` - should succeed
2. Test booking creation with `'tele'` - should succeed
3. Test booking creation with `'at_vendor'` - should still work (backward compatibility)
4. Test booking creation with `'online'` - should still work (backward compatibility)

## Rollback
If needed, rollback to original constraint:
```sql
ALTER TABLE bookings DROP CONSTRAINT bookings_service_type_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_service_type_check 
  CHECK (service_type IN ('at_vendor', 'at_home', 'online'));
```

## Related Issues
- SERVICE_BOOKING_FLOW_TRACE_REPORT.md - Gap Report Issue #3
- NEXT_STEPS_SUMMARY.md - Critical Issue #1
