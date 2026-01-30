# Booking Confirmation & Post-Booking Flow
## Customer App - Post-Booking Experience

**Date:** 2026-01-28  
**Version:** 1.0  
**Status:** Design Specification  
**Purpose:** Complete post-booking experience and tracking

---

## 📋 Table of Contents

1. [Flow Overview](#flow-overview)
2. [Confirmation Screen](#confirmation-screen)
3. [Post-Booking Actions](#post-booking-actions)
4. [Tracking & Notifications](#tracking--notifications)
5. [Booking Details Screen](#booking-details-screen)
6. [My Bookings Section](#my-bookings-section)
7. [Screen Specifications](#screen-specifications)
8. [API Endpoints](#api-endpoints)
9. [UI/UX Requirements](#uiux-requirements)
10. [Data Models](#data-models)
11. [Edge Cases](#edge-cases)

---

## 🎯 Flow Overview

### Entry Point
**Where:** After successful payment  
**Component:** `BookingConfirmationScreen.tsx`  
**Initial State:** Payment processed, booking confirmed

### Flow Steps
1. **Booking Confirmation** → Show success, OTP, booking details
2. **Post-Booking Actions** → Add to calendar, share, view booking
3. **Tracking** → GPS tracking (home services), status updates
4. **Notifications** → Provider updates, reminders, status changes
5. **Booking Management** → View details, chat, reschedule, cancel

### Success Criteria
- ✅ Booking confirmed with status `confirmed`
- ✅ OTP generated and displayed
- ✅ Booking visible in "My Bookings"
- ✅ Tracking initialized (if applicable)
- ✅ Notifications enabled
- ✅ Customer can access booking details

---

## ✅ Confirmation Screen

### Screen Name: Booking Confirmed
**Component:** `BookingConfirmationScreen.tsx`  
**Purpose:** Show booking success and next steps

**UI Elements:**

**Success Animation:**
- Large checkmark icon (animated)
- "Booking Confirmed!" heading
- Confetti animation (optional)

**Booking ID:**
- Large, prominent display
- Copy button
- Format: "Booking #12345"

**Booking Summary Card:**
```
┌─────────────────────────────────────┐
│  Service: Grooming                  │
│  Provider: Pet Care Clinic          │
│  Date: Jan 25, 2024                 │
│  Time: 10:00 AM                     │
│  Pet: Max (Golden Retriever)       │
│  Location: [Address if home]        │
└─────────────────────────────────────┘
```

**OTP Code Section (Prominent):**
- Large OTP display
- "Share OTP with provider" instruction
- Copy button
- "Share OTP" button (SMS/WhatsApp)

**Important Information:**
- "Please share OTP with provider on arrival"
- Cancellation policy link
- Rescheduling instructions
- Contact information

**Action Buttons:**
- **"View Booking"** (Primary) → Booking Details Screen
- **"Add to Calendar"** → Adds to device calendar
- **"Share Booking"** → Share booking details
- **"Back to Home"** → Returns to home screen

**Service-Specific Information:**

**Center Services:**
- Center address
- "Get Directions" button
- Operating hours
- Parking information

**Home Services:**
- Service address
- "You'll be notified when provider starts service"
- "Track provider location" (when available)

**Tele Consultation:**
- Video call link
- "Join Video Call" button (when time)
- "Open Chat" button
- "You'll receive reminder 5 minutes before"

**User Actions:**
- Copy OTP
- Share OTP
- View booking details
- Add to calendar
- Share booking
- Return to home

**Why Click Each Button:**

**"View Booking":**
- See complete booking details
- Access chat with provider
- Track booking status

**"Add to Calendar":**
- Reminder for appointment
- Syncs with device calendar

**"Share Booking":**
- Share with family/friends
- Share via SMS/WhatsApp/Email

**Navigation:** → Booking Details Screen or Home Screen

**Endpoint:** `GET /bookings/{bookingId}`

**Result:** Booking confirmed, user can track booking

---

## 📱 Post-Booking Actions

### 1. Add to Calendar

**Component:** Calendar integration

**Flow:**
1. User clicks "Add to Calendar"
2. Calendar event created with:
   - Title: "[Service Name] - [Provider Name]"
   - Date and time
   - Location (if applicable)
   - Description: Booking ID, OTP, provider contact
3. Event added to device calendar
4. Confirmation shown

**Data Included:**
- Service name
- Provider name
- Date and time
- Location address
- Booking ID
- OTP code
- Provider contact

---

### 2. Share Booking

**Component:** Share functionality

**Flow:**
1. User clicks "Share Booking"
2. Share options shown:
   - SMS
   - WhatsApp
   - Email
   - Copy link
3. User selects method
4. Booking details formatted and shared

**Share Content:**
```
Booking Confirmed! 🎉

Service: Grooming
Provider: Pet Care Clinic
Date: Jan 25, 2024 at 10:00 AM
Pet: Max (Golden Retriever)
Booking ID: #12345
OTP: 123456

View booking: [link]
```

---

### 3. View Booking

**Component:** Booking Details Screen

**Flow:**
1. User clicks "View Booking"
2. Navigates to Booking Details Screen
3. Full booking information displayed

**See:** [Booking Details Screen](#booking-details-screen)

---

## 📍 Tracking & Notifications

### GPS Tracking (Home Services)

**When Tracking Starts:**
- **Initialization:** When booking confirmed
- **Activation:** When vendor clicks "Start Service"
- **Updates:** Real-time location every 5 seconds
- **Completion:** When service completed

**Tracking UI Components:**

**1. Home Screen Notification**
**Component:** `VendorOnTheWayNotification.tsx`

**Trigger:** When vendor starts service

**UI:**
```
┌─────────────────────────────────────┐
│  📍 Dr. John is on the way          │
│     ETA: 12 minutes                 │
│     [Track Location →]              │
└─────────────────────────────────────┘
```

**Features:**
- Provider name and photo
- Current ETA
- "Track Location" button
- Auto-dismisses when provider arrives

**2. Live Tracking Screen**
**Component:** `LiveTrackingWidget.tsx` or `TrackingPageClient.tsx`

**UI:**
- Map with provider's current location
- Route from provider to customer
- ETA countdown
- Distance remaining
- Provider status (On the way, Arriving, Arrived)

**3. Tracking Widget (Home Screen)**
**Component:** `OrderTrackingWidget.tsx`

**UI:**
- Progress steps (On the way → Arriving → Arrived)
- ETA display
- Map preview
- "Track Live" button

**Endpoints:**
- `GET /gps-tracking/booking/{bookingId}` - Get tracking status
- `GET /tracking/{bookingId}/eta` - Get ETA

---

### Notifications

**Notification Types:**

**1. Booking Confirmation**
- **Trigger:** Immediately after payment
- **Content:** "Booking confirmed! Booking ID: #12345"
- **Action:** View booking

**2. Provider Acceptance**
- **Trigger:** When vendor accepts booking
- **Content:** "[Provider Name] has accepted your booking"
- **Action:** View booking

**3. Provider Started Service** (Home Services)
- **Trigger:** When vendor clicks "Start Service"
- **Content:** "[Provider Name] is on the way. ETA: X minutes"
- **Action:** Track location

**4. Provider Arrived** (Home Services)
- **Trigger:** When vendor arrives at location
- **Content:** "[Provider Name] has arrived"
- **Action:** View booking

**5. Consultation Reminder** (Tele)
- **Trigger:** 5 minutes before scheduled call
- **Content:** "Your consultation starts in 5 minutes"
- **Action:** Open chat, Join call

**6. Service Completed**
- **Trigger:** When vendor completes service
- **Content:** "Service completed! Please rate your experience"
- **Action:** Rate & Review

**7. Prescription Uploaded** (Vet/Diagnostics)
- **Trigger:** When provider uploads prescription/report
- **Content:** "Prescription/report available for [Pet Name]"
- **Action:** View prescription

**8. Booking Cancelled**
- **Trigger:** When booking is cancelled
- **Content:** "Booking #12345 has been cancelled"
- **Action:** View refund status

**Notification Endpoints:**
- `GET /customer/{phone}/notifications` - Get notifications
- `PUT /notifications/{notificationId}/read` - Mark as read

---

## 📄 Booking Details Screen

### Screen Name: Booking Details
**Component:** `AppointmentDetails.tsx` or `BookingDetailsComplete.tsx`  
**Purpose:** View complete booking information and manage booking

**UI Elements:**

**Header:**
- Back button
- Booking ID
- Status badge (Confirmed, In Progress, Completed, Cancelled)
- Share button

**Booking Information Card:**
- Service name and icon
- Provider name and photo
- Date and time
- Pet name and photo
- Location address (if applicable)
- **OTP Code** (if service not completed)

**Status Timeline:**
- Booking created ✓
- Payment confirmed ✓
- Provider accepted ✓
- Service started → (if in progress)
- Service completed → (if completed)

**Actions Section:**

**1. Chat with Provider**
- "Message Provider" button
- Opens chat interface
- Unread message indicator

**2. Track Provider** (Home Services)
- "Track Location" button
- Opens live tracking
- Shows ETA

**3. Join Video Call** (Tele Consultation)
- "Join Video Call" button
- Opens video call interface
- Available when call time reached

**4. View Prescription/Reports** (Vet/Diagnostics)
- "View Prescription" button
- Shows uploaded prescriptions/reports
- Download option

**5. Reschedule**
- "Reschedule" button
- Opens rescheduling flow
- Shows rescheduling policy

**6. Cancel Booking**
- "Cancel Booking" button
- Shows cancellation policy
- Calculates refund amount

**Medical Records Section** (Vet Services):
- History of visits
- Prescriptions
- Reports
- Vaccination records

**Reviews Section:**
- Provider reviews
- "Rate & Review" button (if service completed)

**User Actions:**
- View all booking details
- Chat with provider
- Track provider (if home service)
- Join video call (if tele)
- View prescriptions/reports
- Reschedule booking
- Cancel booking
- Rate & review

**Why Click Each Action:**

**"Message Provider":**
- Communicate with provider
- Ask questions
- Share updates

**"Track Location":**
- See provider's real-time location
- Know when to expect arrival

**"Join Video Call":**
- Start consultation
- Connect with doctor

**"View Prescription":**
- Access medical records
- Download prescriptions
- Share with other vets

**"Reschedule":**
- Change appointment time
- Find alternative slot

**"Cancel Booking":**
- Cancel if needed
- Get refund (if applicable)

**Navigation:** Various screens based on action

**Endpoint:** `GET /bookings/{bookingId}`

**Response:**
```typescript
{
  booking: {
    id: string;
    status: string;
    serviceName: string;
    providerName: string;
    providerPhoto?: string;
    date: string;
    time: string;
    petName: string;
    petPhoto?: string;
    address?: Address;
    otpCode?: string;
    price: number;
    // ... other fields
  };
  tracking?: TrackingStatus;
  chat?: ChatStatus;
  prescription?: Prescription[];
}
```

**Result:** Complete booking information displayed

---

## 📋 My Bookings Section

### Screen Name: My Bookings
**Component:** `MyBookings.tsx`  
**Purpose:** List all customer bookings

**UI Elements:**

**Header:**
- Title: "My Bookings"
- Filter button (Upcoming, Past, All)
- Search bar

**Booking Cards:**

Each card shows:
- Service name and icon
- Provider name and photo
- Date and time
- Pet name
- Status badge
- **OTP Code** (if service not completed)
- **Action buttons:**
  - "View Details" (always)
  - "Call Provider" (if phone available)
  - "Get Directions" (if center service)
  - "Track" (if home service and started)
  - "Join Call" (if tele and time reached)

**Filter Tabs:**
- **Upcoming** (default)
- **Past**
- **All**

**Sort Options:**
- Date (newest first)
- Date (oldest first)
- Status

**Empty States:**
- "No upcoming bookings"
- "No past bookings"
- "Book your first service" CTA

**User Actions:**
- Browse bookings
- Filter by status
- Search bookings
- Click booking card → View details
- Quick actions (Call, Directions, Track)

**Why Click Booking Card:**
- See full booking details
- Access all booking actions

**Navigation:** → Booking Details Screen

**Endpoint:** `GET /customer/{customerId}/bookings?status={status}&sort={sort}`

**Response:**
```typescript
{
  bookings: Booking[];
  totalCount: number;
  hasMore: boolean;
}
```

**Result:** All bookings displayed

---

## 🎨 Screen Specifications

### Confirmation Screen Layout

```
┌─────────────────────────────────────┐
│  [←]                                │
├─────────────────────────────────────┤
│         ✓ (Animated)                │
│     Booking Confirmed!               │
│                                      │
│  Booking #12345                      │
│  [Copy]                              │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐ │
│  │ Service: Grooming              │ │
│  │ Provider: Pet Care Clinic     │ │
│  │ Date: Jan 25, 2024             │ │
│  │ Time: 10:00 AM                 │ │
│  │ Pet: Max                       │ │
│  └───────────────────────────────┘ │
│                                      │
│  OTP Code:                           │
│  ┌───────────────────────────────┐ │
│  │        1 2 3 4 5 6            │ │
│  └───────────────────────────────┘ │
│  [Copy OTP] [Share OTP]             │
│                                      │
│  [View Booking]                     │
│  [Add to Calendar] [Share]          │
│  [Back to Home]                     │
└─────────────────────────────────────┘
```

---

### Booking Details Screen Layout

```
┌─────────────────────────────────────┐
│  [←] Booking Details        [Share] │
│  Booking #12345  [Confirmed]        │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐ │
│  │ Service: Grooming              │ │
│  │ Provider: Pet Care Clinic     │ │
│  │ Date: Jan 25, 2024            │ │
│  │ Time: 10:00 AM                 │ │
│  │ Pet: Max                       │ │
│  │                                │ │
│  │ OTP: 123456                    │ │
│  └───────────────────────────────┘ │
│                                      │
│  Status Timeline:                    │
│  ✓ Created → ✓ Confirmed → ...      │
│                                      │
│  Actions:                            │
│  [Message Provider]                  │
│  [Track Location] (if home)          │
│  [Join Video Call] (if tele)         │
│  [View Prescription] (if vet)        │
│  [Reschedule] [Cancel]               │
└─────────────────────────────────────┘
```

---

### My Bookings Screen Layout

```
┌─────────────────────────────────────┐
│  My Bookings                        │
│  [Filter] [Search]                  │
├─────────────────────────────────────┤
│  [Upcoming] [Past] [All]            │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐ │
│  │ 🛁 Grooming                    │ │
│  │ Pet Care Clinic                │ │
│  │ Jan 25, 10:00 AM              │ │
│  │ Max | OTP: 123456             │ │
│  │ [Confirmed]                   │ │
│  │ [View] [Call] [Directions]    │ │
│  └───────────────────────────────┘ │
│  ┌───────────────────────────────┐ │
│  │ 💉 Vet Consultation           │ │
│  │ ...                           │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

---

## 🔌 API Endpoints

### Booking Details
- **GET** `/bookings/{bookingId}`
  - Returns: Complete booking details

### Bookings List
- **GET** `/customer/{customerId}/bookings?status={status}&sort={sort}`
  - Returns: List of bookings

### Tracking
- **GET** `/gps-tracking/booking/{bookingId}`
  - Returns: Tracking status and location
- **GET** `/tracking/{bookingId}/eta`
  - Returns: ETA calculation

### Chat
- **GET** `/chat/{bookingId}/messages`
  - Returns: Chat messages
- **POST** `/chat/{bookingId}/messages`
  - Sends message

### Prescriptions
- **GET** `/bookings/{bookingId}/prescriptions`
  - Returns: Prescriptions/reports

### Booking Actions
- **POST** `/bookings/{bookingId}/reschedule`
  - Reschedules booking
- **POST** `/bookings/{bookingId}/cancel`
  - Cancels booking
- **GET** `/bookings/{bookingId}/calculate-refund`
  - Calculates refund amount

### Notifications
- **GET** `/customer/{phone}/notifications`
  - Returns: Notifications
- **PUT** `/notifications/{notificationId}/read`
  - Marks as read

---

## 🎨 UI/UX Requirements

### Design Principles
1. **Clarity:** Clear booking status and next steps
2. **Accessibility:** Easy access to all actions
3. **Feedback:** Real-time status updates
4. **Trust:** Secure OTP display

### Visual Indicators
- **Status Badges:** Color-coded (Confirmed, In Progress, Completed, Cancelled)
- **OTP Display:** Large, prominent, easy to copy
- **Tracking Status:** Visual progress indicators
- **Notification Badges:** Unread count

### Loading States
- Booking details loading skeleton
- Tracking location loading
- Chat messages loading

### Error States
- Booking not found
- Tracking unavailable
- Chat unavailable

---

## 📊 Data Models

### Booking Details
```typescript
interface BookingDetails {
  id: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  serviceName: string;
  serviceIcon?: string;
  providerName: string;
  providerPhoto?: string;
  providerPhone?: string;
  date: string;
  time: string;
  petName: string;
  petPhoto?: string;
  address?: Address;
  otpCode?: string;
  price: number;
  paymentStatus: string;
  createdAt: string;
  updatedAt: string;
  tracking?: TrackingStatus;
  chat?: ChatStatus;
  prescription?: Prescription[];
}
```

### Tracking Status
```typescript
interface TrackingStatus {
  active: boolean;
  currentLocation?: { lat: number; lng: number };
  destination?: { lat: number; lng: number };
  eta?: number; // minutes
  distance?: number; // km
  status: 'on_way' | 'arriving' | 'arrived';
}
```

---

## 🔀 Edge Cases

### 1. OTP Expired
**Scenario:** OTP expires before service  
**Solution:** Show "OTP Expired", generate new OTP, notify provider

### 2. Provider No-Show
**Scenario:** Provider doesn't arrive  
**Solution:** Show "Provider No-Show", offer reschedule or refund

### 3. Service Completed Early
**Scenario:** Service completed before scheduled time  
**Solution:** Update status, show completion, prompt for review

### 4. Multiple Bookings Same Time
**Scenario:** User has multiple bookings at same time  
**Solution:** Show all bookings, allow managing each separately

### 5. Booking Cancelled After Payment
**Scenario:** Booking cancelled, refund processing  
**Solution:** Show "Cancelled" status, refund amount, refund timeline

---

## 📱 Reference Design

### Similar Apps
- **Urban Company:** Service booking tracking
- **Practo:** Appointment management
- **Swiggy/Zomato:** Order tracking

### Design Patterns
- Status timeline
- OTP prominence
- Real-time tracking
- Action buttons

---

**Document Status:** ✅ Complete  
**Last Updated:** 2026-01-28  
**Documentation Complete:** All service booking flows documented

---

## 📚 Complete Documentation Set

1. ✅ [Service Booking Flow Overview](./SERVICE_BOOKING_FLOW_OVERVIEW.md)
2. ✅ [Center Services Booking Flow](./CENTER_SERVICES_BOOKING_FLOW.md)
3. ✅ [Home Services Booking Flow](./HOME_SERVICES_BOOKING_FLOW.md)
4. ✅ [Tele Consultation Booking Flow](./TELE_CONSULTATION_BOOKING_FLOW.md)
5. ✅ [Problem Grid Integration Flow](./PROBLEM_GRID_INTEGRATION_FLOW.md)
6. ✅ [Payment & Checkout Flow](./PAYMENT_CHECKOUT_FLOW.md)
7. ✅ [Booking Confirmation & Post-Booking Flow](./BOOKING_CONFIRMATION_FLOW.md) (This document)

---

**All Documents Status:** ✅ Complete  
**Ready for Design Implementation**
