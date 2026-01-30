# Home Services Booking Flow
## Customer App - At Home Service Booking Experience

**Date:** 2026-01-28  
**Version:** 1.0  
**Status:** Design Specification  
**Service Style:** `at_home`

---

## 📋 Table of Contents

1. [Flow Overview](#flow-overview)
2. [Step-by-Step Flow](#step-by-step-flow)
3. [Screen Specifications](#screen-specifications)
4. [API Endpoints](#api-endpoints)
5. [UI/UX Requirements](#uiux-requirements)
6. [GPS Tracking Integration](#gps-tracking-integration)
7. [Data Models](#data-models)
8. [Error Handling](#error-handling)

---

## 🎯 Flow Overview

### Entry Point
**Where:** Customer Home Screen → Service Card → "At Home" option  
**Component:** `CustomerHomeComplete.tsx` → `HomeServiceRouter.tsx`  
**Initial State:** User selects "At Home" service style

### Flow Steps (Minimum: 6 Steps)
1. **Service Selection** → Choose service category
2. **Service Style Selection** → Select "At Home"
3. **Provider Discovery** → Browse staff/solo providers (filtered by problems, distance, availability)
4. **Provider Profile & Service Selection** → View provider details, select service
5. **Scheduling & Address** → Select date, time, pet, and service address
6. **Payment** → Checkout and confirmation
7. **Tracking Setup** → GPS tracking enabled for service delivery

### Key Differences from Center Flow
- ✅ Shows **staff and solo providers only** (not centers)
- ✅ **Address selection required** (service location)
- ✅ **GPS tracking enabled** (real-time location updates)
- ✅ **ETA calculation** (estimated arrival time)
- ✅ **Problem-based filtering** (filter by specific problems/needs)
- ✅ **Next available slot** prominently displayed

### Success Criteria
- ✅ Booking created with status `pending`
- ✅ Address validated and saved
- ✅ GPS tracking session initialized
- ✅ Payment processed
- ✅ OTP generated
- ✅ Customer notified when vendor starts service

---

## 📱 Step-by-Step Flow

### Step 1: Service Selection Screen

**Screen Name:** Service Category Selection  
**Component:** `ServiceCategorySelector.tsx` or `CustomerHomeComplete.tsx`  
**Purpose:** User selects the type of home service needed

**UI Elements:**
- Service cards with home service icons
- Categories: Vet Home Visit, Home Grooming, Pet Walking, etc.
- Problem Grid integration
- "Popular Home Services" section

**User Action:** Click on service card (e.g., "Home Vet Visit")

**Why Click Here:**
- Clear indication of home service availability
- Shows service benefits (convenience, pet comfort)
- Quick access to frequently used services

**Data Displayed:**
- Service name
- Service icon
- "At Home" badge
- Average price range
- Estimated duration

**Navigation:** → Service Style Selection Screen

**Endpoint:** `GET /customer/services/categories?style=at_home`

**Result:** Service category selected

---

### Step 2: Service Style Selection Screen

**Screen Name:** Service Style Selection  
**Component:** `ServiceStyleSelector.tsx` or `HomeServiceRouter.tsx`  
**Purpose:** User confirms "At Home" selection

**UI Elements:**
- Three option cards (same as center flow)
- **At Home** card highlighted/selected
- Benefits listed:
  - "Service at your doorstep"
  - "No travel required"
  - "Comfortable for your pet"
- Price comparison

**User Action:** Click "At Home" card (or proceed if pre-selected)

**Why Click Here:**
- Confirms service delivery method
- Shows advantages of home service
- Sets expectations (provider will visit)

**Data Displayed:**
- Service style name
- Icon and description
- Price range
- Availability indicator

**Navigation:** → Provider Discovery Screen

**Endpoint:** `GET /customer/services/{serviceId}/styles`

**Result:** Service style `at_home` confirmed

---

### Step 3: Provider Discovery Screen

**Screen Name:** Home Service Providers  
**Component:** `ServiceDiscovery.tsx` or `HomeServiceRouter.tsx`  
**Purpose:** Browse available staff/solo providers for home visits

**UI Elements:**

**Header:**
- Back button
- Title: "Home Service Providers"
- Filter button (with active filter count badge)
- Sort dropdown

**Problem Filter (Prominent):**
- "What do you need?" section
- Problem chips/tags (e.g., "Vaccination", "Checkup", "Grooming")
- Selected problems highlighted
- "Clear" button

**Filters Panel (Expandable):**
- **Problems:** Multi-select tags (service-specific)
- **Distance:** Slider (0-50km) or quick options
- **Rating:** Minimum rating selector
- **Price Range:** Min-Max slider
- **Next Available Slot:** Today, Tomorrow, This Week
- **Experience:** Years of experience filter
- **Specializations:** Tags
- **Apply Filters** button

**Provider Cards:**
Each card shows:
- Provider photo (staff/solo)
- Provider name
- Rating (stars + review count)
- Distance from user location
- **Next Available Slot** (prominent)
- **ETA** (estimated arrival time)
- Specializations (tags)
- Experience (e.g., "5+ years")
- Price (consultation fee)
- "View Profile" button

**Key Visual Differences:**
- Shows **staff/solo providers only** (not centers)
- **Next Available Slot** prominently displayed
- **ETA** shown for each provider
- **Problem tags** visible on cards

**User Actions:**
- Select problem tags
- Apply filters
- Sort providers
- Click provider card → View profile

**Why Click Provider Card:**
- See provider's full profile
- Check availability calendar
- View reviews
- See specializations

**Data Required:**
- User location (lat, lng)
- Service category
- Service style (`at_home`)
- Selected problems (if any)
- Applied filters

**Navigation:** → Provider Profile Screen

**Endpoint:** `GET /customer/services/search?style=at_home&lat={lat}&lng={lng}&category={category}&problems={problems}&filters={filters}`

**Response Structure:**
```typescript
{
  providers: [
    {
      id: string;
      type: 'staff' | 'solo';
      vendorId: string;
      staffId?: string;
      name: string;
      photo?: string;
      rating: number;
      reviewCount: number;
      distance: number;
      distanceFormatted: string;
      nextAvailable: string; // "Today 2 PM" or "Tomorrow 10 AM"
      eta: number; // minutes
      specializations: string[];
      experience: string;
      price: number;
      priceFormatted: string;
      services: Service[];
      isInstantAvailable?: boolean;
    }
  ];
  totalCount: number;
  hasMore: boolean;
}
```

**Result:** Provider selected

---

### Step 4: Provider Profile & Service Selection Screen

**Screen Name:** Provider Profile  
**Component:** `ProviderProfileView.tsx` or `HomeServiceRouter.tsx`  
**Purpose:** View provider details and select service

**UI Elements:**

**Header:**
- Back button
- Share button
- Favorite button

**Profile Section:**
- Large provider photo
- Provider name
- Rating and review count
- Distance and **ETA**
- **Next Available Slot** (prominent badge)
- "Call" button
- "Message" button

**Tabs:**
1. **Overview**
   - Description
   - Experience
   - Specializations
   - Certifications
   - Languages spoken
2. **Services**
   - List of home services offered
   - Service cards with:
     - Service name
     - Description
     - Duration
     - Price
     - "Book This Service" button
3. **Availability**
   - Calendar view
   - Available time slots
   - "Book Slot" button
4. **Reviews**
   - Review cards
   - Photos from previous visits

**Service Selection:**
- Service cards in "Services" tab
- Each shows:
  - Service name
  - Description
  - Duration
  - Price
  - "Book This Service" button

**User Actions:**
- Browse tabs
- Click "Book This Service"
- View availability
- Read reviews
- Contact provider

**Why Click "Book This Service":**
- Proceeds to scheduling
- Pre-selects service

**Data Required:**
- Vendor ID or Staff ID
- Service ID

**Navigation:** → Scheduling & Address Screen

**Endpoint:** `GET /staff/{staffId}/profile` or `GET /vendor/{vendorId}/profile`  
**Endpoint:** `GET /staff/{staffId}/services` or `GET /vendor/{vendorId}/services`

**Result:** Service selected

---

### Step 5: Scheduling & Address Selection Screen

**Screen Name:** Select Date, Time, Pet & Address  
**Component:** `SchedulingSelector.tsx` + `AddressSelector.tsx`  
**Purpose:** Choose appointment details and service location

**UI Elements:**

**Progress Indicator:**
- Step 1: Service ✓
- Step 2: Provider ✓
- Step 3: Schedule & Address (current)
- Step 4: Payment

**Date Selection:**
- Calendar view
- Available dates highlighted
- **Next Available** badge
- Unavailable dates grayed out

**Time Selection:**
- Time slots grid
- Available slots enabled
- Shows "Morning", "Afternoon", "Evening"
- **Instant Booking** option (if available)

**Pet Selection:**
- List of user's pets
- Pet cards with photo, name, type
- "Select" button
- "Add New Pet" button

**Address Selection (Required):**
- **Current Location** button (auto-fill)
- List of saved addresses
- Address cards showing:
  - Address line
  - City, State, Pincode
  - "Select" button
- **Add New Address** button
  - Opens address form with map
  - Map pin selection
  - Address validation

**Additional Options:**
- Notes field (e.g., "Gate code: 1234")
- Special instructions

**User Actions:**
- Select date
- Select time slot
- Select pet
- Select or add address
- Add notes
- Click "Continue to Payment"

**Why Click "Continue to Payment":**
- All required information collected
- Address validated
- Ready for checkout

**Validation:**
- Date selected
- Time selected
- Pet selected
- **Address selected** (required)
- Address must be within service area
- Date/time in the future

**Data Required:**
- Vendor ID or Staff ID
- Service ID
- Selected date
- Selected time
- Pet ID
- Address ID (or new address data)
- Notes (optional)

**Navigation:** → Payment Screen

**Endpoint:** `GET /staff/{staffId}/availability?serviceId={serviceId}&date={date}`  
**Endpoint:** `POST /customer/{customerId}/addresses` (if adding new address)  
**Endpoint:** `GET /customer/{customerId}/addresses`

**Result:** Date, time, pet, and address selected

---

### Step 6: Payment & Checkout Screen

**Screen Name:** Payment & Checkout  
**Component:** `UniversalPaymentPage.tsx`  
**Purpose:** Review booking and make payment

**UI Elements:**

**Booking Summary:**
- Service name
- Provider name
- Date and time
- Pet name
- **Service Address** (full address displayed)
- **Estimated Arrival Time** (ETA)

**Price Breakdown:**
- Service price: ₹XXX
- Platform fee: ₹XX
- Convenience fee: ₹XX
- **Travel fee** (if applicable): ₹XX
- GST: ₹XX
- Discounts: -₹XX
- **Total: ₹XXX**

**Payment Options:**
- Wallet balance
- Razorpay (Credit/Debit, UPI, Net Banking)
- Saved cards

**Promotions:**
- Applicable coupons
- "Apply Coupon" input

**User Actions:**
- Review booking details
- Verify address
- Apply coupon
- Select payment method
- Enter payment details
- Click "Pay Now"

**Why Click "Pay Now":**
- Completes booking
- Processes payment
- Initializes GPS tracking

**Validation:**
- Payment amount > 0
- Payment method selected
- Address validated

**Data Required:**
- Booking details
- Payment method
- Coupon code (optional)

**Navigation:** → Booking Confirmation Screen

**Endpoint:** `POST /bookings/create`  
**Endpoint:** `POST /gps-tracking/initialize` (initializes tracking session)  
**Endpoint:** `POST /razorpay/orders/create`  
**Endpoint:** `POST /razorpay/payments/verify`

**Result:** Payment processed, booking confirmed, GPS tracking initialized

---

### Step 7: Booking Confirmation Screen

**Screen Name:** Booking Confirmed  
**Component:** `BookingConfirmationScreen.tsx`  
**Purpose:** Show booking success and tracking setup

**UI Elements:**

**Success Message:**
- Large checkmark icon
- "Booking Confirmed!" heading
- Booking ID

**Booking Details Card:**
- Service name
- Provider name and photo
- Date and time
- Pet name
- **Service Address** (full address)
- **Estimated Arrival:** "Provider will arrive around [time]"
- **OTP Code** (large, prominent, copy button)

**GPS Tracking Info:**
- "You'll be notified when provider starts service"
- "Track provider location in real-time"
- "ETA updates automatically"

**Actions:**
- "View Booking" button
- "Track Provider" button (if service started)
- "Add to Calendar" button
- "Share Booking" button
- "Back to Home" button

**Important Information:**
- "Share OTP with provider on arrival"
- "You'll receive notification when provider is on the way"
- Cancellation policy link

**User Actions:**
- Copy OTP
- View booking
- Track provider (when available)
- Add to calendar
- Return to home

**Why Click "Track Provider":**
- Opens live GPS tracking
- Shows provider's current location
- Displays ETA updates

**Data Displayed:**
- Booking ID
- OTP code
- All booking details
- Provider contact info
- Tracking status

**Navigation:** → Booking Details Screen or Home Screen

**Endpoint:** `GET /bookings/{bookingId}`  
**Endpoint:** `GET /gps-tracking/booking/{bookingId}`

**Result:** Booking confirmed, tracking ready

---

## 📍 GPS Tracking Integration

### When Tracking Starts
- **Initialization:** When booking is confirmed
- **Activation:** When vendor clicks "Start Service"
- **Updates:** Real-time location updates every 5 seconds
- **Completion:** When service is completed

### Tracking UI Components

**1. Home Screen Notification (When Provider Starts)**
- **Component:** `VendorOnTheWayNotification.tsx`
- **Location:** Fixed bottom card on home screen
- **Shows:**
  - Provider name and photo
  - "Provider is on the way" message
  - Current ETA
  - "Track Location" button

**2. Live Tracking Screen**
- **Component:** `LiveTrackingWidget.tsx` or `TrackingPageClient.tsx`
- **Shows:**
  - Map with provider's current location
  - Route from provider to customer
  - ETA countdown
  - Distance remaining
  - Provider status (On the way, Arriving, Arrived)

**3. Tracking Widget (Home Screen)**
- **Component:** `OrderTrackingWidget.tsx`
- **Shows:**
  - Progress steps (On the way → Arriving → Arrived)
  - ETA
  - Map preview
  - "Track Live" button

### Tracking Endpoints
- **POST** `/gps-tracking/start` - Start tracking session
- **POST** `/gps-tracking/update` - Update location
- **GET** `/gps-tracking/booking/{bookingId}` - Get tracking status
- **GET** `/tracking/{bookingId}/eta` - Get ETA

---

## 🎨 UI/UX Requirements

### Design Principles
1. **Clarity:** Clear indication of home service
2. **Trust:** Show provider credentials and reviews
3. **Convenience:** Easy address selection
4. **Transparency:** Show ETA and tracking

### Visual Indicators
- **Home Service Badge:** Orange badge on service cards
- **Next Available Slot:** Prominent display
- **ETA:** Large, easy-to-read time
- **Address:** Full address with map preview

### Loading States
- Skeleton screens for provider listing
- Loading spinner for address validation
- Progress indicator for GPS tracking

### Error States
- "No providers available" message
- "Address out of service area" error
- "GPS tracking unavailable" fallback

---

## 📊 Data Models

### Home Service Provider
```typescript
interface HomeServiceProvider {
  id: string;
  type: 'staff' | 'solo';
  vendorId: string;
  staffId?: string;
  name: string;
  photo?: string;
  rating: number;
  reviewCount: number;
  distance: number;
  distanceFormatted: string;
  nextAvailable: string;
  eta: number; // minutes
  specializations: string[];
  experience: string;
  price: number;
  priceFormatted: string;
  services: Service[];
  isInstantAvailable?: boolean;
}
```

### Address
```typescript
interface Address {
  id: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
  landmark?: string;
  isDefault: boolean;
}
```

### Booking Request (Home Service)
```typescript
interface HomeServiceBookingRequest {
  customerId: string;
  vendorId: string;
  staffId?: string;
  serviceId: string;
  serviceType: 'at_home';
  bookingDate: string;
  bookingTime: string;
  petId: string;
  address: {
    addressLine1: string;
    city: string;
    state: string;
    pincode: string;
    latitude: number;
    longitude: number;
  };
  amount: number;
  notes?: string;
  couponCode?: string;
  useWallet?: boolean;
}
```

---

## 🔌 API Endpoints

### Provider Discovery
- **GET** `/customer/services/search?style=at_home&lat={lat}&lng={lng}&problems={problems}&filters={filters}`
  - Returns: List of home service providers (staff/solo only)

### Provider Profile
- **GET** `/staff/{staffId}/profile`
  - Returns: Staff profile details
- **GET** `/staff/{staffId}/services`
  - Returns: Services offered by staff

### Availability
- **GET** `/staff/{staffId}/availability?serviceId={serviceId}&date={date}`
  - Returns: Available time slots

### Address Management
- **GET** `/customer/{customerId}/addresses`
  - Returns: List of saved addresses
- **POST** `/customer/{customerId}/addresses`
  - Creates new address
- **PUT** `/customer/{customerId}/addresses/{addressId}`
  - Updates address

### GPS Tracking
- **POST** `/gps-tracking/start`
  - Initializes tracking session
- **POST** `/gps-tracking/update`
  - Updates provider location
- **GET** `/gps-tracking/booking/{bookingId}`
  - Gets tracking status and location
- **GET** `/tracking/{bookingId}/eta`
  - Gets ETA calculation

### Booking Creation
- **POST** `/bookings/create`
  - Body: `HomeServiceBookingRequest`
  - Returns: `BookingResponse` with tracking session ID

---

## ⚠️ Error Handling

### Common Errors

1. **No Providers Available**
   - Show: "No providers available in your area. Try expanding search radius."
   - Action: "Adjust Filters" button

2. **Address Out of Service Area**
   - Show: "This address is outside service area. Please select another address."
   - Action: "Select Different Address" button

3. **GPS Tracking Unavailable**
   - Show: "Tracking unavailable. You'll receive updates via notifications."
   - Fallback: SMS/Email notifications

4. **Provider Not Available**
   - Show: "Provider is no longer available. Please select another provider."
   - Action: "Browse Other Providers" button

---

## 🔀 Edge Cases

1. **Instant Booking**
   - Show "Instant Available" badge
   - Allow immediate booking
   - Skip scheduling step

2. **Multiple Pets**
   - Allow selecting multiple pets
   - Adjust price accordingly
   - Show all pets in booking

3. **Address Validation**
   - Validate pincode
   - Check service area coverage
   - Suggest nearby addresses if out of area

4. **Real-time Availability**
   - Refresh availability on screen focus
   - Show "Just booked" indicators
   - Handle slot conflicts

---

## 📱 Reference Design

### Similar Apps
- **Urban Company:** Home service booking with tracking
- **Swiggy/Zomato:** Delivery tracking experience
- **Practo:** Home visit booking

### Design Patterns
- Problem-based filtering
- ETA prominence
- Address selection with map
- Real-time tracking widget

---

**Document Status:** ✅ Complete  
**Last Updated:** 2026-01-28  
**Next:** [Tele Consultation Booking Flow](./TELE_CONSULTATION_BOOKING_FLOW.md)
