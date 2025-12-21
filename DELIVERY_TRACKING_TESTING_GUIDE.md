# Delivery Tracking Testing Guide

## Quick Start Testing

### Prerequisites
1. ✅ Google Maps API key configured in Admin Portal
   - Navigate to: Admin Portal → Platform Settings → Cloud & Maps
   - Ensure Google Maps API key is set

2. ✅ Test Order Available
   - Order with `trackingNumber` or `id`
   - Order status: `in_transit` or `out_for_delivery`
   - Order with `deliveryAddress` or `address` field

### Testing Steps

#### Step 1: Navigate to Order Tracking
1. Open Customer App
2. Go to **Order History** (or **My Orders**)
3. Select an order
4. Click **"Track Order"** button

#### Step 2: Verify Map Loading
**Expected:**
- ✅ Map loads (not simulated/placeholder)
- ✅ Loading spinner appears briefly
- ✅ Google Maps container displays

**If Error:**
- ❌ Check Google Maps API key in admin portal
- ❌ Check browser console for errors
- ❌ Verify network connection

#### Step 3: Verify Markers
**Expected:**
- ✅ **Orange Truck Marker** (delivery partner) visible
- ✅ **Green Home Marker** (customer address) visible
- ✅ Both markers on map

**If Missing:**
- ❌ Check if order has tracking data
- ❌ Check if delivery address is valid
- ❌ Check browser console for geocoding errors

#### Step 4: Verify Route
**Expected:**
- ✅ **Orange route line** connects markers
- ✅ Route follows roads (not straight line)
- ✅ Route visible on map

**If Missing:**
- ❌ Check if both locations are available
- ❌ Check browser console for route calculation errors

#### Step 5: Verify ETA
**Expected:**
- ✅ ETA displayed in overlay (e.g., "25 mins")
- ✅ ETA updates when route recalculates
- ✅ ETA is realistic

**If Wrong:**
- ❌ Check route calculation
- ❌ Verify delivery partner location is correct

#### Step 6: Verify Real-Time Updates
**Expected:**
- ✅ Delivery partner marker moves every 10 seconds
- ✅ Route updates with new position
- ✅ ETA updates based on new position

**If Not Updating:**
- ❌ Check order status (should be `in_transit`)
- ❌ Check tracking endpoint response
- ❌ Check browser console for errors

---

## Component Usage

### Current Implementation
The enhanced `OrderTrackingView` component is imported but **not currently used** in routing. The app uses `OrderTrackingPage` instead.

**Current Route (CustomerHomeWrapper.tsx:554):**
```typescript
if (currentScreen === 'order_tracking' && selectedOrder) 
  return <OrderTrackingPage orderId={selectedOrder.id || selectedOrder.orderId} onBack={() => setCurrentScreen('order_detail')} />;
```

**Enhanced Component:**
```typescript
<OrderTrackingView 
  order={selectedOrder} 
  onBack={() => setCurrentScreen('order_detail')} 
  onContactDelivery={() => {/* handle call */}} 
/>
```

### To Use Enhanced Component

**Option 1: Replace OrderTrackingPage**
Update `CustomerHomeWrapper.tsx` line 554:
```typescript
if (currentScreen === 'order_tracking' && selectedOrder) 
  return <OrderTrackingView 
    order={selectedOrder} 
    onBack={() => setCurrentScreen('order_detail')} 
    onContactDelivery={() => {
      // Handle phone call
      window.location.href = `tel:${selectedOrder.deliveryPartner?.phone || ''}`;
    }} 
  />;
```

**Option 2: Keep Both Components**
- Use `OrderTrackingPage` for Shiprocket tracking (external courier)
- Use `OrderTrackingView` for internal delivery tracking (hyperlocal)

---

## Test Scenarios

### Scenario 1: Happy Path ✅
**Setup:**
- Order with valid tracking number
- Order status: `in_transit`
- Valid delivery address
- Google Maps API key configured

**Expected:**
- Map loads successfully
- Both markers visible
- Route calculated
- ETA displayed
- Real-time updates work

### Scenario 2: Missing API Key ❌
**Setup:**
- Google Maps API key not configured

**Expected:**
- Error message displayed
- Fallback UI shown
- User-friendly error message

### Scenario 3: Missing Tracking Data ⚠️
**Setup:**
- Order without tracking number
- Order without current location

**Expected:**
- Default locations used
- Map still displays
- No errors thrown

### Scenario 4: Invalid Address ⚠️
**Setup:**
- Order with invalid/malformed address

**Expected:**
- Geocoding fails gracefully
- Default location used
- Map still displays

### Scenario 5: Delivered Order ✅
**Setup:**
- Order status: `delivered`

**Expected:**
- Map displays final location
- No real-time updates
- Final route shown

---

## Manual Test Checklist

### Basic Functionality
- [ ] Navigate to order tracking
- [ ] Map loads (not simulated)
- [ ] Delivery partner marker visible
- [ ] Customer location marker visible
- [ ] Route line visible
- [ ] ETA displayed

### Error Handling
- [ ] Missing API key handled gracefully
- [ ] Missing tracking data handled gracefully
- [ ] Invalid address handled gracefully
- [ ] Network errors handled gracefully

### Real-Time Updates
- [ ] Location updates every 10 seconds
- [ ] Route updates with new position
- [ ] ETA updates with new position

### UI Interactions
- [ ] "Center on delivery" button works
- [ ] "Call Delivery Partner" button works
- [ ] "Share Live Location" button works
- [ ] Back button works

### Different Order Statuses
- [ ] Pending order works
- [ ] In-transit order works
- [ ] Delivered order works
- [ ] Cancelled order works

---

## Browser Console Checks

### Expected Logs
```
✅ Google Maps script loaded
✅ Tracking data fetched
✅ Address geocoded successfully
✅ Route calculated
✅ Location updated
```

### Error Logs to Watch For
```
❌ Failed to load Google Maps
❌ Google Maps API key not configured
❌ Tracking data fetch failed
❌ Geocoding failed
❌ Route calculation failed
```

---

## Network Requests to Verify

### 1. Google Maps API Key Fetch
```
GET /admin/integrations/settings
Expected: 200 OK with googleMaps.apiKey
```

### 2. Tracking Data Fetch
```
GET /ecommerce/delivery/track/:trackingNumber
Expected: 200 OK with tracking.currentLocation
```

### 3. Google Maps Script Load
```
GET https://maps.googleapis.com/maps/api/js?key=...
Expected: 200 OK (script loaded)
```

---

## Quick Test Script

```javascript
// Run in browser console on order tracking page

// 1. Check if Google Maps loaded
console.log('Google Maps loaded:', !!window.google);

// 2. Check if map instance exists
const mapElement = document.querySelector('[ref*="mapRef"]');
console.log('Map element found:', !!mapElement);

// 3. Check tracking data
// (Check Network tab for /ecommerce/delivery/track/ request)

// 4. Check for errors
console.log('Errors in console:', /* check console */);
```

---

## Troubleshooting

### Issue: Map Not Loading
**Possible Causes:**
- Google Maps API key not configured
- API key invalid
- Network error
- Script loading blocked

**Solutions:**
1. Check admin portal for API key
2. Verify API key in browser network tab
3. Check browser console for errors
4. Verify CORS settings

### Issue: Markers Not Visible
**Possible Causes:**
- Tracking data missing
- Geocoding failed
- Map not initialized

**Solutions:**
1. Check order has tracking number
2. Check delivery address is valid
3. Check browser console for errors
4. Verify map initialization

### Issue: Route Not Displaying
**Possible Causes:**
- Directions API not enabled
- Invalid locations
- Network error

**Solutions:**
1. Check Google Maps API includes Directions library
2. Verify both locations are valid
3. Check browser console for errors

### Issue: Real-Time Updates Not Working
**Possible Causes:**
- Order status not `in_transit`
- Tracking endpoint not returning location
- Interval not running

**Solutions:**
1. Check order status
2. Verify tracking endpoint response
3. Check browser console for errors
4. Verify interval is set (10 seconds)

---

## Next Steps After Testing

1. **If All Tests Pass:**
   - ✅ Update routing to use `OrderTrackingView` (if desired)
   - ✅ Document any edge cases
   - ✅ Mark as production-ready

2. **If Issues Found:**
   - Document issues
   - Fix bugs
   - Re-test
   - Update documentation

---

## Support

**Component:** `src/components/customer/OrderTrackingView.tsx`  
**Related:** `src/components/customer/shop/OrderTrackingPage.tsx`  
**Pattern:** `src/components/customer/UniversalHomeServiceTracking.tsx`

**Backend Endpoints:**
- `/ecommerce/delivery/track/:trackingNumber`
- `/admin/integrations/settings`

