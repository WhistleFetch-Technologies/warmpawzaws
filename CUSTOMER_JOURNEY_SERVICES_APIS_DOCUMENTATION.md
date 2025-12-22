# Customer Journey - Services, APIs & Flow Handlers Documentation

## Overview

This document provides a comprehensive mapping of:
1. **Service Dashboards/Landing Pages** - Where customers discover services
2. **APIs Used** - Endpoints that list and manage services
3. **Flow Handlers** - Complete journey from service discovery to delivery
4. **Feature Integration** - Referral, loyalty, wallet, coupons, discounts, GST, refunds

---

## 1. Service Dashboards & Landing Pages

### 1.1 Veterinary Services
**Component:** `VetServicesLanding.tsx`  
**Route:** `/vet` or `vet-services`  
**API Used:** `GET /customer/services?roleId=veterinarian` or `roleId=pet_clinic`  
**Service Styles:**
- At Home (`at_home`) - Home visit services
- At Center (`at_center`) - Clinic visit services  
- Tele Consultation (`tele`) - Video consultation

**Features:**
- Follow-up booking eligibility check
- Service type filtering
- Vendor discovery by problem

---

### 1.2 Grooming Services
**Component:** `GroomingServicesLanding.tsx`  
**Route:** `/grooming`  
**API Used:** `GET /customer/services?roleId=pet_groomer`  
**Service Styles:**
- Grooming Centre (`at_center`) - Visit salon
- At Home Grooming (`at_home`) - Groomer comes to you

**Features:**
- Live tracking for at-home services
- Service style selection
- Vendor ratings and reviews

---

### 1.3 Training Services
**Component:** `TrainingServicesLanding.tsx`  
**Route:** `/training`  
**API Used:** `GET /customer/services?roleId=pet_trainer`  
**Service Styles:**
- At Home Training (`at_home`)
- Training Center (`at_center`)
- Online Training (`tele`)

**Features:**
- Progress tracking
- Session management
- Training packages

---

### 1.4 Walking Services
**Component:** `WalkingServicesLanding.tsx`  
**Route:** `/walking`  
**API Used:** `GET /customer/services?roleId=pet_walker`  
**Service Styles:**
- Walking Service (`at_home`) - Walker comes to pick up

**Features:**
- Live GPS tracking
- Session photos
- Walk history

---

### 1.5 Boarding Services
**Component:** `BoardingServicesLanding.tsx`  
**Route:** `/boarding`  
**API Used:** `GET /customer/services?roleId=pet_boarder` or `roleId=pet_resort`  
**Service Styles:**
- Boarding Facility (`at_center`)
- Resort (`at_center`)

**Features:**
- Daily updates
- Check-in/Check-out
- Facility amenities

---

### 1.6 Pharmacy Services
**Component:** `PharmacyServicesLanding.tsx`  
**Route:** `/pharmacy`  
**API Used:** `GET /customer/services?roleId=pet_pharmacy`  
**Service Styles:**
- Delivery (`delivery`) - Medicine delivery

**Features:**
- Prescription upload
- Medicine search
- Order tracking

---

### 1.7 Insurance Services
**Component:** `InsuranceServicesLanding.tsx`  
**Route:** `/insurance`  
**API Used:** `GET /customer/services?roleId=pet_insurance`  
**Service Styles:**
- Insurance Policy (`tele` or `at_center`)

**Features:**
- Policy comparison
- Claim management
- Policy renewal

---

### 1.8 Pet Cafe Services
**Component:** `PetCafeServicesLanding.tsx`  
**Route:** `/cafes`  
**API Used:** `GET /customer/services?roleId=pet_cafe`  
**Service Styles:**
- Cafe Visit (`at_center`)

**Features:**
- Table reservation
- Menu browsing
- Cafe ratings

---

### 1.9 Photography Services
**Component:** `PhotographyServicesLanding.tsx`  
**Route:** `/photography`  
**API Used:** `GET /customer/services?roleId=pet_photographer`  
**Service Styles:**
- At Home (`at_home`)
- Studio (`at_center`)

---

### 1.10 Nutrition Services
**Component:** `NutritionistServicesLanding.tsx`  
**Route:** `/nutritionist`  
**API Used:** `GET /customer/services?roleId=pet_nutritionist`  
**Service Styles:**
- Consultation (`tele` or `at_home`)

---

### 1.11 Ambulance Services
**Component:** `AmbulanceServicesLanding.tsx`  
**Route:** `/ambulance`  
**API Used:** `GET /customer/services?roleId=pet_ambulance`  
**Service Styles:**
- Emergency (`at_home`) - Ambulance dispatch

**Features:**
- SOS emergency booking
- Real-time tracking
- Emergency priority

---

### 1.12 Adoption Services
**Component:** `AdoptionServiceRouter.tsx`  
**Route:** `/adoption`  
**API Used:** `GET /customer/services?roleId=adoption_center`  
**Service Styles:**
- Adoption Center (`at_center`)

---

### 1.13 Memorial Services
**Component:** `SunsetServiceRouter.tsx`  
**Route:** `/memorial` or `/sunset`  
**API Used:** `GET /customer/services?roleId=memorial_services`  
**Service Styles:**
- Memorial Service (`at_center` or `at_home`)

---

### 1.14 Universal Services Landing
**Component:** `UniversalServicesLanding.tsx`  
**Route:** Dynamic based on `roleId`  
**API Used:** `GET /customer/services?roleId={roleId}`  
**Description:** Generic landing page for any vendor role

---

## 2. Service Listing APIs

### 2.1 Main Customer Services API
**Endpoint:** `GET /make-server-3dd53475/customer/services`  
**File:** `src/supabase/functions/server/customer-services.tsx`  
**Query Parameters:**
- `category` - Filter by service category
- `serviceStyle` - Filter by style (`at_home`, `at_center`, `tele`)
- `location` - Location coordinates (lat,lng)
- `petType` - Filter by pet type
- `roleId` - Filter by vendor role

**Response Format:**
```json
{
  "success": true,
  "services": [
    {
      "id": "service_id",
      "serviceName": "Service Name",
      "description": "Service description",
      "price": 1000,
      "duration": 60,
      "categoryName": "grooming",
      "serviceStyle": "at_home",
      "vendorId": "vendor_id",
      "vendorName": "Vendor Name",
      "vendorRating": 4.5,
      "vendorRoleId": "pet_groomer"
    }
  ],
  "total": 10
}
```

**Flow:**
1. Fetches all approved vendors from KV store
2. Iterates through vendor services (at_home, at_center, tele)
3. Filters published and enabled services
4. Enriches with vendor information
5. Applies filters (category, style, petType, roleId)
6. Sorts by rating and published date

---

### 2.2 Service Details API
**Endpoint:** `GET /make-server-3dd53475/customer/services/:serviceId`  
**File:** `src/supabase/functions/server/customer-services.tsx`  
**Description:** Get detailed information about a specific service

**Response:**
```json
{
  "success": true,
  "service": {
    "id": "service_id",
    "serviceName": "Service Name",
    "vendorDetails": {
      "id": "vendor_id",
      "businessName": "Business Name",
      "rating": 4.5,
      "location": "Address"
    }
  }
}
```

---

### 2.3 Packages API
**Endpoint:** `GET /make-server-3dd53475/customer/packages`  
**File:** `src/supabase/functions/server/customer-services.tsx`  
**Description:** List all published packages

**Response:**
```json
{
  "success": true,
  "packages": [
    {
      "id": "package_id",
      "isPackage": true,
      "packageDetails": {
        "pricing": {
          "savings": 500
        }
      }
    }
  ],
  "total": 5
}
```

---

### 2.4 Vendor Services API
**Endpoint:** `GET /make-server-3dd53475/customer/vendors/:vendorId/services`  
**File:** `src/supabase/functions/server/customer-services.tsx`  
**Description:** Get all published services for a specific vendor

---

## 3. Booking Flow Handlers

### 3.1 Booking Creation
**Endpoint:** `POST /make-server-3dd53475/bookings/create`  
**File:** `src/supabase/functions/server/booking-endpoints.tsx`  
**Request Body:**
```json
{
  "customerId": "customer_id",
  "vendorId": "vendor_id",
  "serviceId": "service_id",
  "petId": "pet_id",
  "serviceStyle": "at_home",
  "scheduledDate": "2024-01-01T10:00:00Z",
  "amount": 1000,
  "useWallet": false,
  "couponCode": "COUPON10",
  "loyaltyPointsUsed": 100
}
```

**Flow:**
1. Validates customer, vendor, service, pet
2. Generates OTP (start + end for trainers/walkers, end only for others)
3. Creates booking record
4. Sends notifications (booking_created)
5. Stores booking in KV store
6. Returns booking with OTP

**OTP Generation:**
- Trainers/Walkers/Behaviorists: Both START and END OTP
- Other services: Single END/completion OTP
- OTP stored in: `booking.otp.start` and `booking.otp.end`

---

### 3.2 Payment Processing
**Endpoint:** `POST /make-server-3dd53475/payment/process`  
**File:** `src/supabase/functions/server/payment-endpoints.tsx`  
**Features:**
- Wallet payment
- Coupon application
- Loyalty points redemption
- GST calculation
- Razorpay integration

**Flow:**
1. Calculate subtotal
2. Apply coupon discount
3. Calculate GST using rule engine
4. Apply wallet deduction
5. Apply loyalty points discount
6. Create Razorpay order
7. Process payment
8. Update booking with payment info

---

### 3.3 GST Calculation
**Endpoint:** `POST /make-server-3dd53475/calculate-gst`  
**File:** `src/supabase/functions/server/gst-rule-engine.tsx`  
**Request:**
```json
{
  "amount": 1000,
  "serviceType": "grooming",
  "vendorRoleId": "pet_groomer",
  "state": "Maharashtra"
}
```

**Response:**
```json
{
  "gstAmount": 180,
  "gstRate": 18,
  "total": 1180
}
```

**Flow:**
1. Get GST rules from configuration
2. Match service type and vendor role
3. Apply state-specific rules if applicable
4. Calculate GST amount
5. Return total with GST

---

### 3.4 Booking Lifecycle - OTP Verification
**Endpoint:** `POST /make-server-3dd53475/booking/:bookingId/verify-otp-complete`  
**File:** `src/supabase/functions/server/booking-lifecycle-complete.tsx`  
**Request:**
```json
{
  "action": "start" | "end",
  "otp": "1234"
}
```

**Flow for START OTP:**
1. Verify start OTP
2. Mark booking as `in_progress`
3. Send notification with end OTP
4. Return success (no earnings yet)

**Flow for END OTP:**
1. Verify end/completion OTP
2. Mark booking as `completed`
3. **Trigger complete lifecycle:**
   - Realize earnings
   - Create settlement
   - Schedule payout
   - Award loyalty points
   - Send completion notifications

---

### 3.5 Earnings Realization
**Function:** `realizeEarnings()` in `booking-lifecycle-complete.tsx`  
**Flow:**
1. Get vendor tier (SILVER/GOLD/PLATINUM)
2. Calculate commission based on tier
3. Calculate vendor earnings = totalAmount - platformCommission
4. Create earnings record
5. Update vendor daily/monthly/lifetime earnings
6. Update booking with earnings info

**Storage:**
- `earnings:{earningsId}` - Individual earnings record
- `vendor:{vendorId}:earnings:daily:{dateKey}` - Daily aggregation
- `vendor:{vendorId}:earnings:monthly:{monthKey}` - Monthly aggregation
- `vendor:{vendorId}:earnings:lifetime` - Lifetime aggregation

---

### 3.6 Settlement Creation
**Function:** `createSettlement()` in `booking-lifecycle-complete.tsx`  
**Flow:**
1. Create settlement record
2. Check if vendor bank is verified
3. If verified: Initiate Razorpay marketplace transfer
4. Mark settlement as 'settled' after transfer
5. Update booking with settlement info

---

### 3.7 Payout Scheduling
**Function:** `schedulePayout()` in `booking-lifecycle-complete.tsx`  
**Flow:**
1. Get payout policies from admin settings
2. Calculate payout date based on hold period
3. Create payout record
4. Link to settlement
5. Update booking with payout info

**Payout Policies:**
- `holdPeriodDays`: Days to hold before payout (default: 7)
- `autoPayout`: Whether to auto-process payouts (default: false)
- `minPayoutAmount`: Minimum amount for payout (default: 1000)
- `payoutPeriod`: 'daily', 'weekly', 'monthly' (default: 'weekly')

---

## 4. Feature Integration

### 4.1 Loyalty Points System
**Base Endpoint:** `/make-server-3dd53475/loyalty`  
**File:** `src/supabase/functions/server/rewards-loyalty-system.tsx`

#### Get Loyalty Profile
**Endpoint:** `GET /loyalty/profile/:userId?userType=customer`  
**Response:**
```json
{
  "profile": {
    "userId": "customer_id",
    "pointsBalance": 500,
    "totalPointsEarned": 1000,
    "totalPointsRedeemed": 500,
    "referralCode": "REFABC1234",
    "tier": "GOLD"
  }
}
```

#### Award Points
**Endpoint:** `POST /loyalty/award`  
**Request:**
```json
{
  "userId": "customer_id",
  "userType": "customer",
  "actionKey": "book_grooming",
  "amount": 1000,
  "metadata": {
    "bookingId": "booking_id"
  }
}
```

**Points Rules:**
- Sign up: 100 points (one-time)
- Complete profile: 100 points (one-time)
- Book grooming: 5 points per ₹1000 spent
- Book vet: 7 points per ₹500 spent
- Buy medicine: 10 points per ₹1000 spent
- Post review: 500 points (max 3/month)
- Referral success: 100 points (unlimited)

#### Redeem Points
**Endpoint:** `POST /loyalty/redeem`  
**Request:**
```json
{
  "userId": "customer_id",
  "userType": "customer",
  "points": 100
}
```

**Conversion:** 1 point = ₹1 credit to wallet

**Flow:**
1. Check points balance
2. Calculate credit amount (1 point = ₹1)
3. Credit wallet
4. Deduct points
5. Create transaction record
6. Update loyalty profile

---

### 4.2 Referral System
**Base Endpoint:** `/make-server-3dd53475/loyalty/referral`  
**File:** `src/supabase/functions/server/rewards-loyalty-system.tsx`

#### Apply Referral Code
**Endpoint:** `POST /loyalty/referral/apply`  
**Request:**
```json
{
  "newUserId": "new_customer_id",
  "referralCode": "REFABC1234",
  "userType": "customer"
}
```

**Flow:**
1. Validate referral code
2. Check if referrer exists
3. Create referral record
4. Award points to referrer (100 points)
5. Award welcome bonus to new user

**Referral Code Format:** `REF{first3chars}{random4digits}`

---

### 4.3 Wallet System
**Base Endpoint:** `/make-server-3dd53475/wallet/:customerId`  
**File:** `src/supabase/functions/server/wallet-endpoints.tsx`

#### Get Wallet Balance
**Endpoint:** `GET /wallet/:customerId`  
**Response:**
```json
{
  "wallet": {
    "customerId": "customer_id",
    "balance": 500,
    "totalEarned": 1000,
    "totalSpent": 500,
    "transactions": []
  }
}
```

#### Credit Wallet
**Endpoint:** `POST /wallet/:customerId/credit`  
**Request:**
```json
{
  "amount": 500,
  "source": "refund",
  "description": "Refund for cancelled booking",
  "referenceId": "booking_id"
}
```

**Sources:**
- `refund` - Booking cancellation refund
- `cashback` - Cashback rewards
- `promo` - Promotional credit
- `loyalty_redeem` - Loyalty points redemption

#### Debit Wallet
**Endpoint:** `POST /wallet/:customerId/debit`  
**Request:**
```json
{
  "amount": 500,
  "purpose": "payment",
  "description": "Payment for booking",
  "referenceId": "booking_id"
}
```

---

### 4.4 Coupon System
**Base Endpoint:** `/make-server-3dd53475/coupons`  
**File:** `src/supabase/functions/server/marketing-routes-v2.tsx`

#### Apply Coupon
**Endpoint:** `POST /coupons/apply`  
**Request:**
```json
{
  "code": "SAVE10",
  "orderAmount": 1000,
  "customerId": "customer_id",
  "orderId": "order_id",
  "bookingId": "booking_id"
}
```

**Response:**
```json
{
  "success": true,
  "usage": {
    "discountAmount": 100,
    "orderAmount": 1000
  },
  "coupon": {
    "code": "SAVE10",
    "type": "percentage",
    "value": 10,
    "maxDiscountAmount": 500
  }
}
```

**Coupon Types:**
- `percentage` - Percentage discount
- `fixed` - Fixed amount discount

---

### 4.5 Refund System
**Endpoint:** `POST /make-server-3dd53475/appointment/:appointmentId/cancel`  
**File:** `src/supabase/functions/server/appointment-lifecycle-endpoints.tsx`  
**Request:**
```json
{
  "cancelledBy": "customer" | "vendor",
  "reason": "Cancellation reason",
  "refundMethod": "wallet" | "original"
}
```

**Flow:**
1. Get refund policy based on vendor role and service style
2. Calculate refund amount:
   - If refund to wallet: 100% refund (no cancellation fee)
   - If refund to original source: Apply cancellation fee based on time
3. Process refund:
   - Wallet refund: Credit wallet immediately
   - Original source: Initiate payment gateway refund
4. Update booking status to `cancelled`
5. Apply vendor penalty if vendor cancelled
6. Send notifications

**Refund Policy:**
- Cancellation window: 24 hours (default)
- Cancellation fee: 10% if within window
- Refund percentage: 100% (minus cancellation fee)

---

### 4.6 GST Invoice Generation
**Endpoints (multiple possible):**
- `GET /invoice/:bookingId`
- `GET /bookings/:bookingId/invoice`
- `GET /gst-invoice/:bookingId`

**Invoice Contains:**
- Invoice number
- Customer details
- Vendor details (with GSTIN)
- Service details
- Amount breakdown:
  - Subtotal
  - Discount
  - GST amount
  - Total
- Payment method
- Booking reference

---

## 5. Complete Customer Journey Flow

### 5.1 Service Discovery Flow
```
1. Customer opens service landing page (e.g., VetServicesLanding)
   ↓
2. Component calls: GET /customer/services?roleId=veterinarian
   ↓
3. API fetches approved vendors and their published services
   ↓
4. Services displayed with filters (style, category, location)
   ↓
5. Customer selects service
   ↓
6. Navigate to booking flow
```

### 5.2 Booking Flow with All Features
```
1. Customer selects service and time slot
   ↓
2. Apply coupon (if available)
   ↓
3. Calculate GST using rule engine
   ↓
4. Apply wallet balance (if opted)
   ↓
5. Apply loyalty points (if opted)
   ↓
6. Calculate final amount
   ↓
7. Process payment (Razorpay)
   ↓
8. Create booking with OTP
   ↓
9. Send booking confirmation
```

### 5.3 Service Delivery Flow
```
1. Vendor starts service
   ↓
2. Verify START OTP (for trainers/walkers)
   ↓
3. Booking status: in_progress
   ↓
4. Service delivery
   ↓
5. Vendor completes service
   ↓
6. Verify END OTP
   ↓
7. Booking status: completed
   ↓
8. Trigger lifecycle:
   - Realize earnings
   - Create settlement
   - Schedule payout
   - Award loyalty points
   ↓
9. Generate GST invoice
   ↓
10. Send completion notifications
```

### 5.4 Loyalty Points Flow
```
1. Booking completed
   ↓
2. Award points based on actionKey and amount
   ↓
3. Update loyalty profile
   ↓
4. Customer can redeem points:
   - Points → Wallet credit (1 point = ₹1)
   - Use wallet for future bookings
```

### 5.5 Refund Flow
```
1. Customer cancels booking
   ↓
2. Calculate refund amount based on policy
   ↓
3. If refund to wallet:
   - Credit wallet immediately
   - 100% refund (no cancellation fee)
   ↓
4. If refund to original source:
   - Apply cancellation fee
   - Initiate payment gateway refund
   ↓
5. Update booking status
   ↓
6. Send refund confirmation
```

---

## 6. Service Styles Across Services

### At Home Services (`at_home`)
**Services:**
- Veterinary home visit
- Grooming at home
- Training at home
- Walking service
- Nutritionist consultation
- Photography at home

**Features:**
- Live GPS tracking
- OTP verification
- Service provider arrival notification

---

### At Center Services (`at_center`)
**Services:**
- Clinic visit
- Grooming center
- Training center
- Boarding facility
- Resort
- Cafe visit
- Studio photography

**Features:**
- Check-in/Check-out
- Facility amenities
- Location-based search

---

### Tele Services (`tele`)
**Services:**
- Tele consultation (vet)
- Online training
- Tele counseling
- Insurance consultation

**Features:**
- Video call integration
- Prescription sharing
- Follow-up scheduling

---

### Delivery Services (`delivery`)
**Services:**
- Medicine delivery
- Product delivery

**Features:**
- Order tracking
- Delivery address management
- Delivery time slots

---

## 7. API Summary Table

| Feature | Endpoint | Method | File |
|---------|----------|--------|------|
| List Services | `/customer/services` | GET | `customer-services.tsx` |
| Service Details | `/customer/services/:serviceId` | GET | `customer-services.tsx` |
| List Packages | `/customer/packages` | GET | `customer-services.tsx` |
| Create Booking | `/bookings/create` | POST | `booking-endpoints.tsx` |
| Process Payment | `/payment/process` | POST | `payment-endpoints.tsx` |
| Calculate GST | `/calculate-gst` | POST | `gst-rule-engine.tsx` |
| Verify OTP | `/booking/:id/verify-otp-complete` | POST | `booking-lifecycle-complete.tsx` |
| Get Loyalty Profile | `/loyalty/profile/:userId` | GET | `rewards-loyalty-system.tsx` |
| Award Points | `/loyalty/award` | POST | `rewards-loyalty-system.tsx` |
| Redeem Points | `/loyalty/redeem` | POST | `rewards-loyalty-system.tsx` |
| Apply Referral | `/loyalty/referral/apply` | POST | `rewards-loyalty-system.tsx` |
| Get Wallet | `/wallet/:customerId` | GET | `wallet-endpoints.tsx` |
| Credit Wallet | `/wallet/:customerId/credit` | POST | `wallet-endpoints.tsx` |
| Debit Wallet | `/wallet/:customerId/debit` | POST | `wallet-endpoints.tsx` |
| Apply Coupon | `/coupons/apply` | POST | `marketing-routes-v2.tsx` |
| Cancel Booking | `/appointment/:id/cancel` | POST | `appointment-lifecycle-endpoints.tsx` |
| Get Booking | `/appointment/:id` | GET | `appointment-lifecycle-endpoints.tsx` |

---

## 8. Testing Checklist

### Service Discovery
- [ ] All service landing pages load correctly
- [ ] Services filtered by roleId correctly
- [ ] Services filtered by serviceStyle correctly
- [ ] Services filtered by category correctly
- [ ] Service details page loads correctly

### Booking Flow
- [ ] Booking creation with all payment methods
- [ ] Coupon application works
- [ ] GST calculation is accurate
- [ ] Wallet payment works
- [ ] Loyalty points redemption works
- [ ] OTP generation and verification

### Booking Lifecycle
- [ ] Start OTP verification (for applicable services)
- [ ] End OTP verification
- [ ] Earnings realization
- [ ] Settlement creation
- [ ] Payout scheduling
- [ ] Loyalty points awarded

### Features
- [ ] Referral code application
- [ ] Loyalty points earning
- [ ] Loyalty points redemption
- [ ] Wallet credit (refund)
- [ ] Wallet debit (payment)
- [ ] Coupon application
- [ ] GST invoice generation
- [ ] Refund processing

---

## 9. Notes

1. **Service Listing:** All services are fetched from KV store (`vendor_services:{vendorId}:{style}`)
2. **Service Publishing:** Services must be `published` and `isEnabled: true` to appear in customer listings
3. **Vendor Approval:** Only vendors with `applicationStatus: 'approved'` are included
4. **OTP Generation:** Varies by service type (trainers/walkers get both start and end OTP)
5. **Loyalty Points:** Awarded automatically on booking completion via lifecycle trigger
6. **GST Calculation:** Uses rule engine for dynamic GST based on service type, vendor role, and state
7. **Refunds:** Wallet refunds are instant (100%), original source refunds may have cancellation fees

---

**Last Updated:** Current Session  
**Test File:** `src/tests/e2e-customer-journey-test.ts`

