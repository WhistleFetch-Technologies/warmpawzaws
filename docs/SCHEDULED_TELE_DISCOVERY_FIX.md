# Scheduled Tele Consulting Service Provider Discovery Fix

**Date:** $(date)  
**Issue:** Scheduled tele consulting service provider discovery was not finding all available providers  
**Reference:** Instant tele service vendor discovery implementation

## Problem

The scheduled tele consulting service provider discovery (`/customer/discover-services?serviceStyle=tele`) was only checking `vendor_services` table for staff members, but not checking `staff_services` table. This meant that:

1. **Instant tele** (`/customer/tele/available-providers`): 
   - ✅ Checks `staff_tele_availability` table for currently available staff
   - ✅ Checks `staff_services` table for staff with tele services
   - ✅ Falls back to `vendor_services` if staff_services doesn't exist
   - ✅ Returns only currently available providers

2. **Scheduled tele** (`/customer/discover-services?serviceStyle=tele`):
   - ❌ Only checked `vendor_services` table
   - ❌ Did not check `staff_services` table
   - ❌ Missed staff members who have tele services configured individually
   - ✅ Should return ALL providers who offer tele services (not just currently available)

## Solution

Updated the scheduled tele discovery in `backend/lambda/src/endpoints/service-discovery.ts` to match the instant tele pattern:

1. **Check if `staff_services` table exists** and what columns it has
2. **Check `staff_services` first** (like instant tele does) for staff with tele services
3. **Fallback to `vendor_services`** if staff_services doesn't exist or has no matches
4. **Support both `service_style` and `service_styles` columns** (array format)

## Code Changes

### Before
```typescript
// Only checked vendor_services
AND EXISTS (
  SELECT 1 FROM vendor_services vs
  WHERE vs.vendor_id::text = COALESCE(s.vendor_id::text, s.id::text)
  AND vs.is_enabled = true
  AND vs.service_style = $1
)
```

### After
```typescript
// Check staff_services first (like instant tele), then fallback to vendor_services
// 1. Check if staff_services table exists
const staffServicesCheck = await query(`
  SELECT 
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'staff_services') as has_staff_services,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_services' AND column_name = 'service_style') as has_service_style,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_services' AND column_name = 'service_styles') as has_service_styles,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_services' AND column_name = 'is_active') as has_is_active
`);

// 2. Build service style filter
let staffServiceStyleFilter = 'TRUE';
if (has_staff_services) {
  if (has_service_styles) {
    staffServiceStyleFilter = `'tele' = ANY(ss.service_styles)`;
  } else if (has_service_style) {
    staffServiceStyleFilter = `ss.service_style = 'tele'`;
  }
}

// 3. Check both staff_services AND vendor_services
AND (
  EXISTS (
    SELECT 1 FROM staff_services ss
    WHERE ss.staff_id::text = s.id::text
    AND ${staffServiceStyleFilter}
    AND ss.is_active = true
  )
  OR
  EXISTS (
    SELECT 1 FROM vendor_services vs
    WHERE vs.vendor_id::text = COALESCE(s.vendor_id::text, s.id::text)
    AND vs.is_enabled = true
    AND vs.publish_status = 'published'
    AND vs.service_style = 'tele'
  )
)
```

## Benefits

1. ✅ **Consistency**: Scheduled tele now uses the same discovery pattern as instant tele
2. ✅ **Completeness**: Finds all staff members with tele services, not just those configured at vendor level
3. ✅ **Flexibility**: Supports both `service_style` (single) and `service_styles` (array) column formats
4. ✅ **Backward Compatibility**: Falls back to `vendor_services` if `staff_services` doesn't exist

## Testing

To test the fix:

1. **Verify staff with tele services in `staff_services` table are found**
2. **Verify staff with tele services in `vendor_services` table are still found**
3. **Verify solo vendors with tele services are still found**
4. **Compare results with instant tele discovery** (should find same providers, but scheduled should show ALL, instant should show only currently available)

## Files Modified

- `backend/lambda/src/endpoints/service-discovery.ts` (lines ~457-519)

## Related Endpoints

- **Instant Tele**: `/customer/tele/available-providers` (in `instant-tele-queue.ts`)
- **Scheduled Tele**: `/customer/discover-services?serviceStyle=tele` (in `service-discovery.ts`)
