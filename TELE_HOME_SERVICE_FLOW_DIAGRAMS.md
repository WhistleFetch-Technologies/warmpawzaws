# Tele & Home Services - Visual Flow Diagrams

**Date:** 2025-01-27  
**Complete Flow Visualization with Persona Actions**

---

## 1. HOME SERVICE COMPLETE FLOW

### 1.1 Booking Creation to Payment

```
┌─────────────────────────────────────────────────────────────┐
│                    CUSTOMER ACTIONS                          │
└─────────────────────────────────────────────────────────────┘

1. Browse Home Services
   └─> GET /customer/services?serviceStyle=at_home
   └─> View service list with vendors

2. Select Service & Vendor
   └─> View vendor profile, ratings, pricing
   └─> Select specific service

3. Enter Delivery Address
   └─> Input customer location (lat, lng, address)
   └─> System calculates distance & travel time

4. Select Date/Time
   └─> Choose available time slot
   └─> System validates availability

5. Select Pet
   └─> Choose pet from customer's pet list

6. Review Pricing
   └─> Service amount: ₹X
   └─> Home service fee: ₹Y (based on distance)
   └─> Total: ₹(X + Y)

7. Create Booking
   └─> POST /home-service/book
   └─> Booking created with status: 'confirmed'
   └─> OTPs generated: START + END

8. Complete Payment
   └─> Razorpay payment gateway
   └─> POST /payments/verify
   └─> Payment status: 'completed'
```

### 1.2 Vendor Departure & GPS Tracking

```
┌─────────────────────────────────────────────────────────────┐
│                    VENDOR ACTIONS                            │
└─────────────────────────────────────────────────────────────┘

1. View Booking Notification
   └─> Booking appears in vendor dashboard
   └─> Status: 'confirmed'

2. Start Ride
   └─> POST /home-service/:bookingId/start-ride
   └─> Vendor provides current location
   └─> System starts GPS tracking

┌─────────────────────────────────────────────────────────────┐
│                    SYSTEM ACTIONS                            │
└─────────────────────────────────────────────────────────────┘

1. Update Booking Status
   └─> status: 'vendor_en_route'
   └─> vendorDepartedAt: timestamp
   └─> gpsTracking.isActive: true
   └─> gpsTracking.trackingId: generated

2. Create Tracking Session
   └─> session:tracking:{trackingId}
   └─> For real-time SSE updates

3. Notify Customer
   └─> "Vendor is on the way"
   └─> Customer can track in real-time

┌─────────────────────────────────────────────────────────────┐
│                    CUSTOMER ACTIONS (Real-time)               │
└─────────────────────────────────────────────────────────────┘

1. Receive Notification
   └─> "Vendor is on the way"

2. View Live GPS Tracking
   └─> GET /tracking/location/:bookingId
   └─> Real-time map with vendor location
   └─> ETA updates automatically

3. Monitor Progress
   └─> See vendor moving on map
   └─> Distance & ETA updates
```

### 1.3 Location Updates (Continuous)

```
┌─────────────────────────────────────────────────────────────┐
│                    VENDOR APP (Automatic)                    │
└─────────────────────────────────────────────────────────────┘

Every 30 seconds:
   └─> POST /home-service/:bookingId/update-location
   └─> Sends current GPS coordinates

┌─────────────────────────────────────────────────────────────┐
│                    SYSTEM ACTIONS                            │
└─────────────────────────────────────────────────────────────┘

1. Add Waypoint
   └─> Add to waypoints array
   └─> Calculate distance from previous waypoint
   └─> Update totalDistance

2. Recalculate ETA
   └─> Calculate remaining distance
   └─> ETA = remainingDistance × 3 min/km

3. Update Tracking Session
   └─> Update session:tracking:{trackingId}
   └─> Customer receives real-time updates
```

### 1.4 Vendor Arrival

```
┌─────────────────────────────────────────────────────────────┐
│                    VENDOR ACTIONS                            │
└─────────────────────────────────────────────────────────────┘

1. Arrive at Customer Location
   └─> POST /home-service/:bookingId/arrived
   └─> Vendor taps "Arrived" button

┌─────────────────────────────────────────────────────────────┐
│                    SYSTEM ACTIONS                            │
└─────────────────────────────────────────────────────────────┘

1. Update Booking
   └─> status: 'vendor_arrived'
   └─> vendorArrivedAt: timestamp
   └─> gpsTracking.isActive: false

2. Notify Customer
   └─> "Vendor has arrived. Please share START OTP: {startOTP}"

┌─────────────────────────────────────────────────────────────┐
│                    CUSTOMER ACTIONS                          │
└─────────────────────────────────────────────────────────────┘

1. Receive Arrival Notification
   └─> See START OTP in notification

2. Share START OTP with Vendor
   └─> Provide OTP to vendor
```

### 1.5 Service Start (OTP Verification)

```
┌─────────────────────────────────────────────────────────────┐
│                    VENDOR ACTIONS                            │
└─────────────────────────────────────────────────────────────┘

1. Enter START OTP
   └─> POST /booking/:bookingId/verify-otp-complete
   └─> Action: 'start'
   └─> OTP: customer's start OTP

┌─────────────────────────────────────────────────────────────┐
│                    SYSTEM ACTIONS                            │
└─────────────────────────────────────────────────────────────┘

1. Verify START OTP
   └─> Check booking.otp.start === provided OTP

2. Update Booking
   └─> status: 'in_progress'
   └─> startedAt: timestamp
   └─> otp.startUsed: true

3. Notify Customer
   └─> "Service has started. End OTP: {endOTP}"
   └─> Customer saves END OTP for completion

┌─────────────────────────────────────────────────────────────┐
│                    CUSTOMER ACTIONS                          │
└─────────────────────────────────────────────────────────────┘

1. Receive Notification
   └─> "Service started"
   └─> Note END OTP: {endOTP}
```

### 1.6 Service Delivery

```
┌─────────────────────────────────────────────────────────────┐
│                    VENDOR ACTIONS                            │
└─────────────────────────────────────────────────────────────┘

1. Perform Service
   └─> Actual service delivery
   └─> Duration varies by service type

2. Take Photos (Optional)
   └─> Upload completion photos
   └─> Stored in booking.completionPhotos

3. Add Notes (Optional)
   └─> Service completion notes
   └─> Stored in booking.completionNotes

┌─────────────────────────────────────────────────────────────┐
│                    CUSTOMER ACTIONS                          │
└─────────────────────────────────────────────────────────────┘

1. Monitor Service
   └─> Can chat with vendor if needed
   └─> Wait for completion
```

### 1.7 Service Completion

```
┌─────────────────────────────────────────────────────────────┐
│                    VENDOR ACTIONS                            │
└─────────────────────────────────────────────────────────────┘

1. Complete Service
   └─> POST /booking/:bookingId/verify-otp-complete
   └─> Action: 'end'
   └─> OTP: customer's end OTP

┌─────────────────────────────────────────────────────────────┐
│                    SYSTEM ACTIONS (Complete Lifecycle)       │
└─────────────────────────────────────────────────────────────┘

STEP 1: Verify OTP & Complete Booking
   └─> Verify END OTP matches
   └─> status: 'completed'
   └─> completedAt: timestamp
   └─> duration: calculated
   └─> otp.endUsed: true

STEP 2: Realize Earnings
   └─> Get vendor tier
   └─> Calculate commission rate (tier-based)
   └─> Calculate platform commission
   └─> Calculate vendor earnings
   └─> Create commission record in SQL

STEP 3: Create Settlement
   └─> Create settlement record
   └─> Get vendor bank details
   └─> Initiate Razorpay marketplace payout
   └─> Update settlement status

STEP 4: Schedule Payout
   └─> Check payout policies
   └─> Calculate payout date (hold period)
   └─> Create payout record

STEP 5: Award Loyalty Points
   └─> Award points to customer
   └─> Based on service type and amount

STEP 6: Send Notifications
   └─> Customer: "Service completed. Please rate."
   └─> Vendor: "Service completed. Earnings: ₹X"

┌─────────────────────────────────────────────────────────────┐
│                    CUSTOMER ACTIONS                          │
└─────────────────────────────────────────────────────────────┘

1. Receive Completion Notification
   └─> "Service completed. Please rate your experience."

2. Rate & Review
   └─> POST /booking/:bookingId/review
   └─> Rating (1-5 stars)
   └─> Review text (optional)

3. View Receipt
   └─> Booking details
   └─> Payment information
   └─> Settlement details
```

---

## 2. TELE CONSULTATION COMPLETE FLOW

### 2.1 Instant Tele Booking Creation

```
┌─────────────────────────────────────────────────────────────┐
│                    CUSTOMER ACTIONS                          │
└─────────────────────────────────────────────────────────────┘

1. Browse Tele Services
   └─> GET /customer/services?serviceStyle=tele
   └─> View available tele consultation services

2. Select Service Type
   └─> Choose "Instant Tele Consultation"
   └─> Or "Scheduled Tele Consultation"

3. Select Role
   └─> Choose role: "Veterinarian", "Trainer", etc.
   └─> GET /tele-services/instant/available-staff?roleId=xxx

4. View Available Staff (Optional)
   └─> See available consultants
   └─> Ratings, experience, fees

5. Create Booking
   └─> POST /tele-services/instant/create-booking
   └─> Body: { customerId, petId, roleId, consultationFee }

┌─────────────────────────────────────────────────────────────┐
│                    SYSTEM ACTIONS                            │
└─────────────────────────────────────────────────────────────┘

1. Create Booking
   └─> bookingId: generated
   └─> status: 'pending_payment'
   └─> serviceStyle: 'tele'
   └─> bookingType: 'instant_tele'
   └─> No OTP yet (generated after payment)

2. Return Booking
   └─> Booking details
   └─> Consultation fee
   └─> Proceed to payment
```

### 2.2 Payment & Staff Assignment

```
┌─────────────────────────────────────────────────────────────┐
│                    CUSTOMER ACTIONS                          │
└─────────────────────────────────────────────────────────────┘

1. Complete Payment
   └─> Razorpay payment gateway
   └─> Payment success

2. Assign Staff
   └─> POST /tele-services/instant/assign-staff
   └─> Body: { bookingId, paymentId, razorpayPaymentId }

┌─────────────────────────────────────────────────────────────┐
│                    SYSTEM ACTIONS                            │
└─────────────────────────────────────────────────────────────┘

1. Update Payment Info
   └─> paymentId: set
   └─> razorpayPaymentId: set
   └─> status: 'payment_completed'

2. Auto-Assign Staff
   └─> Find available staff for role
   └─> Check staff availability
   └─> Assign best match (by rating/availability)

3. If Staff Available:
   └─> assignedStaffId: set
   └─> status: 'assigned'
   └─> sessionLink: generated
   └─> Notify customer: "Staff assigned! Join now."
   └─> Notify staff: "New consultation request"

4. If No Staff Available:
   └─> Add to queue
   └─> queuePosition: set
   └─> estimatedWait: calculated
   └─> Notify customer: "In queue. We'll notify when available."
```

### 2.3 Staff Acceptance

```
┌─────────────────────────────────────────────────────────────┐
│                    STAFF ACTIONS                             │
└─────────────────────────────────────────────────────────────┘

1. Receive Notification
   └─> "New consultation request"

2. Accept/Reject
   └─> POST /tele-services/instant/assign-staff
   └─> If accept: status → 'accepted'
   └─> If reject: status → 'rejected', refund initiated

┌─────────────────────────────────────────────────────────────┐
│                    SYSTEM ACTIONS                            │
└─────────────────────────────────────────────────────────────┘

If Accepted:
   1. Update booking
      └─> status: 'accepted'
      └─> Generate completion OTP
   2. Notify customer
      └─> "Consultant accepted. Ready to start call."

If Rejected:
   1. Update booking
      └─> status: 'rejected'
      └─> refundInitiated: true
   2. Initiate refund
   3. Notify customer
      └─> "Consultant declined. Refund initiated."
```

### 2.4 Video Call Initiation

```
┌─────────────────────────────────────────────────────────────┐
│                    CUSTOMER ACTIONS                          │
└─────────────────────────────────────────────────────────────┘

1. Start Video Call
   └─> POST /booking/:bookingId/start-video-call
   └─> Can only start within 10 min of appointment time

┌─────────────────────────────────────────────────────────────┐
│                    SYSTEM ACTIONS                            │
└─────────────────────────────────────────────────────────────┘

1. Validate Booking
   └─> Check booking exists
   └─> Check serviceStyle === 'tele'
   └─> Check status: 'accepted' or 'assigned'
   └─> Check time window (within 10 min)

2. Create Tele Session
   └─> teleSessionId: generated
   └─> callStatus: 'ringing'
   └─> initiatedBy: 'customer'
   └─> Store in tele_session:{sessionId}

3. Update Booking
   └─> teleSessionId: set
   └─> status: 'call_ringing'
   └─> teleCallInitiatedAt: timestamp

4. Notify Staff
   └─> "Incoming video call"
   └─> Push notification
```

### 2.5 Staff Accepts/Rejects Call

```
┌─────────────────────────────────────────────────────────────┐
│                    STAFF ACTIONS                             │
└─────────────────────────────────────────────────────────────┘

1. Receive Call Notification
   └─> "Incoming video call"

2. Accept Call
   └─> POST /tele-session/:sessionId/accept
   └─> Staff joins video call

OR

2. Reject Call
   └─> POST /tele-session/:sessionId/reject
   └─> Provide reason (optional)

┌─────────────────────────────────────────────────────────────┐
│                    SYSTEM ACTIONS (Accept)                   │
└─────────────────────────────────────────────────────────────┘

1. Update Session
   └─> callStatus: 'active'
   └─> acceptedAt: timestamp

2. Update Booking
   └─> status: 'in_progress'
   └─> teleCallStartedAt: timestamp

3. Initialize AWS Chime (if configured)
   └─> Create meeting
   └─> Generate attendee tokens
   └─> Return meeting details

4. Notify Customer
   └─> "Call accepted. Consultation started."

┌─────────────────────────────────────────────────────────────┐
│                    SYSTEM ACTIONS (Reject)                   │
└─────────────────────────────────────────────────────────────┘

1. Update Session
   └─> callStatus: 'rejected'
   └─> rejectedAt: timestamp
   └─> rejectionReason: reason

2. Update Booking
   └─> status: 'cancelled'
   └─> cancellationReason: reason
   └─> refundInitiated: true

3. Initiate Refund
   └─> Process refund via Razorpay

4. Notify Customer
   └─> "Call rejected. Refund initiated."
```

### 2.6 Video Call Session

```
┌─────────────────────────────────────────────────────────────┐
│                    CUSTOMER & STAFF ACTIONS                  │
└─────────────────────────────────────────────────────────────┘

1. Join Video Call
   └─> AWS Chime meeting room
   └─> Use attendee tokens
   └─> Video/audio enabled

2. Conduct Consultation
   └─> Video/audio call
   └─> Duration: varies

3. Chat Messages (Optional)
   └─> In-call chat
   └─> Messages stored in session

4. Share Screen (Optional)
   └─> Screen sharing
   └─> If enabled in Chime config

5. End Call
   └─> POST /tele-session/:sessionId/end
   └─> endedBy: 'customer' or 'staff'

┌─────────────────────────────────────────────────────────────┐
│                    SYSTEM ACTIONS                            │
└─────────────────────────────────────────────────────────────┘

During Call:
   └─> Track call duration
   └─> Store chat messages
   └─> Monitor call quality
   └─> Update session metadata

On End Call:
   1. Calculate Duration
      └─> duration: seconds

   2. Update Session
      └─> callStatus: 'ended'
      └─> endedAt: timestamp
      └─> endedBy: 'customer' or 'staff'

   3. Update Booking
      └─> teleCallEndedAt: timestamp
      └─> status: 'call_completed' (NOT 'completed' yet)

   4. Notify Both Parties
      └─> "Call ended. Please verify completion OTP."
```

### 2.7 Service Completion (OTP Verification)

```
┌─────────────────────────────────────────────────────────────┐
│                    STAFF ACTIONS                             │
└─────────────────────────────────────────────────────────────┘

1. Enter Completion OTP
   └─> POST /booking/:bookingId/verify-otp-complete
   └─> Action: 'end'
   └─> OTP: completion OTP

┌─────────────────────────────────────────────────────────────┐
│                    SYSTEM ACTIONS (Same as Home Service)     │
└─────────────────────────────────────────────────────────────┘

1. Verify OTP
2. Complete booking
3. Realize earnings
4. Create settlement
5. Schedule payout
6. Award loyalty points
7. Send notifications
```

---

## 3. COMPLETE STATE TRANSITIONS

### 3.1 Home Service States

```
pending
  │
  ├─[Payment Success]─> confirmed
  │
confirmed
  │
  ├─[Vendor Starts Ride]─> vendor_en_route
  │
vendor_en_route
  │
  ├─[Vendor Arrives]─> vendor_arrived
  │
vendor_arrived
  │
  ├─[START OTP Verified]─> in_progress
  │
in_progress
  │
  ├─[END OTP Verified]─> completed
  │
completed
  │
  ├─[Automatic]─> settlement_created
  │
settlement_created
  │
  ├─[Automatic]─> payout_scheduled
  │
payout_scheduled
  │
  ├─[On Scheduled Date]─> payout_completed
```

### 3.2 Tele Service States

```
pending_payment
  │
  ├─[Payment Success]─> payment_completed
  │
payment_completed
  │
  ├─[Staff Assigned]─> assigned
  │
  ├─[No Staff Available]─> queued
  │
assigned
  │
  ├─[Staff Accepts]─> accepted
  │
  ├─[Staff Rejects]─> rejected ─> cancelled ─> refunded
  │
accepted
  │
  ├─[Customer Starts Call]─> call_ringing
  │
call_ringing
  │
  ├─[Staff Accepts Call]─> in_progress
  │
  ├─[Staff Rejects Call]─> cancelled ─> refunded
  │
in_progress
  │
  ├─[Call Ends]─> call_completed
  │
call_completed
  │
  ├─[END OTP Verified]─> completed
  │
completed
  │
  ├─[Automatic]─> settlement_created
  │
settlement_created
  │
  ├─[Automatic]─> payout_scheduled
  │
payout_scheduled
  │
  ├─[On Scheduled Date]─> payout_completed
```

---

## 4. KEY API ENDPOINTS

### 4.1 Home Services

| Endpoint | Method | Purpose | Persona |
|----------|--------|---------|---------|
| `/home-service/book` | POST | Create booking | Customer |
| `/home-service/:bookingId/start-ride` | POST | Start GPS tracking | Vendor |
| `/home-service/:bookingId/update-location` | POST | Update location | Vendor |
| `/home-service/:bookingId/arrived` | POST | Mark arrived | Vendor |
| `/booking/:bookingId/verify-otp-complete` | POST | Verify OTP (start/end) | Vendor |
| `/tracking/location/:bookingId` | GET | Get live location | Customer |

### 4.2 Tele Services

| Endpoint | Method | Purpose | Persona |
|----------|--------|---------|---------|
| `/tele-services/instant/create-booking` | POST | Create instant booking | Customer |
| `/tele-services/instant/assign-staff` | POST | Assign staff after payment | System/Customer |
| `/tele-services/instant/start-session` | POST | Start consultation | Customer/Staff |
| `/booking/:bookingId/start-video-call` | POST | Initiate video call | Customer |
| `/tele-session/:sessionId/accept` | POST | Accept call | Staff |
| `/tele-session/:sessionId/reject` | POST | Reject call | Staff |
| `/tele-session/:sessionId/end` | POST | End call | Customer/Staff |
| `/booking/:bookingId/verify-otp-complete` | POST | Verify completion OTP | Staff |

---

## 5. DATA STORAGE

### 5.1 Current Implementation (KV Store)

**Home Services:**
- `booking:{bookingId}` - Booking object
- `session:tracking:{trackingId}` - GPS tracking session
- `customer:{customerId}:bookings` - Customer booking list
- `vendor:{vendorId}:bookings` - Vendor booking list

**Tele Services:**
- `tele:booking:{bookingId}` - Tele booking object
- `tele_session:{sessionId}` - Video call session
- `tele:queue:{roleId}` - Staff queue for instant tele
- `tele:staff:{staffId}` - Staff availability

### 5.2 SQL Tables (Target Migration)

**Home Services:**
- `bookings` - Booking records
- `gps_tracking_sessions` - GPS tracking data
- `booking_status_transitions` - Status history

**Tele Services:**
- `bookings` - Booking records (serviceStyle='tele')
- `tele_sessions` - Video call sessions
- `tele_queues` - Staff assignment queues

---

## 6. NOTIFICATIONS FLOW

### 6.1 Home Services Notifications

1. **Booking Created** → Customer: "Booking confirmed"
2. **Vendor Starts Ride** → Customer: "Vendor is on the way"
3. **Vendor Arrives** → Customer: "Vendor arrived. Share START OTP: {otp}"
4. **Service Started** → Customer: "Service started. End OTP: {otp}"
5. **Service Completed** → Customer: "Service completed. Please rate."
6. **Service Completed** → Vendor: "Service completed. Earnings: ₹X"

### 6.2 Tele Services Notifications

1. **Payment Completed** → Customer: "Payment successful. Staff being assigned..."
2. **Staff Assigned** → Customer: "Staff assigned! Join consultation now."
3. **In Queue** → Customer: "In queue. Position: {n}. Estimated wait: {m} min"
4. **Call Ringing** → Staff: "Incoming video call"
5. **Call Accepted** → Customer: "Call accepted. Consultation started."
6. **Call Rejected** → Customer: "Call rejected. Refund initiated."
7. **Call Ended** → Both: "Call ended. Please verify completion OTP."
8. **Service Completed** → Customer: "Consultation completed. Please rate."
9. **Service Completed** → Staff: "Consultation completed. Earnings: ₹X"

---

## 7. PAYMENT & SETTLEMENT DETAILS

### 7.1 Payment Processing

**Both Services:**
1. Customer initiates Razorpay payment
2. Payment processed via Razorpay gateway
3. Payment webhook received
4. Payment verified: `POST /payments/verify`
5. Booking updated: `paymentStatus: 'completed'`
6. Booking status: `confirmed` (home) or `assigned` (tele)

### 7.2 Settlement Flow (After Completion)

**Automatic Process:**
1. **Earnings Realization**:
   - Get vendor tier from `vendors` table
   - Calculate commission: `totalAmount × commissionRate / 100`
   - Vendor earnings: `totalAmount - commission`
   - Create record in `commissions` table

2. **Settlement Creation**:
   - Create record in `settlements` table
   - Get vendor bank details from `vendor_bank_details`
   - Initiate Razorpay marketplace transfer
   - Update settlement status

3. **Payout Scheduling**:
   - Check `platform_settings` for payout policies
   - Calculate payout date (hold period)
   - Create record in `payouts` table
   - Link to settlement

4. **Payout Execution**:
   - Execute on scheduled date
   - Transfer to vendor bank account
   - Update payout status: 'completed'

---

## 8. CURRENT IMPLEMENTATION STATUS

### 8.1 Home Services ✅

- ✅ Booking creation with address & location
- ✅ GPS tracking initiation
- ✅ Real-time location updates
- ✅ Vendor arrival marking
- ✅ Dual OTP system (START + END)
- ✅ Service completion
- ✅ Earnings realization
- ✅ Settlement creation
- ✅ Payout scheduling
- ⚠️ **Uses KV Store** (needs SQL migration)

### 8.2 Tele Services ✅

- ✅ Instant tele booking
- ✅ Scheduled tele booking
- ✅ Staff auto-assignment
- ✅ Queue management
- ✅ Video call integration (AWS Chime)
- ✅ Call management (ring/accept/reject/end)
- ✅ Single OTP system (END only)
- ✅ Service completion
- ✅ Earnings realization
- ✅ Settlement creation
- ✅ Payout scheduling
- ⚠️ **Uses KV Store** (needs SQL migration)

---

## 9. GAPS & RECOMMENDATIONS

### 9.1 Immediate Actions

1. **SQL Migration**: Both flows use KV store extensively
   - Migrate to `bookings` SQL table
   - Migrate GPS tracking to `gps_tracking_sessions`
   - Migrate tele sessions to `tele_sessions`

2. **State Machine Validation**: Add formal validation
   - Prevent invalid state transitions
   - Enforce required actions

3. **Error Handling**: Enhance for edge cases
   - Payment failures
   - GPS tracking failures
   - Video call failures

### 9.2 Enhancements

1. **Real-time Updates**: WebSocket/SSE for live tracking
2. **Route Optimization**: For multiple bookings
3. **Predictive ETA**: ML-based ETA prediction
4. **Call Quality Monitoring**: Track video call metrics
5. **Auto-retry**: For failed payments/settlements

---

**Document Status:** ✅ Complete  
**Last Updated:** 2025-01-27

