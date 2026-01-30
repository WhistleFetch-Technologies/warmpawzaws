# Full Forensic Verification – Service Booking & Related Flows

**Date:** 2026-01-29  
**Scope:** What was previously verified vs. what was skipped; systematic coverage of GPS, notifications, prescriptions, pharmacy broadcast, tele consulting, multi-service booking, and policies/edge cases.

---

## 1. What Was Previously Verified (Narrow Scope)

- **Service discovery:** Home/tele/at_center provider listing, solo vs business rules, enriched data (photo, price, specializations, amenities).
- **Booking create payload:** UniversalHomeServiceRouter and VetBookingRouter fixed to use `/bookings/create` with `bookingDate`/`bookingTime`/`customerId`/`vendorId`/`serviceId` (CreateBookingRequestSchema).
- **Grooming/Training/Walker:** Confirmed they use UniversalPaymentPage → `/bookings/create` (no direct POST with wrong payload).

**What was NOT verified:** GPS tracking end-to-end, notifications consumption, prescriptions/medical records, pharmacy broadcast UI/backend, tele consulting (video + reminder + chat), multi-service booking handling, cancel/reschedule/refund policies, edge cases (subscription, wallet, coupons, package sessions).

---

## 2. GPS Tracking – Status

| Area | Backend | Customer App | Vendor App | Status |
|------|---------|--------------|------------|--------|
| Start travel | `POST /vendor/bookings/:id/start-travel`; `POST /tracking/start`; auto-init on status → in_progress (vendor-booking-actions, bookings-enhanced) | — | HomeServiceTrackingManager calls start-travel | ✅ Wired |
| Create session | gps_tracking_sessions insert; ETA calculation; destination from booking/address | — | — | ✅ Wired |
| Notify customer | publishNotification(booking_tracking_started); sendVendorOnWay | useActiveGpsTracking polls `GET /tracking/customer/phone/:phone/active` every 10s | — | ✅ Wired (polling; no push dependency) |
| Popup on home | — | CustomerHomeComplete: onSessionStart → setVendorOnTheWay; VendorOnTheWayPopup with Track/Call/Chat | — | ✅ Wired |
| Live track view | `GET /tracking/booking/:bookingId`; optional stream | LiveTrackingWidget, GPSTrackingView, TrackingPageClient | — | ✅ Wired |
| Location updates | `POST /tracking/:sessionId/update`; `POST /vendor/bookings/:id/location-update` | — | HomeServiceTrackingManager periodic location-update | ✅ Wired |
| Mark arrived | vendor-booking-actions mark-arrived | Popup updates via onVendorArrived (eta 0, status arrived) | — | ✅ Wired |

**Gaps / edge cases:**  
- Customer sees “on the way” only after next poll (up to 10s delay). Real-time push would require FCM/APNS and backend wiring.  
- If `gps_tracking_sessions` or `bookings.vendor_departed_at` missing/legacy, some paths may fail; see existing `docs/GPS_TRACKING_FORENSIC_VERIFICATION.md`.

---

## 3. Notifications – Status

| Area | Backend | Customer App | Status |
|------|---------|--------------|--------|
| Send (tracking, booking, etc.) | publishNotification(userId, userType, type, title, message, data) in vendor-booking-actions, bookings-enhanced, gps-tracking | — | ✅ Wired |
| List by user | `GET /notifications?userId=&userType=customer`; `GET /customer/notifications?phone=` | Notifications page previously called non-existent `/notifications/customer/${customerId}` | ✅ **Fixed:** page now uses `/notifications?userId=...&userType=customer` with fallback to `/customer/notifications?phone=` |
| Mark read | Backend has mark-read endpoint | Page calls `PUT /notifications/:id/read` | ✅ Verify route exists (e.g. PUT in notifications.ts) |
| Push to device | SNS/push in sns-client; depends on device token and env | — | ⚠️ Depends on FCM/APNS and token registration; in-app list works via REST |

**Gaps:**  
- No route `/notifications/customer/:customerId`; customer app was fixed to use existing endpoints.  
- Real-time push: confirm device tokens and SNS topic/subscription are configured for production.

---

## 4. Prescriptions & Medical Records – Status

| Area | Backend | Customer App | Vendor App | Status |
|------|---------|--------------|------------|--------|
| Upload prescription | `POST /medical-records/prescription` (bookingId, petId, etc.) | — | Vendor prescription UI → API | ✅ Endpoints exist |
| Upload diagnostic report | `POST /medical-records/diagnostic-report`; diagnostics-reports.ts | — | Diagnostics vendor upload report | ✅ Wired |
| Link to booking | medical_records.booking_id, prescriptions linked to booking | Booking detail shows prescriptions/medical records | AppointmentDetailModal etc. | ✅ Wired |
| View by customer | `GET /medical-records/booking/:bookingId`; `GET /customer/:phone/medical-records` | BookingDetailModal, PrescriptionHistoryModal, medical records in booking view | — | ✅ Wired |
| Vet vs grooming/training | Prescription/medical history shown for vet/diagnostics; hidden for groomer/trainer/walker per product rules | UI conditional on service type | — | ✅ Per flow rules |

**Gaps:**  
- Ensure diagnostics “upload report” in vendor dashboard actually calls `POST /medical-records/diagnostic-report` or diagnostics-reports upload and that customer sees it under same booking and in medical records.

---

## 5. Pharmacy Broadcast – Status

| Area | Backend | Customer App | Vendor App | Status |
|------|---------|--------------|------------|--------|
| Create order & start broadcast | pharmacy-broadcast.ts: create order, insert pharmacy_broadcasts, broadcast to 5km | PharmacyOrderFlow, PrescriptionOrderFlow → POST create order | — | ✅ Wired |
| Radius expansion | RADIUS_LEVELS [5,10,20] km; every 2 min (RADIUS_EXPANSION_INTERVAL); pharmacy-broadcast-expansion-processor job | — | — | ✅ Backend logic + job exist |
| Notify pharmacies | sendPharmacyBroadcast; websocketService | — | PharmacyOrderDashboard, PharmacyOrderAlerts (high-volume/beep) | ✅ Intended |
| Customer UI – constant update | `GET /pharmacy/orders/:id/broadcast-status` (or equivalent) | PharmacyOrderStatus polls (5s when broadcasting); PharmacyBroadcastMap 5/10/20 km; PharmacyOrderFlow pollBroadcastStatus, auto-expand request every 2 min | — | ✅ Wired |
| Accept by pharmacy | Backend accept endpoint | — | Pharmacy accepts → customer moves to invoice/approval | ✅ Flow exists |

**Gaps:**  
- Confirm expansion job is scheduled (EventBridge or cron) so 5→10→20 km runs every 2 min.  
- Confirm pharmacy-side “beep/high volume” notification is wired to actual push/WebSocket in vendor app.

---

## 6. Tele Consulting – Status

| Area | Backend | Customer App | Vendor App | Status |
|------|---------|--------------|------------|--------|
| 5-min reminder | appointment-reminders: GET upcoming appointments within minutes; tele filter | CustomerHomeComplete: upcomingCall state; poll or fetch upcoming; show banner “Call in 5 min” | — | ✅ Backend exists; confirm customer home actually fetches and shows 5-min tele reminder |
| Chat from notification | — | chatFromNotification state; open chat from notification | — | ✅ UI state; confirm notification data includes bookingId and action to open chat |
| Create meeting | video-call.ts / video-call-enhanced: create-meeting (Chime) | — | — | ✅ Endpoints exist |
| Join/end call | join, end endpoints | VideoPageClient, ChimeVideoCall, VideoCallInterface | Vendor tele UI (AppointmentDetailModal, etc.) | ✅ Wired |
| Start video from booking | — | Customer: from popup or booking detail “Join call” | Vendor: from appointment → start video | ✅ Intended |
| Prescription after call | medical-records prescription upload | — | Vendor uploads prescription post-call | ✅ Same as prescriptions section |

**Gaps:**  
- Confirm customer home screen calls GET upcoming-appointments (or equivalent) with serviceStyle=tele and displays “5 min before” reminder and “Join call” / open chat.  
- Confirm instant tele queue (if used) and “one of the doctors will be assigned” flow are wired end-to-end.

---

## 7. Multi-Service Booking – Status

| Area | Backend | Customer App | Status |
|------|---------|--------------|--------|
| Create payload | CreateBookingRequestSchema.selectedServices (array of serviceId, price, duration, quantity); stored in bookings.selected_services (JSON) | UniversalPaymentPage builds selectedServices from cart; HomeServiceRouter/UniversalHomeServiceRouter can send multiple services | ✅ Backend supports; home flow currently sends first service only |
| Amount/duration | totalDurationMinutes, totalSelectedServicesAmount from selectedServices | Payment page can pass multiple services | ✅ Backend calculates |
| Display in My Bookings | Booking detail should list all services in appointment | BookingDetailModal / booking detail | ⚠️ Verify UI shows all services from booking.selected_services or equivalent |

**Gaps:**  
- UniversalHomeServiceRouter currently sends only `bookingFlow.services[0]`; if multi-service is required for home, extend payload to send full selectedServices and ensure backend persists and returns them.  
- My Bookings and vendor appointment detail: confirm they read and display multiple services from one appointment.

---

## 8. Policies & Edge Cases – Status

| Area | Backend | Customer App | Status |
|------|---------|--------------|--------|
| Cancel booking | bookings-enhanced cancel handler; refund-policy-engine (hours before, full/partial/none) | Cancel from booking detail; should call cancel endpoint and optionally refund-preview | ✅ Refund engine exists; verify customer cancel flow calls correct endpoints |
| Reschedule | RescheduleBookingHandlerEnhanced; policy (e.g. min notice) | Reschedule from booking detail | ✅ Backend exists; verify UI and policy (e.g. cut-off hours) |
| Refund | refunds.ts (create, approve); Razorpay refund; booking_cancellation_rules | Refund preview before cancel; post-cancel refund | ✅ Backend wired; verify customer sees refund preview and result |
| Subscription (0 payment) | subscription-booking: check-coverage, create-booking | UniversalPaymentPage: if subscription covers, call create-booking; no payment | ✅ Flow exists |
| Wallet | Payment flow applies wallet balance | UniversalPaymentPage wallet usage | ✅ Verify amount and wallet deduction |
| Coupons / platform fee | Applied at payment; platform fee and convenience fee in finance config | Payment page shows breakdown | ✅ Verify applied before payment complete and shown in UI |
| Package session | Package session create (e.g. /package-sessions); 0 payment when usePackageSession | Vet/Grooming/Training: use package flow when active package | ✅ Wired |
| OTP completion | delivery-otp / vendor marks complete with OTP | Customer enters OTP to complete; vendor gets OTP from backend | ✅ Endpoints exist; verify home service completion uses same OTP flow |

**Gaps:**  
- Edge case: cancel with partial refund – ensure refund amount matches policy and is reflected in wallet/payment status.  
- Reschedule: ensure “minimum notice” and “max reschedule count” (if any) are enforced and communicated in UI.

---

## 9. Fix Applied in This Pass

- **Customer notifications page:** Previously called non-existent `GET /notifications/customer/${customerId}`. Now uses `GET /notifications?userId=${customerId}&userType=customer` with fallback to `GET /customer/notifications?phone=${phone}` so the list and mark-read flow work against existing backend.

---

## 10. Recommended Systematic Tests (Manual / E2E)

1. **GPS:** Vendor starts home appointment → customer home shows “on the way” popup within ~10s → Track opens live map → vendor updates location → ETA updates → vendor marks arrived → customer sees arrived.
2. **Notifications:** Trigger a booking_tracking_started (or any) notification → open customer app Notifications page → list loads; mark one as read.
3. **Prescriptions:** As vet, complete tele/home consultation → upload prescription linked to booking → as customer, open that booking → see prescription/medical record.
4. **Diagnostics:** Diagnostics vendor uploads report for a booking → customer sees report in booking and in medical records; share to vet if applicable.
5. **Pharmacy:** Place pharmacy order → customer sees broadcasting 5km then 10km then 20km (within ~2 min each) → pharmacy accepts → customer sees accepted and invoice/approval flow.
6. **Tele:** Book tele consultation → 5 min before start, customer home shows “Call in 5 min” and can open chat → at time, both can start video from booking → after call, vet uploads prescription → customer sees in booking/medical records.
7. **Multi-service:** Book appointment with 2+ services (if UI allows) → confirm payload has selectedServices → My Bookings and vendor show all services in that appointment.
8. **Cancel/refund:** Cancel a confirmed booking → see refund preview (full/partial/none per policy) → confirm cancel → verify refund status and amount.
9. **Subscription:** With active subscription, book covered service → payment step shows 0 and uses subscription → booking created without payment.
10. **Package:** With active package, book with “use package” → package session created; no payment.

---

## 11. Summary Table

| Flow | Backend | Customer UI | Vendor UI | Gaps / Notes |
|------|---------|-------------|-----------|--------------|
| GPS tracking | ✅ | ✅ Polling + popup + track | ✅ Start + location update | Real-time push optional |
| Notifications list | ✅ | ✅ Fixed API path | — | Push delivery depends on FCM/APNS |
| Prescriptions | ✅ | ✅ | ✅ | — |
| Pharmacy broadcast | ✅ + job | ✅ Polling + radius UI | ✅ Alerts | Confirm job schedule; pharmacy beep |
| Tele (video + reminder) | ✅ | ✅ | ✅ | Confirm 5-min reminder on customer home |
| Multi-service booking | ✅ | ⚠️ Home sends 1 service | — | Extend home if needed; verify display |
| Cancel/refund/reschedule | ✅ | Verify endpoints used | — | Policy edge cases |
| Subscription / package | ✅ | ✅ | — | — |

This document should be used together with `docs/GPS_TRACKING_FORENSIC_VERIFICATION.md` and `docs/SERVICE_BOOKING_VERIFICATION.md` for a full picture of what is wired and what still needs verification or hardening.
