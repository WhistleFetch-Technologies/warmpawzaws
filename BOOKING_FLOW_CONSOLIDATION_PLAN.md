# Booking Flow Consolidation Plan
## Option 3: Hybrid Approach - Step 2

**Date:** 2025  
**Status:** Planning Phase  
**Priority:** HIGH

---

## Current State Analysis

### Duplicate Booking Flow Components Found

1. **`VetBookingFlow.tsx`** (`src/components/customer/vet/VetBookingFlow.tsx`)
   - **Purpose:** Basic vet booking flow
   - **Steps:** selection → timeslot → address → payment → success
   - **Service Types:** Handles vet services (center/home)
   - **Status:** Active, used by VetServiceRouter

2. **`CenterBookingFlowEnhanced.tsx`** (`src/components/customer/CenterBookingFlowEnhanced.tsx`)
   - **Purpose:** Enhanced center booking flow
   - **Steps:** service selection → doctor/staff → time → payment → confirmation
   - **Service Types:** Handles center-based services
   - **Status:** Active, used by various routers

3. **`BookingFlowDispatcher.tsx`** (`src/components/customer/BookingFlowDispatcher.tsx`)
   - **Purpose:** NEW unified dispatcher (placeholder)
   - **Current State:** Only routes to other screens via `onNavigate`, doesn't render components
   - **Status:** Created but not integrated

4. **`VetBookingRouter.tsx`** (if exists)
   - **Purpose:** Enhanced vet booking router
   - **Status:** Need to verify

5. **`CenterBookingPage.tsx`** (if exists)
   - **Purpose:** Center booking page
   - **Status:** Need to verify

---

## Consolidation Strategy

### Phase 1: Enhance BookingFlowDispatcher (Current Task)

**Goal:** Make `BookingFlowDispatcher` actually render booking flow components instead of just routing

**Steps:**
1. Import actual booking flow components
2. Add conditional rendering based on service style and type
3. Pass all necessary props to child components
4. Handle navigation and state management
5. Test with one flow (vet center booking)

**Files to Modify:**
- `src/components/customer/BookingFlowDispatcher.tsx` - Enhance to render components

---

### Phase 2: Migrate VetBookingFlow

**Goal:** Replace `VetBookingFlow` usage with `BookingFlowDispatcher`

**Steps:**
1. Update `VetServiceRouter.tsx` to use `BookingFlowDispatcher`
2. Test vet booking flow
3. Deprecate `VetBookingFlow.tsx` (keep for reference)

**Files to Modify:**
- `src/components/customer/VetServiceRouter.tsx` - Use dispatcher
- `src/components/customer/vet/VetBookingFlow.tsx` - Mark as deprecated

---

### Phase 3: Migrate CenterBookingFlowEnhanced

**Goal:** Replace `CenterBookingFlowEnhanced` usage with `BookingFlowDispatcher`

**Steps:**
1. Update routers using `CenterBookingFlowEnhanced` to use `BookingFlowDispatcher`
2. Test center booking flow
3. Deprecate `CenterBookingFlowEnhanced.tsx`

**Files to Modify:**
- All service routers using `CenterBookingFlowEnhanced`
- `src/components/customer/CenterBookingFlowEnhanced.tsx` - Mark as deprecated

---

## Implementation Plan

### Step 1: Enhance BookingFlowDispatcher (In Progress)

**Current Implementation:**
- Only routes via `onNavigate`
- Doesn't render actual components
- Shows loading state

**Target Implementation:**
- Import and conditionally render actual booking flow components
- Handle all service styles (at_center, at_home, tele, delivery, package)
- Pass props correctly
- Manage state internally

**Components to Import:**
- `VetBookingRouter` (for vet center bookings)
- `VetServiceBooking` (for vet service selection)
- `VetTimeSlotSelection` (for time slot selection)
- `VetAddressSelector` (for home services)
- `VetPaymentScreen` (for payment)
- `VetBookingSuccess` (for success)
- Similar components for other service types

---

## Next Steps

1. ✅ Analyze current booking flows
2. ⚠️ Enhance BookingFlowDispatcher to render components
3. ⚠️ Test with vet center booking
4. ⚠️ Migrate VetBookingFlow usage
5. ⚠️ Migrate CenterBookingFlowEnhanced usage
6. ⚠️ Update all service routers

---

## Notes

- Maintain backward compatibility during migration
- Test each flow after migration
- Keep old components until migration is complete
- Document deprecation timeline

