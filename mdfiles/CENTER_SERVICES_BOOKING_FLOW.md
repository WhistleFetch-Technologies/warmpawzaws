# Center Services Booking Flow
## Customer App - At Center/Clinic Booking Experience

**Date:** 2026-01-28  
**Version:** 1.0  
**Status:** Design Specification  
**Service Style:** `at_center`

---

## 📋 Table of Contents

1. [Flow Overview](#flow-overview)
2. [Step-by-Step Flow](#step-by-step-flow)
3. [Screen Specifications](#screen-specifications)
4. [API Endpoints](#api-endpoints)
5. [UI/UX Requirements](#uiux-requirements)
6. [Data Models](#data-models)
7. [Error Handling](#error-handling)
8. [Edge Cases](#edge-cases)

---

## 🎯 Flow Overview

### Entry Point
**Where:** Customer Home Screen → Service Card Click  
**Component:** `CustomerHomeComplete.tsx` → `UnifiedBookingEngine.tsx`  
**Initial State:** User selects "At Center/Clinic" option

### Flow Steps (Minimum: 5 Steps)
1. **Service Selection** → Choose service category (Vet, Grooming, etc.)
2. **Service Style Selection** → Select "At Center/Clinic"
3. **Provider Discovery** → Browse centers/clinics with filters
4. **Provider Profile & Service Selection** → View details, select service
5. **Scheduling** → Select date, time, pet
6. **Payment** → Checkout and confirmation

### Success Criteria
- ✅ Booking created with status `pending`
- ✅ Payment processed (or deferred for subscription)
- ✅ OTP generated for booking completion
- ✅ Confirmation screen shown with booking details
- ✅ Booking visible in "My Bookings" section

---

## 📱 Step-by-Step Flow

### Step 1: Service Selection Screen

**Screen Name:** Service Category Selection  
**Component:** `ServiceCategorySelector.tsx` or `CustomerHomeComplete.tsx`  
**Purpose:** User selects the type of service they need

**UI Elements:**
- Service cards with icons and descriptions
- Categories: Vet, Grooming, Boarding, Shopping, etc.
- Search bar for quick access
- Problem Grid shortcut

**User Action:** Click on service card (e.g., "Veterinary Services")

**Why Click Here:**
- Clear visual categorization
- Shows service availability
- Quick access to popular services

**Data Displayed:**
- Service name
- Service icon
- Service description
- Number of available providers (optional)

**Navigation:** → Service Style Selection Screen

**Endpoint:** `GET /customer/services/categories`

**Result:** Service category selected, user proceeds to style selection

---

### Step 2: Service Style Selection Screen

**Screen Name:** Service Style Selection  
**Component:** `ServiceStyleSelector.tsx` or `UnifiedBookingEngine.tsx`  
**Purpose:** User chooses how they want the service (At Center, At Home, Tele)

**UI Elements:**
- Three option cards:
  - 🏥 **At Center/Clinic** (selected for this flow)
  - 🏠 At Home
  - 📹 Video Call
- Description for each option
- Price range indicator (if different)
- "Why choose this?" information

**User Action:** Click "At Center/Clinic" card

**Why Click Here:**
- Clear visual distinction between options
- Shows benefits (e.g., "Full facility access", "Emergency services available")
- Price comparison if applicable

**Data Displayed:**
- Service style name
- Icon and description
- Average price range
- Availability indicator

**Navigation:** → Provider Discovery Screen

**Endpoint:** `GET /customer/services/{serviceId}/styles`

**Result:** Service style `at_center` selected

---

### Step 3: Provider Discovery Screen

**Screen Name:** Center/Clinic Listing  
**Component:** `ServiceDiscovery.tsx` or `VetServicesByStyle.tsx`  
**Purpose:** Browse and filter available centers/clinics

**UI Elements:**

**Header:**
- Back button
- Title: "Vet Clinics" (or service-specific)
- Filter button (with badge if filters active)
- Sort dropdown

**Filters Panel (Expandable):**
- **Distance:** Slider (0-50km) or quick options (5km, 10km, 20km)
- **Rating:** Minimum rating (3.0, 3.5, 4.0, 4.5+)
- **Price Range:** Min-Max slider
- **Availability:** Today, This Week, Next Available Slot
- **Amenities:** Checkboxes (Parking, Emergency, Lab, etc.)
- **Specializations:** Tags (Surgery, Dentistry, etc.)
- **Apply Filters** button

**Provider Cards:**
Each card shows:
- Center/clinic photo (or default icon)
- Center name
- Rating (stars + number of reviews)
- Distance from user location
- Specializations (tags)
- Amenities (icons)
- Next available slot
- Price range or "From ₹XXX"
- "View Profile" button

**User Actions:**
- Scroll to browse providers
- Click filter button → Apply filters
- Click sort dropdown → Select sort option
- Click provider card → View provider profile

**Why Click Provider Card:**
- See full center details
- View all available services
- Check availability calendar
- Read reviews

**Data Required:**
- User location (lat, lng)
- Service category
- Service style (`at_center`)
- Applied filters

**Navigation:** → Provider Profile Screen

**Endpoint:** `GET /customer/services/search?style=at_center&lat={lat}&lng={lng}&category={category}&filters={filters}`

**Response Structure:**
```typescript
{
  providers: [
    {
      id: string;
      type: 'vendor';
      vendorId: string;
      name: string;
      photo?: string;
      rating: number;
      reviewCount: number;
      distance: number;
      distanceFormatted: string;
      specializations: string[];
      amenities: string[];
      nextAvailable?: string;
      priceRange: { min: number; max: number };
      services: Service[];
    }
  ];
  totalCount: number;
  hasMore: boolean;
}
```

**Result:** Provider selected, user proceeds to profile view

---

### Step 4: Provider Profile & Service Selection Screen

**Screen Name:** Center/Clinic Profile  
**Component:** `VetDoctorDetails.tsx` or `ProviderProfileView.tsx`  
**Purpose:** View complete provider details and select specific service

**UI Elements:**

**Header:**
- Back button
- Share button
- Favorite button (if logged in)

**Profile Section:**
- Large center photo (carousel if multiple)
- Center name
- Rating and review count
- Distance and address
- "Get Directions" button
- "Call" button

**Tabs:**
1. **Overview** (default)
   - Description
   - Specializations
   - Amenities list with icons
   - Operating hours
   - Location map preview
2. **Services**
   - List of available services
   - Service cards with:
     - Service name
     - Description
     - Duration
     - Price
     - "Select" button
3. **Reviews**
   - Review cards with:
     - User name (masked)
     - Rating
     - Review text
     - Date
     - Photos (if any)
4. **Photos**
   - Gallery of center photos

**Service Selection:**
- Service cards in "Services" tab
- Each service shows:
  - Service name
  - Description
  - Duration (e.g., "30 min")
  - Price (or price range)
  - Available time slots preview
  - "Book This Service" button

**User Actions:**
- Browse tabs
- Click "Book This Service" on a service card
- View reviews
- Check photos
- Get directions
- Call center

**Why Click "Book This Service":**
- Proceeds to scheduling
- Pre-selects service for booking

**Data Required:**
- Vendor ID
- Service ID (if pre-selected)

**Navigation:** → Scheduling Screen

**Endpoint:** `GET /vendor/{vendorId}/profile`  
**Endpoint:** `GET /vendor/{vendorId}/services`  
**Endpoint:** `GET /vendor/{vendorId}/reviews`

**Result:** Service selected, user proceeds to scheduling

---

### Step 5: Scheduling Screen

**Screen Name:** Select Date & Time  
**Component:** `SchedulingSelector.tsx` or `BookingFlow.tsx`  
**Purpose:** Choose appointment date, time, and pet

**UI Elements:**

**Progress Indicator:**
- Step 1: Service ✓
- Step 2: Provider ✓
- Step 3: Schedule (current)
- Step 4: Payment

**Date Selection:**
- Calendar view
- Available dates highlighted
- Unavailable dates grayed out
- Today's date marked
- "Next Available" badge on earliest date

**Time Selection:**
- Time slots grid
- Available slots: Enabled, clickable
- Unavailable slots: Disabled, grayed out
- Selected slot: Highlighted with checkmark
- Shows "Morning", "Afternoon", "Evening" sections

**Pet Selection:**
- List of user's pets
- Pet cards with:
  - Pet photo
  - Pet name
  - Pet type/breed
  - Age
  - "Select" button
- "Add New Pet" button

**Additional Options:**
- Notes field (optional)
- Special requests (optional)

**User Actions:**
- Select date from calendar
- Select time slot
- Select pet
- Add notes (optional)
- Click "Continue to Payment"

**Why Click "Continue to Payment":**
- All required information collected
- Ready to proceed to checkout

**Validation:**
- Date must be selected
- Time slot must be selected
- Pet must be selected
- Date/time must be in the future
- Slot must be available

**Data Required:**
- Vendor ID
- Service ID
- Selected date
- Selected time
- Pet ID
- Notes (optional)

**Navigation:** → Payment Screen

**Endpoint:** `GET /vendor/{vendorId}/availability?serviceId={serviceId}&date={date}`

**Response Structure:**
```typescript
{
  availableSlots: [
    {
      date: string; // YYYY-MM-DD
      timeSlots: [
        {
          time: string; // HH:MM
          available: boolean;
          staffId?: string;
        }
      ];
    }
  ];
  nextAvailableDate?: string;
}
```

**Result:** Date, time, and pet selected

---

### Step 6: Payment & Checkout Screen

**Screen Name:** Payment & Checkout  
**Component:** `UniversalPaymentPage.tsx`  
**Purpose:** Review booking details, apply discounts, make payment

**UI Elements:**

**Booking Summary:**
- Service name
- Provider name
- Date and time
- Pet name
- Location address

**Price Breakdown:**
- Service price: ₹XXX
- Platform fee: ₹XX
- Convenience fee: ₹XX (if applicable)
- GST: ₹XX
- Discounts: -₹XX (if any)
- **Total: ₹XXX**

**Payment Options:**
- Wallet balance (if available)
- Razorpay (Credit/Debit, UPI, Net Banking)
- Saved cards (if any)

**Promotions:**
- Applicable coupons
- "Apply Coupon" input
- Platform discounts (auto-applied)

**User Actions:**
- Review booking details
- Apply coupon code
- Select payment method
- Enter payment details
- Click "Pay Now" or "Confirm Booking" (if subscription)

**Why Click "Pay Now":**
- Completes booking
- Processes payment
- Generates booking confirmation

**Validation:**
- Payment amount > 0 (or subscription active)
- Payment method selected
- Payment details valid

**Data Required:**
- Booking details (from previous steps)
- Payment method
- Coupon code (optional)
- Wallet usage (optional)

**Navigation:** → Booking Confirmation Screen

**Endpoint:** `POST /bookings/create` (creates booking)  
**Endpoint:** `POST /razorpay/orders/create` (creates payment order)  
**Endpoint:** `POST /razorpay/payments/verify` (verifies payment)

**Result:** Payment processed, booking confirmed

---

### Step 7: Booking Confirmation Screen

**Screen Name:** Booking Confirmed  
**Component:** `BookingConfirmationScreen.tsx`  
**Purpose:** Show booking success and next steps

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
- Location address
- **OTP Code** (large, prominent, copy button)

**Actions:**
- "View Booking" button
- "Add to Calendar" button
- "Share Booking" button
- "Back to Home" button

**Important Information:**
- "Please share OTP with provider on arrival"
- Cancellation policy link
- Rescheduling instructions

**User Actions:**
- Copy OTP
- View booking details
- Add to calendar
- Share booking
- Return to home

**Why Click "View Booking":**
- See full booking details
- Access chat with provider
- Track booking status

**Data Displayed:**
- Booking ID
- OTP code
- All booking details
- Provider contact info

**Navigation:** → Booking Details Screen or Home Screen

**Endpoint:** `GET /bookings/{bookingId}`

**Result:** Booking confirmed, user can track booking

---

## 🎨 UI/UX Requirements

### Design Principles
1. **Clarity:** Each screen has a single, clear purpose
2. **Progression:** Progress indicator shows current step
3. **Feedback:** Loading states, success messages, error handling
4. **Consistency:** Same UI patterns across all flows
5. **Accessibility:** Keyboard navigation, screen reader support

### Screen Layout
- **Container:** `max-w-[430px] mx-auto` (mobile-first)
- **Padding:** `p-4` to `p-6`
- **Spacing:** Consistent gaps between elements

### Loading States
- Skeleton screens for data loading
- Spinner for actions
- Progress bars for multi-step processes

### Error States
- Clear error messages
- Retry buttons
- Fallback options

### Success States
- Confirmation animations
- Success messages
- Next action prompts

---

## 📊 Data Models

### Service Provider (Center)
```typescript
interface CenterProvider {
  id: string;
  type: 'vendor';
  vendorId: string;
  name: string;
  photo?: string;
  rating: number;
  reviewCount: number;
  distance: number;
  distanceFormatted: string;
  address: {
    line1: string;
    city: string;
    state: string;
    pincode: string;
    coordinates: { lat: number; lng: number };
  };
  specializations: string[];
  amenities: string[];
  operatingHours: {
    [day: string]: { open: string; close: string; closed?: boolean };
  };
  nextAvailable?: string;
  priceRange: { min: number; max: number };
  services: Service[];
}
```

### Service
```typescript
interface Service {
  id: string;
  name: string;
  description: string;
  duration: number; // minutes
  price: number;
  priceFormatted: string;
  category: string;
  available: boolean;
}
```

### Booking Request
```typescript
interface BookingRequest {
  customerId: string;
  vendorId: string;
  serviceId: string;
  serviceType: 'at_center';
  bookingDate: string; // YYYY-MM-DD
  bookingTime: string; // HH:MM
  petId: string;
  amount: number;
  notes?: string;
  couponCode?: string;
  useWallet?: boolean;
}
```

### Booking Response
```typescript
interface BookingResponse {
  bookingId: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  otpCode: string;
  booking: Booking;
  payment?: PaymentDetails;
}
```

---

## 🔌 API Endpoints

### Service Discovery
- **GET** `/customer/services/search?style=at_center&lat={lat}&lng={lng}&category={category}&filters={filters}`
  - Returns: List of center providers
  - Filters: distance, rating, price, availability, amenities, specializations

### Provider Profile
- **GET** `/vendor/{vendorId}/profile`
  - Returns: Complete vendor profile
- **GET** `/vendor/{vendorId}/services`
  - Returns: List of services offered
- **GET** `/vendor/{vendorId}/reviews`
  - Returns: Reviews and ratings

### Availability
- **GET** `/vendor/{vendorId}/availability?serviceId={serviceId}&date={date}`
  - Returns: Available time slots for date

### Booking Creation
- **POST** `/bookings/create`
  - Body: `BookingRequest`
  - Returns: `BookingResponse`

### Payment
- **POST** `/razorpay/orders/create`
  - Body: `{ bookingId, amount }`
  - Returns: Razorpay order details
- **POST** `/razorpay/payments/verify`
  - Body: `{ paymentId, orderId, signature }`
  - Returns: Payment verification result

---

## ⚠️ Error Handling

### Common Errors

1. **No Providers Found**
   - Show: "No centers found. Try adjusting filters."
   - Action: "Clear Filters" button

2. **Slot Not Available**
   - Show: "This slot is no longer available"
   - Action: "Select Another Slot" button

3. **Payment Failed**
   - Show: "Payment failed. Please try again."
   - Action: "Retry Payment" button

4. **Network Error**
   - Show: "Connection error. Please check your internet."
   - Action: "Retry" button

---

## 🔀 Edge Cases

1. **Multiple Services Selection**
   - Allow user to book multiple services in one booking
   - Show combined price
   - Handle different durations

2. **Package/Subscription**
   - Check for active subscription
   - Set payment amount to 0
   - Track package usage

3. **Rescheduling**
   - Allow rescheduling before appointment
   - Apply rescheduling policy
   - Update booking date/time

4. **Cancellation**
   - Show cancellation policy
   - Calculate refund amount
   - Process cancellation

---

## 📱 Reference Design

### Similar Apps
- **Practo:** Center booking flow
- **1mg:** Clinic appointment booking
- **Urban Company:** Service center booking

### Design Patterns
- Card-based provider listing
- Calendar-based scheduling
- Step-by-step progress indicator
- Inline filters

---

**Document Status:** ✅ Complete  
**Last Updated:** 2026-01-28  
**Next:** [Home Services Booking Flow](./HOME_SERVICES_BOOKING_FLOW.md)
