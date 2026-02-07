# Vendor Onboarding Flow Verification Report
**Date:** January 27, 2026  
**Status:** Complete Verification with Issues Found

## Executive Summary

The Vendor Onboarding flow has been traced through all components and endpoints. The flow is **mostly complete** but several **critical issues** were identified that need immediate attention.

---

## 1. Mobile Entry & OTP Flow ✅

### Frontend Component
**File:** `apps/vendor-web/components/vendor/VendorAuth.tsx`

**Status:** ✅ **COMPLETE**

**Findings:**
- Phone entry component exists (lines 557-667)
- OTP sending handler implemented (lines 136-205)
- OTP verification handler implemented (lines 207-345)
- Rate limiting implemented (cooldown mechanism)
- Error handling present
- Session storage properly configured

**Issues Found:**
- ⚠️ **ISSUE VO-AUTH-1:** Line 48 - Uses `/config/roles` endpoint instead of `/vendor/onboarding/roles` in VendorRoleSelection.tsx
  - **Impact:** May cause inconsistency if config endpoint differs from onboarding endpoint
  - **Location:** `apps/vendor-web/components/vendor/VendorRoleSelection.tsx:48`

### Backend Endpoints
**Files:** 
- `backend/lambda/src/endpoints/auth.ts` (lines 680-692)
- `backend/lambda/src/endpoints/auth-enhanced.ts` (lines 787-811)

**Status:** ✅ **COMPLETE**

**Findings:**
- `/auth/send-otp` endpoint exists and registered
- `/auth/verify-otp` endpoint exists and registered
- Both endpoints properly wrapped with error handling
- Returns onboarding_status in verify-otp response (as expected by frontend)

**Issues Found:** None

---

## 2. Role Selection ✅

### Frontend Component
**File:** `apps/vendor-web/components/vendor/VendorRoleSelection.tsx`

**Status:** ⚠️ **ISSUES FOUND**

**Findings:**
- Component loads roles dynamically
- Filters by `isActive` (line 50)
- Deduplicates roles by ID (line 53)
- Sorts roles appropriately (lines 56-68)
- Fallback hardcoded roles provided (lines 75-133)

**Issues Found:**
- ❌ **ISSUE VO-ROLE-1:** Line 48 - Uses `/config/roles` instead of `/vendor/onboarding/roles`
  - **Impact:** May return different data structure or miss onboarding-specific role metadata
  - **Fix Required:** Change to `/vendor/onboarding/roles`
  - **Location:** `apps/vendor-web/components/vendor/VendorRoleSelection.tsx:48`

### Backend Endpoint
**Files:**
- `backend/lambda/src/endpoints/vendor-onboarding.ts` (line 1655)
- `backend/lambda/src/endpoints/vendor-onboarding-enhanced.ts` (line 1079)

**Status:** ✅ **COMPLETE**

**Findings:**
- `GET /vendor/onboarding/roles` endpoint exists
- Filters by `is_active: true` (line 476 in vendor-onboarding.ts)
- Returns role permissions and capabilities
- Includes vendor_types_supported

**Issues Found:** None

---

## 3. Dynamic Form ✅

### Frontend Component
**File:** `apps/vendor-web/components/vendor/DynamicVendorOnboardingForm.tsx`

**Status:** ✅ **COMPLETE** (with minor issues)

**Findings:**
- Form loads schema dynamically from backend
- Handles form-schema-fixed endpoint with fallback (lines 328-352)
- Supports edit mode and initial data (lines 68-70, 109-123)
- Auto-saves to localStorage (lines 154-172)
- Validates required fields (lines 792-896)
- Handles file uploads (lines 760-790, 898-964)
- Supports map pin location (lines 1215-1295)
- Specialization selection implemented (lines 1506-1573)

**Issues Found:**
- ⚠️ **ISSUE VO-FORM-1:** Line 48 - Uses `/config/roles` in VendorRoleSelection (already noted above)
- ⚠️ **ISSUE VO-FORM-2:** Line 322 - Gets phone from localStorage but no validation if missing
  - **Impact:** Form may fail silently if phone not in localStorage
  - **Location:** `apps/vendor-web/components/vendor/DynamicVendorOnboardingForm.tsx:322`

### Backend Endpoint
**Files:**
- `backend/lambda/src/endpoints/vendor-onboarding.ts` (line 1668)
- `backend/lambda/src/endpoints/vendor-onboarding-enhanced.ts` (line 1123)

**Status:** ✅ **COMPLETE**

**Findings:**
- `GET /vendor/onboarding/form-schema` endpoint exists
- Accepts both `phone` and `roleId` query parameters
- Returns form sections grouped properly
- Handles existing applications for edit mode
- Returns default fields if no form found (enhanced version)

**Issues Found:** None

---

## 4. Application Submission ✅

### Backend Endpoint
**Files:**
- `backend/lambda/src/endpoints/vendor-onboarding.ts` (line 1671)
- `backend/lambda/src/endpoints/vendor-onboarding-enhanced.ts` (line 1131)

**Status:** ✅ **COMPLETE** (with validation issues)

**Findings:**
- `POST /vendor/onboarding/submit-application` endpoint exists
- Handles both wrapped and flat payload formats (lines 905-919)
- Validates phone number format (lines 927-934)
- Sanitizes payload to remove invalid fields (lines 941-964)
- Auto-creates vendor_identity if missing (lines 989-998)
- Auto-updates role and vendor_type from payload (lines 1016-1049)
- Creates or updates application record
- Transitions status to UNDER_REVIEW

**Issues Found:**
- ⚠️ **ISSUE VO-SUBMIT-1:** Lines 942-963 - Sanitization may be too aggressive
  - **Impact:** Valid fields with placeholder-like names may be filtered out
  - **Location:** `backend/lambda/src/endpoints/vendor-onboarding.ts:942-963`
- ⚠️ **ISSUE VO-SUBMIT-2:** Line 1052 - Error message if role missing, but auto-update happens before check
  - **Impact:** Logic flow could be clearer
  - **Location:** `backend/lambda/src/endpoints/vendor-onboarding.ts:1052-1054`

---

## 5. Admin Review ✅

### Backend Endpoint
**Files:**
- `backend/lambda/src/endpoints/vendor-onboarding.ts` (line 1676)
- `backend/lambda/src/endpoints/vendor-onboarding-enhanced.ts` (line 1140)

**Status:** ✅ **COMPLETE**

**Findings:**
- `POST /admin/vendor/onboarding/:applicationId/review` endpoint exists
- Supports three actions: APPROVE, REQUEST_CLARIFICATION, REJECT
- Validates action type (line 1159)
- Updates application status correctly
- Transitions onboarding_status via stored procedure
- **Sends push notifications** (lines 1266-1303 in vendor-onboarding.ts)
- Returns feedback in response (lines 1309-1313)

**Issues Found:**
- ⚠️ **ISSUE VO-ADMIN-1:** Line 1266 - Notification sending wrapped in try-catch, failures are silent
  - **Impact:** Admin may not know if notification failed
  - **Recommendation:** Log notification failures more prominently
  - **Location:** `backend/lambda/src/endpoints/vendor-onboarding.ts:1266-1303`
- ⚠️ **ISSUE VO-ADMIN-2:** Enhanced version (vendor-onboarding-enhanced.ts) does NOT send notifications
  - **Impact:** If enhanced version is used, vendors won't receive notifications
  - **Location:** `backend/lambda/src/endpoints/vendor-onboarding-enhanced.ts:895-1054` (missing notification code)

---

## 6. Vendor Activation ✅

### Backend Endpoint
**Files:**
- `backend/lambda/src/endpoints/vendor-onboarding.ts` (line 1681)
- `backend/lambda/src/endpoints/vendor-onboarding-enhanced.ts` (line 1150)

**Status:** ✅ **COMPLETE**

**Findings:**
- `POST /vendor/onboarding/activate` endpoint exists
- Validates vendor is APPROVED before activation (line 1343)
- Creates vendor record from application (lines 1362-1378)
- Creates setup completion record (lines 1383-1392)
- Transitions status to ACTIVATED (lines 1394-1398)
- Enhanced version handles existing vendors (lines 1171-1192)

**Issues Found:**
- ⚠️ **ISSUE VO-ACTIVATE-1:** Line 1362 - Vendor creation may fail if required fields missing from payload
  - **Impact:** Activation may fail silently or with unclear error
  - **Location:** `backend/lambda/src/endpoints/vendor-onboarding.ts:1362-1378`
- ⚠️ **ISSUE VO-ACTIVATE-2:** Enhanced version doesn't create setup_completion record
  - **Impact:** Vendor setup tracking may be incomplete
  - **Location:** `backend/lambda/src/endpoints/vendor-onboarding-enhanced.ts:1150-1243` (missing setup_completion creation)

---

## Critical Issues Summary

### 🔴 High Priority

1. **VO-ADMIN-2:** Enhanced admin review endpoint missing notification sending
   - **File:** `backend/lambda/src/endpoints/vendor-onboarding-enhanced.ts:1140`
   - **Fix:** Add notification sending code from vendor-onboarding.ts lines 1266-1303

2. **VO-ACTIVATE-2:** Enhanced activation endpoint missing setup_completion creation
   - **File:** `backend/lambda/src/endpoints/vendor-onboarding-enhanced.ts:1150`
   - **Fix:** Add setup_completion record creation after vendor creation

### 🟡 Medium Priority

3. **VO-ROLE-1:** Role selection uses wrong endpoint
   - **File:** `apps/vendor-web/components/vendor/VendorRoleSelection.tsx:48`
   - **Fix:** Change `/config/roles` to `/vendor/onboarding/roles`

4. **VO-FORM-2:** Form schema fetch doesn't validate phone in localStorage
   - **File:** `apps/vendor-web/components/vendor/DynamicVendorOnboardingForm.tsx:322`
   - **Fix:** Add validation and error handling if phone missing

### 🟢 Low Priority

5. **VO-SUBMIT-1:** Payload sanitization may be too aggressive
   - **File:** `backend/lambda/src/endpoints/vendor-onboarding.ts:942-963`
   - **Fix:** Review sanitization patterns, add allowlist for known valid fields

6. **VO-ADMIN-1:** Notification failures are silent
   - **File:** `backend/lambda/src/endpoints/vendor-onboarding.ts:1266-1303`
   - **Fix:** Add CloudWatch metrics/alerts for notification failures

---

## Flow Verification Summary

| Step | Component | Backend Endpoint | Status | Issues |
|------|-----------|------------------|--------|--------|
| 1. Mobile Entry | VendorAuth.tsx | `/auth/send-otp` | ✅ Complete | None |
| 2. OTP Verification | VendorAuth.tsx | `/auth/verify-otp` | ✅ Complete | None |
| 3. Role Selection | VendorRoleSelection.tsx | `/vendor/onboarding/roles` | ⚠️ Issues | Wrong endpoint used |
| 4. Dynamic Form | DynamicVendorOnboardingForm.tsx | `/vendor/onboarding/form-schema` | ✅ Complete | Phone validation missing |
| 5. Submit Application | DynamicVendorOnboardingForm.tsx | `/vendor/onboarding/submit-application` | ✅ Complete | Sanitization too aggressive |
| 6. Admin Review | Admin UI | `/admin/vendor/onboarding/:id/review` | ⚠️ Issues | Enhanced version missing notifications |
| 7. Vendor Activation | VendorLandingPage.tsx | `/vendor/onboarding/activate` | ⚠️ Issues | Enhanced version missing setup_completion |

---

## Recommendations

1. **Immediate Actions:**
   - Fix enhanced admin review endpoint to send notifications
   - Fix enhanced activation endpoint to create setup_completion record
   - Update VendorRoleSelection to use correct endpoint

2. **Testing Required:**
   - Test complete flow end-to-end with both standard and enhanced endpoints
   - Verify notifications are sent for all admin actions
   - Verify setup_completion is created for all activated vendors

3. **Code Quality:**
   - Standardize error handling across both endpoint versions
   - Add comprehensive logging for notification failures
   - Add validation for required localStorage values

---

## Conclusion

The Vendor Onboarding flow is **functionally complete** but has **6 issues** that need attention:
- 2 critical issues (missing features in enhanced endpoints)
- 2 medium priority issues (wrong endpoint, missing validation)
- 2 low priority issues (code quality improvements)

All issues are fixable and do not block the flow, but should be addressed for production readiness.
