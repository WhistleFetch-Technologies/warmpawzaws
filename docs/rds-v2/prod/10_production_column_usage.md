# 10 — Production Column Usage

## Methodology

- **Catalog:** `information_schema.columns` + `pg_stats.null_frac` (production, read-only)
- **Application:** heuristic column extraction from Lambda `select/insert/update` and raw SQL (see `scripts/rds-v2-column-scan.js`)
- **Dead columns:** columns with high `null_frac` in prod AND no application reference require manual review — not auto-classified as deprecated

## High-null columns in core tables (null_frac > 0.9, sampled)

- `bookings.address_line1` — null_frac 1.000
- `bookings.address_line2` — null_frac 1.000
- `bookings.cancelled_by` — null_frac 0.961
- `bookings.city` — null_frac 1.000
- `bookings.converted_to_package_id` — null_frac 1.000
- `bookings.coupon_code` — null_frac 1.000
- `bookings.delivery_address` — null_frac 1.000
- `bookings.earnings_amount` — null_frac 1.000
- `bookings.estimated_arrival` — null_frac 1.000
- `bookings.estimated_arrival_time` — null_frac 0.979
- `bookings.flow_variant` — null_frac 0.996
- `bookings.otp_end_code` — null_frac 1.000
- `bookings.otp_start_code` — null_frac 1.000
- `bookings.otp_verified_at` — null_frac 1.000
- `bookings.payment_id` — null_frac 0.971
- `bookings.pincode` — null_frac 1.000
- `bookings.promotion_id` — null_frac 1.000
- `bookings.reschedule_reason` — null_frac 1.000
- `bookings.rescheduled_at` — null_frac 0.952
- `bookings.rescheduled_from_booking_id` — null_frac 1.000
- `bookings.room_id` — null_frac 1.000
- `bookings.service_style` — null_frac 1.000
- `bookings.settlement_id` — null_frac 1.000
- `bookings.staff_id` — null_frac 1.000
- `bookings.started_at` — null_frac 0.994
- `bookings.state` — null_frac 1.000
- `bookings.subscription_id` — null_frac 1.000
- `bookings.tele_completion_status` — null_frac 1.000
- `bookings.vendor_arrived_at` — null_frac 0.983
- `bookings.vendor_departed_at` — null_frac 1.000
- `bookings.vendor_started_at` — null_frac 1.000
- `bookings.video_call_duration` — null_frac 0.921
- `bookings.video_call_ended_at` — null_frac 0.921
- `bookings.video_call_status` — null_frac 1.000
- `customers.date_of_birth` — null_frac 1.000
- `customers.flatNo` — null_frac 1.000
- `customers.gender` — null_frac 1.000
- `customers.houseNo` — null_frac 1.000
- `customers.last_password_reset_at` — null_frac 0.979
- `customers.name` — null_frac 0.987

## Column inventory

Full export: `06_production_column_inventory.csv` (4340 rows)

## Per-table notes (top 30 by code coupling)

### `vendors`
- Classification: **Critical**
- Prod rows: 179
- Columns in catalog: 74

### `bookings`
- Classification: **Critical**
- Prod rows: 530
- Columns in catalog: 92

### `customers`
- Classification: **Critical**
- Prod rows: 240
- Columns in catalog: 37

### `roles`
- Classification: **Critical**
- Prod rows: 39
- Columns in catalog: 10

### `vendor_services`
- Classification: **Active**
- Prod rows: 2340
- Columns in catalog: 32

### `services`
- Classification: **Active**
- Prod rows: 410
- Columns in catalog: 11

### `staff`
- Classification: **Active**
- Prod rows: 57344
- Columns in catalog: 17

### `pets`
- Classification: **Active**
- Prod rows: 172
- Columns in catalog: 15

### `vendor_identity`
- Classification: **Active**
- Prod rows: 244
- Columns in catalog: 18

### `products`
- Classification: **Active**
- Prod rows: 122880
- Columns in catalog: 31

### `orders`
- Classification: **Critical**
- Prod rows: 40960
- Columns in catalog: 32

### `payments`
- Classification: **Critical**
- Prod rows: 486
- Columns in catalog: 39

### `platform_settings`
- Classification: **Active**
- Prod rows: 15
- Columns in catalog: 8

### `notifications`
- Classification: **Active**
- Prod rows: 3116
- Columns in catalog: 21

### `meal_orders`
- Classification: **Active**
- Prod rows: 26
- Columns in catalog: 53

### `reviews`
- Classification: **Active**
- Prod rows: 131072
- Columns in catalog: 15

### `service_catalog`
- Classification: **Active**
- Prod rows: 373
- Columns in catalog: 22

### `vendor_onboarding_applications`
- Classification: **Active**
- Prod rows: 179
- Columns in catalog: 20

### `vendor_tiers`
- Classification: **Active**
- Prod rows: 98304
- Columns in catalog: 26

### `role_permissions`
- Classification: **Active**
- Prod rows: 806
- Columns in catalog: 6

### `prescriptions`
- Classification: **Active**
- Prod rows: 8
- Columns in catalog: 32

### `meal_plans`
- Classification: **Active**
- Prod rows: 4
- Columns in catalog: 52

### `delivery_tracking`
- Classification: **Active**
- Prod rows: 122880
- Columns in catalog: 31

### `customer_wallets`
- Classification: **Active**
- Prod rows: 40960
- Columns in catalog: 8

### `order_items`
- Classification: **Active**
- Prod rows: 24576
- Columns in catalog: 10

### `vendor_availability_v2`
- Classification: **Active**
- Prod rows: 970
- Columns in catalog: 23

### `pharmacy_orders`
- Classification: **Active**
- Prod rows: 12
- Columns in catalog: 55

### `settlements`
- Classification: **Active**
- Prod rows: 81920
- Columns in catalog: 22

### `otp_tokens`
- Classification: **Active**
- Prod rows: 2277
- Columns in catalog: 9

### `package_purchases`
- Classification: **Active**
- Prod rows: 15
- Columns in catalog: 36

