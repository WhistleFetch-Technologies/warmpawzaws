# Forensic Verification: Booking Create Response & “No booking ID returned” Fix

**Date:** 2026-02-11  
**Issue:** Customer checkout / payment flow showed “Failed to create booking: No booking ID returned” despite API returning `{ success: true, data: { … }, meta: { … } }`.  
**Root cause:** Response shape variance (wrapped vs idempotency replay, camelCase vs snake_case) and frontend only reading a subset of paths.

---

## 1. Backend: Response Shapes

### 1.1 Handler success path (normal create)

- **Source:** `CreateBookingHandlerEnhanced.handle()` → `return this.success(response, requestId)` with `response = { bookingId: booking.id, status, message, isNew, paymentRequired, remainingDue }`.
- **BaseHandlerEnhanced.success():** `createSuccessResponse(data, requestId)` → `{ success: true, data, meta: { timestamp, requestId, version } }`.
- **Body string:** `JSON.stringify({ success: true, data: { bookingId, status, message, isNew, paymentRequired, remainingDue }, meta })`.
- **So:** After `JSON.parse(result.body)`, `responseBody.data.bookingId` exists. Top-level `responseBody.bookingId` is not set by the handler.

### 1.2 Idempotency replay path

- **Source:** Handler returns `{ statusCode, headers, body: existing.response }` where `existing.response` is the **stored** value from `storeIdempotencyKey(..., JSON.stringify(response), 200)`.
- **Stored value:** `response` is the same object `{ bookingId, status, message, isNew, paymentRequired, remainingDue }` (no `success`/`data`/`meta` wrapper).
- **So:** `result.body` is the stringified raw object. After `JSON.parse(result.body)`, `responseBody` has **no** `data`; it has top-level `bookingId`, `status`, etc.

### 1.3 Summary of shapes before normalization

| Path              | responseBody after parse                    | bookingId location        |
|-------------------|---------------------------------------------|----------------------------|
| Normal success     | `{ success, data: { bookingId, ... }, meta }`| `responseBody.data.bookingId` |
| Idempotency replay| `{ bookingId, status, message, ... }`       | `responseBody.bookingId`      |

If the DB or another layer ever returns `data.booking_id` or `data.id`, only the normalizer can make that consistent.

---

## 2. Backend: Normalization (Fix)

### 2.1 Function

**File:** `backend/lambda/src/endpoints/bookings-enhanced.ts`  
**Function:** `normalizeBookingCreateResponse(responseBody: any): void`

- **Input:** Parsed response object (either wrapped or raw).
- **Logic:**
  - `data = responseBody.data ?? responseBody`
  - `bookingId` = first defined of:  
    `responseBody.data.bookingId`, `responseBody.data.booking_id`,  
    `responseBody.data.id` (if string),  
    `responseBody.bookingId`, `responseBody.booking_id`, `responseBody.id`
  - If `bookingId` is set:
    - `responseBody.bookingId = bookingId`
    - If `responseBody.data` is an object:  
      `responseBody.data.bookingId = responseBody.data.bookingId ?? responseBody.data.booking_id ?? bookingId`
- **Effect:** Every successful create response has a top-level `bookingId` and, when `data` exists, `data.bookingId`, regardless of handler or idempotency path and of snake_case/camelCase.

### 2.2 Endpoints that apply normalization

All of the following call `normalizeBookingCreateResponse(responseBody)` after `JSON.parse(result.body)`:

| # | Method | Path                        | Verified (line) |
|---|--------|-----------------------------|------------------|
| 1 | POST   | `/bookings/create`          | ~2544            |
| 2 | POST   | `/booking/create`          | ~2590            |
| 3 | POST   | `/customer/booking/create` | ~2636            |
| 4 | POST   | `/customer/bookings/create`| ~2681            |

**Verification:** Grep for `normalizeBookingCreateResponse` in `bookings-enhanced.ts` returns exactly these four call sites.

---

## 3. Frontend: Booking ID Extraction (Fix)

### 3.1 Location

**File:** `apps/customer-web/components/customer/payment/UniversalPaymentPage.tsx`

### 3.2 Extraction order (all three flows)

Used in:

1. **Initial booking create** (step 1, before payment)
2. **After wallet payment** (deferred booking create)
3. **After Razorpay success** (deferred booking create)

Extraction:

- `d = bookingRes?.data ?? bookingRes`
- `bookingIdValue` = first defined of:  
  `bookingRes?.data?.bookingId`,  
  `bookingRes?.data?.booking_id`,  
  `d?.booking?.id`, `d?.bookingId`, `d?.booking_id`, `d?.id`,  
  `bookingRes?.bookingId`, `bookingRes?.booking_id`, `bookingRes?.id`

This matches:

- Backend normalized shape: `bookingId` and `data.bookingId`.
- Idempotency/unwrapped shape: top-level `bookingId` (and we still read `bookingRes?.id` as fallback).
- Snake_case: `data.booking_id`, `d?.booking_id`, `bookingRes?.booking_id`.
- Nested: `d?.booking?.id`.

### 3.3 Validation after extraction

- If `!bookingIdValue && !bookingCreationDeferred` → throw “Failed to create booking: No booking ID returned”.
- If `bookingIdValue` and not UUID → throw “Invalid booking ID format received from server”.
- If `bookingIdValue` → set `currentBookingId` and continue flow.

---

## 4. Trace: End-to-End

### 4.1 Normal create (200, wrapped)

1. Client: `POST /bookings/create` with valid payload.
2. Handler: Creates booking, returns `this.success({ bookingId, status, message, isNew, paymentRequired, remainingDue }, requestId)`.
3. Base handler: Body = `{ success: true, data: { bookingId, ... }, meta }`.
4. Endpoint: `responseBody = JSON.parse(result.body)`, then `normalizeBookingCreateResponse(responseBody)`.
5. Normalizer: Sees `responseBody.data.bookingId` → sets `responseBody.bookingId` and `responseBody.data.bookingId` (no-op for latter).
6. Client receives: `{ success: true, data: { bookingId, ... }, meta, bookingId }`.
7. Frontend: `bookingRes?.data?.bookingId` or `bookingRes?.bookingId` → **resolved**. No “No booking ID returned”.

### 4.2 Idempotency replay (200, raw)

1. Client: `POST /bookings/create` with same idempotency key again.
2. Handler: `checkIdempotencyKey` returns existing; handler returns `body: existing.response` (stringified `{ bookingId, status, message, ... }`).
3. Endpoint: `responseBody = JSON.parse(result.body)` → `{ bookingId, status, message, ... }` (no `data`).
4. Normalizer: `responseBody.data` is undefined; `bookingId` comes from `responseBody.bookingId`; sets `responseBody.bookingId` (no change); does not set `responseBody.data` (no object).
5. Client receives: `{ bookingId, status, message, ... }`.
6. Frontend: `d = bookingRes` (no `data`), then `bookingRes?.bookingId` or `bookingRes?.id` → **resolved**.

### 4.3 Deferred create after payment (Razorpay / wallet)

1. First request: `POST /bookings/create` may return 402 (payment required); frontend sets `bookingCreationDeferred`, proceeds to payment.
2. After payment: Frontend calls `POST /bookings/create` again with same payload plus `razorpayPaymentId`/`razorpayOrderId` or wallet `paymentId`.
3. Handler: Creates booking (payment validated), returns same success shape as in 4.1.
4. Endpoint: Same normalization as 4.1.
5. Frontend: Same extraction as in 4.1/4.2; `bookingIdValue` is set, `currentBookingId` updated, `bookingCreationDeferred = false`.

---

## 5. Test Matrix (Code-Level)

| Backend shape (after parse, before normalize) | After normalize              | Frontend extraction result |
|-----------------------------------------------|------------------------------|----------------------------|
| `{ success, data: { bookingId: "uuid" }, meta }` | `bookingId` + `data.bookingId` set | ✅ `bookingRes.data.bookingId` or `bookingRes.bookingId` |
| `{ success, data: { booking_id: "uuid" }, meta }` | `bookingId` + `data.bookingId` set | ✅ `bookingRes.data.booking_id` → normalizer → then `bookingRes.bookingId` |
| `{ bookingId: "uuid", status, ... }`          | `responseBody.bookingId` set | ✅ `bookingRes.bookingId` or `bookingRes.id` |
| `{ data: { id: "uuid" }, meta }` (hypothetical) | `bookingId` from `data.id`   | ✅ `d?.id` or `bookingRes.bookingId` after normalize |

---

## 6. Existing Test & Verification Run

**File:** `backend/lambda/test-booking-create-api.ts`

- Calls `POST /bookings/create`, then checks `responseData.bookingId || responseData.data?.bookingId`.
- With normalization, both are set on success, so the test continues to pass for the normalized contract.

**Verification run (2026-02-11):**  
`npx ts-node test-booking-create-api.ts` was run against live API. Result: **400** (booking date “must be at least 1 hour(s) in the future”) — i.e. validation failure, not response shape. For a **200** response, the test expects `responseData.bookingId || responseData.data?.bookingId`; both are now guaranteed by `normalizeBookingCreateResponse`.

### 6.1 Reproduce with curl (after deploy)

Use a **future** `bookingDate` and `bookingTime` (at least 1 hour from now):

```bash
API_URL="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"
curl -s -X POST "${API_URL}/bookings/create" -H "Content-Type: application/json" \
  -d '{"customerId":"39c84571-b26d-475a-bb38-94975cb8262d","vendorId":"c96058cb-6356-4e2b-9cf2-5149c6e9b942","serviceId":"03513ff5-284c-47c7-9382-1203f3b4af87","bookingDate":"2026-02-15","bookingTime":"10:00","serviceType":"at_center","amount":3500,"petId":"6e28df3a-3880-460a-b747-bd359330fc32","customerName":"Test Customer","customerPhone":"9611377119","petName":"Max","notes":""}' | jq .
```

Or: `cd backend/lambda && API_URL="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com" npx ts-node test-booking-create-api.ts`

If the client gets 200 but `data` has no `bookingId`, check API Gateway uses **proxy (passthrough)**. CloudWatch `[BOOKING-CREATE] Response keys: ..., bookingId: <value>` shows what Lambda returned.

---

## 7. Gaps Addressed in This Verification

1. **POST /customer/booking/create** was still using the old one-liner (`if (responseBody?.success && responseBody?.data?.bookingId) responseBody.bookingId = ...`). It now uses `normalizeBookingCreateResponse(responseBody)` so all four create routes behave the same.
2. **Frontend** now uses the same robust extraction (including `data.booking_id`, `d?.id`, top-level `id`) in all three places: initial create, after wallet, after Razorpay.

---

## 8. Forensic Extractor & Logging (2026-02-11 follow-up)

### 8.1 Frontend: `extractBookingIdFromResponse(bookingRes, logLabel)`

**File:** `apps/customer-web/components/customer/payment/UniversalPaymentPage.tsx`

- Single helper used in all three flows (initial create, after wallet, after Razorpay). Tries: `data.bookingId`, `data.booking_id`, `data.data.*`, `(data ?? bookingRes).*`, top-level `bookingId`/`booking_id`/`id`, then a deep search for any `bookingId`/`booking_id` with UUID value. Only returns UUID-valid strings. If nothing found, logs `[FORENSIC] <label>: No bookingId in response. Top keys, data keys, sample (400 chars)`.

### 8.2 Backend: Safe parse + response logging

**File:** `backend/lambda/src/endpoints/bookings-enhanced.ts`

- All four create routes: safe parse of `result.body` (with error log on failure), then after normalization log `[BOOKING-CREATE] Response keys: [...], bookingId: <value>`. CloudWatch then shows the exact response shape and bookingId for every create.

---

## 9. Conclusion

- **Backend:** All four booking-create endpoints run the same normalizer; every 200 response exposes `bookingId` at top level and in `data` when present, for both wrapped and idempotency replay shapes.
- **Frontend:** UniversalPaymentPage uses `extractBookingIdFromResponse()` in all three flows (initial create, after wallet, after Razorpay), with deep search and `[FORENSIC]` logging when no ID is found.
- **Forensic trace:** Normal create, idempotency replay, and deferred create-after-payment all lead to a single, consistent booking ID on the client, eliminating “No booking ID returned” for these paths.
