# Instant Video Calling Flow - Payment Integration Fix

## Issue
The instant tele consultation flow was missing the payment step. Users could join the queue without payment, which violates the required flow.

## Required Flow
1. ✅ List services & service providers
2. ✅ Display problems/needs with filter/search  
3. ✅ List instantly available doctors/nutritionists (staff and solo)
4. ✅ Horizontal scroll with speciality and experience
5. ✅ Schedule check and availability (next 5 min)
6. ✅ Select pet profile
7. ✅ **Make a payment** ← **NOW ADDED**
8. ✅ Assign first available doctor from list
9. ✅ Notify staff/solo/nutritionist
10. ✅ Notification on customer home
11. ✅ Start instant video calling and chat
12. ✅ Complete consulting
13. ✅ Update prescription by vendor
14. ✅ Chat open till next followup date

## Changes Made

### Frontend Changes

#### 1. `TeleConsultationRouter.tsx`
- ✅ Added `instant-payment` step to FlowStep type
- ✅ Added payment state: `paymentCompleted`, `paymentOrderId`
- ✅ Updated flow: `instant-pet` → `instant-payment` → `instant-queue`
- ✅ Added `handlePaymentSuccess` handler
- ✅ Integrated `UniversalPaymentPage` component
- ✅ Pass `paymentOrderId` to `InstantTeleQueue`

#### 2. `InstantTeleQueue.tsx`
- ✅ Added `paymentOrderId` prop
- ✅ Added payment validation before joining queue
- ✅ Pass `paymentOrderId` in join-queue API request
- ✅ Show error if payment not completed

### Backend Changes

#### 3. `instant-tele-queue.ts`
- ✅ Added `paymentOrderId` parameter to join-queue endpoint
- ✅ Added payment validation before creating queue entry
- ✅ Verify payment order exists and is paid
- ✅ Return clear error if payment not found/not paid

## Flow Sequence

### Before Fix:
1. Select Service
2. Select Pet
3. **Join Queue** ❌ (No payment)

### After Fix:
1. Select Service
2. Select Pet
3. **Make Payment** ✅ (NEW)
4. Show Providers
5. Select Provider & Join Queue ✅ (With payment reference)

## Payment Details

- **Payment Type**: Booking
- **Service Style**: tele
- **Category**: vet
- **Vendor**: Platform-level (no specific vendor until assigned)
- **Amount**: Service price
- **Payment Order ID**: Stored and validated before queue join

## Testing

To test the flow:
1. Navigate to tele consultation
2. Select "Instant Consultation"
3. Select a service
4. Select a pet
5. **Payment page should appear** ✅
6. Complete payment
7. Providers list should appear
8. Select provider and join queue
9. Queue join should succeed with payment reference

## Backend Validation

The backend now:
- ✅ Validates `paymentOrderId` exists in `orders` table
- ✅ Verifies payment status is 'paid'
- ✅ Verifies payment belongs to the customer
- ✅ Returns 400 error if payment invalid

## Next Steps

1. ✅ Payment step added to flow
2. ✅ Payment validation in backend
3. ⚠️ **TODO**: Test with real payment gateway
4. ⚠️ **TODO**: Handle payment failure scenarios
5. ⚠️ **TODO**: Link payment order to booking when queue is accepted
