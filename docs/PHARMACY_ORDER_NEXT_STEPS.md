# Pharmacy Order Flow - Next Steps Implementation Plan

## ✅ Completed
1. **Payment Integration** - Razorpay payment working
2. **NAT Instance Configuration** - IP forwarding enabled
3. **Basic Order Status** - Order creation, broadcast status, tracking endpoints

## 🚀 Next Steps (Priority Order)

### 1. Live Tracking UI with Google Maps (HIGH PRIORITY)
**Status**: In Progress
**Files to Update**:
- `apps/customer-web/components/customer/pharmacy/PharmacyOrderStatus.tsx`
- Add Google Maps integration similar to `LiveTrackingWidget.tsx`

**Features**:
- Real-time map showing delivery partner location
- Route from pharmacy to customer
- ETA calculation and display
- Live location updates (polling or SSE)
- Zomato-like tracking experience

**Backend Endpoint**: `/pharmacy/orders/:orderId/tracking` (already exists)

### 2. Complete OTP Generation & Verification (HIGH PRIORITY)
**Status**: Partially Implemented
**Current State**: OTP generation exists in `pharmacy-orders.ts` (line 1395)
**Needs**:
- Frontend UI for OTP input during delivery
- OTP verification endpoint enhancement
- SMS notification for OTP
- OTP expiry handling

**Files**:
- `backend/lambda/src/endpoints/pharmacy-orders.ts` (enhance existing)
- `apps/customer-web/components/customer/pharmacy/PharmacyOrderStatus.tsx` (add OTP input)

### 3. Shiprocket Integration Enhancement (MEDIUM PRIORITY)
**Status**: Basic implementation exists
**Current State**: `/logistics/shiprocket/create-order` endpoint exists
**Needs**:
- Integration with pharmacy order flow
- Automatic shipment creation after payment
- AWB tracking integration
- Status sync with Shiprocket

**Files**:
- `backend/lambda/src/endpoints/pharmacy-orders.ts` (add Shiprocket call after payment)
- `backend/lambda/src/endpoints/logistics.ts` (verify and enhance)

### 4. Push Notifications (MEDIUM PRIORITY)
**Status**: Partially Implemented
**Current State**: Notification service exists
**Needs**:
- Order accepted notification
- Order ready notification
- Out for delivery notification
- Delivery partner assigned notification
- ETA updates
- Delivery completed notification

**Files**:
- `backend/lambda/src/lib/services/push-notification-service.ts`
- Add notifications at key points in `pharmacy-orders.ts`

### 5. Proforma Invoice Upload & Approval (LOW PRIORITY)
**Status**: Not Implemented
**Needs**:
- Pharmacy uploads proforma invoice
- Customer reviews and approves
- Payment processing after approval

**Files**:
- New endpoint: `/pharmacy/orders/:orderId/invoice/upload`
- New endpoint: `/pharmacy/orders/:orderId/invoice/approve`
- Frontend component for invoice review

### 6. Delivery Charges Refinement (LOW PRIORITY)
**Status**: Basic implementation exists
**Current State**: `calculateDeliveryFee` function exists
**Needs**:
- Verify hyperlocal rules are working
- Add platform fees calculation
- Add convenience fees
- Test with different distances

**Files**:
- `backend/lambda/src/endpoints/pharmacy-orders.ts` (enhance `calculateDeliveryFee`)

## Implementation Order

1. **Live Tracking UI** (Start here - highest user impact)
2. **OTP Verification** (Security critical)
3. **Shiprocket Integration** (Logistics critical)
4. **Push Notifications** (User experience)
5. **Proforma Invoice** (Workflow enhancement)
6. **Delivery Charges** (Business logic refinement)

## Testing Checklist

After each implementation:
- [ ] Test order creation
- [ ] Test payment flow
- [ ] Test tracking updates
- [ ] Test OTP verification
- [ ] Test notifications
- [ ] Test Shiprocket integration
- [ ] End-to-end flow test
