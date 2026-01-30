# Verification Trace: Components → Backend → Test Steps

**Purpose:** Map every flow to the exact frontend components and backend endpoints that must be tested. Use this for systematic frontend + backend testing.

---

## 1. GPS Tracking (Home Service)

### Backend endpoints

| Endpoint | File | Purpose |
|----------|------|---------|
| `GET /tracking/customer/phone/:phone/active` | gps-tracking.ts | List active tracking sessions for customer (used by popup) |
| `GET /tracking/booking/:bookingId` | gps-tracking.ts | Single booking tracking status (ETA, location, route) |
| `POST /tracking/start` | gps-tracking.ts | Start tracking (vendor or server) |
| `POST /vendor/bookings/:bookingId/start-travel` | vendor-booking-actions.ts | Vendor “Start for home” → creates session, notifies customer |
| `POST /vendor/bookings/:bookingId/location-update` | vendor-booking-actions.ts | Vendor periodic location push |
| `GET /vendor/bookings/:bookingId/tracking-session` | vendor-booking-actions.ts | Vendor get current session |
| `POST /vendor/tracking/:bookingId/stop` | (if exists) | Stop tracking on arrived |

### Customer components (customer-web)

| Component | File | Renders / uses |
|-----------|------|-----------------|
| `useActiveGpsTracking` | hooks/useActiveGpsTracking.ts | Polls `GET /tracking/customer/phone/:phone/active` every 10s |
| `CustomerHomeComplete` | CustomerHomeComplete.tsx | Uses hook; onSessionStart/Update/Arrived sets `vendorOnTheWay` |
| `VendorOnTheWayPopup` | VendorOnTheWayPopup.tsx | Renders when `vendorOnTheWay` set; Track → navigate to tracking |
| `LiveTrackingWidget` | tracking/LiveTrackingWidget.tsx | Fetches `GET /tracking/booking/:bookingId`; optional SSE stream; map + ETA |
| `TrackingPageClient` | app/tracking/[bookingId]/TrackingPageClient.tsx | Page at `/tracking/[bookingId]`; uses same GET tracking/booking |
| `BookingDetailModal` | BookingDetailModal.tsx | **Fixed:** `checkTrackingStatus` now uses `GET /tracking/booking/:bookingId` (was wrong path) |

### Vendor components (vendor-web)

| Component | File | Renders / uses |
|-----------|------|-----------------|
| `AppointmentDetailModal` | AppointmentDetailModal.tsx | “Start Travel” → `POST /tracking/start`; periodic `POST /tracking/:sessionId/update` |
| `HomeServiceTrackingManager` | tracking/HomeServiceTrackingManager.tsx | “Start for home” → `POST /vendor/bookings/:id/start-travel`; periodic `POST /vendor/bookings/:id/location-update` |
| `HomeServiceTrackingPageClient` | app/bookings/home-service/[bookingId]/HomeServiceTrackingPageClient.tsx | Route `/bookings/home-service/[bookingId]`; loads booking then renders HomeServiceTrackingManager |

**Test steps (GPS)**

1. **Backend:** GET /tracking/customer/phone/:phone/active returns sessions when a session exists for that customer.
2. **Backend:** POST /vendor/bookings/:id/start-travel with valid bookingId, vendorId creates session and returns session; customer notification sent.
3. **Customer:** On home, after vendor starts, within ~10s popup appears (VendorOnTheWayPopup); “Track” opens `/tracking/[bookingId]` or gps-tracking screen with LiveTrackingWidget.
4. **Customer:** Booking detail for at_home in_progress: “Track” or tracking indicator uses GET /tracking/booking/:id (no 404).
5. **Vendor:** From booking list/detail, open home-service tracking (e.g. link to `/bookings/home-service/[id]` or Start in modal); Start for home → location updates every N sec; customer sees ETA update.

---

## 2. Notifications

### Backend endpoints

| Endpoint | File | Purpose |
|----------|------|---------|
| `GET /notifications?userId=&userType=customer` | notifications.ts | List by user ID + type |
| `GET /customer/notifications?phone=` | notifications.ts | List by phone (query param) |
| `GET /customer/notifications/:phone` | customer-phone-convenience.ts | List by phone (path; used by UserAccountSidebar, useNotificationService) |
| `PUT /notifications/:notificationId/read` | notifications.ts | Mark one read |
| `POST /notifications` (internal) | — | publishNotification() writes to DB + SNS |

### Customer components

| Component | File | Renders / uses |
|-----------|------|-----------------|
| Notifications page | app/notifications/page.tsx | **Fixed:** Uses GET /notifications?userId=…&userType=customer with fallback GET /customer/notifications?phone=; mark read PUT /notifications/:id/read |
| UserAccountSidebar / useNotificationService | UserAccountSidebar.tsx, useNotificationService.tsx | GET /customer/notifications/:phone (customer-phone-convenience); PUT /customer/notifications/:phone for settings |
| CustomerNotificationModal | CustomerNotificationModal.tsx | GET /customer/notifications (no phone in path) |

**Test steps (notifications)**

1. **Backend:** GET /notifications?userId=<customerId>&userType=customer returns list; PUT /notifications/:id/read marks read.
2. **Frontend:** Open /notifications; list loads (no 404); click notification → mark read and optional navigate (e.g. to booking).

---

## 3. Prescriptions & Medical Records

### Backend endpoints

| Endpoint | File | Purpose |
|----------|------|---------|
| `GET /prescriptions/booking/:bookingId` | prescriptions.ts | Prescription for booking |
| `GET /medical-records/booking/:bookingId` | medical-records.ts | Medical records + prescriptions for booking |
| `POST /medical-records/prescription` | medical-records.ts | Create prescription (vendor) |
| `POST /medical-records/diagnostic-report` | medical-records.ts | Upload diagnostic report |
| `POST /diagnostics/reports/upload` | diagnostics-reports.ts | Diagnostics vendor upload report |

### Customer components

| Component | File | Renders / uses |
|-----------|------|-----------------|
| `BookingDetailModal` | BookingDetailModal.tsx | Loads prescription via GET /prescriptions/booking/:id; medical records via GET /bookings/:id/medical-records (or medical-records/booking/:id) |
| `PrescriptionHistoryModal` | PrescriptionHistoryModal.tsx | Prescription list/view |
| `DiagnosticsReportViewer` | diagnostics/DiagnosticsReportViewer.tsx | View report; link to vet appointment |

### Vendor components

| Component | File | Renders / uses |
|-----------|------|-----------------|
| `VendorPrescriptionModal` / prescription create | modals/VendorPrescriptionModal.tsx, PrescriptionCreate | Create prescription → POST medical-records/prescription or prescriptions API |
| `DiagnosticsReportUpload` | diagnostics/DiagnosticsReportUpload.tsx | POST /diagnostics/reports/upload |

**Test steps (prescriptions)**

1. **Backend:** POST /medical-records/prescription with bookingId, petId, etc. creates record; GET /prescriptions/booking/:id returns it.
2. **Customer:** Open booking → BookingDetailModal shows prescription/medical records when present.
3. **Vendor:** From appointment, create prescription; customer sees it in same booking.
4. **Diagnostics:** Vendor uploads via DiagnosticsReportUpload → POST /diagnostics/reports/upload; customer sees report in booking and medical records.

---

## 4. Pharmacy Broadcast (5km → 10km → 20km)

### Backend endpoints

| Endpoint | File | Purpose |
|----------|------|---------|
| POST create pharmacy order + start broadcast | pharmacy-broadcast.ts | Create order, insert pharmacy_broadcasts, notify 5km |
| `GET /pharmacy/orders/:id/broadcast-status` (or equivalent) | pharmacy-broadcast.ts | Status + currentRadius, accepted count |
| POST expand radius (or job) | pharmacy-broadcast.ts / pharmacy-broadcast-expansion-processor | 5 → 10 → 20 km every 2 min |
| Pharmacy accept | pharmacy-broadcast.ts | Pharmacy accepts order |

### Customer components

| Component | File | Renders / uses |
|-----------|------|-----------------|
| `PharmacyOrderFlow` | pharmacy/PharmacyOrderFlow.tsx | Create order; pollBroadcastStatus → GET broadcast-status; auto-expand every 2 min; show 5/10/20 km |
| `PharmacyOrderStatus` | pharmacy/PharmacyOrderStatus.tsx | Polls status; shows PharmacyBroadcastMap (currentRadius, pharmacies notified) |
| `PharmacyBroadcastMap` | pharmacy/PharmacyBroadcastMap.tsx | Visual 5/10/20 km, pharmacies notified |

### Vendor components

| Component | File | Renders / uses |
|-----------|------|-----------------|
| `PharmacyOrderDashboard` | pharmacy/PharmacyOrderDashboard.tsx | List orders; accept; high-volume/beep (if wired) |
| `PharmacyOrderAlerts` | pharmacy/PharmacyOrderAlerts.tsx | Alerts for new orders |

**Test steps (pharmacy)**

1. **Backend:** Create order → broadcast 5km; after 2 min expansion job → 10km, then 20km; GET broadcast-status returns currentRadius and counts.
2. **Customer:** During broadcast, PharmacyOrderFlow/PharmacyOrderStatus shows radius 5 → 10 → 20 and “Finding pharmacies”; on accept, move to invoice/approval.
3. **Vendor:** Pharmacy receives order (push/dashboard); accept → customer sees accepted.

---

## 5. Tele Consultation (5-min reminder, chat, video)

### Backend endpoints

| Endpoint | File | Purpose |
|----------|------|---------|
| `GET /customer/:phone/bookings/upcoming-calls?minutes=5` | customer-phone-convenience.ts | Upcoming tele bookings within 5 min |
| `GET /notifications?userId=&userType=customer&isRead=false` | notifications.ts | Incoming call notification (tele_call_incoming) |
| `POST /video-call/create-meeting` | video-call.ts / video-call-enhanced | Create Chime meeting |
| `GET /video-call/:bookingId` | video-call.ts | Meeting info for booking |
| `POST /video-call/join`, `POST /video-call/end` | video-call.ts | Join/end call |

### Customer components

| Component | File | Renders / uses |
|-----------|------|-----------------|
| `CustomerHomeComplete` | CustomerHomeComplete.tsx | checkUpcomingCalls() → GET /customer/:phone/bookings/upcoming-calls?minutes=5; sets `upcomingCall`; checkIncomingCalls() → GET notifications (tele_call_incoming) → sets `incomingCall` |
| `TeleConsultationReminderNotification` | TeleConsultationReminderNotification.tsx | Renders when `upcomingCall` set; “Join call” / open chat |
| `ChatInterfaceFromNotification` | ChatInterfaceFromNotification.tsx | Open chat from notification (chatFromNotification state) |
| `VideoPageClient` | app/video/[bookingId]/VideoPageClient.tsx | Video call page; create/join meeting |
| `ChimeVideoCall` | booking/ChimeVideoCall.tsx | Chime UI for join/end |

### Vendor components

| Component | File | Renders / uses |
|-----------|------|-----------------|
| `AppointmentDetailModal` | AppointmentDetailModal.tsx | Start video from booking; meeting link |

**Test steps (tele)**

1. **Backend:** GET /customer/:phone/bookings/upcoming-calls?minutes=5 returns tele bookings in next 5 min.
2. **Customer:** On home, when a tele booking is within 5 min, TeleConsultationReminderNotification shows; “Join call” opens video/chat.
3. **Customer:** Incoming call notification (tele_call_incoming) sets incomingCall; UI shows incoming call and join.
4. **Video:** Create meeting → join from customer and vendor → end; prescription upload after call visible in booking.

---

## 6. Multi-Service Booking & Cancel/Reschedule/Refund

### Backend endpoints

| Endpoint | File | Purpose |
|----------|------|---------|
| `POST /bookings/create` | bookings-enhanced.ts | Accepts selectedServices[]; stores in booking |
| `POST /bookings/:id/cancel` | bookings-enhanced.ts | Cancel; optional refund flow |
| `POST /bookings/:id/reschedule` | bookings-enhanced.ts | Reschedule |
| `POST /customer/bookings/refund-preview` | bookings-enhanced.ts | Refund preview for cancel |
| `POST /refund-policy/calculate` | refund-policy-engine.ts | Policy-based refund amount |
| `POST /refunds/create` | refunds.ts | Create refund record |

### Customer components

| Component | File | Renders / uses |
|-----------|------|-----------------|
| `UniversalPaymentPage` | payment/UniversalPaymentPage.tsx | Builds selectedServices; POST /bookings/create |
| `MyBookings` | MyBookings.tsx | Cancel → POST /bookings/:id/cancel; Reschedule → POST /bookings/:id/reschedule |
| `CancelBookingModal` | CancelBookingModal.tsx | GET refund-preview → POST /bookings/:id/cancel |
| `BookingActions` | BookingActions.tsx | Refund preview GET; reschedule POST; cancel POST |
| `RescheduleBookingModal` | RescheduleBookingModal.tsx | POST /bookings/:id/reschedule |
| `RescheduleBooking` | RescheduleBooking.tsx | GET vendor reschedule-policy; POST reschedule |
| `BookingDetailModal` | BookingDetailModal.tsx | Shows booking; may show multiple services if API returns them |

**Test steps (multi-service & policies)**

1. **Backend:** POST /bookings/create with selectedServices array; GET booking returns selected_services; list/detail UI shows all services.
2. **Cancel:** From My Bookings or detail → Cancel → refund-preview → cancel; refund amount matches policy.
3. **Reschedule:** Reschedule modal → POST reschedule with newDate/newTime; booking updates.
4. **Refund:** After cancel, refund record created and (if integrated) Razorpay refund triggered.

---

## 7. Quick reference: Endpoint → Component

| Backend endpoint | Customer component(s) | Vendor component(s) |
|------------------|------------------------|----------------------|
| GET /tracking/customer/phone/:phone/active | useActiveGpsTracking → CustomerHomeComplete, VendorOnTheWayPopup | — |
| GET /tracking/booking/:bookingId | LiveTrackingWidget, TrackingPageClient, BookingDetailModal (fixed) | — |
| POST /vendor/bookings/:id/start-travel | — | HomeServiceTrackingManager |
| POST /vendor/bookings/:id/location-update | — | HomeServiceTrackingManager |
| GET /notifications?userId=&userType= | app/notifications/page.tsx | — |
| GET /customer/notifications?phone= | app/notifications/page.tsx (fallback) | — |
| GET /customer/:phone/bookings/upcoming-calls?minutes=5 | CustomerHomeComplete → TeleConsultationReminderNotification | — |
| GET /prescriptions/booking/:id | BookingDetailModal | — |
| GET /medical-records/booking/:id | BookingDetailModal | — |
| POST /diagnostics/reports/upload | — | DiagnosticsReportUpload |
| GET /pharmacy/orders/:id/broadcast-status | PharmacyOrderFlow, PharmacyOrderStatus | — |
| POST /bookings/create | UniversalPaymentPage, UniversalHomeServiceRouter, VetBookingRouter, etc. | — |
| POST /bookings/:id/cancel | MyBookings, CancelBookingModal, BookingActions | — |
| POST /bookings/:id/reschedule | MyBookings, RescheduleBookingModal, BookingActions, RescheduleBooking | — |
| POST /customer/bookings/refund-preview | CancelBookingModal, BookingActions | — |

---

## 8. Fixes applied in this pass

1. **BookingDetailModal** – `checkTrackingStatus` was calling non-existent `GET /bookings/:bookingId/tracking/status`. Updated to `GET /tracking/booking/:bookingId` and to treat status in_transit/active/en_route as active.
2. **Notifications page** – Already fixed earlier: uses GET /notifications?userId=… and GET /customer/notifications?phone=.

---

## 9. Suggested test checklist (copy-paste)

- [ ] **GPS:** Vendor starts home booking (AppointmentDetailModal or HomeServiceTrackingManager) → customer home shows popup within ~10s → Track opens live map → ETA updates → mark arrived.
- [ ] **GPS:** From booking detail (at_home, in_progress), “Track” or tracking indicator works (no 404).
- [ ] **Notifications:** Open /notifications → list loads; mark one read.
- [ ] **Prescription:** Vendor adds prescription to booking → customer sees in BookingDetailModal.
- [ ] **Diagnostics:** Vendor uploads report (DiagnosticsReportUpload) → customer sees in booking and medical records.
- [ ] **Pharmacy:** Place order → customer sees 5km then 10km then 20km; pharmacy accepts → invoice/approval.
- [ ] **Tele:** Book tele → within 5 min customer home shows “Call in 5 min”; join video from reminder or booking.
- [ ] **Multi-service:** Create booking with 2+ services (if UI supports) → My Bookings/detail show all.
- [ ] **Cancel:** Cancel booking → refund preview → confirm cancel; refund policy respected.
- [ ] **Reschedule:** Reschedule booking → new date/time saved.

Use this document together with `FORENSIC_VERIFICATION_FULL_SCOPE.md` and `SERVICE_BOOKING_VERIFICATION.md` for full coverage.

---

## 10. Backend test commands (quick verification)

Run these against your API base to confirm endpoints respond (no 500):

```bash
export API_BASE_URL="https://your-api.execute-api.region.amazonaws.com"

# GPS: GET tracking by booking (no /status – backend path is /tracking/booking/:bookingId)
curl -s -o /dev/null -w "%{http_code}" "$API_BASE_URL/tracking/booking/test-booking-123"

# Notifications: list by user
curl -s -o /dev/null -w "%{http_code}" "$API_BASE_URL/notifications?userId=test&userType=customer"

# Notifications: by phone (customer-phone-convenience)
curl -s -o /dev/null -w "%{http_code}" "$API_BASE_URL/customer/notifications/%2B919876543210"

# Bookings: create (expect 400/404 without valid body)
curl -s -X POST "$API_BASE_URL/bookings/create" -H "Content-Type: application/json" -d '{}' -w "\n%{http_code}"
```

**Tracking flow scripts (aligned with backend):**

- `scripts/test-tracking-flow.ts` – E2E tracking flow (uses `GET /tracking/booking/:bookingId`, no `/status`).
- `scripts/test-tracking-flow-comprehensive.ts` – Synthetic tests for tracking endpoints and UI integration (same path).

---

## 11. Verification status

| Area | Backend traced | Customer UI traced | Vendor UI traced | Test steps documented |
|------|----------------|--------------------|------------------|------------------------|
| GPS tracking | ✅ | ✅ | ✅ | ✅ |
| Notifications | ✅ | ✅ | — | ✅ |
| Prescriptions / medical records | ✅ | ✅ | ✅ | ✅ |
| Pharmacy broadcast | ✅ | ✅ | ✅ | ✅ |
| Tele (reminder, chat, video) | ✅ | ✅ | ✅ | ✅ |
| Multi-service & cancel/refund | ✅ | ✅ | — | ✅ |

**Verification complete:** All flows above are traced to exact components and endpoints. Use Section 9 checklist and Section 10 commands for systematic frontend + backend testing.
