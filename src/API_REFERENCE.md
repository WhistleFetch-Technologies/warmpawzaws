# Warmpawz API Reference

**Complete API endpoint documentation for Vendor Onboarding → Customer Booking lifecycle**

---

## BASE URL
```
https://{projectId}.supabase.co/functions/v1/make-server-3dd53475
```

## AUTHENTICATION
All requests require Bearer token:
```
Authorization: Bearer {publicAnonKey}
```

For vendor/staff endpoints, may require access token from auth flow.

---

## 1. CUSTOMER ENDPOINTS

### 1.1 Problem Grid & Discovery

#### Get Problem Grid for Role
```http
GET /customer/problem-grid/:roleId
```

**Parameters:**
- `roleId` (path): `pet_clinic`, `groomer`, `trainer`, `dog_walker`, `pet_boarding`, etc.

**Response:**
```json
{
  "success": true,
  "roleId": "pet_clinic",
  "problems": [
    {
      "id": "skin_issues",
      "name": "Skin Issues",
      "displayName": "Skin Issues",
      "icon": "🐾",
      "description": "Rashes, itching, hair loss, etc.",
      "mappedSubCategories": ["sub_dermatology", "Dermatology"]
    }
  ]
}
```

---

#### Discover Vendors by Problem
```http
GET /customer/discover-by-problem/:roleId/:problemId
```

**Parameters:**
- `roleId` (path): Vendor role ID
- `problemId` (path): Problem category ID (from problem grid)
- `lat` (query, optional): Latitude for location-based search
- `lng` (query, optional): Longitude for location-based search
- `radius` (query, optional): Search radius in km (default: 5)

**Response:**
```json
{
  "success": true,
  "vendors": [
    {
      "id": "vendor_xxx",
      "vendorId": "vendor_xxx",
      "businessName": "Omega Pet Hospital",
      "address": "MG Road",
      "city": "Bangalore",
      "phone": "9611377119",
      "rating": 4.5,
      "specialistCount": 3,
      "specialists": [
        {
          "id": "staff_xxx",
          "fullName": "Dr. Anjali Pandey",
          "specialization": "Cardiology",
          "specializations": ["Dentistry", "Cardiology"],
          "consultationFee": 500,
          "rating": 4.8,
          "services": [
            {
              "id": "svc_xxx",
              "name": "General Consultation",
              "price": 500,
              "duration": 30,
              "serviceStyle": "at_center"
            }
          ]
        }
      ],
      "availableServiceStyles": ["at_center", "at_home", "tele"],
      "distance": 2.5,
      "vendorType": "center"
    }
  ],
  "displayMode": "both",
  "total": 10
}
```

---

#### Search Staff by Problem
```http
GET /customer/staff-by-problem/:roleId/:problemId
```

**Parameters:**
- Same as discover-by-problem
- Additional: `offset`, `limit` for pagination

**Response:**
```json
{
  "success": true,
  "staff": [
    {
      "id": "staff_xxx",
      "fullName": "Dr. Anjali Pandey",
      "specialization": "Cardiology",
      "clinicId": "vendor_xxx",
      "clinicName": "Omega Pet Hospital",
      "clinicAddress": "MG Road",
      "consultationFee": 500,
      "services": [...],
      "distance": 2.5
    }
  ],
  "clinics": [...],
  "total": 15
}
```

---

### 1.2 General Search

#### Universal Vendor/Staff Search
```http
GET /customer/search/:roleId
```

**Parameters:**
- `roleId` (path): Vendor role
- `lat`, `lng`, `radius` (query): Location filtering
- `search` (query): Text search (name, specialization)
- `specialization` (query): Filter by specialization
- `serviceStyle` (query): Filter by service style

**Response:**
```json
{
  "success": true,
  "vendors": [...],
  "staff": [...],
  "total": 20
}
```

---

### 1.3 Pet Management

#### Get Customer's Pets
```http
GET /customer/pets?phone={phone}
```

**Response:**
```json
{
  "success": true,
  "pets": [
    {
      "id": "pet_xxx",
      "name": "Bruno",
      "species": "dog",
      "breed": "Golden Retriever",
      "age": 3,
      "weight": 30,
      "photo": "...",
      "medicalHistory": [...]
    }
  ]
}
```

#### Add Pet
```http
POST /customer/pets
Content-Type: application/json

{
  "phone": "9876543210",
  "name": "Bruno",
  "species": "dog",
  "breed": "Golden Retriever",
  "age": 3,
  "weight": 30
}
```

---

### 1.4 Booking Management

#### Create Booking
```http
POST /customer/bookings
Content-Type: application/json

{
  "customerId": "customer_xxx",
  "customerPhone": "9876543210",
  "petId": "pet_xxx",
  "vendorId": "vendor_xxx",
  "staffId": "staff_xxx",
  "serviceStyle": "at_center",
  "services": [
    {
      "serviceId": "svc_xxx",
      "serviceName": "General Consultation",
      "price": 500,
      "duration": 30
    }
  ],
  "appointmentDate": "2025-11-28",
  "appointmentTime": "14:00",
  "totalAmount": 500,
  "paymentMethod": "razorpay",
  "paymentId": "pay_xxx"
}
```

**Response:**
```json
{
  "success": true,
  "booking": {
    "id": "booking_xxx",
    "bookingId": "WP-20251128-001",
    "status": "confirmed",
    "otp": "1234",
    "appointmentDate": "2025-11-28",
    "appointmentTime": "14:00"
  }
}
```

---

#### Get Customer Bookings
```http
GET /customer/bookings?phone={phone}&status={status}
```

**Parameters:**
- `phone` (query): Customer phone
- `status` (query, optional): Filter by status (confirmed, completed, cancelled)

---

#### Complete Booking with OTP
```http
POST /customer/bookings/:bookingId/complete
Content-Type: application/json

{
  "otp": "1234"
}
```

---

#### Cancel Booking
```http
POST /customer/bookings/:bookingId/cancel
Content-Type: application/json

{
  "reason": "Customer request"
}
```

**Response:**
```json
{
  "success": true,
  "refundAmount": 450,
  "refundPercentage": 90,
  "message": "Booking cancelled. Refund of ₹450 will be processed."
}
```

---

#### Reschedule Booking
```http
POST /customer/bookings/:bookingId/reschedule
Content-Type: application/json

{
  "newDate": "2025-11-29",
  "newTime": "15:00"
}
```

---

### 1.5 Slot Availability

#### Get Available Slots
```http
GET /slots/available/:vendorId/:staffId
```

**Parameters:**
- `vendorId` (path): Vendor ID
- `staffId` (path): Staff ID
- `date` (query): Date in YYYY-MM-DD format
- `serviceStyle` (query): at_center, at_home, tele
- `duration` (query): Service duration in minutes

**Response:**
```json
{
  "success": true,
  "date": "2025-11-28",
  "slots": [
    {
      "time": "09:00",
      "available": true,
      "staffName": "Dr. Anjali"
    },
    {
      "time": "09:30",
      "available": false,
      "reason": "Already booked"
    }
  ]
}
```

---

## 2. VENDOR ENDPOINTS

### 2.1 Vendor Registration

#### Register Vendor
```http
POST /vendor/register
Content-Type: application/json

{
  "businessName": "Omega Pet Hospital",
  "ownerName": "Dr. Ketan Shah",
  "phone": "9611377119",
  "email": "ketan@omega.com",
  "roleId": "pet_clinic",
  "address": "MG Road",
  "city": "Bangalore",
  "pincode": "560001",
  "latitude": 12.9716,
  "longitude": 77.5946
}
```

**Response:**
```json
{
  "success": true,
  "vendor": {
    "id": "vendor_xxx",
    "status": "pending_approval"
  }
}
```

---

### 2.2 Service Management

#### Get Available Services for Style
```http
GET /vendor/services/catalog/:roleId/:serviceStyle
```

**Parameters:**
- `roleId` (path): Vendor's role ID
- `serviceStyle` (path): at_center, at_home, tele

**Response:**
```json
{
  "success": true,
  "serviceStyle": "at_center",
  "catalogServices": [
    {
      "id": "catalog_svc_xxx",
      "name": "General Consultation",
      "category": "Veterinary",
      "subCategory": "General Medicine",
      "basePrice": 500,
      "baseDuration": 30
    }
  ]
}
```

---

#### Publish Vendor Services
```http
POST /vendor/services/:serviceStyle
Content-Type: application/json

{
  "vendorId": "vendor_xxx",
  "services": [
    {
      "catalogServiceId": "catalog_svc_xxx",
      "serviceName": "General Consultation",
      "price": 500,
      "duration": 30,
      "isEnabled": true,
      "publishStatus": "published"
    }
  ]
}
```

---

#### Get Vendor's Published Services
```http
GET /vendor/services/:vendorId/:serviceStyle
```

**Response:**
```json
{
  "success": true,
  "vendorId": "vendor_xxx",
  "serviceStyle": "at_center",
  "services": [
    {
      "id": "svc_xxx",
      "serviceName": "General Consultation",
      "isEnabled": true,
      "publishStatus": "published",
      "price": 500
    }
  ]
}
```

---

### 2.3 Staff Management

#### Add Staff
```http
POST /vendor/staff
Content-Type: application/json

{
  "vendorId": "vendor_xxx",
  "fullName": "Dr. Anjali Pandey",
  "phone": "8098078086",
  "email": "anjali@omega.com",
  "role": "doctor",
  "specialization": "Cardiology",
  "specializations": ["Cardiology", "Dentistry"],
  "qualification": "BVSc, MVSc",
  "yearsOfExperience": 5
}
```

---

#### Get Vendor Staff
```http
GET /vendor/staff/:vendorId
```

---

## 3. STAFF ENDPOINTS

### 3.1 Profile Management

#### Get Staff Profile
```http
GET /staff/profile/:staffId
```

#### Update Staff Profile
```http
PUT /staff/profile/:staffId
Content-Type: application/json

{
  "fullName": "Dr. Anjali Pandey",
  "specialization": "Cardiology",
  "specializations": ["Cardiology", "Dentistry", "Surgery"],
  "bio": "...",
  "photo": "...",
  "languages": ["English", "Hindi"]
}
```

---

### 3.2 Service Selection

#### Get Available Services for Staff
```http
GET /staff/services/available/:staffId
```

**Response:**
```json
{
  "success": true,
  "vendorServices": {
    "at_center": [...],
    "at_home": [...],
    "tele": [...]
  }
}
```

---

#### Enable Services for Staff
```http
POST /staff/services/:staffId
Content-Type: application/json

{
  "services": [
    {
      "serviceId": "svc_xxx",
      "serviceName": "General Consultation",
      "isActive": true,
      "customPrice": 600,
      "customDuration": 45
    }
  ]
}
```

---

### 3.3 Schedule & Availability

#### Set Availability
```http
POST /staff/availability/:staffId
Content-Type: application/json

{
  "availability": {
    "monday": { "enabled": true, "slots": ["09:00-17:00"] },
    "tuesday": { "enabled": true, "slots": ["09:00-17:00"] }
  }
}
```

---

#### Add Holiday
```http
POST /staff/holidays/:staffId
Content-Type: application/json

{
  "date": "2025-12-25",
  "reason": "Christmas"
}
```

---

## 4. ADMIN ENDPOINTS

### 4.1 Vendor Approval

#### Get Pending Vendors
```http
GET /admin/vendors/pending
```

#### Approve Vendor
```http
POST /admin/vendors/:vendorId/approve
```

#### Reject Vendor
```http
POST /admin/vendors/:vendorId/reject
Content-Type: application/json

{
  "reason": "Incomplete documents"
}
```

---

### 4.2 Service Catalog Management

#### Get Service Catalog
```http
GET /admin/catalog/services/:roleId
```

#### Add Catalog Service
```http
POST /admin/catalog/services
Content-Type: application/json

{
  "name": "Emergency Consultation",
  "category": "Veterinary",
  "subCategory": "Emergency Medicine",
  "serviceStyle": "at_center",
  "roleId": "pet_clinic",
  "basePrice": 1000,
  "baseDuration": 45
}
```

---

### 4.3 Payment & Refund Policies

#### Get Policies
```http
GET /admin/policies
```

#### Update Policies
```http
PUT /admin/policies
Content-Type: application/json

{
  "leadTimeHours": 2,
  "maxAdvanceBookingDays": 30,
  "cancellationWindow": 24,
  "rescheduleWindow": 12,
  "slotDuration": 30,
  "bufferTime": 15
}
```

---

## 5. DIAGNOSTIC ENDPOINTS

### 5.1 Test Search API
```http
GET /test/search-api?mobile={mobile}&name={name}
```

### 5.2 Vendor Auto-Fix
```http
POST /admin/vendor-auto-fix/:vendorId
```

### 5.3 Data Validation
```http
GET /admin/validate-data
```

---

## COMMON ERROR RESPONSES

### 400 Bad Request
```json
{
  "success": false,
  "error": "Missing required field: serviceName"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Vendor not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Database operation failed",
  "details": "..."
}
```

---

**Last Updated:** November 27, 2025
