# Tele & Home Services - Complete Flow Analysis

**Date:** 2025-01-27  
**Status:** ✅ Complete Implementation Analysis

## Executive Summary

This document provides a comprehensive analysis of how the system handles **Tele Consultation** and **Home Services** today, including complete flows with actions from all personas (Customer, Vendor, Staff) and full lifecycle from booking creation to settlement.

---

## 1. HOME SERVICES COMPLETE FLOW

### 1.1 Service Discovery & Booking Creation

#### Customer Actions:
1. **Browse Services** → `GET /customer/services?serviceStyle=at_home`
2. **Select Service** → Service details page
3. **Select Vendor** → Vendor profile with ratings
4. **Enter Address** → Customer location input
5. **Select Date/Time** → Schedule selection
6. **Select Pet** → Pet selection
7. **Review Pricing** → Service amount + Home service fee
8. **Create Booking** → `POST /home-service/book`

#### System Actions (Backend):
```typescript
// Endpoint: POST /make-server-3dd53475/home-service/book
// File: home-service-booking-flow.tsx

1. Validate input (customerId, vendorId, staffId, serviceId, address, location)
2. Generate booking ID
3. Generate OTPs:
   - START OTP (4-digit) - For service start verification
   - END OTP (4-digit) - For service completion verification
4. Calculate distance between vendor and customer location
5. Calculate estimated travel time (distance × 3 min/km)
6. Create booking object with:
   - Status: 'confirmed'
   - Payment status: 'pending'
   - GPS tracking: { isActive: false }
   - OTP: { start, end, startUsed: false, endUsed: false }
   - Lifecycle timestamps: all null initially
7. Save booking to KV store (booking:{bookingId})
8. Add booking to customer's booking list
9. Add booking to vendor's booking list
10. Return booking with OTPs
```

#### Booking Object Structure:
```typescript
{
  id: bookingId,
  customerId,
  vendorId,
  staffId,
  serviceId,
  serviceType,
  petId,
  
  // Home Service Specific
  isHomeService: true,
  customerAddress: address,
  customerLocation: { lat, lng },
  
  // Schedule
  scheduledDate,
  scheduledTime,
  
  // ETA
  estimatedTravelTime: minutes,
  vendorLocation: { lat, lng },
  
  // OTP System
  otp: {
    start: "1234",
    end: "5678",
    startUsed: false,
    endUsed: false,
    generatedAt: ISO timestamp
  },
  
  // Payment
  serviceAmount: number,
  homeServiceFee: number,
  totalAmount: number,
  paymentStatus: 'pending',
  paymentId: null,
  
  // Commission
  platformCommission: 0,
  vendorPayout: 0,
  
  // Status Flow: confirmed → vendor_en_route → vendor_arrived → in_progress → completed
  status: 'confirmed',
  
  // GPS Tracking
  gpsTracking: {
    isActive: false,
    trackingId: null,
    startLocation: null,
    currentLocation: null,
    waypoints: [],
    totalDistance: 0,
    eta: null
  },
  
  // Lifecycle Timestamps
  startedAt: null,
  vendorDepartedAt: null,
  vendorArrivedAt: null,
  completedAt: null,
  duration: null,
  
  // Notes & Media
  customerNotes: string,
  vendorNotes: string,
  completionNotes: string,
  completionPhotos: []
}
```

### 1.2 Payment Processing

#### Customer Actions:
1. **Initiate Payment** → Razorpay payment gateway
2. **Complete Payment** → Payment success callback
3. **Payment Confirmation** → `POST /payments/verify`

#### System Actions:
```typescript
// Payment verification updates booking:
- paymentStatus: 'completed'
- paymentId: razorpay_payment_id
- status: 'confirmed' (remains confirmed, ready for vendor action)
```

### 1.3 Vendor Departure & GPS Tracking

#### Vendor Actions:
1. **View Booking** → Booking appears in vendor dashboard
2. **Start Ride** → `POST /home-service/:bookingId/start-ride`
   - Vendor provides current location
   - System starts GPS tracking

#### System Actions:
```typescript
// Endpoint: POST /make-server-3dd53475/home-service/:bookingId/start-ride
// File: home-service-booking-flow.tsx

1. Validate booking exists and vendor authorized
2. Check booking status is 'confirmed'
3. Generate tracking ID
4. Update booking:
   - status: 'vendor_en_route'
   - vendorDepartedAt: current timestamp
   - gpsTracking: {
       isActive: true,
       trackingId: "track_xxx",
       startLocation: vendor current location,
       currentLocation: vendor current location,
       waypoints: [initial waypoint],
       totalDistance: 0,
       eta: estimatedTravelTime
     }
5. Create tracking session: session:tracking:{trackingId}
6. Notify customer: "Vendor is on the way"
```

#### Customer Actions (Real-time):
1. **Receive Notification** → "Vendor is on the way"
2. **View Live Tracking** → `GET /tracking/location/:bookingId`
3. **See Vendor Location** → Real-time map updates
4. **Monitor ETA** → ETA updates as vendor moves

### 1.4 Location Updates During Transit

#### Vendor Actions (Automatic):
1. **Location Updates** → `POST /home-service/:bookingId/update-location`
   - Called periodically (every 30 seconds) by vendor app
   - Sends current GPS coordinates

#### System Actions:
```typescript
// Endpoint: POST /make-server-3dd53475/home-service/:bookingId/update-location

1. Validate GPS tracking is active
2. Add waypoint to tracking array
3. Calculate distance from previous waypoint
4. Update totalDistance
5. Calculate remaining distance to customer
6. Recalculate ETA based on remaining distance
7. Update tracking session for SSE stream
8. Customer receives real-time updates via polling/SSE
```

### 1.5 Vendor Arrival

#### Vendor Actions:
1. **Arrive at Location** → `POST /home-service/:bookingId/arrived`
   - Vendor taps "Arrived" button when at customer location

#### System Actions:
```typescript
// Endpoint: POST /make-server-3dd53475/home-service/:bookingId/arrived

1. Update booking:
   - status: 'vendor_arrived'
   - vendorArrivedAt: current timestamp
   - gpsTracking.isActive: false (stop tracking)
2. Notify customer: "Vendor has arrived. Please share START OTP"
3. Customer receives notification with START OTP
```

#### Customer Actions:
1. **Receive Arrival Notification** → "Vendor has arrived"
2. **Share START OTP** → Provide OTP to vendor
3. **Vendor Enters OTP** → Service begins

### 1.6 Service Start (OTP Verification)

#### Vendor Actions:
1. **Enter START OTP** → `POST /booking/:bookingId/verify-otp-complete`
   - Action: 'start'
   - OTP: customer's start OTP

#### System Actions:
```typescript
// Endpoint: POST /make-server-3dd53475/booking/:bookingId/verify-otp-complete
// File: booking-lifecycle-complete-refactored.tsx

1. Verify START OTP matches booking.otp.start
2. Update booking:
   - status: 'in_progress'
   - startedAt: current timestamp
   - otp.startUsed: true
3. Notify customer: "Service has started. End OTP: {endOTP}"
4. Return success (booking not completed yet)
```

#### Customer Actions:
1. **Receive Notification** → "Service started"
2. **Note END OTP** → Save end OTP for completion

### 1.7 Service Delivery

#### Vendor Actions:
1. **Perform Service** → Actual service delivery
2. **Take Photos** (optional) → Upload completion photos
3. **Add Notes** → Service completion notes

#### Customer Actions:
1. **Monitor Service** → Can chat with vendor if needed
2. **Wait for Completion** → Service in progress

### 1.8 Service Completion

#### Vendor Actions:
1. **Complete Service** → `POST /booking/:bookingId/verify-otp-complete`
   - Action: 'end' or 'complete'
   - OTP: customer's end OTP

#### System Actions (Complete Lifecycle):
```typescript
// Endpoint: POST /make-server-3dd53475/booking/:bookingId/verify-otp-complete

1. Verify END OTP matches booking.otp.end
2. Complete booking:
   - status: 'completed'
   - completedAt: current timestamp
   - duration: calculated from startedAt to completedAt
   - otp.endUsed: true

3. REALIZE EARNINGS:
   - Get vendor tier
   - Calculate commission rate (based on tier)
   - Calculate platform commission
   - Calculate vendor earnings
   - Create commission record in SQL

4. CREATE SETTLEMENT:
   - Create settlement record
   - Get vendor bank details
   - Initiate Razorpay marketplace payout
   - Update settlement status

5. SCHEDULE PAYOUT:
   - Check payout policies
   - Calculate payout date (hold period)
   - Create payout record
   - Link to settlement

6. LOYALTY POINTS:
   - Award points to customer
   - Based on service type and amount

7. NOTIFICATIONS:
   - Customer: "Service completed. Please rate your experience."
   - Vendor: "Service completed. Earnings: ₹{amount}"
```

#### Customer Actions:
1. **Receive Completion Notification**
2. **Rate & Review** → `POST /booking/:bookingId/review`
3. **View Receipt** → Booking details with payment info

### 1.9 Settlement & Payout

#### System Actions (Automatic):
```typescript
// Settlement Flow (Automatic after completion):

1. Settlement Created:
   - Total amount: ₹X
   - Platform commission: ₹Y (based on tier)
   - Vendor share: ₹Z

2. Razorpay Marketplace Transfer:
   - Transfer vendor share to vendor bank account
   - Platform commission retained in marketplace account

3. Payout Scheduling:
   - If auto-payout enabled: Schedule payout
   - If manual: Require admin approval
   - Hold period: Based on admin policies (default 7 days)

4. Payout Execution:
   - On scheduled date: Execute payout
   - Update payout status: 'completed'
   - Notify vendor: "Payout processed"
```

---

## 2. TELE CONSULTATION COMPLETE FLOW

### 2.1 Service Discovery & Booking Creation

#### Customer Actions:
1. **Browse Tele Services** → `GET /customer/services?serviceStyle=tele`
2. **Select Service Type** → e.g., "Instant Tele Consultation"
3. **Select Role** → e.g., "Veterinarian", "Trainer"
4. **Select Staff** (if scheduled) → Choose available consultant
5. **Select Time Slot** (if scheduled) → Choose appointment time
6. **Create Booking** → `POST /tele-services/instant/create-booking` or `POST /bookings/scheduled-tele`

#### System Actions (Instant Tele):
```typescript
// Endpoint: POST /make-server-3dd53475/tele-services/instant/create-booking
// File: instant-tele-endpoints.tsx

1. Validate input (customerId, petId, roleId, consultationFee)
2. Generate booking ID
3. Create booking with:
   - status: 'pending'
   - serviceStyle: 'tele'
   - bookingType: 'instant_tele'
   - paymentStatus: 'pending'
   - No OTP generated yet (will be generated after payment)
4. Return booking for payment
```

#### System Actions (Scheduled Tele):
```typescript
// Endpoint: POST /make-server-3dd53475/bookings/scheduled-tele
// File: ScheduledTeleBookingFlow.tsx

1. Validate input (serviceId, staffId, slotId, scheduledDate, scheduledTime)
2. Generate booking ID
3. Create booking with:
   - status: 'pending'
   - serviceStyle: 'tele'
   - bookingType: 'scheduled_tele'
   - assignedStaffId: staffId
   - scheduledDate, scheduledTime
   - paymentStatus: 'pending'
4. Return booking for payment
```

### 2.2 Payment Processing

#### Customer Actions:
1. **Initiate Payment** → Razorpay payment gateway
2. **Complete Payment** → Payment success
3. **Payment Confirmation** → `POST /payments/verify`

#### System Actions (Instant Tele):
```typescript
// After payment success:
1. Update booking:
   - paymentStatus: 'completed'
   - paymentId: razorpay_payment_id
   - status: 'payment_completed'

2. AUTO-ASSIGN STAFF:
   - Find available staff for role
   - Assign staff to booking
   - Update booking:
     - assignedStaffId: staffId
     - status: 'assigned'
   - Notify customer: "Consultant assigned. Waiting for acceptance."
   - Notify staff: "New consultation request"
```

### 2.3 Staff Assignment & Acceptance

#### Staff Actions (Instant Tele):
1. **Receive Notification** → "New consultation request"
2. **Accept/Reject** → `POST /tele-services/instant/assign-staff`
   - If accept: status → 'accepted'
   - If reject: status → 'rejected', refund initiated

#### System Actions:
```typescript
// Endpoint: POST /make-server-3dd53475/tele-services/instant/assign-staff

1. Validate staff assignment
2. Update booking:
   - status: 'accepted' (if accepted)
   - assignedStaffId: staffId
3. Generate OTP (if accepted):
   - completionOTP: 4-digit code
4. Notify customer: "Consultant accepted. Ready to start call."
```

### 2.4 Video Call Initiation

#### Customer Actions:
1. **Start Video Call** → `POST /booking/:bookingId/start-video-call`
   - Can only start within 10 minutes of appointment time

#### System Actions:
```typescript
// Endpoint: POST /make-server-3dd53475/booking/:bookingId/start-video-call
// File: tele-consultation-endpoints.tsx

1. Validate booking exists and is tele service
2. Check booking status: 'accepted' or 'assigned'
3. Check time window (within 10 min of appointment)
4. Create tele session:
   - id: teleSessionId
   - bookingId
   - customerId, staffId
   - callStatus: 'ringing'
   - initiatedBy: 'customer'
   - initiatedAt: current timestamp
5. Update booking:
   - teleSessionId: sessionId
   - status: 'call_ringing'
   - teleCallInitiatedAt: current timestamp
6. Notify staff: "Incoming video call"
```

### 2.5 Staff Accepts/Rejects Call

#### Staff Actions:
1. **Receive Call Notification** → "Incoming video call"
2. **Accept Call** → `POST /tele-session/:sessionId/accept`
3. **OR Reject Call** → `POST /tele-session/:sessionId/reject`

#### System Actions (Accept):
```typescript
// Endpoint: POST /make-server-3dd53475/tele-session/:sessionId/accept

1. Validate session exists and staff authorized
2. Update session:
   - callStatus: 'active'
   - acceptedAt: current timestamp
3. Update booking:
   - status: 'in_progress'
   - teleCallStartedAt: current timestamp
4. Initialize AWS Chime (if configured):
   - Create meeting
   - Generate attendee tokens
   - Return meeting details
5. Notify customer: "Call accepted. Consultation started."
```

#### System Actions (Reject):
```typescript
// Endpoint: POST /make-server-3dd53475/tele-session/:sessionId/reject

1. Update session:
   - callStatus: 'rejected'
   - rejectedAt: current timestamp
   - rejectionReason: reason
2. Update booking:
   - status: 'cancelled'
   - cancellationReason: reason
   - refundInitiated: true
3. Initiate refund process
4. Notify customer: "Call rejected. Refund initiated."
```

### 2.6 Video Call Session

#### Customer & Staff Actions:
1. **Join Video Call** → AWS Chime meeting room
2. **Conduct Consultation** → Video/audio call
3. **Chat Messages** (optional) → In-call chat
4. **Share Screen** (optional) → Screen sharing
5. **End Call** → `POST /tele-session/:sessionId/end`

#### System Actions (During Call):
```typescript
// Real-time updates:
- Track call duration
- Store chat messages
- Monitor call quality
- Update session metadata
```

### 2.7 Call Completion

#### Customer or Staff Actions:
1. **End Call** → `POST /tele-session/:sessionId/end`
   - endedBy: 'customer' or 'staff'

#### System Actions:
```typescript
// Endpoint: POST /make-server-3dd53475/tele-session/:sessionId/end

1. Calculate call duration
2. Update session:
   - callStatus: 'ended'
   - endedAt: current timestamp
   - endedBy: 'customer' or 'staff'
   - duration: seconds
3. Update booking:
   - teleCallEndedAt: current timestamp
   - status: 'call_completed' (NOT 'completed' yet - needs OTP)
4. Notify both parties: "Call ended. Please verify completion OTP."
```

### 2.8 Service Completion (OTP Verification)

#### Vendor/Staff Actions:
1. **Enter Completion OTP** → `POST /booking/:bookingId/verify-otp-complete`
   - Action: 'end' or 'complete'
   - OTP: completion OTP

#### System Actions:
```typescript
// Same as home service completion:
// Endpoint: POST /make-server-3dd53475/booking/:bookingId/verify-otp-complete

1. Verify OTP
2. Complete booking
3. Realize earnings
4. Create settlement
5. Schedule payout
6. Award loyalty points
7. Send notifications
```

---

## 3. COMPLETE LIFECYCLE STATE MACHINE

### 3.1 Home Service States

```
┌─────────────┐
│   PENDING   │ ← Booking created, payment pending
└──────┬──────┘
       │ Payment Success
       ▼
┌─────────────┐
│  CONFIRMED  │ ← Payment completed, waiting for vendor
└──────┬──────┘
       │ Vendor Starts Ride
       ▼
┌──────────────────┐
│ VENDOR_EN_ROUTE  │ ← GPS tracking active
└──────┬───────────┘
       │ Vendor Arrives
       ▼
┌──────────────────┐
│ VENDOR_ARRIVED   │ ← GPS tracking stopped
└──────┬───────────┘
       │ START OTP Verified
       ▼
┌──────────────┐
│ IN_PROGRESS  │ ← Service being delivered
└──────┬───────┘
       │ END OTP Verified
       ▼
┌──────────────┐
│  COMPLETED   │ ← Service done, earnings realized
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  SETTLEMENT  │ ← Razorpay payout initiated
└──────┬───────┘
       │
       ▼
┌──────────────┐
│    PAYOUT    │ ← Vendor receives payment
└──────────────┘
```

### 3.2 Tele Service States

```
┌─────────────┐
│   PENDING   │ ← Booking created, payment pending
└──────┬──────┘
       │ Payment Success
       ▼
┌─────────────┐
│  ASSIGNED   │ ← Staff assigned (instant) or scheduled
└──────┬──────┘
       │ Staff Accepts
       ▼
┌─────────────┐
│  ACCEPTED   │ ← Ready for video call
└──────┬──────┘
       │ Customer Starts Call
       ▼
┌──────────────┐
│ CALL_RINGING │ ← Waiting for staff to accept call
└──────┬───────┘
       │ Staff Accepts Call
       ▼
┌──────────────┐
│ IN_PROGRESS  │ ← Video call active
└──────┬───────┘
       │ Call Ends
       ▼
┌──────────────────┐
│ CALL_COMPLETED    │ ← Call ended, needs OTP
└──────┬────────────┘
       │ END OTP Verified
       ▼
┌──────────────┐
│  COMPLETED   │ ← Service done, earnings realized
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  SETTLEMENT  │ ← Razorpay payout initiated
└──────┬───────┘
       │
       ▼
┌──────────────┐
│    PAYOUT    │ ← Vendor receives payment
└──────────────┘
```

---

## 4. PERSONA ACTIONS SUMMARY

### 4.1 Customer Actions

#### Home Services:
1. ✅ Browse home services
2. ✅ Select service & vendor
3. ✅ Enter delivery address
4. ✅ Select date/time
5. ✅ Complete payment
6. ✅ Receive booking confirmation
7. ✅ Track vendor in real-time (GPS)
8. ✅ Receive arrival notification
9. ✅ Share START OTP with vendor
10. ✅ Receive service started notification
11. ✅ Share END OTP with vendor
12. ✅ Receive completion notification
13. ✅ Rate & review service
14. ✅ View receipt & settlement details

#### Tele Services:
1. ✅ Browse tele services
2. ✅ Select role (vet/trainer/etc.)
3. ✅ Choose instant or scheduled
4. ✅ Select staff (if scheduled)
5. ✅ Complete payment
6. ✅ Receive staff assignment notification
7. ✅ Start video call
8. ✅ Join video consultation
9. ✅ Chat during call (optional)
10. ✅ End call
11. ✅ Share completion OTP
12. ✅ Receive completion notification
13. ✅ Rate & review consultation

### 4.2 Vendor Actions

#### Home Services:
1. ✅ Receive booking notification
2. ✅ View booking details
3. ✅ Start ride (begin GPS tracking)
4. ✅ Update location (automatic)
5. ✅ Mark arrived at location
6. ✅ Enter START OTP
7. ✅ Perform service
8. ✅ Upload completion photos (optional)
9. ✅ Add completion notes
10. ✅ Enter END OTP
11. ✅ Receive completion confirmation
12. ✅ View earnings & settlement

#### Tele Services:
1. ✅ Receive booking notification
2. ✅ Accept/reject instant consultation
3. ✅ View scheduled consultations
4. ✅ Receive video call notification
5. ✅ Accept/reject video call
6. ✅ Join video consultation
7. ✅ Conduct consultation
8. ✅ Chat during call (optional)
9. ✅ End call
10. ✅ Enter completion OTP
11. ✅ Receive completion confirmation
12. ✅ View earnings & settlement

### 4.3 Staff Actions (if different from vendor)

#### Home Services:
1. ✅ Receive booking assignment
2. ✅ Accept/reject booking
3. ✅ Start ride (if assigned)
4. ✅ Update location
5. ✅ Mark arrived
6. ✅ Enter START OTP
7. ✅ Perform service
8. ✅ Enter END OTP

#### Tele Services:
1. ✅ Receive consultation request
2. ✅ Accept/reject consultation
3. ✅ Receive video call
4. ✅ Accept/reject call
5. ✅ Join video consultation
6. ✅ Conduct consultation
7. ✅ End call
8. ✅ Enter completion OTP

---

## 5. KEY DIFFERENCES: HOME vs TELE

### 5.1 Home Services
- ✅ **GPS Tracking**: Real-time location tracking
- ✅ **Physical Presence**: Vendor travels to customer
- ✅ **Dual OTP**: START + END OTP required
- ✅ **Status Flow**: confirmed → vendor_en_route → vendor_arrived → in_progress → completed
- ✅ **Travel Time**: Calculated based on distance
- ✅ **Home Service Fee**: Additional fee for travel
- ✅ **Location Updates**: Continuous GPS updates during transit

### 5.2 Tele Services
- ✅ **Video Call**: AWS Chime integration
- ✅ **Remote Service**: No physical travel
- ✅ **Single OTP**: Only END OTP required
- ✅ **Status Flow**: pending → assigned → accepted → call_ringing → in_progress → call_completed → completed
- ✅ **Instant vs Scheduled**: Two booking types
- ✅ **Auto-Assignment**: Staff auto-assigned for instant tele
- ✅ **Call Management**: Ring, accept, reject, end call flows

---

## 6. PAYMENT & SETTLEMENT FLOW

### 6.1 Payment Processing

**Both Services:**
1. Customer initiates payment via Razorpay
2. Payment processed
3. Payment verified
4. Booking status updated to 'confirmed' (home) or 'assigned' (tele)
5. OTPs generated (if not already generated)

### 6.2 Settlement Flow

**After Service Completion:**
1. **Earnings Realization**:
   - Get vendor tier
   - Calculate commission rate
   - Calculate platform commission
   - Calculate vendor earnings
   - Create commission record

2. **Settlement Creation**:
   - Create settlement record
   - Get vendor bank details
   - Initiate Razorpay marketplace transfer
   - Update settlement status

3. **Payout Scheduling**:
   - Check payout policies
   - Calculate payout date
   - Create payout record

4. **Payout Execution**:
   - Execute on scheduled date
   - Transfer to vendor bank account
   - Update payout status

---

## 7. CURRENT IMPLEMENTATION STATUS

### 7.1 Home Services ✅
- ✅ Booking creation
- ✅ GPS tracking
- ✅ Location updates
- ✅ OTP verification
- ✅ Lifecycle management
- ✅ Payment processing
- ✅ Settlement & payout
- ⚠️ **Uses KV Store** (needs SQL migration)

### 7.2 Tele Services ✅
- ✅ Instant tele booking
- ✅ Scheduled tele booking
- ✅ Staff auto-assignment
- ✅ Video call integration (AWS Chime)
- ✅ Call management (accept/reject/end)
- ✅ OTP verification
- ✅ Lifecycle management
- ✅ Payment processing
- ✅ Settlement & payout
- ⚠️ **Uses KV Store** (needs SQL migration)

---

## 8. RECOMMENDATIONS

### 8.1 Immediate Actions
1. **Migrate to SQL**: Both flows use KV store - migrate to SQL repositories
2. **State Machine Validation**: Add formal state machine validation
3. **Error Handling**: Enhance error handling for edge cases
4. **Testing**: Add comprehensive E2E tests

### 8.2 Enhancements
1. **Real-time Updates**: Implement WebSocket/SSE for live tracking
2. **Call Quality Monitoring**: Track video call quality metrics
3. **Route Optimization**: Optimize vendor routes for multiple bookings
4. **Predictive ETA**: ML-based ETA prediction

---

**Document Status:** ✅ Complete  
**Last Updated:** 2025-01-27

