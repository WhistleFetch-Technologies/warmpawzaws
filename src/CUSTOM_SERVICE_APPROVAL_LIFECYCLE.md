# Custom Service Approval Lifecycle - Complete Implementation

## ✅ Implementation Complete

The custom service approval system has been fully integrated into Vendor Administration with complete lifecycle management.

---

## 📋 Overview

Custom services created by vendors now appear in the **Rate Changes tab** in Vendor Administration, alongside traditional rate change requests. This provides a unified approval workflow for all vendor-initiated pricing and service changes.

---

## 🔄 Complete Lifecycle

### 1. **Vendor Creates Custom Service**

**Location**: Vendor App → Custom Services → Create New Service

**Process**:
- Vendor fills in service details (name, description, price, duration, category)
- Service is created with `publishStatus: 'draft'`
- Stored with key pattern: `custom-service:{vendorId}:{serviceId}`
- Service ID format: `CS{timestamp}-{random}` (e.g., `CS1234567890-ABC123`)

**Restrictions**:
- ✅ **Allowed**: Center-based vendors (`serviceStyle: 'at_center'` or `'both'`)
- ❌ **Blocked**: Home service (`at_home`) and Tele consultation (`tele`) vendors

---

### 2. **Vendor Publishes for Approval**

**Action**: Click "Publish" button in Vendor App

**Backend**: `POST /vendor/:vendorId/custom-services/:serviceId/publish`

**Changes**:
- Status: `draft` → `pending_approval`
- Adds `submittedForApprovalAt` timestamp
- Adds service ID to pending queue: `custom-services:pending-approval`

---

### 3. **Admin Reviews in Rate Changes Tab**

**Location**: Platform Admin → Vendor Administration → **Rate Changes** tab

**What Admin Sees**:
- Custom services appear alongside traditional rate change requests
- Distinguished by:
  - 🌟 "Custom Service" badge (orange)
  - "New Service" in Change % column
  - Shows category, subcategory, duration
  - Current rate shows "—" (since it's a new service)

**API**: `GET /admin/vendors/rate-changes`
- Returns combined list of rate changes + pending custom services
- Custom services have `type: 'custom_service'` identifier

---

### 4. **Admin Approves Service**

**Action**: Click ✓ Approve button

**Backend**: `POST /admin/vendors/rate-changes/:requestId/approve`
- Detects custom service by ID starting with "CS"
- Updates service:
  - Status: `pending_approval` → `published`
  - Adds `approvedAt`, `approvedBy`, `approvedByName`
  - Clears any previous `rejectionReason`
- Removes from pending queue
- **Sends notification to vendor**:
  ```json
  {
    "type": "custom_service_approved",
    "title": "✅ Custom Service Approved",
    "message": "Your custom service \"{serviceName}\" has been approved and is now live!"
  }
  ```

**Result**:
- ✅ Service is now **visible to customers**
- ✅ Appears in customer search results
- ✅ Available for booking

---

### 5. **Admin Rejects Service**

**Action**: Click ✗ Reject button → Enter rejection reason

**Backend**: `POST /admin/vendors/rate-changes/:requestId/reject`
- Detects custom service by ID starting with "CS"
- Updates service:
  - Status: `pending_approval` → `rejected`
  - Adds `rejectedAt`, `rejectedBy`, `rejectedByName`
  - Stores `rejectionReason`
- Removes from pending queue
- **Sends notification to vendor**:
  ```json
  {
    "type": "custom_service_rejected",
    "title": "❌ Custom Service Rejected",
    "message": "Your custom service \"{serviceName}\" was rejected. Reason: {adminNote}"
  }
  ```

**Result**:
- ❌ Service remains **hidden from customers**
- Vendor can view rejection reason in their custom services list
- Vendor can edit and resubmit

---

## 🎨 Customer App Integration

### Published Services Endpoint

**API**: `GET /custom-services/published`

**Filters**:
- `categoryName` - Filter by service category
- `vendorId` - Get services from specific vendor
- `petType` - Filter by pet type (dog, cat, etc.)
- `city` - Filter by vendor location

**Response**:
```json
{
  "success": true,
  "services": [
    {
      "id": "CS1234567890-ABC123",
      "serviceName": "Premium Grooming Package",
      "description": "Complete grooming with spa treatment",
      "price": 2500,
      "duration": 120,
      "categoryName": "Grooming",
      "vendorId": "vendor123",
      "vendorName": "PetCare Pro",
      "publishStatus": "published",
      "approvedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "count": 1
}
```

---

## 📊 Data Structure

### Custom Service Object

```typescript
{
  id: string;                    // CS{timestamp}-{random}
  vendorId: string;
  vendorName: string;
  roleName: string;              // Vet, Groomer, etc.
  serviceStyle: 'at_center';     // Always at_center
  
  // Service Details
  serviceName: string;
  description: string;
  price: number;
  duration: number;              // in minutes
  categoryName: string;
  subCategoryName: string | null;
  
  // Status & Approval
  publishStatus: 'draft' | 'pending_approval' | 'published' | 'rejected';
  isCustomService: true;
  isPlatformManaged: false;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  submittedForApprovalAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  
  // Admin tracking
  approvedBy: string | null;
  approvedByName: string | null;
  rejectedBy: string | null;
  rejectedByName: string | null;
  rejectionReason: string | null;
  adminNote: string;
  
  // Additional
  whatIncluded: string[];
  whatNotIncluded: string[];
  petTypes: string[];
  isPackage: boolean;
  packageDetails: object | null;
}
```

---

## 🔔 Vendor Notifications

Vendors receive notifications in their Vendor App:

**Storage**: `vendor_notifications:{vendorId}`

**Types**:
1. **custom_service_approved**
   - Title: "✅ Custom Service Approved"
   - Message: Service is now live
   - Data includes service ID and admin note

2. **custom_service_rejected**
   - Title: "❌ Custom Service Rejected"
   - Message: Includes rejection reason
   - Data includes service ID and reason

---

## 🧪 Testing the Flow

### End-to-End Test:

1. **Create Custom Service** (Vendor App)
   - Login as center-based vendor
   - Go to Custom Services
   - Click "Create New Service"
   - Fill details and click "Create Draft"

2. **Submit for Approval** (Vendor App)
   - Find the draft service
   - Click "Publish"
   - Confirm submission

3. **View in Admin** (Platform Admin)
   - Go to Vendor Administration
   - Click "Rate Changes" tab
   - See custom service with 🌟 badge

4. **Approve** (Platform Admin)
   - Click ✓ Approve button
   - Add optional note
   - Confirm

5. **Verify Visibility** (Customer App)
   - Call `GET /custom-services/published`
   - Service should appear with `publishStatus: 'published'`
   - Service can be booked

6. **Check Notification** (Vendor App)
   - Vendor sees approval notification
   - Notification includes service name and approval timestamp

---

## 📍 Key Files

### Backend:
- `/supabase/functions/server/custom-service-endpoints.tsx` - Custom service CRUD
- `/supabase/functions/server/reverification.tsx` - Approval endpoints (integrated)

### Frontend:
- `/components/vendor/VendorCustomServiceCreation.tsx` - Vendor creation UI
- `/components/admin/RateChangesTab.tsx` - Admin approval UI
- `/components/admin/AdminVendorManagementNew.tsx` - Admin navigation

---

## 🎯 Success Metrics

The system now provides:
- ✅ **Unified approval workflow** - Both rate changes and custom services in one tab
- ✅ **Visual distinction** - Custom services have orange badge
- ✅ **Vendor notifications** - Real-time feedback on approval/rejection
- ✅ **Customer visibility** - Approved services immediately available
- ✅ **Full audit trail** - Approval timestamps, admin names, reasons
- ✅ **Status management** - Draft → Pending → Published/Rejected flow

---

## 💡 Usage Notes

1. **Only center-based vendors** can create custom services
2. **Services start as drafts** - Not visible until published
3. **Admin approval required** - No auto-approval
4. **Rejection includes reason** - Helps vendors improve
5. **Notifications are automatic** - Vendors stay informed
6. **Published services are searchable** - Full customer app integration

---

## 🔮 Future Enhancements (Optional)

- Edit custom service after rejection
- Version history for custom services
- Bulk approval/rejection
- Custom service analytics
- Auto-approval for trusted vendors
- Service templates

---

**Status**: ✅ PRODUCTION READY
**Last Updated**: January 2024
**Integration**: Complete
