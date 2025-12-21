# Per KM Charge Removal Summary

## ✅ Completed

Removed `travelChargePerKm` (per km charge) from home services across the entire codebase.

### Files Updated:

1. **`src/supabase/functions/server/service-style-management.tsx`**
   - Removed `travelChargePerKm` from default `at_home` preferences
   - Removed validation requiring `travelChargePerKm` when enabling `at_home` services
   - Updated `PUT /staff/:staffId/home-distance` endpoint to only accept `maxDistance`
   - Removed `travelChargePerKm` from response

2. **`src/supabase/functions/server/staff-service-style-setup.tsx`**
   - Removed `travelChargePerKm` from `StylePreferences` interface
   - Removed `travelChargePerKm` from default `at_home` configuration

3. **`src/supabase/functions/server/staff-service-endpoints.tsx`**
   - Removed `travelChargePerKm` from default preferences when creating new staff service styles

4. **`src/supabase/functions/server/staff-discovery-endpoints.tsx`**
   - Removed `travelChargePerKm` from default `at_home` preferences

## Changes Made:

### Before:
```typescript
at_home: {
  enabled: boolean;
  available: boolean;
  maxDistance: number;
  travelChargePerKm: number; // ❌ REMOVED
  acceptInstantBooking: boolean;
}
```

### After:
```typescript
at_home: {
  enabled: boolean;
  available: boolean;
  maxDistance: number; // ✅ Only distance is required
  acceptInstantBooking: boolean;
}
```

## Validation Updates:

- **Before:** Required both `maxDistance` and `travelChargePerKm` when enabling `at_home` services
- **After:** Only requires `maxDistance` when enabling `at_home` services

## API Changes:

### `PUT /staff/:staffId/home-distance`
- **Before:** Accepted `{ maxDistance, travelChargePerKm }`
- **After:** Only accepts `{ maxDistance }`

## Impact:

- ✅ Home services now only require `maxDistance` configuration
- ✅ No per km charges are calculated or stored
- ✅ All validation updated to reflect removal
- ✅ Default preferences updated across all endpoints

## Notes:

- Frontend components (`ServiceStyleManager.tsx`) already don't reference `travelChargePerKm`
- Any existing data with `travelChargePerKm` will be ignored (field is simply not used)
- No migration needed - field is optional and will be ignored if present

