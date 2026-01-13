# Customer & Vendor State Schema Analysis

## Summary

**Vendors**: ✅ **HAS COMPREHENSIVE STATE MANAGEMENT**
**Customers**: ❌ **MISSING STATE FIELDS** (Fixed in Migration 059)

## Current State

### Vendors - Complete State Management ✅

Vendors have comprehensive state tracking:

#### 1. **vendors.status** (Main Status)
```sql
status TEXT CHECK (status IN (
  'new', 
  'onboarding', 
  'pending', 
  'approved', 
  'rejected', 
  'active', 
  'suspended', 
  'inactive'
))
```

#### 2. **vendors.onboarding_status** (Onboarding State Machine)
```sql
onboarding_status TEXT CHECK (onboarding_status IN (
  'INIT',
  'ROLE_PENDING',
  'FORM_PENDING',
  'UNDER_REVIEW',
  'CLARIFICATION_REQUIRED',
  'APPROVED',
  'REJECTED',
  'ACTIVATED'
))
```

#### 3. **vendor_identity** Table
- Tracks OTP/auth state
- Stores onboarding progress
- Links to vendors table

#### 4. **vendor_setup_completion** Table
- Tracks post-activation setup
- Flags: profile_completed, bank_account_completed, etc.
- Gates go-live status

#### 5. **Additional Fields**
- `is_active` BOOLEAN
- `setup_completed` BOOLEAN
- `vendor_identity_id` UUID (FK to vendor_identity)
- `vendor_type` TEXT ('solo', 'business')

### Customers - Missing State Fields ❌

**Before Migration 059:**
- ❌ No `status` field
- ❌ No `onboarding_status` field
- ❌ No `customer_identity` table
- ❌ No profile completion tracking
- ✅ Only has `is_active` BOOLEAN
- ✅ Only has `last_login_at` TIMESTAMPTZ

**After Migration 059:**
- ✅ Added `status` field
- ✅ Added `onboarding_status` field
- ✅ Added `customer_identity` table
- ✅ Added `customer_profile_completion` table
- ✅ Added `profile_completed` flag
- ✅ Added `customer_identity_id` FK

## Migration 059: Customer State Management

### What It Adds

1. **customers.status**
   - Values: 'new', 'onboarding', 'active', 'inactive', 'suspended'
   - Tracks account lifecycle

2. **customers.onboarding_status**
   - Values: 'INIT', 'PHONE_VERIFIED', 'PROFILE_PENDING', 'PET_PENDING', 'PREFERENCES_PENDING', 'COMPLETED'
   - Tracks onboarding progress

3. **customers.profile_completed**
   - Boolean flag for profile completion
   - Auto-set based on data completeness

4. **customer_identity** Table
   - Similar to vendor_identity
   - Tracks OTP/auth state
   - Stores onboarding progress

5. **customer_profile_completion** Table
   - Tracks detailed completion status
   - Flags: basic_info, address, pet_profile, preferences
   - Gates full platform access

### State Flow

#### Customer Onboarding States:
```
INIT → PHONE_VERIFIED → PROFILE_PENDING → PET_PENDING → PREFERENCES_PENDING → COMPLETED
```

#### Customer Status:
```
new → onboarding → active
                ↓
            inactive (if no activity)
            suspended (if flagged)
```

## Comparison Table

| Feature | Vendors | Customers (Before) | Customers (After) |
|---------|---------|-------------------|-------------------|
| Main Status Field | ✅ | ❌ | ✅ |
| Onboarding Status | ✅ | ❌ | ✅ |
| Identity Table | ✅ | ❌ | ✅ |
| Profile Completion | ✅ | ❌ | ✅ |
| Setup Completion | ✅ | N/A | N/A |
| is_active Flag | ✅ | ✅ | ✅ |
| last_login_at | ✅ | ✅ | ✅ |

## Usage Examples

### Check Customer State
```sql
SELECT 
  c.id,
  c.phone,
  c.status,
  c.onboarding_status,
  c.profile_completed,
  ci.current_step
FROM customers c
LEFT JOIN customer_identity ci ON c.customer_identity_id = ci.id
WHERE c.phone = '1234567890';
```

### Check Vendor State
```sql
SELECT 
  v.id,
  v.phone,
  v.status,
  v.onboarding_status,
  v.setup_completed,
  vi.current_step
FROM vendors v
LEFT JOIN vendor_identity vi ON v.vendor_identity_id = vi.id
WHERE v.phone = '1234567890';
```

### Determine New vs Existing User
```sql
-- Customer
SELECT 
  CASE 
    WHEN onboarding_status = 'INIT' OR onboarding_status = 'PHONE_VERIFIED' THEN 'new'
    WHEN onboarding_status = 'COMPLETED' THEN 'existing'
    ELSE 'onboarding'
  END as user_state
FROM customers
WHERE phone = '1234567890';

-- Vendor
SELECT 
  CASE 
    WHEN onboarding_status = 'INIT' OR onboarding_status = 'ROLE_PENDING' THEN 'new'
    WHEN onboarding_status = 'ACTIVATED' THEN 'existing'
    ELSE 'onboarding'
  END as user_state
FROM vendors
WHERE phone = '1234567890';
```

## Recommendations

1. **Run Migration 059**: Adds proper state management for customers
2. **Update Auth Logic**: Use `onboarding_status` to determine new vs existing
3. **Update Frontend**: Use state fields to route users correctly
4. **Add State Transitions**: Create functions to manage state transitions (similar to vendors)

## Files

- **Migration**: `db/migrations/059_customer_state_management.sql`
- **Analysis**: This document

---

**Date**: 2025-01-12
**Status**: ✅ Migration Created
**Action Required**: Run migration 059 to add customer state fields
