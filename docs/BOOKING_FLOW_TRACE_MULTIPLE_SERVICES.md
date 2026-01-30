# Booking Flow Trace: Multiple Service Selection

**Date:** 2026-01-30  
**Question:** Is multiple service selection implemented when booking an appointment?

---

## 1. Summary

| Area | Multiple service selection |
|------|----------------------------|
| **API contract** | ✅ Supported: `CreateBookingRequestSchema` has optional `selectedServices: z.array(SelectedServiceSchema)`. |
| **Backend** | ✅ Supported: Accepts `selectedServices`, computes total duration/amount, stores `selected_services` JSONB on `bookings`. |
| **DB** | ✅ Schema: `bookings.selected_services` (JSONB); `booking_services` junction table exists (migration 502) but backend does **not** insert into it. |
| **Grooming flow** | ✅ Implemented: Multi-select UI → GroomingBookingRouter → UniversalPaymentPage creates booking **with** `selectedServices`. |
| **Vet / Universal flow** | ✅ Implemented: UniversalBookingRouter sends `selectedServices` in the create-booking call when `allSelectedServices` or `selectedServices` has length > 0; amount is sum of selected services. |
| **Other flows** | ❌ Single service only: BookingFlow, VetBookingRouter, HomeServiceRouter, NutritionistBookingRouter, etc. all use single `serviceId`. |

**Conclusion:** Multiple service selection is **implemented for both grooming and vet/universal flows**. UniversalBookingRouter now sends `selectedServices` (and total amount) in the create-booking request when the user has selected multiple services.

---

## 2. Flow Trace

### 2.1 Entry points (customer-web)

- **Booking by service ID (single):**  
  `UnifiedBookingEngine` / `BookingFlow` → single `serviceId`; no multi-select.
- **Vet / clinic:**  
  `VetServicesByStyle` or `UniversalServicesByStyle` → user can select **multiple** services → navigates with `selectedServices` array → **VetBookingFlow** → **UniversalBookingRouter** (or vet-specific router).
- **Grooming:**  
  `GroomingServicesByStyle` → user can select **multiple** services → navigates with `selectedServices` → **GroomingBookingRouter** → **UniversalPaymentPage** (booking created on payment success **with** `selectedServices`).
- **Training / others:**  
  Similar pattern to vet/grooming where a “by style” screen exists; routing may go to UniversalBookingRouter or role-specific router.

### 2.2 Backend: POST /bookings/create

- **File:** `backend/lambda/src/endpoints/bookings-enhanced.ts`
- **Body:** `CreateBookingRequestSchema`: required `serviceId` (single), optional `selectedServices` (array).
- **Behaviour:**
  - If `selectedServices` is present and non-empty:
    - Computes `totalDurationMinutes` and `totalSelectedServicesAmount`.
    - Uses `totalSelectedServicesAmount` (or subscription) for `base_price` / `total_amount`.
  - Inserts **one** row into `bookings` with:
    - `service_id` = resolved single service (FK).
    - `selected_services` = JSON.stringify(selectedServices) when provided.
    - `total_duration_minutes` when computed.
  - Does **not** insert into `booking_services` table.

### 2.3 Who creates the booking?

| Flow | Where booking is created | Sends `selectedServices`? |
|------|---------------------------|----------------------------|
| **GroomingBookingRouter** | UniversalPaymentPage (after payment) | ✅ Yes |
| **UniversalBookingRouter** | In router: `handleConfirmBooking` → POST /bookings/create | ✅ Yes (when `allSelectedServices` or `selectedServices` has length > 0) |
| **VetBookingRouter** | In router: POST /bookings/create | ❌ No |
| **BookingFlow** | In flow: POST /bookings/create | ❌ No (single service) |
| **HomeServiceRouter** | In router: POST /bookings/create | ❌ No |

### 2.4 Relevant files

- **Contract:** `packages/api-contracts/src/bookings.ts` – `SelectedServiceSchema`, `CreateBookingRequestSchema.selectedServices`, `BookingSchema.selectedServices`.
- **Backend:** `backend/lambda/src/endpoints/bookings-enhanced.ts` – create handler reads `selectedServices`, stores `selected_services` JSONB.
- **DB:** `db/migrations/502_booking_services_and_pet_id.sql` – `bookings.selected_services`, `booking_services` table.
- **UI – multi-select:**  
  - `apps/customer-web/components/customer/vet/VetServicesByStyle.tsx` – vet multi-select, passes `selectedServices`.  
  - `apps/customer-web/components/customer/grooming/GroomingServicesByStyle.tsx` – grooming multi-select, passes `selectedServices`.  
  - `apps/customer-web/components/customer/shared/UniversalServicesByStyle.tsx` – generic by-style multi-select.
- **UI – booking:**  
  - `UniversalBookingRouter.tsx` – sends `selectedServices` in `bookingData` when `allSelectedServices` or `selectedServices` has length > 0; amount = sum of selected services.  
  - `GroomingBookingRouter.tsx` – uses UniversalPaymentPage; payment page sends `selectedServices` when creating booking.  
  - `payment/UniversalPaymentPage.tsx` – builds `bookingPayload` with `selectedServices` and POSTs to /bookings/create.

---

## 3. Implementation (vet/universal flow)

UniversalBookingRouter `handleConfirmBooking` now:

1. Builds `selectedServicesForApi` from `allSelectedServices` or `selectedServices` (shape: `{ id, serviceId, name, price, duration, quantity }`).
2. Adds `selectedServices: selectedServicesForApi` to the create-booking payload when length > 0.
3. Sets `amount` to the sum of selected services’ (price × quantity) when multiple services are present; otherwise uses single service price.
4. Keeps `serviceId` as the first/primary service (required by schema and FK).

No backend change was required; backend already accepts and stores `selectedServices`.
