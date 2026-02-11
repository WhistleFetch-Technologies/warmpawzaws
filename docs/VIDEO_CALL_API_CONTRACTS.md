# Video Calling – API Contract Verification (Frontend ↔ Backend)

**Last verified:** 2026-02-11  
**Backend:** `backend/lambda/src/endpoints/video-call.ts`  
**Frontends:** `apps/customer-web`, `apps/vendor-web`

---

## 1. Backend API Contract Summary

| Method | Path | Request body / params | Response (success) |
|--------|------|----------------------|---------------------|
| **POST** | `/video-call/create-meeting` | `{ bookingId, customerId, vendorId }` (camel or snake) | `{ success, meetingId, meeting: { MeetingId, MediaPlacement }, attendees }` |
| **POST** | `/video-call/join` | `{ bookingId, userId \| participantId, userType \| participantType }` — `userType`: `"customer"` \| `"vendor"` | `{ success, meetingId, meeting: { MeetingId, MediaPlacement, MediaRegion }, attendee: { AttendeeId, JoinToken, ExternalUserId }, session? }` |
| **GET** | `/video-call/:bookingId/attendees` | Path: `bookingId` | `{ success, customerJoined, vendorJoined }` or `{ success, message }` |
| **POST** | `/video-call/:bookingId/end` | Path: `bookingId`. Body optional (e.g. `duration`, `participantType`) | `{ message: "Meeting ended" }` |
| **POST** | `/video-call/end` | Body: `{ bookingId \| booking_id }` (+ optional `duration`) | Same as above |
| **POST** | `/video-call/notify-ready` | `{ bookingId, participantType }` (camel or snake) | `{ success, message }` |
| **GET** | `/video-call/:bookingId` | Path: `bookingId` | `{ meetingId, status, startedAt, endedAt, duration }` |
| **POST** | `/video-call/create` | **Same as create-meeting** — `{ bookingId, customerId, vendorId }` | Same as create-meeting |

**Backend behaviour (brief):**

- **create-meeting:** Requires `bookingId`, `customerId`, `vendorId`. Booking must exist and not be `completed`. Creates Chime meeting and stores in `video_call_sessions`.
- **join:** Accepts `userId` or `participantId`, `userType` or `participantType`. If no session exists, **create-on-join** creates meeting and session. Returns `meeting` + `attendee` for Chime SDK.
- **attendees:** Returns who has joined (customer/vendor) for waiting room.
- **end:** Marks session completed and updates booking `video_call_*` fields.
- **notify-ready:** Sends in-app/push “incoming call” to the other party (customer → vendor or vendor → customer).

---

## 2. Frontend Usage vs Contract

### 2.1 POST /video-call/create-meeting

| App | File | Request body | Contract match |
|-----|------|--------------|----------------|
| Customer | `BookingDetailModal.tsx` | `{ bookingId, customerId: booking.customerId \|\| phone, vendorId: booking.vendorId }` | ✅ |
| Vendor | `AppointmentDetailModal.tsx` | `{ bookingId: booking.id, customerId: booking.customerId \|\| '', vendorId: effectiveVendorId }` | ✅ |
| Vendor | `VendorChatModal.tsx` | `{ bookingId, customerId: booking?.customerId \|\| '', vendorId: effectiveVendorId }` | ✅ |
| Vendor | `VendorDashboard.tsx` | `{ bookingId, customerId, vendorId }` | ✅ |
| Vendor | `VendorTeleConsultationFlow.tsx` | `create-meeting` with booking/vendor ids | ✅ |

All create-meeting callers send `bookingId`, `customerId`, `vendorId` and match the backend contract.

---

### 2.2 POST /video-call/join

| App | File | Request body | Contract match |
|-----|------|--------------|----------------|
| Customer | `ChimeVideoCall.tsx` | `{ bookingId, participantId, participantType }` | ✅ (backend accepts participantId/userId, participantType/userType) |
| Customer | `VideoCallInterface.tsx` | `{ bookingId, participantId: participantId \|\| bookingId, participantType }` | ✅ |
| Vendor | `ChimeVideoCall.tsx` | `{ bookingId, participantId, participantType }` | ✅ |
| Vendor | `VendorChatModal.tsx` | `{ bookingId, userId: effectiveVendorId, userType: 'vendor', meetingId }` | ✅ (meetingId optional, ignored by join) |

All join callers send `bookingId` and participant identity (`participantId`/`userId` + `participantType`/`userType`). Backend normalizes and supports create-on-join.

---

### 2.3 GET /video-call/:bookingId/attendees

| App | File | Usage | Contract match |
|-----|------|--------|----------------|
| Customer | `ChimeVideoCall.tsx` | `GET /video-call/${bookingId}/attendees`; expects `success`, `customerJoined`, `vendorJoined` | ✅ |
| Vendor | `ChimeVideoCall.tsx` | Same | ✅ |

Backend returns `{ success, customerJoined, vendorJoined, sessionEnded? }` (or `message` when no active session). `sessionEnded: true` when the call has been completed, used for mutual disconnect. Frontend uses booleans and `sessionEnded` for disconnect detection.

---

### 2.4 POST /video-call/end (path or body)

| App | File | Call | Contract match |
|-----|------|------|----------------|
| Customer | `ChimeVideoCall.tsx` | `POST /video-call/${bookingId}/end` with `{ duration, participantType }` | ✅ (path has bookingId; body optional) |
| Customer | `VideoCallInterface.tsx` | `POST /video-call/end` with `{ bookingId, duration }` | ✅ (backend uses body.bookingId for path) |
| Customer | `VideoCallView.tsx` | `POST /video-call/${bookingId}/end` with `{ duration }` | ✅ |
| Vendor | `ChimeVideoCall.tsx` | `POST /video-call/${bookingId}/end` with `{ duration, participantType }` | ✅ |
| Vendor | `VendorTeleConsultationFlow.tsx` | `POST /video-call/${bookingId}/end` | ✅ |

All end-call usages provide `bookingId` (path or body) and match the backend.

---

### 2.5 POST /video-call/notify-ready

| App | File | Request body | Contract match |
|-----|------|--------------|----------------|
| Customer | `BookingDetailModal.tsx` | `{ bookingId, participantType: 'customer', participantId }` | ✅ (backend only requires bookingId, participantType) |
| Vendor | `AppointmentDetailModal.tsx` | `{ bookingId, participantType: 'vendor', participantId }` | ✅ |

Backend requires only `bookingId` and `participantType`; extra fields are fine. Match.

---

### 2.6 POST /video-call/create (legacy)

| App | File | Request body | Contract match |
|-----|------|--------------|----------------|
| Customer | `VideoCallView.tsx` | `{ bookingId, participantType }` | ❌ **Mismatch** – backend expects `bookingId`, **customerId**, **vendorId** (same as create-meeting). This will return 400 if hit. |

**Recommendation:** `VideoCallView` appears legacy/demo. Prefer `ChimeVideoCall` + `create-meeting` (with customerId/vendorId), or remove/deprecate `VideoCallView`’s create call so it doesn’t rely on `/video-call/create` with only `bookingId` + `participantType`.

---

## 3. Response Shape Checks (Frontend expectations)

- **Join:** Frontend expects `response.success`, `response.meeting` (with `MediaPlacement`, `AudioHostUrl`, `SignalingUrl`), `response.attendee` (with `AttendeeId`, `JoinToken`). Backend returns these. ✅  
- **Attendees:** Frontend uses `response.customerJoined`, `response.vendorJoined`. Backend returns these. ✅  
- **Create-meeting:** Frontend uses `createRes?.success` or `createRes?.meetingId`. Backend returns both. ✅  

No response-shape mismatches for the main flows.

---

## 4. Summary

| Endpoint | Customer-web | Vendor-web | Notes |
|----------|--------------|------------|--------|
| create-meeting | ✅ BookingDetailModal | ✅ Multiple (AppointmentDetail, Chat, Dashboard, TeleFlow) | All send bookingId, customerId, vendorId |
| join | ✅ ChimeVideoCall, VideoCallInterface | ✅ ChimeVideoCall, VendorChatModal | participantId/userId + participantType/userType |
| attendees | ✅ ChimeVideoCall | ✅ ChimeVideoCall | Path bookingId only |
| end | ✅ ChimeVideoCall (path), VideoCallInterface (body) | ✅ ChimeVideoCall, VendorTeleConsultationFlow | Path or body bookingId |
| notify-ready | ✅ BookingDetailModal | ✅ AppointmentDetailModal | bookingId + participantType |
| create (legacy) | ✅ VideoCallView – create call removed | Not used | Use ChimeVideoCall + join/create-meeting for real calls |

**Conclusion:** Video calling API contracts are aligned for all primary flows (create-meeting, join, attendees, end, notify-ready). The only mismatch is **VideoCallView**’s use of `POST /video-call/create` with `{ bookingId, participantType }`; backend requires `customerId` and `vendorId`. Recommend using ChimeVideoCall + create-meeting everywhere, or updating/removing VideoCallView’s create call.
