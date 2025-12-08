# QA Test Scenarios & Acceptance Panels

## 📋 Overview

Comprehensive test scenarios covering all major flows in Warmpawz platform with pass/fail criteria for QA validation.

---

## ✅ Scenario 1: Vendor with No Centres

### **Setup**
```json
{
  "vendorId": "vendor_no_centres_001",
  "businessName": "Mobile Pet Grooming Co",
  "roleId": "role_groomer",
  "roleConfiguration": {
    "roleName": "Mobile Groomer",
    "vendorTypes": ["grooming"],
    "serviceStyles": ["at_home"],
    "centreManagementEnabled": false,
    "staffManagementEnabled": true
  },
  "centres": [],
  "staff": [
    { "id": "staff_001", "fullName": "John Doe", "role": "groomer" }
  ]
}
```

### **Test Steps**

#### **Step 1: Service Publishing**
**Action:** Navigate to service catalog and attempt to publish a grooming service

**Expected Results:**
- ✅ Service publish form shows "Vendor Level" option ONLY
- ✅ "Centre Level" option is disabled/hidden (no centres available)
- ✅ Custom package option is DISABLED
- ✅ GPS tracking badge shows for at_home services
- ✅ Publish button works and service is published at vendor level

**Pass Criteria:**
```
□ Vendor level is default and only option
□ Centre level option not available
□ Custom packages button disabled with tooltip
□ Service publishes successfully
□ Published service appears in catalog
```

**Fail Criteria:**
```
✗ Centre level option is clickable
✗ Custom package option is enabled
✗ Error on publish attempt
```

---

#### **Step 2: Staff Scheduling**
**Action:** Create staff availability schedule

**Expected Results:**
- ✅ Schedule editor shows "Location-based schedule" mode
- ✅ Google Places search is visible and functional
- ✅ Centre selection dropdown is NOT shown
- ✅ Can set GPS location with radius
- ✅ Services filtered by roleConfiguration (grooming only)

**Pass Criteria:**
```
□ Location mode is automatic (no centre option)
□ Google Maps search works
□ Can set service radius (km)
□ Only grooming services appear in service list
□ Schedule saves successfully
```

**Fail Criteria:**
```
✗ Centre selection appears
✗ Services from other categories appear
✗ Cannot set location
```

---

#### **Step 3: Dashboard View**
**Action:** View vendor dashboard

**Expected Results:**
- ✅ "Centres" tab/section is HIDDEN
- ✅ Staff management is available
- ✅ Services show vendor-level publishing only
- ✅ Analytics show mobile service metrics

**Pass Criteria:**
```
□ No centres UI elements visible
□ Staff tab accessible
□ Published services list shows vendor-level services
□ Dashboard loads without errors
```

**Screenshot Panel:**
```
┌────────────────────────────────────────────────────┐
│ Mobile Pet Grooming Co - Dashboard                 │
├────────────────────────────────────────────────────┤
│ Tabs: [Services] [Staff] [Analytics] [Settings]   │
│                                                     │
│ ❌ NO "Centres" tab shown                          │
│ ✅ Staff management accessible                     │
│ ✅ Services: Vendor-level only                     │
└────────────────────────────────────────────────────┘
```

---

## ✅ Scenario 2: Vendor with Centres

### **Setup**
```json
{
  "vendorId": "vendor_with_centres_001",
  "businessName": "Downtown Vet Clinic Network",
  "roleId": "role_veterinarian",
  "roleConfiguration": {
    "roleName": "Veterinarian",
    "vendorTypes": ["veterinary"],
    "serviceStyles": ["at_center", "at_home", "tele"],
    "centreManagementEnabled": true,
    "staffManagementEnabled": true
  },
  "centres": [
    {
      "id": "centre_001",
      "name": "Downtown Clinic",
      "address": "123 Main St",
      "maxConcurrentBookings": 5
    },
    {
      "id": "centre_002",
      "name": "Uptown Branch",
      "address": "456 Park Ave",
      "maxConcurrentBookings": 3
    }
  ],
  "staff": []
}
```

### **Test Steps**

#### **Step 1: Service Publishing with Centre Selection**
**Action:** Publish a veterinary consultation service

**Expected Results:**
- ✅ Both "Vendor Level" and "Centre Level" options available
- ✅ Can select one or both centres for centre-level publishing
- ✅ Price override field appears for centre-level
- ✅ Custom package checkbox is ENABLED for centre-level
- ✅ Each centre shows in selection list with address

**Pass Criteria:**
```
□ Radio buttons for Vendor vs Centre level work
□ Can select/deselect centres
□ Price override field accepts input
□ Custom package option enabled when centre selected
□ Service publishes to selected centres
```

**Fail Criteria:**
```
✗ Cannot switch between vendor/centre level
✗ Centre selection doesn't save
✗ Custom packages blocked when centre selected
```

---

#### **Step 2: Staff Scheduling - Centre Mode**
**Action:** Create availability at specific centre

**Expected Results:**
- ✅ Two mode buttons: "At Centre" and "Custom Location"
- ✅ Default mode is "At Centre"
- ✅ Centre dropdown lists both Downtown and Uptown
- ✅ Location search is HIDDEN when centre mode selected
- ✅ Can switch to location mode (location search appears)

**Pass Criteria:**
```
□ Mode toggle works correctly
□ Centre dropdown shows all centres
□ Location search hidden in centre mode
□ Location search appears in location mode
□ Schedule saves with correct centre assignment
```

**Screenshot Panel:**
```
┌────────────────────────────────────────────────────┐
│ Schedule Editor - Centre Mode                      │
├────────────────────────────────────────────────────┤
│ Service Location:                                   │
│ ┌──────────┐  ┌──────────┐                        │
│ │ ● At     │  │ ○ Custom │                        │
│ │  Centre  │  │  Location│                        │
│ └──────────┘  └──────────┘                        │
│                                                     │
│ Select Centre: *                                    │
│ ┌────────────────────────────────────────┐         │
│ │ Downtown Clinic - 123 Main St         │         │
│ └────────────────────────────────────────┘         │
│                                                     │
│ [Location input HIDDEN in centre mode]             │
└────────────────────────────────────────────────────┘
```

---

#### **Step 3: Custom Package Creation**
**Action:** Create custom package for centre

**Expected Results:**
- ✅ "Create Custom Package" button is ENABLED
- ✅ Can select centre for package
- ✅ Can bundle multiple services
- ✅ Can set custom pricing
- ✅ Package appears in centre's service catalog

**Pass Criteria:**
```
□ Custom package creation flow accessible
□ Centre selection required
□ Multiple services can be added to package
□ Custom price can be set
□ Package saves and displays correctly
```

---

## ✅ Scenario 3: Staff Management OFF

### **Setup**
```json
{
  "vendorId": "vendor_no_staff_mgmt_001",
  "businessName": "Solo Walker Services",
  "roleId": "role_solo_walker",
  "roleConfiguration": {
    "roleName": "Solo Dog Walker",
    "vendorTypes": ["walking"],
    "serviceStyles": ["at_home"],
    "centreManagementEnabled": false,
    "staffManagementEnabled": false
  },
  "centres": [],
  "staff": []
}
```

### **Test Steps**

#### **Step 1: Dashboard Access**
**Action:** Navigate to vendor dashboard

**Expected Results:**
- ✅ "Staff" tab/section is HIDDEN
- ✅ No staff management options in settings
- ✅ Services assigned directly to vendor (no staff assignment)
- ✅ Schedule is vendor's personal schedule

**Pass Criteria:**
```
□ Staff tab completely hidden
□ No "Add Staff" buttons anywhere
□ Services work without staff assignment
□ Personal schedule editable
```

**Fail Criteria:**
```
✗ Staff tab appears
✗ Staff-related UI elements visible
✗ Errors when accessing services
```

---

#### **Step 2: Service Execution**
**Action:** Customer books a dog walking service

**Expected Results:**
- ✅ Service auto-assigned to vendor (not staff)
- ✅ Vendor receives booking notification
- ✅ OTP session manager works for vendor
- ✅ GPS tracking works for vendor

**Pass Criteria:**
```
□ Booking assigned to vendor ID directly
□ Vendor can start/end service with OTP
□ GPS tracking functions correctly
□ No staff assignment errors
```

**Screenshot Panel:**
```
┌────────────────────────────────────────────────────┐
│ Solo Walker Services - Dashboard                   │
├────────────────────────────────────────────────────┤
│ Tabs: [Services] [Schedule] [Analytics]            │
│                                                     │
│ ❌ NO "Staff" tab                                   │
│ ✅ Personal schedule editable                      │
│ ✅ Bookings assigned to vendor directly            │
└────────────────────────────────────────────────────┘
```

---

## ✅ Scenario 4: Tele-Only Role

### **Setup**
```json
{
  "vendorId": "vendor_tele_only_001",
  "businessName": "Virtual Vet Consultations",
  "roleId": "role_tele_vet",
  "roleConfiguration": {
    "roleName": "Tele Veterinarian",
    "vendorTypes": ["veterinary"],
    "serviceStyles": ["tele"],
    "centreManagementEnabled": false,
    "staffManagementEnabled": true
  },
  "centres": [],
  "staff": [
    { "id": "staff_dr_001", "fullName": "Dr. Emily", "role": "vet" }
  ]
}
```

### **Test Steps**

#### **Step 1: Service Catalog**
**Action:** Browse available services to publish

**Expected Results:**
- ✅ Only tele services appear in catalog
- ✅ Home service and centre service categories are FILTERED OUT
- ✅ GPS requirement badge does NOT appear (not applicable for tele)
- ✅ Video consultation services highlighted

**Pass Criteria:**
```
□ Service list shows only tele services
□ No home or centre services visible
□ No GPS indicators
□ All displayed services have serviceStyle='tele'
```

**Fail Criteria:**
```
✗ Home services appear in list
✗ Centre services appear in list
✗ GPS requirements mentioned
```

---

#### **Step 2: Staff Scheduling**
**Action:** Create tele availability schedule

**Expected Results:**
- ✅ No location input required
- ✅ No GPS tracking options
- ✅ No lead time or max distance fields (tele-specific)
- ✅ Buffer time field present (minimal, 5-10 min)
- ✅ Higher concurrent booking limits (3-5 simultaneous)

**Pass Criteria:**
```
□ Location fields completely hidden
□ No GPS configuration
□ No distance/lead time fields
□ Buffer time configurable (short)
□ Concurrent bookings > 1 allowed
```

**Screenshot Panel:**
```
┌────────────────────────────────────────────────────┐
│ Tele Availability Schedule                         │
├────────────────────────────────────────────────────┤
│ Monday 09:00 - 17:00                               │
│                                                     │
│ Services: ✓ Tele Consultation                      │
│           ✓ Tele Follow-up                         │
│                                                     │
│ ❌ NO Location input                                │
│ ❌ NO GPS tracking options                          │
│ ❌ NO Lead time / Max distance                      │
│                                                     │
│ ✅ Buffer Time: 10 min                             │
│ ✅ Concurrent Bookings: 3                          │
└────────────────────────────────────────────────────┘
```

---

#### **Step 3: Customer Booking Flow**
**Action:** Customer books tele consultation

**Expected Results:**
- ✅ Shows "Instant" and "Scheduled" options
- ✅ No location/address input required
- ✅ Payment page shows instant tele doctor scroller
- ✅ Video call link provided after assignment

**Pass Criteria:**
```
□ Both instant and scheduled tele options available
□ No address/GPS requirements for customer
□ Doctor scroller appears (instant)
□ Scheduled shows available time slots
□ Video link generated upon assignment
```

---

## ✅ Scenario 5: Home + Tele Hybrid

### **Setup**
```json
{
  "vendorId": "vendor_hybrid_001",
  "businessName": "Full Service Vet Clinic",
  "roleId": "role_hybrid_vet",
  "roleConfiguration": {
    "roleName": "Hybrid Veterinarian",
    "vendorTypes": ["veterinary", "grooming"],
    "serviceStyles": ["at_home", "tele"],
    "centreManagementEnabled": false,
    "staffManagementEnabled": true
  },
  "centres": [],
  "staff": []
}
```

### **Test Steps**

#### **Step 1: Service Publishing - Mixed Types**
**Action:** Publish both home and tele services

**Expected Results:**
- ✅ Can publish home service with GPS required
- ✅ Can publish tele service without GPS
- ✅ Each service shows appropriate badges
- ✅ Service catalog shows both types

**Pass Criteria:**
```
□ Home service: GPS Required badge shown
□ Tele service: No GPS badge
□ Both services publish successfully
□ Services correctly categorized in catalog
```

---

#### **Step 2: Staff Scheduling - Conditional Fields**
**Action:** Create availability with both service types

**Expected Results:**
- ✅ When home service selected: Lead time + Max distance required
- ✅ When tele service selected: No lead time/distance fields
- ✅ When BOTH selected: Home service fields required
- ✅ GPS tracking enabled for slots with home services

**Pass Criteria:**
```
□ Conditional fields appear/disappear based on service selection
□ Home service validation enforced (lead time >= 30 min)
□ Tele service allows minimal buffer time
□ Mixed slot uses stricter validation (home rules apply)
```

**Screenshot Panel:**
```
┌────────────────────────────────────────────────────┐
│ Staff Availability - Mixed Services                │
├────────────────────────────────────────────────────┤
│ Services Selected:                                  │
│ ☑ Home Visit Consultation      [🏠 Home]          │
│ ☑ Tele Consultation            [📹 Tele]          │
│                                                     │
│ ⚠️ Home Service Requirements                       │
│ Lead Time (min): [60]    Max Distance (km): [10]  │
│                                                     │
│ Buffer Time: [15] min                              │
│ Concurrent: [1]                                     │
└────────────────────────────────────────────────────┘
```

---

## ✅ Scenario 6: Instant Tele Success Path

### **Setup**
```json
{
  "serviceId": "service_instant_tele_001",
  "serviceName": "Instant Vet Consultation",
  "serviceStyle": "tele",
  "basePrice": 500,
  "candidateDoctors": [
    {
      "id": "dr_001",
      "name": "Dr. Smith",
      "rating": 4.8,
      "isOnline": true,
      "activeBookings": 1,
      "maxConcurrent": 3
    },
    {
      "id": "dr_002",
      "name": "Dr. Jones",
      "rating": 4.9,
      "isOnline": true,
      "activeBookings": 2,
      "maxConcurrent": 2
    }
  ]
}
```

### **Test Flow**

#### **State 1: Payment Page**
**Expected:**
- ✅ Horizontal doctor scroller shows 2 candidates
- ✅ Each card shows: photo, name, specialization, rating, experience, response time
- ✅ "Online Now" badges visible
- ✅ Payment summary shows ₹500
- ✅ "Pay & Get Assigned" button enabled

**Pass Criteria:**
```
□ Scroller displays all candidate doctors
□ Doctor cards show complete information
□ Left/right scroll buttons work
□ Payment button functional
```

---

#### **State 2: Awaiting Assignment (After Payment)**
**Expected:**
- ✅ Progress bar: [✓──●──○] (Payment → Assigning → Session)
- ✅ Loading spinner visible
- ✅ Text: "Assigning Your Doctor..."
- ✅ Expected wait time: "< 2 minutes"
- ✅ Polling starts (every 3 seconds)

**Pass Criteria:**
```
□ Progress bar shows correct state
□ Loading animation displays
□ Wait time message shown
□ Polling detects assignment within 2 minutes
```

---

#### **State 3: Doctor Assigned**
**Expected:**
- ✅ Progress bar: [✓──✓──○]
- ✅ Assigned doctor card with full details
- ✅ "Dr. [Name] has been assigned" message
- ✅ "Start Video Consultation" button enabled
- ✅ Call/Message buttons available

**Pass Criteria:**
```
□ Correct doctor shown (Dr. Smith - less workload)
□ Assignment notification received
□ Video call button works
□ Session ready within promised timeframe
```

**Screenshot Panel:**
```
┌────────────────────────────────────────────────────┐
│ Instant Tele - Success Path                        │
├────────────────────────────────────────────────────┤
│ Step 1: Payment [✓]                                │
│ - Doctor scroller: 2 candidates                    │
│ - Payment: ₹500                                    │
│                                                     │
│ Step 2: Assigning [●]                              │
│ - Polling started                                  │
│ - Wait time: < 2 min                               │
│                                                     │
│ Step 3: Assigned [✓]                               │
│ - Dr. Smith assigned (rating 4.8, workload 1/3)   │
│ - Video call ready                                 │
│ - Assignment time: 45 seconds                      │
└────────────────────────────────────────────────────┘
```

---

## ✅ Scenario 7: Scheduled Tele Path

### **Setup**
```json
{
  "serviceId": "service_scheduled_tele_001",
  "serviceName": "Scheduled Consultation",
  "date": "2024-12-11",
  "availableStaff": [
    {
      "staffId": "dr_sarah",
      "staffName": "Dr. Sarah Johnson",
      "slots": [
        { "slotId": "slot_1100", "startTime": "11:00", "endTime": "11:30", "available": true },
        { "slotId": "slot_1400", "startTime": "14:00", "endTime": "14:30", "available": true }
      ]
    }
  ]
}
```

### **Test Flow**

#### **Step 1: Date Selection**
**Expected:**
- ✅ 7-day week calendar displayed
- ✅ Today highlighted
- ✅ Can navigate to next/previous week
- ✅ Selected date highlighted in orange

**Pass Criteria:**
```
□ Calendar shows correct week
□ Date selection works
□ Week navigation functional
□ Selected date persists
```

---

#### **Step 2: Time Slot Selection**
**Expected:**
- ✅ Staff card shows Dr. Sarah with profile
- ✅ Time slots displayed in grid (2 columns on mobile, 6 on desktop)
- ✅ Available slots: white background, clickable
- ✅ Unavailable slots: gray background, disabled
- ✅ Selected slot: green background with checkmark

**Pass Criteria:**
```
□ Staff information complete
□ All available slots clickable
□ Unavailable slots not clickable
□ Selection visual feedback clear
□ Can change selection
```

---

#### **Step 3: Booking Confirmation**
**Expected:**
- ✅ Sticky summary card at bottom
- ✅ Shows: Doctor name, date, time, service type
- ✅ Total amount displayed
- ✅ "Confirm & Pay" button enabled
- ✅ API creates booking with pre-assigned doctor

**Pass Criteria:**
```
□ Summary card displays all details correctly
□ Payment processing works
□ Booking created with assignedStaffId
□ Confirmation email/SMS sent
□ Video link provided before appointment
```

**Screenshot Panel:**
```
┌────────────────────────────────────────────────────┐
│ Scheduled Tele - Complete Flow                     │
├────────────────────────────────────────────────────┤
│ Step 1: Date → Wednesday, Dec 11 [✓]              │
│                                                     │
│ Step 2: Time Slots [✓]                             │
│ Dr. Sarah Johnson                                  │
│ ┌───────┐ ┌───────┐ ┌───────┐                    │
│ │ 11:00 │ │ 14:00 │ │ 16:00 │                    │
│ │ 11:30 │ │ 14:30 │ │ 16:30 │                    │
│ └───────┘ └───────┘ └───────┘                    │
│    ✓                                               │
│                                                     │
│ Step 3: Confirmation [●]                           │
│ Selected: Dr. Sarah, Wed Dec 11, 11:00-11:30     │
│ Amount: ₹500                                       │
│ [Confirm & Pay]                                    │
└────────────────────────────────────────────────────┘
```

---

## ✅ Scenario 8: Custom Package Blocked Path

### **Setup**
```json
{
  "vendorId": "vendor_package_blocked_001",
  "businessName": "Mobile Grooming",
  "roleConfiguration": {
    "centreManagementEnabled": false
  },
  "centres": [],
  "publishLevel": "vendor"
}
```

### **Test Flow**

#### **Step 1: Service Publish - Vendor Level**
**Action:** Attempt to create custom package

**Expected Results:**
- ✅ "Create Custom Package" button is DISABLED
- ✅ Tooltip shows: "Custom packages require centre context"
- ✅ Button has visual disabled state (gray, cursor not-allowed)
- ✅ No click handler executes

**Pass Criteria:**
```
□ Button clearly disabled
□ Helpful tooltip appears on hover
□ No navigation on click
□ User understands why blocked
```

---

#### **Step 2: Service Publish - Centre Level Selected**
**Action:** Switch to centre level (if centres exist)

**Expected Results:**
- ✅ "Create Custom Package" button becomes ENABLED
- ✅ Click opens package creation flow
- ✅ Can bundle multiple services
- ✅ Package saved to specific centre

**Pass Criteria:**
```
□ Button enables when centre selected
□ Package creation accessible
□ Bundle services works
□ Package associates with centre correctly
```

**Screenshot Panel:**
```
┌────────────────────────────────────────────────────┐
│ Custom Package - Blocked vs Allowed                │
├────────────────────────────────────────────────────┤
│ BLOCKED (Vendor Level):                            │
│ ┌──────────────────────────────────────┐          │
│ │ Publish At: ● Vendor Level           │          │
│ │                                       │          │
│ │ [Create Custom Package] 🚫            │          │
│ │  ↑ Disabled, tooltip: "Requires      │          │
│ │     centre context"                  │          │
│ └──────────────────────────────────────┘          │
│                                                     │
│ ALLOWED (Centre Level):                            │
│ ┌──────────────────────────────────────┐          │
│ │ Publish At: ● Centre Level           │          │
│ │ Centres: ☑ Downtown Clinic            │          │
│ │                                       │          │
│ │ [Create Custom Package] ✅            │          │
│ │  ↑ Enabled, clickable                │          │
│ └──────────────────────────────────────┘          │
└────────────────────────────────────────────────────┘
```

---

## 📊 Master Test Results Template

```
┌─────────────────────────────────────────────────────────────┐
│ TEST EXECUTION SUMMARY                                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ Scenario 1: Vendor with No Centres                  [PASS]  │
│ ├─ Service Publishing                               [PASS]  │
│ ├─ Staff Scheduling                                 [PASS]  │
│ └─ Dashboard View                                   [PASS]  │
│                                                               │
│ Scenario 2: Vendor with Centres                     [PASS]  │
│ ├─ Service Publishing                               [PASS]  │
│ ├─ Staff Scheduling - Centre Mode                   [PASS]  │
│ └─ Custom Package Creation                          [PASS]  │
│                                                               │
│ Scenario 3: Staff Management OFF                    [PASS]  │
│ ├─ Dashboard Access                                 [PASS]  │
│ └─ Service Execution                                [PASS]  │
│                                                               │
│ Scenario 4: Tele-Only Role                          [PASS]  │
│ ├─ Service Catalog Filtering                        [PASS]  │
│ ├─ Staff Scheduling                                 [PASS]  │
│ └─ Customer Booking Flow                            [PASS]  │
│                                                               │
│ Scenario 5: Home + Tele Hybrid                      [PASS]  │
│ ├─ Service Publishing - Mixed                       [PASS]  │
│ └─ Staff Scheduling - Conditional                   [PASS]  │
│                                                               │
│ Scenario 6: Instant Tele Success                    [PASS]  │
│ ├─ Payment Page                                     [PASS]  │
│ ├─ Awaiting Assignment                              [PASS]  │
│ └─ Doctor Assigned                                  [PASS]  │
│                                                               │
│ Scenario 7: Scheduled Tele Path                     [PASS]  │
│ ├─ Date Selection                                   [PASS]  │
│ ├─ Time Slot Selection                              [PASS]  │
│ └─ Booking Confirmation                             [PASS]  │
│                                                               │
│ Scenario 8: Custom Package Blocked                  [PASS]  │
│ ├─ Vendor Level Block                               [PASS]  │
│ └─ Centre Level Enable                              [PASS]  │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│ OVERALL: 8/8 SCENARIOS PASSED                       [PASS]  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Quick Validation Checklist

Use this for rapid smoke testing:

```
Capability-Driven Rendering:
□ Vendor with no centres: centres UI hidden
□ Vendor with centres: centres UI visible
□ Staff management OFF: staff UI hidden
□ Tele-only role: only tele services shown

Service Publishing:
□ GPS automatic for home services
□ Centre vs vendor level works
□ Custom packages blocked at vendor level
□ Custom packages enabled at centre level

Staff Scheduling:
□ Location mode for no centres
□ Centre mode for centres available
□ Conditional fields for home services
□ No location fields for tele-only

Customer Booking:
□ Instant tele: doctor scroller + assignment
□ Scheduled tele: calendar + time slots
□ Home service: GPS tracking required
□ Auto-assignment vs manual fallback

OTP & GPS:
□ OTP generated at booking
□ OTP verified at session start/end
□ GPS tracking active during session
□ Session log uploaded to S3
```

