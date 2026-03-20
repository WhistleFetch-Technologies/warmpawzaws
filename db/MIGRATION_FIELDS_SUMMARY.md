# Database Fields Created Locally - Migration to Production RDS

This document lists all database fields/columns that have been created locally and need to be migrated to production RDS.

**Date Generated:** 2026-02-28  
**Purpose:** Identify all schema changes that need to be applied to production

---

## 📋 Summary by Table

### 1. **vendors** table

#### From Migration Files:
- **available_for_instant_tele** (BOOLEAN, DEFAULT false) - Migration 600
  - Whether vendor is available for instant tele consultations
  
- **availability_configured** (BOOLEAN, DEFAULT false) - Migration 605
  - Tracks whether vendor has completed availability/schedule setup
  
- **services_configured** (BOOLEAN, DEFAULT false) - Migration 605
  - Tracks whether vendor has completed services setup
  
- **profile_photo_url** (TEXT) - Migration 560
  - URL to vendor profile photo (stored in S3)
  
- **pincode** (TEXT, nullable) - Migration 560
  - Vendor location pincode (6-digit postal code)
  
- **service_radius** (NUMERIC(5, 2)) - Migration 560
  - Service radius in kilometers for at_home services
  
- **qualifications** (TEXT) - Migration 560
  - Professional qualifications and certifications
  
- **service_area** (TEXT) - Migration 560
  - Service area coverage description
  
- **description** (TEXT) - Migration 560
  - Professional bio/description for vendor profile

#### From Inline Code Changes:
- **metadata** (JSONB) - Added in `service-discovery.customer.ts` and `vendor-schedule.ts`
  - Additional metadata for vendors

---

### 2. **bookings** table

#### From Migration Files:
- **is_instant_tele** (BOOLEAN, DEFAULT false) - Migration 607
  - Indicates if booking was created through instant tele consultation flow
  
- **video_call_meeting_id** (TEXT) - Migration 544
  - AWS Chime meeting ID for video calls
  
- **video_call_started_at** (TIMESTAMPTZ) - Migration 544
  - Timestamp when video call started
  
- **video_call_ended_at** (TIMESTAMPTZ) - Migration 544
  - Timestamp when video call ended
  
- **video_call_duration** (INTEGER) - Migration 544
  - Video call duration in seconds
  
- **video_call_status** (TEXT) - Migration 544
  - Video call status: active, completed, cancelled, etc.
  
- **customer_phone** (VARCHAR(20)) - Migration 541
  - Customer phone number (denormalized from customers table)
  
- **duration_minutes** (INTEGER) - Migration 541
  - Total duration in minutes for booking
  
- **total_duration_minutes** (INTEGER) - Migration 541
  - Total duration in minutes including all services
  
- **pet_id** (UUID, FK to pets) - Migration 541
  - Pet ID for this booking
  
- **selected_services** (JSONB, DEFAULT '[]') - Migration 541
  - Array of selected services
  
- **subscription_id** (UUID) - Migration 541
  - Subscription used for this booking
  
- **subscription_booking** (BOOLEAN, DEFAULT false) - Migration 541
  - Flag indicating if this is a subscription booking
  
- **room_id** (UUID) - Migration 541
  - Room ID for boarding/resort bookings
  
- **package_purchase_id** (UUID) - Migration 541
  - Package purchase ID used for this booking
  
- **is_package_session** (BOOLEAN, DEFAULT false) - Migration 541
  - Flag indicating if this is a package session booking
  
- **package_session_number** (INTEGER) - Migration 541
  - Session number within the package
  
- **estimated_arrival** (TIMESTAMPTZ) - Migration 541
  - Estimated arrival time for home service bookings

---

### 3. **prescriptions** table

#### From Migration Files:
- **general_notes** (TEXT) - Migration 563
  - General notes about the prescription
  
- **next_follow_up_date** (DATE) - Migration 564
  - Next follow-up appointment date for the prescription
  
- **prescription_date** (DATE, NOT NULL, DEFAULT CURRENT_DATE) - Migration 565
  - Date when prescription was issued (with default value fix)

---

### 4. **pharmacy_orders** table

#### From Inline Code Changes (pharmacy-orders.ts):
- **customer_phone** (VARCHAR(20)) - Line 158
- **prescription_url** (TEXT) - Line 159
- **subtotal** (DECIMAL(10,2), DEFAULT 0) - Line 2285
- **delivery_fee** (DECIMAL(10,2), DEFAULT 0) - Line 2287
- **platform_fee** (DECIMAL(10,2), DEFAULT 0) - Line 2288
- **convenience_fee** (DECIMAL(10,2), DEFAULT 0) - Line 2289
- **tax_amount** (DECIMAL(10,2), DEFAULT 0) - Line 2290
- **tax_breakdown** (JSONB) - Line 2291
- **total_amount** (DECIMAL(10,2), DEFAULT 0) - Line 2292
- **delivery_lat** (DECIMAL(10,6)) - Line 2293
- **delivery_lng** (DECIMAL(10,6)) - Line 2294
- **prescription_verified** (BOOLEAN, DEFAULT false) - Line 2295
- **current_broadcast_radius** (INTEGER, DEFAULT 5) - Line 2296
- **max_broadcast_radius** (INTEGER, DEFAULT 20) - Line 2297
- **broadcast_started_at** (TIMESTAMP WITH TIME ZONE) - Line 2298

---

### 5. **pharmacy_broadcasts** table

#### From Inline Code Changes (pharmacy-orders.ts):
- **updated_at** (TIMESTAMPTZ, DEFAULT NOW()) - Line 160

---

### 6. **video_call_sessions** table

#### From Migration Files:
- **customer_join_token** (TEXT) - Migration 542
  - AWS Chime join token for customer attendee
  
- **vendor_join_token** (TEXT) - Migration 542
  - AWS Chime join token for vendor attendee
  
- **staff_id** (UUID, FK to staff) - Migration 542
  - Optional staff member ID if staff is joining the call

---

### 7. **vendor_availability_v2** table

#### From Inline Code Changes (vendor-schedule.ts):
- **service_styles** (TEXT[], DEFAULT '{}') - Line 1506
- **location_data** (JSONB) - Line 1507
- **buffer_time** (INTEGER, DEFAULT 15) - Line 1508
- **lead_time_by_style** (JSONB) - Line 1509

---

### 8. **vendor_identity** table

#### From Inline Code Changes (staff.ts):
- **user_type** (VARCHAR(20), DEFAULT 'vendor') - Line 840
- **metadata** (JSONB, DEFAULT '{}') - Line 851

---

### 9. **vendor_documents** table

#### From Migration Files:
- **updated_at** (TIMESTAMPTZ, DEFAULT NOW()) - Migration 602
  - Timestamp when the document was last updated
  - Includes trigger for automatic updates

---

### 10. **cancellation_policies** table

#### From Migration Files:
- **cancellation_windows** (JSONB, DEFAULT '[]') - Migration 536
  - Array of cancellation window configurations
  
- **vendor_cancellation_penalty** (JSONB, DEFAULT '{"enabled":true,"penaltyPercentage":10,"compensationPercentage":50}') - Migration 536
  - When provider cancels: penalty configuration
  
- **no_show_policy** (JSONB, DEFAULT '{"enabled":true,"refundPercentage":0,"penaltyAmount":0}') - Migration 536
  - No-show policy configuration
  
- **service_category** (TEXT) - Migration 536
  - Optional: veterinary, grooming, walkers_training_boarding, ecommerce
  
- **service_format** (TEXT) - Migration 536
  - Optional: in_clinic, teleconsultation, doorstep, centre

---

### 11. **vendor_refund_tiers** table

#### From Migration Files:
- **max_partial_refund_percentage** (NUMERIC(5, 2)) - Migration 536
  - Cap on partial refund percentage
  
- **service_category** (TEXT) - Migration 536
  - Optional service category
  
- **service_format** (TEXT) - Migration 536
  - Optional service format

---

### 12. **ecommerce_policies** table

#### From Migration Files:
- **return_window_hours** (INTEGER, DEFAULT 48) - Migration 536
  - Return/replacement request window in hours
  
- **cancel_before_dispatch_full_refund** (BOOLEAN, DEFAULT true) - Migration 536
  - If true, order cancelled before dispatch gets full refund
  
- **non_returnable_categories** (TEXT[], DEFAULT '{}') - Migration 536
  - Categories that cannot be returned

---

### 13. **service_catalog** table

#### From Migration Files:
- **tax_category_id** (UUID, FK to tax_categories) - Migration 600
  - Tax category for this service
  
- **hsn_code_id** (UUID, FK to hsn_codes) - Migration 600
  - HSN code for this service (optional override)

---

### 14. **gst_rules** table

#### From Migration Files:
- **tax_category_id** (UUID, FK to tax_categories) - Migration 600
  - Tax category for rule

---

### 15. **hsn_codes** table

#### From Migration Files:
- **category_id** (UUID, FK to tax_categories) - Migration 600
  - Tax category for this HSN code
  
- **hsn_code** (TEXT) - Migration 600
  - HSN code field (handles variance from 'code' column)

---

### 16. **promotions** table

#### From Migration Files:
- **code** (VARCHAR(50)) - Migration 603
  - Promotion/coupon code for customer-facing validation

---

### 17. **onboarding_forms** table

#### From Inline Code Changes (onboarding-form-management.ts):
- **sections** (JSONB) - Line 695

---

### 18. **orders** table

#### From Inline Code Changes (admin-advanced.ts):
- Dynamic columns added based on configuration - Line 9186
  - Check code for specific columns being added dynamically

---

### 19. **admin_comprehensive** related tables

#### From Inline Code Changes (admin-comprehensive.ts):
- **conditions_metadata** (TEXT) - Lines 4274, 4370, 4403
  - Added to multiple tables (check specific tables in code)

---

## 🚨 Critical Notes

### Inline Schema Changes
The following files contain **inline ALTER TABLE** statements that should be moved to migration files:
1. `backend/lambda/src/endpoints/pharmacy-orders.ts` - Multiple pharmacy_orders columns
2. `backend/lambda/src/endpoints/vendor-schedule.ts` - vendor_availability_v2 columns
3. `backend/lambda/src/endpoints/staff.ts` - vendor_identity columns
4. `backend/lambda/src/endpoints/customer/customerEndpoint/service-discovery.customer.ts` - vendors.metadata
5. `backend/lambda/src/endpoints/onboarding-form-management.ts` - onboarding_forms.sections

### Migration Files to Apply (in order)
1. 536_cancellation_refund_policy_business_rules.sql
2. 541_add_missing_booking_columns.sql
3. 542_add_video_call_sessions_join_tokens.sql
4. 544_add_bookings_video_call_columns.sql
5. 560_ensure_vendor_profile_columns_prod.sql
6. 561_ensure_otp_tokens_table_prod.sql (if exists)
7. 562_add_allowed_service_styles_problem_grid_mappings.sql (if exists)
8. 563_add_prescriptions_general_notes_column.sql
9. 564_add_prescriptions_next_follow_up_date_column.sql
10. 565_ensure_prescription_date_default_dev.sql
11. 600_add_vendor_available_for_instant_tele.sql
12. 600_tax_360_mapping.sql
13. 602_add_updated_at_to_vendor_documents.sql
14. 603_add_code_to_promotions.sql
15. 605_add_availability_configured_column.sql
16. 607_add_bookings_is_instant_tele.sql

### Recommended Actions
1. **Create migration files** for all inline schema changes
2. **Test migrations** on staging/dev environment first
3. **Apply migrations** to production in the order listed above
4. **Remove inline ALTER TABLE** statements from code after migrations are applied
5. **Verify schema** matches between local and production after migration

---

## 📊 Statistics

- **Total Tables Affected:** 19+
- **Total New Columns:** 60+
- **Migration Files:** 16 recent migrations (536-607)
- **Inline Changes:** 5+ files with runtime schema modifications

---

## ⚠️ Warnings

1. Some migrations may have dependencies - check foreign key constraints
2. Inline schema changes should be converted to proper migration files
3. Test all migrations on a copy of production data before applying
4. Some columns have default values that may affect existing data
5. Indexes are created in some migrations - verify they don't conflict
