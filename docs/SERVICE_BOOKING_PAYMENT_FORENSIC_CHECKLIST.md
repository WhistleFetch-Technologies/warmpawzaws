# Service booking & payment forensic checklist

## Purpose

Confirm that all service booking flows and payment endpoints return correct status codes and response shapes, with no 500s from body parsing or response serialization.

## Backend fixes applied

1. **Booking create** (`bookings-enhanced.ts`)
   - Invalid/missing body → 400 (not 500).
   - Idempotency response body always string before storage.
   - All four routes (`/bookings/create`, `/booking/create`, `/customer/booking/create`, `/customer/bookings/create`) use safe parse: `typeof result.body === 'string' ? JSON.parse(result.body) : result.body` before `c.json()`.

2. **Razorpay** (`razorpay.ts`)
   - Create-order already used safe parse.
   - Verify-payment, webhook, marketplace/settlement, refund now use `safeParseResultBody()` so non-string `result.body` never causes 500.

3. **Base handler** (`base-handler-enhanced.ts`)
   - `parseBody()` returns `null` for missing/invalid JSON; handlers return 400 for invalid body.

## Flows and endpoints

| Flow (frontend) | Booking endpoint | Payment endpoints |
|-----------------|------------------|-------------------|
| UniversalPaymentPage, BookingFlow, EnhancedPaymentPage | `/bookings/create` | `/razorpay/create-order` → `/razorpay/verify-payment` |
| EmergencyBookingPage, VetBookingRouter, DiagnosticsBookingFlow, etc. | `/bookings/create` or `/booking/create` | Same |
| Package-aware | `/bookings/create-from-package` | Same payment |
| Customer booking | `/customer/bookings/create` or `/customer/booking/create` | Same |

## Validation script

Run:

```bash
API_BASE=https://your-api.example.com node scripts/forensic-service-booking-payment-validation.js
```

Or against local:

```bash
node scripts/forensic-service-booking-payment-validation.js
```

The script checks:

1. **Booking create** – Empty body → 400 (or 200), never 500.
2. **Booking create** – Valid-shaped body → 200 with `bookingId` or 4xx; never 500.
3. **Booking aliases** – Same contract for `/booking/create`, `/customer/bookings/create`.
4. **Razorpay create-order** – Response is valid JSON (no parse crash).
5. **Razorpay verify-payment** – Invalid/missing payload → 400 or 500 (500 if Razorpay not configured in that env); response is always valid JSON.
6. **Create-from-package** – Empty body → no 500.

## Confirmation

After running the script against dev and prod (or local):

- All steps pass (no 500 from booking or payment endpoints due to body/response parsing).
- Any 4xx from booking create are due to validation (missing IDs, etc.), not server error.
- Payment verification returns 400 for invalid signature when Razorpay is configured; may return 500 if Razorpay is not configured (Secrets Manager / env).

When the script passes in the target environment, service booking and payment response-handling issues in these flows are considered fixed.

## Broader API trace (curl-style)

For systematic testing of booking, payment, AI chatbot, and support flows in one run:

```bash
API_BASE=https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com node scripts/forensic-api-curl-trace.js
```

This script hits: booking create (and aliases), Razorpay create-order/verify-payment, AI chatbot (chat, symptoms-checker, booking-assist, escalate-to-agent), GET/POST support/tickets, GET crm/tickets, vendor support tickets. It exits 1 if any request returns 5xx. AI chatbot calls use an 18s timeout so fallback responses return 200 instead of 503.
