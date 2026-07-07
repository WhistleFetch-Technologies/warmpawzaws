# 09 — Production Table Usage (Application Cross-Reference)

Cross-reference: production catalog + `backend/lambda/src` static scan + `db/migrations`.

## Summary

| Metric | Count |
|--------|-------|
| Production tables | 313 |
| Referenced in Lambda code | 212 |
| Classified Legacy (migration-only or no code) | 101 |
| Zero-row tables (exact COUNT, top-120 sample) | 0 |

## Top tables by application coupling

| Table | Prod rows (est/exact) | Code files | Migrations | Classification |
|-------|----------------------|------------|------------|----------------|
| `vendors` | 179 | 202 | 157 | Critical |
| `bookings` | 530 | 133 | 119 | Critical |
| `customers` | 240 | 125 | 98 | Critical |
| `roles` | 39 | 78 | 64 | Critical |
| `vendor_services` | 2340 | 75 | 18 | Active |
| `services` | 410 | 74 | 98 | Active |
| `staff` | 57344 | 60 | 64 | Active |
| `pets` | 172 | 53 | 45 | Active |
| `vendor_identity` | 244 | 48 | 11 | Active |
| `products` | 122880 | 46 | 38 | Active |
| `orders` | 40960 | 45 | 64 | Critical |
| `payments` | 486 | 43 | 34 | Critical |
| `platform_settings` | 15 | 42 | 8 | Active |
| `notifications` | 3116 | 41 | 19 | Active |
| `meal_orders` | 26 | 37 | 17 | Active |
| `reviews` | 131072 | 37 | 8 | Active |
| `service_catalog` | 373 | 34 | 15 | Active |
| `vendor_onboarding_applications` | 179 | 23 | 7 | Active |
| `vendor_tiers` | 98304 | 22 | 8 | Active |
| `role_permissions` | 806 | 21 | 20 | Active |
| `prescriptions` | 8 | 20 | 18 | Active |
| `meal_plans` | 4 | 19 | 17 | Active |
| `delivery_tracking` | 122880 | 19 | 11 | Active |
| `customer_wallets` | 40960 | 19 | 7 | Active |
| `order_items` | 24576 | 19 | 6 | Active |
| `vendor_availability_v2` | 970 | 17 | 10 | Active |
| `pharmacy_orders` | 12 | 16 | 9 | Active |
| `settlements` | 81920 | 16 | 23 | Active |
| `otp_tokens` | 2277 | 15 | 6 | Active |
| `package_purchases` | 15 | 15 | 11 | Active |
| `customer_addresses` | 199 | 15 | 6 | Active |
| `wallet_transactions` | 302 | 15 | 6 | Active |
| `medical_records` | 114688 | 15 | 14 | Active |
| `support_tickets` | 70 | 14 | 13 | Active |
| `admins` | 6 | 13 | 8 | Active |
| `service_categories` | 27 | 13 | 23 | Active |
| `vendor_bank_accounts` | 65536 | 13 | 1 | Active |
| `onboarding_forms` | 48 | 12 | 3 | Active |
| `meal_subscriptions` | 73728 | 12 | 4 | Active |
| `vendor_bank_details` | 122880 | 11 | 3 | Active |

## Migration-only tables with production rows > 0

- `vendor_admin_portal_codes` — 1133 rows, 1 migrations
- `customer_admin_portal_codes` — 309 rows, 2 migrations
- `pet_listings` — 90112 rows, 1 migrations
- `notification_templates_enhanced` — 73728 rows, 1 migrations
- `prescription_submissions` — 65536 rows, 1 migrations
- `meal_rider_reassign_requests` — 65536 rows, 1 migrations
- `medicine_orders` — 65536 rows, 2 migrations
- `dating_profiles_pet` — 65536 rows, 2 migrations
- `notification_logs` — 65536 rows, 2 migrations
- `deliveries` — 57344 rows, 10 migrations
- `user_subscriptions` — 57344 rows, 2 migrations
- `dating_matches` — 57344 rows, 2 migrations
- `booking_policies` — 57344 rows, 2 migrations
- `breeder_profiles` — 57344 rows, 1 migrations
- `nutrition_consultation_requests` — 57344 rows, 1 migrations
- `adoption_center_profiles` — 57344 rows, 1 migrations
- `pet_inquiries` — 57344 rows, 1 migrations
- `groomer_gallery` — 57344 rows, 1 migrations
- `mating_appointments` — 49152 rows, 2 migrations
- `ui_configs` — 49152 rows, 1 migrations
- `refund_tiers` — 49152 rows, 11 migrations
- `payout_rules` — 49152 rows, 1 migrations
- `rbac_policies` — 49152 rows, 1 migrations
- `banner_analytics` — 49152 rows, 2 migrations
- `service_style_mappings` — 49152 rows, 1 migrations
- `package_milestones` — 49152 rows, 1 migrations
- `audit_trail` — 49152 rows, 1 migrations
- `dating_meetups` — 49152 rows, 2 migrations
- `tele_sessions` — 49152 rows, 3 migrations
- `tele_queues` — 49152 rows, 3 migrations

## Code-active tables with zero production rows

_None_

## Background workers (jobs/)

| Job | Tables (from static scan) |
|-----|---------------------------|
| settlement-processor | settlements, vendors, bookings, tier_* |
| scheduled-notification-processor | scheduled_notifications, bookings, pharmacy_broadcasts |
| notification-processor | notifications, user_devices |
| analytics-retention | analytics_events, analytics_sessions |
| pharmacy-broadcast-expansion-processor | pharmacy_orders, pharmacy_broadcasts, vendors |
| vendor-shipment-tracking-processor | shipments |
| sms-processor | sms_logs |
| email-processor | email_logs |

## SQS queues (infra/modules/sqs)

booking_processing, payment_processing, notification_delivery, analytics_events, email_delivery, order_processing (+ DLQs)
