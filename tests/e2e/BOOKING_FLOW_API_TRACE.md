# Booking Flow – API Trace (E2E Reference)

**Purpose:** Systematic trace of API calls, parameters, and response shapes for all booking flows so frontend/backend and E2E tests stay aligned.

---

## 1. Discovery & Slots

| Step | Frontend / Test | Endpoint | Method | Request (params/body) | Backend response shape |
|------|-----------------|----------|--------|------------------------|------------------------|
| Categories | Service catalog | `/service-catalog/categories` | GET | - | `{ success?, data?: { categories } }` |
| Vendor search | Discovery | `/service-discovery/vendors?lat=&lng=&radius_km=` or `/customer/discover-services?lat=&lng=&role_id=` | GET | Query: `lat`, `lng`, `radius_km` or `role_id` | Vendors array |
| Vendor services | Vendor profile | `/vendor/:vendorId/services` or `/customer/vendor/:vendorId/services` | GET | Path: `vendorId` | `{ services }` with `service_id` or `id` |
| **Available slots** | Date/time picker | **`/bookings/available-slots`** | GET | **Query: `vendorId`, `date`** (camelCase). Optional: `serviceId`, `serviceStyle`, `staffId` | `{ success: true, slots: [{ time, available }], date, vendorId }` |

**Parameter alignment:** Use `vendorId` and `date` (not `vendor_id`). Backend: `followup-reschedule.ts`.

---

## 2. Booking Create

| Step | Frontend / Test | Endpoint | Method | Request body | Backend response |
|------|-----------------|----------|--------|---------------|------------------|
| **Create booking** | Payment / booking flow | `/bookings/create` (or `/booking/create`, `/customer/booking/create`, `/customer/bookings/create`) | POST | **camelCase** per `CreateBookingRequestSchema`: `customerId`, `vendorId`, `serviceId`, `bookingDate`, `bookingTime`, `serviceType`, `amount?`, `customerPhone?`, `staffId?`, `address?`, `petId?`, `selectedServices?`, etc. | **Standardized:** `{ success: true, data: { bookingId, status, message, isNew }, meta }` or legacy `{ bookingId }` / `{ booking_id }` |

**Response parsing (E2E & frontend):**  
`bookingId = response.data?.data?.bookingId ?? response.data?.bookingId ?? response.data?.booking_id ?? response.data?.id`

**Backend:** `bookings-enhanced.ts` – `CreateBookingHandlerEnhanced`; accepts camelCase (Zod schema).

---

## 3. Booking Details & History

| Step | Endpoint | Method | Request | Response |
|------|----------|--------|---------|----------|
| Get booking | `/bookings/:bookingId` or `/customer/bookings/:bookingId` | GET | Path: `bookingId` | Standardized: `{ success, data: { booking } }` or `{ booking }`. Booking may have `selected_services` (JSONB), `total_duration_minutes`, snake_case DB fields. |
| Status history | `/bookings/:bookingId/history` | GET | Path: `bookingId` | `{ success, data: { history } }` or `{ history }` |

**Parsing:** `booking = response.data?.data?.booking ?? response.data?.booking ?? response.data`.

---

## 4. Status Transitions (Confirm / Start / Complete)

| Step | Endpoint | Method | Request body | Notes |
|------|----------|--------|--------------|--------|
| Confirm | **`/bookings/:bookingId/status`** | **PUT** | `{ status: 'confirmed', reason?: string }` | Use status update; no separate `/confirm`. |
| Start (check-in) | **`/bookings/:bookingId/status`** | **PUT** | `{ status: 'in_progress', reason?: string }` | |
| Complete | **`/bookings/:bookingId/status`** | **PUT** | `{ status: 'completed', notes?: string }` | |

**Backend:** `bookings-enhanced.ts` – `UpdateBookingStatusHandlerEnhanced`; body per `UpdateBookingStatusRequestSchema` (`status`, `reason?`, `notes?`).

---

## 5. OTP (Generate / Verify)

| Step | Endpoint | Method | Request body | Response |
|------|----------|--------|--------------|----------|
| Generate OTP | `/bookings/:bookingId/generate-otp` | POST | `{ action?: 'start' \| 'end', sessionNumber?: number }` | `{ success, otp?, generatedAt, expiresAt, sentTo }` |
| Verify OTP | `/bookings/:bookingId/verify-otp` | POST | `{ otp: string, action?: 'start', sessionNumber?: number }` | `{ success }` or error |

**Backend:** `otp-enhanced.ts`. Do not use `otpType` / `phone` in body; use `action` and optional `sessionNumber`.

---

## 6. Cancellation & Refund

| Step | Endpoint | Method | Request | Response |
|------|----------|--------|---------|----------|
| Refund preview | `/customer/bookings/refund-preview` | POST | Body: `{ bookingId }` (camelCase) | Refund breakdown |
| Calculate refund | `/bookings/:bookingId/calculate-refund` | POST | Body: `{ cancellationReason? }` | `{ success, refund: { refundAmount, ... } }` |
| Cancel | `/bookings/:bookingId/cancel` | POST | Body: `{ reason?, refundRequested? }` | Standardized success/error |

**Backend:** `bookings-enhanced.ts` – `GetRefundPreviewHandler`, cancel handler.

---

## 7. Customer Booking History

| Step | Endpoint | Method | Request | Response |
|------|----------|--------|---------|----------|
| By phone | `/customer/bookings?phone=` | GET | Query: `phone` (required), `status?`, `petId?`, `serviceType?` | `{ bookings }` array |
| Active | `/customer/bookings/active?phone=` | GET | Query: `phone` | Active bookings |

**Backend:** `customer-phone-convenience.ts`.

---

## 8. Frontend → Backend Parameter Checklist

- **Slots:** `vendorId`, `date` (not `vendor_id`).
- **Create booking:** camelCase body (`customerId`, `vendorId`, `serviceId`, `bookingDate`, `bookingTime`, `serviceType`, etc.).
- **Create response:** Prefer `data.bookingId` from standardized envelope; fallbacks: `bookingId`, `booking_id`, `data.id`, `id`.
- **Get booking:** Handle both `data.booking` and top-level `booking`; DB fields may be snake_case (`selected_services`, `total_duration_minutes`).
- **Status transitions:** Use PUT `/bookings/:id/status` with `{ status }` (and optional `reason`/`notes`); no separate confirm/start/complete endpoints in bookings-enhanced.
- **OTP:** Body `action`, `sessionNumber`; not `otpType`/`phone`.
- **Refund preview:** Body `{ bookingId }`.

---

*Last updated: 2026-01-29; aligned with booking-flow-comprehensive.test.ts and backend bookings-enhanced / otp-enhanced / followup-reschedule / customer-phone-convenience.*
