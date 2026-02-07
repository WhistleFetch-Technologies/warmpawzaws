# Tele Consultation Flow Testing Guide

## Quick Start

### 1. Start Development Server
```bash
cd apps/customer-web
npm run dev
```

The app will be available at: `http://localhost:3001`

### 2. Navigate to Tele Consultation
- Go to the customer home page
- Click on "Tele Consultation" button
- Or navigate directly to: `/vet-tele-consultation`

## Test Scenarios

### Test 1: Specific Provider Flow
**Goal**: Verify booking is created directly for selected provider

**Steps**:
1. Select "Instant Consultation"
2. Choose a service (e.g., "General Consultation")
3. Select a pet
4. **Select a specific provider** from the list
5. Click "Continue to Payment"
6. Complete payment
7. **Expected**: Should navigate directly to video call (no queue step)

**Verification Points**:
- ✅ Provider selection shows provider details
- ✅ Payment page shows selected provider info
- ✅ Payment creates booking (not order)
- ✅ Navigates directly to video call after payment
- ✅ No queue step appears

### Test 2: Auto-Assign Flow
**Goal**: Verify order is created and queue auto-joins

**Steps**:
1. Select "Instant Consultation"
2. Choose a service
3. Select a pet
4. **Select "Auto-Assign"** option
5. Click "Continue to Payment"
6. Complete payment
7. **Expected**: Should show queue step and auto-join

**Verification Points**:
- ✅ Auto-assign option is visible and selectable
- ✅ Payment page shows "Tele Consultation Service" (platform)
- ✅ Payment creates order (not booking)
- ✅ Queue step appears after payment
- ✅ Queue automatically joins with first available provider
- ✅ Shows "Waiting for vet" message
- ✅ Navigates to video call when provider accepts

### Test 3: Back Navigation
**Goal**: Verify back button works through all steps

**Steps**:
1. Navigate through: Service → Pet → Provider → Payment
2. Click back button at each step
3. **Expected**: Should go back to previous step correctly

**Verification Points**:
- ✅ Back from payment → Provider selection
- ✅ Back from provider → Pet selection
- ✅ Back from pet → Service selection
- ✅ Back from service → Mode selection
- ✅ State is cleared appropriately

### Test 4: Edge Cases

#### 4a. Missing Pet
- Try to proceed without selecting pet
- **Expected**: Should show error or prevent navigation

#### 4b. No Providers Available
- If no providers are available
- **Expected**: Should show appropriate message

#### 4c. Payment Failure
- Simulate payment failure
- **Expected**: Should show error and allow retry

#### 4d. Queue Already Joined
- Join queue, then try to join again
- **Expected**: Should detect existing queue entry

## Console Checks

Open browser DevTools Console and check for:

### Expected Logs
- `[TeleQueue] Auto-joining queue for auto-assign flow with provider: ...` (for auto-assign)
- `Joined queue: <queueId>` (when queue is joined)
- No errors related to navigation or state management

### Error Checks
- ❌ No "Cannot read property" errors
- ❌ No navigation errors
- ❌ No state management errors
- ❌ No API errors (unless expected)

## Network Checks

Open browser DevTools Network tab:

### Expected API Calls

#### For Specific Provider:
1. `GET /customer/tele/available-providers` (when pet selected)
2. `POST /customer/payment` (creates booking)
3. `GET /customer/bookings/{bookingId}` (navigates to video call)

#### For Auto-Assign:
1. `GET /customer/tele/available-providers` (when pet selected)
2. `POST /customer/payment` (creates order)
3. `POST /customer/tele/join-queue` (auto-joins queue)
4. `GET /customer/tele/queue-status/{queueId}` (checks status)
5. `GET /customer/bookings/{bookingId}` (when accepted)

## Visual Checks

### Provider Selection Screen
- ✅ Shows "Auto-Assign" option with green badge
- ✅ Shows provider list with details
- ✅ Selected provider has orange border
- ✅ "Continue to Payment" button enabled when selection made

### Payment Screen
- ✅ Shows correct provider/vendor name
- ✅ Shows service details
- ✅ Shows pet details
- ✅ Payment amount is correct

### Queue Screen (Auto-Assign)
- ✅ Shows "Waiting for vet" message
- ✅ Shows queue position (if available)
- ✅ Shows provider info when accepted
- ✅ "Start Video Call" button appears when accepted

## State Verification

Check React DevTools (if available):
- `selectedService` - Set after service selection
- `selectedPet` - Set after pet selection
- `selectedProvider` - Set after provider selection (or null for auto-assign)
- `autoAssignProvider` - true for auto-assign, false for specific provider
- `paymentOrderId` - Set after payment for auto-assign flow
- `paymentCompleted` - true after successful payment

## Common Issues & Solutions

### Issue: Queue doesn't auto-join
**Check**:
- Is `paymentOrderId` set correctly?
- Are providers loaded?
- Check console for errors
- Verify `selectedServiceId` is set

### Issue: Navigation doesn't work
**Check**:
- Is `onNavigate` prop passed correctly?
- Check console for navigation errors
- Verify booking/order ID is received

### Issue: Payment creates wrong type
**Check**:
- Is `autoAssignProvider` state correct?
- Is `selectedProvider` set correctly?
- Check payment page `type` prop

## Success Criteria

✅ **All test scenarios pass**
✅ **No console errors**
✅ **Navigation works smoothly**
✅ **State managed correctly**
✅ **API calls are correct**
✅ **UI/UX is smooth**

## Next Steps After Testing

1. Document any issues found
2. Fix bugs if any
3. Deploy to staging for further testing
4. Get user feedback
