# Forensic E2E Trace: Video Call

End-to-end code and data flow for video call (tele consultation) from UI entry points to backend and back.

---

## 1. Backend API (single canonical path)

**File:** `backend/lambda/src/endpoints/video-call.ts`  
**Registration:** `handler/index.ts` → `registerVideoCallEndpoints(app)`

| Method | Path | Handler | Purpose |
|--------|------|---------|---------|
| POST | `/video-call/create-meeting` | CreateMeetingHandler | Create Chime meeting + session; optional before join |
| POST | `/video-call/join` | JoinMeetingHandler | **Create-on-join**: if no session, create meeting + session; return meeting + attendee |
| POST | `/video-call/notify-ready` | (inline) | Insert `tele_call_incoming` notification + push; optional meetingId from existing session |
| GET | `/video-call/:bookingId/attendees` | GetAttendeesHandler | customerJoined / vendorJoined for waiting room |
| POST | `/video-call/end` | EndMeetingHandler | Body: `bookingId` or `booking_id`; mark session completed |
| GET | `/video-call/:bookingId` | GetMeetingInfoHandler | Meeting status, duration |
| POST | `/video-call/:bookingId/end` | EndMeetingHandler | Legacy path |

**Contract normalization (backward compat):**
- create-meeting: `bookingId`|`booking_id`, `customerId`|`customer_id`, `vendorId`|`vendor_id`
- join: `bookingId`|`booking_id`, `userId`|`participantId`|`participant_id`, `userType`|`participantType`|`participant_type` (must be `customer`|`vendor`)
- notify-ready: `bookingId`|`booking_id`, `participantType`|`participant_type`
- end: body `bookingId`|`booking_id`

**Create-on-join (JoinMeetingHandler):** If no `video_call_sessions` row for booking → create Chime meeting, insert session, create attendee for joiner, return; else use existing session and create/return attendee.

---

## 2. Vendor Web – Start call (outgoing)

| Step | File | Code / API |
|------|------|------------|
| 1 | `apps/vendor-web/components/vendor/AppointmentDetailModal.tsx` | "Start Video Call" → `handleStartVideoCall()` |
| 2 | Same | `POST /video-call/create-meeting` with `bookingId`, `customerId`, `vendorId` |
| 3 | Same | `POST /video-call/notify-ready` with `bookingId`, `participantType: 'vendor'`, `participantId: vendorId` (fire-and-forget) |
| 4 | Same | `window.location.href = /video/${booking.id}?vendorId=...` |
| 5 | `apps/vendor-web/app/video/[bookingId]/VideoPageClient.tsx` | Mount; `bookingId` from path; `participantId` from URL `vendorId` or localStorage |
| 6 | Same | Renders `<ChimeVideoCall bookingId participantType="vendor" participantId={vendorId} />` |
| 7 | `apps/vendor-web/components/vendor/ChimeVideoCall.tsx` | `joinMeeting()` → `POST /video-call/join` with `bookingId`, `participantId`, `participantType` |
| 8 | Same | On success: `initializeChimeMeeting(meeting, attendee)`, start polling `GET /video-call/:bookingId/attendees` |
| 9 | Same | End: `POST /video-call/:bookingId/end` |

**Vendor dashboard (business provider):**  
`apps/vendor-web/components/vendor/dashboard/BussinesProvider/VendorDashboard.tsx` – "Join" button: create-meeting → notify-ready → navigate to `/video/${bid}?vendorId=...`.

**Vendor chat modal:**  
`apps/vendor-web/components/vendor/VendorChatModal.tsx` – Start video: create-meeting (if needed) → join → navigate to `/video/${bookingId}`.

---

## 3. Customer Web – Start call (outgoing)

| Step | File | Code / API |
|------|------|------------|
| 1 | `apps/customer-web/components/customer/BookingDetailModal.tsx` | "Video Call" → `onStartVideoCall` |
| 2 | Same | `POST /video-call/create-meeting` with `bookingId`, `customerId`, `vendorId` |
| 3 | Same | `POST /video-call/notify-ready` with `bookingId`, `participantType: 'customer'`, `participantId` |
| 4 | Same | `onNavigate('video-call', { bookingId, meetingId })` or `window.location.href = /video/${bookingId}` |
| 5 | `apps/customer-web/components/customer/wrappers/CustomerHomeWrapper.tsx` | `currentScreen === 'video-call'` → render ChimeVideoCall with `videoCallData.bookingId` |
| 6 | `apps/customer-web/app/video/[...bookingId]/page.tsx` or direct `/video/:id` | Customer video page: `VideoPageClient` → `participantId` from `localStorage.customerId` or `customerPhone` |
| 7 | `apps/customer-web/components/customer/booking/ChimeVideoCall.tsx` | `POST /video-call/join` with `bookingId`, `participantId`, `participantType: 'customer'` |
| 8 | Same | Chime init, polling attendees, end via `POST /video-call/:bookingId/end` |

---

## 4. Incoming call – Accept (customer or vendor)

| Step | File | Code / API |
|------|------|------------|
| 1 | Customer: `CustomerHomeComplete.tsx` – Vendor: `VendorLandingPage.tsx` | `TeleCallNotification` shown when `incomingCall` set (from notifications poll with `tele_call_incoming`) |
| 2 | Same | User taps Accept → `onAccept(bookingId, meetingId)` |
| 3 | Same | Navigate only: `onNavigate('video-call', { bookingId, meetingId })` or `window.location.href = /video/${bookingId}` (no create-meeting call) |
| 4 | Wrapper or `/video/:bookingId` | Renders video page → `VideoPageClient` → `ChimeVideoCall` |
| 5 | ChimeVideoCall | `POST /video-call/join` with `bookingId`, `participantId`, `participantType` |
| 6 | Backend | **Create-on-join**: if no session, create meeting + session; return meeting + attendee. Both sides can join without create-meeting first. |

---

## 5. Chat → Video

| Step | File | Code / API |
|------|------|------------|
| 1 | `apps/customer-web/components/communication/CommunicationHub.tsx` or vendor equivalent | "Video" button → `onNavigate('video-call', { bookingId, meetingId })` or `onStartVideoCall(bookingId, meetingId)` then navigate |
| 2 | Video page | Same as above: load `/video/:bookingId` → ChimeVideoCall → `POST /video-call/join` (create-on-join if needed) |

---

## 6. Mobile (Vendor & Customer)

| App | File | Flow |
|-----|------|------|
| Vendor | `WarmpawzVendor/src/screens/video/VideoCallScreen.tsx` | Uses `vendorApiClient.joinVideoCall(bookingId, vendorId, 'vendor')` and `vendorApiClient.endVideoCall(bookingId)` (no CallApi) |
| Vendor | `WarmpawzVendor/src/lib/api-client.ts` | `joinVideoCall` → POST `/video-call/join` with `booking_id`, `participant_id`, `participant_type`; `endVideoCall` → POST `/video-call/end` with `booking_id` |
| Customer | `WarmpawzCustomer/src/screens/consultation/VideoConsultationScreen.tsx` | Uses `apiClient.joinVideoCall(bookingId, customerId \|\| phone, 'customer')` and `apiClient.endVideoCall(bookingId)` |
| Customer | `WarmpawzCustomer/src/lib/api-client.ts` | Same contract as vendor (snake_case) |

---

## 7. Data flow summary

```
[Vendor Start]  create-meeting → notify-ready → navigate /video/:id
                     ↓
[Customer]     notification (tele_call_incoming) → Accept → navigate /video/:id
                     ↓
[Both]         /video/:bookingId → VideoPageClient → ChimeVideoCall
                     ↓
               POST /video-call/join { bookingId, participantId, participantType }
                     ↓
               Backend: no session? → create meeting + session + attendee
                     ↓
               Return { meeting, attendee } → Chime SDK init → media connected
                     ↓
               End: POST /video-call/end { bookingId } or POST /video-call/:id/end
```

---

## 8. How to run forensic tests

- **Code trace only** (no API calls):
  ```bash
  npx ts-node scripts/forensic-video-call-e2e.ts
  ```
  Or: `./scripts/run-forensic-video-call-e2e.sh`

- **Code trace + live API tests** (requires valid booking in DB):
  ```bash
  API_BASE=https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com \
  TEST_BOOKING_ID=<uuid> TEST_VENDOR_ID=<uuid> TEST_CUSTOMER_ID=<uuid> \
  npx ts-node scripts/forensic-video-call-e2e.ts
  ```

- **General E2E flows** (includes video-call among other flows):
  ```bash
  npx ts-node scripts/forensic-e2e-flows-validation.ts
  ```

---

## 9. Validation checklist (forensic)

- [ ] Backend: `registerVideoCallEndpoints(app)` in handler index.
- [ ] Backend: Join handler creates session when none exists (create-on-join).
- [ ] Backend: Join accepts snake_case (`booking_id`, `participant_id`, `participant_type`).
- [ ] Backend: create-meeting accepts snake_case (`booking_id`, `customer_id`, `vendor_id`).
- [ ] Vendor web: At least one entry point does create-meeting + notify-ready before navigate.
- [ ] Vendor web: VideoPageClient passes participantId (vendorId) to ChimeVideoCall.
- [ ] Customer web: VideoPageClient passes participantId (customerId/phone) to ChimeVideoCall.
- [ ] Both webs: ChimeVideoCall calls POST /video-call/join with bookingId, participantId, participantType.
- [ ] Both webs: ChimeVideoCall calls POST /video-call/:bookingId/end on end.
- [ ] Mobile: No CallApi; use /video-call/join and /video-call/end with participantId/participantType.
