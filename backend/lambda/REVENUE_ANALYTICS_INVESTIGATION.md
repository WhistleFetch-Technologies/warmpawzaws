# Revenue Analytics Investigation Results

## Date: 2026-03-19

## Summary
Investigated why revenue analytics graphs were showing empty or not displaying properly. Found that queries were working correctly but had display/formatting issues.

## Investigation Results

### 1. Revenue Query (`/admin/analytics/revenue`)
**Status:** ✅ **Working - Returns Data**

**Query Location:** `backend/lambda/src/endpoints/admin/endpoints/analytics.admin.ts:644-651`

**Findings:**
- Query returns **3 rows** of data for last 30 days
- Revenue values: ₹699, ₹120, ₹432
- Commission: ₹0.00 (because `platform_fee` and `commission_amount` are NULL in database)
- Total payments: 54 (9 completed, 45 pending)
- Date range: Mar 2, 2026 to Mar 19, 2026

**Issues Found:**
1. ❌ Date format: Backend returned full timestamp strings instead of formatted dates
2. ❌ Y-axis formatting: Small values (₹120, ₹432) showed as "₹0k" which is incorrect
3. ❌ Empty state: No handling when data array is empty

**Fixes Applied:**
1. ✅ Format dates in backend: `toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })`
2. ✅ Fix Y-axis formatter: Handle values < 1000 properly (show ₹120 instead of ₹0k)
3. ✅ Add empty state handling in `RevenueChart.tsx`

### 2. Category Query (`/admin/analytics/categories`)
**Status:** ✅ **Working - Returns Data**

**Query Location:** `backend/lambda/src/endpoints/admin/endpoints/analytics.admin.ts:704-718`

**Findings:**
- Query returns **5 categories** with revenue breakdown:
  1. diagnostics_center: ₹2000 (1 booking)
  2. vet_solo: ₹1998 (18 bookings)
  3. vet_clinic: ₹1398 (2 bookings)
  4. behaviorist_solo: ₹0 (0 bookings)
  5. pharmacy: ₹0 (0 bookings)
- Total vendors: 7 (6 approved & active)
- Total bookings: 31 (22 completed)

**Issues Found:**
1. ❌ Missing `is_deleted` filter (could show deleted vendors)
2. ❌ No empty state handling for PieChart

**Fixes Applied:**
1. ✅ Added `is_deleted` filter: `AND (v.is_deleted IS NULL OR v.is_deleted = false)`
2. ✅ Added empty state handling for category PieChart

## Database Schema Verification

### Payments Table
- ✅ Table exists
- ✅ Has required columns: `created_at`, `amount`, `payment_status`, `platform_fee`, `commission_amount`
- ✅ 54 total payments
- ✅ 9 completed payments (status: 'completed')
- ✅ 45 pending payments

### Bookings Table
- ✅ Table exists
- ✅ Has required columns: `vendor_id`, `created_at`, `status`, `total_amount`
- ✅ 31 total bookings
- ✅ 22 completed bookings

### Vendors Table
- ✅ Table exists
- ✅ Has required columns: `status`, `is_active`, `is_deleted`, `role_id`, `category`
- ✅ 7 total vendors
- ✅ 6 approved & active vendors

## Files Modified

1. **Backend:**
   - `backend/lambda/src/endpoints/admin/endpoints/analytics.admin.ts`
     - Fixed date formatting in revenue endpoint
     - Added `is_deleted` filter to category query

2. **Frontend:**
   - `apps/admin-web/components/admin/analytics/RevenueChart.tsx`
     - Fixed Y-axis formatter for small values
     - Added empty state handling
   - `apps/admin-web/app/analytics/page.tsx`
     - Added empty state handling for category PieChart

## Test Scripts Created

1. `test-revenue-query.js` - Tests revenue analytics query
2. `test-category-query.js` - Tests category analytics query

## Next Steps

1. ✅ **Completed:** Fix date formatting
2. ✅ **Completed:** Fix Y-axis formatting
3. ✅ **Completed:** Add empty state handling
4. ✅ **Completed:** Add `is_deleted` filter to category query
5. 🔄 **Optional:** Consider populating `platform_fee` or `commission_amount` in payments table for accurate commission tracking

## Testing

To test the fixes:
1. Restart backend server
2. Navigate to `/analytics` page in admin dashboard
3. Verify:
   - Revenue chart shows formatted dates (e.g., "Mar 13", "Mar 18")
   - Y-axis shows proper values (₹120, ₹432, not ₹0k)
   - Empty state shows when no data
   - Category pie chart shows all 5 categories

## Notes

- Commission is currently ₹0 because `platform_fee` and `commission_amount` columns are NULL
- Default 2% commission is calculated in backend if commission is 0
- Both queries are working correctly and returning data
- The issue was purely in frontend display formatting
