# Warmpawz Finance Module — Current State

**Phase:** S1 (Analysis Only)  
**Date:** 2026-07-06  
**Status:** Read-only inventory — no code changes  
**Scope:** Finance admin UI, backend APIs, database tables, jobs, and integration with Discount Engine V2.

---

## Executive Summary

Warmpawz has a **live, multi-track finance system** covering service bookings, package sessions, meal/pharmacy delivery, and e-commerce sellers. Finance is **not greenfield**. Admin operations are centralized under `/finance`; production payout runs through `settlements.ts` → Razorpay.

Discount Engine V2 Phase 7 adds a **pure settlement preview** (funding split) that does **not** replace Finance payout infrastructure. Integration is partial: accrual hooks can read settlement preview when `DISCOUNT_ENGINE_V2_SETTLEMENT_MODE=AUTHORITATIVE`, but checkout does not yet persist preview into `wp_financial_meta`.

---

## Admin Finance Hub

**Route:** `/finance?tab=<tab>`  
**Page:** `apps/admin-web/app/finance/page.tsx`  
**Permission:** `admin.settlements`  
**Nav:** `packages/shared-types/src/admin-portal-nav.ts`

| Tab | Component | Primary APIs |
|-----|-----------|--------------|
| Dashboard | inline KPIs | `/admin/settlements/stats`, `/admin/analytics/kpis` |
| Fee Config | `FeeConfigurationManager` | `/admin/finance/fee-configuration` |
| Customer Delivery Fees | `CustomerDeliveryFeePolicyManager` | `/admin/delivery-fee-policy` |
| Payment Policies | `PaymentRulesSection` | payment policy endpoints |
| Cancellation Policy | `RefundPoliciesSection` | `/admin/finance/cancellation-policies`, `vendor_refund_tiers` |
| E-commerce Policies | `EcommercePoliciesSection` | `/admin/finance/ecommerce-policy-config` |
| GST Config | `GSTConfigurationManagement` | `/admin/finance/gst/*` |
| **Settlements** | `SettlementDashboard` | `/admin/finance/settlements`, `/settlements/summary` |
| **Payouts** | `PayoutManagement` | `/admin/payouts`, `/admin/payouts/stats` |
| **Tier System** | `TierManagement` | `/admin/payments/tiers` |
| **Schedule Settings** | `SettlementScheduleSettings` | `/admin/finance/settlement-schedule`, `POST /settlements/calculate-daily` |
| **Settlement Rules** | `DynamicSettlementRulesManager` | `/admin/finance/settlement-rules` |
| **Vendor Daily Accrual** | `VendorDailyAccrualReport` | `/admin/finance/vendor-daily-accrual` |
| **Vendor Monthly Accrual** | `VendorMonthlyAccrualReport` | `/admin/finance/vendor-daily-accrual/monthly` |
| **Vendor Booking Earnings** | `VendorBookingEarningsReport` | `/admin/finance/vendor-booking-earnings` |
| Payment Settings | `AdminPaymentSettings` | Razorpay/gateway config |

**Legacy routes:** `/settlements`, `/tiers` (older CRUD via `/admin/tiers`), mobile `FinanceManagement.tsx`.

**E-commerce finance (separate):** E-Commerce → Commission (`CommissionSettings.tsx`), E-Commerce → Settlements (`SettlementsDashboard.tsx`).

**Vendor finance UI:** `apps/vendor-web/components/vendor/VendorEarningsSettlementDashboard.tsx`, `/finance/settlements`.

---

## Backend API Map

### Core settlement & payout

**File:** `backend/lambda/src/endpoints/settlement&payouts/endpoints/settlements.ts`

| Endpoint | Purpose |
|----------|---------|
| `GET /settlements`, `/settlements/summary` | List and aggregate |
| `GET /settlements/policy` | Vendor-facing payout policy (tier hold, min payout) |
| **`POST /settlements/calculate-daily`** | Daily batch — primary settlement job |
| `POST /settlements/request` | On-demand payout from pending earnings |
| `POST /settlements/process-payouts` | Batch payout processing |
| `GET/PUT/POST /vendor/:vendorId/bank-details` | Bank account for Razorpay |

**File:** `backend/lambda/src/endpoints/razorpay-settlements.ts` — linked accounts, `POST /admin/payments/settlements/:id/process`.

**File:** `backend/lambda/src/jobs/settlement-processor.ts` — SQS async per-booking settlement + tier upgrade deductions.

### Admin finance

**File:** `backend/lambda/src/endpoints/admin/endpoints/admin-advanced.ts`

Settlement schedule, settlement rules CRUD, cancellation policies, fee config, GST, payouts admin, tier CRUD (`/admin/payments/tiers`).

### Accrual & earnings reports

| File | Endpoints |
|------|-----------|
| `admin-vendor-daily-accrual.ts` | Daily/monthly accrual + compute + CSV export |
| `admin-vendor-booking-earnings.ts` | Per-booking waterfall + CSV export |

**Utilities:** `vendor-booking-earnings-report.ts`, `vendor-accrual-ist.ts`, `vendor-accrual-fee-breakdown.ts`.

### Tier system

**File:** `backend/lambda/src/endpoints/tier-system.ts`

Vendor tier lookup, upgrade (Razorpay or settlement deduction), commission preview.

**Also:** `POST /admin/tiers/apply-commissions` in `admin-governance-enhanced.ts` — syncs `vendor_tiers.commission_rate` → `vendors.commission_percentage`.

### Fees & e-commerce commission

| File | Role |
|------|------|
| `utils/feeCalculator.ts` | Platform/convenience/delivery/packaging at checkout |
| `endpoints/fee-config.ts` | Admin fee configuration |
| `utils/resolve-ecommerce-commission-rate.ts` | E-commerce V2 commission (no tier) |

---

## Database Tables (Finance)

| Table | Purpose |
|-------|---------|
| `vendor_earnings` | Per-booking accrual ledger (service + package sessions) |
| `vendor_daily_accrual` | IST daily materialized snapshot |
| `settlements` | Batch settlement records |
| `payouts` | Bank payout records (Razorpay) |
| `payout_policies` | Hold period, auto payout flags |
| `vendor_tiers` | Commission rate, payout period, pricing, features |
| `vendor_tier_subscriptions` | Paid tier subscriptions |
| `tier_upgrade_deductions` | Recover tier upgrade cost from settlements |
| `delivery_settlements` | Meal/pharmacy vendor lines |
| `settlement_rules` | Dynamic rules (conditions/actions JSONB) |
| `platform_settings` | `admin:settings:payout_rules`, `admin:finance:settlement-schedule` |
| `cancellation_policies` | Vendor cancellation penalty |
| `vendor_refund_tiers` | Service refund/cancellation tiers |
| `vendor_commission_config` | E-commerce commission model |
| `vendor_category_commission_rates` | E-com per-category overrides |
| `ecommerce_categories` | Category default commission |
| `order_item_commission` | Persisted line commission at order time |

**Key migrations:** `008_vendor_tiers_only.sql`, `028_*`, `535_*` (vendor_earnings), `732`/`753` (accrual), `550`/`719` (settlement_rules), `1046` (campaign funding), `1050`–`1054` (e-com commission V2).

---

## Settlement Jobs & Schedulers

| Job | Trigger | Handler |
|-----|---------|---------|
| Daily batch | EventBridge `warmpawz-{env}-settlement-calculate-daily` | `POST /settlements/calculate-daily` |
| Schedule sync | Admin saves schedule | `settlement-schedule-eventbridge.ts` |
| SQS processor | SNS/SQS events | `settlement-processor.ts` |
| Accrual compute | Admin manual | `POST .../vendor-daily-accrual/compute` |
| Payout sync | Admin / cron | `PayoutStatusSyncService` |

Advisory lock `pg_try_advisory_lock(999999)` prevents concurrent daily batch runs.

---

## Finance Business Rules — What Exists Today

| Rule | Owner | Source of Truth | Used at Runtime? |
|------|-------|-----------------|------------------|
| Vendor commission % (services) | Finance | `vendor_tiers.commission_rate` | Yes — accrual |
| Vendor commission % (batch) | Finance | `vendors.commission_percentage` (denormalized) | Yes — daily batch |
| E-commerce commission | Finance | `vendor_commission_config` + category/ownership tables | Yes — order time |
| Payout hold period | Finance | `vendor_tiers.payout_period_days` | Yes — batch eligibility |
| Min payout amount | Finance | `platform_settings` payout_rules + schedule | Yes — batch |
| Settlement schedule (cron) | Finance | `platform_settings` + EventBridge | Yes |
| Platform/customer fees | Finance | `admin_settings` / fee config | Yes — checkout |
| GST/tax | Finance | GST config + booking financial meta | Yes — checkout; not in commission base |
| Cancellation penalties | Finance | `cancellation_policies` | Yes — batch |
| Dynamic settlement rules | Finance (UI) | `settlement_rules` table | **Stored only — not applied in batch** |
| Promotion/coupon funding | Discount Engine | Candidate normalization + Policy Center funding config | Preview only (Phase 7) |
| Discount resolution | Discount Engine | Unified resolver | Checkout (legacy authoritative) |

---

## Multi-Track Architecture

```
Customer checkout
  → payments-enhanced.ts + feeCalculator.ts
  → booking/order with wp_financial_meta (discounts, fees, taxes, finalPaid)

Completion / delivery
  → vendor_earnings (services) OR delivery_settlements (meals/pharmacy)
  → tier commission applied at accrual

Daily batch (EventBridge)
  → POST /settlements/calculate-daily
  → settlements rows aggregated by vendor
  → payouts → Razorpay

Reporting
  → vendor_daily_accrual (materialized)
  → vendor-booking-earnings (waterfall from vendor_earnings + payments)
```

---

## Discount Engine Overlap

| Area | Finance today | Discount Engine Phase 7 |
|------|---------------|-------------------------|
| Customer payable | Checkout + `wp_financial_meta.finalPaid` | Resolver `customerPayable` |
| Commission base | `resolveLedgerGrossForVendorCommission` | Hook adjusts gross via settlement preview |
| Funding split | Not in payout math | `FundingAllocator` + preview |
| Payout execution | `settlements.ts`, Razorpay | None (by design) |

See `docs/SETTLEMENT_ARCHITECTURE_ANALYSIS.md` for ownership boundaries.

---

## Related Documentation

| Document | Focus |
|----------|-------|
| `docs/SETTLEMENT_ARCHITECTURE_ANALYSIS.md` | Module ownership & recommended architecture |
| `docs/TIER_SYSTEM_ANALYSIS.md` | Tier configuration & effects |
| `docs/COMMISSION_POLICY_ANALYSIS.md` | Commission calculation bases |
| `docs/FINANCE_REUSE_PLAN.md` | Reuse vs extend decisions |
| `docs/SETTLEMENT_MIGRATION_PLAN.md` | Integration roadmap |
| `docs/FINANCE_GAP_ANALYSIS.md` | Problems & technical debt |
| `docs/SETTLEMENT_CURRENT_STATE.md` | Pre-Phase-7 inventory (partially stale on DE stub) |
| `backend/lambda/src/discount-engine/PHASE7_MIGRATION_REPORT.md` | Phase 7 implementation truth |

---

## Key File Index

| Area | Path |
|------|------|
| Finance hub | `apps/admin-web/app/finance/page.tsx` |
| Settlement batch | `backend/lambda/src/endpoints/settlement&payouts/endpoints/settlements.ts` |
| Earnings accrual | `backend/lambda/src/utils/vendor-earnings-on-completion.ts` |
| Tier commission | `backend/lambda/src/utils/vendor-tier-commission.ts` |
| E-com commission | `backend/lambda/src/utils/resolve-ecommerce-commission-rate.ts` |
| Discount settlement | `backend/lambda/src/discount-engine/settlement/` |
| Settlement hook | `backend/lambda/src/discount-engine/settlement/settlement-hook-bridge.ts` |
