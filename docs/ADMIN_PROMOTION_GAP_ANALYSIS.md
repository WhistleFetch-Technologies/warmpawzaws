# Admin Promotion Management — Gap Analysis

**Date:** 2026-06-30  
**Companion doc:** `ADMIN_PROMOTION_CURRENT_STATE.md`  
**Constraints honored:** No new wizard, no modal replacement, no Stack/Settlement/Campaigns/Analytics implementation.

---

## Answer: Should admin select individual services?

**Yes — for a marketplace like Warmpawz, category-only targeting is not enough.**

| Use case | Category-only | Individual service / SKU targeting |
|----------|-----------------|-------------------------------------|
| “20% off all grooming” | Sufficient | Overkill |
| “₹100 off wound dressing at clinic” | Too broad — discounts unrelated services | **Required** |
| “Launch promo on one meal plan” | Wrong — hits all nutrition | **Required** |
| “Flash sale on one SKU” | Wrong | **Required (product id)** |
| “Platform spotlight on diagnostic package” | Imprecise | **Required (package id)** |

**Recommendation:** Support **both** levels in the same flow:

1. **Broad campaigns** — entire marketplace, category, or category + style  
2. **Surgical campaigns** — pick specific services, packages, meal plans, or products  

The shared `PromotionTargetSelector` already supports this UX pattern. The gap is **catalog loading + API persistence**, not missing UI concept.

Category-only is a valid **default** for simple admin users, but limiting the platform to category-only would block common marketing scenarios and mirrors the vendor-side capability gap you already fixed on the vendor portal.

---

## Gap Summary Matrix

| ID | Gap | Priority | Can extend existing? | Backend needed? | Phase |
|----|-----|----------|---------------------|-----------------|-------|
| ADMIN-01 | Incomplete category list | 🔴 High | Yes — wire dropdown to API | Optional (API exists) | Phase 1 |
| ADMIN-02 | Coarse targeting only on production modal | 🔴 High | Yes — embed `PromotionTargetSelector` | Yes — unify persistence | Phase 1–2 |
| ADMIN-03 | `/admin/promotions` drops wizard targeting | 🔴 High | Yes — fix handler or route wizard to `/marketing/promotions` | Yes | Phase 1 |
| ADMIN-04 | Empty admin target catalog | 🔴 High | Yes — `AdminPromotionHub.load()` | Yes — list endpoints | Phase 1 |
| ADMIN-05 | Service style slug inconsistency | 🟡 Medium | Yes — normalize in legacy modal | Minor | Phase 1 |
| ADMIN-06 | Two admin surfaces, one sidebar link | 🟡 Medium | Yes — link `/promotions` after parity | No | Phase 2 |
| ADMIN-07 | Coupon bulk generate missing | 🟡 Medium | Yes — `CouponManagement` | Yes | Phase 2 |
| ADMIN-08 | Coupon targeting | 🟢 Future | Extend coupon form | Yes — schema + API | Phase 3 |
| ADMIN-09 | Vendor-specific platform promos | 🟢 Future | `PromotionTargetSelector` has vendors scope | Yes — business rules | Phase 3 |
| ADMIN-10 | Audience (new/VIP) for platform | 🟢 Future | Wizard has tiles | Yes — store + enforce | Phase 3 |
| ADMIN-11 | Stack / settlement / campaigns | ⚪ Out of scope | N/A | N/A | Future phase |

---

## ADMIN-01 — Incomplete Category Support

### Current

Legacy modal hardcodes 5 categories:

`vet`, `grooming`, `walking`, `training`, `boarding`

### Missing (examples from platform elsewhere)

| Category | Seen in |
|----------|---------|
| pharmacy | AdvancedPromotionsEngine, fee calculator |
| nutritionist / meal | fee calculator, customer meal flows |
| walker | AdvancedPromotionsEngine |
| shop / e-commerce / pet_store | fee calculator, `/config/policy-options` |
| cafe | fee calculator |
| insurance | AdvancedPromotionsEngine |
| diagnostics | customer flows |
| Any new vertical | `service_categories` table via admin catalog |

### Root cause

Category `<Select>` is **hardcoded in JSX** — does not call:

- `GET /admin/catalog/categories?type=service`
- `GET /config/policy-options`
- `GET /admin/roles`

`loadRoles()` on the same page **does** fetch roles but uses them only for Dashboard UI / service launch config.

### Recommendation

**Phase 1 — UI only (can extend existing modal):**

1. Replace hardcoded `<SelectItem>` list with options from `GET /admin/catalog/categories?type=service`.
2. Map `category_id` / slug consistently to what `isPromotionEligible` expects.
3. Keep “All Categories” as explicit `all` value.

**Phase 1 — normalization (backend):**

- Document canonical slug map (`vet` ↔ `veterinary`) in one shared constant used by admin + runtime.

| Classification | |
|----------------|--|
| Can extend existing | ✅ Legacy modal Select |
| Requires backend | Optional (API already exists) |
| Requires UI only | ✅ Primary fix |
| Future phase | Multi-category without selector refactor |

---

## ADMIN-02 — Admin Targeting Too Coarse

### Current (production path — your screenshot)

```
Category dropdown (5 options)
  ↓
Service Style dropdown (3 options)
  ↓
Save → applicable_services = [category?, style:?]
```

No individual service, package, meal plan, or product picker.

### Expected (product requirement)

| Scope | Status |
|-------|--------|
| Entire Marketplace | ✅ Supported (`all`) |
| Category | ⚠️ Partial (incomplete list, single select) |
| Individual Services | ❌ Not in legacy modal |
| Packages | ❌ |
| Meal Plans | ❌ |
| Products | ❌ |
| Vendor-specific (future) | ❌ Platform promos |

### What already exists (reuse — do not rebuild)

`PromotionTargetSelector` in `@warmpawz/promotion-management-ui`:

- Multi-scope chips: entire platform, categories, services, packages, meal plans, products, styles, vendors  
- Search + pagination + select all  
- Used by vendor portal successfully  

### Recommendation

**Phase 1:** Add collapsible “Advanced targeting” section to **legacy modal** (or migrate create action to open wizard in modal shell — same component, not new wizard).

**Phase 2:** Populate catalog in `AdminPromotionHub`:

```typescript
// Today
categories: undefined,
services: [],
packages: [],
mealPlans: [],
products: [],

// Target
categories: from GET /admin/catalog/categories
services: from GET /admin/catalog/services (paginated)
packages: from admin package list API
mealPlans: from meal plan admin API
products: from ecommerce catalog API
```

**Phase 2 backend:** Ensure save path writes:

- `applicable_services` JSONB (mixed tokens + UUIDs)  
- `service_category` / `service_style` when category/style scopes selected  
- `published`, `metadata.promotionTarget`

| Classification | |
|----------------|--|
| Can extend existing | ✅ PromotionTargetSelector + legacy modal |
| Requires backend | ✅ Persist targets on admin create |
| Requires UI only | Partial |
| Future phase | Vendor-specific platform promos |

---

## ADMIN-03 — API Split Bug (Wizard Targeting Lost)

### Problem

| UI route | Save API | Targeting persisted |
|----------|----------|---------------------|
| `/marketing` legacy | `/marketing/promotions` | ✅ Yes |
| `/promotions` wizard | `/admin/promotions` | ❌ No |

`wizardToAdminPromotionPayload()` sends:

```json
{
  "applicable_service_ids": [...],
  "applicable_category_ids": [...],
  "applicable_services": [...],
  "applicable_to": "services|products|all",
  "published": true,
  "targetAudience": "all"
}
```

`POST /admin/promotions` handler **only inserts:**

`name`, `description`, `discount_type`, `discount_value`, dates, usage limits, `applicable_to`, `is_active`, optional `code`.

### Impact

Admin using `/promotions` wizard believes they targeted specific services; checkout applies promo **platform-wide** (no tokens stored).

### Recommendation (pick one — both extend existing)

**Option A (fastest):** Point `AdminPromotionHub.handleSave` at `/marketing/promotions` with a mapper aligned to that handler’s field names.

**Option B (cleaner):** Extend `POST/PUT /admin/promotions` to mirror `/marketing/promotions` targeting field handling (single code path).

| Classification | |
|----------------|--|
| Can extend existing | ✅ Same tables, same handler file |
| Requires backend | ✅ Required |
| Priority | 🔴 Phase 1 |

---

## ADMIN-04 — Empty Admin Target Catalog

### Problem

`AdminPromotionHub` only loads vendors + 3 hardcoded styles. Wizard target steps show empty lists.

### APIs to wire (already exist in admin-advanced)

| Target | Suggested API |
|--------|---------------|
| Categories | `GET /admin/catalog/categories?type=service` |
| Products / ecommerce categories | `GET /admin/catalog/categories?type=ecommerce` |
| Services | `GET /admin/catalog/services` (paginated) |
| Packages | Admin packages endpoint (vendor package catalog) |
| Meal plans | Meal plan admin list |
| Vendors | Already loaded |

| Classification | |
|----------------|--|
| Can extend existing | ✅ AdminPromotionHub.load() only |
| Requires backend | List endpoints may need pagination/filter params |
| Phase | 1–2 |

---

## ADMIN-05 — Service Style Slug Inconsistency

### Three schemes in codebase

| Location | Values |
|----------|--------|
| Legacy modal (save) | `home_visit`, `clinic`, `online` |
| Legacy modal (load display) | Normalized to `at_home`, `at_center`, `tele` |
| New hub / runtime | `at_home`, `at_center`, `tele` |
| Policy config | `in_clinic`, `teleconsultation`, `doorstep`, `centre` |

### Risk

Promo saved with `style:home_visit` may fail eligibility if normalization missed on read path.

### Recommendation

Save canonical slugs from legacy modal (`at_home`, `at_center`, `tele`) — UI-only change + shared constant.

---

## Promotion Scope — Detailed Support Table

| Capability | Supported | Partial | Not supported |
|------------|-----------|---------|---------------|
| Platform-wide | ✅ | | |
| Single category | | ✅ (incomplete list) | |
| Multi category | | | ❌ legacy modal |
| Service style filter | | ✅ (slug drift) | |
| Specific service UUID | | ✅ API only | ❌ admin UI |
| Package ID | | | ❌ |
| Meal plan ID | | | ❌ |
| Product / SKU | | ✅ runtime tokens | ❌ admin UI |
| Product category | | | ❌ |
| Vendor role filter | | ✅ `/marketing` API | ❌ legacy UI |
| Vendor-specific platform promo | | | ❌ (future) |
| BOGO / bundle / combo (platform) | | Type string stored | ❌ benefit math |

---

## Coupon Support Analysis

### Current

- Separate `coupons` table and admin CRUD  
- No targeting — platform-wide codes only  
- Wizard can create coupons but same targeting gap does not apply (coupons don't send targets today)

### Can support without architectural rewrite?

| Feature | Feasible? | Notes |
|---------|-----------|-------|
| Platform promotions | ✅ | Already in `promotions` |
| Platform coupons | ✅ | Already in `coupons` |
| Targeted platform coupons | ⚠️ | Needs columns + validate/apply context checks (same as promos) |
| Future vendor coupons | ✅ | Separate vendor tables already exist |
| Promo + coupon stacking rules | ❌ | Out of scope (Stack Engine) |

### Recommendation

Phase 3: Add optional `applicable_services` JSONB to coupons (or reuse promotion row with `requires_code = true`) — **design choice**, not greenfield.

---

## UX Issues

| Issue | Location | Fix type |
|-------|----------|----------|
| Search not wired | Legacy promotions table | UI only |
| Two create flows with different behavior | `/marketing` vs `/promotions` | Product + backend |
| `/promotions` not in sidebar | Nav config | UI only |
| Style labels differ (“Home Visit” vs “At home”) | Legacy vs wizard | UI copy + slug fix |
| Delete semantics differ | `/marketing` soft vs `/admin` hard | Align behavior |
| Wizard shows empty target lists | AdminPromotionHub | Catalog load |

---

## Functional Bugs

| Bug | Severity | Fix |
|-----|----------|-----|
| Wizard targeting not saved via `/admin/promotions` | 🔴 Critical | Backend handler or route change |
| Incomplete categories | 🔴 High | Dynamic category source |
| Legacy style tokens on save | 🟡 Medium | Normalize on save |
| `/marketing/promotions` no admin auth | 🟡 Medium | Add requireAdmin |
| Bulk coupon generate 404 | 🟡 Low | Implement or remove UI |

---

## Recommended Extension Plan

### Phase 1 — Fix production correctness (extend existing)

**Goal:** Legacy Marketing Hub + wizard both persist targeting correctly; categories complete.

1. Wire legacy Category dropdown → `GET /admin/catalog/categories?type=service` (+ “All”).
2. Fix `POST /admin/promotions` to persist targeting fields OR route wizard saves to `/marketing/promotions`.
3. Normalize service style slugs in legacy modal to `at_home` / `at_center` / `tele`.
4. Populate `AdminPromotionHub` catalog: categories + styles (minimum for wizard parity).

**Files (expected touch):**

- `apps/admin-web/app/marketing/page.tsx` — category source, optional target section  
- `apps/admin-web/components/admin/marketing/AdminPromotionHub.tsx` — catalog load  
- `backend/lambda/src/endpoints/promotions.ts` — unify admin create/update  
- `packages/promotion-management-ui/src/mappers.ts` — payload alignment if needed  

**No new wizard. No modal replacement.**

### Phase 2 — Full target selector in legacy flow

1. Add `PromotionTargetSelector` to legacy create/edit modal (advanced section).
2. Load services, packages, meal plans, products into catalog.
3. Add `/promotions` to sidebar once parity verified.
4. Wire promotion list search on legacy tab.

### Phase 3 — Future enhancements

- Platform coupon targeting  
- Vendor-specific platform campaigns  
- Audience segments (new/returning/VIP) stored + enforced  
- Auth hardening on `/marketing/promotions`  
- Stack / settlement / campaigns / analytics (explicitly out of current scope)

---

## Component Reuse Checklist

| Need | Reuse | Do not create |
|------|-------|---------------|
| Target picking | `PromotionTargetSelector` | New target modal |
| Category list | `/admin/catalog/categories` API + Select | Hardcoded enum |
| Promo form validation | `validation.ts` | Duplicate rules |
| Save mapping | Extend `mappers.ts` | New mapper file |
| List + lifecycle | `PromotionDashboard` / legacy table | Third list component |
| Vendor target reference | Vendor `ServicePromotionsHub` catalog loading pattern | Copy-paste new loader |

---

## Success Criteria Mapping

| Criterion | Status |
|-----------|--------|
| Complete understanding of current module | ✅ Documented in CURRENT_STATE |
| Reusable components identified | ✅ promotion-management-ui + AdminPromotionHub |
| Functional gaps documented | ✅ This doc |
| Missing targeting documented | ✅ ADMIN-02, scope table |
| Missing categories documented | ✅ ADMIN-01 |
| Extension strategy defined | ✅ Phase 1–3 above |
| No code changes | ✅ Analysis only |

---

*Local analysis deliverable — not committed per instruction.*
