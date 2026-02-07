# Payment Flow & Razorpay Integration

## Wireframe: Booking → Payment → Razorpay

1. **Create booking** – `POST /bookings/create`  
   - Frontend: `UniversalPaymentPage` builds payload (customerId, vendorId, serviceId, bookingDate, bookingTime, serviceType, amount, …).  
   - Backend: `bookings-enhanced.ts` validates with `CreateBookingRequestSchema`, inserts booking, returns `bookingId`.

2. **Create payment record** – `POST /payments/create`  
   - Frontend: Sends `{ bookingId, amount, paymentMethod: 'razorpay', customerId, vendorId }`.  
   - Backend: `payments-enhanced.ts` validates with `CreatePaymentRequestSchema`, loads booking, calculates tax/fees, inserts into `payments`, returns `paymentId` and status.

3. **Create Razorpay order** – `POST /razorpay/create-order`  
   - Frontend: Sends `{ bookingId, amount, customerId }`.  
   - Backend: Loads Razorpay keys (Secrets Manager → DB → env), calls Razorpay API, stores `razorpay_order_id` on payment, returns `orderId` for checkout.

4. **Checkout** – Frontend opens Razorpay checkout with `orderId`; on success calls `POST /payments/verify` with `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`.

## Common 500 on POST /payments/create

- **RDS / DB**: Lambda must reach RDS (same VPC or correct security groups). If Lambda is in a VPC without NAT/VPC endpoints, DB and Secrets Manager must be reachable (e.g. RDS in same VPC, Secrets Manager via VPC endpoint).
- **Missing customer_id**: Request or booking must provide `customer_id`; backend returns 400 with a clear message if both are missing.
- **Table/columns**: Ensure migrations have run (e.g. `payments`, `platform_settings`, `platform_fees:config`). Fee fetch is inside try/catch and falls back to defaults if it fails.
- **CORS**: API Gateway and Lambda responses (including 4xx/5xx) should include CORS headers; handler adds them so the browser can read the response body.

After the latest changes, a 500 response body includes `error.details.step` (`select_booking` or `payment_insert`) and `error.message` so the client (and logs) can see where it failed.

## Razorpay: AWS Secrets Manager

- **Secret name**: `warmpawz/{STAGE}/razorpay` (e.g. `warmpawz/dev/razorpay`).
- **Value (JSON)**:
  ```json
  {
    "keyId": "rzp_live_... or rzp_test_...",
    "keySecret": "...",
    "webhookSecret": "..."
  }
  ```
- **Lambda**: Needs IAM `secretsmanager:GetSecretValue` for this secret.  
- **VPC**: If Lambda is in a VPC, use a VPC endpoint for Secrets Manager or a NAT Gateway so the Lambda can call Secrets Manager.

Fallback order: Secrets Manager → `platform_integrations` (razorpay) → env vars `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.

## Notification URL typo

If you see requests to `/customer/notifications/9490444695?limit=10page` (missing `&` before `page`), fix the client that builds that URL so it uses `limit=10&page=...`.
