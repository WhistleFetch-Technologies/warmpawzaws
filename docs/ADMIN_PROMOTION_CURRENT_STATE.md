# Admin Promotion Management — Current State

**Date:** 2026-06-30  
**Scope:** Platform admin promotions & coupons (Marketing Hub). Vendor promotions are referenced only where relevant.  
**Method:** Code analysis — no UI redesign, no new wizard, no implementation changes.

---

## Executive Summary

Warmpawz admin has **two parallel promotion surfaces**:

| Surface | Route | Sidebar | API | Targeting fidelity |
|---------|-------|---------|-----|-------------------|
| **Marketing Hub (legacy)** | `/marketing` → Promotions tab | Yes | `/marketing/promotions` | Category + service style (coarse) |
| **Promotion Management (new)** | `/promotions` | No (URL only) | `/admin/promotions`, `/admin/coupons` | Wizard UI supports rich targets; **backend drops most targeting on create** |

The screenshot you shared is the **legacy Create Promotion modal** on `/marketing`. Categories are **hardcoded** (5 verticals). Service styles use a **different slug scheme** than the rest of the platform.

Coupons live in a **separate table** (`coupons`) with **no targeting fields** in the admin API.

---

## 1. Current Architecture

```
Admin UI
├── /marketing (Marketing Hub)
│   ├── Promotions tab → legacy modal + table → GET/POST/PUT/DELETE /marketing/promotions
│   ├── Coupons tab → CouponManagement → /admin/coupons
│   ├── Vendor Promotions tab → VendorPromotionsOverview → /admin/vendor-promotions
│   └── Dashboard / Spotlight / Banners / Articles / What's New (adjacent marketing)
│
└── /promotions (AdminPromotionHub)
    └── PromotionDashboard + PromotionWizard (@warmpawz/promotion-management-ui)
        → GET/POST/PUT/DELETE /admin/promotions + /admin/coupons

Backend (canonical store)
└── promotions table — platform promotions (category, style, applicable_services JSONB)
└── coupons table — platform coupons (code-based, no targeting in API)
└── promotion_usages / coupon_usages — usage tracking
└── platform_promotions — legacy table; no admin CRUD, limited runtime use

Runtime eligibility
└── promotions.ts → isPromotionEligible()
└── booking-promotion-service.ts → platformPromoMatchesContext()
└── discount-engine → PlatformInlineCategoryRule, StyleRule, ServiceRule
```

---

## 2. Current Screens & Routes

| Route | File | Purpose |
|-------|------|---------|
| `/marketing` | `apps/admin-web/app/marketing/page.tsx` | Primary sidebar entry — tabs for Promotions, Coupons, Vendor Promotions, etc. |
| `/promotions` | `apps/admin-web/app/promotions/page.tsx` | Unified promotion hub via `AdminPromotionHub` |
| `/banners` | `apps/admin-web/app/banners/page.tsx` | Banner management (separate from promo targeting) |

**Navigation:** `packages/shared-types/src/admin-portal-nav.ts` — only `/marketing` is under “Marketing & Promotions”. `/promotions` is not linked in sidebar.

**Orphan / unused in routes:**
- `AdvancedPromotionsEngine.tsx` — richer modal with 10 hardcoded service checkboxes; E2E only
- `ecommerce/promotions/PromotionsManagement.tsx` — older grid + modal; not mounted

---

## 3. Current Components (Reuse Inventory)

### Admin-web

| Component | Path | Role |
|-----------|------|------|
| Marketing page (inline modal) | `apps/admin-web/app/marketing/page.tsx` | Legacy list + Create/Edit Promotion dialog |
| `AdminPromotionHub` | `components/admin/marketing/AdminPromotionHub.tsx` | Data layer for new wizard; loads vendors + empty catalog |
| `CouponManagement` | `components/admin/marketing/CouponManagement.tsx` | Coupon list, create, bulk (bulk API missing) |
| `VendorPromotionsOverview` | `components/admin/marketing/VendorPromotionsOverview.tsx` | Read-only admin view of vendor promos |

### Shared package `@warmpawz/promotion-management-ui`

| Component | Purpose |
|-----------|---------|
| `PromotionDashboard` | Lifecycle tabs, search, filters, card grid, opens wizard |
| `PromotionWizard` | 8-step create/edit (type, info, promo type, audience, **targets**, discount, schedule, review) |
| `PromotionTargetSelector` | Multi-scope targeting with search/pagination |
| `PromotionTypeSelector` | Promotion type tiles |
| `PromotionTriggerSelector` | Audience tiles (segments = coming soon) |
| `PromotionCard` / `CouponCard` | List cards |
| `PromotionDetailsPanel` | Details drawer |
| `PromotionPreview` / `PromotionSummary` | Review step |
| `normalize.ts` | Row ↔ wizard form round-trip |
| `mappers.ts` | Wizard → API payloads (admin, vendor, marketing) |
| `validation.ts` | Client-side wizard validation |

**Reuse opportunity:** Extend legacy modal fields using `PromotionTargetSelector` + catalog loader — do **not** build a second target UI.

---

## 4. Legacy Create Promotion Modal (Production Flow)

**Location:** `apps/admin-web/app/marketing/page.tsx` (~lines 2496–2675)

### Form state (`promoForm`)

```typescript
{
  title, subtitle,
  discountType: 'percentage' | 'flat',
  discountValue,
  code,
  serviceCategory: 'all' | 'vet' | 'grooming' | 'walking' | 'training' | 'boarding',
  serviceStyle: 'all' | 'home_visit' | 'clinic' | 'online',
  validFrom, validUntil,
  isActive, published,
  displayType: 'spotlight' // not shown in UI; always defaulted
}
```

### Visible fields

Title, Subtitle, Discount Type, Discount Value, Promo Code, **Category**, **Service Style**, Valid From/Until, Active, Published.

### Save behavior

- **Create:** `POST /marketing/promotions`
- **Update:** `PUT /marketing/promotions/:id`
- **Delete:** `DELETE /marketing/promotions/:id` (soft delete: `is_active = false`)

Payload builds `applicableServices` from category + `style:${serviceStyle}`:

```javascript
// Category token (unless 'all')
promoForm.serviceCategory !== 'all' ? [promoForm.serviceCategory] : []
// Style token (unless 'all') — uses home_visit/clinic/online on save
style:home_visit | style:clinic | style:online
```

Also sets `serviceCategory`, `serviceStyle`, `metadata.promotionTarget`.

### List table

Columns: Title, Discount, Code, Category, Status, Actions (toggle, edit, delete).

**Gap:** Search input is rendered but **not wired** (no state/filter).

---

## 5. New Promotion Wizard (`/promotions`)

**Entry:** `AdminPromotionHub` → `PromotionDashboard` with `scope.mode = 'platform'`.

### Enabled target scopes (platform)

`entire_platform`, `vendors`, `categories`, `services`, `packages`, `meal_plans`, `products`, `styles`

### Catalog actually loaded (`AdminPromotionHub.tsx`)

| Scope | Loaded? | Source |
|-------|---------|--------|
| Vendors | Yes | `GET /admin/vendors?limit=50` |
| Styles | Yes | Hardcoded: `at_home`, `at_center`, `tele` |
| Categories | **No** | `catalog.categories` never set |
| Services | **No** | Empty array |
| Packages | **No** | Empty array |
| Meal plans | **No** | Empty array |
| Products | **No** | Empty array |

`PromotionTargetSelector` shows “No items loaded…” for empty scopes.

### Save path

- Promotions: `wizardToAdminPromotionPayload()` → `POST/PUT /admin/promotions`
- Coupons: `wizardToAdminCouponPayload()` → `POST/PUT /admin/coupons/create`

---

## 6. Current APIs

### Platform promotions

| Method | Path | Auth | Targeting persisted? |
|--------|------|------|---------------------|
| GET | `/marketing/promotions` | None on path | Returns full rows |
| POST | `/marketing/promotions` | None on path | **Yes** — category, style, applicable_services, metadata, published |
| PUT | `/marketing/promotions/:id` | None | **Yes** |
| DELETE | `/marketing/promotions/:id` | None | Soft delete |
| GET | `/admin/promotions` | Admin | Returns full rows |
| POST | `/admin/promotions` | Admin | **No** — name, discount, dates, usage only |
| PUT | `/admin/promotions/:id` | Admin | Partial — basic fields; targeting fields largely ignored on create |
| DELETE | `/admin/promotions/:id` | Admin | Hard delete |

**Critical split:** Legacy Marketing Hub uses the **rich** `/marketing/promotions` API. New wizard uses **stripped** `/admin/promotions` API — wizard targeting is lost on save.

### Platform coupons

| Method | Path | Notes |
|--------|------|-------|
| GET | `/admin/coupons` | List with UI field aliases |
| POST | `/admin/coupons`, `/admin/coupons/create` | Create — no targeting |
| PUT | `/admin/coupons/:id` | Update |
| DELETE | `/admin/coupons/:id` | Hard delete |

**Missing:** `POST /admin/coupons/bulk-generate` (called from `CouponManagement.tsx`, not implemented).

### Runtime (customer checkout)

| Path | Purpose |
|------|---------|
| `GET /promotions/applicable` | Eligible platform promos for context |
| `POST /promotions/calculate-booking` | Vendor + platform stack |
| `GET /coupons/validate/:code` | Coupon validation |
| `POST /coupons/apply` | Record coupon usage |

### Category configuration (exists, unused by promo modal)

| Path | Purpose |
|------|---------|
| `GET /admin/catalog/categories?type=service` | `service_categories` table |
| `GET /admin/catalog/categories?type=ecommerce` | `ecommerce_categories` table |
| `GET /config/policy-options` | Platform policy categories (4 grouped verticals) |
| `GET /admin/roles` | Vendor roles (loaded on marketing page for **Dashboard UI**, not promo category dropdown) |

---

## 7. Database Model

### `promotions` (canonical platform store)

**Core:** `id`, `name`, `description`, `promotion_type`, `discount_type`, `discount_value`, `min_order_amount`, `max_discount_amount`, `start_date`, `end_date`, `is_active`, `usage_limit`, `usage_count`, `code`

**Targeting (migration 019, 060, 1030, 603):**

| Column | Type | Usage |
|--------|------|-------|
| `service_category` | TEXT | Vertical slug (`vet`, `grooming`, …) |
| `service_style` | TEXT | `at_home`, `at_center`, `tele` |
| `applicable_services` | JSONB | Mixed: category slugs, `style:*`, service UUIDs, `product`/`shop` tokens |
| `applicable_roles` | JSONB | Vendor role IDs |
| `metadata` | JSONB | `promotionTarget.serviceCategory`, `serviceStyle` |
| `published` | BOOLEAN | Required for auto-apply at checkout |
| `is_spotlight` | BOOLEAN | Spotlight visibility |

**Legacy aliases:** `target_category`, `target_service_style` (still read at runtime).

**Schema drift:** `/admin/promotions` POST writes `applicable_to`, `max_uses`, `max_uses_per_user` — columns may not exist in all environments.

### `coupons`

Separate entity. No FK to `promotions`. Fields: `code`, `discount_type`, `discount_value`, min/max amounts, dates, usage limits, `is_active`. Targeting columns exist in some migrations but **admin API does not use them**.

### Usage

- `promotion_usages` — platform promo redemptions
- `coupon_usages` — coupon redemptions

---

## 8. Targeting Encoding & Business Rules

### `applicable_services` JSONB tokens

| Token | Meaning |
|-------|---------|
| `"grooming"`, `"vet"`, … | Service category slug |
| `"style:at_home"` | Service style |
| UUID | Specific service / vendor_service / catalog id |
| `"product"`, `"shop"`, `"ecom"` | E-commerce scope |

Dedicated columns `service_category` and `service_style` mirror category/style for queries.

### Style normalization (backend)

| UI (legacy modal) | Canonical |
|-------------------|-----------|
| `home_visit` | `at_home` |
| `clinic` | `at_center` |
| `online` | `tele` |

New wizard uses canonical slugs directly.

### Eligibility at checkout (`isPromotionEligible`)

1. Active + published + date window  
2. `min_order_amount`  
3. Category match (if configured)  
4. Style match (if `style:*` tokens)  
5. Service UUID match (if UUIDs in array)  
6. Discount-engine shadow rules

### Booking stack

Platform promos load from `promotions` where `published = true`, stack after vendor service promos (`booking-promotion-service.ts`).

---

## 9. Category Source Analysis

### Legacy modal — hardcoded enum

```tsx
// apps/admin-web/app/marketing/page.tsx
all, vet, grooming, walking, training, boarding
```

### Platform actually supports (elsewhere in codebase)

| Source | Categories |
|--------|-------------|
| `AdvancedPromotionsEngine` (unused) | vet, grooming, training, boarding, shop, pharmacy, walker, nutritionist, cafe, insurance |
| `feeCalculator.mapCatalogCategoryToBusinessType` | grooming, veterinary, boarding, training, pharmacy, cafe, nutritionist, pet_store |
| `GET /config/policy-options` | veterinary, grooming, walkers_training_boarding (grouped), ecommerce |
| `GET /admin/catalog/categories` | Dynamic from `service_categories` DB table |
| Customer hubs / roles | Full vendor role catalog via `/admin/roles` |

### Missing from legacy dropdown (examples)

Pharmacy, nutritionist/meal, walker, shop/e-commerce, cafe, insurance, diagnostics, adoption, and any category added via admin catalog after launch.

### Slug inconsistency

Legacy modal uses `vet`; fee engine uses `veterinary`; customer flows often use role-based ids. Runtime matching is best-effort string compare — **misconfigured slugs silently fail eligibility**.

---

## 10. Promotion Scope — What Admin Can Target Today

| Target | Legacy `/marketing` modal | New wizard UI | `/marketing/promotions` API | `/admin/promotions` API | Runtime |
|--------|---------------------------|---------------|----------------------------|------------------------|---------|
| Entire marketplace | Yes (`all` / empty) | Yes | Yes | Yes (coarse) | Yes |
| Single category | Yes (one dropdown) | Yes (empty catalog) | Yes | No on create | Yes |
| Multiple categories | No | Yes (multi-select UI) | Partial via JSONB | No | Partial |
| Service style | Yes (one dropdown) | Yes | Yes | No on create | Yes |
| Individual services | No | UI only | Yes (UUID in JSONB) | No | Yes |
| Packages | No | UI only | Via UUID if stored | No | Partial |
| Meal plans | No | UI only | Via UUID if stored | No | Partial |
| Products | No | UI only | Via `product`/`shop` tokens | No | Partial |
| Vendors | No | UI only | No for platform promos | No | N/A |
| Vendor roles | No | No | Yes (`applicable_roles`) | No | Yes on `/promotions/active` |

---

## 11. Coupon Flow

### Creation paths

1. **Marketing → Coupons tab:** `CouponManagement` — simple form, no targeting  
2. **Promotion wizard:** `createKind: 'coupon'` → `/admin/coupons/create`

### Relationship to promotions

- **Separate tables**, no foreign key  
- Promotions can optionally have a `code` on the same row (auto-apply + code validate via `/promotions/validate`)  
- Coupons always require code entry via `/coupons/validate`

### Platform vs vendor coupons

- Platform coupons: `coupons` table, admin API  
- Vendor coupons: not in this module (vendor portal separate)  
- Architecture supports parallel instruments without structural change; **targeting would need new columns + API fields for platform coupons**

---

## 12. Validation

| Layer | Location | Notes |
|-------|----------|-------|
| Legacy modal | Inline in marketing page | Minimal — required title/discount |
| Wizard | `packages/promotion-management-ui/src/validation.ts` | Name, code length, discount bounds, schedule, ≥1 target scope |
| Backend | `promotions.ts` | Inline `if (!name)` checks only — **no Zod** |

---

## 13. Promotion Flow (End-to-End)

```
Admin creates promo (legacy modal)
  → POST /marketing/promotions
  → Row in promotions (category, style, applicable_services, published)

Customer books service
  → GET /promotions/applicable OR calculate-booking stack
  → isPromotionEligible(category, style, serviceIds)
  → Discount applied if published + matching tokens

Admin creates promo (new wizard)
  → POST /admin/promotions
  → Row with discount fields ONLY (targeting dropped)  ⚠️

Customer enters coupon at checkout
  → GET /coupons/validate/:code
  → POST /coupons/apply → coupon_usages
```

---

## 14. Reuse Opportunities (Extension Strategy)

1. **Keep legacy modal shell** — extend Category + add target section using existing `PromotionTargetSelector`.
2. **Wire category dropdown** to `GET /admin/catalog/categories?type=service` or `/config/policy-options` — remove hardcoded 5-item list.
3. **Unify API path** — point both surfaces at `/marketing/promotions` (rich) OR extend `POST /admin/promotions` to persist wizard fields (preferred long-term: one handler).
4. **Populate wizard catalog** in `AdminPromotionHub` from existing admin catalog APIs (services, packages, meal plans, products).
5. **Link `/promotions` in sidebar** once catalog + API parity confirmed.
6. **Do not** revive `AdvancedPromotionsEngine` or `PromotionsManagement` — merge useful bits (multi-service checkboxes) into shared selector.

---

## 15. Known Functional Issues (Critical)

| Issue | Severity | Notes |
|-------|----------|-------|
| `/admin/promotions` POST ignores wizard targeting | High | Product gap masquerading as bug for `/promotions` route |
| Legacy category list incomplete + hardcoded | High | ADMIN-01 |
| Service style slug mismatch (save vs runtime) | Medium | Legacy modal saves `home_visit`; runtime expects `at_home` — partially normalized on read |
| `/marketing/promotions` lacks admin auth guard | Medium | Security / governance gap |
| Coupon bulk generate API missing | Low | UI calls non-existent endpoint |
| Promotion search not wired on legacy tab | Low | UX only |

---

*Analysis only — no code changes in this deliverable.*
