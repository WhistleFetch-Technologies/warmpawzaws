# Payment & Checkout Flow
## Customer App - Universal Payment Experience

**Date:** 2026-01-28  
**Version:** 1.0  
**Status:** Design Specification  
**Purpose:** Unified payment processing across all booking types

---

## 📋 Table of Contents

1. [Flow Overview](#flow-overview)
2. [Payment Flow Steps](#payment-flow-steps)
3. [Screen Specifications](#screen-specifications)
4. [Price Calculation](#price-calculation)
5. [Payment Methods](#payment-methods)
6. [Discounts & Promotions](#discounts--promotions)
7. [API Endpoints](#api-endpoints)
8. [UI/UX Requirements](#uiux-requirements)
9. [Data Models](#data-models)
10. [Error Handling](#error-handling)
11. [Edge Cases](#edge-cases)

---

## 🎯 Flow Overview

### Entry Point
**Where:** After scheduling/details selection in booking flow  
**Component:** `UniversalPaymentPage.tsx`  
**Initial State:** Booking details collected, ready for payment

### Flow Steps (Minimum: 3 Steps)
1. **Booking Summary Review** → Review details, apply discounts
2. **Payment Method Selection** → Choose payment option
3. **Payment Processing** → Process payment, confirm booking

### Universal Component
**Component:** `UniversalPaymentPage.tsx`  
**Reusable Across:**
- ✅ Center services bookings
- ✅ Home services bookings
- ✅ Tele consultations
- ✅ Product orders
- ✅ Package purchases
- ✅ Subscription payments

### Success Criteria
- ✅ Payment processed successfully
- ✅ Booking confirmed
- ✅ OTP generated (if applicable)
- ✅ Confirmation screen shown
- ✅ Booking visible in "My Bookings"

---

## 📱 Payment Flow Steps

### Step 1: Booking Summary Review

**Screen Name:** Review & Pay  
**Component:** `UniversalPaymentPage.tsx`  
**Purpose:** Review booking details, apply discounts, see price breakdown

**UI Elements:**

**Header:**
- Back button
- Title: "Review & Pay"
- Progress indicator (if multi-step)

**Booking Summary Card:**
- Service name
- Provider name and photo
- Date and time
- Pet name
- Address (if home/delivery service)
- Service style badge (At Center, At Home, Video Call)

**Price Breakdown:**
```
┌─────────────────────────────────────┐
│  Price Breakdown                    │
├─────────────────────────────────────┤
│  Service Price        ₹999          │
│  Platform Fee         ₹50           │
│  Convenience Fee      ₹25           │
│  Travel Fee           ₹100  (if home)│
│  ────────────────────────────────   │
│  Subtotal             ₹1,174         │
│                                      │
│  GST (18%)            ₹211           │
│  ────────────────────────────────   │
│  Total                ₹1,385         │
└─────────────────────────────────────┘
```

**Discounts Section:**
- Vendor discounts (if any) - shown as line item
- Platform discounts (if any)
- Coupon input field
- "Apply Coupon" button
- Applied coupon display (if any)

**Wallet Section:**
- Wallet balance display
- "Use Wallet Balance" toggle
- Amount to use from wallet
- Remaining amount after wallet

**Promotions Banner:**
- Applicable promotions
- "View All Promotions" link

**User Actions:**
- Review booking details
- Apply coupon code
- Toggle wallet usage
- View promotions
- Click "Continue to Payment"

**Why Click "Continue to Payment":**
- All details reviewed
- Discounts applied
- Ready to select payment method

**Validation:**
- Booking details valid
- Price calculated correctly
- Coupon valid (if applied)

**Navigation:** → Payment Method Selection

**Endpoint:** `GET /bookings/{bookingId}/summary` (if booking pre-created)  
**Endpoint:** `POST /tax/calculate` (calculate GST)  
**Endpoint:** `GET /admin/promotions/applicable` (get promotions)  
**Endpoint:** `GET /customer/{customerId}/wallet` (get wallet balance)

**Result:** Booking summary reviewed, discounts applied

---

### Step 2: Payment Method Selection

**Screen Name:** Select Payment Method  
**Component:** `UniversalPaymentPage.tsx` (payment section)  
**Purpose:** Choose payment method and enter payment details

**UI Elements:**

**Payment Methods:**

**1. Wallet Balance**
- Current balance: ₹XXX
- Amount to use: ₹XXX (editable)
- Remaining: ₹XXX
- "Use Full Balance" button

**2. Razorpay Options:**
- **Credit/Debit Card**
  - Card number input
  - Expiry date
  - CVV
  - Cardholder name
  - "Save Card" checkbox
  
- **UPI**
  - UPI ID input
  - "Verify UPI" button
  - QR code option
  
- **Net Banking**
  - Bank selection dropdown
  - Bank list with logos
  
- **Wallet (Paytm, PhonePe, etc.)**
  - Wallet selection
  - Wallet-specific flow

**3. Saved Cards**
- List of saved cards
- Card preview (last 4 digits)
- "Use This Card" button
- "Add New Card" option

**Payment Summary:**
- Total amount
- Amount from wallet (if any)
- Amount to pay now

**User Actions:**
- Select payment method
- Enter payment details
- Toggle wallet usage
- Click "Pay Now"

**Why Click "Pay Now":**
- Payment method selected
- Details entered
- Ready to process

**Validation:**
- Payment method selected
- Payment details valid
- Amount > 0 (or subscription active)

**Navigation:** → Payment Processing

**Endpoint:** `POST /razorpay/orders/create`
  - Body: `{ bookingId, amount, currency: 'INR' }`
  - Returns: Razorpay order details

**Result:** Payment method selected, order created

---

### Step 3: Payment Processing

**Screen Name:** Processing Payment  
**Component:** `UniversalPaymentPage.tsx` (processing state)  
**Purpose:** Process payment and confirm booking

**UI Elements:**

**Processing State:**
- Loading spinner
- "Processing your payment..." message
- Progress indicator

**Payment Gateway Redirect:**
- Razorpay checkout (if external)
- Payment form (if embedded)

**User Actions:**
- Complete payment on Razorpay
- Enter OTP (if required)
- Authorize payment

**Why Complete Payment:**
- Finalizes booking
- Confirms service

**After Payment:**
- Payment verification
- Booking confirmation
- OTP generation (if applicable)

**Navigation:** → Booking Confirmation Screen

**Endpoint:** `POST /razorpay/payments/verify`
  - Body: `{ paymentId, orderId, signature }`
  - Returns: Payment verification result

**Endpoint:** `PUT /bookings/{bookingId}/confirm`
  - Updates booking status to `confirmed`
  - Generates OTP (if applicable)

**Result:** Payment processed, booking confirmed

---

## 💰 Price Calculation

### Price Components

**1. Service Price**
- Base service price
- Vendor-set price
- Service-specific pricing

**2. Platform Fees**
- Platform commission
- Configurable percentage or fixed
- Endpoint: `GET /admin/finance/fees`

**3. Convenience Fee**
- Transaction convenience fee
- Fixed or percentage
- Endpoint: `GET /admin/finance/fees`

**4. Travel Fee** (Home Services Only)
- Distance-based calculation
- Logistics rules applied
- Endpoint: `POST /logistics/calculate-delivery-fee`

**5. GST (Goods and Services Tax)**
- Calculated on subtotal
- CGST + SGST (intra-state) or IGST (inter-state)
- Endpoint: `POST /tax/calculate`

### Calculation Flow

```typescript
// Step 1: Base Price
const servicePrice = booking.servicePrice;

// Step 2: Platform Fees
const platformFee = calculatePlatformFee(servicePrice, platformFeeConfig);

// Step 3: Convenience Fee
const convenienceFee = calculateConvenienceFee(servicePrice, convenienceFeeConfig);

// Step 4: Travel Fee (if home service)
const travelFee = serviceStyle === 'at_home' 
  ? calculateTravelFee(distance, logisticsRules) 
  : 0;

// Step 5: Subtotal
const subtotal = servicePrice + platformFee + convenienceFee + travelFee;

// Step 6: Apply Discounts
const vendorDiscount = booking.vendorDiscount || 0;
const platformDiscount = calculatePlatformDiscount(subtotal, promotions);
const couponDiscount = booking.couponDiscount || 0;
const totalDiscount = vendorDiscount + platformDiscount + couponDiscount;

// Step 7: After Discounts
const afterDiscounts = subtotal - totalDiscount;

// Step 8: GST Calculation
const gst = calculateGST(afterDiscounts, customerLocation, vendorLocation);

// Step 9: Final Total
const total = afterDiscounts + gst;

// Step 10: Wallet Usage (if applicable)
const walletAmount = Math.min(walletBalance, total);
const finalAmount = total - walletAmount;
```

### GST Calculation

**Rules:**
- **Intra-state:** CGST (9%) + SGST (9%) = 18%
- **Inter-state:** IGST (18%)
- Based on customer and vendor locations

**Endpoint:** `POST /tax/calculate`
```typescript
{
  amount: number;
  customerLocation: { state: string; pincode: string };
  vendorLocation: { state: string; pincode: string };
}
```

**Response:**
```typescript
{
  cgst: number;
  sgst: number;
  igst: number;
  totalGST: number;
  totalAmount: number;
}
```

---

## 💳 Payment Methods

### 1. Wallet Balance

**Component:** Wallet section in payment page

**Features:**
- Current balance display
- Amount to use (editable)
- "Use Full Balance" button
- Remaining amount calculation

**Flow:**
1. User toggles "Use Wallet Balance"
2. Enters amount to use (or uses full balance)
3. Remaining amount calculated
4. Payment processed for remaining amount

**Endpoint:** `GET /customer/{customerId}/wallet`  
**Endpoint:** `POST /wallet/use` (deducts from wallet)

---

### 2. Razorpay Integration

**Payment Options:**

**A. Credit/Debit Card**
- Card number, expiry, CVV
- Cardholder name
- "Save Card" option
- 3D Secure authentication

**B. UPI**
- UPI ID input
- QR code option
- UPI apps integration

**C. Net Banking**
- Bank selection
- Bank-specific redirect
- Payment confirmation

**D. Wallets**
- Paytm, PhonePe, etc.
- Wallet-specific flow

**Flow:**
1. Create Razorpay order
2. Redirect to Razorpay checkout (or embedded)
3. User completes payment
4. Verify payment signature
5. Confirm booking

**Endpoints:**
- `POST /razorpay/orders/create`
- `POST /razorpay/payments/verify`
- `POST /razorpay/webhooks` (for payment status updates)

---

### 3. Saved Cards

**Component:** Saved cards list

**Features:**
- List of saved cards
- Card preview (last 4 digits, brand)
- "Use This Card" button
- "Remove Card" option

**Flow:**
1. User selects saved card
2. Enters CVV (if required)
3. Payment processed
4. Booking confirmed

**Endpoint:** `GET /customer/{customerId}/saved-cards`  
**Endpoint:** `POST /customer/{customerId}/save-card`

---

## 🎁 Discounts & Promotions

### Discount Types

**1. Vendor Discount**
- Applied at service listing level
- Shown in service price
- Already included in displayed price

**2. Platform Discount**
- Applied at payment page
- Auto-applied if eligible
- Shown in price breakdown

**3. Coupon Discount**
- User-entered coupon code
- Validated before application
- Shown in price breakdown

**4. Promotion Discount**
- Promotional offers
- Auto-applied if eligible
- Shown in promotions section

### Coupon Application Flow

**Component:** Coupon input section

**UI Elements:**
- Coupon code input field
- "Apply Coupon" button
- Applied coupon display (if any)
- "Remove Coupon" button

**Flow:**
1. User enters coupon code
2. Clicks "Apply Coupon"
3. Coupon validated
4. Discount applied
5. Price recalculated

**Validation:**
- Coupon code exists
- Coupon is active
- Coupon is applicable to booking
- Minimum order value met
- Usage limit not exceeded

**Endpoint:** `POST /promotions/validate-code`
```typescript
{
  code: string;
  bookingId: string;
  amount: number;
}
```

**Response:**
```typescript
{
  valid: boolean;
  discount: number;
  discountType: 'percentage' | 'fixed';
  message?: string;
}
```

---

## 🔌 API Endpoints

### Price Calculation
- **POST** `/tax/calculate`
  - Calculates GST based on locations
- **GET** `/admin/finance/fees`
  - Returns platform and convenience fees
- **POST** `/logistics/calculate-delivery-fee`
  - Calculates travel/delivery fee (home services)

### Promotions
- **GET** `/admin/promotions/applicable?bookingId={bookingId}`
  - Returns applicable promotions
- **POST** `/promotions/validate-code`
  - Validates and applies coupon

### Wallet
- **GET** `/customer/{customerId}/wallet`
  - Returns wallet balance
- **POST** `/wallet/use`
  - Deducts from wallet

### Payment
- **POST** `/razorpay/orders/create`
  - Creates Razorpay order
- **POST** `/razorpay/payments/verify`
  - Verifies payment
- **POST** `/razorpay/webhooks`
  - Payment status webhooks

### Booking
- **POST** `/bookings/create`
  - Creates booking (before payment)
- **PUT** `/bookings/{bookingId}/confirm`
  - Confirms booking after payment

---

## 🎨 UI/UX Requirements

### Design Principles
1. **Transparency:** Clear price breakdown
2. **Trust:** Secure payment indicators
3. **Clarity:** Simple payment flow
4. **Feedback:** Loading states, success/error messages

### Visual Elements
- **Price Breakdown:** Clear, itemized list
- **Discount Display:** Highlighted, easy to see
- **Payment Methods:** Clear icons and labels
- **Security Badges:** SSL, secure payment indicators

### Loading States
- Payment processing spinner
- "Processing..." message
- Progress indicator

### Error States
- Payment failed message
- Retry payment button
- Alternative payment methods

### Success States
- Payment success animation
- Confirmation message
- Next steps guidance

---

## 📊 Data Models

### Price Breakdown
```typescript
interface PriceBreakdown {
  servicePrice: number;
  platformFee: number;
  convenienceFee: number;
  travelFee?: number; // Home services only
  subtotal: number;
  vendorDiscount?: number;
  platformDiscount?: number;
  couponDiscount?: number;
  totalDiscount: number;
  afterDiscounts: number;
  gst: {
    cgst?: number;
    sgst?: number;
    igst?: number;
    total: number;
  };
  total: number;
  walletAmount?: number;
  finalAmount: number;
}
```

### Payment Request
```typescript
interface PaymentRequest {
  bookingId: string;
  amount: number;
  currency: string;
  paymentMethod: 'wallet' | 'razorpay';
  razorpayMethod?: 'card' | 'upi' | 'netbanking' | 'wallet';
  couponCode?: string;
  useWallet?: boolean;
  walletAmount?: number;
}
```

### Payment Response
```typescript
interface PaymentResponse {
  paymentId: string;
  orderId: string;
  status: 'success' | 'failed' | 'pending';
  bookingId: string;
  otpCode?: string;
  message?: string;
}
```

---

## ⚠️ Error Handling

### Common Errors

**1. Payment Failed**
- Show: "Payment failed. Please try again."
- Action: "Retry Payment" button
- Fallback: Alternative payment methods

**2. Invalid Coupon**
- Show: "Invalid coupon code. Please check and try again."
- Action: "Remove Coupon" button

**3. Insufficient Wallet Balance**
- Show: "Insufficient wallet balance. Please use another payment method."
- Action: "Select Payment Method" button

**4. Network Error**
- Show: "Connection error. Please check your internet and try again."
- Action: "Retry" button

**5. Payment Timeout**
- Show: "Payment timeout. Please try again."
- Action: "Retry Payment" button

---

## 🔀 Edge Cases

### 1. Zero Payment (Subscription)
**Scenario:** User has active subscription, payment amount is ₹0  
**Solution:** Show "Using Active Subscription", skip payment, confirm booking

### 2. Partial Wallet Payment
**Scenario:** Wallet balance covers part of total  
**Solution:** Use wallet amount, charge remaining via Razorpay

### 3. Multiple Discounts
**Scenario:** Multiple discounts applicable  
**Solution:** Apply discounts in order: Vendor → Platform → Coupon

### 4. Price Change During Payment
**Scenario:** Service price changed while user is paying  
**Solution:** Show updated price, require confirmation

### 5. Payment Success but Booking Failed
**Scenario:** Payment succeeded but booking confirmation failed  
**Solution:** Refund payment, show error, allow retry

---

## 📱 Reference Design

### Similar Apps
- **Swiggy/Zomato:** Payment and checkout flow
- **Urban Company:** Service booking payment
- **Practo:** Appointment booking payment

### Design Patterns
- Clear price breakdown
- Multiple payment options
- Coupon application
- Wallet integration

---

**Document Status:** ✅ Complete  
**Last Updated:** 2026-01-28  
**Next:** [Booking Confirmation & Post-Booking Flow](./BOOKING_CONFIRMATION_FLOW.md)
