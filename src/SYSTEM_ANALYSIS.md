# Warmpawz System Analysis & Documentation

**Generated:** November 27, 2025  
**Purpose:** Complete system architecture documentation, gap analysis, and production readiness assessment

---

## 1. CORE ARCHITECTURE

### 1.1 Data Flow Hierarchy

```
ADMIN PORTAL (Service Catalog Management)
    ↓
    Creates services with:
    - serviceName
    - serviceStyle (at_center, at_home, tele)
    - category, subcategory
    - basePrice, baseDuration
    - roleId (which vendor types can use it)
    
VENDOR DASHBOARD (Service Management)
    ↓
    Vendor selects service style → Gets list of catalog services
    → Enables services (isEnabled=true)
    → Publishes services (publishStatus='published')
    → Stored in: vendor_services:{vendorId}:{serviceStyle}
    
STAFF DASHBOARD (Service Selection)
    ↓
    Staff sees ALL vendor's published services across all styles
    → Enables services for themselves (isActive=true)
    → Can customize price/duration (optional)
    → Stored in: staff.services[] array
    
CUSTOMER APP (Service Discovery & Booking)
    ↓
    Searches by:
    - Role (vet, groomer, etc.)
    - Problem category (skin issues, dental, etc.)
    - Service style (at_center, at_home, tele)
    - Location (lat/lng + radius)
    
    Filters staff by:
    - Has active services (staff.services[] with isActive=true)
    - Service style matching (inherit from vendor published services)
    - Specialization matching (for problem grid)
    - Location (vendor location within radius)
```

### 1.2 Key Data Structures

**Vendor Record:** `vendor:vendor_{id}`
```javascript
{
  id: "vendor_xxx",
  businessName: "Omega Pet Hospital",
  phone: "9611377119",
  roleId: "pet_clinic", // or "groomer", "trainer", etc.
  status: "approved",
  isActive: true,
  latitude: 12.9716,
  longitude: 77.5946,
  address: "...",
  city: "...",
  // ... other fields
}
```

**Vendor Services:** `vendor_services:{vendorId}:{serviceStyle}`
```javascript
{
  vendorId: "vendor_xxx",
  serviceStyle: "at_center", // or "at_home", "tele"
  services: [
    {
      id: "svc_xxx",
      serviceName: "General Consultation",
      category: "Veterinary",
      subCategory: "General Medicine",
      isEnabled: true,
      publishStatus: "published", // "draft", "published", "pending_approval"
      price: 500,
      duration: 30,
      // ... other fields
    }
  ]
}
```

**Staff Record:** `staff:{staffId}`
```javascript
{
  id: "staff_xxx",
  fullName: "Dr. Anjali Pandey",
  vendorId: "vendor_xxx",
  phone: "8098078086",
  role: "doctor",
  isActive: true,
  specialization: "Cardiology", // Primary
  specializations: ["Dentistry", "Cardiology", "Surgery"], // Array for multi-specialty
  services: [
    {
      id: "svc_xxx",
      serviceId: "catalog_service_id",
      serviceName: "General Consultation",
      isActive: true,
      customPrice: 600, // Optional override
      customDuration: 45, // Optional override
      // NOTE: serviceStyle is NOT stored here!
      // It's derived from vendor_services bucket this came from
    }
  ],
  // ... availability, schedule, etc.
}
```

**Vendor-Staff Mapping:** `vendor:{vendorId}:staff`
```javascript
["staff_id1", "staff_id2", "staff_id3"]
```

---

## 2. PROBLEM GRID SYSTEM

### 2.1 Problem Categories (Customer-Facing)

**For Veterinarians:**
```javascript
{
  id: "skin_issues",
  name: "Skin Issues",
  icon: "🐾",
  mappedSubCategories: ["sub_dermatology", "Dermatology"]
}
```

### 2.2 Specialization Matching Logic

**Problem → Specialization Mapping:**
```javascript
skin_issues → ["sub_dermatology", "Dermatology"]
digestive_problems → ["sub_gastroenterology", "Gastroenterology"]
bone_joint → ["sub_orthopedics", "Orthopedics", "sub_surgery", "Surgery"]
dental_oral → ["sub_dentistry", "Dentistry"]
heart_issues → ["sub_cardiology", "Cardiology"]
// ... etc.
```

**Matching Rules:**
1. Staff must have `specializations` array containing at least one matching value
2. Staff must have at least 1 active service (isActive=true in staff.services[])
3. Vendor must be approved and active
4. Vendor must have published services in at least one service style

### 2.3 Problem Grid Display Rules

| Vendor Role | What to Show | Tabs |
|-------------|--------------|------|
| Veterinarian | Staff (Doctors) + Centers (Clinics) | 2 tabs |
| Groomer | Centers (Salons) | 1 tab (centers only) |
| Dog Walker | Staff (Walkers) | 1 tab (staff only) |
| Trainer | Staff (Trainers) + Centers | 2 tabs |
| Behaviorist | Staff (Behaviorists) + Centers | 2 tabs |
| Boarding | Centers | 1 tab (centers only) |
| Nutritionist | Staff | 1 tab (staff only) |
| Physiotherapist | Staff | 1 tab (staff only) |

---

## 3. SERVICE STYLE MANAGEMENT

### 3.1 Service Style Rules by Role

| Role | at_center | at_home | tele | Custom Services |
|------|-----------|---------|------|-----------------|
| Vet Clinic | ✅ | ✅ | ✅ | ✅ at_center only (needs approval) |
| Groomer | ✅ | ✅ | ❌ | ✅ at_center only (needs approval) |
| Trainer | ✅ | ✅ | ✅ | ✅ at_center only (needs approval) |
| Dog Walker | ❌ | ✅ | ❌ | ❌ No custom services |
| Behaviorist | ✅ | ✅ | ✅ | ✅ at_center only (needs approval) |
| Boarding | ✅ | ❌ | ❌ | ✅ at_center only (needs approval) |

### 3.2 Service Style Data Location

**Vendor Level:**
- `vendor_services:{vendorId}:at_center` → Center services
- `vendor_services:{vendorId}:at_home` → Home services  
- `vendor_services:{vendorId}:tele` → Teleconsultation services

**Staff Level:**
- `staff.services[]` → No serviceStyle field!
- Service style is **derived** by checking which vendor_services bucket contains this service

---

## 4. BOOKING LIFECYCLE

### 4.1 Center Booking Flow

```
Customer → Service Dashboard → Select "Book at Center"
    ↓
Problem Grid (optional) OR Direct Clinic Search
    ↓
View Clinics/Doctors filtered by:
    - Location (within radius)
    - Specialization (if problem selected)
    - Has active at_center services
    ↓
Select Clinic/Doctor
    ↓
Select Service Package(s)
    ↓
Select Time Slot
    - Check scheduling rules (lead time, no past slots)
    - Check staff availability (no double booking)
    ↓
Select Pet
    ↓
Payment
    ↓
Booking Confirmed
    ↓
Booking Lifecycle: Confirmed → In Progress → Completed (END OTP)
```

### 4.2 Home Services Flow

```
Customer → Service Dashboard → Select "Book at Home"
    ↓
Location Detection (get lat/lng)
    ↓
Filter vendors within 5KM radius
    ↓
Show services (NOT staff yet - just services from nearby vendors)
    ↓
Customer selects service(s)
    ↓
Select Time Slot
    - Check lead time from scheduling rules
    - Check staff availability (no double booking)
    - Only show slots where staff are available within 5KM
    ↓
Payment
    ↓
Booking Confirmed → Staff Assignment
    - System assigns available staff from 5KM radius
    ↓
Customer sees:
    - Staff details (photo, name, contact)
    - Live tracking (when staff starts journey)
    - ETA to customer location
    ↓
Staff arrives → Customer enters END OTP
    ↓
Service completed → Payment released → Medical record added
```

### 4.3 OTP Rules

| Service Type | OTP Required | Notes |
|--------------|--------------|-------|
| Center Booking | END OTP | Customer enters after service completion |
| Home Services (Vet, Groomer) | END OTP | Customer enters after service completion |
| Dog Walking | START OTP + END OTP | Start = begin session tracking, End = complete session |
| Training Session | START OTP + END OTP | Start = begin session, End = complete session |
| Behavior Session | START OTP + END OTP | Start = begin session, End = complete session |
| Package Services | END OTP per session | Each session requires OTP |

### 4.4 Session Tracking (Walkers/Trainers)

**When START OTP entered:**
1. Begin GPS tracking
2. Record start time, start location
3. Track route in real-time
4. Calculate distance, duration

**When END OTP entered:**
1. Stop GPS tracking
2. Record end time, end location
3. Generate session report (route map, distance, duration)
4. Complete booking
5. Add to medical records / training log

---

## 5. SCHEDULING RULES

### 5.1 Admin Portal Settings

**Payment & Refund Section:**
```javascript
{
  leadTimeHours: 2, // Minimum hours before booking allowed
  maxAdvanceBookingDays: 30, // Maximum days in advance
  cancellationWindow: 24, // Hours before appointment for full refund
  rescheduleWindow: 12, // Hours before appointment for reschedule
  slotDuration: 30, // Default slot duration in minutes
  bufferTime: 15, // Buffer between appointments
  noShowPenalty: 50, // Percentage of booking amount
}
```

### 5.2 Slot Availability Rules

1. **No Past Slots:** Only show future slots
2. **Lead Time:** Slots must be at least {leadTimeHours} hours from now
3. **Max Advance:** Slots up to {maxAdvanceBookingDays} days in future
4. **Staff Availability:** Check `staff.availability` and `staff.schedule`
5. **No Double Booking:** Check existing bookings for staff
6. **Holidays:** Check `staff.holidays` array

---

## 6. CURRENT API ENDPOINTS

### 6.1 Customer Endpoints

| Endpoint | Purpose | Status |
|----------|---------|--------|
| `/customer/discover-by-problem/:roleId/:problemId` | Universal problem-based discovery | ✅ Implemented |
| `/customer/staff-by-problem/:roleId/:problemId` | Staff search by problem | ✅ Implemented |
| `/customer/search/:roleId` | General vendor/staff search | ✅ Implemented |
| `/customer/problem-grid/:roleId` | Get problem categories for role | ✅ Implemented |
| `/customer/pets` | Customer's pet management | ✅ Implemented |
| `/customer/bookings` | Booking history | ✅ Implemented |
| `/customer/booking/:id` | Booking details | ✅ Implemented |

### 6.2 Vendor Endpoints

| Endpoint | Purpose | Status |
|----------|---------|--------|
| `/vendor/services/:serviceStyle` | Get/manage vendor services | ✅ Implemented |
| `/vendor/staff` | Staff management | ✅ Implemented |
| `/vendor/bookings` | Vendor booking management | ✅ Implemented |

### 6.3 Staff Endpoints

| Endpoint | Purpose | Status |
|----------|---------|--------|
| `/staff/profile` | Staff profile management | ✅ Implemented |
| `/staff/services` | Staff service selection | ✅ Implemented |
| `/staff/schedule` | Schedule management | ✅ Implemented |
| `/staff/availability` | Availability settings | ✅ Implemented |

---

## 7. IDENTIFIED GAPS

### 7.1 Critical Issues

❌ **Staff Service Style Derivation**
- **Problem:** Staff services don't have serviceStyle field
- **Impact:** Cannot filter staff by service style in customer search
- **Solution:** Need to derive serviceStyle by cross-referencing vendor_services buckets

❌ **5KM Radius Filtering for Home Services**
- **Problem:** Not implemented in home services flow
- **Impact:** Shows all vendors regardless of distance
- **Solution:** Implement geolocation filtering in UI and API

❌ **Staff Assignment for Home Services**
- **Problem:** No automatic staff assignment after booking
- **Impact:** Bookings confirmed but no staff assigned
- **Solution:** Implement staff assignment logic post-payment

❌ **Live Tracking for Home Services**
- **Problem:** Not implemented
- **Impact:** Customer can't track staff arrival
- **Solution:** Implement GPS tracking + WebSocket updates

❌ **OTP Validation**
- **Problem:** Partially implemented, not consistent across all service types
- **Impact:** Services can be marked complete without OTP
- **Solution:** Enforce OTP validation based on service type rules

❌ **Session Tracking for Walkers/Trainers**
- **Problem:** START/END OTP implemented but no GPS tracking
- **Impact:** No route map, distance, or session data captured
- **Solution:** Implement GPS tracking between START and END OTP

### 7.2 Data Consistency Issues

⚠️ **Vendor-Staff Service Sync**
- Staff may have services that vendor hasn't published
- Staff services may be active even if vendor unpublished them
- **Solution:** Implement sync validation

⚠️ **Specialization Standardization**
- Mix of "Cardiology" vs "sub_cardiology"
- **Solution:** Standardize to catalog subcategory IDs

### 7.3 Missing Features

🔴 **Booking Lifecycle Management**
- Reschedule functionality
- Cancellation with refund calculation
- No-show handling
- **Status:** Implemented but untested

🔴 **Package Services**
- Multi-session packages
- Session scheduling
- Per-session OTP validation
- **Status:** Partially implemented

🔴 **Medical Records**
- Post-service medical record creation
- Prescription uploads
- **Status:** Schema exists, integration incomplete

---

## 8. IMPLEMENTATION PLAN

### Phase 1: Fix Critical Data Issues (Priority 1)
- [ ] Fix staff service style derivation
- [ ] Implement vendor-staff service sync validation
- [ ] Standardize specializations across all staff

### Phase 2: Complete Home Services Flow (Priority 1)
- [ ] Implement 5KM radius filtering
- [ ] Build staff assignment logic
- [ ] Add live tracking infrastructure
- [ ] Complete OTP validation

### Phase 3: Problem Grid Production Ready (Priority 1)
- [ ] Implement role-specific display rules
- [ ] Add comprehensive error handling
- [ ] Build fallback mechanisms
- [ ] Add analytics/logging

### Phase 4: Booking Lifecycle (Priority 2)
- [ ] Test reschedule flow
- [ ] Test cancellation + refund
- [ ] Implement no-show handling
- [ ] Add booking notifications

### Phase 5: Session Tracking (Priority 2)
- [ ] GPS tracking for walkers/trainers
- [ ] Route map generation
- [ ] Session report creation

### Phase 6: Medical Records Integration (Priority 3)
- [ ] Auto-create medical record post-OTP
- [ ] Prescription upload flow
- [ ] Medical history display

---

## 9. TESTING PLAN

### 9.1 Unit Tests
- [ ] Service style derivation logic
- [ ] Specialization matching
- [ ] Geolocation distance calculation
- [ ] OTP validation
- [ ] Slot availability calculation

### 9.2 Integration Tests
- [ ] Vendor service publish → Staff service sync
- [ ] Problem grid search → Correct results
- [ ] Booking creation → Staff assignment
- [ ] OTP entry → Booking completion
- [ ] Cancellation → Refund calculation

### 9.3 End-to-End Tests
- [ ] Complete center booking flow
- [ ] Complete home services flow
- [ ] Complete dog walking session
- [ ] Package service booking
- [ ] Reschedule/cancel flow

---

## 10. DESIGN PHILOSOPHY

### 10.1 UI/UX Guidelines
- ✅ Mobile-first (customer & vendor apps)
- ✅ Orange brand color (#FF8C42) for customer app
- ✅ Subtle colors only (no bright colors except brand)
- ✅ Responsive across all screen sizes
- ✅ Consistent component library

### 10.2 Code Standards
- ✅ Universal frameworks (no hardcoding)
- ✅ Dynamic vendor onboarding
- ✅ Centralized policy management
- ✅ Comprehensive error handling
- ✅ Detailed logging for debugging

---

**Next Steps:** Proceed with Phase 1 implementation after approval
