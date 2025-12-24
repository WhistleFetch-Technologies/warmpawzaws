# Marketing Features Audit Report
**Date**: 2025-01-22
**Scope**: Banners, Promotions, Coupons, Rewards, Loyalty Points - Admin Portal & Customer App

## Executive Summary

Comprehensive audit of marketing features reveals **extensive KV usage** that needs migration to SQL, **missing SQL tables** for banners and spotlight offers, and **incomplete lifecycle implementation** across multiple features.

---

## 1. CURRENT STATE ANALYSIS

### 1.1 Banners
**Status**: ❌ **CRITICAL GAPS**

- **SQL Table**: ❌ **MISSING** - No `banners` table exists
- **Admin Component**: ⚠️ **STUB ONLY** - `BannerAdmin.tsx` is just a placeholder ("coming soon")
- **Backend**: ⚠️ **KV-BASED** - `content-management-endpoints.tsx` uses KV for all banner operations
- **Customer App**: ✅ **USES API** - Fetches from `/customer/content/banners?type=main`
- **S3 Integration**: ✅ **IMPLEMENTED** - Uses S3 for image uploads

**KV Usage Locations**:
- `supabase/functions/make-server-3dd53475/content-management-endpoints.tsx`: Lines 184, 190, 194, 196, 221, 267, 312, 323, 341, 351, 368, 377, 380, 382, 395, 710, 727

**Lifecycle Gaps**:
- ❌ No SQL persistence
- ❌ No expiration tracking
- ❌ No usage analytics
- ❌ No scheduled activation/deactivation

---

### 1.2 Promotions
**Status**: ⚠️ **PARTIAL MIGRATION**

- **SQL Table**: ✅ **EXISTS** - `promotions` table in schema
- **Admin Component**: ✅ **EXISTS** - `MarketingPromotionsTab.tsx` with CRUD
- **Backend**: ⚠️ **MIXED** - Some endpoints use SQL (`marketing-endpoints.tsx`), others use KV
- **Customer App**: ✅ **USES API** - Multiple components fetch promotions

**KV Usage Locations**:
- `marketing-routes-v2.tsx`: Lines 17, 205, 208, 224, 233, 244, 248, 264
- `promotion-endpoints.tsx`: Lines 24, 76, 167, 169, 184, 201, 214, 231, 234
- `index.tsx`: Line 541

**SQL Implementation**:
- ✅ `marketing-endpoints.tsx` uses `getPromotionsRepository()` for some operations
- ✅ Repository exists: `promotions.ts`

**Lifecycle Gaps**:
- ⚠️ Inconsistent data source (KV vs SQL)
- ❌ No promotion usage tracking table
- ❌ No promotion analytics
- ⚠️ Spotlight promotions not properly integrated

---

### 1.3 Coupons
**Status**: ⚠️ **PARTIAL MIGRATION**

- **SQL Table**: ✅ **EXISTS** - `coupons` table with `coupon_usages` tracking
- **Admin Component**: ✅ **EXISTS** - `CouponManagement.tsx` with full CRUD
- **Backend**: ⚠️ **MIXED** - Multiple endpoints use KV
- **Customer App**: ✅ **USES API** - Payment flow validates coupons

**KV Usage Locations**:
- `marketing-routes-v2.tsx`: Lines 61, 136, 161, 164, 173, 321, 351, 367, 385, 423
- `grooming-booking-apis.tsx`: Line 212
- `missing-crud-endpoints.tsx`: Lines 388, 390

**SQL Implementation**:
- ✅ Tables exist: `coupons`, `coupon_usages`
- ⚠️ Repository may exist but not fully utilized

**Lifecycle Gaps**:
- ⚠️ Inconsistent data source (KV vs SQL)
- ⚠️ Usage tracking exists in SQL but not always used
- ❌ No coupon analytics

---

### 1.4 Spotlight Offers
**Status**: ❌ **CRITICAL GAPS**

- **SQL Table**: ❌ **MISSING** - No dedicated table
- **Admin Component**: ⚠️ **PARTIAL** - `MarketingPromotionsTab.tsx` has spotlight tab but uses KV
- **Backend**: ❌ **KV-BASED** - No dedicated SQL endpoints
- **Customer App**: ⚠️ **HARDCODED** - Many landing pages have hardcoded spotlight offers

**Hardcoded Locations**:
- `VetServicesLanding.tsx`: Lines 244-268 (hardcoded spotlight cards)
- `BehavioralServicesLanding.tsx`: Lines 242-263 (hardcoded spotlight cards)
- `PharmacyServicesLanding.tsx`: Lines 174-196 (hardcoded spotlight cards)
- `UniversalServicesLanding.tsx`: May have hardcoded offers

**Lifecycle Gaps**:
- ❌ No SQL persistence
- ❌ No admin management UI (spotlight tab incomplete)
- ❌ No expiration/activation tracking
- ❌ Hardcoded in customer app (not dynamic)

---

### 1.5 Loyalty Points & Rewards
**Status**: ⚠️ **PARTIAL MIGRATION**

- **SQL Tables**: ✅ **EXIST** - `loyalty_rules`, `customer_loyalty_points`, `loyalty_transactions`
- **Admin Component**: ✅ **EXISTS** - `RewardsLoyaltyManagement.tsx`
- **Backend**: ⚠️ **KV-BASED** - `rewards-loyalty-system.tsx` uses KV
- **Customer App**: ✅ **USES API** - Payment flow supports loyalty points

**KV Usage Locations**:
- `rewards-loyalty-system.tsx`: Lines 284, 286, 325, 469, 517, 579

**SQL Implementation**:
- ✅ Tables exist with proper structure
- ❌ Repository not created/used
- ❌ Endpoints still use KV

**Lifecycle Gaps**:
- ❌ Rules stored in KV instead of SQL
- ❌ Profile data in KV instead of SQL
- ⚠️ Transactions might be tracked but rules/profiles not persisted

---

## 2. CRITICAL GAPS IDENTIFIED

### 2.1 Missing SQL Tables

1. **`banners` table** - Required for banner management
   - Fields needed: id, type (main/spotlight), title, subtitle, image_url (S3), cta_text, cta_link, metadata (JSONB), start_date, end_date, is_active, display_order, created_at, updated_at

2. **`spotlight_offers` table** - Required for spotlight offers management
   - Fields needed: id, role_id, service_category, title, subtitle, discount_type, discount_value, badge_text, icon, image_url (S3), cta_text, cta_link, start_date, end_date, is_active, display_order, created_at, updated_at

### 2.2 Missing Repositories

1. `banners.ts` - Banner repository
2. `spotlight-offers.ts` - Spotlight offers repository
3. Update `loyalty.ts` if not exists - Loyalty repository (rules, profiles, transactions)

### 2.3 Missing/M incomplete Backend Endpoints

1. **Banners**: Migrate from KV to SQL
2. **Coupons**: Migrate remaining KV endpoints to SQL
3. **Promotions**: Migrate remaining KV endpoints to SQL
4. **Loyalty**: Migrate from KV to SQL
5. **Spotlight Offers**: Create SQL-based endpoints

### 2.4 Customer App Integration Gaps

1. **Hardcoded Spotlight Offers**: Replace with API calls
2. **Banner Display**: Already uses API but backend uses KV
3. **Promotion Display**: Multiple components fetch from different endpoints (some KV, some SQL)

### 2.5 Admin Portal Gaps

1. **BannerAdmin**: Currently just a stub - needs full CRUD implementation
2. **Spotlight Management**: Tab exists but incomplete - needs full implementation
3. **Analytics**: Missing usage/performance tracking for all features

---

## 3. MIGRATION PLAN

### Phase 1: SQL Schema Creation
1. ✅ Create `banners` table migration
2. ✅ Create `spotlight_offers` table migration
3. ✅ Verify existing tables (promotions, coupons, loyalty)

### Phase 2: Repository Creation
1. ✅ Create `banners.ts` repository
2. ✅ Create `spotlight-offers.ts` repository
3. ✅ Verify/update `promotions.ts` repository
4. ✅ Verify/update `coupons.ts` repository
5. ✅ Create/update `loyalty.ts` repository

### Phase 3: Backend Migration
1. ✅ Migrate banner endpoints from KV to SQL
2. ✅ Migrate coupon endpoints from KV to SQL
3. ✅ Migrate promotion endpoints from KV to SQL
4. ✅ Migrate loyalty endpoints from KV to SQL
5. ✅ Create spotlight offers endpoints (SQL-based)

### Phase 4: Admin Portal Updates
1. ✅ Complete `BannerAdmin.tsx` with full CRUD
2. ✅ Complete spotlight management in `MarketingPromotionsTab.tsx`
3. ✅ Ensure all admin components use SQL endpoints

### Phase 5: Customer App Updates
1. ✅ Replace hardcoded spotlight offers with API calls
2. ✅ Ensure all components use SQL endpoints
3. ✅ Add proper error handling and fallbacks

### Phase 6: Lifecycle & Analytics
1. ✅ Add expiration tracking (scheduled deactivation)
2. ✅ Add usage analytics (banner views, promotion applies, coupon uses)
3. ✅ Add performance metrics

---

## 4. DETAILED GAP ANALYSIS

### 4.1 Banner Lifecycle

**Current**: KV-based, no expiration, no analytics
**Required**:
- ✅ Create banner (with S3 upload)
- ✅ Update banner
- ✅ Delete banner (soft delete)
- ✅ Schedule activation/deactivation (start_date/end_date)
- ✅ Track views/clicks (analytics table)
- ✅ Display order management
- ✅ Type filtering (main, spotlight, category-specific)

### 4.2 Promotion Lifecycle

**Current**: Mixed KV/SQL, incomplete tracking
**Required**:
- ✅ Create promotion
- ✅ Update promotion
- ✅ Delete promotion (soft delete)
- ✅ Schedule activation/deactivation
- ✅ Track applies (usage tracking)
- ✅ Filter by role/category/style
- ✅ Analytics (conversion rate, discount given)

### 4.3 Coupon Lifecycle

**Current**: Mixed KV/SQL, usage tracking exists but inconsistent
**Required**:
- ✅ Create coupon (with bulk generation)
- ✅ Update coupon
- ✅ Delete coupon (soft delete)
- ✅ Validate coupon (check expiry, usage limits)
- ✅ Track usage (already exists in SQL)
- ✅ Per-customer usage limits
- ✅ Analytics (redemption rate, revenue impact)

### 4.4 Spotlight Offers Lifecycle

**Current**: Hardcoded in customer app, no admin management
**Required**:
- ✅ Create spotlight offer
- ✅ Update spotlight offer
- ✅ Delete spotlight offer (soft delete)
- ✅ Schedule activation/deactivation
- ✅ Role/category-specific filtering
- ✅ Display order management
- ✅ Track clicks/applies

### 4.5 Loyalty Points Lifecycle

**Current**: KV-based rules and profiles
**Required**:
- ✅ Manage loyalty rules (SQL)
- ✅ Track customer points (SQL)
- ✅ Record transactions (SQL)
- ✅ Points expiration tracking
- ✅ Redemption validation
- ✅ Analytics (points earned/redeemed, top customers)

---

## 5. PRIORITY FIXES

### 🔴 CRITICAL (Fix Immediately)
1. Create `banners` SQL table
2. Create `spotlight_offers` SQL table
3. Migrate banner endpoints from KV to SQL
4. Migrate loyalty endpoints from KV to SQL
5. Replace hardcoded spotlight offers in customer app

### 🟡 HIGH (Fix Soon)
1. Migrate remaining coupon endpoints to SQL
2. Migrate remaining promotion endpoints to SQL
3. Complete BannerAdmin component
4. Complete spotlight management UI

### 🟢 MEDIUM (Fix Later)
1. Add analytics tracking
2. Add expiration automation
3. Add performance metrics
4. Add A/B testing capabilities

---

## 6. EXPECTED OUTCOMES AFTER FIXES

✅ **All features use SQL exclusively (zero KV usage)**
✅ **Complete CRUD lifecycle for all features**
✅ **Admin portal fully functional for all features**
✅ **Customer app dynamically loads all content from SQL**
✅ **S3 integration for all media files**
✅ **Usage tracking and analytics**
✅ **Scheduled activation/deactivation**
✅ **Proper error handling and fallbacks**

---

## NEXT STEPS

1. Start with Phase 1: Create SQL migrations
2. Create repositories
3. Migrate backend endpoints systematically
4. Update admin portal components
5. Update customer app components
6. Test end-to-end flows
7. Verify zero KV usage

