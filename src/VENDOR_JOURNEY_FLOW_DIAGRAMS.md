# 🎯 VENDOR JOURNEY FLOW DIAGRAMS
## Expected vs Actual Implementation

**Date:** November 16, 2025  
**Purpose:** Visual documentation of vendor workflows showing gaps

---

## 📊 FLOW 1: WALKER VENDOR (APPROVED PATH)

### Expected Flow:
```
┌─────────────────────────────────────────────────────────────────┐
│                    WALKER VENDOR - HAPPY PATH                    │
└─────────────────────────────────────────────────────────────────┘

1. SIGNUP & ONBOARDING
   ┌──────────────┐
   │ VendorAuth   │ → Enter phone: 9900001111
   │ (Phone OTP)  │ → Verify OTP
   └──────┬───────┘
          │
          ▼
   ┌──────────────┐
   │ Role         │ → Select "Walker"
   │ Selection    │
   └──────┬───────┘
          │
          ▼
   ┌──────────────────────┐
   │ Dynamic Onboarding   │ → Fill basic info
   │ (Walker specific)    │ → Upload Aadhaar, GST
   │                      │ → NO medical license needed
   │ Fields:              │ → Bank details
   │ ✓ Full Name          │
   │ ✓ Business Name      │
   │ ✓ Email/Address      │
   │ ✓ Aadhaar (F/B)      │
   │ ✓ GST Certificate    │
   │ ✓ Police Verification│
   │ ✓ Bank Details       │
   │ ✗ Medical License    │ ← NOT REQUIRED
   └──────┬───────────────┘
          │
          ▼ [SUBMIT]
   ┌──────────────┐
   │ Application  │ → Status: 'pending'
   │ Submitted    │ → Show success message
   └──────┬───────┘
          │
          ▼

2. ADMIN REVIEW
   ┌──────────────────────┐
   │ Admin Portal         │
   │ Pending Applications │ → Review Walker application
   │                      │ → Check documents
   └──────┬───────────────┘
          │
          ▼ [APPROVE]
   ┌──────────────┐
   │ Approval     │ → Status: 'approved'
   │ Action       │ → isActive: true
   │              │ → setupCompleted: false
   │              │ → Send SMS/Email notification
   └──────┬───────┘
          │
          ▼

3. SERVICE SETUP
   ┌──────────────────────┐
   │ Walker Logs In       │
   └──────┬───────────────┘
          │
          ▼
   ┌──────────────────────┐
   │ VendorLandingPage    │ → Detects status='approved'
   │                      │ → Routes to service setup
   └──────┬───────────────┘
          │
          ▼
   ┌──────────────────────────────┐
   │ VendorServiceManagementComplete│
   │                              │
   │ Load Role Config:            │
   │ Walker → allowedStyles:      │
   │   ✓ at_home                  │
   │   ✗ at_center                │ ← Filtered out
   │   ✗ tele                     │ ← Filtered out
   └──────┬───────────────────────┘
          │
          ▼ [Select "at_home"]
   ┌──────────────────────────────┐
   │ VendorServiceConfiguration   │
   │                              │
   │ Load Catalog Services:       │
   │ Category: Walking            │
   │   ☐ 30 Minute Walk - ₹300    │
   │   ☐ 60 Minute Walk - ₹500    │
   │   ☐ Play Session - ₹400      │
   │   ☐ Run & Exercise - ₹600    │
   │                              │
   │ [+ Add Custom Service]       │ ← EXPECTED but MISSING
   └──────┬───────────────────────┘
          │
          ▼ [Enable "30 Min Walk"]
   ┌──────────────────────────────┐
   │ Service Enabled              │
   │                              │
   │ Price: ₹300 (catalog)        │
   │ Distance: 5km (default)      │
   │                              │
   │ Approval: AUTO ✓             │ ← No change = auto-approve
   │ Status: LIVE immediately     │
   └──────┬───────────────────────┘
          │
          ▼

4. CUSTOMER APP VISIBILITY
   ┌──────────────────────────────┐
   │ Customer App                 │
   │                              │
   │ Search: "Dog Walking"        │
   │ Location: 2km from Walker    │
   │                              │
   │ Results:                     │
   │ ┌─────────────────────┐     │
   │ │ Walker Name         │     │
   │ │ ⭐ 4.5 (0 reviews)  │     │
   │ │                     │     │
   │ │ 30 Minute Walk      │     │
   │ │ ₹300 • 2.1 km away  │     │
   │ │ [Book Now]          │     │
   │ └─────────────────────┘     │
   └─────────────────────────────┘

5. OPTIONAL: CUSTOM SERVICE
   ┌──────────────────────────────┐
   │ Walker: Add Custom Service   │
   │                              │
   │ Service: "Beach Walk"        │
   │ Duration: 60 mins            │
   │ Price: ₹800                  │
   │ Description: Walk on beach   │
   │                              │
   │ [Submit for Approval]        │
   └──────┬───────────────────────┘
          │
          ▼
   ┌──────────────────────────────┐
   │ Admin Reviews Custom Service │
   │                              │
   │ Service: "Beach Walk"        │
   │ Vendor: Walker               │
   │ Price: ₹800                  │
   │                              │
   │ [Approve] [Reject]           │
   └──────┬───────────────────────┘
          │
          ▼ [APPROVE]
   ┌──────────────────────────────┐
   │ Custom Service LIVE          │
   │ Visible to customers         │
   └──────────────────────────────┘
```

### Actual Implementation:

```
✅ WORKING:
├─ VendorAuth (phone login)
├─ VendorRoleSelection
├─ DynamicVendorOnboarding
├─ Application submission
├─ Admin approval endpoints
├─ VendorLandingPage routing
├─ VendorServiceManagementComplete
└─ Service style filtering by role

⚠️ PARTIALLY WORKING (Not Tested):
├─ Catalog service loading
├─ Service enablement
├─ Price/distance controls
└─ Customer app visibility

❌ MISSING:
├─ Custom service wizard
├─ Custom service approval flow
├─ Auto-approval logic unclear
└─ End-to-end booking verification
```

---

## 📊 FLOW 2: VET VENDOR (REQUEST MORE INFO PATH)

### Expected Flow:

```
┌─────────────────────────────────────────────────────────────────┐
│              VET VENDOR - REQUEST MORE INFO PATH                 │
└─────────────────────────────────────────────────────────────────┘

1. SIGNUP & INCOMPLETE ONBOARDING
   ┌──────────────┐
   │ VendorAuth   │ → Phone: 9900002222
   └──────┬───────┘
          │
          ▼
   ┌──────────────┐
   │ Role         │ → Select "Veterinarian"
   │ Selection    │
   └──────┬───────┘
          │
          ▼
   ┌──────────────────────┐
   │ Dynamic Onboarding   │
   │ (Vet specific)       │
   │                      │
   │ Fields:              │
   │ ✓ Full Name          │
   │ ✓ Business Name      │
   │ ✓ Email/Address      │
   │ ✓ Aadhaar (F/B)      │
   │ ✓ GST Certificate    │
   │ ✗ Medical License    │ ← SKIPPED/FORGOT
   │ ✓ Bank Details       │
   └──────┬───────────────┘
          │
          ▼ [SUBMIT]
   ┌──────────────┐
   │ Application  │ → Status: 'pending'
   │ Submitted    │
   └──────┬───────┘
          │
          ▼

2. ADMIN REVIEW - REQUEST MORE INFO
   ┌──────────────────────┐
   │ Admin Portal         │ → Reviews application
   │ Pending Applications │ → Notices missing medical license
   └──────┬───────────────┘
          │
          ▼ [REQUEST MORE INFO]
   ┌──────────────────────┐
   │ Request Info Action  │
   │                      │
   │ Message:             │
   │ "Medical license is  │
   │  required for        │
   │  veterinarians.      │
   │  Please upload."     │
   │                      │
   │ Required Fields:     │
   │ - Medical License    │
   └──────┬───────────────┘
          │
          ▼
   ┌──────────────┐
   │ Status       │ → Status: 'more_info_required'
   │ Updated      │ → Send SMS/Email notification
   │              │ → Create notification in system
   └──────┬───────┘
          │
          ▼

3. VET RESPONDS TO REQUEST
   ┌──────────────────────┐
   │ Vet Logs In          │
   └──────┬───────────────┘
          │
          ▼
   ┌──────────────────────────────┐
   │ VendorLandingPage            │ → Detects more_info_required
   └──────┬───────────────────────┘
          │
          ▼
   ┌──────────────────────────────┐
   │ 🔔 NOTIFICATION BANNER       │ ← EXPECTED but MISSING
   │                              │
   │ ⚠️ Action Required           │
   │ "Admin has requested         │
   │  additional information"     │
   │                              │
   │ [View Details]               │
   └──────┬───────────────────────┘
          │
          ▼
   ┌──────────────────────────────┐
   │ VendorClarificationRequested │
   │                              │
   │ 📝 Admin Feedback:           │
   │ "Medical license is required │
   │  for veterinarians.          │
   │  Please upload."             │
   │                              │
   │ What to do next:             │
   │ 1. Review feedback           │
   │ 2. Go back to form           │
   │ 3. Upload missing docs       │
   │ 4. Resubmit application      │
   │                              │
   │ [Correct & Resubmit] ◄────── │ BUTTON EXISTS
   └──────┬───────────────────────┘
          │
          ▼ [CLICK]
   ┌──────────────────────────────┐
   │ RE-ENTER ONBOARDING          │ ← EXPECTED but NOT IMPLEMENTED
   │                              │
   │ DynamicVendorOnboarding      │
   │ Mode: EDIT/RESUBMIT          │
   │                              │
   │ Fields PRE-FILLED:           │
   │ ✓ Full Name: [Loaded]        │
   │ ✓ Business Name: [Loaded]    │
   │ ✓ Email: [Loaded]            │
   │ ✓ Aadhaar: [Already uploaded]│
   │ ⚠️ Medical License: [MISSING]│ ← Highlighted
   │ ✓ Bank Details: [Loaded]     │
   │                              │
   │ Upload Medical License:      │
   │ [Choose File] ←────────────  │ RE-UPLOAD CAPABILITY
   │ [✓ medical_license.pdf]      │
   └──────┬───────────────────────┘
          │
          ▼ [RESUBMIT]
   ┌──────────────────────────────┐
   │ Resubmission Endpoint        │ ← EXPECTED but MISSING
   │                              │
   │ POST /vendor/{id}/           │
   │      resubmit-application    │
   │                              │
   │ Changes:                     │
   │ + Medical License uploaded   │
   │ Status → 'resubmitted'       │
   └──────┬───────────────────────┘
          │
          ▼
   ┌──────────────┐
   │ Application  │ → Status: 'resubmitted'
   │ Resubmitted  │ → Back in admin queue
   └──────┬───────┘
          │
          ▼

4. ADMIN RE-REVIEWS & APPROVES
   ┌──────────────────────┐
   │ Admin Portal         │ → Sees resubmitted application
   │ Pending Applications │ → Reviews medical license
   └──────┬───────────────┘
          │
          ▼ [APPROVE]
   ┌──────────────┐
   │ Approval     │ → Status: 'approved'
   │ Action       │ → isActive: true
   └──────┬───────┘
          │
          ▼

5. VET SERVICE SETUP (Same as Walker)
   ┌──────────────────────────────┐
   │ VendorServiceManagementComplete│
   │                              │
   │ Load Role Config:            │
   │ Veterinarian → allowedStyles:│
   │   ✗ at_home                  │ ← Filtered out
   │   ✓ at_center                │
   │   ✓ tele                     │
   │                              │
   │ Select: at_center            │
   └──────┬───────────────────────┘
          │
          ▼
   ┌──────────────────────────────┐
   │ Catalog Services (at_center) │
   │                              │
   │ Category: Veterinary         │
   │   ☐ Consultation - ₹500      │
   │   ☐ Vaccination - ₹300       │
   │   ☐ Surgery - ₹5000          │
   │   ☐ X-Ray - ₹1500            │
   └──────┬───────────────────────┘
          │
          ▼
   ┌──────────────────────────────┐
   │ Select: tele                 │
   │                              │
   │ Category: Veterinary         │
   │   ☐ Video Consultation - ₹400│
   │   ☐ Chat Consultation - ₹200 │
   └──────────────────────────────┘
```

### Actual Implementation:

```
✅ WORKING:
├─ VendorAuth
├─ VendorRoleSelection
├─ DynamicVendorOnboarding (vet fields)
├─ Application submission
├─ Admin request-info endpoint
├─ VendorClarificationRequested screen
└─ "Correct & Resubmit" button (UI only)

❌ BROKEN - CRITICAL:
├─ ❌ Notification banner missing
├─ ❌ Re-enter onboarding NOT implemented
├─ ❌ Form pre-fill NOT implemented
├─ ❌ Document re-upload NOT supported
├─ ❌ Resubmit endpoint MISSING
└─ ❌ Entire feedback loop BROKEN

BLOCKER: Vet is STUCK after admin requests info!
```

---

## 📊 FLOW 3: TRAINER VENDOR (REJECTION → RESUBMIT PATH)

### Expected Flow:

```
┌─────────────────────────────────────────────────────────────────┐
│           TRAINER VENDOR - REJECTION & RESUBMIT PATH             │
└─────────────────────────────────────────────────────────────────┘

1. SIGNUP & POOR QUALITY SUBMISSION
   ┌──────────────┐
   │ VendorAuth   │ → Phone: 9900003333
   └──────┬───────┘
          │
          ▼
   ┌──────────────┐
   │ Role         │ → Select "Trainer"
   │ Selection    │
   └──────┬───────┘
          │
          ▼
   ┌──────────────────────┐
   │ Dynamic Onboarding   │
   │ (Trainer specific)   │
   │                      │
   │ Fields:              │
   │ ✓ Full Name          │
   │ ✓ Business Name      │
   │ ✓ Email/Address      │
   │ ✓ Aadhaar (F/B)      │
   │ ⚠️ Certification     │ ← POOR QUALITY/BLURRY
   │ ✓ Bank Details       │
   └──────┬───────────────┘
          │
          ▼ [SUBMIT]
   ┌──────────────┐
   │ Application  │ → Status: 'pending'
   │ Submitted    │
   └──────┬───────┘
          │
          ▼

2. ADMIN REVIEW - REJECTION
   ┌──────────────────────┐
   │ Admin Portal         │ → Reviews application
   │ Pending Applications │ → Certification not clear
   └──────┬───────────────┘
          │
          ▼ [REJECT]
   ┌──────────────────────┐
   │ Rejection Action     │
   │                      │
   │ Reason:              │
   │ "The training        │
   │  certification       │
   │  document is not     │
   │  clear. Please       │
   │  re-upload a high    │
   │  quality scan."      │
   │                      │
   │ ☑️ Allow Resubmit     │
   └──────┬───────────────┘
          │
          ▼
   ┌──────────────┐
   │ Status       │ → Status: 'rejected'
   │ Updated      │ → rejectionReason saved
   │              │ → allowResubmit: true
   │              │ → Send notification
   └──────┬───────┘
          │
          ▼

3. TRAINER RESPONDS TO REJECTION
   ┌──────────────────────┐
   │ Trainer Logs In      │
   └──────┬───────────────┘
          │
          ▼
   ┌──────────────────────────────┐
   │ VendorLandingPage            │ → Detects status='rejected'
   └──────┬───────────────────────┘
          │
          ▼
   ┌──────────────────────────────┐
   │ 🔔 NOTIFICATION BANNER       │ ← EXPECTED but MISSING
   │                              │
   │ ❌ Application Rejected      │
   │ "Your application needs      │
   │  revision"                   │
   │                              │
   │ [View Details]               │
   └──────┬───────────────────────┘
          │
          ▼
   ┌──────────────────────────────┐
   │ VendorApplicationRejected    │
   │                              │
   │ ❌ Application Needs Revision│
   │                              │
   │ Reason for Revision:         │
   │ "The training certification  │
   │  document is not clear.      │
   │  Please re-upload a high     │
   │  quality scan."              │
   │                              │
   │ What's Next?                 │
   │ 1. Review feedback           │
   │ 2. Update application        │
   │ 3. Resubmit for review       │
   │                              │
   │ [Correct & Resubmit] ◄────── │ BUTTON EXISTS
   │ [Start Fresh Application]    │
   └──────┬───────────────────────┘
          │
          ▼ [Correct & Resubmit]
   ┌──────────────────────────────┐
   │ RE-ENTER ONBOARDING          │ ← EXPECTED but NOT IMPLEMENTED
   │                              │
   │ DynamicVendorOnboarding      │
   │ Mode: CORRECTION             │
   │                              │
   │ Fields PRE-FILLED:           │
   │ ✓ Full Name: [Loaded]        │
   │ ✓ Business Name: [Loaded]    │
   │ ⚠️ Certification: [Rejected] │ ← Highlighted in red
   │   Current: blurry_cert.jpg   │
   │   [Replace with better scan] │
   │                              │
   │ Upload New Certification:    │
   │ [Choose File] ←────────────  │ RE-UPLOAD
   │ [✓ clear_certification.pdf]  │
   │                              │
   │ Admin Feedback Visible:      │
   │ 💬 "Document not clear"      │
   └──────┬───────────────────────┘
          │
          ▼ [RESUBMIT]
   ┌──────────────────────────────┐
   │ Resubmission Endpoint        │ ← EXPECTED but MISSING
   │                              │
   │ POST /vendor/{id}/           │
   │      resubmit-application    │
   │                              │
   │ Changes:                     │
   │ + New certification uploaded │
   │ Status → 'resubmitted'       │
   │ ResubmissionCount: 1         │
   └──────┬───────────────────────┘
          │
          ▼
   ┌──────────────┐
   │ Application  │ → Status: 'resubmitted'
   │ Resubmitted  │ → Back in admin queue
   └──────┬───────┘
          │
          ▼

4. ADMIN RE-REVIEWS & APPROVES
   ┌──────────────────────┐
   │ Admin Portal         │ → Sees resubmitted application
   │ Pending Applications │ → Reviews new certification
   │                      │ → Quality is good now
   └──────┬───────────────┘
          │
          ▼ [APPROVE]
   ┌──────────────┐
   │ Approval     │ → Status: 'approved'
   │ Action       │ → isActive: true
   └──────┬───────┘
          │
          ▼

5. TRAINER SERVICE SETUP (Same as Walker)
   ┌──────────────────────────────┐
   │ VendorServiceManagementComplete│
   │                              │
   │ Load Role Config:            │
   │ Trainer → allowedStyles:     │
   │   ✓ at_home                  │
   │   ✓ at_center                │
   │   ✗ tele                     │ ← Filtered out
   └──────┬───────────────────────┘
          │
          ▼
   ┌──────────────────────────────┐
   │ Catalog Services (at_home)   │
   │                              │
   │ Category: Training           │
   │   ☐ Basic Obedience - ₹800   │
   │   ☐ Advanced Training - ₹1500│
   │   ☐ Agility Training - ₹1200 │
   │   ☐ Behavior Correction - ₹1000│
   └──────┬───────────────────────┘
          │
          ▼
   ┌──────────────────────────────┐
   │ Catalog Services (at_center) │
   │                              │
   │ Category: Training           │
   │   ☐ Group Class - ₹500       │
   │   ☐ Private Session - ₹1200  │
   │   ☐ Boot Camp - ₹5000        │
   └──────────────────────────────┘
```

### Actual Implementation:

```
✅ WORKING:
├─ VendorAuth
├─ VendorRoleSelection
├─ DynamicVendorOnboarding (trainer fields)
├─ Application submission
├─ Admin rejection endpoint
├─ VendorApplicationRejected screen
└─ "Correct & Resubmit" button (UI only)

❌ BROKEN - CRITICAL:
├─ ❌ Notification banner missing
├─ ❌ Re-enter onboarding NOT implemented
├─ ❌ Form pre-fill NOT implemented
├─ ❌ Document replacement NOT supported
├─ ❌ Resubmit endpoint MISSING
├─ ❌ Rejection history tracking unclear
└─ ❌ Entire correction loop BROKEN

BLOCKER: Trainer is STUCK after rejection!
Same issues as Vet scenario.
```

---

## 📊 COMPARISON MATRIX

### Feature Implementation Status

| Feature | Expected | Actual | Gap |
|---------|----------|--------|-----|
| **Onboarding** | | | |
| Phone auth | ✅ Required | ✅ Implemented | None |
| Role selection | ✅ Required | ✅ Implemented | None |
| Dynamic form fields | ✅ By role | ✅ Implemented | None |
| Document upload | ✅ Role-specific | ✅ Implemented | Validation unclear |
| Application submit | ✅ Creates vendor | ✅ Implemented | None |
| **Admin Approval** | | | |
| View pending apps | ✅ Required | ✅ Implemented | None |
| Approve action | ✅ Required | ✅ Implemented | None |
| Reject action | ✅ Required | ✅ Implemented | None |
| Request more info | ✅ Required | ✅ Implemented | None |
| **Vendor Response** | | | |
| See rejection | ✅ Screen shown | ✅ Implemented | None |
| See clarification | ✅ Screen shown | ✅ Implemented | None |
| Notification banner | ✅ Required | ❌ **MISSING** | **CRITICAL** |
| Re-enter onboarding | ✅ Edit form | ❌ **MISSING** | **CRITICAL** |
| Pre-filled data | ✅ Load previous | ❌ **MISSING** | **CRITICAL** |
| Re-upload docs | ✅ Replace files | ❌ **MISSING** | **CRITICAL** |
| Resubmit endpoint | ✅ POST /resubmit | ❌ **MISSING** | **CRITICAL** |
| **Service Setup** | | | |
| Access after approval | ✅ Required | ✅ Implemented | None |
| Load role config | ✅ Service styles | ✅ Implemented | None |
| Filter by role | ✅ Only allowed | ✅ Implemented | Needs testing |
| Enable catalog service | ✅ Click to enable | ⚠️ Not tested | Unknown |
| Set price/distance | ✅ Where allowed | ⚠️ Not tested | Unknown |
| Auto-approve unchanged | ✅ No admin review | ⚠️ Unclear | Unknown |
| Create custom service | ✅ Wizard flow | ❌ **MISSING** | **HIGH** |
| Custom service approval | ✅ Admin review | ❌ **MISSING** | **HIGH** |
| **Customer Integration** | | | |
| Services visible | ✅ In search | ⚠️ Not tested | Unknown |
| Location filter | ✅ By distance | ⚠️ Not tested | Unknown |
| Style filter | ✅ at_home/center | ⚠️ Not tested | Unknown |
| Availability filter | ✅ Only available | ⚠️ Not tested | Unknown |
| Booking flow | ✅ End-to-end | ⚠️ Not tested | Unknown |

---

## 🎯 DATA FLOW DIAGRAM

### Current vs Expected Data Flow:

```
┌─────────────────────────────────────────────────────────────────┐
│                    CURRENT DATA FLOW                             │
└─────────────────────────────────────────────────────────────────┘

SIGNUP → ONBOARD → SUBMIT
                      │
                      ▼
                  [KV Store]
                  vendor:vendor_xxx
                  status: 'pending'
                      │
                      ▼
         ┌────────────┴────────────┐
         │                         │
      APPROVE                   REJECT/MORE INFO
         │                         │
         ▼                         ▼
    status: 'approved'        status: 'rejected'/'more_info_required'
    isActive: true            Show screen with message
         │                         │
         ▼                         │
    SERVICE SETUP            [❌ DEAD END] ← BROKEN!
         │                         │
         ▼                    No way to edit!
    Enable catalog services       │
         │                         │
         ▼                         │
    [⚠️ CUSTOMER APP?]            │
    [Visibility unknown]          │
                                  │
                            User is STUCK!


┌─────────────────────────────────────────────────────────────────┐
│                    EXPECTED DATA FLOW                            │
└─────────────────────────────────────────────────────────────────┘

SIGNUP → ONBOARD → SUBMIT
                      │
                      ▼
                  [KV Store]
                  vendor:vendor_xxx
                  status: 'pending'
                      │
                      ▼
                  [Notifications]
                  notification:vendor_xxx:notif_1
                      │
                      ▼
         ┌────────────┴────────────┐
         │                         │
      APPROVE                   REJECT/MORE INFO
         │                         │
         ▼                         ▼
    status: 'approved'        status: 'rejected'/'more_info_required'
    ✅ Notification sent      ✅ Notification sent
         │                         │
         ▼                         ▼
    SERVICE SETUP            SEE NOTIFICATION
         │                         │
         ▼                         ▼
    Filter by role config    CLICK "Correct & Resubmit"
         │                         │
         ▼                         ▼
    Enable services          ✅ LOAD EXISTING DATA
         │                         │
         ▼                         ▼
    Catalog (unmodified)     RE-ENTER ONBOARDING
    → Auto-approve                │ (Pre-filled form)
    → LIVE immediately            │
         │                         ▼
         ▼                    UPLOAD NEW DOCS
    Custom services               │
    → Admin approval              ▼
    → Pending                 RESUBMIT
         │                         │
         ▼                         ▼
    [Customer App]           status: 'resubmitted'
    ├─ Filter: location           │
    ├─ Filter: style              ▼
    ├─ Filter: role          ADMIN RE-REVIEWS
    └─ Filter: availability       │
         │                         ▼
         ▼                    APPROVE/REJECT again
    BOOKING FLOW                  │
         │                         ▼
         ▼                    LOOP until approved
    Vendor notified               │
         │                         ▼
         ▼                    SERVICE SETUP
    Session starts           (Same as approved path)
```

---

## 🔄 STATE TRANSITION DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│              VENDOR STATUS STATE MACHINE                         │
└─────────────────────────────────────────────────────────────────┘

                    ┌─────────┐
                    │  NEW    │ (Phone verified, no profile)
                    └────┬────┘
                         │
                         ▼ [Select Role]
                    ┌─────────┐
                    │ONBOARDING│
                    └────┬────┘
                         │
                         ▼ [Submit]
                    ┌─────────┐
                    │ PENDING │ (Awaiting admin review)
                    └────┬────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          ▼ [Approve]    ▼ [Reject]     ▼ [Request Info]
    ┌─────────┐    ┌──────────┐   ┌───────────────┐
    │APPROVED │    │ REJECTED │   │ MORE_INFO_REQ │
    └────┬────┘    └────┬─────┘   └───────┬───────┘
         │              │                  │
         │              │ ❌ MISSING IMPL  │ ❌ MISSING IMPL
         │              │                  │
         │              ▼ [Resubmit]       ▼ [Correct & Resubmit]
         │         ┌──────────┐       ┌──────────┐
         │         │RESUBMITTED│       │RESUBMITTED│
         │         └────┬─────┘       └────┬─────┘
         │              │                  │
         │              └──────┬───────────┘
         │                     │
         │                     ▼ [Back to Admin]
         │                ┌─────────┐
         │                │ PENDING │
         │                └────┬────┘
         │                     │
         │                     └──────────┐
         │                                │
         ▼ [Service Setup Starts]         ▼ [Eventually Approved]
    ┌─────────────────┐          ┌─────────────────┐
    │APPROVED_SERVICES│          │APPROVED_SERVICES│
    └────┬────────────┘          └────┬────────────┘
         │                            │
         ▼ [Enable Services]          ▼ [Same Flow]
    ┌────────────────────┐
    │APPROVED_AVAILABILITY│
    └────┬────────────────┘
         │
         ▼ [Complete Availability]
    ┌─────────────┐
    │SETUP_COMPLETE│
    └────┬─────────┘
         │
         ▼ [Activate]
    ┌─────────┐
    │ ACTIVE  │ ← FINAL STATE
    └─────────┘
    
LEGEND:
✅ Implemented path
❌ Missing implementation
⚠️ Partially implemented
```

---

## 📝 NOTIFICATIONS FLOW

### Expected Notification System:

```
┌─────────────────────────────────────────────────────────────────┐
│                  NOTIFICATION ARCHITECTURE                       │
└─────────────────────────────────────────────────────────────────┘

ADMIN ACTION → CREATE NOTIFICATION → STORE IN KV → DISPLAY TO VENDOR

Example: Admin Approves Application
──────────────────────────────────

1. Admin clicks [APPROVE]
   └─→ POST /admin/vendor/approve

2. Backend creates notification:
   ┌──────────────────────────────────┐
   │ notification:vendor_xxx:notif_1  │
   │                                  │
   │ {                                │
   │   id: "notif_1",                 │
   │   type: "success",               │
   │   title: "Application Approved!", │
   │   message: "You can now...",     │
   │   actionLabel: "Set Up Services",│
   │   actionUrl: "service-setup",    │
   │   read: false,                   │
   │   createdAt: "2025-11-16..."     │
   │ }                                │
   └──────────────────────────────────┘

3. Vendor logs in:
   └─→ GET /vendor/:id/notifications
   └─→ Returns unread notifications

4. VendorNotificationBanner displays:
   ┌──────────────────────────────────┐
   │ 🔔 Notifications (1)             │
   ├──────────────────────────────────┤
   │ ✅ Application Approved!         │
   │ You can now set up your services │
   │                                  │
   │ [Set Up Services]  [Dismiss]     │
   └──────────────────────────────────┘

5. Vendor clicks action or dismiss:
   └─→ POST /vendor/:id/notifications/:notifId/read
   └─→ Mark as read

NOTIFICATION TYPES:
─────────────────
✅ success  → Green banner (Approved, etc.)
⚠️ warning  → Orange banner (More info needed)
❌ error    → Red banner (Rejected)
ℹ️ info     → Blue banner (General updates)
```

---

## 🎬 CONCLUSION

### Summary of Flows:

| Scenario | Frontend | Backend | Integration | Overall |
|----------|----------|---------|-------------|---------|
| Walker (Approved) | 🟢 80% | 🟢 80% | ⚠️ 40% | 🟡 **PARTIAL** |
| Vet (Request Info) | 🟡 50% | 🟢 70% | 🔴 0% | 🔴 **BROKEN** |
| Trainer (Rejected) | 🟡 50% | 🟢 70% | 🔴 0% | 🔴 **BROKEN** |

### Critical Missing Pieces:

1. ❌ **Re-onboarding flow** - Dead end for rejected/clarification vendors
2. ❌ **Notification system** - No communication of status changes
3. ❌ **Custom service wizard** - Cannot create custom offerings
4. ⚠️ **Customer integration** - Unverified if services actually show

### Next Steps:

1. Implement re-onboarding flow (BLOCKER)
2. Add notification system (BLOCKER)
3. Runtime test existing flows
4. Implement custom service wizard
5. Verify customer app integration

---

**Document Version:** 1.0  
**Last Updated:** November 16, 2025  
**Status:** Active - Implementation Required
