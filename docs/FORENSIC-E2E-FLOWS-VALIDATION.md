# Forensic E2E Flows Validation Report

End-to-end code validation for: **Start travel**, **Video call**, **GPS tracking**, **Notification UI + tone**.

---

## 1. Start Travel Flow (Vendor → Backend → Customer)

| Check | Status | Detail |
|-------|--------|--------|
| Vendor: Start Travel button and handler | ✅ | `AppointmentDetailModal.tsx`: `handleStartTravel`, "Start Travel" button |
| Vendor: POST /tracking/start | ✅ | `apiClient.post('/tracking/start', { bookingId, vendorId, staffId, startLatitude, startLongitude })` |
| Vendor: POST /tracking/:sessionId/update | ✅ | `watchPosition` callback → `apiClient.post('/tracking/${sid}/update', { latitude, longitude })` |
| Backend: POST /tracking/start | ✅ | `gps-tracking.ts` app.post("/tracking/start") |
| Backend: booking status vendor_on_way | ✅ | `update('bookings', { id: bookingId }, { status: 'vendor_on_way' })` |
| Backend: gps_tracking_sessions.customer_id | ✅ | `gps-tracking-service.ts` insert with `customer_id: customerId` for customer active lookup |
| Customer: GET /customer/bookings?status=in_progress,vendor_on_way | ✅ | `CustomerHomeComplete` loadActiveBookings |
| Customer: VendorOnTheWayPopup | ✅ | Shown when `vendorOnTheWay` set (from loadActiveBookings or useActiveGpsTracking) |
| Customer: useActiveGpsTracking | ✅ | Polls GET /tracking/customer/phone/:phone/active |
| Customer: Popup onTrack / onJoinCall | ✅ | VendorOnTheWayPopup onTrack → onNavigate('gps-tracking', { bookingId }), onJoinCall → video-call |

**Backend routes:** POST /tracking/start, POST /tracking/:sessionId/update, GET /tracking/booking/:bookingId, GET /tracking/customer/phone/:phone/active.

---

## 2. Video Call Flow

| Check | Status | Detail |
|-------|--------|--------|
| Wrapper: videoCallData and video-call screen | ✅ | `CustomerHomeWrapper`: videoCallData state, currentScreen === 'video-call' |
| Wrapper: MyBookings onNavigate sets videoCallData | ✅ | onNavigate: setVideoCallData({ bookingId, meetingId }), setCurrentScreen('video-call') |
| Wrapper: ChimeVideoCall receives bookingId | ✅ | ChimeVideoCall bookingId={videoCallData.bookingId} |
| ChimeVideoCall: POST /video-call/join | ✅ | apiClient.post('/video-call/join', { bookingId, participantId, participantType }) |
| ChimeVideoCall: POST /video-call/:bookingId/end | ✅ | apiClient.post(`/video-call/${bookingId}/end`) |
| ChimeVideoCall: GET /video-call/:bookingId/attendees | ✅ | apiClient.get(`/video-call/${bookingId}/attendees`) |
| Backend: video-call routes | ✅ | video-call.ts: join, end, GET /video-call/:bookingId/attendees |

**Entry points to video-call:** MyBookings, VendorOnTheWayPopup, TeleConsultationReminderNotification, TeleCallNotification → onNavigate('video-call', { bookingId, meetingId }).

---

## 3. GPS Tracking (Customer) Flow

| Check | Status | Detail |
|-------|--------|--------|
| Wrapper: trackingBookingId and gps-tracking screen | ✅ | CustomerHomeWrapper: trackingBookingId state, currentScreen === 'gps-tracking' |
| Wrapper: MyBookings onNavigate sets trackingBookingId | ✅ | onNavigate: setTrackingBookingId(data?.bookingId), setCurrentScreen('gps-tracking') |
| Wrapper: TrackingPageClient receives bookingId | ✅ | TrackingPageClient bookingId={trackingBookingId} |
| TrackingPageClient: GET /tracking/booking/:bookingId | ✅ | apiClient.get(`/tracking/booking/${bookingId}`) polling |
| Backend: GET /tracking/booking/:bookingId | ✅ | gps-tracking.ts getTrackingStatus(bookingId) |
| Backend: GET /tracking/customer/phone/:phone/active | ✅ | Resolves phone → customer_id, returns active sessions |

---

## 4. Notification UI + Tone

| Check | Status | Detail |
|-------|--------|--------|
| TeleConsultationReminderNotification | ✅ | Shown when `upcomingCall` set; onStartCall → onNavigate('video-call', { bookingId, meetingId }) |
| checkUpcomingCalls: GET /customer/:phone/bookings/upcoming-calls | ✅ | CustomerHomeComplete; backend customer-phone-convenience.ts |
| TeleCallNotification | ✅ | Shown when `incomingCall` set; onAccept → onNavigate('video-call', { bookingId, meetingId }) |
| checkIncomingCalls: GET /notifications?userId= | ✅ | Filters type === 'tele_call_incoming'; GET /bookings/:id for provider details |
| Backend: GET /notifications resolves phone → customer_id | ✅ | **FIX APPLIED:** When userId is not UUID and userType === 'customer', resolve phone to customer_id via customers table so phone-only users get incoming call notifications |
| useIncomingCallRingtone | ✅ | TeleCallNotification: 800 Hz beep every 1.2s when ringing && callType === 'incoming' (Web Audio) |
| Reminder onStartCall | ✅ | TeleConsultationReminderNotification onStartCall → video-call |

---

## Fixes Applied in This Validation

1. **GET /notifications with phone as userId**  
   Customer app calls `/notifications?userId=${customerId || phone}`. When only `phone` is set (before customerId is loaded), the backend previously required a UUID and returned empty. **Fix:** In `backend/lambda/src/endpoints/notifications.ts`, when `userId` is not a UUID and `userType === 'customer'`, resolve `userId` (phone) to `customer_id` via `select('customers', { phone })` and use that as `effectiveUserId` for the query. Incoming call notifications now work for phone-only users.

---

## How to Re-run Validation

```bash
npx ts-node scripts/forensic-e2e-flows-validation.ts
```

The script greps source files for the expected API paths, state names, and wiring. Exit code 1 if any check fails.
