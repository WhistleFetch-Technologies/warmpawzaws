# 14 — Production Technical Debt (Classification Only)

**No deletion or merge recommendations** — observational classification per Phase 0B scope.

## Backup tables

_none_

## Duplicate-candidate pairs

| Table | Rows | Code files | Migrations |
|-------|------|------------|------------|
| `audit_trail` | 49152 | 0 | 1 |
| `tele_queues` | 49152 | 0 | 3 |
| `gst_configurations` | 40960 | 0 | 2 |
| `coupon_usages` | 24576 | 1 | 1 |

_Pairs from handover: coupon_usage/coupon_usages, gst_configs/gst_configurations, audit_logs/audit_trail, tele_queue/tele_queues_

## Enhanced / versioned

- `vendor_availability_v2` — 970 rows, 17 code files
- `notification_templates_enhanced` — 73728 rows, 0 code files
- `vendor_holidays_enhanced` — 32768 rows, 4 code files

## Dating (experimental)

- `dating_profiles_pet` — 65536 rows, code=0, mig=2
- `dating_matches` — 57344 rows, code=0, mig=2
- `dating_meetups` — 49152 rows, code=0, mig=2
- `dating_analytics` — 40960 rows, code=0, mig=2
- `dating_chat_messages` — 40960 rows, code=0, mig=2
- `dating_profiles_owner` — 40960 rows, code=0, mig=2

## Migration-only tables (94 total)

Sample: vendor_admin_portal_codes, customer_admin_portal_codes, pet_listings, notification_templates_enhanced, prescription_submissions, meal_rider_reassign_requests, medicine_orders, dating_profiles_pet, notification_logs, deliveries, user_subscriptions, dating_matches, booking_policies, breeder_profiles, nutrition_consultation_requests, adoption_center_profiles, pet_inquiries, groomer_gallery, mating_appointments, ui_configs…

## Naming inconsistencies observed

- Plural/singular duplicates (coupon_usage vs coupon_usages)
- `_enhanced` / `_v2` suffix tables alongside base tables
- `*_backup` tables from dedupe operations
- Parallel taxonomy: `specialization_master` vs `problem_grid_mappings`
