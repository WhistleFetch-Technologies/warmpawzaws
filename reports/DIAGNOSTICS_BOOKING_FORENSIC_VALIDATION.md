# Diagnostics Booking Flow – Forensic Validation Report

**Date:** 2026-01-30  
**Scope:** Lab test booking flow – UI, API contracts, payment-before-booking, wireframe stitching.

---

## 1. Flow Trace (UI → API → DB)

### 1.1 Entry Points

| Step | Component | Action | Next |
|------|-----------|--------|------|
| 1 | CustomerHomeWrapper | `currentScreen === 'lab-diagnostics'` | Renders DiagnosticsServicesLanding |
| 2 | DiagnosticsServicesLanding | User selects center / package | `onNavigate('lab-booking', { vendorId: center.id })` |
| 3 | CustomerHomeWrapper | `setSelectedVendorId(data?.vendorId)`, `setCurrentScreen('diagnostics-booking')` | Renders DiagnosticsBookingFlow |

**VendorId source:** `selectedVendorId || vetServiceData?.vendorId` so navigation from landing or alternate paths both work.

### 1.2 DiagnosticsBookingFlow – Form Step

| Element | Source | Validation |
|---------|--------|------------|
| Tests list | `GET /vendor/:vendorId/diagnostics/tests` | `response.success && response.tests` |
| Search/filter | Local state `searchQuery`, `categoryFilter` | Filters by test_name, test_code, category |
| Patient name/age | Local state | Required: patientName.trim() |
| Date/Time | `<input type="date">`, `<input type="time">` | Output: YYYY-MM-DD, HH:MM (contract-compliant) |
| Sample type | `preferredSampleType`: 'home' \| 'center' | Maps to serviceType: 'at_home' \| 'at_center' |
| Submit | `handleSubmit` | Does **not** call `/bookings/create`; builds payload, sets step to `'payment'` |

### 1.3 DiagnosticsBookingFlow – Payment Step

| Element | Source | Validation |
|---------|--------|------------|
| Order summary | `selectedTests`, `selectedDate`, `selectedTime`, `preferredSampleType`, `getTotalPrice()` | Rendered from state |
| Pay button | `handlePayNow` | Creates Razorpay order first, then on success creates booking |
| Razorpay order | `POST /razorpay/create-order` | Body: `{ type: 'diagnostics', amount, customerId, vendorId }` |
| After payment success | `POST /razorpay/verify-payment` then `POST /bookings/create` | Booking + slot created only after payment |

### 1.4 Backend – Create Booking

| Step | Handler | Behavior |
|------|---------|----------|
| POST /bookings/create | CreateBookingHandlerEnhanced | Validates with CreateBookingRequestSchema |
| serviceId 'diagnostics' | Same handler | Resolved to vendor_services row or created lab service + vendor_service |
| Slot allocation | withTransaction(client) | Lock slot, insert booking, rollback on error |
| Response | BaseHandlerEnhanced.success(data) | `{ success: true, data: { bookingId, status, message, isNew }, meta }` |

### 1.5 Backend – Razorpay Create Order (Diagnostics)

| Step | Handler | Behavior |
|------|---------|----------|
| POST /razorpay/create-order | CreateRazorpayOrderHandler | type === 'diagnostics' → requires amount, customerId, vendorId |
| No bookingId | N/A | Order created without booking; no row in payments (booking created later) |
| Response | BaseHandler.success | `{ orderId, amount, currency, keyId }` (unwrapped) |

---

## 2. API Contract Validation

### 2.1 CreateBookingRequestSchema (packages/api-contracts)

| Field | Required | DiagnosticsBookingFlow payload | Match |
|-------|----------|--------------------------------|-------|
| customerId | Yes (UUID) | From `/customer/by-phone` | ✅ |
| vendorId | Yes (UUID) | From navigation | ✅ |
| serviceId | Yes (UUID or 'diagnostics') | `'diagnostics'` | ✅ |
| bookingDate | Yes (YYYY-MM-DD) | selectedDate from `<input type="date">` | ✅ |
| bookingTime | Yes (HH:MM or HH:MM:SS) | selectedTime from `<input type="time">` | ✅ |
| serviceType | Yes (enum) | 'at_home' \| 'at_center' | ✅ |
| amount | Optional | totalAmountNum | ✅ |
| totalAmount | Optional | totalAmountNum | ✅ |
| notes | Optional | JSON string (tests, patient, etc.) | ✅ |
| address | Optional | Set when preferredSampleType === 'home' | ✅ |

**Extra keys in payload:** `bookingType: 'scheduled'` – not in schema; Zod strips unknown keys, so no contract violation.

### 2.2 Create Booking Response

- Backend returns (BaseHandlerEnhanced): `{ success: true, data: { bookingId, status, message, isNew }, meta }`.
- UI reads: `bookingResponse?.data?.bookingId ?? bookingResponse?.bookingId ?? bookingResponse?.booking?.id` and `bookingResponse?.success` – supports both wrapped and legacy shapes.

### 2.3 Razorpay Create Order – Diagnostics

- Request: `{ type: 'diagnostics', amount, customerId, vendorId }`.
- Backend validates: type === 'diagnostics' → amount, customerId, vendorId required; no bookingId.
- Response: `{ orderId, amount, currency, keyId }`. UI uses `orderRes?.orderId ?? orderRes?.data?.orderId` and `orderRes?.keyId ?? orderRes?.data?.keyId`.

---

## 3. UI Rendering Checklist

| State | Component / branch | Rendered |
|-------|--------------------|----------|
| Loading | DiagnosticsBookingFlow, loading === true | ServiceDashboardHeader + spinner + "Loading diagnostic tests..." |
| No tests / error load | loadTests catch | setError('Failed to load diagnostic tests') |
| Form | step === 'form' | Search, category filter, test list, summary, patient details, sample type, date/time, error box, Cancel + Book Tests |
| Empty test list | filteredTests.length === 0 | "No tests found" |
| Payment step | step === 'payment' | Header, "Payment", summary card, error box, Back + Pay ₹X |
| Processing | processing === true | Submit/Pay disabled, spinner or "Processing..." |
| Success | onSuccess(bookingId) | Handled by wrapper: handleViewBooking + setCurrentScreen('my-bookings') |

**Rendering verification:** All conditional branches (loading, step === 'payment', form, error, filteredTests.length, selectedTests.length, processing) are present in DiagnosticsBookingFlow.tsx and covered above.

---

## 4. Wireframe Stitching

| Wireframe item | Implementation |
|----------------|----------------|
| Lab discovery (list labs, distance/rating/relevance) | DiagnosticsServicesLanding: vendors-with-tests, filters, sort |
| Select package/report | Landing: center click → lab-booking with vendorId; DiagnosticsBookingFlow: test selection + packages (tests) |
| Search report name / filter | DiagnosticsBookingFlow: searchQuery, categoryFilter |
| Home collection vs at center | DiagnosticsBookingFlow: preferredSampleType, home collection fee in total |
| Make payment before booking | Payment step; Razorpay; create booking only after verify-payment |
| Notify vendor | Backend: insert notifications after booking create |
| Time slot only after payment | Slot allocated inside withTransaction in /bookings/create, called after payment success |

---

## 5. Gaps / Edge Cases

| Item | Status |
|------|--------|
| diagnostics-booking without vendorId | Handled: vendorId = selectedVendorId \|\| vetServiceData?.vendorId; if still missing, flow falls through (no redirect in render to avoid setState-in-render). |
| Date/time format | HTML inputs yield YYYY-MM-DD and HH:MM; schema accepts both HH:MM and HH:MM:SS. |
| Razorpay not loaded | handlePayNow throws "Payment gateway not loaded" and sets error. |
| Create booking after payment fails | Handler shows toast and sets processing false; payload remains in ref for retry if user goes back and pays again. |

---

## 6. Test Coverage (Added)

- **tests/e2e/diagnostics-booking-flow.test.ts** – Contract and flow tests:
  - CreateBookingRequestSchema accepts diagnostics payload (serviceId 'diagnostics', serviceType at_center/at_home).
  - Razorpay create-order diagnostics: required fields (type, amount, customerId, vendorId); no bookingId; missing vendorId → 400.
  - Create booking response shape: success + data.bookingId (or bookingId) and UUID.
  - GET /vendor/:vendorId/diagnostics/tests returns 200/404/403 (403 when auth required).
  - Run: `npx ts-node tests/e2e/diagnostics-booking-flow.test.ts`

---

## 7. Conclusion

- **Flow:** Landing → lab-booking (vendorId) → DiagnosticsBookingFlow (form → payment → Razorpay → verify → create booking) is traced and stitched.
- **Contracts:** Create booking and Razorpay diagnostics order request/response align with API contracts and UI parsing.
- **Rendering:** Loading, form, payment step, errors, and success path are covered.
- **Payment-before-booking:** Booking and slot creation happen only after successful payment; DB uses withTransaction for rollback on failure.
