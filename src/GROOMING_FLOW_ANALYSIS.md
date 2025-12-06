# 🔍 Grooming Flow Enhancement - Analysis & Implementation Plan

## Current State Analysis

### ✅ **Existing Components**
1. **GroomingServiceRouter.tsx** - Main router (landing, center, home views)
2. **GroomingServicesLanding.tsx** - Current landing page (needs enhancement)
3. **GroomingCenterListView.tsx** - Center listings (exists)
4. **GroomingCenterProfileView.tsx** - Center details (exists)
5. **GroomingAtHome.tsx** - At-home service (exists)
6. **GroomingCenterVisit.tsx** - Center booking (exists)

### ✅ **Existing Backend APIs**
1. **GET /customer/services?roleId=pet_groomer** - Get grooming services
2. **Booking Creation** - `/supabase/functions/server/booking-creation.tsx`
3. **Booking Lifecycle** - `/supabase/functions/server/booking-lifecycle.tsx`
4. **Vendor Availability** - Slot checking with V2 system
5. **OTP System** - Service completion verification

### ❌ **Missing Components (Need to Build)**
1. **Enhanced Grooming Dashboard** - New design with 2 main cards
2. **Service/Package Selection** - Detailed service picker
3. **Time Slot Selection** - Visual slot picker
4. **Pet Selection** - Choose from saved pets
5. **Address Selection** - For home services
6. **Payment Page** - Razorpay integration with wallet/coupons
7. **Booking Confirmation** - Success screen
8. **OTP Verification Flow** - Customer enters OTP

### ❌ **Missing Backend APIs (Need to Build)**
1. **GET /grooming/slots** - Available time slots for vendor
2. **POST /payment/razorpay/order** - Create Razorpay order
3. **POST /payment/verify** - Verify payment
4. **GET /customer/wallet** - Wallet balance
5. **POST /customer/wallet/use** - Deduct from wallet
6. **POST /coupon/apply** - Apply coupon code
7. **GET /customer/pets/:phone** - Get user's pets
8. **POST /booking/otp/generate** - Generate service OTP
9. **POST /booking/otp/verify** - Verify service completion OTP

---

## 🎯 **New Flow Requirements**

### 1. **Grooming Dashboard (Enhanced Landing)**
**Current**: Simple landing with service types
**New**: 
- Two large main cards (At Home vs Center)
- Horizontal offer banners
- Pet-specific recommendations
- Popular packages section
- Seasonal offers display

**Changes Needed**: 
- ✅ Keep existing GroomingServicesLanding
- ✅ Enhance UI with new design philosophy
- ✅ Add pet recommendations (fetch user's pets)
- ✅ Add popular packages section
- ✅ Add offer banners

---

### 2. **Grooming Center Booking Flow**

#### 2.1 **Centers Listing (Enhance Existing)**
**File**: `GroomingCenterListView.tsx`
**Current**: Basic center list
**New Features**:
- ✅ Search bar (center name/area)
- ✅ Filters: Distance, Rating, Price, Services, Instant Booking
- ✅ Sorting: Nearest, Top Rated, Best Price
- ✅ Map View / List View toggle
- ✅ Enhanced center cards with tags

**API**: Existing `/customer/services?roleId=pet_groomer&serviceStyle=at_center`

---

#### 2.2 **Center Profile (Enhance Existing)**
**File**: `GroomingCenterProfileView.tsx`
**Current**: Basic profile
**New Features**:
- ✅ Image carousel
- ✅ Amenities section (AC, CCTV, pet-safe products, etc.)
- ✅ Opening hours
- ✅ Reviews & photos
- ✅ Service & package list

**API**: Existing vendor details

---

#### 2.3 **Select Service/Package (NEW)**
**File**: `grooming/ServicePackageSelector.tsx` (NEW)
**Features**:
- Service list with duration, price
- "What's included" expandable
- Add-ons available
- Package bundles
- Book Now button

**API**: Existing services from vendor

---

#### 2.4 **Time Slot Selection (NEW)**
**File**: `grooming/TimeSlotSelector.tsx` (NEW)
**Features**:
- Visual calendar
- Morning/Afternoon/Evening slots
- Real-time availability check
- Slot capacity display
- Lead time enforcement

**API Needed**: 
```
GET /grooming/slots/:vendorId/:date
Response: { slots: [{ time, available, capacity }] }
```

---

#### 2.5 **Pet Selection (NEW)**
**File**: `grooming/PetSelector.tsx` (NEW)
**Features**:
- Display all saved pets
- Pet card with photo, name, breed, age
- "Add New Pet" option
- Select pet for booking

**API**: 
```
GET /customer/pets/:phone
Response: { pets: [...] }
```

---

#### 2.6 **Payment Page (NEW)**
**File**: `grooming/PaymentPage.tsx` (NEW)
**Features**:
- Service price breakdown
- Add-ons pricing
- GST calculation
- Offer section with suggestions
- Coupon input
- Wallet toggle (show balance)
- Razorpay payment options (UPI, Cards, Net Banking, Wallets)
- Dynamic total calculation

**APIs Needed**:
```
POST /payment/razorpay/create-order
GET /customer/wallet/:phone
POST /coupon/apply
POST /payment/verify
```

---

#### 2.7 **Booking Confirmation (NEW)**
**File**: `grooming/BookingConfirmation.tsx` (NEW)
**Features**:
- Booking ID display
- Center/Groomer details
- Date & Time
- Service selected
- Pet selected
- Payment summary
- Add to Calendar button
- View Booking button

**API**: Booking creation response

---

#### 2.8 **OTP Verification (NEW)**
**File**: `grooming/OTPVerification.tsx` (NEW)
**Features**:
- Show 4-digit OTP to customer
- Display in booking details
- SMS notification
- Push notification
- Groomer enters on vendor app
- Service completion trigger

**APIs Needed**:
```
POST /booking/:bookingId/generate-otp
POST /booking/:bookingId/verify-otp
```

---

### 3. **Grooming at Home Flow**

#### 3.1 **Home Services Listing (Enhance)**
**File**: `GroomingAtHome.tsx`
**Current**: Basic service list
**New Features**:
- ✅ Horizontal category tabs (Bath, Full Groom, Tick & Flea, Nail Trim, Haircut, Add-Ons)
- ✅ Service cards with price, duration, requirements
- ✅ Photo for each service
- ✅ Book button

**API**: Existing `/customer/services?roleId=pet_groomer&serviceStyle=at_home`

---

#### 3.2 **Service Details (NEW)**
**File**: `grooming/ServiceDetails.tsx` (NEW)
**Features**:
- Description
- What's included
- Groomer arrival ETA
- Tools used
- Safety protocols
- Cancellation policy
- Book Appointment button

---

#### 3.3 **Time Slot (Reuse)**
Same as center booking slot selector

---

#### 3.4 **Pet Selection (Reuse)**
Same as center booking pet selector

---

#### 3.5 **Address Selection (NEW)**
**File**: `grooming/AddressSelector.tsx` (NEW)
**Features**:
- Display saved addresses
- Add new address form
- Map location picker
- Set as default option

**API**: 
```
GET /customer/addresses/:phone
POST /customer/addresses
```

---

#### 3.6 **Payment (Reuse)**
Same payment page as center booking

---

#### 3.7 **Booking History Integration**
Bookings appear in:
- User Profile → My Bookings
- Pet Profile → Pet Bookings
Tag: "Home Service" vs "Center Visit"

---

#### 3.8 **OTP Flow (Reuse)**
Same OTP verification for home services

---

## 📋 **Implementation Checklist**

### Phase 1: Dashboard Enhancement ✅
- [ ] Enhance GroomingServicesLanding with new design
- [ ] Add pet recommendations section
- [ ] Add popular packages section
- [ ] Add offer banners carousel
- [ ] Two main cards (At Home vs Center)

### Phase 2: Center Flow Components 🔨
- [ ] Enhance GroomingCenterListView (filters, search, map view)
- [ ] Enhance GroomingCenterProfileView (amenities, reviews, hours)
- [ ] Create ServicePackageSelector.tsx
- [ ] Create TimeSlotSelector.tsx
- [ ] Create PetSelector.tsx
- [ ] Create AddressSelector.tsx
- [ ] Create PaymentPage.tsx
- [ ] Create BookingConfirmation.tsx
- [ ] Create OTPVerification.tsx

### Phase 3: Home Flow Components 🔨
- [ ] Enhance GroomingAtHome (category tabs)
- [ ] Create ServiceDetails.tsx
- [ ] Reuse TimeSlotSelector
- [ ] Reuse PetSelector
- [ ] Use AddressSelector
- [ ] Reuse PaymentPage
- [ ] Reuse BookingConfirmation
- [ ] Reuse OTPVerification

### Phase 4: Backend APIs 🔧
- [ ] Create slot availability endpoint
- [ ] Create Razorpay integration endpoints
- [ ] Create wallet endpoints
- [ ] Create coupon application endpoint
- [ ] Create address management endpoints
- [ ] Create OTP generation/verification endpoints
- [ ] Enhance booking creation for grooming-specific fields

### Phase 5: Router Updates 🔀
- [ ] Update GroomingServiceRouter with new screens
- [ ] Add navigation flows
- [ ] Handle back navigation properly
- [ ] State management for booking flow

### Phase 6: Testing 🧪
- [ ] Test center booking flow end-to-end
- [ ] Test home service flow end-to-end
- [ ] Test payment integration
- [ ] Test OTP verification
- [ ] Test wallet integration
- [ ] Test coupon application
- [ ] Regression test existing flows

---

## 🎨 **Design Philosophy Preservation**

### Colors to Maintain:
- **Primary Orange**: `#FF8C42`
- **Gradients**: Orange gradient headers
- **Card Backgrounds**: White with subtle shadows
- **Text**: Gray scale hierarchy

### UI Patterns to Follow:
- Concave bottom curve on headers
- Card-based layouts
- Stats display (3-column grid)
- Spotlight offers carousel
- Mobile-first (max-width: 430px)
- Consistent spacing and padding

---

## 🚨 **Critical Questions Before Implementation**

### 1. **Razorpay Integration**
- Do we have Razorpay API keys configured?
- Should I create mock payment for now?

### 2. **Wallet System**
- Is wallet balance stored in customer profile?
- Is there a separate wallet transaction table?

### 3. **Coupon System**
- Are coupons pre-configured in admin?
- What's the coupon validation logic?

### 4. **Address Management**
- Where are customer addresses stored?
- Can customers have multiple addresses?

### 5. **Pet Data**
- Current pet storage location?
- Can I fetch from existing `/customer/pets/:phone`?

### 6. **OTP System**
- Should OTP be 4-digit random?
- Store in booking object?
- Send via SMS? (Do we have SMS gateway?)

---

**Status**: Analysis Complete - Ready for Implementation
**Next Step**: Answer critical questions, then build components systematically
