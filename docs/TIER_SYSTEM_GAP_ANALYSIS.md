# Tier System – Gap Analysis & Implementation Plan

**Date:** 2026-02-04  
**Scope:** Admin tier configuration, vendor earnings/settlements, tier integration, payout options, bank verification.

---

## 1. Current State vs Expected

### 1.1 Admin Configuration (Finance > Fee Configuration)

| Aspect | Admin UI | DB (vendor_tiers) | Status |
|--------|----------|-------------------|--------|
| **API** | `/admin/payments/tiers` | Reads `vendor_tiers` | ✅ Working |
| **Tiers** | Basic (20%), Advance (10% ₹1999), Premium (7% ₹2999) | Configurable | ✅ |
| **Default** | Basic marked Default, Free | `is_default=true` | ✅ |
| **Applicable Roles** | 13 roles per tier | `applicable_roles UUID[]` | ✅ Schema exists |
| **Payout** | T+1 (payout_period_days) | Stored | ✅ |
| **CRUD** | Create, Edit, Delete | Full CRUD | ✅ |

### 1.2 Vendor Earnings Dashboard

| Aspect | Vendor UI | Source | Gap |
|--------|-----------|--------|-----|
| **Tier display** | Bronze 15% | `GET /vendor/:id/tier` | ❌ Hardcoded TIER_CONFIG (Bronze/Silver/Gold/Platinum) |
| **Commission** | 15% | tier-system.ts TIER_CONFIG | ❌ Ignores admin-configured vendor_tiers |
| **Upgrade options** | Bronze→Silver→Gold→Platinum | Hardcoded | ❌ Ignores admin tiers, role filtering |
| **Payout cycle** | "Every Tuesday" | Hardcoded | ⚠️ Should use tier.payout_period_days |
| **Bank verification** | Shown, blocks payout | `bank-details` API | ✅ |

### 1.3 Root Cause

**tier-system.ts** uses hardcoded `TIER_CONFIG` (Bronze/Silver/Gold/Platinum) and never reads from `vendor_tiers`. Admin configures Basic/Advance/Premium in `vendor_tiers`, but vendor API returns different data.

---

## 2. Schema Alignment

### vendor_tiers (single source of truth)

```sql
tier_name, tier_level, display_name, description,
commission_rate, payout_period_days,
monthly_cost, yearly_cost, six_month_cost, twelve_month_cost,
allow_split_payment, split_payment_installments, split_payment_interval_days,
features JSONB, applicable_roles UUID[],
is_default, is_active, is_free_tier
```

### vendors table

- `tier` TEXT – stores tier_name (e.g. 'Basic', 'Bronze')
- `commission_percentage` – can override; settlement uses vendor_tiers when joined
- `tier_id` – optional; some code paths use tier_name

### applicable_roles

- Empty `{}` = tier applies to all vendor roles
- Non-empty = tier only available to vendors whose `role_id` is in the array

---

## 3. Implementation Requirements (from user)

1. **Default tier = Basic**, commission 0% for basic (configurable in admin)
2. **Tiers from admin** → integrate to all vendors based on **vendor role** (applicable_roles)
3. **Higher tiers** may not apply to certain roles – use API, no hardcoding
4. **CRUD** for tiers – ✅ exists in admin
5. **Payment adjustment** – monthly OR yearly; OR 4 weekly settlements (first 4 weeks)
6. **Settlement** via bank account verification – ✅ exists
7. **Payout cycle** per tier from admin – `payout_period_days`
8. **T&C acceptance** per tier – schema/logic to add
9. **Vendor self-upgrade** – rule-based, dynamic tier list from API

---

## 4. Gaps to Fix

### Critical (blocks correct behavior)

| # | Gap | Fix |
|---|-----|-----|
| 1 | GET /vendor/:id/tier uses hardcoded TIER_CONFIG | Read from vendor_tiers; resolve vendor default tier |
| 2 | Tier upgrade accepts only Bronze/Silver/Gold/Platinum | Accept any tier_name from vendor_tiers |
| 3 | Upgrade options ignore applicable_roles | Filter next tiers by vendor.role_id ∈ tier.applicable_roles |
| 4 | Vendor dashboard shows wrong tier names | API returns admin tiers → UI displays them |

### Medium (configurability)

| # | Gap | Fix |
|---|-----|-----|
| 5 | Payout cycle hardcoded "Every Tuesday" | Use tier.payout_period_days, derive next payout day |
| 6 | No payout frequency choice (monthly vs 4-weekly vs yearly) | Extend vendor_tier_subscriptions or preferences |
| 7 | Basic tier commission 20% in seed – user wants 0% | Admin can edit; or update seed-defaults |
| 8 | resolveVendorById not used in tier-system | Add for vendor_identity.id support |

### Lower priority

| # | Gap | Fix |
|---|-----|-----|
| 9 | T&C acceptance per tier | New table vendor_tier_acceptances |
| 10 | Settlement breakup clarity | Enhance breakup API with subscription charge, commission |

---

## 5. Files to Modify

| File | Changes |
|------|---------|
| `backend/lambda/src/endpoints/tier-system.ts` | Replace TIER_CONFIG with vendor_tiers fetch; role filtering; resolveVendorById |
| `apps/vendor-web/.../VendorEarningsSettlementDashboard.tsx` | Handle dynamic tier names; remove Bronze/Silver/Gold hardcoding in Tier Benefits tab |
| `backend/lambda/src/endpoints/admin-advanced.ts` | Optional: seed Basic with 0% commission |
| `docs/` | This analysis |

---

## 6. API Contract (GET /vendor/:vendorId/tier) – After Fix

```json
{
  "success": true,
  "tier": {
    "current": "Basic",
    "name": "Basic",
    "commissionRate": 0,
    "commission": 0,
    "payoutPeriodDays": 7,
    "payoutCycleLabel": "Weekly (every 7 days)",
    "stats": { "totalBookings": 0, "totalRevenue": 0 },
    "features": ["Basic listing", "Standard support", "Weekly settlements"],
    "nextTier": "Advance",
    "eligible": true,
    "upgradeTiers": [
      {
        "name": "Advance",
        "commissionRate": 10,
        "monthlyCost": 1999,
        "yearlyCost": 19990,
        "features": [...],
        "applicableToRole": true
      }
    ],
    "requirements": { ... }
  }
}
```

---

## 7. Settlement Calculation (existing)

- `razorpay-settlements.ts`, `settlement-processor.ts` join `vendors.tier` → `vendor_tiers.tier_name` for commission_rate
- Once vendors have correct `tier` (matching vendor_tiers), settlements use admin-configured commission
- Bank verification: existing flow; settlement requires verified bank
