# 🗺️ COMPREHENSIVE KV → SQL MIGRATION PLAN

## 🎯 OBJECTIVE
Complete migration from KV store to SQL for all journeys, starting from region, with seeding endpoints and zero breaking changes.

---

## 📋 PHASE 1: FOUNDATION - REGION & CATALOG (Week 1)

### 1.1 Region Management
**Status**: ⚠️ Partially migrated (needs completion)

**Files to Fix**:
- `region-endpoints.tsx` - Ensure all region operations use SQL
- `index.tsx` - Region endpoints registration

**Tasks**:
1. ✅ Verify region SQL table exists (`regions` table)
2. ✅ Migrate region CRUD operations to SQL repository
3. ✅ Remove KV fallback for regions
4. ✅ Add region seeding endpoint (POST `/admin/regions/seed`)

**Invariants**:
- Region must have `region_id`, `name`, `is_active`
- No region without proper hierarchy (parent_region_id if applicable)

---

### 1.2 Service Catalog & Seeding
**Status**: ❌ Needs migration

**Files to Fix**:
- `service-catalog-endpoints.tsx` (if exists) or create new
- `vendor-services-sql-endpoints.tsx` - Add seeding
- `custom-service-endpoints-refactored.tsx` - Verify SQL-only

**Tasks**:
1. ✅ Create service catalog SQL table (if not exists)
2. ✅ Create seeding endpoint: `POST /admin/catalog/seed`
   - Seed standard services (vet, grooming, training, etc.)
   - Seed service categories and subcategories
   - Seed service metadata (pricing tiers, durations, etc.)
3. ✅ Create UI seeding endpoint: `POST /admin/catalog/seed-ui`
   - For admin to insert services via UI
4. ✅ Verify all service queries use SQL

**Invariants**:
- Service must have `service_id`, `name`, `category`, `base_price`
- Service must be linked to catalog (no orphaned services)

---

## 📋 PHASE 2: CUSTOMER JOURNEY (Week 2)

### 2.1 Customer Onboarding & Registration
**Status**: ⚠️ Needs audit

**Files to Audit**:
- `customer-routes-refactored.tsx`
- `auth-endpoints.tsx`
- `universal-otp-system.tsx`

**Tasks**:
1. ✅ Verify customer creation uses SQL (`customers` table)
2. ✅ Verify OTP system uses SQL (if applicable)
3. ✅ Verify customer profile updates use SQL
4. ✅ Remove any KV customer storage
5. ✅ Add customer seeding endpoint (for testing): `POST /admin/customers/seed`

**Customer Journey Steps**:
1. **Registration** → SQL: `customers` table
2. **OTP Verification** → SQL: `otp_tokens` table (if exists)
3. **Profile Completion** → SQL: `customers` table update
4. **Pet Registration** → SQL: `pets` table
5. **Service Discovery** → SQL: `services` + `vendor_services` join
6. **Booking** → SQL: `bookings` table (✅ Already done)
7. **Payment** → SQL: `payments` table (✅ Already done)
8. **History** → SQL: `bookings` + `prescriptions` + `medical_records`

**Invariants**:
- Customer must have `customer_id`, `phone`, `email`
- Pet must have `pet_id`, `customer_id`, `name`
- No customer without phone verification

---

### 2.2 Customer Service Discovery
**Status**: ✅ Partially done (needs completion)

**Files to Fix**:
- `universal-service-discovery.tsx` - ✅ Already fixed
- `customer-services.tsx` - Verify SQL-only
- `customer-routes-refactored.tsx` - Verify service queries

**Tasks**:
1. ✅ Verify all service discovery uses SQL
2. ✅ Verify filtering by location, category, price uses SQL
3. ✅ Verify vendor ratings/reviews use SQL
4. ✅ Remove any KV service caching

**Invariants**:
- Customer sees only `publish_status = 'published'` services
- Customer sees only `is_active = true` vendors
- Services must have complete information (price, duration, description)

---

### 2.3 Customer Booking Flow
**Status**: ✅ Mostly done (needs verification)

**Files to Verify**:
- `booking-endpoints-refactored.tsx` - ✅ Already SQL
- `payment-endpoints-refactored.tsx` - ✅ Already SQL
- `customer-routes-refactored.tsx` - Verify booking queries

**Tasks**:
1. ✅ Verify booking creation uses SQL
2. ✅ Verify booking history uses SQL
3. ✅ Verify booking status updates use SQL
4. ✅ Remove any KV booking storage

**Invariants**:
- Booking must have `booking_id`, `customer_id`, `vendor_id`, `service_id`
- Booking status transitions: `pending` → `confirmed` → `in_progress` → `completed`
- Payment must be linked to booking (`payment.booking_id`)

---

## 📋 PHASE 3: VENDOR JOURNEY (Week 3)

### 3.1 Vendor Onboarding & Dynamic Forms
**Status**: ❌ Needs migration

**Files to Fix**:
- `vendor-onboarding-refactored.tsx`
- `dynamic-onboarding-management.tsx`
- `onboarding-config-endpoints.tsx`

**Tasks**:
1. ✅ Create `onboarding_forms` SQL table
   - `id`, `form_type` (vendor/customer/staff), `form_config` (JSONB), `is_active`
2. ✅ Create `onboarding_responses` SQL table
   - `id`, `form_id`, `entity_id` (vendor_id/customer_id), `responses` (JSONB), `status`
3. ✅ Migrate dynamic form storage from KV to SQL
4. ✅ Create form seeding endpoint: `POST /admin/onboarding/seed-forms`
5. ✅ Verify form rendering uses SQL
6. ✅ Verify form submission uses SQL

**Vendor Onboarding Steps**:
1. **Registration** → SQL: `vendors` table
2. **Dynamic Form Rendering** → SQL: `onboarding_forms` table
3. **Form Submission** → SQL: `onboarding_responses` table
4. **Approval Workflow** → SQL: `vendor_approvals` table (if exists)
5. **Service Publishing** → SQL: `vendor_services` table (✅ Already done)

**Invariants**:
- Vendor must have `vendor_id`, `business_name`, `phone`, `email`
- Form must have `form_id`, `form_type`, `form_config`
- Response must have `form_id`, `entity_id`, `responses`

---

### 3.2 Vendor Dashboard & Bookings
**Status**: ✅ Mostly done (needs verification)

**Files to Verify**:
- `vendor-dashboard-endpoints-refactored.tsx` - ✅ Already SQL
- `vendor-booking-actions.tsx` - Verify SQL
- `booking-lifecycle-complete-refactored.tsx` - ✅ Already SQL

**Tasks**:
1. ✅ Verify vendor dashboard uses SQL
2. ✅ Verify vendor bookings list uses SQL
3. ✅ Verify vendor schedule uses SQL
4. ✅ Verify vendor earnings uses SQL
5. ✅ Remove any KV vendor dashboard data

**Invariants**:
- Vendor sees only bookings with `payment_status = 'paid'`
- Vendor earnings calculated from `commissions` table
- Vendor payouts from `payouts` table

---

### 3.3 Vendor Service Management
**Status**: ✅ Mostly done (needs verification)

**Files to Verify**:
- `vendor-service-management-refactored.tsx` - ✅ Already SQL
- `vendor-services-sql-endpoints.tsx` - ✅ Already SQL
- `custom-service-endpoints-refactored.tsx` - Verify SQL-only

**Tasks**:
1. ✅ Verify service publishing uses SQL
2. ✅ Verify service updates use SQL
3. ✅ Verify service deletion uses SQL
4. ✅ Remove any KV service storage

**Invariants**:
- Service must have `vendor_id`, `service_id`, `publish_status`
- Service must be linked to catalog (`service_id` references `services`)

---

## 📋 PHASE 4: SELLER HUB / MARKETPLACE (Week 4)

### 4.1 Product Management
**Status**: ⚠️ Needs audit

**Files to Audit**:
- `marketplace-products.tsx`
- `customer-ecommerce-endpoints-sql.tsx`
- `vendor-catalog-api-v2.tsx`

**Tasks**:
1. ✅ Verify product creation uses SQL (`products` table)
2. ✅ Verify product listing uses SQL
3. ✅ Verify product updates uses SQL
4. ✅ Verify product inventory uses SQL
5. ✅ Create product seeding endpoint: `POST /admin/products/seed`
6. ✅ Remove any KV product storage

**Seller Hub Journey**:
1. **Product Creation** → SQL: `products` table
2. **Product Publishing** → SQL: `products.is_active = true`
3. **Inventory Management** → SQL: `product_inventory` table (if exists)
4. **Order Management** → SQL: `orders` table
5. **Fulfillment** → SQL: `order_items` + `shipments` tables

**Invariants**:
- Product must have `product_id`, `vendor_id`, `name`, `price`
- Product must have `is_active = true` to be visible
- Order must have `order_id`, `customer_id`, `vendor_id`, `product_id`

---

### 4.2 Marketplace Discovery
**Status**: ⚠️ Needs audit

**Files to Audit**:
- `customer-ecommerce-endpoints-sql.tsx`
- `marketplace-products.tsx`
- `universal-service-discovery.tsx` - Verify marketplace products

**Tasks**:
1. ✅ Verify product discovery uses SQL
2. ✅ Verify product filtering uses SQL
3. ✅ Verify product search uses SQL
4. ✅ Remove any KV product caching

**Invariants**:
- Customer sees only `is_active = true` products
- Products must have complete information (price, images, description)

---

## 📋 PHASE 5: ADMIN PANEL (Week 5)

### 5.1 Admin Management
**Status**: ⚠️ Needs audit

**Files to Audit**:
- `admin-vendor-routes.tsx`
- `admin-vendor-endpoints-refactored.tsx`
- `admin-catalog-endpoints.tsx`
- `admin-integration-endpoints.tsx`

**Tasks**:
1. ✅ Verify admin operations use SQL
2. ✅ Verify vendor approval uses SQL
3. ✅ Verify service approval uses SQL
4. ✅ Verify platform settings use SQL
5. ✅ Create admin seeding endpoints for all entities

**Admin Operations**:
1. **Vendor Approval** → SQL: `vendors.status = 'approved'`
2. **Service Approval** → SQL: `vendor_services.publish_status = 'published'`
3. **Platform Settings** → SQL: `platform_settings` table
4. **Commission Management** → SQL: `commission_rules` table (if exists)
5. **Payout Management** → SQL: `payouts` table

**Invariants**:
- Admin actions must be logged (`audit_logs` table)
- Settings must be versioned
- Approvals must have `approved_by`, `approved_at`

---

### 5.2 Platform Settings & Policies
**Status**: ⚠️ Needs audit

**Files to Audit**:
- `platform-settings-endpoints.tsx` (if exists)
- `settlement-automation-sql.tsx`
- `cancellation-policy-endpoints.tsx`

**Tasks**:
1. ✅ Verify platform settings use SQL (`platform_settings` table)
2. ✅ Verify policy management uses SQL
3. ✅ Verify commission rules use SQL
4. ✅ Create settings seeding endpoint: `POST /admin/settings/seed`

**Invariants**:
- Settings must have `setting_key`, `setting_value`, `version`
- Policies must be versioned
- Commission rules must be immutable after creation

---

## 📋 PHASE 6: ROLE CONFIGURATION (Week 6)

### 6.1 Role Management
**Status**: ⚠️ Needs audit

**Files to Audit**:
- `vendor-role-config.tsx`
- `rbac-endpoints.tsx`
- `role-service.tsx` (if exists)

**Tasks**:
1. ✅ Verify role configuration uses SQL (`roles` table)
2. ✅ Verify role assignments use SQL (`user_roles` table)
3. ✅ Verify permissions use SQL (`permissions` table)
4. ✅ Create role seeding endpoint: `POST /admin/roles/seed`
5. ✅ Remove any KV role storage

**Role Configuration Journey**:
1. **Role Definition** → SQL: `roles` table
2. **Permission Assignment** → SQL: `role_permissions` table
3. **User Role Assignment** → SQL: `user_roles` table
4. **Dynamic Form Configuration** → SQL: `onboarding_forms` (linked to role)

**Invariants**:
- Role must have `role_id`, `role_name`, `category`
- Permission must have `permission_id`, `resource`, `action`
- User role must have `user_id`, `role_id`, `entity_id` (vendor_id/customer_id)

---

## 📋 PHASE 7: DATA MIGRATION & SEEDING (Week 7)

### 7.1 KV Data Migration Scripts
**Status**: ❌ Needs creation

**Files to Create**:
- `migrations/migrate-kv-to-sql.ts` - Main migration script
- `migrations/migrate-regions.ts`
- `migrations/migrate-services.ts`
- `migrations/migrate-vendors.ts`
- `migrations/migrate-customers.ts`
- `migrations/migrate-bookings.ts`

**Tasks**:
1. ✅ Create migration script for each entity type
2. ✅ Add data validation before migration
3. ✅ Add rollback capability
4. ✅ Add migration logging

---

### 7.2 Seeding Endpoints (UI-Friendly)
**Status**: ❌ Needs creation

**Endpoints to Create**:
1. `POST /admin/regions/seed` - Seed regions
2. `POST /admin/catalog/seed` - Seed service catalog
3. `POST /admin/services/seed` - Seed services
4. `POST /admin/vendors/seed` - Seed vendors (for testing)
5. `POST /admin/customers/seed` - Seed customers (for testing)
6. `POST /admin/products/seed` - Seed marketplace products
7. `POST /admin/roles/seed` - Seed roles and permissions
8. `POST /admin/onboarding/seed-forms` - Seed onboarding forms
9. `POST /admin/settings/seed` - Seed platform settings

**Tasks**:
1. ✅ Create seeding endpoint for each entity
2. ✅ Add validation (prevent duplicate seeds)
3. ✅ Add bulk insert capability
4. ✅ Add seeding logs

---

## 📋 PHASE 8: TESTING & VERIFICATION (Week 8)

### 8.1 Journey Testing
**Tasks**:
1. ✅ Test customer journey end-to-end
2. ✅ Test vendor journey end-to-end
3. ✅ Test seller hub journey end-to-end
4. ✅ Test admin operations
5. ✅ Test role configuration
6. ✅ Test onboarding forms

### 8.2 Invariant Verification
**Tasks**:
1. ✅ Verify all entity ownership invariants
2. ✅ Verify all lifecycle invariants
3. ✅ Verify all UI → Data invariants
4. ✅ Verify all policy invariants
5. ✅ Verify all financial invariants
6. ✅ Verify all discovery invariants

---

## 🚨 CRITICAL RULES

### Migration Rules
1. **Never break existing functionality** - Always maintain backward compatibility during migration
2. **One entity at a time** - Migrate one entity type completely before moving to next
3. **Test after each phase** - Verify journey works after each phase
4. **Keep KV as fallback** - During migration, keep KV as fallback, remove after verification
5. **Log everything** - Log all migrations and seeding operations

### Code Rules
1. **Max 3 files per fix** - Follow 3-file fix law
2. **Surgical changes only** - No refactoring, only migration
3. **SQL repositories only** - All new code must use SQL repositories
4. **No KV imports** - Remove all `import * as kv` after migration

---

## 📊 MIGRATION CHECKLIST

### Foundation
- [ ] Region management fully SQL
- [ ] Service catalog fully SQL
- [ ] Seeding endpoints created

### Customer Journey
- [ ] Customer onboarding SQL
- [ ] Customer service discovery SQL
- [ ] Customer booking flow SQL
- [ ] Customer history SQL

### Vendor Journey
- [ ] Vendor onboarding SQL
- [ ] Dynamic forms SQL
- [ ] Vendor dashboard SQL
- [ ] Vendor service management SQL

### Seller Hub
- [ ] Product management SQL
- [ ] Marketplace discovery SQL
- [ ] Order management SQL

### Admin
- [ ] Admin operations SQL
- [ ] Platform settings SQL
- [ ] Policy management SQL

### Role Configuration
- [ ] Role management SQL
- [ ] Permission management SQL
- [ ] Role assignments SQL

### Data Migration
- [ ] KV migration scripts created
- [ ] Data migrated and verified
- [ ] KV fallback removed

### Seeding
- [ ] All seeding endpoints created
- [ ] Seeding tested
- [ ] Seeding documented

---

## 🎯 SUCCESS CRITERIA

1. ✅ Zero KV usage in production code
2. ✅ All journeys work end-to-end
3. ✅ All invariants enforced
4. ✅ All seeding endpoints functional
5. ✅ Data migration complete
6. ✅ No breaking changes

---

## 📅 TIMELINE

- **Week 1**: Foundation (Region & Catalog)
- **Week 2**: Customer Journey
- **Week 3**: Vendor Journey
- **Week 4**: Seller Hub
- **Week 5**: Admin Panel
- **Week 6**: Role Configuration
- **Week 7**: Data Migration & Seeding
- **Week 8**: Testing & Verification

**Total**: 8 weeks for complete migration

---

## 🔍 NEXT STEPS

1. **Review this plan** with team
2. **Prioritize phases** based on business needs
3. **Start with Phase 1** (Foundation)
4. **Test after each phase**
5. **Document as you go**

---

**Created**: 2025-01-23
**Status**: 📋 Planning Complete - Ready for Execution

