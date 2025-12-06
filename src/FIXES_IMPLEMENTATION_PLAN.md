# 🔧 FIXES IMPLEMENTATION PLAN

## Overview
Implementing fixes for the 3 critical issues identified from console logs:
1. Grooming centers not loading (0 results)
2. New vet clinics showing 0 services despite having published services  
3. Slot booking returning 404 errors

---

## FIX 1: Slot Availability Endpoint (CRITICAL - BLOCKING BOOKINGS)

### Problem
```
GET /staff/vendor_9876543216/availability/2025-11-25 404 (Not Found)
```

### Root Cause
- Frontend is passing `vendorId` to `/staff/:staffId/availability/:date`
- Endpoint expects `staffId`, not `vendorId`
- For center services, customer doesn't select staff - automatic assignment

### Solution
Create a vendor-level availability endpoint that aggregates slots from all staff:
- `/vendor/:vendorId/availability/:date`

This endpoint will:
1. Get all active staff for the vendor
2. Fetch availability for each staff member
3. Combine and deduplicate time slots
4. Return aggregated availability with staff info for booking

### Implementation
1. Create new endpoint in `/supabase/functions/server/slot-availability-endpoints.tsx`
2. Update `/components/customer/grooming/TimeSlotSelector.tsx` to use new endpoint
3. Also update for vet services (same component used)

---

## FIX 2: Service Filtering in Profile Views (CRITICAL - SHOWING 0 SERVICES)

### Problem
```
Omega: Shows "41 services" in listing
✅ [VET-PROFILE] Found 0 services for clinic vendor_9611377119
```

### Root Cause
Incorrect filtering logic in VetCenterProfileView.tsx:
```typescript
const isVet = roleId.includes('vet') || roleId.includes('veterinarian');
return matchesVendor && matchesStyle && isVet;  // ❌ roleId might be "healthcare_provider"
```

### Solution
Remove role-based filtering - vendorId match is sufficient:
```typescript
return matchesVendor && matchesStyle && (isPublished || publishStatus === 'published');
```

### Files to Fix
1. `/components/customer/vet/VetCenterProfileView.tsx` (Lines ~84-92)
2. `/components/customer/grooming/GroomingCenterProfileView.tsx` (if it exists)
3. Any other profile views

---

## FIX 3: Grooming Centers Not Loading (CRITICAL - NO RESULTS)

### Problem
```
✅ Found 35 grooming services from 2 groomers
📦 [GROOMING-LIST] Search response: {results: Array(0), total: 0}
```

### Root Cause
Universal search returns STAFF, but grooming centers might not have staff set up properly,  
OR staff aren't linked to services correctly

### Solution Option A: Fix Data
Ensure all grooming vendors have:
1. Staff members created
2. Services assigned to staff
3. isPublished/publishStatus set correctly

### Solution Option B: Modify Search (RECOMMENDED)
Make universal search return FACILITIES when serviceStyle=at_center:
1. For at_center → return facilities/vendors with services
2. For at_home → return staff with services
3. For tele → return based on role configuration

### Implementation
Modify `/supabase/functions/server/universal-customer-search.tsx`:
- Add logic to detect at_center and return vendor/facility objects instead of staff
- Keep existing staff logic for at_home services
- Ensure service counts are accurate

---

## IMPLEMENTATION ORDER

### Phase 1: Emergency Fixes (NOW) - Unblock Users
1. ✅ Fix slot endpoint (create vendor-level availability)
2. ✅ Fix service filtering (remove incorrect role checks)
3. ✅ Test booking flow end-to-end

### Phase 2: Center Listing (TODAY)
1. ✅ Modify universal search for at_center
2. ✅ Test grooming center listing
3. ✅ Test vet center listing
4. ✅ Verify service counts match

### Phase 3: Universal Booking Flow (TOMORROW)
1. ✅ Create universal booking components
2. ✅ Remove role-specific code
3. ✅ Test all vendor types
4. ✅ Document golden framework

---

## CODE CHANGES

### Change 1: Create Vendor Availability Endpoint

File: `/supabase/functions/server/slot-availability-endpoints.tsx`

Add after existing `/staff/:staffId/availability/:date` endpoint:

```typescript
/**
 * GET /make-server-3dd53475/vendor/:vendorId/availability/:date
 * 
 * Get aggregated availability for all staff at a vendor/center
 * Used for center-based services where customer doesn't select specific staff
 */
app.get('/make-server-3dd53475/vendor/:vendorId/availability/:date', async (c) => {
  try {
    const { vendorId, date } = c.req.param();
    
    console.log(`\n🏥 ===== GET VENDOR AVAILABILITY (ALL STAFF) =====`);
    console.log(`🏢 Vendor ID: ${vendorId}`);
    console.log(`📅 Date: ${date}`);
    
    // Validate date
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return c.json({ success: false, error: 'Invalid date format' }, 400);
    }
    
    // Get vendor
    const vendor = await kv.get(`vendor:${vendorId}`);
    if (!vendor) {
      return c.json({ success: false, error: 'Vendor not found' }, 404);
    }
    
    // Get all staff for this vendor
    const staffIds = await kv.get(`vendor:${vendorId}:staff`) || [];
    console.log(`👥 Found ${staffIds.length} staff members`);
    
    if (staffIds.length === 0) {
      return c.json({
        success: false,
        error: 'No staff members found for this vendor',
        message: 'Please contact support'
      }, 404);
    }
    
    // Fetch availability for each staff
    const allSlots: any[] = [];
    const staffAvailability: any[] = [];
    
    for (const staffId of staffIds) {
      const staff = await kv.get(`staff:${staffId}`);
      if (!staff || !staff.isActive) continue;
      
      // Get staff schedule
      let schedule = await kv.get(`doctor:${staffId}:availability:${date}`) ||
                     await kv.get(`staff:${staffId}:availability:${date}`) ||
                     await kv.get(`groomer:${staffId}:availability:${date}`) ||
                     await kv.get(`trainer:${staffId}:availability:${date}`);
      
      if (!schedule || !schedule.slots) {
        // Generate default slots
        schedule = {
          date,
          slots: generateDefaultSlots(date, staff.workingHours || { start: '09:00', end: '18:00' })
        };
      }
      
      // Check bookings and apply slot blocking
      const bookingsOnDate = await kv.getByPrefix(`booking:`);
      const staffBookings = bookingsOnDate.filter((b: any) =>
        b.staffId === staffId &&
        b.scheduledDate === date &&
        ['scheduled', 'in_progress', 'start_otp_pending', 'end_otp_pending'].includes(b.status)
      );
      
      // Mark booked slots
      const processedSlots = schedule.slots.map((slot: any) => {
        const booking = staffBookings.find((b: any) => b.scheduledTime === slot.time);
        return {
          ...slot,
          status: booking ? 'booked' : (slot.status || 'available'),
          staffId,
          staffName: staff.fullName || staff.name,
          bookingId: booking?.id
        };
      });
      
      staffAvailability.push({
        staffId,
        staffName: staff.fullName || staff.name,
        slots: processedSlots,
        availableCount: processedSlots.filter((s: any) => s.status === 'available').length
      });
      
      // Add to combined slots
      allSlots.push(...processedSlots.filter((s: any) => s.status === 'available'));
    }
    
    // Deduplicate slots by time, keep earliest staff
    const uniqueSlots = Array.from(
      allSlots.reduce((map, slot) => {
        if (!map.has(slot.time)) {
          map.set(slot.time, slot);
        }
        return map;
      }, new Map())
    ).map(([_, slot]) => slot);
    
    // Sort by time
    uniqueSlots.sort((a, b) => a.time.localeCompare(b.time));
    
    console.log(`✅ Aggregated ${uniqueSlots.length} available slots across ${staffIds.length} staff`);
    
    return c.json({
      success: true,
      date,
      vendorId,
      vendorName: vendor.businessName || vendor.fullName,
      slots: uniqueSlots,
      staffAvailability,
      availableCount: uniqueSlots.length,
      staffCount: staffIds.length
    });
    
  } catch (error: any) {
    console.error('❌ Error fetching vendor availability:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch availability',
      message: error.message
    }, 500);
  }
});

// Helper function (add if not exists)
function generateDefaultSlots(date: string, workingHours: { start: string; end: string }) {
  const slots: any[] = [];
  const [startHour, startMin] = workingHours.start.split(':').map(Number);
  const [endHour, endMin] = workingHours.end.split(':').map(Number);
  
  let currentHour = startHour;
  let currentMin = startMin;
  
  while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
    const time = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
    slots.push({
      time,
      status: 'available',
      slotId: `slot_${date}_${time.replace(':', '')}`
    });
    
    // Increment by 30 minutes
    currentMin += 30;
    if (currentMin >= 60) {
      currentMin -= 60;
      currentHour += 1;
    }
  }
  
  return slots;
}
```

### Change 2: Update TimeSlotSelector to Use Vendor Endpoint

File: `/components/customer/grooming/TimeSlotSelector.tsx`

Line ~58:
```typescript
// BEFORE
const response = await fetch(
  `${API_BASE}/staff/${vendorId}/availability/${date}`,
  { headers: { Authorization: `Bearer ${publicAnonKey}` } }
);

// AFTER
const response = await fetch(
  `${API_BASE}/vendor/${vendorId}/availability/${date}`,  // ✅ Changed to vendor endpoint
  { headers: { Authorization: `Bearer ${publicAnonKey}` } }
);
```

### Change 3: Fix Service Filtering in Profile Views

File: `/components/customer/vet/VetCenterProfileView.tsx`

Lines ~84-92:
```typescript
// BEFORE
const clinicServices = servicesData.services
  .filter((service: any) => {
    const matchesVendor = service.vendorId === centerId;
    const matchesStyle = service.serviceStyle === 'at_center';
    const roleId = (service.vendorRoleId || '').toLowerCase();
    const isVet = roleId.includes('vet') || roleId.includes('veterinarian');
    return matchesVendor && matchesStyle && isVet;
  })

// AFTER
const clinicServices = servicesData.services
  .filter((service: any) => {
    const matchesVendor = service.vendorId === centerId;
    const matchesStyle = service.serviceStyle === 'at_center';
    const isPublished = service.isPublished === true || 
                       service.publishStatus === 'published';
    return matchesVendor && matchesStyle && isPublished;
  })
```

---

## TESTING STEPS

### Test 1: Slot Booking
1. Navigate to vet clinic profile
2. Click "Book Appointment"
3. Select service
4. Select pet
5. Select date
6. Verify slots load (no 404)
7. Select slot and complete booking

### Test 2: Service Display  
1. Navigate to Omega Clinic profile
2. Verify "41 services" shows in services tab
3. Navigate to Cura Pet clinic profile
4. Verify "4 services" shows in services tab

### Test 3: Grooming Centers
1. Click "Grooming" in customer home
2. Verify grooming centers load
3. Verify service counts are accurate
4. Click a center
5. Verify services show in profile
6. Complete booking flow

---

**Status**: Ready to implement - starting with Fix 1 (slot availability)
