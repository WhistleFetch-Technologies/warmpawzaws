# Tele/Video Consultation Booking Flow
## Customer App - Online Consultation Booking Experience

**Date:** 2026-01-28  
**Version:** 1.0  
**Status:** Design Specification  
**Service Style:** `tele`

---

## 📋 Table of Contents

1. [Flow Overview](#flow-overview)
2. [Flow Variations](#flow-variations)
3. [Step-by-Step Flow](#step-by-step-flow)
4. [Screen Specifications](#screen-specifications)
5. [API Endpoints](#api-endpoints)
6. [Video Call Integration](#video-call-integration)
7. [Chat Interface](#chat-interface)
8. [UI/UX Requirements](#uiux-requirements)
9. [Data Models](#data-models)
10. [Error Handling](#error-handling)

---

## 🎯 Flow Overview

### Entry Point
**Where:** Customer Home Screen → Service Card → "Video Call" option  
**Component:** `CustomerHomeComplete.tsx` → `TeleConsultationRouter.tsx`  
**Initial State:** User selects "Video Call" service style

### Flow Variations

#### Variation 1: Scheduled Consultation
**Steps:** 6 steps
1. Service Selection
2. Service Style Selection (Tele)
3. Schedule vs Instant Selection → **Schedule**
4. Provider Discovery
5. Scheduling & Pet Selection
6. Payment & Confirmation

#### Variation 2: Instant Consultation
**Steps:** 5 steps
1. Service Selection
2. Service Style Selection (Tele)
3. Schedule vs Instant Selection → **Instant**
4. Provider Selection (Instant Available)
5. Payment & Confirmation

### Key Features
- ✅ **Schedule or Instant** options
- ✅ **Video call integration** (WebRTC/Amazon Chime)
- ✅ **Chat interface** (pre and post consultation)
- ✅ **5-minute reminder** notification
- ✅ **Instant queue** system
- ✅ **Prescription upload** after consultation

### Success Criteria
- ✅ Booking created (scheduled or instant)
- ✅ Video call link generated
- ✅ Chat interface accessible
- ✅ Payment processed
- ✅ Reminder notification scheduled (for scheduled calls)
- ✅ Prescription accessible after consultation

---

## 🔀 Flow Variations

### Scheduled Consultation Flow

```
Service Selection
    ↓
Service Style (Tele)
    ↓
Schedule vs Instant → Schedule
    ↓
Provider Discovery
    ↓
Provider Profile
    ↓
Scheduling (Date, Time, Pet)
    ↓
Payment
    ↓
Confirmation + Chat Access
```

### Instant Consultation Flow

```
Service Selection
    ↓
Service Style (Tele)
    ↓
Schedule vs Instant → Instant
    ↓
Problem/Need Selection (Optional)
    ↓
Instant Available Providers
    ↓
Provider Selection
    ↓
Pet Selection
    ↓
Payment
    ↓
Queue Assignment
    ↓
Chat Interface + Video Call Ready
```

---

## 📱 Step-by-Step Flow

### Step 1: Service Selection Screen

**Screen Name:** Service Category Selection  
**Component:** `ServiceCategorySelector.tsx`  
**Purpose:** User selects consultation type

**UI Elements:**
- Service cards: Vet Consultation, Nutrition Counseling, Behavioral Training
- "Video Call" badge on applicable services
- Problem Grid integration

**User Action:** Click on service card (e.g., "Vet Consultation")

**Why Click Here:**
- Clear indication of tele consultation availability
- Shows benefits (convenience, no travel, quick access)

**Data Displayed:**
- Service name
- "Video Call" badge
- Consultation duration
- Price range

**Navigation:** → Service Style Selection Screen

**Endpoint:** `GET /customer/services/categories?style=tele`

**Result:** Service category selected

---

### Step 2: Service Style Selection Screen

**Screen Name:** Service Style Selection  
**Component:** `ServiceStyleSelector.tsx` or `TeleConsultationRouter.tsx`  
**Purpose:** User confirms "Video Call" selection

**UI Elements:**
- Three option cards
- **Video Call** card highlighted
- Benefits:
  - "Consult from home"
  - "No travel required"
  - "Quick access to experts"
- Price comparison

**User Action:** Click "Video Call" card

**Why Click Here:**
- Confirms consultation method
- Sets expectations (online consultation)

**Navigation:** → Schedule vs Instant Selection Screen

**Endpoint:** `GET /customer/services/{serviceId}/styles`

**Result:** Service style `tele` confirmed

---

### Step 3: Schedule vs Instant Selection Screen

**Screen Name:** Consultation Type Selection  
**Component:** `TeleConsultationRouter.tsx`  
**Purpose:** User chooses scheduled or instant consultation

**UI Elements:**

**Two Large Option Cards:**

**1. Schedule Consultation**
- Calendar icon
- "Book for Later" heading
- Description: "Choose date and time that works for you"
- Benefits:
  - "Plan ahead"
  - "Choose preferred doctor"
  - "Flexible scheduling"
- "Book Appointment" button

**2. Instant Consultation**
- Lightning bolt icon
- "Consult Now" heading
- Description: "Connect with available doctor immediately"
- Benefits:
  - "No waiting"
  - "Immediate help"
  - "Quick answers"
- **Availability Indicator:** "X doctors available now"
- "Start Consultation" button

**User Actions:**
- Click "Schedule Consultation" → Scheduled flow
- Click "Start Consultation" → Instant flow

**Why Click Each Option:**

**Schedule:**
- User wants to plan ahead
- Prefers specific doctor
- Needs flexible timing

**Instant:**
- User needs immediate help
- Problem is urgent
- Flexible on doctor selection

**Data Displayed:**
- Instant availability count
- Next available scheduled slot

**Navigation:** 
- Schedule → Provider Discovery Screen
- Instant → Instant Queue Screen

**Endpoint:** `GET /customer/services/{serviceId}/tele/availability`

**Response:**
```typescript
{
  instantAvailable: {
    count: number;
    providers: Provider[];
  };
  nextScheduledSlot?: string;
}
```

**Result:** Consultation type selected (scheduled or instant)

---

### Step 4A: Scheduled Flow - Provider Discovery Screen

**Screen Name:** Tele Consultation Providers  
**Component:** `ServiceDiscovery.tsx` or `TeleConsultationRouter.tsx`  
**Purpose:** Browse available doctors for scheduled consultation

**UI Elements:**

**Header:**
- Back button
- Title: "Available Doctors"
- Filter button
- Sort dropdown

**Filters:**
- **Specializations:** Tags (Surgery, Dentistry, etc.)
- **Languages:** Multi-select
- **Rating:** Minimum rating
- **Price Range:** Slider
- **Availability:** Next available date

**Provider Cards:**
Each card shows:
- Doctor photo
- Doctor name
- Rating and reviews
- Specializations
- Languages spoken
- **Next Available Slot** (prominent)
- Consultation price
- "View Profile" button

**User Actions:**
- Apply filters
- Sort providers
- Click provider card → View profile

**Why Click Provider Card:**
- See doctor's full profile
- Check availability calendar
- Read reviews
- View specializations

**Navigation:** → Provider Profile Screen

**Endpoint:** `GET /customer/services/search?style=tele&category={category}&filters={filters}`

**Result:** Provider selected

---

### Step 4B: Instant Flow - Instant Queue Screen

**Screen Name:** Instant Consultation Queue  
**Component:** `InstantTeleQueue.tsx`  
**Purpose:** Select provider and join instant queue

**UI Elements:**

**Header:**
- Back button
- Title: "Instant Consultation"
- "X doctors available" badge

**Problem Selection (Optional but Recommended):**
- "What do you need help with?" section
- Problem chips/tags
- Selected problems highlighted

**Available Providers:**
- Provider cards showing:
  - Provider photo
  - Provider name
  - Rating
  - Specializations
  - **"Available Now"** badge
  - **Estimated Wait Time:** "0-2 minutes"
  - Consultation price
  - "Select" button

**Queue Status (After Selection):**
- "Connecting you to doctor..."
- Provider name and photo
- Estimated wait time countdown
- "Cancel" button

**User Actions:**
- Select problem tags (optional)
- Select provider
- Wait in queue
- Cancel if needed

**Why Click Provider:**
- Joins instant queue
- Assigned to first available doctor
- Proceeds to pet selection

**Navigation:** → Pet Selection Screen (Instant Flow)

**Endpoint:** `GET /customer/services/tele/instant-available?problems={problems}`  
**Endpoint:** `POST /bookings/tele/instant/join-queue`

**Result:** Provider selected, queue joined

---

### Step 5A: Scheduled Flow - Scheduling Screen

**Screen Name:** Select Date, Time & Pet  
**Component:** `SchedulingSelector.tsx`  
**Purpose:** Choose consultation schedule

**UI Elements:**

**Progress Indicator:**
- Step 1: Service ✓
- Step 2: Provider ✓
- Step 3: Schedule (current)
- Step 4: Payment

**Date Selection:**
- Calendar view
- Available dates highlighted
- Next available date marked

**Time Selection:**
- Time slots grid
- Available slots enabled
- Shows timezone
- "Morning", "Afternoon", "Evening" sections

**Pet Selection:**
- List of user's pets
- Pet cards with photo, name, type
- "Select" button
- "Add New Pet" button

**Additional Options:**
- Notes field (e.g., "Follow-up for Max's vaccination")
- Consultation reason (optional)

**User Actions:**
- Select date
- Select time slot
- Select pet
- Add notes
- Click "Continue to Payment"

**Why Click "Continue to Payment":**
- All required information collected
- Ready for checkout

**Validation:**
- Date selected
- Time selected
- Pet selected
- Date/time in the future

**Navigation:** → Payment Screen

**Endpoint:** `GET /staff/{staffId}/availability?serviceId={serviceId}&date={date}&style=tele`

**Result:** Date, time, and pet selected

---

### Step 5B: Instant Flow - Pet Selection Screen

**Screen Name:** Select Pet (Instant)  
**Component:** `PetSelector.tsx`  
**Purpose:** Quick pet selection for instant consultation

**UI Elements:**

**Header:**
- Back button
- Title: "Select Pet"
- "Quick Selection" indicator

**Pet List:**
- Pet cards (compact)
- Photo, name, type
- "Select" button
- "Add New Pet" button (quick add)

**Queue Status:**
- "Waiting for doctor..."
- Provider name
- Estimated wait time

**User Actions:**
- Select pet quickly
- Add new pet (if needed)
- Proceed to payment

**Why Click Pet:**
- Completes booking details
- Proceeds to payment

**Navigation:** → Payment Screen

**Endpoint:** `GET /customer/{customerId}/pets`

**Result:** Pet selected

---

### Step 6: Payment & Checkout Screen

**Screen Name:** Payment & Checkout  
**Component:** `UniversalPaymentPage.tsx`  
**Purpose:** Review booking and make payment

**UI Elements:**

**Booking Summary:**
- Service name
- Provider name
- **Consultation Type:** Scheduled or Instant
- Date and time (if scheduled)
- Pet name
- **Video Call Link** (generated after payment)

**Price Breakdown:**
- Consultation fee: ₹XXX
- Platform fee: ₹XX
- Convenience fee: ₹XX
- GST: ₹XX
- Discounts: -₹XX
- **Total: ₹XXX**

**Payment Options:**
- Wallet balance
- Razorpay
- Saved cards

**Promotions:**
- Applicable coupons
- "Apply Coupon" input

**User Actions:**
- Review booking
- Apply coupon
- Select payment method
- Enter payment details
- Click "Pay Now" or "Confirm Booking"

**Why Click "Pay Now":**
- Completes booking
- Generates video call link
- Opens chat interface

**Navigation:** → Booking Confirmation Screen

**Endpoint:** `POST /bookings/create`  
**Endpoint:** `POST /video-call/create-meeting` (generates call link)  
**Endpoint:** `POST /razorpay/orders/create`  
**Endpoint:** `POST /razorpay/payments/verify`

**Result:** Payment processed, booking confirmed, video call ready

---

### Step 7: Booking Confirmation Screen

**Screen Name:** Consultation Confirmed  
**Component:** `BookingConfirmationScreen.tsx`  
**Purpose:** Show booking success and next steps

**UI Elements:**

**Success Message:**
- Large checkmark icon
- "Consultation Confirmed!" heading
- Booking ID

**Booking Details Card:**
- Service name
- Provider name and photo
- **Consultation Type:** Scheduled or Instant
- Date and time (if scheduled)
- Pet name
- **Video Call Link** (clickable)
- **OTP Code** (for verification)

**Actions:**
- **"Join Video Call"** button (if instant or time reached)
- **"Open Chat"** button
- "Add to Calendar" button (if scheduled)
- "View Booking" button
- "Back to Home" button

**Scheduled Consultation Info:**
- "You'll receive a reminder 5 minutes before consultation"
- "Chat with doctor before consultation"
- "Join call at scheduled time"

**Instant Consultation Info:**
- "Doctor will join shortly"
- "Chat interface is open"
- "Click 'Join Video Call' when ready"

**User Actions:**
- Join video call (when available)
- Open chat interface
- Add to calendar
- View booking details
- Return to home

**Why Click "Join Video Call":**
- Starts video consultation
- Connects with doctor

**Why Click "Open Chat":**
- Opens chat interface
- Send messages before/after call
- Share documents/photos

**Data Displayed:**
- Booking ID
- Video call link
- OTP code
- All booking details
- Provider contact info

**Navigation:** → Video Call Screen or Chat Interface

**Endpoint:** `GET /bookings/{bookingId}`  
**Endpoint:** `GET /video-call/{meetingId}/join-link`

**Result:** Booking confirmed, video call and chat ready

---

## 📹 Video Call Integration

### Video Call Flow

**1. Call Initialization**
- Meeting created when booking confirmed
- Meeting ID stored with booking
- Join link generated

**2. Pre-Call**
- Chat interface available
- Share documents/photos
- Confirm pet details

**3. Call Start**
- Customer clicks "Join Video Call"
- WebRTC/Amazon Chime connection established
- Video and audio streams active

**4. During Call**
- Video and audio controls
- Chat interface accessible
- Screen sharing (if needed)
- Call duration tracked

**5. Call End**
- Prescription upload available
- Consultation summary shown
- Follow-up booking option

### Video Call UI Components

**Component:** `VideoCallInterface.tsx`

**Layout:**
- Remote video (full screen)
- Local video (bottom right corner)
- Controls bar (bottom):
  - Mute/Unmute button
  - Video On/Off button
  - Chat toggle
  - End call button

**Features:**
- WebRTC/Amazon Chime integration
- Connection quality indicator
- Call duration display
- Recording indicator (if recording)

### Video Call Endpoints
- **POST** `/video-call/create-meeting`
  - Body: `{ bookingId, participantType: 'customer' | 'vendor' }`
  - Returns: `{ meetingId, token, apiKey, joinLink }`
- **POST** `/video-call/join`
  - Body: `{ meetingId, token }`
  - Returns: Connection details
- **POST** `/video-call/end`
  - Body: `{ bookingId, meetingId, duration }`
  - Updates booking status

---

## 💬 Chat Interface

### Chat Flow

**1. Pre-Consultation Chat**
- Available immediately after booking
- Share pet details
- Ask preliminary questions
- Upload documents/photos

**2. During Consultation**
- Accessible during video call
- Share links, documents
- Quick messages

**3. Post-Consultation Chat**
- Prescription sharing
- Follow-up questions
- Report sharing

### Chat UI Components

**Component:** `ChatInterface.tsx` or `ChatInterfaceFromNotification.tsx`

**Layout:**
- Header: Provider name, video call button
- Messages area: Scrollable message list
- Input area: Text input, attachment button, send button

**Features:**
- Real-time messaging
- File attachments (photos, documents)
- Prescription sharing
- Message read receipts

### Chat Endpoints
- **GET** `/chat/{bookingId}/messages`
  - Returns: Message history
- **POST** `/chat/{bookingId}/messages`
  - Body: `{ message, attachments?: string[] }`
  - Sends message
- **PUT** `/chat/{bookingId}/read`
  - Marks messages as read

---

## 🔔 Notification System

### 5-Minute Reminder

**Component:** `TeleConsultationReminderNotification.tsx`

**Trigger:** 5 minutes before scheduled consultation

**UI:**
- Fixed top banner
- "Consultation starts in 5 minutes" message
- Provider name
- "Open Chat" button
- "Join Call" button (if early join allowed)

**Actions:**
- Open chat interface
- Join video call early
- Dismiss notification

**Endpoint:** `GET /customer/{phone}/bookings/upcoming-calls?minutes=5`

---

## 🎨 UI/UX Requirements

### Design Principles
1. **Clarity:** Clear distinction between scheduled and instant
2. **Speed:** Quick access for instant consultations
3. **Flexibility:** Easy scheduling for planned consultations
4. **Trust:** Show provider credentials and reviews

### Visual Indicators
- **Instant Badge:** Lightning bolt icon
- **Scheduled Badge:** Calendar icon
- **Video Call Icon:** Prominent on relevant screens
- **Chat Indicator:** Unread message count

### Loading States
- Queue waiting animation
- Video call connecting state
- Chat message sending indicator

### Error States
- "No doctors available" message
- "Call connection failed" error
- "Chat unavailable" fallback

---

## 📊 Data Models

### Tele Consultation Provider
```typescript
interface TeleConsultationProvider {
  id: string;
  type: 'staff' | 'solo';
  vendorId: string;
  staffId?: string;
  name: string;
  photo?: string;
  rating: number;
  reviewCount: number;
  specializations: string[];
  languages: string[];
  nextAvailable?: string;
  isInstantAvailable: boolean;
  consultationPrice: number;
  consultationDuration: number; // minutes
}
```

### Booking Request (Tele)
```typescript
interface TeleConsultationBookingRequest {
  customerId: string;
  vendorId: string;
  staffId?: string;
  serviceId: string;
  serviceType: 'tele';
  bookingType: 'scheduled' | 'instant';
  bookingDate?: string; // Required for scheduled
  bookingTime?: string; // Required for scheduled
  petId: string;
  amount: number;
  notes?: string;
  problems?: string[]; // For instant consultations
  couponCode?: string;
  useWallet?: boolean;
}
```

### Video Call Meeting
```typescript
interface VideoCallMeeting {
  meetingId: string;
  bookingId: string;
  joinLink: string;
  token: string;
  apiKey: string;
  status: 'scheduled' | 'active' | 'ended';
  startTime?: string;
  endTime?: string;
  duration?: number;
}
```

---

## 🔌 API Endpoints

### Provider Discovery
- **GET** `/customer/services/search?style=tele&category={category}&filters={filters}`
  - Returns: List of tele consultation providers

### Instant Availability
- **GET** `/customer/services/tele/instant-available?problems={problems}`
  - Returns: Instantly available providers
- **POST** `/bookings/tele/instant/join-queue`
  - Body: `{ providerId, petId, problems }`
  - Joins instant queue

### Availability
- **GET** `/staff/{staffId}/availability?serviceId={serviceId}&date={date}&style=tele`
  - Returns: Available time slots for tele consultation

### Video Call
- **POST** `/video-call/create-meeting`
  - Creates meeting for booking
- **POST** `/video-call/join`
  - Joins video call
- **POST** `/video-call/end`
  - Ends video call

### Chat
- **GET** `/chat/{bookingId}/messages`
  - Returns: Message history
- **POST** `/chat/{bookingId}/messages`
  - Sends message
- **PUT** `/chat/{bookingId}/read`
  - Marks as read

### Booking Creation
- **POST** `/bookings/create`
  - Body: `TeleConsultationBookingRequest`
  - Returns: `BookingResponse` with meeting details

---

## ⚠️ Error Handling

### Common Errors

1. **No Providers Available**
   - Show: "No doctors available. Try scheduling for later."
   - Action: "Schedule Consultation" button

2. **Instant Queue Full**
   - Show: "All doctors are busy. Estimated wait: X minutes"
   - Action: "Wait in Queue" or "Schedule Instead" buttons

3. **Video Call Connection Failed**
   - Show: "Connection failed. Please try again."
   - Action: "Retry" button
   - Fallback: Chat interface

4. **Call Ended Unexpectedly**
   - Show: "Call ended. You can reconnect or chat."
   - Action: "Reconnect" or "Open Chat" buttons

---

## 🔀 Edge Cases

1. **Early Join**
   - Allow joining call 2-3 minutes early
   - Show waiting room
   - Provider joins at scheduled time

2. **Instant Assignment**
   - Auto-assign first available doctor
   - Show assignment notification
   - Proceed to payment

3. **Rescheduling**
   - Allow rescheduling before consultation
   - Update video call meeting time
   - Send notification to provider

4. **Prescription Upload**
   - Provider uploads prescription after call
   - Customer receives notification
   - Prescription accessible in booking details

---

## 📱 Reference Design

### Similar Apps
- **Practo:** Teleconsultation booking
- **1mg:** Online doctor consultation
- **Mfine:** Video consultation

### Design Patterns
- Schedule vs Instant selection
- Queue system for instant
- Video call integration
- Chat-first approach

---

**Document Status:** ✅ Complete  
**Last Updated:** 2026-01-28  
**Next:** [Problem Grid Integration Flow](./PROBLEM_GRID_INTEGRATION_FLOW.md)
