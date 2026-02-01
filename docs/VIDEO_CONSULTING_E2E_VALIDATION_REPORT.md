# Video Consulting – End-to-End Validation Report

**Date:** 2026-01-31  
**Scope:** Vendor video call flow, Customer video call flow, Backend endpoints, Handlers, Routes, Wiring  
**Stack:** AWS Chime SDK, video_call_sessions table, Hono/Lambda

---

## 1. VENDOR SIDE – UI / Components / Imports

| Item | Status | Location | Notes |
|------|--------|----------|-------|
| **Video Call Button** | OK | `AppointmentDetailModal.tsx` L1344-1352 | [Video Call] when `isTeleStyle` and status not completed/cancelled |
| **handleStartVideoCall** | OK | L378-413 | Creates meeting, joins, notifies, navigates to `/video/${booking.id}` |
| **ChimeVideoCall** | OK | `vendor/ChimeVideoCall.tsx` | Real AWS Chime video component |
| **VideoPageClient** | OK | `vendor-web/app/video/[bookingId]/VideoPageClient.tsx` | Route `/video/:bookingId` |
| **CommunicationHub (Video from Chat)** | OK | `communication/CommunicationHub.tsx` L264-267 | Camera icon for tele consultations; calls `onStartVideoCall` |
| **VendorChatModal** | OK | `VendorChatModal.tsx` L365-415 | handleStartVideoCall → create-meeting, join, onVideoCallStart |
| **isTeleStyle** | OK | L312-313 | `tele`, `tele_consultation`, `video`, `online`, `instant_tele` |

---

## 2. VENDOR SIDE – Handlers & Endpoints

| Handler | Endpoint Called | Backend Exists? | Status |
|---------|-----------------|-----------------|--------|
| **handleStartVideoCall** | `POST /video-call/create-meeting` | Yes (video-call.ts L600) | OK |
| **handleStartVideoCall** | `POST /video-call/join` | Yes (L608) | OK |
| **handleStartVideoCall** | `POST /video-call/notify-ready` | Yes (L532) | OK |
| **ChimeVideoCall (vendor)** | `POST /video-call/join` | Yes | OK |
| **ChimeVideoCall (vendor)** | `GET /video-call/:bookingId/attendees` | Yes (L524) | OK |
| **ChimeVideoCall (vendor)** | `POST /video-call/:bookingId/end` | Yes (L642) | OK |

---

## 3. CUSTOMER SIDE – UI / Components / Imports

| Component | File | Import / Usage | Status |
|-----------|------|----------------|--------|
| **ChimeVideoCall** | `customer/booking/ChimeVideoCall.tsx` | Real AWS Chime; CustomerHomeWrapper L703, VideoPageClient | OK |
| **CommunicationHub** | `customer/communication/CommunicationHub.tsx` | BookingDetailModal; mode='video' → onNavigate('video-call') | OK |
| **Join Tele-Consultation** | `BookingDetailModal.tsx` L891-899 | Opens CommunicationHub mode='video' | OK |
| **CustomerHomeWrapper** | video-call screen | Sets videoCallData, renders ChimeVideoCall with phone as participantId | OK |
| **VideoPageClient** | `customer-web/app/video/[bookingId]/VideoPageClient.tsx` | Route `/video/:bookingId`; uses customerId/customerPhone from localStorage | OK |
| **UnifiedAppointmentTracker** | Join Call button | onNavigate('video-call', { bookingId, meetingId }) or window.location.href = /video/bookingId | OK |
| **VendorOnTheWayPopup** | onJoinCall | onNavigate('video-call', { bookingId, meetingId }) | OK |
| **TeleConsultationReminderNotification** | onStartCall | onNavigate('video-call', { bookingId, meetingId }) | OK |

---

## 4. CUSTOMER SIDE – Video Flow (Join Tele-Consultation)

| Step | Action | Result | Status |
|------|--------|--------|--------|
| 1 | Customer clicks "Join Tele-Consultation" | setCommunicationMode('video') | OK |
| 2 | CommunicationHub opens with mode='video' | useEffect calls onNavigate('video-call', { bookingId, meetingId }) | OK |
| 3 | CustomerHomeWrapper receives navigation | setVideoCallData, setCurrentScreen('video-call') | OK |
| 4 | ChimeVideoCall renders | participantId=phone, participantType='customer' | OK |
| 5 | ChimeVideoCall calls POST /video-call/join | Backend returns meeting + attendee credentials | OK |
| 6 | Chime SDK initializes | Real video/audio connection | OK |

**Note:** Customer CommunicationHub does NOT render a fake video UI; it immediately navigates to the real ChimeVideoCall screen (L132-139).

---

## 5. BACKEND – Endpoints & Registration

| Endpoint | File | Registered | Status |
|----------|------|------------|--------|
| `POST /video-call/create-meeting` | video-call.ts L600 | registerVideoCallEndpoints (handler L412) | OK |
| `POST /video-call/join` | L608 | Yes | OK |
| `POST /video-call/notify-ready` | L532 | Yes | OK |
| `GET /video-call/:bookingId/attendees` | L524 | Yes | OK |
| `POST /video-call/:bookingId/end` | L642 | Yes | OK |
| `GET /video-call/:bookingId` | L625 | Yes | OK |
| `POST /video-call/create` | L634 | Yes (legacy) | OK |

---

## 6. ROUTES & WIREFRAME

### Vendor Flow

```
Vendor Dashboard / Appointment Detail (Tele booking)
    │
    ├─► [Video Call] button
    │       │
    │       └─► handleStartVideoCall
    │               │
    │               ├─► POST /video-call/create-meeting { bookingId, customerId, vendorId }
    │               ├─► POST /video-call/join { bookingId, userId, userType }
    │               ├─► POST /video-call/notify-ready { bookingId, participantType: 'vendor' }
    │               └─► window.location.href = /video/{bookingId}
    │                       │
    │                       └─► VideoPageClient → ChimeVideoCall (vendor)
    │
    └─► Chat → Camera icon (tele only)
            │
            └─► onStartVideoCall → same flow as above
```

### Customer Flow

```
Customer – Multiple entry points
    │
    ├─► My Bookings → Booking Detail → [Join Tele-Consultation]
    │       │
    │       └─► setCommunicationMode('video') → CommunicationHub
    │               │
    │               └─► onNavigate('video-call', { bookingId, meetingId })
    │                       │
    │                       └─► CustomerHomeWrapper: videoCallData, currentScreen='video-call'
    │                               │
    │                               └─► ChimeVideoCall (customer)
    │
    ├─► UnifiedAppointmentTracker → [Join Call]
    │       └─► onNavigate('video-call', { bookingId, meetingId })
    │
    ├─► VendorOnTheWayPopup (tele) → [Join Video Call]
    │       └─► onJoinCall(bookingId, meetingId) → onNavigate('video-call')
    │
    ├─► TeleConsultationReminderNotification → [Join]
    │       └─► onStartCall → onNavigate('video-call')
    │
    └─► Direct URL /video/:bookingId
            └─► VideoPageClient (customer) → ChimeVideoCall
```

---

## 7. ENDPOINT REQUEST/RESPONSE SHAPES

### POST /video-call/create-meeting

**Request:** `{ bookingId, customerId, vendorId }`  
**Response:** `{ success, meetingId, meeting: { MeetingId, MediaRegion, MediaPlacement }, attendees: { customer, vendor } }`  
**Backend:** Creates Chime meeting, stores in video_call_sessions, creates customer + vendor attendees.

### POST /video-call/join

**Request:** `{ bookingId, participantId, participantType }` (or userId, userType)  
**Response:** `{ success, meetingId, meeting, attendee }` (Chime MediaPlacement + JoinToken)  
**Backend:** Looks up active session by bookingId; creates new attendee if needed; returns credentials.

### POST /video-call/notify-ready

**Request:** `{ bookingId, participantType, participantId }`  
**Backend:** Sends in-app + push notification to the other party (customer or vendor).

---

## 8. STITCHING & WIRING STATUS

| Link | Vendor | Backend | Customer | Status |
|------|--------|---------|----------|--------|
| Create meeting | POST /video-call/create-meeting | Inserts video_call_sessions, creates Chime meeting | — | OK |
| Vendor join | POST /video-call/join | Returns Chime credentials | — | OK |
| Notify customer | POST /video-call/notify-ready | Sends notification to customer | — | OK |
| Vendor navigates | — | — | — | /video/:bookingId → ChimeVideoCall | OK |
| Customer join (in-app) | — | — | onNavigate → ChimeVideoCall → POST /video-call/join | OK |
| Customer join (direct URL) | — | — | /video/:bookingId → VideoPageClient → ChimeVideoCall | OK |
| End call | POST /video-call/:bookingId/end | Updates session status | Same endpoint | OK |

---

## 9. POTENTIAL GAPS / NOTES

| Item | Risk | Notes |
|------|------|-------|
| **customerId in create-meeting** | Low | Vendor passes `booking.customerId`; API may return `customer_id`. Ensure mapping in booking load includes customerId. |
| **Customer participantId** | Low | Customer uses `phone`; backend JoinMeetingHandler accepts any string for ExternalUserId. Chime allows multiple attendees. |
| **VideoPageClient participantId** | Medium | Customer VideoPageClient uses `localStorage.customerId` or `localStorage.customerPhone`. If not set, user sees "Authentication Required". Ensure customer auth sets these. |
| **Meeting must exist for join** | Expected | If customer joins before vendor starts, backend returns 404 "Active meeting not found. Please ask the other participant to start the call first." Handled in ChimeVideoCall error UI. |
| **Customer starts from chat** | OK | CommunicationHub Video button calls onStartVideoCall (create-meeting + notify), then onNavigate('video-call') and onClose. Customer is navigated to ChimeVideoCall. |

---

## 10. SUMMARY – WHAT WORKS

- Vendor: Video Call button → create-meeting → join → notify → navigate to /video/:bookingId → ChimeVideoCall
- Vendor: Video from Chat (camera icon) → same flow for tele consultations
- Customer: Join Tele-Consultation → CommunicationHub → onNavigate → ChimeVideoCall → join
- Customer: Join from UnifiedAppointmentTracker, VendorOnTheWayPopup, TeleConsultationReminder
- Customer: Direct /video/:bookingId route
- Backend: All video-call endpoints implemented and registered
- AWS Chime: Meeting creation, attendee tokens, MediaPlacement for SDK

---

## 11. REVALIDATION CHECKLIST

| Check | Status |
|-------|--------|
| Vendor create-meeting + join + notify flow | ✓ |
| Vendor /video/:bookingId route and ChimeVideoCall | ✓ |
| Customer Join Tele-Consultation → onNavigate → ChimeVideoCall | ✓ |
| Customer ChimeVideoCall POST /video-call/join | ✓ |
| Customer /video/:bookingId route (VideoPageClient) | ✓ |
| Backend video-call endpoints registered | ✓ |
| Customer participantId (phone) passed correctly | ✓ |
| notify-ready sends notification to correct party | ✓ |
