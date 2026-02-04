# Refund Tier – Target State (Who Cancels + Condition)

## Business rule
- **Customer/Pet Parent cancels:** Refund depends on **when** they cancel (time windows). Time-slot options apply only for customer cancellation.
- **Vendor/Provider cancels:** Full refund or reschedule regardless of time. Policy is by **reason** (emergency, operational, technical).

## UI structure

1. **Who cancels** – dropdown (unchanged):
   - Pet Parent / Customer
   - Service Provider / Platform

2. **Condition** – second dropdown, **depends on “Who cancels”**:
   - **When “Pet Parent / Customer” selected:** “Cancellation window” with time slots (includes 6+ hours):
     - 24+ hours
     - 12-24 hours
     - <12 hours / no show / after arrival
     - 12+ hours
     - **6+ hours**
     - 6-12 hours
     - <6 hours / no show
     - 48+ hours
     - 24-48 hours
     - <24 hours / no show
     - after check-in / early checkout
     - did not join the video
   - **When “Service Provider / Platform” selected:** “Vendor cancellation reason” with options 12–14:
     - emergency cancellation
     - operational issue
     - technical failure

3. **Hours before service:** Removed as a free-text number. For customer tiers, effective hours are derived from the selected **cancellation window** (e.g. 24+ → 24, 12–24 → 12) for backend matching.

## DB

- `cancellation_window` TEXT – for customer tiers: one of 11 slugs (24_plus, 12_24, under_12_no_show, …).
- `vendor_cancellation_reason` TEXT – for provider tiers: one of emergency, operational, technical.
- `hours_before_service` – kept for backward compatibility; for customer tiers it is set from the window (e.g. 24_plus → 24).

## Policy engine

- **Customer cancel:** Compute hours until booking (and flags: no_show, service_started, is_tele). Determine which **window** applies; find tier with that `cancellation_window` + `cancelled_by = pet_parent`.
- **Vendor cancel:** Find tier with `cancelled_by = provider` and optional `vendor_cancellation_reason` (or any provider tier = full refund).

---

## Flexible rules (operator + threshold) – how easy/hard

**Goal:** Let admins define rules like “greater than X hours”, “X+ hours”, “below X hours” instead of only preset windows.

### Option A – Optional custom rule per tier (easy–medium)

- **DB:** Add optional columns to `vendor_refund_tiers`:
  - `hours_operator` TEXT: `'gte'` | `'lte'` | `'gt'` | `'lt'` (≥, ≤, >, <)
  - `hours_threshold` NUMERIC: e.g. 24
- **Matching:** When both are set, tier applies when `hoursUntilBooking` satisfies the operator (e.g. `gte` + 24 → “24+ hours”). When not set, keep using `cancellation_window` slug (current behaviour).
- **UI:** Either keep “Preset” dropdown as today, or add “Custom rule” section: operator dropdown (≥, >, ≤, <) + “Hours” number input. One tier = one rule.
- **Effort:** One small migration, ~20 lines in policy engine, optional UI block. **Easy.**

### Option B – Predefined windows only (current)

- No new columns. All options are fixed labels (24+ hours, 6+ hours, etc.). Adding a new window = code change + deploy.
- **Effort:** None. **Easiest.** (6+ hours added as new preset.)

### Option C – Admin-defined “cancellation windows” table (harder)

- New table e.g. `refund_cancellation_windows`: id, name, min_hours, max_hours, display_order. Admin CRUD; UI loads options from API.
- Policy engine matches by “which window does hoursUntilBooking fall into?” using min/max.
- **Effort:** Migration, CRUD API, UI to manage windows, policy engine change. **Medium.**

**Recommendation:** Use **Option A** if you want flexible “≥ X” / “< X” without new tables. Use **Option B** (current + 6+ hours) if presets are enough. Use **Option C** only if you need fully dynamic, admin-defined windows.
