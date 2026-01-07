# Phase 4 Action Plan

**Date:** 2026-01-28  
**Status:** 🚀 **READY TO START**

---

## 🎯 Phase 4 Objectives

1. **Complete Handler Migration** - Migrate remaining critical handlers
2. **Security Enhancement** - Implement Cognito JWT validation
3. **UX Flow Enforcement** - Enforce search-first flow
4. **UI Consistency** - Continue color fixes across all apps
5. **Performance** - Apply database optimizations

---

## 📋 Priority Tasks

### 🔴 **HIGH PRIORITY**

#### 1. Migrate Vendor Onboarding Handler
**File:** `backend/lambda/src/endpoints/vendor-onboarding-enhanced.ts`

**Tasks:**
- [ ] Create enhanced version using `BaseHandlerEnhanced`
- [ ] Migrate `SubmitApplicationHandler` (most critical)
- [ ] Add Zod validation using `SubmitVendorApplicationRequestSchema`
- [ ] Migrate `GetOnboardingStatusHandler`
- [ ] Migrate `SelectRoleHandler` and `SelectVendorTypeHandler`
- [ ] Update router to use enhanced handlers
- [ ] Test all onboarding endpoints

**Estimated Time:** 2-3 hours

**Dependencies:**
- ✅ `BaseHandlerEnhanced` exists
- ✅ `@warmpawz/api-contracts` has vendor schemas
- ⚠️ Need to verify database import path (`../db` vs `../database/rds-connection`)

---

#### 2. Implement Cognito JWT Validation
**File:** `backend/lambda/src/handler/base-handler-enhanced.ts`

**Tasks:**
- [ ] Install `@aws-sdk/client-cognito-identity-provider` (if not already)
- [ ] Create `validateCognitoToken()` function
- [ ] Implement JWT verification with Cognito User Pool
- [ ] Update `extractUserId()` to validate and decode JWT
- [ ] Update `extractUserRole()` to extract from JWT claims
- [ ] Add middleware for protected routes
- [ ] Test with actual Cognito tokens

**Estimated Time:** 3-4 hours

**Dependencies:**
- ✅ `BaseHandlerEnhanced` structure ready
- ⚠️ Need Cognito User Pool ID and region
- ⚠️ Need to test with actual tokens

---

#### 3. Enforce Search-First Flow
**Files:**
- `apps/customer-web/app/page.tsx` (home page)
- `apps/customer-web/components/customer/CustomerHomeWrapper.tsx`
- `apps/customer-web/components/customer/CustomerHomeComplete.tsx`

**Tasks:**
- [ ] Add route guard to prevent direct booking access
- [ ] Redirect to search if no search query exists
- [ ] Update navigation to require search before booking
- [ ] Add search state persistence
- [ ] Update mobile apps similarly
- [ ] Test complete flow

**Estimated Time:** 2-3 hours

**Dependencies:**
- ✅ Search page exists
- ✅ Booking flow exists
- ⚠️ Need to understand current routing structure

---

### 🟡 **MEDIUM PRIORITY**

#### 4. Fix Vendor Web Component Colors
**Files to Fix:**
- `apps/vendor-web/components/vendor/VendorDashboard.tsx`
- Other vendor web components with hardcoded colors

**Tasks:**
- [ ] Run color detection script on vendor-web
- [ ] Replace `#FF8C42` with `bg-primary` / `text-primary`
- [ ] Replace `#FF7A2E` with `bg-primary/90`
- [ ] Verify design token usage
- [ ] Test UI consistency

**Estimated Time:** 1-2 hours

**Dependencies:**
- ✅ Design tokens configured
- ✅ Pattern established from admin-web fixes

---

#### 5. Integrate API Contracts Package
**Files:**
- `backend/lambda/src/endpoints/bookings-enhanced.ts`
- `backend/lambda/src/endpoints/auth-enhanced.ts`
- `backend/lambda/src/endpoints/vendor-onboarding-enhanced.ts`

**Tasks:**
- [ ] Build `@warmpawz/api-contracts` package
- [ ] Link package in lambda workspace
- [ ] Replace inline Zod schemas with package imports
- [ ] Update all handlers to use package
- [ ] Remove temporary schemas
- [ ] Test compilation

**Estimated Time:** 1-2 hours

**Dependencies:**
- ✅ API contracts package created
- ⚠️ Need to build and link package
- ⚠️ Need to verify monorepo linking works

---

#### 6. Apply Database Migration 050
**File:** `db/migrations/050_additional_indexes_optimization.sql`

**Tasks:**
- [ ] Review migration script
- [ ] Backup database (if production)
- [ ] Apply migration to dev/staging
- [ ] Verify indexes created
- [ ] Test query performance
- [ ] Monitor for any issues
- [ ] Apply to production (if all good)

**Estimated Time:** 30 minutes + testing

**Dependencies:**
- ✅ Migration script ready
- ⚠️ Need database access
- ⚠️ Need to coordinate with team

---

### 🟢 **LOW PRIORITY**

#### 7. Continue Mobile App Color Fixes
**Files:**
- `apps/WarmpawzCustomer/src/**/*.tsx`
- `apps/WarmpawzVendor/src/**/*.tsx`

**Tasks:**
- [ ] Run color detection on mobile apps
- [ ] Fix hardcoded colors
- [ ] Verify React Native color compatibility
- [ ] Test on devices

**Estimated Time:** 2-3 hours

---

## 🚀 Quick Start Guide

### Step 1: Migrate Vendor Onboarding Handler
```bash
# 1. Create enhanced handler file
touch backend/lambda/src/endpoints/vendor-onboarding-enhanced.ts

# 2. Copy SubmitApplicationHandler from vendor-onboarding.ts
# 3. Update to use BaseHandlerEnhanced
# 4. Add Zod validation
# 5. Update router registration
```

### Step 2: Implement Cognito JWT Validation
```bash
# 1. Check if Cognito SDK is installed
cd backend/lambda && npm list @aws-sdk/client-cognito-identity-provider

# 2. Create JWT validation utility
# 3. Update BaseHandlerEnhanced
# 4. Test with sample token
```

### Step 3: Enforce Search-First Flow
```bash
# 1. Check current routing
grep -r "useRouter\|router.push" apps/customer-web/components/customer/

# 2. Add route guard
# 3. Update navigation logic
# 4. Test flow
```

---

## 📊 Progress Tracking

### Handler Migration Status
- ✅ Auth handler (Phase 2)
- ✅ Bookings handler (Phase 3)
- ⏳ Vendor onboarding handler (Phase 4 - In Progress)
- ⏳ Other handlers (Pending)

### UI Consistency Status
- ✅ Customer web: 3 components (Phase 2)
- ✅ Admin web: 5 components (Phase 3)
- ⏳ Vendor web: 0 components (Phase 4)
- ⏳ Mobile apps: 0 components (Pending)

### Architecture Status
- ✅ Unified booking engine (Phase 3)
- ⏳ Search-first flow (Phase 4)
- ⏳ Cognito JWT validation (Phase 4)
- ⏳ API contracts integration (Phase 4)

---

## 🔧 Technical Notes

### Database Import Path
The vendor-onboarding handler uses `../db` while bookings-enhanced uses `../database/rds-connection`. Need to verify which is correct:
- Check: `backend/lambda/src/db/index.ts` vs `backend/lambda/src/database/rds-connection.ts`
- Standardize on one import path

### Cognito Configuration
Need to identify:
- Cognito User Pool ID
- Cognito Region
- JWT issuer URL
- Token validation endpoint

### Search-First Flow Logic
Current flow may allow:
- Direct booking from vendor page
- Direct booking from service page
- Need to enforce: Search → Results → Booking

---

## ✅ Success Criteria

Phase 4 is complete when:
- [ ] Vendor onboarding handler migrated and tested
- [ ] Cognito JWT validation working
- [ ] Search-first flow enforced
- [ ] Vendor web colors fixed
- [ ] API contracts package integrated
- [ ] Database migration applied (if applicable)

---

## 📝 Next Steps After Phase 4

**Phase 5 Potential Tasks:**
1. Complete remaining handler migrations
2. Mobile app color fixes
3. Performance optimization
4. End-to-end testing
5. Documentation updates

---

**Ready to start Phase 4?** Begin with Task 1 (Vendor Onboarding Handler Migration) 🚀

