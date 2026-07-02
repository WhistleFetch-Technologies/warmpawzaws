# UX Sprint 2 — Promotion Management Experience

**Scope:** Admin Web + Vendor Web (service + seller hub). **No backend, API, database, or engine changes.**

## Objective

Enterprise-grade promotion management UX: clear promotion vs coupon flows, guided wizard, targeting, preview, visual lifecycle, and reusable components — while preserving existing API payloads via mappers.

## Shared package

`packages/promotion-management-ui` — imported as `@warmpawz/promotion-management-ui` in admin-web and vendor-web.

### Components

| Component | Purpose |
|-----------|---------|
| `PromotionDashboard` | Unified hub: tabs, search, filters, quick actions |
| `PromotionWizard` | 8-step guided create/edit (type split → review) |
| `PromotionCard` | Management list card with lifecycle + actions |
| `CouponCard` | Coupon list card |
| `PromotionTargetSelector` | Multi-scope targeting with search, pagination, select all |
| `PromotionPreview` | UI-only customer preview from form values |
| `PromotionSummary` | Review step summary |
| `PromotionDetailsPanel` | Side drawer: info, usage, timeline, coming soon |
| `PromotionStatusBadge` | Visual lifecycle chip |
| `PromotionTimeline` | Schedule lifecycle bar |
| `PromotionTypeSelector` | % / flat / BOGO / bundle / loyalty / first order |
| `PromotionTriggerSelector` | Audience (segments = coming soon) |
| `ComingSoonSection` | Priority, stack, funding, settlement, campaigns, analytics |

### Lib modules

| Module | Purpose |
|--------|---------|
| `types.ts` | Wizard form, normalized items, scope config |
| `lifecycle.ts` | Visual lifecycle from dates + `is_active` (no new backend states) |
| `validation.ts` | Client-side rules + duplicate code warning |
| `normalize.ts` | API rows → normalized UI model |
| `mappers.ts` | Wizard → existing admin/vendor API payloads |

## Screens updated

| App | Screen | Integration |
|-----|--------|-------------|
| Admin | `/promotions` | `AdminPromotionHub` → `PromotionDashboard` |
| Vendor | `ServicePromotionsManagement` | `ServicePromotionsHub` |
| Vendor | Seller `PromotionsManagement` | `SellerPromotionsHub` |

Legacy components (`AdvancedPromotionsEngine`, old modal forms) remain in repo but primary routes use the new hub.

## Wizard flow

1. **Create type** — Promotion (auto-applied) vs Coupon (code) — mutually exclusive fields
2. Basic information (name, description, visual status; code only for coupons)
3. Promotion type
4. Target audience
5. Targets (platform / vendor / service / package / meal / product / style)
6. Discount & limits
7. Schedule (timezone fixed; recurring placeholder)
8. Review + preview + validation → Publish or Save draft

## Reuse strategy

```
@warmpawz/promotion-management-ui
    ├── AdminPromotionHub (platform APIs + vendor catalog)
    ├── ServicePromotionsHub (service-promotions APIs + services)
    └── SellerPromotionsHub (seller promotions APIs + products)
```

Same dashboard, wizard, cards, and details drawer; scope config hides platform controls for vendors.

## Future extension points

- Wire `packages` / `mealPlans` catalog from APIs when list endpoints are exposed to admin
- Backend draft/archived/paused states (today mapped visually from `is_active` + dates)
- Promotion simulator (backend shadow quote)
- Segments audience, recurring schedule, approval workflow
- Stack / priority / funding / settlement / campaigns (placeholders in details drawer)

## Known limitations

- **Lifecycle** is visual only; publish/draft maps to `is_active` / `published` fields where they exist
- **Meal plan targeting** UI is present; catalog empty until API wired
- **Platform service/product search** on admin hub loads vendors only; services/products loaded per vendor context on vendor hubs
- **Coupon edit** on admin uses create/update endpoints; some coupon fields may not round-trip all wizard metadata
- **No analytics** in dashboard (excluded per sprint)

## No backend changes

- No API contract changes
- No migrations
- No Discount / Rule / Benefit / Unified Resolver changes
- Mappers translate wizard → existing POST/PUT bodies

## Validation checklist

- [ ] Admin: create promotion — no coupon code field shown
- [ ] Admin: create coupon — code required; no auto-apply chrome
- [ ] Vendor service: wizard shows service/package/style targets
- [ ] Vendor seller: product + category targets
- [ ] Preview shows estimated savings from entered values
- [ ] Dashboard tabs: active / scheduled / expired / draft / coupons / recent
- [ ] Details drawer shows timeline + coming soon blocks
- [ ] Existing save/delete/toggle still hits same endpoints

Build:

```bash
cd apps/admin-web && npm ci && npm run build
cd apps/vendor-web && npm ci && npm run build
```
