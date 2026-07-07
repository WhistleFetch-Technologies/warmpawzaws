# 02 — Production Schema Summary

## Scale

- **313** base tables, **4340** columns, **420** foreign keys
- **1279** indexes across public schema
- **73** functions, **39** triggers

## Largest tables by on-disk size

| Table | Est. rows | Total MB | Table MB | Index MB |
|-------|-----------|----------|----------|----------|
| `analytics_events` | 61972480 | 25.6 | 33.5 | 0.0 |
| `audit_logs` | 9363456 | 7.7 | 1.1 | 0.1 |
| `notifications` | 1523712 | 1.2 | 0.2 | 0.0 |
| `analytics_sessions` | 2727936 | 1.1 | 1.3 | 0.2 |
| `notification_delivery_log` | 1245184 | 0.7 | 0.5 | 0.0 |
| `processed_events` | 1105920 | 0.6 | 0.4 | 0.0 |
| `search_index` | 819200 | 0.6 | 0.2 | 0.1 |
| `vendor_services` | 1810432 | 0.6 | 1.1 | 0.0 |
| `vendor_earnings` | 696320 | 0.5 | 0.1 | 0.0 |
| `bookings` | 1040384 | 0.4 | 0.6 | 0.1 |
| `vendor_admin_portal_codes` | 704512 | 0.3 | 0.3 | 0.0 |
| `vendor_availability_v2` | 770048 | 0.3 | 0.4 | 0.0 |
| `otp_tokens` | 786432 | 0.3 | 0.4 | 0.0 |
| `vendors` | 1179648 | 0.3 | 0.7 | 0.1 |
| `services` | 335872 | 0.2 | 0.1 | 0.0 |
| `service_catalog` | 548864 | 0.2 | 0.3 | 0.0 |
| `pets` | 385024 | 0.2 | 0.0 | 0.2 |
| `vendor_onboarding_applications` | 1122304 | 0.2 | 0.1 | 0.8 |
| `onboarding_forms` | 425984 | 0.1 | 0.1 | 0.2 |
| `loyalty_transactions` | 237568 | 0.1 | 0.1 | 0.0 |
| `notification_campaign_deliveries` | 344064 | 0.1 | 0.2 | 0.0 |
| `payments` | 311296 | 0.1 | 0.1 | 0.0 |
| `vendor_onboarding_transitions` | 311296 | 0.1 | 0.1 | 0.0 |
| `customer_identity` | 237568 | 0.1 | 0.1 | 0.0 |
| `customers` | 425984 | 0.1 | 0.2 | 0.1 |

## Most populated tables (planner estimate)

| Table | Est. rows | Exact COUNT (if sampled) |
|-------|-----------|--------------------------|
| `analytics_events` | 61972480 | 100794 |
| `audit_logs` | 9363456 | 5037 |
| `analytics_sessions` | 2727936 | 3311 |
| `vendor_services` | 1810432 | 2340 |
| `notifications` | 1523712 | 3116 |
| `notification_delivery_log` | 1245184 | 2112 |
| `vendors` | 1179648 | 179 |
| `vendor_onboarding_applications` | 1122304 | 179 |
| `processed_events` | 1105920 | 2515 |
| `bookings` | 1040384 | 530 |
| `search_index` | 819200 | 1365 |
| `otp_tokens` | 786432 | 2277 |
| `vendor_availability_v2` | 770048 | 970 |
| `vendor_admin_portal_codes` | 704512 | 1133 |
| `vendor_earnings` | 696320 | 205 |
| `service_catalog` | 548864 | 373 |
| `role_permissions` | 442368 | 806 |
| `onboarding_forms` | 425984 | 48 |
| `customers` | 425984 | 240 |
| `pets` | 385024 | 172 |
| `notification_campaign_deliveries` | 344064 | 935 |
| `vendor_identity` | 344064 | 244 |
| `services` | 335872 | 410 |
| `auth_operation_rate_events` | 311296 | 662 |
| `payments` | 311296 | 486 |

## Views (0)

_none_

## Partitioning

_No declarative partitions detected_

## Inheritance

_None_

## Enum types

- `analytics_actor_type_enum` (2 values)
- `analytics_app_enum` (2 values)
- `analytics_environment_enum` (3 values)
- `analytics_error_case_priority_enum` (4 values)
- `analytics_error_case_status_enum` (4 values)
- `analytics_event_type_enum` (14 values)
- `notification_campaign_channel` (5 values)
- `notification_campaign_delivery_status` (4 values)
- `notification_campaign_event_type` (9 values)
- `notification_campaign_status` (7 values)
- `notification_delivery_status` (7 values)
- `notification_target_app` (2 values)
- `notification_targeting_type` (5 values)
