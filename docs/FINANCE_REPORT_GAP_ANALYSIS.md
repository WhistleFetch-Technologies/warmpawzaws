# Finance Report Gap Analysis — Settlement Breakdown

**Phase:** Analysis Only  
**Date:** 2026-07-06  
**Context:** Finance S2 persists settlement snapshots; reporting layer has not caught up.

---

## Executive Gap Summary

| Area | Status | Gap severity |
|------|--------|--------------|
| Settlement snapshot persistence | ✅ Done (S2) | — |
| Snapshot exposed in admin reports | ❌ Missing | **Critical** |
| Funding type / winning offer in UI | ❌ Missing | **High** |
| Commission base vs vendor gross distinction | ❌ Missing | **High** |
| Booking → settlement → payout linkage in reports | ❌ Missing | **Medium** |
| Accrual report funding aggregates | ❌ Missing | **Low–Medium** |
| Excel export | ❌ Missing | **Low** (CSV sufficient initially) |
| Pagination on large reports | ❌ Missing | **Medium** (pre-existing) |
| Dedicated settlement breakdown page | ❌ Not needed | — |

---

## Report-by-Report Gap Matrix

### Daily Accrual

| Dimension | Current | Gap | Priority |
|-----------|---------|-----|----------|
| Purpose alignment | Vendor IST-day rollup | None | — |
| Commission base visibility | Absent | Cannot verify promo impact at day level | P3 |
| Platform vs vendor discount | Absent | No aggregate funding KPI | P3 |
| Settlement batch status | Absent | Not in scope for daily | — |
| Drill-down | None | No path to booking except manual tab switch | P4 |
| Export completeness | Bank + amounts | Adequate for payment prep | — |
| Performance | N+1 fee enrichment | Pre-existing | P2 |
| Pagination | None | All vendors one shot | P2 |

### Monthly Accrual

| Dimension | Current | Gap | Priority |
|-----------|---------|-----|----------|
| Month-end reconciliation | Vendor totals + bank | Cannot explain commission base shifts | P3 |
| Platform discount total | Absent | Accounts cannot see promo cost | P3 |
| Booking-level backup export | Separate manual step | No “reconciliation pack” | P2 |
| Days column | Present | Good coverage indicator | — |
| Compute time | Up to 31 daily upserts | Slow for large months | P2 |

### Booking Earnings

| Dimension | Current | Gap | Priority |
|-----------|---------|-----|----------|
| Audit suitability | Partial | Missing settlement breakdown | **P1** |
| Discount split | Single `discount_amount` | No platform/vendor split | **P1** |
| Commission base | Uses vendor gross implicitly | Wrong when platform-funded promo | **P1** |
| Winning offer | Absent | Cannot answer “which promo applied?” | **P1** |
| Metadata read | SQL ignores `ve.metadata` | Data exists but unused | **P1** |
| Settlement/payout IDs | Absent in UI/CSV | Broken audit trail | P2 |
| Expanded panel | Customer waterfall only | No funding section | **P1** |
| Legacy bookings | No indicator | Users assume snapshot exists | P2 |

### Settlement Dashboard

| Dimension | Current | Gap | Priority |
|-----------|---------|-----|----------|
| Batch totals | Present | Adequate | — |
| Booking breakdown | Via `GET /settlements/:id` | Amounts only, no funding | P3 |
| Export | Minimal client CSV | Not used by Accounts | — |
| List cap | LIMIT 100 | May truncate | P3 |
| Link to audit report | Absent | Manual booking lookup | P4 |

### Payout Management

| Dimension | Current | Gap | Priority |
|-----------|---------|-----|----------|
| Payment execution | Present | Adequate | — |
| Source settlement IDs | Partial in API | Not in export | P3 |
| Line-item breakdown | Absent | Expected — use Booking Earnings | — |
| Pagination | LIMIT 50 | May truncate | P3 |

---

## Metadata Field Coverage

### Available in `SettlementSnapshot` / `vendor_earnings.metadata`

| Field | Persisted | In Daily Accrual | In Monthly | In Booking UI | In Booking CSV |
|-------|-----------|------------------|------------|---------------|----------------|
| vendorBasePrice | ✅ | ❌ | ❌ | ≈ service base | partial |
| commissionBase | ✅ | ❌ | ❌ | ❌ | ❌ |
| commissionRate | ✅ | agg only | agg only | ✅ | ✅ |
| commissionAmount | ✅ | ✅ | ✅ | ✅ | ✅ |
| vendorSettlement | ✅ | ≈ net | ≈ net | ≈ vendor net | ✅ |
| platformCost / vendorCost | ✅ | ❌ | ❌ | ❌ | ❌ |
| winningOffer | ✅ | ❌ | ❌ | ❌ | ❌ |
| fundingSummary | ✅ | ❌ | ❌ | ❌ | ❌ |
| commissionPolicy (tier) | ✅ | ❌ | ❌ | ❌ | ❌ |
| policyFingerprint | ✅ | ❌ | ❌ | ❌ | ❌ |
| settlement_id | ✅ column | ❌ | ❌ | ❌ | ❌ |
| payout_id | ✅ column | ❌ | ❌ | ❌ | ❌ |

### Available in `wp_financial_meta` but not ledger

Pre-S2 bookings may have checkout meta without `vendor_earnings.metadata` — reports should fallback-read booking notes.

### Missing from persistence (not a reporting gap alone)

| Field | Notes |
|-------|-------|
| Human-readable promo name in all paths | Sometimes in `winningOffer.offerName` |
| Settlement preview at checkout | Not persisted until completion — intentional |
| Real-time batch preview at checkout | Out of report scope |

---

## Functional Gaps (Cross-Cutting)

### G1 — Report layer ignores Finance S2 ledger metadata

**Impact:** Accounts sees commission on vendor gross even when platform promo means commission base should be full vendor price.

**Fix direction:** Read `vendor_earnings.metadata` in `vendor-booking-earnings-report.ts` — no recompute.

### G2 — Undifferentiated discount column

**Impact:** Cannot reconcile platform promo cost vs vendor-funded discounts.

**Fix direction:** Split columns in UI + CSV from `fundingSummary` or `platformCost`/`vendorCost`.

### G3 — No audit trail from booking to payout in exports

**Impact:** Accounts must cross-reference three tabs manually.

**Fix direction:** Add `settlement_id`, `payout_id`, status joins to booking export.

### G4 — Accrual vs audit boundary blurred

**Impact:** Risk of over-loading accrual reports with booking columns.

**Fix direction:** Keep accrual lean; deep link to Booking Earnings.

### G5 — Pre-existing performance gaps

**Impact:** Adding metadata parse without pagination worsens large-day loads.

**Fix direction:** Include metadata in main SQL; consider lazy parse on expand if >500 bookings; add pagination in separate initiative.

### G6 — Legacy vs S2 bookings indistinguishable

**Impact:** Finance assumes breakdown exists; empty panel causes confusion.

**Fix direction:** `settlement_data_source` badge: “Snapshot available” / “Legacy — waterfall only”.

### G7 — Client-side settlement/payout CSVs incomplete

**Impact:** Low — Accounts uses server accrual exports.

**Fix direction:** Low priority; add IDs when touching those components.

---

## Performance Impact Estimate (Adding Settlement Data)

| Change | Query impact | Mitigation |
|--------|--------------|------------|
| SELECT `ve.metadata` on booking earnings | +JSONB column in existing query | Low — no extra round trip |
| Parse JSON per row (500 bookings) | ~500 parses in Lambda | Acceptable; lazy parse on expand if needed |
| JOIN settlements for status | +1 LEFT JOIN | Low |
| Accrual funding KPI SUM | +1 aggregate query per load | Low |
| Add 15 CSV columns | Wider file, same row count | Negligible |
| Expand UI panel | Client render only | Negligible |

**Avoid:** Per-booking breakdown API calls on expand (N+1 HTTP).

**Avoid:** Re-running `compute-funding-aware-settlement` in report path.

---

## Final Recommendations

### Daily Accrual — **Keep as-is** (extend lightly)

| Action | Reasoning |
|--------|-----------|
| **Keep** vendor table structure | Correct granularity for daily ops |
| **Extend** optional KPI cards: platform discount total, vendor discount total | High-level promo cost without row noise |
| **Extend** deep link to Booking Earnings | Dispute path without duplicating data |
| **Do not** add settlement columns to CSV | Wrong grain; bloats payment file |

### Monthly Accrual — **Extend** (KPI + workflow)

| Action | Reasoning |
|--------|-----------|
| **Keep** vendor aggregation + bank export | Accounts payment file |
| **Extend** same funding KPI cards as daily | Month-end promo cost review |
| **Extend** “Download reconciliation pack” (accrual + booking detail CSV) | Single workflow for Accounts |
| **Do not** merge booking rows into accrual export | Different row counts and purposes |

### Booking Earnings — **Extend** → primary audit report

| Action | Reasoning |
|--------|-----------|
| **Extend** expanded row with Settlement Breakdown section | Data already persisted; natural drill-down exists |
| **Extend** booking CSV with settlement detail mode | Makes exports self-explanatory |
| **Extend** settlement/payout linkage columns | Complete audit trail |
| **Optional** drawer for print/copy | Overflow UX |
| **Do not** redesign entire report | Existing two-level drill-down is sound |

### Settlement Dashboard — **Keep as-is** (minor extend)

| Action | Reasoning |
|--------|-----------|
| **Keep** batch-focused operations | Not an audit surface |
| **Extend** detail view with link to Booking Earnings | Avoid duplicate breakdown |
| **Do not** add funding columns to table | Wrong abstraction level |

### Payout Management — **Keep as-is**

| Action | Reasoning |
|--------|-----------|
| **Keep** payment execution focus | Accounts already has amounts |
| **Extend** settlement ID list in modal/export | Traceability only |

### Settlement Breakdown UX — **Combination**

| Pattern | Use |
|---------|-----|
| **Expandable row** | Primary — Booking Earnings booking drill-down |
| **Additional CSV columns** | Primary — Accounts audit file |
| **Drawer** | Secondary — full detail / copy |
| **KPI cards** | Secondary — Daily/Monthly aggregates |
| **Separate page** | **Not recommended** |
| **Deep links** | Accrual → Booking Earnings |

---

## Success Criteria (When Implemented)

Accounts can answer from **one booking export row** without asking Finance:

1. What did the customer pay?
2. What discount applied and who paid for it?
3. What was the commission calculated on?
4. What does the vendor receive?
5. Has this been settled and paid out?

---

## Related Documentation

| Document | Contents |
|----------|----------|
| `docs/FINANCE_REPORTING_CURRENT_STATE.md` | Inventory of reports, APIs, tables |
| `docs/FINANCE_REPORTING_UX_ANALYSIS.md` | UX patterns, wireframes, persona workflows |
| `docs/SETTLEMENT_REPORTING_REUSE_PLAN.md` | API extension, reuse map, no-duplicate rules |
| `docs/FINANCE_EXPORT_ANALYSIS.md` | CSV columns, Accounts workflow, mandatory fields |
| `docs/FINANCE_SETTLEMENT_INTEGRATION_IMPLEMENTATION.md` | S2 snapshot schema reference |

---

## Out of Scope (This Analysis)

- Implementation / code changes
- Prod migration
- Excel export build
- Pagination refactor
- Vendor-facing earnings report changes
- E-commerce finance reports (`SettlementsDashboard.tsx` in e-commerce module)
