# Fix for handlePartialRefund Bugs

## Bug Analysis

### Bug 1: State reset only happens on success
**Issue**: If `handleAction` returns early due to failure, the state reset code won't execute, leaving modal closed but input fields populated.

### Bug 2: Unconditional state reset
**Issue**: State resets regardless of success/failure, losing user input on failure. Inconsistent with `handleRefund` which preserves modal and inputs on failure.

## Corrected Implementation Pattern

```typescript
const handlePartialRefund = async () => {
  // Validate inputs first
  if (!partialRefundAmount || partialRefundAmount <= 0) {
    toast.error('Please enter a valid refund amount');
    return; // Early return - don't reset state
  }

  if (!partialRefundReason?.trim()) {
    toast.error('Please provide a reason for the partial refund');
    return; // Early return - don't reset state
  }

  try {
    // Call handleAction and await the result
    const success = await handleAction({
      action: 'partial_refund',
      amount: partialRefundAmount,
      reason: partialRefundReason,
      ticketId: selectedTicket?.id
    });

    // ✅ FIX: Only reset state on successful completion
    if (success) {
      // Reset modal state and input fields ONLY on success
      setShowPartialRefundModal(false);
      setPartialRefundAmount('');
      setPartialRefundReason('');
      
      // Refresh ticket data
      await loadTickets();
      toast.success('Partial refund processed successfully');
    } else {
      // ✅ FIX: On failure, keep modal open and preserve inputs
      // This allows user to retry with same values or correct them
      toast.error('Failed to process partial refund. Please try again.');
      // Modal stays open, inputs remain populated
    }
  } catch (error: any) {
    // ✅ FIX: On exception, keep modal open and preserve inputs
    console.error('Error processing partial refund:', error);
    const errorMessage = error?.message || 'Network error. Please check your connection and try again.';
    toast.error(errorMessage);
    // Modal stays open, inputs remain populated
  }
};
```

## Key Fixes Applied

1. **Conditional State Reset**: State reset (lines 578-580 equivalent) only happens inside the `if (success)` block
2. **Preserve State on Failure**: On failure, modal stays open and inputs remain populated (consistent with `handleRefund`)
3. **Early Returns Don't Reset**: Validation failures return early without resetting state
4. **Proper Error Handling**: Try-catch ensures exceptions don't trigger state reset

## Comparison with handleRefund

The `handleRefund` function should follow the same pattern:

```typescript
const handleRefund = async () => {
  // Validate inputs
  if (!refundAmount || refundAmount <= 0) {
    toast.error('Please enter a valid refund amount');
    return; // Don't reset state
  }

  try {
    const success = await handleAction({
      action: 'refund',
      amount: refundAmount,
      ticketId: selectedTicket?.id
    });

    // ✅ Only reset on success
    if (success) {
      setShowRefundModal(false);
      setRefundAmount('');
      await loadTickets();
      toast.success('Refund processed successfully');
    } else {
      // Keep modal open on failure
      toast.error('Failed to process refund. Please try again.');
    }
  } catch (error: any) {
    console.error('Error processing refund:', error);
    toast.error(error?.message || 'Network error. Please try again.');
    // Modal stays open
  }
};
```

## Implementation Checklist

- [ ] Move state reset code inside success condition
- [ ] Remove unconditional state reset after `handleAction` call
- [ ] Add early return for validation without state reset
- [ ] Ensure modal stays open on failure
- [ ] Ensure inputs remain populated on failure
- [ ] Add proper error handling with try-catch
- [ ] Test with successful refund
- [ ] Test with failed refund (Razorpay API error)
- [ ] Test with validation errors
- [ ] Verify consistency with `handleRefund` behavior

