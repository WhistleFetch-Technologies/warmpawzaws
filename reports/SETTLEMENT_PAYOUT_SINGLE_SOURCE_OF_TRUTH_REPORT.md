# Settlement Period & Payout Period – Single Source of Truth Report

**Date:** 2026-02-05  
**Purpose:** Map where settlement period and payout rules are defined, confirm system design, and define one canonical source (tier-based in Finance & Logistics) with elimination of duplicates.

---

## 1. Executive Summary

Settlement period and payout period are currently defined in **multiple places** across backend, admin UI, vendor UI, and platform settings. The ideal design is a **tier-based single source of truth** in Finance & Logistics (Tier Management). This report lists all current definitions, how they are used, and a concrete plan to keep **only** the tier system as the source for payout/settlement period, with other locations removed or made read-only derived from tiers.

---

## 2. Current System – Where Periods Are Defined

### 2.1 **Single source (canonical) – Tier system**

| Location | What it stores | Consumed by |
|----------|----------------|-------------|
| **DB: `vendor_tiers.payout_period_days`** | Per-tier payout period in days (e.g. 7 = weekly, 14 = biweekly). Default 7. | Admin Tier Management CRUD, tier-system API, vendor dashboard (next payout T+N). |
| **Backend: `admin-advanced.ts`** | CRUD for tiers; reads/writes `payout_period_days`. | Admin UI Tier Management. |
| **Backend: `tier-system.ts`** | GET tier for vendor; returns `payoutPeriodDays`, `payoutCycleLabel`. | Vendor app (earnings/settlement dashboard). |

**Usage today:** Vendor dashboard shows “T+7” (or tier value); tier API returns `payoutPeriodDays`. **Not** used by the settlement **calculation** job (see 2.2).

---

### 2.2 **Platform-wide payout / hold rules (duplicate concept)**

| Location | What it stores | Consumed by |
|----------|----------------|-------------|
| **`platform_settings` key: `admin:settings:payout_rules`** | JSON: `holdPeriodDays`, `minimumPayout`, `autoPayout`, `defaultCommission`. | `settlements.ts`: GET `/settlements/policy`, POST `/settlements/calculate-daily` (cutoff = bookings where `completed_at < now - holdPeriodDays`). |
| **`settlements.ts`** | Defaults: `holdPeriodDays: 7`, `minimumPayout: 1000`, etc. | Policy for vendors; daily settlement run uses **one global** hold period for all vendors. |

**Issue:** Hold period (when earnings become eligible for settlement) is global here and **ignores** `vendor_tiers.payout_period_days`. So “payout period” in tiers is display-only for the actual settlement run.

---

### 2.3 **Settlement schedule settings (duplicate period)**

| Location | What it stores | Consumed by |
|----------|----------------|-------------|
| **Admin UI: `SettlementScheduleSettings.tsx`** | Local state: `settlementPeriodDays` (default 3), `scheduleType`, `scheduleTime`, etc. | UI only; GET `/admin/finance/settlement-schedule` returns **`settlement_schedules`** table (no period_days column). |
| **Backend: GET `/admin/finance/settlement-schedule`** | Reads `settlement_schedules` (columns: `schedule_type`, `day_of_week`, `day_of_month`, `vendor_id`). **No** `settlement_period_days` in DB. | Admin schedule screen; response shape does not match UI’s `settlementPeriodDays`. |
| **Backend: POST `/admin/finance/settlement-schedule`** | **Not implemented** in `admin-advanced.ts`. | UI POSTs settings; endpoint is missing, so “Settlement Period (days)” is never persisted. |
| **`platform_settings` key: `admin:finance:settlement%`** | Schedule JSON (e.g. `scheduleType`, `settlementPeriodDays`) used in GET `/settlements/policy`. | Policy response `settlementSchedule`; fallback uses `rules.holdPeriodDays`. |

**Issue:** “Settlement Period (days)” exists in schedule UI and in policy fallback but is not backed by tier; it overlaps with both payout_rules.holdPeriodDays and tier payout period.

---

### 2.4 **Dynamic settlement rules (per-rule period override)**

| Location | What it stores | Consumed by |
|----------|----------------|-------------|
| **Admin UI: `DynamicSettlementRulesManager.tsx`** | Rule model: `settlement.periodDays`, `settlement.holdPeriodDays`, `minPayoutAmount`, etc. | UI sends rule with `periodDays` to backend. |
| **Backend: `admin-advanced.ts`** | Table `settlement_rules`: `rule_name`, `rule_type`, `conditions`, `actions` (JSON). **No** dedicated `period_days` column; period may be inside `conditions`/`actions`. | GET/POST/PUT/DELETE `/admin/finance/settlement-rules`. |
| **`settlements.ts` (calculate-daily)** | **Does not** read settlement_rules or tier. Uses only `admin:settings:payout_rules.holdPeriodDays`. | Settlement run ignores both rules and tier for cutoff. |

**Issue:** Rules can express “period days” in UI, but the settlement job does not use rules or tier for hold/period; single global hold is used.

---

### 2.5 **Payment gateway / integrations (separate product concept)**

| Location | What it stores | Consumed by |
|----------|----------------|-------------|
| **Admin UI: `PaymentGatewayIntegration.tsx`** (Admin UI + Warmpawz Ecosystem) | `settlement_period_days` (default 3) in payment settings. | Saved/loaded with gateway config (e.g. Razorpay keys). |
| **Backend: `razorpay-settlements.ts`** | Reads `platform_settings` key **`settlement_frequency_days`** (not same key as payout_rules). | Auto settlement job: “settlements created X days ago” for processing. |

**Note:** If `settlement_period_days` in payment gateway means **Razorpay’s** settlement cycle (when they credit the platform), it is a different concept and should be renamed to avoid confusion (e.g. `gateway_settlement_cycle_days`). If it means “our vendor payout period”, it should be removed and replaced by tier.

---

### 2.6 **Vendor app fallbacks (hardcoded tiers)**

| Location | What it stores | Consumed by |
|----------|----------------|-------------|
| **`VendorEarningsSettlementDashboard.tsx`** | Hardcoded fallback tiers with `payoutPeriodDays`: Bronze 7, Silver 14, Gold 7, Platinum 1. | Used when tier API fails; duplicates tier system. |

**Issue:** Duplicate tier definitions; should show “—” or retry instead of hardcoded periods.

---

### 2.7 **Other references (display only)**

- **SettlementsTab.tsx, PayoutManagement.tsx, VendorEarningsPage.tsx, etc.**  
  Display `period`, `period_start`/`period_end`, or `settlement_period_start`/`settlement_period_end` from **settlement records** (output of runs). These are **derived** from the run logic, not configuration. No change needed except that run logic should use tier (see below).

- **Docs:** `ADMIN_FINANCE_TIER_SYSTEM.md`, `ADMIN_FINANCE_SCHEDULE_SETTINGS.md`, `ADMIN_FINANCE_SETTLEMENT_RULES.md`, `policy-docs-content.ts`  
  Describe tier payout period, schedule “Settlement Period (days)”, and rule “period days”. Should be updated to state that **only** tier defines payout/settlement period (with optional rule override if kept).

---

## 3. How the System Is Designed Today (Confirmed)

- **Tier system (Finance & Logistics → Tier Management)**  
  - Holds **payout period (days)** per tier in `vendor_tiers.payout_period_days`.  
  - Used for: vendor-facing “T+N days” and tier API.  
  - **Not** used by the settlement **calculation** job.

- **Settlement calculation (POST `/settlements/calculate-daily`)**  
  - Uses **one** global config: `admin:settings:payout_rules` → `holdPeriodDays`.  
  - Eligibility: bookings with `completed_at < now - holdPeriodDays`.  
  - Does **not** consider vendor tier or settlement_rules for period/hold.

- **Schedule**  
  - When the job runs: `settlement_schedules` and/or `admin:finance:settlement%` (type, day, time).  
  - “Settlement Period (days)” in UI is not consistently stored and overlaps with holdPeriodDays and tier.

- **Settlement rules**  
  - Stored as rules with conditions/actions; UI has `periodDays`.  
  - Not used by the settlement run for period or hold.

So today: **one global hold period** (payout_rules) drives eligibility; **tier payout period** is display-only; schedule and rules contain period-related fields that are either unused or duplicated.

---

## 4. Single Source of Truth – Target Design

### 4.1 Canonical definition (one place)

- **Settlement period / Payout period** = **`vendor_tiers.payout_period_days`** (Finance & Logistics → Tier Management).
  - Meaning: for a vendor on that tier, earnings become eligible for settlement after **T + payout_period_days**, and payouts run on that cycle (e.g. 7 = weekly).
  - All consumers (vendor dashboard, policy, next payout date, and **settlement calculation**) must derive from this (or from a rule override below).

### 4.2 Optional override (if kept)

- **Settlement rules** may **override** period for specific conditions (e.g. category, tier, amount):
  - Default for a vendor = **tier’s `payout_period_days`**.
  - First matching rule (by priority) may set **period_days** (and optionally hold_days) for that vendor/transaction.
- If no rule matches, **tier** is the only source.

### 4.3 What to eliminate or make read-only

| Current location | Action |
|-----------------|--------|
| **`platform_settings` `admin:settings:payout_rules`.holdPeriodDays** | **Eliminate** for period. Use tier (and optional rule) for hold/period. Keep in payout_rules only: `minimumPayout`, `autoPayout`, `defaultCommission` (or move those to a single “payout policy” config). |
| **Schedule Settings UI: “Settlement Period (days)”** | **Remove** or make **read-only** “Default from default tier: N days” (no editable period; schedule only defines when the job runs). |
| **`platform_settings` `admin:finance:settlement%`** (settlementPeriodDays) | **Remove** from config; derive default from default tier when needed for display. |
| **Payment Gateway UI: `settlement_period_days`** | **Rename** to something like “Gateway settlement cycle (days)” if it means Razorpay’s cycle; **remove** if it was meant to be our vendor payout period. |
| **`platform_settings` `settlement_frequency_days`** (razorpay-settlements) | **Clarify** purpose: if “how long after our settlement we process with gateway”, keep but name clearly; if “vendor payout period”, remove and use tier. |
| **VendorEarningsSettlementDashboard hardcoded tiers** | **Remove**; always use tier API; on failure show “—” or retry. |
| **Settlement rules: periodDays** | **Keep** only as optional **override** per rule; default remains tier. Document that tier is source of truth and rules override. |

### 4.4 Implementation summary

1. **Settlement calculation (backend)**  
   - For each vendor, resolve **hold/period** as: (first matching settlement rule with period_days) **or** `vendor_tiers.payout_period_days`.  
   - Use that value for eligibility: include bookings with `completed_at < now - period_days`.  
   - Stop using `admin:settings:payout_rules.holdPeriodDays` for period.

2. **Policy and vendor dashboard**  
   - GET `/settlements/policy`: expose “payout period” from **default tier** (or from vendor’s tier when called in vendor context).  
   - Vendor dashboard: already uses tier API; remove fallback hardcoded tiers; show tier’s `payoutPeriodDays` only.

3. **Admin: Schedule Settings**  
   - Remove editable “Settlement Period (days)” or replace with read-only “Default period: X days (from default tier)”.  
   - Implement or align POST `/admin/finance/settlement-schedule` so it only persists **schedule** (type, day, time, timezone), not period.

4. **Admin: Settlement rules**  
   - Keep `periodDays` (and optional `holdPeriodDays`) as **override** only.  
   - Docs and UI: “Period defaults to vendor’s tier; rule can override for matching conditions.”

5. **Payment gateway**  
   - Rename or remove `settlement_period_days` so it is not confused with vendor payout period.

6. **Docs and policy content**  
   - Update all admin docs and `policy-docs-content.ts` to state: **single source of truth for settlement period and payout period is the tier system** (Finance & Logistics → Tier Management); schedule defines when the job runs; rules can override period for specific conditions.

---

## 5. Summary Table

| Concept | Single source of truth | Eliminate / make read-only |
|--------|------------------------|----------------------------|
| **Payout period (how often a vendor gets paid)** | `vendor_tiers.payout_period_days` (Tier Management) | payout_rules.holdPeriodDays (for period), schedule UI “Settlement Period”, vendor dashboard fallback tiers |
| **Hold period (days after booking before eligible)** | Same: tier’s `payout_period_days`; optional override in settlement rules | payout_rules.holdPeriodDays for eligibility |
| **When the job runs** | Schedule (settlement_schedules or admin:finance schedule config) | — |
| **Min payout, auto process** | One place: e.g. payout_rules or schedule config | Keep single; don’t duplicate in both |
| **Gateway settlement cycle** | If needed: dedicated key, clearly named | Remove/rename payment gateway `settlement_period_days` if it meant vendor period |

---

## 6. Files to Touch (for implementation)

- **Backend:** `backend/lambda/src/endpoints/settlements.ts` (policy + calculate-daily), `backend/lambda/src/endpoints/admin-advanced.ts` (schedule GET/POST if added), `backend/lambda/src/endpoints/razorpay-settlements.ts` (key naming).
- **Admin UI:** `apps/admin-web/components/admin/finance/scheduleSettings/SettlementScheduleSettings.tsx`, `apps/admin-web/components/admin/finance/settlementRules/DynamicSettlementRulesManager.tsx`, payment gateway component(s) using `settlement_period_days`.
- **Vendor UI:** `apps/vendor-web/components/vendor/VendorEarningsSettlementDashboard.tsx` (remove hardcoded tiers).
- **Docs:** `docs/admin/ADMIN_FINANCE_TIER_SYSTEM.md`, `docs/admin/ADMIN_FINANCE_SCHEDULE_SETTINGS.md`, `docs/admin/ADMIN_FINANCE_SETTLEMENT_RULES.md`, `apps/admin-web/lib/policy-docs-content.ts`.
- **Duplicate UIs:** Same concepts in `Admin UI/`, `Warmpawz Ecosystem Development/` (schedule, gateway, tier) – align with single source of truth and removals above.

---

## 7. Implementation Status (2026-02-05)

| Change | Status |
|--------|--------|
| **Settlement calculation** uses `vendor_tiers.payout_period_days` per vendor (join vendors + vendor_tiers; eligibility by tier period) | Done – `backend/lambda/src/endpoints/settlements.ts` |
| **GET /settlements/policy** exposes hold/payout period from default tier only | Done – same file |
| **GET/POST /admin/finance/settlement-schedule** returns/accepts settings; period read-only from default tier; POST does not persist period | Done – `admin-advanced.ts` |
| **Schedule Settings UI** – Settlement Period (days) read-only with note “From default tier” | Done – `SettlementScheduleSettings.tsx` |
| **Vendor dashboard** – removed hardcoded fallback tiers; show message or single tier from API when allTiers empty | Done – `VendorEarningsSettlementDashboard.tsx` |
| **Payment gateway** – label “Gateway settlement cycle (days)” and note that vendor period is in Tier Management | Done – Admin UI and Warmpawz PaymentGatewayIntegration |
| **Settlement rules** – GET normalizes `actions.settlement`; POST/PUT accept `settlement` and store in `actions`; UI label “override” and tier default note | Done – `admin-advanced.ts`, `DynamicSettlementRulesManager.tsx` |
| **Razorpay settlement job** – comment that vendor period is in tier; `settlement_frequency_days` = gateway timing | Done – `razorpay-settlements.ts` |

---

## 8. Validation – Wiring Across Vendor Web and Customer Web

### Backend (single source of truth)

| Endpoint | Source of period | Consumed by |
|----------|------------------|-------------|
| `GET /settlements/policy` | Default tier `vendor_tiers.payout_period_days` | Vendor web: VendorBookingManagement (payout schedule text) |
| `GET /vendor/:vendorId/policies` | Vendor’s tier `vendor_tiers.payout_period_days` (join on `v.tier = vt.tier_name`) | Vendor web: VendorPolicyManagement (hold period days) |
| `GET /vendor/:vendorId/tier` | `vendor_tiers` (all fields including `payout_period_days`) | Vendor web: VendorEarningsSettlementDashboard, VendorEarningsPage, VendorCapabilityDashboard |
| `POST /settlements/calculate-daily` | Per-booking eligibility: `vendor_tiers.payout_period_days` via join | Internal (cron/job) |

### Vendor web wiring

| Component | What it uses | Wired correctly |
|-----------|--------------|------------------|
| **VendorEarningsSettlementDashboard** | `GET /vendor/:id/tier` → `tierInfo.payoutPeriodDays`, `payoutCycleLabel` | Yes – tier API is single source |
| **VendorEarningsPage** | `GET /vendor/:id/tier` and `/vendor/:id/settlements` | Yes |
| **VendorCapabilityDashboard** | `GET /vendor/:id/tier` and settlements | Yes |
| **VendorPolicyManagement** | `GET /vendor/:id/policies` → `policies.payout.holdPeriodDays` | Yes – backend now uses tier for `holdPeriodDays` |
| **VendorBookingManagement** | `GET /settlements/policy` → `policy.description` (and fallbacks) for payout schedule text | Yes – uses `policy.policy.description` / `policy.holdPeriodDays` |

### Customer web

- No vendor settlement period or payout period configuration is used.
- “Tier” and “settlement” in customer-web refer to customer loyalty/rewards and error messaging only. No wiring changes.

### Post-validation fixes applied

1. **vendor-policies.ts** – `GET /vendor/:vendorId/policies` now sets `payout.holdPeriodDays` from the vendor’s tier (`vendor_tiers.payout_period_days`) instead of `payout_policies.hold_period_days`.
2. **VendorBookingManagement.tsx** – Payout schedule text now uses `policyData.policy.description` (and `holdPeriodDays`/`payoutPeriodDays` as fallback) so it matches the new `GET /settlements/policy` response shape.
3. **settlements.ts – POST /settlements/calculate-daily:** Removed `penalty_deductions` and `metadata` from the settlements insert (columns may not exist in base schema); penalty is applied to `net_amount`. Bookings update sets only `settled_at` (no `settlement_status` on bookings in base schema).

---

## 9. Edge Cases – Bank Accounts and New Vendor Onboarding

### Changing bank account number

- **Update same record (e.g. typo fix):** If the vendor “edits” an existing account and changes the account number, the backend treats it as a **new** account (insert) because lookup is by `(vendor_id, account_number)`. The old row remains (possibly still primary and verified). Payouts continue to the old account until the vendor verifies the new account and sets it as primary.
- **Explicit update of existing row:** When the same `(vendor_id, account_number)` is resubmitted (e.g. only holder name changed), the row is updated and `verification_status` is set to `pending` / `is_verified = false`, so the account must be re-verified before it is used for payouts.
- **Primary:** Payouts use the **primary** verified account (`ORDER BY is_primary DESC`). Vendors must use “Set as primary” after verifying a new account if they want payouts to go there.

### New vendor onboarding – add and verify account

- **First account:** When a vendor adds their first bank account, it is stored with `vendor_id = actualVendorId` (resolved from identity/phone so the row is linked to `vendors.id`). The first account is set `is_primary = true`.
- **Verification:** After successful verification (Razorpay when configured), `is_verified = true` and `vendors.bank_verified = true` are set, making the vendor eligible for automatic payouts on the next settlement run.
- **VendorId resolution:** Verify, set-primary, and delete handlers now resolve `vendorId` from the URL (which may be identity id) to `vendors.id` before querying `vendor_bank_accounts`, so these actions work when the frontend uses identity id but accounts are stored under `vendors.id`.

---

*Report generated from codebase analysis. Single source of truth and elimination list in §4 and §5; implementation completed as in §7; validation and wiring in §8; edge cases in §9.*
