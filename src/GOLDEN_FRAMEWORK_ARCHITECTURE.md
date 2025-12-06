# 🏆 WARMPAWZ GOLDEN FRAMEWORK - Universal Vendor Architecture

## 🎯 Core Principle
**ONE FRAMEWORK FOR ALL VENDOR TYPES** - No matter if it's grooming, vet, training, boarding, walking, or any future role, the system must work identically.

---

## 📋 Current Problems (From Console Logs)

### Issue 1: Grooming Centers Not Loading
```
✅ Found 35 grooming services from 2 groomers
📦 [GROOMING-LIST] Search response: {results: Array(0), total: 0}
✅ [GROOMING-LIST] Found 0 unique grooming centers
```
**Root Cause**: Universal search API not returning grooming centers properly

### Issue 2: New Vet Clinics Missing Services
```
Omega Clinic: Shows "41 services" in listing
📦 [VET-PROFILE] All services: {services: Array(101), total: 101}
✅ [VET-PROFILE] Found 0 services for clinic vendor_9611377119
```
**Root Cause**: Filtering logic in profile view is too restrictive or incorrect

### Issue 3: Slot Booking 404 Error
```
GET /staff/vendor_9876543216/availability/2025-11-25 404 (Not Found)
❌ [TIME-SLOTS] Failed to fetch slots: 404
```
**Root Cause**: Using old deprecated endpoint instead of universal slot blocking API

---

## 🌟 GOLDEN FRAMEWORK APIs (Universal for ALL Vendors)

### 1️⃣ UNIVERSAL SEARCH/LISTING API
**Endpoint**: `/universal/search`
**Purpose**: Find ANY vendor type (grooming, vet, training, etc.)

```typescript
// Request
POST /universal/search
{
  roleId?: string,           // "grooming_service", "healthcare_provider", etc.
  serviceStyle?: string,     // "at_center", "at_home", "video_consultation"
  latitude?: number,
  longitude?: number,
  radius?: number,           // Default 5km for home services
  filters?: {...}
}

// Response
{
  success: true,
  results: [
    {
      vendorId: string,
      vendorName: string,
      vendorRoleId: string,
      facilityId: string,
      facilityName: string,
      serviceStyle: string,
      servicesCount: number,  // MUST BE ACCURATE
      rating: number,
      ...
    }
  ]
}
```

**RULE**: This MUST work for ALL vendor types without role-specific code

---

### 2️⃣ UNIVERSAL SERVICE LISTING API
**Endpoint**: `/customer/services/vendor/:vendorId`
**Purpose**: Get ALL published services for ANY vendor

```typescript
// Request
GET /customer/services/vendor/:vendorId?style=at_center

// Response
{
  success: true,
  vendorId: string,
  vendorRoleId: string,
  services: [
    {
      serviceId: string,
      serviceName: string,
      categoryName: string,
      subCategoryName: string,
      price: number,
      duration: number,
      serviceStyle: string,
      isPublished: true,      // ONLY published services
      ...
    }
  ]
}
```

**RULE**: Returns ONLY published services, filtered by style if provided

---

### 3️⃣ UNIVERSAL AVAILABILITY/SLOT API
**Endpoint**: `/universal/slots`
**Purpose**: Get available slots for ANY vendor/service considering blocking rules

```typescript
// Request
POST /universal/slots
{
  vendorId: string,
  serviceId: string,        // Or serviceIds[]
  date: string,             // YYYY-MM-DD
  serviceStyle: string,     // "at_center", "at_home", "video_consultation"
  duration: number,         // Total duration needed
  petType?: string          // For grooming
}

// Response
{
  success: true,
  date: string,
  slots: [
    {
      time: string,         // "09:00"
      available: boolean,
      staffId?: string,     // For center services
      staffName?: string
    }
  ],
  blockedSlots: [...],      // With reasons
  staffAvailability: [...]  // For multi-staff centers
}
```

**RULE**: Handles ALL blocking logic (bookings, leaves, custom blocks, holidays)

---

### 4️⃣ UNIVERSAL BOOKING API
**Endpoint**: `/universal/booking/create`
**Purpose**: Create booking for ANY vendor type with lifecycle support

```typescript
// Request
POST /universal/booking/create
{
  customerId: string,
  petId: string,
  vendorId: string,
  serviceIds: string[],     // Supports multi-service
  scheduledDate: string,
  scheduledTime: string,
  serviceStyle: string,
  
  // Conditional fields
  address?: {...},          // Required for at_home
  latitude?: number,        // Required for at_home
  longitude?: number,       // Required for at_home
  
  // Payment
  paymentMethod: string,
  totalAmount: number
}

// Response
{
  success: true,
  bookingId: string,
  status: 'scheduled',
  otpRequired: {
    start: boolean,         // Only for trainers/walkers/behaviourists
    end: boolean            // All services
  },
  paymentDetails: {...},
  reschedulePolicy: {...},
  cancellationPolicy: {...}
}
```

**RULE**: Automatically applies correct OTP rules, payment/refund rules based on vendor type

---

## 🔄 UNIFIED BOOKING LIFECYCLE

### Standard States (ALL Vendor Types)
```
1. SCHEDULED → Booking created, payment done
2. START_OTP_PENDING → (Only trainers/walkers/behaviourists)
3. IN_PROGRESS → Service started
4. END_OTP_PENDING → Waiting for completion OTP
5. COMPLETED → Service done, notes required
6. CANCELLED → With refund based on policy
7. RESCHEDULED → Based on policy
```

### Universal OTP Rules
```typescript
{
  "trainer": { start: true, end: true },
  "dog_walker": { start: true, end: true },
  "pet_behaviourist": { start: true, end: true },
  
  "grooming_service": { start: false, end: true },
  "healthcare_provider": { start: false, end: true },
  "pet_boarding": { start: false, end: true },
  "pet_sitting": { start: false, end: true }
}
```

### Universal Payment/Refund Rules
```typescript
// Stored per vendor, applied universally
{
  cancellationPolicy: {
    "24h_before": 100,  // 100% refund
    "12h_before": 50,   // 50% refund
    "less_than_12h": 0  // No refund
  },
  reschedulePolicy: {
    "24h_before": "free",
    "12h_before": "10% fee",
    "less_than_12h": "not_allowed"
  }
}
```

---

## 🎨 UNIFIED UI COMPONENTS (Reusable Across ALL Vendor Types)

### 1. Universal Vendor List Component
```
<UniversalVendorList
  roleId="any"              // "grooming_service", "healthcare_provider", etc.
  serviceStyle="any"        // "at_center", "at_home", "video_consultation"
  searchAPI="/universal/search"
/>
```

### 2. Universal Service Selector
```
<UniversalServiceSelector
  vendorId="..."
  serviceStyle="at_center"
  servicesAPI="/customer/services/vendor/:id"
/>
```

### 3. Universal Slot Picker
```
<UniversalSlotPicker
  vendorId="..."
  serviceIds=[...]
  slotsAPI="/universal/slots"
  showStaffSelection={serviceStyle === 'at_center'}
/>
```

### 4. Universal Booking Confirmation
```
<UniversalBookingConfirmation
  booking={...}
  showOTPRules={true}
  showPaymentPolicy={true}
  showReschedulePolicy={true}
/>
```

---

## 🚀 IMPLEMENTATION RULES

### Backend Rules
1. ✅ **Single Source of Truth**: KV store keys follow standard format
2. ✅ **Role-Agnostic Logic**: APIs must NOT have if/else for roles
3. ✅ **Dynamic Configuration**: OTP rules, payment rules stored per vendor
4. ✅ **Universal Filtering**: Use metadata/tags, not hardcoded role checks
5. ✅ **Consistent Responses**: Same structure for all vendor types

### Frontend Rules
1. ✅ **No Role-Specific Components**: Use ONE component with role-aware props
2. ✅ **Universal State Management**: Same state shape for all bookings
3. ✅ **Dynamic UI Adaptation**: Show/hide based on vendor metadata, not role
4. ✅ **Consistent Navigation**: Same screen flow for all vendor types
5. ✅ **Error Handling**: Universal error messages

### Data Model Rules
```typescript
// Standard Vendor Structure
{
  vendorId: string,
  vendorRoleId: string,         // Links to role_master
  facilities: [{
    facilityId: string,
    serviceStyles: string[],    // ["at_center", "at_home"]
    staff: [...],
    operatingHours: {...}
  }],
  services: [{
    serviceId: string,
    isPublished: boolean,       // CRITICAL for listing
    serviceStyle: string,
    ...
  }],
  rules: {
    otp: { start: boolean, end: boolean },
    payment: {...},
    cancellation: {...},
    reschedule: {...}
  }
}
```

---

## 🎯 MIGRATION PLAN

### Phase 1: Fix Immediate Issues (NOW)
1. ✅ Fix grooming center search to use universal search properly
2. ✅ Fix service filtering to respect isPublished flag
3. ✅ Replace `/staff/:id/availability` with `/universal/slots`
4. ✅ Add proper logging for debugging

### Phase 2: API Consolidation (NEXT)
1. Deprecate old endpoints
2. Migrate all frontends to universal APIs
3. Add API versioning for backward compatibility
4. Update documentation

### Phase 3: Component Unification (THEN)
1. Merge VetServiceRouter, GroomingServiceRouter into UniversalServiceRouter
2. Create shared booking flow components
3. Remove role-specific code
4. Add comprehensive testing

### Phase 4: Future-Proofing (FINAL)
1. Add new role support through configuration only
2. Create admin panel for role management
3. Implement A/B testing framework
4. Add analytics for booking funnels

---

## ✅ SUCCESS CRITERIA

When complete, adding a NEW vendor role should require:
1. ❌ ZERO new API endpoints
2. ❌ ZERO new UI components
3. ❌ ZERO code changes
4. ✅ ONLY configuration in admin panel:
   - Add role to role_master
   - Configure OTP rules
   - Configure payment/refund rules
   - Set service categories
   - Done!

---

## 🔍 DEBUGGING CHECKLIST

When a vendor type is not working:
- [ ] Is isPublished=true on services?
- [ ] Does universal search return this roleId?
- [ ] Are facilities properly configured?
- [ ] Are staff members assigned (for centers)?
- [ ] Are operating hours set?
- [ ] Is the service style correct?
- [ ] Are slots being generated correctly?
- [ ] Are blocking rules configured?

**If all above pass → System MUST work**

---

**Status**: 🚧 In Progress - Fixing immediate issues first, then full migration
