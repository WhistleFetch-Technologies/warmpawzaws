# Delivery Flow - Complete Testing Guide
## End-to-End Testing for DeliveryBookingFlow

**Date:** 2025  
**Status:** Ready for Testing  
**Component:** `DeliveryBookingFlow.tsx`

---

## Pre-Testing Setup

### Environment Setup
- [ ] Application running (dev server)
- [ ] Browser dev tools open (Console + Network tabs)
- [ ] Test accounts ready
- [ ] Razorpay test keys configured
- [ ] Test vendor accounts ready
- [ ] Test customer accounts ready

### Test Data Required
- [ ] Customer phone: `9876543210` (or your test account)
- [ ] Customer ID: Available
- [ ] Pharmacy vendor ID
- [ ] Product store vendor ID
- [ ] Nutritionist vendor ID (for meals)
- [ ] At least 1 saved address
- [ ] Test products available

---

## Test 1: Pharmacy Delivery Flow

### Setup
**Service Type:** `pharmacy`  
**Vendor:** Pharmacy vendor  
**Items:** Prescription medicines

### Test Steps

#### Step 1: Select Items
1. Navigate to pharmacy delivery
2. Browse products
3. Add prescription medicines to cart
4. Verify cart summary displays

**Verification:**
- [ ] Products load correctly
- [ ] Search works
- [ ] Add to cart works
- [ ] Quantity management works
- [ ] Prescription required indicator shows
- [ ] Cart summary displays correctly

---

#### Step 2: Address Selection
1. Click "Proceed to Delivery"
2. View saved addresses
3. Select an address OR add new address
4. Click "Continue"

**Verification:**
- [ ] Saved addresses load
- [ ] Address selection works
- [ ] Add address form works
- [ ] Address validation works
- [ ] Continue button appears when address selected

---

#### Step 3: Prescription Upload
1. Verify prescription step appears (if prescription items in cart)
2. Upload prescription (image/PDF)
3. Verify upload status
4. Click "Continue to Time Slot"

**Verification:**
- [ ] Prescription step appears (conditional)
- [ ] File upload works
- [ ] Upload status displays
- [ ] Continue button appears after upload

---

#### Step 4: Time Slot Selection
1. View available time slots
2. Select a time slot
3. Click "Continue to Review"

**Verification:**
- [ ] Time slots load
- [ ] Selection works
- [ ] Continue button appears

---

#### Step 5: Review Order
1. Verify order summary
2. Verify address confirmation
3. Verify time slot confirmation
4. Verify price breakdown
5. Click "Proceed to Payment"

**Verification:**
- [ ] Order summary displays correctly
- [ ] All items listed
- [ ] Address confirmed
- [ ] Time slot confirmed
- [ ] Price breakdown accurate
- [ ] Prescription status shown (if applicable)

---

#### Step 6: Payment (Razorpay)
1. Select "Online Payment" (Razorpay)
2. Click "Pay ₹X"
3. Complete Razorpay checkout
4. Verify payment success

**Verification:**
- [ ] Payment method selection works
- [ ] Razorpay script loads
- [ ] Razorpay checkout opens
- [ ] Payment completion works
- [ ] Payment verification works
- [ ] Order created after payment

**Expected API Calls:**
- `POST /ecommerce/payments/initiate` ✅
- Razorpay checkout opens ✅
- `POST /ecommerce/payments/verify` ✅
- `POST /vet/medicine-order` ✅

---

#### Step 7: Confirmation
1. Verify success message
2. Verify order ID display
3. Verify order details
4. Click "Track Order" or "Back to Home"

**Verification:**
- [ ] Success message displays
- [ ] Order ID shown
- [ ] Order details correct
- [ ] Navigation works

---

### Test 6b: Payment (COD)
1. Select "Cash on Delivery"
2. Click "Pay ₹X"
3. Verify order created

**Verification:**
- [ ] COD selection works
- [ ] Order created directly
- [ ] Status: `pending`
- [ ] No payment ID

---

## Test 2: Product Store Delivery Flow

### Setup
**Service Type:** `products`  
**Vendor:** Product store vendor  
**Items:** Regular products

### Test Steps
1. ✅ Step 1: Select Items (no prescription required)
2. ✅ Step 2: Address Selection
3. ⚠️ Step 3: Prescription Upload (should NOT appear)
4. ✅ Step 4: Time Slot Selection
5. ✅ Step 5: Review Order
6. ✅ Step 6: Payment
7. ✅ Step 7: Confirmation

**Verification:**
- [ ] Prescription step skipped (no prescription items)
- [ ] Order created via `/ecommerce/orders/create`
- [ ] All other steps work correctly

---

## Test 3: Meal Products Delivery Flow

### Setup
**Service Type:** `meals`  
**Vendor:** Nutritionist vendor  
**Items:** Meal products

### Test Steps
1. ✅ Step 1: Select Items (with dietary filters)
2. ✅ Step 2: Address Selection
3. ⚠️ Step 3: Prescription Upload (should NOT appear)
4. ✅ Step 4: Time Slot Selection
5. ✅ Step 5: Review Order
6. ✅ Step 6: Payment
7. ✅ Step 7: Confirmation

**Verification:**
- [ ] Dietary filters work
- [ ] Meal products display correctly
- [ ] Order created via `/ecommerce/orders/create`
- [ ] Service type: `meals`

---

## Test 4: Error Scenarios

### Network Error
1. Disconnect network
2. Try to proceed through steps
3. Verify error handling

**Verification:**
- [ ] Error messages display
- [ ] User can retry
- [ ] No data loss

### Payment Failure
1. Use test card that fails
2. Complete payment
3. Verify error handling

**Verification:**
- [ ] Payment failure handled
- [ ] Error message displays
- [ ] User can retry
- [ ] Order not created on failure

### Validation Errors
1. Try to proceed without required fields
2. Verify validation

**Verification:**
- [ ] Validation errors display
- [ ] Cannot proceed without required fields
- [ ] Clear error messages

---

## Test 5: Integration Testing

### BookingFlowDispatcher Integration
1. Navigate via BookingFlowDispatcher
2. Verify DeliveryBookingFlow renders
3. Verify props passed correctly

**Verification:**
- [ ] Component renders correctly
- [ ] Service type mapping works
- [ ] Navigation works
- [ ] Callbacks triggered

### Backend Integration
1. Monitor Network tab
2. Verify all API calls
3. Verify responses

**Verification:**
- [ ] All endpoints called correctly
- [ ] Responses handled correctly
- [ ] Error responses handled

---

## Test Results Template

### Test Case: [Number] - [Name]
**Date:** [Date]  
**Tester:** [Name]  
**Result:** ✅ PASS / ❌ FAIL / ⚠️ PARTIAL

**Setup:**
[Brief description]

**Steps Executed:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Results:**
- [ ] All steps completed
- [ ] No errors
- [ ] Order created
- [ ] Payment processed

**Issues Found:**
- [Issue 1]
- [Issue 2]

**Screenshots:**
[If applicable]

**Notes:**
[Additional notes]

---

## Success Criteria

### All Tests Pass If:
- ✅ All 7 steps work for all service types
- ✅ Payment integration works (Razorpay/COD)
- ✅ Order creation works
- ✅ Error handling works
- ✅ No console errors
- ✅ User experience smooth

### Ready for Production If:
- ✅ All test cases pass
- ✅ No critical issues
- ✅ Payment gateway stable
- ✅ Backend integration stable
- ✅ Error handling robust

---

## Quick Test Commands

### Test Razorpay Script Load
```javascript
// In browser console
console.log('Razorpay loaded:', !!window.Razorpay);
```

### Test Payment Initiation
```javascript
// Monitor network tab for:
// POST /ecommerce/payments/initiate
```

### Test Payment Verification
```javascript
// Monitor network tab for:
// POST /ecommerce/payments/verify
```

---

## Common Issues & Solutions

### Issue 1: Razorpay Script Not Loading
**Symptom:** Payment button disabled, "Loading Payment Gateway..."  
**Check:**
- Network tab for script load
- Console for errors
- Razorpay key configured

**Fix:**
- Verify Razorpay key in env
- Check script URL
- Verify network connection

---

### Issue 2: Payment Verification Fails
**Symptom:** Payment completes but verification fails  
**Check:**
- Network tab for verify endpoint
- Console for errors
- Signature verification

**Fix:**
- Verify backend signature verification
- Check payment ID
- Verify Razorpay keys

---

### Issue 3: Order Not Created
**Symptom:** Payment succeeds but order not created  
**Check:**
- Network tab for order creation
- Console for errors
- Backend logs

**Fix:**
- Verify order endpoint
- Check order data
- Verify backend logic

---

## Time Estimate

| Test | Time | Priority |
|------|------|----------|
| Test 1: Pharmacy Flow | 30 min | HIGH |
| Test 2: Product Flow | 20 min | HIGH |
| Test 3: Meal Flow | 20 min | HIGH |
| Test 4: Error Scenarios | 20 min | MEDIUM |
| Test 5: Integration | 15 min | MEDIUM |
| **TOTAL** | **~2 hours** | |

---

## Next Steps After Testing

### If All Tests Pass:
1. ✅ Document results
2. ✅ Proceed with other tasks
3. ✅ Deploy to production

### If Issues Found:
1. ⚠️ Document all issues
2. ⚠️ Prioritize fixes
3. ⚠️ Fix critical issues first
4. ⚠️ Re-test after fixes

---

## Ready to Start?

1. ✅ Review this guide
2. ✅ Set up test environment
3. ✅ Prepare test data
4. ✅ Start with Test 1
5. ✅ Document results as you go

**Good luck with testing!** 🚀

