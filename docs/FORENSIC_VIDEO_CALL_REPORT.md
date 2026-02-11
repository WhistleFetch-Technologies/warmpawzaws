# Forensic P2P Video Call Investigation Report

**Date:** 2026-02-11  
**Scope:** 1:1 video calling (vendor ↔ customer), device/media, mobile loading

**Product model:** P2P video calling (not multi-participant meetings). Each call is a 1:1 session between customer and vendor—like a phone call with video.

**Meeting ID = call session ID.** To join the same call, both participants must use the same meeting ID. The meeting ID is created when the call is started (via `create-meeting` or create-on-join) and is tied to the `bookingId`. Participants join by calling `/video-call/join` with `bookingId` + their `participantId`; the backend returns the meeting ID and their call credentials. In practice, participants navigate to `/video/{bookingId}`—the meeting ID is resolved server-side from the booking.

Under the hood, AWS Chime uses a "meeting" with two attendees; that is the technical implementation of a single P2P call.

---

## 1. Architecture Overview (P2P Call Model)

### Backend API Contract (`backend/lambda/src/endpoints/video-call.ts`)

| Endpoint | Body Params | Notes |
|----------|-------------|-------|
| `POST /video-call/create-meeting` | `bookingId`, `customerId`, `vendorId` (all required) | Creates a **call session** (Chime meeting) for this 1:1 call; provisions credentials for both caller and callee |
| `POST /video-call/join` | `bookingId`, `participantId` or `userId`, `participantType` or `userType` | Joins the **P2P call**—returns call credentials. Create-on-join if no call session exists yet |
| `POST /video-call/notify-ready` | `bookingId`, `participantType` | Notifies the other party that caller is ready (incoming call notification) |
| `GET /video-call/:bookingId/attendees` | — | Returns who has joined the call (`customerJoined`, `vendorJoined`) |
| `POST /video-call/:bookingId/end` | — | Ends the call |

### Meeting ID as Call Session Identifier

- **Meeting ID** = the Chime call session ID. Both participants must join the same meeting ID to be in the same P2P call.
- Stored in `video_call_sessions.meeting_id` and `bookings.video_call_meeting_id`.
- Passed via `notify-ready` → `data.meeting_id` → customer accepts with that ID.
- `bookingId` is the primary lookup key; meeting ID is derived/returned when creating or joining the call.

### Create-on-Join (Caller Joins First)

When no active call session exists, `join` creates the session and the first attendee. When the other participant joins later, a second attendee is created. Both end up in the same call (same meeting ID).

### Participant ID Semantics (Who Is Joining the Call)

- **Vendor**: `participantId` = vendor UUID (from URL, localStorage, or `/vendor/profile` API).
- **Customer**: `participantId` = phone number or customer UUID. Backend returns the call credentials for that participant; it does not validate that `userId` matches `booking.customer_id`.

---

## 2. Entry Points & VendorId/participantId Passing

### Vendor Entry Points

| Source | URL Built | vendorId in URL? |
|--------|-----------|------------------|
| VendorBookingCard | `/video/${bid}?vendorId=...` | ✅ Yes (from props) |
| VendorChatModal | `/video/${bid}?meetingId=...&vendorId=...` | ✅ Yes (effectiveVendorId) |
| AppointmentCard | `/video/${bid}?vendorId=...` | ✅ Yes (from localStorage fallback) |
| AppointmentDetailModal (handleStartVideoCall) | `/video/${id}?vendorId=...` | ✅ Yes |
| AppointmentDetailModal (CommunicationHub) | `/video/${bid}?vendorId=...` | ✅ Yes (after fix) |
| VendorLandingPage (TeleCallNotification) | `/video/${bid}?vendorId=...` | ✅ Yes (from props) |
| VendorDashboard | `/video/${bid}?vendorId=...` | ✅ Yes |

### Customer Entry Points

| Source | URL Built | participantId in URL? |
|--------|-----------|------------------------|
| CustomerHomeWrapper (onNavigate) | In-app: `videoCallData` + `participantId={phone}` | N/A – uses SPA flow, phone in memory |
| window.location.href fallbacks | `/video/${bookingId}` or `/video/${bookingId}?meetingId=...` | ❌ **No** – no customerId/phone/participantId |

**Customer `window.location.href` call sites (no participantId):**

- `CustomerHomeComplete`: `onJoinCall` fallback, `VendorOnTheWayPopup` onJoinCall, TeleCallNotification accept, etc.
- `CustomerHomeWrapper`: fallback when `onNavigate` not available
- `UnifiedAppointmentTracker`: Join Call fallback
- `AppointmentDetailsView`: video call URL

---

## 3. VideoPageClient – Participant ID Discovery

### Vendor (`apps/vendor-web/app/video/[bookingId]/VideoPageClient.tsx`)

1. **Query param** `vendorId`
2. **localStorage** `vendorId`, `vendor_id`, `vendorData`
3. **API fallback** `GET /vendor/profile` → store and use vendor ID

If none found → redirect to dashboard after 2s.

### Customer (`apps/customer-web/app/video/[bookingId]/VideoPageClient.tsx`)

1. **Query params** `customerId`, `customer_id`, `participantId`, `customerPhone`, `phone`
2. **localStorage** `customerId`, `customerPhone`, `customer_phone`, `phone`
3. **API fallback** ❌ **None** – unlike vendor

If none found → "Authentication Required" screen.

---

## 4. Findings & Risk Assessment

### Critical

1. **Customer deep link without participantId**
   - All `window.location.href = /video/${bookingId}` flows omit `customerId`/`phone`/`participantId`.
   - After full reload, VideoPageClient depends on localStorage.
   - If localStorage is empty (incognito, new webview, cleared storage), customer sees "Authentication Required" and cannot join the call.
   - **Recommendation:** Add `participantId` (or `phone`/`customerId`) to URL where possible, and/or add an API fallback (e.g. `/customer/profile` or phone resolution).

### High

2. **Attendee presence – only join subscribed**
   - `realtimeSubscribeToAttendeeIdPresence(attendeeObserver.attendeeIdDidJoin)` – only join callback is used.
   - `attendeeIdDidLeave` is defined but not subscribed.
   - May affect UI updates when the other party leaves (e.g. status/indicators).
   - **Recommendation:** Confirm Chime SDK presence API and subscribe to leave if needed.

3. **Customer create-meeting vs join ID mismatch (low risk)**
   - Call creation uses `customerId` from booking (UUID).
   - Customer join uses `participantId` = phone (e.g. from CustomerHomeWrapper).
   - Backend returns the existing customer credentials when a call session exists, so join still works.
   - Create-on-join uses `ExternalUserId = customer-{phone}`, which is fine for Chime.

### Medium

4. **VendorChatModal double join**
   - VendorChatModal calls `POST /video-call/join` before navigating to the call page.
   - ChimeVideoCall calls `POST /video-call/join` again after navigation.
   - Same call credentials are returned; actual Chime connection is made only by ChimeVideoCall.
   - No functional bug, but redundant API call.

5. **Notifications recipient resolution (incoming call)**
   - `notify-ready` uses `recipient_id = booking.customer_id` (UUID) when vendor starts the call.
   - Notifications API resolves `userId` (phone) → customer UUID when customer fetches notifications.
   - Incoming-call flow is consistent.

### Low / Informational

6. **GET /attendees**
   - `customerJoined` / `vendorJoined` indicate who has joined the P2P call.
   - Logic is correct.

7. **Media device priming**
   - `primeDevicePermissions()` and empty-device re-listing are in place.
   - `realtimeUnmuteLocalAudio` and `startLocalVideoTile` fallbacks after `start()` are present.
   - Toasts for missing mic/camera are implemented.

8. **Audio element binding**
   - First bind in `initializeChimeMeeting` can happen before the audio element mounts (status still `connecting`).
   - `useEffect` rebinds when `status` changes to `waiting`/`active`, so binding is corrected.
   - No functional issue observed.

---

## 5. Vendor Mobile “Loading” Root Causes (Summary)

Resolved / mitigated by current changes:

- Vendor ID discovery: query param → localStorage → `/vendor/profile`.
- All vendor entry points passing `vendorId` in the URL (including CommunicationHub and VendorChatModal fixes).
- Permission priming and device re-listing for media.
- Vendor must have `participantId` (vendorId) to join; meeting ID (call session) is obtained from the backend when joining via `bookingId`.

---

## 6. Customer Cannot Hear Vendor (P2P Call) – Possible Causes

If customer sees vendor video but has no audio:

1. **Remote audio binding**
   - `bindAudioElement` must run after the audio element is mounted and before remote audio arrives.
   - Rebinding in `useEffect` on status change should handle this.

2. **Autoplay policy**
   - Browsers can block `audio.play()` without user gesture.
   - `ensureAudioContext` uses `pointerdown`/`keydown` to resume; similar pattern may be needed for remote audio.

3. **Volume / output device**
   - `chooseAudioOutput` is called with first output device; mobile defaults may differ.
   - User could try device settings if available.

4. **Chime signaling / ICE**
   - Connectivity issues could affect audio even when video works; would require network/ICE debugging.

---

## 7. Vendor Cannot See/Hear Customer (P2P Call) – Possible Causes

1. **Device permissions**
   - Permission priming and empty-device re-listing should help; toasts aid diagnosis.

2. **Local tile start**
   - `startLocalVideoTile()` is called in observer and as fallback after `start()`.

3. **Video tile binding**
   - `videoTileDidUpdate` binds to `localVideoRef` and `remoteVideoRef`.
   - Only one element uses `localVideoRef` per render; binding should be correct.

4. **Call creation vs join ExternalUserId**
   - Call creation uses raw `customerId`/`vendorId`.
   - Join create-on-join uses `userType-userId`.
   - Backend returns the correct credentials for the joining party; no obvious mismatch.

---

## 8. Recommended Next Steps

1. **Customer URL params**
   - When navigating to `/video/${bookingId}`, add `participantId` or `phone` to the query string where the value is available.
2. **Customer API fallback**
   - Add an API (e.g. `/customer/profile` or similar) to resolve participant ID when URL and localStorage are empty.
3. **Call-end handling**
   - Review Chime presence APIs and subscribe to leave if the product needs to react when the other party disconnects.
4. **Console logging**
   - Add or keep targeted logs for "Chime meeting initialized", "Error setting up media devices", "No microphone detected", "No camera detected" for debugging.

---

## 9. Verification Checklist (P2P Video Call)

- [ ] Vendor laptop: can see and hear customer
- [ ] Vendor mobile: no indefinite "Loading", can join the call
- [ ] Customer: can see and hear vendor
- [ ] Both participants join the same call (same meeting ID derived from bookingId)
- [ ] Deep link: customer `/video/xxx` with no localStorage (e.g. incognito) – expected to fail until URL params or API fallback is added
- [ ] Permissions: mic/camera prompts appear; toasts shown if no devices
