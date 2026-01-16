# Vendor Flow Analysis - Root Cause Investigation

## Flow Understanding

### 1. Initial OTP Verification (auth-enhanced.ts:343-387)

**Current Logic:**
```
1. Check vendors table by phone → if found, use vendors.id
2. Else check vendor_identity table by phone → if found, use vendor_identity.id (UUID)
3. Else create temp_vendor_{phone}_{timestamp}
```

**Issue:** Step 2 uses `vendor_identity.id` which is NOT the actual vendor ID. It should check if `vendor_identity.vendor_id` exists and use that.

### 2. Vendor Identity Creation (vendor-onboarding-enhanced.ts:43-70)

**When:** First call to `/vendor/onboarding/status`
**What:** Creates `vendor_identity` record with:
- `id`: UUID (this is the identity ID, NOT vendor ID)
- `onboarding_status`: 'INIT'
- `phone`: vendor phone

**This is correct** - identity is created before vendor record exists.

### 3. Role Selection (vendor-onboarding-enhanced.ts:193-260)

**What:** Updates `vendor_identity.selected_role_id`
**Status:** ✅ Working correctly

### 4. Vendor Type Selection (vendor-onboarding-enhanced.ts:266-330)

**What:** Updates `vendor_identity.vendor_type`
**Status:** ✅ Working correctly

### 5. Form Submission (vendor-onboarding-enhanced.ts:478-580)

**What:** Creates `vendor_onboarding_applications` record
**What:** Updates `vendor_identity.onboarding_status` to 'UNDER_REVIEW'
**Status:** ✅ Working correctly

### 6. Admin Approval (admin.ts:385-500)

**Current Logic:**
```typescript
1. Find vendor_identity by application_id
2. Check if vendor exists (by vendor_identity.vendor_id or phone)
3. If not exists, create vendor record
4. Update vendor_identity.onboarding_status to 'APPROVED'
```

**❌ CRITICAL BUG:** Line 446-454 updates `onboarding_status` but **DOES NOT SET `vendor_identity.vendor_id`**!

```typescript
// Current code (WRONG):
await query(
  `UPDATE vendor_identity SET onboarding_status = 'APPROVED' WHERE id = $1`,
  [identity.id]
);
```

**Should be:**
```typescript
await query(
  `UPDATE vendor_identity 
   SET onboarding_status = 'APPROVED', 
       vendor_id = $1,
       updated_at = NOW()
   WHERE id = $2`,
  [vendorId, identity.id]
);
```

### 7. Post-Approval Login (auth-enhanced.ts:343-387)

**Current Logic:**
```
1. Check vendors table by phone → if found, use vendors.id ✅
2. Else check vendor_identity → use vendor_identity.id ❌ (should use vendor_id)
3. Else temp_vendor_
```

**Issue:** Step 2 should check `vendor_identity.vendor_id` first, not `vendor_identity.id`.

## Root Causes

### Issue 1: Admin Approval Doesn't Set vendor_id
**File:** `backend/lambda/src/endpoints/admin.ts:446-454`
**Problem:** When creating vendor, `vendor_identity.vendor_id` is never set
**Impact:** After approval, vendor_identity has no link to vendors table
**Fix:** Update the UPDATE query to set `vendor_id`

### Issue 2: Auth Logic Uses Wrong ID
**File:** `backend/lambda/src/endpoints/auth-enhanced.ts:362-373`
**Problem:** Uses `vendor_identity.id` instead of `vendor_identity.vendor_id`
**Impact:** After approval, if vendors lookup fails, it uses identity ID (wrong)
**Fix:** Check `vendor_identity.vendor_id` first

### Issue 3: Temp Vendor ID Logic
**File:** `backend/lambda/src/endpoints/auth-enhanced.ts:374-387`
**Problem:** Creates temp ID when vendor_identity exists but vendors doesn't
**Impact:** Should use vendor_identity.id (UUID) not temp string
**Note:** This is actually OK - temp ID is only for brand new vendors before identity creation

## Fixes Needed

### Fix 1: Admin Approval - Set vendor_id
```typescript
// In admin.ts, after creating vendor (line 444):
vendorId = insertResult.rows[0].id;

// Update vendor_identity to link vendor_id
await query(
  `UPDATE vendor_identity 
   SET onboarding_status = 'APPROVED', 
       vendor_id = $1,
       updated_at = NOW()
   WHERE id = $2`,
  [vendorId, identity.id]
);
```

### Fix 2: Auth Logic - Use vendor_id from vendor_identity
```typescript
// In auth-enhanced.ts, line 362-373:
} else if (vendorIdentity.length > 0) {
  // Check if vendor_id is set (vendor was approved)
  if (vendorIdentity[0].vendor_id) {
    // Use the actual vendor ID
    userId = vendorIdentity[0].vendor_id;
    const vendors = await select('vendors', { id: userId });
    if (vendors.length > 0) {
      userData = vendors[0];
      userData.onboarding_status = vendorIdentity[0].onboarding_status;
    } else {
      // Vendor record missing - use identity ID as fallback
      userId = vendorIdentity[0].id;
      userData = { ... };
    }
  } else {
    // Vendor not approved yet - use identity ID
    userId = vendorIdentity[0].id;
    userData = { ... };
  }
}
```

### Fix 3: Also Update Existing Vendor Case
```typescript
// In admin.ts, when vendor already exists (line 418-420):
if (identity[0].vendor_id) {
  vendorId = identity[0].vendor_id;
} else {
  // Link existing vendor to identity
  await query(
    `UPDATE vendor_identity SET vendor_id = $1 WHERE id = $2`,
    [vendorId, identity.id]
  );
}
```

## Expected Flow After Fixes

1. **New Vendor OTP** → Creates vendor_identity (status: INIT)
2. **Select Role** → Updates vendor_identity.selected_role_id
3. **Select Type** → Updates vendor_identity.vendor_type
4. **Submit Form** → Creates application, updates status to UNDER_REVIEW
5. **Admin Approval** → Creates vendor, sets vendor_identity.vendor_id, status to APPROVED
6. **Vendor Login** → Finds vendor by phone, uses vendors.id ✅
7. **Dashboard Access** → Works with real vendor ID ✅
