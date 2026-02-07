# 🎨 Figma Prompt: Universal Service Booking Flows (Customer App)
## All Service Styles: at_center, at_home, tele - Complete Flows

**Date:** January 2026  
**Focus:** Customer App Only - Universal Booking Flows for All Services  
**Reference:** UnifiedBookingEngine.tsx, HomeServiceRouter.tsx, ProblemBasedFlowRouter.tsx

---

## 📋 EXACT CODE REFERENCE

### Header (MUST MATCH EXACTLY)
Use exact header from CustomerHomeComplete.tsx (lines 913-1031)

### Footer (MUST MATCH EXACTLY)
Use StandardizedFooter.tsx

---

## 🔄 UNIVERSAL BOOKING FLOW STRUCTURE

### Flow Steps (From UnifiedBookingEngine.tsx)

**Step Sequence:**
1. Service Selection (if multiple services available)
2. Service Style Selection (if service supports multiple styles: at_center/at_home/tele)
3. Booking Type Selection (for tele: instant vs scheduled)
4. Staff Selection (if service requires staff)
5. Date & Time Selection
6. Pet Selection
7. Address Selection (if at_home or delivery)
8. Payment
9. Confirmation

**Note:** Steps may be skipped based on service configuration

---

## 📱 SCREEN: Service Style Selection

### Design Specifications

**From ProblemBasedFlowRouter.tsx (lines 80-108):**

**Header:**
- Title: "Choose Service Style" (with back button)

**Content:**
- Three large option cards:

**1. At Center Card:**
- Background: `bg-gradient-to-r from-green-50 to-emerald-50`
- Border: `border-2 border-transparent hover:border-green-400`
- Icon: `Building2` (green, 48px)
- Label: "At Clinic/Center" (for vet) or "At Center" (for others)
- Description: "Visit the service center"
- Color: `text-green-600`, `bg-green-100`

**2. At Home Card:**
- Background: `bg-gradient-to-r from-orange-50 to-amber-50`
- Border: `border-2 border-transparent hover:border-orange-400`
- Icon: `Home` (orange, 48px)
- Label: "At Home"
- Description: "Service at your doorstep"
- Color: `text-orange-600`, `bg-orange-100`

**3. Tele Card:**
- Background: `bg-gradient-to-r from-blue-50 to-indigo-50`
- Border: `border-2 border-transparent hover:border-blue-400`
- Icon: `Video` (blue, 48px)
- Label: "Video Call"
- Description: "Online consultation"
- Color: `text-blue-600`, `bg-blue-100`

**Selected State:**
- Border: Orange (`border-[#FF8C42]`)
- Background tint: Light orange
- Scale: Slightly larger

**API Contracts:**
```json
// Get Available Service Styles
{
  "endpoint": "GET /customer/services/{serviceId}/styles",
  "response": {
    "availableStyles": ["at_center", "at_home", "tele"],
    "defaultStyle": "at_center"
  }
}
```

**Navigation:**
```typescript
// After selection:
onNavigate('booking-flow', {
  serviceId: serviceId,
  serviceStyle: selectedStyle // 'at_center' | 'at_home' | 'tele'
});
```

**File Location:**
Save to: `/Users/ketan/Documents/Figma UI Customer APP/Universal Booking Flows/Service Style Selection.fig`

---

## 📱 SCREEN: At Center Booking Flow

### Design Specifications

**From VetBookingRouter.tsx & UnifiedBookingEngine.tsx:**

**Step 1: Date Selection**
- Calendar view (7 days forward)
- Date cards (horizontal scroll):
  - Day name (Mon, Tue, etc.)
  - Day number
  - Month
  - Selected: Orange background, white text
  - Available: White background, orange border
  - Unavailable: Gray, disabled

**Step 2: Time Selection**
- Time slots grid:
  - Available slots: White, orange border, clickable
  - Selected slot: Orange background, white text
  - Unavailable slots: Gray, disabled
- Time format: "09:00", "09:30", etc.

**Step 3: Pet Selection**
- Pet cards (horizontal scroll or grid):
  - Photo (circular, 80px) or icon placeholder
  - Name (bold)
  - Type/Breed (small text)
  - Selected: Orange border (2px)
  - "Add Pet" button (dashed border)

**Step 4: Booking Summary**
- Service details card:
  - Service name
  - Date & time
  - Pet name
  - Price breakdown
- "Confirm Booking" button (orange gradient, full width)

**API Contracts:**
```json
// Get Time Slots
{
  "endpoint": "GET /customer/vendor/{vendorId}/available-slots?date={YYYY-MM-DD}&serviceStyle=at_center",
  "response": {
    "slots": [
      { "time": "09:00", "available": true },
      { "time": "09:30", "available": true }
    ]
  }
}

// Create Booking
{
  "endpoint": "POST /bookings/create",
  "body": {
    "customerId": "uuid",
    "vendorId": "uuid",
    "serviceId": "uuid",
    "bookingDate": "YYYY-MM-DD",
    "bookingTime": "HH:MM",
    "serviceType": "at_center",
    "petId": "uuid",
    "amount": number
  }
}
```

**Navigation:**
```typescript
// After booking creation:
onNavigate('payment', { bookingId: response.bookingId });
```

**File Location:**
Save to: `/Users/ketan/Documents/Figma UI Customer APP/Universal Booking Flows/At Center Booking Flow.fig`

---

## 📱 SCREEN: At Home Booking Flow

### Design Specifications

**From HomeServiceRouter.tsx:**

**Additional Step: Address Selection**

**Address Selection Screen:**
- Header: "Select Address" (with back button)
- Saved addresses (list):
  - Address card:
    - Address line 1 (bold)
    - Address line 2 (city, pincode)
    - "Default" badge (if default)
    - "Select" button or clickable card
- "Add New Address" button (dashed border)
- "Use Current Location" button (orange gradient)

**Address Input Modal:**
- Fields:
  - Address line 1
  - Address line 2
  - City
  - State
  - Pincode
  - Landmark (optional)
- Map preview (optional, small)
- "Save Address" button

**API Contracts:**
```json
// Get Customer Addresses
{
  "endpoint": "GET /customer/{customerId}/addresses",
  "response": {
    "addresses": [
      {
        "id": "uuid",
        "addressLine1": "string",
        "addressLine2": "string",
        "city": "string",
        "state": "string",
        "pincode": "string",
        "latitude": number,
        "longitude": number,
        "isDefault": boolean
      }
    ]
  }
}

// Create Home Visit Booking
{
  "endpoint": "POST /bookings/create",
  "body": {
    "customerId": "uuid",
    "vendorId": "uuid",
    "serviceId": "uuid",
    "staffId": "uuid",
    "bookingDate": "YYYY-MM-DD",
    "bookingTime": "HH:MM",
    "serviceType": "at_home",
    "address": "string",
    "latitude": number,
    "longitude": number,
    "petId": "uuid",
    "amount": number
  }
}
```

**Navigation:**
```typescript
// After address selection:
onNavigate('booking-summary', {
  serviceId,
  date,
  time,
  petId,
  addressId
});
```

**File Location:**
Save to: `/Users/ketan/Documents/Figma UI Customer APP/Universal Booking Flows/At Home Booking Flow.fig`

---

## 📱 SCREEN: Tele Consultation Booking Flow

### Design Specifications

**From TeleConsultationRouter.tsx:**

**Step 1: Mode Selection** (Already covered in Vet Booking Flows)

**Step 2a: Instant Tele Flow**
- Service selection
- Pet selection
- Queue waiting
- Payment (after connection)

**Step 2b: Scheduled Tele Flow**
- Provider list
- Provider profile
- Date/Time selection
- Pet selection
- Payment

**API Contracts:**
```json
// Create Tele Booking (Scheduled)
{
  "endpoint": "POST /bookings/create",
  "body": {
    "customerId": "uuid",
    "vendorId": "uuid",
    "serviceId": "uuid",
    "staffId": "uuid",
    "bookingDate": "YYYY-MM-DD",
    "bookingTime": "HH:MM",
    "serviceType": "tele",
    "petId": "uuid",
    "amount": number
  }
}

// Create Tele Booking (Instant)
{
  "endpoint": "POST /tele-consultation/instant/create",
  "body": {
    "customerId": "uuid",
    "serviceId": "uuid",
    "petId": "uuid",
    "staffId": "uuid (assigned automatically)"
  },
  "response": {
    "bookingId": "uuid",
    "queueId": "uuid",
    "meetingId": "string"
  }
}
```

**File Location:**
Save to: `/Users/ketan/Documents/Figma UI Customer APP/Universal Booking Flows/Tele Consultation Booking Flow.fig`

---

## 📱 SCREEN: Payment Screen (Universal)

### Design Specifications

**From UniversalPaymentPage.tsx:**

**Header:**
- Title: "Complete Payment" (with back button)

**Content:**
1. **Booking Summary Card:**
   - Service name
   - Date & time
   - Pet name
   - Vendor/provider name
   - Address (if applicable)

2. **Price Breakdown:**
   - Base price
   - Discount (if any, green text)
   - Tax
   - **Total** (large, bold, orange)

3. **Payment Method:**
   - Razorpay logo
   - Payment options: UPI, Card, Net Banking, Wallet

4. **Coupon Code (Optional):**
   - Input field
   - "Apply" button

**Pay Now Button:**
- Orange gradient: `bg-gradient-to-r from-[#FF8C42] to-[#FF6B35]`
- Full width, fixed bottom
- Text: "Pay ₹{amount}"
- Height: 56px

**API Contracts:**
```json
// Create Razorpay Order
{
  "endpoint": "POST /razorpay/orders/create",
  "body": {
    "amount": number,
    "currency": "INR",
    "receipt": "string",
    "bookingId": "uuid",
    "notes": {
      "bookingId": "uuid",
      "serviceName": "string"
    }
  },
  "response": {
    "success": true,
    "orderId": "string",
    "key": "string"
  }
}

// Verify Payment
{
  "endpoint": "POST /razorpay/payments/verify",
  "body": {
    "razorpayOrderId": "string",
    "razorpayPaymentId": "string",
    "razorpaySignature": "string",
    "bookingId": "uuid"
  },
  "response": {
    "success": true,
    "payment": {
      "id": "uuid",
      "status": "completed"
    }
  }
}
```

**Navigation:**
```typescript
// On payment success:
onNavigate('booking-confirmation', {
  bookingId: bookingId,
  paymentId: response.payment.id
});
```

**File Location:**
Save to: `/Users/ketan/Documents/Figma UI Customer APP/Universal Booking Flows/Payment Screen.fig`

---

## 📱 SCREEN: Booking Confirmation

### Design Specifications

**From BookingConfirmationPage.tsx:**

**Header:**
- Title: "Booking Confirmed!" (with back button)

**Content:**
1. **Success Animation:**
   - Large checkmark icon (green, 80px)
   - Or success illustration (2D only)

2. **Confirmation Details:**
   - Booking ID (small, gray)
   - Service name (large, bold)
   - Date & time
   - Pet name
   - Vendor/provider name

3. **OTP Display (if applicable):**
   - Label: "Completion OTP"
   - Large OTP code (6 digits, 48px font, bold)
   - Background: Light orange (`#FFF4E6`)
   - Border: Orange (`#FF8C42`)
   - "Copy OTP" button

4. **Action Buttons:**
   - "View Booking Details" (primary, orange gradient)
   - "Track Service" (if at_home, outline)
   - "Book Again" (text, small)

**API Contracts:**
```json
// Get Booking Details
{
  "endpoint": "GET /bookings/{bookingId}",
  "response": {
    "id": "uuid",
    "status": "confirmed",
    "otpCode": "string (6 digits, if applicable)",
    "serviceName": "string",
    "bookingDate": "YYYY-MM-DD",
    "bookingTime": "HH:MM"
  }
}
```

**Navigation:**
```typescript
// View Details:
onNavigate('booking-details', { bookingId: bookingId });

// Track:
onNavigate('tracking', { bookingId: bookingId });

// Book Again:
onNavigate('service-details', { serviceId: serviceId });
```

**File Location:**
Save to: `/Users/ketan/Documents/Figma UI Customer APP/Universal Booking Flows/Booking Confirmation.fig`

---

## ✅ DESIGN CHECKLIST (All Screens)

- [ ] Header matches CustomerHomeComplete.tsx exactly
- [ ] Content area: `bg-white rounded-t-[24px] -mt-3 pt-4 pb-24`
- [ ] Footer: StandardizedFooter
- [ ] Icons: Lucide React 2D only
- [ ] Colors: Exact hex values
- [ ] Service style cards: Color-coded (green/orange/blue)
- [ ] Date picker: 7 days forward, clear selection states
- [ ] Time slots: Grid layout, clear available/unavailable states
- [ ] Pet cards: Horizontal scroll, clear selection
- [ ] Address cards: List layout, clear selection
- [ ] API contracts: Annotated
- [ ] Navigation: Handlers defined
- [ ] Loading states: Designed
- [ ] Error states: Designed
- [ ] Empty states: Designed

---

**End of Universal Booking Flows Prompt**
