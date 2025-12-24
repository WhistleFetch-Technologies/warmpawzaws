# 🔧 CUSTOMER PROFILE PERSISTENCE FIX

## 🚨 CRITICAL ISSUE FIXED

**Problem:** Customer profile was not persistent. After creating a profile with phone number 9611377119, the system was redirecting to signup page again instead of recognizing the customer as existing.

**Root Causes:**
1. Customer profile POST endpoint didn't mark onboarding as complete
2. OTP verify endpoint didn't return `onboardingComplete` field
3. Frontend checks `hasCompletedOnboarding` and redirects to signup if false/undefined
4. Phone number normalization issues in profile lookup

---

## ✅ FIXES APPLIED

### Fix 1: OTP Verify Endpoint - Add onboardingComplete
**File:** `supabase/functions/make-server-3dd53475/customer-routes.tsx`

**Changes:**
- Added logic to determine if onboarding is complete based on:
  - `journey_stage` is set (not null/empty)
  - OR customer has `full_name` and `email` (profile completed)
- Added `onboardingComplete` field to customer response
- Ensured `petIds` is always an array

**Code:**
```typescript
// Determine onboarding status
const hasFullName = customer.full_name && customer.full_name.trim() !== '' && customer.full_name !== 'Customer';
const hasEmail = customer.email && customer.email.trim() !== '';
const hasJourneyStage = customer.journey_stage && customer.journey_stage.trim() !== '';
const onboardingComplete = hasJourneyStage || (hasFullName && hasEmail);

// Add to customer response
const customerResponse = {
  ...customer,
  onboardingComplete,
  petIds: customer.id ? await getPetsRepository().findByCustomer(customer.id).then(pets => pets.map(p => p.id)).catch(() => []) : []
};
```

### Fix 2: Customer Profile POST - Mark Onboarding Complete
**File:** `supabase/functions/make-server-3dd53475/customer-routes.tsx`

**Changes:**
- Set `journey_stage` when profile is saved
- This ensures customer is recognized as existing user on next login
- Uses `journeyType` from request body if provided, otherwise defaults to `'profile_completed'`

**Code:**
```typescript
// Mark onboarding as complete when profile is saved
if (!updateData.journey_stage) {
  updateData.journey_stage = body.journeyType || 'profile_completed';
}
```

### Fix 3: Customer Profile POST - Normalize Phone & Create if Missing
**File:** `supabase/functions/make-server-3dd53475/customer-routes.tsx`

**Changes:**
- Normalize phone number before lookup
- Create customer if not found (handles edge cases)
- Better error handling and logging

**Code:**
```typescript
// Normalize phone number
const normalizedPhone = normalizePhone(phone);

// If customer doesn't exist, create them
if (!customerId) {
  const newCustomer = await getCustomersRepository().create({
    phone: normalizedPhone,
    full_name: `${firstName} ${lastName}`.trim() || 'Customer',
  });
  customerId = newCustomer.id;
}
```

---

## 🎯 HOW IT WORKS NOW

### Flow 1: New Customer
1. Customer enters phone → OTP sent
2. Customer verifies OTP → Customer record created in SQL
3. Customer creates profile → `journey_stage` set to `'profile_completed'`
4. Customer logs in again → OTP verify returns `onboardingComplete: true`
5. Frontend recognizes existing customer → No redirect to signup ✅

### Flow 2: Existing Customer
1. Customer enters phone → OTP sent
2. Customer verifies OTP → Existing customer found
3. OTP verify checks:
   - `journey_stage` is set → `onboardingComplete: true`
   - OR `full_name` and `email` exist → `onboardingComplete: true`
4. Frontend receives `onboardingComplete: true` → No redirect to signup ✅

---

## 📋 TESTING CHECKLIST

- [ ] Create new customer profile with phone 9611377119
- [ ] Verify profile is saved with `journey_stage: 'profile_completed'`
- [ ] Log out and log back in with same phone
- [ ] Verify OTP verify returns `onboardingComplete: true`
- [ ] Verify frontend doesn't redirect to signup
- [ ] Verify customer lands on home page directly

---

## 🔍 DEBUGGING

If customer still redirects to signup:

1. **Check customer record in database:**
   ```sql
   SELECT id, phone, full_name, email, journey_stage 
   FROM customers 
   WHERE phone = '9611377119';
   ```

2. **Check OTP verify response:**
   - Look for `onboardingComplete` field in response
   - Verify it's `true` not `false` or `undefined`

3. **Check frontend logs:**
   - Look for `hasCompletedOnboarding` value
   - Verify it's being set correctly from `data.customer.onboardingComplete`

4. **Check phone normalization:**
   - Ensure phone is normalized consistently
   - Check for leading zeros, country codes, etc.

---

## ✅ STATUS

**Fixed:** ✅  
**Tested:** ⏳ Pending  
**Deployed:** ⏳ Pending

**Next Steps:**
1. Test with phone 9611377119
2. Verify profile persistence
3. Verify no redirect to signup after profile creation

