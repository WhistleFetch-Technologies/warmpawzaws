# Implementation Alignment Guide

## 🎯 Purpose

Bridge the gap between **handoff checklist specifications** and **actual implementation**. This guide shows exactly how to integrate the new endpoints with your existing codebase.

---

## 📋 Quick Status Summary

| Priority | Feature | Status | Action Required |
|----------|---------|--------|-----------------|
| **P1** | Instant Tele Booking | ✅ **FIXED** | Import new file |
| **P1** | Scheduled Tele Booking | ✅ **FIXED** | Import new file |
| **P1** | Auto-Assignment | ✅ **FIXED** | Included in booking files |
| **P1** | Standardized OTP | ✅ **FIXED** | Import new file |
| **P2** | Service Publishing | ⚠️ **PARTIAL** | Enhancement needed |
| **P2** | Staff Availability | ⚠️ **PARTIAL** | Enhancement needed |
| **P2** | GPS Tracking | ⚠️ **PARTIAL** | Refactoring recommended |

---

## 🚀 Quick Start Integration

### **Step 1: Add New Route Files to Server**

**File:** `/supabase/functions/server/index.tsx`

```typescript
import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';

// ✅ EXISTING IMPORTS (keep these)
import bookingRoutes from './booking-endpoints.tsx';
import vendorRoutes from './vendor-service-management.tsx';
// ... other existing imports

// ✅ NEW IMPORTS (add these)
import instantTeleRoutes from './instant-tele-booking.tsx';
import scheduledTeleRoutes from './scheduled-tele-booking.tsx';
import standardizedOtpRoutes from './standardized-otp-endpoints.tsx';

const app = new Hono();

app.use('*', cors());
app.use('*', logger(console.log));

// ✅ MOUNT NEW ROUTES
app.route('/make-server-3dd53475', instantTeleRoutes);
app.route('/make-server-3dd53475', scheduledTeleRoutes);
app.route('/make-server-3dd53475', standardizedOtpRoutes);

// ✅ EXISTING ROUTES (keep these)
app.route('/make-server-3dd53475', bookingRoutes);
app.route('/make-server-3dd53475', vendorRoutes);
// ... other existing routes

Deno.serve(app.fetch);
```

### **Step 2: Test New Endpoints**

```bash
# Test Instant Tele Booking
curl -X POST http://localhost:54321/functions/v1/make-server-3dd53475/bookings/instant-tele \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "service_001",
    "serviceName": "Instant Consultation",
    "candidateDoctorIds": ["dr_001", "dr_002"],
    "amount": 500,
    "customerId": "customer_123",
    "petId": "pet_456"
  }'

# Test Scheduled Tele Booking
curl -X POST http://localhost:54321/functions/v1/make-server-3dd53475/bookings/scheduled-tele \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "service_002",
    "staffId": "dr_sarah",
    "slotId": "slot_wed_1100",
    "scheduledDate": "2024-12-11",
    "scheduledTime": "11:00",
    "duration": 30,
    "amount": 500
  }'

# Test OTP Generation (new path)
curl -X POST http://localhost:54321/functions/v1/make-server-3dd53475/bookings/booking_123/generate-otp \
  -H "Content-Type: application/json" \
  -d '{
    "sessionNumber": 1,
    "action": "start"
  }'
```

---

## 🔄 Endpoint Migration Map

### **1. Instant Tele Booking**

#### **NEW (Checklist Spec):**
```
POST /bookings/instant-tele
```

#### **OLD (Existing):**
```
POST /bookings/create (generic)
POST /customer/bookings/create
```

#### **Migration Strategy:**

**Option A: Use New Endpoint (Recommended)**
```typescript
// Frontend change
const response = await fetch(
  `${API_BASE}/bookings/instant-tele`,  // NEW PATH
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${publicAnonKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      serviceId,
      serviceName,
      candidateDoctorIds,  // NEW FIELD
      amount,
      customerId,
      petId
    })
  }
);
```

**Option B: Add Wrapper to Existing Endpoint**
```typescript
// In your existing booking-endpoints.tsx
app.post('/bookings/instant-tele', async (c) => {
  // Wrapper that calls your existing /bookings/create
  const body = await c.req.json();
  
  // Transform to your existing format
  const existingFormat = {
    type: 'instant_tele',
    serviceId: body.serviceId,
    // ... map other fields
  };
  
  // Call existing logic
  return handleBookingCreate(c, existingFormat);
});
```

---

### **2. Scheduled Tele Booking**

#### **NEW (Checklist Spec):**
```
POST /bookings/scheduled-tele
```

#### **OLD (Existing):**
```
POST /bookings/create (generic)
```

#### **Key Difference:**
- **NEW**: Pre-assigns staffId in request
- **NEW**: Returns 409 if slot conflict
- **NEW**: Reserves slot immediately

#### **Migration:**
```typescript
// Use new endpoint
const response = await fetch(
  `${API_BASE}/bookings/scheduled-tele`,
  {
    method: 'POST',
    body: JSON.stringify({
      serviceId,
      staffId,        // PRE-ASSIGNED
      slotId,
      scheduledDate,
      scheduledTime,
      duration,
      amount
    })
  }
);

// Handle 409 conflict
if (response.status === 409) {
  const error = await response.json();
  // error.suggestedSlots contains alternatives
  showAlternativeSlots(error.suggestedSlots);
}
```

---

### **3. OTP Endpoints**

#### **NEW (Standardized):**
```
POST /bookings/:bookingId/generate-otp
POST /bookings/:bookingId/verify-otp
```

#### **OLD (Multiple Paths):**
```
POST /booking/:bookingId/generate-otp  (singular)
POST /booking/:bookingId/verify-otp    (singular)
POST /booking/:bookingId/start-session-with-otp
POST /booking/:bookingId/complete-with-otp
POST /customer/:customerId/packages/milestones/:milestoneId/generate-otp
```

#### **Migration:**

**Backward Compatible:** New endpoints include wrappers for old paths

```typescript
// ✅ OLD PATH STILL WORKS (with deprecation warning)
POST /booking/:bookingId/generate-otp
→ Automatically forwards to /bookings/:bookingId/generate-otp

// ✅ RECOMMENDED: Update to new path
POST /bookings/:bookingId/generate-otp
Body: {
  "sessionNumber": 1,
  "action": "start"  // or "end"
}
```

**New Features:**
```typescript
// Multi-session support
POST /bookings/:bookingId/generate-otp
Body: {
  "sessionNumber": 2,  // Different OTP for session 2
  "action": "start"
}

// End session triggers S3 upload
POST /bookings/:bookingId/verify-otp
Body: {
  "otp": "847293",
  "action": "end"  // Triggers uploadSessionToS3()
}
```

---

### **4. Auto-Assignment**

#### **NEW (Implemented):**
```
Internal function: autoAssignInstantTele(bookingId, candidateStaffIds)
Called automatically after payment
```

#### **OLD (Missing):**
```
❌ Not implemented
```

#### **How It Works:**

```typescript
// 1. Customer completes payment
POST /payments/process-instant-tele
Body: {
  "bookingId": "booking_123",
  "paymentId": "pay_456"
}

// 2. Payment endpoint triggers auto-assignment (async)
setTimeout(() => 
  autoAssignInstantTele(bookingId, candidateStaffIds), 
  1000
);

// 3. Frontend polls for assignment
setInterval(async () => {
  const status = await fetch(
    `${API_BASE}/bookings/${bookingId}/status`
  );
  
  if (status.status === 'assigned') {
    // Show assigned doctor
  }
}, 3000);
```

---

## 🔧 Enhanced Existing Endpoints

### **Service Publishing Enhancement**

#### **What Exists:**
```
POST /vendor/:vendorId/services/publish
```

#### **What's Missing (from checklist):**
- `publishLevel` field (vendor vs centre)
- `centres` array
- GPS auto-enablement

#### **Quick Fix:**

**Option 1: Add to Existing Endpoint**
```typescript
// In vendor-service-management.tsx
app.post('/vendor/:vendorId/services/publish', async (c) => {
  const body = await c.req.json();
  
  // ✅ ADD: publishLevel support
  const publishLevel = body.publishLevel || 'vendor';
  
  // ✅ ADD: GPS auto-enablement for home services
  if (body.serviceStyle === 'at_home') {
    body.gpsRequired = true;
    body.gpsTracking = {
      enabled: true,
      mandatory: true,
      trackStaff: true,
      trackCustomer: false
    };
  }
  
  // ✅ ADD: Centre-level publishing
  if (publishLevel === 'centre') {
    if (!body.centres || body.centres.length === 0) {
      return c.json({ 
        error: 'At least one centre required for centre-level publishing' 
      }, 400);
    }
    
    // Publish to each selected centre
    for (const centreId of body.centres) {
      await publishToСentre(centreId, body);
    }
  }
  
  // ... rest of existing logic
});
```

**Option 2: Create New Wrapper Endpoint**
```typescript
// Create /services/publish that wraps existing endpoint
app.post('/services/publish', async (c) => {
  const body = await c.req.json();
  
  // Transform to existing format
  const vendorId = body.vendorId || getCurrentVendorId(c);
  
  // Call existing endpoint
  return app.request(
    `/vendor/${vendorId}/services/publish`,
    { method: 'POST', body: JSON.stringify(body) }
  );
});
```

---

### **Staff Availability Enhancement**

#### **What Exists:**
```
POST /staff/:staffId/availability
GET /:staffId/available-slots
```

#### **What's Missing:**
- Conflict detection (409 responses)
- `mode` field (location vs centre)
- Conditional field validation

#### **Quick Fix:**

```typescript
// In staff-availability-routes.tsx or vendor-services-gap-fixes.tsx
app.post('/staff/:staffId/availability-slots', async (c) => {
  const staffId = c.req.param('staffId');
  const { slot } = await c.req.json();
  
  // ✅ VALIDATION: Home service fields
  if (slot.hasHomeServices) {
    if (!slot.leadTime || slot.leadTime < 30) {
      return c.json({ 
        error: 'Lead time must be at least 30 minutes for home services' 
      }, 400);
    }
    if (!slot.maxDistance || slot.maxDistance <= 0) {
      return c.json({ 
        error: 'Maximum distance required for home services' 
      }, 400);
    }
  }
  
  // ✅ CONFLICT DETECTION
  const conflicts = await detectConflicts(slot, staffId);
  if (conflicts.length > 0) {
    return c.json({
      error: 'Scheduling conflicts detected',
      conflicts,
      details: { conflictCount: conflicts.length }
    }, 409);
  }
  
  // Save slot (existing logic)
  await kv.set(`staff:${staffId}:availability:${slot.id}`, slot);
  
  return c.json({ success: true, slot });
});

async function detectConflicts(newSlot: any, staffId: string) {
  const existing = await kv.getByPrefix(`staff:${staffId}:availability:`);
  const conflicts = [];
  
  for (const item of existing) {
    const slot = item.value;
    if (slot.id === newSlot.id) continue;
    
    // Check time overlap
    if (slot.dayOfWeek === newSlot.dayOfWeek) {
      if (hasTimeOverlap(slot, newSlot)) {
        conflicts.push({
          type: 'overlap',
          message: `Overlaps with ${slot.startTime}-${slot.endTime}`,
          conflictingSlotIds: [slot.id]
        });
      }
    }
  }
  
  return conflicts;
}

function hasTimeOverlap(slot1: any, slot2: any): boolean {
  const start1 = parseTime(slot1.startTime);
  const end1 = parseTime(slot1.endTime);
  const start2 = parseTime(slot2.startTime);
  const end2 = parseTime(slot2.endTime);
  
  return (start1 < end2) && (end1 > start2);
}

function parseTime(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}
```

---

## 📊 Testing Checklist

### **Priority 1: Critical Features**

```
□ Instant Tele Booking
  □ Create booking with candidateDoctorIds
  □ Status = 'pending_payment'
  □ Payment triggers auto-assignment
  □ Auto-assignment completes within 2 minutes
  □ Status = 'assigned' after assignment
  □ Polling endpoint returns assigned doctor

□ Scheduled Tele Booking
  □ Create booking with pre-assigned staffId
  □ Slot reservation works
  □ 409 conflict if slot already booked
  □ Alternative slots suggested on conflict
  □ Status = 'confirmed' immediately

□ Auto-Assignment
  □ Filters by isOnline and availability
  □ Ranks by rating + workload + response time
  □ Assigns highest ranked doctor
  □ Fallback to manual if all busy
  □ Notifications sent to assigned staff

□ Standardized OTP
  □ Generate OTP with 24-hour expiry
  □ Verify OTP with max 3 attempts
  □ Session start sets status='active'
  □ Session end triggers S3 upload
  □ Multi-session support works
```

### **Priority 2: Enhancements**

```
□ Service Publishing
  □ publishLevel (vendor/centre) works
  □ GPS auto-enabled for at_home services
  □ Centre-level publishing works
  □ Price override applies to centres

□ Staff Availability
  □ Conflict detection returns 409
  □ Home service validation (leadTime >= 30)
  □ Tele services skip distance fields
  □ mode field (location/centre) works

□ GPS Tracking
  □ Update location with sessionNumber
  □ Calculate distance and ETA
  □ Route points stored
```

---

## 🚦 Migration Timeline

### **Week 1: Critical Features**
- ✅ Deploy instant-tele-booking.tsx
- ✅ Deploy scheduled-tele-booking.tsx
- ✅ Deploy standardized-otp-endpoints.tsx
- ⚠️ Test auto-assignment flow end-to-end
- ⚠️ Verify OTP backward compatibility

### **Week 2: Enhancements**
- ⚠️ Add publishLevel to service publishing
- ⚠️ Add conflict detection to availability
- ⚠️ Update GPS tracking to use bookingId

### **Week 3: Testing & Documentation**
- ⚠️ Run full regression suite
- ⚠️ Update API documentation
- ⚠️ Create migration guide for frontend

---

## 💡 Best Practices

### **1. Backward Compatibility**

```typescript
// ✅ GOOD: Support both old and new paths
app.post('/booking/:id/generate-otp', oldHandler);  // Deprecated
app.post('/bookings/:id/generate-otp', newHandler); // Standard

// ✅ GOOD: Log deprecation warnings
console.log('⚠️ DEPRECATED: Use /bookings/ (plural)');
```

### **2. Gradual Migration**

```typescript
// ✅ GOOD: Add new endpoint alongside existing
app.post('/bookings/instant-tele', newHandler);
app.post('/bookings/create', existingHandler);  // Keep working

// ❌ BAD: Break existing endpoint immediately
// app.post('/bookings/create', () => { throw new Error() });
```

### **3. Clear Error Messages**

```typescript
// ✅ GOOD: Explain what's wrong and how to fix
return c.json({
  error: 'Slot conflict',
  message: 'This slot was just booked by another customer',
  suggestedSlots: [...],  // Actionable alternatives
  helpUrl: 'https://docs.warmpawz.com/booking-conflicts'
}, 409);

// ❌ BAD: Generic error
return c.json({ error: 'Conflict' }, 409);
```

---

## 📞 Support

### **Issues During Migration?**

1. **Check logs** in Supabase Functions dashboard
2. **Use debug overlay** (Ctrl+Shift+D) to verify configuration
3. **Test with curl** before updating frontend
4. **Contact:** eng@warmpawz.com

### **Common Issues**

```
Issue: "Endpoint not found"
→ Check server/index.tsx imports
→ Verify route mounting

Issue: "OTP not working"
→ Check endpoint path (bookings vs booking)
→ Verify sessionNumber is passed

Issue: "Auto-assignment not triggering"
→ Check payment webhook integration
→ Verify candidateDoctorIds array
```

---

## ✅ Success Criteria

**You'll know migration is successful when:**

✅ All 3 Priority 1 test suites pass
✅ Frontend can book instant tele end-to-end
✅ Frontend can book scheduled tele end-to-end
✅ OTP flow works with new paths
✅ Auto-assignment completes within 2 minutes
✅ No regression in existing booking flows

---

## 📋 Summary

**New Files Created:**
1. `/supabase/functions/server/instant-tele-booking.tsx` ✅
2. `/supabase/functions/server/scheduled-tele-booking.tsx` ✅
3. `/supabase/functions/server/standardized-otp-endpoints.tsx` ✅

**Integration Steps:**
1. Import new files in server/index.tsx
2. Mount routes with `app.route()`
3. Test endpoints with curl
4. Update frontend to use new endpoints
5. Run regression tests

**Timeline:**
- Week 1: Deploy and test critical features
- Week 2: Add enhancements to existing endpoints
- Week 3: Full testing and documentation

**The gap is now bridged! 🎉**

