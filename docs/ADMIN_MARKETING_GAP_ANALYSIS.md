# Admin Marketing & Promotions — Gap Analysis

**Phase:** UI/UX Sprint A — Discovery  
**Date:** 2026-07-03  
**Status:** Analysis only — no implementation  
**Companion:** `docs/ADMIN_MARKETING_CURRENT_STATE.md`, `docs/ADMIN_MARKETING_REUSE_PLAN.md`

---

## Executive Summary

The Admin Marketing ecosystem is **functionally split** across a legacy Marketing Hub and a newer Promotion Hub backed by a shared UI package. The new hub has **superior UX architecture** but **weaker data integration** than legacy. Sprint A should close catalog, API, and navigation gaps while **reusing** `@warmpawz/promotion-management-ui` — not rebuilding.

**Highest priority gaps:** target catalog wiring, API persistence parity, sidebar discoverability, coupon bulk-generate backend, and operator confusion from dual surfaces.

---

## Functional Gaps

| ID | Gap | Severity | Current state | Sprint A impact |
|----|-----|----------|---------------|-----------------|
| F-01 | **Dual promotion APIs** — `/marketing/promotions` vs `/admin/promotions` with different delete semantics and targeting persistence | **Critical** | Legacy soft-delete + rich `applicable_services`; new hub hard-delete + slim payload may drop targeting | Must unify or bridge before retiring legacy modal |
| F-02 | **Target catalog empty** in `AdminPromotionHub` — categories, services, packages, meal plans, products not loaded | **Critical** | Only vendors + 3 hardcoded styles | TargetSelector unusable for granular targeting |
| F-03 | **Legacy category list hardcoded** (5 items) | **High** | vet, grooming, walking, training, boarding only | Incomplete marketplace coverage |
| F-04 | **`POST /admin/coupons/bulk-generate` missing** | **High** | `CouponManagement` calls it; 404 | Bulk coupon creation broken |
| F-05 | **`/promotions` not in sidebar** | **High** | URL-only discovery | Operators use legacy path exclusively |
| F-06 | **Legacy promotion search unwired** | **Medium** | Search input present, no filter logic | Poor list UX at scale |
| F-07 | **Coupon delete/toggle in legacy tab** | **Medium** | Placeholder menu items | Incomplete coupon lifecycle on `/marketing` |
| F-08 | **`PUT /admin/promotions/:id/status` orphan** | **Low** | `AdvancedPromotionsEngine` only (unmounted) | Dead code path |
| F-09 | **Duplicate `GET /admin/promotions`** handler registration | **Low** | `admin-advanced.ts` overlap | Maintenance risk |
| F-10 | **Vendor promotion admin actions limited** | **Medium** | View + toggle only | No admin create/edit for vendor promos |
| F-11 | **Analytics endpoint unwired** | **Medium** | `GET /admin/promotions/analytics` exists | No dashboard charts |
| F-12 | **Package/meal plan targeting not persisted** via `/admin/promotions` | **High** | UI scope exists; API may not store | Runtime mismatch |
| F-13 | **Product targeting** | **Medium** | UI scope exists; e-commerce promos separate | Cross-domain gap |
| F-14 | **Audience / customer segments** | **High** | VIP tile only; no segment API | Future product feature |
| F-15 | **Promotion preview vs runtime** | **Medium** | `PromotionPreview` static | No live price simulation |

---

## UX Gaps

| ID | Gap | Severity | Notes |
|----|-----|----------|-------|
| U-01 | **Two hubs for same job** | **Critical** | `/marketing` vs `/promotions` — no guidance on which to use |
| U-02 | **Legacy modal vs wizard** | **High** | Single cramped dialog vs 8-step guided flow |
| U-03 | **Inconsistent card/table patterns** | **Medium** | Table on legacy; cards on new hub |
| U-04 | **Status visibility** | **Medium** | New hub has lifecycle tabs + badges; legacy flat active/inactive |
| U-05 | **Empty state messaging** | **Low** | Legacy tables minimal guidance |
| U-06 | **Error handling inconsistency** | **Medium** | Toast patterns differ between tabs |
| U-07 | **Bulk actions** | **Medium** | Coupons only; no bulk promo actions |
| U-08 | **Target selection feedback** | **High** | Empty catalogs show scopes but nothing selectable |
| U-09 | **Mobile / responsive** | **Medium** | 3500-line marketing page; wizard full-screen better |
| U-10 | **Accessibility — wizard overlay** | **Low** | Focus trap / keyboard nav needs audit |
| U-11 | **Vendor promotions tab UX** | **Medium** | Read-only overview; limited filtering |
| U-12 | **Banner vs promotion targeting parity** | **Medium** | Banners have dynamic destination-options; promos don't |

---

## Architecture Gaps

| ID | Gap | Severity | Notes |
|----|-----|----------|-------|
| A-01 | **Monolithic `marketing/page.tsx`** (~3500 lines) | **High** | All tabs inline — hard to test and extend |
| A-02 | **No shared marketing hooks** | **Medium** | `/banners` uses hooks; marketing hub does not |
| A-03 | **Orphan components** | **Medium** | `AdvancedPromotionsEngine`, `PromotionsManagement`, `BannerAdmin` |
| A-04 | **Package not consumed by legacy hub** | **High** | Duplicated form logic vs `promotion-management-ui` |
| A-05 | **Normalization split** | **Medium** | `normalize.ts` in package vs inline legacy mapping |
| A-06 | **No global marketing state** | **Low** | Acceptable for now; may need context for unified hub |
| A-07 | **Validation duplicated** | **Medium** | `validation.ts` in package vs inline legacy checks |
| A-08 | **API client inconsistency** | **Medium** | Raw fetch patterns differ across tabs |
| A-09 | **Sidebar nav not extensible for sub-routes** | **Low** | `/promotions`, `/banners` URL-only pattern |
| A-10 | **Discount engine admin surface missing** | **High** | Phases 6–7 backend done; no stack/funding/settlement UI |

---

## Product Gaps (Future — Not Bugs)

These are **planned capabilities**, not defects. Do not classify as functional bugs.

| ID | Capability | UI readiness | Backend readiness |
|----|------------|--------------|-------------------|
| P-01 | Stack rules configuration | `ComingSoonSection` placeholder | Phase 6 engine (shadow/authoritative) |
| P-02 | Priority rules configuration | Placeholder | Phase 5 priority engine |
| P-03 | Funding / co-pay rules | Placeholder | Phase 7 settlement allocator |
| P-04 | Settlement preview in admin | Placeholder | Phase 7 settlement engine |
| P-05 | Campaign grouping | Placeholder | Not implemented |
| P-06 | Approval workflow | Placeholder | Not implemented |
| P-07 | Feature flag admin UI | Placeholder | Env vars only |
| P-08 | Promotion analytics dashboard | Partial endpoint | Needs UI |
| P-09 | Simulator / what-if pricing | None | Requires new screen |
| P-10 | Audit trail | None | Requires new screen |
| P-11 | Customer segment targeting | VIP tile only | No segment API |
| P-12 | A/B testing | None | Not implemented |
| P-13 | Vendor co-funded promotions | Vendor portal only | Partial |
| P-14 | Cross-sell promotion bundles | None | Not implemented |

---

## Deferred Work (Explicitly Out of Sprint A Scope)

| Item | Reason |
|------|--------|
| Full retirement of `/marketing` Promotions tab | Requires API parity + operator migration |
| Discount engine policy admin screens | Backend-first; UI Sprint B+ |
| Customer segment engine | Product definition pending |
| E-commerce promotion unification | Separate `PromotionsManagement` orphan |
| Mobile-native admin app | Web-only scope |

---

## Priority Matrix

| Priority | Gaps | Rationale |
|----------|------|-----------|
| **P0 — Sprint A blockers** | F-01, F-02, F-03, F-05, U-01, U-08, A-04 | Cannot extend new hub without catalog + API clarity + nav |
| **P1 — Sprint A should include** | F-04, F-06, F-07, F-12, U-02, U-04, A-01, A-03 | Operator-visible broken/incomplete flows |
| **P2 — Sprint A stretch** | F-10, F-11, U-07, U-12, A-05, A-07 | Quality and parity improvements |
| **P3 — Future sprints** | P-01 through P-14, F-14, F-15 | Product roadmap / engine admin UI |

---

## Recommended Sprint A Focus

### Goal
Make `/promotions` the **primary operator path** for platform promotions and coupons while **preserving** Marketing Hub for banners, spotlight, articles, and vendor overview.

### Sprint A deliverables (implementation phase — not this doc)

1. **Wire target catalog** in `AdminPromotionHub` using patterns from `GET /admin/banners/destination-options` and `/admin/catalog/categories`.
2. **Resolve API strategy** — extend `/admin/promotions` to persist full targeting OR route new hub through `/marketing/promotions` with normalization adapter.
3. **Add sidebar link** to `/promotions` under Marketing group (after parity checklist).
4. **Implement or stub** `POST /admin/coupons/bulk-generate` (backend + verify legacy UI).
5. **Embed or redirect** legacy Promotions tab → new hub (soft migration banner on legacy tab).
6. **Remove or archive** orphan components after confirming no E2E dependency.

### Success metrics
- Operator can create promotion with category + service targeting from `/promotions` without empty selectors.
- Single documented API path for platform promotions.
- Legacy and new hub show consistent data for same promotion ID.
- Coupon bulk-generate succeeds from Marketing Hub coupons tab.

---

## Reuse Strategy Summary

| Strategy | Targets |
|----------|---------|
| **Reuse as-is** | `PromotionDashboard`, `PromotionWizard`, `PromotionTargetSelector`, cards, badges, timeline, validation, normalize |
| **Extend** | `AdminPromotionHub` (catalog loading), `ComingSoonSection` (link to future policy screens), sidebar nav |
| **Bridge** | Legacy modal → package components OR deprecation banner + redirect |
| **Retire (post-parity)** | Inline promotion modal in `marketing/page.tsx`, `AdvancedPromotionsEngine`, duplicate form logic |
| **Keep on `/marketing`** | Spotlight, banners, articles, What's New, ui-config, vendor promotions until individually migrated |

See `docs/ADMIN_MARKETING_REUSE_PLAN.md` for component-level matrix.

---

## Cross-Reference: Prior Gap IDs

Prior doc `docs/ADMIN_PROMOTION_GAP_ANALYSIS.md` used ADMIN-01–11. Mapping:

| Prior ID | This doc |
|----------|----------|
| ADMIN-01 Dual API | F-01 |
| ADMIN-02 Empty catalog | F-02 |
| ADMIN-03 Hardcoded categories | F-03 |
| ADMIN-04 Bulk generate 404 | F-04 |
| ADMIN-05 No sidebar link | F-05 |
| ADMIN-06 Orphan AdvancedPromotionsEngine | A-03, F-08 |
| ADMIN-07 Monolithic page | A-01 |
| ADMIN-08 Search unwired | F-06 |
| ADMIN-09 Vendor promos read-only | F-10 |
| ADMIN-10 Analytics unwired | F-11 |
| ADMIN-11 Policy UI missing | P-01–P-04, A-10 |
