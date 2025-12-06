# WARMPAWZ API DOCUMENTATION
**Complete Vendor Onboarding to Customer Booking Lifecycle**

## 📚 Table of Contents
1. [Authentication & User Management](#authentication--user-management)
2. [Vendor Onboarding Flow](#vendor-onboarding-flow)
3. [Service Catalog Management](#service-catalog-management)
4. [Vendor Service Management](#vendor-service-management)
5. [Staff Management](#staff-management)
6. [Customer Problem Grid Discovery](#customer-problem-grid-discovery)
7. [Booking Creation & Management](#booking-creation--management)
8. [Booking Lifecycle](#booking-lifecycle)
9. [OTP & Service Completion](#otp--service-completion)
10. [Payment & Refund Policies](#payment--refund-policies)

---

## 🔐 Authentication & User Management

### Customer Sign Up
```http
POST /make-server-3dd53475/signup
Content-Type: application/json
Authorization: Bearer {SUPABASE_ANON_KEY}

{
  "email": "customer@example.com",
  "password": "password123",
  "user_metadata": {
    "name": "John Doe",
    "phone": "9876543210"
  }
}
```

### Customer Sign In
```typescript
// Frontend: Use Supabase client
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'customer@example.com',
  password: 'password123'
});
const accessToken = data?.session?.access_token;
```

### Get Current Session
```typescript
const { data: { session } } = await supabase.auth.getSession();
const accessToken = session?.access_token;
```

---

## 🏢 Vendor Onboarding Flow

### Step 1: Dynamic Onboarding Fields
**Get onboarding configuration by role**

```http
GET /make-server-3dd53475/onboarding/config/{roleId}
Authorization: Bearer {publicAnonKey}
```

**Response:**
```json
{
  "success": true,
  "roleId": "veterinarian",
  "roleName": "Veterinarian",
  "fields": [
    {
      "id": "businessName",
      "label": "Business/Clinic Name",
      "type": "text",
      "required": true,
      "validation": { "minLength": 3, "maxLength": 100 }
    },
    {
      "id": "licenseNumber",
      "label": "Veterinary License Number",
      "type": "text",
      "required": true
    }
    // ... more fields
  ]
}
```

### Step 2: Submit Vendor Onboarding
```http
POST /make-server-3dd53475/vendor/onboarding
Content-Type: application/json
Authorization: Bearer {publicAnonKey}

{
  "roleId": "veterinarian",
  "businessName": "Omega Pet Hospital",
  "fullName": "Dr. Anjali Pandey",
  "phone": "9611377119",
  "email": "omega@example.com",
  "address": "123 Main St, Bangalore",
  "city": "Bangalore",
  "state": "Karnataka",
  "pincode": "560001",
  "latitude": "12.9716",
  "longitude": "77.5946",
  "licenseNumber": "VET12345",
  "yearsOfExperience": 10,
  "specialization": ["sub_dentistry", "sub_cardiology"],
  "photos": ["https://..."],
  "documents": ["https://..."]
}
```

**Response:**
```json
{
  "success": true,
  "vendorId": "vendor_9611377119",
  "status": "pending_approval",
  "message": "Vendor registered successfully. Awaiting admin approval."
}
```

### Step 3: Admin Approves Vendor
```http
POST /make-server-3dd53475/admin/vendors/{vendorId}/approve
Authorization: Bearer {publicAnonKey}

{
  "approved": true,
  "notes": "All documents verified"
}
```

---

## 📦 Service Catalog Management

### Get Service Catalog
**All services organized by category and subcategory**

```http
GET /make-server-3dd53475/catalog/services
Authorization: Bearer {publicAnonKey}
```

**Response:**
```json
{
  "success": true,
  "services": [
    {
      "id": "cat_srv_1763325318804_6",
      "serviceName": "Dental Checkup",
      "categoryId": "cat_veterinary",
      "categoryName": "Veterinary Services",
      "subCategoryId": "sub_dentistry",
      "subCategoryName": "Dentistry",
      "serviceStyle": "at_center",
      "applicableRoles": ["veterinarian"],
      "basePrice": 500,
      "duration": 30,
      "description": "Comprehensive dental examination"
    }
    // ... more services
  ]
}
```

### Get Services by Role & Service Style
```http
GET /make-server-3dd53475/catalog/services/role/{roleId}/style/{serviceStyle}
Authorization: Bearer {publicAnonKey}

# Examples:
# /catalog/services/role/veterinarian/style/at_center
# /catalog/services/role/pet_groomer/style/at_home
```

---

## 🛠️ Vendor Service Management

### Architecture Overview
```
1. Admin creates services → Service Catalog (cat_srv_*)
2. Vendor selects services → vendor_services:{vendorId}:{style}
   - isEnabled: true (vendor enabled)
   - publishStatus: 'published' (vendor published)
3. Staff enables services → staff.services[] (isActive: true)
4. Customer books → Only active staff services visible
```

### Load Vendor's Service Options
**Get all catalog services available for vendor to select**

```http
GET /make-server-3dd53475/vendor/{vendorId}/available-services
Authorization: Bearer {publicAnonKey}
```

### Select & Publish Services
**Vendor selects services from catalog**

```http
POST /make-server-3dd53475/vendor/{vendorId}/services/select
Content-Type: application/json
Authorization: Bearer {publicAnonKey}

{
  "serviceStyle": "at_center",
  "services": [
    {
      "serviceId": "cat_srv_1763325318804_6",
      "serviceName": "Dental Checkup",
      "customPrice": 500,
      "customDuration": 30,
      "isEnabled": true
    }
  ]
}
```

### Publish Services
**Make services live on platform**

```http
POST /make-server-3dd53475/vendor/{vendorId}/services/publish
Content-Type: application/json
Authorization: Bearer {publicAnonKey}

{
  "serviceStyle": "at_center",
  "serviceIds": ["cat_srv_1763325318804_6", "cat_srv_..."]
}
```

**Result:**
```json
{
  "success": true,
  "published": 5,
  "publishedServices": [
    {
      "id": "cat_srv_1763325318804_6",
      "publishStatus": "published",
      "isEnabled": true,
      "isLive": true
    }
  ]
}
```

### Get Vendor's Published Services
```http
GET /make-server-3dd53475/vendor/{vendorId}/services
Authorization: Bearer {publicAnonKey}
```

**Response:**
```json
{
  "success": true,
  "services": {
    "at_center": {
      "services": [
        {
          "id": "cat_srv_1763325318804_6",
          "serviceName": "Dental Checkup",
          "serviceStyle": "at_center",
          "price": 500,
          "duration": 30,
          "isEnabled": true,
          "publishStatus": "published"
        }
      ]
    },
    "at_home": { "services": [...] },
    "tele": { "services": [...] }
  }
}
```

---

## 👥 Staff Management

### Create Staff
```http
POST /make-server-3dd53475/staff/create
Content-Type: application/json
Authorization: Bearer {publicAnonKey}

{
  "vendorId": "vendor_9611377119",
  "fullName": "Dr. Anjali Pandey",
  "email": "anjali@example.com",
  "phone": "9876543210",
  "specialization": "sub_dentistry",
  "specializations": ["sub_dentistry", "sub_cardiology"],
  "qualification": "BVSc & AH, MVSc",
  "yearsOfExperience": 8,
  "photo": "https://..."
}
```

### Staff Service Management (3-Tab UI)

#### Load Available Services for Staff
**Staff sees vendor's published services in 3 tabs**

```http
GET /make-server-3dd53475/vendor/{vendorId}/services
Authorization: Bearer {publicAnonKey}
```

**Frontend displays 3 tabs:**
- 🏠 **At Home** - services with serviceStyle='at_home'
- 🏥 **At Center** - services with serviceStyle='at_center'
- 📱 **Tele Consultation** - services with serviceStyle='tele'

#### Staff Enables Services
**Staff selects services from vendor's published list**

```http
POST /make-server-3dd53475/staff/{staffId}/services/add-clinic-service
Content-Type: application/json
Authorization: Bearer {publicAnonKey}

{
  "serviceId": "cat_srv_1763325318804_6",
  "serviceName": "Dental Checkup",
  "categoryId": "cat_veterinary",
  "subCategoryId": "sub_dentistry",
  "serviceStyle": "at_center",
  "price": 500,
  "duration": 30,
  "isActive": true  // ← CRITICAL for customer visibility
}
```

**Data Structure After:**
```json
// staff:staff_xxx
{
  "id": "staff_1763736182308_6rg8fnv0l",
  "fullName": "Dr. Anjali Pandey",
  "vendorId": "vendor_9611377119",
  "specializations": ["sub_dentistry", "sub_cardiology"],
  "services": [
    {
      "serviceId": "cat_srv_1763325318804_6",
      "serviceName": "Dental Checkup",
      "serviceStyle": "at_center", // ← Inherited from vendor
      "price": 500,
      "duration": 30,
      "isActive": true // ← Makes staff visible in searches
    }
  ]
}
```

### Get Staff Services
```http
GET /make-server-3dd53475/staff/{staffId}/services
Authorization: Bearer {publicAnonKey}
```

---

## 🔍 Customer Problem Grid Discovery

### Architecture
```
Customer Problem → Problem Grid → Specialization Match → Active Staff → Booking
```

### Step 1: Load Problem Grid
**Customer sees health problems/needs**

```http
GET /make-server-3dd53475/customer/problem-grid/{roleId}
Authorization: Bearer {publicAnonKey}

# Examples:
# /customer/problem-grid/veterinarian
# /customer/problem-grid/pet_groomer
```

**Response:**
```json
{
  "success": true,
  "roleId": "veterinarian",
  "roleName": "Veterinarian",
  "problems": [
    {
      "id": "dentistry",
      "name": "Dentistry",
      "displayName": "Dental Care",
      "icon": "🦷",
      "color": "#06B6D4",
      "gradient": "from-cyan-500 to-cyan-600",
      "description": "Dental health, teeth cleaning, oral care",
      "keywords": ["teeth", "dental", "gum", "mouth"],
      "mappedSubCategories": ["sub_dentistry", "sub_dental"]
    }
    // ... more problems
  ]
}
```

### Step 2: Discover Staff by Problem
**Search for specialists who can solve the problem**

```http
GET /make-server-3dd53475/customer/discover-by-problem/{roleId}/{problemId}?lat={lat}&lng={lng}&radius={radius}
Authorization: Bearer {publicAnonKey}

# Example:
# /customer/discover-by-problem/veterinarian/dentistry?lat=12.9716&lng=77.5946&radius=5
```

**Discovery Logic:**
1. Get problem's `mappedSubCategories` (e.g., `['sub_dentistry']`)
2. Find staff with matching `specializations` array
3. Filter staff with `isActive: true` services
4. Filter by location (5km radius for home services)
5. Return staff + parent vendor info

**Response:**
```json
{
  "success": true,
  "problem": {
    "id": "dentistry",
    "name": "Dentistry",
    "mappedSubCategories": ["sub_dentistry", "sub_dental"]
  },
  "vendors": [
    {
      "id": "vendor_9611377119",
      "businessName": "Omega Pet Hospital",
      "address": "123 Main St, Bangalore",
      "distance": 2.5,
      "specialists": [
        {
          "id": "staff_1763736182308_6rg8fnv0l",
          "fullName": "Dr. Anjali Pandey",
          "specializations": ["sub_dentistry", "sub_cardiology"],
          "photo": "https://...",
          "qualification": "BVSc & AH, MVSc",
          "experience": 8,
          "rating": 4.8,
          "services": [
            {
              "id": "cat_srv_1763325318804_6",
              "name": "Dental Checkup",
              "price": 500,
              "duration": 30,
              "serviceStyle": "at_center"
            }
          ]
        }
      ],
      "specialistCount": 3,
      "availableServiceStyles": ["at_center", "at_home"]
    }
  ],
  "displayMode": "staff_only"
}
```

### Display Modes by Role
```typescript
const DISPLAY_MODES = {
  'veterinarian': 'staff_only',     // Show doctors
  'pet_trainer': 'staff_only',      // Show trainers
  'dog_walker': 'staff_only',       // Show walkers
  'pet_groomer': 'center_only',     // Show salons
  'pet_boarding': 'center_only',    // Show facilities
  'behaviourist': 'staff_only'      // Show behaviorists
};
```

---

## 📅 Booking Creation & Management

### Step 1: Check Availability
**Before showing slots, validate staff availability**

```http
GET /make-server-3dd53475/slots/staff/{staffId}/available?date={YYYY-MM-DD}&serviceId={serviceId}
Authorization: Bearer {publicAnonKey}
```

**Scheduling Rules (from Admin Portal):**
- Lead time: e.g., 2 hours minimum before booking
- No past slots
- No double booking
- Staff schedule/holidays checked
- Service duration considered

**Response:**
```json
{
  "success": true,
  "date": "2025-11-28",
  "slots": [
    {
      "startTime": "10:00",
      "endTime": "10:30",
      "available": true,
      "staffId": "staff_xxx"
    },
    {
      "startTime": "10:30",
      "endTime": "11:00",
      "available": false,
      "reason": "Already booked"
    }
  ]
}
```

### Step 2: Create Booking
```http
POST /make-server-3dd53475/bookings/create
Content-Type: application/json
Authorization: Bearer {accessToken}

{
  "customerId": "cust_xxx",
  "vendorId": "vendor_9611377119",
  "staffId": "staff_1763736182308_6rg8fnv0l",
  "serviceId": "cat_srv_1763325318804_6",
  "serviceName": "Dental Checkup",
  "serviceStyle": "at_center",
  "date": "2025-11-28",
  "startTime": "10:00",
  "endTime": "10:30",
  "petId": "pet_xxx",
  "price": 500,
  "duration": 30,
  "location": {
    "type": "vendor",
    "address": "Omega Pet Hospital, Bangalore"
  }
}
```

**Response:**
```json
{
  "success": true,
  "bookingId": "booking_xxx",
  "status": "confirmed",
  "paymentRequired": true,
  "paymentUrl": "https://...",
  "otp": {
    "required": true,
    "type": "end_only"  // or "start_and_end" for walkers/trainers
  }
}
```

---

## 🔄 Booking Lifecycle

### Booking States
```
pending → confirmed → in_progress → completed → paid
                   ↘ cancelled → refunded
                   ↘ rescheduled → pending
```

### Get Booking Details
```http
GET /make-server-3dd53475/bookings/{bookingId}
Authorization: Bearer {accessToken}
```

### Cancel Booking
```http
POST /make-server-3dd53475/bookings/{bookingId}/cancel
Content-Type: application/json
Authorization: Bearer {accessToken}

{
  "reason": "Pet not available",
  "requestedBy": "customer"
}
```

**Refund Logic (based on Admin Portal policies):**
- Cancel > 24hrs before: 100% refund
- Cancel 12-24hrs before: 50% refund
- Cancel < 12hrs before: No refund

### Reschedule Booking
```http
POST /make-server-3dd53475/bookings/{bookingId}/reschedule
Content-Type: application/json
Authorization: Bearer {accessToken}

{
  "newDate": "2025-11-29",
  "newStartTime": "14:00",
  "newEndTime": "14:30",
  "reason": "Customer request"
}
```

---

## 🔢 OTP & Service Completion

### OTP Rules
```typescript
const OTP_RULES = {
  // START + END OTP (Session tracking)
  'dog_walker': { start: true, end: true },
  'pet_trainer': { start: true, end: true },
  'behaviourist': { start: true, end: true },
  
  // END OTP only (Service completion)
  'veterinarian': { start: false, end: true },
  'pet_groomer': { start: false, end: true },
  'pet_boarding': { start: false, end: true }
};
```

### Generate OTP (Vendor/Staff Side)
```http
POST /make-server-3dd53475/bookings/{bookingId}/generate-otp
Content-Type: application/json
Authorization: Bearer {accessToken}

{
  "type": "start" | "end"
}
```

**Response:**
```json
{
  "success": true,
  "otp": "1234",
  "expiresAt": "2025-11-28T10:15:00Z"
}
```

### Verify OTP (Customer Side)
```http
POST /make-server-3dd53475/bookings/{bookingId}/verify-otp
Content-Type: application/json
Authorization: Bearer {accessToken}

{
  "otp": "1234",
  "type": "end"
}
```

### Session Tracking (Walkers/Trainers)
**Starts when START OTP verified**

```http
GET /make-server-3dd53475/bookings/{bookingId}/session-tracking
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "success": true,
  "session": {
    "startTime": "2025-11-28T10:00:00Z",
    "currentDuration": 15,
    "distanceCovered": 1.2,
    "route": [
      { "lat": 12.9716, "lng": 77.5946, "timestamp": "..." }
    ],
    "status": "in_progress"
  }
}
```

### Add Prescription/Service Notes (REQUIRED)
**ALL vendors must provide notes after OTP completion**

```http
POST /make-server-3dd53475/bookings/{bookingId}/prescription
Content-Type: application/json
Authorization: Bearer {accessToken}

{
  "notes": "Dog is healthy. Teeth cleaned. Recommend annual checkup.",
  "medications": [
    {
      "name": "Dental Treat",
      "dosage": "1 daily",
      "duration": "7 days"
    }
  ],
  "followUpDate": "2025-12-28",
  "documents": ["https://..."]
}
```

---

## 💳 Payment & Refund Policies

### Get Payment Policies
```http
GET /make-server-3dd53475/admin/payment-policies
Authorization: Bearer {publicAnonKey}
```

**Response:**
```json
{
  "success": true,
  "policies": {
    "leadTime": {
      "hours": 2,
      "description": "Minimum 2 hours lead time for bookings"
    },
    "cancellation": {
      "moreThan24hrs": { "refundPercent": 100 },
      "between12And24hrs": { "refundPercent": 50 },
      "lessThan12hrs": { "refundPercent": 0 }
    },
    "reschedule": {
      "allowed": true,
      "maxTimes": 2,
      "fee": 0
    },
    "noShow": {
      "penaltyPercent": 100,
      "description": "Full amount charged for no-show"
    }
  }
}
```

### Process Refund
```http
POST /make-server-3dd53475/payments/refund
Content-Type: application/json
Authorization: Bearer {accessToken}

{
  "bookingId": "booking_xxx",
  "amount": 500,
  "reason": "Cancelled > 24hrs before",
  "refundPercent": 100
}
```

---

## 🏠 Home Services Special Rules

### Location-Based Discovery (5KM Radius)
```http
GET /make-server-3dd53475/customer/discover-by-problem/veterinarian/general_checkup?lat=12.9716&lng=77.5946&radius=5&serviceStyle=at_home
Authorization: Bearer {publicAnonKey}
```

**Discovery Flow:**
1. Filter vendors/staff within 5km of customer location
2. Check if they have `at_home` services enabled
3. Show services first, then slot selection
4. After booking, assign nearest available staff
5. Customer tracks staff location in real-time

### Real-Time Staff Tracking
```http
GET /make-server-3dd53475/bookings/{bookingId}/staff-location
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "success": true,
  "staff": {
    "id": "staff_xxx",
    "name": "Dr. Anjali Pandey",
    "photo": "https://...",
    "phone": "9876543210",
    "currentLocation": {
      "lat": 12.9716,
      "lng": 77.5946,
      "updated": "2025-11-28T10:05:00Z"
    },
    "eta": "15 minutes",
    "route": {
      "distance": 2.5,
      "duration": 15
    }
  }
}
```

---

## 📊 Data Consistency Validation

### Staff Visibility Checklist
**For staff to appear in customer searches:**

- [ ] Staff has `isActive: true`
- [ ] Staff has `specializations` array matching problem grid
- [ ] Staff has at least 1 service with `isActive: true`
- [ ] Vendor is `status: 'approved'` and `isActive: true`
- [ ] Services inherit `serviceStyle` from vendor services
- [ ] Services have valid `serviceId`, `price`, `duration`

### Vendor Service Checklist
**For services to be bookable:**

- [ ] Service exists in catalog (`cat_srv_*`)
- [ ] Vendor selected service (`vendor_services:{vendorId}:{style}`)
- [ ] Vendor enabled service (`isEnabled: true`)
- [ ] Vendor published service (`publishStatus: 'published'`)
- [ ] Staff enabled service (`staff.services[].isActive: true`)
- [ ] Service style matches booking type

---

## 🔧 Universal Frameworks

### 1. Service Hierarchy Framework
```
Admin Portal → Service Catalog
↓
Vendor Dashboard → Select & Publish Services
↓
Staff Dashboard → Enable Services
↓
Customer App → Book Active Services
```

### 2. Problem Grid Discovery Framework
```
Customer Problem → Specialization Match → Active Staff → Booking
```

### 3. Booking Lifecycle Framework
```
Service Selection → Slot Selection → Payment → Booking Created
↓
OTP Validation (START for walkers/trainers, END for others)
↓
Service Completion → Prescription/Notes
↓
Payment Realization
```

---

## 🎯 Testing Endpoints

### Check System Health
```http
GET /make-server-3dd53475/health
```

### Validate Staff Visibility
```http
POST /make-server-3dd53475/admin/validate-staff-visibility
Content-Type: application/json

{
  "staffId": "staff_xxx"
}
```

**Response:**
```json
{
  "success": true,
  "visible": false,
  "issues": [
    "Staff has no active services (isActive: true)",
    "Vendor not approved"
  ],
  "recommendations": [
    "Run /admin/fix-staff-services-activation",
    "Approve vendor from admin portal"
  ]
}
```

---

## 📥 Download This Documentation

**Save as:** `warmpawz-api-docs-${date}.md`

**Generated:** November 27, 2025

**Version:** 1.0.0 - Complete Production Ready

---

**Support:** For issues, run diagnostic endpoints or contact system admin.
