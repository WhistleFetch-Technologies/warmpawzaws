# Warmpawz Promotions & Coupons — System Status Report (Pre–Phase 6)

**Date:** 2026-06-30  
**Branch reference:** `feature-meal-ui-promotion` (latest: `f34b40345`)  
**Scope:** Documentation only — no code changes in this deliverable.

---

## Section 1 — Executive Summary

### Current architecture

Warmpawz operates a **dual-track promotion platform**:

| Track | Role | Production authority |
|-------|------|---------------------|
| **Legacy runtime engines** | HTTP handlers, `booking-promotion-service`, vendor/service promotion engines, `promotions.ts` | **Authoritative for all customer checkout today** |
| **Discount Engine V2** | Unified resolver pipeline (Phases 1–5B) | **Diagnostic only** — runs alongside legacy via `invokeResolverAlongsideLegacy`; does not alter API responses |

Data is stored primarily in **`promotions`** (platform), **`coupons`** (platform codes), **`vendor_promotions`** (seller/product), and **`vendor_service_promotions`** (service providers). Usage is tracked in **`promotion_usages`** and **`coupon_usages`**.

UI is organized across three portals plus a shared package:

- **Customer:** Sprint 1 pricing components + Sprint 3 marketplace shells
- **Vendor / Admin:** Sprint 2 `@warmpawz/promotion-management-ui` (wizard + dashboard)
- **Admin production path:** Legacy Marketing Hub modal on `/marketing` (sidebar-linked)

### Current state

| Area | Status |
|------|--------|
| UX Sprint 1 (customer pricing truth) | **Complete** |
| UX Sprint 2 (admin/vendor promotion management UI) | **Complete** (UI); backend parity gaps remain on admin wizard save path |
| UX Sprint 3 (marketplace consistency) | **Complete** (incremental adoption — shop/history/confirmation; service discovery partial) |
| Engine Phase 1 — Foundation | **Complete** |
| Engine Phase 2 — Benefit Engine | **Complete** (shadow + legacy fallback) |
| Engine Phase 3 — Rule Engine | **Complete** (shadow only) |
| Engine Phase 3.5 — Candidate Model | **Complete** |
| Engine Phase 4 — Unified Resolver | **Complete** (diagnostic wiring) |
| Engine Phase 5A — Priority Engine (shadow) | **Complete** |
| Engine Phase 5B — Priority Engine (authoritative in resolver) | **Complete** (local); endpoints still legacy |
| Vendor Functional Regression Sprint | **Complete** (deployed dev) |
| Customer Functional Regression Sprint | **Complete** (deployed dev) |
| Admin Analysis | **Complete** (deferred implementation) |
| Phase 6 — Stack Engine | **Not started** |
| Phase 7–10 | **Not started** |

### Overall progress

Approximately **70% of the pre-cutover foundation** is in place: normalized candidates, rules, benefits, resolver, and priority selection exist as an internal pipeline. **Customer-visible pricing UX** is largely unified. **Vendor promotion management** is functional with wizard + targeting. **Admin platform promotions** remain on legacy modal with known gaps. **Production checkout math** still flows through legacy engines.

### Current stability

| Layer | Assessment |
|-------|------------|
| Customer booking + payment (post-regression sprint) | **Improved** — financial snapshot (`wp_financial_meta`), listing promos, single vet summary step |
| Vendor promotion CRUD | **Stable** — wizard reset, catalog mapping, edit round-trip fixed |
| Engine V2 resolver | **Stable in shadow** — extensive integration tests; no production cutover risk |
| Admin platform promo create | **Functional but limited** — coarse targeting; incomplete categories |
| Legacy / V2 divergence | **Ongoing risk** — resolver diagnostics may disagree with legacy until Phase 6–8 |

### Readiness for Phase 6

**Ready to begin Phase 6 (Stack Engine)** from an architecture standpoint:

- Unified resolver accepts priority-selected candidates
- Legacy stack adapter provides coexistence flags (not sequential re-base)
- `STACK_POLICY.md` v1.1.0 defines the contract
- `RESOLVER_MATRIX.md` maps all production flows for migration

**Prerequisites before production cutover (Phase 8)** remain open: Stack Engine, Settlement Engine, endpoint authoritative flags, usage tracker unification, and admin config publish lifecycle.

---

## Section 2 — Engine Status

**Root:** `backend/lambda/src/discount-engine/`  
**Contract docs:** `STACK_POLICY.md`, `RESOLVER_MATRIX.md`, `PHASE*_MIGRATION_REPORT.md`

### Component status

| Component | Phase | Status | Production impact |
|-----------|-------|--------|-------------------|
| **Foundation** (enums, models, contracts, adapters, DI) | 1 | ✅ Completed | None — not wired to HTTP |
| **Benefit Engine** (strategies, calculator, legacy fallback) | 2 | ✅ Completed | Shadow — legacy wins on ±₹1 mismatch |
| **Rule Engine** (core + extended rules, shadow compare) | 3 | ✅ Completed | Shadow — legacy eligibility always wins |
| **Candidate Model** (normalizer, 4 providers, bridges) | 3.5 | ✅ Completed | Normalization layer only |
| **Unified Resolver** (load → rules → benefits → result) | 4 | ✅ Completed | Diagnostic via `production-bridge.ts` |
| **Priority Engine** (5 strategies, policy fingerprint) | 5A | ✅ Completed | Shadow diagnostics |
| **Priority Engine authoritative** (inside resolver) | 5B | ✅ Completed | Affects `ResolverResult` only — not HTTP responses |
| **Legacy Stack Adapter** (coexistence flags, not sequential stack) | 5B | ✅ Completed | Partial — global flags only |
| **Stack Engine** (sequential re-base, vendor→platform) | 6 | ⏳ Planned | Not implemented |
| **Settlement Engine** | 7 | ⏳ Planned | Interface only |
| **Feature-flag cutover** | 8 | ⏳ Planned | Not implemented |
| **Analytics persistence** | 9 | ⏳ Planned | CloudWatch logs only today |
| **Campaign Engine** | 10 | ⏳ Planned | Reserved enum values |
| **Registry in HTTP handlers** | 13 | ⏳ Deferred | `getDiscountEngineRegistry()` unused |

### Current resolver flow

```
DiscountContext
  → CandidateRepository (platform / vendor product / vendor service / coupon providers)
  → Rule Engine (per candidate — shadow in production eligibility paths)
  → Benefit Engine (per eligible — shadow fallback on amount mismatch)
  → Priority Pipeline (OFF / SHADOW / AUTHORITATIVE)
  → Legacy Stack Adapter (coexistence rules — not full stack)
  → Usage Preparation (metadata only — no DB writes)
  → ResolverResult
```

**Production entry:** `invokeResolverAlongsideLegacy(label, context)` — fire-and-forget; **caller return value is always legacy**.

**Wired diagnostic labels include:** `resolveBookingPromotions`, `listApplicableBookingPromotions`, `evaluateServicePromotionDiscount-*`, `evaluatePromotionDiscount-*`, `calculateBestCartPromotion-*`, `validateCouponInternal-*`, `validate-code-*`.

### Feature flags & runtime policy

| Variable | Values | Default | Effect |
|----------|--------|---------|--------|
| `DISCOUNT_ENGINE_V2_PRIORITY_MODE` | `OFF` / `SHADOW` / `AUTHORITATIVE` | `AUTHORITATIVE` | Priority behaviour **inside resolver only** |
| `DISCOUNT_ENGINE_V2_PRIORITY_SHADOW` | legacy boolean | — | Maps to SHADOW/OFF when MODE unset |

**Not yet in:** Terraform, SSM, Serverless, Admin UI. Stack/authoritative cutover flags from `STACK_POLICY.md` §9.7 are **design only**.

### Shadow vs authoritative modes (summary)

| Layer | Mode today | Customer-visible winner |
|-------|------------|-------------------------|
| Benefit Engine | Shadow + fallback | Legacy amount |
| Rule Engine | Shadow | Legacy eligibility |
| Unified Resolver | Diagnostic | Legacy path return |
| Priority Engine | Configurable in resolver | Resolver output only (ignored by HTTP until Phase 8) |

---

## Section 3 — UI Status

### Admin

| Surface | Route | Status |
|---------|-------|--------|
| **Marketing Hub (production)** | `/marketing` → Promotions tab | Sidebar-linked; legacy Create Promotion modal + table |
| **Promotion Management (new)** | `/promotions` | URL-only; `AdminPromotionHub` → `PromotionDashboard` + wizard |
| **Coupons tab** | `/marketing` → Coupons | `CouponManagement` — functional; bulk generate API missing |
| **Vendor Promotions tab** | `/marketing` | Read-only overview + toggle |

**Existing production Marketing Hub — functional state:**

- Create/edit/delete platform promotions via `/marketing/promotions`
- Category + service style targeting (coarse)
- Hardcoded 5 categories; hardcoded 3 service styles (slug mismatch with runtime on save)
- Promo list table with toggle/edit/delete
- Search input **not wired**

**New Promotion Hub — functional state:**

- Full 8-step wizard UI
- Vendor list loaded; categories/services/packages/meal plans/products **catalog empty**
- Saves via `/admin/promotions` — **targeting fields dropped on create** (API split bug)

**Known limitations:**

- Incomplete category list (ADMIN-01)
- No individual service/package/product targeting in production modal (ADMIN-02)
- Two admin surfaces with different API fidelity
- `/promotions` not in sidebar

**Deferred improvements:** See Section 9 (Promotions Refactor Sprint).

**Reuse opportunities:** `PromotionTargetSelector`, `PromotionWizard`, `mappers.ts`, `GET /admin/catalog/categories` — documented in `ADMIN_PROMOTION_GAP_ANALYSIS.md`.

---

### Vendor

| Surface | Entry | Status |
|---------|-------|--------|
| **Service promotions** | `ServicePromotionsHub` → vendor landing / services | ✅ Primary — wizard + dashboard |
| **Seller promotions** | `SellerPromotionsHub` → seller hub | ✅ Product promotions |
| **Legacy** | Various old modals | Orphan / superseded |

**Current functional state (post Vendor Functional Regression Sprint):**

- Wizard opens clean on each create (step/form reset)
- Service names resolve correctly in target selector
- Capability-based tabs (services / packages / meal plans)
- Meal plans API wired where role supports it
- Edit round-trip via `promotionToWizardForm` + catalog-aware normalize
- Dashboard refresh after CRUD; detail drawer clears
- `applicable_services` merges services + packages + meal plan IDs on save

**Coupon support:** Vendor can create coded promotions (same tables); dedicated “coupon UX” is merged into wizard `createKind: 'coupon'`.

**Known UX gaps:**

- Segments audience = “coming soon” in wizard
- Stack / priority / settlement sections = placeholders (`ComingSoonSection`)
- No promotion simulator

**Deferred:** Vendor coupon-specific UX polish; campaign builder.

---

### Customer

| Stage | Components | Status |
|-------|------------|--------|
| **Listing** | `ServicePricingDisplay` → `ServiceListingPrice` | ✅ Universal + vet style + **clinic list** (post sprint) |
| **Summary / review** | `ServiceBookingPromoSummary`, `PromotionCard`, `PriceDisplay` | ✅ Vet/grooming/universal routers |
| **Payment** | `UniversalPaymentPage` + `PriceBreakdown` + `buildCheckoutPriceLines` | ✅ Full GST/fees/promo stack |
| **Booking details** | `extractBookingFinancial` → `BookingPricingSummary` | ✅ Post sprint — `wp_financial_meta` + payment fees |
| **History** | `MyBookings` + `PriceDisplay` / savings badges | ✅ Paid amount + promo visibility |
| **Shop** | `MarketplaceCard`, `CheckoutPriceBreakdown` | ✅ Sprint 3 |
| **Meal** | `MarketplaceHistoryCard`, `MealPlanOrderTrackingUI` | ✅ Partial Sprint 3 |

**Promotion visibility:**

- Live quote via `POST /promotions/calculate-booking` on listings with `usePromoQuote`
- Auto-applied vendor + platform stack shown at summary and payment
- Savings badges distinguish vendor vs platform vs coupon

**Known improvements / partial adoption:**

- `BookingConfirmationSavings` only wired in grooming router (vet/universal can reuse)
- Service discovery uses `ServicePricingDisplay`, not `MarketplaceCard` (Sprint 3 scope)
- Older bookings without `wp_financial_meta` fall back to payment record / legacy fields
- E-commerce coupon path still uses vendor promo lookup in some flows (engine matrix E6 gap)

---

## Section 4 — Functional Verification

### Completed regression fixes

#### Vendor (commit `4dbe3e6c7`)

| Issue | Fix |
|-------|-----|
| Wizard state not reset on open | Remount key + form reset in `PromotionWizard` |
| Undefined service names in target selector | Catalog mapping in `ServicePromotionsHub` |
| Meal plans tab missing | Capability-based tabs + meal plans API |
| Targets not loading | Catalog dedupe + enabled services metadata |
| Dashboard stale after CRUD | Await refresh + clear detail drawer |
| Edit round-trip broken | `promotionToWizardForm` + mapper fixes |
| Pause/activate | Dashboard toggle + refresh |

#### Customer (commits `4dbe3e6c7`, `f34b40345`)

| Issue | Fix |
|-------|-----|
| Vet promotion ID mismatch | `normalizeBookingServiceIds()` + frontend service ID preference |
| Listing promos missing on clinic view | `ServicePricingDisplay` in `ClinicListView` |
| Duplicate booking summary (vet) | Removed `PrePaymentBookingReview`; direct to payment |
| Payment ≠ booking details amount | `financialMeta` + `wp_financial_meta` snapshot |
| GST missing on booking details | Snapshot + `loadCustomerPaymentFeeFields()` |
| Payment payload wrong amount | `finalAmount` on create + verify-payment sync |
| Misleading “Offer available” | `ServiceListingPrice` badge accuracy |

#### Admin

| Work | Status |
|------|--------|
| Current-state + gap analysis | ✅ Documented — **no code changes** (deferred) |

#### Pricing / promotion matching

| Area | Status |
|------|--------|
| Service booking stack (`resolveBookingPromotions`) | ✅ Legacy authoritative; V2 shadow wired |
| Listing quote (`/promotions/calculate-booking`) | ✅ Used by customer UI |
| Detail quote (`/customer/pricing/quote`) | ✅ Available; partial UI adoption |
| Platform inline eligibility | ✅ Shadow compare active |

### Resolved issues (customer backlog)

| ID | Issue | Resolution |
|----|-------|------------|
| CUSTOMER-01 | Promos not on clinic service cards | `ClinicListView` + `ServicePricingDisplay` |
| CUSTOMER-02 | Duplicate vet summary pages | Single summary → payment |
| CUSTOMER-03 | Payment vs booking details mismatch | `wp_financial_meta` + amount alignment |
| CUSTOMER-04 | GST breakdown missing post-payment | Snapshot + fee fields on booking GET |

### Open issues (known — not deferred enhancements)

| ID | Issue | Severity | Owner |
|----|-------|----------|-------|
| ENG-01 | Resolver result not authoritative at HTTP layer | High | Phase 8 |
| ENG-02 | No sequential stack re-base (vendor then platform on reduced amount) | High | Phase 6 |
| ENG-03 | Booking `coupon_code` ignored by `resolveBookingPromotions` | Medium | Phase 6+ |
| ENG-04 | Shop checkout coupon may not hit `coupons` table (E6) | Medium | Engine matrix |
| ENG-05 | `platform_promotions` legacy table still queried by `POST /promotions/apply` | Medium | Migration |
| ENG-06 | `/admin/promotions` POST drops wizard targeting | Medium | Admin refactor sprint |
| ENG-07 | `/marketing/promotions` lacks admin auth guard | Medium | Security |
| ENG-08 | Coupon bulk generate endpoint missing | Low | Admin |
| ENG-09 | Rule Engine never authoritative (always shadow) | Low | TBD |
| ENG-10 | Pre-`wp_financial_meta` bookings show incomplete breakdown | Low | Data migration / fallback |

---

## Section 5 — Architecture Inventory (Reusable Components)

### `@warmpawz/promotion-management-ui`

| Component | Purpose | Used in |
|-----------|---------|---------|
| `PromotionDashboard` | Hub: tabs, search, filters, cards | Admin `/promotions`, vendor service + seller hubs |
| `PromotionWizard` | 8-step create/edit | Via dashboard only |
| `PromotionTargetSelector` | Multi-scope targeting UI | Wizard step 5 only |
| `PromotionTypeSelector` | Discount type tiles | Wizard |
| `PromotionTriggerSelector` | Audience tiles | Wizard |
| `PromotionPreview` | Customer preview (UI-only) | Wizard review |
| `PromotionSummary` | Review summary | Wizard review |
| `PromotionCard` | Management list card | Dashboard |
| `CouponCard` | Coupon list card | Dashboard |
| `PromotionDetailsPanel` | Side drawer | Dashboard |
| `PromotionStatusBadge` | Lifecycle chip | Cards, drawer |
| `PromotionTimeline` | Schedule bar | Drawer |
| `ComingSoonSection` | Placeholder for Phase 6+ features | Drawer |

**Lib:** `types.ts`, `lifecycle.ts`, `validation.ts`, `normalize.ts`, `mappers.ts`

### Customer pricing (`apps/customer-web/components/customer/pricing/`)

| Component | Purpose | Used in |
|-----------|---------|---------|
| `PriceDisplay` | Original + current + savings | Listing, summary, payment headers, marketplace, history, details |
| `SavingsBadge` | Save / auto-applied / vendor / platform | Widespread |
| `PromotionOfferBadge` | % OFF, BOGO, bundle chips | `PriceDisplay`, `MarketplaceCard`, customer `PromotionCard` |
| `PriceBreakdown` | Line-item breakdown | `UniversalPaymentPage`, `BookingPricingSummary`, ecommerce checkout |
| `ServiceListingPrice` | Live promo quote | Via `ServicePricingDisplay` |
| `BookingPricingSummary` | Paid booking breakdown | `BookingDetailModal`, `BookingConfirmationSavings` |
| `BookingConfirmationSavings` | Post-payment summary | `GroomingBookingRouter` |
| `PromotionCard` (customer) | Offer card in review | `ServiceBookingPromoSummary` |

**Facade:** `ServicePricingDisplay` → delegates to `ServiceListingPrice` or `PriceDisplay`

**Lib helpers:**

| Module | Purpose | Consumers |
|--------|---------|-----------|
| `lib/pricing/booking-financial.ts` | `extractBookingFinancial()` | Booking details, history |
| `lib/pricing/checkout-price-breakdown.ts` | `buildCheckoutPriceLines()` | Payment, booking financial |
| `lib/pricing/ecommerce-checkout-price-breakdown.ts` | Shop checkout lines | `CheckoutPriceBreakdown` |
| `lib/pricing/format.ts`, `types.ts` | Shared formatting/types | All pricing components |

### Customer marketplace (`apps/customer-web/components/customer/marketplace/`)

| Component | Used in |
|-----------|---------|
| `MarketplaceCard` | `ShopProductCard` → catalog sections |
| `MarketplaceHistoryCard` | `MyOrders`, `MealOrderCard` |
| `MarketplaceConfirmation` | Booking confirm, ecommerce success |
| `MarketplaceTracking` | Meal plan tracking UI |
| `MarketplaceStatus` | `MyBookings`, history cards |
| `MarketplaceTimeline` | Ecommerce success |
| `MarketplaceReview` | Grooming confirmation |
| `MarketplacePageHeader` | `MyOrders` |
| `MarketplaceActions`, `MarketplacePolicies`, `MarketplaceRefundStatus`, `MarketplaceSummary`, `MarketplaceDetailSection` | Exported — incremental adoption |

### Backend shared services

| Module | Purpose |
|--------|---------|
| `booking-promotion-service.ts` | Booking stack, promo meta, financial meta builders |
| `service-promotion-engine.ts` | Vendor service promo eval |
| `vendor-promotion-engine.ts` | Vendor product / cart promo eval |
| `discount-calculation-service.ts` | Pricing quote wrapper |
| `discount-engine/` | V2 pipeline (diagnostic) |

---

## Section 6 — Existing APIs

### Platform promotion APIs

| Method | Path | Role | Notes |
|--------|------|------|-------|
| GET | `/marketing/promotions` | Admin list (legacy UI) | No admin guard |
| POST | `/marketing/promotions` | Admin create **with targeting** | Rich payload |
| PUT | `/marketing/promotions/:id` | Admin update | |
| DELETE | `/marketing/promotions/:id` | Soft delete | |
| GET | `/admin/promotions` | Admin list (wizard UI) | Requires admin |
| POST | `/admin/promotions` | Admin create **basic only** | Targeting dropped |
| PUT/DELETE | `/admin/promotions/:id` | Admin CRUD | |
| GET | `/promotions/list`, `/promotions/active` | Customer listing | |
| GET | `/promotions/applicable` | Eligibility preview | |
| POST | `/promotions/calculate-booking` | **Primary booking quote** | Customer UI |
| POST | `/promotions/apply` | Legacy apply | Queries `platform_promotions` + vendor |
| GET | `/promotions/validate` | Code on `promotions.code` | |

### Coupon APIs

| Method | Path | Role |
|--------|------|------|
| GET | `/admin/coupons` | Admin list |
| POST | `/admin/coupons`, `/admin/coupons/create` | Create |
| PUT/DELETE | `/admin/coupons/:id` | CRUD |
| GET | `/coupons/validate/:couponCode` | Customer validate |
| POST | `/coupons/apply` | Record usage |

### Vendor promotion APIs

| Method | Path | Role |
|--------|------|------|
| GET/POST/PUT/DELETE | `/vendor/:vendorId/promotions` | Seller product promos |
| GET/POST/PUT/DELETE | `/vendor/:vendorId/service-promotions` | Service promos |
| GET | `/admin/vendor-promotions` | Admin overview |
| PUT | `/admin/vendor-promotions/:promoId/toggle` | Admin toggle |
| POST | `/promotions/validate-code` | Unified code validate |
| POST | `/promotions/apply-vendor` | Vendor promo apply |

### Booking / pricing APIs

| Method | Path | Role |
|--------|------|------|
| POST | `/customer/pricing/quote` | Full booking quote |
| POST | `/bookings/create` | Accepts `financialMeta`, promo IDs |
| GET | `/customer/:id/bookings/:bookingId` | Returns fee fields + `paid_amount` |

### Resolver entry points (diagnostic)

Wired via `invokeResolverAlongsideLegacy` from:

- `booking-promotion-service.ts`
- `service-promotion-engine.ts`
- `vendor-promotion-engine.ts`
- `promotions.ts` (coupon validate)
- `vendor-promotions.ts` (validate-code)

### API overlaps & legacy

| Overlap | Detail |
|---------|--------|
| **Dual admin promotion CRUD** | `/marketing/promotions` vs `/admin/promotions` — different field persistence |
| **Dual apply** | `POST /promotions/apply` defined twice in `promotions.ts` (second wins) |
| **Legacy table** | `platform_promotions` — apply path only |
| **Promo vs coupon** | Optional `promotions.code` vs separate `coupons` table |
| **V2 vs legacy** | All checkout endpoints → legacy; V2 logs only |

**V2 APIs:** No public `/discounts` API yet (Phase 11 deferred).

---

## Section 7 — Database Inventory

### `promotions` (platform — canonical)

**Usage:** Platform-wide and category/style/service-targeted promotions. Auto-apply when published. Optional code.

**Key columns:** `discount_type`, `discount_value`, `service_category`, `service_style`, `applicable_services` (JSONB), `applicable_roles`, `metadata`, `published`, `is_spotlight`, `code`, usage limits.

**Deferred/Future:** Full targeting from admin wizard; campaign linkage; policy fingerprint storage.

### `coupons` (platform)

**Usage:** Admin-created coupon codes. Separate from promotions. No targeting in current admin API.

**Future:** Optional `applicable_services` / category scoping for platform coupons.

### `vendor_promotions` (seller / product)

**Usage:** E-commerce vendor promos. Product/category targeting via JSONB. Structural types (BOGO, bundle).

### `vendor_service_promotions` (service provider)

**Usage:** Primary vendor booking promos. `applicable_services` stores vendor_service IDs, packages, meal plans.

**Runtime:** Matched by `booking-promotion-service` + service promotion engine.

### `promotion_usages`

**Usage:** Platform + typed promotion redemption audit. Stats for admin dashboard.

**Deferred:** Unified usage tracker in V2 (Phase 6–7).

### `coupon_usages`

**Usage:** Coupon redemption records linked to bookings/orders.

### Legacy / adjacent

| Table | Status |
|-------|--------|
| `platform_promotions` | Legacy — migrate or compatibility loader |
| `spotlight_offers` | Marketing spotlights — separate from discount stack |

---

## Section 8 — Current Limitations

### Functional

- Production checkout uses legacy engines exclusively
- No sequential stack (vendor discount then platform on reduced base)
- Admin wizard targeting not persisted via `/admin/promotions`
- Incomplete admin category list
- Booking coupon stack gap (S5)
- Shop coupon table mismatch (E6)
- Bulk coupon generate not implemented
- Older bookings lack immutable financial snapshot

### UX

- Admin: two promotion surfaces, sidebar only shows `/marketing`
- Admin: search not wired on legacy promotions table
- Customer: vet/universal lack post-confirmation savings component
- Customer: service listings not yet on `MarketplaceCard`
- Vendor/Admin wizard: segments, simulator, campaigns = placeholders

### Architecture

- Dual admin API paths with different fidelity
- Resolver diagnostic-only — no single source of truth at HTTP layer
- Category slug inconsistency (`vet` vs `veterinary` vs role IDs)
- Service style slug inconsistency across admin modal / runtime
- No SSM/Terraform feature flags for engine cutover
- In-code policy defaults — no admin config publish

### Deferred (intentional — not bugs)

See Section 9.

### Future

- Campaign Engine, Analytics dashboard, Policy Simulator, Settlement reporting, Marketing Hub consolidation, legacy cleanup.

---

## Section 9 — Deferred Work (Future Enhancements)

These items are **intentionally postponed** — not classified as bugs.

| Item | Rationale | Target |
|------|-----------|--------|
| **Marketing Hub consolidation** | Merge legacy modal + `/promotions` wizard under one sidebar entry | Post engine phases |
| **Promotions Refactor Sprint (Admin)** | Dynamic categories, `PromotionTargetSelector` in legacy modal, API split fix | After Phase 6 engine work |
| **Dynamic categories** | Wire `GET /admin/catalog/categories` | Admin refactor |
| **Admin individual service/package/product targeting** | Catalog load + modal integration | Admin refactor |
| **Vendor coupon UX** | Dedicated coupon flows vs coded promo | UX polish |
| **Campaign Builder** | Phase 10 | Engine Phase 10 |
| **Analytics Dashboard** | Phase 9 | Engine Phase 9 |
| **Policy Simulator** | Admin preview of stack outcome | Phase 8+ |
| **Admin configuration UI** | Priority/stack/funding policy publish to SSM | Phase 8 |
| **Stack / Settlement UI** | `ComingSoonSection` placeholders | Phases 6–7 |
| **Endpoint authoritative cutover** | `discount_engine_v2_authoritative` | Phase 8 |
| **`/discounts` unified API** | Phase 11 | Post cutover |
| **Registry handler wiring** | Phase 13 | Post cutover |
| **`platform_promotions` migration** | Compatibility cleanup | Phase 8 |
| **BookingConfirmationSavings on all routers** | Incremental UX | Optional pre/post Phase 6 |
| **Service discovery → MarketplaceCard** | Sprint 3 incremental | Optional UX |

---

## Section 10 — Phase Roadmap

### Completed

| Phase | Deliverable |
|-------|-------------|
| **UX Sprint 1** | Customer pricing components + booking financial truth UI |
| **UX Sprint 2** | `promotion-management-ui` package; admin + vendor hubs |
| **UX Sprint 3** | Marketplace module; shop/history/confirmation consistency |
| **Engine Phase 1** | Foundation module |
| **Engine Phase 2** | Benefit Engine + legacy delegation |
| **Engine Phase 3** | Rule Engine (shadow) |
| **Engine Phase 3.5** | Candidate model + providers |
| **Engine Phase 4** | Unified resolver + diagnostic wiring |
| **Engine Phase 5A** | Priority Engine (shadow) |
| **Engine Phase 5B** | Priority authoritative in resolver + legacy stack adapter |
| **Vendor Functional Regression Sprint** | Wizard + hub fixes |
| **Customer Functional Regression Sprint** | Listing, summary, payment, details alignment |
| **Admin Analysis** | `ADMIN_PROMOTION_CURRENT_STATE.md`, `ADMIN_PROMOTION_GAP_ANALYSIS.md` |

### Upcoming

| Phase | Deliverable | Depends on |
|-------|-------------|------------|
| **Phase 6 — Stack Engine** | Sequential re-base; vendor→platform; coupon phase ordering | 5B complete ✅ |
| **Phase 7 — Settlement Engine** | Funding splits; vendor/platform settlement metadata | Phase 6 |
| **Phase 8 — Production cutover** | Authoritative resolver at HTTP; feature flags; SSM policy | Phases 6–7 |
| **Phase 9 — Analytics** | Audit persistence; admin metrics | Phase 8 |
| **Phase 10 — Campaign Engine** | Scheduled campaigns; audience segments | Phase 9 |

### Future (post-engine)

| Initiative | Notes |
|------------|-------|
| **Marketing Hub consolidation** | Single admin entry; extend legacy modal |
| **Legacy cleanup** | Remove orphan components (`AdvancedPromotionsEngine`, duplicate apply handlers) |
| **Promotions Refactor Sprint** | Admin categories + targeting (approved, deferred) |

---

## Section 11 — Technical Debt

| Category | Items |
|----------|-------|
| **Duplicate flows** | Legacy `/marketing` modal vs `/promotions` wizard; two admin POST handlers |
| **Legacy components** | `AdvancedPromotionsEngine`, `ecommerce/promotions/PromotionsManagement`, `AdminApp` stub |
| **API duplication** | `POST /promotions/apply` twice; `/admin/coupons` vs `/admin/coupons/create` |
| **Temporary adapters** | `legacy-stack-adapter.ts` (coexistence only); benefit/rule shadow compare |
| **Feature flags** | Env-only priority mode; no cutover flags deployed |
| **Compatibility layers** | `platform_promotions` table; `target_category` column aliases |
| **Slug normalization** | Category and service style mapping scattered across UI and backend |
| **Two PromotionCard components** | Customer pricing vs management-ui package (name collision) |
| **Financial snapshot** | `wp_financial_meta` new — older bookings use fallback path |
| **Resolver matrix checklist** | All S1–E6 migration rows still open in `RESOLVER_MATRIX.md` |

**Future consolidation target:** Single admin API path, single customer pricing path through resolver at HTTP layer, unified usage tracker, shared category config service.

---

## Section 12 — Production Readiness

### Backend

| Criterion | Status | Notes |
|-----------|--------|-------|
| Legacy booking stack | ✅ Production-ready | Authoritative |
| V2 resolver | ⚠️ Pre-production | Diagnostic only |
| Financial snapshot persistence | ✅ Improved | New bookings on dev |
| Promotion CRUD | ✅ Functional | Admin split remains |
| Auth on marketing endpoints | ⚠️ Gap | `/marketing/promotions` unguarded |

### Customer

| Criterion | Status |
|-----------|--------|
| Listing promo visibility | ✅ Ready (post sprint) |
| Summary → payment flow | ✅ Ready |
| Payment breakdown | ✅ Ready |
| Booking details truth | ✅ Ready (new bookings); fallback for old |
| Shop marketplace UX | ✅ Ready |

### Vendor

| Criterion | Status |
|-----------|--------|
| Promotion wizard | ✅ Ready |
| Service targeting | ✅ Ready |
| Product targeting | ✅ Ready |
| Dashboard lifecycle | ✅ Ready |

### Admin

| Criterion | Status |
|-----------|--------|
| Legacy create/list | ⚠️ Limited — coarse targeting, incomplete categories |
| New wizard hub | ⚠️ UI ready — save path incomplete |
| Coupon management | ⚠️ Functional — no bulk generate |

### Engine

| Criterion | Status |
|-----------|--------|
| Phases 1–5B | ✅ Complete internally |
| Phase 6+ | ❌ Required before cutover |
| Test coverage | ✅ Integration tests in discount-engine |

### Current risks

1. **Legacy vs V2 divergence** until Phase 8 — shadow logs may show mismatches
2. **Admin API split** — wizard saves may not target correctly
3. **Pre-snapshot bookings** — incomplete financial history
4. **Engine matrix gaps** — S5 booking coupon, E6 shop coupon

### Remaining risks (post–Phase 6 start)

1. Stack parity with `calculateBookingPromotionsStack`
2. Settlement accuracy for multi-party funding
3. Cutover rollback plan for feature flags

### Recommended next phase

**Begin Phase 6 — Stack Engine** per `STACK_POLICY.md`:

1. Implement `stack/stack-engine.ts` with sequential re-base
2. Replace legacy stack adapter coexistence-only logic in resolver
3. Add integration tests for S1/S2 parity vs `booking-promotion-service`
4. Keep HTTP layer on legacy until Phase 8 gate

Admin Promotions Refactor Sprint remains **deferred until after remaining engine phases** as approved.

---

## Reference documents

| Document | Path |
|----------|------|
| UX Sprint 1 | `docs/UX_SPRINT1_IMPLEMENTATION.md` |
| UX Sprint 2 | `docs/UX_SPRINT2_IMPLEMENTATION.md` |
| UX Sprint 3 | `docs/UX_SPRINT3_IMPLEMENTATION.md` |
| Admin current state | `docs/ADMIN_PROMOTION_CURRENT_STATE.md` |
| Admin gap analysis | `docs/ADMIN_PROMOTION_GAP_ANALYSIS.md` |
| Stack policy | `backend/lambda/src/discount-engine/STACK_POLICY.md` |
| Resolver matrix | `backend/lambda/src/discount-engine/RESOLVER_MATRIX.md` |
| Phase reports | `backend/lambda/src/discount-engine/PHASE*_MIGRATION_REPORT.md` |

---

*Documentation generated 2026-06-30. Local only — not committed per instruction.*
