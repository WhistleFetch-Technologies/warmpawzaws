# Dashboard Enhancement Phase 2 Plan

## Target: Replace 10 Specialized Placeholders

### Capabilities with APIs + Pages:
1. ✅ **cafe_tables** - API: `/vendor/:id/tables`, Page: `/cafe/tables`
2. ✅ **rooms** - API: `/vendor/:id/rooms`, Page: `/resort/rooms`
3. ✅ **insurance_plans** - API: `/insurance/plans`, Page: `/insurance/plans`
4. ✅ **products** - API: `/vendor/:vendorId/products`, Page: `/products`
5. ✅ **holiday_packages** - API: `/vendor/:id/holiday-packages`, Page: (need to check/verify)

### Capabilities with APIs but need verification:
6. ⚠️ **meal_plans** - API: `/vendor/:vendorId/nutritionist/meal-plans`, Page: `/nutrition/plans` (verify)
7. ⚠️ **training_programs** - Need to check API and page

### Capabilities needing investigation:
8. ❓ **adoption** - Need to check
9. ❓ **walking** - Need to check
10. ❓ **ambulance** - Need to check

## Implementation Strategy:

For each capability:
1. Create functional component that loads data from API
2. Display summary/count
3. Link to full page (if exists)
4. Handle loading and error states
