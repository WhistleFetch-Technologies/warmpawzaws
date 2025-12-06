# Package/Plan System - Complete Implementation Plan

## Overview
Implement a complete package lifecycle system where vendors can create packages from enabled services, customers can purchase them, and completion is tracked via OTP-based milestones.

---

## PHASE 1: Package Creation (Vendor Side)

### 1.1 Update EnhancedPackageCreationModal
**File**: `/components/vendor/EnhancedPackageCreationModal.tsx`

**Changes**:
- Replace manual service input with service selector
- Show available enabled services with checkboxes
- Display selected services with details (name, price, duration)
- Auto-calculate original price from selected services
- Allow ordering/sequencing services for milestone tracking

**New Functions**:
```typescript
const toggleServiceSelection = (service: ServiceItem) => {
  const isSelected = formData.includedServices.find(s => s.id === service.id);
  if (isSelected) {
    // Remove service
    setFormData({
      ...formData,
      includedServices: formData.includedServices.filter(s => s.id !== service.id)
    });
  } else {
    // Add service
    setFormData({
      ...formData,
      includedServices: [...formData.includedServices, service]
    });
  }
  // Recalculate original price
  recalculateOriginalPrice();
};

const recalculateOriginalPrice = () => {
  const total = formData.includedServices.reduce((sum, s) => sum + (s.price || 0), 0);
  setFormData({ ...formData, originalPrice: total });
};
```

---

## PHASE 2: Backend Package Management

### 2.1 Package Creation Endpoint
**Route**: `/vendor/:vendorId/packages/create`
**Method**: POST

**Request Body**:
```json
{
  "packageName": "string",
  "description": "string",
  "packageType": "combo | subscription | membership | unlimited",
  "serviceIds": ["service_1", "service_2", "service_3"],
  "validityDays": 30,
  "originalPrice": 5000,
  "packagePrice": 3999,
  "terms": "string",
  "cancellationPolicy": "string",
  "serviceStyle": "at_center | at_home | tele"
}
```

**KV Store Structure**:
```json
{
  "packages:vendor:{vendorId}:{packageId}": {
    "packageId": "pkg_xxx",
    "vendorId": "vendor_xxx",
    "packageName": "Premium Grooming Package",
    "description": "Complete grooming care for your pet",
    "packageType": "combo",
    "serviceIds": ["svc_1", "svc_2", "svc_3"],
    "services": [
      {
        "serviceId": "svc_1",
        "serviceName": "Full Body Massage",
        "sequence": 1,
        "price": 1500,
        "duration": 60
      },
      {
        "serviceId": "svc_2",
        "serviceName": "Hair Cut & Styling",
        "sequence": 2,
        "price": 2000,
        "duration": 90
      },
      {
        "serviceId": "svc_3",
        "serviceName": "Nail Trimming",
        "sequence": 3,
        "price": 500,
        "duration": 30
      }
    ],
    "validityDays": 30,
    "originalPrice": 4000,
    "packagePrice": 2999,
    "savings": 1001,
    "savingsPercentage": 25,
    "terms": "Package must be used within 30 days",
    "cancellationPolicy": "No refunds after purchase",
    "serviceStyle": "at_center",
    "publishStatus": "pending_approval",
    "createdAt": "2025-11-21T10:00:00Z",
    "approvedAt": null,
    "approvedBy": null
  }
}
```

### 2.2 Package Listing Endpoint
**Route**: `/vendor/:vendorId/packages`
**Method**: GET

**Response**:
```json
{
  "packages": [
    {
      "packageId": "pkg_xxx",
      "packageName": "Premium Grooming Package",
      "packagePrice": 2999,
      "originalPrice": 4000,
      "servicesCount": 3,
      "publishStatus": "published | pending_approval | rejected",
      "activeSubscriptions": 12
    }
  ]
}
```

### 2.3 Admin Package Approval Endpoint
**Route**: `/admin/packages/:packageId/approve`
**Method**: POST

**Request Body**:
```json
{
  "action": "approve | reject",
  "rejectionReason": "string (if rejected)"
}
```

---

## PHASE 3: Customer Package Purchase

### 3.1 Customer Package Listing
**Route**: `/customer/packages`
**Method**: GET
**Query Params**: `?vendorId=xxx&serviceStyle=at_center`

**Response**:
```json
{
  "packages": [
    {
      "packageId": "pkg_xxx",
      "vendorId": "vendor_xxx",
      "vendorName": "Happy Paws Clinic",
      "packageName": "Premium Grooming Package",
      "description": "Complete grooming care",
      "packagePrice": 2999,
      "originalPrice": 4000,
      "savings": 1001,
      "savingsPercentage": 25,
      "validityDays": 30,
      "services": [
        {
          "serviceName": "Full Body Massage",
          "sequence": 1
        },
        {
          "serviceName": "Hair Cut & Styling",
          "sequence": 2
        },
        {
          "serviceName": "Nail Trimming",
          "sequence": 3
        }
      ]
    }
  ]
}
```

### 3.2 Package Purchase Endpoint
**Route**: `/customer/packages/:packageId/purchase`
**Method**: POST

**Request Body**:
```json
{
  "customerId": "cust_xxx",
  "petId": "pet_xxx",
  "paymentMethod": "card | upi | cash",
  "paymentId": "pay_xxx"
}
```

**Response & KV Store Structure**:
```json
{
  "purchases:customer:{customerId}:{purchaseId}": {
    "purchaseId": "pch_xxx",
    "packageId": "pkg_xxx",
    "customerId": "cust_xxx",
    "petId": "pet_xxx",
    "vendorId": "vendor_xxx",
    "packageName": "Premium Grooming Package",
    "packagePrice": 2999,
    "purchaseDate": "2025-11-21T10:00:00Z",
    "validUntil": "2025-12-21T10:00:00Z",
    "status": "active | completed | expired",
    "milestones": [
      {
        "milestoneId": "m_1",
        "serviceId": "svc_1",
        "serviceName": "Full Body Massage",
        "sequence": 1,
        "status": "pending | completed | cancelled",
        "bookingId": null,
        "completedAt": null,
        "completedBy": null,
        "otp": null,
        "prescription": null,
        "notes": null
      },
      {
        "milestoneId": "m_2",
        "serviceId": "svc_2",
        "serviceName": "Hair Cut & Styling",
        "sequence": 2,
        "status": "pending",
        "bookingId": null,
        "completedAt": null,
        "completedBy": null,
        "otp": null,
        "prescription": null,
        "notes": null
      },
      {
        "milestoneId": "m_3",
        "serviceId": "svc_3",
        "serviceName": "Nail Trimming",
        "sequence": 3,
        "status": "pending",
        "bookingId": null,
        "completedAt": null,
        "completedBy": null,
        "otp": null,
        "prescription": null,
        "notes": null
      }
    ],
    "completedMilestones": 0,
    "totalMilestones": 3,
    "progress": 0
  }
}
```

---

## PHASE 4: Customer Package Tracking

### 4.1 My Packages Screen (Customer App)
**Component**: `/components/customer/MyPackagesScreen.tsx`

**Features**:
- List all purchased packages
- Show progress (2/5 services completed)
- Display next pending milestone
- Show validity/expiry date
- Book next service button

**API Endpoint**: `/customer/:customerId/packages`

### 4.2 Package Details Screen
**Component**: `/components/customer/PackageDetailsScreen.tsx`

**Features**:
- Package info (name, price, validity)
- Milestone list with status indicators
- Booking buttons for pending milestones
- OTP entry for service completion
- View prescriptions/notes from completed services

---

## PHASE 5: Vendor Package Milestone Tracking

### 5.1 Active Packages Dashboard
**Component**: `/components/vendor/VendorActivePackages.tsx`

**Features**:
- List customers with active packages
- Show package progress for each customer
- Filter by: pending milestones, in-progress, completed
- Quick actions: Book next service, Complete milestone

**API Endpoint**: `/vendor/:vendorId/active-packages`

### 5.2 Milestone Completion Endpoint
**Route**: `/vendor/bookings/:bookingId/complete-milestone`
**Method**: POST

**Request Body**:
```json
{
  "purchaseId": "pch_xxx",
  "milestoneId": "m_1",
  "otp": "1234",
  "prescription": "string (optional)",
  "notes": "string (optional)",
  "nextVisitDate": "2025-11-28T10:00:00Z (optional)"
}
```

**Validation**:
1. Verify OTP matches customer's OTP
2. Verify booking belongs to this package purchase
3. Verify milestone is pending (not already completed)
4. Update milestone status to "completed"
5. Increment completed milestones count
6. Calculate progress percentage
7. If all milestones completed, mark package as "completed"

---

## PHASE 6: OTP Flow Integration

### 6.1 Customer OTP Generation
When customer books a service that's part of a package:
1. Generate 4-digit OTP
2. Store in milestone data
3. Display OTP to customer in app
4. Customer shares OTP with vendor at service completion

### 6.2 Vendor OTP Verification
**Component**: `/components/vendor/MilestoneCompletionModal.tsx`

**Features**:
- Display customer info, package name, service name
- OTP input field (4 digits)
- Prescription/notes text area
- Submit button to complete milestone

**Flow**:
1. Vendor enters OTP provided by customer
2. System validates OTP
3. If valid, milestone marked complete
4. Vendor can add prescription/notes
5. Customer sees updated progress in their app

---

## PHASE 7: Admin Package Management

### 7.1 Pending Packages Approval
**Component**: `/components/admin/AdminPackageApproval.tsx`

**Features**:
- List all pending packages from vendors
- View package details (services, pricing)
- Approve or reject with reason
- Bulk approve multiple packages

### 7.2 Analytics Dashboard
**Component**: `/components/admin/PackageAnalytics.tsx`

**Metrics**:
- Total packages created
- Active subscriptions
- Revenue from packages
- Most popular packages
- Completion rates by vendor

---

## Database Schema Summary

### KV Store Keys:
1. `packages:vendor:{vendorId}:{packageId}` - Package definitions
2. `packages:catalog:{serviceStyle}` - All published packages for customers
3. `purchases:customer:{customerId}:{purchaseId}` - Customer purchases
4. `purchases:vendor:{vendorId}:{purchaseId}` - Vendor view of purchases
5. `milestones:{purchaseId}:{milestoneId}` - Individual milestone tracking
6. `analytics:packages:revenue` - Revenue tracking
7. `analytics:packages:completion` - Completion rate tracking

---

## Implementation Priority

### MVP (Minimum Viable Product):
1. ✅ Package creation with service selection (Modal update)
2. ✅ Backend package creation endpoint
3. ✅ Customer package purchase endpoint
4. ✅ Basic milestone tracking
5. ✅ OTP-based completion flow

### Phase 2:
6. Customer My Packages screen
7. Vendor active packages dashboard
8. Milestone completion UI

### Phase 3:
9. Admin package approval
10. Analytics dashboard
11. Subscription renewal
12. Notifications

---

## Next Steps

Shall I proceed with implementing:
1. **Phase 1**: Update the package modal to select from existing services?
2. **Phase 2**: Build all backend routes for package management?
3. **Phase 3-7**: Complete customer and vendor UI integration?

Let me know which phase to start with!
