# Forensic Booking E2E Validation Report

**Date:** 2026-01-31  
**Scope:** Frontend–Backend alignment for booking flows (create, payment, confirmation)

## 1. API Contract: CreateBookingRequestSchema

| Field | Type | Required | Frontend Source | Backend Expectation |
|-------|------|----------|-----------------|---------------------|
| customerId | UUID | Yes* | Resolved from customerPhone if missing | Required; backend now resolves from customerPhone when absent |
| vendorId | UUID | Yes | Props/navigation | Required |
| serviceId | UUID or 'diagnostics' | Yes | Resolved from vendor services | Required; backend looks up vendor_services by service_id |
| bookingDate | YYYY-MM-DD | Yes | selectedDate from date picker | Required regex |
| bookingTime | HH:MM or HH:MM:SS | Yes | selectedTime, normalized | Required regex |
| serviceType | enum | Yes | serviceStyle mapped | at_vendor, at_home, online, at_center, tele, hybrid, product |
| amount | number | No | taxBreakdown.total | Optional |
| totalAmount | number | No | — | Optional (alternate to amount) |
| petId | UUID | No | selectedPet.id | Optional |
| petName | string | No | selectedPet.name | Optional |
| customerPhone | string | No | phone prop | Optional; used to resolve customerId |
| customerName | string | No | Profile API | Optional |
| address | string | No | Formatted address for at_home | Optional |
| notes | string | No | User input | Optional |
| selectedServices | array | No | From multi-service selection | Optional; each: id, serviceId, name, price, duration, quantity |

*Backend now resolves customerId from customerPhone when customerId is missing.

## 2. Fixes Applied

### 2.1 Frontend (UniversalPaymentPage)
- **customerId resolution:** Before creating a booking, if `customerId` is missing, the frontend fetches it from `/customer/by-phone` or `/customer/profile` using `customerPhone`. If resolution fails, the user sees a clear error and the request is not sent.
- **selectedServices:** Each item includes `serviceId: s.service_id || s.serviceId || s.id` so the UUID is preferred when available. Numeric values are coerced for `price`, `duration`, and `quantity`.

### 2.2 Backend (bookings-enhanced.ts)
- **customerId from customerPhone:** Before validation, if `customerId` is absent but `customerPhone` is present, the handler resolves `customerId` from the `customers` table. A 400 error is returned with a clear message if neither is provided or resolution fails.

### 2.3 Response Handling
- Frontend supports multiple response shapes: `data.bookingId`, `bookingId`, `booking_id`, `id`.
- Backend returns: `{ success: true, data: { bookingId, status, message, isNew } }`.

## 3. serviceType Enum Mapping

Frontend `serviceStyle` → Backend `serviceType`:
- `at_home` → `at_home`
- `at_center` → `at_center`
- `tele` → `tele`
- `online` → `tele`
- `at_vendor` → `at_vendor`
- `ecom` → `product`
- `product` → `product`
- `hybrid` → `hybrid`

## 4. bookingTime Format
- Frontend normalizes to `HH:MM` or `HH:MM:SS` (e.g. `09:00` or `09:00:00`).
- Backend regex: `^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$`

## 5. selectedServices Schema (SelectedServiceSchema)
- `id`, `serviceId`: optional strings
- `name`: optional string
- `price`, `duration`: optional, coerced to number
- `quantity`: optional, default 1

## 6. Booking Creation Endpoints
Frontend attempts, in order:
1. `POST /bookings/create`
2. `POST /booking/create`
3. `POST /customer/booking/create`
4. `POST /customer/bookings/create`

All routes use the same handler and validation.

## 7. Flows Verified
- **UniversalPaymentPage** (primary): customerId resolution, selectedServices, address formatting, serviceType mapping
- **UniversalBookingRouter** (direct POST): Resolves customerId via `/customer/by-phone`; sends selectedServices
- **VetBookingRouter** (handleConfirmBooking): Uses direct POST path; relies on UniversalPaymentPage for main flow

## 8. Gaps Resolved
1. customerId missing when only customerPhone available → resolved on frontend and backend.
2. selectedServices serviceId → prefer `service_id` (UUID) when present.
3. Numeric coercion for selectedServices fields → applied in frontend mapping.
