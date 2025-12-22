# KV to SQL Migration - Complete Audit & Mapping

**Date:** 2024-12-22  
**Status:** Phase 1 - Audit Complete  
**Migration Goal:** Replace all KV-store usage with normalized SQL tables while preserving existing KV data

---

## Executive Summary

### Current State
- **KV Store Implementation:** PostgreSQL-backed (`kv_store_3dd53475` table with `key TEXT PRIMARY KEY, value JSONB`)
- **KV API Usage:** 1,800+ occurrences across 200+ files
- **Key Patterns Identified:** 100+ distinct key patterns
- **UI Forms:** 50+ forms across customer, vendor, and admin interfaces

### Migration Scope
- **Total Files Using KV:** ~200 files
- **Primary Location:** `supabase/functions/make-server-3dd53475/`
- **KV Operations:** get, set, del, getByPrefix, mget, mset, mdel
- **TTL Logic:** None identified (KV store doesn't support TTL, using `expires_at` in SQL)

---

## Part 1: KV Key Pattern Inventory

### 1.1 Entity-Based Keys

#### Bookings
```
booking:{bookingId}
bookings:emergency:queue
booking:pending
pending_reschedules
```

**Current Usage:**
- Store booking details, status, payment info
- Track emergency booking queue
- Manage pending reschedules

**SQL Target:** `bookings` table

#### Payments
```
payment:{paymentId}
customer:{customerId}:payments
vendor:{vendorId}:payments
payment:refund_rules
payment:tiers
```

**Current Usage:**
- Payment records
- Customer payment history
- Vendor payment history
- Refund rules and tier configurations

**SQL Target:** `payments`, `payment_history`, `refund_rules`, `payment_tiers` tables

#### Vendors
```
vendor:{vendorId}
vendor:{vendorId}:enrollments
vendor:{vendorId}:payouts
vendor:{vendorId}:services
vendor:{vendorId}:staff
```

**Current Usage:**
- Vendor profiles
- Vendor service enrollments
- Payout records
- Service listings
- Staff assignments

**SQL Target:** `vendors`, `vendor_enrollments`, `vendor_payouts`, `vendor_services`, `vendor_staff` tables

#### Customers
```
customer:{customerId}
customer:{customerId}:payments
customer:{customerId}:bookings
customer:{customerId}:pets
```

**Current Usage:**
- Customer profiles
- Payment history
- Booking history
- Pet profiles

**SQL Target:** `customers`, `customer_payments`, `customer_bookings`, `pets` tables

#### Staff
```
staff:{staffId}
staff:{staffId}:service:{serviceId}
staff:{staffId}:schedule
staff:{staffId}:availability
```

**Current Usage:**
- Staff profiles
- Staff-service mappings
- Schedule information
- Availability slots

**SQL Target:** `staff`, `staff_services`, `staff_schedules`, `staff_availability` tables

#### Services
```
service:{serviceId}
service:catalog
service:categories
service:grooming
services:all
```

**Current Usage:**
- Service definitions
- Catalog listings
- Category mappings
- Service-specific data

**SQL Target:** `services`, `service_catalog`, `service_categories` tables

### 1.2 Configuration & Settings Keys

#### Platform Settings
```
platform:settings
platform:revenue
platform:schedule_settings
platform:gst_configs
platform:gst_rules
platform:refund_settings
platform:settlement_schedule
platform:service_catalog
platform:tax_categories
platform:hsn_codes
platform:cancellation_policies
platform:promotions
platform:integrations:razorpay
platform_admins
```

**Current Usage:**
- Global platform configuration
- Revenue tracking
- GST rules and configurations
- Refund policies
- Settlement schedules
- Service catalog
- Tax categories
- HSN codes
- Cancellation policies
- Promotions
- Integration settings

**SQL Target:** `platform_settings`, `platform_revenue`, `gst_configs`, `gst_rules`, `refund_policies`, `settlement_schedules`, `tax_categories`, `hsn_codes`, `cancellation_policies`, `promotions`, `platform_integrations` tables

#### Admin Settings
```
admin:settings:payment
admin:settings:payment_gateway
admin:settings:payment_gateways
admin:settings:payout_rules
admin:settings:refund_tiers
admin:settings:return_policies
admin:settings:schedule
admin:settings:sms
admin:settings:aws
admin:settings:google_maps
admin:settings:logistics_partners
admin:settings:logistics_rules
admin:settings:delivery_rules
admin:booking_rules
admin:payment_rules
admin:payout:policies
admin:refund_policies
admin:refund_tiers
admin:coupons
admin:roles:list
admin:settlements:pending
admin:catalog_stats
admin:platform:vendor_settings
```

**Current Usage:**
- Admin-specific configurations
- Payment gateway settings
- Payout rules
- Refund tier configurations
- Return policies
- Schedule settings
- SMS configuration
- AWS integration
- Google Maps API
- Logistics partner settings
- Booking rules
- Coupon management
- Role management
- Settlement tracking
- Catalog statistics

**SQL Target:** `admin_settings`, `payment_gateways`, `payout_rules`, `refund_tiers`, `return_policies`, `schedule_settings`, `sms_config`, `aws_config`, `google_maps_config`, `logistics_partners`, `logistics_rules`, `delivery_rules`, `booking_rules`, `coupons`, `admin_roles`, `settlements`, `catalog_stats` tables

### 1.3 E-commerce Keys

```
ecommerce:categories
ecommerce:commission_settings
ecommerce:logistics_vendors
ecommerce:promotions
ecommerce:ad_campaigns
```

**Current Usage:**
- E-commerce category management
- Commission settings
- Logistics vendor assignments
- Promotions
- Ad campaign management

**SQL Target:** `ecommerce_categories`, `commission_settings`, `logistics_vendors`, `ecommerce_promotions`, `ad_campaigns` tables

### 1.4 Catalog & Content Keys

```
catalog:categories
catalog:products
catalog:pricing
catalog:bulk_operations
catalog:exports
content:assets:all
content:banners:all
assets:library
```

**Current Usage:**
- Catalog management
- Product listings
- Pricing information
- Bulk operations tracking
- Export jobs
- Content assets
- Banner management
- Asset library

**SQL Target:** `catalog_categories`, `catalog_products`, `catalog_pricing`, `bulk_operations`, `export_jobs`, `content_assets`, `content_banners`, `asset_library` tables

### 1.5 Search & Analytics Keys

```
search_index_master
search_history_trie
search-analytics
search_popular
search_zero_results
performance_metrics
cache_stats
```

**Current Usage:**
- Search index management
- Search history tracking
- Analytics data
- Popular searches
- Zero-result tracking
- Performance metrics
- Cache statistics

**SQL Target:** `search_index`, `search_history`, `search_analytics`, `popular_searches`, `zero_result_searches`, `performance_metrics`, `cache_stats` tables

### 1.6 Regional & Location Keys

```
region_india
region_{regionId}
regions:list
```

**Current Usage:**
- Regional configurations
- Region-specific settings
- Region listings

**SQL Target:** `regions` table

### 1.7 Specialized Service Keys

```
custom-services:pending-approval
dating_profiles:owner:all
dating_profiles:pet:all
medicine:reorders:pending
payouts:pending
pending_settlements
reminders:queue
```

**Current Usage:**
- Custom service approvals
- Dating profile management
- Medicine reorder tracking
- Pending payouts
- Pending settlements
- Reminder queue

**SQL Target:** `custom_services`, `dating_profiles`, `medicine_reorders`, `payouts`, `settlements`, `reminders` tables

### 1.8 System & Health Keys

```
health:check
health:quick
health_check
cache:shiprocket:token
logistics_available_partners
subscription_tiers:all
loyalty_rules
marketing:promotions
promotions:list
coupons:list
featured:vendors
rbac:permissions:list
config:ui:dashboard
```

**Current Usage:**
- Health check status
- Cache tokens
- Logistics partner availability
- Subscription tier management
- Loyalty program rules
- Marketing promotions
- Featured vendor listings
- RBAC permissions
- UI configuration

**SQL Target:** `health_checks`, `cache_tokens`, `logistics_partners`, `subscription_tiers`, `loyalty_rules`, `marketing_promotions`, `featured_vendors`, `rbac_permissions`, `ui_config` tables

### 1.9 Order & Transaction Keys

```
order:{orderId}
payout:{payoutId}
refund:{refundId}
```

**Current Usage:**
- Order management
- Payout processing
- Refund tracking

**SQL Target:** `orders`, `payouts`, `refunds` tables

### 1.10 Statistics & Analytics Keys

```
stats:vendor:{vendorId}:{date}
stats:item:{itemId}:{date}
adoption_nudge_stats
```

**Current Usage:**
- Vendor statistics by date
- Item statistics by date
- Adoption metrics

**SQL Target:** `vendor_stats`, `item_stats`, `adoption_stats` tables

---

## Part 2: UI Form Field Mapping

### 2.1 Vendor Onboarding Forms

#### DynamicVendorOnboardingForm
**Location:** `src/components/vendor/DynamicVendorOnboardingForm.tsx`

**Fields Identified:**
- Basic Information:
  - businessName (text, required)
  - ownerName (text, required)
  - email (email, required)
  - phone (tel, required)
  - alternatePhone (tel, optional)
  - address (textarea, required)
  - city (text, required)
  - state (text, required)
  - pincode (text, required)
  - landmark (text, optional)

- Business Details:
  - roleId (select, required)
  - category (select, required)
  - services (multiselect, required)
  - experience (number, optional)
  - registrationNumber (text, optional)
  - gstNumber (text, optional)
  - panNumber (text, optional)

- Location & Service Areas:
  - serviceAreas (multiselect, required)
  - latitude (number, optional)
  - longitude (number, optional)

- Banking Details:
  - bankName (text, required)
  - accountNumber (text, required)
  - ifscCode (text, required)
  - accountHolderName (text, required)

- Additional Details:
  - operatingHours (text, optional)
  - capacity (number, optional)
  - certifications (multiselect, optional)
  - specialization (text, optional)

- Documents:
  - Various document uploads (file, optional)
  - Document types vary by role

**SQL Target:** `vendor_profiles`, `vendor_bank_details`, `vendor_documents`, `vendor_service_areas` tables

#### AddVendorModal (Admin)
**Location:** `src/components/admin/AddVendorModal.tsx`

**Fields:**
- businessName, ownerName, email, phone, alternatePhone
- roleId, category, services, experience
- registrationNumber, gstNumber, panNumber
- address, city, state, pincode, landmark, serviceAreas
- bankName, accountNumber, ifscCode, accountHolderName
- operatingHours, capacity, certifications, specialization
- tier, commission, status (admin-only)

**SQL Target:** Same as above + `vendor_tiers`, `vendor_commissions` tables

### 2.2 Customer Forms

#### CustomerUserProfile
**Location:** `src/components/customer/CustomerUserProfile.tsx`

**Fields:**
- fullName (text, required)
- email (email, required)
- phone (tel, required)
- address (textarea, optional)
- city (text, optional)
- state (text, optional)
- pincode (text, optional)
- dateOfBirth (date, optional)
- gender (select, optional)

**SQL Target:** `customers` table

### 2.3 Staff Management Forms

#### StaffFormModal
**Location:** `src/components/vendor/StaffManagement.tsx`

**Fields:**
- name (text, required)
- phone (tel, required)
- email (email, required)
- role (select, required)
- specialization (multiselect, optional)
- experience (number, optional)
- certifications (multiselect, optional)
- services (multiselect, required)
- schedule (complex object)
- availability (complex object)

**SQL Target:** `staff`, `staff_specializations`, `staff_services`, `staff_schedules`, `staff_availability` tables

### 2.4 Booking Forms

**Multiple booking forms across customer components:**
- Pet selection
- Service selection
- Date/time selection
- Address selection
- Payment method
- Discount codes
- Loyalty points usage

**SQL Target:** `bookings`, `booking_items`, `booking_payments` tables

### 2.5 Payment Forms

**Payment-related forms:**
- Payment method selection
- Wallet top-up
- Refund requests
- Payout requests

**SQL Target:** `payments`, `wallet_transactions`, `refunds`, `payouts` tables

---

## Part 3: KV Operation Patterns

### 3.1 Read Patterns

#### Single Key Reads
```typescript
const booking = await kv.get(`booking:${bookingId}`);
const vendor = await kv.get(`vendor:${vendorId}`);
const payment = await kv.get(`payment:${paymentId}`);
```

**SQL Equivalent:**
```sql
SELECT * FROM bookings WHERE id = $1;
SELECT * FROM vendors WHERE id = $1;
SELECT * FROM payments WHERE id = $1;
```

#### Prefix Scans
```typescript
const staffServices = await kv.getByPrefix(`staff:${staffId}:service:`);
const vendorPayments = await kv.getByPrefix(`vendor:${vendorId}:payments`);
```

**SQL Equivalent:**
```sql
SELECT * FROM staff_services WHERE staff_id = $1;
SELECT * FROM payments WHERE vendor_id = $1;
```

#### Multi-Key Reads
```typescript
const keys = [`booking:${id1}`, `booking:${id2}`, `booking:${id3}`];
const bookings = await kv.mget(keys);
```

**SQL Equivalent:**
```sql
SELECT * FROM bookings WHERE id IN ($1, $2, $3);
```

### 3.2 Write Patterns

#### Single Key Writes
```typescript
await kv.set(`booking:${bookingId}`, bookingData);
await kv.set(`payment:${paymentId}`, paymentData);
```

**SQL Equivalent:**
```sql
INSERT INTO bookings (...) VALUES (...) ON CONFLICT (id) DO UPDATE SET ...;
INSERT INTO payments (...) VALUES (...) ON CONFLICT (id) DO UPDATE SET ...;
```

#### Batch Writes
```typescript
await kv.mset([
  [`booking:${id1}`, data1],
  [`booking:${id2}`, data2],
]);
```

**SQL Equivalent:**
```sql
BEGIN;
INSERT INTO bookings (...) VALUES (...), (...);
COMMIT;
```

### 3.3 Delete Patterns

```typescript
await kv.del(`booking:${bookingId}`);
await kv.mdel([`key1`, `key2`, `key3`]);
```

**SQL Equivalent:**
```sql
DELETE FROM bookings WHERE id = $1;
DELETE FROM table WHERE id IN ($1, $2, $3);
```

---

## Part 4: TTL & Expiration Logic

### Current State
- **KV Store:** No native TTL support
- **Expiration Logic:** None found in current codebase
- **Future Requirement:** Use `expires_at TIMESTAMPTZ` columns with indexes

### SQL Implementation
```sql
-- Example: OTP tokens with expiration
CREATE TABLE otp_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_otp_expires_at ON otp_tokens(expires_at) WHERE expires_at > NOW();
```

---

## Part 5: Atomic Operations & Transactions

### Current KV Atomic Operations
- **Optimistic Locking:** Simulated via read-modify-write
- **Transactions:** Not supported in current KV implementation

### SQL Implementation
```sql
-- Use transactions for atomic operations
BEGIN;
  UPDATE bookings SET status = 'confirmed' WHERE id = $1 AND status = 'pending';
  INSERT INTO payment_history (booking_id, amount) VALUES ($1, $2);
COMMIT;

-- Use row-level locking for concurrency
SELECT * FROM bookings WHERE id = $1 FOR UPDATE;
```

---

## Part 6: Migration Priority Matrix

### High Priority (Core Business Logic)
1. **Bookings** - `booking:*` keys
2. **Payments** - `payment:*` keys
3. **Vendors** - `vendor:*` keys
4. **Customers** - `customer:*` keys
5. **Orders** - `order:*` keys

### Medium Priority (Configuration)
1. **Platform Settings** - `platform:*` keys
2. **Admin Settings** - `admin:*` keys
3. **Service Catalog** - `service:*` keys
4. **Staff Management** - `staff:*` keys

### Low Priority (Analytics & Caching)
1. **Search Index** - `search_*` keys
2. **Statistics** - `stats:*` keys
3. **Cache** - `cache:*` keys
4. **Health Checks** - `health:*` keys

---

## Part 7: Files Requiring Refactoring

### Critical Files (High Usage)
1. `supabase/functions/make-server-3dd53475/index.tsx` - Main entry point
2. `supabase/functions/make-server-3dd53475/payment-endpoints.tsx` - Payment logic
3. `supabase/functions/make-server-3dd53475/booking-endpoints.tsx` - Booking logic
4. `supabase/functions/make-server-3dd53475/vendor-*.tsx` - All vendor endpoints
5. `supabase/functions/make-server-3dd53475/customer-*.tsx` - All customer endpoints

### Supporting Files
- All files importing `kv_store.tsx` or `kv-safe.tsx`
- Estimated: 200+ files

---

## Part 8: Data Preservation Strategy

### KV Data Migration
1. **Read all KV data** from `kv_store_3dd53475` table
2. **Transform** JSONB values to normalized SQL rows
3. **Insert** into new SQL tables
4. **Verify** data integrity
5. **Keep KV table** as read-only archive

### Migration Script Structure
```sql
-- Migration script will:
-- 1. Create new tables
-- 2. Migrate data from kv_store_3dd53475
-- 3. Create indexes
-- 4. Set up foreign keys
-- 5. Verify data counts
```

---

## Next Steps

1. **Phase 2:** Design normalized SQL schemas
2. **Phase 3:** Create migration scripts
3. **Phase 4:** Build repository layer
4. **Phase 5:** Refactor functions incrementally
5. **Phase 6:** Performance optimization
6. **Phase 7:** Add guardrails
7. **Phase 8:** Verification & testing

---

**End of Phase 1 Audit**

