# Booking Flow and Payment Test

## Flow (end-to-end)

1. **Customer / Vendor / Service IDs**  
   - `customerId`: UUID from `customers` (e.g. via `GET /customer/by-phone?phone=...`).  
   - `vendorId`: UUID from `vendors`.  
   - `serviceId`: UUID from `services` or `vendor_services.service_id` for that vendor.

2. **POST /bookings/create**  
   - Body: `customerId`, `vendorId`, `serviceId` (UUID or `"diagnostics"`), `bookingDate`, `bookingTime`, `serviceType`, `amount`, etc.  
   - Returns `bookingId` (UUID).

3. **POST /payments/create**  
   - Body: `bookingId`, `amount` (≥ 0), optional `customerId`, `vendorId`, `paymentMethod`.  
   - Uses booking to get `customer_id` if not sent.  
   - Creates payment record; can use wallet (amount may be 0 for full wallet).

4. **POST /razorpay/create-order**  
   - Body: `bookingId`, `amount`, optional `currency`, `customerId`.  
   - Looks up booking, creates Razorpay order; returns `orderId`, `keyId`.

## Systematic test

```bash
# Parameter validation only (400/404 checks; no DB IDs needed)
DRY_RUN=1 npx tsx scripts/booking-flow-systematic-test.ts

# Full flow (needs real IDs or discovery)
TEST_PHONE=+919876543210 npx tsx scripts/booking-flow-systematic-test.ts

# With explicit UUIDs (from your DB)
TEST_CUSTOMER_ID=<uuid> TEST_VENDOR_ID=<uuid> TEST_SERVICE_ID=<uuid> \
  npx tsx scripts/booking-flow-systematic-test.ts
```

After **deploying the Lambda**, parameter validation should show:

- `POST /razorpay/create-order {}` → **400** (Missing required fields).
- `POST /razorpay/create-order` (fake `bookingId`) → **404**.
- `POST /payments/create` (fake `bookingId`) → **404**.
- `POST /bookings/create` (missing `customerId`) → **400**.

## Fixes applied (permanent)

- **api-contracts (payments)**: `amount` allows `≥ 0` (full wallet).
- **Razorpay create-order**: Missing `bookingId`/`amount` returns **400** (no longer 500).
- **UniversalPaymentPage**: Allows `amount === 0` for full wallet payment.
- **Test scripts**: Parameter validation + optional ID discovery; `test-booking-payment-apis.ts` includes Razorpay validation (empty body → 400).

## Making create-order pass end-to-end

1. Deploy Lambda so the Razorpay 400 fix is live.  
2. Use real UUIDs: set `TEST_CUSTOMER_ID`, `TEST_VENDOR_ID`, `TEST_SERVICE_ID`, or a `TEST_PHONE` that returns a customer and run without `DRY_RUN` so the script can discover vendor/service.  
3. Ensure Razorpay secrets are configured (`warmpawz/{STAGE}/razorpay`) so create-order can call Razorpay and return `orderId`/`keyId`.
