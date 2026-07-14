# Warmpawz Settlement System — Reuse Map

**Phase:** 7 Discovery  
**Date:** 2026-07-03  
**Companion:** `docs/SETTLEMENT_CURRENT_STATE.md`

This document maps existing settlement-related components to Phase 7 reuse decisions. Priority: **P0** = required for Phase 7, **P1** = should extend, **P2** = later / optional.

---

## Legend

| Can Reuse | Meaning |
|-----------|---------|
| **Yes** | Use as-is in Phase 7 integration |
| **Extend** | Keep; add fields/hooks/metadata |
| **Shadow** | Run alongside for compare only |
| **No** | Do not use; legacy or duplicate |
| **Replace** | Not recommended — high risk |

---

## Backend — Accrual & Ledger

| Existing Component | Path | Purpose | Current Usage | Can Reuse | Needs Extension | Replacement Required | Priority |
|--------------------|------|---------|---------------|-----------|-----------------|----------------------|----------|
| `vendor_earnings` table | `db/migrations/535_*.sql` | Per-booking vendor ledger | Service + package sessions | **Yes** | Add promo funding metadata / audit JSON | No | **P0** |
| `delivery_settlements` table | `db/migrations/200_*.sql`, `750_*.sql` | Meal/pharmacy vendor lines | On meal/pharmacy deliver | **Yes** | Promo funding breakup in row metadata | No | **P0** |
| `ensureVendorEarningsForCompletedBooking` | `utils/vendor-earnings-on-completion.ts` | Create earnings on booking complete | All completion paths | **Extend** | Read settlement preview for commission base adjustment | No | **P0** |
| `resolveLedgerGrossForVendorCommission` | same | Commission gross base | Tier commission calc | **Extend** | Apply vendor-funded promo reduction when authoritative | No | **P0** |
| `accrueVendorEarningsForPackageSessionChild` | `utils/package-session-sync.ts` | Package session slice earnings | Child session complete | **Extend** | Same funding split as service | No | **P1** |
| `ensureMealOrderSettlementOnDelivered` | `utils/meal-order-settlement.ts` | Meal delivery_settlements | Deliver webhook | **Extend** | Promo impact on vendor subtotal | No | **P0** |
| `computeMealVendorSettlementAmounts` | same | Meal commission math | Settlement insert | **Extend** | Funding-aware net | No | **P0** |
| `createSettlementRecord` (pharmacy) | `endpoints/orders/endpoint/pharmacy-orders.ts` | Pharmacy delivery_settlements | Pharmacy deliver | **Extend** | Align with meal funding model | No | **P1** |
| `vendor_settlements` table | `db/migrations/057_*.sql` | Legacy vendor settlement | Unclear / alternate | **No** | — | Avoid | P2 |
| `general_ledger` / COA | `db/migrations/007_*.sql` | Double-entry | Partial / future | **Extend** | Post settlement engine entries Phase 7+ | No | P2 |

---

## Backend — Batch, Payout & Jobs

| Existing Component | Path | Purpose | Current Usage | Can Reuse | Needs Extension | Replacement Required | Priority |
|--------------------|------|---------|---------------|-----------|-----------------|----------------------|----------|
| `settlements.ts` router | `endpoints/settlement&payouts/endpoints/settlements.ts` | Batch calc, payout, bank | Production | **Yes** | Optional: include promo audit in breakup JSON | No | **P0** |
| `POST /settlements/calculate-daily` | same | Daily batch | EventBridge cron | **Yes** | None for Phase 7 core | No | **P0** |
| `settlement-processor.ts` | `jobs/settlement-processor.ts` | SQS per-booking processor | CDK Lambda | **Yes** | Pass through funding metadata | No | **P1** |
| `settlement-schedule-eventbridge.ts` | `utils/settlement-schedule-eventbridge.ts` | Cron sync | Admin schedule settings | **Yes** | — | No | P1 |
| `PayoutStatusSyncService` | `utils/payments/payout-status-sync-service.ts` | Razorpay UTR sync | Payout lifecycle | **Yes** | — | No | P1 |
| `payouts` / `pending_payouts` tables | `db/migrations/001_*.sql`, `028_*.sql` | Payout records | Razorpay X | **Yes** | — | No | **P0** |
| `razorpay-settlements.ts` | `endpoints/razorpay-settlements.ts` | Linked accounts, auto-process | Vendor onboarding | **Yes** | — | No | P1 |
| `MIN_VENDOR_PAYOUT_REQUEST_AMOUNT_INR` | `lib/constants/vendor-payout.ts` | ₹5000 floor | Payout request | **Yes** | — | No | P1 |

---

## Backend — Commission & Fees

| Existing Component | Path | Purpose | Current Usage | Can Reuse | Needs Extension | Replacement Required | Priority |
|--------------------|------|---------|---------------|-----------|-----------------|----------------------|----------|
| `getVendorCommissionRate` | `utils/vendor-commission-rate.ts` | Service tier rate | Bookings, packages | **Yes** | — | No | **P0** |
| `getSellerCommissionRate` | `utils/seller-commission-rate.ts` | E-commerce seller rate | Seller orders | **Yes** | Funding-aware order net | No | **P1** |
| `calculateFinalFees` | `utils/feeCalculator.ts` | Platform/convenience/delivery | Checkout | **Yes** | Do not duplicate in discount-engine | No | **P0** |
| `fee-config.ts` | `endpoints/fee-config.ts` | Public fee API | Customer checkout UI | **Yes** | — | No | P1 |
| `ecommerce_commission_settings` | `db/migrations/029_*.sql` | Seller commission config | Admin ecommerce | **Yes** | — | No | P1 |
| `commission_tiers` | `db/migrations/100_*.sql` | E-commerce tiers | Seller rate lookup | **Yes** | — | No | P1 |
| `DEFAULT_COMMISSION_RATE` | `lib/constants/commission.ts` | Reference rates | Razorpay paths | **Yes** | — | No | P2 |

---

## Backend — Refunds, Tax & Reporting

| Existing Component | Path | Purpose | Current Usage | Can Reuse | Needs Extension | Replacement Required | Priority |
|--------------------|------|---------|---------------|-----------|-----------------|----------------------|----------|
| `loadRefundablePaidBreakdown` | `lib/services/refundable-base.ts` | Refund base math | Cancel/refund tiers | **Yes** | Promo-aware refundable base | No | **P1** |
| `refunds.ts` | `endpoints/refunds.ts` | Refund create/approve | Admin + customer | **Yes** | Settlement reversal hooks | No | P1 |
| `reverse_vendor_earnings` RPC | `db/migrations/009_*.sql` | Earnings reversal | Refund/cancel | **Yes** | — | No | P1 |
| `vendor-accrual-fee-breakdown.ts` | `utils/vendor-accrual-fee-breakdown.ts` | IST fee/GST breakdown | Daily accrual | **Extend** | Promo funding columns in report | No | **P1** |
| `vendor-booking-earnings-report.ts` | `utils/vendor-booking-earnings-report.ts` | Booking waterfall CSV | Admin report | **Extend** | Discount/funding columns | No | **P1** |
| `admin-vendor-daily-accrual.ts` | `endpoints/admin/endpoints/admin-vendor-daily-accrual.ts` | Accrual API | Admin finance | **Yes** | Optional promo aggregates | No | P1 |
| `platform-tax-issue.service.ts` | `lib/platform-tax/platform-tax-issue.service.ts` | Tax document issuance | Seller invoices | **Yes** | — | No | P2 |
| `meal-refund-cases.ts` | `utils/meal-refund-cases.ts` | Meal refund workflow | Meal orders | **Yes** | Settlement reversal alignment | No | P1 |

---

## Backend — Discount Engine (Phase 7 target)

| Existing Component | Path | Purpose | Current Usage | Can Reuse | Needs Extension | Replacement Required | Priority |
|--------------------|------|---------|---------------|-----------|-----------------|----------------------|----------|
| `SettlementEngine` interface | `discount-engine/contracts/settlement-engine.ts` | Phase 7 contract | **Stub only** | **Extend** | **Implement compute()** | No | **P0** |
| `DiscountSettlementPreview` | `discount-engine/models/discount-result.ts` | Output shape | Never populated | **Yes** | Populate from engine | No | **P0** |
| `DiscountFunding` enum | `discount-engine/enums/discount-funding.ts` | PLATFORM/VENDOR/SHARED | Stack metadata | **Yes** | Drive split math | No | **P0** |
| `FundingConfiguration` | `discount-engine/config/funding-config-loader.ts` | Shared split % | Stack vetoes only | **Extend** | Settlement split rules | No | **P0** |
| `AppliedDiscount.funding` | `discount-engine/models/discount-result.ts` | Per-discount funding | Resolver output | **Yes** | Input to SettlementEngine | No | **P0** |
| Unified resolver | `discount-engine/resolver/unified-discount-resolver.ts` | Orchestration | Diagnostic pipeline | **Extend** | Invoke SettlementEngine after Stack | No | **P0** |
| Stack Engine applied steps | `discount-engine/stack/` | Ordered discounts + funding | Phase 6 | **Yes** | Primary input to settlement | No | **P0** |
| `invokeResolverAlongsideLegacy` | `resolver/production-bridge.ts` | Shadow diagnostics | Production | **Extend** | Log settlement preview | No | **P0** |

---

## Backend — APIs (consumers unchanged)

| Existing Component | Path | Purpose | Current Usage | Can Reuse | Needs Extension | Replacement Required | Priority |
|--------------------|------|---------|---------------|-----------|-----------------|----------------------|----------|
| `vendor-dashboard-enhanced.ts` | `endpoints/vendor/endpoints/vendor-dashboard-enhanced.ts` | Vendor earnings/settlements API | Vendor dashboard | **Yes** | Expose funding breakup in breakup modal | No | P1 |
| `admin-advanced.ts` finance routes | `endpoints/admin/endpoints/admin-advanced.ts` | Admin finance hub APIs | Admin UI | **Yes** | — | No | P0 |
| `admin-comprehensive.ts` | `endpoints/admin/endpoints/admin-comprehensive.ts` | Settlement stats | Admin KPIs | **Yes** | — | No | P1 |
| `ecommerce.ts` commission + analytics | `endpoints/ecommerce/endpoints/ecommerce.ts` | Seller stats | Admin/vendor seller | **Extend** | Settlement detail parity | No | P1 |
| `payments-enhanced.ts` | `endpoints/payments-enhanced.ts` | Payment capture | All checkout | **Yes** | Attach settlement preview metadata (optional) | No | P2 |

---

## Admin UI

| Existing Component | Path | Purpose | Current Usage | Can Reuse | Needs Extension | Replacement Required | Priority |
|--------------------|------|---------|---------------|-----------|-----------------|----------------------|----------|
| `/finance` hub | `apps/admin-web/app/finance/page.tsx` | Finance operations | Production | **Yes** | Optional promo funding report tab | No | P1 |
| `SettlementDashboard` | `components/admin/finance/settlements/SettlementDashboard.tsx` | Settlement list/KPIs | Admin | **Yes** | Funding column in table | No | P1 |
| `PayoutManagement` | `components/admin/finance/payoutManagement/` | Payout queue | Admin | **Yes** | — | No | P0 |
| `VendorDailyAccrualReport` | `components/admin/finance/VendorDailyAccrualReport.tsx` | IST accrual | Admin | **Extend** | Promo funding columns | No | P1 |
| `VendorBookingEarningsReport` | `components/admin/finance/VendorBookingEarningsReport.tsx` | Booking waterfall | Admin | **Extend** | Discount funding per row | No | P1 |
| `TierManagement` | `components/admin/finance/tierManagement/` | Commission tiers | Admin | **Yes** | — | No | P1 |
| `DynamicSettlementRulesManager` | `components/admin/finance/settlementRules/` | Settlement rules | Admin | **Yes** | — | No | P2 |
| `FeeConfigurationManager` | `components/admin/finance/FeeConfigurationManager.tsx` | Fee config | Admin | **Yes** | Do not duplicate | No | P0 |
| `SettlementsDashboard` (ecommerce) | `components/admin/ecommerce/settlements/` | E-commerce settlements | **Orphan — not mounted** | **No** | Wire or delete later | No | P2 |
| `FinanceManagement.tsx` | `components/admin/finance/FinanceManagement.tsx` | Legacy finance tabs | **Orphan** | **No** | — | No | P2 |
| `/settlements` standalone page | `apps/admin-web/app/settlements/page.tsx` | Ops bulk process | Admin | **Yes** | — | No | P1 |

---

## Vendor UI

| Existing Component | Path | Purpose | Current Usage | Can Reuse | Needs Extension | Replacement Required | Priority |
|--------------------|------|---------|---------------|-----------|-----------------|----------------------|----------|
| `VendorEarningsSettlementDashboard` | `apps/vendor-web/components/vendor/VendorEarningsSettlementDashboard.tsx` | Service vendor finance | `/earnings`, `/finance/settlements` | **Yes** | Promo funding in breakup | No | P1 |
| `VendorCapabilityDashboard` earnings section | `components/vendor/VendorCapabilityDashboard.tsx` | Embedded KPIs | Capability shell | **Yes** | — | No | P1 |
| `VendorWalletDashboard` | `components/vendor/VendorWalletDashboard.tsx` | Loyalty wallet | `/finance/wallet` | **Yes** | Not settlement — keep separate | No | P2 |
| `SellerHub` | `apps/vendor-web/components/vendor/seller/SellerHub.tsx` | E-commerce seller | `/seller` | **Yes** | Funding-aware commission display | No | P1 |
| `CommissionCalculator` | `components/vendor/seller/CommissionCalculator.tsx` | Seller commission sim | Seller tab | **Extend** | Promo scenarios | No | P2 |
| `PlatformCommissionInvoices` | `components/vendor/seller/PlatformCommissionInvoices.tsx` | Tax docs | Seller invoices | **Yes** | — | No | P2 |
| `VendorEarningsPage.tsx` | `components/vendor/VendorEarningsPage.tsx` | Alternate earnings UI | **Orphan** | **No** | — | No | P2 |
| `load-vendor-earnings-summary.ts` | `apps/vendor-web/lib/load-vendor-earnings-summary.ts` | Earnings API client | Dashboard | **Yes** | — | No | P1 |

---

## Customer UI

| Existing Component | Path | Purpose | Current Usage | Can Reuse | Needs Extension | Replacement Required | Priority |
|--------------------|------|---------|---------------|-----------|-----------------|----------------------|----------|
| `CustomerWallet` | `apps/customer-web/components/customer/CustomerWallet.tsx` | Spend balance | `/wallet` | **Yes** | Not settlement | No | — |
| `booking-financial.ts` | `apps/customer-web/lib/pricing/booking-financial.ts` | Booking price display | Customer booking detail | **Yes** | Show settlement preview N/A to customer | No | P2 |
| `SettlementError.tsx` | `components/errors/SettlementError.tsx` | Error display | Payout failures | **Yes** | — | No | P2 |

---

## Database — Extension Targets (Phase 7 migrations)

| Table / column target | Suggested extension | Priority |
|-----------------------|---------------------|----------|
| `vendor_earnings.metadata` or new JSONB column | `settlement_preview`, `promo_funding_split` | **P0** |
| `delivery_settlements` breakup / metadata | Promo funding lines | **P0** |
| `settlements.breakup` JSON | Aggregate funding summary | P1 |
| `payments.metadata` | Optional resolver settlement fingerprint | P2 |
| New `settlement_audit` table (optional) | Immutable discount-engine settlement log | P1 |

---

## Duplicate / Legacy — Do Not Rebuild

| Component | Why avoid |
|-----------|-----------|
| `vendor_settlements` (057) | Superseded by `vendor_earnings` + `settlements` |
| Admin `FinanceManagement.tsx` | Superseded by `/finance` tabbed hub |
| Admin ecommerce orphan `SettlementsDashboard` | Duplicate of `/finance` settlement tab |
| Vendor `VendorEarningsPage.tsx` | Duplicate of `VendorEarningsSettlementDashboard` |
| Inline commission math in UI | Backend is source of truth |
| New payout API surface | Extend existing `/settlements/*` and `/payouts/*` |

---

## Phase 7 Integration Checklist (from reuse map)

1. **P0 — Implement** `SettlementEngine` using `AppliedDiscount[]` + `FundingConfiguration` (no new tables required for shadow).  
2. **P0 — Wire** resolver after Stack Engine; shadow via `invokeResolverAlongsideLegacy`.  
3. **P0 — Extend** `ensureVendorEarningsForCompletedBooking` + `meal-order-settlement` to consume preview when authoritative.  
4. **P0 — Keep** `settlements.ts`, Razorpay, admin/vendor dashboards unchanged for cutover path.  
5. **P1 — Extend** accrual + booking earnings reports with funding columns.  
6. **P1 — Align** e-commerce seller settlement detail with service waterfall.  
7. **P2 — Defer** general_ledger posting, new admin tabs, orphan UI cleanup.

---

## Summary counts

| Category | Reuse as-is | Extend | Legacy/No | P0 items |
|----------|-------------|--------|-----------|----------|
| Backend ledger/batch | 8 | 6 | 1 | 10 |
| Discount Engine | 5 | 4 | 0 | 8 |
| Admin UI | 7 | 3 | 3 | 2 |
| Vendor UI | 5 | 2 | 2 | 1 |
| **Total focus** | **~25** | **~15** | **~6** | **~21** |

**Bottom line:** Phase 7 adds a **Settlement Engine module inside discount-engine** and **extends existing accrual hooks** — it does not replace the settlement/payout infrastructure that is already in production.
