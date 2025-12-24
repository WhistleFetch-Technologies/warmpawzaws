# Comprehensive SQL Migration Plan - All Service Flows

**Date:** 2025-01-27  
**Status:** 🚧 In Progress  
**Objective:** Migrate ALL service flows from KV to SQL with zero KV usage

---

## Migration Scope

### Services to Migrate:
1. ✅ **Home Services** (grooming, training, walker, vet at home)
2. ✅ **Tele Consultation** (instant & scheduled)
3. ⚠️ **Center Bookings** (vet, grooming, training, behaviorist at center)
4. ⚠️ **Package Bookings** (training packages, grooming packages)
5. ⚠️ **Cafe Bookings**
6. ⚠️ **Resort/Boarding Bookings**
7. ⚠️ **Specialized Services** (trainer, walker, nutritionist, behaviourist)
8. ⚠️ **Adoption Services**
9. ⚠️ **Breeder Services**
10. ⚠️ **Insurance Services**
11. ⚠️ **Holiday Services**

---

## Files Requiring Migration

### Priority 1 (Critical Booking Flows):
1. `home-service-booking-flow.tsx` - ⚠️ Uses KV
2. `instant-tele-endpoints.tsx` - ⚠️ Uses KV
3. `tele-consultation-endpoints.tsx` - ⚠️ Uses KV
4. `vet-booking-endpoints.tsx` - ⚠️ Uses KV
5. `grooming-booking-apis.tsx` - ⚠️ Uses KV
6. `scheduled-tele-booking.tsx` - ⚠️ Uses KV
7. `specialized-services-booking.tsx` - ⚠️ Uses KV

### Priority 2 (Booking Management):
8. `booking-lifecycle.tsx` - ⚠️ Uses KV
9. `booking-management-endpoints.tsx` - ⚠️ Uses KV
10. `vendor-booking-actions.tsx` - ⚠️ Uses KV
11. `vendor-bookings.tsx` - ⚠️ Uses KV

### Priority 3 (Service Discovery):
12. `vendor-service-management-refactored.tsx` - ✅ Already SQL (verify)
13. `universal-service-discovery.tsx` - ⚠️ Check for KV usage
14. `customer-services.tsx` - ⚠️ Check for KV usage

---

## Migration Strategy

### Phase 1: Home Services Migration
**File:** `home-service-booking-flow.tsx`
- Replace `kv.get('vendor:${vendorId}')` → `getVendorsRepository().findById()`
- Replace `kv.set('booking:${bookingId}')` → `getBookingsRepository().create()`
- Replace `kv.set('session:tracking:${trackingId}')` → Create `gps_tracking_sessions` table
- Replace `kv.getByPrefix('vendor:')` → `getVendorsRepository().findAll()`

### Phase 2: Tele Services Migration
**Files:** 
- `instant-tele-endpoints.tsx`
- `tele-consultation-endpoints.tsx`
- `scheduled-tele-booking.tsx`

- Replace `kv.get('tele:booking:${bookingId}')` → `getBookingsRepository().findById()`
- Replace `kv.set('tele_session:${sessionId}')` → Create `tele_sessions` table
- Replace `kv.get('tele:queue:${queueId}')` → Create `tele_queues` table
- Replace `kv.get('tele:staff:${staffId}')` → `getStaffRepository().findById()`

### Phase 3: Center Bookings Migration
**Files:**
- `vet-booking-endpoints.tsx`
- `grooming-booking-apis.tsx`

- Use existing `bookings` table
- Replace all KV calls with SQL repositories

### Phase 4: Specialized Services Migration
**Files:**
- `specialized-services-booking.tsx`

- Migrate to use `bookings` table with service_type field

### Phase 5: Other Services Migration
- Cafe, Resort, Package, Adoption, Breeder, Insurance
- All use `bookings` table with appropriate service_type

---

## New SQL Tables Required

1. **`gps_tracking_sessions`** (for home services)
   - id, booking_id, tracking_id, start_location, current_location, waypoints, total_distance, eta, is_active, created_at, updated_at

2. **`tele_sessions`** (for tele consultations)
   - id, booking_id, customer_id, staff_id, call_status, initiated_by, initiated_at, accepted_at, ended_at, duration, session_link, created_at, updated_at

3. **`tele_queues`** (for instant tele queue management)
   - id, role_id, booking_id, customer_id, queue_position, waiting_time, joined_at, assigned_at, created_at, updated_at

---

## Testing Checklist

For each migrated service:
- [ ] Booking creation works
- [ ] Payment processing works
- [ ] Status transitions work
- [ ] OTP verification works
- [ ] Service completion works
- [ ] Settlement creation works
- [ ] Notifications work
- [ ] Vendor discovery works
- [ ] Service discovery works

---

## Migration Progress

- [x] Analysis complete
- [ ] Home services migration
- [ ] Tele services migration
- [ ] Center bookings migration
- [ ] Specialized services migration
- [ ] Other services migration
- [ ] Final audit - zero KV usage
- [ ] End-to-end testing

---

**Last Updated:** 2025-01-27

