# Implementation Plan: Customer State Management

## Overview
This plan outlines the steps to implement proper customer state management using the new database schema fields.

## Step 1: Run Database Migration ✅

### Execute Migration 059
```bash
# Connect to your database and run:
psql -h <db-host> -U <db-user> -d <db-name> -f db/migrations/059_customer_state_management.sql
```

Or via your migration tool:
```bash
npm run migrate  # or your migration command
```

**Verify Migration:**
```sql
-- Check if columns exist
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'customers'
  AND column_name IN ('status', 'onboarding_status', 'profile_completed', 'customer_identity_id');

-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('customer_identity', 'customer_profile_completion');
```

## Step 2: Update Authentication Endpoints

### 2.1 Update Customer OTP Verification
**File**: `backend/lambda/src/endpoints/auth-enhanced.ts`

**Changes Needed:**
- Create/update `customer_identity` record on OTP verification
- Set proper `onboarding_status` based on customer data
- Return state in response

### 2.2 Update Customer Profile Endpoints
**File**: `backend/lambda/src/endpoints/customer-profile.ts`

**Changes Needed:**
- Update `onboarding_status` when profile is completed
- Update `customer_profile_completion` table
- Set `profile_completed` flag

## Step 3: Update Frontend State Detection

### 3.1 Customer Web Auth Page
**File**: `apps/customer-web/app/auth/page.tsx`

**Changes Needed:**
- Use `onboarding_status` from API response
- Route based on state: 'new' → onboarding, 'existing' → dashboard

### 3.2 Customer Context/Provider
**File**: `apps/customer-web/context/CustomerContext.tsx`

**Changes Needed:**
- Store `onboarding_status` in context
- Provide state helpers: `isNewCustomer()`, `isOnboarding()`, `isActive()`

## Step 4: Create State Helper Functions

### 4.1 Backend State Helpers
**File**: `backend/lambda/src/utils/customer-state.ts` (NEW)

**Functions Needed:**
- `getCustomerState(customerId)` - Get current state
- `updateOnboardingStatus(customerId, status)` - Update state
- `isNewCustomer(customerId)` - Check if new
- `isOnboardingComplete(customerId)` - Check if completed

### 4.2 Frontend State Helpers
**File**: `apps/customer-web/lib/customer-state.ts` (NEW)

**Functions Needed:**
- `getCustomerState()` - Get from context/API
- `shouldShowOnboarding()` - Determine if onboarding needed
- `getNextStep()` - Get next onboarding step

## Step 5: Update Onboarding Flow

### 5.1 Create Onboarding Steps Component
**File**: `apps/customer-web/components/customer/OnboardingSteps.tsx` (NEW)

**Features:**
- Step 1: Profile (name, email, address)
- Step 2: Pet Profile (add first pet)
- Step 3: Preferences (notifications, etc.)
- Progress tracking based on `onboarding_status`

### 5.2 Update Customer Dashboard
**File**: `apps/customer-web/app/page.tsx`

**Changes:**
- Check `onboarding_status` on load
- Redirect to onboarding if not completed
- Show completion progress

## Step 6: Testing Checklist

### Database Tests
- [ ] Migration runs successfully
- [ ] Existing customers migrated correctly
- [ ] New customers get proper initial state
- [ ] State transitions work correctly

### Backend Tests
- [ ] OTP verification creates customer_identity
- [ ] Profile completion updates state
- [ ] State queries return correct values
- [ ] New vs existing detection works

### Frontend Tests
- [ ] New customers see onboarding flow
- [ ] Existing customers go to dashboard
- [ ] State persists across page reloads
- [ ] Onboarding progress updates correctly

## Step 7: Documentation Updates

### 7.1 API Documentation
- Document new state fields in API responses
- Add state transition examples
- Update authentication flow docs

### 7.2 Frontend Documentation
- Document onboarding flow
- Add state management guide
- Update routing logic docs

## Implementation Order

1. ✅ **Step 1**: Run migration (do this first)
2. **Step 2**: Update backend auth endpoints
3. **Step 4**: Create state helper functions
4. **Step 3**: Update frontend state detection
5. **Step 5**: Update onboarding flow
6. **Step 6**: Test everything
7. **Step 7**: Update documentation

## Quick Start Commands

```bash
# 1. Run migration
psql -f db/migrations/059_customer_state_management.sql

# 2. Verify migration
psql -c "SELECT status, onboarding_status FROM customers LIMIT 5;"

# 3. Test new customer creation
# (Will be done via API after backend updates)
```

---

**Status**: Ready for implementation
**Priority**: High (required for proper state management)
**Estimated Time**: 2-3 hours
