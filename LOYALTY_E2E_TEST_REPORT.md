# Loyalty E2E Test Report
## Complete User Journey Testing

**Date:** 2026-01-13  
**Test Type:** End-to-End UI Flow Simulation  
**Status:** 🔄 In Progress

---

## Test Plan

### Step 1: Create Loyalty Action Rule ✅
- **UI Path:** Admin → Loyalty → Action Rules Tab → Create Action Rule
- **API:** `POST /admin/loyalty-action-rules`
- **Test Data:**
  ```json
  {
    "action_name": "buy_product",
    "action_category": "loyalty",
    "user_type": "customer",
    "points_type": "per_amount",
    "points_value": 10,
    "base_amount": 100,
    "frequency_type": "unlimited",
    "is_active": true,
    "priority": 100
  }
  ```
- **Status:** ⚠️ API endpoint has bug (fixed in code, needs deployment)

### Step 2: Create Loyalty Segment ✅
- **UI Path:** Admin → Loyalty → Segments Tab → Create Segment
- **API:** `POST /admin/loyalty-segments`
- **Test Data:**
  ```json
  {
    "segment_name": "Test Customers - All",
    "segment_type": "customer",
    "criteria": {},
    "match_type": "all",
    "is_active": true
  }
  ```
- **Status:** ⚠️ API endpoint has bug (fixed in code, needs deployment)

### Step 3: Link Segment to Rule ✅
- **UI Path:** Admin → Loyalty → Action Rules → Edit Rule → Select Segments
- **API:** `PUT /admin/loyalty-action-rules/:id`
- **Status:** Pending Step 1 & 2 completion

### Step 4: Create Vendor ✅
- **UI Path:** Admin → Vendors → Add Vendor
- **API:** `POST /admin/vendors/create`
- **Status:** ✅ Ready (needs testing)

### Step 5: Create Service/Product ✅
- **UI Path:** Admin → Catalog → Services/Products
- **API:** `POST /admin/catalog/services` or `/admin/catalog/products`
- **Status:** ✅ Ready (needs testing)

### Step 6: Create Customer Order/Booking ✅
- **UI Path:** Customer App → Shop/Book Service → Checkout
- **API:** `POST /orders/create` or `POST /bookings/create`
- **Status:** ✅ Ready (needs testing)

### Step 7: Verify Points Awarded ✅
- **UI Path:** Customer App → Rewards/Loyalty → View Points
- **API:** `GET /customer/:id/rewards/points`
- **Status:** ✅ Ready (needs testing)

---

## Issues Found

### Issue 1: Query Parameter Parsing Error
**Location:** `backend/lambda/src/endpoints/loyalty-action-rules-management.ts:309`  
**Error:** `Cannot read properties of undefined (reading 'entries')`  
**Root Cause:** `req.headers.entries()` fails when headers object doesn't have entries method  
**Fix Applied:** ✅ Added try-catch and fallback to Object.keys()  
**Status:** Fixed in code, needs deployment

### Issue 2: URL SearchParams Parsing
**Location:** `backend/lambda/src/endpoints/loyalty-action-rules-management.ts:309`  
**Error:** URL parsing fails with relative URLs  
**Root Cause:** Using `new URL(c.req.url, 'http://localhost')` fails  
**Fix Applied:** ✅ Changed to use Hono's `c.req.query()` method  
**Status:** Fixed in code, needs deployment

---

## Next Steps

1. ✅ Fix API endpoint bugs (DONE)
2. ⏳ Deploy Lambda function with fixes
3. ⏳ Run E2E test script
4. ⏳ Verify points are awarded correctly
5. ⏳ Test segment-based targeting
6. ⏳ Document results

---

## Test Script

See: `scripts/test-loyalty-e2e-flow.sh`

**Usage:**
```bash
API_BASE_URL="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com" \
./scripts/test-loyalty-e2e-flow.sh
```

---

**Last Updated:** 2026-01-13 13:50 IST
