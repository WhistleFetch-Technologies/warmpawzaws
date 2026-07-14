# Target Selection — Gap Analysis

**Date:** 2026-07-06  
**Companion:** `TARGET_SELECTION_CURRENT_STATE.md`, `TARGET_SELECTION_UX_RECOMMENDATION.md`

---

## 1. Purpose

Identify UX, technical, performance, and scalability gaps in the current Promotion Target Selection experience across Admin, Vendor, Seller, Campaign Builder, Analytics, and Discount Engine integration.

---

## 2. Gap Summary Matrix

| ID | Gap | Domain | Priority | UX | Tech | Perf | Scale |
|----|-----|--------|----------|----|----|------|-------|
| GAP-01 | Admin flat catalog hits hard limits (100 services, 200 vendors) | All admin | 🔴 Critical | ✓ | ✓ | ✓ | ✓ |
| GAP-02 | Platform vs vendor ID mismatch | Service | 🔴 Critical | ✓ | ✓ | — | ✓ |
| GAP-03 | Admin coupon wizard has no inventory targeting | Admin | 🔴 High | ✓ | ✓ | — | — |
| GAP-04 | Mixed token persistence (`applicable_services`) | Platform | 🔴 High | — | ✓ | — | ✓ |
| GAP-05 | No hierarchical vendor→inventory navigation (admin) | Admin | 🟡 High | ✓ | ✓ | ✓ | ✓ |
| GAP-06 | Campaign builder lacks inventory target picker | Campaign | 🟡 High | ✓ | ✓ | — | — |
| GAP-07 | Seller missing collections/brands/variants | E-Commerce | 🟡 Medium | ✓ | ✓ | — | ✓ |
| GAP-08 | Client-only search/pagination | All | 🟡 Medium | ✓ | ✓ | ✓ | ✓ |
| GAP-09 | Legacy modal parallel to wizard | Admin | 🟡 Medium | ✓ | ✓ | — | — |
| GAP-10 | Pharmacy/insurance/events not in catalog loader | Future | 🟢 Medium | ✓ | ✓ | — | ✓ |
| GAP-11 | Vendor services: no explicit unpublished filter on services list | Vendor | 🟢 Low | ✓ | ✓ | — | — |
| GAP-12 | Analytics cannot slice by granular target IDs easily | Analytics | 🟢 Medium | — | ✓ | ✓ | ✓ |
| GAP-13 | `/admin/promotions` may drop wizard target metadata | Admin | 🔴 High | — | ✓ | — | — |
| GAP-14 | No server-side typeahead for large catalogs | All | 🟡 Medium | ✓ | ✓ | ✓ | ✓ |
| GAP-15 | Franchise / enterprise vendor grouping absent | Future | 🟢 Low | ✓ | ✓ | — | ✓ |

---

## 3. UX Gaps

### 3.1 Admin — "One massive catalog" problem

**Current:** Admin loads all catalog slices in parallel, presents flat checkbox lists per scope.

**Problems:**

- Cognitive overload when scopes contain hundreds/thousands of items.
- No contextual narrowing (pick vendor first, then see their services).
- Marketing vs ecommerce split is surface-level only; underlying loader still fetches everything.
- Selecting "Services" shows platform catalog names without vendor attribution in subtitle (only `category_name`, `service_style`).
- Combining vendor scope + service scope has no guided relationship ("these services belong to selected vendors").

**Impact:** Admin operators cannot confidently run surgical promos at scale; risk of wrong targets when list is truncated.

### 3.2 Vendor — Inventory visibility rules inconsistent

**Current:**

- Services from `/services/enabled` — endpoint name implies enabled only; no client status filter.
- Packages/meals — explicit active + approved filters.

**Problems:**

- Unclear whether draft/unpublished services appear (depends on API, not documented in UI).
- No visual distinction between archived vs live inventory.
- Vendors cannot target "entire shop" or category within their inventory (only per-item + styles).

**Impact:** Vendors may create promos on items customers cannot book/buy.

### 3.3 Seller — Product targeting too coarse

**Current:** Flat product list + category strings derived from products.

**Missing:**

- Collections (seasonal shop sections)
- Brands
- Variant/SKU level promos
- Stock-aware targeting (in-stock only)
- Multi-select category tree

**Impact:** Flash sales on one SKU require picking from undifferentiated product list; does not match Shopify-style seller mental models.

### 3.4 Customer — No transparency gap (acceptable)

Customers don't pick targets. Gap is **discoverability** of why a promo applied — out of scope for selector but affects trust.

### 3.5 Campaign Builder disconnect

**Current:** `CampaignAudienceEditor` handles customer segments only.

**Gap:** Campaigns cannot define inventory targets inline; must attach pre-built promotions. Orchestration panel uses full wizard but is separate from `CampaignBuilderDialog` 8-step flow.

**Impact:** Two mental models — "campaign audience" vs "promotion targets" — confuse operators.

### 3.6 Accessibility & mobile

| Area | Current | Gap |
|------|---------|-----|
| Keyboard | Native checkboxes | No arrow-key list navigation, no typeahead focus trap |
| Screen reader | Labels on checkboxes | Scope chip state not announced as a group |
| Mobile | Responsive layout | 8-item page + small chips = high tap count |
| Error recovery | Generic empty state | No "catalog failed to load" per-slice retry |

---

## 4. Technical Gaps

### 4.1 ID architecture fragmentation

```
Admin promotion → service_catalog.service_id (platform)
Vendor promotion → vendor_services.id (inventory)
Booking checkout → may receive either depending on path
```

**Problems:**

- Admin promo on `service_id=X` does not automatically apply to all vendors offering catalog service X unless engine maps catalog→vendor rows.
- Round-trip edit relies on catalog loaded at edit time; misclassification if catalog slice incomplete.
- `parseApplicableServicesToTargets` defaults unknown UUIDs to services — silent data corruption risk.

### 4.2 Persistence inconsistency

| Field | Used by | Issue |
|-------|---------|-------|
| `applicable_services[]` | Platform promos | Mixed types in one array |
| `applicable_service_ids[]` | Wizard payload | May not persist through all API handlers |
| `metadata.promotionTarget` | Round-trip | Not always written |
| `target_scopes` / `selected_targets` | Wizard | Handler-dependent |
| Admin coupons | — | No target columns in wizard payload |

### 4.3 API coverage

- No unified `GET /promotion-targets/catalog?actor=admin&domain=service&vendorId=` endpoint.
- Admin services endpoint LIMIT 100 vs export LIMIT 5000 — inconsistent.
- No paginated search API for target picker consumption.

### 4.4 Engine integration gaps

Discount Engine V2 normalizes candidates via `candidate-normalizer.ts` but **matching logic** must resolve:

- Platform promo tokens vs cart line item IDs at checkout
- Category slug case normalization
- Style token variants (`at_home` vs `home_visit`)

Legacy engines still authoritative in production (`DISCOUNT_ENGINE_V2_RESOLVER_MODE=OFF` default).

### 4.5 Campaign ↔ promotion linking

Commercial campaigns store promotion references; target resolution deferred to linked promotion rows. No denormalized target snapshot on campaign for analytics immutability.

---

## 5. Performance Gaps

### 5.1 Current load profile (admin hub open)

| Request | Est. rows (dev) | Est. rows (growth) |
|---------|-----------------|---------------------|
| Categories | 10–30 | 50+ |
| Services | **100 max** | 100,000+ catalog |
| Vendors | **200 max** | 5,000+ |
| Products | varies | 500,000+ |
| Packages | varies | 10,000+ |
| Meal plans | varies | 5,000+ |

**Total:** 8 parallel requests on every hub mount; full payload held in React state.

### 5.2 Client selector cost

- `useMemo` filter over full array on every keystroke — O(n) per scope.
- Select-all on filtered 10,000 items → large state update.
- No debounce on search input.

### 5.3 Projected breakpoints

| Scale | Current behaviour | Result |
|-------|-------------------|--------|
| 100 vendors | Works | OK |
| 500 vendors | 200 loaded | 60% invisible |
| 5,000 vendors | 200 loaded | Broken for vendor-scoped promos |
| 100,000 services | 100 loaded | Broken for surgical admin promos |
| 100,000 services (vendor) | Per-vendor API | OK if vendor has <500 items |

---

## 6. Scalability Gaps

### 6.1 New domains

Adding Pharmacy, Insurance, Events, Pet Marketplace requires:

1. New catalog slice in loader
2. New `TargetScopeId` in types
3. New scope in `enabledScopes`
4. Engine candidate provider
5. Persistence column or token convention

No extension registry — each domain is a code change across 4+ files.

### 6.2 International / white-label

- Category slugs may collide across locales.
- No tenant-scoped catalog loader abstraction.
- Vendor list not filterable by region/franchise.

### 6.3 Enterprise accounts

- No parent→child vendor hierarchy in target picker.
- Cannot target "all locations of franchise X".

---

## 7. Business Domain Analysis

### 7.1 Service Marketplace

| Need | Supported | Gap |
|------|-----------|-----|
| Entire platform | ✅ | — |
| Category-wide | ✅ | Dynamic categories OK |
| Style-specific | ✅ | Token normalization debt |
| Single service | ⚠️ | Admin limited to 100 catalog rows |
| Vendor-specific platform promo | ⚠️ | Vendor scope exists; no vendor→service drill-down |

### 7.2 E-Commerce Marketplace

| Need | Supported | Gap |
|------|-----------|-----|
| Product SKU | ✅ | Flat list only |
| Category | ✅ | String categories, not taxonomy |
| Collection | ❌ | Not in catalog |
| Brand | ❌ | Not in catalog |
| Variant | ❌ | Product-level only |

### 7.3 Meals

| Need | Supported | Gap |
|------|-----------|-----|
| Platform meal plan | ✅ | Via `/meal-plans/search` |
| Vendor meal plan | ✅ | Capability-gated |
| Meal category | ❌ | No scope |

### 7.4 Packages

| Need | Supported | Gap |
|------|-----------|-----|
| Regional platform package | ✅ | |
| Vendor package | ✅ | Dual source (services flagged + packages API) |

### 7.5 Future domains (Pharmacy, Insurance, Events, Pet Marketplace)

**Recommendation prep gap:** No `TargetDomain` abstraction — each would bolt onto `PromotionTargetCatalog` interface as optional arrays.

---

## 8. Analytics Gaps

**Current:** Analytics aggregator supports `byCategory` rollup.

**Missing:**

- Filter/report by `selected_targets.services[]` etc.
- Immutable target snapshot at promo creation time
- Campaign-level target composition view
- Vendor ID vs platform ID dimension split

**Risk:** Historical reports become inaccurate if catalog IDs remap or services relink.

---

## 9. Problems Prioritized by User Impact

### P0 — Blocks correct operation at scale

1. Admin catalog truncation (100 services / 200 vendors)
2. ID space mismatch admin vs vendor vs checkout
3. Wizard target metadata not persisted reliably (ADMIN-03)

### P1 — Degrades operator productivity

4. Flat catalog UX for admin
5. Admin coupons cannot target inventory
6. Campaign builder / promotion target inconsistency

### P2 — Limits growth domains

7. No seller collections/brands/variants
8. No server-side search/pagination
9. Future domain extension mechanism

### P3 — Polish

10. Accessibility improvements
11. Per-slice catalog error retry UI
12. Vendor service status filter parity

---

## 10. Comparison to Stated Product Intent

From `ADMIN_PROMOTION_GAP_ANALYSIS.md`:

> Support both broad campaigns and surgical campaigns in the same flow.

**UI supports both** via scope chips. **Data layer does not** support surgical admin campaigns at platform scale due to catalog limits and ID mapping.

---

*End of gap analysis.*
