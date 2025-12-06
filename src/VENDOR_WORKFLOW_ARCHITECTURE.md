# Warmpawz Vendor Approval Workflow Architecture

## 🎯 System Overview
This document describes the complete vendor lifecycle management system with proper state handling, approval workflows, and dynamic routing.

---

## 📊 **VENDOR STATUS STATES**

The system uses a single source of truth for vendor status with the following states:

| Status | Description | Admin Action | Vendor Action | UI Display |
|--------|-------------|--------------|---------------|------------|
| `pending` | Initial application submitted | Review, Approve, Reject, Request Info | Wait | "Application Under Review" |
| `approved` | Admin approved the application | - | Access Dashboard | Full Dashboard Access |
| `rejected` | Admin rejected the application | - | View Reason, Reapply | "Application Rejected" |
| `more_info_required` | Admin needs clarification | - | Edit & Resubmit | "Action Required" |
| `resubmitted` | Vendor resubmitted after clarification | Review, Approve, Reject | Wait | "Application Under Review" |

---

## 🔑 **KEY DATABASE PATTERNS**

### Vendor Records
```
vendor:vendor_{unique_id}
```
**Critical Fields:**
- `id`: Unique vendor ID (e.g., `vendor_abc123`)
- `phone`: Vendor phone number (used for lookup)
- `status`: Current application status
- `isActive`: Boolean - Can vendor access dashboard?
- `setupCompleted`: Boolean - Has vendor completed onboarding?
- `roleId`: The role configuration ID
- `roleName`: Human-readable role name
- `applicationId`: Unique application tracking ID

### Status History
```
vendor:history:{vendorId}:{timestamp}
```
Tracks all status changes with audit trail.

### Session Tokens
```
vendor:session:{phone}
```
Active session tracking for approved vendors.

---

## 🔄 **APPROVAL WORKFLOW ENDPOINTS**

### 1. **Approve Vendor**
**Endpoint:** `POST /admin/vendor/approve`

**Payload:**
```json
{
  "vendorId": "vendor_abc123",
  "approvedBy": "Admin Name",
  "notes": "Approval notes"
}
```

**What it does:**
- Sets `status: 'approved'`
- Sets `isActive: true` ✅ **CRITICAL**
- Sets `setupCompleted: true` ✅ **CRITICAL**
- Creates session token
- Logs approval in history

**Response:**
```json
{
  "success": true,
  "vendor": { /* updated vendor object */ },
  "message": "Vendor {name} has been approved successfully"
}
```

---

### 2. **Reject Vendor**
**Endpoint:** `POST /admin/vendor/reject`

**Payload:**
```json
{
  "vendorId": "vendor_abc123",
  "rejectedBy": "Admin Name",
  "reason": "Rejection reason"
}
```

**What it does:**
- Sets `status: 'rejected'`
- Stores rejection reason
- Logs rejection in history

---

### 3. **Request More Information**
**Endpoint:** `POST /admin/vendor/request-info`

**Payload:**
```json
{
  "vendorId": "vendor_abc123",
  "requestedBy": "Admin Name",
  "message": "Please provide...",
  "requiredFields": ["field1", "field2"]
}
```

**What it does:**
- Sets `status: 'more_info_required'`
- **PRESERVES vendor profile** - doesn't delete anything
- Stores admin message
- Vendor can edit and resubmit

---

### 4. **Check Vendor Status**
**Endpoint:** `GET /vendor/status/:phone`

**Returns:**
```json
{
  "status": "approved",
  "hasApplication": true,
  "vendorId": "vendor_abc123",
  "applicationId": "app_123",
  "fullName": "John Doe",
  "roleId": "role_vet",
  "roleName": "Veterinarian",
  "isActive": true,
  "setupCompleted": true,
  "canAccessDashboard": true
}
```

**Use:** VendorApp calls this on login to determine which screen to show.

---

### 5. **Find Vendor by Phone**
**Endpoint:** `GET /vendor/find-by-phone/:phone`

**Returns:**
```json
{
  "vendor": {
    "id": "vendor_abc123",
    "phone": "9876543210",
    "fullName": "John Doe",
    "status": "approved",
    "isActive": true,
    "setupCompleted": true,
    "roleId": "role_vet",
    "roleName": "Veterinarian",
    /* ... all vendor fields ... */
  }
}
```

**Use:** Loads complete vendor profile with all fields.

---

## 🎨 **FRONTEND ROUTING LOGIC**

### **VendorApp.tsx** (Main Entry Point)

```
User logs in with phone
    ↓
Call /vendor/status/:phone
    ↓
┌─────────────────────────┐
│ Has application?        │
├─────────────────────────┤
│ NO → Show Role Selection│
│ YES → Load vendor data  │
└─────────────────────────┘
    ↓
Call /vendor/find-by-phone/:phone
    ↓
Set vendorData state
    ↓
Check: isNewVendor?
    ↓
┌─────────────────────────────────┐
│ isNewVendor = true              │
│   Show role selection/onboarding│
│                                 │
│ isNewVendor = false             │
│   Route to VendorLandingPage    │
└─────────────────────────────────┘
```

### **VendorLandingPage.tsx** (Smart Router)

Based on vendor status, shows appropriate screen:

| Status | Screen | Description |
|--------|--------|-------------|
| `approved` + `isActive=true` + `setupCompleted=true` | Dashboard | Full vendor dashboard |
| `pending` or `resubmitted` | Under Review | "We're reviewing your application" |
| `more_info_required` | Clarification Screen | Shows admin message, allows edit |
| `rejected` | Rejection Screen | Shows reason, allows reapply |

---

## 🚨 **CRITICAL FIX: Admin Action Handlers**

### **AdminVendorManagementNew.tsx**

**THE BUG:**
The pending applications endpoint returns:
```json
{
  "id": "app_123",  // This is the APPLICATION ID, not the VENDOR ID!
  "applicationId": "app_123",
  "vendorId": "vendor_abc123"  // THIS is the actual vendor ID
}
```

**THE FIX:**
All admin action handlers must use `vendor.vendorId`, NOT `vendor.id`:

```typescript
// ✅ CORRECT
const handleApprove = async (applicationId: string) => {
  const vendor = applications.find(app => app.id === applicationId);
  
  await fetch('/admin/vendor/approve', {
    body: JSON.stringify({
      vendorId: vendor.vendorId  // ✅ Use vendorId
    })
  });
};

// ❌ WRONG
const handleApprove = async (applicationId: string) => {
  const vendor = applications.find(app => app.id === applicationId);
  
  await fetch('/admin/vendor/approve', {
    body: JSON.stringify({
      vendorId: vendor.id  // ❌ This is the APPLICATION ID!
    })
  });
};
```

---

## 🔧 **ENDPOINTS FILE ORGANIZATION**

All approval workflow endpoints are centralized in:
**`/supabase/functions/server/vendor-approval-workflow.tsx`**

This file contains:
- ✅ Approve endpoint
- ✅ Reject endpoint
- ✅ Request info endpoint
- ✅ Resubmit endpoint
- ✅ Status check endpoint
- ✅ History tracking

**Benefits:**
1. **Single source of truth** - All workflow logic in one place
2. **Consistent status handling** - No conflicting implementations
3. **Easy maintenance** - One file to update for workflow changes
4. **Proper state management** - All status transitions in one place

---

## 📝 **STATUS FIELD REQUIREMENTS**

When a vendor is **approved**, these fields MUST be set:

```typescript
{
  status: 'approved',
  isActive: true,           // ✅ REQUIRED - Enables dashboard access
  setupCompleted: true,     // ✅ REQUIRED - Marks onboarding done
  approvedBy: 'Admin Name',
  approvedAt: '2025-01-15T10:00:00Z',
  approvalNotes: 'Optional notes'
}
```

**Why both `isActive` and `setupCompleted`?**
- `isActive`: Business logic - Can vendor operate?
- `setupCompleted`: Technical flag - Has vendor finished all onboarding steps?
- Dashboard shows ONLY if BOTH are `true`

---

## 🎯 **TESTING CHECKLIST**

### Approval Flow
- [ ] Admin approves vendor → Status changes to `approved`
- [ ] Vendor logs in → Sees dashboard immediately
- [ ] No "choose role" screen shown
- [ ] Dashboard is fully functional

### Request Info Flow
- [ ] Admin requests more info → Status changes to `more_info_required`
- [ ] Vendor logs in → Sees clarification screen (NOT role selection)
- [ ] Vendor profile is preserved (role, name, etc.)
- [ ] Vendor can edit and resubmit
- [ ] After resubmit → Status changes to `resubmitted`
- [ ] Admin sees resubmitted application
- [ ] Admin can approve/reject again

### Rejection Flow
- [ ] Admin rejects vendor → Status changes to `rejected`
- [ ] Vendor logs in → Sees rejection reason
- [ ] Vendor can see reason and contact info
- [ ] Vendor profile is preserved for records

---

## 🔐 **SECURITY CONSIDERATIONS**

1. **Status changes** - Only admin can change status
2. **Vendor editing** - Only allowed when `status === 'more_info_required'`
3. **Dashboard access** - Requires `isActive && setupCompleted`
4. **Phone lookup** - Returns vendor data only for that phone

---

## 🚀 **FUTURE ENHANCEMENTS**

1. **Email notifications** - Notify vendor when status changes
2. **SMS alerts** - Send SMS for approval/rejection
3. **Document reupload** - Allow specific document replacements
4. **Admin comments** - Thread-based communication
5. **Auto-reminders** - Remind vendor if no action in 7 days
6. **Bulk actions** - Approve/reject multiple vendors at once (already implemented!)

---

## 📚 **KEY LEARNINGS**

### What Went Wrong:
1. Mixing `id` and `vendorId` in responses
2. Not setting `isActive` and `setupCompleted` on approval
3. Multiple conflicting status check endpoints
4. Unclear status value standards

### What Was Fixed:
1. ✅ Centralized workflow endpoints
2. ✅ Consistent field naming
3. ✅ Proper status field updates
4. ✅ Clear documentation
5. ✅ Comprehensive logging

---

## 📞 **DEBUGGING GUIDE**

### Vendor shows "Choose Role" after approval:

**Check:**
1. Console logs in VendorApp.tsx - Does `/vendor/status/:phone` return data?
2. Is `hasApplication: true` in the response?
3. Does `/vendor/find-by-phone/:phone` return the vendor?
4. Is `isActive: true` in vendor data?
5. Is `setupCompleted: true` in vendor data?

**Common causes:**
- Admin used wrong `vendorId` when approving
- Approval endpoint didn't set `isActive` or `setupCompleted`
- Phone lookup finding wrong vendor or none at all
- Key pattern mismatch in database

### Vendor shows "Under Review" after approval:

**Check:**
1. Vendor record `status` field - is it `'approved'`?
2. VendorLandingPage status mapping - is it handling `'approved'` correctly?
3. Is there a typo in status value? (`'approve'` vs `'approved'`)

---

## 🎉 **SUCCESS CRITERIA**

The system works correctly when:

✅ Approved vendors can immediately access their dashboard  
✅ Vendors with more info requests see clarification screen (not role selection)  
✅ Rejected vendors see rejection reason  
✅ No vendor is ever asked to "choose role" twice  
✅ All status changes are logged in history  
✅ Admin sees accurate vendor counts and statuses  

---

**Last Updated:** 2025-01-15  
**Version:** 2.0  
**Status:** Production Ready ✅
