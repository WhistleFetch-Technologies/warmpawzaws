# Warmpawz Pay — Admin Implementation Plan

**Milestone:** `feature/wpay-admin`  
**Scope:** Vendor catalogue administration **only** (no payment observability)  
**Companion analysis:** `docs/WARMPAWZ_PAY_ADMIN_ANALYSIS_V2.md`  
**Prerequisite:** Phase 1 schema merged + applied (`1080_warmpawz_pay_phase1_schema.sql`)  
**Document type:** Implementation plan — **no code, no SQL**  
**Date:** July 23, 2026  

**Out of scope (explicit):** Payment list, detail, exports, settlement/promotion display, payment repositories, payment admin APIs — all owned by **`feature/wpay-payment-flow`**.

---

## 1. Executive Summary

This plan defines the step-by-step delivery of the **Warmpawz Pay Vendor Catalogue Admin** on branch `feature/wpay-admin`.

**Deliverables:**

| Layer | Output |
|-------|--------|
| Backend | `/admin/warmpawz-pay/catalogue/*` REST APIs |
| Repositories | `VendorCatalogRepository`, `VendorEligibilityRepository` |
| Services | Catalogue admin, eligibility, audit |
| Admin web | `/warmpawz-pay/catalogue` — list, add, publish, bulk |
| RBAC | `admin.warmpawz_pay` permission + route guard |
| Tests | Unit + integration + manual smoke |

**Merge target:** `develop` (after Phase 1 schema PR merged)  
**Estimated phases:** 11 implementation phases (see §Implementation Phases below)  
**Blocking dependencies:** None beyond Phase 1 schema  
**Non-blocking parallel work:** Customer read API (`feature/abhi-wpay-customer`) can consume `listPublishedEligible` once Phase 2 repository lands.

---

## 2. Folder Structure

### 2.1 Backend (authoritative layout)

```text
backend/lambda/src/endpoints/warmpawz-pay/
├── admin/
│   └── catalogue/
│       ├── index.ts                          # registerWarmpawzPayCatalogueAdminRoutes
│       ├── routes/
│       │   └── catalogue-admin.routes.ts
│       ├── handlers/
│       │   ├── catalogue-list.handler.ts
│       │   ├── catalogue-detail.handler.ts
│       │   ├── catalogue-create.handler.ts
│       │   ├── catalogue-publish.handler.ts
│       │   ├── catalogue-unpublish.handler.ts
│       │   ├── catalogue-delete.handler.ts
│       │   ├── catalogue-bulk-publish.handler.ts
│       │   ├── catalogue-bulk-unpublish.handler.ts
│       │   ├── catalogue-bulk-delete.handler.ts
│       │   └── vendor-candidates.handler.ts
│       ├── services/
│       │   ├── vendor-catalog-admin.service.ts
│       │   ├── vendor-eligibility.service.ts
│       │   └── catalogue-audit.service.ts
│       ├── dto/
│       │   ├── catalogue.requests.ts         # Zod in + parse helpers
│       │   ├── catalogue.responses.ts        # mappers + types
│       │   └── catalogue.errors.ts           # error code constants
│       └── middleware/
│           └── require-warmpawz-pay-catalogue-admin.ts
├── repositories/
│   ├── vendor-catalog.repository.ts
│   ├── vendor-eligibility.repository.ts
│   └── interfaces/
│       ├── IVendorCatalogRepository.ts
│       └── IVendorEligibilityRepository.ts
├── constants/
│   ├── publish-status.ts                     # DRAFT | PUBLISHED
│   └── catalogue-limits.ts                   # MAX_PAGE_SIZE, MAX_BULK_SIZE
└── index.ts                                  # registerWarmpawzPayModule (future aggregate)
```

### 2.2 Admin web

```text
apps/admin-web/
├── app/warmpawz-pay/
│   └── catalogue/
│       └── page.tsx
├── components/admin/warmpawz-pay/catalogue/
│   ├── CataloguePage.tsx
│   ├── CatalogueTable.tsx
│   ├── CatalogueFilters.tsx
│   ├── AddVendorDialog.tsx
│   ├── PublishStatusBadge.tsx
│   ├── EligibilityWarnings.tsx
│   ├── BulkActionBar.tsx
│   └── ConfirmDeleteDialog.tsx
└── lib/api/
    └── warmpawz-pay-catalogue-admin.ts
```

### 2.3 Shared types

```text
packages/shared-types/src/
├── admin-portal-nav.ts                       # ADD nav row + permission
└── warmpawz-pay-catalogue-admin.ts           # optional shared DTO types
```

### 2.4 Tests

```text
backend/lambda/src/endpoints/warmpawz-pay/
├── admin/catalogue/__tests__/
│   ├── vendor-catalog-admin.service.test.ts
│   ├── vendor-eligibility.service.test.ts
│   └── catalogue.handlers.integration.test.ts
└── repositories/__tests__/
    └── vendor-catalog.repository.test.ts
```

---

## 3. Repository Interfaces

### 3.1 `IVendorCatalogRepository`

```text
insertDraft(vendorId: string, createdBy: string | null): Promise<CatalogueRow>
updatePublishStatus(params: {
  catalogueId: string;
  publishStatus: 'draft' | 'published';
  publishedAt: Date | null;
}): Promise<CatalogueRow | null>
deleteById(catalogueId: string): Promise<boolean>
findById(catalogueId: string): Promise<CatalogueRowWithVendor | null>
findByVendorId(vendorId: string): Promise<CatalogueRow | null>
existsForVendor(vendorId: string): Promise<boolean>
listAdmin(filters: CatalogueAdminFilters): Promise<CatalogueRowWithVendor[]>
countAdmin(filters: CatalogueAdminFilters): Promise<number>
listPublishedEligible(filters: PublishedEligibleFilters): Promise<PublishedVendorRow[]>
```

### 3.2 `IVendorEligibilityRepository`

```text
getSnapshot(vendorId: string): Promise<VendorEligibilitySnapshot | null>
searchCandidates(filters: VendorCandidateFilters): Promise<VendorCandidateRow[]>
countCandidates(filters: VendorCandidateFilters): Promise<number>
```

### 3.3 Interface placement rules

- Interfaces live in `repositories/interfaces/`
- Repositories implement interfaces; services depend on interfaces (DIP)
- Customer module (Abhi) imports **same interfaces** — no admin service imports

---

## 4. Repository Implementation Order

| Order | Repository | Methods (priority) | Notes |
|-------|------------|-------------------|-------|
| 1 | `VendorCatalogRepository` | `insertDraft`, `findById`, `existsForVendor`, `findByVendorId` | Core write/read |
| 2 | `VendorCatalogRepository` | `updatePublishStatus`, `deleteById` | Lifecycle |
| 3 | `VendorCatalogRepository` | `listAdmin`, `countAdmin` | Admin list |
| 4 | `VendorCatalogRepository` | `listPublishedEligible` | Shared with customer — can defer if customer branch not ready |
| 5 | `VendorEligibilityRepository` | `getSnapshot`, `searchCandidates`, `countCandidates` | Picker + warnings |

**Testing after each tranche:** unit tests with mocked `query()` or integration against dev RDS.

---

## 5. DTO Design

### 5.1 Request DTOs (Zod)

| Schema | Fields |
|--------|--------|
| `CreateCatalogueEntryRequest` | `vendorId` (uuid) — `.strict()` |
| `BulkCatalogueIdsRequest` | `catalogueIds` (uuid[], min 1, max 100) — `.strict()` |
| `CatalogueListQuery` | `page`, `pageSize`, `sortBy`, `sortOrder`, `publishStatus`, `q`, `eligibility`, `city`, `vendorId` |
| `VendorCandidatesQuery` | `q`, `page`, `pageSize`, `status` (optional filter) |

**Reject:** `discountPercent`, `promotionId`, `pricing`, or any unknown key.

### 5.2 Response DTOs

| Type | Fields |
|------|--------|
| `CatalogueListItemDto` | `catalogueId`, `vendorId`, `businessName`, `ownerName?`, `city?`, `phone?`, `publishStatus`, `publishedAt`, `createdAt`, `updatedAt`, `createdBy`, `eligibility`, `warnings?` |
| `CatalogueDetailDto` | Same as list item + optional audit summary |
| `CatalogueListResponse` | `items`, `pagination: { page, pageSize, total, totalPages }` |
| `VendorCandidateDto` | `vendorId`, `businessName`, `city`, `status`, `payBillEnabled`, `bankVerified` |
| `BulkOperationResponse` | `requested`, `succeeded`, `failed`, `results[]` |
| `EligibilityDto` | `payBillEnabled`, `bankVerified`, `vendorStatus`, `customerVisible` |

### 5.3 Error envelope

```text
{ success: false, error: { code: string, message: string, details?: unknown } }
```

Codes: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `VENDOR_NOT_FOUND`, `VENDOR_DELETED`, `CATALOGUE_ENTRY_NOT_FOUND`, `DUPLICATE_CATALOGUE_ENTRY`, `FEATURE_DISABLED`.

---

## 6. Validation Layer

### 6.1 Structure

- Zod schemas in `dto/catalogue.requests.ts`
- Handlers parse query/body → pass typed input to services
- Services enforce business rules (duplicate, state)

### 6.2 Validation matrix

| Operation | Handler (Zod) | Service (business) |
|-----------|---------------|-------------------|
| Create | UUID, strict body | vendor exists, not deleted, not duplicate |
| Publish | UUID param | entry exists, vendor not deleted, warnings |
| Unpublish | UUID param | entry exists, idempotent |
| Delete | UUID param | entry exists |
| List | query enums, page bounds | — |
| Bulk | array size, UUIDs | per-item existence |
| Candidates | query bounds | — |

### 6.3 Eligibility warnings (non-blocking)

Computed in `VendorEligibilityService.buildWarnings(snapshot)` — attached to publish/create detail responses.

---

## 7. Service Layer

### 7.1 `VendorCatalogAdminService`

**Dependencies:** `IVendorCatalogRepository`, `IVendorEligibilityRepository`, `CatalogueAuditService`, `VendorEligibilityService`

| Method | Returns |
|--------|---------|
| `createEntry(input, adminUserId)` | `CatalogueDetailDto` |
| `getEntry(catalogueId)` | `CatalogueDetailDto` |
| `listEntries(query)` | `CatalogueListResponse` |
| `publish(catalogueId, adminUserId)` | `CatalogueDetailDto` + warnings |
| `unpublish(catalogueId, adminUserId)` | `CatalogueDetailDto` |
| `deleteEntry(catalogueId, adminUserId)` | `{ deleted: true }` |
| `bulkPublish(ids, adminUserId)` | `BulkOperationResponse` |
| `bulkUnpublish(ids, adminUserId)` | `BulkOperationResponse` |
| `bulkDelete(ids, adminUserId)` | `BulkOperationResponse` |

### 7.2 `VendorEligibilityService`

| Method | Purpose |
|--------|---------|
| `computeCustomerVisible(catalogue, vendor)` | boolean |
| `buildWarnings(snapshot)` | string[] |
| `buildEligibilityDto(snapshot, customerVisible)` | `EligibilityDto` |

### 7.3 `CatalogueAuditService`

| Method | Purpose |
|--------|---------|
| `logCreated(entry, adminUserId)` | audit insert |
| `logPublished(entry, oldStatus, adminUserId)` | audit insert |
| `logUnpublished(entry, adminUserId)` | audit insert |
| `logDeleted(entry, adminUserId)` | audit insert |

**Failure policy:** Audit failure should **log error** but **not roll back** successful catalogue mutation (match platform pattern — financial catalogue is not payment-critical).

---

## 8. Route Registration

### 8.1 Registrar

`registerWarmpawzPayCatalogueAdminRoutes(app: Hono)` in `admin/catalogue/index.ts`

### 8.2 Registration pattern

```text
app.use('/admin/warmpawz-pay/catalogue/*', featureFlagMiddleware)   // optional
app.use('/admin/warmpawz-pay/catalogue/*', requireWarmpawzPayCatalogueAdmin)

GET    /admin/warmpawz-pay/catalogue
GET    /admin/warmpawz-pay/catalogue/vendor-candidates
GET    /admin/warmpawz-pay/catalogue/:catalogueId
POST   /admin/warmpawz-pay/catalogue
POST   /admin/warmpawz-pay/catalogue/:catalogueId/publish
POST   /admin/warmpawz-pay/catalogue/:catalogueId/unpublish
DELETE /admin/warmpawz-pay/catalogue/:catalogueId
POST   /admin/warmpawz-pay/catalogue/bulk/publish
POST   /admin/warmpawz-pay/catalogue/bulk/unpublish
POST   /admin/warmpawz-pay/catalogue/bulk/delete
```

**Route order:** Static paths (`vendor-candidates`, `bulk/*`) registered **before** `/:catalogueId` to avoid param shadowing.

### 8.3 Global handler registration

Wire in `handler/index.ts` on integration branch (`feature/warmpawzpay`):

```text
registerWarmpawzPayCatalogueAdminRoutes(app);
```

Catalogue admin PR can merge before integration wiring if routes are registered in same PR to `develop` (team choice — prefer register in wpay-admin PR to enable dev testing).

---

## 9. Handlers

| Handler | Delegates to | HTTP |
|---------|--------------|------|
| `catalogueListHandler` | `listEntries` | GET list |
| `catalogueDetailHandler` | `getEntry` | GET detail |
| `catalogueCreateHandler` | `createEntry` | POST create |
| `cataloguePublishHandler` | `publish` | POST publish |
| `catalogueUnpublishHandler` | `unpublish` | POST unpublish |
| `catalogueDeleteHandler` | `deleteEntry` | DELETE |
| `catalogueBulkPublishHandler` | `bulkPublish` | POST bulk/publish |
| `catalogueBulkUnpublishHandler` | `bulkUnpublish` | POST bulk/unpublish |
| `catalogueBulkDeleteHandler` | `bulkDelete` | POST bulk/delete |
| `vendorCandidatesHandler` | eligibility repo search | GET vendor-candidates |

**Handler contract:** Parse → call service → map to JSON → set status code. No SQL in handlers.

---

## 10. Middleware

### 10.1 `requireWarmpawzPayCatalogueAdmin`

**Pipeline:**

1. `requireAdminAuth(c)` → 401 if fail  
2. `resolveAdminPermissionsFromRequest(userId, authHeader)`  
3. `adminHasPermission(permissions, 'admin.warmpawz_pay')` → 403 if fail  
4. Attach `adminUserId` to context for audit  

### 10.2 `requireWarmpawzPayFeatureEnabled` (optional)

Check `process.env.WARMPAWZ_PAY_ENABLED === 'true'` → else 503 `FEATURE_DISABLED`.

Apply to all catalogue routes.

### 10.3 Rate limiting (optional MVP)

Bulk endpoints: 10 requests/minute per admin user — defer to platform middleware if available.

---

## 11. RBAC Integration

### 11.1 Shared types change

Add to `packages/shared-types/src/admin-portal-nav.ts`:

| Field | Value |
|-------|-------|
| `id` | `warmpawz-pay-catalogue` |
| `label` | Warmpawz Pay |
| `permissionId` | `admin.warmpawz_pay` |
| `pathPrefixes` | `['/warmpawz-pay']` |
| `routeHint` | `/warmpawz-pay/catalogue` |
| `section` | `main` |

### 11.2 Admin web guard

`AdminRouteGuard` picks up new `pathPrefixes` automatically when nav item added.

### 11.3 Backend enforcement

Middleware is authoritative — UI hiding is not sufficient.

### 11.4 Future split

When payment-flow adds observability, introduce `admin.warmpawz_pay.payments.read` without changing catalogue permission.

---

## 12. Audit Logging

### 12.1 Table

Use existing `entity_audit_log` or `admin_audit_log` (match `admin-comprehensive.ts` / governance pattern).

### 12.2 Payload shape

```text
entity_type: 'warmpawz_pay_vendor_catalog'
entity_id: <catalogue.uuid>
action: 'created' | 'published' | 'unpublished' | 'deleted'
actor_id: <admin.uuid>
changes: {
  vendor_id,
  publish_status: { from, to },
  published_at: { from, to }
}
created_at: NOW()
```

### 12.3 When to log

| Event | Action |
|-------|--------|
| POST create | `created` |
| POST publish | `published` |
| POST unpublish | `unpublished` |
| DELETE | `deleted` |
| Bulk | One audit row **per successful** item |

### 12.4 `created_by` column

Set on INSERT from JWT `adminUserId`. Not updated on publish/delete.

---

## 13. API Implementation Order

| Phase | Endpoints | Depends on |
|-------|-----------|------------|
| **5 — CRUD** | GET list, GET detail, GET vendor-candidates, POST create, DELETE | Phases 1–4 |
| **6 — Publish** | POST publish, POST unpublish | Phase 4 service |
| **7 — Bulk** | POST bulk/publish, bulk/unpublish, bulk/delete | Phase 6 |

### Detailed API checklist

- [ ] GET `/catalogue` — pagination, sort, filters, search  
- [ ] GET `/catalogue/vendor-candidates` — picker  
- [ ] GET `/catalogue/:catalogueId` — detail + eligibility  
- [ ] POST `/catalogue` — create draft  
- [ ] DELETE `/catalogue/:catalogueId` — delete  
- [ ] POST `/catalogue/:catalogueId/publish`  
- [ ] POST `/catalogue/:catalogueId/unpublish`  
- [ ] POST `/catalogue/bulk/publish`  
- [ ] POST `/catalogue/bulk/unpublish`  
- [ ] POST `/catalogue/bulk/delete`  

---

## 14. Admin UI Implementation Order

| Step | Component | API used |
|------|-----------|----------|
| 1 | RBAC nav entry visible | — |
| 2 | `CataloguePage` shell + layout | — |
| 3 | `CatalogueFilters` + `CatalogueTable` | GET list |
| 4 | `PublishStatusBadge` + row publish toggle | POST publish/unpublish |
| 5 | `EligibilityWarnings` column/banner | from list/detail DTO |
| 6 | `AddVendorDialog` + candidate search | GET vendor-candidates, POST create |
| 7 | `ConfirmDeleteDialog` | DELETE |
| 8 | `BulkActionBar` + selection state | bulk endpoints |
| 9 | Empty states, loading, error toasts | — |
| 10 | Feature flag hide when disabled | runtime config |

**No payments tab, no settlements table, no discount % inputs.**

### UI copy guidance

- Page title: **Warmpawz Pay — Vendor Catalogue**  
- Subtitle: Controls which vendors appear in customer Pay Bill discovery  
- Link (optional): “Manage promotions in Commercial Campaigns” — not in catalogue form  

---

## 15. Testing Strategy

### 15.1 Unit tests

| File | Focus |
|------|-------|
| `vendor-eligibility.service.test.ts` | `customerVisible` matrix |
| `vendor-catalog-admin.service.test.ts` | duplicate, idempotent publish, bulk partial |
| `catalogue.requests.test.ts` | Zod strict rejection |

### 15.2 Integration tests

| Scenario | Assert |
|----------|--------|
| Create draft | DB row, `publish_status=draft`, `created_by` |
| Duplicate create | 409 |
| Publish | `published`, `published_at` set |
| Publish unverified vendor | 200 + warnings |
| Unpublish | `draft` |
| Delete | row gone |
| List filters | correct counts |
| RBAC | 403 without permission |
| Feature disabled | 503 |

### 15.3 Admin web

- Route guard blocks unauthorized users  
- Publish toggle triggers correct API  
- Bulk selection + action  

### 15.4 Manual dev smoke

1. Login admin → open `/warmpawz-pay/catalogue`  
2. Add vendor (draft)  
3. Publish → verify warnings if eligibility incomplete  
4. Confirm customer API excludes until eligibility met (coordinate with Abhi)  
5. Unpublish → customer list hides  
6. Delete → row removed  

---

## 16. Deployment Strategy

### 16.1 Order

```text
1. Merge feature/wpay-admin → develop (backend + admin-web + shared-types)
2. CI deploys dev (GitHub Actions dev.yml)
   OR manual:
   ./scripts/deploy-lambda-direct.sh
   ./scripts/deploy-admin-web.sh
3. Verify WARMPAWZ_PAY_ENABLED=true on dev Lambda + admin runtime config
4. Manual smoke on dev admin URL
```

### 16.2 Environment variables

| Var | Dev | Purpose |
|-----|-----|---------|
| `WARMPAWZ_PAY_ENABLED` | `true` | Gate routes |

No new secrets for catalogue admin.

### 16.3 Prod

**Do not deploy prod** until payment-flow and customer flows are ready for go-live — catalogue admin alone is safe but low value without customer Pay Bill UI.

When approved:

```text
LAMBDA_FUNCTION_NAME=warmpawz-prod-api-handler ./scripts/deploy-lambda-direct.sh
./scripts/deploy-admin-web.sh --prod
```

No prod migration — Phase 1 already applied.

---

## 17. Rollback Strategy

| Scenario | Action |
|----------|--------|
| Bug in catalogue APIs | Revert `feature/wpay-admin` merge commit on develop; redeploy Lambda + admin web |
| Bad publish data | Admin unpublish or delete via UI/API — no DB migration rollback |
| RBAC too permissive | Remove nav permission assignment; redeploy admin-web only |
| Feature flag issue | Set `WARMPAWZ_PAY_ENABLED=false` — routes return 503, nav hidden |

**No schema rollback** — Phase 1 migration is additive. Catalogue rows can be cleaned with DELETE via admin API.

**Rollback does not affect payments** — wpay-admin does not touch payment tables.

---

## 18. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Team implements payments tab in wpay-admin | Medium | Scope creep | V2 analysis + this plan — PR review checklist |
| Discount fields in UI | Medium | Architecture violation | Code review + strict Zod |
| Customer branch blocked on repo | Low | Parallel delay | Ship `listPublishedEligible` in Phase 2 |
| Audit log table missing on env | Low | Audit fails silently | Try/catch + CloudWatch alert |
| Bulk op timeout on Lambda | Low | Partial UI failure | Max 100 items; sequential processing |
| Vendor not eligible but published | Expected | Support tickets | Warnings in UI |

---

## 19. Development Checklist

### Phase 1 — DTOs, constants, interfaces

- [ ] `publish-status.ts`, `catalogue-limits.ts`
- [ ] `IVendorCatalogRepository.ts`, `IVendorEligibilityRepository.ts`
- [ ] `catalogue.requests.ts`, `catalogue.responses.ts`, `catalogue.errors.ts`
- [ ] Unit tests for Zod schemas

### Phase 2 — VendorCatalogRepository

- [ ] `insertDraft`, `findById`, `existsForVendor`, `findByVendorId`
- [ ] `updatePublishStatus`, `deleteById`
- [ ] `listAdmin`, `countAdmin`
- [ ] `listPublishedEligible` (shared)
- [ ] Repository unit/integration tests

### Phase 3 — VendorEligibilityRepository + VendorEligibilityService

- [ ] `getSnapshot`, `searchCandidates`, `countCandidates`
- [ ] `computeCustomerVisible`, `buildWarnings`
- [ ] Unit tests for eligibility matrix

### Phase 4 — VendorCatalogAdminService + CatalogueAuditService

- [ ] All service methods
- [ ] Audit integration
- [ ] Service unit tests

### Phase 5 — CRUD APIs

- [ ] Handlers + routes for list, detail, candidates, create, delete
- [ ] Middleware wired
- [ ] Manual Postman/curl smoke

### Phase 6 — Publish / Unpublish APIs

- [ ] Publish + unpublish handlers
- [ ] Idempotent behavior verified

### Phase 7 — Bulk APIs

- [ ] Bulk publish, unpublish, delete handlers
- [ ] Partial failure envelope tested

### Phase 8 — RBAC integration

- [ ] `admin.warmpawz_pay` in `admin-portal-nav.ts`
- [ ] Middleware permission check
- [ ] Admin route guard verified

### Phase 9 — Audit logging

- [ ] All mutations write audit rows
- [ ] Verify on dev RDS

### Phase 10 — Admin UI

- [ ] Catalogue page + components
- [ ] API client typed
- [ ] Feature flag gating

### Phase 11 — Integration testing

- [ ] Integration test suite green
- [ ] Manual dev smoke complete
- [ ] PR to `develop` with test plan in description

---

## 20. Definition of Done

`feature/wpay-admin` is **done** when all of the following are true:

### Backend

- [ ] All catalogue endpoints in §13 implemented and documented in PR  
- [ ] No imports from payment/settlement/booking/ecommerce monolith paths  
- [ ] No queries to `payments`, `settlements`, `transactions`, `promotion_usages`, `coupon_usages`  
- [ ] `registerWarmpawzPayCatalogueAdminRoutes` registered on dev  
- [ ] RBAC enforced on every route  
- [ ] Audit log on create, publish, unpublish, delete  
- [ ] Feature flag respected  
- [ ] `npm run build` passes in `backend/lambda`  

### Admin web

- [ ] `/warmpawz-pay/catalogue` page functional  
- [ ] Add vendor, publish, unpublish, delete, bulk actions work against dev API  
- [ ] Eligibility warnings visible  
- [ ] No payments tab, no discount/pricing fields  
- [ ] Nav visible only with `admin.warmpawz_pay`  
- [ ] `npm run build` passes in `apps/admin-web`  

### Quality

- [ ] Unit tests for services + Zod  
- [ ] Integration tests for core catalogue flows  
- [ ] Manual smoke passed on dev  
- [ ] PR reviewed and merged to `develop`  

### Explicitly NOT required for wpay-admin DoD

- [ ] Payment list / detail admin APIs  
- [ ] Payment observability UI  
- [ ] Settlement or promotion status in admin  
- [ ] Customer Pay Bill UI (Abhi's branch)  
- [ ] Quote / initiate / verify (payment-flow branch)  

---

## Implementation Phases (Authoritative Sequence)

| Phase | Name | Deliverables |
|-------|------|--------------|
| **1** | DTOs, constants, interfaces | §19 Phase 1 |
| **2** | VendorCatalogRepository | §19 Phase 2 |
| **3** | VendorEligibilityRepository + VendorEligibilityService | §19 Phase 3 |
| **4** | VendorCatalogAdminService (+ audit) | §19 Phase 4 |
| **5** | CRUD APIs | §13 Phase 5 |
| **6** | Publish / Unpublish APIs | §13 Phase 6 |
| **7** | Bulk operations | §13 Phase 7 |
| **8** | RBAC integration | §11 |
| **9** | Audit logging | §12 |
| **10** | Admin UI | §14 |
| **11** | Integration testing | §15 |

---

*Companion to `WARMPAWZ_PAY_ADMIN_ANALYSIS_V2.md`. Payment observability implementation plan will be authored separately on `feature/wpay-payment-flow`.*
