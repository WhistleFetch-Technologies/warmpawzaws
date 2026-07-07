# Phase 0 — Application Dependency Analysis

**Status:** Complete (read-only)  
**Generated:** 2026-07-07  
**Scope:** Dev database handover (`d:\dd\tables(dev).txt`, `d:\dd\tables row count(dev).txt`) + `backend/lambda/src` codebase scan  
**No migration, no schema changes, no infrastructure changes.**

Machine-readable artifacts:

| File | Purpose |
|------|---------|
| `docs/rds-v2/_dependency-matrix.json` | Per-table status, domains, file hits |
| `docs/rds-v2/_dependency-scan.json` | Summary, top tables, feature map, endpoint prefixes |
| `docs/rds-v2/_endpoint-table-map.json` | Route → tables (file-co-occurrence heuristic) |
| `docs/rds-v2/_column-usage-top80.json` | Column references for top 80 active tables |
| `docs/rds-v2/_duplicate-analysis.json` | Duplicate/enhanced pair comparison |

Regenerate: `node scripts/rds-v2-dependency-scan.js && node scripts/rds-v2-column-scan.js`

---

## 1. Executive Summary

Phase 0 discovery (table inventory + row counts) is **accepted as complete** per handover. This document adds the **application dependency layer** required before any greenfield schema design.

### Key findings

| Metric | Value |
|--------|------|
| Tables in dev inventory | **421** (excl. PostGIS `spatial_ref_sys`) |
| TypeScript files scanned | **601** (`backend/lambda/src`, excl. `__tests__`) |
| HTTP route registrations | **~2,557** (`app.get/post/put/patch/delete`) |
| Endpoint register modules | **~120+** (`register*Endpoints` in `handler/index.ts`) |
| Tables referenced in Lambda code | **268** (Active) |
| Tables in migrations only | **137** (Migration-only) |
| Tables with no code or migration string match | **16** (Unknown) |
| Background job processors | **10** (`backend/lambda/src/jobs/`) |
| Explicit repository modules | **1** (`repository.telecommunication.ts`) |

### Architecture pattern

Warmpawz uses an **endpoint-centric data access model**, not a classical repository layer:

- All RDS access is intended to flow through `backend/lambda/src/database/rds-connection.ts` (`query`, `select`, `insert`, `update`, `deleteRows`, transactions).
- Business logic and SQL live primarily in `backend/lambda/src/endpoints/**/*.ts` plus `jobs/`, `middleware/`, and `handler/index.ts` (runtime DDL — flagged as risk).
- **Supabase is not a runtime database client.** Remaining references are migration-era comments or dead frontend config (`apps/customer-web/lib/supabase/info.ts`). Production path is Lambda → RDS PostgreSQL.

### Dev environment implication (from handover)

Dev RDS is effectively empty. **Empty tables are not evidence of disuse** — 137 migration-only tables and 16 unknown tables may still matter for prod ETL or dormant features. Application references trump row counts for keep/drop decisions.

### Readiness for next phase

Dependency mapping is sufficient to begin **Phase A/B schema design** on paper, but **prod row-count validation** and **column allowlist refinement** are still required before cutover planning.

---

## 2. Dependency Matrix

**Full matrix:** `docs/rds-v2/_dependency-matrix.json` (421 rows).

### Status definitions

| Status | Meaning |
|--------|---------|
| **Active** | Referenced in at least one Lambda source file |
| **Migration-only** | Appears in `db/migrations/*.sql` but no string match in Lambda code |
| **Unknown** | No Lambda reference and no migration filename/content match |

### Classification tags (naming heuristics)

| Tag | Count | Examples |
|-----|-------|----------|
| Backup | 3 | `customer_addresses_dedupe_backup`, `pets_dedupe_backup`, `service_categories_backup` |
| Enhanced/Versioned | 3 | `notification_templates_enhanced`, `vendor_availability_v2`, `vendor_holidays_enhanced` |
| Duplicate-candidate | 4 | `coupon_usages`, `gst_configurations`, `audit_trail`, `tele_queues` |
| View | 5 | `v_vendor_payable_account`, `v_customer_wallet_account`, … |
| Experimental/Dating | 6 | `dating_profiles_pet`, `dating_matches`, … (all Migration-only) |

### Top 25 active tables (by file reference count)

| Table | Code files | Migrations | Access patterns | Primary domains |
|-------|------------|------------|-----------------|-----------------|
| `vendors` | 202 | 157 | select, update, insert, FROM, JOIN | Vendor |
| `bookings` | 133 | 119 | select, update, insert, FROM, JOIN | Booking |
| `customers` | 125 | 98 | select, update, insert, FROM, JOIN | Customer |
| `roles` | 78 | 64 | select, insert, update, deleteRows | Admin/RBAC |
| `vendor_services` | 75 | 18 | select, update, insert, FROM, JOIN | Discovery, Vendor |
| `services` | 68 | — | select, FROM, JOIN | Discovery |
| `staff` | 65 | — | select, insert, update | Staff |
| `pets` | 58 | — | select, insert, update | Customer |
| `orders` | 55 | — | select, insert, update | Ecommerce |
| `payments` | 52 | — | select, insert, update | Payments |
| `vendor_identity` | 48 | — | select, update | Vendor |
| `products` | 45 | — | select, insert, update | Ecommerce |
| `notifications` | 42 | — | select, insert | Notifications |
| `settlements` | 40 | — | select, insert, update | Payments |
| `service_catalog` | 38 | — | select, update, FROM | Discovery |
| `device_tokens` | 35 | — | select, insert, update | Notifications |
| `support_tickets` | 34 | — | select, insert, update | Support |
| `wallet_transactions` | 32 | — | select, insert | Wallet |
| `refunds` | 30 | — | select, insert, update | Payments |
| `coupons` | 28 | — | select, insert | Loyalty |
| `search_index` | 27 | — | select, insert, update, DELETE | Discovery |
| `specialization_master` | 26 | — | select, FROM | Discovery |
| `vendor_specializations` | 25 | — | select, insert | Discovery |
| `prescriptions` | 24 | — | select, insert | Medical |
| `pharmacy_orders` | 23 | — | select, insert, update | Pharmacy |

### Migration-only sample (137 total — no Lambda string match)

Likely legacy, admin-only SQL, or never-wired features. **Do not delete without prod validation.**

`ad_performance_analytics`, `adoption_center_profiles`, `adoption_listings`, `appointment_reminders`, `audit_trail`, `automation_jobs`, `aws_settings`, `bank_verifications`, `banner_analytics`, `boarding_facilities`, `booking_conflicts`, `booking_limits`, `booking_staff_assignments`, `booking_state_transitions`, `breeder_profiles`, `cache_stats`, `chart_of_accounts`, `commute_time_cache`, `content_assets`, `customer_favorites`, `dating_*` (all 6), `notification_templates_enhanced`, `gst_configurations`, `tele_queues`, …

### Unknown tables (16)

No code reference and no migration text match (may be manual DDL or grep blind spots):

`commercial_campaign_audit_log`, `commercial_campaign_promotion_links`, `commercial_discount_campaigns`, `customer_addresses_dedupe_backup`, `ecommerce_loyalty_pending_awards`, `idempotency_records`, `order_item_commission`, `pets_dedupe_backup`, `product_commission_overrides`, `service_categories_backup`, `vendor_category_commission_rates`, `vendor_commission_config`, `vendor_loyalty_points`, `vendor_loyalty_transactions`, `vendor_onboarding_transitions`, `vendor_registered_brands`

---

## 3. Feature → Table Mapping

Derived from table name prefixes + code activity (`_dependency-scan.json` → `featureTableMap`).

| Feature domain | Tables (total) | Code-active | Notes |
|----------------|----------------|-------------|-------|
| **Vendor** | 51 | 39 | Core entity; highest coupling |
| **Notifications** | 18 | 15 | Campaigns + device tokens + templates |
| **Customer** | 21 | 15 | Identity, wallets, addresses, pets |
| **Delivery** | 15 | 11 | Meals, partners, Pidge webhooks |
| **Booking** | 16 | 7 | Many booking_* tables are Migration-only |
| **Staff** | 14 | 10 | `registerStaffEndpoints` commented out in handler; tables still used |
| **Discovery** | 10 | 9 | `service_catalog`, `vendor_services`, `search_index` |
| **Ecommerce** | 11 | 9 | Orders, cart, products, wishlists |
| **Loyalty** | 8 | 8 | **Both** `coupon_usage` and `coupon_usages` active |
| **Support** | 9 | 9 | Fully wired |
| **Payments** | 7 | 5 | Settlements, refunds, payouts |
| **Admin** | — | — | Cross-cutting via `admin_*` tables |
| **Pharmacy** | 6 | 2 | Broadcast processor uses `pharmacy_*` |
| **Diagnostics** | 5 | 3 | Partial |
| **Tele** | 6 | 2 | `tele_queue` active; `tele_queues` Migration-only |
| **Insurance** | 3 | 3 | Active |
| **AI** | 2 | 2 | Wizard + chatbot sessions |
| **Analytics** | 2 | 2 | Only dev tables with meaningful row counts per handover |
| **Dating** | 6 | **0** | Migration-only — candidate experimental feature |

---

## 4. Endpoint → Table Mapping

**Full map:** `docs/rds-v2/_endpoint-table-map.json` (~2,500+ route entries).

### Methodology

Routes are parsed from `app.(get|post|put|patch|delete)('path')`. Tables are attributed via **file-level co-occurrence**: all tables referenced anywhere in the endpoint file are linked to every route in that file.

**Limitation:** Admin mega-files (e.g. `admin-advanced.ts`) inflate per-route table lists. Use this map for **module-level** dependency, not per-handler precision. Phase B should add AST-level handler scoping if needed.

### Top route prefixes (by registration count)

| Prefix | Routes | Example endpoints | Primary files |
|--------|--------|-------------------|---------------|
| `/admin/vendors` | 89 | vendor CRUD, approval, tiers | `admin-advanced.ts`, `admin-comprehensive.ts` |
| `/customer` | 78 | profile, bookings, discovery | `customer/*.ts`, `service-discovery.customer.ts` |
| `/vendor` | 72 | dashboard, schedule, services | `vendor/endpoints/*` |
| `/bookings` | 58 | create, status, OTP | `bookings-enhanced.booking.ts` |
| `/admin/bookings` | 48 | admin booking ops | `admin-comprehensive.ts` |
| `/discover` | 42 | service discovery | `service-discovery.customer.ts` |
| `/admin/orders` | 40 | ecommerce admin | `admin-comprehensive.ts` |
| `/staff` | 36 | availability, verify | `staff.ts` (handler registration **disabled**) |
| `/vendor/onboarding` | 36 | role select, KYC | `vendor-onboarding-enhanced.ts` |
| `/admin/catalog` | 34 | taxonomy, styles | `admin-advanced.ts`, `service-catalog.ts` |

### Representative endpoint → table examples (file-scoped, high confidence)

| Method | Path | Tables |
|--------|------|--------|
| GET | `/customer/addresses` | `customer_addresses`, `customers` |
| GET | `/discover/services` | `service_catalog`, `vendor_services`, `vendors`, `specialization_master`, … |
| POST | `/bookings/create` | `bookings`, `booking_services`, `customers`, `vendors` |
| POST | `/razorpay/verify` | `payments`, `bookings`, `orders` |
| GET | `/wallet/balance` | `customer_wallets`, `wallet_transactions` |
| POST | `/support/tickets` | `support_tickets`, `customers` |

### Handler hub

All routes register through `backend/lambda/src/handler/index.ts`. Notable flags:

- `registerStaffEndpoints` — **commented out** (staff decommission note) but `staff.ts` still contains routes and DB access.
- `registerBookingEndpoints` — deprecated in favor of `registerBookingEndpointsEnhanced`.
- Runtime DDL and soft-fail paths exist in handler (see Risks).

---

## 5. Repository → Table Mapping

Warmpawz does **not** use a uniform repository pattern. Map **logical access modules** instead:

### 5.1 Data access foundation

| Module | Role | Tables |
|--------|------|--------|
| `database/rds-connection.ts` | Pool, `query`, `select`, `insert`, `update`, `deleteRows`, transactions | All (gateway) |

### 5.2 Explicit repository (only one)

| Repository | File | Tables |
|------------|------|--------|
| Telecommunication | `endpoints/teleCommunication/repository/repository.telecommunication.ts` | `video_call_sessions`, `tele_queue`, related tele tables |

### 5.3 Endpoint modules (primary “repositories”)

Each `register*Endpoints` module acts as the bounded context for its tables. High-traffic mappings:

| Endpoint module | Key tables |
|-----------------|------------|
| `bookings-enhanced.booking.ts` | `bookings`, `booking_services`, `booking_status_history`, `package_sessions` |
| `service-discovery.customer.ts` | `service_catalog`, `vendor_services`, `vendors`, `problem_grid_mappings`, `search_index` |
| `service-catalog.ts` | `service_catalog`, `service_categories`, `specialization_master` |
| `vendor-schedule.ts` | `vendor_availability_v2`, `vendor_holidays`, `vendor_holidays_enhanced`, `vendor_slot_*` |
| `ecommerce.ts` | `orders`, `order_items`, `products`, `cart_items` |
| `settlements.ts` / `settlement-processor.ts` | `settlements`, `settlement_logs`, `payouts`, `tier_upgrade_deductions` |
| `loyalty.ts` | `loyalty_*`, `coupons`, `coupon_usage`, `coupon_usages` |
| `notifications.notification.ts` | `notifications`, `notification_templates`, `device_tokens` |
| `admin.controller.ts` + `admin-advanced.ts` | Cross-domain admin tables (high fan-out) |
| `staff.ts` | `staff`, `staff_availability_*`, `staff_services` |

### 5.4 Background workers → tables

| Job | Trigger | Tables touched |
|-----|---------|----------------|
| `settlement-processor.ts` | SQS settlement queue | `settlements`, `settlement_logs`, `vendors`, `bookings`, `tier_upgrade_deductions`, `tier_deduction_transactions` |
| `scheduled-notification-processor.ts` | Scheduler / cron | `scheduled_notifications`, `bookings`, `pharmacy_broadcasts` |
| `notification-processor.ts` | SQS | `notifications`, `user_devices` |
| `sms-processor.ts` | SQS | `sms_logs` |
| `email-processor.ts` | SQS | `email_logs` |
| `analytics-retention.ts` | Scheduled | `analytics_events`, `analytics_sessions` |
| `pharmacy-broadcast-expansion-processor.ts` | EventBridge Scheduler (~1 min) | `pharmacy_orders`, `pharmacy_broadcasts`, `pharmacy_order_notifications`, `vendors`, `roles` |
| `vendor-shipment-tracking-processor.ts` | Scheduled | `shipments` |
| `support-ticket-auto-assign-processor.ts` | Scheduled | `support_tickets`, `support_agents` |
| `support-ticket-escalation-processor.ts` | Scheduled | `support_tickets`, `support_escalation_rules` |

### 5.5 Migrations

| Location | Count | Role |
|----------|-------|------|
| `db/migrations/*.sql` | ~486 | Historical DDL; many tables never referenced in Lambda |
| `handler/index.ts` `POST /system/run-pending-migrations` | — | Runtime migration runner (governance risk) |
| `database/migrations/create-admins-table.ts` | 1 | Code-based migration (legacy) |

### 5.6 Async infrastructure (Terraform)

`infra/modules/sqs/main.tf` defines queues: `booking_processing`, `payment_processing`, `notification_delivery`, `analytics_events`, `email_delivery`, `order_processing` (+ DLQs). Consumers live in Lambda handlers/jobs — queue names do not imply table names 1:1.

---

## 6. Column Usage Analysis

**Artifact:** `docs/rds-v2/_column-usage-top80.json`

### Methodology

Heuristic extraction from:

- `select('table', …, { columns: [...] })`
- `insert('table', { col: … })` / `update('table', { col: … })`
- `SELECT col1, col2 FROM table` in raw SQL strings

### Top tables — referenced column counts (approximate)

| Table | Distinct column refs detected |
|-------|-------------------------------|
| `bookings` | ~70 |
| `vendors` | ~67 |
| `customers` | ~31 |
| `orders` | ~31 |
| `pets` | ~30 |
| `vendor_services` | ~28 |
| `services` | ~21 |
| `roles` | ~15 |

### Known limitations (must read)

1. **False positives:** JS method names (`map`, `filter`, `forEach`) can appear in column lists when scanning `insert` object literals — filter before v2 allowlist.
2. **False negatives:** `SELECT *`, dynamic SQL, and runtime-built column names are not captured.
3. **No DB catalog join yet:** “Columns never referenced” requires cross-join with `information_schema.columns` from prod (Phase B). Not computed in this pass.

### Recommended Phase B column workflow

1. Export prod column catalog per active table.
2. Subtract referenced columns from scan + manual review of `SELECT *` hotspots (`vendors`, `bookings`, `admin-advanced.ts`).
3. Publish allowlist per bounded context for `db/schema-v2/`.

---

## 7. Candidate Legacy Tables

**Criteria:** Migration-only status OR handler-disabled feature OR superseded sibling table.

| Table / group | Evidence | Recommendation |
|---------------|----------|----------------|
| `dating_*` (6 tables) | Migration-only, zero Lambda refs | Hold for product confirmation; strong drop candidate |
| `adoption_*`, `breeder_profiles` | Migration-only | Legacy marketplace experiment |
| `audit_trail` | Migration-only; `audit_logs` is Active | Consolidate to `audit_logs` in v2 |
| `tele_queues` | Migration-only; `tele_queue` is Active | Consolidate in v2 |
| `gst_configurations` | Migration-only; `gst_configs` is Active | Consolidate in v2 |
| `notification_templates_enhanced` | Migration-only; `notification_templates` is Active | Merge or drop enhanced |
| `appointment_reminders` | Migration-only | May be replaced by `scheduled_notifications` job path |
| `booking_staff_assignments`, `booking_conflicts`, `booking_limits` | Migration-only | Staff model changing — validate before v2 |
| `automation_jobs`, `cache_stats`, `cache_tokens` | Migration-only | Infra/cache experiments |
| Staff routes disabled in handler | `staff` tables still Active in code | Legacy transition — needs product decision |

---

## 8. Candidate Duplicate Tables

From handover naming patterns + code/migration comparison (`_duplicate-analysis.json`):

| Pair | Active in code | Migration refs | Likely canonical |
|------|----------------|----------------|------------------|
| `coupon_usage` / `coupon_usages` | **Both** (1 file each) | 6 / 1 | **Needs code fix** — dual-write risk |
| `gst_configs` / `gst_configurations` | configs only | 3 / 2 | `gst_configs` |
| `audit_logs` / `audit_trail` | logs only | 5 / 1 | `audit_logs` |
| `tele_queue` / `tele_queues` | queue only | 5 / 3 | `tele_queue` |
| `notification_templates` / `notification_templates_enhanced` | templates only | 3 / 1 | `notification_templates` |
| `vendor_holidays` / `vendor_holidays_enhanced` | **Both** (4 files each) | 2 / 1 | **Needs merge** — both actively used |

---

## 9. Candidate Backup Tables

| Table | Code refs | Migration refs | Status |
|-------|-----------|----------------|--------|
| `customer_addresses_dedupe_backup` | 0 | 0 | Unknown — manual backup |
| `pets_dedupe_backup` | 0 | 0 | Unknown — manual backup |
| `service_categories_backup` | 0 | 0 | Unknown — manual backup |

**Recommendation:** Exclude from v2 schema unless prod row-count audit shows recovery need. Document retention policy on old RDS only.

---

## 10. Risks

| Risk | Severity | Detail |
|------|----------|--------|
| **Endpoint mega-files** | High | `admin-advanced.ts`, `admin-comprehensive.ts` reference dozens of tables — blast radius for schema changes |
| **Dual table pairs** | High | `coupon_usage`/`coupon_usages`, `vendor_holidays`/`vendor_holidays_enhanced` both active |
| **Handler runtime DDL** | High | `handler/index.ts` can mutate schema at runtime — conflicts with migration ledger strategy |
| **Staff decommission drift** | Medium | Routes unregistered but `staff.ts` + 10 staff tables still active |
| **Migration-only ≠ unused** | Medium | 137 tables may be prod-populated with no dev parity |
| **Discovery SQL complexity** | Medium | `service-discovery.customer.ts` — many alias branches, taxonomy type drift |
| **Empty dev misleads testing** | Medium | ETL rehearsal cannot validate row-level constraints on dev alone |
| **Column scan noise** | Low | Automated column map requires prod schema cross-check |
| **Endpoint→table heuristic** | Low | File-level attribution over-counts tables per route |
| **SQS/EventBridge partial map** | Low | Not all queue consumers traced to table level in this pass |

---

## 11. Questions (for approval gate)

1. **Dating feature:** Confirm deprecated — safe to exclude all 6 `dating_*` tables from v2?
2. **Staff model:** Is staff being fully removed in favor of solo vendors? If yes, which of the 10 active `staff_*` tables remain?
3. **Duplicate pairs:** Approve canonical table for each pair (Section 8)? Priority: `coupon_usage` vs `coupon_usages`.
4. **Ecommerce scope:** Is full shop (`orders`, `products`, `cart_items`) in v2 core, or phased after bookings/vendors?
5. **Search index:** Rebuild `search_index` from source tables in v2, or migrate as-is?
6. **Migration-only tables:** Run prod row-count + code grep on prod branch before any drop list is finalized?
7. **Runtime migrations:** Disable `POST /system/run-pending-migrations` and handler DDL before v2 cutover?
8. **Loyalty consumer Lambda:** Confirm `warmpawz-*-loyalty-events-consumer` table scope (not fully scanned in this pass)?
9. **Backup tables:** OK to exclude all `*_backup` / `*_dedupe_backup` from v2?
10. **Stage environment:** Is a third RDS environment in scope for v2 rehearsal?

---

## Appendix A — Access pattern legend

| Pattern | Source |
|---------|--------|
| `select()` | `rds-connection.ts` helper |
| `insert()` / `update()` / `deleteRows()` | ORM-style helpers |
| `FROM` / `JOIN` / `INTO` | Raw SQL in template strings |

## Appendix B — What was explicitly not done

Per handover and project rules:

- No table inventory regeneration
- No row count re-analysis
- No SQL migration scripts
- No infrastructure / new RDS
- No table deletion
- No prod database modifications

---

**Next step after approval:** Phase B — prod row-count validation + column allowlist cross-check → draft `db/schema-v2/` bounded contexts.
