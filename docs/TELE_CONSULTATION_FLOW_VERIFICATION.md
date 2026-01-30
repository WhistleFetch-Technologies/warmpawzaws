# Tele Consultation Flow Verification

## Flow Overview

### Instant Tele Consultation Flow
1. **Service Selection** (`instant-service`)
   - User selects a tele consultation service
   - Handler: `handleSelectInstantService` → sets `selectedService`, moves to `instant-pet`

2. **Pet Selection** (`instant-pet`)
   - User selects a pet
   - Handler: `handleSelectPet` → loads providers, sets `selectedPet`, moves to `instant-provider`

3. **Provider Selection** (`instant-provider`)
   - User can choose:
     - **Auto-Assign**: Fastest option, assigns next available provider
     - **Specific Provider**: Select from available providers list
   - Handler: `handleSelectProviderForInstant` → sets `selectedProvider` and `autoAssignProvider`, moves to `instant-payment`

4. **Payment** (`instant-payment`)
   - **If Specific Provider Selected**:
     - `type="booking"` → Creates booking directly
     - Passes: `vendorId`, `vendorName`, `staffId`, `staffName`, `staffPhoto`
   - **If Auto-Assign Selected**:
     - `type="order"` → Creates order (will be converted to booking when provider accepts)
     - Uses platform vendor info
   - Handler: `handlePaymentSuccess` → receives `bookingId` and `orderId`

5. **Post-Payment Navigation**
   - **If Specific Provider**:
     - `handlePaymentSuccess` → Navigates directly to `video-call` with `bookingId`
   - **If Auto-Assign**:
     - `handlePaymentSuccess` → Sets `paymentOrderId`, moves to `instant-queue`
     - Queue component should auto-join with `paymentOrderId`

6. **Queue** (`instant-queue`) - Only for Auto-Assign
   - Receives `paymentOrderId` prop
   - Should automatically join queue for next available provider
   - Handler: `handleQueueAccepted` → Navigates to `video-call` when provider accepts

## Issues Found

### Issue 1: Auto-Assign Queue Join
**Problem**: When auto-assign is selected, user goes to queue but still needs to manually select a provider and click "Join Queue".

**Expected**: For auto-assign flow, queue should automatically join without requiring provider selection.

**Current Behavior**:
- `InstantTeleQueue` component shows provider list
- User must manually select a provider and click "Join Queue"
- This defeats the purpose of "auto-assign"

**Required Fix**:
- When `paymentOrderId` is present AND it's an auto-assign flow, automatically join queue
- Backend should accept `staffId: null` or a special flag for auto-assign
- Or automatically select the first available provider and join

### Issue 2: Payment Order ID Handling
**Current**: `handlePaymentSuccess` sets `paymentOrderId = orderId || bookingId || null`

**Issue**: For specific provider, `bookingId` is set, but we navigate away immediately. For auto-assign, `orderId` should be used.

**Fix**: Should be:
```typescript
if (selectedProvider && !autoAssignProvider) {
  // Specific provider: booking created
  onNavigate('video-call', { bookingId });
} else {
  // Auto-assign: order created
  setPaymentOrderId(orderId); // Use orderId, not bookingId
  setStep('instant-queue');
}
```

### Issue 3: Queue Component Provider Selection
**Current**: `InstantTeleQueue` always shows provider list and requires selection.

**For Auto-Assign**: Should either:
1. Auto-join without showing provider list
2. Show "Waiting for next available provider" message
3. Automatically select first available provider and join

## Verification Checklist

### ✅ Working Correctly
- [x] Service selection → Pet selection flow
- [x] Pet selection → Provider selection flow
- [x] Provider selection → Payment flow
- [x] Payment page receives correct props (vendorId, staffId, etc.)
- [x] Payment success handler receives bookingId/orderId
- [x] Specific provider → Direct navigation to video call
- [x] Back navigation through all steps
- [x] State management (selectedService, selectedPet, selectedProvider, autoAssignProvider)

### ⚠️ Needs Fix
- [ ] Auto-assign queue auto-join logic
- [ ] Payment order ID handling (use orderId for auto-assign, not bookingId)
- [ ] Queue component auto-join when paymentOrderId present

### ❓ To Verify
- [ ] Backend accepts null staffId for auto-assign
- [ ] Backend converts order to booking when provider accepts
- [ ] Video call navigation works correctly
- [ ] Notification system triggers correctly

## Recommended Fixes

### Fix 1: Update handlePaymentSuccess
```typescript
const handlePaymentSuccess = (bookingId: string, orderId?: string) => {
  setPaymentCompleted(true);
  
  if (selectedProvider && !autoAssignProvider) {
    // Specific provider: booking created, navigate directly
    onNavigate('video-call', { bookingId });
  } else {
    // Auto-assign: order created, use orderId for queue
    setPaymentOrderId(orderId || null); // ✅ Use orderId, not bookingId
    setStep('instant-queue');
  }
};
```

### Fix 2: Add Auto-Join Logic to InstantTeleQueue
```typescript
// In InstantTeleQueue component
useEffect(() => {
  // Auto-join queue if paymentOrderId is present and no provider selected
  if (paymentOrderId && !queueStatus && providers.length > 0) {
    // Auto-select first available provider and join
    const firstProvider = providers[0];
    if (firstProvider) {
      joinQueue(firstProvider);
    }
  }
}, [paymentOrderId, providers, queueStatus]);
```

### Fix 3: Backend Support for Auto-Assign
- Backend should accept `staffId: null` or `autoAssign: true` flag
- Backend should assign next available provider automatically
