# Forensic Verification: Travel, Tele, Prescription End-to-End

## 1. Vendor Start Travel → Customer Can Track

### Flow
1. **Vendor** (AppointmentDetailModal): Clicks "Start Travel" → `handleStartTravel()` → `navigator.geolocation.getCurrentPosition()` → `POST /tracking/start` with `bookingId`, `vendorId`, `startLatitude`, `startLongitude`.
2. **Backend** (`gps-tracking.ts`): Creates session in `gps_tracking_sessions` (with `customer_id` from booking), updates booking status to `vendor_on_way`, sends push notification (vendor_on_the_way).
3. **Customer** (CustomerHomeComplete): `useActiveGpsTracking(phone)` polls `GET /tracking/customer/phone/:phone/active` every 10s. Backend returns sessions where `gts.customer_id` matches customer (resolved from phone).
4. **Phone normalization**: GET `/tracking/customer/phone/:phone/active` now tries multiple phone formats (raw, digits-only, +91+digits) so customer is found regardless of how phone is stored.
5. **Popup**: When a session is returned, `onSessionStart` sets `vendorOnTheWay` → `VendorOnTheWayPopup` shows with "Track" button.
6. **Track**: Customer clicks Track → `onNavigate('gps-tracking', { bookingId })` or `/tracking/${bookingId}` → `HomeServiceLiveTracking` or `TrackingPageClient` polls `GET /tracking/booking/:bookingId` for live location.

### Endpoints
- `POST /tracking/start` – start session, set booking `vendor_on_way`, notify customer.
- `GET /tracking/customer/phone/:phone/active` – list active sessions for customer (phone normalized).
- `GET /tracking/booking/:bookingId` – current tracking status for a booking.
- `POST /tracking/:sessionId/update` – vendor location updates.

---

## 2. Vendor Start Tele Consult → Calling Notification → Accept → Video

### Flow
1. **Vendor** (AppointmentDetailModal): Clicks "Video Call" → `handleStartVideoCall()` → `POST /video-call/create-meeting` → `POST /video-call/join` → `POST /video-call/notify-ready` with `participantType: 'vendor'` → redirect to `/video/${booking.id}`.
2. **Backend** (`video-call.ts`): `notify-ready` inserts notification with `recipient_id: booking.customer_id`, `recipient_type: 'customer'`, `notification_type: 'tele_call_incoming'`, `data: { booking_id, meeting_id, call_type: 'incoming' }`.
3. **Customer** (CustomerHomeComplete): `checkIncomingCalls()` runs every 5s → `GET /notifications?userId=${customerId || phone}&userType=customer&isRead=false`. When userId is phone, backend resolves customer ID; notification has `recipient_id = customer_id`.
4. **Incoming call UI**: When a `tele_call_incoming` notification is found, `setIncomingCall(...)` → `TeleCallNotification` shows (Accept/Reject).
5. **Accept**: Customer clicks Accept → `onNavigate('video-call', { bookingId, meetingId })` or `window.location.href = /video/${bookingId}` → video call page joins meeting.

### Endpoints
- `POST /video-call/create-meeting` – create meeting.
- `POST /video-call/join` – join meeting.
- `POST /video-call/notify-ready` – create tele_call_incoming notification for customer.
- `GET /notifications?userId=...&userType=customer` – customer fetches notifications (userId can be phone or customer UUID).

---

## 3. Prescription: Draft/Publish, History, Chat, A4 PDF

### Flow
1. **Vendor** (AddVetSummaryModal): "Save as Draft" → `handleSubmit(true)` → `POST /prescriptions` with `status: 'draft'`. "Publish" → `handleSubmit(false)` → `POST /prescriptions` with `status: 'published'`.
2. **Backend** (prescriptions.ts): On create, resolves `customerId` and `petId` from booking if missing. On **published** only: inserts into `chat_messages` with `message_type: 'prescription'`, `file_id: prescriptionId`, `message: 'Prescription added. View in appointment History or download PDF...'`.
3. **History**: `GET /bookings/:bookingId/history` returns status history + prescriptions (no `is_active` filter). AppointmentDetailModal merges into `activities`; History tab shows prescriptions with "View A4".
4. **Customer medical records**: `GET /customer/:phone/medical-records` returns both `medical_records` and `prescriptions` for customer’s pets. Pet profile medical records tab uses same data.
5. **Chat**: When prescription is published, chat message appears in booking chat. Customer CommunicationHub shows prescription bubble and "View Full Prescription (PDF A4)" using `message.file_id` (or parsing message JSON). `viewPrescription` event opens prescription modal (e.g. BookingDetailModal).
6. **A4 PDF**: PrescriptionDocument (vendor and customer) shows A4 layout with provider details, patient, multiple medicines, instructions, follow-up, drug license metadata. "View A4" in History and in prescription modal; Print/Download in modal.

### Endpoints
- `POST /prescriptions` – create (optional `status: 'draft' | 'published'`); when published, post prescription message to chat.
- `PUT /prescriptions/:id` – update draft or publish; when publishing, post prescription message to chat.
- `GET /bookings/:bookingId/history` – history including prescriptions.
- `GET /customer/:phone/medical-records` – includes prescriptions for pets.
- `GET /chat/booking/:bookingId/conversation` – messages include prescription messages with `file_id`.

---

## Gaps Fixed in This Pass

1. **Tracking**: Customer phone lookup in `GET /tracking/customer/phone/:phone/active` now tries raw, digits-only, and +91 formats so sessions are returned for customer web.
2. **Prescription share in chat**: On create/update with status published, backend inserts `chat_messages` with `message_type: 'prescription'`, `file_id: prescriptionId`, readable `message` text.
3. **Prescription draft/publish**: AddVetSummaryModal has "Save as Draft" and "Publish"; API accepts `status` and only shares in chat when published.
4. **Customer chat prescription button**: Uses `file_id` for "View Full Prescription (PDF A4)"; fallback parses message JSON for `prescriptionId` for older messages.

---

## Quick Test Checklist

- [ ] Vendor: Start Travel on home booking → customer home shows "Vendor on the way" popup; Track opens tracking page with live location.
- [ ] Vendor: Start Video Call on tele booking → customer home shows incoming call (Accept/Reject); Accept opens video call.
- [ ] Vendor: Add Consultation Summary → Save as Draft → appears in History, not in chat. Publish → appears in History and in chat with "View Full Prescription (PDF A4)".
- [ ] Customer: Open booking chat → see prescription message → View Full Prescription opens prescription (A4 style).
- [ ] Customer: Pet profile → Medical records tab shows same prescriptions as vendor History.
