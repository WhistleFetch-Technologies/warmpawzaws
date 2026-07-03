# Campaign Current State

**Sprint:** E — Analysis only  
**Date:** 2026-07-03

---

## Executive summary

Warmpawz has **three distinct "campaign" concepts** that are not unified:

1. **Commercial promotions** — discounts, flash sales, seasonal offers (discount-engine + promotion wizard)
2. **Push notification campaigns** — audience targeting, schedule, send (notification-engine)
3. **Content marketing** — banners, articles, spotlight (marketing hub)

There is **no unified campaign builder** for commercial promotions. Flash sale and seasonal are **promotion types**, not separate products.

---

## Commercial promotions (discount campaigns)

### Existing features

| Feature | Location | Status |
|---------|----------|--------|
| Platform promotion wizard | `/promotions` → `AdminPromotionHub` | **Production-ready** (Sprint A) |
| Vendor service promos | `ServicePromotionsHub` | **Production-ready** (Sprint B) |
| Vendor seller promos | `SellerPromotionsHub` | **Production-ready** (Sprint B) |
| Coupon CRUD | Admin + vendor hubs | **Supported** |
| Promotion types | `flash_sale`, `seasonal`, `first_order`, `combo`, etc. | **Supported** in engine + UI badges |
| Auto-apply vs code | Discount engine stack | **Supported** |
| Funding (platform/vendor/shared) | Phase 7 settlement preview | **Backend** — not in campaign UI |
| Scheduling (start/end dates) | Promotion tables | **Supported** |
| Lifecycle (draft/active/expired) | `PromotionDashboard` tabs | **Supported** |

### Missing for "campaign builder"

| Capability | Status |
|------------|--------|
| Multi-step campaign journeys | **Missing** |
| A/B test variants | **Missing** |
| Campaign-level budget caps | **Partial** — max_discount, usage_limit per promo |
| Cross-channel orchestration (push + discount) | **Missing** |
| Campaign analytics dashboard | **Missing** (Phase 9 API only) |
| Recurring / Black Friday templates | **Missing** — manual promo creation |
| Audience segmentation for promos | **Missing** — notification campaigns have this |

---

## Push notification campaigns

### Existing features

| Feature | Location | Status |
|---------|----------|--------|
| Campaign CRUD | `/notification-engine` | **Supported** |
| Draft → validate → schedule → send | API + UI | **Supported** |
| Targeting | Broadcast, segments, regions, cities, users | **Supported** |
| Templates | Template picker | **Supported** |
| Audience estimate | Pre-send estimate API | **Supported** |
| Scheduled delivery | DB + `process-scheduled` + EventBridge processor | **Supported** |
| Campaign preview | `CampaignPreview.tsx` | **Supported** |
| Per-campaign analytics API | `/campaigns/:id/analytics` | **API exists** — **no UI** |
| RBAC | create/edit/approve/send/analytics permissions | **Supported** |

### Integration with promotions

| Integration | Status |
|-------------|--------|
| Deep link to promo code | **Partial** — manual in template body |
| Auto-create promo from campaign | **Missing** |
| Unified campaign ID across promo + push | **Missing** |

---

## Content / banner marketing

| Feature | Location | Status |
|---------|----------|--------|
| Banner CRUD | `/marketing`, `/banners` | **Supported** |
| Banner analytics API | `/admin/banners/analytics` | **API exists** — limited UI |
| Spotlight | Marketing hub | **Supported** |
| Articles / announcements | Marketing hub | **Supported** |

---

## Scheduling & automation

| Mechanism | Domain | Status |
|-----------|--------|--------|
| Promotion start/end dates | Commercial | **Supported** |
| Notification campaign schedule | Push | **Supported** |
| EventBridge settlement daily | Finance | **Supported** — unrelated to promos |
| EventBridge analytics retention | Product telemetry | **Supported** |
| Scheduled promo auto-activation | Commercial | **Implicit** via date fields — no job dashboard |
| Recurring promotions | Commercial | **Missing** |
| Drip / multi-touch automation | — | **Missing** |

---

## Promotion & coupon integration

| Path | Status |
|------|--------|
| Customer discovery `/promotions` | **Supported** |
| Checkout coupon (Sprint C.1) | **Supported** — booking/meal/products |
| Discount engine stack | **Complete through Phase 7** |
| Phase 9 analytics | **Backend** — feature-flagged |
| Campaign → checkout attribution | **Missing** |

---

## Funding readiness

| Area | Readiness |
|------|-----------|
| Funding config in engine | **Ready** — `FundingConfiguration` |
| Settlement preview | **Ready** — Phase 7 |
| Admin funding visibility | **Not ready** — no UI |
| Vendor funding cost view | **Not ready** |
| Finance report integration | **Not ready** |

---

## Future campaign support (extension points)

1. **Unified campaign entity** — optional `campaigns` table linking promos + notification + banners (deferred).
2. **Phase 9 analytics UI** — first commercial campaign performance surface.
3. **Notification-engine analytics tab** — reuse admin analytics patterns.
4. **Promotion wizard** — add "Campaign package" preset (flash sale / seasonal templates).
5. **Segment-based promos** — reuse notification segment infrastructure.
6. **Persist settlement audit** — enable historical campaign ROI.

---

## Reuse opportunities

| From | Reuse for commercial campaigns |
|------|-------------------------------|
| Notification campaign schedule/send pipeline | Pattern for scheduled promo broadcasts (not merge tables) |
| `PromotionDashboard` lifecycle tabs | Campaign status UX |
| Phase 9 `campaign-analytics.ts` | Performance rollup (promotion-as-campaign) |
| Banner analytics API | Content campaign metrics pattern |
| `@warmpawz/promotion-management-ui` wizard | Template steps for seasonal/flash presets |

---

## Deferred work (roadmap — not current gaps)

- Full campaign builder with visual workflow
- Black Friday / festive campaign wizards
- Loyalty + campaign intersection
- Wallet/cashback campaigns
- Vendor self-serve campaign budgets with platform co-funding UI
