# Target Selection — Reuse Plan

**Date:** 2026-07-06  
**Status:** Analysis only  
**Companion:** `TARGET_SELECTION_ARCHITECTURE.md`, `TARGET_SELECTION_IMPLEMENTATION_ROADMAP.md`

---

## 1. Objective

Maximize reuse of existing promotion UI and backend integration. **Never duplicate** target selection logic across Admin, Vendor, Seller, and Campaign Builder.

---

## 2. Reuse Inventory

### 2.1 Components to REUSE (keep, extend in place)

| Component | Path | Reuse role |
|-----------|------|------------|
| `PromotionTargetSelector` | `packages/promotion-management-ui/src/components/PromotionTargetSelector.tsx` | Core checkbox + scope chip UI — **extend**, don't replace |
| `PromotionWizard` | `packages/promotion-management-ui/src/components/PromotionWizard.tsx` | Target step host for all actors |
| `PromotionDashboard` | `packages/promotion-management-ui/src/components/PromotionDashboard.tsx` | Hub shell — admin + vendor |
| `PromotionSummary` | `packages/promotion-management-ui/src/components/PromotionSummary.tsx` | Show selected targets in review step |
| `PromotionDetailsPanel` | `packages/promotion-management-ui/src/components/PromotionDetailsPanel.tsx` | Read-only target display on cards |
| `PromotionCard` / `CouponCard` | `packages/promotion-management-ui/src/components/` | Target chips on list rows |
| `targeting.ts` | `packages/promotion-management-ui/src/targeting.ts` | Parse/build tokens — extend for descriptor |
| `mappers.ts` | `packages/promotion-management-ui/src/mappers.ts` | Payload mapping — extend, don't fork |
| `types.ts` | `packages/promotion-management-ui/src/types.ts` | `TargetScopeId`, `PromotionTargetCatalog`, forms |
| `validation.ts` | `packages/promotion-management-ui/src/validation.ts` | Wizard validation rules |
| `promotion-catalog-loader.ts` | `apps/admin-web/lib/promotion-catalog-loader.ts` | Admin catalog — refactor to lazy loaders |
| `surface-config.ts` | `apps/admin-web/lib/promotion-domain/surface-config.ts` | Marketing/ecommerce scope + catalog slice |
| `AdminPromotionHub` | `apps/admin-web/components/admin/marketing/AdminPromotionHub.tsx` | Admin entry — wire new hook |
| `ServicePromotionsHub` | `apps/vendor-web/.../ServicePromotionsHub.tsx` | Vendor catalog builder — tighten filters |
| `SellerPromotionsHub` | `apps/vendor-web/.../SellerPromotionsHub.tsx` | Seller catalog — extend scopes |
| `CampaignOrchestrationPanel` | `apps/admin-web/.../CampaignOrchestrationPanel.tsx` | Already uses wizard + catalog loader |

### 2.2 Components to EXTEND (new props/hooks, same file)

| Component | Extension |
|-----------|-----------|
| `PromotionTargetSelector` | Add optional `contextBar`, `onSearch`, `paginatedOptions`, `totalCount`, `loading` props |
| `PromotionWizard` | Pass catalog query hook instead of static catalog blob |
| `targeting.ts` | Add `buildPromotionTargetDescriptor()` / `parsePromotionTargetDescriptor()` |
| `mappers.ts` | Include descriptor in all payloads; extend coupon mapper with targets |
| `promotion-catalog-loader.ts` | Split into `loadTargetCatalogSlice()` functions per scope |
| `ServicePromotionsHub` | Apply `isActiveLike` + `isApprovedOrUnversioned` to services list |
| `SellerPromotionsHub` | Populate `group` from category; prepare collection scope |

### 2.3 Components to RETIRE (gradual, not delete in Phase 1)

| Component | Path | Retirement plan |
|-----------|------|-----------------|
| `AdvancedPromotionsEngine` (legacy modal) | `apps/admin-web/components/admin/marketing/` | Hide link after wizard parity; deprecate |
| Hardcoded category `<Select>` in legacy modal | same | Remove when modal retired |
| Duplicate catalog fetch logic | vendor hubs vs admin loader | Extract shared `mapServiceOption` patterns to package util |

**Constraint:** Do not delete legacy code until production cutover validated (aligns with Phase 8 discipline).

### 2.4 Components NOT to duplicate

| Avoid creating | Use instead |
|----------------|-------------|
| `AdminTargetPicker.tsx` | Extend `PromotionTargetSelector` |
| `VendorTargetPicker.tsx` | Same selector + `enabledScopes` |
| `SellerProductPicker.tsx` | Same selector + seller catalog hook |
| `CampaignTargetPicker.tsx` | `PromotionWizard` in orchestration panel |
| Separate audience+inventory mega-component | Keep `CampaignAudienceEditor` separate |

---

## 3. Extension Points

### 3.1 PromotionTargetSelector API (proposed)

```typescript
// Additive props — backward compatible
interface PromotionTargetSelectorProps {
  // existing props unchanged ...
  contextBar?: React.ReactNode;
  catalogMode?: 'static' | 'paginated';
  paginatedState?: {
    items: TargetOption[];
    total: number;
    page: number;
    pageSize: number;
    loading: boolean;
    onPageChange: (page: number) => void;
    onSearchChange: (query: string) => void;
  };
  selectionSummary?: React.ReactNode;
}
```

When `paginatedState` omitted → current behaviour (static catalog).

### 3.2 Catalog hook (new file — package or admin-web)

```
packages/promotion-management-ui/src/hooks/useTargetCatalogQuery.ts
```

Parameters: `{ actor, surface, scope, vendorId?, search, page }`  
Returns: `{ items, total, loading, error, refetch }`

Admin-web implements API adapters; vendor hubs pass `actor: 'vendor'`.

### 3.3 Target domain registry (future)

```
packages/promotion-management-ui/src/domains/target-domain-registry.ts
```

Registers scopes per domain without editing `PromotionWizard.enabledScopes()` switch repeatedly.

### 3.4 Engine extension point

```
backend/lambda/src/discount-engine/targets/target-resolver.ts
```

Single import point for checkout/booking/cart paths — avoids duplicating ID expansion in each service.

---

## 4. Shared vs Actor-Specific

| Concern | Shared | Actor-specific |
|---------|--------|----------------|
| Scope chip UI | ✅ | enabledScopes config |
| Checkbox list | ✅ | — |
| Search input | ✅ | server vs client mode |
| Catalog loading | Hook interface ✅ | API adapter per actor |
| Payload mapping | targeting.ts ✅ | mappers.ts per actor |
| Inventory filters | Filter utils ✅ | rules differ by actor |
| Context bar | Component ✅ | admin/seller only |
| Audience segments | ❌ | CampaignAudienceEditor only |

---

## 5. Campaign Builder Reuse

| Step | Current | Recommended |
|------|---------|-------------|
| Create promotion in campaign | `CampaignOrchestrationPanel` + `PromotionWizard` | **Keep** — already correct reuse |
| Campaign builder 8-step | No inventory picker | Embed wizard OR link to orchestration |
| Audience | `CampaignAudienceEditor` | **Keep separate** — not inventory |

**Action:** Add cross-link in `CampaignBuilderDialog` — "Define inventory targets in linked promotion" with deep link to wizard.

**Do not** embed full `PromotionTargetSelector` in `CampaignAudienceEditor` — violates separation of concerns.

---

## 6. Dialog / Table / Search Reuse

| UI pattern | Existing | Reuse for targets |
|------------|----------|-------------------|
| Search input with icon | `PromotionTargetSelector` | ✅ extend with debounce |
| Pagination footer | `PromotionTargetSelector` | ✅ extend for server pages |
| Empty state | `PromotionTargetSelector` | ✅ enrich messages |
| Filter chips | Scope chips | ✅ add context chips |
| Data tables | `PromotionDashboard` list | Read-only targets only |
| Modals | `PromotionWizard` | ✅ single create/edit modal |

**@warmpawz/ui** primitives (`Input`, `Select`, `Button`) — continue using; no custom design system fork.

---

## 7. API Reuse

| API | Reuse | Extend |
|-----|-------|--------|
| `GET /admin/catalog/categories` | ✅ | cache headers |
| `GET /admin/catalog/services` | ✅ | +search, +page, raise LIMIT |
| `GET /admin/vendors` | ✅ | +search, +page |
| `GET /vendor/{id}/services/enabled` | ✅ | +search optional |
| `GET /vendor/{id}/products` | ✅ | +collection filter future |
| New unified endpoint | Phase 2 optional | — |

**Minimal backend principle:** Query params on existing routes before new endpoint.

---

## 8. Migration Approach (Reuse-Safe)

### Step 1 — Extend selector (no breaking changes)

- Add optional paginated props
- Default = current static behaviour
- All hubs keep working

### Step 2 — Extract catalog mappers to package

Move `mapServiceOption`, `mapVendorOption` from admin loader to:

```
packages/promotion-management-ui/src/catalog-mappers.ts
```

Vendor hubs import same mappers — consistent labels/subtitles.

### Step 3 — Admin lazy load behind feature flag

```
NEXT_PUBLIC_PROMO_TARGET_SMART_CONTEXT=true
```

Admin uses paginated mode; vendor unchanged.

### Step 4 — Descriptor persistence

Extend `targeting.ts` — all mappers call shared builder.

### Step 5 — Retire legacy modal

Remove link from `AdminPromotionHub` when flag default on.

---

## 9. Testing Reuse Strategy

| Test | Location |
|------|----------|
| `targeting.ts` parse/build | `packages/promotion-management-ui/src/__tests__/targeting.test.ts` (extend) |
| Selector pagination UX | Storybook or component test in package |
| Catalog loader slices | `apps/admin-web/lib/__tests__/promotion-catalog-loader.test.ts` |
| Engine resolver | `backend/lambda/src/discount-engine/targets/__tests__/` |

**Do not** duplicate targeting tests in admin-web and vendor-web — test once in package.

---

## 10. Anti-Patterns to Avoid

| Anti-pattern | Why |
|--------------|-----|
| Fork `PromotionTargetSelector` per app | Drift guaranteed |
| Admin-only target step in wizard copy-paste | Breaks campaign reuse |
| New `applicable_*` column per domain | Extend descriptor JSON |
| Client preload 100k services "for speed" | Memory + truncation |
| Inline fetch in wizard steps | Use hook |
| Separate coupon target UI | Extend same selector + mapper |

---

## 11. Summary

**Reuse:** `PromotionTargetSelector`, `PromotionWizard`, `PromotionDashboard`, `targeting.ts`, `mappers.ts`, `promotion-catalog-loader.ts`, `surface-config.ts`, campaign orchestration panel.

**Extend:** Selector pagination/context, targeting descriptor, admin catalog lazy load, vendor service filters, coupon mappers.

**Retire:** Legacy `AdvancedPromotionsEngine` modal (after parity).

**Never duplicate:** Target pickers, token parsing, or catalog mapping logic per portal.

---

*End of reuse plan.*
