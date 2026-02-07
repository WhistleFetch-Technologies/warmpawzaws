# Vet Home Service & Tele Consulting – Post-Booking Process (Step-by-Step)

This document describes **exactly** what happens after a customer books a **vet home visit** or **vet tele consultation**, for both **Customer** and **Vendor**, with where to click and what completes the booking. All steps are traced from the implementation code.

---

## Part 1: Vet HOME SERVICE (At Home Visit)

### 1.1 CUSTOMER – After Payment & Confirmation

| Step | Where | What to do | What happens in code |
|------|--------|------------|----------------------|
| 1 | **Confirmation screen** (VetBookingRouter, step === 'confirmation') | Click **"View Booking Details"** | `onViewBooking?.(bookingId)` is called. In CustomerHomeWrapper, `handleViewBooking(bookingId)` runs: sets `selectedBookingId`, then `setCurrentScreen('my-bookings')`. |
| 2 | **My Bookings** list | You land on **My Bookings** with the new booking in the list. | MyBookings loads via `GET /customer/${phone}/bookings` (or `GET /customer/bookings?phone=...`). The new booking appears with status **confirmed**, vendor name, review, **Call**, **Directions**, and **Booking OTP** (once generated). |
| 3 | **My Bookings** | Click the **booking card** (the row for this appointment). | `setSelectedBooking(booking)` is called. The same screen re-renders and now shows **BookingDetailModal** instead of the list (same route, modal replaces list). |
| 4 | **Booking detail (modal)** | You see: service name, vet/hospital name, date/time, pet, address, **OTP** (completion OTP), **Track Live Location** (when vendor has started travel), **Chat**, **Call**, **Directions**. | BookingDetailModal loads details via `GET /customer/bookings/:bookingId` or similar. OTP is shown from `booking.otpCode` / `booking.completionOTP`. |
| 5 | **When vendor starts travel** | **VendorOnTheWayPopup** appears on the **Home** screen (bottom popup). It shows: “Vendor on the way”, ETA, vendor name/photo. | CustomerHomeComplete uses `useActiveGpsTracking(phone)`, which polls `GET /tracking/customer/phone/:phone/active`. When a session exists, `onSessionStart` sets `vendorOnTheWay` and the popup is shown. |
| 6 | **Popup** | Click **"Track"** on the popup. | `onTrack(booking.bookingId)` → `onNavigate('gps-tracking', { bookingId })`. CustomerHomeWrapper sets `trackingBookingId` and `currentScreen('gps-tracking')`. |
| 7 | **GPS tracking screen** | Full-screen **TrackingPageClient** with map. You see vendor’s live location and ETA. | Component polls `GET /tracking/booking/:bookingId` every 3 seconds. Backend returns session from `gps_tracking_sessions` (current lat/lng, ETA, status). |
| 8 | **When vendor arrives** | Popup/UI can show “Vendor arrived”. You may get a notification. | Backend updates tracking status to `arrived`; customer’s polling sees the update. |
| 9 | **Service at door** | Vet performs the visit. When done, **vet asks you for the 4-digit OTP**. You read it from **My Bookings** → open that booking → **OTP** section (or from the booking card if shown there). | OTP is displayed in MyBookings card and in BookingDetailModal (`booking.otpCode` / `completionOTP`). |
| 10 | **Vendor completes with OTP** | You don’t click anything; you just give the OTP to the vet. | Vendor enters OTP in **AppointmentDetailModal** → “Complete Job (OTP)” → OTP modal → submits. Backend `POST /vendor/bookings/:bookingId/complete` with `{ vendorId, otp }` verifies OTP and sets booking status to **completed**. |
| 11 | **Booking completed** | In **My Bookings**, the same booking now shows status **Completed**. You can open it to see summary, prescriptions (if any), chat, and **Review** button. | MyBookings refetches or you navigate back; booking status is `completed`. RateServiceModal can be opened from the card’s **Review** button. |

**Summary – Customer (Home):**  
Confirmation → **View Booking Details** → My Bookings → **click booking** → Detail modal (OTP, Track, Chat, Call). When vendor starts: **Track** from home popup → live GPS. When vendor finishes: give **OTP** to vet → vet completes in app → booking shows **Completed**; optionally **Review**.

---

### 1.2 VENDOR – Vet Home Visit (Solo / Vet with at_home)

| Step | Where | What to do | What happens in code |
|------|--------|------------|----------------------|
| 1 | **Vendor app** | Log in as the vet/vendor for whom the appointment was booked. | Auth and routing to dashboard (e.g. SoloProviderDashboard for solo vet). |
| 2 | **Dashboard** (e.g. Solo Provider Dashboard) | **Appointments** section shows today’s schedule. You see the new appointment: time, customer name, pet name, service (e.g. “Home Visit”). | Appointments loaded via `GET /vendor/bookings/:vendorId` or similar; filtered by date. |
| 3 | **Appointment card** | Click **“View” / “Details”** (or the row). | `onViewDetails(bookingId)` → `setSelectedAppointment(apt)` and `setAppointmentDetailModalOpen(true)`. |
| 4 | **Appointment Detail Modal** | Modal opens with tabs: **Details**, **History**, **Prescriptions**. For **at_home** and status **confirmed** you see a blue button: **“Start Travel”**. | AppointmentDetailModal loads booking by `bookingId`; `isHomeStyle` true for at_home; button shown when `booking.status === 'confirmed'`. |
| 5 | **Start Travel** | Click **“Start Travel”**. | `handleStartTravel()` runs. Asks for browser GPS; then `POST /tracking/start` with `{ bookingId, vendorId, staffId, startLatitude, startLongitude }`. Backend creates `gps_tracking_sessions` and returns session id. |
| 6 | **GPS tracking** | A **tracking modal** opens with a map: your location and customer’s destination. Your location is sent periodically. | `navigator.geolocation.watchPosition` callback sends `POST /tracking/:sessionId/update` with lat/lng. Customer can see live tracking via `GET /tracking/booking/:bookingId`. |
| 7 | **En route** | When you reach the customer’s address, click **“Mark Arrived”** (amber button in the same modal or details). | `handleArrived()`: optionally stops tracking; `POST /vendor/bookings/:bookingId/status` with `{ status: 'arrived', note: '...' }`. Backend updates booking to **arrived**. |
| 8 | **At customer’s door** | Perform the visit. When finished, ask the customer for their **4-digit OTP** (they see it in their app under that booking). | OTP is generated at booking confirmation and shown in customer’s My Bookings and booking detail. |
| 9 | **Complete with OTP** | In the **Appointment Detail Modal**, click **“Complete Job (OTP)”** (green). In the OTP modal, enter the 4-digit OTP and click **“Complete”**. | `setOtpAction('complete')`, `setShowOtpModal(true)`. User enters OTP; `handleOtpSubmit()` → `POST /vendor/bookings/:bookingId/complete` with `{ vendorId, otp }`. Backend verifies OTP, sets status to **completed**, creates vendor_earnings, and can trigger settlement. |
| 10 | **Done** | Modal can be closed; list refreshes. Booking shows **Completed**. | `loadAppointmentDetails()` and `onRefresh()` refresh the list. |

**Summary – Vendor (Home):**  
Dashboard → **View Details** on appointment → **Start Travel** (GPS starts, customer can track) → **Mark Arrived** → do visit → **Complete Job (OTP)** → enter customer’s OTP → **Complete** → booking completed and earnings recorded.

---

## Part 2: Vet TELE CONSULTATION (Video Call)

### 2.1 CUSTOMER – After Booking a Tele Consultation

| Step | Where | What to do | What happens in code |
|------|--------|------------|----------------------|
| 1 | **Confirmation screen** | Same as home: click **“View Booking Details”**. | Same as home: `onViewBooking(bookingId)` → My Bookings. |
| 2 | **My Bookings** | Click the **tele** booking card to open details. | BookingDetailModal opens for that booking (chat, video entry point, etc.). |
| 3 | **~5 minutes before slot** | On **Home**, a **TeleConsultationReminderNotification** appears (banner or modal if &lt; 2 min). Shows: “Consultation in X min”, **Open Chat**, **Start Call**. | CustomerHomeComplete calls `GET /customer/:phone/bookings/upcoming-calls?minutes=5`. If a tele booking is within 5 minutes, `upcomingCall` is set and TeleConsultationReminderNotification is rendered. |
| 4 | **Reminder** | Click **“Open Chat”** to open chat only, or **“Start Call”** when ready to join video. | **Open Chat:** `onOpenChat(bookingId)` → `setChatFromNotification({ isOpen: true, bookingId, vendorName, vendorPhoto })` → chat UI opens. **Start Call:** `onStartCall(bookingId, meetingId)` → `onNavigate('video-call', { bookingId, meetingId })`. |
| 5 | **Navigate to video** | If you clicked **Start Call**, app navigates to **video-call** screen with `videoCallData = { bookingId, meetingId }`. | CustomerHomeWrapper sets `videoCallData` and `currentScreen('video-call')`, then renders **ChimeVideoCall** with `bookingId`, `participantType='customer'`, `participantId=phone`. |
| 6 | **ChimeVideoCall** | Component calls `POST /video-call/join` with `{ bookingId, participantId: phone, participantType: 'customer' }`. Backend creates/returns Chime meeting + attendee; customer joins the meeting. | AWS Chime SDK joins the meeting; video/audio and optional chat (Chime data messages) work. When call ends, `POST /video-call/:bookingId/end` is called. |
| 7 | **Alternative: vendor starts first** | If the **vet** starts the video from their side, you may get an **incoming call** notification (TeleCallNotification). Click **Accept**. | `checkIncomingCalls()` polls notifications; when type is `tele_call_incoming`, `incomingCall` is set. Accept → `onNavigate('video-call', { bookingId, meetingId })` → same ChimeVideoCall flow. |
| 8 | **After call** | Consultation is done. Vet may upload prescription or mark complete from their app. You can see **prescription / medical history** in the same booking (Details / Prescriptions / Medical history). | No OTP for tele. Completion is either vet clicking “Complete Consultation” or backend when call ends. Prescriptions appear in booking detail and medical history. |

**Summary – Customer (Tele):**  
Confirmation → **View Booking Details** → My Bookings. Before slot: **5‑min reminder** on Home → **Open Chat** or **Start Call** → video-call screen → Chime join. Or accept **incoming call** if vet started first. After call: view prescription/medical history in booking; no OTP.

---

### 2.2 VENDOR – Vet Tele Consultation

| Step | Where | What to do | What happens in code |
|------|--------|------------|----------------------|
| 1 | **Dashboard** | See the **tele** appointment in the list (e.g. “Video Consultation”, “Tele”). Click **View Details**. | Same as home: open AppointmentDetailModal for that booking. |
| 2 | **Appointment Detail Modal** | For **tele** you see an indigo **“Video Call”** button (no Start Travel). Optionally use **Chat** first (chat tab or Communication Hub). | `isTeleStyle` true; button `onClick={handleStartVideoCall}`. |
| 3 | **Start video** | Click **“Video Call”**. | `handleStartVideoCall()`: `POST /video-call/create-meeting` with `{ bookingId, customerId, vendorId }`, then `POST /video-call/join` with `{ bookingId, userId: vendorId, userType: 'vendor' }`. Then `POST /video-call/notify-ready` to notify customer. |
| 4 | **New tab** | Browser opens **`/video/:bookingId`** in a new tab (Chime video call UI for vendor). | Vendor joins the same meeting; customer can join from their app (reminder or incoming call). |
| 5 | **During/after call** | Conduct consultation. Optionally open **Prescriptions** tab and click **“Write Rx” / “Update Rx”** to add prescription. | VendorPrescriptionModal; prescription is saved and linked to booking; customer sees it in booking detail and medical history. |
| 6 | **Complete** | When consultation is over, in the **Details** tab click **“Complete Consultation”** (green, no OTP). | For tele, AppointmentDetailModal shows “Complete Consultation” or “Mark Complete” that calls `POST /vendor/bookings/:bookingId/complete` with `{ vendorId }` only (no OTP). Backend sets status to **completed** and creates vendor_earnings. |

**Summary – Vendor (Tele):**  
Dashboard → **View Details** on tele appointment → **Video Call** (create meeting, join, notify customer) → video opens in new tab → do consultation → **Write Rx** if needed → **Complete Consultation** (no OTP) → booking completed.

---

## Quick Reference – APIs and UI Locations

| Action | API / Location |
|--------|----------------|
| Customer: list bookings | `GET /customer/:customerId/bookings` or `GET /customer/bookings?phone=...` |
| Customer: booking detail | My Bookings → click card → BookingDetailModal |
| Customer: active GPS sessions | `GET /tracking/customer/phone/:phone/active` (useActiveGpsTracking) |
| Customer: live tracking for one booking | `GET /tracking/booking/:bookingId` (TrackingPageClient) |
| Customer: upcoming tele calls | `GET /customer/:phone/bookings/upcoming-calls?minutes=5` |
| Customer: join video | `POST /video-call/join` then Chime SDK; screen: video-call → ChimeVideoCall |
| Vendor: list appointments | `GET /vendor/bookings/:vendorId` (or equivalent) |
| Vendor: appointment detail | Dashboard → View Details → AppointmentDetailModal |
| Vendor: start travel (home) | `POST /tracking/start` then watchPosition → `POST /tracking/:sessionId/update` |
| Vendor: mark arrived | `POST /vendor/bookings/:bookingId/status` with `status: 'arrived'` |
| Vendor: complete (home, with OTP) | `POST /vendor/bookings/:bookingId/complete` with `{ vendorId, otp }` |
| Vendor: start video (tele) | `POST /video-call/create-meeting`, `POST /video-call/join`, `POST /video-call/notify-ready`; open `/video/:bookingId` |
| Vendor: complete (tele) | `POST /vendor/bookings/:bookingId/complete` with `{ vendorId }` (no OTP) |

---

## Files (for code-level tracing)

- **Customer:**  
  - `apps/customer-web/components/customer/wrappers/CustomerHomeWrapper.tsx` (handleViewBooking, gps-tracking, video-call screens)  
  - `apps/customer-web/components/customer/MyBookings.tsx` (list + BookingDetailModal)  
  - `apps/customer-web/components/customer/BookingDetailModal.tsx` (detail, OTP, track)  
  - `apps/customer-web/components/customer/CustomerHomeComplete.tsx` (useActiveGpsTracking, VendorOnTheWayPopup, upcomingCall, TeleConsultationReminderNotification)  
  - `apps/customer-web/components/customer/VendorOnTheWayPopup.tsx` (Track button)  
  - `apps/customer-web/app/tracking/[bookingId]/TrackingPageClient.tsx` (live GPS)  
  - `apps/customer-web/components/customer/booking/ChimeVideoCall.tsx` (video join/end)  
  - `apps/customer-web/components/customer/TeleConsultationReminderNotification.tsx` (5‑min reminder, Start Call)  
  - `apps/customer-web/components/customer/vet/VetBookingRouter.tsx` (confirmation, View Booking Details)

- **Vendor:**  
  - `apps/vendor-web/components/vendor/dashboard/SoloProviderDashboard.tsx` (appointment list, open detail)  
  - `apps/vendor-web/components/vendor/AppointmentDetailModal.tsx` (Start Travel, Mark Arrived, Complete Job (OTP), Video Call, Complete Consultation, OTP modal, tracking modal)

- **Backend:**  
  - `backend/lambda/src/endpoints/gps-tracking.ts` (tracking/start, booking/:bookingId, customer/phone/:phone/active)  
  - `backend/lambda/src/endpoints/video-call.ts` (join, create-meeting, notify-ready, end, attendees)  
  - `backend/lambda/src/endpoints/vendor-booking-actions.ts` (complete, status, mark-arrived)

This is the exact post-booking process for vet home and tele as implemented in the codebase.
