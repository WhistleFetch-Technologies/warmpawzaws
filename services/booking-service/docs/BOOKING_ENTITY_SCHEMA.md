# Booking entity vs production `bookings` table (B-9)

Sources: `db/schemas/booking/bookings.sql` (prod RDS extract), migrations **541**, **616**, **621**, **753**, `backend/lambda/src/endpoints/bookings-enhanced.ts` (core + optional INSERT columns).

## Lambda minimal INSERT (core, always attempted)

| Column | DB (prod+541) | `Booking.java` | Notes |
|--------|---------------|----------------|-------|
| `customer_id` | NOT NULL | `nullable=false` | OK |
| `vendor_id` | **nullable** | was `nullable=false` → **fixed** | FK allows NULL |
| `service_id` | NOT NULL | `nullable=false` | OK |
| `booking_date` | NOT NULL | `nullable=false` | OK |
| `booking_time` | NOT NULL | `nullable=false` | OK |
| `service_type` | NOT NULL | `nullable=false` | OK |
| `status` | NOT NULL | `nullable=false` | Includes `pending_payment` (migration 733) |
| `base_price` | NOT NULL | `nullable=false` | OK |
| `total_amount` | NOT NULL | `nullable=false` | OK |
| `address` | nullable | nullable | OK |
| `latitude` / `longitude` | nullable | nullable | OK |
| `notes` | nullable | nullable | OK |

Lambda adds optional columns in a second pass (retry drops missing columns): `payment_status`, `subscription_id`, `subscription_booking`, `pet_id`, `selected_services`, `duration_minutes`, `total_duration_minutes`, `customer_phone`, `tax_amount`, `discount_amount`, `room_id`, `package_purchase_id`, `is_package_session`, `estimated_arrival`, etc.

## Entity columns aligned with prod (541 + 753 + 621 + 616)

| Column | Migration | JPA |
|--------|-----------|-----|
| `customer_phone` | 541 / 300 | mapped |
| `pet_id` | 502 / 541 | mapped |
| `duration_minutes`, `total_duration_minutes` | 541 / 312 | mapped |
| `selected_services` | 502 / 541 | JSON, no `jsonb` columnDefinition (portable) |
| `subscription_id` | 541 / 101 | mapped |
| `room_id`, `package_purchase_id`, `is_package_session` | 541 | mapped |
| `estimated_arrival` | 541 / 753 | mapped |
| `address_line1`, `address_line2`, `service_style`, `flow_variant`, `reschedule_reason` | **753** | mapped |
| `otp_verified_at` | 616 / 753 | mapped |
| `vendor_timezone` | 006 / 753 | mapped, DB default `Asia/Kolkata` |
| `check_out_date`, `check_out_time` | 621 | mapped |
| `settled_at` | 011 / 016 / 753 | mapped |

## DB columns not mapped in JPA (intentional)

Omit from entity; Node/Lambda or other jobs may set them. Hibernate does not read/write these:

`loyalty_points_used`, `coupon_code`, `promotion_id`, `is_package`, `package_id`, `package_details`, `subscription_booking`, `package_session_number`, `cancelled_by`, `penalty_processed`, `booking_datetime`, `check_in_date`, OTP lifecycle (`otp_start_*`, `otp_end_*`), video-call columns, policy/signature fields, `rescheduled_at`, etc.

## Fixes applied in `Booking.java`

1. **`vendor_id`**, **`discount_amount`**, **`tax_amount`**: `nullable=true` to match DB (defaults applied in DB when omitted).
2. **Removed Java field defaults** on `status`, `payment_status`, `otp_verified`, `is_package_session` so unset fields are omitted on INSERT (Lambda behavior).
3. **`created_at` / `updated_at`**: `insertable=false`; timestamps from DB defaults + Hibernate `@CreationTimestamp` / `@UpdateTimestamp`.
4. **`selected_services`**: dropped `columnDefinition = "jsonb"` for H2/PostgreSQL portability.

## Deploy prerequisite

Environments without migration **753** must run it before booking-service ECS tasks query `address_line1`, `service_style`, etc. (otherwise `column … does not exist` on SELECT).

## Tests

- `src/test/resources/schema/bookings-prod-h2.sql` — H2 table mirroring prod-critical columns.
- `BookingEntityPersistenceTest` — `@DataJpaTest` persists Lambda-minimal row against that schema.
