# 15 — Production Risk Report

## Migration risk matrix (subset)

| Table | Rows | Size MB | Code files | Risk | Factors |
|-------|------|---------|------------|------|---------|
| `vendor_wallets` | 98304 | 0.02 | 2 | **Critical** | payment-sensitive |
| `payouts` | 98304 | 0.02 | 5 | **Critical** | payment-sensitive |
| `settlements` | 81920 | 0.01 | 16 | **Critical** | payment-sensitive |
| `refunds` | 49152 | 0.01 | 11 | **Critical** | payment-sensitive |
| `customer_wallets` | 40960 | 0.01 | 19 | **Critical** | payment-sensitive |
| `payments` | 486 | 0.11 | 43 | **Critical** | payment-sensitive |
| `wallet_transactions` | 302 | 0.07 | 15 | **Critical** | payment-sensitive |
| `booking_policies` | 57344 | 0.00 | 0 | **High** | booking-domain |
| `booking_cancellation_rules` | 57344 | 0.01 | 6 | **High** | booking-domain |
| `booking_rules` | 49152 | 0.01 | 1 | **High** | booking-domain |
| `booking_staff_assignments` | 40960 | 0.00 | 0 | **High** | booking-domain |
| `booking_status_history` | 32768 | 0.00 | 4 | **High** | booking-domain |
| `booking_state_transitions` | 32768 | 0.01 | 0 | **High** | booking-domain |
| `booking_status_transitions` | 32768 | 0.00 | 0 | **High** | booking-domain |
| `booking_limits` | 16384 | 0.00 | 0 | **High** | booking-domain |
| `bookings` | 530 | 0.36 | 133 | **High** | booking-domain |
| `customer_identity` | 269 | 0.11 | 2 | **High** | auth/identity |
| `vendor_identity` | 244 | 0.09 | 48 | **High** | auth/identity |
| `customers` | 240 | 0.10 | 125 | **High** | auth/identity |
| `device_tokens` | 215 | 0.08 | 5 | **High** | auth/identity |
| `vendors` | 179 | 0.26 | 202 | **High** | auth/identity |
| `admins` | 6 | 0.01 | 13 | **High** | auth/identity |
| `vendor_referrals` | 131072 | 0.01 | 6 | **Medium** | large volume |
| `reviews` | 131072 | 0.01 | 37 | **Medium** | large volume |
| `ai_chatbot_conversations` | 131072 | 0.05 | 2 | **Medium** | large volume |
| `regions` | 122880 | 0.02 | 4 | **Medium** | large volume |
| `action_sources` | 122880 | 0.02 | 2 | **Medium** | large volume |
| `vendor_daily_accrual` | 122880 | 0.02 | 1 | **Medium** | large volume |
| `products` | 122880 | 0.02 | 46 | **Medium** | large volume |
| `vendor_bank_details` | 122880 | 0.02 | 11 | **Medium** | large volume |
| `customer_profile_completion` | 122880 | 0.02 | 1 | **Medium** | large volume |
| `gps_location_history` | 122880 | 0.03 | 4 | **Medium** | large volume |
| `support_ticket_responses` | 122880 | 0.02 | 5 | **Medium** | large volume |
| `support_ticket_activity` | 122880 | 0.04 | 1 | **Medium** | large volume |
| `delivery_tracking` | 122880 | 0.01 | 19 | **Medium** | large volume |
| `medical_records` | 114688 | 0.01 | 15 | **Medium** | large volume |
| `pidge_hyperlocal_webhook_events` | 114688 | 0.02 | 1 | **Medium** | large volume |
| `banner_clicks` | 114688 | 0.04 | 2 | **Medium** | large volume |
| `product_error_cases` | 114688 | 0.02 | 1 | **Medium** | large volume |
| `customer_subscriptions` | 114688 | 0.00 | 9 | **Medium** | large volume |
| `chat_messages` | 114688 | 0.02 | 9 | **Medium** | large volume |
| `loyalty_segments` | 114688 | 0.01 | 3 | **Medium** | large volume |
| `analytics_events` | 100794 | 25.57 | 2 | **Medium** | large volume |
| `staff` | 57344 | 0.00 | 60 | **Medium** | high code coupling |
| `vendor_services` | 2340 | 0.55 | 75 | **Medium** | high code coupling |
| `services` | 410 | 0.22 | 74 | **Medium** | high code coupling |
| `pets` | 172 | 0.16 | 53 | **Medium** | high code coupling |
| `roles` | 39 | 0.06 | 78 | **Medium** | high code coupling |
| `vendor_tiers` | 98304 | 0.01 | 22 | **Low** | — |
| `diagnostic_tests` | 98304 | 0.01 | 5 | **Low** | — |

## Business-critical (Critical classification)

- `vendors` — core business entity
- `bookings` — core business entity
- `customers` — core business entity
- `payments` — core business entity
- `roles` — core business entity
- `orders` — core business entity

## Operational risks

1. **Handler runtime DDL** — schema mutations outside migration ledger
2. **Dual active duplicate tables** — coupon_usage + coupon_usages; vendor_holidays + vendor_holidays_enhanced
3. **High coupling mega-files** — admin-advanced.ts, admin-comprehensive.ts
4. **FK orphan drift** — vendor_services.service_id vs services (per prior RCA)
5. **Staff decommission** — routes disabled but tables still referenced
