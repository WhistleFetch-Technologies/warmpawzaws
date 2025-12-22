# Capability Integration Implementation Plan

## Analysis Summary

### Current State
1. ✅ **Service Catalog**: Filters by `applicableRoles` but NOT by `requiredCapabilities`
2. ✅ **Booking Management**: Basic booking exists but missing capability-based actions
3. ✅ **Service Creation**: No capability validation
4. ✅ **Razorpay Settlement**: Already integrated in `booking-lifecycle-complete.tsx` with real API calls

### Implementation Order

#### Phase 1: Service Catalog Capability Filtering
- Add `useVendorCapabilities` hook to `VendorServiceCatalogView.tsx`
- Filter services by `requiredCapabilities` in `isServiceApplicable()`
- Show unavailable services with capability requirements
- Add capability badges to service cards

#### Phase 2: Booking Integration with Capabilities
- Add capability-based actions to `VendorBookingManagement.tsx`
- Integrate prescription builder with booking detail
- Link medical records to booking history
- Add emergency protocol to booking actions

#### Phase 3: Service Creation Validation
- Add capability validation to `VendorServiceConfigurationScreen.tsx`
- Validate `custom_services` capability before allowing creation
- Validate `package_management` capability before allowing creation
- Check service requirements against capabilities

#### Phase 4: Verify Razorpay Settlement Automation
- Verify end-to-end flow: Booking completion → Settlement → Razorpay payout
- Ensure automated settlement triggers correctly
- Verify payout cron job integration
- Test real API integration

#### Phase 5: Missing Components (if needed)
- Create missing hospitality components
- Create missing specialized components

---

## Implementation Details

### 1. Service Catalog Enhancement

**File**: `src/components/vendor/VendorServiceCatalogView.tsx`

**Changes**:
- Import `useVendorCapabilities` hook
- Add capability check to `isServiceApplicable()`
- Show unavailable services section
- Add capability badges

### 2. Booking Management Enhancement

**File**: `src/components/vendor/VendorBookingManagement.tsx`

**Changes**:
- Import `useVendorCapabilities` hook
- Add capability-based action buttons to booking detail modal
- Integrate prescription builder
- Link medical records
- Add emergency protocol

### 3. Service Configuration Enhancement

**File**: `src/components/vendor/VendorServiceConfigurationScreen.tsx`

**Changes**:
- Import `useVendorCapabilities` hook
- Validate capabilities before service creation
- Show capability requirements
- Disable incompatible options

### 4. Razorpay Settlement Verification

**Files to Check**:
- `booking-lifecycle-complete.tsx` - Settlement creation
- `razorpay-marketplace-payout.tsx` - Payout API
- `payout-cron-job.tsx` - Automated settlement
- `settlement-automation.tsx` - Settlement logic

**Verify**:
- End-to-end flow works
- Real API calls are made
- Error handling is proper
- Retry logic exists

---

## Code Quality Requirements

1. ✅ No hardcoding - Use capability checks, not role checks
2. ✅ No duplicates - Reuse existing hooks and utilities
3. ✅ Production ready - Error handling, loading states, validation
4. ✅ Enterprise grade - Type safety, logging, monitoring
5. ✅ Full lifecycle - Complete flow from creation to settlement

---

## Testing Checklist

- [ ] Service catalog filters by capabilities
- [ ] Booking management shows capability actions
- [ ] Service creation validates capabilities
- [ ] Razorpay settlement works end-to-end
- [ ] Error handling works correctly
- [ ] Loading states work
- [ ] No console errors
- [ ] Type safety maintained

