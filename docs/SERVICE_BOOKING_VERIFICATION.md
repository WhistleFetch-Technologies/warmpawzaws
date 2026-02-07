# Service Booking – Forensic Verification Checklist

This document summarizes the **service booking implementation** and **forensic testing checklist** for customer-web and backend.

---

## 1. Backend Booking Endpoints

| Endpoint | Purpose | Used By |
|----------|---------|----------|
| `POST /bookings/create` | Create booking (primary) | UniversalPaymentPage, VetBookingRouter (fallback), HomeServiceRouter, etc. |
| `POST /customer/bookings/create` | Alias for create | UniversalPaymentPage (fallback), UniversalHomeServiceRouter |
| `POST /booking/create` | Legacy alias | UniversalPaymentPage (fallback) |
| `POST /customer/booking/create` | Legacy alias | bookings-enhanced.ts |
| `GET /customer/vendor/:vendorId/available-slots` | Slots for date + style | HomeServiceRouter, slot selection |
| `GET /bookings/:bookingId` | Booking details | My Bookings, detail modal |

**Request contract (CreateBookingRequestSchema):**

- `customerId` (UUID), `vendorId` (UUID), `serviceId` (UUID)
- `bookingDate` (YYYY-MM-DD), `bookingTime` (HH:MM)
- `serviceType`: `at_vendor` | `at_home` | `online` | `at_center` | `tele` | `hybrid` | `product`
- Optional: `staffId`, `petId`, `address`, `amount`, `notes`, `serviceName`, `customerPhone`, `customerName`, `petName`, `selectedServices`

---

## 2. Customer-Web Booking Flows (Verified)

### 2.1 Home Services (Groomer, Trainer, Walker, Behaviourist, Sitter, Vet at home)

- **Entry:** Service dashboard → Home service → `UniversalHomeServiceRouter` or `HomeServiceRouter` / `HomeServiceProviderListView`.
- **Steps:** Landing → Provider list (discover-services) → Provider profile → Select services → Select pet → Select time → Select address → Payment → Confirmation.
- **Create booking:** `UniversalHomeServiceRouter.handlePaymentSuccess` now:
  - Uses **`/bookings/create`** (and fallbacks: `/customer/bookings/create`, `/booking/create`, `/customer/booking/create`).
  - Sends **`bookingDate`**, **`bookingTime`** (no longer `scheduledDate`/`scheduledTime`).
  - Sends **`serviceType: 'at_home'`** and `customerId`, `vendorId`, `serviceId` per schema.

### 2.2 Vet (Clinic / Home / Tele)

- **Entry:** Vet service → style (clinic/home/tele) → provider list → `VetBookingRouter`.
- **Steps:** Service → Details (date/time/pet) → Payment (UniversalPaymentPage) → Confirmation.
- **Create booking:**
  - **Primary:** `UniversalPaymentPage` → `POST /bookings/create` with correct payload (customerId, vendorId, serviceId UUID, bookingDate, bookingTime, serviceType).
  - **Fallback (e.g. no payment UI):** `VetBookingRouter.handleConfirmBooking` now sends **camelCase** and **bookingDate/bookingTime** (no longer snake_case / scheduled_date/scheduled_time), and only when `customerId` and valid `serviceId` (UUID) are present.

### 2.3 Grooming

- **Entry:** Grooming service → style (center/home) → provider list → `GroomingBookingRouter`.
- **Create booking:** Always via **UniversalPaymentPage** → `/bookings/create` with correct payload. No direct POST in GroomingBookingRouter.

### 2.4 Training

- **Entry:** Training service → style → provider list → `TrainingBookingRouter`.
- **Create booking:** Always via **UniversalPaymentPage** → `/bookings/create`. No direct POST in TrainingBookingRouter.

### 2.5 Walker

- **Entry:** Walker service → provider list → `WalkerService` / `CreateBookingPage` or walker booking flow.
- **Create booking:** Via **UniversalPaymentPage** or dedicated flow using `/bookings/create`. Walker-specific screens (e.g. schedule-walk) use the same backend create endpoint where applicable.

---

## 3. Forensic Testing Checklist

Use this to verify end-to-end booking.

### 3.1 Discovery

- [ ] **Home (at_home):** Service dashboard → Home (e.g. Groomer) → List shows **solo** providers only, with photo, price, distance, rating, specializations.
- [ ] **Tele:** Vet/Tele or Nutritionist/Tele → List shows solo providers; filters and sort (distance, rating, price) work.
- [ ] **At-center:** Grooming/Training/Diagnostics “at center” → List shows **business** vendors (clinics/centers), not solo.

### 3.2 Slots

- [ ] **Available slots:** After selecting a provider and date, slots load from `GET /customer/vendor/:vendorId/available-slots?date=YYYY-MM-DD&serviceStyle=at_home` (or tele/at_center as applicable).
- [ ] No slots or error: check vendor has `vendor_availability_v2` and `vendor_services` for that style.

### 3.3 Booking creation

- [ ] **Home service (UniversalHomeServiceRouter):** Complete flow to payment → pay → booking is created; no 404 on `/customer/booking`; response has `bookingId` or `booking.id`.
- [ ] **Vet:** Flow through UniversalPaymentPage → pay → booking created; if any path calls `handleConfirmBooking`, payload uses `bookingDate`/`bookingTime` and `customerId`/`vendorId`/`serviceId` (UUID).
- [ ] **Grooming / Training / Walker:** Payment step → UniversalPaymentPage → booking created with correct vendor/service/date/time.

### 3.4 Payload validation

- [ ] Backend returns 400 with clear message when e.g. `customerId` missing or not UUID, or `serviceId` not UUID, or `bookingDate`/`bookingTime` invalid.
- [ ] No success when sending only `scheduled_date`/`scheduled_time` or `customer_phone` instead of `customerId`/`bookingDate`/`bookingTime` (legacy payloads fixed on frontend).

### 3.5 Post-booking

- [ ] **My Bookings:** New booking appears with vendor name, service, date/time, status.
- [ ] **Booking detail:** Opening a booking shows correct details; for vet/diagnostics, prescription/medical history visible where applicable; for grooming/training/walker, no prescription/medical history.
- [ ] **Vendor:** Appointment appears on vendor dashboard; accept/start/complete and OTP (for home) work as per product rules.

---

## 4. Fixes Applied (This Pass)

1. **UniversalHomeServiceRouter**
   - Replaced non-existent `POST /customer/booking` with **`/bookings/create`** and fallbacks.
   - Payload aligned to CreateBookingRequestSchema: `bookingDate`, `bookingTime`, `customerId`, `vendorId`, `serviceId`, `serviceType: 'at_home'`.

2. **VetBookingRouter**
   - In `handleConfirmBooking` (regular booking path): switched from snake_case and `scheduled_date`/`scheduled_time` to **camelCase** and **`bookingDate`**/ **`bookingTime`**; added **`customerId`**, **`vendorId`**, **`serviceId`** (UUID); guard when `customerId` or vendor/service missing.

3. **Grooming / Training / Walker**
   - No direct create in these routers; they use UniversalPaymentPage, which already calls `/bookings/create` with the correct payload. No code change required.

---

## 5. API Contract Reference

- **CreateBookingRequestSchema:** `packages/api-contracts/src/bookings.ts`
- **Backend handler:** `backend/lambda/src/endpoints/bookings-enhanced.ts` (CreateBookingHandlerEnhanced), plus alias routes in the same file.
