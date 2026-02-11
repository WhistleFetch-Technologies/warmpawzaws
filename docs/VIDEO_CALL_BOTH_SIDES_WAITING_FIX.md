# Video Call "Both Sides Waiting" – Fix and Validation

## Root causes (forensic)

1. **Meeting creation not guaranteed before join**  
   `/video-call/join` returned 404 "Active meeting not found" when no session existed. Entry points (customer/vendor accept, chat → video) often navigated to `/video/:bookingId` without calling create-meeting first.

2. **API contract mismatches**  
   Backend expected camelCase and specific fields; mobile sent snake_case and sometimes missing `participantId`/`participantType`.

3. **Mobile used non-existent `/call/*` API**  
   Vendor and customer mobile used `CallApi` (`/call/initiate`, `/call/:id/answer`) which does not exist in the Lambda backend.

4. **Enhanced handler not registered**  
   `video-call-enhanced.ts` had create-on-join behavior but was never registered in `handler/index.ts`.

---

## Fixes implemented

### Backend (`backend/lambda/src/endpoints/video-call.ts`)

- **Create-on-join**  
  When `/video-call/join` is called and no active session exists for the booking, the handler now creates the Chime meeting, inserts a `video_call_sessions` row, creates the attendee for the joiner, and returns meeting + attendee. No separate create-meeting call is required.

- **Normalized API contracts**  
  - **create-meeting**: Accepts `bookingId`/`booking_id`, `customerId`/`customer_id`, `vendorId`/`vendor_id`.  
  - **join**: Accepts `bookingId`/`booking_id`, `userId`/`participantId`/`participant_id`/`user_id`, `userType`/`participantType`/`participant_type`/`user_type`. Validates `participantType` is `customer` or `vendor`.  
  - **notify-ready**: Accepts `bookingId`/`booking_id`, `participantType`/`participant_type`.  
  - **end**: Accepts `bookingId`/`booking_id` in body (for POST `/video-call/end`).

- **Logging**  
  Join handler logs `bookingId`, `participantId`, `participantType` for each join request.

### Web

- **Vendor dashboard start-call**  
  After create-meeting, the dashboard now calls `notify-ready` (participantType vendor) so the customer gets an incoming-call notification before the vendor navigates to the video page.

- **Incoming accept**  
  No change required: accept still navigates to `/video/:bookingId`. The video page calls join; backend create-on-join ensures a session exists.

### Mobile (Vendor & Customer)

- **Vendor (`WarmpawzVendor`)**  
  - Replaced `CallApi` with `vendorApiClient` in `VideoCallScreen`.  
  - `joinVideoCall(bookingId, participantId, participantType)` now calls `POST /video-call/join` with `booking_id`, `participant_id`, `participant_type`.  
  - `endVideoCall(bookingId)` calls `POST /video-call/end` with `booking_id`.  
  - `startVideoCall(bookingId, customerId, vendorId)` kept for optional create-meeting; join can be used alone (create-on-join).

- **Customer (`WarmpawzCustomer`)**  
  - Replaced `CallApi` with `apiClient` in `VideoConsultationScreen`.  
  - `joinVideoCall(bookingId, participantId, participantType)` and `endVideoCall(bookingId)` use the same backend contracts as above.

---

## How to validate

### Backend only

1. **Join as vendor (no prior session)**  
   - `POST /video-call/join` with body: `{ "bookingId": "<valid-booking-uuid>", "participantId": "<vendor-id>", "participantType": "vendor" }` (or snake_case equivalents).  
   - **Expect**: `200`, `success: true`, `meeting` (with `MediaPlacement`), `attendee` (with `AttendeeId`, `JoinToken`), `session` created.  
   - **DB**: One row in `video_call_sessions` for that `booking_id` with `status` `waiting` or `active`.

2. **Join as customer (same booking)**  
   - Same booking, body with `participantType: "customer"` and customer’s `participantId`.  
   - **Expect**: `200`, meeting + attendee; session updated with customer attendee.

3. **notify-ready**  
   - `POST /video-call/notify-ready` with `bookingId`, `participantType` (e.g. `vendor`).  
   - **Expect**: `200`; notification row with `notification_type = 'tele_call_incoming'` (or equivalent).

4. **Attendees**  
   - `GET /video-call/:bookingId/attendees`.  
   - **Expect**: `customerJoined` and `vendorJoined` reflect who has joined.

5. **End**  
   - `POST /video-call/end` with body `{ "bookingId": "<id>" }` (or `booking_id`).  
   - **Expect**: `200`; session status `completed`; booking updated.

### Web UI

1. Vendor starts call from booking detail → create-meeting + notify-ready → navigate to `/video/:bookingId`. Customer sees incoming call; accept → navigate to `/video/:bookingId`. Both join; video connects.  
2. End call from either side → booking/session state updated.

### Mobile UI

1. Vendor: open video call → screen calls `joinVideoCall(bookingId, vendorId, 'vendor')` → backend creates session if needed → "Connected" (stub UI). End → `endVideoCall(bookingId)`.  
2. Customer: same flow with `joinVideoCall(bookingId, customerId|phone, 'customer')` and `endVideoCall(bookingId)`.

---

## Files changed

| Area        | File(s) |
|------------|---------|
| Backend    | `backend/lambda/src/endpoints/video-call.ts` |
| Web vendor | `apps/vendor-web/components/vendor/dashboard/BussinesProvider/VendorDashboard.tsx` |
| Mobile vendor | `apps/WarmpawzVendor/src/lib/api-client.ts`, `apps/WarmpawzVendor/src/screens/video/VideoCallScreen.tsx` |
| Mobile customer | `apps/WarmpawzCustomer/src/lib/api-client.ts`, `apps/WarmpawzCustomer/src/screens/consultation/VideoConsultationScreen.tsx` |

Enhanced handler (`video-call-enhanced.ts`) remains available but is not registered; create-on-join and contract normalization are implemented in the main `video-call.ts` so a single canonical path is used.
