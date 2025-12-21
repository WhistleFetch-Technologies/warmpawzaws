# Delivery Tracking Test Plan

## Component: `OrderTrackingView.tsx`

### Test Environment Setup

#### Prerequisites
1. ✅ Google Maps API key configured in Admin Portal → Platform Settings → Cloud & Maps
2. ✅ Test order with tracking number
3. ✅ Order in "in_transit" or "out_for_delivery" status
4. ✅ Delivery address available in order object

#### Test Data Requirements
```typescript
const testOrder = {
  id: 'order-123',
  orderNumber: 'ORD-123456',
  trackingNumber: 'TRK1234567890',
  status: 'in_transit', // or 'out_for_delivery'
  deliveryAddress: '123 Main Street, Bangalore, Karnataka 560001',
  address: '123 Main Street, Bangalore, Karnataka 560001', // fallback
  items: [{ id: '1', name: 'Product 1', quantity: 2 }],
  deliveryPartner: {
    name: 'Rajesh Kumar',
    phone: '+91 98765 43210',
    vehicle: 'Bike - KA01AB1234',
    rating: 4.8,
    deliveries: 2450
  }
};
```

---

## Test Cases

### Test 1: Google Maps API Loading ✅
**Objective:** Verify Google Maps loads correctly from platform settings

**Steps:**
1. Navigate to order tracking view
2. Check browser console for Google Maps script loading
3. Verify map container appears (not loading spinner)

**Expected Results:**
- ✅ Google Maps script loads from platform settings
- ✅ Map container displays (not simulated map)
- ✅ No error messages about API key

**Failure Cases:**
- ❌ Error: "Google Maps API key not configured"
- ❌ Error: "Failed to load map"
- ❌ Map shows loading spinner indefinitely

---

### Test 2: Delivery Partner Location Display ✅
**Objective:** Verify delivery partner marker appears on map

**Steps:**
1. Open order tracking for in-transit order
2. Wait for map to load
3. Look for orange truck marker on map

**Expected Results:**
- ✅ Orange truck marker visible on map
- ✅ Marker positioned at delivery partner location
- ✅ Marker animates (drop animation on load)

**Failure Cases:**
- ❌ No marker visible
- ❌ Marker at wrong location
- ❌ Marker doesn't animate

---

### Test 3: Customer Location Display ✅
**Objective:** Verify customer delivery address marker appears

**Steps:**
1. Open order tracking with valid delivery address
2. Wait for geocoding to complete
3. Look for green home marker on map

**Expected Results:**
- ✅ Green home marker visible at delivery address
- ✅ Marker positioned correctly (geocoded)
- ✅ Both markers visible on map

**Failure Cases:**
- ❌ No customer marker
- ❌ Marker at wrong location
- ❌ Geocoding fails (should fallback to default)

---

### Test 4: Route Calculation ✅
**Objective:** Verify route is calculated and displayed

**Steps:**
1. Open order tracking with both locations available
2. Wait for route calculation
3. Check for orange route line on map

**Expected Results:**
- ✅ Orange route line connects delivery partner to customer
- ✅ Route follows roads (not straight line)
- ✅ Route updates when delivery partner moves

**Failure Cases:**
- ❌ No route line visible
- ❌ Route doesn't update
- ❌ Route calculation fails

---

### Test 5: ETA Calculation ✅
**Objective:** Verify ETA is calculated from route

**Steps:**
1. Open order tracking
2. Wait for route calculation
3. Check ETA display in overlay

**Expected Results:**
- ✅ ETA displayed in overlay (e.g., "25 mins")
- ✅ ETA updates when route recalculates
- ✅ ETA is realistic (based on route distance/time)

**Failure Cases:**
- ❌ ETA shows "25 mins" (hardcoded)
- ❌ ETA doesn't update
- ❌ ETA is incorrect

---

### Test 6: Real-Time Location Updates ✅
**Objective:** Verify location updates every 10 seconds

**Steps:**
1. Open order tracking for in-transit order
2. Note initial delivery partner position
3. Wait 10-15 seconds
4. Check if marker position updates

**Expected Results:**
- ✅ Marker position updates every 10 seconds
- ✅ Route recalculates with new position
- ✅ ETA updates based on new position

**Failure Cases:**
- ❌ Marker doesn't move
- ❌ Updates too frequently or not at all
- ❌ Route doesn't update

---

### Test 7: Geocoding Delivery Address ✅
**Objective:** Verify delivery address is geocoded correctly

**Steps:**
1. Open order tracking with delivery address
2. Wait for geocoding
3. Verify customer marker at correct location

**Expected Results:**
- ✅ Address geocoded successfully
- ✅ Customer marker at correct location
- ✅ Map bounds adjusted to show both markers

**Failure Cases:**
- ❌ Geocoding fails (should fallback to default)
- ❌ Wrong location geocoded
- ❌ Geocoding takes too long

---

### Test 8: Error Handling ✅
**Objective:** Verify graceful error handling

**Test 8a: Missing API Key**
- Remove/disable Google Maps API key in admin portal
- Open order tracking
- **Expected:** Error message displayed, fallback UI shown

**Test 8b: Invalid Tracking Number**
- Use order with invalid/missing tracking number
- Open order tracking
- **Expected:** Default locations used, map still displays

**Test 8c: Network Error**
- Simulate network failure
- Open order tracking
- **Expected:** Error handled gracefully, fallback locations used

---

### Test 9: UI Interactions ✅
**Objective:** Verify UI interactions work

**Test 9a: Center on Delivery Button**
- Click "Center on Delivery" button (Navigation icon)
- **Expected:** Map centers on delivery partner location, zooms to 15

**Test 9b: Call Delivery Partner**
- Click "Call Delivery Partner" button
- **Expected:** Phone call initiated (or callback triggered)

**Test 9c: Share Live Location**
- Click "Share Live Location" button
- **Expected:** Location sharing initiated (or callback triggered)

---

### Test 10: Different Order Statuses ✅
**Objective:** Verify behavior for different order statuses

**Test 10a: Pending Order**
- Open tracking for pending order
- **Expected:** Map shows, but no real-time updates

**Test 10b: In Transit Order**
- Open tracking for in-transit order
- **Expected:** Real-time updates every 10 seconds

**Test 10c: Delivered Order**
- Open tracking for delivered order
- **Expected:** No real-time updates, final location shown

**Test 10d: Cancelled Order**
- Open tracking for cancelled order
- **Expected:** No real-time updates

---

## Manual Testing Steps

### Quick Test (5 minutes)
1. **Setup:**
   - Ensure Google Maps API key is configured
   - Have a test order with tracking number

2. **Navigate:**
   - Go to Customer App
   - Navigate to order history
   - Select an order
   - Click "Track Order"

3. **Verify:**
   - ✅ Map loads (not simulated)
   - ✅ Delivery partner marker visible
   - ✅ Customer location marker visible
   - ✅ Route line visible
   - ✅ ETA displayed

### Comprehensive Test (15 minutes)
1. **Test all scenarios above**
2. **Test with different addresses**
3. **Test with missing data**
4. **Test error cases**
5. **Test UI interactions**

---

## Automated Test Scenarios

### Unit Tests (To Be Created)
```typescript
describe('OrderTrackingView', () => {
  it('loads Google Maps from platform settings', () => {});
  it('geocodes delivery address correctly', () => {});
  it('calculates route and ETA', () => {});
  it('updates location every 10 seconds', () => {});
  it('handles missing API key gracefully', () => {});
  it('handles network errors gracefully', () => {});
});
```

---

## Known Issues & Limitations

### Current Limitations
1. **Geocoding Delay:** Address geocoding happens after map loads (may cause slight delay)
2. **Default Locations:** Falls back to Bangalore coordinates if geocoding fails
3. **Tracking Data:** Requires order to have tracking number or ID

### Future Enhancements
1. Pre-geocode addresses when order is created
2. Store warehouse locations in config
3. Add more delivery partner details
4. Add delivery history timeline on map

---

## Test Results Template

```
Test Date: __________
Tester: __________
Environment: [ ] Development [ ] Staging [ ] Production

Test Case | Status | Notes
----------|--------|-------
1. API Loading | [ ] Pass [ ] Fail | 
2. Delivery Partner Marker | [ ] Pass [ ] Fail |
3. Customer Location Marker | [ ] Pass [ ] Fail |
4. Route Calculation | [ ] Pass [ ] Fail |
5. ETA Calculation | [ ] Pass [ ] Fail |
6. Real-Time Updates | [ ] Pass [ ] Fail |
7. Geocoding | [ ] Pass [ ] Fail |
8. Error Handling | [ ] Pass [ ] Fail |
9. UI Interactions | [ ] Pass [ ] Fail |
10. Order Statuses | [ ] Pass [ ] Fail |

Overall: [ ] Pass [ ] Fail
Issues Found: __________
```

---

## Quick Verification Checklist

- [ ] Google Maps API key configured in admin portal
- [ ] Map loads (not simulated/placeholder)
- [ ] Delivery partner marker visible (orange truck)
- [ ] Customer location marker visible (green home)
- [ ] Route line visible (orange)
- [ ] ETA displayed and updates
- [ ] Location updates every 10 seconds
- [ ] "Center on delivery" button works
- [ ] Error handling works (test with missing API key)
- [ ] Works on mobile viewport
- [ ] Works on desktop viewport

---

## Next Steps After Testing

1. **If All Tests Pass:**
   - ✅ Mark enhancement as complete
   - ✅ Document any edge cases found
   - ✅ Proceed with other tasks

2. **If Issues Found:**
   - Document issues
   - Fix bugs
   - Re-test
   - Update documentation

---

## Support Information

**Component:** `src/components/customer/OrderTrackingView.tsx`  
**Dependencies:** Google Maps API (from platform settings)  
**Backend Endpoints:**
- `/ecommerce/delivery/track/:trackingNumber`
- `/admin/integrations/settings`

**Related Components:**
- `UniversalHomeServiceTracking.tsx` (similar pattern)
- `LiveTrackingMap.tsx` (similar pattern)

