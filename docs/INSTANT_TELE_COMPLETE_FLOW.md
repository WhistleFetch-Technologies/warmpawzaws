# Instant Tele Consultation - Complete Flow Documentation

## Overview
Instant tele consultation allows customers to connect with available veterinarians or nutritionists immediately via video call. The flow supports two paths:
1. **Specific Provider**: Customer selects a specific vet/nutritionist → Payment → Direct video call
2. **Auto-Assign**: Customer pays first → Joins queue → First available provider accepts → Video call

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. MODE SELECTION (TeleConsultationRouter)                      │
│    - User chooses: Instant vs Scheduled                         │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼ (Instant selected)
┌─────────────────────────────────────────────────────────────────┐
│ 2. AVAILABLE NOW VENDOR LIST                                     │
│    Endpoint: GET /customer/tele/available-now                    │
│    - Shows vendors with staff who are "Available Now"            │
│    - Filters: is_active, mobile_verified, tele services        │
│    Handler: handleSelectInstant()                               │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼ (Vendor selected)
┌─────────────────────────────────────────────────────────────────┐
│ 3. SERVICE SELECTION (instant-service step)                     │
│    Endpoint: GET /customer/vendor/{vendorId}/services?serviceStyle=tele │
│    - Shows tele services for selected vendor                     │
│    - User selects service (price, duration shown)                │
│    Handler: handleSelectInstantService()                        │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼ (Service selected)
┌─────────────────────────────────────────────────────────────────┐
│ 4. PET SELECTION (instant-pet step)                            │
│    Endpoint: GET /customer/pets/{phone}                         │
│    - User selects pet for consultation                           │
│    - Can add new pet if needed                                   │
│    Handler: handleSelectPet()                                  │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼ (Pet selected)
┌─────────────────────────────────────────────────────────────────┐
│ 5. PAYMENT (UniversalPaymentPage)                                │
│    flowType: 'tele-instant'                                      │
│    type: 'booking'                                               │
│    - Payment happens BEFORE booking creation                     │
│    - For instant tele: bookingCreationDeferred = true            │
│    - Razorpay payment gateway                                   │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼ (Payment successful)
┌─────────────────────────────────────────────────────────────────┐
│ 6A. SPECIFIC PROVIDER PATH                                       │
│    - Booking created immediately with vendorId + staffId         │
│    - Navigate directly to video-call screen                     │
│    - Booking status: 'confirmed', is_instant: true               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 6B. AUTO-ASSIGN PATH (if no specific provider)                  │
│    - Order created (not booking yet)                             │
│    - paymentOrderId stored                                       │
│    - Navigate to instant-queue screen                            │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. QUEUE JOIN (InstantTeleQueue component)                     │
│    Endpoint: POST /customer/tele/join-queue                      │
│    - Customer joins queue for next available provider           │
│    - Queue entry created in tele_queue table                    │
│    - Status: 'waiting', position calculated                      │
│    - SSE connection for real-time updates                        │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼ (Provider accepts)
┌─────────────────────────────────────────────────────────────────┐
│ 8. PROVIDER ACCEPTANCE                                          │
│    Endpoint: POST /staff/{staffId}/tele-queue/accept            │
│    - Provider accepts queue entry                                │
│    - Booking created automatically                               │
│    - Video call meeting created                                  │
│    - Customer notified via SSE                                   │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 9. VIDEO CALL                                                   │
│    - Customer navigates to video-call screen                    │
│    - Meeting ID from booking metadata                            │
│    - Video call interface loads                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detailed Step-by-Step Flow

### Step 1: Mode Selection
**File**: `TeleConsultationRouter.tsx`  
**Component**: `ModeSelection`

- User sees two options:
  - **Instant Consultation**: Connect immediately (<5 min wait)
  - **Scheduled Consultation**: Choose vet and book time slot

**Handler**: `handleSelectInstant()`
```typescript
// Loads available vendors via GET /customer/tele/available-now
// Sets step to 'instant-vendor-list'
```

---

### Step 2: Available Now Vendor List
**File**: `TeleConsultationRouter.tsx`  
**Component**: `InstantVendorList`  
**Endpoint**: `GET /customer/tele/available-now`

**Backend Logic** (`instant-tele-queue.ts`):
- Queries `staff_tele_availability` table for staff with `is_available = true`
- Filters: `is_active = true`, `mobile_verified = true`
- Includes solo vendors (vendors with tele services, no staff)
- Returns vendors with available staff

**Response**:
```json
{
  "vendors": [
    {
      "vendorId": "uuid",
      "vendorName": "Pet Clinic",
      "photo": "url",
      "city": "Mumbai"
    }
  ]
}
```

**Handler**: `handleSelectInstantVendor(vendor)`
- Sets `selectedInstantVendor`
- Loads vendor's tele services
- Moves to `instant-service` step

---

### Step 3: Service Selection
**File**: `TeleConsultationRouter.tsx`  
**Component**: `InstantServiceSelection`  
**Endpoint**: `GET /customer/vendor/{vendorId}/services?serviceStyle=tele`

**Backend**: Returns vendor's tele consultation services

**Response**:
```json
{
  "services": [
    {
      "id": "uuid",
      "serviceId": "uuid",
      "name": "General Consultation",
      "description": "Quick video consultation",
      "price": 399,
      "duration": 15
    }
  ]
}
```

**Handler**: `handleSelectInstantService(service)`
- Sets `selectedService`
- Moves to `instant-pet` step

---

### Step 4: Pet Selection
**File**: `TeleConsultationRouter.tsx`  
**Component**: `InstantPetSelection`  
**Endpoint**: `GET /customer/pets/{phone}`

**Response**:
```json
{
  "pets": [
    {
      "id": "uuid",
      "name": "Buddy",
      "type": "dog",
      "breed": "Golden Retriever",
      "photo": "url"
    }
  ]
}
```

**Handler**: `handleSelectPet(pet)`
- Sets `selectedPet`
- **Navigates to payment screen** via `onNavigate('payment', {...})`
- Passes all booking details:
  ```typescript
  {
    flowType: 'tele-instant',
    vendorId: selectedInstantVendor.vendorId,
    vendorName: selectedInstantVendor.vendorName,
    serviceId: selectedService.serviceId,
    serviceName: selectedService.name,
    totalAmount: selectedService.price,
    petId: pet.id,
    petName: pet.name,
    customerId,
    category: 'vet',
    serviceType: 'tele'
  }
  ```

---

### Step 5: Payment (UniversalPaymentPage)
**File**: `UniversalPaymentPage.tsx`  
**Props**: `flowType: 'tele-instant'`, `type: 'booking'`

#### Payment Flow Logic:

**Phase 1: Pre-Payment Validation**
- Policy acceptance check (for bookings)
- Address validation (if needed)

**Phase 2: Booking Creation Strategy**
```typescript
// For tele-instant: NO booking created before payment
if (type === 'booking' && flowType === 'tele-instant') {
  currentBookingId = undefined; // Skip booking creation
  // Booking will be created AFTER payment via instant-after-payment endpoint
}
```

**Phase 3: Payment Record Creation**
- Creates payment record in `payments` table
- Status: 'pending'
- Links to order (if order created) or booking (if booking exists)

**Phase 4: Razorpay Order Creation**
- Endpoint: `POST /razorpay/create-order`
- Creates Razorpay order with amount
- Returns: `razorpayOrderId`, `keyId`, `orderAmount`

**Phase 5: Razorpay Checkout**
- Loads Razorpay script dynamically
- Opens Razorpay modal
- User completes payment

**Phase 6: Payment Verification**
- Endpoint: `POST /razorpay/verify-payment`
- Verifies Razorpay signature
- Updates payment status to 'completed'

**Phase 7: Post-Payment Actions**
```typescript
// For tele-instant flow:
if (flowType === 'tele-instant') {
  // Call instant-after-payment endpoint
  const instantRes = await apiClient.post('/customer/tele/instant-after-payment', {
    paymentId: paymentRes.id,
    vendorId,
    serviceId: finalServiceId,
    petId,
    customerId,
    amount: finalAmount
  });
  
  // Extract bookingId from response
  const bookingId = instantRes.bookingId;
  
  // Call onSuccess with bookingId
  onSuccess(bookingId, undefined, otpCode, { isInstantTele: true });
}
```

**Backend Endpoint**: `POST /customer/tele/instant-after-payment`
- Creates booking with:
  - `status: 'confirmed'`
  - `is_instant: true`
  - `service_type: 'tele'`
  - `booking_date`: Today
  - `booking_time`: Current time
- Generates OTP code
- Returns `bookingId`

---

### Step 6A: Specific Provider Path (Direct Video Call)
**After Payment Success**:
- `onSuccess(bookingId)` called
- Navigation: `onNavigate('video-call', { bookingId })`
- Customer goes directly to video call screen
- No queue involved

---

### Step 6B: Auto-Assign Path (Queue)
**After Payment Success**:
- `onSuccess(undefined, orderId)` called (orderId, not bookingId)
- `paymentOrderId` stored in state
- Navigation: `onNavigate('instant-queue', { paymentOrderId })`
- Customer goes to queue screen

---

### Step 7: Queue Join (Auto-Assign Only)
**File**: `InstantTeleQueue.tsx` (if exists) or handled in router  
**Endpoint**: `POST /customer/tele/join-queue`

**Request**:
```json
{
  "customerId": "uuid",
  "staffId": "uuid" | null,  // null for auto-assign
  "vendorId": "uuid" | null,  // set for solo vendors
  "petId": "uuid",
  "serviceId": "uuid",
  "paymentOrderId": "uuid",   // ✅ Required: validates payment
  "symptoms": "optional",
  "urgency": "low|medium|high"
}
```

**Backend Validation** (`instant-tele-queue.ts`):
1. **Payment Validation**:
   ```sql
   SELECT * FROM orders 
   WHERE id = $paymentOrderId 
     AND customer_id = $customerId 
     AND status = 'paid'
   ```
   - Must exist and be paid
   - Returns 400 if invalid

2. **Provider Availability Check**:
   - For staff: Checks `staff_tele_availability.is_available = true`
   - For solo vendor: Checks `vendor_services` with `publish_status = 'published'`

3. **Queue Entry Creation**:
   ```sql
   INSERT INTO tele_queue (
     customer_id, staff_id, vendor_id, pet_id, service_id,
     position, status, price, service_name, duration_minutes,
     expires_at
   ) VALUES (...)
   ```
   - Position calculated: `MAX(position) + 1`
   - Status: `'waiting'`
   - Expires in 5 minutes (configurable)

**Response**:
```json
{
  "success": true,
  "queueEntry": {
    "id": "uuid",
    "position": 2,
    "status": "waiting",
    "expiresAt": "2026-01-17T10:30:00Z",
    "estimatedWaitMinutes": 20
  }
}
```

**Real-Time Updates**:
- SSE endpoint: `GET /customer/tele/queue-status/:queueId`
- Polls for status changes: `waiting` → `accepted` → `booking_created`

---

### Step 8: Provider Acceptance
**Endpoint**: `POST /staff/{staffId}/tele-queue/accept`

**Backend Logic**:
1. Provider accepts queue entry
2. **Booking Creation**:
   ```sql
   INSERT INTO bookings (
     customer_id, vendor_id, staff_id, pet_id, service_id,
     service_type, service_name, booking_date, booking_time,
     status, is_instant, total_amount, otp_code
   ) VALUES (...)
   ```
3. **Video Call Meeting Creation**:
   - Creates meeting via video-call endpoints
   - Stores `meetingId` in booking metadata
4. **Queue Entry Update**:
   ```sql
   UPDATE tele_queue 
   SET status = 'accepted', 
       booking_id = $bookingId,
       resolved_at = NOW()
   WHERE id = $queueId
   ```
5. **Customer Notification**:
   - SSE event sent: `{ type: 'accepted', bookingId, meetingId }`

**Response**:
```json
{
  "success": true,
  "bookingId": "uuid",
  "meetingId": "uuid",
  "message": "Customer accepted, booking created"
}
```

---

### Step 9: Video Call
**Navigation**: `onNavigate('video-call', { bookingId, meetingId })`

**Video Call Screen**:
- Loads meeting details from booking
- Connects to video call service
- Displays video interface
- Chat functionality available
- Prescription can be updated by provider

---

## Key Backend Endpoints

### Customer Endpoints

1. **GET /customer/tele/available-now**
   - Returns vendors with available staff
   - Filters: active, verified, tele services enabled

2. **GET /customer/vendor/{vendorId}/services?serviceStyle=tele**
   - Returns vendor's tele services

3. **POST /customer/tele/instant-after-payment**
   - Creates booking after payment for instant tele
   - Called by UniversalPaymentPage after Razorpay success

4. **POST /customer/tele/join-queue**
   - Joins queue for instant consultation
   - Validates payment via `paymentOrderId`
   - Creates queue entry

5. **GET /customer/tele/queue-status/:queueId**
   - SSE endpoint for real-time queue updates
   - Returns: position, status, bookingId (when accepted)

6. **DELETE /customer/tele/leave-queue/:queueId**
   - Customer leaves queue
   - Updates status to 'cancelled'

### Staff Endpoints

1. **PUT /staff/:staffId/tele-availability**
   - Toggle "Available Now" status
   - Requires: `mobile_verified = true`
   - Updates `staff_tele_availability` table

2. **GET /staff/:staffId/tele-availability**
   - Get current availability status
   - Returns: `isAvailable`, `queueCount`

3. **GET /staff/:staffId/tele-queue**
   - Get queue entries for provider
   - Returns list of waiting customers

4. **POST /staff/:staffId/tele-queue/accept**
   - Accept queue entry
   - Creates booking and video call meeting
   - Notifies customer via SSE

5. **POST /staff/:staffId/tele-queue/skip**
   - Skip queue entry (move to next)

---

## Database Tables

### `staff_tele_availability`
```sql
CREATE TABLE staff_tele_availability (
  id UUID PRIMARY KEY,
  staff_id UUID REFERENCES staff(id),
  is_available BOOLEAN DEFAULT false,
  available_services JSONB,
  last_status_change TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### `tele_queue`
```sql
CREATE TABLE tele_queue (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  staff_id UUID REFERENCES staff(id),  -- null for solo vendors
  vendor_id UUID REFERENCES vendors(id), -- set for solo vendors
  pet_id UUID REFERENCES pets(id),
  service_id UUID REFERENCES services(id),
  position INTEGER,
  status TEXT,  -- 'waiting', 'accepted', 'cancelled', 'expired', 'provider_offline'
  symptoms TEXT,
  urgency TEXT,
  notes TEXT,
  price DECIMAL,
  service_name TEXT,
  duration_minutes INTEGER,
  booking_id UUID REFERENCES bookings(id),  -- set when accepted
  expires_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### `bookings`
```sql
-- Key fields for instant tele:
- is_instant: BOOLEAN (true for instant consultations)
- service_type: TEXT ('tele')
- status: TEXT ('confirmed' for instant)
- metadata: JSONB (contains meetingId, instantAssign, etc.)
```

---

## Payment Flow Details

### For Instant Tele (`flowType: 'tele-instant'`)

1. **No Booking Before Payment**
   - `bookingCreationDeferred = true`
   - `currentBookingId = undefined`

2. **Payment Record Created**
   - Status: 'pending' → 'completed'
   - Links to order (if order created) or standalone payment

3. **After Payment Success**
   - Calls `/customer/tele/instant-after-payment`
   - Creates booking with `is_instant: true`
   - Returns `bookingId`

4. **Navigation**
   - Specific provider: Direct to video-call
   - Auto-assign: To queue (with `paymentOrderId`)

---

## Error Handling

### Payment Failures
- Payment status remains 'pending'
- No booking created
- User can retry payment

### Queue Timeout
- Queue entries expire after 5 minutes
- Status updated to 'expired'
- Customer can rejoin queue

### Provider Goes Offline
- Queue entries updated to 'provider_offline'
- Customer notified via SSE
- Can select another provider

### Payment Validation Failure
- Queue join rejected if `paymentOrderId` invalid
- Returns 400 error with message
- Customer must complete payment first

---

## State Management

### TeleConsultationRouter State
```typescript
- step: FlowStep ('mode-selection' | 'instant-vendor-list' | ...)
- selectedInstantVendor: AvailableNowVendor | null
- selectedService: PlatformService | null
- selectedPet: Pet | null
- customerId: string | null
- vendorTeleServices: PlatformService[]
```

### UniversalPaymentPage State
```typescript
- processing: boolean
- policyAccepted: boolean
- paymentCompleted: boolean
- resolvedServiceId: string | null
```

### Queue State (if separate component)
```typescript
- queueEntry: QueueEntry | null
- queueStatus: 'waiting' | 'accepted' | 'cancelled'
- position: number
- estimatedWaitMinutes: number
```

---

## Key Differences: Instant vs Scheduled

| Aspect | Instant | Scheduled |
|--------|---------|-----------|
| **Payment Timing** | Before booking | After booking selection |
| **Booking Creation** | After payment | Before payment |
| **Provider Selection** | Can be auto-assigned | Must select specific provider |
| **Queue** | Yes (for auto-assign) | No |
| **Booking Status** | `is_instant: true` | `is_instant: false` |
| **Booking Date/Time** | Current date/time | Future date/time selected by user |

---

## Testing Checklist

- [ ] Mode selection works (instant vs scheduled)
- [ ] Available vendors list loads correctly
- [ ] Service selection shows vendor's tele services
- [ ] Pet selection works (with add pet option)
- [ ] Payment page loads with correct details
- [ ] Razorpay integration works
- [ ] Payment verification succeeds
- [ ] Booking created after payment (instant-after-payment)
- [ ] Queue join validates payment
- [ ] Queue position updates correctly
- [ ] Provider can accept queue entry
- [ ] Booking created when provider accepts
- [ ] Video call navigation works
- [ ] SSE updates work for queue status
- [ ] Error handling for payment failures
- [ ] Error handling for queue timeouts
- [ ] Solo vendor support works
- [ ] Staff provider support works

---

## Notes

1. **Payment First**: For instant tele, payment MUST happen before booking creation to prevent unpaid consultations.

2. **Queue System**: Only used for auto-assign path. Specific provider path goes directly to video call.

3. **Solo Vendors**: Vendors without staff can also be "Available Now" if they have published tele services.

4. **Real-Time Updates**: SSE (Server-Sent Events) used for queue status updates to avoid polling.

5. **OTP Generation**: OTP generated for instant bookings (though not always used for tele consultations).

6. **Meeting Creation**: Video call meeting created when provider accepts queue entry or immediately for specific provider bookings.
