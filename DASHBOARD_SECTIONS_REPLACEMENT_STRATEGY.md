# Dashboard Sections Replacement Strategy

## Analysis

Looking at `VendorCapabilityDashboard.tsx`, I can see:

### Current Implementation Status:
1. **17 sections are "implemented"** but some still use placeholders:
   - `services` - FULL ✅
   - `staff` - FULL ✅  
   - `bookings` - FULL ✅
   - `earnings` - FULL ✅
   - `schedule` - PLACEHOLDER ⚠️
   - `profile` - FULL ✅
   - `cafe_tables` - PLACEHOLDER (uses SpecializedPlaceholder)
   - `rooms` - PLACEHOLDER (uses SpecializedPlaceholder)
   - `insurance_plans` - PLACEHOLDER (uses SpecializedPlaceholder)
   - `adoption` - PLACEHOLDER (uses SpecializedPlaceholder)
   - `meal_plans` - PLACEHOLDER (uses SpecializedPlaceholder)
   - `walking` - PLACEHOLDER (uses SpecializedPlaceholder)
   - `ambulance` - PLACEHOLDER (uses SpecializedPlaceholder)
   - `diagnostics` - PLACEHOLDER (uses SpecializedPlaceholder) ⚠️ WE HAVE PAGE!
   - `holiday_packages` - PLACEHOLDER (uses SpecializedPlaceholder)
   - `products` - PLACEHOLDER (uses SpecializedPlaceholder)
   - `training_programs` - PLACEHOLDER (uses SpecializedPlaceholder)

2. **All other capabilities** show default "Coming soon..." placeholder

### Key Insight:
We've created full pages for:
- ✅ `prescriptions` - `/medical/prescriptions`
- ✅ `medical_records` - `/medical/records`
- ✅ `vaccination` - `/medical/vaccination`
- ✅ `test_catalog` (diagnostics) - `/services/tests`
- ✅ `pricing` - `/services/pricing`
- ✅ `reviews` - `/operations/reviews`
- ✅ `analytics` - `/operations/analytics`
- ✅ `reports` - `/operations/reports`

But these are NOT in the implemented list, so they show the default placeholder!

## Strategy

Instead of replacing all 39 placeholders, I'll:
1. Add functional sections for capabilities we have full pages for
2. Replace specialized placeholders with functional sections that link to full pages
3. Create a pattern that can be reused

## Implementation Plan

### Priority 1: Add sections for capabilities with full pages
- `prescriptions` → Link to `/medical/prescriptions` with summary
- `medical_records` → Link to `/medical/records` with summary
- `vaccination` → Link to `/medical/vaccination` with summary
- `diagnostics` → Link to `/services/tests` with summary (already placeholder, replace it)
- `pricing` → Link to `/services/pricing` with summary
- `reviews` → Link to `/operations/reviews` with summary
- `analytics` → Link to `/operations/analytics` with summary
- `reports` → Link to `/operations/reports` with summary

### Priority 2: Replace specialized placeholders
Replace `SpecializedPlaceholder` with functional sections that load data and link to pages.

### Priority 3: Enhance existing placeholder sections
Improve `ScheduleSection` to be fully functional.
