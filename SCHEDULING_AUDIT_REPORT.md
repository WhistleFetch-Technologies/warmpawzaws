# 📋 Scheduling Logic Audit Report
## Comprehensive Validation of All Service Scheduling Components

**Date:** 2025-01-22  
**Status:** ⚠️ CRITICAL VIOLATIONS FOUND  
**Outcome:** ❌ **No overbooking, no ghost availability** - **NOT ACHIEVED**

---

## Executive Summary

This audit identified **23 critical violations**, **12 missing policies**, and **18 required fixes** across 8 scheduling components. The system has **race condition vulnerabilities** that can lead to overbooking and **ghost availability** issues.

### Critical Issues
- ❌ **Race conditions** in booking creation (no atomic locks)
- ❌ **Inconsistent conflict detection** across endpoints
- ❌ **Missing commute time validation** for home services
- ❌ **No subscription slot reservation** mechanism
- ❌ **Package session tracking** lacks booking validation
- ❌ **Emergency override** bypasses all validations

---

## 1. Centre Schedules

### ✅ Implemented Features
- Operating hours validation (`vendor-schedule-v2.tsx`)
- Time window configuration per day
- Service-specific slot durations
- Vacation mode enforcement

### ❌ Violations Found

#### V1: Hard-coded Capacity Limit
**Location:** `booking-creation.tsx:164`
```typescript
if (conflictCount >= 1) {
  throw new Error('Time slot is fully booked');
}
```
**Issue:** Capacity hard-coded to 1 booking per slot. No configurable capacity per service type.

**Impact:** Cannot handle multiple concurrent bookings (e.g., group sessions, multiple staff).

#### V2: No Atomic Booking Lock
**Location:** `booking-creation.tsx:150-167`
```typescript
const vendorBookings = await kv.get(`vendor:${vendorId}:bookings`) || [];
let conflictCount = 0;

for (const existingBookingId of vendorBookings) {
  // ... check conflicts
}
```
**Issue:** Race condition - two bookings can check availability simultaneously and both pass.

**Impact:** **OVERBOOKING POSSIBLE** - Two customers can book the same slot.

#### V3: Inconsistent Status Filtering
**Location:** Multiple files
- `booking-creation.tsx:159` - Only checks `status !== 'cancelled'`
- `slot-availability-endpoints.tsx:80` - Checks `['scheduled', 'in_progress', 'start_otp_pending', 'end_otp_pending']`
- `vendor-schedule-v2.tsx:316` - Only checks `status !== 'cancelled'`

**Issue:** Different endpoints use different status filters, leading to inconsistent availability.

**Impact:** Ghost availability - slots show as available but are actually booked.

### 🔧 Required Fixes

1. **Add Atomic Booking Lock**
   ```typescript
   // Use distributed lock before checking availability
   const lockKey = `booking:lock:${vendorId}:${scheduledDate}:${scheduledTime}`;
   const lock = await acquireLock(lockKey, 5000); // 5 second timeout
   try {
     // Check availability and create booking atomically
   } finally {
     await releaseLock(lockKey);
   }
   ```

2. **Implement Configurable Capacity**
   ```typescript
   const serviceConfig = dayConfig.serviceConfigs.find(c => c.serviceStyle === serviceStyle);
   const maxCapacity = serviceConfig?.maxCapacity || 1;
   
   if (conflictCount >= maxCapacity) {
     throw new Error('Time slot is fully booked');
   }
   ```

3. **Standardize Status Filtering**
   ```typescript
   const ACTIVE_BOOKING_STATUSES = [
     'confirmed', 'scheduled', 'in_progress', 
     'start_otp_pending', 'end_otp_pending', 'traveling'
   ];
   
   const isActiveBooking = (booking) => 
     ACTIVE_BOOKING_STATUSES.includes(booking.status) && 
     booking.status !== 'cancelled';
   ```

---

## 2. Staff Schedules

### ✅ Implemented Features
- Location-based availability (`schedule-utils.tsx:61-259`)
- Working hours per location
- Break and holiday support
- Buffer time enforcement

### ❌ Violations Found

#### V4: Location Conflict Detection Logic Error
**Location:** `schedule-utils.tsx:224-237`
```typescript
const hasLocationConflict = existingBookings.some(booking => {
  if (booking.date !== dateString) return false;
  if (booking.locationId === locationId) return false; // Same location is OK
  
  // Staff can't be in two locations at the same time
  return !(slotEnd <= bookingStart || slotStart >= bookingEnd);
});
```
**Issue:** Logic is inverted. Returns `false` when there's NO conflict, but the check `!hasLocationConflict` means it only returns slot if there's NO conflict. However, the logic is correct but the variable name is confusing.

**Actually:** The logic is correct - it returns `true` if there IS a conflict. But the check on line 239 `if (!hasLocationConflict)` is correct.

**Real Issue:** Missing validation for travel time between locations.

#### V5: No Travel Time Validation Between Locations
**Location:** `schedule-utils.tsx:223-237`
**Issue:** When staff has bookings at different locations, system doesn't account for travel time between locations.

**Example:** Staff has booking at Location A ending at 10:00 AM, then booking at Location B starting at 10:00 AM. System allows this, but staff can't physically be at both places.

**Impact:** **GHOST AVAILABILITY** - Slots show as available but staff is physically unable to reach them.

#### V6: Break Conflict Detection Missing Day-of-Week Check
**Location:** `schedule-utils.tsx:203-216`
```typescript
const hasBreakConflict = breaks.some((breakItem: any) => {
  if (breakItem.date && breakItem.date !== dateString) return false;
  if (breakItem.dayOfWeek && breakItem.dayOfWeek !== dayOfWeek) return false;
  // ...
});
```
**Issue:** If break has both `date` and `dayOfWeek`, it only checks `date`. Should check both.

**Impact:** Recurring weekly breaks may not be properly detected.

### 🔧 Required Fixes

1. **Add Travel Time Validation**
   ```typescript
   // Calculate travel time between locations
   const travelTime = await calculateTravelTime(
     previousBooking.locationId,
     locationId
   );
   
   const minGapBetweenLocations = travelTime + bufferTime;
   
   const hasLocationConflict = existingBookings.some(booking => {
     if (booking.locationId === locationId) return false;
     
     const bookingEnd = bookingStart + booking.duration;
     const requiredGap = booking.locationId !== locationId 
       ? minGapBetweenLocations 
       : bufferTime;
     
     // Check if there's enough time to travel
     return !(slotEnd <= bookingStart - requiredGap || 
              slotStart >= bookingEnd + requiredGap);
   });
   ```

2. **Fix Break Detection Logic**
   ```typescript
   const hasBreakConflict = breaks.some((breakItem: any) => {
     // Check specific date break
     if (breakItem.date) {
       if (breakItem.date !== dateString) return false;
     }
     // Check recurring day-of-week break
     else if (breakItem.dayOfWeek) {
       if (breakItem.dayOfWeek !== dayOfWeek) return false;
     }
     // If neither specified, skip
     else return false;
     
     // Check time overlap
     // ...
   });
   ```

---

## 3. Distance Radius Filtering

### ✅ Implemented Features
- Haversine distance calculation (`schedule-utils.tsx:30-51`)
- Staff max distance preferences (`staff-discovery-endpoints.tsx:172`)
- Service area configuration (`vendor-schedule-v2.tsx:30`)

### ❌ Violations Found

#### V7: Distance Check Not Enforced During Booking
**Location:** `booking-creation.tsx`
**Issue:** Distance validation happens during staff discovery, but NOT during actual booking creation.

**Impact:** Customer can book staff who is outside their service radius if they somehow get the staff ID.

#### V8: Service Area Not Validated Against Actual Distance
**Location:** `vendor-schedule-v2.tsx:30`
```typescript
serviceArea?: number; // km radius
```
**Issue:** `serviceArea` is configured but never validated against actual customer distance during booking.

**Impact:** Staff may be assigned to customers outside their configured service area.

#### V9: No Real-time Distance Update
**Location:** `staff-discovery-endpoints.tsx:169`
```typescript
const distance = calculateDistance(customerLat, customerLng, staffLat, staffLng);
```
**Issue:** Uses `lastKnownLocation` which may be stale. No real-time location validation.

**Impact:** Staff may have moved, but system still uses old location for distance calculation.

### 🔧 Required Fixes

1. **Enforce Distance Check During Booking**
   ```typescript
   // In booking-creation.tsx, before creating booking
   if (serviceStyle === 'at_home' && customerLocation && staffId) {
     const staff = await kv.get(`staff:${staffId}`);
     const staffLocation = staff.lastKnownLocation || vendor.location;
     
     if (staffLocation) {
       const distance = calculateDistance(
         customerLocation.lat, customerLocation.lng,
         staffLocation.latitude, staffLocation.longitude
       );
       
       const maxDistance = serviceConfig?.serviceArea || 10;
       if (distance > maxDistance) {
         throw new Error(`Staff is outside service area (${distance.toFixed(1)}km > ${maxDistance}km)`);
       }
     }
   }
   ```

2. **Add Service Area Validation**
   ```typescript
   // Validate against configured service area
   const serviceConfig = dayConfig.serviceConfigs.find(
     c => c.serviceStyle === serviceStyle
   );
   
   if (serviceConfig?.serviceArea) {
     if (distance > serviceConfig.serviceArea) {
       throw new Error('Customer outside service area');
     }
   }
   ```

---

## 4. Commute Time & Buffer

### ✅ Implemented Features
- Buffer time per service style (`schedule-settings-endpoints.tsx:91-96`)
- Vendor-specific buffer overrides (`schedule-settings-endpoints.tsx:99-129`)
- Commute time calculation (`home-services-enhanced.tsx:226-327`)

### ❌ Violations Found

#### V10: Commute Time Not Added to Slot Availability
**Location:** `schedule-utils.tsx:136`
```typescript
const minBookableTime = new Date(now.getTime() + bufferTimeMinutes * 60 * 1000);
```
**Issue:** Only uses buffer time. For home services, should also add estimated commute time.

**Impact:** Staff may not have enough time to travel to customer location.

#### V11: Commute Time Calculation Not Used in Booking Validation
**Location:** `booking-creation.tsx`
**Issue:** Commute time is calculated in `home-services-enhanced.tsx` but NOT used during booking creation validation.

**Impact:** Bookings created without verifying staff can physically reach customer in time.

#### V12: Buffer Time Not Applied to Previous Booking End Time
**Location:** `schedule-utils.tsx:182-195`
```typescript
const hasConflict = existingBookings.some(booking => {
  // Check overlap
  const slotStart = currentMinutes;
  const slotEnd = currentMinutes + serviceDuration;
  
  return !(slotEnd <= bookingStart || slotStart >= bookingEnd);
});
```
**Issue:** Checks for exact overlap, but doesn't account for buffer time between bookings.

**Example:** Booking ends at 10:00 AM, next booking can start at 10:00 AM. But with 30-min buffer, next booking should start at 10:30 AM.

**Impact:** **OVERBOOKING** - Staff may not have enough time between appointments.

#### V13: No Traffic Factor in Commute Time
**Location:** `home-services-enhanced.tsx:260-281`
**Issue:** Traffic multiplier is calculated but may not reflect real-time traffic conditions.

**Impact:** Underestimated commute times during peak hours.

### 🔧 Required Fixes

1. **Add Commute Time to Buffer Calculation**
   ```typescript
   let totalBufferTime = bufferTimeMinutes;
   
   if (serviceStyle === 'at_home' && customerLocation && staffLocation) {
     const commuteTime = await calculateCommuteTime(
       staffLocation,
       customerLocation,
       scheduledDate,
       scheduledTime
     );
     totalBufferTime += commuteTime;
   }
   
   const minBookableTime = new Date(now.getTime() + totalBufferTime * 60 * 1000);
   ```

2. **Apply Buffer Time Between Bookings**
   ```typescript
   const hasConflict = existingBookings.some(booking => {
     if (booking.date !== dateString) return false;
     
     const bookingStart = bookingHour * 60 + bookingMin;
     const bookingEnd = bookingStart + (booking.duration || 30);
     
     const slotStart = currentMinutes;
     const slotEnd = currentMinutes + serviceDuration;
     
     // Add buffer time requirement
     const requiredGap = bufferTimeMinutes;
     
     // Check if slot starts before previous booking ends + buffer
     if (slotStart < bookingEnd + requiredGap) return true;
     
     // Check if previous booking starts before slot ends + buffer
     if (bookingStart < slotEnd + requiredGap) return true;
     
     return false;
   });
   ```

3. **Integrate Commute Time in Booking Validation**
   ```typescript
   // In booking-creation.tsx
   if (serviceStyle === 'at_home' && staffId) {
     const commuteTime = await calculateCommuteTimeWithTraffic(
       staffLocation,
       customerLocation,
       scheduledDate,
       scheduledTime
     );
     
     // Verify staff can reach customer in time
     const timeUntilBooking = (new Date(`${scheduledDate}T${scheduledTime}`) - now) / 60000;
     if (timeUntilBooking < commuteTime + bufferTimeMinutes) {
       throw new Error('Insufficient time for staff to reach location');
     }
   }
   ```

---

## 5. Subscription Slot Logic

### ✅ Implemented Features
- Subscription plan creation (`subscription-endpoints.tsx:8-68`)
- Recurring billing calculation (`subscription-endpoints.tsx:86-90`)
- Time slot configuration (`customer-app-enhancements.tsx:260`)

### ❌ Violations Found

#### V14: No Slot Reservation for Subscription Bookings
**Location:** `subscription-endpoints.tsx`
**Issue:** When customer subscribes, system doesn't reserve recurring slots.

**Impact:** Subscription slots may become unavailable if other customers book them first.

#### V15: No Validation of Recurring Slot Availability
**Location:** `subscription-endpoints.tsx:74-118`
**Issue:** Subscription created without checking if recurring slots are available.

**Example:** Customer subscribes for "Every Monday 10 AM", but that slot may already be booked by another customer.

**Impact:** **GHOST AVAILABILITY** - Subscription promises slots that aren't actually available.

#### V16: No Handling of Slot Conflicts for Recurring Bookings
**Location:** `subscription-endpoints.tsx`
**Issue:** If a recurring subscription slot becomes unavailable (e.g., vendor changes schedule), system doesn't handle it.

**Impact:** Subscription bookings may fail silently or cause conflicts.

### 🔧 Required Fixes

1. **Reserve Slots on Subscription Creation**
   ```typescript
   // When subscription is created
   const recurringSlots = generateRecurringSlots(
     plan.frequency, // 'weekly', 'monthly'
     plan.preferredTimeSlot, // '10:00 AM'
     plan.startDate,
     plan.duration // e.g., 3 months
   );
   
   // Reserve each slot
   for (const slot of recurringSlots) {
     await reserveSlotForSubscription(
       vendorId,
       slot.date,
       slot.time,
       subscriptionId
     );
   }
   ```

2. **Validate Slot Availability Before Subscription**
   ```typescript
   // Before creating subscription
   const recurringSlots = generateRecurringSlots(plan);
   
   for (const slot of recurringSlots) {
     const isAvailable = await checkSlotAvailability(
       vendorId,
       slot.date,
       slot.time
     );
     
     if (!isAvailable) {
       throw new Error(`Slot ${slot.date} ${slot.time} is not available`);
     }
   }
   ```

3. **Handle Slot Conflicts Gracefully**
   ```typescript
   // When processing recurring subscription booking
   try {
     await createBookingFromSubscription(subscription, slot);
   } catch (error) {
     if (error.message.includes('fully booked')) {
       // Notify customer and vendor
       await notifySubscriptionConflict(subscription, slot);
       // Try to reschedule
       await attemptReschedule(subscription, slot);
     }
   }
   ```

---

## 6. Package Session Tracking

### ✅ Implemented Features
- Package purchase tracking (`package-endpoints.tsx:369-469`)
- Session redemption (`package-endpoints.tsx:527-597`)
- Usage history (`package-endpoints.tsx:603-630`)

### ❌ Violations Found

#### V17: Package Session Redemption Doesn't Validate Slot Availability
**Location:** `package-endpoints.tsx:527-597`
```typescript
app.post('/make-server-3dd53475/customer/:customerId/packages/:purchaseId/redeem', async (c) => {
  // ... checks package validity
  // ... decrements remainingSessions
  // ❌ NO SLOT AVAILABILITY CHECK
});
```
**Issue:** Package session can be redeemed even if no slots are available.

**Impact:** Customer redeems session but can't book because slot is full.

#### V18: No Atomic Transaction for Session Redemption + Booking
**Location:** `package-endpoints.tsx:565-566`
```typescript
purchase.remainingSessions -= 1;
// ... save purchase
```
**Issue:** Session is decremented BEFORE booking is confirmed. If booking fails, session is lost.

**Impact:** Customer loses session if booking creation fails.

#### V19: Package Session Doesn't Reserve Slot
**Location:** `package-endpoints.tsx`
**Issue:** When package is purchased, sessions aren't pre-reserved. Customer must find available slots later.

**Impact:** Customer may not be able to use all purchased sessions if slots are full.

### 🔧 Required Fixes

1. **Validate Slot Before Redemption**
   ```typescript
   app.post('/.../redeem', async (c) => {
     const { serviceId, bookingId, scheduledDate, scheduledTime } = await c.req.json();
     
     // Validate slot availability BEFORE redeeming
     if (scheduledDate && scheduledTime) {
       const slotAvailable = await checkSlotAvailability(
         vendorId,
         scheduledDate,
         scheduledTime
       );
       
       if (!slotAvailable) {
         return c.json({ 
           error: 'Selected slot is no longer available. Please choose another time.' 
         }, 400);
       }
     }
     
     // Then redeem session
     // ...
   });
   ```

2. **Use Atomic Transaction**
   ```typescript
   // Use transaction or two-phase commit
   try {
     // Phase 1: Reserve slot
     await reserveSlot(vendorId, scheduledDate, scheduledTime, bookingId);
     
     // Phase 2: Redeem session
     purchase.remainingSessions -= 1;
     await kvStore.set(`package:purchase:${purchaseId}`, purchase);
     
     // Phase 3: Create booking
     await createBooking(bookingData);
   } catch (error) {
     // Rollback: Release slot and restore session
     await releaseSlot(vendorId, scheduledDate, scheduledTime);
     purchase.remainingSessions += 1;
     await kvStore.set(`package:purchase:${purchaseId}`, purchase);
     throw error;
   }
   ```

3. **Pre-reserve Slots for Package Sessions**
   ```typescript
   // When package is purchased
   if (packageDetails.preferredTimeSlots) {
     for (const slot of packageDetails.preferredTimeSlots) {
       await reserveSlotForPackage(
         vendorId,
         slot.date,
         slot.time,
         purchaseId
       );
     }
   }
   ```

---

## 7. Emergency Override

### ✅ Implemented Features
- Emergency reassignment (`home-services-endpoints.tsx:638-714`)
- Emergency booking status (`AmbulanceSOS.tsx:74`)

### ❌ Violations Found

#### V20: Emergency Override Bypasses All Validations
**Location:** `home-services-endpoints.tsx:638-714`
```typescript
app.post('/make-server-3dd53475/booking/:bookingId/emergency-reassign', async (c) => {
  // ... finds nearby staff
  // ❌ NO AVAILABILITY CHECK
  // ❌ NO DISTANCE VALIDATION
  // ❌ NO COMMUTE TIME CHECK
  booking.staffId = newStaffId;
  await kv.set(`booking:${bookingId}`, booking);
});
```
**Issue:** Emergency reassignment bypasses all scheduling validations.

**Impact:** **OVERBOOKING** - Emergency can assign staff who is already booked or too far away.

#### V21: No Emergency Booking Queue Management
**Location:** `AmbulanceSOS.tsx:63-98`
**Issue:** Emergency bookings are created immediately without checking if staff can handle them.

**Impact:** Multiple emergency bookings can overwhelm staff.

#### V22: Emergency Doesn't Check Staff Current Location
**Location:** `home-services-endpoints.tsx:669-674`
```typescript
const nearbyStaff = await findNearbyEligibleStaff(
  booking.customerAddress,
  booking.services || [],
  currentStaffId,
  booking.serviceStyle
);
```
**Issue:** Uses `lastKnownLocation` which may be stale. Doesn't check if staff is currently in transit or at another location.

**Impact:** Emergency may assign staff who is physically unable to respond.

### 🔧 Required Fixes

1. **Add Minimal Validation for Emergency**
   ```typescript
   app.post('/.../emergency-reassign', async (c) => {
     // Still check basic constraints
     const newStaff = await kv.get(`staff:${newStaffId}`);
     
     // Check if staff is currently available (not in another emergency)
     if (newStaff.activeEmergencies >= newStaff.maxConcurrentEmergencies) {
       return c.json({ 
         error: 'Staff is handling maximum number of emergencies' 
       }, 400);
     }
     
     // Check if staff can physically reach (with emergency buffer)
     const distance = calculateDistance(...);
     const maxEmergencyDistance = 50; // km
     if (distance > maxEmergencyDistance) {
       return c.json({ 
         error: 'Staff is too far for emergency response' 
       }, 400);
     }
     
     // Then reassign
   });
   ```

2. **Implement Emergency Queue**
   ```typescript
   // Add emergency to queue instead of immediate assignment
   const emergencyQueue = await kv.get(`emergency:queue`) || [];
   emergencyQueue.push({
     bookingId,
     priority: 'high',
     requestedAt: new Date().toISOString(),
     location: booking.customerAddress
   });
   await kv.set(`emergency:queue`, emergencyQueue);
   
   // Process queue with available staff
   await processEmergencyQueue();
   ```

3. **Use Real-time Location for Emergency**
   ```typescript
   // Request real-time location from staff app
   const realTimeLocation = await getStaffRealTimeLocation(staffId);
   
   if (!realTimeLocation) {
     // Fallback to lastKnownLocation but log warning
     console.warn('Using stale location for emergency assignment');
   }
   
   const distance = calculateDistance(
     realTimeLocation || staff.lastKnownLocation,
     emergencyLocation
   );
   ```

---

## 8. Concurrent Booking Prevention

### ✅ Implemented Features
- Conflict detection in `schedule-utils.tsx:182-195`
- Status filtering in multiple endpoints
- Capacity checks in `vendor-schedule-v2.tsx:321-327`

### ❌ Violations Found

#### V23: Race Condition in Booking Creation (CRITICAL)
**Location:** `booking-creation.tsx:150-167`
```typescript
// Thread 1: Checks availability → finds slot available
const vendorBookings = await kv.get(`vendor:${vendorId}:bookings`) || [];
let conflictCount = 0;
// ... checks conflicts → conflictCount = 0

// Thread 2: (SIMULTANEOUSLY) Checks availability → finds slot available
// ... conflictCount = 0

// Thread 1: Creates booking
await saveBooking(booking, phone, customerId);
vendorBookings.unshift(bookingId);
await kv.set(vendorBookingsKey, vendorBookings);

// Thread 2: Creates booking (OVERBOOKING!)
await saveBooking(booking, phone, customerId);
vendorBookings.unshift(bookingId); // Now has 2 bookings for same slot!
```
**Issue:** No atomic lock or transaction. Two requests can check and book simultaneously.

**Impact:** **CRITICAL OVERBOOKING** - Multiple customers can book the same slot.

### 🔧 Required Fixes

1. **Implement Distributed Lock**
   ```typescript
   import { acquireLock, releaseLock } from './distributed-lock.tsx';
   
   export async function createProductionBooking(bookingData: any, saveBooking: Function) {
     const lockKey = `booking:lock:${vendorId}:${scheduledDate}:${scheduledTime}`;
     
     let lock = null;
     try {
       // Acquire lock with 5 second timeout
       lock = await acquireLock(lockKey, 5000);
       
       if (!lock) {
         throw new Error('Could not acquire booking lock. Please try again.');
       }
       
       // Now check availability (atomic)
       const vendorBookings = await kv.get(`vendor:${vendorId}:bookings`) || [];
       // ... check conflicts
       
       if (conflictCount >= maxCapacity) {
         throw new Error('Time slot is fully booked');
       }
       
       // Create booking
       await saveBooking(booking, phone, customerId);
       
     } finally {
       if (lock) {
         await releaseLock(lockKey);
       }
     }
   }
   ```

2. **Implement Optimistic Locking**
   ```typescript
   // Add version number to vendor bookings
   const vendorBookingsKey = `vendor:${vendorId}:bookings`;
   const vendorBookingsData = await kv.get(vendorBookingsKey) || {
     bookings: [],
     version: 0
   };
   
   // Check conflicts
   // ...
   
   // Update with version check
   const updatedData = {
     bookings: [...vendorBookingsData.bookings, bookingId],
     version: vendorBookingsData.version + 1
   };
   
   // Atomic update (fails if version changed)
   const success = await kv.compareAndSet(
     vendorBookingsKey,
     vendorBookingsData,
     updatedData
   );
   
   if (!success) {
     throw new Error('Slot was booked by another customer. Please select another time.');
   }
   ```

3. **Add Idempotency Key**
   ```typescript
   // Client sends idempotency key
   const idempotencyKey = bookingData.idempotencyKey || 
     `booking:${customerId}:${scheduledDate}:${scheduledTime}`;
   
   // Check if booking already exists
   const existingBooking = await kv.get(`idempotency:${idempotencyKey}`);
   if (existingBooking) {
     return {
       success: true,
       booking: existingBooking,
       message: 'Booking already created'
     };
   }
   
   // Create booking
   // ...
   
   // Store idempotency key
   await kv.set(`idempotency:${idempotencyKey}`, booking);
   ```

---

## Missing Policies

### P1: No Global Booking Capacity Policy
**Issue:** No system-wide policy for maximum concurrent bookings per staff/vendor.

**Required:**
```typescript
interface BookingCapacityPolicy {
  maxConcurrentBookingsPerStaff: number;
  maxConcurrentBookingsPerVendor: number;
  maxDailyBookingsPerStaff: number;
  maxDailyBookingsPerVendor: number;
}
```

### P2: No Slot Reservation Policy
**Issue:** No policy for how long slots can be reserved before booking confirmation.

**Required:**
```typescript
interface SlotReservationPolicy {
  reservationTimeout: number; // minutes
  maxReservationsPerCustomer: number;
  allowReservationOverlap: boolean;
}
```

### P3: No Emergency Priority Policy
**Issue:** No policy for handling emergency bookings vs regular bookings.

**Required:**
```typescript
interface EmergencyPolicy {
  canOverrideExistingBookings: boolean;
  maxEmergencyBookingsPerStaff: number;
  emergencyBufferTime: number; // minutes
  autoCancelRegularBookings: boolean;
}
```

### P4: No Subscription Slot Guarantee Policy
**Issue:** No policy for guaranteeing subscription slots.

**Required:**
```typescript
interface SubscriptionSlotPolicy {
  guaranteeSlotsOnSubscription: boolean;
  allowSlotChanges: boolean;
  notificationOnSlotConflict: boolean;
  autoRescheduleOnConflict: boolean;
}
```

### P5: No Package Session Expiry Policy
**Issue:** No policy for package session expiry or validity period.

**Required:**
```typescript
interface PackageSessionPolicy {
  sessionValidityDays: number;
  allowSessionTransfer: boolean;
  refundOnExpiry: boolean;
  maxSessionsPerDay: number;
}
```

### P6: No Commute Time Policy
**Issue:** No policy for maximum commute time or travel distance.

**Required:**
```typescript
interface CommuteTimePolicy {
  maxCommuteTime: number; // minutes
  maxTravelDistance: number; // km
  trafficMultiplier: number;
  requireRealTimeLocation: boolean;
}
```

### P7: No Buffer Time Policy
**Issue:** Buffer time is configurable but no policy for minimum/maximum values.

**Required:**
```typescript
interface BufferTimePolicy {
  minBufferTime: number; // minutes
  maxBufferTime: number; // minutes
  bufferTimePerServiceType: Record<string, number>;
  allowVendorOverride: boolean;
}
```

### P8: No Overbooking Prevention Policy
**Issue:** No explicit policy for preventing overbooking.

**Required:**
```typescript
interface OverbookingPreventionPolicy {
  useAtomicLocks: boolean;
  lockTimeout: number; // milliseconds
  retryAttempts: number;
  fallbackStrategy: 'reject' | 'queue' | 'waitlist';
}
```

### P9: No Ghost Availability Prevention Policy
**Issue:** No policy for preventing ghost availability (showing unavailable slots as available).

**Required:**
```typescript
interface GhostAvailabilityPolicy {
  cacheTimeout: number; // seconds
  realTimeValidation: boolean;
  statusFilterStandardization: string[];
  refreshInterval: number; // seconds
}
```

### P10: No Multi-location Travel Policy
**Issue:** No policy for handling staff travel between multiple locations.

**Required:**
```typescript
interface MultiLocationTravelPolicy {
  minTravelTimeBetweenLocations: number; // minutes
  maxLocationsPerDay: number;
  requireLocationConfirmation: boolean;
  trackRealTimeLocation: boolean;
}
```

### P11: No Subscription Recurrence Policy
**Issue:** No policy for handling subscription recurring bookings.

**Required:**
```typescript
interface SubscriptionRecurrencePolicy {
  reserveAllSlotsOnSubscription: boolean;
  allowSlotModification: boolean;
  handleScheduleChanges: 'cancel' | 'reschedule' | 'notify';
  maxRecurringBookings: number;
}
```

### P12: No Package Session Booking Policy
**Issue:** No policy for how package sessions should be booked.

**Required:**
```typescript
interface PackageSessionBookingPolicy {
  requireSlotAvailability: boolean;
  allowAdvanceBooking: boolean;
  maxAdvanceBookingDays: number;
  sessionExpiryDays: number;
}
```

---

## Priority Fixes

### 🔴 CRITICAL (Fix Immediately)

1. **V23: Race Condition in Booking Creation** - Can cause overbooking
2. **V2: No Atomic Booking Lock** - Allows simultaneous bookings
3. **V12: Buffer Time Not Applied Between Bookings** - Causes scheduling conflicts
4. **V17: Package Session Redemption Doesn't Validate Slots** - Wastes customer sessions

### 🟠 HIGH (Fix Within 1 Week)

5. **V5: No Travel Time Validation Between Locations** - Ghost availability
6. **V10: Commute Time Not Added to Slot Availability** - Staff can't reach in time
7. **V14: No Slot Reservation for Subscription Bookings** - Subscription conflicts
8. **V20: Emergency Override Bypasses All Validations** - Emergency overbooking

### 🟡 MEDIUM (Fix Within 2 Weeks)

9. **V1: Hard-coded Capacity Limit** - Limits scalability
10. **V3: Inconsistent Status Filtering** - Ghost availability
11. **V7: Distance Check Not Enforced During Booking** - Invalid assignments
12. **V11: Commute Time Calculation Not Used in Validation** - Scheduling conflicts

### 🟢 LOW (Fix Within 1 Month)

13. **V4: Location Conflict Detection Logic** - Minor logic issue
14. **V6: Break Conflict Detection Missing Day Check** - Edge case
15. **V8: Service Area Not Validated** - Configuration issue
16. **V9: No Real-time Distance Update** - Performance optimization
17. **V13: No Traffic Factor in Commute Time** - Accuracy improvement
18. **V15-V16: Subscription Slot Validation** - Feature enhancement
19. **V18-V19: Package Session Tracking** - Feature enhancement
20. **V21-V22: Emergency Queue Management** - Feature enhancement

---

## Implementation Roadmap

### Phase 1: Critical Fixes (Week 1)
- [ ] Implement distributed locking for booking creation
- [ ] Add buffer time between bookings
- [ ] Standardize status filtering
- [ ] Add slot validation to package redemption

### Phase 2: High Priority Fixes (Week 2)
- [ ] Add travel time validation between locations
- [ ] Integrate commute time in slot availability
- [ ] Implement subscription slot reservation
- [ ] Add minimal validation for emergency override

### Phase 3: Medium Priority Fixes (Week 3-4)
- [ ] Implement configurable capacity
- [ ] Enforce distance check during booking
- [ ] Add service area validation
- [ ] Use commute time in booking validation

### Phase 4: Policy Implementation (Week 5-6)
- [ ] Implement all 12 missing policies
- [ ] Add policy validation endpoints
- [ ] Create policy management UI
- [ ] Add policy documentation

### Phase 5: Testing & Validation (Week 7-8)
- [ ] Load testing for race conditions
- [ ] End-to-end scheduling tests
- [ ] Performance optimization
- [ ] Documentation updates

---

## Testing Checklist

### Race Condition Tests
- [ ] Two simultaneous bookings for same slot → Should reject one
- [ ] Package redemption + booking creation → Should be atomic
- [ ] Subscription slot reservation → Should prevent conflicts

### Availability Tests
- [ ] Staff at Location A, booking at Location B → Should check travel time
- [ ] Commute time calculation → Should account for traffic
- [ ] Buffer time between bookings → Should prevent overlap

### Validation Tests
- [ ] Distance check during booking → Should reject out-of-range
- [ ] Service area validation → Should enforce limits
- [ ] Emergency override → Should have minimal validation

### Integration Tests
- [ ] Centre schedule + Staff schedule → Should work together
- [ ] Package sessions + Slot availability → Should validate
- [ ] Subscription slots + Regular bookings → Should not conflict

---

## Conclusion

The scheduling system has **fundamental race condition vulnerabilities** that can lead to overbooking and ghost availability. The most critical issue is the lack of atomic locking in booking creation, which allows multiple customers to book the same slot simultaneously.

**Immediate Action Required:**
1. Implement distributed locking for all booking operations
2. Add buffer time validation between bookings
3. Standardize status filtering across all endpoints
4. Add slot validation to package and subscription flows

**Outcome:** ❌ **No overbooking, no ghost availability** - **NOT ACHIEVED**

With the fixes outlined above, the system can achieve: ✅ **No overbooking, no ghost availability**

---

**Report Generated:** 2025-01-22  
**Next Review:** After Phase 1 implementation

