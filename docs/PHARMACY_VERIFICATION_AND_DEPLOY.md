# Pharmacy Flow: Verification, Migrations, Deploy & Forensic Test

## 1. DB migrations (run together)

Run in order:

```bash
# From repo root; set DATABASE_URL or RDS connection
node scripts/run-pharmacy-migrations.js
# Dry run first:
node scripts/run-pharmacy-migrations.js --dry-run
```

Or run SQL files manually in this order:

1. `db/migrations/508_pharmacy_orders_status_invoice_generated.sql` – allow statuses `invoice_generated`, `payment_confirmed`, `dispatched`.
2. `db/migrations/509_pharmacy_payments_and_convenience.sql` – add `payments.pharmacy_order_id`, `pharmacy_orders.convenience_fee`.

## 2. Verification checklist (implementation)

| Area | Check |
|------|--------|
| **Backend** | `POST /pharmacy/orders/:orderId/accept` (body: `pharmacyId`) resolves broadcast and assigns order. |
| **Backend** | `POST /pharmacy/orders/:orderId/invoice` accepts `invoiceItems` or `items` with `unit_price`/`price`, sets `status = invoice_generated`, includes `convenience_fee` in total. |
| **Backend** | `GET /pharmacy/orders/incoming/:vendorId` returns `order_number`, `expiresIn`, `broadcast_id`, `convenience_fee`. |
| **Backend** | `POST /razorpay/create-order` with `type: 'pharmacy_order'`, `orderId`, `amount`, `customerId` creates Razorpay order and inserts `payments` with `pharmacy_order_id`. |
| **Backend** | `POST /razorpay/verify-payment` when payment has `pharmacy_order_id`: updates `pharmacy_orders` to `payment_confirmed`, creates `delivery_tracking` with `delivery_otp`. |
| **Backend** | `GET /delivery/:orderId/status` for pharmacy joins `delivery_tracking` and returns `delivery_otp`, partner name/phone. |
| **Backend** | `POST /delivery/:orderId/verify-otp` for pharmacy reads OTP from `delivery_tracking`, updates tracking and `pharmacy_orders.status = delivered`. |
| **Backend** | `GET /customer/orders/:orderId/pharmacy-status` returns `deliveryFee`, `platformFee`, `convenienceFee`, `subtotal`, `totalAmount`, `medicines`. |
| **Vendor UI** | Pharmacy dashboard shows only Orders + Profile; Orders → `/pharmacy/orders`; Incoming → Accept → Invoice modal → Send Invoice. |
| **Customer UI** | After accepted, poll pharmacy-status until `invoice_generated`; show invoice; Pay → Razorpay → verify → tracking; OTP verification. |

## 3. Deploy steps

1. **DB**: Run pharmacy migrations (see §1).
2. **Backend**: Build and deploy Lambda (e.g. `npm run build` in `backend/lambda`, then deploy via Serverless/CI).
3. **Vendor app**: Build and deploy (e.g. `cd apps/vendor-web && npm run build && deploy`).
4. **Customer app**: Build and deploy (e.g. `cd apps/customer-web && npm run build && deploy`).
5. **Env**: Ensure `NEXT_PUBLIC_RAZORPAY_KEY` (customer/vendor), Razorpay keys in backend (SSM/env), and API base URL for frontends.

## 4. Forensic systematic test (flow)

Run after deploy. High-level flow to validate end-to-end:

1. **Customer**: Service dashboard → Pharmacy → Order medicine → prescription + address → create order (broadcast).
2. **Backend**: Order created, status `broadcasting`; broadcast to pharmacies in radius.
3. **Vendor**: Pharmacy Orders → Incoming → see order → Accept → Invoice modal → set prices → Send Invoice.
4. **Backend**: Order status `invoice_generated`; customer gets invoice in pharmacy-status.
5. **Customer**: Sees invoice (poll) → Approve & Pay → Razorpay → verify-payment.
6. **Backend**: Order `payment_confirmed`; `delivery_tracking` created with OTP.
7. **Vendor**: Order in Active → Dispatch (own fleet or partner) → OTP available for delivery.
8. **Customer**: Tracking step → GET delivery status → sees OTP when dispatched.
9. **Delivery**: Partner/Vendor marks delivered; customer enters OTP → verify-otp.
10. **Backend**: `pharmacy_orders.status = delivered`, `delivery_tracking.otp_verified = true`.

Automated tests: see `tests/forensic/pharmacy-flow.spec.ts` (or equivalent) for contract and flow checks.
