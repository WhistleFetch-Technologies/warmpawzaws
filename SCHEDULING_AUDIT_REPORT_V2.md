# Scheduling Logic Audit Report - All Services

## Executive Summary

**Date**: 2025-01-22  
**Status**: ⚠️ **CRITICAL VIOLATIONS FOUND**  
**KV Store Usage**: ❌ **EXTENSIVE** - Must migrate to SQL  
**Compliance**: ⚠️ **GAPS IDENTIFIED**

---

## 1. Centre Schedules

### Current Implementation
- **Storage**: Mixed (KV Store + SQL)
- **KV Store Files**: 
  - `schedule-utils.tsx` - Uses `kv.get()` for vendor schedules
  - `vendor-schedule-v2.tsx` - Uses `kv.get()` for vendor availability
  - `followup-endpoints.tsx` - Uses `kv.get()` for slot checking
- **SQL Files**: 
  - `supabase/lib/repositories/scheduling.ts` - Has `getVendorAvailability()` (SQL)
  - `db/migrations/006_scheduling_system.sql` - Has `vendor_availability_v2` table

### Violations

**V1.1**: Centre schedules stored in KV Store
- **Severity**: CRITICAL
- **Location**: `schedule-utils.tsx:83`, `vendor-schedule-v2.tsx:308`
- **Impact**: No ACID guarantees, no proper indexing, race conditions

**V1.2**: No validation of centre schedule conflicts
- **Severity**: HIGH
- **Location**: `vendor-schedule-v2.tsx:231-335`
- **Impact**: Can create overlapping time windows

**V1.3**: Centre schedule not checked before booking
- **Severity**: HIGH
- **Location**: `schedule-utils.tsx:265-308`
- **Impact**: Bookings can be created outside operating hours

**V1.4**: No SQL migration for existing KV centre schedules
- **Severity**: HIGH
- **Impact**: Data loss risk during migration

---

## 2. Staff Schedules

### Current Implementation
- **Storage**: Mixed (KV Store + SQL)
- **KV Store Files**:
  - `schedule-utils.tsx:61-259` - Uses `kv.get()` for staff availability
  - `staff-availability-routes.tsx` - Uses `kv.get()` for staff schedules
- **SQL Files**:
  - `supabase/lib/repositories/scheduling.ts` - Has `getStaffAvailability()` (SQL)
  - `db/migrations/006_scheduling_system.sql` - Has `staff_availability_slots` table

### Violations

**V2.1**: Staff schedules stored in KV Store
- **Severity**: CRITICAL
- **Location**: `schedule-utils.tsx:83`, `staff-availability-routes.tsx:94`
- **Impact**: No ACID guarantees, race conditions

**V2.2**: Staff breaks not properly validated
- **Severity**: HIGH
- **Location**: `schedule-utils.tsx:202-216`
- **Impact**: Bookings can overlap with breaks

**V2.3**: Staff holidays not checked
- **Severity**: HIGH
- **Location**: `schedule-utils.tsx` (missing)
- **Impact**: Bookings can be created on holidays

**V2.4**: Multi-location staff conflicts not fully validated
- **Severity**: HIGH
- **Location**: `supabase/lib/services/scheduling-service.ts:104-120`
- **Impact**: Staff can be double-booked across locations

---

## 3. Distance Radius Filtering

### Current Implementation
- **Storage**: Mixed (KV Store + SQL)
- **KV Store Files**:
  - `home-services-endpoints.tsx:822-886` - Uses `kv.getByPrefix()` for staff
  - `staff-discovery-endpoints.tsx:153-184` - Uses KV for distance calculation
- **SQL Files**:
  - `supabase/lib/services/scheduling-service.ts:219-259` - Has `validateDistance()` (SQL)
  - `supabase/lib/repositories/scheduling.ts:455-510` - Has `getCommuteTime()` (SQL)

### Violations

**V3.1**: Distance filtering uses KV Store
- **Severity**: CRITICAL
- **Location**: `home-services-endpoints.tsx:832`, `staff-discovery-endpoints.tsx:169`
- **Impact**: Inefficient, no proper indexing

**V3.2**: Distance calculation not cached properly
- **Severity**: MEDIUM
- **Location**: `supabase/lib/repositories/scheduling.ts:464-504`
- **Impact**: Performance issues with repeated calculations

**V3.3**: Service area radius not enforced consistently
- **Severity**: HIGH
- **Location**: Multiple files
- **Impact**: Staff can be assigned outside service area

**V3.4**: Real-time location not used for distance calculation
- **Severity**: MEDIUM
- **Location**: `home-services-endpoints.tsx:847`
- **Impact**: Uses stale location data

---

## 4. Commute Time & Buffer

### Current Implementation
- **Storage**: SQL (mostly)
- **SQL Files**:
  - `supabase/lib/services/scheduling-service.ts:264-307` - Has `validateCommuteTime()` (SQL)
  - `supabase/lib/repositories/scheduling.ts:455-510` - Has `getCommuteTime()` (SQL)
  - `db/migrations/006_scheduling_system.sql` - Has `commute_time_cache` table

### Violations

**V4.1**: Commute time calculation uses simplified formula
- **Severity**: MEDIUM
- **Location**: `supabase/lib/repositories/scheduling.ts:483-484`
- **Impact**: Not accurate (uses 3 min/km, should use Google Maps API)

**V4.2**: Traffic factor hardcoded
- **Severity**: MEDIUM
- **Location**: `supabase/lib/repositories/scheduling.ts:485`
- **Impact**: Does not account for real-time traffic

**V4.3**: Buffer time not validated for all service types
- **Severity**: HIGH
- **Location**: `supabase/lib/services/scheduling-service.ts:312-361`
- **Impact**: Buffer time violations possible

**V4.4**: Buffer time policy not enforced consistently
- **Severity**: HIGH
- **Location**: Multiple files
- **Impact**: Inconsistent buffer time application

---

## 5. Subscriptions Slot Logic

### Current Implementation
- **Storage**: SQL (mostly)
- **SQL Files**:
  - `supabase/lib/services/scheduling-service.ts:366-407` - Has `reserveSubscriptionSlots()` (SQL)
  - `supabase/lib/repositories/scheduling.ts:364-386` - Has `reserveSlotForSubscription()` (SQL)
  - `db/migrations/006_scheduling_system.sql` - Has `subscription_slot_reservations` table

### Violations

**V5.1**: Subscription slot validation not atomic
- **Severity**: HIGH
- **Location**: `supabase/lib/services/scheduling-service.ts:375-388`
- **Impact**: Race conditions possible

**V5.2**: Subscription slots not checked for conflicts
- **Severity**: HIGH
- **Location**: `supabase/lib/services/scheduling-service.ts:376-381`
- **Impact**: Can reserve conflicting slots

**V5.3**: Recurring subscription slots not properly handled
- **Severity**: MEDIUM
- **Location**: Missing implementation
- **Impact**: Weekly/monthly subscriptions not fully supported

**V5.4**: Subscription slot cancellation not handled
- **Severity**: MEDIUM
- **Location**: Missing implementation
- **Impact**: Cancelled subscriptions still hold slots

---

## 6. Package Session Tracking

### Current Implementation
- **Storage**: Mixed (KV Store + SQL)
- **KV Store Files**:
  - `package-endpoints.tsx:527-597` - Uses `kvStore.set()` for package sessions
- **SQL Files**:
  - `supabase/lib/services/scheduling-service.ts:412-468` - Has `redeemPackageSession()` (SQL)
  - `db/migrations/006_scheduling_system.sql` - Has `package_sessions` table

### Violations

**V6.1**: Package session tracking uses KV Store
- **Severity**: CRITICAL
- **Location**: `package-endpoints.tsx:560-583`
- **Impact**: No ACID guarantees, data loss risk

**V6.2**: Package session slot validation not atomic
- **Severity**: HIGH
- **Location**: `supabase/lib/services/scheduling-service.ts:420-435`
- **Impact**: Race conditions possible

**V6.3**: Package session expiry not enforced
- **Severity**: MEDIUM
- **Location**: Missing implementation
- **Impact**: Expired sessions can still be used

**V6.4**: Package session transfer not supported
- **Severity**: LOW
- **Location**: Missing implementation
- **Impact**: Cannot transfer sessions between customers

---

## 7. Emergency Override

### Current Implementation
- **Storage**: KV Store
- **KV Store Files**:
  - `home-services-endpoints.tsx:638-714` - Uses `kv.get()` for emergency reassignment
  - `home-services-endpoints.tsx:822-886` - Uses `kv.getByPrefix()` for finding staff

### Violations

**V7.1**: Emergency override uses KV Store
- **Severity**: CRITICAL
- **Location**: `home-services-endpoints.tsx:645`, `home-services-endpoints.tsx:832`
- **Impact**: No ACID guarantees, race conditions

**V7.2**: Emergency override not logged in audit trail
- **Severity**: HIGH
- **Location**: `home-services-endpoints.tsx:638-714`
- **Impact**: Cannot track emergency reassignments

**V7.3**: Emergency override policy not enforced
- **Severity**: HIGH
- **Location**: `home-services-endpoints.tsx:652-654`
- **Impact**: Can override bookings without proper authorization

**V7.4**: Emergency queue not implemented
- **Severity**: HIGH
- **Location**: Missing implementation
- **Impact**: No priority-based emergency handling

**V7.5**: Emergency override can bypass capacity limits
- **Severity**: CRITICAL
- **Location**: `home-services-endpoints.tsx:638-714`
- **Impact**: Can cause overbooking

---

## 8. Concurrent Booking Prevention

### Current Implementation
- **Storage**: SQL (mostly)
- **SQL Files**:
  - `supabase/lib/services/scheduling-service.ts:42-214` - Has `createBookingWithValidation()` (SQL)
  - `supabase/lib/repositories/scheduling.ts:92-137` - Has `acquireBookingLock()` (SQL)
  - `db/migrations/006_scheduling_system.sql` - Has `booking_locks` table

### Violations

**V8.1**: Concurrent booking prevention not used everywhere
- **Severity**: CRITICAL
- **Location**: Multiple files still use KV Store for booking creation
- **Impact**: Race conditions in booking creation

**V8.2**: Lock timeout too short
- **Severity**: MEDIUM
- **Location**: `supabase/lib/services/scheduling-service.ts:54`
- **Impact**: Locks expire too quickly (5 seconds)

**V8.3**: Lock cleanup not automated
- **Severity**: MEDIUM
- **Location**: `db/migrations/006_scheduling_system.sql:143-148`
- **Impact**: Expired locks accumulate

**V8.4**: Concurrent booking validation not atomic
- **Severity**: HIGH
- **Location**: `supabase/lib/services/scheduling-service.ts:65-101`
- **Impact**: Check-then-act race condition

---

## Missing Policies

### Policy 1: Centre Schedule Policy
- **Status**: ❌ **MISSING**
- **Required**: Policy for centre operating hours, holidays, special hours
- **Impact**: No standardized centre schedule management

### Policy 2: Staff Schedule Policy
- **Status**: ❌ **MISSING**
- **Required**: Policy for staff working hours, breaks, holidays, multi-location assignments
- **Impact**: Inconsistent staff schedule management

### Policy 3: Distance Radius Policy
- **Status**: ⚠️ **PARTIAL**
- **Required**: Policy for service area radius, distance calculation method, real-time location usage
- **Impact**: Inconsistent distance filtering

### Policy 4: Commute Time Policy
- **Status**: ✅ **EXISTS** (in SQL)
- **Required**: Already defined in `scheduling_policies` table
- **Impact**: None

### Policy 5: Buffer Time Policy
- **Status**: ✅ **EXISTS** (in SQL)
- **Required**: Already defined in `scheduling_policies` table
- **Impact**: None

### Policy 6: Subscription Slot Policy
- **Status**: ✅ **EXISTS** (in SQL)
- **Required**: Already defined in `scheduling_policies` table
- **Impact**: None

### Policy 7: Package Session Policy
- **Status**: ✅ **EXISTS** (in SQL)
- **Required**: Already defined in `scheduling_policies` table
- **Impact**: None

### Policy 8: Emergency Override Policy
- **Status**: ✅ **EXISTS** (in SQL)
- **Required**: Already defined in `scheduling_policies` table
- **Impact**: Not enforced in code

### Policy 9: Concurrent Booking Policy
- **Status**: ✅ **EXISTS** (in SQL)
- **Required**: Already defined in `scheduling_policies` table
- **Impact**: Not fully implemented

---

## Required Fixes

### Fix 1: Migrate Centre Schedules to SQL
- **Priority**: CRITICAL
- **Files to Update**:
  - `schedule-utils.tsx` - Replace KV with SQL
  - `vendor-schedule-v2.tsx` - Replace KV with SQL
  - `followup-endpoints.tsx` - Replace KV with SQL
- **Action**: Use `vendor_availability_v2` table from SQL

### Fix 2: Migrate Staff Schedules to SQL
- **Priority**: CRITICAL
- **Files to Update**:
  - `schedule-utils.tsx` - Replace KV with SQL
  - `staff-availability-routes.tsx` - Replace KV with SQL
- **Action**: Use `staff_availability_slots` table from SQL

### Fix 3: Migrate Distance Filtering to SQL
- **Priority**: CRITICAL
- **Files to Update**:
  - `home-services-endpoints.tsx` - Replace KV with SQL
  - `staff-discovery-endpoints.tsx` - Replace KV with SQL
- **Action**: Use SQL queries with geospatial indexes

### Fix 4: Migrate Package Sessions to SQL
- **Priority**: CRITICAL
- **Files to Update**:
  - `package-endpoints.tsx` - Replace KV with SQL
- **Action**: Use `package_sessions` table from SQL

### Fix 5: Migrate Emergency Override to SQL
- **Priority**: CRITICAL
- **Files to Update**:
  - `home-services-endpoints.tsx` - Replace KV with SQL
- **Action**: Use `emergency_booking_queue` table from SQL

### Fix 6: Implement Atomic Subscription Slot Reservation
- **Priority**: HIGH
- **Files to Update**:
  - `supabase/lib/services/scheduling-service.ts:366-407`
- **Action**: Use database transaction for validation + reservation

### Fix 7: Implement Atomic Package Session Redemption
- **Priority**: HIGH
- **Files to Update**:
  - `supabase/lib/services/scheduling-service.ts:412-468`
- **Action**: Use database transaction for validation + redemption

### Fix 8: Enforce Emergency Override Policy
- **Priority**: HIGH
- **Files to Update**:
  - `home-services-endpoints.tsx:638-714`
- **Action**: Check policy before allowing override

### Fix 9: Implement Emergency Queue
- **Priority**: HIGH
- **Files to Create**:
  - New service for emergency queue management
- **Action**: Use `emergency_booking_queue` table

### Fix 10: Improve Commute Time Calculation
- **Priority**: MEDIUM
- **Files to Update**:
  - `supabase/lib/repositories/scheduling.ts:455-510`
- **Action**: Integrate Google Maps API for accurate commute time

### Fix 11: Implement Staff Holiday Checking
- **Priority**: HIGH
- **Files to Update**:
  - `schedule-utils.tsx`
- **Action**: Query `staff_holidays` table before slot generation

### Fix 12: Implement Subscription Slot Cancellation
- **Priority**: MEDIUM
- **Files to Create**:
  - New endpoint for subscription slot cancellation
- **Action**: Update `subscription_slot_reservations` table

### Fix 13: Implement Package Session Expiry
- **Priority**: MEDIUM
- **Files to Update**:
  - `supabase/lib/services/scheduling-service.ts:412-468`
- **Action**: Check expiry date before redemption

### Fix 14: Increase Lock Timeout
- **Priority**: MEDIUM
- **Files to Update**:
  - `supabase/lib/services/scheduling-service.ts:54`
- **Action**: Increase from 5 to 30 seconds

### Fix 15: Automate Lock Cleanup
- **Priority**: MEDIUM
- **Files to Update**:
  - `db/migrations/006_scheduling_system.sql`
- **Action**: Add scheduled job to cleanup expired locks

---

## Summary of Violations

### Critical Violations (Must Fix)
1. **V1.1**: Centre schedules in KV Store
2. **V2.1**: Staff schedules in KV Store
3. **V3.1**: Distance filtering uses KV Store
4. **V6.1**: Package sessions in KV Store
5. **V7.1**: Emergency override uses KV Store
6. **V8.1**: Concurrent booking prevention not used everywhere

### High Priority Violations
1. **V1.2**: No validation of centre schedule conflicts
2. **V1.3**: Centre schedule not checked before booking
3. **V2.2**: Staff breaks not properly validated
4. **V2.3**: Staff holidays not checked
5. **V2.4**: Multi-location staff conflicts not fully validated
6. **V3.3**: Service area radius not enforced consistently
7. **V4.3**: Buffer time not validated for all service types
8. **V4.4**: Buffer time policy not enforced consistently
9. **V5.1**: Subscription slot validation not atomic
10. **V5.2**: Subscription slots not checked for conflicts
11. **V6.2**: Package session slot validation not atomic
12. **V7.2**: Emergency override not logged in audit trail
13. **V7.3**: Emergency override policy not enforced
14. **V7.4**: Emergency queue not implemented
15. **V7.5**: Emergency override can bypass capacity limits
16. **V8.4**: Concurrent booking validation not atomic

### Medium Priority Violations
1. **V3.2**: Distance calculation not cached properly
2. **V3.4**: Real-time location not used for distance calculation
3. **V4.1**: Commute time calculation uses simplified formula
4. **V4.2**: Traffic factor hardcoded
5. **V5.3**: Recurring subscription slots not properly handled
6. **V5.4**: Subscription slot cancellation not handled
7. **V6.3**: Package session expiry not enforced
8. **V8.2**: Lock timeout too short
9. **V8.3**: Lock cleanup not automated

---

## Files Requiring Migration

### Files Using KV Store (Must Migrate)
1. `src/supabase/functions/server/schedule-utils.tsx` - Centre & staff schedules
2. `src/supabase/functions/server/vendor-schedule-v2.tsx` - Vendor schedules
3. `src/supabase/functions/server/followup-endpoints.tsx` - Slot checking
4. `src/supabase/functions/server/staff-availability-routes.tsx` - Staff schedules
5. `src/supabase/functions/server/home-services-endpoints.tsx` - Emergency override, distance filtering
6. `src/supabase/functions/server/staff-discovery-endpoints.tsx` - Distance filtering
7. `src/supabase/functions/server/package-endpoints.tsx` - Package sessions

### Files Already Using SQL (Keep)
1. `supabase/lib/services/scheduling-service.ts` - ✅ SQL-based
2. `supabase/lib/repositories/scheduling.ts` - ✅ SQL-based
3. `db/migrations/006_scheduling_system.sql` - ✅ SQL schema

---

## Expected Outcome

After fixes:
- ✅ All scheduling uses SQL (no KV Store)
- ✅ Centre schedules validated
- ✅ Staff schedules validated
- ✅ Distance radius filtering accurate
- ✅ Commute time & buffer enforced
- ✅ Subscription slots atomic
- ✅ Package sessions tracked in SQL
- ✅ Emergency override with policy enforcement
- ✅ Concurrent booking prevention everywhere

---

**Total Violations**: 29  
**Critical**: 6  
**High Priority**: 16  
**Medium Priority**: 9  
**Missing Policies**: 2 (Centre Schedule, Staff Schedule)  
**Files Requiring Migration**: 7

