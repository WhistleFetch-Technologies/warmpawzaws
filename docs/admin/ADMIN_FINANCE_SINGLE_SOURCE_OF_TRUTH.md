# Finance: Single Source of Truth – Settlement & Payout Period

**Settlement period** and **payout period** have one canonical definition in this system.

## Single source of truth

| Concept | Where it is defined | Screen |
|--------|----------------------|--------|
| **Payout period (days)** | `vendor_tiers.payout_period_days` | **Finance & Logistics → Tier Management** |
| **Settlement period** | Same as payout period (T + N days per tier) | Same: Tier Management |

- Each **tier** has one **Payout Period (days)** (e.g. 7 = weekly, 14 = biweekly).
- That value drives both “how often this tier gets paid” and “how many days after booking earnings become eligible for settlement” (unless a Settlement Rule overrides for specific conditions).
- **Schedule Settings** define only **when** the settlement job runs (day, time, timezone), not the period length.
- **Settlement Rules** may **override** period only for specific conditions (tier, category, etc.); the default is always the vendor’s tier.

## What to avoid

- Do **not** add or edit “Settlement Period (days)” or “Payout period” in Schedule Settings, Payment Gateway, or any screen other than Tier Management (except Settlement Rules as an explicit override).
- Do **not** duplicate tier payout periods in vendor app fallbacks; always use the tier API.

## Full report

For the full list of current definitions, usage, and elimination list, see:

**`reports/SETTLEMENT_PAYOUT_SINGLE_SOURCE_OF_TRUTH_REPORT.md`**
