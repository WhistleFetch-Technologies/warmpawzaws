# Endpoint Verification Report
## Customer Web App Endpoints

Generated: $(date)

## Missing Endpoints Analysis

### 1. Chat Endpoints
**Frontend expects:**
- `POST /chat/send`
- `POST /chat/upload-file`
- `GET /chat/file/:fileId`

**Backend has:**
- `POST /chat/booking/:bookingId/message` ✅ (different route)
- No `/chat/upload-file` ❌
- No `/chat/file/:fileId` ❌

### 2. Notification Endpoints
**Frontend expects:**
- `GET /customer/notifications`
- `POST /notifications/mark-read`
- `POST /notifications/mark-all-read`
- `DELETE /notifications/:id`

**Backend has:**
- `GET /notifications` (with userId query) ✅
- `PUT /notifications/:notificationId/read` ✅ (different route)
- `PUT /notifications/:userId/mark-all-read` ✅ (different route)
- No DELETE endpoint ❌

### 3. Appointment Endpoints
**Frontend expects:**
- `GET /appointment/:appointmentId`
- `POST /appointment/:appointmentId/cancel`
- `POST /appointment/:appointmentId/reschedule`
- `GET /appointment/customer/:customerId`

**Backend needs verification**

### 4. Booking Endpoints
**Frontend expects:**
- `POST /bookings/:bookingId/reschedule`
- `GET /vendor/reschedule-policy`
- `GET /vendor/available-slots`
- `POST /booking/create`
- `POST /followup/create`

**Backend needs verification**

### 5. Behavior Journal
**Frontend expects:**
- `GET /customer/behavior-journal`
- `POST /behaviorist/journal-entry`

**Backend needs verification**
