# 📊 VENDOR PLATFORM FLOWCHARTS & DIAGRAMS
## WarmPawz - Visual Reference Guide

**Document Version:** 1.0  
**Last Updated:** December 11, 2024  
**For:** All Teams (Engineering, QA, Functional)

---

## 🗺️ **TABLE OF CONTENTS**

1. [Complete Vendor Journey](#complete-vendor-journey)
2. [Login Flow Diagrams](#login-flow-diagrams)
3. [Onboarding Flows by Role](#onboarding-flows-by-role)
4. [Admin Decision Tree](#admin-decision-tree)
5. [Dashboard Loading Sequence](#dashboard-loading-sequence)
6. [Booking Lifecycle](#booking-lifecycle)
7. [Payment Flow](#payment-flow)
8. [Integration Diagrams](#integration-diagrams)

---

## 🚀 **1. COMPLETE VENDOR JOURNEY**

```
┌─────────────────────────────────────────────────────────────────┐
│                    VENDOR LIFECYCLE                             │
│                                                                 │
│  START                                                          │
│    │                                                            │
│    ▼                                                            │
│  ┌────────────────┐                                            │
│  │ Discover App   │                                            │
│  │ (Marketing)    │                                            │
│  └────────────────┘                                            │
│         │                                                       │
│         ▼                                                       │
│  ┌────────────────┐                                            │
│  │  Enter Phone   │                                            │
│  │  Number        │                                            │
│  └────────────────┘                                            │
│         │                                                       │
│         ▼                                                       │
│  ┌────────────────┐                                            │
│  │ Receive & Verify│                                           │
│  │  OTP           │                                            │
│  └────────────────┘                                            │
│         │                                                       │
│         ▼                                                       │
│  ┌────────────────┐         ┌──────────────────┐              │
│  │ Check Vendor   │────────▶│ Existing Vendor? │              │
│  │ Exists?        │         └──────────────────┘              │
│  └────────────────┘                │       │                  │
│                              YES    │       │    NO            │
│                                     │       │                  │
│         ┌───────────────────────────┘       └─────────┐        │
│         ▼                                             ▼        │
│  ┌─────────────┐                              ┌──────────────┐│
│  │ Check Status│                              │ Role         ││
│  └─────────────┘                              │ Selection    ││
│         │                                     └──────────────┘│
│  ┌──────┴───────────────────┐                        │        │
│  │                          │                        ▼        │
│  ▼                          ▼                 ┌──────────────┐│
│approved               pending_approval        │  Onboarding  ││
│  │                          │                 │  Form        ││
│  ▼                          ▼                 └──────────────┘│
│Dashboard              Under Review                    │        │
│                             │                         ▼        │
│                             │                  ┌──────────────┐│
│                             │                  │   Submit     ││
│                             │                  │ Application  ││
│                             │                  └──────────────┘│
│                             │                         │        │
│                             └─────────────────────────┘        │
│                                     │                          │
│                                     ▼                          │
│                              ┌─────────────┐                   │
│                              │Admin Review │                   │
│                              └─────────────┘                   │
│                                     │                          │
│                    ┌────────────────┼────────────────┐         │
│                    │                │                │         │
│                    ▼                ▼                ▼         │
│              ┌─────────┐    ┌──────────┐     ┌──────────┐    │
│              │Approve  │    │ Request  │     │ Reject   │    │
│              │         │    │ Info     │     │          │    │
│              └─────────┘    └──────────┘     └──────────┘    │
│                    │                │                │         │
│                    ▼                ▼                ▼         │
│              ┌─────────┐    ┌──────────┐     ┌──────────┐    │
│              │Dashboard│    │Vendor    │     │Rejected  │    │
│              │Access   │    │Updates   │     │Screen    │    │
│              └─────────┘    └──────────┘     └──────────┘    │
│                    │                │                │         │
│                    │                ▼                │         │
│                    │         ┌──────────┐           │         │
│                    │         │Resubmit  │           │         │
│                    │         └──────────┘           │         │
│                    │                │                │         │
│                    │                ▼                │         │
│                    │         (Back to Review)       │         │
│                    │                                 │         │
│                    │                          ┌──────▼───────┐ │
│                    │                          │  Re-apply    │ │
│                    │                          │  Option      │ │
│                    │                          └──────────────┘ │
│                    │                                           │
│                    ▼                                           │
│            ┌──────────────┐                                   │
│            │   ACTIVE     │                                   │
│            │   VENDOR     │                                   │
│            └──────────────┘                                   │
│                    │                                           │
│                    ▼                                           │
│         ┌──────────────────┐                                  │
│         │  Serve Customers  │                                 │
│         │  Earn Revenue     │                                 │
│         │  Build Reputation │                                 │
│         └──────────────────┘                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔐 **2. LOGIN FLOW DIAGRAMS**

### **A. New Vendor Login**
```
┌──────────────┐
│ Enter Phone  │
│ +9198765... │
└──────────────┘
       │
       ▼
┌──────────────┐
│ POST /auth/  │
│ vendor/send- │
│ otp          │
└──────────────┘
       │
       ▼
┌──────────────┐
│ SMS Sent     │
│ OTP: 123456  │
└──────────────┘
       │
       ▼
┌──────────────┐
│ User Enters  │
│ OTP Code     │
└──────────────┘
       │
       ▼
┌──────────────┐
│ POST /auth/  │
│ vendor/verify│
│ -otp         │
└──────────────┘
       │
       ▼
┌──────────────┐
│ GET /vendor/ │
│ check/{phone}│
└──────────────┘
       │
       ▼
┌──────────────┐
│ Not Found    │
│ (New Vendor) │
└──────────────┘
       │
       ▼
┌──────────────┐
│ Show Role    │
│ Selection    │
│ Screen       │
└──────────────┘
```

### **B. Existing Approved Vendor Login**
```
┌──────────────┐
│ OTP Flow     │
│ (Same as     │
│ above)       │
└──────────────┘
       │
       ▼
┌──────────────┐
│ GET /vendor/ │
│ check/{phone}│
└──────────────┘
       │
       ▼
┌──────────────┐
│ Found        │
│ status:      │
│ "approved"   │
└──────────────┘
       │
       ▼
┌──────────────┐
│ Load roleId  │
└──────────────┘
       │
       ▼
┌──────────────┐
│ GET /config/ │
│ roles        │
└──────────────┘
       │
       ▼
┌──────────────┐
│ Load         │
│ Capabilities │
└──────────────┘
       │
       ▼
┌──────────────┐
│ Render       │
│ Dashboard    │
└──────────────┘
```

### **C. Pending Vendor Login**
```
┌──────────────┐
│ OTP Flow     │
└──────────────┘
       │
       ▼
┌──────────────┐
│ Status:      │
│ "pending_    │
│ approval"    │
└──────────────┘
       │
       ▼
┌──────────────┐
│ Show "Under  │
│ Review"      │
│ Screen       │
└──────────────┘
       │
       ▼
┌──────────────┐
│ Options:     │
│ • View App   │
│ • Edit App   │
│ • Logout     │
└──────────────┘
```

### **D. Info Requested Login**
```
┌──────────────┐
│ OTP Flow     │
└──────────────┘
       │
       ▼
┌──────────────┐
│ Status:      │
│ "info_       │
│ requested"   │
└──────────────┘
       │
       ▼
┌──────────────┐
│ Show Admin   │
│ Message      │
└──────────────┘
       │
       ▼
┌──────────────┐
│ Display:     │
│ • Message    │
│ • Required   │
│   Fields     │
│ • Update     │
│   Button     │
└──────────────┘
       │
       ▼
┌──────────────┐
│ Vendor       │
│ Updates &    │
│ Resubmits    │
└──────────────┘
       │
       ▼
┌──────────────┐
│ Status →     │
│ "pending_    │
│ approval"    │
└──────────────┘
```

---

## 📝 **3. ONBOARDING FLOWS BY ROLE**

### **A. Pet Clinic Onboarding**
```
Role Selected: pet_clinic
        │
        ▼
┌──────────────────────┐
│  Basic Information   │
├──────────────────────┤
│ • Full Name          │
│ • Email              │
│ • Business Name      │
│ • Phone (auto)       │
└──────────────────────┘
        │
        ▼
┌──────────────────────┐
│  Location Details    │
├──────────────────────┤
│ • Address            │
│ • City               │
│ • State              │
│ • Pincode            │
│ • Map Location       │
└──────────────────────┘
        │
        ▼
┌──────────────────────┐
│ Professional Info    │
├──────────────────────┤
│ • License Number     │
│ • License Authority  │
│ • Years of Exp       │
│ • Education (BVSc)   │
│ • Specialization     │
└──────────────────────┘
        │
        ▼
┌──────────────────────┐
│  Service Styles      │
├──────────────────────┤
│ ☑ At Center         │
│ ☑ At Home           │
│ ☑ Tele              │
└──────────────────────┘
        │
        ▼
┌──────────────────────┐
│  Document Upload     │
├──────────────────────┤
│ ☑ Vet License       │
│ ☑ Education Cert    │
│ ☑ Clinic Reg (if    │
│   at_center)         │
│ ☐ Insurance (opt)   │
└──────────────────────┘
        │
        ▼
┌──────────────────────┐
│  Review & Submit     │
└──────────────────────┘
        │
        ▼
┌──────────────────────┐
│ POST /vendor/onboard │
└──────────────────────┘
        │
        ▼
┌──────────────────────┐
│ Application Created  │
│ Status: pending_     │
│ approval             │
└──────────────────────┘
```

### **B. Dog Walker Onboarding (Simplified)**
```
Role Selected: dog_walker
        │
        ▼
Basic Info → Location → Professional
        │              (Experience,
        │               Area Coverage,
        │               First Aid)
        ▼
Service Styles (At Home ONLY)
        │
        ▼
Documents (ID, Police Verification)
        │
        ▼
Submit
```

### **C. Pet Store Onboarding (Commerce)**
```
Role Selected: pet_store
        │
        ▼
Basic Info → Location → Store Details
        │              (Store Type,
        │               Product Categories,
        │               Delivery Option)
        ▼
Documents (Business Reg, GST Cert)
        │
        ▼
Submit
```

---

## 👨‍💼 **4. ADMIN DECISION TREE**

```
Admin Views Application
        │
        ▼
Review All Information
        │
  ┌─────┴────────────────────────┐
  │                              │
  ▼                              ▼
All Documents         Something Wrong/
Complete & Valid      Missing
  │                              │
  ▼                              │
Approve                    ┌─────┴─────┐
  │                        │           │
  ▼                        ▼           ▼
┌────────────┐      ┌──────────┐  ┌─────────┐
│ POST /admin│      │ Request  │  │ Reject  │
│ /vendor/   │      │ More Info│  │         │
│ approve    │      └──────────┘  └─────────┘
└────────────┘            │              │
  │                       ▼              ▼
  ▼                 Open Modal      Open Modal
Vendor Status       ┌──────────┐   ┌──────────┐
→ "approved"        │ Enter    │   │ Enter    │
                    │ Message  │   │ Reason   │
Notification        └──────────┘   └──────────┘
Sent                      │              │
                          ▼              ▼
Vendor Can          POST /admin    POST /admin
Access              /vendor/       /vendor/
Dashboard           request-info   reject
                          │              │
                          ▼              ▼
                    Vendor Status   Vendor Status
                    → "info_        → "rejected"
                    requested"
                          │              │
                          ▼              ▼
                    Vendor Gets    Vendor Sees
                    Notification   Rejection
                          │         Reason
                          ▼              │
                    Vendor            Can
                    Updates          Re-apply
                    & Resubmits
                          │
                          ▼
                    Back to
                    "pending_
                    approval"
```

---

## 🎯 **5. DASHBOARD LOADING SEQUENCE**

### **Parallel API Call Architecture**
```
User Logs In
     │
     ▼
GET /vendor/check/{phone}
     │
     ▼
Load vendor data (roleId, status, etc.)
     │
     ▼
GET /config/roles
     │
     ▼
Find role config for vendor's roleId
     │
     ▼
Extract capabilities from role
     │
     ▼
Render Dashboard with Loading State
     │
     ▼
┌────────────────────────────────────────────┐
│      PARALLEL API CALLS (Promise.all)      │
├────────────────────────────────────────────┤
│                                            │
│  ┌──────────────┐  ┌──────────────┐      │
│  │ GET /vendor/ │  │ GET /vendor/ │      │
│  │ dashboard/   │  │ schedule/    │      │
│  │ {id}         │  │ {id}         │      │
│  │              │  │ (if booking  │      │
│  │ Always runs  │  │ enabled)     │      │
│  └──────────────┘  └──────────────┘      │
│         │                  │               │
│  ┌──────────────┐  ┌──────────────┐      │
│  │ GET /vendor/ │  │ GET /vendor/ │      │
│  │ watchlist/   │  │ services/    │      │
│  │ {id}         │  │ {id}         │      │
│  │ (if medical  │  │ (if catalog  │      │
│  │ records)     │  │ enabled)     │      │
│  └──────────────┘  └──────────────┘      │
│         │                  │               │
│  ┌──────────────┐                         │
│  │ GET /vendor/ │                         │
│  │ notifications│                         │
│  │ /{id}        │                         │
│  │              │                         │
│  │ Always runs  │                         │
│  └──────────────┘                         │
│                                            │
│  ALL 5 EXECUTE SIMULTANEOUSLY              │
│  (Not one after another)                   │
└────────────────────────────────────────────┘
     │
     ▼
All responses received (~1 second)
     │
     ▼
Process each response:
  - Dashboard stats → Update state
  - Schedule → Update state
  - Watchlist → Update state
  - Notifications → Update state
  - Services → Update state
     │
     ▼
Render Complete Dashboard
     │
     ▼
Show Role-Specific Sections:
  - Vet: Pharmacy, Diagnostics, Medical Records
  - Groomer: Portfolio, Photo Upload
  - Trainer: Progress Tracking, Programs
  - Walker: GPS Tracking, Walk History
  - Boarding: Guest List, CCTV, Rooms
  - Store: Products, Orders, Inventory
```

### **Performance Comparison**
```
BEFORE (Serial Calls):
──────────────────────────────
Dashboard    [■■■■■■■■■■]  1s
  ↓
Schedule     [■■■■■■■■■■]  1s
  ↓
Watchlist    [■■■■■■]      0.5s
  ↓
Notifications[■■■■■■]      0.5s
  ↓
Services     [■■■■■■]      0.5s
──────────────────────────────
Total: 3.5 seconds

AFTER (Parallel Calls):
──────────────────────────────
Dashboard    [■■■■■■■■■■]
Schedule     [■■■■■■■■■■]
Watchlist    [■■■■■■]
Notifications[■■■■■■]
Services     [■■■■■■]
All execute  simultaneously
──────────────────────────────
Total: 1 second (3x faster!)
```

---

## 📅 **6. BOOKING LIFECYCLE**

```
┌─────────────────────────────────────────────────────────────┐
│                   BOOKING LIFECYCLE                         │
└─────────────────────────────────────────────────────────────┘

Customer Side                    Vendor Side
─────────────                    ───────────

Search for service
     │
     ▼
Browse vendors
     │
     ▼
Select vendor                     
     │                                   │
     ▼                                   │
Choose service                           │
     │                                   │
     ▼                                   │
Select date/time                         │
     │                                   │
     ▼                                   │
Enter pet details                        │
     │                                   │
     ▼                                   │
Review booking                           │
     │                                   │
     ▼                                   │
Make payment                             │
(Razorpay)                               │
     │                                   │
     ▼                                   ▼
Booking Created ──────────────────▶ Notification Received
     │                                   │
     ▼                                   ▼
Payment on hold                    View booking details
                                        │
                                   ┌────┴────┐
                                   ▼         ▼
                              Accept      Reject
                                │           │
                                │           ▼
                                │      Refund issued
                                │           │
                                │           ▼
                                │      Booking cancelled
                                │
                                ▼
                          Booking confirmed
                                │
                                ▼
                          Appointment day
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
          At Center         At Home             Tele
          (Clinic)          (Walker)        (Video Call)
              │                 │                 │
              └─────────────────┴─────────────────┘
                                │
                                ▼
                      Vendor provides service
                                │
                                ▼
                      Complete booking
                                │
                                ▼
                      Payment released
                      (Split: Platform 15%
                       Vendor 85%)
                                │
                                ▼
                      Vendor earnings updated
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
              Customer side          Vendor requests
              Leaves review          review
                    │                       │
                    └───────────────────────┘
                                │
                                ▼
                        Booking lifecycle
                        complete
```

---

## 💰 **7. PAYMENT FLOW**

### **Razorpay Marketplace Split Payment**
```
┌─────────────────────────────────────────────────────────────┐
│              PAYMENT FLOW (Razorpay Marketplace)            │
└─────────────────────────────────────────────────────────────┘

Customer pays ₹1000
      │
      ▼
┌──────────────────┐
│   Razorpay       │
│   Payment        │
│   Gateway        │
└──────────────────┘
      │
      ▼
Payment Successful
      │
      ▼
┌──────────────────┐
│  WarmPawz        │
│  Platform        │
│  Account         │
└──────────────────┘
      │
      ▼
Calculate Split:
  Platform Fee: 15% = ₹150
  Vendor Amount: 85% = ₹850
      │
      ▼
┌──────────────────┐
│  Route Transfer  │
│  API             │
└──────────────────┘
      │
  ┌───┴───┐
  ▼       ▼
┌─────┐ ┌─────┐
│ ₹150│ │ ₹850│
│ to  │ │ to  │
│Platf│ │Vendor│
│orm  │ │Acc  │
└─────┘ └─────┘
  │       │
  │       ▼
  │  Vendor sees ₹850
  │  in dashboard
  │  "Pending Earnings"
  │       │
  │       ▼
  │  Service completed
  │       │
  │       ▼
  │  Payment status:
  │  "Settled"
  │       │
  │       ▼
  │  Can withdraw
  │  to bank
  │
  ▼
Platform revenue
tracking
```

### **Refund Flow (if booking rejected)**
```
Booking rejected
      │
      ▼
┌──────────────────┐
│  Razorpay        │
│  Refund API      │
└──────────────────┘
      │
      ▼
Full amount returned
to customer
      │
      ▼
₹1000 back to
customer account
      │
      ▼
Notification sent
```

---

## 🔗 **8. INTEGRATION DIAGRAMS**

### **A. Shiprocket Integration (Pet Stores)**
```
Store receives order
      │
      ▼
┌──────────────────┐
│ Create Shipment  │
│ Button clicked   │
└──────────────────┘
      │
      ▼
POST /shiprocket/auth/login
(Get auth token)
      │
      ▼
POST /shiprocket/orders/create
{
  order_id,
  customer_details,
  products,
  weight,
  dimensions
}
      │
      ▼
┌──────────────────┐
│  Shiprocket      │
│  suggests        │
│  couriers        │
└──────────────────┘
      │
      ▼
Store selects courier
      │
      ▼
POST /shiprocket/courier/assign
      │
      ▼
Label PDF generated
      │
      ▼
Store prints label
      │
      ▼
Courier picks up package
      │
      ▼
Tracking updates:
  - Picked up
  - In transit
  - Out for delivery
  - Delivered
      │
      ▼
Customer receives order
      │
      ▼
COD remittance (if applicable)
```

### **B. Jitsi Meet Integration (Tele-consultations)**
```
Customer books tele-consultation
      │
      ▼
Booking created with unique ID
bookingId: "BOOK123456"
      │
      ▼
Generate meeting link:
https://meet.jit.si/warmpawz-BOOK123456
      │
  ┌───┴───┐
  ▼       ▼
Vendor  Customer
receives receives
link    link
  │       │
  │       │
  └───┬───┘
      │
      ▼
Both click "Join Video"
      │
      ▼
┌──────────────────┐
│  Jitsi Meet      │
│  Room            │
│  warmpawz-       │
│  BOOK123456      │
└──────────────────┘
      │
      ▼
Video consultation starts
      │
Features available:
  - Audio/Video
  - Screen sharing
  - Chat
  - Recording (optional)
      │
      ▼
Consultation complete
      │
      ▼
Vendor marks booking complete
```

### **C. Google Maps Integration**
```
Vendor onboarding
      │
      ▼
Address input field
      │
      ▼
User starts typing
      │
      ▼
┌──────────────────┐
│ Google Places    │
│ Autocomplete API │
└──────────────────┘
      │
      ▼
Suggestions appear
      │
      ▼
User selects address
      │
      ▼
┌──────────────────┐
│ Google Geocoding │
│ API              │
└──────────────────┘
      │
      ▼
Get coordinates:
  lat: 12.9716
  lng: 77.5946
      │
      ▼
Display on map
      │
      ▼
Save location data:
{
  address: "123 Main St, Bangalore",
  lat: 12.9716,
  lng: 77.5946,
  city: "Bangalore",
  state: "Karnataka",
  pincode: "560001"
}
```

### **D. GPS Tracking (Dog Walker)**
```
Walker clicks "Start Walk"
      │
      ▼
Request location permission
      │
      ▼
Permission granted
      │
      ▼
┌──────────────────┐
│ Browser          │
│ Geolocation API  │
└──────────────────┘
      │
      ▼
Get current position
every 10 seconds
      │
      ▼
Send to backend:
POST /vendor/walk/update-location
{
  walkId,
  lat,
  lng,
  timestamp
}
      │
      ▼
Store route points
      │
      ▼
Customer views live map
      │
      ▼
Walker clicks "End Walk"
      │
      ▼
Calculate:
  - Total distance
  - Route map
  - Duration
      │
      ▼
Generate walk report
```

---

## 🎯 **9. STATE MACHINE DIAGRAM**

### **Vendor Application States**
```
                   ┌─────────────┐
              ┌───▶│  pending_   │◀───┐
              │    │  approval   │    │
              │    └─────────────┘    │
              │           │            │
              │      ┌────┼────┐      │
              │      │    │    │      │
              │      ▼    ▼    ▼      │
              │    ┌───┐ ┌──┐ ┌───┐  │
              │    │App│ │Req│ │Rej│  │
              │    │rove│ │Info│ │ect│  │
              │    └───┘ └──┘ └───┘  │
              │      │    │    │      │
              │      ▼    ▼    ▼      │
         ┌────┴────┐ ┌───────┐ ┌────┴────┐
         │approved │ │ info_ │ │rejected │
         │         │ │request│ │         │
         │         │ │  ed   │ │         │
         └─────────┘ └───────┘ └─────────┘
              │         │            │
              ▼         │            ▼
         Dashboard      │        Re-apply
                        │            │
                        └────────────┘
                        (Update &
                         Resubmit)
```

---

## 📊 **10. CAPABILITY LOADING FLOW**

```
Dashboard Loads
      │
      ▼
Vendor has roleId: "pet_clinic"
      │
      ▼
GET /config/roles
      │
      ▼
Find role where id = "pet_clinic"
      │
      ▼
Role config found:
{
  id: "pet_clinic",
  name: "Pet Clinic",
  capabilities: [
    "booking",
    "chat",
    "tele",
    "prescription",
    "medical_records",
    "emergency",
    "catalog"
  ],
  staffManagement: {
    enabled: true
  }
}
      │
      ▼
Map to boolean object:
{
  booking: true,
  chat: true,
  tele: true,
  prescription: true,
  medical_records: true,
  emergency: true,
  catalog: true,
  orders: false,
  inventory: false,
  delivery: false,
  photo_updates: false,
  gallery: false,
  portfolio: false,
  progress_tracking: false,
  cctv_access: false,
  gps_tracking: false,
  staff_management: true
}
      │
      ▼
Render UI based on capabilities:
  - if (booking) → Show "Today's Schedule"
  - if (prescription) → Show "Write Prescription"
  - if (medical_records) → Show "Medical Records"
  - if (staff_management) → Show "Manage Staff"
  - etc.
```

---

## ✅ **QUICK REFERENCE**

### **Status Codes**
| Status | Description | Vendor Can |
|--------|-------------|-----------|
| `pending_approval` | Under admin review | View, Edit application |
| `info_requested` | Admin needs more info | Update & Resubmit |
| `approved` | Active vendor | Access dashboard |
| `rejected` | Application rejected | See reason, Re-apply |

### **Common Endpoints**
```
Auth:          /auth/vendor/send-otp
               /auth/vendor/verify-otp

Vendor Check:  /vendor/check/{phone}

Onboarding:    /vendor/onboard

Admin:         /admin/vendor/approve
               /admin/vendor/reject
               /admin/vendor/request-info

Dashboard:     /vendor/dashboard/{id}
               /vendor/schedule/{id}
               /vendor/notifications/{id}

Config:        /config/roles
```

### **Response Times**
```
Target:     < 500ms per API call
Acceptable: < 1 second
Poor:       > 1 second
```

---

**END OF FLOWCHARTS DOCUMENT**

*Use these diagrams to understand complete system flows. For detailed implementation, refer to MASTER_VENDOR_PLATFORM_DOCUMENTATION.md*
