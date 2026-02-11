# Four Jio SMS Templates – When They’re Sent (Prod)

All four templates use **header WARMPZ** (DLT Sender ID) and are sent via **Option A** (DB credentials).  
You should receive four sample SMS on **9611377119** in this order:

1. **Login OTP** (template 1207177028377787269)  
2. **Booking Confirmation** (template 1207177035174777582)  
3. **Booking Rescheduled** (template 1207177035515118051)  
4. **Booking Cancelled** (template 1207177035326314961)

---

## 1. Login OTP

**Template ID:** `1207177028377787269`  
**Exact text:**  
`Warmpawz: Your OTP for logging in is {#number#}. Do not share this OTP with anyone.`

### When it’s sent (prod)

- **Customer app:** User enters phone → taps “Send OTP” → `POST /auth/send-otp` → this SMS is sent (when `UAT_MODE` is not `true`).
- **Vendor/Staff app:** User enters phone → “Send OTP” → `POST /staff/login/send-otp` (or resend OTP / individual provider OTP) → same template and SMS.

### How it’s used once OTP is entered

1. User gets this SMS with a 6‑digit OTP.
2. User enters that OTP in the app and submits (e.g. “Verify”).
3. App calls **Verify OTP**:
   - Customer: `POST /auth/verify-otp` with `{ phone, otp }`
   - Staff: `POST /staff/login/verify-otp` with `{ phone, otp }`
4. Backend checks `otp_tokens` (code + not expired + not used), then:
   - **Customer:** Creates/updates customer, creates or refreshes Cognito session, returns tokens + customerId. App stores tokens and uses them for all later API calls (bookings, profile, etc.).
   - **Staff:** Returns session/token for staff/vendor dashboard.
5. After that, the user is “logged in” and can create bookings, manage profile, etc. No further SMS is sent for “login” itself; the next SMS are **booking** events below.

So: **Login OTP** = only for the one-time verification step. After the user enters the OTP and verify succeeds, login is complete and the next SMS they may get are **Booking Confirmation / Rescheduled / Cancelled**.

---

## 2. Booking Confirmation

**Template ID:** `1207177035174777582`  
**Exact text:**  
`Warmpawz Booking: Your booking with {#alphanumeric#} for {#alphanumeric#} at {#alphanumeric#} is confirmed. For more details, refer to My Bookings.`

Placeholders in prod: **provider/service name**, **date** (e.g. 10-Feb-2026), **time** (e.g. 10:30 AM).

### When it’s sent (prod)

- When a **booking is created** and confirmed (payment done if required).
- In code: after a successful create in `bookings-enhanced.ts`, `triggerBookingNotification('booking_created', { booking, customer, vendor, service, ... })` is called, which sends this template to the **customer’s phone**.

### How it’s used

- Customer has already logged in (OTP entered and verified).
- Customer books a service (e.g. grooming) and completes payment if needed.
- Backend creates the booking and triggers the SMS.
- Customer receives this SMS as proof of confirmation and can open “My Bookings” in the app to see details. No extra step is required after receiving it; it’s informational.

---

## 3. Booking Rescheduled

**Template ID:** `1207177035515118051`  
**Exact text:**  
`Warmpawz Rescheduling: Your booking with {#alphanumeric#} has been rescheduled to {#alphanumeric#}. For more details, refer to My Bookings.`

Placeholders: **provider/service name**, **new date and time** (e.g. 12-Feb-2026 at 2:00 PM).

### When it’s sent (prod)

- When a booking is **rescheduled** (customer or vendor changes date/time).
- In code: in `bookings-enhanced.ts`, when a reschedule is applied, `triggerBookingNotification('booking_rescheduled', { ... })` is called → this template is sent to the **customer’s phone**.

### How it’s used

- After login and possibly after “Booking Confirmation” SMS.
- When the slot is rescheduled, the customer gets this SMS so they know the new time. They can open “My Bookings” to see the updated booking. No action required unless they want to change again.

---

## 4. Booking Cancelled

**Template ID:** `1207177035326314961`  
**Exact text:**  
`Warmpawz Cancellation: Your booking with {#alphanumeric#} scheduled for {#alphanumeric#} has been cancelled. For more details, refer to My Bookings.`

Placeholders: **provider/service name**, **original date and time**.

### When it’s sent (prod)

- When a booking is **cancelled** (by customer or vendor/admin).
- In code: in `bookings-enhanced.ts`, on cancel, `triggerBookingNotification('booking_cancelled', { ... })` is called → this template is sent to the **customer’s phone**.

### How it’s used

- Customer receives confirmation that the booking is cancelled. They can check “My Bookings” for refund/status if applicable. No further action needed for the SMS itself.

---

## End-to-end prod flow (with OTP)

1. **Login**
   - User enters phone → **Login OTP** SMS sent.
   - User enters OTP in app → Verify OTP API → logged in (tokens + customerId/staff session).
2. **Booking**
   - User creates a booking (and pays if required) → **Booking Confirmation** SMS.
   - If booking is rescheduled → **Booking Rescheduled** SMS.
   - If booking is cancelled → **Booking Cancelled** SMS.

All four templates are sent with **header WARMPZ** and the correct Jio DLT template IDs; delivery depends on SNS sandbox/production and DLT registration.
