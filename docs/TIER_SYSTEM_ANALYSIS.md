# Tier System Analysis

**Phase:** S1 (Analysis Only)  
**Date:** 2026-07-06  
**Purpose:** Document how vendor tiers work, what they affect, and where the source of truth lives.

---

## Overview

Warmpawz uses a **subscription tier system** for **service vendors** (bookings, packages, meal/pharmacy delivery commission). E-commerce seller commission uses a **separate V2 model** (category/ownership) — **not** vendor tiers.

Tiers are configured in Finance → **Tier System** and stored in `vendor_tiers`. Vendors are assigned via `vendors.tier` and optionally upgraded through paid `vendor_tier_subscriptions`.

---

## Tier Names & Defaults

**Seeded tiers** (`tier-system.ts`, `TierManagement.tsx`):

| Tier | Level | Default Commission | Payout Period | Monthly Cost |
|------|-------|-------------------|---------------|--------------|
| Bronze | 1 | 15% | Configurable (`payout_period_days`) | Free (default tier) |
| Silver | 2 | 12% | Configurable | ₹999 |
| Gold | 3 | 10% | Configurable | ₹2,499 |
| Platinum | 4 | 8% | Configurable | ₹4,999 |

**Legacy names** in code fallback (`TIER_CONFIG_FALLBACK`): also includes `Basic` (0% commission) for edge cases.

**Reference constants** (`lib/constants/commission.ts`):

```typescript
COMMISSION_TIERS = { BRONZE: 15, SILVER: 12, GOLD: 10, PLATINUM: 8 }
DEFAULT_COMMISSION_RATE = 10.0  // used when DB lookup fails in getVendorTierCommission
```

**Note:** Three different “defaults” exist in codebase: 15% (`getVendorCommissionRate`), 10% (`DEFAULT_COMMISSION_RATE`, batch `defaultCommission`), 10% in `COMMISSION_TIERS` vs 15% Bronze — see `docs/FINANCE_GAP_ANALYSIS.md`.

Admin UI labels tiers as Bronze/Silver/Gold/Platinum — not Basic/Advance/Premium/Enterprise. Those marketing names are **not** the current schema.

---

## Source of Truth

| Data | Table / Field | Who writes |
|------|---------------|------------|
| Tier definitions | `vendor_tiers` | Admin via `/admin/payments/tiers` |
| Vendor assignment | `vendors.tier` → `tier_name` | Onboarding default; admin; upgrade flow |
| Paid subscription | `vendor_tier_subscriptions` | Razorpay upgrade or settlement deduction |
| Denormalized commission | `vendors.commission_percentage` | `POST /admin/tiers/apply-commissions` sync |
| Upgrade recovery | `tier_upgrade_deductions` | Tier upgrade with settlement_deduction option |

**Priority at commission lookup** (`getVendorTierCommission`):

1. Active paid subscription (`vendor_tier_subscriptions` where `status=active` and not expired)  
2. Vendor's assigned tier (`vendors.tier` → `vendor_tiers`)  
3. Default tier (`is_default=true` or Bronze)

**Simpler lookup** (`getVendorCommissionRate` — used at booking completion):

- Direct join `vendors.tier` → `vendor_tiers.commission_rate`  
- Default **15%** if missing (does not check subscription table)

**Gap:** Accrual uses `getVendorCommissionRate`; other paths use `getVendorTierCommission` — subscription override may not apply at completion.

---

## How Tiers Affect Finance

| Effect | Mechanism | Runtime |
|--------|-----------|---------|
| **Commission %** | `vendor_tiers.commission_rate` | `vendor_earnings`, `delivery_settlements` |
| **Settlement hold** | `vendor_tiers.payout_period_days` | Booking eligible when `completed_at < NOW() - period` |
| **Automated bank payout** | `tier_level >= 3` or `features.automatedVendorBankPayout` | `tierRowAllowsAutomatedPayout()` in settlements.ts |
| **Tier upgrade cost recovery** | `tier_upgrade_deductions` | Deducted in settlement-processor and batch |
| **Vendor-facing policy** | `GET /settlements/policy` | Returns tier name, hold days, commission explanation |
| **Onboarding F100** | `onboarding-f100-tier.ts` | Special platform tier slots |

Tiers do **not** affect:

- E-commerce commission (separate config)  
- Discount Engine promotion/coupon resolution  
- Platform fee amounts (fee config is global)  
- GST rates  

---

## Tier Purchase & Assignment

### Can vendors purchase tiers?

**Yes.** `POST /vendor/:vendorId/tier/upgrade`:

- **Razorpay upfront** — immediate subscription  
- **Settlement deduction** — installments from future settlements (`tier_upgrade_deductions`)

Payment options: monthly, yearly, 6-month, 12-month (configured on tier row).

### Can admin assign tiers?

**Yes.**

- Finance → Tier System CRUD  
- Legacy `/tiers` page → `/admin/tiers`  
- `POST /admin/tiers/apply-commissions` propagates rates to all vendors  

### Subscription vs assigned tier

Active subscription **should** override static `vendors.tier` in `getVendorTierCommission`, but completion accrual may not use that path consistently.

---

## Admin UI

**Component:** `apps/admin-web/components/admin/finance/tierManagement/TierManagement.tsx`

**APIs:** `GET/POST/PUT/DELETE /admin/payments/tiers`, `POST /admin/payments/tiers/seed-defaults`

**Editable fields:** commission rate, payout period days, monthly/yearly costs, split payment options, features JSON, terms, role eligibility.

**Explicit note in UI:** E-commerce commission is under E-Commerce → Commission, not here.

---

## Database Schema (Key Columns)

**`vendor_tiers`:** `tier_name`, `tier_level`, `display_name`, `commission_rate`, `payout_period_days`, `monthly_cost`, `yearly_cost`, `features` (JSONB), `is_default`, `is_active`.

**`vendor_tier_subscriptions`:** `vendor_id`, `tier_id`, `status`, `expires_at`, payment references.

**`vendors`:** `tier` (text), `commission_percentage` (denormalized for batch).

---

## Tier & Discount Engine Interaction

| Area | Interaction |
|------|-------------|
| Commission rate for net settlement hint | Phase 7 can read `context.metadata.commissionRateHint` — optional preview only |
| Commission base adjustment | Settlement hook reduces gross by **vendor-funded** discounts — independent of tier % |
| Tier does not change funding attribution | Funding is per-promotion/coupon, not per tier |
| Policy Center | No tier configuration — Finance owns tiers |

**Recommendation:** Keep tier system entirely in Finance. Discount Engine settlement preview should **read** tier commission from Finance at accrual time, not store tier logic.

---

## Dynamic Settlement Rules vs Tiers

`DynamicSettlementRulesManager` allows conditions on `vendorTier[]` and per-rule `commissionRate` / `periodDays` — but **rules are not evaluated at runtime**. Actual hold period comes from `vendor_tiers.payout_period_days` only.

Do not confuse **refund tiers** (`vendor_refund_tiers`) with subscription tiers — separate system for cancellation/refund policies.

---

## Related Documents

- `docs/COMMISSION_POLICY_ANALYSIS.md` — how tier commission is applied to amounts  
- `docs/FINANCE_GAP_ANALYSIS.md` — duplicate commission lookups and defaults  
- `docs/SETTLEMENT_ARCHITECTURE_ANALYSIS.md` — ownership boundaries  
