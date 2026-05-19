# Booking Service — API Contract

## Overview

**Service**: `booking-service`
**Port**: `8083`
**Base image**: `eclipse-temurin:21-jre-alpine`
**Spring profile (production)**: `aws`

---

## Phase 1 Endpoints

### Booking Management (`/bookings`, `/booking`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/bookings/create` | Create a new booking (idempotent) |
| `POST` | `/booking/create` | Alias for `/bookings/create` |
| `GET` | `/bookings/{bookingId}` | Get booking by ID |
| `GET` | `/bookings/{bookingId}/history` | Get status change history |
| `PUT` | `/bookings/{bookingId}/status` | Update booking status |
| `POST` | `/bookings/{bookingId}/cancel` | Cancel a booking |
| `POST` | `/bookings/{bookingId}/reschedule` | Reschedule a booking |

### Customer Booking Routes

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/customer/booking/create` | Create booking (customer alias, idempotent) |
| `POST` | `/customer/bookings/create` | Create booking (customer alias, idempotent) |
| `GET` | `/customer/bookings/{bookingId}` | Get booking for authenticated customer |
| `GET` | `/customer/{customerId}/bookings` | List customer bookings (paginated) |
| `GET` | `/customer/{customerId}/bookings/{bookingId}` | Get specific booking for customer |
| `GET` | `/customer/{customerId}/bookings/follow-up-eligible` | Bookings eligible for follow-up |

### Utility

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/actuator/health` | Health probe (ECS/Fargate liveness/readiness) |
| `GET` | `/v3/api-docs/**` | OpenAPI spec |
| `GET` | `/swagger-ui/**` | Swagger UI |

---

## Status Machine

All allowed status transitions:

```
pending          → confirmed, cancelled, pending_payment
pending_payment  → confirmed, cancelled
confirmed        → in_progress, cancelled, rescheduled, no_show, vendor_on_way
in_progress      → completed, cancelled, arrived
vendor_on_way    → arrived, in_progress, cancelled
arrived          → in_progress, completed, cancelled
scheduled        → confirmed, cancelled

Terminal states (no further transitions):
  completed, cancelled, no_show, rescheduled, partially_completed
```

### Initial Status on Create

| Condition | Initial Status |
|-----------|---------------|
| `totalAmount` is null or ≤ 0, OR `packagePurchaseId` is set | `confirmed` |
| Otherwise | `pending_payment` |

---

## Idempotency

Idempotency follows the same pattern as `customer-service`:

- **Header**: `Idempotency-Key: <uuid-or-client-generated-key>`
- **Applies to**: `POST /bookings/create` and all `/customer/*/create` aliases
- **TTL**: configurable via `APP_IDEMPOTENCY_TTL_SECONDS` (default 300 s)
- **Provider**: `db` (default) | `redis` | `memory` — set via `APP_IDEMPOTENCY_PROVIDER`
- **Behavior**: Same key + same payload → replay cached 200 response. Same key + different payload → `409 Conflict`.
- **Duplicate guard**: Separate from idempotency — a 5-minute window check prevents duplicate bookings for the same customer/vendor/date/time slot even without an `Idempotency-Key`.

---

## Security

- **Production**: Cognito JWT RS256 — configure `COGNITO_ISSUER_URI` and `COGNITO_AUDIENCE`.
- **UAT/Dev**: Set `APP_SECURITY_UAT_JWT_ENABLED=true` and `UAT_JWT_SECRET` to accept `warmpawz-uat` issuer tokens (HMAC HS256).
- **Disable** (local testing): `APP_SECURITY_ENABLED=false` — all endpoints open.
- CORS allows: `http://localhost:*`, `https://*.warmpawz.com`, `https://*.cloudfront.net`.

---

## Pagination

Query parameters for list endpoints:

| Param | Default | Description |
|-------|---------|-------------|
| `page` | `0` | Zero-based page number |
| `size` | `10` | Items per page |
| `sort` | `createdAt,desc` | Sort field and direction |
| `status` | _(none)_ | Optional status filter |

---

## Conflict Detection

Before creating a booking, the service:
1. Checks for an exact duplicate (same customer/vendor/date/time, created within last 5 minutes) — returns existing booking if found.
2. Checks for slot overlap with pessimistic locking (`SELECT ... FOR UPDATE`) against all non-cancelled bookings for the same vendor/staff on the same date.

---

## Pending — Phase 2+

The following features are scaffolded but not yet implemented:

- **Payments**: Razorpay order creation, payment capture, `payment_id` linkage
- **OTP verification**: `otp_code`, `otp_expires_at`, `otp_verified`, `otp_verified_at`
- **GPS / arrival tracking**: `estimated_arrival` JSONB, `vendor_on_way` / `arrived` status webhooks
- **Package sessions**: `package_purchase_id`, `is_package_session` flag
- **Subscriptions**: `subscription_id` linkage
- **Vendor endpoints**: `/vendor/bookings/**`, `/vendor/{vendorId}/bookings/**`
- **SNS / event publishing**: Booking lifecycle events (created, confirmed, completed, cancelled)
- **Admin endpoints**: Cross-vendor booking search and override
- **Checkout flow**: `check_out_date`, `check_out_time` for boarding/daycare services
