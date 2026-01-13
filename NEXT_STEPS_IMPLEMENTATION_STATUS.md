# Next Steps Implementation Status

## ✅ Completed Steps

### Step 1: Database Migration
- ✅ **Migration 059 Created**: `db/migrations/059_customer_state_management.sql`
- ⏳ **Action Required**: Run migration on database
  ```bash
  psql -h <db-host> -U <db-user> -d <db-name> -f db/migrations/059_customer_state_management.sql
  ```

### Step 2: Backend Implementation
- ✅ **Customer State Utilities Created**: `backend/lambda/src/utils/customer-state.ts`
  - `getCustomerState()` - Get current state
  - `createOrUpdateCustomerIdentity()` - Manage identity records
  - `updateCustomerOnboardingStatus()` - Update onboarding state
  - `isNewCustomer()` - Check if new customer
  - `isOnboardingComplete()` - Check if completed
  - `updateProfileCompletion()` - Track profile completion
  - `getCustomerStateForAuth()` - Get state for auth response

- ✅ **Auth Endpoint Updated**: `backend/lambda/src/endpoints/auth-enhanced.ts`
  - Creates `customer_identity` record on OTP verification
  - Sets proper initial state (status: 'new', onboarding_status: 'PHONE_VERIFIED')
  - Links customer to identity
  - Uses state management to determine new vs existing

- ✅ **Profile Endpoint Updated**: `backend/lambda/src/endpoints/customer-profile.ts`
  - Updates profile completion flags
  - Updates onboarding status when profile is completed
  - Tracks completion progress

## ⏳ Pending Steps

### Step 3: Frontend Updates

#### 3.1 Customer Auth Page
**File**: `apps/customer-web/app/auth/page.tsx`
- [ ] Use `onboarding_status` from API response
- [ ] Route based on state: 'new' → onboarding, 'existing' → dashboard
- [ ] Store state in context/localStorage

#### 3.2 Customer State Helpers
**File**: `apps/customer-web/lib/customer-state.ts` (NEW - TO CREATE)
- [ ] Create state helper functions
- [ ] `getCustomerState()` - Get from API
- [ ] `shouldShowOnboarding()` - Determine if onboarding needed
- [ ] `getNextStep()` - Get next onboarding step

#### 3.3 Customer Context
**File**: `apps/customer-web/context/CustomerContext.tsx`
- [ ] Add `onboarding_status` to context
- [ ] Add state helpers: `isNewCustomer()`, `isOnboarding()`, `isActive()`
- [ ] Update on profile completion

#### 3.4 Onboarding Flow
**File**: `apps/customer-web/components/customer/OnboardingSteps.tsx` (NEW - TO CREATE)
- [ ] Create onboarding component
- [ ] Step 1: Profile (name, email, address)
- [ ] Step 2: Pet Profile (add first pet)
- [ ] Step 3: Preferences (notifications, etc.)
- [ ] Progress tracking based on `onboarding_status`

#### 3.5 Customer Dashboard
**File**: `apps/customer-web/app/page.tsx`
- [ ] Check `onboarding_status` on load
- [ ] Redirect to onboarding if not completed
- [ ] Show completion progress

### Step 4: Testing

#### 4.1 Database Tests
- [ ] Verify migration runs successfully
- [ ] Check existing customers migrated correctly
- [ ] Verify new customers get proper initial state
- [ ] Test state transitions

#### 4.2 Backend Tests
- [ ] Test OTP verification creates customer_identity
- [ ] Test profile completion updates state
- [ ] Test state queries return correct values
- [ ] Test new vs existing detection

#### 4.3 Frontend Tests
- [ ] Test new customers see onboarding flow
- [ ] Test existing customers go to dashboard
- [ ] Test state persists across reloads
- [ ] Test onboarding progress updates

## 🚀 Quick Start Commands

### 1. Run Migration
```bash
# Connect to database
psql -h <db-host> -U <db-user> -d <db-name>

# Run migration
\i db/migrations/059_customer_state_management.sql

# Verify
SELECT status, onboarding_status, profile_completed FROM customers LIMIT 5;
```

### 2. Test Backend
```bash
# Test OTP verification (creates customer_identity)
curl -X POST https://your-api.com/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"phone": "1234567890", "otp": "123456", "role": "customer"}'

# Check customer state
curl -X GET https://your-api.com/customer/profile/1234567890
```

### 3. Deploy Backend
```bash
# Build and deploy Lambda
cd backend/lambda
npm run build
# Deploy via your deployment process
```

### 4. Update Frontend
```bash
# After frontend updates are complete
cd apps/customer-web
npm run build
# Deploy frontend
```

## 📋 Implementation Checklist

### Immediate Actions
- [ ] **Run Migration 059** (Critical - must be done first)
- [ ] **Deploy Backend Changes** (After migration)
- [ ] **Test Backend** (Verify state management works)

### Next Phase
- [ ] **Create Frontend State Helpers**
- [ ] **Update Auth Page**
- [ ] **Update Customer Context**
- [ ] **Create Onboarding Component**
- [ ] **Update Dashboard**

### Final Phase
- [ ] **End-to-End Testing**
- [ ] **Documentation Updates**
- [ ] **Production Deployment**

## 🔍 Verification Queries

### Check Customer State
```sql
SELECT 
  c.id,
  c.phone,
  c.status,
  c.onboarding_status,
  c.profile_completed,
  ci.current_step,
  cpc.is_profile_complete
FROM customers c
LEFT JOIN customer_identity ci ON c.customer_identity_id = ci.id
LEFT JOIN customer_profile_completion cpc ON cpc.customer_id = c.id
WHERE c.phone = '1234567890';
```

### Check New Customers
```sql
SELECT COUNT(*) as new_customers
FROM customers
WHERE onboarding_status IN ('INIT', 'PHONE_VERIFIED')
  AND status = 'new';
```

### Check Completed Customers
```sql
SELECT COUNT(*) as completed_customers
FROM customers
WHERE onboarding_status = 'COMPLETED'
  AND status = 'active';
```

## 📝 Notes

1. **Migration Must Run First**: All backend code depends on the new schema
2. **Backward Compatible**: Existing customers will be migrated automatically
3. **State Transitions**: Use helper functions to ensure valid transitions
4. **Frontend Can Wait**: Backend works independently, frontend updates can be done later

---

**Last Updated**: 2025-01-12
**Status**: Backend Implementation Complete, Migration Pending
**Next Action**: Run Migration 059
