# Customer App Booking Flows - Complete Service Type Mapping

**Generated:** 2025-01-28  
**Purpose:** Comprehensive documentation of all service booking flows from customer app, organized by service type

---

## 📋 Table of Contents

1. [Service Types Overview](#service-types-overview)
2. [Service Styles](#service-styles)
3. [Booking Flows by Service Type](#booking-flows-by-service-type)
4. [Common Booking Components](#common-booking-components)
5. [API Endpoints Reference](#api-endpoints-reference)

---

## Service Types Overview

### Primary Service Categories

| Service Type | Role ID | Service Styles | Component Router | Status |
|-------------|---------|----------------|------------------|--------|
| **Veterinary** | `veterinarian`, `veterinary_clinic`, `pet_clinic` | `at_center`, `at_home`, `tele` | `VetServiceRouter` | ✅ Complete |
| **Grooming** | `pet_groomer` | `at_center`, `at_home` | `GroomingServiceRouter` | ✅ Complete |
| **Training** | `pet_trainer` | `at_center`, `at_home`, `tele` | `TrainingServiceRouter` | ✅ Complete |
| **Walking** | `pet_walker` | `at_home` | `WalkingServiceRouter` | ✅ Complete |
| **Boarding** | `pet_boarding` | `at_center` | `BoardingServiceRouter` | ✅ Complete |
| **Resort** | `pet_resort` | `at_center` | `ResortBoardingBookingEnhanced` | ✅ Complete |
| **Cafe** | `pet_cafe` | `at_center` | `PetCafeServicesLanding` | ✅ Complete |
| **Behavioral** | `pet_behaviorist` | `at_center`, `at_home`, `tele` | `BehavioralServiceRouter` | ✅ Complete |
| **Ambulance** | `pet_ambulance` | `at_home` (emergency) | `AmbulanceBookingFlow` | ✅ Complete |
| **Diagnostics** | `diagnostics_center` | `at_center`, `at_home` | `DiagnosticsBookingFlow` | ✅ Complete |
| **Pharmacy** | `pet_pharmacy` | `delivery` | `DeliveryBookingFlow` | ✅ Complete |
| **Nutritionist** | `nutritionist` | `tele`, `delivery` | `NutritionistServiceRouter` | ✅ Complete |
| **Insurance** | `pet_insurance`, `insurance` | `tele`, `at_center` | `InsuranceServicesLanding` | ✅ Complete |
| **Adoption** | `pet_shelter` | `at_center` | `AdoptionServiceRouter` | ✅ Complete |
| **Products** | `pet_products_store` | `delivery` | `DeliveryBookingFlow` | ✅ Complete |
| **Packages** | Multiple | `package` | `PackageBookingPage` | ✅ Complete |
| **Holiday** | `pet_holiday_planner` | `package` | `PetHolidayServicesLanding` | ✅ Complete |

---

## Service Styles

### Style Definitions

| Style | Description | Location Required | Staff Required | OTP Required |
|-------|-------------|-------------------|----------------|--------------|
| `at_center` | Customer visits vendor facility | ❌ No | ✅ Yes | ✅ Yes (except cafe) |
| `at_home` | Vendor visits customer location | ✅ Yes | ✅ Yes | ✅ Yes |
| `tele` | Remote video/phone consultation | ❌ No | ✅ Yes | ❌ No |
| `delivery` | Product/service delivery | ✅ Yes | ❌ No | ✅ Yes |
| `package` | Multi-session packages/subscriptions | Varies | Varies | Varies |

---

## Booking Flows by Service Type

### 1. Veterinary Services (`vet`)

**Router Component:** `VetServiceRouter.tsx`  
**Landing Component:** `VetServicesLanding.tsx`  
**Booking Components:** `VetBookingFlow.tsx`, `VetBookingRouter.tsx`, `CenterBookingFlowEnhanced.tsx`

#### Service Styles:
- **At Center (`at_center`)**: Clinic visit
- **At Home (`at_home`)**: Home visit
- **Tele (`tele`)**: Video consultation

#### Booking Flow:

**1.1 Center Visit Flow:**
```
Landing Page (VetServicesLanding)
  ↓
Problem Grid (optional) OR Direct Vendor Selection
  ↓
Vendor Discovery (VendorDiscoveryByProblem)
  ↓
Clinic Profile View (VetCenterProfileView)
  ↓
Doctor Selection (VetDoctorDetails)
  ↓
Service Selection
  ↓
Date & Time Selection
  ↓
Pet Selection
  ↓
Payment (Razorpay)
  ↓
Booking Confirmation
  ↓
OTP Generated (END OTP only)
```

**1.2 Home Visit Flow:**
```
Landing Page
  ↓
Problem Grid OR Vendor Selection
  ↓
Vendor Discovery
  ↓
Service Selection
  ↓
Address Selection
  ↓
Date & Time Selection
  ↓
Pet Selection
  ↓
Payment
  ↓
Booking Confirmation
  ↓
OTP Generated (END OTP)
```

**1.3 Tele Consultation Flow:**
```
Landing Page
  ↓
Instant OR Scheduled Selection
  ↓
[INSTANT] Available Doctors → Payment → Auto-Assign → Video Call
  ↓
[SCHEDULED] Doctor Selection → Time Slot → Payment → Scheduled Call
```

**API Endpoints:**
- `GET /customer/services?roleId=veterinarian`
- `GET /customer/universal-problem-discovery?problemGridId={id}&roleId=veterinarian`
- `POST /bookings/create`
- `GET /tele/instant-available-doctors?serviceId={id}`
- `GET /tele/scheduled-availability?serviceId={id}&date={date}`

**Special Features:**
- ✅ Problem-driven discovery
- ✅ Doctor selection for clinic visits
- ✅ Follow-up booking eligibility
- ✅ Medical record attachment
- ✅ Prescription upload support

---

### 2. Grooming Services (`grooming`)

**Router Component:** `GroomingServiceRouter.tsx`  
**Landing Component:** `GroomingServicesLanding.tsx`  
**Booking Components:** `GroomingAtHome.tsx`, `CenterBookingFlowEnhanced.tsx`

#### Service Styles:
- **At Center (`at_center`)**: Visit salon
- **At Home (`at_home`)**: Groomer comes to you

#### Booking Flow:

**2.1 Center Visit Flow:**
```
Landing Page (GroomingServicesLanding)
  ↓
Problem Grid OR Vendor List
  ↓
Vendor Discovery
  ↓
Center Profile View
  ↓
Service Selection (Basic/Full Package)
  ↓
Date & Time Selection
  ↓
Pet Selection
  ↓
Payment
  ↓
Booking Confirmation
  ↓
OTP Generated (END OTP)
```

**2.2 Home Service Flow:**
```
Landing Page
  ↓
Problem Grid OR Vendor List
  ↓
Vendor Discovery
  ↓
Service Selection
  ↓
Address Selection
  ↓
Date & Time Selection
  ↓
Pet Selection
  ↓
Payment
  ↓
Booking Confirmation
  ↓
OTP Generated (END OTP)
  ↓
Live GPS Tracking (when service starts)
```

**API Endpoints:**
- `GET /customer/services?roleId=pet_groomer`
- `POST /bookings/create`
- `GET /booking/:bookingId/tracking` (for home services)

**Special Features:**
- ✅ Service package selection
- ✅ Gallery system
- ✅ Live tracking for home services
- ✅ Before/after photos

---

### 3. Training Services (`training`)

**Router Component:** `TrainingServiceRouter.tsx`  
**Landing Component:** `TrainingServicesLanding.tsx`  
**Booking Components:** `TrainingAtHome.tsx`, `PackageBookingPage.tsx`

#### Service Styles:
- **At Center (`at_center`)**: Training center visit
- **At Home (`at_home`)**: Trainer comes to you
- **Tele (`tele`)**: Online training consultation

#### Booking Flow:

**3.1 Home Training Flow:**
```
Landing Page
  ↓
Problem Grid OR Vendor List
  ↓
Vendor Discovery
  ↓
Service Selection (Single Session OR Package)
  ↓
Address Selection
  ↓
Date & Time Selection
  ↓
Pet Selection
  ↓
Payment
  ↓
Booking Confirmation
  ↓
OTP Generated (START + END OTP)
  ↓
Session Tracking & Progress Updates
```

**3.2 Package Booking Flow:**
```
Landing Page
  ↓
Package Selection
  ↓
Package Details (Total Sessions, Price)
  ↓
Schedule Framework (Multiple Sessions)
  ↓
Payment
  ↓
Booking Confirmation
  ↓
Session Tracker (Track each session completion)
```

**API Endpoints:**
- `GET /customer/services?roleId=pet_trainer`
- `POST /bookings/create`
- `POST /bookings/package/create`
- `GET /customer/packages`

**Special Features:**
- ✅ START + END OTP (for session tracking)
- ✅ Package booking support
- ✅ Progress tracking
- ✅ Session milestone tracking

---

### 4. Walking Services (`walker`)

**Router Component:** `WalkingServiceRouter.tsx`  
**Landing Component:** `WalkingServicesLanding.tsx`  
**Booking Components:** `WalkerService.tsx`

#### Service Styles:
- **At Home (`at_home`)**: Walker picks up pet

#### Booking Flow:

```
Landing Page
  ↓
Problem Grid OR Walker List
  ↓
Vendor Discovery
  ↓
Walker Profile
  ↓
Service Selection (30 min / 60 min)
  ↓
Address Selection (Pickup Location)
  ↓
Date & Time Selection
  ↓
Pet Selection
  ↓
Payment
  ↓
Booking Confirmation
  ↓
OTP Generated (START + END OTP)
  ↓
Live GPS Tracking (during walk)
  ↓
Walk Photos & Summary
```

**API Endpoints:**
- `GET /customer/services?roleId=pet_walker`
- `POST /bookings/create`
- `GET /booking/:bookingId/tracking`

**Special Features:**
- ✅ START + END OTP
- ✅ Live GPS tracking
- ✅ Walk photos
- ✅ Walk history

---

### 5. Boarding Services (`boarding`)

**Router Component:** `BoardingServiceRouter.tsx`  
**Landing Component:** `BoardingServicesLanding.tsx`  
**Booking Components:** `CenterBookingFlowEnhanced.tsx`

#### Service Styles:
- **At Center (`at_center`)**: Overnight/Daycare

#### Booking Flow:

```
Landing Page
  ↓
Service Type Selection (Overnight Boarding OR Daycare)
  ↓
Vendor List
  ↓
Center Profile
  ↓
Room/Service Selection
  ↓
Date Selection (Check-in & Check-out)
  ↓
Pet Selection
  ↓
Pre-Check Form (Vaccination, Medical Conditions)
  ↓
Payment
  ↓
Booking Confirmation
  ↓
OTP Generated (Check-in & Check-out OTP)
```

**API Endpoints:**
- `GET /customer/services?roleId=pet_boarding`
- `POST /bookings/create`
- `POST /bookings/:bookingId/pre-check` (pre-check form submission)

**Special Features:**
- ✅ Check-in/Check-out dates
- ✅ Pre-check form (vaccination status, medical conditions)
- ✅ Room availability check
- ✅ Stay duration calculation

---

### 6. Resort & Boarding (`resort`)

**Router Component:** `ResortBoardingBookingEnhanced.tsx`  
**Landing Component:** `ResortServicesLanding.tsx`

#### Service Styles:
- **At Center (`at_center`)**: Resort stay

#### Booking Flow:

```
Landing Page
  ↓
Resort Selection
  ↓
Room Selection (Room Types & Availability)
  ↓
Date Selection (Check-in & Check-out)
  ↓
Guest Count Selection
  ↓
Availability Check
  ↓
Pre-Check Form (Vaccination, Medical Conditions, Dietary Needs)
  ↓
Payment
  ↓
Booking Confirmation
  ↓
Check-in OTP & Check-out OTP
```

**API Endpoints:**
- `GET /customer/services?roleId=pet_resort`
- `GET /resort/rooms/:vendorId`
- `POST /bookings/create`
- `POST /bookings/:bookingId/pre-check`

**Special Features:**
- ✅ Room catalog
- ✅ Multi-night stay calculation
- ✅ Pre-check form
- ✅ Guest count selection

---

### 7. Pet Cafe (`cafe`)

**Router Component:** `PetCafeServicesLanding.tsx`  
**Booking Component:** `CenterBookingFlowEnhanced.tsx` (with cafe-specific features)

#### Service Styles:
- **At Center (`at_center`)**: Table reservation

#### Booking Flow:

```
Landing Page
  ↓
Cafe Selection
  ↓
Cafe Profile
  ↓
Date & Time Selection
  ↓
Table Selection (if available)
  ↓
Party Package Selection (optional)
  ↓
Number of Pax Selection
  ↓
Pet Selection
  ↓
Payment
  ↓
Booking Confirmation
```

**API Endpoints:**
- `GET /customer/services?roleId=pet_cafe`
- `GET /cafe/tables/:vendorId?date={date}&time={time}`
- `POST /bookings/create`

**Special Features:**
- ✅ Table management
- ✅ Party packages
- ✅ Number of pax (people + pets)
- ✅ No OTP required (table booking)

---

### 8. Behavioral Services (`behavioral`)

**Router Component:** `BehavioralServiceRouter.tsx`  
**Landing Component:** `BehavioralServicesLanding.tsx`

#### Service Styles:
- **At Center (`at_center`)**: Center consultation
- **At Home (`at_home`)**: Home consultation
- **Tele (`tele`)**: Video consultation

#### Booking Flow:

```
Landing Page
  ↓
Problem Grid OR Vendor List
  ↓
Vendor Discovery
  ↓
Behaviorist Profile
  ↓
Service Selection
  ↓
[Center] Date & Time Selection
[Home] Address Selection → Date & Time
[Tele] Instant OR Scheduled → Time Slot
  ↓
Pet Selection
  ↓
Payment
  ↓
Booking Confirmation
  ↓
OTP Generated (START + END for home, none for tele)
```

**API Endpoints:**
- `GET /customer/services?roleId=pet_behaviorist`
- `POST /bookings/create`

**Special Features:**
- ✅ Problem-driven discovery
- ✅ Behavioral assessment forms
- ✅ Progress tracking

---

### 9. Ambulance & Emergency (`ambulance`)

**Router Component:** `AmbulanceBookingFlow.tsx`  
**Landing Component:** `AmbulanceServicesLanding.tsx`

#### Service Styles:
- **At Home (`at_home`)**: Emergency pickup

#### Booking Flow:

```
Landing Page OR Emergency Button
  ↓
Ambulance Type Selection (Basic / Oxygen / ICU)
  ↓
Location Confirmation (Auto-detected or Manual)
  ↓
Emergency Details
  ↓
Payment (Post-service payment option)
  ↓
Booking Confirmation
  ↓
Ambulance Dispatch
  ↓
Live GPS Tracking
  ↓
OTP Generated (END OTP on arrival)
```

**API Endpoints:**
- `POST /integrated-services/ambulance/book`
- `GET /booking/:bookingId/tracking`

**Special Features:**
- ✅ Emergency priority
- ✅ Auto-location detection
- ✅ Post-service payment option
- ✅ Live GPS tracking
- ✅ Real-time ETA

---

### 10. Diagnostics (`diagnostics`)

**Router Component:** `DiagnosticsBookingFlow.tsx`

#### Service Styles:
- **At Center (`at_center`)**: Visit lab
- **At Home (`at_home`)**: Home sample collection

#### Booking Flow:

```
Landing Page
  ↓
Location Detection (for home collection)
  ↓
Nearby Centers Discovery
  ↓
Center Selection
  ↓
Test Selection (Multiple tests)
  ↓
Collection Type (Home OR Center)
  ↓
[Home] Address Selection → Date & Time
[Center] Date & Time Selection
  ↓
Pet Selection
  ↓
Payment
  ↓
Booking Confirmation
  ↓
OTP Generated (END OTP)
  ↓
[Home] Sample Collection Tracking
[Center] Visit Reminder
  ↓
Report Upload & Download
```

**API Endpoints:**
- `GET /diagnostics/centers/nearby?lat={lat}&lng={lng}&radius={radius}`
- `GET /diagnostics/center/:centerId/tests`
- `POST /bookings/create`
- `GET /diagnostics/reports/:bookingId`

**Special Features:**
- ✅ Home sample collection
- ✅ Multiple test selection
- ✅ Report upload/download
- ✅ Preparation instructions

---

### 11. Pharmacy / Medicine Delivery (`pharmacy`)

**Router Component:** `DeliveryBookingFlow.tsx` (serviceType: 'pharmacy')

#### Service Styles:
- **Delivery (`delivery`)**: Medicine delivery

#### Booking Flow:

```
Landing Page
  ↓
Prescription Upload (Required)
  ↓
Prescription Validation
  ↓
Medicine Selection (from prescription OR catalog)
  ↓
Address Selection
  ↓
Delivery Time Slot Selection
  ↓
Order Review
  ↓
Payment
  ↓
Order Confirmation
  ↓
Broadcast to Pharmacies (for prescription-based)
  ↓
Proforma Invoice
  ↓
Payment Confirmation
  ↓
Delivery Tracking
  ↓
OTP on Delivery
```

**API Endpoints:**
- `POST /customer/prescription/submit`
- `GET /pharmacy/prescription/:prescriptionId/medicines`
- `POST /orders` (e-commerce order creation)
- `GET /orders/:orderId/tracking`

**Special Features:**
- ✅ Prescription upload & validation
- ✅ Broadcast to multiple pharmacies
- ✅ Proforma invoice
- ✅ Delivery tracking
- ✅ OTP on delivery

---

### 12. Nutritionist Services (`nutrition`)

**Router Component:** `NutritionistServiceRouter.tsx`  
**Landing Component:** `NutritionistServicesLanding.tsx`

#### Service Styles:
- **Tele (`tele`)**: Consultation
- **Delivery (`delivery`)**: Meal plan delivery

#### Booking Flow:

**12.1 Consultation Flow:**
```
Landing Page
  ↓
Service Selection (Consultation OR Meal Plan)
  ↓
Nutritionist Selection
  ↓
[Tele] Time Slot Selection
  ↓
Pet Selection
  ↓
Payment
  ↓
Booking Confirmation
  ↓
Video Call (for tele)
```

**12.2 Meal Plan Delivery Flow:**
```
Landing Page
  ↓
Meal Plan Selection
  ↓
Nutritionist Selection
  ↓
Meal Plan Details
  ↓
Address Selection
  ↓
Delivery Schedule (Subscription)
  ↓
Payment
  ↓
Order Confirmation
  ↓
Delivery Tracking
```

**API Endpoints:**
- `GET /customer/services?roleId=nutritionist`
- `POST /bookings` (for consultation)
- `POST /orders` (for meal plan delivery)
- `GET /vendor/:vendorId/meal-plans`

**Special Features:**
- ✅ Meal plan subscription
- ✅ Hyperlocal delivery
- ✅ Diet chart generation

---

### 13. Insurance (`insurance`)

**Router Component:** `InsuranceServicesLanding.tsx`

#### Service Styles:
- **Tele (`tele`)**: Policy consultation
- **At Center (`at_center`)**: In-person purchase

#### Booking Flow:

```
Landing Page
  ↓
Insurance Provider Selection
  ↓
Plan Selection (Basic / Premium / Elite)
  ↓
Policy Details Review
  ↓
Pet Information
  ↓
Payment
  ↓
Policy Purchase Confirmation
  ↓
Policy Document Generation
  ↓
[Optional] Claim Filing Flow
```

**API Endpoints:**
- `GET /customer/services?roleId=pet_insurance`
- `GET /insurance/plans`
- `POST /insurance/policy/purchase`
- `POST /insurance/claim/file`

**Special Features:**
- ✅ Policy purchase
- ✅ Claim filing
- ✅ Policy document management

---

### 14. Adoption (`adoption`)

**Router Component:** `AdoptionServiceRouter.tsx`

#### Service Styles:
- **At Center (`at_center`)**: Visit shelter

#### Booking Flow:

```
Landing Page
  ↓
Adoption Center List
  ↓
Center Profile
  ↓
Pet List (Available Pets)
  ↓
Pet Profile
  ↓
Application Form
  ↓
Application Submission
  ↓
Application Review (by center)
  ↓
Approval/Rejection
  ↓
[If Approved] Adoption Completion
```

**API Endpoints:**
- `GET /customer/services?roleId=pet_shelter`
- `GET /adoption/centers`
- `GET /adoption/center/:centerId/pets`
- `POST /customer/adoption-application`

**Special Features:**
- ✅ Application form
- ✅ Approval workflow
- ✅ Pet profile viewing

---

### 15. Products / E-commerce (`products`)

**Router Component:** `DeliveryBookingFlow.tsx` (serviceType: 'products')

#### Service Styles:
- **Delivery (`delivery`)**: Product delivery

#### Booking Flow:

```
Landing Page (Product Catalog)
  ↓
Product Selection (Add to Cart)
  ↓
Cart Review
  ↓
Address Selection
  ↓
Delivery Time Slot Selection
  ↓
Coupon Application (optional)
  ↓
GST Calculation
  ↓
Payment (Wallet + Gateway)
  ↓
Order Confirmation
  ↓
Inventory Update
  ↓
Delivery Tracking
  ↓
OTP on Delivery
```

**API Endpoints:**
- `GET /products` (e-commerce products)
- `POST /orders` (order creation)
- `GET /orders/:orderId/tracking`
- `POST /payments` (with GST calculation)

**Special Features:**
- ✅ Shopping cart
- ✅ Multi-vendor products
- ✅ GST calculation
- ✅ Inventory management
- ✅ Delivery tracking

---

### 16. Packages & Subscriptions (`package`)

**Router Component:** `PackageBookingPage.tsx`

#### Service Styles:
- **Package (`package`)**: Multi-session packages

#### Booking Flow:

```
Landing Page
  ↓
Package Browse
  ↓
Package Selection
  ↓
Package Details (Total Sessions, Price, Duration)
  ↓
Schedule Framework (Multiple Sessions)
  ↓
Time Slot Selection (for each session)
  ↓
Payment
  ↓
Booking Confirmation
  ↓
Session Tracker
  ↓
Session Completion Tracking
  ↓
Package Completion
```

**API Endpoints:**
- `GET /customer/packages`
- `POST /bookings/package/create`
- `GET /customer/:customerId/packages`
- `POST /bookings/:bookingId/occurrence/:occurrenceId/complete`

**Special Features:**
- ✅ Multi-session scheduling
- ✅ Session milestone tracking
- ✅ Package progress tracking
- ✅ Recurring subscriptions

---

### 17. Holiday Packages (`holiday`)

**Router Component:** `PetHolidayServicesLanding.tsx`

#### Service Styles:
- **Package (`package`)**: Holiday package

#### Booking Flow:

```
Landing Page
  ↓
Holiday Package Selection
  ↓
Package Details (Destinations, Activities, Duration)
  ↓
Date Selection
  ↓
Guest Count
  ↓
Pet Selection
  ↓
Payment
  ↓
Booking Confirmation
  ↓
Itinerary Generation
```

**API Endpoints:**
- `GET /customer/services?roleId=pet_holiday_planner`
- `POST /bookings/package/create`

**Special Features:**
- ✅ Multi-day packages
- ✅ Itinerary management
- ✅ Activity scheduling

---

## Common Booking Components

### Universal Components

1. **BookingFlowDispatcher** (`BookingFlowDispatcher.tsx`)
   - Routes to appropriate booking flow based on service type and style
   - Handles role-based routing

2. **ProblemGridSelector** (`ProblemGridSelector.tsx`)
   - Problem-driven service discovery
   - Used by: Vet, Grooming, Training, Walking, Behavioral

3. **VendorDiscoveryByProblem** (`VendorDiscoveryByProblem.tsx`)
   - Shows vendors specialized in selected problem
   - Filters by capability, availability, distance

4. **CenterBookingFlowEnhanced** (`CenterBookingFlowEnhanced.tsx`)
   - Universal center booking flow
   - Used by: Vet, Grooming, Training, Boarding, Cafe

5. **DeliveryBookingFlow** (`DeliveryBookingFlow.tsx`)
   - Universal delivery booking flow
   - Used by: Pharmacy, Products, Meal Plans

6. **PaymentPage** (`PaymentPage.tsx`)
   - Unified payment processing
   - Supports: Razorpay, Wallet, COD

---

## API Endpoints Reference

### Service Discovery

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/customer/services` | GET | List services by roleId, vendorId, category |
| `/customer/services/:serviceId` | GET | Get service details |
| `/customer/universal-problem-discovery` | GET | Discover vendors by problem |
| `/customer/problem-grid/:roleId` | GET | Get problem grid for role |
| `/customer/packages` | GET | List available packages |

### Booking Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/bookings/create` | POST | Create booking (unified) |
| `/bookings/package/create` | POST | Create package booking |
| `/bookings/:bookingId` | GET | Get booking details |
| `/bookings/:bookingId/status` | PATCH | Update booking status |
| `/bookings/:bookingId/cancel` | POST | Cancel booking |
| `/bookings/:bookingId/lifecycle` | POST | Complete booking lifecycle |
| `/customer/:customerId/bookings` | GET | Get customer bookings |

### Specialized Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/tele/instant-available-doctors` | GET | Get instant tele doctors |
| `/tele/scheduled-availability` | GET | Get scheduled tele availability |
| `/diagnostics/centers/nearby` | GET | Find nearby diagnostic centers |
| `/diagnostics/center/:centerId/tests` | GET | Get tests for center |
| `/resort/rooms/:vendorId` | GET | Get resort rooms |
| `/cafe/tables/:vendorId` | GET | Get available tables |
| `/pharmacy/prescription/:id/medicines` | GET | Get medicines from prescription |
| `/orders` | POST | Create e-commerce order |
| `/orders/:orderId/tracking` | GET | Track order |

### Payment & Financial

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/payments` | POST | Create payment |
| `/payments/:paymentId/verify` | POST | Verify payment |
| `/payments/:paymentId/refund` | POST | Process refund |
| `/customer/wallet/:phone` | GET | Get wallet balance |

---

## Booking Flow Patterns

### Pattern 1: Standard Center Booking
```
Landing → Vendor Selection → Service Selection → Date/Time → Pet → Payment → Confirmation
```

### Pattern 2: Home Service Booking
```
Landing → Vendor Selection → Service Selection → Address → Date/Time → Pet → Payment → Confirmation → Tracking
```

### Pattern 3: Tele Consultation
```
Landing → Instant/Scheduled → Doctor Selection → Time Slot → Payment → Video Call
```

### Pattern 4: Delivery Service
```
Landing → Item Selection → Address → Time Slot → Payment → Order → Tracking → Delivery
```

### Pattern 5: Package Booking
```
Landing → Package Selection → Schedule Framework → Payment → Session Tracker
```

### Pattern 6: Emergency Service
```
Emergency Button → Type Selection → Location → Payment (Post) → Dispatch → Tracking
```

---

## OTP Generation Rules

| Service Type | OTP Type | When Generated |
|-------------|----------|----------------|
| Training | START + END | Both at booking creation |
| Walking | START + END | Both at booking creation |
| Behavioral (Home) | START + END | Both at booking creation |
| All Other Services | END only | At booking creation |
| Cafe | None | No OTP required |
| Tele | None | No OTP required |

---

## Payment Timing

| Service Type | Payment Timing |
|-------------|----------------|
| Most Services | Pre-service (at booking) |
| Ambulance | Post-service (optional) |
| Emergency | Post-service |
| Packages | Pre-service (full amount) |

---

## State Machine Flow

All bookings follow this state progression:

```
pending → confirmed → in_progress → completed
         ↓
      cancelled (with refund if applicable)
```

**State Transitions:**
- `pending`: Booking created, awaiting vendor confirmation
- `confirmed`: Vendor accepted, OTP generated
- `in_progress`: Service started (START OTP verified for applicable services)
- `completed`: Service completed (END OTP verified)
- `cancelled`: Booking cancelled (by customer or vendor)

---

## Special Features by Service

| Service | Special Features |
|---------|------------------|
| Vet | Problem grid, Doctor selection, Follow-up booking, Medical records |
| Grooming | Service packages, Gallery, Before/after photos |
| Training | Progress tracking, Session milestones, Package support |
| Walking | GPS tracking, Walk photos, Walk history |
| Boarding | Pre-check form, Check-in/out dates, Room selection |
| Resort | Room catalog, Multi-night stay, Guest count |
| Cafe | Table management, Party packages, Pax count |
| Ambulance | Emergency priority, Auto-location, Post-payment |
| Diagnostics | Home collection, Multiple tests, Report management |
| Pharmacy | Prescription upload, Broadcast to pharmacies, Proforma invoice |
| Nutrition | Meal plans, Subscription, Diet charts |
| Insurance | Policy purchase, Claim filing, Document management |
| Adoption | Application form, Approval workflow |
| Products | Shopping cart, Multi-vendor, Inventory sync |
| Packages | Multi-session, Progress tracking, Recurring |

---

## Notes

1. **Service Style Mapping**: Frontend uses `'clinic'`, `'home'`, `'tele'` but backend expects `'at_center'`, `'at_home'`, `'tele'`. The `BookingFlowDispatcher` handles this mapping.

2. **Unified Booking Endpoint**: Most services use `POST /bookings/create` with different payloads based on service type.

3. **Problem-Driven Discovery**: Available for Vet, Grooming, Training, Walking, Behavioral services.

4. **OTP Requirements**: Training, Walking, and Behavioral (home) services require START + END OTP. All others use END OTP only.

5. **Payment Integration**: All services support Razorpay. Some support wallet and COD.

6. **GST Calculation**: Applied automatically based on role + service style + customer/vendor state.

7. **State Machine Validation**: All status changes are validated using `validateBookingTransition`.

---

**Last Updated:** 2025-01-28  
**Status:** ✅ Complete - All service types documented

