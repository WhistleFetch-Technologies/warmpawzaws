# WARMPAWZ COMPLETE SYSTEM ANALYSIS & RECOMMENDED FLOW

## 1. SYSTEM ARCHITECTURE OVERVIEW

### 20 Vendor Roles with Unique Capabilities

| Role | Category | Service Styles | Key Capabilities |
|------|----------|----------------|------------------|
| Veterinarian | Healthcare | at_center, at_home, tele | medical_records, prescription_create, diagnostics |
| Vet Clinic | Healthcare | at_center | + staff_create, inventory_manage |
| Pet Groomer | Service Provider | at_center, at_home | booking_create, staff_schedule |
| Pet Trainer | Service Provider | at_center, at_home | booking_create, staff_create |
| Pet Walker | Service Provider | at_home only | gps_tracking, booking_create |
| Pet Sitter | Service Provider | at_home only | booking_create |
| Ambulance | Healthcare | at_home only | gps_tracking |
| Pet Daycare | Hospitality | at_center only | staff_schedule |
| Pet Boarder | Hospitality | at_center only | inventory_manage |

### 3 Service Delivery Styles

| Style | Description | Completion Method | Special Features |
|-------|-------------|-------------------|------------------|
| at_center | Customer visits vendor | OTP verification at location | Staff assignment, slot-based scheduling |
| at_home | Vendor visits customer | GPS tracking + OTP on arrival | Address selection, live tracking |
| tele | Video/Phone consultation | No OTP (ends automatically) | Instant availability, prescription share |

### ⚠️ CRITICAL BUSINESS RULE: Home & Tele Service Eligibility

**Home (`at_home`) and Tele (`tele`) services can ONLY be performed by:**

1. **Staff Members** - Individual staff profiles created by businesses (clinics, grooming centers)
2. **Home Groomers** - Individual groomers who do NOT have a clinic/salon setup
3. **Individual Veterinarians** - Veterinarians who do NOT have a clinic setup

**For businesses with clinic/salon setup (Vet Clinic, Grooming Center):**
- ❌ **CANNOT** directly offer `at_home` or `tele` services at the business level
- ✅ **MUST** create individual **Staff Profiles** who can handle these services
- Each staff member must be assigned to specific `at_home` or `tele` services
- Staff members appear as individual service providers in customer searches

**⚠️ Staff Login & Verification Requirements:**
- ✅ **Each staff member has their own independent login account**
- ✅ **Staff mobile number is MANDATORY** for login credentials
- ✅ **Mobile number MUST be verified** via OTP before staff can go live on platform
- ✅ Staff cannot accept bookings or appear in customer searches until mobile is verified
- ✅ Staff login is separate from business owner login (different authentication)

**Business Logic:**
- **Individual Providers** (Veterinarian without clinic, Home Groomer): Can offer `at_home`/`tele` directly
- **Business Entities** (Vet Clinic, Grooming Center): Must use staff profiles for `at_home`/`tele`
- **At-Center Services**: Can be offered by both business entities and staff members

---

## 2. RECOMMENDED CUSTOMER JOURNEY FLOW

### PHASE 1: SERVICE DISCOVERY (Customer App Entry Point)

```
Customer Home Dashboard
    ├── Problem Grid Navigation ("My pet has fever", "Needs grooming", etc.)
    ├── Service Category Buttons (Vet, Grooming, Training, Walking, etc.)
    └── Quick Actions (Emergency, Nearby, History)
```

**For Each Service Category, the Dashboard Should Show:**

```typescript
// VetServiceRouter.tsx (Example Pattern)
const serviceTypes = [
  { id: 'tele', name: 'Tele Consultation', badge: '24/7 Available' },
  { id: 'clinic', name: 'Clinic Visit', badge: 'Book Slot' },
  { id: 'home', name: 'Home Visit', badge: 'Track Live' },
];
```

### PHASE 2: VENDOR/SERVICE SELECTION

```
Service Style Selection → Vendor Discovery → Vendor Profile → Service Selection
```

**Flow Variations by Vendor Type:**

| Vendor Type | Discovery Flow |
|-------------|----------------|
| Vets | Style → Nearby Clinics/Doctors → Profile with Specializations → Services by Style |
| Groomers | Style → Salon List OR At-Home Groomers → Package Selection |
| Trainers | Style → Training Center OR At-Home Trainer → Training Program Selection |
| Walkers | Direct to Nearby Available Walkers → Package (30min/60min) Selection |

**⚠️ Important for Home/Tele Services:**
- When customer selects `at_home` or `tele`:
  - Show **individual staff members** (if from clinic/center)
  - Show **individual providers** (if no clinic setup)
  - Hide business entities that don't have staff assigned to these services

---

## 3. IDEAL BOOKING FLOW BY SERVICE STYLE

### A. AT-CENTER (Clinic/Salon Visit)

```
┌─────────────────────────────────────────────────────────────────┐
│ CUSTOMER APP                                                    │
├─────────────────────────────────────────────────────────────────┤
│ 1. Select "Clinic Visit" / "Visit Salon"                       │
│ 2. View Nearby Vendors (Map + List View)                       │
│ 3. Select Vendor → View Profile (Services, Staff, Reviews)     │
│ 4. Select Service (from catalog filtered by role)              │
│ 5. Select Staff (optional, if clinic has multiple doctors)     │
│ 6. Select Pet                                                   │
│ 7. Pick Date & Time Slot (from vendor availability)            │
│ 8. Review & Pay                                                │
│ 9. Receive Booking Confirmation + 4-digit OTP                  │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ VENDOR DASHBOARD                                                │
├─────────────────────────────────────────────────────────────────┤
│ 1. New Booking Notification                                     │
│ 2. Accept/Reject Booking                                        │
│ 3. Customer Arrives → Ask for OTP                               │
│ 4. Enter OTP → Start Service                                    │
│ 5. Complete Service → Enter OTP to Complete                    │
│ 6. (Vet) Add Prescription/Medical Records                       │
│ 7. Revenue Realized → Settlement Queue                          │
└─────────────────────────────────────────────────────────────────┘
```

### B. AT-HOME (Home Visit/Walking)

**⚠️ Service Provider Selection:**
- If booking from a **clinic/center**: Customer must select a **specific staff member**
- If booking from an **individual provider**: Provider is automatically assigned
- Only staff members or individual providers appear in search results

```
┌─────────────────────────────────────────────────────────────────┐
│ CUSTOMER APP                                                    │
├─────────────────────────────────────────────────────────────────┤
│ 1. Select "Home Visit" / "At-Home Grooming" / "Dog Walking"    │
│ 2. View Available Service Providers in Area                    │
│    └── Shows: Individual Staff OR Individual Providers          │
│ 3. Select Provider → View Profile                              │
│ 4. Select Service                                               │
│ 5. Select Pet                                                   │
│ 6. Select/Add Address (with map pin)                           │
│ 7. Pick Date & Time                                             │
│ 8. Review & Pay                                                 │
│ 9. Receive Confirmation + OTP                                   │
│ 10. Track Provider on Map (Live GPS when in progress)          │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ VENDOR/STAFF DASHBOARD                                          │
├─────────────────────────────────────────────────────────────────┤
│ 1. Accept Booking (Staff member or Individual provider)         │
│ 2. View Customer Address on Map                                 │
│ 3. Navigate to Location                                         │
│ 4. Arrive → Enter Customer OTP → Start Session                 │
│    → GPS Tracking Enabled for Customer                          │
│ 5. Complete Service → Enter OTP → End Session                   │
│    → GPS Tracking Disabled                                      │
│ 6. Revenue Realized                                             │
└─────────────────────────────────────────────────────────────────┘
```

### C. TELE (Video/Phone Consultation)

**⚠️ Service Provider Selection:**
- If booking from a **clinic**: Customer must select a **specific doctor/staff member**
- If booking from an **individual vet**: Provider is automatically assigned
- Only staff members or individual vets appear in search results

```
┌─────────────────────────────────────────────────────────────────┐
│ CUSTOMER APP                                                    │
├─────────────────────────────────────────────────────────────────┤
│ 1. Select "Tele Consultation"                                   │
│ 2. View Available Doctors (showing "Available Now" status)     │
│    └── Shows: Individual Staff Doctors OR Individual Vets       │
│ 3. Select Doctor → View Profile                                │
│ 4. Select Pet                                                   │
│ 5. Choose: Instant OR Schedule Later                            │
│    - Instant: Join Queue → Wait for Connection                 │
│    - Scheduled: Pick Date/Time                                 │
│ 6. Review & Pay                                                │
│ 7. Wait for Video Call / Join at Scheduled Time               │
│ 8. Consultation Ends → View Prescription in Chat              │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ VENDOR/STAFF DASHBOARD                                          │
├─────────────────────────────────────────────────────────────────┤
│ 1. Toggle "Available for Tele" status (Staff or Individual)    │
│ 2. Receive Call Request / Accept Scheduled Booking              │
│ 3. Start Video Call                                             │
│ 4. Consultation → No OTP Required                              │
│ 5. End Call → Create Prescription (if vet)                     │
│ 6. Share Prescription via Chat                                 │
│ 7. Revenue Realized Automatically                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. VENDOR-SPECIFIC FLOWS

### A. VETERINARIAN FLOW

```
┌────────────────────────────────────────────────────────────────────────┐
│ VET SERVICE DASHBOARD (Customer App)                                   │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │
│  │ 📹 TELE     │  │ 🏥 CLINIC   │  │ 🏠 HOME     │                   │
│  │ Consult     │  │   Visit     │  │   Visit     │                   │
│  │ ₹299/15min  │  │ Book Slot   │  │ ₹999+       │                   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                   │
│         │                │                │                            │
│         ▼                ▼                ▼                            │
│  ┌────────────┐   ┌────────────┐   ┌────────────┐                     │
│  │ Available  │   │  Clinics   │   │Vets/Staff  │                     │
│  │ Vets/Staff │   │  Near Me   │   │  Near You  │                     │
│  │    Now     │   │            │   │            │                     │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘                  │
│         │                │                │                            │
│         ▼                ▼                ▼                            │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │                    SELECT SERVICE                              │   │
│  │  • General Checkup    • Vaccination    • Deworming             │   │
│  │  • Dental Checkup     • Minor Surgery  • Emergency            │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                          │                                             │
│                          ▼                                             │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │              BOOKING FLOW (per style)                          │   │
│  └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

**Vendor Dashboard Capabilities for Vets:**
* ✅ Booking Management (Accept/Complete with OTP)
* ✅ Medical Records (create/view patient history)
* ✅ Prescriptions (create and share via chat)
* ✅ Diagnostics Results (upload lab reports)
* ✅ Tele Consultation (video call interface)
* ✅ Schedule Management (set availability)
* ✅ Staff Management (add doctors to clinic)
* ⚠️ **For Clinics**: Staff members must be created and assigned to `at_home`/`tele` services
* ⚠️ **Staff Requirements**: Each staff must have verified mobile number before going live

### B. GROOMER FLOW

```
┌────────────────────────────────────────────────────────────────────────┐
│ GROOMING SERVICE DASHBOARD (Customer App)                              │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─────────────────┐      ┌─────────────────┐                         │
│  │ 🏢 SALON VISIT  │      │ 🏠 HOME GROOMING │                         │
│  │   50+ Centers   │      │   Track Live     │                         │
│  └────────┬────────┘      └────────┬────────┘                         │
│           │                         │                                  │
│           ▼                         ▼                                  │
│    View Salons List         View Available Groomers                    │
│           │                         │                                  │
│           │                         └── Shows: Individual Staff OR     │
│           │                              Individual Home Groomers      │
│           ▼                         ▼                                  │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │              SELECT GROOMING PACKAGE                          │   │
│  │  • Bath & Dry     • Haircut      • Full Spa                  │   │
│  │  • Nail Trim      • Ear Clean    • De-matting                │   │
│  └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

**Vendor Dashboard Capabilities for Groomers:**
* ✅ Booking Management (with before/after photos)
* ✅ Service Packages (bundle services)
* ✅ Schedule Management
* ✅ GPS Tracking (for at-home)
* ⚠️ **For Grooming Centers**: Staff members must be created and assigned to `at_home` services
* ⚠️ **Staff Requirements**: Each staff must have verified mobile number before going live

### C. TRAINER FLOW

```
┌────────────────────────────────────────────────────────────────────────┐
│ TRAINING SERVICE DASHBOARD (Customer App)                               │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─────────────────┐      ┌─────────────────┐                         │
│  │ 🏢 TRAINING     │      │ 🏠 HOME TRAINING │                         │
│  │    CENTER       │      │   Personalized   │                         │
│  └────────┬────────┘      └────────┬────────┘                         │
│           │                        │                                  │
│           ▼                        ▼                                  │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │           SELECT TRAINING PROGRAM                              │   │
│  │  • Basic Obedience   • Advanced Training  • Puppy Training     │   │
│  │  • Behavior Mod      • Agility           • Protection          │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │           SUBSCRIPTION OPTIONS                                 │   │
│  │  • Single Session    • 5-Session Pack    • Monthly Program    │   │
│  └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

### D. WALKER FLOW (Unique - GPS-Heavy)

```
┌────────────────────────────────────────────────────────────────────────┐
│ WALKING SERVICE DASHBOARD (Customer App)                                │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │            🚶 DOG WALKING - AT HOME ONLY                         │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │           NEARBY WALKERS                                       │   │
│  │  [Map showing walker locations with availability]             │   │
│  │  • Walker A - ⭐ 4.8 - 0.5km - Available Now                  │   │
│  │  • Walker B - ⭐ 4.7 - 1.2km - Available in 30min             │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │           SELECT WALK TYPE                                     │   │
│  │  • 30 Min Walk - ₹200    • 60 Min Walk - ₹350                │   │
│  │  • Group Walk - ₹250     • Jogging - ₹400                    │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │           DURING WALK                                          │   │
│  │  [Live Map with walker + dog location]                        │   │
│  │  Distance: 2.3km | Duration: 25min | Pace: Normal             │   │
│  │  Route History: [polyline on map]                            │   │
│  └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

**Walker-Specific Features:**
* GPS tracking throughout the walk
* Route recording
* Session start/end with OTP
* Walk history with distance/duration stats

---

## 5. STAFF ONBOARDING & VERIFICATION FLOW

### ⚠️ Staff Management for Businesses (Clinics, Grooming Centers)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    STAFF ONBOARDING PROCESS                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  STEP 1: BUSINESS OWNER CREATES STAFF PROFILE                         │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ Vendor Dashboard → Staff Management → Add New Staff             │  │
│  │                                                                 │  │
│  │ Required Fields:                                                │  │
│  │  • Full Name                                                    │  │
│  │  • Mobile Number (MANDATORY - for login)                         │  │
│  │  • Email (Optional)                                             │  │
│  │  • Role (Doctor, Groomer, Trainer, etc.)                      │  │
│  │  • Specializations                                             │  │
│  │  • Services Assignment (at_home, tele, at_center)               │  │
│  │  • Photo                                                        │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│           │                                                             │
│           ▼                                                             │
│  STEP 2: SYSTEM SENDS OTP TO STAFF MOBILE NUMBER                     │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  • OTP sent automatically to staff mobile number                   │  │
│  │  • Staff receives SMS with verification code                     │  │
│  │  • OTP valid for 10 minutes                                      │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│           │                                                             │
│           ▼                                                             │
│  STEP 3: STAFF VERIFIES MOBILE NUMBER                                │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  Staff App / Web Portal:                                        │  │
│  │  1. Enter mobile number                                          │  │
│  │  2. Enter OTP received via SMS                                  │  │
│  │  3. Verify → Account activated                                  │  │
│  │                                                                 │  │
│  │  ⚠️ Staff CANNOT login until mobile is verified                │  │
│  │  ⚠️ Staff CANNOT appear in customer searches until verified     │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│           │                                                             │
│           ▼                                                             │
│  STEP 4: STAFF CAN NOW LOGIN INDEPENDENTLY                            │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  Staff Login Flow:                                               │  │
│  │  1. Open Staff App / Portal                                      │  │
│  │  2. Enter mobile number (login credential)                      │  │
│  │  3. Receive OTP via SMS                                         │  │
│  │  4. Enter OTP → Access Staff Dashboard                          │  │
│  │                                                                 │  │
│  │  ✅ Staff has independent login (separate from business owner)  │  │
│  │  ✅ Staff can manage their own bookings                          │  │
│  │  ✅ Staff can update availability                               │  │
│  │  ✅ Staff can view their earnings                               │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│           │                                                             │
│           ▼                                                             │
│  STEP 5: STAFF GOES LIVE ON PLATFORM                                  │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  Once verified:                                                  │  │
│  │  ✅ Staff appears in customer searches for assigned services      │  │
│  │  ✅ Staff can accept bookings                                    │  │
│  │  ✅ Staff profile visible to customers                           │  │
│  │  ✅ Staff can receive ratings and reviews                         │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Requirements:

1. **Mobile Number Verification:**
   - ✅ Mobile number is **MANDATORY** for all staff members
   - ✅ Mobile number serves as **primary login credential**
   - ✅ OTP verification is **required** before staff can go live
   - ✅ Staff cannot accept bookings until mobile is verified

2. **Independent Login:**
   - ✅ Each staff member has **separate login account**
   - ✅ Staff login is **independent** of business owner login
   - ✅ Staff authenticate using their **mobile number + OTP**
   - ✅ Business owner cannot access staff account directly

3. **Service Assignment:**
   - ✅ Staff must be assigned to specific services
   - ✅ For `at_home`/`tele`: Only verified staff can be assigned
   - ✅ Staff only appears in searches for assigned services
   - ✅ Business owner manages service assignments

4. **Platform Visibility:**
   - ❌ **Unverified staff** do NOT appear in customer searches
   - ❌ **Unverified staff** cannot accept bookings
   - ✅ **Verified staff** appear in searches when assigned to services
   - ✅ **Verified staff** can manage their own bookings independently

---

## 6. BOOKING COMPLETION & PAYMENT FLOW

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PAYMENT & SETTLEMENT FLOW                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  CUSTOMER BOOKING                                                       │
│       │                                                                 │
│       ▼                                                                 │
│  ┌─────────────┐                                                       │
│  │ Pay Upfront │ ────────────────────────────────────────┐            │
│  │ (Razorpay)  │                                         │            │
│  └──────┬──────┘                                         │            │
│         │                                                 ▼            │
│         ▼                                        ┌──────────────┐      │
│  ┌─────────────┐                                │ Platform Fee │      │
│  │  In Escrow  │                                │  Deducted    │      │
│  │  (Pending)  │                                └──────────────┘      │
│  └──────┬──────┘                                                      │
│         │                                                               │
│  SERVICE COMPLETED (OTP Verified)                                      │
│         │                                                               │
│         ▼                                                               │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                    SETTLEMENT CALCULATION                        │  │
│  │  Booking Amount:           ₹1,000                               │  │
│  │  Platform Commission (15%): ₹150                                 │  │
│  │  GST on Commission (18%):   ₹27                                 │  │
│  │  ───────────────────────────────                                  │  │
│  │  Vendor Earnings:          ₹823                                  │  │
│  └────────────────────────────────────────────────────────────────┘   │
│         │                                                               │
│         ▼                                                               │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐           │
│  │ Daily Pool  │ ──▶ │  Weekly     │ ──▶ │  Bank       │           │
│  │ Accumulate  │      │  Settlement │      │  Transfer   │           │
│  └─────────────┘      └─────────────┘      └─────────────┘           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 7. KEY RECOMMENDATIONS FOR IMPLEMENTATION

### A. Customer App Improvements

#### 1. Unified Service Dashboard Pattern
```typescript
// Each service dashboard should follow this pattern:
interface ServiceDashboardProps {
  phone: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

// Standard sections:
// - Header with stats (active vendors, sessions, rating)
// - Service style tiles (filtered by role config)
// - Spotlight offers
// - Featured vendors
// - Problem-based navigation (optional)
```

#### 2. Dynamic Service Style Loading
```typescript
// Load allowed styles from role config, not hardcode
const loadAllowedStyles = async (roleId: string) => {
  const config = await apiClient.get(`/config/roles/${roleId}`);
  return config.serviceStyles; // ['at_center', 'at_home', 'tele']
};
```

#### 3. Consistent Booking Flow
* All booking flows should follow: Service → Pet → DateTime → Address (if at_home) → Payment → Confirmation

#### 4. ⚠️ Home/Tele Service Provider Filtering
```typescript
// When loading providers for at_home or tele services:
const loadServiceProviders = async (serviceStyle: 'at_home' | 'tele', roleId: string) => {
  // Check if vendor has clinic/center setup
  const vendor = await apiClient.get(`/vendor/${vendorId}`);
  
  if (vendor.hasClinicSetup && (serviceStyle === 'at_home' || serviceStyle === 'tele')) {
    // Only return staff members, not the business entity
    return await apiClient.get(`/vendor/${vendorId}/staff?serviceStyle=${serviceStyle}`);
  } else {
    // Return individual providers
    return await apiClient.get(`/vendors?roleId=${roleId}&serviceStyle=${serviceStyle}`);
  }
};
```

### B. Vendor Dashboard Improvements

#### 1. Role-Based Dashboard Sections
```typescript
// Show/hide sections based on capabilities
const dashboardSections = {
  booking_management: true, // All roles
  medical_records: roleHasCapability('medical_records'),
  prescriptions: roleHasCapability('prescription_create'),
  gps_tracking: roleHasCapability('gps_tracking'),
  staff_management: roleHasCapability('staff_create'),
  inventory: roleHasCapability('inventory_manage'),
};
```

#### 2. Service Style-Aware Booking Card
```typescript
// Booking card should adapt based on service style
<BookingCard 
  booking={booking}
  showGPSTracking={booking.serviceStyle === 'at_home'}
  showVideoCall={booking.serviceStyle === 'tele'}
  requireOTP={booking.serviceStyle !== 'tele'}
/>
```

#### 3. ⚠️ Staff Assignment for Home/Tele Services
```typescript
// For clinics/centers offering at_home/tele:
// 1. Show warning if trying to enable at_home/tele without staff
// 2. Redirect to staff management when enabling these services
// 3. Only allow enabling if staff members are assigned AND verified

const enableHomeTeleService = async (serviceId: string, serviceStyle: 'at_home' | 'tele') => {
  const vendor = await getVendorProfile();
  
  if (vendor.hasClinicSetup) {
    const staff = await apiClient.get(`/vendor/${vendorId}/staff`);
    const assignedStaff = staff.filter(s => 
      s.services?.some(svc => svc.id === serviceId && svc.serviceStyle === serviceStyle) &&
      s.mobileVerified === true // ⚠️ Only verified staff can go live
    );
    
    if (assignedStaff.length === 0) {
      toast.error('Please assign this service to a verified staff member first');
      navigate('/staff?assignService=' + serviceId);
      return;
    }
  }
  
  // Enable service
  await apiClient.put(`/vendor/${vendorId}/services/${serviceId}`, { isEnabled: true });
};
```

#### 4. ⚠️ Staff Onboarding & Verification Flow
```typescript
// Staff creation and verification process
interface StaffOnboardingFlow {
  // Step 1: Business owner creates staff profile
  createStaffProfile: {
    fullName: string;
    phone: string; // MANDATORY - will be used for login
    email?: string;
    role: 'doctor' | 'groomer' | 'trainer' | 'walker';
    specializations: string[];
    services: string[]; // Assigned services
  };
  
  // Step 2: Staff receives OTP on their mobile
  sendVerificationOTP: (phone: string) => Promise<void>;
  
  // Step 3: Staff verifies mobile number
  verifyMobile: (phone: string, otp: string) => Promise<{
    success: boolean;
    staffId: string;
    loginCredentials: {
      phone: string; // Login with this number
      temporaryPassword?: string; // If applicable
    };
  }>;
  
  // Step 4: Staff can now login independently
  staffLogin: (phone: string, otp: string) => Promise<{
    staffId: string;
    vendorId: string;
    accessToken: string;
  }>;
  
  // Step 5: Only verified staff appear in customer searches
  getAvailableStaff: async (serviceStyle: 'at_home' | 'tele') => {
    return staff.filter(s => 
      s.mobileVerified === true && 
      s.isActive === true &&
      s.services.some(svc => svc.serviceStyle === serviceStyle)
    );
  };
}
```

### C. Critical Missing Components

Based on analysis, these components need full implementation:

| Component | Status | Priority |
|-----------|--------|----------|
| WalkerDashboard (Customer) | Placeholder | HIGH |
| Live GPS Tracking View | Partial | HIGH |
| Instant Tele Queue | Missing | MEDIUM |
| Training Progress Tracker | Missing | MEDIUM |
| Package/Subscription Booking | Partial | MEDIUM |
| **Staff Assignment UI for Home/Tele** | **Missing** | **HIGH** |
| **Business vs Individual Provider Filtering** | **Missing** | **HIGH** |
| **Staff Mobile Verification Flow** | **Missing** | **HIGH** |
| **Staff Independent Login System** | **Missing** | **HIGH** |

---

## 8. SUMMARY: THE IDEAL FLOW

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     WARMPAWZ SERVICE DELIVERY FLOW                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  CUSTOMER DISCOVERY                                                     │
│  ├── Home Dashboard → Service Categories                               │
│  ├── OR Problem Grid → AI-Suggested Services                           │
│  └── OR Search → Direct Service/Vendor                                 │
│           │                                                             │
│           ▼                                                             │
│  SERVICE STYLE SELECTION                                                │
│  ├── at_center: Book appointment at venue                              │
│  ├── at_home: Schedule home visit with GPS                             │
│  │   └── ⚠️ Shows: Staff Members OR Individual Providers              │
│  └── tele: Instant or scheduled video call                             │
│       └── ⚠️ Shows: Staff Doctors OR Individual Vets                 │
│           │                                                             │
│           ▼                                                             │
│  VENDOR/STAFF DISCOVERY                                                 │
│  ├── Map + List view of available vendors/staff                         │
│  ├── Filters (rating, distance, price, availability)                    │
│  └── Provider profile with services, reviews                            │
│           │                                                             │
│           ▼                                                             │
│  BOOKING & PAYMENT                                                     │
│  ├── Select service from provider's catalog                            │
│  ├── Select pet, date/time, address (if at_home)                       │
│  ├── Pay via Razorpay                                                  │
│  └── Receive OTP for service completion                                 │
│           │                                                             │
│           ▼                                                             │
│  VENDOR/STAFF FULFILLMENT                                              │
│  ├── Accept booking on vendor/staff dashboard                          │
│  ├── Deliver service (track via GPS if at_home)                        │
│  ├── Complete with OTP verification                                     │
│  ├── Add medical records/prescriptions (if vet)                        │
│  └── Revenue realized → Settlement                                      │
│           │                                                             │
│           ▼                                                             │
│  POST-SERVICE                                                          │
│  ├── Customer reviews vendor/staff                                     │
│  ├── Follow-up reminders (vaccination, grooming)                        │
│  ├── Chat enabled until follow-up date                                 │
│  └── Loyalty points credited                                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Business Rules Summary:

1. **Individual Providers** (Vet without clinic, Home Groomer):
   - ✅ Can offer `at_home` and `tele` services directly
   - ✅ Appear in customer searches for these services

2. **Business Entities** (Vet Clinic, Grooming Center):
   - ✅ Can offer `at_center` services directly
   - ❌ **CANNOT** offer `at_home` or `tele` at business level
   - ✅ **MUST** create staff profiles for `at_home`/`tele` services
   - ✅ Staff members appear as individual providers in searches

3. **Staff Members**:
   - ✅ Can be assigned to specific services (including `at_home`/`tele`)
   - ✅ **Have their own independent login account** (separate from business owner)
   - ✅ **Mobile number is MANDATORY** for staff login credentials
   - ✅ **Mobile number MUST be verified via OTP** before staff can go live
   - ✅ **Cannot appear in customer searches** until mobile is verified
   - ✅ Appear in customer searches when assigned to services AND verified
   - ✅ Have individual profiles, ratings, and availability
   - ✅ Login using their mobile number (separate authentication from business)

This flow ensures:
- ✅ Clear separation between business entities and individual providers
- ✅ Proper staff assignment for home and tele services
- ✅ Consistent customer experience across all service styles
- ✅ Scalable architecture for multi-staff businesses
