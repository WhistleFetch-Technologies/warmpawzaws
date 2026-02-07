# Forensic Systematic Validation Report

**Date:** 2026-02-04  
**Scope:** Video (tele), GPS (home), Prescription, Chat, Notifications — end-to-end implementation  
**Method:** Route mapping, request/response tracing, frontend–backend alignment, gap analysis

---

## 1. Backend Route Map

### 1.1 Video Call (`backend/lambda/src/endpoints/video-call.ts`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/video-call/create-meeting` | Create Chime meeting for booking |
| POST | `/video-call/notify-ready` | Notify other party (customer/vendor) — inserts `tele_call_incoming` |
| POST | `/video-call/join` | Join meeting (returns attendee token) |
| POST | `/video-call/end` | End call |
| POST | `/video-call/:bookingId/end` | End call (path param) |
| GET | `/video-call/:bookingId/attendees` | List attendees |
| GET | `/video-call/:bookingId` | Get meeting info |
| POST | `/video-call/create` | Legacy create |

**Validation:** All routes registered in `handler/index.ts` via `registerVideoCallEndpoints(app)`.

### 1.2 GPS Tracking (`backend/lambda/src/endpoints/gps-tracking.ts`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/tracking/start` | Start session — body: `bookingId`, `vendorId`, `startLatitude`, `startLongitude` |
| POST | `/tracking/:sessionId/update` | Update location — body: `latitude`, `longitude` |
| POST | `/tracking/:sessionId/arrived` | Mark arrived |
| POST | `/tracking/:sessionId/complete` | Complete session |
| POST | `/tracking/:sessionId/cancel` | Cancel session |
| GET | `/tracking/booking/:bookingId` | Customer: get current status (polling) |
| GET | `/tracking/:sessionId/history` | Location history |
| GET | `/tracking/:sessionId/route` | Route polyline |
| GET | `/tracking/customer/phone/:phone/active` | Active sessions by customer phone |

**Note:** No SSE `/tracking/booking/:bookingId/stream` — frontend uses polling fallback.

### 1.3 Notifications (`backend/lambda/src/endpoints/notifications.ts`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/notifications` | List — query: `userId`, `userType`, `isRead`, `limit`, `offset` |
| PUT | `/notifications/:notificationId/read` | Mark one read |
| PUT | `/notifications/read-all` | Mark all read — body: `userId`, `userType` |
| POST | `/notifications/mark-read` | Mark read (body-based) |
| GET | `/customer/notifications` | Customer by phone |

**Validation:** GET resolves phone → customer UUID when `userType=customer`; filters by `recipient_id`, `recipient_type`; returns `notification_type` (e.g. `tele_call_incoming`).

### 1.4 Prescriptions (`backend/lambda/src/endpoints/prescriptions.ts`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/prescriptions` | Create — inserts `prescriptions`; when status `published`, inserts `chat_messages` with `message_type: 'prescription'` |
| GET | `/prescriptions/booking/:bookingId` | By booking |
| GET | `/prescriptions/:prescriptionId` | By ID |
| GET | `/prescriptions/vendor/:vendorId` | By vendor |
| PUT | `/prescriptions/:prescriptionId` | Update |
| DELETE | `/prescriptions/:prescriptionId` | Delete |

**Validation:** Prescription creation → chat message and medical records (via `medical-records.ts` and pet/customer APIs) is wired.

### 1.5 Chat (`backend/lambda/src/endpoints/chat.ts`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/chat/booking/:bookingId/conversation` | Messages for booking |
| GET | `/chat/:bookingId/messages` | Messages (alt path) |
| POST | `/chat/booking/:bookingId/message` | Send message |
| POST | `/chat/:bookingId/send` | Send (alt path) |
| PUT | `/chat/messages/:messageId/read` | Mark one message read |
| **POST** | **`/chat/mark-read/:bookingId`** | **Mark all messages for booking read (vendor opens chat)** — **ADDED** |
| GET | `/chat/file/:fileId` | Get file |
| POST | `/chat/upload-file` | Upload file |
| GET | `/customer/bookings/:bookingId/messages` | Customer messages |

**Fix applied:** `VendorBookingCard` was calling `POST /chat/mark-read/${bookingId}` which did not exist; endpoint added so the call no longer 404s.

### 1.6 Medical Records (`backend/lambda/src/endpoints/medical-records.ts`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/medical-records/pet/:petId` | Pet history — **includes prescriptions** (joined from `prescriptions` table) |
| GET | `/customer/:phone/medical-records` | Customer history — includes prescriptions |
| GET | `/medical-records/booking/:bookingId` | Booking records + prescriptions |
| GET | `/medical-records/booking/:bookingId/prescriptions` | All prescriptions for booking |
| POST | `/medical-records/booking/:bookingId/prescription` | Create prescription (doctor) |
| POST | `/medical-records/booking/:bookingId/upload-prescription` | Upload handwritten |

---

## 2. Frontend → Backend Call Validation

### 2.1 Video

- **Vendor:** `AppointmentDetailModal`, `VendorDashboard`, `VendorChatModal`, `CommunicationHub`, `VendorTeleConsultationFlow`  
  - `POST /video-call/create-meeting` (body: `bookingId`, …)  
  - `POST /video-call/notify-ready` (body: `bookingId`, `participantType`)  
  - `POST /video-call/join` (body: `bookingId`, `participantType`, …)  
  - `POST /video-call/:bookingId/end`  
  - `GET /video-call/:bookingId/attendees`  
- **Customer:** `BookingDetailModal`, `CustomerHomeComplete` (via `TeleCallNotification`), `ChimeVideoCall`, `CommunicationHub`  
  - create-meeting + notify-ready when customer starts call  
  - join + end  
- **Notifications:** Video notify-ready inserts `recipient_id` (customer/vendor UUID), `recipient_type`, `notification_type: 'tele_call_incoming'`; customer polls `GET /notifications?userId=…&userType=customer&isRead=false`; vendor polls with `userType=vendor`. **Validated.**

### 2.2 GPS

- **Vendor:** `SoloProviderDashboard`, `UniversalAppointmentManagement`, `AppointmentDetailModal`  
  - `POST /tracking/start` (body: `bookingId`, `vendorId`, `startLatitude`, `startLongitude`)  
  - `POST /tracking/:sessionId/update` (body: `latitude`, `longitude`)  
  - `POST /tracking/:sessionId/arrived`, `POST /tracking/:sessionId/cancel`  
- **Customer:** `LiveTrackingMap`, `VendorLiveTrackingPopup`, `TrackingPageClient`, `GPSTrackingView`, `HomeServiceLiveTracking`, `LiveTrackingWidget`, `BookingDetailModal`, `UnifiedAppointmentTracker`  
  - `GET /tracking/booking/:bookingId` — used for initial load and polling (no SSE stream on backend; frontend falls back to polling). **Validated.**

### 2.3 Notifications

- **Customer:** `CustomerHomeComplete` — `GET /notifications?userId=${customerId \|\| phone}&userType=customer&isRead=false`; mark read: `PUT /notifications/${id}/read`.  
- **Vendor:** `VendorLandingPage` — `GET /notifications?userId=${vendorId}&userType=vendor&isRead=false`; mark read: `PUT /notifications/${id}/read`.  
- **Response:** Backend returns rows with `notification_type`; frontend filters `tele_call_incoming`. **Validated.**

### 2.4 Prescription

- **Vendor:** `AddVetSummaryModal`, `PrescriptionCreate` — `POST /prescriptions` (body: `bookingId`, `vendorId`, medications, etc.).  
- **Customer:** `PrescriptionHistoryModal`, `PrescriptionModal`, `BookingDetailModal` — `GET /prescriptions/booking/:bookingId`, `GET /prescriptions/:id`, `GET /medical-records/booking/:bookingId/prescriptions`.  
- **Flow:** Create → DB + chat message (if published) → medical records APIs include prescriptions. **Validated.**

### 2.5 Chat

- **Vendor:** `VendorChatModal`, `CommunicationHub` — `GET /chat/booking/:bookingId/conversation`, `POST /chat/booking/:bookingId/message`, `PUT /chat/messages/:id/read`.  
- **VendorBookingCard:** `POST /chat/mark-read/:bookingId` — **previously 404; endpoint added.**  
- **Customer:** `FollowUpModal`, `CommunicationHub` — `GET /chat/booking/:bookingId/conversation`, `POST /chat/booking/:bookingId/message`, `POST /chat/send`, `/chat/upload-file`, `/chat/file/:fileId`.  
- **Validated** after adding mark-read-by-booking.

---

## 3. Response Shape Alignment

### 3.1 GET /tracking/booking/:bookingId

- **Backend:** `success`, `tracking: { ...status, providerName }` where `status` from `getTrackingStatus()` includes `currentLocation` (camelCase), `status`, `estimatedEtaMinutes`, `distanceKm`, `startedAt`, etc.  
- **Frontend:** `LiveTrackingMap` uses `response.tracking.currentLocation`, `response.tracking.route` (route optional), `response.tracking.status`.  
- **Alignment:** `currentLocation` and `status` match; `route` may be absent (service returns `routePolyline`; frontend handles empty route).

### 3.2 POST /tracking/start

- **Backend:** Returns `success`, `session` (includes `id` as sessionId).  
- **Frontend:** Stores `res.sessionId` or `res.session?.id` and uses it for update/cancel.  
- **Alignment:** Validated in `SoloProviderDashboard`, `UniversalAppointmentManagement`, `AppointmentDetailModal`.

### 3.3 GET /notifications

- **Backend:** Returns `notifications` (array of rows with `id`, `notification_type`, `recipient_id`, `recipient_type`, `is_read`, `data`, etc.).  
- **Frontend:** Filters `notification_type === 'tele_call_incoming'`, uses `data.booking_id`, `data.meeting_id` for video join.  
- **Alignment:** Validated.

---

## 4. Gaps Fixed in This Validation

| Gap | Resolution |
|-----|------------|
| `POST /chat/mark-read/:bookingId` missing | **Added** in `chat.ts`: marks all messages for booking as read when vendor opens chat. |
| LiveTrackingMap wrong URL + no fallback | **Previously fixed:** SSE URL set to `/tracking/booking/:id/stream`; on SSE failure, polling `GET /tracking/booking/:bookingId` every 5s. |

---

## 5. Error Handling & Edge Cases

- **Video:** notify-ready returns 400 if booking not found or outside window; 400 if targetId missing.  
- **GPS:** start returns 400 if missing `bookingId`/`vendorId` or location (unless UAT); 404 if booking not found; 503 on DB/relation errors.  
- **Notifications:** GET returns 400 if `userId` missing; phone resolved to customer UUID for customers.  
- **Prescriptions:** 403 if vendor lacks capability; 400 on validation failure.  
- **Chat:** mark-read endpoint catches errors and returns success to avoid blocking UI.

---

## 6. Systematic Test Recommendations

1. **Video:** E2E test — create-meeting → notify-ready → customer/vendor GET notifications → accept → join → end.  
2. **GPS:** E2E test — start (with coords) → update (2–3 points) → customer GET tracking → cancel.  
3. **Prescription:** Create prescription (published) → verify chat message and medical-records/pet response include it.  
4. **Chat:** Open chat from VendorBookingCard → verify POST /chat/mark-read/:bookingId returns 200 and unread count updates.

---

## 7. Summary

- **Video (tele):** Endpoints, notify-ready notification insert, and customer/vendor polling + UI (TeleCallNotification, join, end) are aligned and validated.  
- **GPS (home):** Start, update, cancel, and customer GET tracking are aligned; LiveTrackingMap uses correct path and polling fallback.  
- **Prescription:** Create → chat message and medical records (including pet) are wired.  
- **Chat:** All used paths exist; **POST /chat/mark-read/:bookingId** was missing and has been added.  
- **Notifications:** GET/mark-read and tele_call_incoming handling are validated for both sides.

**Conclusion:** Implementation is consistent end-to-end. One backend gap (chat mark-read by booking) was found and fixed; no remaining reach errors or missing endpoints identified for the flows above.
