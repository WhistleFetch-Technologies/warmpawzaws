# 🔥 WARMPAWZ Vendor Management API Documentation

## 🎯 Overview

Comprehensive API for managing vendors with **unique mobile/email validation**, **status control**, **bulk operations**, and **data isolation**.

---

## 🔐 UNIQUE IDENTIFIER VALIDATION

### Check Mobile/Email Uniqueness

**Endpoint:** `POST /vendor/check-unique`

**Purpose:** Validate if mobile number or email is already registered

**Request:**
```json
{
  "mobile": "9611377119",
  "email": "ketan@example.com",
  "excludeVendorId": "vendor_123" // Optional: exclude this vendor from check (for updates)
}
```

**Response:**
```json
{
  "mobileExists": false,
  "emailExists": false,
  "isUnique": true,
  "existingMobileVendor": null,
  "existingEmailVendor": null
}
```

**Or if duplicate found:**
```json
{
  "mobileExists": true,
  "emailExists": false,
  "isUnique": false,
  "existingMobileVendor": {
    "id": "vendor_1763100834597_hl5ny1",
    "businessName": "Pawsome Grooming",
    "status": "approved"
  },
  "existingEmailVendor": null
}
```

---

## 📊 VENDOR STATUS MANAGEMENT

### Get Vendor Status

**Endpoint:** `GET /vendor/status/:vendorId`

**Response:**
```json
{
  "vendorId": "vendor_1763100834597_hl5ny1",
  "status": "approved",
  "businessName": "Pawsome Grooming",
  "vendorType": "grooming",
  "isActive": true,
  "setupCompleted": true,
  "createdAt": "2025-01-14T10:30:00Z",
  "approvedAt": "2025-01-14T12:45:00Z",
  "reviewedBy": "Admin User",
  "statusHistory": [
    {
      "from": "pending_approval",
      "to": "approved",
      "changedBy": "Admin User",
      "changedAt": "2025-01-14T12:45:00Z",
      "reason": "All documents verified",
      "notes": "Approved with 5-star rating expectation"
    }
  ]
}
```

### Update Vendor Status (Single)

**Endpoint:** `POST /admin/vendor/status/update`

**Request:**
```json
{
  "vendorId": "vendor_1763100834597_hl5ny1",
  "newStatus": "approved",
  "adminId": "admin_123",
  "adminName": "John Doe",
  "reason": "All documents verified",
  "notes": "Excellent business profile"
}
```

**Supported Status Values:**
- `pending_approval` - Initial state after signup
- `approved` - Vendor approved, can proceed to setup
- `rejected` - Vendor rejected
- `suspended` - Temporarily suspended
- `active` - Fully active and operational

**Response:**
```json
{
  "success": true,
  "vendor": { /* full vendor object */ },
  "message": "Vendor status updated to approved"
}
```

---

## 📦 BULK OPERATIONS

### Bulk Approve Vendors

**Endpoint:** `POST /admin/vendor/status/bulk-approve`

**Request:**
```json
{
  "vendorIds": [
    "vendor_1763100834597_hl5ny1",
    "vendor_1763100834598_abc123",
    "vendor_1763100834599_def456"
  ],
  "adminId": "admin_123",
  "adminName": "John Doe",
  "notes": "Batch approval - all documents verified"
}
```

**Response:**
```json
{
  "success": true,
  "totalProcessed": 3,
  "successCount": 3,
  "failureCount": 0,
  "results": [
    {
      "vendorId": "vendor_1763100834597_hl5ny1",
      "success": true,
      "businessName": "Pawsome Grooming"
    },
    {
      "vendorId": "vendor_1763100834598_abc123",
      "success": true,
      "businessName": "Pet Paradise"
    },
    {
      "vendorId": "vendor_1763100834599_def456",
      "success": true,
      "businessName": "Furry Friends Clinic"
    }
  ]
}
```

### Bulk Reject Vendors

**Endpoint:** `POST /admin/vendor/status/bulk-reject`

**Request:**
```json
{
  "vendorIds": [
    "vendor_1763100834600_xyz789",
    "vendor_1763100834601_pqr123"
  ],
  "adminId": "admin_123",
  "adminName": "John Doe",
  "reason": "Incomplete documentation",
  "notes": "Please resubmit with complete GST and license details"
}
```

**Response:** Same format as bulk approve

---

## 🔍 DATA ISOLATION & LOOKUP

### Lookup Vendor by Mobile/Email

**Endpoint:** `POST /vendor/lookup`

**Purpose:** Find vendor using unique identifiers (useful for login/verification)

**Request:**
```json
{
  "mobile": "9611377119",
  "email": "ketan@example.com"
}
```

**Response:**
```json
{
  "found": true,
  "vendor": {
    "id": "vendor_1763100834597_hl5ny1",
    "fullName": "Ketan",
    "businessName": "Pawsome Grooming",
    "vendorType": "grooming",
    "phone": "9611377119",
    "email": "ketan@example.com",
    "status": "approved",
    "isActive": true,
    "setupCompleted": true,
    "createdAt": "2025-01-14T10:30:00Z",
    "approvedAt": "2025-01-14T12:45:00Z"
  }
}
```

### Get Vendors by Type

**Endpoint:** `GET /vendors/by-type/:vendorType`

**Example:** `GET /vendors/by-type/grooming`

**Response:**
```json
{
  "vendors": [
    {
      "id": "vendor_1763100834597_hl5ny1",
      "fullName": "Ketan",
      "businessName": "Pawsome Grooming",
      "phone": "9611377119",
      "email": "ketan@example.com",
      "status": "approved",
      "isActive": true,
      "city": "Mumbai",
      "state": "Maharashtra",
      "createdAt": "2025-01-14T10:30:00Z",
      "approvedAt": "2025-01-14T12:45:00Z"
    }
  ],
  "vendorType": "grooming"
}
```

**Supported Vendor Types:**
- `grooming` - Pet grooming services
- `veterinary` - Veterinary clinics
- `training` - Pet training
- `walking` - Dog walking
- `boarding` - Pet boarding
- `cafe` - Pet-friendly cafes
- `adoption` - Pet adoption centers
- `mating` - Mating & dating services
- `insurance` - Pet insurance
- `retail` - Pet retail/products

---

## 📈 STATISTICS & ANALYTICS

### Get Vendor Statistics

**Endpoint:** `GET /admin/vendor/statistics`

**Response:**
```json
{
  "stats": {
    "total": 127,
    "byStatus": {
      "pending_approval": 23,
      "approved": 89,
      "rejected": 12,
      "suspended": 3,
      "active": 0
    },
    "byType": {
      "grooming": 34,
      "veterinary": 28,
      "training": 19,
      "walking": 15,
      "boarding": 12,
      "cafe": 8,
      "adoption": 6,
      "mating": 3,
      "insurance": 1,
      "retail": 1
    },
    "activeVendors": 89,
    "completedSetup": 67,
    "pendingSetup": 22
  }
}
```

---

## 🚀 INTEGRATION EXAMPLES

### Example 1: Vendor Signup with Validation

```typescript
// Step 1: Check uniqueness before signup
const checkResponse = await fetch('/vendor/check-unique', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    mobile: '9611377119',
    email: 'ketan@example.com'
  })
});

const checkResult = await checkResponse.json();

if (!checkResult.isUnique) {
  if (checkResult.mobileExists) {
    alert(`Mobile number already registered to ${checkResult.existingMobileVendor.businessName}`);
    return;
  }
  if (checkResult.emailExists) {
    alert(`Email already registered to ${checkResult.existingEmailVendor.businessName}`);
    return;
  }
}

// Step 2: Proceed with signup
const signupResponse = await fetch('/auth/vendor/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'ketan@example.com',
    phone: '9611377119',
    businessName: 'Pawsome Grooming',
    // ... other fields
  })
});
```

### Example 2: Bulk Approve All Pending Grooming Vendors

```typescript
// Step 1: Get all pending applications
const pendingResponse = await fetch('/admin/vendor/applications/pending');
const { applications } = await pendingResponse.json();

// Step 2: Filter for grooming vendors
const groomingVendors = applications
  .filter(app => app.vendorType === 'grooming')
  .map(app => app.vendorId);

// Step 3: Bulk approve
const approveResponse = await fetch('/admin/vendor/status/bulk-approve', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    vendorIds: groomingVendors,
    adminId: currentAdminId,
    adminName: currentAdminName,
    notes: 'Batch approval for grooming vendors'
  })
});

const result = await approveResponse.json();
console.log(`Approved ${result.successCount} out of ${result.totalProcessed} vendors`);
```

### Example 3: Check Vendor Status Before Booking

```typescript
// Customer wants to book a service
const vendorResponse = await fetch(`/vendor/status/${vendorId}`);
const { status, isActive, setupCompleted } = await vendorResponse.json();

if (status !== 'approved' || !isActive || !setupCompleted) {
  alert('This vendor is currently unavailable for bookings');
  return;
}

// Proceed with booking
```

---

## 🔒 DATA ISOLATION GUARANTEES

### 1. **Unique Mobile Numbers**
- Each mobile number can only be associated with ONE vendor
- Signup/registration automatically validates uniqueness
- Returns HTTP 409 (Conflict) if duplicate found

### 2. **Unique Email Addresses**
- Each email can only be associated with ONE vendor
- Prevents duplicate accounts and ensures proper communication
- Returns HTTP 409 (Conflict) if duplicate found

### 3. **Vendor ID Isolation**
- Each vendor has a unique ID: `vendor_<timestamp>_<random>`
- All vendor data is stored under `vendor:vendor_<id>`
- Services, bookings, and revenue are isolated by vendor ID

### 4. **Status-Based Access Control**
- Only `approved` vendors can complete setup
- Only `active` vendors appear in customer searches
- `suspended` vendors cannot receive new bookings

---

## 📋 STATUS FLOW DIAGRAM

```
NEW VENDOR
    ↓
[pending_approval] ← Initial state after signup
    ↓
    ├─→ [approved] → Setup services → [active] ← Can receive bookings
    │       ↓
    │   [suspended] ← Temporary ban (can be reactivated)
    │
    └─→ [rejected] ← Permanently rejected (can reapply)
```

---

## 🎯 BEST PRACTICES

1. **Always check uniqueness** before vendor signup
2. **Use bulk operations** for processing multiple vendors
3. **Track status history** for audit trail
4. **Send notifications** on status changes (SMS + Email)
5. **Validate vendor type** matches catalog services
6. **Monitor statistics** for business insights
7. **Use lookup endpoint** for efficient vendor searches

---

## 🔔 NOTIFICATIONS

All status changes trigger automatic notifications:
- ✅ **Approved:** Email + SMS to vendor
- ❌ **Rejected:** Email + SMS with reason
- ⏸️ **Suspended:** Email + SMS with reason
- 🔄 **Status Change:** Email + SMS with details

Notification logs stored at: `notification:{id}`

---

## 🐛 ERROR CODES

| Code | Meaning | Solution |
|------|---------|----------|
| 409 | Duplicate mobile/email | Use different credentials |
| 404 | Vendor not found | Verify vendor ID |
| 400 | Invalid status transition | Check status flow |
| 403 | Admin access required | Use admin credentials |
| 500 | Server error | Check logs |

---

**🎉 Your WARMPAWZ vendor management system is now production-ready with enterprise-grade data isolation and control!**
